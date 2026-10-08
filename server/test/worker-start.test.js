'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {startWorker,defaultWorkerId,recoverStaleJobs}=require('../src/worker/start');

test('worker bootstrap closes runtime and fails when database is unavailable',async()=>{
  let closed=0;
  const runtimeFactory=async()=>({
    repositories:null,
    async close(){ closed++; }
  });

  await assert.rejects(
    ()=>startWorker({
      env:{NODE_ENV:'test',PORT:'3000'},
      runtimeFactory,
      logger:()=>{}
    }),
    error=>error.code==='database_not_configured'
  );
  assert.equal(closed,1);
});

test('worker bootstrap refuses to consume queue without any configured provider',async()=>{
  let closed=0;
  const runtimeFactory=async()=>({
    repositories:{
      enrichmentJobs:{async claimNext(){ return null; }}
    },
    async close(){ closed++; }
  });

  await assert.rejects(
    ()=>startWorker({
      env:{
        NODE_ENV:'test',
        PORT:'3000',
        DATABASE_URL:'postgres://example.invalid/salong'
      },
      runtimeFactory,
      logger:()=>{}
    }),
    error=>error.code==='providers_not_configured'
  );
  assert.equal(closed,1);
});

test('default worker id is stable enough for operational logs',()=>{
  assert.match(defaultWorkerId(),/^salong-.+-\d+$/);
});


test('worker startup recovery requeues stale locks and logs the count',async()=>{
  const events=[];
  const calls=[];
  const repositories={
    enrichmentJobs:{
      async requeueStale(seconds){
        calls.push(seconds);
        return [{id:'job-stale-1'},{id:'job-stale-2'}];
      }
    }
  };

  const recovered=await recoverStaleJobs(repositories,{
    staleSeconds:600,
    logger:event=>events.push(event)
  });

  assert.equal(recovered.length,2);
  assert.deepEqual(calls,[600]);
  assert.deepEqual(events,[{
    event:'enrichment_stale_jobs_requeued',
    count:2,
    staleSeconds:600
  }]);
});

test('worker startup recovery requires the persistent stale-lock operation',async()=>{
  await assert.rejects(
    ()=>recoverStaleJobs({enrichmentJobs:{}},{}),
    /enrichmentJobs\.requeueStale/
  );
});
