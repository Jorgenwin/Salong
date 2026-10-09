/* ---------- I dag: visning ---------- */
const ID_TABS=[['dag','I dag'],['uke','Denne uken'],['mnd','Denne måneden']];
const idKr=n=>short(Math.round(n||0));
const idOpenLbl=it=>it.open.k==='deal'?'Åpne saken':it.open.k==='org'?'Åpne kunden':'Åpne prospekt';
const idDue=it=>it.due?'<span class="id-due">'+esc(fd(String(it.due).length>10?it.due:it.due+'T12:00:00',{weekday:'short',day:'numeric',month:'short'}))+'</span>':'';

function idHeader(){ return ''; }
function idScope(){ const W=idWho(), seg=[['mine','Mine'],['team','Teamet']].map(([k,n])=>'<button type="button" data-idsc="'+k+'" aria-pressed="'+(UI.id.scope===k)+'">'+n+'</button>').join('');
  return '<div class="id-sc" role="group" aria-label="Vis for">'+seg+(W.noProfile?'<span class="id-sc-n" title="Ingen testprofil er valgt, så «Mine» viser hele teamet.">viser teamet</span>':'')+'</div>'; }
function idTabs(){ return '<div class="id-tb"><div class="id-tabs" role="tablist" aria-label="Tidshorisont">'+ID_TABS.map(([k,n])=>'<button type="button" role="tab" id="idt-'+k+'" data-idtab="'+k+'" aria-selected="'+(UI.id.tab===k)+'" tabindex="'+(UI.id.tab===k?0:-1)+'">'+n+'</button>').join('')+'</div>'+idScope()+'</div>'; }
const idNum=(key,txt,cls)=>'<button type="button" class="id-n'+(cls?' '+cls:'')+'" data-idx="'+key+'">'+txt+'</button>';
function idRecHTML(label,rec,none){
  if(!rec) return none?'<p class="id-rec none"><span>'+label+'</span>'+esc(none)+'</p>':'';
  return '<div class="id-rec"><span class="id-rl">'+label+'</span><p>'+esc(rec.t)+'</p><details><summary>Hvorfor?</summary><ul>'+rec.why.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></details></div>'; }

/* ---------- I DAG ---------- */
function idRow(it,focus){
  const team=UI.id.scope==='team'||!idWho().mine, w0=it.why[0]||'', w1=it.why[1]||'';
  const menu='<details class="id-more"><summary aria-label="Flere valg for '+esc(it.org)+'" title="Flere valg">⋯</summary><div class="id-mm" role="menu"><button type="button" role="menuitem" data-idsn="'+esc(it.key)+'|tom">Utsett til i morgen</button><button type="button" role="menuitem" data-idsn="'+esc(it.key)+'|week">Utsett til mandag</button>'+
    (it.assign||it.obj==='deal'||it.obj==='task'||it.obj==='acc'?'<button type="button" role="menuitem" data-idas="'+esc(it.key)+'">Tildel …</button>':'')+'</div></details>';
  const who=!it.ownerId?'<span class="id-un">Ufordelt</span>':team?'<span class="id-ow">'+esc(ownName(it.ownerId))+'</span>':'';
  return '<li class="id-r'+(it.late?' late':'')+'" data-key="'+esc(it.key)+'" title="'+esc(it.src+(it.ownerId?' · '+ownName(it.ownerId):''))+'">'+(it.done?'<button type="button" class="id-chk" data-idone="'+esc(it.key)+'" aria-label="Ferdig: '+esc(it.action)+'" title="Ferdig"></button>':'<span class="id-chk off" aria-hidden="true"></span>')+
    '<div class="id-m"><div class="id-o">'+esc(it.org)+'</div><div class="id-a">'+esc(it.action)+'</div><div class="id-w"><span class="id-w0'+(it.late?' late':'')+'">'+esc(w0)+'</span>'+(w1?' · '+esc(w1):'')+'</div></div>'+
    '<div class="id-rt">'+idDue(it)+who+'</div>'+
    '<div class="id-ac"><button type="button" class="id-go" data-idopen="'+esc(it.key)+'" title="'+esc(idOpenLbl(it))+'">Åpne <span aria-hidden="true">→</span></button>'+menu+'</div></li>'; }
const idNoData=()=>!(openTasksOp().length||dealsOp().some(d=>OPEN.includes(d.stage))||(typeof mtAll==='function'&&mtAll().some(idOperative)));
function idEmpty(Q){
  if(idNoData()) return '<section class="id-empty"><h3>Ingen planlagt arbeid ennå</h3><p>Her vises oppgaver, saker og prospekter du faktisk har lagt inn. Start en batch fra Målmarked for å begynne.</p><button type="button" class="btn" data-idgo="prosp">Åpne Målmarked</button></section>';
  const sug=[]; if(typeof mtStats==='function'){ const st=mtStats(); if(st.qualified-st.addressed>0) sug.push(['Start neste prospect-batch',st.qualified-st.addressed+' kvalifiserte accounts er ikke adressert','batch']); const cv=idCoverage(); if(cv&&cv.behind[0]) sug.push(['Bearbeid et underdekket segment',mtSegShort(cv.behind[0].name)+': '+(cv.behind[0].qualified-cv.behind[0].addressed)+' ikke adressert','seg:'+cv.behind[0].id]); }
  const W=idWeekOf(0), up=openTasksOp().filter(t=>t.due&&new Date(t.due)>=idAdd(idDay0(),1)&&new Date(t.due)<W.b&&idInScope((t.dealId&&S.deals[t.dealId]&&S.deals[t.dealId].ownerId)||t.ownerId||null,true)).length; if(up) sug.push(['Følg opp kommende saker',up+' '+idPlural(up,'oppgave','oppgaver')+' med frist senere denne uken','pipeline']);
  return '<section class="id-empty"><h3>Dagens prioriterte arbeid er ferdig.</h3>'+(sug.length?'<p>Vil du jobbe foran?</p><ul>'+sug.map(s=>'<li><button type="button" class="lnk" data-idgo="'+esc(s[2])+'">'+esc(s[0])+'</button><span>'+esc(s[1])+'</span></li>').join('')+'</ul>':'<p>Jeg ser ingen gode forslag å jobbe foran på akkurat nå. Det er helt greit.</p>')+'</section>'; }
function idFocusHTML(Q){
  const f=UI.id.focus, list=Q.shown, it=list[0];
  if(!it) return '<section class="id-focus"><div class="id-fh"><span>NESTE</span><button type="button" class="lnk" data-idfx="1">Avslutt fokus</button></div>'+idEmpty(Q)+'</section>';
  const a=it.acc||(it.obj==='acc'&&typeof mtGet==='function'?mtGet(it.accId):null), p=a&&a.active&&a.active[0];
  const contact=a?(p?esc(p.name)+(p.title?', '+esc(p.title):''):esc(mtRoleText(a))):'';
  const n=(f.n0||list.length), done=Math.max(0,n-list.length);
  return '<section class="id-focus" aria-live="polite"><div class="id-fh"><span>NESTE</span><span class="id-fc">'+(done+1)+' av '+Math.max(n,done+1)+'</span><button type="button" class="lnk" data-idfx="1">Avslutt fokus</button></div>'+
    '<h3>'+esc(it.org)+'</h3><p class="id-fa">'+esc(it.action)+'</p>'+(a?'<p class="id-fk"><span>Kontakt</span>'+contact+'</p>':'')+
    '<div class="id-fw"><span>Hvorfor nå</span><ul>'+it.why.map(w=>'<li>'+esc(w)+'</li>').join('')+(it.due?'<li>'+(it.late?'Forfalt ':'Frist ')+esc(fd(String(it.due).length>10?it.due:it.due+'T12:00:00',{weekday:'short',day:'numeric',month:'short'}))+'</li>':'')+'</ul></div>'+
    '<div class="id-fb">'+(a&&it.rank===6?'<button type="button" class="btn primary" data-idopen="'+esc(it.key)+'">Åpne account</button><button type="button" class="btn" data-idlog="'+esc(it.key)+'">Logg kontakt</button>':'<button type="button" class="btn primary" data-idopen="'+esc(it.key)+'">'+idOpenLbl(it)+'</button>'+(it.done?'<button type="button" class="btn" data-idone="'+esc(it.key)+'">Ferdig</button>':'')+(a&&it.rank!==6?'<button type="button" class="btn" data-idlog="'+esc(it.key)+'">Logg kontakt</button>':''))+
    '<details class="id-more id-fmore"><summary class="btn">Utsett</summary><div class="id-mm"><button type="button" data-idsn="'+esc(it.key)+'|tom">Til i morgen</button><button type="button" data-idsn="'+esc(it.key)+'|week">Til mandag</button></div></details>'+
    (a&&it.rank===6?'<button type="button" class="btn ghost" data-idnr="'+esc(it.key)+'">Ikke relevant</button>':'')+'</div>'+
    (UI.id.nr===it.key?'<div class="id-nr"><label for="idNrR">Hvorfor er den ikke relevant? (kreves)</label><div class="row"><input class="in" id="idNrR" placeholder="F.eks. holder ikke arrangementer"><button type="button" class="btn" data-idnrgo="'+esc(it.key)+'">Diskvalifiser</button><button type="button" class="btn ghost" data-idnrx="1">Avbryt</button></div></div>':'')+
    '</section>'; }
function idDagHTML(){
  const Q=idQueue(), T=idTop(Q), groups=[['must','Må gjøres'],['should','Bør gjøres'],['maybe','Hvis det er tid']].map(([k,n])=>({k,n,L:Q.shown.filter(i=>ID_TIER[i.rank]===k)})).filter(g=>g.L.length);
  UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i]));
  const top='<p class="id-top">'+idNum('prio','<b>'+T.prio+'</b> '+idPlural(T.prio,'prioritert handling','prioriterte handlinger'))+
    '<span aria-hidden="true">·</span>'+idNum('late','<b>'+T.late+'</b> '+idPlural(T.late,'oppfølging forfalt','oppfølginger forfalt'),T.late?'warn':'zero')+
    '<span aria-hidden="true">·</span>'+idNum('ready','<b>'+T.ready+'</b> '+idPlural(T.ready,'account klar','accounts klare')+' for outreach',T.ready?'':'zero')+
    '<span aria-hidden="true">·</span>'+idNum('waiting','<b>'+T.waiting+'</b> '+idPlural(T.waiting,'kunde venter','kunder venter')+' på oss',T.waiting?'':'zero')+'</p>';
  if(UI.id.focus) return top+idFocusHTML(Q);
  const body=groups.length?groups.map(g=>'<section class="id-g '+g.k+'" aria-label="'+g.n+'"><h3>'+g.n+' <span>'+g.L.length+'</span></h3><ul class="id-list">'+g.L.map(i=>idRow(i)).join('')+'</ul></section>').join(''):idEmpty(Q);
  const foot=(Q.more>0?'<p class="id-more-n">'+Q.more+' '+idPlural(Q.more,'handling','handlinger')+' til er rangert lavere.</p>':'')+
    (Q.hidden.length?'<p class="id-more-n">'+Q.hidden.length+' utsatt i din visning. <button type="button" class="lnk" data-idsh="1">'+(UI.id.snoozed?'Skjul':'Vis')+'</button></p>'+(UI.id.snoozed?'<ul class="id-list quiet">'+Q.hidden.map(i=>'<li class="id-r" data-key="'+esc(i.key)+'"><span class="id-chk off"></span><div class="id-m"><div class="id-o">'+esc(i.org)+'</div><div class="id-a">'+esc(i.action)+'</div></div><div class="id-ac"><button type="button" class="lnk" data-idsn="'+esc(i.key)+'|clear">Hent tilbake</button></div></li>').join('')+'</ul>':''):'');
  if(idNoData()) return body;
  return '<div class="id-dagbar">'+top+(groups.length?'<button type="button" class="btn primary" data-idfs="1">Start fokus</button>':'')+'</div>'+idRecHTML('FOKUS I DAG',idDayRec(Q),groups.length?'':'')+body+foot; }

/* ---------- DENNE UKEN ---------- */
function idBar(v,t,cls){ const p=t>0?Math.min(100,Math.round(v/t*100)):0; return '<span class="id-bar'+(cls?' '+cls:'')+'" role="img" aria-label="'+p+' prosent"><i style="width:'+p+'%"></i></span>'; }
function idGoalRow(key,label,A,T,fmt,me){ fmt=fmt||(x=>String(x)); const W=idWho();
  return '<div class="id-gr"><div class="id-gl">'+label+'</div><div class="id-gv">'+idNum(key,'<b>'+fmt(A)+'</b>'+(T!=null?' / '+fmt(T):''))+'</div>'+(T!=null?idBar(A,T):'<span class="id-bar none"></span>')+
    '<div class="id-gs">'+(T==null?'Mål ikke satt':(A>=T?'Nådd':fmt(Math.max(0,T-A))+' igjen'))+(W.mine&&me!=null&&me!==undefined?' · herav du: '+fmt(me):'')+'</div></div>'; }
function idPlanHTML(Wk,A,G,T){
  const plan=idPlanGet(Wk), ed=UI.id.edit;
  if(ed){ const e=ed, segs=(typeof mtCfg==='function'?mtCfg().segs:[]), bs=typeof mtBuild==='function'?mtBuild().batches.filter(b=>b.status==='aktiv'):[]; const inp=(k,l,u)=>'<label class="f"><span>'+l+'</span><input class="in" type="number" min="0" step="1" data-idpf="'+k+'" value="'+(e.goals[k]==null?'':e.goals[k])+'"'+(u?' placeholder="'+u+'"':'')+'></label>';
    return '<section class="id-plan edit" aria-label="Rediger ukeplan"><h3>Rediger ukeplan · '+Wk.label+'</h3><div class="id-pg">'+inp('dial','Nye dialoger')+inp('addr','Accounts å adressere')+inp('offers','Tilbud')+inp('pipe','Pipeline skapt (kr)')+'</div><div class="id-pg">'+
      '<label class="f"><span>Territory</span><select class="in" data-idpf="seg"><option value="">Ingen valgt</option>'+segs.map(s=>'<option value="'+esc(s.id)+'"'+(e.seg===s.id?' selected':'')+'>'+esc(mtSegShort(s.name))+'</option>').join('')+'</select></label>'+
      '<label class="f"><span>Prospektbatch</span><select class="in" data-idpf="batch"><option value="">Ingen valgt</option>'+bs.map(b=>'<option value="'+esc(b.id)+'"'+(e.batch===b.id?' selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label>'+
      '<label class="f"><span>Kalender</span><input class="in" data-idpf="calendar" value="'+esc(e.calendar||'')+'" placeholder="F.eks. Solstad mars–april"></label></div>'+
      '<div class="row"><button type="button" class="btn primary" data-idpsave="1">Lagre ukeplan</button><button type="button" class="btn ghost" data-idpx="1">Avbryt</button></div></section>'; }
  if(plan){ const g=plan.goals||{}, bn=plan.batch&&S.mtbat&&S.mtbat[plan.batch]?S.mtbat[plan.batch].name:'';
    return '<section class="id-plan on" aria-label="Ukeplan i bruk"><p><b>Ukeplan '+Wk.label+'</b> er i bruk'+(plan.at?' (satt '+esc(fd(String(plan.at).slice(0,10),{day:'numeric',month:'short'}))+(plan.byName?' av '+esc(plan.byName):'')+')':'')+'. '+[g.dial!=null?g.dial+' '+idPlural(Number(g.dial),'ny dialog','nye dialoger'):'',plan.segName?'Territory: '+esc(plan.segName):'',bn?'Batch: '+esc(bn):'',plan.calendar?'Kalender: '+esc(plan.calendar):''].filter(Boolean).join(' · ')+'</p><div class="row"><button type="button" class="btn ghost sm" data-idpe="1">Rediger</button><button type="button" class="btn ghost sm" data-idpclear="1">Fjern ukeplan</button></div></section>'; }
  const sg=idPlanSuggest(A,G,T), rows=[['Resultatmål',sg.goals.dial!=null?sg.goals.dial+' '+idPlural(sg.goals.dial,'ny dialog','nye dialoger'):'Mål ikke satt i Mål og prognose'],['Territory',sg.segName||'Ingen segment med kvalifiserte accounts ennå'],['Prospektbatch',sg.batchName?sg.batchName:'Start ny batch på 25 accounts'],['Pipeline',sg.followUp?'Følg opp '+sg.followUp+' '+idPlural(sg.followUp,'tilbud','tilbud'):'Ingen tilbud trenger oppfølging'],['Kalender',sg.calendar||'Ingen forslag fra kalenderen']];
  return '<section class="id-plan" aria-label="Forslag til ukeplan"><div class="id-ph"><h3>Forslag til ukeplan · '+Wk.label+'</h3><span class="id-note2">Regelbasert. Endres ikke automatisk.</span></div><dl class="id-pd">'+rows.map(r=>'<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd></div>').join('')+'</dl>'+
    '<div class="row"><button type="button" class="btn primary" data-idpuse="1">Bruk ukeplan</button><button type="button" class="btn" data-idpe="1">Rediger</button></div><p class="id-note2">Ukeplanen er prioriteringer og mål. De faktiske handlingene ligger fortsatt i CRM-et, og ingen oppgaver kopieres.</p></section>'; }
function idUkeHTML(){
  const Wk=idWeekOf(UI.id.wkOff>0?0:UI.id.wkOff), A=idWeekActual(0), G=idMonthGoal(), T0=idWeekTargets(A,G), plan=idPlanGet(idWeekOf(0)), pg=plan&&plan.goals||{}, T={...T0};
  for(const k of ['dial','addr','offers','pipe']) if(pg[k]!=null&&pg[k]!==''&&!isNaN(pg[k])) T[k]=Number(pg[k]);
  const paneSel='<div class="seg id-pane" role="group" aria-label="Visning">'+[['','Plan'],['sum','Oppsummering']].map(([k,n])=>'<button type="button" data-idpane="'+k+'" aria-pressed="'+((UI.id.pane||'')===k)+'">'+n+'</button>').join('')+'</div>';
  const W0=idWeekOf(0), range=fd(idIso(W0.a),{day:'numeric',month:'short'})+' til '+fd(idIso(idAdd(W0.b,-1)),{day:'numeric',month:'short'});
  const head='<div class="id-wh"><h3>'+W0.label+' <span>'+esc(range)+'</span></h3>'+paneSel+'</div>';
  if(UI.id.pane==='sum') return head+idSumHTML(G);
  const B=idActiveBatch(), P=idPipeAttention(), foc=idWeekFocus(A,G), rec=idWeekRec(A,T,B,P), CAL=idWeekCal(0), W=idWho();
  const goals=idGoalRow('wk-addr','Accounts å adressere',A.addr.n,T.addr,null,A.addr.me)+idGoalRow('wk-dial','Nye dialoger',A.dial.n,T.dial,null,A.dial.me)+idGoalRow('wk-offers','Tilbud',A.offers.n,T.offers,null,A.offers.me)+idGoalRow('wk-pipe','Pipeline skapt',A.pipe.v,T.pipe,idKr,A.pipe.me);
  const focus=foc.length?'<ol class="id-fl">'+foc.map((f,i)=>'<li><button type="button" class="id-fli" data-idgo="'+esc(f.link)+'"><b>'+(i+1)+'. '+esc(f.t)+'</b><span>'+esc(f.s)+'</span></button><details><summary>Hvorfor?</summary><p>'+esc(f.why)+'</p></details></li>').join('')+'</ol>':'<p class="id-empty-s">Ingen fokuspunkter fra datagrunnlaget akkurat nå.</p>';
  const pros=B?'<div class="id-pr"><div class="id-prt"><b>'+esc(B.b.name||'Batch')+'</b>'+(B.b.wave&&typeof mtCfg==='function'&&(mtCfg().waves.find(w=>w.id===B.b.wave))?' · '+esc(mtCfg().waves.find(w=>w.id===B.b.wave).name):'')+'</div>'+idBar(B.addr,B.total)+'<dl class="id-pk"><div><dt>Accounts totalt</dt><dd>'+B.total+'</dd></div><div><dt>Adressert</dt><dd>'+B.addr+'</dd></div><div><dt>Svar</dt><dd>'+B.reply+'</dd></div><div><dt>Gjenstår</dt><dd>'+B.left+'</dd></div></dl></div><button type="button" class="btn" data-idgo="prosp-arb">Åpne arbeidslisten</button>'
    :'<p class="id-empty-s">Ingen aktiv batch.'+(typeof mtStats==='function'&&mtStats().qualified-mtStats().addressed>0?' '+(mtStats().qualified-mtStats().addressed)+' kvalifiserte accounts venter på første kontakt.':'')+'</p><button type="button" class="btn" data-idgo="prosp-batch">Start neste batch</button>';
  const pipeL=[[P.stale.length,P.stale.length+' '+idPlural(P.stale.length,'sak','saker')+' uten aktivitet i '+ID.staleDays+' dager eller mer'],[P.offers.length,P.offers.length+' '+idPlural(P.offers.length,'tilbud bør','tilbud bør')+' følges opp'],[P.unassigned.length,P.unassigned.length+' åpne '+idPlural(P.unassigned.length,'sak','saker')+' uten ansvarlig']].filter(x=>x[0]>0);
  const pipe=(pipeL.length?'<ul class="id-pl">'+pipeL.map(x=>'<li>'+esc(x[1])+'</li>').join('')+'</ul>':'<p class="id-empty-s">Ingen saker trenger oppmerksomhet denne uken.</p>')+'<p class="id-note2">Hold har ingen utløpsdato i Salong, så utløp kan ikke varsles.</p><button type="button" class="btn" data-idgo="pipeline">Åpne Pipeline</button>';
  const evs=CAL.E.slice(0,6).map(e=>'<li><span class="id-cd">'+esc(fd(e.date,{weekday:'short',day:'numeric',month:'short'}))+'</span><span><b>'+esc(e.label)+'</b> · '+esc(roomName(e.room))+(e.title?' · '+esc(e.title):'')+' <i class="id-st">'+esc(ST[e.stage]?ST[e.stage].n:e.stage)+'</i></span></li>').join('');
  const tks=CAL.tasks.slice(0,4).map(t=>'<li><span class="id-cd">'+esc(fd(t.due,{weekday:'short',day:'numeric',month:'short'}))+'</span><span>Frist: '+esc(t.text)+' · '+esc(orgName(t.orgId))+'</span></li>').join('');
  const cal=(evs||tks)?'<ul class="id-cl">'+evs+tks+'</ul>':'<p class="id-empty-s">Ingen registrerte saker eller frister denne uken. Det betyr ikke at rommene er ledige. Bookingsystemet er ikke koblet til.</p>';
  return head+idPlanHTML(W0,A,G,T0)+'<div class="id-grid"><div class="id-col"><section class="id-sec"><h3>UKENS MÅL</h3>'+goals+(W.mine?'<p class="id-note2">Målene er teamets. «Herav du» viser dine saker og accounts.</p>':'')+'</section><section class="id-sec"><h3>UKENS FOKUS</h3>'+focus+'</section></div>'+
    '<div class="id-col"><section class="id-sec"><h3>PROSPEKTERING</h3>'+pros+'</section><section class="id-sec"><h3>SALG OG PIPELINE</h3>'+pipe+'</section></div></div><section class="id-sec wide"><h3>KALENDER / MØTER</h3>'+cal+'<button type="button" class="btn ghost sm" data-idgo="kalender">Åpne Kalender</button></section>'; }
function idSumHTML(G){
  const off=UI.id.wkOff<0?-1:0, A=idWeekActual(off), Wk=A.W, plan=idPlanGet(Wk), pg=plan&&plan.goals||{}, cur=off===0, W0=idWeekOf(0);
  const T=cur?idWeekTargets(A,G):null, tg=k=>pg[k]!=null&&pg[k]!==''?Number(pg[k]):(cur&&T?T[k]:null);
  const row=(l,v,t,key)=>'<div><dt>'+l+'</dt><dd>'+idNum(key,'<b>'+v+'</b>'+(t!=null?' / '+t:''))+'</dd></div>';
  const cov=typeof mtStats==='function'?mtStats():null, base=plan&&plan.baseline, pp=cur&&cov&&base&&base.cov!=null&&cov.cov!=null?Math.round((cov.cov-base.cov)*100):null;
  const wkTabs='<div class="seg id-wk" role="group" aria-label="Uke">'+[[0,'Denne uken'],[-1,'Forrige uke']].map(([o,n])=>'<button type="button" data-idwk="'+o+'" aria-pressed="'+(off===o)+'">'+n+'</button>').join('')+'</div>';
  const good=[], left=[], next=[];
  if(cur||true){ for(const [k,l,v,t] of [['addr','accounts adressert',A.addr.n,tg('addr')],['dial','nye dialoger',A.dial.n,tg('dial')],['offers','tilbud',A.offers.n,tg('offers')]]){ if(t!=null&&t>0){ if(v>=t) good.push(l+': '+v+' av '+t+' nådd'); else left.push(l+': '+(t-v)+' igjen av '+t); } else if(v>0) good.push(v+' '+l); }
    if(A.conf.n) good.push(A.conf.n+' '+idPlural(A.conf.n,'sak bekreftet','saker bekreftet')+' ('+idKr(A.conf.v)+')'); }
  const P=idPipeAttention(), od=openTasksOp().filter(t=>t.due&&new Date(t.due)<Wk.b&&idInScope(t.ownerId||(t.dealId&&S.deals[t.dealId]&&S.deals[t.dealId].ownerId)||null,true)&&S.orgs[t.orgId]&&!S.orgs[t.orgId].deletedAt);
  if(od.length) next.push(od.length+' åpne '+idPlural(od.length,'oppgave','oppgaver')+' med frist i eller før uken. Datoene er uendret i CRM.'); if(P.offers.length) next.push(P.offers.length+' '+idPlural(P.offers.length,'tilbud','tilbud')+' som bør følges opp');
  const B=idActiveBatch(); if(B&&B.left>0) next.push(B.left+' accounts igjen i «'+(B.b.name||'batchen')+'»');
  const li=L=>L.length?'<ul>'+L.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="id-empty-s">Ingenting å vise.</p>';
  return '<section class="id-sec wide"><div class="id-wh"><h3>UKEOPPSUMMERING · '+Wk.label+'</h3>'+wkTabs+'</div><dl class="id-sum">'+row('Accounts adressert',A.addr.n,tg('addr'),'wk-addr')+row('Nye dialoger',A.dial.n,tg('dial'),'wk-dial')+row('Tilbud sendt',A.offers.n,tg('offers'),'wk-offers')+row('Pipeline skapt',idKr(A.pipe.v),tg('pipe')!=null?idKr(tg('pipe')):null,'wk-pipe')+row('Bekreftet',idKr(A.conf.v),null,'wk-conf')+
    '<div><dt>Markedsdekning</dt><dd>'+idNum('cov',pp!=null?'<b>'+(pp>=0?'+':'')+pp+' pp</b>':'<b>–</b>')+(pp==null?'<small>'+(cur?'Ingen ukeplan med utgangspunkt. Trykk «Bruk ukeplan» på mandag.':'Ikke lagret for forrige uke.')+'</small>':'')+'</dd></div></dl>'+
    '<div class="id-s3"><div><h4>Hva gikk bra</h4>'+li(good)+'</div><div><h4>Hva gjenstår</h4>'+li(left)+'</div><div><h4>Hva flyttes til neste uke</h4>'+li(next)+'</div></div><p class="id-note2">Tallene er telt fra CRM-et for '+(W0.key===Wk.key?'inneværende':'forrige')+' uke. Dette er et arbeidsverktøy, ikke en vurdering av personen.</p>'+(sample?'<div class="row"><button class="btn ghost sm" type="button" data-idreport="1"'+(UI.report.busy?' disabled':'')+'>'+(UI.report.busy?'Skriver …':'Skriv ukerapport med Claude')+'</button><span class="id-note2">Generert tekst fra tallene siste sju dager. Les over før du sender.</span></div>'+(UI.report.text?'<div class="ai-out gen-box" id="reportOut">'+esc(UI.report.text)+'</div><div class="row"><button class="btn sm" type="button" data-copy="reportOut">Kopier</button></div>':''):'')+'</section>'; }

/* ---------- DENNE MÅNEDEN ---------- */
function idMndHTML(){
  const G=idMonthGoal(), S0=idMonthStatus(G), Tm=idMonthTime(G), cv=idCoverage(), P=idPipeAttention(), mine=idMineConfirmed(G), month=G.label.charAt(0).toUpperCase()+G.label.slice(1);
  const line=(l,v,key,cls,small)=>'<div class="id-ml'+(cls?' '+cls:'')+'"><dt>'+l+'</dt><dd>'+idNum(key,esc(v))+(small?'<small>'+esc(small)+'</small>':'')+'</dd></div>';
  const gapV=Math.max(0,G.gap), over=G.gap<0;
  const status=S0.k==='none'?'<p class="id-st none">Månedsmål er ikke satt. <button type="button" class="lnk" data-idgo="prognose">Sett mål i Mål og prognose</button></p>':'<div class="id-stat '+S0.c+'"><span class="id-sl">STATUS</span><b>'+S0.t+'</b><button type="button" class="id-n" data-idx="status">Hvordan er dette beregnet?</button></div>';
  const tid=G.goal>0?'<div class="id-tid"><p>'+Math.round(Tm.elapsed*100)+' % av måneden gått · '+Math.round(Tm.done*100)+' % av målet bekreftet</p><div class="id-t2" role="img" aria-label="Fremdrift mot tid"><span class="a" style="width:'+Math.round(Tm.elapsed*100)+'%"></span><span class="b" style="width:'+Math.min(100,Math.round(Tm.done*100))+'%"></span></div><p class="id-note2">'+(Tm.diff>=.03?'Bekreftet ligger foran tiden':Tm.diff<=-.03?'Bekreftet ligger bak tiden':'Bekreftet følger tiden')+'. Brukt: dagens måned, målt i tid. Statusen over bruker prognosemodellen, som også tar med vektet pipeline.</p></div>':'';
  const need=G.goal>0&&G.miss.v>0?'<section class="id-sec"><h3>HVA MÅ TIL?</h3><p>For å nå målet mangler ca. <b>'+idKr(G.miss.v)+'</b> utover bekreftet og vektet pipeline. Med dagens konvertering tilsvarer det omtrent:</p><ul class="id-need"><li><b>'+G.miss.ag+'</b> '+idPlural(G.miss.ag,'flere avtale','flere avtaler')+'</li><li><b>'+G.miss.of+'</b> tilbud</li><li><b>'+G.miss.di+'</b> nye dialoger</li><li><b>'+G.miss.co+'</b> nye kontakter</li></ul><p class="id-note2">Beregnet baklengs med snitt per avtale '+idKr(G.avgVal)+', og konvertering '+UI.fn.c1+' % (kontakt til dialog), '+UI.fn.c2+' % (dialog til tilbud) og '+UI.fn.c3+' % (tilbud til avtale). Samme antakelser og regnemotor som Mål og prognose.</p><button type="button" class="btn" data-idgo="prognose">Se full prognose</button></section>'
    :G.goal>0?'<section class="id-sec"><h3>HVA MÅ TIL?</h3><p>Bekreftet og vektet pipeline dekker målet. Ingenting mangler ifølge modellen.</p><button type="button" class="btn" data-idgo="prognose">Se full prognose</button></section>':'';
  const cvH=!cv||!cv.st.qualified?'<section class="id-sec"><h3>MARKEDSDEKNING</h3><p class="id-empty-s">Ingen kvalifiserte accounts i Prospekter ennå, så dekning kan ikke måles.</p><button type="button" class="btn" data-idgo="prosp">Åpne Prospekter</button></section>':
    '<section class="id-sec"><h3>MARKEDSDEKNING</h3><div class="id-cv"><div>'+idNum('cov','<b class="id-big">'+mtPct(cv.st.cov)+'</b>')+'<small>målmarked adressert</small></div><div><b class="id-pp">'+(cv.pp==null?'–':(cv.pp>=0?'+':'')+cv.pp+' pp')+'</b><small>'+(cv.base?(cv.baseKind==='month'?'siden månedsstart':'siden snapshot '+esc(fd(cv.base.date,{day:'numeric',month:'short'}))):'ingen snapshot å sammenligne med')+'</small></div></div>'+
    '<div class="id-seg">'+cv.withQ.sort((a,b)=>String(a.prio).localeCompare(String(b.prio))||0).slice(0,5).map(s=>'<button type="button" class="id-sb'+(cv.behind.includes(s)?' behind':'')+'" data-idgo="seg:'+esc(s.id)+'"><span>'+esc(mtSegShort(s.name))+'</span><span class="id-bt"><i style="width:'+Math.round((s.cov||0)*100)+'%"></i></span><b>'+mtPct(s.cov)+'</b></button>').join('')+'</div>'+
    (cv.behind.length?'<p class="id-bh">'+cv.behind.map(s=>'<b>'+esc(mtSegShort(s.name))+'</b> ligger bak snittet ('+mtPct(s.cov)+' mot '+mtPct(cv.ref)+'). '+(s.qualified-s.addressed)+' '+idPlural(s.qualified-s.addressed,'kvalifisert account er','kvalifiserte accounts er')+' fortsatt ikke adressert.').join(' ')+'</p>':'')+
    '<button type="button" class="btn" data-idgo="prosp">Åpne Prospekter</button></section>';
  return '<div class="id-wh"><h3>'+esc(month)+'</h3></div><div class="id-grid"><div class="id-col"><section class="id-sec id-mon">'+status+'<dl class="id-mt">'+
    line('Mål',G.goal>0?idKr(G.goal):'Ikke satt','m-goal','',G.goal>0?(G.goalOwn?'utledet fra seksmånedersmålet':'fra årsmålet'):'')+line('Bekreftet',idKr(G.confirmed),'m-conf','',G.nConf+' '+idPlural(G.nConf,'sak','saker'))+line('Vektet pipeline',idKr(G.weighted),'m-wtd','',G.nOpen+' åpne saker i perioden')+line('Forventet utfall',idKr(G.expected),'m-exp','strong','Basis-scenarioet')+
    line(over?'Over målet':'Gap',G.goal>0?idKr(over?-G.gap:gapV):'–','m-gap',over?'ok':gapV>0?'warn':'','')+'</dl>'+(mine!=null&&UI.id.scope==='mine'?'<p class="id-note2">Din andel av bekreftet i måneden: '+idKr(mine)+' (saker der du er ansvarlig). Målet er teamets.</p>':'')+tid+'</section>'+need+'</div><div class="id-col">'+cvH+idRecHTML('FOKUS DENNE MÅNEDEN',idMonthRec(G,S0,P),'')+'</div></div>'; }

/* ---------- forklaringer: definisjon, utvalg, periode, kilde ---------- */
function idExplain(k){
  const G=g3Calc('m'), who=UI.id.scope==='mine'&&actor()?'Mine: dine saker og oppgaver, pluss ufordelte kritiske saker':'Hele teamet', wk=idWeekOf(0), lbl='uke '+wk.wk;
  const X={
    prio:['Prioriterte handlinger','Handlinger i arbeidskøen etter faste regler: kunden først, forfalt, dagens frister, tilbud, sekvensoppgaver, Tier A-prospekter, ufordelte saker.',who+'. Maks '+ID.topN+' vises.','I dag','Pipeline, Kunder, Forespørsler, Prospekter og Sekvenser'],
    late:['Oppfølginger forfalt','Åpne oppgaver med frist før i dag.',who+'.','Forfalt før i dag','Oppgaver i Kunder og Pipeline'],
    ready:['Accounts klare for outreach','Kvalifiserte nye accounts med minst én relevant kontaktperson som ikke er kontaktet, uten opt-out.',who+'.','Nå','Prospekter (Målmarked)'],
    waiting:['Kunder venter på oss','Ubesvarte forespørsler (steg «Ny forespørsel») og sekvenser der kunden har svart.',who+'.','Nå','Forespørsler og Sekvenser'],
    'wk-addr':['Accounts å adressere','Nye qualified accounts med første utgående touch i uken. Målet fordeler det som gjenstår til dekningsmålet på ukene fram til måldato, pluss det som er gjort.','Kvalifiserte «nye» accounts, hele teamet. «Herav du» = dine accounts.',lbl,'Prospekter og aktiviteter'],
    'wk-dial':['Nye dialoger','Saker opprettet i uken som har kommet til dialog eller videre. Målet er dialogene som mangler til månedsmålet, fordelt på ukene som er igjen, pluss det som er gjort.','Alle saker, hele teamet.',lbl,'Pipeline og Mål og prognose (samme antakelser)'],
    'wk-offers':['Tilbud','Saker som nådde Tilbud sendt eller videre i uken (tidspunkt for siste stegendring). Målet er tilbud som mangler til månedsmålet, fordelt på ukene som er igjen.','Alle saker, hele teamet.',lbl,'Pipeline og Mål og prognose'],
    'wk-pipe':['Pipeline skapt','Verdi av saker opprettet i uken, ikke tapte. Målet er tilbudsverdien som mangler til månedsmålet, fordelt på ukene som er igjen.','Alle saker, hele teamet.',lbl,'Pipeline og Mål og prognose'],
    'wk-conf':['Bekreftet','Verdi av saker som ble Bekreftet i uken (tidspunkt for siste stegendring).','Alle saker, hele teamet.',lbl,'Pipeline'],
    cov:['Markedsdekning','Adresserte kvalifiserte accounts delt på alle kvalifiserte accounts. Samme definisjon som i Prospekter. Endring i prosentpoeng sammenlignes med snapshot eller ukeplanens utgangspunkt.','Kvalifiserte «nye» accounts, hele teamet.','Nå, mot lagret utgangspunkt','Prospekter (Målmarked og snapshots)'],
    'm-goal':['Mål','Månedsmålet. Eget mål for perioden hvis satt, ellers årsmålet delt på 12.','Hele teamet.',G.label,'Mål og prognose'],
    'm-conf':['Bekreftet','Verdi av saker i steget Bekreftet med stegtidspunkt i måneden.','Alle saker, hele teamet.',G.label,'Pipeline (via Mål og prognose)'],
    'm-wtd':['Vektet pipeline','Verdi × sannsynlighet per steg for åpne saker der forventet avgjørelse faller i perioden (arrangementsdato minus ledetid på '+g3Set().lead+' dager).','Åpne saker, hele teamet.',G.label,'Mål og prognose'],
    'm-exp':['Forventet utfall','Bekreftet pluss vektet pipeline justert for scenario, pluss forventet nytilførsel. Dette er Basis-scenarioet i Mål og prognose.','Hele teamet.',G.label,'Mål og prognose'],
    'm-gap':['Gap','Mål minus forventet utfall. Negativt gap betyr over målet.','Hele teamet.',G.label,'Mål og prognose'],
    status:['Status','Forventet utfall delt på mål: minst '+Math.round(ID.stat.ahead*100)+' % = foran plan, minst '+Math.round(ID.stat.on*100)+' % = i rute, minst '+Math.round(ID.stat.slight*100)+' % = litt bak, ellers bak plan. Bruker gjeldende prognosemodell, ikke lineær fremdrift.','Hele teamet.',G.label,'Mål og prognose']};
  return X[k]||null; }
function idPop(k,anchor){
  const old=document.getElementById('id-pop'); if(old){ const same=old.dataset.k===k; old.remove(); if(same) return; } const x=idExplain(k); if(!x) return;
  const p=document.createElement('div'); p.id='id-pop'; p.dataset.k=k; p.setAttribute('role','dialog'); p.setAttribute('aria-label',x[0]);
  p.innerHTML='<h4>'+esc(x[0])+'</h4><dl><div><dt>Definisjon</dt><dd>'+esc(x[1])+'</dd></div><div><dt>Utvalg</dt><dd>'+esc(x[2])+'</dd></div><div><dt>Tidsperiode</dt><dd>'+esc(x[3])+'</dd></div><div><dt>Datakilde</dt><dd>'+esc(x[4])+'</dd></div></dl>';
  document.body.appendChild(p); const r=anchor.getBoundingClientRect(), w=p.offsetWidth, h=p.offsetHeight;
  p.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px'; p.style.top=(r.bottom+6+h>innerHeight?Math.max(8,r.top-h-6):r.bottom+6)+'px'; }
document.addEventListener('click',e=>{ const p=document.getElementById('id-pop'); if(p&&!e.target.closest('#id-pop,[data-idx]')) p.remove(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const p=document.getElementById('id-pop'); if(p){ p.remove(); e.stopPropagation(); } } },true);

/* ---------- hovedvisning ---------- */
function idHTML(){ const t=UI.id.tab; return '<div class="id">'+idHeader()+idTabs()+'<div class="id-pane-b" role="tabpanel" aria-labelledby="idt-'+t+'">'+(t==='uke'?idUkeHTML():t==='mnd'?idMndHTML():idDagHTML())+'</div></div>'; }
const idRR=()=>renderView(true);
function idGo(l){
  if(l==='pipeline'||l==='kalender'||l==='prognose'){ if(l==='prognose'){ UI.g3.h='m'; } go(l); return; }
  if(l==='prosp-seq'){ UI.mt.tab='seq'; go('prosp'); return; }
  if(l==='prosp'||l==='prosp-arb'||l==='prosp-batch'){ UI.mt.tab=l==='prosp-arb'?'arb':UI.mt.tab; if(l==='prosp') UI.mt.tab='mal'; go('prosp'); if(l==='prosp-batch') mtModalOpen('batch'); return; }
  if(l.startsWith('seg:')){ UI.mt.tab='mal'; UI.mt.seg=l.slice(4); UI.mt.kind='ny'; UI.mt.page=1; go('prosp'); return; }
  if(l==='batch'){ idGo('prosp-batch'); return; } }
async function idAssignFlow(it){ if(!it) return;
  if(it.obj==='task'){ const t=S.acts[it.done&&it.done.id]; if(!t) return; const d=t.dealId&&S.deals[t.dealId]; if(d){ openAssign('deal',t.dealId); return; } openAssign('org',t.orgId); return; }
  if(it.obj==='deal'){ openAssign('deal',it.dealId); return; }
  if(it.obj==='acc'){ mtOpen(it.accId); return; } }
function idClick(e){
  if(UI.view!=='idag') return; const t=e.target.closest('button,[data-idtab]'); if(!t) return; const d=t.dataset, Q=()=>idQueue().all, item=k=>UI.id.cache&&UI.id.cache[k]||Q().find(i=>i.key===k);
  if(d.idtab){ UI.id.tab=d.idtab; UI.id.focus=null; idRR(); return; }
  if(d.idsc){ UI.id.scope=d.idsc; idRR(); return; }
  if(d.idx){ idPop(d.idx,t); return; }
  if(d.idgo){ idGo(d.idgo); return; }
  if(d.idpane!==undefined){ UI.id.pane=d.idpane; idRR(); return; }
  if(d.idwk!==undefined){ UI.id.wkOff=Number(d.idwk); idRR(); return; }
  if(d.idreport){ makeReport(); return; }
  if(d.idsh){ UI.id.snoozed=!UI.id.snoozed; idRR(); return; }
  if(d.idopen){ const it=item(d.idopen); if(!it) return; if(it.open.k==='mt') mtOpen(it.open.id); else openDrawer(it.open.k,it.open.id); return; }
  if(d.idquick){
    const cut=d.idquick.lastIndexOf('|'), it=item(d.idquick.slice(0,cut));
    if(cut<0||!it||!it.accId||UI.id.quickBusy) return;
    UI.id.quickBusy=true; t.disabled=true;
    Promise.resolve(mtLogCallOutcome(it.accId,d.idquick.slice(cut+1))).then(r=>{
      if(r&&r.err) toast(r.err);
      else toast(d.idquick.endsWith('|call_later')?
        'Samtalen er logget. Sett avtalt tidspunkt på accountkortet.':'Samtalen er logget.');
    }).catch(e=>toast('Kunne ikke logge samtalen: '+(e&&e.message||e))).finally(()=>{
      UI.id.quickBusy=false; idRR();
    });
    return;
  }
  if(d.idlog){ const it=item(d.idlog); if(it&&it.accId) mtOpen(it.accId,'do'); else if(it) openDrawer(it.open.k,it.open.id); return; }
  if(d.idone){ const it=item(d.idone); if(!it) return; t.disabled=true; idDone(it).then(ok=>{ if(ok) toast('Ferdig. Oppdatert i '+it.src+'.'); idRR(); }); return; }
  if(d.idsn){ const [k,mode]=d.idsn.split('|'); if(mode==='clear'){ idSetSnooze(k,null).then(idRR); return; } const it=item(k); if(!it) return; idSnoozeIt(it,mode).then(r=>{ if(r) toast(r.moved?'Fristen er flyttet til '+fd(idIso(r.to),{weekday:'long',day:'numeric',month:'short'})+' i oppgaven.':'Skjult i din I dag til '+fd(idIso(r.to),{weekday:'long',day:'numeric',month:'short'})+'. Saken er ikke endret.'); idRR(); }); return; }
  if(d.idas){ idAssignFlow(item(d.idas)); return; }
  if(d.idfs){ const Qv=idQueue(); UI.id.focus={n0:Qv.shown.length}; idRR(); return; }
  if(d.idfx){ UI.id.focus=null; UI.id.nr=null; idRR(); return; }
  if(d.idnr){ UI.id.nr=d.idnr; idRR(); setTimeout(()=>{ const i=document.getElementById('idNrR'); i&&i.focus(); },0); return; }
  if(d.idnrx){ UI.id.nr=null; idRR(); return; }
  if(d.idnrgo){ const it=item(d.idnrgo), r=(document.getElementById('idNrR')||{}).value||''; if(!it) return; idNotRelevant(it.accId,r).then(res=>{ if(res&&res.err){ toast(res.err); return; } UI.id.nr=null; toast('Diskvalifisert med årsak. Ligger i Prospekter.'); idRR(); }); return; }
  /* ukeplan */
  if(d.idpuse||d.idpe||d.idpsave||d.idpx||d.idpclear){ const W0=idWeekOf(0), A=idWeekActual(0), G=idMonthGoal(), T=idWeekTargets(A,G), sg=idPlanSuggest(A,G,T), a=actor();
    if(d.idpuse){ const cv=typeof mtStats==='function'?mtStats():null; idPlanSave(W0,{goals:sg.goals,seg:sg.seg,segName:sg.segName,batch:sg.batch,calendar:sg.calendar,at:iso(new Date()),byName:a?a.name:(me.name||''),baseline:cv?{cov:cv.cov,addressed:cv.addressed,qualified:cv.qualified,at:idIso(new Date())}:null}).then(()=>{ toast('Ukeplanen er i bruk. Ingen oppgaver er opprettet eller kopiert.'); idRR(); }); return; }
    if(d.idpe){ const cur=idPlanGet(W0); UI.id.edit=cur?{goals:{...(cur.goals||{})},seg:cur.seg||'',batch:cur.batch||'',calendar:cur.calendar||''}:{goals:{...sg.goals},seg:sg.seg,batch:sg.batch,calendar:sg.calendar}; idRR(); return; }
    if(d.idpx){ UI.id.edit=null; idRR(); return; }
    if(d.idpclear){ idPlanClear(W0).then(()=>{ toast('Ukeplanen er fjernet.'); idRR(); }); return; }
    if(d.idpsave){ const e=UI.id.edit; if(!e) return; const cur=idPlanGet(W0), cv=typeof mtStats==='function'?mtStats():null, seg=typeof mtCfg==='function'?mtCfg().segs.find(s=>s.id===e.seg):null;
      const g={}; for(const k of ['dial','addr','offers','pipe']){ const v=e.goals[k]; g[k]=v===''||v==null||isNaN(v)?null:Number(v); }
      idPlanSave(W0,{goals:g,seg:e.seg,segName:seg?mtSegShort(seg.name):'',batch:e.batch,calendar:e.calendar||'',at:(cur&&cur.at)||iso(new Date()),byName:(cur&&cur.byName)||(a?a.name:(me.name||'')),baseline:(cur&&cur.baseline)||(cv?{cov:cv.cov,addressed:cv.addressed,qualified:cv.qualified,at:idIso(new Date())}:null)}).then(()=>{ UI.id.edit=null; toast('Ukeplanen er lagret.'); idRR(); }); return; } }
}
function idInput(e){ const t=e.target; if(UI.view!=='idag'||!t.dataset||!t.dataset.idpf||!UI.id.edit) return; const k=t.dataset.idpf; if(['dial','addr','offers','pipe'].includes(k)) UI.id.edit.goals[k]=t.value; else UI.id.edit[k]=t.value; }
V.idag.html=function(){ return noticesHTML()+idHTML(); };
V.idag.wire=function(v){
  v.onclick=idClick; v.oninput=idInput; v.onchange=idInput;
  v.querySelectorAll('[data-idtab]').forEach(b=>b.onkeydown=e=>{ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ const i=ID_TABS.findIndex(x=>x[0]===UI.id.tab), n=ID_TABS[(i+(e.key==='ArrowRight'?1:ID_TABS.length-1))%ID_TABS.length][0]; UI.id.tab=n; UI.id.focus=null; idRR(); setTimeout(()=>{ const x=document.getElementById('idt-'+n); x&&x.focus(); },0); } });
};
Object.defineProperty(VDESC,'idag',{configurable:true,enumerable:true,get(){ const t=new Date().toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'}); return t.charAt(0).toUpperCase()+t.slice(1); }});
const IDX={queue:idQueue,items:idItems,top:idTop,weekActual:idWeekActual,weekTargets:idWeekTargets,month:idMonthGoal,status:idMonthStatus,cov:idCoverage,plan:{get:idPlanGet,suggest:idPlanSuggest,save:idPlanSave,week:idWeekOf},explain:idExplain,done:idDone,snooze:idSnoozeIt,pipe:idPipeAttention,batch:idActiveBatch,cfg:ID,focus:idWeekFocus,mineConf:idMineConfirmed};
