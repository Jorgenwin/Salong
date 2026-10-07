/* ---------- Prospekter: Arbeidsliste, Målmarked, Sekvenser ---------- */
UI.mt={tab:'pri',seg:'',stat:'',kind:'ny',page:1,sort:{k:'fit',dir:-1},acc:null,dr:{},modal:null,imp:null,bt:null,menu:false,wk:'all'};
const mtPct=x=>x==null?'–':Math.round(x*100)+' %';
const mtSegLabel=a=>a.seg?mtSegShort(a.seg.name):'Uten segment';
const mtEvTitle=a=>a.ev.level==='Confirmed'?'Dokumentert: '+a.ev.sources.map(s=>s.label||mtHost(s.url)).join(', '):a.ev.level==='Likely'?'Sannsynlig, men ikke dokumentert med kilde':'Ukjent: ingen eventsignal registrert';
const mtEvChip=a=>'<span class="mt-ev '+a.ev.level.toLowerCase()+'" title="'+esc(mtEvTitle(a))+'">'+a.ev.level+'</span>';
const mtStChip=s=>'<span class="mt-st '+s+'" title="market_status: '+s+'">'+MT_STAT[s]+'</span>';
const mtDots=a=>a.prog?'<span class="mt-dots" title="'+esc(a.prog.name+': dag '+a.prog.day+', '+a.prog.doneN+' av '+a.prog.total+' steg gjort')+'">'+a.prog.steps.map(s=>'<i class="'+s.state+'"></i>').join('')+'</span>':'';
const mtLast=a=>a.touch.lastOut?ago(a.touch.lastOut):'–';
function mtCovCell(a){
  if(a.active.length){ const p=a.active[0]; return '<span class="mt-cn">'+esc(p.name)+(p.title?' <small>'+esc(p.title)+'</small>':'')+'</span>'; }
  if(a.persons.length) return '<span class="mt-seek">'+a.persons.length+' må vurderes</span>';
  return '<span class="mt-seek">'+esc(mtRoleText(a))+'</span>'; }
function mtSeqCell(a){
  if(a.prog) return mtDots(a)+'<span class="mt-sq">'+esc(a.prog.name)+' · dag '+a.prog.day+'</span>';
  if(a.batch) return '<span class="mt-sq">'+esc(a.batch.name)+'</span><span class="mt-stg '+a.stage+'">'+esc(MT_STAGEN[a.stage])+'</span>';
  return '<span class="mt-seek">–</span>'; }
const mtNextCell=a=>'<span class="mt-nx'+(a.nx.late?' late':'')+'" title="'+esc(a.nx.t)+'">'+esc(a.nx.t)+'</span>'+(a.nx.due?'<small class="'+(a.nx.late?'late':'')+'">'+esc(mtFd(a.nx.due))+'</small>':'');

/* ---------- filter og sortering ---------- */
function mtFiltered(){
  const U=UI.mt, q=UI.q; let L=mtAll().filter(a=>a.kind===U.kind);
  if(U.seg) L=L.filter(a=>a.segId===U.seg);
  const f=U.stat; if(f){ L=L.filter(a=>f==='discovered'?true:f==='remaining'?(a.flags.qualified&&!a.flags.addressed):f==='disqualified'?a.flags.disqualified:(a.flags.qualified&&a.flags[f])); }
  L=L.filter(a=>ownMatch(a.ownerId)&&match(q,a.name,a.domain,a.orgnr,mtSegLabel(a),a.place));
  const {k,dir}=U.sort, g={pt:a=>a.pt||9,fit:a=>a.fit.total,name:a=>a.name.toLowerCase(),seg:a=>mtSegLabel(a),last:a=>a.touch.lastOut||'',own:a=>ownName(a.ownerId),ev:a=>({Confirmed:2,Likely:1,Unknown:0})[a.ev.level]};
  return L.sort((x,y)=>{ const a=g[k](x), b=g[k](y); const c=typeof a==='number'?a-b:String(a).localeCompare(String(b),'nb'); return (c||y.fit.total-x.fit.total||x.name.localeCompare(y.name,'nb'))*(c?dir:1); });
}
const mtTh=(k,n,cls)=>'<th'+(cls?' class="'+cls+'"':'')+' aria-sort="'+(UI.mt.sort.k===k?(UI.mt.sort.dir>0?'ascending':'descending'):'none')+'"><button type="button" data-mtsort="'+k+'">'+n+(UI.mt.sort.k===k?(UI.mt.sort.dir>0?' ↑':' ↓'):'')+'</button></th>';

/* ---------- Målmarked ---------- */
function mtKpis(st,cfg){
  const wk=mtWeeksLeft(), needAddr=Math.max(0,Math.ceil(cfg.goalPct/100*st.qualified)-st.addressed), perWeek=needAddr/wk;
  const on=k=>UI.mt.stat===k, K=(k,n,v,sub,cls)=>'<button type="button" class="mt-k'+(cls?' '+cls:'')+(on(k)?' on':'')+'" data-mtstat="'+k+'" aria-pressed="'+on(k)+'"><span>'+n+'</span><b>'+v+'</b><small>'+esc(sub)+'</small></button>';
  const F=(k,n,v)=>'<button type="button" class="mt-fs'+(on(k)?' on':'')+'" data-mtstat="'+k+'" aria-pressed="'+on(k)+'">'+n+' <b>'+v+'</b></button>';
  return '<div class="mt-kpis" role="group" aria-label="Nøkkeltall for målmarkedet">'+
    '<div class="mt-k cov" title="Adresserte kvalifiserte accounts / alle kvalifiserte accounts"><span>Markedsdekning</span><b>'+mtPct(st.cov)+'</b><small>'+st.addressed+' av '+st.qualified+' kvalifiserte</small></div>'+
    K('qualified','Kvalifiserte',st.qualified,mtPct(st.discovered?st.qualified/st.discovered:null)+' av identifisert')+
    K('enriched','Klare for kontakt',st.enriched,'har kontaktperson med data')+
    K('remaining','Gjenstår',st.remaining,'≈ '+(Math.round(perWeek*10)/10).toLocaleString('nb-NO')+' per uke til '+fd(cfg.target,{day:'numeric',month:'short'}))+'</div>'+
    '<p class="mt-fn2" role="group" aria-label="Fra identifisert til mulighet">'+F('discovered','Identifisert',st.discovered)+'<i aria-hidden="true">→</i>'+F('enriched','Beriket',st.enriched)+'<i aria-hidden="true">→</i>'+F('addressed','Adressert',st.addressed)+'<i aria-hidden="true">→</i>'+F('engaged','Dialog',st.engaged)+'<i aria-hidden="true">→</i>'+F('opportunity','Mulighet',st.opportunity)+'</p>';
}
function mtBars(segs){
  const grp=p=>segs.filter(s=>s.prio===p);
  const row=s=>{ const none=!s.qualified; return '<button type="button" class="mt-bar'+(UI.mt.seg===s.id?' on':'')+(s.on===false?' off':'')+'" data-mtsegf="'+esc(s.id)+'" aria-pressed="'+(UI.mt.seg===s.id)+'" title="'+esc(s.name)+'">'+
    '<span class="mt-bn">'+esc(mtSegShort(s.name))+'</span><span class="mt-bt" role="img" aria-label="'+(none?'Ingen kvalifiserte accounts':mtPct(s.cov)+' dekning')+'"><i style="width:'+(none?0:Math.max(2,Math.round((s.cov||0)*100)))+'%"></i></span>'+
    '<span class="mt-bv">'+(none?'–':mtPct(s.cov))+'</span><span class="mt-bc">'+(none?s.discovered+' identifisert':s.addressed+' av '+s.qualified)+'</span></button>'; };
  const col=(p,t)=>{ const L=grp(p); return L.length?'<div class="mt-bg"><h3>'+p+' <span>'+t+'</span></h3>'+L.map(row).join('')+'</div>':''; };
  return '<div class="mt-bars">'+col('P0','første prioritet')+'<div class="mt-bgc">'+col('P1','neste')+col('P2','sist')+'</div></div>';
}
function mtSnapLine(cfg){
  const snaps=mtSnaps(), last=snaps[0], d=mtSnapDiff(last), days=Math.max(0,mtDays(mtToday(),cfg.target));
  let s='<span><b>'+days+'</b> dager til '+fd(cfg.target,{day:'numeric',month:'long',year:'numeric'})+'</span><span>Dekningsmål <b>'+cfg.goalPct+' %</b></span>';
  if(!last) s+='<span>Ingen snapshot ennå. <button type="button" class="lnk" data-mtmodal="snap">Ta det første</button> så historisk dekning ikke endres i stillhet.</span>';
  else { s+='<span>Snapshot '+fd(last.date,{day:'numeric',month:'short'})+' ('+mtDays(last.date,mtToday())+' d siden): dekning '+mtPct(d.covOld)+' → <b>'+mtPct(d.covNow)+'</b>'+(d.added||d.gone?' · <b>nevneren er endret</b>: '+(d.added?'+'+d.added+' ':'')+(d.gone?'−'+d.gone+' ':'')+'kvalifiserte':'')+'</span><button type="button" class="lnk" data-mtmodal="snap">Snapshots</button>'; }
  return '<div class="mt-snap">'+s+'</div>';
}
function mtListHTML(){
  const U=UI.mt, L=mtFiltered(), shown=L.slice(0,U.page*40), all=mtAll(), nNy=all.filter(a=>a.kind==='ny').length, nRe=all.filter(a=>a.kind==='reaktivering').length;
  const chips=[]; if(U.seg){ const s=mtSegOf(mtCfg(),U.seg); chips.push('<button type="button" class="mt-fc" data-mtclr="seg">'+esc(s?mtSegShort(s.name):'Segment')+' ×</button>'); } if(U.stat) chips.push('<button type="button" class="mt-fc" data-mtclr="stat">'+esc(U.stat==='remaining'?'Gjenstår':MT_STAT[U.stat])+' ×</button>');
  const head='<div class="mt-lh"><div class="seg" role="group" aria-label="Type accounts"><button type="button" data-mtkind="ny" aria-pressed="'+(U.kind==='ny')+'">Nye accounts <span class="s">'+nNy+'</span></button><button type="button" data-mtkind="reaktivering" aria-pressed="'+(U.kind==='reaktivering')+'">Tidligere leietakere <span class="s">'+nRe+'</span></button></div>'+
    ownFilterHTML('Vis accounts etter ansvarlig')+chips.join('')+'<span class="mt-cnt">'+L.length+' accounts</span></div>';
  const note=U.kind==='reaktivering'?'<p class="mt-note">Tidligere og faste leietakere teller ikke i markedsdekningen for nye kunder. De får egen reaktiveringskadens.</p>':'';
  if(!L.length) return head+note+(nNy?'<div class="es"><h3>Ingen accounts matcher</h3><p>Fjern et filter for å se flere.</p></div>':'<div class="es"><h3>Målmarkedet er tomt</h3><p>Legg til accounts via Mer, Market Scout (importkø) eller Legg til account.</p></div>');
  return head+note+'<div class="tbl mt-tw"><table class="mt-t mt-list"><thead><tr>'+mtTh('name','Organisasjon')+mtTh('seg','Segment')+mtTh('pt','Tier')+mtTh('fit','Fit','n')+'<th>Kontakt</th>'+mtTh('own','Ansvarlig')+'<th>Status</th><th>Neste steg</th></tr></thead><tbody>'+
   shown.map(a=>'<tr data-mtacc="'+esc(a.id)+'" tabindex="0"><td class="mt-o"><b>'+esc(a.name)+'</b>'+(a.domain?'<small>'+esc(a.domain)+'</small>':'')+'</td><td>'+esc(mtSegLabel(a))+(a.prio?' <span class="mt-p">'+a.prio+'</span>':'')+'</td><td>'+ptChip(a)+'</td>'+
    '<td class="n"><button type="button" class="mt-fit" data-mtfit="'+esc(a.id)+'" aria-label="Fit '+a.fit.total+' av 100 for '+esc(a.name)+'. Vis komponenter">'+a.fit.total+'</button></td><td class="mt-cv">'+mtCovCell(a)+'</td><td>'+ownChip(a.ownerId)+'</td><td>'+mtStChip(a.status)+'</td><td class="mt-nc">'+mtNextCell(a)+'</td></tr>').join('')+'</tbody></table></div>'+
   (L.length>shown.length?'<div class="row" style="justify-content:center"><button type="button" class="btn sm" data-mtmore="1">Vis flere ('+(L.length-shown.length)+' igjen)</button></div>':'');
}
function mtMalHTML(){
  const cfg=mtCfg(), all=mtAll(), st=mtStats(all), segs=mtSegStats().filter(s=>s.id&&s.prio);
  return '<div class="mt-head"><div><h2>Målmarked mot '+fd(cfg.target,{day:'numeric',month:'long',year:'numeric'})+'</h2>'+mtSnapLine(cfg)+'</div></div>'+mtKpis(st,cfg)+
   '<section class="mt-sec"><div class="mt-sh"><h3>Dekning per segment</h3><span class="mt-hint">Klikk et segment for å filtrere listen. Prosent = adresserte av kvalifiserte.</span></div>'+mtBars(segs)+'</section>'+
   (st.dialogNoTouch||st.warn?'<p class="mt-note warn">'+(st.dialogNoTouch?st.dialogNoTouch+' kvalifisert'+(st.dialogNoTouch>1?'e':'')+' account'+(st.dialogNoTouch>1?'s':'')+' har dialog, men ingen logget outbound-touch, og teller derfor ikke som adressert. ':'')+(st.warn?st.warn+' har kontakt, men oppfyller ikke målmarkedsreglene.':'')+'</p>':'')+
   '<section class="mt-sec"><div class="mt-sh"><h3>Accounts</h3><button type="button" class="lnk" data-mtmodal="defs">Hva betyr statusene?</button></div>'+mtListHTML()+'</section>';
}

/* ---------- Arbeidsliste ---------- */
function mtWorking(){
  return mtAll().filter(a=>!a.flags.disqualified&&!a.dncAcc&&a.stage!=='completed'&&(a.batch||['enrolled','active','replied','paused'].includes(a.stage))&&ownMatch(a.ownerId)&&match(UI.q,a.name,a.domain));
}
function mtGroupOf(a,today){ const n=a.nx;
  if(n.k==='reply'||n.k==='deal'||(n.due&&n.due<=today&&n.k!=='followup')) return 0;
  if(n.k==='research'||n.k==='enrich') return 2; if(n.k==='ready') return 3; if(n.k==='followup'||n.k==='step') return 1; return 4; }
const MT_GROUPS=['Handle nå','Venter på svar eller neste steg','Trenger forarbeid','Klar for Apollo','Senere'];
/* ---------- Sekvenser ---------- */
function mtWavesHTML(){
  const cfg=mtCfg(), all=mtAll().filter(a=>a.kind==='ny'); let tg=0,ti=0;
  const rows=cfg.waves.map(w=>{ const L=all.filter(a=>w.segs.includes(a.segId)), st=mtStats(L), gap=Math.max(0,(w.goal||0)-st.discovered); tg+=w.goal||0; ti+=st.discovered;
    return '<tr><td><b>'+esc(w.name)+'</b></td><td class="mt-wsg">'+w.segs.map(id=>esc(mtSegShort(mtSegName(id)))).join(' + ')+'</td><td class="n"><input class="in mt-gi" type="number" min="0" step="5" value="'+(w.goal||0)+'" data-mtgoal="'+esc(w.id)+'" aria-label="Mål antall accounts for '+esc(w.name)+'"></td><td class="n">'+st.discovered+'</td><td class="n">'+st.qualified+'</td><td class="n">'+st.addressed+'</td><td class="n'+(gap?' mt-gap':'')+'">'+(gap?gap:'0')+'</td><td class="mt-wc"><span class="mt-bt"><i style="width:'+(st.cov?Math.round(st.cov*100):0)+'%"></i></span><span class="mt-bv">'+mtPct(st.cov)+'</span></td><td><button type="button" class="btn sm" data-mtwave="'+esc(w.id)+'">Start batch</button></td></tr>'; }).join('');
  return '<section class="mt-sec"><div class="mt-sh"><h3>Første 30-dagers kartlegging</h3><button type="button" class="lnk" data-mtmodal="seg">Segmenter og bølger</button></div><div class="tbl mt-tw"><table class="mt-t mt-wv"><thead><tr><th>Bølge</th><th>Segmenter</th><th class="n">Mål</th><th class="n">Identifisert</th><th class="n">Kvalifisert</th><th class="n">Adressert</th><th class="n" title="Accounts som ikke er identifisert ennå">Mangler</th><th>Dekning</th><th></th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2"><b>Første kartleggingsbølge</b></td><td class="n"><b>'+tg+'</b></td><td class="n"><b>'+ti+'</b></td><td colspan="5"></td></tr></tfoot></table></div><p class="mt-note">Målene er arbeidsmål, ikke et påstått komplett TAM. «Mangler i grunnlaget» er hvor mange accounts som ikke er identifisert ennå. Salong finner ikke på accounts for å fylle gapet.</p></section>';
}
function mtBatchesHTML(){
  const B=mtBuild().batches.slice().reverse(), all=mtAll();
  if(!B.length) return '<section class="mt-sec"><div class="mt-sh"><h3>Aktive batcher</h3></div><div class="es"><h3>Ingen aktive sekvenser</h3><p>Start en batch fra Målmarked for å begynne.</p><button type="button" class="btn" data-mttab="mal">Åpne Målmarked</button></div></section>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Aktive batcher</h3></div>'+B.map(b=>{ const L=(b.accIds||[]).map(id=>all.find(a=>a.id===id)).filter(Boolean), by={}; for(const a of L) by[a.stage]=(by[a.stage]||0)+1;
    return '<details class="mt-b"'+(UI.mt['b_'+b.id]?' open':'')+' data-mtb="'+esc(b.id)+'"><summary><b>'+esc(b.name)+'</b><span class="mt-bm">'+L.length+' accounts · '+(b.ownerId?esc(ownName(b.ownerId)):'ufordelt')+' · '+esc(fd(b.createdAt,{day:'numeric',month:'short'}))+'</span><span class="mt-fn">'+MT_STAGES.map(([k,n])=>by[k]?'<span class="mt-stg '+k+'" title="'+n+'">'+by[k]+' '+esc(n.toLowerCase())+'</span>':'').join('')+'</span><span class="chip '+(b.status==='aktiv'?'a':'')+'">'+esc(b.status)+'</span></summary>'+
     '<div class="tbl"><table class="mt-t"><thead><tr><th>Organisasjon</th><th>Segment</th><th class="n">Fit</th><th>Kontakt</th><th>Steg</th><th>Neste steg</th><th></th></tr></thead><tbody>'+L.map(a=>'<tr data-mtacc="'+esc(a.id)+'"><td class="mt-o"><b>'+esc(a.name)+'</b></td><td>'+esc(mtSegLabel(a))+'</td><td class="n">'+a.fit.total+'</td><td class="mt-cv">'+mtCovCell(a)+'</td><td><select class="in fsel mt-ss" data-mtstage="'+esc(a.id)+'" aria-label="Steg for '+esc(a.name)+'">'+MT_STAGES.map(([k,n])=>'<option value="'+k+'"'+(a.stage===k?' selected':'')+'>'+n+'</option>').join('')+'</select></td><td class="mt-nc">'+mtNextCell(a)+'</td><td><button type="button" class="btn ghost sm" data-mtbrm="'+esc(b.id)+'|'+esc(a.id)+'" aria-label="Fjern '+esc(a.name)+' fra batchen">Fjern</button></td></tr>').join('')+'</tbody></table></div>'+
     bkBatchPanel(b)+'<div class="row">'+(b.status==='aktiv'?'<button type="button" class="btn sm" data-mtbs="'+esc(b.id)+'|pauset">Pause</button>':'<button type="button" class="btn sm" data-mtbs="'+esc(b.id)+'|aktiv">Gjenoppta</button>')+'<button type="button" class="btn ghost sm" data-mtbs="'+esc(b.id)+'|ferdig">Fullfør batch</button></div></details>'; }).join('')+'</section>';
}
function mtStepper(steps,cls){ return '<ol class="mt-stp'+(cls?' '+cls:'')+'">'+steps.map(s=>'<li class="'+(s.state||'later')+'"><i></i><b>Dag '+s.d+'</b><span>'+esc(MT_CH[s.ch])+'</span><small>'+esc(s.t)+'</small></li>').join('')+'</ol>'; }
function mtTemplatesHTML(){
  const cfg=mtCfg(), chn=ch=>MT_CH[ch]||ch;
  const mk=(key,name,prio,steps,custom)=>{ const days=steps.length?Math.max(...steps.map(s=>s.d||0)):0;
    return '<li class="mt-sr"><div class="mt-sn"><b>'+esc(name)+'</b>'+(prio?' <span class="mt-p">'+prio+'</span>':'')+'</div><div class="mt-sm">'+(custom?'Egen':'Standard')+' / '+steps.length+' steg · '+days+' dager</div><div class="mt-sf">'+steps.map(s=>esc(chn(s.ch))).join(' → ')+'</div><button type="button" class="btn ghost sm" data-mttpl="'+esc(key)+'">Rediger</button></li>'; };
  const segs=cfg.segs.filter(s=>s.on).map(s=>{ const dummy={kind:'ny',segId:s.id,seg:s}; const c=mtCadence(dummy,cfg); return mk(s.id,mtSegShort(s.name),s.prio,c.steps,!!(cfg.seq[s.id]&&cfg.seq[s.id].length)); });
  return '<section class="mt-sec"><div class="mt-sh"><h3>Sekvenser</h3><span class="mt-hint">Stegene er en plan du følger. Salong sender ikke noe selv.</span></div><ul class="mt-sl">'+mk('react','Tidligere leietakere','',cfg.seq.react||MT_SEQ_REACT,!!cfg.seq.react)+segs.join('')+'</ul></section>';
}
function mtLearnHTML(){
  const R=mtLearn(), minN=5, sg=mtLearnSuggest(R,minN), rows=R.filter(r=>r.nAddr>0);
  const cell=(v,n)=>n<minN?'<td class="n mt-low" title="For lite grunnlag">n='+n+'</td>':'<td class="n">'+mtPct(v)+' <small>n='+n+'</small></td>';
  const mo=m=>m&&m.of>=3?esc(m.v)+' <small>'+m.n+' av '+m.of+'</small>':'';
  if(!rows.length) return '<section class="mt-sec"><div class="mt-sh"><h3>Læring fra outreach</h3></div><p class="mt-hint">Ingen læring ennå. Tall vises når accounts i et segment er adressert, og som prosent fra n='+minN+'.</p></section>';
  const pat=r=>[mo(r.role),r.need&&r.need.of>=3?mo({...r.need,v:(MT_NEED.find(x=>x[0]===r.need.v)||[0,r.need.v])[1]}):'',r.nSize>=3?'ca. '+Math.round(r.size)+' deltakere':'',mo(r.rooms),r.obj&&r.obj.of>=3?mo({...r.obj,v:(MT_OBJ.find(x=>x[0]===r.obj.v)||[0,r.obj.v])[1]}):''].filter(Boolean).join(' · ')||'<span class="mt-low">For lite grunnlag</span>';
  return '<section class="mt-sec"><div class="mt-sh"><h3>Læring fra outreach</h3><span class="mt-hint">Tall under n='+minN+' vises ikke som prosent.</span></div><div class="tbl mt-tw"><table class="mt-t"><thead><tr><th>Segment</th><th class="n">Adressert</th><th class="n">Respons</th><th class="n">Dialog</th><th class="n">Møte / mulighet</th><th>Mønster (kjøperrolle, behov, størrelse, rom, innvending)</th></tr></thead><tbody>'+
   rows.map(r=>'<tr><td><b>'+esc(mtSegShort(r.name))+'</b> <span class="mt-p">'+r.prio+'</span></td><td class="n">'+r.nAddr+'</td>'+cell(r.resp,r.nAddr)+cell(r.dial,r.nAddr)+cell(r.meet,r.nAddr)+'<td>'+pat(r)+'</td></tr>').join('')+'</tbody></table></div><div class="mt-sugg"><b>Forslag til neste måned.</b> '+esc(sg.text)+(sg.list.length?'<ol>'+sg.list.map(r=>'<li>'+esc(mtSegShort(r.name))+' <small>respons '+mtPct(r.resp)+', møte/mulighet '+mtPct(r.meet)+', n='+r.nAddr+'</small></li>').join('')+'</ol>':'')+'</div></section>';
}
function mtSeqHTML(){
  const R=mtLearn(), hasOut=R.some(r=>r.nAddr>0);
  return '<div class="mt-one">'+mtBatchesHTML()+mtTemplatesHTML()+'<details class="mt-dt"><summary>Bølger og mål</summary>'+mtWavesHTML()+'</details>'+(hasOut?mtLearnHTML():'')+mtApolloBox()+'</div>';
}

/* ---------- view ---------- */
V.prosp={html(){
  const U=UI.mt, nw=mtWorking().length;
  const tabs='<div class="seg mt-tabs" role="group" aria-label="Prospekter">'+[['pri','Prioritet',null],['arb','Arbeidsliste',nw],['mal','Målmarked',null],['seq','Sekvenser',null],['str','Strategi',null]].map(([k,n,c])=>'<button type="button" data-mttab="'+k+'" aria-pressed="'+(U.tab===k)+'">'+n+(c!=null?' <span class="s">'+c+'</span>':'')+'</button>').join('')+'</div>';
  const menu='<details class="mt-menu"'+(U.menu?' open':'')+'><summary class="btn">Mer<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></summary><div class="mt-mi" role="menu">'+
   [['add','Legg til account'],['scout','Market Scout (importkø)'],['cog','Importer Cognism-kontakter'],['exp','Eksporter → Apollo CSV (fallback)'],['enr','Eksporter → accounts for enrichment (fallback)'],['apo','Importer Apollo-status (CSV, fallback)'],['snap','Snapshots av målmarkedet'],['seg','Segmenter og bølger']].map(([k,n])=>'<button type="button" role="menuitem" data-mtmodal="'+k+'">'+n+'</button>').join('')+'</div></details>';
  return '<div class="mt"><div class="mt-top">'+tabs+'<div class="mt-top-r">'+menu+'<button type="button" class="btn primary" data-mtmodal="batch">Start neste batch</button></div></div>'+(U.tab==='pri'?tierPriHTML():U.tab==='str'?stratHTML():U.tab==='arb'?mtArbHTML():U.tab==='seq'?mtSeqHTML():mtMalHTML())+'</div>'; },
 wire(v){
  const U=UI.mt, rr=()=>renderView(true);
  v.querySelectorAll('[data-mttab]').forEach(b=>b.addEventListener('click',()=>{ U.tab=b.dataset.mttab; U.menu=false; rr(); }));
  v.querySelectorAll('[data-mtmodal]').forEach(b=>b.addEventListener('click',()=>{ U.menu=false; mtModalOpen(b.dataset.mtmodal); }));
  v.querySelectorAll('[data-mtstat]').forEach(b=>b.addEventListener('click',()=>{ U.stat=U.stat===b.dataset.mtstat?'':b.dataset.mtstat; U.page=1; rr(); }));
  v.querySelectorAll('[data-mtsegf]').forEach(b=>b.addEventListener('click',()=>{ U.seg=U.seg===b.dataset.mtsegf?'':b.dataset.mtsegf; U.page=1; rr(); }));
  v.querySelectorAll('[data-mtclr]').forEach(b=>b.addEventListener('click',()=>{ U[b.dataset.mtclr]=''; U.page=1; rr(); }));
  v.querySelectorAll('[data-mtkind]').forEach(b=>b.addEventListener('click',()=>{ U.kind=b.dataset.mtkind; U.page=1; rr(); }));
  v.querySelectorAll('[data-mtsort]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.mtsort; U.sort=U.sort.k===k?{k,dir:-U.sort.dir}:{k,dir:k==='fit'||k==='last'||k==='ev'?-1:1}; rr(); }));
  v.querySelector('[data-mtmore]')?.addEventListener('click',()=>{ U.page++; rr(); });
  v.querySelectorAll('tr[data-mtacc]').forEach(tr=>{ tr.addEventListener('click',e=>{ if(e.target.closest('button,select,input,a')) return; mtOpen(tr.dataset.mtacc); }); tr.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.target.closest('button,select,input,a')) mtOpen(tr.dataset.mtacc); }); });
  v.querySelectorAll('[data-mtfit]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); mtFitPop(b.dataset.mtfit,b); }));
  v.querySelectorAll('[data-mtdo]').forEach(b=>b.addEventListener('click',()=>mtOpen(b.dataset.mtdo,'do')));
  wireOwnFilter(v,rr);
  v.querySelectorAll('[data-mtgoal]').forEach(i=>i.addEventListener('change',async()=>{ const cfg=mtCfg(); await mtSaveCfg({waves:cfg.waves.map(w=>w.id===i.dataset.mtgoal?{...w,goal:Math.max(0,Number(i.value)||0)}:w)}); }));
  v.querySelectorAll('[data-mtwave]').forEach(b=>b.addEventListener('click',()=>{ const w=mtCfg().waves.find(x=>x.id===b.dataset.mtwave); mtModalOpen('batch',{seg:'wave:'+w.id,n:w.goal||25}); }));
  v.querySelectorAll('details[data-mtb]').forEach(d=>d.addEventListener('toggle',()=>{ U['b_'+d.dataset.mtb]=d.open; }));
  v.querySelectorAll('[data-mtstage]').forEach(s=>s.addEventListener('change',async()=>{ const r=await mtSetStage(s.dataset.mtstage,s.value); if(r&&r.err){ toast(r.err); rr(); } }));
  v.querySelectorAll('[data-mtbs]').forEach(b=>b.addEventListener('click',async()=>{ const [id,st]=b.dataset.mtbs.split('|'); await mtBatchStatus(id,st); }));
  v.querySelectorAll('[data-mtbrm]').forEach(b=>b.addEventListener('click',async()=>{ const [bid,aid]=b.dataset.mtbrm.split('|'); await mtBatchRemove(bid,aid); toast('Fjernet fra batchen'); }));
  v.querySelectorAll('[data-mtapo]').forEach(b=>b.addEventListener('click',()=>mtModalOpen('exp',{batch:b.dataset.mtapo})));
  v.querySelectorAll('[data-mttpl]').forEach(b=>b.addEventListener('click',()=>mtModalOpen('tpl',{key:b.dataset.mttpl})));
  if(UI.pr){ const id=UI.pr; UI.pr=null; if(mtGet(id)) setTimeout(()=>mtOpen(id),0); }
 }};
VDESC.prosp='Hele målmarkedet, prioriterte accounts og neste batch';
UI.pmode='list';

/* ---------- fit-komponenter (popover) ---------- */
function mtFitPop(id,anchor){
  const old=document.getElementById('mt-pop'); if(old){ const same=old.dataset.id===id; old.remove(); if(same) return; }
  const a=mtGet(id); if(!a) return; const p=document.createElement('div'); p.id='mt-pop'; p.dataset.id=id; p.setAttribute('role','dialog'); p.setAttribute('aria-label','Fit-komponenter for '+a.name);
  p.innerHTML='<h4>Fit '+a.fit.total+' <span>av 100 · '+esc(a.name)+'</span></h4><table>'+a.fit.parts.map(x=>'<tr><td>'+esc(x.label)+'<small>'+esc(x.basis)+'</small></td><td class="n"><b>'+x.pts+'</b> / '+x.max+'</td></tr>').join('')+'</table><p>Åpen sum av seks regler. Ingen KI-score. Poeng uten grunnlag gis ikke.</p>';
  document.body.appendChild(p); const r=anchor.getBoundingClientRect(), w=p.offsetWidth, h=p.offsetHeight;
  p.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left-w+r.width+20))+'px'; p.style.top=(r.bottom+6+h>innerHeight?Math.max(8,r.top-h-6):r.bottom+6)+'px';
}
document.addEventListener('click',e=>{ const p=document.getElementById('mt-pop'); if(p&&!e.target.closest('#mt-pop,[data-mtfit]')) p.remove(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const p=document.getElementById('mt-pop'); if(p){ p.remove(); e.stopPropagation(); } } },true);

/* ---------- overlegg: kortet for en account og modaler ---------- */
function mtRoot(){ let r=document.getElementById('mt-root'); if(!r){ r=document.createElement('div'); r.id='mt-root'; document.body.appendChild(r); } return r; }
function mtClose(){ UI.mt.acc=null; UI.mt.modal=null; const r=mtRoot(); r.innerHTML=''; try{ if(UI.mt.ret&&document.contains(UI.mt.ret)) UI.mt.ret.focus(); }catch(e){} }
let mtPendingOv=false;
function mtOverlay(force){
  const U=UI.mt, root=mtRoot(); if(!U.acc&&!U.modal){ if(root.innerHTML) root.innerHTML=''; return; }
  if(!force&&root.contains(document.activeElement)&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){ mtPendingOv=true; return; }
  mtPendingOv=false; const a=U.acc?mtGet(U.acc):null; if(U.acc&&!a){ U.acc=null; }
  const st=root.querySelector('.drawer .body'), sc=st?st.scrollTop:0, ms=root.querySelector('.mt-mb'), msc=ms?ms.scrollTop:0;
  root.innerHTML=(a?'<div class="scrim" data-mtx="1"></div>'+mtDrawerHTML(a):'')+(U.modal?mtModalHTML():'');
  if(a){ mtWireDrawer(root,a); const b=root.querySelector('.drawer .body'); if(b) b.scrollTop=sc; if(!U.dr.focused){ U.dr.focused=true; const h=root.querySelector('.drawer h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus(); } } }
  if(U.modal){ mtWireModal(root); const m=root.querySelector('.mt-mb'); if(m) m.scrollTop=msc; }
  root.querySelectorAll('[data-mtx]').forEach(x=>x.addEventListener('click',()=>{ if(U.modal) mtModalClose(); else mtClose(); }));
}
document.addEventListener('focusout',()=>setTimeout(()=>{ if(mtPendingOv&&!mtRoot().contains(document.activeElement)) mtOverlay(); },0));
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&(UI.mt.acc||UI.mt.modal)&&!document.getElementById('mt-pop')){ if(UI.mt.modal) mtModalClose(); else mtClose(); } });
const _mtRd=renderDrawer; renderDrawer=function(f){ _mtRd(f); mtOverlay(); };

/* ---------- kortet for en account ---------- */
function mtPersonHTML(a,p,dim){
  const em=mtVerLabel(p,'email'), ph=mtVerLabel(p,'phone');
  return '<div class="mt-pe'+(p.dnc?' dnc':'')+(dim?' dim':'')+'"><div class="mt-pn"><b>'+esc(p.name)+'</b><span>'+esc(p.title||'Stilling ikke oppgitt')+'</span>'+(p.rel==='ja'?'':'<span class="chip amber">'+(p.rel==='nei'?'Ikke relevant':'Relevans ikke vurdert')+'</span>')+(p.dnc?'<span class="chip red" title="'+esc(p.dnc.reason)+'">Ikke kontakt</span>':'')+'</div>'+
   '<dl class="mt-pk"><dt>E-post</dt><dd>'+(p.email?'<a href="mailto:'+esc(p.email)+'">'+esc(p.email)+'</a>':'–')+(p.email?' <em class="v '+em.k+'">'+esc(em.t)+'</em>':'')+'</dd><dt>Telefon</dt><dd>'+(p.phone?'<a href="tel:'+esc(String(p.phone).replace(/\s/g,''))+'">'+esc(p.phone)+'</a>':'–')+(p.phone?' <em class="v '+ph.k+'">'+esc(ph.t)+'</em>':'')+'</dd><dt>LinkedIn</dt><dd>'+(p.linkedin?'<a href="'+esc(/^https?:/.test(p.linkedin)?p.linkedin:'https://'+p.linkedin)+'" target="_blank" rel="noopener">Profil</a>':'–')+'</dd><dt>Kilde</dt><dd>'+esc(p.source)+(p.quality?' · datakvalitet '+esc(p.quality):'')+(p.verifiedAt?' · sist verifisert '+esc(fd(String(p.verifiedAt).slice(0,10))):' · aldri verifisert')+'</dd></dl>'+
   (p.readonly?'<p class="mt-hint">Fra kundekortet. Rediger der.</p>':'<div class="mt-pa">'+(p.rel!=='ja'?'<button type="button" class="btn sm" data-mtpa="rel|'+esc(p.id)+'">Merk som relevant</button>':'<button type="button" class="btn ghost sm" data-mtpa="norel|'+esc(p.id)+'">Ikke relevant</button>')+(p.dnc?'<button type="button" class="btn ghost sm" data-mtpa="undnc|'+esc(p.id)+'">Opphev opt-out</button>':'<button type="button" class="btn ghost sm" data-mtpa="dnc|'+esc(p.id)+'">Opt-out</button>')+(!p.dnc?'<label class="mt-ck"><input type="checkbox" data-mtpa="act|'+esc(p.id)+'"'+(p.active!==false?' checked':'')+'> Aktiv</label>':'')+'<button type="button" class="btn ghost sm danger" data-mtpa="del|'+esc(p.id)+'">Slett</button></div>')+'</div>'; }
function mtEditHTML(a){
  return '<div class="mt-ed"><div class="form"><label class="f"><span>Domene</span><input class="in" id="mtEd" value="'+esc(a.domain)+'" placeholder="forlag.no"></label><label class="f"><span>Org.nr.</span><input class="in" id="mtEo" inputmode="numeric" value="'+esc(a.orgnr)+'"></label><label class="f"><span>Sted</span><input class="in" id="mtEp" value="'+esc(a.place)+'"></label>'+
   '<label class="f"><span>Størrelse</span><select class="in" id="mtEz"><option value="">Ukjent</option>'+[['S','Liten'],['M','Middels'],['L','Stor']].map(([k,n])=>'<option value="'+k+'"'+(a.size===k?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
   '<label class="f"><span>Eventsignal</span><select class="in" id="mtEl">'+['Unknown','Likely','Confirmed'].map(x=>'<option'+(a.ev.level===x?' selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f"><span>Kilde-URL (påkrevd for Confirmed)</span><input class="in" id="mtEu" value="'+esc((a.ev.sources[0]||{}).url||'')+'" placeholder="https://"></label><label class="f full"><span>Merknad</span><input class="in" id="mtEn" value="'+esc(a.ev.manual?a.ev.note:'')+'"></label></div>'+
   '<div class="row"><button type="button" class="btn sm primary" data-mtd="editsave">Lagre</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div></div>'; }
function mtLogHTML(a){
  const L=UI.mt.dr.lg||(UI.mt.dr.lg={ch:'epost',dir:'out',pid:(a.active[0]||{}).id||'',res:'',need:'',obj:'',text:''});
  const ps=a.persons.filter(p=>!p.dnc);
  return '<div class="mt-lg"><div class="form"><label class="f"><span>Person</span><select class="in" data-mtl="pid"><option value="">Ingen person (teller ikke som adressert)</option>'+ps.map(p=>'<option value="'+esc(p.id)+'"'+(L.pid===p.id?' selected':'')+'>'+esc(p.name)+(p.title?' · '+esc(p.title):'')+'</option>').join('')+'</select></label>'+
   '<label class="f"><span>Kanal</span><select class="in" data-mtl="ch">'+[['epost','E-post'],['telefon','Telefon'],['linkedin','LinkedIn'],['mote','Møte']].map(([k,n])=>'<option value="'+k+'"'+(L.ch===k?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
   '<label class="f"><span>Retning</span><select class="in" data-mtl="dir"><option value="out"'+(L.dir==='out'?' selected':'')+'>Utgående</option><option value="in"'+(L.dir==='in'?' selected':'')+'>Innkommende svar</option></select></label>'+
   (L.dir==='in'?'<label class="f"><span>Arrangementsbehov</span><select class="in" data-mtl="need"><option value="">Ikke oppgitt</option>'+MT_NEED.map(([k,n])=>'<option value="'+k+'"'+(L.need===k?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label class="f"><span>Innvending</span><select class="in" data-mtl="obj"><option value="">Ingen</option>'+MT_OBJ.map(([k,n])=>'<option value="'+k+'"'+(L.obj===k?' selected':'')+'>'+n+'</option>').join('')+'</select></label>':'')+
   '<label class="f full"><span>Notat</span><input class="in" data-mtl="text" value="'+esc(L.text)+'" placeholder="Kort notat (valgfritt)"></label></div><div class="row"><button type="button" class="btn sm primary" data-mtd="logsave">Logg</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div></div>'; }

function mtWireDrawer(root,a){
  const U=UI.mt, D=U.dr, rr=()=>mtOverlay(true), val=s=>(root.querySelector(s)||{}).value||'';
  root.querySelectorAll('.drawer .x').forEach(x=>x.addEventListener('click',mtClose));
  root.querySelector('[data-mtsegset]')?.addEventListener('change',async e=>{ await mtPatch(a.id,{segId:e.target.value},'Segment: '+mtSegName(e.target.value)); });
  root.querySelector('[data-mtstg]')?.addEventListener('change',async e=>{ const r=await mtSetStage(a.id,e.target.value); if(r&&r.err){ toast(r.err); rr(); } });
  root.querySelector('[data-mtown]')?.addEventListener('change',async e=>{ await mtSetOwner(a.id,e.target.value||null); D.assign=false; toast('Ansvarlig oppdatert'); });
  root.querySelectorAll('[data-mtl]').forEach(i=>i.addEventListener('change',()=>{ D.lg[i.dataset.mtl]=i.value; if(i.dataset.mtl==='dir') rr(); }));
  root.querySelectorAll('input[data-mtl="text"]').forEach(i=>i.addEventListener('input',()=>{ D.lg.text=i.value; }));
  root.querySelectorAll('[data-mtstep]').forEach(c=>c.addEventListener('change',()=>mtStep(a.id,Number(c.dataset.mtstep))));
  root.querySelectorAll('[data-mtpa]').forEach(b=>b.addEventListener(b.type==='checkbox'?'change':'click',async()=>{ const [k,id]=b.dataset.mtpa.split('|');
    if(k==='rel') await mtSetPerson(id,{rel:'ja'}); else if(k==='norel') await mtSetPerson(id,{rel:'nei',active:false}); else if(k==='act'){ const on=b.checked; if(on&&a.active.length>=2){ toast('Maks 2 aktive personer per account. Fjern en først.'); rr(); return; } await mtSetPerson(id,{active:on}); }
    else if(k==='dnc'){ D.dnc=id; rr(); return; } else if(k==='undnc') await mtClearDnc(id); else if(k==='del'){ if(D.del===id){ D.del=null; await mtDelPerson(id); toast('Kontakten er slettet'); } else { D.del=id; b.textContent='Klikk igjen for å slette'; } } }));
  root.querySelectorAll('[data-mtd]').forEach(b=>b.addEventListener('click',async()=>{ const k=b.dataset.mtd, close=()=>{ const m=root.querySelector('.mt-menu[open]'); if(m) m.open=false; };
    close();
    if(k==='cancel'){ D.edit=null; D.dq=false; D.log=false; rr(); }
    else if(k==='edit'){ D.edit='basis'; rr(); } else if(k==='roomedit'){ D.edit='room'; rr(); } else if(k==='rolesedit'){ D.edit='roles'; rr(); }
    else if(k==='qual'){ D.edit='basis'; rr(); setTimeout(()=>{ const e=root.querySelector('.mt-ed'); if(e) e.scrollIntoView({block:'center'}); },30); }
    else if(k==='editsave'){ const dom=domainOf(val('#mtEd')), on=val('#mtEo').replace(/\D/g,''); const dup=mtAll().find(x=>x.id!==a.id&&((on&&x.orgnr===on)||(dom&&x.domain===dom))); if(dup){ toast('Samme org.nr. eller domene finnes allerede på '+dup.name+'.'); return; }
      const r=await mtSetEvent(a.id,val('#mtEl'),val('#mtEu'),'',val('#mtEn')); if(r.err){ toast(r.err); return; } await mtPatch(a.id,{domain:dom,orgnr:on,place:val('#mtEp'),size:val('#mtEz'),geo:/oslo/i.test(val('#mtEp'))?'oslo':val('#mtEp')?'norge':''},'Grunnlag redigert'); D.edit=null; rr(); }
    else if(k==='roomsave'){ const r=await mtSetRoom(a.id,val('#mtRfV'),val('#mtRfB')); if(r.err){ toast(r.err); return; } D.edit=null; rr(); }
    else if(k==='rolesave'){ const roles=val('#mtRoles').split(',').map(x=>x.trim()).filter(Boolean); await mtPatch(a.id,{roles},'Ønsket kontaktrolle: '+roles.join(', ')); D.edit=null; rr(); }
    else if(k==='manq'){ await mtQualify(a.id,'Manuelt kvalifisert'); } else if(k==='resetq'||k==='reset'){ await mtResetQual(a.id); }
    else if(k==='addp'){ const r=await mtAddPerson(a.id,{name:val('#mtPn'),title:val('#mtPt'),email:val('#mtPe'),phone:val('#mtPp'),linkedin:val('#mtPl'),source:'Manuell'}); if(r.err){ toast(r.err); return; } D.addp=false; toast('Kontaktperson lagt til'); }
    else if(k==='assign'){ D.assign=true; rr(); setTimeout(()=>{ const s=root.querySelector('[data-mtown]'); if(s) s.focus(); },30); }
    else if(k==='enrich'){ await mtPatch(a.id,{enrichAt:mtToday()},'Klargjort for enrichment'); toast('Lagt i eksportlisten for enrichment. Eksporter under Mer → Eksporter accounts for enrichment.'); }
    else if(k==='apollo'){ mtModalOpen('exp',{ids:[a.id]}); }
    else if(k==='log'){ D.log=true; D.lg=D.lg||null; rr(); setTimeout(()=>{ const e=root.querySelector('.mt-lg'); if(e) e.scrollIntoView({block:'center'}); },30); }
    else if(k==='logsave'){ const L=D.lg||{}; const r=await mtLogTouch(a.id,L); if(r.err){ toast(r.err); return; } D.log=false; D.lg=null; toast(r.noPerson?'Logget, men teller ikke som adressert uten kontaktperson.':'Kontakt logget'); }
    else if(k==='deal'){ await mtEnsureOrg(a); mtClose(); openDrawer('deal',null,{orgId:a.id}); }
    else if(k==='org'){ mtClose(); openOrg(a.id); }
    else if(k==='done'){ await mtPatch(a.id,{done:a.doc&&a.doc.done?null:mtToday()},a.doc&&a.doc.done?'Ferdigmarkering fjernet':'Markert som ferdig vurdert'); }
    else if(k==='dq'){ D.dq=true; rr(); setTimeout(()=>{ const e=root.querySelector('.mt-dq'); if(e) e.scrollIntoView({block:'center'}); },30); }
    else if(k==='dqgo'){ let r=val('#mtDqS'); if(r==='__') r=val('#mtDqT'); else if(r&&val('#mtDqT')) r+=': '+val('#mtDqT'); const x=await mtDisqualify(a.id,r); if(x.err){ toast(x.err); return; } D.dq=false; toast('Diskvalifisert'); }
  }));
  if(D.dnc){ const p=a.persons.find(x=>x.id===D.dnc); if(p){ const el=root.querySelector('[data-mtpa="dnc|'+D.dnc+'"]'); if(el&&!el.dataset.ask){ el.dataset.ask='1'; const f=document.createElement('div'); f.className='mt-dnc'; f.innerHTML='<label class="f"><span>Årsak til opt-out (påkrevd)</span><input class="in" id="mtDnR" placeholder="For eksempel: ba om å bli tatt av listen"></label><div class="row"><button type="button" class="btn sm danger" id="mtDnG">Lagre opt-out</button><button type="button" class="btn ghost sm" id="mtDnC">Avbryt</button></div>'; el.closest('.mt-pe').appendChild(f);
    f.querySelector('#mtDnG').addEventListener('click',async()=>{ const r=await mtDnc(D.dnc,f.querySelector('#mtDnR').value); if(r.err){ toast(r.err); return; } D.dnc=null; toast('Opt-out lagret. Kontakten kan ikke enrolles.'); });
    f.querySelector('#mtDnC').addEventListener('click',()=>{ D.dnc=null; rr(); }); } } }
}
