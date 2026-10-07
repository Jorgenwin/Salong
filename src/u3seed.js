/* ---------- Eksempeldata for demoen: arbeidsfordeling, kontakthistorikk og saker spredt over 2026 og 2027 ----------
   Brukes bare i demomodus, ikke mot en delt database. Alt er merket example:true og kan fjernes under Data og oppsett. */
let U3_DEMO=false;
function u3Seed(){ U3_DEMO=true;
  const ago=n=>iso(new Date(Date.now()-n*864e5)), J='m-jorgen', Ph='m-phillip', at=ago(60);
  const own={'o-recovery':J,'o-frambu':J,'o-rodekors':Ph,'o-nupi':Ph,'o-fhi':J,'o-farma':Ph,'o-heartland':J,'o-uf':Ph,'o-kolofon':J,'o-matmarked':Ph,'o-lesesenter':J,'o-nbf':Ph,'o-jodisk':Ph,'o-martinus':J,'o-konflikt':Ph,'o-kvinnehelse':J,'o-lnu':Ph};
  for(const [id,m] of Object.entries(own)) if(S.orgs[id]) S.orgs[id].ownerId=m;
  const add=(id,ownerId,tier,extra)=>{ const p=PROFILES[id]; if(!p||S.orgs[id]) return; S.orgs[id]={name:p.name,segment:p.segment||'',tier,former:false,notes:'',website:p.website||'',contacts:[],ownerId,createdAt:at,example:true,...(extra||{})}; };
  add('o-gyldendal',J,'A'); add('o-cappelen',Ph,'A'); add('o-prio',J,'A'); add('o-fafo',Ph,'B'); add('o-oslomet',J,'A',{former:true}); add('o-civita',Ph,'B'); add('o-amnesty',Ph,'B'); add('o-psykologforeningen',J,'A'); add('o-utdanningsforbundet',null,'B'); add('o-ffo',J,'B'); add('o-isf',null,'B'); add('o-nifu',Ph,'C');
  if(S.orgs['o-sifo']) S.orgs['o-sifo'].ownerId=null;
  const a=(id,orgId,type,text,days,extra)=>{ S.acts[id]={orgId,dealId:extra&&extra.dealId||null,type,text,at:ago(days),due:null,done:true,byId:null,byName:extra&&extra.by||'',asMember:extra&&extra.m||null,example:true,...(extra||{})}; };
  a('u1','o-gyldendal','call','Ringte om vårlista. Interessert i Solstad til to lanseringer.',6,{m:J,by:'Jørgen'});
  a('u2','o-cappelen','email','Sendt informasjon om Collett og Solstad.',22,{m:Ph,by:'Phillip'});
  a('u3','o-prio','call','Snakket med kommunikasjonssjef om fagdag høsten 2027.',41,{m:J,by:'Jørgen'});
  a('u4','o-fafo','email','Sendt tilbud på seminarrom.',74,{m:Ph,by:'Phillip'});
  a('u5','o-oslomet','meeting','Omvisning i Solstad avtalt og gjennomført.',12,{m:J,by:'Jørgen'});
  a('u6','o-civita','call','Ba om tilbud på Collett til vårkonferansen.',33,{m:Ph,by:'Phillip'});
  a('u7','o-psykologforeningen','email','Første e-post om fagdag i Solstad.',9,{m:J,by:'Jørgen'});
  a('u8','o-recovery','call','Oppfølging om dato.',3,{m:J,by:'Jørgen'});
  a('u9','o-rodekors','email','Sendt oppdatert tilbud.',17,{m:Ph,by:'Phillip'});
  a('u10','o-farma','call','Ringte om verdens farmasøytdag 2027.',118,{m:Ph,by:'Phillip'});
  a('u11','o-amnesty','email','Sendt invitasjon til visning.',96,{m:Ph,by:'Phillip'});
  const t=(id,orgId,text,due,m,dealId)=>{ S.acts[id]={orgId,dealId:dealId||null,type:'task',text,at:ago(5),due:new Date(Date.now()+due*864e5).toISOString(),done:false,byId:null,ownerId:m,example:true}; };
  t('u12','o-gyldendal','Send forslag til datoer for to lanseringer',2,J); t('u13','o-cappelen','Ring om vårlanseringene',-3,Ph); t('u14','o-prio','Følg opp fagdag',9,J); t('u15','o-psykologforeningen','Ring og avtal visning',4,J);
  const d=(id,orgId,title,stage,room,date,att,val,own2,days,extra)=>{ S.deals[id]={orgId,title,stage,room,date,attendees:att,pricing:'open',value:val,recurring:1,source:'outbound',ownerId:own2,lostReason:'',notes:'',createdAt:ago(days+30),stageAt:ago(days),example:true,...(extra||{})}; };
  d('ud1','o-gyldendal','Vårlansering i to deler','tilbud','solstad','2027-03-16',220,36000,J,10);
  d('ud2','o-prio','Fagdag om konfliktforskning','dialog','solstad','2027-09-08',180,32000,J,14);
  d('ud3','o-oslomet','SAMSVAR-konferansen 2027','bekreftet','solstad','2027-09-14',240,44000,J,52);
  d('ud4','o-nbf','Fagdag for bibliotekarer','bekreftet','solstad','2027-04-21',200,34000,Ph,141);
  d('ud5','o-fafo','Seminar om arbeidsliv','bekreftet','collett','2027-03-03',90,14000,Ph,96);
  d('ud6','o-civita','Vårkonferanse','tilbud','collett','2027-04-27',110,17000,Ph,20);
  d('ud7','o-psykologforeningen','Fagdag i klinisk praksis','ny','solstad','2027-11-04',260,38000,J,9);
  d('ud8','o-cappelen','Vårlansering','dialog','hofmo','2027-02-25',60,9000,Ph,18);
  d('ud9','o-amnesty','Menneskerettighetsdagen','tapt','collett','2027-12-10',120,18000,Ph,70,{lostReason:'Valgte lokale med lavere pris'});
  d('ud10','o-kvinnehelse','Heldag om kvinnehelse','bekreftet','solstad','2027-10-13',230,40000,J,38);
  d('ud11','o-konflikt','Nasjonal fagdag','holdt','solstad','2027-05-12',210,36000,Ph,24);
  d('ud12','o-farma','Farmasøytdagen 2027','dialog','collett','2027-09-24',100,15000,Ph,30);
  d('ud13','o-ffo','Medlemsseminar','dialog','hofmo','2027-11-18',70,9500,J,16);
  d('ud14','o-isf','Konferanse om samfunnsforskning','bekreftet','collett','2027-06-16',120,19000,null,160);
  d('ud15','o-uf','Juridika høstseminar','bekreftet','solstad','2027-10-05',200,33000,Ph,77);
  d('ud16','o-heartland','Høstlansering','bekreftet','hagerup','2027-10-21',50,8500,J,105);
  d('ud17','o-fhi','Fagseminar om folkehelse','dialog','wergeland','2026-12-03',90,15000,J,12);
  d('ud18','o-lesesenter','Lesefremmende dag','tilbud','wergeland','2026-12-10',150,26000,J,8);
  d('ud19','o-martinus','Bokslipp og samtale','dialog','skram','2027-01-20',60,9000,J,6);
  d('ud20','o-matmarked','Matkulturdag','bekreftet','collett','2027-03-09',100,16000,Ph,5);
  d('ud21','o-jodisk','Åpent seminar om jødisk kultur','bekreftet','solstad','2027-03-25',180,30000,Ph,11);
  d('ud22','o-nupi','Fagdag om internasjonale forhold','tilbud','skram','2027-01-14',80,13000,Ph,9);
  S.settings={...S.settings,goalValue:700000}; }
{ const _l=loadDemo; loadDemo=function(){ _l(); u3Seed(); }; }
