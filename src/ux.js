/* ---------- Kunder: tydeligere liste, eier og tildeling i listen ---------- */
STATUS.fast[1]='stt fast'; STATUS.kunde[1]='stt kunde'; STATUS.prospekt[1]='stt prospekt';
tierChip=function(t){ return t?'<span class="tier" title="Prioritet '+esc(t)+'" aria-label="Prioritet '+esc(t)+'">'+esc(t)+'</span>':''; };
UI.ku.sel=new Set(); UI.ku.bulkTo='__'; UI.ku.bulkBusy=false; UI.ku.bulkMsg='';
function kuRows(){ const K=UI.ku, q=UI.q, ds=deals(), {m,Y}=moneyMap(), why=Object.fromEntries(prospects().map(p=>[p.id,p]));
  let all=allOrgs().map(o=>{ const st=orgStatus(o.id), od=ds.filter(d=>d.orgId===o.id), mm=m[o.id], la=lastAct(a=>a.orgId===o.id), next=openTasks().find(t=>t.orgId===o.id), openD=od.filter(d=>OPEN.includes(d.stage));
    return {...o,st,la,next,stale:st!=='prospekt'&&!openD.length&&(!la||(Date.now()-new Date(la))>30*864e5),open:openD.length,openVal:openD.reduce((a,d)=>a+dval(d),0),spend:mm?(mm.ys[Y-1]||0):0,hint:(why[o.id]?.why||[]).filter(w=>!/Fast leietaker|Har leid før/.test(w))}; });
  const cnt={alle:all.length,kunder:all.filter(r=>r.st!=='prospekt').length,fast:all.filter(r=>r.st==='fast').length,prospekt:all.filter(r=>r.st==='prospekt').length};
  const base=all.filter(r=>(K.st==='alle'||(K.st==='kunder'?r.st!=='prospekt':r.st===K.st))&&(K.tier==='all'||r.tier===K.tier)&&(!K.seg||r.segment===K.seg)&&(!K.due||r.stale)&&match(q,r.name,r.segment,r.notes,...(r.contacts||[]).map(c=>c.name+' '+c.email)));
  const rows=base.filter(r=>ownMatch(r.ownerId)), sk=K.sort.k, dir=K.sort.dir, ord={fast:0,kunde:1,prospekt:2};
  const key={name:r=>r.name.toLowerCase(),st:r=>ord[r.st]+r.name.toLowerCase(),own:r=>(r.ownerId?ownName(r.ownerId):'~')+r.name.toLowerCase(),tier:r=>(r.tier||'Z')+r.name.toLowerCase(),spend:r=>r.spend,la:r=>r.la||'',next:r=>r.next?.due||'9',open:r=>r.openVal};
  rows.sort((a,b)=>{ const x=(key[sk]||key.name)(a), y=(key[sk]||key.name)(b); return (x>y?1:x<y?-1:0)*dir; });
  return {rows,base,cnt,Y}; }
function kunderHTML(){
  const K=UI.ku, {rows,base,cnt,Y}=kuRows(), sk=K.sort.k, dir=K.sort.dir, now=Date.now(), can=!readOnly;
  for(const id of [...K.sel]) if(!rows.some(r=>r.id===id)) K.sel.delete(id);
  const th=(k,n,c)=>'<th data-ksort="'+k+'" tabindex="0" role="columnheader"'+(c?' class="'+c+'"':'')+(sk===k?' aria-sort="'+(dir>0?'ascending':'descending')+'"':'')+'>'+n+'</th>';
  const unass=base.filter(r=>!r.ownerId).length, openN=rows.filter(r=>r.open).length, openV=rows.reduce((a,r)=>a+r.openVal,0), stale=rows.filter(r=>r.stale).length, allSel=rows.length>0&&rows.every(r=>K.sel.has(r.id));
  const tile=(k,v,s,cls,act)=>'<div class="ku-t'+(cls?' '+cls:'')+'"><dt>'+k+'</dt><dd>'+v+'</dd>'+(s?'<small>'+s+'</small>':'')+(act||'')+'</div>';
  const row=r=>{ const over=r.next&&r.next.due&&new Date(r.next.due)<now;
    return '<tr data-korg="'+esc(r.id)+'" tabindex="0"'+(K.sel.has(r.id)?' class="sel"':'')+'>'+(can?'<td class="ck"><input type="checkbox" data-ksel="'+esc(r.id)+'"'+(K.sel.has(r.id)?' checked':'')+' aria-label="Velg '+esc(r.name)+'"></td>':'')+
     '<td class="org"><span class="on">'+esc(r.name)+'</span>'+tierChip(r.tier)+'<span class="sub2">'+esc(r.segment||'Uten segment')+'</span></td>'+
     '<td>'+statusChip(r.st)+'</td>'+
     '<td class="own-c">'+(can?'<select class="ownsel'+(r.ownerId?'':' none')+'" data-kown="'+esc(r.id)+'" data-kownx="'+esc(r.ownerId||'')+'" aria-label="Kundeansvarlig for '+esc(r.name)+'">'+ownOpts(r.ownerId||'')+'</select>':ownChip(r.ownerId,r.ownerName))+'</td>'+
     '<td class="nx">'+(r.next?'<span class="nx-a'+(over?' over':'')+'">'+esc(r.next.text)+'</span><span class="sub2">'+(r.next.due?(over?'Forfalt ':'Frist ')+esc(fd(r.next.due,{day:'numeric',month:'short'})):'Ingen frist')+' · '+esc(ownName(r.next.ownerId,r.next.ownerName))+'</span>':r.hint.length?'<span class="sub2">'+esc(r.hint.slice(0,2).join(' · '))+'</span>':'<span class="sub2">Ingen planlagt</span>')+'</td>'+
     '<td class="n num">'+(r.open?'<b>'+r.open+'</b><span class="sub2">'+short(r.openVal)+' kr</span>':'<span class="sub2">0</span>')+'</td>'+
     '<td class="n num dim">'+(r.spend?short(r.spend):'<span class="sub2">Ingen</span>')+'</td>'+
     '<td class="dim">'+(r.la?esc(ago(r.la)):'<span class="sub2'+(r.stale?' warn':'')+'">Ingen registrert</span>')+'</td></tr>'; };
  return '<div class="ku"><dl class="ku-kpi">'+tile('Organisasjoner',rows.length,K.st==='alle'?cnt.kunder+' kunder · '+cnt.prospekt+' prospekter':'i dette utvalget')+tile('Åpne saker',openN,openN?short(openV)+' kr i åpne saker':'ingen åpne saker')+tile('Forbruk '+(Y-1),short(rows.reduce((a,r)=>a+r.spend,0)),'bekreftede saker og importerte bookinger')+tile('Uten dialog 30 dager',stale,stale?'kunder uten åpen sak':'alle er fulgt opp',stale?'warn':'')+tile('Ufordelte',unass,unass?'uten kundeansvarlig':'alle har kundeansvarlig',unass?'warn':'',unass&&UI.own!=='ufordelt'?'<button type="button" class="lnk" data-own="ufordelt">Vis dem</button>':'')+'</dl>'+
   '<div class="ku-bar"><div class="ku-row"><div class="seg" role="group" aria-label="Status">'+[['kunder','Kunder'],['fast','Faste'],['prospekt','Prospekter'],['alle','Alle']].map(([k,n])=>'<button type="button" data-kst="'+k+'" aria-pressed="'+(K.st===k)+'">'+n+' <span class="s">'+cnt[k]+'</span></button>').join('')+'</div><span class="ku-lbl">Kundeansvarlig</span>'+ownFilterHTML('Vis kunder etter kundeansvarlig')+'<button class="btn primary" type="button" id="newOrg">'+svg('<path d="M12 5v14M5 12h14"/>')+'Ny organisasjon</button></div>'+
    '<div class="ku-row sec"><div class="seg" role="group" aria-label="Prioritet">'+['all','A','B','C'].map(t=>'<button type="button" data-ktier="'+t+'" aria-pressed="'+(K.tier===t)+'">'+(t==='all'?'Alle prioriteter':t)+'</button>').join('')+'</div><select class="in fsel" id="kSeg" aria-label="Segment"><option value="">Alle segmenter</option>'+SEGMENTS.map(s=>'<option'+(K.seg===s?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select><button type="button" class="tgl" id="kDue" aria-pressed="'+K.due+'">Uten dialog siste 30 dager</button><button type="button" class="tgl" id="kPort" aria-pressed="false">Søk i innhold på tvers av kunder</button></div></div>'+
   (can&&K.sel.size?'<div class="ku-bulk" role="region" aria-label="Massetildeling"><b>'+K.sel.size+' valgt</b><label for="kBulkTo">Sett kundeansvarlig til</label><select class="in fsel" id="kBulkTo">'+ownOpts(K.bulkTo,'Velg')+'</select><button class="btn primary sm" type="button" id="kBulkGo"'+(K.bulkTo==='__'||K.bulkBusy?' disabled':'')+'>'+(K.bulkBusy?'Tildeler …':'Tildel valgte')+'</button><button class="btn ghost sm" type="button" id="kBulkNo">Fjern valg</button><span class="note">Saker og oppgaver endres ikke. Tildeling endrer ikke tilgang.</span></div>':'')+
   (K.bulkMsg?'<div class="notice info" role="status">'+K.bulkMsg+' <button type="button" class="lnk" id="kBulkMsgX">Lukk</button></div>':'')+
   '<div class="tbl sticky ku-tbl"><table class="ktbl k2"><thead><tr>'+(can?'<th class="ck"><input type="checkbox" id="kSelAll"'+(allSel?' checked':'')+' aria-label="Velg alle i listen"></th>':'')+th('name','Organisasjon')+th('st','Status')+th('own','Kundeansvarlig')+th('next','Neste steg')+th('open','Åpne saker','n')+th('spend','Forbruk '+(Y-1),'n dim')+th('la','Siste dialog','dim')+'</tr></thead><tbody>'+
   (rows.length?rows.map(row).join(''):'<tr><td colspan="8" class="empty">Ingen treff med disse filtrene.</td></tr>')+'</tbody></table></div>'+
   '<p class="note">Klikk en rad for å åpne kundekortet i sidepanelet. Forbruk er bekreftede saker og importerte bookinger. Tildeling er arbeidsfordeling og endrer ikke hvem som har tilgang.</p></div>';
}
{ const _w=V.kontakter.wire;
  V.kontakter.html=function(){ return UI.ku.port?portHTML():kunderHTML(); };
  V.kontakter.wire=function(v){ _w.call(this,v); if(UI.ku.port) return; const K=UI.ku, rr=()=>renderView(true);
    v.querySelectorAll('th[data-ksort]').forEach(t=>t.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); t.click(); } }));
    v.querySelectorAll('tr[data-korg]').forEach(r=>r.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target===r) openOrg(r.dataset.korg); }));
    v.querySelectorAll('.ck,.own-c').forEach(td=>td.addEventListener('click',e=>e.stopPropagation()));
    v.querySelectorAll('[data-ksel]').forEach(c=>c.addEventListener('change',()=>{ if(c.checked) K.sel.add(c.dataset.ksel); else K.sel.delete(c.dataset.ksel); rr(); }));
    $('#kSelAll')?.addEventListener('change',e=>{ const ids=[...v.querySelectorAll('[data-ksel]')].map(c=>c.dataset.ksel); if(e.target.checked) ids.forEach(i=>K.sel.add(i)); else K.sel.clear(); rr(); });
    v.querySelectorAll('[data-kown]').forEach(s=>s.addEventListener('change',async()=>{ const id=s.dataset.kown, to=s.value||null; s.disabled=true; if(!S.orgs[id]&&PROFILES[id]) await ensureOrg(PROFILES[id]);
      const r=await doAssign({kind:'org',id,to,expect:s.dataset.kownx||null});
      toast(r.ok?(r.saved||r.demo?'Kundeansvarlig er nå '+ownName(to)+'.':'Endringen er ikke bekreftet lagret ennå.')+(r.notice&&r.notice.saved?' Varsel lagret i Salong.':''):r.conflict?'Kunden fikk ny ansvarlig mens du holdt på ('+ownName(r.current.ownerId)+'). Ingenting er overskrevet.':r.busy?'En annen endrer denne kunden akkurat nå. Prøv igjen om litt.':(r.error||'Ansvaret ble ikke endret.')); rr(); }));
    $('#kBulkTo')?.addEventListener('change',e=>{ K.bulkTo=e.target.value; rr(); });
    $('#kBulkNo')?.addEventListener('click',()=>{ K.sel.clear(); K.bulkTo='__'; rr(); });
    $('#kBulkMsgX')?.addEventListener('click',()=>{ K.bulkMsg=''; rr(); });
    $('#kBulkGo')?.addEventListener('click',async()=>{ if(K.bulkTo==='__') return; const ids=[...K.sel], to=K.bulkTo||null; K.bulkBusy=true; rr(); const r=await bulkAssignOrgs(ids,to); K.bulkBusy=false; K.sel.clear(); K.bulkTo='__';
      K.bulkMsg='<b>'+r.ok.length+' '+(r.ok.length===1?'kunde':'kunder')+' har fått '+esc(to?ownName(to):'status ufordelt')+(to?' som kundeansvarlig':'')+'.</b>'+(ids.length-r.ok.length-r.fail.length>0?' '+(ids.length-r.ok.length-r.fail.length)+' hadde samme ansvarlig fra før.':'')+(r.fail.length?' <span class="st-warn">'+r.fail.length+' ble ikke endret: '+r.fail.map(f=>esc((f.name||'kunde')+' '+f.why)).join('; ')+'.</span>':'')+(r.notice===true?' Ett samlet varsel er lagret i Salong.':r.notice===false?' <span class="st-warn">Varselet er ikke bekreftet lagret.</span>':''); rr(); });
  }; }
