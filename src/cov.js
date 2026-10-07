/* ---------- cov.js: markedsdekning i Prospekter ----------
   Eier: funnel Identifisert → Bekreftet, segmenttabell og prioriteringsflaten for prospect-accounts.
   Regler:
   - ESTIMERT MARKED er et tall brukeren selv skriver inn (settings.mtest). Det finnes ingen standardtall og ingen oppdiktede antall.
   - IDENTIFISERT = verifiserte organisasjoner i Salong (med kilde). Estimat og identifisert blandes aldri.
   - Prioriteringsflaten bruker den eksisterende scoringen: X = eventfit (dokumentert event + romfit), Y = kommersielt potensial
     (segmentprioritet, størrelse, geografi, relasjon), boble = antall dokumenterte eventsignaler. Ingen ny score er funnet på. */
const COV_STAGES=[['discovered','Identifisert'],['qualified','Kvalifisert'],['enriched','Beriket'],['addressed','Adressert'],['engaged','Dialog'],['opportunity','Mulighet'],['confirmed','Bekreftet']];
const COV_STCOL={discovered:'#9aa59f',qualified:'#6f8f84',enriched:'#2f7d6a',addressed:'#a86e12',engaged:'#35598a',opportunity:'#654a8c',completed:'#56625c',disqualified:'#b0403a'};
const COV_STNAME={discovered:'Identifisert',qualified:'Kvalifisert',enriched:'Beriket',addressed:'Adressert',engaged:'Dialog',opportunity:'Mulighet'};
if(typeof UI!=='undefined'){ UI.cov=UI.cov||{seg:'',open:true}; }
const covEst=()=>(((S.settings||{}).mtest)||{});
async function covSetEst(id,val){ const cur={...covEst()}; if(val===''||val==null||isNaN(Number(val))) delete cur[id]; else cur[id]=Math.max(0,Math.round(Number(val))); return settingsRepository.save({mtest:cur}); }

function covFunnel(st){
  const on=k=>UI.mt.stat===k, max=Math.max(1,st.discovered);
  return '<div class="cv-fn" role="group" aria-label="Fra identifisert til bekreftet">'+COV_STAGES.map(([k,n],i)=>{
    const v=st[k]||0, prev=i?(st[COV_STAGES[i-1][0]]||0):0, sub=i?(prev?Math.round(v/prev*100)+' % av forrige':'–'):'verifiserte organisasjoner';
    return '<button type="button" class="cv-st'+(on(k)?' on':'')+'" data-mtstat="'+k+'" aria-pressed="'+on(k)+'"><span>'+n+'</span><b>'+v+'</b><i style="--w:'+Math.max(v?3:0,Math.round(v/max*100))+'%"></i><small>'+sub+'</small></button>'; }).join('')+'</div>'; }

function covSegTable(){
  const S_=mtSegStats(), est=covEst(), groups=[['P0','Første prioritet'],['P1','Neste'],['P2','Sist']];
  const row=s=>{ const e=est[s.id], has=e!=null&&e!=='', unk=has?Math.max(0,e-s.discovered):null, sel=UI.mt.seg===s.id;
    return '<tr class="cv-r'+(sel?' on':'')+(s.on===false?' off':'')+'" data-mtsegf="'+esc(s.id)+'" tabindex="0" aria-pressed="'+sel+'"><th scope="row"><b>'+esc(mtSegShort(s.name))+'</b></th>'+
      '<td class="n cv-e"><input class="in cv-ei" type="number" min="0" step="5" inputmode="numeric" data-cvest="'+esc(s.id)+'" value="'+(has?e:'')+'" placeholder="–" aria-label="Estimert marked for '+esc(mtSegShort(s.name))+' (ditt anslag)">'+(has&&unk?'<small>ukartlagt ca. '+unk+'</small>':'')+'</td>'+
      '<td class="n">'+s.discovered+'</td><td class="n">'+s.qualified+'</td><td class="n">'+s.enriched+'</td><td class="n">'+s.addressed+'</td><td class="n">'+s.engaged+'</td><td class="n">'+s.opportunity+'</td><td class="n cv-rm" title="Kvalifiserte accounts som ikke er adressert">'+s.remaining+'</td></tr>'; };
  const body=groups.map(([p,t])=>{ const L=S_.filter(s=>s.id&&s.prio===p); return L.length?'<tr class="cv-g"><th colspan="9">'+p+' <span>'+t+'</span></th></tr>'+L.map(row).join(''):''; }).join('')+(S_.filter(s=>!s.id&&s.discovered).map(s=>'<tr class="cv-r" data-mtsegf=""><th scope="row"><b>Uten segment</b></th><td class="n">–</td><td class="n">'+s.discovered+'</td><td class="n">'+s.qualified+'</td><td class="n">'+s.enriched+'</td><td class="n">'+s.addressed+'</td><td class="n">'+s.engaged+'</td><td class="n">'+s.opportunity+'</td><td class="n">'+s.remaining+'</td></tr>').join(''));
  return '<section class="mt-sec"><div class="mt-sh"><h3>Dekning per segment</h3><span class="mt-hint">Klikk et segment for å filtrere listen.</span></div><div class="tbl cv-tw"><table class="cv-t"><thead><tr><th>Segment</th><th class="n" title="Ditt eget anslag over hvor mange relevante organisasjoner segmentet har. Ikke verifiserte organisasjoner.">Estimert marked*</th><th class="n">Identifisert</th><th class="n">Kvalifisert</th><th class="n">Beriket</th><th class="n">Adressert</th><th class="n">Dialog</th><th class="n">Muligheter</th><th class="n">Gjenstår</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
    '<p class="mt-hint cv-fn-note">*Estimert marked er et anslag du skriver inn selv, og er ikke verifiserte organisasjoner. Identifisert er organisasjoner med kilde i Salong.</p></section>'; }

/* ---------- prioriteringsflaten ---------- */
function covPts(){
  const hash=id=>{ let h=0; for(const c of id) h=(h*31+c.charCodeAt(0))>>>0; return h; };
  return mtAll().filter(a=>a.kind==='ny'&&!a.flags.disqualified&&!a.dncAcc&&(!UI.cov.seg||a.segId===UI.cov.seg)).map(a=>{
    const P={}; for(const x of a.fit.parts) P[x.k]=x.pts;
    const fitX=Math.round(((P.ev||0)+(P.room||0))/55*100), potY=Math.round(((P.seg||0)+(P.size||0)+(P.geo||0)+(P.rel||0))/45*100);
    const sig=((a.doc&&a.doc.evsig)||[]).length+(((a.enr&&a.enr.event_signals)||[]).length), j=((hash(a.id)%13)-6)*.55, k=((hash(a.id+'y')%13)-6)*.55;
    return {a,x:Math.max(0,Math.min(100,fitX+j)),y:Math.max(0,Math.min(100,potY+k)),fx:fitX,py:potY,sig}; }); }
function covChart(){
  const P=covPts(); const segs=mtCfg().segs.filter(s=>s.on!==false);
  const sel='<label class="f cv-sel"><span>Segment</span><select class="in" id="cvSeg"><option value="">Alle segmenter</option>'+segs.map(s=>'<option value="'+esc(s.id)+'"'+(UI.cov.seg===s.id?' selected':'')+'>'+esc(mtSegShort(s.name))+'</option>').join('')+'</select></label>';
  if(!P.length) return '<section class="mt-sec"><div class="mt-sh"><h3>Prioritering</h3></div><div class="es"><p>Ingen accounts å vise ennå.</p></div></section>';
  const W=760,H=330,L=44,R=14,T=14,B=40, X=v=>L+(W-L-R)*v/100, Y=v=>T+(H-T-B)*(1-v/100), rad=p=>5+Math.min(9,p.sig*1.5);
  const top=[...P].sort((a,b)=>(b.fx+b.py)-(a.fx+a.py)).slice(0,8).map(p=>p.a.id);
  const circ=[...P].sort((a,b)=>b.sig-a.sig).map(p=>{ const st=p.a.status||'discovered', tip=p.a.name+' · '+(COV_STNAME[st]||st)+' · eventfit '+p.fx+' · potensial '+p.py+' · '+p.sig+' eventsignal'+(p.sig===1?'':'er');
    return '<g class="cv-pt" tabindex="0" role="button" data-cvopen="'+esc(p.a.id)+'" aria-label="'+esc(tip)+'"><title>'+esc(tip)+'</title><circle cx="'+X(p.x).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="'+rad(p).toFixed(1)+'" fill="'+(COV_STCOL[st]||'#9aa59f')+'" fill-opacity=".72" stroke="var(--surface)" stroke-width="1.5"/></g>'; }).join('');
  const placed=[], lab=top.map(id=>P.find(p=>p.a.id===id)).filter(Boolean).map(p=>{ const nm=p.a.name.length>24?p.a.name.slice(0,23)+'…':p.a.name, right=X(p.x)>W*.72, w=nm.length*5.6, x=X(p.x)+(right?-1:1)*(rad(p)+4), y=Y(p.y)+4, x0=right?x-w:x, x1=right?x:x+w;
    if(placed.some(q=>Math.abs(q.y-y)<13&&q.x0<x1&&x0<q.x1)) return ''; placed.push({x0,x1,y});
    return '<text class="cv-lb" text-anchor="'+(right?'end':'start')+'" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'">'+esc(nm)+'</text>'; }).join('');
  const ticks=[0,25,50,75,100].map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" class="cv-gl"/><text x="'+(L-8)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end" class="cv-tk">'+v+'</text><text x="'+X(v).toFixed(1)+'" y="'+(H-B+16)+'" text-anchor="middle" class="cv-tk">'+v+'</text>').join('');
  const leg=Object.entries(COV_STNAME).map(([k,n])=>'<span class="cv-lg"><i style="background:'+COV_STCOL[k]+'"></i>'+n+'</span>').join('');
  return '<section class="mt-sec cv-prio"><div class="mt-sh"><h3>Prioritering</h3><span class="mt-hint">Hvem passer Solstad best, og hvem er mest verdt å jobbe med? Klikk en boble for å åpne accounten.</span></div><div class="row cv-bar">'+sel+'<div class="cv-leg">'+leg+'</div></div>'+
    '<svg class="cv-svg" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Prioriteringsflate for prospekter">'+ticks+'<text class="cv-ax" x="'+((L+W-R)/2)+'" y="'+(H-4)+'" text-anchor="middle">Eventfit mot Solstad (dokumentert event + romfit) →</text><text class="cv-ax" transform="translate(12 '+((T+H-B)/2)+') rotate(-90)" text-anchor="middle">Kommersielt potensial →</text>'+circ+lab+'</svg>'+
    '<p class="mt-hint">Boblestørrelse = antall dokumenterte eventsignaler. Plassering bygger på samme poengsum som Fit, delt i eventfit og kommersielt potensial. Det er en rangering, ikke en prognose.</p></section>'; }

mtMalHTML=function(){
  const cfg=mtCfg(), all=mtAll(), st=mtStats(all);
  return '<div class="mt-head"><div><h2>Målmarked mot '+fd(cfg.target,{day:'numeric',month:'long',year:'numeric'})+'</h2>'+mtSnapLine(cfg)+'</div></div>'+covFunnel(st)+covSegTable()+
   (st.dialogNoTouch||st.warn?'<p class="mt-note warn">'+(st.dialogNoTouch?st.dialogNoTouch+' har dialog, men ingen logget outbound-touch, og teller derfor ikke som adressert. ':'')+(st.warn?st.warn+' har kontakt, men oppfyller ikke målmarkedsreglene.':'')+'</p>':'')+
   covChart()+
   '<section class="mt-sec"><div class="mt-sh"><h3>Accounts</h3><button type="button" class="lnk" data-mtmodal="defs">Hva betyr statusene?</button></div>'+mtListHTML()+'</section>'; };
const _covPW=V.prosp.wire; V.prosp.wire=function(v){ _covPW(v);
  v.querySelectorAll('[data-cvest]').forEach(i=>{ i.addEventListener('click',e=>e.stopPropagation()); i.addEventListener('keydown',e=>e.stopPropagation()); i.addEventListener('change',async()=>{ await covSetEst(i.dataset.cvest,i.value); renderView(true); }); });
  v.querySelectorAll('tr[data-mtsegf]').forEach(r=>r.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); r.click(); } }));
  $('#cvSeg')?.addEventListener('change',e=>{ UI.cov.seg=e.target.value; renderView(true); });
  v.querySelectorAll('[data-cvopen]').forEach(g=>{ const open=()=>mtOpen(g.dataset.cvopen); g.addEventListener('click',open); g.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } }); }); };
