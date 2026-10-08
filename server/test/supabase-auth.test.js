'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {createSupabaseVerifier}=require('../src/auth/supabase');
const {createAuthBoundary}=require('../src/auth/authorization');

test('verifies Supabase user against Auth server, never trusts unverified token payload',async()=>{
  const calls=[];
  const verify=createSupabaseVerifier({
    url:'https://example.supabase.co/',
    publishableKey:'public-key',
    fetchFn:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,async json(){return {id:'valid-auth-subject',role:'owner'};}};
    }
  });
  assert.deepEqual(await verify('opaque.access.token'),{sub:'valid-auth-subject'});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://example.supabase.co/auth/v1/user');
  assert.equal(calls[0].options.headers.apikey,'public-key');
  assert.equal(calls[0].options.headers.authorization,'Bearer opaque.access.token');
  assert.equal(calls[0].options.method,'GET');
});

test('Supabase tokens do not grant roles without active member match',async()=>{
  const verify=createSupabaseVerifier({
    url:'https://example.supabase.co',
    publishableKey:'public-key',
    fetchFn:async()=>({ok:true,async json(){return {id:'stranger',role:'owner'};}})
  });
  const boundary=createAuthBoundary({
    verifyToken:verify,
    members:{async getByAuthSubject(){return null;}}
  });
  const response=await boundary.authorizeRequest({headers:{authorization:'Bearer something'}});
  assert.equal(response.status,403);
  assert.equal(response.body.error_code,'forbidden');
});

test('rejects Auth server failures, malformed identities and anonymous accounts',async()=>{
  const badResponse=createSupabaseVerifier({
    url:'https://example.supabase.co',publishableKey:'public-key',
    fetchFn:async()=>({ok:false,status:401})
  });
  await assert.rejects(()=>badResponse('invalid'),/rejected/);
  const invalidUser=createSupabaseVerifier({
    url:'https://example.supabase.co',publishableKey:'public-key',
    fetchFn:async()=>({ok:true,async json(){return {id:'guest',is_anonymous:true};}})
  });
  await assert.rejects(()=>invalidUser('invalid'),/identity/);
});

test('refuses http, URL credentials, incomplete configuration and oversized access tokens',async()=>{
  assert.throws(()=>createSupabaseVerifier({url:'http://example.supabase.co',publishableKey:'pk'}),/https/);
  assert.throws(()=>createSupabaseVerifier({url:'https://evil@example.supabase.co',publishableKey:'pk'}),/https/);
  assert.throws(()=>createSupabaseVerifier({url:'https://example.supabase.co',publishableKey:''}),/required/);
  const verifier=createSupabaseVerifier({
    url:'https://example.supabase.co',
    publishableKey:'pk',fetchFn:async()=>{throw new Error('should not fetch');}
  });
  await assert.rejects(()=>verifier('x'.repeat(16385)),/Invalid access token/);
});


test('configuration requires both Supabase variables and does not report legacy AUTH_SECRET as active auth',()=>{
  const {loadConfig,publicConfigSummary}=require('../src/config');
  assert.throws(()=>loadConfig({NODE_ENV:'test',SUPABASE_URL:'https://example.supabase.co'}),/set together/);
  assert.throws(()=>loadConfig({NODE_ENV:'test',SUPABASE_PUBLISHABLE_KEY:'public-key'}),/set together/);
  const invalid=loadConfig({NODE_ENV:'test',AUTH_SECRET:'legacy-secret'});
  assert.equal(publicConfigSummary(invalid).authConfigured,false);
  const configured=loadConfig({
    NODE_ENV:'test',
    SUPABASE_URL:'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'public-key'
  });
  assert.equal(publicConfigSummary(configured).authConfigured,true);
  assert.equal(JSON.stringify(publicConfigSummary(configured)).includes('public-key'),false);
});
