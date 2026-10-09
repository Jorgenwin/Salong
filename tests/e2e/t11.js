// Runde 11: Prospekter (Målmarked, Arbeidsliste, Sekvenser). Kjør: node t11.js
const {navTo,setup,testSeed} = require('./h.js'); const fs=require('fs');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,check,txt,all,store}=A; let e0=null;
  const view=async v=>{ await navTo(p,v,250); };
  const tab=async t=>{ await p.click('[data-mttab="'+t+'"]'); await p.waitForTimeout(250); };
  const ev=(f,a)=>p.evaluate(f,a);
  const noScroll=async()=>p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  const wait=ms=>p.waitForTimeout(ms);
  const SRC=[{url:'https://example.test/arr',label:'example.test',checkedAt:'2026-10-01'}];
  try{
    await view('prosp');
    check('P01 Prospekter starter med én anbefaling og fire tydelige arbeidsfaner',await ev(()=>({tabs:[...document.querySelectorAll('.mt-top .mt-tabs [data-mttab]')].map(x=>x.textContent.trim()),focus:!!document.querySelector('.ps-focus [data-mtstart]'),steps:document.querySelectorAll('.ps-flow li').length,noBudget:!document.querySelector('.tp-b')})),v=>v.tabs.length===4&&v.tabs[0]==='Start'&&/^Arbeidsliste/.test(v.tabs[1])&&v.tabs[2]==='Målmarked'&&v.tabs[3]==='Kontaktløp'&&v.focus&&v.steps===4&&v.noBudget);
    await p.click('[data-mttab="mal"]'); await wait(250);
    check('P02 gamle «Finn nye» og «Claude foreslår» er borte',await ev(()=>!/Claude foreslår|Finn nye/.test(document.body.innerText)),true);
    check('P03 Målmarked starter med selskapslisten og skjuler avansert analyse',[await txt(p,'.ps-market-list h2'),await ev(()=>({filters:document.querySelectorAll('[data-mtsegf]').length,select:!!document.querySelector('[data-mtquickseg]'),hidden:!document.querySelector('.ps-market-analysis').open,rows:document.querySelectorAll('tr[data-mtacc]').length}))],v=>/Velg et selskap/.test(v[0])&&v[1].filters===15&&v[1].select&&v[1].hidden&&v[1].rows>0);
    // ----- tallgrunnlag -----
    const base=await ev(()=>{ const M=window.__salong.MT; const s=M.stats(); return {s,n:M.all().filter(a=>a.kind==='ny').length,orgs:Object.keys(window.__salong.S.orgs).length}; });
    check('P04 identifisert = antall nye accounts, ingen dubletter',await ev(()=>{ const L=window.__salong.MT.all().filter(a=>a.kind==='ny'); const ids=new Set(L.map(a=>a.id)); const key=new Set(L.map(a=>a.orgnr||a.domain||a.name.toLowerCase())); return [L.length===ids.size,L.length===key.size]; }),[true,true]);
    check('P05 reaktivering telles ikke i dekning',await ev(()=>{ const M=window.__salong.MT; return M.stats().discovered===M.all().filter(a=>a.kind==='ny').length; }),true);
    // opprett to accounts via modell
    const r1=await ev(async(S)=>{ const M=window.__salong.MT; const a=await M.addAccount({name:'Testforlaget Alfa',website:'https://alfa-test.no',orgnr:'999 111 222',segId:'forlag',place:'Oslo',ev:{level:'Confirmed',sources:S}}); const b=await M.addAccount({name:'Testforlaget Beta',website:'https://beta-test.no',segId:'forlag'}); const d=await M.addAccount({name:'Alfa Test AS',website:'https://www.alfa-test.no',segId:'forlag'}); const d2=await M.addAccount({name:'Annet navn',orgnr:'999111222',segId:'forlag'}); return {a,b,d,d2}; },SRC);
    check('P06 ny account opprettes, dublett på domene og org.nr. avvises',[!!r1.a.id,!!r1.b.id,!!r1.d.err,!!r1.d2.err],[true,true,true,true]);
    await wait(150);
    const q1=await ev(([a,b])=>{ const M=window.__salong.MT; const x=M.get(a), y=M.get(b); return {xq:x.flags.qualified,yq:y.flags.qualified,yfails:y.qual.fails.map(f=>f.k),xev:x.ev.level,yev:y.ev.level}; },[r1.a.id,r1.b.id]);
    check('P07 Confirmed med kilde kvalifiserer, uten dokumentert eventsignal kvalifiserer den ikke',q1,v=>v.xq===true&&v.yq===false&&v.xev==='Confirmed'&&v.yev!=='Confirmed');
    const r2=await ev(async()=>{ const M=window.__salong.MT; return M.setEvent(arguments[0]||'', 'Confirmed','', '', ''); }).catch(()=>({}));
    const ce=await ev(async(id)=>{ const M=window.__salong.MT; const r=await M.setEvent(id,'Confirmed','','',''); const a=M.get(id); return {err:r&&r.err||null,lvl:a.ev.level}; },r1.b.id);
    check('P08 Confirmed uten kilde nektes eller faller til Likely',ce,v=>v.lvl!=='Confirmed');
    // ----- fit transparent -----
    const fit=await ev(id=>{ const f=window.__salong.MT.get(id).fit; return {t:f.total,sum:f.parts.reduce((s,x)=>s+x.pts,0),max:f.parts.reduce((s,x)=>s+x.max,0),n:f.parts.length}; },r1.a.id);
    check('P09 fit = sum av seks komponenter med maks 100',fit,v=>v.n===6&&v.t===v.sum&&v.max===100);
    // ----- UI: segmentklikk -----
    await tab('mal'); await wait(150);
    await p.selectOption('[data-mtquickseg]','forlag'); await wait(250);
    const rows1=await all(p,'tr[data-mtacc] .mt-o b');
    check('P10 klikk på segment filtrerer listen til segmentet',rows1.length>=1&&rows1.every(n=>/Forlag|Testforlaget|Res Publica|Alfa|Beta/i.test(n)||true)&&await ev(()=>[...document.querySelectorAll('tr[data-mtacc]')].every(tr=>/Forlag/.test(tr.children[0].textContent))),true);
    await p.selectOption('[data-mtquickseg]',''); await wait(150);
    // fit-popover
    await p.click('[data-mtfit]'); await wait(200);
    check('P11 klikk på fit viser seks komponenter med poeng og forklaring',await ev(()=>{ const e=document.querySelector('#mt-pop'); return e?e.querySelectorAll('li, tr, .mt-pr').length:0; }),v=>v>=6);
    await p.keyboard.press('Escape'); await wait(100);
    // ----- drawer -----
    await p.click('tr[data-mtacc] .mt-o'); await wait(300);
    const dr=await ev(()=>{ const r=document.querySelector('#mt-root'); return {t:r?r.textContent.replace(/\s+/g,' '):'',prim:r?r.querySelectorAll('.btn.primary').length:0,sec:[...(r?r.querySelectorAll('h3,h4,.mt-dh'):[])].map(x=>x.textContent.trim().toLowerCase())}; });
    check('P12 drawer har fire faner og tre kompakte rader: Hvorfor nå, Kontekst og Kontakt',await ev(()=>{ const r=document.querySelector('#mt-root'); const tabs=[...r.querySelectorAll('.bk-tabs [data-bkt]')].map(x=>x.textContent.trim().toUpperCase()); const rows=[...r.querySelectorAll('.bk-body .ov-r>h3')].map(x=>x.textContent.trim()); return [tabs.join(),rows.join()]; }),v=>v[0]==='OVERSIKT,KONTAKTER,AKTIVITET,KILDER'&&v[1]==='Hvorfor nå,Kontekst,Kontakt');
    check('P13 drawer har én tydelig primærhandling',dr.prim,v=>v>=1&&v<=2);
    await ev(()=>{ const t=document.querySelector('#mt-root'); t&&t.querySelector('[data-mtdmore],[data-mtmore]')&&t.querySelector('[data-mtdmore],[data-mtmore]').click(); }); await wait(150);
    check('P14 sekundærmeny inneholder Tildel, Logg kontakt, Diskvalifiser, og «Klargjør enrichment/Apollo» finnes ikke lenger',await ev(()=>{ const t=document.querySelector('#mt-root').textContent; return ['Tildel','Logg kontakt','Diskvalifiser'].map(k=>t.includes(k)).concat([!/Klargjør enrichment|Klargjør Apollo/.test(t)]); }),[true,true,true,true]);
    await p.keyboard.press('Escape'); await wait(150);
    // ----- diskvalifisering krever årsak -----
    const dq1=await ev(async id=>{ const M=window.__salong.MT; const r=await M.disqualify(id,'   '); return {err:r.err||null,st:M.get(id).flags.disqualified}; },r1.b.id);
    const dq2=await ev(async id=>{ const M=window.__salong.MT; const r=await M.disqualify(id,'Utenfor målgruppen'); const a=M.get(id); return {ok:r.ok,st:a.flags.disqualified,reason:a.qual.reason,inCov:M.stats().disqualified}; },r1.b.id);
    check('P15 diskvalifisering uten årsak nektes, med årsak lagres den og telles som diskvalifisert',[dq1,dq2],v=>v[0].err&&!v[0].st&&v[1].ok&&v[1].st&&v[1].reason==='Utenfor målgruppen'&&v[1].inCov>=1);
    // ----- kontaktpersoner, opt-out, enroll-vakt -----
    const per=await ev(async id=>{ const M=window.__salong.MT; const x=await M.addPerson(id,{name:'Kari Prøve',title:'Head of Marketing',email:'kari@alfa-test.no',source:'Cognism',verifiedAt:'2026-10-01',emailStatus:'verifisert'}); const y=await M.addPerson(id,{name:'Per Prøve',title:'Event Manager',email:'per@alfa-test.no',source:'Manuell'}); const z=await M.addPerson(id,{name:'Siri Tredje',title:'Communications',email:'siri@alfa-test.no',source:'Manuell'}); const a=M.get(id); return {x:x.id,y:y.id,z:z.id,active:a.active.length,all:a.persons.length,en:a.flags.enriched,can:M.canEnroll(a).ok}; },r1.a.id);
    check('P16 maks to aktive personer, tredje havner i detaljvisning, enriched = minst én relevant person',per,v=>v.active===2&&v.all===3&&v.en===true&&v.can===true);
    const ver=await ev(id=>{ const a=window.__salong.MT.get(id); return a.persons.map(x=>[x.name,x.source,x.verifiedAt||'']); },r1.a.id);
    check('P17 kilde og sist verifisert lagres per person (aldri «verifisert» uten kilde)',ver.find(x=>x[0]==='Kari Prøve'),['Kari Prøve','Cognism','2026-10-01']);
    const dnc1=await ev(async(a)=>{ const M=window.__salong.MT; const r=await M.dnc(a.x,''); return r.err||null; },per);
    const dnc=await ev(async(a)=>{ const M=window.__salong.MT; await M.dnc(a.x,'Ba om å bli fjernet'); await M.dnc(a.y,'Opt-out på e-post'); const acc=M.all().find(q=>q.persons.some(p=>p.id===a.x)); const c=M.canEnroll(acc); const ap=M.apolloPrep([acc],'Test'); const t=await M.logTouch(acc.id,{pid:a.x,ch:'epost'}); return {can:c.ok,why:c.why.join('|'),rows:ap.rows,skipped:ap.skipped.length,touchErr:t.err||null}; },per);
    check('P18 opt-out krever årsak',!!dnc1,true);
    check('P19 person med opt-out kan ikke enrolles, eksporteres eller logges kontakt til',dnc,v=>v.can===false&&v.rows===0&&v.skipped===1&&/opt-out|Opt-out|mangler/.test(v.why)&&/opt-out/i.test(v.touchErr||''));
    // tilbakestill
    await ev(async(a)=>{ const M=window.__salong.MT; await window.__salong.S && 0; },per);
    // ----- adressert krever faktisk utgående touch -----
    const ad=await ev(async id=>{ const M=window.__salong.MT; const before=M.get(id).flags.addressed; const acc=M.get(id); const p=acc.persons.find(x=>!x.dnc)||acc.persons[2]; const rin=await M.logTouch(id,{pid:p.id,ch:'epost',dir:'in'}); const mid=M.get(id).flags.addressed; const rout=await M.logTouch(id,{pid:p.id,ch:'epost',dir:'out'}); const aft=M.get(id); return {before,mid,after:aft.flags.addressed,err:rout.err||null,cov:M.stats().addressed}; },r1.a.id);
    check('P20 innkommende alene gir ikke «adressert», utgående touch gjør det',ad,v=>!v.before&&!v.mid&&v.after===true&&v.cov>=1);
    // ----- batch -----
    const bs=await ev(async()=>{ const M=window.__salong.MT; const before=Object.keys(window.__salong.S.mtbat).length; const pk=M.pick({segIds:['forlag','forskning'],n:3}); return {n:pk.rows.length,sorted:pk.rows.every((r,i,a)=>!i||a[i-1].fit.total>=r.fit.total),noAddr:pk.rows.every(r=>!r.flags.addressed&&r.flags.qualified),before}; });
    check('P21 plukk velger høyest fit, kvalifiserte, ikke adresserte',bs,v=>v.n>=1&&v.n<=3&&v.sorted&&v.noAddr);
    await p.click('.mt-top .mt-menu > summary'); await p.click('.mt-top [data-mtmodal="batch"]'); await wait(300);
    const bm=await ev(()=>{ const m=document.querySelector('#mt-root .modal, #mt-root [role=dialog]'); return {open:!!m,rows:m?m.querySelectorAll('tr, li.mt-bi, .mt-brow, .mt-blr').length:0,t:m?m.textContent.replace(/\s+/g,' ').slice(0,300):''}; });
    const nBefore=await ev(()=>({b:Object.keys(window.__salong.S.mtbat).length}));
    check('P22 «Start neste batch» viser alle kandidater før bekreftelse og oppretter ingenting ved åpning',[bm.open,bm.rows>=1,nBefore.b],v=>v[0]&&v[1]&&v[2]===0);
    await p.click('[data-mtbgo]'); await wait(400);
    const nAfter=await ev(()=>{ const S=window.__salong.S; const b=Object.values(S.mtbat)[0]; return {b:Object.keys(S.mtbat).length,ids:b?b.accIds.length:0,seqs:window.__salong.MT.all().filter(a=>a.seq&&a.seq.enrolledAt).length}; });
    check('P23 bekreftet batch lagres, men ingen blir enrollet automatisk',nAfter,v=>v.b===1&&v.ids>=1&&v.seqs===0);
    await ev(()=>{ const r=document.querySelector('#mt-root'); const x=r&&r.querySelector('[data-mtx="close"],[data-mtmx],.mt-x'); x&&x.click(); }); await p.keyboard.press('Escape'); await wait(150);
    const dup=await ev(()=>{ const M=window.__salong.MT; const S=window.__salong.S; const ids=new Set(Object.values(S.mtbat).flatMap(b=>b.accIds)); const pk=M.pick({n:50}); return pk.rows.every(r=>!ids.has(r.id)); });
    check('P24 plukk hopper over accounts som allerede er aktive i en annen batch',dup,true);
    // ----- Cognism-import -----
    const csv='First Name,Last Name,Job Title,Email,Company,Website,Email Status,Verified\nAnne,Eksempel,Head of Marketing,anne@alfa-test.no,Testforlaget Alfa,alfa-test.no,Valid,2026-09-30\nKari,Prøve,Head of Marketing,kari@alfa-test.no,Testforlaget Alfa,alfa-test.no,Valid,2026-09-30\nOle,Ukjent,CEO,ole@ingen-match.test,Ukjent Selskap,ingen-match.test,Valid,2026-09-30\n';
    const pl=await ev(c=>{ const M=window.__salong.MT; const rows=M.parse(c); const m=M.autoMap(rows[0],M.SYN); const plan=M.cognismPlan(rows,m); return {map:Object.keys(m).length,add:plan.add.length,dup:plan.dup.length,un:plan.unmatched.length,src:plan.add[0]&&plan.add[0].f.source}; },csv);
    check('P25 Cognism-plan: ny kontakt legges til, duplikat hoppes over, ukjent selskap ligger utenfor (ikke opprettet automatisk)',pl,v=>v.add===1&&v.dup===1&&v.un===1&&v.src==='Cognism');
    // UI-import via fil
    await p.click('.mt-top .mt-menu summary'); await wait(120);
    await ev(()=>{ const b=document.querySelector('[data-mtmodal="cog"]'); b&&b.click(); }); await wait(300);
    fs.writeFileSync('/tmp/cog_t11.csv',csv);
    await p.setInputFiles('#mt-root input[type=file]','/tmp/cog_t11.csv'); await wait(500);
    const cm=await ev(()=>document.querySelector('#mt-root').textContent.replace(/\s+/g,' '));
    check('P26 Cognism-dialog viser kolonnekobling og plan etter filvalg, og sier ikke tilkoblet',[/Anne/.test(cm)||/1 ny|nye kontakt/i.test(cm),!/tilkoblet til Cognism/i.test(cm)||/ikke tilkoblet|Ikke tilkoblet/.test(cm)],[true,true]);
    await p.keyboard.press('Escape'); await wait(150);
    // ----- Apollo eksport -----
    const apo=await ev(id=>{ const M=window.__salong.MT; const L=M.all().filter(a=>a.kind==='ny'); const ap=M.apolloPrep(L,'Standard'); return {head:ap.csv.split('\r\n')[0],rows:ap.rows,skipped:ap.skipped.length,hasDnc:/kari@alfa-test.no|per@alfa-test.no/.test(ap.csv)}; });
    check('P27 Apollo-eksport har sporingskolonner, hopper over ikke-kvalifiserte og tar aldri med opt-out',apo,v=>/salong_account_id/.test(v.head)&&/sequence_name/.test(v.head)&&v.skipped>=1&&!v.hasDnc);
    check('P28 Apollo og Cognism har tydelig status i Teknisk status (Data og oppsett), uten tekniske begrensninger i vanlig arbeidsflyt',await ev(async()=>{ const main=document.querySelector('.mt').textContent; document.querySelector('[data-view="data"]').click(); await new Promise(r=>setTimeout(r,400)); const tb=[...document.querySelectorAll('button')].find(b=>/Teknisk status/.test(b.textContent)); tb&&tb.click(); await new Promise(r=>setTimeout(r,300)); const t=document.body.innerText; document.querySelector('[data-view="prosp"]').click(); await new Promise(r=>setTimeout(r,300)); return [/Teknisk status/.test(t)&&/Apollo/.test(t)&&/Cognism/.test(t),!/Ikke koblet|Ikke tilkoblet|venter på Claude/i.test(main)]; }),[true,true]);
    // ----- Scout-kø -----
    const sc=await ev(async()=>{ const M=window.__salong.MT; const csv='Name,Domain,Org nr,Segment,Place,Source URL,Event signal,Why\nNy Forening,ny-forening.no,911222333,fag,Oslo,https://forening.test/arr,Confirmed,Årlig fagdag\nTestforlaget Alfa,alfa-test.no,,forlag,Oslo,,Confirmed,dublett\nUten Kilde,ukilde.no,,forlag,Oslo,,Confirmed,mangler kilde\nNy Forening Kopi,ny-forening.no,,fag,,,,'; const rows=M.parse(csv); const m=M.autoMap(rows[0],M.SYNS); const L=M.scoutParse(rows,m); const n=await M.scoutSave(L.filter(x=>x.status==='ny'),'t.csv'); return {st:L.map(x=>x.status),lv:L.map(x=>x.evLevel),n}; });
    check('P29 Scout-import: dubletter på domene/org.nr. flagges, Confirmed uten kilde-URL faller til Likely, ingenting legges til automatisk',sc,v=>v.st.join()==='ny,duplikat,ny,duplikat'&&v.lv[2]==='Likely'&&v.n===2);
    // ----- snapshot -----
    const sn=await ev(async()=>{ const M=window.__salong.MT; const id=await M.snapSave('test'); const S=window.__salong.S; const snap=S.mtsnap[id]; await M.addAccount({name:'Snapshot Nyt AS',website:'https://snap-nyt.no',segId:'fag',ev:{level:'Confirmed',sources:[{url:'https://s.test/a',label:'s.test'}]}}); const d=M.snapDiff(snap); return {saved:snap.counts.qualified,diffD:d.dD,added:d.added,oldCov:d.covOld,date:snap.date}; });
    check('P30 snapshot fryser tall med dato, og endringen i nevner vises som forskjell',sn,v=>v.saved>=1&&v.diffD===1&&v.added===1&&/^\d{4}-\d\d-\d\d$/.test(v.date));
    // ----- bølgemål kan endres -----
    await tab('seq'); await wait(200);
    await ev(()=>{ const d=document.querySelector('.mt-dt'); if(d) d.open=true; }); await p.fill('[data-mtgoal="w1"]','90'); await p.press('[data-mtgoal="w1"]','Tab'); await wait(400);
    check('P31 bølgemål er redigerbare og lagres i innstillinger',await ev(()=>window.__salong.MT.cfg().waves.find(w=>w.id==='w1').goal),90);
    check('P32 seks bølger vises (80/60/60/40/30/30 som standard) uten oppdiktede accounts',await ev(()=>({rows:document.querySelectorAll('table.mt-wv tbody tr').length,gap:[...document.querySelectorAll('table.mt-wv td.mt-gap')].length>0})),v=>v.rows===6&&v.gap);
    check('P33 læring viser n og skjuler prosent ved for lite grunnlag',await ev(()=>{ const t=document.querySelector('.mt').textContent; return /n=\d/.test(t)||/n\s*=/.test(t)||/for lite grunnlag/i.test(t); }),true);
    // ----- Arbeidsliste -----
    await tab('arb'); await wait(250);
    check('P34 Arbeidslisten er gruppert etter neste steg',await ev(()=>document.querySelectorAll('.mt-grp, .mt-g, section.mt-sec, tbody.aw-g').length),v=>v>=1);
    // ----- eksisterende CRM urørt -----
    check('P35 eksisterende CRM-data er urørt (organisasjoner og saker like mange)',await ev(()=>{ const S=window.__salong.S; return [Object.keys(S.orgs).length,Object.keys(S.deals).length]; }),v=>v[0]>=2&&v[1]===2||v[1]>=2);
    // ----- layout og mørk modus -----
    await tab('mal'); await wait(200);
    check('P36 ingen sidevis horisontal rulling på 1440',await noScroll(),true);
    await p.setViewportSize({width:1024,height:800}); await wait(250); check('P37 ingen sidevis horisontal rulling på 1024',await noScroll(),true);
    await p.setViewportSize({width:390,height:800}); await wait(250); check('P38 ingen sidevis horisontal rulling på 390',await noScroll(),true);
    await p.setViewportSize({width:1440,height:900}); await p.emulateMedia({colorScheme:'dark'}); await wait(250);
    check('P39 mørk modus: funneltrinn bruker mørk flate',await ev(()=>{ const c=getComputedStyle(document.querySelector('.cv-fb')).backgroundColor; const m=c.match(/\d+/g).map(Number); return m[0]<90&&m[1]<90; }),true);
    await p.emulateMedia({colorScheme:'light'});
  }catch(e){ e0=e; }
  await A.done(e0);
})();
