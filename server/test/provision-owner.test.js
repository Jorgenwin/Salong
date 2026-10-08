'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {ownerInput,provisionOwner}=require('../scripts/provision-owner');

const SUBJECT='11111111-1111-4111-8111-111111111111';
test('only a UUID identity from Supabase Auth can be owner',()=>{
  const owner=ownerInput({SALONG_OWNER_AUTH_SUBJECT:SUBJECT,SALONG_OWNER_NAME:'Test Owner',SALONG_OWNER_EMAIL:'test@example.test'});
  assert.deepEqual(owner,{subject:SUBJECT,name:'Test Owner',email:'test@example.test'});
  assert.throws(()=>ownerInput({SALONG_OWNER_AUTH_SUBJECT:'placeholder'}),/UUID/);
  assert.throws(()=>ownerInput({SALONG_OWNER_AUTH_SUBJECT:SUBJECT,SALONG_OWNER_EMAIL:'invalid'}),/email/);
});
test('provisioning creates exactly one active owner, with parameterized values',async()=>{
  const calls=[];
  const db={async query(sql,values){
    calls.push({sql:String(sql),values});
    if(sql.startsWith('SELECT count(*)'))return {rows:[{n:0}]};
    return {rows:[]};
  }};
  assert.deepEqual(await provisionOwner(db,{subject:SUBJECT,name:'Test Owner',email:'test@example.test'}),{inserted:1,role:'owner'});
  assert.equal(calls[0].sql,'BEGIN');
  const inserted=calls.find(x=>x.sql.includes('INSERT INTO public.members'));
  assert.deepEqual(inserted.values,['salong-owner',SUBJECT,'Test Owner','test@example.test']);
  assert.equal(inserted.sql.includes(SUBJECT),false);
  assert.equal(calls.at(-1).sql,'COMMIT');
});
test('existing member blocks new owner and triggers rollback',async()=>{
  const calls=[];
  const db={async query(sql){
    calls.push(String(sql));
    if(sql.startsWith('SELECT count(*)'))return {rows:[{n:1}]};
    return {rows:[]};
  }};
  await assert.rejects(()=>provisionOwner(db,{subject:SUBJECT,name:'Owner'}),/already exist/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.some(x=>x.includes('INSERT INTO public.members')));
});
