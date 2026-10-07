/* ---------- Dataopprinnelse ----------
   Operative flater (I dag, Denne uken og måneden, arbeidslister, batcher, sekvenser, prognose, kalenderbelegg og
   markedsdekning) bygger bare på data brukeren har registrert selv, eller på beslutninger som faktisk er tatt.
   Eksempeldata, testdata og data med ukjent opprinnelse ligger fortsatt i Kunder, historikk og kundestatistikk,
   men telles ikke i operative flater eller beslutningsstøtte. Ingenting slettes og ingenting gjettes.
   Opprinnelse regnes ut fra feltene på posten, og kan overstyres av brukeren («Behold som ekte» under Datastatus).
     user    brukerregistrert eller importert av brukeren
     public  offentlig kilde: researchprofil uten egen post i CRM
     example eksempeldata (merket example:true)
     test    testdata ([TEST] eller test:true)
     unknown samme ID som den innebygde demoen, men uten eksempelmerke: uklar opprinnelse
   UI.incEx er en testkrok. Den har ingen knapp i grensesnittet, slik at produksjonsflaten ikke blir en demodatabase. */
UI.incEx=false;
const DQ_LBL={user:'Brukerregistrert',public:'Offentlig kilde',example:'Eksempel',test:'Test',unknown:'Ukjent opprinnelse'};
function dqOrigin(rec,col,id){
  if(!rec) return 'unknown';
  if(rec.test===true||/^\[TEST\]/i.test(String(rec.name||rec.title||rec.text||''))) return 'test';
  if(rec.dataStatus==='confirmed') return 'user';
  if(rec.example) return 'example';
  if(id&&typeof DEMO==='object'&&DEMO[col]&&DEMO[col][id]) return 'unknown';
  return 'user';
}
/* kan posten brukes i operative flater og beslutningsstøtte? */
const dqOk=(rec,col,id)=>UI.incEx||dqOrigin(rec,col,id||rec&&rec.id)==='user';
const dealsOp=()=>deals().filter(d=>dqOk(d,'deals',d.id));
const actsOp=()=>acts().filter(a=>dqOk(a,'acts',a.id));
const orgsOp=()=>orgs().filter(o=>dqOk(o,'orgs',o.id));
const openTasksOp=()=>actsOp().filter(a=>a.type==='task'&&!a.done).sort((a,b)=>(a.due||'').localeCompare(b.due||''));
/* oversikt til Datastatus */
function dqCounts(){
  const out={}, add=(k,col,rec,id)=>{ const o=dqOrigin(rec,col,id); (out[k]=out[k]||{user:0,public:0,example:0,test:0,unknown:0})[o]++; };
  for(const [id,x] of Object.entries(S.orgs)) if(x&&!x.deletedAt) add('Organisasjoner','orgs',x,id);
  for(const [id,x] of Object.entries(S.deals)) if(x&&!x.deletedAt) add('Saker','deals',x,id);
  for(const [id,x] of Object.entries(S.acts)) if(x&&!x.deletedAt) add('Aktiviteter og oppgaver','acts',x,id);
  for(const [id,x] of Object.entries(S.offers||{})) if(x&&!x.deletedAt) add('Tilbud','offers',x,id);
  const pub=Object.values(PROFILES).filter(p=>!S.orgs[p.id]).length; if(pub){ out['Organisasjoner']=out['Organisasjoner']||{user:0,public:0,example:0,test:0,unknown:0}; out['Organisasjoner'].public+=pub; }
  return out;
}
function dqReview(){ const L=[]; for(const [col,k] of [['orgs','Organisasjon'],['deals','Sak'],['acts','Aktivitet']]) for(const [id,x] of Object.entries(S[col])){ if(!x||x.deletedAt) continue; const o=dqOrigin(x,col,id); if(o!=='user') L.push({col,id,k,o,name:x.name||x.title||x.text||id}); } return L; }
function dqStatusHTML(){
  const C=dqCounts(), rows=Object.entries(C), review=dqReview(), N=review.length, lim=UI.dqAll?review.length:30;
  return '<h2>Datastatus</h2><p class="note">Hvilke data som kan drive I dag, arbeidslister, prognose, kalenderbelegg og markedsdekning. Bare brukerregistrerte data teller der. Alt annet ligger i Kunder og historikk, men skaper verken oppgaver eller tall.</p>'+
   '<table class="dense dq"><thead><tr><th>Samling</th><th class="n">'+DQ_LBL.user+'</th><th class="n">'+DQ_LBL.public+'</th><th class="n">'+DQ_LBL.example+'</th><th class="n">'+DQ_LBL.test+'</th><th class="n">'+DQ_LBL.unknown+'</th></tr></thead><tbody>'+
   (rows.length?rows.map(([k,c])=>'<tr><td class="name">'+esc(k)+'</td>'+['user','public','example','test','unknown'].map(o=>'<td class="n'+(c[o]&&o!=='user'&&o!=='public'?' warn':'')+'">'+c[o]+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="6" class="empty">Ingen data ennå.</td></tr>')+'</tbody></table>'+
   '<h3 class="sub3">'+(N?N+' poster venter på gjennomgang':'Ingen poster venter på gjennomgang')+'</h3>'+
   (N?'<p class="note">Poster merket eksempel, test eller med ukjent opprinnelse er holdt utenfor. «Behold som ekte» gjelder bare når du vet at posten er reell. Permanent sletting av eksempeldata ligger under Faresone.</p>'+
    '<ul class="dq-list">'+review.slice(0,lim).map(r=>'<li><span class="dq-k">'+esc(r.k)+'</span><span class="dq-n">'+esc(String(r.name).slice(0,90))+'</span><span class="meta">'+esc(DQ_LBL[r.o])+'</span><button class="btn ghost sm" type="button" data-dqkeep="'+esc(r.col+'|'+r.id)+'">Behold som ekte</button></li>').join('')+'</ul>'+(N>lim?'<button class="btn ghost sm" type="button" id="dqAll">Vis alle '+N+'</button>':''):'');
}
function wireDq(v){
  $('#dqAll')?.addEventListener('click',()=>{ UI.dqAll=true; renderView(true); });
  v.querySelectorAll('[data-dqkeep]').forEach(b=>b.addEventListener('click',async()=>{ const [col,id]=b.dataset.dqkeep.split('|'), x=S[col]&&S[col][id]; if(!x) return; const {id:_i,...rest}=x; await put(col,id,{...rest,dataStatus:'confirmed'},{action:'markert som ekte data'}); toast('Posten er markert som ekte og teller i operative flater'); }));
}
