/* ---------- enrrun.js: providers, flerrunders kontaktfunn og kjøring ----------
   enrPipeline(a, io) er forretningslogikken: ren, uten DOM, database eller kø. Den får to providers og en io (report, checkpoint, has).
   WebResearchProvider og ApolloProvider returnerer alltid {ok:true,data} eller {ok:false,kind:'blocked'|'plan'|'error',code,message}.
   En kobling som feiler forkaster aldri det som allerede er funnet: eventsignaler og generell adresse lagres med en gang (checkpoint),
   kandidatene lagres etter rundene, og tilstanden settes ut fra hva som faktisk ble funnet.
   Ingenting simuleres. Personer, e-post og telefon kommer fra tekst en kilde faktisk har gitt, med sitat og sideadresse. */

/* ---------- aliaser for «jobber hos organisasjonen» ---------- */
function enrAliases(a){
  const n=String(a.name||'').trim(), out=[n], s=n.replace(/\s+(AS|ASA|SA|Ltd|Inc|AB|A\/S)\.?$/i,'').trim(); if(s&&s!==n) out.push(s);
  for(const x of ((a.doc&&a.doc.aliases)||[])) out.push(String(x));
  const lab=String(a.domain||'').replace(/^www\./,'').split('.')[0]; if(lab.length>=3&&lab.length<=8) out.push(lab);
  const ab=n.split(/\s+/).filter(w=>/^[A-ZÆØÅ]/.test(w)).map(w=>w[0]).join(''); if(ab.length>=3&&ab.length<=6) out.push(ab);
  return [...new Set(out.filter(x=>x&&String(x).trim().length>=3))]; }

/* ---------- WebResearchProvider ---------- */
const WEB_OPS={
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
    const p=cdParseLinkedIn(r,x.aliases); return {people:p.people,dropped:p.dropped,count:r.length}; },
  async sitePages(x){ const r=await enrExa('site:'+x.dom+' '+x.terms.slice(0,6).join(' ')+(x.extra?' '+x.extra:''),x.objective||'Finn sider på nettstedet som navngir ansatte eller kontaktpersoner med disse funksjonene: stilling, navn og eventuelt e-post.',8);
    return {pages:r.filter(p=>enrOwn(p.url,x.dom)).map(p=>({...p,kind:cdPageKind(p.url)})),count:r.length}; },
  /* siste utvei når søket ikke fant noen kontakt- eller teamside: hent vanlige stier direkte (krever web_fetch_exa) */
  async probe(x){ const urls=CD_PROBE.slice(0,6).map(p=>'https://'+x.dom+p), r=await enrCall('web_fetch_exa',{urls,maxCharacters:12000}), t=enrText(r), pages=[];
    for(const b of enrParseExa(t)){ if(!b.url||!enrOwn(b.url,x.dom)||/CRAWL_NOT_FOUND|CRAWL_FAILED/i.test(b.text.slice(0,200))) continue; pages.push({...b,kind:cdPageKind(b.url)}); }
    return {pages}; } };
const WebResearchProvider={id:'web',async call(op,args){ try{ return {ok:true,data:await WEB_OPS[op](args)}; }catch(e){ return {ok:false,...enrClassify(e)}; } }};

/* ---------- ApolloProvider ---------- */
const APOLLO_OPS={
  async org(x){ return enrApolloCompany({a:x.a}); },
  async people(x){ const inp={q_organization_domains_list:[x.dom],per_page:25}; if(x.orgId) inp.organization_ids=[x.orgId]; if(x.titles&&x.titles.length) inp.person_titles=x.titles.slice(0,12); if(x.keywords) inp.q_keywords=x.keywords;
    let r; try{ r=await enrCall('apollo_mixed_people_api_search',inp); }
    catch(e){ if(e&&e.code==='tool_error'&&/API_INACCESSIBLE|upgrade|plan/i.test(String(e.message||''))) throw {code:'plan_restricted',message:'Apollo-planen gir ikke tilgang til personsøk.'}; throw e; }
    const P=(r.payload&&(r.payload.people||r.payload.contacts))||[]; return {people:cdFromApollo(P),count:P.length}; } };
const ApolloProvider={id:'apollo',async call(op,args){ try{ return {ok:true,data:await APOLLO_OPS[op](args)}; }catch(e){ return {ok:false,...enrClassify(e)}; } }};

/* ---------- sider → kandidater og generell adresse ---------- */
function enrPageCands(pages,a,dom,al,round,into){
  const gen=into.general;
  for(const pg of pages){ const k=pg.kind||cdPageKind(pg.url), g=cdParseGeneral(pg.text,dom);
    for(const e of g.emails) if(!gen.emails.some(x=>x.v===e.v)) gen.emails.push({...e,url:pg.url});
    for(const p of g.phones) if(!gen.phones.includes(p)) gen.phones.push(p);
    if(!gen.url&&k==='team'&&/kontakt|contact/i.test(pg.url)) gen.url=pg.url;
    if(k==='team'){ for(const p of cdParseRoster(pg.text)) cdMerge(into.cands,{name:p.name,title:p.title,email:p.email,quote:p.quote,sourceUrl:pg.url,cur:true,rounds:[round],ev:[{k:'team',url:pg.url,q:p.quote}]}); }
    else { for(const c of cdParseEventContacts(pg.text,al)){ const kind=c.kind==='speaker'?'speaker':(k==='news'||/presse|press/i.test(c.quote))?'press':'organizer';
        cdMerge(into.cands,{name:c.name,title:c.title,email:c.email,quote:c.quote,sourceUrl:pg.url,cur:true,rounds:[round],ev:[{k:kind,url:pg.url,q:c.quote}]}); } } } }
function enrKeep(a,U,list){
  const out=[]; for(const c of list){ const s=cdScore(a,{...c,cd:{ev:c.ev,loc:c.loc,cur:c.cur,masked:c.masked}},U), doc=c.ev.some(e=>['organizer','press','speaker'].includes(e.k)), fams=cdFamsOf(c.title);
    if(s.score<CD_TUNE.keepMin) continue; if(!fams.length&&!doc) continue; if(s.neg.some(n=>['hr','wrong','tech','former'].includes(n.k))&&s.score<CD_TUNE.plaus) continue; out.push({c,s}); }
  out.sort((x,y)=>y.s.score-x.s.score); return out.slice(0,CD_TUNE.keep).map(x=>x.c); }

/* ---------- selve pipelinen ---------- */
async function enrPipeline(a,io){
  const dom=a.domain||enrHost(a.website||''), al=enrAliases(a), U=cdUnderstand(a), rep=io.report||(async()=>{});
  const R={U,events:[],eventResults:0,cands:[],general:{emails:[],phones:[],url:''},pages:[],steps:[],pv:{web:'none',apollo:'none'},errors:[],ok:0,calls:0,pcalls:0,rounds:[],stop:'',orgId:'',pkinds:{},perr:0,okBy:{web:0,apollo:0},blockedCode:''};
  const has=io.has||{web:true,apollo:true,fetch:false};
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
  const step=async(id,label,status,detail,count)=>{ const s=R.steps.find(x=>x.id===id), o={id,label,status,detail:detail||'',count:count==null?null:count}; if(s) Object.assign(s,o); else R.steps.push(o); await rep({steps:R.steps.map(x=>({...x}))}); };
  const plaus=()=>enrKeep(a,U,R.cands).length&&R.cands.filter(c=>cdScore(a,{...c,cd:{ev:c.ev,loc:c.loc,cur:c.cur,masked:c.masked}},U).plaus).length;
  const unavail=(p)=>R.pv[p]==='blocked'?'Ikke tilgjengelig':R.pv[p]==='plan'?'Ikke på planen':'Svarte ikke';

  /* 1. organisasjonen: Apollo-oppslag (gratis) og eget nettsted */
  await rep({state:'researching_company'});
  if(dom){
    const ao=await call('apollo','org',{a});
    if(ao.ok){ if(ao.data.matched){ R.orgId=ao.data.id; await step('apollo_org','Apollo: selskap','done','Selskapet funnet',1); } else await step('apollo_org','Apollo: selskap','done','Organisasjon ikke matchet',0); }
    else await step('apollo_org','Apollo: selskap','unavailable',unavail('apollo'));
    const w=await call('web','discover',{a,dom});
    if(w.ok){ R.pages=w.data.pages.slice(); for(const p of R.pages) R.pkinds[p.kind]=(R.pkinds[p.kind]||0)+1; enrPageCands(R.pages,a,dom,al,0,R); await step('company','Eget nettsted','done',R.pages.length+' side'+(R.pages.length===1?'':'r')+' lest · '+R.cands.length+' navngitte personer',R.pages.length); }
    else await step('company','Eget nettsted','unavailable',unavail('web'));
    if(w.ok&&has.fetch&&!R.pages.some(p=>p.kind==='team')){ const pr=await call('web','probe',{dom});
      if(pr.ok&&pr.data.pages.length){ R.pages=R.pages.concat(pr.data.pages); enrPageCands(pr.data.pages,a,dom,al,0,R); await step('company','Eget nettsted','done',R.pages.length+' sider lest (inkl. direkte oppslag) · '+R.cands.length+' navngitte personer',R.pages.length); } }
  } else { await step('company','Eget nettsted','skipped','Mangler domene'); await step('apollo_org','Apollo: selskap','skipped','Mangler domene'); }

  /* 2. arrangementer: dokumenterte signaler, arrangører og ansatte talere */
  await rep({state:'researching_events'});
  const ev=await call('web','events',{a});
  if(ev.ok){ R.events=ev.data.events||[]; R.eventResults=ev.data.count||0;
    const own=(ev.data.results||[]).filter(r=>dom&&enrOwn(r.url,dom)).map(r=>({...r,kind:cdPageKind(r.url)}));
    enrPageCands(own,a,dom,al,0,R); await step('events','Arrangementer','done',R.events.length?R.events.length+' eventsignal'+(R.events.length===1?'':'er')+' i '+R.eventResults+' kilder':'Ingen datofestede arrangementer i '+R.eventResults+' kilder',R.events.length); }
  else await step('events','Arrangementer','unavailable',unavail('web'));
  /* sikre det som er funnet før personsøket starter: en senere feil skal ikke koste research */
  if(io.checkpoint) await io.checkpoint({events:R.events,general:R.general});

  /* 3. personsøk i opptil fire runder. Bredt først (kandidat-recall), rangering etterpå. Stopper ved tre plausible kandidater eller når budsjettet er brukt. */
  await rep({state:'searching_people'});
  let webN=0, apN=0, apOk=0;
  for(let r=1;r<=4;r++){
    if(R.pcalls>=CD_TUNE.budget){ R.stop='budget'; break; }
    if(plaus()>=CD_TUNE.minPlaus){ R.stop='enough'; break; }
    const fams=r<=3?U.rounds[r]:[], terms=r<=3?U.terms[r]:[], labels=fams.map(f=>f.label), before=R.cands.length;
    await rep({stage:'Runde '+r+': '+(r<=3?(labels.join(', ')||'ledelse'):'dokumenterte personer og bredt søk')});
    if(dom&&r<=3&&terms.length){
      const pr=await call('web','profiles',{a,terms,aliases:al},true);
      if(pr.ok) for(const p of pr.data.people){ cdMerge(R.cands,{name:p.name,title:p.title,linkedin:p.linkedin,loc:p.loc,cur:p.cur,quote:p.quote,sourceUrl:p.linkedin,rounds:[r],ev:[{k:'linkedin',url:p.linkedin,q:p.quote}]}); webN++; }
      if(R.pcalls<CD_TUNE.budget){ const sp=await call('web','sitePages',{a,dom,terms},true);
        if(sp.ok){ enrPageCands(sp.data.pages,a,dom,al,r,R); R.pages=R.pages.concat(sp.data.pages.filter(p=>!R.pages.some(q=>q.url===p.url))); } } }
    if(dom&&r===4){
      const sp=await call('web','sitePages',{a,dom,terms:['program','konferanse','arrangement','kontaktperson','pressekontakt'],extra:'pdf',objective:'Finn program, pressemeldinger, nyheter og PDF-er på nettstedet som navngir arrangører, prosjektledere, talere som er ansatte, eller pressekontakter.'},true);
      if(sp.ok){ enrPageCands(sp.data.pages,a,dom,al,r,R); R.pages=R.pages.concat(sp.data.pages.filter(p=>!R.pages.some(q=>q.url===p.url))); } }
    if(dom&&R.pcalls<CD_TUNE.budget){
      const ap=await call('apollo','people',{a,dom,orgId:R.orgId,titles:r<=3?terms:[],keywords:r===4?'communications events marketing program kommunikasjon arrangement':''},true);
      if(ap.ok){ apOk++; for(const p of ap.data.people){ cdMerge(R.cands,{...p,quote:p.title,rounds:[r],ev:[{k:'apollo',url:'',q:p.title}],src:'Apollo'}); apN++; } } }
    R.rounds.push({n:r,labels,terms:terms.slice(0,8),found:R.cands.length-before,plaus:plaus()});
    if(R.pv.web!=='ok'&&R.pv.web!=='none'&&R.pv.apollo!=='ok'&&R.pv.apollo!=='none') break;
  }
  if(!R.stop) R.stop=R.rounds.length>=4?'rounds':'unavailable';
  await step('people_web','Personer: nettsider og profiler',R.pv.web==='ok'||R.okBy.web?'done':'unavailable',R.okBy.web?(R.rounds.length+' runder · '+webN+' profiler'):unavail('web'),R.cands.length);
  if(apOk) await step('people_apollo','Personer: Apollo','done',apN?apN+' person'+(apN===1?'':'er'):'Ingen person funnet',apN);
  else if(R.pv.apollo==='plan') await step('people_apollo','Personer: Apollo','unavailable','Kontaktdata ikke tilgjengelig (Apollo-planen)');
  else if(R.pv.apollo==='blocked'||R.pv.apollo==='error') await step('people_apollo','Personer: Apollo','unavailable',unavail('apollo'));
  else await step('people_apollo','Personer: Apollo','skipped','Ikke brukt: nok kandidater fra nettsidene');

  /* 4. samle kontaktdata og rangere. E-post fra Apollo koster kreditter og hentes bare etter eksplisitt bekreftelse per person. */
  await rep({state:'enriching_people'});
  const kept=enrKeep(a,U,R.cands);
  await step('rank','Rangering','done',kept.length+' kandidat'+(kept.length===1?'':'er')+' beholdt av '+R.cands.length,kept.length);
  await step('general','Generell adresse','done',(R.general.emails.length||R.general.phones.length||R.general.url)?[R.general.emails.map(e=>e.v).join(', '),R.general.phones.join(', ')].filter(Boolean).join(' · ')||'Kontaktside funnet':'Fant ingen generell adresse',R.general.emails.length+R.general.phones.length);
  R.cands=kept; R.apOk=apOk; R.researchOk=R.okBy.web>0||apOk>0; return R; }

/* ---------- lagring (siden): research først, kandidater etterpå ---------- */
function enrMergeGeneral(old,g){
  const o=old||{}, emails=(o.emails||[]).slice(), phones=(o.phones||[]).slice();
  for(const e of (g.emails||[])) if(!emails.some(x=>x.v===e.v)) emails.push({v:e.v,kind:e.kind,url:e.url||''});
  for(const p of (g.phones||[])) if(!phones.includes(p)) phones.push(p);
  return {emails,phones,url:o.url||g.url||'',at:iso(new Date())}; }
async function enrSaveResearch(accId,events,general){
  const cur=mtGet(accId); if(!cur) return {added:0}; const old=((cur.doc||{}).enr)||cur.enr||{}; let enr=old, added=0;
  if(events&&events.length){ const m=enrMerge(old,events,enrRoom(events)); enr=m.enr; added=m.added; }
  const hasG=general&&((general.emails&&general.emails.length)||(general.phones&&general.phones.length)||general.url);
  const g=hasG?enrMergeGeneral(old.general,general):null; if(!added&&!g) return {added:0};
  await mtPatch(accId,{enr:{...enr,...(g?{general:g}:{}),enriched_at:iso(new Date()),result_version:(old.result_version||0)+1,source:'page'}},added?'Research: '+added+' nye eventsignaler':'Research: generell kontaktadresse funnet');
  return {added}; }
function enrMergeCd(a,b){ const ev=((a&&a.ev)||[]).slice(); for(const e of ((b&&b.ev)||[])) if(!ev.some(x=>x.k===e.k&&x.url===e.url)) ev.push(e);
  return {ev:ev.slice(0,8),loc:(a&&a.loc)||(b&&b.loc)||'',cur:(a&&a.cur===false)||(b&&b.cur===false)?false:((a&&a.cur)||(b&&b.cur)||null),masked:!!((a&&a.masked)&&(b&&b.masked!==false)),rounds:[...new Set(((a&&a.rounds)||[]).concat((b&&b.rounds)||[]))]}; }
async function enrSaveCands(accId,R){
  const a=mtGet(accId); if(!a) return {n:0,upd:0}; const ex=(a.cands||[]).concat(a.persons||[]), now=iso(new Date()); let n=0, upd=0;
  for(const c of R.cands){
    const nm=mtNorm(c.name), em=String(c.email||'').toLowerCase();
    const dup=ex.find(p=>(em&&p.email&&p.email.toLowerCase()===em)||(c.linkedin&&p.linkedin&&p.linkedin===c.linkedin)||(c.apolloId&&p.sourceId&&p.sourceId===c.apolloId)||(nm&&mtNorm(p.name)===nm));
    const cd={ev:c.ev.slice(0,8),loc:c.loc||'',cur:c.cur==null?null:c.cur,masked:!!c.masked,rounds:c.rounds||[]};
    if(dup){ const patch={}; for(const k of ['title','email','phone','linkedin']) if(!dup[k]&&c[k]) patch[k]=c[k]; if(!dup.sourceUrl&&c.sourceUrl) patch.sourceUrl=c.sourceUrl; if(!dup.sourceId&&c.apolloId) patch.sourceId=c.apolloId;
      if(dup.rel==='kand') patch.cd=enrMergeCd(dup.cd,cd);
      if(Object.keys(patch).length&&S.mtper[dup.id]){ await mtSetPerson(dup.id,patch); upd++; } continue; }
    const onlyAp=c.ev.every(e=>e.k==='apollo'), id=uid('pe');
    await contactRepository.saveRaw(id,{accId,name:c.name,title:c.title||'',email:em,phone:c.phone||'',linkedin:c.linkedin||'',source:onlyAp?'Apollo':'Web',verifiedAt:'',emailStatus:'',phoneStatus:'',quality:'',provider:onlyAp?'apollo':'web',
      sourceUrl:c.sourceUrl||'',sourceId:c.apolloId||'',confidence:'medium',rel:'kand',active:false,dnc:null,foundAt:now,quote:String(c.quote||'').slice(0,200),cd},{noAudit:true});
    ex.push({id,name:c.name,email:em,linkedin:c.linkedin||'',sourceId:c.apolloId||''}); n++; }
  if(n||upd) await mtPatch(accId,{},n+' kontaktkandidat'+(n===1?'':'er')+' funnet (research)'+(upd?', '+upd+' oppdatert':''));
  return {n,upd}; }
async function enrSaveCd(accId,R,runId){
  const cur=mtGet(accId); if(!cur) return; const old=((cur.doc||{}).enr)||cur.enr||{};
  const cd={at:iso(new Date()),run:runId||'',summary:R.U.summary,notes:R.U.notes,why:R.U.why,rounds:R.rounds,stop:R.stop,calls:R.calls,pages:R.pages.length,pkinds:R.pkinds,pv:enrPvFinal(R),kept:R.cands.length};
  await mtPatch(accId,{enr:{...old,cd,enriched_at:old.enriched_at||iso(new Date())}}); }
function enrPvFinal(R){ const o={}; for(const p of ['web','apollo']) o[p]=R.pv[p]==='none'?(R.errors.some(e=>e.provider===p)?'error':'none'):R.pv[p]; return o; }

/* ---------- kjøring av én jobb (kø-arbeider). Bruker enrPipeline via EnrichmentService-formen ---------- */
async function enrRunJob(id){
  const j0=S.mtjob[id]; if(!j0||j0.status!=='queued') return;
  const stamp=()=>iso(new Date()), upd=p=>enrichmentJobRepository.update(id,{...p,last_updated_at:stamp()});
  const a=mtGet(j0.accId); if(!a){ await upd({status:'error',state:'provider_error',error:'Accounten finnes ikke.',completed_at:stamp()}); return; }
  const hist=[{s:'queued',at:j0.requested_at||stamp()}]; let cur='queued';
  const go=(state,extra)=>{ const n=enrAdvance(cur,state); if(n!==cur){ cur=n; hist.push({s:n,at:stamp()}); } return upd({state:cur,stage:ENR_ST[cur].stage,history:hist.slice(),...(extra||{})}); };
  await upd({status:'running',started_at:stamp(),executor:'page',blocked:'',provider_results:[],errors:[],providers:{},pv:{},claimed_by:me.id||me.name||'',state:'queued',stage:ENR_ST.queued.stage,history:hist.slice(),pipeline:[],error:''});
  const hb=setInterval(()=>{ const j=S.mtjob[id]; if(j&&j.status==='running') enrichmentJobRepository.update(id,{last_updated_at:stamp()}); },20000);
  try{
    if(!(ENR.stat&&(ENR.stat.web||ENR.stat.apollo))&&mcp) await enrProbe().catch(()=>{});
    const st=ENR.stat||{}, io={web:WebResearchProvider,apollo:ApolloProvider,has:{web:!!st.web,apollo:!!st.apollo,fetch:!!st.fetch},
      report:p=>{ const {state,steps,stage,...rest}=p, ex={...(steps?{pipeline:steps}:{}),...(stage?{stage}:{}),...rest}; return state?go(state,ex):upd(ex); },
      checkpoint:x=>enrSaveResearch(a.id,x.events,x.general)};
    const R=await enrPipeline(a,io);
    const sv=await enrSaveCands(a.id,R); await enrSaveCd(a.id,R,j0.run_id||'');
    const fresh=mtGet(a.id), pvf=enrPvFinal(R);
    let state=enrDataState(fresh); if(!state) state=!R.researchOk?(Object.values(pvf).includes('blocked')?'provider_blocked':'provider_error'):'no_person_found';
    const PR=[], note=(provider,status,detail,count)=>PR.push({provider,status,detail:detail||'',at:stamp(),count:count==null?null:count});
    const webSt=pvf.web==='ok'?(R.events.length||R.pages.length||R.cands.length?'ok':'empty'):pvf.web==='blocked'?'blocked':pvf.web==='plan'?'plan_restricted':pvf.web==='error'?'error':'not_connected';
    note('web',webSt,webSt==='ok'||webSt==='empty'?R.events.length+' eventsignal'+(R.events.length===1?'':'er')+' · '+R.pages.length+' sider · '+R.cands.length+' kandidater':webSt==='blocked'?'Ingen tilgang':'Ikke tilgjengelig',R.cands.length);
    const apOrg=R.steps.find(x=>x.id==='apollo_org'), apCands=R.cands.filter(c=>c.ev.some(e=>e.k==='apollo')).length;
    if(apOrg&&apOrg.status==='done') note('apollo',apOrg.count?'ok':'empty',apOrg.detail,apOrg.count||0);
    const apSt=R.apOk?(apCands?'ok':'empty'):pvf.apollo==='blocked'?'blocked':pvf.apollo==='plan'?'plan_restricted':pvf.apollo==='error'?'error':'not_connected';
    note('apollo',apSt,apSt==='ok'||apSt==='empty'?'Personsøk':apSt==='plan_restricted'?'Personsøk er ikke på planen':apSt==='blocked'?'Ingen tilgang':apSt==='error'?'Svarte ikke':'Ikke brukt',apCands);
    note('cognism','not_connected','Ekstra kilde tilgjengelig via Claude',0);
    const provObj={}; for(const p of PR){ const v=p.status==='ok'||p.status==='empty'?'ok':p.status; if(!provObj[p.provider]||provObj[p.provider]==='ok') provObj[p.provider]=v; }
    const blocked=state==='provider_blocked', errd=state==='provider_error', outcome=state==='ready'?'klar':state==='needs_review'||state==='partial'?'vurdering':state==='no_person_found'?'ingen_kontakt':'';
    const nCand=R.cands.length, note2=[R.events.length+' eventsignal'+(R.events.length===1?'':'er'),nCand+' kandidat'+(nCand===1?'':'er')].join(', ');
    await go(state,{status:errd?'error':blocked?'queued':'done',blocked:blocked?(R.blockedCode||'server_not_connected'):'',outcome,completed_at:blocked?'':stamp(),provider_results:PR,errors:R.errors.slice(0,12),providers:provObj,pv:pvf,pipeline:R.steps,
      contacts_found:sv.n,events_found:R.events.length,note:note2,error:errd?((R.errors[0]&&R.errors[0].message)||'Research svarte ikke'):'',result_version:blocked?(j0.result_version||0):(j0.result_version||0)+1,partial_errors:R.perr,
      stage:'',cd:{rounds:R.rounds.length,stop:R.stop,calls:R.calls,pages:R.pages.length}});
    if(blocked){ ENR.fatal=R.blockedCode||'server_not_connected'; ENR.fatalAt=Date.now(); ENR.servers=null; }
    else if(!errd) bus.emit('account_enriched',{account_id:a.id,job_id:id,outcome,state});
  }catch(e){
    const code=(e&&e.code)||'error';
    await go('provider_error',{status:'error',completed_at:stamp(),errors:[{provider:'engine',code,message:String((e&&e.message)||code).slice(0,300)}],error:'Research kunne ikke fullføres',pv:{},stage:''});
  }finally{ clearInterval(hb); } }

/* ---------- EnrichmentService.enrichAccount: ett kall som kjører hele kjeden for én account ----------
   Samme form som POST /api/enrichment/accounts/:id. Her kjøres den i siden; på en server byttes enrRunJob mot serverens utfører. */
enrichmentService.enrichAccount=async function(accId,opt){ opt=opt||{};
  const a=mtGet(accId); if(!a) return fail('not_found','Accounten finnes ikke.');
  if(a.flags.disqualified||a.dncAcc) return fail('skipped',a.dncAcc?'Ikke kontakt':'Diskvalifisert');
  if(enrichmentService.plan(accId).state==='in_progress') return fail('in_progress','Research pågår allerede.');
  const jid=await enrichmentService._submit(accId,opt,{needs:['research','person_enrichment'],provider_order:['research','apollo']});
  await enrRunJob(jid); const j=S.mtjob[jid]||{};
  return ok({job_id:jid,state:enrJobState({...j,id:jid}),outcome:j.outcome||'',contacts_found:j.contacts_found||0,events_found:j.events_found||0,pv:j.pv||{}}); };
const _enrSubmit=enrichmentService._submit;
enrichmentService._submit=async function(accId,opt,pl){ opt=opt||{}; const id=await _enrSubmit.call(enrichmentService,accId,opt,pl);
  await enrichmentJobRepository.update(id,{state:'queued',stage:ENR_ST.queued.stage,history:[{s:'queued',at:iso(new Date())}],run_id:opt.runId||(opt.groupId?'grp_'+opt.groupId:''),pipeline:[],pv:{}}); return id; };
crm.enrichment.enrichAccount=(id,o)=>safely(()=>enrichmentService.enrichAccount(id,o));

/* ---------- Berik alle ---------- */
const ENR_AUTO=['not_started','provider_blocked','provider_error'];
function enrTargets(){
  const L=mtWorking(), sel=[...ENR.sel].filter(id=>L.some(a=>a.id===id));
  if(sel.length) return {ids:sel,sel:true,n:sel.length};
  const A=L.filter(a=>!a.flags.disqualified&&!a.dncAcc&&a.es&&ENR_AUTO.includes(a.es.state)).sort((x,y)=>y.fit.total-x.fit.total||enrSignal(y)-enrSignal(x));
  return {ids:A.map(a=>a.id),sel:false,n:A.length}; }
async function enrRunAll(){
  const t=enrTargets(); if(!t.ids.length){ toast('Ingenting å berike.'); return {queued:0}; }
  const runId='run_'+Date.now().toString(36); ENR.fatal=''; ENR.dismissed='';
  const ids=t.sel?t.ids.slice().sort((x,y)=>{ const A=mtGet(x),B=mtGet(y); return (B?B.fit.total:0)-(A?A.fit.total:0); }):t.ids;
  const r=await enrichmentService.startMany(ids,{force:true,runId,groupId:'',groupName:''}); if(t.sel) ENR.sel.clear();
  toast(r.queued?'Beriker '+r.queued+' account'+(r.queued===1?'':'s')+' …':'Ingenting å berike.'); renderView(true); return r; }
/* kompakt jobblinje: avledet av lagrede jobber, overlever navigasjon og reload */
function enrRunInfo(){
  const all=bkJobs().filter(j=>(j.kind||'enrich')==='enrich'&&j.run_id); if(!all.length) return null;
  const last=all.sort((x,y)=>String(y.requested_at).localeCompare(String(x.requested_at)))[0].run_id; let L=all.filter(j=>j.run_id===last&&j.status!=='cancelled'); { const m={}; for(const j of L){ if(!m[j.accId]||String(j.requested_at)>String(m[j.accId].requested_at)) m[j.accId]=j; } L=Object.values(m); }
  if(!L.length||ENR.dismissed===last) return null;
  const c={id:last,total:L.length,done:0,run:0,ready:0,attention:0,none:0,blocked:0,at:''};
  for(const j of L){ const a=mtGet(j.accId), es=a&&a.es; c.at=String(j.completed_at||j.requested_at||'')>c.at?String(j.completed_at||j.requested_at||''):c.at;
    if(bkActive(j)){ if(j.blocked||(ENR.fatal&&ENR.mine.has(j.id))) c.blocked++; else c.run++; continue; }
    c.done++; const st=es?es.state:enrJobState(j);
    if(es?es.kready:st==='ready') c.ready++; else if(st==='no_person_found') c.none++; else if(st==='provider_blocked') c.blocked++; else c.attention++; }
  c.live=c.run>0||c.blocked>0&&c.done<c.total;
  if(!c.live&&c.at&&Date.now()-Date.parse(c.at)>6*3600e3) return null;
  return c; }
MT_MEMO=null;
