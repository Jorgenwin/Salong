/* ---------- Marked og posisjon, runde 2 ----------
   Posisjonering er et ferdig beregnet markedskart, bygget på researchgrunnlaget i MKSEED. Ingenting skrives til databasen.
   Regler: ukjent pris plasseres aldri på prisaksen, ukjent kapasitet plasseres aldri på kapasitetsaksen,
   romleie eks. mva og dagpakke inkl. mva per person blandes aldri, og historiske priser og priser med ukjent mva holdes utenfor.
   Aktørkategori er Salongs egen grovsortering. Størrelsen på et punkt teller dokumenterte leveranseområder, ikke kvalitet. */
const MP_CAT={own:{n:'Egne rom',sh:'c'},kultur:{n:'Kulturhus og scene',sh:'d'},konf:{n:'Konferanse og hotell',sh:'s'},event:{n:'Eventlokale',sh:'t'}};
const MP_CATOF={marmor:'kultur',forstander:'kultur',rik:'kultur',kultur:'kultur',vega:'kultur',hand:'konf',oslob:'konf',storo:'konf',trek:'event',samf:'event'};
const MP_SPAN={a:[80,120],b:[120,180],c:[180,260],d:[260,350],e:[350,9999]};
const mpSpTxt=sp=>sp[1]>=9999?sp[0]+'+':sp[0]+'–'+sp[1];
const MP_SETUP={theatre:'stolrader',classroom:'klasserom'};
const MP_BASIS={room:'Romleie',day:'Dagpakke',ask:'Pris må innhentes'};
const MP_TYPE={apent:{n:'Åpent arrangement',setup:'theatre',basis:'room'},konferanse:{n:'Konferanse',setup:'theatre',basis:'day'},fagdag:{n:'Fagdag',setup:'classroom',basis:'day'},kveld:{n:'Lansering eller kveld',setup:'theatre',basis:'room'}};
const MP_FS={ink:['Inkludert','c-avklart','Kilden sier at dette er inkludert.'],pak:['Inngår i pakke','c-avklart','Inngår i den publiserte pakken, ikke nødvendigvis i ren romleie.'],til:['Tillegg','c-forelopig','Tilbys, men kommer i tillegg til prisen.'],tilg:['Tilgjengelig','c-forelopig','Omtalt som tilgjengelig. Kilden sier ikke om det er inkludert.'],avk:['Må avklares','c-mangler','Kilden gir ikke svar.'],konf:['Kildekonflikt','c-motstridende','Kilden gir motstridende opplysninger.'],hist:['Historisk, 2025','c-mangler','Gjelder vilkår fra 2025 og kan ikke brukes som gjeldende.'],ingen:['Ikke dokumentert','c-mangler','Ingenting er registrert i grunnlaget.']};
const MP_PST={published_reference:['Publisert referanse','c-avklart'],conditional:['Betinget','c-forelopig'],tax_unknown:['Mva ikke oppgitt','c-mangler'],expired:['Historisk','c-mangler']};
const MP_DOC=['ink','pak','til','tilg','konf'];
UI.mp={focus:'solstad',who:'alle',span:'',setup:'theatre',basis:'room',type:'',ver:false,sel:'',hyp:{room:'',day:''},lim:false};
UI.mk.tab='posisjonering';
VDESC.marked='Solstad i markedet, sammenligninger, salgsargumenter og læring fra egne saker';
const mpV=id=>MKSEED.venues.find(v=>v.id===id)||null;
const mpOpN=MKSEED.venues.reduce((o,v)=>(o[v.operator]=(o[v.operator]||0)+1,o),{});
const mpLabel=v=>v.own||mpOpN[v.operator]>1?v.name:v.operator;
const mpFull=v=>v.operator+' · '+v.name;
const mpCat=v=>v.own?'own':(MP_CATOF[v.id]||'event');
const mpSrcA=(sid,label)=>{ const s=MSRC[sid]; return s?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(label||s.title)+' ↗</a>':'<span class="st-warn">Kilde ikke registrert</span>'; };
/* én leveranse for ett lokale. Teksten fra kilden vises alltid ordrett ved siden av; tilstanden er Salongs sortering av den. */
function mpFeat(v,key,basis){ const f=(v.features||{})[key]; if(!f) return {s:'ingen',label:'',note:'',src:''};
  const L=String(f[0]||''), N=String(f[1]||''), conflict=/motstrid/i.test(N);
  let s=/2025/.test(L)?'hist':/^inkludert i .*pakke/i.test(L)?'pak':/^inkludert/i.test(L)?'ink':/tillegg/i.test(L)?'til':/avklares|ikke spesifisert|avhengig/i.test(L)?'avk':'tilg';
  if(conflict&&basis!=='day') s='konf';
  return {s,label:L,note:N,src:f[2]||'',conflict}; }
const mpNF=v=>Object.keys(MS_FEAT).filter(k=>MP_DOC.includes(mpFeat(v,k,'day').s)).length;
/* pris i ett grunnlag. Returnerer y bare når prisen er en publisert referanse med riktig avgiftsgrunnlag. */
function mpPrice(v,basis){ const p=(v.prices||[]).find(p=>p.kind===basis), want=basis==='day'?'inc_vat':'ex_vat';
  if(!p) return {y:null,p:null,why:(v.prices||[]).length?(basis==='day'?'Ingen publisert dagpakke':'Ingen publisert romleie'):'Pris må innhentes'};
  if(p.status==='expired') return {y:null,p,why:'Historisk pris fra '+String(p.valid_from||'').slice(0,4)};
  if(p.status==='tax_unknown'||p.tax_basis==='unknown') return {y:null,p,why:'Mva-grunnlag ikke oppgitt'};
  if(p.tax_basis!==want||p.status!=='published_reference') return {y:null,p,why:'Kan ikke sammenlignes på dette grunnlaget'};
  return {y:p.amount,p,why:''}; }
const mpUsable=v=>mpPrice(v,'room').y!=null||mpPrice(v,'day').y!=null;
function mpAskWhy(v){ if(!(v.prices||[]).length) return 'Pris må innhentes'; const a=mpPrice(v,'room'), b=mpPrice(v,'day'); return (b.p?b.why:a.why)||'Pris må innhentes'; }
/* forbehold på lokalets tall. q betyr at lokalet skjules av «Kun verifiserte». */
function mpFlags(v,setup){ const F=[], txt=[v.note].concat((v.prices||[]).map(p=>p.condition)).join(' ');
  if(/motstrid|kildekonflikt/i.test(txt)) F.push({k:'konf',t:'Kildekonflikt',q:1});
  if((v.prices||[]).some(p=>p.status==='expired')) F.push({k:'hist',t:'Pris fra '+String(((v.prices||[]).find(p=>p.status==='expired')||{}).valid_from||'').slice(0,4),q:1});
  if((v.prices||[]).some(p=>p.status!=='expired'&&(p.status==='tax_unknown'||p.tax_basis==='unknown'))) F.push({k:'mva',t:'Mva ikke oppgitt',q:1});
  if(((v.capacities||{})[setup]??null)==null) F.push({k:'cap',t:v.reported_max_seated!=null?'Kapasitet uten oppgitt oppsett':'Kapasitet ikke oppgitt',q:1});
  if(v.planned_opening) F.push({k:'plan',t:'Planlagt åpning '+msMonth(v.planned_opening),q:0});
  return F; }
function mpRow(v){ const M=UI.mp, cap=(v.capacities||{})[M.setup]??null, rep=v.reported_max_seated??null, P=M.basis==='ask'?{y:null,p:null,why:mpAskWhy(v)}:mpPrice(v,M.basis), sp=MP_SPAN[M.span]||null;
  return {v,isF:v.id===M.focus,cat:mpCat(v),cap,rep,y:P.y,p:P.p,why:P.why,nF:mpNF(v),fl:mpFlags(v,M.setup),place:cap==null?'nocap':P.y!=null?'plot':'lane',under:!!(sp&&cap!=null&&cap<sp[0]),partial:!!(sp&&cap!=null&&cap>=sp[0]&&cap<sp[1])}; }
function mpModel(){ const M=UI.mp; if(!mpV(M.focus)) M.focus='solstad'; const sp=MP_SPAN[M.span]||null, hid={who:0,small:0,ver:0,priced:0}, rows=[];
  for(const v of MKSEED.venues){ const r=mpRow(v);
    if(!r.isF){ if((M.who==='egne'&&!v.own)||(M.who==='eksterne'&&v.own)){ hid.who++; continue; }
      if(sp&&(r.cap!=null?r.cap<sp[0]:r.rep!=null&&r.rep<sp[0])){ hid.small++; continue; }
      if(M.ver&&r.fl.some(f=>f.q)){ hid.ver++; continue; }
      if(M.basis==='ask'&&mpUsable(v)){ hid.priced++; continue; } }
    rows.push(r); }
  return {F:rows.find(r=>r.isF),rows,hid,sp,total:MKSEED.venues.length}; }
/* nærmeste andre lokaler i størrelse, i valgt oppsett. Bare lokaler med oppgitt kapasitet i oppsettet kan være med. */
function mpNear(v,n){ const M=UI.mp, c=(v.capacities||{})[M.setup]??null; if(c==null) return [];
  return MKSEED.venues.filter(o=>o.id!==v.id&&!o.own&&((o.capacities||{})[M.setup]??null)!=null).map(o=>({v:o,cap:o.capacities[M.setup],d:o.capacities[M.setup]-c})).sort((a,b)=>Math.abs(a.d)-Math.abs(b.d)||a.cap-b.cap).slice(0,n||3); }
const mpDiffTxt=d=>d===0?'like mange plasser':Math.abs(d)+(d>0?' flere':' færre')+' plasser';
function mpPriceShort(r){ const M=UI.mp; return r.y!=null?nf.format(r.y)+' kr'+(M.basis==='day'?' per person inkl. mva':' eks. mva'):r.why; }

/* ---------- nøkkeltall for vårt rom ---------- */
function mpTiles(D){ const M=UI.mp, F=D.F, v=F.v, su=MP_SETUP[M.setup], other=M.setup==='theatre'?'classroom':'theatre', oc=(v.capacities||{})[other]??null;
  const ext=MKSEED.venues.filter(o=>!o.own), known=ext.filter(o=>((o.capacities||{})[M.setup]??null)!=null), big=F.cap!=null?known.filter(o=>o.capacities[M.setup]>=F.cap):[], near=mpNear(v,1)[0];
  const any=mpUsable(v), pr=M.basis==='ask'?null:mpPrice(v,M.basis);
  return '<dl class="kstrip mp-tiles"><div><dt>'+esc(v.name)+' i '+su+'</dt><dd>'+(F.cap!=null?nf.format(F.cap):'Ikke oppgitt')+'<small>'+(oc!=null?nf.format(oc)+' i '+MP_SETUP[other]:'Ikke oppgitt i '+MP_SETUP[other])+(v.area_m2?' · '+nf.format(v.area_m2)+' m²':'')+(D.sp&&F.cap!=null&&F.cap<D.sp[1]?' · <b class="st-warn">'+(F.cap<D.sp[0]?'under':'dekker ikke hele')+' spennet '+D.sp[0]+'–'+D.sp[1]+'</b>':'')+'</small></dd></div>'+
   '<div><dt>Like store eller større</dt><dd>'+(F.cap!=null?big.length+' av '+known.length:'Kan ikke telles')+'<small>'+(F.cap!=null?'andre lokaler med oppgitt kapasitet i '+su+(big.length?': '+big.map(o=>esc(mpLabel(o))).join(', '):''):'Kapasitet i '+su+' er ikke oppgitt for '+esc(v.name))+'</small></dd></div>'+
   '<div><dt>Nærmest i størrelse</dt><dd>'+(near?esc(mpLabel(near.v)):'Ingen')+'<small>'+(near?nf.format(near.cap)+' plasser, '+mpDiffTxt(near.d)+(mpLabel(near.v)!==near.v.operator?' · '+esc(near.v.operator):''):'Ingen andre lokaler har oppgitt kapasitet i '+su)+'</small></dd></div>'+
   '<div><dt>Publisert pris</dt><dd>'+(pr&&pr.y!=null?nf.format(pr.y)+' kr':any?(M.basis==='ask'?'Finnes':'Annet grunnlag'):'Ingen')+'<small>'+(pr&&pr.y!=null?(M.basis==='day'?'per person inkl. mva':'romleie eks. mva')+'. Publisert referanse, må bekreftes':any?(M.basis==='ask'?'Velg Romleie eller Dagpakke for å se den':'Har pris, men ikke som '+(M.basis==='day'?'dagpakke':'romleie')):'Pris må innhentes')+(v.planned_opening?' · planlagt åpning '+msMonth(v.planned_opening):'')+'</small></dd></div></dl>'; }

/* ---------- markedskartet ---------- */
function mpShape(sh,cx,cy,r,cls){ const f=n=>n.toFixed(1);
  if(sh==='s'){ const a=r*.89; return '<rect class="'+cls+'" x="'+f(cx-a)+'" y="'+f(cy-a)+'" width="'+f(2*a)+'" height="'+f(2*a)+'" rx="1.5"/>'; }
  if(sh==='d'){ const a=r*1.25; return '<path class="'+cls+'" d="M'+f(cx)+' '+f(cy-a)+'L'+f(cx+a)+' '+f(cy)+'L'+f(cx)+' '+f(cy+a)+'L'+f(cx-a)+' '+f(cy)+'Z"/>'; }
  if(sh==='t'){ const a=r*1.35; return '<path class="'+cls+'" d="M'+f(cx)+' '+f(cy-a)+'L'+f(cx+a*.87)+' '+f(cy+a*.5)+'L'+f(cx-a*.87)+' '+f(cy+a*.5)+'Z"/>'; }
  return '<circle class="'+cls+'" cx="'+f(cx)+'" cy="'+f(cy)+'" r="'+f(r)+'"/>'; }
const mpR=n=>6+n*1.25;
function mpChart(D,W){ const M=UI.mp, ask=M.basis==='ask', day=M.basis==='day', P=D.rows.filter(r=>r.place==='plot'), L=D.rows.filter(r=>r.place==='lane').sort((a,b)=>a.cap-b.cap), F=D.F, su=MP_SETUP[M.setup];
  if(!P.length&&!L.length) return '<div class="mk-empty"><b>Ingen lokaler kan plasseres med disse valgene.</b><span>Ingen av lokalene i utvalget har oppgitt kapasitet i '+su+'. Se listen under kartet, eller bytt oppsett.</span></div>';
  const hyp=!ask&&F.cap!=null&&F.y==null&&Number(M.hyp[M.basis])>0?Number(M.hyp[M.basis]):null;
  const m={l:W<520?46:60,r:18,t:34,b:40}, iw=W-m.l-m.r, PH=ask?0:Math.round(Math.min(330,Math.max(210,W*.44)));
  const xr=Math.max(100,...P.concat(L).map(r=>r.cap),D.sp&&D.sp[1]<9999?D.sp[1]:0), xs=(xr<=200?25:xr<=450?50:100)*(W<520?2:1), xmax=Math.ceil(xr*1.05/xs)*xs;
  const yr=Math.max(day?1000:10000,hyp||0,...P.map(r=>r.y)), ystep=[100,200,250,500,1000,2000,5000,10000,20000,25000,50000,100000].find(s=>yr*1.08/s<=5)||200000, ymax=Math.ceil(yr*1.08/ystep)*ystep;
  const x=c=>m.l+c/xmax*iw, y=v=>m.t+PH-(v/ymax)*PH, last=[];
  for(const r of L){ const cx=x(r.cap); let k=0; while(last[k]!=null&&cx-last[k]<30) k++; r.lr=k; last[k]=cx; }
  const LH=L.length?last.length*30+8:0, laneTop=ask?m.t+20:m.t+PH+30, yb=L.length?laneTop+LH:m.t+PH, H=yb+m.b;
  const lcap=W<520?'Uten pris som kan plasseres':ask?'Ingen pris som kan plasseres. Punktene viser bare kapasitet.':'Uten '+(day?'dagpakke':'romleie')+' som kan plasseres. Punktene viser bare kapasitet.';
  let g='', marks='', labels='', hits='';
  if(D.sp){ const x0=x(D.sp[0]), x1=x(Math.min(D.sp[1],xmax)); g+='<rect class="mp-span" x="'+x0.toFixed(1)+'" y="'+m.t+'" width="'+(x1-x0).toFixed(1)+'" height="'+(yb-m.t)+'"/><text class="mp-spant" x="'+(x0+4).toFixed(1)+'" y="'+(m.t-6)+'">'+mpSpTxt(D.sp)+' deltakere</text>'; }
  for(let c=0;c<=xmax;c+=xs) g+='<line class="mk-grid" x1="'+x(c)+'" x2="'+x(c)+'" y1="'+m.t+'" y2="'+yb+'"/><text class="mk-tick" x="'+x(c)+'" y="'+(yb+16)+'" text-anchor="middle">'+c+'</text>';
  if(!ask){ for(let v=0;v<=ymax;v+=ystep) g+='<line class="mk-grid'+(v===0?' mp-base':'')+'" x1="'+m.l+'" x2="'+(m.l+iw)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="mk-tick" x="'+(m.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end">'+(v>=10000?nf.format(v/1000)+' k':nf.format(v))+'</text>';
    g+='<text class="mk-axt" x="'+(m.l-(W<520?40:52))+'" y="13">'+(day?'Publisert dagpakke, kr per person inkl. mva':'Publisert romleie, kr eks. mva')+'</text>'; }
  g+='<text class="mk-axt" x="'+(m.l+iw/2)+'" y="'+(H-6)+'" text-anchor="middle">Kapasitet i '+su+', antall plasser</text>';
  if(L.length) g+='<rect class="mp-lane" x="'+m.l+'" y="'+laneTop+'" width="'+iw+'" height="'+LH+'" rx="4"/><text class="mp-lanet" x="'+m.l+'" y="'+(laneTop-8)+'">'+esc(lcap)+'</text>';
  if(F.cap!=null) g+='<line class="mp-guide" x1="'+x(F.cap)+'" x2="'+x(F.cap)+'" y1="'+m.t+'" y2="'+yb+'"/>';
  const N=P.map(r=>({r,cx:x(r.cap),cy:y(r.y)})).concat(L.map(r=>({r,cx:x(r.cap),cy:laneTop+19+r.lr*30})));
  for(const n of N){ n.R=mpR(n.r.nF); n.box=[n.cx-n.R-3,n.cy-n.R-3,n.cx+n.R+3,n.cy+n.R+3]; }
  const sel=M.sel||F.v.id, near=new Set(mpNear(F.v,3).map(o=>o.v.id));
  N.sort((a,b)=>(a.r.isF?1:0)-(b.r.isF?1:0));
  for(const n of N){ const r=n.r, cls='mp-n mp-'+r.cat+(r.isF?' foc':'');
    marks+=(r.v.id===sel?'<circle class="mk-sel" cx="'+n.cx.toFixed(1)+'" cy="'+n.cy.toFixed(1)+'" r="'+(n.R+6.5).toFixed(1)+'"/>':'')+(r.isF?'<circle class="mp-ring" cx="'+n.cx.toFixed(1)+'" cy="'+n.cy.toFixed(1)+'" r="'+(n.R+3.5).toFixed(1)+'"/>':'')+mpShape(MP_CAT[r.cat].sh,n.cx,n.cy,n.R,cls); }
  /* etiketter: vårt rom og valgt lokale alltid, deretter nærmeste i størrelse, deretter resten der det er plass */
  const placed=L.length?[[m.l,laneTop-20,m.l+lcap.length*6.1,laneTop-3]]:[], hit=(b,self)=>placed.some(o=>!(b[2]<o[0]||b[0]>o[2]||b[3]<o[1]||b[1]>o[3]))||N.some(o=>o!==self&&!(b[2]<o.box[0]||b[0]>o.box[2]||b[3]<o.box[1]||b[1]>o.box[3]));
  const pri=n=>n.r.isF?0:n.r.v.id===sel?1:near.has(n.r.v.id)?2:3;
  for(const n of [...N].sort((a,b)=>pri(a)-pri(b)||b.r.cap-a.r.cap)){ const p=pri(n); if(p===3&&W<520) continue;
    const t=mpLabel(n.r.v)+(n.r.isF?' · '+nf.format(n.r.cap):''), w=t.length*(n.r.isF?7:6.4)+4, R=n.R+5;
    const C=[[n.cx+R,n.cy+4,'start'],[n.cx-R-w,n.cy+4,'end'],[n.cx-w/2,n.cy-R-2,'middle'],[n.cx-w/2,n.cy+R+11,'middle']].map(c=>({b:[c[0],c[1]-11,c[0]+w,c[1]+3],a:c[2],y:c[1]})).filter(c=>c.b[0]>=2&&c.b[2]<=W-2&&c.b[1]>=16&&c.b[3]<=yb+2);
    const c=C.find(c=>!hit(c.b,n))||(p<2?C[0]:null); if(!c) continue; placed.push(c.b);
    labels+='<text class="mk-lab'+(n.r.isF?' mp-flab':'')+'" x="'+(c.a==='start'?c.b[0]:c.a==='end'?c.b[2]:(c.b[0]+c.b[2])/2).toFixed(1)+'" y="'+c.y.toFixed(1)+'" text-anchor="'+c.a+'">'+esc(t)+'</text>'; }
  if(hyp!=null){ const cx=x(F.cap), cy=y(hyp), fn=N.find(n=>n.r.isF), t='Intern prishypotese: '+nf.format(hyp)+' kr', w=t.length*6.4, right=cx+16+w<W-2;
    marks+='<line class="mp-hypl" x1="'+cx+'" x2="'+cx+'" y1="'+(cy+9)+'" y2="'+(fn?fn.cy-fn.R-5:yb)+'"/><circle class="mp-hyp" cx="'+cx+'" cy="'+cy+'" r="8.5"/>';
    labels+='<text class="mk-lab mp-hypt" x="'+(right?cx+14:cx-14)+'" y="'+(cy+4)+'" text-anchor="'+(right?'start':'end')+'">'+esc(t)+'</text>'; }
  for(const n of [...N].sort((a,b)=>(b.r.isF?1:0)-(a.r.isF?1:0)||a.r.cap-b.r.cap)){ const r=n.r, v=r.v, nm=mpFull(v), ct=nf.format(r.cap)+' i '+su, fl=r.fl.filter(f=>f.q).map(f=>f.t.toLowerCase());
    hits+='<circle class="mk-hit" cx="'+n.cx.toFixed(1)+'" cy="'+n.cy.toFixed(1)+'" r="'+Math.max(14,n.R+4).toFixed(1)+'" tabindex="0" role="button" data-mpv="'+esc(v.id)+'" aria-pressed="'+(v.id===sel)+'" aria-label="'+esc(nm+', '+MP_CAT[r.cat].n.toLowerCase()+(r.isF?', vårt rom':'')+'. '+ct+'. '+(r.y!=null?(day?'Publisert dagpakke ':'Publisert romleie ')+mpPriceShort(r):'Ikke plassert på prisaksen: '+r.why.toLowerCase())+'. '+r.nF+' av 6 leveranseområder dokumentert.'+(fl.length?' Forbehold: '+fl.join(', ')+'.':'')+' Trykk for detaljer.')+'" data-n="'+esc(nm)+'" data-p="'+esc(r.y!=null?mpPriceShort(r):r.why)+'" data-b="'+esc(ct+' · '+r.nF+' av 6 leveranseområder dokumentert')+'"/>'; }
  return '<div class="mk-chart mp-chart" id="mpChart"><svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Markedskart. '+N.length+' lokaler plassert etter kapasitet i '+su+(ask?'':' og '+(day?'publisert dagpakke':'publisert romleie'))+'. Samme innhold står i tabellen under.">'+g+marks+labels+hits+'</svg><div class="mk-tip" id="mpTip" hidden></div></div>'; }
function mpLegend(D){ const used=new Set(D.rows.filter(r=>r.place!=='nocap').map(r=>r.cat)), sw=(k,r)=>'<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">'+mpShape(MP_CAT[k].sh,10,10,r||5.5,'mp-n mp-'+k)+'</svg>';
  return '<div class="mk-legend mp-legend"><span class="mp-lg">'+Object.keys(MP_CAT).filter(k=>used.has(k)).map(k=>'<span>'+sw(k)+MP_CAT[k].n+'</span>').join('')+'</span><span class="mp-lg" title="Antall av seks leveranseområder der kilden dokumenterer et tilbud. Sier ikke noe om kvalitet."><svg width="76" height="30" viewBox="0 0 76 30" aria-hidden="true"><circle class="mp-sz" cx="8" cy="15" r="'+mpR(0)+'"/><circle class="mp-sz" cx="31" cy="15" r="'+mpR(3)+'"/><circle class="mp-sz" cx="60" cy="15" r="'+mpR(6)+'"/></svg>Størrelse: 0, 3 og 6 dokumenterte leveranseområder</span></div>'; }
function mpNoCap(D){ const R=D.rows.filter(r=>r.place==='nocap'); if(!R.length) return ''; const su=MP_SETUP[UI.mp.setup];
  return '<div class="mp-nocap"><b>Kapasitet i '+su+' er ikke oppgitt</b><span class="note">Disse står ikke i kartet. Et generelt maksimaltall brukes ikke som kapasitet i et bestemt oppsett.</span><div class="mp-chips">'+R.map(r=>'<button type="button" class="mp-chipb'+((UI.mp.sel||D.F.v.id)===r.v.id?' on':'')+'" data-mpv="'+esc(r.v.id)+'">'+esc(mpLabel(r.v))+'<span>'+(r.rep!=null?'oppgitt '+nf.format(r.rep)+' sittende, oppsett ikke spesifisert':(()=>{ const o=UI.mp.setup==='theatre'?'classroom':'theatre', oc=(r.v.capacities||{})[o]??null; return oc!=null?nf.format(oc)+' i '+MP_SETUP[o]:'ingen kapasitet oppgitt'; })())+'</span></button>').join('')+'</div></div>'; }

/* ---------- sidepanelet ---------- */
function mpHow(F,v,setup){ setup=setup||UI.mp.setup; const su=MP_SETUP[setup], o=setup==='theatre'?'classroom':'theatre', a=(F.capacities||{})[setup]??null, b=(v.capacities||{})[setup]??null, a2=(F.capacities||{})[o]??null, b2=(v.capacities||{})[o]??null, S=[], fn=F.name, vn=mpLabel(v);
  if(a!=null&&b!=null) S.push(a===b?'Begge har '+nf.format(a)+' plasser i '+su+'.':fn+' har '+nf.format(a)+' plasser i '+su+', '+vn+' har '+nf.format(b)+'. Det er '+nf.format(Math.abs(b-a))+(b>a?' flere':' færre')+' enn '+fn+'.');
  else S.push('Kapasitet i '+su+' er ikke oppgitt for '+(a==null?fn:vn)+(a!=null&&v.reported_max_seated!=null?' (oppgitt '+nf.format(v.reported_max_seated)+' sittende uten spesifisert oppsett)':'')+'. Størrelsen kan ikke sammenlignes direkte i dette oppsettet.');
  if(a2!=null&&b2!=null) S.push('I '+MP_SETUP[o]+': '+fn+' '+nf.format(a2)+', '+vn+' '+nf.format(b2)+'.');
  if(F.area_m2&&v.area_m2) S.push('Areal: '+fn+' '+nf.format(F.area_m2)+' m², '+vn+' '+nf.format(v.area_m2)+' m².');
  const pf=['room','day'].map(k=>[k,mpPrice(F,k),mpPrice(v,k)]), both=pf.filter(x=>x[1].y!=null&&x[2].y!=null), pv=pf.filter(x=>x[2].y!=null);
  if(both.length) for(const [k,x,z] of both) S.push((k==='day'?'Publisert dagpakke per person inkl. mva':'Publisert romleie eks. mva')+': '+fn+' '+nf.format(x.y)+' kr, '+vn+' '+nf.format(z.y)+' kr. Hva prisen inkluderer kan være ulikt, se leveransen under.');
  else if(!mpUsable(F)) S.push(fn+' har ingen publisert pris. '+(pv.length?vn+' har publisert '+pv.map(x=>(x[0]==='day'?'dagpakke '+nf.format(x[2].y)+' kr per person inkl. mva':'romleie '+nf.format(x[2].y)+' kr eks. mva')).join(' og ')+'. Prisnivået kan ikke sammenlignes før '+fn+' har en pris.':vn+' har heller ingen pris som kan plasseres. Pris må innhentes for begge.'));
  else S.push('Lokalene har ikke publisert pris på samme grunnlag. Romleie og dagpakke sammenlignes ikke med hverandre.');
  if(F.planned_opening) S.push(fn+' er planlagt åpnet '+msMonth(F.planned_opening)+' og er ikke i drift ennå.');
  return S; }
function mpFeatRows(F,v){ const M=UI.mp, b=M.basis==='ask'?'room':M.basis, st=f=>f.s==='pak'&&b!=='day'?'<span class="cst c-forelopig" title="Inngår i den publiserte pakken. Det er ikke dokumentert at det inngår i ren romleie.">Bare i pakke</span>':'<span class="cst '+MP_FS[f.s][1]+'" title="'+esc(MP_FS[f.s][2])+'">'+MP_FS[f.s][0]+'</span>';
  return '<table class="dense mp-ft"><tbody>'+Object.entries(MS_FEAT).map(([k,n])=>{ const f=mpFeat(v,k,b), o=F?mpFeat(F,k,b):null; return '<tr><th scope="row">'+n+'</th><td>'+st(f)+(f.label?'<span class="s">«'+esc(f.label)+'». '+esc(f.note)+(f.src?' '+mpSrcA(f.src,'Kilde'):'')+'</span>':'')+(o?'<span class="s mp-vs">'+esc(F.name)+': '+MP_FS[o.s][0].toLowerCase()+(o.label?' («'+esc(o.label)+'»)':'')+'</span>':'')+'</td></tr>'; }).join('')+'</tbody></table>'; }
function mpSide(D){ const M=UI.mp, F=D.F.v, v=mpV(M.sel)||F, r=mpRow(v), isF=v.id===F.id, cat=mpCat(v), other=M.setup==='theatre'?'classroom':'theatre', near=mpNear(v,4), hidden=!D.rows.some(x=>x.v.id===v.id);
  const cap=k=>{ const c=(v.capacities||{})[k]??null; return c!=null?nf.format(c):'<span class="st-warn">Ikke oppgitt</span>'; };
  const canHyp=isF&&v.own&&M.basis!=='ask'&&r.y==null&&r.cap!=null, hv=M.hyp[M.basis]||'';
  const dq=['Kapasitet i '+MP_SETUP[M.setup]+': '+(r.cap!=null?'oppgitt med kilde':'<b class="st-warn">ikke oppgitt i grunnlaget</b>'),
    'Pris: '+((v.prices||[]).length?(mpUsable(v)?'publisert referanse, må bekreftes for konkret dato':'<b class="st-warn">ingen pris som kan brukes i sammenligning</b>'):'ingen publisert pris. Pris må innhentes'),
    'Leveranse: '+r.nF+' av 6 områder er dokumentert'+(Object.keys(v.features||{}).length?'':'. Ingenting er registrert i grunnlaget')].concat(r.fl.filter(f=>f.q&&f.k!=='cap').map(f=>'<b class="st-warn">'+esc(f.t)+'</b>'));
  return '<section class="panel mp-side" id="mpSide" tabindex="-1" aria-label="Detaljer for '+esc(mpFull(v))+'"><header class="mp-sh"><div><span class="lbl">'+MP_CAT[cat].n+(v.own?'':' · Salongs sortering')+'</span><h3>'+esc(v.name)+'</h3><span class="meta">'+esc(v.operator)+'</span></div>'+(isF?'':'<button class="btn ghost sm" type="button" id="mpBack">Tilbake til '+esc(F.name)+'</button>')+'</header>'+
   '<div class="mp-badges">'+(isF?'<span class="cst c-avklart">Vårt utgangspunkt</span>':'')+r.fl.map(f=>'<span class="cst '+(f.k==='konf'?'c-motstridende':f.k==='plan'?'c-forelopig':'c-mangler')+'">'+esc(f.t)+'</span>').join('')+(hidden?'<span class="cst c-irrelevant">Skjult av filtrene</span>':'')+'</div>'+
   '<dl class="mp-facts"><div><dt>Stolrader</dt><dd>'+cap('theatre')+'</dd></div><div><dt>Klasserom</dt><dd>'+cap('classroom')+'</dd></div><div><dt>Areal</dt><dd>'+(v.area_m2?nf.format(v.area_m2)+' m²':'<span class="meta">Ikke oppgitt</span>')+'</dd></div>'+(v.reported_max_seated!=null?'<div class="full"><dt>Oppgitt sittende, oppsett ikke spesifisert</dt><dd>'+nf.format(v.reported_max_seated)+'</dd></div>':'')+'</dl>'+(v.capacity_note?'<p class="note">'+esc(v.capacity_note)+'</p>':'')+
   '<h4 class="mk-h">Prisgrunnlag</h4>'+((v.prices||[]).length?'<ul class="mp-prices">'+v.prices.map(p=>'<li><div><b>'+nf.format(p.amount)+' kr'+(p.unit==='per_person'?' per person':'')+'</b> '+msTax(p)+' <span class="cst '+(MP_PST[p.status]||MP_PST.conditional)[1]+'">'+(MP_PST[p.status]||MP_PST.conditional)[0]+'</span></div><span class="s">'+esc(p.label)+(p.minimum_people?', minst '+p.minimum_people+' personer':'')+'. '+esc(p.condition||'')+' '+mpSrcA(p.source_id,'Kilde')+'</span></li>').join('')+'</ul>'+(v.own?'<p class="note">Tallene er hentet fra litteraturhuset.no slik researchgrunnlaget gjengir dem. De er ikke hentet fra en intern prisliste og er ikke et tilbud.</p>':'<p class="note">Publiserte referanser fra leverandørens nettsted. Ikke innhentede tilbud.</p>'):'<p class="mp-ask"><b>Ingen publisert pris.</b> Pris må innhentes.'+(v.own?' Salong anslår ingen pris for '+esc(v.name)+'.':'')+'</p>')+
   (canHyp?'<div class="mp-hypbox"><label for="mpHyp"><b>Intern prishypotese – ikke tilbud eller godkjent pris</b><span class="note">'+(M.basis==='day'?'Kroner per person inkl. mva':'Romleie i kroner eks. mva')+'. Tegnes i kartet som en åpen ring. Lagres ikke.</span></label><div class="row"><input class="in" id="mpHyp" type="number" inputmode="numeric" min="0" step="'+(M.basis==='day'?50:1000)+'" value="'+esc(hv)+'" placeholder="Ikke satt"><button class="btn sm" type="button" id="mpHypSet">Vis i kartet</button>'+(hv?'<button class="btn ghost sm" type="button" id="mpHypClr">Fjern</button>':'')+'</div></div>':'')+
   (isF?'':'<h4 class="mk-h">Hvordan '+esc(F.name)+' skiller seg</h4><ul class="mp-how">'+mpHow(F,v).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>')+
   '<h4 class="mk-h">Dokumentert leveranse <span class="meta">'+r.nF+' av 6 områder</span></h4>'+mpFeatRows(isF?null:F,v)+'<p class="note">Tilgjengelig betyr ikke inkludert. Teksten i anførselstegn er hentet ordrett fra grunnlaget.</p>'+
   '<h4 class="mk-h">Nærmeste i størrelse</h4>'+(near.length?'<ul class="mp-near">'+near.map(n=>'<li><button type="button" class="lnk" data-mpv="'+esc(n.v.id)+'">'+esc(mpFull(n.v))+'</button><span class="meta">'+nf.format(n.cap)+' i '+MP_SETUP[M.setup]+' · '+mpDiffTxt(n.d)+' · '+esc((x=>x.y!=null?mpPriceShort(x):x.why)(mpRow(n.v)).toLowerCase())+'</span></li>').join('')+'</ul>':'<p class="note">Kan ikke beregnes. Kapasitet i '+MP_SETUP[M.setup]+' er ikke oppgitt for '+esc(v.name)+'.</p>')+
   '<h4 class="mk-h">Datakvalitet</h4><ul class="mp-dq">'+dq.map(t=>'<li>'+t+'</li>').join('')+'<li>Kildene ble kontrollert '+esc(fdt(MKSEED.checked_on))+' i researchgrunnlaget. Salong har ikke hentet dem på nytt.</li></ul>'+
   (v.note?'<p class="mp-vnote"><b>Merknad i grunnlaget.</b> '+esc(v.note)+'</p>':'')+
   '<h4 class="mk-h">Kilder</h4><ul class="mp-src">'+(v.source_ids||[]).map(id=>{ const s=MSRC[id]; return s?'<li>'+mpSrcA(id)+'<span class="s">Kontrollert '+esc(fdt(s.checked_on))+(s.note?'. '+esc(s.note):'')+'</span></li>':''; }).join('')+'</ul></section>'; }

/* ---------- tabellen: samme innhold som kartet, pluss det som ikke kan plasseres ---------- */
function mpTable(D){ const M=UI.mp, su=MP_SETUP[M.setup], sel=M.sel||D.F.v.id, ord={plot:0,lane:1,nocap:2}, R=[...D.rows].sort((a,b)=>ord[a.place]-ord[b.place]||(b.cap||0)-(a.cap||0));
  return '<section class="panel mp-tblp"><header><h2>Samme innhold som tabell</h2><span class="sub">'+R.length+' lokaler</span></header><div class="tbl"><table class="dense mp-tbl"><thead><tr><th>Lokale</th><th>Kategori</th><th class="n">Kapasitet i '+su+'</th><th>'+(M.basis==='day'?'Dagpakke per person inkl. mva':M.basis==='room'?'Romleie eks. mva':'Pris')+'</th><th class="n">Leveranseområder</th><th>Forbehold</th><th>Plassering</th></tr></thead><tbody>'+R.map(r=>'<tr'+(r.v.id===sel?' class="on"':'')+'><td class="name"><button type="button" class="lnk" data-mpv="'+esc(r.v.id)+'">'+esc(r.v.name)+'</button><span class="s">'+esc(r.v.operator)+(r.isF?' · vårt utgangspunkt':'')+'</span></td><td>'+MP_CAT[r.cat].n+'</td><td class="n">'+(r.cap!=null?nf.format(r.cap):'<span class="st-warn">Ikke oppgitt</span>'+(r.rep!=null?'<span class="s">oppgitt '+nf.format(r.rep)+' uten oppsett</span>':''))+'</td><td>'+(r.y!=null?nf.format(r.y)+' kr':'<span class="st-warn">'+esc(r.why)+'</span>')+'</td><td class="n">'+r.nF+' av 6</td><td class="s2">'+(r.fl.filter(f=>f.k!=='cap').map(f=>esc(f.t)).join(', ')||'<span class="meta">Ingen registrert</span>')+'</td><td class="s2">'+(r.place==='plot'?'I kartet':r.place==='lane'?'Bare på kapasitetsaksen':'Ikke i kartet')+'</td></tr>').join('')+'</tbody></table></div></section>'; }

/* ---------- filtre og fanen ---------- */
function mpFilters(D){ const M=UI.mp, seg=(key,opts,lab)=>'<div class="mp-f"><span class="lbl" id="mpl-'+key+'">'+lab+'</span><div class="seg" role="group" aria-labelledby="mpl-'+key+'">'+opts.map(([k,n])=>'<button type="button" data-mpset="'+key+':'+k+'" aria-pressed="'+(String(M[key])===String(k))+'">'+n+'</button>').join('')+'</div></div>';
  const def=M.focus==='solstad'&&M.who==='alle'&&!M.span&&M.setup==='theatre'&&M.basis==='room'&&!M.type&&!M.ver, h=D.hid, hidden=[h.who?h.who+' utenfor utvalget':'',h.small?h.small+' for små for '+mpSpTxt(D.sp):'',h.ver?h.ver+' med forbehold':'',h.priced?h.priced+' har publisert pris':''].filter(Boolean);
  return '<section class="panel mp-filters" aria-label="Filtre for markedskartet"><div class="mp-frow"><div class="mp-f"><label class="lbl" for="mpFocus">Vårt rom</label><select class="in fsel" id="mpFocus">'+MKSEED.venues.filter(v=>v.own).map(v=>'<option value="'+esc(v.id)+'"'+(M.focus===v.id?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></div>'+
    seg('who',[['alle','Alle'],['egne','Egne rom'],['eksterne','Andre lokaler']],'Vis')+seg('span',[['','Alle'],['a','80–120'],['b','120–180'],['c','180–260'],['d','260–350'],['e','350+']],'Deltakere')+seg('setup',[['theatre','Stolrader'],['classroom','Klasserom']],'Oppsett')+seg('basis',[['room','Romleie'],['day','Dagpakke'],['ask','Pris må innhentes']],'Prisgrunnlag')+
    '<div class="mp-f"><label class="lbl" for="mpType">Arrangementstype</label><select class="in fsel" id="mpType"><option value="">Ikke valgt</option>'+Object.entries(MP_TYPE).map(([k,t])=>'<option value="'+k+'"'+(M.type===k?' selected':'')+'>'+t.n+'</option>').join('')+'</select></div>'+
    '<div class="mp-f"><span class="lbl">Datakvalitet</span><label class="check"><input type="checkbox" id="mpVer"'+(M.ver?' checked':'')+'> Kun verifiserte</label></div>'+(def?'':'<button class="btn ghost sm mp-reset" type="button" id="mpReset">Nullstill</button>')+'</div>'+
   '<p class="note mp-fsum" aria-live="polite">Viser '+D.rows.length+' av '+D.total+' lokaler.'+(hidden.length?' Skjult: '+hidden.join(', ')+'.':'')+(M.type?' '+MP_TYPE[M.type].n+' velger oppsett og prisgrunnlag. Grunnlaget sier ikke hvilke lokaler som egner seg for typen.':'')+(M.ver?' Verifisert betyr her: kapasitet i valgt oppsett er oppgitt med kilde, uten kildekonflikt, historisk pris eller ukjent mva.':'')+(M.basis==='room'?' Romleie og dagpakke er ulike produkter og vises aldri i samme kart.':M.basis==='day'?' Dagpakke er per person og inkluderer ulike ting hos ulike leverandører.':'')+'</p></section>'; }
function mpWidth(){ const vw=($('#view')?.clientWidth)||980, wide=vw>=1040; return {wide,W:Math.max(280,Math.min(900,(wide?vw-372-16:vw)-40))}; }
function mpPosHTML(){ const D=mpModel(), G=mpWidth(), M=UI.mp, F=D.F.v;
  return '<div class="mp-head"><div><h2>'+esc(F.name)+' i markedet</h2><p class="note">'+MKSEED.venues.filter(v=>!v.own).length+' andre lokaler og '+MKSEED.venues.filter(v=>v.own).length+' egne rom fra researchgrunnlaget, kontrollert '+esc(fdt(MKSEED.checked_on))+'. Publiserte referanser, ikke tilbud og ikke hele markedet.</p></div><button class="btn ghost sm" type="button" id="mpLim" aria-expanded="'+!!M.lim+'">Begrensninger i grunnlaget</button></div>'+
   (M.lim?'<div class="notice mp-lim"><ul>'+(MKSEED.limitations||[]).map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>':'')+
   mpFilters(D)+mpTiles(D)+
   '<div class="mp-grid'+(G.wide?' wide':'')+'"><section class="panel mp-map"><header><h2>'+(M.basis==='ask'?'Størrelse, uten pris':'Størrelse og publisert pris')+'</h2><span class="sub">Klikk et punkt for detaljer</span></header>'+mpLegend(D)+mpChart(D,G.W)+mpNoCap(D)+
     '<p class="note">Aktørkategori er Salongs egen grovsortering, ikke leverandørenes betegnelse. Størrelsen på et punkt viser hvor mange av seks leveranseområder kilden dokumenterer, og sier ikke noe om kvalitet.'+(M.basis==='room'?' Romleie kan inkludere ulik teknikk og leietid. Rabatterte og betingede priser er ikke plassert.':'')+'</p></section>'+mpSide(D)+'</div>'+
   mpTable(D)+
   '<section class="mp-cardsec"><div class="mp-sech"><h2>Posisjoneringskort</h2><span class="note">Egne formuleringer bygget på dokumenterte fakta. Utkast til de er godkjent av et menneske.</span></div>'+mkPosHTML()+'</section>'; }
V.marked.html=function(){ const M=UI.mk;
  return '<div class="mk"><div class="seg mk-tabs" role="tablist" aria-label="Marked og posisjon">'+[['posisjonering','Posisjonering'],['sammenlign','Sammenlign'],['laering','Læring fra saker']].map(([k,n])=>'<button type="button" role="tab" data-mktab="'+k+'" aria-selected="'+(M.tab===k)+'" aria-pressed="'+(M.tab===k)+'">'+n+'</button>').join('')+'</div>'+(M.tab==='sammenlign'?mcHTML():M.tab==='posisjonering'?mpPosHTML():mkLearnHTML())+'</div>'; };
{ const _w=V.marked.wire; V.marked.wire=function(v){ _w.call(this,v); if(UI.mk.tab==='posisjonering') mpWire(v); if(UI.mk.tab==='sammenlign') mcWire(v); }; }
function mpWire(v){ const M=UI.mp, rr=keep=>{ const id=keep&&document.activeElement&&document.activeElement.id, y=window.scrollY; renderView(true); if(id){ const el=document.getElementById(id); if(el) el.focus({preventScroll:true}); } window.scrollTo(0,y); };
  v.querySelectorAll('[data-mpset]').forEach(b=>b.addEventListener('click',()=>{ const [k,val]=b.dataset.mpset.split(':'); M[k]=val; if(k==='setup'||k==='basis') M.type=''; const y=window.scrollY; renderView(true); window.scrollTo(0,y); v.querySelector('[data-mpset="'+k+':'+val+'"]')?.focus({preventScroll:true}); }));
  $('#mpFocus')?.addEventListener('change',e=>{ M.focus=e.target.value; M.sel=''; rr(true); });
  $('#mpType')?.addEventListener('change',e=>{ M.type=e.target.value; const t=MP_TYPE[M.type]; if(t){ M.setup=t.setup; M.basis=t.basis; } rr(true); });
  $('#mpVer')?.addEventListener('change',e=>{ M.ver=e.target.checked; rr(true); });
  $('#mpReset')?.addEventListener('click',()=>{ Object.assign(M,{focus:'solstad',who:'alle',span:'',setup:'theatre',basis:'room',type:'',ver:false,sel:''}); rr(); });
  $('#mpLim')?.addEventListener('click',()=>{ M.lim=!M.lim; rr(true); });
  const pick=(id,focus)=>{ M.sel=id===M.focus?'':id; const y=window.scrollY; renderView(true); window.scrollTo(0,y); const s=$('#mpSide'); if(s&&focus){ s.focus({preventScroll:true}); s.scrollIntoView({block:'nearest'}); } };
  $('#mpBack')?.addEventListener('click',()=>pick(M.focus,true));
  const tip=$('#mpTip'), box=$('#mpChart');
  v.querySelectorAll('[data-mpv]').forEach(c=>{ c.addEventListener('click',()=>pick(c.dataset.mpv,true)); if(!c.classList.contains('mk-hit')) return;
    const show=()=>{ if(!tip||!box) return; tip.textContent=''; for(const [tag,t] of [['b',c.dataset.n],['span',c.dataset.p],['span',c.dataset.b]]){ const el=document.createElement(tag); el.textContent=t; tip.append(el); } tip.hidden=false; const r=c.getBoundingClientRect(), R=box.getBoundingClientRect(), x=r.left-R.left+r.width/2, y=r.top-R.top; tip.style.left=Math.max(4,Math.min(R.width-tip.offsetWidth-4,x-tip.offsetWidth/2))+'px'; tip.style.top=(y-tip.offsetHeight-6<0?y+r.height+6:y-tip.offsetHeight-6)+'px'; }, hide=()=>{ if(tip) tip.hidden=true; };
    c.addEventListener('pointerenter',show); c.addEventListener('pointerleave',hide); c.addEventListener('focus',show); c.addEventListener('blur',hide);
    c.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); pick(c.dataset.mpv,true); } }); });
  const setHyp=()=>{ const el=$('#mpHyp'); if(!el) return; const n=Number(el.value); M.hyp[M.basis]=n>0?String(Math.round(n)):''; rr(true); };
  $('#mpHypSet')?.addEventListener('click',setHyp); $('#mpHyp')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); setHyp(); } });
  $('#mpHypClr')?.addEventListener('click',()=>{ M.hyp[M.basis]=''; rr(); $('#mpHyp')?.focus({preventScroll:true}); }); }
window.addEventListener('resize',()=>{ clearTimeout(mpChart.t); mpChart.t=setTimeout(()=>{ if(UI.view==='marked'&&UI.mk.tab==='posisjonering'&&!UI.mk.pos&&!focusedIn($('#view'))) renderView(true); },160); });
/* lenke fra Kunnskap til ett lokale i kartet */
document.addEventListener('click',e=>{ const b=e.target.closest('[data-mkgo]'); if(b&&b.dataset.mkv&&mpV(b.dataset.mkv)){ UI.mp.sel=b.dataset.mkv===UI.mp.focus?'':b.dataset.mkv; if(UI.view==='marked') renderView(true); } });

/* ---------- Sammenlign: smart start, foreslåtte alternativer og side om side ----------
   Bygger på samme researchgrunnlag som kartet. Romleie og dagpakke står på hver sin rad og legges aldri sammen.
   Forslagene er de nærmeste i størrelse blant lokaler med oppgitt plass. Det er ingen rangering. */
const MC_SPAN={a:[80,120],b:[120,180],c:[180,260],d:[260,350]};
const MC_FS={ink:['Inkludert','c-avklart'],pak:['I pakke','c-forelopig'],til:['Tillegg','c-forelopig'],tilg:['Tilgjengelig','c-forelopig'],avk:['Må avklares','c-mangler'],konf:['Kildekonflikt','c-motstridende'],hist:['Historisk, 2025','c-mangler'],ingen:['Ikke dokumentert','c-mangler']};
UI.mc={focus:'solstad',span:null,n:'',type:'',setup:'theatre',needs:[],alts:null,adv:false,fine:false};
function mcState(){ const M=UI.mc; if(!mpV(M.focus)||!mpV(M.focus).own) M.focus='solstad'; const F=mpV(M.focus), cap=(F.capacities||{})[M.setup]??null;
  /* smart start: uten eget valg brukes spennet som rommets kapasitet faller i */
  const span=M.span!=null?M.span:cap==null?'':(Object.entries(MC_SPAN).find(([,x])=>cap>=x[0]&&cap<=x[1])||Object.entries(MC_SPAN).reverse().find(([,x])=>cap>=x[0])||['a'])[0];
  const n=Number(M.n)>0?Math.round(Number(M.n)):null, sp=n?[n,n]:MC_SPAN[span]||null, sug=mcSuggest(F,M.setup,sp);
  const A=(M.alts||sug).map(mpV).filter(v=>v&&v.id!==F.id).slice(0,3);
  return {M,F,n,sp,span,sug,A,auto:!M.alts}; }
function mcFit(v,setup,sp){ const c=(v.capacities||{})[setup]??null, rep=v.reported_max_seated??null;
  if(c==null) return {k:sp&&rep!=null&&rep<sp[0]?'small':'unknown',c,rep}; if(!sp) return {k:'none',c};
  return {k:c>=sp[1]?'full':c>=sp[0]?'partial':'small',c}; }
const mcSpTxt=sp=>sp?(sp[0]===sp[1]?nf.format(sp[0]):sp[0]+'–'+sp[1]):'';
function mcFitTxt(f,sp){ return f.k==='full'?(sp[0]===sp[1]?'Plass til '+nf.format(sp[0]):'Plass til hele spennet'):f.k==='partial'?'Plass til '+sp[0]+', ikke '+sp[1]:f.k==='small'?'For liten':f.k==='unknown'?'Kapasitet ikke oppgitt':''; }
const mcFitCls=f=>f.k==='full'?'c-avklart':f.k==='partial'?'c-forelopig':f.k==='small'?'c-motstridende':'c-mangler';
function mcSuggest(F,setup,sp){ const fc=(F.capacities||{})[setup]??null, ref=fc!=null?fc:sp?sp[1]:null;
  return MKSEED.venues.filter(v=>!v.own).map(v=>({v,f:mcFit(v,setup,sp)})).filter(x=>x.f.c!=null&&x.f.k!=='small').sort((a,b)=>ref==null?b.f.c-a.f.c:Math.abs(a.f.c-ref)-Math.abs(b.f.c-ref)||a.f.c-b.f.c).slice(0,3).map(x=>x.v.id); }
function mcSum(X){ const M=X.M, F=X.F, su=MP_SETUP[M.setup], f=mcFit(F,M.setup,X.sp), ext=MKSEED.venues.filter(v=>!v.own), known=ext.filter(v=>((v.capacities||{})[M.setup]??null)!=null);
  if(!X.sp) return F.name+' har '+(f.c!=null?nf.format(f.c)+' plasser i '+su:'ikke oppgitt kapasitet i '+su)+'. Velg et deltakerantall for å se hvem som har plass.';
  const room=known.filter(v=>v.capacities[M.setup]>=X.sp[0]), t=mcSpTxt(X.sp), one=X.sp[0]===X.sp[1];
  return (f.c==null?'Kapasitet i '+su+' er ikke oppgitt for '+F.name+'.':f.k==='full'?F.name+' har '+nf.format(f.c)+' plasser i '+su+' og har plass til '+(one?t+' deltakere':'hele spennet '+t)+'.':f.k==='partial'?F.name+' har '+nf.format(f.c)+' plasser i '+su+'. Det dekker '+X.sp[0]+', men ikke '+X.sp[1]+'.':F.name+' har '+nf.format(f.c)+' plasser i '+su+' og er for liten for '+t+' deltakere.')+
   ' I grunnlaget har '+room.length+' av '+known.length+' andre lokaler med oppgitt kapasitet plass til minst '+nf.format(X.sp[0])+(room.length?': '+room.map(mpLabel).join(', '):'')+'.'; }
function mcBrief(X){ const M=X.M, t=M.type?MP_TYPE[M.type].n.toLowerCase():'arrangement', need=k=>M.needs.includes(k)?' (krav)':'';
  return 'Forespørsel om lokale til '+t+(X.sp?' for '+mcSpTxt(X.sp)+' deltakere':'')+', oppsett '+MP_SETUP[M.setup]+'.\n\nVi ber om:\n1. Romleie eks. mva, leietid og hva leien inkluderer.\n2. Eventuell dagpakke per person, med avgiftsgrunnlag, minsteantall og innhold.\n3. Lyd og bilde: hva som er inkludert, og hva som koster ekstra'+need('av')+'.\n4. Bemanning og tekniker'+need('staff')+'.\n5. Rigg, oppsett og rydding'+need('setup')+'.\n6. Mat og drikke'+need('food')+'.\n7. Strømming og opptak'+need('stream')+'.\n8. Pause- og grupperom'+need('breakout')+'.\n9. Kapasitet i '+MP_SETUP[M.setup]+', avbestillingsvilkår og hvor lenge prisen gjelder.'; }
function mcUnc(v,X){ const M=X.M, U=mpFlags(v,M.setup).filter(f=>f.q).map(f=>f.t);
  if(!mpUsable(v)&&!(v.prices||[]).length) U.push('Pris må innhentes');
  for(const k of Object.keys(MS_FEAT)){ const s=mpFeat(v,k,'room').s; if(M.needs.includes(k)&&!['ink','pak','til','tilg'].includes(s)) U.push(MS_FEAT[k]+': '+MC_FS[s][0].toLowerCase()); }
  const open=Object.keys(MS_FEAT).filter(k=>['avk','ingen','hist'].includes(mpFeat(v,k,'room').s)).length; if(open) U.push(open+' av 6 leveranseområder er ikke dokumentert');
  if(v.planned_opening) U.push('Ikke i drift før '+msMonth(v.planned_opening));
  return U; }
function mcTable(X){ const M=X.M, cols=[X.F,...X.A], su=MP_SETUP[M.setup], o=M.setup==='theatre'?'classroom':'theatre', sp=X.sp, hyp=Number(UI.mp.hyp.room)>0?Number(UI.mp.hyp.room):null;
  const row=(lab,fn,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><th scope="row">'+lab+'</th>'+cols.map((v,i)=>'<td'+(i?'':' class="mc-own"')+'>'+fn(v,i)+'</td>').join('')+'</tr>', grp=t=>'<tr class="mc-g"><th colspan="'+(cols.length+1)+'" scope="colgroup">'+t+'</th></tr>';
  const pst=p=>'<span class="cst '+(MP_PST[p.status]||MP_PST.conditional)[1]+'">'+(MP_PST[p.status]||MP_PST.conditional)[0]+'</span>';
  const room=v=>{ const P=(v.prices||[]).filter(p=>p.kind==='room'||p.kind==='discount_room'); if(!P.length) return '<span class="st-warn">'+((v.prices||[]).length?'Ingen publisert romleie':'Ingen publisert pris. Pris må innhentes')+'</span>'+(v.id===X.F.id&&hyp?'<span class="s mc-hyp">Intern prishypotese: '+nf.format(hyp)+' kr. Ikke tilbud eller godkjent pris.</span>':'');
    return P.map(p=>'<div class="mc-p"><b>'+nf.format(p.amount)+' kr</b> '+pst(p)+'<span class="s">'+esc(p.label)+'. '+esc(p.condition||'')+'</span></div>').join(''); };
  const day=v=>{ const p=(v.prices||[]).find(p=>p.kind==='day'); if(!p) return '<span class="meta">Ingen publisert dagpakke</span>'; const ok=mpPrice(v,'day').y!=null, f=mcFit(v,M.setup,sp), hi=sp?(f.c!=null?Math.min(sp[1],f.c):sp[1]):null;
    return '<div class="mc-p"><b>'+nf.format(p.amount)+' kr</b> '+(p.tax_basis==='inc_vat'?'':'<span class="s2">'+msTax(p)+'</span> ')+pst(p)+'<span class="s">'+esc(p.label)+(p.minimum_people?', minst '+p.minimum_people+' personer':'')+'. '+esc(p.condition||'')+'</span>'+
     (!ok?'<span class="s st-warn">Brukes ikke i sammenligningen.</span>':sp&&f.k!=='small'&&hi>=sp[0]?'<span class="s mc-calc">For '+(sp[0]===hi?nf.format(hi):sp[0]+'–'+hi)+' deltakere'+(hi<sp[1]?' (lokalets kapasitet)':'')+': '+(sp[0]===hi?nf.format(p.amount*hi):nf.format(p.amount*sp[0])+'–'+nf.format(p.amount*hi))+' kr inkl. mva. Utregnet som '+nf.format(p.amount)+' kr × antall.</span>':'')+'</div>'; };
  const feat=k=>v=>{ const f=mpFeat(v,k,'room'); return '<span class="cst '+MC_FS[f.s][1]+'" title="'+esc(MP_FS[f.s][2])+'">'+MC_FS[f.s][0]+'</span>'+(f.label?'<span class="s">«'+esc(f.label)+'». '+esc(f.note)+'</span>':''); };
  return '<div class="mk-scroll"><table class="dense mc-tbl" style="min-width:'+(150+cols.length*210)+'px"><thead><tr><th scope="col"><span class="sr">Egenskap</span></th>'+cols.map((v,i)=>'<th scope="col"'+(i?'':' class="mc-own"')+'><span class="lbl">'+(i?MP_CAT[mpCat(v)].n:'Vårt rom')+'</span><b>'+esc(v.name)+'</b><span class="s">'+esc(v.operator)+'</span>'+(i?'<button class="btn ghost sm" type="button" data-mcalt="'+esc(v.id)+'" aria-label="Ta '+esc(mpFull(v))+' ut av sammenligningen">Ta ut</button>':'')+'</th>').join('')+'</tr></thead><tbody>'+
   grp('Størrelse')+row('Kapasitet i '+su,v=>{ const f=mcFit(v,M.setup,sp); return (f.c!=null?'<b class="mc-big">'+nf.format(f.c)+'</b>':'<span class="st-warn">Ikke oppgitt</span>'+(f.rep!=null?'<span class="s">Oppgitt '+nf.format(f.rep)+' sittende uten spesifisert oppsett</span>':''))+(sp?' <span class="cst '+mcFitCls(f)+'">'+mcFitTxt(f,sp)+'</span>':''); })+
   row('Andre mål',v=>{ const c=(v.capacities||{})[o]??null; return (c!=null?nf.format(c)+' i '+MP_SETUP[o]:'<span class="meta">'+MP_SETUP[o][0].toUpperCase()+MP_SETUP[o].slice(1)+' ikke oppgitt</span>')+(v.area_m2?' · '+nf.format(v.area_m2)+' m²':''); })+
   grp('Pris. Romleie og dagpakke er ulike produkter og legges ikke sammen')+row('Romleie eks. mva',room)+row('Dagpakke per person inkl. mva',day)+
   grp('Leveranse. Tilgjengelig betyr ikke inkludert')+Object.entries(MS_FEAT).map(([k,n])=>row(n+(M.needs.includes(k)?'<span class="s">Krav</span>':''),feat(k),M.needs.includes(k)?'need':'')).join('')+
   grp('Grunnlag')+row('Usikkerhet og mangler',v=>{ const U=mcUnc(v,X); return U.length?'<ul class="mc-unc">'+U.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'<span class="meta">Ingen registrert</span>'; })+
   row('Kilder',v=>(v.source_ids||[]).map(id=>mpSrcA(id)).join('<br>')+'<span class="s">Kontrollert '+esc(fdt(MKSEED.checked_on))+'</span>')+'</tbody></table></div>'; }
function mcBars(X){ const M=X.M, R=[X.F,...X.A], su=MP_SETUP[M.setup], sp=X.sp, mx=Math.max(100,sp?sp[1]:0,...R.map(v=>(v.capacities||{})[M.setup]||0))*1.06, pc=n=>(n/mx*100).toFixed(2)+'%';
  const marks=sp?(sp[0]===sp[1]?[sp[0]]:sp).map(n=>'<i class="mc-mark" style="left:'+pc(n)+'"></i>').join(''):'';
  return '<div class="mc-bars" role="img" aria-label="Kapasitet i '+su+': '+R.map(v=>mpLabel(v)+' '+(((v.capacities||{})[M.setup]??null)!=null?v.capacities[M.setup]:'ikke oppgitt')).join(', ')+(sp?'. Deltakere: '+mcSpTxt(sp):'')+'.">'+R.map((v,i)=>{ const c=(v.capacities||{})[M.setup]??null; return '<div class="mc-bar"><span class="mc-bl">'+esc(mpLabel(v))+'</span><span class="mc-bt">'+(c!=null?'<i class="mc-fill'+(i?'':' own')+'" style="width:'+pc(c)+'"></i>':'<span class="mc-na">Ikke oppgitt i '+su+(v.reported_max_seated!=null?'. Oppgitt '+nf.format(v.reported_max_seated)+' sittende uten oppsett':'')+'</span>')+marks+'</span><span class="mc-bv">'+(c!=null?nf.format(c):'')+'</span></div>'; }).join('')+'</div>'+(sp?'<p class="note">Stiplet linje: '+(sp[0]===sp[1]?nf.format(sp[0])+' deltakere':sp[0]+' og '+sp[1]+' deltakere')+'. Kapasitet er leverandørens oppgitte tall for '+su+' og kan avhenge av scene og møblering.</p>':''); }
function mcHTML(){ const X=mcState(), M=X.M, F=X.F, su=MP_SETUP[M.setup], ids=new Set(X.A.map(v=>v.id)), advOpen=M.adv||UI.mk.edit||!!UI.mk.scen, canHyp=!mpUsable(F), nSc=mkL('mscen').length;
  const seg=(key,opts,lab)=>'<div class="mp-f"><span class="lbl" id="mcl-'+key+'">'+lab+'</span><div class="seg" role="group" aria-labelledby="mcl-'+key+'">'+opts.map(([k,n])=>'<button type="button" data-mcset="'+key+':'+k+'" aria-pressed="'+(String(key==='span'?X.span:M[key])===String(k)&&!(key==='span'&&X.n))+'">'+n+'</button>').join('')+'</div></div>';
  const chip=v=>{ const f=mcFit(v,M.setup,X.sp), on=ids.has(v.id); return '<button type="button" class="mp-chipb'+(on?' on':'')+'" data-mcalt="'+esc(v.id)+'" aria-pressed="'+on+'">'+esc(mpLabel(v))+'<span>'+(f.c!=null?nf.format(f.c)+' i '+su:'kapasitet ikke oppgitt')+(X.sp&&f.k!=='unknown'&&mcFitTxt(f,X.sp)?' · '+mcFitTxt(f,X.sp).toLowerCase():'')+(X.sug.includes(v.id)?' · foreslått':'')+'</span></button>'; };
  const ext=MKSEED.venues.filter(v=>!v.own).sort((a,b)=>(((b.capacities||{})[M.setup])||0)-(((a.capacities||{})[M.setup])||0)), own=MKSEED.venues.filter(v=>v.own&&v.id!==F.id&&((v.capacities||{})[M.setup]??null)!=null);
  const ok=mkL('mpos').filter(c=>c.status==='godkjent');
  return '<div class="mp-head"><div><h2>Sammenlign '+esc(F.name)+'</h2><p class="note">Side om side med inntil tre alternativer fra researchgrunnlaget, kontrollert '+esc(fdt(MKSEED.checked_on))+'. Publiserte referanser, ikke tilbud.</p></div></div>'+
   '<section class="panel mp-filters mc-start" aria-label="Hva skal sammenlignes"><div class="mp-frow"><div class="mp-f"><label class="lbl" for="mcFocus">Vårt rom</label><select class="in fsel" id="mcFocus">'+MKSEED.venues.filter(v=>v.own).map(v=>'<option value="'+esc(v.id)+'"'+(M.focus===v.id?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></div>'+
     seg('span',[['a','80–120'],['b','120–180'],['c','180–260'],['d','260–350']],'Deltakere')+seg('type',Object.entries(MP_TYPE).map(([k,t])=>[k,t.n]),'Arrangementstype')+
     '<button class="btn ghost sm mp-reset" type="button" id="mcFine" aria-expanded="'+!!M.fine+'">'+(M.fine?'Skjul finjustering':'Finjuster')+'</button></div>'+
    (M.fine?'<div class="mc-fine"><div class="mp-frow"><div class="mp-f"><label class="lbl" for="mcN">Nøyaktig antall deltakere</label><input class="in" id="mcN" type="number" inputmode="numeric" min="1" max="2000" value="'+esc(M.n)+'" placeholder="Bruker spennet"></div>'+seg('setup',[['theatre','Stolrader'],['classroom','Klasserom']],'Oppsett')+
      (canHyp?'<div class="mp-f"><label class="lbl" for="mcHyp">Intern prishypotese, romleie eks. mva</label><input class="in" id="mcHyp" type="number" inputmode="numeric" min="0" step="1000" value="'+esc(UI.mp.hyp.room||'')+'" placeholder="Ikke satt"></div>':'')+'</div>'+
      '<fieldset class="mc-needs"><legend class="lbl">Må være dokumentert</legend>'+Object.entries(MS_FEAT).map(([k,n])=>'<label class="check"><input type="checkbox" data-mcneed="'+k+'"'+(M.needs.includes(k)?' checked':'')+'>'+n+'</label>').join('')+'</fieldset>'+(canHyp?'<p class="note">Prishypotesen er intern, ikke tilbud eller godkjent pris. Den lagres ikke.</p>':'')+'</div>':'')+
    '<p class="mc-sum" aria-live="polite">'+esc(mcSum(X))+(M.type?' <span class="note">'+MP_TYPE[M.type].n+' setter oppsettet til '+MP_SETUP[MP_TYPE[M.type].setup]+'. Grunnlaget sier ikke hvilke lokaler som egner seg for typen.</span>':'')+'</p></section>'+
   '<section class="panel"><header><h2>Alternativer</h2><span class="sub">'+(X.auto?'Foreslått av Salong':'Valgt av deg')+' · '+X.A.length+' av inntil 3</span></header><p class="note">'+(X.auto?(X.A.length?'Forslagene er de andre lokalene som ligger nærmest '+esc(F.name)+' i størrelse, blant dem med oppgitt plass'+(X.sp?' til minst '+nf.format(X.sp[0]):'')+' i '+su+'. Det er ikke en rangering.':'Ingen andre lokaler i grunnlaget har oppgitt plass'+(X.sp?' til '+mcSpTxt(X.sp):'')+' i '+su+'. Velg selv under, eller endre antallet.'):'Du har valgt selv.')+' Klikk for å legge til eller ta ut.</p>'+
     '<div class="mp-chips">'+ext.map(chip).join('')+'</div>'+(own.length?'<div class="mc-ownalt"><span class="lbl">Egne rom</span><div class="mp-chips">'+own.map(chip).join('')+'</div></div>':'')+(X.auto?'':'<div class="row"><button class="btn ghost sm" type="button" id="mcAuto">Tilbake til forslagene</button></div>')+'</section>'+
   (X.A.length?'<section class="panel mc-side"><header><h2>Side om side</h2><span class="sub">'+(X.sp?mcSpTxt(X.sp)+' deltakere · ':'')+su+'</span></header>'+mcTable(X)+'<p class="note">Priser er publiserte referanser fra '+esc(fdt(MKSEED.checked_on))+'. Pris for arrangementer i 2027 må bekreftes av leverandøren.</p></section>'+
    '<section class="panel"><header><h2>Kapasitet mot deltakerantallet</h2><span class="sub">'+su+'</span></header>'+mcBars(X)+'</section>'+
    '<section class="panel"><header><h2>Dokumenterte forskjeller</h2><span class="sub">Regnet ut fra tallene, uten vurderinger</span></header><div class="mc-diffs">'+X.A.map(v=>'<div class="mc-diff"><h3>'+esc(F.name)+' og '+esc(mpLabel(v))+'</h3><ul class="mp-how">'+mpHow(F,v,M.setup).map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul><div class="row"><button class="btn ghost sm" type="button" data-mcmap="'+esc(v.id)+'">Se i kartet</button><button class="btn ghost sm" type="button" data-mccard="'+esc(v.id)+'">Lag kortutkast fra dette</button></div></div>').join('')+'</div></section>':'<section class="panel"><div class="mk-empty"><b>Ingen alternativer er valgt.</b><span>Velg ett til tre lokaler over.</span></div></section>')+
   '<section class="panel"><header><h2>Godkjente salgsargumenter</h2><span class="sub">'+ok.length+' godkjent</span></header>'+(ok.length?'<ul class="mc-args">'+ok.map(c=>'<li><span class="mk-word">'+esc(c.wording)+'</span><span class="meta">'+esc(c.need)+(c.test?' · TESTDATA':'')+'</span></li>').join('')+'</ul>':'<p class="note">Ingen kort er godkjent ennå. Egne styrker vises her først når et menneske har godkjent formuleringen. Salong skriver ikke styrker selv.</p>')+'<div class="row"><button class="btn ghost sm" type="button" data-mktabgo="posisjonering">Åpne posisjoneringskortene</button></div></section>'+
   '<section class="panel"><header><h2>Innhent sammenlignbart tilbud</h2><span class="sub">Generisk tekst du kan sende selv</span></header><textarea class="in" id="mcBrief" rows="13" readonly aria-label="Forespørselstekst">'+esc(mcBrief(X))+'</textarea><div class="row"><button class="btn sm" type="button" data-copy="mcBrief">Kopier</button><span class="note">Teksten bygges bare av valgene over. Kundenavn, saker, notater og priser er ikke med. Salong sender ingenting.</span></div></section>'+
   '<section class="mc-adv"><div class="mp-sech"><h2>Avansert: eget scenario</h2><span class="note">Registrer egne alternativer med kilder og regn ut totalpris for ett konkret arrangement. '+nSc+' scenario'+(nSc===1?'':'er')+' lagret.</span><button class="btn ghost sm" type="button" id="mcAdv" aria-expanded="'+!!advOpen+'">'+(advOpen?'Skjul':'Åpne')+'</button></div>'+(advOpen?mkCompareHTML().replace('Uten scenario finnes det ikke noe sammenlignbart grunnlag, og derfor ingen sammenligning.','Hurtigsammenligningen over trenger ikke scenario.'):'')+'</section>'; }
function mcWire(v){ const M=UI.mc, rr=id=>{ const y=window.scrollY; renderView(true); window.scrollTo(0,y); if(id){ const el=typeof id==='string'?v.querySelector(id):null; if(el) el.focus({preventScroll:true}); } };
  v.querySelectorAll('[data-mcset]').forEach(b=>b.addEventListener('click',()=>{ const [k,val]=b.dataset.mcset.split(':'); if(k==='type'){ M.type=M.type===val?'':val; if(M.type) M.setup=MP_TYPE[M.type].setup; } else { M[k]=val; if(k==='span') M.n=''; if(k==='setup') M.type=''; } rr('[data-mcset="'+k+':'+val+'"]'); }));
  $('#mcFocus')?.addEventListener('change',e=>{ M.focus=e.target.value; M.span=null; M.n=''; M.alts=null; rr('#mcFocus'); });
  $('#mcFine')?.addEventListener('click',()=>{ M.fine=!M.fine; rr('#mcFine'); });
  $('#mcN')?.addEventListener('change',e=>{ const n=Number(e.target.value); M.n=n>0?String(Math.round(n)):''; rr('#mcN'); });
  $('#mcHyp')?.addEventListener('change',e=>{ const n=Number(e.target.value); UI.mp.hyp.room=n>0?String(Math.round(n)):''; rr('#mcHyp'); });
  v.querySelectorAll('[data-mcneed]').forEach(c=>c.addEventListener('change',()=>{ const k=c.dataset.mcneed; M.needs=c.checked?[...new Set([...M.needs,k])]:M.needs.filter(x=>x!==k); rr('[data-mcneed="'+k+'"]'); }));
  v.querySelectorAll('[data-mcalt]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.mcalt, cur=mcState().A.map(x=>x.id);
    if(cur.includes(id)) M.alts=cur.filter(x=>x!==id); else if(cur.length>=3){ toast('Høyst tre alternativer side om side. Ta ut ett først.'); return; } else M.alts=[...cur,id];
    rr('.mp-chipb[data-mcalt="'+id+'"]'); }));
  $('#mcAuto')?.addEventListener('click',()=>{ M.alts=null; rr(); });
  $('#mcAdv')?.addEventListener('click',()=>{ const open=M.adv||UI.mk.edit||!!UI.mk.scen; if(open){ M.adv=false; UI.mk.scen=''; UI.mk.edit=false; UI.mk.sel=''; } else M.adv=true; rr('#mcAdv'); });
  v.querySelectorAll('[data-mcmap]').forEach(b=>b.addEventListener('click',()=>{ Object.assign(UI.mp,{focus:M.focus,setup:M.setup,sel:b.dataset.mcmap}); UI.mk.tab='posisjonering'; renderView(true); window.scrollTo(0,0); }));
  v.querySelectorAll('[data-mccard]').forEach(b=>b.addEventListener('click',()=>mcCard(b.dataset.mccard)));
  v.querySelectorAll('[data-mktabgo]').forEach(b=>b.addEventListener('click',()=>{ UI.mk.tab=b.dataset.mktabgo; renderView(true); const s=$('.mp-cardsec'); if(s) s.scrollIntoView({block:'start'}); })); }

/* ---------- læring fra saker: hvilke rom vant med, tapsgrunner, gjentatte argumenter ---------- */
function mkLearnRows(){ const won=dealsOp().filter(d=>d.stage==='bekreftet'), lost=dealsOp().filter(d=>d.stage==='tapt'), byRoom={};
  for(const d of [...won,...lost]){ const v=mpV(d.room); if(!v) continue; const k=d.room; if(!byRoom[k]) byRoom[k]={v,won:0,lost:0,cases:[]}; if(d.stage==='bekreftet') byRoom[k].won++; else byRoom[k].lost++; byRoom[k].cases.push(d); }
  return Object.entries(byRoom).map(([id,data])=>{const r=data.v; return {...data,id,rate:data.won+data.lost>0?Math.round(100*data.won/(data.won+data.lost)):0,cap:(r.capacities||{})[MP_SETUP.theatre]??null}; }).sort((a,b)=>b.won-a.won||b.rate-a.rate); }
function mkLearnSum(){ const rooms=mkLearnRows(), total=rooms.reduce((s,r)=>s+r.won+r.lost,0);
  return {totalDeals:total,totalWon:rooms.reduce((s,r)=>s+r.won,0),totalLost:rooms.reduce((s,r)=>s+r.lost,0),winRate:total>0?Math.round(100*rooms.reduce((s,r)=>s+r.won,0)/total):0,rooms}; }
/* filtrerte eksempler: de 5 nyeste av hver type (vunnet/tapte), og hvis tapte har grunner som er dokumentert */
function mkLearnExamples(){ const all=dealsOp().filter(d=>d.stage==='bekreftet'||d.stage==='tapt').sort((a,b)=>(b.stageAt||'').localeCompare(a.stageAt||'')), won=all.filter(d=>d.stage==='bekreftet'), lost=all.filter(d=>d.stage==='tapt'), reasons=lost.filter(d=>d.lostReason&&d.lostReason.trim()).slice(0,8);
  return {recent:all.slice(0,5),recentWon:won.slice(0,5),recentLost:lost.slice(0,5),documented:reasons}; }
function mkLearnHTML(){ const sum=mkLearnSum(), ex=mkLearnExamples(); if(!sum.totalDeals) return '<div class="mk-empty"><b>Ingen avsluttede saker ennå.</b><span>Når arrangementer er bekreftet eller avslått, bygges læringen gradvis.</span></div>';
  const mkRoom=r=>'<li><div><h4>'+esc(r.v.name)+'</h4><span class="meta">'+r.won+' vunnet'+
    (r.lost?' · '+r.lost+' tapt':'')+(r.cap?' · '+nf.format(r.cap)+' plasser':'')+'</span></div><div class="prog">'+
    '<span class="mark" style="width:'+r.rate+'%"></span></div><span class="stat">'+r.rate+'% vinnrate'+(r.won+r.lost>3?'':' (små tall)')+'</span></li>';
  const mkDeal=d=>{ const o=S.orgs[d.orgId], title=o?esc(o.name)+' · '+esc(d.title):esc(d.title); return '<li><span class="title">'+title+'</span>'+
    (d.date?'<span class="meta">'+fd(d.date,{day:'numeric',month:'short',year:'numeric'})+'</span>':'')+
    (d.lostReason?'<span class="reason">'+esc(d.lostReason)+'</span>':'')+'</li>'; };
  return '<div class="panel"><header><h2>Oversikt: vinnrater per rom</h2></header><ul class="mk-learn-rooms">'+sum.rooms.map(mkRoom).join('')+'</ul></div>'+
    '<div class="panel"><header><h2>Samlet vinnrate</h2><span class="stat">'+sum.totalWon+' av '+sum.totalDeals+' · '+sum.winRate+'%</span></header>'+
    '<p class="note">Vinnraten er kun basert på avsluttede saker (bekreftet eller tapt). Saker i dialog eller visning telles ikke.</p></div>'+
    (ex.documented.length?'<div class="panel"><header><h2>Dokumenterte tapsgrunner</h2></header><ul class="mk-deals">'+ex.documented.map(mkDeal).join('')+'</ul><p class="note">Disse tilfellene har registerert avslag-grunn.</p></div>':'') +
    '<div class="panel"><header><h2>Nyeste saker</h2></header><ul class="mk-deals">'+ex.recent.map(d=>'<li><span class="status '+(d.stage==='bekreftet'?'won':'lost')+'">'+esc(ST[d.stage]?.n||d.stage)+'</span> '+mkDeal(d).replace('<li>','').slice(0,-5)+'</li>').join('')+'</ul></div>'; }

/* ---------- utkast til posisjoneringskort fra kart, sammenligning eller læring. Ingenting lagres før brukeren lagrer selv. ---------- */
const mpSrcLine=id=>{ const x=MSRC[id]; return x?x.title+': '+x.url+' (kontrollert '+fdt(x.checked_on)+')':''; };
function mpFacts(F){ const c=F.capacities||{}, P=[c.theatre!=null?nf.format(c.theatre)+' plasser i stolrader':'',c.classroom!=null?nf.format(c.classroom)+' i klasserom':'',F.area_m2?nf.format(F.area_m2)+' m²':''].filter(Boolean);
  return F.name+(P.length?' har '+(P.length>1?P.slice(0,-1).join(', ')+' og '+P[P.length-1]:P[0])+'.':' har ingen oppgitt kapasitet i grunnlaget.')+(F.planned_opening?' Planlagt åpning '+msMonth(F.planned_opening)+'.':''); }
function mpDraft(o){ if(readOnly){ toast('Du har lesetilgang og kan ikke lage kort.'); return; }
  UI.mk.pos={need:o.need||'',prop:o.prop||'',propKind:'dokumentert',value:'',wording:'',srcText:(o.srcs||[]).filter(Boolean).join('\n'),sources:(o.srcs||[]).filter(Boolean).map(ref=>({ref})),compareRef:o.compareRef||'',ownerId:(actor()||{}).id||null,status:'utkast',aiDraft:false,from:o.from||null};
  UI.mk.aiErr=''; UI.mk.tab='posisjonering'; renderView(true); const f=$('.mk-posf'); if(f){ f.scrollIntoView({block:'start'}); f.querySelector('[data-mkp="need"]')?.focus({preventScroll:true}); } toast('Utkastet er fylt ut med fakta og kilder. Skriv formuleringen og lagre.'); }
function mcCard(id){ const X=mcState(), F=X.F, v=mpV(id); if(!v) return;
  mpDraft({need:(X.M.type?MP_TYPE[X.M.type].n:'Arrangement')+(X.sp?' for '+mcSpTxt(X.sp)+' deltakere':''),prop:mpFacts(F),srcs:(F.source_ids||[]).map(mpSrcLine),compareRef:'Sammenlignet med '+mpFull(v)+' i Salong. '+mpHow(F,v,X.M.setup)[0]+' Researchgrunnlag kontrollert '+fdt(MKSEED.checked_on)+'.',from:{type:'sammenligning',focus:F.id,alt:v.id,setup:X.M.setup,span:X.sp?mcSpTxt(X.sp):'',at:iso(new Date())}}); }
