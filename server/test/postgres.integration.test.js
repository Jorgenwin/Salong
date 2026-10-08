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
  }finally{
    await db.close();
  }
});
