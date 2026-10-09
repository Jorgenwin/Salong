'use strict';

/* Authenticated editor-only calls reach this module through app.js.
   The same DB transaction commits the real opportunity and its audit record. */
function createOpportunityWrites(db,mapOpportunity){
  if(!db||typeof db.withClient!=='function'||typeof mapOpportunity!=='function')
    throw new TypeError('Opportunity writes require a transactional db and mapper');
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
  async function audit(client,{auditId,actorId,accountId,action,before,after}){
    await client.query(
      'INSERT INTO crm_audit_events (id,organization_id,actor_id,action,before_data,after_data) '+
      'VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
      [auditId,accountId,actorId,action,before?JSON.stringify(before):null,JSON.stringify(after)]
    );
  }
  return {
    async create(input,{id,auditId,actorId}={}){
      if(!input||!input.accountId||!input.title||!id||!auditId||!actorId)
        throw new TypeError('Missing opportunity creation inputs');
      return transaction(async client=>{
        const account=await client.query(
          'SELECT id FROM organizations WHERE id=$1 AND deleted_at IS NULL FOR KEY SHARE',
          [input.accountId]
        );
        if(!account.rows.length)return {accountMissing:true};
        const response=await client.query(
          'INSERT INTO opportunities '+
          '(id,organization_id,title,stage,room,event_date,value_amount,notes,owner_id,stage_at) '+
          "VALUES ($1,$2,$3,'ny',$4,$5,$6,$7,$8,now()) RETURNING *",
          [id,input.accountId,input.title,input.room||null,input.eventDate||null,
           input.value==null?null:input.value,input.notes||null,actorId]
        );
        const opportunity=mapOpportunity(response.rows[0]);
        await audit(client,{auditId,actorId,accountId:input.accountId,
          action:'opportunity_created',before:null,after:opportunity});
        return {opportunity};
      });
    },
    async changeStage(id,{stage,expectedStage,lostReason=null,actorId,auditId}={}){
      if(!id||!stage||!expectedStage||!actorId||!auditId)
        throw new TypeError('Missing opportunity stage mutation inputs');
      return transaction(async client=>{
        const selected=await client.query(
          'SELECT * FROM opportunities WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]
        );
        if(!selected.rows.length)return {missing:true};
        const previous=selected.rows[0];
        if(previous.stage!==expectedStage)
          return {stale:true,currentStage:previous.stage};
        if(previous.stage===stage&&
           (stage!=='tapt'||(previous.lost_reason||null)===(lostReason||null)))
          return {opportunity:mapOpportunity(previous),unchanged:true};
        const response=await client.query(
          'UPDATE opportunities SET stage=$2,stage_at=now(),updated_at=now(), '+
          "lost_reason=CASE WHEN $2='tapt' THEN $3 ELSE NULL END "+
          'WHERE id=$1 AND deleted_at IS NULL RETURNING *',
          [id,stage,stage==='tapt'?lostReason:null]
        );
        const opportunity=mapOpportunity(response.rows[0]);
        await audit(client,{auditId,actorId,accountId:previous.organization_id,
          action:'opportunity_stage_changed',
          before:mapOpportunity(previous),after:opportunity});
        return {opportunity};
      });
    }
  };
}
module.exports={createOpportunityWrites};
