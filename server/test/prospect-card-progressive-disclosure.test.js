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
    await page.locator('.mt-top .mt-tabs [data-mttab="start"]').waitFor();
    await page.locator('.mt-top .mt-menu > summary').click();
    await page.locator('.mt-top .mt-menu [data-mttab="pri"]').click();
    await page.locator('.tp .mt-sec').first().waitFor();
    const chosen=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('#view tr[data-mtacc]')];
      for(const row of rows){
        const id=row.dataset.mtacc;
        const a=window.__salong.MT.get(id);
        if(a&&a.why&&a.why.length>85&&a.pt){
          const active=a.active.filter(p=>!p.general)[0]||a.active.find(p=>p.general);
          const needsContact=!active||active.general||(!active.email&&!active.phone);
          const canRun=!(a.es&&a.es.running)&&!a.flags.disqualified&&!a.dncAcc&&a.nx.k!=='deal';
          return {id,why:a.why,score:a.ptScore,
            history:a.profile&&a.profile.lhHistory||'',
            showsContactEnrich:needsContact&&canRun,
            showsHeaderEnrich:a.nx.k==='enrich'&&!(a.job&&['running','queued'].includes(a.job.status))};
        }
      }
      return null;
    });
    assert.ok(chosen,'Fixture needs one Tier account with a detailed why-now');
    await page.locator('#view tr[data-mtacc="'+chosen.id+'"]').first().click();
    await page.locator('#mt-root .tp-d').waitFor();

    // All of the original functionality remains. Method internals are
    // neither pasted into the top-level card nor used as user-facing copy.
    // The priority is a tiny badge adjacent to the organization name,
    // with settings and the existing call script available only when opened.
    const priority=page.locator('#mt-root .tp-heading .tp-d');
    assert.equal(await priority.count(),1);
    assert.equal(await page.locator('#mt-root .bk-body .tp-d').count(),0,
      'No oversized Tier panel in the overview');
    const chip=await priority.boundingBox();
    assert.ok(chip&&chip.height<=31,'Closed Tier badge must be compact');
    assert.equal(await priority.locator('.tp-inline-panel').isVisible(),false);
    await priority.locator('summary.tp-inline-trigger').click();
    assert.equal(await priority.locator('.tp-inline-panel').isVisible(),true);
    assert.ok(await priority.locator('[data-tpset]').count());
    assert.ok(await priority.getByText('Samtalestøtte').count());
    const intro=await priority.locator('.tp-summary').textContent();
    assert.ok(intro.length>10&&intro.length<145,intro);
    assert.doesNotMatch(intro,/kulturprofil\s*\d|fit\s*\d|score\s*\d|satt automatisk/i);
    assert.doesNotMatch(await priority.locator('.tp-dh').textContent(),/score\s*\d/i);
    await priority.locator('summary.tp-inline-trigger').click();

    const headings=await page.locator('#mt-root .bk-body .ov-r>h3').allTextContents();
    assert.deepEqual(headings,['Hvorfor nå','Kontekst','Kontakt']);
    const contextLabels=await page.locator('#mt-root .ov-context-label').allTextContents();
    assert.deepEqual(contextLabels,['Virksomhet','Historikk']);
    assert.equal(await page.locator('#mt-root .ov-context-line').count(),2);
    if(chosen.history) assert.ok(
      (await page.locator('#mt-root .ov-context-line').nth(1).textContent()).includes(
        chosen.history.replace(/\s+/g,' ').slice(0,20)),
      'Original Litteraturhuset history must appear in Context');
    if(chosen.showsContactEnrich){
      const contactEnrich=page.locator('#mt-root .ov-r:nth-child(3) [data-bk="berik"]');
      assert.equal(await contactEnrich.count(),1);
      assert.match(await contactEnrich.textContent(),/Berik kontakt/);
    }
    assert.doesNotMatch(await page.locator('#mt-root .dh-t .o').textContent(),/\bFit\s*\d|\bP[012]\b/);
    const summary=await page.locator('#mt-root .ov-why-summary').textContent();
    assert.ok(summary.length>10&&summary.length<=141,summary);
    assert.ok(/[.!?…]$/.test(summary),summary);
    assert.notEqual(summary.trim(),chosen.why.trim(),'Reason should be a short lead');
    const size=await page.locator('#mt-root .ov-why-summary').evaluate(
      el=>Number.parseFloat(getComputedStyle(el).fontSize));
    assert.ok(size>=12&&size<=14.5,'Why-now should use normal text size, got '+size);
    const reveal=page.locator('#mt-root .ov-why-more');
    assert.equal(await reveal.count(),1);
    assert.equal(await reveal.locator('summary').getAttribute('aria-label'),'Se begrunnelse og kilder');
    assert.equal((await reveal.locator('summary').textContent()).trim(),'i');
    const infoBox=await reveal.locator('summary').boundingBox();
    assert.ok(infoBox&&infoBox.width<=30&&infoBox.height<=30,'Reason toggle must be a tiny info button');
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
    const details=page.locator('#mt-root .ov-context-extra');
    if(await details.count()){
      assert.equal(await details.locator('.ov-context-details').isVisible(),false);
      await details.locator('summary').click();
      assert.equal(await details.locator('.ov-context-details').isVisible(),true);
      await details.locator('summary').click();
    }
    assert.equal(await page.locator('#mt-root .bk-body .ov-r>h3').count(),3,
      'Beriking must not be duplicated as a fourth overview row');
    assert.deepEqual(errors,[]);
    await page.close();
  }finally{
    await browser.close();
    server.close();await once(server,'close');
  }
});
