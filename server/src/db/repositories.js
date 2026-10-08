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
    is_primary: Boolean(row.is_primary),
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

const CALENDAR_TIME_ZONE='Europe/Oslo';
const CALENDAR_FORMATTER=new Intl.DateTimeFormat('en-GB',{
  timeZone:CALENDAR_TIME_ZONE,
  year:'numeric',
  month:'2-digit',
  day:'2-digit',
  hour:'2-digit',
  minute:'2-digit',
  hourCycle:'h23'
});

function calendarParts(value){
  if(!value) return {date:null,time:''};
  const instant=value instanceof Date?value:new Date(value);
  if(Number.isNaN(instant.getTime())) return {date:null,time:''};
  const parts=Object.fromEntries(
    CALENDAR_FORMATTER.formatToParts(instant)
      .filter(part=>part.type!=='literal')
      .map(part=>[part.type,part.value])
  );
  return {
    date:parts.year+'-'+parts.month+'-'+parts.day,
    time:parts.hour+':'+parts.minute
  };
}

function timeOnly(value){
  return calendarParts(value).time;
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
  const when=calendarParts(row.starts_at);
  const isHold=row.status==='holdt'||row.status==='forelopig';
  return {
    date:when.date,
    time:when.time,
    kind:isHold?'hold':'event',
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
  const when=calendarParts(source);
  const kind=row.type==='visning'?'visit':row.type==='meeting'?'meet':'due';
  return {
    date:when.date,
    time:when.time,
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

const ENRICHMENT_SOURCE_STATUSES=new Set(['ok','empty','blocked','plan_restricted','error','not_connected']);
const ENRICHMENT_FINISH_STATUSES=new Set(['needs_review','completed','partial','failed']);

function mapEnrichmentJob(row){
  if(!row) return null;
  return {
    id:row.id,
    accountId:row.account_id,
    status:row.status,
    requestedBy:row.requested_by||null,
    sourceStatuses:row.source_statuses||{},
    error:row.status==='failed'?(row.error_code||row.error_message||null):null,
    errorCode:row.error_code||null,
    errorMessage:row.error_message||null,
    attemptCount:Number(row.attempt_count)||0,
    availableAt:asTimestamp(row.available_at),
    lockedAt:asTimestamp(row.locked_at),
    lockedBy:row.locked_by||null,
    startedAt:asTimestamp(row.started_at),
    completedAt:asTimestamp(row.completed_at),
    createdAt:asTimestamp(row.created_at),
    updatedAt:asTimestamp(row.updated_at)
  };
}

function mapEnrichmentResult(row){
  if(!row) return null;
  return {
    jobId:row.job_id,
    organization:row.organization||null,
    eventSignals:Array.isArray(row.event_signals)?row.event_signals:[],
    contactCandidates:Array.isArray(row.contact_candidates)?row.contact_candidates:[],
    contactData:Array.isArray(row.contact_data)?row.contact_data:[],
    recommendation:row.recommendation||null,
    createdAt:asTimestamp(row.created_at),
    updatedAt:asTimestamp(row.updated_at)
  };
}

function mapSource(row){
  if(!row) return null;
  return {
    id:row.id,
    organizationId:row.organization_id||null,
    enrichmentJobId:row.enrichment_job_id||null,
    provider:row.provider,
    sourceUrl:row.source_url||null,
    providerRef:row.provider_ref||null,
    title:row.title||null,
    checkedAt:asTimestamp(row.checked_at),
    metadata:row.metadata||{},
    createdAt:asTimestamp(row.created_at)
  };
}

function mapResearchedFact(row){
  if(!row) return null;
  return {
    id:row.id,
    organizationId:row.organization_id,
    fieldKey:row.field_key,
    value:row.value==null?null:row.value,
    sourceId:row.source_id||null,
    confidence:row.confidence==null?null:Number(row.confidence),
    reviewState:row.review_state,
    checkedAt:asTimestamp(row.checked_at),
    createdAt:asTimestamp(row.created_at),
    updatedAt:asTimestamp(row.updated_at)
  };
}

function requireWorkerId(workerId){
  const value=String(workerId||'').trim();
  if(!value) throw new TypeError('workerId is required');
  return value;
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
    members:{
      async getByAuthSubject(authSubject){
        const subject=String(authSubject||'').trim();
        if(!subject) return null;
        const result=await db.query(`
          SELECT id, auth_subject, name, email, role, active
          FROM members
          WHERE auth_subject=$1
          LIMIT 1
        `,[subject]);
        const row=result.rows[0];
        if(!row) return null;
        return {
          id:row.id,
          authSubject:row.auth_subject,
          name:row.name,
          email:row.email||null,
          role:row.role,
          active:row.active!==false
        };
      }
    },

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

    enrichmentJobs:{
      async create({id,accountId,requestedBy=null,availableAt=null}={}){
        if(!id||!accountId) throw new TypeError('enrichmentJobs.create requires id and accountId');
        const result=await db.query(`
          INSERT INTO enrichment_jobs(
            id, account_id, requested_by, available_at
          )
          VALUES ($1,$2,$3,COALESCE($4::timestamptz,now()))
          RETURNING *
        `,[id,accountId,requestedBy,availableAt]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async get(id){
        const result=await db.query(
          'SELECT * FROM enrichment_jobs WHERE id = $1 LIMIT 1',
          [id]
        );
        return mapEnrichmentJob(result.rows[0]);
      },

      async createMany(items){
        if(!Array.isArray(items)||!items.length){
          throw new TypeError('enrichmentJobs.createMany requires a non-empty items array');
        }
        if(items.length>100) throw new TypeError('enrichmentJobs.createMany supports at most 100 jobs');

        const params=[];
        const marker=String.fromCharCode(36);
        const values=items.map((item,index)=>{
          if(!item||!item.id||!item.accountId){
            throw new TypeError('each enrichment job requires id and accountId');
          }
          const base=index*4;
          params.push(item.id,item.accountId,item.requestedBy||null,item.availableAt||null);
          return '('+marker+(base+1)+','+marker+(base+2)+','+marker+(base+3)+',COALESCE('+marker+(base+4)+'::timestamptz,now()))';
        });

        const result=await db.query(`
          INSERT INTO enrichment_jobs(id,account_id,requested_by,available_at)
          VALUES ${values.join(',')}
          RETURNING *
        `,params);
        return result.rows.map(mapEnrichmentJob);
      },

      async latestForAccount(accountId){
        const result=await db.query(`
          SELECT *
          FROM enrichment_jobs
          WHERE account_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,[accountId]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async claimNext(workerId){
        const worker=requireWorkerId(workerId);
        const result=await db.query(`
          WITH next_job AS (
            SELECT id
            FROM enrichment_jobs
            WHERE status='queued'
              AND available_at <= now()
            ORDER BY available_at, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE enrichment_jobs j
          SET status='running',
              locked_at=now(),
              locked_by=$1,
              started_at=COALESCE(j.started_at,now()),
              attempt_count=j.attempt_count+1,
              updated_at=now()
          FROM next_job
          WHERE j.id=next_job.id
          RETURNING j.*
        `,[worker]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async touch(id,workerId){
        const worker=requireWorkerId(workerId);
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET locked_at=now(),
              updated_at=now()
          WHERE id=$1
            AND status='running'
            AND locked_by=$2
          RETURNING *
        `,[id,worker]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async requeueStale(staleSeconds=900){
        const seconds=Number(staleSeconds);
        if(!Number.isFinite(seconds)||seconds<=0){
          throw new TypeError('staleSeconds must be a positive number');
        }
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET status='queued',
              available_at=now(),
              locked_at=NULL,
              locked_by=NULL,
              error_code='stale_worker_requeued',
              error_message='Previous worker lock expired; job requeued.',
              updated_at=now()
          WHERE status='running'
            AND locked_at IS NOT NULL
            AND locked_at < now()-($1::double precision * interval '1 second')
          RETURNING *
        `,[seconds]);
        return result.rows.map(mapEnrichmentJob);
      },

      async setSourceStatus(id,workerId,source,status){
        const worker=requireWorkerId(workerId);
        const sourceKey=String(source||'').trim();
        if(!sourceKey) throw new TypeError('source is required');
        if(!ENRICHMENT_SOURCE_STATUSES.has(status)){
          throw new TypeError('invalid enrichment source status');
        }
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET source_statuses=jsonb_set(
                COALESCE(source_statuses,'{}'::jsonb),
                ARRAY[$3]::text[],
                to_jsonb($4::text),
                true
              ),
              updated_at=now()
          WHERE id=$1
            AND status='running'
            AND locked_by=$2
          RETURNING *
        `,[id,worker,sourceKey,status]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async finish(id,workerId,{status,errorCode=null,errorMessage=null}={}){
        const worker=requireWorkerId(workerId);
        if(!ENRICHMENT_FINISH_STATUSES.has(status)){
          throw new TypeError('invalid enrichment finish status');
        }
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET status=$3,
              error_code=$4,
              error_message=$5,
              completed_at=now(),
              locked_at=NULL,
              locked_by=NULL,
              updated_at=now()
          WHERE id=$1
            AND status='running'
            AND locked_by=$2
          RETURNING *
        `,[id,worker,status,errorCode,errorMessage]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async reschedule(id,workerId,{delaySeconds=0,errorCode=null,errorMessage=null}={}){
        const worker=requireWorkerId(workerId);
        const delay=Number(delaySeconds);
        if(!Number.isFinite(delay)||delay<0){
          throw new TypeError('delaySeconds must be a non-negative number');
        }
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET status='queued',
              available_at=now()+($3::double precision * interval '1 second'),
              error_code=$4,
              error_message=$5,
              locked_at=NULL,
              locked_by=NULL,
              updated_at=now()
          WHERE id=$1
            AND status='running'
            AND locked_by=$2
          RETURNING *
        `,[id,worker,delay,errorCode,errorMessage]);
        return mapEnrichmentJob(result.rows[0]);
      },

      async cancelQueued(id){
        const result=await db.query(`
          UPDATE enrichment_jobs
          SET status='cancelled',
              completed_at=now(),
              updated_at=now()
          WHERE id=$1
            AND status='queued'
          RETURNING *
        `,[id]);
        return mapEnrichmentJob(result.rows[0]);
      }
    },

    enrichmentResults:{
      async upsert(jobId,result={}){
        if(!jobId) throw new TypeError('enrichmentResults.upsert requires jobId');
        const organization=result.organization==null?null:JSON.stringify(result.organization);
        const eventSignals=JSON.stringify(result.eventSignals||[]);
        const contactCandidates=JSON.stringify(result.contactCandidates||[]);
        const contactData=JSON.stringify(result.contactData||[]);
        const recommendation=result.recommendation==null?null:JSON.stringify(result.recommendation);
        const saved=await db.query(`
          INSERT INTO enrichment_results(
            job_id, organization, event_signals, contact_candidates, contact_data, recommendation
          )
          VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb)
          ON CONFLICT (job_id) DO UPDATE SET
            organization=EXCLUDED.organization,
            event_signals=EXCLUDED.event_signals,
            contact_candidates=EXCLUDED.contact_candidates,
            contact_data=EXCLUDED.contact_data,
            recommendation=EXCLUDED.recommendation,
            updated_at=now()
          RETURNING *
        `,[jobId,organization,eventSignals,contactCandidates,contactData,recommendation]);
        return mapEnrichmentResult(saved.rows[0]);
      },

      async get(jobId){
        const result=await db.query(
          'SELECT * FROM enrichment_results WHERE job_id = $1 LIMIT 1',
          [jobId]
        );
        return mapEnrichmentResult(result.rows[0]);
      }
    },

    sources:{
      async save({
        id,
        organizationId=null,
        enrichmentJobId=null,
        provider,
        sourceUrl=null,
        providerRef=null,
        title=null,
        checkedAt=null,
        metadata={}
      }={}){
        if(!id||!provider) throw new TypeError('sources.save requires id and provider');
        if(!organizationId&&!enrichmentJobId){
          throw new TypeError('sources.save requires organizationId or enrichmentJobId');
        }
        const saved=await db.query(`
          INSERT INTO sources(
            id, organization_id, enrichment_job_id, provider,
            source_url, provider_ref, title, checked_at, metadata
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            organization_id=EXCLUDED.organization_id,
            enrichment_job_id=EXCLUDED.enrichment_job_id,
            provider=EXCLUDED.provider,
            source_url=EXCLUDED.source_url,
            provider_ref=EXCLUDED.provider_ref,
            title=EXCLUDED.title,
            checked_at=EXCLUDED.checked_at,
            metadata=EXCLUDED.metadata
          RETURNING *
        `,[
          id,organizationId,enrichmentJobId,provider,
          sourceUrl,providerRef,title,checkedAt,JSON.stringify(metadata||{})
        ]);
        return mapSource(saved.rows[0]);
      },

      async listForJob(jobId){
        const result=await db.query(`
          SELECT *
          FROM sources
          WHERE enrichment_job_id=$1
          ORDER BY checked_at DESC NULLS LAST, created_at DESC
        `,[jobId]);
        return result.rows.map(mapSource);
      }
    },

    researchedFacts:{
      async save({
        id,
        organizationId,
        fieldKey,
        value=null,
        sourceId=null,
        confidence=null,
        reviewState='unreviewed',
        checkedAt=null
      }={}){
        if(!id||!organizationId||!fieldKey){
          throw new TypeError('researchedFacts.save requires id, organizationId and fieldKey');
        }
        const allowed=new Set(['unreviewed','accepted','rejected','conflict']);
        if(!allowed.has(reviewState)) throw new TypeError('invalid researched fact reviewState');
        const serialized=value==null?null:JSON.stringify(value);
        const saved=await db.query(`
          INSERT INTO researched_facts(
            id, organization_id, field_key, value,
            source_id, confidence, review_state, checked_at
          )
          VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET
            organization_id=EXCLUDED.organization_id,
            field_key=EXCLUDED.field_key,
            value=EXCLUDED.value,
            source_id=EXCLUDED.source_id,
            confidence=EXCLUDED.confidence,
            review_state=EXCLUDED.review_state,
            checked_at=EXCLUDED.checked_at,
            updated_at=now()
          RETURNING *
        `,[
          id,organizationId,fieldKey,serialized,
          sourceId,confidence,reviewState,checkedAt
        ]);
        return mapResearchedFact(saved.rows[0]);
      },

      async listForAccount(organizationId){
        const result=await db.query(`
          SELECT *
          FROM researched_facts
          WHERE organization_id=$1
          ORDER BY field_key, checked_at DESC NULLS LAST, created_at DESC
        `,[organizationId]);
        return result.rows.map(mapResearchedFact);
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
            AND b.status IN ('bekreftet','forelopig','holdt')
            AND (b.starts_at AT TIME ZONE 'Europe/Oslo')::date BETWEEN $1::date AND $2::date
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
                AND (COALESCE(a.due_at,a.happened_at) AT TIME ZONE 'Europe/Oslo')::date BETWEEN $1::date AND $2::date
              )
              OR
              (
                a.type='task'
                AND a.opportunity_id IS NOT NULL
                AND (a.due_at AT TIME ZONE 'Europe/Oslo')::date BETWEEN $1::date AND $2::date
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
  calendarParts,
  mapEnrichmentJob,
  mapEnrichmentResult,
  mapSource,
  mapResearchedFact,
  buildProspectWhere,
  asTimestamp,
  asDateOnly
};
