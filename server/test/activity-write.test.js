'use strict';

const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const test=require('node:test');

const {handleActivityWriteRequest}=require('../src/api/activities-write');

function req(method,body,user={id:'m-actor',role:'editor'}){
  const stream=body===undefined?Readable.from([]):Readable.from([JSON.stringify(body)]);
  stream.method=method;
  stream.headers={};
  stream.salongUser=user;
  return stream;
}

function repos(){
  const calls=[];
  const activities=new Map();
  const repository={
    accounts:{
      async get(id){ return id==='o-1'?{id,name:'Test AS'}:null; }
    },
    contacts:{
      async get(id){
        return id==='c-1'?{id,account_id:'o-1',name:'Kari'}:
          id==='c-other'?{id,account_id:'o-2',name:'Annen'}:null;
      }
    },
    opportunities:{
      async get(id){
        return id==='d-1'?{id,account_id:'o-1',title:'Fagdag'}:
          id==='d-other'?{id,account_id:'o-2',title:'Annen'}:null;
      }
    },
    members:{
      async get(id){ return id==='m-owner'?{id,active:true,role:'editor'}:null; }
    },
    activities:{
      async get(id){ return activities.get(id)||null; },
      async create(input){
        calls.push(['create',input]);
        const row={
          id:input.id,
          account_id:input.accountId,
          case_id:input.caseId,
          contact_id:input.contactId,
          type:input.type,
          text:input.text,
          due_at:input.dueAt,
          completed:input.completed,
          actor_id:input.actorId,
          owner_id:input.ownerId
        };
        activities.set(row.id,row);
        return row;
      },
      async complete(id){
        calls.push(['complete',id]);
        const row={...activities.get(id),completed:true};
        activities.set(id,row);
        return row;
      }
    }
  };
  return {repository,calls,activities};
}

test('POST activity creates a task with authenticated actor and defaults task to open',async()=>{
  const {repository,calls}=repos();
  const result=await handleActivityWriteRequest({
    req:req('POST',{
      accountId:'o-1',
      contactId:'c-1',
      type:'task',
      text:'Følg opp tilbud',
      dueAt:'2026-10-12T09:00:00+02:00',
      ownerId:'m-owner'
    }),
    url:new URL('http://x/api/activities'),
    repositories:repository,
    makeActivityId:()=> 'a-1'
  });

  assert.equal(result.status,201);
  assert.equal(result.body.success,true);
  assert.equal(result.body.data.id,'a-1');
  assert.equal(calls[0][0],'create');
  assert.equal(calls[0][1].accountId,'o-1');
  assert.equal(calls[0][1].actorId,'m-actor');
  assert.equal(calls[0][1].ownerId,'m-owner');
  assert.equal(calls[0][1].completed,false);
  assert.equal(calls[0][1].dueAt,'2026-10-12T07:00:00.000Z');
});

test('activity reference validation rejects missing or mismatched objects',async()=>{
  const {repository}=repos();

  const missing=await handleActivityWriteRequest({
    req:req('POST',{accountId:'missing',type:'note',text:'Test'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(missing.status,404);
  assert.equal(missing.body.error_code,'account_not_found');

  const mismatch=await handleActivityWriteRequest({
    req:req('POST',{accountId:'o-1',caseId:'d-other',type:'meeting',text:'Møte'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(mismatch.status,409);
  assert.equal(mismatch.body.error_code,'reference_mismatch');

  const badContact=await handleActivityWriteRequest({
    req:req('POST',{accountId:'o-1',contactId:'c-other',type:'call',text:'Ring'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(badContact.status,409);
  assert.equal(badContact.body.error_code,'reference_mismatch');
});

test('activity validation rejects bad type, timestamps and boolean coercion',async()=>{
  const {repository}=repos();

  const badType=await handleActivityWriteRequest({
    req:req('POST',{accountId:'o-1',type:'sms',text:'Hei'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(badType.status,400);
  assert.equal(badType.body.error_code,'invalid_activity_type');

  const badTime=await handleActivityWriteRequest({
    req:req('POST',{accountId:'o-1',type:'task',text:'Hei',dueAt:'i morgen'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(badTime.status,400);
  assert.equal(badTime.body.error_code,'invalid_timestamp');

  const badBoolean=await handleActivityWriteRequest({
    req:req('POST',{accountId:'o-1',type:'task',text:'Hei',completed:'false'}),
    url:new URL('http://x/api/activities'),
    repositories:repository
  });
  assert.equal(badBoolean.status,400);
  assert.equal(badBoolean.body.error_code,'invalid_activity');
});

test('case-only activity resolves its account from the opportunity',async()=>{
  const {repository,calls}=repos();
  const result=await handleActivityWriteRequest({
    req:req('POST',{caseId:'d-1',type:'meeting',text:'Møte'}),
    url:new URL('http://x/api/activities'),
    repositories:repository,
    makeActivityId:()=> 'a-case'
  });

  assert.equal(result.status,201);
  assert.equal(calls[0][1].accountId,'o-1');
  assert.equal(calls[0][1].caseId,'d-1');
  assert.equal(calls[0][1].completed,true);
});

test('complete is explicit and idempotent',async()=>{
  const {repository,calls,activities}=repos();
  activities.set('a-1',{id:'a-1',type:'task',text:'Følg opp',completed:false});

  const result=await handleActivityWriteRequest({
    req:req('POST'),
    url:new URL('http://x/api/activities/a-1/complete'),
    repositories:repository
  });
  assert.equal(result.status,200);
  assert.equal(result.body.data.completed,true);
  assert.deepEqual(calls,[['complete','a-1']]);

  calls.length=0;
  const again=await handleActivityWriteRequest({
    req:req('POST'),
    url:new URL('http://x/api/activities/a-1/complete'),
    repositories:repository
  });
  assert.equal(again.status,200);
  assert.equal(again.body.data.completed,true);
  assert.deepEqual(calls,[]);
});
