/* ---------- Innsikt: én spørsmålsflate over kunnskapslaget og porteføljen ----------
   Bygger på Kunnskap-motoren (kn.js). Her legges det til: nytt navn, fire omfangsvalg, forhåndsvalg fra der brukeren kommer fra,
   forslag til spørsmål og beregnede svar for porteføljen og markedet (fra u3.js). Beregnede svar er Salongs egen vurdering og merkes slik. */
VIEWS.find(v=>v.k==='kunnskap').n='Innsikt';
VDESC.kunnskap='Still ett spørsmål. Svaret viser hva det bygger på, hva som mangler og hva som er tolkning.';
KNT.kunde='Denne kunden'; KNT.sak='Denne saken'; KNT.crm='Porteføljen'; KNT.marked='Markedet';
UI.kn.sc={t:'crm',orgId:'',dealId:''};
/* kommer du fra Marked og posisjon, er «Markedet» valgt på forhånd (med mindre en kunde eller sak allerede er valgt) */
{ const _g=go; go=function(v){ if(v==='kunnskap'&&UI.view==='marked'&&!UI.kn.turns.length&&!['kunde','sak'].includes(UI.kn.sc.t)) UI.kn.sc={t:'marked',orgId:'',dealId:''}; return _g.apply(this,arguments); }; }

/* Litteraturhusets verdier er grunnlag for alle anbefalinger. Teksten er gjengitt fra det Jørgen har delt. Salong vurderer ikke verdisamsvar automatisk. */
const LH_VERDI={vis:'Litteraturhuset er en ikke-kommersiell stiftelse som skal spre litteratur i bred forståelse, verne om ytringsfriheten og bidra til en kunnskapsbasert offentlig samtale.',
  res:'Alle tilknyttet huset skal behandle andre med respekt. Det er nulltoleranse for diskriminering og trakassering, og et mål om dialog og åpenhet mellom grupper.',
  note:'Rangeringen er kommersiell og faglig. Litteraturhuset er en ikke-kommersiell stiftelse, og leie skal også passe verdiene: respekt, ytringsfrihet og nulltoleranse for diskriminering. Salong vurderer ikke det automatisk. Det er en vurdering dere gjør selv før dere sier ja.'};
const I3_EX={
  crm:['Hvem bør jeg prioritere denne uken?','Hvilke tidligere leietakere bør vi hente tilbake?','Hvilke prospekter passer best for Solstad?','Hvilke segmenter er svakest bearbeidet?','Hva må til for å nå kvartalsmålet?'],
  marked:['Hvilke segmenter er svakest bearbeidet?','Hva er dokumentert om priser hos alternativene?','Hva sier leievilkårene om avbestilling?','Hva er dokumentert om teknikk?'],
  kunde:['Hva ble avtalt sist?','Hvor mange bookinger har de hatt?','Hva må avklares før neste samtale?'],
  sak:['Hva er avtalt om teknikk?','Hva er uavklart i saken?','Hva sto i siste tilbud?']};
const I3_INT=[['mal',/kvartalsm|årsm|halvårsm|\bmålet\b|prognose|hva må til|nå målet/i],['tidl',/tidligere (leietaker|kunde|arrangør)|hente tilbake|vinne tilbake|reaktiver/i],['seg',/segment|svakest|bearbeid|dekning|hvite flekker|underrepresent/i],['sol',/solstad|passer best|beste prospekt/i],['pri',/prioriter|denne uken|hvem bør|hvem skal|følge opp først/i]];
const i3Intent=q=>{ const t=String(q||''); const h=I3_INT.find(([,re])=>re.test(t)); return h?h[0]:null; };

/* ---------- beregnede svar ---------- */
function i3Rows(list,n,why){ return list.slice(0,n).map(r=>({id:r.id,name:r.name,seg:r.segment,rel:r.rel,owner:r.ownerId?ownName(r.ownerId,r.ownerName):'Ufordelt',nba:r.nba,why:why(r)})); }
function i3Analyze(sc,q){
  const k=i3Intent(q); if(!k) return null;
  if(sc.t==='marked'&&!['seg'].includes(k)) return null;
  if(sc.t!=='crm'&&sc.t!=='marked') return null;
  const D=u3Data(), a=actor(), live=D.rows.filter(r=>!['parkert','bekreftet'].includes(r.rel)), exN=D.rows.filter(r=>r.example).length;
  const ex=exN?exN+' av '+D.rows.length+' organisasjoner er eksempeldata.':'';
  const common={missing:['Ledighet og reservasjoner i bookingsystemet er ikke med.','E-post utenfor Salong er ikke med. «Sist kontaktet» gjelder bare det som er logget her.'],ex};
  if(k==='pri'){
    const mine=a?live.filter(r=>r.ownerId===a.id||!r.ownerId):live, pool=(mine.length>=3?mine:live).slice().sort((x,y)=>k3Pri(y)-k3Pri(x)), over=pool.filter(r=>r.nba.over).length;
    return {k,title:'Prioritert for denne uken',lead:(a&&mine.length>=3?'Dine kunder og ufordelte, ':'Alle kunder, ')+'rangert etter forfalt handling, tilbud under arbeid, kundenivå og score.',
      rows:i3Rows(pool,6,r=>r.nba.why),
      certain:[over+' '+(over===1?'handling har':'handlinger har')+' forfalt frist.',live.filter(r=>r.rel==='tilbud').length+' kunder har tilbud ute.'],
      basis:['Oppgaver, saker og aktiviteter registrert i Salong.','Kundenivå (A/B/C) og score fra profilene.'],
      interp:['Rekkefølgen er Salongs egen vektning. Den er en prioritering, ikke en fasit.'],missing:common.missing,ex:common.ex,go:{label:'Åpne Kunder',view:'kontakter'}};
  }
  if(k==='tidl'){
    const pool=D.rows.filter(r=>r.rel==='tidligere').sort((x,y)=>(y.pot+(y.days==null?40:Math.min(60,y.days/6)))-(x.pot+(x.days==null?40:Math.min(60,x.days/6))));
    return {k,title:'Tidligere leietakere å hente tilbake',lead:pool.length+' organisasjoner har leid før og har ikke bekreftet noe det siste året. De med høyest potensial og lengst stillhet står først.',
      rows:i3Rows(pool,6,r=>(r.days==null?'Ingen dialog registrert':'Sist dialog for '+r.days+' dager siden')+(r.spend?' · leid for '+short(r.spend)+' i fjor':'')),
      certain:[pool.length+' har status tidligere leietaker.',pool.filter(r=>!r.ownerId).length+' av dem mangler kundeansvarlig.'],
      basis:['Bookinger og saker i Salong (siste 12 måneder).','Kundestatus fra kundekortet.'],
      interp:['Potensial er Salongs anslag ut fra segment, størrelse og historikk. «Hent tilbake» er et forslag, ikke en avtale.'],missing:common.missing.concat(['Hvorfor de sluttet å leie er ikke registrert uten et notat.']),ex:common.ex,go:{label:'Åpne Kunder',view:'kontakter'}};
  }
  if(k==='sol'){
    const pool=live.slice().sort((x,y)=>(y.fit*.6+y.pot*.4)-(x.fit*.6+x.pot*.4));
    return {k,title:'Prospekter som passer Solstad',lead:'Rangert etter passform for Solstad (størrelse, arrangementstype, tidligere saker) og kommersielt potensial.',
      rows:i3Rows(pool,6,r=>'Passform '+r.fit+' · potensial '+r.pot+(r.exp?' · forventet '+short(r.exp):'')),
      certain:['Solstad rommer '+U3_SOLSTAD.min+' til '+U3_SOLSTAD.max+' gjester i de oppsettene som er registrert.'],
      basis:['Segmentprofiler, kapasitet og tidligere saker i Salong.'],
      interp:['Passform og potensial er Salongs egne anslag på en skala fra 0 til 100. De er ikke dokumentert.'],missing:common.missing,ex:common.ex,go:{label:'Se prioriteringsflaten',view:'marked'}};
  }
  if(k==='seg'){
    const W=u3White(), top=W.slice(0,5), T=u3Cover().T;
    return {k,title:'Segmenter som er svakest bearbeidet',lead:'Rangert etter passform for Solstad og hvor lite av segmentet vi har kontaktet. Tallet for hele markedet er et anslag.',
      seg:top.map(s=>({seg:s.seg,est:s.est,worked:s.allWorked,pct:s.pct,fit:s.sf,ident:s.ident})),rows:[],
      certain:[T.allWorked+' av anslått '+nf.format(T.est)+' organisasjoner er bearbeidet ('+Math.round(T.pct*100)+' %).',T.unmapped+' er ikke kartlagt med navn ennå.'],
      basis:['Organisasjoner i målunivers og aktiviteter/saker i Salong.'],
      interp:['Størrelsen på hvert segment er et anslag som kan justeres under Kunder. Passform er Salongs vurdering.'],missing:common.missing,ex:common.ex,go:{label:'Se markedsdekning',view:'kontakter',dekning:true}};
  }
  if(k==='mal'){
    const G=typeof g3Calc==='function'?g3Calc('q'):null;
    if(!G) return {k,title:'Mål og prognose',lead:'Åpne Mål og prognose for tallene.',rows:[],certain:[],basis:[],interp:[],missing:common.missing,ex:common.ex,go:{label:'Åpne Mål og prognose',view:'prognose'}};
    return {k,title:'Hva må til for å nå målet for '+G.label+'?',lead:G.goal?'Mål '+short(G.goal)+'. Bekreftet '+short(G.confirmed)+', vektet pipeline '+short(G.weighted)+'. Gap til mål ved dagens fart: '+short(Math.max(0,G.gap))+'.':'Ingen mål er satt for perioden. Sett det under Mål og prognose.',
      rows:[],need:G.goal?G.need:null,
      certain:['Bekreftet i perioden: '+short(G.confirmed)+' ('+G.nConf+' '+(G.nConf===1?'avtale':'avtaler')+').','Åpne saker i perioden: '+G.nOpen+'.'],
      basis:['Bekreftede og åpne saker med dato i perioden, og aktivitet de siste ukene.','Sannsynlighet per fase fra innstillingene.'],
      interp:['Vektet pipeline og «forventet ved dagens fart» er prognoser. De forutsetter at aktiviteten og treffprosenten fortsetter.'],missing:common.missing.concat(G.nNoDate?[G.nNoDate+' åpne saker mangler dato og er ikke regnet med i perioden.']:[]),ex:common.ex,go:{label:'Åpne Mål og prognose',view:'prognose'}};
  }
  return null;
}
function i3AnHTML(I){
  const rel=r=>'<span class="rel r-'+r.rel+'">'+esc(U3_RELN[r.rel])+'</span>';
  const rows=(I.rows||[]).length?'<ol class="i3-rows">'+I.rows.map((r,n)=>'<li><span class="i3-n">'+(n+1)+'</span><div class="i3-r"><button type="button" class="lnk i3-nm" data-i3open="'+esc(r.id)+'">'+esc(r.name)+'</button><span class="i3-sub">'+esc(r.seg||'Uten segment')+' · '+esc(r.owner)+'</span><span class="i3-why">'+esc(r.why)+'</span></div>'+rel(r)+(readOnly||!r.nba||r.nba.quiet||!U3_ACT[r.nba.k]?'':'<button type="button" class="btn sm" data-i3do="'+r.nba.k+':'+esc(r.id)+':'+esc(r.nba.deal||'')+'">'+esc(U3_ACT[r.nba.k])+'</button>')+'</li>').join('')+'</ol>':'';
  const seg=I.seg?'<ol class="i3-rows">'+I.seg.map((s,n)=>'<li><span class="i3-n">'+(n+1)+'</span><div class="i3-r"><b class="i3-nm">'+esc(s.seg)+'</b><span class="i3-sub">'+s.worked+' av ca. '+nf.format(s.est)+' bearbeidet · '+s.ident+' kartlagt med navn</span><span class="i3-bar" role="img" aria-label="'+Math.round(s.pct*100)+' prosent bearbeidet"><i style="width:'+Math.min(100,Math.round(s.pct*100))+'%"></i></span></div><span class="i3-fit">Passform <b>'+s.fit+'</b></span></li>').join('')+'</ol>':'';
  const need=I.need?'<ul class="i3-need">'+I.need.map(n=>'<li><b>'+esc(n.v)+'</b><span>'+esc(n.l)+'</span></li>').join('')+'</ul>':'';
  const col=(c,t,L)=>L&&L.length?'<div class="i3-c i3-'+c+'"><h5>'+t+'</h5><ul>'+L.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
  return '<section class="i3-an"><div class="kn-ah"><span class="rec-tag">Beregnet i Salong</span><span class="meta">Regnet ut nå fra registrerte data. Ikke et KI-svar.</span></div><h4>'+esc(I.title)+'</h4><p class="i3-lead">'+esc(I.lead)+'</p>'+rows+seg+need+
    '<div class="i3-cols">'+col('s','Sikkert',I.certain)+col('b','Bygger på',I.basis.concat(I.ex?[I.ex]:[]))+col('m','Mangler',I.missing)+col('t','Tolkning og forslag',I.interp)+'</div>'+
    (I.go?'<div class="row"><button type="button" class="btn sm" data-i3go="'+esc(I.go.view)+(I.go.dekning?':dekning':'')+'">'+esc(I.go.label)+'</button></div>':'')+'</section>';
}
/* hvert spørsmål får en kort oppsummering av hva svaret hviler på */
function i3Strip(T){ const G=T.G; if(!G) return ''; const C=knCover(T), I=G.I, nS=G.S.length, miss=G.gaps.length+(T.ai?T.ai.unk.length:0)+(I?I.missing.length:0), tol=(T.ai?T.ai.sug.length:0)+(I?I.interp.length:0);
  const cell=(c,t,v)=>'<div class="i3-sc i3-'+c+'"><span>'+t+'</span><b>'+v+'</b></div>';
  return '<div class="i3-strip" role="group" aria-label="Hva svaret hviler på">'+cell('s','Sikkert',(I?I.certain.length+' beregnede tall':nS+' oppslag')+(C.ver?' · '+C.ver+' verifiserte kilder':''))+cell('b','Bygger på',C.all+' '+(C.all===1?'kilde':'kilder')+(I?' + registrerte data':''))+cell('m','Mangler',miss?miss+' '+(miss===1?'punkt':'punkter'):'ingenting meldt')+cell('t','Tolkning',tol?tol+' '+(tol===1?'forslag':'forslag'):'ingen')+'</div>'; }
{ const _g=knGround; knGround=function(sc,q,ctx,prevQ){ const G=_g.apply(this,arguments); try{ G.I=i3Analyze(sc,q); if(G.I&&G.I.interp) G.I.interp.push(LH_VERDI.note); }catch(e){ G.I=null; console.error('i3',e); } return G; }; }
{ const _t=knTurnHTML; knTurnHTML=function(T,i){ let h=_t.apply(this,arguments); if(!T.G||T.err) return h; let an=''; try{ an=T.G.I?i3AnHTML(T.G.I):''; }catch(e){ console.error('i3an',e&&e.message); } const ins=an+i3Strip(T), k='<div class="kn-a">'; const p=h.indexOf(k); if(p<0) return h; const end='</div></article>'; let inner=h.slice(p+k.length,h.length-end.length); if(an&&h.endsWith(end)) inner='<details class="i3-src"><summary>Kilder og søketreff i dokumentene ('+knCover(T).all+')</summary>'+inner+'</details>'; return h.slice(0,p+k.length)+ins+inner+(h.endsWith(end)?end:''); }; }
/* arkiverte samtaler mangler beregnet blokk. Strippen vises bare når grunnlaget finnes. */

/* ---------- siden ---------- */
{ const _h=V.kunnskap.html, _w=V.kunnskap.wire;
  V.kunnskap.html=function(){
    const K=UI.kn, sc=K.sc; let h=_h.apply(this,arguments); const ready=knReady(sc);
    h=h.replace('<div class="kn">','<div class="kn i3'+(K.turns.length?'':' i3-fresh')+'">').replace('Grunnlag for samtalen','Spør om').replace('Kunnskap er lesende','Innsikt er lesende').replace('Grunnlag: <b>','Spør om: <b>');
    h=h.replace('Søker bare i registrerte markedskilder og godkjente fellesdokumenter. Kundedata er ikke med.','Søker i registrerte markedskilder og godkjente fellesdokumenter. Kundedata er ikke med. Markedsdekning regnes fra antall organisasjoner i målunivers og er et anslag.')
      .replace('Søker i alle kunder, saker, notater og tilbud i Salong, og i godkjente fellesdokumenter.','Søker i alle kunder, saker, notater og tilbud i Salong, og i godkjente fellesdokumenter. Prioriteringer og anslag regnes ut fra de samme dataene.');
    const ex=I3_EX[sc.t]||[], emp='<div class="i3-empty"><h2>'+(ready?(sc.t==='kunde'?'Hva vil du vite om '+esc(orgName(sc.orgId))+'?':sc.t==='sak'?'Hva vil du vite om saken?':sc.t==='marked'?'Hva vil du vite om markedet?':'Hva vil du vite om porteføljen?'):sc.t==='sak'?'Velg en sak for å begynne':'Velg en kunde for å begynne')+'</h2>'+
      (ready?'<p class="meta">Svaret viser hva det bygger på, hva som er sikkert, hva som mangler og hva som er tolkning. Valgt omfang styrer hvilke kilder som brukes.</p><details class="i3-val"><summary>Grunnlag for alle anbefalinger: Litteraturhusets verdier</summary><p>'+esc(LH_VERDI.vis)+'</p><p>'+esc(LH_VERDI.res)+'</p><p class="meta">'+esc(LH_VERDI.note)+'</p></details><div class="i3-ex" role="group" aria-label="Forslag til spørsmål">'+ex.map(e=>'<button type="button" class="i3-q" data-knex="'+esc(e)+'"><span>'+esc(e)+'</span><i aria-hidden="true">→</i></button>').join('')+'</div>':'<p class="meta">Du kan også velge «Porteføljen» eller «Markedet» over.</p>')+'</div>';
    return h.replace(/<div class="kn-empty">[\s\S]*?<\/div><\/div>(?=<form class="kn-form")/,emp+'</div>');
  };
  V.kunnskap.wire=function(v){ _w.apply(this,arguments);
    v.querySelectorAll('[data-i3open]').forEach(b=>b.addEventListener('click',()=>openOrg(b.dataset.i3open)));
    v.querySelectorAll('[data-i3do]').forEach(b=>b.addEventListener('click',()=>{ const [k,id,deal]=b.dataset.i3do.split(':'); k3Do(k,id,deal); }));
    v.querySelectorAll('[data-i3go]').forEach(b=>b.addEventListener('click',()=>{ const [view,tab]=b.dataset.i3go.split(':'); if(tab&&UI.k3) UI.k3.view=tab; go(view); }));
  };
}
