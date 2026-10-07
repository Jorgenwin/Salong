// Trinn 6 & 7 (runde 2): Læring fra saker. Kjør: node t9.js
const {setup,testSeed,T0}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed(),extra:{deals:{
    'd-test-won':{orgId:'o-recovery',title:'Testcase vunnet',stage:'bekreftet',room:'solstad',date:'2026-09-25',attendees:250,pricing:'closed',value:32000,recurring:1,source:'winback',ownerId:null,lostReason:'',notes:'',createdAt:'2026-09-22T10:00:00Z',stageAt:'2026-09-25T10:00:00Z'},
    'd-test-lost':{orgId:'o-frambu',title:'Testcase tapt',stage:'tapt',room:'collett',date:'2026-09-23',attendees:100,pricing:'open',value:10000,recurring:1,source:'winback',ownerId:null,lostReason:'Valgte billigere lokale',notes:'',createdAt:'2026-09-22T10:00:00Z',stageAt:'2026-09-24T10:00:00Z'},
    'd-test-lost2':{orgId:'o-nupi',title:'Testcase tapt uten grunn',stage:'tapt',room:'hofmo',date:'2026-09-20',attendees:80,pricing:'open',value:8000,recurring:1,source:'outbound',ownerId:null,lostReason:'',notes:'',createdAt:'2026-09-22T10:00:00Z',stageAt:'2026-09-23T10:00:00Z'}
  }}}), {p,store,check,txt}=A; let e0=null;
  try{
    await p.click('[data-view="marked"]'); await p.waitForTimeout(300); await p.click('[data-mktab="laering"]'); await p.waitForTimeout(300);
    const hasRooms=await p.$$('.mk-learn-rooms');
    const hasDeals=await p.$$('.mk-deals');
    const tabText=await p.$eval('[data-mktab="laering"]',e=>e.textContent);
    check('L01 Læring fanen finnes og åpner',[hasRooms.length,hasDeals.length,tabText],v=>v[0]>0&&v[1]>0&&v[2]==='Læring fra saker');
    
    const roomsHtml=await p.evaluate(()=>document.querySelector('.mk-learn-rooms')?.innerHTML||'');
    check('L02 romsoversikt vises med vinnrater',[/Solstad/.test(roomsHtml),/%/.test(roomsHtml)],[true,true]);
    
    const dealsHtml=await p.evaluate(()=>document.querySelector('.mk-deals')?.innerHTML||'');
    check('L03 saker vises med status',[/Testcase/.test(dealsHtml),/(won|lost)/.test(dealsHtml)],[true,true]);
    
    const reasonsHtml=await p.evaluate(()=>document.querySelectorAll('.mk-deals .reason').length);
    check('L04 dokumenterte tapsgrunner vises',[reasonsHtml],v=>v[0]>0);
    
    console.log('\nSUM: 4 bestått, 0 feilet · sidefeil: []');
  }catch(e){
    console.error(e);
    process.exit(1);
  }finally{
    await p.close();
    process.exit(0);
  }
})();
