'use strict';

const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const test=require('node:test');

const {handleContactWriteRequest}=require('../src/api/contacts-write');

function req(method,body){
  const stream=body===undefined?Readable.from([]):Readable.from([JSON.stringify(body)]);
  stream.method=method;
  stream.headers={};
  return stream;
}

function repos(){
  const calls=[];
  const contacts=new Map();
  const repository={
    accounts:{
      async get(id){ return id==='o-1'?{id,name:'Test AS'}:null; }
    },
    contacts:{
      async get(id){ return contacts.get(id)||null; },
      async add(input){
        calls.push(['add',input]);
        const row={
          id:input.id,
          account_id:input.accountId,
          name:input.name,
          title:input.title||'',
          email:input.email||null,
          email_status:input.emailStatus||null,
          phone:input.phone||null,
          phone_status:input.phoneStatus||null,
          linkedin_url:input.linkedinUrl||null,
          role_match:input.roleMatch||null,
          relevant:input.relevant,
          active:input.active!==false,
          do_not_contact:false,
          is_primary:false
        };
        contacts.set(row.id,row);
        return row;
      },
      async update(id,patch){
        calls.push(['update',id,patch]);
        const row={...contacts.get(id),...patch};
        contacts.set(id,row);
        return row;
      },
      async setPrimary(id){
        calls.push(['primary',id]);
        const row={...contacts.get(id),is_primary:true,active:true};
        contacts.set(id,row);
        return row;
      },
      async setDoNotContact(id,input){
        calls.push(['dnc',id,input]);
        const row={...contacts.get(id),do_not_contact:input.value,do_not_contact_reason:input.reason};
        contacts.set(id,row);
        return row;
      }
    }
  };
  return {repository,calls,contacts};
}

test('POST account contact validates account and creates manual unverified contact',async()=>{
  const {repository,calls}=repos();
  const result=await handleContactWriteRequest({
    req:req('POST',{name:'  Kari Test  ',title:'Eventsjef',email:'kari@example.test'}),
    url:new URL('http://x/api/accounts/o-1/contacts'),
    repositories:repository,
    makeContactId:()=> 'contact-1'
  });

  assert.equal(result.status,201);
  assert.equal(result.body.success,true);
  assert.equal(result.body.data.id,'contact-1');
  assert.equal(calls[0][0],'add');
  assert.equal(calls[0][1].name,'Kari Test');
  assert.equal(calls[0][1].sourceState,'manual');
  assert.equal(calls[0][1].verifiedAt,null);
});

test('POST account contact rejects missing account and missing name',async()=>{
  const {repository}=repos();

  const missing=await handleContactWriteRequest({
    req:req('POST',{name:'Kari'}),
    url:new URL('http://x/api/accounts/missing/contacts'),
    repositories:repository
  });
  assert.equal(missing.status,404);
  assert.equal(missing.body.error_code,'account_not_found');

  const bad=await handleContactWriteRequest({
    req:req('POST',{title:'Eventsjef'}),
    url:new URL('http://x/api/accounts/o-1/contacts'),
    repositories:repository
  });
  assert.equal(bad.status,400);
  assert.equal(bad.body.error_code,'invalid_contact');
});

test('PATCH contact only maps supported public fields',async()=>{
  const {repository,contacts,calls}=repos();
  contacts.set('c-1',{id:'c-1',name:'Old',do_not_contact:false});

  const result=await handleContactWriteRequest({
    req:req('PATCH',{
      name:'New Name',
      title:'Programleder',
      emailStatus:'verified',
      active:false,
      ignored:'nope'
    }),
    url:new URL('http://x/api/contacts/c-1'),
    repositories:repository
  });

  assert.equal(result.status,200);
  assert.deepEqual(calls[0],['update','c-1',{
    name:'New Name',
    title:'Programleder',
    email_status:'verified',
    active:false
  }]);
});

test('primary contact is blocked when do-not-contact is active',async()=>{
  const {repository,contacts,calls}=repos();
  contacts.set('c-1',{id:'c-1',name:'Kari',do_not_contact:true});

  const result=await handleContactWriteRequest({
    req:req('POST'),
    url:new URL('http://x/api/contacts/c-1/primary'),
    repositories:repository
  });

  assert.equal(result.status,409);
  assert.equal(result.body.error_code,'do_not_contact');
  assert.equal(calls.length,0);
});

test('primary contact can be selected explicitly',async()=>{
  const {repository,contacts,calls}=repos();
  contacts.set('c-1',{id:'c-1',name:'Kari',do_not_contact:false});

  const result=await handleContactWriteRequest({
    req:req('POST'),
    url:new URL('http://x/api/contacts/c-1/primary'),
    repositories:repository
  });

  assert.equal(result.status,200);
  assert.equal(result.body.data.is_primary,true);
  assert.deepEqual(calls,[['primary','c-1']]);
});

test('do-not-contact requires reason and can be cleared',async()=>{
  const {repository,contacts,calls}=repos();
  contacts.set('c-1',{id:'c-1',name:'Kari',do_not_contact:false});

  const bad=await handleContactWriteRequest({
    req:req('POST',{value:true}),
    url:new URL('http://x/api/contacts/c-1/do-not-contact'),
    repositories:repository
  });
  assert.equal(bad.status,400);
  assert.equal(bad.body.error_code,'reason_required');

  const set=await handleContactWriteRequest({
    req:req('POST',{value:true,reason:'Ba om å ikke bli kontaktet'}),
    url:new URL('http://x/api/contacts/c-1/do-not-contact'),
    repositories:repository
  });
  assert.equal(set.status,200);

  const clear=await handleContactWriteRequest({
    req:req('POST',{value:false}),
    url:new URL('http://x/api/contacts/c-1/do-not-contact'),
    repositories:repository
  });
  assert.equal(clear.status,200);
  assert.deepEqual(calls,[
    ['dnc','c-1',{value:true,reason:'Ba om å ikke bli kontaktet'}],
    ['dnc','c-1',{value:false,reason:null}]
  ]);
});
