/* ---------- cdisc.js: kontaktfunn i flere runder (rene funksjoner, ingen nettverk, ingen DOM) ----------
   Mål: kandidat-recall først, rangering etterpå. Ingenting her finner på personer. Alt som returneres kommer fra tekst en kilde faktisk har gitt,
   og hver kandidat bærer bevis (hvilken side, hvilket sitat, hvilken kilde). Selve søket (Exa, Apollo) ligger i enrsvc.js.

   1. FUNKSJONSFAMILIER (CD_FAM): grupper av roller som eier arrangement, med tittelutvidelse (norsk og engelsk). Ikke eksakte titler.
   2. CD_SEG: rekkefølgen av familier per segment (hvem eier arrangementene i et forlag, en ambassade, et forskningsinstitutt ...).
   3. cdUnderstand(a): bestemmer familier og runder for én organisasjon ut fra segment, størrelse, dokumentert eventhistorikk og tidligere bruk.
   4. Parsere: ansattlister (nettsider), kontakt- og arrangørnavn på eventsider, personprofiler (Exa), Apollo, generelle adresser.
   5. cdScore: 0–100 med forklaring. Pluss: rolle, dokumentert eventkobling, kommunikasjon/marketing, senioritet, lokasjon, kontaktdata, egen nettside. Minus: feil fagfunksjon, HR, teknisk, tidligere ansatt, utenfor Norge. */
const CD_TUNE={plaus:35,rec:50,minPlaus:3,keep:8,keepMin:20,budget:14,maxTerms:14};
const CD_FAM={
 events:{label:'Events og arrangement',re:/event|arrangement|konferanse|conference|congress|kongress|messe\b|kurs og konferanse/i,
   terms:['event','events','event manager','events manager','event coordinator','events coordinator','event lead','head of events','arrangement','arrangementsansvarlig','arrangementskoordinator','konferanse','konferanseansvarlig','kurs og konferanse','møte og arrangement']},
 comms:{label:'Kommunikasjon og presse',re:/communicat|kommunikasjon|\bpr\b|\bpr-|presse|\bpress\b|public relations|media relations|publisist|publicist|informasjonssjef|informasjonsrådgiver|nettredaktør|redaktør|content/i,
   terms:['communications','communication','communications manager','head of communications','communications director','kommunikasjon','kommunikasjonssjef','kommunikasjonsrådgiver','senior kommunikasjonsrådgiver','kommunikasjonsdirektør','presse','PR','pressekontakt','pressesjef','publisist','publicist']},
 formidling:{label:'Formidling',re:/formidl|outreach|public engagement/i,terms:['formidling','formidlingsleder','formidlingsansvarlig','formidlingsrådgiver','outreach']},
 program:{label:'Program',re:/program/i,terms:['programme manager','program manager','programansvarlig','programleder','programsjef','programme director']},
 proj:{label:'Prosjekt og konferanseansvar',re:/prosjektleder|prosjektansvarlig|prosjektkoordinator|project (manager|lead|coordinator)/i,terms:['prosjektleder','senior prosjektleder','prosjektkoordinator','project manager']},
 marketing:{label:'Marketing og marked',re:/marketing|markeds|\bmarked\b|markedsføring|demand gen|brand|merkevare|kampanje|growth/i,
   terms:['marketing','head of marketing','marketing manager','marketing director','field marketing','partner marketing','demand generation','marked','markedssjef','markedsansvarlig','markedsdirektør']},
 field:{label:'Field marketing',re:/field marketing|feltmarkedsf|regional marketing/i,terms:['field marketing','field marketing manager','regional marketing manager']},
 demand:{label:'Demand generation',re:/demand gen|growth marketing|lead gen/i,terms:['demand generation','demand generation manager','growth marketing manager']},
 partnerm:{label:'Partner og channel marketing',re:/partner|channel|alliance|ecosystem/i,terms:['partner marketing','channel marketing','partner marketing manager','alliances manager']},
 sales:{label:'Salg og marked',re:/salg|sales|bokhandel|key account/i,terms:['salgssjef','salgsdirektør','markedssjef','sales manager','key account manager']},
 member:{label:'Medlemsarrangement',re:/member|medlem/i,terms:['member events','medlemsservice','medlemskommunikasjon','member engagement','medlemsansvarlig']},
 kurs:{label:'Kurs og kompetanse',re:/\bkurs|course|opplæring|learning|akademi|academy|kompetanse/i,terms:['kurs','kursansvarlig','kurs og konferanse','kompetanseansvarlig','learning manager']},
 community:{label:'Community og nettverk',re:/communit|nettverk/i,terms:['community manager','community','nettverksansvarlig']},
 extrel:{label:'Eksterne relasjoner',re:/external relations|ekstern|public affairs|partnership|samfunnskontakt|stakeholder|relations/i,terms:['external relations','public affairs','partnerships','eksterne relasjoner','samfunnskontakt']},
 pubdip:{label:'Public diplomacy og kultur',re:/public diplomacy|cultural|kultur|culture|attach[ée]|information officer/i,terms:['public diplomacy','cultural attaché','culture','kultur','kulturrådgiver','cultural affairs','press and culture']},
 polecon:{label:'Politisk, økonomi og handel',re:/political|economic|trade|commercial|handel|næringsliv|politisk/i,terms:['political','economic','trade','commercial','handel','næringsliv']},
 medical:{label:'Medisinsk og faglig',re:/medical|medisinsk|scientific|\bcme\b/i,terms:['medical education','medical affairs','scientific affairs']},
 leadership:{label:'Ledelse',re:/general ?sekret|daglig leder|direktør|director|\bsjef\b|\bleder\b|\bceo\b|head of|managing|forlagssjef|instituttleder|avdelingsleder|rektor|secretary general|seksjonsleder|administrerende|\bpartner\b/i,
   terms:['daglig leder','generalsekretær','forlagssjef','direktør','instituttleder','avdelingsleder','managing director','secretary general','head of']}};
/* rekkefølge per segment: første familie eier sannsynligvis arrangementene */
const CD_SEG={
 forskning:['events','comms','formidling','program','extrel','proj','marketing','leadership'],
 forlag:['marketing','events','comms','sales','program','leadership'],
 fag:['member','events','kurs','comms','program','marketing','leadership'],
 ambassade:['pubdip','comms','events','polecon','leadership'],
 tech:['field','partnerm','events','demand','marketing','community','comms'],
 saas:['field','events','demand','marketing','partnerm','community','comms'],
 pharma:['events','medical','marketing','comms','leadership'],
 ngo:['events','comms','program','formidling','extrel','leadership'],
 utdanning:['events','program','kurs','comms','leadership'],
 offentlig:['comms','events','formidling','program','leadership'],
 byra:['events','marketing','comms','leadership'],
 finans:['events','marketing','comms','community','leadership'],
 konsulent:['events','marketing','comms','community','leadership'],
 bedrift:['events','marketing','comms','community','leadership'],
 ovrige:['events','community','comms','marketing','leadership']};
/* hvilke familier et dokumentert arrangement løfter */
const CD_EVBOOST=[[/lansering|launch|bokslipp|release/i,['marketing','comms']],[/debatt|panel|samtale|foredrag|åpent møte/i,['formidling','comms']],[/webinar/i,['marketing','community']],
 [/fagdag|årsmøte|medlem|generalforsamling/i,['member','events']],[/konferanse|conference|summit|kongress/i,['program','events']],[/seminar|workshop|kurs/i,['program','kurs']]];
const CD_SEGLABEL={forlag:'forlag',forskning:'forskningsinstitutt',fag:'fag- og bransjeorganisasjon',ambassade:'ambassade',tech:'teknologileverandør',saas:'B2B-teknologi',pharma:'helse og pharma',ngo:'NGO eller stiftelse',utdanning:'utdanningsaktør',offentlig:'offentlig virksomhet',byra:'event-/PR-byrå',finans:'finans',konsulent:'rådgivning',bedrift:'bedrift',ovrige:'eventaktiv organisasjon'};

const cdNorm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const cdEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const cdUniq=L=>[...new Set(L.filter(Boolean))];

/* familier som en tittel treffer, mest spesifikke først */
function cdFamsOf(title){
  const t=String(title||''); if(!t) return [];
  const out=[]; for(const k of ['events','member','field','demand','partnerm','pubdip','program','proj','formidling','comms','marketing','sales','kurs','community','extrel','polecon','medical','leadership']) if(CD_FAM[k].re.test(t)) out.push(k);
  return out; }

/* ---------- 3. forstå organisasjonen ---------- */
function cdUnderstand(a){
  const seg=a.segId&&CD_SEG[a.segId]?a.segId:'ovrige', base=CD_SEG[seg].slice(), notes=[], small=a.size==='S';
  const evText=[]; for(const x of ((a.enr&&a.enr.event_signals)||[])) evText.push((x.event_name||x.title||'')+' '+(x.event_type||x.type||''));
  for(const x of (a.evsig||[])) evText.push((x.title||'')+' '+(x.type||''));
  const boosts=[]; for(const [re,fams] of CD_EVBOOST){ const n=evText.filter(t=>re.test(t)).length; if(n) for(const f of fams) boosts.push({f,n,re}); }
  let order=base.slice();
  for(const b of boosts){ const i=order.indexOf(b.f); if(i>1){ order.splice(i,1); order.splice(Math.max(1,i-1),0,b.f); notes.push('Dokumentert eventtype løfter «'+CD_FAM[b.f].label.toLowerCase()+'»'); } else if(i<0&&b.f!=='leadership'&&order.length<8){ order.splice(Math.min(order.length-1,3),0,b.f); notes.push('Dokumentert eventtype legger til «'+CD_FAM[b.f].label.toLowerCase()+'»'); } }
  if(small){ const i=order.indexOf('leadership'); if(i>2){ order.splice(i,1); order.splice(2,0,'leadership'); } notes.push('Liten organisasjon: ledelse tas med tidlig, siden færre har egne eventroller'); }
  order=cdUniq(order); if(!order.includes('leadership')) order.push('leadership');
  const userRoles=(a.roles||[]).filter(Boolean);
  const fams=order.map((id,i)=>({id,label:CD_FAM[id].label,rank:i+1,terms:CD_FAM[id].terms.slice()}));
  const R1=fams.slice(0,3), R2=fams.slice(3,6), R3=fams.slice(6);
  const broad=['proj','comms','program','leadership'].filter(id=>!R1.concat(R2).some(f=>f.id===id)).map(id=>fams.find(f=>f.id===id)||{id,label:CD_FAM[id].label,rank:99,terms:CD_FAM[id].terms.slice()});
  const r3=cdUniq(R3.concat(broad).map(f=>f.id)).map(id=>fams.find(f=>f.id===id)||{id,label:CD_FAM[id].label,rank:99,terms:CD_FAM[id].terms.slice()});
  const rounds={1:R1,2:R2,3:r3};
  const termsOf=(L,extra)=>cdUniq((extra||[]).concat(...L.map(f=>f.terms))).slice(0,CD_TUNE.maxTerms);
  const t1=termsOf(R1,userRoles), t2=termsOf(R2), t3=termsOf(r3);
  const sz=a.size==='S'?'liten':a.size==='L'?'stor':a.size==='M'?'middels stor':'ukjent størrelse';
  const kn=a.rel==='kunde'||a.rel==='fast'||(a.bookings&&a.bookings.length);
  const why=['Segment: '+(CD_SEGLABEL[seg]||seg)+' ('+sz+')'];
  if(evText.length) why.push(evText.length+' dokumentert'+(evText.length===1?'':'e')+' arrangement'+(evText.length===1?'':'er')+' lagt til grunn');
  else why.push('Ingen dokumenterte arrangementer ennå, så rekkefølgen følger segmentet');
  if(kn) why.push('Har brukt Litteraturhuset før: kontakter fra kundekortet har forrang');
  return {seg,families:fams,rounds,terms:{1:t1,2:t2,3:t3},notes:cdUniq(notes),why,small,known:!!kn,
    summary:fams.slice(0,4).map(f=>f.label).join(' → ')}; }

/* ---------- navn og roller ---------- */
const CD_CONN=new Set(['van','von','de','der','den','af','la','di','da','al','el','bin','ten','ter','le','du','zu','del','dos','das']);
const CD_STOP=new Set(('avdeling avdelingen seksjon seksjonen senter senteret institutt instituttet kontakt kontaktinformasjon oss om team teamet medarbeidere ansatte ledelse ledelsen styret styre administrasjon redaksjon redaksjonen forening foreningen forbund forbundet universitet universitetet høyskole høyskolen forlag forlaget as asa ambassade ambassaden norge norges norsk norske nordisk oslo bergen trondheim kontor kontoret selskap selskapet gruppe gruppen stiftelse stiftelsen fond akademi akademiet skole skolen bibliotek museum teater huset hus tjenester tjeneste service support post info telefon tlf epost e-post mail adresse besøk besøksadresse postadresse åpningstider nyheter aktuelt presse press media arrangement arrangementer events program programme kurs konferanse seminar mer les read more se alle vis flere kommunikasjon communications marketing marked sales salg events og for the and of in at hos til fra med uten'.split(' ')));
const CD_ORGW=/forening|forbund|institutt|universitet|høyskole|forlag|ambassade|avdeling|seksjon|senter|stiftelse|museum|bibliotek|akademi|selskap|group|gruppe|holding|\bas\b|\basa\b|\bltd\b|\binc\b|\bab\b/i;
const CD_ROLEHINT=/sjef|leder|publisist|publicist|kommunikatør|rådgiver|radgiver|direktør|direktor|ansvarlig|koordinator|coordinator|manager|director|head\b|advisor|adviser|officer|specialist|spesialist|konsulent|attach|secretary|sekretær|produsent|producer|redaktør|editor|\blead\b|kurator|programme|program\b|kommunikasjon|communications|marketing|\bevents?\b|arrangement|formidl|presse|\bpr\b|analytiker|forsker|researcher|professor|overlege|lege\b|fagsjef|prosjekt|assistent|assistant|executive|president|rektor|dekan|rådgjevar|medarbeider|partner|strateg|designer|utvikler|developer|engineer|ingeniør|jurist|advokat|økonom|controller|regnskap|\bhr\b|rekrutter|recruit/i;
const CD_ROLEEND=/(sjef|leder|rådgiver|direktør|ansvarlig|koordinator|manager|director|advisor|adviser|officer|specialist|spesialist|konsulent|attaché|secretary|sekretær|produsent|producer|redaktør|editor|forsker|analytiker)$/i;
const CD_TAILJUNK=/\s*(kontaktinformasjon|kontakt|se profil|les mer|read more|vis profil|e-post|telefon|tlf\.?|mobil)\b.*$/i;
const CD_DEGREE=/^(cand\.?|phd|ph\.d\.?|msc|dr\.?|ma|ba|mba|mphil|siv\.?|dipl)/i;
const cdIsNameTok=t=>t.length>=2&&/^[A-ZÆØÅÄÖÜÉÈ][A-Za-zÆØÅæøåäöüéèáàóúñçšž'’.-]*$/.test(t)&&/[a-zæøåäöüéèáàóúñçšž]/.test(t)&&!CD_STOP.has(t.toLowerCase().replace(/\.$/,''));
function cdNameFrom(tokens){ // tokens: array, returns {name,n} for the leading person-name tokens, or null
  const out=[]; let i=0;
  while(i<tokens.length&&out.length<4){ const t=tokens[i];
    if(cdIsNameTok(t)){ out.push(t); i++; continue; }
    if(CD_CONN.has(t.toLowerCase())&&out.length&&i+1<tokens.length&&cdIsNameTok(tokens[i+1])){ out.push(t); i++; continue; }
    break; }
  while(out.length&&CD_CONN.has(out[out.length-1].toLowerCase())) out.pop();
  const words=out.filter(x=>!CD_CONN.has(x.toLowerCase()));
  if(words.length<2) return null; if(CD_ORGW.test(out.join(' '))) return null;
  return {name:out.join(' '),n:out.length}; }
function cdCleanLine(s){
  return String(s||'').replace(/\[([^\]]*)\]\(mailto:([^)\s]+)\)/gi,'$1 $2').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/[*_`>#|]+/g,' ').replace(/^[\s\-•·–—]+/,'').replace(/\s+/g,' ').trim(); }
function cdCleanRole(r){
  r=String(r||'').replace(CD_TAILJUNK,'').replace(/\S+@\S+/g,'').replace(/\+?\d[\d\s]{6,}/g,'').trim().replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g,'');
  const parts=r.split(/\s*,\s*/); if(parts.length>1&&CD_DEGREE.test(parts[1])) r=parts[0];
  return r.slice(0,100); }
/* én linje → {name,title} eller null */
function cdLinePerson(line){
  const L=cdCleanLine(line); if(!L||L.length>160||L.length<5) return null;
  const seps=[' – ',' — ',' - ',', ',': ','\t',' | ',' / '];
  for(const sp of seps){ const i=L.indexOf(sp); if(i<3) continue; const left=L.slice(0,i).trim(), right=L.slice(i+sp.length).trim();
    const nl=cdNameFrom(left.split(/\s+/)); if(nl&&nl.name.length===left.length&&CD_ROLEHINT.test(right)){ const t=cdCleanRole(right); if(t&&t.length<=100) return {name:nl.name,title:t}; }
    const nr=cdNameFrom(right.split(/\s+/)); if(nr&&CD_ROLEHINT.test(left)&&!cdNameFrom(left.split(/\s+/))){ const rr=right.slice(nr.name.length).trim(); if(!rr||/^[,;(–-]/.test(rr)||/@/.test(rr)) { const t=cdCleanRole(left); if(t&&t.length<=100) return {name:nr.name,title:t}; } } }
  const tk=L.split(/\s+/), nm=cdNameFrom(tk); if(!nm) return null;
  let rest=tk.slice(nm.n).join(' ').trim(); let name=nm.name;
  if(!rest&&nm.n>=3&&CD_ROLEEND.test(tk[nm.n-1])){ rest=tk[nm.n-1]; name=tk.slice(0,nm.n-1).join(' '); if(cdNameFrom(name.split(/\s+/))===null) return null; }
  rest=cdCleanRole(rest); if(!rest||rest.length>90||!CD_ROLEHINT.test(rest)) return null;
  if(/^(og|and|for|som|der|the)\b/i.test(rest)) return null;
  return {name,title:rest}; }
const CD_EMAIL=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function cdEmailFor(name,lines,i){
  const toks=cdNorm(name).split(' ').filter(x=>x.length>=3); if(!toks.length) return '';
  const win=lines.slice(Math.max(0,i-1),i+3).join(' '), em=win.match(CD_EMAIL)||[];
  for(const e of em){ const lp=cdNorm(e.split('@')[0].replace(/[._-]/g,' ')); if(toks.some(t=>lp.includes(t))) return e.toLowerCase(); }
  return ''; }
/* 4a. ansattliste fra tekst: {name,title,email,quote} */
function cdParseRoster(text){
  const lines=String(text||'').split(/\n/).map(s=>s.trim()), out=[], seen=new Set();
  const add=(name,title,i,q)=>{ const k=cdNorm(name); if(seen.has(k)) return; seen.add(k); out.push({name,title,email:cdEmailFor(name,lines,i),quote:String(q).replace(/\s+/g,' ').slice(0,200)}); };
  for(let i=0;i<lines.length;i++){
    const raw=lines[i]; if(!raw) continue; const c=cdCleanLine(raw);
    const p=cdLinePerson(raw); if(p){ add(p.name,p.title,i,c); continue; }
    // navn alene på en linje, rolle på neste
    const nm=cdNameFrom(c.split(/\s+/)); if(nm&&nm.name===c){ let j=i+1; while(j<lines.length&&!lines[j]) j++;
      if(j<lines.length){ const nx=cdCleanLine(lines[j]); if(nx&&nx.length<=80&&CD_ROLEHINT.test(nx)&&!nx.startsWith(c)&&!cdNameFrom(nx.split(/\s+/))){ const t=cdCleanRole(nx); if(t) add(c,t,i,c+' – '+t); } } } }
  return out; }
/* 4b. kontakt- og arrangørnavn på eventsider */
const CD_EVLAB=/(kontaktperson(?:er)?|kontaktinfo(?:rmasjon)?|kontakt|spørsmål|påmelding|arrangør(?:er)?|arrangementsansvarlig|ansvarlig|prosjektleder|programleder|prosjektansvarlig|contact(?: person)?|organi[sz]er|enquiries|questions)\s*[:–-]\s*/i;
function cdParseEventContacts(text,aliases){
  const lines=String(text||'').split(/\n/).map(s=>s.trim()), out=[], seen=new Set(), al=(aliases||[]).filter(Boolean).map(x=>new RegExp('\\b'+cdEsc(x)+'\\b','i'));
  const add=(o)=>{ const k=cdNorm(o.name)+'|'+o.kind; if(seen.has(k)) return; seen.add(k); out.push(o); };
  for(let i=0;i<lines.length;i++){ const raw=lines[i]; if(!raw) continue; const c=cdCleanLine(raw);
    const m=c.match(CD_EVLAB);
    if(m){ const rest=c.slice(m.index+m[0].length).replace(/\s+(?:på|via|at|e-post|epost|tlf|telefon|tel)[:.\s].*$/i,'').trim();
      let pr=cdLinePerson(rest+(/,|–|-|:/.test(rest)?'':'')), nm=cdNameFrom(rest.split(/[\s,;(]+/).filter(Boolean));
      if(pr){ add({name:pr.name,title:pr.title,kind:'organizer',quote:c.slice(0,200),email:cdEmailFor(pr.name,lines,i)}); }
      else if(nm&&rest.startsWith(nm.name)){ const tl=rest.slice(nm.name.length).replace(/^[\s,;(–-]+/,'').replace(/\).*$/,'').trim(); add({name:nm.name,title:CD_ROLEHINT.test(tl)&&!/@|\d{5}/.test(tl)?cdCleanRole(tl):'',kind:'organizer',quote:c.slice(0,200),email:cdEmailFor(nm.name,lines,i)}); }
      continue; }
    const mm=c.match(/(?:kontakt|spørsmål(?: om [^.]{0,40})?(?: til)?|contact)\s+([A-ZÆØÅ][\wæøå'’.-]+(?:\s+[A-ZÆØÅ][\wæøå'’.-]+){1,2})\s+(?:på|via|at|:)?\s*\S+@\S+/i);
    if(mm){ const nm=cdNameFrom(mm[1].split(/\s+/)); if(nm) add({name:nm.name,title:'',kind:'organizer',quote:c.slice(0,200),email:cdEmailFor(nm.name,lines,i)}); continue; }
    // talere og moderatorer som er ansatt hos organisasjonen
    if(al.length&&al.some(r=>r.test(c))){ const pr=cdLinePerson(c.replace(new RegExp(',?\\s*(?:'+al.map(r=>r.source.replace(/^\\b|\\b$/g,'')).join('|')+')\\b.*$','i'),''));
      if(pr) add({name:pr.name,title:pr.title,kind:'speaker',quote:c.slice(0,200),email:''}); } }
  return out; }
/* 4c. personprofiler (Exa category:people). Krever bekreftet nåværende arbeidsgiver. */
function cdLoc(text){
  const t=String(text||'').slice(0,700);
  let m=t.match(/([A-ZÆØÅ][\wæøåÆØÅ .'-]{1,30}),\s*([A-ZÆØÅ][\wæøåÆØÅ .'-]{1,30}),\s*(Norway|Norge)\b/); if(m) return /oslo/i.test(m[1]+m[2])?'Oslo':'Norge';
  if(/\bOslo\b/.test(t.slice(0,300))) return 'Oslo'; if(/\((NO)\)|\bNorway\b|\bNorge\b/.test(t.slice(0,400))) return 'Norge';
  m=t.match(/,\s*([A-ZÆØÅ][\w .'-]{2,30})\s*\(([A-Z]{2})\)/); if(m&&m[2]!=='NO') return 'utland:'+m[1].trim();
  m=t.match(/,\s*(Sweden|Denmark|Finland|United Kingdom|Germany|United States|Netherlands|France|Spain|Poland|Ireland|Belgium|Switzerland|Canada)\b/); if(m) return 'utland:'+m[1];
  return ''; }
function cdAliasRe(aliases){ const L=(aliases||[]).filter(x=>x&&String(x).trim().length>=3).map(x=>cdEsc(String(x).trim())); return L.length?new RegExp('(?:^|[^\\p{L}\\d])(?:'+L.join('|')+')(?![\\p{L}\\d])','iu'):null; }
function cdParseLinkedIn(results,aliases){
  const re=cdAliasRe(aliases), out=[]; let dropped=0;
  for(const r of (results||[])){ if(!/(^|\.)linkedin\.com$/i.test(cdHost(r.url))||!/\/in\//.test(r.url)) continue;
    const nm=String(r.title||'').replace(/\s*[-–|].*$/,'').trim(), nt=cdNameFrom(nm.split(/\s+/)); if(!nt||nt.name!==nm){ dropped++; continue; }
    const text=String(r.text||''), head=text.slice(0,2500), lines=text.split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(!re||!re.test(head)){ dropped++; continue; }
    // nåværende rolle: «### Tittel - [Org](..) (Current)» eller «#### Tittel (Current)» under org
    let title='', cur=null;
    for(let i=0;i<lines.length;i++){ const l=lines[i]; if(!/\(Current\)|\(nåværende\)/i.test(l)) continue; const near=lines.slice(Math.max(0,i-2),i+1).join(' ');
      if(!re.test(near)&&!re.test(lines.slice(Math.max(0,i-4),i).join(' '))) continue;
      const t=l.replace(/\(Current\)|\(nåværende\)/ig,'').replace(/^#+\s*/,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').trim().split(/\s+[-–]\s+/)[0].trim();
      if(t&&!re.test(' '+t+' ')&&t.length<=90){ title=t; cur=true; break; } if(t&&re.test(' '+t+' ')){ const ti=lines[i+1]||''; /* tittel kan stå på linjen etter org */ }
    }
    const hl=lines.find(l=>!/^#|^\[|^http|^-+$/.test(l)&&l.length<=140&&re.test(' '+l+' '))||'';
    if(!title&&hl){ title=hl.replace(/\s+(i|at|@|hos|,|\||-|–)\s+.*$/i,'').trim(); }
    if(!title) title=(lines[0]||'').replace(/\s+(i|at|@|hos|,)\s+.*$/i,'').slice(0,90);
    if(cur===null){ cur=/\(Current\)|present|nåværende/i.test(head)?true:null; }
    out.push({name:nm,title:cdCleanRole(title),linkedin:r.url.split('?')[0],loc:cdLoc(text),cur,orgOk:true,quote:(hl||title).slice(0,200),url:r.url}); }
  return {people:out,dropped}; }
const cdHost=u=>{ try{ return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); }catch(e){ return ''; } };
const cdOwn=(u,dom)=>{ const h=cdHost(u), d=String(dom||'').replace(/^www\./,'').toLowerCase(); return !!h&&!!d&&(h===d||h.endsWith('.'+d)); };
/* 4d. Apollo */
function cdFromApollo(P){
  const out=[]; for(const p of (P||[])){ const last=p.last_name||p.last_name_obfuscated||'', first=p.first_name||'', name=(p.name||[first,last].filter(Boolean).join(' ')).trim(); if(!name||!p.title) continue;
    const masked=/\*/.test(last)||/\*/.test(name); out.push({name,title:String(p.title).slice(0,100),apolloId:p.id||'',linkedin:p.linkedin_url||'',loc:p.country?(/norway|norge/i.test(p.country)?(/oslo/i.test(p.city||'')?'Oslo':'Norge'):'utland:'+p.country):'',masked,email:'',orgOk:true,cur:true}); }
  return out; }
/* 4e. generelle adresser og telefon (aldri en person) */
const CD_GENLOCAL=/^(post|postmottak|firmapost|info|kontakt|kontor|mail|hello|hei|office|contact|hovedkontor|resepsjon|reception|booking|press|presse|media|kommunikasjon|communications|events?|arrangement|marked|marketing)$/i;
function cdParseGeneral(text,dom){
  const emails=[], phones=[], seen=new Set(); const t=String(text||'');
  for(const e of (t.match(CD_EMAIL)||[])){ const l=e.toLowerCase(), [lp,d]=l.split('@'); if(!CD_GENLOCAL.test(lp)) continue; if(dom&&!(d===dom||d.endsWith('.'+dom))) continue; if(seen.has(l)) continue; seen.add(l); emails.push({v:l,kind:/^(post|postmottak|firmapost|info|kontakt|kontor|mail|hello|hei|office|contact|hovedkontor|resepsjon|reception)$/i.test(lp)?'generell':'rolle'}); }
  const re=/(?:tlf|telefon|tel|phone)\.?\s*:?\s*((?:\+|00)?47[\s-]?)?((?:\d[\s-]?){8})/gi; let m;
  while((m=re.exec(t))){ const d=m[2].replace(/\D/g,''); if(d.length!==8) continue; const v='+47 '+d.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/,'$1 $2 $3 $4'); if(!phones.includes(v)) phones.push(v); }
  return {emails,phones}; }
/* sidetype etter sti. Prioritet: team/kontakt > event/program > nyheter/presse */
const CD_PATHS={team:/\/(about|about-us|team|people|contacts?|staff|employees|organi[sz]ation|organi[sz]asjon|kommunikasjon|om-oss|om|ansatte|kontakt|kontakt-oss|medarbeidere?|avdeling|leadership|ledelse)(\/|$|\?|-)/i,
  event:/\/(arrangement(er)?|events?|calendar|kalender|program(me)?|kurs-og-konferanser|konferanser?|seminar(er)?|aktivitet(er)?|moter)(\/|$|\?|-)/i,news:/\/(news|aktuelt|press|presse|media|nyheter|pressemelding(er)?)(\/|$|\?|-)/i};
function cdPageKind(url){ const u=String(url||''); if(/\.pdf(\?|$)/i.test(u)) return 'pdf'; let p=''; try{ p=new URL(u).pathname+'/'; }catch(e){ p=u; }
  if(CD_PATHS.team.test(p)) return 'team'; if(CD_PATHS.event.test(p)) return 'event'; if(CD_PATHS.news.test(p)) return 'news'; return 'other'; }
const CD_PROBE=['/kontakt','/kontakt-oss','/om-oss','/ansatte','/team','/about','/contact','/people','/staff'];
const CD_PAGEORDER={team:0,event:1,pdf:1,news:2,other:3};

/* ---------- 5. scoring ---------- */
const CD_WRONG=/økonom|finance|accountant|regnskap|jurist|lawyer|advokat|legal|counsel|ingeniør|engineer|utvikler|developer|data ?scientist|analytiker|forsker|researcher|overlege|\blege\b|sykepleier|professor|postdoc|stipendiat|bibliotekar|arkivar|statistiker|epidemiolog|bioinformat|laborat|innkjøp|procurement|logistikk|controller|seniorforsker|førsteamanuensis/i;
const CD_HR=/\bhr\b|human resources|rekrutter|recruit|talent acquisition|people (&|and) culture|lønn|personal(sjef|rådgiver)|bemanning/i;
const CD_TECH=/\bit\b|\bit-|teknisk|technical|systemadministrator|sysadmin|devops|infrastruktur|arkitekt|sikkerhet|security|helpdesk|support|drift\b|cto\b/i;
const CD_FORMER=/\b(former|tidligere|ex-|previously|emeritus|pensjonist|retired)\b/i;
function cdSeniority(title,small){
  const t=String(title||'');
  if(/intern\b|trainee|assistent|assistant|praktikant|student/i.test(t)) return [2,'junior rolle'];
  if(/\bceo\b|chief|administrerende|managing director|president|generalsekret|daglig leder|rektor|direktør.*(forskning|institutt)/i.test(t)) return small?[10,'leder i liten organisasjon']:[6,'toppledelse, ofte for høyt oppe'];
  if(/head of|director|direktør|sjef\b|leder\b|manager|ansvarlig|\blead\b|koordinator|coordinator|senior|fagsjef|partner/i.test(t)) return [10,'riktig nivå (leder, ansvarlig eller senior)'];
  if(/rådgiver|advisor|adviser|spesialist|specialist|officer|konsulent|producer|produsent|redaktør|editor|attach/i.test(t)) return [7,'saksbehandler- eller rådgivernivå'];
  return [4,'nivå ikke oppgitt']; }
/* a: account (med size, segId), p: person, U: cdUnderstand(a). Returnerer {score,parts,neg,fam,why} */
function cdScore(a,p,U){
  const cd=p.cd||{}, ev=cd.ev||[], title=p.title||'', fams=cdFamsOf(title), parts=[], neg=[];
  const rank=id=>{ const f=U.families.find(x=>x.id===id); return f?f.rank:99; };
  const topFam=fams.slice().sort((x,y)=>rank(x)-rank(y))[0]||'';
  /* rolle som passer eventansvar */
  let rp=0, rt='';
  if(fams.includes('events')){ rp=30; rt='eventrolle'; }
  else if(topFam&&rank(topFam)<=2&&topFam!=='leadership'){ rp=24; rt=CD_FAM[topFam].label.toLowerCase()+' er funksjon '+rank(topFam)+' i dette segmentet'; }
  else if(fams.some(f=>['program','proj','member','kurs','pubdip','community','field','partnerm','formidling'].includes(f))){ const f=fams.find(x=>['program','proj','member','kurs','pubdip','community','field','partnerm','formidling'].includes(x)); rp=18; rt=CD_FAM[f].label.toLowerCase()+' ligger nær arrangementsansvar'; }
  else if(fams.includes('leadership')){ rp=U.small?10:6; rt=U.small?'ledelse i liten organisasjon':'ledelse, fallback når ingen eier arrangement'; }
  else if(topFam){ rp=10; rt=CD_FAM[topFam].label.toLowerCase(); }
  if(rp) parts.push({k:'role',pts:rp,t:rt});
  /* kommunikasjon, formidling og marketing */
  if(fams.some(f=>['comms','formidling','marketing','sales'].includes(f))){ const f=fams.find(x=>['comms','formidling','marketing','sales'].includes(x)); parts.push({k:'comm',pts:15,t:CD_FAM[f].label.toLowerCase()+' som relevant funksjon'}); }
  /* dokumentert kobling til arrangement */
  const kinds=ev.map(e=>e.k);
  if(kinds.includes('organizer')) parts.push({k:'doc',pts:20,t:'navngitt som kontakt eller arrangør på en eventside'});
  else if(kinds.includes('press')) parts.push({k:'doc',pts:10,t:'navngitt som pressekontakt'});
  else if(kinds.includes('speaker')) parts.push({k:'doc',pts:8,t:'omtalt som ansatt på en eventside'});
  /* senioritet */
  const [sp,st]=cdSeniority(title,U.small); if(title&&sp) parts.push({k:'sen',pts:sp,t:st});
  /* lokasjon */
  const loc=cd.loc||'';
  if(loc==='Oslo') parts.push({k:'loc',pts:10,t:'Oslo'}); else if(loc==='Norge') parts.push({k:'loc',pts:6,t:'Norge'}); else if(!loc&&/\.no$/.test(a.domain||'')&&!/utland/.test(loc)) parts.push({k:'loc',pts:3,t:'lokasjon ikke oppgitt, norsk domene'});
  /* verifisert kontaktdata */
  const ver=p.email&&p.emailStatus==='verifisert'&&p.verifiedAt;
  if(ver) parts.push({k:'data',pts:10,t:'verifisert e-post'}); else if(p.email&&ev.some(e=>e.k==='team'||e.k==='organizer')) parts.push({k:'data',pts:7,t:'e-post oppgitt på organisasjonens nettside'}); else if(p.email) parts.push({k:'data',pts:5,t:'e-post oppgitt, ikke verifisert'}); else if(p.phone) parts.push({k:'data',pts:4,t:'telefon oppgitt'}); else if(p.linkedin||cd.linkedin) parts.push({k:'data',pts:2,t:'bare LinkedIn-profil'});
  /* egen nettside */
  if(ev.some(e=>e.url&&cdOwn(e.url,a.domain))) parts.push({k:'site',pts:5,t:'dokumentert på organisasjonens nettside'});
  /* minus */
  if(title&&CD_HR.test(title)) neg.push({k:'hr',pts:-20,t:'HR eller rekruttering'});
  else if(title&&CD_WRONG.test(title)&&!fams.some(f=>['events','comms','marketing','program','formidling'].includes(f))) neg.push({k:'wrong',pts:-25,t:'fagfunksjon uten tilknytning til arrangement'});
  else if(title&&CD_TECH.test(title)&&!fams.some(f=>['events','comms','marketing','program'].includes(f))) neg.push({k:'tech',pts:-20,t:'teknisk eller intern rolle uten eventrelevans'});
  if(cd.cur===false||CD_FORMER.test(title)) neg.push({k:'former',pts:-15,t:'tidligere ansatt'});
  if(/^utland/.test(loc)) neg.push({k:'abroad',pts:-15,t:'bosatt utenfor Norge ('+loc.replace('utland:','')+')'});
  if(cd.masked) neg.push({k:'masked',pts:-10,t:'etternavn skjult i Apollo, krever enrichment for å bekrefte'});
  const sum=parts.reduce((s,x)=>s+x.pts,0)+neg.reduce((s,x)=>s+x.pts,0), score=Math.max(0,Math.min(100,sum));
  const why=parts.filter(x=>x.pts>=5).sort((x,y)=>y.pts-x.pts).map(x=>x.t); const bad=neg.map(x=>x.t);
  return {score,parts,neg,fam:topFam,why,bad,plaus:score>=CD_TUNE.plaus,sum}; }
/* sammenslåing av én kandidat inn i en liste (samme person fra flere kilder = ett navn med flere bevis) */
function cdMerge(list,c){
  const k=cdNorm(c.name), idx=list.findIndex(x=>cdNorm(x.name)===k||(c.linkedin&&x.linkedin&&x.linkedin===c.linkedin)||(c.apolloId&&x.apolloId&&x.apolloId===c.apolloId)||(c.email&&x.email&&x.email===c.email));
  if(idx<0){ list.push({...c,ev:(c.ev||[]).slice()}); return list[list.length-1]; }
  const x=list[idx]; for(const f of ['title','email','phone','linkedin','apolloId','loc']) if(!x[f]&&c[f]) x[f]=c[f];
  if(c.title&&(!x.title||/^(senior)?(medarbeider)$/i.test(x.title))) x.title=c.title;
  if(c.cur===false) x.cur=false; else if(x.cur==null&&c.cur!=null) x.cur=c.cur;
  x.masked=x.masked&&c.masked; x.rounds=cdUniq((x.rounds||[]).concat(c.rounds||[]));
  for(const e of (c.ev||[])) if(!x.ev.some(y=>y.k===e.k&&y.url===e.url)) x.ev.push(e);
  return x; }
