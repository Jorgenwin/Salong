/* ---------- enrsvc.js: enrichment som tilstandsmaskin og tjeneste ----------
   Erstatter det gamle «Berik feilet» med en eksplisitt tilstand per account. Tilstandene beskriver hva som faktisk skjedde:

     not_started → queued → researching_company → researching_events → searching_people → enriching_people → (slutt)
     slutt: ready · needs_review · partial · no_person_found · provider_blocked · provider_error

   «Fant ingen trygg kontaktperson» er et resultat (no_person_found), ikke en feil. Rødt brukes bare for provider_error.
   Tilstanden lagres på jobben (state, stage, history, pipeline) og avledes på nytt fra data hver gang (enrDerive), slik at et kontaktvalg
   flytter accounten til «Klar» uten at noen setter en status for hånd.

   Lagdeling (spesifikasjon T):
     UI → crm.enrichment.enrichAccount(id) → EnrichmentService.enrichAccount → enrPipeline(a, io)
     enrPipeline kjenner verken DOM, database eller kø. Den får to providers (WebResearchProvider, ApolloProvider) og en io med report/checkpoint.
     Siden implementerer io med mt*-funksjonene og jobbkøen. En backend implementerer samme io mot sin database og eksponerer
     POST /api/enrichment/accounts/:id. UI-et endres ikke. */

const ENR_RUN=['queued','researching_company','researching_events','searching_people','enriching_people'];
const ENR_ST={
  not_started:{l:'Ikke beriket',t:'',g:'need',stage:''},
  queued:{l:'I kø',t:'a',g:'run',stage:'Venter på tur'},
  researching_company:{l:'Research pågår',t:'a',g:'run',stage:'Researcher organisasjonen'},
  researching_events:{l:'Research pågår',t:'a',g:'run',stage:'Researcher arrangementer'},
  searching_people:{l:'Research pågår',t:'a',g:'run',stage:'Søker personer'},
  enriching_people:{l:'Research pågår',t:'a',g:'run',stage:'Samler kontaktdata'},
  needs_review:{l:'Trenger vurdering',t:'warn',g:'review',stage:''},
  partial:{l:'Trenger vurdering',t:'warn',g:'review',stage:''},
  ready:{l:'Kontakt klar',t:'ok',g:'ready',stage:''},
  no_person_found:{l:'Ingen kontakt funnet',t:'mute',g:'none',stage:''},
  provider_blocked:{l:'Apollo utilgjengelig',t:'warn',g:'block',stage:''},
  provider_error:{l:'Research-feil',t:'bad',g:'block',stage:''}};
const ENR_FINAL=['ready','needs_review','partial','no_person_found','provider_blocked','provider_error'];
/* tillatte overganger. Alt som ikke står her avvises av enrAdvance og lar tilstanden stå. */
const ENR_FLOW=(()=>{ const f={not_started:['queued']}, run=ENR_RUN;
  run.forEach((s,i)=>{ f[s]=run.slice(i+1).concat(ENR_FINAL); }); ENR_FINAL.forEach(s=>{ f[s]=['queued']; }); return f; })();
function enrAdvance(from,to){ if(from===to) return to; const ok=ENR_FLOW[from||'not_started']; return ok&&ok.includes(to)?to:from; }
const ENR_GROUPS=[['ready','KLAR FOR KONTAKT'],['review','TRENGER VURDERING'],['need','TRENGER KONTAKTDATA'],['run','RESEARCH PÅGÅR'],['block','BLOKKERT / FEIL']];

/* ---------- språk: rå connector-tekst vises aldri i hovedgrensesnittet ---------- */
const ENR_BLOCKRE=/kobling|tilgang|connector|server_not|approval|consent|not_granted|needs_reauth|manifest|capability|blocked_by|not_connected|selection_required/i;
function enrJobState(j){
  if(!j) return ''; if(j.state&&ENR_ST[j.state]) return j.state;
  if(j.status==='cancelled') return '';
  if(j.status==='queued'&&j.blocked) return 'provider_blocked';
  if(j.status==='queued'||j.status==='running') return 'queued';
  if(j.status==='error') return ENR_BLOCKRE.test((j.error||'')+' '+JSON.stringify(j.errors||[]))?'provider_blocked':'provider_error';
  const o=j.outcome; return o==='klar'?'ready':o==='vurdering'?'needs_review':'no_person_found'; }
function enrProvNames(j,kind){ const pv=(j&&j.pv)||{}, L=['web','apollo'].filter(k=>pv[k]===kind); return L; }
function enrBlockedText(j){ const L=enrProvNames(j,'blocked'); if(L.length===2) return 'Koblingene mangler akkurat nå'; if(L[0]==='web') return 'Web-tilgang mangler akkurat nå'; return 'Apollo-tilgang mangler akkurat nå'; }
function enrErrorText(j){ const L=enrProvNames(j,'error'); if(L.length===2) return 'Research svarte ikke'; if(L[0]==='web') return 'Web-research svarte ikke'; return 'Apollo svarte ikke'; }
function enrApolloNote(j){ const a=j&&j.pv&&j.pv.apollo; if(!j||!a||a==='ok'||a==='none') return '';
  return a==='blocked'?'Apollo utilgjengelig':a==='plan'?'Kontaktdata ikke tilgjengelig (Apollo-planen)':a==='error'?'Apollo utilgjengelig':a==='skipped'?'Apollo ikke brukt: nok kandidater fra nettsidene.':''; }
const enrTechErrors=j=>((j&&j.errors)||[]).map(e=>[e.provider,e.code,e.message].filter(Boolean).join(' · ')).filter(Boolean);
function enrFatalText(){ const c=ENR.fatal;
  return c==='needs_reauth'?'En kobling må logges inn på nytt i claude.ai (Innstillinger → Koblinger). Trykk «Prøv igjen» etterpå.':
    c==='consent_required'||c==='not_granted'||c==='approval_required'||c==='selection_required'?'Tilgang må godkjennes før research kan kjøres. Godkjenn når siden spør, og trykk «Prøv igjen».':
    c==='server_not_connected'||c==='not_in_manifest'||c==='server_not_found'?'Koblingene er ikke tilgjengelige akkurat nå. Ingenting er tapt. Trykk «Prøv igjen» senere.':
    'Research kunne ikke kjøres herfra akkurat nå. Statusen er lagret.'; }

/* ---------- kandidater: rangering og generell adresse ---------- */
const enrTopMemo=new WeakMap();
function cdRank(a){
  if(enrTopMemo.has(a)) return enrTopMemo.get(a);
  const U=cdUnderstand(a), list=[];
  for(const p of (a.cands||[])){ const s=cdScore(a,{...p,cd:p.cd||{}},U); list.push({p,s,score:s.score,plaus:s.plaus,rec:false}); }
  list.sort((x,y)=>y.score-x.score||(+!!y.p.hasContact)-(+!!x.p.hasContact)||x.p.name.localeCompare(y.p.name,'nb'));
  const top=list[0]; if(top&&top.score>=CD_TUNE.rec&&!top.s.neg.length) top.rec=true;
  const R={U,list,rec:top&&top.rec?top:null,others:list.filter(x=>!x.rec),plaus:list.filter(x=>x.plaus).length};
  enrTopMemo.set(a,R); return R; }
function cdGeneral(a){
  const g=(a.enr&&a.enr.general)||{}, pc=(a.profile&&a.profile.contact)||{}, emails=[], phones=[], seen=new Set();
  for(const e of (g.emails||[])){ if(!e||!e.v||seen.has(e.v)) continue; seen.add(e.v); emails.push({v:e.v,kind:e.kind||'generell',url:e.url||'',src:'web'}); }
  const pe=String(pc.email||'').trim().toLowerCase(); if(pe&&!seen.has(pe)){ seen.add(pe); emails.push({v:pe,kind:'generell',url:pc.contactUrl||'',src:'profil'}); }
  for(const p of (g.phones||[])) if(!phones.includes(p)) phones.push(p);
  const pp=String(pc.phone||'').trim(); if(pp&&!phones.includes(pp)) phones.push(pp);
  const url=g.url||pc.contactUrl||''; return {emails,phones,url,at:g.at||'',has:!!(emails.length||phones.length||url)}; }
function enrSignal(a){ const L=bkSignals(a.enr), td=mtToday(); let n=0; for(const x of L){ n+=x.level==='Dokumentert'?2:1; if(x.date&&String(x.date).slice(0,10)>=td) n+=1; } if(!L.length&&a.ev.level==='Confirmed') n+=2; else if(!L.length&&a.ev.level==='Likely') n+=1; return n; }
function enrSignalText(a){ const L=bkSignals(a.enr).slice().sort((x,y)=>(x.level==='Dokumentert'?0:1)-(y.level==='Dokumentert'?0:1)||String(y.date||'').localeCompare(String(x.date||'')))[0];
  if(L) return (L.level==='Dokumentert'?'Dokumentert: ':'Indikasjon: ')+String(L.event_name||L.event_type||'arrangement').slice(0,60)+(L.date?' · '+bkDateS(L.date):'');
  return a.ev.level==='Confirmed'?'Dokumentert eventaktivitet':a.ev.level==='Likely'?'Indikasjon på eventaktivitet':'Ingen eventsignal ennå'; }

/* ---------- tilstand: data avgjør, ikke bare jobben ---------- */
function enrDataState(a){
  if(a.flags.enriched) return 'ready';
  const R=cdRank(a), rev=a.persons.filter(p=>p.rel==='?'&&!p.dnc);
  if(a.active.length) return 'partial';
  if(R.list.length||rev.length){ const any=R.list.some(x=>x.p.hasContact)||rev.some(p=>p.hasContact); return any?'needs_review':'partial'; }
  return ''; }
function enrDerive(a){
  const j=a.job, R=cdRank(a), F=a.flags, rev=a.persons.filter(p=>p.rel==='?'&&!p.dnc), live=!!j&&bkActive(j), js=enrJobState(j);
  let st;
  if(live){ st=j.blocked?'provider_blocked':ENR_RUN.includes(j.state)?j.state:(j.status==='running'?'researching_company':(ENR.fatal&&ENR.mine&&ENR.mine.has(j.id)?'provider_blocked':'queued')); }
  else st=enrDataState(a)||((js==='provider_blocked'||js==='provider_error')?js:(j&&j.status==='done')?'no_person_found':(a.enr&&(a.enr.cd||a.enr.enriched_at))?'no_person_found':'not_started');
  const researched=!!(a.enr&&(a.enr.cd||a.enr.enriched_at))||(!!j&&j.status==='done'&&js!=='provider_error'&&js!=='provider_blocked');
  const persons=a.persons.filter(p=>p.rel!=='nei'&&!p.dnc&&!p.general), all=R.list.map(x=>x.p).concat(persons);
  F.researched=researched; F.cand=all.length>0; F.data=all.some(p=>p.hasContact); F.chosen=a.active.some(p=>!p.general);
  /* Kontakt klar: godkjent kontakt med kanal, eller anbefalt kandidat med kanal som bare venter på ett klikk */
  const pend=!F.enriched&&!!(R.rec&&R.rec.p.hasContact); F.kready=F.enriched||pend;
  const sp=ENR_ST[st], gen=cdGeneral(a); const kready=F.kready&&!live; if(kready&&st==='needs_review'){ /* tilstanden beholdes, men gruppen er Kontakt klar */ }
  let detail='';
  if(st==='ready') detail=a.active.length&&a.active.every(p=>p.general)?'Kontakt klar via generell adresse':'Kontakt klar';
  else if(st==='needs_review') detail=pend?'Anbefalt kontakt funnet. Godkjenn med ett klikk':R.rec?'Anbefalt kandidat mangler kontaktkanal':'Mulige personer – vurder';
  else if(st==='partial') detail=a.active.length?'Kontakt valgt, men kontaktdata mangler':'Research ferdig – kandidat funnet, kontaktdata mangler';
  else if(st==='no_person_found') detail='Research fullført – fant ingen trygg kontaktperson';
  else if(st==='provider_blocked') detail=enrBlockedText(j);
  else if(st==='provider_error') detail=enrErrorText(j);
  else if(st==='not_started') detail='Ikke beriket ennå';
  else detail=(j&&j.stage)||sp.stage;
  a.es={state:st,label:pend&&!live?'Kontakt klar':sp.l,tone:pend&&!live?'ok':sp.t,group:pend&&!live?'ready':sp.g,kready:kready,pending:pend&&!live,detail,running:ENR_RUN.includes(st),rank:R,rec:R.rec,cands:R.list,general:gen,researched,apollo:enrApolloNote(j),
    sig:enrSignal(a),review:rev,errs:enrTechErrors(j)};
  return a.es; }

/* ---------- neste steg i batchflyten (spesifikasjon S): avledet, så det rykker frem av seg selv ---------- */
const WF_STEPS=['Research','Finn kontakt','Kontroller kontakt','Klar for outreach','Kontakt i dag','Venter','Svar mottatt'];
function wfStepOf(a){
  const n=a.nx||{}, es=a.es||{}, td=mtToday();
  if(n.k==='reply'||n.k==='deal') return {k:'reply',t:'Svar mottatt',n:7};
  if(a.prog&&a.prog.next) return a.prog.next.due<=td?{k:'today',t:'Kontakt i dag',n:5}:{k:'wait',t:'Venter',n:6};
  if(a.flags.addressed) return n.k==='followup'&&n.due&&n.due<=td?{k:'today',t:'Kontakt i dag',n:5}:{k:'wait',t:'Venter',n:6};
  if(!a.flags.qualified) return {k:'research',t:'Research',n:1};
  if(es.running||es.state==='provider_blocked'||es.state==='provider_error'||es.state==='not_started') return {k:'research',t:'Research',n:1};
  if(a.flags.enriched) return {k:'ready',t:'Klar for outreach',n:4};
  if(es.cands&&es.cands.length||es.review&&es.review.length||a.active.length) return {k:'check',t:'Kontroller kontakt',n:3};
  return {k:'find',t:'Finn kontakt',n:2}; }

/* mtNext bruker denne teksten når accounten ikke er klar */
function bkNextText(a){ const es=a.es||{}, st=es.state;
  return es.running?'Research pågår':st==='needs_review'?'Kontroller kontakt':st==='partial'?(a.active&&a.active.length?'Finn kontaktdata':'Kontroller kandidat'):st==='no_person_found'?'Finn kontaktperson':st==='provider_blocked'||st==='provider_error'?'Prøv research igjen':'Berik'; }
/* statuschip i lister */
function bkStatus(a){
  const k=a.nx.k, es=a.es||{};
  if(a.flags.disqualified) return ['Diskvalifisert','bad']; if(a.dncAcc) return ['Ikke kontakt','bad'];
  if(k==='deal') return ['Aktiv sak','a']; if(k==='reply') return ['Svar mottatt','a'];
  if(a.prog) return ['I sekvens · dag '+a.prog.day,'a'];
  if(a.flags.addressed) return ['Venter på svar',''];
  if(!a.flags.qualified) return ['Trenger research','warn'];
  return [es.label||'Ikke beriket',es.tone||'']; }
function mtPrimary(a){
  const k=a.nx.k, es=a.es||{};
  if(k==='dq') return ['reset','Gjenopprett til målmarkedet']; if(k==='dnc') return null;
  if(k==='research') return ['qual','Fullfør kvalifisering'];
  if(k==='enrich'){ if(es.running) return ['wait','Research pågår …']; if(es.state==='needs_review'||es.state==='partial'&&(es.cands.length||es.review.length)) return ['kon','Kontroller kontakt']; return ['berik',es.state==='not_started'?'Berik nå':'Prøv igjen']; }
  if(k==='ready') return ['start','Start kontakt']; if(k==='deal') return ['deal','Åpne saken']; if(k==='reply') return ['deal','Opprett sak'];
  return ['log','Logg kontakt']; }
function mtActLabel(a){ const k=a.nx.k, es=a.es||{}; return k==='enrich'?(es.running?'':es.state==='needs_review'?'Vurder':'Berik'):k==='ready'?'Start kontakt':k==='research'?'Kvalifiser':k==='deal'?'Åpne sak':k==='reply'?'Åpne':k==='dq'||k==='dnc'||k==='paused'?'Åpne':'Logg touch'; }

/* jobbentiteten får egen tilstand (samme form som en backend vil levere) */
function toJobEntity(j){ return {id:j.id,kind:j.kind||'enrich',account_id:j.accId,group_id:j.groupId||null,run_id:j.run_id||null,provider:j.provider||'claude_session',status:jobStatus(j),state:enrJobState(j)||null,stage:j.stage||null,outcome:j.outcome||null,
  providers:j.providers||{},missing:j.missing||[],requested_at:j.requested_at||null,requested_by:j.requested_by||null,started_at:j.started_at||null,completed_at:j.completed_at||null,
  error:j.error||null,result_version:j.result_version||0,executor:j.executor||null,requested_by_name:j.requested_by||null,providers_requested:j.providers_requested||[],provider_results:j.provider_results||[],errors:j.errors||[],last_updated_at:j.last_updated_at||null,contacts_found:j.contacts_found||0,blocked:j.blocked||null,pipeline:j.pipeline||[],history:j.history||[]}; }

/* ---------- koblinger: klassifisering og tilgjengelighet ---------- */
function enrClassify(e){
  const code=(e&&e.code)||'error', msg=String((e&&e.message)||'');
  if(code==='plan_restricted'||(code==='tool_error'&&/API_INACCESSIBLE|upgrade|free plan|not available on your plan/i.test(msg))) return {kind:'plan',code:'plan_restricted',message:msg};
  if(ENR_FATAL.includes(code)) return {kind:'blocked',code,message:msg};
  return {kind:'error',code,message:msg}; }
async function enrProbe(){
  const out={web:false,apollo:false,fetch:false,sample:!!sample,mcp:!!mcp,servers:[]};
  try{ const m=await enrServers(true); out.web=!!m.web_search_exa; out.apollo=!!m.apollo_organizations_lookup; out.fetch=!!m.web_fetch_exa; out.servers=[...new Set(Object.values(m))]; }catch(e){ out.err=(e&&e.code)||'error'; }
  ENR.stat=out; enrRegister(out); return out; }
function enrRegister(st){
  st=st||ENR.stat||{};
  if(st.web) researchProvider.register({enrichCompany:enrWebCompany,searchPeople:enrWebPeople});
  if(st.apollo) apolloProvider.register({searchCompany:enrApolloCompany,searchPeople:enrApolloPeople,enrichPerson:enrApolloEmail}); }
