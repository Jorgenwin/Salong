/* ---------- enr.js: enrichment som én handling ----------
   «Berik» starter research og kontaktsøk med en gang, direkte fra siden, via viewerens egne koblinger (mcp-capability):
   web-research (Exa) og Apollo. Ingen nøkler, ingen innlogging, ingen scraping av Cognism eller andre webapper.
   Jobbstatus lagres i databasen (mtjob) per account, så brukeren kan forlate skjermen uten å miste status.
   Resultater skrives bare når en kilde faktisk har svart. Svak data overskriver aldri bedre data. Ingenting simuleres.

   enrichmentJob   {account_id, requested_by, providers_requested[], status, started_at, completed_at, provider_results[], errors[], last_updated_at}
   providerResult  {provider, status: ok|empty|not_connected|plan_restricted|error, detail, at, count}
   EventSignal     {type, date, venue, capacity, source, sourceDate, confidence, title}   (lagres også i eldre format i enr.event_signals)
   Contact         {source, provider, sourceId, sourceUrl, verifiedAt, confidence, emailStatus, phoneStatus}

   Hva som ikke kan skje fra siden: kjøring i bakgrunnen etter at fanen er lukket (krever backend), Cognism (ingen connector),
   Apollo people search på gratisplan (sperret av Apollo), sekvens-enrollment (egen handling via Apollo). */
const ENR={busy:false,fatal:'',fatalAt:0,mine:new Set(),servers:null,probeAt:0,active:0,sel:new Set(),resumed:false,lastErr:'',stat:null};
const ENR_FATAL=['server_not_connected','needs_reauth','not_in_manifest','blocked_by_policy','approval_required','consent_required','not_granted','capability_disabled','capability_removed','server_not_found','selection_required'];
const ENR_CONC=2;
const ENR_PROV_LABEL={web:'Web-research',apollo:'Apollo',cognism:'Cognism',manual:'Manuelt'};
const ENR_MON={januar:1,jan:1,februar:2,feb:2,mars:3,mar:3,april:4,apr:4,mai:5,juni:6,jun:6,juli:7,jul:7,august:8,aug:8,september:9,sep:9,sept:9,oktober:10,okt:10,november:11,nov:11,desember:12,des:12,
  january:1,february:2,march:3,may:5,june:6,july:7,october:10,oct:10,december:12,dec:12};
const ENR_MONRE='januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|january|february|march|may|june|july|october|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|okt|oct|nov|des|dec';
const ENR_EVWORD=/konferanse|conference|seminar|arrangement|event|fagdag|fagkonferanse|lansering|launch|årsmøte|webinar|summit|workshop|kurs|frokost|debatt|panel|forum|meetup|mingle|utdeling|festival|samling|dialogmøte|medlemsmøte|kickoff|kick-off|[a-zæøå]{3,}dagen\b|temadag|messe\b|frokostmøte|lunsjmøte|åpent møte/i;
const ENR_EVURL=/arrangement|event|kalender|calendar|program|konferanse|conference|seminar|fagdag|webinar|kurs|aktivitet|moter|møter/i;
const ENR_TYPES=[['fagdag',/fagdag/i],['konferanse',/konferanse|conference|summit|kongress/i],['lansering',/lansering|launch/i],['årsmøte',/årsmøte|generalforsamling/i],['webinar',/webinar/i],['workshop',/workshop|kurs/i],['debatt',/debatt|panel/i],['frokostseminar',/frokost/i],['seminar',/seminar/i],['mingle',/mingle|meetup|nettverk/i]];

/* ---------- koblinger ---------- */
async function enrServers(force){
  if(ENR.servers&&!force) return ENR.servers;
  if(!mcp||typeof mcp.listTools!=='function') throw {code:'capability_disabled',message:'Koblinger er ikke tilgjengelige på denne siden.'};
  const r=await mcp.listTools(), m={}; for(const s of (r&&r.servers||[])) for(const t of (s.tools||[])) if(!m[t.name]) m[t.name]=s.server;
  ENR.servers=m; ENR.probeAt=Date.now(); return m; }
async function enrCall(tool,input){
  const m=await enrServers(); const server=m[tool];
  if(!server){ ENR.servers=null; throw {code:'server_not_connected',message:'Ingen kobling er tilgjengelig for '+tool+'.'}; }
  const r=await mcp.callTool(server,tool,input); return r||{}; }
const enrText=r=>{ const p=r&&r.payload; if(typeof p==='string') return p; if(r&&Array.isArray(r.content)) return r.content.filter(c=>c&&c.type==='text').map(c=>c.text).join('\n'); return typeof p==='object'&&p?JSON.stringify(p):''; };
const enrFatalErr=e=>!!e&&ENR_FATAL.includes(e.code);
async function enrProbe(){
  const out={web:false,apollo:false,sample:!!sample,mcp:!!mcp,servers:[]};
  try{ const m=await enrServers(true); out.web=!!m.web_search_exa; out.apollo=!!m.apollo_organizations_lookup; out.servers=[...new Set(Object.values(m))]; }catch(e){ out.err=(e&&e.code)||'error'; }
  ENR.stat=out; enrRegister(out); return out; }
function enrRegister(st){
  st=st||ENR.stat||{};
  if(st.web) researchProvider.register({enrichCompany:enrWebCompany,searchPeople:enrWebPeople});
  if(st.apollo) apolloProvider.register({searchCompany:enrApolloCompany,searchPeople:enrApolloPeople,enrichPerson:enrApolloEmail}); }

/* ---------- web-research (Exa) ---------- */
function enrParseExa(t){
  return String(t||'').split(/\n-{3,}\n/).map(b=>{ const g=k=>{ const m=b.match(new RegExp('(?:^|\\n)'+k+':\\s*(.*)')); return m?m[1].trim():''; };
    const hi=b.split(/Highlights:\s*/)[1]||''; return {title:g('Title'),url:g('URL'),published:g('Published'),text:(hi||b).trim()}; }).filter(x=>x.url); }
const enrHost=u=>{ try{ return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); }catch(e){ return ''; } };
const enrOwn=(u,dom)=>{ const h=enrHost(u), d=String(dom||'').replace(/^www\./,'').toLowerCase(); return !!h&&!!d&&(h===d||h.endsWith('.'+d)); };
async function enrExa(query,objective,n){ const r=await enrCall('web_search_exa',{query,objective,numResults:n||6}); return enrParseExa(enrText(r)); }
function enrDates(text){
  const out=[], re1=new RegExp('(\\d{1,2})\\.?\\s+('+ENR_MONRE+')\\.?\\s+(20\\d\\d)','gi'), re2=new RegExp('('+ENR_MONRE+')\\.?\\s+(\\d{1,2}),?\\s+(20\\d\\d)','gi'), re3=/\b(20\d\d)-(\d\d)-(\d\d)\b/g; let m;
  const push=(y,mo,d,i,len)=>{ if(mo<1||mo>12||d<1||d>31) return; out.push({date:y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),i,len}); };
  while((m=re1.exec(text))) push(+m[3],ENR_MON[m[2].toLowerCase()],+m[1],m.index,m[0].length);
  while((m=re2.exec(text))) push(+m[3],ENR_MON[m[1].toLowerCase()],+m[2],m.index,m[0].length);
  while((m=re3.exec(text))) push(+m[1],+m[2],+m[3],m.index,m[0].length);
  return out; }
function enrVenue(after){
  const lines=String(after||'').split(/\n/).map(s=>s.trim()).filter(Boolean).slice(0,5);
  for(const l of lines){ if(/^(språk|language|pris|price|påmelding|register|meld deg)/i.test(l)) continue; if(/^[A-ZÆØÅ][^.!?]{3,70},\s*[A-ZÆØÅ0-9]/.test(l)&&!/\d{1,2}[:.]\d{2}/.test(l)) return l.replace(/\s+/g,' ').slice(0,90); }
  return ''; }
function enrEvents(a,results){
  const out=[], nameN=mtNorm(a.name), seen=new Set();
  for(const r of results){
    const own=enrOwn(r.url,a.domain), txt=r.text||'', txtN=mtNorm(txt+' '+r.title);
    if(!own&&!(nameN&&txtN.includes(nameN))) continue;
    for(const d of enrDates(txt)){
      const ctx=txt.slice(Math.max(0,d.i-160),d.i+d.len+220), evw=ENR_EVWORD.test(ctx)||ENR_EVWORD.test(r.title);
      const tm=ctx.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/), evurl=ENR_EVURL.test(r.url)||ENR_EVWORD.test(r.title);
      if(!evw||!(tm||evurl)) continue;
      const key=d.date+'|'+mtNorm(r.title).slice(0,40); if(seen.has(key)) continue; seen.add(key);
      const type=(ENR_TYPES.find(t=>t[1].test(r.title+' '+ctx))||['arrangement'])[0];
      const att=ctx.match(/(\d{2,4})\s*(?:deltakere|deltagere|participants|attendees|gjester|besøkende)/i);
      const venue=enrVenue(txt.slice(d.i+d.len,d.i+d.len+260));
      out.push({title:(r.title||'').slice(0,140),type,date:d.date,time:tm?tm[1].padStart(2,'0')+':'+tm[2]+'–'+tm[3].padStart(2,'0')+':'+tm[4]:'',venue,capacity:att?+att[1]:null,
        source:r.url,sourceDate:r.published?String(r.published).slice(0,10):iso(new Date()).slice(0,10),confidence:own?'high':'medium',level:own?'Dokumentert':'Indikasjon'}); } }
  return out; }
const enrToLegacy=e=>({event_name:e.title,event_type:e.type,level:e.level,date:e.date,recurrence:'',venue:e.venue||'',source_url:e.source,source_date:e.sourceDate,
  title:e.title,type:e.type,time:e.time||'',capacity:e.capacity,source:e.source,sourceDate:e.sourceDate,confidence:e.confidence});
async function enrWebCompany(args){
  const a=args.a, dom=a.domain||enrHost(a.website||''); const q=a.name+(dom?' ('+dom+')':'');
  const [up,past]=await Promise.all([
    enrExa(q+' kommende arrangementer konferanse seminar fagdag program 2026 2027','Finn datofestede arrangementer organisasjonen selv arrangerer. Ta med dato, tidspunkt, sted og antall deltakere hvis oppgitt.',6).catch(e=>{ if(enrFatalErr(e)) throw e; return null; }),
    enrExa(q+' tidligere arrangement årskonferanse fagdag sted lokale','Finn tidligere arrangementer organisasjonen har holdt: dato, sted/venue og antall deltakere hvis oppgitt.',5).catch(e=>{ if(enrFatalErr(e)) throw e; return null; })]);
  if(up===null&&past===null) throw {code:'upstream_error',message:'Søket ga ikke svar.'};
  const results=[...(up||[]),...(past||[])]; return {events:enrEvents(a,results),results,count:results.length}; }
async function enrWebPeople(args){
  const a=args.a, dom=a.domain||enrHost(a.website||''), roles=args.roles||[];
  if(!dom) return {people:[],note:'Mangler domene.'};
  const res=(await enrExa(a.name+' ('+dom+') ansatte team kontakt kommunikasjon markedsføring arrangement',
    'Finn sider på organisasjonens eget nettsted som oppgir ansatte med navn og stilling, særlig innen '+roles.slice(0,4).join(', ')+'.',8)).filter(r=>enrOwn(r.url,dom));
  if(!res.length) return {people:[],note:'Fant ingen sider på organisasjonens eget nettsted.',count:0};
  if(!sample||typeof sample.json!=='function') throw {code:'capability_disabled',message:'Kontaktuttrekk er ikke tilgjengelig.'};
  const corpus=res.slice(0,6).map((r,i)=>'['+i+'] '+r.url+'\n'+r.text.slice(0,1800)).join('\n\n');
  const j=await sample.json('Du leser utdrag fra organisasjonens eget nettsted. Finn personer som står oppgitt med fullt navn OG stilling hos «'+a.name+'», og som har en av disse rollene (eller en tydelig tilsvarende): '+roles.join(', ')+
    '. Ikke gjett og ikke utled. Svar kun med JSON: {"people":[{"name":"","title":"","email":null,"src":0,"quote":""}]}. «quote» skal være et ORDRETT utdrag fra teksten som inneholder både navn og stilling. «email» bare hvis adressen står ordrett i teksten, ellers null. «src» er nummeret i hakeparentes. Tom liste hvis ingen finnes.\n\n'+corpus,{modelTier:'quick',cache:false});
  const norm=s=>String(s||'').replace(/\s+/g,' ').toLowerCase(), out=[];
  for(const p of ((j&&j.people)||[]).slice(0,6)){
    const r=res[+p.src]; if(!r||!p.name||!p.title||!p.quote) continue; const T=norm(r.text), q=norm(p.quote);
    if(!T.includes(q)||!q.includes(norm(p.name))||!q.includes(norm(p.title))) continue;
    const em=p.email&&T.includes(String(p.email).toLowerCase())?String(p.email).toLowerCase():'';
    out.push({name:String(p.name).trim(),title:String(p.title).trim(),email:em,url:r.url,quote:String(p.quote).slice(0,200)}); }
  return {people:out,count:out.length,pages:res.length}; }

/* ---------- Apollo ---------- */
async function enrApolloCompany(args){
  const a=args.a, dom=a.domain||enrHost(a.website||''); if(!dom) return {matched:false,note:'Mangler domene.'};
  const r=await enrCall('apollo_organizations_lookup',{q_organization_fuzzy_name:dom,display_mode:'fuzzy_select_mode',per_page:3});
  const L=(r.payload&&r.payload.organizations)||[], hit=L.find(o=>String(o.domain||enrHost(o.website_url||'')).toLowerCase().replace(/^www\./,'')===dom.toLowerCase());
  return hit?{matched:true,id:hit.id,name:hit.name||''}:{matched:false}; }
async function enrApolloPeople(args){
  const a=args.a, dom=a.domain||enrHost(a.website||''), roles=args.roles||[]; if(!dom) return {people:[]};
  let r; try{ r=await enrCall('apollo_mixed_people_api_search',{q_organization_domains_list:[dom],person_titles:roles.slice(0,6),per_page:5}); }
  catch(e){ if(e&&e.code==='tool_error'&&/API_INACCESSIBLE|upgrade|plan/i.test(String(e.message||''))) throw {code:'plan_restricted',message:'Apollo-planen gir ikke tilgang til personsøk.'}; throw e; }
  const P=(r.payload&&(r.payload.people||r.payload.contacts))||[], out=[];
  for(const p of P.slice(0,5)){ const name=[p.first_name,p.last_name_obfuscated||p.last_name].filter(Boolean).join(' ')||p.name||''; if(!name||!p.title) continue;
    out.push({name,title:p.title,email:'',apolloId:p.id||'',url:p.linkedin_url||''}); }
  return {people:out,count:out.length}; }
/* e-post koster kreditter hos Apollo: egen, eksplisitt handling per person, aldri i bulk og aldri automatisk */
async function enrApolloEmail(args){
  const p=args.p, a=args.a; const inp={reveal_personal_emails:false,reveal_phone_number:false};
  if(p.sourceId&&/^[a-f0-9]{24}$/.test(p.sourceId)) inp.id=p.sourceId; else { inp.name=p.name; inp.organization_name=a.name; if(a.domain) inp.domain=a.domain; }
  const r=await enrCall('apollo_people_match',inp), pe=(r.payload&&(r.payload.person||r.payload))||{};
  return {email:pe.email||'',emailStatus:pe.email_status||'',linkedin:pe.linkedin_url||'',id:pe.id||'',credits:r.payload&&r.payload.mcp_credits||null}; }
async function enrFetchEmail(pid){
  const p=S.mtper[pid]; if(!p) return fail('not_found','Kontakten finnes ikke.'); const a=mtGet(p.accId); if(!a) return fail('not_found','Accounten finnes ikke.');
  await enrProbe(); const r=await apolloProvider.call('enrichPerson',{p:{...p,id:pid},a});
  if(!r.success) return r; const d=r.data||{};
  if(!d.email) return fail('empty','Apollo fant ingen e-postadresse.');
  const verified=/^verified$/i.test(d.emailStatus);
  await mtSetPerson(pid,{email:d.email.toLowerCase(),emailStatus:verified?'verifisert':'usikker',verifiedAt:verified?iso(new Date()):(p.verifiedAt||''),linkedin:p.linkedin||d.linkedin||'',sourceId:p.sourceId||d.id||'',provider:p.provider||'apollo',enrichedAt:iso(new Date()),
    source:p.source==='Web'?'Web':'Apollo'}); await mtPatch(p.accId,{},'E-post hentet fra Apollo for '+p.name); return ok(d); }

/* ---------- kontakter: dedupe og flett, aldri overskriv bedre data ---------- */
async function enrAddPerson(a,c,meta){
  const nm=mtNorm(c.name), em=String(c.email||'').toLowerCase(), cur=(mtGet(a.id)||a).persons||[];
  const dup=cur.find(p=>(em&&p.email&&p.email.toLowerCase()===em)||(c.sourceId&&p.sourceId&&p.sourceId===c.sourceId)||(nm&&mtNorm(p.name)===nm));
  if(dup){ const patch={}; for(const k of ['title','email','phone','linkedin']) if(!dup[k]&&c[k]) patch[k]=c[k]; if(!dup.sourceUrl&&c.url) patch.sourceUrl=c.url;
    if(Object.keys(patch).length&&S.mtper[dup.id]) await mtSetPerson(dup.id,patch); return {id:dup.id,dup:true,merged:Object.keys(patch).length>0}; }
  const r=await mtAddPerson(a.id,{name:c.name,title:c.title,email:em,source:meta.source,verifiedAt:'',emailStatus:'',phoneStatus:'',quality:''});
  if(r.err) return {dup:true,err:r.err};
  await mtSetPerson(r.id,{provider:meta.provider,sourceUrl:c.url||'',sourceId:c.apolloId||'',confidence:meta.confidence,foundAt:iso(new Date()),quote:c.quote||'',rel:'?'});
  return {id:r.id,dup:false}; }

/* ---------- enrichment-jobb ---------- */
function enrMerge(old,evs,roomPick){
  const have=(old&&old.event_signals)||[], key=e=>(e.date||'')+'|'+mtNorm(e.event_name||e.title||'').slice(0,40), seen=new Set(have.map(key)), add=evs.map(enrToLegacy).filter(e=>!seen.has(key(e)));
  const o={...(old||{}),event_signals:have.concat(add)};
  if(roomPick&&!o.room_fit){ o.room_fit=roomPick.fit; o.room_fit_reason=roomPick.reason; }
  return {enr:o,added:add.length}; }
function enrRoom(evs){
  const e=evs.filter(x=>x.capacity).sort((x,y)=>y.capacity-x.capacity)[0]; if(!e) return null;
  const fit=e.capacity>=200?'Solstad':e.capacity>=100?'Collett':'Berner-salongen';
  return {fit,reason:'Kilden oppgir '+e.capacity+' deltakere på «'+e.title.slice(0,70)+'» ('+enrHost(e.source)+'). Romvalg er avledet av dette tallet.'}; }
async function enrRunJob(id){
  const j0=S.mtjob[id]; if(!j0||j0.status!=='queued') return;
  const stamp=()=>iso(new Date()), upd=p=>enrichmentJobRepository.update(id,{...p,last_updated_at:stamp()});
  const a=mtGet(j0.accId); if(!a){ await upd({status:'error',error:'Accounten finnes ikke.',completed_at:stamp()}); return; }
  const PR=[], ER=[], plan=j0.plan||{}, needs=plan.needs&&plan.needs.length?plan.needs:['research','person_enrichment'], roles=(j0.role_targets&&j0.role_targets.length?j0.role_targets:bkRolesFor(a));
  const note=(provider,status,detail,count)=>PR.push({provider,status,detail:detail||'',at:stamp(),count:count==null?null:count});
  await upd({status:'running',started_at:stamp(),executor:'page',blocked:'',provider_results:[],errors:[],providers:{},claimed_by:me.id||me.name||''});
  const hb=setInterval(()=>{ const j=S.mtjob[id]; if(j&&j.status==='running') enrichmentJobRepository.update(id,{last_updated_at:stamp()}); },20000);
  let events=[], found=0, people=[], fatal=null, webOk=false, summary=[];
  const step=async(provider,fn)=>{ try{ return await fn(); }catch(e){ const code=(e&&e.code)||'error'; if(enrFatalErr(e)){ fatal=e; return undefined; }
      note(provider,code==='plan_restricted'?'plan_restricted':'error',(e&&e.message)||code); ER.push({provider,code,message:(e&&e.message)||''}); return undefined; } };
  try{
    if(!researchProvider.isConnected()&&!apolloProvider.isConnected()) await enrProbe();
    /* 1. website/open-web: eventhistorikk, kommende signaler, venues */
    if(needs.includes('research')&&!fatal){
      const r=await step('web',async()=>{ const x=await researchProvider.call('enrichCompany',{a}); if(!x.success){ if(x.error_code==='not_connected') throw {code:'server_not_connected',message:x.error_message}; throw {code:x.error_code,message:x.error_message}; } return x.data; });
      if(r){ webOk=true; events=r.events; note('web',events.length||r.count?'ok':'empty',events.length?events.length+' eventsignaler funnet i '+r.count+' kilder':'Fant ingen datofestede arrangementer i '+r.count+' kilder',events.length); summary.push(events.length+' eventsignal'+(events.length===1?'':'er')); } }
    if(fatal) throw fatal;
    /* 2. Apollo: firmografi (gratis oppslag) */
    if(needs.includes('person_enrichment')&&apolloProvider.isConnected()){
      const r=await step('apollo',async()=>{ const x=await apolloProvider.call('searchCompany',{a}); if(!x.success) throw {code:x.error_code,message:x.error_message}; return x.data; });
      if(r) note('apollo',r.matched?'ok':'empty',r.matched?'Selskapet funnet i Apollo':'Fant ikke selskapet i Apollo',r.matched?1:0); }
    if(fatal) throw fatal;
    /* 3. kontaktmål: eget nettsted først, deretter Apollo. Cognism er ikke koblet fra siden. */
    if(needs.includes('person_enrichment')){
      const have=(mtGet(a.id).persons||[]).filter(p=>!p.dnc&&p.rel!=='nei').length;
      if(have<2){
        const r=await step('web',async()=>{ const x=await researchProvider.call('searchPeople',{a,roles}); if(!x.success){ if(x.error_code==='not_connected') throw {code:'server_not_connected',message:x.error_message}; throw {code:x.error_code,message:x.error_message}; } return x.data; });
        if(r){ people=r.people||[]; let n=0; for(const c of people.slice(0,3)){ const x=await enrAddPerson(a,c,{source:'Web',provider:'web',confidence:'medium'}); if(x&&x.id&&!x.dup) n++; }
          found+=n; note('web',people.length?'ok':'empty',people.length?people.length+' kandidat'+(people.length===1?'':'er')+' med kilde på eget nettsted ('+n+' nye)':(r.note||'Fant ingen oppgitte personer med relevant rolle'),n); }
        if(fatal) throw fatal;
        if(apolloProvider.isConnected()){
          const r2=await step('apollo',async()=>{ const x=await apolloProvider.call('searchPeople',{a,roles}); if(!x.success) throw {code:x.error_code,message:x.error_message}; return x.data; });
          if(r2){ let n=0; for(const c of r2.people||[]){ const x=await enrAddPerson(a,c,{source:'Apollo',provider:'apollo',confidence:'medium'}); if(x&&x.id&&!x.dup) n++; } found+=n; note('apollo',n?'ok':'empty',n+' nye kandidater',n); } }
      } else note('web','empty','Har allerede '+have+' kontakter. Ingen nye søkt.',0);
      note('cognism','not_connected','Ekstra kilde tilgjengelig via Claude',0); }
    if(fatal) throw fatal;
    /* 4. lagre research på accounten (flett, aldri overskriv) */
    if(events.length){ const m=enrMerge((mtGet(a.id).doc||{}).enr||a.enr,events,enrRoom(events)); await mtPatch(a.id,{enr:{...m.enr,enriched_at:stamp(),result_version:(((mtGet(a.id).doc||{}).enr||{}).result_version||0)+1,source:'page'}},'Research: '+m.added+' nye eventsignaler'); }
    const fresh=mtGet(a.id), keep=(fresh.persons||[]).filter(p=>!p.dnc&&p.rel!=='nei');
    const ready=fresh.flags.enriched&&fresh.flags.qualified;
    let outcome=ready?'klar':keep.length?'vurdering':(webOk||PR.some(p=>p.status==='ok'||p.status==='empty'))?(events.length||((fresh.ev||{}).level!=='Unknown')?'ingen_kontakt':'mangler_grunnlag'):'mangler_grunnlag';
    const allErr=!PR.some(p=>p.status==='ok'||p.status==='empty')&&ER.length;
    const provObj={}; for(const p of PR) provObj[p.provider]=p.status==='ok'||p.status==='empty'?'ok':p.status;
    await upd({status:allErr?'error':'done',outcome:allErr?'':outcome,completed_at:stamp(),provider_results:PR,errors:ER,providers:provObj,contacts_found:found,events_found:events.length,
      error:allErr?(ER[0].message||'Ingen kilde svarte'):'',note:summary.join(', '),result_version:(j0.result_version||0)+1});
    if(!allErr) bus.emit('account_enriched',{account_id:a.id,job_id:id,outcome});
  }catch(e){
    const code=(e&&e.code)||'error';
    if(enrFatalErr(e)){ ENR.fatal=code; ENR.fatalAt=Date.now(); ENR.servers=null;
      await upd({status:'queued',blocked:code,provider_results:PR,errors:[{provider:'connector',code,message:(e&&e.message)||''}],note:''}); }
    else await upd({status:'error',completed_at:stamp(),provider_results:PR,errors:ER.concat([{provider:'engine',code,message:(e&&e.message)||''}]),error:(e&&e.message)||code}); }
  finally{ clearInterval(hb); } }

/* ---------- kø: sekvensielt, to om gangen ---------- */
async function enrDrain(){
  const next=()=>bkJobs().filter(j=>(j.kind||'enrich')==='enrich'&&j.status==='queued'&&ENR.mine.has(j.id)&&!ENR.running.has(j.id)).sort((x,y)=>String(x.requested_at).localeCompare(String(y.requested_at)))[0];
  const worker=async()=>{ for(;;){ if(ENR.fatal) return; const j=next(); if(!j) return; ENR.running.add(j.id); try{ await enrRunJob(j.id); }finally{ ENR.running.delete(j.id); enrChip(); if(UI.view==='prosp') renderView(true); } } };
  await Promise.all(Array.from({length:ENR_CONC},worker)); }
ENR.running=new Set();
async function enrKick(ids,opt){
  opt=opt||{}; if(opt.retry){ ENR.fatal=''; ENR.servers=null; }
  for(const id of ids||[]) ENR.mine.add(id);
  if(!ENR.fatal&&!ENR.stat&&mcp) await enrProbe().catch(()=>{});
  if(ENR.busy) return; ENR.busy=true; enrChip();
  try{ await enrDrain(); }finally{ ENR.busy=false; enrChip(); if(ENR.fatal) toast(enrFatalText()); } }
function enrFatalText(){ const c=ENR.fatal; return c==='needs_reauth'?'En kobling må logges inn på nytt i claude.ai (Innstillinger → Koblinger). Berik fortsetter etterpå.':c==='server_not_connected'||c==='not_in_manifest'||c==='server_not_found'?'Berik trenger Apollo eller web-søk koblet til i claude.ai. Statusen er lagret.':c==='consent_required'||c==='not_granted'||c==='approval_required'?'Berik trenger at du godkjenner koblingen når siden spør.':'Berik kunne ikke kjøres herfra akkurat nå. Statusen er lagret.'; }
async function enrRetry(){ ENR.fatal=''; const ids=bkJobs().filter(j=>(j.kind||'enrich')==='enrich'&&j.status==='queued'&&j.executor==='page').map(j=>j.id); toast(ids.length?'Prøver igjen.':'Ingenting å prøve på nytt.'); if(ids.length) await enrKick(ids,{retry:true}); }
/* gjenoppta egne jobber etter reload: ferske kjører videre, stoppede settes tilbake i køen */
function enrResume(){
  if(ENR.resumed||!db||!S.mtjob) return; ENR.resumed=true; const me_=me.name||'', ids=[], now=Date.now();
  for(const j of bkJobs()){ if((j.kind||'enrich')!=='enrich'||j.executor!=='page'||(j.requested_by||'')!==me_) continue;
    if(j.status==='running'){ const age=now-Date.parse(j.last_updated_at||j.started_at||0); if(age>60000){ enrichmentJobRepository.update(j.id,{status:'queued',blocked:'',note:'Gjenopptatt etter avbrudd'}); ids.push(j.id); } }
    else if(j.status==='queued'&&!j.blocked) ids.push(j.id); }
  if(ids.length&&mcp) setTimeout(()=>enrKick(ids),1200); }
setInterval(()=>{ try{ enrResume(); }catch(e){} },3000);

/* spesifikasjonen sendes med executor «page». Selve kjøringen starter rett etter køing. */
const _enrSub=prototypeEnrichmentRunner.submit;
prototypeEnrichmentRunner.submit=function(spec){ return _enrSub.call(prototypeEnrichmentRunner,{executor:'page',provider:'page',providers_requested:['web','apollo','cognism'],provider_results:[],errors:[],last_updated_at:iso(new Date()),...spec}); };
prototypeEnrichmentRunner.executor='page'; prototypeEnrichmentRunner.autonomous=false;
const _enrSM=enrichmentService.startMany;
enrichmentService.startMany=async function(ids,opt){ const r=await _enrSM.call(enrichmentService,ids,opt); if(r.job_ids.length){ ENR.fatal=''; enrKick(r.job_ids); } return r; };

/* ---------- status: neutral språkbruk i hovedgrensesnittet ---------- */
function bkNextText(a){ const s=bkState(a.job); return s==='venter'?'Beriker':(s==='vurdering'||s==='klar')?'Kontroller kontaktvalg':s==='ingen_kontakt'?'Ingen relevant kontakt funnet':s==='mangler_grunnlag'?'Mangler grunnlag. Berik på nytt':s==='feil'?'Berik feilet. Prøv igjen':'Finn kontaktperson'; }
function bkToast(r){
  if(r.success){ const n=r.data.queued; toast(n===1?'Beriker …':'Beriker '+n+' accounts …'); }
  else toast(r.error_code==='nothing_to_do'?'Ingenting å berike: allerede klare, pågår eller utelatt.':(r.error_message||'Kunne ikke starte berik.')); return r; }
function bkJobLine(a){ const j=a.job, s=bkState(j); if(!j) return '';
  const pr=(j.provider_results||[]).filter(p=>p.provider!=='cognism');
  const det=pr.length?' <span class="mt-hint">'+pr.map(p=>esc(ENR_PROV_LABEL[p.provider]||p.provider)+': '+esc(p.status==='plan_restricted'?'ikke tilgjengelig på planen':p.status==='error'?'feilet':p.detail||p.status)).join(' · ')+'</span>':'';
  if(s==='venter') return '<p class="bk-jl a">'+(j.status==='running'?'Beriker nå …':j.blocked?'Berik kunne ikke starte fordi en kobling mangler. <button type="button" class="lnk" data-enrretry="1">Prøv igjen</button>':'Berik er satt i gang.')+'</p>';
  if(s==='ingen_kontakt') return '<p class="bk-jl bad">Fant ingen relevant kontakt'+(j.note?'. '+esc(j.note):'')+'. Legg til en kontakt manuelt, eller berik på nytt senere.'+det+'</p>';
  if(s==='mangler_grunnlag') return '<p class="bk-jl bad">Grunnlaget var for tynt til å velge rolle og romfit'+(j.note?'. '+esc(j.note):'')+'.'+det+'</p>';
  if(s==='feil') return '<p class="bk-jl bad">Berik feilet'+(j.error?': '+esc(j.error):'')+'. <button type="button" class="lnk" data-bkdo="'+esc(a.id)+'">Prøv igjen</button>'+det+'</p>';
  if(s==='vurdering'||s==='klar') return '<p class="bk-jl warn">'+(j.contacts_found?j.contacts_found+' kontakt'+(j.contacts_found===1?'':'er')+' funnet. ':'')+'Kontaktene mangler e-post eller telefon, eller må kontrolleres'+(j.note?'. '+esc(j.note):'')+'. Se Kontakter.'+det+'</p>';
  return ''; }

/* ---------- fremdrift: kompakt, avledet av lagrede jobber (overlever navigasjon og reload) ---------- */
function enrProgress(accs){
  const c={total:accs.length,done:0,found:0,check:0,none:0,run:0,blocked:0,idle:0};
  for(const a of accs){ const j=a.job; if(!j||(j.kind||'enrich')!=='enrich'){ c.idle++; continue; }
    if(j.status==='queued'||j.status==='running'){ if(j.blocked) c.blocked++; else c.run++; continue; }
    c.done++; c.found+=Number(j.contacts_found)||0;
    if(j.status==='error'||j.outcome==='vurdering'||j.outcome==='mangler_grunnlag') c.check++; else if(j.outcome==='ingen_kontakt') c.none++; }
  return c; }
function bkBatchPanel(b){
  const A=bkAccsOf(b); if(!A.length) return '';
  const c=enrProgress(A), todo=A.filter(a=>!a.flags.disqualified&&!a.dncAcc&&!bkActive(a.job)&&!(a.flags.enriched&&a.flags.qualified)), sel=A.filter(a=>ENR.sel.has(a.id)&&todo.includes(a)), live=c.run>0, pct=c.total?Math.round(c.done/c.total*100):0;
  const seen=c.done||c.run||c.blocked;
  return '<section class="bk-p enr-w" data-bkp="'+esc(b.id)+'"><div class="bk-h"><div><b>'+esc(b.name)+'</b> <span>'+c.total+' accounts</span></div><div class="row bk-btns">'+
    (todo.length?'<button type="button" class="btn'+(sel.length?'':' primary')+'" data-bkall="'+esc(b.id)+'">Berik hele batchen</button>':'<span class="chip ok">Hele batchen er behandlet</span>')+
    (sel.length?'<button type="button" class="btn primary" data-enrsel="'+esc(b.id)+'">Berik valgte ('+sel.length+')</button>':'')+'</div></div>'+
    (seen?'<div class="bk-run"><div class="bk-t"><b>'+(live?'Beriker '+esc(b.name):esc(b.name))+'</b><span>'+c.done+' / '+c.total+' ferdig</span></div><div class="bk-bar" role="img" aria-label="'+pct+' prosent ferdig"><i style="width:'+pct+'%"></i></div>'+
      '<p class="bk-c"><span class="ok">Kontakter funnet '+c.found+'</span>'+(c.check?'<span class="warn">Trenger kontroll '+c.check+'</span>':'')+(c.none?'<span class="bad">Ingen kontakt funnet '+c.none+'</span>':'')+(c.run?'<span>Pågår '+c.run+'</span>':'')+(c.blocked?'<span class="bad">Ikke startet '+c.blocked+' · <button type="button" class="lnk" data-enrretry="1">Prøv igjen</button></span>':'')+'</p></div>':'')+'</section>'; }
function enrChip(){
  try{ let el=document.getElementById('enrChip'); const running=ENR.busy&&bkJobs().some(j=>(j.kind||'enrich')==='enrich'&&(j.status==='running'||(j.status==='queued'&&ENR.mine.has(j.id))));
    if(!running){ if(el) el.remove(); return; }
    const js=bkJobs().filter(j=>(j.kind||'enrich')==='enrich'&&ENR.mine.has(j.id)), done=js.filter(j=>j.status!=='queued'&&j.status!=='running').length;
    if(!el){ el=document.createElement('button'); el.id='enrChip'; el.type='button'; el.className='enr-chip'; el.addEventListener('click',()=>{ UI.view='prosp'; try{ UI.mt.tab='arb'; }catch(e){} render(); }); document.body.appendChild(el); }
    el.textContent='Beriker '+done+' / '+js.length; }catch(e){} }
const _enrRV=renderView; renderView=function(f){ _enrRV(f); enrChip(); };

/* to-trinns bekreftelse uten nettleserdialog (blokkeres i innebygde sider) */
function enrArm(b,txt){ if(b.dataset.armed){ return true; } b.dataset.armed='1'; b.dataset.was=b.textContent; b.textContent=txt; setTimeout(()=>{ if(b.isConnected&&b.dataset.armed){ delete b.dataset.armed; b.textContent=b.dataset.was; } },6000); return false; }
/* ---------- handlinger ---------- */
function enrWire(root){
  root.querySelectorAll('[data-enrretry]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); enrRetry(); }));
  root.querySelectorAll('[data-enrsel]').forEach(b=>b.addEventListener('click',async()=>{ const ids=[...ENR.sel]; b.disabled=true; const r=await bkBerik(ids,{groupId:b.dataset.enrsel}); ENR.sel.clear(); renderView(true); return r; }));
  root.querySelectorAll('[data-bksel]').forEach(c=>{ c.addEventListener('click',e=>e.stopPropagation()); c.addEventListener('change',()=>{ if(c.checked) ENR.sel.add(c.dataset.bksel); else ENR.sel.delete(c.dataset.bksel); renderView(true); }); });
  root.querySelectorAll('[data-enrmail]').forEach(b=>b.addEventListener('click',async e=>{ e.stopPropagation();
    if(!enrArm(b,'Bekreft: koster 1 kreditt')) return; b.disabled=true; const r=await enrFetchEmail(b.dataset.enrmail);
    toast(r.success?'E-post hentet. Statusen følger Apollo, ikke Salong.':(r.error_message||'Kunne ikke hente e-post.')); renderView(true); renderDrawer(true); })); }
const _enrPW=V.prosp.wire; V.prosp.wire=function(v){ _enrPW(v); enrWire(v); };

/* Cognism må kunne fjernes helt: kun data som er merket provider=cognism */
async function enrRemoveProvider(provider){ let n=0; for(const [id,p] of Object.entries(S.mtper||{})){ if((p.provider||'').toLowerCase()===provider||(p.source||'').toLowerCase()===provider){ await contactRepository.remove(id); n++; } } return n; }
const enrCountProvider=provider=>Object.values(S.mtper||{}).filter(p=>(p.provider||'').toLowerCase()===provider||(p.source||'').toLowerCase()===provider).length;

/* ---------- Teknisk status (Data og oppsett): her, ikke i hovedgrensesnittet ---------- */
function enrTechRows(){
  const st=ENR.stat, d=(v)=>v?'Direkte fra siden':'Ikke tilgjengelig akkurat nå';
  return [
    ['Web-research (Exa)',st?(st.web?'Tilkoblet':'Ikke tilkoblet'):'Ikke sjekket','B','Kjøres fra siden via viewerens kobling. Hentet innhold lagres med kilde-URL.'],
    ['Apollo',st?(st.apollo?'Tilkoblet':'Ikke tilkoblet'):'Ikke sjekket','B','Selskapsoppslag er gratis. Personsøk er sperret på Apollos gratisplan. E-post koster kreditter og hentes per person etter bekreftelse.'],
    ['Cognism','Ikke koblet','D','Ekstra kilde tilgjengelig via Claude. Ingen connector eller avtale fra siden, og Salong lagrer aldri innlogging eller cookies. Data merkes provider=cognism og kan fjernes samlet.'],
    ['Kontaktuttrekk (Claude-modell)',sample?'Tilgjengelig':'Ikke tilgjengelig','B','Leser bare utdrag fra organisasjonens eget nettsted. Hver kontakt må ha et ordrett sitat med navn og stilling.'],
    ['E-postutkast (Outlook, Gmail)',mcp?'Tilgjengelig':'Ikke tilgjengelig','B','Utkast lages, ingenting sendes.'],
    ['Masseutsendelse (e-postsekvens)',mcp?'Utkast via Gmail eller Outlook':'Ikke tilgjengelig','B','Dagens e-poster lages som utkast og sendes av deg. Automatisk utsendelse på riktig dag uten åpen fane krever en server som kjører når siden er lukket, og tillatelse til å sende. Ikke bygget.'],
    ['Kontrakt og økonomi','Ikke lest','D','Salong har ikke tilgang til kontrakten. Honorar, utbetalt og grunnlag legges inn for hånd under Prospekter, Strategi.'],
    ['Bakgrunnskjøring uten åpen fane','Ikke tilgjengelig','C','Jobbstatus er lagret og gjenopptas når siden åpnes, men selve kjøringen krever at siden er åpen. Ekte bakgrunnskjøring krever backend.'],
    ['Sekvens-enrollment i Apollo','Via Claude','C','Egen, eksplisitt handling. Krever en postkasse koblet i Apollo og backend for å kjøre direkte.']]; }
function enrTechHTML(){
  const rows=enrTechRows(), nc=enrCountProvider('cognism');
  return '<section class="mt-sec"><div class="mt-sh"><h3>Teknisk status</h3><span class="mt-hint">Hva som kjører hvor</span></div><div class="tbl"><table class="dense"><thead><tr><th>Tjeneste</th><th>Status</th><th>Klasse</th><th>Merknad</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td><b>'+esc(r[0])+'</b></td><td>'+esc(r[1])+'</td><td>'+r[2]+'</td><td>'+esc(r[3])+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="mt-note">A: virker fra siden. B: virker når viewerens koblinger er tilgjengelige. C: krever backend/API for ekte ett-klikk. D: krever tilgang eller avtale fra ekstern leverandør.</p>'+
    '<div class="row"><button type="button" class="btn sm" id="enrProbe">Sjekk tilkoblinger</button>'+(nc?'<button type="button" class="btn ghost sm" id="enrRmCog">Fjern Cognism-data ('+nc+')</button>':'')+'</div></section>'; }
function enrTechWire(v){
  v.querySelector('#enrProbe')?.addEventListener('click',async()=>{ const r=await enrProbe(); toast(r.err?'Koblinger er ikke tilgjengelige herfra ('+r.err+').':'Sjekket.'); renderView(true); });
  v.querySelector('#enrRmCog')?.addEventListener('click',async()=>{ if(!enrArm(v.querySelector('#enrRmCog'),'Bekreft fjerning')) return; const n=await enrRemoveProvider('cognism'); toast(n+' kontakter fjernet.'); renderView(true); }); }
/* Sekvenser: bare nøytrale kildebrikker. Teknisk forklaring ligger under Data og oppsett → Teknisk status. */
function mtApolloBox(){
  const st=ENR.stat; const chip=(n,on,t)=>'<li><b>'+esc(n)+'</b><em class="'+(on?'ok':'off')+'">'+esc(t)+'</em></li>';
  return '<section class="mt-sec bk-eng"><div class="mt-sh"><h3>Kilder</h3></div><ul class="bk-pv">'+chip('Web-research',!!(st&&st.web),st?(st.web?'Tilgjengelig':'Ikke tilkoblet'):'Sjekkes ved første berik')+chip('Apollo',!!(st&&st.apollo),st?(st.apollo?'Tilgjengelig':'Ikke tilkoblet'):'Sjekkes ved første berik')+chip('Cognism',false,'Ekstra kilde tilgjengelig via Claude')+'</ul></section>'; }
