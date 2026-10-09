'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const {loadConfig}=require('../src/config');
const {parseCreate,parseStage}=require('../src/api/opportunities-write');

function fixture(role='owner'){
  const calls=[];
  const repositories={opportunities:{
    async create(input,meta){
      calls.push(['create',input,meta]);
      if(input.accountId==='missing')return {missingAccount:true};
      if(input.title==='Duplikat')return {duplicate:true,existingId:'other'};
      return {opportunity:{id:meta.id,stage:'ny',...input}};
    },
    async changeStage(id,change,meta){
      calls.push(['stage',id,change,meta]);
      if(id==='missing')return {missing:true};
      if(change.expectedStage==='tapt')return {conflict:true,currentStage:'tilbud'};
      return {opportunity:{id,stage:change.stage,account_id:'book'},
        unchanged:change.stage===change.expectedStage};
    }
  }};
  const authBoundary={
    async authorizeRequest(req,{minimumRole}){
      if(!req.headers.authorization)return {ok:false,status:401,body:{success:false,error_code:'unauthorized'}};
      if(minimumRole==='editor'&&role==='reader')
        return {ok:false,status:403,body:{success:false,error_code:'forbidden'}};
      return {ok:true,user:{id:'salong-owner',role,name:'Eier'}};
    }
  };
  return {calls,app:createApp({config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories,authBoundary})};
}
async function serverFor(app,fn){
  const server=http.createServer(app);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{return await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
const post=(origin,path,obj,auth='Bearer test')=>fetch(origin+path,{
  method:'POST',headers:{'content-type':'application/json',authorization:auth},
  body:JSON.stringify(obj)
});

test('only editor+ can create an opportunity and update its stage',async()=>{
  const owner=fixture(),reader=fixture('reader');
  await serverFor(owner.app,async base=>{
    const anon=await fetch(base+'/api/opportunities',{
      method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(anon.status,401);
    const response=await post(base,'/api/opportunities',{
      accountId:'book',title:'Samtale i Wergeland',
      value:45000,eventDate:'2027-03-18',room:'Wergeland'
    });
    assert.equal(response.status,201);
    assert.equal((await response.json()).data.stage,'ny');
    assert.equal(owner.calls[0][2].actorId,'salong-owner');
    assert.match(owner.calls[0][2].auditId,/^audit_/);
    const stage=await post(base,'/api/opportunities/first/stage',{stage:'tilbud',expectedStage:'ny'});
    assert.equal(stage.status,200);
    assert.equal((await stage.json()).data.stage,'tilbud');
    assert.deepEqual(owner.calls[1][2],{stage:'tilbud',expectedStage:'ny',lostReason:null});
    assert.equal(owner.calls[1][3].actorId,'salong-owner');
  });
  await serverFor(reader.app,async base=>{
    const denied=await post(base,'/api/opportunities',{accountId:'book',title:'Ikke tilgang'});
    assert.equal(denied.status,403);
    const deniedStage=await post(base,'/api/opportunities/first/stage',
      {stage:'bekreftet',expectedStage:'ny'});
    assert.equal(deniedStage.status,403);
    assert.equal(reader.calls.length,0);
  });
});

test('invalid, duplicate, missing and stale writes produce explicit errors',async()=>{
  const f=fixture();
  await serverFor(f.app,async base=>{
    const bad=[
      {accountId:'book',title:'Normal',value:-2},
      {accountId:'book',title:'Normal',value:'42'},
      {accountId:'book',title:'Normal',eventDate:'2027-02-30'},
      {accountId:'book',title:'Normal',stage:'bekreftet'},
      {accountId:'book',title:''}
    ];
    for(const entry of bad)
      assert.equal((await post(base,'/api/opportunities',entry)).status,400);
    assert.equal(f.calls.length,0);
    assert.equal((await post(base,'/api/opportunities',{accountId:'missing',title:'Tittel'})).status,404);
    assert.equal((await post(base,'/api/opportunities',{accountId:'book',title:'Duplikat'})).status,409);
    assert.equal((await post(base,'/api/opportunities/first/stage',
      {stage:'tapt',expectedStage:'tilbud'})).status,400);
    assert.equal((await post(base,'/api/opportunities/first/stage',
      {stage:'tilbud',expectedStage:'tapt'})).status,409);
    assert.equal((await post(base,'/api/opportunities/missing/stage',
      {stage:'tilbud',expectedStage:'ny'})).status,404);
    assert.equal((await post(base,'/api/opportunities/first/stage',
      {stage:'tapt',expectedStage:'tilbud',lostReason:'Ingen dato'})).status,200);
  });
});
test('stage and values stay in database contract, without implied bookings',()=>{
  assert.equal(parseCreate({accountId:'book',title:'Tittel',value:null}).value,null);
  assert.throws(()=>parseCreate({accountId:'book',title:'Tittel',value:1.234}),/Verdi/);
  assert.throws(()=>parseStage({stage:'Tier 1',expectedStage:'ny'}),/Fasen/);
  assert.deepEqual(parseStage({stage:'tapt',expectedStage:'tilbud',lostReason:'Budsjett'}),
    {stage:'tapt',expectedStage:'tilbud',lostReason:'Budsjett'});
});
