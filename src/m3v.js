/* ---------- Marked og posisjon: visual first ---------- */
function m3Over(){
  const s=m3Stats(), F=s.F, D=mpModel(), G=mpWidth(), M=UI.mp, pr=mpPrice(F,'room'), cls=(F.capacities||{}).classroom;
  const W=Math.max(300,Math.min(960,(($('#view')||{}).clientWidth||1000)-40));
  const strip='<section class="m3-st" aria-label="Solstad i markedet"><h2 class="m3-eb">Solstad i markedet</h2><div class="m3-sg"><div><b>'+s.cap+'</b><span>stolplasser</span></div><div><b>'+(cls||'–')+'</b><span>klasserom</span></div><div><b>'+(F.area_m2||'–')+' m²</b><span>areal</span></div><div class="'+(pr.y==null?'m3-np':'')+'"><b>'+(pr.y==null?'Pris ikke satt':nf.format(pr.y)+' kr')+'</b><span>'+(pr.y==null?'ingen publisert pris':'romleie eks. mva')+'</span></div></div></section>';
  const sel=M.sel&&M.sel!==M.focus?mpV(M.sel):null, sr=sel?mpRow(sel):null;
  const selH=sel?'<p class="m3-sel"><b>'+esc(mpFull(sel))+'</b> · '+(sr.cap!=null?nf.format(sr.cap)+' plasser':'kapasitet ikke oppgitt')+' · '+esc(sr.y!=null?mpPriceShort(sr):sr.why)+' · '+sr.nF+' av 6 leveranseområder <button type="button" class="lnk" id="mpBack">Fjern</button></p>':'';
  const chart='<section class="m3-sec m3-chart"><div class="m3-sech"><h2>Størrelse og pris</h2><span class="note">Punktets størrelse viser hvor mange av seks leveranseområder som er dokumentert, ikke kvalitet.</span></div>'+
    (pr.y==null?'<p class="m3-pn">Solstad har ingen satt pris. Høyden på punktet kan derfor ikke bestemmes, og Solstad vises i raden uten pris.</p>':'')+mpLegend(D)+mpChart(D,W)+selH+'</section>';
  const near=mpNear(F,4), nearH='<section class="m3-sec"><div class="m3-sech"><h2>Nærmeste sammenlignbare</h2></div><ul class="m3-nr">'+near.map(o=>{ const r=mpRow(o.v); return '<li><button type="button" data-mpv="'+esc(o.v.id)+'"><b>'+esc(mpLabel(o.v))+'</b><span>'+nf.format(o.cap)+' plasser <small>'+mpDiffTxt(o.d)+'</small></span><span>'+esc(r.y!=null?mpPriceShort(r):'Pris ikke funnet')+'</span><span>'+r.nF+' av 6 dokumentert</span></button></li>'; }).join('')+'</ul></section>';
  const ins=[
   ['Størrelse',s.cap+' plasser i stolrader, nr '+s.rank+' av '+s.nCap+'. '+(s.bigger.length?'Bare '+s.bigger.length+' eksterne lokaler er større.':'Ingen eksterne lokaler er større.'),F.source_ids],
   ['Pris',pr.y==null?'Ikke satt. '+s.room.length+' av '+s.ext.length+' eksterne har publisert romleie, '+s.day.length+' en dagpakke, og '+s.noPrice.length+' mangler brukbar pris.':nf.format(pr.y)+' kr eks. mva. '+s.room.length+' av '+s.ext.length+' eksterne har publisert romleie.',['lh_terms']],
   ['Leveranse',s.inc.length+' av seks områder er dokumentert som inkludert ('+(s.inc.map(x=>x.n.toLowerCase()).join(', ')||'ingen')+'). Eksterne dokumenterer typisk '+(s.medNf==null?'–':s.medNf)+' av seks.',F.source_ids]];
  const insH='<section class="m3-sec"><div class="m3-i3">'+ins.map(([t,b,src])=>'<article><h3>'+t+'</h3><p>'+esc(b)+'</p>'+(m3Src(src)?'<details class="m3-srcd"><summary>Kilder</summary><span class="m3-src">'+m3Src(src)+'</span></details>':'')+'</article>').join('')+'</div></section>';
  const C=u3Cover().T, W3=u3White().slice(0,3);
  const strong=['Størrelse: '+s.cap+' i stolrader, nr '+s.rank+' av '+s.nCap+' i utvalget.','Samlet flate: hele 4. etasje, med mulighet for 3. etasje.','Rigg og oppsett inngår normalt i leien, ifølge leievilkårene.'],
   weak=['Ingen publisert pris. Prisen må settes før den kan sammenlignes.','Teknikk, bemanning, strømming og servering er tillegg og må prises etter behov.','Åpner februar 2027. Ledighet og reservasjoner er ikke i grunnlaget.'],
   flekk=[...W3.map(k=>k.seg+': bare '+k.allWorked+' av ca. '+k.est+' bearbeidet, passform '+k.sf+'.'),s.noPrice.length+' eksterne lokaler mangler brukbar pris.'];
  const list=(c,t,L)=>'<section class="m3-box '+c+'"><h3>'+t+'</h3><ul>'+L.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></section>';
  const full='<details class="m3-an"><summary>Vis analyse</summary><div class="m3-cols">'+list('good','Styrker',strong)+list('bad','Svakheter',weak)+list('gap','Hvite flekker',flekk)+'</div>'+
   '<p class="m3-tx"><b>Etterspørsel i eget CRM.</b> '+(s.sd.length?s.sd.length+' saker gjelder Solstad: '+s.won.length+' bekreftet og '+s.open.length+' åpne. Det er for tidlig til å si noe sikkert om segmentene.':'Ingen saker gjelder Solstad ennå.')+'</p>'+
   '<p class="m3-tx"><b>Hele 4. etasje.</b> Begge fløyer brukes ved '+s.cap+' i stolrader, og 3. etasje kan leies i tillegg. Separate flater må vurderes i hvert tilfelle.</p>'+
   '<p class="m3-tx"><b>Verdigrunnlag.</b> '+esc(LH_VERDI.vis)+' <span class="note">'+esc(LH_VERDI.note)+'</span></p>'+
   '<div class="row m3-go"><button type="button" class="btn ghost" data-mktab="segmentfit">Segmentfit og prioritering</button><button type="button" class="btn ghost" data-mktab="sammenlign">Sammenlign med alternativene</button></div></details>';
  return '<div class="m3">'+strip+chart+nearH+insH+full+'<p class="note m3-ft">Utvalg på '+MKSEED.venues.length+' lokaler, kontrollert '+esc(fdt(MKSEED.checked_on))+'. Publiserte referanser, ikke hele markedet. <button type="button" class="lnk" data-m3ask="marked">Spør Salong om markedet</button></p></div>';
}
{ const _w=V.marked.wire; V.marked.wire=function(v){ _w.apply(this,arguments); if(UI.mk.tab==='oversikt') mpWire(v); }; }
window.addEventListener('resize',()=>{ clearTimeout(m3Over.t); m3Over.t=setTimeout(()=>{ if(UI.view==='marked'&&UI.mk.tab==='oversikt'&&!focusedIn($('#view'))) renderView(true); },160); });
