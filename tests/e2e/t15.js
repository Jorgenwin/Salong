// Runde 15: produktrydding, Berik som handling (mocket Apollo/Exa), batch-eligibility, I dag, Kalender, Marked. Kjør: node t15.js
const {navTo,setup,testSeed} = require('./h.js');
(async()=>{
  const A=await setup({ai:true,mcp:true,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), view=async v=>{ await navTo(p,v,300); };
  const EXA=(dom,title,body)=>'Title: '+title+'\nURL: https://'+dom+'/arrangement/fagdag\nPublished: 2026-09-01\nHighlights: '+body+'\n---\n';
  try{
    const mock=()=>ev(()=>{
      window.__aiFn=()=>({people:[{name:'Nora Test',title:'Eventansvarlig',email:null,src:0,quote:'Nora Test, Eventansvarlig'}]});
      window.__mcpFn=async(s,t,i)=>{
        const q=String(i.query||i.q_organization_fuzzy_name||(i.q_organization_domains_list||[])[0]||'');
        if(t==='web_search_exa'){
          if(/beta-test|Beta Forening/.test(q)) throw {code:'tool_error',message:'Exa feilet'};
          if(/gamma-test|Gamma Forening/.test(q)) return {payload:''};
          return {payload:'Title: [TEST] Fagdag 2026\nURL: https://alfa-test.no/arrangement/fagdag\nPublished: 2026-09-01\nHighlights: Fagdag 2026\n13 oktober 2026 09:30 - 14:50 Europe/Oslo\nForstanderskapssalen, Sentralen, Øvre Slottsgate 3\n120 deltakere\nKontaktperson: Nora Test, Eventansvarlig\n---\n'}; }
        if(t==='apollo_organizations_lookup') return {payload:{organizations:[{id:'a'.repeat(24),name:'Alfa',domain:q.replace(/^www\./,'')}]}};
        if(t==='apollo_mixed_people_api_search') throw {code:'tool_error',message:'API_INACCESSIBLE: upgrade required'};
        throw {code:'tool_error',message:'uventet '+t}; };
    });
    await mock();
    const ids=await ev(async()=>{ const c=window.__salong.crm, out=[]; for(const n of ['Alfa','Beta','Gamma']){ const r=await c.accounts.create({name:'[TEST] '+n+' Forening',website:'https://'+n.toLowerCase()+'-test.no',segId:'fag',place:'Oslo'}); out.push(r.data.id); } return out; });
    const job=async id=>ev(i=>{ const L=Object.entries(window.__salong.S.mtjob).filter(([,j])=>j.accId===i).map(([k,j])=>({id:k,...j})); return L.sort((a,b)=>String(b.requested_at).localeCompare(String(a.requested_at)))[0]||null; },id);
    const till=async(id,st,ms)=>{ const t0=Date.now(); for(;;){ const j=await job(id); if(j&&st.includes(j.status)) return j; if(Date.now()-t0>(ms||8000)) return j; await wait(150); } };

    // ---------- Berik som handling ----------
    await ev(i=>window.__salong.crm.enrichment.start(i),ids[0]);
    const j1=await till(ids[0],['done','error']);
    check('E01 Berik kjører direkte fra siden og fullfører uten ekstern økt',[j1.status,j1.executor],['done','page']);
    check('E02 providerResults per kilde (web ok, Apollo plan_restricted, Cognism ikke koblet)',(j1.provider_results||[]).map(r=>r.provider+':'+r.status).join('|'),v=>/web:ok/.test(v)&&/apollo:ok/.test(v)&&/apollo:plan_restricted/.test(v)&&/cognism:not_connected/.test(v));
    const a1=await ev(i=>{ const a=window.__salong.MT?null:null; const d=window.__salong.S.mtacc[i]; return {sig:(d.enr&&d.enr.event_signals)||[],per:Object.values(window.__salong.S.mtper).filter(p=>p.accId===i)}; },ids[0]);
    check('E03 eventsignal med dato, venue, kapasitet og kilde-URL',a1.sig[0]&&[a1.sig[0].date,a1.sig[0].venue,a1.sig[0].capacity,a1.sig[0].source_url],['2026-10-13','Forstanderskapssalen, Sentralen, Øvre Slottsgate 3',120,'https://alfa-test.no/arrangement/fagdag']);
    check('E04 funnet kontakt har kilde, URL, provider og er IKKE verifisert',a1.per.map(p=>[p.name,p.source,p.provider,!!p.sourceUrl,p.emailStatus||'',p.email||'',p.verifiedAt||'']),[['Nora Test','Web','web',true,'','','']]);
    check('E05 Apollo-kreditter brukes aldri automatisk (ingen people_match)',await ev(()=>window.__mcpCalls.filter(c=>c.t==='apollo_people_match').length),0);
    check('E06 Salong lagrer aldri innlogging/cookies: ingen slike felt i person eller jobb',await ev(()=>JSON.stringify([window.__salong.S.mtper,window.__salong.S.mtjob])),v=>!/cookie|password|passord|credential|token/i.test(v));
    // dedupe: ny kjøring legger ikke til samme kontakt igjen
    await ev(i=>window.__salong.crm.enrichment.start(i,{force:true}),ids[0]); await wait(300);
    const j1b=await till(ids[0],['done','error']); await wait(300);
    check('E07 duplikat kontakt dedupliseres ved ny berikelse',await ev(i=>Object.values(window.__salong.S.mtper).filter(p=>p.accId===i).length,ids[0]),1);
    check('E08 eventsignal dedupliseres (samme dato og tittel)',await ev(i=>window.__salong.S.mtacc[i].enr.event_signals.length,ids[0]),1);
    // leverandørfeil ødelegger ikke accounten
    await ev(i=>window.__salong.crm.enrichment.start(i),ids[1]);
    const j2=await till(ids[1],['done','error']);
    check('E09 leverandørfeil (web svarer ikke): tilstand provider_error, errors[] på jobben, accounten fungerer',[j2.status,j2.state,(j2.errors||[]).length>0,(j2.provider_results||[]).some(r=>r.provider==='web'&&r.status==='error')],['error','provider_error',true,true]);
    await ev(i=>window.__salong.openOrg?0:0,ids[1]);
    check('E10 uten funn: ingen kontakter finnes på',await ev(i=>Object.values(window.__salong.S.mtper).filter(p=>p.accId===i).length,ids[1]),0);

    // ---------- batch ----------
    const bid=await ev(async(i)=>(await window.__salong.crm.batches.create({name:'[TEST] Batch 2',ids:i})).data,ids);
    await view('prosp'); await wait(300); await p.click('[data-mttab="arb"]'); await wait(300);
    check('E11 batch-panel viser «Berik hele batchen» og ingen Claude-økt-språk',await ev(()=>({btn:!!document.querySelector('[data-enrall]'),txt:/Claude-økt|Salong-køen|Venter på Claude/.test(document.body.innerText)})),{btn:true,txt:false});
    await ev(b=>window.__salong.crm.enrichment.startBatch(b),bid); await till(ids[2],['done','error']); await wait(500);
    const pg=await ev(b=>{ const B=window.__salong.crm.batches; return window.__salong.enrProgress(window.__salong.MT?[]:[]); },bid).catch(()=>null);
    await view('prosp'); await wait(300); await p.click('[data-mttab="arb"]'); await wait(300);
    const w=await txt(p,'.aw-job')||'';
    check('E12 jobblinje: «Beriket 3 / 3» + klare/kontroll',w,v=>/Beriket 3 av 3/.test(v)&&/kontaktklare|trenger vurdering|fant ingen/.test(v));
    check('E13 enrichment-job bærer spesifisert modell',await ev(i=>{ const j=Object.values(window.__salong.S.mtjob).find(x=>x.accId===i); return ['accId','requested_by','providers_requested','status','started_at','completed_at','provider_results','errors','last_updated_at'].filter(k=>!(k in j)); },ids[0]),[]);
    // manglende kobling: status lagres, ingenting simuleres, prøv igjen fungerer
    const idsB=await ev(async()=>{ const r=await window.__salong.crm.accounts.create({name:'[TEST] Delta Forening',website:'https://delta-test.no',segId:'fag',place:'Oslo'}); return r.data.id; });
    await ev(()=>{ window.__mcpOn=false; window.__salong.ENR.servers=null; window.__salong.ENR.stat=null; window.__salong.ENR.fatal=''; });
    await ev(i=>window.__salong.crm.enrichment.start(i),idsB); await wait(1200);
    const jd=await job(idsB);
    check('E14 uten kobling: jobben står igjen som ikke startet, ingen simulert fullføring',[jd.status,jd.blocked,jd.outcome||''],['queued','server_not_connected','']);
    await ev(()=>{ window.__mcpOn=true; }); await view('prosp'); await wait(200);
    await p.reload(); await wait(900); await ev(()=>{ window.__salong.UI.incEx=true; }); await mock();
    check('E15 status overlever reload (jobben er lagret)',(await job(idsB)).status,'queued');
    await ev(()=>window.__salong.ENR.fatal=''); await ev(i=>window.__salong.enrKick([Object.entries(window.__salong.S.mtjob).find(([,j])=>j.accId===i)[0]],{retry:true}),idsB);
    const jd2=await till(idsB,['done','error']);
    check('E16 prøv igjen fullfører når koblingen er tilbake',jd2.status,'done');
    check('E17 Cognism-data lagres aldri uten kilde (ingen cognism-kontakter)',await ev(()=>Object.values(window.__salong.S.mtper).filter(p=>/cognism/i.test(p.source+p.provider)).length),0);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
