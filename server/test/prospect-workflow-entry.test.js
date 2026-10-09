'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {createStaticServer}=require('../../scripts/serve');

test('Prospekter gives one next action while preserving original advanced tools', {
  timeout:60000
},async t=>{
  const built=path.resolve(__dirname,'../../dist/index.html');
  if(!fs.existsSync(built)){t.skip('Build Salong first');return;}
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(err){t.skip('Chromium unavailable: '+err.message.slice(0,100));return;}
  const server=createStaticServer();
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const page=await browser.newPage({viewport:{width:1380,height:950}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url='http://127.0.0.1:'+server.address().port+'/#prosp';
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200);
    await page.locator('.mt-top .mt-tabs [data-mttab="start"]').waitFor();
    const names=await page.locator('.mt-top .mt-tabs [data-mttab]').allTextContents();
    assert.deepEqual(names.map(s=>s.trim().replace(/\s+\d+$/,'')).slice(0,4),
      ['Start','Arbeidsliste','Målmarked','Kontaktløp']);
    assert.equal(await page.locator('.mt-top [data-mtmodal="batch"]').count(),0,
      'Batch must not compete with the first action');
    assert.equal(await page.locator('.tp-b,[data-tphours]').count(),0,
      'No budgeting or tier settings on the initial screen');
    assert.equal(await page.locator('.ps-flow li').count(),4);
    assert.equal(await page.locator('.ps-focus [data-mtstart]').count(),1);
    assert.match(await page.locator('.ps-footer').textContent(),/eksempelversjon/i);

    const id=await page.locator('.ps-focus [data-mtstart]').getAttribute('data-mtstart');
    assert.ok(id);
    const expected=await page.evaluate(id=>window.__salong.MT.get(id).name,id);
    await page.locator('.ps-focus [data-mtstart]').click();
    await page.locator('#mt-root .bk-dr h2').waitFor();
    assert.equal((await page.locator('#mt-root .bk-dr h2').textContent()).trim(),expected);
    assert.equal(await page.locator('#mt-root .bk-tabs [data-bkt]').count(),4,
      'Original overview, contacts, activities and sources remain');
    assert.ok(await page.locator('#mt-root [data-bkt="kon"]').count());
    await page.locator('#mt-root .bk-dr button.x[data-mtx]').click();
    assert.equal(await page.locator('#mt-root .bk-dr').count(),0);

    const alternatives=page.locator('.ps-other [data-mtstart]');
    // The complete list remains navigable whether or not demo has alternatives.
    const otherButtons=page.locator('button.ps-other[data-mtstart]');
    if(await otherButtons.count()){
      await otherButtons.first().click();
      assert.equal(await page.locator('#mt-root .bk-dr').count(),1);
      await page.locator('#mt-root .bk-dr button.x[data-mtx]').click();
    }
    await page.locator('.mt-top .mt-menu > summary').click();
    const advanced=page.locator('.mt-top .mt-menu');
    assert.ok(await advanced.locator('[data-mttab="pri"]').count());
    assert.ok(await advanced.locator('[data-mttab="str"]').count());
    assert.ok(await advanced.locator('[data-mtmodal="batch"]').count());
    await advanced.locator('[data-mttab="pri"]').click();
    assert.equal(await page.locator('.tp .mt-sec').count(),4);
    assert.equal(await page.locator('[data-tphours]').count(),1);
    await page.locator('.ps-advanced-heading [data-mttab="start"]').click();
    assert.equal(await page.locator('.ps-focus [data-mtstart]').count(),1);

    for(const tab of ['mal','arb','seq','start']){
      await page.locator('.mt-top .mt-tabs [data-mttab="'+tab+'"]').click();
      assert.equal(await page.locator('.mt-top .mt-tabs [data-mttab="'+tab+'"]').getAttribute('aria-pressed'),'true');
    }
    assert.equal(new URL(page.url()).hash,'#prosp');
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{
    await browser.close();
    server.close();await once(server,'close');
  }
});
