'use strict';

// Conservative, replayable Claude Artifact -> Salong import mapping.
// Raw JSON always goes to artifact_export.documents before CRM insertion.
// Unsupported / ambiguous fields survive in staging and appear in diagnostics.
const TABLES=['organizations','prospects','contacts','opportunities','activities',
  'prospect_batches','prospect_batch_accounts','enrichment_jobs'];
const STAGES=new Set(['ny','dialog','visning','tilbud','holdt','bekreftet','tapt']);
const TYPES=new Set(['call','email','meeting','visning','note','task']);
const TERMINAL=new Set(['needs_review','partial','failed','cancelled']);
const {suggestForCompanyPlan}=require('./import-priority');

function str(v){ return typeof v==='string'&&v.trim()?v.trim():null; }
function text(v){ return v===null||v===undefined?null:String(v); }
function number(v){ return typeof v==='number'&&Number.isFinite(v)?v:null; }
function positiveInt(v){ return Number.isInteger(v)&&v>=0?v:null; }
function timestamp(v){
  if(!str(v)) return null;
  const t=Date.parse(v);
  return Number.isFinite(t)?new Date(t).toISOString():null;
}
function dateOnly(v){
  if(!str(v)||!(/^\d{4}-\d{2}-\d{2}$/).test(v)) return null;
  const d=new Date(v+'T00:00:00.000Z');
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v?v:null;
}
function domain(v){
  const s=str(v);
  if(!s) return null;
  try {
    const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);
    return u.hostname.toLowerCase()||null;
  }catch(_){ return null; }
}
function rawDocuments(exported){
  const collections=exported&&exported.collections;
  if(!collections||typeof collections!=='object'||Array.isArray(collections)){
    throw new TypeError('Artifact export must have a collections object');
  }
  const rows=[];
  for(const [collection,docs] of Object.entries(collections)){
    if(!docs||typeof docs!=='object'||Array.isArray(docs)){
      throw new TypeError('Collection must be an object: '+collection);
    }
    for(const [id,data] of Object.entries(docs)){
      if(!collection||!id||!data||typeof data!=='object'||Array.isArray(data)){
        throw new TypeError('Document must be an object: '+collection+'/'+id);
      }
      rows.push({collection,docId:id,data});
    }
  }
  return rows;
}
function buildImportPlan(exported){
  const raw=rawDocuments(exported);
  const map={};
  for(const t of TABLES) map[t]=new Map();
  const skipped=[];
  const reason=(c,id,why)=>skipped.push({collection:c,doc_id:id,reason:why});
  const by=col=>raw.filter(r=>r.collection===col&&!r.data.example);
  for(const {collection,docId,data:d} of raw){
    if(d.example===true) reason(collection,docId,'example');
  }
  for(const {docId:id,data:d} of by('orgs')){
    const name=str(d.name);
    if(!name){reason('orgs',id,'missing_name');continue;}
    map.organizations.set(id,{
      id,name,website:str(d.website),domain:domain(d.website)||str(d.domain),
      org_number:str(d.orgnr)||str(d.org_number),segment:str(d.segment),
      tier:['A','B','C'].includes(d.tier)?d.tier:null,former:d.former===true,
      notes:text(d.notes),created_at:timestamp(d.createdAt)
    });
    if(Array.isArray(d.contacts)&&d.contacts.length) reason('orgs',id,'embedded_contacts_retained_in_staging');
  }
  for(const {docId:id,data:d} of by('mtacc')){
    const name=str(d.name);
    if(!map.organizations.has(id)){
      if(!name){reason('mtacc',id,'missing_organization_name');continue;}
      map.organizations.set(id,{
        id,name,website:str(d.website),domain:domain(d.domain)||domain(d.website),
        org_number:str(d.orgnr),segment:str(d.segId),tier:null,former:false,
        notes:null,created_at:timestamp(d.createdAt)
      });
    }else{
      const org=map.organizations.get(id);
      if(!org.domain) org.domain=domain(d.domain)||domain(d.website);
      if(!org.org_number) org.org_number=str(d.orgnr);
    }
    const fit=number(d.fit&&d.fit.total);
    map.prospects.set(id,{
      organization_id:id,relationship:str(d.rel),kind:str(d.kind),
      status:str(d.status),stage:str(d.bStage),fit_score:fit,
      potential_score:null,expected_value:null,priority:str(d.prio),
      metadata:{artifact_collection:'mtacc'},created_at:timestamp(d.createdAt)
    });
  }
  const orgIds=new Set(map.organizations.keys());
  const contacts=by('mtper');
  for(const {docId:id,data:d} of contacts){
    const account=str(d.accId)||str(d.accountId);
    if(!account||!orgIds.has(account)){reason('mtper',id,'missing_or_excluded_organization');continue;}
    if(!str(d.name)){reason('mtper',id,'missing_contact_name');continue;}
    const dnc=Boolean(d.dnc);
    map.contacts.set(id,{
      id,organization_id:account,name:str(d.name),title:str(d.title),
      email:str(d.email),email_status:str(d.emailStatus),phone:str(d.phone),
      phone_status:str(d.phoneStatus),linkedin_url:str(d.linkedin),
      role_match:str(d.role),relevant:d.rel==='ja'?true:d.rel==='nei'?false:null,
      active:d.active!==false&&!dnc,do_not_contact:dnc,
      do_not_contact_reason:dnc?str(d.dnc&&d.dnc.reason):null,
      is_primary:d.isPrimary===true,verified_at:timestamp(d.verifiedAt),
      last_enriched_at:timestamp(d.enrichedAt),
      created_at:timestamp(d.createdAt)
    });
  }
  for(const {docId:id,data:d} of by('deals')){
    const account=str(d.orgId);
    if(!account||!orgIds.has(account)){reason('deals',id,'missing_or_excluded_organization');continue;}
    if(!str(d.title)){reason('deals',id,'missing_title');continue;}
    if(d.stage&&!STAGES.has(d.stage)){reason('deals',id,'unsupported_stage');continue;}
    const attendees=positiveInt(d.attendees);
    const recurring=Number.isInteger(d.recurring)&&d.recurring>=1?d.recurring:1;
    map.opportunities.set(id,{
      id,organization_id:account,title:str(d.title),stage:d.stage||'ny',
      room:str(d.room),event_date:dateOnly(d.date),attendees,
      pricing:['open','closed'].includes(d.pricing)?d.pricing:null,
      value_amount:number(d.value),recurring,source:str(d.source),
      lost_reason:str(d.lostReason),notes:text(d.notes),
      stage_at:timestamp(d.stageAt),created_at:timestamp(d.createdAt)
    });
  }
  for(const {docId:id,data:d} of by('acts')){
    const org=str(d.orgId),deal=str(d.dealId),pid=str(d.pid);
    const orgId=org&&orgIds.has(org)?org:null;
    const opportunityId=deal&&map.opportunities.has(deal)?deal:null;
    if(!orgId&&!opportunityId){reason('acts',id,'missing_organization_or_opportunity');continue;}
    if(!TYPES.has(d.type)){reason('acts',id,'unsupported_activity_type');continue;}
    const happened=timestamp(d.at);
    if(!happened){reason('acts',id,'missing_or_invalid_occurrence_date');continue;}
    map.activities.set(id,{
      id,organization_id:orgId,opportunity_id:opportunityId,
      contact_id:pid&&map.contacts.has(pid)?pid:null,
      type:d.type,text:text(d.text)||'',body:text(d.body),
      happened_at:happened,due_at:timestamp(d.due),
      done:d.done!==false,direction:str(d.dir),wait_reason:str(d.waitReason),
      task_key:str(d.taskKey),created_at:timestamp(d.createdAt)
    });
  }
  for(const {docId:id,data:d} of by('mtbat')){
    if(!str(d.name)){reason('mtbat',id,'missing_batch_name');continue;}
    map.prospect_batches.set(id,{
      id,name:str(d.name),status:str(d.status),wave:str(d.wave),
      segment_ids:Array.isArray(d.segIds)?d.segIds:[],
      created_at:timestamp(d.createdAt)
    });
    const seen=new Set();
    for(const [index,rawId] of (Array.isArray(d.accIds)?d.accIds:[]).entries()){
      const account=str(rawId);
      if(!account||!orgIds.has(account)){
        reason('mtbat',id,'batch_account_missing:'+index);continue;
      }
      if(seen.has(account)) continue;
      seen.add(account);
      map.prospect_batch_accounts.set(id+':'+account,{
        batch_id:id,organization_id:account,position:index+1
      });
    }
  }
  for(const {docId:id,data:d} of by('mtjob')){
    const account=str(d.accId);
    if(!account||!orgIds.has(account)){reason('mtjob',id,'missing_or_excluded_organization');continue;}
    if(d.kind&&d.kind!=='enrich'){reason('mtjob',id,'unsupported_job_kind');continue;}
    // Never re-activate browser-era queued/running jobs: they might spend real credits.
    const original=str(d.status);
    let status=null;
    if(original==='queued'||original==='running') status='cancelled';
    else if(original==='done'||original==='completed'||original==='needs_review') status='needs_review';
    else if(original==='error'||original==='failed') status='failed';
    else if(TERMINAL.has(original)) status=original;
    if(!status){reason('mtjob',id,'unsupported_job_status');continue;}
    map.enrichment_jobs.set(id,{
      id,account_id:account,status,
      source_statuses:{},
      error_code:status==='cancelled'&&original!=='cancelled'?'legacy_job_not_resumed':
        status==='needs_review'?'artifact_result_not_migrated':str(d.error_code),
      error_message:status==='cancelled'&&original!=='cancelled'?
        'Legacy browser job intentionally not resumed on import.':
        status==='needs_review'?'Legacy job requires review; raw results remain in staging.':str(d.error),
      attempt_count:0,
      started_at:timestamp(d.started_at),
      completed_at:timestamp(d.completed_at),
      created_at:timestamp(d.requested_at)||timestamp(d.createdAt)
    });
  }
  const known=new Set(['orgs','mtacc','mtper','deals','acts','mtbat','mtjob']);
  for(const r of raw){
    if(r.data.example===true) continue;
    if(!known.has(r.collection)) reason(r.collection,r.docId,'staging_only_no_mapping');
  }
  const consumed={
    orgs:['name','website','domain','orgnr','org_number','segment','tier','former','notes','createdAt','example'],
    mtacc:['name','website','domain','orgnr','segId','createdAt','rel','kind','status','bStage','fit','prio','example'],
    mtper:['accId','accountId','name','title','email','emailStatus','phone','phoneStatus','linkedin','role','rel','active','dnc','isPrimary','verifiedAt','enrichedAt','createdAt','example'],
    deals:['orgId','title','stage','room','date','attendees','pricing','value','recurring','source','lostReason','notes','stageAt','createdAt','example'],
    acts:['orgId','dealId','pid','type','text','body','at','due','done','dir','waitReason','taskKey','createdAt','example'],
    mtbat:['name','status','wave','segIds','accIds','createdAt','example'],
    mtjob:['accId','status','kind','error_code','error','started_at','completed_at','requested_at','createdAt','example']
  };
  const ignoredFields={};
  for(const {collection,data} of raw){
    if(data.example===true||!consumed[collection]) continue;
    const allowed=new Set(consumed[collection]);
    for(const key of Object.keys(data)){
      if(allowed.has(key)) continue;
      const stats=ignoredFields[collection]||(ignoredFields[collection]={});
      stats[key]=(stats[key]||0)+1;
    }
  }
  const reviewRequired=skipped.filter(item=>item.reason!=='example');
  const reasonCounts={};
  for(const item of reviewRequired){
    const key=item.reason.startsWith('batch_account_missing:')?'batch_account_missing':item.reason;
    reasonCounts[key]=(reasonCounts[key]||0)+1;
  }
  return {
    raw, rows:Object.fromEntries(TABLES.map(t=>[t,[...map[t].values()]])),
    report:{
      staged_documents:raw.length,
      example_documents:raw.filter(r=>r.data.example===true).length,
      planned:Object.fromEntries(TABLES.map(t=>[t,map[t].size])),
      not_mapped:skipped,
      review_required_count:reviewRequired.length,
      review_reason_counts:reasonCounts,
      staging_only_fields:ignoredFields
    }
  };
}

// Lightweight first launch: only normalize companies and their basic prospect
// classification. Everything else is still preserved in private staging.
function companyFirstPlan(exported){
  const plan=buildImportPlan(exported);
  const kept=new Set(['organizations','prospects']);
  const rows=Object.fromEntries(TABLES.map(table=>[table,kept.has(table)?plan.rows[table]:[]]));
  const priorities=suggestForCompanyPlan(rows,plan.raw);
  const companyIssues=plan.report.not_mapped.filter(item=>
    (item.collection==='orgs'||item.collection==='mtacc')&&
    !['example','embedded_contacts_retained_in_staging','missing_organization_name'].includes(item.reason)
  );
  // Nameless mtacc records (including links to excluded sample organizations)
  // are deliberately preserved in staging but not invented as CRM companies.
  const deferredUnnamed=plan.report.not_mapped.filter(item=>
    item.collection==='mtacc'&&item.reason==='missing_organization_name'
  );
  const reasons={};
  for(const issue of companyIssues){
    reasons[issue.reason]=(reasons[issue.reason]||0)+1;
  }
  return {
    raw:plan.raw,
    rows,
    report:{
      ...plan.report,
      mode:'companies_only',
      priorities,
      planned:Object.fromEntries(TABLES.map(t=>[t,rows[t].length])),
      review_required_count:companyIssues.length,
      review_reason_counts:reasons,
      deferred_unnamed_accounts:deferredUnnamed.length,
      deferred_collections:['mtper','deals','acts','mtbat','mtjob','audit'],
      note:'All original documents are preserved in private staging; only organizations and prospects are normalized.'
    }
  };
}

const WRITE_ORDER=[
  'organizations','prospects','contacts','opportunities','activities',
  'prospect_batches','prospect_batch_accounts','enrichment_jobs'
];
const COLUMNS={
  organizations:['id','name','website','domain','org_number','segment','tier','former','notes','created_at'],
  prospects:['organization_id','relationship','kind','status','stage','fit_score','potential_score','expected_value','priority','metadata','created_at'],
  contacts:['id','organization_id','name','title','email','email_status','phone','phone_status','linkedin_url','role_match','relevant','active','do_not_contact','do_not_contact_reason','is_primary','verified_at','last_enriched_at','created_at'],
  opportunities:['id','organization_id','title','stage','room','event_date','attendees','pricing','value_amount','recurring','source','lost_reason','notes','stage_at','created_at'],
  activities:['id','organization_id','opportunity_id','contact_id','type','text','body','happened_at','due_at','done','direction','wait_reason','task_key','created_at'],
  prospect_batches:['id','name','status','wave','segment_ids','created_at'],
  prospect_batch_accounts:['batch_id','organization_id','position'],
  enrichment_jobs:['id','account_id','status','source_statuses','error_code','error_message','attempt_count','started_at','completed_at','created_at']
};
const JSON_FIELDS=new Set(['metadata','segment_ids','source_statuses']);
function insertSQL(table,row){
  const columns=COLUMNS[table]; // never accept user-controlled table/column names
  const values=columns.map(col=>{
    const v=row[col];
    return JSON_FIELDS.has(col)?JSON.stringify(v):v===undefined?null:v;
  });
  const placeholders=columns.map((_,i)=>'$'+(i+1));
  const timestampCols=new Set(['created_at']);
  const cols=columns.map((col,i)=>col==='created_at'?'COALESCE('+placeholders[i]+'::timestamptz,now())':placeholders[i]);
  return {
    sql:'INSERT INTO public.'+table+' ('+columns.join(',')+') VALUES ('+cols.join(',')+') ON CONFLICT DO NOTHING',
    values
  };
}
async function applyImport(db,plan,{allowUnmapped=false}={}){
  if(plan.report.review_required_count>0&&!allowUnmapped){
    throw new Error('Import needs review: non-example documents cannot be fully mapped. Run dry-run, resolve mismatches or explicitly use --allow-unmapped with --apply after review.');
  }
  if(!db||typeof db.query!=='function') throw new TypeError('PostgreSQL client required');
  await db.query('BEGIN');
  try{
    await db.query("SELECT pg_advisory_xact_lock(hashtext('salong_artifact_import'))");
    // No accidental merge into an existing operational CRM.
    const preflightTables=[...WRITE_ORDER,'bookings','enrichment_results','sources','researched_facts'];
    const checks=preflightTables.map(table=>' (SELECT count(*) FROM public.'+table+') AS '+table);
    checks.push('(SELECT count(*) FROM artifact_export.documents) AS documents');
    const current=await db.query('SELECT'+checks.join(','));
    const count=current.rows[0];
    if(Object.values(count).some(value=>Number(value)>0)){
      throw new Error('Import target is not empty; refusing to overwrite or mix customer data');
    }
    // A previously provisioned owner is expected; never overwrite or import members.
    const memberResult=await db.query('SELECT id,role,active FROM public.members');
    if(memberResult.rows.length!==1||memberResult.rows[0].role!=='owner'||memberResult.rows[0].active!==true){
      throw new Error('Import requires exactly one active provisioned owner');
    }
    for(const r of plan.raw){
      await db.query(
        'INSERT INTO artifact_export.documents(collection,doc_id,data) VALUES ($1,$2,$3::jsonb)',
        [r.collection,r.docId,JSON.stringify(r.data)]
      );
    }
    for(const table of WRITE_ORDER){
      for(const row of plan.rows[table]){
        const prepared=insertSQL(table,row);
        await db.query(prepared.sql,prepared.values);
      }
    }
    const actual={};
    for(const table of WRITE_ORDER){
      const result=await db.query('SELECT count(*)::integer AS n FROM public.'+table);
      actual[table]=result.rows[0].n;
    }
    const staged=await db.query('SELECT count(*)::integer AS n FROM artifact_export.documents');
    await db.query('COMMIT');
    return {...plan.report,staged_documents:staged.rows[0].n,actual};
  }catch(error){
    await db.query('ROLLBACK');
    throw error;
  }
}
module.exports={rawDocuments,buildImportPlan,companyFirstPlan,applyImport,insertSQL,TABLES};
