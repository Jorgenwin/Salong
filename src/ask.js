/* ---------- Spør Salong: global side panel, kontekst fra siden og objektet ---------- */
UI.askOpen=false; UI.askManual=false; UI.askAdv=false;
{ const i=VIEWS.findIndex(v=>v.k==='kunnskap'); if(i>=0) VIEWS.splice(i,1); }
function askCtx(){
  const D=UI.drawer, v=UI.view, o={sc:{t:'crm',orgId:'',dealId:''},title:'Spør om porteføljen',chip:'',why:''};
  if(D&&D.id&&D.kind==='org'&&S.orgs[D.id]&&!S.orgs[D.id].deletedAt){ o.sc={t:'kunde',orgId:D.id,dealId:''}; o.title='Spør om '+orgName(D.id); return o; }
  if(D&&D.id&&D.kind==='deal'&&S.deals[D.id]&&!S.deals[D.id].deletedAt&&S.orgs[S.deals[D.id].orgId]){ o.sc={t:'sak',orgId:'',dealId:D.id}; o.title='Spør om saken «'+S.deals[D.id].title+'»'; return o; }
  if(v==='prosp'&&UI.mt&&UI.mt.acc){ const a=typeof mtGet==='function'?mtGet(UI.mt.acc):null;
    if(a){ o.title='Spør om '+a.name; o.chip='Hvorfor er denne prioritert?'; if(S.orgs[a.id]&&!S.orgs[a.id].deletedAt) o.sc={t:'kunde',orgId:a.id,dealId:''};
      o.why='<details class="ask-why" open><summary>Hvorfor er '+esc(a.name)+' prioritert?</summary><p>Fit '+a.fit.total+' av 100. Summen av fem komponenter, ingen KI-score.</p><ul>'+a.fit.parts.map(p=>'<li><b>'+p.pts+'/'+p.max+'</b> '+esc(p.label)+' <small>'+esc(p.basis)+'</small></li>').join('')+'</ul></details>'; return o; } }
  if(v==='idag'){ o.title='Spør om I dag'; o.chip='Hvorfor er dette prioritert?';
    try{ const Q=idQueue(), by={}; for(const i of Q.vis) by[i.rank]=(by[i.rank]||0)+1;
      o.why='<details class="ask-why" open><summary>Hvorfor er dette prioritert?</summary><p>Listen sorteres etter faste regler i denne rekkefølgen, ikke av KI.</p><ol>'+Object.entries(ID_RANKS).map(([r,t])=>'<li'+(by[r]?'':' class="dim"')+'>'+esc(t)+(by[r]?' <b>'+by[r]+'</b>':'')+'</li>').join('')+'</ol></details>'; }catch(e){} return o; }
  if(v==='marked'){ o.sc={t:'marked',orgId:'',dealId:''}; o.title='Spør om markedet'; o.chip='Forklar Solstads posisjon'; return o; }
  if(v==='prognose'){ o.title='Spør om mål og prognose'; o.chip='Hva må til for å nå målet?'; return o; }
  if(v==='kalender'){ o.title='Spør om kalenderen'; o.chip='Hvem passer for ledige datoer?'; return o; }
  if(v==='kontakter') o.title='Spør om kundene';
  return o;
}
function askHTML(){
  const K=UI.kn, c=askCtx();
  if(!K.turns.length&&!UI.askManual&&!knSame(c.sc,K.sc)){ K.sc=c.sc; K.sel=null; K.ask=null; K.note=''; }
  let h=V.kunnskap.html();
  h=h.replace(/<div class="kn-scope">([\s\S]*?)<\/div>(?=<div class="kn-tmp)/,(m,inner)=>'<details class="ask-adv" id="askAdv"'+(K.ask||UI.askAdv?' open':'')+'><summary>Omfang: <b>'+esc(knLabel(K.sc))+'</b></summary><div class="kn-scope">'+inner+'</div></details>');
  if(c.chip) h=h.replace(/(<div class="i3-ex"[^>]*>)/,'$1<button type="button" class="i3-q" data-knex="'+esc(c.chip)+'"><span>'+esc(c.chip)+'</span><i aria-hidden="true">→</i></button>');
  const diff=K.turns.length&&!knSame(c.sc,K.sc)?'<p class="ask-diff">Du er på en annen side nå. <button type="button" class="lnk" id="askSwitch">Start ny samtale om '+esc(knLabel(c.sc).replace(/^[^:]+: /,'').replace(/^Hele CRM-et$/,'porteføljen').replace(/^Markedskunnskap$/,'markedet'))+'</button></p>':'';
  return {h:diff+(K.turns.length?'':c.why)+h,c};
}
function askRender(){
  const P=$('#askPanel'), B=$('#askBody'); if(!P||!B||!UI.askOpen) return;
  const st=B.scrollTop, hadQ=document.activeElement&&document.activeElement.id==='knQ', pos=hadQ?document.activeElement.selectionStart:0;
  knInitSaved(); const r=askHTML(); $('#askSub').textContent=r.c.title; B.innerHTML=r.h; V.kunnskap.wire(B);
  B.scrollTop=st; if(hadQ){ const q=$('#knQ'); if(q&&!q.disabled){ q.focus({preventScroll:true}); try{ q.setSelectionRange(pos,pos); }catch(e){} } }
  $('#askAdv')?.addEventListener('toggle',e=>{ UI.askAdv=e.target.open; });
  B.querySelectorAll('[data-knt],#knOrg,#knDeal').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'click',()=>{ UI.askManual=true; },true));
  $('#askSwitch')?.addEventListener('click',()=>{ const c=askCtx(); knNew(c.sc,'Ny samtale.'); UI.askManual=false; askRender(); });
}
function askOpenPanel(sc,manual){
  const K=UI.kn;
  if(sc&&!knSame(sc,K.sc)){ const had=K.turns.length; knNew(sc,had?'Ny samtale. Den forrige samtalen er lagt til side og er ikke med i denne.':''); }
  UI.askManual=!!manual&&!!sc; UI.askOpen=true; $('#askPanel').hidden=false; document.body.classList.add('ask-open'); $('#askSalong')?.setAttribute('aria-expanded','true');
  askRender(); setTimeout(()=>{ const q=$('#knQ'); if(q&&!q.disabled) q.focus({preventScroll:true}); },30);
}
function askClose(){ UI.askOpen=false; UI.askManual=false; $('#askPanel').hidden=true; document.body.classList.remove('ask-open'); $('#askSalong')?.setAttribute('aria-expanded','false'); $('#askSalong')?.focus(); }
$('#askSalong')?.addEventListener('click',()=>{ if(UI.askOpen) askClose(); else askOpenPanel(); });
$('#askClose')?.addEventListener('click',askClose);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&UI.askOpen&&!UI.drawer&&!document.querySelector('.mt-md')) askClose(); });
{ const _g=go; go=function(v){ if(v==='kunnskap'){ if(!document.body.dataset.v) return _g.call(this,'idag'); askOpenPanel(); return; } const r=_g.apply(this,arguments); if(UI.askOpen) askRender(); return r; }; }
{ const _r=renderView; renderView=function(){ if(UI.view==='kunnskap') UI.view='idag'; const r=_r.apply(this,arguments); if(UI.askOpen) askRender(); return r; }; }
