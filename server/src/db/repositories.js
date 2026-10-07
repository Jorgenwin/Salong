'use strict';

function requireDb(db) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('createRepositories requires an object with query(text, params)');
  }
  return db;
}

function asTimestamp(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function asDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0,10);
  return String(value).slice(0,10);
}

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    org_number: row.org_number || null,
    domain: row.domain || null,
    website: row.website || null,
    segment_id: row.segment || null,
    owner_id: row.owner_id || null,
    relation: row.relationship || null,
    kind: row.prospect_kind || null,
    status: row.prospect_status || null,
    stage: row.prospect_stage || null,
    fit_score: row.fit_score == null ? null : Number(row.fit_score),
    batch_id: row.batch_id || null,
    data_status: row.deleted_at ? 'deleted' : 'active'
  };
}

function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    account_id: row.organization_id,
    name: row.name || '',
    title: row.title || '',
    email: row.email || null,
    email_status: row.email_status || null,
    phone: row.phone || null,
    phone_status: row.phone_status || null,
    linkedin_url: row.linkedin_url || null,
    role_match: row.role_match || null,
    relevant: row.relevant == null ? null : Boolean(row.relevant),
    active: row.active !== false,
    do_not_contact: Boolean(row.do_not_contact),
    verified: Boolean(row.verified_at),
    last_enriched_at: asTimestamp(row.last_enriched_at || row.verified_at)
  };
}

function mapOpportunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    account_id: row.organization_id,
    title: row.title || '',
    stage: row.stage,
    value: row.value_amount == null ? 0 : Number(row.value_amount),
    room: row.room || null,
    event_date: asDateOnly(row.event_date),
    attendees: row.attendees == null ? 0 : Number(row.attendees),
    owner_id: row.owner_id || null,
    stage_changed_at: asTimestamp(row.stage_at),
    lost_reason: row.lost_reason || null
  };
}

const STAGE_STATUS={
  ny:'Ny forespørsel',
  dialog:'Dialog',
  visning:'Omvisning',
  tilbud:'Tilbud sendt',
  holdt:'Holdt av',
  bekreftet:'Bekreftet',
  tapt:'Tapt'
};

function calendarKindForStage(stage){
  if(stage==='bekreftet') return 'event';
  if(stage==='holdt') return 'hold';
  if(stage==='tilbud') return 'offer';
  return 'enq';
}

function timeOnly(value){
  if(!value) return '';
  const timestamp=asTimestamp(value);
  if(!timestamp) return '';
  const match=timestamp.match(/T(\d{2}:\d{2})/);
  return match?match[1]:'';
}

function mapOpportunityCalendar(row){
  return {
    date:asDateOnly(row.event_date),
    time:'',
    kind:calendarKindForStage(row.stage),
    title:row.title||'',
    org:row.organization_name||'',
    room:row.room||'',
    owner:row.owner_id||null,
    status:STAGE_STATUS[row.stage]||row.stage||'',
    open:'deal:'+row.id
  };
}

function mapBookingCalendar(row){
  return {
    date:asDateOnly(row.starts_at),
    time:timeOnly(row.starts_at),
    kind:row.status==='holdt'?'hold':'event',
    title:row.title||'',
    org:row.organization_name||'',
    room:row.room||'',
    owner:null,
    status:row.status||'Booking',
    open:row.organization_id?'org:'+row.organization_id:''
  };
}

function mapActivityCalendar(row){
  const source=row.due_at||row.happened_at;
  const kind=row.type==='visning'?'visit':row.type==='meeting'?'meet':'due';
  return {
    date:asDateOnly(source),
    time:timeOnly(source),
    kind,
    title:row.text||'',
    org:row.organization_name||'',
    room:row.opportunity_room||'',
    owner:row.owner_id||row.opportunity_owner_id||null,
    status:kind==='due'?'Frist':'Planlagt',
    open:row.opportunity_id?'deal:'+row.opportunity_id:row.organization_id?'org:'+row.organization_id:''
  };
}

function compareCalendarItems(a,b){
  return String(a.date||'').localeCompare(String(b.date||''))||
    String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||
    String(a.org||'').localeCompare(String(b.org||''),'nb');
}

const ACCOUNT_SELECT=`
  SELECT
    o.id,
    o.name,
    o.org_number,
    o.domain,
    o.website,
    o.segment,
    o.owner_id,
    o.deleted_at,
    p.relationship,
    p.kind AS prospect_kind,
    p.status AS prospect_status,
    p.stage AS prospect_stage,
    p.fit_score,
    (
      SELECT pba.batch_id
      FROM prospect_batch_accounts pba
      WHERE pba.organization_id = o.id
      ORDER BY pba.created_at DESC, pba.batch_id
      LIMIT 1
    ) AS batch_id
  FROM organizations o
  LEFT JOIN prospects p ON p.organization_id = o.id
`;

function buildProspectWhere(filter) {
  const where=['o.deleted_at IS NULL'];
  const params=[];

  function add(sql, value) {
    params.push(value);
    where.push(sql.replace('?', '$'+params.length));
  }

  if (filter.segment_id) add('o.segment = ?', filter.segment_id);
  if (filter.owner_id) add('COALESCE(p.owner_id, o.owner_id) = ?', filter.owner_id);
  if (filter.status) add('p.status = ?', filter.status);
  if (filter.batch_id) {
    add(`EXISTS (
      SELECT 1
      FROM prospect_batch_accounts fba
      WHERE fba.organization_id = o.id
        AND fba.batch_id = ?
    )`, filter.batch_id);
  }

  return {where:where.join(' AND '),params};
}

function createRepositories(input) {
  const db=requireDb(input);

  return {
    accounts:{
      async get(id) {
        const result=await db.query(
          ACCOUNT_SELECT+' WHERE o.id = $1 AND o.deleted_at IS NULL LIMIT 1',
          [id]
        );
        return mapAccount(result.rows[0]);
      },

      async listProspects(filter={}) {
        const {where,params}=buildProspectWhere(filter);
        const result=await db.query(
          ACCOUNT_SELECT+' WHERE '+where+' ORDER BY p.fit_score DESC NULLS LAST, o.name ASC',
          params
        );
        return result.rows.map(mapAccount);
      }
    },

    contacts:{
      async listByAccount(accountId) {
        const result=await db.query(`
          SELECT *
          FROM contacts
          WHERE organization_id = $1
            AND deleted_at IS NULL
          ORDER BY is_primary DESC, relevant DESC NULLS LAST, name ASC
        `,[accountId]);
        return result.rows.map(mapContact);
      }
    },

    opportunities:{
      async list(accountId=null) {
        const params=[];
        let where='deleted_at IS NULL';
        if(accountId){
          params.push(accountId);
          where+=' AND organization_id = $1';
        }
        const result=await db.query(`
          SELECT *
          FROM opportunities
          WHERE ${where}
          ORDER BY event_date ASC NULLS LAST, created_at DESC
        `,params);
        return result.rows.map(mapOpportunity);
      }
    },

    calendar:{
      async list({from,to}) {
        const range=[from,to];

        const opportunities=await db.query(`
          SELECT d.*, o.name AS organization_name
          FROM opportunities d
          LEFT JOIN organizations o ON o.id=d.organization_id
          WHERE d.deleted_at IS NULL
            AND d.stage <> 'tapt'
            AND d.event_date BETWEEN $1::date AND $2::date
          ORDER BY d.event_date, d.created_at
        `,range);

        const bookings=await db.query(`
          SELECT b.*, o.name AS organization_name
          FROM bookings b
          LEFT JOIN organizations o ON o.id=b.organization_id
          WHERE b.starts_at IS NOT NULL
            AND b.starts_at::date BETWEEN $1::date AND $2::date
          ORDER BY b.starts_at, b.created_at
        `,range);

        const activities=await db.query(`
          SELECT
            a.*,
            o.name AS organization_name,
            d.room AS opportunity_room,
            d.owner_id AS opportunity_owner_id
          FROM activities a
          LEFT JOIN organizations o ON o.id=a.organization_id
          LEFT JOIN opportunities d ON d.id=a.opportunity_id
          WHERE a.deleted_at IS NULL
            AND a.done=false
            AND (
              (
                a.type IN ('visning','meeting')
                AND COALESCE(a.due_at,a.happened_at)::date BETWEEN $1::date AND $2::date
              )
              OR
              (
                a.type='task'
                AND a.opportunity_id IS NOT NULL
                AND a.due_at::date BETWEEN $1::date AND $2::date
              )
            )
          ORDER BY COALESCE(a.due_at,a.happened_at), a.created_at
        `,range);

        return [
          ...opportunities.rows.map(mapOpportunityCalendar),
          ...bookings.rows.map(mapBookingCalendar),
          ...activities.rows.map(mapActivityCalendar)
        ].filter(item=>item.date).sort(compareCalendarItems);
      }
    }
  };
}

module.exports={
  createRepositories,
  mapAccount,
  mapContact,
  mapOpportunity,
  mapOpportunityCalendar,
  mapBookingCalendar,
  mapActivityCalendar,
  compareCalendarItems,
  buildProspectWhere,
  asTimestamp,
  asDateOnly
};
