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
    }
  };
}

module.exports={
  createRepositories,
  mapAccount,
  mapContact,
  mapOpportunity,
  buildProspectWhere,
  asTimestamp,
  asDateOnly
};
