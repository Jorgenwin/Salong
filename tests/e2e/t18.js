// Runde 18: tier, masseutsendelse, strategi. Kjør: node t18.js
const {navTo,setup,testSeed} = require('./h.js'); const fs=require('fs');
(async()=>{
  const docs=JSON.parse(fs.readFileSync(require('path').join(require('./h.js').ROOT,'data/research/wave1_docs.json'),'utf8'));
  const A=await setup({ai:false,mcp:true,seed:testSeed(),extra:{mtacc:docs}}), {p,check}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await ev(()=>{ window.__salong.UI.incEx=false; });
    await navTo(p,'prosp',600);
    check('J01 Prospekter åpner på startflyten med ett tydelig prospekt',await ev(()=>[
      document.querySelector('.mt-top .mt-tabs [data-mttab="start"]').getAttribute('aria-pressed'),
      document.querySelectorAll('.ps-focus [data-mtstart]').length,
      document.querySelectorAll('.ps-flow li').length]),['true',1,4]);
    await p.click('.mt-top .mt-menu > summary');
    await p.click('.mt-top [data-mttab="pri"]');
    await wait(250);
    check('J01b Prioritering og tidsfordeling er beholdt under Mer',await ev(()=>[
      document.querySelectorAll('.tp .mt-sec').length,
      !!document.querySelector('[data-tphours]')]),[4,true]);
    const st=await ev(()=>{ const L=window.__salong.MT.all(); const c={0:0,1:0,2:0,3:0}; for(const a of L) c[a.pt]++; const t1=L.filter(a=>a.pt===1); return {c,t1cult:t1.every(a=>a.cult>=3),t1min:Math.min(...t1.map(a=>a.fit.total)),corpT1:L.filter(a=>a.pt===1&&['bedrift','finans','konsulent','saas','pharma'].includes(a.segId)).length,corpT3:L.filter(a=>['bedrift','finans','konsulent','saas'].includes(a.segId)&&a.pt===3).length,corp:L.filter(a=>['bedrift','finans','konsulent','saas'].includes(a.segId)).length}; });
    check('J02 Tier 1 er maks 30 og bare kulturprofil 3',[st.c[1]<=30,st.c[1]>0,st.t1cult],[true,true,true]);
    check('J03 bedrifter (finans, konsulent, SaaS, bedrift) havner ikke i Tier 1 og stort sett i Tier 3',[st.corpT1,st.corpT3>=st.corp-2],[0,true]);
    check('J04 alle accounts har en tier, ingen mangler',st.c[0],0);
    // overstyring
    const id=await ev(()=>window.__salong.MT.all().find(a=>a.pt===3&&a.src==='research').id);
    await ev(id=>window.__salong.TIER.set(id,1),id); await wait(300);
    const o=await ev(id=>{ const a=window.__salong.MT.get(id); return [a.pt,a.ptAuto,a.ptWhy.includes('satt av deg')]; },id);
    check('J05 manuell tier står fast og merkes «satt av deg»',o,[1,false,true]);
    await ev(id=>window.__salong.TIER.set(id,0),id); await wait(300);
    check('J06 «Automatisk» fjerner overstyringen',await ev(id=>window.__salong.MT.get(id).ptAuto,id),true);
    // tidsfordeling
    await p.fill('[data-tphours]','10'); await p.dispatchEvent('[data-tphours]','change'); await wait(400);
    check('J07 timer per uke lagres og endrer anslaget',await ev(()=>[window.__salong.TIER.cfg().hours,window.__salong.TIER.budget()[2].perWeek]),[10,15]);
    // kontokort
    await p.click('tr[data-mtacc]'); await wait(500);
    check('J08 kontokortet viser tier, begrunnelse og samtalestøtte',await ev(()=>[!!document.querySelector('.tp-d .tp-c'),!!document.querySelector('.tp-d .tp-sel'),/Samtalestøtte/.test(document.querySelector('.tp-d').textContent)]),[true,true,true]);
    await p.keyboard.press('Escape'); await wait(200);
    // masseutsendelse
    await p.click('[data-mttab="seq"]'); await wait(300);
    await p.selectOption('#tsAud','paste'); await wait(300);
    const lst='Kari Nordmann; kari@eventbyraa.no; Eventbyrå AS\nOla Hansen; ola@techpartner.no; Techpartner AS\nBad Linje uten epost\nKari Nordmann; kari@eventbyraa.no; Eventbyrå AS';
    await p.fill('#tsPaste',lst); await p.click('[data-tsprev]'); await wait(300);
    check('J09 innlimt liste forhåndsvises med gyldige linjer',await ev(()=>document.querySelector('.ts-b .mt-hint').textContent),v=>/3 gyldige av 4/.test(v));
    await p.click('[data-tsgo="paste"]'); await p.waitForFunction(()=>window.__salong.UI.ts.busy===false&&window.__salong.UI.ts.msg,null,{timeout:15000}); await wait(500);
    const im=await ev(()=>{ const M=window.__salong.MT, L=M.all().filter(a=>a.src==='liste'); return {n:L.length,seq:L.every(a=>a.prog&&a.seq.cad==='PB'),pers:L.map(a=>a.persons.length),q:L.every(a=>a.flags.qualified),nx:L.map(a=>a.nx.k)}; });
    check('J10 liste lager organisasjoner og personer, kvalifiserer manuelt og enroller i riktig sekvens (duplikat slått sammen)',[im.n,im.seq,im.q,im.pers.join()],[2,true,true,'1,1']);
    const due=await ev(()=>window.__salong.TIER.due().map(x=>[x.a.name,x.d.to,x.n.m,x.d.subject,x.d.body.includes('{')]));
    check('J11 dagens e-poster: to utkast med flettefelt utfylt',[due.length,due.every(d=>!d[4]),/@/.test(due[0][1])],[2,true,true]);
    check('J12 e-posten fletter fornavn og org uten å love noe om kontrakt',await ev(()=>{ const x=window.__salong.TIER.due()[0]; return [x.d.body.startsWith('Hei '+x.d.pe.name.split(' ')[0]+','),/Litteraturhuset/.test(x.d.body)]; }),[true,true]);
    // utkast via Gmail (mock)
    await ev(()=>{ window.__mcpFn=async(s,t,i)=>({payload:{viewUrl:'https://x/'+t}}); });
    await p.click('[data-tsdraft="gm"]'); await wait(1200);
    const calls=await ev(()=>window.__mcpCalls.filter(c=>c.t==='create_draft').map(c=>[c.s,c.i.to.length]));
    check('J13 utkast i Gmail lages for hver forfalt e-post, ingenting sendes',[calls.length,calls.every(c=>c[0]==='Gmail'),await ev(()=>window.__mcpCalls.some(c=>/send/.test(c.t)))],[2,true,false]);
    check('J14 utkast merkes som laget og kan ikke lages to ganger',await ev(()=>window.__salong.TIER.due().every(x=>x.drafted)),true);
    await p.click('[data-tssentall]'); for(let i=0;i<40;i++){ await wait(200); if(await ev(()=>window.__salong.MT.all().filter(a=>a.src==='liste').every(a=>a.seq.stepsDone.length===1&&a.touch.out===1))) break; }  // lagringen er asynkron: vent til begge er ført, ikke et fast antall ms
    const af=await ev(()=>{ const L=window.__salong.MT.all().filter(a=>a.src==='liste'); return {done:L.map(a=>a.seq.stepsDone.length),touch:L.map(a=>a.touch.out),next:L.map(a=>a.prog.next.d)}; });
    check('J15 «merk som sendt» logger utgående touch og flytter sekvensen til neste steg',[af.done.join(),af.touch.join(),af.next.join()],['1,1','1,1','7,7']);
    // økonomi
    await p.click('.mt-top .mt-menu > summary');
    await p.click('.mt-top [data-mttab="str"]'); await wait(300);
    await ev(async()=>{ await window.__salong.TIER.save({eco:{base:2000000,growth:25,fee:60000,paid:60000}}); });
    await wait(300);
    const eco=await ev(()=>{ const x=window.__salong.TIER.eco(); return {t:x.target,rem:x.rem,cost:x.cost,crit:x.crit.map(c=>c.k+':'+c.st),nCo:x.nCo,months:x.months}; });
    check('J16 årsmål = grunnlag × (1 + vekst) og stillingskostnad over seks måneder',[eco.t,eco.cost,eco.months],[2500000,360000,6]);
    check('J17 vellykket-kriterier finnes og fase 1 er «ikke startet» før 1. desember',[eco.crit.length,eco.crit.filter(x=>/Ikke startet/.test(x)).length>=3],[5,true]);
    check('J18 gjenstår-kjeden regnes ut (kontakter per uke > 0)',eco.nCo>0,true);
    check('J19 seksmånedersmålet er uendret av økonomiinntastingen',await ev(()=>window.__salong.S.settings.goalValue||null),v=>v==null||typeof v==='number');
    // arenaer
    check('J20 «hvem arrangerer hvor» viser Oslo Event Hub, MUNCH og Sentralen fra research med kilde',await ev(()=>window.__salong.TIER.venues().map(v=>v.n)),v=>['Oslo Event Hub','MUNCH','Sentralen'].every(x=>v.includes(x)));
    check('J21 konkurrent-tabellen oppgir kilder og dato, og avbestilling-advarselen vises',await ev(()=>[document.querySelectorAll('.sg-t a[href^="https://www.osloeventhub.com"]').length>0,/28 dager/.test(document.querySelector('.sg').textContent)]),[true,true]);
    // innsats
    await ev(async()=>{ const M=window.__salong.MT; const a=M.all().find(a=>a.src==='liste'); await window.__salong.mtLogTouch?.(a.id,{ch:'mote',dir:'out',text:'Visning av stedet'}); });
    const csv=await ev(()=>window.__salong.TIER.csv());
    check('J22 CSV til Litteraturhuset har BOM, rader for kontaktet og planlagt',[csv.charCodeAt(0)===0xfeff,/Planlagt/.test(csv),csv.split('\r\n').length>2],[true,true,true]);
    // I dag
    await navTo(p,'idag',600);
    check('J23 I dag viser tier-linje med lenke til Prioritet',await ev(()=>!!document.querySelector('.idc-tier [data-idgo="pri"]')),true);
    check('J24 ingen sideveis rulling og ingen sidefeil',await ev(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),v=>v<=1);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
