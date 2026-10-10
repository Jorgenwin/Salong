/* ---------- Tier: prioritering mot målet «Litteraturhuset som foretrukket arena» ----------
   Tier 1 = toppmål (mest energi, personlig), Tier 2 = ring (ca. 30 % av tiden), Tier 3 = nice to have (automatisert e-post).
   Tier er avledet fra to åpne ting: kulturprofil (segment + tydelige tekstsignaler) og fit-poengene som allerede finnes.
   Brukeren kan alltid overstyre per account (doc.pt). Ingenting slettes eller skjules: de gamle segmentene og fit-scoren er uendret.
   Bedrifter som Experis kan fortsatt komme, men havner som standard i Tier 3 med mindre brukeren løfter dem. */
var TIER_D=null;
function tierD(){ if(TIER_D) return TIER_D;
  /* kulturprofil per segment: 3 = kjerne (litteratur, kunnskap, kultur), 2 = nær, 1 = rand, 0 = bedrift/annet */
  const cult={forlag:3,ambassade:2,forskning:2,fag:2,ngo:2,ovrige:1,utdanning:1,offentlig:1,byra:1,tech:1,pharma:0,saas:0,finans:0,konsulent:0,bedrift:0};
  const kw=/litterat|\bbok\b|bøker|bokslipp|forfatter|forlag|lesning|lesing|poesi|dikt|kultur(?!hus|enhet)|festival|konsert|musikk|\bkunst(?!ig)|teater|film\b|debatt|ytringsfrihet|bibliotek|museum|oversett|kritiker/gi;
  const lbl={3:'Kjerne: litteratur og kultur',2:'Nær: formidling og kunnskap',1:'Rand',0:'Bedrift og annet'};
  const tiers={1:{n:'Tier 1',t:'Toppmål',d:'Der du bruker mest energi: personlig kontakt, visning og møte.',min:40},2:{n:'Tier 2',t:'Ring',d:'Rundt 30 % av tiden: telefon først, så e-post.',min:12},3:{n:'Tier 3',t:'E-post',d:'Nice to have: automatiserte e-poster. Svar følger du opp selv.',min:1.5}};
  /* kadenser per tier. m = e-postmal. bulk = kan lages som utkast i bulk uten personlig tilpasning */
  const cad={
   T1:{name:'Tier 1: personlig',steps:[{d:1,ch:'research',t:'Les programmet deres og finn en konkret anledning'},{d:2,ch:'epost',t:'Personlig e-post med invitasjon til å se stedet',m:'t1a'},{d:5,ch:'telefon',t:'Ring og foreslå en visning'},{d:9,ch:'mote',t:'Besøk eller visning'},{d:14,ch:'epost',t:'Oppfølging med forslag til dato',m:'t1b'},{d:21,ch:'telefon',t:'Ring: hva trenger dere for å bestemme dere?'}]},
   T2:{name:'Tier 2: ring',steps:[{d:1,ch:'telefon',t:'Ring: mer kapasitet, vil dere se stedet?'},{d:2,ch:'epost',t:'Oppsummering etter samtale (eller kort invitasjon)',m:'t2a',bulk:true},{d:8,ch:'telefon',t:'Ring igjen'},{d:15,ch:'epost',t:'Siste høflige oppfølging',m:'t2b',bulk:true}]},
   T3:{name:'Tier 3: e-postsekvens',steps:[{d:1,ch:'epost',t:'Vi har åpnet mer kapasitet',m:'t3a',bulk:true},{d:6,ch:'epost',t:'Hva salene egner seg til',m:'t3b',bulk:true},{d:14,ch:'epost',t:'Kom og se stedet, uten binding',m:'t3c',bulk:true},{d:28,ch:'epost',t:'Siste høflige oppfølging',m:'t3d',bulk:true}]},
   PB:{name:'Byråer og partnere',steps:[{d:1,ch:'epost',t:'Mer kapasitet. Vil dere se stedet?',m:'pba',bulk:true},{d:7,ch:'linkedin',t:'LinkedIn eller kort telefon'},{d:14,ch:'epost',t:'Oppfølging med tilbud om visning',m:'pbb',bulk:true},{d:28,ch:'epost',t:'Siste høflige oppfølging',m:'t3d',bulk:true}]}};
  // Telefon-først-kadenser for aktivering direkte fra I dag.
  cad.ID27_KULTUR={name:'Rolig kultursekvens',steps:[
    {d:1,ch:'telefon',t:'Ring med personlig vinkling'},
    {d:4,ch:'epost',t:'Lag personlig oppfølging etter samtalen'},
    {d:10,ch:'telefon',t:'Ring igjen og avklar interesse'},
    {d:18,ch:'epost',t:'Siste høflige oppfølging'}]};
  cad.ID27_KOMMERS={name:'Aktiv kommersiell sekvens',steps:[
    {d:1,ch:'telefon',t:'Ring om arrangement eller samarbeid'},
    {d:3,ch:'epost',t:'Oppsummer og foreslå relevant sal'},
    {d:7,ch:'telefon',t:'Ring opp med konkret forslag'},
    {d:14,ch:'telefon',t:'Siste oppringning'}]};
  const mail={
   t1a:{s:'Et sted å se for {org}?',b:'Hei {fornavn},\n\n«Skriv én konkret setning om {org}, for eksempel et arrangement eller en utgivelse du har sett.»\n\nVi har åpnet mer kapasitet på Litteraturhuset, blant annet storsalen Solstad med plass til opptil 320 i stolrader, og flere nye saler i husets to øverste etasjer. Det hadde vært interessant å vise dere stedet og høre hva dere planlegger i 2027.\n\nHar du tid til en kort omvisning de neste ukene?\n\nBeste hilsen\n{signatur}'},
   t1b:{s:'Forslag til tidspunkt',b:'Hei {fornavn},\n\nJeg følger opp i tilfelle forrige melding druknet. Jeg kan vise dere stedet på kort varsel, og vi kan ta det som en kaffe, uten forpliktelser.\n\nPasser en av disse dagene? «Foreslå to datoer»\n\nBeste hilsen\n{signatur}'},
   t2a:{s:'Mer kapasitet på Litteraturhuset',b:'Hei {fornavn},\n\nTakk for sist, eller hei hvis vi ikke har snakket ennå. Vi har åpnet mer kapasitet på Litteraturhuset i 2027, med storsalen Solstad (opptil 320 i stolrader) og flere nye saler.\n\n{bruk}Hadde det vært interessant å se stedet? {avbestilling}\n\nBeste hilsen\n{signatur}'},
   t2b:{s:'Siste hilsen fra Litteraturhuset',b:'Hei {fornavn},\n\nJeg skjønner at det er mye som skal gjøres, så dette er min siste henvendelse for nå. Skal dere arrangere noe i Oslo i 2027, er det bare å si fra, så finner vi en dato.\n\nBeste hilsen\n{signatur}'},
   t3a:{s:'Mer kapasitet på Litteraturhuset i 2027',b:'Hei {fornavn},\n\nVi på Litteraturhuset har åpnet mer kapasitet, blant annet storsalen Solstad med plass til opptil 320 i stolrader, og flere nye saler i husets to øverste etasjer. {bruk}\n\nDet hadde vært interessant å vise dere stedet og høre om dere planlegger noe i Oslo i 2027. Leieprisene ligger på litteraturhuset.no/nb/leie-lokaler, eller svar her så finner vi et tidspunkt for en omvisning.\n\nBeste hilsen\n{signatur}'},
   t3b:{s:'Hva salene egner seg til',b:'Hei {fornavn},\n\nKort oppfølging. Salene våre har scene, stolrader og profesjonell teknikk, og passer til alt fra lanseringer og samtaler til seminarer og konferanser. Åpne arrangementer som handler om litteratur, politikk og samfunn kan få rabattert leie.\n\nSvar gjerne med omtrentlig dato og antall, så foreslår jeg en sal.\n\nBeste hilsen\n{signatur}'},
   t3c:{s:'Kom og se stedet',b:'Hei {fornavn},\n\nJeg tror det er enklest å se stedet selv. Kom innom for en kort omvisning når det passer dere, uten forpliktelser. {avbestilling}\n\nBeste hilsen\n{signatur}'},
   t3d:{s:'Siste hilsen fra Litteraturhuset',b:'Hei {fornavn},\n\nDette er min siste henvendelse for nå. Skal dere arrangere noe i Oslo i 2027, er det bare å si fra, så finner vi en dato.\n\nBeste hilsen\n{signatur}'},
   pba:{s:'Mer kapasitet for deres kunder i Oslo',b:'Hei {fornavn},\n\nVi på Litteraturhuset har åpnet mer kapasitet i 2027, med storsalen Solstad (opptil 320 i stolrader) og flere nye saler. Dere som arrangerer for kunder kan ha bruk for en sentral arena med scene, seter og god teknikk.\n\nHadde det vært interessant å se stedet, og kanskje høre hvilke typer arrangementer dere ser mest etterspørsel etter?\n\nBeste hilsen\n{signatur}'},
   pbb:{s:'Visning på Litteraturhuset',b:'Hei {fornavn},\n\nJeg følger opp. Jeg viser gjerne stedet på kort varsel, og vi kan sette opp en uforpliktende prat om hva som passer for kundene dere jobber med. {avbestilling}\n\nBeste hilsen\n{signatur}'}};
  TIER_D={cult,kw,lbl,tiers,cad,mail}; return TIER_D; }
const TIER_DEF={hours:20,split:{1:60,2:30,3:10},cap1:30,cap2:150,minFit1:35,start:'2026-12-01',end:'2027-05-31',
  cancel:'Det er ingen stress med bindinger: avtalen kan avbestilles i god tid, og det gjelder begge veier.',mail:{},
  eco:{fee:0,paid:0,base:0,growth:30,target:0,share:50,visits:40,t1cov:90,extend:'2027-03-01',extended:false}};
function tierCfg(){ const s=(S.settings&&S.settings.tier)||{}; return {...TIER_DEF,...s,split:{...TIER_DEF.split,...(s.split||{})},mail:{...(s.mail||{})},eco:{...TIER_DEF.eco,...(s.eco||{})}}; }
async function tierSave(patch){ const cur=(S.settings&&S.settings.tier)||{}; const next={...cur,...patch}; if(patch.eco) next.eco={...(cur.eco||{}),...patch.eco}; if(patch.split) next.split={...(cur.split||{}),...patch.split}; await settingsRepository.save({tier:next}); }

/* kulturprofil og tier for hver account. Kalles fra mtBuild etter dedupe. */
function tierCult(a){
  const D=tierD(); let c=D.cult[a.segId]; if(c==null) c=1;
  // Do not use analysis/venue notes ('why') to manufacture a cultural mission.
  const txt=(a.name||'')+' '+(a.about||''); const hits=new Set((txt.match(D.kw)||[]).map(x=>x.toLowerCase().slice(0,5)));
  const bump=c>=1?(hits.size>=2?2:hits.size?1:0):0;
  return {base:c,eff:Math.min(3,c+bump),hit:hits.size>0,core:hits.size>=2||(a.segId==='forlag'&&hits.size>=1)};
}
function tierAssign(list){
  const T=tierCfg(), pts={1:0,2:0,3:0}; const cand=[];
  for(const a of list){
    const k=tierCult(a); a.cult=k.eff; a.cultHit=k.hit; a.cultCore=k.core;
    const rel=a.rel==='kunde'||a.rel==='fast'?10:a.hasDialog?5:0;
    a.ptRaw=k.eff*20+(k.core?8:0)+a.fit.total*0.25+rel; a.ptScore=Math.round(Math.min(100,a.ptRaw));
    const man=a.doc&&[1,2,3].includes(Number(a.doc.pt))?Number(a.doc.pt):0;
    a.ptAuto=!man;
    if(a.flags.disqualified||a.dncAcc){ a.pt=0; continue; }
    if(man){ a.pt=man; pts[man]++; continue; }
    cand.push(a);
  }
  cand.sort((x,y)=>y.ptRaw-x.ptRaw||y.fit.total-x.fit.total||x.name.localeCompare(y.name,'nb'));
  let n1=pts[1], n2=pts[2];
  for(const a of cand){
    const rel=a.rel==='kunde'||a.rel==='fast'||a.hasDialog;
    if(a.cult>=3&&a.fit.total>=T.minFit1&&n1<T.cap1){ a.pt=1; n1++; }
    else if((a.cult>=2||(a.cult===1&&a.fit.total>=40)||(rel&&a.cult>=1))&&n2<T.cap2){ a.pt=2; n2++; }
    else a.pt=3;
  }
  for(const a of list){ a.ptWhy=tierWhy(a); }
}
function tierWhy(a){
  const D=tierD(), P=[]; if(!a.pt) return 'Ikke i prioriteringen (diskvalifisert eller opt-out)';
  P.push('Kulturprofil '+a.cult+'/3: '+D.lbl[a.cult].toLowerCase()+(a.cultCore?' (flere tydelige litteratur- eller kulturord i beskrivelsen)':a.cultHit?' (kulturord i beskrivelsen)':''));
  P.push('fit '+a.fit.total+' av 100');
  if(a.rel==='kunde'||a.rel==='fast') P.push('har leid hos oss'); else if(a.hasDialog) P.push('tidligere dialog');
  P.push(a.ptAuto?'satt automatisk (score '+a.ptScore+')':'satt av deg');
  return P.join(' · ');
}
const tierName=n=>({1:'Tier 1',2:'Tier 2',3:'Tier 3',0:'Ingen'})[n]||'';
const tierShort=n=>({1:'T1',2:'T2',3:'T3',0:'–'})[n]||'';
async function tierSet(id,n){ n=Number(n)||0; const a=mtGet(id); if(!a) return {err:'Ukjent account.'};
  if(!n){ const d0=S.mtacc[id]; if(d0&&d0.pt){ const {pt,...rest}=d0; await accountRepository.saveRaw(id,{...rest,hist:[...(d0.hist||[]),{at:iso(new Date()),by:me.name||'',t:'Tier satt tilbake til automatikk'}].slice(-60)},{noAudit:true}); } return {ok:1}; }
  await mtPatch(id,{pt:n},'Tier satt til '+n+' (manuelt)'); return {ok:1}; }

/* kadens og e-postmaler */
function tierCad(k){ return tierD().cad[k]||null; }
function tierMail(m){ const D=tierD(), T=tierCfg(); const o=T.mail[m]; return o&&(o.s||o.b)?{s:o.s||D.mail[m].s,b:o.b||D.mail[m].b,own:true}:{...D.mail[m],own:false}; }
function tierMerge(a,txt,pe){
  const T=tierCfg(); const first=String((pe&&pe.name)||'').trim().split(/\s+/)[0]||'';
  const use=MT_USECASE&&MT_USECASE[a.segId]?'Typisk bruk for dere: '+String(MT_USECASE[a.segId]).replace(/^./,c=>c.toLowerCase())+'. ':'';
  const sig=String((S.settings&&S.settings.signature)||me.name||'').trim();
  return String(txt).replace(/\{fornavn\}/g,first||'der').replace(/\{org\}/g,a.name).replace(/\{segment\}/g,a.seg?mtSegShort(a.seg.name):'').replace(/\{bruk\}/g,use).replace(/\{avbestilling\}/g,T.cancel||'').replace(/\{signatur\}/g,sig).replace(/ {2,}/g,' ').replace(/ \n/g,'\n').replace(/Hei der,/,'Hei,'); }
function tierDraft(a,step){ const m=step&&step.m?tierMail(step.m):null; if(!m) return null; const pe=(a.active||[]).find(p=>p.email&&!p.dnc)||null;
  return {to:pe?pe.email:'',pe,subject:tierMerge(a,m.s,pe),body:tierMerge(a,m.b,pe)}; }

/* anslag på ukentlig volum og faktisk fordeling */
function tierBudget(){ const T=tierCfg(), D=tierD(); const mins=T.hours*60; const out={};
  for(const n of [1,2,3]){ const sh=(Number(T.split[n])||0)/100, m=mins*sh; out[n]={share:sh,hours:T.hours*sh,perWeek:Math.round(m/D.tiers[n].min)}; }
  return out; }
function tierStats(){ const L=mtAll().filter(a=>a.pt), today=mtToday(), d14=mtAddD(today,-14), d28=mtAddD(today,-28);
  const by={1:[],2:[],3:[]}; for(const a of L) (by[a.pt]||(by[a.pt]=[])).push(a);
  const tierOf={}; for(const a of L) tierOf[a.id]=a.pt;
  const cnt={1:0,2:0,3:0}; let tot=0;
  for(const x of actsOp()){ if(x.type==='task'||x.derived||x.handover||x.dir==='in') continue; if(!['call','email','meeting','visning'].includes(x.type)) continue;
    if(/^E-postutkast laget/.test(x.text||'')) continue; if(String(x.at||'').slice(0,10)<d28) continue; const t=tierOf[x.orgId]; if(!t) continue;
    const w=x.type==='call'?1:x.type==='email'?0.25:3; cnt[t]+=w; tot+=w; }
  const r={}; for(const n of [1,2,3]){ const A=by[n]||[]; r[n]={n:A.length,contacted:A.filter(a=>a.touch.lastOut&&String(a.touch.lastOut).slice(0,10)>=d14).length,everAddr:A.filter(a=>a.flags.addressed).length,engaged:A.filter(a=>a.flags.engaged).length,share:tot?cnt[n]/tot:null,open:A.filter(a=>a.flags.opportunity).length}; }
  return r; }
