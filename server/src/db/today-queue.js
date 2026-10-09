'use strict';
/* One ranked next action per real company; no demo state and no hard daily cap.
   Tasks take priority. Outbound-contacted companies are not presented as new. */
const DEFAULT_PAGE_SIZE=40,MAX_PAGE_SIZE=100;
function pageNumber(value,{min=0,max=100000}={}){
  const n=Number(value);
  if(!Number.isSafeInteger(n))return min;
  return Math.max(min,Math.min(max,n));
}
function isoDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().startsWith(value);
}
function mapTodayEntry(row){
  return {
    kind:row.kind,action_id:row.action_id,account_id:row.account_id,
    account_name:row.account_name,segment:row.segment||null,
    priority:row.priority||null,owner_id:row.owner_id||null,
    text:row.action_text||null,
    due_at:row.due_at?new Date(row.due_at).toISOString():null,
    rank:Number(row.sort_group)
  };
}
function createTodayQueueRepository(db){
  if(!db||typeof db.query!=='function')throw new TypeError('A database is required');
  return {
    async list({today,limit=DEFAULT_PAGE_SIZE,offset=0}={}){
      if(!isoDate(today))throw new TypeError('A valid Oslo date is required');
      const size=pageNumber(limit,{min:1,max:MAX_PAGE_SIZE});
      const skip=pageNumber(offset,{min:0,max:100000});
      const result=await db.query("\nWITH pending_tasks AS (\n SELECT 'task'::text AS kind, a.id AS action_id, o.id AS account_id,\n   o.name AS account_name, o.segment, o.tier AS priority,\n   COALESCE(a.owner_id,o.owner_id) AS owner_id,\n   COALESCE(NULLIF(trim(a.text),''),'Følg opp selskapet') AS action_text,\n   a.due_at,\n   CASE WHEN a.due_at IS NOT NULL AND\n     (a.due_at AT TIME ZONE 'Europe/Oslo')::date <= $3::date THEN 0\n     WHEN a.due_at IS NOT NULL THEN 1\n     ELSE 2 END AS sort_group\n FROM activities a\n LEFT JOIN opportunities d ON d.id=a.opportunity_id AND d.deleted_at IS NULL\n JOIN organizations o ON o.id=COALESCE(a.organization_id,d.organization_id)\n   AND o.deleted_at IS NULL\n WHERE a.deleted_at IS NULL AND a.type='task' AND a.done=false\n), chosen_task AS (\n SELECT DISTINCT ON (account_id) * FROM pending_tasks\n ORDER BY account_id,sort_group,due_at ASC NULLS LAST,action_id\n), next_actions AS (\n SELECT kind,action_id,account_id,account_name,segment,priority,owner_id,\n   action_text,due_at,sort_group FROM chosen_task\n UNION ALL\n SELECT 'first_contact'::text AS kind, 'first:'||o.id AS action_id,\n   o.id AS account_id, o.name AS account_name, o.segment,o.tier AS priority,\n   o.owner_id AS owner_id, 'Første kontakt'::text AS action_text,\n   NULL::timestamptz AS due_at,\n   CASE o.tier WHEN 'A' THEN 3 WHEN 'B' THEN 4 WHEN 'C' THEN 5 ELSE 6 END AS sort_group\n FROM organizations o\n WHERE o.deleted_at IS NULL\n   AND NOT EXISTS (\n     SELECT 1 FROM activities a\n     WHERE a.organization_id=o.id AND a.deleted_at IS NULL\n       AND a.done=true AND a.direction='out'\n       AND a.type IN ('call','email','meeting','visning')\n   )\n   AND NOT EXISTS (\n     SELECT 1 FROM activities a\n     LEFT JOIN opportunities d ON d.id=a.opportunity_id\n     WHERE COALESCE(a.organization_id,d.organization_id)=o.id\n       AND a.deleted_at IS NULL AND a.type='task' AND a.done=false\n   )\n)\nSELECT kind,action_id,account_id,account_name,segment,priority,owner_id,\n action_text,due_at,sort_group,COUNT(*) OVER()::int AS total\nFROM next_actions\nORDER BY sort_group,due_at ASC NULLS LAST,lower(account_name),account_id,action_id\nLIMIT $1 OFFSET $2",[size,skip,today]);
      return {
        items:result.rows.map(mapTodayEntry),
        total:Number(result.rows[0]?.total)||0,
        limit:size,offset:skip,today
      };
    }
  };
}
module.exports={createTodayQueueRepository,mapTodayEntry,isoDate,pageNumber};
