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

function fakeRepositories(){
  const accounts=new Map([
    ['o-1',{id:'o-1',name:'En AS'}],
    ['o-2',{id:'o-2',name:'To AS'}]
  ]);
  const jobs=[];
  const results=new Map();
  const calls={create:[],createMany:[]};

  return {
    calls,
    results,
    repositories:{
      accounts:{
        async get(id){ return accounts.get(id)||null; }
      },
      enrichmentJobs:{
        async create(input){
          calls.create.push(input);
          const job={
            id:input.id,accountId:input.accountId,status:'queued',
            requestedBy:input.requestedBy||null,sourceStatuses:{},
            startedAt:null,completedAt:null,error:null
          };
          jobs.push(job);
          return job;
        },
        async createMany(items){
          calls.createMany.push(items);
          const made=items.map(input=>({
            id:input.id,accountId:input.accountId,status:'queued',
            requestedBy:input.requestedBy||null,sourceStatuses:{},
            startedAt:null,completedAt:null,error:null
          }));
          jobs.push(...made);
          return made;
        },
        async get(id){ return jobs.find(job=>job.id===id)||null; },
        async latestForAccount(accountId){
          return [...jobs].reverse().find(job=>job.accountId===accountId)||null;
        }
      },
      enrichmentResults:{
        async get(jobId){ return results.get(jobId)||null; }
      }
    },
    jobs
  };
}

function authBoundary(){
  return {
    async authorizeRequest(_req,{minimumRole}){
      assert.ok(minimumRole==='reader'||minimumRole==='editor');
      return {ok:true,user:{id:'m-editor',role:'editor',active:true}};
    }
  };
}

test('single enrichment request creates a persisted queued job for the authenticated member',async()=>{
  const data=fakeRepositories();
  let n=0;
  const app=createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:data.repositories,
    authBoundary:authBoundary(),
    makeRequestId:()=> 'req-enr',
  });

  // Stable job ids are injected at repository level in this test by replacing create input.
  const original=data.repositories.enrichmentJobs.create;
  data.repositories.enrichmentJobs.create=async input=>original({...input,id:'job-'+(++n)});

  await withServer(app,async baseUrl=>{
    const response=await fetch(baseUrl+'/api/enrichment/accounts/o-1',{
      method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:'{}'
    });
    const body=await response.json();

    assert.equal(response.status,202);
    assert.equal(body.success,true);
    assert.equal(body.data.jobId,'job-1');
    assert.deepEqual(body.data.jobIds,['job-1']);
    assert.equal(data.calls.create[0].accountId,'o-1');
    assert.equal(data.calls.create[0].requestedBy,'m-editor');
  });
});

test('batch enrichment deduplicates account ids and uses one repository batch call',async()=>{
  const data=fakeRepositories();
  let seq=0;
  const original=data.repositories.enrichmentJobs.createMany;
  data.repositories.enrichmentJobs.createMany=async items=>original(
    items.map(item=>({...item,id:'batch-'+(++seq)}))
  );

  await withServer(createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:data.repositories,
    authBoundary:authBoundary()
  }),async baseUrl=>{
    const response=await fetch(baseUrl+'/api/enrichment/batch',{
      method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:JSON.stringify({accountIds:['o-1','o-1','o-2']})
    });
    const body=await response.json();

    assert.equal(response.status,202);
    assert.equal(body.data.queued,2);
    assert.deepEqual(body.data.jobIds,['batch-1','batch-2']);
    assert.equal(data.calls.createMany.length,1);
    assert.deepEqual(
      data.calls.createMany[0].map(item=>item.accountId),
      ['o-1','o-2']
    );
    assert.ok(data.calls.createMany[0].every(item=>item.requestedBy==='m-editor'));
  });
});

test('batch enrichment rejects missing accounts before creating any jobs',async()=>{
  const data=fakeRepositories();

  await withServer(createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:data.repositories,
    authBoundary:authBoundary()
  }),async baseUrl=>{
    const response=await fetch(baseUrl+'/api/enrichment/batch',{
      method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:JSON.stringify({accountIds:['o-1','missing']})
    });
    const body=await response.json();

    assert.equal(response.status,404);
    assert.equal(body.error_code,'account_not_found');
    assert.deepEqual(body.details.accountIds,['missing']);
    assert.equal(data.calls.createMany.length,0);
  });
});

test('job reads expose persisted result only for terminal jobs and latest can be null',async()=>{
  const data=fakeRepositories();
  data.jobs.push({
    id:'job-done',accountId:'o-1',status:'needs_review',
    startedAt:'2026-10-08T07:00:00.000Z',
    completedAt:'2026-10-08T07:01:00.000Z',
    sourceStatuses:{web:'ok'},error:null
  });
  data.results.set('job-done',{
    jobId:'job-done',
    organization:{name:'En AS'},
    eventSignals:[],
    contactCandidates:[{name:'Kari Testesen'}],
    contactData:[],
    recommendation:null,
    createdAt:'ignored',
    updatedAt:'ignored'
  });

  await withServer(createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:data.repositories,
    authBoundary:authBoundary()
  }),async baseUrl=>{
    const response=await fetch(baseUrl+'/api/enrichment/jobs/job-done',{
      headers:{authorization:'Bearer test'}
    });
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.status,'needs_review');
    assert.equal(body.result.contactCandidates[0].name,'Kari Testesen');
    assert.equal(body.result.jobId,undefined);

    const latest=await fetch(baseUrl+'/api/enrichment/accounts/o-1/latest',{
      headers:{authorization:'Bearer test'}
    });
    assert.equal((await latest.json()).id,'job-done');

    const none=await fetch(baseUrl+'/api/enrichment/accounts/o-2/latest',{
      headers:{authorization:'Bearer test'}
    });
    assert.equal(await none.json(),null);
  });
});

test('invalid enrichment JSON and unknown account return structured errors',async()=>{
  const data=fakeRepositories();

  await withServer(createApp({
    config:loadConfig({NODE_ENV:'test',PORT:'3000'}),
    repositories:data.repositories,
    authBoundary:authBoundary()
  }),async baseUrl=>{
    const invalid=await fetch(baseUrl+'/api/enrichment/batch',{
      method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:'{'
    });
    assert.equal(invalid.status,400);
    assert.equal((await invalid.json()).error_code,'invalid_json');

    const missing=await fetch(baseUrl+'/api/enrichment/accounts/missing',{
      method:'POST',
      headers:{authorization:'Bearer test','content-type':'application/json'},
      body:'{}'
    });
    assert.equal(missing.status,404);
    assert.equal((await missing.json()).error_code,'account_not_found');
  });
});
