// I dag 2027: domain-preserving regression after removing the old week/month tabs.
const {setup,testSeed}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}),{p,check,store,txt}=A;
  const ev=(fn,arg)=>p.evaluate(fn,arg),wait=ms=>p.waitForTimeout(ms);
  const day=n=>{const d=new Date();d.setHours(10,0,0,0);d.setDate(d.getDate()+n);return d.toISOString();};
  const keys=()=>ev(()=>window.__salong.IDX.queue().vis.map(i=>i.key));
  let error=null;
  try{
    await p.click('[data-view="idag"]');await wait(200);
    check('Q01 dagsvisningen viser ringeøkt og admin-kø, ikke gamle tidshorisont-faner',
      await ev(()=>[...document.querySelectorAll('.id27-step')].map(x=>x.textContent)
        .concat([...document.querySelectorAll('[data-idtab]')].map(x=>'OLD:'+x.textContent))),
      v=>v.length===2&&/RINGEØKT/.test(v[0])&&/ADMIN-KØ/.test(v[1]));
    check('Q02 Mine og Teamet er fortsatt tilgjengelige',
      await ev(()=>[!!document.querySelector('[data-idsc="mine"]'),!!document.querySelector('[data-idsc="team"]')]),[true,true]);
    await A.remote('acts','t-late',{orgId:'t-nf',dealId:'t-d1',type:'task',text:'[TEST] Send oppdatert tilbud (forfalt)',at:day(-9),due:day(-2),done:false,ownerId:'m-jorgen'});
    await A.remote('acts','t-today',{orgId:'t-nf',dealId:'t-d1',type:'task',text:'[TEST] Ring om scenerigg i dag',at:day(-3),due:day(0),done:false,ownerId:'m-phillip'});
    await A.remote('acts','t-future',{orgId:'t-nf',dealId:null,type:'task',text:'[TEST] Langt fram',at:day(-1),due:day(20),done:false,ownerId:'m-jorgen'});
    await A.remote('deals','t-dny',{orgId:'t-nfo',title:'[TEST] Ny forespørsel uten ansvarlig',stage:'ny',room:'skram',date:'2027-03-01',attendees:40,value:9000,recurring:1,ownerId:null,createdAt:day(-3),stageAt:day(-3)});
    await wait(280);
    check('Q03 forfalt oppgave, frist i dag og ny forespørsel registreres, fremtidig venter',
      await keys().then(K=>[K.includes('task:t-late'),K.includes('task:t-today'),K.includes('deal:t-dny:ny'),K.includes('task:t-future')]),[true,true,true,false]);
    check('Q04 prioriteringsreglene er fremdeles deterministiske',
      await ev(()=>{const q=window.__salong.IDX.queue();return [q.shown.every((x,i)=>!i||q.shown[i-1].rank<=x.rank),q.shown.length<=7];}),[true,true]);
    check('Q05 admin-rad har ekte kunde og direkte handling',
      await ev(()=>[...document.querySelectorAll('.id27-admin-row')].some(x=>/Ny forespørsel/.test(x.textContent)&&!!x.querySelector('[data-id27-open]'))),true);
    await p.selectOption('#actAs','m-jorgen');await wait(250);
    check('Q06 egne oppgaver og kritiske ufordelte saker er i Mine',
      await keys().then(K=>[K.includes('task:t-late'),K.includes('deal:t-dny:ny'),K.includes('task:t-today')]),[true,true,false]);
    await p.click('[data-idsc="team"]');await wait(180);
    check('Q07 Teamet inkluderer Phillips oppgave',(await keys()).includes('task:t-today'),true);
    await p.click('[data-idsc="mine"]');await wait(120);
    const n0=Object.values(store.acts).filter(a=>a.type==='task').length;
    await ev(async()=>{const X=window.__salong.IDX,it=X.queue().all.find(x=>x.key==='task:t-late');if(!it)throw Error('missing overdue task');await X.done(it);});
    await wait(280);
    check('Q08 Ferdig bruker original oppgave, uten å lage kopi',
      [store.acts['t-late'].done,Object.values(store.acts).filter(a=>a.type==='task').length,(await keys()).includes('task:t-late')],[true,n0,false]);
    await p.click('[data-idsc="team"]');await wait(140);
    await A.remote('deals','t-dold',{orgId:'t-nf',title:'[TEST] Gammelt tilbud',stage:'tilbud',room:'collett',date:'2027-05-01',attendees:50,value:20000,recurring:1,ownerId:'m-jorgen',createdAt:day(-30),stageAt:day(-12)});
    await wait(200);
    check('Q09 et gammelt tilbud følger normal tilbudsregel',(await keys()).includes('deal:t-dold:tilbud'),true);
    const nActs=Object.keys(store.acts).length;
    await ev(async()=>{const X=window.__salong.IDX,it=X.queue().all.find(x=>x.key==='deal:t-dold:tilbud');if(!it)throw Error('missing offer followup');await X.done(it);});
    await wait(300);
    check('Q10 ferdig tilbud logger oppfølging på eksisterende sak',
      [Object.keys(store.acts).length-nActs,Object.values(store.acts).filter(a=>a.dealId==='t-dold'&&a.type==='note').length,store.deals['t-dold'].stage],[1,1,'tilbud']);
    await p.click('[data-id27-open="deal:t-dny:ny"]');await wait(260);
    check('Q11 admin-kø åpner den egentlige saken',!!(await p.$('.drawer')),true);
    await p.keyboard.press('Escape');await wait(120);
    // Goals, week calculations and monthly forecasts remain domain services,
    // not a second set of tabs on the operational home screen.
    const goal=await ev(async()=>{const now=new Date(),f=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
      const from=new Date(now.getFullYear(),now.getMonth(),1),to=new Date(now.getFullYear(),now.getMonth()+6,0);
      return window.__salong.crm.goals.update({type:'value',target:1200000,period_start:f(from),period_end:f(to)});});
    check('Q12 seksmånedersmålet kan fortsatt opprettes',goal.success,true);
    const weeks=await ev(()=>{const X=window.__salong.IDX,a=X.weekActual(0),t=X.weekTargets(a,null);
      return [typeof a.dial.n,typeof a.offers.n,t.dial>=a.dial.n,t.offers>=a.offers.n];});
    check('Q13 ukemål beregnes fra faktisk aktivitet og seksmånedersmål',weeks,['number','number',true,true]);
    const prevTasks=Object.values(store.acts).filter(a=>a.type==='task').length;
    await ev(async()=>{const X=window.__salong.IDX;await X.plan.save(X.plan.week(0),{goals:{dial:9},at:new Date().toISOString()});});
    await wait(250);
    check('Q14 planjustering lagres i settings, uten nye oppgaver',
      [Object.values((store.settings.main||{}).weekPlans||{}).some(x=>x.goals.dial===9),Object.values(store.acts).filter(a=>a.type==='task').length],[true,prevTasks]);
    await ev(async()=>{const X=window.__salong.IDX;await X.plan.clear?.(X.plan.week(0));});
    const month=await ev(async()=>{const M=(await window.__salong.crm.goals.getMonth()).data;return {
      ok:!!M.month&&typeof M.month.current_plan==='number',
      original:typeof M.month.original_plan==='number',
      forecast:typeof M.month.expected==='number',
      basis:M.chain.steps.filter(x=>x.basis).map(x=>x.basis.label)
    };});
    check('Q15 måned viser faktiske vs opprinnelige tall i domenetjenesten',month,v=>v.ok&&v.original&&v.forecast);
    check('Q16 prognosens historikkantakelser har kildemerking',month.basis,v=>v.length>0&&v.every(x=>x==='Faktisk historikk'||x==='Oppstartsantakelse'));
    await p.setViewportSize({width:390,height:850});await wait(150);
    check('Q17 ingen vannrett rulling på mobil',await ev(()=>document.scrollingElement.scrollWidth<=innerWidth+1),true);
    await p.setViewportSize({width:1440,height:900});
    check('Q18 ingen parallell I dag-datasamling ble opprettet',Object.keys(store).some(x=>/idag|today|workstation|arbeid/i.test(x)),false);
  }catch(e){error=e;}
  await A.done(error);
  // Standalone empty state: direct batch activation without redirect.
  const B=await setup({ai:false,seed:{orgs:{},deals:{},acts:{},offers:{},settings:{}}});
  let error2=null;const bp=B.p;
  try{
    await bp.click('[data-view="idag"]');await bp.waitForTimeout(180);
    B.check('R01 tom oppgavekø gir positiv ferdigstatus og direkte aktivering',
      await bp.evaluate(()=>[document.querySelector('.id27-success h2')?.textContent,!!document.querySelector('[data-id27-activate]'),location.hash]),['Alt utført for i dag!',true,'#idag']);
    B.check('R02 ingen knapp sender brukeren til Målmarked',
      await bp.evaluate(()=>!/Åpne Målmarked/.test(document.querySelector('.id27-work')?.textContent||'')),true);
    B.check('R03 én grønn primærhandling i tomtilstanden',
      await bp.evaluate(()=>document.querySelectorAll('.id27-work .id27-primary').length),1);
  }catch(e){error2=e;}
  await B.done(error2);
})();
