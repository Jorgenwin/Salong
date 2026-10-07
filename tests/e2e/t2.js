// Leveranse 2: ansvar og tildeling. To brukere mot samme (etterlignede) database. Kjøres uten KI med vilje. Kjør: node t2.js
const {navTo,setup,testSeed,T0} = require('./h.js');
(async()=>{
  const seed=testSeed(); seed.acts['t-a4'].due=new Date(Date.now()-864e5).toISOString();
  Object.assign(seed.deals,{
   't-d3':{orgId:'t-nfo',title:'[TEST] Samtidig sak',stage:'dialog',room:'hofmo',date:'2027-05-10',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:null,notes:'',createdAt:T0,stageAt:T0,test:true},
   't-d4':{orgId:'t-nfo',title:'[TEST] Sak med gammel dialog',stage:'dialog',room:'hofmo',date:'2027-05-11',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:null,notes:'',createdAt:T0,stageAt:T0,test:true},
   't-d5':{orgId:'t-nfo',title:'[TEST] Sak med konto-ID som ansvarlig',stage:'dialog',room:'hofmo',date:'2027-05-12',attendees:40,pricing:'open',value:8250,recurring:1,source:'inbound',ownerId:'u1',ownerName:'Jørgen Test',notes:'',createdAt:T0,stageAt:T0,test:true}});
  const A=await setup({ai:false,seed,users:[{id:'u1',name:'Jørgen Test'},{id:'u2',name:'Phillip Test'}]}), {store,check,txt,all,remote}=A, [p1,p2]=A.pages; let e0=null;
  const view=async(p,v)=>{ if(v==='kontakter') await p.evaluate(()=>{ window.__salong.UI.ku.legacy=true; }); await navTo(p,v,150); };
  const kill=p=>p.evaluate(()=>{ __salong.UI.drawer=null; document.querySelector('#drawer-root').innerHTML=''; if(__salong.UI.asg){ __salong.UI.asg=null; document.querySelector('#modal-root').innerHTML=''; } });
  const openDeal=async(p,id,tab)=>{ await kill(p); await p.evaluate(id=>__salong.openDeal(id),id); await p.waitForTimeout(220); if(tab){ await p.click('[data-ctab="'+tab+'"]'); await p.waitForTimeout(150); } };
  const openOrg=async(p,id,tab)=>{ await kill(p); await p.evaluate(([id,tab])=>__salong.openOrg(id,tab),[id,tab]); await p.waitForTimeout(220); };
  const aud=(id,f)=>Object.values(store.audit||{}).filter(a=>a.entityId===id&&(a.changes||[]).some(c=>c.f===(f||'ownerId'))).sort((a,b)=>a.at.localeCompare(b.at));
  const modal=p=>txt(p,'#modal-root .modal-b');
  try{
  // ---------- team og identitet ----------
  check('T01 Jørgen og Phillip finnes med faste ID-er, uten at noe er skrevet til databasen',[await p1.evaluate(()=>__salong.members().map(m=>m.id+':'+m.name)),Object.keys(store.members||{}).length,A.writes.length],[['m-jorgen:Jørgen','m-phillip:Phillip'],0,0]);
  check('T02 uten valgt profil: diskret «Testprofil», forklaringen ligger i tittelen',[await txt(p1,'#team'),await p1.$eval('#team .tb-test',e=>e.title)],v=>/Testprofil/.test(v[0])&&/ingen/.test(v[0])&&!/Jobber som/.test(v[0])&&/ikke innlogging/.test(v[1]));
  await view(p1,'pipeline');
  check('T02 hurtigfilter: Mine, Jørgen, Phillip, Ufordelte, Alle. «Mine» er sperret til profil er valgt',[await all(p1,'.ownseg button'),await p1.$eval('[data-own="mine"]',e=>e.disabled)],[['Mine','Jørgen','Phillip','Ufordelte','Alle'],true]);
  await p1.selectOption('#actAs','m-jorgen'); await p1.waitForTimeout(200); await p2.selectOption('#actAs','m-phillip'); await p2.waitForTimeout(200);
  check('T03 profilvalget ligger bare i nettleseren, ikke i databasen',[await p1.evaluate(()=>localStorage.getItem('salong_v1:profile')),A.writes.length,await p1.evaluate(()=>__salong.actor())],['m-jorgen',0,{id:'m-jorgen',name:'Jørgen',verified:false}]);
  check('T04 pipelinekort viser «Ufordelt»',await txt(p1,'[data-deal="t-d1"] .own'),'Ufordelt');
  await p1.click('[data-own="mine"]'); await p1.waitForTimeout(150);
  check('T04 «Mine» sier at den følger selvvalgt profil',await txt(p1,'.ownf .note'),v=>/følger profilen valgt i denne nettleseren \(Jørgen\)\. Det er ikke innlogging/.test(v));
  await p1.click('[data-own="alle"]');
  // ---------- ta sak med utvalgte oppgaver ----------
  const la0=await p1.evaluate(()=>{ let m=null; for(const a of Object.values(__salong.S.acts)) if(a.orgId==='t-nf'&&a.type!=='task'&&!a.handover&&(!m||a.at>m)) m=a.at; return m; });
  await openDeal(p1,'t-d1');
  check('T05 sakshodet viser saksansvarlig med «Tildel» og «Ta saken»',await txt(p1,'.drawer header .own-row'),'SaksansvarligUfordeltTildelTa saken');
  await p1.click('.drawer header [data-take]'); await p1.waitForTimeout(250);
  check('T05 dialogen viser gammel og ny ansvarlig',[await txt(p1,'.asg-who > div'),await p1.$eval('#asgTo',e=>e.options[e.selectedIndex].text)],['Saksansvarlig nåUfordelt','Jørgen']);
  check('T05 åpne oppgaver listes, ingen er krysset av, avsluttet oppgave er ikke med',await p1.$$eval('[data-asgt]',e=>e.map(x=>x.dataset.asgt+':'+x.checked)),['t-a4:false','t-a5:false']);
  check('T05 dialogen sier at tildeling ikke endrer tilgang, og at det ikke sendes e-post eller push',await txt(p1,'.asg-facts'),v=>/endrer ikke hvem som har tilgang/.test(v)&&/sender ikke e-post eller push/.test(v)&&/innloggede kontoen din \(Jørgen Test\) og profilen «Jørgen», som er valgt i nettleseren/.test(v));
  check('T05 dialogen er en modal dialog med fokus i feltet',await p1.evaluate(()=>{ const m=document.querySelector('.modal'); return [m.getAttribute('role'),m.getAttribute('aria-modal'),document.activeElement.id]; }),['dialog','true','asgTo']);
  await p1.check('[data-asgt="t-a4"]'); await p1.fill('#asgNote','[TEST] Kunden venter på oppdatert tilbud.'); const closed0=JSON.stringify(store.acts['t-a6']); await p1.click('#asgGo'); await p1.waitForTimeout(700);
  check('T06 saken er tildelt, og bare den valgte oppgaven fulgte med',[store.deals['t-d1'].ownerId,store.acts['t-a4'].ownerId,store.acts['t-a5'].ownerId],['m-jorgen','m-jorgen',null]);
  check('T06 avsluttet aktivitet er urørt, også hvem som utførte den',JSON.stringify(store.acts['t-a6'])===closed0,true);
  check('T06 oppsummering etter lagring',await modal(p1),v=>/Jørgen står nå som saksansvarlig/.test(v)&&/bekreftet lagret/.test(v)&&/Før: Ufordelt\. Etter: Jørgen/.test(v)&&/1 oppgave fulgte med/.test(v)&&/Ingen varsel: du tildelte til deg selv/.test(v));
  check('T07 logg: konto, tidspunkt, før og etter, og profilen merket som ikke verifisert',aud('t-d1').map(a=>[a.by,a.byName,a.asMember,a.asVerified,!!a.at,a.changes.find(c=>c.f==='ownerId').old,a.changes.find(c=>c.f==='ownerId').new].join(' | ')),['u1 | Jørgen Test | m-jorgen | false | true | "" | "m-jorgen"']);
  check('T07 logg for oppgaven som fulgte med',aud('t-a4').map(a=>a.col+' | '+a.action+' | '+a.changes.find(c=>c.f==='ownerId').new),['acts | endret oppgaveansvarlig | "m-jorgen"']);
  check('T07 overleveringsbeskjeden ligger på saken med ID-er, ikke navn',Object.values(store.acts).filter(a=>a.handover&&a.dealId==='t-d1').map(a=>[a.type,JSON.stringify(a.handover),/Overleveringsbeskjed: \[TEST\] Kunden venter/.test(a.text),a.byId].join(' | ')),['note | {"from":null,"to":"m-jorgen","kind":"deal"} | true | u1']);
  check('T07 tildeling regnes ikke som dialog med kunden',await p1.evaluate(()=>{ let m=null; for(const a of Object.values(__salong.S.acts)) if(a.orgId==='t-nf'&&a.type!=='task'&&!a.handover&&(!m||a.at>m)) m=a.at; return m; }),la0);
  await p1.keyboard.press('Escape'); await p1.waitForTimeout(150);
  check('T08 Escape lukker dialogen, men ikke saken under',[!!(await p1.$('.modal')),!!(await p1.$('.drawer'))],[false,true]);
  check('T08 sakshode og saksbilde viser ny ansvarlig, «Ta saken» er borte for den som har saken',[await txt(p1,'.drawer header .own-row'),await txt(p1,'#cnowH ~ dl, .cnow dl')],v=>v[0]==='SaksansvarligJJørgenTildel'&&/saksansvarlig Jørgen/.test(v[1]));
  await p1.$$eval('details.ca',e=>e.forEach(x=>x.open=true));
  check('T08 oppgavelisten i saken viser oppgaveansvarlig per oppgave',await all(p1,'.ctask .s'),v=>v.some(x=>/^Oppgaveansvarlig: Jørgen · Forfalt/.test(x))&&v.some(x=>/^Oppgaveansvarlig: Ufordelt/.test(x)));
  await kill(p1); await view(p1,'pipeline'); check('T08 pipelinekortet viser ansvarlig',await txt(p1,'[data-deal="t-d1"] .own'),'JJørgen');
  await view(p1,'idag'); await p1.click('[data-idsc="team"]'); await p1.waitForTimeout(150); check('T08 arbeidskøen viser ansvarlig per oppgave i Teamet-visning',await all(p1,'.id-r,.idd-r'),v=>v.some(x=>/\[TEST\] Nordlys Forlag AS/.test(x)&&/Jørgen/.test(x)));
  // ---------- overføring til en annen, med varsel ----------
  await openDeal(p1,'t-d1'); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(250);
  check('T09 «Tildel»: ingen ny ansvarlig er forhåndsvalgt, knappen er sperret',[await p1.$eval('#asgTo',e=>e.value),await p1.$eval('#asgGo',e=>e.disabled)],['__',true]);
  await p1.selectOption('#asgTo','m-phillip'); await p1.waitForTimeout(150); await p1.fill('#asgNote','[TEST] Tar du denne mens jeg er borte?'); await p1.check('[data-asgt="t-a4"]'); await p1.click('#asgGo'); await p1.waitForTimeout(800);
  check('T09 overført: sak og valgt oppgave til Phillip, den andre oppgaven står urørt',[store.deals['t-d1'].ownerId,store.acts['t-a4'].ownerId,store.acts['t-a5'].ownerId],['m-phillip','m-phillip',null]);
  const nts=()=>Object.values(store.notices||{});
  check('T09 varselet er lagret til mottakeren, med avsenderens konto og merket selvvalgt profil',nts().map(n=>[n.to,n.kind,n.entityId,n.from,n.fromVerified,n.byId,n.prevOwner,n.tasks,n.readAt,n.note].join(' | ')),['m-phillip | deal | t-d1 | m-jorgen | false | u1 | m-jorgen | 1 |  | [TEST] Tar du denne mens jeg er borte?']);
  check('T09 avsender får bare vite «lagret i Salong», ikke at e-post eller push er sendt',await modal(p1),v=>/Varselet til Phillip er lagret i Salong/.test(v)&&/Ingen e-post eller push er sendt/.test(v)&&/Før: Jørgen\. Etter: Phillip/.test(v));
  await kill(p1); await view(p1,'idag'); check('T10 avsenderen ser ikke varselet som sitt',(await p1.$$('#notP')).length,0);
  await view(p2,'idag'); await p2.waitForTimeout(200);
  check('T10 mottakeren ser varselet, med beskjed, hvem som tildelte og at profilen er selvvalgt',await txt(p2,'#notP'),v=>/Varsler til Phillip 1/.test(v)&&/Du står som saksansvarlig for saken «\[TEST\] Høstlansering»/.test(v)&&/Tildelt av Jørgen \(selvvalgt profil, konto Jørgen Test\)/.test(v)&&/tidligere Jørgen/.test(v)&&/1 oppgave fulgte med/.test(v)&&/Tar du denne mens jeg er borte/.test(v)&&/Ingen e-post eller push/.test(v));
  check('T10 topplinjen viser antall varsler',await txt(p2,'#tbN'),'Varsler 1');
  await p2.click('[data-nread]'); await p2.waitForTimeout(400);
  check('T10 «Marker som lest» lagres og fjerner varselet',[!!nts()[0].readAt,nts()[0].readById,(await p2.$$('#notP')).length],[true,'u2',0]);
  // ---------- filtre ----------
  await view(p2,'pipeline'); const cards=async p=>(await p.$$eval('.card',e=>e.map(x=>x.dataset.deal))).filter(x=>x.startsWith('t-')).sort();
  await p2.click('[data-own="mine"]'); await p2.waitForTimeout(150); check('T11 filter Mine (Phillip)',await cards(p2),['t-d1']);
  await p2.click('[data-own="ufordelt"]'); await p2.waitForTimeout(150); check('T11 filter Ufordelte',await cards(p2),['t-d2','t-d3','t-d4']);
  await p2.click('[data-own="m-jorgen"]'); await p2.waitForTimeout(150); check('T11 filter valgt person (Jørgen): ingen saker ennå',await cards(p2),[]);
  await p2.click('[data-own="alle"]'); await p2.waitForTimeout(150); check('T11 filter Alle',await cards(p2),['t-d1','t-d2','t-d3','t-d4','t-d5']);
  // ---------- to brukere tar samme sak samtidig ----------
  await openDeal(p1,'t-d3'); await openDeal(p2,'t-d3');
  await Promise.all([p1.click('.drawer header [data-take]'),p2.click('.drawer header [data-take]')]); await p1.waitForTimeout(900);
  const win=store.deals['t-d3'].ownerId, loser=win==='m-jorgen'?p2:p1, winner=win==='m-jorgen'?p1:p2, loserId=win==='m-jorgen'?'m-phillip':'m-jorgen';
  check('T12 samtidig «Ta saken»: nøyaktig én fikk den',[['m-jorgen','m-phillip'].includes(win),aud('t-d3').length],[true,1]);
  check('T12 den andre får beskjed, og ingenting er overskrevet',await modal(loser),v=>/En annen endrer ansvaret for denne saken akkurat nå\. Ingenting er endret/.test(v)||/fikk ny ansvarlig mens du holdt på\. Ingenting er overskrevet/.test(v));
  check('T12 vinneren får bekreftelse uten dialog',[!!(await winner.$('.modal')),await txt(winner,'#toast-root')],[false,'Du står nå som saksansvarlig.']);
  await loser.waitForTimeout(4300); if(await loser.$('#asgRetry')){ await loser.click('#asgRetry'); await loser.waitForTimeout(400); }
  check('T13 nytt forsøk viser hvem som har saken nå',await modal(loser),v=>/fikk ny ansvarlig mens du holdt på\. Ingenting er overskrevet/.test(v)&&new RegExp('er nå '+(win==='m-jorgen'?'Jørgen':'Phillip')).test(v)&&/Da du åpnet dette, sto Ufordelt/.test(v));
  check('T13 valgene er uttrykkelige',await all(loser,'#modal-root .asg-btn button'),v=>v.length===2&&/likevel$/.test(v[0])&&v[1]==='La det stå som det er');
  await loser.click('#asgNo'); await loser.waitForTimeout(200);
  check('T13 «La det stå som det er»: uendret',[store.deals['t-d3'].ownerId,aud('t-d3').length],[win,1]);
  // ---------- dialog som har stått åpen mens en annen endret ----------
  await openDeal(p1,'t-d4'); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(200); await p1.selectOption('#asgTo','m-jorgen');
  await openDeal(p2,'t-d4'); await p2.click('.drawer header [data-take]'); await p2.waitForTimeout(700);
  check('T14 Phillip tok saken mens Jørgens dialog sto åpen',store.deals['t-d4'].ownerId,'m-phillip');
  await p1.waitForTimeout(4200); await p1.click('#asgGo'); await p1.waitForTimeout(600);
  check('T14 Jørgens tildeling stoppes: fersk lesing viser ny ansvarlig, ingenting er overskrevet',[store.deals['t-d4'].ownerId,await modal(p1)],v=>v[0]==='m-phillip'&&/er nå Phillip, sist endret av Phillip Test/.test(v[1])&&/Ingenting er overskrevet/.test(v[1]));
  await p1.click('#asgForce'); await p1.waitForTimeout(700);
  check('T14 «Tildel til Jørgen likevel» er et bevisst valg og logges som egen endring',[store.deals['t-d4'].ownerId,aud('t-d4').map(a=>a.byName+':'+a.changes.find(c=>c.f==='ownerId').old+'>'+a.changes.find(c=>c.f==='ownerId').new)],['m-jorgen',['Phillip Test:"">"m-phillip"','Jørgen Test:"m-phillip">"m-jorgen"']]);
  await kill(p1); await kill(p2);
  // ---------- én oppgave ----------
  await openDeal(p1,'t-d1'); await p1.$$eval('details.ca',e=>e.forEach(x=>x.open=true)); await p1.selectOption('[data-cown="t-a5"]','m-jorgen'); await p1.waitForTimeout(600);
  check('T15 oppgaveansvarlig kan være en annen enn saksansvarlig',[store.deals['t-d1'].ownerId,store.acts['t-a5'].ownerId,aud('t-a5').length],['m-phillip','m-jorgen',1]);
  await remote('acts','t-a5',{ownerId:'m-phillip'},'Phillip Test'); A.leases['locks/acts-t-a5']=null;
  await p1.evaluate(()=>{ const s=document.querySelector('[data-cown="t-a5"]'); s.dataset.cownx='m-jorgen'; }); await p1.selectOption('[data-cown="t-a5"]','').catch(()=>{}); await p1.waitForTimeout(600);
  check('T15 oppgaven ble endret av en annen i mellomtiden: ingenting overskrives',[store.acts['t-a5'].ownerId,await txt(p1,'#toast-root')],v=>v[0]==='m-phillip'&&/fikk ny ansvarlig mens du holdt på \(Phillip\)\. Ingenting er overskrevet/.test(v[1]));
  await p1.click('[data-ctab="aktivitet"]'); await p1.waitForTimeout(150); await p1.selectOption('#actType','task'); await p1.waitForTimeout(150);
  check('T16 ny oppgave: saksansvarlig er foreslått',await p1.$eval('#actOwner',e=>e.value),'m-phillip');
  await p1.fill('#actText','[TEST] Oppgave til en annen enn saksansvarlig'); await p1.selectOption('#actOwner','m-jorgen'); await p1.click('#actAdd'); await p1.waitForTimeout(400);
  await p1.fill('#actText','[TEST] Oppgave med foreslått ansvarlig'); await p1.click('#actAdd'); await p1.waitForTimeout(400);
  check('T16 forslaget kan overstyres',Object.values(store.acts).filter(a=>/Oppgave (til en annen|med foreslått)/.test(a.text)).map(a=>a.ownerId).sort(),['m-jorgen','m-phillip']);
  // ---------- kundeansvarlig er noe annet enn saksansvarlig ----------
  await openOrg(p1,'t-nf');
  check('T17 kundekortet viser kundeansvarlig',await txt(p1,'.drawer .own-row'),'KundeansvarligUfordeltTildelTa kunden');
  await p1.click('.drawer [data-take]'); await p1.waitForTimeout(700);
  check('T17 kundeansvarlig satt uten at saksansvarlig endres',[store.orgs['t-nf'].ownerId,store.deals['t-d1'].ownerId],['m-jorgen','m-phillip']);
  await kill(p1); await view(p1,'kontakter'); await p1.click('[data-kst="alle"]'); await p1.click('[data-own="mine"]'); await p1.waitForTimeout(200);
  check('T17 kundelisten: kolonne og filter for kundeansvarlig',[await p1.$$eval('tr[data-korg]',e=>e.map(x=>x.dataset.korg)),await p1.$eval('[data-kown="t-nf"]',e=>e.options[e.selectedIndex].text)],[['t-nf'],'Jørgen']);
  await p1.click('[data-own="alle"]');
  // ---------- navnebytte ødelegger ikke historikken ----------
  const audBefore=JSON.stringify(aud('t-d1'));
  await view(p1,'data'); await p1.click('[data-dsec="team"]'); await p1.waitForTimeout(150); await p1.fill('[data-tmname="m-phillip"]','Philip'); await p1.click('[data-tmsave="m-phillip"]'); await p1.waitForTimeout(500);
  check('T18 navnet endres ett sted, ID-en er den samme',[store.members['m-phillip'].name,store.deals['t-d1'].ownerId,JSON.stringify(aud('t-d1'))===audBefore],['Philip','m-phillip',true]);
  check('T18 navnebyttet er selv logget med konto',aud('m-phillip','name').map(a=>a.byName+' | '+a.action+' | '+a.changes.find(c=>c.f==='name').old+'>'+a.changes.find(c=>c.f==='name').new),['Jørgen Test | endret visningsnavn | "Phillip">"Philip"']);
  await view(p1,'pipeline'); check('T18 nytt navn vises på kortet',await txt(p1,'[data-deal="t-d1"] .own'),'PPhilip');
  await openOrg(p1,'t-nf','historikk'); check('T18 endringsloggen viser nytt navn for samme ID, og hvem som gjorde hva',await txt(p1,'.drawer .audit'),v=>/Jørgen Test som Jørgen \(selvvalgt profil\) endret saksansvarlig for saken «\[TEST\] Høstlansering»/.test(v)&&/AnsvarligJørgen→Philip/.test(v)&&/AnsvarligUfordelt→Jørgen/.test(v));
  await view(p2,'idag'); await p2.waitForTimeout(200); check('T18 den andre brukeren ser navnebyttet uten ny lasting',await txt(p2,'#team'),v=>/Philip/.test(v));
  // ---------- kobling til innlogget konto ----------
  await kill(p1); await view(p1,'data'); await p1.click('[data-dsec="team"]'); await p1.waitForTimeout(150);
  check('T19 Team-siden sier rett ut hva profil og kobling er',await txt(p1,'.dbody'),v=>/Profilvalg er ikke innlogging/.test(v)&&/Tildeling er ikke tilgang/.test(v)&&/ingen administrator eller roller/.test(v)&&/Innlogget kontoJørgen Test \(fra innloggingen hos Claude\)/.test(v)&&/Jobber somJørgen \(valgt i denne nettleseren, ikke innlogging\)/.test(v));
  check('T19 ingen e-post eller kontokobling er funnet på',Object.values(store.members||{}).map(m=>[m.accountId,Object.keys(m).some(k=>/mail|epost|e-post/i.test(k))].join('|')),['|false']);
  await p1.click('[data-tmlink="m-jorgen"]'); await p1.waitForTimeout(500);
  check('T20 kobling lagrer den innloggede kontoens ID, gjort av brukeren selv',[store.members['m-jorgen'].accountId,aud('m-jorgen','accountId').map(a=>a.by+' | '+a.action)],['u1',['u1 | koblet teammedlem til egen konto']]);
  check('T20 topplinjen viser den koblede profilen i stedet for profilvalg',[await txt(p1,'#team'),!!(await p1.$('#actAs'))],v=>/Jørgen/.test(v[0])&&!/selvvalgt|Jobber som/.test(v[0])&&v[1]===false);
  await p2.waitForTimeout(300); check('T20 en annen konto kan ikke velge den koblede profilen, og kan ikke fjerne koblingen',[await p2.$eval('#actAs option[value="m-jorgen"]',e=>e.disabled),await (async()=>{ await view(p2,'data'); await p2.click('[data-dsec="team"]'); await p2.waitForTimeout(150); return (await p2.$$('[data-tmunlink]')).length; })()],[true,0]);
  await view(p1,'pipeline'); await p1.click('[data-own="mine"]'); await p1.waitForTimeout(200);
  check('T21 «Mine» bygger nå på konto-ID: eldre sak med kontoens ID som ansvarlig regnes som Jørgens',[(await cards(p1)).includes('t-d5'),await txt(p1,'[data-deal="t-d5"] .own'),await txt(p1,'.ownf')],v=>v[0]===true&&v[1]==='JJørgen'&&!/ikke innlogging/.test(v[2]));
  await p1.click('[data-own="alle"]');
  // ---------- tildeling er ikke tilgang ----------
  await openDeal(p2,'t-d4','detaljer'); await p2.fill('[data-d="notes"]','[TEST] Phillip redigerer Jørgens sak'); await p2.click('#dSave'); await p2.waitForTimeout(450);
  check('T22 en som ikke er ansvarlig kan fortsatt åpne og endre saken',[store.deals['t-d4'].ownerId,store.deals['t-d4'].notes,store.deals['t-d4'].updatedByName],['m-jorgen','[TEST] Phillip redigerer Jørgens sak','Phillip Test']);
  await kill(p2);
  // ---------- varsel som ikke blir lagret ----------
  await openDeal(p1,'t-d2'); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(200); await p1.selectOption('#asgTo','m-phillip'); await p1.evaluate(()=>{ window.__failPath='notices/'; }); await p1.click('#asgGo'); await p1.waitForTimeout(900);
  check('T23 varselet ble ikke lagret: det vises ikke som levert',[store.deals['t-d2'].ownerId,nts().filter(n=>n.entityId==='t-d2').length,await modal(p1)],v=>v[0]==='m-phillip'&&v[1]===0&&/Varselet til Philip er ikke bekreftet lagret\. Si fra selv/.test(v[2]));
  await p1.evaluate(()=>{ window.__failPath=''; }); await kill(p1); await p1.evaluate(()=>document.querySelector('#syncRetry')?.click()); await p1.waitForTimeout(500);
  // ---------- frakoblet ----------
  await openDeal(p1,'t-d5'); await p1.context().setOffline(true); await p1.waitForTimeout(100); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(150); await p1.selectOption('#asgTo','m-phillip'); await p1.click('#asgGo'); await p1.waitForTimeout(500);
  check('T24 frakoblet: ansvar endres ikke, og det sies hvorfor',[store.deals['t-d5'].ownerId,await modal(p1)],v=>v[0]==='u1'&&/Du er frakoblet\. Ansvar kan bare endres når du er tilkoblet/.test(v[1]));
  await p1.context().setOffline(false); await kill(p1); await p1.waitForTimeout(400);
  // ---------- deaktivert person ----------
  await view(p2,'data'); await p2.click('[data-dsec="team"]'); await p2.waitForTimeout(150); await p2.click('[data-tmact="m-phillip|0"]'); await p2.waitForTimeout(500);
  await openDeal(p1,'t-d5'); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(200);
  check('T25 deaktivert person tilbys ikke for nye tildelinger, men eksisterende ansvar vises fortsatt',[await p1.$$eval('#asgTo option',e=>e.map(o=>o.textContent)),await p1.evaluate(()=>__salong.ownName(__salong.S.deals['t-d1'].ownerId))],[['Velg','Ufordelt','Jørgen'],'Philip']);
  await kill(p1); await p2.click('[data-tmact="m-phillip|1"]'); await p2.waitForTimeout(400);
  // ---------- ny sak ----------
  await p1.click('#newDeal'); await p1.waitForTimeout(250);
  check('T30 ny sak: saksansvarlig er foreslått som den du jobber som, og kan endres før lagring',[await p1.$eval('#dOwner',e=>e.value),await p1.$$eval('#dOwner option',e=>e.map(o=>o.textContent))],['m-jorgen',['Ufordelt','Jørgen','Philip']]);
  await p1.selectOption('[data-d="orgId"]','t-nfo'); await p1.fill('[data-d="title"]','[TEST] Ny ufordelt sak'); await p1.selectOption('#dOwner',''); await p1.click('#dSave'); await p1.waitForTimeout(500);
  check('T30 lagret som ufordelt',Object.values(store.deals).filter(d=>d.title==='[TEST] Ny ufordelt sak').map(d=>d.ownerId),[null]);
  await kill(p1);
  // ---------- lagring og gjenåpning ----------
  await p2.reload(); await p2.waitForTimeout(700); await view(p2,'pipeline');
  check('T26 etter ny lasting: ansvar hentes fra databasen, profilvalget fra nettleseren',[await txt(p2,'[data-deal="t-d1"] .own'),await p2.$eval('#actAs',e=>e.value),store.deals['t-d1'].ownerId],['PPhilip','m-phillip','m-phillip']);
  await p2.setViewportSize({width:390,height:800}); await openDeal(p2,'t-d1'); await p2.click('.drawer header [data-assign]'); await p2.waitForTimeout(250);
  check('T27 mobilbredde: dialogen får plass uten sideveis rulling',await p2.evaluate(()=>{ const r=document.querySelector('.modal').getBoundingClientRect(); return [r.left>=0,r.right<=innerWidth,document.scrollingElement.scrollWidth<=innerWidth]; }),[true,true,true]);
  await p2.screenshot({path:require('./h.js').SHOT+'/asg_mobil.png'}); await kill(p2); await p2.evaluate(()=>window.scrollTo(0,0)); await p2.screenshot({path:require('./h.js').SHOT+'/top_mobil.png'}); check('T27 mobilbredde: topplinjen med «Jobber som» gir ikke sideveis rulling',await p2.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true); await p2.setViewportSize({width:1440,height:900});
  await openDeal(p1,'t-d1'); await p1.click('.drawer header [data-assign]'); await p1.waitForTimeout(250); await p1.selectOption('#asgTo','m-jorgen'); await p1.waitForTimeout(150); await p1.screenshot({path:require('./h.js').SHOT+'/asg_bred.png'}); await kill(p1);
  await view(p1,'pipeline'); await p1.screenshot({path:require('./h.js').SHOT+'/pipe_own.png'});
  check('T28 ingen KI er brukt i noe av dette',await p1.evaluate(()=>__prompts.length),0);
  }catch(e){ e0=e; }
  await A.done(e0);
  const B=await setup({ai:false,users:[{id:'u9',name:'Lese Test',readOnly:true}]}); let e1=null;
  try{ const p=B.p; await p.selectOption('#actAs','m-jorgen'); await p.evaluate(()=>__salong.openDeal('t-d1')); await p.waitForTimeout(250);
    B.check('T29 lesetilgang: ingen knapper for tildeling, og et direkte forsøk avvises uten skriving',[await B.txt(p,'.drawer header .own-row'),await p.evaluate(()=>__salong.doAssign({kind:'deal',id:'t-d1',to:'m-jorgen',expect:null}).then(r=>r.error)),B.writes.length],['SaksansvarligUfordelt','Du har lesetilgang og kan ikke endre ansvar.',0]); }catch(e){ e1=e; }
  await B.done(e1);
})();
