'use strict';

const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const test=require('node:test');

const {createApp}=require('../src/app');
const {loadConfig}=require('../src/config');

async function withServer(handler,fn){
  const server=http.createServer(handler);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    const address=server.address();
    await fn('http://127.0.0.1:'+address.port);
  }finally{
    server.close();
    await once(server,'close');
  }
}

test('health stays public while /api routes require auth when boundary is enabled',async()=>{
  const config=loadConfig({NODE_ENV:'test',PORT:'3000'});
  const repositories={
    accounts:{async get(){return {id:'o-1',name:'Eksempel AS'};}}
  };
  const authBoundary={
    async authorizeRequest(req,{minimumRole}){
      const raw=req.headers.authorization||'';
      if(raw!=='Bearer reader'){
        return {
          status:401,
          body:{success:false,error_code:'unauthorized',error_message:'Innlogging mangler eller er ugyldig.'}
        };
      }
      assert.equal(minimumRole,'reader');
      return {ok:true,user:{id:'m-1',role:'reader',active:true}};
    }
  };

  await withServer(createApp({
    config,
    repositories,
    authBoundary,
    makeRequestId:()=> 'req-auth'
  }),async baseUrl=>{
    const health=await fetch(baseUrl+'/health');
    assert.equal(health.status,200);

    const denied=await fetch(baseUrl+'/api/accounts/o-1');
    const deniedBody=await denied.json();
    assert.equal(denied.status,401);
    assert.equal(deniedBody.error_code,'unauthorized');
    assert.equal(deniedBody.requestId,'req-auth');

    const allowed=await fetch(baseUrl+'/api/accounts/o-1',{
      headers:{authorization:'Bearer reader'}
    });
    const body=await allowed.json();
    assert.equal(allowed.status,200);
    assert.equal(body.id,'o-1');
  });
});

test('mutating API methods require editor or higher at the app boundary',async()=>{
  const config=loadConfig({NODE_ENV:'test',PORT:'3000'});
  const seen=[];
  const authBoundary={
    async authorizeRequest(_req,{minimumRole}){
      seen.push(minimumRole);
      return {
        status:403,
        body:{success:false,error_code:'forbidden',error_message:'Du har ikke tilgang til denne handlingen.'}
      };
    }
  };

  await withServer(createApp({
    config,
    authBoundary,
    makeRequestId:()=> 'req-role'
  }),async baseUrl=>{
    const response=await fetch(baseUrl+'/api/not-yet',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:'{}'
    });
    const body=await response.json();
    assert.equal(response.status,403);
    assert.equal(body.error_code,'forbidden');
    assert.deepEqual(seen,['editor']);
  });
});


test('production API fails closed when auth boundary is not wired',async()=>{
  const config=loadConfig({NODE_ENV:'production',PORT:'3000'});
  const repositories={
    accounts:{async get(){return {id:'o-1',name:'Skal ikke eksponeres'};}}
  };

  await withServer(createApp({
    config,
    repositories,
    makeRequestId:()=> 'req-prod-auth'
  }),async baseUrl=>{
    const health=await fetch(baseUrl+'/health');
    assert.equal(health.status,200);

    const response=await fetch(baseUrl+'/api/accounts/o-1');
    const body=await response.json();
    assert.equal(response.status,503);
    assert.equal(body.error_code,'auth_not_ready');
    assert.equal(body.requestId,'req-prod-auth');
  });
});


test('a configured real database is protected even in development mode',async()=>{
  const config=loadConfig({
    NODE_ENV:'development',PORT:'3000',
    DATABASE_URL:'postgres://example.invalid/private_db'
  });
  const repositories={
    accounts:{async get(){return {id:'o-private',name:'Private company'};}}
  };
  await withServer(createApp({config,repositories}),async baseUrl=>{
    assert.equal((await fetch(baseUrl+'/health')).status,200);
    const response=await fetch(baseUrl+'/api/accounts/o-private');
    assert.equal(response.status,503);
    assert.equal((await response.json()).error_code,'auth_not_ready');
  });
});
