/* ---------- Berik: enrichment-jobber, leverandørstatus og resultatlagring ----------
   ARKITEKTUR (ærlig):
   - En publisert Salong har ingen egen server. Siden kan derfor ikke selv kalle Apollo, Exa eller Firecrawl.
   - «Berik» legger en enrichment_job i databasen (samling mtjob, provider «claude_session»). Jobben utføres av
     Claude-økten (research + Apollo-connector) og skriver resultatet tilbake til accounten. Salong viser status live.
   - Dette er IKKE autonomt: ingenting skjer før Claude-økten kjører køen («Kjør Salong-køen»).
   - Datamodellen (enrichment_job: provider, status, started_at, completed_at, error, result_version) er den samme
     når jobben senere flyttes til en egen backend. Da endres bare hvem som skriver; brukergrensesnittet er uendret.
   - Ingen svar simuleres. Mangler en leverandør, står det i jobben (missing/providers) og vises som «Ikke tilkoblet». */
S.mtjob=S.mtjob||{};
const BK_STEPS=[['research','Research virksomheten'],['events','Finn dokumenterte events'],['venues','Finn tidligere venues'],['format','Finn eventformat og frekvens'],['room','Vurder room fit'],['role','Bestem kjøperrolle'],['people','Søk personer i Apollo'],['enrich','Berik maks 2 personer'],['rank','Ranger kontaktpersonene']];
const BK_CMD='Kjør Salong-køen';
const BK_ROLEV={'Solstad':'Solstad','Collett':'Mellomstore rom','Hofmo':'Mellomstore rom','Berner-salongen':'Små rom','Ambjørnsen':'Små rom','Valkeapää':'Små rom','Flere muligheter':'Flere muligheter','Dagens rom':'Ukjent','Ukjent':'Ukjent'};
const BK_ROLEOPTS=Object.keys(BK_ROLEV);
/* segmentspesifikt kontaktrollehierarki: første er viktigst */
const BK_SEGROLES={fag:['Member Events','Events','Programme Manager','Communications','Marketing'],forskning:['Events','Programme Manager','Communications','External Relations'],
  tech:['Field Marketing','Partner Marketing','Channel Marketing','Events','Marketing Director'],saas:['Field Marketing','Partner Marketing','Customer Marketing','Events'],
  forlag:['Events','Marketing','Communications','Programme / Author Events'],ambassade:['Public Diplomacy / Culture','Communications','Events'],
  pharma:['Events / Congress','Marketing','Communications','Medical Education'],bedrift:['Events','Marketing','Communications','Partnerships'],utdanning:['Events','Programme Manager','Communications'],ovrige:['Events','Community','Communications','Marketing']};
Object.assign(MT_ROLEKW,{'Marketing':/marketing|markedsf|markeds/i,'External Relations':/external|relations|ekstern/i,'Events / Congress':/event|congress|kongress|arrangement/i,'Programme / Author Events':/programme|program|author|forfatter|event/i});
for(const s of MT_DEF_SEGS) if(BK_SEGROLES[s.id]) s.roles=BK_SEGROLES[s.id].slice();
const bkRolesFor=a=>{ const r=(a.roles&&a.roles.length?a.roles:BK_SEGROLES[a.segId])||[]; return r.slice(); };

/* ---------- jobbindeks ---------- */
const bkJobs=()=>Object.entries(S.mtjob||{}).map(([id,j])=>({id,...j})).filter(j=>j&&!j.deletedAt);
let BK_IDX=null;
function bkIdx(){ if(BK_IDX&&BK_IDX.dv===DV) return BK_IDX.v; const v={}; for(const j of bkJobs()){ if((j.kind||'enrich')!=='enrich') continue; const c=v[j.accId]; if(!c||String(j.requested_at||'')>String(c.requested_at||'')) v[j.accId]=j; } BK_IDX={dv:DV,v}; return v; }
const bkJobOf=id=>bkIdx()[id]||null;
const bkActive=j=>!!j&&(j.status==='queued'||j.status==='running');
function bkState(j){ if(!j) return ''; if(bkActive(j)) return 'venter'; if(j.status==='error') return 'feil'; return j.outcome||'vurdering'; }
function bkNextText(a){ const s=bkState(a.job); return s==='venter'?'Berik venter på Claude-økten':(s==='vurdering'||s==='klar')?'Vurder kontaktvalg':s==='ingen_kontakt'?'Ingen relevant kontakt funnet':s==='mangler_grunnlag'?'Mangler researchgrunnlag':s==='feil'?'Berik feilet. Prøv igjen':'Finn kontaktperson'; }
/* status som vises i Arbeidsliste og kort */
function bkStatus(a){
  const s=bkState(a.job), k=a.nx.k;
  if(a.flags.disqualified) return ['Diskvalifisert','bad']; if(a.dncAcc) return ['Ikke kontakt','bad'];
  if(k==='deal') return ['Aktiv sak','a']; if(k==='reply') return ['Svar mottatt','a'];
  if(a.prog) return ['I sekvens · dag '+a.prog.day,'a'];
  if(a.flags.enriched&&a.flags.qualified&&!a.flags.addressed) return ['Klar for kontakt','ok'];
  if(a.flags.addressed) return ['Venter på svar',''];
  if(!a.flags.qualified) return ['Trenger research','warn'];
  if(s==='venter') return ['Beriker','a']; if(s==='ingen_kontakt') return ['Mangler kontakt','bad']; if(s==='mangler_grunnlag') return ['Mangler grunnlag','bad']; if(s==='vurdering'||s==='klar') return ['Trenger vurdering','warn']; if(s==='feil') return ['Berik feilet','bad'];
  return ['Trenger berikelse',''];
}

/* ---------- dataflett: forskning fyller hull, men overskriver aldri bedre data ---------- */
const bkLvl=l=>l==='Dokumentert'||l==='Confirmed'?'Confirmed':l==='Indikasjon'||l==='Likely'?'Likely':'Unknown';
const bkSignals=enr=>((enr&&enr.event_signals)||[]).filter(x=>x&&(x.event_name||x.event_type));
function bkMergeEv(ev,enr){
  if(!enr||ev.manual) return ev; const L=bkSignals(enr); if(!L.length) return ev;
  const docd=L.filter(x=>x.level==='Dokumentert'&&x.source_url), lvl=docd.length?'Confirmed':'Likely', rank={Unknown:0,Likely:1,Confirmed:2};
  const srcOf=x=>({url:x.source_url,label:mtHost(x.source_url),checkedAt:x.source_date||''});
  if(rank[lvl]<rank[ev.level]) return ev;
  const rs=(docd.length?docd:L).filter(x=>x.source_url).map(srcOf);
  if(rank[lvl]===rank[ev.level]){ const seen=new Set(ev.sources.map(s=>s.url)); return {...ev,sources:ev.sources.concat(rs.filter(s=>!seen.has(s.url)))}; }
  return {level:lvl,sources:rs,note:L.slice(0,2).map(x=>x.event_name||x.event_type).join(' · '),manual:false,research:true};
}
function bkMergeRoom(room,enr){
  if(!enr||!enr.room_fit||room.manual) return room; const reason=String(enr.room_fit_reason||'').trim(); if(!reason||!(enr.room_fit in BK_ROLEV)) return room;
  if(room.value!=='Ukjent') return room;
  return {value:BK_ROLEV[enr.room_fit],label:enr.room_fit,basis:reason,rooms:enr.room_fit_rooms||[],source:'research',manual:false};
}
function bkOrder(a,list){ const e=a.enr; if(!e||!e.best_contact) return list; const rk=p=>p.id===e.best_contact?0:p.id===e.alternate_contact?1:2; return list.slice().sort((x,y)=>rk(x)-rk(y)); }

/* ---------- køing ---------- */
/* køing skjer i EnrichmentService (svc.js). Denne finnes for bakoverkompatibilitet. */
async function bkQueue(ids,opt){ const r=await enrichmentService.startMany(ids,opt||{}); return {n:r.queued,skip:r.skipped.done+r.skipped.in_progress+r.skipped.skipped+r.skipped.unknown}; }
async function bkEnroll(accId,seqName){
  const a=mtGet(accId); if(!a) return {err:'Ukjent account.'}; const c=mtCanEnroll(a); if(!c.ok) return {err:'Kan ikke enrolles: '+c.why.join('. ')+'.'};
  const dup=bkJobs().find(j=>j.kind==='enroll'&&j.accId===accId&&bkActive(j)); if(dup) return {err:'En enrollment venter allerede på Claude-økten.'};
  await enrichmentJobRepository.create({kind:'enroll',accId,accName:a.name,sequence_name:String(seqName||'').trim(),persons:c.persons.map(p=>({id:p.id,name:p.name,email:p.email,external_id:p.externalId||''})),
    approved_by:me.name||'',approved_at:iso(new Date()),provider:'claude_session',status:'queued',outcome:'',providers:{},requested_at:iso(new Date()),requested_by:me.name||'',started_at:'',completed_at:'',error:'',result_version:0,note:''});
  return {ok:1}; }
const bkEnrollOf=id=>bkJobs().filter(j=>j.kind==='enroll'&&j.accId===id).sort((x,y)=>String(y.requested_at).localeCompare(String(x.requested_at)))[0]||null;

/* ---------- telling ---------- */
function bkCounts(accs){
  const c={klar:0,venter:0,vurdering:0,ingen:0,grunnlag:0,feil:0,ikke:0};
  for(const a of accs){ const s=bkState(a.job);
    if(s==='venter') c.venter++; else if(a.flags.enriched&&a.flags.qualified) c.klar++; else if(s==='vurdering'||s==='klar') c.vurdering++; else if(s==='ingen_kontakt') c.ingen++; else if(s==='mangler_grunnlag') c.grunnlag++; else if(s==='feil') c.feil++; else c.ikke++; }
  c.done=c.klar+c.vurdering+c.ingen+c.grunnlag+c.feil; c.total=accs.length; return c; }
const bkAccsOf=b=>(b.accIds||[]).map(id=>mtGet(id)).filter(Boolean);

/* ---------- leverandørstatus: hva som kjører hvor ---------- */
function bkProviders(){ return enrichmentService.providers().map(p=>({id:p.id,name:p.label,via:PROVIDERS[p.id].meta.source||'Ingen connector',state:p.state==='not_connected'?'Ikke tilkoblet':p.detail,auto:p.autonomous})); }
const bkPending=()=>bkJobs().filter(bkActive).length;
function bkCopy(btn){ try{ navigator.clipboard.writeText(BK_CMD).then(()=>toast('Kopiert. Lim inn i Claude.'),()=>toast('Skriv «'+BK_CMD+'» i Claude.')); }catch(e){ toast('Skriv «'+BK_CMD+'» i Claude.'); } }

/* ---------- Berik-handlinger ---------- */
function bkToast(r){
  if(r.success){ const n=r.data.queued; toast(n===1?'Berik ligger i køen. Claude-økten utfører den.':n+' accounts ligger i køen. Claude-økten utfører dem.'); }
  else toast(r.error_code==='nothing_to_do'?'Ingenting å berike: allerede klare, i kø eller utelatt.':(r.error_message||'Kunne ikke starte berik.')); return r; }
async function bkBerik(ids,opt){ let r; if(ids.length===1) r=await crm.enrichment.start(ids[0],opt); else { const x=await enrichmentService.startMany(ids,opt||{}); r=x.queued?ok(x):fail('nothing_to_do','Ingenting å berike.'); } return bkToast(r); }
function bkBatchPanel(b){
  const A=bkAccsOf(b); if(!A.length) return ''; const c=bkCounts(A), todo=A.filter(a=>!a.flags.disqualified&&!a.dncAcc&&!bkActive(a.job)&&!(a.flags.enriched&&a.flags.qualified)), running=c.venter>0;
  const started=A.some(a=>a.job);
  const pct=c.total?Math.round(c.done/c.total*100):0;
  return '<section class="bk-p" data-bkp="'+esc(b.id)+'"><div class="bk-h"><div><b>'+esc(b.name)+'</b> <span>'+c.total+' accounts</span></div><div class="row bk-btns">'+
    (todo.length?'<button type="button" class="btn primary" data-bkall="'+esc(b.id)+'">Berik alle</button>'+(todo.length>5?'<button type="button" class="btn" data-bk5="'+esc(b.id)+'">Berik neste 5</button>':''):'<span class="chip ok">Hele batchen er behandlet</span>')+'</div></div>'+
    (started?'<div class="bk-run"><div class="bk-t"><b>'+(running?'Beriker '+esc(b.name):esc(b.name)+' beriket')+'</b><span>'+c.done+' / '+c.total+' ferdige</span></div><div class="bk-bar" role="img" aria-label="'+pct+' prosent ferdig"><i style="width:'+pct+'%"></i></div>'+
      '<p class="bk-c"><span class="ok">✓ '+c.klar+' klare</span><span>• '+c.venter+' venter</span>'+(c.vurdering?'<span class="warn">! '+c.vurdering+' trenger vurdering</span>':'')+(c.ingen?'<span class="bad">× '+c.ingen+' fant ingen relevant kontakt</span>':'')+(c.grunnlag?'<span class="bad">× '+c.grunnlag+' mangler researchgrunnlag</span>':'')+(c.feil?'<span class="bad">× '+c.feil+' feilet</span>':'')+(c.ikke?'<span>'+c.ikke+' ikke startet</span>':'')+'</p></div>':'')+
    (running?'<p class="bk-n"><b>Kjøres av Claude-økten, ikke autonomt.</b> Si «'+BK_CMD+'» i Claude. Du kan forlate siden; status oppdateres her. <button type="button" class="lnk" data-bkcopy="1">Kopier kommando</button></p>':'')+'</section>'; }
function bkPanels(){ const B=mtBuild().batches.filter(b=>b.status==='aktiv'); return B.map(bkBatchPanel).join(''); }
function bkWirePanels(root){
  root.querySelectorAll('[data-bkall]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; bkToast(await crm.enrichment.startBatch(b.dataset.bkall)); }));
  root.querySelectorAll('[data-bk5]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; bkToast(await crm.enrichment.startBatch(b.dataset.bk5,{limit:5})); }));
  root.querySelectorAll('[data-bkcancel]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; const r=await crm.enrichment.cancelBatch(b.dataset.bkcancel); toast(r.success?(r.data.cancelled?r.data.cancelled+' ventende jobber er avbrutt.':'Ingen ventende jobber å avbryte.'):r.error_message); }));
  root.querySelectorAll('[data-bkcopy]').forEach(b=>b.addEventListener('click',()=>bkCopy(b)));
}
/* én-klikks enrichment fra lister */
async function bkOne(id){ bkToast(await crm.enrichment.start(id)); }
