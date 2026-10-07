// Trinn 4 (runde 2): Posisjonering som forhåndsberegnet markedskart. Kjør: node t7.js
const {navTo,setup,testSeed}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed()}), {p,store,check,txt,all}=A; let e0=null;
  const hits=()=>p.$$eval('.mk-hit[data-mpv]',e=>e.map(x=>({id:x.dataset.mpv,a:x.getAttribute('aria-label').replace(/\s/g,' '),cy:+x.getAttribute('cy'),cx:+x.getAttribute('cx'),p:x.dataset.p.replace(/\s/g,' ')})));
  const plotted=async()=>(await hits()).filter(h=>/Publisert (romleie|dagpakke) /.test(h.a)).map(h=>h.id).sort();
  const lane=async()=>(await hits()).filter(h=>/Ikke plassert på prisaksen/.test(h.a)).map(h=>h.id).sort();
  const set=async kv=>{ await p.click('[data-mpset="'+kv+'"]'); await p.waitForTimeout(180); };
  const tiles=()=>p.$$eval('.mp-tiles>div',e=>e.map(x=>x.querySelector('dt').textContent+'='+x.querySelector('dd').childNodes[0].textContent.replace(/\s/g,' ')));
  const L=c=>Object.values(store[c]||{}).filter(x=>!x.deletedAt);
  try{
  const w0=A.writes.length;
  await p.click('[data-view="marked"]'); await p.waitForTimeout(350);
  check('P01 Oversikt åpnes først, og kartet ligger under Sammenligning',[await all(p,'.m3-tabs [data-mktab]'),await p.$eval('.m3-tabs [aria-selected="true"]',e=>e.textContent)],[['Oversikt','Sammenligning','Segmentfit','Læring fra saker'],'Oversikt']); await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(150); await p.click('.m3-sub [data-mktab="posisjonering"]'); await p.waitForTimeout(250);
  const H=await hits();
  check('P01 kartet er ferdig beregnet uten scenario: 14 lokaler er plassert, ingen scenarioer finnes, ingenting er skrevet',[H.length,L('mscen').length,L('malts').length,A.writes.length-w0],[14,0,0,0]);
  check('P02 Solstad står i kartet, fremhevet, med 320 i stolrader og uten pris',[(await p.$$('.mp-ring')).length,(await p.$$('.mp-guide')).length,H.find(h=>h.id==='solstad').a],v=>v[0]===1&&v[1]===1&&/^Litteraturhuset · Solstad, egne rom, vårt rom\. 320 i stolrader\. Ikke plassert på prisaksen: pris må innhentes\. 6 av 6 leveranseområder dokumentert\. Trykk for detaljer\.$/.test(v[2]));
  check('P02 etiketten for Solstad vises alltid',await all(p,'.mp-flab'),['Solstad · 320']);
  check('P03 romleie: bare lokaler med publisert romleie eks. mva står på prisaksen',await plotted(),['collett','forstander','hofmo','kverneland','marmor','skram','wergeland']);
  check('P03 resten står bare på kapasitetsaksen, med grunn',(await hits()).filter(h=>/Ikke plassert/.test(h.a)).map(h=>h.id+':'+h.p).sort(),['hand:Ingen publisert romleie','oslob:Pris må innhentes','rik:Pris må innhentes','solstad:Pris må innhentes','storo:Pris må innhentes','trek:Ingen publisert romleie','vega:Pris må innhentes']);
  const base=await p.evaluate(()=>{ const l=document.querySelector('.mp-base'); return +l.getAttribute('y1'); });
  check('P04 ingen uten pris er tegnet på eller over nullinjen: ukjent pris er aldri 0',(await hits()).filter(h=>/Ikke plassert/.test(h.a)).every(h=>h.cy>base+20),true);
  check('P04 alle med pris ligger over nullinjen',(await hits()).filter(h=>/Publisert romleie/.test(h.a)).every(h=>h.cy<base-5),true);
  check('P05 lokaler uten oppgitt kapasitet i stolrader står ikke i kartet, men i egen liste',await all(p,'.mp-chipb'),v=>v.length===6&&v.includes('Kulturhusetoppgitt 180 sittende, oppsett ikke spesifisert')&&v.includes('Samfunnssalenoppgitt 600 sittende, oppsett ikke spesifisert')&&v.includes('Hagerupoppgitt 60 sittende, oppsett ikke spesifisert'));
  check('P05 generelt maksimaltall er ikke brukt som kapasitet',[H.some(h=>h.id==='samf'||h.id==='kultur'),await txt(p,'.mp-nocap')],v=>v[0]===false&&/Et generelt maksimaltall brukes ikke som kapasitet i et bestemt oppsett/.test(v[1]));
  check('P06 nøkkeltall for Solstad er regnet ut',await tiles(),['Solstad i stolrader=320','Like store eller større=3 av 8','Nærmest i størrelse=Håndverkeren','Publisert pris=Ingen']);
  check('P06 nevneren er lokaler med oppgitt kapasitet, og de større er navngitt',await txt(p,'.mp-tiles>div:nth-child(2) small'),'andre lokaler med oppgitt kapasitet i stolrader: Marmorsalen, Oslo Kongressenter, Thon Hotel Storo');
  // dagpakke
  await set('basis:day');
  check('P07 dagpakke: bare publisert dagpakke inkl. mva er plassert. Trekanten (mva ukjent) er ikke med',[await plotted(),(await hits()).find(h=>h.id==='trek').p],[['forstander','hand','marmor'],'Mva-grunnlag ikke oppgitt']);
  check('P07 aksen sier per person inkl. mva, og romleie er ikke blandet inn',[await p.$$eval('.mp-chart .mk-axt',e=>e[0].textContent),(await hits()).find(h=>h.id==='marmor').p,(await hits()).find(h=>h.id==='wergeland').p],['Publisert dagpakke, kr per person inkl. mva','1 335 kr per person inkl. mva','Ingen publisert dagpakke']);
  await p.click('.mp-chipb[data-mpv="samf"]'); await p.waitForTimeout(200);
  check('P08 Samfunnssalen: 895 kr er merket historisk og står ikke i kartet',[await txt(p,'.mp-side .mp-prices'),await all(p,'.mp-side .mp-badges .cst'),await p.$$eval('.mp-tbl tbody tr',e=>e.filter(x=>/Samfunnssalen/.test(x.textContent)).map(x=>x.children[3].textContent))],v=>/895 kr per person mva-grunnlag ikke oppgitt Historisk/.test(v[0])&&/Gjelder gjennomføring i 2025/.test(v[0])&&v[1].includes('Pris fra 2025')&&v[2][0]==='Historisk pris fra 2025');
  await p.click('#mpBack'); await p.waitForTimeout(150); await set('basis:room');
  // klasserom
  await set('setup:classroom');
  check('P09 klasserom: Solstad går fra 320 til 150',[(await tiles())[0],(await hits()).find(h=>h.id==='solstad').a.match(/\d+ i klasserom/)[0],await all(p,'.mp-flab')],['Solstad i klasserom=150','150 i klasserom',['Solstad · 150']]);
  check('P09 lokaler uten klasseromstall forsvinner fra kartet, ikke til 0. Ambjørnsen (10 i klasserom) kommer inn',[(await hits()).map(h=>h.id).sort(),(await all(p,'.mp-chipb')).filter(x=>/^Marmorsalen|^Wergeland/.test(x))],[['ambjornsen','collett','forstander','hand','hofmo','kverneland','oslob','skram','solstad','storo'],['Wergeland200 i stolrader','Marmorsalen440 i stolrader']]);
  await set('span:d');
  check('P10 260–350 i klasserom: Solstad vises fortsatt, merket som under spennet. Lokaler uten klasseromstall regnes ikke som for små',[(await hits()).map(h=>h.id).sort(),await txt(p,'.mp-tiles>div:first-child small'),await txt(p,'.mp-fsum')],v=>JSON.stringify(v[0])==='["solstad","storo"]'&&/under spennet 260–350/.test(v[1])&&/Viser 8 av 20 lokaler\. Skjult: 12 for små for 260–350/.test(v[2]));
  await set('setup:theatre');
  check('P10 260–350 i stolrader: Solstad dekker ikke hele spennet, og spennet er tegnet',[await txt(p,'.mp-tiles>div:first-child small'),await txt(p,'.mp-spant'),(await hits()).map(h=>h.id).sort()],v=>/dekker ikke hele spennet 260–350/.test(v[0])&&v[1]==='260–350 deltakere'&&JSON.stringify(v[2])==='["hand","marmor","oslob","rik","solstad","storo"]');
  await set('span:');
  // kun verifiserte
  await p.check('#mpVer'); await p.waitForTimeout(200);
  check('P11 kun verifiserte: kildekonflikt, ukjent mva, historisk pris og kapasitet uten oppsett skjules',[(await hits()).map(h=>h.id).sort(),await txt(p,'.mp-fsum')],v=>!v[0].includes('marmor')&&!v[0].includes('trek')&&v[0].includes('solstad')&&v[0].includes('hand')&&/Skjult: 8 med forbehold/.test(v[1])&&/Verifisert betyr her: kapasitet i valgt oppsett er oppgitt med kilde, uten kildekonflikt, historisk pris eller ukjent mva/.test(v[1]));
  await p.uncheck('#mpVer'); await p.waitForTimeout(150);
  // pris må innhentes
  await set('basis:ask');
  check('P12 «Pris må innhentes»: bare lokaler uten brukbar pris, ingen prisakse',[(await hits()).map(h=>h.id).sort(),(await p.$$('.mp-base')).length,await txt(p,'.mp-fsum'),await txt(p,'.mp-map h2')],v=>JSON.stringify(v[0])==='["oslob","rik","solstad","storo","trek","vega"]'&&v[1]===0&&/Skjult: 12 har publisert pris/.test(v[2])&&v[3]==='Størrelse, uten pris');
  await set('basis:room');
  // arrangementstype
  await p.selectOption('#mpType','fagdag'); await p.waitForTimeout(200);
  check('P13 arrangementstype velger oppsett og prisgrunnlag, og sier at den ikke vurderer egnethet',[await p.$eval('[data-mpset="setup:classroom"]',e=>e.getAttribute('aria-pressed')),await p.$eval('[data-mpset="basis:day"]',e=>e.getAttribute('aria-pressed')),await txt(p,'.mp-fsum')],v=>v[0]==='true'&&v[1]==='true'&&/Fagdag velger oppsett og prisgrunnlag\. Grunnlaget sier ikke hvilke lokaler som egner seg for typen/.test(v[2]));
  await p.click('#mpReset'); await p.waitForTimeout(200);
  await set('who:egne');
  check('P14 egne rom: bare Litteraturhusets rom',(await hits()).map(h=>h.id).sort(),['collett','hofmo','kverneland','skram','solstad','wergeland']);
  await set('who:eksterne');
  check('P14 andre lokaler: Solstad står igjen som utgangspunkt',(await hits()).map(h=>h.id).sort(),['forstander','hand','marmor','oslob','rik','solstad','storo','trek','vega']);
  await set('who:alle');
  // sidepanel
  check('P15 sidepanelet viser Solstad før noe er klikket',[await txt(p,'.mp-side h3'),await all(p,'.mp-side .mp-badges .cst'),await txt(p,'.mp-side .mp-ask')],['Solstad',['Vårt utgangspunkt','Planlagt åpning februar 2027'],'Ingen publisert pris. Pris må innhentes. Salong anslår ingen pris for Solstad.']);
  await p.focus('.mk-hit[data-mpv="marmor"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  check('P16 tastatur: Enter på et punkt åpner detaljene og flytter fokus dit',[await txt(p,'.mp-side h3'),await p.evaluate(()=>document.activeElement.id),await p.$eval('.mk-hit[data-mpv="marmor"]',e=>e.getAttribute('aria-pressed')),(await p.$$('.mk-sel')).length],['Marmorsalen','mpSide','true',1]);
  check('P17 Marmorsalen: kildekonflikten er flagget, og grunnteknikk ved romleie er ikke satt som inkludert',[await all(p,'.mp-side .mp-badges .cst'),await p.$$eval('.mp-ft tr',e=>e[0].querySelector('td .cst').textContent),await txt(p,'.mp-vnote')],v=>v[0].includes('Kildekonflikt')&&v[1]==='Kildekonflikt'&&/Dette er en kildekonflikt, ikke en avklart inkludering/.test(v[2]));
  check('P17 «Hvordan Solstad skiller seg» er regnet ut fra tallene, uten vurderinger',await all(p,'.mp-how li'),v=>v[0]==='Solstad har 320 plasser i stolrader, Marmorsalen har 440. Det er 120 flere enn Solstad.'&&v.includes('Areal: Solstad 307 m², Marmorsalen 550 m².')&&v.some(x=>/^Solstad har ingen publisert pris\. Marmorsalen har publisert romleie 69 000 kr eks\. mva og dagpakke 1 335 kr per person inkl\. mva\. Prisnivået kan ikke sammenlignes før Solstad har en pris\.$/.test(x))&&v.includes('Solstad er planlagt åpnet februar 2027 og er ikke i drift ennå.')&&!v.some(x=>/bedre|best|billig|rimelig|premium|atmosfære/i.test(x)));
  check('P18 leveransen vises med kildens ord og Solstad ved siden av',await p.$$eval('.mp-ft tr',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim())),v=>v.length===6&&/^StrømmingTillegg«Tillegg»\. Strømming og strømmetekniker må bestilles\. Kilde ↗Solstad: tillegg \(«Tillegg»\)$/.test(v[4])&&/^Pause- og grupperomMå avklares«Må avklares»/.test(v[5]));
  check('P19 kilder: lenke til leverandørens side, åpnes i ny fane, med kontrolldato',await p.$$eval('.mp-src li',e=>e.map(x=>{ const a=x.querySelector('a'); return [a.href,a.target,a.rel,x.querySelector('.s').textContent]; })),v=>v.length===2&&v[0][0]==='https://www.sentralen.no/lokaler/marmorsalen'&&v[0][1]==='_blank'&&/noopener/.test(v[0][2])&&/^Kontrollert 5\. okt\. 2026/.test(v[0][3]));
  check('P19 datakvalitet sier hva som er kildebelagt, og at Salong ikke har hentet kildene på nytt',await all(p,'.mp-dq li'),v=>v[0]==='Kapasitet i stolrader: oppgitt med kilde'&&v.includes('Kildekonflikt')&&/Salong har ikke hentet dem på nytt/.test(v[v.length-1]));
  check('P20 nærmeste i størrelse for valgt lokale',await all(p,'.mp-near li'),v=>v.length===4&&/^Thon Hotel Storo · Storosalen400 i stolrader · 40 færre plasser · pris må innhentes$/.test(v[0]));
  await p.setViewportSize({width:1440,height:900}); await p.screenshot({path:require('./h.js').SHOT+'/mp_marmor.png',fullPage:true});
  check('P21 ved romleie står pakkeinnhold som «Bare i pakke», ikke som inkludert',await p.$$eval('.mp-ft tr',e=>e[1].querySelector('td .cst').textContent),'Bare i pakke');
  await set('basis:day');
  check('P21 samme lokale i dagpakke: teknikk og bemanning inngår i pakken, konflikten gjelder romleie',await p.$$eval('.mp-ft tr',e=>[e[0].querySelector('td .cst').textContent,e[1].querySelector('td .cst').textContent]),['Inngår i pakke','Inngår i pakke']);
  await set('basis:room'); await p.click('#mpBack'); await p.waitForTimeout(200);
  check('P21 «Tilbake til Solstad» viser utgangspunktet igjen',[await txt(p,'.mp-side h3'),await p.evaluate(()=>document.activeElement.id)],['Solstad','mpSide']);
  // størrelse og kategori
  const rr=await p.$$eval('.mp-chart svg .mp-n',e=>e.map(x=>({c:x.getAttribute('class'),r:+(x.getAttribute('r')||0),tag:x.tagName})));
  check('P22 form og farge følger kategori: sirkel egne, rombe kulturhus, firkant konferanse, trekant eventlokale',[rr.filter(x=>/mp-own/.test(x.c)).every(x=>x.tag==='circle'),rr.filter(x=>/mp-kultur/.test(x.c)).every(x=>x.tag==='path'),rr.filter(x=>/mp-konf/.test(x.c)).every(x=>x.tag==='rect'),rr.filter(x=>/mp-event/.test(x.c)).length],[true,true,true,1]);
  check('P22 størrelse følger dokumenterte leveranseområder: Solstad (6) er større enn Wergeland (0)',[rr.find(x=>/foc/.test(x.c)).r,Math.min(...rr.filter(x=>/mp-own/.test(x.c)).map(x=>x.r))],[13.5,6]);
  check('P22 forklaringen sier at kategori er Salongs sortering og at størrelse ikke er kvalitet',[await all(p,'.mp-legend .mp-lg:first-child>span'),await txt(p,'.mp-map>.note')],v=>JSON.stringify(v[0])===JSON.stringify(['Egne rom','Kulturhus og scene','Konferanse og hotell','Eventlokale'])&&/Aktørkategori er Salongs egen grovsortering, ikke leverandørenes betegnelse/.test(v[1])&&/sier ikke noe om kvalitet/.test(v[1]));
  // prishypotese
  const w1=A.writes.length;
  check('P23 prishypotesen er tom og tydelig merket',[await p.$eval('#mpHyp',e=>e.value),await txt(p,'.mp-hypbox label b'),(await p.$$('.mp-hyp')).length],['','Intern prishypotese – ikke tilbud eller godkjent pris',0]);
  await p.fill('#mpHyp','45000'); await p.press('#mpHyp','Enter'); await p.waitForTimeout(250);
  check('P24 hypotesen tegnes som åpen ring med merkelapp, og lagres ikke',[(await p.$$('.mp-hyp')).length,await txt(p,'.mp-hypt'),A.writes.length-w1,(await tiles())[3],await p.$$eval('.mp-tbl tbody tr',e=>e.filter(x=>/^Solstad/.test(x.textContent)).map(x=>x.children[3].textContent))],[1,'Intern prishypotese: 45 000 kr',0,'Publisert pris=Ingen',['Pris må innhentes']]);
  check('P24 Solstad står fortsatt uten pris i kartet',(await hits()).find(h=>h.id==='solstad').p,'Pris må innhentes');
  await set('basis:day');
  check('P25 hypotesen for romleie følger ikke med til dagpakke',[(await p.$$('.mp-hyp')).length,await p.$eval('#mpHyp',e=>e.value),await txt(p,'.mp-hypbox .note')],[0,'','Kroner per person inkl. mva. Tegnes i kartet som en åpen ring. Lagres ikke.']);
  await set('basis:room'); await p.click('#mpHypClr'); await p.waitForTimeout(200);
  check('P25 hypotesen kan fjernes',(await p.$$('.mp-hyp')).length,0);
  // annet eget rom
  await p.selectOption('#mpFocus','wergeland'); await p.waitForTimeout(250);
  check('P26 annet eget rom som utgangspunkt: publisert pris vises som referanse fra nettstedet, ikke som intern pris',[await tiles(),await txt(p,'.mp-tiles>div:nth-child(4) small'),await txt(p,'.mp-side .mp-prices+.note')],v=>v[0][0]==='Wergeland i stolrader=200'&&v[0][3]==='Publisert pris=18 600 kr'&&/romleie eks\. mva\. Publisert referanse, må bekreftes/.test(v[1])&&/ikke hentet fra en intern prisliste og er ikke et tilbud/.test(v[2]));
  check('P26 rabattert pris vises som betinget og er ikke plassert',[await txt(p,'.mp-side .mp-prices li:nth-child(2)'),(await hits()).find(h=>h.id==='wergeland').p],v=>/11 700 kr eks\. mva Betinget/.test(v[0])&&/ikke automatisk rabatt/.test(v[0])&&v[1]==='18 600 kr eks. mva');
  await p.selectOption('#mpFocus','solstad'); await p.waitForTimeout(250);
  // tabell
  const rows=await p.$$eval('.mp-tbl tbody tr',e=>e.map(x=>[...x.children].map(c=>c.textContent.replace(/\s+/g,' ').trim())));
  check('P27 tabellen har alle 20 lokaler, også de som ikke kan plasseres',[rows.length,rows.filter(r=>r[6]==='I kartet').length,rows.filter(r=>r[6]==='Bare på kapasitetsaksen').length,rows.filter(r=>r[6]==='Ikke i kartet').length],[20,7,7,6]);
  check('P27 ingen pris er 0 kr, og ingen kapasitet er 0',rows.some(r=>/^0 kr|^0$/.test(r[3])||r[2]==='0'),false);
  await p.click('.mp-tbl [data-mpv="hand"]'); await p.waitForTimeout(200);
  check('P28 klikk i tabellen åpner samme detaljer',[await txt(p,'.mp-side h3'),await txt(p,'.mp-side .lbl')],['Festsalen','Konferanse og hotell · Salongs sortering']);
  await p.click('#mpBack'); await p.waitForTimeout(150);
  // ingen rangering
  const whole=await txt(p,'.mk');
  check('P29 ingen median, optimal pris eller rangering',/median|optimal|anbefalt pris|rangering|billigst|rimeligst|premium/i.test(whole),false);
  check('P29 det står at dette er publiserte referanser og ikke hele markedet',await txt(p,'.mp-head'),v=>/10 andre lokaler og 10 egne rom fra researchgrunnlaget, kontrollert 5\. okt\. 2026\. Publiserte referanser, ikke tilbud og ikke hele markedet/.test(v));
  await p.click('#mpLim'); await p.waitForTimeout(150);
  check('P30 begrensningene i grunnlaget kan leses, ordrett',await all(p,'.mp-lim li'),v=>v.length===5&&v.includes('Tilgjengelig fasilitet betyr ikke at tjenesten er inkludert i valgt pris.'));
  await p.click('#mpLim'); await p.waitForTimeout(100);
  // kort og scenario finnes fortsatt
  check('P31 posisjoneringskortene ligger under kartet, ikke som tom startside',[await txt(p,'.mp-cardsec h2'),(await p.$$('#mkPosNew')).length,await p.evaluate(()=>document.querySelector('.mp-cardsec').getBoundingClientRect().top>document.querySelector('.mp-map').getBoundingClientRect().bottom)],['Posisjoneringskort',1,true]);
  await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(200);
  await p.click('#mcAdv'); await p.waitForTimeout(200); check('P32 scenarioverktøyet finnes fortsatt under Sammenlign, som avansert',(await p.$$('#mkNewScen')).length,1); await p.click('#mcAdv'); await p.waitForTimeout(150);
  await p.click('[data-mktab="posisjonering"]'); await p.waitForTimeout(200);
  // bredder
  for(const w of [1440,1280,1024,390]){ await p.setViewportSize({width:w,height:850}); await p.waitForTimeout(350);
    check('P33 '+w+' px: ingen sideveis rulling, kartet holder seg innenfor panelet, Solstad er merket',await p.evaluate(()=>{ const s=document.querySelector('.mp-chart svg').getBoundingClientRect(), c=document.querySelector('.mp-map').getBoundingClientRect(); return [document.scrollingElement.scrollWidth<=innerWidth,s.right<=c.right+1,document.querySelectorAll('.mp-flab').length,document.querySelectorAll('.mk-hit[data-mpv]').length]; }),[true,true,1,14]); }
  check('P34 mobil: treffflatene er minst 28 px',await p.$$eval('.mk-hit[data-mpv]',e=>Math.min(...e.map(x=>+x.getAttribute('r')*2))),v=>v>=28);
  await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(300);
  // lenke fra Kunnskap
  await navTo(p,'kunnskap',250); await p.click('[data-knt="marked"]'); await p.waitForTimeout(150); if(await p.$('#knAskYes')){ await p.click('#knAskYes'); await p.waitForTimeout(150); }
  await p.fill('#knQ','Hva koster Marmorsalen hos Sentralen?'); await p.click('#knForm button[type=submit]'); await p.waitForTimeout(600);
  const kn=await p.evaluate(()=>{ const b=[...document.querySelectorAll('.kb-hits li')].find(x=>/Sentralen · Marmorsalen/.test(x.textContent)); const k=b&&b.querySelector('[data-knsrc]'); if(k) k.click(); return !!k; }); await p.waitForTimeout(300);
  const go=await p.$('[data-mkgo][data-mkv="marmor"]');
  check('P35 kilden i Kunnskap har lenke til lokalet i kartet',[kn,!!go],[true,true]);
  if(go){ await go.click(); await p.waitForTimeout(350); check('P35 lenken åpner Posisjonering med Marmorsalen valgt',[await txt(p,'#vt'),await p.$eval('.m3-sub [aria-pressed="true"]',e=>e.textContent),await txt(p,'.mp-side h3')],['Marked og posisjon','Kart: kapasitet og pris','Marmorsalen']); }
  check('P36 ingen KI er brukt, og ingenting er skrevet til databasen i hele løpet',[await p.evaluate(()=>__prompts.length),A.writes.length-w0],[0,0]);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
