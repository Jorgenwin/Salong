'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {runSmoke}=require('../scripts/smoke');

function response(status,body){
  return {
    ok:status>=200&&status<300,
    status,
    async json(){ return body; }
  };
}

test('smoke health-only mode makes no provider/enrichment call',async()=>{
  const calls=[];
  const result=await runSmoke({
    baseUrl:'https://salong.test',
    fetchFn:async(url,init)=>{
      calls.push({url,init});
      return response(200,{status:'ok',service:'salong-api'});
    }
  });

  assert.deepEqual(result,{health:true,enrichment:null});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://salong.test/health');
});

test('smoke queues one job only when account and token are explicit',async()=>{
  const calls=[];
  const replies=[
    response(200,{status:'ok',service:'salong-api'}),
    response(202,{success:true,data:{jobId:'job-1'}}),
    response(200,{id:'job-1',status:'running',sourceStatuses:{}}),
    response(200,{id:'job-1',status:'needs_review',sourceStatuses:{web:'ok'},result:{contactCandidates:[]}})
  ];

  const result=await runSmoke({
    baseUrl:'https://salong.test/',
    token:'secret-token',
    accountId:'o 1',
    pollMs:10,
    maxPolls:3,
    fetchFn:async(url,init)=>{
      calls.push({url,init});
      return replies.shift();
    }
  });

  assert.equal(result.enrichment.jobId,'job-1');
  assert.equal(result.enrichment.status,'needs_review');
  assert.equal(result.enrichment.hasResult,true);
  assert.equal(calls[1].url,'https://salong.test/api/enrichment/accounts/o%201');
  assert.equal(calls[1].init.method,'POST');
  assert.equal(calls[1].init.headers.authorization,'Bearer secret-token');
});

test('smoke refuses enrichment without token',async()=>{
  await assert.rejects(
    ()=>runSmoke({
      accountId:'o-1',
      fetchFn:async()=>response(200,{status:'ok'})
    }),
    error=>error.code==='token_required'
  );
});

test('smoke fails if terminal job is failed',async()=>{
  const replies=[
    response(200,{status:'ok'}),
    response(202,{success:true,data:{jobId:'job-2'}}),
    response(200,{id:'job-2',status:'failed'})
  ];

  await assert.rejects(
    ()=>runSmoke({
      token:'t',
      accountId:'o-1',
      fetchFn:async()=>replies.shift()
    }),
    error=>error.code==='enrichment_failed'
  );
});
