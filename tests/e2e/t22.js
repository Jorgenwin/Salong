// Regression: operational action queue + logged signal transitions.
// All organizations and contacts are synthetic test fixtures.
const {setup,testSeed,navTo}=require('./h.js');
(async()=>{
  const seed=testSeed();
  seed.orgs={};seed.deals={};seed.acts={};seed.offers={};
  const today=new Date().toISOString().slice(0,10);
  const account=id=>({
    name:'[TEST] Kulturformidling '+id,website:'https://'+id+'.example.test',
    segId:'forlag',ownerId:'m-jorgen',place:'Oslo',
    ev:{level:'Confirmed',sources:[{url:'https://'+id+'.example.test/arrangement',label:'Testkilde'}]},
    seq:{enrolledAt:today,status:'active',stepsDone:[],cad:'T2'}
  });
  const extra={
    mtacc:{'t-calla':account('calla'),'t-callb':account('callb'),'t-callc':account('callc')},
    mtper:{
      't-pa':{accId:'t-calla',name:'Kari Testesen',title:'Arrangementsleder',email:'kari@calla.example.test',phone:'99000111',rel:'ja',active:true,source:'Manuell'},
      't-pb':{accId:'t-callb',name:'Ola Testesen',title:'Arrangementsleder',email:'ola@callb.example.test',phone:'99000222',rel:'ja',active:true,source:'Manuell'},
      't-pc':{accId:'t-callc',name:'Mia Testesen',title:'Arrangementsleder',email:'mia@callc.example.test',phone:'99000333',rel:'ja',active:true,source:'Manuell'}
    }
  };
  const A=await setup({seed,extra}),{p,check}=A; let err=null;
  try{
    await p.evaluate(()=>{ window.__salong.UI.incEx=true;window.__salong.UI.id.scope='team'; });
    await navTo(p,'idag',500);
    const before=await p.evaluate(()=>{
      const W=window.__salong;
      return {n:W.IDX.queue().shown.length,keys:W.IDX.queue().shown.map(i=>i.orgId),
        call:!!document.querySelector('[data-idquick^="acc:t-calla:steg"]'),
        className:!!document.querySelector('.idd-pri'),
        badge:document.querySelector('.idd-pri')?.textContent||''};
    });
    check('L01 I dag har maksimalt syv unike kontoer',[before.n<=7,new Set(before.keys).size===before.keys.length],[true,true]);
    check('L02 dagens neste handling viser samtale og enkel registrering',[before.className,/DAGENS PRIORITERINGER/.test(before.badge),before.call],[true,true,true]);

    // Never send an email: this button stores a real outbound call event and completes
    // the due phone step without invoking the generic step (which would double-log).
    await p.click('[data-idquick^="acc:t-calla:steg"][data-idquick$="|not_reached"]');
    await p.waitForFunction(()=>!window.__salong.UI.id.quickBusy,{timeout:12000});
    const after=await p.evaluate(()=>{
      const W=window.__salong, a=W.MT.get('t-calla');
      const acts=Object.values(W.S.acts).filter(x=>x.orgId==='t-calla'&&x.res==='not_reached');
      return {n:acts.length,type:acts[0]&&acts[0].type,dir:acts[0]&&acts[0].dir,
        done:a.seq.stepsDone.length,pt:a.pt};
    });
    check('L03 ett klikk lager nøyaktig én samtaleaktivitet og avanserer steget',
      [after.n,after.type,after.dir,after.done],[1,'call','out',1]);

    const stop=await p.evaluate(async()=>{
      const W=window.__salong;
      const reply=await W.MT.logTouch('t-calla',{ch:'epost',dir:'in',text:'Svar fra kontakt'});
      const bounce=await W.MT.logTouch('t-callb',{ch:'epost',dir:'out',res:'bounce'});
      const dnc=await W.MT.dnc('t-pc','Kontakt ønsket ingen flere henvendelser');
      return {reply,bounce,dnc,seq:['t-calla','t-callb','t-callc'].map(id=>{
        const a=W.MT.get(id);return {id,status:a.seq.status,reason:a.seq.unenrollReason,
          next:a.nx.k};
      }),due:W.TIER.due().map(x=>x.a.id),issues:W.IDX.items().filter(i=>i.accId==='t-calla').map(i=>i.rank)};
    });
    check('L04 innkommende svar stopper sekvens og løfter personlig oppfølging',
      [stop.seq[0].status,stop.seq[0].reason,stop.seq[0].next,stop.issues.includes(1)],['replied','reply','reply',true]);
    check('L05 bounce stopper sekvens og markerer Berik som neste handling',
      [stop.seq[1].status,stop.seq[1].reason,stop.seq[1].next],['bounced','bounce','enrich']);
    check('L06 opt-out stopper sekvens uten masseutsending',
      [stop.seq[2].status,stop.seq[2].reason,stop.due.length],['opt_out','opt_out',0]);
    const further=await p.evaluate(async()=>{ const W=window.__salong,a=W.MT.get('t-calla'),before=a.seq.stepsDone.length;
      await W.MT.step('t-calla',a.prog.next&&a.prog.next.i||0);
      return [before,W.MT.get('t-calla').seq.stepsDone.length];});
    check('L07 stoppede sekvenser kan ikke avanseres ved klikk',further,v=>v[0]===v[1]);
    check('L08 ingen runtime-feil',A.errs.length,0);
  }catch(e){err=e;}
  await A.done(err);
})();
