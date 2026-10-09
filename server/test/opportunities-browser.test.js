'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('pipeline form stores real opportunities; stage writes are optimistic and reader-safe',{
  timeout:50000
},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium unavailable: '+error.message.slice(0,100));return;}
  const read=file=>fs.readFileSync(path.join(__dirname,'../src/ui',file),'utf8');
  const ux=read('crm-ux.js'),css=read('crm-ux.css')+'\n'+read('opportunities-client.css');
  const pipelineJS=read('opportunities-client.js');
  const pageHTML=HTML.replace('</body>','<script src="/crm/opportunities.js" defer></script></body>');
  const companies=[{id:'o-1',name:'Litteraturforeningen',priority:'A',segment:'forlag'}];
  const deals=[],writes=[];let role='owner',origin;
  const server=http.createServer(async(req,res)=>{
    const p=new URL(req.url,'http://localhost').pathname;
    const send=(status,type,payload)=>{
      res.statusCode=status;res.setHeader('content-type',type);
      res.end(typeof payload==='string'?payload:JSON.stringify(payload));
    };
    if(p==='/crm')return send(200,'text/html',pageHTML);
    if(p==='/crm/ux.css')return send(200,'text/css',css);
    if(p==='/crm/ux.js')return send(200,'application/javascript',ux);
    if(p==='/crm/opportunities.js')return send(200,'application/javascript',pipelineJS);
    if(p==='/crm/client.js')return send(200,'application/javascript',JS);
    if(p==='/crm/config.js')return send(200,'application/javascript',
      'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:origin,publishableKey:'test-key'})+';');
    if(p==='/auth/v1/token')return send(200,'application/json',{access_token:'test-token'});
    if(p==='/api/me')return send(200,'application/json',{role,name:'Eier'});
    if(p==='/api/organizations'&&req.method==='GET')return send(200,'application/json',companies);
    if(p==='/api/outreach/summary')return send(200,'application/json',
      {contacted:0,goal:500,remaining:500,daily_required:5,deadline:'2027-05-31'});
    if(p==='/api/opportunities'&&req.method==='GET')return send(200,'application/json',deals);
    if(p.startsWith('/api/accounts/')&&p.endsWith('/activities'))
      return send(200,'application/json',[]);
    if(p.startsWith('/api/accounts/')&&p.endsWith('/contacts'))
      return send(200,'application/json',[]);
    if(p==='/api/opportunities'&&req.method==='POST'){
      let raw='';for await(const part of req)raw+=part;
      const body=JSON.parse(raw);writes.push({method:'create',body});
      const deal={id:'case-new',account_id:body.accountId,title:body.title,
        stage:'ny',value:body.value,last_activity_at:null};
      deals.push(deal);return send(201,'application/json',{success:true,data:deal});
    }
    if(p==='/api/opportunities/case-new/stage'&&req.method==='POST'){
      let raw='';for await(const part of req)raw+=part;
      const body=JSON.parse(raw);writes.push({method:'stage',body});
      const deal=deals[0];
      if(body.expectedStage!==deal.stage)return send(409,'application/json',
        {success:false,error_message:'Saken har endret fase. Oppdater pipeline.'});
      deal.stage=body.stage;deal.lost_reason=body.stage==='tapt'?body.lostReason:null;
      return send(200,'application/json',{success:true,data:deal});
    }
    return send(404,'application/json',{success:false});
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/crm');
    await page.locator('#form [name="email"]').fill('owner@example.test');
    await page.locator('#form [name="password"]').fill('password');
    await page.locator('#form button').click();
    await page.locator('[data-crm-view="pipeline"]').click();
    await page.locator('#opp-new').waitFor({state:'visible'});
    await page.locator('#opp-new').click();
    await page.locator('#opp-form [name="accountId"]').selectOption('o-1');
    await page.locator('#opp-form [name="title"]').fill('Leie til litteraturseminar');
    await page.locator('#opp-form [name="value"]').fill('120000.5');
    await page.locator('#opp-save').click();
    await page.locator('.opp-card-wrap').waitFor({state:'visible'});
    assert.equal(writes[0].method,'create');
    assert.equal(writes[0].body.accountId,'o-1');
    assert.equal(writes[0].body.value,120000.5);
    assert.equal(await page.locator('.pipeline-card').count(),1);
    await page.locator('.opp-card-wrap select').selectOption('dialog');
    await page.waitForFunction(()=>document.querySelector('.opp-card-wrap select')?.value==='dialog');
    assert.equal(writes[1].body.expectedStage,'ny');
    assert.equal(writes[1].body.stage,'dialog');
    assert.equal(deals[0].stage,'dialog');
    page.once('dialog',dialog=>dialog.accept('Annen dato'));
    await page.locator('.opp-card-wrap select').selectOption('tapt');
    await page.waitForFunction(()=>document.querySelector('.opp-card-wrap select')?.value==='tapt');
    assert.equal(writes[2].body.lostReason,'Annen dato');
    assert.equal(deals[0].lost_reason,'Annen dato');
    await page.locator('#logout').click();
    role='reader';
    await page.locator('#form [name="email"]').fill('reader@example.test');
    await page.locator('#form [name="password"]').fill('password');
    await page.locator('#form button').click();
    await page.locator('[data-crm-view="pipeline"]').click();
    await page.locator('.pipeline-card').first().waitFor();
    assert.equal(await page.locator('#opp-new').isHidden(),true);
    assert.equal(await page.locator('.opp-stage-label').count(),0);
    assert.deepEqual(errors,[]);
  }finally{
    await browser.close();server.close();await once(server,'close');
  }
});
