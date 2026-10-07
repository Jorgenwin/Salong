// Runde 17: Bølge 1 (153 researchede accounts) lastes som mtacc og fungerer i Prospekter. Kjør: node t17.js
const {navTo,setup,testSeed} = require('./h.js'); const fs=require('fs');
(async()=>{
  const docs=JSON.parse(fs.readFileSync(require('path').join(require('./h.js').ROOT,'data/research/wave1_docs.json'),'utf8'));
  const A=await setup({ai:false,mcp:true,seed:testSeed(),extra:{mtacc:docs}}), {p,check}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await ev(()=>{ window.__salong.UI.incEx=false; });
    await navTo(p,'prosp',600);
    const st=await ev(()=>{ const M=window.__salong.MT, L=M.all().filter(a=>a.src==='research'); return {n:L.length,q:L.filter(a=>a.flags.qualified).length,noSrc:L.filter(a=>!(a.prov&&a.prov.sources&&a.prov.sources.length)).length,wave:[...new Set(L.map(a=>a.wave))],kinds:[...new Set(L.map(a=>a.kind))],addr:L.filter(a=>a.flags.addressed||a.flags.enriched).length,persons:Object.keys(window.__salong.S.mtper).length}; });
    check('H01 alle 153 bølge 1-accounts leses inn som nye prospekter fra research',[st.n,st.wave,st.kinds],[153,['W1'],['ny']]);
    check('H02 hver account har kilde (research med kilde-URL og kontrolldato)',st.noSrc,0);
    check('H03 ingen kontaktpersoner er diktet opp (ingen personer lagret, ingen beriket/adressert)',[st.persons,st.addr],[0,0]);
    check('H04 kvalifiserte (med dokumentert eller sannsynlig eventsignal) er tilgjengelige for batch og forklares',await ev(()=>{ const E=window.__salong.mtEligibility({wave:'W1'}); return [E.pool.length>0,E.scope]; }),v=>v[0]&&v[1]===153);
    const t0=Date.now(); await ev(()=>window.__salong.MT.build()); 
    check('H05 funnel viser identifisert 153 + eksisterende profiler',await ev(()=>{ const s=window.__salong.MT.stats(); return s.discovered>=153; }),true);
    await p.click('[data-mttab="mal"]'); await wait(300);
    check('H06 segmenttabellen har 15 segmenter og summerer identifiserte',await ev(()=>{ const rows=[...document.querySelectorAll('[data-mtsegf]')]; return [rows.length, rows.reduce((s,r)=>s+Number(r.children[2].textContent.trim()||0),0)>=153]; }),[15,true]);
    check('H07 ingen sideveis rulling og ingen sidefeil med 153+ accounts',await ev(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),v=>v<=1);
    await p.click('[data-mttab="arb"]'); await wait(300);
    await p.screenshot({path:require('./h.js').SHOT+'/w1_arb.png'});
    await p.click('[data-mttab="mal"]'); await wait(300); await p.screenshot({path:require('./h.js').SHOT+'/w1_mal.png',fullPage:true});
  }catch(e){ e0=e; }
  await A.done(e0);
})();
