/* Convert imported PostgreSQL organizations to Salong's existing company model.
   Pure read-only adapter: no S.orgs mutation, no localStorage, no writes.
   The demo remains local until an explicitly authenticated CRM boot flow is ready. */
function salongMapImportedOrganizations(rows){
  if(!Array.isArray(rows))throw new TypeError('Selskapslisten må være en liste.');
  const seen=new Set();
  return rows.map(row=>{
    if(!row||typeof row.id!=='string'||!row.id.trim()||typeof row.name!=='string'||!row.name.trim())
      throw new Error('Selskapslisten har en post uten ID eller navn.');
    if(seen.has(row.id))throw new Error('Duplikat selskaps-ID: '+row.id);
    seen.add(row.id);
    const tier=['A','B','C'].includes(row.priority)?row.priority:'';
    const org={
      id:row.id,name:row.name,orgnr:row.org_number||'',website:row.website||'',
      segment:row.segment||'',tier,former:row.previous_customer===true,
      data_origin:'import',data_status:'active'
    };
    return org;
  });
}
