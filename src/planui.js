/* ---------- Seksmånedersmål: visning og redigering (Mål og prognose) ----------
   Alt leses fra crm.goals / planningService. Ingen egne mål for måned, uke eller dag. */
UI.pl=UI.pl||{edit:false,err:''};
const plD=s=>fd(s,{day:'numeric',month:'short',year:'numeric'});
const plNum=n=>nf.format(Math.round(n||0));
function plPaceChip(p){ const m={'nådd':['Nådd','ok'],'på sporet':['På sporet','ok'],'litt bak':['Litt bak','warn'],'bak':['Bak plan','bad'],'ikke startet':['Ikke startet','mute'],'under':['Under plan','warn']}[p]||['','']; return m[0]?'<span class="pl-chip '+m[1]+'">'+m[0]+'</span>':''; }
function plEditorHTML(P){
  const g=P.goal, sug=P.status==='not_set'?P.suggestion:null, dp=planningService.defaultPeriod();
  const v={type:g?g.type:(sug?sug.type:'value'),target:g?g.target:(sug?sug.target:''),a:g?g.period_start:(sug?sug.period_start:dp.start),b:g?g.period_end:(sug?sug.period_end:dp.end)};
  return '<div class="pl-ed"><div class="pl-fields">'+
    '<label class="f"><span>Måltype</span><select class="in" id="plType"><option value="value"'+(v.type==='value'?' selected':'')+'>Bekreftet ny utleieverdi (kr)</option><option value="bookings"'+(v.type==='bookings'?' selected':'')+'>Antall bekreftede bookinger</option></select></label>'+
    '<label class="f"><span>Mål for hele perioden</span><input class="in" type="number" min="1" step="'+(v.type==='bookings'?1:50000)+'" id="plTarget" value="'+esc(v.target)+'" placeholder="F.eks. 2500000"></label>'+
    '<label class="f"><span>Start</span><input class="in" type="date" id="plA" value="'+esc(v.a)+'"></label><label class="f"><span>Slutt</span><input class="in" type="date" id="plB" value="'+esc(v.b)+'"></label>'+
    (g?'<label class="f wide"><span>Hvorfor endres målet? (valgfritt, lagres i historikken)</span><input class="in" id="plReason" placeholder="F.eks. nytt budsjett"></label>':'')+'</div>'+
    (sug?'<p class="meta">'+esc(sug.basis)+'</p>':'')+(UI.pl.err?'<p class="meta bad" role="alert">'+esc(UI.pl.err)+'</p>':'')+
    '<div class="row"><button class="btn primary" type="button" id="plSave">'+(g?'Lagre endring':'Sett seksmånedersmål')+'</button>'+(g?'<span class="meta">Opprinnelig mål og opprinnelig plan endres aldri. Planen regnes på nytt fra i dag.</span>':'')+'</div></div>'; }
function plSectionHTML(){
  const P=planningService.getPlan();
  if(P.status==='not_set') return '<section class="pl-sec"><div class="pl-h"><h3>Seksmånedersmål</h3></div><p class="g3-lead">Det finnes ikke noe seksmånedersmål ennå. Når du setter ett, regner Salong ut måneds-, uke- og dagsplanen selv. Ingenting er fylt inn på forhånd.</p>'+plEditorHTML(P)+'</section>';
  const g=P.goal, f=P.fmt, mrow=m=>'<tr class="'+(m.is_current?'cur':m.is_past?'past':'')+'"><th scope="row">'+esc(m.label)+(m.is_current?' <i>nå</i>':'')+'</th><td>'+f(m.original_plan)+'</td><td>'+f(m.current_plan)+'</td><td>'+f(m.actual)+'</td></tr>';
  const stepRow=s=>'<li><b>'+nf.format(s.n)+'</b> <span>'+esc(s.label.toLowerCase())+'</span>'+(s.basis?'<em class="pl-b '+(s.basis.label==='Faktisk historikk'?'real':'assume')+'" title="'+esc(s.basis.detail+(s.basis.n!=null?' · grunnlag: '+s.basis.n:''))+'">'+esc(s.basis.label)+'</em>':'')+'</li>';
  const cards=[['Mål',f(P.target),g.original_target!==P.target?'opprinnelig '+f(g.original_target):'hele perioden'],['Bekreftet',f(P.actual),Math.round(P.progress*100)+' % av målet'],['Gjenstår',f(P.remaining_goal),P.period.working_days_left+' arbeidsdager igjen'],
    ['Per arbeidsdag',f(P.per_working_day),'gjenstående ÷ dager igjen'],['Forventet',f(P.forecast.expected),'bekreftet + vektet pipeline']];
  return '<section class="pl-sec"><div class="pl-h"><h3>Seksmånedersmål</h3><span class="meta">'+esc(plD(P.period.start))+' – '+esc(plD(P.period.end))+' · '+plPaceChip(P.forecast.pace)+'</span></div>'+
    '<div class="pl-cards">'+cards.map(c=>'<div><span>'+c[0]+'</span><b>'+c[1]+'</b><small>'+esc(c[2])+'</small></div>').join('')+'</div>'+
    (P.status==='upcoming'?'<p class="meta">Perioden har ikke startet. Planen er fordelt på alle '+P.period.working_days_total+' arbeidsdager.</p>':'')+
    (P.activity_warning?'<p class="pl-warn" role="status">'+esc(P.activity_warning)+'</p>':'')+
    '<div class="pl-cols"><div><h4>Plan per måned</h4><table class="pl-t"><thead><tr><th></th><th>Opprinnelig</th><th>Oppdatert</th><th>Faktisk</th></tr></thead><tbody>'+P.months.map(mrow).join('')+'</tbody></table>'+
    '<p class="meta">'+esc(P.seasonal.note)+' Måneder som er over står med faktisk resultat i oppdatert plan. Opprinnelig plan er frosset.</p></div>'+
    '<div><h4>Hva må til? Baklengs fra målet</h4><ul class="pl-chain">'+P.chain.steps.slice(1).map(stepRow).join('')+'</ul><p class="meta">Gjelder det som mangler utover bekreftet og vektet pipeline ('+f(P.chain.need)+'). «Faktisk historikk» er regnet fra dine egne saker. «Oppstartsantakelse» brukes til historikken er stor nok, og kan justeres under «Juster antakelser».</p></div></div>'+
    '<details class="pl-adj"'+(UI.pl.edit?' open':'')+' id="plAdj"><summary>Endre mål eller periode</summary>'+plEditorHTML(P)+(P.revisions.length?'<h4>Historikk</h4><ul class="pl-rev">'+P.revisions.slice().reverse().map(r=>'<li>'+esc(fd(String(r.at).slice(0,10),{day:'numeric',month:'short'}))+' · '+esc(r.by||'')+': '+esc(plFmtVal(P.goal,r.from.target))+' → '+esc(plFmtVal(P.goal,r.to.target))+(r.reason?' · '+esc(r.reason):'')+'</li>').join('')+'</ul>':'')+'</details></section>'; }
function plWire(v){
  $('#plAdj')?.addEventListener('toggle',e=>{ UI.pl.edit=e.target.open; });
  $('#plSave')?.addEventListener('click',async()=>{ if(readOnly){ toast('Du har lesetilgang og kan ikke endre mål.'); return; }
    const r=await crm.goals.update({type:$('#plType').value,target:Number($('#plTarget').value),period_start:$('#plA').value,period_end:$('#plB').value,reason:($('#plReason')||{}).value||''});
    if(!r.success){ UI.pl.err=r.error_message; UI.pl.edit=true; renderView(true); return; } UI.pl.err=''; UI.pl.edit=false; toast('Seksmånedersmålet er lagret. Planen er regnet på nytt.'); renderView(true); });
}
