// Regresjon for eksisterende funksjoner. Suiten fra forrige runde gikk tapt, så denne er skrevet på nytt. Kjør: node treg.js
const {navTo,setup} = require('./h.js');
(async()=>{
  const A=await setup({ai:true}), {p,store,check,txt,all,remote}=A; let e0=null;
  const view=async v=>{ await navTo(p,v,150); };
  const kill=()=>p.evaluate(()=>{ __salong.UI.drawer=null; document.querySelector('#drawer-root').innerHTML=''; });
  const openOrg=async(id,tab)=>{ await kill(); await p.evaluate(([id,tab])=>__salong.openOrg(id,tab),[id,tab]); await p.waitForTimeout(220); };
  const openDeal=async(id,tab)=>{ await kill(); await p.evaluate(id=>__salong.openDeal(id),id); await p.waitForTimeout(220); if(tab){ await p.click('[data-ctab="'+tab+'"]'); await p.waitForTimeout(150); } };
  const mode=()=>txt(p,'#mode');
  try{
  // ---------- lagring, revisjon, logg ----------
  await openOrg('t-nf','detaljer'); await p.fill('[data-o="notes"]','[TEST] Første notat'); await p.click('#oSave'); await p.waitForTimeout(350);
  check('R01 redigering lagres med revisjon og hvem',[store.orgs['t-nf'].notes,store.orgs['t-nf'].rev,store.orgs['t-nf'].updatedByName],['[TEST] Første notat',1,'Jørgen Test']);
  check('R01 lagrestatus bekrefter først etter skriving',await mode(),v=>/Alle endringer lagret/.test(v));
  check('R02 endringslogg: felt, gammel og ny verdi, hvem',Object.values(store.audit).filter(a=>a.entityId==='t-nf').map(a=>a.action+' · '+a.byName+' · '+a.changes.map(c=>c.f).join(',')),v=>v.length===1&&/endret · Jørgen Test · notes/.test(v[0]));
  await p.click('[data-ktab="historikk"]'); await p.waitForTimeout(150);
  check('R02 loggen vises i kundekortet',await txt(p,'.drawer .body'),v=>/Første notat/.test(v)&&/Jørgen Test/.test(v));
  // ---------- samtidige brukere ----------
  await p.click('[data-ktab="detaljer"]'); await p.waitForTimeout(120); await remote('orgs','t-nf',{notes:'[TEST] Karis notat'}); await p.waitForTimeout(250);
  await p.fill('[data-o="notes"]','[TEST] Mitt notat'); await p.click('#oSave'); await p.waitForTimeout(300);
  check('R03 konflikt: den andres endring overskrives ikke i stillhet',[store.orgs['t-nf'].notes,await txt(p,'.drawer .notice')],v=>v[0]==='[TEST] Karis notat'&&/Kari Nordmann/.test(v[1]));
  check('R03 konflikt: valgene som tilbys',await all(p,'.drawer .notice [data-cf]'),v=>v.length>=2);
  check('R03 konflikt: det jeg skrev er beholdt i feltet',await p.$eval('[data-o="notes"]',e=>e.value),'[TEST] Mitt notat');
  // ---------- feil ved lagring ----------
  await openOrg('t-nfo','detaljer'); await p.evaluate(()=>{ window.__fail=true; }); await p.fill('[data-o="notes"]','[TEST] Skal ikke forsvinne'); await p.click('#oSave'); await p.waitForTimeout(400);
  check('R04 lagring feiler: status sier det, ingenting er skrevet',[await mode(),store.orgs['t-nfo'].notes||''],v=>/Kunne ikke lagre|ikke lagret|feilet/i.test(v[0])&&v[1]==='');
  check('R04 varsel i skuffen med «Prøv igjen», og teksten er beholdt',[await txt(p,'.drawer .notice.err'),await p.$eval('[data-o="notes"]',e=>e.value)],v=>/Kunne ikke lagre/.test(v[0])&&/Prøv igjen/.test(v[0])&&v[1]==='[TEST] Skal ikke forsvinne');
  await p.evaluate(()=>{ window.__fail=false; }); await p.click('.drawer [data-cf="retry"]'); await p.waitForTimeout(500);
  check('R04 «Prøv igjen» lagrer',[store.orgs['t-nfo'].notes,await mode()],v=>v[0]==='[TEST] Skal ikke forsvinne'&&/Alle endringer lagret/.test(v[1]));
  // ---------- frakoblet ----------
  await p.context().setOffline(true); await p.waitForTimeout(100); await p.fill('[data-o="notes"]','[TEST] Skrevet uten nett'); await p.click('#oSave'); await p.waitForTimeout(350);
  check('R05 frakoblet: endringen står i kø og vises som det',[await mode(),store.orgs['t-nfo'].notes],v=>/Frakoblet|venter/i.test(v[0])&&v[1]==='[TEST] Skal ikke forsvinne');
  await p.context().setOffline(false); await p.waitForTimeout(700);
  check('R05 tilkoblet igjen: køen lagres',[store.orgs['t-nfo'].notes,await mode()],v=>v[0]==='[TEST] Skrevet uten nett'&&/Alle endringer lagret/.test(v[1]));
  // ---------- ulagret endring ved lukking ----------
  await p.fill('[data-o="notes"]','[TEST] Ulagret'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('R06 lukking med ulagret endring spør først',[!!(await p.$('.drawer')),await txt(p,'.drawer .notice')],v=>v[0]===true&&/ulagre/i.test(v[1]));
  await kill();
  // ---------- papirkurv ----------
  await openOrg('t-nfo','detaljer'); await p.click('#oDel'); await p.waitForTimeout(150); await p.click('#oDelYes'); await p.waitForTimeout(400);
  check('R07 sletting er myk: dokumentet finnes med slettemerke',[!!store.orgs['t-nfo'],!!store.orgs['t-nfo'].deletedAt,store.orgs['t-nfo'].deletedBy],[true,true,'Jørgen Test']);
  await view('data'); await p.click('[data-dsec="papirkurv"]'); await p.waitForTimeout(150);
  check('R07 ligger i papirkurven',await txt(p,'.dbody'),v=>/\[TEST\] Nordlys Forening/.test(v));
  await p.click('[data-restore]'); await p.waitForTimeout(400);
  check('R07 gjenopprettet',!!store.orgs['t-nfo'].deletedAt,false);
  // ---------- duplikater ----------
  await p.click('[data-dsec="kvalitet"]'); await p.waitForTimeout(150);
  check('R08 mulig duplikat foreslås, slås ikke sammen automatisk',[(await p.$$('[data-merge]')).length,Object.keys(store.orgs).filter(k=>k.startsWith('t-nf')).length],[1,2]);
  await p.click('[data-notdup]'); await p.waitForTimeout(350);
  check('R08 «Ikke duplikat» huskes',(await p.$$('[data-merge]')).length,0);
  // ---------- import av kontakter med prøvekjøring og angring ----------
  await p.click('[data-dsec="import"]'); await p.waitForTimeout(100); await p.click('[data-imp="orgs"]'); await p.waitForTimeout(80);
  await p.setInputFiles('#impFile',{name:'kontakter.csv',mimeType:'text/csv',buffer:Buffer.from('Organisasjon;Segment;Kontaktperson;E-post\n[TEST] Importert Lag;Organisasjon;Ida Import;ida@lag.test\n[TEST] Nordlys Forlag AS;Forlag;Nora Test;nora@nordlys.test\n;Forlag;Uten navn;x@y.test\n')}); await p.waitForTimeout(250);
  await p.click('[data-istep="3"]'); await p.waitForTimeout(200); const prev=await txt(p,'.strip'); await p.click('[data-istep="4"]'); await p.waitForTimeout(150);
  const n0=Object.keys(store.orgs).length; check('R09 prøvekjøring: ingenting lagret ennå',[prev,await txt(p,'.notice.info b'),n0],v=>/3 rader/.test(v[0])&&/Ingenting er lagret/.test(v[1]));
  await p.click('#impGo'); await p.waitForTimeout(600);
  check('R09 import: ny kontakt opprettet, duplikat og feilrad hoppet over',[Object.keys(store.orgs).length-n0,Object.values(store.orgs).some(o=>o.name==='[TEST] Importert Lag')],[1,true]);
  await p.click('.notice.ok ~ .row [data-roll], .row [data-roll]'); await p.waitForTimeout(150); const still=Object.values(store.orgs).filter(o=>o.name==='[TEST] Importert Lag'&&!o.deletedAt).length; await p.click('.row [data-roll]'); await p.waitForTimeout(600);
  check('R09 angring krever to klikk',still,1);
  check('R09 importen kan angres',Object.values(store.orgs).filter(o=>o.name==='[TEST] Importert Lag'&&!o.deletedAt).length,0);
  // ---------- saksbildet ----------
  await openDeal('t-d1'); await p.$$eval('details.ca',e=>e.forEach(x=>x.open=true));
  check('R10 saksbilde: fem områder og «Akkurat nå»',[await all(p,'details.ca > summary'),!!(await p.$('#cnowH'))],v=>v[0].length===5&&/Arrangementet/.test(v[0][0])&&/Neste steg/.test(v[0][4])&&v[1]);
  check('R10 ledighet vises aldri som bekreftet',await txt(p,'.case'),v=>/Ledighet\s*Ikke bekreftet/.test(v)&&/ikke koblet til bookingsystemet/.test(v));
  check('R10 motstrid oppdages av faste regler (250 deltakere i Collett)',await txt(p,'.case'),v=>/Motstridende/.test(v));
  await p.click('[data-cedit="setup"]'); await p.waitForTimeout(120); await p.selectOption('#ceSt','avklart'); await p.click('[data-cesave="setup"]'); await p.waitForTimeout(250);
  check('R11 punkt uten verdi kan ikke markeres som avklart',[await txt(p,'#toast-root'),!!(store.deals['t-d1'].facts||{}).setup],['Legg inn verdien før du markerer punktet som avklart.',false]);
  await p.$$eval('details.ca',e=>e.forEach(x=>x.open=true)); await p.click('[data-cedit="pricing"]'); await p.waitForTimeout(120); await p.selectOption('#ceSt','avklart'); await p.selectOption('#ceSrc','samtale'); await p.fill('#ceNote','[TEST] Avklart på telefon'); await p.click('[data-cesave="pricing"]'); await p.waitForTimeout(350);
  check('R11 avklaring lagres med status, kilde, hvem og når',(store.deals['t-d1'].facts||{}).pricing,v=>v&&v.st==='avklart'&&v.src==='samtale'&&v.by==='Jørgen Test'&&!!v.at&&v.note==='[TEST] Avklart på telefon');
  await p.$$eval('details.ca',e=>e.forEach(x=>x.open=true)); const nA=Object.keys(store.acts).length; await p.click('[data-cdone="t-a5"]'); await p.waitForTimeout(350);
  check('R12 oppgave markert som gjort',store.acts['t-a5'].done,true);
  // ---------- steg og låsing av tilbud ----------
  await p.click('[data-ctab="detaljer"]'); await p.waitForTimeout(150); await p.click('[data-stg="bekreftet"]'); await p.waitForTimeout(450);
  check('R13 bekreftet: steget lagres, og tilbudet som gjaldt låses',[store.deals['t-d1'].stage,!!store.offers['t-of1'].lockedAt],['bekreftet',true]);
  // ---------- tilbud ----------
  await kill(); await view('tilbud'); await p.selectOption('#qDeal','t-d1'); await p.waitForTimeout(200); await p.click('[data-qroom="hofmo"]'); await p.waitForTimeout(150);
  const saveBtn=await p.$('#qSave'); if(saveBtn){ await saveBtn.click(); await p.waitForTimeout(500); }
  check('R14 tilbud: ny versjon lagres på saken, den låste beholdes',Object.values(store.offers).filter(o=>o.dealId==='t-d1').map(o=>o.version+':'+o.room+':'+(o.lockedAt?'låst':'åpen')).sort(),['1:collett:låst','2:hofmo:åpen']);
  // ---------- forespørsel ----------
  await view('innboks'); await p.fill('#inqText','[TEST] Hei, vi i Testlaget ønsker sal til 60 personer 12. mars.'); await p.click('#inqManual'); await p.waitForTimeout(120); await p.fill('[data-f="org"]','[TEST] Testlaget'); await p.fill('[data-f="title"]','[TEST] Medlemskveld'); await p.click('#inqCreate'); await p.waitForTimeout(600);
  check('R15 forespørsel blir sak, og den innlimte teksten blir kilde',(()=>{ const d=Object.values(store.deals).find(d=>d.title==='[TEST] Medlemskveld'), a=Object.entries(store.acts).find(([,a])=>a.body&&/Testlaget/.test(a.body)); return [!!d,d&&d.stage,!!a,d&&a&&d.facts.title.ref==='a:'+a[0]]; })(),[true,'ny',true,true]);
  // ---------- prospekter, statistikk, kalender, pipeline, søk ----------
  await kill(); await view('prosp'); await p.waitForTimeout(200);
  check('R16 Prospekter er målmarked: fem faner, ingen «Finn nye»/AI-forslag, ingenting lagres ved visning',[await all(p,'[data-mttab]').then(x=>x.length),await p.evaluate(()=>!/Claude foreslår|Finn nye/.test(document.body.innerText)),Object.values(store.orgs).some(o=>/Fiktivt/.test(o.name))],[5,true,false]);
  await view('stat'); check('R17 kundestatistikk tegnes',[(await p.$$('#view table tbody tr')).length>0,(await p.$$('#view svg')).length>0],[true,true]);
  await view('kalender'); check('R18 kalender tegnes',(await p.$$('#view [data-cd], #view .cal td, #view .cal-c, #view .kl-body')).length>0,true);
  await view('pipeline'); check('R19 pipeline: syv steg',(await p.$$('#view [data-stage]')).length,7);
  await view('kontakter'); await p.click('[data-kst="alle"]'); await p.fill('#q','Nordlys'); await p.waitForTimeout(200);
  check('R20 søk filtrerer kundelisten',await all(p,'#view tr[data-korg] .on'),v=>v.length>=2&&v.every(x=>/Nordlys/.test(x)));
  await p.fill('#q','');
  // ---------- innstillinger og faresone ----------
  await view('data'); await p.click('[data-dsec="generelt"]'); await p.fill('[data-set="goalBookings"]','120'); await p.click('#setSave'); await p.waitForTimeout(400);
  check('R21 innstillinger lagres',store.settings.main.goalBookings,v=>Number(v)===120);
  await p.click('[data-dsec="fare"]'); await p.waitForTimeout(120); const nOrg=Object.keys(store.orgs).length; await p.click('#exDel'); await p.waitForTimeout(150);
  await p.click('#exYes'); await p.waitForTimeout(300);
  check('R22 faresone: uten skrevet bekreftelse slettes ingenting',[!!(await p.$('#exTxt')),Object.keys(store.orgs).length===nOrg,await txt(p,'#toast-root')],[true,true,'Skriv SLETT for å bekrefte.']);
  if(await p.$('#exNo')) await p.click('#exNo');
  // ---------- tilgjengelighet ----------
  await view('kontakter'); await openOrg('t-nf');
  check('R23 skuffen er en dialog med navn, og Escape lukker',[await p.$eval('.drawer',e=>e.getAttribute('role')+'|'+e.getAttribute('aria-modal')+'|'+e.getAttribute('aria-label'))],['dialog|true|Kontakt']);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); check('R23 Escape lukker skuffen',!!(await p.$('.drawer')),false);
  check('R24 ingen integrasjon vises som tilkoblet uten å være det',await (async()=>{ await view('data'); await p.click('[data-dsec="integrasjoner"]'); await p.waitForTimeout(120); return txt(p,'.dbody'); })(),v=>!/Bookingsystem[^.]*Tilkoblet/.test(v));
  }catch(e){ e0=e; }
  await A.done(e0);
  // ---------- lesetilgang (egen økt) ----------
  const B=await setup({users:[{id:'u9',name:'Lese Test',readOnly:true}]}); let e1=null;
  try{ const p2=B.p; await p2.evaluate(()=>__salong.openOrg('t-nf','detaljer')); await p2.waitForTimeout(250); await p2.fill('[data-o="notes"]','[TEST] Skal ikke lagres'); await p2.click('#oSave').catch(()=>{}); await p2.waitForTimeout(350);
    B.check('R25 lesetilgang: ingenting skrives, og brukeren får beskjed',[B.store.orgs['t-nf'].notes,B.writes.length,await B.txt(p2,'#toast-root')],v=>v[0]===''&&v[1]===0&&/lesetilgang/i.test(v[2])); }catch(e){ e1=e; }
  await B.done(e1);
})();
