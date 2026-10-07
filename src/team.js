/* ---------- Team, ansvar og tildeling ----------
   Tre roller holdes adskilt: kundeansvarlig (org.ownerId), saksansvarlig (deal.ownerId), oppgaveansvarlig (act.ownerId).
   Referansen er alltid en stabil medlems-ID. Navn slås opp ved visning, så et navnebytte endrer ikke historikken.
   Identitet: plattformen gir en innlogget konto (me.id). Hvem kontoen «er» i teamet er enten koblet av brukeren selv,
   eller valgt som profil i nettleseren. Det siste er ikke innlogging og vises aldri som det.
   Tildeling endrer bare hvem som står som ansvarlig. Den endrer ikke hvem som har tilgang til noe. */
S.members=S.members||{}; S.notices=S.notices||{};
const TEAM_DEFAULT={'m-jorgen':{name:'Jørgen',active:true,accountId:null,order:1},'m-phillip':{name:'Phillip',active:true,accountId:null,order:2}};
function members(all){ const M={}; for(const [id,m] of Object.entries(TEAM_DEFAULT)) M[id]={id,...m}; for(const [id,m] of Object.entries(S.members||{})) if(m&&!m.deletedAt) M[id]={id,...(M[id]||{order:50}),...m};
  return Object.values(M).filter(m=>all||m.active!==false).sort((a,b)=>(a.order||50)-(b.order||50)||String(a.name).localeCompare(String(b.name),'nb')); }
const member=id=>id?members(true).find(m=>m.id===id)||null:null;
let PROFILE=storeLocal('get','profile')||'';
/* hvem brukeren jobber som. verified betyr bare at medlemmet er koblet til den innloggede kontoen. */
function actor(){ const L=members(true), linked=me.id?L.find(m=>m.accountId===me.id&&m.active!==false):null; if(linked) return {id:linked.id,name:linked.name,verified:true};
  const p=L.find(m=>m.id===PROFILE&&m.active!==false&&(!m.accountId||m.accountId===me.id)); return p?{id:p.id,name:p.name,verified:false}:null; }
const actorStamp=()=>{ const a=actor(); return a?{asMember:a.id,asVerified:a.verified}:{asMember:null,asVerified:false}; };
/* ansvarlig kan være en medlems-ID eller, i eldre data, en konto-ID fra plattformen */
function ownRef(id){ if(!id) return null; return member(id)||members(true).find(m=>m.accountId===id)||null; }
const ownKey=id=>{ const m=ownRef(id); return m?m.id:(id||''); };
function ownName(id,legacy){ if(!id) return 'Ufordelt'; const m=ownRef(id); return m?m.name:(people[id]?.name||legacy||'Tidligere bruker'); }
const initials=n=>String(n||'?').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
function ownChip(id,legacy){ if(!id) return '<span class="own none">Ufordelt</span>'; const n=ownName(id,legacy), m=ownRef(id); return '<span class="own'+(m&&m.active===false?' off':'')+'"><i aria-hidden="true">'+esc(initials(n))+'</i>'+esc(n)+'</span>'; }
function taskDefOwner(dealId){ const d=dealId?S.deals[dealId]:null; if(d&&d.ownerId) return ownKey(d.ownerId); const a=actor(); return a?a.id:null; }
function ownOpts(sel,placeholder){ const k=ownKey(sel), known=!sel||!!ownRef(sel);
  return (placeholder?'<option value="__" disabled'+(sel==='__'?' selected':'')+'>'+placeholder+'</option>':'')+'<option value=""'+(sel===''||sel==null?' selected':'')+'>Ufordelt</option>'+members(true).filter(m=>m.active!==false||m.id===k).map(m=>'<option value="'+esc(m.id)+'"'+(k===m.id&&sel!=='__'?' selected':'')+'>'+esc(m.name)+'</option>').join('')+(known||sel==='__'?'':'<option value="'+esc(sel)+'" selected>'+esc(ownName(sel))+'</option>'); }

/* ---------- filter: Mine, Alle, Ufordelte, valgt person ---------- */
UI.own='alle';
function ownMatch(ownerId){ const f=UI.own; if(f==='alle') return true; if(f==='ufordelt') return !ownerId; const k=ownKey(ownerId); if(f==='mine'){ const a=actor(); return !!a&&k===a.id; } return k===f; }
function ownFilterHTML(label){ const a=actor(), L=members(), few=L.slice(0,4), more=L.slice(4), btn=(k,n,dis)=>'<button type="button" data-own="'+esc(k)+'" aria-pressed="'+(UI.own===k)+'"'+(dis?' disabled title="Velg profil øverst til høyre først"':'')+'>'+esc(n)+'</button>';
  return '<div class="ownf" role="group" aria-label="'+esc(label)+'"><div class="seg ownseg">'+btn('mine','Mine',!a)+few.map(m=>btn(m.id,m.name)).join('')+btn('ufordelt','Ufordelte')+btn('alle','Alle')+'</div>'+
   (more.length?'<select class="in fsel'+(more.some(m=>m.id===UI.own)?' on':'')+'" data-ownp aria-label="Vis for en annen person"><option value="">Flere …</option>'+more.map(m=>'<option value="'+esc(m.id)+'"'+(UI.own===m.id?' selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select>':'')+
   (UI.own==='mine'&&a&&!a.verified?'<span class="note">«Mine» følger profilen valgt i denne nettleseren ('+esc(a.name)+'). Det er ikke innlogging.</span>':'')+'</div>'; }
function wireOwnFilter(v,rr){ v.querySelectorAll('[data-own]').forEach(b=>b.addEventListener('click',()=>{ UI.own=b.dataset.own; rr(); })); v.querySelector('[data-ownp]')?.addEventListener('change',e=>{ UI.own=e.target.value||'alle'; rr(); }); }

/* ---------- vern mot at to endrer ansvar samtidig ----------
   1. Kortvarig lås per dokument (acquire). Opptatt betyr at en annen er midt i en endring.
   2. Fersk lesing fra databasen, og sammenligning med den ansvarlige brukeren så da valget ble tatt.
   Er ansvarlig en annen enn forventet, skrives ingenting. Brukeren får se den nye tilstanden og må velge på nytt.
   Låsen samordner bare klienter som bruker den. Den er ikke tilgangskontroll. */
const HOLDER='tab-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
async function guarded(col,id,expect,mutate){
  if(readOnly) return {error:'Du har lesetilgang og kan ikke endre ansvar.'};
  if(!db){ const cur=S[col][id]; if(!cur||cur.deletedAt) return {error:'Finnes ikke lenger. Ingenting er endret.'}; if(ownKey(cur.ownerId)!==ownKey(expect)) return {conflict:true,current:cur}; const m=mutate(cur); if(!m) return {skipped:true,current:cur}; await put(col,id,m.doc,{action:m.action}); return {ok:true,saved:false,demo:true}; }
  if(!navigator.onLine) return {error:'Du er frakoblet. Ansvar kan bare endres når du er tilkoblet, slik at to ikke tar det samme uten å vite om hverandre.'};
  if(SYNC.queue.has(col+'/'+id)) return {error:'Det ligger en ulagret endring på dette fra før. Vent til den er lagret, og prøv igjen.'};
  let lease=null; try{ lease=await db.doc('locks/'+col+'-'+id).acquire({holder:HOLDER,ttlMs:4000}); }catch(e){ lease=null; }
  if(lease&&lease.acquired===false) return {busy:true,until:lease.expiresAt||''};
  let snap; try{ snap=await db.doc(col+'/'+id).get(); }catch(e){ return {error:'Kunne ikke lese gjeldende versjon fra databasen. Ingenting er endret.'}; }
  if(!snap||!snap.exists) return {error:'Finnes ikke lenger. Ingenting er endret.'};
  const cur=snap.data(); if(cur.deletedAt) return {error:'Er flyttet til papirkurven. Ingenting er endret.'};
  S[col][id]=cur; DV++;
  if(ownKey(cur.ownerId)!==ownKey(expect)) return {conflict:true,current:cur};
  const m=mutate(cur); if(!m) return {skipped:true,current:cur};
  const ok=await put(col,id,m.doc,{action:m.action});
  if(col==='acts') audit('acts',id,cur,S.acts[id],m.action);
  return {ok:true,saved:ok===true,lease:!!(lease&&lease.acquired)};
}
/* A = {kind:'deal'|'org'|'task', id, to, expect, note, taskIds:[], taskExpect:{id:ownerId}} */
async function doAssign(A){
  const col=A.kind==='deal'?'deals':A.kind==='org'?'orgs':'acts', to=A.to||null, act=actor(), R={moved:[],skipped:[],notice:null,noteSaved:null};
  const what=A.kind==='deal'?'saksansvarlig':A.kind==='org'?'kundeansvarlig':'oppgaveansvarlig';
  const r=await guarded(col,A.id,A.expect,cur=>{ if(A.kind==='task'&&cur.done) return null; const {ownerName,...rest}=cur; return {doc:{...rest,ownerId:to},action:'endret '+what}; });
  if(!r.ok) return {...R,...r,what};
  R.ok=true; R.saved=r.saved; R.demo=!!r.demo; R.what=what; R.from=ownKey(A.expect)||null; R.to=to;
  const rec=S[col][A.id], orgId=A.kind==='org'?A.id:rec.orgId||null, dealId=A.kind==='deal'?A.id:(A.kind==='task'?rec.dealId||null:null);
  for(const tid of (A.taskIds||[])){ const t=S.acts[tid]; if(!t){ R.skipped.push({id:tid,why:'finnes ikke lenger'}); continue; }
    const x=await guarded('acts',tid,(A.taskExpect||{})[tid]??t.ownerId??null,cur=>{ if(cur.done||cur.type!=='task') return null; const {ownerName,...rest}=cur; return {doc:{...rest,ownerId:to},action:'endret oppgaveansvarlig'}; });
    if(x.ok) R.moved.push(tid); else R.skipped.push({id:tid,text:t.text,why:x.skipped?'er allerede avsluttet':x.conflict?'har fått ny ansvarlig i mellomtiden':x.busy?'endres av en annen akkurat nå':(x.error||'ukjent feil')}); }
  const note=String(A.note||'').trim().slice(0,500);
  if(A.quiet) return R;
  if(A.kind!=='task'&&(note||R.from!==to)){ const nid=uid('a');
    const ok=await put('acts',nid,{orgId,dealId,type:'note',text:(A.kind==='deal'?'Ansvar for saken er endret.':'Kundeansvar er endret.')+(R.moved.length?' '+R.moved.length+' '+(R.moved.length===1?'åpen oppgave':'åpne oppgaver')+' fulgte med.':'')+(note?' Overleveringsbeskjed: '+note:''),at:iso(new Date()),due:null,done:true,byId:me.id||null,byName:me.name||'',handover:{from:R.from,to,kind:A.kind},...actorStamp()}); R.noteSaved=ok===true; }
  if(to&&(!act||act.id!==to)){ const nid=uid('n'), ok=await put('notices',nid,{to,kind:A.kind,entityId:A.id,orgId,dealId,from:act?act.id:null,fromVerified:!!(act&&act.verified),byId:me.id||null,byName:me.name||'',prevOwner:R.from,note,tasks:R.moved.length,at:iso(new Date()),readAt:null},{noAudit:true}); R.notice={id:nid,saved:ok===true}; }
  return R;
}

/* ---------- dialog: Tildel og Ta saken ---------- */
UI.asg=null;
function asgRec(X){ return (X.kind==='deal'?S.deals:X.kind==='org'?S.orgs:S.acts)[X.id]; }
function asgTasks(X){ return X.kind==='deal'?acts().filter(a=>a.dealId===X.id&&a.type==='task'&&!a.done):X.kind==='org'?acts().filter(a=>a.orgId===X.id&&!a.dealId&&a.type==='task'&&!a.done):[]; }
function openAssign(kind,id,to){ const rec=(kind==='deal'?S.deals:S.orgs)[id]; if(!rec) return; if(readOnly){ toast('Du har lesetilgang og kan ikke endre ansvar.'); return; }
  UI.asg={kind,id,to:to===undefined?'__':(to||''),expect:rec.ownerId||null,note:'',tasks:{},state:'form',res:null,ret:document.activeElement}; renderAssign(true); }
function closeAssign(){ const X=UI.asg; if(!X||X.state==='busy') return; UI.asg=null; $('#modal-root').innerHTML=''; try{ if(X.ret&&document.contains(X.ret)) X.ret.focus(); }catch(e){} render(); }
async function takeIt(kind,id){ const a=actor(), rec=(kind==='deal'?S.deals:S.orgs)[id]; if(!rec) return; if(!a){ toast('Velg profil øverst til høyre først.'); return; }
  if(rec.ownerId||asgTasks({kind,id}).length){ openAssign(kind,id,a.id); return; }
  UI.asg={kind,id,to:a.id,expect:null,note:'',tasks:{},state:'busy',res:null,ret:document.activeElement,quick:true}; await runAssign(); }
async function runAssign(){ const X=UI.asg; if(!X) return; X.state='busy'; renderAssign(true);
  const taskIds=Object.keys(X.tasks).filter(k=>X.tasks[k]), tx={}; for(const t of asgTasks(X)) tx[t.id]=t.ownerId||null;
  let r; try{ r=await doAssign({kind:X.kind,id:X.id,to:X.to,expect:X.expect,note:X.note,taskIds,taskExpect:tx}); }catch(e){ r={error:'Noe gikk galt: '+(e&&e.message||e)+'. Kontroller hvem som står som ansvarlig før du prøver igjen.'}; }
  if(UI.asg!==X) return; X.res=r; X.state=r.ok?'done':r.conflict?'conflict':r.busy?'locked':'error';
  if(r.ok&&X.quick&&r.saved!==false&&!(r.notice&&!r.notice.saved)){ UI.asg=null; $('#modal-root').innerHTML=''; toast(X.kind==='deal'?'Du står nå som saksansvarlig.':'Du står nå som kundeansvarlig.'); render(); return; }
  const D=UI.drawer; if(r.ok&&D&&D.id===X.id&&D.draft) D.draft.ownerId=X.to||null;
  renderAssign(true); render(); }
function renderAssign(focus){
  const X=UI.asg, root=$('#modal-root'); if(!X){ root.innerHTML=''; return; } const rec=asgRec(X); if(!rec){ UI.asg=null; root.innerHTML=''; return; }
  const deal=X.kind==='deal', title=deal?'«'+rec.title+'»':rec.name, role=deal?'saksansvarlig':'kundeansvarlig', toName=X.to==='__'?'':(X.to?ownName(X.to):'Ufordelt'), T=asgTasks(X), a=actor(), transfer=!!X.expect;
  let body='';
  if(X.state==='form'||X.state==='busy'){ const same=X.to!=='__'&&ownKey(X.to)===ownKey(X.expect);
    body='<div class="asg-who"><div><span class="lbl">'+(deal?'Saksansvarlig':'Kundeansvarlig')+' nå</span>'+ownChip(X.expect,rec.ownerName)+'</div><span class="asg-arrow" aria-hidden="true">→</span><label class="f"><span class="lbl">Ny '+role+'</span><select class="in" id="asgTo"'+(X.state==='busy'?' disabled':'')+'>'+ownOpts(X.to,'Velg')+'</select></label></div>'+
     (same?'<p class="note">Dette er den som allerede står som '+role+'.</p>':'')+
     (transfer||T.length?'<label class="f full"><span>Overleveringsbeskjed (valgfritt)</span><textarea class="in" id="asgNote" rows="2" maxlength="500" placeholder="Kort beskjed til den som tar over"'+(X.state==='busy'?' disabled':'')+'>'+esc(X.note)+'</textarea></label>':'')+
     (T.length?'<fieldset class="asg-tasks"><legend>Åpne oppgaver '+(deal?'på saken':'på kunden, uten sak')+' ('+T.length+')</legend><p class="note">Kryss av dem som skal følge med til '+(toName?esc(toName):'ny ansvarlig')+'. Oppgaver du ikke krysser av, beholder ansvarlig. Avsluttede aktiviteter endres ikke.</p>'+T.map(t=>'<label class="check asg-t"><input type="checkbox" data-asgt="'+esc(t.id)+'"'+(X.tasks[t.id]?' checked':'')+(X.state==='busy'?' disabled':'')+'><span><b>'+esc(t.text)+'</b><span class="meta">Ansvarlig nå: '+esc(ownName(t.ownerId,t.ownerName))+' · '+(t.due?'frist '+esc(fd(t.due,{day:'numeric',month:'short'})):'ingen frist')+'</span></span></label>').join('')+'</fieldset>':'')+
     '<ul class="asg-facts"><li>Tildeling endrer ikke hvem som har tilgang. Alle som kan åpne Salong, ser '+(deal?'saken':'kunden')+' som før.</li><li>'+(X.to&&X.to!=='__'&&(!a||a.id!==X.to)?esc(toName)+' får et varsel inne i Salong. ':'')+'Salong sender ikke e-post eller push.</li>'+(a&&!a.verified?'<li>Endringen logges med den innloggede kontoen din'+(me.name?' ('+esc(me.name)+')':'')+' og profilen «'+esc(a.name)+'», som er valgt i nettleseren.</li>':!a?'<li>Du har ikke valgt profil. Endringen logges bare med den innloggede kontoen'+(me.name?' ('+esc(me.name)+')':'')+'.</li>':'')+'</ul>'+
     '<div class="row asg-btn"><button class="btn primary" type="button" id="asgGo"'+(X.state==='busy'||X.to==='__'||same?' disabled':'')+'>'+(X.state==='busy'?'Lagrer …':X.to===''?'Sett som ufordelt':'Tildel'+(toName?' til '+esc(toName):''))+'</button><button class="btn ghost" type="button" id="asgNo"'+(X.state==='busy'?' disabled':'')+'>Avbryt</button></div>'; }
  else if(X.state==='conflict'){ const c=X.res.current;
    body='<div class="notice warn" role="alert"><b>'+(deal?'Saken':'Kunden')+' fikk ny ansvarlig mens du holdt på. Ingenting er overskrevet.</b><p>'+(deal?'Saksansvarlig':'Kundeansvarlig')+' er nå <b>'+esc(ownName(c.ownerId,c.ownerName))+'</b>'+(c.updatedByName?', sist endret av '+esc(c.updatedByName):'')+(c.updatedAt?' '+esc(fd(c.updatedAt,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})):'')+'. Da du åpnet dette, sto '+esc(ownName(X.expect))+'.</p></div>'+
     '<div class="row asg-btn">'+(ownKey(c.ownerId)===ownKey(X.to)?'':'<button class="btn" type="button" id="asgForce">Tildel til '+esc(toName)+' likevel</button>')+'<button class="btn primary" type="button" id="asgNo">La det stå som det er</button></div>'; }
  else if(X.state==='locked') body='<div class="notice warn" role="alert"><b>En annen endrer ansvaret for '+(deal?'denne saken':'denne kunden')+' akkurat nå. Ingenting er endret.</b><p>Vent noen sekunder og prøv igjen. Da ser du hvem som står som ansvarlig.</p></div><div class="row asg-btn"><button class="btn primary" type="button" id="asgRetry">Prøv igjen</button><button class="btn ghost" type="button" id="asgNo">Avbryt</button></div>';
  else if(X.state==='error') body='<div class="notice err" role="alert"><b>Ansvaret ble ikke endret.</b><p>'+esc(X.res.error||'Ukjent feil.')+'</p></div><div class="row asg-btn"><button class="btn primary" type="button" id="asgRetry">Prøv igjen</button><button class="btn ghost" type="button" id="asgNo">Lukk</button></div>';
  else { const r=X.res, sk=r.skipped||[];
    body='<div class="notice '+(r.saved===false&&!r.demo?'warn':'ok')+'" role="status"><b>'+(r.to?esc(ownName(r.to))+' står nå som '+role+'.':(deal?'Saken':'Kunden')+' står nå som ufordelt.')+'</b><p>'+(r.demo?'Demo: endringen er ikke lagret permanent.':r.saved?'Endringen er bekreftet lagret.':'Endringen er ikke bekreftet lagret ennå. Se lagrestatus nederst til venstre.')+'</p></div>'+
     '<ul class="asg-facts">'+(r.from||r.to?'<li>Før: '+esc(ownName(r.from))+'. Etter: '+esc(ownName(r.to))+'.</li>':'')+
      '<li>'+(r.moved.length?r.moved.length+' '+(r.moved.length===1?'oppgave':'oppgaver')+' fulgte med.':'Ingen oppgaver ble flyttet.')+'</li>'+
      sk.map(s=>'<li class="st-warn">Ikke flyttet: «'+esc(s.text||'oppgave')+'» '+esc(s.why)+'.</li>').join('')+
      (r.notice?'<li>'+(r.notice.saved?'Varselet til '+esc(ownName(r.to))+' er lagret i Salong. Det vises når Salong åpnes med den profilen. Ingen e-post eller push er sendt.':'<span class="st-warn">Varselet til '+esc(ownName(r.to))+' er ikke bekreftet lagret. Si fra selv.</span>')+'</li>':(r.to&&!r.demo?'<li>Ingen varsel: du tildelte til deg selv.</li>':''))+'</ul>'+
     '<div class="row asg-btn"><button class="btn primary" type="button" id="asgNo">Lukk</button></div>'; }
  root.innerHTML='<div class="scrim modal-scrim" data-asgclose="1"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="asgH"><header><div><span class="lbl">'+(deal?'Tildel sak':'Tildel kunde')+'</span><h2 id="asgH" tabindex="-1">'+esc(title)+'</h2></div><button class="x" type="button" id="asgX" aria-label="Lukk"'+(X.state==='busy'?' disabled':'')+'>×</button></header><div class="modal-b">'+body+'</div></div>';
  root.querySelector('[data-asgclose]').addEventListener('click',closeAssign); $('#asgX').addEventListener('click',closeAssign); $('#asgNo')?.addEventListener('click',closeAssign);
  $('#asgTo')?.addEventListener('change',e=>{ X.to=e.target.value; renderAssign(); $('#asgTo')?.focus(); });
  $('#asgNote')?.addEventListener('input',e=>{ X.note=e.target.value; });
  root.querySelectorAll('[data-asgt]').forEach(c=>c.addEventListener('change',()=>{ X.tasks[c.dataset.asgt]=c.checked; }));
  $('#asgGo')?.addEventListener('click',runAssign);
  $('#asgRetry')?.addEventListener('click',()=>{ const cur=asgRec(X); X.state='form'; X.res=null; if(cur&&ownKey(cur.ownerId)!==ownKey(X.expect)){ X.res={current:cur}; X.state='conflict'; } renderAssign(true); });
  $('#asgForce')?.addEventListener('click',()=>{ X.expect=X.res.current.ownerId||null; X.res=null; runAssign(); });
  if(focus){ const el=X.state==='form'?$('#asgTo'):$('#asgH'); el&&el.focus(); }
}
document.addEventListener('keydown',e=>{ if(!UI.asg) return; if(e.key==='Escape'){ e.stopImmediatePropagation(); e.preventDefault(); closeAssign(); return; }
  if(e.key==='Tab'){ const f=[...document.querySelectorAll('#modal-root button:not([disabled]),#modal-root select:not([disabled]),#modal-root textarea:not([disabled]),#modal-root input:not([disabled])')]; if(!f.length) return; const i=f.indexOf(document.activeElement); if(e.shiftKey&&i<=0){ e.preventDefault(); f[f.length-1].focus(); } else if(!e.shiftKey&&(i===f.length-1||i<0)){ e.preventDefault(); f[0].focus(); } } },true);
/* knapper hvor som helst i appen */
function assignBtns(kind,id){ const rec=(kind==='deal'?S.deals:S.orgs)[id]; if(!rec||readOnly) return ''; const a=actor(), mine=!!a&&ownKey(rec.ownerId)===a.id;
  return '<button class="btn sm" type="button" data-assign="'+kind+':'+esc(id)+'">Tildel</button>'+(mine?'':'<button class="btn sm" type="button" data-take="'+kind+':'+esc(id)+'">'+(kind==='deal'?'Ta saken':'Ta kunden')+'</button>'); }
function ownRow(kind,id){ const rec=(kind==='deal'?S.deals:S.orgs)[id]; if(!rec) return ''; return '<div class="own-row"><span class="lbl">'+(kind==='deal'?'Saksansvarlig':'Kundeansvarlig')+'</span>'+ownChip(rec.ownerId,rec.ownerName)+assignBtns(kind,id)+'</div>'; }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-assign],[data-take]'); if(!b) return; e.stopPropagation(); e.preventDefault(); const [k,id]=(b.dataset.assign||b.dataset.take).split(':'); if(b.dataset.assign) openAssign(k,id); else takeIt(k,id); },true);
/* én oppgave: velg ansvarlig direkte i listen */
async function assignTask(id,to,expect){ const r=await doAssign({kind:'task',id,to:to||null,expect:expect||null});
  toast(r.ok?(r.saved||r.demo?'Oppgaveansvarlig er endret til '+ownName(to||null)+'.':'Endringen er ikke bekreftet lagret ennå.')+(r.notice&&r.notice.saved?' Varsel lagret i Salong.':''):r.conflict?'Oppgaven fikk ny ansvarlig mens du holdt på ('+ownName(r.current.ownerId)+'). Ingenting er overskrevet.':r.busy?'En annen endrer oppgaven akkurat nå. Prøv igjen om litt.':r.skipped?'Oppgaven er allerede avsluttet. Ingenting er endret.':(r.error||'Oppgaven ble ikke endret.')); if(UI.drawer) renderDrawer(true); renderView(true); return r; }
function taskOwnSel(a){ return readOnly?'':'<select class="in fsel" data-cown="'+esc(a.id)+'" data-cownx="'+esc(a.ownerId||'')+'" aria-label="Oppgaveansvarlig for «'+esc(a.text)+'»">'+ownOpts(a.ownerId||'')+'</select>'; }
document.addEventListener('change',e=>{ const s=e.target.closest&&e.target.closest('[data-cown]'); if(!s) return; assignTask(s.dataset.cown,s.value,s.dataset.cownx||null); });

/* ---------- varsler inne i Salong ---------- */
/* flere kunder på én gang: hver endring går gjennom samme vern, og mottakeren får ett samlet varsel */
async function bulkAssignOrgs(ids,to){ const R={ok:[],fail:[]}, act=actor();
  for(const id of ids){ if(!S.orgs[id]&&PROFILES[id]) await ensureOrg(PROFILES[id]); const o=S.orgs[id]; if(!o){ R.fail.push({id,why:'finnes ikke'}); continue; } if(ownKey(o.ownerId)===ownKey(to)){ continue; }
    const r=await doAssign({kind:'org',id,to:to||null,expect:o.ownerId||null,quiet:true}); if(r.ok) R.ok.push(id); else R.fail.push({id,name:o.name,why:r.conflict?'fikk ny ansvarlig i mellomtiden':r.busy?'endres av en annen akkurat nå':(r.error||'ukjent feil')}); }
  if(to&&R.ok.length&&(!act||act.id!==to)){ const ok=await put('notices',uid('n'),{to,kind:'bulk',entityId:R.ok[0],orgIds:R.ok.slice(0,60),count:R.ok.length,from:act?act.id:null,fromVerified:!!(act&&act.verified),byId:me.id||null,byName:me.name||'',note:'',tasks:0,at:iso(new Date()),readAt:null},{noAudit:true}); R.notice=ok===true; }
  return R; }
function myNotices(){ const a=actor(); if(!a) return []; return Object.entries(S.notices||{}).map(([id,n])=>({id,...n})).filter(n=>n.to===a.id&&!n.readAt&&!n.deletedAt).sort((x,y)=>(y.at||'').localeCompare(x.at||'')); }
function noticesHTML(){ const a=actor(), L=myNotices(); if(!a||!L.length) return '';
  return '<section class="panel notp" id="notP" aria-labelledby="notH"><header><h2 id="notH">Varsler til '+esc(a.name)+' <span class="cnt3">'+L.length+'</span></h2><span class="sub">Lagret i Salong. Ingen e-post eller push.'+(a.verified?'':' Vises fordi profilen «'+esc(a.name)+'» er valgt i denne nettleseren.')+'</span></header><ul class="notl">'+L.map(n=>{ const what=n.kind==='bulk'?n.count+' kunder: '+(n.orgIds||[]).slice(0,4).map(orgName).join(', ')+((n.count||0)>4?' og '+(n.count-4)+' til':''):n.kind==='deal'?'saken «'+(S.deals[n.entityId]?.title||'slettet sak')+'»':n.kind==='org'?'kunden '+orgName(n.entityId):'oppgaven «'+(S.acts[n.entityId]?.text||'slettet oppgave')+'»', who=n.from?ownName(n.from):(n.byName||'En kollega');
    return '<li><div><b>Du står som '+(n.kind==='deal'?'saksansvarlig for ':n.kind==='org'||n.kind==='bulk'?'kundeansvarlig for ':'ansvarlig for ')+esc(what)+'</b><span class="meta">Tildelt av '+esc(who)+(n.from&&!n.fromVerified?' (selvvalgt profil'+(n.byName?', konto '+esc(n.byName):'')+')':'')+' · '+esc(fd(n.at,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+(n.prevOwner?' · tidligere '+esc(ownName(n.prevOwner)):'')+(n.tasks?' · '+n.tasks+' '+(n.tasks===1?'oppgave':'oppgaver')+' fulgte med':'')+'</span>'+(n.note?'<q>'+esc(n.note)+'</q>':'')+'</div><div class="row">'+(n.kind==='bulk'?'<button class="btn sm" type="button" data-ngo="kontakter">Vis mine kunder</button>':n.kind==='org'?'<button class="btn sm" type="button" data-open="org:'+esc(n.entityId)+'">Åpne kunden</button>':(n.dealId||n.kind==='deal')&&S.deals[n.dealId||n.entityId]?'<button class="btn sm" type="button" data-open="deal:'+esc(n.dealId||n.entityId)+'">Åpne saken</button>':n.orgId?'<button class="btn sm" type="button" data-open="org:'+esc(n.orgId)+'">Åpne kunden</button>':'')+'<button class="btn ghost sm" type="button" data-nread="'+esc(n.id)+'">Marker som lest</button></div></li>'; }).join('')+'</ul></section>'; }
document.addEventListener('click',e=>{ const g=e.target.closest('[data-ngo]'); if(g){ UI.own='mine'; UI.ku.st='alle'; go(g.dataset.ngo); return; } const b=e.target.closest('[data-nread]'); if(!b) return; const n=S.notices[b.dataset.nread]; if(n) put('notices',b.dataset.nread,{...n,readAt:iso(new Date()),readById:me.id||null},{noAudit:true}); });
{ const _h=V.idag.html, _w=V.idag.wire; V.idag.html=function(){ return noticesHTML()+_h.call(this); }; V.idag.wire=function(v){ _w&&_w.call(this,v); wireOwnFilter(v,()=>renderView(true)); }; }

/* ---------- topplinje: hvem du jobber som ---------- */
function renderTeamBar(){ const el=$('#team'); if(!el||el.contains(document.activeElement)) return; const a=actor(), n=myNotices().length, L=members();
  /* Prototype-indikator: én liten linje. Forklaringen av hva profilvalget ikke er, ligger i Data og oppsett. */
  el.innerHTML=(a&&a.verified?'<span class="tb-test" title="Teammedlemmet er koblet til den innloggede kontoen din">'+esc(a.name)+'</span>':
    '<label class="tb-test" title="Prototype: profilen er valgt i nettleseren og er ikke innlogging. Se Data og oppsett, Team og ansvar."><span>Testprofil:</span><select class="in fsel" id="actAs" aria-label="Testprofil"><option value="">ingen</option>'+L.map(m=>'<option value="'+esc(m.id)+'"'+(a&&a.id===m.id?' selected':'')+(m.accountId&&m.accountId!==me.id?' disabled':'')+'>'+esc(m.name)+'</option>').join('')+'</select></label>')+
   (n?'<button type="button" class="tb-n" id="tbN">Varsler <b>'+n+'</b></button>':'');
  $('#actAs')?.addEventListener('change',e=>{ PROFILE=e.target.value; if(PROFILE) storeLocal('set','profile',PROFILE); else storeLocal('remove','profile'); if(UI.own==='mine'&&!actor()) UI.own='alle'; e.target.blur(); render(); renderTeamBar(); });
  $('#tbN')?.addEventListener('click',()=>{ go('idag'); setTimeout(()=>{ const p=$('#notP'); if(p){ p.scrollIntoView({block:'start'}); p.querySelector('h2')?.setAttribute('tabindex','-1'); p.querySelector('h2')?.focus(); } },40); });
}

/* ---------- Data og oppsett: Team og ansvar ---------- */
UI.tm={names:{},add:''};
function teamHTML(){
  const L=members(true), mineLink=me.id?L.find(m=>m.accountId===me.id):null, a=actor();
  return '<h2>Team og ansvar</h2><p class="note">Hvem som kan stå som kundeansvarlig, saksansvarlig og oppgaveansvarlig. Hver person har en fast ID. Navnet kan endres uten at historikken endres, fordi saker, oppgaver og logg viser til ID-en.</p>'+
   '<div class="tbl"><table class="dense teamt"><thead><tr><th>Visningsnavn</th><th>Fast ID</th><th>Innlogget konto</th><th>Ansvar nå</th><th></th></tr></thead><tbody>'+L.map(m=>{ const nD=deals().filter(d=>OPEN.includes(d.stage)&&ownKey(d.ownerId)===m.id).length, nO=orgs().filter(o=>ownKey(o.ownerId)===m.id).length, nT=openTasks().filter(t=>ownKey(t.ownerId)===m.id).length, val=UI.tm.names[m.id]!==undefined?UI.tm.names[m.id]:m.name;
     return '<tr'+(m.active===false?' class="off"':'')+'><td><div class="row"><input class="in" data-tmname="'+esc(m.id)+'" value="'+esc(val)+'" maxlength="40" aria-label="Visningsnavn for '+esc(m.name)+'"><button class="btn sm" type="button" data-tmsave="'+esc(m.id)+'">Lagre navn</button></div>'+(m.active===false?'<span class="s">Ikke aktiv. Kan ikke få nye tildelinger.</span>':'')+'</td><td><code>'+esc(m.id)+'</code></td>'+
      '<td>'+(m.accountId?'<span class="ist ok">Koblet</span> <span data-uname="'+esc(m.accountId)+'">'+esc(people[m.accountId]?.name||(m.accountId===me.id?me.name:'')||'konto uten synlig navn')+'</span>'+(m.accountId===me.id?' <button class="btn ghost sm" type="button" data-tmunlink="'+esc(m.id)+'">Fjern koblingen min</button>':''):'<span class="ist off">Ikke koblet</span>'+(me.id&&!mineLink&&m.active!==false?' <button class="btn sm" type="button" data-tmlink="'+esc(m.id)+'">Koble til kontoen min</button>':''))+'</td>'+
      '<td class="s2">'+nO+' kunder · '+nD+' åpne saker · '+nT+' åpne oppgaver</td><td>'+(m.active===false?'<button class="btn ghost sm" type="button" data-tmact="'+esc(m.id)+'|1">Aktiver</button>':'<button class="btn ghost sm" type="button" data-tmact="'+esc(m.id)+'|0">Deaktiver</button>')+'</td></tr>'; }).join('')+'</tbody></table></div>'+
   '<div class="row"><label class="sr" for="tmAdd">Navn på ny person</label><input class="in" id="tmAdd" style="max-width:260px" maxlength="40" placeholder="Navn på ny person" value="'+esc(UI.tm.add)+'"><button class="btn" type="button" id="tmAddGo">Legg til person</button></div>'+
   '<h3 class="sub3">Hvem du er i Salong akkurat nå</h3><div class="kv"><span>Innlogget konto</span><b>'+(me.id?esc(me.name||'Konto uten navn')+' <span class="meta">(fra innloggingen hos Claude)</span>':'Ingen. Demo uten innlogging')+'</b><span>Jobber som</span><b>'+(a?esc(a.name)+' <span class="meta">('+(a.verified?'koblet til kontoen din':'valgt i denne nettleseren, ikke innlogging')+')</span>':'Ingen profil valgt')+'</b></div>'+
   '<h3 class="sub3">Hva dette er, og hva det ikke er</h3><ul class="om-list"><li><b>Profilvalg er ikke innlogging.</b> «Testprofil» øverst til høyre er et valg i nettleseren. Det gir ingen rettigheter og beviser ikke hvem du er.</li><li><b>Kobling til konto gjør brukeren selv.</b> Salong har ingen administrator eller roller som godkjenner den. Koblingen sier bare at denne kontoen har valgt å stå som dette teammedlemmet.</li><li><b>Loggen bruker den innloggede kontoen.</b> Endringer i ansvar logges med konto, tidspunkt og verdien før og etter. Profilen står ved siden av, merket som selvvalgt når den er det.</li><li><b>Tildeling er ikke tilgang.</b> Alle som kan åpne Salong, ser og kan endre alle kunder og saker, uansett hvem som står som ansvarlig.</li><li><b>Varsler finnes bare inne i Salong.</b> Det sendes ikke e-post eller push.</li><li><b>I produksjon</b> må «Mine», roller og logg bygge på autentisert bruker-ID fra innlogging, og håndheves på serveren.</li></ul>';
}
function wireTeam(v){
  v.querySelectorAll('[data-tmname]').forEach(i=>i.addEventListener('input',()=>{ UI.tm.names[i.dataset.tmname]=i.value; }));
  const save=async(id,patch,action)=>{ const m=member(id)||{name:'',active:true,accountId:null,order:50}, prev=S.members[id]||null, doc={name:m.name,active:m.active!==false,accountId:m.accountId||null,order:m.order||50,...patch}; const ok=await put('members',id,doc,{noAudit:true}); audit('members',id,prev||{name:TEAM_DEFAULT[id]?.name||'',active:true,accountId:null},S.members[id],action); return ok; };
  v.querySelectorAll('[data-tmsave]').forEach(b=>b.addEventListener('click',async()=>{ const id=b.dataset.tmsave, name=String(UI.tm.names[id]??member(id).name).trim(); if(!name){ toast('Navnet kan ikke være tomt.'); return; } if(members(true).some(m=>m.id!==id&&m.name.toLowerCase()===name.toLowerCase())){ toast('Det finnes allerede en person med det navnet.'); return; } delete UI.tm.names[id]; const ok=await save(id,{name},'endret visningsnavn'); toast(ok===true||!db?'Navnet er endret. Historikken er uendret.':'Navnet er ikke bekreftet lagret ennå.'); renderView(true); }));
  v.querySelectorAll('[data-tmlink]').forEach(b=>b.addEventListener('click',async()=>{ if(!me.id) return; if(members(true).some(m=>m.accountId===me.id)){ toast('Kontoen din er allerede koblet til en person.'); return; } await save(b.dataset.tmlink,{accountId:me.id},'koblet teammedlem til egen konto'); toast('Koblet til kontoen din.'); renderView(true); }));
  v.querySelectorAll('[data-tmunlink]').forEach(b=>b.addEventListener('click',async()=>{ const m=member(b.dataset.tmunlink); if(!m||m.accountId!==me.id) return; await save(m.id,{accountId:null},'fjernet kobling til egen konto'); toast('Koblingen er fjernet.'); renderView(true); }));
  v.querySelectorAll('[data-tmact]').forEach(b=>b.addEventListener('click',async()=>{ const [id,on]=b.dataset.tmact.split('|'); await save(id,{active:on==='1'},on==='1'?'aktiverte teammedlem':'deaktiverte teammedlem'); renderView(true); }));
  $('#tmAdd')?.addEventListener('input',e=>{ UI.tm.add=e.target.value; });
  $('#tmAddGo')?.addEventListener('click',async()=>{ const name=UI.tm.add.trim(); if(!name){ toast('Skriv et navn.'); return; } if(members(true).some(m=>m.name.toLowerCase()===name.toLowerCase())){ toast('Det finnes allerede en person med det navnet.'); return; } UI.tm.add=''; await save(uid('m'),{name,active:true,accountId:null,order:50},'la til teammedlem'); renderView(true); });
}

/* endringslogg: verdier og hvem */
function audVal(f,raw){ const v=String(raw??'').replace(/^"|"$/g,''); if(f==='ownerId') return v&&v!=='null'?ownName(v):'Ufordelt'; if(f==='accountId') return v&&v!=='null'?'Koblet til en konto':'Ikke koblet'; if(f==='active') return v==='true'?'Aktiv':'Ikke aktiv'; return v&&v!=='null'?v:'Tom'; }
function audWho(a){ if(!a.asMember) return ''; return ' <span class="meta">som '+esc(ownName(a.asMember))+(a.asVerified?' (koblet til kontoen)':' (selvvalgt profil)')+'</span>'; }
function teamLogHTML(){ const L=Object.values(S.audit||{}).filter(a=>a.col==='members').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,12);
  return '<h3 class="sub3">Endringer i teamet</h3>'+(L.length?'<ol class="audit">'+L.map(a=>'<li><div><b>'+esc(a.byName||'Ukjent konto')+'</b>'+audWho(a)+' '+esc(a.action)+': '+esc(ownName(a.entityId))+'<span class="meta"> · '+esc(fd(a.at,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</span></div>'+(a.changes&&a.changes.length?'<table class="dense"><tbody>'+a.changes.map(c=>'<tr><td>'+esc(({name:'Visningsnavn',accountId:'Konto',active:'Status',order:'Rekkefølge'})[c.f]||c.f)+'</td><td class="old">'+esc(audVal(c.f,c.old))+'</td><td>→</td><td>'+esc(audVal(c.f,c.new))+'</td></tr>').join('')+'</tbody></table>':'')+'</li>').join('')+'</ol>':'<p class="empty">Ingen endringer registrert.</p>'); }
{ const _t=teamHTML; teamHTML=function(){ return _t()+teamLogHTML(); }; }
/* Om Salong */
{ const _om3=V.om.html; V.om.html=function(){ const row=(t,n,d)=>'<tr><td><span class="tag '+t+'">'+({real:'Laget',local:'Kun i nettleser',todo:'Krever backend'})[t]+'</span></td><td class="name">'+n+'</td><td class="s2">'+d+'</td></tr>';
  return _om3.call(this)+'<section class="panel"><header><h2>Ansvar og tildeling</h2><span class="sub">Hva som er laget, og hva som krever innlogging med roller</span></header><table class="dense arch"><tbody>'+
   row('real','Tre typer ansvar','Kundeansvarlig, saksansvarlig og oppgaveansvarlig holdes adskilt og viser til faste ID-er. «Ufordelt» er en egen tilstand.')+
   row('real','Overføring med valg','Ved bytte av ansvarlig vises gammel og ny, du kan legge ved en beskjed, og du velger selv hvilke åpne oppgaver som følger med. Avsluttede aktiviteter endres aldri.')+
   row('real','Vern mot samtidige endringer','Kort lås per sak og fersk lesing før skriving. Har en annen endret ansvarlig i mellomtiden, skrives ingenting før du har sett det.')+
   row('real','Varsler i Salong','Lagres som egne oppføringer og vises for mottakeren når Salong åpnes med den profilen. Ingen e-post eller push.')+
   row('local','Hvem du jobber som','Valgt i nettleseren, eller koblet til den innloggede kontoen av brukeren selv. Ingen roller, ingen administrator.')+
   row('todo','Roller og tilgang','Tildeling endrer ikke tilgang. Roller, og at «Mine» og loggen bygger på verifisert identitet, må håndheves på en server.')+'</tbody></table></section>'; }; }
