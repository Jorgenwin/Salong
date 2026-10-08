'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createEnrichmentWorker,
  retryDelaySeconds
}=require('../src/worker/runner');

function makeJobs(job){
  const calls=[];
  return {
    calls,
    repo:{
      async claimNext(workerId){
        calls.push(['claimNext',workerId]);
        const value=job;
        job=null;
        return value;
      },
      async setSourceStatus(id,workerId,source,status){
        calls.push(['setSourceStatus',id,workerId,source,status]);
        return {id,status:'running',lockedBy:workerId};
      },
      async finish(id,workerId,payload){
        calls.push(['finish',id,workerId,payload]);
        return {id,status:payload.status,errorCode:payload.errorCode||null,errorMessage:payload.errorMessage||null};
      },
      async reschedule(id,workerId,payload){
        calls.push(['reschedule',id,workerId,payload]);
        return {id,status:'queued',errorCode:payload.errorCode,errorMessage:payload.errorMessage};
      }
    }
  };
}

test('runOnce is idle when no job is available',async()=>{
  const jobs=makeJobs(null);
  let executions=0;
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    workerId:'worker-a',
    execute:async()=>{ executions++; }
  });

  const result=await worker.runOnce();

  assert.deepEqual(result,{claimed:false});
  assert.equal(executions,0);
  assert.equal(worker.health().running,false);
});

test('successful execution records source state and finishes explicitly',async()=>{
  const jobs=makeJobs({
    id:'job-1',
    accountId:'o-1',
    status:'running',
    attemptCount:1
  });
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    workerId:'worker-a',
    execute:async(job,context)=>{
      assert.equal(job.accountId,'o-1');
      await context.setSourceStatus('web','ok');
      return {status:'needs_review'};
    }
  });

  const result=await worker.runOnce();

  assert.equal(result.action,'finished');
  assert.equal(result.job.status,'needs_review');
  assert.deepEqual(jobs.calls,[
    ['claimNext','worker-a'],
    ['setSourceStatus','job-1','worker-a','web','ok'],
    ['finish','job-1','worker-a',{status:'needs_review',errorCode:null,errorMessage:null}]
  ]);
  assert.equal(worker.health().completed,1);
  assert.equal(worker.health().failed,0);
});

test('retryable provider errors are rescheduled with bounded backoff',async()=>{
  const jobs=makeJobs({
    id:'job-2',
    accountId:'o-2',
    status:'running',
    attemptCount:2
  });
  const error=Object.assign(new Error('Provider rate limited.'),{
    code:'rate_limited',
    retryable:true
  });
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    workerId:'worker-a',
    maxAttempts:4,
    retryDelays:[10,30,90],
    execute:async()=>{ throw error; }
  });

  const result=await worker.runOnce();

  assert.equal(result.action,'rescheduled');
  assert.equal(result.delaySeconds,30);
  assert.deepEqual(jobs.calls[1],[
    'reschedule','job-2','worker-a',{
      delaySeconds:30,
      errorCode:'rate_limited',
      errorMessage:'Provider rate limited.'
    }
  ]);
  assert.equal(worker.health().rescheduled,1);
});

test('retryable errors stop retrying at maxAttempts and become failed',async()=>{
  const jobs=makeJobs({
    id:'job-3',
    accountId:'o-3',
    status:'running',
    attemptCount:3
  });
  const error=Object.assign(new Error('Temporary outage.'),{
    code:'provider_unavailable',
    retryable:true
  });
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    workerId:'worker-a',
    maxAttempts:3,
    execute:async()=>{ throw error; }
  });

  const result=await worker.runOnce();

  assert.equal(result.action,'failed');
  assert.deepEqual(jobs.calls[1],[
    'finish','job-3','worker-a',{
      status:'failed',
      errorCode:'provider_unavailable',
      errorMessage:'Temporary outage.'
    }
  ]);
  assert.equal(worker.health().failed,1);
});

test('invalid executor statuses fail closed instead of inventing success',async()=>{
  const jobs=makeJobs({
    id:'job-4',
    accountId:'o-4',
    status:'running',
    attemptCount:1
  });
  const worker=createEnrichmentWorker({
    jobs:jobs.repo,
    workerId:'worker-a',
    execute:async()=>({status:'done-ish'})
  });

  const result=await worker.runOnce();

  assert.equal(result.action,'failed');
  assert.equal(result.job.status,'failed');
  assert.equal(result.error.code,'invalid_executor_status');
});

test('worker configuration and retry delays are validated',()=>{
  assert.throws(
    ()=>createEnrichmentWorker({jobs:{claimNext:async()=>null},execute:async()=>{},workerId:''}),
    /workerId is required/
  );
  assert.equal(retryDelaySeconds(1,[5,10]),5);
  assert.equal(retryDelaySeconds(9,[5,10]),10);
});


test('running job lock is heartbeated until execution finishes',async()=>{
  const calls=[];
  let timerFn=null;
  let cleared=null;
  let release;
  const gate=new Promise(resolve=>{ release=resolve; });
  let next={
    id:'job-heartbeat',
    accountId:'o-1',
    status:'running',
    attemptCount:1
  };
  const jobs={
    async claimNext(workerId){
      calls.push(['claimNext',workerId]);
      const job=next;
      next=null;
      return job;
    },
    async touch(id,workerId){
      calls.push(['touch',id,workerId]);
      return {id,status:'running',lockedBy:workerId};
    },
    async finish(id,workerId,payload){
      calls.push(['finish',id,workerId,payload]);
      return {id,status:payload.status};
    },
    async setSourceStatus(){ return {}; },
    async reschedule(){ return {}; }
  };

  const worker=createEnrichmentWorker({
    jobs,
    workerId:'worker-heartbeat',
    lockHeartbeatMs:5000,
    setIntervalFn(fn,ms){
      assert.equal(ms,5000);
      timerFn=fn;
      return 77;
    },
    clearIntervalFn(id){ cleared=id; },
    execute:async()=>{
      await gate;
      return {status:'needs_review'};
    }
  });

  const running=worker.runOnce();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof timerFn,'function');

  timerFn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(calls.some(call=>call[0]==='touch'&&call[1]==='job-heartbeat'&&call[2]==='worker-heartbeat'));

  release();
  const result=await running;

  assert.equal(result.action,'finished');
  assert.equal(cleared,77);
});
