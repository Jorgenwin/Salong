'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {createStaticServer}=require('../../scripts/serve');

test('main Salong Dockerfile still serves the complete original application',()=>{
  const docker=fs.readFileSync(path.join(__dirname,'../../Dockerfile.demo'),'utf8');
  const build=fs.readFileSync(path.join(__dirname,'../../src/build.py'),'utf8');
  assert.match(docker,/CMD \["node","scripts\/serve\.js"\]/);
  assert.doesNotMatch(docker,/gateway\.js/);
  assert.match(build,/p25\.css/);
});

test('Prospekter retains every original view and provides clear tab guidance', {
  timeout:60000
}, async t=>{
  const built=path.resolve(__dirname,'../../dist/index.html');
  if(!fs.existsSync(built)){t.skip('Build Salong first');return;}
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(e){t.skip('Chromium unavailable: '+e.message.slice(0,80));return;}
  const server=createStaticServer();
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/#prosp',{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200);
    await page.locator('#nav button[data-view="prosp"]').waitFor();
    assert.equal(await page.locator('#vt').textContent(),'Prospekter');
    const views=await page.locator('#nav button[data-view]').evaluateAll(
      nodes=>nodes.map(node=>node.getAttribute('data-view')));
    for(const key of ['idag','kontakter','prosp','innboks','pipeline','kalender',
      'stat','tilbud','maler','prognose','om','data']){
      assert.ok(views.includes(key),'Missing original Salong view: '+key);
    }
    assert.ok(views.length>=12,'No original Salong navigation item should disappear');
    assert.equal(await page.locator('.mt-top .mt-tabs [data-mttab]').count(),4,
      'Four clear workflow sections are visible; planning lives in More');
    assert.equal(await page.locator('.mt-top .mt-tabs [data-mttab="start"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.ps-flow li').count(),4);
    assert.equal(await page.locator('.ps-focus [data-mtstart]').count(),1);
    assert.equal(await page.locator('.tp-b').count(),0,'Time budgeting must not be the landing view');
    await page.locator('.mt-top .mt-tabs [data-mttab="mal"]').click();
    assert.match(await page.locator('.mt-guide').textContent(),/velg selskaper/i);
    await page.locator('.mt-top .mt-tabs [data-mttab="arb"]').click();
    assert.match(await page.locator('.mt-guide').textContent(),/Følg opp aktive prospekter/);
    assert.match(await page.locator('#mode').textContent(),/demo|lagres ikke/i);
    assert.equal(new URL(page.url()).pathname,'/','The familiar URL must not redirect to the reduced CRM');
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{
    await browser.close();
    server.close();await once(server,'close');
  }
});
