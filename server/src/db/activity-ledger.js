'use strict';

const asDate=value=>value?new Date(value).toISOString():null;
function mapActivity(row){
  if(!row)return null;
  return {
    id:row.id,account_id:row.organization_id||null,
    case_id:row.opportunity_id||null,contact_id:row.contact_id||null,
    type:row.type,text:row.text||'',body:row.body||null,
    happened_at:asDate(row.happened_at),due_at:asDate(row.due_at),
    completed:row.done===true,actor_id:row.actor_id||null,
    owner_id:row.owner_id||null,direction:row.direction||null,
    wait_reason:row.wait_reason||null,task_key:row.task_key||null,
    updated_at:asDate(row.updated_at)
  };
}
function createActivityRepository(db){
  if(!db||typeof db.query!=='function')throw new TypeError('A SQL database is required');
  return {
    async get(id){
      const result=await db.query(
        'SELECT * FROM activities WHERE id=$1 AND deleted_at IS NULL LIMIT 1',[id]
      );
      return mapActivity(result.rows[0]);
    },
    async listForAccount(accountId,{limit=80}={}){
      const count=Math.max(1,Math.min(100,Number(limit)||80));
      const result=await db.query(
        'SELECT * FROM activities WHERE organization_id=$1 AND deleted_at IS NULL ORDER BY happened_at DESC,id DESC LIMIT $2',
        [accountId,count]
      );
      return result.rows.map(mapActivity);
    },
    async create({id,accountId=null,caseId=null,contactId=null,type,
      text='',body=null,happenedAt=null,dueAt=null,completed=true,
      actorId=null,ownerId=null,direction=null,waitReason=null,taskKey=null}={}){
      if(!id||!type||(!accountId&&!caseId))throw new TypeError('Activity must have ID, type and account or opportunity');
      const result=await db.query(
        `INSERT INTO activities(
          id,organization_id,opportunity_id,contact_id,type,text,body,
          happened_at,due_at,done,actor_id,owner_id,direction,wait_reason,task_key
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          COALESCE($8::timestamptz,now()),$9::timestamptz,$10,$11,$12,$13,$14,$15
        ) RETURNING *`,
        [id,accountId,caseId,contactId,type,text,body,happenedAt,dueAt,
         Boolean(completed),actorId,ownerId,direction,waitReason,taskKey]
      );
      return mapActivity(result.rows[0]);
    },
    async complete(id){
      const result=await db.query(
        'UPDATE activities SET done=true,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *',
        [id]
      );
      return mapActivity(result.rows[0]);
    },
    // All real outreach already completed counts, including contacts logged
    // before the December planning window and progress made after the deadline.
    async outreachSummary(){
      const result=await db.query(
        `SELECT
          count(DISTINCT a.organization_id)::int AS contacted,
          count(DISTINCT a.organization_id) FILTER (
            WHERE (a.happened_at AT TIME ZONE 'Europe/Oslo')::date =
                  (now() AT TIME ZONE 'Europe/Oslo')::date
          )::int AS contacted_today,
          count(*)::int AS touch_count
        FROM activities a
        JOIN organizations o ON o.id=a.organization_id AND o.deleted_at IS NULL
        WHERE a.deleted_at IS NULL
          AND a.type IN ('call','email','meeting','visning')
          AND a.direction='out'
          AND a.done=true
        `,[]
      );
      return {
        contacted:Number(result.rows[0]?.contacted)||0,
        contacted_today:Number(result.rows[0]?.contacted_today)||0,
        touch_count:Number(result.rows[0]?.touch_count)||0
      };
    }
  };
}
module.exports={mapActivity,createActivityRepository};
