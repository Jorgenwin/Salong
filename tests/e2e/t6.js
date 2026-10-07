// Trinn 3 (runde 2): Kalender med statuslinje og analysepanel. Kjør: node t6.js
const {setup,testSeed,T0}=require('./h.js');
(async()=>{
  const seed=testSeed();
  Object.assign(seed.deals,{
   't-k1':{orgId:'t-nf',title:'[TEST] Bekreftet i Solstad',stage:'bekreftet',room:'solstad',date:'2027-02-09',attendees:200,pricing:'open',value:25000,recurring:1,source:'inbound',ownerId:'m-jorgen',notes:'',createdAt:T0,stageAt:T0,test:true},
   't-k2':{orgId:'t-nf',title:'[TEST] Holdt i Solstad',stage:'holdt',room:'solstad',date:'2027-02-11',attendees:200,pricing:'open',value:25000,recurring:1,source:'inbound',ownerId:null,notes:'',createdAt:T0,stageAt:T0,test:true},
   't-k3':{orgId:'t-nfo',title:'[TEST] Tilbud i Solstad',stage:'tilbud',room:'solstad',date:'2027-02-16',attendees:150,pricing:'open',value:25000,recurring:1,source:'inbound',ownerId:'m-phillip',notes:'',createdAt:T0,stageAt:T0,test:true},
   't-k4':{orgId:'t-nfo',title:'[TEST] Tapt i Solstad',stage:'tapt',room:'solstad',date:'2027-02-17',attendees:150,pricing:'open',value:25000,recurring:1,source:'inbound',ownerId:null,notes:'',createdAt:T0,stageAt:T0,test:true}});
  const bk=(id,o)=>({sourceSystem:'Testbooking',sourceId:id,organizerName:'[TEST] Ekstern arrangør',title:'[TEST] Importert '+id,attendees:50,value:10000,invoiced:null,paid:null,seriesId:'',importedAt:T0,extractAt:T0,...o});
  const A=await setup({ai:false,seed,extra:{bookings:{'b-1':bk('B1',{orgId:'t-nfo',room:'solstad',date:'2027-02-10',status:'bekreftet'}),'b-2':bk('B2',{orgId:null,room:'collett',date:'2027-02-10',status:'forelopig'}),'b-3':bk('B3',{orgId:'t-nf',room:'solstad',date:'2027-02-09',status:'bekreftet',dealId:'t-k1'}),'b-4':bk('B4',{orgId:'t-nf',room:'solstad',date:'2027-02-18',status:'avbestilt'})}}}), {p,store,check,txt,all}=A; let e0=null;
  const tiles=()=>p.$$eval('.cal-kpi .ku-t',e=>e.map(x=>x.querySelector('dt').textContent+':'+x.querySelector('dd').textContent));
  try{
  await p.click('[data-view="kalender"]'); await p.waitForTimeout(250); await p.click('[data-kltab="kap"]'); await p.waitForTimeout(250);
  check('C01 februar 2027 har 20 hverdager og seks nye rom',await p.evaluate(()=>{ const t=[...document.querySelectorAll('.cal-kpi .ku-t small')].map(x=>x.textContent); return t[3]; }),v=>/^av 120 romdager\. Ikke bekreftet ledighet$/.test(v));
  const base=await tiles();
  check('C02 statuslinje: bekreftet, holdt av, i dialog, uten registrering og utnyttelse',base.map(x=>x.split(':')[0]),['Bekreftet','Holdt av','I dialog eller tilbud','Uten registrering','Utnyttelse']);
  await p.selectOption('#calRoom','solstad'); await p.waitForTimeout(200);
  check('C03 Solstad: 2 bekreftet (sak + importert), 1 holdt, 2 i dialog eller tilbud (ett er eksempeldata), 15 uten registrering av 20 hverdager',await tiles(),['Bekreftet:2','Holdt av:1','I dialog eller tilbud:2','Uten registrering:15','Utnyttelse:15 %']);
  check('C03 koblet booking og sak samme dag telles én gang. Tapt sak og avbestilt booking telles ikke',await p.evaluate(()=>{ const c=q=>[...document.querySelectorAll('.cal tbody tr.focus td.day')].filter(td=>td.querySelector('.bk')).length; return c(); }),5);
  check('C04 importert booking vises i rutenettet, merket som importert',await p.$$eval('.cal .bk.imp',e=>e.map(x=>x.textContent)),v=>v.length===2&&v.every(x=>/\[TEST\]|Nordlys|Ekstern/.test(x)));
  check('C04 det står tydelig at dette ikke er ledighet fra bookingsystemet',await txt(p,'.cal2'),v=>/ikke koblet til bookingsystemet og viser ikke ledighet/.test(v)&&/Det er ikke bekreftet ledighet\. Sjekk bookingsystemet før du lover en dato/.test(v));
  check('C05 analysepanel: kommende hold og tilbud for valgt rom, med steg og ansvarlig',await all(p,'.cal2-side .cal-p:last-of-type .li'),v=>v.length>=2&&/11 feb\. · Solstad · Holdt av · Ufordelt/.test(v[0])&&/16 feb\. · Solstad · Tilbud sendt · Phillip/.test(v[1])&&v.every(x=>/Solstad/.test(x)));
  check('C06 romutnyttelse per rom, med valgt rom fremhevet',[await p.$$eval('.cal-u',e=>e.length),await p.$eval('.cal-u.on',e=>e.textContent.replace(/\s+/g,' ').trim()),await p.$eval('.cal-u.on',e=>e.getAttribute('aria-label'))],v=>v[0]===6&&v[1]==='Solstad3 av 20'&&v[2]==='Solstad: 2 bekreftet, 1 holdt av, 2 i dialog eller tilbud, 15 uten registrering, av 20 hverdager');
  check('C07 hull i Solstad: lengste strekk uten registrering, med datoer og antall hverdager',await all(p,'.cal2-under .cal-p:last-of-type .cal-w:first-of-type li'),v=>v.length===2&&v.includes('Solstad1 feb. til 8 feb.6 hverdager')&&v.includes('Solstad19 feb. til 26 feb.6 hverdager'));
  check('C07 dag 12. februar ligger alene mellom hold og helg, og 10. er booket: ingen enkeltdag meldes feil',await p.evaluate(()=>[...document.querySelectorAll('.cal2-under .cal-h3 + .cal-w li')].map(x=>x.textContent)),[]);
  await p.click('.cal tbody tr.focus [data-cd="2027-02-10"]'); await p.waitForTimeout(250);
  check('C08 valgt dag i panelet: alt som er registrert den dagen, på tvers av rom',await all(p,'.cal2-side .caldet .li'),v=>v.length===2&&v.some(x=>/Ekstern arrangør.*Collett.*importert booking.*Foreløpig/.test(x))&&v.some(x=>/Nordlys Forening.*Solstad.*importert booking.*Bekreftet/.test(x)));
  await p.click('.cal tbody tr.focus [data-cd="2027-02-12"]'); await p.waitForTimeout(250);
  check('C08 dag uten registrering: «Ny sak» tilbys, med forbehold om ledighet',await txt(p,'.cal2-side .caldet'),v=>/Ingenting registrert denne dagen/.test(v)&&/Ny sak i Solstad denne dagen/.test(v)&&/Ledighet må bekreftes i bookingsystemet/.test(v));
  await p.click('#calNew'); await p.waitForTimeout(250);
  check('C09 «Ny sak» åpner skjema med rom og dato fylt ut',[await p.$eval('[data-d="room"]',e=>e.value),await p.$eval('[data-d="date"]',e=>e.value)],['solstad','2027-02-12']);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.evaluate(()=>{ __salong.UI.drawer=null; document.querySelector('#drawer-root').innerHTML=''; });
  await p.click('[data-calroom="collett"]'); await p.waitForTimeout(200);
  check('C10 klikk på et rom i utnyttelsen bytter rom',[await p.$eval('#calRoom',e=>e.value),(await tiles())[1]],['collett','Holdt av:1']);
  await p.selectOption('#calRoom',''); await p.waitForTimeout(200);
  check('C11 alle viste rom: tallene summerer rommene',await p.evaluate(()=>{ const t=[...document.querySelectorAll('.cal-kpi dd')].map(x=>x.textContent), u=[...document.querySelectorAll('.cal-u .cal-uv')].map(x=>+x.textContent.split(' ')[0]).reduce((a,b)=>a+b,0); return [(+t[0])+(+t[1])===u,(+t[0])+(+t[1])+(+t[2])+(+t[3])]; }),[true,120]);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({path:require('./h.js').SHOT+'/cal.png',fullPage:true});
  for(const w of [1280,1024,390]){ await p.setViewportSize({width:w,height:850}); await p.waitForTimeout(250); check('C12 '+w+' px: ingen sideveis rulling av siden',await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true); }
  await p.setViewportSize({width:1440,height:900});
  check('C13 ingen KI er brukt',await p.evaluate(()=>__prompts.length),0);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
