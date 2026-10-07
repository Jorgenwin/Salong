/* ---------- PlanningService: ett seksmånedersmål, alt annet utledes ----------
   Eneste kilde: goal6 = {type:'value'|'bookings', target, original_target, period_start, period_end, original_plan, revisions, weights}.
   Måned, uke og dag er utledet. Det finnes ingen egne mål for dag, uke eller måned.
   - remaining_goal = target − bekreftet så langt i perioden
   - fordeling: jevnt per gjenværende arbeidsdag (norske helligdager er fri) inntil sesongvekter er godkjent
   - original_plan er frozen ved opprettelse. Historiske mål endres aldri. Endres målet, settes bare current_target, og planen regnes på nytt.
   - oppdatert plan = faktisk for måneder som er over, og faktisk + resterende fordeling for måneden vi er i og framover
   - baklengs kjede (verdi → avtaler → tilbud → dialoger → adresserte accounts) merkes «Faktisk historikk» eller «Oppstartsantakelse»
   Ingenting her fylles med eksempeldata: uten mål viser tjenesten `not_set`. */
const pl={
  iso:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
  at:s=>new Date(s+'T12:00:00'),
  add:(s,n)=>{ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return pl.iso(d); },
  today:()=>pl.iso(new Date()) };
const _plHol={};
function plHolidays(y){ if(_plHol[y]) return _plHol[y];
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  const E=pl.iso(new Date(y,mo-1,da,12)), S0=new Set([y+'-01-01',y+'-05-01',y+'-05-17',y+'-12-25',y+'-12-26',pl.add(E,-3),pl.add(E,-2),pl.add(E,1),pl.add(E,39),pl.add(E,50)]);
  return _plHol[y]=S0; }
function plIsWork(s){ const d=pl.at(s), w=d.getDay(); return w!==0&&w!==6&&!plHolidays(d.getFullYear()).has(s); }
function plWorkdays(a,b){ const out=[]; for(let s=a;s<=b;s=pl.add(s,1)) if(plIsWork(s)) out.push(s); return out; }
const plMonthOf=s=>s.slice(0,7);
const plMonthLabel=m=>new Date(m+'-15T12:00:00').toLocaleDateString('nb-NO',{month:'long',year:'numeric'});
const plFmtVal=(g,v)=>g.type==='bookings'?Math.round(v)+' '+(Math.round(v)===1?'booking':'bookinger'):short(Math.round(v));
function plWeights(g){ const w=g.weights; return (w&&w.approved&&w.months)?w.months:null; }
/* vekt per arbeidsdag: jevn, eller godkjent månedsvekt delt på månedens arbeidsdager */
function plDayWeights(g,days){ const W=plWeights(g); if(!W) return days.map(()=>1);
  const cnt={}; for(const s of plWorkdays(g.period_start,g.period_end)) cnt[plMonthOf(s)]=(cnt[plMonthOf(s)]||0)+1;
  return days.map(s=>(Number(W[plMonthOf(s)])||0)/Math.max(1,cnt[plMonthOf(s)]||1)); }
function plBuildOriginal(g){ const days=plWorkdays(g.period_start,g.period_end), w=plDayWeights(g,days), tot=w.reduce((a,b)=>a+b,0)||1, out={};
  days.forEach((s,i)=>{ const m=plMonthOf(s); out[m]=(out[m]||0)+g.target*w[i]/tot; }); for(const m of Object.keys(out)) out[m]=Math.round(out[m]*100)/100; return out; }

/* bekreftet i perioden (samme grunnlag som Mål og prognose: bare brukerregistrerte saker) */
function plConfirmed(g,a,b){ const A=new Date(a+'T00:00:00'), B=new Date(pl.add(b,1)+'T00:00:00');
  const L=dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt&&d.stage==='bekreftet').filter(d=>{ const t=g3At(d); return t>=A&&t<B; });
  return {n:L.length,v:L.reduce((s,d)=>s+dval(d),0)}; }
function plPipeline(a,b){ const lead=g3Set().lead, A=new Date(a+'T00:00:00'), B=new Date(pl.add(b,1)+'T00:00:00');
  return dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt&&OPEN.includes(d.stage)).filter(d=>{ const t=g3Decide(d,lead); return t>=A&&t<B; }).reduce((s,d)=>({n:s.n+ST[d.stage].p,v:s.v+dval(d)*ST[d.stage].p}),{n:0,v:0}); }
const plVal=(g,x)=>g.type==='bookings'?x.n:x.v;

function plAvg(){ const won=dealsOp().filter(d=>S.orgs[d.orgId]&&d.stage==='bekreftet'), y1=new Date(Date.now()-365*864e5), wy=won.filter(d=>g3At(d)>=y1);
  return wy.length>=3?{v:wy.reduce((s,d)=>s+dval(d),0)/wy.length,real:true,n:wy.length}:{v:Number(S.settings.avgOrder)||25000,real:false,n:wy.length}; }
/* nytilførsel ved dagens fart (samme modell som Basis i Mål og prognose): nye saker per uke × tid igjen × treffprosent */
function plFlow(g,today,B){ const A=g3Set(), d90=new Date(Date.now()-90*864e5), fn=UI.fn||{c2:50,c3:40}, np=dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt&&new Date(d.createdAt||0)>=d90).length/(90/7);
  const remW=Math.max(0,(pl.at(B)-pl.at(today))/(7*864e5)), elig=Math.max(0,remW-A.lag), win=Math.min(1,(fn.c2/100)*(fn.c3/100)); const n=np*elig*win; return g.type==='bookings'?n:n*plAvg().v; }
/* baklengs kjede fra gjenstående verdi til aktivitet */
function plChain(g,need){
  const ar=actualRates(), st=(typeof mtStats==='function')?mtStats():null, fn=UI.fn||{c1:25,c2:50,c3:40};
  const avg=plAvg();
  const c3=ar.c3!=null&&ar.n>=10?{v:ar.c3,real:true,n:ar.n}:{v:fn.c3/100,real:false,n:ar.n};
  const c2=ar.c2!=null&&ar.n>=10?{v:ar.c2,real:true,n:ar.n}:{v:fn.c2/100,real:false,n:ar.n};
  const c1=st&&st.addressed>=10?{v:Math.max(.01,st.engaged/st.addressed),real:true,n:st.addressed}:{v:fn.c1/100,real:false,n:st?st.addressed:0};
  const agreements=g.type==='bookings'?need:need/Math.max(1,avg.v), offers=agreements/Math.max(.05,c3.v), dialogs=offers/Math.max(.05,c2.v), addressed=dialogs/Math.max(.01,c1.v);
  const lab=x=>x.real?'Faktisk historikk':'Oppstartsantakelse';
  return {need,steps:[{k:'value',label:g.type==='bookings'?'Bookinger':'Verdi',n:need,basis:null},
    {k:'agreements',label:'Avtaler',n:Math.ceil(agreements-1e-9),basis:g.type==='bookings'?null:{label:lab(avg),detail:'snittverdi '+short(Math.round(avg.v)),n:avg.n}},
    {k:'offers',label:'Tilbud',n:Math.ceil(offers-1e-9),basis:{label:lab(c3),detail:Math.round(c3.v*100)+' % av tilbud blir avtale',n:c3.n}},
    {k:'dialogs',label:'Dialoger',n:Math.ceil(dialogs-1e-9),basis:{label:lab(c2),detail:Math.round(c2.v*100)+' % av dialoger blir tilbud',n:c2.n}},
    {k:'addressed',label:'Adresserte accounts',n:Math.ceil(addressed-1e-9),basis:{label:lab(c1),detail:Math.round(c1.v*100)+' % av adresserte havner i dialog',n:c1.n}}]}; }
/* siste fire ukers nivå: nye accounts adressert per arbeidsdag */
function plRecentAddressRate(){ if(typeof mtAll!=='function'||typeof idFirstOut!=='function') return null; const fo=idFirstOut(), t=pl.today(), a=pl.add(t,-28); let n=0;
  for(const x of mtAll()){ if(x.kind!=='ny'||!x.flags.qualified||!fo[x.id]) continue; const d=String(fo[x.id]).slice(0,10); if(d>=a&&d<=t) n++; }
  const wd=plWorkdays(a,t).length||1; return {n,per_day:n/wd,work_days:wd}; }

const planningService={
  /* uten mål: ingenting gjettes. Et eksisterende årsmål foreslås bare, og tas først i bruk når brukeren bekrefter. */
  getCurrent(){
    const g=goalRepository.getCurrent(); if(g) return {status:'active',goal:g};
    const y=Number((S.settings||{}).goalValue)||0;
    return {status:'not_set',goal:null,suggestion:y>0?{type:'value',target:Math.round(y/2),basis:'Halvparten av årsmålet ('+short(y)+'). Bekreft eller endre.',period_start:planningService.defaultPeriod().start,period_end:planningService.defaultPeriod().end}:null}; },
  defaultPeriod(){ const n=new Date(), y=n.getFullYear(), m=n.getMonth(); const a=m>=10?new Date(y,10,1):m>=4?new Date(y,10,1):new Date(y-1,10,1); const b=new Date(a.getFullYear()+1,3,30); return {start:pl.iso(a),end:pl.iso(b)}; },
  async update(p){
    p=p||{}; const cur=goalRepository.getCurrent(), who=me.name||'', now=iso(new Date());
    const type=p.type||(cur&&cur.type)||'value', target=Number(p.target!=null?p.target:cur&&cur.target), ps=p.period_start||(cur&&cur.period_start), pe=p.period_end||(cur&&cur.period_end);
    if(!(target>0)) return fail('invalid_target','Målet må være større enn null.'); if(!ps||!pe||ps>=pe) return fail('invalid_period','Perioden må ha en start før slutt.');
    if(!['value','bookings'].includes(type)) return fail('invalid_type','Målet må være verdi eller antall bookinger.');
    let g;
    if(!cur){ g={id:uid('goal'),type,target,original_target:target,period_start:ps,period_end:pe,created_at:now,created_by:who,revisions:[],weights:{approved:false,months:null}}; g.original_plan=plBuildOriginal(g); }
    else { g={...cur,type,target,period_start:ps,period_end:pe,revisions:[...(cur.revisions||[])]};
      if(target!==cur.target||ps!==cur.period_start||pe!==cur.period_end||type!==cur.type) g.revisions.push({at:now,by:who,from:{target:cur.target,period_start:cur.period_start,period_end:cur.period_end,type:cur.type},to:{target,period_start:ps,period_end:pe,type},reason:String(p.reason||'').trim()});
      if(p.weights!==undefined) g.weights=p.weights; }
    g.current_target=g.target; g.updated_at=now; g.updated_by=who;
    const r=await goalRepository.save(g); bus.emit('goal_updated',{goal_id:g.id,target:g.target,original_target:g.original_target});
    return ok({goal:g,saved:r!==false}); },
  /* hele planen, utledet. Alt UI leser herfra. */
  getPlan(opt){
    opt=opt||{}; const cur=planningService.getCurrent(); if(cur.status==='not_set') return {status:'not_set',goal:null,suggestion:cur.suggestion||null};
    const g=cur.goal, today=opt.today||pl.today(), A=g.period_start, B=g.period_end;
    const allDays=plWorkdays(A,B), rem=allDays.filter(s=>s>=today), dw=plDayWeights(g,allDays), W={}; allDays.forEach((s,i)=>W[s]=dw[i]);
    const confirmed=plConfirmed(g,A,today<B?today:B), actual=plVal(g,confirmed), remaining=Math.max(0,g.target-actual);
    const wRem=rem.reduce((s,d)=>s+W[d],0), perDay=wRem>0?remaining/wRem:0, status=today<A?'upcoming':today>B?'ended':'active';
    const months=[]; const mKeys=[...new Set(allDays.map(plMonthOf))];
    for(const m of mKeys){ const md=allDays.filter(s=>plMonthOf(s)===m), ma=md[0], mb=md[md.length-1], past=mb<today, cur_=!past&&ma<=today, left=md.filter(s=>s>=today);
      const act=plVal(g,plConfirmed(g,ma,mb<today?mb:(today<ma?pl.add(ma,-1):today))), wk=left.reduce((s,d)=>s+W[d],0);
      const plan=past?act:act+perDay*wk, pipe=past?0:plVal(g,plPipeline(left[0]||ma,mb)), expected=past?act:act+pipe;
      const gap=past?Math.max(0,(g.original_plan[m]||0)-act):Math.max(0,plan-expected);
      months.push({month:m,label:plMonthLabel(m),working_days:md.length,working_days_left:left.length,original_plan:g.original_plan[m]||0,current_plan:plan,actual:act,weighted_pipeline:pipe,expected,gap,
        is_past:past,is_current:cur_,pace:past?(act>=(g.original_plan[m]||0)?'nådd':'under'):paceOf(plan,expected,act)}); }
    function paceOf(plan,exp,act){ if(plan<=0) return 'nådd'; const r=exp/plan; return act>=plan?'nådd':r>=1?'på sporet':r>=.85?'litt bak':'bak'; }
    /* uke */
    const t0=pl.at(today), wd=(t0.getDay()+6)%7, ws=pl.add(today,-wd), we=pl.add(ws,6), wkDays=plWorkdays(ws,we).filter(s=>s>=A&&s<=B), wkLeft=wkDays.filter(s=>s>=today);
    const wkActual=plVal(g,plConfirmed(g,ws>A?ws:A,we<B?(today<we?today:we):B)), wkPlanned=wkActual+perDay*wkLeft.reduce((s,d)=>s+(W[d]||0),0);
    /* prognose for perioden */
    const pipe=plVal(g,plPipeline(today>A?today:A,B)), flow=status==='ended'?0:plFlow(g,today>A?today:A,B), expected=actual+pipe, atPace=expected+flow, ratio=g.target?atPace/g.target:0;
    const pace=actual>=g.target?'nådd':status==='upcoming'?'ikke startet':ratio>=1?'på sporet':ratio>=.85?'litt bak':'bak';
    const chain=plChain(g,Math.max(0,remaining-pipe)), nRem=rem.length||1, perDayAddr=chain.steps[4].n/nRem, recent=plRecentAddressRate();
    let warning=null; if(remaining>pipe&&rem.length){ const need=Math.ceil(perDayAddr);
      if(recent&&recent.per_day>0&&perDayAddr>recent.per_day*1.5) warning='Ved dagens konvertering krever planen ca. '+need+' nye kontakter per dag, som er betydelig over siste fire ukers nivå ('+(Math.round(recent.per_day*10)/10).toString().replace('.',',')+' per dag).';
      else if(recent&&recent.per_day===0&&need>=1) warning='Ved dagens konvertering krever planen ca. '+need+' nye kontakter per dag. Siste fire uker er det ikke adressert nye accounts, så det finnes ikke noe nivå å sammenligne med.';
      else if(!recent) warning=null; }
    return {status,goal:g,as_of:today,period:{start:A,end:B,working_days_total:allDays.length,working_days_left:rem.length},target:g.target,original_target:g.original_target,type:g.type,
      actual,remaining_goal:remaining,per_working_day:perDay,progress:g.target?Math.min(1,actual/g.target):0,months,
      week:{start:ws,end:we,working_days_left:wkLeft.length,actual:wkActual,planned:wkPlanned},day:{planned:rem.length&&W[today]!=null?perDay*W[today]:0,is_workday:plIsWork(today)},
      forecast:{weighted_pipeline:pipe,expected,flow,at_pace:atPace,gap:Math.max(0,g.target-atPace),pace},chain,activity_warning:warning,recent_address_rate:recent,
      seasonal:{approved:!!plWeights(g),note:plWeights(g)?'Godkjente sesongvekter brukes.':'Jevn fordeling per arbeidsdag. Sesongvekter er ikke godkjent.'},
      revisions:g.revisions||[],fmt:v=>plFmtVal(g,v)}; },
  /* inneværende måned med baklengs kjede for månedens gap */
  getMonth(opt){ const P=planningService.getPlan(opt); if(P.status==='not_set') return P; const m=P.months.find(x=>x.is_current)||null; if(!m) return {status:P.status,period:P.period,goal:P.goal,target:P.target,fmt:P.fmt,month:null};
    const need=m.gap, chain=plChain(P.goal,need); return {status:P.status,goal:P.goal,period:P.period,month:m,chain,fmt:P.fmt,type:P.type,forecast:P.forecast,activity_warning:P.activity_warning}; },
  /* mål for en vilkårlig periode utledet fra seksmånedersmålet (brukes av Mål og prognose). null uten mål. */
  goalFor(a,b){ const P=planningService.getPlan(); if(P.status==='not_set') return null; const A=pl.iso(a), B=pl.iso(new Date(b.getTime()-864e5)), all=plWorkdays(P.period.start,P.period.end); let v=0;
    for(const m of P.months){ const md=all.filter(s=>plMonthOf(s)===m.month), inR=md.filter(s=>s>=A&&s<=B).length; if(inR&&md.length) v+=m.current_plan*inR/md.length; }
    return Math.round(v); } };
