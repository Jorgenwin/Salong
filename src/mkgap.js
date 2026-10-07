/* ---------- mkgap.js: Marked og posisjon: MARKEDSGAP ----------
   Marked analyserer segmenter og eier aldri en kontaktliste. Segmentfit viser derfor:
   1) MARKEDSGAP: store segmenter der lite eller ingenting er bearbeidet, med Solstad-fit og typisk bookingverdi fra egne bekreftede saker.
   2) Hvilke segmenter som passer Solstad (eksisterende analyse) og hvilke som er underrepresentert i kundebasen.
   Alt leses fra Prospekter (mtSegStats/mtAll) og egne saker. Størrelse er segmentets størrelsesklasse eller brukerens eget anslag, aldri et oppdiktet antall.
   Prioriteringsflaten (organisasjoner som bobler) ligger i Prospekter. «Lignende aktører vi ikke har» er fjernet: nye accounts kommer bare fra research eller import med kilde. */
const MKG_EST={L:['Stor',3],M:['Middels',2],S:['Liten',1]};
const mkgMedian=a=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
function mkgRows(){
  const est=typeof covEst==='function'?covEst():{}, all=mtAll(), cust=all.filter(a=>a.kind!=='ny');
  return mtSegStats().filter(s=>s.id&&s.on!==false).map(s=>{
    const ny=all.filter(a=>a.kind==='ny'&&a.segId===s.id&&!a.flags.disqualified&&!a.dncAcc), user=est[s.id]>0?est[s.id]:null, base=Math.max(s.discovered,user||0), worked=base?s.addressed/base:0;
    const rm=ny.filter(a=>a.room&&a.room.value&&a.room.value!=='Ukjent'), sol=rm.filter(a=>/solstad/i.test(a.room.value)).length;
    const vals=[]; for(const a of cust.filter(x=>x.segId===s.id)) for(const d of (a.deals||[])) if(d.stage==='bekreftet'&&dval(d)>0) vals.push(dval(d));
    const cls=MKG_EST[s.est]||null;
    return {s,cls,user,worked,addressed:s.addressed,identified:s.discovered,assessed:rm.length,sol,val:mkgMedian(vals),nVal:vals.length,rank:(s.prio==='P0'?0:s.prio==='P1'?1:2)*10-(cls?cls[1]:0)-(user?1:0)}; })
  .filter(r=>(r.cls&&r.cls[1]>=2||r.user>0)&&r.worked<0.1).sort((a,b)=>a.rank-b.rank||(b.user||0)-(a.user||0)); }
function mkgHTML(){
  const R=mkgRows().slice(0,5);
  const row=r=>'<tr><th scope="row"><b>'+esc(mtSegShort(r.s.name))+'</b><span class="k3sub">'+esc(r.s.prio)+'</span></th>'+
    '<td>'+(r.cls?esc(r.cls[0]):'Ukjent')+(r.user?'<span class="k3sub">ditt anslag: '+r.user+'</span>':'')+'</td>'+
    '<td class="n">'+Math.round(r.worked*100)+' %<span class="k3sub">'+r.addressed+' av '+(r.user||r.identified)+(r.user?' anslått':' identifisert')+'</span></td>'+
    '<td>'+(r.assessed?r.sol+' av '+r.assessed+' vurderte':'<span class="k3sub">ikke vurdert</span>')+'</td>'+
    '<td class="n">'+(r.val!=null?short(r.val):'<span class="k3sub">ingen historikk</span>')+(r.val!=null?'<span class="k3sub">median, '+r.nVal+' bekreftede</span>':'')+'</td>'+
    '<td class="n"><button type="button" class="btn ghost sm" data-mkgopen="'+esc(r.s.id)+'">Åpne segment i Prospekter</button></td></tr>';
  return '<section class="m3-sec mkg"><div class="m3-sech"><div><h2>Markedsgap</h2><p class="note">Store segmenter der under 10 % er bearbeidet. Størrelse er segmentets klasse eller ditt eget anslag i Prospekter. Solstad-fit er hvor mange av de vurderte accountene som har fått Solstad som romfit. Bookingverdi er medianen av egne bekreftede saker i segmentet.</p></div></div>'+
    (R.length?'<div class="tbl"><table class="k3c mkg-t"><thead><tr><th>Segment</th><th>Størrelse</th><th class="n">Bearbeidet</th><th>Solstad-fit</th><th class="n">Typisk bookingverdi</th><th></th></tr></thead><tbody>'+R.map(row).join('')+'</tbody></table></div>':'<p class="empty">Ingen store segmenter er under 10 % bearbeidet.</p>')+'</section>'; }
function m3SimHTML(){ const U=u3Under().slice(0,3);
  return '<section class="m3-box"><h3>Underrepresentert i kundebasen</h3>'+(U.length?'<ul class="m3-und">'+U.map(u=>'<li><b>'+esc(u.seg)+'</b><span>'+Math.round(u.mkt*100)+' % av markedet, '+Math.round(u.own*100)+' % av kundene ('+u.cust+' kunder)</span></li>').join('')+'</ul><p class="note">Sammenligner segmentets andel av anslått marked med andelen av dagens og tidligere kunder.</p>':'<p class="empty">Kundebasen speiler markedet godt nok til at ingen segmenter skiller seg ut.</p>')+'</section>'; }
function m3Seg(){ return '<div class="m3">'+mkgHTML()+m3SegTable()+m3SimHTML()+'</div>'; }
{ const _w=V.marked.wire; V.marked.wire=function(v){ _w.apply(this,arguments);
  v.querySelectorAll('[data-mkgopen]').forEach(b=>b.addEventListener('click',()=>{ UI.mt.tab='mal'; UI.mt.seg=b.dataset.mkgopen; UI.mt.kind='ny'; UI.mt.page=1; go('prosp'); })); }; }
