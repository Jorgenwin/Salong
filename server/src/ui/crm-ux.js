'use strict';
/* Salong CRM UX. This script never sees access tokens: API operations pass
   through the authenticated, in-memory parent client bridge. */
(()=>{
  const get=id=>document.getElementById(id);
  const stages=[
    ['ny','Ny forespørsel'],['dialog','Dialog'],['visning','Omvisning'],
    ['tilbud','Tilbud sendt'],['holdt','Holdt av'],
    ['bekreftet','Bekreftet'],['tapt','Tapt']
  ];
  const openStages=new Set(['ny','dialog','visning','tilbud','holdt']);
  const money=value=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:0}).format(Number(value)||0);
  const text=(tag,label,className='')=>{
    const el=document.createElement(tag);el.textContent=label;
    if(className)el.className=className;
    return el;
  };
  const makeButton=(label,handler,className='')=>{
    const btn=text('button',label,className);btn.type='button';btn.addEventListener('click',handler);return btn;
  };
  let bridge=null,mode='companies',pipelineView='board',opportunities=null,pending=false;
  let selectedId=null,readerId=null,drawerTimer=0,focusBeforeDrawer=null;
  const available=()=>!!bridge&&bridge.isAuthenticated();
  const searchText=()=>get('search').value.trim().toLocaleLowerCase('nb');
  function setActiveNav(){
    document.querySelectorAll('[data-crm-view]').forEach(btn=>
      btn.setAttribute('aria-current',btn.dataset.crmView===mode?'page':'false'));
    get('crm-page-title').textContent=
      mode==='pipeline'?'Pipeline':mode==='workspace'?'Salong-arbeidsflate':'Selskaper';
    get('crm-pipeline-tabs').hidden=mode!=='pipeline';
    get('crm-company-toolbar').hidden=mode==='pipeline';
    get('crm-quicksearch').hidden=mode==='workspace';
  }
  function showView(next){
    if(!available()||!['companies','pipeline','workspace'].includes(next))return;
    mode=next;
    setActiveNav();
    const workspace=get('workspace-area'),table=get('table-wrap'),pipe=get('pipeline-panel');
    if(next==='workspace'){
      pipe.hidden=true;table.hidden=true;get('org-empty').hidden=true;
      get('open-workspace').hidden=true;get('back-list').hidden=false;
      if(workspace.hidden)bridge.showWorkspace();
      get('crm-company-toolbar').hidden=true;get('crm-quicksearch').hidden=true;
      return;
    }
    if(!workspace.hidden)bridge.closeWorkspace();
    table.hidden=next!=='companies';pipe.hidden=next!=='pipeline';
    get('open-workspace').hidden=false;
    get('back-list').hidden=true;
    if(next==='pipeline')fetchPipeline();
    else renderCompanies();
    setActiveNav();
  }
  function renderCounts(){
    if(!available())return;
    const accounts=bridge.getAccounts();
    get('stat-all').textContent=String(accounts.length);
    for(const tier of ['A','B','C'])
      get('stat-'+tier.toLowerCase()).textContent=String(accounts.filter(a=>a.priority===tier).length);
  }
  function activeCompanyRows(){
    return Array.from(get('rows').querySelectorAll('tr[data-org-id]'));
  }
  function openAccount(id){
    if(!available())return;
    const org=bridge.getAccounts().find(a=>a.id===id);
    if(!org)return;
    selectedId=id;
    if(bridge.canWrite())bridge.openEditor(org);
    else openReadDrawer(org);
  }
  function enhanceRows(){
    const accounts=bridge.getAccounts(),q=searchText();
    const shown=accounts.filter(a=>(a.name+' '+(a.segment||'')).toLocaleLowerCase('nb').includes(q));
    const rows=Array.from(get('rows').querySelectorAll('tr'));
    rows.forEach((row,i)=>{
      const company=shown[i];if(!company)return;
      row.dataset.orgId=company.id;row.tabIndex=0;
      row.title='Åpne '+company.name;
      row.addEventListener('click',event=>{
        if(event.target.closest('button,select,input,a,label'))return;
        openAccount(company.id);
      });
      row.addEventListener('keydown',event=>{
        if(event.target!==row)return;
        if(event.key==='Enter'){event.preventDefault();openAccount(company.id);}
      });
      const tierCell=row.children[2];if(!tierCell)return;
      tierCell.replaceChildren();
      if(bridge.canWrite()){
        const select=document.createElement('select');
        select.className='inline-tier';select.setAttribute('aria-label','Kvalitet for '+company.name);
        for(const [v,label] of [['','—'],['A','A'],['B','B'],['C','C']]){
          const option=document.createElement('option');option.value=v;option.textContent=label;
          select.append(option);
        }
        select.value=company.priority||'';
        select.addEventListener('change',async()=>{
          const old=company.priority||'';select.disabled=true;
          try{
            await bridge.changePriority(company.id,select.value||null);
            renderCounts();
          }catch(error){
            select.value=old;
            bridge.message(error.message||'Kunne ikke lagre prioriteten.');
          }finally{select.disabled=false;}
        });
        tierCell.append(select);
      }else{
        const pill=text('span',company.priority||'Uten vurdering','quality-pill');
        pill.dataset.quality=company.priority||'';
        tierCell.append(pill);
      }
      if(company.id===selectedId)row.classList.add('selected-row');
    });
    const empty=get('org-empty');
    empty.hidden=!!rows.length;
    if(!rows.length){
      empty.replaceChildren(text('strong',q?'Ingen treff':'Ingen selskaper ennå'),
        text('p',q?'Prøv et annet søk.':'Opprett første selskap for å starte.'));
      if(!q&&bridge.canWrite())empty.append(makeButton('+ Nytt selskap',()=>bridge.openEditor(null)));
    }
  }
  function renderCompanies(){
    if(!bridge)return;
    renderCounts();
    enhanceRows();
  }
  function cardFor(deal){
    const company=bridge.getAccounts().find(o=>o.id===deal.account_id);
    const btn=document.createElement('button');btn.type='button';btn.className='pipeline-card';
    btn.append(text('strong',company?.name||'Ukjent organisasjon'));
    const name=text('small',deal.title||'Salgsmulighet');btn.append(name);
    btn.append(text('span',deal.value==null?'Verdi ikke registrert':money(deal.value),'card-value'));
    if(deal.event_date)btn.append(text('small','Dato: '+deal.event_date));
    if(deal.last_activity_at){
      const age=Math.floor((Date.now()-new Date(deal.last_activity_at).getTime())/86400000);
      if(Number.isFinite(age)&&age>7)
        btn.append(text('span',age+' dager siden registrert kontakt','pipeline-stale'));
    }else btn.append(text('small','Ingen registrert kontakt'));
    btn.addEventListener('click',()=>company?openAccount(company.id):
      bridge.message('Salgsmuligheten mangler kobling til et eksisterende selskap.'));
    return btn;
  }
  function pipelineMatches(deal){
    const q=searchText();if(!q)return true;
    const company=bridge.getAccounts().find(a=>a.id===deal.account_id);
    return ((deal.title||'')+' '+(company?.name||'')+' '+(deal.stage||''))
      .toLocaleLowerCase('nb').includes(q);
  }

  let caseForm=null,caseFocus=null;
  function makeCaseForm(){
    if(caseForm)return caseForm;
    const backdrop=document.createElement('div');
    backdrop.id='pipeline-create-modal';backdrop.className='crm-case-backdrop';
    backdrop.hidden=true;backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');backdrop.setAttribute('aria-labelledby','pipeline-create-title');
    const panel=document.createElement('section');panel.className='crm-case-panel';
    const title=text('h2','Ny salgsmulighet');title.id='pipeline-create-title';
    const close=makeButton('Lukk',()=>closeCaseForm(),'crm-case-cancel');
    const header=document.createElement('div');header.className='crm-case-head';header.append(title,close);
    panel.append(header);
    const form=document.createElement('form');form.id='pipeline-create-form';
    const grid=document.createElement('div');grid.className='crm-case-grid';
    function field(name,label,type='text',max=180){
      const wrap=document.createElement('label');wrap.textContent=label;
      const input=document.createElement(type==='select'?'select':'input');
      if(type!=='select')input.type=type;
      input.name=name;input.id='case-'+name;
      if(max&&type!=='select')input.maxLength=max;
      wrap.append(input);grid.append(wrap);
      return input;
    }
    const account=field('accountId','Selskap *','select');
    const caseTitle=field('title','Tittel *','text',180);caseTitle.required=true;
    const date=field('eventDate','Mulig arrangementsdato','date');
    const value=field('value','Antatt verdi i kroner (valgfritt)','number');value.min='0';value.max='10000000000';value.step='0.01';
    const room=field('room','Rom (valgfritt)','text',180);
    const notes=field('notes','Notater (valgfritt)','text',5000);
    form.append(grid,text('p','Oppretter en CRM-sak, ikke en bekreftet rombooking.','crm-case-note'));
    const error=text('p','','crm-case-error');error.id='pipeline-create-error';error.setAttribute('role','alert');form.append(error);
    const actions=document.createElement('div');actions.className='crm-case-actions';
    const save=makeButton('Lagre salgsmulighet',()=>{},'crm-case-save');save.type='submit';
    actions.append(save,makeButton('Avbryt',()=>closeCaseForm(),'crm-case-cancel'));
    form.append(actions);panel.append(form);backdrop.append(panel);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeCaseForm();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!bridge.canWrite()||!available())return;
      error.textContent='';save.disabled=true;
      try{
        const raw=value.value.trim();
        await bridge.createOpportunity({
          accountId:account.value,title:caseTitle.value.trim(),
          eventDate:date.value||null,value:raw?Number(raw):null,
          room:room.value.trim()||null,notes:notes.value.trim()||null
        });
        closeCaseForm();opportunities=null;await fetchPipeline();
        bridge.message('Salgsmuligheten er lagret i Supabase. Ingen booking er opprettet.');
      }catch(e){error.textContent=e.message||'Kunne ikke lagre salgsmuligheten.';}
      finally{save.disabled=false;}
    });
    document.body.append(backdrop);
    caseForm={backdrop,account,caseTitle,form,error};
    return caseForm;
  }
  function openCaseForm(){
    if(!available()||!bridge.canWrite())return;
    const state=makeCaseForm();
    state.form.reset();state.error.textContent='';
    state.account.replaceChildren();
    const accounts=bridge.getAccounts().slice().sort((a,b)=>a.name.localeCompare(b.name,'nb'));
    for(const org of accounts){
      const opt=document.createElement('option');opt.value=org.id;opt.textContent=org.name;
      state.account.append(opt);
    }
    if(!accounts.length){bridge.message('Legg til et selskap før du lager en salgsmulighet.');return;}
    caseFocus=document.activeElement;state.backdrop.hidden=false;state.caseTitle.focus();
  }
  function closeCaseForm(){
    if(!caseForm)return;
    caseForm.backdrop.hidden=true;
    caseFocus?.focus?.();caseFocus=null;
  }
  function stagePicker(deal){
    const wrap=document.createElement('label');wrap.className='pipeline-stage-picker';
    wrap.append(text('span','Endre salgsfase'));
    const select=document.createElement('select');select.className='pipeline-stage-select';
    select.setAttribute('aria-label','Endre salgsfase for '+deal.title);
    for(const [value,label] of stages){
      const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.append(opt);
    }
    select.value=deal.stage;
    select.addEventListener('click',e=>e.stopPropagation());
    select.addEventListener('keydown',e=>e.stopPropagation());
    select.addEventListener('change',async()=>{
      const next=select.value;
      if(next===deal.stage)return;
      let reason=null;
      if(next==='tapt'){
        const answer=window.prompt('Hvorfor ble salgsmuligheten tapt?');
        if(answer==null||!answer.trim()){
          select.value=deal.stage;bridge.message('Faseendringen ble avbrutt.');return;
        }
        reason=answer.trim();
      }
      select.disabled=true;
      try{
        await bridge.changeOpportunityStage(deal.id,next,deal.stage,reason);
        opportunities=null;await fetchPipeline();
        bridge.message('Salgsfasen er lagret i Supabase. Ingen rombooking er endret.');
      }catch(error){
        select.value=deal.stage;
        bridge.message(error.message||'Kunne ikke lagre fasen.');
        opportunities=null;await fetchPipeline();
      }finally{select.disabled=false;}
    });
    wrap.append(select);
    return wrap;
  }

  function renderPipeline(){
    if(mode!=='pipeline'||!available()||!opportunities)return;
    const filtered=opportunities.filter(pipelineMatches);
    const counts=filtered.filter(d=>openStages.has(d.stage));
    get('pipe-total').textContent=money(counts.reduce((n,d)=>n+Number(d.value||0),0));
    get('pipe-open').textContent=String(counts.length);
    get('pipe-registered').textContent=String(opportunities.length);
    get('pipe-weighted').textContent='Ikke beregnet';
    const board=get('pipeline-board'),list=get('pipeline-table');
    board.replaceChildren();list.replaceChildren();
    const empty=get('pipeline-empty');
    empty.hidden=!!opportunities.length;
    if(!opportunities.length){
      empty.replaceChildren(text('strong','Ingen registrerte salgsmuligheter ennå'),
        text('p','De importerte selskapene er klare. Pipeline fylles når tilbud og bookinger lagres i Salong.'));
    }else if(!filtered.length){
      empty.hidden=false;empty.replaceChildren(text('strong','Ingen treff'),text('p','Prøv et annet søk.'));
    }
    if(!filtered.length)return;
    for(const [stage,label] of stages){
      const deals=filtered.filter(d=>d.stage===stage);
      const section=document.createElement('section');section.className='pipeline-stage';
      const header=document.createElement('div');header.className='pipeline-stage-head';
      header.append(text('span',label),text('span',String(deals.length),'pipeline-stage-count'));
      section.append(header,text('p',money(deals.reduce((n,d)=>n+Number(d.value||0),0)),'pipeline-stage-subtotal'));
      if(!deals.length)section.append(text('p','Ingen saker','stage-empty'));
      for(const deal of deals){
        const item=document.createElement('div');item.className='pipeline-card-wrap';
        item.append(cardFor(deal));
        if(bridge.canWrite())item.append(stagePicker(deal));
        section.append(item);
      }
      board.append(section);
    }
    const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
    for(const heading of ['Selskap','Salgsmulighet','Fase','Verdi','Aktivitet',...(bridge.canWrite()?['Endre fase']:[])]){
      tr.append(text('th',heading));
    }
    thead.append(tr);table.append(thead);
    const tbody=document.createElement('tbody');
    for(const deal of filtered){
      const company=bridge.getAccounts().find(a=>a.id===deal.account_id);
      const row=document.createElement('tr');row.tabIndex=0;
      row.append(text('td',company?.name||'Ukjent selskap'),
        text('td',deal.title||'–'),text('td',stages.find(x=>x[0]===deal.stage)?.[1]||deal.stage),
        text('td',deal.value==null?'Ikke registrert':money(deal.value)),
        text('td',deal.last_activity_at?
          new Date(deal.last_activity_at).toLocaleDateString('nb-NO'):'Ikke registrert'));
      if(bridge.canWrite()){
        const td=document.createElement('td');td.append(stagePicker(deal));row.append(td);
      }
      if(company){
        row.addEventListener('click',event=>{if(event.target.closest('select'))return;openAccount(company.id);});
        row.addEventListener('keydown',e=>{if(e.key==='Enter')openAccount(company.id);});
      }
      tbody.append(row);
    }
    table.append(tbody);list.append(table);
    board.hidden=pipelineView!=='board';list.hidden=pipelineView!=='table';
  }
  async function fetchPipeline(){
    if(pending||!available())return;
    if(opportunities){renderPipeline();return;}
    pending=true;
    const board=get('pipeline-board');
    board.replaceChildren();
    const loading=text('div','','pipeline-skeleton');
    for(let i=0;i<4;i++)loading.append(text('span',''));
    board.append(loading);
    get('pipeline-error').textContent='';
    try{
      const result=await bridge.loadOpportunities();
      if(!available())return;
      if(!Array.isArray(result))throw Error('Ugyldig pipelinedata.');
      opportunities=result;
      renderPipeline();
    }catch(error){
      get('pipeline-error').textContent=
        'Kunne ikke laste pipeline. Selskapslisten er fortsatt tilgjengelig. '+(error.message||'');
      board.replaceChildren();
    }finally{pending=false;}
  }
  function openReadDrawer(org){
    focusBeforeDrawer=document.activeElement;
    readerId=org.id;
    const drawer=get('read-drawer');
    get('read-name').textContent=org.name;
    const details=get('read-details');details.replaceChildren();
    const pairs=[['Segment',org.segment],['Kvalitet',org.priority],['Org.nr.',org.org_number],
      ['Nettside',org.website],['Tidligere leietaker',org.previous_customer?'Ja':'Nei'],['Notat',org.notes]];
    for(const [key,value] of pairs){
      const dt=text('dt',key),dd=text('dd',value||'—');details.append(dt,dd);
    }
    drawer.hidden=false;get('read-close').focus();
    loadTimeline(org.id,get('read-history'));
  }
  function closeReadDrawer(){
    get('read-drawer').hidden=true;readerId=null;
    focusBeforeDrawer?.focus?.();focusBeforeDrawer=null;
  }
  async function loadTimeline(id,container){
    const current=id;container.replaceChildren(text('li','Henter historikk …','timeline-empty'));
    try{
      const records=await bridge.loadActivities(id);
      if((container.id==='drawer-history'&&get('editor').hidden)||
         (container.id==='read-history'&&readerId!==current))return;
      container.replaceChildren();
      if(!records.length){container.append(text('li','Ingen aktiviteter loggført ennå.','timeline-empty'));return;}
      for(const a of records.slice(0,70)){
        const li=document.createElement('li');
        const date=a.happened_at?new Date(a.happened_at).toLocaleDateString('nb-NO'):'Ukjent dato';
        li.append(text('time',date+' · '+(a.direction==='out'?'Utgående':a.direction==='in'?'Innkommende':'Internt')+' · '+a.type));
        li.append(text('span',a.text||'Ingen beskrivelse'));
        container.append(li);
      }
    }catch(_error){
      container.replaceChildren(text('li','Aktiviteter kunne ikke hentes.','timeline-empty'));
    }
  }
  function onEditorOpen(org){
    focusBeforeDrawer=document.activeElement;
    get('drawer-log').hidden=!org;
    get('drawer-history').replaceChildren();
    if(org){
      get('editor-timeline-title').textContent='Aktivitet · '+org.name;
      loadTimeline(org.id,get('drawer-history'));
    }else{
      get('editor-timeline-title').textContent='Nytt selskap';
      get('drawer-history').append(text('li','Lagre selskapet før du logger kontakt.','timeline-empty'));
    }
  }
  function onEditorClose(){
    focusBeforeDrawer?.focus?.();focusBeforeDrawer=null;
  }
  function moveRow(delta){
    const rows=activeCompanyRows();if(!rows.length)return;
    let idx=rows.findIndex(row=>row.dataset.orgId===selectedId);
    if(idx<0)idx=delta>0?-1:0;
    idx=(idx+delta+rows.length)%rows.length;
    selectedId=rows[idx].dataset.orgId;rows[idx].focus();rows[idx].scrollIntoView({block:'nearest'});
  }
  function modalOpen(){
    return (caseForm&&!caseForm.backdrop.hidden)||!get('editor').hidden||!get('activity-dialog').hidden||!get('read-drawer').hidden;
  }
  function editingTarget(target){
    return target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]');
  }
  function trapDrawerFocus(event){
    const dialog=(caseForm&&!caseForm.backdrop.hidden)?caseForm.backdrop:
      !get('activity-dialog').hidden?get('activity-dialog'):
      !get('editor').hidden?get('editor'):
      !get('read-drawer').hidden?get('read-drawer'):null;
    if(!dialog)return false;
    const nodes=Array.from(dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
      .filter(node=>!node.disabled&&node.getClientRects().length&&
        node.getAttribute('aria-hidden')!=='true');
    if(!nodes.length)return false;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
      event.preventDefault();last.focus();return true;
    }
    if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
      event.preventDefault();first.focus();return true;
    }
    return false;
  }
  function onKeydown(event){
    if(event.key==='Tab'&&modalOpen()){trapDrawerFocus(event);return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      if(!available())return;event.preventDefault();
      if(mode!=='companies')showView('companies');
      get('search').focus();get('search').select();return;
    }
    if(event.key==='Escape'){
      if(caseForm&&!caseForm.backdrop.hidden){closeCaseForm();return;}
      if(!get('activity-dialog').hidden){get('activity-close').click();return;}
      if(!get('editor').hidden){get('editor-close').click();return;}
      if(!get('read-drawer').hidden){closeReadDrawer();return;}
      return;
    }
    if(!available()||modalOpen()||editingTarget(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(key==='n'&&bridge.canWrite()){
      event.preventDefault();bridge.openEditor(null);
    }else if(mode==='companies'&&key==='j'){
      event.preventDefault();moveRow(1);
    }else if(mode==='companies'&&key==='k'){
      event.preventDefault();moveRow(-1);
    }else if(mode==='companies'&&key==='e'&&selectedId&&bridge.canWrite()){
      event.preventDefault();openAccount(selectedId);
    }
  }
  function reset(){
    pipelineView='board';opportunities=null;mode='companies';pending=false;
    closeCaseForm();if(get('pipeline-new'))get('pipeline-new').hidden=true;
    selectedId=null;readerId=null;get('read-drawer').hidden=true;
    get('pipeline-panel').hidden=true;get('table-wrap').hidden=false;get('org-empty').hidden=true;
    setActiveNav();
  }
  function init(value){
    bridge=value;
    get('read-close').addEventListener('click',closeReadDrawer);
    get('read-drawer').addEventListener('click',event=>{
      if(event.target===get('read-drawer'))closeReadDrawer();
    });
    get('editor').addEventListener('click',event=>{
      if(event.target===get('editor'))get('editor-close').click();
    });
    get('activity-dialog').addEventListener('click',event=>{
      if(event.target===get('activity-dialog'))get('activity-close').click();
    });
    get('drawer-log').addEventListener('click',()=>{
      const id=bridge.currentEditorId();
      if(id){const org=bridge.getAccounts().find(a=>a.id===id);if(org)bridge.openActivityDialog(org);}
    });
    document.querySelectorAll('[data-crm-view]').forEach(btn=>
      btn.addEventListener('click',()=>showView(btn.dataset.crmView)));
    get('crm-pipeline-tabs').querySelectorAll('[data-pipeline-view]').forEach(btn=>btn.addEventListener('click',()=>{
      pipelineView=btn.dataset.pipelineView;
      get('crm-pipeline-tabs').querySelectorAll('[data-pipeline-view]').forEach(b=>
        b.setAttribute('aria-pressed',String(b.dataset.pipelineView===pipelineView)));
      renderPipeline();
    }));
    get('search').addEventListener('input',()=>{if(mode==='pipeline')renderPipeline();});
    get('open-workspace').addEventListener('click',()=>showView('workspace'));
    get('back-list').addEventListener('click',()=>showView('companies'));
    document.addEventListener('keydown',onKeydown);
    get('crm-quick-add').addEventListener('click',()=>bridge.canWrite()?bridge.openEditor(null):null);
    get('crm-quick-add').hidden=!bridge.canWrite();
    const newCase=makeButton('+ Ny salgsmulighet',openCaseForm,'pipeline-new');
    newCase.id='pipeline-new';newCase.hidden=!bridge.canWrite();
    get('crm-pipeline-tabs').parentNode.append(newCase);
    setActiveNav();
  }
  window.SalongCRMUX={
    init,renderCompanies,showView,openAccount,onEditorOpen,onEditorClose,reset,
    focusSearch(){if(available()){showView('companies');get('search').focus();get('search').select();}},
    onAuth(){get('crm-quick-add').hidden=!bridge.canWrite();get('pipeline-new').hidden=!bridge.canWrite();renderCounts();setActiveNav();},
    pipelineRefresh(){opportunities=null;if(mode==='pipeline')fetchPipeline();}
  };
  if(window.SalongCRMBridge)window.SalongCRMUX.init(window.SalongCRMBridge);
})();