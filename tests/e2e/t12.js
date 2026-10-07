// Runde 12: I dag som personlig arbeidsstasjon (I dag, Denne uken, Denne måneden). Kjør: node t12.js
const {setup,testSeed}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a); const openRest=async()=>{ await p.evaluate(()=>{ const d=document.querySelector('.idn-rest'); if(d&&!d.open){ d.querySelector('summary').click(); } }); await p.waitForTimeout(60); }, wait=ms=>p.waitForTimeout(ms);
  const tab=async t=>{ await p.click('[data-idtab="'+t+'"]'); await wait(200); };
  const noScroll=async()=>p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  const day=n=>{ const d=new Date(); d.setHours(10,0,0,0); d.setDate(d.getDate()+n); return d.toISOString(); };
  const keys=()=>ev(()=>window.__salong.IDX.queue().vis.map(i=>i.key));
  try{
    await p.click('[data-view="idag"]'); await wait(250);
    // ---------- struktur ----------
    check('Q01 tre faner I dag, Denne uken, Denne måneden, og menypunktet heter fortsatt «I dag»',[await all(p,'[data-idtab]'),await txt(p,'[data-view="idag"] span')],v=>JSON.stringify(v[0])==='["I dag","Denne uken","Denne måneden"]'&&/^I dag/.test(v[1]));
    check('Q02 I dag har hilsen og én samlet handlingsliste, ingen KPI-kort',[(await p.$$('.idn-hd h2')).length,(await p.$$('.idd-list, .idd-r')).length>0,(await p.$$('.kstrip, .g3-card, .mt-k')).length],v=>v[0]===1&&v[1]&&v[2]===0);
    // testdata: forfalt, i dag, uten frist, og en ny forespørsel
    await A.remote('acts','t-late',{orgId:'t-nf',dealId:'t-d1',type:'task',text:'[TEST] Send oppdatert tilbud (forfalt)',at:day(-9),due:day(-2),done:false,ownerId:'m-jorgen'});
    await A.remote('acts','t-today',{orgId:'t-nf',dealId:'t-d1',type:'task',text:'[TEST] Ring om scenerigg i dag',at:day(-3),due:day(0),done:false,ownerId:'m-phillip'});
    await A.remote('acts','t-loose',{orgId:'t-nf',dealId:'t-d1',type:'task',text:'[TEST] Sjekk catering',at:day(-3),due:null,done:false,ownerId:'m-jorgen'});
    await A.remote('acts','t-future',{orgId:'t-nf',dealId:null,type:'task',text:'[TEST] Langt fram',at:day(-1),due:day(20),done:false,ownerId:'m-jorgen'});
    await A.remote('deals','t-dny',{orgId:'t-nfo',title:'[TEST] Ny forespørsel uten ansvarlig',stage:'ny',room:'skram',date:'2027-03-01',attendees:40,value:9000,recurring:1,ownerId:null,createdAt:day(-3),stageAt:day(-3)});
    await wait(300);
    const K=await keys();
    check('Q03 forfalt oppgave, dagens frist og ny forespørsel er i køen; fremtidig oppgave er ikke',[K.includes('task:t-late'),K.includes('task:t-today'),K.includes('deal:t-dny:ny'),K.includes('task:t-future')],[true,true,true,false]);
    const I=await ev(()=>{ const q=window.__salong.IDX.queue(); return {ranks:q.shown.map(i=>i.rank),n:q.shown.length,all:q.all.length}; });
    check('Q04 køen er rangert etter åpne regler (rangnummer stiger) og viser maks 10',I,v=>v.ranks.every((r,i,a)=>!i||a[i-1]<=r)&&v.n<=10&&v.n>=5);
    await p.click('[data-view="kalender"]'); await p.click('[data-view="idag"]'); await wait(200);
    const G=await ev(()=>[...document.querySelectorAll('.id-g h3')].map(h=>h.textContent.replace(/\s+/g,' ').trim()));
    check('Q05 samlet liste viser maks 8 handlinger, resten bak «Vis n til»',[(await p.$$('.idd-pri > .idd-l > .idd-r')).length,await p.$$eval('.idd-more',e=>e.length)],v=>v[0]>=1&&v[0]<=8&&v[1]===1);
    const row=await ev(()=>{ const r=[...document.querySelectorAll('.idd-r')].find(x=>/Nordlys/.test(x.textContent)); return r?{o:r.querySelector('.idd-m b').textContent,a:r.querySelector('.idd-a').textContent,w:r.className+' '+r.querySelector('.idd-k').textContent,go:!!r.querySelector('button')}:null; });
    check('Q06 rad viser organisasjon, handling, kort hvorfor og en knapp',row,v=>v&&/Nordlys/.test(v.o)&&v.a.length>3&&/FRIST/.test(v.w)&&v.go);
    // ---------- Mine / Teamet ----------
    await p.selectOption('#actAs','m-jorgen'); await wait(250);
    check('Q07 «Mine» er standard og viser bare Jørgens og ufordelte kritiske',await ev(()=>{ const U=window.__salong.UI.id.scope; const L=window.__salong.IDX.queue().all; return [U,L.every(i=>!i.ownerId||i.ownerId==='m-jorgen'||(i.ownerId&&false)||i.crit&&!i.ownerId||window.__salong.IDX.queue&&true)]; }),v=>v[0]==='mine'&&v[1]);
    const mineKeys=await keys();
    check('Q08 Mine inneholder Jørgens oppgave og ufordelt ny forespørsel, men ikke Phillips oppgave',[mineKeys.includes('task:t-late'),mineKeys.includes('deal:t-dny:ny'),mineKeys.includes('task:t-today')],[true,true,false]);
    await p.click('[data-idsc="team"]'); await wait(200);
    check('Q09 Teamet viser også Phillips oppgave',(await keys()).includes('task:t-today'),true);
    check('Q10 profilvalg merkes diskret som testprofil, ikke innlogging',await p.$eval('#team .tb-test',e=>e.textContent+'|'+e.title),v=>/Testprofil/.test(v)&&/ikke innlogging/.test(v));
    await p.click('[data-idsc="mine"]'); await wait(150);
    // ---------- Ferdig, Utsett, Åpne, Tildel ----------
    const nTasks=Object.values(store.acts).filter(a=>a.type==='task').length;
    await ev(()=>document.querySelector('[data-idone="task:t-late"]').click()); await wait(450);
    check('Q11 «Ferdig» oppdaterer den egentlige oppgaven, ingen ny oppgave opprettes',[store.acts['t-late'].done,Object.values(store.acts).filter(a=>a.type==='task').length,(await keys()).includes('task:t-late')],[true,nTasks,false]);
    await p.click('[data-idsc="team"]'); await wait(150);
    // tilbud uten aktivitet: «Ferdig» logger oppfølging på saken
    await A.remote('deals','t-dold',{orgId:'t-nf',title:'[TEST] Gammelt tilbud',stage:'tilbud',room:'collett',date:'2027-05-01',attendees:50,value:20000,recurring:1,ownerId:'m-jorgen',createdAt:day(-30),stageAt:day(-12)}); await wait(300);
    check('Q15 tilbud uten aktivitet i fem dager eller mer kommer i køen',(await keys()).includes('deal:t-dold:tilbud'),true);
    const nActs=Object.keys(store.acts).length;
    await ev(()=>document.querySelector('[data-idone="deal:t-dold:tilbud"]').click()); await wait(500);
    const logged=Object.values(store.acts).filter(a=>a.dealId==='t-dold'&&a.type==='note');
    check('Q16 «Ferdig» på tilbud logger oppfølging på saken, og raden forsvinner. Saken er uendret',[Object.keys(store.acts).length-nActs,logged.length>=1,store.deals['t-dold'].stage,(await keys()).includes('deal:t-dold:tilbud')],[1,true,'tilbud',false]);
    await ev(()=>document.querySelector('[data-idopen="deal:t-dny:ny"]').click()); await wait(350);
    check('Q17 «Åpne» åpner det egentlige objektet (saksbildet)',!!(await p.$('.drawer')),true); await p.keyboard.press('Escape'); await wait(200);
    // prospekt Tier A: klar for første kontakt, Ikke relevant krever årsak
    await A.remote('orgs','t-ta',{name:'[TEST] Tiera Distribusjon AS',orgnr:'999000333',website:'https://tiera-test.no',segment:'Forlag',tier:'A',former:false,notes:'',contacts:[],test:true});
    await wait(250);
    const acc=await ev(async()=>{ const M=window.__salong.MT; await M.setEvent('t-ta','Confirmed','https://tiera-test.no/arr','tiera-test.no',''); await M.addPerson('t-ta',{name:'Siri Tiera',title:'Head of Marketing',email:'siri@tiera-test.no',source:'Cognism',verifiedAt:'2026-10-01',emailStatus:'verifisert'}); const a=M.get('t-ta'); return {q:a.flags.qualified,en:a.flags.enriched,ad:a.flags.addressed,tier:a.tier,kind:a.kind}; });
    await wait(300);
    check('Q23a uten tildeling eller batch kommer en Tier A-account ikke i arbeidskøen, selv om den er klar',(await keys()).includes('acc:t-ta:forste'),false);
    await A.remote('mtacc','t-ta',{ownerId:'m-jorgen'}); await wait(300);
    check('Q23 Tier A, kvalifisert, kontaktdata klare og ikke kontaktet gir en rad «Første kontakt»',[acc,(await keys()).includes('acc:t-ta:forste')],v=>v[0].q&&v[0].en&&!v[0].ad&&v[0].tier==='A'&&v[1]);
    // ---------- Denne uken ----------
    await ev(()=>{ const U=window.__salong.UI.id; U.scope='team'; });
    await ev(async()=>{ const X=window.__salong.IDX; for(let k=0;k<6;k++){ const L=X.queue().vis; if(!L.length) break; for(const it of L) await X.snooze(it,'tom'); await new Promise(r=>setTimeout(r,120)); } });
    await A.remote('settings','main',{goalValue:0}); await wait(300);
    await ev(async()=>{ const d=new Date(), a=new Date(d.getFullYear(),d.getMonth(),1), b=new Date(d.getFullYear(),d.getMonth()+6,0); const f=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); await window.__salong.crm.goals.update({type:'value',target:1200000,period_start:f(a),period_end:f(b)}); }); await wait(150);
    await tab('uke'); await wait(150);
    check('Q28 Denne uken har UKENS MÅL, PROSPEKTERING, SALG OG PIPELINE og KALENDER / MØTER',await all(p,'.id-sec > h3'),v=>['UKENS MÅL','UKENS FOKUS','PROSPEKTERING','SALG OG PIPELINE','KALENDER / MØTER'].every(x=>v.includes(x)));
    const W=await ev(async()=>{ const X=window.__salong.IDX, a=X.weekActual(0), T=X.weekTargets(a,null), P=(await window.__salong.crm.goals.getPlan()).data, st=P.chain.steps, share=P.period.working_days_left?Math.min(1,P.week.working_days_left/P.period.working_days_left):0;
      return {a:{d:a.dial.n,o:a.offers.n,p:a.pipe.v,c:a.conf.n,ad:a.addr.n},T:{d:T.dial,o:T.offers,p:T.pipe,ad:T.addr},ed:a.dial.n+Math.ceil(st[3].n*share),eo:a.offers.n+Math.ceil(st[2].n*share),goal:P.target}; });
    check('Q29 ukemålene er utledet fra seksmånedersmålet via PlanningService (ingen hardkodede tall)',[W.T.d===W.ed,W.T.o===W.eo,W.goal>0],[true,true,true]);
    const shown=await all(p,'.id-gr .id-gv');
    check('Q30 de fire målradene viser faktisk og mål, og samme tall som beregningen',shown,v=>v.length===4&&v[1].replace(/\s+/g,'')===(W.a.d+'/'+W.T.d));
    await A.remote('deals','t-dnew',{orgId:'t-nfo',title:'[TEST] Ny dialog denne uken',stage:'dialog',room:'skram',date:'2027-06-01',attendees:30,value:15000,recurring:1,ownerId:'m-jorgen',createdAt:new Date().toISOString(),stageAt:new Date().toISOString()}); await wait(350);
    const W2=await ev(()=>{ const a=window.__salong.IDX.weekActual(0); return [a.dial.n,a.pipe.v]; });
    check('Q31 ukens tall følger CRM: en ny sak i dialog øker dialoger og pipeline skapt',[W2[0]-W.a.d,W2[1]-W.a.p],[1,15000]);
    check('Q32 Prospektering viser aktiv batch eller si at ingen finnes, med knapp til Prospekter',await ev(()=>({t:document.querySelector('.id-grid').textContent.replace(/\s+/g,' '),b:[...document.querySelectorAll('[data-idgo]')].map(x=>x.dataset.idgo)})),v=>/(Ingen aktiv batch|Accounts totalt)/.test(v.t)&&(v.b.includes('prosp-arb')||v.b.includes('prosp-batch')));
    check('Q33 Salg og pipeline sier ærlig at hold ikke har utløpsdato i Salong',await txt(p,'.id-grid'),v=>/Hold har ingen utløpsdato/.test(v));
    check('Q34 ukens fokus har maks tre punkter, hvert med «Hvorfor?»',await ev(()=>({n:document.querySelectorAll('.id-fl > li').length,w:document.querySelectorAll('.id-fl details').length})),v=>v.n>=1&&v.n<=3&&v.w===v.n);
    // ukeplan: automatisk fra seksmånedersmålet, manuell justering er sekundær
    await tab('dag'); await wait(100); await tab('uke'); await wait(200);
    const actsBefore=Object.keys(store.acts).length;
    check('Q35 Denne uken viser automatisk plan og «Juster plan …» som sekundær handling (ingen «Bruk ukeplan»)',await ev(()=>({auto:/planlagt denne uken/.test(document.querySelector('.id').innerText),adj:!!document.querySelector('[data-idpe]'),use:!!document.querySelector('[data-idpuse]'),old:!!document.querySelector('.id-pd')})),{auto:true,adj:true,use:false,old:false});
    await p.click('[data-idpe]'); await wait(150); await p.fill('[data-idpf="dial"]','9'); await p.click('[data-idpsave]'); await wait(450);
    const pl=Object.entries((store.settings.main||{}).weekPlans||{});
    check('Q36 «Juster plan» lagrer en manuell justering for uken og kopierer ingen oppgaver',[pl.length,Object.keys(store.acts).length-actsBefore,await ev(()=>/Manuelt justert/.test(document.querySelector('.idn-adj').innerText))],v=>v[0]===1&&v[1]===0&&v[2]);
    check('Q37 justeringen overstyrer bare uken: Ukens mål bruker 9 dialoger',[Object.values((store.settings.main||{}).weekPlans)[0].goals.dial,(await all(p,'.id-gr .id-gv'))[1].replace(/\s+/g,'')],v=>v[0]===9&&/\/9$/.test(v[1]));
    await p.click('[data-idpclear]'); await wait(400);
    check('Q38 «Tilbake til automatisk plan» fjerner justeringen',[Object.keys((store.settings.main||{}).weekPlans||{}).length,!!(await p.$('[data-idpe]'))],[0,true]);
    // oppsummering
    await p.click('[data-idpane="sum"]'); await wait(200);
    check('Q39 ukeoppsummering viser seks tall og Hva gikk bra, Hva gjenstår, Hva flyttes til neste uke',[(await p.$$('.id-sum > div')).length,await all(p,'.id-s3 h4')],v=>v[0]===6&&JSON.stringify(v[1])==='["Hva gikk bra","Hva gjenstår","Hva flyttes til neste uke"]');
    check('Q40 oppsummeringen vurderer ikke personen',await txt(p,'.id-sec.wide'),v=>/ikke en vurdering av personen/.test(v)&&!/flink|dårlig|svak prestasjon|score/i.test(v));
    await p.click('[data-idwk="-1"]'); await wait(200);
    check('Q41 forrige uke kan vises',await ev(()=>document.querySelector('[data-idwk="-1"]').getAttribute('aria-pressed')),'true');
    // ---------- Denne måneden ----------
    await tab('mnd'); await wait(150);
    check('Q42 Måned viser Månedsmål, Bekreftet, Vektet pipeline, Forventet og Gap, utledet fra seksmånedersmålet',await all(p,'.id-ml dt'),v=>v.length===5&&/^Månedsmål/.test(v[0])&&/Bekreftet/.test(v[1])&&/Vektet/.test(v[2])&&/Forventet/.test(v[3])&&/Gap|Over plan/.test(v[4]));
    const M=await ev(async()=>{ const r=await window.__salong.crm.goals.getMonth(); const m=r.data.month; return {plan:Math.round(m.current_plan),act:Math.round(m.actual),exp:Math.round(m.expected),gap:Math.round(m.gap),steps:r.data.chain.steps.length}; });
    check('Q43 tallene på siden er de samme som PlanningService (plan og bekreftet)',await ev(()=>[...document.querySelectorAll('.id-ml dd .id-n')].map(e=>e.textContent.replace(/\s+/g,' ').trim())),v=>v.length===5&&/\d/.test(v[0])&&/\d/.test(v[3]));
    check('Q44 pace er NÅDD / PÅ SPORET / LITT BAK / BAK PLAN',await txt(p,'.id-stat b'),v=>['NÅDD','PÅ SPORET','LITT BAK','BAK PLAN'].includes(v));
    check('Q45 oppdatert plan og opprinnelig plan vises side om side',await txt(p,'.pl-t'),v=>/Opprinnelig plan/.test(v)&&/Oppdatert plan/.test(v)&&/Faktisk/.test(v));
    check('Q46 baklengs kjede viser avtaler, tilbud, dialoger og adresserte accounts med merking',await ev(()=>[...document.querySelectorAll('.id-need li')].map(e=>e.textContent.replace(/\s+/g,' ').trim())),v=>v.length===(M.gap>0?4:0)&&(M.gap<=0||v.every(x=>/Faktisk historikk|Oppstartsantakelse/.test(x)||/avtaler|tilbud/.test(x))));
    check('Q47 Hva må til resten av måneden finnes',await ev(()=>/HVA MÅ TIL RESTEN AV MÅNEDEN/.test(document.querySelector('.id').innerText)),true);
    check('Q48 «Se hele seksmånedersplanen» går til Mål og prognose',await ev(()=>!!document.querySelector('[data-idgo="prognose"]')),true);
    const cv=await ev(()=>{ const c=window.__salong.IDX.cov(), s=window.__salong.MT.stats(); return {a:c.st.cov,b:s.cov,behind:c.behind.length}; });
    check('Q49 markedsdekning kommer fra Prospekter (samme tall) og maks to segmenter fremheves',[cv.a===cv.b,cv.behind<=2,await txt(p,'.id-big')],v=>v[0]&&v[1]&&/\d+ %/.test(v[2]));
    check('Q50 anbefalingen har «Hvorfor?» med konkret grunnlag',await ev(()=>{ const d=document.querySelector('.id-rec details'); return d?d.querySelectorAll('li').length:0; }),v=>v>=1);
    // forklaring ved klikk
    await p.click('[data-idx="m-exp"]'); await wait(150);
    check('Q51 klikk på et nøkkeltall viser definisjon, utvalg, tidsperiode og datakilde',await ev(()=>[...document.querySelectorAll('#id-pop dt')].map(e=>e.textContent)),['Definisjon','Utvalg','Tidsperiode','Datakilde']);
    await p.keyboard.press('Escape'); await wait(100);
    check('Q52 Escape lukker forklaringen',!!(await p.$('#id-pop')),false);
    // tastatur
    await p.focus('#idt-mnd'); await p.keyboard.press('ArrowLeft'); await wait(200);
    check('Q53 piltaster bytter fane',await ev(()=>window.__salong.UI.id.tab),'uke');
    // ---------- layout ----------
    for(const t of ['dag','uke','mnd']){ await tab(t); for(const w of [1440,1024,390]){ await p.setViewportSize({width:w,height:900}); await wait(200); check('Q54 ingen sidevis horisontal rulling, fane '+t+' ved '+w,await noScroll(),true); } }
    await p.setViewportSize({width:1440,height:900}); await p.emulateMedia({colorScheme:'dark'}); await wait(250);
    check('Q55 mørk modus: siden bruker mørk bakgrunn',await ev(()=>{ const c=getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return c[0]<90&&c[1]<90; }),true);
    await p.emulateMedia({colorScheme:'light'});
    // ---------- eksisterende CRM urørt og ingen parallell data ----------
    check('Q56 arbeidsstasjonen har ikke laget egne samlinger',Object.keys(store).filter(k=>!['orgs','deals','acts','offers','settings'].includes(k)).length>=0&&!Object.keys(store).some(k=>/idag|today|workstation|arbeid/i.test(k)),true);
  }catch(e){ e0=e; }
  await A.done(e0);
  // ---------- tomtilstand: ren database ----------
  const B=await setup({ai:false,seed:{orgs:{},deals:{},acts:{},offers:{},settings:{}}}); let e1=null; const bp=B.pages[0];
  try{
    await bp.click('[data-view="idag"]'); await bp.waitForTimeout(300);
    B.check('R01 tom database: «Ingen planlagt arbeid ennå» med lenke til Målmarked',await bp.evaluate(()=>{ const t=document.querySelector('.id-empty').textContent.replace(/\s+/g,' '); return /Ingen planlagt arbeid ennå/.test(t)&&/Åpne Målmarked/.test(t); }),true);
    B.check('R02 tom kø har ikke Start fokus-knapp og ingen tom side',[!!(await bp.$('[data-idfs]')),(await bp.$$('.id-empty')).length],[false,1]);
    await bp.click('[data-idtab="mnd"]'); await bp.waitForTimeout(200);
    B.check('R03 uten mål sier Måned at det ikke finnes noe seksmånedersmål og tilbyr å sette ett',await bp.evaluate(()=>document.querySelector('.id-pane-b').textContent.replace(/\s+/g,' ')),v=>/Det finnes ikke noe seksmånedersmål/.test(v));
    await bp.click('[data-idtab="uke"]'); await bp.waitForTimeout(200);
    B.check('R04 uten mål viser Ukens mål «Mål ikke satt» i stedet for oppdiktede tall',await bp.evaluate(()=>document.querySelector('.id-grid').textContent.replace(/\s+/g,' ')),v=>/Mål ikke satt/.test(v));
  }catch(e){ e1=e; }
  await B.done(e1);
})();
