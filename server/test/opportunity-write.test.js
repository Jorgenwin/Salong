'use strict';

const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const test=require('node:test');

const {handleOpportunityWriteRequest}=require('../src/api/opportunities-write');

function req(body){
  const stream=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  stream.method='POST';
  stream.headers={};
  return stream;
}

function repos(){
  const calls=[];
  let row={id:'d-1',account_id:'o-1',title:'Fagdag',stage:'dialog',lost_reason:null};
  return {
    calls,
    repository:{
      opportunities:{
        async get(id){ return id==='d-1'?{...row}:null; },
        async setStage(id,input){
          calls.push(['setStage',id,input]);
          if(input.expectedStage&&input.expectedStage!==row.stage) return null;
          row={
            ...row,
            stage:input.stage,
            lost_reason:input.stage==='tapt'?input.lostReason:null
          };
          return {...row};
        }
      }
    }
  };
}

test('stage update is explicit and supports optimistic expectedStage',async()=>{
  const {repository,calls}=repos();
  const result=await handleOpportunityWriteRequest({
    req:req({stage:'tilbud',expectedStage:'dialog'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });

  assert.equal(result.status,200);
  assert.equal(result.body.data.stage,'tilbud');
  assert.deepEqual(calls,[['setStage','d-1',{
    stage:'tilbud',
    expectedStage:'dialog',
    lostReason:null
  }]]);
});

test('stale expectedStage returns conflict rather than overwriting',async()=>{
  const {repository}=repos();
  const result=await handleOpportunityWriteRequest({
    req:req({stage:'tilbud',expectedStage:'ny'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });

  assert.equal(result.status,409);
  assert.equal(result.body.error_code,'stale_stage');
});

test('lost reason is stored only for lost stage and other stages clear it',async()=>{
  const {repository}=repos();

  const lost=await handleOpportunityWriteRequest({
    req:req({stage:'tapt',expectedStage:'dialog',lostReason:'Valgte annet lokale'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });
  assert.equal(lost.status,200);
  assert.equal(lost.body.data.lost_reason,'Valgte annet lokale');

  const reopened=await handleOpportunityWriteRequest({
    req:req({stage:'dialog',expectedStage:'tapt'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });
  assert.equal(reopened.status,200);
  assert.equal(reopened.body.data.lost_reason,null);
});

test('invalid stage and missing opportunity return structured errors',async()=>{
  const {repository}=repos();

  const bad=await handleOpportunityWriteRequest({
    req:req({stage:'ferdig'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });
  assert.equal(bad.status,400);
  assert.equal(bad.body.error_code,'invalid_stage');

  const missing=await handleOpportunityWriteRequest({
    req:req({stage:'dialog'}),
    url:new URL('http://x/api/opportunities/missing/stage'),
    repositories:repository
  });
  assert.equal(missing.status,404);
  assert.equal(missing.body.error_code,'opportunity_not_found');
});

test('same stage is idempotent and avoids unnecessary write',async()=>{
  const {repository,calls}=repos();
  const result=await handleOpportunityWriteRequest({
    req:req({stage:'dialog',expectedStage:'dialog'}),
    url:new URL('http://x/api/opportunities/d-1/stage'),
    repositories:repository
  });

  assert.equal(result.status,200);
  assert.equal(result.body.data.stage,'dialog');
  assert.deepEqual(calls,[]);
});
