/* ---------- U3: felles beregninger for markedsarbeid ----------
   Alt her regnes fra det Salong har: kunder, saker, aktiviteter og bookinger, pluss to tydelig merkede anslag:
   (1) estimert antall relevante aktører per segment (målunivers), (2) Salongs vurdering av hvor godt Solstad passer for et segment.
   Begge er eksempelverdier som kan justeres, og vises alltid som anslag. Ingenting her skriver til databasen uten at brukeren trykker. */
const U3_REL=[['tidligere','Tidligere leietaker'],['aktiv','Aktiv kunde'],['prioritert','Prioritert prospekt'],['prospekt','Prospekt'],['dialog','I dialog'],['tilbud','Tilbud sendt'],['bekreftet','Bekreftet'],['parkert','Uaktuell / parkert']];
const U3_MKT=[['ikke','Ikke vurdert'],['identifisert','Identifisert'],['tildelt','Tildelt'],['kontaktet','Kontaktet'],['arbeid','I arbeid'],['ferdig','Ferdig vurdert']];
const U3_RELN=Object.fromEntries(U3_REL), U3_MKTN=Object.fromEntries(U3_MKT);
/* anslag: relevante aktører per segment i Oslo-området. Eksempeltall som kan justeres i Marked og posisjon. */
const U3_EST={'Forlag':60,'Forskning':45,'Profesjon og forbund':70,'Helse og pasient':55,'Stat og fag':40,'Organisasjon':90,'Utdanning':35,'Ambassader og kultur':45,'Livssyn':20,'Bedrift':80,'Eventbyrå':30,'Kurs og enkeltpersoner':40};
/* Salongs vurdering av segmentene mot Solstad (320 i stolrader, 150 i klasserom). att = typisk deltakerantall, type = hvor godt arrangementstypene passer en stor sal. */
const U3_SEG={'Forlag':{att:[40,150],type:60,ev:'Boklanseringer, samtaler, litteraturfestivaler',val:12000},
 'Forskning':{att:[60,250],type:80,ev:'Seminarer, rapportlanseringer, konferanser',val:22000},
 'Profesjon og forbund':{att:[80,320],type:88,ev:'Fagdager, årsmøter, konferanser',val:30000},
 'Helse og pasient':{att:[80,300],type:85,ev:'Fagdager, pasientkonferanser, åpne seminarer',val:28000},
 'Stat og fag':{att:[100,350],type:92,ev:'Konferanser, fagdager, høringer',val:36000},
 'Organisasjon':{att:[40,220],type:66,ev:'Debatter, årsmøter, lanseringer',val:16000},
 'Utdanning':{att:[50,260],type:72,ev:'Fagdager, seminarer, avslutninger',val:20000},
 'Ambassader og kultur':{att:[30,150],type:46,ev:'Samtaler, kulturkvelder, mottakelser',val:11000},
 'Livssyn':{att:[30,130],type:40,ev:'Foredrag, serier',val:8000},
 'Bedrift':{att:[60,320],type:76,ev:'Kundearrangementer, konferanser, interne dager',val:42000},
 'Eventbyrå':{att:[100,400],type:82,ev:'Konferanser og arrangementer for oppdragsgivere',val:48000},
 'Kurs og enkeltpersoner':{att:[8,60],type:15,ev:'Kurs, små samlinger',val:5000}};
const U3_SOLSTAD={min:150,max:320,per:2};
/* aktører som ligner på dem vi har, men som ikke er i listen ennå. Forslag fra Salongs eksempeldata, ikke verifisert. */
const U3_CAT=[['Aschehoug','Forlag','M','lansering,samtale'],['Pax Forlag','Forlag','M','lansering,debatt'],['Oktober Forlag','Forlag','M','lansering,samtale'],['Spartacus Forlag','Forlag','S','lansering'],
 ['Cicero Senter for klimaforskning','Forskning','M','seminar,konferanse'],['NOVA, OsloMet','Forskning','M','seminar,fagdag'],['Norce','Forskning','M','seminar,konferanse'],
 ['Den norske legeforening','Profesjon og forbund','L','fagdag,konferanse,årsmøte'],['Norsk Journalistlag','Profesjon og forbund','M','fagdag,debatt'],['Forskerforbundet','Profesjon og forbund','M','konferanse,fagdag'],['Norsk Sykepleierforbund','Profesjon og forbund','L','konferanse,fagdag'],['Advokatforeningen','Profesjon og forbund','M','fagdag,konferanse'],
 ['Kreftforeningen','Helse og pasient','L','konferanse,seminar'],['Mental Helse','Helse og pasient','M','seminar,fagdag'],['Nasjonalforeningen for folkehelsen','Helse og pasient','M','konferanse,seminar'],
 ['Statistisk sentralbyrå','Stat og fag','L','konferanse,seminar'],['Kulturrådet','Stat og fag','M','konferanse,fagdag'],['Nasjonalbiblioteket','Stat og fag','L','seminar,lansering'],['Utdanningsdirektoratet','Stat og fag','L','konferanse,fagdag'],
 ['Redd Barna','Organisasjon','M','konferanse,debatt'],['Norsk Folkehjelp','Organisasjon','M','seminar,debatt'],['Kirkens Bymisjon','Organisasjon','M','seminar,debatt'],
 ['Folkeuniversitetet','Utdanning','M','kurs,seminar'],['Kunsthøgskolen i Oslo','Utdanning','M','seminar,festival'],
 ['Storebrand','Bedrift','L','konferanse,fagdag'],['Schibsted','Bedrift','L','konferanse,lansering'],['Telenor','Bedrift','L','konferanse,fagdag'],['DNB','Bedrift','L','konferanse,fagdag']];
const U3_TAGS=[['lansering',/lanser|bok(slipp|fest)|release/i],['seminar',/seminar|frokost/i],['konferanse',/konferanse|summit/i],['debatt',/debatt|panel|samtale/i],['årsmøte',/årsmøte|landsmøte|medlemsmøte/i],['fagdag',/fagdag|fagseminar|kurs/i],['festival',/festival|jubileum/i]];
UI.ku=Object.assign(UI.ku,{});
const u3Today=()=>iso(new Date()).slice(0,10);
const u3Est=seg=>{ const o=(S.settings&&S.settings.univ)||{}; const v=Number(o[seg]); return Number.isFinite(v)&&v>=0&&o[seg]!==''&&o[seg]!=null?v:(U3_EST[seg]||0); };
const u3Seg=s=>U3_SEG[s]||{att:[50,200],type:50,ev:'',val:15000};
function u3Tags(r){ const p=PROFILES[r.id], t=new Set(); const txt=p?[p.about,p.angle,...(p.events||[])].join(' '):''; for(const [k,re] of U3_TAGS) if(re.test(txt)) t.add(k);
  if(!t.size) for(const k of ({'Forlag':['lansering'],'Forskning':['seminar'],'Profesjon og forbund':['fagdag'],'Stat og fag':['konferanse'],'Helse og pasient':['seminar'],'Organisasjon':['debatt'],'Bedrift':['konferanse'],'Utdanning':['fagdag']})[r.segment]||[]) t.add(k); return [...t]; }

/* ---------- radene: én per organisasjon i listen, med relasjonsstatus og markedstatus avledet fra det som er registrert ---------- */
function u3Data(){
  const key=DV+'|'+JSON.stringify((S.settings&&S.settings.univ)||{})+'|'+Math.floor(Date.now()/60000)+'|'+UI.own;
  if(u3Data.c&&u3Data.c.key===key) return u3Data.c;
  const now=Date.now(), today=u3Today(), yAgo=iso(new Date(now-365*864e5)).slice(0,10), ds=deals(), A=acts(), P=Object.fromEntries(prospects().map(p=>[p.id,p])), {m,Y}=moneyMap();
  const lastBy={}, tasks={}, byOrgD={}, kinds={};
  for(const a of A){ if(a.type==='task'){ if(!a.done&&a.orgId){ const t=tasks[a.orgId]; if(!t||(a.due||'9')<(t.due||'9')) tasks[a.orgId]=a; } continue; }
    if(a.handover||a.derived||!a.orgId) continue; const l=lastBy[a.orgId]; if(!l||a.at>l.at) lastBy[a.orgId]=a; }
  for(const d of ds){ (byOrgD[d.orgId]=byOrgD[d.orgId]||[]).push(d); }
  const rows=allOrgs().map(o=>{ const od=byOrgD[o.id]||[], p=P[o.id], org=S.orgs[o.id]||o, st=orgStatus(o.id), la=lastBy[o.id]||null, task=tasks[o.id]||null, mm=m[o.id];
    const openD=od.filter(d=>OPEN.includes(d.stage)), tilbud=openD.some(d=>d.stage==='tilbud'||d.stage==='holdt'), dialog=openD.some(d=>['ny','dialog','visning'].includes(d.stage));
    const futureConf=od.some(d=>d.stage==='bekreftet'&&(!d.date||d.date>=today)), recent=od.some(d=>d.stage==='bekreftet'&&(d.stageAt||d.date||'')>=yAgo)||KB.rows(o.id).some(r=>r.status==='bekreftet'&&r.date>=yAgo);
    const lostOnly=od.length>0&&od.every(d=>d.stage==='tapt')&&st==='prospekt';
    const tier=o.tier||'B', score=p?p.score:0;
    let rel; if(org.parked||lostOnly) rel='parkert'; else if(futureConf) rel='bekreftet'; else if(tilbud) rel='tilbud'; else if(dialog) rel='dialog'; else if(recent) rel='aktiv'; else if(st==='fast'||st==='kunde') rel='tidligere'; else if(tier==='A'||score>=40) rel='prioritert'; else rel='prospekt';
    const touched=!!la||od.length>0, ownerId=org.ownerId||null;
    let mkt; if(org.mkt==='ferdig'||rel==='bekreftet'||rel==='parkert') mkt='ferdig'; else if(openD.length||task) mkt='arbeid'; else if(touched) mkt='kontaktet'; else if(ownerId) mkt='tildelt'; else mkt='identifisert';
    const days=la?Math.floor((now-new Date(la.at))/864e5):null, openVal=openD.reduce((a,d)=>a+dval(d),0);
    const last=la?(la.asMember?ownName(la.asMember):la.byName||''):'';
    const r={id:o.id,name:o.name,segment:o.segment||'',tier,ownerId,ownerName:org.ownerName||'',virtual:!S.orgs[o.id],former:!!org.former,website:o.website||'',contacts:org.contacts||[],
      st,rel,mkt,la:la?la.at:null,days,lastBy:last,lastType:la?la.type:'',task,open:openD.length,openVal,openDeals:openD,deals:od,spend:mm?(mm.ys[Y-1]||0):0,tot:mm?mm.tot:0,
      score,size:(p&&p.size)||'M',profile:p||null,parked:!!org.parked,example:!!org.example,hasMail:!!((org.contacts||[]).some(c=>c.email)||(p&&p.contact&&p.contact.email)),hasPhone:!!((org.contacts||[]).some(c=>c.phone)||(p&&p.contact&&p.contact.phone))};
    r.tags=u3Tags(r); r.nba=u3Nba(r); r.fit=u3Fit(r); r.pot=u3Pot(r); r.exp=u3Exp(r); return r; });
  const byId=Object.fromEntries(rows.map(r=>[r.id,r]));
  return (u3Data.c={key,rows,byId,Y});
}
const u3Row=id=>u3Data().byId[id]||null;

/* ---------- neste beste handling ---------- */
function u3Nba(r){ const now=Date.now(), over=r.task&&r.task.due&&new Date(r.task.due)<now;
  if(r.rel==='parkert') return {k:'gjenapne',label:'Åpne på nytt?',why:'Parkert. Se om noe har endret seg.',quiet:true};
  if(r.task) return {k:'oppgave',label:r.task.text,why:(r.task.due?(over?'Forfalt ':'Frist ')+fd(r.task.due,{day:'numeric',month:'short'}):'Ingen frist')+' · '+ownName(r.task.ownerId,r.task.ownerName),over:!!over,fromTask:true};
  const offer=r.openDeals.find(d=>d.stage==='tilbud'||d.stage==='holdt');
  if(offer){ const age=Math.floor((now-new Date(offer.stageAt||offer.createdAt||now))/864e5); return {k:'tilbud',label:'Følg opp tilbud',why:'«'+offer.title+'» ligger hos kunden'+(age>=7?' i '+age+' dager':''),deal:offer.id,over:age>=14}; }
  const dd=r.openDeals.find(d=>!d.date&&['dialog','visning'].includes(d.stage));
  if(dd) return {k:'dato',label:'Foreslå dato',why:'«'+dd.title+'» har ingen dato ennå',deal:dd.id};
  if(!r.ownerId) return {k:'tildel',label:'Tildel ansvarlig',why:'Ingen står som kundeansvarlig'};
  if(r.rel==='tidligere'&&(r.days==null||r.days>180)) return {k:'epost',label:'Send e-post for å hente tilbake',why:r.days==null?'Har leid før, ingen dialog registrert':'Har leid før, sist dialog for '+r.days+' dager siden'};
  if(r.days==null) return r.hasPhone||!r.hasMail?{k:'ring',label:'Ring første gang',why:'Ikke kontaktet'}:{k:'epost',label:'Send første e-post',why:'Ikke kontaktet, har bare e-post'};
  if(r.days>60&&r.tier==='C'&&r.rel==='prospekt') return {k:'parker',label:'Vurder å parkere',why:'Lav prioritet, sist dialog for '+r.days+' dager siden'};
  if(r.days>45) return {k:'ring',label:'Ring og følg opp',why:'Sist dialog for '+r.days+' dager siden'};
  return {k:'ingen',label:'Ingen handling nå',why:'Kontaktet for '+r.days+' dager siden',quiet:true}; }
const U3_ACT={ring:'Ring',epost:'Send e-post',tilbud:'Følg opp tilbud',dato:'Foreslå dato',parker:'Parkér',tildel:'Tildel',gjenapne:'Åpne på nytt',oppgave:'Åpne',ingen:''};

/* ---------- fit, kommersielt potensial og forventet verdi ---------- */
function u3SizeFit(att){ const [a,b]=att, lo=Math.max(a,U3_SOLSTAD.min), hi=Math.min(b,U3_SOLSTAD.max); if(hi<lo) return Math.max(0,100-Math.round(Math.min(Math.abs(a-U3_SOLSTAD.max),Math.abs(b-U3_SOLSTAD.min))/3)); return Math.round(100*(hi-lo)/Math.max(1,b-a)*.5+50); }
function u3Hist(r){ const att=r.deals.map(d=>Number(d.attendees)).filter(n=>n>0); return att.length?att.reduce((a,b)=>a+b,0)/att.length:null; }
function u3Fit(r){ const sp=u3Seg(r.segment), h=u3Hist(r), size=h!=null?u3SizeFit([Math.max(10,h*.8),h*1.25]):u3SizeFit(sp.att)*(r.size==='L'?1.05:r.size==='S'?.8:1), tg=r.tags.filter(t=>['konferanse','seminar','fagdag','årsmøte','debatt'].includes(t)).length;
  return Math.max(0,Math.min(100,Math.round(.45*Math.min(100,size)+.4*sp.type+.15*Math.min(100,40+tg*30)))); }
function u3Pot(r){ const t={A:80,B:52,C:28}[r.tier]||40, sp=u3Seg(r.segment), v=Math.min(100,Math.round(sp.val/500)), rec=r.deals.some(d=>Number(d.recurring)>1)||(r.profile&&/årlig|hvert år|serie/i.test((r.profile.events||[]).join(' ')))?100:40, past=r.spend?Math.min(100,30+Math.log10(r.spend+1)*14):30;
  return Math.max(0,Math.min(100,Math.round(.35*t+.25*v+.2*rec+.2*past))); }
/* sannsynlighet: åpen sak bruker stegets sannsynlighet. Uten sak brukes et lavt grunnivå per relasjon. */
function u3Prob(r){ if(r.rel==='bekreftet') return 1; if(r.rel==='parkert') return 0; const st=r.openDeals.map(d=>ST[d.stage].p); if(st.length) return Math.max(...st); return ({aktiv:.2,tidligere:.14,prioritert:.1,prospekt:.04})[r.rel]||.04; }
function u3Exp(r){ const open=r.openDeals.length?Math.max(...r.openDeals.map(dval)):0, base=open||u3Seg(r.segment).val*(r.size==='L'?1.4:r.size==='S'?.6:1); return Math.round(base*u3Prob(r)); }

/* ---------- dekning per segment: det samlede markedet mot det vi har kommet gjennom ---------- */
function u3Cover(pred){ pred=pred||(()=>true); const D=u3Data(), segs=[...SEGMENTS], extra=[...new Set(D.rows.map(r=>r.segment).filter(s=>s&&!segs.includes(s)))]; segs.push(...extra);
  const out=segs.map(seg=>{ const all=D.rows.filter(r=>r.segment===seg), mine=all.filter(pred), c=f=>mine.filter(f).length;
    const worked=r=>!!r.la||r.deals.length>0||r.rel==='parkert', est=Math.max(u3Est(seg),all.length);
    const k={seg,est,ident:all.length,mine:mine.length,kont:c(r=>worked(r)&&!['dialog','tilbud','bekreftet','parkert'].includes(r.rel)),dialog:c(r=>r.rel==='dialog'),tilbud:c(r=>r.rel==='tilbud'),bekr:c(r=>r.rel==='bekreftet'),uakt:c(r=>r.rel==='parkert'),
      utenKontakt:c(r=>!worked(r))}; k.worked=k.kont+k.dialog+k.tilbud+k.bekr+k.uakt; k.rest=Math.max(0,est-all.filter(worked).length); k.unmapped=Math.max(0,est-all.length); k.rows=mine; k.allWorked=all.filter(worked).length; k.pct=est?k.allWorked/est:0; return k; });
  const T=out.reduce((a,k)=>{ for(const f of ['est','ident','mine','kont','dialog','tilbud','bekr','uakt','worked','rest','unmapped','utenKontakt','allWorked']) a[f]=(a[f]||0)+k[f]; return a; },{});
  T.pct=T.est?T.allWorked/T.est:0; return {segs:out,T}; }

/* ---------- hvite flekker, underrepresenterte segmenter og lignende aktører ---------- */
function u3SegFit(seg){ const sp=u3Seg(seg), D=u3Data(), rows=D.rows.filter(r=>r.segment===seg), solD=rows.flatMap(r=>r.deals).filter(d=>d.room==='solstad'&&d.stage!=='tapt'), all=D.rows.flatMap(r=>r.deals).filter(d=>d.room==='solstad'&&d.stage!=='tapt'),
    size=Math.min(100,u3SizeFit(sp.att)), ev=all.length>=3?Math.round(100*solD.length/all.length*SEGMENTS.length/2):null, evid=ev==null?null:Math.min(100,ev);
  const fit=Math.round(evid==null?.55*size+.45*sp.type:.45*size+.35*sp.type+.2*evid); return {seg,fit:Math.min(100,fit),size,type:sp.type,evid,att:sp.att,ev:sp.ev,solDeals:solD.length,solTot:all.length}; }
function u3White(){ const C=u3Cover().segs; return C.map(k=>{ const f=u3SegFit(k.seg); return {...k,sf:f.fit,gap:f.fit*(1-k.pct)}; }).filter(k=>k.est>0).sort((a,b)=>b.gap-a.gap); }
function u3Under(){ const C=u3Cover().segs, T=u3Cover().T, D=u3Data(), cust=D.rows.filter(r=>['tidligere','aktiv','bekreftet'].includes(r.rel)), n=Math.max(1,cust.length);
  return C.map(k=>{ const mkt=T.est?k.est/T.est:0, own=cust.filter(r=>r.segment===k.seg).length/n; return {seg:k.seg,mkt,own,diff:mkt-own,cust:cust.filter(r=>r.segment===k.seg).length}; }).filter(x=>x.diff>.03).sort((a,b)=>b.diff-a.diff); }
function u3Similar(r,n){ const have=new Set(u3Data().rows.map(x=>x.name.toLowerCase())), tags=new Set(r.tags);
  return U3_CAT.filter(c=>!have.has(c[0].toLowerCase())).map(([name,segment,size,tg])=>{ const t=tg.split(','), common=t.filter(x=>tags.has(x)); let s=0, why=[];
      if(segment===r.segment){ s+=3; why.push('samme segment ('+segment+')'); } if(size===r.size){ s+=1; why.push(size==='L'?'stor arrangør':size==='S'?'liten arrangør':'middels arrangør'); } if(common.length){ s+=2*common.length; why.push('lignende arrangementstype: '+common.join(', ')); }
      return {name,segment,size,tags:t,score:s,why}; }).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'nb')).slice(0,n||4); }
/* lignende aktører for hele porteføljen: utgangspunkt er de beste kundene (bekreftet eller aktiv, eller høyt potensial) */
function u3SimilarToBest(n){ const D=u3Data(), best=D.rows.filter(r=>['bekreftet','aktiv'].includes(r.rel)||(r.rel==='tidligere'&&r.tier==='A')).sort((a,b)=>b.pot-a.pot).slice(0,8), seen=new Map();
  for(const b of best) for(const s of u3Similar(b,6)){ const e=seen.get(s.name); if(!e) seen.set(s.name,{...s,likeness:[b.name],boost:s.score}); else { e.likeness.push(b.name); e.boost+=1; } }
  return [...seen.values()].sort((a,b)=>b.boost-a.boost||a.name.localeCompare(b.name,'nb')).slice(0,n||6); }
async function u3Add(c){ if(readOnly){ toast('Du har lesetilgang og kan ikke legge til.'); return null; } const id=uid('o'); await put('orgs',id,{name:c.name,segment:c.segment,tier:'B',former:false,notes:'Lagt til fra forslag i Salong. Ikke verifisert. Segment og størrelse er Salongs antakelse.',contacts:[],source:'forslag',createdAt:iso(new Date())},{action:'lagt til fra forslag'}); toast(c.name+' er lagt til i målunivers som «Identifisert».'); return id; }
async function u3Park(id,on){ if(readOnly){ toast('Du har lesetilgang og kan ikke endre.'); return; } if(!S.orgs[id]&&PROFILES[id]) await ensureOrg(PROFILES[id]); const o=S.orgs[id]; if(!o) return; await put('orgs',id,{...o,parked:!!on,parkedAt:on?iso(new Date()):null},{action:on?'parkert':'åpnet igjen'}); toast(on?o.name+' er parkert.':o.name+' er åpnet igjen.'); }
async function u3Estimate(seg,val){ const cur={...((S.settings&&S.settings.univ)||{})}; if(val===''||val==null) delete cur[seg]; else cur[seg]=Math.max(0,Math.round(Number(val)||0)); await saveSettings({univ:cur}); }
