// Enhetstest av rene kontaktfunn-funksjoner (cdisc.js). Fixtures er forkortede, ekte svar fra Exa (FHI), ikke oppdiktede personer.
const fs=require('fs');
const code=fs.readFileSync(require('path').resolve(__dirname,'../../src/cdisc.js'),'utf8');
const CD=new Function(code+';return {CD_TUNE,CD_FAM,CD_SEG,cdUnderstand,cdParseRoster,cdParseEventContacts,cdParseLinkedIn,cdFromApollo,cdParseGeneral,cdPageKind,cdScore,cdMerge,cdFamsOf,cdLinePerson};')();
let ok=0,bad=0; const t=(n,v,e)=>{ const pass=typeof e==='function'?!!e(v):JSON.stringify(v)===JSON.stringify(e); pass?ok++:bad++; console.log(pass?'OK  ':'FEIL',n,'=>',JSON.stringify(v).slice(0,260)); };
const roster=`## Medarbeidere 

Sara Martine Berge

Sara Martine Berge seniorrådgiver Kontaktinformasjon 

Erik Bull-Valen

Erik Bull-Valen seniorrådgiver Kontaktinformasjon 

Knut Forr Børtnes seniorrådgiver, Cand.philol. Kontaktinformasjon 

Rebecca Bruu Carver seniorrådgiver, PhD in Science Communication Kontaktinformasjon 

- Kontakt oss
- Beredskapstelefoner
- Tlf.: 21 07 70 00 (+4721077000)
- Org.nr: 983 744 516`;
const R=CD.cdParseRoster(roster);
t('R01 FHI-liste: fire personer, ingen støylinjer',R.map(x=>x.name),['Sara Martine Berge','Erik Bull-Valen','Knut Forr Børtnes','Rebecca Bruu Carver']);
t('R02 tittel renset for «Kontaktinformasjon» og grader',R.map(x=>x.title),['seniorrådgiver','seniorrådgiver','seniorrådgiver','seniorrådgiver']);
t('R03 hver kandidat har sitat',R.every(x=>x.quote&&x.quote.includes(x.name)),true);
const R2=CD.cdParseRoster('Anna Hansen, Kommunikasjonssjef\nKari Nordmann – Head of Events\n[Per Olsen](mailto:per.olsen@x.no) Markedssjef\nOla Dahl\nProgramleder\nAvdeling for kommunikasjon\nNorges Farmaceutiske Forening kommunikasjon\nKontakt oss for mer info');
t('R04 komma, tankestrek, mailto og navn/rolle på to linjer',R2.map(x=>x.name+'|'+x.title+'|'+x.email),['Anna Hansen|Kommunikasjonssjef|','Kari Nordmann|Head of Events|','Per Olsen|Markedssjef|per.olsen@x.no','Ola Dahl|Programleder|']);
t('R05 organisasjonsnavn og overskrifter blir ikke personer',R2.some(x=>/Farmasøytisk|Farmaceutisk|Avdeling|Kontakt/.test(x.name)),false);
const EV=`# Fagseminar 2025
Publisert 04.03.2025
Arrangementet er gratis.
Kontaktperson: Nora Test, Eventansvarlig
Spørsmål: Ida Berg på ida.berg@alfa.no
| | Hanne Nissen Bjørnsen, avdelingsdirektør NASKO i Folkehelseinstituttet. Helsesykepleier |
Moderator: Per Hansen, kommunikasjonsrådgiver, FHI`;
const E=CD.cdParseEventContacts(EV,['Folkehelseinstituttet','FHI']);
t('E01 arrangørkontakter fra eventside',E.filter(x=>x.kind==='organizer').map(x=>x.name+'|'+x.title),['Nora Test|Eventansvarlig','Ida Berg|']);
t('E02 ansatte talere markeres som speaker (ikke organizer)',E.filter(x=>x.kind==='speaker').map(x=>x.name),v=>v.includes('Hanne Nissen Bjørnsen')||v.includes('Per Hansen'));
const LI=[{title:'Siri Haugsnes',url:'https://no.linkedin.com/in/siri-haugsnes-7b16b11a2',text:'senior kommunikasjonsrådgiver i Folkehelseinstituttet\n\nOslo, Oslo, Norway (NO)\n...\nKommunikasjonsrådgiver med bred og lang erfaring.\n### Senior kommunikasjonsrådgiver - [Norwegian Institute of Public Health](https://www.linkedin.com/company/norwegian-institute-of-public-health) (Current)\n\nJan 2012 - Present'},
 {title:'Hilde Hartmann Holsten',url:'https://no.linkedin.com/in/hilde-hartmann-holsten-50417925',text:'Senior kommunikasjonsrådgiver, Folkehelseinstituttet\n\nOslo, Oslo, Norway (NO)\n### [Norwegian Institute of Public Health](https://www.linkedin.com/company/norwegian-institute-of-public-health)\n\n#### Senior Communications Advisor (Current)\n\nApr 2021 - Present'},
 {title:'Jon Utenfor',url:'https://linkedin.com/in/jon-utenfor',text:'Marketing Manager at Acme Corp\nStockholm, Sweden\n### Marketing Manager - [Acme](x) (Current)'},
 {title:'Norwegian Institute of Public Health',url:'https://www.linkedin.com/company/nipH',text:'x'}];
const L=CD.cdParseLinkedIn(LI,['Folkehelseinstituttet','Norwegian Institute of Public Health','FHI']);
t('L01 bare personer med bekreftet arbeidsgiver',L.people.map(x=>x.name),['Siri Haugsnes','Hilde Hartmann Holsten']);
t('L02 tittel, lokasjon og nåværende fra profilen',L.people.map(x=>x.title+'|'+x.loc+'|'+x.cur),['Senior kommunikasjonsrådgiver|Oslo|true','Senior Communications Advisor|Oslo|true']);
t('L03 uten bekreftet arbeidsgiver forkastes (talt som droppet)',L.dropped,v=>v>=1);
const A=CD.cdFromApollo([{id:'5'.repeat(24),first_name:'Ola',last_name_obfuscated:'Ha***n',title:'Head of Events',country:'Norway',city:'Oslo'}]);
t('A01 Apollo-kandidat med skjult etternavn markeres masked',A.map(x=>[x.name,x.masked,x.loc]),[['Ola Ha***n',true,'Oslo']]);
const G=CD.cdParseGeneral('Kontakt oss: post@fhi.no, Tlf.: 21 07 70 00 (+4721077000)\nkari.nordmann@fhi.no\nmedia@fhi.no','fhi.no');
t('G01 generelle adresser, ikke personadresser, + telefon',[G.emails.map(e=>e.v+':'+e.kind),G.phones],[['post@fhi.no:generell','media@fhi.no:rolle'],['+47 21 07 70 00']]);
t('P01 sidetyper etter sti',['https://x.no/om-oss/team','https://x.no/arrangement/fagdag','https://x.no/nyheter/a','https://x.no/program.pdf','https://x.no/produkt'].map(CD.cdPageKind),['team','event','news','pdf','other']);
const acc=(seg,extra)=>({segId:seg,size:'M',domain:'x.no',roles:[],enr:{event_signals:[]},...extra});
const U1=CD.cdUnderstand(acc('forskning')); t('U01 forskningsinstitutt: events → kommunikasjon → formidling → program',U1.families.slice(0,4).map(f=>f.id),['events','comms','formidling','program']);
t('U02 forlag: marketing først',CD.cdUnderstand(acc('forlag')).families[0].id,'marketing');
t('U03 fagorganisasjon: member events først',CD.cdUnderstand(acc('fag')).families.slice(0,3).map(f=>f.id),['member','events','kurs']);
t('U04 ambassade: public diplomacy først, politisk/handel til slutt',CD.cdUnderstand(acc('ambassade')).families.map(f=>f.id),['pubdip','comms','events','polecon','leadership']);
t('U05 B2B/SaaS: field marketing, events, demand gen',CD.cdUnderstand(acc('saas')).families.slice(0,3).map(f=>f.id),['field','events','demand']);
const Ul=CD.cdUnderstand(acc('forlag',{enr:{event_signals:[{event_name:'Debatt om bok',event_type:'debatt'}]}}));
t('U06 dokumentert debatt løfter formidling i forlag',Ul.families.slice(0,4).map(f=>f.id).includes('formidling'),true);
const Us=CD.cdUnderstand(acc('forskning',{size:'S'})); t('U07 liten organisasjon: ledelse tidlig',Us.families.findIndex(f=>f.id==='leadership')<=2,true);
t('U08 tre runder med tittelutvidelse (>=10 termer i runde 1)',[Object.keys(U1.rounds).length,U1.terms[1].length],v=>v[0]===3&&v[1]>=10);
t('U09 events-familien inneholder spesifiserte titler',['arrangementsansvarlig','konferanseansvarlig','head of events','kurs og konferanse','møte og arrangement'].every(x=>CD.CD_FAM.events.terms.includes(x)),true);
t('U10 kommunikasjon/program/marketing-titler fra spesifikasjonen',[['kommunikasjonssjef','formidlingsleder'].every(x=>CD.CD_FAM.comms.terms.includes(x)||CD.CD_FAM.formidling.terms.includes(x)),['programansvarlig','programsjef','prosjektleder'].every(x=>CD.CD_FAM.program.terms.includes(x)||CD.CD_FAM.proj.terms.includes(x)),['markedsdirektør','demand generation','partner marketing'].every(x=>CD.CD_FAM.marketing.terms.includes(x))],[true,true,true]);
const S=(seg,p,extra)=>CD.cdScore(acc(seg,extra),p,CD.cdUnderstand(acc(seg,extra)));
const s1=S('forskning',{title:'Eventansvarlig',email:'nora@x.no',cd:{ev:[{k:'organizer',url:'https://x.no/arrangement/a'},{k:'team',url:'https://x.no/team'}],loc:'Oslo'}});
t('S01 eventansvarlig med arrangørkobling + egen side + Oslo scorer høyt',s1.score,v=>v>=75);
const s2=S('forskning',{title:'Senior kommunikasjonsrådgiver',linkedin:'https://linkedin.com/in/x',cd:{ev:[{k:'linkedin',url:'https://linkedin.com/in/x'}],loc:'Oslo'}});
t('S02 senior kommunikasjonsrådgiver (forskning) over anbefalingsterskel, under eventansvarlig',[s2.score>=CD.CD_TUNE.rec,s2.score<s1.score],[true,true]);
const s3=S('forskning',{title:'Seniorforsker',cd:{ev:[{k:'team',url:'https://x.no/team'}],loc:'Oslo'}});
t('S03 seniorforsker får fradrag for feil fagfunksjon og er ikke plausibel',[s3.neg.map(n=>n.k),s3.plaus],[['wrong'],false]);
t('S04 HR og teknisk trekkes',[S('fag',{title:'HR-rådgiver',cd:{}}).neg[0].k,S('fag',{title:'IT-sjef',cd:{}}).neg[0].k],['hr','tech']);
t('S05 tidligere ansatt og utlandet trekkes',[S('fag',{title:'Kommunikasjonssjef',cd:{cur:false,loc:'utland:Sweden'}}).neg.map(n=>n.k).sort()],[['abroad','former']]);
t('S06 generisk marketing uten eventkobling scorer lavere enn event-person med kobling',S('forlag',{title:'Marketing Manager',cd:{loc:'Oslo'}}).score<S('forlag',{title:'Event Manager',cd:{ev:[{k:'organizer',url:'https://x.no/e'}],loc:'Oslo'}}).score,true);
t('S07 verifisert e-post gir 10 poeng, uverifisert 5',[S('fag',{title:'Event Manager',email:'a@x.no',emailStatus:'verifisert',verifiedAt:'2026-10-01',cd:{}}).parts.find(p=>p.k==='data').pts,S('fag',{title:'Event Manager',email:'a@x.no',cd:{}}).parts.find(p=>p.k==='data').pts],[10,5]);
t('S08 hvert poeng har forklaring og totalsummen går opp',s1.parts.every(p=>p.t&&p.pts)&&s1.score===Math.min(100,s1.sum),true);
const M=[]; CD.cdMerge(M,{name:'Nora Test',title:'Eventansvarlig',ev:[{k:'organizer',url:'u1'}]}); CD.cdMerge(M,{name:'nora test',linkedin:'https://l/x',ev:[{k:'linkedin',url:'u2'}]});
t('M01 samme person fra to kilder slås sammen med begge bevis',[M.length,M[0].ev.map(e=>e.k),M[0].linkedin],[1,['organizer','linkedin'],'https://l/x']);
console.log('\nSUM: '+ok+' bestått, '+bad+' feilet');
