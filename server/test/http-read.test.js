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
    const {port}=server.address();
    await fn(`http://127.0.0.1:${port}`);
  }finally{
    server.close();
    await once(server,'close');
  }
}

function fakeRepositories(){
  const calls=[];
  return {
    calls,
    value:{
      accounts:{
        async get(id){
          calls.push(['accounts.get',id]);
          return id==='o-1'?{id:'o-1',name:'Eksempel AS'}:null;
        },
        async listProspects(filter){
          calls.push(['accounts.listProspects',filter]);
          return [{id:'o-1',name:'Eksempel AS'}];
        }
      },
      contacts:{
        async listByAccount(id){
          calls.push(['contacts.listByAccount',id]);
          return [{id:'p-1',account_id:id,name:'Pia Testesen'}];
        }
      },
      opportunities:{
        async list(accountId){
          calls.push(['opportunities.list',accountId]);
          return [{id:'d-1',account_id:accountId||'o-1',title:'Fagdag'}];
        }
      },
      calendar:{
        async list(filter){
          calls.push(['calendar.list',filter]);
          return [{date:filter.from,time:'09:00',kind:'event',title:'Fagdag',org:'Eksempel AS',room:'solstad',owner:null,status:'Bekreftet',open:'deal:d-1'}];
        }
      }
    }
  };
}

test('GET /api/accounts/:id returns the domain object',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value,
    makeRequestId:()=> 'req-account'
  });

  await withServer(app,async base=>{
    const response=await fetch(base+'/api/accounts/o-1');
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{id:'o-1',name:'Eksempel AS'});
  });
  assert.deepEqual(repos.calls,[['accounts.get','o-1']]);
});

test('missing account returns explicit 404 instead of an empty success',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value,
    makeRequestId:()=> 'req-missing'
  });

  await withServer(app,async base=>{
    const response=await fetch(base+'/api/accounts/missing');
    const body=await response.json();
    assert.equal(response.status,404);
    assert.equal(body.success,false);
    assert.equal(body.error_code,'account_not_found');
    assert.equal(body.requestId,'req-missing');
  });
});

test('prospect filters are passed as values to the repository boundary',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value,
    makeRequestId:()=> 'req-prospects'
  });

  await withServer(app,async base=>{
    const response=await fetch(base+'/api/prospects?segment_id=Forlag&status=qualified&batch_id=b-1');
    assert.equal(response.status,200);
    assert.equal((await response.json()).length,1);
  });

  assert.deepEqual(repos.calls,[[
    'accounts.listProspects',
    {segment_id:'Forlag',status:'qualified',batch_id:'b-1'}
  ]]);
});

test('contacts and opportunities use the injected repositories',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value,
    makeRequestId:()=> 'req-lists'
  });

  await withServer(app,async base=>{
    const contacts=await fetch(base+'/api/accounts/o-1/contacts');
    const opportunities=await fetch(base+'/api/opportunities?account_id=o-1');
    assert.equal((await contacts.json())[0].account_id,'o-1');
    assert.equal((await opportunities.json())[0].account_id,'o-1');
  });

  assert.deepEqual(repos.calls,[
    ['contacts.listByAccount','o-1'],
    ['opportunities.list','o-1']
  ]);
});

test('repository errors become non-leaky 500 responses',async()=>{
  const repositories={
    accounts:{
      async get(){ throw new Error('database password should never leak'); },
      async listProspects(){ return []; }
    },
    contacts:{async listByAccount(){return [];}},
    opportunities:{async list(){return [];}}
  };
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories,
    makeRequestId:()=> 'req-error'
  });

  await withServer(app,async base=>{
    const response=await fetch(base+'/api/accounts/o-1');
    const body=await response.json();
    assert.equal(response.status,500);
    assert.equal(body.error_code,'internal_error');
    assert.equal(JSON.stringify(body).includes('password'),false);
    assert.equal(body.requestId,'req-error');
  });
});

test('calendar requires a valid date range and delegates to the repository',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value,
    makeRequestId:()=> 'req-calendar'
  });

  await withServer(app,async base=>{
    const bad=await fetch(base+'/api/calendar?from=2027-04-10&to=2027-04-01');
    const badBody=await bad.json();
    assert.equal(bad.status,400);
    assert.equal(badBody.error_code,'invalid_date_range');

    for(const invalid of ['2027-02-30','2027-99-99']){
      const invalidResponse=await fetch(base+'/api/calendar?from='+invalid);
      const invalidBody=await invalidResponse.json();
      assert.equal(invalidResponse.status,400);
      assert.equal(invalidBody.error_code,'invalid_date_range');
    }

    const response=await fetch(base+'/api/calendar?from=2027-04-01&to=2027-04-30');
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body[0].kind,'event');
    assert.equal(body[0].date,'2027-04-01');
  });

  assert.deepEqual(repos.calls,[[
    'calendar.list',
    {from:'2027-04-01',to:'2027-04-30'}
  ]]);
});

test('calendar uses from as to when one day is requested',async()=>{
  const repos=fakeRepositories();
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:repos.value
  });

  await withServer(app,async base=>{
    const response=await fetch(base+'/api/calendar?from=2027-04-08');
    assert.equal(response.status,200);
    await response.json();
  });

  assert.deepEqual(repos.calls,[[
    'calendar.list',
    {from:'2027-04-08',to:'2027-04-08'}
  ]]);
});
