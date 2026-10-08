'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {createEnrichmentWorker}=require('../src/worker/runner');
const {
  createResearchExecutor,
  normalizeSourceStatus,
  researchFailure
}=require('../src/worker/research-executor');
const {RYDDIG,NOW,searchPort,fetchPort}=require('./research-fixtures');

function persistence(){
  const saved={results:[],sources:[],facts:[]};
  return {
    saved,
    repositories:{
      accounts:{
        async get(id){
          return id===RYDDIG.account.id?RYDDIG.account:null;
        }
      },
      contacts:{
        async listByAccount(){ return []; }
      },
      enrichmentResults:{
        async upsert(jobId,result){ saved.results.push({jobId,result}); return {jobId,...result}; }
      },
      sources:{
        async save(source){ saved.sources.push(source); return source; }
      },
      researchedFacts:{
        async save(fact){ saved.facts.push(fact); return fact; }
      }
    }
  };
}

function jobQueue(job){
  const calls=[];
  let next=job;
  return {
    calls,
    repo:{
      async claimNext(workerId){
        calls.push(['claimNext',workerId]);
        const current=next;
        next=null;
        return current;
      },
      async setSourceStatus(id,workerId,source,status){
        calls.push(['setSourceStatus',id,workerId,source,status]);
        return {id,status:'running',lockedBy:workerId};
      },
      async finish(id,workerId,payload){
        calls.push(['finish',id,workerId,payload]);
        return {id,status:payload.status,errorCode:payload.errorCode||null};
      },
      async reschedule(id,workerId,payload){
        calls.push(['reschedule',id,workerId,payload]);
        return {id,status:'queued',...payload};
      }
    }
  };
}

test('worker -> runResearch -> provenance persistence -> needs_review',async()=>{
  const data=persistence();
  const jobs=jobQueue({
    id:'job-r1',
    accountId:RYDDIG.account.id,
    status:'running',
    attemptCount:1
  });
  const execute=createResearchExecutor({
    repositories:data.repositories,
    ports:{search:searchPort(RYDDIG),fetch:fetchPort(RYDDIG)},
    now:NOW
  });
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    execute,
    workerId:'worker-r1'
  });

  const outcome=await worker.runOnce();

  assert.equal(outcome.action,'finished');
  assert.equal(outcome.job.status,'needs_review');
  assert.equal(data.saved.results.length,1);
  assert.equal(data.saved.results[0].jobId,'job-r1');
  assert.ok(data.saved.sources.length>=2,'web sources are persisted before facts');
  assert.ok(data.saved.facts.some(f=>f.fieldKey==='contact_candidate'));
  assert.ok(data.saved.facts.some(f=>f.fieldKey==='event_signal'));
  assert.ok(data.saved.facts.every(f=>f.reviewState==='unreviewed'));
  assert.ok(jobs.calls.some(c=>c[0]==='setSourceStatus'&&c[3]==='web'&&c[4]==='ok'));
  assert.ok(jobs.calls.some(c=>c[0]==='finish'&&c[3].status==='needs_review'));
});

test('existing human-selected primary contact lets no-candidate research complete',async()=>{
  const data=persistence();
  data.repositories.contacts.listByAccount=async()=>[
    {id:'c-1',is_primary:true,active:true}
  ];
  const fx={
    account:{id:'o-empty',name:'Empty Test',domain:'empty-test.no',segment_id:'fag'},
    pages:{'https://empty-test.no/om-oss':{title:'Om oss',text:'Vi arrangerer faglige møteplasser.'}}
  };
  data.repositories.accounts.get=async()=>fx.account;
  const execute=createResearchExecutor({
    repositories:data.repositories,
    ports:{search:searchPort(fx)},
    now:NOW
  });

  const result=await execute(
    {id:'job-empty',accountId:'o-empty',attemptCount:1},
    {async setSourceStatus(){}}
  );

  assert.equal(result.status,'completed');
  assert.equal(data.saved.results.length,1);
});

test('failed disconnected research is explicit and not retryable',async()=>{
  const data=persistence();
  const execute=createResearchExecutor({
    repositories:data.repositories,
    ports:{},
    now:NOW
  });

  await assert.rejects(
    execute(
      {id:'job-offline',accountId:RYDDIG.account.id,attemptCount:1},
      {async setSourceStatus(){}}
    ),
    error=>{
      assert.equal(error.code,'not_connected');
      assert.equal(error.retryable,false);
      return true;
    }
  );
  assert.equal(data.saved.results.length,0);
});

test('transient research failure is marked retryable for the worker',()=>{
  const error=researchFailure({
    errorCode:'provider_unavailable',
    errorMessage:'Search provider unavailable.',
    errors:[]
  });
  assert.equal(error.code,'provider_unavailable');
  assert.equal(error.retryable,true);
});

test('LLM skipped state maps to an allowed persisted source status',()=>{
  assert.equal(normalizeSourceStatus('skipped'),'empty');
  assert.equal(normalizeSourceStatus('ok'),'ok');
});

test('repository persistence failure is retryable and safe to replay',async()=>{
  const data=persistence();
  data.repositories.enrichmentResults.upsert=async()=>{ throw new Error('database temporarily unavailable'); };
  const execute=createResearchExecutor({
    repositories:data.repositories,
    ports:{search:searchPort(RYDDIG),fetch:fetchPort(RYDDIG)},
    now:NOW
  });

  await assert.rejects(
    execute(
      {id:'job-db',accountId:RYDDIG.account.id,attemptCount:1},
      {async setSourceStatus(){}}
    ),
    error=>{
      assert.equal(error.retryable,true);
      return true;
    }
  );
  assert.ok(data.saved.sources.length>0,'safe idempotent sources may have been written before retry');
});
