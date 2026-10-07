/* ---------- kal3.js: Kalender = hva som skjer hvor og når ----------
   Faner: I dag, Uke, Måned, Kapasitet. De tre første viser bekreftede arrangementer, holdt av, daterte forespørsler og tilbud,
   befaringer og møter som er registrert, og sakfrister. Klikk åpner saken. Heatmapet over belegg ligger i Kapasitet,
   sammen med prospekter som passer ledig kapasitet. Kalenderen er ikke eier av prospektlisten: den åpner bare accounts.
   Salong har ikke feltet «hold utløper». Holdt-av vises derfor med arrangementsdato, ikke med utløpsdato. */
UI.cal3=UI.cal3||{tab:'idag',d:''};
const KAL_TABS=[['idag','I dag'],['uke','Uke'],['mnd','Måned'],['kap','Kapasitet']];
const KAL_KIND={event:'Arrangement',hold:'Holdt av',enq:'Forespørsel',offer:'Tilbud',visit:'Befaring',meet:'Møte',due:'Frist'};
const kalAdd=(s,n)=>{ const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d).slice(0,10); };
const kalMon=s=>{ const d=new Date(s+'T12:00:00'), w=(d.getDay()+6)%7; return kalAdd(s,-w); };
const kalToday=()=>iso(new Date()).slice(0,10);
function kalTime(s){ s=String(s||''); if(s.length<16||s.indexOf('T')<0) return ''; const d=new Date(s); if(isNaN(d)) return ''; const h=d.getHours(), m=d.getMinutes(); if((h===12&&m===0)||(h===0&&m===0)) return ''; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }
function kalItems(from,to){
  const out=[], inR=d=>d&&d>=from&&d<=to;
  for(const e of calEntries()){ if(e.example||!inR(e.date)) continue;
    const kind=e.stage==='bekreftet'?'event':e.stage==='holdt'?'hold':e.stage==='tilbud'?'offer':'enq';
    out.push({date:e.date,time:'',kind,title:e.title||'',org:e.label||'',room:e.room,owner:e.ownerId||null,status:(ST[e.stage]||{n:e.stage}).n,open:e.kind==='sak'?'deal:'+e.id:e.orgId?'org:'+e.orgId:''}); }
  for(const a of actsOp()){ if(a.done||a.derived||a.handover) continue; const when=String(a.due||'').slice(0,10), isV=a.type==='visning'||a.type==='meeting';
    let date=when; if(!date&&isV&&a.at&&String(a.at).slice(0,10)>=kalToday()) date=String(a.at).slice(0,10);
    if(!inR(date)) continue; if(!isV&&!(a.type==='task'&&a.dealId)) continue;
    const d=a.dealId?S.deals[a.dealId]:null, kind=a.type==='visning'?'visit':a.type==='meeting'?'meet':'due', org=a.orgId?orgName(a.orgId):'';
    out.push({date,time:kalTime(a.due||a.at),kind,title:a.text||'',org,room:d&&d.room||'',owner:a.ownerId||(d&&d.ownerId)||null,status:kind==='due'?'Frist':'Planlagt',open:a.dealId?'deal:'+a.dealId:a.orgId?'org:'+a.orgId:''}); }
  return out.sort((x,y)=>x.date.localeCompare(y.date)||(x.time||'99').localeCompare(y.time||'99')||x.org.localeCompare(y.org,'nb')); }
function kalRow(it){
  const bits=[it.org||it.title,it.room&&RM[it.room]?roomName(it.room):'',it.owner?ownName(it.owner):''].filter(Boolean);
  return '<button type="button" class="kl-i k-'+it.kind+'"'+(it.open?' data-klopen="'+esc(it.open)+'"':' disabled')+'><span class="kl-t">'+(it.time||'Hele dagen')+'</span><span class="kl-k">'+KAL_KIND[it.kind]+'</span><span class="kl-b">'+bits.map((b,i)=>i?'<span>'+esc(b)+'</span>':'<b>'+esc(b)+'</b>').join('')+'</span><em>'+esc(it.status)+'</em></button>'; }
const kalDayL=s=>fd(s,{weekday:'long',day:'numeric',month:'long'});
function kalNav(label,step){ return '<div class="kl-nav"><button type="button" class="btn ghost sm" data-klstep="-'+step+'" aria-label="Forrige">←</button><b>'+esc(label)+'</b><button type="button" class="btn ghost sm" data-klstep="'+step+'" aria-label="Neste">→</button><button type="button" class="btn ghost sm" data-kltoday="1">I dag</button></div>'; }
function kalIdag(){
  const d=UI.cal3.d||kalToday(), L=kalItems(d,d), nxt=L.length?[]:kalItems(kalAdd(d,1),kalAdd(d,30)).slice(0,4);
  return kalNav(kalDayL(d),1)+(L.length?'<div class="kl-l">'+L.map(kalRow).join('')+'</div>':'<div class="kl-e"><p>Ingenting registrert denne dagen.</p>'+(nxt.length?'<h3>Neste de kommende dagene</h3><div class="kl-l">'+nxt.map(it=>'<div class="kl-dh">'+esc(kalDayL(it.date))+'</div>'+kalRow(it)).join('')+'</div>':'<p class="mt-hint">Ingenting registrert de neste 30 dagene heller.</p>')+'</div>'); }
function kalUke(){
  const d=UI.cal3.d||kalToday(), m=kalMon(d), days=Array.from({length:7},(_,i)=>kalAdd(m,i)), L=kalItems(days[0],days[6]), td=kalToday();
  const wk=(()=>{ const x=new Date(m+'T12:00:00'), t=new Date(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())); t.setUTCDate(t.getUTCDate()+4-(t.getUTCDay()||7)); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/86400000+1)/7); })();
  return kalNav('Uke '+wk+' · '+fd(days[0],{day:'numeric',month:'short'})+' – '+fd(days[6],{day:'numeric',month:'short'}),7)+'<div class="kl-w">'+days.map(ds=>{ const X=L.filter(i=>i.date===ds); return '<section class="kl-d'+(ds===td?' now':'')+'"><h3>'+esc(fd(ds,{weekday:'short',day:'numeric'}))+'</h3>'+(X.length?X.map(kalRow).join(''):'<p class="kl-n">–</p>')+'</section>'; }).join('')+'</div>'; }
function kalMnd(){
  const d=UI.cal3.d||kalToday(), [y,mo]=d.split('-').map(Number), first=y+'-'+String(mo).padStart(2,'0')+'-01', last=iso(new Date(y,mo,0)).slice(0,10), start=kalMon(first), n=Math.ceil(((new Date(last+'T12:00:00')-new Date(start+'T12:00:00'))/86400000+1)/7)*7;
  const L=kalItems(start,kalAdd(start,n-1)), td=kalToday(), sel=UI.cal3.sel||'';
  const cell=i=>{ const ds=kalAdd(start,i), X=L.filter(x=>x.date===ds), out=ds.slice(0,7)!==first.slice(0,7);
    return '<button type="button" class="kl-c'+(out?' out':'')+(ds===td?' now':'')+(ds===sel?' sel':'')+'" data-klday="'+ds+'" aria-label="'+esc(kalDayL(ds)+': '+X.length+' oppføringer')+'"><span>'+Number(ds.slice(8))+'</span>'+X.slice(0,3).map(x=>'<i class="k-'+x.kind+'">'+esc((x.org||x.title).slice(0,16))+'</i>').join('')+(X.length>3?'<small>+'+(X.length-3)+'</small>':'')+'</button>'; };
  const SL=sel?L.filter(x=>x.date===sel):[];
  return kalNav(new Date(y,mo-1,1).toLocaleDateString('nb-NO',{month:'long',year:'numeric'}),31)+'<div class="kl-m"><div class="kl-mh">'+['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="kl-mg">'+Array.from({length:n},(_,i)=>cell(i)).join('')+'</div></div>'+
    (sel?'<section class="kl-sel"><h3>'+esc(kalDayL(sel))+'</h3>'+(SL.length?'<div class="kl-l">'+SL.map(kalRow).join('')+'</div>':'<p class="mt-hint">Ingenting registrert.</p>')+'</section>':''); }
/* kapasitet: eksisterende belegg-heatmap, pluss prospekter som passer rommet */
function kalProspects(room,ym){
  const small=(c3Cap(room)||[0,0])[1]<=60, want=room==='solstad'?['Solstad']:small?['Små rom']:['Mellomstore rom','Flere muligheter'], mon=Number(ym.slice(5));
  return mtAll().filter(a=>a.kind==='ny'&&a.flags.qualified&&!a.flags.disqualified&&!a.dncAcc&&want.includes(a.room.value)).map(a=>{ const sg=drwSignals(a), month=sg.all.some(x=>x.date&&Number(x.date.slice(5,7))===mon);
    return {a,s:a.fit.total+(month?10:0),why:(month?'Har hatt arrangement i '+C3_MON[mon-1]+'. ':'')+(a.room.label||a.room.value)+(a.room.basis?': '+String(a.room.basis).slice(0,110):'')}; }).sort((x,y)=>y.s-x.s).slice(0,5); }
function kalKap(base){
  const room=(UI.c3.sel&&UI.c3.sel.room)||'solstad', ym=(UI.c3.sel&&UI.c3.sel.ym)||'';
  if(UI.c3.mode!=='salg'||!ym) return base;
  const P=kalProspects(room,ym), block='<h3>Prospekter som passer</h3>'+(P.length?'<ol class="c3-who">'+P.map(({a,why})=>'<li><div><button type="button" class="lnk c3-nm" data-calacc="'+esc(a.id)+'">'+esc(a.name)+'</button><span class="c3-w">'+esc(why)+'</span></div></li>').join('')+'</ol><p class="mt-hint">Fra Prospekter. Listen eies der og endres ikke her.</p>':'<p class="meta">Ingen kvalifiserte prospekter med romfit for dette rommet ennå.</p>');
  return base.replace('<h3>Hvem passer</h3>',block+'<h3>Kunder og tidligere leietakere som passer</h3>'); }
{ const _h=V.kalender.html, _w=V.kalender.wire;
  V.kalender.html=function(){ const T=UI.cal3.tab, tabs='<div class="kl-tabs" role="tablist" aria-label="Kalender">'+KAL_TABS.map(([k,n])=>'<button type="button" role="tab" data-kltab="'+k+'" aria-selected="'+(T===k)+'">'+n+'</button>').join('')+'</div>';
    const body=T==='kap'?kalKap(_h.apply(this,arguments)):T==='uke'?kalUke():T==='mnd'?kalMnd():kalIdag();
    return '<div class="kl">'+tabs+'<div class="kl-body">'+body+'</div></div>'; };
  V.kalender.wire=function(v){ const rr=()=>{ const y=window.scrollY; renderView(true); window.scrollTo(0,y); };
    v.querySelectorAll('[data-kltab]').forEach(b=>b.addEventListener('click',()=>{ UI.cal3.tab=b.dataset.kltab; rr(); }));
    if(UI.cal3.tab==='kap'){ _w.apply(this,arguments); v.querySelectorAll('[data-calacc]').forEach(b=>b.addEventListener('click',()=>mtOpen(b.dataset.calacc))); return; }
    const T=UI.cal3.tab, d=UI.cal3.d||kalToday();
    v.querySelectorAll('[data-klstep]').forEach(b=>b.addEventListener('click',()=>{ const n=Number(b.dataset.klstep); if(T==='mnd'){ const [y,m]=d.split('-').map(Number); const x=new Date(y,m-1+(n>0?1:-1),1); UI.cal3.d=iso(x).slice(0,10); UI.cal3.sel=''; } else UI.cal3.d=kalAdd(d,n); rr(); }));
    v.querySelectorAll('[data-kltoday]').forEach(b=>b.addEventListener('click',()=>{ UI.cal3.d=''; UI.cal3.sel=''; rr(); }));
    v.querySelectorAll('[data-klday]').forEach(b=>b.addEventListener('click',()=>{ UI.cal3.sel=UI.cal3.sel===b.dataset.klday?'':b.dataset.klday; rr(); }));
    v.querySelectorAll('[data-klopen]').forEach(b=>b.addEventListener('click',()=>{ const v_=b.dataset.klopen, i=v_.indexOf(':'), k=v_.slice(0,i), id=v_.slice(i+1); if(k==='deal') openDrawer('deal',id); else openOrg(id); })); }; }
