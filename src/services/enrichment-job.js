/* ---------- EnrichmentJob: backend-klar jobbmodell (se services/types.js) ----------
   Prototypen lagrer jobber som `mtjob`-dokumenter med norske/interne felt (status queued|running|done|error, state, outcome,
   provider_results …) og resultatene spredt på accounten (`enr`, personer `mtper`). Denne modulen er den ENESTE som kjenner
   forskjellen: den lager den rene modellen UI og en fremtidig server snakker. En server returnerer samme form direkte.
   Ingen verdier gjettes: det som ikke er dokumentert er null. */
function enrJobStatus(j){
  const base=jobStatus(j);                                   // queued|running|needs_review|completed|failed|cancelled
  if(j&&j.status==='queued'&&j.blocked) return 'failed';     // blokkert (f.eks. Apollo utilgjengelig): ikke startet, må prøves på nytt
  if(base==='needs_review'){ const st=j.state||''; return st==='partial'||st==='no_person_found'?'partial':'needs_review'; }
  return base; }
function enrSourceStatuses(j){
  const out={}; for(const r of (j&&j.provider_results)||[]) if(r&&r.provider&&(!out[r.provider]||out[r.provider]==='ok'||out[r.provider]==='empty')) out[r.provider]=r.status;
  return out; }
function enrJobResult(a){
  if(!a) return null;
  const sig=(typeof drwSignals==='function'?drwSignals(a).all:[]), es=a.es||{}, rank=es.rank||{list:[],rec:null}, persons=(a.persons||[]);
  const cands=(rank.list||[]).map(x=>({name:x.p.name,title:x.p.title||null,relevanceScore:typeof x.score==='number'?x.score:null,source:x.p.provider||x.p.source||null}));
  const data=persons.filter(p=>p.email||p.phone||p.linkedin).map(p=>({email:p.email||null,phone:p.phone||null,linkedin:p.linkedin||null,source:p.source||null,verifiedAt:p.verifiedAt||null}));
  const room=a.room&&a.room.value&&a.room.value!=='Ukjent'?(a.room.label||a.room.value):null;
  const w=String(a.why||'').replace(/\s+/g,' ').trim();
  return {
    organization:{name:a.name,domain:a.domain||null,description:(a.doc&&a.doc.description)||null},
    eventSignals:sig.map(s=>({event:s.title,date:s.date||null,venue:s.venue||null,type:s.type||null,source:s.url||null})),
    contactCandidates:cands, contactData:data,
    recommendation:{whyNow:w||null,recommendedUseCase:(typeof MT_USECASE!=='undefined'&&MT_USECASE[a.segId])||null,recommendedRoom:room} }; }
/** Intern jobb (mtjob-dokument) + avledet account → EnrichmentJob. Result følger accountens NÅVÆRENDE data. */
function toEnrichmentJob(j,a){
  const status=enrJobStatus(j);
  return {id:j.id,accountId:j.accId||j.account_id,status,startedAt:j.started_at||null,completedAt:j.completed_at||null,sourceStatuses:enrSourceStatuses(j),
    error:status==='failed'?(j.error||j.blocked||null):null,
    result:status==='queued'||status==='running'?null:enrJobResult(a||mtGet(j.accId||j.account_id))}; }
