/* ---------- Prospekter: dialoger, import og eksport ---------- */
async function mtSave(filename,text){
  if(dl){ try{ await dl.save({filename,data:text}); toast('Filen er lagret'); return true; }catch(e){ if(e&&e.code==='declined') return false; toast('Nedlastingen ble ikke fullført. Bruk Kopier.'); return false; } }
  toast('Nedlasting er ikke tilgjengelig her. Bruk Kopier.'); return false; }
function mtReadFile(input,cb){ const f=input.files&&input.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>cb(String(r.result),f.name); r.readAsText(f); }
function mtModalOpen(k,o){ UI.mt.modal={k,...(o||{})}; const m=UI.mt.modal;
  if(k==='batch'){ m.seg=m.seg||'p0'; m.n=m.n||25; m.owner=m.owner||''; m.off=new Set(); m.name=''; }
  if(k==='seg'){ const c=mtCfg(); m.d=JSON.parse(JSON.stringify({segs:c.segs,waves:c.waves,target:c.target,goalPct:c.goalPct,rules:c.rules})); }
  if(k==='tpl'){ const c=mtCfg(), key=m.key; const base=key==='react'?MT_SEQ_REACT:(()=>{ const s=mtSegOf(c,key); return mtCadence({kind:'ny',segId:key,seg:s},{...c,seq:{}}).steps; })(); m.steps=JSON.parse(JSON.stringify(c.seq[key]&&c.seq[key].length?c.seq[key]:base)); }
  if(k==='add'){ m.f={name:'',website:'',orgnr:'',segId:'forlag',place:'',size:'',why:''}; }
  if(k==='cog'||k==='apo'||k==='scout'){ m.rows=null; m.map=null; m.file=''; m.paste=''; m.create=false; }
  if(k==='enr'){ m.sel=null; }
  if(k==='snap'){ m.note=''; }
  UI.mt.ret=document.activeElement; mtOverlay(true); }
function mtModalClose(){ UI.mt.modal=null; mtOverlay(true); if(!UI.mt.acc){ try{ if(UI.mt.ret&&document.contains(UI.mt.ret)) UI.mt.ret.focus(); }catch(e){} } }
function mtShell(title,body,foot,wide){ return '<div class="scrim mt-s2" data-mtx="1"></div><div class="mt-md'+(wide?' wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><h2>'+esc(title)+'</h2><button class="x" type="button" aria-label="Lukk" data-mtx="1">×</button></header><div class="mt-mb">'+body+'</div>'+(foot?'<footer>'+foot+'</footer>':'')+'</div>'; }
const mtFld=(lab,inner,full)=>'<label class="f'+(full?' full':'')+'"><span>'+lab+'</span>'+inner+'</label>';
function mtModalHTML(){
  const m=UI.mt.modal, k=m.k;
  return ({batch:mtMBatch,add:mtMAdd,cog:mtMCog,apo:mtMApo,scout:mtMScout,enr:mtMEnr,exp:mtMExp,seg:mtMSeg,snap:mtMSnap,tpl:mtMTpl,defs:mtMDefs})[k](m);
}

/* ---------- Start neste batch ---------- */
function mtBatchSegIds(m){ const c=mtCfg(); if(m.seg==='all') return []; if(/^p[012]$/.test(m.seg)) return c.segs.filter(s=>s.on&&s.prio===m.seg.toUpperCase()).map(s=>s.id); if(m.seg.startsWith('wave:')){ const w=c.waves.find(x=>x.id===m.seg.slice(5)); return w?w.segs:[]; } return [m.seg]; }
function mtMBatch(m){
  const c=mtCfg(), ids=mtBatchSegIds(m), P=mtPick({segIds:ids,n:m.n}), chosen=P.rows.filter(a=>!m.off.has(a.id));
  const segLabel=m.seg==='all'?'alle segmenter':/^p[012]$/.test(m.seg)?'alle '+m.seg.toUpperCase():m.seg.startsWith('wave:')?(c.waves.find(w=>w.id===m.seg.slice(5))||{}).name:mtSegShort(mtSegName(m.seg));
  const auto='Batch '+(mtBuild().batches.length+1)+' · '+segLabel+' · '+chosen.length;
  const body='<div class="mt-bf">'+mtFld('Segment','<select class="in" data-mtb="seg"><optgroup label="Grupper"><option value="p0"'+(m.seg==='p0'?' selected':'')+'>Alle P0</option><option value="p1"'+(m.seg==='p1'?' selected':'')+'>Alle P1</option><option value="p2"'+(m.seg==='p2'?' selected':'')+'>Alle P2</option><option value="all"'+(m.seg==='all'?' selected':'')+'>Alle segmenter</option></optgroup><optgroup label="Bølger">'+c.waves.map(w=>'<option value="wave:'+esc(w.id)+'"'+(m.seg==='wave:'+w.id?' selected':'')+'>'+esc(w.name)+': '+w.segs.map(id=>esc(mtSegShort(mtSegName(id)))).join(' + ')+'</option>').join('')+'</optgroup><optgroup label="Segmenter">'+c.segs.filter(s=>s.on).map(s=>'<option value="'+esc(s.id)+'"'+(m.seg===s.id?' selected':'')+'>'+esc(mtSegShort(s.name))+' ('+s.prio+')</option>').join('')+'</optgroup></select>')+
   mtFld('Antall','<select class="in" data-mtb="n">'+[...new Set([5,10,15,20,25,30,40,50,m.n])].sort((x,y)=>x-y).map(n=>'<option value="'+n+'"'+(m.n===n?' selected':'')+'>'+n+'</option>').join('')+'</select>')+
   mtFld('Ansvarlig','<select class="in" data-mtb="owner">'+ownOpts(m.owner)+'</select>')+'</div>'+
   '<details class="mt-dt"><summary>Hvordan velges accounts?</summary><p class="mt-hint">Kvalifisert, ikke adressert og ikke i en annen aktiv batch. Sortert på fit, høyest først. Ingen enrolles automatisk.</p></details>'+
   (P.available<P.requested?'<p class="mt-note warn">'+(P.available?'Bare '+P.available+' av '+P.requested+' ønskede accounts er tilgjengelige i dette utvalget.':'Ingen accounts er tilgjengelige i dette utvalget.')+'</p>':'')+
   (P.rows.length?'<div class="mt-bl"><label class="mt-bla"><input type="checkbox" data-mtball aria-label="Velg alle" '+(chosen.length===P.rows.length?'checked':'')+'> <span>Velg alle</span></label>'+P.rows.map(a=>'<label class="mt-blr"><input type="checkbox" data-mtbo="'+esc(a.id)+'" '+(m.off.has(a.id)?'':'checked')+' aria-label="Ta med '+esc(a.name)+'"><span class="mt-blo">'+esc(a.name)+'</span><span class="mt-blm">'+esc(mtSegLabel(a))+' · Fit '+a.fit.total+' · '+(a.active.length?'Kontakt klar':'Trenger kontakt')+'</span></label>').join('')+'</div>':'<div class="mt-empty"><p>Ingen kvalifiserte accounts uten adressering ledig her. Legg til accounts via Market Scout (importkø) eller kvalifiser flere.</p></div>')+
   (P.rows.length?mtFld('Navn på batchen','<input class="in" data-mtb="name" value="'+esc(m.name)+'" placeholder="'+esc(auto)+'">',true):'');
  return mtShell('Start neste batch',body,'<span class="mt-bcount">'+chosen.length+' accounts valgt</span><button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mtbgo="1"'+(chosen.length?'':' disabled')+'>Start batch</button>');
}
function mtWBatch(root,m){
  root.querySelectorAll('[data-mtb]').forEach(i=>i.addEventListener('change',()=>{ const k=i.dataset.mtb; if(k==='n') m.n=Math.max(1,Math.min(200,Number(i.value)||25)); else if(k==='name'){ m.name=i.value; return; } else m[k]=i.value; if(k==='seg'||k==='n') m.off=new Set(); mtOverlay(true); }));
  root.querySelectorAll('[data-mtbn]').forEach(b=>b.addEventListener('click',()=>{ m.n=Number(b.dataset.mtbn); m.off=new Set(); mtOverlay(true); }));
  root.querySelectorAll('[data-mtbo]').forEach(c=>c.addEventListener('change',()=>{ if(c.checked) m.off.delete(c.dataset.mtbo); else m.off.add(c.dataset.mtbo); mtOverlay(true); }));
  root.querySelector('[data-mtball]')?.addEventListener('change',e=>{ const P=mtPick({segIds:mtBatchSegIds(m),n:m.n}); m.off=e.target.checked?new Set():new Set(P.rows.map(a=>a.id)); mtOverlay(true); });
  root.querySelector('[data-mtbgo]')?.addEventListener('click',async()=>{ const P=mtPick({segIds:mtBatchSegIds(m),n:m.n}), ids=P.rows.filter(a=>!m.off.has(a.id)).map(a=>a.id); if(!ids.length) return;
    const w=m.seg.startsWith('wave:')?m.seg.slice(5):''; const id=await mtCreateBatch({name:(m.name||'').trim(),segIds:mtBatchSegIds(m),wave:w,ids,requested:m.n,ownerId:m.owner||null});
    UI.mt.tab='arb'; UI.mt.modal=null; mtOverlay(true); renderView(true); toast('Batch med '+ids.length+' accounts er opprettet. Ingen er enrollet.'); }); }

/* ---------- Legg til account ---------- */
function mtMAdd(m){
  const f=m.f, c=mtCfg();
  return mtShell('Legg til account','<div class="form">'+mtFld('Organisasjon','<input class="in" data-mta="name" value="'+esc(f.name)+'">',true)+mtFld('Nettside eller domene','<input class="in" data-mta="website" value="'+esc(f.website)+'" placeholder="organisasjon.no">')+mtFld('Org.nr.','<input class="in" data-mta="orgnr" inputmode="numeric" value="'+esc(f.orgnr)+'">')+
   mtFld('Segment','<select class="in" data-mta="segId">'+c.segs.map(s=>'<option value="'+esc(s.id)+'"'+(f.segId===s.id?' selected':'')+'>'+esc(s.name)+' ('+s.prio+')</option>').join('')+'</select>')+mtFld('Sted','<input class="in" data-mta="place" value="'+esc(f.place)+'">')+
   mtFld('Størrelse','<select class="in" data-mta="size"><option value="">Ukjent</option>'+[['S','Liten'],['M','Middels'],['L','Stor']].map(([k,n])=>'<option value="'+k+'"'+(f.size===k?' selected':'')+'>'+n+'</option>').join('')+'</select>')+mtFld('Hvorfor kan den være relevant','<input class="in" data-mta="why" value="'+esc(f.why)+'">',true)+'</div><p class="mt-hint">Duplikater fanges på org.nr., domene og navn. Eventsignal settes til Unknown til en kilde er lagt til. Kontaktpersoner legges til på accountkortet.</p>',
   '<button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mtago="1">Legg til</button>'); }
function mtWAdd(root,m){
  root.querySelectorAll('[data-mta]').forEach(i=>i.addEventListener('input',()=>{ m.f[i.dataset.mta]=i.value; })); root.querySelectorAll('select[data-mta]').forEach(i=>i.addEventListener('change',()=>{ m.f[i.dataset.mta]=i.value; }));
  root.querySelector('[data-mtago]')?.addEventListener('click',async()=>{ const r=await mtAddAccount({...m.f,src:'manuell'}); if(r.err){ toast(r.err); return; } UI.mt.modal=null; mtOverlay(true); renderView(true); toast('Account lagt til som identifisert'); mtOpen(r.id); }); }

/* ---------- filimport (Cognism, Apollo, Scout) ---------- */
function mtFileBox(m,what){
  return '<div class="mt-fb"><label class="btn"><input type="file" accept=".csv,.txt,text/csv" data-mtfile="1" class="sr"> Velg CSV-fil</label><span class="mt-hint">'+(m.file?esc(m.file):'eller lim inn innholdet')+'</span></div><textarea class="in mt-pa2" rows="3" data-mtpaste="1" placeholder="Lim inn CSV med overskriftsrad her">'+esc(m.paste||'')+'</textarea>'; }
function mtWFile(root,m,after){
  root.querySelector('[data-mtfile]')?.addEventListener('change',e=>mtReadFile(e.target,(t,n)=>{ mtLoad(m,t,n); mtOverlay(true); }));
  root.querySelector('[data-mtpaste]')?.addEventListener('change',e=>{ if(e.target.value.trim()){ mtLoad(m,e.target.value,'innlimt tekst'); mtOverlay(true); } }); }
function mtLoad(m,text,name){ const rows=parseCSV(text); if(rows.length<2){ toast('Fant ingen rader i filen.'); return; } m.rows=rows; m.file=name; m.paste=''; m.map=mtAutoMap(rows[0],m.k==='cog'?MT_SYN:m.k==='apo'?MT_SYN_APOLLO:MT_SYN_SCOUT); }
function mtMapBox(m,fields,open){
  const H=m.rows[0]; return '<details class="mt-mp"'+(open?' open':'')+'><summary>Kolonnekobling ('+fields.filter(([k])=>m.map[k]!=='').length+' av '+fields.length+' funnet)</summary><div class="form">'+fields.map(([k,n])=>mtFld(n,'<select class="in" data-mtmap="'+k+'"><option value="">Ikke i filen</option>'+H.map((h,i)=>'<option value="'+i+'"'+(m.map[k]===String(i)?' selected':'')+'>'+esc(h)+'</option>').join('')+'</select>')).join('')+'</div></details>'; }
function mtWMap(root,m){ root.querySelectorAll('[data-mtmap]').forEach(s=>s.addEventListener('change',()=>{ m.map[s.dataset.mtmap]=s.value; mtOverlay(true); })); }
const MT_F_COG=[['salongId','Salong account-ID'],['company','Selskap'],['domain','Domene / nettside'],['orgnr','Org.nr.'],['first','Fornavn'],['last','Etternavn'],['name','Fullt navn'],['title','Stilling'],['email','E-post'],['emailStatus','E-poststatus'],['phone','Telefon'],['phoneStatus','Telefonstatus'],['linkedin','LinkedIn'],['verifiedAt','contact_verified_at'],['quality','contact_data_quality']];
const MT_F_APO=[['email','E-post (kobler til kontakt)'],['salongId','Salong account-ID'],['seqName','Sekvensnavn'],['extId','Ekstern sekvens-ID'],['status','Sekvensstatus'],['enrolledAt','Enrolled'],['lastTouch','Siste touch'],['nextTouch','Neste touch'],['repliedAt','Svart']];
const MT_F_SCO=[['name','Navn'],['domain','Domene'],['orgnr','Org.nr.'],['segment','Segment'],['place','Sted'],['size','Størrelsessignal'],['evLevel','Eventsignal (Confirmed/Likely)'],['evText','Arrangementsignal (tekst)'],['srcUrl','Kilde-URL'],['checked','Sist kontrollert'],['why','Hvorfor relevant']];
function mtMCog(m){
  let body='<p class="mt-note">Cognism er ikke tilkoblet. Her importerer du en CSV du selv har eksportert fra Cognism. Kilden settes til Cognism. Verifiseringsdato og datakvalitet hentes bare fra filen, og Salong viser ingenting som verifisert uten dem. Kontakter er personopplysninger: importer bare det dere har grunnlag for å bruke, og respekter opt-out. Kolonnene gjenkjennes automatisk.</p>'+mtFileBox(m);
  if(m.rows){ const plan=mtCognismPlan(m.rows,m.map), nok=!!(m.map.name!==''||m.map.first!==''); m.plan=plan;
    body+=mtMapBox(m,MT_F_COG,!nok)+'<div class="mt-pl"><span><b>'+plan.add.length+'</b> nye kontakter på '+new Set(plan.add.map(x=>x.accId)).size+' accounts</span><span>'+plan.dup.length+' finnes allerede</span><span class="'+(plan.unmatched.length?'warn':'')+'">'+plan.unmatched.length+' uten treff på en account</span>'+(plan.dnc.length?'<span class="warn">'+plan.dnc.length+' hoppes over (ikke kontakt)</span>':'')+(plan.bad?'<span>'+plan.bad+' uten navn</span>':'')+'</div>'+
     (plan.unmatched.length?'<label class="mt-ck"><input type="checkbox" data-mtcreate="1"'+(m.create?' checked':'')+'> Opprett manglende accounts som «identifisert» (uten kvalifisering) og legg kontaktene på dem</label>':'')+
     (plan.add.length?'<div class="tbl"><table class="mt-t"><thead><tr><th>Kontakt</th><th>Stilling</th><th>Account</th><th>E-poststatus</th></tr></thead><tbody>'+plan.add.slice(0,8).map(x=>'<tr><td>'+esc(x.f.name)+'</td><td>'+esc(x.f.title)+'</td><td>'+esc(x.acc)+'</td><td>'+esc(x.f.emailStatus||'ikke oppgitt')+'</td></tr>').join('')+'</tbody></table></div>'+(plan.add.length>8?'<p class="mt-hint">Viser 8 av '+plan.add.length+'.</p>':''):''); }
  return mtShell('Importer Cognism-kontakter',body,'<button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn" data-mtsave="cog">Last ned CSV-mal</button><button type="button" class="btn primary" data-mtcogrun="1"'+(m.rows&&m.plan&&(m.plan.add.length||(m.create&&m.plan.unmatched.length))?'':' disabled')+'>Importer</button>',true); }
function mtWCog(root,m){ mtWFile(root,m); mtWMap(root,m);
  root.querySelector('[data-mtcreate]')?.addEventListener('change',e=>{ m.create=e.target.checked; mtOverlay(true); });
  root.querySelector('[data-mtcogrun]')?.addEventListener('click',async()=>{ const r=await mtCognismRun(m.plan,m.create); UI.mt.modal=null; mtOverlay(true); renderView(true); toast(r.n+' kontakter importert fra Cognism'+(r.made?' · '+r.made+' nye accounts':'')); }); }
function mtMApo(m){
  let body='<p class="mt-note">Apollo er ikke tilkoblet. Last inn en CSV du har eksportert fra Apollo. Salong oppdaterer sekvensstatus på kontaktene det finner. Avmeldinger blir opt-out og kan ikke enrolles igjen. Ingen enrolles automatisk herfra.</p>'+mtFileBox(m);
  if(m.rows){ const plan=mtApolloPlan(m.rows,m.map); m.plan=plan;
    body+=mtMapBox(m,MT_F_APO,m.map.email==='')+'<div class="mt-pl"><span><b>'+plan.apply.length+'</b> oppdateres</span><span class="'+(plan.unsub.length?'warn':'')+'">'+plan.unsub.length+' avmeldt (blir opt-out)</span><span>'+plan.dnc.length+' hoppes over (opt-out)</span><span class="'+(plan.unmatched.length?'warn':'')+'">'+plan.unmatched.length+' uten treff</span></div>'; }
  return mtShell('Importer Apollo-status',body,'<button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mtaporun="1"'+(m.rows&&m.plan&&(m.plan.apply.length||m.plan.unsub.length)?'':' disabled')+'>Importer status</button>',true); }
function mtWApo(root,m){ mtWFile(root,m); mtWMap(root,m);
  root.querySelector('[data-mtaporun]')?.addEventListener('click',async()=>{ const r=await mtApolloRun(m.plan); UI.mt.modal=null; mtOverlay(true); renderView(true); toast(r.n+' accounts oppdatert fra Apollo'+(r.unsub?' · '+r.unsub+' opt-out':'')); }); }
function mtMScout(m){
  const Q=mtScoutRows(), pend=Q.filter(q=>q.status==='ny'), done=Q.filter(q=>q.status!=='ny');
  let body='<div class="mt-scout"><p class="mt-ints"><i class="off"></i><b>Market Scout er ikke tilkoblet</b></p><p class="mt-note">Salong har ingen live websøk eller register-oppslag i dette miljøet, og finner derfor ingen kandidater selv. Ingenting er simulert. Importkøen under tar imot lister fra godkjente kilder og deduplikerer dem mot målmarkedet på org.nr. og domene, før noe blir en account.</p>'+
   '<p class="mt-hint">Market Scout skal finne organisasjoner, ikke personer. Når en kobling finnes, brukes bare segmentnavn og kildenavn i søkene. Kundedata og kontaktpersoner sendes aldri til offentlige søk.</p>'+
   '<details class="mt-oth"><summary>Godkjente kilder (utkast) og felter per kandidat</summary><p class="mt-hint">'+MT_SCOUT.sources.map(esc).join(' · ')+'. Andre medlems- og organisasjonsregistre kan godkjennes.</p><p class="mt-hint">Felter: navn, domene, org.nr., segment, sted, størrelsessignal, dokumentert arrangementsignal, kilde-URL, sist kontrollert, kort forklaring på hvorfor accounten kan være relevant.</p></details></div>'+
   '<h4>Importer kandidatliste</h4>'+mtFileBox(m);
  if(m.rows){ const list=mtScoutParse(m.rows,m.map); m.list=list; const nd=list.filter(x=>x.status==='ny').length;
    body+=mtMapBox(m,MT_F_SCO,m.map.name==='')+'<div class="mt-pl"><span><b>'+nd+'</b> nye kandidater</span><span class="'+(list.length-nd?'warn':'')+'">'+(list.length-nd)+' duplikater</span><span>'+list.filter(x=>x.evLevel==='Confirmed').length+' med dokumentert kilde</span></div>'+
     '<div class="tbl"><table class="mt-t"><thead><tr><th>Organisasjon</th><th>Domene / org.nr.</th><th>Segment</th><th>Signal</th><th>Status</th></tr></thead><tbody>'+list.slice(0,10).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.domain||x.orgnr||'–')+'</td><td>'+esc(x.segId?mtSegShort(mtSegName(x.segId)):(x.segText?x.segText+' (ukjent)':'–'))+'</td><td>'+esc(x.evLevel)+'</td><td>'+(x.status==='ny'?'Ny':'<span class="chip amber">Duplikat av '+esc(x.dupName)+'</span>')+'</td></tr>').join('')+'</tbody></table></div>'+(list.length>10?'<p class="mt-hint">Viser 10 av '+list.length+'.</p>':'')+
     '<div class="row"><button type="button" class="btn primary" data-mtqsave="1"'+(list.length?'':' disabled')+'>Legg '+list.length+' kandidater i importkøen</button></div>'; }
  body+='<h4>Importkø <span class="chip">'+pend.length+' venter</span></h4>';
  body+=pend.length?'<div class="tbl"><table class="mt-t"><thead><tr><th></th><th>Organisasjon</th><th>Segment</th><th>Kilde</th><th>Kontrollert</th></tr></thead><tbody>'+pend.slice(0,40).map(q=>'<tr><td><input type="checkbox" data-mtq="'+esc(q.id)+'" aria-label="Velg '+esc(q.name)+'"></td><td class="mt-o"><b>'+esc(q.name)+'</b><small>'+esc(q.why||'')+'</small></td><td>'+esc(q.segId?mtSegShort(mtSegName(q.segId)):'Uten segment')+'</td><td>'+(q.srcUrl?'<a href="'+esc(q.srcUrl)+'" target="_blank" rel="noopener">'+esc(mtHost(q.srcUrl))+'</a>':'–')+'</td><td>'+(q.checkedAt?esc(fd(q.checkedAt)):'–')+'</td></tr>').join('')+'</tbody></table></div><div class="row"><button type="button" class="btn primary" data-mtqgo="approve">Godkjenn valgte som accounts</button><button type="button" class="btn" data-mtqgo="reject">Avvis valgte</button><span class="mt-hint">Godkjente blir «identifisert». Kvalifisering følger målmarkedsreglene.</span></div>':'<p class="mt-hint">Køen er tom.</p>';
  if(done.length) body+='<p class="mt-hint">'+done.filter(q=>q.status==='godkjent').length+' godkjent og '+done.filter(q=>q.status==='avvist').length+' avvist tidligere.</p>';
  return mtShell('Market Scout',body,'<button type="button" class="btn" data-mtsave="scout">Last ned CSV-mal</button><button type="button" class="btn ghost" data-mtx="1">Lukk</button>',true); }
function mtWScout(root,m){ mtWFile(root,m); mtWMap(root,m);
  root.querySelector('[data-mtqsave]')?.addEventListener('click',async()=>{ const n=await mtScoutSave(m.list,m.file); m.rows=null; m.list=null; toast(n+' kandidater i importkøen'); mtOverlay(true); });
  root.querySelectorAll('[data-mtqgo]').forEach(b=>b.addEventListener('click',async()=>{ const ids=[...root.querySelectorAll('[data-mtq]:checked')].map(c=>c.dataset.mtq); if(!ids.length){ toast('Velg minst én kandidat.'); return; }
    let ok=0,bad=0; for(const id of ids){ if(b.dataset.mtqgo==='approve'){ const r=await mtScoutApprove(id); if(r.err) bad++; else ok++; } else { await mtScoutReject(id,'Avvist i gjennomgang'); ok++; } }
    toast(b.dataset.mtqgo==='approve'?ok+' accounts opprettet'+(bad?' · '+bad+' hoppet over (duplikat)':''):ok+' avvist'); renderView(true); mtOverlay(true); })); }

/* ---------- eksport: enrichment og Apollo ---------- */
function mtCsvBox(id,csv,rows){ return '<textarea class="in mt-csv" id="'+id+'" rows="6" readonly aria-label="CSV-innhold">'+esc(csv)+'</textarea><div class="row"><button type="button" class="btn" data-mtcp="'+id+'">Kopier</button></div>'; }
function mtMEnr(m){
  const L=mtAll().filter(a=>a.kind==='ny'&&a.flags.qualified&&!a.flags.enriched&&!a.dncAcc); if(!m.sel) m.sel=new Set(L.filter(a=>a.doc&&a.doc.enrichAt||a.batch).map(a=>a.id));
  const pick=L.filter(a=>m.sel.has(a.id)), csv=mtEnrichCsv(pick);
  const body='<p class="mt-note">Cognism er ikke tilkoblet. Eksporter kvalifiserte accounts uten kontaktdata, importer dem i Cognism, og last resultatet tilbake via Importer Cognism-kontakter. Eksporten inneholder bare organisasjonsdata og ønsket kontaktrolle, ingen personopplysninger.</p>'+
   (L.length?'<div class="tbl"><table class="mt-t"><thead><tr><th><input type="checkbox" data-mtea aria-label="Velg alle" '+(pick.length===L.length?'checked':'')+'></th><th>Organisasjon</th><th>Segment</th><th>Ønsket kontaktrolle</th></tr></thead><tbody>'+L.map(a=>'<tr><td><input type="checkbox" data-mte="'+esc(a.id)+'" '+(m.sel.has(a.id)?'checked':'')+' aria-label="Velg '+esc(a.name)+'"></td><td class="mt-o"><b>'+esc(a.name)+'</b><small>'+esc(a.domain||'mangler domene')+'</small></td><td>'+esc(mtSegLabel(a))+'</td><td>'+esc((a.roles||[]).join(', '))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="mt-empty"><p>Ingen kvalifiserte accounts mangler kontaktdata.</p></div>')+(pick.length?mtCsvBox('mtEnrCsv',csv):'');
  return mtShell('Eksporter accounts for enrichment',body,'<button type="button" class="btn ghost" data-mtx="1">Lukk</button><button type="button" class="btn primary" data-mtenrgo="1"'+(pick.length?'':' disabled')+'>Last ned CSV ('+pick.length+')</button>',true); }
function mtWEnr(root,m){
  root.querySelectorAll('[data-mte]').forEach(c=>c.addEventListener('change',()=>{ if(c.checked) m.sel.add(c.dataset.mte); else m.sel.delete(c.dataset.mte); mtOverlay(true); }));
  root.querySelector('[data-mtea]')?.addEventListener('change',e=>{ const L=mtAll().filter(a=>a.kind==='ny'&&a.flags.qualified&&!a.flags.enriched&&!a.dncAcc); m.sel=e.target.checked?new Set(L.map(a=>a.id)):new Set(); mtOverlay(true); });
  root.querySelector('[data-mtenrgo]')?.addEventListener('click',async()=>{ const pick=mtAll().filter(a=>m.sel.has(a.id)); const ok=await mtSave('salong-enrichment-'+mtToday()+'.csv',mtEnrichCsv(pick)); if(ok) for(const a of pick) await mtPatch(a.id,{enrichAt:mtToday()},'Eksportert for enrichment'); }); }
function mtMExp(m){
  const all=mtAll(); let L; if(m.ids) L=m.ids.map(id=>all.find(a=>a.id===id)).filter(Boolean); else if(m.batch){ const b=mtBuild().batches.find(x=>x.id===m.batch); L=(b?b.accIds:[]).map(id=>all.find(a=>a.id===id)).filter(Boolean); } else L=all.filter(a=>a.stage==='ready'&&a.flags.qualified&&a.flags.enriched);
  m.list=L; const P=mtApolloPrep(L,m.seqName||'');
  const body='<p class="mt-note">Apollo er ikke tilkoblet. Dette er en CSV-eksport du laster inn i Apollo selv. Kontakter med opt-out, accounts som ikke er kvalifisert, og accounts uten aktiv kontaktperson med e-post hoppes over. Maks 2 aktive personer per account. Ingenting enrolles automatisk.</p>'+
   mtFld('Apollo-sekvensnavn (valgfritt, ellers kadensnavn)','<input class="in" data-mtseqn="1" value="'+esc(m.seqName||'')+'">',true)+
   '<div class="mt-pl"><span><b>'+P.accs.length+'</b> accounts · <b>'+P.rows+'</b> kontakter klare</span><span class="'+(P.skipped.length?'warn':'')+'">'+P.skipped.length+' hoppet over</span></div>'+
   (P.skipped.length?'<ul class="mt-sk">'+P.skipped.slice(0,8).map(s=>'<li><b>'+esc(s.name)+'</b>: '+esc(s.why)+'</li>').join('')+'</ul>':'')+(P.rows?mtCsvBox('mtApoCsv',P.csv):'<div class="mt-empty"><p>Ingen kontakter er klare for eksport.</p></div>');
  return mtShell('Apollo CSV (fallback)',body,'<button type="button" class="btn ghost" data-mtx="1">Lukk</button><button type="button" class="btn" data-mtenroll="1"'+(P.accs.length?'':' disabled')+' title="Bruk når kontaktene faktisk er lagt inn i Apollo">Marker som enrollet i Apollo</button><button type="button" class="btn primary" data-mtapogo="1"'+(P.rows?'':' disabled')+'>Last ned CSV ('+P.rows+')</button>',true); }
function mtWExp(root,m){
  root.querySelector('[data-mtseqn]')?.addEventListener('change',e=>{ m.seqName=e.target.value; mtOverlay(true); });
  root.querySelector('[data-mtapogo]')?.addEventListener('click',async()=>{ const P=mtApolloPrep(m.list,m.seqName||''); const ok=await mtSave('salong-apollo-'+mtToday()+'.csv',P.csv); if(ok){ await mtApolloMark(P.accs,m.seqName||''); toast('Klargjort. Kontaktene er ikke enrollet før du markerer det.'); mtOverlay(true); } });
  root.querySelector('[data-mtenroll]')?.addEventListener('click',async e=>{ const b=e.currentTarget; if(!b.dataset.ask){ b.dataset.ask='1'; b.textContent='Klikk igjen: de er lagt inn i Apollo'; return; }
    const P=mtApolloPrep(m.list,m.seqName||''); let n=0,bad=0; for(const id of P.accs){ const r=await mtSetStage(id,'enrolled'); if(r&&r.err) bad++; else n++; } toast(n+' accounts markert som enrollet'+(bad?' · '+bad+' avvist':'')); mtModalClose(); renderView(true); }); }

/* ---------- segmenter og bølger ---------- */
function mtMSeg(m){
  const d=m.d;
  const body='<div class="form">'+mtFld('Måldato','<input class="in" type="date" data-mtg="target" value="'+esc(d.target)+'">')+mtFld('Dekningsmål (%)','<input class="in" type="number" min="1" max="100" data-mtg="goalPct" value="'+d.goalPct+'">')+'</div>'+
   '<h4>Målmarkedsregler</h4><label class="mt-ck"><input type="checkbox" data-mtrule="id"'+(d.rules.id?' checked':'')+'> Krev domene eller org.nr. for å kvalifisere</label><label class="mt-ck"><input type="checkbox" data-mtrule="ev"'+(d.rules.ev?' checked':'')+'> Krev eventsignal minst «Likely»</label>'+
   '<h4>Segmenter</h4><div class="tbl"><table class="mt-t"><thead><tr><th>Aktiv</th><th>Navn</th><th>Prioritet</th><th>Ønskede kontaktroller</th></tr></thead><tbody>'+d.segs.map((s,i)=>'<tr><td><input type="checkbox" data-mtsg="'+i+'|on"'+(s.on!==false?' checked':'')+' aria-label="Aktiv"></td><td><input class="in" data-mtsg="'+i+'|name" value="'+esc(s.name)+'" aria-label="Navn"></td><td><select class="in fsel" data-mtsg="'+i+'|prio" aria-label="Prioritet">'+['P0','P1','P2'].map(p=>'<option'+(s.prio===p?' selected':'')+'>'+p+'</option>').join('')+'</select></td><td><input class="in" data-mtsg="'+i+'|roles" value="'+esc((s.roles||[]).join(', '))+'" aria-label="Roller"></td></tr>').join('')+'</tbody></table></div><div class="row"><button type="button" class="btn sm" data-mtsgadd="1">Legg til segment</button></div>'+
   '<h4>Bølger (første kartlegging)</h4><div class="tbl"><table class="mt-t"><thead><tr><th>Navn</th><th>Mål</th><th>Segmenter</th></tr></thead><tbody>'+d.waves.map((w,i)=>'<tr><td><input class="in" data-mtwv="'+i+'|name" value="'+esc(w.name)+'" aria-label="Navn"></td><td><input class="in mt-gi" type="number" min="0" step="5" data-mtwv="'+i+'|goal" value="'+(w.goal||0)+'" aria-label="Mål"></td><td class="mt-wk">'+d.segs.map(s=>'<label class="mt-ck"><input type="checkbox" data-mtwv="'+i+'|seg|'+esc(s.id)+'"'+(w.segs.includes(s.id)?' checked':'')+'> '+esc(mtSegShort(s.name))+'</label>').join('')+'</td></tr>').join('')+'</tbody></table></div>';
  return mtShell('Segmenter og bølger',body,'<button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mtsegsave="1">Lagre</button>',true); }
function mtWSeg(root,m){
  const d=m.d;
  root.querySelectorAll('[data-mtg]').forEach(i=>i.addEventListener('change',()=>{ d[i.dataset.mtg]=i.dataset.mtg==='goalPct'?Math.max(1,Math.min(100,Number(i.value)||100)):i.value; }));
  root.querySelectorAll('[data-mtrule]').forEach(i=>i.addEventListener('change',()=>{ d.rules[i.dataset.mtrule]=i.checked; }));
  root.querySelectorAll('[data-mtsg]').forEach(i=>i.addEventListener('change',()=>{ const [ix,f]=i.dataset.mtsg.split('|'), s=d.segs[Number(ix)]; if(f==='on') s.on=i.checked; else if(f==='roles') s.roles=i.value.split(',').map(x=>x.trim()).filter(Boolean); else s[f]=i.value; }));
  root.querySelectorAll('[data-mtwv]').forEach(i=>i.addEventListener('change',()=>{ const [ix,f,id]=i.dataset.mtwv.split('|'), w=d.waves[Number(ix)]; if(f==='seg'){ w.segs=i.checked?[...new Set([...w.segs,id])]:w.segs.filter(x=>x!==id); } else if(f==='goal') w.goal=Math.max(0,Number(i.value)||0); else w[f]=i.value; }));
  root.querySelector('[data-mtsgadd]')?.addEventListener('click',()=>{ d.segs.push({id:'s-'+Math.random().toString(36).slice(2,6),name:'Nytt segment',prio:'P2',on:true,roles:[]}); mtOverlay(true); });
  root.querySelector('[data-mtsegsave]')?.addEventListener('click',async()=>{ if(d.segs.some(s=>!String(s.name).trim())){ toast('Alle segmenter trenger et navn.'); return; } await mtSaveCfg({target:d.target,goalPct:d.goalPct,segs:d.segs,waves:d.waves,rules:d.rules}); mtModalClose(); renderView(true); toast('Segmenter og bølger er lagret'); }); }

/* ---------- snapshots ---------- */
function mtMSnap(m){
  const now=mtSnapNow(), snaps=mtSnaps(), c=now.counts;
  const body='<p class="mt-note">Et snapshot fryser målmarkedet på en dato: antall og hvilke accounts som var kvalifisert og adressert. Historisk dekning endres ikke når nye accounts legges inn senere. Mellom snapshots viser Salong at nevneren er endret.</p>'+
   '<div class="tbl"><table class="mt-t"><thead><tr><th>Dato</th><th class="n">Identifisert</th><th class="n">Kvalifisert</th><th class="n">Adressert</th><th class="n">Dekning</th><th>Notat</th></tr></thead><tbody><tr class="mt-now"><td><b>Nå</b> <small>ikke lagret</small></td><td class="n">'+c.discovered+'</td><td class="n">'+c.qualified+'</td><td class="n">'+c.addressed+'</td><td class="n">'+mtPct(c.qualified?c.addressed/c.qualified:null)+'</td><td></td></tr>'+
   snaps.map(s=>{ const x=s.counts||{}; return '<tr><td>'+esc(fd(s.date))+'</td><td class="n">'+x.discovered+'</td><td class="n">'+x.qualified+'</td><td class="n">'+x.addressed+'</td><td class="n">'+mtPct(x.qualified?x.addressed/x.qualified:null)+'</td><td>'+esc(s.note||'')+'</td></tr>'; }).join('')+(snaps.length?'':'<tr><td colspan="6" class="mt-low">Ingen snapshots ennå.</td></tr>')+'</tbody></table></div>'+
   mtFld('Notat (valgfritt)','<input class="in" data-mtsn="1" value="'+esc(m.note||'')+'" placeholder="For eksempel: etter import av Forleggerforeningens liste">',true);
  return mtShell('Snapshots av målmarkedet',body,'<button type="button" class="btn ghost" data-mtx="1">Lukk</button><button type="button" class="btn primary" data-mtsnapgo="1">Ta snapshot nå</button>',true); }
function mtWSnap(root,m){ root.querySelector('[data-mtsn]')?.addEventListener('input',e=>{ m.note=e.target.value; }); root.querySelector('[data-mtsnapgo]')?.addEventListener('click',async()=>{ await mtSnapSave(m.note); m.note=''; toast('Snapshot lagret'); mtOverlay(true); renderView(true); }); }

/* ---------- kadensmal ---------- */
function mtMTpl(m){
  const name=m.key==='react'?'Reaktivering':mtSegName(m.key);
  const body='<p class="mt-hint">Salong sender ingenting. Stegene er en plan du følger, eller kjører i Apollo. Dag 1 er dagen accounten enrolles.</p><div class="tbl"><table class="mt-t"><thead><tr><th>Dag</th><th>Kanal</th><th>Steg</th><th></th></tr></thead><tbody>'+m.steps.map((s,i)=>'<tr><td><input class="in mt-gi" type="number" min="1" data-mtts="'+i+'|d" value="'+s.d+'" aria-label="Dag"></td><td><select class="in fsel" data-mtts="'+i+'|ch" aria-label="Kanal">'+Object.entries(MT_CH).map(([k,n])=>'<option value="'+k+'"'+(s.ch===k?' selected':'')+'>'+n+'</option>').join('')+'</select></td><td><input class="in" data-mtts="'+i+'|t" value="'+esc(s.t)+'" aria-label="Beskrivelse"></td><td><button type="button" class="btn ghost sm" data-mttsrm="'+i+'" aria-label="Fjern steg">Fjern</button></td></tr>').join('')+'</tbody></table></div><div class="row"><button type="button" class="btn sm" data-mttsadd="1">Legg til steg</button></div>'+mtStepper(m.steps.slice().sort((a,b)=>a.d-b.d).map(s=>({...s,state:'later'})),'mini');
  return mtShell('Kadens: '+name,body,'<button type="button" class="btn ghost" data-mttsreset="1">Tilbakestill til standard</button><button type="button" class="btn ghost" data-mtx="1">Avbryt</button><button type="button" class="btn primary" data-mttssave="1">Lagre</button>',true); }
function mtWTpl(root,m){
  root.querySelectorAll('[data-mtts]').forEach(i=>i.addEventListener('change',()=>{ const [ix,f]=i.dataset.mtts.split('|'); m.steps[Number(ix)][f]=f==='d'?Math.max(1,Number(i.value)||1):i.value; mtOverlay(true); }));
  root.querySelectorAll('[data-mttsrm]').forEach(b=>b.addEventListener('click',()=>{ m.steps.splice(Number(b.dataset.mttsrm),1); mtOverlay(true); }));
  root.querySelector('[data-mttsadd]')?.addEventListener('click',()=>{ const last=m.steps[m.steps.length-1]; m.steps.push({d:(last?last.d:0)+3,ch:'epost',t:'Nytt steg'}); mtOverlay(true); });
  root.querySelector('[data-mttssave]')?.addEventListener('click',async()=>{ const c=mtCfg(); const steps=m.steps.slice().sort((a,b)=>a.d-b.d); if(!steps.length){ toast('Kadensen trenger minst ett steg.'); return; } await mtSaveCfg({seq:{...c.seq,[m.key]:steps}}); mtModalClose(); renderView(true); toast('Kadensen er lagret'); });
  root.querySelector('[data-mttsreset]')?.addEventListener('click',async()=>{ const c=mtCfg(), seq={...c.seq}; delete seq[m.key]; await mtSaveCfg({seq}); mtModalClose(); renderView(true); toast('Tilbake til standard'); }); }

/* ---------- definisjoner ---------- */
function mtMDefs(){
  const D=[['discovered','Organisasjonen er identifisert.'],['qualified','Oppfyller målmarkedsreglene (se under) eller er kvalifisert manuelt.'],['enriched','Minst én relevant kontaktperson med e-post, telefon eller LinkedIn er tilgjengelig.'],['addressed','Minst én reell outbound-touch til en relevant person er logget (eller importert fra Apollo).'],['engaged','Faktisk toveis dialog: svar, møte eller en sak.'],['opportunity','En konkret mulig utleiesak finnes.'],['completed','Accounten er adressert eller eksplisitt ferdig vurdert (inkludert diskvalifisert).'],['disqualified','Tatt ut av målmarkedet. Krever årsak.']];
  const body='<dl class="mt-defs">'+D.map(([k,t])=>'<dt>'+MT_STAT[k]+' <code>'+k+'</code></dt><dd>'+esc(t)+'</dd>').join('')+'</dl><h4>Markedsdekning</h4><p class="mt-hint"><b>Dekning</b> = adresserte kvalifiserte accounts / alle kvalifiserte accounts. <b>Ferdig / identifisert</b> = completed / discovered. Kontakter telles aldri som accounts, og samme organisasjon telles én gang (dedupe på org.nr. og domene). Tidligere leietakere ligger utenfor dekningen og følges i egen reaktiveringskadens.</p><h4>Målmarkedsregler</h4><ul class="mt-rl">'+MT_RULES.map(r=>'<li class="ok"><b>'+esc(r.t)+'.</b> '+esc(r.d)+'</li>').join('')+'</ul><p class="mt-hint">Statusene beskriver markedsbearbeiding og er adskilt fra pipeline-stegene på saker.</p>';
  return mtShell('Hva betyr statusene?',body,'<button type="button" class="btn ghost" data-mtx="1">Lukk</button>'); }

/* ---------- kobling ---------- */
function mtWireModal(root){
  const m=UI.mt.modal, k=m.k; ({batch:mtWBatch,add:mtWAdd,cog:mtWCog,apo:mtWApo,scout:mtWScout,enr:mtWEnr,exp:mtWExp,seg:mtWSeg,snap:mtWSnap,tpl:mtWTpl,defs:()=>{}})[k](root,m);
  root.querySelectorAll('.mt-md .x').forEach(x=>x.addEventListener('click',mtModalClose));
  root.querySelectorAll('[data-mtcp]').forEach(b=>b.addEventListener('click',()=>{ const t=root.querySelector('#'+b.dataset.mtcp); if(t) copyText(t.value,t); }));
  root.querySelectorAll('[data-mtsave]').forEach(b=>b.addEventListener('click',async()=>{ const t=b.dataset.mtsave; const head=t==='cog'?MT_F_COG.map(x=>x[1]):MT_F_SCO.map(x=>x[1]); const csv=mtCsv(head,[]);
    if(dl) await mtSave('salong-mal-'+t+'.csv',csv); else { copyText(csv); } }));
  if(!m.focused){ m.focused=true; const h=root.querySelector('.mt-md h2'); if(h){ h.setAttribute('tabindex','-1'); h.focus(); } }
}
