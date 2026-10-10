/* ---------- idcmd.js: I dag som kommandosentral ----------
   Fire blokker: DAGEN MIN (møter, befaringer, frister i dag), NYTT SIDEN SIST (nye forespørsler, svar, fullført berikelse siden forrige besøk),
   KONTAKT I DAG (personer i sekvens eller klare for første kontakt) og MÅ FØLGES OPP (forfalt, svar vi skylder, tilbud uten aktivitet).
   Tomme blokker vises ikke. Når alt er gjort, vises bare ett eller to forslag fremover. Ingen nye lister: alt leses fra eksisterende
   kø (idItems), kalender (kalItems), Prospekter (mtAll) og berikelsesjobber (mtjob). «Sist sett» lagres bare i denne nettleseren. */
const idcStore=(()=>{ let st={seen:null,prev:null};
  try{ const r=JSON.parse(storeLocal('get','idseen')||'null'); if(r&&typeof r==='object') st={seen:r.seen||null,prev:r.prev||null}; }catch(e){}
  const now=Date.now(); if(!st.seen||now-new Date(st.seen).getTime()>30*60*1000){ st={prev:st.seen||st.prev,seen:new Date(now).toISOString()}; try{ storeLocal('set','idseen',JSON.stringify(st)); }catch(e){} }
  return st; })();
function idcSince(){ if(idcStore.prev) return new Date(idcStore.prev); const d=new Date(); d.setDate(d.getDate()-2); return d; }
function idcMarkSeen(){ idcStore.prev=new Date().toISOString(); try{ storeLocal('set','idseen',JSON.stringify(idcStore)); }catch(e){} }
function idcHello(){ const h=new Date().getHours(); return (h<10?'God morgen':h<17?'God dag':'God kveld')+(idGreeting().replace(/^God dag/,'')); }
const idcAgo=s=>{ const m=Math.round((Date.now()-new Date(s))/6e4); return m<60?Math.max(1,m)+' min siden':m<1440?Math.round(m/60)+' t siden':idAgoD(s); };

/* NYTT SIDEN SIST */
function idcNew(){
  const since=idcSince(), t=since.getTime(), out=[], accOk=a=>a&&!a.flags.disqualified&&!a.dncAcc;
  for(const d of dealsOp()){ if(!idDealOk(d)||d.stage!=='ny'||!idInScope(d.ownerId,true)) continue; const c=new Date(d.createdAt||0).getTime(); if(c<t) continue;
    out.push({at:d.createdAt,k:'enq',t:'Ny forespørsel',o:orgName(d.orgId),s:d.title||'',open:'deal:'+d.id,key:'deal:'+d.id+':ny'}); }
  if(typeof mtAll==='function'){
    for(const a of mtAll()){ if(!accOk(a)||!idInScope(a.ownerId,false)) continue; const r=a.seq&&a.seq.repliedAt; if(r&&new Date(r+'T12:00:00').getTime()>=t-864e5&&(a.seq.repliedAt>=idIso(since))) out.push({at:r,k:'reply',t:'Svar mottatt',o:a.name,s:'',open:'mt:'+a.id,key:'acc:'+a.id+':svar'}); }
    const done=Object.entries(S.mtjob||{}).map(([id,j])=>({id,...j})).filter(j=>['done','completed'].includes(j.status)&&j.completed_at&&new Date(j.completed_at).getTime()>=t&&mtGet(j.accId));
    if(done.length){ const n=done.reduce((s,j)=>s+(Number(j.contacts_found)||0),0); out.push({at:done.map(j=>j.completed_at).sort().slice(-1)[0],k:'enr',t:done.length+' '+idPlural(done.length,'account','accounts')+' beriket',o:'',s:n?n+' '+idPlural(n,'kontakt','kontakter')+' funnet':'ingen nye kontakter',open:'go:prosp-arb',key:'enr'}); } }
  for(const x of actsOp()){ if(x.dir!=='in'||x.derived||!x.orgId||!S.orgs[x.orgId]||S.orgs[x.orgId].deletedAt) continue; if(new Date(x.at||0).getTime()<t) continue; if(out.some(o=>o.open==='mt:'+x.orgId||o.open==='deal:'+x.dealId)) continue;
    out.push({at:x.at,k:'in',t:'Innkommende',o:orgName(x.orgId),s:String(x.text||'').slice(0,80),open:x.dealId?'deal:'+x.dealId:'org:'+x.orgId,key:'in:'+x.id}); }
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at))); }
function idcNewRow(x){ return '<li class="idc-r"><div class="idc-m"><b>'+esc(x.o||x.t)+'</b><span>'+esc(x.o?x.t+(x.s?' · '+x.s:''):x.s)+'</span></div><span class="idc-w">'+esc(idcAgo(x.at))+'</span><button type="button" class="id-go" data-idcopen="'+esc(x.open)+'">Åpne <span aria-hidden="true">→</span></button></li>'; }

/* DAGEN MIN */
function idcDay(){ const td=kalToday(); let L=[]; try{ L=kalItems(td,td).filter(i=>idInScope(i.owner,true)); }catch(e){}
  const Q=idQueue().vis.filter(i=>i.rank===3&&i.obj==='task'&&!i.dealId).map(i=>({time:'',kind:'due',org:i.org,title:i.action,room:'',owner:i.ownerId,status:'Frist',open:'task:'+i.key}));
  return L.concat(Q); }
function idcDayRow(it){ const bits=[it.org||it.title,it.room&&RM[it.room]?roomName(it.room):'',it.kind==='due'&&it.org&&it.title?it.title:''].filter(Boolean);
  return '<li class="idc-r"><span class="idc-t">'+(it.time||'Hele dagen')+'</span><div class="idc-m"><b>'+esc(bits[0])+'</b><span>'+esc(KAL_KIND[it.kind]+(bits.length>1?' · '+bits.slice(1).join(' · '):''))+'</span></div><button type="button" class="id-go" data-idcopen="'+esc(it.open||'')+'"'+(it.open?'':' disabled')+'>Åpne <span aria-hidden="true">→</span></button></li>'; }

/* KONTAKT I DAG: personer, ikke accounts uten noen å kontakte */
function idcContacts(){ const tk=i=>{ const a=mtGet(i.accId); return a&&a.pt?a.pt:9; }; return idQueue().vis.filter(i=>i.obj==='acc'&&(i.rank===5||i.rank===6)).map((i,n)=>[i,n]).sort((x,y)=>tk(x[0])-tk(y[0])||x[1]-y[1]).map(x=>x[0]); }
function idcTierLine(){ const St=tierStats(); if(![1,2,3].some(n=>St[n].n)) return ''; const P=tierPhase();
  return '<p class="idc-goal idc-tier"><b>Prioritet</b> · '+[1,2].map(n=>'Tier '+n+': '+St[n].contacted+' av '+St[n].n+' kontaktet siste 14 dager').join(' · ')+' · '+esc(P.st==='før'?'fase 1 starter om '+P.toS+' dager':P.st==='i'?P.toE+' dager igjen av fase 1':'fase 1 er avsluttet')+' <button type="button" class="lnk" data-idgo="pri">Åpne prioritet</button></p>'; }
function idcContactRow(it){ const a=mtGet(it.accId); if(!a) return ''; const p=a.active&&a.active[0], n=a.prog&&a.prog.next, cad=n?null:mtCadence(a).steps[0];
  const ch=n?MT_CH[n.ch]:cad&&cad.ch?MT_CH[cad.ch]:'', lo=a.touch&&a.touch.lastOut?String(a.touch.lastOut).slice(0,10):'';
  const who=p?'<b>'+esc(p.name)+'</b>'+(p.title?'<span> · '+esc(p.title)+'</span>':''):'<b>Ingen kontaktperson funnet</b><span> · '+esc((a.roles||[]).slice(0,2).join(', ')||'rolle ikke valgt')+'</span>';
  const why=String(a.why||'').replace(/\s+/g,' ').slice(0,120), st=(it.why||[])[0]||'';
  return '<li class="idc-r" data-key="'+esc(it.key)+'"><div class="idc-m"><div class="idc-p">'+ptChip(a)+' '+who+'</div><span>'+esc(a.name)+(a.seg?' · '+esc(mtSegShort(a.seg.name)):'')+'</span><span class="idc-why">'+esc(why)+'</span><span class="idc-meta">'+[ch?'Kanal: '+ch:'',lo?'Forrige touch '+fd(lo,{day:'numeric',month:'short'}):'Ikke kontaktet før'].filter(Boolean).map(esc).join(' · ')+'</span></div>'+
    '<div class="idc-ac"><button type="button" class="id-go" data-idopen="'+esc(it.key)+'">Åpne <span aria-hidden="true">→</span></button><button type="button" class="btn sm" data-idlog="'+esc(it.key)+'">Logg</button></div></li>'; }

/* MÅ FØLGES OPP */
function idcFollow(skip){ return idQueue().vis.filter(i=>[1,2,4].includes(i.rank)&&!skip.has(i.key)&&!(i.obj==='acc'&&i.rank===5)); }

function idcCount(n,s,p){ return '<span class="idc-c"><b>'+n+'</b> '+(n===1?s:p)+'</span>'; }
function idcSection(h,n,body,more){ return '<section class="idc-s"><div class="idc-h"><h3>'+h+'</h3><span>'+n+'</span></div><ul class="idc-l">'+body+'</ul>'+(more||'')+'</section>'; }
const IDC_MAX=6;
function idcList(arr,fn,open){ const a=arr.slice(0,IDC_MAX), r=arr.slice(IDC_MAX); return {body:a.map(fn).join(''),more:r.length?'<details class="idc-more"><summary>Vis '+r.length+' til</summary><ul class="idc-l">'+r.map(fn).join('')+'</ul></details>':''}; }
function idcDone(){
  const sug=[]; if(typeof mtStats==='function'){ const st=mtStats(); if(st.qualified-st.addressed>0) sug.push(['Start neste batch',(st.qualified-st.addressed)+' kvalifiserte accounts er ikke adressert','batch']);
    const cv=idCoverage(); if(cv&&cv.behind[0]) sug.push(['Bearbeid underdekket segment: '+mtSegShort(cv.behind[0].name),(cv.behind[0].qualified-cv.behind[0].addressed)+' ikke adressert','seg:'+cv.behind[0].id]); }
  return '<section class="idc-done"><h3>Dagens arbeid er gjort.</h3>'+(sug.length?'<ul>'+sug.slice(0,2).map(s=>'<li><button type="button" class="btn" data-idgo="'+esc(s[2])+'">'+esc(s[0])+'</button><span>'+esc(s[1])+'</span></li>').join('')+'</ul>':'')+'</section>'; }

function idDagHTML(){
  if(UI.id.focus){ const Q=idQueue(); UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i])); return idFocusHTML(Q); }
  const Q=idQueue(); UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i]));
  const P=planningService.getPlan(), prog=P.status==='active'||P.status==='upcoming'?idProgressHTML():P.status==='not_set'?'<p class="idc-goal">Ingen seksmånedersmål er satt. <button type="button" class="lnk" data-idgo="maal">Sett seksmånedersmål</button></p>':'';
  if(idNoData()&&!idGoalSet()) return '<header class="idn-hd"><h2>'+esc(idcHello())+'</h2></header>'+idEmpty(Q);
  const day=idcDay(), nw=idcNew(), ct=idcContacts(), nwKeys=new Set(nw.map(x=>x.key)), fu=idcFollow(nwKeys), meet=day.filter(i=>i.kind==='visit'||i.kind==='meet').length;
  const enq=dealsOp().filter(d=>idDealOk(d)&&d.stage==='ny'&&idInScope(d.ownerId,true)).length;
  const counts=[meet?idcCount(meet,'møte','møter'):'',ct.length?idcCount(ct.length,'kontakt i sekvens','kontakter i sekvens'):'',enq?idcCount(enq,'ny forespørsel','nye forespørsler'):'',fu.length?idcCount(fu.length,'oppfølging','oppfølginger'):''].filter(Boolean);
  const S1=day.length?(()=>{ const l=idcList(day,idcDayRow); return idcSection('DAGEN MIN',day.length,l.body,l.more); })():'';
  const S2=nw.length?(()=>{ const l=idcList(nw,idcNewRow); return '<section class="idc-s"><div class="idc-h"><h3>NYTT SIDEN SIST</h3><span>'+nw.length+'</span><button type="button" class="lnk" data-idcseen="1">Merk som sett</button></div><ul class="idc-l">'+l.body+'</ul>'+l.more+'</section>'; })():'';
  const S3=ct.length?(()=>{ const l=idcList(ct,idcContactRow); return idcSection('KONTAKT I DAG',ct.length,l.body,l.more); })():'';
  const S4=fu.length?(()=>{ const l=idcList(fu,i=>idRow(i)); return idcSection('MÅ FØLGES OPP',fu.length,l.body,l.more); })():'';
  const any=S1||S2||S3||S4;
  return '<header class="idn-hd"><h2>'+esc(idcHello())+'</h2>'+(counts.length?'<p class="idc-cs">'+counts.join('<span aria-hidden="true">·</span>')+'</p>':'')+'</header>'+prog+idcTierLine()+
    (any?'':idcDone())+'<div class="idc">'+S1+S2+S3+S4+'</div>'+(any&&!S3&&!S4?idcDone().replace('Dagens arbeid er gjort.','Det som haster er gjort.'):''); }

/* klikk for blokkene i I dag */
(function(){ const _w=V.idag.wire; V.idag.wire=function(v){ _w.apply(this,arguments); const prev=v.onclick;
  v.onclick=function(e){ const t=e.target.closest&&e.target.closest('[data-idcopen],[data-idcseen]'); if(t){
      if(t.dataset.idcseen){ idcMarkSeen(); renderView(true); return; }
      const s=t.dataset.idcopen||'', i=s.indexOf(':'), k=s.slice(0,i), id=s.slice(i+1);
      if(k==='deal') openDrawer('deal',id); else if(k==='mt') mtOpen(id); else if(k==='org') openOrg(id); else if(k==='go') idGo(id); else if(k==='task'){ const it=UI.id.cache&&UI.id.cache[id]; if(it) openDrawer(it.open.k,it.open.id); }
      return; }
    return prev&&prev.apply(this,arguments); }; }; })();


/* ---------- I dag 2027: to atskilte operative køer ----------
   Gjenbruker idQueue(), mtEligibility(), mtCreateBatch(), mtPatch(),
   mtLogTouch() og eksisterende CRM-skuffer. Ingen fiktive oppgaver, ingen
   e-postutsending og ingen automatisk aktivering uten et brukerklikk. */
UI.id27=UI.id27||{kind:'culture',session:false,skipped:[],total:0,busy:false,error:''};
const ID27_BATCH_SIZE=20;
const ID27_SEGS={
  culture:new Set(['forlag','forskning','fag','ngo','ambassade','utdanning','offentlig']),
  commercial:new Set(['tech','saas','finans','konsulent','bedrift','byra','pharma','ovrige'])
};
const ID27_LABEL={culture:'Rolig kultursekvens',commercial:'Aktiv kommersiell sekvens'};
const ID27_CAD={culture:'ID27_KULTUR',commercial:'ID27_KOMMERS'};
function id27Phone(a){
  if(!a)return {number:'',person:null,label:''};
  const p=(a.active||[]).find(x=>x.phone&&!x.dnc);
  if(p)return {number:p.phone,person:p,label:p.name+(p.title?' · '+p.title:'')};
  const number=a.profile&&a.profile.contact&&a.profile.contact.phone||'';
  const role=a.profile&&a.profile.contact&&a.profile.contact.askFor||'';
  return {number,person:null,label:role||'Virksomhetens hovednummer'};
}
function id27Candidates(kind){
  const segs=ID27_SEGS[kind]||ID27_SEGS.culture;
  const me0=typeof actor==='function'?actor():null;
  const pool=mtEligibility({sort:'fit'}).pool.filter(a=>
    segs.has(a.segId)&&a.flags.qualified&&!a.flags.disqualified&&!a.dncAcc&&
    !a.flags.addressed&&!a.flags.engaged&&!a.flags.opportunity&&!a.prog&&!(a.seq&&a.seq.enrolledAt)&&
    !!id27Phone(a).number&&(!me0||UI.id.scope==='team'||!a.ownerId||ownKey(a.ownerId)===me0.id)
  );
  const sorted=L=>L.sort((a,b)=>b.fit.total-a.fit.total||a.name.localeCompare(b.name,'nb'));
  // Bruk alltid godkjent person først. Når ingen finnes, kan vi ringe et
  // kvalifisert selskaps offentlig dokumenterte hovednummer, uten å
  // fabrikere eller automatisk godkjenne en personlig kontakt.
  const approved=pool.filter(a=>a.flags.enriched);
  const switchboards=pool.filter(a=>!a.flags.enriched&&a.profile&&a.profile.contact&&a.profile.contact.phone);
  return sorted(approved).concat(sorted(switchboards));
}
function id27IsCall(it){
  if(it.obj==='task')return /ring|telefon|tilbake.?ring|oppring|call/i.test(it.action||'');
  if(it.obj!=='acc'||it.rank===1)return false;
  const a=mtGet(it.accId);
  if(!a)return false;
  if(it.rank===6)return !!id27Phone(a).number;
  if(it.rank===5&&a.prog&&a.prog.next)return a.prog.next.ch==='telefon'&&!!id27Phone(a).number;
  return it.rank===5&&!!id27Phone(a).number;
}
function id27Queues(){
  const all=idQueue().vis, calls=[], admin=[], callAccounts=new Set();
  for(const it of all){
    if(id27IsCall(it)){
      const key=it.orgId||it.key;
      if(!callAccounts.has(key)){calls.push(it);callAccounts.add(key);}
    }else if(it.rank<=7&&!(it.obj==='acc'&&it.rank===6)){
      admin.push(it);
    }
  }
  return {calls,admin};
}
function id27BatchState(){
  const kind=UI.id27.kind, available=id27Candidates(kind).length, n=Math.min(ID27_BATCH_SIZE,available);
  return {kind,available,n};
}
function id27Choice(){
  const k=UI.id27.kind;
  return '<fieldset class="id27-choice"><legend>Velg sekvens</legend>'+
    [['culture','Rolig kultursekvens','Kultur, NGO, forlag'],['commercial','Aktiv kommersiell sekvens','Næringsliv, event']].map(([v,t,s])=>
      '<label class="id27-option'+(k===v?' selected':'')+'"><input type="radio" name="id27-sequence" data-id27-kind="'+v+'" value="'+v+'"'+(k===v?' checked':'')+'><span><b>'+t+'</b><small>'+s+'</small></span></label>').join('')+
    '</fieldset>';
}
function id27BatchCTA(B,secondary){
  const n=B.n;
  return '<button type="button" class="'+(secondary?'id27-secondary':'id27-primary')+'" data-id27-activate="1"'+(!n||UI.id27.busy?' disabled':'')+'>'+
    (UI.id27.busy?'Aktiverer batch …':'▶ AKTIVER NESTE BATCH ('+n+' '+idPlural(n,'PROSPEKT','PROSPEKTER')+')')+'</button>';
}
function id27Activation(B,secondary){
  return '<div class="id27-activate"><span class="id27-eyebrow">KLAR FOR NESTE BATCH?</span>'+
    '<p>Vil du kjøre en ny runde på '+B.n+' kontaktklare prospekter nå?</p>'+
    id27Choice()+id27BatchCTA(B,secondary)+
    (B.available===0?'<p class="id27-hint">Ingen kvalifiserte prospekter med registrert telefonnummer er tilgjengelige i dette segmentet. Ingen oppdiktede prospekter legges til.</p>':
    B.available<ID27_BATCH_SIZE?'<p class="id27-hint">Det finnes '+B.available+' tilgjengelige nå. Batchen fylles ikke med ukvalifiserte selskaper.</p>':'')+
    '</div>';
}
function id27AdminRow(it){
  const typ=it.obj==='deal'?(it.rank===1?'✉':'▤'):it.obj==='acc'?'✉':it.obj==='task'?'✓':'▤';
  const cta=it.obj==='deal'&&it.rank===1?'Behandle forespørsel':
    it.obj==='deal'&&it.rank===4?'Følg opp tilbud':
    it.obj==='acc'?'Behandle sekvenssteg':it.obj==='task'?'Åpne oppgave':'Åpne sak';
  return '<li class="id27-admin-row"><span class="id27-admin-icon" aria-hidden="true">'+typ+'</span>'+
    '<div class="id27-admin-main"><b>'+esc(it.org)+'</b><span>'+esc(it.action)+'</span>'+(UI.id.scope==='team'&&it.ownerId?'<small>Ansvarlig: '+esc(ownName(it.ownerId))+'</small>':'')+'</div>'+
    '<button type="button" class="id27-secondary" data-id27-open="'+esc(it.key)+'">'+cta+' <span aria-hidden="true">→</span></button></li>';
}
function id27Main(){
  const Q=id27Queues(), B=id27BatchState(), n=Q.calls.length;
  UI.id.cache=Object.fromEntries(idQueue().all.map(it=>[it.key,it]));
  const callbacks=Q.calls.filter(it=>it.obj==='task').length;
  const steps=n-callbacks;
  const hasWork=!!(n||Q.admin.length);
  const phase1=n?
    '<section class="id27-card id27-phase"><div class="id27-step">FASE 1 <span>·</span> RINGEØKT</div>'+
      '<h2>Ring de neste kontaktene</h2><p class="id27-summary">'+callbacks+' '+idPlural(callbacks,'forfalt tilbakeringing','forfalte tilbakeringinger')+
      ' <span aria-hidden="true">·</span> '+steps+' '+idPlural(steps,'sekvenssteg','sekvenssteg')+'</p>'+
      '<button type="button" class="id27-primary" data-id27-start="1">▶ START ØKT ('+n+' OPPGAVER)</button>'+
      '<p class="id27-fill"><span class="id27-dot"></span>'+(B.n===ID27_BATCH_SIZE?'Neste batch på 20 ligger klar til aktivering':B.n>0?'Neste batch: '+B.n+' kontaktklare prospekter tilgjengelige':'Ingen nye kontaktklare prospekter tilgjengelige akkurat nå')+'</p><details class="id27-replenish"'+(UI.id27.replenishOpen?' open':'')+'><summary>Aktiver flere prospekter</summary>'+id27Activation(B,true)+'</details></section>':
    '<section class="id27-card id27-phase">'+(!hasWork?'<div class="id27-success"><span aria-hidden="true">🎉</span><div><h2>Alt utført for i dag!</h2><p>Du har ingen forfalte oppgaver eller tilbakeringinger som venter.</p></div></div>':
    '<div class="id27-step">FASE 1 <span>·</span> RINGEØKT</div><h2>Ingen ringeoppgaver venter</h2><p class="id27-summary">Du kan behandle admin-køen nedenfor eller aktivere neste batch.</p>')+
    id27Activation(B)+'</section>';
  const phase2='<section class="id27-card id27-phase"><div class="id27-step">FASE 2 <span>·</span> ADMIN-KØ</div>'+
    '<div class="id27-admin-title"><h2>Tilbud og oppfølging</h2><span>'+Q.admin.length+' '+idPlural(Q.admin.length,'oppgave','oppgaver')+'</span></div>'+
    (Q.admin.length?'<ul class="id27-admin-list">'+Q.admin.map(id27AdminRow).join('')+'</ul>':
    '<p class="id27-muted">Ingen tilbud, forespørsler eller administrative oppgaver som krever handling nå.</p>')+
    '</section>';
  return '<div class="id27-work">'+phase1+phase2+
    (!live?'<p class="id27-demo" role="note">Demomodus: Endringer i batcher og ringelogg gjelder bare denne økten og lagres ikke permanent.</p>':'')+
    (UI.id27.error?'<p class="id27-error" role="alert">'+esc(UI.id27.error)+'</p>':'')+'</div>';
}
function id27Runner(){
  const X=UI.id27, Q=id27Queues().calls.filter(it=>!X.skipped.includes(it.key));
  if(!Q.length)return '<div class="id27-runner" role="dialog" aria-modal="true" aria-label="Ringeøkt ferdig"><div class="id27-run-card id27-run-finished"><span class="id27-step">RINGEØKT</span><h2>Økten er ferdig</h2><p>Ingen flere oppgaver i denne runden. Eventuelle hoppede kort er fortsatt tilgjengelige på I dag.</p><button type="button" class="id27-primary" data-id27-end="1">Tilbake til I dag</button></div></div>';
  const it=Q[0], a=typeof mtGet==='function'?mtGet(it.accId||it.orgId):null, phone=id27Phone(a);
  const step=it.obj==='acc'&&a&&a.prog&&a.prog.next?a.prog.next:null;
  const rest=Q.length, pos=Math.max(1,X.total-rest+1), url=phone.number?'tel:'+String(phone.number).replace(/[^\d+]/g,''):'';
  return '<div class="id27-runner" role="dialog" aria-modal="true" aria-label="Ringeøkt"><div class="id27-run-head"><b>RINGEØKT</b><span>'+pos+' av '+Math.max(pos,X.total)+'</span><button type="button" data-id27-end="1" class="id27-run-close">Avslutt økt ×</button></div>'+
    '<div class="id27-run-card" aria-live="polite"><span class="id27-eyebrow">'+(it.obj==='task'?'TILBAKERINGING':step?'SEKVENS · DAG '+step.d:'FØRSTE KONTAKT')+'</span>'+
    '<h2>'+esc(it.org)+'</h2><p class="id27-run-action">'+esc(it.action)+'</p>'+
    '<div class="id27-contact"><span>Hvem ringer du?</span><strong>'+esc(phone.label||'Kontaktperson ikke registrert')+'</strong>'+
    (url?'<a class="id27-call-link" href="'+esc(url)+'">☎ '+esc(phone.number)+'</a>':'<small>Telefonnummer er ikke registrert</small>')+'</div>'+
    '<div class="id27-reason"><b>Hvorfor nå?</b><p>'+esc((it.why||[]).filter(Boolean).join(' · ')||'Oppgaven er planlagt til i dag.')+'</p>'+
    (a&&a.why?'<p>'+esc(String(a.why).slice(0,240))+'</p>':'')+'</div>'+
    '<label class="id27-note">Notat etter samtalen (valgfritt)<textarea data-id27-note rows="2" placeholder="Kort oppsummering av det du fikk vite"></textarea></label>'+
    '<div class="id27-run-actions"><button type="button" class="id27-primary" data-id27-result="reached"'+(X.busy?' disabled':'')+'>Nådd</button>'+
    '<button type="button" class="id27-secondary" data-id27-result="no_answer"'+(X.busy?' disabled':'')+'>Ikke svar</button>'+
    '<button type="button" class="id27-secondary" data-id27-result="later"'+(X.busy?' disabled':'')+'>Ring senere</button></div>'+
    '<div class="id27-run-foot"><button type="button" class="id27-text-button" data-id27-skip="1">Hopp over denne</button>'+
    '<button type="button" class="id27-text-button" data-id27-detail="'+esc(it.key)+'">Åpne prospektdetaljer ↗</button></div>'+
    (X.error?'<p class="id27-error" role="alert">'+esc(X.error)+'</p>':'')+
    '</div></div>';
}
function id27Page(){ return UI.id27.session?id27Runner():'<div class="id27-scope">'+idScope()+'</div>'+id27Main(); }
/* Hovedvisningen viser bare i dag, ikke uke-/månedsfaner. De gamle
   uke- og månedsberegningene beholdes urørt for andre moduler. */
function idHTML(){return '<div class="id id27">'+id27Page()+'</div>';}
async function id27Activate(){
  if(UI.id27.busy||readOnly)return;
  const X=UI.id27, kind=X.kind, rows=id27Candidates(kind).slice(0,ID27_BATCH_SIZE);
  if(!rows.length){X.error='Ingen ringeklare prospekter å aktivere.';renderView(true);return;}
  X.busy=true;X.error='';renderView(true);
  let enrolled=0;
  try{
    const label=ID27_LABEL[kind], ids=rows.map(a=>a.id);
    await mtCreateBatch({name:label+' · '+idIso(new Date()),ids,requested:ID27_BATCH_SIZE,ownerId:(typeof actor==='function'&&actor()?actor().id:null)});
    for(const id of ids){
      const a=mtGet(id);
      if(!a||a.flags.disqualified||a.dncAcc||a.prog||!id27Phone(a).number)continue;
      await mtPatch(id,{seq:{...(a.seq||{}),enrolledAt:mtToday(),status:'active',stepsDone:[],cad:ID27_CAD[kind],drafted:{}},bStage:'active'},'Aktivert fra I dag: '+label);
      enrolled++;
    }
    if(!enrolled)throw new Error('Ingen selskaper kunne legges i sekvens.');
    toast(enrolled+' prospekter aktivert i '+label.toLowerCase()+(!live?' (kun demo)':'')+'.');
  }catch(e){X.error='Batchen ble ikke fullført: '+(e&&e.message||'Ukjent feil')+'. Kontroller eventuelle delvise endringer.';}
  finally{X.busy=false;renderView(true);}
}
function id27NextBusinessDay(){
  const d=idAdd(idDay0(),1);
  while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);
  d.setHours(9,0,0,0);return d;
}
async function id27Record(it,outcome,note){
  const a=mtGet(it.accId||it.orgId), phone=id27Phone(a), who=phone.person;
  const label=({reached:'Nådd',no_answer:'Ikke svar',later:'Ring senere'})[outcome];
  if(!label)throw new Error('Ukjent resultat');
  if(a){
    const r=await mtLogTouch(a.id,{ch:'telefon',dir:'out',pid:who?who.id:'',res:outcome,
      text:'Ringeøkt: '+label+(note?' · '+note:'')});
    if(r&&r.err)throw new Error(r.err);
  }else{
    await logAct({orgId:it.orgId,dealId:it.dealId,type:'call',text:'Ringeøkt: '+label+(note?' · '+note:'')});
  }
  if(it.obj==='task'&&it.done)await idDone(it);
  if(it.obj==='acc'&&it.done&&it.done.k==='step'){
    const fresh=mtGet(it.accId), i=it.done.i;
    if(fresh&&fresh.prog&&Number.isInteger(i)&&!fresh.seq.stepsDone.includes(i)){
      await mtPatch(fresh.id,{seq:{...fresh.seq,stepsDone:[...fresh.seq.stepsDone,i],status:'active',lastTouch:mtToday()}},'Ringeøkt: '+label);
    }
  }
  if(outcome==='later'){
    await activityRepository.create({account_id:it.orgId,case_id:it.dealId||null,type:'task',
      text:'Ring tilbake: '+it.org,due_at:id27NextBusinessDay().toISOString(),completed:false,
      owner_id:it.ownerId||null});
  }
}
(function(){
  const oldWire=V.idag.wire;
  V.idag.wire=function(v){
    oldWire.apply(this,arguments);
    v.addEventListener('change',e=>{
      const t=e.target.closest('[data-id27-kind]');
      if(t){if(t.closest('.id27-replenish'))UI.id27.replenishOpen=true;UI.id27.kind=t.value;UI.id27.error='';renderView(true);}
    });
    v.addEventListener('click',async e=>{
      const t=e.target.closest('[data-id27-start],[data-id27-end],[data-id27-activate],[data-id27-open],[data-id27-result],[data-id27-skip],[data-id27-detail]');
      if(!t)return;
      e.preventDefault();
      const X=UI.id27, d=t.dataset;
      if(d.id27Start!==undefined){X.total=id27Queues().calls.length;X.skipped=[];X.error='';X.session=true;renderView(true);return;}
      if(d.id27End!==undefined){X.session=false;X.skipped=[];X.error='';renderView(true);return;}
      if(d.id27Activate!==undefined){await id27Activate();return;}
      const it=UI.id.cache&&UI.id.cache[d.id27Open||d.id27Detail]||idQueue().all.find(x=>x.key===(d.id27Open||d.id27Detail));
      if(d.id27Open!==undefined||d.id27Detail!==undefined){
        if(!it)return;
        if(d.id27Detail!==undefined){X.session=false;X.skipped=[];renderView(true);}
        if(it.open.k==='mt')mtOpen(it.open.id);else openDrawer(it.open.k,it.open.id);
        return;
      }
      if(d.id27Skip!==undefined){const cur=id27Queues().calls.find(x=>!X.skipped.includes(x.key));if(cur)X.skipped.push(cur.key);renderView(true);return;}
      if(d.id27Result!==undefined&&!X.busy){
        const cur=id27Queues().calls.find(x=>!X.skipped.includes(x.key));if(!cur)return;
        const note=(v.querySelector('[data-id27-note]')||{}).value||'';
        X.busy=true;X.error='';t.disabled=true;
        try{await id27Record(cur,d.id27Result,note.trim());X.skipped.push(cur.key);}
        catch(err){X.error='Kunne ikke registrere resultatet: '+(err&&err.message||'Ukjent feil');}
        finally{X.busy=false;renderView(true);}
      }
    });
  };
})();
