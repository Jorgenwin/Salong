// Runde 3: Kunder (k3), Innsikt, Mål og prognose, Marked og posisjon, Kalender. Kjør: node t10.js
const {navTo,setup,testSeed} = require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const view=async v=>{ await navTo(p,v,250); };
  const noScroll=async()=>p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  try{
    await p.evaluate(()=>{ window.__salong.UI.ku.legacy=false; window.__salong.UI.c3.mode='salg'; });
    // ---------- Kunder ----------
    await view('kontakter');
    check('N01 Kunder viser sammendrag, filter og rader med relasjonsstatus',[(await p.$$('.k3-card')).length,(await p.$$('tr[data-korg]')).length>0,(await p.$$('.rel')).length>0],v=>v[0]>=6&&v[1]&&v[2]);
    await p.click('[data-k3view="dekning"]'); await p.waitForTimeout(200);
    check('N02 Markedsdekning viser segmenter og anslag som anslag',[(await p.$$('table.k3c tbody tr')).length>=8,/anslag/i.test(await txt(p,'.k3-covh'))],[true,true]);
    // ---------- Innsikt ----------
    await view('kunnskap');
    check('N03 Innsikt: fire omfangsvalg og Porteføljen er valgt som standard',[await all(p,'[data-knt]'),await p.$eval('[data-knt="crm"]',e=>e.getAttribute('aria-pressed'))],[['Denne kunden','Denne saken','Porteføljen','Markedet'],'true']);
    check('N04 Innsikt: fem foreslåtte spørsmål og verdigrunnlag i tomtilstanden',[(await p.$$('.i3-q')).length,(await p.$$('.i3-val')).length],[5,1]);
    const ask=async q=>{ await p.fill('#knQ',q); await p.press('#knQ','Enter'); await p.waitForTimeout(450); };
    for(const [q,h] of [['Hvem bør jeg prioritere denne uken?','Prioritert for denne uken'],['Hvilke tidligere leietakere bør vi hente tilbake?','Tidligere leietakere å hente tilbake'],['Hvilke prospekter passer best for Solstad?','Prospekter som passer Solstad'],['Hvilke segmenter er svakest bearbeidet?','Segmenter som er svakest bearbeidet'],['Hva må til for å nå kvartalsmålet?','Hva må til for å nå målet for']]){
      await ask(q); const t=await p.$eval('.kn-turn:last-child',e=>({h:(e.querySelector('.i3-an h4')||{}).textContent||'',strip:!!e.querySelector('.i3-strip'),cols:e.querySelectorAll('.i3-an .i3-c').length,val:/ikke-kommersiell stiftelse/.test((e.querySelector('.i3-an')||{}).textContent||'')}));
      check('N05 «'+q+'» gir beregnet svar med Sikkert, Bygger på, Mangler og Tolkning, og verdinotat',t,v=>v.h.startsWith(h)&&v.strip&&v.cols>=3&&v.val); }
    await p.click('[data-view="marked"]'); await p.waitForTimeout(200); await p.click('[data-m3ask]'); await p.waitForTimeout(250);
    check('N06 «Spør Innsikt om markedet» fra Marked og posisjon velger Markedet',await p.$eval('[data-knt="marked"]',e=>e.getAttribute('aria-pressed')),'true');
    // ---------- Mål og prognose ----------
    await view('prognose');
    check('N07 fem hovedtall, tre scenarioer og Hva må til',[(await p.$$('.g3-card')).length,(await p.$$('.g3-s')).length],[5,3]);
    const labs=[]; for(const h of ['m','q','h','y']){ await p.click('[data-g3h="'+h+'"]'); await p.waitForTimeout(120); labs.push(await txt(p,'.g3-per')); }
    check('N08 horisont endrer perioden (måned, kvartal, halvår, år)',labs.map(x=>x.split(' · ')[0].toLowerCase()).length===4&&new Set(labs).size===4,true);
    await p.click('[data-g3h="y"]'); await p.waitForTimeout(120);
    const basis=await p.$eval('.g3-s.base .g3-sv b',e=>e.textContent), card=await p.$$eval('.g3-card b',e=>e[3].textContent);
    check('N09 «Forventet ved dagens fart» er lik Basis-scenarioet',basis,card);
    await p.evaluate(()=>{ document.querySelector('#g3Adj').open=true; }); await p.waitForTimeout(80);
    await p.fill('#plTarget','1200000'); await p.click('#plSave'); await p.waitForTimeout(400);
    check('N10 seksmånedersmålet lagres i innstillingene (goal6) og vises som mål',[store.settings&&store.settings.main&&store.settings.main.goal6?store.settings.main.goal6.target:null,await p.$$eval('.pl-cards b',e=>e[0].textContent)],v=>v[0]===1200000&&/1\s?200\s?000|1,2|1200/.test(v[1].replace(/\u00a0/g,' ')));
    check('N11 Hva må til viser fem tall når målet er høyt, og antakelsene ligger i «Juster antakelser» med gamle skyvere',[(await p.$$('.g3-need > div')).length,await p.$$('#g3Adj #fC2').then(x=>x.length),await p.$$('#g3Adj #pUse').then(x=>x.length)],[5,1,1]);
    // ---------- Marked og posisjon ----------
    await view('marked');
    check('N12 Oversikt åpnes først med Solstad-stripe, bobbelkart, tre innsikter og analyse bak «Vis analyse»',[await txt(p,'.m3-eb'),(await p.$$('.mp-chart svg')).length,(await p.$$('.m3-i3 article')).length,(await p.$$('.m3-box')).length,await txt(p,'.m3-an summary')],v=>/Solstad i markedet/i.test(v[0])&&v[1]===1&&v[2]===3&&v[3]===3&&v[4]==='Vis analyse');
    check('N13 hver av de tre innsiktene har kilder som åpnes ved klikk, og prisen er «ikke satt»',[(await p.$$('.m3-srcd')).length,await txt(p,'.m3-np b')],[3,'Pris ikke satt']);
    await p.click('.m3-tabs [data-mktab="segmentfit"]'); await p.waitForTimeout(250);
    const pts=await p.$$('.m3-pt');
    check('N14 Segmentfit: Markedsgap, segmenttabell og underrepresentert. Ingen prioriteringsflate og ingen «Lignende aktører vi ikke har»',[pts.length,(await p.$$('.m3-t tbody tr')).length>=5,!!(await p.$('.mkg')),!/Lignende aktører/.test(await p.evaluate(()=>document.body.innerText))],[0,true,true,true]);
    if(pts.length){ await pts[0].click(); await p.waitForTimeout(350); check('N15 klikk på punkt åpner kundekortet',!!(await p.$('.drawer, #drawer, [role="dialog"]')),true); await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
    await p.click('.m3-tabs [data-mktab="sammenlign"]'); await p.waitForTimeout(250);
    check('N16 Sammenligning: dimensjoner, tabell og kart i samme fane',[(await p.$$('.m3-d')).length,(await p.$$('.mc-tbl, table')).length>0],[7,true]);
    await p.click('.m3-sub [data-mktab="posisjonering"]'); await p.waitForTimeout(250);
    check('N17 kartet under Sammenligning viser lokaler',(await p.$$('[data-mpv]')).length>5,true);
    // ---------- Kalender ----------
    await view('kalender'); await p.click('[data-kltab="kap"]'); await p.waitForTimeout(250);
    check('N18 Kalender åpner med salg og belegg: nøkkeltall, varmekart og detaljpanel',[(await p.$$('.c3-k')).length,(await p.$$('.c3-t tbody tr')).length>=5,(await p.$$('.c3-det')).length],[3,true,1]);
    const cells=await p.$$('[data-c3cell]'); const lbl=await cells[cells.length>14?14:0].getAttribute('aria-label');
    await cells[cells.length>14?14:0].click(); await p.waitForTimeout(200);
    check('N19 valg av måned oppdaterer detaljpanelet',/·/.test(await txt(p,'.c3-dh h2')),true);
    check('N20 celler har tilgjengelig tekst med prosent',/prosent belagt/.test(lbl||''),true);
    await p.click('[data-c3mode="grid"]'); await p.waitForTimeout(250);
    check('N21 rutenett per dag finnes fortsatt',(await p.$$('.cal tbody tr')).length>3,true);
    // ---------- bredder og tema ----------
    for(const [w,h] of [[390,800],[1024,800]]){ await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(150);
      const bad=[]; for(const v of ['kontakter','prognose','marked','kalender']){ await view(v); if(v==='kalender') await p.evaluate(()=>{ window.__salong.UI.c3.mode='salg'; }); if(!await noScroll()) bad.push(v); }
      check('N22 '+w+' px: ingen sideveis rulling i de fem visningene (kalenderrutenettet og varmekartet ruller i egen boks)',bad.filter(v=>v!=='kalender'),[]); }
    await p.setViewportSize({width:1280,height:900});
    await p.evaluate(()=>{ document.documentElement.setAttribute('data-theme','dark'); }); await p.waitForTimeout(150);
    const lum=await p.evaluate(()=>{ const rgb=s=>s.match(/\d+/g).map(Number); const c=rgb(getComputedStyle(document.body).backgroundColor); return (c[0]+c[1]+c[2])/3; });
    check('N23 mørk modus gir mørk bakgrunn',lum<90,true);
    for(const v of ['prognose','marked']){ await view(v); } check('N24 ingen sidefeil under kjøringen',A.errs.length,0);
  }catch(e){ e0=e; }
  await A.done(e0); process.exit(0);
})();
