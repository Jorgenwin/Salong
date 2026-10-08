/* ---------- enrrun.js: providers, flerrunders kontaktfunn og kjøring ----------
   enrPipeline(a, io) er forretningslogikken: ren, uten DOM, database eller kø. Den får to providers og en io (report, checkpoint, has).
   WebResearchProvider og ApolloProvider returnerer alltid {ok:true,data} eller {ok:false,kind:'blocked'|'plan'|'error',code,message}.
   En kobling som feiler forkaster aldri det som allerede er funnet: eventsignaler og generell adresse lagres med en gang (checkpoint),
   kandidatene lagres etter rundene, og tilstanden settes ut fra hva som faktisk ble funnet.
   Ingenting simuleres. Personer, e-post og telefon kommer fra tekst en kilde faktisk har gitt, med sitat og sideadresse. */

/* ---------- WebResearchProvider: Claude-connectorene som porter for den delte pipelinen (research/pipeline.js) ---------- */
const WEB_OPS=createWebOps({
  search:enrExa,
  fetchPages:async(urls,maxChars)=>enrParseFetch(enrText(await enrCall('web_fetch_exa',{urls,maxCharacters:maxChars}))),
  isFatal:enrFatalErr});
function enrWebCompany(args){ return WEB_OPS.events(args); }
const WebResearchProvider={id:'web',async call(op,args){ try{ return {ok:true,data:await WEB_OPS[op](args)}; }catch(e){ return {ok:false,...enrClassify(e)}; } }};

/* ---------- ApolloProvider ---------- */
const APOLLO_OPS={
  async org(x){ return enrApolloCompany({a:x.a}); },
  async people(x){ return apolloAdapter.searchPeople({domain:x.dom,orgId:x.orgId,titles:x.titles,keywords:x.keywords}); } };
const ApolloProvider={id:'apollo',async call(op,args){ try{ return {ok:true,data:await APOLLO_OPS[op](args)}; }catch(e){ return {ok:false,...enrClassify(e)}; } }};


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
  const cd={at:iso(new Date()),run:runId||'',summary:R.U.summary,notes:R.U.notes,why:R.U.why,rounds:R.rounds,stop:R.stop,calls:R.calls,pages:R.pages.length,pkinds:R.pkinds,pv:enrPvFinal(R),kept:R.cands.length,read:R.read.pages,llm:{status:R.llm.status,calls:R.llm.calls},rejected:R.rejected.slice(0,12)};
  await mtPatch(accId,{enr:{...old,cd,enriched_at:old.enriched_at||iso(new Date())}}); }
function enrPvFinal(R){ const o={}; for(const p of ['web','apollo']) o[p]=R.pv[p]==='none'?(R.errors.some(e=>e.provider===p)?'error':'none'):R.pv[p]; return o; }

/* Claude som LLM-port i siden (kapabiliteten `sample`). Seeren samtykker første gang; sier de nei, spør vi ikke igjen i denne økten. */
function enrLlmPort(){
  if(!sample||ENR.noLlm) return null;
  return {async complete(req){
    try{ const r=await sample(req.system+'\n\n'+req.prompt,{modelTier:'quick',cache:false}); return {text:(r&&r.text)||''}; }
    catch(e){ const code=(e&&e.code)||'error'; if(code==='not_granted'||code==='capability_disabled') ENR.noLlm=true; throw {code:code==='rate_limited'?'rate_limited':code,message:String((e&&e.message)||code)}; } }}; }

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
    const st=ENR.stat||{}, io={web:WebResearchProvider,apollo:ApolloProvider,llm:enrLlmPort(),has:{web:!!st.web,apollo:!!st.apollo,fetch:!!st.fetch,llm:!!sample&&!ENR.noLlm},
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
    /* personsøket ble ikke forsøkt (kontakt funnet på nettsiden): da står organisasjonsoppslaget som Apollo-status */
    if(!(apSt==='not_connected'&&PR.some(p=>p.provider==='apollo'))) note('apollo',apSt,apSt==='ok'||apSt==='empty'?'Personsøk':apSt==='plan_restricted'?'Personsøk er ikke på planen':apSt==='blocked'?'Ingen tilgang':apSt==='error'?'Svarte ikke':'Ikke brukt',apCands);
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
  const rr=await SalongServices.enrichment.enrichAccounts(ids,{force:true,runId,groupId:'',groupName:''}), r=rr.success?rr.data:{queued:0}; if(t.sel) ENR.sel.clear();
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
