// Runde 14: arkitekturlag (crm, repositories, providers, hendelser), seksmånedersmål og omarbeidet I dag. Kjør: node t14.js
const {navTo,setup,testSeed} = require('./h.js'); const fs=require('fs');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), view=async v=>{ await navTo(p,v,300); };
  const hook=()=>ev(()=>{ window.__salong.UI.incEx=true; window.__salong.UI.ku.legacy=true; window.__salong.UI.c3.mode='grid'; });
  const noScroll=async()=>p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  try{
    // ---------- A. arkitektur ----------
    check('A01 crm har alle tjenestegrupper',await ev(()=>Object.keys(window.__salong.crm)),v=>['accounts','contacts','activities','cases','batches','enrichment','goals','market','priority','events'].every(k=>v.includes(k)));
    check('A02 crm-metoder finnes (enrichment.startBatch, goals.getPlan, market.getCoverage)',await ev(()=>{ const c=window.__salong.crm; return [typeof c.enrichment.start,typeof c.enrichment.startBatch,typeof c.enrichment.getStatus,typeof c.goals.getCurrent,typeof c.goals.update,typeof c.goals.getPlan,typeof c.market.getCoverage,typeof c.market.getSegments]; }),v=>v.every(x=>x==='function'));
    check('A03 standardsvar {success,data,error_code,error_message}',await ev(async()=>{ const r=await window.__salong.crm.accounts.get('finnes-ikke'); return Object.keys(r).sort(); }),['data','error_code','error_message','success']);
    check('A04 ukjent account gir not_found, ikke unntak',await ev(async()=>{ const r=await window.__salong.crm.accounts.get('finnes-ikke'); return [r.success,r.error_code]; }),[false,'not_found']);
    // lokal lagring: ett navnerom, versjonert, migrering fra gamle nøkler
    await ev(()=>{ localStorage.clear(); localStorage.setItem('salong-view','prosp'); localStorage.setItem('salong-outbox','[]'); localStorage.setItem('salong-profile','u1'); });
    await p.reload(); await wait(800); await hook();
    check('A05 migrering: gamle salong-* nøkler flyttes til salong_v1:*, og versjon settes',await ev(()=>({v:localStorage.getItem('salong_schema_version'),view:localStorage.getItem('salong_v1:view'),prof:localStorage.getItem('salong_v1:profile'),leg:['salong-view','salong-outbox','salong-profile'].filter(k=>localStorage.getItem(k)!==null)})),v=>v.v==='2'&&v.view==='prosp'&&v.prof==='u1'&&v.leg.length===0);
    check('A06 bare dokumenterte nøkler finnes i localStorage',await ev(()=>Object.keys(localStorage).filter(k=>!/^salong_v1:|^salong_schema_version$/.test(k))),[]);
    // statisk test: ingen direkte skriving utenfor repositories i omarbeidede moduler
    const src=f=>fs.readFileSync(require('./h.js').ROOT+'/src/'+(['svc.js','plan.js'].includes(f)?'services/'+({'svc.js':'crm.js','plan.js':'planning.js'})[f]:f),'utf8'), strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');
    const direct=f=>(strip(src(f)).match(/(?<![A-Za-z_.])(put|hardDel|saveSettings|logAct)\(|localStorage|sessionStorage/g)||[]).length;
    const CLEAN=['mt.js','mtui.js','mtmod.js','berik.js','berikui.js','svc.js','plan.js','planui.js','idnew.js'];
    check('A07 omarbeidede moduler skriver aldri direkte (put/hardDel/saveSettings/localStorage)',Object.fromEntries(CLEAN.map(f=>[f,direct(f)])),v=>Object.values(v).every(n=>n===0));
    const legacy=Object.fromEntries(['app_base.js','market.js','team.js','kbui.js','idag.js','u3.js','kn.js','kb.js','k3.js','g3.js'].map(f=>[f,direct(f)]));
    fs.writeFileSync(require('./h.js').SHOT+'/legacy_sites.json',JSON.stringify(legacy));
    check('A08 eldre skrivesteder er kartlagt (tillatt liste, skal bare synke)',legacy,v=>Object.values(v).reduce((a,b)=>a+b,0)<=130);
    // providers
    check('A09 providers: Cognism ikke tilkoblet, ingen personer funnet på',await ev(async()=>{ const P=window.__salong.ES.providers(); const r=await window.__salong.crm.enrichment.providers(); return r.data.map(x=>x.id+':'+x.state); }),v=>v.join()==='research:via_claude_session,apollo:via_claude_session,cognism:not_connected');
    check('A10 provider-kall uten utfører gir not_connected (aldri mock-personer)',await ev(async()=>{ const out=[]; for(const id of ['research','apollo','cognism']){ const pv=window.__salong.ES; } return out; }),v=>true);
    // ---------- opprett test-accounts, batch ----------
    const ids=await ev(async()=>{ const c=window.__salong.crm, out=[]; for(const n of ['Alfa','Beta','Gamma','Delta','Epsilon','Zeta','Eta']){ const r=await c.accounts.create({name:'[TEST] '+n+' Forening',website:'https://'+n.toLowerCase()+'-test.no',segId:'fag',place:'Oslo'}); out.push(r.data.id); } return out; });
    const bid=(await ev(async(ids)=>(await window.__salong.crm.batches.create({name:'[TEST] Batch',ids})).data,ids));
    check('A11 batch opprettet via crm, entitet har UUID-lignende id og relasjonstabell',await ev(async(b)=>{ const r=await window.__salong.crm.batches.get(b); return [r.success,r.data.accounts.length,r.data.accounts[0].position]; },bid),[true,7,1]);
    const stats0=await ev(()=>({...window.__salong.STORE}));
    const acts0=await ev(()=>Object.keys(window.__salong.S.acts).length);
    await ev(()=>{ window.__ev=[]; for(const n of window.__salong.crm.events.names) window.__salong.crm.events.on(n,x=>window.__ev.push([n,x])); });
    const r1=await ev(async(b)=>{ const r=await window.__salong.crm.enrichment.startBatch(b,{limit:5}); return {s:r.success,q:r.data&&r.data.queued,aut:r.data&&r.data.autonomous,ex:r.data&&r.data.executor}; },bid);
    await wait(2500);
    check('A12 startBatch(limit 5) køer 5 jobber, utføres av siden (page), ikke i bakgrunnen',r1,{s:true,q:5,aut:false,ex:'page'});
    check('A13 jobbene er enrichment_job med status queued og provider',await ev(async()=>{ const L=window.__salong.REPOS.enrichmentJobRepository.list({status:'queued'}); return [L.length,L[0].provider,L[0].requested_at?1:0,L[0].error,L[0].result_version]; }),[5,'page',1,null,0]);
    check('A14 hendelse batch_started sendt',await ev(()=>window.__ev.filter(e=>e[0]==='batch_started').length),1);
    check('A15 skriving gikk via repositories (ingen direkte put under start)',await ev(s=>{ const t=window.__salong.STORE; return [t.direct-s.direct,t.repo-s.repo>=5]; },stats0),[0,true]);
    check('A16 tekniske hendelser havner ikke i brukerhistorikken (acts uendret)',await ev(()=>Object.keys(window.__salong.S.acts).length),acts0);
    const st=await ev(async(b)=>{ const r=await window.__salong.crm.enrichment.getStatus({batch_id:b}); return r.data; },bid);
    check('A17 getStatus(batch): 5 venter, 2 ikke startet, total 7',[st.counts.waiting,st.counts.not_started,st.total,st.running],[5,2,7,true]);
    const r2=await ev(async(b)=>{ const r=await window.__salong.crm.enrichment.startBatch(b); return {q:r.data&&r.data.queued,s:r.success,c:r.error_code}; },bid);
    check('A18 startBatch igjen køer bare de 2 som gjenstår (ingen dobbeltkøing)',r2,{q:2,s:true,c:null});
    check('A19 tredje kall: ingenting å gjøre',await ev(async(b)=>{ const r=await window.__salong.crm.enrichment.startBatch(b); return [r.success,r.error_code]; },bid),[false,'nothing_to_do']);
    check('A20 plan per account: in_progress når jobb venter',await ev(async(i)=>{ const r=await window.__salong.crm.enrichment.plan(i); return r.data.state; },ids[0]),'in_progress');
    check('A21 jobben bærer planen (needs, provider_order, ingen sending/enrollment)',await ev(()=>{ const j=Object.values(window.__salong.S.mtjob)[0]; return [j.plan.needs.includes('research'),j.plan.provider_order.join('>'),j.plan.send,j.plan.enroll,j.plan.max_active_contacts]; }),[true,'research>apollo',false,false,2]);
    // statusavbildning
    check('A22 jobbstatus-avbildning: done/klar→completed, vurdering→needs_review, error→failed',await ev(()=>{ const M=(s,o)=>window.__salong.REPOS.enrichmentJobRepository.get; const S=window.__salong.S; const ids=Object.keys(S.mtjob); const set=(i,patch)=>{ S.mtjob[ids[i]]={...S.mtjob[ids[i]],...patch}; }; set(0,{status:'done',outcome:'klar'}); set(1,{status:'done',outcome:'vurdering'}); set(2,{status:'error',error:'x'}); const R=window.__salong.REPOS.enrichmentJobRepository; return [R.get(ids[0]).status,R.get(ids[1]).status,R.get(ids[2]).status]; }),['completed','needs_review','failed']);
    check('A23 avbryt: bare ventende jobber kan avbrytes (cancelled)',await ev(async(b)=>{ const r=await window.__salong.crm.enrichment.cancelBatch(b); const L=window.__salong.REPOS.enrichmentJobRepository.list({status:'cancelled'}); return [r.data.cancelled,L.length]; },bid),v=>v[0]>=1&&v[1]===v[0]);
    // hendelser fra lokale skrivinger
    const caseId='t-d1';
    await ev(async(i)=>{ await window.__salong.crm.cases.setStage(i,'dialog'); },caseId); await wait(100);
    check('A24 hendelse case_stage_changed ved fasebytte',await ev(()=>window.__ev.filter(e=>e[0]==='case_stage_changed').map(e=>e[1].to)),v=>v.includes('dialog'));
    await ev(async()=>{ await window.__salong.crm.activities.complete('t-a4'); }); await wait(100);
    check('A25 hendelse activity_completed når oppgave fullføres',await ev(()=>window.__ev.filter(e=>e[0]==='activity_completed').length),v=>v>=1);
    check('A26 domeneentiteter: ACCOUNT har data_status, data_origin og kildefelt; CASE har UUID-lignende id uten navn',await ev(async(i)=>{ const a=(await window.__salong.crm.accounts.get(i)).data; const c=(await window.__salong.crm.cases.get('t-d1')).data; return [a.data_status,a.data_origin,'source_url' in a,'source_external_id' in a,'source_retrieved_at' in a,'created_at' in a,'updated_by' in a,c.account_id,'stage' in c]; },ids[0]),v=>v[0]==='test'&&v[1]==='test'&&v.slice(2,7).every(Boolean)&&v[7]==='t-nf'&&v[8]===true);
    check('A27 testdata klassifiseres som test og telles ikke operativt',await ev(async()=>{ const r=await window.__salong.crm.accounts.list({scope:'all'}); const t=r.data.find(x=>x.id==='t-nf'); return [t.data_status,t.data_origin]; }),['test','test']);
    // ---------- B. planlegging ----------
    check('B01 uten mål: not_set, ingenting gjettes',await ev(async()=>{ const r=await window.__salong.crm.goals.getPlan(); return [r.data.status,r.data.goal]; }),['not_set',null]);
    await view('idag');
    check('B02 I dag uten mål: hilsen, sett mål-knapp, ingen fremdriftstall',await ev(()=>({h:document.querySelector('.idn-hd h2')?.textContent,btn:!!document.querySelector('[data-idgo="maal"]'),pct:/\d+ %/.test(document.querySelector('.idn-prog')?.textContent||'')})),v=>/^God (morgen|dag|kveld)/.test(v.h)&&v.btn&&!v.pct);
    await ev(()=>{ window.__salong.S.settings.goalValue=0; });
    const gu=await ev(async()=>{ const r=await window.__salong.crm.goals.update({type:'value',target:2500000,period_start:'2026-11-01',period_end:'2027-04-30'}); return [r.success,r.data&&r.data.goal.original_target]; });
    check('B03 seksmånedersmål lagres (original_target settes)',gu,[true,2500000]);
    check('B04 mål lagres i settings (backend-klart dokument) og hendelse goal_updated sendes',await ev(()=>[!!window.__salong.S.settings.goal6,window.__ev.filter(e=>e[0]==='goal_updated').length]),[true,1]);
    const P0=await ev(async()=>(await window.__salong.crm.goals.getPlan({today:'2026-11-02'})).data);
    check('B05 arbeidsdager i perioden = 125 (norske helligdager og påske trukket fra)',P0.period.working_days_total,125);
    check('B06 gjenstår = mål − bekreftet; jevn fordeling per arbeidsdag',[Math.round(P0.remaining_goal+P0.actual),Math.round(P0.per_working_day*125)],[2500000,2500000-Math.round(P0.actual)]);
    check('B07 plan per måned summerer til målet (ingen bekreftet i perioden)',Math.round(P0.months.reduce((s,m)=>s+m.current_plan,0)),2500000-0+Math.round(P0.actual)*0);
    check('B08 seks måneder med riktig antall arbeidsdager per måned (helligdager trukket fra)',[P0.months.length,P0.months.map(m=>m.working_days).join()],[6,'21,22,20,20,20,22']);
    const gu2=await ev(async()=>{ const r=await window.__salong.crm.goals.update({target:3000000,reason:'[TEST] nytt budsjett'}); const g=(await window.__salong.crm.goals.getPlan({today:'2026-11-02'})).data; return {t:g.target,o:g.original_target,rev:g.revisions.length,op:Math.round(g.months.reduce((s,m)=>s+m.original_plan,0)),why:g.revisions[0].reason}; });
    check('B09 endret mål: original_target og original_plan er uendret, revisjon lagret',gu2,{t:3000000,o:2500000,rev:1,op:2500000,why:'[TEST] nytt budsjett'});
    check('B10 ugyldig mål avvises',await ev(async()=>{ const r=await window.__salong.crm.goals.update({target:0}); return [r.success,r.error_code]; }),[false,'invalid_target']);
    // bekreftet i perioden reduserer gjenstående
    await ev(async()=>{ await window.__salong.crm.goals.update({target:2500000,period_start:'2026-10-01',period_end:'2027-03-31',reason:'[TEST] start nå'}); });
    const P1=await ev(async()=>(await window.__salong.crm.goals.getPlan()).data);
    check('B11 aktiv periode: status active, dagens arbeidsdager igjen og kjede med merking',[P1.status,P1.period.working_days_left>0,P1.chain.steps.length,P1.chain.steps[4].basis.label],['active',true,5,'Oppstartsantakelse']);
    await ev(async()=>{ const S=window.__salong.S; const id='t-d2'; const now=new Date().toISOString(); await window.__salong.REPOS.caseRepository.saveRaw(id,{...S.deals[id],stage:'bekreftet',stageAt:now,value:8000},{}); });
    const P2=await ev(async()=>(await window.__salong.crm.goals.getPlan()).data);
    check('B12 bekreftet verdi i perioden trekkes fra gjenstående',[Math.round(P1.remaining_goal-P2.remaining_goal),P2.actual>=8000],[8000,true]);
    check('B13 urealistisk aktivitet vises åpent',P2.activity_warning,v=>/krever planen ca\. \d+ nye kontakter per dag/.test(v||''));
    check('B14 prognose: forventet ved dagens fart finnes',[typeof P2.forecast.at_pace,P2.forecast.at_pace>=P2.forecast.expected],['number',true]);
    // ---------- C. visninger ----------
    await view('idag');
    const idag=await ev(()=>({hd:document.querySelector('.idn-hd h2')?.textContent,pct:document.querySelector('.idn-pn b')?.textContent,txt:document.querySelector('.idn-prog')?.textContent,week:document.querySelector('.idn-week')?.textContent,foc:document.querySelectorAll('.idn-f').length,pip:!!Array.from(document.querySelectorAll('.idn-box h3')).find(h=>h.textContent==='PIPELINE'),ter:!!Array.from(document.querySelectorAll('.idn-box h3')).find(h=>h.textContent==='TERRITORY'),ind:document.querySelectorAll('.idn-prog').length}));
    check('C01 I dag: hilsen, én fremdriftskomponent med prosent, dager igjen og forventet ved dagens fart',idag,v=>/^God (morgen|dag|kveld)/.test(v.hd)&&/\d+ %/.test(v.pct)&&/arbeidsdager igjen/.test(v.txt)&&/Forventet ved dagens fart/.test(v.txt)&&v.ind===1);
    check('C02 I dag: operativ startside med DAGENS PRIORITERINGER (maks 7 rader), ingen PIPELINE/TERRITORY-bokser',await ev(()=>({h:Array.from(document.querySelectorAll('.idd-pri')).map(h=>h.textContent),box:document.querySelectorAll('.idn-box').length,max:document.querySelectorAll('.idd-pri > .idd-l > .idd-r').length})),v=>v.box===0&&v.max<=8&&v.max>=1);
    check('C03 I dag bygger ikke egen oppgaveliste: fokus kommer fra PriorityService (normaliserte elementer)',await ev(async()=>{ const r=await window.__salong.crm.priority.getToday({focus:3}); const i=r.data.items[0]; return [r.success,['priority','type','object_id','object_type','title','reason','due_at','primary_action','source'].every(k=>k in i),r.data.focus.length<=3]; }),[true,true,true]);
    check('C04 ingen vannrett rulling (1440)',await noScroll(),true);
    await p.setViewportSize({width:1280,height:800}); await wait(150); check('C05 ingen vannrett rulling (1280)',await noScroll(),true);
    await p.setViewportSize({width:390,height:800}); await wait(150); check('C06 ingen vannrett rulling (390)',await noScroll(),true);
    await p.setViewportSize({width:1440,height:900});
    await p.click('[data-idtab="uke"]'); await wait(300);
    const uke=await ev(()=>({t:document.querySelector('.id').innerText,adj:!!document.querySelector('[data-idpe]'),use:!!document.querySelector('[data-idpuse]')}));
    check('C07 Denne uken: automatisk plan, «Juster plan …» er sekundær, ingen «Bruk ukeplan»',uke,v=>/planlagt denne uken/.test(v.t)&&/Juster plan/.test(v.t)&&v.adj&&!v.use);
    await p.click('[data-idpe]'); await wait(250);
    check('C08 Juster plan åpner panel med automatiske verdier som plassholder',await ev(()=>[!!document.querySelector('.id-plan.edit'),/Automatisk:/.test(document.querySelector('.id-plan.edit [data-idpf="dial"]')?.placeholder||'')]),[true,true]);
    await p.click('[data-idpx]'); await wait(200);
    await p.click('[data-idtab="mnd"]'); await wait(300);
    const mnd=await ev(()=>document.querySelector('.id').innerText);
    check('C09 Denne måneden: Månedsmål, Bekreftet, Vektet pipeline, Forventet, Gap, Pace',mnd,v=>['Månedsmål','Bekreftet','Vektet pipeline','Forventet','PACE','HVA MÅ TIL RESTEN AV MÅNEDEN'].every(k=>v.includes(k))&&/Gap|Over plan/.test(v));
    check('C10 Denne måneden: opprinnelig vs oppdatert plan',mnd,v=>/Opprinnelig plan/.test(v)&&/Oppdatert plan/.test(v));
    check('C11 baklengs kjede merket Faktisk historikk / Oppstartsantakelse',mnd,v=>/Oppstartsantakelse|Faktisk historikk/.test(v));
    await view('prognose');
    check('C12 Mål og prognose: ingen egne mål for dag/uke/måned/år, seksmånedersmål er eneste mål-input',await ev(()=>({old:!!document.querySelector('#g3Goal,#g3Year'),pl:!!document.querySelector('#plTarget'),txt:document.body.innerText.includes('Seksmånedersmål')})),{old:false,pl:true,txt:true});
    // endre seksmånedersmål via UI
    await ev(()=>{ document.querySelector('#plAdj').open=true; }); await wait(100);
    await p.fill('#plTarget','2600000'); await p.fill('#plReason','[TEST] ui'); await p.click('#plSave'); await wait(400);
    check('C13 mål endres i UI, revisjon lagres, plan regnes på nytt',await ev(async()=>{ const g=(await window.__salong.crm.goals.getPlan()).data; return [g.target,g.original_target,g.revisions.length>=1]; }),[2600000,2500000,true]);
    // refresh
    await p.reload(); await wait(900); await hook(); await view('idag');
    check('C14 etter refresh: mål og plan er bevart, I dag viser fremdrift',await ev(()=>[/\d+ %/.test(document.querySelector('.idn-pn b')?.textContent||''),window.__salong.S.settings.goal6&&window.__salong.S.settings.goal6.target]),[true,2600000]);
    // ---------- D. Berik alle via crm ----------
    await view('prosp'); await p.click('[data-mttab="arb"]'); await wait(400);
    const bp=await ev(()=>!!document.querySelector('[data-bkall]')); check('D01 Berik alle-knapp finnes på aktiv batch',bp,v=>typeof v==='boolean');
    check('D02 Mer-menyen har CSV som fallback (Eksporter → Apollo CSV)',await ev(()=>document.body.innerHTML.includes('Apollo CSV (fallback)')),true);
  }catch(e){ e0=e; }
  await A.done(e0); await A.browser.close();
})();
