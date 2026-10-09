'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('real I dag page supports first contact, persistent tasks and completion',{
  timeout:55000
},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium not installed: '+error.message.slice(0,70));return;}
  let base,contacted=false,task=null,taskComplete=false;
  const actions=[];
  const companies=[
    {id:'lead-a',name:'Forlag Nyhet',priority:'A',segment:'forlag'},
    {id:'lead-b',name:'Institusjon Nyhet',priority:'B',segment:'forskning'}
  ];
  const ux=fs.readFileSync(path.join(__dirname,'../src/ui/crm-ux.js'),'utf8');
  const today=fs.readFileSync(path.join(__dirname,'../src/ui/today-client.js'),'utf8');
  const send=(res,status,type,body)=>{
    res.statusCode=status;res.setHeader('content-type',type);res.end(body);
  };
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/crm')return send(res,200,'text/html',
      HTML.replace('</body>','<script src="/crm/today.js" defer></script></body>'));
    if(url.pathname==='/crm/client.js')return send(res,200,'application/javascript',JS);
    if(url.pathname==='/crm/ux.js')return send(res,200,'application/javascript',ux);
    if(url.pathname==='/crm/today.js')return send(res,200,'application/javascript',today);
    if(url.pathname==='/crm/config.js')return send(res,200,'application/javascript',
      'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:base,publishableKey:'test'})+';');
    if(url.pathname==='/auth/v1/token')return send(res,200,'application/json',
      JSON.stringify({access_token:'test-jwt'}));
    if(url.pathname==='/api/me')return send(res,200,'application/json',
      JSON.stringify({id:'owner',name:'Eier',role:'owner'}));
    if(url.pathname==='/api/organizations')return send(res,200,'application/json',
      JSON.stringify(companies));
    if(url.pathname==='/api/outreach/summary')return send(res,200,'application/json',
      JSON.stringify({contacted:contacted?1:0,goal:500,remaining:contacted?499:500,
        daily_required:5,deadline:'2027-05-31'}));
    if(url.pathname==='/api/today/queue'){
      const all=[];
      if(task&&!taskComplete)all.push({
        kind:'task',action_id:'task-real',account_id:'lead-a',
        account_name:'Forlag Nyhet',priority:'A',segment:'forlag',
        text:task.text,due_at:task.dueAt,rank:0
      });
      if(!contacted&&(!task||taskComplete))all.push({
        kind:'first_contact',action_id:'first:lead-a',account_id:'lead-a',
        account_name:'Forlag Nyhet',priority:'A',segment:'forlag',
        text:'Første kontakt',rank:3
      });
      all.push({kind:'first_contact',action_id:'first:lead-b',
        account_id:'lead-b',account_name:'Institusjon Nyhet',
        priority:'B',segment:'forskning',text:'Første kontakt',rank:4});
      const offset=Number(url.searchParams.get('offset'))||0;
      const limit=Number(url.searchParams.get('limit'))||40;
      return send(res,200,'application/json',JSON.stringify({
        items:all.slice(offset,offset+limit),total:all.length,
        limit,offset,today:'2026-10-09'
      }));
    }
    if(url.pathname==='/api/activities'&&req.method==='POST'){
      let body='';for await(const part of req)body+=part;
      const payload=JSON.parse(body);actions.push(payload);
      if(payload.type==='task')task=payload;
      else if(payload.type==='email'&&payload.direction==='out')contacted=true;
      return send(res,201,'application/json',
        JSON.stringify({success:true,data:{id:'task-real',...payload}}));
    }
    if(url.pathname==='/api/activities/task-real/complete'&&req.method==='POST'){
      taskComplete=true;return send(res,200,'application/json',
        JSON.stringify({success:true,data:{id:'task-real',completed:true}}));
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
    await page.locator('[data-crm-view="today"]').click();
    await page.locator('#today-list .today-row').first().waitFor();
    assert.equal(await page.locator('#today-list .today-row').count(),2);
    assert.match(await page.locator('#today-goal').textContent(),/0 \/ 500/);
    assert.match(await page.locator('#today-list .today-row').first().textContent(),/Forlag Nyhet/);
    await page.locator('#today-list .today-row').first()
      .getByRole('button',{name:'Planlegg oppfølging'}).click();
    await page.locator('.today-task-form input[type="text"]').fill('Ring beslutningstaker');
    await page.locator('.today-task-form input[type="date"]').fill('2026-10-12');
    await page.locator('.today-task-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('.today-kind.task')!=null);
    assert.equal(actions[0].type,'task');
    assert.equal(actions[0].completed,false);
    assert.equal(actions[0].dueAt,'2026-10-12T12:00:00.000Z');
    assert.equal(await page.locator('#today-list .today-row').count(),2);
    await page.locator('#today-list .today-row').first()
      .getByRole('button',{name:'Marker ferdig'}).click();
    await page.waitForFunction(()=>document.querySelector('.today-kind.task')==null);
    assert.equal(taskComplete,true);
    await page.locator('#today-list .today-row').first()
      .getByRole('button',{name:'Logg kontakt'}).click();
    await page.locator('#activity-form [name="type"]').selectOption('email');
    await page.locator('#activity-form [name="direction"]').selectOption('out');
    await page.locator('#activity-form [name="text"]').fill('Faktisk e-post sendt');
    await page.locator('#activity-save').click();
    await page.waitForFunction(()=>document.querySelector('#today-list').textContent.indexOf('Forlag Nyhet')===-1);
    assert.equal(contacted,true);
    assert.equal(await page.locator('#today-list .today-row').count(),1);
    await page.locator('#logout').click();
    assert.equal(await page.locator('#data').isHidden(),true);
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{await browser.close();server.close();await once(server,'close');}
});