/* ---------- Maler og samtaler: e-post bygget rundt intensjon ---------- */
UI.ml={tab:'epost',intent:'first',target:'',dealId:'',busy:false,gen:'',basis:false,menu:false,key:''};
const ML_INTENTS=[['first','Første kontakt'],['former','Tidligere leietaker'],['afterCall','Oppfølging etter samtale'],['offer','Følg opp tilbud'],['propose','Foreslå dato / rom'],['last','Siste høflige oppfølging']];
const mlWords=t=>(String(t||'').trim().match(/\S+/g)||[]).length;
const mlFirst=n=>String(n||'').trim().split(/\s+/)[0]||'';
const mlDateTxt=d=>d&&d.date?fd(d.date,{day:'numeric',month:'long'}):'';
/* alle mål: prospekter (fra markedet) og kunder (fra CRM) */
function mlTargets(){
  const acc=mtAll().filter(a=>a.kind==='ny'&&!a.flags.disqualified).sort((x,y)=>y.fit.total-x.fit.total).slice(0,400);
  const ids=new Set(acc.map(a=>a.id));
  const cus=orgs().filter(o=>!ids.has(o.id)).sort((a,b)=>a.name.localeCompare(b.name,'nb'));
  return {acc,cus};
}
/* dokumentert kontekst, ikke noe annet */
function mlContext(){
  const U=UI.ml, t=U.target, c={name:'',first:'',email:'',basis:[],former:false,prevTitle:'',prevAtt:0,seg:'',evNote:'',room:''};
  const d=U.dealId?S.deals[U.dealId]:null; c.deal=d||null;
  let o=null, a=null;
  if(t.startsWith('p:')){ a=mtAll().find(x=>x.id===t.slice(2)); o=a&&S.orgs[a.id]||null; }
  else if(t.startsWith('o:')) o=S.orgs[t.slice(2)]||null;
  else if(d) o=S.orgs[d.orgId]||null;
  if(o){ c.name=o.name; const k=(o.contacts||[]).find(x=>x.name); if(k){ c.first=mlFirst(k.name); c.email=(o.contacts||[]).map(x=>x.email).find(e=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e||''))||''; } }
  if(a){ c.name=a.name; const p=(a.active||[]).find(x=>x.name&&!x.dnc); if(p&&!c.first){ c.first=mlFirst(p.name); if(p.email) c.email=p.email; }
    if(a.seg){ c.seg=mtSegShort(a.seg.name); c.basis.push('Segment: '+c.seg); }
    if(a.ev&&a.ev.level==='Confirmed'){ c.evNote=(a.ev.note||'').trim(); c.basis.push('Eventsignal: Dokumentert'+(c.evNote?' ('+c.evNote+')':'')); }
    if(a.room&&a.room.value&&a.room.value!=='Ukjent'){ c.room=a.room.value; c.basis.push('Romfit: '+a.room.value); } }
  if(o){ const oid=Object.keys(S.orgs).find(k=>S.orgs[k]===o), pp=deals().filter(x=>x.orgId===oid&&x.stage==='bekreftet').sort((x,y)=>(y.date||'').localeCompare(x.date||''));
    if(pp.length){ c.former=true; c.prevTitle=pp[0].title||''; c.prevAtt=pp[0].attendees||0; c.basis.push('Tidligere leietaker'+(c.prevTitle?' / '+c.prevTitle:'')+(c.prevAtt?' / ca. '+c.prevAtt+' deltakere':'')); }
    else if(o.former){ c.former=true; c.basis.push('Tidligere leietaker'); } }
  if(d){ c.basis.push('Sak: '+d.title+(d.date?' · '+mlDateTxt(d):'')+(d.attendees?' · '+d.attendees+' pers.':'')); if(!c.name&&d.orgId) c.name=orgName(d.orgId); }
  return c;
}
/* lokalt utkast: 60–120 ord, kun dokumenterte fakta */
function mlDraft(){
  const U=UI.ml, c=mlContext(), d=c.deal, hi=c.first?'Hei '+c.first+',':'Hei,', sig='Beste hilsen\n'+String(S.settings.signature||me.name||'').trim();
  const sal=d&&d.room?roomName(d.room):'', dato=mlDateTxt(d), att=d&&d.attendees?d.attendees+' personer':'';
  const arr=(d&&d.title?d.title.toLowerCase():'')||(c.prevTitle?c.prevTitle.toLowerCase():'');
  let sub='', b='';
  const k=U.intent;
  if(k==='former'&&c.former){
    sub='Solstad åpner i februar';
    b=hi+'\n\nJeg kom til å tenke på dere siden dere tidligere har hatt '+(c.prevTitle?c.prevTitle.toLowerCase()+' ':'arrangement ')+'hos oss. Vi åpner Solstad i februar, en storsal med plass til opptil 320. I tredje etasje kommer også flere mindre saler og to møterom, så vi har rom både for det store og det lille.\n\nHar dere begynt å se på datoer for 2027? Jeg kan holde av en dato mens dere bestemmer dere, eller sende noen forslag.\n\n'+sig;
  } else if(k==='afterCall'){
    sub=d?'Takk for praten, '+(arr||'arrangementet'):'Takk for praten';
    b=hi+'\n\nTakk for praten. '+(d?'Slik jeg har det nå gjelder det '+(arr||'arrangementet')+(dato?' '+dato:'')+(att?' for '+att:'')+(sal?', og '+sal+' er det jeg ser på':'')+'.':'Jeg følger opp med det vi kom frem til.')+'\n\nStemmer det, eller er det noe jeg bør justere før jeg sender et konkret forslag? Hvis dere har spørsmål om teknikk, servering eller pris, tar jeg gjerne en kort telefon.\n\n'+sig;
  } else if(k==='offer'){
    sub=d?'Tilbud: '+(sal||'rom')+(dato?', '+dato:''):'Tilbud fra Litteraturhuset';
    b=hi+'\n\nHar dere rukket å se på tilbudet'+(sal?' for '+sal:'')+(dato?' '+dato:'')+'? Si fra hvis noe bør justeres, enten pris, teknikk eller rom, så ser jeg på det med en gang.\n\nHvis datoen fortsatt er aktuell, kan jeg holde den av mens dere bestemmer dere. Gi meg beskjed om hva dere trenger for å kunne ta en avgjørelse.\n\n'+sig;
  } else if(k==='propose'){
    sub=sal?'Forslag: '+sal+(dato?', '+dato:''):'Forslag til dato og rom';
    b=hi+'\n\n'+(d?'Etter det jeg har notert om '+(arr||'arrangementet')+(att?' ('+att+')':'')+' tenker jeg at '+(sal||'et av de nye rommene')+' kan passe.':'Jeg tenker at et av de nye rommene på Litteraturhuset kan passe. Vi åpner Solstad med plass til opptil 320 i februar, og det kommer flere mindre saler i tredje etasje.')+'\n\n'+(dato?'Er '+dato+' fortsatt aktuelt?':'Hvilken periode ser dere for dere?')+' Jeg sender gjerne to eller tre ledige datoer, så kan dere velge det som passer best. Hvis det er lettere å se rommet først, tar jeg dere gjerne med på en kort omvisning.\n\n'+sig;
  } else if(k==='last'){
    sub='Fra Litteraturhuset';
    b=hi+'\n\nJeg skjønner at det er mye som skal gjøres, så dette er den siste henvendelsen fra meg for nå. Dersom dere skal arrangere noe i Oslo i 2027, er det bare å si fra, så finner vi en dato.\n\nLykke til videre.\n\n'+sig;
  } else {
    sub='Solstad åpner i februar';
    const obs=c.evNote?'Jeg ser at dere arrangerer '+c.evNote.toLowerCase()+', og tok kontakt fordi':'Jeg tar kontakt fordi';
    b=hi+'\n\n'+obs+' vi åpner Solstad på Litteraturhuset i februar'+(c.name&&!c.evNote?', og jeg tenkte på '+c.name:'')+'. Salen har plass til opptil 320, og i tredje etasje kommer flere mindre saler og to møterom. Det kan være aktuelt både for større arrangementer og for mindre samlinger.\n\nPlanlegger dere noe i Oslo neste år? Jeg sender gjerne noen aktuelle datoer hvis det er relevant.\n\n'+sig;
  }
  return {sub,b,c};
}
function mlSync(force){
  const U=UI.ml, key=U.intent+'|'+U.target+'|'+U.dealId;
  if(!force&&U.key===key&&COMP.tp&&COMP.tp.text!=null) return;
  const r=mlDraft(); U.key=key; COMP.tp={subject:r.sub,text:r.b,seed:r.b,to:r.c.email||''};
}
V.maler={html(){
  const U=UI.ml; mlSync(false);
  const c=mlContext(), T=mlTargets(), intent=ML_INTENTS.find(x=>x[0]===U.intent)||ML_INTENTS[0];
  const needDeal=['afterCall','offer','propose'].includes(U.intent);
  const tabs='<div class="seg ml-tabs" role="group" aria-label="Maler og samtaler">'+[['epost','E-post'],['samtale','Samtale']].map(([k,n])=>'<button type="button" data-mltab="'+k+'" aria-pressed="'+(U.tab===k)+'">'+n+'</button>').join('')+'</div>';
  if(U.tab==='samtale') return '<div class="ml">'+tabs+mlGuide()+'</div>';
  const dopts=deals().filter(x=>x.stage!=='tapt'&&(!U.target||(U.target.slice(2)===x.orgId))).map(x=>'<option value="'+x.id+'"'+(x.id===U.dealId?' selected':'')+'>'+esc(orgName(x.orgId)+' · '+x.title)+'</option>').join('');
  const sel='<div class="ml-sel"><label class="f"><span>Intensjon</span><select class="in" id="mlI">'+ML_INTENTS.map(([k,n])=>'<option value="'+k+'"'+(k===U.intent?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
   '<label class="f"><span>Kunde / prospekt</span><select class="in" id="mlT"><option value="">Velg …</option>'+(T.acc.length?'<optgroup label="Prospekter">'+T.acc.map(a=>'<option value="p:'+esc(a.id)+'"'+(U.target==='p:'+a.id?' selected':'')+'>'+esc(a.name)+'</option>').join('')+'</optgroup>':'')+(T.cus.length?'<optgroup label="Kunder">'+T.cus.map(o=>'<option value="o:'+esc(o.id)+'"'+(U.target==='o:'+o.id?' selected':'')+'>'+esc(o.name)+'</option>').join('')+'</optgroup>':'')+'</select></label>'+
   (dopts?'<label class="f"><span>Sak'+(needDeal?'':' <small>(valgfri)</small>')+'</span><select class="in" id="mlD"><option value="">Ingen sak</option>'+dopts+'</select></label>':'')+'</div>';
  const note=(U.intent==='former'&&U.target&&!c.former)?'<p class="ml-hint">Ingen tidligere leie er registrert for denne. Utkastet er skrevet som første kontakt.</p>':(needDeal&&!U.dealId?'<p class="ml-hint">Velg en sak for å få med dato, rom og antall.</p>':'');
  const basis='<details class="ml-basis"'+(U.basis?' open':'')+'><summary>Brukt som grunnlag</summary>'+(c.basis.length?'<ul>'+c.basis.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':'<p>Ingen konkret kontekst er dokumentert. Utkastet er generelt.</p>')+'</details>';
  const wc=mlWords(COMP.tp.text);
  const ed='<div class="ml-ed"><div class="form"><label class="f"><span>Til</span><input class="in" id="tpTo" type="email" value="'+esc(COMP.tp.to||'')+'" placeholder="navn@organisasjon.no"></label><label class="f"><span>Emne</span><input class="in" id="tpSub" value="'+esc(COMP.tp.subject||'')+'"></label></div>'+
   '<textarea class="in" id="tpBody" rows="11" aria-label="E-posttekst">'+esc(COMP.tp.text)+'</textarea>'+
   '<div class="ml-act"><button class="btn" type="button" id="tpCopy">Kopier</button><span class="ml-split"><a class="btn primary" id="tpMail" href="#" role="button">Åpne i e-post</a>'+(mcp?'<details class="ml-dd"'+(U.menu?' open':'')+'><summary class="btn primary" aria-label="Flere måter å lage utkast på"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></summary><div class="ml-ddm"><button type="button" id="tpOl">Opprett utkast i Outlook <small>ikke verifisert</small></button><button type="button" id="tpGm">Opprett utkast i Gmail <small>ikke verifisert</small></button></div></details>':'')+'</span><span class="ml-wc" id="mlWc">'+wc+' ord</span><span class="note" id="tpMsg"></span></div></div>';
  return '<div class="ml">'+tabs+sel+note+'<div class="row ml-gen"><button class="btn" type="button" id="mlGen"'+(U.busy?' disabled':'')+'>'+(U.busy?'Skriver …':'Lag personlig utkast')+'</button>'+basis+'</div>'+ed+'</div>';
},wire(v){
  const U=UI.ml, rr=()=>renderView(true);
  v.querySelectorAll('[data-mltab]').forEach(b=>b.addEventListener('click',()=>{ U.tab=b.dataset.mltab; rr(); }));
  if(U.tab==='samtale') return;
  $('#mlI')?.addEventListener('change',e=>{ U.intent=e.target.value; rr(); });
  $('#mlT')?.addEventListener('change',e=>{ U.target=e.target.value; U.dealId=''; rr(); });
  $('#mlD')?.addEventListener('change',e=>{ U.dealId=e.target.value; if(U.dealId&&!U.target){ const d=S.deals[U.dealId]; if(d) U.target='o:'+d.orgId; } rr(); });
  $('#mlGen')?.addEventListener('click',mlGenerate);
  v.querySelector('.ml-basis')?.addEventListener('toggle',e=>{ U.basis=e.target.open; });
  v.querySelector('.ml-dd')?.addEventListener('toggle',e=>{ U.menu=e.target.open; });
  const c=COMP.tp, wc=$('#mlWc');
  $('#tpBody')?.addEventListener('input',e=>{ c.text=e.target.value; if(wc) wc.textContent=mlWords(c.text)+' ord'; });
  const mail=$('#tpMail'); mail?.addEventListener('click',e=>{ e.preventDefault(); const to=(c.to||'').trim(); location.href='mailto:'+encodeURIComponent(to).replace(/%40/g,'@')+'?subject='+encodeURIComponent(c.subject||'')+'&body='+encodeURIComponent(c.text||''); });
  wireComposer('tp',()=>{ const d=U.dealId?S.deals[U.dealId]:null, cx=mlContext(); return {orgId:d?d.orgId:(U.target.startsWith('o:')?U.target.slice(2):''),dealId:U.dealId,to:cx.email}; });
}};
async function mlGenerate(){
  const U=UI.ml;
  if(!sample){ mlSync(true); toast('Utkast laget fra dokumentert kontekst'); renderView(true); return; }
  const r=mlDraft(), c=r.c; U.busy=true; renderView(true);
  const ctx=c.basis.length?c.basis.join('\n'):'Ingen konkret kontekst er dokumentert.';
  const prompt='Skriv en kort e-post på norsk bokmål fra utleieansvarlig ved Litteraturhuset i Oslo. Intensjon: '+(ML_INTENTS.find(x=>x[0]===U.intent)||[])[1]+'. Mottaker: '+(c.name||'ukjent')+(c.first?' (fornavn '+c.first+')':'')+'.\n\nDokumentert kontekst (bruk KUN dette, ikke dikt opp noe annet om mottakeren):\n'+ctx+'\n\nKrav: 60 til 120 ord. Én tydelig grunn til at du skriver akkurat til dem. Ett relevant poeng om Litteraturhuset eller rommet. Ett enkelt spørsmål eller en enkel oppfordring til slutt. Ingen salgsspråk, ingen superlativer, ingen lange fasilitetslister, ikke forklar hele produktet. Ikke dikt opp personlige detaljer, arrangementer eller datoer. Hvis det ikke finnes en konkret grunn, skriv mer generelt, men fortsatt menneskelig. Unngå «Vi ønsker å informere om», «Vi er glade for å kunne fortelle», «Jeg ville bare følge opp», «Litteraturhuset tilbyr». Foretrekk formuleringer som «Jeg kom til å tenke på dere fordi», «Jeg ser at dere arrangerer», «Siden dere tidligere har hatt … hos oss», «Har dere begynt å se på datoer for …?». Ingen tankestreker. Start med «Hei» og avslutt med «Beste hilsen» og navnet '+(S.settings.signature||me.name||'')+'. Ingen emnelinje. Svar bare med e-postteksten.\n\nBasisutkast:\n'+COMP.tp.text;
  try{ await sample(prompt,{modelTier:'quick',onText:({text})=>{ COMP.tp.text=text; const b=$('#tpBody'); if(b) b.value=text; }}); COMP.tp.seed=COMP.tp.text; }
  catch(e){ toast(sampleMsg(e)); }
  U.busy=false; renderView(true);
}
function mlGuide(){
  return '<div class="ml-g"><section><h3>Første samtale</h3><ul><li>Dato, og hvor fleksibel den er</li><li>Antall og type: foredrag, mingling, gruppearbeid</li><li>Åpent for publikum eller lukket (avgjør prisen)</li><li>Teknikk: mikrofoner, skjerm, strømming, opptak</li><li>Servering, og om det selges bøker</li><li>Skjer det igjen? Årlig, halvårlig, serie</li><li>Hvem bestemmer, og når</li></ul></section>'+
   '<section><h3>Tidligere leietaker</h3><ul><li>Hvor har dere holdt arrangementene i det siste?</li><li>Hva fungerte der, og hva savnet dere hos oss?</li><li>Hva skal til for at dere kommer tilbake?</li><li>Når er neste arrangement, og hvor mange blir dere?</li><li>Kan vi holde av en dato, eller vise dere de nye salene?</li></ul></section>'+
   '<section><h3>Språk</h3><ul><li><b>Bruk:</b> formidling, samtale, kunnskapsdeling, møteplass, formidlingssaler</li><li><b>Unngå:</b> konferansesenter, kommersielt, eventlokale</li><li>Alle utleieinntekter går tilbake til husets ideelle arbeid</li><li>Rabatt for åpne arrangementer innen litteratur, politikk og samfunn</li></ul></section></div>';
}
Object.defineProperty(VDESC,'maler',{get(){return 'Skriv e-post ut fra intensjon, og ha samtaleguiden for hånden';},configurable:true});
