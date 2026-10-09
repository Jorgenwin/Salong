'use strict';
/* Real, authenticated daily queue. Auth tokens stay in the parent bridge.
   Every action is a database-backed API call; no demo records or local saves. */
(()=>{
  const get=id=>document.getElementById(id);
  const text=(tag,label,cls='')=>{
    const el=document.createElement(tag);
    el.textContent=label;if(cls)el.className=cls;return el;
  };
  const button=(label,action,cls='')=>{
    const el=text('button',label,cls);el.type='button';
    el.addEventListener('click',action);return el;
  };
  const fmtDate=value=>{
    if(!value)return 'Ingen frist';
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Ukjent frist';
    return new Intl.DateTimeFormat('nb-NO',{
      timeZone:'Europe/Oslo',day:'numeric',month:'short',year:'numeric'
    }).format(date);
  };
  const PAGE_SIZE=40;
  let bridge=null,visible=false,rows=[],total=0,pending=false,generation=0;
  function error(message){get('today-error').textContent=message||'';}
  function status(message){get('today-status').textContent=message||'';}
  function actionsAllowed(){return bridge&&bridge.isAuthenticated()&&bridge.canWrite();}
  function openCompany(item){window.SalongCRMUX?.openAccount(item.account_id);}
  function logContact(item){
    if(!actionsAllowed())return;
    const org=bridge.getAccounts().find(x=>x.id===item.account_id);
    if(org)bridge.openActivityDialog(org);
    else error('Selskapet må lastes på nytt før kontakt kan registreres.');
  }
  function taskForm(item,holder){
    if(!actionsAllowed())return;
    const form=document.createElement('form');
    form.className='today-task-form';
    const title=text('label','Neste steg');
    const note=document.createElement('input');
    note.type='text';note.maxLength=1200;note.required=true;
    note.placeholder='F.eks. Ring markedsansvarlig';title.append(note);
    const deadline=text('label','Frist');
    const date=document.createElement('input');
    date.type='date';date.required=true;deadline.append(date);
    const line=document.createElement('div');line.className='today-actions';
    const save=button('Lagre oppgave',()=>{});
    save.type='submit';
    const cancel=button('Avbryt',()=>form.remove(),'today-link');
    line.append(save,cancel);form.append(title,deadline,line);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!actionsAllowed())return;
      const due=date.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return;
      save.disabled=true;error('');
      try{
        await bridge.createTodayTask({
          accountId:item.account_id,text:note.value.trim(),
          dueAt:due+'T12:00:00.000Z'
        });
        status('Oppgaven er lagret i Supabase.');
        await refresh();
      }catch(e){error(e.message||'Oppgaven ble ikke lagret.');}
      finally{save.disabled=false;}
    });
    holder.append(form);note.focus();
  }
  async function complete(item,btn){
    if(!actionsAllowed())return;
    btn.disabled=true;error('');
    try{
      await bridge.completeTodayTask(item.action_id);
      status('Oppgaven er fullført og lagret.');
      await refresh();
    }catch(e){error(e.message||'Kunne ikke fullføre oppgaven.');}
    finally{btn.disabled=false;}
  }
  function row(item){
    const li=document.createElement('li');li.className='today-row';
    const label=text('div',item.kind==='task'?'OPPFØLGING':'FØRSTE KONTAKT',
      item.kind==='task'?'today-kind task':'today-kind');
    const h=text('h3',item.account_name||'Ukjent selskap');
    const meta=text('p',
      [(item.priority?'A/B/C '+item.priority:'Uten kvalitetsvurdering'),
       item.segment||'Uten segment',
       item.kind==='task'?fmtDate(item.due_at):'Ikke kontaktet'].join(' · '),
      'today-meta');
    const action=text('p',item.text||'Neste steg','today-action');
    const controls=document.createElement('div');controls.className='today-actions';
    controls.append(button('Åpne selskap',()=>openCompany(item),'today-link'));
    if(actionsAllowed()){
      if(item.kind==='task'){
        const done=button('Marker ferdig',()=>complete(item,done));
        controls.append(done);
      }else{
        controls.append(button('Logg kontakt',()=>logContact(item)));
        controls.append(button('Planlegg oppfølging',()=>taskForm(item,li),'today-link'));
      }
    }
    li.append(label,h,meta,action,controls);return li;
  }
  function render(){
    const list=get('today-list');list.replaceChildren();
    if(!rows.length&&!pending){
      list.append(text('li','Ingen åpne oppgaver eller ukontaktede selskaper.','today-empty'));
    }else{
      for(const item of rows)list.append(row(item));
    }
    get('today-more').hidden=rows.length>=total||pending;
    get('today-more').textContent='Vis flere ('+Math.max(0,total-rows.length)+' gjenstår)';
    if(!pending&&rows.length){
      status('Viser '+rows.length+' av '+total+' kontoer med neste handling.');
    }
  }
  async function loadNext(reset=false){
    if(!visible||!bridge||!bridge.isAuthenticated()||pending)return;
    if(reset){rows=[];total=0;}
    pending=true;const turn=++generation;
    get('today-more').hidden=true;
    error('');status('Henter arbeidskø fra Supabase …');
    try{
      const result=await bridge.loadTodayQueue({limit:PAGE_SIZE,offset:rows.length});
      if(turn!==generation||!visible||!bridge.isAuthenticated())return;
      if(!result||!Array.isArray(result.items))throw Error('Ugyldig svar fra arbeidskøen.');
      rows=rows.concat(result.items);total=result.total;
      status('');render();
    }catch(e){
      if(turn===generation)error(e.message||'Arbeidskøen kunne ikke lastes.');
    }finally{if(turn===generation){pending=false;render();}}
  }
  async function loadGoal(turn){
    try{
      const value=await bridge.loadTodayGoal();
      if(turn!==generation||!visible||!bridge.isAuthenticated())return;
      const remaining=Number(value.remaining)||0;
      get('today-goal').textContent=(Number(value.contacted)||0)+' / '+(Number(value.goal)||500)+' selskaper kontaktet';
      get('today-pace').textContent=remaining===0?'Kontaktmålet er nådd.':
        remaining+' selskaper igjen · '+(Number(value.daily_required)||0)+
        ' per arbeidsdag mot '+(value.deadline||'fristen')+
        (value.deadline_passed?' (fristen er passert)':'');
    }catch(_error){
      if(turn===generation)get('today-pace').textContent='Kontakttempo er ikke tilgjengelig akkurat nå.';
    }
  }
  async function refresh(){
    if(!visible||!bridge||!bridge.isAuthenticated())return;
    generation++;
    pending=false;
    rows=[];total=0;
    get('today-list').replaceChildren();
    await loadNext(true);
    if(visible)loadGoal(generation);
  }
  function reset(){
    generation++;pending=false;visible=false;rows=[];total=0;
    get('today-list').replaceChildren();get('today-more').hidden=true;
    get('today-goal').textContent='—';
    get('today-pace').textContent='Kontakttempo vises etter innlogging.';
    error('');status('');
  }
  function init(value){
    bridge=value;
    get('today-refresh').addEventListener('click',refresh);
    get('today-more').addEventListener('click',()=>loadNext(false));
  }
  window.SalongTodayUI={
    init,refresh,reset,
    onNavigate(mode){
      const next=mode==='today';
      if(!next){visible=false;generation++;pending=false;return;}
      visible=true;refresh();
    }
  };
  if(window.SalongCRMBridge)window.SalongTodayUI.init(window.SalongCRMBridge);
})();