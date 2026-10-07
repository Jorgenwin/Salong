/* ---------- Kalender som salgsverktøy ----------
   Belegg per rom og måned, lav belegg markert, ledige perioder og hvem som passer. Bygger på saker og importerte bookinger i Salong.
   Salong kjenner ikke bookingsystemet. «Ledig» betyr uten registrering her, ikke bekreftet ledighet. */
UI.c3={mode:'salg',all:false,sel:null,more:false};
const C3_LOW=.2, C3_OPEN='2027-02', C3_MON=['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
const c3Ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const c3YmLabel=ym=>{ const [y,m]=ym.split('-').map(Number); return C3_MON[m-1]+' '+y; };
const c3Open=k=>{ const v=typeof mpV==='function'?mpV(k):null; return (v&&v.planned_opening)||(RM[k]&&RM[k].nw?C3_OPEN:'0000-00'); };
function c3Months(n){ const d=new Date(); d.setDate(1); return Array.from({length:n||12},(_,i)=>c3Ym(new Date(d.getFullYear(),d.getMonth()+i,1))); }
/* eksempelbelegg i demoen: flere dager med bekreftet og holdt i de nye rommene, slik at varmekartet viser variasjon. Ligger bare i minnet og i visningen, ikke i data. */
function c3Filler(){ if(c3Filler.c) return c3Filler.c; const out=[], pat={solstad:[0,0,3,7,9,8,6,1,3,8,10,7,4],collett:[0,0,6,11,13,12,9,3,5,12,14,11,6],hofmo:[0,0,4,8,10,9,7,2,4,9,11,8,5],bsalong:[0,0,2,5,6,6,4,1,2,6,7,5,3],ambjornsen:[0,0,1,3,4,3,2,0,1,4,4,3,2],valkeapaa:[0,0,2,4,5,4,3,1,2,5,5,4,2]};
  for(const [room,arr] of Object.entries(pat)) arr.forEach((n,mi)=>{ if(!n) return; const days=[]; for(let d=1;d<=31;d++){ const t=new Date(2027,mi,d); if(t.getMonth()!==mi) break; if(t.getDay()!==0&&t.getDay()!==6) days.push(t); } const step=Math.max(1,Math.floor(days.length/n)), off=(room.length*3+mi*2)%Math.max(1,step);
    for(let i=0;i<n;i++){ const t=days[Math.min(days.length-1,off+i*step)]; if(!t) continue; const ds=c3Ym(t)+'-'+String(t.getDate()).padStart(2,'0'); out.push({id:'x:'+room+ds,kind:'booking',orgId:null,label:'Eksempelbelegg',title:'Eksempeldata',room,date:ds,stage:(i%5===4)?'holdt':'bekreftet',value:0,attendees:0,example:true}); } });
  return (c3Filler.c=out); }
{ const _ce=calEntries; calEntries=function(){ const E=_ce.apply(this,arguments); return typeof U3_DEMO!=='undefined'&&U3_DEMO&&UI.incEx?E.concat(c3Filler().filter(f=>!E.some(e=>e.room===f.room&&e.date===f.date))):E; }; }
function c3Levels(){ const m={}, o={}; for(const e of calEntries()){ const k=e.room+'|'+e.date; if(['bekreftet','holdt'].includes(e.stage)){ const l=e.stage==='bekreftet'?2:1; if(!m[k]||l>m[k]) m[k]=l; } else if(['ny','dialog','visning','tilbud'].includes(e.stage)) o[k]=1; } return {m,o}; }
/* én rom og én måned: belagt, holdt, i dialog, ledig og sammenhengende ledige strekk */
function c3Month(room,ym,Lv){ Lv=Lv||c3Levels(); const [y,mo]=ym.split('-').map(Number), n=new Date(y,mo,0).getDate(), closed=ym<c3Open(room); const days=[]; for(let i=1;i<=n;i++){ const w=new Date(y,mo-1,i).getDay(); if(w!==0&&w!==6) days.push(ym+'-'+String(i).padStart(2,'0')); }
  let c=0,h=0,d=0; const runs=[]; let s=null, last=null; const flush=()=>{ if(s){ const a=days.indexOf(s), b=days.indexOf(last); runs.push({from:s,to:last,n:b-a+1}); s=null; } };
  for(const ds of days){ const l=Lv.m[room+'|'+ds]||0, o=Lv.o[room+'|'+ds]||0; if(l===2) c++; else if(l===1) h++; else if(o) d++; if(!l&&!o&&!closed){ if(!s) s=ds; last=ds; } else flush(); } flush();
  const wd=days.length, occ=wd?(c+h)/wd:0; return {room,ym,closed,wd,c,h,d,free:wd-c-h-d,occ,low:!closed&&occ<C3_LOW,runs:runs.filter(r=>r.n>=3).sort((a,b)=>b.n-a.n||a.from.localeCompare(b.from))}; }
const c3Cap=k=>{ const m=String((RM[k]||{}).cap||'').match(/\d+/g); return m?[Number(m[0]),Number(m[m.length-1])]:null; };
function c3Fit(r,room){ if(room==='solstad') return r.fit; const cap=c3Cap(room); if(!cap) return Math.round(r.fit*.7); const att=u3Seg(r.segment).att, h=u3Hist(r), a=h!=null?Math.max(10,h*.8):att[0], b=h!=null?h*1.25:att[1], lo=Math.max(a,cap[0]), hi=Math.min(b,cap[1]); return hi<lo?Math.max(0,100-Math.round(Math.min(Math.abs(a-cap[1]),Math.abs(b-cap[0]))/3)):Math.round(100*(hi-lo)/Math.max(1,b-a)); }
/* hvem passer: har arrangert i samme måned før, nevner måneden i profilen, eller passer rommet i størrelse */
function c3Who(room,ym,n){ const [y,mo]=ym.split('-').map(Number), mon=C3_MON[mo-1], past={}; for(const e of calEntries()){ if(e.stage!=='bekreftet'||!e.orgId||!e.date) continue; const [ey,em]=e.date.split('-').map(Number); if(em===mo&&ey<y) past[e.orgId]=ey; }
  const re=new RegExp('\\b'+mon+'\\b','i');
  return u3Data().rows.filter(r=>!['parkert','bekreftet'].includes(r.rel)&&(!S.orgs[r.id]||dqOk(S.orgs[r.id],'orgs',r.id))).map(r=>{ const fit=c3Fit(r,room), why=[]; let s=fit*.5+r.pot*.2;
      if(past[r.id]){ s+=40; why.push('Arrangerte i '+mon+' '+past[r.id]); } const p=r.profile; if(p&&re.test([p.about,p.angle,...(p.events||[])].join(' '))){ s+=22; why.push('Profilen nevner '+mon); }
      if(r.rel==='tidligere'||r.rel==='aktiv') s+=8; if(fit>=70) why.push('Passer rommet i størrelse'); if(r.rel==='tilbud'||r.rel==='dialog'){ s+=6; why.push(U3_RELN[r.rel]); }
      return {r,s,fit,why}; }).filter(x=>x.why.length).sort((a,b)=>b.s-a.s).slice(0,n||6); }
function c3Segs(room,n){ const cap=c3Cap(room)||[40,320]; return u3White().map(k=>{ const sp=u3Seg(k.seg), lo=Math.max(sp.att[0],cap[0]), hi=Math.min(sp.att[1],cap[1]), ov=hi>=lo?(hi-lo)/Math.max(1,sp.att[1]-sp.att[0]):0; return {k,s:ov*60+k.sf*.3+(1-k.pct)*20}; }).sort((a,b)=>b.s-a.s).slice(0,n||3); }

function c3Switch(){ return '<div class="c3-sw"><div class="seg" role="group" aria-label="Visning">'+[['salg','Salg og belegg'],['grid','Rutenett per dag']].map(([k,n])=>'<button type="button" data-c3mode="'+k+'" aria-pressed="'+(UI.c3.mode===k)+'">'+n+'</button>').join('')+'</div></div>'; }
function c3HTML(){ const K=UI.c3, Lv=c3Levels(), months=c3Months(12), rooms=ROOMS.filter(r=>K.all||r.nw), nw=ROOMS.filter(r=>r.nw);
  if(!K.sel||!RM[K.sel.room]){ const first=months.find(m=>m>=c3Open('solstad'))||months[0]; K.sel={room:'solstad',ym:first}; }
  const cell=(r,ym)=>{ const x=c3Month(r.k,ym,Lv); if(x.closed) return '<td class="c3-c closed"><span title="Åpner '+esc(c3YmLabel(c3Open(r.k)))+'">–</span></td>';
    const p=Math.round(x.occ*100), bg='color-mix(in srgb,var(--accent) '+Math.round(6+Math.min(1,x.occ/.6)*74)+'%,var(--surface))', on=K.sel.room===r.k&&K.sel.ym===ym;
    return '<td class="c3-c'+(x.low?' low':'')+(on?' on':'')+'"><button type="button" data-c3cell="'+r.k+'|'+ym+'" style="background:'+bg+';color:'+(x.occ>.38?'#fff':'var(--ink)')+'" aria-pressed="'+on+'" aria-label="'+esc(r.n+', '+c3YmLabel(ym)+': '+p+' prosent belagt'+(x.low?', lavt belegg':'')+', '+x.c+' bekreftet, '+x.h+' holdt av, '+x.free+' uten registrering av '+x.wd+' hverdager')+'"><b>'+p+' %</b>'+(x.low?'<i>lav</i>':'<i>'+x.c+'+'+x.h+'</i>')+'</button></td>'; };
  const head='<tr><th scope="col" class="c3-rh">Rom</th>'+months.map(m=>'<th scope="col">'+esc(C3_MON[Number(m.slice(5))-1].slice(0,3))+'<span>'+m.slice(2,4)+'</span></th>').join('')+'</tr>';
  const body=rooms.map(r=>'<tr class="'+(r.k==='solstad'?'sol':'')+'"><th scope="row" class="c3-rh"><b>'+esc(r.n)+'</b><span>'+esc(r.cap?r.cap+' pers.':'')+'</span></th>'+months.map(m=>cell(r,m)).join('')+'</tr>').join('');
  const sm=months.map(m=>c3Month('solstad',m,Lv)).filter(x=>!x.closed), next3=sm.slice(0,3), tot=next3.reduce((a,x)=>({u:a.u+x.c+x.h,w:a.w+x.wd}),{u:0,w:0}), holes=next3.reduce((a,x)=>a+x.runs.length,0), lowN=sm.filter(x=>x.low).length, noDate=dealsOp().filter(d=>OPEN.includes(d.stage)&&!d.date).length;
  const kpi=(t,v,s)=>'<div class="c3-k"><span>'+t+'</span><b>'+v+'</b><small>'+s+'</small></div>';
  const [room,ym]=[K.sel.room,K.sel.ym], X=c3Month(room,ym,Lv), who=X.closed?[]:c3Who(room,ym,12), nm=RM[room].n;
  const side='<section class="c3-det" aria-live="polite"><div class="c3-dh"><div><span class="c3-eb">'+(room==='solstad'?'Solstad':'Valgt rom')+'</span><h2>'+esc(nm)+' · '+esc(c3YmLabel(ym))+'</h2></div><button type="button" class="btn ghost sm" data-c3grid="'+ym+'">Se dag for dag</button></div>'+
    (X.closed?'<p class="meta">'+esc(nm)+' åpner '+esc(c3YmLabel(c3Open(room)))+'. Ingen belegg å vise før det.</p>':
    '<div class="c3-chips"><span><b>'+X.c+'</b> bekreftet</span><span><b>'+X.h+'</b> holdt av</span><span><b>'+X.d+'</b> i dialog eller tilbud</span><span class="'+(X.low?'warn':'')+'"><b>'+X.free+'</b> uten registrering av '+X.wd+' hverdager</span></div>'+
    (X.low?'<p class="c3-lowm"><b>Lavt belegg.</b> Under '+Math.round(C3_LOW*100)+' % er bekreftet eller holdt av. Her er det rom for å selge.</p>':'')+
    '<h3>Ledige perioder</h3>'+(X.runs.length?'<ul class="c3-runs">'+X.runs.slice(0,5).map(r=>'<li><b>'+esc(calDay(r.from))+(r.to!==r.from?' til '+esc(calDay(r.to)):'')+'</b><span>'+r.n+' hverdager</span></li>').join('')+'</ul>':'<p class="meta">Ingen strekk på tre hverdager eller mer uten registrering.</p>')+
    '<h3>Hvem passer</h3>'+(who.length?'<ol class="c3-who">'+who.slice(0,K.more?12:4).map(({r,why})=>'<li><div><button type="button" class="lnk c3-nm" data-c3org="'+esc(r.id)+'">'+esc(r.name)+'</button><span class="c3-w">'+esc(why[0])+'</span></div>'+(readOnly?'':'<button type="button" class="btn sm" data-c3ask="'+esc(r.id)+'">Foreslå dato</button>')+'</li>').join('')+'</ol>'+(who.length>4?'<button type="button" class="lnk c3-more" data-c3more="1">'+(K.more?'Vis færre':'Vis '+(who.length-4)+' flere')+'</button>':''):'<p class="meta">Ingen kunder eller prospekter skiller seg ut for denne måneden.</p>')+
    '<p class="meta">Forslagene er Salongs anslag. Sjekk bookingsystemet før du lover en dato.</p>')+'</section>';
  return '<div class="c3">'+c3Switch()+'<div class="c3-kpis">'+kpi('Solstad, neste 3 måneder',tot.w?Math.round(tot.u/tot.w*100)+' %':'–','belagt eller holdt av ('+tot.u+' av '+tot.w+' hverdager)')+kpi('Ledige strekk',String(holes),'på tre hverdager eller mer')+kpi('Måneder med lavt belegg',String(lowN),'av '+sm.length+', under '+Math.round(C3_LOW*100)+' %')+'</div>'+(noDate?'<p class="c3-warn">'+noDate+' åpne '+(noDate>1?'saker mangler':'sak mangler')+' dato og kan ikke fylle ledige dager før dato er avklart.</p>':'')+
    '<div class="c3-g"><section class="c3-heat"><div class="c3-hh"><div><h2>Belegg de neste tolv månedene</h2><p class="note">Andel hverdager med bekreftet eller holdt av dato. Klikk en måned for ledige perioder og hvem som passer.</p></div><div class="seg" role="group" aria-label="Rom"><button type="button" data-c3all="0" aria-pressed="'+!K.all+'">Nye rom</button><button type="button" data-c3all="1" aria-pressed="'+K.all+'">Alle rom</button></div></div>'+
    '<div class="c3-tw"><table class="c3-t"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div><div class="legend c3-lg"><span><i class="c3-sw" style="background:color-mix(in srgb,var(--accent) 80%,var(--surface))"></i>Høyt belegg</span><span><i class="c3-sw" style="background:color-mix(in srgb,var(--accent) 12%,var(--surface))"></i>Lavt belegg</span><span><i class="c3-sw low"></i>Under '+Math.round(C3_LOW*100)+' %, merket «lav»</span><span><i class="c3-sw closed"></i>Ikke åpnet</span></div><p class="note c3-bk">Basert på saker og importerte bookinger i Salong. Bookingsystemet er ikke koblet til.</p></section>'+side+'</div></div>'; }

{ const _h=V.kalender.html, _w=V.kalender.wire;
  V.kalender.html=function(){ return UI.c3.mode==='salg'?c3HTML():c3Switch()+_h.apply(this,arguments); };
  V.kalender.wire=function(v){ const rr=()=>{ const y=window.scrollY; renderView(true); window.scrollTo(0,y); };
    v.querySelectorAll('[data-c3mode]').forEach(b=>b.addEventListener('click',()=>{ UI.c3.mode=b.dataset.c3mode; renderView(true); }));
    if(UI.c3.mode!=='salg'){ _w.apply(this,arguments); return; }
    v.querySelectorAll('[data-c3cell]').forEach(b=>b.addEventListener('click',()=>{ const [room,ym]=b.dataset.c3cell.split('|'); UI.c3.sel={room,ym}; rr(); document.querySelector('[data-c3cell="'+b.dataset.c3cell+'"]')?.focus({preventScroll:true}); }));
    v.querySelectorAll('[data-c3more]').forEach(b=>b.addEventListener('click',()=>{ UI.c3.more=!UI.c3.more; rr(); }));
    v.querySelectorAll('[data-c3all]').forEach(b=>b.addEventListener('click',()=>{ UI.c3.all=b.dataset.c3all==='1'; rr(); }));
    v.querySelectorAll('[data-c3grid]').forEach(b=>b.addEventListener('click',()=>{ UI.month=b.dataset.c3grid; UI.calRoom=''; UI.calAll=!RM[UI.c3.sel.room].nw; UI.c3.mode='grid'; renderView(true); window.scrollTo(0,0); }));
    v.querySelectorAll('[data-c3org]').forEach(b=>b.addEventListener('click',()=>openOrg(b.dataset.c3org)));
    v.querySelectorAll('[data-c3ask]').forEach(b=>b.addEventListener('click',()=>k3Do('epost',b.dataset.c3ask)));
  }; }
