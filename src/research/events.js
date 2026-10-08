'use strict';

// research/events.js: lesing av søke- og hentesvar, datoer, eventsignaler og romvalg. Rene funksjoner.
// Vanlig CommonJS-modul (se rules.js).

/* navnenormalisering: samme regel som normName i app_base.js (tests/e2e/u_cd.js feiler hvis de to skiller lag) */
const RS_STOP=/\b(stiftelsen|stiftelse|foreningen|forening|as|asa|sa|the|og|i|norge|norsk|norske|oslo)\b/g;
function rsNormName(n){ return String(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\(.*?\)/g,' ').replace(/[·.,&\-/]/g,' ').replace(RS_STOP,' ').replace(/\s+/g,' ').trim(); }
const mtNorm=rsNormName, iso=d=>d.toISOString();

const ENR_MON={januar:1,jan:1,februar:2,feb:2,mars:3,mar:3,april:4,apr:4,mai:5,juni:6,jun:6,juli:7,jul:7,august:8,aug:8,september:9,sep:9,sept:9,oktober:10,okt:10,november:11,nov:11,desember:12,des:12,
  january:1,february:2,march:3,may:5,june:6,july:7,october:10,oct:10,december:12,dec:12};
const ENR_MONRE='januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|january|february|march|may|june|july|october|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|okt|oct|nov|des|dec';
const ENR_EVWORD=/konferanse|conference|seminar|arrangement|event|fagdag|fagkonferanse|lansering|launch|årsmøte|webinar|summit|workshop|kurs|frokost|debatt|panel|forum|meetup|mingle|utdeling|festival|samling|dialogmøte|medlemsmøte|kickoff|kick-off|[a-zæøå]{3,}dagen\b|temadag|messe\b|frokostmøte|lunsjmøte|åpent møte/i;
const ENR_EVURL=/arrangement|event|kalender|calendar|program|konferanse|conference|seminar|fagdag|webinar|kurs|aktivitet|moter|møter/i;
const ENR_TYPES=[['fagdag',/fagdag/i],['konferanse',/konferanse|conference|summit|kongress/i],['lansering',/lansering|launch/i],['årsmøte',/årsmøte|generalforsamling/i],['webinar',/webinar/i],['workshop',/workshop|kurs/i],['debatt',/debatt|panel/i],['frokostseminar',/frokost/i],['seminar',/seminar/i],['mingle',/mingle|meetup|nettverk/i]];

function enrParseExa(t){
  return String(t||'').split(/\n-{3,}\n/).map(b=>{ const g=k=>{ const m=b.match(new RegExp('(?:^|\\n)'+k+':\\s*(.*)')); return m?m[1].trim():''; };
    const hi=b.split(/Highlights:\s*/)[1]||''; return {title:g('Title'),url:g('URL'),published:g('Published'),text:(hi||b).trim()}; }).filter(x=>x.url); }
/* web_fetch_exa svarer i et annet format enn søket: «# Tittel», «URL: …», blank linje og så hele siden; flere sider følger rett etter hverandre,
   og sider som ikke lot seg hente står som «Error fetching <url>: KODE». Eldre svar med «Title:/URL:» og «---» leses av enrParseExa. */
function enrParseFetch(t){
  const s=String(t||'').replace(/^Error fetching \S+: .*$/gm,''), re=/(?:^|\n)(?:# ([^\n]*)\n)?URL: (\S+)[^\n]*\n/g, heads=[]; let m;
  if(/(?:^|\n)Title:\s/.test(s)&&/\n-{3,}\n/.test(s)) return enrParseExa(s).filter(b=>b.url&&!/CRAWL_NOT_FOUND|CRAWL_FAILED/i.test(b.text.slice(0,200)));
  while((m=re.exec(s))) heads.push({title:(m[1]||'').trim(),url:m[2],from:m.index,body:re.lastIndex});
  return heads.map((h,i)=>({title:h.title,url:h.url,published:'',text:s.slice(h.body,i+1<heads.length?heads[i+1].from:s.length).trim()})).filter(b=>b.url&&b.text); }
const enrHost=u=>{ try{ return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); }catch(e){ return ''; } };
const enrOwn=(u,dom)=>{ const h=enrHost(u), d=String(dom||'').replace(/^www\./,'').toLowerCase(); return !!h&&!!d&&(h===d||h.endsWith('.'+d)); };
function enrDates(text){
  const out=[], re1=new RegExp('(\\d{1,2})\\.?\\s+('+ENR_MONRE+')\\.?\\s+(20\\d\\d)','gi'), re2=new RegExp('('+ENR_MONRE+')\\.?\\s+(\\d{1,2}),?\\s+(20\\d\\d)','gi'), re3=/\b(20\d\d)-(\d\d)-(\d\d)\b/g; let m;
  const push=(y,mo,d,i,len)=>{ if(mo<1||mo>12||d<1||d>31) return; out.push({date:y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),i,len}); };
  while((m=re1.exec(text))) push(+m[3],ENR_MON[m[2].toLowerCase()],+m[1],m.index,m[0].length);
  while((m=re2.exec(text))) push(+m[3],ENR_MON[m[1].toLowerCase()],+m[2],m.index,m[0].length);
  while((m=re3.exec(text))) push(+m[1],+m[2],+m[3],m.index,m[0].length);
  return out; }
function enrVenue(after){
  const lines=String(after||'').split(/\n/).map(s=>s.trim()).filter(Boolean).slice(0,5);
  for(const l of lines){ if(/^(språk|language|pris|price|påmelding|register|meld deg)/i.test(l)) continue; if(/^[A-ZÆØÅ][^.!?]{3,70},\s*[A-ZÆØÅ0-9]/.test(l)&&!/\d{1,2}[:.]\d{2}/.test(l)) return l.replace(/\s+/g,' ').slice(0,90); }
  return ''; }
function enrEvents(a,results){
  const out=[], nameN=mtNorm(a.name), seen=new Set();
  for(const r of results){
    const own=enrOwn(r.url,a.domain), txt=r.text||'', txtN=mtNorm(txt+' '+r.title);
    if(!own&&!(nameN&&txtN.includes(nameN))) continue;
    for(const d of enrDates(txt)){
      const ctx=txt.slice(Math.max(0,d.i-160),d.i+d.len+220), evw=ENR_EVWORD.test(ctx)||ENR_EVWORD.test(r.title);
      const tm=ctx.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/), evurl=ENR_EVURL.test(r.url)||ENR_EVWORD.test(r.title);
      if(!evw||!(tm||evurl)) continue;
      const key=d.date+'|'+mtNorm(r.title).slice(0,40); if(seen.has(key)) continue; seen.add(key);
      const type=(ENR_TYPES.find(t=>t[1].test(r.title+' '+ctx))||['arrangement'])[0];
      const att=ctx.match(/(\d{2,4})\s*(?:deltakere|deltagere|participants|attendees|gjester|besøkende)/i);
      const venue=enrVenue(txt.slice(d.i+d.len,d.i+d.len+260));
      out.push({title:(r.title||'').slice(0,140),type,date:d.date,time:tm?tm[1].padStart(2,'0')+':'+tm[2]+'–'+tm[3].padStart(2,'0')+':'+tm[4]:'',venue,capacity:att?+att[1]:null,
        source:r.url,sourceDate:r.published?String(r.published).slice(0,10):iso(new Date()).slice(0,10),confidence:own?'high':'medium',level:own?'Dokumentert':'Indikasjon'}); } }
  return out; }
const enrToLegacy=e=>({event_name:e.title,event_type:e.type,level:e.level,date:e.date,recurrence:'',venue:e.venue||'',source_url:e.source,source_date:e.sourceDate,
  title:e.title,type:e.type,time:e.time||'',capacity:e.capacity,source:e.source,sourceDate:e.sourceDate,confidence:e.confidence});
function enrMerge(old,evs,roomPick){
  const have=(old&&old.event_signals)||[], key=e=>(e.date||'')+'|'+mtNorm(e.event_name||e.title||'').slice(0,40), seen=new Set(have.map(key)), add=evs.map(enrToLegacy).filter(e=>!seen.has(key(e)));
  const o={...(old||{}),event_signals:have.concat(add)};
  if(roomPick&&!o.room_fit){ o.room_fit=roomPick.fit; o.room_fit_reason=roomPick.reason; }
  return {enr:o,added:add.length}; }
function enrRoom(evs){
  const e=evs.filter(x=>x.capacity).sort((x,y)=>y.capacity-x.capacity)[0]; if(!e) return null;
  const fit=e.capacity>=200?'Solstad':e.capacity>=100?'Collett':'Berner-salongen';
  return {fit,reason:'Kilden oppgir '+e.capacity+' deltakere på «'+e.title.slice(0,70)+'» ('+enrHost(e.source)+'). Romvalg er avledet av dette tallet.'}; }

module.exports = {
  RS_STOP, rsNormName, ENR_MON, ENR_MONRE, ENR_EVWORD, ENR_EVURL, ENR_TYPES, enrParseExa, enrParseFetch, enrHost,
  enrOwn, enrDates, enrVenue, enrEvents, enrToLegacy, enrMerge, enrRoom
};
