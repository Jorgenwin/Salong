'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');
const css=fs.readFileSync(path.join(__dirname,'../src/ui/crm-ux.css'),'utf8');
const ux=fs.readFileSync(path.join(__dirname,'../src/ui/crm-ux.js'),'utf8');

test('signed-in Salong CRM offers drawer, keyboard search, A/B/C inline update and real pipeline',{
  timeout:60000
},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium unavailable: '+error.message.slice(0,90));return;}
  let origin,role='owner';
  const companies=[
    {id:'book',name:'Bokverkstedet',priority:'A',segment:'forlag',previous_customer:false},
    {id:'org',name:'Fagforeningen',priority:'B',segment:'fag',previous_customer:true}
  ];
  let writes=[];
  const pipelineWrites=[];
  const deals=[
    {id:'case-1',account_id:'book',title:'Leie av sal',stage:'tilbud',
      value:45000,last_activity_at:'2026-10-01T10:00:00Z'},
    {id:'case-2',account_id:'org',title:'Seminar',stage:'bekreftet',
      value:22000,last_activity_at:null}
  ];
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const send=(status,kind,payload)=>{
      res.statusCode=status;res.setHeader('content-type',kind);
      res.end(typeof payload==='string'?payload:JSON.stringify(payload));
    };
    if(pathname==='/crm')return send(200,'text/html',HTML);
    if(pathname==='/crm/ux.css')return send(200,'text/css',css);
    if(pathname==='/crm/ux.js')return send(200,'application/javascript',ux);
    if(pathname==='/crm/client.js')return send(200,'application/javascript',JS);
    if(pathname==='/crm/config.js')return send(200,'application/javascript',
      'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:origin,publishableKey:'public-test'})+';');
    if(pathname==='/auth/v1/token')return send(200,'application/json',{access_token:'test-token'});
    if(pathname==='/api/me')return send(200,'application/json',{role,name:'Test'});
    if(pathname==='/api/organizations'&&req.method==='GET')return send(200,'application/json',companies);
    if(pathname==='/api/outreach/summary')return send(200,'application/json',
      {contacted:0,remaining:500,goal:500,daily_required:4,deadline:'2027-05-31'});
    if(pathname==='/api/opportunities'&&req.method==='GET')return send(200,'application/json',deals);
    if(pathname.startsWith('/api/accounts/')&&pathname.endsWith('/activities'))
      return send(200,'application/json',[{type:'call',direction:'out',
        happened_at:'2026-10-01T10:00:00Z',text:'Snakket om seminar'}]);
    if(pathname.startsWith('/api/accounts/')&&pathname.endsWith('/contacts'))
      return send(200,'application/json',[]);
    if(pathname==='/api/opportunities'&&req.method==='POST'){
      let raw='';for await(const part of req)raw+=part;
      const input=JSON.parse(raw);
      pipelineWrites.push({method:'create',payload:input});
      const opportunity={
        id:'case-created',account_id:input.accountId,title:input.title,
        stage:'ny',value:input.value??0,event_date:input.eventDate||null,
        room:input.room||null,last_activity_at:null
      };
      deals.push(opportunity);
      return send(201,'application/json',{success:true,data:opportunity});
    }
    if(/^\/api\/opportunities\/[^/]+\/stage$/.test(pathname)&&req.method==='POST'){
      let raw='';for await(const part of req)raw+=part;
      const input=JSON.parse(raw);
      const id=pathname.split('/')[3],opportunity=deals.find(x=>x.id===id);
      if(!opportunity)return send(404,'application/json',{success:false,error_message:'Not found'});
      if(opportunity.stage!==input.expectedStage)
        return send(409,'application/json',{success:false,error_code:'stage_conflict',
          error_message:'En annen bruker har oppdatert fasen.'});
      pipelineWrites.push({method:'stage',id,payload:input});
      opportunity.stage=input.stage;
      return send(200,'application/json',{success:true,data:opportunity});
    }
    if(pathname.startsWith('/api/organizations/')&&req.method==='PATCH'){
      const id=decodeURIComponent(pathname.slice('/api/organizations/'.length));
      let raw='';for await(const part of req)raw+=part;
      const patch=JSON.parse(raw);writes.push({id,patch});
      const org=companies.find(c=>c.id===id);
      if(!org)return send(404,'application/json',{success:false,error_message:'Not found'});
      Object.assign(org,patch);
      return send(200,'application/json',{success:true,data:org});
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
    await page.locator('#crm-quick-add').waitFor({state:'visible'});
    assert.equal(await page.locator('#stat-all').textContent(),'2');
    assert.equal(await page.locator('#stat-a').textContent(),'1');
    assert.equal(await page.locator('[data-crm-view="companies"]').getAttribute('aria-current'),'page');

    await page.keyboard.press('Control+k');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'search');
    await page.locator('#search').fill('Bok');
    await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===1);
    await page.locator('#rows tr').click();
    await page.locator('#editor').waitFor({state:'visible'});
    assert.equal(await page.locator('#editor-title').textContent(),'Rediger selskap');
    await page.locator('#drawer-history li').filter({hasText:'Snakket om seminar'}).waitFor();
    assert.equal(await page.locator('#editor .editor-inner').evaluate(e=>
      getComputedStyle(e).position),'absolute');
    await page.keyboard.press('Escape');
    await page.locator('#editor').waitFor({state:'hidden'});
    const tier=page.locator('#rows .inline-tier');
    await tier.selectOption('B');
    await page.waitForFunction(()=>document.querySelector('#stat-b').textContent==='2');
    assert.deepEqual(writes,[{id:'book',patch:{priority:'B'}}]);
    await page.locator('#search').fill('');

    await page.locator('[data-crm-view="pipeline"]').click();
    await page.locator('#pipeline-board .pipeline-card').first().waitFor();
    assert.match(await page.locator('#pipe-total').textContent(),/45.?000/);
    assert.equal(await page.locator('#pipe-open').textContent(),'1');
    assert.equal(await page.locator('#pipe-weighted').textContent(),'Ikke beregnet');
    assert.equal(await page.locator('.pipeline-stage').count(),7);
    assert.equal(await page.locator('.pipeline-card').count(),2);
    await page.locator('[data-pipeline-view="table"]').click();
    assert.equal(await page.locator('#pipeline-table tbody tr').count(),2);
    assert.equal(await page.locator('#pipeline-board').isHidden(),true);

    // New pipeline entries and stage updates are server-backed, never local guesses.
    await page.locator('#pipeline-new').click();
    await page.locator('#pipeline-create-modal').waitFor({state:'visible'});
    await page.locator('#case-accountId').selectOption('book');
    await page.locator('#case-title').fill('Fagseminar 2027');
    await page.locator('#case-value').fill('18000');
    await page.locator('#case-eventDate').fill('2027-03-19');
    await page.locator('#pipeline-create-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('#pipeline-table tbody tr').length===3);
    assert.equal(pipelineWrites[0].method,'create');
    assert.equal(pipelineWrites[0].payload.accountId,'book');
    assert.equal(pipelineWrites[0].payload.value,18000);
    await page.locator('[data-pipeline-view="board"]').click();
    const moved=page.locator('.pipeline-card-wrap').filter({hasText:'Fagseminar 2027'});
    await moved.locator('.pipeline-stage-select').selectOption('tilbud');
    await page.waitForFunction(()=>window.SalongCRMBridge &&
      document.querySelectorAll('.pipeline-card-wrap').length===3 &&
      [...document.querySelectorAll('.pipeline-card-wrap')].some(e=>
        e.textContent.includes('Fagseminar 2027') &&
        e.querySelector('.pipeline-stage-select')?.value==='tilbud'));
    assert.equal(pipelineWrites[1].method,'stage');
    assert.equal(pipelineWrites[1].payload.expectedStage,'ny');
    assert.equal(pipelineWrites[1].payload.stage,'tilbud');

    await page.keyboard.press('Control+k');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'search');
    assert.equal(await page.locator('[data-crm-view="companies"]').getAttribute('aria-current'),'page');

    await page.locator('#logout').click();
    assert.equal(await page.locator('#data').isHidden(),true);
    role='reader';
    await page.locator('#form [name="email"]').fill('reader@example.test');
    await page.locator('#form [name="password"]').fill('password');
    await page.locator('#form button').click();
    await page.locator('#data').waitFor({state:'visible'});
    assert.equal(await page.locator('#crm-quick-add').isHidden(),true);
    assert.equal(await page.locator('#pipeline-new').isHidden(),true);
    await page.locator('#search').fill('');
    await page.locator('#rows tr').first().click();
    await page.locator('#read-drawer').waitFor({state:'visible'});
    assert.equal(await page.locator('#read-name').textContent(),'Bokverkstedet');
    await page.keyboard.press('Escape');
    await page.locator('#read-drawer').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
  }finally{
    await browser.close();server.close();await once(server,'close');
  }
});
