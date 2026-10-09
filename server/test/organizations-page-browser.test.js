'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('CRM owner creates and edits a company, then sees persistent read-back',{
  timeout:45000
},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium unavailable: '+error.message.slice(0,90));return;}
  let records=[{id:'existing',name:'Kulturinstitusjon',priority:'A',segment:'forlag',previous_customer:false}];
  const writes=[];
  let origin;
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const send=(code,type,data)=>{
      res.statusCode=code;res.setHeader('content-type',type);res.end(data);
    };
    if(pathname==='/crm'){
      res.setHeader('content-security-policy',
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'");
      send(200,'text/html',HTML);return;
    }
    if(pathname==='/crm/config.js'){
      send(200,'application/javascript',
        'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:origin,publishableKey:'test-pub'})+';');return;
    }
    if(pathname==='/crm/client.js'){send(200,'application/javascript',JS);return;}
    if(pathname==='/auth/v1/token'){
      send(200,'application/json',JSON.stringify({access_token:'test-jwt'}));return;
    }
    if(pathname==='/api/me'){send(200,'application/json',JSON.stringify({role:'owner',name:'Eier'}));return;}
    if(pathname==='/api/organizations'&&req.method==='GET'){
      send(200,'application/json',JSON.stringify(records));return;
    }
    if(pathname==='/api/organizations'&&req.method==='POST'){
      let body='';for await(const part of req)body+=part;
      const obj=JSON.parse(body);
      writes.push({method:'POST',body:obj});
      const data={id:'created',...obj};records.push(data);
      send(201,'application/json',JSON.stringify({success:true,data}));return;
    }
    if(pathname==='/api/organizations/existing'&&req.method==='PATCH'){
      let body='';for await(const part of req)body+=part;
      const obj=JSON.parse(body);
      writes.push({method:'PATCH',body:obj});
      records=records.map(r=>r.id==='existing'?{...r,...obj}:r);
      send(200,'application/json',JSON.stringify({success:true,data:records[0]}));return;
    }
    send(404,'application/json',JSON.stringify({success:false}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/crm');
    await page.locator('#form [name="email"]').fill('owner@example.test');
    await page.locator('#form [name="password"]').fill('password');
    await page.locator('#form button').click();
    await page.locator('#new-org').waitFor({state:'visible'});
    await page.locator('#new-org').click();
    await page.locator('#org-form [name="name"]').fill('Ny institusjon');
    await page.locator('#org-form [name="segment"]').fill('forskning');
    await page.locator('#org-form [name="priority"]').selectOption('B');
    await page.locator('#org-save').click();
    await page.waitForFunction(()=>document.getElementById('total').textContent.includes('2 selskaper'));
    assert.equal(writes[0].method,'POST');
    assert.equal(writes[0].body.priority,'B');
    assert.equal(writes[0].body.name,'Ny institusjon');
    await page.locator('.edit-org').first().click();
    await page.locator('#org-form [name="priority"]').selectOption('C');
    await page.locator('#org-save').click();
    await page.waitForFunction(()=>document.getElementById('editor').hidden);
    const patch=writes.find(w=>w.method==='PATCH');
    assert.deepEqual(patch.body,{priority:'C'},'unchanged quality and fields are not written');
    assert.deepEqual(errors,[]);
    await page.locator('#logout').click();
    assert.equal(await page.locator('#data').isHidden(),true);
    await page.close();
  }finally{
    await browser.close();server.close();await once(server,'close');
  }
});
