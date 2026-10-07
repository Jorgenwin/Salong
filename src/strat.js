/* ---------- Strategi: posisjonering, arenaer, økonomi og fase, synlig innsats ----------
   Ingen tall er hentet fra kontrakten: den er ikke lest av Salong. Økonomitallene er dine egne inndata og CRM-tall, merket som antakelser der de er det.
   Kildefakta om arenaer er hentet fra åpne sider 2026-10-06. «Hvem arrangerte hvor» bygger på Wave 1-researchen i Salong, med kilde per account. */
UI.sx={vp:25,ep:60,pp:60};
const ST_SRC={
  eh:[['Oslo Event Hub: kapasitet og oppsett','https://www.osloeventhub.com/capacity-set-ups'],['Oslo Event Hub: eventlokaler','https://www.osloeventhub.com/eventlokaler-oslo'],['Konferanse.no om Oslo Event Hub','https://konferanse.no/oslo/oslo-sentrum/oslo-event-hub'],['Oslo Event Hub: pris 2025','https://www.osloeventhub.com/blogg/best-conference-and-event-venue-in-norway']],
  mu:[['MUNCH: Festsal','https://www.munch.no/leie-lokaler/festsal/'],['MUNCH: Toppsal','https://www.munch.no/leie-lokaler/toppsal/'],['MUNCH: Knausgård og Kotche i Festsal','https://www.munch.no/hva_skjer/ultima-knausgard/'],['MUNCH: Jazz på MUNCH','https://www.munch.no/hva_skjer/jazz-pa-munch-daniel-herskedal/'],['MUNCH: Gjenfødt Kultur','https://www.munch.no/en/whats-on/gjenfodt-kultur/']],
  lh:[['Litteraturhuset: leie av lokaler','https://www.litteraturhuset.no/nb/leie-lokaler'],['Litteraturhuset øker kapasiteten','https://www.litteraturhuset.no/nb/artikkel/litteraturhuset-oker-kapasiteten'],['Litteraturhuset: vilkår for leie','https://www.litteraturhuset.no/nb/vilkar-for-leie']]};
const stLinks=L=>L.map(([t,u])=>'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+'</a>').join(' · ');

function stratPos(){
  const col=(h,items)=>'<div class="sg-col"><h4>'+h+'</h4><ul>'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul></div>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Hva Litteraturhuset er, og ikke er</h3><span class="mt-hint">Forslag til posisjon. Rett det du er uenig i.</span></div><div class="sg-two">'+
   col('Er',['Et litteratur- og kulturhus i Oslo sentrum. I 2025 ble det holdt 1 616 arrangementer på huset.','Et hus som nesten dobler kapasiteten i 2027: fire nye store formidlingssaler, og Solstad med plass til opptil 320 i stolrader.','Scene, seter og profesjonell teknikk. Det er det arrangører faktisk etterspør, resten kan formes.','Rimelig leie, og rabatt for åpne arrangementer om litteratur, politikk og samfunn.'])+
   col('Er ikke',['Ikke en messehall eller et festlokale. Oslo Event Hub tar opptil 850 stående og har scener i begge saler.','Ikke primært et sted for stand-up og show.','Ikke et museum med utstillinger som ramme, slik MUNCH er, med egen konsertserie og flygel i Festsal.'])+'</div>'+
   '<p class="sg-pos"><b>Posisjon:</b> den foretrukne arenaen for det som handler om ord, ideer og samtale: lanseringer, debatt, seminarer, kulturproduksjoner og konserter som hører hjemme i et litteraturhus. Bedriftsarrangementer er velkomne, men er ikke det vi bygger merkevaren på.</p>'+
   '<p class="mt-hint">Kilder: '+stLinks(ST_SRC.lh)+'. Solstad-tallet er hentet fra tekstene i Salong.</p></section>'; }

function stratArenas(){
  const row=(n,kap,mix,src)=>'<tr><th scope="row">'+n+'</th><td>'+kap+'</td><td>'+mix+'</td><td class="sg-s">'+stLinks(src)+'</td></tr>';
  const table='<div class="tbl mt-tw"><table class="mt-t sg-t"><thead><tr><th>Arena</th><th>Kapasitet og scene</th><th>Eventmiks (offentlige kilder)</th><th>Kilder</th></tr></thead><tbody>'+
   row('Oslo Event Hub','Over 2 000 m² på tre etasjer. Opptil 850 ved mingling og 700 i konferanse. Hovedsal 500 i kino, Big Time 220. Scene i begge saler, 14 til 16 skjermer.','Konferanser, messer, produktlanseringer (biler kan kjøres inn), firmafester, julebord, premierefester og moteshow. Over 130 arrangementer i 2024.',ST_SRC.eh)+
   row('MUNCH','Festsal 480 m²: 500 stående, 350 sittende, 274 i tribune. Toppsal 150 stående. Amfi 47 seter. Flygel og motorisert rigg.','Utleie til konferanser, seminarer, streaming og banketter, pluss egne konserter og samtaler: Ultima, Jazz på MUNCH, Gjenfødt Kultur, Ung Scene.',ST_SRC.mu)+
   row('Litteraturhuset','Syv saler i dag, blant dem Wergeland (178 m²). Fire nye store saler i 2027, Solstad opptil 320.','Seminarer, lanseringer, debatter, workshops og kulturproduksjoner. Egne arrangementer: 1 616 i 2025.',ST_SRC.lh)+'</tbody></table></div>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Hvorfor folk velger de store arenaene</h3><span class="mt-hint">Lest 6. oktober 2026</span></div>'+table+
   '<p class="sg-pos">Det som går igjen: plass til mange, en scene og seter, god teknikk og et sted folk vil være. Det er også det vi må vinne på. Event Hub vinner på størrelse og show, MUNCH på særpreg og musikk. Litteraturhuset kan vinne på ord, debatt og kultur, med nok kapasitet til å ta både store og små.</p></section>'; }

/* hvem arrangerte hvor: fra evsum.venues i Wave 1-researchen og berikede accounts */
const ST_VEN=[[/event\s*hub/i,'Oslo Event Hub'],[/munch/i,'MUNCH'],[/sentralen|marmorsalen/i,'Sentralen'],[/litteraturhuset/i,'Litteraturhuset'],[/konserthus/i,'Oslo Konserthus'],[/kulturhuset/i,'Kulturhuset'],[/håndverkeren/i,'Håndverkeren'],[/nova\s*spektrum|spektrum/i,'Oslo Spektrum / NOVA'],[/ambassaden/i,'Ambassaden'],[/operahuset|operaen/i,'Operaen'],[/deichman/i,'Deichman Bjørvika'],[/folketeateret/i,'Folketeateret'],[/vulkan/i,'Vulkan Arena'],[/rådhus/i,'Oslo rådhus']];
function stVenueName(v){ v=String(v||'').trim(); if(!v) return ''; for(const [re,n] of ST_VEN) if(re.test(v)) return n; return ''; }
function stratVenues(){
  const M={};
  for(const a of mtAll()){ const es=(a.doc&&a.doc.evsum)||a.evsum||(a.enr&&a.enr.evsum)||null; if(!es||!es.venues) continue;
    const seen=new Set(); for(const v of es.venues){ const n=stVenueName(v); if(!n||seen.has(n)) continue; seen.add(n); const m=M[n]=M[n]||{n,accs:[],types:{}}; m.accs.push(a); for(const t of es.types||[]) m.types[t]=(m.types[t]||0)+1; } }
  return Object.values(M).sort((x,y)=>y.accs.length-x.accs.length||x.n.localeCompare(y.n,'nb')); }
function stratWho(){
  const V=stratVenues(); if(!V.length) return '<section class="mt-sec"><div class="mt-sh"><h3>Hvem arrangerer hvor</h3></div><p class="mt-hint">Ingen arenaer er registrert på researchede accounts ennå. Kjør Berik, så fylles dette ut med kilde.</p></section>';
  const tt=m=>Object.entries(m.types).sort((x,y)=>y[1]-x[1]).slice(0,4).map(([t])=>t).join(', ');
  return '<section class="mt-sec"><div class="mt-sh"><h3>Hvem arrangerer hvor</h3><span class="mt-hint">Fra research på accountene dine. Hver kilde ligger i kontokortet. Dette er ikke kundelister, men arrangementer som er omtalt offentlig.</span></div><div class="tbl mt-tw"><table class="mt-t sg-t"><thead><tr><th>Arena</th><th class="n">Accounts</th><th>Typer</th><th>Eksempler</th></tr></thead><tbody>'+
   V.slice(0,12).map(m=>'<tr><th scope="row">'+esc(m.n)+'</th><td class="n">'+m.accs.length+'</td><td>'+esc(tt(m)||'–')+'</td><td class="sg-ex">'+m.accs.slice(0,6).map(a=>'<button type="button" class="lnk" data-stopen="'+esc(a.id)+'">'+esc(a.name)+'</button>').join(' · ')+(m.accs.length>6?' · +'+(m.accs.length-6):'')+'</td></tr>').join('')+'</tbody></table></div>'+
   '<p class="mt-hint">Accounts som arrangerer hos Event Hub, MUNCH eller Sentralen er de mest realistiske å flytte: de bruker allerede arenaer i vår størrelsesklasse.</p></section>'; }

/* økonomi og fase */
function stratEco(){
  const T=tierCfg(), E=T.eco, P=tierPhase(), today=mtToday();
  const ds=dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt), yr=String(T.end).slice(0,4);
  const inY=d=>String(d.date||'').slice(0,4)===yr;
  const booked=ds.filter(d=>d.stage==='bekreftet'&&inY(d)).reduce((s,d)=>s+dval(d),0);
  const pipe=ds.filter(d=>OPEN.includes(d.stage)&&inY(d)).reduce((s,d)=>s+dval(d)*(ST[d.stage]?ST[d.stage].p:0),0);
  const b0=mtAddD(T.start,-365), base12=ds.filter(d=>d.stage==='bekreftet'&&String(d.date||'')>=b0&&String(d.date||'')<T.start).reduce((s,d)=>s+dval(d),0);
  const base=E.base>0?E.base:base12, growth=Number(E.growth)||0, target=E.target>0?E.target:Math.round(base*(1+growth/100));
  const rem=Math.max(0,target-booked), remP=Math.max(0,target-booked-pipe);
  const g=g3Calc('y'), avg=g.avgVal||25000, fn=UI.fn||{c1:40,c2:60,c3:50};
  const nAg=Math.ceil(remP/Math.max(1,avg)), nOf=Math.ceil(nAg/Math.max(.05,fn.c3/100)), nDi=Math.ceil(nOf/Math.max(.05,fn.c2/100)), nCo=Math.ceil(nDi/Math.max(.05,fn.c1/100));
  const from=today>T.start?today:T.start, wk=Math.max(1,Math.round(Math.max(0,mtDays(from,T.end))/7));
  const months=Math.max(1,Math.round(mtDays(T.start,T.end)/30.4)), fee=Number(E.fee)||0, cost=fee*months, paid=Number(E.paid)||0;
  const elapsed=P.st==='før'?0:P.st==='etter'?1:Math.min(1,Math.max(0,mtDays(T.start,today)/Math.max(1,P.tot)));
  const act=actsOp().filter(x=>['meeting','visning'].includes(x.type)&&!x.derived&&!x.handover&&String(x.at||'').slice(0,10)>=T.start);
  const t1=mtAll().filter(a=>a.pt===1), t1c=t1.length?t1.filter(a=>a.flags.addressed).length/t1.length:0;
  const crit=[
   {k:'book',t:'Booket omsetning for '+yr,cur:booked,thr:Math.round(target*(Number(E.share)||0)/100),fmt:kr,note:(Number(E.share)||0)+' % av årsmålet er booket ved fasens slutt'},
   {k:'pipe',t:'Booket pluss vektet pipeline',cur:booked+pipe,thr:target,fmt:kr,note:'Sammen dekker de hele årsmålet'},
   {k:'vis',t:'Møter og visninger i fasen',cur:act.length,thr:Number(E.visits)||0,fmt:x=>String(x),note:'Loggede møter og visninger fra '+fd(T.start,{day:'numeric',month:'short'})},
   {k:'t1',t:'Tier 1 kontaktet',cur:Math.round(t1c*100),thr:Number(E.t1cov)||0,fmt:x=>x+' %',note:t1.length+' i Tier 1, adressert minst én gang'},
   {k:'ext',t:'Forlengelse av kontrakten avklart',cur:E.extended?1:0,thr:1,fmt:x=>x?'Avklart':'Ikke avklart',note:'Internt frist '+fd(E.extend,{day:'numeric',month:'short',year:'numeric'})+(E.extended?'':' · '+(mtDays(today,E.extend)>=0?mtDays(today,E.extend)+' dager igjen':'fristen er passert'))}];
  for(const c of crit){ const r=c.thr?c.cur/c.thr:0; c.pct=Math.min(1,r); c.st=r>=1?'Nådd':P.st==='før'?'Ikke startet':r>=elapsed?'På vei':'Etter plan'; }
  return {T,E,P,booked,pipe,base,base12,growth,target,rem,remP,avg,nAg,nOf,nDi,nCo,wk,months,fee,cost,paid,crit,elapsed,yr,act,t1}; }
function stratEcoHTML(){
  const X=stratEco(), E=X.E, T=X.T, inp=(k,v,ph,w)=>'<input class="in sg-in" type="number" min="0" step="'+(w||1000)+'" value="'+(v||'')+'" placeholder="'+(ph||'')+'" data-steco="'+k+'">';
  const f=(l,i,h)=>'<label class="f"><span>'+l+'</span>'+i+(h?'<small>'+h+'</small>':'')+'</label>';
  const inputs='<div class="sg-fg">'+
   f('Fase starter','<input class="in sg-in" type="date" value="'+esc(T.start)+'" data-stphase="start">')+f('Fase slutter','<input class="in sg-in" type="date" value="'+esc(T.end)+'" data-stphase="end">')+
   f('Månedlig honorar (kr)',inp('fee',E.fee,'fra kontrakten'),'Valgfritt. Brukes kun til forholdstall.')+f('Utbetalt hittil (kr)',inp('paid',E.paid,'0'))+
   f('Utleieinntekt siste 12 mnd (kr)',inp('base',E.base,X.base12?'CRM: '+tierKr(X.base12):'fra regnskapet'),'Tomt = bekreftede saker i CRM')+f('Ønsket vekst (%)',inp('growth',E.growth,'30',5),'Antakelse. Kapasiteten nesten dobles i 2027.')+
   f('Årsmål (kr), overstyring',inp('target',E.target,tierKr(X.target)),'Tomt = grunnlag × (1 + vekst)')+f('Booket ved fasens slutt (%)',inp('share',E.share,'50',5),'Terskel for vellykket halvår')+
   f('Møter og visninger i fasen',inp('visits',E.visits,'40',5))+f('Tier 1 kontaktet (%)',inp('t1cov',E.t1cov,'90',5))+f('Frist for forlengelse','<input class="in sg-in" type="date" value="'+esc(E.extend)+'" data-stext="extend">')+
   '<label class="f sg-ck"><span>Forlengelse</span><span><input type="checkbox" data-stext="extended"'+(E.extended?' checked':'')+'> Avtalt</span></label></div>';
  const cards='<div class="sg-cards">'+[['Årsmål '+X.yr,tierKr(X.target)+' kr',X.base?'grunnlag '+tierKr(X.base)+' + '+X.growth+' %':'sett grunnlag eller årsmål'],['Booket '+X.yr,tierKr(X.booked)+' kr',(X.target?Math.round(X.booked/X.target*100):0)+' % av målet'],['Vektet pipeline',tierKr(X.pipe)+' kr','åpne saker med dato i '+X.yr],['Gjenstår å selge',tierKr(X.rem)+' kr','før pipeline: '+tierKr(X.remP)+' kr etter pipeline']].map(([a,b,c])=>'<div class="sg-card"><span>'+a+'</span><b>'+b+'</b><small>'+c+'</small></div>').join('')+'</div>';
  const chain=X.target?'<p class="sg-chain">For å dekke det som mangler etter pipeline ('+tierKr(X.remP)+' kr) trengs omtrent <b>'+X.nAg+'</b> avtaler à '+tierKr(X.avg)+' kr, <b>'+X.nOf+'</b> tilbud, <b>'+X.nDi+'</b> dialoger og <b>'+X.nCo+'</b> kontakter. Det er <b>'+Math.ceil(X.nCo/X.wk)+'</b> nye kontakter per uke de neste '+X.wk+' ukene. Treffprosentene er funnelens antakelser ('+UI.fn.c1+' / '+UI.fn.c2+' / '+UI.fn.c3+' %).</p>':'<p class="mt-hint">Fyll inn grunnlag og vekst for å se hva som må selges.</p>';
  const ratio=X.fee?'<p class="sg-chain">Stillingen koster '+tierKr(X.cost)+' kr over '+X.months+' måneder'+(X.paid?', hvorav '+tierKr(X.paid)+' kr er utbetalt':'')+'. Booket omsetning for '+X.yr+' er '+(X.cost?(X.booked/X.cost).toLocaleString('nb-NO',{maximumFractionDigits:1}):'–')+' ganger det. Dette er omsetning, ikke fortjeneste.</p>':'';
  const crit='<div class="tbl mt-tw"><table class="mt-t sg-t"><thead><tr><th>Kriterium for vellykket halvår</th><th>Nå</th><th>Terskel</th><th>Status</th></tr></thead><tbody>'+X.crit.map(c=>'<tr><th scope="row">'+esc(c.t)+'<small>'+esc(c.note)+'</small></th><td class="n">'+esc(c.fmt(c.cur))+'</td><td class="n">'+esc(c.fmt(c.thr))+'</td><td><span class="sg-s2 '+({'Nådd':'ok','På vei':'pa','Etter plan':'late','Ikke startet':'no'})[c.st]+'">'+c.st+'</span><span class="mt-bt sg-bar"><i style="width:'+Math.round(c.pct*100)+'%"></i></span></td></tr>').join('')+'</tbody></table></div>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Økonomi og fase</h3><span class="mt-hint">'+esc(X.P.line)+'</span></div>'+
   '<p class="mt-note">Salong har ikke lest kontrakten din. Fyll inn tallene under, så regnes målet, det som gjenstår og terskelene ut fra dem og fra sakene i CRM. Seksmånedersmålet under Mål og prognose endres ikke av dette.</p>'+
   cards+chain+ratio+crit+'<details class="ts-dt"><summary>Endre tall og terskler</summary>'+inputs+'</details>'+
   '<p class="sg-pos"><b>Et vellykket år</b> er at '+X.yr+'-målet er booket og at kontrakten er forlenget. <b>Et vellykket første halvår</b> er at kriteriene over er nådd ved '+fd(T.end,{day:'numeric',month:'long'})+', og at forlengelsen er avklart innen fristen.</p></section>'; }

/* synlig innsats og kontaktplan */
function stratEffort(){
  const T=tierCfg(), today=mtToday(), from=mtAddD(today,-90), tierOf={}, nameOf={}; for(const a of mtAll()){ tierOf[a.id]=a.pt||0; nameOf[a.id]=a.name; }
  const TY={call:'Samtale',email:'E-post',meeting:'Møte',visning:'Visning'};
  const done=actsOp().filter(x=>TY[x.type]&&!x.derived&&!x.handover&&!/^E-postutkast laget/.test(x.text||'')&&String(x.at||'').slice(0,10)>=from&&(nameOf[x.orgId]||S.orgs[x.orgId])).sort((x,y)=>String(y.at).localeCompare(String(x.at)));
  const rowsDone=done.map(x=>({org:nameOf[x.orgId]||orgName(x.orgId),id:x.orgId,tier:tierOf[x.orgId]||0,person:x.pname||'',type:TY[x.type],date:String(x.at).slice(0,10),note:(x.text||'').slice(0,140)}));
  const planA=mtAll().filter(a=>a.nx&&a.nx.due&&['step','followup'].includes(a.nx.k)&&!a.dncAcc&&!a.flags.disqualified).map(a=>({org:a.name,id:a.id,tier:a.pt||0,person:(a.active[0]&&a.active[0].name)||'',type:a.nx.k==='step'?MT_CH[a.prog.next.ch]:'Oppfølging',date:a.nx.due,note:a.nx.t}));
  const planT=openTasksOp().filter(x=>x.due).map(x=>({org:nameOf[x.orgId]||(S.orgs[x.orgId]?orgName(x.orgId):''),id:x.orgId,tier:tierOf[x.orgId]||0,person:'',type:'Oppgave',date:String(x.due).slice(0,10),note:(x.text||'').slice(0,140)}));
  const plan=planA.concat(planT).sort((x,y)=>x.date.localeCompare(y.date)||x.tier-y.tier);
  const orgsDone=new Set(done.map(x=>x.orgId)), met=new Set(done.filter(x=>['meeting','visning'].includes(x.type)).map(x=>x.orgId)), ppl=new Set(done.filter(x=>x.pname).map(x=>x.orgId+'|'+x.pname));
  const n30=plan.filter(x=>x.date<=mtAddD(today,30)).length;
  return {rowsDone,plan,stats:{orgs:orgsDone.size,met:met.size,people:ppl.size,n30,planN:plan.length}}; }
function stratEffortHTML(){
  const X=stratEffort(), U=UI.sx, TY=n=>n?tierShort(n):'–';
  const cards='<div class="sg-cards">'+[['Organisasjoner kontaktet','siste 90 dager',X.stats.orgs],['Organisasjoner møtt','møter og visninger',X.stats.met],['Personer registrert','kontaktet med navn',X.stats.people],['Planlagt neste 30 dager',X.stats.planN+' i planen totalt',X.stats.n30]].map(([a,b,c])=>'<div class="sg-card"><span>'+a+'</span><b>'+c+'</b><small>'+b+'</small></div>').join('')+'</div>';
  const link=r=>r.id&&mtGet(r.id)?'<button type="button" class="lnk" data-stopen="'+esc(r.id)+'">'+esc(r.org)+'</button>':esc(r.org);
  const t=(L,n,k,hd)=>L.length?'<div class="tbl mt-tw"><table class="mt-t sg-t"><thead><tr><th>Organisasjon</th><th>Tier</th><th>Person</th><th>'+hd+'</th><th>Dato</th><th>Notat</th></tr></thead><tbody>'+L.slice(0,U[k]).map(r=>'<tr><td class="mt-o">'+link(r)+'</td><td>'+TY(r.tier)+'</td><td>'+esc(r.person)+'</td><td>'+esc(r.type)+'</td><td>'+esc(mtFd(r.date))+'</td><td class="sg-n">'+esc(r.note)+'</td></tr>').join('')+'</tbody></table></div>'+(L.length>U[k]?'<div class="row" style="justify-content:center"><button type="button" class="btn sm" data-stmore="'+k+'">Vis flere ('+(L.length-U[k])+' igjen)</button></div>':''):'<p class="mt-hint">'+n+'</p>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Synlig innsats og kontaktplan</h3><span class="mt-hint">Det du har gjort, og det som kommer. Lag en fil du kan vise Litteraturhuset.</span></div>'+cards+
   '<div class="row"><button type="button" class="btn primary" data-stexport="1">Last ned oversikt (CSV)</button><button type="button" class="btn ghost" data-stcopy="1">Kopier som tekst</button></div>'+
   '<h4 class="ts-h">Planlagte kontakter</h4>'+t(X.plan,'Ingen planlagte kontakter ennå. Legg accounts i en sekvens, så fylles planen.','pp','Hva')+
   '<h4 class="ts-h">Møtt og kontaktet, siste 90 dager</h4>'+t(X.rowsDone,'Ingen registrert kontakt siste 90 dager. Logg samtaler og møter i kontokortet.','ep','Type')+'</section>'; }
function stratCsv(){ const X=stratEffort(), q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"'; const H=['Rad','Organisasjon','Tier','Person','Type','Dato','Notat'];
  const L=[H.map(q).join(';')]; for(const r of X.rowsDone) L.push(['Kontaktet',r.org,tierName(r.tier),r.person,r.type,r.date,r.note].map(q).join(';')); for(const r of X.plan) L.push(['Planlagt',r.org,tierName(r.tier),r.person,r.type,r.date,r.note].map(q).join(';')); return '﻿'+L.join('\r\n'); }
function stratTxt(){ const X=stratEffort(); const s=X.stats; return 'Innsats siste 90 dager: '+s.orgs+' organisasjoner kontaktet, '+s.met+' møtt, '+s.people+' personer. Planlagt de neste 30 dagene: '+s.n30+' kontakter ('+s.planN+' totalt i planen).\n\nPlanlagt:\n'+X.plan.slice(0,40).map(r=>'- '+r.date+' · '+r.org+(r.person?' ('+r.person+')':'')+' · '+r.type).join('\n'); }

/* telefonpitch */
function stratPitch(){
  const T=tierCfg();
  return '<section class="mt-sec"><div class="mt-sh"><h3>Telefonpitch</h3><span class="mt-hint">Brukes i Tier 1 og Tier 2. Samtalestøtte ligger også i kontokortet.</span></div>'+
   '<ol class="tp-sc sg-sc"><li>«Hei, jeg heter '+esc((me.name||'…').split(/\s+/)[0])+' og har begynt hos Litteraturhuset. Vi har åpnet mer kapasitet, og jeg ville høre om dere planlegger noe i Oslo i 2027.»</li><li>Spør om type, størrelse og tidspunkt. Lytt etter hva de mangler i dag: plass, scene, seter eller en god ramme.</li><li>«Det beste er å se stedet. Kan jeg vise dere rundt?»</li><li>Ingen stress: <span id="stCancelTxt">'+esc(T.cancel)+'</span></li></ol>'+
   '<label class="f"><span>Formulering om avbestilling og binding</span><textarea class="in" id="stCancel" rows="2" data-stcancel="1">'+esc(T.cancel)+'</textarea></label>'+
   '<p class="mt-note warn">Du har sagt at begge parter kan avslutte med seks måneders varsel. Litteraturhusets publiserte leievilkår sier derimot at kunder kan avbestille senest 28 dager før arrangementet (50 % faktureres etter fristen). Sjekk hvilken regel som gjelder for deg før du nevner «seks måneder», og skriv det inn her når det er bekreftet. Teksten flettes inn i e-postmalene som {avbestilling}. <a href="'+ST_SRC.lh[2][1]+'" target="_blank" rel="noopener">Vilkårene</a></p></section>'; }

function stratHTML(){ return '<div class="sg">'+stratEcoHTML()+stratEffortHTML()+stratPos()+stratArenas()+stratWho()+stratPitch()+'</div>'; }

if(!window.__stWired){ window.__stWired=1;
  document.addEventListener('change',async e=>{ const t=e.target; if(!t||!t.closest) return; let b;
    if((b=t.closest('[data-steco]'))){ await tierSave({eco:{[b.dataset.steco]:Number(b.value)||0}}); renderView(true); return; }
    if((b=t.closest('[data-stext]'))){ const k=b.dataset.stext; await tierSave({eco:{[k]:k==='extended'?b.checked:b.value}}); renderView(true); return; }
    if((b=t.closest('[data-stphase]'))){ if(b.value) await tierSave({[b.dataset.stphase]:b.value}); renderView(true); return; }
    if((b=t.closest('[data-stcancel]'))){ await tierSave({cancel:b.value.trim()}); toast('Formuleringen er lagret'); renderView(true); return; } });
  document.addEventListener('click',async e=>{ const t=e.target; if(!t||!t.closest) return; let b;
    if((b=t.closest('[data-stopen]'))){ mtOpen(b.dataset.stopen); return; }
    if((b=t.closest('[data-stmore]'))){ UI.sx[b.dataset.stmore]+=60; renderView(true); return; }
    if((b=t.closest('[data-stexport]'))){ await mtSave('salong-innsats-'+mtToday()+'.csv',stratCsv()); return; }
    if((b=t.closest('[data-stcopy]'))){ copyText(stratTxt(),null); return; } }); }
