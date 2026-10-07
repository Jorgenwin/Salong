/* ---------- Batch-utvalg: hvem er tilgjengelig, og hvorfor er de andre utelatt ----------
   Én regel per årsak, første treff vinner. Modalen viser alltid regnestykket, slik at «0 tilgjengelige» aldri er en gåte.
   Tilgjengelig = kvalifisert, ikke ferdig adressert, ikke i en aktiv batch, ikke diskvalifisert, ikke ikke-kontakt og ikke eksisterende kunde. */
const ELIG_ORDER=[['existing','er eksisterende kunde eller tidligere leietaker'],['dq','er diskvalifisert'],['dnc','er satt til ikke kontakt'],['done','er markert ferdig vurdert'],
  ['batch','ligger allerede i en aktiv batch'],['addressed','er allerede adressert'],['unqual','mangler kvalifisering']];
function mtEligReason(a,busy){
  if(a.kind!=='ny') return {k:'existing'};
  if(a.flags.disqualified) return {k:'dq'};
  if(a.dncAcc) return {k:'dnc'};
  if(a.stage==='completed'||(a.doc&&a.doc.done)) return {k:'done'};
  if(busy.has(a.id)) return {k:'batch',batch:busy.get(a.id)};
  if(a.flags.addressed) return {k:'addressed'};
  if(!a.flags.qualified) return {k:'unqual',fails:a.qual.fails.map(f=>f.k)};
  return null;
}
function mtBusyMap(){ const m=new Map(); for(const b of mtBuild().batches) if(b.status!=='ferdig') for(const id of b.accIds||[]) m.set(id,b.name); return m; }
const ELIG_FAIL={id:'mangler domene eller org.nr.',ev:'mangler eventsignal',seg:'segmentet er ikke aktivt'};
const ELIG_ROOM={'Solstad':4,'Flere muligheter':3,'Mellomstore rom':2,'Små rom':1,'Ukjent':0};
const ELIG_EV={Confirmed:2,Likely:1,Unknown:0};
const ELIG_SORT=[['fit','Fit (høyest først)'],['ev','Eventsignal (dokumentert først)'],['room','Romfit (Solstad først)']];
function mtEligibility(o){
  o=o||{}; const segs=o.segIds&&o.segIds.length?new Set(o.segIds):null, busy=mtBusyMap(), all=mtAll();
  const inScope=a=>(!segs||segs.has(a.segId))&&(!o.wave||a.wave===o.wave);
  const scope=all.filter(inScope), pool=[], ex={}; for(const [k] of ELIG_ORDER) ex[k]=[];
  for(const a of scope){ const r=mtEligReason(a,busy); if(!r) pool.push(a); else ex[r.k].push({a,...r}); }
  const s={fit:(x,y)=>y.fit.total-x.fit.total,ev:(x,y)=>ELIG_EV[y.ev.level]-ELIG_EV[x.ev.level]||y.fit.total-x.fit.total,room:(x,y)=>(ELIG_ROOM[y.room.value]||0)-(ELIG_ROOM[x.room.value]||0)||y.fit.total-x.fit.total}[o.sort||'fit']||((x,y)=>y.fit.total-x.fit.total);
  pool.sort((x,y)=>s(x,y)||x.name.localeCompare(y.name,'nb'));
  const fails={}; for(const e of ex.unqual) for(const f of e.fails) fails[f]=(fails[f]||0)+1;
  const batches={}; for(const e of ex.batch) batches[e.batch]=(batches[e.batch]||0)+1;
  return {pool,ex,scope:scope.length,outside:all.length-scope.length,fails,batches}; }
function mtPick(o){
  const E=mtEligibility(o), n=Math.max(1,Number(o&&o.n)||25);
  return {rows:E.pool.slice(0,n),available:E.pool.length,requested:n,explain:E}; }
/* forklaring i klartekst: samme tall som listen under */
function mtEligHTML(E,open){
  const rows=[]; const li=(cls,n,txt,det)=>'<li class="'+cls+'"><b>'+n+'</b> '+txt+(det||'')+'</li>';
  const names=L=>'<details class="el-d"><summary>Vis</summary><p>'+L.slice(0,24).map(x=>esc(x.a.name)).join(', ')+(L.length>24?' og '+(L.length-24)+' til':'')+'</p></details>';
  rows.push(li('ok',E.pool.length,E.pool.length===1?'tilgjengelig':'tilgjengelige'));
  for(const [k,txt] of ELIG_ORDER){ const L=E.ex[k]; if(!L.length) continue;
    let t=txt, det='';
    if(k==='batch'){ const parts=Object.entries(E.batches).map(([b,n])=>n+' i '+esc(b)); t='ligger allerede i en aktiv batch ('+parts.join(', ')+')'; }
    if(k==='unqual'){ const parts=Object.entries(E.fails).map(([f,n])=>n+' '+(ELIG_FAIL[f]||f)); t='mangler kvalifisering ('+parts.join(', ')+')'; }
    if(k==='existing') t='er eksisterende kunder eller tidligere leietakere og hører ikke til nye batcher';
    rows.push(li('',L.length,t,L.length<=24||k!=='addressed'?names(L):names(L))); }
  return '<div class="el"><p class="el-h"><b>'+E.scope+'</b> accounts i utvalget'+(E.outside?' <span>· '+E.outside+' utenfor utvalget</span>':'')+'</p><ul>'+rows.join('')+'</ul></div>'; }
function mtBatchSegIds(m){ const c=mtCfg(); if(m.seg==='all'||String(m.seg).startsWith('rw:')) return []; if(/^p[012]$/.test(m.seg)) return c.segs.filter(s=>s.on&&s.prio===m.seg.toUpperCase()).map(s=>s.id); if(m.seg.startsWith('wave:')){ const w=c.waves.find(x=>x.id===m.seg.slice(5)); return w?w.segs:[]; } return [m.seg]; }
const mtBatchWave=m=>String(m.seg).startsWith('rw:')?String(m.seg).slice(3):'';
const mtBatchQuery=m=>({segIds:mtBatchSegIds(m),wave:mtBatchWave(m),n:m.n,sort:m.sort||'fit'});
function mtResearchWaves(){ const c={}; for(const a of mtAll()) if(a.wave&&a.kind==='ny') c[a.wave]=(c[a.wave]||0)+1; return Object.entries(c).sort(); }
function mtMBatch(m){
  const c=mtCfg(), P=mtPick(mtBatchQuery(m)), chosen=P.rows.filter(a=>!m.off.has(a.id)), W=mtResearchWaves();
  const segLabel=m.seg==='all'?'alle segmenter':/^p[012]$/.test(m.seg)?'alle '+m.seg.toUpperCase():m.seg.startsWith('rw:')?'Wave '+m.seg.slice(3).replace(/^w/i,''):m.seg.startsWith('wave:')?(c.waves.find(w=>w.id===m.seg.slice(5))||{}).name:mtSegShort(mtSegName(m.seg));
  const auto='Batch '+(mtBuild().batches.length+1)+' · '+segLabel+' · '+chosen.length;
  const sel=(k,opts,v)=>'<select class="in" data-mtb="'+k+'">'+opts+'</select>';
  const body='<div class="mt-bf">'+mtFld('Segment','<select class="in" data-mtb="seg"><optgroup label="Prioritet"><option value="p0"'+(m.seg==='p0'?' selected':'')+'>Alle P0</option><option value="p1"'+(m.seg==='p1'?' selected':'')+'>Alle P1</option><option value="p2"'+(m.seg==='p2'?' selected':'')+'>Alle P2</option><option value="all"'+(m.seg==='all'?' selected':'')+'>Alle segmenter</option></optgroup>'+
      (W.length?'<optgroup label="Wave">'+W.map(([w,n])=>'<option value="rw:'+esc(w)+'"'+(m.seg==='rw:'+w?' selected':'')+'>Wave '+esc(String(w).replace(/^w/i,''))+' ('+n+' accounts)</option>').join('')+'</optgroup>':'')+
      '<optgroup label="Segmenter">'+c.segs.filter(s=>s.on).map(s=>'<option value="'+esc(s.id)+'"'+(m.seg===s.id?' selected':'')+'>'+esc(mtSegShort(s.name))+' ('+s.prio+')</option>').join('')+'</optgroup></select>')+
    mtFld('Antall','<select class="in" data-mtb="n">'+[...new Set([5,10,15,20,25,30,40,50,m.n])].sort((x,y)=>x-y).map(n=>'<option value="'+n+'"'+(m.n===n?' selected':'')+'>'+n+'</option>').join('')+'</select>')+
    mtFld('Ansvarlig','<select class="in" data-mtb="owner">'+ownOpts(m.owner)+'</select>')+
    mtFld('Sortering','<select class="in" data-mtb="sort">'+ELIG_SORT.map(([k,n])=>'<option value="'+k+'"'+((m.sort||'fit')===k?' selected':'')+'>'+n+'</option>').join('')+'</select>')+'</div>'+
    mtEligHTML(P.explain)+
    (P.rows.length?'<div class="mt-bl"><label class="mt-bla"><input type="checkbox" data-mtball aria-label="Velg alle" '+(chosen.length===P.rows.length?'checked':'')+'> <span>Velg alle ('+P.rows.length+(P.available>P.rows.length?' av '+P.available:'')+')</span></label>'+P.rows.map(a=>'<label class="mt-blr"><input type="checkbox" data-mtbo="'+esc(a.id)+'" '+(m.off.has(a.id)?'':'checked')+' aria-label="Ta med '+esc(a.name)+'"><span class="mt-blo">'+esc(a.name)+'</span><span class="mt-blm">'+esc(mtSegLabel(a))+' · Fit '+a.fit.total+' · '+(a.ev.level==='Confirmed'?'Dokumentert event':a.ev.level==='Likely'?'Sannsynlig event':'Event ukjent')+(a.room.value!=='Ukjent'?' · '+esc(a.room.label||a.room.value):'')+'</span></label>').join('')+'</div>':
      '<div class="mt-empty"><p>Ingen accounts er tilgjengelige i dette utvalget. Tallene over viser hvorfor. Velg et annet segment, eller legg til flere accounts.</p></div>')+
    (P.rows.length?mtFld('Navn på batchen','<input class="in" data-mtb="name" value="'+esc(m.name)+'" placeholder="'+esc(auto)+'">',true):'');
  return mtShell('Start neste batch',body,'<span class="mt-bcount">'+chosen.length+' accounts valgt</span><button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mtbgo="1"'+(chosen.length?'':' disabled')+'>Start batch</button>'); }
function mtWBatch(root,m){
  root.querySelectorAll('[data-mtb]').forEach(i=>i.addEventListener('change',()=>{ const k=i.dataset.mtb; if(k==='n') m.n=Math.max(1,Math.min(200,Number(i.value)||25)); else if(k==='name'){ m.name=i.value; return; } else m[k]=i.value; if(k==='seg'||k==='n'||k==='sort') m.off=new Set(); mtOverlay(true); }));
  root.querySelectorAll('[data-mtbn]').forEach(b=>b.addEventListener('click',()=>{ m.n=Number(b.dataset.mtbn); m.off=new Set(); mtOverlay(true); }));
  root.querySelectorAll('[data-mtbo]').forEach(c=>c.addEventListener('change',()=>{ if(c.checked) m.off.delete(c.dataset.mtbo); else m.off.add(c.dataset.mtbo); mtOverlay(true); }));
  root.querySelector('[data-mtball]')?.addEventListener('change',e=>{ const P=mtPick(mtBatchQuery(m)); m.off=e.target.checked?new Set():new Set(P.rows.map(a=>a.id)); mtOverlay(true); });
  root.querySelector('[data-mtbgo]')?.addEventListener('click',async()=>{ const P=mtPick(mtBatchQuery(m)), ids=P.rows.filter(a=>!m.off.has(a.id)).map(a=>a.id); if(!ids.length) return;
    const w=m.seg.startsWith('wave:')?m.seg.slice(5):mtBatchWave(m); const id=await mtCreateBatch({name:(m.name||'').trim(),segIds:mtBatchSegIds(m),wave:w,ids,requested:m.n,ownerId:m.owner||null});
    UI.mt.tab='arb'; UI.mt.modal=null; mtOverlay(true); renderView(true); toast('Batch med '+ids.length+' accounts er opprettet. Ingen er enrollet.'); }); }
