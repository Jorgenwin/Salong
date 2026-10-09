/* ---------- Eksplisitt, skrivebeskyttet CRM-forhåndsvisning ----------
   Kjøres KUN i iframe fra Salong API med SALONG_CRM_READONLY.
   Data sendes fra den autentiserte foreldrevisningen. Verken demodata,
   API-token, lokal skriving eller databasepassord brukes her. */
function salongPreviewApplyOrganizations(rows){
  const mapped=salongMapImportedOrganizations(rows);
  const orgsById=Object.create(null);
  for(const org of mapped)orgsById[org.id]=org;
  S.orgs=orgsById;
  DV++;
  if(typeof MT_MEMO!=='undefined')MT_MEMO=null;
  UI.view='prosp';
  if(UI.mt){UI.mt.tab='mal';UI.mt.kind='ny';UI.mt.page=1;}
  if(UI.ku)UI.ku.st='alle';
  render();
  return mapped.length;
}
if(window.SALONG_CRM_READONLY===true){
  readOnly=true;
  // Remove ALL embedded demo accounts (including virtual research profiles).
  // This happens before init() runs or any Salong view is rendered.
  for(const id of Object.keys(PROFILES))delete PROFILES[id];
  loadDemo=function(){
    for(const col of STORE_COLLECTIONS)S[col]={};
    S.settings={...DEFAULT_SETTINGS};
    UI.view='prosp';
    if(UI.mt){UI.mt.tab='mal';UI.mt.kind='ny';}
    if(UI.ku)UI.ku.st='alle';
  };
  syncState=function(){return {k:'ro',t:'Ekte Supabase-data · lesemodus'};};
  const style=document.createElement('style');
  style.textContent='#newDeal,#askSalong,.mt-top-r,button[data-mtmodal],#nav button:not([data-view="prosp"]):not([data-view="kontakter"]){display:none!important}';
  document.head.appendChild(style);
  let loaded=false;
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==location.origin||window.parent===window)return;
    if(!event.data||event.data.type!=='salong:crm-organizations'||loaded)return;
    try{
      const n=salongPreviewApplyOrganizations(event.data.organizations);
      loaded=true;
      window.parent.postMessage({type:'salong:crm-loaded',count:n},location.origin);
    }catch(_error){
      window.parent.postMessage({type:'salong:crm-error'},location.origin);
    }
  });
  // The overview may be searched, filtered and navigated. Mutation controls
  // must not appear to work while there are no server-side write endpoints.
  document.addEventListener('click',event=>{
    const element=event.target.closest('button,a,summary');
    if(!element)return;
    const nav=element.closest('#nav button[data-view]');
    if(nav&&['prosp','kontakter'].includes(nav.dataset.view))return;
    if(element.matches('[data-mttab],[data-mtstat],[data-mtsegf],[data-mtclr],[data-mtkind],[data-mtsort],[data-mtmore],[data-mtfit],[data-kst],[data-ktier],[data-ksort],[data-idtab],#syncBtn,[aria-label="Lukk"]'))return;
    if(element.matches('[data-open]')&&String(element.dataset.open||'').startsWith('org:'))return;
    // Sorting, list pagination and org drill-down are safe in the preview;
    // business writes, enrollment, outreach, import and email are not.
    event.preventDefault();event.stopImmediatePropagation();
    if(typeof toast==='function')toast('Forhåndsvisning med ekte data. Redigering kommer senere.');
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
}
