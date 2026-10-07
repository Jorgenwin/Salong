/* ---------- I dag, Denne uken, Denne måneden (omarbeidet) ----------
   Dette laget bygger ikke egne oppgavelister eller egne mål. Det leser:
   - handlinger fra crm.priority (PriorityService)
   - mål, plan og prognose fra crm.goals (PlanningService, ett seksmånedersmål)
   Senere funksjonsdeklarasjoner med samme navn erstatter de i idagui.js. Klikkhåndtering (idClick) og forklaringer (idExplain) gjenbrukes. */
const idk=n=>n>=1e6?mill(n):n>=1000?Math.round(n/1000)+'k':nf.format(Math.round(n||0));
const idF=(P,v)=>P.type==='bookings'?String(Math.round(v)):idk(v);
function idGreeting(){ const a=typeof actor==='function'?actor():null, nm=String((a&&a.name)||me.name||'').trim().split(/\s+/)[0]; return 'God dag'+(nm?', '+nm:''); }
const idGoalSet=()=>planningService.getCurrent().status==='active';
function idGo(l){
  if(l==='uke'){ UI.id.tab='uke'; UI.id.focus=null; renderView(true); return; }
  if(l==='pipeline'||l==='kalender'||l==='prognose'){ if(l==='prognose'){ UI.g3.h='m'; } go(l); return; }
  if(l==='pri'){ UI.mt.tab='pri'; go('prosp'); return; }
  if(l==='maal'){ UI.pl.edit=true; UI.g3.h='h'; go('prognose'); return; }
  if(l==='prosp'||l==='prosp-arb'||l==='prosp-batch'){ UI.mt.tab=l==='prosp-arb'?'arb':UI.mt.tab; if(l==='prosp') UI.mt.tab='mal'; go('prosp'); if(l==='prosp-batch') mtModalOpen('batch'); return; }
  if(l.startsWith('seg:')){ UI.mt.tab='mal'; UI.mt.seg=l.slice(4); UI.mt.kind='ny'; UI.mt.page=1; go('prosp'); return; }
  if(l==='batch'){ idGo('prosp-batch'); return; } }

/* uketall: alle mål utledes av seksmånedersmålet. Manuelle justeringer (Juster plan …) overstyrer bare uken. */
function idWeekTargets(A,G){
  const P=planningService.getPlan(), T={has:P.status==='active'||P.status==='upcoming'};
  if(!T.has){ T.dial=T.offers=T.pipe=T.addr=null; }
  else { const st=P.chain.steps, share=P.period.working_days_left?Math.min(1,P.week.working_days_left/P.period.working_days_left):0;
    T.addr=A.addr.n+Math.ceil(st[4].n*share); T.dial=A.dial.n+Math.ceil(st[3].n*share); T.offers=A.offers.n+Math.ceil(st[2].n*share);
    T.pipe=P.type==='bookings'?null:A.pipe.v+Math.round(st[2].n*plAvg().v*share); }
  if(typeof mtStats==='function'){ const st=mtStats(); T.addrQ=st.qualified; } return T; }

/* ---------- I DAG ---------- */
function idProgressHTML(){
  const P=planningService.getPlan();
  if(P.status==='not_set') return '<section class="idn-prog none"><div><b>Ingen seksmånedersmål er satt</b><p>Sett ett mål, så regner Salong ut måned, uke og dag selv. Ingenting er fylt inn på forhånd.</p></div><button type="button" class="btn primary" data-idgo="maal">Sett seksmånedersmål</button></section>';
  const pct=Math.round(P.progress*100), F=v=>idF(P,v), unit=P.type==='bookings'?' bookinger':'';
  if(P.status==='upcoming') return '<section class="idn-prog"><div class="idn-pn"><b>'+F(P.target)+unit+'</b><span>mål for '+esc(plD(P.period.start))+' – '+esc(plD(P.period.end))+'</span></div><p class="idn-ps">Perioden starter '+esc(fd(P.period.start,{day:'numeric',month:'long'}))+'. '+P.period.working_days_total+' arbeidsdager i perioden. Forventet ved dagens fart: <b>'+F(P.forecast.at_pace)+'</b></p></section>';
  return '<section class="idn-prog" aria-label="Fremdrift mot seksmånedersmålet"><div class="idn-pn"><b>'+pct+' %</b><span>'+F(P.actual)+' av '+F(P.target)+unit+'</span></div>'+
    '<div class="idn-bar" role="img" aria-label="'+pct+' prosent av målet bekreftet"><i style="width:'+pct+'%"></i></div>'+
    '<p class="idn-ps"><span>'+P.period.working_days_left+' arbeidsdager igjen</span><span aria-hidden="true">·</span><span>Forventet ved dagens fart: <b>'+F(P.forecast.at_pace)+'</b></span>'+plPaceChip(P.forecast.pace)+'</p>'+
    (P.activity_warning?'<p class="pl-warn" role="status">'+esc(P.activity_warning)+'</p>':'')+'</section>'; }
function idWeekLine(){
  const P=planningService.getPlan(), A=idWeekActual(0), T=idWeekTargets(A,null), part=(n,t,l)=>t!=null?'<span>'+n+' av '+t+' '+l+'</span>':'<span>'+n+' '+l+'</span>';
  const parts=[part(A.addr.n,T.addr,'adressert'),part(A.dial.n,T.dial,idPlural(A.dial.n,'dialog','dialoger')),part(A.offers.n,T.offers,'tilbud')];
  if(P.status!=='not_set'&&P.status!=='ended') parts.push('<span>plan '+idF(P,P.week.planned)+'</span>');
  return '<p class="idn-week"><b>DENNE UKEN</b>'+parts.join('<span aria-hidden="true">·</span>')+'<button type="button" class="lnk" data-idgo="uke">Åpne uken</button></p>'; }
function idFocusItem(p){
  const it=p._item, team=UI.id.scope==='team'||!idWho().mine, a=p.primary_action;
  const act=a.kind==='start_contact'?'<button type="button" class="btn primary" data-idopen="'+esc(p.key)+'">Start kontakt</button>':a.kind==='assign'?'<button type="button" class="btn primary" data-idas="'+esc(p.key)+'">Tildel</button>':'<button type="button" class="btn primary" data-idopen="'+esc(p.key)+'">'+esc(a.label)+'</button>';
  const menu='<details class="id-more"><summary aria-label="Flere valg for '+esc(it.org)+'" title="Flere valg">⋯</summary><div class="id-mm" role="menu"><button type="button" role="menuitem" data-idsn="'+esc(p.key)+'|tom">Utsett til i morgen</button><button type="button" role="menuitem" data-idsn="'+esc(p.key)+'|week">Utsett til mandag</button>'+(it.assign||it.obj==='deal'||it.obj==='task'||it.obj==='acc'?'<button type="button" role="menuitem" data-idas="'+esc(p.key)+'">Tildel …</button>':'')+'</div></details>';
  const sec=p.secondary_action?'<button type="button" class="btn" data-idone="'+esc(p.key)+'">Utført</button>':'';
  return '<li class="idn-f'+(p.late?' late':'')+'" data-key="'+esc(p.key)+'"><div class="idn-fm"><div class="idn-fo">'+esc(it.org)+(team&&it.ownerId?' <span>'+esc(ownName(it.ownerId))+'</span>':'')+'</div><div class="idn-fa">'+esc(p.title)+'</div><div class="idn-fw">'+esc(p.reason)+'</div></div><div class="idn-fb">'+act+sec+menu+'</div></li>'; }
function idFocusBlock(){
  const R=useQuery('pri:today:'+(UI.id.scope||''),()=>crm.priority.getToday({focus:3})), st=viewState(R);
  if(st.state==='loading'||st.state==='error') return '<section class="idn-sec">'+stateHTML(st)+'</section>';
  const Q=idQueue(); UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i]));
  const f=R.data.focus, rest=R.data.items.slice(3);
  if(!f.length) return '<section class="idn-sec"><h3>DAGENS FOKUS</h3>'+idEmpty(Q)+'</section>';
  return '<section class="idn-sec"><div class="idn-sh"><h3>DAGENS FOKUS</h3><button type="button" class="lnk" data-idfs="1">Fokusmodus</button></div><ol class="idn-fl">'+f.map(idFocusItem).join('')+'</ol>'+
    (rest.length||R.data.more?'<details class="idn-rest"'+(UI.id.restOpen?' open':'')+'><summary>Flere handlinger ('+(rest.length+R.data.more)+')</summary><ul class="id-list">'+rest.map(p=>idRow(p._item)).join('')+'</ul>'+(R.data.more?'<p class="id-more-n">'+R.data.more+' '+idPlural(R.data.more,'handling','handlinger')+' til er rangert lavere.</p>':'')+'</details>':'')+
    (R.data.snoozed?'<p class="id-more-n">'+R.data.snoozed+' utsatt i din visning. <button type="button" class="lnk" data-idsh="1">'+(UI.id.snoozed?'Skjul':'Vis')+'</button></p>'+(UI.id.snoozed?'<ul class="id-list quiet">'+Q.hidden.map(i=>'<li class="id-r" data-key="'+esc(i.key)+'"><span class="id-chk off"></span><div class="id-m"><div class="id-o">'+esc(i.org)+'</div><div class="id-a">'+esc(i.action)+'</div></div><div class="id-ac"><button type="button" class="lnk" data-idsn="'+esc(i.key)+'|clear">Hent tilbake</button></div></li>').join('')+'</ul>':''):'')+'</section>'; }
function idPipeBlock(){
  const P=idPipeAttention(), open=dealsOp().filter(idDealOk).filter(d=>OPEN.includes(d.stage)&&idInScope(d.ownerId,true)), w=open.reduce((s,d)=>s+dval(d)*ST[d.stage].p,0);
  const L=[[P.offers.length,P.offers.length+' '+idPlural(P.offers.length,'tilbud bør','tilbud bør')+' følges opp'],[P.stale.length,P.stale.length+' '+idPlural(P.stale.length,'sak','saker')+' uten aktivitet i '+ID.staleDays+' dager'],[P.unassigned.length,P.unassigned.length+' åpne '+idPlural(P.unassigned.length,'sak','saker')+' uten ansvarlig']].filter(x=>x[0]>0).slice(0,3);
  return '<section class="idn-box"><h3>PIPELINE</h3>'+(open.length?'<p class="idn-big"><b>'+open.length+'</b> '+idPlural(open.length,'åpen sak','åpne saker')+' <span>vektet '+idk(w)+'</span></p>':'<p class="id-empty-s">Ingen åpne saker.</p>')+
    (L.length?'<ul>'+L.map(x=>'<li>'+esc(x[1])+'</li>').join('')+'</ul>':(open.length?'<p class="id-empty-s">Ingenting trenger oppmerksomhet nå.</p>':''))+'<button type="button" class="btn ghost sm" data-idgo="pipeline">Åpne Pipeline</button></section>'; }
function idTerrBlock(){
  const B=idActiveBatch(), cv=idCoverage(), pend=typeof bkPending==='function'?bkPending():0; let body='';
  if(B){ const c=bkCounts(bkAccsOf(B.b)); body+='<p class="idn-big"><b>'+esc(B.b.name||'Batch')+'</b> <span>'+B.addr+' av '+B.total+' adressert</span></p>'+idBar(B.addr,B.total)+(c.venter?'<p class="id-empty-s">'+c.venter+' pågår eller venter på berikelse</p>':c.klar?'<p class="id-empty-s">'+c.klar+' klare for kontakt</p>':''); }
  else if(cv&&cv.st.qualified-cv.st.addressed>0) body+='<p class="id-empty-s">Ingen aktiv batch. '+(cv.st.qualified-cv.st.addressed)+' kvalifiserte accounts er ikke adressert.</p>';
  else body+='<p class="id-empty-s">Ingen aktiv batch.</p>';
  if(cv&&cv.behind[0]) body+='<p class="idn-bh"><b>'+esc(mtSegShort(cv.behind[0].name))+'</b> ligger bak snittet ('+mtPct(cv.behind[0].cov)+' mot '+mtPct(cv.ref)+')</p>';
  return '<section class="idn-box"><h3>TERRITORY</h3>'+body+'<button type="button" class="btn ghost sm" data-idgo="'+(B?'prosp-arb':'prosp')+'">'+(B?'Åpne arbeidslisten':'Åpne Prospekter')+'</button></section>'; }
function idDagHTML(){
  if(UI.id.focus){ const Q=idQueue(); UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i])); return idFocusHTML(Q); }
  const Q=idQueue(); if(idNoData()&&!idGoalSet()) return '<header class="idn-hd"><h2>'+esc(idGreeting())+'</h2></header>'+idProgressHTML()+idEmpty(Q);
  return '<header class="idn-hd"><h2>'+esc(idGreeting())+'</h2></header>'+idProgressHTML()+idWeekLine()+idFocusBlock()+'<div class="idn-two">'+idPipeBlock()+idTerrBlock()+'</div>'; }

/* ---------- DENNE UKEN: automatisk plan, manuell justering som sekundær ---------- */
function idAdjustHTML(Wk,A,T0){
  const plan=idPlanGet(Wk), ed=UI.id.edit, on=!!plan;
  if(ed){ const e=ed, segs=(typeof mtCfg==='function'?mtCfg().segs:[]), bs=typeof mtBuild==='function'?mtBuild().batches.filter(b=>b.status==='aktiv'):[]; const inp=(k,l)=>'<label class="f"><span>'+l+'</span><input class="in" type="number" min="0" step="1" data-idpf="'+k+'" value="'+(e.goals[k]==null?'':e.goals[k])+'" placeholder="'+(T0[k]==null?'':'Automatisk: '+T0[k])+'"></label>';
    return '<section class="id-plan edit" aria-label="Juster ukeplan"><h3>Juster plan for '+Wk.label+'</h3><p class="id-note2">Tomt felt betyr automatisk verdi fra seksmånedersmålet. Justeringen gjelder bare denne uken og endrer ikke målet.</p><div class="id-pg">'+inp('addr','Accounts å adressere')+inp('dial','Nye dialoger')+inp('offers','Tilbud')+inp('pipe','Pipeline skapt (kr)')+'</div><div class="id-pg">'+
      '<label class="f"><span>Territory</span><select class="in" data-idpf="seg"><option value="">Ingen valgt</option>'+segs.map(s=>'<option value="'+esc(s.id)+'"'+(e.seg===s.id?' selected':'')+'>'+esc(mtSegShort(s.name))+'</option>').join('')+'</select></label>'+
      '<label class="f"><span>Prospektbatch</span><select class="in" data-idpf="batch"><option value="">Ingen valgt</option>'+bs.map(b=>'<option value="'+esc(b.id)+'"'+(e.batch===b.id?' selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label>'+
      '<label class="f"><span>Kalender</span><input class="in" data-idpf="calendar" value="'+esc(e.calendar||'')+'" placeholder="F.eks. Solstad mars–april"></label></div>'+
      '<div class="row"><button type="button" class="btn primary" data-idpsave="1">Lagre justering</button><button type="button" class="btn ghost" data-idpx="1">Avbryt</button></div></section>'; }
  return '<p class="idn-adj">'+(on?'<span class="pl-chip warn">Manuelt justert</span> ':'<span class="id-note2">Planen er automatisk fra seksmånedersmålet. </span>')+'<button type="button" class="lnk" data-idpe="1">Juster plan …</button>'+(on?' <button type="button" class="lnk" data-idpclear="1">Tilbake til automatisk plan</button>':'')+'</p>'; }
function idUkeHTML(){
  const Wk=idWeekOf(UI.id.wkOff>0?0:UI.id.wkOff), A=idWeekActual(0), G=idMonthGoal(), T0=idWeekTargets(A,G), plan=idPlanGet(idWeekOf(0)), pg=plan&&plan.goals||{}, T={...T0}, P=planningService.getPlan();
  for(const k of ['dial','addr','offers','pipe']) if(pg[k]!=null&&pg[k]!==''&&!isNaN(pg[k])) T[k]=Number(pg[k]);
  const paneSel='<div class="seg id-pane" role="group" aria-label="Visning">'+[['','Plan'],['sum','Oppsummering']].map(([k,n])=>'<button type="button" data-idpane="'+k+'" aria-pressed="'+((UI.id.pane||'')===k)+'">'+n+'</button>').join('')+'</div>';
  const W0=idWeekOf(0), range=fd(idIso(W0.a),{day:'numeric',month:'short'})+' til '+fd(idIso(idAdd(W0.b,-1)),{day:'numeric',month:'short'});
  const head='<div class="id-wh"><h3>'+W0.label+' <span>'+esc(range)+'</span></h3>'+paneSel+'</div>';
  if(UI.id.pane==='sum') return head+idSumHTML(G);
  const B=idActiveBatch(), Pp=idPipeAttention(), foc=idWeekFocus(A,G), CAL=idWeekCal(0), W=idWho();
  const planLine=P.status==='not_set'?'<p class="idn-wp none">Ingen seksmånedersmål er satt, så det finnes ingen automatisk ukeplan. <button type="button" class="lnk" data-idgo="maal">Sett seksmånedersmål</button></p>':
    P.status==='ended'?'<p class="idn-wp none">Seksmånedersperioden er avsluttet.</p>':'<p class="idn-wp"><b>'+idF(P,P.week.planned)+(P.type==='bookings'?' bookinger':'')+'</b> planlagt denne uken <span>· '+idF(P,P.week.actual)+' bekreftet · '+P.week.working_days_left+' arbeidsdager igjen</span></p>';
  const goals=idGoalRow('wk-addr','Accounts å adressere',A.addr.n,T.addr,null,A.addr.me)+idGoalRow('wk-dial','Nye dialoger',A.dial.n,T.dial,null,A.dial.me)+idGoalRow('wk-offers','Tilbud',A.offers.n,T.offers,null,A.offers.me)+(P.type==='bookings'?'':idGoalRow('wk-pipe','Pipeline skapt',A.pipe.v,T.pipe,idKr,A.pipe.me));
  const focus=foc.length?'<ol class="id-fl">'+foc.map((f,i)=>'<li><button type="button" class="id-fli" data-idgo="'+esc(f.link)+'"><b>'+(i+1)+'. '+esc(f.t)+'</b><span>'+esc(f.s)+'</span></button><details><summary>Hvorfor?</summary><p>'+esc(f.why)+'</p></details></li>').join('')+'</ol>':'<p class="id-empty-s">Ingen fokuspunkter fra datagrunnlaget akkurat nå.</p>';
  const pros=B?'<div class="id-pr"><div class="id-prt"><b>'+esc(B.b.name||'Batch')+'</b></div>'+idBar(B.addr,B.total)+'<dl class="id-pk"><div><dt>Accounts totalt</dt><dd>'+B.total+'</dd></div><div><dt>Adressert</dt><dd>'+B.addr+'</dd></div><div><dt>Svar</dt><dd>'+B.reply+'</dd></div><div><dt>Gjenstår</dt><dd>'+B.left+'</dd></div></dl></div><button type="button" class="btn" data-idgo="prosp-arb">Åpne arbeidslisten</button>'
    :'<p class="id-empty-s">Ingen aktiv batch.'+(typeof mtStats==='function'&&mtStats().qualified-mtStats().addressed>0?' '+(mtStats().qualified-mtStats().addressed)+' kvalifiserte accounts venter på første kontakt.':'')+'</p><button type="button" class="btn" data-idgo="prosp-batch">Start neste batch</button>';
  const pipeL=[[Pp.stale.length,Pp.stale.length+' '+idPlural(Pp.stale.length,'sak','saker')+' uten aktivitet i '+ID.staleDays+' dager eller mer'],[Pp.offers.length,Pp.offers.length+' '+idPlural(Pp.offers.length,'tilbud bør','tilbud bør')+' følges opp'],[Pp.unassigned.length,Pp.unassigned.length+' åpne '+idPlural(Pp.unassigned.length,'sak','saker')+' uten ansvarlig']].filter(x=>x[0]>0);
  const pipe=(pipeL.length?'<ul class="id-pl">'+pipeL.map(x=>'<li>'+esc(x[1])+'</li>').join('')+'</ul>':'<p class="id-empty-s">Ingen saker trenger oppmerksomhet denne uken.</p>')+'<p class="id-note2">Hold har ingen utløpsdato i Salong, så utløp kan ikke varsles.</p><button type="button" class="btn" data-idgo="pipeline">Åpne Pipeline</button>';
  const evs=CAL.E.slice(0,6).map(e=>'<li><span class="id-cd">'+esc(fd(e.date,{weekday:'short',day:'numeric',month:'short'}))+'</span><span><b>'+esc(e.label)+'</b> · '+esc(roomName(e.room))+(e.title?' · '+esc(e.title):'')+' <i class="id-st">'+esc(ST[e.stage]?ST[e.stage].n:e.stage)+'</i></span></li>').join('');
  const tks=CAL.tasks.slice(0,4).map(t=>'<li><span class="id-cd">'+esc(fd(t.due,{weekday:'short',day:'numeric',month:'short'}))+'</span><span>Frist: '+esc(t.text)+' · '+esc(orgName(t.orgId))+'</span></li>').join('');
  const cal=(evs||tks)?'<ul class="id-cl">'+evs+tks+'</ul>':'<p class="id-empty-s">Ingen registrerte saker eller frister denne uken. Det betyr ikke at rommene er ledige. Bookingsystemet er ikke koblet til.</p>';
  return head+planLine+idAdjustHTML(W0,A,T0)+'<div class="id-grid"><div class="id-col"><section class="id-sec"><h3>UKENS MÅL</h3>'+goals+(W.mine?'<p class="id-note2">Målene er teamets. «Herav du» viser dine saker og accounts.</p>':'')+'</section><section class="id-sec"><h3>UKENS FOKUS</h3>'+focus+'</section></div>'+
    '<div class="id-col"><section class="id-sec"><h3>PROSPEKTERING</h3>'+pros+'</section><section class="id-sec"><h3>SALG OG PIPELINE</h3>'+pipe+'</section></div></div><section class="id-sec wide"><h3>KALENDER / MØTER</h3>'+cal+'<button type="button" class="btn ghost sm" data-idgo="kalender">Åpne Kalender</button></section>'; }

/* ---------- DENNE MÅNEDEN ---------- */
function idCovHTML(){
  const cv=idCoverage();
  if(!cv||!cv.st.qualified) return '<section class="id-sec"><h3>MARKEDSDEKNING</h3><p class="id-empty-s">Ingen kvalifiserte accounts i Prospekter ennå, så dekning kan ikke måles.</p><button type="button" class="btn" data-idgo="prosp">Åpne Prospekter</button></section>';
  return '<section class="id-sec"><h3>MARKEDSDEKNING</h3><div class="id-cv"><div>'+idNum('cov','<b class="id-big">'+mtPct(cv.st.cov)+'</b>')+'<small>målmarked adressert</small></div><div><b class="id-pp">'+(cv.pp==null?'–':(cv.pp>=0?'+':'')+cv.pp+' pp')+'</b><small>'+(cv.base?(cv.baseKind==='month'?'siden månedsstart':'siden snapshot '+esc(fd(cv.base.date,{day:'numeric',month:'short'}))):'ingen snapshot å sammenligne med')+'</small></div></div>'+
    '<div class="id-seg">'+cv.withQ.slice().sort((a,b)=>String(a.prio).localeCompare(String(b.prio))||0).slice(0,5).map(s=>'<button type="button" class="id-sb'+(cv.behind.includes(s)?' behind':'')+'" data-idgo="seg:'+esc(s.id)+'"><span>'+esc(mtSegShort(s.name))+'</span><span class="id-bt"><i style="width:'+Math.round((s.cov||0)*100)+'%"></i></span><b>'+mtPct(s.cov)+'</b></button>').join('')+'</div>'+
    (cv.behind.length?'<p class="id-bh">'+cv.behind.map(s=>'<b>'+esc(mtSegShort(s.name))+'</b> ligger bak snittet ('+mtPct(s.cov)+' mot '+mtPct(cv.ref)+'). '+(s.qualified-s.addressed)+' '+idPlural(s.qualified-s.addressed,'kvalifisert account er','kvalifiserte accounts er')+' fortsatt ikke adressert.').join(' ')+'</p>':'')+'<button type="button" class="btn" data-idgo="prosp">Åpne Prospekter</button></section>'; }
function idMndHTML(){
  const M=planningService.getMonth(), month=new Date().toLocaleDateString('nb-NO',{month:'long',year:'numeric'}), mt=month.charAt(0).toUpperCase()+month.slice(1);
  const head='<div class="id-wh"><h3>'+esc(mt)+'</h3></div>';
  if(M.status==='not_set') return head+'<section class="id-sec"><p class="idn-wp none">Det finnes ikke noe seksmånedersmål, så måneden har ikke noe mål. Når du setter ett, utledes månedsmålet automatisk.</p><button type="button" class="btn primary" data-idgo="maal">Sett seksmånedersmål</button></section>'+'<div class="id-grid"><div class="id-col">'+idCovHTML()+'</div></div>';
  if(!M.month) return head+'<section class="id-sec"><p class="idn-wp none">'+(M.status==='upcoming'?'Seksmånedersperioden starter '+esc(fd(M.period.start,{day:'numeric',month:'long',year:'numeric'}))+'. Denne måneden er ikke en del av perioden.':'Seksmånedersperioden er avsluttet.')+'</p><button type="button" class="btn" data-idgo="prognose">Åpne Mål og prognose</button></section>'+'<div class="id-grid"><div class="id-col">'+idCovHTML()+'</div></div>';
  const m=M.month, f=v=>idF(M,v), unit=M.type==='bookings'?'':'', line=(l,v,key,cls,small)=>'<div class="id-ml'+(cls?' '+cls:'')+'"><dt>'+l+'</dt><dd>'+idNum(key,esc(v))+(small?'<small>'+esc(small)+'</small>':'')+'</dd></div>';
  const need=m.gap>0?'<section class="id-sec"><h3>HVA MÅ TIL RESTEN AV MÅNEDEN?</h3><p>For å nå månedens plan mangler ca. <b>'+f(m.gap)+(M.type==='bookings'?' bookinger':'')+'</b> utover bekreftet og vektet pipeline. Baklengs fra det:</p><ul class="id-need">'+M.chain.steps.slice(1).map(s=>'<li><b>'+nf.format(s.n)+'</b> '+esc(s.label.toLowerCase())+(s.basis?' <em class="pl-b '+(s.basis.label==='Faktisk historikk'?'real':'assume')+'">'+esc(s.basis.label)+'</em>':'')+'</li>').join('')+'</ul><p class="id-note2">'+m.working_days_left+' arbeidsdager igjen i måneden. «Faktisk historikk» er regnet fra dine saker, «Oppstartsantakelse» brukes til historikken er stor nok.</p></section>':
    '<section class="id-sec"><h3>HVA MÅ TIL RESTEN AV MÅNEDEN?</h3><p>Bekreftet og vektet pipeline dekker månedens plan. Ingenting mangler ifølge modellen.</p></section>';
  const plan='<section class="id-sec"><h3>PLAN</h3><table class="pl-t"><thead><tr><th></th><th>Opprinnelig plan</th><th>Oppdatert plan</th><th>Faktisk</th></tr></thead><tbody><tr class="cur"><th scope="row">'+esc(mt)+'</th><td>'+f(m.original_plan)+'</td><td>'+f(m.current_plan)+'</td><td>'+f(m.actual)+'</td></tr></tbody></table><p class="id-note2">Oppdatert plan er faktisk så langt, pluss det som gjenstår av seksmånedersmålet fordelt på arbeidsdagene som er igjen. Opprinnelig plan endres aldri.</p><button type="button" class="btn ghost sm" data-idgo="prognose">Se hele seksmånedersplanen</button></section>';
  return head+'<div class="id-grid"><div class="id-col"><section class="id-sec id-mon"><div class="id-stat '+(m.pace==='nådd'||m.pace==='på sporet'?'ok':m.pace==='litt bak'?'warn':'bad')+'"><span class="id-sl">PACE</span><b>'+esc(({'nådd':'NÅDD','på sporet':'PÅ SPORET','litt bak':'LITT BAK','bak':'BAK PLAN'})[m.pace]||m.pace.toUpperCase())+'</b></div><dl class="id-mt">'+
    line('Månedsmål',f(m.current_plan),'m-goal','','utledet fra seksmånedersmålet')+line('Bekreftet',f(m.actual),'m-conf','','')+line('Vektet pipeline',f(m.weighted_pipeline),'m-wtd','','åpne saker med avgjørelse i måneden')+line('Forventet',f(m.expected),'m-exp','strong','bekreftet + vektet pipeline')+line(m.gap>0?'Gap':'Over plan',m.gap>0?f(m.gap):f(Math.max(0,m.expected-m.current_plan)),'m-gap',m.gap>0?'warn':'ok','')+'</dl></section>'+need+plan+'</div><div class="id-col">'+idCovHTML()+(M.activity_warning?'<p class="pl-warn" role="status">'+esc(M.activity_warning)+'</p>':'')+idRecHTML('FOKUS DENNE MÅNEDEN',idMonthRec2(M),'')+'</div></div>'; }

const _idnWire=V.idag.wire; V.idag.wire=function(v){ _idnWire.apply(this,arguments); const d=v.querySelector('.idn-rest'); if(d) d.addEventListener('toggle',e=>{ UI.id.restOpen=e.target.open; }); };

/* anbefaling for måneden: kort, med konkret grunnlag fra planen */
function idMonthRec2(M){ if(!M||!M.month) return null; const m=M.month, f=v=>idF(M,v);
  if(m.gap<=0) return {t:'Måneden er dekket av bekreftet og vektet pipeline. Hold tempoet og følg opp åpne tilbud.',why:['Forventet '+f(m.expected)+' mot plan '+f(m.current_plan)+'.','Pace: '+m.pace+'.']};
  const w=m.weighted_pipeline;
  if(w<m.gap) return {t:'Pipelinen dekker ikke gapet. Prioriter nye dialoger og tilbud.',why:['Vektet pipeline i måneden er '+f(w)+', og gapet til månedens plan er '+f(m.gap)+'.','Forventet '+f(m.expected)+' mot plan '+f(m.current_plan)+'.']};
  return {t:'Pipelinen er stor nok, men ikke avgjort ennå. Følg opp åpne tilbud fremfor å starte mer top-of-funnel.',why:['Vektet pipeline '+f(w)+' mot gap '+f(m.gap)+'.']}; }
