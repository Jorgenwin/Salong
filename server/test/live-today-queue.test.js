'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const http=require('node:http');
const {once}=require('node:events');
const {createTodayQueueRepository,isoDate}=require('../src/db/today-queue');
const {createApp}=require('../src/app');
const {loadConfig}=require('../src/config');

test('live I dag queue paginates and returns one next action per account',async()=>{
  let sql='',params=null;
  const db={async query(query,args){
    sql=query;params=args;
    return {rows:[
      {kind:'task',action_id:'t1',account_id:'org-1',account_name:'Forlag AS',
        segment:'forlag',priority:'A',action_text:'Ring tilbake',
        due_at:'2026-10-08T12:00:00.000Z',sort_group:0,total:2},
      {kind:'first_contact',action_id:'first:org-2',account_id:'org-2',
        account_name:'Ny virksomhet',segment:'forskning',
        priority:'B',action_text:'Første kontakt',sort_group:4,total:2}
    ]};
  }};
  const result=await createTodayQueueRepository(db).list({
    today:'2026-10-09',limit:40,offset:0
  });
  assert.equal(result.total,2);
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].kind,'task');
  assert.equal(result.items[1].priority,'B');
  assert.equal(result.items[0].due_at,'2026-10-08T12:00:00.000Z');
  assert.deepEqual(params,[40,0,'2026-10-09']);
  assert.match(sql,/SELECT DISTINCT ON \(account_id\)/);
  assert.match(sql,/NOT EXISTS/);
  assert.match(sql,/a\.direction='out'/);
  assert.match(sql,/a\.type='task' AND a\.done=false/);
  assert.match(sql,/LIMIT \$1 OFFSET \$2/);
  assert.equal(result.today,'2026-10-09');
});
test('live queue rejects false dates and clamps input pagination',async()=>{
  assert.equal(isoDate('2026-02-30'),false);
  assert.equal(isoDate('2027-02-28'),true);
  let values;
  const r=createTodayQueueRepository({async query(_sql,params){
    values=params;return {rows:[]};
  }});
  await assert.rejects(()=>r.list({today:'not-a-date'}),/valid Oslo date/);
  await r.list({today:'2026-10-09',limit:4000,offset:-1});
  assert.deepEqual(values,[100,0,'2026-10-09']);
});
async function withServer(app,fn){
  const server=http.createServer(app);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{return await fn('http://127.0.0.1:'+server.address().port);}
  finally{server.close();await once(server,'close');}
}
test('live I dag route requires a member and rejects unbounded paging',async()=>{
  const calls=[];
  const repositories={today:{async list(value){
    calls.push(value);return {items:[],total:0,limit:value.limit,offset:value.offset};
  }}};
  const authBoundary={async authorizeRequest(req){
    return req.headers.authorization==='Bearer allowed'?
      {ok:true,user:{id:'owner',role:'owner'}}:
      {ok:false,status:401,body:{success:false,error_code:'unauthorized'}};
  }};
  const app=createApp({config:loadConfig({NODE_ENV:'test'}),repositories,authBoundary});
  await withServer(app,async base=>{
    const anon=await fetch(base+'/api/today/queue');
    assert.equal(anon.status,401);assert.equal(calls.length,0);
    const headers={authorization:'Bearer allowed'};
    const invalid=await fetch(base+'/api/today/queue?limit=101',{headers});
    assert.equal(invalid.status,400);assert.equal(calls.length,0);
    const allowed=await fetch(base+'/api/today/queue?limit=25&offset=5',{headers});
    assert.equal(allowed.status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].limit,25);assert.equal(calls[0].offset,5);
    assert.match(calls[0].today,/^\d{4}-\d{2}-\d{2}$/);
  });
});
