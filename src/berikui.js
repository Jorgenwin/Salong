/* ---------- Berik: konto-kort, Arbeidsliste og motorstatus ---------- */
const BKD_TABS=[['ov','Oversikt'],['kon','Kontakter'],['akt','Aktivitet'],['kil','Kilder']];
const bkLvlL=l=>l==='Confirmed'||l==='Dokumentert'?'Dokumentert':l==='Likely'||l==='Indikasjon'?'Indikasjon':'Ikke kjent';
const bkDate=d=>{ d=String(d||''); return /^\d{4}-\d{2}-\d{2}/.test(d)?fd(d.slice(0,10),{day:'numeric',month:'short',year:'numeric'}):d; };
const bkDateS=d=>{ d=String(d||''); return /^\d{4}-\d{2}-\d{2}/.test(d)?fd(d.slice(0,10),{day:'numeric',month:'short'}):d; };
const bkLink=u=>{ u=String(u||''); return /^https?:\/\//i.test(u)?u:(u?'https://'+u:''); };
MT_GROUPS[3]='Klar for kontakt';

function mtPrimary(a){
  const k=a.nx.k;
  if(k==='dq') return ['reset','Gjenopprett til målmarkedet']; if(k==='dnc') return null;
  if(k==='research') return ['qual','Fullfør kvalifisering'];
  if(k==='enrich') return bkActive(a.job)?['wait','Beriker …']:['berik','Berik nå'];
  if(k==='ready') return ['start','Start kontakt']; if(k==='deal') return ['deal','Åpne saken']; if(k==='reply') return ['deal','Opprett sak'];
  return ['log','Logg kontakt']; }
function mtActLabel(a){ const k=a.nx.k; return k==='enrich'?(bkActive(a.job)?'':'Berik'):k==='ready'?'Start kontakt':k==='research'?'Kvalifiser':k==='deal'?'Åpne sak':k==='reply'?'Åpne':k==='dq'||k==='dnc'||k==='paused'?'Åpne':'Logg touch'; }
function mtOpen(id,mode){ const a=mtGet(id); if(!a) return; UI.mt.acc=id; const D=UI.mt.dr={mode:mode||'',sec:{},tab:'ov'};
  if(mode==='do'){ const pr=mtPrimary(a); if(pr){ if(pr[0]==='log'){ D.log=true; D.tab='akt'; } if(pr[0]==='qual'){ D.edit='basis'; D.tab='kil'; } if(pr[0]==='start') D.start=true; } }
  UI.mt.ret=document.activeElement; mtOverlay(true); }

/* ---------- små byggeklosser ---------- */
function bkWhy(a){
  const L=bkSignals(a.enr).slice().sort((x,y)=>(x.level==='Dokumentert'?0:1)-(y.level==='Dokumentert'?0:1)), pts=[];
  for(const x of L.slice(0,3)) pts.push({t:[x.event_name||x.event_type,bkDateS(x.date),x.recurrence,x.venue].filter(Boolean).join(' · '),lv:x.level==='Dokumentert'?'Dokumentert':'Indikasjon'});
  if(!pts.length&&a.ev.level!=='Unknown'){ if(a.ev.note) pts.push({t:a.ev.note,lv:bkLvlL(a.ev.level)}); else if(a.ev.sources.length) pts.push({t:'Arrangementsaktivitet omtalt hos '+a.ev.sources.slice(0,2).map(s=>s.label||mtHost(s.url)).join(', '),lv:bkLvlL(a.ev.level)}); }
  return pts; }
function bkSrcUrls(a){ const s=new Set(); for(const x of a.ev.sources) if(x.url) s.add(x.url); for(const x of bkSignals(a.enr)) if(x.source_url) s.add(x.source_url); return [...s]; }
function bkPersonDate(p){ return p.enrichedAt||p.verifiedAt||''; }
function bkVer(p,f){ const v=mtVerLabel(p,f), val=f==='email'?p.email:p.phone, nm=f==='email'?'E-post':'Telefon';
  if(!val) return '<li class="no">'+nm+' <em>mangler</em></li>';
  return v.k==='ok'?'<li class="ok">'+nm+' <b aria-label="verifisert">✓</b></li>':'<li class="warn" title="'+esc(v.t)+'">'+nm+' <em>ikke verifisert</em></li>'; }
function bkContact(a,p,role){
  const src=p.source==='CRM'?'Kundekortet':p.source==='Manuell'?'Lagt inn manuelt':p.source, dt=bkPersonDate(p), ln=bkLink(p.linkedin), en=bkEnrollOf(a.id);
  const sq=en&&bkActive(en)?'<p class="bk-qn">Enrollment i «'+esc(en.sequence_name||'valgt sekvens')+'» er bestilt og venter på utførelse i Apollo. Ingenting er sendt.</p>':en&&en.status==='done'&&en.outcome==='enrolled'?'<p class="bk-qn ok">Lagt i Apollo-sekvens «'+esc(en.sequence_name||'')+'» '+esc(bkDateS(en.completed_at))+'.</p>':'';
  const st=(role==='best'&&UI.mt.dr.start)?'<div class="bk-st" role="group" aria-label="Start kontakt"><button type="button" class="bk-so" data-bkst="mail">Lag personlig e-post</button><button type="button" class="bk-so" data-bkst="tel">Logg telefon</button>'+(ln?'<button type="button" class="bk-so" data-bkst="li">Åpne LinkedIn</button>':'<button type="button" class="bk-so" disabled title="Ingen LinkedIn-profil registrert">Åpne LinkedIn</button>')+'<button type="button" class="bk-so" data-bkst="seq">Legg i Apollo-sekvens</button>'+
    (UI.mt.dr.seq?'<div class="bk-sf"><label class="f"><span>Apollo-sekvens</span><input class="in" id="bkSeqN" value="'+esc(UI.mt.dr.seqName||'')+'" placeholder="Navn på sekvensen i Apollo"></label><p class="mt-hint">Dette er en egen handling. '+esc(p.name)+' legges i sekvensen etter at du har bedt om det her. Ingenting sendes fra Salong.</p><div class="row"><button type="button" class="btn sm primary" data-bkst="seqgo">Be om enrollment</button><button type="button" class="btn ghost sm" data-bkst="seqx">Avbryt</button></div></div>':'')+'</div>':'';
  if(role==='alt') return '<div class="bk-alt"><small>ALTERNATIV</small><b>'+esc(p.name)+'</b><span>'+esc(p.title||'Stilling ikke oppgitt')+'</span></div>';
  return '<div class="bk-bc"><small>BESTE KONTAKT</small><b>'+esc(p.name)+'</b><span>'+esc(p.title||'Stilling ikke oppgitt')+'</span><ul class="bk-ch">'+bkVer(p,'email')+bkVer(p,'phone')+'<li class="'+(ln?'ok':'no')+'">LinkedIn '+(ln?'<a href="'+esc(ln)+'" target="_blank" rel="noopener" aria-label="Åpne LinkedIn-profil">→</a>':'<em>mangler</em>')+'</li></ul>'+
    '<p class="bk-src">Kilde: '+(p.sourceUrl?'<a href="'+esc(p.sourceUrl)+'" target="_blank" rel="noopener">'+esc(src)+'</a>':esc(src))+(dt?' · Beriket: '+esc(bkDate(dt)):'')+(p.foundAt&&!dt?' · Funnet: '+esc(bkDate(p.foundAt)):'')+(!p.email&&p.id&&S.mtper[p.id]&&apolloProvider.isConnected()?' · <button type="button" class="lnk" data-enrmail="'+esc(p.id)+'">Hent e-post (1 kreditt)</button>':'')+'</p>'+sq+(UI.mt.dr.start?'':'<button type="button" class="btn primary" data-bk="start">Start kontakt</button>')+st+'</div>'; }
function bkJobLine(a){ const j=a.job, s=bkState(j); if(!j) return '';
  if(s==='venter') return '<p class="bk-jl a">Berik venter på Claude-økten. Si «'+BK_CMD+'» i Claude. <button type="button" class="lnk" data-bkcopy="1">Kopier</button></p>';
  if(s==='ingen_kontakt') return '<p class="bk-jl bad">Berik fant ingen relevant kontakt i Apollo'+(j.note?'. '+esc(j.note):'')+'. Legg til en kontakt manuelt, eller berik på nytt senere.</p>';
  if(s==='mangler_grunnlag') return '<p class="bk-jl bad">Researchgrunnlaget var for tynt til å velge rolle og romfit'+(j.note?'. '+esc(j.note):'')+'.</p>';
  if(s==='feil') return '<p class="bk-jl bad">Berik feilet'+(j.error?': '+esc(j.error):'')+'.</p>';
  if(s==='vurdering'||s==='klar') return '<p class="bk-jl warn">Berik fant kandidater, men ingen er trygge nok til å bli «Klar for kontakt»'+(j.note?'. '+esc(j.note):'')+'. Se Kontakter.</p>';
  return ''; }

/* ---------- OVERSIKT ---------- */
function bkOversikt(a){
  const D=UI.mt.dr, why=bkWhy(a), n=bkSrcUrls(a).length, rm=a.room;
  const s1='<section class="bk-s"><h3>HVORFOR NÅ</h3>'+(why.length?'<ul class="bk-wl">'+why.map(w=>'<li>'+esc(w.t)+' <em class="bk-lv '+w.lv.toLowerCase()+'">'+w.lv+'</em></li>').join('')+'</ul>'+(n?'<button type="button" class="lnk" data-bkt="kil">'+n+' kilde'+(n>1?'r':'')+'</button>':''):'<p class="bk-e">Ingen dokumenterte signaler ennå.'+(a.nx.k==='enrich'||a.nx.k==='research'?' Berik nå finner dem.':'')+'</p>')+'</section>';
  const s2='<section class="bk-s"><h3>MULIGHET</h3>'+(rm.value==='Ukjent'?'<p class="bk-e">Romfit er ikke vurdert ennå.</p>':'<p class="bk-rf"><b>'+esc(rm.label||rm.value)+'</b></p><p class="bk-rb">'+esc(String(rm.basis||'').replace(/\s*Solstad har 320 plasser i stolrader\.?/,'').slice(0,220))+'</p>')+'</section>';
  const best=a.active[0], alt=a.active[1];
  const s3='<section class="bk-s"><h3>KONTAKT</h3>'+(best?bkContact(a,best,'best')+(alt?bkContact(a,alt,'alt'):''):'<p class="bk-rl"><b>'+esc(mtRoleText(a).replace(/^Ser etter: /,'Ser etter: '))+'</b></p>'+bkJobLine(a)+(a.persons.length?'<p class="mt-hint">'+a.persons.length+' kandidat'+(a.persons.length>1?'er':'')+' må vurderes under Kontakter.</p>':''))+(best?bkJobLine(a):'')+'</section>';
  const fit='<details class="bk-fit"><summary>Hvorfor fit '+a.fit.total+'?</summary><table class="mt-ft">'+a.fit.parts.map(x=>'<tr><td>'+esc(x.label)+'<small>'+esc(x.basis)+'</small></td><td class="n"><b>'+x.pts+'</b>/'+x.max+'</td></tr>').join('')+'</table><p class="mt-hint">Åpen sum av seks regler. Ingen KI-score. Poeng uten grunnlag gis ikke.</p></details>';
  return s1+s2+s3+fit; }

/* ---------- KONTAKTER ---------- */
function bkKontakter(a){
  const D=UI.mt.dr, cfg=mtCfg(), p0=a.profile, orgC=p0&&p0.contact||{};
  const goal='<section class="bk-s"><h3>ROLLER VI SER ETTER</h3><div class="mt-chips">'+a.roles.map(r=>'<span class="chip">'+esc(r)+'</span>').join('')+'</div>'+(orgC.askFor?'<p class="mt-hint">Fra profilen: '+esc(orgC.askFor)+'</p>':'')+
    ((orgC.email||orgC.phone||orgC.contactUrl)?'<p class="mt-hint">Generell adresse, ikke en person: '+[orgC.email,orgC.phone].filter(Boolean).map(esc).join(' · ')+(orgC.contactUrl?' · <a href="'+esc(orgC.contactUrl)+'" target="_blank" rel="noopener">kontaktside</a>':'')+'. Teller ikke som kontaktdekning.</p>':'')+
    (D.edit==='roles'?'<div class="form"><label class="f full"><span>Ønsket kontaktrolle (skill med komma)</span><input class="in" id="mtRoles" value="'+esc(a.roles.join(', '))+'"></label></div><div class="row"><button type="button" class="btn sm primary" data-mtd="rolesave">Lagre</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div>':'<div class="row"><button type="button" class="btn ghost sm" data-mtd="rolesedit">Endre roller</button></div>')+'</section>';
  const act=a.persons.filter(p=>a.active.includes(p)).sort((x,y)=>a.active.indexOf(x)-a.active.indexOf(y)), oth=a.persons.filter(p=>!a.active.includes(p));
  const pers='<section class="bk-s"><h3>PERSONER</h3>'+(act.length?'<p class="mt-hint">'+act.length+' aktive av maks 2.</p>'+act.map(p=>mtPersonHTML(a,p)).join(''):'<p class="bk-e">Ingen aktive kontaktpersoner ennå.</p>')+
    (oth.length?'<details class="mt-oth"'+(!act.length?' open':'')+'><summary>'+(act.length?'Flere personer':'Kandidater')+' ('+oth.length+')</summary>'+oth.map(p=>mtPersonHTML(a,p,true)).join('')+'</details>':'')+
    '<details class="mt-add"'+(D.addp?' open':'')+'><summary>Legg til person manuelt</summary><div class="form"><label class="f"><span>Navn</span><input class="in" id="mtPn"></label><label class="f"><span>Stilling</span><input class="in" id="mtPt"></label><label class="f"><span>E-post</span><input class="in" id="mtPe" type="email"></label><label class="f"><span>Telefon</span><input class="in" id="mtPp"></label><label class="f full"><span>LinkedIn</span><input class="in" id="mtPl"></label></div><div class="row"><button type="button" class="btn sm" data-mtd="addp">Legg til</button><span class="mt-hint">Lagres som «ikke verifisert, lagt inn manuelt».</span></div></details></section>';
  return goal+pers; }

/* ---------- AKTIVITET ---------- */
const BK_HIDE=/^(Klargjort for enrichment|Kontaktperson lagt til|Batch-steg|Grunnlag redigert|Segment:|Ønsket kontaktrolle|Ferdigmarkering|Markert som ferdig|Eventsignal satt|Romfit satt)/;
function bkFeed(a){
  const L=[];
  for(const h of (a.doc&&a.doc.hist)||[]) if(!BK_HIDE.test(h.t||'')) L.push({at:h.at,t:h.t,by:h.by});
  for(const x of acts()) if(x.orgId===a.id&&!x.derived&&!x.handover&&!/^E-postutkast laget/.test(x.text||'')) L.push({at:x.at,t:(x.type==='task'?'Oppgave: ':'')+(x.text||x.type),by:x.byName});
  for(const j of bkJobs()) if(j.accId===a.id&&j.status==='done'&&j.completed_at){ const k=j.kind==='enroll'?(j.outcome==='enrolled'?'Lagt i Apollo-sekvens '+(j.sequence_name||''):'Enrollment ble ikke gjennomført'):({klar:'Beriket: klar for kontakt',vurdering:'Beriket: kontaktvalg må vurderes',ingen_kontakt:'Beriket: fant ingen relevant kontakt',mangler_grunnlag:'Berik: for tynt researchgrunnlag'})[j.outcome]||''; if(k) L.push({at:j.completed_at,t:k,by:'Berik'}); }
  L.sort((x,y)=>String(y.at).localeCompare(String(x.at))); const seen=new Set(), out=[];
  for(const e of L){ const key=e.t+'|'+String(e.at).slice(0,10); if(seen.has(key)) continue; seen.add(key); out.push(e); }
  return out.slice(0,14); }
function bkAktivitet(a){
  const D=UI.mt.dr, sq=a.seq||{}, pg=a.prog;
  const own='<div class="mt-own"><span>Ansvarlig</span>'+ownChip(a.ownerId)+(D.assign?'<select class="in fsel" data-mtown>'+ownOpts(a.ownerId||'')+'</select>':'<button type="button" class="btn ghost sm" data-mtd="assign">Endre</button>')+'</div>';
  const log='<div class="row"><button type="button" class="btn sm" data-mtd="log">Logg kontakt</button></div>'+(D.log?mtLogHTML(a):'');
  const seqb='<details class="mt-dt bk-sq"><summary>Batch og sekvens</summary><dl class="mt-ok"><dt>Batch</dt><dd>'+(a.batch?esc(a.batch.name):'–')+'</dd><dt>Steg</dt><dd>'+(a.batch||a.stage!=='ready'?'<select class="in fsel" data-mtstg>'+MT_STAGES.map(([k,n])=>'<option value="'+k+'"'+(a.stage===k?' selected':'')+'>'+n+'</option>').join('')+'</select>':esc(MT_STAGEN[a.stage]))+'</dd><dt>Sekvens</dt><dd>'+(sq.name?esc(sq.name):'–')+'</dd><dt>Siste touch</dt><dd>'+(a.touch.lastOut?esc(ago(a.touch.lastOut)):'–')+'</dd><dt>Neste</dt><dd>'+(sq.nextTouch?esc(fd(sq.nextTouch)):(a.nx.due?esc(fd(a.nx.due)):'–'))+'</dd></dl>'+
    (pg?mtStepper(pg.steps.map(s=>s),'')+'<div class="mt-stc">'+pg.steps.map(s=>'<label class="mt-ck"><input type="checkbox" data-mtstep="'+s.i+'"'+(s.done?' checked':'')+'> Dag '+s.d+' gjort</label>').join('')+'</div>':'')+'<p class="mt-hint">Salong sender ingenting selv. Touches logges av deg.</p></details>';
  const F=bkFeed(a);
  const hist='<section class="bk-s"><h3>HISTORIKK</h3>'+(F.length?'<ul class="mt-tl">'+F.map(h=>'<li>'+esc(h.t)+' <small>'+esc(bkDateS(h.at))+(h.by?' · '+esc(h.by):'')+'</small></li>').join('')+'</ul>':'<p class="bk-e">Ingenting registrert ennå.</p>')+'</section>';
  return '<section class="bk-s">'+own+log+'</section>'+hist+seqb; }

/* ---------- KILDER ---------- */
function bkKilder(a){
  const D=UI.mt.dr, cfg=mtCfg(), fails=a.qual.fails, e=a.enr||{}, sig=bkSignals(e), rm=a.room;
  const sigH=sig.length?sig.map(x=>'<li class="bk-sg"><div><b>'+esc(x.event_name||x.event_type)+'</b> <em class="bk-lv '+(x.level==='Dokumentert'?'dokumentert':'indikasjon')+'">'+(x.level==='Dokumentert'?'Dokumentert':'Indikasjon')+'</em></div><dl>'+
    [['Type',x.event_type],['Dato',bkDate(x.date)],['Gjentakelse',x.recurrence],['Sted',[x.venue,x.city].filter(Boolean).join(', ')],['Deltakere',x.attendance?x.attendance+' (dokumentert)':''],['Format',x.format],['Åpent/lukket',x.open_or_closed],['Teknisk',x.streaming_technical]].filter(r=>r[1]).map(r=>'<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>').join('')+
    '<dt>Kilde</dt><dd>'+(x.source_url?'<a href="'+esc(bkLink(x.source_url))+'" target="_blank" rel="noopener">'+esc(mtHost(x.source_url))+'</a>':'ingen')+(x.source_date?' · '+esc(bkDate(x.source_date)):'')+'</dd></dl></li>').join(''):
    (a.ev.sources.length?a.ev.sources.map(s=>'<li class="bk-sg"><div>'+(s.url?'<a href="'+esc(bkLink(s.url))+'" target="_blank" rel="noopener">'+esc(s.label||mtHost(s.url))+'</a>':esc(s.label))+' <em class="bk-lv '+(a.ev.level==='Confirmed'?'dokumentert':'indikasjon')+'">'+bkLvlL(a.ev.level)+'</em></div>'+(s.checkedAt?'<small>kontrollert '+esc(s.checkedAt)+'</small>':'')+'</li>').join(''):'');
  const venues=(e.venues||[]).map(v=>typeof v==='string'?{name:v}:v).filter(v=>v&&v.name);
  const ev='<section class="bk-s"><h3>EVENTSIGNALER</h3><p class="bk-lvl">Samlet nivå: <b>'+bkLvlL(a.ev.level)+'</b>'+(a.ev.note&&!sig.length?' · '+esc(a.ev.note):'')+'</p>'+(sigH?'<ul class="bk-sgl">'+sigH+'</ul>':'<p class="bk-e">Ingen kilder registrert. Berik nå leter etter dem.</p>')+
    (venues.length?'<h4>Tidligere venues</h4><ul class="bk-vl">'+venues.map(v=>'<li>'+esc(v.name)+(v.city?', '+esc(v.city):'')+(v.source_url?' · <a href="'+esc(bkLink(v.source_url))+'" target="_blank" rel="noopener">'+esc(mtHost(v.source_url))+'</a>':'')+'</li>').join('')+'</ul>':'')+
    (a.ev.note&&a.ev.manual?'<p class="mt-hint">'+esc(a.ev.note)+'</p>':'')+'</section>';
  const room='<section class="bk-s"><h3>ROMFIT</h3><p class="bk-rf"><b>'+esc(rm.label||rm.value)+'</b>'+(rm.source==='research'?' <em class="bk-lv indikasjon">Research</em>':'')+'</p><p class="mt-hint">'+esc(rm.basis)+' Kapasitet gjelder alltid ett oppsett (stolrader), aldri samlet romkapasitet.</p>'+
    (D.edit==='room'?'<div class="form"><label class="f"><span>Romfit</span><select class="in" id="mtRfV">'+['Solstad','Mellomstore rom','Små rom','Flere muligheter','Ukjent'].map(x=>'<option'+(x===rm.value?' selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f full"><span>Grunnlag (påkrevd)</span><input class="in" id="mtRfB" value="'+esc(rm.manual?rm.basis:'')+'" placeholder="For eksempel: lanseringer med 150–250 deltakere"></label></div><div class="row"><button type="button" class="btn sm primary" data-mtd="roomsave">Lagre</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div>':'<div class="row"><button type="button" class="btn ghost sm" data-mtd="roomedit">Endre romfit</button></div>')+'</section>';
  const ps='<section class="bk-s"><h3>KONTAKTKILDER</h3>'+(a.persons.length?'<ul class="bk-pl">'+a.persons.map(p=>'<li><b>'+esc(p.name)+'</b> · '+esc(p.source)+(p.externalId?' <small>ID '+esc(p.externalId)+'</small>':'')+(p.quality?' · datakvalitet '+esc(p.quality):'')+(bkPersonDate(p)?' · '+esc(bkDate(bkPersonDate(p))):' · aldri beriket')+'</li>').join('')+'</ul>':'<p class="bk-e">Ingen kontakter ennå.</p>')+'</section>';
  const j=a.job, jb='<section class="bk-s"><h3>BERIK-JOBB</h3>'+(j?'<dl class="mt-ok"><dt>Kjøring</dt><dd>'+(j.executor==='page'?'Direkte fra siden':'Via Claude')+'</dd><dt>Status</dt><dd>'+esc(({queued:'I kø',running:'Kjører',done:'Ferdig',error:'Feilet'})[j.status]||j.status)+(j.outcome?' · '+esc((BK_OUTL[j.outcome])||j.outcome):'')+'</dd><dt>Bestilt</dt><dd>'+esc(bkDate(j.requested_at))+(j.requested_by?' · '+esc(j.requested_by):'')+'</dd>'+(j.started_at?'<dt>Startet</dt><dd>'+esc(bkDate(j.started_at))+'</dd>':'')+(j.completed_at?'<dt>Ferdig</dt><dd>'+esc(bkDate(j.completed_at))+'</dd>':'')+(j.result_version?'<dt>Resultatversjon</dt><dd>'+esc(j.result_version)+'</dd>':'')+
      (j.missing&&j.missing.length?'<dt>Manglet</dt><dd>'+j.missing.map(m=>esc(({apollo:'Apollo',cognism:'Cognism',research:'Research'})[m]||m)).join(', ')+'</dd>':'')+(j.error?'<dt>Feil</dt><dd>'+esc(j.error)+'</dd>':'')+'</dl>'+
      ((j.provider_results||[]).length?'<ul class="bk-stp">'+j.provider_results.map(r=>'<li class="'+(r.status==='ok'?'ok':r.status==='error'?'feil':'hoppet')+'">'+esc(ENR_PROV_LABEL[r.provider]||r.provider)+' <small>'+esc(r.status==='plan_restricted'?'ikke tilgjengelig på planen':r.status==='not_connected'?'ekstra kilde tilgjengelig via Claude':r.detail||r.status)+'</small></li>').join('')+'</ul>':'')+(j.steps&&Object.keys(j.steps).length?'<ul class="bk-stp">'+BK_STEPS.map(([k,n])=>j.steps[k]?'<li class="'+esc(j.steps[k])+'">'+esc(n)+' <small>'+esc(({ok:'utført',hoppet:'hoppet over',mangler:'mangler leverandør',feil:'feilet'})[j.steps[k]]||j.steps[k])+'</small></li>':'').join('')+'</ul>':''):'<p class="bk-e">Ikke beriket ennå.</p>')+'</section>';
  const grunn='<section class="bk-s"><h3>GRUNNLAG</h3><label class="f"><span>Segment</span><select class="in" data-mtsegset>'+cfg.segs.map(s=>'<option value="'+esc(s.id)+'"'+(a.segId===s.id?' selected':'')+'>'+esc(s.name)+' ('+s.prio+')</option>').join('')+'</select></label>'+(a.segAuto?'<p class="mt-hint">Segmentet er foreslått fra navn og eksisterende segment. Endre ved behov.</p>':'')+
    '<ul class="mt-rl">'+MT_RULES.filter(r=>cfg.rules[r.k]).map(r=>'<li class="'+(fails.some(f=>f.k===r.k)?'bad':'ok')+'">'+esc(r.t)+'</li>').join('')+'<li class="'+(fails.some(f=>f.k==='seg')?'bad':'ok')+'">Segmentet er aktivt</li></ul>'+
    (a.qual.by==='manuell'?'<p class="mt-hint">'+(a.qual.state==='qualified'?'Manuelt kvalifisert':'Diskvalifisert')+(a.qual.reason?': '+esc(a.qual.reason):'')+(a.qual.byName?' ('+esc(a.qual.byName)+')':'')+'.</p>':'')+(a.warn?'<p class="mt-note warn">'+esc(a.warn)+'</p>':'')+
    '<dl class="mt-ok"><dt>Domene</dt><dd>'+esc(a.domain||'–')+'</dd><dt>Org.nr.</dt><dd>'+esc(a.orgnr||'–')+'</dd><dt>Sted</dt><dd>'+esc(a.place||'–')+'</dd></dl>'+
    '<div class="row"><button type="button" class="btn sm" data-mtd="edit">Rediger grunnlag</button>'+(a.qual.by==='manuell'?'<button type="button" class="btn ghost sm" data-mtd="resetq">Tilbake til reglene</button>':(!a.flags.qualified&&!a.flags.disqualified?'<button type="button" class="btn ghost sm" data-mtd="manq">Kvalifiser manuelt</button>':''))+'</div>'+(D.edit==='basis'?mtEditHTML(a):'')+
    '<p class="mt-hint">'+esc(a.src==='profil'?'Profil fra åpne kilder i september 2026, ikke verifisert av huset.':a.src==='crm'?'Fra kundeoversikten.':a.src==='research'?'Funnet i research. Kilde og kontrolldato står under Kilder.':'Lagt til som '+a.src+'.')+'</p>'+(a.why?'<p class="mt-hint">Profilens vinkling (ikke verifisert): '+esc(a.why)+'</p>':'')+'</section>';
  return ev+room+ps+jb+grunn; }
const BK_OUTL={klar:'Klar for kontakt',vurdering:'Trenger vurdering',ingen_kontakt:'Fant ingen relevant kontakt',mangler_grunnlag:'Mangler researchgrunnlag',enrolled:'Lagt i sekvens'};

/* ---------- kortet ---------- */
function mtDrawerHTML(a){
  const D=UI.mt.dr; if(!D.tab) D.tab='ov'; const pr=mtPrimary(a), cfg=mtCfg();
  const more='<details class="mt-menu mt-dm"><summary class="btn">Mer<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></summary><div class="mt-mi" role="menu">'+[...(a.flags.enriched&&!bkActive(a.job)?[['berik','Berik på nytt']]:[]),['assign','Tildel'],['log','Logg kontakt'],['org','Åpne kundekort'],['done',a.doc&&a.doc.done?'Fjern ferdigmarkering':'Marker som ferdig vurdert'],['apollo','Eksporter · Apollo CSV (fallback)'],['dq','Diskvalifiser']].map(([k,n])=>'<button type="button" role="menuitem" data-mtd="'+k+'">'+n+'</button>').join('')+'</div></details>';
  const dq=D.dq?'<div class="mt-dq"><label class="f"><span>Årsak til diskvalifisering (påkrevd)</span><select class="in" id="mtDqS"><option value="">Velg årsak</option>'+['Ikke relevant segment','Ingen dokumenterte arrangementer','Har egne lokaler','Konkurrent','Duplikat','Finnes ikke lenger'].map(x=>'<option>'+x+'</option>').join('')+'<option value="__">Annen årsak …</option></select></label><label class="f"><span>Merknad</span><input class="in" id="mtDqT" placeholder="Fylles ut ved «Annen årsak»"></label><div class="row"><button type="button" class="btn sm danger" data-mtd="dqgo">Diskvalifiser</button><button type="button" class="btn ghost sm" data-mtd="cancel">Avbryt</button></div></div>':'';
  const act=pr&&pr[0]==='wait'?'<button type="button" class="btn" disabled>'+pr[1]+'</button>':pr&&pr[0]!=='start'?'<button type="button" class="btn primary" data-'+(pr[0]==='berik'?'bk':'mtd')+'="'+pr[0]+'">'+pr[1]+'</button>':!pr?'<span class="chip red">Ikke kontakt</span>':'';
  const meta=[mtSegLabel(a),a.batch?a.batch.name:''].filter(Boolean).map(esc).join(' · ');
  const body=D.tab==='kon'?bkKontakter(a):D.tab==='akt'?bkAktivitet(a):D.tab==='kil'?bkKilder(a):bkOversikt(a);
  return '<aside class="drawer mt-dr bk-dr" role="dialog" aria-modal="true" aria-label="'+esc(a.name)+'"><header><div class="dh-t"><h2>'+esc(a.name)+'</h2><span class="o">'+meta+'</span></div><button class="x" type="button" aria-label="Lukk" data-mtx="1">×</button></header>'+
   '<div class="bk-nx"><p class="mt-nxl"><b>Neste:</b> '+esc(a.nx.t)+(a.nx.due?' · '+esc(mtFd(a.nx.due)):'')+'</p><div class="mt-act">'+act+more+'</div></div>'+
   '<nav class="bk-tabs" role="tablist" aria-label="Accountkort">'+BKD_TABS.map(([k,n])=>'<button type="button" role="tab" aria-selected="'+(D.tab===k)+'" data-bkt="'+k+'">'+n+'</button>').join('')+'</nav>'+
   '<div class="body bk-body">'+dq+body+'</div></aside>'; }

const _bkWD=mtWireDrawer;
mtWireDrawer=function(root,a){
  const U=UI.mt, D=U.dr, rr=()=>mtOverlay(true), TAB={qual:'kil',edit:'kil',roomedit:'kil',manq:'kil',resetq:'kil',rolesedit:'kon',addp:'kon',log:'akt',assign:'akt'};
  root.querySelectorAll('[data-mtd]').forEach(b=>b.addEventListener('click',()=>{ if(TAB[b.dataset.mtd]) D.tab=TAB[b.dataset.mtd]; if(b.dataset.mtd==='apollo') D.tab=D.tab; }));
  _bkWD(root,a);
  root.querySelectorAll('[data-bkt]').forEach(b=>b.addEventListener('click',()=>{ D.tab=b.dataset.bkt; rr(); const bd=root.querySelector('.drawer .body'); if(bd) bd.scrollTop=0; }));
  enrWire(root);
  root.querySelectorAll('[data-bk]').forEach(b=>b.addEventListener('click',async()=>{ const k=b.dataset.bk, m=root.querySelector('.mt-menu[open]'); if(m) m.open=false;
    if(k==='berik'){ b.disabled=true; await bkOne(a.id); }
    else if(k==='start'){ D.start=true; D.tab='ov'; rr(); } }));
  /* «Berik på nytt» ligger i Mer-menyen med data-mtd */
  root.querySelectorAll('[data-mtd="berik"]').forEach(b=>b.addEventListener('click',async()=>{ const m=root.querySelector('.mt-menu[open]'); if(m) m.open=false; await bkOne(a.id); }));
  root.querySelectorAll('[data-bkst]').forEach(b=>b.addEventListener('click',async()=>{ const k=b.dataset.bkst, p=a.active[0]; if(!p) return;
    if(k==='mail'){ UI.ml.target='p:'+a.id; UI.ml.intent=a.kind==='reaktivering'?'former':'first'; UI.ml.dealId=''; UI.ml.gen=''; mtClose(); go('maler'); }
    else if(k==='tel'){ D.start=false; D.log=true; D.tab='akt'; D.lg={ch:'telefon',dir:'out',pid:p.id,res:'',need:'',obj:'',text:''}; rr(); }
    else if(k==='li'){ const u=bkLink(p.linkedin); if(u) window.open(u,'_blank','noopener'); }
    else if(k==='seq'){ D.seq=!D.seq; rr(); setTimeout(()=>{ const i=root.querySelector('#bkSeqN'); if(i) i.focus(); },30); }
    else if(k==='seqx'){ D.seq=false; rr(); }
    else if(k==='seqgo'){ const nm=(root.querySelector('#bkSeqN')||{}).value||''; D.seqName=nm; const r=await bkEnroll(a.id,nm); if(r.err){ toast(r.err); return; } D.seq=false; D.start=false; toast('Enrollment ligger i køen. Ingenting er sendt.'); rr(); } }));
  root.querySelector('#bkSeqN')?.addEventListener('input',e=>{ D.seqName=e.target.value; });
};

/* ---------- Arbeidsliste ---------- */
function bkContactCell(a){
  if(a.active.length){ const p=a.active[0], em=mtVerLabel(p,'email'); return '<span class="mt-cn">'+esc(p.name)+(p.title?' <small>'+esc(p.title)+'</small>':'')+(p.email&&em.k==='ok'?'<small class="bk-vv">verifisert e-post</small>':'')+'</span>'; }
  if(a.persons.length) return '<span class="mt-seek">'+a.persons.length+' må vurderes</span>';
  return '<span class="mt-seek">'+esc(mtRoleText(a).replace(/^Ser etter: /,''))+'</span>'; }
function mtArbHTML(){
  const L=mtWorking(), today=mtToday(), G=[[],[],[],[],[]]; for(const a of L) G[mtGroupOf(a,today)].push(a);
  const panels=bkPanels();
  if(!L.length) return panels+'<div class="es"><h3>Ingen prospekter i aktiv arbeidsliste ennå</h3><p>Legg kvalifiserte accounts fra Målmarked i neste batch når arbeidet starter.</p><button type="button" class="btn" data-mttab="mal">Åpne Målmarked</button></div>';
  const sum='<div class="mt-sum">'+MT_GROUPS.slice(0,4).map((n,i)=>G[i].length?'<span><b>'+G[i].length+'</b> '+n.toLowerCase()+'</span>':'').join('')+'</div>';
  const bar='<div class="mt-lh">'+ownFilterHTML('Vis arbeidslisten etter ansvarlig')+sum+'</div>';
  const act=a=>{ const k=a.nx.k, lbl=mtActLabel(a);
    if(k==='enrich'&&bkActive(a.job)) return '<span class="bk-wt">'+(a.job.blocked?'Ikke startet':'Beriker …')+'</span>';
    if(k==='enrich') return '<button type="button" class="btn sm" data-bkdo="'+esc(a.id)+'">Berik</button>';
    if(k==='ready') return '<button type="button" class="btn sm primary" data-mtdo="'+esc(a.id)+'">Start kontakt</button>';
    return mtNextCell(a)+'<button type="button" class="btn sm" data-mtdo="'+esc(a.id)+'">'+lbl+'</button>'; };
  return panels+bar+'<div class="tbl mt-tw"><table class="mt-t mt-w mt-list bk-w"><thead><tr><th>Organisasjon</th><th>Segment</th><th>Kontakt</th><th>Status</th><th>Neste steg</th></tr></thead><tbody>'+
   G.map((g,i)=>g.length?'<tr class="mt-g"><th colspan="5">'+MT_GROUPS[i]+' <span>'+g.length+'</span></th></tr>'+g.sort((x,y)=>(x.nx.due||'9').localeCompare(y.nx.due||'9')||y.fit.total-x.fit.total).map(a=>{ const s=bkStatus(a); return '<tr data-mtacc="'+esc(a.id)+'" tabindex="0"><td class="mt-o">'+(a.nx.k==='enrich'&&!bkActive(a.job)?'<input type="checkbox" class="bk-sel" data-bksel="'+esc(a.id)+'" aria-label="Velg '+esc(a.name)+'"'+(ENR.sel.has(a.id)?' checked':'')+'> ':'')+'<b>'+esc(a.name)+'</b></td><td>'+esc(mtSegLabel(a))+(a.prio?' · '+a.prio:'')+'</td><td class="mt-cv">'+bkContactCell(a)+'</td><td><span class="bk-chip '+s[1]+'">'+esc(s[0])+'</span></td><td class="mt-nc bk-na">'+act(a)+'</td></tr>'; }).join(''):'').join('')+'</tbody></table></div>';
}
/* motorstatus i Sekvenser */
function mtApolloBox(){
  const P=bkProviders(), n=bkPending();
  return '<section class="mt-sec bk-eng"><div class="mt-sh"><h3>Berik-motor</h3><span class="mt-hint">Hva som kjører hvor</span></div><ul class="bk-pv">'+P.map(p=>'<li><b>'+esc(p.name)+'</b><span>'+esc(p.via)+'</span><em class="'+(p.state==='Ikke tilkoblet'||/Ikke tilkoblet/.test(p.state)?'off':/Brukt/.test(p.state)?'ok':'')+'">'+esc(p.state)+'</em></li>').join('')+'</ul>'+
   '<p class="mt-note">Salong kjører ikke enrichment selv. Berik legger jobber i kø; <b>Claude-økten</b> utfører dem (research og Apollo-connector) og skriver resultatet tilbake. Ingenting kjører autonomt ennå, og ingenting simuleres. Datamodellen (provider, status, started_at, completed_at, error, result_version) er klar for en egen backend senere.</p>'+
   '<div class="row"><span class="chip '+(n?'a':'')+'">'+n+' jobb'+(n===1?'':'er')+' i kø</span><button type="button" class="btn sm" data-bkcopy="1">Kopier «'+BK_CMD+'»</button></div></section>'; }

const _bkPW=V.prosp.wire; V.prosp.wire=function(v){ _bkPW(v); bkWirePanels(v);
  v.querySelectorAll('[data-bkdo]').forEach(b=>b.addEventListener('click',async e=>{ e.stopPropagation(); b.disabled=true; await bkOne(b.dataset.bkdo); })); };
