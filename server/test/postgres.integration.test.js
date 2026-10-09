'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {createPostgres}=require('../src/db/postgres');
const {runMigrations}=require('../src/db/migrate');
const {createRepositories}=require('../src/db/repositories');

const TEST_DATABASE_URL=String(process.env.TEST_DATABASE_URL||'').trim();

test('real PostgreSQL runs migrations and core repository/enrichment flow',{
  skip:!TEST_DATABASE_URL
},async()=>{
  const db=createPostgres({
    connectionString:TEST_DATABASE_URL,
    max:2,
    applicationName:'salong-ci'
  });

  try{
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');

    const migration=await db.withClient(client=>runMigrations(client));
    assert.ok(migration.applied.includes('001_initial'));

    await db.query(
      `INSERT INTO members(id,auth_subject,name,email,role)
       VALUES ($1,$2,$3,$4,$5)`,
      ['m-1','auth-ci','CI User','ci@example.test','owner']
    );
    await db.query(
      `INSERT INTO organizations(id,name,domain,segment,owner_id)
       VALUES ($1,$2,$3,$4,$5)`,
      ['o-1','CI Organisasjon','ci.example.test','fag','m-1']
    );
    await db.query(
      `INSERT INTO contacts(id,organization_id,name,title,email,is_primary,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['c-1','o-1','Kari Testesen','Arrangementsansvarlig','kari@example.test',true,true]
    );

    const repositories=createRepositories(db);

    const account=await repositories.accounts.get('o-1');
    assert.equal(account.name,'CI Organisasjon');
    assert.equal(account.owner_id,'m-1');

    const contacts=await repositories.contacts.listByAccount('o-1');
    assert.equal(contacts.length,1);
    assert.equal(contacts[0].is_primary,true);

    const addedContact=await repositories.contacts.add({
      id:'c-2',
      accountId:'o-1',
      name:'Ola Kontakt',
      title:'Programleder',
      email:'ola@example.test',
      sourceState:'manual'
    });
    assert.equal(addedContact.name,'Ola Kontakt');
    assert.equal(addedContact.is_primary,false);

    const updatedContact=await repositories.contacts.update('c-2',{
      title:'Program- og arrangementsleder',
      relevant:true
    });
    assert.equal(updatedContact.title,'Program- og arrangementsleder');
    assert.equal(updatedContact.relevant,true);

    const primaryContact=await repositories.contacts.setPrimary('c-2');
    assert.equal(primaryContact.is_primary,true);
    const afterPrimary=await repositories.contacts.listByAccount('o-1');
    assert.equal(afterPrimary.find(contact=>contact.id==='c-1').is_primary,false);
    assert.equal(afterPrimary.find(contact=>contact.id==='c-2').is_primary,true);

    const dncContact=await repositories.contacts.setDoNotContact('c-2',{
      value:true,
      reason:'Ba om å ikke bli kontaktet'
    });
    assert.equal(dncContact.do_not_contact,true);
    assert.equal(dncContact.is_primary,false);

    const created=await repositories.enrichmentJobs.create({
      id:'job-1',
      accountId:'o-1',
      requestedBy:'m-1'
    });
    assert.equal(created.status,'queued');

    const claimed=await repositories.enrichmentJobs.claimNext('worker-ci');
    assert.equal(claimed.id,'job-1');
    assert.equal(claimed.status,'running');
    assert.equal(claimed.lockedBy,'worker-ci');

    await repositories.enrichmentJobs.setSourceStatus(
      'job-1','worker-ci','web','ok'
    );

    await repositories.sources.save({
      id:'src-1',
      organizationId:'o-1',
      enrichmentJobId:'job-1',
      provider:'web',
      sourceUrl:'https://ci.example.test/team',
      title:'Team',
      checkedAt:'2026-10-08T06:00:00.000Z',
      metadata:{contentHash:'ci-hash'}
    });

    await repositories.enrichmentResults.upsert('job-1',{
      organization:{name:'CI Organisasjon'},
      eventSignals:[],
      contactCandidates:[{name:'Kari Testesen',title:'Arrangementsansvarlig'}],
      contactData:[],
      recommendation:{whyNow:null,recommendedUseCase:null,recommendedRoom:null,roomBasis:null}
    });

    await repositories.researchedFacts.save({
      id:'fact-1',
      organizationId:'o-1',
      fieldKey:'contact_candidate',
      value:{name:'Kari Testesen'},
      sourceId:'src-1',
      confidence:95,
      reviewState:'unreviewed',
      checkedAt:'2026-10-08T06:00:00.000Z'
    });

    const finished=await repositories.enrichmentJobs.finish(
      'job-1','worker-ci',{status:'needs_review'}
    );
    assert.equal(finished.status,'needs_review');
    assert.equal(finished.lockedBy,null);

    const result=await repositories.enrichmentResults.get('job-1');
    assert.equal(result.contactCandidates[0].name,'Kari Testesen');

    const facts=await repositories.researchedFacts.listForAccount('o-1');
    assert.equal(facts.length,1);
    assert.equal(facts[0].sourceId,'src-1');

    // Crash/restart safety: a stale running lock is requeued and can be
    // claimed by a new worker without resetting attempt history.
    await repositories.enrichmentJobs.create({
      id:'job-restart',
      accountId:'o-1',
      requestedBy:'m-1'
    });
    const firstClaim=await repositories.enrichmentJobs.claimNext('worker-old');
    assert.equal(firstClaim.id,'job-restart');
    assert.equal(firstClaim.attemptCount,1);

    await db.query(
      `UPDATE enrichment_jobs
       SET locked_at=now()-interval '2 hours'
       WHERE id=$1`,
      ['job-restart']
    );

    const recovered=await repositories.enrichmentJobs.requeueStale(900);
    assert.deepEqual(recovered.map(job=>job.id),['job-restart']);
    assert.equal(recovered[0].status,'queued');
    assert.equal(recovered[0].lockedBy,null);

    const secondClaim=await repositories.enrichmentJobs.claimNext('worker-new');
    assert.equal(secondClaim.id,'job-restart');
    assert.equal(secondClaim.status,'running');
    assert.equal(secondClaim.lockedBy,'worker-new');
    assert.equal(secondClaim.attemptCount,2);

    const touched=await repositories.enrichmentJobs.touch('job-restart','worker-new');
    assert.equal(touched.lockedBy,'worker-new');

    const restarted=await repositories.enrichmentJobs.finish(
      'job-restart','worker-new',{status:'partial'}
    );
    assert.equal(restarted.status,'partial');

    await repositories.enrichmentJobs.create({id:'job-exhausted',accountId:'o-1',requestedBy:'m-1'});
    const exhaustedClaim=await repositories.enrichmentJobs.claimNext('worker-crashed');
    assert.equal(exhaustedClaim.id,'job-exhausted');
    await db.query(
      `UPDATE enrichment_jobs SET locked_at=now()-interval '2 hours',attempt_count=3 WHERE id=$1`,
      ['job-exhausted']
    );
    const exhaustedRecovery=await repositories.enrichmentJobs.requeueStale(900,3);
    assert.equal(exhaustedRecovery.length,1);
    assert.equal(exhaustedRecovery[0].status,'failed');
    assert.equal(exhaustedRecovery[0].errorCode,'stale_worker_attempts_exhausted');
    assert.ok(exhaustedRecovery[0].completedAt);
    assert.equal(await repositories.enrichmentJobs.claimNext('worker-next'),null);

    // Exercise private artifact staging and mapping using synthetic data only.
    await db.query('DROP SCHEMA IF EXISTS artifact_export CASCADE');
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');
    const rerun=await db.withClient(client=>runMigrations(client));
    assert.ok(rerun.applied.includes('002_artifact_export'));
    // The production company-first import runs after the owner has been provisioned.
    await db.query("INSERT INTO members(id,auth_subject,name,role,active) VALUES ($1,$2,$3,'owner',true)",
      ['salong-owner','00000000-0000-4000-8000-000000000001','Eier']);
    const {buildImportPlan,applyImport}=require('../src/db/artifact-import');
    const plan=buildImportPlan({collections:{
      orgs:{
        'o-import':{name:'Imported Example Org',website:'example.test'},
        'o-excluded':{name:'Demo Only',example:true}
      },
      mtper:{'p-import':{accId:'o-import',name:'Synthetic Person'}},
      mtjob:{'j-import':{accId:'o-import',kind:'enrich',status:'running'}},
      audit:{'audit-import':{action:'synthetic-only'}}
    }});
    const imported=await db.withClient(client=>applyImport(client,plan,{allowUnmapped:true}));
    assert.equal(imported.staged_documents,5);
    assert.equal(imported.actual.organizations,1);
    assert.equal(imported.actual.contacts,1);
    assert.equal(imported.actual.enrichment_jobs,1);
    const staging=await db.query('SELECT data FROM artifact_export.documents WHERE collection=$1 AND doc_id=$2',['audit','audit-import']);
    assert.deepEqual(staging.rows[0].data,{action:'synthetic-only'});
    const inert=await db.query('SELECT status FROM enrichment_jobs WHERE id=$1',['j-import']);
    assert.equal(inert.rows[0].status,'cancelled');
    await assert.rejects(
      ()=>db.withClient(client=>applyImport(client,plan,{allowUnmapped:true})),
      /not empty/
    );

    // New company-only mode persists A/B/C suggestions and reasons without
    // importing contacts/jobs or modifying the artifact staging payload.
    await db.query('DROP SCHEMA IF EXISTS artifact_export CASCADE');
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.withClient(client=>runMigrations(client));
    await db.query(
      "INSERT INTO members(id,auth_subject,name,role,active) VALUES ($1,$2,$3,'owner',true)",
      ['salong-owner','00000000-0000-4000-8000-000000000002','Eier']
    );
    const {companyFirstPlan}=require('../src/db/artifact-import');
    const sampleCompany={
      collections:{
        orgs:{'previous':{name:'Prior user choice',tier:'B'}},
        mtacc:{
          'cultural':{name:'Synthetic Literary Forum',segId:'forlag',geo:'oslo',
            about:'Bokslipp og litteratur',enr:{event_signals:[
              {level:'Dokumentert',source_url:'https://example.test/event',sourceDate:'2026-10-06'}
            ]}},
          'legacy-link':{createdFrom:'profil'}
        },
        audit:{'private-note':{action:'saved privately'}}
      }
    };
    const lite=companyFirstPlan(sampleCompany);
    assert.equal(lite.report.priorities.counts.A,1);
    assert.equal(lite.report.priorities.counts.B,1);
    const liteResult=await db.withClient(client=>applyImport(client,lite));
    assert.equal(liteResult.actual.organizations,2);
    assert.equal(liteResult.actual.prospects,1);
    assert.equal(liteResult.actual.contacts,0);
    const tiered=await db.query('SELECT tier FROM organizations WHERE id=$1',['cultural']);
    assert.equal(tiered.rows[0].tier,'A');
    const unchanged=await db.query('SELECT tier FROM organizations WHERE id=$1',['previous']);
    assert.equal(unchanged.rows[0].tier,'B');
    const meta=await db.query('SELECT metadata FROM prospects WHERE organization_id=$1',['cultural']);
    assert.equal(meta.rows[0].metadata.import_priority.tier,'A');
    const rawStored=await db.query(
      'SELECT data FROM artifact_export.documents WHERE collection=$1 AND doc_id=$2',
      ['mtacc','cultural']
    );
    assert.deepEqual(rawStored.rows[0].data,sampleCompany.collections.mtacc.cultural);

    // Editing must not corrupt the imported rows or lose manual A/B/C changes.
    const createdCompany=await repositories.accounts.createOrganization({
      name:'Synthetic New Institution',org_number:'123456789',priority:'A',
      website:'https://new.example.test/',domain:'new.example.test',
      segment:'forlag',previous_customer:false
    },{id:'new-org',actorId:'salong-owner',auditId:'audit-new'});
    assert.equal(createdCompany.organization.priority,'A');
    assert.equal(createdCompany.organization.quality_manual_override,true);
    const duplicate=await repositories.accounts.createOrganization({
      name:'Synthetic New Institution',org_number:'123456789'
    },{id:'new-org-2',actorId:'salong-owner',auditId:'audit-nope'});
    assert.equal(duplicate.duplicate,true);
    const changed=await repositories.accounts.updateOrganization('previous',{
      priority:'C',segment:'fag'
    },{actorId:'salong-owner',auditId:'audit-edit'});
    assert.equal(changed.organization.priority,'C');
    assert.equal(changed.organization.quality_manual_override,true);
    const manual=await db.query(
      'SELECT tier,quality_manual_override FROM organizations WHERE id=$1',['previous']
    );
    assert.equal(manual.rows[0].tier,'C');
    assert.equal(manual.rows[0].quality_manual_override,true);
    const events=await db.query(
      "SELECT action,before_data,after_data FROM crm_audit_events WHERE organization_id IN ('previous','new-org') ORDER BY created_at"
    );
    assert.equal(events.rows.length,2);
    assert.ok(events.rows.some(row=>row.action==='organization_created'));
    assert.ok(events.rows.some(row=>row.action==='organization_updated'));
    assert.equal(events.rows.find(row=>row.action==='organization_updated').after_data.priority,'C');
    const rls=await db.query(
      "SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace "+
      "AND relname IN ('organizations','contacts','members','activities','crm_audit_events')"
    );
    assert.equal(rls.rows.length,5);
    assert.ok(rls.rows.every(row=>row.relrowsecurity===true));
    const companies=await repositories.accounts.listOrganizations();
    assert.equal(companies.find(row=>row.id==='previous').priority,'C');
    assert.equal(companies.find(row=>row.id==='new-org').org_number,'123456789');
    // Distinct-company outreach must count real outgoing touch events only.
    const a1=await repositories.activities.create({
      id:'touch-out-1',accountId:'previous',type:'email',
      text:'Invitasjon sendt',direction:'out',actorId:'salong-owner',
      happenedAt:'2027-01-11T09:00:00Z'
    });
    const a2=await repositories.activities.create({
      id:'touch-out-2',accountId:'previous',type:'call',
      text:'Oppfølging per telefon',direction:'out',actorId:'salong-owner',
      happenedAt:'2027-01-12T09:00:00Z'
    });
    const incoming=await repositories.activities.create({
      id:'touch-in',accountId:'new-org',type:'email',
      text:'Innkommende',direction:'in',actorId:'salong-owner',
      happenedAt:'2027-01-12T10:00:00Z'
    });
    const a3=await repositories.activities.create({
      id:'touch-out-3',accountId:'new-org',type:'meeting',
      text:'Møte',direction:'out',actorId:'salong-owner',
      happenedAt:'2027-02-10T10:00:00Z'
    });
    assert.equal(a1.completed,true);
    assert.equal(a2.account_id,'previous');
    assert.equal(incoming.direction,'in');
    assert.equal(a3.type,'meeting');
    // October contacts also count toward the 500-company goal.
    await repositories.activities.create({
      id:'early-outbound',accountId:'cultural',type:'call',
      text:'Tidlig kontakt',direction:'out',actorId:'salong-owner',
      happenedAt:'2026-10-09T09:00:00Z'
    });
    const counter=await repositories.activities.outreachSummary();
    assert.equal(counter.contacted,3);
    assert.equal(counter.touch_count,4);
    const history=await repositories.activities.listForAccount('previous');
    assert.equal(history.length,2);
    assert.equal(history[0].id,'touch-out-2');
    // Pipeline recency comes from actual completed communication on the organization.
    await db.query(
      "INSERT INTO opportunities(id,organization_id,title,stage,value_amount) VALUES ($1,$2,$3,$4,$5)",
      ['opp-for-test','previous','Seminar med bokbransjen','tilbud',45000]
    );
    const op=await repositories.opportunities.list('previous');
    assert.equal(op.length,1);
    assert.equal(op[0].value,45000);
    assert.equal(op[0].stage,'tilbud');
    assert.equal(op[0].last_activity_at,'2027-01-12T09:00:00.000Z');

    // Real pipeline writes: company existence, no double-create, stage CAS and audit.
    const createdOpportunity=await repositories.opportunities.create({
      accountId:'previous',title:'Møte om boklansering',eventDate:'2027-03-12',
      value:19500.5,room:'Wergeland',notes:'Syntetisk test'
    },{id:'opp-persist',actorId:'salong-owner',auditId:'audit-pipeline-new'});
    assert.equal(createdOpportunity.opportunity.stage,'ny');
    assert.equal(createdOpportunity.opportunity.value,19500.5);
    const duplicateOpportunity=await repositories.opportunities.create({
      accountId:'previous',title:'Møte om boklansering',eventDate:'2027-03-12'
    },{id:'opp-collision',actorId:'salong-owner',auditId:'audit-pipeline-duplicate'});
    assert.equal(duplicateOpportunity.duplicate,true);
    const offered=await repositories.opportunities.changeStage('opp-persist',{
      stage:'tilbud',expectedStage:'ny'
    },{actorId:'salong-owner',auditId:'audit-pipeline-offer'});
    assert.equal(offered.opportunity.stage,'tilbud');
    assert.equal(offered.opportunity.account_id,'previous');
    const oldChange=await repositories.opportunities.changeStage('opp-persist',{
      stage:'bekreftet',expectedStage:'ny'
    },{actorId:'salong-owner',auditId:'audit-pipeline-stale'});
    assert.equal(oldChange.conflict,true);
    assert.equal(oldChange.currentStage,'tilbud');
    const noOp=await repositories.opportunities.changeStage('opp-persist',{
      stage:'tilbud',expectedStage:'tilbud'
    },{actorId:'salong-owner',auditId:'audit-pipeline-noop'});
    assert.equal(noOp.unchanged,true);
    const lost=await repositories.opportunities.changeStage('opp-persist',{
      stage:'tapt',expectedStage:'tilbud',lostReason:'Datoen passer ikke'
    },{actorId:'salong-owner',auditId:'audit-pipeline-lost'});
    assert.equal(lost.opportunity.stage,'tapt');
    assert.equal(lost.opportunity.lost_reason,'Datoen passer ikke');
    const eventHistory=await db.query(
      'SELECT action,before_data,after_data FROM crm_opportunity_events WHERE opportunity_id=$1 ORDER BY created_at,id',
      ['opp-persist']
    );
    assert.equal(eventHistory.rows.length,3);
    assert.ok(eventHistory.rows.some(e=>e.action==='opportunity_created'));
    assert.ok(eventHistory.rows.some(e=>e.action==='opportunity_stage_changed'&&e.after_data.stage==='tapt'));
    const privateAudit=await db.query(
      "SELECT relrowsecurity FROM pg_class WHERE oid='public.crm_opportunity_events'::regclass"
    );
    assert.equal(privateAudit.rows[0].relrowsecurity,true);
    assert.equal((await repositories.opportunities.get('opp-persist')).stage,'tapt');




    const task=await repositories.activities.create({
      id:'task-followup',accountId:'previous',type:'task',
      text:'Ring om en uke',dueAt:'2027-01-15T09:00:00Z',
      completed:false,actorId:'salong-owner'
    });
    assert.equal(task.completed,false);
    const completedTask=await repositories.activities.complete('task-followup');
    assert.equal(completedTask.completed,true);
    assert.equal((await repositories.activities.outreachSummary()).contacted,3);


  }finally{
    await db.close();
  }
});
