'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {prepareCrmWorkspace}=require('../src/app');

test('familiar Salong browser shows only authenticated imported organizations',{
  timeout:50000
},async t=>{
  const built=path.join(__dirname,'../../dist/index.html');
  if(!fs.existsSync(built)){t.skip('Run npm run build first');return;}
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium is not installed: '+error.message.slice(0,90));return;}
  const source=fs.readFileSync(built,'utf8');
  const preview=prepareCrmWorkspace(source);
  assert.ok(preview,'Salong must include the expected bundled JS');
  const companies=[
    {id:'db-literary',name:'Bokfestival virkelige selskap',segment:'forlag',priority:'A'},
    {id:'db-research',name:'Forskningsforening virkelige selskap',segment:'forskning',priority:'B'}
  ];
  const transfer=JSON.stringify({type:'salong:crm-organizations',organizations:companies});
  const harness='<!doctype html><html><body><iframe id="preview" src="/workspace#prosp"></iframe>'+
    '<script>window.reports=[];window.addEventListener("message",e=>{if(e.origin===location.origin&&e.data&&e.data.type==="salong:crm-loaded")reports.push(e.data)});'+
    'document.getElementById("preview").addEventListener("load",function(){this.contentWindow.postMessage('+transfer+',location.origin)})</script></body></html>';
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/workspace')){
      res.setHeader('content-type','text/html; charset=utf-8');
      res.setHeader('content-security-policy',preview.csp);
      res.end(preview.html);
    }else{res.setHeader('content-type','text/html; charset=utf-8');res.end(harness);}
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.goto(base+'/parent');
    await page.waitForFunction(()=>window.reports.length===1,null,{timeout:25000});
    const frame=page.frames().find(f=>f.url().includes('/workspace'));
    assert.ok(frame,'existing Salong page should load inside same-origin iframe');
    const state=await frame.evaluate(()=>({
      ids:Object.keys(window.__salong.S.orgs),
      names:Object.values(window.__salong.S.orgs).map(x=>x.name),
      priority:window.__salong.S.orgs['db-literary'].tier,
      view:window.__salong.UI.view,
      pageText:document.body.innerText
    }));
    assert.deepEqual(state.ids.sort(),['db-literary','db-research']);
    assert.equal(state.priority,'A');
    assert.equal(state.view,'prosp');
    assert.match(await frame.locator('#mode').textContent(),/Ekte Supabase-data/);
    assert.ok(!state.names.includes('Recovery Norge'),'public fixture profiles cannot reappear');
    assert.deepEqual(pageErrors,[],'no uncaught browser errors');
    await page.close();
  }finally{
    await browser.close();
    server.close();
    await once(server,'close');
  }
});
