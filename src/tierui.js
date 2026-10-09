/* ---------- Tier: Prioritet-fanen, tier i lister og i kontokortet ---------- */
UI.tp={p2:40,p3:25};
const ptChip=a=>a&&a.pt?'<span class="tp-c t'+a.pt+'" title="'+esc(tierHumanWhy(a))+'">'+tierShort(a.pt)+'</span>':'<span class="tp-c t0">–</span>';
const tierKr=n=>(Number(n)||0).toLocaleString('nb-NO',{maximumFractionDigits:0});
/* Presenter prioritering i vanlig språk; intern poengberegning beholdes i tier.js. */
function tierHumanWhy(a){
  if(!a||!a.pt) return 'Ikke prioritert for kontakt nå.';
  const profile=a.cult>=3?'Sterk tilknytning til litteratur og kultur':
    a.cult===2?'Relevant for formidling og arrangementer':
    a.cult===1?'Kan være aktuell for møter og arrangementer':
    'Kan være aktuell ved et konkret arrangementsbehov';
  const rel=(a.rel==='kunde'||a.rel==='fast')?'har leid hos oss tidligere':
    a.hasDialog?'vi har hatt kontakt tidligere':'';
  return profile+(rel?' · '+rel:'')+'.';
}
function tierPhase(){ const T=tierCfg(), today=mtToday(); const toS=mtDays(today,T.start), toE=mtDays(today,T.end), tot=Math.max(1,mtDays(T.start,T.end));
  const fdl=d=>fd(d,{day:'numeric',month:'short',year:'numeric'});
  let st,line;
  if(toS>0){ st='før'; line='Fase 1 starter '+fdl(T.start)+' (om '+toS+' dager) og varer til '+fdl(T.end); }
  else if(toE>=0){ const d=mtDays(T.start,today); st='i'; line='Fase 1 pågår: uke '+Math.min(Math.ceil((d+1)/7),Math.ceil(tot/7))+' av '+Math.ceil(tot/7)+' · '+toE+' dager igjen til '+fdl(T.end); }
  else { st='etter'; line='Fase 1 ble avsluttet '+fdl(T.end); }
  return {st,line,toS,toE,tot}; }
function tierRow(a,why){
  return '<tr data-mtacc="'+esc(a.id)+'" tabindex="0"><td class="mt-o"><b>'+esc(a.name)+'</b>'+(why?'<small>'+esc((a.cultCore?'Tydelig litteratur- og kulturprofil':a.cultHit?'Kulturord i beskrivelsen':tierD().lbl[a.cult])+(a.rel==='kunde'||a.rel==='fast'?' · har leid hos oss':''))+'</small>':'')+'</td><td>'+esc(mtSegLabel(a))+'</td>'+
   '<td class="n"><span class="tp-k k'+a.cult+'" title="'+esc(tierD().lbl[a.cult])+'">'+(a.cult>=3?'Sterk':a.cult===2?'Relevant':a.cult===1?'Mulig':'Lav')+'</span></td><td class="n"><button type="button" class="mt-fit" data-mtfit="'+esc(a.id)+'" aria-label="Match for '+esc(a.name)+': '+a.fit.total+' av 100. Vis grunnlaget">'+a.fit.total+'</button></td>'+
   '<td>'+mtStChip(a.status)+'</td><td class="mt-nc">'+mtNextCell(a)+'</td><td><select class="in fsel tp-sel" data-tpset="'+esc(a.id)+'" aria-label="Tier for '+esc(a.name)+'"><option value="1"'+(a.pt===1?' selected':'')+'>Tier 1</option><option value="2"'+(a.pt===2?' selected':'')+'>Tier 2</option><option value="3"'+(a.pt===3?' selected':'')+'>Tier 3</option></select></td></tr>'; }
function tierTable(L,why){ return '<div class="tbl mt-tw"><table class="mt-t tp-t"><thead><tr><th>Organisasjon</th><th>Segment</th><th class="n">Profil</th><th class="n">Match</th><th>Status</th><th>Neste steg</th><th>Tier</th></tr></thead><tbody>'+L.map(a=>tierRow(a,why)).join('')+'</tbody></table></div>'; }
function tierPriHTML(){
  const T=tierCfg(), D=tierD(), St=tierStats(), Bu=tierBudget(), P=tierPhase(), U=UI.tp;
  const all=mtAll().filter(a=>a.pt&&ownMatch(a.ownerId)&&match(UI.q,a.name,a.domain));
  const by=n=>all.filter(a=>a.pt===n).sort((x,y)=>y.ptRaw-x.ptRaw||x.name.localeCompare(y.name,'nb'));
  const L1=by(1), L2=by(2), L3=by(3);
  if(!mtAll().length) return '<div class="es"><h3>Ingen accounts ennå</h3><p>Legg til accounts via Mer, Market Scout eller Legg til account, så sorteres de i Tier 1, 2 og 3 her.</p></div>';
  const sumShare=[1,2,3].reduce((s,n)=>s+(Number(T.split[n])||0),0);
  const rows=[1,2,3].map(n=>{ const s=St[n], b=Bu[n]; const act=s.share==null?'–':Math.round(s.share*100)+' %';
    return '<tr><td><span class="tp-c t'+n+'">Tier '+n+'</span> <b>'+D.tiers[n].t+'</b><small>'+esc(D.tiers[n].d)+'</small></td><td class="n">'+s.n+'</td><td class="n"><input class="in tp-in" type="number" min="0" max="100" step="5" value="'+(Number(T.split[n])||0)+'" data-tpsplit="'+n+'" aria-label="Andel av tiden for Tier '+n+' i prosent"> %</td>'+
     '<td class="n">'+(Math.round(b.hours*10)/10).toLocaleString('nb-NO')+' t</td><td class="n">'+b.perWeek+(n===1?' kontakter':n===2?' samtaler':' e-poster')+'</td><td class="n">'+s.contacted+' av '+s.n+'</td><td class="n">'+act+'</td></tr>'; }).join('');
  const budget='<section class="mt-sec"><div class="mt-sh"><h3>Tidsfordeling</h3><span class="mt-hint">Anslag ut fra '+D.tiers[1].min+', '+D.tiers[2].min+' og '+D.tiers[3].min+' minutter per kontakt. Faktisk andel veier samtale 1, e-post 0,25 og møte 3.</span></div>'+
   '<div class="tp-hr"><label class="f"><span>Timer per uke til oppsøkende salg</span><input class="in tp-in" type="number" min="1" max="60" step="1" value="'+T.hours+'" data-tphours="1"></label>'+(sumShare!==100?'<span class="mt-note warn">Andelene summerer til '+sumShare+' %, ikke 100 %.</span>':'')+'</div>'+
   '<div class="tbl mt-tw"><table class="mt-t tp-b"><thead><tr><th>Tier</th><th class="n">Accounts</th><th class="n">Mål for tid</th><th class="n">Timer/uke</th><th class="n">Anslag per uke</th><th class="n">Kontaktet siste 14 d</th><th class="n">Faktisk andel (4 uker)</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  const t1='<section class="mt-sec"><div class="mt-sh"><h3>Tier 1: toppmål <span class="mt-cnt">'+L1.length+' av maks '+T.cap1+'</span></h3><span class="mt-hint">Litteratur og kultur først. Her bruker du mest energi. Klikk en rad for kontokortet.</span></div>'+(L1.length?tierTable(L1,true):'<p class="mt-hint">Ingen toppmål ennå. De mest relevante virksomhetene vises her når de er vurdert.</p>')+'</section>';
  const t2='<section class="mt-sec"><div class="mt-sh"><h3>Tier 2: ring <span class="mt-cnt">'+L2.length+'</span></h3><span class="mt-hint">Rundt '+(T.split[2]||0)+' % av tiden. Telefon først, så e-post.</span></div>'+(L2.length?tierTable(L2.slice(0,U.p2),false)+(L2.length>U.p2?'<div class="row" style="justify-content:center"><button type="button" class="btn sm" data-tpmore="2">Vis flere ('+(L2.length-U.p2)+' igjen)</button></div>':''):'<p class="mt-hint">Ingen accounts i Tier 2.</p>')+'</section>';
  const nMail=L3.filter(a=>mtCanEnroll(a).ok&&!a.prog).length;
  const t3='<section class="mt-sec"><div class="mt-sh"><h3>Tier 3: e-post <span class="mt-cnt">'+L3.length+'</span></h3><span class="mt-hint">Nice to have. Hoveddelen går som automatisk e-postsekvens.</span></div>'+
   '<p class="tp-t3"><b>'+nMail+'</b> av '+L3.length+' er klare for e-postsekvens (har kontaktperson med e-post og er ikke i en sekvens). <button type="button" class="btn sm" data-tsopenseq="1">Åpne masseutsendelse</button></p>'+
   (L3.length?'<details class="ts-dt"><summary>Vis Tier 3-listen</summary>'+tierTable(L3.slice(0,U.p3),false)+(L3.length>U.p3?'<div class="row" style="justify-content:center"><button type="button" class="btn sm" data-tpmore="3">Vis flere ('+(L3.length-U.p3)+' igjen)</button></div>':'')+'</details>':'')+'</section>';
  const ph='<div class="tp-ph '+P.st+'"><b>'+esc(P.line)+'</b><span>Prioriteringen er et utgangspunkt. Du kan flytte hver account mellom tierne, og det du setter selv står fast.</span></div>';
  return '<div class="tp">'+ph+budget+t1+t2+t3+'</div>'; }

/* kontokort: tier, begrunnelse og samtalestøtte */
function tierScript(a){
  const T=tierCfg(), use=MT_USECASE[a.segId], first=(a.active&&a.active[0]&&a.active[0].name||'').split(/\s+/)[0];
  const L=['Åpning: «Hei'+(first?' '+first:'')+', jeg heter '+(me.name||'…').split(/\s+/)[0]+' og har begynt hos Litteraturhuset. Vi har åpnet mer kapasitet, og jeg ville gjerne høre om dere planlegger noe i Oslo i 2027.»',
    'Spør: hva arrangerer dere, omtrent hvor mange kommer, og hvilken type: foredrag, lansering, seminar eller samtale?'+(use?' Typisk for dem: '+use.toLowerCase()+'.':''),
    'Invitasjon: «Det beste er å se stedet. Kan jeg vise dere rundt, gjerne på en halvtime?»',
    'Ingen stress: '+T.cancel,
    'Avslutt: avtal dato for visning eller når du ringer igjen, og logg samtalen i kontokortet.'];
  return '<ul class="tp-sc">'+L.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'; }
function tierDrawerBlock(a){
  if(!a||a.kind===undefined) return '';
  const D=tierD(), n=a.pt;
  return '<section class="tp-d"><div class="tp-dh">'+(n?'<span class="tp-c t'+n+'">Tier '+n+'</span> <b>'+esc(D.tiers[n].t)+'</b>':'<span class="tp-c t0">Ikke prioritert</span>')+
   '<label class="tp-dl">Prioritet <select class="in fsel tp-sel" data-tpset="'+esc(a.id)+'" aria-label="Endre prioritet for '+esc(a.name)+'"><option value="0"'+(a.ptAuto?' selected':'')+'>Følg anbefalingen</option><option value="1"'+(!a.ptAuto&&n===1?' selected':'')+'>Tier 1</option><option value="2"'+(!a.ptAuto&&n===2?' selected':'')+'>Tier 2</option><option value="3"'+(!a.ptAuto&&n===3?' selected':'')+'>Tier 3</option></select></label></div>'+
   '<p class="tp-summary">'+esc(tierHumanWhy(a))+'</p>'+
   '<details class="tp-dd tp-basis"><summary>Om prioriteringen</summary><p>'+
   (a.ptAuto?'Salong foreslår prioriteten ut fra virksomhetens profil og tidligere kontakt. Du kan endre den.':'Denne prioriteten er valgt manuelt og beholdes ved ny vurdering.')+
   '</p></details>'+(n&&n<=2?'<details class="tp-dd"><summary>Samtalestøtte</summary>'+tierScript(a)+'</details>':'')+'</section>'; }
{ const _tDH=mtDrawerHTML; mtDrawerHTML=function(a){ const h=_tDH(a); return h.replace('<div class="ov">',tierDrawerBlock(a)+'<div class="ov">'); }; }

/* hendelser: delegert, virker i både liste og kontokort */
if(!window.__tpWired){ window.__tpWired=1;
  document.addEventListener('change',async e=>{ const t=e.target; if(!t||!t.closest) return;
    const s=t.closest('[data-tpset]'); if(s){ const r=await tierSet(s.dataset.tpset,s.value); if(r&&r.err) toast(r.err); else toast(Number(s.value)?'Satt til Tier '+s.value:'Følger anbefalt prioritet'); renderView(true); try{ mtOverlay(true); }catch(_){} return; }
    const h=t.closest('[data-tphours]'); if(h){ await tierSave({hours:Math.max(1,Math.min(60,Number(h.value)||20))}); renderView(true); return; }
    const sp=t.closest('[data-tpsplit]'); if(sp){ await tierSave({split:{[sp.dataset.tpsplit]:Math.max(0,Math.min(100,Number(sp.value)||0))}}); renderView(true); return; } });
  document.addEventListener('click',e=>{ const t=e.target; if(!t||!t.closest) return; const m=t.closest('[data-tpmore]'); if(m){ UI.tp['p'+m.dataset.tpmore]+=40; renderView(true); return; } if(t.closest('[data-tsopenseq]')){ UI.mt.tab='seq'; renderView(true); } }); }
