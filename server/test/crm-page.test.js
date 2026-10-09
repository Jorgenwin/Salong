'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const http=require('node:http');
const {once}=require('node:events');
const {createApp}=require('../src/app');
const {loadConfig}=require('../src/config');
test('separate CRM page serves no secrets and never bypasses /api auth',async()=>{
 const config=loadConfig({
  NODE_ENV:'production',PORT:'3000',
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_test',
  DATABASE_URL:'postgres://private:secret@localhost/private'
 });
 const server=http.createServer(createApp({config,repositories:{
  accounts:{async listOrganizations(){return [{id:'private',name:'Private'}];}}
 }}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/crm');assert.equal(page.status,200);
  const html=await page.text();assert.match(html,/Salong CRM/);
  assert.match(html,/\/crm\/config.js/);
  assert.doesNotMatch(html,/secret|Private/);
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const script=await fetch(base+'/crm/config.js');
  assert.equal(script.status,200);
  assert.match(await script.text(),/sb_publishable_public_test/);
  const client=await fetch(base+'/crm/client.js');
  assert.equal(client.status,200);
  assert.match(await client.text(),/\/api\/organizations/);
  const uxScript=await fetch(base+'/crm/ux.js');
  assert.equal(uxScript.status,200);
  assert.match(await uxScript.text(),/SalongCRMUX/);
  assert.match(uxScript.headers.get('content-type'),/application\/javascript/);
  const uxStyles=await fetch(base+'/crm/ux.css');
  assert.equal(uxStyles.status,200);
  assert.match(await uxStyles.text(),/crm-sidebar/);
  assert.match(uxStyles.headers.get('content-type'),/text\/css/);
  assert.match(page.headers.get('content-security-policy'),/style-src 'self'/);
  const blocked=await fetch(base+'/api/organizations');
  assert.equal(blocked.status,503);
  assert.equal((await blocked.json()).error_code,'auth_not_ready');
 }finally{server.close();await once(server,'close');}
});
test('CRM page fails closed when public Supabase Auth is not configured',async()=>{
 const server=http.createServer(createApp({config:loadConfig({NODE_ENV:'production',PORT:'3000'})}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/crm');
  assert.equal(response.status,503);
 }finally{server.close();await once(server,'close');}
});
