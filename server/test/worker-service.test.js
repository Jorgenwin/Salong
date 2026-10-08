'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createWorkerService,
  hasProviderPorts
}=require('../src/worker/service');

function repositories(){
  const job={
    id:'job-service',
    accountId:'o-1',
    status:'running',
    attemptCount:1
  };
  let next=job;
  const calls=[];
  return {
    calls,
    enrichmentJobs:{
      async claimNext(workerId){
        calls.push(['claimNext',workerId]);
        const value=next;
        next=null;
        return value;
      },
      async setSourceStatus(id,workerId,source,status){
        calls.push(['setSourceStatus',id,workerId,source,status]);
        return {id,status:'running',lockedBy:workerId};
      },
      async finish(id,workerId,payload){
        calls.push(['finish',id,workerId,payload]);
        return {id,status:payload.status};
      },
      async reschedule(id,workerId,payload){
        calls.push(['reschedule',id,workerId,payload]);
        return {id,status:'queued',...payload};
      }
    },
    accounts:{
      async get(id){
        return id==='o-1'
          ?{id:'o-1',name:'Worker Test',domain:'worker-test.no',segment_id:'fag'}
          :null;
      }
    },
    contacts:{
      async listByAccount(){ return []; }
    },
    enrichmentResults:{
      async upsert(jobId,result){
        calls.push(['result',jobId,result]);
        return {jobId,...result};
      }
    },
    sources:{
      async save(source){
        calls.push(['source',source.id]);
        return source;
      }
    },
    researchedFacts:{
      async save(fact){
        calls.push(['fact',fact.id]);
        return fact;
      }
    }
  };
}

test('provider detection is explicit',()=>{
  assert.equal(hasProviderPorts({}),false);
  assert.equal(hasProviderPorts({search:async()=>[]}),true);
  assert.equal(hasProviderPorts({fetch:async()=>[]}),true);
  assert.equal(hasProviderPorts({apollo:{findOrganization:async()=>({matched:false})}}),true);
  assert.equal(hasProviderPorts({llm:{complete:async()=>({text:'{}'})}}),true);
});

test('worker service refuses to claim jobs when no provider transport exists',()=>{
  assert.throws(
    ()=>createWorkerService({
      repositories:repositories(),
      ports:{},
      workerId:'worker-1'
    }),
    error=>error.code==='providers_not_configured'
  );
});

test('worker service composes persistent queue with shared research executor',async()=>{
  const repos=repositories();
  const ports={
    search:async()=>{
      const error=new Error('Search is disconnected.');
      error.code='not_connected';
      throw error;
    }
  };
  const service=createWorkerService({
    repositories:repos,
    ports,
    workerId:'worker-1'
  });

  const outcome=await service.runOnce();

  assert.equal(outcome.claimed,true);
  assert.equal(outcome.action,'failed');
  assert.ok(
    repos.calls.some(call=>call[0]==='finish'&&call[3].status==='failed'),
    'research with empty providers fails explicitly rather than succeeding empty'
  );
  assert.equal(service.health().failed,1);
});

test('worker service requires the persistent queue repository',()=>{
  assert.throws(
    ()=>createWorkerService({
      repositories:{},
      ports:{search:async()=>[]},
      workerId:'worker-1'
    }),
    /repositories\.enrichmentJobs/
  );
});
