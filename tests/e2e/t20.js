// Runde 20: tjenestelaget (SalongServices), EnrichmentJob-modellen og Apollo-adapteren. Mocket Exa/Apollo, oppdiktede testdata.
// Kjør: node tests/e2e/t20.js (etter npm run build)
const {navTo,setup,testSeed,ROOT} = require('./h.js'); const fs=require('fs'), path=require('path');
(async()=>{
  const A=await setup({ai:true,mcp:true,seed:testSeed()}), {p,check}=A;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await navTo(p,'prosp',300);
    await ev(()=>{
      const pg=(dom,path,title,body)=>'Title: '+title+'\nURL: https://'+dom+path+'\nHighlights: '+body+'\n---\n';
      const FX={'svc-test.no':{team:pg('svc-test.no','/om-oss/ansatte','Ansatte','Silje Salgsen, Markedssjef\nRune Haugen, Publisist'),
        events:pg('svc-test.no','/arrangement/fagdag','Fagdag 2026','Fagdag 2026\n14 oktober 2026 09:30 - 14:50\nSentralen, Øvre Slottsgate 3\n110 deltakere')}};
      window.__mcpFn=async(s,t,i)=>{
        const q=String(i.query||i.q_organization_fuzzy_name||(i.q_organization_domains_list||[])[0]||''), f=FX['svc-test.no'];
        if(t==='web_search_exa'){ if(/category:people/.test(q)) return {payload:''}; if(/site:/.test(q)) return {payload:Object.values(f).join('')}; return {payload:f.events}; }
        if(t==='apollo_organizations_lookup') return {payload:{organizations:[{id:'a'.repeat(24),name:'Svc AS',domain:'svc-test.no'}]}};
        if(t==='apollo_mixed_people_api_search') throw {code:'tool_error',message:'API_INACCESSIBLE: upgrade required'};
        throw {code:'tool_error',message:'uventet '+t}; }; });
    check('S01 SalongServices har accounts, contacts, enrichment, opportunities og calendar',await ev(()=>Object.keys(window.SalongServices).filter(k=>typeof window.SalongServices[k]==='object'&&k!=='providers').sort()),v=>JSON.stringify(v)==='["accounts","calendar","contacts","enrichment","opportunities"]');
    const id=await ev(async()=>{ const r=await window.__salong.crm.accounts.create({name:'[TEST] Svc AS',website:'https://svc-test.no',segId:'forlag',place:'Oslo'}); return r.data.id; });
    check('S02 getAccount gir ren domenemodell, og null for ukjent id',await ev(async i=>{ const S=window.SalongServices.accounts; const a=await S.getAccount(i); return [a&&a.id===i,a&&a.name,await S.getAccount('finnes-ikke')]; },id),v=>v[0]&&/Svc AS/.test(v[1])&&v[2]===null);
    check('S03 getProspects returnerer accounts uten å eksponere interne dokumenter',await ev(async i=>{ const L=await window.SalongServices.accounts.getProspects(); return [Array.isArray(L),L.some(a=>a.id===i),Object.keys(L[0]||{}).includes('doc')]; },id),v=>v[0]&&v[1]&&!v[2]);
    const r=await ev(i=>window.SalongServices.enrichment.enrichAccount(i,{force:true}),id);
    check('S04 enrichAccount legger jobben i køen og gir jobbid',r,v=>v.success&&!!v.data.jobId);
    const job=await ev(async([i,j])=>{ for(let k=0;k<60;k++){ const x=await window.SalongServices.enrichment.getJob(j); if(x&&!['queued','running'].includes(x.status)) return x; await new Promise(r=>setTimeout(r,200)); } return window.SalongServices.enrichment.getJob(j); },[id,r.data.jobId]);
    check('S05 EnrichmentJob har modellen id, accountId, status, startedAt, completedAt, sourceStatuses, error, result',job,v=>['id','accountId','status','startedAt','completedAt','sourceStatuses','error','result'].every(k=>k in v)&&v.accountId===id&&['queued','running','needs_review','completed','partial','failed'].includes(v.status));
    check('S06 result har organization, eventSignals, contactCandidates, contactData og recommendation',job.result,v=>v&&v.organization&&v.organization.name&&Array.isArray(v.eventSignals)&&Array.isArray(v.contactCandidates)&&Array.isArray(v.contactData)&&v.recommendation&&'whyNow' in v.recommendation&&'recommendedUseCase' in v.recommendation&&'recommendedRoom' in v.recommendation);
    check('S07 eventsignal fra research er med (dato og sted), ikke funnet på',job.result.eventSignals,v=>v.length>=1&&v.some(s=>/Fagdag/.test(s.event)&&s.date==='2026-10-14'&&/Sentralen/.test(s.venue||'')));
    check('S08 sourceStatuses sier ærlig at Apollo-personsøk er sperret av planen',job.sourceStatuses,v=>v.web&&v.apollo&&['plan_restricted','empty','blocked','error','ok'].includes(v.apollo));
    check('S09 getContacts og getLatestJob virker',await ev(async i=>{ const c=await window.SalongServices.contacts.getContacts(i), j=await window.SalongServices.enrichment.getLatestJob(i); return [Array.isArray(c),j&&j.accountId===i]; },id),v=>v[0]&&v[1]);
    // Apollo-adapter: nøytrale former, og transporten kan byttes (backend senere)
    const ad=await ev(async()=>{ const AP=window.SalongServices.providers.apollo, calls=[];
      AP.setTransport({call:async(t,i)=>{ calls.push(t); if(t==='apollo_organizations_lookup') return {payload:{organizations:[{id:'b'.repeat(24),name:'Ekstern AS',domain:'ekstern-test.no'}]}};
        if(t==='apollo_mixed_people_api_search') return {payload:{people:[{id:'p9',first_name:'Pia',last_name:'Testesen',title:'Head of Marketing',country:'Norway',city:'Oslo'}]}};
        if(t==='apollo_people_match') return {payload:{person:{id:'p9',email:'pia@ekstern-test.no',email_status:'verified',linkedin_url:'https://linkedin.example/pia'},mcp_credits:{used:1}}}; return {payload:{}}; }});
      const o=await AP.findOrganization({name:'Ekstern',domain:'ekstern-test.no'}), pe=await AP.searchPeople({domain:'ekstern-test.no',titles:['Head of Marketing']}), m=await AP.matchPerson({name:'Pia Testesen',organizationName:'Ekstern AS',domain:'ekstern-test.no'});
      return {o,pe,m,calls}; });
    check('S10 adapteren gir nøytrale former og bruker den byttede transporten',ad,v=>v.o.matched&&v.o.domain==='ekstern-test.no'&&v.pe.people[0].name==='Pia Testesen'&&v.m.email==='pia@ekstern-test.no'&&v.m.emailStatus==='verified'&&v.calls.length===3);
    check('S11 SalongServices.use bytter backend uten å endre kallene, reset går tilbake',await ev(async()=>{ const S=window.SalongServices; S.use({getAccount:async()=>({id:'fra-server'})}); const a=await S.accounts.getAccount('x'); S.reset(); const b=await S.accounts.getAccount('x'); return [a.id,b]; }),v=>v[0]==='fra-server'&&v[1]===null);
    // statisk: ingen hemmeligheter i kildekoden, og UI-berik går via tjenestelaget
    const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
    const files=walk(path.join(ROOT,'src')).concat(walk(path.join(ROOT,'scripts')),[path.join(ROOT,'.env.example')]).filter(f=>/\.(js|py|html|json|example)$/.test(f));
    const bad=files.filter(f=>/(api[_-]?key|secret|token|passw(or)?d)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']|sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(fs.readFileSync(f,'utf8')));
    check('S12 ingen hemmeligheter eller nøkler i kildekoden',bad,[]);
    const ui=fs.readFileSync(path.join(ROOT,'src/berik.js'),'utf8');
    const demo=(()=>{ const s=fs.readFileSync(path.join(ROOT,'src/app_base.js'),'utf8'), i=s.indexOf('const DEMO=')+11; let d=0,j=i; for(;j<s.length;j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d) break; } } return JSON.parse(s.slice(i,j+1)); })();
    check('S14 DEMO i app_base.js er lik data/example/seed.json',JSON.stringify(demo)===JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT,'data/example/seed.json'),'utf8'))),true);
    check('S13 Berik-knappene bruker SalongServices.enrichment',/SalongServices\.enrichment/.test(ui),true);
    check('X1 ingen sidefeil',A.errs.length,0);
  }catch(e){ await A.done(e); return; }
  await A.done();
})();
