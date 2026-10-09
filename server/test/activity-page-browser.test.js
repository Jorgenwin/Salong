'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const http=require('node:http');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('live CRM browser logs real outbound contact and counts unique companies', {timeout:45000},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium missing: '+error.message.slice(0,100));return;}
  const companies=[
    {id:'org-a',name:'Forlag AS',priority:'A',segment:'forlag'},
    {id:'org-b',name:'Fagforeningen',priority:'B',segment:'fag'}
  ];
  const logs=[];
  let origin;
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const send=(status,type,value)=>{
      res.statusCode=status;
      res.setHeader('content-type',type);
      res.end(typeof value==='string'?value:JSON.stringify(value));
    };
    if(pathname==='/crm'){
      res.setHeader('content-security-policy',
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'");
      send(200,'text/html',HTML);return;
    }
    if(pathname==='/crm/config.js'){
      send(200,'application/javascript',
        'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:origin,publishableKey:'example'})+';');
      return;
    }
    if(pathname==='/crm/client.js'){send(200,'application/javascript',JS);return;}
    if(pathname==='/auth/v1/token'){send(200,'application/json',{access_token:'fake-test-token'});return;}
    if(pathname==='/api/me'){send(200,'application/json',{role:'owner',name:'Eier'});return;}
    if(pathname==='/api/organizations'){send(200,'application/json',companies);return;}
    if(pathname==='/api/outreach/summary'){
      const contacted=new Set(logs.filter(x=>x.completed&&x.direction==='out').map(x=>x.accountId)).size;
      send(200,'application/json',{
        contacted,goal:500,start:'2026-12-01',deadline:'2027-05-31',
        remaining:500-contacted,daily_required:3,deadline_passed:false
      });return;
    }
    if(/^\/api\/accounts\/[^/]+\/activities$/.test(pathname)){
      const id=pathname.split('/')[3];
      send(200,'application/json',logs.filter(x=>x.accountId===id).map((x,i)=>({
        id:'log-'+i,account_id:id,happened_at:'2027-01-05T09:00:00Z',
        type:x.type,text:x.text,direction:x.direction
      })));return;
    }
    if(pathname==='/api/activities'&&req.method==='POST'){
      let body='';for await(const chunk of req)body+=chunk;
      const parsed=JSON.parse(body);
      assert.equal(req.headers.authorization,'Bearer fake-test-token');
      logs.push(parsed);
      send(201,'application/json',{success:true,data:{...parsed,id:'log-'+logs.length}});
      return;
    }
    send(404,'application/json',{success:false});
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/crm');
    await page.locator('#form [name="email"]').fill('owner@example.test');
    await page.locator('#form [name="password"]').fill('local-test-password');
    await page.locator('#form button').click();
    await page.locator('.log-org').first().waitFor({state:'visible'});
    await page.locator('#outreach-summary').filter({hasText:'0 / 500'}).waitFor();
    await page.locator('.log-org').first().click();
    assert.match(await page.locator('#activity-title').textContent(),/Forlag AS/);
    await page.locator('#activity-form [name="type"]').selectOption('call');
    await page.locator('#activity-form [name="text"]').fill('Snakket med arrangementsansvarlig');
    await page.locator('#activity-save').click();
    await page.locator('#outreach-summary').filter({hasText:'1 / 500'}).waitFor();
    assert.equal(logs[0].accountId,'org-a');
    assert.equal(logs[0].completed,true);
    assert.equal(logs[0].direction,'out');
    await page.locator('.log-org').first().click();
    await page.locator('#activity-form [name="type"]').selectOption('email');
    await page.locator('#activity-form [name="text"]').fill('Sendte personlig oppfølging');
    await page.locator('#activity-save').click();
    await page.locator('#outreach-summary').filter({hasText:'1 / 500'}).waitFor();
    await page.locator('.log-org').nth(1).click();
    await page.locator('#activity-form [name="direction"]').selectOption('in');
    await page.locator('#activity-form [name="text"]').fill('Kunden ringte inn');
    await page.locator('#activity-save').click();
    await page.locator('#outreach-summary').filter({hasText:'1 / 500'}).waitFor();
    assert.equal(logs.length,3);
    assert.deepEqual(errors,[]);
    await page.locator('#logout').click();
    assert.equal(await page.locator('#data').isHidden(),true);
  }finally{
    await browser.close();
    server.close();
    await once(server,'close');
  }
});
