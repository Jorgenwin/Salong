'use strict';

/* Database transaction is the only entry to persistent organization edits.
 * Supabase user JWTs are verified in app.js; never use publishable keys here. */
function normalizeName(name){
  return String(name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('nb');
}
function mapOrganization(row){
  if(!row)return null;
  return {
    id:row.id,name:row.name,org_number:row.org_number||null,
    website:row.website||null,domain:row.domain||null,
    segment:row.segment||null,priority:row.tier||null,
    previous_customer:row.former===true,notes:row.notes||null,
    owner_id:row.owner_id||null,quality_manual_override:row.quality_manual_override===true
  };
}
function createOrganizationWrites(db){
  if(!db||typeof db.withClient!=='function')throw TypeError('Organization writes require transactions');
  async function transaction(fn){
    return db.withClient(async client=>{
      await client.query('BEGIN');
      try{
        const result=await fn(client);
        await client.query('COMMIT');
        return result;
      }catch(error){
        try{await client.query('ROLLBACK');}catch(_rollback){}
        throw error;
      }
    });
  }
  async function locks(client,name,orgNumber){
    const keys=['name:'+normalizeName(name)];
    if(orgNumber)keys.push('orgnr:'+orgNumber);
    for(const key of keys.sort())
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['salong:org:'+key]);
  }
  async function duplicate(client,{name,orgNumber,exceptId=null}){
    const rows=await client.query(
      "SELECT id,name FROM organizations WHERE deleted_at IS NULL AND id<>COALESCE($3,'') AND ("+
      "($1::text IS NOT NULL AND org_number=$1) OR lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=$2) LIMIT 1",
      [orgNumber||null,normalizeName(name),exceptId]
    );
    return rows.rows[0]||null;
  }
  async function audit(client,{id,actorId,organizationId,action,before,after}){
    await client.query(
      'INSERT INTO crm_audit_events (id,organization_id,actor_id,action,before_data,after_data) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
      [id,organizationId,actorId,action,before?JSON.stringify(before):null,JSON.stringify(after)]
    );
  }
  return {
    async create(input,{actorId,id,auditId}={}){
      if(!actorId||!id||!auditId||!input||!input.name)throw TypeError('Invalid company creation');
      return transaction(async client=>{
        await locks(client,input.name,input.org_number);
        const existing=await duplicate(client,{name:input.name,orgNumber:input.org_number});
        if(existing)return {duplicate:true,existing};
        const result=await client.query(
          'INSERT INTO organizations (id,name,org_number,website,domain,segment,tier,former,notes,quality_manual_override) '+
          'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
          [id,input.name,input.org_number||null,input.website||null,input.domain||null,
           input.segment||null,input.priority||null,input.previous_customer===true,
           input.notes||null,Boolean(input.priority)]
        );
        const organization=mapOrganization(result.rows[0]);
        await audit(client,{id:auditId,actorId,organizationId:id,action:'organization_created',
          before:null,after:organization});
        return {organization};
      });
    },
    async update(id,patch,{actorId,auditId}={}){
      if(!id||!actorId||!auditId||!patch||!Object.keys(patch).length)
        throw TypeError('Invalid company update');
      return transaction(async client=>{
        const selected=await client.query(
          'SELECT * FROM organizations WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]
        );
        if(!selected.rows.length)return {missing:true};
        const before=mapOrganization(selected.rows[0]);
        const after={...before,...patch};
        await locks(client,after.name,after.org_number);
        const existing=await duplicate(client,{name:after.name,orgNumber:after.org_number,exceptId:id});
        if(existing)return {duplicate:true,existing};
        const columns={name:'name',org_number:'org_number',website:'website',domain:'domain',
          segment:'segment',priority:'tier',previous_customer:'former',notes:'notes'};
        const params=[id],set=[];
        for(const [key,column] of Object.entries(columns)){
          if(!Object.prototype.hasOwnProperty.call(patch,key))continue;
          params.push(patch[key]);
          set.push(column+'=$'+params.length);
        }
        if(Object.prototype.hasOwnProperty.call(patch,'priority'))
          set.push('quality_manual_override=true');
        if(!set.length)throw TypeError('No editable fields supplied');
        set.push('updated_at=now()');
        const result=await client.query(
          'UPDATE organizations SET '+set.join(',')+' WHERE id=$1 AND deleted_at IS NULL RETURNING *',
          params
        );
        const organization=mapOrganization(result.rows[0]);
        await audit(client,{id:auditId,actorId,organizationId:id,action:'organization_updated',
          before,after:organization});
        return {organization};
      });
    }
  };
}
module.exports={mapOrganization,createOrganizationWrites,normalizeName};
