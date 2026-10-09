'use strict';
/* Group intake: one company name per line, explicit preview before any write.
   Owner/editor only. Existing companies are never overwritten. */
(()=>{
  const get=id=>document.getElementById(id);
  const MAX_ROWS=150;
  const key=value=>String(value||'').normalize('NFKC').trim()
    .replace(/\s+/g,' ').toLocaleLowerCase('nb');
  let bridge=null,reviewed=[],signature='',busy=false;

  function current(){
    return {
      raw:get('bulk-names').value,
      segment:get('bulk-segment').value.trim(),
      priority:get('bulk-priority').value||null
    };
  }
  function fingerprint(){return JSON.stringify(current());}
  function note(value){get('bulk-feedback').textContent=value||'';}
  function clearReview(){
    reviewed=[];signature='';
    get('bulk-confirm').disabled=true;
    get('bulk-list').replaceChildren();
    get('bulk-preview-summary').textContent='';
  }
  function changed(){if(busy)return;clearReview();note('Forhåndsvis listen før du lagrer.');}
  function open(){
    if(!bridge||!bridge.isAuthenticated()||!bridge.canWrite())return;
    clearReview();note('');
    get('bulk-dialog').hidden=false;
    get('bulk-names').focus();
  }
  function close(){
    if(busy)return;
    get('bulk-dialog').hidden=true;clearReview();
    note('');
    get('bulk-names').value='';
    get('bulk-segment').value='';
    get('bulk-priority').value='';
  }
  function preview(){
    if(!bridge||!bridge.isAuthenticated()||!bridge.canWrite())return;
    clearReview();note('');
    const state=current();
    const lines=state.raw.split(/\r?\n/).map(line=>line.normalize('NFKC').trim())
      .filter(Boolean);
    if(!lines.length){note('Lim inn minst ett selskapsnavn.');return;}
    if(lines.length>MAX_ROWS){
      note('Du kan forhåndsvise maks '+MAX_ROWS+' selskaper om gangen. Del listen i mindre grupper.');
      return;
    }
    if(lines.some(name=>name.length>160)){
      note('Ett eller flere navn er lengre enn 160 tegn. Rett listen før du fortsetter.');
      return;
    }
    if(state.segment.length>160){
      note('Segmentnavnet kan ikke være lengre enn 160 tegn.');return;
    }
    const existing=new Set(bridge.getAccounts().map(org=>key(org.name)));
    const found=new Set();
    let duplicates=0;
    for(const name of lines){
      const id=key(name);
      if(!id||existing.has(id)||found.has(id)){duplicates++;continue;}
      found.add(id);reviewed.push(name);
    }
    signature=fingerprint();
    get('bulk-preview-summary').textContent=
      reviewed.length+' nye selskaper klare · '+duplicates+
      ' finnes allerede eller er gjentatt i listen. Ingen eksisterende selskaper endres.';
    const ul=get('bulk-list');
    for(const name of reviewed.slice(0,12)){
      const li=document.createElement('li');li.textContent=name;ul.append(li);
    }
    if(reviewed.length>12){
      const li=document.createElement('li');
      li.textContent='… og '+(reviewed.length-12)+' til';ul.append(li);
    }
    get('bulk-confirm').disabled=!reviewed.length;
    if(reviewed.length)note('Kontroller antallet og klikk «Lagre nye selskaper» når du er klar.');
    else note('Ingen nye selskaper i denne listen.');
  }
  async function apply(){
    if(!bridge||!bridge.isAuthenticated()||!bridge.canWrite()||busy)return;
    if(!reviewed.length||signature!==fingerprint()){
      clearReview();note('Listen er endret. Forhåndsvis på nytt.');return;
    }
    const state=current();
    const names=reviewed.slice();
    busy=true;
    get('bulk-confirm').disabled=true;
    get('bulk-preview').disabled=true;
    get('bulk-close').disabled=true;
    let added=0,duplicates=0,failed=0;
    const errors=[];
    try{
      for(let index=0;index<names.length;index++){
        if(!bridge.isAuthenticated()||!bridge.canWrite()){
          failed+=names.length-index;errors.push('Innloggingen ble avsluttet.');break;
        }
        note('Lagrer '+(index+1)+' av '+names.length+' selskaper …');
        try{
          await bridge.createBulkCompany({
            name:names[index],segment:state.segment||null,priority:state.priority
          });
          added++;
        }catch(error){
          if(error.status===409)duplicates++;
          else{failed++;if(errors.length<3)errors.push(names[index]+': '+(error.message||'Ukjent feil'));}
        }
      }
      try{await bridge.reloadBulkCompanies();}
      catch(error){errors.push('Oppdater siden for å se alle lagrede selskaper.');}
      get('bulk-preview-summary').textContent=
        added+' lagret · '+duplicates+' duplikater hoppet over · '+failed+' feil.';
      get('bulk-list').replaceChildren();
      note(errors.join(' ')||(added?'Selskapene er lagret i Supabase.':'Ingen nye selskaper ble lagret.'));
      clearReview();
      get('bulk-preview-summary').textContent=
        added+' lagret · '+duplicates+' duplikater hoppet over · '+failed+' feil.';
    }finally{
      busy=false;
      get('bulk-preview').disabled=false;
      get('bulk-close').disabled=false;
    }
  }
  function reset(){
    busy=false;
    get('bulk-open').hidden=true;
    get('bulk-dialog').hidden=true;
    get('bulk-names').value='';
    get('bulk-segment').value='';
    get('bulk-priority').value='';
    clearReview();note('');
  }
  function trapKeys(event){
    if(get('bulk-dialog').hidden)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(get('bulk-dialog').querySelectorAll(
      'button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])'
    ));
    if(!controls.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  }
  function init(value){
    bridge=value;
    get('bulk-open').addEventListener('click',open);
    get('bulk-close').addEventListener('click',close);
    get('bulk-preview').addEventListener('click',preview);
    get('bulk-confirm').addEventListener('click',apply);
    for(const id of ['bulk-names','bulk-segment','bulk-priority'])
      get(id).addEventListener('input',changed);
    document.addEventListener('keydown',trapKeys);
    get('bulk-open').hidden=true;
  }
  window.SalongBulkUI={
    init,reset,onAuth(){
      get('bulk-open').hidden=!(bridge&&bridge.isAuthenticated()&&bridge.canWrite());
    }
  };
  if(window.SalongCRMBridge)window.SalongBulkUI.init(window.SalongCRMBridge);
})();