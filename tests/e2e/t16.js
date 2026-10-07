// Runde 16: kravtester for batch-uttak, I dag, Nytt siden sist, Kalender, Marked og posisjon. Kjør: node t16.js
const {navTo,setup,testSeed} = require('./h.js');
(async()=>{
  const seed=testSeed(), T=new Date().toISOString(), today=T.slice(0,10), d5=new Date(Date.now()-5*864e5).toISOString().slice(0,10);
  const ev0=(n,d)=>({event_name:'[TEST] '+n,event_type:'Konferanse',level:'Dokumentert',date:d,source_url:'https://x-test.no/'+n,source:'research'});
  const acc=(n,seg)=>({name:'[TEST] '+n,website:'https://'+n.toLowerCase()+'-test.no',domain:n.toLowerCase()+'-test.no',segId:seg,place:'Oslo',src:'import',test:true,enr:{event_signals:[ev0(n,'2026-12-01')],enriched_at:T}});
  const extra={mtacc:{'q-a':acc('Qa','fag'),'q-b':acc('Qb','fag'),'q-seq':{...acc('Seq','fag'),seq:{enrolledAt:d5,status:'active',stepsDone:[0]}}},
    mtper:{'q-seqp':{accId:'q-seq',name:'Nora Test',title:'Eventansvarlig',email:'nora@seq-test.no',rel:'ja',source:'Web'}}};
  // eksempeldata skal aldri påvirke I dag, kalender eller nøkkeltall
  seed.orgs['x-org']={name:'EKSEMPEL Org',segment:'Forlag',tier:'A',former:false,notes:'',website:'',contacts:[],example:true};
  seed.deals['x-d']={orgId:'x-org',title:'EKSEMPEL sak',stage:'ny',room:'collett',date:today,attendees:100,pricing:'open',value:99000,source:'inbound',ownerId:null,notes:'',createdAt:T,stageAt:T,example:true};
  seed.deals['x-d2']={orgId:'x-org',title:'EKSEMPEL bekreftet',stage:'bekreftet',room:'collett',date:today,attendees:100,pricing:'open',value:77000,source:'inbound',ownerId:null,notes:'',createdAt:T,stageAt:T,example:true};
  seed.acts['x-a']={orgId:'x-org',dealId:'x-d',type:'task',text:'EKSEMPEL oppgave',at:T,due:T,done:false,byId:'u1',byName:'Jørgen Test',ownerId:null,example:true};
  seed.deals['t-dn']={orgId:'t-nf',title:'[TEST] Ny henvendelse',stage:'ny',room:'collett',date:'2026-11-12',attendees:80,pricing:'open',value:15000,source:'inbound',ownerId:null,notes:'',createdAt:T,stageAt:T,test:true};
  seed.deals['t-dc']={orgId:'t-nfo',title:'[TEST] Dagens arrangement',stage:'bekreftet',room:'hofmo',date:today,attendees:40,pricing:'open',value:9000,source:'inbound',ownerId:null,notes:'',createdAt:T,stageAt:T,test:true};
  const A=await setup({ai:false,mcp:true,seed,extra}), {p,check,txt}=A; let e0=null;
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), view=async v=>{ await navTo(p,v,350); };
  try{
    // ---------- batch ----------
    check('G01 kvalifisert account er tilgjengelig for batch',await ev(()=>window.__salong.mtEligibility({}).pool.map(a=>a.id).filter(i=>/^q-/.test(i)).sort()),['q-a','q-b','q-seq']);
    const bid=await ev(async()=>(await window.__salong.crm.batches.create({name:'[TEST] B1',ids:['q-b']})).data);
    check('G02 account i aktiv batch kan ikke legges til en gang til (årsak: allerede i batch)',await ev(()=>{ const E=window.__salong.mtEligibility({}); return [E.pool.some(a=>a.id==='q-b'),E.ex.batch.some(x=>x.a.id==='q-b'),window.__salong.mtPick({n:50}).rows.some(a=>a.id==='q-b')]; }),[false,true,false]);
    // ---------- account åpnes ----------
    await view('prosp'); await wait(200);
    await ev(()=>window.__salong.mtOpen('q-a')); await wait(400);
    check('G03 account åpnes med fire faner og kompakt oversikt (maks seks rader)',await ev(()=>{ const r=document.querySelector('#mt-root'); return [[...r.querySelectorAll('[data-bkt]')].map(x=>x.textContent.trim().toUpperCase()).join(),r.querySelectorAll('.ov-r').length]; }),v=>/OVERSIKT,KONTAKTER,AKTIVITET,KILDER/.test(v[0])&&v[1]>=3&&v[1]<=4);
    await p.keyboard.press('Escape'); await wait(150);
    // ---------- I dag ----------
    await view('idag'); await wait(300);
    const id=await ev(()=>{ const P=document.querySelector('.idd-pri'), rows=P?[...P.querySelectorAll('.idd-r')]:[]; const K=k=>rows.filter(r=>r.textContent.includes(k)).map(r=>({t:r.textContent,b:[...r.querySelectorAll('button')].map(b=>b.textContent.trim())}));
      return {hello:document.querySelector('.idn-hd h2').textContent,out:K('OUTREACH'),enq:K('NY FORESPØRSEL'),meet:rows.filter(r=>!/NY FORESPØRSEL|OUTREACH|OPPFØLGING|KONTAKT TIL|SVAR FRA/.test(r.textContent)).map(r=>({t:r.textContent})),n:rows.length}; });
    check('G04 hilsen etter klokkeslett og navn',id.hello,v=>/^God (morgen|dag|kveld), Jørgen/.test(v));
    check('G05 dagens sekvenssteg ligger i Dagens prioriteringer som OUTREACH med Start outreach',[id.out.length>=1,id.out.some(x=>x.b.some(y=>/^Start outreach/.test(y)))],[true,true]);
    check('G06 ny forespørsel ligger i Dagens prioriteringer med Åpne',[id.enq.length>=1,id.enq.some(x=>x.b.some(y=>/^Åpne/.test(y)))],[true,true]);
    check('G07 dagens arrangement vises som kalenderrad',id.meet.some(x=>/Nordlys Forening/.test(x.t)),true);
    // ---------- Kalender ----------
    await view('kalender'); await wait(300);
    check('G09 Kalender har fire faner og viser saken på riktig dato (I dag)',await ev(()=>({tabs:[...document.querySelectorAll('.kl-tabs button')].map(b=>b.textContent),txt:document.querySelector('.kl-l')?document.querySelector('.kl-l').innerText:''})),v=>v.tabs.join()==='I dag,Uke,Måned,Kapasitet'&&/Nordlys Forening/.test(v.txt));
    await p.click('[data-kltab="mnd"]'); await wait(250);
    check('G10 månedsvisning: saken ligger i cellen for riktig dato',await ev(t=>{ const c=document.querySelector('[data-klday="'+t+'"]'); return !!c&&/Nordlys F/.test(c.innerText); },today),true);
    await p.click('[data-kltab="kap"]'); await wait(200); await p.click('[data-c3mode="salg"]'); await wait(300);
    check('G11 Kapasitet beholder dagens varmekart (romrutenett og nøkkeltall)',await ev(()=>[document.querySelectorAll('.c3-t tbody tr').length>=5,document.querySelectorAll('.c3-k').length>=3]),[true,true]);
    // ---------- Marked og posisjon ----------
    const before=await ev(()=>[window.__salong.MT.all().length,Object.keys(window.__salong.S.mtacc).length]);
    await view('marked'); for(const t of ['segmentfit','sammenlign','posisjonering','oversikt']){ await p.click('.m3-tabs [data-mktab="'+t+'"]').catch(()=>{}); await wait(200); }
    check('G12 Marked og posisjon oppretter ingen prospekter (samme antall accounts og dokumenter)',await ev(()=>[window.__salong.MT.all().length,Object.keys(window.__salong.S.mtacc).length]),before);
    await p.click('.m3-tabs [data-mktab="segmentfit"]'); await wait(250);
    const gap=await ev(()=>{ const b=document.querySelector('.mkg [data-mkgopen]'); return b?b.dataset.mkgopen:null; });
    check('G13 Markedsgap finnes og «Åpne segment i Prospekter» åpner riktig segment',gap!==null,true);
    if(gap){ await p.click('.mkg [data-mkgopen="'+gap+'"]'); await wait(400);
      check('G14 Prospekter er åpnet på Målmarked med segmentet valgt',await ev(()=>[window.__salong.UI.view,window.__salong.UI.mt.tab,window.__salong.UI.mt.seg]),['prosp','mal',gap]); }
    check('G15 «Lignende aktører vi ikke har» finnes ikke i Marked',await (async()=>{ await view('marked'); await p.click('.m3-tabs [data-mktab="segmentfit"]'); await wait(200); return ev(()=>/Lignende aktører/.test(document.body.innerText)); })(),false);
    // ---------- ingen dummy i nøkkeltall ----------
    // produksjonsmodus: eksempel- og testdata teller ikke (UI.incEx er testkroken som er av i produksjon)
    await ev(()=>{ window.__salong.UI.incEx=false; }); await view('idag'); await wait(300);
    check('G16 uten testkrok: eksempel- og testdata gir ingen oppgaver, forespørsler, I dag-rader eller kalenderoppføringer',await ev(()=>{ const W=window.__salong; const items=W.IDX.items().filter(i=>/EKSEMPEL|\[TEST\]/.test(i.org+i.action)).length; const body=document.querySelector('.idd-pri')?document.querySelector('.idd-pri').innerText:''; return [items,/EKSEMPEL|\[TEST\] Dagens|Ny henvendelse/.test(body)]; }),[0,false]);
    await view('kalender'); await wait(300);
    check('G17 kalenderen viser heller ikke eksempeldata uten testkrok',await ev(()=>/EKSEMPEL/.test(document.querySelector('.kl-l')?document.querySelector('.kl-l').innerText:'')),false);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
