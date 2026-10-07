/* ---------- drw.js: kompakt account-kort ----------
   Oversikt viser høyst seks rader: Hvorfor nå, Eventsignal, Anbefalt use-case og rom, Neste handling, Kontaktmål, Enrichment-status.
   Lange forklaringer, poengfordeling og råkilder ligger under Kilder. Kildefakta (hva kilden sier) og Salongs vurdering (avledet) vises aldri sammenblandet. */
function drwSignals(a){
  const today=mtToday(), L=bkSignals(a.enr).map(x=>({title:x.event_name||x.title||x.event_type||'Arrangement',type:x.event_type||x.type||'',date:String(x.date||'').slice(0,10),venue:x.venue||'',capacity:x.capacity||null,
    level:x.level==='Dokumentert'?'Dokumentert':'Indikasjon',url:x.source_url||x.source||'',sourceDate:x.source_date||x.sourceDate||''}));
  for(const x of (a.evsig||[])) L.push({title:x.title||x.type||'Arrangement',type:x.type||'',date:String(x.date||'').slice(0,10),venue:x.venue||'',capacity:x.capacity||null,level:x.confidence==='high'?'Dokumentert':'Indikasjon',url:x.source||'',sourceDate:x.sourceDate||''});
  const up=L.filter(x=>x.date&&x.date>=today).sort((p,q)=>p.date.localeCompare(q.date)), past=L.filter(x=>x.date&&x.date<today).sort((p,q)=>q.date.localeCompare(p.date)), und=L.filter(x=>!x.date);
  return {all:up.concat(und,past),up,past,und}; }
function drwEnrLine(a){
  const j=a.job, s=bkState(j);
  if(s==='venter') return {t:j&&j.status==='running'?'Beriker nå …':j&&j.blocked?'Ikke startet. En kobling mangler':'Berik er satt i gang',k:'a'};
  if(!j) return {t:a.enr&&a.enr.enriched_at?'Research registrert '+bkDate(a.enr.enriched_at)+'. Ikke beriket med kontakter':'Ikke beriket ennå',k:''};
  const when=bkDateS(j.completed_at||j.requested_at), n=Number(j.contacts_found)||0;
  if(s==='feil') return {t:'Feilet '+when+(j.error?': '+j.error:''),k:'bad'};
  if(s==='klar') return {t:'Beriket '+when+(n?' · '+n+' kontakt'+(n===1?'':'er')+' funnet':''),k:'ok'};
  if(s==='vurdering') return {t:'Beriket '+when+(n?' · '+n+' kontakt'+(n===1?'':'er')+' funnet':'')+'. Trenger kontroll',k:'warn'};
  if(s==='ingen_kontakt') return {t:'Beriket '+when+'. Fant ingen relevant kontakt',k:'bad'};
  return {t:'Beriket '+when+'. Grunnlaget var for tynt',k:'bad'}; }
function bkOversikt(a){
  const sg=drwSignals(a), best=sg.up[0]||sg.und[0]||sg.past[0], rm=a.room, pr=mtPrimary(a), enr=drwEnrLine(a), usec=MT_USECASE[a.segId]||'';
  const why=(a.why?'<p>'+esc(a.why)+'</p>':'<p class="bk-e">Ingen vurdering registrert.</p>')+(sg.up[0]?'<p class="mt-hint">Neste dokumenterte arrangement: '+esc(bkDateS(sg.up[0].date))+'.</p>':'');
  const evh=best?'<p><b>'+esc(best.title.length>90?best.title.slice(0,89)+'…':best.title)+'</b> <em class="bk-lv '+best.level.toLowerCase()+'">'+best.level+'</em></p><p class="mt-hint">'+[best.date?bkDate(best.date):'dato ikke oppgitt',best.venue,best.capacity?best.capacity+' deltakere':''].filter(Boolean).map(esc).join(' · ')+
    (best.url?' · <a href="'+esc(bkLink(best.url))+'" target="_blank" rel="noopener">'+esc(mtHost(best.url))+'</a>':'')+(sg.all.length>1?' · <button type="button" class="lnk" data-bkt="kil">+'+(sg.all.length-1)+' til</button>':'')+'</p>':(a.ev.level!=='Unknown'?'<p>'+esc(a.ev.note||'Arrangementsaktivitet registrert')+' <em class="bk-lv '+bkLvlL(a.ev.level).toLowerCase()+'">'+bkLvlL(a.ev.level)+'</em></p><p class="mt-hint">'+a.ev.sources.slice(0,2).map(x=>x.url?'<a href="'+esc(bkLink(x.url))+'" target="_blank" rel="noopener">'+esc(x.label||mtHost(x.url))+'</a>':esc(x.label)).join(' · ')+'</p>':'<p class="bk-e">Ingen eventsignal registrert.</p>');
  const rmh=rm.value==='Ukjent'?'<p class="bk-e">Romfit er ikke vurdert.'+(usec?' Typisk bruk: '+esc(usec.toLowerCase())+'.':'')+'</p>':'<p><b>'+esc(rm.label||rm.value)+'</b>'+(usec?' · '+esc(usec.toLowerCase()):'')+'</p><p class="mt-hint">'+esc(String(rm.basis||'').replace(/\s*Solstad har 320 plasser i stolrader\.?/,'').slice(0,160))+'</p>';
  const nxh='<p><b>'+esc(a.nx.t)+'</b>'+(a.nx.due?' · '+esc(mtFd(a.nx.due)):'')+'</p>';
  const best_=a.active[0], ct=best_?'<p><b>'+esc(best_.name)+'</b> · '+esc(best_.title||'stilling ikke oppgitt')+'</p><p class="mt-hint">'+(best_.email?'E-post oppgitt':'Mangler e-post')+' · <button type="button" class="lnk" data-bkt="kon">Se kontakter ('+a.persons.length+')</button></p>':
    '<p><b>'+esc((a.roles||[]).slice(0,3).join(', ')||'Ingen rolle valgt')+'</b></p>'+(a.persons.length?'<p class="mt-hint">'+a.persons.length+' kandidat'+(a.persons.length>1?'er':'')+' må vurderes. <button type="button" class="lnk" data-bkt="kon">Åpne</button></p>':'');
  const R=(h,b)=>'<section class="ov-r"><h3>'+h+'</h3><div>'+b+'</div></section>';
  return '<div class="ov">'+R('Hvorfor nå',why)+R('Eventsignal',evh)+R('Anbefalt use-case og rom',rmh)+R('Neste handling',nxh)+R('Kontaktmål',ct)+
    R('Enrichment','<p class="ov-s '+enr.k+'">'+esc(enr.t)+'</p>'+(!bkActive(a.job)&&!a.flags.disqualified&&!a.dncAcc&&a.nx.k!=='deal'?'<p><button type="button" class="btn sm" data-bk="berik">'+(a.job?'Berik på nytt':'Berik')+'</button></p>':''))+'</div>'; }
/* poengfordeling og kildefakta under Kilder */
const _drwK=bkKilder;
bkKilder=function(a){
  const ev=a.evsum||null, prov=a.prov||null;
  const fit='<details class="bk-fit"><summary>Hvorfor fit '+a.fit.total+'?</summary><table class="mt-ft">'+a.fit.parts.map(x=>'<tr><td>'+esc(x.label)+'<small>'+esc(x.basis)+'</small></td><td class="n"><b>'+x.pts+'</b>/'+x.max+'</td></tr>').join('')+'</table><p class="mt-hint">Åpen sum av seks regler. Ingen KI-score. Poeng uten grunnlag gis ikke.</p></details>';
  const facts=(a.about||ev||prov)?'<section class="bk-s"><h3>KILDEFAKTA</h3><p class="mt-hint">Det kildene sier. Salongs vurdering står i Oversikt.</p>'+(a.about?'<p>'+esc(a.about)+'</p>':'')+
    (ev&&ev.summary?'<dl class="mt-ok"><dt>Eventaktivitet</dt><dd>'+esc(ev.summary)+'</dd>'+(ev.types&&ev.types.length?'<dt>Typer</dt><dd>'+esc(ev.types.join(', '))+'</dd>':'')+(ev.frequency?'<dt>Frekvens</dt><dd>'+esc(ev.frequency)+'</dd>':'')+(ev.attendance?'<dt>Deltakere</dt><dd>'+esc(ev.attendance)+(ev.attendanceSource?' <small>(kilde: '+esc(String(ev.attendanceSource).slice(0,90))+')</small>':'')+'</dd>':'')+(ev.venues&&ev.venues.length?'<dt>Venues</dt><dd>'+esc(ev.venues.join(', '))+'</dd>':'')+(ev.open&&ev.open!=='ukjent'?'<dt>Åpent/lukket</dt><dd>'+esc(ev.open)+'</dd>':'')+'</dl>':'')+
    (prov?'<p class="mt-hint">Funnet i research '+esc(bkDate(prov.researchedAt))+'. Kilder: '+(prov.sources||[]).map(s=>'<a href="'+esc(bkLink(s.url))+'" target="_blank" rel="noopener">'+esc(mtHost(s.url))+'</a>').join(', ')+'.</p>':'')+'</section>':'';
  return _drwK(a)+facts+'<section class="bk-s">'+fit+'</section>'; };
/* toppen av kortet: organisasjon, segment, fit, status, ansvarlig */
const _drwDH=mtDrawerHTML;
mtDrawerHTML=function(a){ const h=_drwDH(a); const st=MT_STAT[a.status]||''; return h.replace(/(<span class="o">)([^<]*)(<\/span>)/,(m,x,y,z)=>x+y+(st?' · '+esc(st):'')+' · '+esc(a.ownerId?ownName(a.ownerId):'Ufordelt')+z); };
