'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  bearerToken,
  hasRole,
  createAuthBoundary
}=require('../src/auth/authorization');

test('bearer token parser is strict and trims token',()=>{
  assert.equal(bearerToken({authorization:'Bearer abc.def'}),'abc.def');
  assert.equal(bearerToken({authorization:'bearer   token-1'}),'token-1');
  assert.equal(bearerToken({authorization:'Basic abc'}),null);
  assert.equal(bearerToken({}),null);
});

test('role hierarchy is reader < editor < owner',()=>{
  assert.equal(hasRole('reader','reader'),true);
  assert.equal(hasRole('reader','editor'),false);
  assert.equal(hasRole('editor','reader'),true);
  assert.equal(hasRole('editor','editor'),true);
  assert.equal(hasRole('editor','owner'),false);
  assert.equal(hasRole('owner','reader'),true);
  assert.equal(hasRole('owner','owner'),true);
  assert.equal(hasRole('admin','reader'),false);
});

test('missing or invalid token is unauthorized without member lookup',async()=>{
  let verified=0,lookups=0;
  const auth=createAuthBoundary({
    async verifyToken(token){
      verified++;
      if(token==='bad') throw new Error('invalid');
      return {sub:'auth-1'};
    },
    members:{
      async getByAuthSubject(){
        lookups++;
        return null;
      }
    }
  });

  const missing=await auth.authenticateRequest({headers:{}});
  assert.equal(missing.status,401);
  assert.equal(missing.body.error_code,'unauthorized');
  assert.equal(verified,0);
  assert.equal(lookups,0);

  const invalid=await auth.authenticateRequest({headers:{authorization:'Bearer bad'}});
  assert.equal(invalid.status,401);
  assert.equal(verified,1);
  assert.equal(lookups,0);
});

test('inactive, missing or unknown-role members are forbidden',async()=>{
  const responses=[
    null,
    {id:'m-1',role:'editor',active:false},
    {id:'m-2',role:'admin',active:true}
  ];
  const auth=createAuthBoundary({
    async verifyToken(){ return {sub:'auth-1'}; },
    members:{
      async getByAuthSubject(){ return responses.shift(); }
    }
  });

  for(let i=0;i<3;i++){
    const result=await auth.authenticateRequest({headers:{authorization:'Bearer ok'}});
    assert.equal(result.status,403);
    assert.equal(result.body.error_code,'forbidden');
  }
});

test('authorization enforces minimum role server-side',async()=>{
  const auth=createAuthBoundary({
    async verifyToken(token){
      return {sub:token};
    },
    members:{
      async getByAuthSubject(subject){
        const roles={reader:'reader',editor:'editor',owner:'owner'};
        return {id:'m-'+subject,authSubject:subject,role:roles[subject],active:true};
      }
    }
  });

  const reader=await auth.authorizeRequest(
    {headers:{authorization:'Bearer reader'}},
    {minimumRole:'reader'}
  );
  assert.equal(reader.ok,true);
  assert.equal(reader.user.role,'reader');

  const denied=await auth.authorizeRequest(
    {headers:{authorization:'Bearer reader'}},
    {minimumRole:'editor'}
  );
  assert.equal(denied.status,403);

  const editor=await auth.authorizeRequest(
    {headers:{authorization:'Bearer editor'}},
    {minimumRole:'editor'}
  );
  assert.equal(editor.ok,true);

  const owner=await auth.authorizeRequest(
    {headers:{authorization:'Bearer owner'}},
    {minimumRole:'owner'}
  );
  assert.equal(owner.ok,true);
});
