/* ---------- Målmarked: datamodell og avledning ----------
   Én organisasjon er én account. Accounts avledes fra CRM-organisasjoner, åpne profiler og egne målmarkedsposter,
   og nullstiller aldri eksisterende data. Bare det brukeren faktisk gjør (kvalifiserer, tildeler, logger) lagres.
   market_status beskriver markedsbearbeiding og er adskilt fra pipeline-stegene på saker.
   Kontakter telles aldri som accounts. Dekning = kvalifiserte accounts med logget outbound-touch / alle kvalifiserte. */
S.mtjob=S.mtjob||{}; S.mtacc=S.mtacc||{}; S.mtper=S.mtper||{}; S.mtbat=S.mtbat||{}; S.mtsnap=S.mtsnap||{}; S.mtq=S.mtq||{};
const MT_TARGET='2027-05-31';
/* 15 kjernesegmenter. P0/P1/P2 er PRIORITET (ut fra utadrettet salg, kunnskapsformidlere, forlag, storsal-leietakere og mersalg), ikke del av segmentnavnet.
   est = grov størrelsesklasse på det estimerte markedet. Det er en ANTAKELSE (aldri en liste over organisasjoner) og kan overstyres med et tall under Segmenter. */
const MT_DEF_SEGS=[
 {id:'forlag',name:'Forlag, bok, litteratur og medier',prio:'P0',on:true,est:'M',roles:['Head of Marketing','Event Manager','Communications']},
 {id:'forskning',name:'Forskning, universitetsmiljøer og tenketanker',prio:'P0',on:true,est:'M',roles:['Communications','Programme Manager','Head of Events']},
 {id:'fag',name:'Fag-, profesjons-, medlems- og bransjeorganisasjoner',prio:'P0',on:true,est:'L',roles:['Member Events','Programme Manager','Communications']},
 {id:'ambassade',name:'Ambassader, kulturinstitutter og internasjonale organisasjoner',prio:'P0',on:true,est:'M',roles:['Public Diplomacy / Culture','Communications']},
 {id:'pharma',name:'Helse, pharma og medtech',prio:'P1',on:true,est:'M',roles:['Medical Education','Head of Events','Marketing Director']},
 {id:'ngo',name:'NGO-er, stiftelser og samfunnsorganisasjoner',prio:'P1',on:true,est:'L',roles:['Communications','Programme Manager','Head of Events']},
 {id:'tech',name:'Teknologileverandører, distributører og partnerøkosystemer',prio:'P0',on:true,est:'M',roles:['Partner Marketing','Channel Marketing','Field Marketing']},
 {id:'saas',name:'B2B-teknologi og SaaS',prio:'P1',on:true,est:'L',roles:['Field Marketing','Customer Marketing','Partner Marketing']},
 {id:'finans',name:'Finans og forsikring',prio:'P1',on:true,est:'M',roles:['Customer Marketing','Head of Events','Head of Marketing']},
 {id:'konsulent',name:'Konsulent-, advokat- og rådgivningsmiljøer',prio:'P1',on:true,est:'L',roles:['Head of Marketing','Event Manager','Customer Marketing']},
 {id:'bedrift',name:'Større bedrifter med dokumentert arrangementsaktivitet',prio:'P1',on:true,est:'L',roles:['Events','Head of Marketing','Communications']},
 {id:'offentlig',name:'Offentlig sektor og direktorater',prio:'P2',on:true,est:'M',roles:['Communications','Programme Manager']},
 {id:'utdanning',name:'Utdanning og kompetanseaktører',prio:'P2',on:true,est:'M',roles:['Events','Programme Manager','Communications']},
 {id:'byra',name:'Event-, PR- og kommunikasjonsmiljøer',prio:'P2',on:true,est:'M',roles:['Event Manager','Partnerships']},
 {id:'ovrige',name:'Nettverk, communities og øvrige eventaktive organisasjoner',prio:'P2',on:true,est:'L',roles:['Event Manager','Community','Head of Marketing']}];
const MT_EST={S:'Liten',M:'Middels',L:'Stor'};
const MT_DEF_WAVES=[
 {id:'w1',name:'Wave 1',segs:['forlag','forskning'],goal:80},
 {id:'w2',name:'Wave 2',segs:['fag'],goal:60},
 {id:'w3',name:'Wave 3',segs:['tech'],goal:60},
 {id:'w4',name:'Wave 4',segs:['pharma'],goal:40},
 {id:'w5',name:'Wave 5',segs:['ambassade'],goal:30},
 {id:'w6',name:'Wave 6',segs:['finans','konsulent'],goal:30}];
const MT_RULES=[
 {k:'id',t:'Domene eller org.nr. er registrert',d:'Uten dette kan vi verken avgjøre om samme organisasjon allerede finnes eller berike riktig.'},
 {k:'ev',t:'Eventsignal er minst «Likely»',d:'Dokumentert eller sannsynlig arrangementsaktivitet. «Unknown» er ikke nok.'}];
const MT_STAT={discovered:'Identifisert',qualified:'Kvalifisert',enriched:'Kontakt klar',addressed:'Adressert',engaged:'I dialog',opportunity:'Mulighet',completed:'Ferdig',disqualified:'Diskvalifisert'};
const MT_CHAIN=['discovered','qualified','enriched','addressed','engaged','opportunity'];
const MT_STAGES=[['needs_research','Trenger research'],['needs_enrichment','Trenger enrichment'],['ready','Klar'],['enrolled','Enrolled'],['active','Aktiv'],['replied','Svart'],['completed','Ferdig'],['paused','Pauset']];
const MT_STAGEN=Object.fromEntries(MT_STAGES);
const MT_CH={epost:'E-post',telefon:'Telefon',linkedin:'LinkedIn',mote:'Møte',research:'Research'};
const MT_SEQ_DEF=[{d:1,ch:'epost',t:'Personlig e-post'},{d:3,ch:'telefon',t:'Telefonoppgave'},{d:5,ch:'linkedin',t:'LinkedIn / research'},{d:8,ch:'epost',t:'Oppfølging med relevant use-case'},{d:12,ch:'telefon',t:'Telefon'},{d:17,ch:'epost',t:'Kort siste oppfølging'}];
const MT_SEQ_REACT=[{d:1,ch:'epost',t:'Personlig e-post med referanse til forrige arrangement'},{d:4,ch:'telefon',t:'Telefon'},{d:9,ch:'epost',t:'Nytt for 2027: Solstad og nye rom'},{d:14,ch:'epost',t:'Kort siste oppfølging'}];
const MT_USECASE={forlag:'Lansering, bokslipp eller forfattersamtale',forskning:'Åpent seminar eller rapportlansering',fag:'Fagdag, medlemsmøte eller årskonferanse',tech:'Partnerarrangement eller kundekonferanse',ambassade:'Kulturprogram eller nasjonaldag',pharma:'Faglig møte og medisinsk utdanning, med respekt for bransjens regler',ngo:'Åpent møte, debatt eller høring',finans:'Kundeseminar eller bransjedag',konsulent:'Kunnskapsfrokost eller kundearrangement',saas:'Brukerkonferanse eller kundearrangement',offentlig:'Fagseminar eller høringskonferanse',byra:'Kundearrangement eller lokaler til byråets egne kunder',ovrige:'Arrangement med dokumentert publikum',bedrift:'Kundearrangement, bransjedag eller åpent kunnskapsarrangement',utdanning:'Konferanse, kursdag eller fagseminar'};
const MT_OBJ=[['pris','Pris'],['timing','Timing / dato'],['egen','Har egne lokaler'],['kap','Kapasitet / romtype'],['behov','Ikke behov nå'],['annet','Annet']];
const MT_NEED=[['lansering','Lansering'],['seminar','Seminar / fagdag'],['konferanse','Konferanse'],['debatt','Debatt / åpent møte'],['kurs','Kurs / workshop'],['annet','Annet']];
const MT_OLDSEG={Forlag:'forlag',Forskning:'forskning','Profesjon og forbund':'fag','Helse og pasient':'ngo','Stat og fag':'offentlig',Organisasjon:'ngo',Utdanning:'utdanning','Ambassader og kultur':'ambassade',Livssyn:'ngo',Bedrift:'bedrift',Eventbyrå:'byra','Kurs og enkeltpersoner':'ovrige'};
const MT_BACKSEG={forlag:'Forlag',forskning:'Forskning',fag:'Profesjon og forbund',tech:'Bedrift',ambassade:'Ambassader og kultur',pharma:'Helse og pasient',ngo:'Organisasjon',finans:'Bedrift',konsulent:'Bedrift',saas:'Bedrift',offentlig:'Stat og fag',byra:'Eventbyrå',ovrige:'Bedrift',bedrift:'Bedrift',utdanning:'Utdanning'};
const MT_NAMEKW=[[/forleggerforening|bibliotekforening|forfatterforening|forfatter- og oversetter/i,'fag'],[/ambassade|embassy|kulturinstitutt|goethe|alliance fran|institut fran|nordisk ministerråd|\bfn\b/i,'ambassade'],
 [/forlag|bokhandel|bokmesse|boklansering/i,'forlag'],[/tankesmie|tankesmi|think ?tank|analyse|forskning|universitet|høyskole|\bnupi\b|\bprio\b|\bfafo\b|\bnifu\b|\bisf\b|folkehelseinstitutt|\bsifo\b|oslomet|lesesenter|samfunnsforskning|instituttet/i,'forskning'],
 [/farmasi|pharma|legemiddel|medtech|sykehus|helseforetak/i,'pharma'],[/forening|forbund|psykologforening|utdanningsforbundet|\bnho\b|\bvirke\b|akademikerne|næringsforening/i,'fag'],
 [/røde kors|amnesty|stiftelse|frivillig|humanitær|\bpen\b|\bffo\b|pasientforening|\bicorn\b/i,'ngo']];
const MT_FREEMAIL=/^(gmail|hotmail|outlook|live|yahoo|icloud|online|msn|me|proton|protonmail)\./i;
const MT_ROLEKW={'Events':/event|arrangement/i,'Event Manager':/event|arrangement/i,'Head of Events':/event|arrangement/i,'Marketing Director':/marketing|markedsf|markeds/i,'Head of Marketing':/marketing|markedsf|markeds/i,'Field Marketing':/field/i,'Customer Marketing':/customer|kunde/i,'Partner Marketing':/partner/i,'Channel Marketing':/channel|kanal/i,'Communications':/communic|kommunikasjon|informasjon|presse/i,'Member Events':/member|medlem/i,'Programme Manager':/programme|program|prosjekt/i,'Partnerships':/partner|samarbeid/i,'Public Diplomacy / Culture':/diplomacy|cultur|kultur|press|public/i,'Medical Education':/medical|medisinsk|education|utdanning/i};
const MT_ROOMCAT=[[/solstad/i,'L','Solstad'],[/wergeland/i,'M','Wergeland'],[/skram/i,'M','Skram'],[/collett/i,'M','Collett'],[/hofmo/i,'M','Hofmo'],[/kverneland/i,'S','Kverneland'],[/hagerup/i,'S','Hagerup'],[/berner-?kjeller/i,'M','Berner-kjelleren'],[/berner/i,'S','Berner-salongen'],[/ambj/i,'S','Ambjørnsen'],[/valkea/i,'S','Valkeapää']];
const MT_ROOMKEY={solstad:['L','Solstad'],collett:['M','Collett'],hofmo:['M','Hofmo'],bsalong:['S','Berner-salongen'],ambjornsen:['S','Ambjørnsen'],valkeapaa:['S','Valkeapää'],wergeland:['M','Wergeland'],skram:['M','Skram'],berner:['M','Berner-kjelleren'],hagerup:['S','Hagerup'],kverneland:['S','Kverneland']};
const MT_SCOUT={connected:false,sources:['Brønnøysundregistrene','Forleggerforeningen','Forskningsrådet','LMI (Legemiddelindustrien)','Finans Norge','NHO / Virke','Akademikerne','UDs liste over diplomatiske representasjoner']};
const MT_ENRICHSRC=['Cognism','Apollo','Import','Web'];

/* ---------- konfigurasjon ---------- */
const mtToday=()=>new Date().toISOString().slice(0,10);
const mtDays=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
const mtAddD=(d,n)=>{ const x=new Date(d+'T12:00:00'); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const mtFd=d=>d?fd(String(d).length===10?d:String(d).slice(0,10),{day:'numeric',month:'short'}):'';
function mtCfg(){
  const c=S.settings.mkt||{};
  return {target:c.target||MT_TARGET,goalPct:Number(c.goalPct)||100,
    segs:(()=>{ const L=(c.segs&&c.segs.length?c.segs:MT_DEF_SEGS).slice(); for(const d of MT_DEF_SEGS) if(!L.some(x=>x.id===d.id)) L.push(d); return L.map(s=>({roles:[],on:true,prio:'P2',...s})); })(),
    waves:(c.waves&&c.waves.length?c.waves:MT_DEF_WAVES).map(w=>({segs:[],goal:0,...w})),
    seq:c.seq||{}, rules:{id:true,ev:true,...(c.rules||{})}};
}
const mtSegOf=(cfg,id)=>cfg.segs.find(s=>s.id===id)||null;
const mtSegName=(id)=>{ const s=mtSegOf(mtCfg(),id); return s?s.name:'Uten segment'; };
const MT_SHORT={forlag:'Forlag, bok og medier',forskning:'Forskning og tenketanker',fag:'Fag- og bransjeorg.',tech:'Teknologidistributører',ambassade:'Ambassader og internasj.',pharma:'Helse, pharma og medtech',ngo:'NGO og stiftelser',finans:'Finans og forsikring',konsulent:'Konsulent og rådgivning',saas:'B2B-teknologi og SaaS',offentlig:'Offentlig sektor',byra:'Event-, PR- og kommunikasjon',ovrige:'Nettverk og øvrige',bedrift:'Større bedrifter',utdanning:'Utdanning og kompetanse'};
const mtSegShort=n=>{ const s=(mtCfg().segs||[]).find(x=>x.name===n); return (s&&MT_SHORT[s.id]&&(MT_SHORT[s.id]))||(MT_DEF_SEGS.find(x=>x.name===n)&&MT_SHORT[MT_DEF_SEGS.find(x=>x.name===n).id])||String(n||'').split(/[,·]/)[0].trim(); };
async function mtSaveCfg(patch){ const cur=S.settings.mkt||{}; return settingsRepository.save({mkt:{...cur,...patch}}); }

/* ---------- små hjelpere ---------- */
function mtHost(u){ try{ return new URL(u).hostname.replace(/^www\./,''); }catch(e){ return String(u||'').replace(/^https?:\/\//,'').split('/')[0]; } }
function mtNorm(n){ return normName(n); }
function mtGuessSeg(name,about,oldSeg){
  for(const [re,id] of MT_NAMEKW) if(re.test(name||'')) return id;
  if(oldSeg&&MT_OLDSEG[oldSeg]) return MT_OLDSEG[oldSeg];
  for(const [re,id] of MT_NAMEKW) if(re.test(about||'')) return id;
  return 'ovrige';
}
function mtRoleRe(roles){ return (roles||[]).map(r=>MT_ROLEKW[r]).filter(Boolean); }
function mtOsloText(t){ return /\boslo\b|bygdøy allé|pilestredet|\bgrünerløkka|akershus|\bbærum\b|\blillestrøm\b/i.test(t||''); }
function mtRoomCatOf(text){ const out=[]; for(const [re,c,n] of MT_ROOMCAT) if(re.test(text||'')) out.push({c,n}); return out; }

/* ---------- eventsignal ---------- */
function mtEvent(a,p,doc,ds,bs){
  if(doc&&doc.ev&&doc.ev.level){ const e=doc.ev, src=(e.sources||[]).filter(s=>s&&(s.url||s.label));
    if(e.level==='Confirmed'&&!src.length) return {level:'Likely',sources:[],note:'Registrert som Confirmed uten kilde. Vises som Likely til en kilde er lagt til.',manual:true};
    return {level:e.level,sources:src,note:e.note||'',manual:true}; }
  const src=[];
  for(const u of (p&&p.sources)||[]) src.push({url:u,label:mtHost(u),checkedAt:'sept. 2026'});
  const internal=bs.filter(b=>b.status!=='slettet'&&b.status!=='avbestilt').length+ds.filter(d=>d.stage==='bekreftet').length;
  if(internal) return {level:'Confirmed',sources:[{url:'',label:'Booking eller bekreftet sak hos Litteraturhuset ('+internal+')',checkedAt:''}],note:'',manual:false};
  const evs=((p&&p.events)||[]).filter(e=>!/^(ingen|fant ikke|ikke funnet)/i.test(e));
  if(evs.length&&src.length) return {level:'Confirmed',sources:src,note:evs.slice(0,2).join(' · '),manual:false};
  if(p&&/seminar|konferanse|debatt|arrangement|lansering|fagdag|kurs|årsm[øo]te|festival/i.test((p.about||'')+' '+(p.angle||''))) return {level:'Likely',sources:src,note:'Omtalt i profilen, men uten dokumentert arrangement.',manual:false};
  return {level:'Unknown',sources:[],note:'',manual:false};
}

/* ---------- romfit: bare med grunnlag ---------- */
function mtRoom(a,p,doc,ds,bs){
  if(doc&&doc.room&&doc.room.value&&doc.room.basis) return {...doc.room,manual:true};
  const ev=[]; const add=(c,n,why)=>ev.push({c,n,why});
  for(const d of ds){ if(d.stage==='tapt') continue; const r=RM[d.room]; const att=Number(d.attendees)||0;
    if(att>200) add('L','Solstad','sak med '+att+' deltakere ('+(d.title||'uten tittel')+')'); else if(att>60) add('M','Mellomstore rom','sak med '+att+' deltakere ('+(d.title||'uten tittel')+')'); else if(att>0) add('S','Små rom','sak med '+att+' deltakere ('+(d.title||'uten tittel')+')');
    else if(r){ const k=MT_ROOMKEY[d.room]; if(k) add(k[0],k[1],'sak i '+k[1]); } }
  for(const b of bs){ if(b.status==='slettet'||b.status==='avbestilt') continue; const att=Number(b.attendees)||0;
    if(att>200) add('L','Solstad','booking med '+att+' deltakere'); else if(att>60) add('M','Mellomstore rom','booking med '+att+' deltakere'); else if(att>0) add('S','Små rom','booking med '+att+' deltakere');
    else{ const k=MT_ROOMKEY[b.room]; if(k) add(k[0],k[1],'booking i '+k[1]); else for(const x of mtRoomCatOf(b.room)) add(x.c,x.n,'booking i '+x.n); } }
  if(p&&p.lhHistory&&hasHistory(p)) for(const x of mtRoomCatOf(p.lhHistory)) add(x.c,x.n,'tidligere bruk av '+x.n);
  const cats=[...new Set(ev.map(e=>e.c))];
  if(!cats.length) return {value:'Ukjent',basis:'Ingen dokumentert deltakertall eller romhistorikk.',rooms:[]};
  const names=[...new Set(ev.map(e=>e.n))];
  const val=cats.length>1?'Flere muligheter':cats[0]==='L'?'Solstad':cats[0]==='M'?'Mellomstore rom':'Små rom';
  const basis=[...new Set(ev.map(e=>e.why))].slice(0,3).join(' · ')+(cats[0]==='L'&&cats.length===1?'. Solstad har 320 plasser i stolrader.':'.');
  return {value:val,basis,rooms:names};
}

/* ---------- fit: åpen sum av fem komponenter, ingen KI-score ---------- */
function mtFit(a){
  const P=[];
  const ev=a.ev.level, evPts=ev==='Confirmed'?30:ev==='Likely'?15:0;
  P.push({k:'ev',label:'Dokumentert arrangementshistorikk',max:30,pts:evPts,basis:ev==='Confirmed'?'Confirmed: '+(a.ev.sources[0]?(a.ev.sources[0].label||mtHost(a.ev.sources[0].url)):'dokumentert kilde'):ev==='Likely'?'Likely gir halv poengsum: omtalt, men ikke dokumentert':'Ingen eventsignal registrert'});
  const rv=a.room.value, rPts=rv==='Ukjent'?0:rv==='Små rom'?15:25;
  P.push({k:'room',label:'Rom- og kapasitetsfit',max:25,pts:rPts,basis:rv==='Ukjent'?'Romfit ukjent: ingen grunnlag':rv+(rv==='Små rom'?' (15 av 25: lavere romleie)':'')});
  const pr=a.prio, sPts=pr==='P0'?20:pr==='P1'?12:pr==='P2'?5:0;
  P.push({k:'seg',label:'Segmentprioritet',max:20,pts:sPts,basis:(a.seg?a.seg.name:'Uten segment')+' er '+(pr||'uprioritert')});
  const gPts=a.geo==='oslo'?10:a.geo==='norge'?5:0;
  P.push({k:'geo',label:'Geografi',max:10,pts:gPts,basis:a.geo==='oslo'?'Oslo-området'+(a.place?' ('+a.place+')':''):a.geo==='norge'?'Annet sted i Norge'+(a.place?' ('+a.place+')':''):'Sted er ikke registrert'});
  const zPts=a.size==='L'?10:a.size==='M'?6:a.size==='S'?3:0;
  P.push({k:'size',label:'Størrelse / budsjettproxy',max:10,pts:zPts,basis:a.size?({L:'Stor arrangør',M:'Middels arrangør',S:'Liten arrangør'})[a.size]:'Størrelse ukjent'});
  const rPt=a.rel==='kunde'||a.rel==='fast'?5:a.hasDialog?3:0;
  P.push({k:'rel',label:'Eksisterende relasjon',max:5,pts:rPt,basis:a.rel==='fast'?'Fast leietaker':a.rel==='kunde'?'Har leid hos oss':a.hasDialog?'Tidligere dialog registrert':'Ingen relasjon'});
  return {total:P.reduce((s,x)=>s+x.pts,0),parts:P};
}

/* ---------- kontaktpersoner ---------- */
function mtPersonsOf(acc){
  const out=[], re=mtRoleRe(acc.roles);
  const org=S.orgs[acc.id];
  ((org&&org.contacts)||[]).forEach((c,i)=>{ if(!(c.name||'').trim()) return;
    out.push({id:'crm:'+acc.id+':'+i,accId:acc.id,name:c.name.trim(),title:c.role||'',email:c.email||'',phone:c.phone||'',linkedin:'',source:'CRM',verifiedAt:'',emailStatus:'',phoneStatus:'',quality:'',readonly:true,active:true,dnc:null}); });
  for(const x of acc.perRaw) out.push({...x,readonly:false});
  for(const p of out){ const m=re.some(r=>r.test(p.title||'')); p.roleMatch=m; p.rel=p.rel==='nei'?'nei':p.rel==='kand'?'kand':(p.rel==='ja'||m)?'ja':'?'; p.hasContact=!!(p.email||p.phone||p.linkedin); }
  return out;
}
function mtActivePersons(list){ return list.filter(p=>!p.dnc&&p.rel==='ja'&&p.active!==false).slice(0,2); }
function mtVerLabel(p,field){
  const st=field==='email'?p.emailStatus:p.phoneStatus, enr=MT_ENRICHSRC.includes(p.source);
  if(st==='verifisert'&&enr&&p.verifiedAt) return {t:'Verifisert av '+p.source+' '+fd(String(p.verifiedAt).slice(0,10),{day:'numeric',month:'short',year:'numeric'}),k:'ok'};
  if(st==='ugyldig') return {t:'Ugyldig ifølge '+p.source,k:'bad'};
  if(st==='usikker') return {t:'Usikker ifølge '+p.source,k:'warn'};
  if(enr) return {t:'Oppgitt av '+p.source+(p.verifiedAt?' '+fd(String(p.verifiedAt).slice(0,10),{day:'numeric',month:'short'}):'')+', ikke verifisert',k:'warn'};
  return {t:'Ikke verifisert ('+(p.source==='CRM'?'fra kundekortet':'lagt inn manuelt')+')',k:'none'};
}

/* ---------- avledede accounts ---------- */
let MT_MEMO=null;
function mtKey(){ return DV+'|'+(S.settings.mkt?JSON.stringify(S.settings.mkt):'')+'|'+Object.keys(PROFILES).length+'|'+mtToday()+'|'+(UI.incEx?1:0); }
function mtBuild(){
  const key=mtKey(); if(MT_MEMO&&MT_MEMO.key===key) return MT_MEMO.v;
  const cfg=mtCfg(), today=mtToday(), A=actsOp(), D=dealsOp(), B=bookingsAll();
  const by=(L,k)=>{ const m={}; for(const x of L){ const o=x[k]; if(o) (m[o]=m[o]||[]).push(x); } return m; };
  const aBy=by(A,'orgId'), dBy=by(D,'orgId'), bBy=by(B,'orgId');
  const perBy={}; for(const [id,p] of Object.entries(S.mtper)) if(p&&!p.deletedAt) (perBy[p.accId]=perBy[p.accId]||[]).push({id,...p});
  const batches=Object.entries(S.mtbat).map(([id,b])=>({id,...b})).sort((x,y)=>(x.createdAt||'').localeCompare(y.createdAt||''));
  const inBatch={}; for(const b of batches) if(b.status!=='ferdig') for(const id of b.accIds||[]) inBatch[id]=b;
  const base=[]; const seen=new Set();
  for(const o of allOrgs()){ const real=o.virtual||dqOk(S.orgs[o.id],'orgs',o.id);
    if(real){ base.push({id:o.id,name:o.name,website:o.website||'',orgnr:o.orgnr||'',oldSeg:o.segment||'',tier:o.tier,former:!!o.former,virtual:!!o.virtual,fromOrg:true}); seen.add(o.id); }
    else if(PROFILES[o.id]&&!(S.mtacc[o.id]&&S.mtacc[o.id].removed)){ const p=PROFILES[o.id]; base.push({id:o.id,name:p.name||o.name,website:p.website||'',orgnr:'',oldSeg:p.segment||'',tier:p.tier||'B',former:false,virtual:true,fromOrg:false}); seen.add(o.id); } }
  const mtOnly=[]; for(const [id,d] of Object.entries(S.mtacc)){ if(seen.has(id)||!d||d.removed||!dqOk(d,'mtacc',id)) continue; mtOnly.push({id,name:d.name||'(uten navn)',website:d.website||'',orgnr:d.orgnr||'',oldSeg:'',tier:'B',former:false,virtual:true,fromOrg:false}); }
  const accs=[];
  for(const b of base.concat(mtOnly)){
    const doc=S.mtacc[b.id]||null; if(doc&&doc.removed) continue; const p=PROFILES[b.id]||null, org=b.fromOrg?(S.orgs[b.id]||null):null;
    const rel=b.fromOrg?orgStatus(b.id):'prospekt', ds=dBy[b.id]||[], bs=bBy[b.id]||[], myActs=aBy[b.id]||[];
    const segId=(doc&&doc.segId)||mtGuessSeg(b.name,p&&p.about,b.oldSeg), seg=mtSegOf(cfg,segId);
    const roles=(doc&&doc.roles&&doc.roles.length)?doc.roles:(seg?seg.roles:[]);
    const a={id:b.id,name:(doc&&doc.name)||b.name,tier:b.tier||'',doc,profile:p,org,virtual:!doc&&!org,src:doc?(doc.src||'manuell'):(p?'profil':'crm'),rel,kind:(rel==='prospekt')?'ny':'reaktivering',
      segId,seg,segAuto:!(doc&&doc.segId),prio:seg?seg.prio:'',roles,
      website:(doc&&doc.website)||b.website||'',orgnr:(doc&&doc.orgnr)||b.orgnr||'',perRaw:perBy[b.id]||[],deals:ds,bookings:bs};
    a.domain=(doc&&doc.domain)||domainOf(a.website)||'';
    a.place=(doc&&doc.place)||((p&&mtOsloText((p.contact&&p.contact.address)||'')||(p&&mtOsloText(p.about)))?'Oslo':'');
    const geo=(doc&&doc.geo)||(a.place&&/oslo/i.test(a.place)?'oslo':a.place?'norge':'');
    a.geo=geo; a.size=(doc&&doc.size)||(p&&p.size)||''; a.why=(doc&&doc.why)||(p&&p.angle)||'';
    a.wave=(doc&&doc.wave)||''; a.evsig=(doc&&doc.evsig)||[]; a.prov=(doc&&doc.prov)||null; a.about=(doc&&doc.about)||(p&&p.about)||''; a.contactRoles=(doc&&doc.contactRoles)||[];
    a.hasDialog=myActs.some(x=>x.type!=='task'&&!x.derived&&!x.handover);
    a.enr=(doc&&doc.enr)||null; a.job=bkJobOf(b.id); a.ev=bkMergeEv(mtEvent(a,p,doc,ds,bs),a.enr); a.room=bkMergeRoom(mtRoom(a,p,doc,ds,bs),a.enr); a.fit=mtFit(a);
    a.ownerId=(doc&&doc.ownerId!==undefined?doc.ownerId:(org&&org.ownerId))||null;
    { const allP=mtPersonsOf(a); a.cands=allP.filter(p=>p.rel==='kand'); a.persons=allP.filter(p=>p.rel!=='kand'); } a.active=bkOrder(a,mtActivePersons(a.persons));
    a.dncAcc=!!(doc&&doc.dnc);
    a.hasDnc=a.persons.some(x=>x.dnc);
    /* touches */
    const t={out:0,outP:0,legacy:0,inn:0,last:'',lastOut:''};
    for(const x of myActs){ if(x.type==='task'||x.derived||x.handover) continue; if(/^E-postutkast laget/.test(x.text||'')) continue;
      if(x.mt){ if(x.dir==='in'){ t.inn++; } else { t.out++; if(x.pid) t.outP++; if(!t.lastOut||x.at>t.lastOut) t.lastOut=x.at; } }
      else if(['call','email','meeting','visning'].includes(x.type)&&x.dir!=='in'){ t.legacy++; if(!t.lastOut||x.at>t.lastOut) t.lastOut=x.at; }
      if(!t.last||x.at>t.last) t.last=x.at; }
    const seq=(doc&&doc.seq)||{}; if(seq.lastTouch&&['active','replied','completed','paused'].includes(seq.status||'active')&&(!t.lastOut||String(seq.lastTouch)>t.lastOut.slice(0,10))) t.lastOut=seq.lastTouch;
    a.touch=t; a.seq=seq;
    /* kvalifisering etter åpne regler, med manuell overstyring */
    const fails=[]; if(cfg.rules.id&&!a.domain&&!a.orgnr) fails.push({k:'id',t:'Mangler domene eller org.nr.'}); if(cfg.rules.ev&&a.ev.level==='Unknown') fails.push({k:'ev',t:'Mangler eventsignal (minst Likely)'}); if(!seg||!seg.on) fails.push({k:'seg',t:'Segmentet er ikke aktivt'});
    const q=doc&&doc.qual;
    a.qual={fails,by:'regler',state:'discovered',reason:''};
    if(q&&q.state==='disqualified'){ a.qual={fails,by:'manuell',state:'disqualified',reason:q.reason||'',at:q.at,byName:q.byName}; }
    else if(q&&q.state==='qualified'){ a.qual={fails,by:'manuell',state:'qualified',reason:q.reason||'',at:q.at,byName:q.byName}; }
    else if(!fails.length) a.qual.state='qualified';
    /* flagg */
    const open=ds.some(d=>OPEN.includes(d.stage)||d.stage==='bekreftet'), enrolledStat=['active','replied','completed'].includes(seq.status||'');
    const addr=t.outP>0||t.legacy>0||!!(seq.lastTouch&&enrolledStat);
    const eng=t.inn>0||!!seq.repliedAt||ds.some(d=>d.stage!=='ny')||myActs.some(x=>['meeting','visning'].includes(x.type)&&!x.derived)||open;
    const F={discovered:true,qualified:a.qual.state==='qualified',disqualified:a.qual.state==='disqualified',
      enriched:a.persons.some(x=>x.name&&x.rel==='ja'&&!x.dnc&&x.hasContact),addressed:addr,engaged:eng,opportunity:open,confirmed:ds.some(d=>d.stage==='bekreftet')||bs.some(b=>b.status!=='slettet'&&b.status!=='avbestilt')};
    F.completed=F.addressed||F.disqualified||!!(doc&&doc.done);
    a.flags=F; a.openDeals=ds.filter(d=>OPEN.includes(d.stage)).length;
    let st='discovered';
    if(F.disqualified) st='disqualified'; else if(F.opportunity) st='opportunity'; else if(F.engaged) st='engaged'; else if(doc&&doc.done&&!F.addressed) st='completed'; else if(F.addressed) st='addressed'; else if(F.enriched&&F.qualified) st='enriched'; else if(F.qualified) st='qualified';
    a.status=st; a.warn=(F.addressed||F.engaged)&&!F.qualified&&!F.disqualified?'Har kontakt, men oppfyller ikke målmarkedsreglene. Teller ikke i dekningen.':'';
    a.dialogNoTouch=F.engaged&&!F.addressed&&F.qualified&&a.kind==='ny';
    a.batch=inBatch[b.id]||null;
    const auto=a.dncAcc?'paused':!F.qualified?'needs_research':!F.enriched?'needs_enrichment':'ready';
    a.stage=(doc&&doc.bStage)||auto; a.stageAuto=!(doc&&doc.bStage);
    accs.push(a);
  }
  /* duplikater: samme org.nr. eller domene på to accounts gjelder samme organisasjon */
  const keyOf=a=>a.orgnr?'o:'+a.orgnr:a.domain?'d:'+a.domain:''; const seenK={}, dups=[];
  for(const a of accs){ const k=keyOf(a); if(!k) continue; if(seenK[k]){ a.dupOf=seenK[k]; dups.push([a.id,seenK[k]]); } else seenK[k]=a.id; }
  tierAssign(accs.filter(a=>!a.dupOf));
  for(const a of accs){ a.prog=mtProgress(a,cfg,today); try{ enrDerive(a); }catch(e){ if(!(e instanceof ReferenceError)) throw e; a.es={state:'not_started',label:'Ikke beriket',tone:'',group:'need',detail:'',running:false,cands:[],review:[],general:{emails:[],phones:[],has:false},rec:null,sig:0,errs:[]}; } a.nx=mtNext(a,cfg,today); }
  const v={accs:accs.filter(a=>!a.dupOf),dups,cfg,batches,today};
  MT_MEMO={key,v}; return v;
}
const mtAll=()=>mtBuild().accs;
const mtGet=id=>mtAll().find(a=>a.id===id)||null;

/* ---------- kadens og neste steg ---------- */
function mtCadence(a,cfg){
  cfg=cfg||mtCfg();
  const ck=a.seq&&a.seq.cad, tc=ck&&tierCad(ck); if(tc) return {key:ck,name:tc.name,steps:tc.steps};
  if(a.kind==='reaktivering') return {key:'react',name:'Reaktivering',steps:cfg.seq.react||MT_SEQ_REACT};
  const o=cfg.seq[a.segId]; if(o&&o.length) return {key:a.segId,name:(a.seg?mtSegShort(a.seg.name):'Standard'),steps:o};
  const steps=MT_SEQ_DEF.map((s,i)=>i===3?{...s,t:'Oppfølging: '+(MT_USECASE[a.segId]||'relevant use-case')}:s);
  return {key:'std:'+(a.segId||'x'),name:a.seg?mtSegShort(a.seg.name):'Standard',steps};
}
function mtProgress(a,cfg,today){
  const s=a.seq||{}; if(!s.enrolledAt) return null; const cad=mtCadence(a,cfg), done=s.stepsDone||[];
  const day=mtDays(s.enrolledAt,today)+1;
  const steps=cad.steps.map((x,i)=>{ const due=mtAddD(s.enrolledAt,x.d-1), isDone=done.includes(i);
    return {...x,i,due,done:isDone,state:isDone?'done':due<today?'late':due===today?'due':'later'}; });
  const next=steps.find(x=>!x.done)||null;
  return {name:cad.name,steps,day,next,total:steps.length,doneN:steps.filter(x=>x.done).length,len:steps.length?steps[steps.length-1].d:0};
}
function mtRoleText(a){ const r=a.roles||[]; return r.length?'Ser etter: '+r[0]+(r.length>1?' (+'+(r.length-1)+')':''):'Ser etter: ingen rolle valgt'; }
function mtNext(a,cfg,today){
  const F=a.flags;
  if(F.disqualified) return {k:'dq',t:'Diskvalifisert'+(a.qual.reason?': '+a.qual.reason:''),due:''};
  if(a.dncAcc) return {k:'dnc',t:'Ikke kontakt (opt-out)',due:''};
  if(F.opportunity) return {k:'deal',t:'Følg opp saken',due:''};
  if(a.seq&&a.seq.status==='opt_out') return {k:'dnc',t:'Sekvens stoppet: opt-out, vurder kontakt før ny henvendelse',due:''};
  if(a.seq&&a.seq.status==='bounced') return {k:'enrich',t:'E-post i retur – finn riktig kontaktadresse',due:''};
  if(a.seq&&a.seq.status==='replied'||a.seq&&a.seq.repliedAt&&!F.opportunity) return {k:'reply',t:'Følg opp svar innen 24 timer',due:''};
  if(a.seq&&a.seq.status==='paused') return {k:'paused',t:'Sekvens pauset',due:''};
  if(a.seq&&a.seq.status==='completed') return {k:'seqdone',t:'Sekvens ferdig – vurder neste steg',due:''};
  if(!F.qualified){ const f=a.qual.fails[0]; return {k:'research',t:f?(f.k==='id'?'Finn domene eller org.nr.':f.k==='ev'?'Avklar eventsignal':'Aktiver segment'):'Kvalifiser',due:''}; }
  if(a.prog){ const n=a.prog.next; if(a.stage==='paused') return {k:'paused',t:'Pauset',due:''}; if(!n) return {k:'seqdone',t:'Kadens fullført. Vurder utfall',due:''}; return {k:'step',t:'Dag '+n.d+' · '+MT_CH[n.ch]+' · '+n.t,due:n.due,late:n.due<today}; }
  if(!F.enriched) return {k:'enrich',t:bkNextText(a),due:''};
  if(F.addressed){ const lo=a.touch.lastOut?String(a.touch.lastOut).slice(0,10):''; const d=lo?mtDays(lo,today):0; return {k:'followup',t:d>=5?'Følg opp: '+d+' dager siden touch':'Venter på svar',due:lo?mtAddD(lo,5):''}; }
  return {k:'ready',t:'Klar for kontakt',due:''};
}

/* ---------- statistikk, snapshot, batch, læring ---------- */
function mtStats(list){
  const L=(list||mtAll()).filter(a=>a.kind==='ny'), q=L.filter(a=>a.flags.qualified);
  const r={discovered:L.length,qualified:q.length,enriched:q.filter(a=>a.flags.enriched).length,addressed:q.filter(a=>a.flags.addressed).length,engaged:q.filter(a=>a.flags.engaged).length,opportunity:q.filter(a=>a.flags.opportunity).length,confirmed:q.filter(a=>a.flags.confirmed).length,
    researched:q.filter(a=>a.flags.researched).length,cand:q.filter(a=>a.flags.cand).length,data:q.filter(a=>a.flags.data).length,kready:q.filter(a=>a.flags.kready).length,chosen:q.filter(a=>a.flags.chosen).length,
    disqualified:L.filter(a=>a.flags.disqualified).length,completed:L.filter(a=>a.flags.completed).length,dialogNoTouch:q.filter(a=>a.dialogNoTouch).length,warn:L.filter(a=>a.warn).length};
  r.remaining=r.qualified-r.addressed; r.cov=r.qualified?r.addressed/r.qualified:null; r.done=r.discovered?r.completed/r.discovered:null; return r;
}
function mtSegStats(){
  const cfg=mtCfg(), L=mtAll().filter(a=>a.kind==='ny'); const out=[];
  for(const s of cfg.segs){ const x=mtStats(L.filter(a=>a.segId===s.id)); out.push({...s,...x,seg:s}); }
  const none=L.filter(a=>!mtSegOf(cfg,a.segId)); if(none.length) out.push({id:'',name:'Uten segment',prio:'',on:true,roles:[],...mtStats(none)});
  return out;
}
function mtWeeksLeft(){ const cfg=mtCfg(); return Math.max(1,mtDays(mtToday(),cfg.target)/7); }
function mtSnapNow(){
  const L=mtAll().filter(a=>a.kind==='ny'), st=mtStats(L), per={};
  for(const s of mtSegStats()) if(s.id) per[s.id]={q:s.qualified,a:s.addressed,d:s.discovered};
  return {counts:{discovered:st.discovered,qualified:st.qualified,enriched:st.enriched,addressed:st.addressed,engaged:st.engaged,opportunity:st.opportunity,disqualified:st.disqualified,completed:st.completed},per,
    ids:{discovered:L.map(a=>a.id),qualified:L.filter(a=>a.flags.qualified).map(a=>a.id),addressed:L.filter(a=>a.flags.qualified&&a.flags.addressed).map(a=>a.id)}};
}
const mtSnaps=()=>Object.entries(S.mtsnap).map(([id,s])=>({id,...s})).sort((a,b)=>(b.date+(b.at||'')).localeCompare(a.date+(a.at||'')));
async function mtSnapSave(note){
  const n=mtSnapNow(), id=uid('sn'); const doc={date:mtToday(),at:iso(new Date()),note:note||'',byName:me.name||'',target:mtCfg().target,...n};
  await snapshotRepository.saveRaw(id,doc,{noAudit:true}); return id;
}
function mtSnapDiff(snap){
  if(!snap) return null; const now=mtSnapNow(), c=snap.counts||{};
  const qNow=new Set(now.ids.qualified), qOld=new Set((snap.ids&&snap.ids.qualified)||[]);
  const added=[...qNow].filter(x=>!qOld.has(x)).length, gone=[...qOld].filter(x=>!qNow.has(x)).length;
  const covOld=c.qualified?c.addressed/c.qualified:null, covNow=now.counts.qualified?now.counts.addressed/now.counts.qualified:null;
  return {date:snap.date,covOld,covNow,dQ:now.counts.qualified-(c.qualified||0),dA:now.counts.addressed-(c.addressed||0),dD:now.counts.discovered-(c.discovered||0),added,gone,qOld:c.qualified||0,aOld:c.addressed||0};
}
function mtInBatchIds(){ const s=new Set(); for(const b of mtBuild().batches) if(b.status!=='ferdig') for(const id of b.accIds||[]) s.add(id); return s; }
function mtPick(o){
  const segs=o.segIds&&o.segIds.length?new Set(o.segIds):null, busy=mtInBatchIds();
  const pool=mtAll().filter(a=>a.kind==='ny'&&a.flags.qualified&&!a.flags.disqualified&&!a.flags.addressed&&!a.dncAcc&&!busy.has(a.id)&&(!segs||segs.has(a.segId)));
  pool.sort((x,y)=>y.fit.total-x.fit.total||x.name.localeCompare(y.name,'nb'));
  const n=Math.max(1,Number(o.n)||25); return {rows:pool.slice(0,n),available:pool.length,requested:n};
}
const mtMedian=v=>{ if(!v.length) return null; const s=[...v].sort((a,b)=>a-b), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const mtMode=v=>{ const c={}; for(const x of v) if(x) c[x]=(c[x]||0)+1; const e=Object.entries(c).sort((a,b)=>b[1]-a[1]); return e.length?{v:e[0][0],n:e[0][1],of:v.filter(Boolean).length}:null; };
function mtLearn(){
  const cfg=mtCfg(), L=mtAll().filter(a=>a.kind==='ny'), A=acts(); const out=[];
  for(const s of cfg.segs){ const q=L.filter(a=>a.segId===s.id&&a.flags.qualified), ad=q.filter(a=>a.flags.addressed), en=ad.filter(a=>a.flags.engaged), op=ad.filter(a=>a.flags.opportunity);
    const mt=ad.filter(a=>a.flags.opportunity||A.some(x=>x.orgId===a.id&&['meeting','visning'].includes(x.type))), rp=ad.filter(a=>a.touch.inn>0||(a.seq&&a.seq.repliedAt));
    const mine=A.filter(x=>x.mt&&q.some(a=>a.id===x.orgId));
    const roles=[]; for(const a of en){ for(const p of a.persons) if(A.some(x=>x.pid===p.id&&x.dir==='in')||(a.seq&&a.seq.repliedAt)) roles.push(mtNorm(p.title||'').replace(/\s+/g,' ')||''); }
    const needs=mine.filter(x=>x.need).map(x=>x.need), objs=mine.filter(x=>x.obj).map(x=>x.obj);
    const atts=[]; for(const a of op) for(const d of a.deals){ if(Number(d.attendees)>0) atts.push(Number(d.attendees)); }
    const rooms=[]; for(const a of op) for(const d of a.deals) if(d.room&&RM[d.room]) rooms.push(RM[d.room].n||d.room);
    out.push({id:s.id,name:s.name,prio:s.prio,nAddr:ad.length,nQ:q.length,resp:ad.length?rp.length/ad.length:null,nResp:rp.length,dial:ad.length?en.length/ad.length:null,nDial:en.length,
      meet:ad.length?mt.length/ad.length:null,nMeet:mt.length,opp:ad.length?op.length/ad.length:null,nOpp:op.length,role:mtMode(roles),need:mtMode(needs),obj:mtMode(objs),size:mtMedian(atts),nSize:atts.length,rooms:mtMode(rooms)}); }
  return out;
}
function mtLearnSuggest(rows,minN){
  const ok=rows.filter(r=>r.nAddr>=minN&&r.resp!=null); if(!ok.length) return {basis:false,text:'For tidlig å si. Ingen segmenter har '+minN+' adresserte accounts ennå. Hold deg til segmentprioritet (P0 først) og størst gap i dekning.',list:[]};
  const sc=ok.map(r=>({...r,score:(r.opp||0)*2+(r.meet||0)+(r.resp||0)})).sort((a,b)=>b.score-a.score);
  return {basis:true,text:'Segmenter med best respons og muligheter hittil, kun der n er minst '+minN+'.',list:sc.slice(0,3)};
}

/* ---------- mutasjoner ---------- */
async function mtPatch(id,patch,hist){
  const base=S.mtacc[id]||{}; const doc={...base,...patch};
  if(hist){ doc.hist=[...(base.hist||[]),{at:iso(new Date()),by:me.name||'',t:hist}].slice(-60); }
  if(!base.createdFrom&&!S.mtacc[id]) doc.createdFrom=PROFILES[id]?'profil':S.orgs[id]?'crm':'ny';
  return accountRepository.saveRaw(id,doc,{noAudit:true});
}
async function mtEnsureOrg(a){
  if(S.orgs[a.id]) return; if(PROFILES[a.id]){ await ensureOrg(PROFILES[a.id]); if(S.orgs[a.id]) return; }
  await accountRepository.saveOrgRaw(a.id,{name:a.name,segment:MT_BACKSEG[a.segId]||'Bedrift',tier:a.fit&&a.fit.total>=70?'A':'B',website:a.website||'',orgnr:a.orgnr||'',former:false,notes:'',contacts:[],createdAt:iso(new Date())});
}
async function mtAddAccount(f){
  const name=String(f.name||'').trim(); if(!name) return {err:'Skriv inn navnet.'};
  const dom=domainOf(f.website||f.domain||''), onr=String(f.orgnr||'').replace(/\D/g,'');
  const dup=mtAll().concat(mtBuild().accs).find(a=>(onr&&a.orgnr===onr)||(dom&&a.domain===dom)||mtNorm(a.name)===mtNorm(name));
  if(dup) return {err:dup.name+' finnes allerede i målmarkedet.',dup:dup.id};
  const id='mt-'+slug(name)+'-'+Math.random().toString(36).slice(2,5);
  await accountRepository.saveRaw(id,{name,website:f.website||'',domain:dom,orgnr:onr,segId:f.segId||'ovrige',place:f.place||'',size:f.size||'',why:f.why||'',src:f.src||'manuell',srcUrl:f.srcUrl||'',checkedAt:f.checkedAt||'',createdFrom:'ny',
    ...(f.ev?{ev:f.ev}:{}),hist:[{at:iso(new Date()),by:me.name||'',t:'Lagt til i målmarkedet ('+(f.src||'manuelt')+')'}]},{noAudit:true});
  return {id};
}
async function mtDisqualify(id,reason){ reason=String(reason||'').trim(); if(!reason) return {err:'Diskvalifisering krever en årsak.'}; await mtPatch(id,{qual:{state:'disqualified',reason,at:iso(new Date()),byName:me.name||''}},'Diskvalifisert: '+reason); return {ok:1}; }
async function mtQualify(id,reason){ await mtPatch(id,{qual:{state:'qualified',reason:String(reason||'Manuelt kvalifisert'),at:iso(new Date()),byName:me.name||''}},'Kvalifisert manuelt'); return {ok:1}; }
async function mtResetQual(id){ const d=S.mtacc[id]; if(!d) return; const {qual,...rest}=d; await accountRepository.saveRaw(id,{...rest,hist:[...(d.hist||[]),{at:iso(new Date()),by:me.name||'',t:'Tilbake til målmarkedsreglene'}].slice(-60)},{noAudit:true}); }
async function mtSetOwner(id,ownerId){ const a=mtGet(id); await mtPatch(id,{ownerId:ownerId||null},'Ansvarlig: '+(ownerId?ownName(ownerId):'ufordelt')); if(S.orgs[id]&&S.orgs[id].ownerId!==(ownerId||null)) await accountRepository.saveOrgRaw(id,{...S.orgs[id],ownerId:ownerId||null},{action:'ansvarlig endret fra Prospekter'}); }
async function mtSetEvent(id,level,url,label,note){
  if(level==='Confirmed'&&!String(url||'').trim()&&!String(label||'').trim()) return {err:'Confirmed krever en dokumentert kilde.'};
  const src=(url||label)?[{url:String(url||'').trim(),label:String(label||mtHost(url)||'').trim(),checkedAt:mtToday()}]:[];
  await mtPatch(id,{ev:{level,sources:src,note:note||''}},'Eventsignal satt til '+level); return {ok:1}; }
async function mtSetRoom(id,value,basis){ if(value!=='Ukjent'&&!String(basis||'').trim()) return {err:'Romfit krever et grunnlag.'}; await mtPatch(id,{room:{value,basis:String(basis||'')}},'Romfit satt til '+value); return {ok:1}; }
async function mtAddPerson(accId,f){
  const name=String(f.name||'').trim(); if(!name) return {err:'Skriv inn navnet.'};
  const a=mtGet(accId), email=String(f.email||'').trim().toLowerCase();
  const dup=(a?a.persons:[]).find(p=>(email&&p.email&&p.email.toLowerCase()===email)||(mtNorm(p.name)===mtNorm(name)&&!email));
  if(dup) return {err:dup.name+' finnes allerede på accounten.'};
  const act=a?mtActivePersons(a.persons).length:0, id=uid('pe');
  await contactRepository.saveRaw(id,{accId,name,title:f.title||'',email,phone:f.phone||'',linkedin:f.linkedin||'',source:f.source||'Manuell',verifiedAt:f.verifiedAt||'',emailStatus:f.emailStatus||'',phoneStatus:f.phoneStatus||'',quality:f.quality||'',provider:f.provider||'',sourceUrl:f.sourceUrl||'',sourceId:f.sourceId||'',confidence:f.confidence||'',rel:f.rel!==undefined?f.rel:'ja',active:f.active!==undefined?f.active:act<2,dnc:null},{noAudit:true});
  await mtPatch(accId,{},'Kontaktperson lagt til: '+name+' ('+(f.source||'manuelt')+')'); return {id}; }
async function mtSetPerson(pid,patch){ const p=S.mtper[pid]; if(!p) return; await contactRepository.saveRaw(pid,{...p,...patch},{noAudit:true}); }
async function mtDnc(pid,reason){ const p=S.mtper[pid]; if(!p) return {err:'Kontakten er skrivebeskyttet (fra kundekortet). Marker opt-out der, eller legg til personen her.'}; reason=String(reason||'').trim(); if(!reason) return {err:'Opt-out krever en årsak.'};
  const a=mtGet(p.accId), seq=a&&a.seq&&a.seq.enrolledAt?mtSignalSeq(a.seq,'opt_out'):null;
  await contactRepository.saveRaw(pid,{...p,dnc:{reason,at:iso(new Date()),byName:me.name||''},active:false},{noAudit:true});
  await mtPatch(p.accId,seq?{seq}:{},'Opt-out: '+p.name+' ('+reason+')'+(seq?' · sekvens stoppet':'')); return {ok:1}; }
async function mtClearDnc(pid){ const p=S.mtper[pid]; if(!p) return; await contactRepository.saveRaw(pid,{...p,dnc:null},{noAudit:true}); await mtPatch(p.accId,{},'Opt-out opphevet for '+p.name); }
async function mtDelPerson(pid){ const p=S.mtper[pid]; if(!p) return; await contactRepository.remove(pid); }
/* ett kontrollpunkt: ingen kan enrolles eller eksporteres med opt-out, uten kvalifisering eller uten kontaktdata */
function mtCanEnroll(a){
  const why=[]; if(a.flags.disqualified) why.push('Account er diskvalifisert'); if(!a.flags.qualified) why.push('Account er ikke kvalifisert'); if(a.dncAcc) why.push('Account er merket ikke kontakt');
  const ok=a.active.filter(p=>!p.dnc&&p.rel!=='nei'&&p.email); if(!ok.length) why.push(a.persons.some(p=>p.dnc)?'Alle aktuelle kontakter har opt-out eller mangler e-post':'Ingen aktiv kontaktperson med e-post');
  return {ok:!why.length,why,persons:ok};
}
/* Kun en registrert hendelse (ikke antatt e-poståpning) kan stoppe en sekvens.
   Reaktivering krever nytt, eksplisitt enrollment. Manuell tier endres aldri. */
function mtSignalSeq(seq,signal,at){
  if(!seq||!seq.enrolledAt||!['reply','bounce','opt_out'].includes(signal)) return null;
  if(['replied','bounced','opt_out'].includes(seq.status)) return null;
  const day=String(at||mtToday()).slice(0,10);
  const status=({reply:'replied',bounce:'bounced',opt_out:'opt_out'})[signal];
  return {...seq,status,unenrolledAt:day,unenrollReason:signal,
    ...(signal==='reply'?{repliedAt:day}:{})};
}
async function mtLogTouch(id,f){
  const a=mtGet(id); if(!a) return {err:'Ukjent account.'}; const p=f.pid?a.persons.find(x=>x.id===f.pid):null;
  if(!['epost','telefon','linkedin','mote'].includes(f.ch||'epost')) return {err:'Ukjent kontaktkanal.'};
  if(p&&p.dnc) return {err:p.name+' har opt-out og kan ikke kontaktes.'};
  if(a.dncAcc&&f.dir!=='in') return {err:'Accounten er merket ikke kontakt.'};
  await mtEnsureOrg(a); const ch=f.ch||'epost', type=f.res==='bounce'?'note':ch==='telefon'?'call':ch==='epost'?'email':ch==='mote'?'meeting':'note', dir=f.dir==='in'?'in':'out';
  const bounce=f.res==='bounce', text=(f.text||'').trim()||(bounce?'E-post kom i retur':({epost:'E-post',telefon:'Telefon',linkedin:'LinkedIn',mote:'Møte'})[ch]+(dir==='in'?' fra ':' til ')+(p?p.name:'organisasjonen'));
  await activityRepository.saveRaw(uid('a'),{orgId:id,dealId:null,type,text,at:iso(f.at?new Date(f.at):new Date()),due:null,done:true,byId:me.id||null,byName:me.name||'',...(typeof actorStamp==='function'?actorStamp():{}),
    mt:bounce?0:1,dir,ch,pid:p?p.id:null,pname:p?p.name:'',res:f.res||'',need:f.need||'',obj:f.obj||''});
  const signal=bounce?'bounce':dir==='in'?'reply':null, next=signal?mtSignalSeq(a.seq,signal):null;
  await mtPatch(id,next?{seq:next}:{},(bounce?'E-post i retur':(dir==='in'?'Innkommende ':'Utgående ')+MT_CH[ch].toLowerCase())+(p?' · '+p.name:' · uten person')+(next?' · sekvens stoppet':''));
  return {ok:1,noPerson:!p&&dir==='out',sequence_stopped:!!next}; }
/* Hurtiglogging: én lagret aktivitet og, ved telefonsteg, én fremdriftsmarkering.
   Ingen e-post sendes. Kun en faktisk valgt kontakt med telefon kan brukes. */
async function mtLogCallOutcome(id,outcome){
  const names={reached:'Nådd',not_reached:'Ikke nådd',call_later:'Svarer senere'};
  if(!Object.hasOwn(names,outcome)) return {err:'Velg et gyldig samtaleutfall.'};
  const a=mtGet(id); if(!a) return {err:'Ukjent account.'};
  if(a.flags.disqualified||a.dncAcc||['opt_out','bounced','replied','paused','completed'].includes(a.seq&&a.seq.status)){
    return {err:'Accounten er stoppet eller kan ikke kontaktes fra denne flyten.'};
  }
  const p=(a.active||[]).find(x=>x.phone&&!x.dnc);
  if(!p) return {err:'Ingen aktiv kontakt med telefonnummer.'};
  const res=await mtLogTouch(id,{ch:'telefon',dir:'out',pid:p.id,res:outcome,
    text:'Telefon: '+names[outcome]+' · '+p.name});
  if(!res.ok) return res;
  const next=a.prog&&a.prog.next;
  if(next&&next.ch==='telefon'&&next.due<=mtToday()&&!(a.seq.stepsDone||[]).includes(next.i)){
    const stepsDone=[...(a.seq.stepsDone||[]),next.i];
    await mtPatch(id,{seq:{...a.seq,status:'active',stepsDone,lastTouch:mtToday()}},
      'Telefonsteg fullført: '+names[outcome]);
  }
  return {...res,outcome};
}
async function mtSetStage(id,stage){
  const a=mtGet(id); if(!a) return {err:'Ukjent account.'};
  if(['enrolled','active'].includes(stage)){ const c=mtCanEnroll(a); if(!c.ok) return {err:'Kan ikke enrolles: '+c.why.join('. ')+'.'}; }
  const seq={...(a.seq||{})}; if(stage==='enrolled'&&!seq.enrolledAt){ seq.enrolledAt=mtToday(); seq.status='not_started'; seq.stepsDone=[]; { const cs=mtCfg().seq[a.segId]; if(a.kind==='ny'&&a.pt&&!seq.cad&&!(cs&&cs.length)) seq.cad='T'+a.pt; } }
  if(stage==='active') seq.status='active'; if(stage==='paused') seq.status='paused'; if(stage==='completed') seq.status='completed';
  if(stage==='replied'){ const stopped=mtSignalSeq(seq,'reply'); Object.assign(seq,stopped||{status:'replied',repliedAt:seq.repliedAt||mtToday()}); }
  const keepAuto=['needs_research','needs_enrichment','ready'].includes(stage);
  const d0=S.mtacc[id]||{}; const doc={...d0,seq}; if(keepAuto) delete doc.bStage; else doc.bStage=stage;
  doc.hist=[...(d0.hist||[]),{at:iso(new Date()),by:me.name||'',t:'Batch-steg: '+MT_STAGEN[stage]}].slice(-60); if(!S.mtacc[id]) doc.createdFrom=PROFILES[id]?'profil':S.orgs[id]?'crm':'ny';
  await accountRepository.saveRaw(id,doc,{noAudit:true});
  return {ok:1}; }
async function mtStep(id,i){
  const a=mtGet(id); if(!a||!a.prog||['replied','bounced','opt_out','completed','paused'].includes(a.seq.status)) return; const s=a.prog.steps[i]; if(!s) return; const cur=(a.seq.stepsDone||[]).slice(); const on=!cur.includes(i);
  if(on){ cur.push(i); const pe=a.active[0]; if(s.ch!=='research'&&pe&&!pe.dnc) await mtLogTouch(id,{ch:s.ch,dir:'out',pid:pe.id,text:'Dag '+s.d+': '+s.t}); } else cur.splice(cur.indexOf(i),1);
  await mtPatch(id,{seq:{...a.seq,stepsDone:cur,status:a.seq.status==='not_started'?'active':a.seq.status,lastTouch:on?mtToday():a.seq.lastTouch}},null);
  if(on&&(a.stage==='enrolled')) await mtPatch(id,{bStage:'active'},null); }
async function mtCreateBatch(o){
  const id=uid('ba'), n=mtBuild().batches.length+1; const ids=o.ids||[];
  await batchRepository.saveRaw(id,{name:o.name||('Batch '+n),segIds:o.segIds||[],wave:o.wave||'',size:ids.length,requested:o.requested||ids.length,status:'aktiv',accIds:ids,ownerId:o.ownerId||null,byName:me.name||'',createdAt:iso(new Date())},{noAudit:true});
  if(o.ownerId) for(const aid of ids){ const a=mtGet(aid); if(a&&!a.ownerId) await mtSetOwner(aid,o.ownerId); }
  return id; }
async function mtBatchStatus(id,status){ const b=S.mtbat[id]; if(!b) return; await batchRepository.saveRaw(id,{...b,status},{noAudit:true}); }
async function mtBatchRemove(id,accId){ const b=S.mtbat[id]; if(!b) return; await batchRepository.saveRaw(id,{...b,accIds:(b.accIds||[]).filter(x=>x!==accId),size:(b.accIds||[]).filter(x=>x!==accId).length},{noAudit:true}); }

/* ---------- CSV ---------- */
const mtQ=v=>{ v=String(v??''); return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
const mtCsv=(head,rows)=>[head,...rows].map(r=>r.map(mtQ).join(',')).join('\r\n');
const MT_SYN={
  first:['first name','firstname','first_name','fornavn'],last:['last name','lastname','last_name','etternavn'],name:['full name','name','navn','contact name','contact'],
  title:['job title','title','jobtitle','job_title','stilling','position','tittel'],email:['email','e-mail','epost','e-post','work email','business email','email address'],
  emailStatus:['email status','email_status','email verification','email validity','email_verification_status'],phone:['phone','mobile','direct phone','mobile phone','telefon','phone number','direct dial','mobile number','direct_phone'],
  phoneStatus:['phone status','phone_status','phone verification'],linkedin:['linkedin','linkedin url','linkedin_url','linkedin profile','person linkedin url'],
  company:['company','company name','account','account name','organization','organisation','organisasjon','company_name'],domain:['domain','website','company domain','company website','account domain','company_domain','organization website'],
  orgnr:['org.nr','orgnr','organization number','organisasjonsnummer','org number','org.nr.'],verifiedAt:['contact_verified_at','last verified','verified at','verified_at','date verified','verified date','last updated'],
  quality:['contact_data_quality','data quality','data_quality','quality','confidence','confidence score'],salongId:['salong_account_id','salong id','salong_id','account id','account_id']};
const MT_SYN_APOLLO={email:MT_SYN.email,seqName:['sequence','sequence name','sequence_name','campaign','emailer campaign'],status:['sequence status','sequence_status','status','contact status'],
  lastTouch:['last contacted','last touch','last_touch','last contacted date','last activity','last_contacted'],nextTouch:['next touch','next_touch','next step due','next step date','next_step_due'],
  repliedAt:['replied at','replied_at','last replied','reply date','replied'],enrolledAt:['enrolled at','enrolled_at','added to sequence','sequence start','started at'],extId:['sequence id','sequence_id','external id','apollo sequence id'],salongId:MT_SYN.salongId};
const MT_SYN_SCOUT={name:['navn','name','organisasjon','organization','organisation'],domain:['domene','domain','nettside','website','url'],orgnr:MT_SYN.orgnr,segment:['segment','kategori','type'],place:['sted','place','by','city','location'],
  size:['størrelse','size','størrelsessignal','size signal','ansatte','employees'],evLevel:['eventsignal','event signal','event_signal','signal'],evText:['arrangementsignal','event evidence','arrangement','arrangementer','event'],
  srcUrl:['kilde-url','kilde url','source url','source_url','kilde','source'],checked:['sist kontrollert','last checked','checked','checked_at','kontrollert'],why:['hvorfor','why','begrunnelse','forklaring','relevans']};
function mtAutoMap(head,syn){ const m={}; const h=head.map(x=>String(x||'').trim().toLowerCase());
  for(const [k,names] of Object.entries(syn)){ const i=h.findIndex(x=>names.includes(x)); m[k]=i<0?'':String(i); } return m; }
const mtCell=(r,m,k)=>{ const i=m[k]; return i===''||i==null?'':String(r[Number(i)]??'').trim(); };
function mtDate(s){ s=String(s||'').trim(); if(!s) return ''; let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[0]; m=s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10); }
function mtQuality(v){ v=String(v||'').trim(); if(!v) return ''; const n=Number(v); if(!isNaN(n)&&v!=='') return n>=80?'A':n>=50?'B':'C'; if(/^(a|high|høy|very high)/i.test(v)) return 'A'; if(/^(b|med)/i.test(v)) return 'B'; if(/^(c|low|lav)/i.test(v)) return 'C'; return v.slice(0,12); }
function mtVerState(v){ v=String(v||'').toLowerCase(); if(!v) return ''; if(/invalid|bounce|ugyldig|undeliver/.test(v)) return 'ugyldig'; if(/risky|catch|unknown|uncertain|usikker/.test(v)) return 'usikker'; if(/valid|verified|safe|ok|deliverable|gyldig|verifisert|confirmed/.test(v)) return 'verifisert'; return ''; }
function mtIndex(){ const L=mtBuild().accs, byO={}, byD={}, byN={}, byI={}; for(const a of L){ byI[a.id]=a; if(a.orgnr) byO[a.orgnr]=a; if(a.domain) byD[a.domain]=a; byN[mtNorm(a.name)]=a; } return {byO,byD,byN,byI}; }
function mtMatchRow(ix,r,m){
  const sid=mtCell(r,m,'salongId'); if(sid&&ix.byI[sid]) return ix.byI[sid];
  const on=mtCell(r,m,'orgnr').replace(/\D/g,''); if(on&&ix.byO[on]) return ix.byO[on];
  let d=domainOf(mtCell(r,m,'domain')); if(d&&ix.byD[d]) return ix.byD[d];
  const em=mtCell(r,m,'email').toLowerCase(); const ed=em.includes('@')?em.split('@')[1]:''; if(ed&&!MT_FREEMAIL.test(ed)&&ix.byD[ed]) return ix.byD[ed];
  const n=mtNorm(mtCell(r,m,'company')); if(n&&ix.byN[n]) return ix.byN[n]; return null; }

/* Cognism: forhåndsvisning og import. Kilde og tidspunkt følger hver kontakt. */
function mtCognismPlan(rows,m,opt){
  const ix=mtIndex(), out={add:[],dup:[],unmatched:[],dnc:[],bad:0}; const body=rows.slice(1); const seenE=new Set();
  for(const r of body){
    let name=mtCell(r,m,'name'); if(!name) name=(mtCell(r,m,'first')+' '+mtCell(r,m,'last')).trim(); if(!name){ out.bad++; continue; }
    const email=mtCell(r,m,'email').toLowerCase(), a=mtMatchRow(ix,r,m);
    if(!a){ out.unmatched.push({name,title:mtCell(r,m,'title'),company:mtCell(r,m,'company')||mtCell(r,m,'domain'),email,row:r}); continue; }
    const ex=a.persons.find(p=>(email&&p.email&&p.email.toLowerCase()===email)||(!email&&mtNorm(p.name)===mtNorm(name)));
    if(ex||(email&&seenE.has(email))){ out.dup.push({name,acc:a.name,accId:a.id}); continue; } if(email) seenE.add(email);
    if(a.dncAcc){ out.dnc.push({name,acc:a.name}); continue; }
    out.add.push({accId:a.id,acc:a.name,f:{name,title:mtCell(r,m,'title'),email,phone:mtCell(r,m,'phone'),linkedin:mtCell(r,m,'linkedin'),source:'Cognism',verifiedAt:mtDate(mtCell(r,m,'verifiedAt')),
      emailStatus:mtVerState(mtCell(r,m,'emailStatus')),phoneStatus:mtVerState(mtCell(r,m,'phoneStatus')),quality:mtQuality(mtCell(r,m,'quality'))}}); }
  return out;
}
async function mtCognismRun(plan,createMissing){
  let n=0, made=0; const today=mtToday();
  if(createMissing) for(const u of plan.unmatched){ const dom=domainOf(u.company)||'', res=await mtAddAccount({name:u.company||'(uten navn)',website:dom?'https://'+dom:'',src:'Cognism-import'}); if(res.id){ made++; const a=mtGet(res.id); if(a){ await mtAddPerson(res.id,{name:u.name,title:u.title,email:u.email,source:'Cognism',rel:'',verifiedAt:'',emailStatus:'',quality:''}); n++; } } }
  const perAcc={};
  for(const x of plan.add){ const cnt=perAcc[x.accId]||0; const acc=mtGet(x.accId); const relevant=acc?mtRoleRe(acc.roles).some(r=>r.test(x.f.title||'')):false;
    const act=acc?mtActivePersons(acc.persons).length+cnt:0; const res=await mtAddPerson(x.accId,{...x.f,rel:relevant?'ja':'',active:relevant&&act<2}); if(res.id){ n++; if(relevant) perAcc[x.accId]=cnt+1; } }
  return {n,made}; }
function mtEnrichCsv(list){
  const head=['salong_account_id','company','domain','org_nr','segment','place','wanted_roles','known_contacts','requested_at'];
  const rows=list.map(a=>[a.id,a.name,a.domain,a.orgnr,a.seg?mtSegShort(a.seg.name):'',a.place,(a.roles||[]).join('; '),a.persons.length,mtToday()]);
  return mtCsv(head,rows); }
function mtApolloPrep(list,seqName){
  const head=['first_name','last_name','email','title','company','domain','linkedin_url','phone','salong_account_id','salong_person_id','segment','sequence_name','batch','market_status'];
  const rows=[], skipped=[], inc=[];
  for(const a of list){ const c=mtCanEnroll(a); if(!c.ok){ skipped.push({id:a.id,name:a.name,why:c.why.join('. ')}); continue; }
    for(const p of c.persons){ const parts=p.name.split(/\s+/), last=parts.length>1?parts.pop():'', first=parts.join(' ');
      rows.push([first,last,p.email,p.title,a.name,a.domain,p.linkedin,p.phone,a.id,p.id,a.seg?mtSegShort(a.seg.name):'',seqName||mtCadence(a).name,a.batch?a.batch.name:'',a.status]); }
    inc.push(a.id); }
  return {csv:mtCsv(head,rows),rows:rows.length,accs:inc,skipped}; }
async function mtApolloMark(ids,seqName){ for(const id of ids){ const a=mtGet(id); await mtPatch(id,{seq:{...(a.seq||{}),preparedAt:mtToday(),name:(a.seq&&a.seq.name)||seqName||mtCadence(a).name}},'Klargjort for Apollo'); } }
function mtApolloPlan(rows,m){
  const ix=mtIndex(), body=rows.slice(1), out={apply:[],unmatched:[],dnc:[],unsub:[]}; const byEmail={};
  for(const a of mtBuild().accs) for(const p of a.persons) if(p.email) byEmail[p.email.toLowerCase()]={a,p};
  for(const r of body){ const em=mtCell(r,m,'email').toLowerCase(), sid=mtCell(r,m,'salongId'); let hit=em?byEmail[em]:null; if(!hit&&sid&&ix.byI[sid]) hit={a:ix.byI[sid],p:null};
    if(!hit){ out.unmatched.push(em||sid||'(tom rad)'); continue; }
    const st=String(mtCell(r,m,'status')||'').toLowerCase(); const n=/unsub|opt|avmeld|do not contact/.test(st)?'unsub':/bounce|ugyldig/.test(st)?'bounced':/repl|svar/.test(st)?'replied':/finish|complet|ferdig|done/.test(st)?'completed':/pause/.test(st)?'paused':/not.?start|queued|scheduled|ikke startet/.test(st)?'not_started':/activ|progress|aktiv|running/.test(st)?'active':st;
    const x={a:hit.a,p:hit.p,status:n,seqName:mtCell(r,m,'seqName'),extId:mtCell(r,m,'extId'),enrolledAt:mtDate(mtCell(r,m,'enrolledAt')),lastTouch:mtDate(mtCell(r,m,'lastTouch')),nextTouch:mtDate(mtCell(r,m,'nextTouch')),repliedAt:mtDate(mtCell(r,m,'repliedAt'))};
    if(n==='unsub'){ out.unsub.push(x); continue; }
    if(hit.p&&hit.p.dnc||hit.a.dncAcc){ out.dnc.push(x); continue; } out.apply.push(x); }
  return out; }
async function mtApolloRun(plan){
  let n=0; for(const x of plan.unsub){ if(x.p&&!x.p.readonly&&!x.p.dnc) await mtDnc(x.p.id,'Avmeldt i Apollo'+(x.lastTouch?' '+x.lastTouch:'')); }
  for(const x of plan.apply){ const a=mtGet(x.a.id); if(!a) continue; const seq={...(a.seq||{})}; if(x.seqName) seq.name=x.seqName; if(x.extId) seq.extId=x.extId; if(x.enrolledAt) seq.enrolledAt=x.enrolledAt; else if(!seq.enrolledAt&&x.status!=='bounced') seq.enrolledAt=mtToday();
    if(x.lastTouch) seq.lastTouch=x.lastTouch; if(x.nextTouch) seq.nextTouch=x.nextTouch; if(x.repliedAt||x.status==='replied') seq.repliedAt=x.repliedAt||seq.repliedAt||mtToday(); seq.status=x.status||seq.status; seq.source='Apollo-import'; seq.importedAt=mtToday(); seq.stepsDone=seq.stepsDone||[];
    const stage=x.status==='replied'?'replied':x.status==='completed'?'completed':x.status==='paused'?'paused':x.status==='not_started'?'enrolled':x.status==='active'?'active':null;
    if(x.status==='bounced'&&x.p&&!x.p.readonly) await mtSetPerson(x.p.id,{emailStatus:'ugyldig'});
    await mtPatch(x.a.id,{seq,...(stage?{bStage:stage}:{})},'Apollo-status importert: '+(x.status||'ukjent')); n++; }
  return {n,unsub:plan.unsub.length}; }

/* Market Scout: ikke tilkoblet. Her er bare importkøen. Ingen kandidater er funnet av Salong. */
function mtScoutParse(rows,m){
  const ix=mtIndex(), segs=mtCfg().segs, body=rows.slice(1), out=[]; const seenO=new Set(), seenD=new Set();
  for(const r of body){ const name=mtCell(r,m,'name'); if(!name) continue; const dom=domainOf(mtCell(r,m,'domain')), onr=mtCell(r,m,'orgnr').replace(/\D/g,'');
    const sv=mtCell(r,m,'segment').toLowerCase(); const seg=segs.find(s=>s.id===sv||s.name.toLowerCase()===sv||mtSegShort(s.name).toLowerCase()===sv)||null;
    let evLevel=/^conf/i.test(mtCell(r,m,'evLevel'))?'Confirmed':/^like/i.test(mtCell(r,m,'evLevel'))?'Likely':'Unknown'; const url=mtCell(r,m,'srcUrl');
    if(evLevel==='Confirmed'&&!url) evLevel='Likely';
    const hit=(onr&&ix.byO[onr])||(dom&&ix.byD[dom])||ix.byN[mtNorm(name)]||null; const inQ=(onr&&seenO.has(onr))||(dom&&seenD.has(dom)); if(onr) seenO.add(onr); if(dom) seenD.add(dom);
    out.push({name,domain:dom,orgnr:onr,segId:seg?seg.id:'',segText:mtCell(r,m,'segment'),place:mtCell(r,m,'place'),sizeSignal:mtCell(r,m,'size'),evLevel,evText:mtCell(r,m,'evText'),srcUrl:url,checkedAt:mtDate(mtCell(r,m,'checked')),why:mtCell(r,m,'why'),
      dupOf:hit?hit.id:(inQ?'(kø)':''),dupName:hit?hit.name:(inQ?'allerede i denne filen':''),status:hit||inQ?'duplikat':'ny'}); }
  return out;
}
async function mtScoutSave(list,fileName){
  let n=0; for(const x of list){ const id=uid('q'); await scoutRepository.saveRaw(id,{...x,importedAt:iso(new Date()),file:fileName||'',byName:me.name||''},{noAudit:true}); n++; } return n; }
async function mtScoutApprove(qid){
  const q=S.mtq[qid]; if(!q) return {err:'Finnes ikke.'}; if(q.status==='godkjent') return {err:'Allerede godkjent.'};
  const sz=/^[SML]$/i.test(q.sizeSignal)?q.sizeSignal.toUpperCase():''; const ev=q.evLevel!=='Unknown'||q.srcUrl?{level:q.evLevel,sources:q.srcUrl?[{url:q.srcUrl,label:mtHost(q.srcUrl),checkedAt:q.checkedAt||''}]:[],note:q.evText||''}:undefined;
  const res=await mtAddAccount({name:q.name,domain:q.domain,website:q.domain?'https://'+q.domain:'',orgnr:q.orgnr,segId:q.segId||'ovrige',place:q.place,size:sz,why:q.why,src:'scout-import',srcUrl:q.srcUrl,checkedAt:q.checkedAt,ev});
  if(res.err) return res; await scoutRepository.saveRaw(qid,{...q,status:'godkjent',accId:res.id},{noAudit:true}); return res; }
async function mtScoutReject(qid,reason){ const q=S.mtq[qid]; if(!q) return; await scoutRepository.saveRaw(qid,{...q,status:'avvist',reason:reason||''},{noAudit:true}); }
const mtScoutRows=()=>Object.entries(S.mtq).map(([id,q])=>({id,...q})).sort((a,b)=>(b.importedAt||'').localeCompare(a.importedAt||''));
const MT={all:mtAll,get:mtGet,stats:mtStats,segStats:mtSegStats,cfg:mtCfg,pick:mtPick,learn:mtLearn,snapNow:mtSnapNow,snapDiff:mtSnapDiff,canEnroll:mtCanEnroll,apolloPrep:mtApolloPrep,cognismPlan:mtCognismPlan,apolloPlan:mtApolloPlan,
  addAccount:mtAddAccount,addPerson:mtAddPerson,dnc:mtDnc,disqualify:mtDisqualify,qualify:mtQualify,logTouch:mtLogTouch,logCall:mtLogCallOutcome,setStage:mtSetStage,createBatch:mtCreateBatch,snapSave:mtSnapSave,setOwner:mtSetOwner,scoutParse:mtScoutParse,scoutSave:mtScoutSave,scoutApprove:mtScoutApprove,
  cognismRun:mtCognismRun,apolloRun:mtApolloRun,autoMap:mtAutoMap,SYN:MT_SYN,SYNA:MT_SYN_APOLLO,SYNS:MT_SYN_SCOUT,setEvent:mtSetEvent,setRoom:mtSetRoom,enrichCsv:mtEnrichCsv,apolloMark:mtApolloMark,build:mtBuild,parse:parseCSV,fit:mtFit,patch:mtPatch,cadence:mtCadence,step:mtStep};
