# Bygger Salong til én HTML-fil: app_base.js + rep()-patcher + moduler (MODS) + CSS.
# Kjøres fra hvor som helst: `python3 src/build.py`. Utdata: dist/salong.html (fragment uten doctype, brukes av Artifact-verktøyet)
# og dist/index.html (full side for lokal kjøring og tester). Bare Python 3 standardbibliotek.
import re,sys,os,json
os.chdir(os.path.dirname(os.path.abspath(__file__)))
MODS=[f for f in ['dq.js','core.js','kb.js','kbui.js','kn.js','team.js','market.js','ux.js','mseed.js','cal2.js','market2.js','u3.js','u3seed.js','k3.js','i3.js','g3.js','m3.js','c3.js','mt.js','mtui.js','mtmod.js','elig.js','services/crm.js','services/planning.js','berik.js','berikui.js','services/providers/apollo.js','enr.js','enrsvc.js','enrrun.js','cov.js','drw.js','kal3.js','idag.js','idagui.js','idnew.js','idcmd.js','planui.js','maler.js','m3v.js','mkgap.js','tier.js','tierui.js','tierseq.js','strat.js','enrui2.js','services/enrichment-job.js','services/http-backend.js','services/organization-bridge.js','services/api.js','services/live-preview.js','ask.js'] if os.path.exists(f)]
CSS=[f for f in ['p7.css','p8.css','p9.css','p10.css','p11.css','p12.css','p13.css','p14.css','p15.css','p16.css','p17.css','p18.css','p19.css','p20.css','p21.css','p22.css','p23.css','p24.css'] if os.path.exists(f)]
def rd(f): return open(f).read()
src=rd('app_base.js')
# Eksempeldata har én kilde: data/example/seed.json. Bygg dem inn slik at standalone/Artifact fortsatt er selvstendig.
with open('../data/example/seed.json',encoding='utf-8') as f:
  demo_seed=json.load(f)
demo_marker='const DEMO=/*__SALONG_DEMO_SEED__*/{};'
assert demo_marker in src,'MANGLER demo-seed-markør'
src=src.replace(demo_marker,'const DEMO='+json.dumps(demo_seed,ensure_ascii=False,separators=(',',':'))+';',1)
def rep(old,new,count=1):
  global src
  assert old in src,'MANGLER: '+old[:100]
  src=src.replace(old,new,count)
# Første lavrisiko-kjernepatcher er brettet inn i app_base.js. Nye endringer skal gjøres i kildekoden, ikke som nye rep()-patcher.
# B statistikk bygger på samme utvalg som kunnskapslaget
rep("real=deals().filter(d=>d.stage==='bekreftet'&&d.date);","real=KB.realRows();")
# C/D kundekort
rep("const KTABS=[['oversikt','Oversikt'],","const KTABS=[['oversikt','Oversikt'],['kunnskap','Spør og forbered'],")
rep("({oversikt:kcOverview,","({kunnskap:kbPanel,oversikt:kcOverview,")
rep("function wireOrg(root,D){\n  const o=D.draft;","function wireOrg(root,D){\n  const o=D.draft; wireKb(root,D);")
rep("'<label class=\"f\"><span>Nettside</span><input class=\"in\" data-o=\"website\" value=\"'+esc(o.website)+'\"></label>'+","'<label class=\"f\"><span>Nettside</span><input class=\"in\" data-o=\"website\" value=\"'+esc(o.website)+'\"></label>'+\n    '<label class=\"f\"><span>Org.nr.</span><input class=\"in\" data-o=\"orgnr\" inputmode=\"numeric\" value=\"'+esc(o.orgnr||'')+'\" placeholder=\"Brukes til sikker kobling ved import\"></label>'+")
rep("const EDIT={org:['name','segment','tier','website',","const EDIT={org:['name','segment','tier','website','orgnr',")
rep("const FNAME={","const FNAME={orgnr:'Org.nr.',")
# E/F sak
rep("[['saksbilde','Saksbilde'],['detaljer','Detaljer'],['aktivitet','Aktivitet']]","[['saksbilde','Saksbilde'],['kunnskap','Spør og forbered'],['detaljer','Detaljer'],['aktivitet','Aktivitet']]")
rep("(D.dtab==='saksbilde'?'<div class=\"case\">'+caseHTML(D)+'</div>':'')","(D.dtab==='saksbilde'?'<div class=\"case\">'+caseHTML(D)+'</div>':D.dtab==='kunnskap'?kbPanel(D):'')")
rep("function wireCase(root,D){\n  if(!D.id) return;","function wireCase(root,D){\n  if(!D.id) return; wireKb(root,D);")
# L saksbildet bruker samme kunnskapslag: kildehenvisning per punkt
rep("src,at,by,auto:!!conflicts[key],...o2});","src,at,by,ref:f?.ref||'',auto:!!conflicts[key],...o2});")
rep("[srcLine(i),i.why?'<span class=\"cp-why\">'+esc(i.why)+'</span>':'',i.note?'Merknad: '+esc(i.note):''].filter(Boolean).join(' · ')+' <button","[srcLine(i),i.ref?'<button type=\"button\" class=\"lnk\" data-kbsrc=\"'+esc(i.ref)+'\">Åpne kilden</button>':'',i.why?'<span class=\"cp-why\">'+esc(i.why)+'</span>':'',i.note?'Merknad: '+esc(i.note):''].filter(Boolean).join(' · ')+' <button")
rep("<label class=\"f full\"><span>Merknad (påkrevd ved motstridende)</span>","<label class=\"f full\"><span>Knytt til en kilde på saken (valgfritt)</span><select class=\"in\" id=\"ceRef\"><option value=\"\">Ingen bestemt kilde</option>'+KB.chunks({orgId:d.orgId,shared:false}).filter(c=>c.dealId===D.id).map(c=>'<option value=\"'+esc(c.id)+'\"'+(((d.facts||{})[i.key]?.ref||'')===c.id?' selected':'')+'>'+esc(c.kind+' · '+(fdt(c.changedAt)||'uten tidspunkt')+' · '+c.title.slice(0,40))+'</option>').join('')+'</select></label><label class=\"f full\"><span>Merknad (påkrevd ved motstridende)</span>")
rep("D.caseEdit=null; await setFact(D,key,{st,src,note}); renderDrawer(true); }));","D.caseEdit=null; await setFact(D,key,{st,src,note,ref:$('#ceRef')?.value||''}); renderDrawer(true); }));")
rep("    '<div class=\"row\"><button class=\"btn sm\" type=\"button\" data-cnew=\"1\">Ny oppgave</button><button class=\"btn ghost sm\" type=\"button\" data-ctab=\"aktivitet\">Se all aktivitet</button></div></details>';",
    "    '<div class=\"row\"><button class=\"btn sm\" type=\"button\" data-cnew=\"1\">Ny oppgave</button><button class=\"btn ghost sm\" type=\"button\" data-ctab=\"aktivitet\">Se all aktivitet</button></div></details>'+\n   (()=>{ const L=KB.chunks({orgId:d.orgId,shared:false}).filter(c=>c.dealId===D.id).sort((a,b)=>(b.changedAt||'').localeCompare(a.changedAt||'')); return '<div class=\"csrc\"><h3>Kilder på saken</h3>'+(L.length?L.slice(0,6).map(c=>'<div class=\"csrc-r\"><button type=\"button\" class=\"lnk\" data-kbsrc=\"'+esc(c.id)+'\">'+esc(c.kind)+'</button><span class=\"meta\">'+esc(fdt(c.changedAt)||'tidspunkt ikke registrert')+(c.by?' · '+esc(c.by):'')+' · '+esc(c.title.slice(0,60))+'</span></div>').join('')+(L.length>6?'<p class=\"cp-meta\">'+(L.length-6)+' til under «Spør og forbered».</p>':''):'<p class=\"empty\">Ingen notater, e-poster eller tilbud er registrert på saken.</p>')+'</div>'; })();")
# K forespørsel: behold den innlimte teksten som kilde
rep("  const id=uid('d'), r=RM[f.room], price=r?.price?(f.pricing==='open'?r.price[0]:r.price[1]):0;\n  await put('deals',id,{facts:inqFacts(f,UI.inbox.ai,price,!!UI.inbox.text.trim()),",
    "  const id=uid('d'), r=RM[f.room], price=r?.price?(f.pricing==='open'?r.price[0]:r.price[1]):0, raw=UI.inbox.text.trim(), srcId=raw?uid('a'):null;\n  if(srcId) await put('acts',srcId,{orgId,dealId:id,type:'email',text:'Innkommende forespørsel, limt inn',body:raw,at:iso(new Date()),due:null,done:true,byId:me.id||null,byName:me.name||''});\n  await put('deals',id,{facts:inqFacts(f,UI.inbox.ai,price,!!raw,srcId?'a:'+srcId:''),")
rep("function inqFacts(f,ai,price,hasText){ const at=iso(new Date()), by=me.name||'', mk=(v,src)=>({st:'forelopig',src,at,by,v:String(v),","function inqFacts(f,ai,price,hasText,ref){ const at=iso(new Date()), by=me.name||'', mk=(v,src)=>({st:'forelopig',src,at,by,v:String(v),...(ref&&src!=='prisliste'?{ref}:{}),")
# J tilbudet som gjaldt ved bekreftelse beholder versjonen sin
rep("function setStage(id,st){ const d=S.deals[id]; if(!d||d.stage===st) return;","function setStage(id,st){ const d=S.deals[id]; if(!d||d.stage===st) return; if(st==='bekreftet'){ const of=latestOffer(id); if(of&&!of.lockedAt){ const {id:oid,...rest}=of; put('offers',oid,{...rest,lockedAt:iso(new Date())},{action:'tilbud v'+of.version+' gjaldt ved bekreftelse'}); } }")
# H importveiviser
rep("aria-pressed=\"'+(I.type==='deals')+'\">Bookinger</button></div>","aria-pressed=\"'+(I.type==='deals')+'\">Saker</button><button type=\"button\" data-imp=\"bookings\" aria-pressed=\"'+(I.type==='bookings')+'\">Bookinguttrekk</button></div>")
rep("(I.type==='orgs'?'Kontakter: organisasjon, segment, kontaktperson, e-post, telefon.':'Bookinger fra bookingsystemet: arrangør, arrangement, dato, sal, status, antall, beløp. Blir saker med historikk.')","(I.type==='orgs'?'Kontakter: organisasjon, segment, kontaktperson, e-post, telefon.':I.type==='bookings'?'Uttrekk fra bookingsystemet. Lagres som bookinger med kilde-ID, adskilt fra saker. Samme booking oppdateres ved ny import og telles én gang.':'Saker fra regneark: arrangør, arrangement, dato, sal, status, antall, beløp.')")
rep("  if(I.step===1) body='<div class=\"row\"><div class=\"seg\" role=\"group\" aria-label=\"Type import\">","  if(I.type==='bookings'&&(I.step===3||I.step===4)) body=bkStepHTML();\n  else if(I.step===1) body='<div class=\"row\"><div class=\"seg\" role=\"group\" aria-label=\"Type import\">")
rep("</select></label>').join('')+'</div>'+\n   '<div class=\"tbl\"><table class=\"dense\"><thead><tr>'+F.map(([,n])=>'<th>'+n+'</th>')","</select></label>').join('')+'</div>'+(I.type==='bookings'?bkMetaHTML():'')+\n   '<div class=\"tbl\"><table class=\"dense\"><thead><tr>'+F.map(([,n])=>'<th>'+n+'</th>')")
rep("(F.filter(f=>f[2]).every(([k])=>I.map[k]!==''&&I.map[k]!=null)?'':' disabled aria-describedby=\"mapReq\"')","(F.filter(f=>f[2]).every(([k])=>I.map[k]!==''&&I.map[k]!=null)&&(I.type!=='bookings'||(I.meta&&I.meta.system.trim()&&I.meta.extractAt&&(!I.meta.complete||bkScopeOk(I.meta))))?'':' disabled aria-describedby=\"mapReq\"')")
rep("async function runImport(){\n","async function runImport(){\n  if(UI.imp.type==='bookings') return bkRun();\n")
rep("function wireImport(v){\n  const I=UI.imp;","function wireImport(v){\n  const I=UI.imp;\n  const bkOk=()=>{ const btn=v.querySelector('[data-istep=\"3\"]'); if(btn&&I.type==='bookings') btn.disabled=!(IMPF.bookings.filter(f=>f[2]).every(([k])=>I.map[k]!==''&&I.map[k]!=null)&&I.meta.system.trim()&&I.meta.extractAt&&(!I.meta.complete||bkScopeOk(I.meta))); };\n  $('#bkFrom')?.addEventListener('input',e=>{ I.meta.from=e.target.value; bkOk(); }); $('#bkTo')?.addEventListener('input',e=>{ I.meta.to=e.target.value; bkOk(); });\n  $('#bkSys')?.addEventListener('input',e=>{ I.meta.system=e.target.value; bkOk(); }); $('#bkAt')?.addEventListener('input',e=>{ I.meta.extractAt=e.target.value; bkOk(); }); $('#bkComplete')?.addEventListener('change',e=>{ I.meta.complete=e.target.checked; bkOk(); });\n  $('#impCancel')?.addEventListener('click',()=>{ UI.imp={step:1,type:I.type,rows:null,head:null,name:'',map:{},act:{},result:null}; renderView(true); });")
rep("'</li>').join('')+'</ol>'+body;","'</li>').join('')+'</ol>'+(I.step>1&&I.step<5?'<div class=\"row\"><button class=\"btn ghost sm\" type=\"button\" id=\"impCancel\">Avbryt og start på nytt</button></div>':'')+body;")
# I Data og oppsett
rep("['import','Import'],","['import','Import'],['teknisk','Teknisk status'],['kilder','Kunnskapskilder',bookingsAll().filter(b=>!b.orgId).length+KB.dupPairs().length],")
rep("  if(sec==='generelt') body=","  if(sec==='kilder') body=kbSourcesHTML();\n  else if(sec==='teknisk') body=enrTechHTML();\n  else if(sec==='generelt') body=")
rep("  if(UI.dsec==='import') wireImport(v);","  if(UI.dsec==='import') wireImport(v);\n  if(UI.dsec==='teknisk') enrTechWire(v);\n  if(UI.dsec==='kilder') wireKbSources(v);")
rep("<button class=\"btn sm\" type=\"button\" data-kgo=\"epost\">Skriv e-post</button></div>')","<button class=\"btn sm\" type=\"button\" data-kgo=\"epost\">Skriv e-post</button><button class=\"btn sm\" type=\"button\" data-knopen=\"kunde:'+esc(id)+'\">Innsikt om kunden</button></div>')")
rep("window.__salong={S,UI,SYNC,openOrg,orgs,openDeal:id=>openDrawer('deal',id)};","window.__salong={S,UI,SYNC,KB,openOrg,orgs,kbCalcHTML,openDeal:id=>openDrawer('deal',id)};")
# ---------- leveranse 2: team, ansvar og tildeling ----------
import os as _os
if _os.path.exists('team.js'):
  rep("syncProfiles(); renderNav(); renderView(); renderDrawer(); resolvePeople(); });","syncProfiles(); renderNav(); renderView(); renderDrawer(); resolvePeople(); renderTeamBar(); if(UI.asg&&UI.asg.state!=='busy'&&!document.querySelector('#modal-root').contains(document.activeElement)) renderAssign(); });")
  rep("by:me.id||null,byName:me.name||''","by:me.id||null,byName:me.name||'',...actorStamp()")
  rep("if(pred(a)&&a.type!=='task'&&(!m||a.at>m)) m=a.at;","if(pred(a)&&a.type!=='task'&&!a.handover&&!a.derived&&(!m||a.at>m)) m=a.at;")
  rep("const whoName=(id,name)=>people[id]?.name||name||(id&&id===me.id?me.name:'')||'';","const whoName=(id,name)=>{ const m=ownRef(id); return m?m.name:(people[id]?.name||name||(id&&id===me.id?me.name:'')||''); };")
  rep("const ids=[...new Set([...deals().map(d=>d.ownerId),...acts().map(a=>a.byId)].filter(Boolean))];","const ids=[...new Set([...deals().map(d=>d.ownerId),...acts().map(a=>a.byId),...members(true).map(m=>m.accountId)].filter(x=>x&&!String(x).startsWith('m-')))];")
  rep("...(a.type==='task'?{ownerId:a.ownerId||me.id||null,ownerName:a.ownerName||me.name||'',","...(a.type==='task'?{ownerId:a.ownerId!==undefined?(a.ownerId||null):taskDefOwner(a.dealId),")
  rep("source:'inbound',ownerId:me.id||null,lostReason:'',notes:[f.needs","source:'inbound',ownerId:(actor()||{}).id||null,lostReason:'',notes:[f.needs")
  rep("recurring:1,source:'outbound',ownerId:me.id||null,lostReason:'',notes:''};","recurring:1,source:'outbound',ownerId:(actor()||{}).id||null,lostReason:'',notes:''};")
  # pipeline
  rep("ds=deals().filter(d=>(!UI.mine||d.ownerId===me.id)&&match(q,d.title,orgName(d.orgId),roomName(d.room))), now=Date.now();","ds=deals().filter(d=>ownMatch(d.ownerId)&&match(q,d.title,orgName(d.orgId),roomName(d.room))), now=Date.now();")
  i=src.index("return '<div class=\"filters\"><div class=\"seg\" role=\"group\" aria-label=\"Vis saker\">"); j=src.index("<span class=\"note\">Dra et kort til et nytt steg.",i)
  src=src[:i]+"return '<div class=\"filters\">'+ownFilterHTML('Vis saker etter saksansvarlig')+'"+src[j:]
  rep("'</b>'+personHTML(d.ownerId)+'</div>'+","'</b>'+ownChip(d.ownerId,d.ownerName)+'</div>'+")
  rep("  v.querySelectorAll('[data-mine]').forEach(b=>b.addEventListener('click',()=>{ UI.mine=b.dataset.mine==='1'; renderView(true); }));","  wireOwnFilter(v,()=>renderView(true));")
  # I dag
  rep("const tasks=openTasks().filter(t=>t.due), overdue=","const tasks=openTasks().filter(t=>t.due&&ownMatch(t.ownerId)), overdue=")
  rep("const ny=ds.filter(d=>d.stage==='ny').sort(","const ny=ds.filter(d=>d.stage==='ny'&&ownMatch(d.ownerId)).sort(")
  rep("const stale=ds.filter(d=>OPEN.includes(d.stage)&&d.stage!=='ny').map(","const stale=ds.filter(d=>OPEN.includes(d.stage)&&d.stage!=='ny'&&ownMatch(d.ownerId)).map(")
  rep("<header><h2 id=\"qH\">Arbeidskø</h2><span class=\"sub\">Det som krever handling</span></header>'+","<header><h2 id=\"qH\">Arbeidskø</h2><span class=\"sub\">Det som krever handling</span></header>'+ownFilterHTML('Vis arbeidskø etter ansvarlig')+")
  rep("<div class=\"t\">'+esc(t.text)+'</div><div class=\"s\">'+esc(orgName(t.orgId))+'</div></div><span class=\"due'+(over?' over':'')+'\">'+(over?'Forfalt · ':'')","<div class=\"t\">'+esc(t.text)+'</div><div class=\"s\">'+esc(orgName(t.orgId))+' · '+esc(ownName(t.ownerId,t.ownerName))+'</div></div><span class=\"due'+(over?' over':'')+'\">'+(over?'Forfalt · ':'')")
  rep("grp('Nye forespørsler',ny.length,ny.length?ny.map(d=>{ const h=(now-new Date(d.createdAt||now))/36e5; return '<div class=\"li q\" data-open=\"deal:'+d.id+'\"><span class=\"dot\" style=\"--c:var(--violet)\"></span><div><div class=\"t\">Svar: '+esc(d.title)+'</div><div class=\"s\">'+esc(orgName(d.orgId))+' · '+esc(roomName(d.room))+'</div></div>","grp('Nye forespørsler',ny.length,ny.length?ny.map(d=>{ const h=(now-new Date(d.createdAt||now))/36e5; return '<div class=\"li q\" data-open=\"deal:'+d.id+'\"><span class=\"dot\" style=\"--c:var(--violet)\"></span><div><div class=\"t\">Svar: '+esc(d.title)+'</div><div class=\"s\">'+esc(orgName(d.orgId))+' · '+esc(roomName(d.room))+' · '+esc(ownName(d.ownerId,d.ownerName))+'</div></div>")
  # Kunder
  rep("&&(!K.due||r.stale)&&match(q,r.name,r.segment,r.notes,","&&(!K.due||r.stale)&&ownMatch(r.ownerId)&&match(q,r.name,r.segment,r.notes,")
  rep("'<button type=\"button\" class=\"tgl\" id=\"kDue\" aria-pressed=\"'+K.due+'\">Uten dialog siste 30 dager</button>'+","'<button type=\"button\" class=\"tgl\" id=\"kDue\" aria-pressed=\"'+K.due+'\">Uten dialog siste 30 dager</button>'+ownFilterHTML('Vis kunder etter kundeansvarlig')+")
  rep("th('name','Organisasjon')+th('st','Status')+","th('name','Organisasjon')+th('st','Status')+'<th>Kundeansvarlig</th>'+")
  rep("'</span></td><td>'+statusChip(r.st)+'</td><td class=\"n\">'+(r.spend?short(r.spend)","'</span></td><td>'+statusChip(r.st)+'</td><td>'+ownChip(r.ownerId,r.ownerName)+'</td><td class=\"n\">'+(r.spend?short(r.spend)")
  rep("  $('#kDue').addEventListener('click',()=>{ K.due=!K.due; rr(); });","  $('#kDue').addEventListener('click',()=>{ K.due=!K.due; rr(); }); wireOwnFilter(v,rr);")
  # kundekort: kundeansvarlig i hodet, ansvarlig i oppgavelisten
  rep("    '<div class=\"row kc-act\"><button class=\"btn primary sm\" type=\"button\" data-kgo=\"aktivitet\">Logg samtale</button>","    ownRow('org',id)+'<div class=\"row kc-act\"><button class=\"btn primary sm\" type=\"button\" data-kgo=\"aktivitet\">Logg samtale</button>")
  rep("<input type=\"checkbox\" data-kdone=\"'+t.id+'\"><div><div class=\"t\">'+esc(t.text)+'</div></div>'","<input type=\"checkbox\" data-kdone=\"'+t.id+'\"><div><div class=\"t\">'+esc(t.text)+'</div><div class=\"s\">'+esc(ownName(t.ownerId,t.ownerName))+'</div></div>'")
  # sakshode
  rep("<span class=\"note\">'+(isNew?'Ikke lagret':esc(SOURCES[d.source]||'')+' · opprettet '+esc(fd(d.createdAt)))+'</span></div><button class=\"x\" type=\"button\" aria-label=\"Lukk\">×</button></header>'+","<span class=\"note\">'+(isNew?'Ikke lagret':esc(SOURCES[d.source]||'')+' · opprettet '+esc(fd(d.createdAt)))+'</span>'+(isNew?'':ownRow('deal',D.id))+'</div><button class=\"x\" type=\"button\" aria-label=\"Lukk\">×</button></header>'+")
  # saksskjema: ansvarlig velges ved opprettelse, ellers endres den med «Tildel» i hodet
  i=src.index("    '<div class=\"f\"><span>Ansvarlig</span><div class=\"row\" style=\"min-height:36px\">'+(d.ownerId?personHTML(d.ownerId)"); j=src.index("\n",i)
  src=src[:i]+"    (isNew?'<label class=\"f\"><span>Saksansvarlig</span><select class=\"in\" id=\"dOwner\">'+ownOpts(d.ownerId||'')+'</select></label>':'')+"+src[j:]
  rep("  $('#takeIt')?.addEventListener('click',()=>{ d.ownerId=me.id;","  $('#dOwner')?.addEventListener('change',e=>{ d.ownerId=e.target.value||null; });\n  $('#takeIt')?.addEventListener('click',()=>{ d.ownerId=me.id;")
  # saksbildet: ingen overtakelse som flytter alle oppgaver. Bruk dialogen.
  i=src.index("(k==='pers'&&me.id&&!mine?'<div class=\"cp-take\">'"); j=src.index("+'</details>'; };",i)
  src=src[:i]+"(k==='pers'?'<div class=\"cp-take\">'+assignBtns('deal',D.id)+'</div>':'')"+src[j:]
  i=src.index("  root.querySelectorAll('[data-ctake]').forEach("); j=src.index("toast('Du er nå ansvarlig for saken'); renderDrawer(true); }));",i)+len("toast('Du er nå ansvarlig for saken'); renderDrawer(true); }));")
  src=src[:i]+src[j:]
  rep("function taskRow(a,now){ const over=a.due&&new Date(a.due)<now, own=whoName(a.ownerId||a.byId,a.ownerName||a.byName);","function taskRow(a,now){ const over=a.due&&new Date(a.due)<now, own=ownName(a.ownerId,a.ownerName);")
  rep("<div class=\"s\">Ansvarlig: '+esc(own||'ikke registrert')+' · '","<div class=\"s\">Oppgaveansvarlig: '+esc(own)+' · '")
  rep("Object.entries(CWAIT).map(([k,n])=>'<option value=\"'+k+'\"'+(a.wait===k?' selected':'')+'>'+n+'</option>').join('')+'</select></div>'; }","Object.entries(CWAIT).map(([k,n])=>'<option value=\"'+k+'\"'+(a.wait===k?' selected':'')+'>'+n+'</option>').join('')+'</select>'+taskOwnSel(a)+'</div>'; }")
  rep("esc(whoName(nextT.ownerId||nextT.byId,nextT.ownerName||nextT.byName)||'ansvarlig ikke registrert')","esc(ownName(nextT.ownerId,nextT.ownerName))")
  rep("(owner?'ansvarlig '+esc(owner):'<span class=\"cp-why\">ingen ansvarlig</span>')","(d.ownerId?'saksansvarlig '+esc(ownName(d.ownerId,d.ownerName)):'<span class=\"cp-why\">ufordelt</span>')")
  rep("P('pers','owner','Ansvarlig hos oss',d.ownerId||'',whoName(d.ownerId,d.ownerName)||'Kollega, navn ikke hentet',{go:'owner'});","P('pers','owner','Saksansvarlig hos oss',d.ownerId||'',ownName(d.ownerId,d.ownerName),{go:'owner'});")
  # ny oppgave: ansvarlig foreslås, men kan velges
  rep("Object.entries(CWAIT).map(([k,n])=>'<option value=\"'+k+'\"'+(D.actWait===k?' selected':'')+'>'+n+'</option>').join('')+'</select>':'')+'<button class=\"btn\" type=\"button\" id=\"actAdd\">Legg til</button>","Object.entries(CWAIT).map(([k,n])=>'<option value=\"'+k+'\"'+(D.actWait===k?' selected':'')+'>'+n+'</option>').join('')+'</select><select class=\"in fsel\" id=\"actOwner\" aria-label=\"Oppgaveansvarlig\">'+ownOpts(D.actOwner!==undefined?D.actOwner:(taskDefOwner(D.kind==='deal'?D.id:null)||''))+'</select>':'')+'<button class=\"btn\" type=\"button\" id=\"actAdd\">Legg til</button>")
  rep("  $('#actWait')?.addEventListener('change',e=>{ D.actWait=e.target.value; });","  $('#actWait')?.addEventListener('change',e=>{ D.actWait=e.target.value; });\n  $('#actOwner')?.addEventListener('change',e=>{ D.actOwner=e.target.value; });")
  rep("wait:D.actType==='task'?(D.actWait||''):undefined}); D.actText=''; D.actDue='';","wait:D.actType==='task'?(D.actWait||''):undefined,...(D.actType==='task'&&D.actOwner!==undefined?{ownerId:D.actOwner||null}:{})}); D.actText=''; D.actDue=''; D.actOwner=undefined;")
  # tidslinje: overlevering viser hvem som ga fra seg og hvem som tok over, med navn slått opp nå
  rep("esc(a.text)+(a.example?' '+exChip:'')+'</p>","esc(a.text)+(a.handover?' <span class=\"meta\">'+esc(ownName(a.handover.from))+' → '+esc(ownName(a.handover.to))+'</span>':'')+(a.example?' '+exChip:'')+'</p>")
  # endringslogg: navn slås opp fra ID, og profilen vises ved siden av kontoen
  rep("'<li><div><b>'+esc(a.byName||'Ukjent bruker')+'</b> '+esc(a.action)+' '+esc(({orgs:'kontakten',deals:'saken',offers:'tilbudet'})[a.col]||'')","'<li><div><b>'+esc(a.byName||'Ukjent bruker')+'</b>'+audWho(a)+' '+esc(a.action)+' '+esc(({orgs:'for kontakten',deals:'for saken',offers:'for tilbudet',acts:'for oppgaven'})[a.col]||'')+(a.col==='acts'&&S.acts[a.entityId]?' «'+esc(S.acts[a.entityId].text.slice(0,60))+'»':'')")
  rep("'</td><td class=\"old\">'+esc(c.old.replace(/^\"|\"$/g,'')||'Tom')+'</td><td>→</td><td>'+esc(c.new.replace(/^\"|\"$/g,'')||'Tom')+'</td></tr>'","'</td><td class=\"old\">'+esc(audVal(c.f,c.old))+'</td><td>→</td><td>'+esc(audVal(c.f,c.new))+'</td></tr>'")
  # Data og oppsett
  rep("['integrasjoner','Integrasjoner'],","['team','Team og ansvar'],['integrasjoner','Integrasjoner'],")
  rep("  if(sec==='kilder') body=kbSourcesHTML();","  if(sec==='team') body=teamHTML();\n  else if(sec==='kilder') body=kbSourcesHTML();")
  rep("  if(UI.dsec==='kilder') wireKbSources(v);","  if(UI.dsec==='kilder') wireKbSources(v);\n  if(UI.dsec==='team') wireTeam(v);")
  rep("window.__salong={S,UI,SYNC,KB,openOrg,orgs,kbCalcHTML,","window.__salong={S,UI,SYNC,KB,openOrg,orgs,kbCalcHTML,members,actor,doAssign,ownName,mkEval:(typeof mkEval==='function'?mkEval:null),mkGeneric:(typeof mkGeneric==='function'?mkGeneric:null),")
# Prospekter: målmarked, nye samlinger i eksport og testkrok
rep("prospects:S.prospects,audit:S.audit,","prospects:S.prospects,mtacc:S.mtacc,mtper:S.mtper,mtbat:S.mtbat,mtsnap:S.mtsnap,mtq:S.mtq,mtjob:S.mtjob,audit:S.audit,")
rep("window.__salong={S,UI,SYNC,KB,","window.__salong={IDX:(typeof IDX!=='undefined'?IDX:null),MT:(typeof MT!=='undefined'?MT:null),mtOpen:(typeof mtOpen!=='undefined'?mtOpen:null),S,UI,SYNC,KB,")
# kalender: importerte bookinger vises sammen med sakene
if _os.path.exists('cal2.js'):
  rep("for(const d of deals()) if(d.date&&d.room&&d.stage!=='tapt') (map[d.room+'|'+d.date]=map[d.room+'|'+d.date]||[]).push(d);","for(const d of calEntries()) (map[d.room+'|'+d.date]=map[d.room+'|'+d.date]||[]).push(d);")
  rep("(top?': '+orgName(top.orgId)+', '+ST[top.stage].n:': ingen sak i Salong'))","(top?': '+top.label+', '+ST[top.stage].n+(top.kind==='booking'?', importert booking':''):': ingenting registrert i Salong'))")
  rep("'<span class=\"bk '+top.stage+'\">'+esc(short1(orgName(top.orgId)))+","'<span class=\"bk '+top.stage+(top.kind==='booking'?' imp':'')+'\">'+esc(short1(top.label))+")
  rep("<span><i class=\"lg we\"></i>Helg</span>","<span><i class=\"lg imp\"></i>Importert booking</span><span><i class=\"lg we\"></i>Helg</span>")
  rep("'<p class=\"note\">Kalenderen viser sakene i Salong. Faste bookinger fra bookingsystemet kan importeres under Data og oppsett.</p>';","'<p class=\"note\">Kalenderen viser saker i Salong og importerte bookinger. Den er ikke koblet til bookingsystemet og viser ikke ledighet.</p>';")
# dataopprinnelse: navigasjonsmerker teller bare brukerregistrerte data
rep("const due=openTasks().filter(t=>t.due&&new Date(t.due)<=now).length; const ny=deals().filter(d=>d.stage==='ny').length;","const due=openTasksOp().filter(t=>t.due&&new Date(t.due)<=now).length; const ny=dealsOp().filter(d=>d.stage==='ny').length;")
rep("['kilder','Kunnskapskilder',","['status','Datastatus',dqReview().length],['kilder','Kunnskapskilder',")
rep("  else if(sec==='kilder') body=kbSourcesHTML();","  else if(sec==='status') body=dqStatusHTML();\n  else if(sec==='kilder') body=kbSourcesHTML();")
rep("  if(UI.dsec==='kilder') wireKbSources(v);","  if(UI.dsec==='kilder') wireKbSources(v);\n  if(UI.dsec==='status') wireDq(v);")
# sidenivå: data-v for sidespesifikk stil, og Ny sak er sekundær når siden har en annen primærhandling
rep("  const fn=V[UI.view]; v.innerHTML=fn.html(); fn.wire&&fn.wire(v);","  v.dataset.v=UI.view; document.body.dataset.v=UI.view; const nd=$('#newDeal'); if(nd) nd.classList.toggle('primary',['pipeline','innboks'].includes(UI.view));\n  const fn=V[UI.view]; v.innerHTML=fn.html(); fn.wire&&fn.wire(v);")
# dataslag: put/hardDel/saveSettings er nå den private lokale adapteren; localStorage nås bare via storeLocal
rep("  const prev=S[col][id], now=iso(new Date());\n  const doc={...obj,rev:","  storeCount(col); const prev=S[col][id], now=iso(new Date());\n  const doc={...obj,rev:")
rep("  S[col][id]=doc; DV++;\n  const D=UI.drawer;","  S[col][id]=doc; DV++; storeNotify(col,id,prev,doc);\n  const D=UI.drawer;")
rep("async function hardDel(col,id){ if(readOnly) return false; delete S[col][id];","async function hardDel(col,id){ if(readOnly) return false; storeCount(col); const _pv=S[col][id]; delete S[col][id]; storeNotify(col,id,_pv,null);")
rep("overlayQueue(col); DV++; render(); },e=>dbErr(e)); }","overlayQueue(col); DV++; storeSnap(col); render(); },e=>dbErr(e)); }")
rep("async function saveSettings(obj){\n  S.settings={...S.settings,...obj}; render();","async function saveSettings(obj){\n  storeCount('settings'); S.settings={...S.settings,...obj}; render();")
rep("localStorage.setItem('salong-outbox',JSON.stringify(q)); else localStorage.removeItem('salong-outbox');","storeLocal('set','outbox',JSON.stringify(q)); else storeLocal('remove','outbox');")
rep("JSON.parse(localStorage.getItem('salong-outbox')||'[]')","JSON.parse(storeLocal('get','outbox')||'[]')")
rep("try{ localStorage.setItem('salong-view',v); }catch(e){}","storeLocal('set','view',v);")
rep("try{ const v=localStorage.getItem('salong-view'); if(v&&V[v]) UI.view=v; }catch(e){}","{ const v=storeLocal('get','view'); if(v&&V[v]) UI.view=v; }")
rep("window.__salong={IDX:","window.__salong={ENR:(typeof ENR!=='undefined'?ENR:null),enrKick:(typeof enrKick!=='undefined'?enrKick:null),mtEligibility:(typeof mtEligibility!=='undefined'?mtEligibility:null),mtPick:(typeof mtPick!=='undefined'?mtPick:null),enrProgress:(typeof enrProgress!=='undefined'?enrProgress:null),crm:(typeof crm!=='undefined'?crm:null),PL:(typeof planningService!=='undefined'?planningService:null),ES:(typeof enrichmentService!=='undefined'?enrichmentService:null),REPOS:(typeof accountRepository!=='undefined'?{accountRepository,contactRepository,activityRepository,caseRepository,batchRepository,enrichmentJobRepository,goalRepository}:null),STORE:(typeof STORE!=='undefined'?STORE:null),bus:(typeof bus!=='undefined'?bus:null),IDX:")
# nye moduler
rep("window.__salong={ENR:","window.__salong={TIER:(typeof tierSet!=='undefined'?{set:tierSet,stats:tierStats,enrollMany:tierEnrollMany,due:tsDue,eco:stratEco,effort:stratEffort,csv:stratCsv,parse:tsParse,imp:tsImport,cfg:tierCfg,save:tierSave,draft:tierDraft,venues:stratVenues,budget:tierBudget,phase:tierPhase}:null),ENR:")
rep("window.__salong={TIER:","window.__salong={CD:(typeof cdUnderstand!=='undefined'?{understand:cdUnderstand,score:cdScore,rank:cdRank,tune:CD_TUNE,general:cdGeneral}:null),ES2:(typeof enrPipeline!=='undefined'?{pipeline:enrPipeline,runAll:enrRunAll,targets:enrTargets,runInfo:enrRunInfo,derive:enrDerive,wf:wfStepOf,web:WebResearchProvider,apollo:ApolloProvider,advance:enrAdvance,states:ENR_ST,flow:ENR_FLOW,runJob:enrRunJob}:null),TIER:")
# Delte research-moduler (src/research/*.js) er vanlige CommonJS-moduler som serveren gjør require() på.
# I bunten pakkes hver modul i en funksjon med egen module/require, og det den eksporterer gjøres tilgjengelig
# som navn i frontendens felles scope. Rekkefølgen følger avhengighetene. Ingen annen kode trenger å vite om dette.
RMODS=['rules','events','method','pipeline']
def wrap_module(name,known):
  code=rd('research/'+name+'.js')
  m=re.search(r"module\.exports\s*=\s*\{([^}]*)\}\s*;?\s*$",code)
  assert m,'research/'+name+'.js mangler «module.exports = { ... };» til slutt'
  names=[x.strip() for x in m.group(1).split(',') if x.strip()]
  assert all(re.fullmatch(r"[A-Za-z_$][\w$]*",x) for x in names),'research/'+name+'.js: eksporter bare rene navn'
  for dep in re.findall(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)",code):
    assert re.fullmatch(r"\./[\w-]+(\.js)?",dep),'research/'+name+'.js kan bare kreve ./<modul> i samme mappe, ikke '+dep
    assert re.sub(r"^\./|\.js$","",dep) in known,'research/'+name+'.js krever '+dep+' som ikke er pakket før den'
  req='const require=p=>({'+','.join("'./%s':__rm_%s,'./%s.js':__rm_%s"%(k,k,k,k) for k in known)+'})[p];'
  return 'const __rm_'+name+'=(function(){ const module={exports:{}}; '+req+'\n'+code+'\nreturn module.exports; })();\nconst {'+', '.join(names)+'}=__rm_'+name+';'
rmods=[]
for n in RMODS: rmods.append(wrap_module(n,RMODS[:RMODS.index(n)]))
tail="window.__salong="
i=src.index(tail); src=src[:i]+'\n'.join(rmods)+'\n'+'\n'.join(rd(f) for f in MODS)+'\n'+src[i:]
head=rd('head.html'); j=head.rfind('</style>'); head=head[:j]+''.join(rd(f) for f in CSS)+head[j:]
os.makedirs('../dist',exist_ok=True)
frag=head+rd('body.html')+'<script>\n'+src+'\n</script>\n'
open('../dist/app.js','w').write(src)
open('../dist/salong.html','w').write(frag)
open('../dist/index.html','w').write('<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+frag+'</body></html>')
print('bygget',len(src))
