/* ---------- Tjenestelag: providers, services og crm-fasade ----------
   Alt UI skal gå via crm.*. Tjenestene bruker repositories (core.js) og kaller aldri put/localStorage selv.
   Ingen API-nøkler og ingen hemmeligheter finnes i frontend. Ingen provider-svar simuleres.

   PROVIDERS (apolloProvider, cognismProvider, researchProvider)
   - Felles grensesnitt: searchCompany, searchPeople, enrichCompany, enrichPerson. Alle returnerer {success,data,error_code,error_message}.
   - Uten registrert utfører svarer de `not_connected`. De finner aldri på personer eller selskaper.
   - I prototypen kan en publisert Salong ikke selv kalle Apollo/Exa/Firecrawl (ingen server, ingen hemmeligheter).
     Derfor går arbeid til jobbkøen (PrototypeEnrichmentRunner) som utføres av Claude-økten, ikke autonomt.
   - I backend registreres utførere med provider.register({...}) på serveren, og køen byttes mot Api-runneren. */
function makeProvider(id,label,meta){
  const exec={};
  const P={ id,label,meta:meta||{},
    register(fns){ Object.assign(exec,fns); return P; },
    isConnected(){ return Object.keys(exec).length>0; },
    async call(op,args){ if(!exec[op]) return fail('not_connected',label+' er ikke tilkoblet fra Salong. Ingenting er hentet eller simulert.'); return safely(()=>exec[op](args)); },
    searchCompany(q){ return P.call('searchCompany',q); }, searchPeople(q){ return P.call('searchPeople',q); },
    enrichCompany(q){ return P.call('enrichCompany',q); }, enrichPerson(q){ return P.call('enrichPerson',q); },
    status(){
      if(P.isConnected()) return {id,label,state:'connected',detail:'Tilkoblet',autonomous:true,last_used_at:null};
      const last=providerLastUse(id);
      if(P.meta.via_session) return {id,label,state:'via_claude_session',detail:last?(last.ok?'Brukt '+fd(String(last.at).slice(0,10),{day:'numeric',month:'short'})+' via Claude-økten':last.code==='ikke_tilkoblet'?'Ikke tilkoblet i Claude-økten':'Feilet sist ('+last.code+')'):'Ikke kjørt ennå. Utføres av Claude-økten, ikke autonomt.',autonomous:false,last_used_at:last?last.at:null};
      return {id,label,state:'not_connected',detail:P.meta.why||'Ikke tilkoblet',autonomous:false,last_used_at:null}; } };
  return P; }
/* siste resultat per provider, lest fra fullførte jobber (ekte utfall, ikke simulert) */
function providerLastUse(id){
  const J=bkJobs().filter(j=>j.status==='done'||j.status==='error').sort((x,y)=>String(y.completed_at||y.requested_at).localeCompare(String(x.completed_at||x.requested_at)));
  for(const j of J){ const v=j.providers&&j.providers[id]; if(v) return {ok:v==='ok',code:v,at:j.completed_at||j.requested_at}; } return null; }
const researchProvider=makeProvider('research','Research',{via_session:true,source:'Exa, Firecrawl, offentlige kilder',why:'Ikke tilkoblet'});
const apolloProvider=makeProvider('apollo','Apollo',{via_session:true,source:'Apollo-connector i Claude-økten',why:'Ikke tilkoblet',
  limits:'Gratisplan: people search-API er sperret, og ingen postkasse er koblet for sekvenser. Kredittforbruk krever bekreftelse.'});
const cognismProvider=makeProvider('cognism','Cognism',{via_session:false,why:'Ekstra kilde tilgjengelig via Claude'});
const PROVIDERS={research:researchProvider,apollo:apolloProvider,cognism:cognismProvider};

/* ---------- PrototypeEnrichmentRunner: jobbkø i databasen, utført av Claude-økten ----------
   Grensesnitt (samme for backend): submit(spec) → job_id · cancel(id) · status(id).
   Bytt til ApiEnrichmentRunner (POST /enrichment-jobs) når backend finnes. Bare JOBB-STATUS finnes her; resultater skrives av den som utfører jobben. */
const prototypeEnrichmentRunner={ id:'prototype_queue', autonomous:false, executor:'claude_session',
  submit(spec){ return enrichmentJobRepository.create({kind:'enrich',provider:'claude_session',status:'queued',outcome:'',steps:{},providers:{},missing:[],requested_at:iso(new Date()),requested_by:me.name||'',started_at:'',completed_at:'',error:'',result_version:0,note:'',...spec}); },
  cancel(id){ return enrichmentJobRepository.cancel(id); },
  status(id){ return enrichmentJobRepository.get(id); } };
let enrichmentRunner=prototypeEnrichmentRunner;

/* ---------- EnrichmentService ---------- */
const enrichmentService={
  providers(){ return Object.values(PROVIDERS).map(p=>p.status()); },
  /* hva trenger accounten? Tjenesten avgjør dette, ikke UI-et. */
  plan(accId){
    const a=mtGet(accId); if(!a) return {account_id:accId,state:'unknown',needs:[],provider_order:[],reason:'Ukjent account.'};
    const j=a.job, base={account_id:accId,needs:[],provider_order:[],reason:''};
    if(a.flags.disqualified) return {...base,state:'skipped',reason:'Diskvalifisert'};
    if(a.dncAcc) return {...base,state:'skipped',reason:'Ikke kontakt'};
    if(bkActive(j)) return {...base,state:'in_progress',reason:j.status==='running'?'Beriker nå':'Venter på utfører'};
    const hasResearch=!!(a.enr&&(a.enr.event_signals&&a.enr.event_signals.length||a.enr.room_fit))||a.ev.level!=='Unknown';
    const needs=[]; if(!hasResearch) needs.push('research');
    if(!(a.flags.enriched&&a.flags.qualified&&a.enr&&a.enr.state==='klar')) needs.push('person_enrichment');
    if(a.flags.enriched&&a.flags.qualified&&!needs.includes('research')) return {...base,state:'done',reason:'Klar for kontakt'};
    const order=[]; if(needs.includes('research')) order.push('research'); if(cognismProvider.isConnected()) order.push('cognism'); order.push('apollo');
    return {...base,state:needs.includes('research')?'needs_research':'needs_person_enrichment',needs,provider_order:order,reason:needs.includes('research')?'Mangler researchgrunnlag':'Mangler kontaktperson'}; },
  async _submit(accId,opt,pl){
    const a=mtGet(accId);
    return enrichmentRunner.submit({accId,accName:a.name,domain:a.domain,website:a.website,orgnr:a.orgnr,place:a.place,segId:a.segId,segName:a.seg?a.seg.name:'',size:a.size||'',
      role_targets:bkRolesFor(a),small_org_fallback:a.size==='S'?'Daglig leder / generalsekretær hvis ingen funksjonell rolle finnes':'',groupId:opt.groupId||'',groupName:opt.groupName||'',
      plan:{needs:pl.needs,provider_order:pl.provider_order,max_active_contacts:2,send:false,enroll:false}}); },
  async startMany(ids,opt){ opt=opt||{};
    const out={queued:0,job_ids:[],skipped:{done:0,in_progress:0,skipped:0,unknown:0}};
    for(const id of ids){ let pl=enrichmentService.plan(id);
      if(pl.state==='done'&&opt.force){ pl={...pl,state:'needs_person_enrichment',needs:['person_enrichment'],provider_order:['apollo']}; }
      if(pl.state==='done'||pl.state==='in_progress'||pl.state==='skipped'||pl.state==='unknown'){ out.skipped[pl.state]++; continue; }
      out.job_ids.push(await enrichmentService._submit(id,opt,pl)); out.queued++; }
    return out; },
  async start(accId,opt){ opt=opt||{}; const a=mtGet(accId); if(!a) return fail('not_found','Accounten finnes ikke.');
    const o={groupId:a.batch?a.batch.id:'',groupName:a.batch?a.batch.name:'',force:true,...opt}; const r=await enrichmentService.startMany([accId],o);
    if(!r.queued) return fail('nothing_to_do',enrichmentService.plan(accId).reason||'Ingenting å berike.',r);
    return ok({...r,executor:enrichmentRunner.executor,autonomous:enrichmentRunner.autonomous}); },
  async startBatch(batchId,opt){ opt=opt||{}; const b=batchRepository.get(batchId); if(!b) return fail('not_found','Batchen finnes ikke.');
    let ids=b.accounts.map(x=>x.account_id);
    const todo=ids.filter(id=>{ const s=enrichmentService.plan(id).state; return s==='needs_research'||s==='needs_person_enrichment'; });
    let pick=todo; if(opt.limit){ pick=todo.map(id=>mtGet(id)).filter(Boolean).sort((x,y)=>y.fit.total-x.fit.total).slice(0,opt.limit).map(a=>a.id); }
    const r=await enrichmentService.startMany(pick,{groupId:batchId,groupName:b.name});
    bus.emit('batch_started',{batch_id:batchId,queued:r.queued,limit:opt.limit||null});
    if(!r.queued) return fail('nothing_to_do','Ingenting å berike: alle er klare, i kø eller utelatt.',r);
    return ok({...r,batch_id:batchId,executor:enrichmentRunner.executor,autonomous:enrichmentRunner.autonomous}); },
  getStatus(ref){ ref=ref||{};
    if(ref.batch_id){ const b=batchRepository.get(ref.batch_id); if(!b) return fail('not_found','Batchen finnes ikke.'); const A=b.accounts.map(x=>mtGet(x.account_id)).filter(Boolean), c=bkCounts(A);
      return ok({batch_id:b.id,name:b.name,total:c.total,done:c.done,counts:{ready:c.klar,waiting:c.venter,needs_review:c.vurdering,no_contact:c.ingen,no_basis:c.grunnlag,failed:c.feil,not_started:c.ikke},
        running:c.venter>0,executor:enrichmentRunner.executor,autonomous:enrichmentRunner.autonomous,providers:enrichmentService.providers()}); }
    if(ref.account_id){ const j=enrichmentJobRepository.latestForAccount(ref.account_id); return ok({account_id:ref.account_id,job:j,plan:enrichmentService.plan(ref.account_id)}); }
    return ok({pending:bkPending(),executor:enrichmentRunner.executor,autonomous:enrichmentRunner.autonomous,providers:enrichmentService.providers()}); },
  async cancel(jobId){ return safely(async()=>{ const r=await enrichmentRunner.cancel(jobId); if(r&&r.success===false) return r; return ok({job_id:jobId}); }); },
  async cancelBatch(batchId){ let n=0; for(const j of enrichmentJobRepository.list({group_id:batchId,status:'queued'})){ await enrichmentRunner.cancel(j.id); n++; } return ok({cancelled:n}); },
  /* Sekvens-enrollment er alltid en egen, eksplisitt handling godkjent av brukeren */
  async enroll(accId,seqName){ const r=await bkEnroll(accId,seqName); return r.err?fail('cannot_enroll',r.err):ok(r); } };

/* ---------- MarketService ---------- */
const marketService={
  getCoverage(){ return ok(mtStats(mtAll())); },
  getSegments(){ return ok(mtSegStats().map(s=>({id:s.id,name:s.name,priority:s.prio,active:!!s.on,discovered:s.discovered,qualified:s.qualified,enriched:s.enriched,addressed:s.addressed,engaged:s.engaged,opportunity:s.opportunity,coverage:s.cov}))); } };

/* ---------- PriorityService: én kø med normaliserte elementer. I dag bygger ikke sin egen oppgaveliste. ---------- */
const PRI_TYPE={1:'reply_due',2:'overdue',3:'due_today',4:'offer_stale',5:'sequence_step',6:'first_contact',7:'unassigned',8:'loose_task'};
function priNormalize(it){
  const act=it.assign?{kind:'assign',label:'Tildel',ref:it.assign}:it.rank===6?{kind:'start_contact',label:'Start kontakt',ref:it.open}:{kind:'open',label:it.open.k==='deal'?'Åpne saken':it.open.k==='org'?'Åpne kunden':'Åpne prospekt',ref:it.open};
  return {key:it.key,priority:ID_TIER[it.rank]||'maybe',rank:it.rank,type:PRI_TYPE[it.rank]||'task',object_id:it.dealId||it.accId||it.orgId||null,object_type:it.obj==='acc'?'account':it.obj==='deal'?'case':'activity',
    account_id:it.orgId||null,title:it.action,reason:(it.why||[]).join(' · '),due_at:it.due||null,late:!!it.late,owner_id:it.ownerId||null,primary_action:act,
    secondary_action:it.done?{kind:'complete',label:'Utført',ref:it.done}:null,source:it.src||'',_item:it}; }
const priorityService={
  getToday(opt){ opt=opt||{}; const Q=idQueue(); const items=Q.shown.map(priNormalize); return ok({items,focus:items.slice(0,opt.focus||3),more:Q.more,snoozed:Q.hidden.length}); },
  getAll(){ return ok(idItems().filter(i=>idInScope(i.ownerId,i.crit)).map(priNormalize)); },
  counts(){ const Q=idQueue(); return ok(idTop(Q)); } };

/* ---------- crm-fasaden: eneste inngang for UI ---------- */
const crm={
  accounts:{ list:f=>safely(()=>accountRepository.list(f)), get:id=>safely(()=>{ const a=accountRepository.get(id); return a||fail('not_found','Accounten finnes ikke.'); }),
    create:i=>safely(()=>accountRepository.create(i)), update:(id,p,n)=>safely(()=>accountRepository.update(id,p,n)), setOwner:(id,o)=>safely(()=>accountRepository.setOwner(id,o)) },
  contacts:{ listByAccount:id=>safely(()=>contactRepository.listByAccount(id)), add:(id,f)=>safely(()=>contactRepository.add(id,f)), update:(id,p)=>safely(()=>contactRepository.update(id,p)),
    setDoNotContact:(id,r)=>safely(()=>contactRepository.setDoNotContact(id,r)), clearDoNotContact:id=>safely(()=>contactRepository.clearDoNotContact(id)) },
  activities:{ list:f=>safely(()=>activityRepository.list(f)), create:i=>safely(()=>activityRepository.create(i)), complete:id=>safely(()=>activityRepository.complete(id)) },
  cases:{ list:f=>safely(()=>caseRepository.list(f)), get:id=>safely(()=>{ const c=caseRepository.get(id); return c||fail('not_found','Saken finnes ikke.'); }), setStage:(id,s)=>safely(()=>caseRepository.setStage(id,s)) },
  batches:{ list:()=>safely(()=>batchRepository.list()), get:id=>safely(()=>{ const b=batchRepository.get(id); return b||fail('not_found','Batchen finnes ikke.'); }),
    create:o=>safely(()=>batchRepository.create(o)), setStatus:(id,s)=>safely(()=>batchRepository.setStatus(id,s)) },
  enrichment:{ start:(id,o)=>safely(()=>enrichmentService.start(id,o)), startBatch:(id,o)=>safely(()=>enrichmentService.startBatch(id,o)), getStatus:r=>safely(()=>enrichmentService.getStatus(r)),
    cancel:id=>enrichmentService.cancel(id), cancelBatch:id=>safely(()=>enrichmentService.cancelBatch(id)), plan:id=>safely(()=>enrichmentService.plan(id)), providers:()=>safely(()=>enrichmentService.providers()),
    enroll:(id,s)=>safely(()=>enrichmentService.enroll(id,s)) },
  goals:{ getCurrent:()=>safely(()=>planningService.getCurrent()), getMonth:o=>safely(()=>planningService.getMonth(o)), update:p=>safely(()=>planningService.update(p)), getPlan:o=>safely(()=>planningService.getPlan(o)) },
  market:{ getCoverage:()=>safely(()=>marketService.getCoverage()), getSegments:()=>safely(()=>marketService.getSegments()) },
  priority:{ getToday:o=>safely(()=>priorityService.getToday(o)), getAll:()=>safely(()=>priorityService.getAll()), counts:()=>safely(()=>priorityService.counts()) },
  events:{ on:(e,f)=>bus.on(e,f), off:(e,f)=>bus.off(e,f), names:BUS_EVENTS },
  meta:{ schema_version:2,local_storage:STORE_LOCAL_DOC,collections:STORE_COLLECTIONS,stats:()=>({...STORE}) } };
