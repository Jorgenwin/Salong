'use strict';

// research/pipeline.js: enrPipeline(a, io) er forretningslogikken bak «Berik». Ren: verken DOM, database eller kø.
// Den får providers (io.web, io.apollo), en valgfri LLM-port (io.llm) og en io med report/checkpoint/has.
// Providerne svarer alltid {ok:true,data} eller {ok:false,kind:'blocked'|'plan'|'error',code,message}.
// En kilde som feiler forkaster aldri det som allerede er funnet. Ingenting simuleres: personer, e-post og telefon
// kommer fra tekst en kilde faktisk har gitt, med sitat og sideadresse.
// Vanlig CommonJS-modul (se rules.js).

const { CD_TUNE, CD_PROBE, CD_PAGEORDER, cdUnderstand, cdParseRoster, cdParseEventContacts, cdParseLinkedIn, cdParseGeneral, cdPageKind, cdMerge } = require('./rules');
const { rsNormName, enrHost, enrOwn, enrEvents } = require('./events');
const { enrKeep, rsStanding, rsReadTargets, rsVerifyCandidate, rsVerifyEvent, rsAsk, rsPagePrompt, rsCleanContacts, rsCleanEvents, RS_CONTACTS_SYS, RS_EVENTS_SYS, RS_PEOPLE_HINT } = require('./method');

/* ---------- aliaser for «jobber hos organisasjonen» ---------- */
function enrAliases(a){
  const n=String(a.name||'').trim(), out=[n], s=n.replace(/\s+(AS|ASA|SA|Ltd|Inc|AB|A\/S)\.?$/i,'').trim(); if(s&&s!==n) out.push(s);
  for(const x of ((a.doc&&a.doc.aliases)||[])) out.push(String(x));
  const lab=String(a.domain||'').replace(/^www\./,'').split('.')[0]; if(lab.length>=3&&lab.length<=8) out.push(lab);
  const ab=n.split(/\s+/).filter(w=>/^[A-ZÆØÅ]/.test(w)).map(w=>w[0]).join(''); if(ab.length>=3&&ab.length<=6) out.push(ab);
  return [...new Set(out.filter(x=>x&&String(x).trim().length>=3))]; }

/* ---------- web-operasjonene pipelinen bruker, bundet til porter ----------
   port.search(query, objective, n)   -> [{url, title, text, published?}]     (søketreff er utdrag)
   port.fetchPages(urls, maxChars)    -> [{url, title, text}]                 (hele sider; sider som ikke lot seg hente utelates)
   port.isFatal(error)                -> true når feilen betyr «ingen tilgang» og ikke skal svelges som et tomt søk
   Uten en port svarer operasjonen «not_connected». Ingenting simuleres.
   I Artifact-utgaven er portene Claude-connectorene (enrrun.js); på serveren er de adaptere bak cache og budsjett (server/src/research/ports.js). */
function createWebOps(port){
  port=port||{};
  const missing=name=>async()=>{ throw {code:'not_connected',message:name+' er ikke koblet til.'}; };
  const search=port.search||missing('Søk'), fetchPages=port.fetchPages||missing('Henting'), enrFatalErr=port.isFatal||(()=>false);
  const enrExa=(query,objective,n)=>search(query,objective,n||6);
  async function enrWebCompany(args){
    const a=args.a, dom=a.domain||enrHost(a.website||''); const q=a.name+(dom?' ('+dom+')':'');
    const [up,past]=await Promise.all([
      enrExa(q+' kommende arrangementer konferanse seminar fagdag program 2026 2027','Finn datofestede arrangementer organisasjonen selv arrangerer. Ta med dato, tidspunkt, sted og antall deltakere hvis oppgitt.',6).catch(e=>{ if(enrFatalErr(e)) throw e; return null; }),
      enrExa(q+' tidligere arrangement årskonferanse fagdag sted lokale','Finn tidligere arrangementer organisasjonen har holdt: dato, sted/venue og antall deltakere hvis oppgitt.',5).catch(e=>{ if(enrFatalErr(e)) throw e; return null; })]);
    if(up===null&&past===null) throw {code:'upstream_error',message:'Søket ga ikke svar.'};
    const results=[...(up||[]),...(past||[])]; return {events:enrEvents(a,results),results,count:results.length}; }
  return {

  /* eget nettsted: sider med ansatte, kontaktinfo, kommunikasjon, arrangement og presse. site:-søk finner sidene, så vi gjetter ikke stier. */
  async discover(x){ const dom=x.dom, qs=[
      ['site:'+dom+' kontakt ansatte medarbeidere team om oss','Finn sider på organisasjonens eget nettsted som lister ansatte med navn og stilling, og generelle kontaktopplysninger (e-post, telefon).'],
      ['site:'+dom+' kommunikasjon arrangement program presse kontaktperson','Finn sider på organisasjonens eget nettsted om kommunikasjon, arrangementer, program og presse, med navngitte kontaktpersoner.']];
    const rs=await Promise.all(qs.map(q=>enrExa(q[0],q[1],8).then(v=>({v}),e=>({e})))); const errs=rs.filter(r=>r.e);
    if(errs.length===rs.length) throw errs[0].e; const seen=new Set(), pages=[];
    for(const r of rs) for(const p of (r.v||[])) if(enrOwn(p.url,dom)&&!seen.has(p.url)){ seen.add(p.url); pages.push({...p,kind:cdPageKind(p.url)}); }
    pages.sort((p,q)=>(CD_PAGEORDER[p.kind]-CD_PAGEORDER[q.kind])); return {pages}; },
  events:enrWebCompany,
  async profiles(x){ const r=await enrExa('category:people '+x.a.name+' '+x.terms.slice(0,5).join(' '),'Finn LinkedIn-profiler for personer som i dag jobber hos «'+x.a.name+'» med funksjoner som '+x.terms.slice(0,6).join(', ')+'. Personer i Norge foretrekkes.',10);
    const p=cdParseLinkedIn(r,x.aliases); return {people:p.people,dropped:p.dropped,count:r.length,results:r}; },
  async sitePages(x){ const r=await enrExa('site:'+x.dom+' '+x.terms.slice(0,6).join(' ')+(x.extra?' '+x.extra:''),x.objective||'Finn sider på nettstedet som navngir ansatte eller kontaktpersoner med disse funksjonene: stilling, navn og eventuelt e-post.',8);
    return {pages:r.filter(p=>enrOwn(p.url,x.dom)).map(p=>({...p,kind:cdPageKind(p.url)})),count:r.length}; },
  /* siste utvei når søket ikke fant noen kontakt- eller teamside: hent vanlige stier direkte (krever en hente-port) */
  async probe(x){ const urls=CD_PROBE.slice(0,6).map(p=>'https://'+x.dom+p), got=await fetchPages(urls,12000), pages=[];
    for(const b of got){ if(!enrOwn(b.url,x.dom)) continue; pages.push({...b,kind:cdPageKind(b.url)}); }
    return {pages}; },
  /* hele sider fra organisasjonens eget nettsted (krever en hente-port). Søketreff er bare utdrag; her leses alt. */
  async read(x){ const got=await fetchPages(x.urls.slice(0,4),20000), pages=[];
    for(const b of got){ if(!enrOwn(b.url,x.dom)) continue; pages.push({...b,kind:cdPageKind(b.url)}); }
    return {pages}; } };
}

/* ---------- sider → kandidater og generell adresse ---------- */
function enrPageCands(pages,a,dom,al,round,into){
  const gen=into.general;
  for(const pg of pages){ const k=pg.kind||cdPageKind(pg.url), g=cdParseGeneral(pg.text,dom);
    for(const e of g.emails) if(!gen.emails.some(x=>x.v===e.v)) gen.emails.push({...e,url:pg.url});
    for(const p of g.phones) if(!gen.phones.includes(p)) gen.phones.push(p);
    if(!gen.url&&k==='team'&&/kontakt|contact/i.test(pg.url)) gen.url=pg.url;
    if(k==='team'){ for(const p of cdParseRoster(pg.text)) cdMerge(into.cands,{name:p.name,title:p.title,email:p.email,phone:p.phone||'',quote:p.quote,sourceUrl:pg.url,cur:true,rounds:[round],ev:[{k:'team',url:pg.url,q:p.quote}]}); }
    else { for(const c of cdParseEventContacts(pg.text,al)){ const kind=c.kind==='speaker'?'speaker':(k==='news'||/presse|press/i.test(c.quote))?'press':'organizer';
        cdMerge(into.cands,{name:c.name,title:c.title,email:c.email,quote:c.quote,sourceUrl:pg.url,cur:true,rounds:[round],ev:[{k:kind,url:pg.url,q:c.quote}]}); } } } }

/* ---------- selve pipelinen ---------- */
async function enrPipeline(a,io){
  const dom=a.domain||enrHost(a.website||''), al=enrAliases(a), U=cdUnderstand(a), rep=io.report||(async()=>{});
  const R={U,events:[],eventResults:0,cands:[],general:{emails:[],phones:[],url:''},pages:[],steps:[],pv:{web:'none',apollo:'none'},errors:[],ok:0,calls:0,pcalls:0,rounds:[],stop:'',orgId:'',pkinds:{},perr:0,okBy:{web:0,apollo:0},blockedCode:'',seen:new Map(),read:{pages:0,names:0},llm:{status:'',calls:0,people:0,events:0,errors:[]},rejected:[]};
  /* alt som er sett per adresse: kilden verifikatoren sjekker mot. Lagres også uten spørrestreng (profil-lenker). */
  const see=L=>{ for(const p of (L||[])){ if(!p||!p.url) continue; const t=[p.title,p.text].filter(Boolean).join('\n'); if(!t) continue; for(const k of new Set([p.url,String(p.url).split(/[?#]/)[0]])){ const o=R.seen.get(k)||''; if(!o.includes(t)) R.seen.set(k,o?o+'\n'+t:t); } } }, textFor=u=>R.seen.get(u)||R.seen.get(String(u||'').split(/[?#]/)[0])||'';
  const has=io.has||{web:true,apollo:true,fetch:false,llm:false};
  for(const p of ['web','apollo']) if(!has[p]){ R.pv[p]='blocked'; R.errors.push({provider:p,code:'server_not_connected',message:'Ingen kobling er tilgjengelig for '+(p==='web'?'web-research':'Apollo')+'.'}); R.blockedCode=R.blockedCode||'server_not_connected'; }
  const bad={};
  const call=async(p,op,args,counts)=>{
    if(R.pv[p]==='blocked'||R.pv[p]==='plan'||R.pv[p]==='error') return {ok:false,kind:R.pv[p],skipped:true};
    R.calls++; if(counts) R.pcalls++; const r=await (p==='web'?io.web:io.apollo).call(op,args);
    if(r.ok){ R.ok++; R.okBy[p]++; bad[p]=0; if(R.pv[p]==='none') R.pv[p]='ok'; return r; }
    R.errors.push({provider:p,op,code:r.code,message:String(r.message||'').slice(0,300)});
    if(r.kind==='blocked'){ R.pv[p]='blocked'; R.blockedCode=R.blockedCode||r.code; } else if(r.kind==='plan') R.pv[p]='plan';
    else { R.perr++; bad[p]=(bad[p]||0)+1; if(bad[p]>=3) R.pv[p]='error'; }
    return r; };
  const soft=async(op,args)=>{ R.calls++; const r=await io.web.call(op,args); if(!r.ok) R.errors.push({provider:'web',op,code:r.code,message:String(r.message||'').slice(0,300)}); return r; };
  const step=async(id,label,status,detail,count)=>{ const s=R.steps.find(x=>x.id===id), o={id,label,status,detail:detail||'',count:count==null?null:count}; if(s) Object.assign(s,o); else R.steps.push(o); await rep({steps:R.steps.map(x=>({...x}))}); };
  const plaus=()=>rsStanding(a,U,R.cands).plaus;
  const unavail=(p)=>R.pv[p]==='blocked'?'Ikke tilgjengelig':R.pv[p]==='plan'?'Ikke på planen':'Svarte ikke';

  const evKey=e=>(e.date||'')+'|'+rsNormName(e.title||'').slice(0,40), readEvents=[];
  const readPages=async urls=>{ urls=urls.filter(u=>!R.read.done||!R.read.done.has(u)); if(!urls.length) return; R.read.done=R.read.done||new Set(); for(const u of urls) R.read.done.add(u);
    const rd=await soft('read',{dom,urls}); if(!rd.ok||!rd.data.pages.length) return;
    const before=R.cands.length; see(rd.data.pages); enrPageCands(rd.data.pages,a,dom,al,0,R);
    for(const f of rd.data.pages){ const o=R.pages.find(p=>p.url===f.url); if(o){ if(String(f.text||'').length>String(o.text||'').length){ o.text=f.text; o.full=true; } } else R.pages.push({...f,full:true}); }
    for(const e of enrEvents(a,rd.data.pages)) readEvents.push(e);
    R.read.pages+=rd.data.pages.length; R.read.names+=R.cands.length-before;
    await step('read','Hele sider','done',R.read.pages+' side'+(R.read.pages===1?'':'r')+' lest i sin helhet'+(R.read.names?' · '+R.read.names+' flere navn':''),R.read.pages); };

  /* 1. organisasjonen: Apollo-oppslag (gratis) og eget nettsted */
  await rep({state:'researching_company'});
  if(dom){
    const ao=await call('apollo','org',{a});
    if(ao.ok){ if(ao.data.matched){ R.orgId=ao.data.id; await step('apollo_org','Apollo: selskap','done','Selskapet funnet',1); } else await step('apollo_org','Apollo: selskap','done','Organisasjon ikke matchet',0); }
    else await step('apollo_org','Apollo: selskap','unavailable',unavail('apollo'));
    const w=await call('web','discover',{a,dom});
    if(w.ok){ R.pages=w.data.pages.slice(); see(R.pages); for(const p of R.pages) R.pkinds[p.kind]=(R.pkinds[p.kind]||0)+1; enrPageCands(R.pages,a,dom,al,0,R); await step('company','Eget nettsted','done',R.pages.length+' side'+(R.pages.length===1?'':'r')+' lest · '+R.cands.length+' navngitte personer',R.pages.length); }
    else await step('company','Eget nettsted','unavailable',unavail('web'));
    if(w.ok&&has.fetch&&!R.pages.some(p=>p.kind==='team')){ const pr=await soft('probe',{dom});
      if(pr.ok&&pr.data.pages.length){ R.pages=R.pages.concat(pr.data.pages); see(pr.data.pages); enrPageCands(pr.data.pages,a,dom,al,0,R); await step('company','Eget nettsted','done',R.pages.length+' sider lest (inkl. direkte oppslag) · '+R.cands.length+' navngitte personer',R.pages.length); } }
    /* hele sider: søketreff er utdrag, og ansattlister er ofte lengre enn utdraget */
    if(w.ok&&has.fetch) await readPages(rsReadTargets(R.pages,dom,3));
  } else { await step('company','Eget nettsted','skipped','Mangler domene'); await step('apollo_org','Apollo: selskap','skipped','Mangler domene'); }

  /* 2. arrangementer: dokumenterte signaler, arrangører og ansatte talere */
  await rep({state:'researching_events'});
  const ev=await call('web','events',{a});
  if(ev.ok){ R.events=ev.data.events||[]; R.eventResults=ev.data.count||0; see(ev.data.results);
    const own=(ev.data.results||[]).filter(r=>dom&&enrOwn(r.url,dom)).map(r=>({...r,kind:cdPageKind(r.url)}));
    enrPageCands(own,a,dom,al,0,R); await step('events','Arrangementer','done',R.events.length?R.events.length+' eventsignal'+(R.events.length===1?'':'er')+' i '+R.eventResults+' kilder':'Ingen datofestede arrangementer i '+R.eventResults+' kilder',R.events.length); }
  else await step('events','Arrangementer','unavailable',unavail('web'));
  { const have=new Set(R.events.map(evKey)), n0=R.events.length; for(const e of readEvents) if(!have.has(evKey(e))){ have.add(evKey(e)); R.events.push(e); }
    if(R.events.length>n0) await step('events','Arrangementer','done',R.events.length+' eventsignal'+(R.events.length===1?'':'er')+' (inkl. fra hele sider)',R.events.length); }
  /* sikre det som er funnet før personsøket starter: en senere feil skal ikke koste research */
  if(io.checkpoint) await io.checkpoint({events:R.events,general:R.general});

  /* LLM-uttrekk: bare når ingen kan anbefales, bare på sider som allerede er lest, og høyst to sider per organisasjon.
     Hvert forslag kontrolleres mot siden FØR det slipper inn, så et oppdiktet navn aldri kan stanse søket. */
  const llmAsked=new Set(), llmFail=e=>{ const code=(e&&e.code)||'error'; R.llm.errors.push({code,message:String((e&&e.message)||code).slice(0,200)}); return code; };
  const llmStopped=()=>R.llm.errors.some(e=>e.code!=='bad_output'&&e.code!=='error'&&e.code!=='upstream_error');
  const ownPages=()=>R.pages.filter(p=>dom&&enrOwn(p.url,dom)&&String(p.text||'').length>=60&&p.kind!=='pdf');
  const llmContacts=async()=>{
    if(!io.llm||!has.llm||llmStopped()||llmAsked.size>=2||rsStanding(a,U,R.cands).rec) return;
    const yieldOf=u=>R.cands.filter(c=>(c.ev||[]).some(e=>e.url===u)).length;
    const T=ownPages().filter(p=>!llmAsked.has(p.url)&&(p.kind==='team'||p.kind==='event'||RS_PEOPLE_HINT.test(p.text.slice(0,6000)))).sort((x,y)=>yieldOf(x.url)-yieldOf(y.url)||CD_PAGEORDER[x.kind]-CD_PAGEORDER[y.kind]).slice(0,2-llmAsked.size);
    for(const pg of T){ llmAsked.add(pg.url);
      try{ const people=rsCleanContacts(await rsAsk(io.llm,RS_CONTACTS_SYS,rsPagePrompt(a,pg))); R.llm.calls++;
        for(const p of people){ R.llm.people++; const c={name:p.name,title:p.title,email:p.email,quote:p.quote,sourceUrl:pg.url,cur:true,rounds:[5],ev:[{k:p.kind,url:pg.url,q:p.quote,method:'llm'}]}, v=rsVerifyCandidate(c,textFor);
          if(v.ok) cdMerge(R.cands,v.candidate); else R.rejected.push({kind:'contact',name:p.name,reasons:v.reasons,method:'llm'}); } }
      catch(e){ llmFail(e); if(llmStopped()) break; } } };
  /* første forsøk før personsøket: finner Claude kontakten på en side vi alt har lest, spares søkerundene */
  await llmContacts();

  /* 3. personsøk i opptil fire runder. Bredt først (kandidat-recall), rangering etterpå. Stopper ved tre plausible kandidater eller når budsjettet er brukt. */
  await rep({state:'searching_people'});
  let webN=0, apN=0, apOk=0;
  for(let r=1;r<=4;r++){
    if(R.pcalls>=CD_TUNE.budget){ R.stop='budget'; break; }
    { const st=rsStanding(a,U,R.cands); if(st.enough){ R.stop=st.plaus>=CD_TUNE.minPlaus?'enough':'recommended'; break; } }
    const fams=r<=3?U.rounds[r]:[], terms=r<=3?U.terms[r]:[], labels=fams.map(f=>f.label), before=R.cands.length;
    await rep({stage:'Runde '+r+': '+(r<=3?(labels.join(', ')||'ledelse'):'dokumenterte personer og bredt søk')});
    if(dom&&r<=3&&terms.length){
      const pr=await call('web','profiles',{a,terms,aliases:al},true);
      if(pr.ok) see(pr.data.results);
      if(pr.ok) for(const p of pr.data.people){ cdMerge(R.cands,{name:p.name,title:p.title,linkedin:p.linkedin,loc:p.loc,cur:p.cur,quote:p.quote,sourceUrl:p.linkedin,rounds:[r],ev:[{k:'linkedin',url:p.linkedin,q:p.quote}]}); webN++; }
      if(R.pcalls<CD_TUNE.budget){ const sp=await call('web','sitePages',{a,dom,terms},true);
        if(sp.ok){ see(sp.data.pages); enrPageCands(sp.data.pages,a,dom,al,r,R); R.pages=R.pages.concat(sp.data.pages.filter(p=>!R.pages.some(q=>q.url===p.url))); if(has.fetch&&!rsStanding(a,U,R.cands).rec) await readPages(rsReadTargets(sp.data.pages,dom,2)); } } }
    if(dom&&r===4){
      const sp=await call('web','sitePages',{a,dom,terms:['program','konferanse','arrangement','kontaktperson','pressekontakt'],extra:'pdf',objective:'Finn program, pressemeldinger, nyheter og PDF-er på nettstedet som navngir arrangører, prosjektledere, talere som er ansatte, eller pressekontakter.'},true);
      if(sp.ok){ see(sp.data.pages); enrPageCands(sp.data.pages,a,dom,al,r,R); R.pages=R.pages.concat(sp.data.pages.filter(p=>!R.pages.some(q=>q.url===p.url))); } }
    if(dom&&R.pcalls<CD_TUNE.budget){
      const ap=await call('apollo','people',{a,dom,orgId:R.orgId,titles:r<=3?terms:[],keywords:r===4?'communications events marketing program kommunikasjon arrangement':''},true);
      if(ap.ok){ apOk++; for(const p of ap.data.people){ cdMerge(R.cands,{...p,quote:p.title,rounds:[r],ev:[{k:'apollo',url:'',q:p.title}],src:'Apollo'}); apN++; } } }
    R.rounds.push({n:r,labels,terms:terms.slice(0,8),found:R.cands.length-before,plaus:plaus()});
    if(R.pv.web!=='ok'&&R.pv.web!=='none'&&R.pv.apollo!=='ok'&&R.pv.apollo!=='none') break;
  }
  if(!R.stop){ const st=rsStanding(a,U,R.cands); R.stop=st.enough?(st.plaus>=CD_TUNE.minPlaus?'enough':'recommended'):R.rounds.length>=4?'rounds':'unavailable'; }
  await step('people_web','Personer: nettsider og profiler',R.pv.web==='ok'||R.okBy.web?'done':'unavailable',R.okBy.web?(R.rounds.length?R.rounds.length+' runde'+(R.rounds.length===1?'':'r')+' · '+webN+' profiler':'Ikke nødvendig: fant kontakt på nettsiden'):unavail('web'),R.cands.length);
  if(apOk) await step('people_apollo','Personer: Apollo','done',apN?apN+' person'+(apN===1?'':'er'):'Ingen person funnet',apN);
  else if(R.pv.apollo==='plan') await step('people_apollo','Personer: Apollo','unavailable','Kontaktdata ikke tilgjengelig (Apollo-planen)');
  else if(R.pv.apollo==='blocked'||R.pv.apollo==='error') await step('people_apollo','Personer: Apollo','unavailable',unavail('apollo'));
  else await step('people_apollo','Personer: Apollo','skipped','Ikke brukt: nok kandidater fra nettsidene');

  /* 4. samle kontaktdata og rangere. E-post fra Apollo koster kreditter og hentes bare etter eksplisitt bekreftelse per person. */
  await rep({state:'enriching_people'});
  /* LLM-uttrekk, andre forsøk: sider som kom til under personsøket. Så arrangementer, hvis ingen er funnet. */
  await llmContacts();
  if(io.llm&&has.llm){
    if(!R.events.length&&!llmStopped()){
      const T=ownPages().filter(p=>p.kind==='event'||p.kind==='news').slice(0,1);
      for(const pg of T){ try{ const evs=rsCleanEvents(await rsAsk(io.llm,RS_EVENTS_SYS,rsPagePrompt(a,pg),1200)); R.llm.calls++;
          for(const e of evs){ R.events.push({title:e.title,type:e.type,date:e.date,time:'',venue:e.venue,capacity:e.capacity,source:pg.url,sourceDate:'',confidence:'medium',level:'Dokumentert',quote:e.quote,method:'llm'}); R.llm.events++; } }
        catch(e){ llmFail(e); } } }
    R.llm.status=R.llm.calls?'ok':llmStopped()?'blocked':R.llm.errors.length?'error':'skipped';
    if(R.llm.calls) await step('llm','Lest av Claude','done',R.llm.calls+' side'+(R.llm.calls===1?'':'r')+' · '+(R.llm.people+R.llm.events)+' forslag til kontroll',R.llm.people+R.llm.events);
  } else R.llm.status='not_connected';
  /* verifikator: alt må stå i tekst som faktisk er hentet. Gjelder parserne like mye som LLM-trinnet. */
  { const ok=[]; for(const c of R.cands){ const v=rsVerifyCandidate(c,textFor); if(v.ok) ok.push(v.candidate); else R.rejected.push({kind:'contact',name:c.name,reasons:v.reasons,method:(c.ev||[]).some(e=>e.method==='llm')?'llm':'parser'}); }
    R.cands=ok; R.events=R.events.filter(e=>{ const v=rsVerifyEvent(e,textFor); if(!v.ok) R.rejected.push({kind:'event',name:e.title,reasons:v.reasons,method:e.method||'parser'}); return v.ok; });
    if(R.rejected.length) await step('verify','Kontroll mot kilden','done',R.rejected.length+' forslag forkastet: sto ikke i kilden',R.rejected.length); }
  const found=R.cands.length, kept=enrKeep(a,U,R.cands);
  await step('rank','Rangering','done',kept.length+' kandidat'+(kept.length===1?'':'er')+' beholdt av '+found,kept.length);
  await step('general','Generell adresse','done',(R.general.emails.length||R.general.phones.length||R.general.url)?[R.general.emails.map(e=>e.v).join(', '),R.general.phones.join(', ')].filter(Boolean).join(' · ')||'Kontaktside funnet':'Fant ingen generell adresse',R.general.emails.length+R.general.phones.length);
  R.cands=kept; R.apOk=apOk; R.researchOk=R.okBy.web>0||apOk>0; return R; }

module.exports = {
  enrAliases, createWebOps, enrPageCands, enrPipeline
};
