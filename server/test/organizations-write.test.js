'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const {loadConfig}=require('../src/config');
const {parseOrgPayload}=require('../src/api/organizations-write');

async function withServer(app,fn){
  const server=http.createServer(app);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{return await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
function fakeApp(role='owner'){
  const calls=[];
  const repositories={accounts:{
    async createOrganization(body,meta){
      calls.push(['create',body,meta]);
      if(body.name==='Finnes allerede')return {duplicate:true,existing:{id:'old',name:'Finnes allerede'}};
      return {organization:{id:meta.id,...body,quality_manual_override:!!body.priority}};
    },
    async updateOrganization(id,body,meta){
      calls.push(['update',id,body,meta]);
      if(id==='missing')return {missing:true};
      if(body.name==='Finnes allerede')return {duplicate:true,existing:{id:'old',name:'Finnes allerede'}};
      return {organization:{id,...body,quality_manual_override:Object.hasOwn(body,'priority')}};
    }
  }};
  const authBoundary={
    async authorizeRequest(req,{minimumRole}){
      const header=req.headers.authorization;
      if(!header)return {ok:false,status:401,body:{success:false,error_code:'unauthorized'}};
      if(minimumRole==='editor'&&role==='reader')
        return {ok:false,status:403,body:{success:false,error_code:'forbidden'}};
      return {ok:true,user:{id:'member-owner',name:'Eier',role,active:true}};
    }
  };
  return {calls,app:createApp({config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories,authBoundary})};
}
test('create and update organization requires editor and protects readers',async()=>{
  const a=fakeApp(),read=fakeApp('reader');
  await withServer(a.app,async base=>{
    const anon=await fetch(base+'/api/organizations',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({name:'New'})});
    assert.equal(anon.status,401);
    const response=await fetch(base+'/api/organizations',{method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:JSON.stringify({name:'Ny forening',priority:'A',segment:'fag',previous_customer:false})});
    assert.equal(response.status,201);
    const body=await response.json();
    assert.equal(body.data.name,'Ny forening');
    assert.equal(a.calls[0][2].actorId,'member-owner');
    const id=body.data.id;
    const patch=await fetch(base+'/api/organizations/'+encodeURIComponent(id),{method:'PATCH',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:JSON.stringify({priority:'B'})});
    assert.equal(patch.status,200);
    assert.equal((await patch.json()).data.quality_manual_override,true);
  });
  await withServer(read.app,async base=>{
    const result=await fetch(base+'/api/organizations',{method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:JSON.stringify({name:'Nope'})});
    assert.equal(result.status,403);
    assert.equal(read.calls.length,0);
  });
});
test('invalid inputs, duplicate, unknown ids and media types are safe',async()=>{
  const a=fakeApp();
  await withServer(a.app,async base=>{
    const req=(url,body,type='application/json',method='POST')=>
      fetch(base+url,{method,headers:{authorization:'Bearer test','content-type':type},
        body:typeof body==='string'?body:JSON.stringify(body)});
    assert.equal((await req('/api/organizations',{name:'Test',priority:'1'})).status,400);
    assert.equal((await req('/api/organizations',{name:'Test',admin:true})).status,400);
    assert.equal((await req('/api/organizations',{name:'Test',org_number:'123'})).status,400);
    assert.equal((await req('/api/organizations',{name:'Test'},'text/plain')).status,415);
    assert.equal((await req('/api/organizations','{bad')).status,400);
    const duplicate=await req('/api/organizations',{name:'Finnes allerede'});
    assert.equal(duplicate.status,409);
    assert.equal((await duplicate.json()).error_code,'duplicate_organization');
    assert.equal((await req('/api/organizations/missing',{priority:'B'},undefined,'PATCH')).status,404);
  });
});
test('manual priority is strictly A/B/C quality, never Tier 1/2/3',()=>{
  assert.equal(parseOrgPayload({priority:'A'}).priority,'A');
  assert.equal(parseOrgPayload({priority:null}).priority,null);
  assert.throws(()=>parseOrgPayload({priority:'2'}),/Prioritet/);
  assert.throws(()=>parseOrgPayload({website:'javascript:alert(1)'}),/http/);
  assert.throws(()=>parseOrgPayload({website:'https://user:pass@example.no/'}),/innlogging/);
});
