// Trinn 5 (runde 2): Sammenlign med smart start, foreslåtte alternativer og side om side. Kjør: node t8.js
const {setup,testSeed,T0}=require('./h.js');
(async()=>{
  const A=await setup({ai:false,seed:testSeed(),extra:{mpos:{'t-mp1':{need:'[TEST] Stort åpent arrangement',prop:'[TEST] egenskap',propKind:'dokumentert',value:'',wording:'[TEST] Godkjent formulering for test.',sources:[{ref:'[TEST] kilde'}],status:'godkjent',approvedAt:T0,approvedByName:'Test',test:true,createdAt:T0,updatedAt:T0}}}}), {p,store,check,txt,all}=A; let e0=null;
  const N=s=>String(s).replace(/\s+/g,' ').trim();
  const cols=()=>p.$$eval('.mc-tbl thead th b',e=>e.map(x=>x.textContent));
  const cell=(row,col)=>p.evaluate(([row,col])=>{ const tr=[...document.querySelectorAll('.mc-tbl tbody tr')].find(r=>r.querySelector('th')&&r.querySelector('th').childNodes[0].textContent.trim()===row); return tr?tr.children[col].textContent.replace(/\s+/g,' ').trim():'(mangler)'; },[row,col]);
  const set=async kv=>{ await p.click('[data-mcset="'+kv+'"]'); await p.waitForTimeout(180); };
  const alt=async id=>{ await p.click('.mp-chipb[data-mcalt="'+id+'"]'); await p.waitForTimeout(180); };
  const pressed=k=>p.$$eval('[data-mcset^="'+k+':"][aria-pressed="true"]',e=>e.map(x=>x.textContent));
  try{
  const w0=A.writes.length;
  await p.click('[data-view="marked"]'); await p.waitForTimeout(300); await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(300);
  check('S01 Sammenlign starter med Solstad, uten scenario',[await txt(p,'.mp-head h2'),await cols(),(await p.$$('#mkScen')).length,Object.keys(store.mscen||{}).length,A.writes.length-w0],['Sammenlign Solstad',['Solstad','Festsalen','Storscena','Sal B'],0,0,0]);
  check('S02 smart start: spennet følger rommets kapasitet (320 i stolrader gir 260–350)',[await pressed('span'),await txt(p,'.mc-side .sub')],[['260–350'],'260–350 deltakere · stolrader']);
  check('S02 oppsummeringen er regnet ut fra tallene',N(await p.$eval('.mc-sum',e=>e.childNodes[0].textContent)),'Solstad har 320 plasser i stolrader. Det dekker 260, men ikke 350. I grunnlaget har 5 av 8 andre lokaler med oppgitt kapasitet plass til minst 260: Marmorsalen, Håndverkeren, Riksscena, Oslo Kongressenter, Thon Hotel Storo.');
  check('S03 forslagene er de nærmeste i størrelse med oppgitt plass, og det står at det ikke er en rangering',[await p.$$eval('.mp-chipb.on',e=>e.map(x=>x.dataset.mcalt)),await txt(p,'.mc-start+.panel .sub'),await txt(p,'.mc-start+.panel .note')],v=>JSON.stringify(v[0].sort())==='["hand","oslob","rik"]'&&v[1]==='Foreslått av Salong · 3 av inntil 3'&&/nærmest Solstad i størrelse, blant dem med oppgitt plass til minst 260 i stolrader\. Det er ikke en rangering/.test(v[2]));
  check('S04 kapasitet og plass per kolonne',[await cell('Kapasitet i stolrader',1),await cell('Kapasitet i stolrader',2),await cell('Kapasitet i stolrader',4),await cell('Andre mål',1)],['320 Plass til 260, ikke 350','300 Plass til 260, ikke 350','393 Plass til hele spennet','150 i klasserom · 307 m²']);
  check('S05 Solstad har ingen pris, og ingen er anslått',[await cell('Romleie eks. mva',1),await cell('Dagpakke per person inkl. mva',1)],['Ingen publisert pris. Pris må innhentes','Ingen publisert dagpakke']);
  check('S05 dagpakke regnes bare ut for antallet lokalet har plass til, og utregningen vises',await cell('Dagpakke per person inkl. mva',2),v=>/^850 kr Publisert referanseDagpakke 1\. Under 30 personer kommer leietillegg\./.test(v)&&/For 260–300 deltakere \(lokalets kapasitet\): 221 000–255 000 kr inkl\. mva\. Utregnet som 850 kr × antall\.$/.test(v));
  check('S05 romleie og dagpakke står på hver sin rad, og det finnes ingen sumrad',[await all(p,'.mc-tbl tr.mc-g th'),await p.$$eval('.mc-tbl tbody tr>th[scope=row]',e=>e.map(x=>x.childNodes[0].textContent.trim()))],v=>v[0][1]==='Pris. Romleie og dagpakke er ulike produkter og legges ikke sammen'&&v[1].includes('Romleie eks. mva')&&v[1].includes('Dagpakke per person inkl. mva')&&!v[1].some(x=>/sum|total/i.test(x)));
  check('S06 leveranse: tilstand og kildens egne ord',[await cell('Rigg og oppsett',1),await cell('Lyd og bilde',2),await cell('Rigg og oppsett',3),await cell('Bemanning',2)],v=>/^Inkludert«Inkludert i normal leie»\. Rigg og rydding inngår normalt/.test(v[0])&&/^I pakke«Inkludert i dagpakke»/.test(v[1])&&v[2]==='Ikke dokumentert'&&/^Må avklares«Ikke spesifisert»/.test(v[3]));
  check('S07 usikkerhet og mangler per lokale',[await cell('Usikkerhet og mangler',1),await cell('Usikkerhet og mangler',3)],['Pris må innhentesIkke i drift før februar 2027','Pris må innhentes3 av 6 leveranseområder er ikke dokumentert']);
  check('S07 kilder med lenke og kontrolldato',await p.$$eval('.mc-tbl tbody tr:last-child td',e=>e.map(x=>[x.querySelectorAll('a[target=_blank]').length,x.querySelector('.s').textContent])),v=>v.length===4&&v[0][0]===3&&v.every(x=>x[0]>=1&&x[1]==='Kontrollert 5. okt. 2026'));
  // egne valg
  await alt('oslob'); await alt('marmor');
  check('S08 eget valg: Marmorsalen inn, og det står at du har valgt selv',[await cols(),await txt(p,'.mc-start+.panel .sub')],[['Solstad','Festsalen','Storscena','Marmorsalen'],'Valgt av deg · 3 av inntil 3']);
  check('S08 Marmorsalen: romleie med forbehold, og grunnteknikk står som kildekonflikt',[await cell('Romleie eks. mva',4),await cell('Lyd og bilde',4),await cell('Usikkerhet og mangler',4)],v=>/^69 000 kr Publisert referanseRomleie\. Publisert rompris\. Samme side gir motstridende opplysninger/.test(v[0])&&/^Kildekonflikt«Inkludert i dagpakke»/.test(v[1])&&/^Kildekonflikt/.test(v[2]));
  check('S08 Marmorsalen dagpakke: 1 335 × 260–350',await cell('Dagpakke per person inkl. mva',4),v=>/For 260–350 deltakere: 347 100–467 250 kr inkl\. mva\. Utregnet som 1 335 kr × antall\./.test(v));
  await alt('trek'); await p.waitForTimeout(150);
  check('S09 høyst tre alternativer: et fjerde avvises med beskjed',[await cols(),await txt(p,'.toast')],v=>v[0].length===4&&!v[0].includes('Hallen')&&/Høyst tre alternativer side om side/.test(v[1]));
  await alt('hand'); await alt('trek'); await alt('rik'); await alt('samf');
  check('S10 Trekanten: 820 kr med ukjent mva brukes ikke og regnes ikke ut',await cell('Dagpakke per person inkl. mva',3),v=>/^820 kr mva-grunnlag ikke oppgitt Mva ikke oppgitt/.test(v)&&/Brukes ikke i sammenligningen\.$/.test(v)&&!/For 2/.test(v));
  check('S10 Samfunnssalen: 2025-pris er historisk, kapasitet per oppsett er ikke oppgitt',[await cell('Dagpakke per person inkl. mva',4),await cell('Kapasitet i stolrader',4),await cell('Kapasitet i stolrader',3)],v=>/^895 kr mva-grunnlag ikke oppgitt Historisk/.test(v[0])&&/Brukes ikke i sammenligningen\.$/.test(v[0])&&v[1]==='Ikke oppgittOppgitt 600 sittende uten spesifisert oppsett Kapasitet ikke oppgitt'&&v[2]==='170 For liten');
  await p.click('#mcAuto'); await p.waitForTimeout(200);
  check('S11 «Tilbake til forslagene» henter forslagene igjen',await cols(),['Solstad','Festsalen','Storscena','Sal B']);
  // hurtigvalg
  await set('span:a');
  check('S12 80–120: Solstad har plass til hele spennet, og forslagene er fortsatt de nærmeste i størrelse',[await cell('Kapasitet i stolrader',1),await cols(),await cell('Dagpakke per person inkl. mva',2)],v=>v[0]==='320 Plass til hele spennet'&&JSON.stringify(v[1])==='["Solstad","Festsalen","Storscena","Sal B"]'&&/For 80–120 deltakere: 68 000–102 000 kr inkl\. mva/.test(v[2]));
  await p.reload(); await p.waitForTimeout(700); await p.click('[data-view="marked"]'); await p.waitForTimeout(300); await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(300);
  await set('type:fagdag');
  check('S13 Fagdag setter klasserom. Solstad går til 150, og spennet følger med til 120–180',[await pressed('setup').catch(()=>[]),await pressed('span'),await cell('Kapasitet i klasserom',1),await cols(),await txt(p,'.mc-sum .note')],v=>JSON.stringify(v[1])==='["120–180"]'&&v[2]==='150 Plass til 120, ikke 180'&&JSON.stringify(v[3])==='["Solstad","Festsalen","Sal B","Storosalen"]'&&/Fagdag setter oppsettet til klasserom\. Grunnlaget sier ikke hvilke lokaler som egner seg for typen/.test(v[4]));
  await set('type:fagdag');
  check('S13 arrangementstypen kan slås av igjen',[await pressed('type'),(await p.$$('.mc-sum .note')).length],[[],0]);
  // finjustering
  await p.click('#mcFine'); await p.waitForTimeout(150); await set('setup:theatre');
  await p.fill('#mcN','300'); await p.press('#mcN','Tab'); await p.waitForTimeout(250);
  check('S14 nøyaktig antall: 300',[await cell('Kapasitet i stolrader',1),await cell('Kapasitet i stolrader',2),await cell('Dagpakke per person inkl. mva',2),await pressed('span'),await txt(p,'.mc-side .sub')],v=>v[0]==='320 Plass til 300'&&v[1]==='300 Plass til 300'&&/For 300 deltakere: 255 000 kr inkl\. mva\. Utregnet som 850 kr × antall\./.test(v[2])&&v[3].length===0&&v[4]==='300 deltakere · stolrader');
  await p.check('[data-mcneed="staff"]'); await p.waitForTimeout(200);
  check('S15 krav: Bemanning merkes som krav, og manglende dokumentasjon kommer opp under usikkerhet',[await p.$$eval('.mc-tbl tr.need th',e=>e.map(x=>x.textContent)),await cell('Usikkerhet og mangler',2),await cell('Usikkerhet og mangler',1)],v=>v[0][0]==='BemanningKrav'&&/Bemanning: må avklares/.test(v[1])&&!/Bemanning/.test(v[2]));
  const w1=A.writes.length;
  await p.fill('#mcHyp','45000'); await p.press('#mcHyp','Tab'); await p.waitForTimeout(250);
  check('S16 intern prishypotese vises merket i Solstad-kolonnen, og lagres ikke',[await cell('Romleie eks. mva',1),A.writes.length-w1,await txt(p,'.mc-fine>.note')],['Ingen publisert pris. Pris må innhentesIntern prishypotese: 45 000 kr. Ikke tilbud eller godkjent pris.',0,'Prishypotesen er intern, ikke tilbud eller godkjent pris. Den lagres ikke.']);
  // kapasitetsfigur
  check('S17 med 300 deltakere faller Riksscena (283) ut av forslagene. Søyler med terskel, og tekst for skjermleser',[await p.$eval('.mc-bars',e=>e.getAttribute('aria-label')),(await p.$$('.mc-fill.own')).length,(await p.$$('.mc-bar')).length,(await p.$$('.mc-bar:first-child .mc-mark')).length,await all(p,'.mc-bv')],['Kapasitet i stolrader: Solstad 320, Håndverkeren 300, Oslo Kongressenter 393, Thon Hotel Storo 400. Deltakere: 300.',1,4,1,['320','300','393','400']]);
  // forskjeller
  check('S18 dokumenterte forskjeller per alternativ, uten vurderinger',[await all(p,'.mc-diff h3'),await all(p,'.mc-diff:first-child li')],v=>JSON.stringify(v[0])==='["Solstad og Håndverkeren","Solstad og Oslo Kongressenter","Solstad og Thon Hotel Storo"]'&&v[1][0]==='Solstad har 320 plasser i stolrader, Håndverkeren har 300. Det er 20 færre enn Solstad.'&&!v[1].some(x=>/bedre|best|billig|rimelig|sterkere|premium/i.test(x)));
  // forespørselstekst
  await p.click('[data-mcset="type:konferanse"]'); await p.waitForTimeout(200);
  const brief=await p.$eval('#mcBrief',e=>e.value), names=Object.values(store.orgs).map(o=>o.name).filter(Boolean);
  check('S19 forespørselsteksten bygges av valgene, med krav merket',brief,v=>/^Forespørsel om lokale til konferanse for 300 deltakere, oppsett stolrader\./.test(v)&&/4\. Bemanning og tekniker \(krav\)\./.test(v)&&/1\. Romleie eks\. mva, leietid og hva leien inkluderer\./.test(v));
  check('S19 ingen kundenavn, saker eller priser i teksten',[names.length>0,names.some(n=>brief.includes(n)),/\d{2}[  ]?\d{3} kr|45[  ]?000/.test(brief),await txt(p,'#mcBrief+.row .note')],v=>v[0]===true&&v[1]===false&&v[2]===false&&/Kundenavn, saker, notater og priser er ikke med\. Salong sender ingenting/.test(v[3]));
  // godkjente argumenter
  check('S20 egne styrker er bare godkjente kort. Salong skriver ingen selv',await all(p,'.mc-args li'),['[TEST] Godkjent formulering for test.[TEST] Stort åpent arrangement · TESTDATA']);
  // eget rom som alternativ
  await alt('oslob'); await alt('wergeland');
  check('S21 eget rom som alternativ: publisert pris og betinget rabatt hver for seg',await cell('Romleie eks. mva',4),v=>/^18 600 kr Publisert referanseOrdinær romleie\./.test(v)&&/11 700 kr BetingetRabattert romleie\. Kvalifikasjon etter Litteraturhusets vilkår, ikke automatisk rabatt\./.test(v));
  await p.click('#mcAuto'); await p.waitForTimeout(150);
  // til kartet
  await p.click('[data-mcmap="storo"]'); await p.waitForTimeout(300);
  check('S22 «Se i kartet» åpner Posisjonering med lokalet valgt',[await p.$eval('.m3-sub [aria-pressed="true"]',e=>e.textContent),await txt(p,'.mp-side h3')],['Kart: kapasitet og pris','Storosalen']);
  await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(250);
  // kortutkast
  const nP=Object.keys(store.mpos).length; await p.click('[data-mccard="hand"]'); await p.waitForTimeout(350);
  const form=await p.$$eval('.mk-posf [data-mkp]',e=>Object.fromEntries(e.map(x=>[x.dataset.mkp,x.value])));
  check('S23 kortutkast fra sammenligningen: fakta, kilder og sammenligningsgrunnlag er fylt ut, formuleringen er tom',form,v=>v.need==='Konferanse for 300 deltakere'&&v.prop==='Solstad har 320 plasser i stolrader, 150 i klasserom og 307 m². Planlagt åpning februar 2027.'&&v.wording===''&&/^Litteraturhuset · Solstad: https:\/\/www\.litteraturhuset\.no\/nb\/rom\/solstad \(kontrollert 5\. okt\. 2026\)/.test(v.srcText)&&/^Sammenlignet med Håndverkeren · Festsalen i Salong\. Solstad har 320 plasser i stolrader, Håndverkeren har 300\./.test(v.compareRef));
  check('S23 ingenting er lagret før du lagrer selv',Object.keys(store.mpos).length-nP,0);
  await p.click('#mkPosSave'); await p.waitForTimeout(500);
  const card=Object.values(store.mpos).find(c=>c.from&&c.from.type==='sammenligning');
  check('S24 lagret som utkast med kobling til grunnlaget, og kan ikke godkjennes uten formulering',[!!card,card&&card.status,card&&card.from.alt,card&&card.from.focus,await p.$$eval('[data-mkpok]',e=>e.filter(x=>x.disabled).length)],[true,'utkast','hand','solstad',1]);
  await p.click('[data-mktab="sammenlign"]'); await p.waitForTimeout(250);
  // avansert
  check('S25 scenarioverktøyet ligger under Avansert og er lukket til du åpner det',[await txt(p,'.mc-adv h2'),(await p.$$('#mkNewScen')).length,await p.$eval('#mcAdv',e=>e.getAttribute('aria-expanded'))],['Avansert: eget scenario',0,'false']);
  await p.click('#mcAdv'); await p.waitForTimeout(250);
  check('S25 åpnet: scenario kan lages som før',[(await p.$$('#mkNewScen')).length,(await p.$$('#mkScen')).length,(await p.$$('#mkDeal')).length,await txt(p,'.mc-adv .empty')],v=>v[0]===1&&v[1]===1&&v[2]===1&&/Hurtigsammenligningen over trenger ikke scenario/.test(v[3]));
  await p.click('#mcAdv'); await p.waitForTimeout(200);
  // annet rom
  await p.selectOption('#mcFocus','wergeland'); await p.waitForTimeout(300);
  check('S26 annet eget rom: spenn og forslag følger rommet',[await txt(p,'.mp-head h2'),await pressed('span'),await cols(),await cell('Romleie eks. mva',1)],v=>v[0]==='Sammenlign Wergeland'&&JSON.stringify(v[1])==='["180–260"]'&&JSON.stringify(v[2])==='["Wergeland","Kino EN","Storscena","Festsalen"]'&&/^18 600 kr Publisert referanse/.test(v[3]));
  await p.selectOption('#mcFocus','solstad'); await p.waitForTimeout(250);
  for(const w of [1440,1280,1024,390]){ await p.setViewportSize({width:w,height:850}); await p.waitForTimeout(300); check('S27 '+w+' px: ingen sideveis rulling av siden',await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true); }
  await p.setViewportSize({width:1440,height:900});
  check('S28 ingen KI er brukt. Eneste skriving er kortutkastet du lagret selv',[await p.evaluate(()=>__prompts.length),A.writes.filter(w=>!/mpos/.test(w.path)).length-w0],[0,0]);
  }catch(e){ e0=e; }
  await A.done(e0);
})();
