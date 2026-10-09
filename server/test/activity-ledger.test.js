'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {progressFromStoredOutreach,workdaysInclusive,handleReadRequest}
  =require('../src/api/read');
const {createActivityRepository}=require('../src/db/activity-ledger');

test('500-company outreach pace is based on unique persisted outbound companies',()=>{
  assert.equal(workdaysInclusive('2027-05-28','2027-05-31'),2);
  assert.equal(workdaysInclusive('2027-06-01','2027-05-31'),0);
  const progress=progressFromStoredOutreach(
    {contacted:26,contacted_today:3,touch_count:39},
    {today:'2027-05-28'}
  );
  assert.equal(progress.goal,500);
  assert.equal(progress.contacted,26);
  assert.equal(progress.remaining,474);
  assert.equal(progress.daily_required,237);
  assert.equal(progress.contacted_today,3);
  const done=progressFromStoredOutreach({contacted:515},
    {today:'2027-06-08'});
  assert.equal(done.remaining,0);
  assert.equal(done.daily_required,0);
  assert.equal(done.deadline_passed,false);
});

test('activity ledger uses parameterized SQL and excludes unsent/undone/internal notes',async()=>{
  const calls=[];
  const db={async query(sql,params){
    calls.push({sql,params});
    return {rows:[{contacted:2,contacted_today:1,touch_count:3}]};
  }};
  const repo=createActivityRepository(db);
  const result=await repo.outreachSummary();
  assert.equal(result.contacted,2);
  assert.deepEqual(calls[0].params,[]);
  assert.doesNotMatch(calls[0].sql,/a\.happened_at\s*(?:>=|<)/,'Early/late contacts must still count');
  assert.match(calls[0].sql,/count\(DISTINCT a\.organization_id\)/i);
  assert.match(calls[0].sql,/a\.direction='out'/);
  assert.match(calls[0].sql,/a\.done=true/);
  assert.match(calls[0].sql,/a\.type IN \('call','email','meeting','visning'\)/);
});

test('authenticated activity timeline and outreach summary use their repositories',async()=>{
  let readCalls=0;
  const repos={
    accounts:{async get(id){return id==='org-1'?{id,name:'Kunde'}:null;}},
    activities:{
      async outreachSummary(){readCalls++;return {contacted:12,contacted_today:2,touch_count:14};},
      async listForAccount(id){readCalls++;return [{id:'log-1',account_id:id,type:'call'}];}
    }
  };
  const req={method:'GET'};
  const timeline=await handleReadRequest({
    req,url:new URL('http://local/api/accounts/org-1/activities'),repositories:repos
  });
  assert.equal(timeline.status,200);
  assert.equal(timeline.body[0].account_id,'org-1');
  const missing=await handleReadRequest({
    req,url:new URL('http://local/api/accounts/missing/activities'),repositories:repos
  });
  assert.equal(missing.status,404);
  const summary=await handleReadRequest({
    req,url:new URL('http://local/api/outreach/summary'),repositories:repos
  });
  assert.equal(summary.status,200);
  assert.equal(summary.body.contacted,12);
  assert.equal(summary.body.remaining,488);
  assert.equal(readCalls,2);
});
