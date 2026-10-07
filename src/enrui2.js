/* ---------- enrui2.js: Arbeidsliste, kontaktkort, Målmarked og I dag ----------
   Leser bare det tjenestelaget (enrsvc.js, enrrun.js) allerede har avledet: a.es (tilstand, kandidater, anbefalt kontakt, generell adresse),
   wfStepOf(a) (neste steg) og enrRunInfo() (jobblinje). Ingen egen forretningslogikk her.
   Visuelt: tre nivåer per rad (organisasjon / segment og signal / status og handling), grønt for positivt, gult for vurdering,
   rødt bare for ekte systemfeil. Teknisk feiltekst ligger bak «Vis teknisk feil». */
Object.assign(MT_STAT,{researched:'Researchet',kready:'Kontakt klar',cand:'Kandidat funnet',data:'Kontaktdata',chosen:'Kontakt valgt'});
const CDU_KIND={team:'Teamside',organizer:'Arrangør eller kontakt',speaker:'Taler (ansatt)',press:'Pressekontakt',linkedin:'LinkedIn',apollo:'Apollo'};
const awTone=t=>t==='mute'?'mute':t||'';

/* ---------- Arbeidsliste og accountliste: samme seks kolonner ---------- */
const AW_ORDER=[['now','HANDLE NÅ'],['ready','KONTAKT KLAR'],['review','TRENGER VURDERING'],['none','INGEN KONTAKT FUNNET'],['run','RESEARCH PÅGÅR'],['need','TRENGER RESEARCH'],['block','BLOKKERT'],['wait','I SEKVENS OG VENTER']];
function awGroup(a,today){ const n=a.nx, es=a.es||{};
  if(n.k==='reply'||n.k==='deal'||(n.due&&n.due<=today&&n.k!=='followup')) return 'now';
  if(a.prog||a.flags.addressed||['followup','step','seqdone','paused'].includes(n.k)) return 'wait';
  if(!a.flags.qualified&&!es.running) return 'need';
  return es.group||'need'; }
function awBadge(a){
  const es=a.es||{}, g=awGroup(a,mtToday());
  if(g==='now'||g==='wait') return [MT_STAT[a.status]||'',''];
  if(es.running) return ['Research pågår','a'];
  if(!a.flags.qualified&&!es.researched) return ['Ikke kvalifisert','mute'];
  if(a.active.length&&es.kready) return ['Kontakt klar','ok'];
  return [es.label||'',es.tone||'']; }
function awWhy(a){
  const L=bkSignals(a.enr);
  if(L.length) return enrSignalText(a);
  const w=String(a.why||'').replace(/\s+/g,' ').trim();
  return w?(w.length>100?w.slice(0,99)+'…':w):'Ikke dokumentert'; }
function awContact(a){
  const es=a.es||{}, act=a.active.filter(x=>!x.general), p=act[0]||a.active[0], b=awBadge(a);
  let who='';
  if(p) who='<b>'+esc(p.name)+'</b><small>'+esc(p.general?'Generell adresse':(p.title||'stilling ikke oppgitt'))+(act[1]?' · + '+esc(act[1].name):'')+'</small>';
  else if(es.rec) who='<b>'+esc(es.rec.p.name)+'</b><small>'+esc(es.rec.p.title||'stilling ikke oppgitt')+' · anbefalt</small>';
  else if(es.cands&&es.cands.length) who='<b>'+es.cands.length+' mulig'+(es.cands.length===1?' person':'e personer')+'</b><small>ingen anbefalt</small>';
  else if(es.general&&es.general.has&&es.researched) who='<small>Bare generell adresse</small>';
  else who='<small>'+esc(mtRoleText(a).replace(/^Ser etter: /,'Søker: '))+'</small>';
  return '<span class="aw-cn">'+who+(b[0]?'<span class="aw-st '+awTone(b[1])+'"><i></i>'+esc(b[0])+'</span>':'')+'</span>'; }
function awAct(a){
  const es=a.es||{}, k=a.nx.k, g=awGroup(a,mtToday()), id=esc(a.id);
  if(g==='now'||g==='wait') return '<span class="aw-nx'+(a.nx.late?' late':'')+'">'+esc(a.nx.t)+(a.nx.due?' <small>'+esc(mtFd(a.nx.due))+'</small>':'')+'</span><button type="button" class="btn sm" data-mtdo="'+id+'">'+mtActLabel(a)+'</button>';
  if(k==='research'||(!a.flags.qualified&&!es.running)) return '<button type="button" class="btn sm" data-mtdo="'+id+'">Kvalifiser</button>';
  if(es.running){ const j=a.job; return '<span class="aw-run"><i></i>'+esc((j&&j.stage)||ENR_ST[es.state].stage)+'</span>'; }
  if(es.pending) return '<button type="button" class="btn sm" data-cdquick="'+id+'">Bruk kontakt</button>';
  if(es.state==='ready') return '<button type="button" class="btn sm" data-mtdo="'+id+'">'+mtActLabel(a)+'</button>';
  if(es.state==='needs_review'||es.state==='partial') return '<button type="button" class="btn sm" data-awkon="'+id+'">Vurder kontakt</button>';
  if(es.state==='no_person_found') return '<button type="button" class="btn sm" data-awkon="'+id+'">Finn kontakt</button>';
  if(es.state==='provider_blocked'||es.state==='provider_error') return '<button type="button" class="btn sm" data-bkdo="'+id+'">Prøv igjen</button>';
  return '<button type="button" class="btn sm" data-bkdo="'+id+'">Berik</button>'; }
const AW_HEAD='<th>Organisasjon</th><th class="n">Fit</th><th>Hvorfor nå</th><th>Kontakt</th><th>Neste handling</th><th>Ansvarlig</th>';
function awTds(a,sel){
  const es=a.es||{}, meta=[mtSegLabel(a)+(a.prio?' · '+a.prio:'')].filter(Boolean).map(esc).join('');
  return '<td class="aw-o mt-o">'+(sel?'<input type="checkbox" class="bk-sel aw-ck" data-bksel="'+esc(a.id)+'" aria-label="Velg '+esc(a.name)+'"'+(ENR.sel.has(a.id)?' checked':'')+'>':'')+'<div><b>'+esc(a.name)+'</b><span class="aw-m">'+meta+'</span></div></td>'+
    '<td class="aw-f n"><button type="button" class="mt-fit" data-mtfit="'+esc(a.id)+'" aria-label="Fit '+a.fit.total+' av 100 for '+esc(a.name)+'. Vis komponenter">'+a.fit.total+'</button></td><td class="aw-w'+(awWhy(a)==='Ikke dokumentert'?' none':'')+'">'+esc(awWhy(a))+'</td><td class="aw-c">'+awContact(a)+'</td><td class="aw-n">'+awAct(a)+'</td><td class="aw-ow">'+ownChip(a.ownerId)+'</td>'; }
function awRow(a){ const es=a.es||{}, sel=!es.running&&!a.prog&&!a.flags.addressed; return '<tr class="aw-r" data-mtacc="'+esc(a.id)+'" tabindex="0">'+awTds(a,sel)+'</tr>'; }
function awJobLine(){
  const c=enrRunInfo(), fatal=ENR.fatal;
  if(!c&&!fatal) return '';
  if(!c) return '<div class="aw-job warn" role="status"><p><b>Tilgang må godkjennes.</b> '+esc(enrFatalText())+' <button type="button" class="lnk" data-enrretry="1">Prøv igjen</button></p></div>';
  const pct=Math.round(c.done/c.total*100), parts=[];
  if(c.ready) parts.push('<span class="ok"><b>'+c.ready+'</b> kontaktklare</span>');
  if(c.attention) parts.push('<span class="warn"><b>'+c.attention+'</b> trenger vurdering</span>');
  if(c.none) parts.push('<span class="mute"><b>'+c.none+'</b> fant ingen relevant person</span>');
  const blocked=c.blocked?'<span class="warn">'+c.blocked+' venter på tilgang · <button type="button" class="lnk" data-enrretry="1">Prøv igjen</button></span>':'';
  return '<div class="aw-job'+(c.live?' live':'')+'" role="status"><div class="aw-jt"><b>'+(c.live?'Beriker '+c.done+' av '+c.total:'Beriket '+c.done+' av '+c.total)+'</b>'+parts.join('')+blocked+(!c.live?'<button type="button" class="lnk aw-x" data-enrdismiss="'+esc(c.id)+'">Skjul</button>':'')+'</div>'+(c.live?'<div class="bk-bar" role="img" aria-label="'+pct+' prosent ferdig"><i style="width:'+pct+'%"></i></div>':'')+'</div>'; }
function mtArbHTML(){
  const L=mtWorking(), today=mtToday(), T=enrTargets(), live=L.some(a=>a.es&&a.es.running);
  const G={}; for(const a of L) (G[awGroup(a,today)]=G[awGroup(a,today)]||[]).push(a);
  const btn=T.sel?'<button type="button" class="btn primary" data-enrall="1">Berik valgte ('+T.n+')</button>':T.n?'<button type="button" class="btn primary" data-enrall="1">Berik hele batchen ('+T.n+')</button>':'<button type="button" class="btn" disabled>'+(live?'Beriker …':'Alle er beriket')+'</button>';
  const top='<div class="aw-top"><div class="aw-bt">'+btn+(T.n>1&&!T.sel?'<button type="button" class="lnk" data-awtop="20">Velg de 20 beste</button>':'')+(T.sel?'<button type="button" class="lnk" data-awtop="0">Fjern valg</button>':'')+'</div>'+ownFilterHTML('Vis arbeidslisten etter ansvarlig')+'</div>';
  if(!L.length) return '<p class="tab-sub">Kun accounts jeg skal gjøre noe med nå.</p>'+top+awJobLine()+'<div class="es"><h3>Ingen prospekter i arbeidslisten ennå</h3><p>Legg kvalifiserte accounts fra Målmarked i neste batch når arbeidet starter.</p><button type="button" class="btn" data-mttab="mal">Åpne Målmarked</button></div>';
  const cmp=(x,y)=>y.fit.total-x.fit.total||(y.es?y.es.sig:0)-(x.es?x.es.sig:0)||x.name.localeCompare(y.name,'nb');
  const body=AW_ORDER.map(([k,n])=>{ const g=G[k]; if(!g||!g.length) return ''; g.sort(k==='now'||k==='wait'?((x,y)=>(x.nx.due||'9').localeCompare(y.nx.due||'9')||cmp(x,y)):cmp);
    return '<tbody class="aw-g aw-g-'+k+'"><tr class="aw-gh"><th colspan="6"><span>'+n+'</span><em>'+g.length+'</em></th></tr>'+g.map(awRow).join('')+'</tbody>'; }).join('');
  return '<p class="tab-sub">Kun accounts jeg skal gjøre noe med nå.</p>'+top+awJobLine()+'<div class="aw-wrap"><table class="aw-t"><thead><tr>'+AW_HEAD+'</tr></thead>'+body+'</table></div>'; }
function bkContactCell(a){ return awContact(a); }
/* accountlisten i Målmarked: samme kolonner, ingen tekniske detaljer */
const _listBase=mtListHTML;
mtListHTML=function(){
  const html=_listBase(); const U=UI.mt, L=mtFiltered(), shown=L.slice(0,U.page*40); if(!L.length) return html;
  const i=html.indexOf('<div class="tbl mt-tw">'), j=html.indexOf('</table></div>',i); if(i<0||j<0) return html;
  const th=(k,t,c)=>mtTh(k,t,c);
  const tbl='<div class="tbl mt-tw aw-wrap"><table class="aw-t aw-list"><thead><tr>'+th('name','Organisasjon')+th('fit','Fit','n')+'<th>Hvorfor nå</th><th>Kontakt</th><th>Neste handling</th>'+th('own','Ansvarlig')+'</tr></thead><tbody class="aw-g">'+shown.map(a=>'<tr class="aw-r" data-mtacc="'+esc(a.id)+'" tabindex="0">'+awTds(a,false)+'</tr>').join('')+'</tbody></table></div>';
  return html.slice(0,i)+tbl+html.slice(j+'</table></div>'.length); };

/* ---------- kandidatkort ---------- */
function cdEvLinks(p){ const ev=(p.cd&&p.cd.ev)||[], seen=new Set(), out=[];
  for(const e of ev){ const k=e.k+'|'+e.url; if(seen.has(k)) continue; seen.add(k); const l=CDU_KIND[e.k]||e.k; out.push(e.url?'<a href="'+esc(bkLink(e.url))+'" target="_blank" rel="noopener">'+esc(l)+'</a>':esc(l)); }
  return out.join(' · '); }
function cdSrcLabel(p){ const ev=(p.cd&&p.cd.ev)||[], A=p.source==='Apollo'||ev.some(e=>e.k==='apollo'), W=ev.some(e=>e.k!=='apollo')||(p.source!=='Apollo'); return A&&W?'Apollo + nettside':A?'Apollo':'Nettside'; }
function cdCandHTML(a,x,mode){
  const p=x.p, s=x.s, ln=bkLink(p.linkedin), canPick=a.active.length<2, em=mtVerLabel(p,'email');
  const ch='<ul class="cd-ch"><li class="'+(p.email?'ok':'no')+'">'+(p.email?'<a href="mailto:'+esc(p.email)+'">E-post</a><small>'+esc(em.k==='ok'?'verifisert':'ikke verifisert')+'</small>':'E-post <em>mangler</em>')+'</li><li class="'+(p.phone?'ok':'no')+'">'+(p.phone?'<a href="tel:'+esc(String(p.phone).replace(/\s/g,''))+'">Telefon</a>':'Telefon <em>mangler</em>')+'</li><li class="'+(ln?'ok':'no')+'">'+(ln?'<a href="'+esc(ln)+'" target="_blank" rel="noopener">LinkedIn</a>':'LinkedIn <em>mangler</em>')+'</li></ul>';
  const why=s.why.length?'<p class="cd-w"><b>Hvorfor:</b> '+s.why.map(esc).join(' · ')+'</p>':'';
  const bad=s.bad.length?'<p class="cd-b"><b>Tvil:</b> '+s.bad.map(esc).join(' · ')+'</p>':'';
  const parts='<details class="cd-d"><summary>Poeng '+s.score+'</summary><ul>'+s.parts.map(y=>'<li><b>+'+y.pts+'</b> '+esc(y.t)+'</li>').join('')+s.neg.map(y=>'<li class="neg"><b>'+y.pts+'</b> '+esc(y.t)+'</li>').join('')+'</ul></details>';
  const src=cdEvLinks(p), q=p.quote?'<span class="cd-q">«'+esc(String(p.quote).slice(0,140))+'»</span>':'';
  return '<div class="cd-c'+(mode==='rec'?' rec':'')+'" data-cdp="'+esc(p.id)+'"><div class="cd-h"><b>'+esc(p.name)+'</b><span class="cd-t">'+esc(p.title||'Stilling ikke oppgitt')+'</span><span class="cd-sc" title="Score 0–100. Åpen sum av regler, ingen KI-score.">'+s.score+'</span></div>'+why+bad+ch+
    '<p class="cd-src">Kilde: '+cdSrcLabel(p)+(src?' · '+src:'')+(p.foundAt?' · funnet '+esc(bkDateS(p.foundAt)):'')+'</p>'+q+parts+
    '<div class="row cd-a"><button type="button" class="btn sm'+(mode==='rec'?' primary':'')+'" '+(canPick?'data-cdpick="'+esc(p.id)+'">Bruk kontakt':'data-cdswap="'+esc(p.id)+'" title="Maks to aktive kontakter. Bytter ut den siste.">Bytt med '+esc(a.active[a.active.length-1].name))+'</button><button type="button" class="btn ghost sm" data-cdno="'+esc(p.id)+'">Ikke riktig</button>'+
    (!p.email&&apolloProvider.isConnected()?'<button type="button" class="btn ghost sm" data-enrmail="'+esc(p.id)+'">Hent e-post (1 kreditt)</button>':'')+'</div></div>'; }
function cdGeneralHTML(a){
  const g=a.es.general; if(!g.has) return '<section class="bk-s"><h3>GENERELL KONTAKT</h3><p class="bk-e">Ingen generell adresse funnet ennå.</p></section>';
  const em=g.emails.map(e=>'<li><a href="mailto:'+esc(e.v)+'">'+esc(e.v)+'</a> <small>'+(e.kind==='generell'?'generell adresse':'rolleadresse')+(e.src==='profil'?' · fra profilen':'')+'</small></li>').join(''), ph=g.phones.map(p=>'<li><a href="tel:'+esc(p.replace(/\s/g,''))+'">'+esc(p)+'</a> <small>telefon</small></li>').join(''), url=g.url?'<li><a href="'+esc(bkLink(g.url))+'" target="_blank" rel="noopener">Kontaktside</a></li>':'';
  const used=a.active.some(p=>p.general);
  return '<section class="bk-s cd-gen"><h3>GENERELL KONTAKT</h3><p class="mt-hint">Ikke en person. Telles aldri som kontaktperson funnet.</p><ul class="cd-gl">'+em+ph+url+'</ul>'+(used?'<p class="mt-hint">Brukes som kontakt akkurat nå.</p>':!a.active.length&&(g.emails.length||g.phones.length)?'<div class="row"><button type="button" class="btn ghost sm" data-cdgen="1">Bruk hvis ingen person finnes</button></div>':'')+'</section>'; }

/* ---------- Kontakter-fanen ---------- */
function bkKontakter(a){
  const D=UI.mt.dr, es=a.es, R=es.rank, U=R.U, orgC=(a.profile&&a.profile.contact)||{};
  const goal='<section class="bk-s"><h3>ROLLER VI SER ETTER</h3><div class="mt-chips">'+a.roles.map(r=>'<span class="chip">'+esc(r)+'</span>').join('')+'</div>'+
    '<p class="mt-hint">Funksjoner som eier arrangement hos denne typen organisasjon: '+esc(U.summary)+'. '+esc(U.why.join('. '))+'.'+(U.notes.length?' '+esc(U.notes.join('. '))+'.':'')+'</p>'+(orgC.askFor?'<p class="mt-hint">Fra profilen: '+esc(orgC.askFor)+'</p>':'')+
    (D.edit==='roles'?'<div class="form"><label class="f full"><span>Ønsket kontaktrolle (skill med komma)</span><input class="in" id="mtRoles" value="'+esc(a.roles.join(', '))+'"></label></div><div class="row"><button type="button" class="btn sm primary" data-mtd="rolesave">Lagre</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div>':'<div class="row"><button type="button" class="btn ghost sm" data-mtd="rolesedit">Endre roller</button></div>')+'</section>';
  let cand='';
  if(es.running) cand='<section class="bk-s"><h3>KANDIDATER</h3><p class="aw-run"><i></i>'+esc((a.job&&a.job.stage)||'Research pågår')+'</p></section>';
  else if(R.rec){ const oth=R.others;
    cand='<section class="bk-s"><h3>ANBEFALT KONTAKT</h3>'+cdCandHTML(a,R.rec,'rec')+'</section>'+(oth.length?'<section class="bk-s"><details class="mt-oth"><summary>Andre kandidater ('+oth.length+')</summary>'+oth.map(x=>cdCandHTML(a,x,'oth')).join('')+'</details></section>':''); }
  else if(R.list.length) cand='<section class="bk-s"><h3>MULIGE PERSONER – VURDER</h3><p class="mt-hint">Ingen er trygge nok til å anbefales automatisk. Vurder selv, og velg om noen passer.</p>'+R.list.map(x=>cdCandHTML(a,x,'oth')).join('')+'</section>';
  else if(es.state!=='not_started') cand='<section class="bk-s"><h3>KANDIDATER</h3><p class="bk-e">'+esc(es.state==='provider_blocked'||es.state==='provider_error'?es.detail+'. Research er ikke fullført.':'Research fullført, men fant ingen trygg kontaktperson. Legg til noen manuelt, eller berik på nytt senere.')+'</p></section>';
  const act=a.persons.filter(p=>a.active.includes(p)).sort((x,y)=>a.active.indexOf(x)-a.active.indexOf(y)), oth=a.persons.filter(p=>!a.active.includes(p));
  const pers='<section class="bk-s"><h3>VALGT KONTAKT</h3>'+(act.length?'<p class="mt-hint">'+act.length+' aktive av maks 2.</p>'+act.map(p=>mtPersonHTML(a,p)).join(''):'<p class="bk-e">Ingen valgt ennå.</p>')+
    (oth.length?'<details class="mt-oth"'+(!act.length&&!R.list.length?' open':'')+'><summary>'+(act.length?'Flere personer':'Personer')+' ('+oth.length+')</summary>'+oth.map(p=>mtPersonHTML(a,p,true)).join('')+'</details>':'')+
    '<details class="mt-add"'+(D.addp?' open':'')+'><summary>Legg til person manuelt</summary><div class="form"><label class="f"><span>Navn</span><input class="in" id="mtPn"></label><label class="f"><span>Stilling</span><input class="in" id="mtPt"></label><label class="f"><span>E-post</span><input class="in" id="mtPe" type="email"></label><label class="f"><span>Telefon</span><input class="in" id="mtPp"></label><label class="f full"><span>LinkedIn</span><input class="in" id="mtPl"></label></div><div class="row"><button type="button" class="btn sm" data-mtd="addp">Legg til</button><span class="mt-hint">Lagres som «ikke verifisert, lagt inn manuelt».</span></div></details></section>';
  return goal+cand+cdGeneralHTML(a)+pers; }

/* ---------- Oversikt: hvorfor nå, bruk, kontakt. Alt teknisk ligger under Kilder ---------- */
function bkOversikt(a){
  const es=a.es, sg=drwSignals(a), best=sg.up[0]||sg.und[0]||sg.past[0], rm=a.room, usec=MT_USECASE[a.segId]||'', R=es.rank;
  const link=u=>u?' · <a href="'+esc(bkLink(u))+'" target="_blank" rel="noopener">'+esc(mtHost(u))+'</a>':'';
  let whyH=a.why?'<p>'+esc(a.why)+'</p>':'';
  if(best) whyH+='<p class="ov-ev"><b>'+esc(best.title.length>90?best.title.slice(0,89)+'…':best.title)+'</b> <em class="bk-lv '+best.level.toLowerCase()+'">'+best.level+'</em></p><p class="mt-hint">'+[best.date?bkDate(best.date):'dato ikke oppgitt',best.venue,best.capacity?best.capacity+' deltakere':''].filter(Boolean).map(esc).join(' · ')+link(best.url)+(sg.all.length>1?' · <button type="button" class="lnk" data-bkt="kil">+'+(sg.all.length-1)+' til</button>':'')+'</p>';
  else if(a.ev.level!=='Unknown') whyH+='<p class="mt-hint">'+esc(a.ev.note||'Arrangementsaktivitet registrert')+' <em class="bk-lv '+bkLvlL(a.ev.level).toLowerCase()+'">'+bkLvlL(a.ev.level)+'</em></p>';
  if(!whyH) whyH='<p class="bk-e">Ikke dokumentert.</p>';
  const rmh=rm.value==='Ukjent'?'<p class="bk-e">Ikke dokumentert.'+(usec?' Typisk bruk i segmentet: '+esc(usec.toLowerCase())+'.':'')+'</p>':'<p><b>'+esc(rm.label||rm.value)+'</b>'+(usec?' · '+esc(usec.toLowerCase()):'')+'</p><p class="mt-hint">'+esc(String(rm.basis||'').replace(/\s*Solstad har 320 plasser i stolrader\.?/,'').slice(0,160))+'</p>';
  const act=a.active.filter(p=>!p.general), g=a.active.find(p=>p.general), P=act[0]||g;
  const line=p=>'<p><b>'+esc(p.name)+'</b> · '+esc(p.general?'generell adresse':(p.title||'stilling ikke oppgitt'))+'</p><p class="mt-hint">'+(p.general?'Ikke en person':[p.email?'e-post':'',p.phone?'telefon':'',p.linkedin?'LinkedIn':''].filter(Boolean).join(', ')||'ingen kanal ennå')+'</p>';
  let ct;
  if(P) ct=line(P)+(act[1]?'<p class="ov-2">+ '+esc(act[1].name)+' · '+esc(act[1].title||'')+'</p>':'');
  else if(R.rec) ct='<p><b>'+esc(R.rec.p.name)+'</b> · '+esc(R.rec.p.title||'stilling ikke oppgitt')+' <span class="cd-sc">'+R.rec.score+'</span></p><p class="mt-hint">'+esc(R.rec.s.why.slice(0,2).join(' · '))+' · '+cdSrcLabel(R.rec.p)+'</p><div class="row"><button type="button" class="btn sm" data-cdpick="'+esc(R.rec.p.id)+'">Bruk kontakt</button><button type="button" class="btn ghost sm" data-cdno="'+esc(R.rec.p.id)+'">Ikke riktig</button><button type="button" class="lnk" data-bkt="kon">Se alle</button></div>';
  else if(R.list.length) ct='<p><b>'+R.list.length+' mulig'+(R.list.length===1?' person':'e personer')+'</b></p><p class="mt-hint">Ingen er trygge nok til å anbefales. <button type="button" class="lnk" data-bkt="kon">Vurder</button></p>';
  else ct='<p class="bk-e">'+(es.researched?'Ingen kontaktperson funnet.':'Ingen kontakt ennå.')+'</p><p class="mt-hint">Søker: '+esc((a.roles||[]).slice(0,3).join(', ')||'ingen rolle valgt')+(g?' · bare generell adresse funnet':'')+'</p>';
  const canRun=!es.running&&!a.flags.disqualified&&!a.dncAcc&&a.nx.k!=='deal';
  const needRun=es.state==='not_started'||es.state==='provider_blocked'||es.state==='provider_error'||es.running;
  const enh=needRun?'<p class="ov-s '+awTone(es.tone)+'"><b>'+esc(es.label)+'</b>'+(es.detail&&es.detail!==es.label?' · '+esc(es.detail):'')+'</p>'+(canRun?'<div class="row"><button type="button" class="btn sm" data-bk="berik">'+(es.state==='not_started'?'Berik':'Prøv igjen')+'</button></div>':''):'';
  const Rw=(h,b)=>'<section class="ov-r"><h3>'+h+'</h3><div>'+b+'</div></section>';
  return '<div class="ov">'+Rw('Hvorfor nå',whyH)+Rw('Anbefalt bruk',rmh)+Rw('Kontakt',ct)+(enh?Rw('Research',enh):'')+'</div>'; }

/* ---------- Kilder: berik-jobben viser tilstand, trinn og hva som kom fra hvilken kilde ---------- */
const CDU_STEPIC={done:'✓',skipped:'–',unavailable:'○',error:'!',running:'…',pending:'·'};
const CDU_GRP=[['A','Organisasjonsresearch',['company','apollo_org','events']],['B','Kontaktresearch',['people_web','rank','general']],['C','Kontaktdata',['people_apollo']]];
function cdJobHTML(a){
  const j=a.job, es=a.es; if(!j) return '<section class="bk-s"><h3>RESEARCH</h3><p class="bk-e">Ikke beriket ennå.</p><div class="row"><button type="button" class="btn sm" data-bk="berik">Berik</button></div></section>';
  const cd=(a.enr&&a.enr.cd)||null, steps=j.pipeline||[], hist=(j.history||[]).map(h=>(ENR_ST[h.s]?ENR_ST[h.s].l:h.s)+' '+bkDateS(h.at)).filter((x,i,A)=>A.indexOf(x)===i);
  const stepLi=s=>'<li class="'+esc(s.status)+'"><i>'+(CDU_STEPIC[s.status]||'·')+'</i><b>'+esc(s.label)+'</b><small>'+esc(s.detail)+'</small></li>';
  const grp=CDU_GRP.map(([k,n,ids])=>{ const L=steps.filter(s=>ids.includes(s.id)); return L.length?'<h4>'+k+'. '+n+'</h4><ul class="cd-steps">'+L.map(stepLi).join('')+'</ul>':''; }).join('');
  const canRun=!es.running&&!a.flags.disqualified&&!a.dncAcc&&a.nx.k!=='deal';
  return '<section class="bk-s"><h3>RESEARCH</h3><p class="ov-s '+awTone(es.tone)+'"><b>'+esc(es.label)+'</b>'+(es.detail&&es.detail!==es.label?' · '+esc(es.detail):'')+'</p>'+(es.apollo&&!es.running?'<p class="mt-hint">'+esc(es.apollo)+'</p>':'')+
    (j.completed_at?'<p class="mt-hint">Sist kjørt '+esc(bkDate(j.completed_at))+(j.requested_by?' · '+esc(j.requested_by):'')+'</p>':'')+(canRun?'<div class="row"><button type="button" class="btn sm" data-bk="berik">Berik på nytt</button></div>':'')+grp+
    '<details class="cd-tech cd-det"><summary>Detaljer</summary>'+(cd&&cd.summary?'<p class="mt-hint">Funksjoner søkt: '+esc(cd.summary)+'</p>':'')+(cd&&cd.rounds&&cd.rounds.length?'<p class="mt-hint">Runder: '+cd.rounds.map(r=>'runde '+r.n+': '+r.found+' nye, '+r.plaus+' plausible').join(' · ')+(cd.stop==='enough'?' · stoppet: nok kandidater':cd.stop==='budget'?' · stoppet: søkebudsjett brukt':'')+'</p>':'')+
    (hist.length>1?'<p class="mt-hint">Forløp: '+hist.map(esc).join(' → ')+'</p>':'')+(j.result_version?'<p class="mt-hint">Resultatversjon '+esc(j.result_version)+'</p>':'')+(es.errs.length?'<ul>'+es.errs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+'</details></section>'; }
const _kilBase=bkKilder;
bkKilder=function(a){ const h=_kilBase(a); const re=/<section class="bk-s"><h3>BERIK-JOBB<\/h3>[\s\S]*?<\/section>/; return re.test(h)?h.replace(re,()=>cdJobHTML(a)):h+cdJobHTML(a); };

/* ---------- handlinger ---------- */
async function cdPick(pid){
  const p=S.mtper[pid]; if(!p) return; const a=mtGet(p.accId); if(!a) return;
  if(a.active.length>=2){ toast('Maks to aktive kontakter. Fjern en først.'); return; }
  await mtSetPerson(pid,{rel:'ja',active:true,pickedAt:iso(new Date())}); await mtPatch(p.accId,{},'Kontakt valgt: '+p.name); toast(p.name+' er valgt som kontakt.'); }
async function cdSwap(pid){ const p=S.mtper[pid]; if(!p) return; const a=mtGet(p.accId); if(!a||!a.active.length) return cdPick(pid); const out=a.active[a.active.length-1]; await mtSetPerson(out.id,{active:false,rel:'?'}); await cdPick(pid); }
async function cdDismiss(pid){ const p=S.mtper[pid]; if(!p) return; await mtSetPerson(pid,{rel:'nei',active:false}); await mtPatch(p.accId,{},'Kandidat ikke relevant: '+p.name); }
async function cdUseGeneral(accId){
  const a=mtGet(accId); if(!a||a.active.length) return; const g=a.es.general, em=g.emails[0]&&g.emails[0].v||'', ph=g.phones[0]||'';
  const r=await mtAddPerson(accId,{name:'Generell adresse',title:'Ikke en person',email:em,phone:em?'':ph,source:'Web',provider:'web',sourceUrl:g.url||'',rel:'ja',active:true,confidence:'generell'});
  if(r.id){ await mtSetPerson(r.id,{general:true}); toast('Generell adresse brukes som kontakt. Den teller ikke som person funnet.'); } else toast(r.err||'Kunne ikke lagre.'); }
const _enrWire2=V.prosp.wire; V.prosp.wire=function(v){ _enrWire2(v);
  v.querySelectorAll('[data-enrall]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await enrRunAll(); }));
  v.querySelectorAll('[data-enrdismiss]').forEach(b=>b.addEventListener('click',()=>{ ENR.dismissed=b.dataset.enrdismiss; renderView(true); }));
  v.querySelectorAll('[data-cdquick]').forEach(b=>b.addEventListener('click',async e=>{ e.stopPropagation(); b.disabled=true; const a=mtGet(b.dataset.cdquick); if(a&&a.es&&a.es.rec) await cdPick(a.es.rec.p.id); }));
  v.querySelectorAll('[data-awtop]').forEach(b=>b.addEventListener('click',()=>{ const n=+b.dataset.awtop; ENR.sel.clear(); if(n){ enrTargets().ids.map(mtGet).filter(Boolean).sort((x,y)=>y.fit.total-x.fit.total).slice(0,n).forEach(a=>ENR.sel.add(a.id)); } renderView(true); }));
  v.querySelectorAll('[data-awkon]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); mtOpen(b.dataset.awkon); UI.mt.dr.tab='kon'; mtOverlay(true); })); };
const _enrWD2=mtWireDrawer; mtWireDrawer=function(root,a){ _enrWD2(root,a);
  root.querySelectorAll('[data-cdpick]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await cdPick(b.dataset.cdpick); }));
  root.querySelectorAll('[data-cdswap]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await cdSwap(b.dataset.cdswap); }));
  root.querySelectorAll('[data-cdno]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await cdDismiss(b.dataset.cdno); }));
  root.querySelectorAll('[data-cdgen]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await cdUseGeneral(a.id); }));
  root.querySelectorAll('[data-mtd="kon"]').forEach(b=>b.addEventListener('click',()=>{ UI.mt.dr.tab='kon'; mtOverlay(true); })); };

/* ---------- Målmarked: kontaktdekning i ti trinn og tydelige P0/P1/P2 ---------- */
const COV_FN=[['discovered','Identifisert','Organisasjoner med kilde i Salong'],['qualified','Kvalifisert','Passer målmarkedet og har en begrunnelse'],['researched','Researchet','Organisasjon og arrangementer er undersøkt'],['kready','Kontakt klar','Relevant person med minst én kanal og en kilde'],['addressed','Adressert','Første touch er logget'],['engaged','Dialog','Svar eller møte'],['opportunity','Mulighet','Åpen sak']];
function covFunnel(st){
  const on=k=>UI.mt.stat===k, max=Math.max(1,st.discovered), q=st.qualified||0;
  return '<section class="mt-sec cv-fw"><div class="mt-sh"><h3>Kontaktdekning</h3><span class="mt-hint">Fra identifisert til mulighet. Klikk et trinn for å filtrere listen.</span></div><div class="cv-fn2" role="group" aria-label="Kontaktdekning">'+COV_FN.map(([k,n,d],i)=>{ const v=st[k]||0, sub=i<2?'':(q?Math.round(v/q*100)+' % av kvalifiserte':'–');
    return '<button type="button" class="cv-fr'+(on(k)?' on':'')+''+'" data-mtstat="'+k+'" aria-pressed="'+on(k)+'" title="'+esc(d)+'"><span class="cv-fl">'+esc(n)+'<small>'+esc(d)+'</small></span><span class="cv-fb"><i style="width:'+Math.max(v?2:0,Math.round(v/max*100))+'%"></i></span><b>'+v+'</b><small>'+sub+'</small></button>'; }).join('')+'</div></section>'; }
function covSegTable(){
  const S_=mtSegStats(), est=covEst(), groups=[['P0','P0 – FØRSTE PRIORITET'],['P1','P1 – NESTE'],['P2','P2 – SENERE']];
  const row=s=>{ const e=est[s.id], has=e!=null&&e!=='', unk=has?Math.max(0,e-s.discovered):null, sel=UI.mt.seg===s.id;
    return '<tr class="cv-r cv-r-'+esc(s.prio)+(sel?' on':'')+(s.on===false?' off':'')+'" data-mtsegf="'+esc(s.id)+'" tabindex="0" aria-pressed="'+sel+'"><th scope="row"><b>'+esc(mtSegShort(s.name))+'</b></th>'+
      '<td class="n cv-e"><input class="in cv-ei" type="number" min="0" step="5" inputmode="numeric" data-cvest="'+esc(s.id)+'" value="'+(has?e:'')+'" placeholder="–" aria-label="Estimert marked for '+esc(mtSegShort(s.name))+' (ditt anslag)">'+(has&&unk?'<small>ukartlagt ca. '+unk+'</small>':'')+'</td>'+
      '<td class="n">'+s.discovered+'</td><td class="n">'+s.qualified+'</td><td class="n">'+s.kready+'</td><td class="n">'+s.addressed+'</td><td class="n">'+s.engaged+'</td><td class="n">'+s.opportunity+'</td><td class="n cv-rm" title="Kvalifiserte accounts som ikke er adressert">'+s.remaining+'</td></tr>'; };
  const body=groups.map(([p,t])=>{ const L=S_.filter(s=>s.id&&s.prio===p); return L.length?'<tr class="cv-g cv-g-'+p+'"><th colspan="9">'+t+'<span>'+L.length+' segment'+(L.length===1?'':'er')+'</span></th></tr>'+L.map(row).join(''):''; }).join('')+(S_.filter(s=>!s.id&&s.discovered).map(s=>'<tr class="cv-r" data-mtsegf=""><th scope="row"><b>Uten segment</b></th><td class="n">–</td><td class="n">'+s.discovered+'</td><td class="n">'+s.qualified+'</td><td class="n">'+s.kready+'</td><td class="n">'+s.addressed+'</td><td class="n">'+s.engaged+'</td><td class="n">'+s.opportunity+'</td><td class="n">'+s.remaining+'</td></tr>').join(''));
  return '<section class="mt-sec"><div class="mt-sh"><h3>Dekning per segment</h3><span class="mt-hint">Klikk et segment for å filtrere listen.</span></div><div class="tbl cv-tw"><table class="cv-t"><thead><tr><th>Segment</th><th class="n" title="Ditt eget anslag over hvor mange relevante organisasjoner segmentet har. Ikke verifiserte organisasjoner.">Estimert marked*</th><th class="n">Identifisert</th><th class="n">Kvalifisert</th><th class="n" title="Relevant person med minst én kanal og en kilde">Kontakt klare</th><th class="n">Adressert</th><th class="n">Dialog</th><th class="n">Muligheter</th><th class="n">Gjenstår</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
    '<p class="mt-hint cv-fn-note">*Estimert marked er et anslag du skriver inn selv, og er ikke verifiserte organisasjoner. Identifisert er organisasjoner med kilde i Salong.</p></section>'; }
const _malBase=mtMalHTML; mtMalHTML=function(){ return '<p class="tab-sub">Dekning og prioritering: hvem finnes, og hvor langt er de kommet.</p>'+_malBase(); };
const _seqBase=mtSeqHTML; mtSeqHTML=function(){ return '<p class="tab-sub">Oppfølging og kadens for de som er i gang.</p>'+_seqBase(); };

/* ---------- I dag: operativ startside ---------- */
function iddTime(s){ return typeof kalTime==='function'?kalTime(s):''; }
function iddItems(){
  const out=[], Q=idQueue(); let seq=0; const td=kalToday();
  for(const it of Q.vis){ const b=it.obj==='acc'?[['Åpne','idopen',it.key],['Logg samtale','idlog',it.key]]:it.obj==='deal'?[[it.rank===1?'Åpne forespørsel':'Åpne','idopen',it.key]]:[['Åpne','idopen',it.key]];
    let act=it.action, why=(it.why||[]).slice(0,2).join(' · ');
    if(it.obj==='acc'&&(it.rank===5||it.rank===6)){ const a=mtGet(it.accId); if(a){ const p=a.active&&a.active[0], n=a.prog&&a.prog.next, cad=n?null:mtCadence(a).steps[0], ch=n?MT_CH[n.ch]:cad&&cad.ch?MT_CH[cad.ch]:'';
      act='Kontakt '+(p?p.name+(p.title?' ('+p.title+')':''):'· ingen kontaktperson funnet')+(ch?' · Kanal: '+ch:''); why=String(a.why||'').replace(/\s+/g,' ').slice(0,110)||why; } }
    out.push({r:it.rank,n:seq++,own:it.ownerId||'',time:iddTime(it.due||''),org:it.org,action:act,why:why,late:!!it.late,btns:b}); }
  let cal=[]; try{ cal=kalItems(td,td).filter(i=>(i.kind==='visit'||i.kind==='meet')&&idInScope(i.owner,true)); }catch(e){}
  for(const i of cal) out.push({r:1.5,n:seq++,time:i.time||'',org:i.org||i.title,action:KAL_KIND[i.kind]+(i.org&&i.title?': '+i.title:''),why:'I dag'+(i.room&&RM[i.room]?' · '+roomName(i.room):''),btns:[['Åpne','idcopen',i.open||'']]});
  const pick=mtAll().filter(a=>a.kind==='ny'&&!a.flags.disqualified&&!a.dncAcc&&idOperative(a)&&idInScope(a.ownerId,false)&&a.es&&a.es.state==='needs_review').sort((x,y)=>y.fit.total-x.fit.total).slice(0,3);
  for(const a of pick){ const r=a.es.rec; out.push({r:5.5,n:seq++,time:'',org:a.name,action:'Velg kontakt',why:r?'Anbefalt: '+r.p.name+(r.p.title?' ('+r.p.title+')':'')+' · '+r.score:'Mulige personer – vurder',btns:[['Velg kontakt','iddkon',a.id]]}); }
  out.sort((x,y)=>x.r-y.r||x.n-y.n); return out; }
function iddRow(x){ const tm=UI.id.scope==='team'||!idWho().mine; return '<li class="idd-r'+(x.late?' late':'')+'"><span class="idd-t">'+esc(x.time||'')+'</span><div class="idd-m"><b>'+esc(x.org)+(tm&&x.own!==undefined?' <span class="idd-ow">'+(x.own?esc(ownName(x.own)):'Ufordelt')+'</span>':'')+'</b><span class="idd-a">'+esc(x.action)+'</span>'+(x.why?'<span class="idd-w">'+esc(x.why)+'</span>':'')+'</div><div class="idd-b">'+x.btns.map((b,i)=>'<button type="button" class="'+(i?'btn ghost sm':'id-go')+'" data-'+b[1]+'="'+esc(b[2])+'"'+(b[2]===''?' disabled':'')+'>'+esc(b[0])+(i?'':' <span aria-hidden="true">→</span>')+'</button>').join('')+'</div></li>'; }
function iddPipe(){
  const P=idPipeAttention(), seen=new Set(), rows=[];
  for(const d of P.offers){ if(rows.length>=4) break; seen.add(d.id); rows.push({d,w:'Tilbud uten aktivitet i '+P.days(d)+' dager'}); }
  for(const d of P.stale){ if(rows.length>=4) break; if(seen.has(d.id)) continue; seen.add(d.id); rows.push({d,w:'Ingen aktivitet i '+P.days(d)+' dager'}); }
  const un=P.unassigned.length;
  return '<section class="idd-s"><div class="idd-h"><h3>PIPELINE SOM KREVER HANDLING</h3>'+(P.open?'<span>'+P.open+' åpne saker</span>':'')+'</div>'+(rows.length?'<ul class="idd-l">'+rows.map(x=>'<li class="idd-r"><div class="idd-m"><b>'+esc(orgName(x.d.orgId))+'</b><span class="idd-a">'+esc(x.d.title||'Sak')+'</span><span class="idd-w">'+esc(x.w)+'</span></div><div class="idd-b"><button type="button" class="id-go" data-idcopen="deal:'+esc(x.d.id)+'">Åpne <span aria-hidden="true">→</span></button></div></li>').join('')+'</ul>':'<p class="idd-e">Ingen saker krever handling nå.</p>')+(un?'<p class="idd-e">'+un+' åpne '+(un===1?'sak':'saker')+' uten ansvarlig. <button type="button" class="lnk" data-idcopen="go:pipeline">Åpne pipeline</button></p>':'')+'</section>'; }
function iddProsp(){
  const B=idActiveBatch(), info=enrRunInfo(), by={}; for(const a of mtAll()) by[a.id]=a;
  let body='';
  if(B){ const L=(B.b.accIds||[]).map(id=>by[id]).filter(Boolean), ber=L.filter(a=>a.flags.researched).length, klar=L.filter(a=>a.flags.enriched).length, kont=L.filter(a=>a.flags.addressed).length, pct=L.length?Math.round(kont/L.length*100):0;
    body='<p class="idd-bn"><b>'+esc(B.b.name||'Batch')+'</b><span>'+L.length+' accounts</span></p><p class="idd-bc"><span>'+ber+' beriket</span><span>'+klar+' klare</span><span>'+kont+' kontaktet</span></p><div class="bk-bar" role="img" aria-label="'+pct+' prosent kontaktet"><i style="width:'+pct+'%"></i></div>'+
      (info&&info.live?'<p class="idd-e">Beriker '+info.done+' / '+info.total+' nå.</p>':'')+'<div class="row"><button type="button" class="btn primary" data-idgo="prosp-arb">Fortsett batch</button></div>'; }
  else { const st=mtStats(); body='<p class="idd-e">Ingen aktiv batch.</p>'+(st.qualified-st.addressed>0?'<p class="idd-e">'+(st.qualified-st.addressed)+' kvalifiserte accounts er ikke adressert.</p><div class="row"><button type="button" class="btn" data-idgo="batch">Start neste batch</button></div>':''); }
  return '<section class="idd-s"><div class="idd-h"><h3>PROSPEKTERING / BATCH</h3></div>'+body+'</section>'; }
function iddCal(){
  const td=kalToday(); let L=[]; try{ L=kalItems(td,td).filter(i=>idInScope(i.owner,true)); }catch(e){}
  if(!L.length) return '<section class="idd-s idd-cal"><div class="idd-h"><h3>DAGENS KALENDER</h3></div><p class="idd-e">Ingen avtaler i dag. Kalender ikke koblet: bare avtaler registrert i Salong vises.</p></section>';
  return '<section class="idd-s idd-cal"><div class="idd-h"><h3>DAGENS KALENDER</h3><span>'+L.length+'</span></div><ul class="idd-l">'+L.slice(0,6).map(it=>'<li class="idd-r"><span class="idd-t">'+esc(it.time||'Hele dagen')+'</span><div class="idd-m"><b>'+esc(it.org||it.title)+'</b><span class="idd-a">'+esc(KAL_KIND[it.kind]+(it.room&&RM[it.room]?' · '+roomName(it.room):''))+'</span></div><div class="idd-b"><button type="button" class="id-go" data-idcopen="'+esc(it.open||'')+'"'+(it.open?'':' disabled')+'>Åpne <span aria-hidden="true">→</span></button></div></li>').join('')+'</ul></section>'; }
function iddAll(){
  const Q=idQueue(), td=kalToday(), out=[]; let n=0;
  const add=o=>out.push({n:n++,time:'',why:'',late:false,...o});
  let cal=[]; try{ cal=kalItems(td,td).filter(i=>idInScope(i.owner,true)); }catch(e){}
  for(const i of cal) add({g:0,kind:String(KAL_KIND[i.kind]||'Kalender').toUpperCase(),time:i.time||'',org:i.org||i.title,action:KAL_KIND[i.kind]+(i.org&&i.title?': '+i.title:''),why:i.room&&RM[i.room]?roomName(i.room):'',btns:[['Åpne','idcopen',i.open||'']]});
  for(const it of Q.vis){
    if(it.rank===1&&it.obj==='deal'){ const d=S.deals[it.dealId]; let b=null; try{ b=d?iqBrief(d):null; }catch(e){}
      const bm=b?String(b.best).replace(/<[^>]+>/g,''):'';
      add({g:1,kind:'NY FORESPØRSEL',own:it.ownerId||'',org:it.org,action:[d&&d.title,d&&Number(d.attendees)?d.attendees+' personer':'',d&&d.date?fd(d.date,{month:'long'}):''].filter(Boolean).join(' · '),why:[bm&&!/Ikke dokumentert/.test(bm)?bm:'',it.late?'Over fristen på 24 timer':''].filter(Boolean).join(' · '),late:it.late,btns:[['Åpne','idopen',it.key]]}); }
    else if(it.rank===1&&it.obj==='acc') add({g:2,kind:'SVAR FRA PROSPEKT',org:it.org,action:'Kunden har svart. Følg opp',why:'',btns:[['Åpne','idopen',it.key]]});
  }
  const fu=Q.vis.filter(i=>[2,3,4].includes(i.rank)&&i.obj!=='acc');
  for(const it of fu) add({g:3,kind:'OPPFØLGING',own:it.ownerId||'',org:it.org,action:it.action,why:(it.why||[]).slice(0,2).join(' · '),late:!!it.late,btns:[['Følg opp','idopen',it.key]].concat(it.done?[['Ferdig','idone',it.key]]:[])});
  const ou=Q.vis.filter(i=>i.obj==='acc'&&(i.rank===5||i.rank===6));
  if(ou.length>1) add({g:4,kind:'OUTREACH',org:ou.length+' personer skal kontaktes i dag',action:ou.slice(0,3).map(i=>i.org).join(', ')+(ou.length>3?' og '+(ou.length-3)+' til':''),why:'',btns:[['Start outreach','idgo','prosp-seq']]});
  else if(ou.length===1){ const it=ou[0], a=mtGet(it.accId), p=a&&a.active[0]; add({g:4,kind:'OUTREACH',org:it.org,action:p?'Kontakt '+p.name+(p.title?' ('+p.title+')':''):it.action,why:(it.why||[]).slice(0,1).join(' · '),btns:[['Start outreach','idopen',it.key]]}); }
  const pend=mtAll().filter(a=>a.kind==='ny'&&!a.flags.disqualified&&!a.dncAcc&&idOperative(a)&&idInScope(a.ownerId,false)&&a.es&&(a.es.pending||a.es.state==='needs_review')).sort((x,y)=>y.fit.total-x.fit.total);
  if(pend.length>2) add({g:5,kind:'KONTAKT TIL GODKJENNING',org:pend.length+' foreslåtte kontakter',action:'Godkjenn eller bytt med ett klikk',why:pend.slice(0,3).map(a=>a.name).join(', ')+(pend.length>3?' …':''),btns:[['Gå gjennom','idgo','prosp-arb']]});
  else for(const a of pend){ const r=a.es.rec; add({g:5,kind:'KONTAKT TIL GODKJENNING',org:a.name,action:r?r.p.name+(r.p.title?' ('+r.p.title+')':''):'Mulige personer – vurder',why:r?'Anbefalt · '+cdSrcLabel(r.p)+' · '+r.score:'Ingen anbefalt',btns:a.es.pending?[['Bruk kontakt','cdquick',a.id],['Vurder','iddkon',a.id]]:[['Vurder','iddkon',a.id]]}); }
  out.sort((x,y)=>x.g-y.g||(x.time||'99').localeCompare(y.time||'99')||x.n-y.n);
  return out; }
function iddRow2(x,hasT){ const tm=UI.id.scope==='team'||!idWho().mine; return '<li class="idd-r'+(x.late?' late':'')+'">'+(hasT?'<span class="idd-t">'+esc(x.time||'')+'</span>':'')+'<div class="idd-m"><span class="idd-k">'+esc(x.kind)+'</span><b>'+esc(x.org)+(tm&&x.own!==undefined?' <span class="idd-ow">'+(x.own?esc(ownName(x.own)):'Ufordelt')+'</span>':'')+'</b><span class="idd-a">'+esc(x.action)+'</span>'+(x.why?'<span class="idd-w">'+esc(x.why)+'</span>':'')+'</div><div class="idd-b">'+x.btns.map((b,i)=>'<button type="button" class="'+(i?'btn ghost sm':'id-go')+'" data-'+b[1]+'="'+esc(b[2])+'"'+(b[2]===''?' disabled':'')+'>'+esc(b[0])+(i?'':' <span aria-hidden="true">→</span>')+'</button>').join('')+'</div></li>'; }
function idDagHTML(){
  const Q=idQueue(); UI.id.cache=Object.fromEntries(Q.all.map(i=>[i.key,i]));
  if(UI.id.focus) return idFocusHTML(Q);
  if(idNoData()&&!idGoalSet()) return '<header class="idn-hd"><h2>'+esc(idcHello())+'</h2></header>'+idEmpty(Q);
  const P=planningService.getPlan(), all=iddAll(), top=all.slice(0,8), rest=all.slice(8), td=kalToday(), hasT=all.some(x=>x.time);
  const date=fd(td,{weekday:'long',day:'numeric',month:'long'});
  const list=top.length?'<ul class="idd-l">'+top.map(x=>iddRow2(x,hasT)).join('')+'</ul>'+(rest.length?'<details class="idd-more"><summary>Vis '+rest.length+' til</summary><ul class="idd-l">'+rest.map(x=>iddRow2(x,hasT)).join('')+'</ul></details>':''):'<p class="idd-e">Ingenting haster i dag. <button type="button" class="lnk" data-idgo="prosp-arb">Åpne arbeidslisten</button></p>';
  const goal=P.status==='active'||P.status==='upcoming'?'<details class="idd-goal"><summary>Mål og fremdrift</summary>'+idProgressHTML()+'</details>':P.status==='not_set'?'<p class="idd-e">Ingen seksmånedersmål er satt. <button type="button" class="lnk" data-idgo="maal">Sett seksmånedersmål</button></p>':'';
  return '<header class="idn-hd idd-hd"><h2>'+esc(idcHello())+'</h2><p class="idd-date">'+esc(date)+'</p></header><section class="idd-s idd-pri">'+list+'</section>'+goal+(typeof idcTierLine==='function'?idcTierLine():''); }
(function(){ const _w=V.idag.wire; V.idag.wire=function(v){ _w.apply(this,arguments); const prev=v.onclick;
  v.onclick=function(e){ const q=e.target.closest&&e.target.closest('[data-cdquick]'); if(q){ const a=mtGet(q.dataset.cdquick); if(a&&a.es&&a.es.rec){ q.disabled=true; cdPick(a.es.rec.p.id); } return; }
  const t=e.target.closest&&e.target.closest('[data-iddkon]'); if(t){ mtOpen(t.dataset.iddkon); UI.mt.dr.tab='kon'; mtOverlay(true); return; } return prev&&prev.apply(this,arguments); }; }; })();

/* ---------- Forespørsler: hver ubesvart sak får Best match / Mangler / Historikk / Neste, utledet av saken selv (faste regler, ingen KI-score) ---------- */
function iqRange(r){ const m=String(r.cap||'').match(/\d+/g); if(!m) return null; return [+m[0],+m[m.length-1]]; }
function iqRoom(d){
  if(RM[d.room]) return {r:RM[d.room],sugg:false};
  const n=Number(d.attendees)||0; if(!n) return null;
  const c=ROOMS.filter(r=>{ const g=iqRange(r); return g&&n>=g[0]&&n<=g[1]&&r.k!=='nedjma'; }).sort((x,y)=>iqRange(x)[1]-iqRange(y)[1]);
  return c[0]?{r:c[0],sugg:true}:null; }
function iqBrief(d){
  let M=null; try{ M=caseModel(d.id); }catch(e){}
  const rm=iqRoom(d), o=S.orgs[d.orgId]||{};
  const best=rm?'<b>'+esc(rm.r.n)+'</b> '+(rm.sugg?'foreslått etter antall':'valgt av kunden')+[Number(d.attendees)?' · '+d.attendees+' pers.':'',d.date?' · '+fd(d.date,{day:'numeric',month:'long'}):''].join(''):'<span class="iq-no">Ikke dokumentert</span>'+[Number(d.attendees)?' · '+d.attendees+' pers.':'',d.date?' · '+fd(d.date,{day:'numeric',month:'long'}):''].join('');
  let miss=M?M.items.filter(i=>i.st==='mangler').map(i=>i.label.toLowerCase()):[]; if(!M){ if(!d.date) miss.push('dato'); if(!Number(d.attendees)) miss.push('antall'); if(!d.room) miss.push('rom'); }
  miss=miss.slice(0,3);
  const prev=deals().filter(x=>x.orgId===d.orgId&&x.id!==d.id), la=lastAct(a=>a.orgId===d.orgId&&a.dealId!==d.id);
  const hist=prev.length?prev.length+' tidligere '+(prev.length===1?'sak':'saker')+(la?' · sist '+fd(la,{day:'numeric',month:'short'}):''):o.former?'Har leid før':'Første henvendelse i Salong';
  const t=(M&&M.tasks[0]), nxt=t?esc(t.text)+(t.due?' · frist '+esc(fd(t.due,{weekday:'short',day:'numeric',month:'short'})):''):'Svar innen én arbeidsdag';
  const act=miss.includes('dato')?'Foreslå dato':miss.length?'Svar og spør':rm?'Svar med forslag':'Ring';
  return {best,miss,hist,nxt,act}; }
function iqCard(d){
  const B=iqBrief(d), h=(Date.now()-new Date(d.createdAt||Date.now()))/36e5;
  return '<article class="iq" data-open="deal:'+esc(d.id)+'" tabindex="0"><header><div><b>'+esc(orgName(d.orgId))+'</b><span>'+esc(d.title)+'</span></div><span class="iq-t'+(h>24?' late':'')+'">'+esc(ago(d.createdAt))+'</span></header>'+
   '<dl class="iq-g"><div><dt>Best match</dt><dd>'+B.best+'</dd></div><div><dt>Mangler å avklare</dt><dd>'+(B.miss.length?B.miss.map(esc).join(' · '):'<span class="iq-no">Ingenting kritisk</span>')+'</dd></div><div><dt>Historikk</dt><dd>'+esc(B.hist)+'</dd></div><div><dt>Neste</dt><dd>'+B.nxt+'</dd></div></dl>'+
   '<div class="iq-a"><button type="button" class="btn sm" data-open="deal:'+esc(d.id)+'">'+esc(B.act)+'</button></div></article>'; }
(function(){ const base=V.innboks.html, w0=V.innboks.wire;
  V.innboks.html=function(){ const h=base();
    const i=h.indexOf('<section class="panel"><header><h2>Ubesvarte'); if(i<0) return h;
    const ny=deals().filter(d=>d.stage==='ny'&&match(UI.q,d.title,orgName(d.orgId))).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
    const list='<section class="panel iq-p"><header><h2>Ubesvarte forespørsler</h2><span class="sub">Svar innen én arbeidsdag</span></header>'+(ny.length?ny.map(iqCard).join(''):'<p class="empty">Ingen ubesvarte forespørsler.</p>')+'</section>';
    const form=h.slice(h.indexOf('<section class="panel">'),i);
    return '<div class="grid g21 iq-w">'+list+form.replace('<h2>Ny forespørsel</h2><span class="sub">Lim inn e-posten eller skjemaet som kom inn</span>','<h2>Ny forespørsel</h2><span class="sub">Lim inn e-posten. Salong leser den automatisk</span>')+'</section></div>'; };
  V.innboks.wire=function(v){ w0(v); const t=$('#inqText'); if(t) t.addEventListener('paste',()=>setTimeout(()=>{ const I=UI.inbox; if(sample&&!I.busy&&!I.f&&String(I.text||t.value).trim().length>60){ I.text=t.value; parseInquiry(); } },90)); }; })();
