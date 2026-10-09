'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('bulk company intake previews duplicates and saves only confirmed new names',{
  timeout:50000
},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium unavailable: '+error.message.slice(0,90));return;}
  let base,role='owner';
  const records=[{id:'existing',name:'Eksisterende Forlag',segment:'forlag',priority:'A'}];
  const creations=[];
  const ux=fs.readFileSync(path.join(__dirname,'../src/ui/crm-ux.js'),'utf8');
  const bulk=fs.readFileSync(path.join(__dirname,'../src/ui/bulk-client.js'),'utf8');
  const send=(res,status,type,body)=>{
    res.statusCode=status;res.setHeader('content-type',type);res.end(body);
  };
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/crm')return send(res,200,'text/html',
      HTML.replace('</body>','<script src="/crm/bulk.js" defer></script></body>'));
    if(pathname==='/crm/client.js')return send(res,200,'application/javascript',JS);
    if(pathname==='/crm/ux.js')return send(res,200,'application/javascript',ux);
    if(pathname==='/crm/bulk.js')return send(res,200,'application/javascript',bulk);
    if(pathname==='/crm/config.js')return send(res,200,'application/javascript',
      'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:base,publishableKey:'test'})+';');
    if(pathname==='/auth/v1/token')return send(res,200,'application/json',
      JSON.stringify({access_token:'test-jwt'}));
    if(pathname==='/api/me')return send(res,200,'application/json',
      JSON.stringify({id:'owner',name:'Eier',role}));
    if(pathname==='/api/organizations'&&req.method==='GET')
      return send(res,200,'application/json',JSON.stringify(records));
    if(pathname==='/api/organizations'&&req.method==='POST'){
      let body='';for await(const part of req)body+=part;
      const obj=JSON.parse(body);creations.push(obj);
      if(records.some(r=>r.name.toLocaleLowerCase('nb')===obj.name.toLocaleLowerCase('nb')))
        return send(res,409,'application/json',
          JSON.stringify({success:false,error_code:'duplicate_organization',error_message:'Duplikat'}));
      const newRecord={id:'bulk-'+creations.length,...obj};records.push(newRecord);
      return send(res,201,'application/json',JSON.stringify({success:true,data:newRecord}));
    }
    return send(res,404,'application/json','{"success":false}');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/crm');
    await page.locator('#form [name="email"]').fill('owner@example.test');
    await page.locator('#form [name="password"]').fill('pass');
    await page.locator('#form button').click();
    await page.locator('#bulk-open').waitFor({state:'visible'});
    await page.locator('#bulk-open').click();
    await page.locator('#bulk-names').fill(
      'Eksisterende Forlag\nNytt Forlag\nNytt Forlag\nNy Forskningsinstitusjon'
    );
    await page.locator('#bulk-segment').fill('forskning');
    await page.locator('#bulk-priority').selectOption('B');
    assert.equal(await page.locator('#bulk-confirm').isDisabled(),true);
    await page.locator('#bulk-preview').click();
    assert.match(await page.locator('#bulk-preview-summary').textContent(),/2 nye selskaper klare/);
    assert.equal(creations.length,0,'preview must never write to database');
    await page.locator('#bulk-confirm').click();
    await page.waitForFunction(()=>document.querySelector('#bulk-preview-summary').textContent.includes('2 lagret'));
    assert.equal(creations.length,2);
    assert.equal(records.length,3);
    assert.equal(records[0].priority,'A');
    assert.ok(creations.every(r=>r.priority==='B'&&r.segment==='forskning'));
    await page.locator('#bulk-close').click();
    assert.match(await page.locator('#total').textContent(),/3 selskaper/);
    await page.locator('#logout').click();
    assert.equal(await page.locator('#bulk-names').inputValue(),'');
    assert.deepEqual(errors,[]);
    await page.close();

    // Read-only members never see or activate the creation workflow.
    role='reader';
    const reader=await browser.newPage();
    await reader.goto(base+'/crm');
    await reader.locator('#form [name="email"]').fill('reader@example.test');
    await reader.locator('#form [name="password"]').fill('pass');
    await reader.locator('#form button').click();
    await reader.locator('#data').waitFor({state:'visible'});
    assert.equal(await reader.locator('#bulk-open').isHidden(),true);
    await reader.close();
  }finally{await browser.close();server.close();await once(server,'close');}
});