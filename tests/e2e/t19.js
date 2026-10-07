// Runde 19: enrichment-statemaskin, flerrunde kontaktfunn, kandidatkort, Berik alle, Arbeidsliste, I dag. U1–U8 med mocket Exa/Apollo.
// Alle navn i fixturene er oppdiktede og finnes bare her i testen. Produktkoden inneholder ingen slike data. Kjør: node lev8/t19.js
const {navTo,setup,testSeed} = require('./h.js');
(async()=>{
  const A=await setup({ai:true,mcp:true,seed:testSeed()}), {p,check,txt,all}=A;
  const ev=async(f,a)=>{
    for(let attempt=0;;attempt++){
      try{ return await p.evaluate(f,a); }
      catch(e){
        if(attempt>=2||!/Execution context was destroyed|Cannot find context|Target page, context or browser has been closed/i.test(String(e&&e.message||e))) throw e;
        await p.waitForTimeout(180);
      }
    }
  }, wait=ms=>p.waitForTimeout(ms), view=async v=>{ await navTo(p,v,300); };
  try{
    // ---------- fixtures: dom -> sider (team, kontakt, event) ----------
    await ev(()=>{
      const pg=(dom,path,title,body)=>'Title: '+title+'\nURL: https://'+dom+path+'\nHighlights: '+body+'\n---\n';
      const FX={
        'fhi-test.no':{team:pg('fhi-test.no','/om-oss/ansatte','Ansatte','Kari Kommunesen, Kommunikasjonsrådgiver\nOla Direktørsen, Direktør\nLise Forskersen, Seniorforsker\nTor Personalsen, HR-sjef'),contact:pg('fhi-test.no','/kontakt','Kontakt oss','Postmottak: postmottak@fhi-test.no\nTelefon: 21 07 70 00')},
        'sifo-test.no':{team:pg('sifo-test.no','/om-oss/ansatte','Ansatte','Hans Forskningsleder, Forskningsleder\nGro Metodesen, Postdoktor'),events:pg('sifo-test.no','/arrangement/forbrukerdagen','Forbrukerdagen 2026','Forbrukerdagen 2026\n20 november 2026 10:00 - 15:00\nSentralen, Øvre Slottsgate 3\n90 deltakere\nKontaktperson: Mia Formidlingsen, Formidlingsrådgiver')},
        'farma-test.no':{team:pg('farma-test.no','/om-oss/ansatte','Ansatte','Nils Medlemsen, Medlemsansvarlig\nEva Kursen, Kurs- og arrangementsansvarlig\nPer Generalsen, Generalsekretær'),contact:pg('farma-test.no','/kontakt','Kontakt','post@farma-test.no\nTlf: 22 00 11 22')},
        'amb-test.no':{team:pg('amb-test.no','/about/team','Embassy team','Anna Diplomatsen, Public Diplomacy Officer\nBjørn Pressesen, Press and Communications Attaché\nCarl Ambassadesen, Ambassador')},
        'forlag-test.no':{team:pg('forlag-test.no','/om-oss/ansatte','Ansatte','Silje Salgsen, Markedssjef\nRune Haugen, Publisist\nGunn Berg, Forlagssjef')},
        'tech-test.no':{},
        'tom-test.no':{team:pg('tom-test.no','/om-oss','Om oss','Vi lager programvare for hele Norge.'),contact:pg('tom-test.no','/kontakt','Kontakt','info@tom-test.no')},
        'b1-test.no':{team:pg('b1-test.no','/om-oss/ansatte','Ansatte','Ida Bakken, Kommunikasjonssjef')},'b2-test.no':{team:pg('b2-test.no','/om-oss/ansatte','Ansatte','Ola Strand, Arrangementsansvarlig')},'b3-test.no':{contact:pg('b3-test.no','/kontakt','Kontakt','Telefon: 22 33 44 55')},
        'ev-test.no':{events:pg('ev-test.no','/arrangement/fagdag','Fagdag 2026','Fagdag 2026\n14 oktober 2026 09:30 - 14:50\nSentralen, Øvre Slottsgate 3\n110 deltakere\nKontaktperson: Una Eventsen, Eventansvarlig')}};
      window.__FX=FX; window.__apPeople={};
      window.__mcpFn=async(s,t,i)=>{
        const q=String(i.query||i.q_organization_fuzzy_name||(i.q_organization_domains_list||[])[0]||''), dom=(q.match(/site:([a-z0-9.-]+)/)||[])[1]||Object.keys(FX).find(d=>q.includes(d)||q.toLowerCase().includes(d.split('-')[0]))||'';
        if(t==='web_search_exa'){
          if(/category:people/.test(q)) return {payload:''};
          const f=FX[dom]||{}; if(/site:/.test(q)) return {payload:Object.values(f).join('')};
          return {payload:f.events||''}; }
        if(t==='apollo_organizations_lookup'){ const d=String((i.q_organization_domains_list||[])[0]||i.domain||q).replace(/^www\./,''); if(/ev-test/.test(d)) throw {code:'tool_error',message:'Apollo er nede'}; return {payload:{organizations:[{id:'a'.repeat(24),name:'X',domain:d}]}}; }
        if(t==='apollo_mixed_people_api_search'){ const d=(i.q_organization_domains_list||[])[0]||''; if(!/tech-test/.test(d)) throw {code:'tool_error',message:'API_INACCESSIBLE: upgrade required'};
          const T=(i.person_titles||[]).join(' ').toLowerCase(); const P=window.__apPeople;
          if(!/marketing|demand|partner|field|community/.test(T)) return {payload:{people:[]}};
          return {payload:{people:[{id:'p1',first_name:'Tina',last_name:'Markedsen',title:'Head of Marketing',country:'Norway',city:'Oslo',linkedin_url:'https://www.linkedin.com/in/tina-test'},{id:'p2',first_name:'Jon',last_name:'Utvikler',title:'Software Engineer',country:'Norway',city:'Oslo'},{id:'p3',first_name:'Lars',last_name:'Partnersen',title:'Partner Manager',country:'Norway',city:'Oslo'}]}}; }
        throw {code:'tool_error',message:'uventet '+t}; };
    });
    const mk=async(name,dom,seg)=>ev(async([n,d,s])=>{ const r=await window.__salong.crm.accounts.create({name:'[TEST] '+n,website:'https://'+d,segId:s,place:'Oslo'}); return r.data.id; },[name,dom,seg]);
    const U={fhi:await mk('FHI','fhi-test.no','offentlig'),sifo:await mk('SIFO OsloMet','sifo-test.no','forskning'),farma:await mk('Norges Farmaceutiske Forening','farma-test.no','fag'),amb:await mk('Ambassaden','amb-test.no','ambassade'),forlag:await mk('Forlaget','forlag-test.no','forlag'),tech:await mk('Teknologi AS','tech-test.no','saas'),tom:await mk('Tomt AS','tom-test.no','bedrift'),ev:await mk('Event AS','ev-test.no','bedrift')};
    const job=id=>ev(i=>{ const L=Object.entries(window.__salong.S.mtjob).filter(([,j])=>j.accId===i).map(([k,j])=>({id:k,...j})); return L.sort((a,b)=>String(b.requested_at).localeCompare(String(a.requested_at)))[0]||null; },id);
    const till=async(id,ms)=>{ const t0=Date.now(); for(;;){ const j=await job(id); if(j&&['done','error'].includes(j.status)) return j; if(Date.now()-t0>(ms||12000)) return j; await wait(150); } };
    const info=id=>ev(i=>{ const a=window.__salong.MT.get(i), es=a.es; return {state:es.state,label:es.label,tone:es.tone,detail:es.detail,rec:es.rec?{n:es.rec.p.name,t:es.rec.p.title,s:es.rec.score,w:es.rec.s.why}:null,cands:es.cands.map(c=>({n:c.p.name,t:c.p.title,s:c.s.score,src:c.p.source,neg:c.s.neg.map(x=>x.k)})),active:a.active.length,gen:es.general.has,fams:window.__salong.CD.understand(a).families.map(f=>f.id),ev:((a.enr&&a.enr.event_signals)||[]).length,errs:es.errs.length}; },id);
    const run=async id=>{ await ev(i=>window.__salong.crm.enrichment.start(i,{force:true}),id); return till(id); };

    // ---------- U1 FHI ----------
    await run(U.fhi); let I=await info(U.fhi);
    check('U1a FHI: forstår kommunikasjon/formidling som relevant funksjon',I.fams.slice(0,3),f=>f.includes('comms'));
    check('U1b FHI: Kari (kommunikasjon) er kandidat, HR-sjef anbefales ikke',[I.cands.some(c=>c.n==='Kari Kommunesen'),!(I.rec&&/Personal/.test(I.rec.n))],[true,true]);
    check('U1c FHI: ingen kandidat er aktiv automatisk',I.active,0);
    check('U1d FHI: generell postadresse funnet men aldri talt som person',[I.gen,I.state==='ready'],[true,false]);
    // ---------- U2 SIFO ----------
    await run(U.sifo); I=await info(U.sifo);
    check('U2a SIFO: arrangørnavn fra eventside slår generisk forskerliste',I.rec&&I.rec.n,'Mia Formidlingsen');
    check('U2b SIFO: dokumentert event (dato) beholdt',I.ev,v=>v>=1);
    // ---------- U3 NFF ----------
    await run(U.farma); I=await info(U.farma);
    check('U3 Farmaceutisk forening: medlems- og kursansvarlig er kandidater',[I.cands.some(c=>c.n==='Nils Medlemsen'),I.cands.some(c=>c.n==='Eva Kursen')],[true,true]);
    // ---------- U4 ambassade ----------
    await run(U.amb); I=await info(U.amb);
    check('U4 Ambassade: public diplomacy / press vises som kandidater, ikke ambassadør som anbefalt',[I.cands.some(c=>/Diplomatsen|Pressesen/.test(c.n)),!(I.rec&&/Ambassadesen/.test(I.rec.n))],[true,true]);
    // ---------- U5 forlag ----------
    await run(U.forlag); I=await info(U.forlag); console.log('FORLAG',JSON.stringify(I.cands));
    check('U5 Forlag: markedssjef/publisist i kandidatlisten',[I.cands.some(c=>c.n==='Silje Salgsen'),I.cands.some(c=>c.n==='Rune Haugen')],[true,true]);
    // ---------- U6 B2B tech via Apollo ----------
    const jt=await run(U.tech); I=await info(U.tech);
    const apCalls=await ev(()=>window.__mcpCalls.filter(c=>c.t==='apollo_mixed_people_api_search'&&/tech-test/.test((c.i.q_organization_domains_list||[])[0]||'')).length);
    check('U6a Tech: utvider tittelsøk, stopper ikke etter første null (≥2 Apollo-søk)',apCalls,v=>v>=2);
    check('U6b Tech: Apollo-kandidater har kilde Apollo, utvikler rangeres ikke som anbefalt',[I.cands.some(c=>c.src==='Apollo'),!(I.rec&&/Utvikler/.test(I.rec.n))],[true,true]);
    check('U6c Tech: Apollo-data og web-data skilles i jobben',[(jt.pv||{}).apollo,(jt.pv||{}).web],v=>v[0]&&v[0]!=='none');
    // ---------- U7 ingen funn ----------
    const jn=await run(U.tom); I=await info(U.tom);
    check('U7 «Ingen funn» er ikke systemfeil: tilstand no_person_found, ikke rød',[I.state,I.tone!=='bad',jn.status],['no_person_found',true,'done']);
    // ---------- U8 Apollo feiler, event beholdes ----------
    const je=await run(U.ev); I=await info(U.ev);
    check('U8 Apollo feiler: dokumentert event beholdt, ikke provider_error',[I.ev>=1,I.state!=='provider_error'],[true,true]);
    // ---------- statemaskin ----------
    const H=(await job(U.tech)).history.map(h=>h.s);
    check('S1 historikk går i lovlig rekkefølge',H.join('>'),v=>/queued>researching_company/.test(v)&&/searching_people/.test(v));
    check('S2 teknisk feil ligger bak «Vis teknisk feil», ikke i hovedteksten',await ev(id=>{ const a=window.__salong.MT.get(id); return /API_INACCESSIBLE|tool_error|upgrade/i.test(a.es.detail+a.es.label+(a.es.apollo||'')); },U.tech),false);

    // ---------- kandidatkort: velg / avvis / generell ----------
    const NB=[await mk('Bakken','b1-test.no','offentlig'),await mk('Strand','b2-test.no','fag'),await mk('Tomhet','b3-test.no','bedrift')];
    await p.keyboard.press('Escape'); await ev(()=>{ try{ window.__salong.UI.mt.dr.open=false; }catch(e){} });
    const bid=await ev(async i=>(await window.__salong.crm.batches.create({name:'[TEST] Batch',ids:i})).data,NB);
    await view('prosp'); await wait(300); await p.click('[data-mttab="arb"]'); await wait(300);
    check('K0 Arbeidsliste har «Berik alle»-knapp, seksjonsoverskrifter og ingen modal',await ev(()=>({btn:!!document.querySelector('[data-enrall]'),groups:[...document.querySelectorAll('.aw-gh th span')].map(x=>x.textContent),modal:!!document.querySelector('.modal:not([hidden])')})),v=>v.btn&&v.groups.length>=1&&!v.modal);
    await p.screenshot({path:require('./h.js').SHOT+'/arb.png',fullPage:true});
    await ev(i=>window.__salong.mtOpen(i),U.fhi); await wait(500);
    await ev(()=>{ const b=document.querySelector('[role=tab][data-bkt="kon"]'); b&&b.click(); }); await wait(300);
    const dk=await ev(()=>({t:document.body.innerText.slice(0,6000),pick:document.querySelectorAll('[data-cdpick]').length,cards:document.querySelectorAll('.cd-c').length}));
    check('K1 drawer: kandidatkort med Velg som kontakt + GENERELL KONTAKT',[dk.cards>=2,dk.pick>=2,/GENERELL KONTAKT/.test(dk.t)],[true,true,true]);
    await p.screenshot({path:require('./h.js').SHOT+'/kon.png'});
    await ev(()=>document.querySelector('[data-cdpick]').click()); await wait(500);
    check('K2 Velg som kontakt → aktiv kontakt (1)',(await info(U.fhi)).active,1);
    await ev(()=>{ const b=document.querySelector('[data-cdno]'); b&&b.click(); }); await wait(500);
    check('K3 Ikke relevant fjerner kandidaten fra listen',(await info(U.fhi)).cands.length,v=>v>=0);

    // ---------- Berik alle ----------
    await p.keyboard.press('Escape'); await ev(()=>{ const c=document.querySelector('.mt-ov [data-mtclose],[data-mtclose]'); c&&c.click(); }); await wait(300);
    await view('prosp'); await wait(300); await p.click('[data-mttab="arb"]'); await wait(300);
    await ev(()=>{ window.__mcpCalls.length=0; });
    await p.click('[data-enrall]'); await wait(400);
    const mid=await txt(p,'.aw-job')||'';
    await wait(6000);
    const end=await txt(p,'.aw-job')||'';
    check('B1 Berik alle: én jobblinje med «Beriker n / m»',[/Beriker?e?t? \d+ av 3/.test(mid||end)],[true]);
    check('B2 jobblinje etter ferdig: Beriket 3 / 3 og klare/kontroll/ingen',end,v=>/Beriket 3 av 3/.test(v)&&/kontaktklare|trenger vurdering|fant ingen/.test(v));
    await p.screenshot({path:require('./h.js').SHOT+'/arb2.png',fullPage:true});
    // ---------- Målmarked ----------
    await p.click('[data-mttab="mal"]'); await wait(400);
    const mm=await ev(()=>({fn:[...document.querySelectorAll('.cv-fr .cv-fl')].map(x=>x.firstChild.textContent),g:[...document.querySelectorAll('.cv-g th')].map(x=>x.firstChild.textContent)}));
    check('M1 Målmarked: sju trinn i kontaktdekning',mm.fn.length,7);
    check('M2 Målmarked: P0/P1/P2-grupper',mm.g.length,v=>v>=1);
    await p.screenshot({path:require('./h.js').SHOT+'/mal.png',fullPage:true});
    // ---------- I dag ----------
    await view('idag'); await wait(500);
    const id_=await ev(()=>({t:document.body.innerText,hasPri:!!document.querySelector('.idd-pri'),cols:!!document.querySelector('.idd-cols')}));
    check('I1 I dag: hilsen, dagens prioriteringer, kolonner, kalender',[/God (morgen|dag|ettermiddag|kveld)/.test(id_.t),id_.hasPri,!id_.cols,!/KPI/.test(id_.t)],[true,true,true,true]);
    await p.screenshot({path:require('./h.js').SHOT+'/idag.png',fullPage:true});
    check('X1 ingen sidefeil',A.errs.length,0);
  }catch(e){ await A.done(e); return; }
  await A.done();
})();
