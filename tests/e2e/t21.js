// Runde 21: metoden bak «Berik» i siden: hele sider (web_fetch_exa i ekte svarformat), tidlig stopp, Claude-uttrekk ved behov,
// kontroll mot kilden, og den visuelle flyten (fremdrift i raden, ett klikk til kontakt, generell adresse).
// Alle organisasjoner, personer og sider er oppdiktede. Kjør: node tests/e2e/t21.js (etter npm run build)
const {navTo,setup,testSeed,SHOT} = require('./h.js');
(async()=>{
  const A=await setup({ai:true,mcp:true,seed:testSeed(),viewport:{width:1320,height:900}}), {p,check}=A;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await ev(()=>{
      window.__fetchOn=true;
      // hele sider slik web_fetch_exa faktisk svarer: «# Tittel», «URL: …», blank linje, innhold; feil som «Error fetching …»
      const FULL={
        'https://hus-test.no/om-oss/ansatte':['Ansatte | Huset','# Våre ansatte\n\n# Sara Testesen\n\nLeder\n\n# Filip Fiktiv Kristiansen\n\nArrangementsansvarlig tlf. 22 00 00 37\n\nfilip@hus-test.no\n\nFilip svarer på alt om arrangementer.\n\n# Krister Magnus\n\nMarkedsansvarlig tlf. 46 00 00 64\n\nkrister@hus-test.no\n\n# Tone Prøvesen Lund\n\nAdministrasjonssjef'],
        'https://prosa-test.no/om-oss/team':['Vårt team','Vårt team\n\nKommunikasjon og arrangement ledes av Mona Fiktivsen, som er kommunikasjonsdirektør hos oss. Ta kontakt med henne på mona@prosa-test.no.\n\nVi holder til i Oslo.'],
        'https://bare-test.no/kontakt':['Kontakt','Kontakt oss\n\npost@bare-test.no\n\nTelefon: 22 33 44 55']};
      const hit=(url,title,text)=>'Title: '+title+'\nURL: '+url+'\nPublished: N/A\nAuthor: N/A\nHighlights:\n'+text+'\n\n---\n\n';
      window.__searches=[]; window.__fetched=[];
      window.__mcpFn=async(s,t,i)=>{
        if(t==='web_search_exa'){ const q=String(i.query||''); window.__searches.push(q); if(/category:people/.test(q)) return {payload:''};
          const dom=(q.match(/site:([a-z0-9.-]+)/)||[])[1]||(Object.keys(FULL).map(u=>new URL(u).hostname).find(h=>q.includes(h))||'');
          if(!/site:/.test(q)) return {payload:''};
          // søketreff er bare utdrag: navn uten stilling, slik at siden må leses i sin helhet
          return {payload:Object.entries(FULL).filter(([u])=>new URL(u).hostname===dom).map(([u,[title,text]])=>hit(u,title,text.slice(0,40)+'\n...')).join('')}; }
        if(t==='web_fetch_exa'){ window.__fetched.push(...i.urls); return {payload:i.urls.map(u=>FULL[u]?'# '+FULL[u][0]+'\nURL: '+u+'\n\n'+FULL[u][1]+'\n\n':'Error fetching '+u+': CRAWL_NOT_FOUND\n').join('')}; }
        if(t==='apollo_organizations_lookup') return {payload:{organizations:[]}};
        if(t==='apollo_mixed_people_api_search') throw {code:'tool_error',message:'API_INACCESSIBLE: upgrade required'};
        throw {code:'tool_error',message:'uventet '+t}; };
      // Claude (sample): svarer med én ekte og én oppdiktet person for prosa-siden
      window.__sampleFn=async prompt=>/prosa-test\.no\/om-oss\/team/.test(prompt)?JSON.stringify({people:[
        {name:'Mona Fiktivsen',title:'Kommunikasjonsdirektør',email:'mona@prosa-test.no',relation:'staff',quote:'Mona Fiktivsen, som er kommunikasjonsdirektør hos oss'},
        {name:'Hilde Hallusinert',title:'Eventsjef',email:'hilde@prosa-test.no',relation:'staff',quote:'Hilde Hallusinert, eventsjef'}]}):'{"people":[],"events":[]}';
    });
    const mk=(n,d,s)=>ev(async([n,d,s])=>(await window.__salong.crm.accounts.create({name:'[TEST] '+n,website:'https://'+d,segId:s,place:'Oslo'})).data.id,[n,d,s]);
    const U={hus:await mk('Huset','hus-test.no','fag'),prosa:await mk('Prosa Instituttet','prosa-test.no','forskning'),bare:await mk('Bare Adresse','bare-test.no','bedrift')};
    const job=id=>ev(i=>{ const L=Object.entries(window.__salong.S.mtjob).filter(([,j])=>j.accId===i).map(([k,j])=>({id:k,...j})); return L.sort((a,b)=>String(b.requested_at).localeCompare(String(a.requested_at)))[0]||null; },id);
    const till=async id=>{ const t0=Date.now(); for(;;){ const j=await job(id); if(j&&['done','error'].includes(j.status)) return j; if(Date.now()-t0>15000) return j; await wait(150); } };
    const run=async id=>{ await ev(i=>window.__salong.crm.enrichment.start(i,{force:true}),id); return till(id); };
    const info=id=>ev(i=>{ const a=window.__salong.MT.get(i), es=a.es, cd=(a.enr&&a.enr.cd)||{}; return {state:es.state,label:es.label,quick:es.quick,pending:es.pending,onlyGen:es.onlyGen,rec:es.rec?{n:es.rec.p.name,t:es.rec.p.title,e:es.rec.p.email,ph:es.rec.p.phone}:null,cands:es.cands.map(c=>c.p.name),stop:cd.stop,read:cd.read,llm:cd.llm,rej:(cd.rejected||[]).map(r=>r.name+':'+r.reasons[0]),rounds:(cd.rounds||[]).length}; },id);

    // ---------- 1. hele sider + tidlig stopp ----------
    const s0=await ev(()=>window.__searches.length);
    const jh=await run(U.hus), H=await info(U.hus);
    check('M01 hele ansattsiden leses, og kontakten kommer med e-post og telefon som står på siden',H.rec,v=>v&&v.n==='Filip Fiktiv Kristiansen'&&v.t==='Arrangementsansvarlig'&&v.e==='filip@hus-test.no'&&/22 00 00 37/.test(v.ph));
    check('M02 reserven er med, og feil funksjon (administrasjon) er ikke anbefalt',H.cands,v=>v.includes('Krister Magnus')&&v[0]==='Filip Fiktiv Kristiansen');
    check('M03 søket stopper tidlig når anbefalt kontakt og en reserve er funnet',[H.stop,H.rounds,await ev(()=>window.__searches.length)-s0],v=>v[0]==='recommended'&&v[1]===0&&v[2]<=4);
    check('M04 jobben viser trinnet «Hele sider» og sier at personsøk ikke var nødvendig',jh.pipeline.map(s=>s.id+':'+s.detail),v=>v.some(x=>/^read:1 side lest i sin helhet/.test(x))&&v.some(x=>/^people_web:Ikke nødvendig/.test(x)));
    check('M05 anbefalt kontakt med kanal er «Kontakt klar» og venter bare på ett klikk',[H.label,H.pending,H.state],['Kontakt klar',true,'needs_review']);

    // ---------- 2. Claude-uttrekk bare ved behov, kontrollert mot kilden ----------
    const c0=await ev(()=>window.__sampleCalls||0);
    await run(U.prosa); const P=await info(U.prosa);
    check('M06 Claude brukes når parserne ikke finner noen, og personen som står på siden beholdes',[P.cands,P.llm&&P.llm.calls>=1],v=>v[0].length===1&&v[0][0]==='Mona Fiktivsen'&&v[1]);
    check('M07 personen som ikke står på siden forkastes med årsak',P.rej,['Hilde Hallusinert:name_missing']);
    check('M08 Claude ble ikke spurt for organisasjonen der parserne fant kontakten',[c0,await ev(()=>window.__sampleCalls||0)],v=>v[0]===0&&v[1]>=1&&v[1]<=3);
    check('M09 e-post beholdes bare fordi den står ordrett på siden',P.rec&&P.rec.e,'mona@prosa-test.no');

    // ---------- 3. bare generell adresse ----------
    await run(U.bare); const B=await info(U.bare);
    check('M10 uten person: tilstanden er «Bare generell adresse», ikke en feil',[B.state,B.label,B.onlyGen],['no_person_found','Bare generell adresse',true]);

    // ---------- 4. den visuelle flyten ----------
    await ev(async ids=>window.__salong.crm.batches.create({name:'[TEST] Batch 21',ids}),Object.values(U));
    await navTo(p,'prosp',300); await p.click('[data-mttab="arb"]'); await wait(400);
    const row=id=>ev(i=>{ const r=document.querySelector('tr[data-mtacc="'+i+'"]'); return r?{t:r.innerText.replace(/\s+/g,' '),btn:[...r.querySelectorAll('button.btn')].map(b=>b.textContent.trim())}:null; },id);
    check('V01 raden viser kontakten og «Bruk kontakt» med ett klikk',await row(U.hus),v=>/Filip Fiktiv Kristiansen/.test(v.t)&&/Kontakt klar/.test(v.t)&&v.btn.includes('Bruk kontakt'));
    check('V02 uten person tilbys den generelle adressen direkte',await row(U.bare),v=>/post@bare-test\.no/.test(v.t)&&v.btn.includes('Bruk generell adresse'));
    await p.screenshot({path:SHOT+'/t21_arb.png'});
    await p.click('tr[data-mtacc="'+U.hus+'"] [data-cdquick]'); await wait(600);
    check('V03 ett klikk gjør kontakten aktiv og accounten klar',await ev(i=>{ const a=window.__salong.MT.get(i); return [a.active.map(x=>x.name),a.es.state,a.flags.enriched]; },U.hus),v=>v[0][0]==='Filip Fiktiv Kristiansen'&&v[1]==='ready'&&v[2]===true);
    await p.click('tr[data-mtacc="'+U.bare+'"] [data-awgen]'); await wait(600);
    check('V04 generell adresse brukes med ett klikk og telles ikke som person',await ev(i=>{ const a=window.__salong.MT.get(i); return [a.active.length,a.active.every(x=>x.general),a.es.state]; },U.bare),[1,true,'ready']);
    check('V04b uten eventsignal står accounten under «Må kvalifiseres» med årsaken, ikke under «Trenger research»',await ev(i=>{ const r=document.querySelector('tr[data-mtacc="'+i+'"]'); let g=r; while(g&&!g.classList.contains('aw-gh')) g=g.previousElementSibling; return [g?g.innerText.replace(/\s+/g,' '):'',r.querySelector('.aw-n').innerText.replace(/\s+/g,' ')]; },U.hus),v=>/MÅ KVALIFISERES/.test(v[0])&&/Avklar eventsignal/.test(v[1])&&/Kvalifiser/.test(v[1]));
    // fremdrift i raden: tre trinn mens research pågår
    await ev(()=>{ const f=window.__mcpFn; window.__mcpFn=async(...a)=>{ await new Promise(r=>setTimeout(r,500)); return f(...a); }; });
    await ev(i=>{ window.__salong.crm.enrichment.start(i,{force:true}); },U.prosa); await wait(1300);
    await navTo(p,'prosp',200); await p.click('[data-mttab="arb"]'); await wait(300);
    check('V05 mens research pågår viser raden tre trinn med klartekst',await ev(i=>{ const g=document.querySelector('tr[data-mtacc="'+i+'"] .aw-pg'); return g?[g.querySelectorAll('i').length,g.querySelector('em').textContent,g.getAttribute('aria-label')]:null; },U.prosa),v=>v&&v[0]===3&&/Leser nettsiden|Finner arrangementer|Finner kontaktperson|Kontrollerer mot kilden|Venter på tur/.test(v[1])&&/trinn \d av 3|Venter/.test(v[2]));
    await p.screenshot({path:SHOT+'/t21_under.png'});
    await till(U.prosa);
    // panelet: klar oppsummering av hva research gjorde
    await ev(i=>{ window.__salong.mtOpen(i); },U.prosa); await wait(500); await ev(()=>{ const b=document.querySelector('[data-bkt="kil"]'); b&&b.click(); }); await wait(400);
    check('V06 Kilder forteller i vanlige ord hva som ble gjort og hva som ble forkastet',await ev(()=>{ const m=document.querySelector('.cd-ml'); return m?m.textContent:''; }),v=>/lest i sin helhet/.test(v)&&/lest av Claude/.test(v)&&/1 forslag forkastet fordi det ikke sto i kilden/.test(v));
    await p.screenshot({path:SHOT+'/t21_kilder.png'});
    await ev(()=>{ const b=document.querySelector('[data-bkt="kon"]'); b&&b.click(); }); await wait(400);
    check('V07 kandidatkortet sier at navnet er lest av Claude og kontrollert mot siden',await ev(()=>{ const c=document.querySelector('.cd-c .cd-src'); return c?c.textContent:''; }),v=>/lest av Claude, kontrollert mot siden/.test(v));
    await p.screenshot({path:SHOT+'/t21_kontakt.png'});
    check('X1 ingen sidefeil',A.errs.length,0);
  }catch(e){ await A.done(e); return; }
  await A.done();
})();
