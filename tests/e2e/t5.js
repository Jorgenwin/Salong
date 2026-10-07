// Trinn 2 (runde 2): Kunnskap med fire blokker, kildepanel, lagring og festing. Kjør: node t5.js
const {navTo,setup} = require('./h.js');
(async()=>{
  const A=await setup({ai:true,users:[{id:'u1',name:'Jørgen Test'},{id:'u2',name:'Phillip Test'}]}), {store,check,txt,all,remote}=A, [p,p2]=A.pages; let e0=null;
  const view=async(pg,v)=>{ await navTo(pg,v,160); };
  const ask=async(q,pg)=>{ pg=pg||p; await pg.fill('#knQ',q); await pg.click('#knForm button[type=submit]'); await pg.waitForTimeout(360); };
  const last=sel=>p.$$eval('.kn-turn:last-child '+sel,e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
  const ai=fn=>p.evaluate(f=>{ window.__aiFn=new Function('prompt',f); },fn);
  const MIC="const mic=(prompt.match(/\\[(K\\d+)\\][^\\n]*trådløse mikrofoner/)||[])[1]||'K404';";
  try{
  await view(p,'kunnskap'); await p.click('[data-knt="kunde"]'); await p.waitForTimeout(100); await p.selectOption('#knOrg','t-nf'); await p.waitForTimeout(120);
  await ai(MIC+"return {kort:'Det er avtalt to trådløse mikrofoner uten tillegg.',fakta:[{p:'Det er avtalt to trådløse mikrofoner uten tillegg ved høstlanseringen.',k:[mic],sitat:'får to trådløse mikrofoner uten tillegg'}],beregninger:[],uavklart:[{p:'Antall håndholdte mikrofoner er ikke funnet i tilgjengelig grunnlag.'}],forslag:[{p:'Bekreft mikrofonbehovet med kunden.'}]};");
  await ask('Hva er avtalt om mikrofoner?');
  check('N01 KI-svaret har fire blokker i fast rekkefølge',(await last('.kn-b > h4')).map(x=>x.replace(/\s*\d+$/,'')),['Kort svar','Dokumenterte funn','Mangler, usikkerhet og motstrid','Anbefalt neste steg']);
  check('N01 kort svar først, deretter funn med sitat',[(await last('.kn-kort'))[0],(await last('.kn-b-funn q'))[0]],['Det er avtalt to trådløse mikrofoner uten tillegg.','«får to trådløse mikrofoner uten tillegg»']);
  check('N02 ledeteksten ber om kort svar uten tall som ikke svarer på spørsmålet',await p.evaluate(()=>__prompts[__prompts.length-1]),v=>/«kort» er ett til to setninger som svarer direkte på spørsmålet/.test(v)&&/"kort":/.test(v));
  check('N03 svakt grunnlag sies rett ut når bare ett utdrag passer',[(await last('.kn-cov'))[0],(await last('.kn-weak'))[0]],v=>/^Svakt grunnlag · \d+ kilder/.test(v[0])&&v[1]==='Bare ett utdrag passet spørsmålet. Svaret hviler på et tynt grunnlag.');
  await p.click('.kn-turn:last-child .kn-cov'); await p.waitForTimeout(150);
  const side=await txt(p,'.kn-side-b');
  check('N04 kildepanelet: antall kilder, verifisert og ikke verifisert, og tre adskilte grupper',[await txt(p,'.kn-sum'),await all(p,'.kn-side-b > h3')],v=>/\d+ kilder bak svaret\d+ strukturerte oppslag · \d+ utdrag\d+ verifisert \d+ ikke verifisert/.test(v[0])&&v[1].map(x=>x.replace(/\s*\d+$/,'')).join('|')==='Strukturerte oppslag|Utdrag fra kilder|Avledet av KI');
  check('N04 hvert utdrag viser status og når det sist ble endret. KI-påstander er merket som ikke kilder',side,v=>/Registrert i Salong/.test(v)&&/endret 20\. sep\. 2026/.test(v)&&/Regnet ut i Salong/.test(v)&&/skrevet av KI ut fra kildene over\. De er ikke kilder/.test(v));
  // kort svar kontrolleres
  await ai(MIC+"return {kort:'Kunden får 12 mikrofoner gratis.',fakta:[{p:'Det er avtalt to trådløse mikrofoner uten tillegg ved høstlanseringen.',k:[mic],sitat:'får to trådløse mikrofoner uten tillegg'}],beregninger:[],uavklart:[],forslag:[]};"); await ask('Hva er avtalt om mikrofoner?');
  check('N05 kort svar med tall som ikke står i funnene fjernes',[(await last('.kn-kort'))[0],(await last('.kn-drop li')).some(x=>/^kort svar med tall som ikke står i funnene/.test(x))],['Se de dokumenterte funnene under.',true]);
  await ai("return {kort:'Kunden har avtalt gratis parkering for alle gjester.',fakta:[],beregninger:[],uavklart:[],forslag:[]};"); await ask('Hva er avtalt om parkering?');
  check('N06 kort svar uten dokumentert funn bak vises ikke. Svak dekning sies tydelig',[(await last('.kn-kort'))[0],(await last('.kn-drop li')).some(x=>/^kort svar uten dokumentert funn bak/.test(x)),(await last('.kn-b-funn .empty'))[0]],v=>v[0]==='Grunnlaget gir ikke et dokumentert svar på dette spørsmålet.'&&v[1]&&/Ingen påstander kunne dokumenteres/.test(v[2]));
  await ai("return {kort:'Det står ikke noe om parkering i grunnlaget.',fakta:[],beregninger:[],uavklart:[{p:'Parkering er ikke funnet i tilgjengelig grunnlag.'}],forslag:[]};"); await ask('Hva er avtalt om parkering?');
  check('N06 et ærlig «står ikke» beholdes som kort svar',(await last('.kn-kort'))[0],'Det står ikke noe om parkering i grunnlaget.');
  // feste til kunde
  await ai(MIC+"return {kort:'Det er avtalt to trådløse mikrofoner uten tillegg.',fakta:[{p:'Det er avtalt to trådløse mikrofoner uten tillegg ved høstlanseringen.',k:[mic],sitat:'får to trådløse mikrofoner uten tillegg'}],beregninger:[],uavklart:[],forslag:[]};"); await ask('Hva er avtalt om mikrofoner?');
  const la0=await p.evaluate(()=>{ let m=null; for(const a of Object.values(__salong.S.acts)) if(a.orgId==='t-nf'&&a.type!=='task'&&!a.handover&&!a.derived&&!a.deletedAt&&(!m||a.at>m)) m=a.at; return m; });
  const nA=Object.keys(store.acts).length; await p.click('.kn-turn:last-child [data-knpin$=":org"]'); await p.waitForTimeout(500);
  const pin=Object.values(store.acts).find(a=>a.pin);
  check('N07 «Fest til kunden» lagrer svaret på kunden, merket som avledet, med funn og kilder',[Object.keys(store.acts).length-nA,pin&&[pin.orgId,pin.dealId,pin.derived,pin.pin.kort,pin.pin.funn.length,pin.pin.kilder.length>0,pin.byName].join(' | ')],[1,'t-nf |  | true | Det er avtalt to trådløse mikrofoner uten tillegg. | 1 | true | Jørgen Test']);
  check('N07 knappen viser at svaret er festet',await p.$eval('.kn-turn:last-child [data-knpin$=":org"]',e=>e.disabled+' '+e.textContent),'true Festet til kunden');
  await ai("return {kort:'',fakta:[],beregninger:[],uavklart:[],forslag:[]};"); await p.uncheck('#knAI'); await ask('Festet svar fra Kunnskap mikrofoner');
  check('N08 et festet svar er aldri en kilde: det dukker ikke opp i søk',(await last('.kb-hits li')).some(x=>/Festet svar fra Kunnskap/.test(x)),false);
  check('N08 og det regnes ikke som dialog med kunden',await p.evaluate(()=>{ let m=null; for(const a of Object.values(__salong.S.acts)) if(a.orgId==='t-nf'&&a.type!=='task'&&!a.handover&&!a.derived&&!a.deletedAt&&(!m||a.at>m)) m=a.at; return m; }),la0);
  await p.check('#knAI');
  await p.evaluate(()=>__salong.openOrg('t-nf','kunnskap')); await p.waitForTimeout(250);
  check('N09 kundekortet viser festede svar, merket som avledet og ikke søkbart',await txt(p,'.drawer .kb-pins'),v=>/Festede svar fra Kunnskap 1/.test(v)&&/Avledet av KI ut fra kildene på det tidspunktet\. Ikke en kilde, og ikke søkbart/.test(v)&&/Det er avtalt to trådløse mikrofoner uten tillegg\./.test(v)&&/av Jørgen Test/.test(v));
  await p.evaluate(()=>{ __salong.UI.drawer=null; document.querySelector('#drawer-root').innerHTML=''; });
  // lagre samtale
  check('N10 samtalen er midlertidig som standard, med mulighet for å lagre',[await txt(p,'.kn-tmp span'),await txt(p,'#knSave')],v=>/^Midlertidig samtale\./.test(v[0])&&v[1]==='Lagre samtalen');
  await p.click('#knSave'); await p.waitForTimeout(500);
  const mine=store['data/users/u1']||{}, cid=Object.keys(mine)[0];
  check('N10 samtalen er lagret i kontoens eget område, ikke i den delte databasen',[Object.keys(mine).length,cid&&cid.startsWith('kn-'),mine[cid]&&mine[cid].turns.length,Object.keys(store).filter(c=>/^kconv|^chat/.test(c)).length,await txt(p,'.kn-tmp span')],v=>v[0]===1&&v[1]&&v[2]===6&&v[3]===0&&/^Lagret samtale\. Lagret for kontoen din/.test(v[4]));
  await view(p2,'kunnskap'); await p2.click('[data-kntab="samtaler"]'); await p2.waitForTimeout(250);
  check('N11 en annen bruker ser ikke samtalen i sin liste',[await txt(p2,'.kn-side-b'),await p2.evaluate(()=>Object.keys(__salong.S.kconv||{}).length)],v=>/Lagrede samtaler 0/.test(v[0])&&v[1]===0);
  await p.reload(); await p.waitForTimeout(700); await view(p,'kunnskap'); await p.click('[data-kntab="samtaler"]'); await p.waitForTimeout(300);
  check('N12 etter ny lasting ligger samtalen under «Lagrede samtaler», med ærlig merking',await txt(p,'.kn-side-b'),v=>/Lagrede samtaler 1/.test(v)&&/Hva er avtalt om mikrofoner\?/.test(v)&&/6 spørsmål/.test(v)&&/Det er ikke kontrollert herfra med en annen bruker/.test(v));
  await p.click('[data-knsaved]'); await p.waitForTimeout(300);
  check('N12 gjenåpnet: svarene vises slik de var, med beskjed om at kildene kan være endret',[(await p.$$('.kn-turn')).length,await txt(p,'.kn-main > .notice.info'),(await p.$$eval('.kn-turn:first-child .kn-b > h4',e=>e.length)),await txt(p,'.kn-ctx b')],v=>v[0]===6&&/^Lagret samtale fra .*Kildene kan være endret siden\. Nye spørsmål henter dagens grunnlag/.test(v[1])&&v[2]===4&&v[3]==='Kunde: [TEST] Nordlys Forlag AS');
  await remote('acts','t-a1',{text:'[TEST] Avtalt at forlaget får fire trådløse mikrofoner mot tillegg.'}); await p.waitForTimeout(200);
  await p.evaluate(f=>{ window.__aiFn=new Function('prompt',f); },MIC+"const four=/fire trådløse mikrofoner mot tillegg/.test(prompt); return {kort:four?'Nå står det fire trådløse mikrofoner mot tillegg.':'to',fakta:four?[{p:'Det er avtalt fire trådløse mikrofoner mot tillegg.',k:[mic],sitat:'får fire trådløse mikrofoner mot tillegg'}]:[],beregninger:[],uavklart:[],forslag:[]};");
  await ask('Hva er avtalt om mikrofoner nå?');
  check('N13 nytt spørsmål i lagret samtale henter dagens grunnlag, ikke det lagrede',[(await last('.kn-kort'))[0],await txt(p,'#knSave')],['Nå står det fire trådløse mikrofoner mot tillegg.','Lagre endringene']);
  // markedskunnskap
  await p.click('[data-knt="marked"]'); await p.waitForTimeout(100); await p.click('#knAskYes'); await p.waitForTimeout(150);
  await p.evaluate(f=>{ window.__aiFn=new Function('prompt',f); },"const k=(prompt.match(/\\[(K\\d+)\\][^\\n]*Sentralen · Marmorsalen\\. Kapasitet/)||[])[1]||'K404'; return {kort:'Marmorsalen har publisert romleie på 69 000 kr eks. mva.',fakta:[{p:'Publisert romleie for Marmorsalen er 69 000 kr eks. mva.',k:[k],sitat:'Romleie: 69 000 kr eks. mva'}],beregninger:[],uavklart:[{p:'Samme side har motstridende opplysninger om grunnteknikk.'}],forslag:[]};");
  await ask('Hva koster Marmorsalen hos Sentralen?');
  const prM=await p.evaluate(()=>__prompts[__prompts.length-1]), kil=prM.slice(prM.lastIndexOf('<kilder>'));
  check('N14 Markedskunnskap bruker researchgrunnlaget, med dato for kontroll, og ingen kundedata',[/Markedskilde: leverandørens nettsted, kapasitet og pris, endret 5\. okt\. 2026/.test(kil),/Dagpakke 08–16: 1.335 kr per person inkl\. mva/.test(kil),/Nordlys|Recovery|Strukturert oppslag/.test(kil)],[true,true,false]);
  check('N14 svaret gjengir pris med avgiftsgrunnlag, og kilden er merket kontrollert',[(await last('.kn-kort'))[0],(await last('.kn-b-funn q'))[0]],['Marmorsalen har publisert romleie på 69 000 kr eks. mva.','«Romleie: 69 000 kr eks. mva»']);
  const nP=Object.keys(store.mpos||{}).length; await p.click('.kn-turn:last-child [data-knpin$=":kort"]'); await p.waitForTimeout(500);
  const card=Object.values(store.mpos||{}).pop();
  check('N15 et markedssvar kan lagres som utkast til kort, ikke som godkjent argument',[Object.keys(store.mpos).length-nP,card.status,card.aiDraft,card.from.type,card.wording,card.sources.length>0],[1,'utkast',true,'kunnskap','Marmorsalen har publisert romleie på 69 000 kr eks. mva.',true]);
  await p.uncheck('#knAI'); await ask('Hva koster Solstad?');
  check('N16 Solstad: grunnlaget sier at pris må innhentes, ingen pris er antatt',(await last('.kb-hits li')).filter(x=>/Litteraturhuset · Solstad/.test(x)).join(' ¦ '),v=>/Ingen publisert pris\. Pris må innhentes/.test(v)&&!/Solstad[^¦]*\d{2}.\d{3} kr/.test(v));
  await ask('helikopterlandingsplass');
  check('N17 utenfor markedsgrunnlaget: tydelig tomtilstand som sier hva grunnlaget dekker',(await last('.empty'))[0]||'',v=>/Ikke funnet i markedskildene\. Grunnlaget er et utvalg på 20 rom og 24 kilder, kontrollert 5\. okt\. 2026/.test(v)&&/Det dekker ikke ledighet, egne tilbud eller lokaler utenfor utvalget/.test(v));
  // hele CRM-et: svar før tall
  await p.click('[data-knt="crm"]'); await p.waitForTimeout(100); await p.click('#knAskYes'); await p.waitForTimeout(150); await ask('Hvem har avtaler om mikrofoner?');
  check('N18 Hele CRM-et: tall som ikke svarer på spørsmålet ligger sammenslått',[(await last('.kn-b-tall > .kb-facts li')).length,(await last('.kn-b-tall details summary'))[0]],[0,'Vis strukturerte oppslag (3)']);
  await ask('Hvor mange åpne saker har vi?');
  check('N18 spørsmål om saker viser bare det oppslaget, kort',await last('.kn-b-tall > .kb-facts li'),v=>v.length===1&&/^Åpne saker: \d+ med samlet verdi [\d\s ]+kr\. Kunder i Salong: \d+\. S1$/.test(v[0]));
  await p.setViewportSize({width:390,height:800}); await p.waitForTimeout(250);
  check('N19 mobilbredde: ingen sideveis rulling',await p.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),true);
  await p.setViewportSize({width:1440,height:900}); await p.check('#knAI'); await p.click('[data-knt="kunde"]'); await p.click('#knAskYes'); await p.waitForTimeout(100); await p.selectOption('#knOrg','t-nf'); await p.waitForTimeout(100);
  await p.evaluate(f=>{ window.__aiFn=new Function('prompt',f); },MIC+"return {kort:'Det er avtalt fire trådløse mikrofoner mot tillegg.',fakta:[{p:'Det er avtalt fire trådløse mikrofoner mot tillegg.',k:[mic],sitat:'får fire trådløse mikrofoner mot tillegg'}],beregninger:[],uavklart:[{p:'Pris for tillegget er ikke funnet i tilgjengelig grunnlag.'}],forslag:[{p:'Avklar prisen på tillegget med kunden.'}]};");
  await ask('Hva er avtalt om mikrofoner?'); await p.click('.kn-turn:last-child .kn-cov'); await p.waitForTimeout(150); await p.screenshot({path:require('./h.js').SHOT+'/kn2.png'});
  }catch(e){ e0=e; }
  await A.done(e0);
})();
