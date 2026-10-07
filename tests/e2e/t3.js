// Leveranse 3: Marked og posisjon. Kjør: node t3.js [noai]
const {navTo,setup,testSeed,T0} = require('./h.js'); const AI=process.argv[2]!=='noai';
(async()=>{
  const seed=testSeed(), recent=new Date(Date.now()-20*864e5).toISOString();
  seed.deals['t-d1'].techNeeds='Mikrofoner til [TEST] Nordlys Forlag AS'; seed.deals['t-d1'].time='09:00–15:00'; seed.deals['t-d1'].setup='Kinosal';
  Object.assign(seed.deals,{
   't-d6':{orgId:'t-nfo',title:'[TEST] Tapt sak A',stage:'tapt',room:'hofmo',date:'2027-03-01',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:null,lostReason:'[TEST] Sa de ville vente',notes:'',createdAt:T0,stageAt:recent,test:true},
   't-d7':{orgId:'t-nfo',title:'[TEST] Tapt sak B',stage:'tapt',room:'hofmo',date:'2027-03-02',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:null,lostReason:'',notes:'',createdAt:T0,stageAt:recent,test:true},
   't-d8':{orgId:'t-nfo',title:'[TEST] Tapt sak C',stage:'tapt',room:'hofmo',date:'2027-03-03',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:null,lostReason:'',notes:'',createdAt:T0,stageAt:recent,test:true}});
  seed.deals['t-d2'].stageAt=recent;
  const A=await setup({ai:AI,seed}), {p,store,check,txt,all}=A; let e0=null; const net=[]; p.on('request',r=>{ const u=r.url(); if(!/^file:|^data:|fonts\.(googleapis|gstatic)/.test(u)) net.push(u); });
  const view=async v=>{ await navTo(p,v,150); };
  const tab=async t=>{ if(t==='posisjonering'&&!await p.$('.m3-sub')){ await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(100); } await p.click('[data-mktab="'+t+'"]'); await p.waitForTimeout(150); if(t==='sammenlign'&&await p.$('#mcAdv[aria-expanded="false"]')){ await p.click('#mcAdv'); await p.waitForTimeout(150); } };
  const L=c=>Object.entries(store[c]||{}).filter(([,x])=>!x.deletedAt).map(([id,x])=>({id,...x}));
  const pts=()=>p.$$eval('[data-mkpt]',e=>e.map(x=>({n:x.dataset.n,p:x.dataset.p,b:x.dataset.b,cx:+x.getAttribute('cx'),r:+x.getAttribute('r')})));
  const ev=(si,ai)=>p.evaluate(([si,ai])=>{ const S=__salong.S, e=__salong.mkEval({id:si,...S.mscen[si]},{id:ai,...S.malts[ai]}); return {place:e.place,total:e.P.total,status:e.P.status,nDoc:e.nDoc,unk:e.unk,why:e.why,needs:e.needs.map(n=>n.key+':'+n.v+':'+n.doc)}; },[si,ai]);
  try{
  await view('marked');
  check('M01 fane med fire valg',[await txt(p,'#vt'),await all(p,'.m3-tabs [data-mktab]')],['Marked og posisjon',['Oversikt','Sammenligning','Segmentfit','Læring fra saker']]); await tab('sammenlign');
  check('M02 tomt grunnlag: ingen scenarioer, ingen alternativer, ingen konkurrentdata følger med',[L('mscen').length,L('malts').length,L('mpos').length,(await p.$$('[data-mkpt]')).length,await txt(p,'.mc-adv .empty')],v=>v.slice(0,4).every(x=>x===0)&&/Start med et scenario/.test(v[4])&&/Hurtigsammenligningen over trenger ikke scenario/.test(v[4]));
  check('M02 det står rett ut at ingenting hentes fra nettet',await txt(p,'.mk'),v=>/Salong henter ikke noe fra nettet/.test(v)&&!/oppdatert fra nettet|hentet fra nettet/i.test(v.replace('Salong henter ikke noe fra nettet','')));
  // ---------- scenario fra sak ----------
  await p.selectOption('#mkDeal','t-d1'); await p.waitForTimeout(200);
  check('M03 scenario fra sak henter deltakere, oppsett, varighet, dato, teknikk',await p.$$eval('[data-mks]',e=>Object.fromEntries(e.map(x=>[x.dataset.mks,x.value]))),v=>v.attendees==='250'&&v.setup==='Kinosal'&&v.hours==='6'&&v.date==='2027-04-20'&&/Mikrofoner/.test(v.tech)&&v.vat==='eks');
  await p.check('[data-mkn="step"]'); await p.waitForTimeout(100); await p.check('[data-mkn="mics"]'); await p.waitForTimeout(100); await p.click('#mkScenSave'); await p.waitForTimeout(450);
  const sid=L('mscen')[0].id;
  check('M03 scenarioet er lagret med valgte behov, og kapasitet er absolutt krav',[L('mscen')[0].dealId,L('mscen')[0].needs.map(n=>n.key+(n.must?'!':''))],['t-d1',['cap!','step','mics']]);
  check('M04 generisk behovsbeskrivelse: uten kundenavn og sakstittel, også når de står i et felt',await p.$eval('#mkGen',e=>e.value),v=>/for 250 deltakere, oppsett kinosal, varighet 6 timer, april 2027/.test(v)&&!/Nordlys|Høstlansering/.test(v)&&/\[fjernet\]/.test(v)&&!/11.?250/.test(v));
  check('M04 uten alternativer: tomtilstand, ikke noe kart',[(await p.$$('#mkChart')).length,await txt(p,'.mk-empty')],v=>v[0]===0&&/Ingen alternativer er lagt til/.test(v[1])&&/aldri gjettede priser eller plasseringer/.test(v[1]));
  // ---------- Litteraturhusets eget rom ----------
  await p.selectOption('#mkOwn','collett'); await p.waitForTimeout(250);
  check('M05 eget rom fylles fra prislisten: planlagt, kapasitet, pris som dokumentert beregning',await p.evaluate(()=>{ const A=__salong.UI.mk.ed.draft; return [A.supplier,A.name,A.planned,A.capMax,A.price[0].amount,A.price[0].status,A.price[0].basis,A.sources.s1.kind,A.sources.s1.checkedAt]; }),['Litteraturhuset','Collett',true,120,11250,'beregnet','eks','nettsted','']);
  await p.click('#mkAltSave'); await p.waitForTimeout(500); const lh=L('malts')[0].id;
  check('M06 250 deltakere i et rom for 120: dokumentert «nei» på absolutt krav, ikke i kartet',[(await ev(sid,lh)).place,(await pts()).length,await txt(p,'.mk-open:last-of-type')],v=>v[0]==='uaktuell'&&v[1]===0&&/Oppfyller ikke absolutt krav: Plass til deltakerantallet\. Kapasitet inntil 120/.test(v[2]));
  await p.click('#mkEditScen'); await p.waitForTimeout(150); await p.fill('[data-mks="attendees"]','100'); await p.click('#mkScenSave'); await p.waitForTimeout(450);
  let E=await ev(sid,lh);
  check('M07 100 deltakere: kravet er oppfylt, men teknikk mangler pris. Alternativet står under «Må avklares», uten sum',[E.place,E.total,E.why,(await pts()).length],['avklares',null,['Pris for teknikk er ikke registrert og må innhentes'],0]);
  check('M07 ukjent egenskap er «ukjent», ikke «nei»',E.needs,['cap:ja:true','step:ukjent:false','mics:ukjent:false']);
  check('M07 tabellen viser «Ikke kjent» for prisen, ikke 0 kr',await all(p,'.mk-tbl tbody tr'),v=>v.length===1&&/Ikke kjent/.test(v[0])&&/Må innhentes/.test(v[0])&&/Planlagt/.test(v[0])&&!/\b0 kr/.test(v[0]));
  await p.click('.mk-open [data-mked]'); await p.waitForTimeout(250);
  check('M08 tilbud på saken kan hentes inn som kilde',!!(await p.$('#mkPrOffer')),true);
  await p.click('#mkPrOffer'); await p.waitForTimeout(200); await p.click('#mkPrAdd'); await p.waitForTimeout(150);
  const i=await p.$$eval('.mk-pr',e=>e.length-1); await p.selectOption('[data-mkc="'+i+':k"]','teknikk'); await p.fill('[data-mkc="'+i+':label"]','[TEST] Lydpakke'); await p.fill('[data-mkc="'+i+':amount"]','5500'); await p.selectOption('[data-mkc="'+i+':status"]','beregnet'); await p.selectOption('[data-mkc="'+i+':basis"]','eks'); await p.selectOption('[data-mkc="'+i+':src"]','s2');
  await p.selectOption('[data-mkpv="mics"]','ja'); await p.selectOption('[data-mkps="mics"]','s2'); await p.click('#mkAltSave'); await p.waitForTimeout(500);
  E=await ev(sid,lh);
  check('M08 med alle prisdeler dokumentert: sum for scenarioet, merket som dokumentert beregning',[E.place,E.total,E.status,E.nDoc],['kart',16750,'beregnet',2]);
  let P=await pts();
  check('M09 kartet: ett punkt per rom, treffflate minst 24 px, navn og tall uten hover',[P.length,P[0].n,P[0].p,P[0].b,P[0].r>=12,await p.$eval('[data-mkpt]',e=>[e.getAttribute('role'),e.getAttribute('tabindex'),/Totalpris 16 750 kr/.test(e.getAttribute('aria-label').replace(/ /g,' '))&&/2 av 3 valgte behov dokumentert oppfylt/.test(e.getAttribute('aria-label'))])],v=>v[0]===1&&v[1]==='Litteraturhuset · Collett'&&/16.750 kr · Dokumentert beregning/.test(v[2])&&v[3]==='2 av 3 behov dokumentert · planlagt lokale'&&v[4]&&v[5][0]==='button'&&v[5][1]==='0'&&v[5][2]);
  check('M09 Litteraturhusets punkt er fremhevet og merket som planlagt, med navn i kartet',[await p.$eval('.mk-pt',e=>e.getAttribute('class')),await all(p,'.mk-lab'),await txt(p,'.mk-legend')],['mk-pt own plan',['Litteraturhuset · Collett'],'LitteraturhusetAndre lokalerPlanlagt, ikke i drift']);
  await p.focus('[data-mkpt]'); await p.waitForTimeout(100); const tip=await txt(p,'#mkTip'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  check('M10 tastatur: fokus viser det samme som hover, Enter åpner detaljene',[tip,!!(await p.$('#mkDet'))],v=>/16.750 kr · Dokumentert beregning/.test(v[0])&&/Litteraturhuset · Collett/.test(v[0])&&v[1]);
  check('M10 detaljene viser prisdeler, behov og kilder, og at lokalet er planlagt',await txt(p,'#mkDet'),v=>/Planlagt lokale, åpner etter planen i 2027\. Ikke i drift, og ingen tilgjengelighet er dokumentert/.test(v)&&/Opplyst i et tilbud: Tilbud versjon 1 i Salong/.test(v)&&/Sum16.750 krDokumentert beregning, eks\. mva/.test(v)&&/Trinnfri adkomstUkjentIkke registrert/.test(v)&&/kontrolltidspunkt ikke registrert/.test(v));
  check('M10 forklaringen sier at tellingen ikke er en kvalitetsvurdering',await txt(p,'.mk'),v=>/Tellingen sier ikke noe om kvalitet/.test(v));
  // ---------- fiktive testalternativer ----------
  check('M11 ingen testdata før knappen er brukt',L('malts').filter(a=>a.test).length,0);
  const before=sid; await p.click('#mkDemo'); await p.waitForTimeout(1000); const tsid=L('mscen').find(s=>s.test).id, T=Object.fromEntries(L('malts').filter(a=>a.test).map(a=>[a.name,a.id]));
  check('M11 testdata har oppdiktede navn og er merket',[L('malts').filter(a=>a.test).map(a=>a.supplier).sort(),await p.$eval('#mkScen',e=>e.options[e.selectedIndex].text),(await all(p,'.mk-tbl .src.inf')).length],[['[TEST] Fiktivt Kulturhus','[TEST] Oppdiktet Konferansesenter','[TEST] Tenkt Scene'],'[TEST] Fagdag for 80 (TESTDATA)',3]);
  P=await pts();
  check('M12 bare alternativet med fullt grunnlag er i kartet. Ingen punkt ved 0 kr',[P.map(x=>x.n),P.every(x=>x.cx>60)],[['[TEST] Fiktivt Kulturhus · Storsalen'],true]);
  E=await ev(tsid,T['Lille sal']);
  check('M12 kundens utsagn om pris og egenskaper teller ikke som dokumentert',[E.place,E.total,E.nDoc,E.why.filter(w=>/kundens utsagn/.test(w)).length],['avklares',null,0,3]);
  E=await ev(tsid,T['Dagpakke Sal B']);
  check('M13 pris inkl. mva uten dokumentert sats regnes ikke om. Ingen gjetning om avgift',[E.place,E.total,E.why],v=>v[0]==='avklares'&&v[1]===null&&v[2].some(w=>/oppgitt inkl\. mva, og satsen er ikke dokumentert\. Den kan ikke regnes om/.test(w)));
  await p.evaluate(id=>{ const S=__salong.S, a=JSON.parse(JSON.stringify(S.malts[id])); a.price[0].vatPct=25; a.props.step={v:'ja',src:'s1'}; S.malts[id]=a; },T['Dagpakke Sal B']); E=await ev(tsid,T['Dagpakke Sal B']);
  check('M13 med dokumentert sats og krav: samme scenario, samme grunnlag (690 kr × 80 deltakere, regnet om)',[E.place,E.total,E.status],['kart',44160,'beregnet']);
  await p.evaluate(id=>{ const S=__salong.S, a=JSON.parse(JSON.stringify(S.malts[id])); a.sources.s1.validTo='2026-01-31'; S.malts[id]=a; },T['Storsalen']); E=await ev(tsid,T['Storsalen']);
  check('M14 pris med utløpt gyldighet er historisk og gir ingen sum',[E.place,E.total,E.why.some(w=>/gjaldt til 31\. jan\. 2026\. Historiske priser er ikke automatisk gjeldende/.test(w))],['avklares',null,true]);
  await p.evaluate(id=>{ const S=__salong.S, a=JSON.parse(JSON.stringify(S.malts[id])); a.sources.s1.validTo=''; a.price.push({k:'minimum',label:'Minste leie',amount:20000,unit:'fast',status:'bekreftet',basis:'eks',vatPct:'',src:'s1'}); S.malts[id]=a; },T['Storsalen']); E=await ev(tsid,T['Storsalen']);
  check('M14 minimumsleie brukes når romprisen er lavere (20 000 + teknikk 3 500)',[E.total,E.status],[23500,'beregnet']);
  // ---------- registrering for hånd ----------
  await p.click('#mkAddAlt'); await p.waitForTimeout(250); await p.click('#mkAltSave'); await p.waitForTimeout(150);
  check('M15 nytt alternativ krever leverandør og konkret rom eller pakke',await txt(p,'#modal-root .notice.err'),'Leverandør og navn på rom eller pakke må fylles ut.');
  await p.fill('[data-mka="supplier"]','[TEST] Påhittet Hus'); await p.fill('[data-mka="name"]','Salong 2'); await p.click('#mkSrcAdd'); await p.waitForTimeout(150); await p.selectOption('[data-mksk="s1"]','intern'); await p.waitForTimeout(100); await p.fill('[data-mksf="s1:ref"]','[TEST] Egen befaring'); await p.fill('[data-mka="capMax"]','90'); await p.selectOption('[data-mka="capSrc"]','s1'); await p.click('#mkPrAdd'); await p.waitForTimeout(100); await p.click('#mkAltSave'); await p.waitForTimeout(500);
  const man=L('malts').find(a=>a.name==='Salong 2'); E=await ev(tsid,man.id);
  check('M15 intern vurdering teller ikke som dokumentasjon, og tom pris blir «må innhentes», ikke 0',[man.price[0].amount,man.price[0].status,E.place,E.total,E.why],v=>v[0]===''&&v[1]==='innhentes'&&v[2]==='avklares'&&v[3]===null&&v[4].some(w=>/Absolutt krav er ikke dokumentert: Plass til deltakerantallet \(intern vurdering sier ja\)/.test(w))&&v[4].some(w=>/prisen må innhentes/.test(w)));
  await p.screenshot({path:require('./h.js').SHOT+'/mk_sammenlign.png',fullPage:true});
  await p.setViewportSize({width:390,height:800}); await p.waitForTimeout(400);
  await p.click('[data-mksel]'); await p.waitForTimeout(200);
  check('M16 mobilbredde: kart, tabell og detaljer gir ikke sideveis rulling av siden',await p.evaluate(()=>[document.scrollingElement.scrollWidth<=innerWidth,document.querySelector('#mkChart svg').getBoundingClientRect().width<=innerWidth]),[true,true]);
  await p.screenshot({path:require('./h.js').SHOT+'/mk_mobil.png'}); await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(300);
  // ---------- posisjonering ----------
  await tab('posisjonering'); await p.click('#mkPosNew'); await p.waitForTimeout(150);
  await p.fill('[data-mkp="need"]','[TEST] Sal til fagdag med inntil 120 deltakere'); await p.fill('[data-mkp="prop"]','[TEST] Collett har plass til 24 til 120 personer'); await p.fill('[data-mkp="value"]','[TEST] Hele gruppen får plass i ett rom'); await p.fill('[data-mkp="wording"]','[TEST] Collett er byens beste sal for fagdager.'); await p.click('#mkPosSave'); await p.waitForTimeout(450);
  const pid=L('mpos')[0].id;
  check('M17 kort lagres som utkast. «beste» uten sammenligningsgrunnlag og «dokumentert» uten kilde stopper godkjenning',[L('mpos')[0].status,await p.$eval('[data-mkpok]',e=>e.disabled),await all(p,'.mk-card .asg-facts li')],v=>v[0]==='utkast'&&v[1]===true&&v[2].some(x=>/merket som dokumentert, men har ingen kilde/.test(x))&&v[2].some(x=>/bruker «beste» som fakta/.test(x)));
  await p.click('[data-mkped]'); await p.waitForTimeout(150); await p.fill('[data-mkp="wording"]','[TEST] I Collett får hele gruppen plass i ett rom, med inntil 120 deltakere.'); await p.fill('[data-mkp="srcText"]','[TEST] Prislisten i Salong: «Collett, 24–120»'); await p.click('#mkPosSave'); await p.waitForTimeout(450);
  check('M17 med kilde og uten superlativ kan kortet godkjennes',await p.$eval('[data-mkpok]',e=>e.disabled),false);
  await p.click('[data-mkpok]'); await p.waitForTimeout(450);
  check('M18 godkjenning er et eget steg, logget med konto og profil',[store.mpos[pid].status,store.mpos[pid].approvedBy,store.mpos[pid].approvedByName,!!store.mpos[pid].approvedAt,Object.values(store.audit).filter(a=>a.col==='mpos').map(a=>a.by+' | '+a.action)],['godkjent','u1','Jørgen Test',true,['u1 | godkjente salgsargument']]);
  if(AI){
    await p.evaluate(()=>{ window.__aiFn=()=>({formulering:'[TEST] Litteraturhuset har byens beste teknikk.'}); }); await p.click('#mkPosNew'); await p.waitForTimeout(150); await p.fill('[data-mkp="need"]','[TEST] Enkel teknikk'); await p.fill('[data-mkp="prop"]','[TEST] Tekniker kan bestilles'); await p.selectOption('[data-mkp="propKind"]','hypotese'); await p.click('#mkPosAI'); await p.waitForTimeout(400);
    check('M19 KI-forslag settes inn som utkast og merkes. Superlativ fra KI stoppes av samme kontroll',[await p.$eval('[data-mkp="wording"]',e=>e.value),await txt(p,'.mk-posf .rec-tag'),await txt(p,'.mk-posf .notice.warn')],v=>/byens beste teknikk/.test(v[0])&&v[1]==='KI-forslag'&&/bruker «beste» som fakta/.test(v[2]));
    check('M19 ledeteksten til KI inneholder bare kortet, ingen kunder, og forbyr superlativer og nye fakta',await p.evaluate(()=>__prompts[__prompts.length-1]),v=>/<kort>\nKundebehov: \[TEST\] Enkel teknikk/.test(v)&&!/Nordlys|Recovery|Høstlansering/.test(v)&&/Ikke bruk ord som unik, best/.test(v)&&/Ikke legg til egenskaper, tall eller sammenligninger/.test(v));
    await p.click('#mkPosSave'); await p.waitForTimeout(450); const ai=L('mpos').find(c=>/Enkel teknikk/.test(c.need));
    check('M19 KI-forslaget er fortsatt utkast etter lagring, og kan ikke godkjennes slik det står',[ai.status,ai.aiDraft,await p.$$eval('[data-mkpok]',e=>e.map(x=>x.disabled))],['utkast',true,[true]]);
  } else {
    await p.click('#mkPosNew'); await p.waitForTimeout(150);
    check('M19 uten KI: ingen KI-knapp, kort kan fortsatt lages og godkjennes for hånd',[(await p.$$('#mkPosAI')).length,store.mpos[pid].status],[0,'godkjent']); await p.click('#mkPosNo');
  }
  await p.click('[data-mkped]:not([disabled])'); await p.waitForTimeout(100);
  // ---------- markedskunnskap i Kunnskap ----------
  await p.click('#mkPosNo').catch(()=>{}); await view('kunnskap'); await p.click('[data-knt="marked"]'); await p.waitForTimeout(150); if(AI){ await p.uncheck('#knAI'); await p.waitForTimeout(80); }
  await p.fill('#knQ','Hva vet vi om Collett og 120 deltakere?'); await p.click('#knForm button[type=submit]'); await p.waitForTimeout(300);
  const hits=await all(p,'.kn-turn:last-child .kb-hits li');
  check('M20 Markedskunnskap finner godkjent salgsargument og registrerte kilder',hits,v=>v.some(x=>/Godkjent salgsargument/.test(x))&&v.some(x=>/Markedskilde: opplyst på leverandørens nettsted/.test(x)));
  check('M20 utkast, kundens utsagn og kundedata er ikke med',hits.join(' ¦ '),v=>!/Enkel teknikk|byens beste/.test(v)&&!/kundens utsagn|ti tusen/i.test(v)&&!/mikrofoner uten tillegg|Hemmelig/.test(v));
  // læring fra saker er dekket av t9.js (ny fane). De gamle M21 til M23 er fjernet.
  // ---------- lagring og gjenåpning, nett, feil ----------
  await p.reload(); await p.waitForTimeout(700); await view('marked'); await tab('sammenlign'); await p.selectOption('#mkScen',sid); await p.waitForTimeout(250);
  check('M24 etter ny lasting: scenario, alternativ og kart er de samme',[(await pts()).map(x=>x.n+' '+x.p.replace(/ /g,' ')),L('mscen').length,L('mpos').filter(c=>c.status==='godkjent').length],[['Litteraturhuset · Collett 16 750 kr · Dokumentert beregning'],2,1]);
  check('M25 ingen forespørsler ut av siden under hele kjøringen',net,[]);
  await p.click('#mkDemoDel'); await p.waitForTimeout(900);
  check('M26 «Fjern testdata» fjerner bare det som er merket som testdata',[L('malts').filter(a=>a.test).length,L('mscen').filter(s=>s.test).length,L('malts').map(a=>a.supplier).sort()],[0,0,['Litteraturhuset','[TEST] Påhittet Hus']]);
  const b0=A.errs.length; for(const v of ['idag','kontakter','prosp','innboks','pipeline','kalender','kunnskap','stat','marked','tilbud','maler','prognose','om','data']){ await view(v); }
  check('M27 alle faner åpner uten feil',A.errs.length-b0,0);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
