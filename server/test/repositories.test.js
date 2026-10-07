'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createRepositories,
  mapAccount,
  mapContact,
  mapOpportunity,
  mapEnrichmentJob,
  calendarParts,
  buildProspectWhere
}=require('../src/db/repositories');

test('account mapper exposes the Salong account contract instead of raw rows',()=>{
  const account=mapAccount({
    id:'o-1',
    name:'Eksempel AS',
    org_number:'123',
    domain:'example.no',
    website:'https://example.no',
    segment:'Forlag',
    owner_id:'m-1',
    relationship:'prospekt',
    prospect_kind:'target',
    prospect_status:'qualified',
    prospect_stage:'research',
    fit_score:'81.5',
    batch_id:'b-1',
    deleted_at:null
  });

  assert.deepEqual(account,{
    id:'o-1',
    name:'Eksempel AS',
    org_number:'123',
    domain:'example.no',
    website:'https://example.no',
    segment_id:'Forlag',
    owner_id:'m-1',
    relation:'prospekt',
    kind:'target',
    status:'qualified',
    stage:'research',
    fit_score:81.5,
    batch_id:'b-1',
    data_status:'active'
  });
  assert.equal('deleted_at' in account,false);
});

test('contact mapper keeps unknown enrichment values null',()=>{
  const contact=mapContact({
    id:'p-1',
    organization_id:'o-1',
    name:'',
    title:null,
    email:null,
    email_status:null,
    phone:null,
    phone_status:null,
    linkedin_url:null,
    role_match:null,
    relevant:null,
    active:true,
    do_not_contact:false,
    verified_at:new Date('2026-10-07T09:30:00.000Z'),
    last_enriched_at:null
  });

  assert.equal(contact.name,'');
  assert.equal(contact.email,null);
  assert.equal(contact.relevant,null);
  assert.equal(contact.verified,true);
  assert.equal(contact.last_enriched_at,'2026-10-07T09:30:00.000Z');
});

test('opportunity mapper follows the current frontend service shape',()=>{
  const opportunity=mapOpportunity({
    id:'d-1',
    organization_id:'o-1',
    title:'Fagdag',
    stage:'dialog',
    value_amount:'25000.00',
    room:'solstad',
    event_date:new Date('2027-03-10T00:00:00.000Z'),
    attendees:200,
    owner_id:null,
    stage_at:new Date('2026-10-07T10:00:00.000Z'),
    lost_reason:null
  });

  assert.equal(opportunity.account_id,'o-1');
  assert.equal(opportunity.value,25000);
  assert.equal(opportunity.attendees,200);
  assert.equal(opportunity.event_date,'2027-03-10');
  assert.equal(opportunity.stage_changed_at,'2026-10-07T10:00:00.000Z');
});

test('prospect filter is parameterized and never interpolates user values into SQL',()=>{
  const filter=buildProspectWhere({
    segment_id:"Forlag' OR 1=1 --",
    owner_id:'m-1',
    status:'qualified',
    batch_id:'b-1'
  });

  assert.deepEqual(filter.params,[
    "Forlag' OR 1=1 --",
    'm-1',
    'qualified',
    'b-1'
  ]);
  assert.match(filter.where,/o\.segment = \$1/);
  assert.match(filter.where,/batch_id = \$4/);
  assert.equal(filter.where.includes("OR 1=1"),false);
});

test('repositories use parameterized account/contact queries and return mapped rows',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text,params});
      if(/FROM contacts/.test(text)){
        return {rows:[{
          id:'p-1',
          organization_id:'o-1',
          name:'Pia Testesen',
          active:true,
          do_not_contact:false
        }]};
      }
      return {rows:[{
        id:'o-1',
        name:'Eksempel AS',
        segment:'Forlag',
        fit_score:'90',
        deleted_at:null
      }]};
    }
  };

  const repositories=createRepositories(db);
  const account=await repositories.accounts.get('o-1');
  const contacts=await repositories.contacts.listByAccount('o-1');

  assert.equal(account.id,'o-1');
  assert.equal(account.fit_score,90);
  assert.equal(contacts[0].name,'Pia Testesen');
  assert.deepEqual(calls[0].params,['o-1']);
  assert.deepEqual(calls[1].params,['o-1']);
});

test('createRepositories requires an injected database boundary',()=>{
  assert.throws(()=>createRepositories(null),/requires an object with query/);
});

test('calendar repository combines opportunities, bookings and actionable activities',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text:String(text),params});
      if(/FROM opportunities d/.test(text)){
        return {rows:[{
          id:'d-1',
          title:'Årskonferanse',
          stage:'bekreftet',
          event_date:new Date('2027-10-14T00:00:00.000Z'),
          organization_name:'Recovery Norge',
          room:'solstad',
          owner_id:'m-1'
        }]};
      }
      if(/FROM bookings b/.test(text)){
        return {rows:[{
          id:'b-1',
          organization_id:'o-2',
          organization_name:'Eksempel AS',
          title:'Frokostmøte',
          status:'forelopig',
          room:'collett',
          starts_at:new Date('2027-10-15T08:30:00.000Z')
        }]};
      }
      if(/FROM activities a/.test(text)){
        return {rows:[{
          id:'a-1',
          organization_id:'o-3',
          opportunity_id:'d-3',
          organization_name:'Forlaget',
          opportunity_room:'hagerup',
          opportunity_owner_id:'m-2',
          type:'meeting',
          text:'Møte om vårprogrammet',
          happened_at:new Date('2027-10-16T11:00:00.000Z'),
          due_at:null,
          owner_id:null
        }]};
      }
      return {rows:[]};
    }
  };

  const repositories=createRepositories(db);
  const items=await repositories.calendar.list({
    from:'2027-10-01',
    to:'2027-10-31'
  });

  assert.deepEqual(items.map(item=>[item.date,item.kind,item.open]),[
    ['2027-10-14','event','deal:d-1'],
    ['2027-10-15','hold','org:o-2'],
    ['2027-10-16','meet','deal:d-3']
  ]);
  assert.equal(items[1].time,'10:30');
  assert.ok(calls.find(call=>/FROM bookings b/.test(call.text)).text.includes("b.status IN ('bekreftet','forelopig','holdt')"));
  assert.equal(items[2].time,'13:00');
  assert.equal(items[2].owner,'m-2');
  assert.equal(calls.length,3);
  for(const call of calls){
    assert.deepEqual(call.params,['2027-10-01','2027-10-31']);
  }
});


test('calendar timestamps are rendered in Europe/Oslo across DST and midnight',()=>{
  assert.deepEqual(calendarParts(new Date('2027-01-15T08:00:00.000Z')),{date:'2027-01-15',time:'09:00'});
  assert.deepEqual(calendarParts(new Date('2027-07-15T07:00:00.000Z')),{date:'2027-07-15',time:'09:00'});
  assert.deepEqual(calendarParts(new Date('2027-01-15T23:30:00.000Z')),{date:'2027-01-16',time:'00:30'});
});


test('enrichment job mapper exposes explicit queue and error state',()=>{
  const job=mapEnrichmentJob({
    id:'job-1',
    account_id:'o-1',
    status:'running',
    requested_by:'m-1',
    source_statuses:{web:'ok',apollo:'plan_restricted'},
    error_code:null,
    error_message:null,
    attempt_count:2,
    available_at:new Date('2026-10-07T12:00:00.000Z'),
    locked_at:new Date('2026-10-07T12:01:00.000Z'),
    locked_by:'worker-1',
    started_at:new Date('2026-10-07T12:01:00.000Z'),
    completed_at:null,
    created_at:new Date('2026-10-07T11:59:00.000Z'),
    updated_at:new Date('2026-10-07T12:01:00.000Z')
  });

  assert.equal(job.accountId,'o-1');
  assert.equal(job.status,'running');
  assert.equal(job.attemptCount,2);
  assert.equal(job.lockedBy,'worker-1');
  assert.deepEqual(job.sourceStatuses,{web:'ok',apollo:'plan_restricted'});
  assert.equal(job.completedAt,null);
});

test('enrichment queue claim is atomic and uses SKIP LOCKED',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text:String(text),params});
      return {rows:[{
        id:'job-1',
        account_id:'o-1',
        status:'running',
        source_statuses:{},
        attempt_count:1,
        locked_by:'worker-a',
        locked_at:new Date('2026-10-07T12:00:00.000Z'),
        started_at:new Date('2026-10-07T12:00:00.000Z')
      }]};
    }
  };

  const repositories=createRepositories(db);
  const job=await repositories.enrichmentJobs.claimNext('worker-a');

  assert.equal(job.id,'job-1');
  assert.equal(job.lockedBy,'worker-a');
  assert.equal(job.attemptCount,1);
  assert.match(calls[0].text,/FOR UPDATE SKIP LOCKED/);
  assert.match(calls[0].text,/attempt_count=j\.attempt_count\+1/);
  assert.deepEqual(calls[0].params,['worker-a']);
  await assert.rejects(
    repositories.enrichmentJobs.claimNext(''),
    /workerId is required/
  );
});

test('enrichment worker updates are locked, parameterized and fail closed',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text:String(text),params});
      return {rows:[{
        id:'job-1',
        account_id:'o-1',
        status:/status='queued'/.test(String(text))?'queued':params&&params[2]||'running',
        source_statuses:params&&params[3]?{[params[2]]:params[3]}:{},
        attempt_count:2,
        locked_by:/locked_by=NULL/.test(String(text))?null:'worker-a'
      }]};
    }
  };

  const repositories=createRepositories(db);

  await repositories.enrichmentJobs.setSourceStatus('job-1','worker-a','web','ok');
  assert.deepEqual(calls[0].params,['job-1','worker-a','web','ok']);
  assert.match(calls[0].text,/jsonb_set/);
  assert.match(calls[0].text,/locked_by=\$2/);

  await assert.rejects(
    repositories.enrichmentJobs.setSourceStatus('job-1','worker-a','web','made_up'),
    /invalid enrichment source status/
  );

  await repositories.enrichmentJobs.finish('job-1','worker-a',{
    status:'partial',
    errorCode:'apollo_plan',
    errorMessage:'Personsøk er ikke tilgjengelig.'
  });
  assert.deepEqual(calls[1].params,[
    'job-1','worker-a','partial','apollo_plan','Personsøk er ikke tilgjengelig.'
  ]);
  assert.match(calls[1].text,/completed_at=now\(\)/);
  assert.match(calls[1].text,/locked_by=NULL/);

  await assert.rejects(
    repositories.enrichmentJobs.finish('job-1','worker-a',{status:'running'}),
    /invalid enrichment finish status/
  );

  await repositories.enrichmentJobs.reschedule('job-1','worker-a',{
    delaySeconds:30,
    errorCode:'rate_limited',
    errorMessage:'Prøv igjen senere.'
  });
  assert.deepEqual(calls[2].params,[
    'job-1','worker-a',30,'rate_limited','Prøv igjen senere.'
  ]);
  assert.match(calls[2].text,/status='queued'/);

  await assert.rejects(
    repositories.enrichmentJobs.reschedule('job-1','worker-a',{delaySeconds:-1}),
    /delaySeconds must be a non-negative number/
  );
});
