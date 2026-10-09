'use strict';

const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const test=require('node:test');
const {validateCreate,validateStage,handleOpportunityWrite}=require('../src/api/opportunities-write');

function request(body,auth=true){
  const req=Readable.from([typeof body==='string'?body:JSON.stringify(body)]);
  req.method='POST';req.headers={'content-type':'application/json'};
  if(auth)req.salongUser={id:'member-owner',role:'owner'};
  return req;
}
function repos(){
  const calls=[],state={id:'opp-1',stage:'ny',account_id:'org-1'};
  return {calls,repositories:{opportunities:{
    async create(input,meta){
      calls.push(['create',input,meta]);
      if(input.accountId==='missing')return {accountMissing:true};
      return {opportunity:{id:meta.id,account_id:input.accountId,
        title:input.title,stage:'ny',value:input.value}};
    },
    async changeStage(id,input){
      calls.push(['changeStage',id,input]);
      if(id==='missing')return {missing:true};
      if(input.expectedStage!==state.stage)return {stale:true};
      if(state.stage===input.stage)return {unchanged:true,opportunity:{...state}};
      state.stage=input.stage;
      return {opportunity:{...state,lost_reason:input.lostReason}};
    }
  }}};
}
test('create validates real opportunity inputs and prevents invented value',()=>{
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',value:1250.25}).value,1250.25);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar'}).value,null);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',value:-2}),null);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',value:1.234}),null);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',value:'1250'}),null);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',eventDate:'2027-02-30'}),null);
  assert.equal(validateCreate({accountId:'o-1',title:'Seminar',admin:true}),null);
  assert.equal(validateCreate({accountId:'o-1'}),null);
});
test('stage changes require expected stage and explicit reason when lost',()=>{
  assert.equal(validateStage({stage:'dialog',expectedStage:'ny'}).stage,'dialog');
  assert.equal(validateStage({stage:'dialog'}),null);
  assert.equal(validateStage({stage:'tapt',expectedStage:'ny'}),null);
  assert.equal(validateStage({stage:'tapt',expectedStage:'ny',lostReason:'Avlyst'}).lostReason,'Avlyst');
  assert.equal(validateStage({stage:'dialog',expectedStage:'ny',lostReason:'Avlyst'}),null);
  assert.equal(validateStage({stage:'feil',expectedStage:'ny'}),null);
});
test('unauthenticated cannot create or move pipeline stages',async()=>{
  const a=repos();
  const response=await handleOpportunityWrite({
    req:request({accountId:'org-1',title:'Seminar'},false),
    url:new URL('http://localhost/api/opportunities'),
    repositories:a.repositories
  });
  assert.equal(response.status,401);
  assert.equal(a.calls.length,0);
});
test('create and optimistic stage updates use member identity',async()=>{
  const a=repos();
  const created=await handleOpportunityWrite({
    req:request({accountId:'org-1',title:'Seminar',value:120000}),
    url:new URL('http://localhost/api/opportunities'),
    repositories:a.repositories,makeId:()=> 'opp-new',makeAuditId:()=> 'audit-create'
  });
  assert.equal(created.status,201);
  assert.equal(created.body.data.stage,'ny');
  assert.equal(a.calls[0][2].actorId,'member-owner');
  assert.equal(a.calls[0][2].auditId,'audit-create');
  const update=await handleOpportunityWrite({
    req:request({stage:'dialog',expectedStage:'ny'}),
    url:new URL('http://localhost/api/opportunities/opp-1/stage'),
    repositories:a.repositories,makeAuditId:()=> 'audit-stage'
  });
  assert.equal(update.status,200);
  assert.equal(a.calls[1][2].actorId,'member-owner');
  const stale=await handleOpportunityWrite({
    req:request({stage:'tilbud',expectedStage:'ny'}),
    url:new URL('http://localhost/api/opportunities/opp-1/stage'),
    repositories:a.repositories
  });
  assert.equal(stale.status,409);
  assert.equal(stale.body.error_code,'stale_stage');
  const missing=await handleOpportunityWrite({
    req:request({stage:'dialog',expectedStage:'ny'}),
    url:new URL('http://localhost/api/opportunities/missing/stage'),
    repositories:a.repositories
  });
  assert.equal(missing.status,404);
});
test('invalid media, missing organization, JSON and unsupported keys fail closed',async()=>{
  const a=repos();
  async function call(body,path='/api/opportunities'){
    return handleOpportunityWrite({req:request(body),url:new URL('http://localhost'+path),
      repositories:a.repositories});
  }
  assert.equal((await call({accountId:'missing',title:'Seminar'})).status,404);
  assert.equal((await call({accountId:'org-1',title:'Seminar',secret:'x'})).status,400);
  assert.equal((await call('{notjson')).status,400);
  const req=request({accountId:'org-1',title:'Seminar'});
  req.headers['content-type']='text/plain';
  const media=await handleOpportunityWrite({req,url:new URL('http://localhost/api/opportunities'),
    repositories:a.repositories});
  assert.equal(media.status,415);
});
