'use strict';

/* Two transaction-scoped mutations. This layer never calls the booking system. */
function createOpportunityWrites(db){
  if(!db||typeof db.withClient!=='function')
    throw new TypeError('Opportunity writes require transactions');

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
  async function audit(client,{auditId,actorId,opportunityId,action,before,after}){
    await client.query(
      'INSERT INTO crm_opportunity_events (id,opportunity_id,actor_id,action,before_data,after_data) '+
      'VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
      [auditId,opportunityId,actorId,action,before?JSON.stringify(before):null,JSON.stringify(after)]
    );
  }
  return {
    async create(input,{id,actorId,auditId}={}){
      if(!id||!actorId||!auditId||!input||!input.accountId||!input.title)
        throw new TypeError('Missing opportunity creation data');
      return transaction(async client=>{
        const company=await client.query(
          'SELECT id FROM organizations WHERE id=$1 AND deleted_at IS NULL FOR KEY SHARE',
          [input.accountId]
        );
        if(!company.rows.length)return {missingAccount:true};
        const key='opportunity:'+input.accountId+':'+input.title.toLocaleLowerCase('nb')+':'+(input.eventDate||'');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
        const existing=await client.query(
          'SELECT id FROM opportunities WHERE organization_id=$1 AND lower(trim(title))=lower(trim($2)) '+
          'AND event_date IS NOT DISTINCT FROM $3::date AND deleted_at IS NULL LIMIT 1',
          [input.accountId,input.title,input.eventDate||null]
        );
        if(existing.rows.length)return {duplicate:true,existingId:existing.rows[0].id};
        const saved=await client.query(
          'INSERT INTO opportunities (id,organization_id,title,stage,room,event_date,value_amount,notes,owner_id,stage_at) '+
          "VALUES ($1,$2,$3,'ny',$4,$5,$6,$7,$8,now()) RETURNING *",
          [id,input.accountId,input.title,input.room||null,input.eventDate||null,
            input.value??null,input.notes||null,actorId]
        );
        const row=saved.rows[0];
        await audit(client,{
          auditId,actorId,opportunityId:id,action:'opportunity_created',before:null,
          after:{id,account_id:row.organization_id,title:row.title,stage:row.stage,
            value:row.value_amount,event_date:row.event_date}
        });
        return {row};
      });
    },

    async changeStage(id,{stage,expectedStage,lostReason=null},{actorId,auditId}={}){
      if(!id||!stage||!expectedStage||!actorId||!auditId)
        throw new TypeError('Missing opportunity stage-change data');
      return transaction(async client=>{
        const selected=await client.query(
          'SELECT * FROM opportunities WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]
        );
        if(!selected.rows.length)return {missing:true};
        const before=selected.rows[0];
        if(before.stage!==expectedStage)
          return {conflict:true,currentStage:before.stage};
        if(before.stage===stage&&(
          stage!=='tapt'||String(before.lost_reason||'')===String(lostReason||'')))
          return {row:before,unchanged:true};
        const saved=await client.query(
          'UPDATE opportunities SET stage=$2,lost_reason=$3,stage_at=now(),updated_at=now() '+
          'WHERE id=$1 AND deleted_at IS NULL RETURNING *',
          [id,stage,stage==='tapt'?lostReason:null]
        );
        const after=saved.rows[0];
        await audit(client,{
          auditId,actorId,opportunityId:id,action:'opportunity_stage_changed',
          before:{stage:before.stage,lost_reason:before.lost_reason,stage_at:before.stage_at},
          after:{stage:after.stage,lost_reason:after.lost_reason,stage_at:after.stage_at}
        });
        return {row:after};
      });
    }
  };
}
module.exports={createOpportunityWrites};
