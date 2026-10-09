'use strict';
/* Safe pipeline UI: all writes go via the authenticated parent bridge. */
(()=>{
  const bridge=window.SalongCRMBridge,ux=window.SalongCRMUX;
  if(!bridge||!ux)return;
  const get=id=>document.getElementById(id);
  const stages=[['ny','Ny forespørsel'],['dialog','Dialog'],['visning','Omvisning'],
    ['tilbud','Tilbud sendt'],['holdt','Holdt av'],['bekreftet','Bekreftet'],['tapt','Tapt']];
  const button=(id,label)=>{
    const el=document.createElement('button');el.id=id;el.type='button';el.textContent=label;return el;
  };
  const newBtn=button('opp-new','+ Ny salgsmulighet');
  newBtn.hidden=true;
  const toolbar=get('crm-pipeline-tabs');
  toolbar.insertBefore(newBtn,toolbar.querySelector('.view-toggle'));
  const drawerBtn=button('drawer-opportunity','+ Ny salgsmulighet');
  drawerBtn.hidden=true;
  const drawerLog=get('drawer-log');
  drawerLog.parentNode.insertBefore(drawerBtn,drawerLog.nextSibling);
  const dialog=document.createElement('section');
  dialog.id='opp-dialog';dialog.hidden=true;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','opp-title');
  dialog.innerHTML=[
    '<div class="opportunity-dialog-inner">',
    '<div class="opportunity-dialog-head"><h2 id="opp-title">Ny salgsmulighet</h2>',
    '<button type="button" id="opp-close">Lukk</button></div>',
    '<p>Registrer en reell mulighet for romutleie ved Litteraturhuset. Dette oppretter ingen booking.</p>',
    '<form id="opp-form">',
    '<label>Selskap *<select name="accountId" required></select></label>',
    '<label>Arrangement eller salgsmulighet *<input name="title" maxlength="180" required',
    ' placeholder="F.eks. fagdag, boklansering eller konferanse"></label>',
    '<label>Forventet verdi (kr, valgfritt)<input name="value" type="number" min="0"',
    ' max="999999999999" step="0.01" placeholder="Ikke oppgitt"></label>',
    '<label>Arrangementsdato (valgfritt)<input name="eventDate" type="date"></label>',
    '<label>Ønsket rom (valgfritt)<input name="room" maxlength="160"></label>',
    '<label>Notater (valgfritt)<textarea name="notes" maxlength="5000" rows="3"></textarea></label>',
    '<p class="opp-explainer">Starter i «Ny forespørsel». Faser endres fra pipeline.',
    ' «Bekreftet» her er CRM-status, ikke en bekreftelse fra bookingsystemet.</p>',
    '<p id="opp-error" role="alert"></p>',
    '<div class="opp-actions"><button type="submit" id="opp-save">Lagre i Supabase</button>',
    '<button type="button" id="opp-cancel">Avbryt</button></div>',
    '</form></div>'
  ].join('');
  get('data').append(dialog);
  const accountSelect=get('opp-form').elements.namedItem('accountId');
  let focusBefore=null;
  function close(){
    dialog.hidden=true;get('opp-error').textContent='';
    if(focusBefore?.isConnected)focusBefore.focus();
    focusBefore=null;
  }
  function open(accountId=null){
    if(!bridge.canWrite())return;
    focusBefore=document.activeElement;
    const list=bridge.getAccounts().slice().sort((a,b)=>a.name.localeCompare(b.name,'nb'));
    accountSelect.replaceChildren();
    const first=document.createElement('option');first.value='';first.textContent='Velg selskap';
    accountSelect.append(first);
    for(const a of list){
      const option=document.createElement('option');option.value=a.id;
      option.textContent=a.name;accountSelect.append(option);
    }
    get('opp-form').reset();
    if(accountId)accountSelect.value=accountId;
    dialog.hidden=false;get('opp-error').textContent='';
    (accountId?get('opp-form').elements.namedItem('title'):accountSelect).focus();
  }
  function onAuth(){
    const editable=bridge.canWrite()&&bridge.isAuthenticated();
    drawerBtn.hidden=!editable||!bridge.currentEditorId();
    newBtn.hidden=!editable||toolbar.hidden;
  }
  function onNavigate(mode){
    newBtn.hidden=mode!=='pipeline'||!bridge.canWrite();
  }
  function onCompanyEditor(org){
    drawerBtn.hidden=!org||!bridge.canWrite();
  }
  function decorateCard(btn,deal){
    if(!bridge.canWrite())return btn;
    const container=document.createElement('div');container.className='opp-card-wrap';
    container.append(btn);
    const label=document.createElement('label');label.className='opp-stage-label';
    label.textContent='Fase';
    const select=document.createElement('select');
    select.setAttribute('aria-label','Endre fase for '+(deal.title||'salgsmulighet'));
    for(const [value,name] of stages){
      const option=document.createElement('option');option.value=value;
      option.textContent=name;select.append(option);
    }
    select.value=deal.stage;
    select.addEventListener('change',async()=>{
      const next=select.value,old=deal.stage;
      let reason=null;
      if(next==='tapt'){
        reason=window.prompt('Hva er tapsårsaken? (påkrevd)');
        if(reason==null){select.value=old;return;}
        reason=reason.trim();
        if(!reason||reason.length>500){
          select.value=old;bridge.message('Skriv en tapsårsak på maks 500 tegn.');return;
        }
      }
      select.disabled=true;
      try{
        await bridge.changeOpportunityStage(deal.id,next,old,reason);
        bridge.message('Fasen er lagret i Supabase.');
        ux.pipelineRefresh();
      }catch(error){
        select.value=old;
        bridge.message(error.message||'Kunne ikke lagre fasen.');
        if(/endret fase|konflikt|oppdater/i.test(error.message||''))ux.pipelineRefresh();
      }finally{select.disabled=false;}
    });
    label.append(select);container.append(label);
    return container;
  }
  newBtn.addEventListener('click',()=>open());
  drawerBtn.addEventListener('click',()=>open(bridge.currentEditorId()));
  get('opp-close').addEventListener('click',close);
  get('opp-cancel').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  get('opp-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!bridge.canWrite())return;
    const fields=new FormData(get('opp-form')),rawValue=String(fields.get('value')||'').trim();
    const payload={
      accountId:String(fields.get('accountId')||''),
      title:String(fields.get('title')||'').trim(),
      value:rawValue?Number(rawValue):null,
      eventDate:String(fields.get('eventDate')||'')||null,
      room:String(fields.get('room')||'').trim()||null,
      notes:String(fields.get('notes')||'').trim()||null
    };
    const save=get('opp-save');save.disabled=true;get('opp-error').textContent='';
    try{
      await bridge.createOpportunity(payload);
      close();bridge.message('Salgsmuligheten er lagret i Supabase.');
      ux.pipelineRefresh();
    }catch(error){get('opp-error').textContent=error.message||'Lagring feilet.';}
    finally{save.disabled=false;}
  });
  window.SalongOpportunityUI={
    open,close,onAuth,onNavigate,onCompanyEditor,decorateCard,isOpen:()=>!dialog.hidden,
    getDialog:()=>dialog
  };
})();
