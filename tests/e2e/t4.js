// Trinn 1 (runde 2): Kunder-siden, hurtigfilter og tildeling i listen. Kjør: node t4.js
const {navTo,setup,testSeed} = require('./h.js');
(async()=>{
  const A=await setup({ai:false,users:[{id:'u1',name:'Jørgen Test'},{id:'u2',name:'Phillip Test'}]}), {store,check,txt,all,remote}=A, [p,p2]=A.pages; let e0=null;
  const view=async(pg,v)=>{ await navTo(pg,v,180); };
  const ids=pg=>pg.$$eval('tr[data-korg]',e=>e.map(x=>x.dataset.korg));
  try{
  await p.selectOption('#actAs','m-jorgen'); await p2.selectOption('#actAs','m-phillip'); await view(p,'kontakter'); await p.click('[data-kst="alle"]'); await p.waitForTimeout(150);
  check('K01 viktigste kolonner først, sekundære sist og nedtonet',await p.$$eval('table.k2 thead th',e=>e.map(x=>x.textContent.trim()+(x.classList.contains('dim')?'*':'')).filter(Boolean)),['Organisasjon','Status','Kundeansvarlig','Neste steg','Åpne saker','Forbruk 2025*','Siste dialog*']);
  check('K02 organisasjonsnavn er sterkest, sekundærtekst svakere',await p.evaluate(()=>{ const r=document.querySelector('tr[data-korg="t-nf"]'), a=getComputedStyle(r.querySelector('.on')), b=getComputedStyle(r.querySelector('.sub2')); return [+a.fontWeight>=600,parseFloat(a.fontSize)>parseFloat(b.fontSize),a.color!==b.color]; }),[true,true,true]);
  check('K03 status er rolig tekst, prioritet har eget uttrykk',await p.evaluate(()=>{ const q=s=>[...document.querySelectorAll(s)].map(x=>getComputedStyle(x).backgroundColor); const f=q('.chip.stt.fast')[0]; const t=q('.tier')[0]; return [!!f,f==='rgba(0, 0, 0, 0)',!!document.querySelector('.tier'),!!t]; }),[true,true,true,true]);
  check('K04 sticky tabellhode og nøkkeltall i egen rad over filtrene',await p.evaluate(()=>[getComputedStyle(document.querySelector('.ku-tbl th')).position,document.querySelectorAll('.ku-kpi .ku-t').length,document.querySelector('.ku-kpi').getBoundingClientRect().bottom<=document.querySelector('.ku-bar').getBoundingClientRect().top]),['sticky',5,true]);
  const nAll=(await ids(p)).length;
  check('K05 «Ufordelte» teller kunder uten kundeansvarlig, og kan vises med ett klikk',[await txt(p,'.ku-t:last-child dd'),await all(p,'.ownseg button')],[String(nAll),['Mine','Jørgen','Phillip','Ufordelte','Alle']]);
  // tildeling direkte i listen
  await p.selectOption('[data-kown="t-nf"]','m-jorgen'); await p.waitForTimeout(700);
  check('K06 tildeling i listen lagrer kundeansvarlig med logg',[store.orgs['t-nf'].ownerId,Object.values(store.audit).filter(a=>a.entityId==='t-nf'&&a.changes.some(c=>c.f==='ownerId')).map(a=>a.byName+' | '+a.action),await txt(p,'#toast-root')],['m-jorgen',['Jørgen Test | endret kundeansvarlig'],'Kundeansvarlig er nå Jørgen.']);
  check('K06 klikk i tildelingsfeltet åpner ikke kundekortet',!!(await p.$('.drawer')),false);
  await p.click('[data-own="mine"]'); await p.waitForTimeout(150); check('K07 filter Mine',await ids(p),['t-nf']);
  await p.click('[data-own="m-phillip"]'); await p.waitForTimeout(150); check('K07 filter Phillip',await ids(p),[]);
  await p.click('[data-own="ufordelt"]'); await p.waitForTimeout(150); check('K07 filter Ufordelte',(await ids(p)).length,nAll-1);
  await p.click('[data-own="alle"]'); await p.waitForTimeout(150);
  // prospekt som bare finnes som profil
  const virt=await p.evaluate(()=>{ const S=__salong.S; return [...document.querySelectorAll('tr[data-korg]')].map(r=>r.dataset.korg).find(id=>!S.orgs[id]); });
  if(virt){ const n0=Object.keys(store.orgs).length; await p.selectOption('[data-kown="'+virt+'"]','m-phillip'); await p.waitForTimeout(900);
    check('K08 tildeling av et prospekt som ikke er lagret ennå, oppretter kontakten først',[Object.keys(store.orgs).length-n0,store.orgs[virt]&&store.orgs[virt].ownerId],[1,'m-phillip']); }
  // en annen endrer i mellomtiden
  await remote('orgs','t-nfo',{ownerId:'m-phillip'},'Phillip Test'); await p.evaluate(()=>{ document.querySelector('[data-kown="t-nfo"]').dataset.kownx=''; }); await p.selectOption('[data-kown="t-nfo"]','m-jorgen'); await p.waitForTimeout(700);
  check('K09 en annen tildelte samme kunde i mellomtiden: ingenting overskrives',[store.orgs['t-nfo'].ownerId,await txt(p,'#toast-root')],v=>v[0]==='m-phillip'&&/fikk ny ansvarlig mens du holdt på \(Phillip\)\. Ingenting er overskrevet/.test(v[1]));
  // massetildeling
  const pick=(await ids(p)).filter(id=>store.orgs[id]&&!store.orgs[id].ownerId).slice(0,3); for(const id of pick){ await p.check('[data-ksel="'+id+'"]'); await p.waitForTimeout(100); }
  check('K10 massetildeling: valgte telles, og knappen er sperret til en person er valgt',[await txt(p,'.ku-bulk b'),await p.$eval('#kBulkGo',e=>e.disabled),await txt(p,'.ku-bulk .note')],['3 valgt',true,'Saker og oppgaver endres ikke. Tildeling endrer ikke tilgang.']);
  const nNot=Object.keys(store.notices||{}).length, nActs=Object.keys(store.acts).length; await p.selectOption('#kBulkTo','m-phillip'); await p.waitForTimeout(150); await p.click('#kBulkGo'); await p.waitForTimeout(2500);
  check('K11 alle valgte er tildelt, hver med egen loggføring',[pick.map(id=>store.orgs[id].ownerId),pick.every(id=>Object.values(store.audit).some(a=>a.entityId===id&&a.changes.some(c=>c.f==='ownerId')))],[['m-phillip','m-phillip','m-phillip'],true]);
  check('K11 mottakeren får ett samlet varsel, ikke ett per kunde, og ingen notater legges på kundene',[Object.keys(store.notices).length-nNot,Object.values(store.notices).filter(n=>n.kind==='bulk').map(n=>n.to+' | '+n.count),Object.keys(store.acts).length-nActs],[1,['m-phillip | 3'],0]);
  check('K11 oppsummering etter massetildeling',await txt(p,'.ku .notice.info'),v=>/3 kunder har fått Phillip som kundeansvarlig/.test(v)&&/Ett samlet varsel er lagret i Salong/.test(v));
  await view(p2,'idag'); await p2.waitForTimeout(200);
  check('K12 Phillip ser det samlede varselet',await txt(p2,'#notP'),v=>/Du står som kundeansvarlig for 3 kunder/.test(v));
  // rad åpner sidepanel, tastatur
  await p.focus('tr[data-korg="t-nf"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  check('K13 rad åpner kundekortet som sidepanel, også med tastatur',[!!(await p.$('.drawer')),await txt(p,'.drawer .own-row')],[true,'KundeansvarligJJørgenTildel']);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  for(const w of [1440,1280,1024,390]){ await p.setViewportSize({width:w,height:850}); await p.waitForTimeout(200); check('K14 '+w+' px: ingen sideveis rulling av siden',await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true); }
  await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(150); await p.screenshot({path:require('./h.js').SHOT+'/ku2.png'});
  }catch(e){ e0=e; }
  await A.done(e0);
})();
