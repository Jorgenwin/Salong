'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {createStaticServer}=require('../../scripts/serve');

test('Prospekter leads with a short why-now and hides source details until opened', {
  timeout:60000
}, async t=>{
  const built=path.resolve(__dirname,'../../dist/index.html');
  if(!fs.existsSync(built)){t.skip('Run npm run build first');return;}
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(err){t.skip('Chromium not available: '+err.message.slice(0,75));return;}
  const server=createStaticServer();
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const page=await browser.newPage({viewport:{width:1250,height:900}});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const base='http://127.0.0.1:'+server.address().port;
    const response=await page.goto(base+'/#prosp',{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200);
    await page.locator('.mt-top .mt-tabs [data-mttab="pri"]').waitFor();
    const chosen=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('#view tr[data-mtacc]')];
      for(const row of rows){
        const id=row.dataset.mtacc;
        const a=window.__salong.MT.get(id);
        if(a&&a.why&&a.why.length>85&&a.pt) return {id,why:a.why,score:a.ptScore};
      }
      return null;
    });
    assert.ok(chosen,'Fixture needs one Tier account with a detailed why-now');
    await page.locator('#view tr[data-mtacc="'+chosen.id+'"]').first().click();
    await page.locator('#mt-root .tp-d').waitFor();

    // All of the original functionality remains. Method internals are
    // neither pasted into the top-level card nor used as user-facing copy.
    const priority=page.locator('#mt-root .tp-d');
    assert.ok(await priority.locator('[data-tpset]').count());
    assert.ok(await priority.getByText('Samtalestøtte').count());
    const intro=await priority.locator('.tp-summary').textContent();
    assert.ok(intro.length>10&&intro.length<145,intro);
    assert.doesNotMatch(intro,/kulturprofil\s*\d|fit\s*\d|score\s*\d|satt automatisk/i);
    assert.doesNotMatch(await priority.locator('.tp-dh').textContent(),/score\s*\d/i);

    const summary=await page.locator('#mt-root .ov-why-summary').textContent();
    assert.ok(summary.length>10&&summary.length<=141,summary);
    assert.ok(/[.!?…]$/.test(summary),summary);
    assert.notEqual(summary.trim(),chosen.why.trim(),'Reason should be a short lead');
    const reveal=page.locator('#mt-root .ov-why-more');
    assert.equal(await reveal.count(),1);
    assert.equal(await reveal.getAttribute('open'),null,'Details must start closed');
    assert.equal(await page.locator('#mt-root .ov-why-body').isVisible(),false);
    await reveal.locator('summary').click();
    assert.equal(await page.locator('#mt-root .ov-why-body').isVisible(),true);
    const body=await page.locator('#mt-root .ov-why-body').textContent();
    assert.ok(body.includes(chosen.why),'Original researched context must remain available');
    assert.ok(await page.locator('#mt-root .ov-why-body [data-bkt="kil"]').count(),
      'Source tab must remain reachable');

    assert.ok(!await priority.locator('option').allTextContents().then(
      labels=>labels.some(x=>x.includes('score'))));
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{
    await browser.close();
    server.close();await once(server,'close');
  }
});
