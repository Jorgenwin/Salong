'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {createResearchWorkerRuntime}=require('../src/worker/process');

function repositories(){
  const jobCalls=[];
  return {
    jobCalls,
    accounts:{async get(){return {id:'o-1',name:'Runtime Test',domain:'runtime.test',segment_id:'fag'};}},
    contacts:{async listByAccount(){return [];}},
    enrichmentResults:{async upsert(){return {};}},
    sources:{async save(){return {};}},
    researchedFacts:{async save(){return {};}},
    enrichmentJobs:{
      async claimNext(workerId){
        jobCalls.push(['claimNext',workerId]);
        return null;
      },
      async setSourceStatus(){return {};},
      async finish(){return {};},
      async reschedule(){return {};}
    }
  };
}

test('runtime exposes a stable worker id and starts/stops one loop',async()=>{
  const repos=repositories();
  let releases=[];
  const runtime=createResearchWorkerRuntime({
    repositories:repos,
    workerId:'worker-runtime',
    pollMs:1,
    sleep:()=>new Promise(resolve=>{ releases.push(resolve); })
  });

  assert.equal(runtime.workerId,'worker-runtime');
  assert.equal(runtime.health().loopActive,false);

  const first=runtime.start();
  const second=runtime.start();
  assert.equal(first,second,'start is idempotent while loop is active');

  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runtime.health().loopActive,true);
  assert.ok(repos.jobCalls.length>=1);

  await runtime.stop();
  while(releases.length) releases.shift()();
  await first;
  assert.equal(runtime.health().loopActive,false);
});

test('runOnce uses the same research executor boundary as the long-running loop',async()=>{
  const repos=repositories();
  const runtime=createResearchWorkerRuntime({
    repositories:repos,
    workerId:'worker-once'
  });

  const result=await runtime.runOnce();
  assert.deepEqual(result,{claimed:false});
  assert.deepEqual(repos.jobCalls,[['claimNext','worker-once']]);
});

test('runtime requires repositories',()=>{
  assert.throws(
    ()=>createResearchWorkerRuntime({workerId:'x'}),
    /requires repositories/
  );
});
