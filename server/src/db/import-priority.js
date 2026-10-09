'use strict';

// Culture-first import suggestions. The rules follow src/tier.js and src/mt.js:
// cultural/literary mission -> top accounts, evidenced event activity -> fit,
// max 30 top accounts, and existing manual A/B/C is never overwritten.
// The import estimate is deliberately conservative: no invented room capacity,
// prior relationships, reach, or external research. No sample-only records.
const SEG={
  forlag:['P0',3],forskning:['P0',2],fag:['P0',2],ambassade:['P0',2],
  tech:['P0',1],pharma:['P1',0],ngo:['P1',2],saas:['P1',0],
  finans:['P1',0],konsulent:['P1',0],bedrift:['P1',0],
  offentlig:['P2',1],utdanning:['P2',1],byra:['P2',1],ovrige:['P2',1]
};
const CULTURAL_WORDS=/litterat|\bbok\b|bøker|bokslipp|forfatter|forlag|lesning|lesing|poesi|dikt|kultur(?!hus|enhet)|festival|konsert|musikk|\bkunst(?!ig)|teater|film\b|debatt|ytringsfrihet|bibliotek|museum|oversett|kritiker/gi;
const MAX_A=30;
const MIN_FIT_A=35;
const text=value=>typeof value==='string'?value.trim():'';

function analyzeAccount(d){
  const [segmentPriority,baseCulture]=SEG[d.segId]||['P2',1];
  // A venue mentioned in an interpretation ('why') does not turn the account
  // into a cultural organization. Nor does 'kunstig intelligens' mean kunst.
  const words=[...new Set(((text(d.name)+' '+text(d.about)).match(CULTURAL_WORDS)||[])
    .map(word=>word.toLowerCase().slice(0,5)))];
  const culture=Math.min(3,baseCulture+(baseCulture>=1?
    (words.length>=2?2:words.length?1:0):0));
  const core=words.length>=2||(d.segId==='forlag'&&words.length>=1);
  const signals=(d.enr&&Array.isArray(d.enr.event_signals))?d.enr.event_signals:[];
  const confirmed=signals.filter(s=>s.level==='Dokumentert'&&text(s.source_url||s.source));
  const likely=signals.filter(s=>s.level==='Indikasjon'&&text(s.source_url||s.source));
  const event=confirmed.length?'Dokumentert':likely.length?'Indikasjon':'Ukjent';
  const eventPoints=event==='Dokumentert'?30:event==='Indikasjon'?15:0;
  const segmentPoints=segmentPriority==='P0'?20:segmentPriority==='P1'?12:5;
  const geographyPoints=d.geo==='oslo'?10:d.geo==='norge'?5:0;
  const sizePoints=d.size==='L'?10:d.size==='M'?6:d.size==='S'?3:0;
  const fit=eventPoints+segmentPoints+geographyPoints+sizePoints;
  return {
    id:d.id,name:text(d.name),segId:d.segId||null,
    culture,words,segment_priority:segmentPriority,event,fit,
    fit_parts:{event:eventPoints,room:0,segment:segmentPoints,
      geography:geographyPoints,size:sizePoints,relationship:0},
    score:Math.round((culture*20+(core?8:0)+fit*0.25)*100)/100,
    source_url:text((confirmed[0]||likely[0]||{}).source_url)||text(d.srcUrl||d.website),
    checked_at:(confirmed[0]||likely[0]||{}).sourceDate||d.checkedAt||null,
    existing_tier:d.existing_tier||null,tier:null,tier_origin:null,reason:null
  };
}

function rankAccounts(input,{limitA=MAX_A}={}){
  if(!Array.isArray(input))throw new TypeError('Account rows must be an array');
  const rank=input.filter(x=>text(x.name)).map(analyzeAccount);
  const pending=[];
  for(const c of rank){
    if(['A','B','C'].includes(c.existing_tier)){
      c.tier=c.existing_tier;c.tier_origin='existing';
    } else pending.push(c);
  }
  pending.sort((a,b)=>b.score-a.score||b.fit-a.fit||a.name.localeCompare(b.name,'nb'));
  let usedA=rank.filter(x=>x.tier==='A').length;
  for(const c of pending){
    if(c.culture>=3&&c.fit>=MIN_FIT_A&&usedA<limitA){
      c.tier='A';usedA++;
    }else if(c.culture>=2||(c.culture===1&&c.fit>=40)){
      c.tier='B';
    }else c.tier='C';
    c.tier_origin='salong_culture_first';
  }
  for(const c of rank){
    const parts=['segment '+(c.segId||'ukjent')+' ('+c.segment_priority+')',
      'kulturprofil '+c.culture+'/3','arrangementsignal '+c.event.toLowerCase(),
      'konservativ fit '+c.fit+'/100'];
    if(c.tier_origin==='existing')parts.push('eksisterende manuell prioritet beholdt');
    else if(c.tier==='A')parts.push('kultursterkt toppmål');
    else if(c.culture>=3&&c.fit>=MIN_FIT_A)parts.push('A-grense på maks 30 nådd');
    else if(c.tier==='B')parts.push('prioritert oppfølging');
    else parts.push('lavere prioritet i kultur-først-modellen');
    c.reason=parts.join(' · ');
  }
  return rank.sort((a,b)=>({A:0,B:1,C:2}[a.tier]-{A:0,B:1,C:2}[b.tier])||
    b.score-a.score||a.name.localeCompare(b.name,'nb'));
}

// Apply only to normalized organization tiers and prospect metadata. Raw
// artifact_export.documents is always staged unmodified by applyImport.
function suggestForCompanyPlan(rows,raw){
  const organizations=new Map(rows.organizations.map(org=>[org.id,org]));
  const prospects=new Map(rows.prospects.map(p=>[p.organization_id,p]));
  const candidate=[];
  const named=new Set();
  for(const r of raw){
    if(r.collection!=='mtacc'||r.data.example===true||!text(r.data.name)||!organizations.has(r.docId))continue;
    const o=organizations.get(r.docId);
    candidate.push({id:r.docId,...r.data,existing_tier:o.tier});
    named.add(r.docId);
  }
  for(const org of rows.organizations){
    if(named.has(org.id))continue;
    candidate.push({id:org.id,name:org.name,segId:null,existing_tier:org.tier});
  }
  const suggestions=rankAccounts(candidate);
  for(const s of suggestions){
    const org=organizations.get(s.id);
    if(org&&!['A','B','C'].includes(org.tier))org.tier=s.tier;
    const prospect=prospects.get(s.id);
    if(prospect){
      prospect.metadata={...prospect.metadata,
        import_priority:{
          tier:s.tier,origin:s.tier_origin,method:'salong_culture_first_v1',
          culture_profile:s.culture,estimated_fit:s.fit,
          fit_parts:s.fit_parts,event_evidence:s.event,
          segment_priority:s.segment_priority,reason:s.reason,
          checked_at:s.checked_at,source_url:s.source_url
        }};
    }
  }
  const tierCounts=Object.fromEntries(['A','B','C'].map(t=>[t,suggestions.filter(s=>s.tier===t).length]));
  return {
    counts:tierCounts,classified:suggestions.length,
    retained_manual:suggestions.filter(s=>s.tier_origin==='existing').length,
    note:'Tier A/B/C are editable import suggestions. The separate demo Tier 1/2/3 planner remains dynamic.'
  };
}

module.exports={SEG,MAX_A,MIN_FIT_A,analyzeAccount,rankAccounts,suggestForCompanyPlan};
