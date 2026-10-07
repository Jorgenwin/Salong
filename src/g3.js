/* ---------- Mål og prognose ----------
   Horisont (måned, kvartal, halvår, år), fem hovedtall, tre scenarioer, «Hva må til?» baklengs, trend over tid.
   Alt er en prognose ut fra registrerte saker og aktivitet. Antakelsene kan justeres og er merket som antakelser. */
const G3_H=[['m','Måned','denne måneden',1],['q','Kvartal','dette kvartalet',3],['h','Halvår','dette halvåret',6],['y','År','i år',12]];
const G3_SC=[['forsiktig','Forsiktig','Lavere aktivitet og treffprosent',.8,.85],['basis','Basis','Dagens fart og treffprosent',1,1],['ambisios','Ambisiøs','Mer aktivitet og bedre treffprosent',1.3,1.15]];
UI.g3={h:'q',adj:false};
VIEWS.find(v=>v.k==='prognose').n='Mål og prognose';
const g3Set=()=>({lead:45,lag:6,...((S.settings&&S.settings.g3)||{})});
function g3Range(h){ const n=new Date(), y=n.getFullYear(), m=n.getMonth(); let a,b; if(h==='m'){ a=new Date(y,m,1); b=new Date(y,m+1,1); } else if(h==='q'){ const q=Math.floor(m/3)*3; a=new Date(y,q,1); b=new Date(y,q+3,1); } else if(h==='h'){ const q=m<6?0:6; a=new Date(y,q,1); b=new Date(y,q+6,1); } else { a=new Date(y,0,1); b=new Date(y+1,0,1); } return {a,b,months:G3_H.find(x=>x[0]===h)[3]}; }
function g3Label(h,R){ const n=R.a; return h==='m'?n.toLocaleDateString('nb-NO',{month:'long',year:'numeric'}):h==='q'?'kvartal '+(Math.floor(n.getMonth()/3)+1)+' '+n.getFullYear():h==='h'?(n.getMonth()<6?'1.':'2.')+' halvår '+n.getFullYear():'året '+n.getFullYear(); }
function g3Goal(h){ const R0=g3Range(h), dv=planningService.goalFor(R0.a,R0.b); if(dv!=null) return {v:dv,own:true,derived:true};
  const s=S.settings||{}, own=Number(((s.goals)||{})[h]); if(own>0) return {v:own,own:true}; const y=Number(s.goalValue)||0; return {v:Math.round(y*G3_H.find(x=>x[0]===h)[3]/12),own:false}; }
const g3At=d=>new Date(d.stageAt||d.createdAt||d.date||0);
/* forventet avgjørelse for en åpen sak: arrangementsdato minus ledetid, aldri før i dag. Uten dato: om 30 dager. */
function g3Decide(d,lead){ const now=new Date(); if(!d.date) return new Date(now.getTime()+30*864e5); const t=new Date(d.date+'T12:00:00').getTime()-lead*864e5; return new Date(Math.max(now.getTime(),t)); }
function g3Calc(h){
  h=h||UI.g3.h; const R=g3Range(h), now=new Date(), A=g3Set(), ds=dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt), goal=g3Goal(h), lbl=g3Label(h,R);
  const won=ds.filter(d=>d.stage==='bekreftet'), conf=won.filter(d=>{ const t=g3At(d); return t>=R.a&&t<R.b; }), confirmed=conf.reduce((a,d)=>a+dval(d),0);
  const open=ds.filter(d=>OPEN.includes(d.stage)), inH=open.filter(d=>g3Decide(d,A.lead)<R.b), weighted=inH.reduce((a,d)=>a+dval(d)*ST[d.stage].p,0), nNoDate=open.filter(d=>!d.date).length, outside=open.length-inH.length;
  const d90=new Date(now.getTime()-90*864e5), won90=won.filter(d=>g3At(d)>=d90), pace=won90.reduce((a,d)=>a+dval(d),0)/90;
  const y1=new Date(now.getTime()-365*864e5), wy=won.filter(d=>g3At(d)>=y1), avgVal=wy.length?wy.reduce((a,d)=>a+dval(d),0)/wy.length:(Number(S.settings.avgOrder)||25000);
  const newPerWeek=ds.filter(d=>new Date(d.createdAt||0)>=d90).length/(90/7), remW=Math.max(0,(R.b-now)/(7*864e5)), elig=Math.max(0,remW-A.lag);
  const c1=UI.fn.c1/100, c2=UI.fn.c2/100, c3=UI.fn.c3/100, winNew=c2*c3;
  const scen=G3_SC.map(([k,n,d,act,win])=>{ const flow=newPerWeek*elig*act*Math.min(1,winNew*win)*avgVal, est=confirmed+weighted*Math.min(1.25,win)+flow, gapv=Math.max(0,goal.v-est), ag=Math.ceil(gapv/Math.max(1,avgVal)), of=Math.ceil(ag/Math.max(.05,c3*Math.min(1.25,win))), di=Math.ceil(of/Math.max(.05,c2*Math.min(1.25,win)));
    return {k,n,d,act,win,est:Math.round(est),flow:Math.round(flow),pct:goal.v?est/goal.v:null,gapv:Math.round(gapv),ag,of,di,perWeek:Math.round(newPerWeek*act*10)/10}; });
  const base=scen[1], missing=Math.max(0,goal.v-confirmed-weighted), nAg=Math.ceil(missing/Math.max(1,avgVal)), nOf=Math.ceil(nAg/Math.max(.05,c3)), nDi=Math.ceil(nOf/Math.max(.05,c2)), nCo=Math.ceil(nDi/Math.max(.05,c1)), wk=Math.max(1,Math.round(remW));
  return {h,R,label:lbl,goal:goal.v,goalOwn:goal.own,confirmed,nConf:conf.length,weighted:Math.round(weighted),nOpen:inH.length,outside,nNoDate,expected:base.est,gap:goal.v-base.est,pace,avgVal:Math.round(avgVal),newPerWeek,remW,scen,
    miss:{v:Math.round(missing),ag:nAg,of:nOf,di:nDi,co:nCo,perWeek:Math.ceil(nCo/wk),weeks:wk},
    need:[{v:short(missing),l:'i verdi mangler utover bekreftet og vektet pipeline'},{v:String(nAg),l:nAg===1?'avtale til':'avtaler til'},{v:String(nOf),l:nOf===1?'tilbud til':'tilbud til'},{v:String(nDi),l:nDi===1?'dialog til':'dialoger til'},{v:String(nCo),l:'kontakter ('+Math.ceil(nCo/wk)+' per uke)'}]};
}
/* månedlig utvikling: bekreftet de siste seks månedene og vektet pipeline de seks neste */
function g3Trend(){ const now=new Date(), A=g3Set(), ds=dealsOp().filter(d=>S.orgs[d.orgId]&&!S.orgs[d.orgId].deletedAt), out=[];
  for(let i=-5;i<=6;i++){ const a=new Date(now.getFullYear(),now.getMonth()+i,1), b=new Date(now.getFullYear(),now.getMonth()+i+1,1), past=i<=0;
    const v=past?ds.filter(d=>d.stage==='bekreftet'&&g3At(d)>=a&&g3At(d)<b).reduce((s,d)=>s+dval(d),0):ds.filter(d=>OPEN.includes(d.stage)).filter(d=>{ const t=g3Decide(d,A.lead); return t>=a&&t<b; }).reduce((s,d)=>s+dval(d)*ST[d.stage].p,0);
    out.push({a,v:Math.round(v),past,cur:i===0}); }
  return out; }
function g3TrendSVG(T,mg){ const W=720,H=210,L=44,B=28,Tp=14,mx=Math.max(mg*1.25,...T.map(x=>x.v),1), bw=(W-L-8)/T.length, y=v=>Tp+(H-Tp-B)*(1-v/mx);
  const ticks=[0,.5,1].map(f=>mx*f), bars=T.map((x,i)=>{ const h=Math.max(1,(H-Tp-B)*x.v/mx), xx=L+i*bw+bw*.18, w=bw*.64, lab=x.a.toLocaleDateString('nb-NO',{month:'short'}).replace('.','');
    return '<g><rect x="'+xx.toFixed(1)+'" y="'+(H-B-h).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" class="'+(x.past?'g3-bp':'g3-bf')+(x.cur?' cur':'')+'"><title>'+esc(x.a.toLocaleDateString('nb-NO',{month:'long',year:'numeric'}))+': '+esc(kr(x.v))+(x.past?' bekreftet':' vektet pipeline')+'</title></rect><text x="'+(xx+w/2).toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle" class="g3-tx'+(x.cur?' cur':'')+'">'+esc(lab)+'</text></g>'; }).join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" class="g3-svg" role="img" aria-label="Bekreftet verdi per måned de siste seks månedene og vektet pipeline de seks neste, mot månedlig målnivå">'+ticks.map(t=>'<g><line x1="'+L+'" x2="'+(W-4)+'" y1="'+y(t).toFixed(1)+'" y2="'+y(t).toFixed(1)+'" class="g3-gl"/><text x="'+(L-6)+'" y="'+(y(t)+4).toFixed(1)+'" text-anchor="end" class="g3-tx">'+(t?esc(short(t)):'0')+'</text></g>').join('')+bars+
    (mg?'<line x1="'+L+'" x2="'+(W-4)+'" y1="'+y(mg).toFixed(1)+'" y2="'+y(mg).toFixed(1)+'" class="g3-goal"/><text x="'+(W-6)+'" y="'+(y(mg)-5).toFixed(1)+'" text-anchor="end" class="g3-tx goal">Målnivå per måned '+esc(short(mg))+'</text>':'')+'</svg>'; }

{ const _old=V.prognose.html, _ow=V.prognose.wire;
  VDESC.prognose='Hvor langt er vi fra målet, og hva må til for å komme dit.';
  V.prognose.html=function(){
    const K=UI.g3, G=g3Calc(K.h), A=g3Set(), ar=actualRates(), T=g3Trend(), mg=(()=>{ const R1=g3Range('m'), v1=planningService.goalFor(R1.a,R1.b); return v1!=null?v1:((Number(S.settings.goalValue)||0)/12)||0; })(), hasGoal=G.goal>0, gapPos=G.gap>0;
    const card=(t,v,s,c)=>'<div class="g3-card'+(c?' '+c:'')+'"><span class="g3-ct">'+t+'</span><b>'+v+'</b><small>'+s+'</small></div>';
    const barMax=Math.max(G.goal,G.confirmed+G.weighted,G.expected,1), w=v=>Math.min(100,v/barMax*100).toFixed(1);
    const pctOf=v=>hasGoal?Math.round(v/G.goal*100)+' % av målet':'';
    const head='<div class="g3-top"><div class="seg" role="group" aria-label="Horisont">'+G3_H.map(([k,n])=>'<button type="button" data-g3h="'+k+'" aria-pressed="'+(K.h===k)+'">'+n+'</button>').join('')+'</div><span class="g3-per">'+esc(G.label.charAt(0).toUpperCase()+G.label.slice(1))+' · '+Math.max(0,Math.round(G.remW))+' uker igjen</span></div>';
    const cards='<div class="g3-cards">'+card('Mål',hasGoal?short(G.goal):'Ikke satt',hasGoal?(G.goalOwn?'utledet fra seksmånedersmålet':'fra årsmålet '+short(Number(S.settings.goalValue)||0)):'Sett seksmånedersmål øverst på siden')+
      card('Bekreftet',short(G.confirmed),G.nConf+' '+(G.nConf===1?'avtale':'avtaler')+(hasGoal?' · '+pctOf(G.confirmed):''),'ok')+
      card('I pipeline (vektet)',short(G.weighted),G.nOpen+' åpne saker med forventet avgjørelse i perioden'+(G.outside?' · '+G.outside+' senere':''))+
      card('Forventet ved dagens fart',short(G.expected),(hasGoal?pctOf(G.expected)+' · ':'')+'bekreftet + pipeline + nye saker')+
      card('Gap til mål',hasGoal?(gapPos?short(G.gap):'Nådd'):'–',hasGoal?(gapPos?'mangler ved dagens fart':'+'+short(-G.gap)+' over mål'):'',hasGoal?(gapPos?'warn':'ok'):'')+'</div>';
    const prog=hasGoal?'<div class="g3-prog" role="img" aria-label="Bekreftet '+pctOf(G.confirmed)+', forventet '+pctOf(G.expected)+'"><div class="g3-pb"><i class="a" style="width:'+w(G.confirmed)+'%"></i><i class="b" style="left:'+w(G.confirmed)+'%;width:'+Math.max(0,Math.min(w(G.expected),100)-w(G.confirmed)).toFixed(1)+'%"></i><u style="left:'+w(G.goal)+'%" title="Mål"></u></div><div class="g3-pl"><span><i class="a"></i>Bekreftet</span><span><i class="b"></i>Forventet i tillegg</span><span><u></u>Mål</span></div></div>':'';
    const sc='<section class="g3-sec"><h3>Tre scenarioer</h3><p class="meta">Anslag, ikke løfter. Forsiktig og ambisiøs endrer aktivitet og treffprosent med faste faktorer.</p><div class="g3-scen">'+G.scen.map(s=>'<article class="g3-s'+(s.k==='basis'?' base':'')+'"><header><b>'+s.n+'</b><span>'+esc(s.d)+'</span></header><div class="g3-sv"><b>'+short(s.est)+'</b><span>estimert bookingverdi</span></div><dl>'+
      '<div><dt>Måloppnåelse</dt><dd>'+(s.pct==null?'–':Math.round(s.pct*100)+' %')+'</dd></div><div><dt>Aktivitetsnivå</dt><dd>'+Math.round(s.act*100)+' % av dagens ('+s.perWeek.toLocaleString('nb-NO')+' nye saker per uke)</dd></div>'+
      (hasGoal?(s.gapv>0?'<div><dt>Ekstra for å nå målet</dt><dd>'+s.di+' dialoger · '+s.of+' tilbud · '+s.ag+' avtaler</dd></div>':'<div><dt>Målet</dt><dd class="ok">Nås</dd></div>'):'')+'</dl></article>').join('')+'</div></section>';
    const m=G.miss, back='<section class="g3-sec"><h3>Hva må til?</h3>'+(hasGoal?(m.v>0?'<p class="g3-lead">Utover det som er bekreftet og ligger i pipeline mangler <b>'+short(m.v)+'</b>. Med snittverdi '+kr(G.avgVal)+' per avtale og dagens treffprosenter betyr det:</p><div class="g3-need">'+[[m.ag,m.ag===1?'avtale':'avtaler'],[m.of,'tilbud'],[m.di,m.di===1?'dialog':'dialoger'],[m.co,'kontakter'],[m.perWeek,'kontakter per uke de neste '+m.weeks+' ukene']].map(([v,l],i)=>'<div class="'+(i===4?'key':'')+'"><b>'+nf.format(v)+'</b><span>'+l+'</span></div>').join('')+'</div>':'<p class="g3-lead ok">Bekreftet og vektet pipeline dekker målet for perioden. Hold farten oppe og følg opp tilbudene.</p>'):'<p class="meta">Sett et mål for å se hva som må til.</p>')+
      '<p class="meta">Treffprosentene (kontakt til dialog '+UI.fn.c1+' %, dialog til tilbud '+UI.fn.c2+' %, tilbud til avtale '+UI.fn.c3+' %) er antakelser. Faktiske tall fra Salong ligger under «Juster antakelser».</p></section>';
    const tr='<section class="g3-sec"><h3>Utvikling over tid</h3><p class="meta">Seks måneder bakover: bekreftet verdi. Seks måneder framover: vektet pipeline etter forventet avgjørelse. Nye saker som ikke er opprettet ennå er ikke med i framoverstolpene.</p>'+g3TrendSVG(T,mg)+'<div class="g3-pl"><span><i class="a"></i>Bekreftet</span><span><i class="f"></i>Vektet pipeline</span>'+(mg?'<span><u></u>Målnivå per måned (årsmål ÷ 12)</span>':'')+'</div></section>';
    const adj='<details class="g3-adj" id="g3Adj"'+(K.adj?' open':'')+'><summary>Juster antakelser</summary><div class="g3-adj-b"><div class="g3-fields">'+
                  '<label class="f"><span>Ledetid før arrangement (dager)</span><input class="in" type="number" min="0" max="365" id="g3Lead" value="'+A.lead+'"></label>'+
      '<label class="f"><span>Tid fra ny sak til avtale (uker)</span><input class="in" type="number" min="1" max="52" id="g3Lag" value="'+A.lag+'"></label></div>'+
      '<p class="meta">Ledetid brukes til å anslå når en åpen sak avgjøres: arrangementsdato minus ledetid. Saker uten dato regnes som avgjort om 30 dager. Snittverdi per avtale ('+kr(G.avgVal)+') er gjennomsnittet av bekreftede saker siste 12 måneder.</p><div class="row"><button class="btn sm" type="button" id="g3Save">Lagre</button>'+(ar.c2!=null||ar.c3!=null?'<button class="btn ghost sm" type="button" id="useActual">Bruk faktiske treffprosenter ('+ar.n+' saker)</button>':'')+'</div>'+_old.call(this)+'</div></details>';
    return '<div class="g3w">'+head+plSectionHTML()+cards+prog+sc+back+tr+adj+'</div>';
  };
  V.prognose.wire=function(v){
    _ow.apply(this,arguments); const K=UI.g3; plWire(v);
    v.querySelectorAll('[data-g3h]').forEach(b=>b.addEventListener('click',()=>{ K.h=b.dataset.g3h; renderView(true); }));
    $('#g3Adj')?.addEventListener('toggle',e=>{ K.adj=e.target.open; });
    $('#g3Save')?.addEventListener('click',async()=>{ if(readOnly){ toast('Du har lesetilgang og kan ikke endre mål.'); return; }
      const num=id=>{ const x=$(id).value; return x===''?null:Math.max(0,Number(x)||0); };
      const lead=Math.min(365,num('#g3Lead')??45), lag=Math.max(1,Math.min(52,num('#g3Lag')??6));
      await settingsRepository.save({g3:{lead,lag}}); toast('Antakelsene er lagret.'); renderView(true); });
  };
}
