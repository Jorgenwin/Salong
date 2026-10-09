/* ---------- Masseutsendelse: legg en hel liste i en e-postsekvens (som i HubSpot) ----------
   Salong sender ikke selv. Siden har ingen server som kjører når den er lukket, og koblingene er satt opp for å lage UTKAST.
   Flyten er derfor: legg liste i sekvens → hver dag lages utkastene som er forfalt i Outlook eller Gmail → du trykker send → du merker som sendt. */
UI.ts={aud:'t3',cad:'T3',paste:'',seg:'byra',busy:false,msg:'',parsed:null,open:{}};
const TS_AUD=[['t3','Tier 3 uten sekvens','T3'],['t2','Tier 2 uten sekvens','T2'],['pb','Event-byråer og tech-partnere','PB'],['paste','Lim inn egen liste','PB']];
function tsCand(aud){
  let L=mtAll().filter(a=>a.kind==='ny'&&!a.prog&&!a.flags.disqualified&&!a.dncAcc&&!a.flags.opportunity&&!a.flags.engaged&&ownMatch(a.ownerId));
  if(aud==='t3') L=L.filter(a=>a.pt===3); else if(aud==='t2') L=L.filter(a=>a.pt===2); else if(aud==='pb') L=L.filter(a=>['byra','tech'].includes(a.segId)&&a.pt); else L=[];
  const ready=L.filter(a=>mtCanEnroll(a).ok);
  return {all:L,ready,missing:L.filter(a=>!mtCanEnroll(a).ok)}; }
async function tierEnrollMany(ids,cad,note){
  let n=0; const bad=[];
  for(const id of ids){ const a=mtGet(id); if(!a){ continue; } const c=mtCanEnroll(a); if(!c.ok||['opt_out','bounced'].includes(a.seq&&a.seq.status)){ bad.push(a.name); continue; }
    const seq={...(a.seq||{}),enrolledAt:mtToday(),status:'active',stepsDone:[],cad,drafted:{}};
    await mtPatch(id,{seq,bStage:'active'},'Lagt i sekvens: '+tierCad(cad).name+(note?' ('+note+')':'')); n++; }
  return {n,bad}; }
/* innlimt liste: «Navn; e-post; organisasjon» eller tab- og kommaseparert fra regneark */
function tsParse(txt){
  const rows=[]; const re=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  for(const line of String(txt||'').split(/\r?\n/)){ const t=line.trim(); if(!t) continue;
    const parts=t.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(x=>x.replace(/^"|"$/g,'').trim()).filter(Boolean);
    const email=(parts.find(x=>re.test(x))||'').toLowerCase(); const rest=parts.filter(x=>x.toLowerCase()!==email);
    const name=rest[0]||'', org=rest[1]||(email?email.split('@')[1].replace(/\.(no|com|org|net|se|dk)$/,'').replace(/^./,c=>c.toUpperCase()):'');
    if(/^(navn|name|fornavn)$/i.test(name)&&/^(e-?post|email)$/i.test(email||rest[1]||'')) continue;
    rows.push({name,email,org,ok:!!email&&!!name}); }
  return rows; }
async function tsImport(rows,cad,segId){
  let made=0,reuse=0,pers=0,bad=0; const ids=[];
  for(const r of rows){ if(!r.ok){ bad++; continue; }
    const dom=r.email.split('@')[1]; const ex=mtAll().concat(mtBuild().accs).find(a=>(a.domain&&a.domain===dom&&!/gmail|outlook|hotmail|yahoo|icloud/.test(dom))||mtNorm(a.name)===mtNorm(r.org));
    let id=ex&&ex.id; if(!id){ const x=await mtAddAccount({name:r.org,website:/gmail|outlook|hotmail|yahoo|icloud/.test(dom)?'':dom,segId,src:'liste',why:'Fra din egen kontaktliste'}); if(x.err&&!x.dup){ bad++; continue; } id=x.id||x.dup; made+=x.id?1:0; if(x.id) await mtQualify(id,'Egen kontakt, lagt inn fra liste'); } else reuse++;
    const a=mtGet(id); if(a&&!a.persons.some(p=>p.email&&p.email.toLowerCase()===r.email)){ const x=await mtAddPerson(id,{name:r.name,email:r.email,source:'Innlimt liste'}); if(x.id) pers++; }
    ids.push(id); }
  const E=await tierEnrollMany([...new Set(ids)],cad,'innlimt liste');
  return {made,reuse,pers,bad,enrolled:E.n,notEnrolled:E.bad}; }

/* utkast som er forfalt i dag */
function tsDue(){
  const today=mtToday(); const out=[];
  for(const a of mtAll()){ const p=a.prog; if(!p||!p.next||a.dncAcc||a.flags.disqualified||a.stage==='paused'||['replied','bounced','opt_out','paused','completed'].includes(a.seq.status)||a.flags.opportunity) continue;
    const n=p.next; if(n.ch!=='epost'||!n.m||n.due>today) continue; const d=tierDraft(a,n); if(!d||!d.to) continue;
    out.push({a,n,d,drafted:!!(a.seq.drafted&&a.seq.drafted[n.i])}); }
  return out.sort((x,y)=>x.n.due.localeCompare(y.n.due)||x.a.pt-y.a.pt); }
function tsUpcoming(){ const today=mtToday(), to=mtAddD(today,7); let e=0,c=0,o=0; for(const a of mtAll()){ const n=a.prog&&a.prog.next; if(!n||a.dncAcc||a.flags.disqualified||a.flags.opportunity||a.stage==='paused'||['replied','bounced','opt_out','paused','completed'].includes(a.seq.status)) continue; if(n.due>to) continue; if(n.ch==='epost') e++; else if(n.ch==='telefon') c++; else o++; } return {e,c,o}; }
async function tsMakeDrafts(kind){
  const U=UI.ts; if(U.busy||!mcp) return; const L=tsDue().filter(x=>!x.drafted); if(!L.length) return;
  U.busy=true; let done=0, fail=0, last=''; const msg=()=>{ const el=document.getElementById('tsMsg'); if(el) el.textContent='Lager utkast '+done+' av '+L.length+(fail?' · '+fail+' feilet':'')+' …'; }; msg();
  const server=kind==='ol'?'Microsoft 365':'Gmail';
  for(const x of L){
    try{ if(kind==='ol'){ const html=x.d.body.split(/\n{2,}/).map(par=>'<p>'+esc(par).replace(/\n/g,'<br>')+'</p>').join(''); await mcp.callTool(server,'outlook_create_draft',{subject:x.d.subject.slice(0,255),body:html,bodyType:'html',to:[x.d.to]}); }
      else await mcp.callTool(server,'create_draft',{subject:x.d.subject,body:x.d.body,to:[x.d.to]});
      const seq={...x.a.seq,drafted:{...(x.a.seq.drafted||{}),[x.n.i]:mtToday()}}; await mtPatch(x.a.id,{seq},null); done++; msg(); }
    catch(e){ fail++; last=mcpMsg(e,server); if(e&&(e.code==='server_not_connected'||e.code==='needs_reauth'||e.code==='not_in_manifest')) break; } }
  U.busy=false; U.msg=done+' utkast lagret i '+server+(fail?'. '+fail+' feilet'+(last?': '+last:'.'):'. Åpne postkassen, kontroller og send. Kom tilbake hit og merk som sendt.'); renderView(true); }

function tsMailEditor(cadKey){
  const c=tierCad(cadKey), seen=new Set(); const T=tierCfg();
  return c.steps.filter(s=>s.m&&!seen.has(s.m)&&seen.add(s.m)).map(s=>{ const m=tierMail(s.m);
    return '<details class="ts-ed"'+(UI.ts.open[s.m]?' open':'')+' data-tsopen="'+s.m+'"><summary><b>Dag '+s.d+'</b> · '+esc(s.t)+(m.own?' <small>(redigert)</small>':'')+'</summary><label class="f"><span>Emne</span><input class="in" id="tsS-'+s.m+'" value="'+esc(m.s)+'"></label><label class="f"><span>Tekst</span><textarea class="in" id="tsB-'+s.m+'" rows="9">'+esc(m.b)+'</textarea></label>'+
     '<p class="mt-hint">Fletter inn: {fornavn} {org} {segment} {bruk} {avbestilling} {signatur}. «…» betyr at du skriver selv før du sender.</p><div class="row"><button type="button" class="btn sm" data-tsmsave="'+s.m+'">Lagre mal</button>'+(m.own?'<button type="button" class="btn ghost sm" data-tsmreset="'+s.m+'">Tilbakestill</button>':'')+'</div></details>'; }).join(''); }

function tierSeqHTML(){
  const U=UI.ts, aud=TS_AUD.find(x=>x[0]===U.aud)||TS_AUD[0], cadK=U.cad, cad=tierCad(cadK), C=tsCand(U.aud), due=tsDue(), up=tsUpcoming();
  const opt=(L,v)=>L.map(([k,n])=>'<option value="'+k+'"'+(k===v?' selected':'')+'>'+esc(n)+'</option>').join('');
  const segOpts=mtCfg().segs.filter(s=>s.on).map(s=>[s.id,mtSegShort(s.name)]);
  let body;
  if(U.aud==='paste'){
    const rows=U.parsed;
    body='<label class="f"><span>Liste (én person per linje: navn; e-post; organisasjon)</span><textarea class="in" id="tsPaste" rows="6" placeholder="Kari Nordmann; kari@byraa.no; Byrå AS">'+esc(U.paste)+'</textarea></label>'+
     '<div class="row"><label class="f"><span>Segment for nye organisasjoner</span><select class="in" id="tsSeg">'+opt(segOpts,U.seg)+'</select></label><button type="button" class="btn" data-tsprev="1">Forhåndsvis liste</button></div>'+
     (rows?'<p class="mt-hint"><b>'+rows.filter(r=>r.ok).length+'</b> gyldige av '+rows.length+' linjer'+(rows.some(r=>!r.ok)?'. Linjer uten navn eller e-post hoppes over.':'.')+'</p><button type="button" class="btn primary" data-tsgo="paste"'+(rows.some(r=>r.ok)&&!U.busy?'':' disabled')+'>Legg til og start «'+esc(cad.name)+'»</button>':'');
  } else {
    body='<p class="ts-cnt"><b>'+C.ready.length+'</b> klare · <b>'+C.missing.length+'</b> mangler kontaktperson med e-post · '+C.all.length+' i målgruppen</p>'+
     '<div class="row"><button type="button" class="btn primary" data-tsgo="'+U.aud+'"'+(C.ready.length&&!U.busy?'':' disabled')+'>Legg '+C.ready.length+' i «'+esc(cad.name)+'»</button>'+(C.missing.length?'<button type="button" class="btn" data-tsberik="1">Lag batch for de '+C.missing.length+' som mangler kontakt</button>':'')+'</div>'+
     (C.ready.length?'<details class="ts-dt"><summary>Hvem er med?</summary><p class="mt-hint">'+C.ready.slice(0,40).map(a=>esc(a.name)).join(' · ')+(C.ready.length>40?' · +'+(C.ready.length-40)+' til':'')+'</p></details>':'')+
     (C.missing.length?'<p class="mt-hint">De som mangler kontakt kan berikes i Arbeidsliste (Berik), eller du limer inn kjente kontakter med «Lim inn egen liste».</p>':'');
  }
  const steps='<ol class="mt-stp">'+cad.steps.map(s=>'<li class="later"><i></i><b>Dag '+s.d+'</b><span>'+esc(MT_CH[s.ch])+'</span><small>'+esc(s.t)+'</small></li>').join('')+'</ol>';
  const dueRows=due.length?'<div class="tbl mt-tw"><table class="mt-t ts-t"><thead><tr><th>Organisasjon</th><th>Til</th><th>Steg</th><th>Forfall</th><th></th></tr></thead><tbody>'+due.slice(0,60).map(x=>'<tr><td class="mt-o"><b>'+esc(x.a.name)+'</b><small>'+tierShort(x.a.pt)+' · '+esc(x.a.seq&&x.a.seq.cad?tierCad(x.a.seq.cad)?tierCad(x.a.seq.cad).name:'':'')+'</small></td><td>'+esc(x.d.to)+'</td><td>Dag '+x.n.d+'<small>'+esc(x.n.t)+'</small></td><td><span class="mt-nx'+(x.n.due<mtToday()?' late':'')+'">'+esc(mtFd(x.n.due))+'</span></td><td>'+
     '<details class="ts-pv"><summary>Forhåndsvis</summary><p><b>'+esc(x.d.subject)+'</b></p><pre>'+esc(x.d.body)+'</pre></details>'+(x.drafted?'<span class="chip a">Utkast laget</span> ':'')+'<button type="button" class="btn ghost sm" data-tssent="'+esc(x.a.id)+'|'+x.n.i+'">Merk sendt</button></td></tr>').join('')+'</tbody></table></div>':'<p class="mt-hint">Ingen e-poster er forfalt akkurat nå. Når du har lagt folk i en sekvens, dukker dagens e-poster opp her.</p>';
  const nNew=due.filter(x=>!x.drafted).length, nDr=due.filter(x=>x.drafted).length;
  const act=due.length?'<div class="row ts-act">'+(mcp?'<button type="button" class="btn primary" data-tsdraft="gm"'+(nNew&&!U.busy?'':' disabled')+'>Utkast i Gmail ('+nNew+')</button><button type="button" class="btn" data-tsdraft="ol"'+(nNew&&!U.busy?'':' disabled')+'>Utkast i Outlook ('+nNew+')</button>':'')+'<button type="button" class="btn ghost" data-tscopy="1">Kopier alle ('+due.length+')</button>'+(nDr?'<button type="button" class="btn ghost" data-tssentall="1">Merk '+nDr+' med utkast som sendt</button>':'')+'<span class="mt-hint" id="tsMsg" role="status">'+esc(U.msg||'')+'</span></div><p class="mt-hint">Velg postkassen du sender fra som Litteraturhuset. Utkastene sendes aldri av Salong.</p>':'';
  return '<section class="mt-sec ts"><div class="mt-sh"><h3>Masseutsendelse</h3><span class="mt-hint">Legg en hel liste i en e-postsekvens. Dagens e-poster blir utkast du sender selv.</span></div>'+
   '<div class="ts-g"><label class="f"><span>1. Målgruppe</span><select class="in" id="tsAud">'+opt(TS_AUD.map(x=>[x[0],x[1]]),U.aud)+'</select></label><label class="f"><span>2. Sekvens</span><select class="in" id="tsCad">'+opt([['T3','E-post, 4 steg (Tier 3)'],['PB','Byråer og partnere, 4 steg'],['T2','Ring, 4 steg (Tier 2)'],['T1','Personlig, 6 steg (Tier 1)']],cadK)+'</select></label></div>'+
   '<h4 class="ts-h">'+esc(cad.name)+'</h4>'+steps+'<div class="ts-b">'+body+'</div>'+(U.msg&&!due.length?'<p class="mt-note">'+esc(U.msg)+'</p>':'')+
   '<details class="ts-dt"><summary>E-postene i sekvensen (rediger)</summary>'+tsMailEditor(cadK)+'</details></section>'+
   '<section class="mt-sec ts"><div class="mt-sh"><h3>Dagens e-poster <span class="mt-cnt">'+due.length+'</span></h3><span class="mt-hint">Neste 7 dager: '+up.e+' e-poster · '+up.c+' samtaler'+(up.o?' · '+up.o+' andre steg':'')+'</span></div>'+act+dueRows+'</section>'; }
{ const _tsq=mtSeqHTML; mtSeqHTML=function(){ return tierSeqHTML()+_tsq(); }; }

if(!window.__tsWired){ window.__tsWired=1;
  const rr=()=>renderView(true);
  document.addEventListener('change',e=>{ const t=e.target; if(!t||!t.closest) return; const U=UI.ts;
    if(t.id==='tsAud'){ U.aud=t.value; U.cad=(TS_AUD.find(x=>x[0]===t.value)||TS_AUD[0])[2]; U.msg=''; rr(); }
    else if(t.id==='tsCad'){ U.cad=t.value; rr(); }
    else if(t.id==='tsSeg'){ U.seg=t.value; } });
  document.addEventListener('input',e=>{ if(e.target&&e.target.id==='tsPaste') UI.ts.paste=e.target.value; });
  document.addEventListener('toggle',e=>{ const d=e.target; if(d&&d.dataset&&d.dataset.tsopen) UI.ts.open[d.dataset.tsopen]=d.open; },true);
  document.addEventListener('click',async e=>{ const t=e.target; if(!t||!t.closest) return; const U=UI.ts; let b;
    if((b=t.closest('[data-tsprev]'))){ const el=document.getElementById('tsPaste'); if(el) U.paste=el.value; U.parsed=tsParse(U.paste); rr(); return; }
    if((b=t.closest('[data-tsgo]'))){ if(U.busy) return; U.busy=true; b.disabled=true;
      try{ if(b.dataset.tsgo==='paste'){ const r=await tsImport(U.parsed||tsParse(U.paste),U.cad,U.seg); U.msg=r.enrolled+' lagt i sekvensen'+(r.made?' · '+r.made+' nye organisasjoner':'')+(r.reuse?' · '+r.reuse+' fantes fra før':'')+(r.bad?' · '+r.bad+' linjer hoppet over':'')+(r.notEnrolled.length?' · '+r.notEnrolled.length+' kunne ikke enrolles':'')+'.'; U.paste=''; U.parsed=null; }
        else { const C=tsCand(b.dataset.tsgo); const r=await tierEnrollMany(C.ready.map(a=>a.id),U.cad); U.msg=r.n+' accounts er lagt i «'+tierCad(U.cad).name+'». Første e-post forfaller i dag.'; } }
      catch(err){ U.msg='Noe gikk galt: '+(err&&err.message||err); }
      U.busy=false; toast(U.msg); rr(); return; }
    if((b=t.closest('[data-tsberik]'))){ const C=tsCand(U.aud); const id=await mtCreateBatch({name:'Berik: '+(TS_AUD.find(x=>x[0]===U.aud)||[])[1],ids:C.missing.map(a=>a.id)}); UI.mt.tab='arb'; toast('Batch med '+C.missing.length+' accounts er laget. Åpne den i Arbeidsliste og velg Berik.'); rr(); return; }
    if((b=t.closest('[data-tsdraft]'))){ tsMakeDrafts(b.dataset.tsdraft); return; }
    if((b=t.closest('[data-tssent]'))){ const [id,i]=b.dataset.tssent.split('|'); const a=mtGet(id); if(a&&a.prog&&!(a.seq.stepsDone||[]).includes(Number(i))){ await mtStep(id,Number(i)); } rr(); return; }
    if((b=t.closest('[data-tssentall]'))){ let n=0; for(const x of tsDue().filter(x=>x.drafted)){ await mtStep(x.a.id,x.n.i); n++; } toast(n+' merket som sendt'); rr(); return; }
    if((b=t.closest('[data-tscopy]'))){ const txt=tsDue().map(x=>'Til: '+x.d.to+'\nEmne: '+x.d.subject+'\n\n'+x.d.body).join('\n\n----------\n\n'); copyText(txt,null); return; }
    if((b=t.closest('[data-tsmsave]'))){ const m=b.dataset.tsmsave, s=document.getElementById('tsS-'+m), bd=document.getElementById('tsB-'+m); const T=tierCfg(); await tierSave({mail:{...T.mail,[m]:{s:s.value,b:bd.value}}}); toast('Malen er lagret'); rr(); return; }
    if((b=t.closest('[data-tsmreset]'))){ const m=b.dataset.tsmreset, T=tierCfg(), nm={...T.mail}; delete nm[m]; await tierSave({mail:nm}); toast('Malen er tilbakestilt'); rr(); return; } }); }
