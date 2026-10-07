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
