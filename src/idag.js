/* ---------- I dag: personlig arbeidsstasjon ----------
   Leser fra eksisterende moduler (Pipeline, Kunder, Forespørsler, Prospekter/sekvenser, Kalender, Mål og prognose).
   Eier ingen oppgaver, saker eller prospektdata. Det som endres (Ferdig, Utsett, Tildel, Logg kontakt) skjer på det egentlige objektet.
   Det eneste arbeidsstasjonen selv lagrer i innstillingene er (1) ukeplaner og (2) «skjul til» for rader som ikke er oppgaver. */
const ID={offerDays:5,staleDays:7,replySla:24,topN:7,maxReady:3,maxLoose:3,minTierA:'A',
  stat:{ahead:1.05,on:.95,slight:.8}};
UI.id=UI.id||{tab:'dag',scope:'mine',focus:null,pane:'',wkOff:0,edit:null,snoozed:false,nr:null};
UI.id.queueLimit=UI.id.queueLimit||ID.topN;

/* ---------- dato ---------- */
const idPad=n=>String(n).padStart(2,'0');
const idIso=d=>d.getFullYear()+'-'+idPad(d.getMonth()+1)+'-'+idPad(d.getDate());
const idDay0=d=>{ const x=new Date(d||Date.now()); x.setHours(0,0,0,0); return x; };
const idAdd=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const idDays=(a,b)=>Math.round((idDay0(b)-idDay0(a))/864e5);
function idWeekOf(off){ const t=idDay0(), wd=(t.getDay()+6)%7, a=idAdd(t,-wd+7*(off||0)), b=idAdd(a,7), th=idAdd(a,3), y=th.getFullYear(), j4=new Date(y,0,4);
  const wk=1+Math.round(((th-j4)/864e5-3+((j4.getDay()+6)%7))/7); return {a,b,wk,year:y,key:y+'-W'+idPad(wk),label:'uke '+wk,days:Math.max(0,Math.min(7,(Math.min(Date.now(),b.getTime())-a.getTime())/864e5))}; }
const idPlural=(n,e,f)=>n===1?e:f;

/* ---------- hvem ---------- */
function idWho(){ const a=actor(), mine=UI.id.scope==='mine'; return {a,mine:mine&&!!a,noProfile:mine&&!a}; }
function idInScope(ownerId,crit){ const W=idWho(); if(!W.mine) return true; const k=ownKey(ownerId); return k===W.a.id||(!ownerId&&!!crit); }
const idUserKey=()=>{ const a=actor(); return a?a.id:'team'; };

/* ---------- utsatt visning (lagres i innstillingene, endrer ikke objektet) ---------- */
function idSnoozeMap(){ const m=(S.settings&&S.settings.idSnooze)||{}, today=idIso(new Date()), uk=idUserKey(), out={}; for(const [k,v] of Object.entries(m)){ if(k.startsWith(uk+'|')&&String(v)>today) out[k.slice(uk.length+1)]=v; } return out; }
async function idSetSnooze(key,until){ const m={...((S.settings&&S.settings.idSnooze)||{})}, today=idIso(new Date()); for(const [k,v] of Object.entries(m)) if(String(v)<=today) delete m[k]; const full=idUserKey()+'|'+key; if(until) m[full]=until; else delete m[full]; return saveSettings({idSnooze:m}); }

/* ---------- arbeidskø: åpne regler, ingen KI ---------- */
const ID_RANKS={1:'Vi skylder kunden et svar',2:'Forfalt oppfølging',3:'Frist i dag',4:'Tilbud uten oppfølging',5:'Sekvensoppgave',6:'Tier A klar for første kontakt',7:'Ufordelt åpen sak',8:'Planlagt uten frist'};
const ID_TIER={1:'must',2:'must',3:'must',4:'should',5:'should',6:'should',7:'should',8:'maybe'};
function idLastByDeal(){ const m={}; for(const a of actsOp()){ if(a.type==='task'||!a.dealId) continue; if(!m[a.dealId]||a.at>m[a.dealId]) m[a.dealId]=a.at; } return m; }
const idDealOk=d=>d&&!d.deletedAt&&S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt;
const idAgoD=(s)=>{ const d=Math.floor((Date.now()-new Date(s))/864e5); return d<=0?'i dag':d===1?'i går':d+' dager siden'; };
/* en account er i operativt arbeid først når noe faktisk er besluttet: batch, tildeling, sekvens, reell dialog eller sak, eller valgt for reaktivering */
const idOperative=a=>!!(a.batch||(a.doc&&(a.doc.ownerId||a.doc.reactivate))||(a.seq&&a.seq.enrolledAt)||a.openDeals>0||a.flags.engaged);
function idItems(){
  const T0=idDay0(), t0=T0.getTime(), t1=t0+864e5, now=Date.now(), today=idIso(T0), items=[], lastD=idLastByDeal(), taskDeals=new Set(), have=new Set();
  const push=it=>{ items.push(it); have.add(it.key); if(it.dealId) have.add('d:'+it.dealId); };
  /* oppgaver */
  const loose=[];
  for(const t of openTasksOp()){
    const d=t.dealId?S.deals[t.dealId]:null; if(t.dealId&&!idDealOk(d)) continue; if(!t.dealId&&(!S.orgs[t.orgId]||S.orgs[t.orgId].deletedAt)) continue;
    const owner=t.ownerId||(d&&d.ownerId)||(S.orgs[t.orgId]&&S.orgs[t.orgId].ownerId)||null, openDeal=d&&OPEN.includes(d.stage), vtxt=openDeal?'Sak '+short(dval(d)):'';
    const base={key:'task:'+t.id,orgId:t.orgId,dealId:t.dealId||null,org:orgName(t.orgId),action:t.text,ownerId:owner,src:d?'Pipeline':'Kunder',open:d?{k:'deal',id:t.dealId}:{k:'org',id:t.orgId},done:{k:'task',id:t.id},obj:'task'};
    if(t.due){ const due=new Date(t.due);
      if(due<T0){ const n=Math.max(1,Math.ceil((t0-due)/864e5)); push({...base,rank:2,score:n*10+(openDeal?dval(d)/1000:0),why:[n+' '+idPlural(n,'dag','dager')+' forfalt',vtxt].filter(Boolean),due:t.due,late:true}); if(t.dealId) taskDeals.add(t.dealId); }
      else if(due.getTime()<t1){ push({...base,rank:3,score:(openDeal?dval(d)/1000:0),why:['Frist i dag',vtxt].filter(Boolean),due:t.due}); if(t.dealId) taskDeals.add(t.dealId); }
    } else if(openDeal) loose.push({...base,rank:8,score:dval(d)/1000,why:['Uten frist',vtxt].filter(Boolean)});
  }
  loose.sort((a,b)=>b.score-a.score).slice(0,ID.maxLoose).forEach(push);
  /* saker */
  for(const d of dealsOp()){ if(!idDealOk(d)) continue; const base={orgId:d.orgId,dealId:d.id,org:orgName(d.orgId),ownerId:d.ownerId||null,open:{k:'deal',id:d.id},obj:'deal'};
    if(d.stage==='ny'){ const h=(now-new Date(d.createdAt||now))/36e5, over=h>ID.replySla;
      push({...base,key:'deal:'+d.id+':ny',rank:1,score:h+(over?100:0),action:'Svar på forespørsel: '+d.title,why:[(over?'Over fristen på 24 timer':'Venter '+(h<24?Math.max(1,Math.round(h))+' t':Math.round(h/24)+' d')),d.value?'Sak '+short(dval(d)):''].filter(Boolean),src:'Forespørsler',late:over,crit:true}); continue; }
    if(!OPEN.includes(d.stage)) continue;
    const la=lastD[d.id]||d.stageAt||d.createdAt, days=la?Math.floor((now-new Date(la))/864e5):0;
    if(d.stage==='tilbud'&&!taskDeals.has(d.id)&&days>=ID.offerDays)
      push({...base,key:'deal:'+d.id+':tilbud',rank:4,score:days*5+dval(d)/1000,action:'Følg opp tilbud: '+d.title,why:['Tilbud uten aktivitet i '+days+' dager','Sak '+short(dval(d))],src:'Pipeline',done:{k:'offer',id:d.id}});
    if(!d.ownerId&&!have.has('d:'+d.id)) push({...base,key:'deal:'+d.id+':ufordelt',rank:7,score:dval(d)/1000,action:'Tildel ansvarlig: '+d.title,why:['Åpen sak uten ansvarlig','Sak '+short(dval(d))],src:'Pipeline',crit:true,assign:{k:'deal',id:d.id}});
  }
  /* prospekter og sekvenser (fra Prospekter) */
  if(typeof mtAll==='function'){
    const ready=[];
    for(const a of mtAll()){ if(a.flags.disqualified||a.dncAcc||!idOperative(a)) continue; const n=a.nx, F=a.flags;
      const base={orgId:a.id,org:a.name,ownerId:a.ownerId||null,open:{k:'mt',id:a.id},obj:'acc',accId:a.id};
      if(n.k==='reply') push({...base,key:'acc:'+a.id+':svar',rank:1,score:50,action:'Følg opp svar',why:['Kunden har svart','Venter på oss'],src:'Sekvenser',crit:true});
      else if(n.k==='step'&&n.due&&n.due<=today) push({...base,key:'acc:'+a.id+':steg',rank:5,score:(n.late?20:0)+a.fit.total/10,action:n.t,why:[n.late?mtDays(n.due,today)+' '+idPlural(mtDays(n.due,today),'dag','dager')+' forfalt':'Frist i dag',(a.prog?a.prog.name+' · dag '+a.prog.day:'Sekvens')],due:n.due,late:!!n.late,src:'Sekvenser',done:{k:'step',id:a.id,i:a.prog&&a.prog.next?a.prog.next.i:null}});
      else if(n.k==='followup'&&n.due&&n.due<=today&&a.kind==='ny') push({...base,key:'acc:'+a.id+':oppf',rank:5,score:a.fit.total/10,action:'Følg opp touch',why:[n.t],due:n.due,late:n.due<today,src:'Prospekter'});
      else if(a.kind==='ny'&&F.qualified&&F.enriched&&!F.addressed&&!a.prog&&String(a.tier||'')===ID.minTierA&&(a.batch||(a.doc&&a.doc.ownerId))) ready.push({...base,key:'acc:'+a.id+':forste',rank:6,score:a.fit.total,action:'Første kontakt'+(a.active[0]?' · '+a.active[0].name+(a.active[0].title?' ('+a.active[0].title+')':''):''),
        why:['Klar for første kontakt','Tier A · fit '+a.fit.total],src:'Prospekter',acc:a}); }
    ready.sort((x,y)=>y.score-x.score).slice(0,ID.maxReady).forEach(push);
  }
  items.sort((a,b)=>a.rank-b.rank||b.score-a.score||a.org.localeCompare(b.org,'nb'));
  return items;
}
/* One visible next action per account; never delete or mark other tasks done.
   'more' counts accounts, not duplicate tasks. Keep incoming replies first
   because idItems has already sorted by urgency. */
function idSelectAccounts(ordered,limit){
  const seen=new Set(), unique=[];
  for(const item of ordered){
    const id=item.orgId||item.key;
    if(seen.has(id))continue;
    seen.add(id); unique.push(item);
  }
  return {shown:unique.slice(0,limit),more:Math.max(0,unique.length-limit)};
}
function idQueue(){
  const sn=idSnoozeMap(), all=idItems().filter(i=>idInScope(i.ownerId,i.crit)), vis=all.filter(i=>!sn[i.key]), hidden=all.filter(i=>sn[i.key]);
  const ranked=idSelectAccounts(vis,UI.id.queueLimit||ID.topN);
  return {all,vis,shown:ranked.shown,hidden,more:ranked.more};
}
/* tall til toppstripen */
function idReadyCount(){ if(typeof mtAll!=='function') return 0; return mtAll().filter(a=>a.kind==='ny'&&a.flags.qualified&&a.flags.enriched&&!a.flags.addressed&&!a.flags.disqualified&&!a.dncAcc&&idInScope(a.ownerId,false)).length; }
function idTop(Q){ return {prio:Q.shown.length,late:Q.vis.filter(i=>i.rank===2).length,waiting:Q.vis.filter(i=>i.rank===1).length,ready:idReadyCount()}; }

/* ---------- handlinger: alltid mot det egentlige objektet ---------- */
async function idDone(it){ const D=it.done; if(!D) return false;
  if(D.k==='task'){ const a=S.acts[D.id]; if(!a) return false; await put('acts',D.id,{...a,done:true,doneAt:iso(new Date())}); return true; }
  if(D.k==='offer'){ await logAct({orgId:it.orgId,dealId:D.id,type:'note',text:'Fulgte opp tilbudet (merket ferdig fra I dag)'}); return true; }
  if(D.k==='step'&&D.i!=null&&typeof mtStep==='function'){ await mtStep(D.id,D.i); return true; }
  return false; }
async function idSnoozeIt(it,mode){ const T0=idDay0(), tom=idAdd(T0,1), wd=(T0.getDay()+6)%7, mon=idAdd(T0,7-wd), target=mode==='week'?mon:tom;
  if(it.done&&it.done.k==='task'){ const a=S.acts[it.done.id]; if(!a) return false; const old=a.due?new Date(a.due):null, d=new Date(target); if(old) d.setHours(old.getHours(),old.getMinutes(),0,0); else d.setHours(9,0,0,0); await put('acts',it.done.id,{...a,due:iso(d)}); return {moved:true,to:target}; }
  await idSetSnooze(it.key,idIso(target)); return {moved:false,to:target}; }
async function idNotRelevant(accId,reason){ return typeof mtDisqualify==='function'?mtDisqualify(accId,reason):{err:'Prospekter er ikke tilgjengelig.'}; }

/* ---------- uke ---------- */
function idFirstOut(){ const m={}; for(const x of actsOp()){ if(x.type==='task'||x.derived||x.handover||x.dir==='in') continue; if(/^E-postutkast laget/.test(x.text||'')) continue; if(!(x.mt||['call','email','meeting','visning'].includes(x.type))) continue; if(!x.orgId) continue; if(!m[x.orgId]||x.at<m[x.orgId]) m[x.orgId]=x.at; } return m; }
/* Contact goal is independent of how many accounts the queue currently shows.
   First meaningful outgoing touch counts once per existing organization. */
function idOutreachPace(){
  const setting=(S.settings&&S.settings.outreach)||{};
  const known=new Set(Object.entries(S.orgs).filter(([,o])=>o&&!o.deletedAt).map(([id])=>id));
  if(typeof mtAll==='function')for(const acc of mtAll())if(!acc.flags.disqualified)known.add(acc.id);
  const contacted=Object.keys(idFirstOut()).filter(id=>known.has(id)).length;
  const goal=Math.floor(Number(setting.goal));
  return outreachPace({goal:Number.isFinite(goal)&&goal>0?goal:OUTREACH_DEFAULT.goal,
    contacted,start:setting.start,deadline:setting.deadline,today:idIso(new Date())});
}
function idWeekActual(off){
  const W=idWeekOf(off), a=W.a.getTime(), b=W.b.getTime(), inW=s=>{ if(!s) return false; const t=new Date(s).getTime(); return t>=a&&t<b; };
  const D=dealsOp().filter(idDealOk), mineOf=d=>idInScope(d.ownerId,false), res={W};
  const created=D.filter(d=>inW(d.createdAt)), conf=D.filter(d=>d.stage==='bekreftet'&&inW(d.stageAt)), offers=D.filter(d=>[3,4,5].includes(ST[d.stage].i)&&d.stage!=='tapt'&&inW(d.stageAt));
  const sum=L=>L.reduce((s,d)=>s+dval(d),0), mine=L=>L.filter(mineOf);
  res.dial={n:created.filter(d=>ST[d.stage].i>=1).length,me:mine(created.filter(d=>ST[d.stage].i>=1)).length};
  res.offers={n:offers.length,me:mine(offers).length};
  res.pipe={v:sum(created.filter(d=>d.stage!=='tapt')),me:sum(mine(created.filter(d=>d.stage!=='tapt')))};
  res.conf={n:conf.length,v:sum(conf),me:sum(mine(conf))};
  let addr=0, addrMe=0;
  const byAccount=new Map(typeof mtAll==='function'?mtAll().filter(a=>!a.flags.disqualified).map(a=>[a.id,a]):[]);
  for(const [id,at] of Object.entries(idFirstOut())){
    const org=S.orgs[id],acc=byAccount.get(id);
    if(!inW(at)||(!acc&&(!org||org.deletedAt)))continue;
    addr++;
    if(idInScope((acc&&acc.ownerId)||(org&&org.ownerId)||null,false))addrMe++;
  }
  res.addr={n:addr,me:addrMe}; return res;
}
function idMonthGoal(){ const G=g3Calc('m'); return G; }
/* mål for uken: samme antakelser som Mål og prognose (g3Calc) fordelt på ukene som er igjen, pluss det som alt er gjort denne uken */
function idWeekTargets(A,G){
  const has=G.goal>0, wk=Math.max(1,G.miss.weeks), T={has};
  T.dial=has?A.dial.n+Math.ceil(G.miss.di/wk):null; T.offers=has?A.offers.n+Math.ceil(G.miss.of/wk):null; T.pipe=has?A.pipe.v+Math.round(G.miss.of*G.avgVal/wk):null;
  const contactPace=idOutreachPace();
  T.addr=A.addr.n+(contactPace.beforeStart?0:contactPace.weekly);
  T.addrQ=contactPace.goal;
  T.outreach=contactPace;
  return T;
}
function idPlanKey(W){ return W.key+'|'+idUserKey(); }
const idPlanGet=W=>((S.settings&&S.settings.weekPlans)||{})[idPlanKey(W)]||null;
async function idPlanSave(W,plan){ const m={...((S.settings&&S.settings.weekPlans)||{})}; m[idPlanKey(W)]=plan; const keep=Object.keys(m).sort().slice(-24); const o={}; for(const k of keep) o[k]=m[k]; return saveSettings({weekPlans:o}); }
async function idPlanClear(W){ const m={...((S.settings&&S.settings.weekPlans)||{})}; delete m[idPlanKey(W)]; return saveSettings({weekPlans:m}); }
function idActiveBatch(){ if(typeof mtBuild!=='function') return null; const B=mtBuild().batches.filter(b=>b.status==='aktiv'); if(!B.length) return null; const accs=mtAll(), by={}; for(const a of accs) by[a.id]=a;
  const rows=B.map(b=>{ const L=(b.accIds||[]).map(id=>by[id]).filter(Boolean), addr=L.filter(a=>a.flags.addressed).length, reply=L.filter(a=>a.seq&&(a.seq.repliedAt||a.seq.status==='replied')).length; return {b,total:L.length,addr,reply,left:L.length-addr,segs:(b.segIds||[]).map(mtSegName).map(mtSegShort)}; });
  rows.sort((x,y)=>(y.left>0)-(x.left>0)||(x.b.createdAt<y.b.createdAt?1:-1)); return rows[0]; }
function idPipeAttention(){
  const now=Date.now(), L=dealsOp().filter(idDealOk).filter(d=>idInScope(d.ownerId,true)), lastD=idLastByDeal(), op=L.filter(d=>OPEN.includes(d.stage)&&d.stage!=='ny');
  const days=d=>{ const la=lastD[d.id]||d.stageAt||d.createdAt; return la?Math.floor((now-new Date(la))/864e5):0; };
  const stale=op.filter(d=>days(d)>=ID.staleDays).sort((a,b)=>days(b)-days(a)), offers=op.filter(d=>d.stage==='tilbud'&&days(d)>=ID.offerDays), unassigned=op.filter(d=>!d.ownerId);
  return {stale,offers,unassigned,days,open:op.length}; }
function idWeekCal(off){ const W=idWeekOf(off), a=idIso(W.a), b=idIso(W.b); const E=typeof calEntries==='function'?calEntries().filter(e=>e.date>=a&&e.date<b&&idInScope(e.ownerId,true)):[]; E.sort((x,y)=>x.date.localeCompare(y.date)||String(x.room).localeCompare(String(y.room)));
  const tasks=openTasksOp().filter(t=>t.due&&new Date(t.due)>=W.a&&new Date(t.due)<W.b&&idInScope(t.ownerId||(t.dealId&&S.deals[t.dealId]&&S.deals[t.dealId].ownerId)||null,true)&&(S.orgs[t.orgId]&&!S.orgs[t.orgId].deletedAt));
  tasks.sort((x,y)=>String(x.due).localeCompare(String(y.due))); return {W,E,tasks}; }
/* Solstad: første to måneder fram i tid med færrest registrerte saker. Kun registreringer i Salong, ikke bekreftet ledighet. */
function idSolstadWindow(){ if(typeof calEntries!=='function'||!RM.solstad) return null; const E=calEntries().filter(e=>e.room==='solstad'), t=idDay0(), out=[];
  for(let i=1;i<=7;i++){ const m1=new Date(t.getFullYear(),t.getMonth()+i,1), m2=new Date(t.getFullYear(),t.getMonth()+i+1,1), k1=idIso(m1).slice(0,7), k2=idIso(m2).slice(0,7); const n=E.filter(e=>e.date.startsWith(k1)||e.date.startsWith(k2)).length; out.push({m1,m2,n}); }
  out.sort((a,b)=>a.n-b.n||a.m1-b.m1); const w=out[0]; if(!w) return null; const nm=m=>m.toLocaleDateString('nb-NO',{month:'long'}); return {from:nm(w.m1),to:nm(w.m2),n:w.n}; }
function idWeekFocus(A,G){
  const out=[], B=idActiveBatch();
  if(B&&B.left>0) out.push({k:'batch',t:'Fullfør '+(B.b.name||'batchen'),s:B.addr+' av '+B.total+' adressert',link:'prosp-arb',why:'Aktiv batch i Prospekter med '+B.left+' accounts som ikke er adressert.'});
  else if(typeof mtStats==='function'){ const st=mtStats(); if(st.qualified-st.addressed>0) out.push({k:'nybatch',t:'Start neste batch',s:(st.qualified-st.addressed)+' kvalifiserte accounts er ikke adressert',link:'prosp-batch',why:'Ingen aktiv batch. Kvalifiserte, ikke adresserte accounts finnes i Prospekter.'}); }
  const P=idPipeAttention(); if(P.offers.length) out.push({k:'tilbud',t:'Følg opp '+P.offers.length+' '+idPlural(P.offers.length,'sak','saker')+' i Tilbud sendt',s:'ingen aktivitet på '+ID.offerDays+' dager eller mer',link:'pipeline',why:'Saker i «Tilbud sendt» uten aktivitet siste '+ID.offerDays+' dager.'});
  else if(P.stale.length) out.push({k:'stale',t:P.stale.length+' '+idPlural(P.stale.length,'sak','saker')+' uten aktivitet',s:'eldste står stille i '+P.days(P.stale[0])+' dager',link:'pipeline',why:'Åpne saker uten aktivitet siste '+ID.staleDays+' dager.'});
  if(out.length<3){ const sw=idSolstadWindow(); if(sw&&G.goal>0) out.push({k:'solstad',t:'Bygg pipeline for Solstad i '+sw.from+'–'+sw.to,s:sw.n+' '+idPlural(sw.n,'registrert sak','registrerte saker')+' i Salong',link:'kalender',why:'Perioden med færrest registrerte saker i Solstad de neste månedene. Dette er ikke bekreftet ledighet. Bookingsystemet er ikke koblet til.'}); }
  return out.slice(0,3); }
function idPlanSuggest(A,G,T){
  const B=idActiveBatch(), seg=(typeof mtSegStats==='function')?mtSegStats().filter(s=>s.on!==false&&s.qualified-s.addressed>0).sort((a,b)=>String(a.prio).localeCompare(String(b.prio))||(b.qualified-b.addressed)-(a.qualified-a.addressed))[0]:null;
  const P=idPipeAttention(), sw=idSolstadWindow();
  return {goals:{dial:T.dial,addr:T.addr,offers:T.offers,pipe:T.pipe},seg:seg?seg.id:'',segName:seg?mtSegShort(seg.name):'',batch:B&&B.left>0?B.b.id:'',batchName:B&&B.left>0?B.b.name:'',followUp:P.offers.length,calendar:sw?'Solstad '+sw.from+'–'+sw.to:''}; }

/* ---------- måned ---------- */
function idMonthStatus(G){
  if(!(G.goal>0)) return {k:'none',t:'IKKE SATT',c:'mute'};
  const r=G.expected/G.goal; const k=r>=ID.stat.ahead?'ahead':r>=ID.stat.on?'on':r>=ID.stat.slight?'slight':'behind';
  return {k,r,t:({ahead:'FORAN PLAN',on:'I RUTE',slight:'LITT BAK',behind:'BAK PLAN'})[k],c:({ahead:'ok',on:'ok',slight:'warn',behind:'bad'})[k]}; }
function idMonthTime(G){ const R=G.R, tot=R.b-R.a, el=Math.min(1,Math.max(0,(Date.now()-R.a.getTime())/tot)), done=G.goal>0?G.confirmed/G.goal:null; return {elapsed:el,done,diff:done==null?null:done-el}; }
function idMineConfirmed(G){ const a=actor(); if(!a) return null; return dealsOp().filter(idDealOk).filter(d=>d.stage==='bekreftet'&&ownKey(d.ownerId)===a.id&&g3At(d)>=G.R.a&&g3At(d)<G.R.b).reduce((s,d)=>s+dval(d),0); }
function idCoverage(){
  if(typeof mtStats!=='function') return null; const st=mtStats(), segs=mtSegStats().filter(s=>s.id&&s.on!==false), snaps=mtSnaps(), ms=idIso(new Date(new Date().getFullYear(),new Date().getMonth(),1));
  let base=snaps.find(s=>s.date<=ms); let baseKind='month'; if(!base){ const inM=snaps.filter(s=>s.date>ms).slice(-1)[0]; if(inM){ base=inM; baseKind='inmonth'; } }
  const diff=base?mtSnapDiff(base):null, pp=diff&&diff.covOld!=null&&diff.covNow!=null?Math.round((diff.covNow-diff.covOld)*100):null;
  const ref=st.cov, withQ=segs.filter(s=>s.qualified>0);
  const behind=withQ.filter(s=>s.qualified-s.addressed>0&&(ref==null?false:(s.cov||0)<ref-.05||(s.cov===0&&String(s.prio)==='P0'))).sort((a,b)=>String(a.prio).localeCompare(String(b.prio))||(a.cov||0)-(b.cov||0)).slice(0,2);
  return {st,segs,withQ,pp,diff,base,baseKind,behind,ref}; }
function idMonthRec(G,S0,P){
  if(!(G.goal>0)) return null;
  const late=dealsOp().filter(idDealOk).filter(d=>['tilbud','holdt'].includes(d.stage)).reduce((s,d)=>s+dval(d)*ST[d.stage].p,0), openW=G.weighted, share=openW>0?late/Math.max(late,openW):null;
  if(S0.k==='behind'||S0.k==='slight'){ if(G.weighted<G.miss.v&&G.miss.v>0) return {t:'Pipelinen dekker ikke gapet. Prioriter nye dialoger og tilbud.',why:['Vektet pipeline er '+short(G.weighted)+' og gapet til målet er '+short(Math.max(0,G.gap))+'.','Forventet utfall er '+short(G.expected)+' mot mål '+short(G.goal)+' ('+pct(G.expected/G.goal)+').','Hva må til: '+G.miss.di+' dialoger, '+G.miss.of+' tilbud og '+G.miss.ag+' avtaler. Samme antakelser som Mål og prognose.']}; }
  if(share!=null&&share<.3&&G.weighted>0) return {t:'Pipelinen er stor nok, men for lite av den ligger i de sene stegene. Prioriter oppfølging fremfor mer top-of-funnel.',why:['Bare '+pct(share)+' av vektet pipeline ligger i Tilbud sendt og Holdt av.','Forventet utfall er '+short(G.expected)+' mot mål '+short(G.goal)+'.']};
  return {t:'Du ligger i rute. Hold tempoet og følg opp åpne tilbud.',why:['Forventet utfall er '+short(G.expected)+' mot mål '+short(G.goal)+' ('+pct(G.expected/G.goal)+').','Status følger regelen: forventet / mål ≥ '+Math.round(ID.stat.on*100)+' %.']}; }
function idDayRec(Q){
  const must=Q.vis.filter(i=>ID_TIER[i.rank]==='must');
  if(must.length) return {t:'Ta det som kunden venter på og det som er forfalt først. Vent med ny outbound.',why:[must.length+' '+idPlural(must.length,'handling','handlinger')+' i «Må gjøres»: '+[...new Set(must.map(i=>ID_RANKS[i.rank].toLowerCase()))].join(', ')+'.','Rekkefølgen følger åpne regler: kunden først, deretter forfalt, så dagens frister.']};
  const off=Q.vis.filter(i=>i.rank===4); if(off.length) return {t:'Følg opp tilbud før du starter ny outbound.',why:[off.length+' '+idPlural(off.length,'tilbud','tilbud')+' har ligget uten aktivitet i '+ID.offerDays+' dager eller mer.']};
  const rd=Q.vis.filter(i=>i.rank===6); if(rd.length) return {t:'Ingenting haster. Bruk tiden på første kontakt mot Tier A-accounts.',why:[rd.length+' Tier A-accounts er kvalifisert, har kontaktdata og er ikke kontaktet.']};
  return null; }
function idWeekRec(A,T,B,P){
  if(B&&B.total>0&&B.left>0&&B.addr/B.total>=.6) return {t:'«'+(B.b.name||'Batchen')+'» er nesten ferdig bearbeidet. Fullfør den før du åpner neste store batch.',why:[B.addr+' av '+B.total+' accounts er adressert ('+Math.round(B.addr/B.total*100)+' %).','Regel: batch med minst 60 % adressert anbefales fullført først.']};
  if(P.offers.length) return {t:'Følg opp '+P.offers.length+' '+idPlural(P.offers.length,'tilbud','tilbud')+' før du bygger mer pipeline.',why:['Tilbud sendt uten aktivitet i '+ID.offerDays+' dager eller mer.']};
  if(T.has){ const rows=[['nye dialoger',A.dial.n,T.dial],['tilbud',A.offers.n,T.offers]].filter(r=>r[2]&&r[1]<r[2]).map(r=>({n:r[0],gap:r[2]-r[1]})).sort((a,b)=>b.gap-a.gap); if(rows.length) return {t:'Størst gap denne uken er '+rows[0].n+': '+rows[0].gap+' igjen til ukemålet.',why:['Ukemålene er utledet av månedsmålet og antakelsene i Mål og prognose.']}; }
  return null; }
