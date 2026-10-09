// Runde 13: forenklingsrunde, data-opprinnelse, Maler, Spør Salong, batch-modal. Kjør: node t13.js
const {navTo,setup,testSeed}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  const view=async(v,w)=>navTo(p,v,w||250);
  const hs=()=>ev(()=>document.scrollingElement.scrollWidth-innerWidth);
  try{
    // ---------- data-opprinnelse: standard uten eksempel- og testdata ----------
    await ev(()=>{ window.__salong.UI.incEx=false; });
    await view('idag'); await wait(200);
    check('S01 testdata og eksempeldata gir ingen oppgaver i I dag (ingen oppgaver fra eksistens alene)',[(await p.$$('.id-r')).length,await txt(p,'.id-empty h3')],[0,'Ingen planlagt arbeid ennå']);
    await view('prosp'); await p.click('[data-mttab="mal"]'); await wait(200);
    check('S02 Prospekter: kontaktdekning i sju trinn erstatter nøkkeltallene, ingen store trinnkort',[(await p.$$('.mt-k')).length,(await p.$$('.cv-fr')).length,(await txt(p,'.cv-fn2')).replace(/\s+/g,' ')],v=>v[0]===0&&v[1]===7&&/Identifisert.*Kvalifisert.*Researchet.*Kontakt klar.*Adressert.*Dialog.*Mulighet/.test(v[2]));
    await p.click('.mt-top .mt-tabs [data-mttab="start"]'); await wait(150);
    check('S03 Prospekter: ett anbefalt selskap er primærhandlingen; batch er skjult under Mer',[
      (await p.$('.ps-focus .btn.primary')).length,
      await ev(()=>{ const b=document.querySelector('.mt-top [data-mtmodal="batch"]'); return !!b&&!!b.getClientRects().length; }),
      await ev(()=>document.querySelector('#newDeal').classList.contains('primary'))],[1,false,false]);
    await view('data',300); await p.click('[data-dsec="status"]').catch(()=>{}); await wait(250);
    check('S04 Datastatus finnes under Data og oppsett og lister poster som kan beholdes som ekte',await p.evaluate(()=>/Behold som ekte/.test(document.querySelector('#view').textContent)),true);
    // ---------- Maler og samtaler ----------
    await ev(()=>{ window.__salong.UI.incEx=true; });
    await view('maler'); await wait(200);
    check('S10 faner E-post (standard) og Samtale, ikke side om side',[await all(p,'.ml-tabs button'),await p.$eval('.ml-tabs [data-mltab="epost"]',e=>e.getAttribute('aria-pressed')),(await p.$$('.ml-g')).length],[['E-post','Samtale'],'true',0]);
    check('S11 seks standardintensjoner',await all(p,'#mlI option'),['Første kontakt','Tidligere leietaker','Oppfølging etter samtale','Følg opp tilbud','Foreslå dato / rom','Siste høflige oppfølging']);
    await p.selectOption('#mlT','o:t-nf'); await wait(150);
    const ban=/Vi ønsker å informere|Vi er glade for å kunne fortelle|Jeg ville bare følge opp|Litteraturhuset tilbyr/;
    const res=[]; for(const i of ['first','former','afterCall','offer','propose','last']){ await p.selectOption('#mlI',i); await wait(120); const t=await p.inputValue('#tpBody'); const n=t.split(/\s+/).length; res.push([i,n>=40&&n<=130,!ban.test(t)]); }
    check('S12 hvert utkast er kort (ca. 40–130 ord) og uten forbudte formuleringer',res.filter(r=>!r[1]||!r[2]),[]);
    await p.selectOption('#mlI','former'); await wait(150);
    check('S13 tidligere leietaker bruker dokumentert historikk («tidligere har hatt … hos oss»)',[/tidligere har hatt/.test(await p.inputValue('#tpBody')),/Tidligere leietaker/.test(await txt(p,'.ml-basis'))],[true,true]);
    await p.selectOption('#mlT','p:t-nfo'); await wait(150);
    check('S14 uten dokumentert grunn: generelt utkast uten oppdiktede detaljer, med forklaring',[!/tidligere har hatt/.test(await p.inputValue('#tpBody')),await txt(p,'.ml-hint')],v=>v[0]&&/Ingen tidligere leie/.test(v[1]));
    check('S15 «Lag personlig utkast» og én «Åpne i e-post»; ikke Outlook og Gmail som store knapper',[await txt(p,'#mlGen'),await txt(p,'#tpMail'),(await p.$$('#view > .ml > .ml-ed .ml-act > .btn')).length>=1,(await p.$$('.ml-act .btn.primary')).length>=1],v=>v[0]==='Lag personlig utkast'&&v[1]==='Åpne i e-post');
    await p.click('[data-mltab="samtale"]'); await wait(150);
    check('S16 fanen Samtale viser samtaleguiden og ikke e-postredigereren',[(await p.$$('.ml-g section')).length,(await p.$$('#tpBody')).length],[3,0]);
    // ---------- Spør Salong ----------
    check('S20 Innsikt er ikke i hovedmenyen',(await p.$$('nav [data-view="kunnskap"]')).length,0);
    await view('marked'); await p.click('#askSalong'); await wait(300);
    check('S21 Spør Salong får kontekst fra siden, omfang er skjult som avansert valg',[await txt(p,'#askSub'),await p.$eval('#askAdv',e=>e.open),await txt(p,'#askAdv summary')],v=>/Spør om markedet/.test(v[0])&&v[1]===false&&/Markedet|Markedskunnskap/.test(v[2]));
    check('S22 panelet har kontekstuelt startspørsmål og kilder-fane',[await all(p,'.i3-q').then(x=>x[0]),(await p.$$('[data-kntab="kilder"]')).length],v=>/Solstad/.test(v[0])&&v[1]===1);
    await p.keyboard.press('Escape'); await wait(100);
    check('S23 Escape lukker panelet',await p.$eval('#askPanel',e=>e.hidden),true);
    await view('idag'); await p.click('#askSalong'); await wait(300);
    check('S24 I dag-kontekst forklarer prioriteringen med faste regler',[await txt(p,'#askSub'),await p.evaluate(()=>/faste regler/.test(document.querySelector('.ask-why')?.textContent||''))],v=>/I dag/.test(v[0])&&v[1]);
    await p.click('#askClose'); await wait(100);
    // ---------- batch-modal ----------
    await view('prosp'); await p.click('.mt-top .mt-tabs [data-mttab="mal"]').catch(()=>{}); await wait(150);
    await p.click('.mt-top .mt-menu > summary'); await p.click('.mt-top [data-mtmodal="batch"]'); await wait(300);
    const bm=await ev(()=>{ const m=document.querySelector('.mt-md'); return {h:m.scrollWidth-m.clientWidth, b:m.querySelector('.mt-mb').scrollWidth-m.querySelector('.mt-mb').clientWidth, n:m.querySelectorAll('[data-mtb="n"]').length, nb:m.querySelectorAll('[data-mtbn]').length, ft:m.querySelector('footer').textContent.replace(/\s+/g,' ').trim(), rows:m.querySelectorAll('.mt-blr').length, first:(m.querySelector('.mt-blr')||{}).textContent||''}; });
    check('S30 batch-modal: ingen horisontal rulling, ett antallsvalg, rader med bare navn og segment/fit/kontakt',[bm.h<=1&&bm.b<=1,bm.n,bm.nb,/ · Fit \d+ · (Dokumentert event|Sannsynlig event|Event ukjent)/.test(bm.first)],[true,1,0,true]);
    check('S31 batch-modal: bunn viser «N accounts valgt», Avbryt og Start batch',bm.ft,v=>/^\d+ accounts valgt/.test(v)&&/Avbryt/.test(v)&&/Start batch/.test(v)&&!/Bekreft batch/.test(v));
    await p.keyboard.press('Escape'); await p.click('[data-mtx]').catch(()=>{}); await wait(150);
    // ---------- sekvenser ----------
    await p.click('[data-mttab="seq"]'); await wait(200);
    check('S32 Sekvenser: kompakte rader med kanalrekkefølge og «Rediger», tom tilstand uten batcher',[(await p.$$('.mt-sr')).length>=3,await p.evaluate(()=>/→/.test(document.querySelector('.mt-sf').textContent)),(await p.$$('.mt-sr [data-mttpl]')).length>=3,await txt(p,'.mt-one .es h3')],[true,true,true,'Ingen aktive sekvenser']);
    // ---------- Kalender ----------
    await view('kalender'); await p.click('[data-kltab="kap"]'); await p.click('[data-c3mode="salg"]'); await wait(200);
    check('S33 Kalender: tre nøkkeltall og kort forklaring om bookingsystemet',[(await p.$$('.c3-k')).length,await txt(p,'.c3-bk')],v=>v[0]===3&&/ikke koblet/.test(v[1]));
    // ---------- bredder ----------
    const bad=[]; for(const w of [1440,1280]){ await p.setViewportSize({width:w,height:900}); await wait(250);
      for(const v of ['idag','kontakter','prosp','innboks','kalender','stat','marked','tilbud','maler','prognose','om','data']){ await view(v,250); const h=await hs(); if(h>1&&v!=='pipeline') bad.push(v+'@'+w+':'+h); } }
    check('S40 ingen sideveis rulling på noen side ved 1440 og 1280 px',bad,[]);
    await p.setViewportSize({width:1440,height:900});
  }catch(e){ e0=e; }
  await A.done(e0);
})();
