// Regression: original /#idag is the work surface; never the separate /crm client.
// All companies and people below are synthetic. No external mail is sent.
const {setup,navTo,testSeed} = require('./h.js');
(async()=>{
  const seed=testSeed(), now=new Date().toISOString();
  seed.deals['test-today-inquiry']={
    orgId:'t-nf',title:'[TEST] Dagens forespørsel',stage:'ny',room:'wergeland',
    date:'2027-05-10',value:0,source:'inbound',createdAt:now,stageAt:now,
    ownerId:null,test:true
  };
  const row=(id,name,seg)=>({name,segId:seg,website:'https://'+id+'.example.org',
    domain:id+'.example.org',qual:{state:'qualified',reason:'Test fixture'},
    src:'test',test:true});
  const person=(id,name,phone)=>({accId:id,name,phone,email:'',
    title:'Arrangementsansvarlig',rel:'ja',active:true,source:'Test',test:true});
  const extra={mtacc:{
    'test-cult-1':row('test-cult-1','[TEST] Kulturforlag','forlag'),
    'test-cult-2':row('test-cult-2','[TEST] Bokstiftelse','ngo'),
    'test-comm-1':row('test-comm-1','[TEST] Eventbedrift','bedrift')
  },mtper:{
    'test-person-1':person('test-cult-1','Tove Test','22112233'),
    'test-person-2':person('test-cult-2','Kari Test','22445566'),
    'test-person-3':person('test-comm-1','Martin Test','22778899')
  }};
  const A=await setup({seed,extra,ai:false}),{p,check,errs,store}=A;
  const ev=(fn,arg)=>p.evaluate(fn,arg),wait=ms=>p.waitForTimeout(ms);
  let err=null;
  try{
    await navTo(p,'idag',300);
    const initial=await ev(()=>({
      url:location.hash, phases:[...document.querySelectorAll('.id27-step')].map(e=>e.textContent),
      hasOldTabs:!!document.querySelector('.id-tabs'), hasCulture:!!document.querySelector('[data-id27-kind="culture"]:checked'),
      hasAdmin:[...document.querySelectorAll('.id27-admin-row')].some(r=>/Dagens forespørsel/.test(r.textContent))
    }));
    check('TODAY01 old tabs gone, exactly two phases',initial,v=>v.url==='#idag'&&v.phases.length===2&&
      /RINGEØKT/.test(v.phases[0])&&/ADMIN-KØ/.test(v.phases[1])&&!v.hasOldTabs);
    check('TODAY02 incoming inquiry stays in admin',initial.hasAdmin,true);
    check('TODAY03 culture selected by default',initial.hasCulture,true);
    if(await p.locator('.id27-replenish').count()) await p.locator('.id27-replenish > summary').click();
    const state=await ev(()=>{const a=window.__salong.MT.all().filter(x=>/^test-(?:cult|comm)/.test(x.id));
      return a.map(x=>({id:x.id,q:x.flags.qualified,e:x.flags.enriched,phone:x.active[0]?.phone||''}));});
    check('TODAY04 test fixture contains three approved contact numbers',state,v=>v.length===3&&v.every(x=>x.q&&x.e&&x.phone));
    await p.check('[data-id27-kind="commercial"]');await wait(150);
    check('TODAY05 commercial segment can be selected without navigation',await ev(()=>[location.hash,document.querySelector('[data-id27-activate]')?.textContent||'']),
      v=>v[0]==='#idag'&&/PROSPEKT/.test(v[1]));
    await p.check('[data-id27-kind="culture"]');await wait(150);
    const before=await ev(()=>document.querySelector('[data-id27-activate]')?.textContent||'');
    check('TODAY06 culture batch includes two approved leads plus documented switchboards if available',before,v=>{const n=Number((v.match(/\((\d+) PROSPEKTER\)/)||[])[1]);return n>=2&&n<=20;});
    await p.click('[data-id27-activate]');
    await p.waitForFunction(()=>Object.keys(window.__salong.S.mtbat||{}).length>=1);
    await p.waitForFunction(()=>window.__salong.UI.id27.busy===false,null,{timeout:20000});
    await wait(200);
    const after=await ev(()=>{const W=window.__salong;
      return {url:location.hash,
        selected:W.MT.all().filter(a=>/^test-cult/.test(a.id)).map(a=>({cad:a.seq.cad,due:a.nx.due,k:a.nx.k})),
        commercial:W.MT.get('test-comm-1').seq.cad||'',
        count:Object.values(W.S.mtbat).find(b=>/Rolig kultursekvens/.test(b.name))?.accIds?.length||0,
        button:document.querySelector('[data-id27-start]')?.textContent||''};});
    check('TODAY07 batch and approved sequences activated on I dag',after,v=>v.url==='#idag'&&v.count>=2&&v.count<=20&&
      v.selected.every(x=>x.cad==='ID27_KULTUR'&&x.k==='step')&&!v.commercial&&/START ØKT/.test(v.button));
    await p.click('[data-id27-start]');await wait(150);
    check('TODAY08 distraction-free card runner opens',await ev(()=>[!!document.querySelector('.id27-runner[role="dialog"]'),
      !!document.querySelector('[data-id27-result="reached"]'),
      !!document.querySelector('.id27-call-link')]),[true,true,true]);
    await p.fill('[data-id27-note]','[TEST] Tok samtalen');
    await p.click('[data-id27-result="reached"]');await wait(600);
    check('TODAY09 call log and sequence progress saved via canonical records',await ev(()=>{
      const W=window.__salong,ids=['test-cult-1','test-cult-2'];
      const count=ids.filter(id=>W.MT.get(id).seq.stepsDone?.includes(0)).length;
      const logs=Object.values(W.S.acts).filter(a=>/Ringeøkt: Nådd/.test(a.text||'')).length;
      return [count,logs,!!document.querySelector('.id27-runner')];}),
      v=>v[0]===1&&v[1]>=1&&v[2]);
    await p.click('[data-id27-end]');await wait(200);
    check('TODAY10 closing session stays on I dag',await ev(()=>[location.hash,!!document.querySelector('.id27-work')]),['#idag',true]);
    check('TODAY11 no client errors',errs.length,0);
  }catch(e){err=e;}
  await A.done(err);
})();
