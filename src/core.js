/* ---------- Dataslag: store, hendelser, domenemodell, repositories ----------
   LAG (ovenfra og ned):  UI  →  crm.* (fasade)  →  services  →  repositories  →  store  →  Local-lagring (db + localStorage)
   - store:         eneste sted som rører persistens. `put/del/hardDel/saveSettings/commit` i app_base.js er nå
                    den PRIVATE lokale adapteren; localStorage nås bare via storeLocal() med ett navnerom (salong_v1).
   - repositories:  eneste skrivevei for CRM-data (Local*Repository). Samme grensesnitt blir senere Api*Repository.
   - mappers:       gjør de lagrede (eldre) dokumentene om til domeneentiteter med stabile ID-er, data_origin og kildefelt.
                    Lagrede dokumenter endres ikke bakover; manglende felt avledes ved lesing.
   - hendelser:     enkel hendelsesbuss. Tekniske hendelser havner ALDRI i brukerhistorikken (acts).
   Ingenting her kontakter eksterne tjenester, og ingenting her genererer data. */

/* ===== standardsvar ===== */
const ok=(data)=>({success:true,data:data===undefined?null:data,error_code:null,error_message:null});
const fail=(code,msg,data)=>({success:false,data:data===undefined?null:data,error_code:code,error_message:msg||code});
function safely(fn){ const wrap=r=>(r&&typeof r==='object'&&'success' in r)?r:ok(r), bad=e=>fail((e&&e.code)||'internal_error',(e&&e.message)||String(e));
  try{ const r=fn(); return (r&&typeof r.then==='function')?r.then(wrap,bad):wrap(r); }catch(e){ return bad(e); } }   // synkron i prototypen, Promise når implementasjonen er asynkron (backend)
/* useQuery: felles lasting/tomt/feil/suksess for visninger. Synkrone svar returneres direkte; Promise gir 'loading' og ny rendering når svaret kommer. */
const QRY={};
function useQuery(key,fn){ const r=fn(); if(!(r&&typeof r.then==='function')) return r; const c=QRY[key]; if(c&&c.dv===DV&&!c.pending) return c.res;
  if(!c||!c.pending){ QRY[key]={dv:DV,res:c?c.res:null,pending:true}; r.then(x=>{ QRY[key]={dv:DV,res:x}; renderView(true); }); } return c?c.res:null; }
/* felles tilstandsmekanisme for lasting, tomt, feil og suksess i visninger */
function viewState(res,opt){ opt=opt||{};
  if(res===null||res===undefined) return {state:'loading'};
  if(!res.success) return {state:'error',code:res.error_code,message:res.error_message};
  const empty=Array.isArray(res.data)?res.data.length===0:res.data==null||(opt.emptyIf&&opt.emptyIf(res.data));
  return {state:empty?'empty':'success',data:res.data}; }
function stateHTML(st,msgs){ msgs=msgs||{};
  if(st.state==='loading') return '<p class="meta" role="status">'+esc(msgs.loading||'Laster …')+'</p>';
  if(st.state==='error') return '<p class="meta bad" role="alert">'+esc(msgs.error||st.message||'Noe gikk galt.')+'</p>';
  if(st.state==='empty') return '<p class="meta">'+esc(msgs.empty||'Ingenting å vise ennå.')+'</p>';
  return ''; }

/* ===== lokal lagring: ett navnerom, versjonert, med migrering ===== */
const CORE_SCHEMA=2;                       // 1 = før dataslaget (salong-*-nøkler), 2 = dataslaget (salong_v1:*)
function storeLocal(op,key,val){
  const SCHEMA=2, NS='salong_v1', LEG={outbox:'salong-outbox',view:'salong-view',profile:'salong-profile'}, k=NS+':'+key;
  try{
    if(!storeLocal.done){ storeLocal.done=1;
      const cur=Number(localStorage.getItem('salong_schema_version')||0);
      if(cur<SCHEMA){ for(const [n,old] of Object.entries(LEG)){ const v=localStorage.getItem(old); if(v!==null&&localStorage.getItem(NS+':'+n)===null){ localStorage.setItem(NS+':'+n,v); if(localStorage.getItem(NS+':'+n)===v) localStorage.removeItem(old); } }
        localStorage.setItem('salong_schema_version',String(SCHEMA)); } }
    if(op==='get') return localStorage.getItem(k);
    if(op==='set') return localStorage.setItem(k,val);
    if(op==='remove') return localStorage.removeItem(k);
  }catch(e){ return op==='get'?null:undefined; }
}
/* hva som bor lokalt i nettleseren (dokumentert; alt annet ligger i db-samlingene) */
const STORE_LOCAL_DOC=[
  {key:'salong_v1:outbox',what:'Ventende skrivinger som ikke er bekreftet av databasen ennå (flyttes til server-kø i backend)'},
  {key:'salong_v1:view',what:'Sist åpnede visning (ren brukerpreferanse)'},
  {key:'salong_v1:profile',what:'Hvilken teamprofil denne nettleseren handler som (erstattes av innlogging i backend)'},
  {key:'salong_schema_version',what:'Versjon av lokal lagring. Migrering kjøres automatisk ved oppstart og beholder alle data'}];
const STORE_COLLECTIONS=['orgs','deals','acts','offers','bookings','prospects','audit','imports','kdocs','members','notices','mscen','malts','mpos','mtacc','mtper','mtbat','mtsnap','mtq','mtjob'];

/* ===== hendelsesbuss (tekniske hendelser; aldri brukerhistorikk) ===== */
const BUS_EVENTS=['account_enriched','activity_completed','case_stage_changed','batch_started','goal_updated','job_status_changed'];
const bus={ _l:{}, log:[],
  on(ev,fn){ (this._l[ev]=this._l[ev]||[]).push(fn); return ()=>this.off(ev,fn); },
  off(ev,fn){ this._l[ev]=(this._l[ev]||[]).filter(f=>f!==fn); },
  emit(ev,payload){ this.log.push({ev,at:Date.now(),payload}); if(this.log.length>200) this.log.shift(); for(const f of (this._l[ev]||[]).slice()){ try{ f(payload); }catch(e){} } } };

/* ===== skrivetelling og hendelsesutledning (kalles fra put/hardDel/saveSettings) ===== */
const STORE={depth:0,repo:0,direct:0,directBy:{},jobSeen:null};
function viaRepo(fn){ STORE.depth++; try{ return fn(); } finally{ STORE.depth--; } }
function storeCount(col){ if(STORE.depth>0) STORE.repo++; else { STORE.direct++; STORE.directBy[col]=(STORE.directBy[col]||0)+1; } }
function storeNotify(col,id,prev,doc){
  try{
    if(col==='deals'&&prev&&doc&&prev.stage!==doc.stage) bus.emit('case_stage_changed',{case_id:id,account_id:doc.orgId,from:prev.stage,to:doc.stage});
    if(col==='acts'&&doc&&doc.done&&!(prev&&prev.done)&&!doc.derived) bus.emit('activity_completed',{activity_id:id,account_id:doc.orgId,type:doc.type});
    if(col==='mtjob'&&doc){ const was=prev&&prev.status; if(was!==doc.status) bus.emit('job_status_changed',{job_id:id,account_id:doc.accId,from:was||null,to:jobStatus(doc)});
      if(doc.kind!=='enroll'&&doc.status==='done'&&was!=='done') bus.emit('account_enriched',{account_id:doc.accId,job_id:id,outcome:doc.outcome||''}); }
  }catch(e){}
}

/* statusendringer som kommer inn fra databasen (f.eks. når Claude-økten fullfører en jobb) gir samme hendelser som lokale skrivinger */
function storeSnap(col){
  if(col!=='mtjob') return; const seen=STORE.jobSeen, first=!seen; const cur={}; for(const [id,j] of Object.entries(S.mtjob||{})) if(j) cur[id]=j.status;
  if(!first) for(const [id,st] of Object.entries(cur)){ const was=seen[id]; if(was!==st){ const j=S.mtjob[id]; bus.emit('job_status_changed',{job_id:id,account_id:j.accId,from:was||null,to:jobStatus(j)}); if(j.kind!=='enroll'&&st==='done') bus.emit('account_enriched',{account_id:j.accId,job_id:id,outcome:j.outcome||''}); } }
  STORE.jobSeen=cur; }

/* ===== opprinnelse og domenemodell ===== */
const DATA_ORIGINS=['user','import','public_source','apollo','cognism','system_derived','test','unknown'];
function originOf(rec,col,id){
  if(rec&&DATA_ORIGINS.includes(rec.data_origin)) return rec.data_origin;
  const o=dqOrigin(rec,col,id);
  if(o==='test'||o==='example') return 'test';
  if(o==='unknown') return 'unknown';
  if(o==='public') return 'public_source';
  const s=String((rec&&(rec.src||rec.source))||'').toLowerCase();
  if(/apollo/.test(s)) return 'apollo'; if(/cognism/.test(s)) return 'cognism';
  if(/import|scout|csv/.test(s)) return 'import'; if(/profil|offentlig|public/.test(s)) return 'public_source';
  if(rec&&(rec.derived)) return 'system_derived';
  return 'user';
}
function statusOf(rec,col,id){ if(rec&&rec.deletedAt) return 'archived'; const o=dqOrigin(rec,col,id); return o==='example'?'example':o==='test'?'test':o==='unknown'?'unknown':'active'; }
const metaOf=(d)=>({created_at:(d&&d.createdAt)||null,updated_at:(d&&d.updatedAt)||null,created_by:(d&&d.createdBy)||null,updated_by:(d&&d.updatedBy)||null});
const srcOf=(d,own)=>({data_origin:own||null,source_url:(d&&(d.source_url||d.srcUrl))||null,source_external_id:(d&&(d.source_external_id||d.externalId))||null,source_retrieved_at:(d&&(d.source_retrieved_at||d.verifiedAt))||null});

/* jobbstatus: lagret verdi (queued/running/done/error) → domenestatus (queued, running, needs_review, completed, failed, cancelled) */
function jobStatus(j){ const s=j&&j.status; if(s==='queued'||s==='running'||s==='cancelled') return s; if(s==='error'||s==='failed') return 'failed';
  if(s==='done'||s==='completed'){ return (j.outcome==='vurdering'||j.outcome==='ingen_kontakt'||j.outcome==='mangler_grunnlag')?'needs_review':'completed'; } return 'queued'; }

function toAccount(a){
  const doc=a.doc||null, rec=a.org||doc||null, col=a.org?'orgs':'mtacc';
  return {id:a.id,name:a.name,org_number:a.orgnr||null,domain:a.domain||null,website:a.website||null,segment_id:a.segId||null,owner_id:a.ownerId||null,
    relation:a.rel,kind:a.kind,status:a.status,stage:a.stage,fit_score:a.fit?a.fit.total:null,batch_id:a.batch?a.batch.id:null,
    data_status:statusOf(rec,col,a.id),...srcOf(doc,originOf(rec||{src:a.src},col,a.id)),
    enrichment:{state:a.enr?a.enr.state||null:null,last_job_id:a.job?a.job.id:null,last_enriched_at:(a.enr&&a.enr.enriched_at)||null,result_version:(a.enr&&a.enr.result_version)||0},...metaOf(doc||a.org)}; }
function toContact(p,accId){
  const hasSrc=!!(p.source&&p.source!=='Manuell');
  return {id:p.id,account_id:p.accId||accId,name:p.name||'',title:p.title||'',email:p.email||null,email_status:p.emailStatus||null,phone:p.phone||null,phone_status:p.phoneStatus||null,linkedin_url:p.linkedin||null,
    role_match:p.role||null,relevant:p.rel==='ja',active:p.active!==false,do_not_contact:!!p.dnc,verified:!!(p.verifiedAt&&hasSrc),last_enriched_at:p.verifiedAt||p.enrichedAt||null,
    ...srcOf(p,/apollo/i.test(p.source||'')?'apollo':/cognism/i.test(p.source||'')?'cognism':/import|csv/i.test(p.source||'')?'import':'user'),...metaOf(p)}; }
function toCase(d){ return {id:d.id,account_id:d.orgId,title:d.title||'',stage:d.stage,value:Number(d.value)||0,room:d.room||null,event_date:d.date||null,attendees:Number(d.attendees)||0,owner_id:d.ownerId||null,
  stage_changed_at:d.stageAt||null,lost_reason:d.lostReason||null,data_status:statusOf(d,'deals',d.id),...srcOf(d,originOf(d,'deals',d.id)),...metaOf(d)}; }
function toActivity(a){ return {id:a.id,account_id:a.orgId||null,case_id:a.dealId||null,contact_id:a.pid||null,type:a.type,text:a.text||'',occurred_at:a.at||null,due_at:a.due||null,completed:!!a.done,direction:a.dir||null,
  owner_id:a.ownerId||null,data_status:statusOf(a,'acts',a.id),...srcOf(a,originOf(a,'acts',a.id)),...metaOf(a)}; }
function toBatch(b){ return {id:b.id,name:b.name,status:b.status,segment_ids:b.segIds||[],wave:b.wave||null,size:b.size||(b.accIds||[]).length,owner_id:b.ownerId||null,
  accounts:(b.accIds||[]).map((id,i)=>({batch_id:b.id,account_id:id,position:i+1})),...metaOf(b)}; }
function toJobEntity(j){ return {id:j.id,kind:j.kind||'enrich',account_id:j.accId,group_id:j.groupId||null,provider:j.provider||'claude_session',status:jobStatus(j),outcome:j.outcome||null,
  providers:j.providers||{},missing:j.missing||[],requested_at:j.requested_at||null,requested_by:j.requested_by||null,started_at:j.started_at||null,completed_at:j.completed_at||null,
  error:j.error||null,result_version:j.result_version||0,executor:j.executor||null,requested_by_name:j.requested_by||null,providers_requested:j.providers_requested||[],provider_results:j.provider_results||[],errors:j.errors||[],last_updated_at:j.last_updated_at||null,contacts_found:j.contacts_found||0,blocked:j.blocked||null}; }

/* ===== repositories (Local*Repository). Kun disse skriver CRM-data. ===== */
const rawPut=(col,id,doc,opts)=>viaRepo(()=>put(col,id,doc,opts));
const rawDel=(col,id)=>viaRepo(()=>hardDel(col,id));
const col_=(c)=>S[c]||(S[c]={});

const accountRepository={ kind:'local',
  list(f){ f=f||{}; if(f.scope==='all'){ const out=[]; for(const o of allOrgs()){ const rec=S.orgs[o.id]||null; out.push({id:o.id,name:o.name,domain:domainOf(o.website||'')||null,website:o.website||null,org_number:o.orgnr||null,segment_id:null,owner_id:(rec&&rec.ownerId)||null,data_status:rec?statusOf(rec,'orgs',o.id):'active',...srcOf(rec,rec?originOf(rec,'orgs',o.id):'public_source'),...metaOf(rec)}); } return out; }
    let L=mtAll(); if(f.batch_id) L=L.filter(a=>a.batch&&a.batch.id===f.batch_id); if(f.segment_id) L=L.filter(a=>a.segId===f.segment_id); if(f.owner_id) L=L.filter(a=>a.ownerId===f.owner_id); if(f.status) L=L.filter(a=>a.status===f.status);
    return L.map(toAccount); },
  get(id){ const a=mtGet(id); return a?toAccount(a):null; },
  raw(id){ return mtGet(id); },                                        // internt avledet objekt for visninger som trenger full detalj
  saveRaw(id,doc,opts){ return rawPut('mtacc',id,doc,opts||{noAudit:true}); },
  saveOrgRaw(id,doc,opts){ return rawPut('orgs',id,doc,opts); },
  async create(input){ const r=await mtAddAccount(input); return r.err?fail(r.dup?'duplicate':'invalid',r.err,r):ok(r); },
  update(id,patch,note){ return mtPatch(id,patch,note||''); },
  setOwner(id,ownerId){ return mtSetOwner(id,ownerId); } };

const contactRepository={ kind:'local',
  listByAccount(accId){ const a=mtGet(accId); return a?a.persons.map(p=>toContact(p,accId)):[]; },
  get(id){ const p=S.mtper[id]; return p?toContact({id,...p}):null; },
  saveRaw(id,doc,opts){ return rawPut('mtper',id,doc,opts||{noAudit:true}); },
  remove(id){ return rawDel('mtper',id); },
  update(id,patch){ return mtSetPerson(id,patch); },
  async setDoNotContact(id,reason){ const r=await mtDnc(id,reason); return r&&r.err?fail('invalid',r.err):ok(r); }, clearDoNotContact(id){ return mtClearDnc(id); }, async add(accId,f){ const r=await mtAddPerson(accId,f); return r&&r.err?fail('invalid',r.err):ok(r); } };

const activityRepository={ kind:'local',
  list(f){ f=f||{}; let L=acts().filter(a=>!a.derived); if(f.operational!==false) L=L.filter(a=>dqOk(a,'acts',a.id)); if(f.account_id) L=L.filter(a=>a.orgId===f.account_id); if(f.case_id) L=L.filter(a=>a.dealId===f.case_id);
    if(f.type) L=L.filter(a=>a.type===f.type); if(f.open) L=L.filter(a=>a.type==='task'&&!a.done); return L.map(toActivity); },
  saveRaw(id,doc,opts){ return rawPut('acts',id,doc,opts||{}); },
  create(i){ return viaRepo(()=>logAct({orgId:i.account_id,dealId:i.case_id,type:i.type,text:i.text,due:i.due_at,done:i.completed,ownerId:i.owner_id})); },
  complete(id){ const a=S.acts[id]; if(!a) return fail('not_found','Aktiviteten finnes ikke.'); return rawPut('acts',id,{...a,done:true,doneAt:iso(new Date())},{action:'utført'}); } };

const caseRepository={ kind:'local',
  list(f){ f=f||{}; let L=deals(); if(f.operational!==false) L=L.filter(d=>dqOk(d,'deals',d.id)); if(f.account_id) L=L.filter(d=>d.orgId===f.account_id); if(f.open) L=L.filter(d=>OPEN.includes(d.stage)); if(f.stage) L=L.filter(d=>d.stage===f.stage); return L.map(toCase); },
  get(id){ const d=S.deals[id]; return d&&!d.deletedAt?toCase({id,...d}):null; },
  saveRaw(id,doc,opts){ return rawPut('deals',id,doc,opts); },
  setStage(id,stage){ const d=S.deals[id]; if(!d) return fail('not_found','Saken finnes ikke.'); if(!ST[stage]) return fail('invalid_stage','Ugyldig fase.'); return viaRepo(()=>setStage(id,stage)); } };

const batchRepository={ kind:'local',
  list(){ return mtBuild().batches.map(toBatch); },
  get(id){ const b=mtBuild().batches.find(x=>x.id===id); return b?toBatch(b):null; },
  saveRaw(id,doc,opts){ return rawPut('mtbat',id,doc,opts||{noAudit:true}); },
  create(o){ return mtCreateBatch(o); }, setStatus(id,st){ return mtBatchStatus(id,st); }, removeAccount(id,accId){ return mtBatchRemove(id,accId); } };

const enrichmentJobRepository={ kind:'local',
  list(f){ f=f||{}; let L=bkJobs(); if(f.kind) L=L.filter(j=>(j.kind||'enrich')===f.kind); if(f.account_id) L=L.filter(j=>j.accId===f.account_id); if(f.group_id) L=L.filter(j=>j.groupId===f.group_id);
    if(f.status) L=L.filter(j=>jobStatus(j)===f.status); return L.map(toJobEntity); },
  get(id){ const j=S.mtjob[id]; return j?toJobEntity({id,...j}):null; },
  latestForAccount(accId){ const j=bkJobOf(accId); return j?toJobEntity(j):null; },
  create(doc){ const id=uid('job'); return rawPut('mtjob',id,doc,{noAudit:true}).then(()=>id); },
  update(id,patch){ const j=S.mtjob[id]; if(!j) return fail('not_found','Jobben finnes ikke.'); return rawPut('mtjob',id,{...j,...patch},{noAudit:true}); },
  cancel(id){ const j=S.mtjob[id]; if(!j) return fail('not_found','Jobben finnes ikke.'); if(j.status!=='queued') return fail('not_cancellable','Bare ventende jobber kan avbrytes.'); return rawPut('mtjob',id,{...j,status:'cancelled',completed_at:iso(new Date()),note:'Avbrutt av '+(me.name||'bruker')},{noAudit:true}); } };

const snapshotRepository={ kind:'local', list(){ return mtSnaps(); }, saveRaw(id,doc,opts){ return rawPut('mtsnap',id,doc,opts||{noAudit:true}); } };
const scoutRepository={ kind:'local', saveRaw(id,doc,opts){ return rawPut('mtq',id,doc,opts||{noAudit:true}); } };
const settingsRepository={ kind:'local', get(k){ return k?(S.settings||{})[k]:{...(S.settings||{})}; }, save(patch){ return viaRepo(()=>saveSettings(patch)); } };

/* mål: ett seksmånedersmål er eneste kilde. Selve beregningene ligger i planningService (plan.js). */
const goalRepository={ kind:'local',
  getCurrent(){ const g=(S.settings||{}).goal6||null; return g; },
  save(goal){ return settingsRepository.save({goal6:goal}); } };
