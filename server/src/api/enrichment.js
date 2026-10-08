'use strict';

const {randomUUID}=require('node:crypto');

const TERMINAL=new Set(['needs_review','completed','partial','failed','cancelled']);

function decodePart(value){
  try{return decodeURIComponent(value);}
  catch(_error){return null;}
}

function error(status,errorCode,errorMessage,details){
  const body={success:false,error_code:errorCode,error_message:errorMessage};
  if(details) body.details=details;
  return {status,body};
}

async function readJson(req,{maxBytes=65536}={}){
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>maxBytes){
      const e=new Error('request_too_large');
      e.code='request_too_large';
      throw e;
    }
    chunks.push(chunk);
  }
  if(!chunks.length) return {};
  const text=Buffer.concat(chunks).toString('utf8').trim();
  if(!text) return {};
  try{return JSON.parse(text);}
  catch(_error){
    const e=new Error('invalid_json');
    e.code='invalid_json';
    throw e;
  }
}

function publicResult(row){
  if(!row) return null;
  return {
    organization:row.organization||null,
    eventSignals:row.eventSignals||[],
    contactCandidates:row.contactCandidates||[],
    contactData:row.contactData||[],
    recommendation:row.recommendation||null
  };
}

function publicJob(job,result){
  if(!job) return null;
  return {
    id:job.id,
    accountId:job.accountId,
    status:job.status,
    startedAt:job.startedAt||null,
    completedAt:job.completedAt||null,
    sourceStatuses:job.sourceStatuses||{},
    error:job.error||null,
    result:TERMINAL.has(job.status)?publicResult(result):null
  };
}

function requireRepos(repositories){
  return Boolean(
    repositories&&
    repositories.accounts&&typeof repositories.accounts.get==='function'&&
    repositories.enrichmentJobs&&
    typeof repositories.enrichmentJobs.create==='function'&&
    typeof repositories.enrichmentJobs.createMany==='function'&&
    typeof repositories.enrichmentJobs.get==='function'&&
    typeof repositories.enrichmentJobs.latestForAccount==='function'&&
    repositories.enrichmentResults&&typeof repositories.enrichmentResults.get==='function'
  );
}

async function withResult(repositories,job){
  if(!job) return null;
  const result=TERMINAL.has(job.status)
    ?await repositories.enrichmentResults.get(job.id)
    :null;
  return publicJob(job,result);
}

async function handleEnrichmentRequest({
  req,
  url,
  repositories,
  makeJobId=()=> 'enr_'+randomUUID()
}={}){
  if(!url||!url.pathname.startsWith('/api/enrichment/')) return null;
  if(!requireRepos(repositories)){
    return error(503,'backend_not_ready','Enrichment-backend er ikke klar.');
  }

  let match=url.pathname.match(/^\/api\/enrichment\/accounts\/([^/]+)$/);
  if(match&&req.method==='POST'){
    const accountId=decodePart(match[1]);
    if(!accountId) return error(400,'invalid_id','Ugyldig konto-ID.');

    const account=await repositories.accounts.get(accountId);
    if(!account) return error(404,'account_not_found','Kontoen finnes ikke.');

    try{ await readJson(req); }
    catch(e){
      if(e.code==='request_too_large') return error(413,'request_too_large','Forespørselen er for stor.');
      return error(400,'invalid_json','Forespørselen inneholder ugyldig JSON.');
    }

    const job=await repositories.enrichmentJobs.create({
      id:makeJobId(),
      accountId,
      requestedBy:req.salongUser&&req.salongUser.id||null
    });
    return {
      status:202,
      body:{success:true,data:{queued:1,jobId:job.id,jobIds:[job.id]}}
    };
  }

  if(url.pathname==='/api/enrichment/batch'&&req.method==='POST'){
    let body;
    try{ body=await readJson(req); }
    catch(e){
      if(e.code==='request_too_large') return error(413,'request_too_large','Forespørselen er for stor.');
      return error(400,'invalid_json','Forespørselen inneholder ugyldig JSON.');
    }

    if(!body||!Array.isArray(body.accountIds)){
      return error(400,'invalid_account_ids','accountIds må være en liste.');
    }

    const ids=[...new Set(body.accountIds.map(v=>String(v||'').trim()).filter(Boolean))];
    if(!ids.length) return error(400,'nothing_to_do','Ingen kontoer å berike.');
    if(ids.length>100) return error(400,'too_many_accounts','Maks 100 kontoer per batch.');

    const missing=[];
    for(const id of ids){
      if(!await repositories.accounts.get(id)) missing.push(id);
    }
    if(missing.length){
      return error(
        404,
        'account_not_found',
        'Én eller flere kontoer finnes ikke.',
        {accountIds:missing}
      );
    }

    const requestedBy=req.salongUser&&req.salongUser.id||null;
    const jobs=await repositories.enrichmentJobs.createMany(
      ids.map(accountId=>({id:makeJobId(),accountId,requestedBy}))
    );
    return {
      status:202,
      body:{
        success:true,
        data:{
          queued:jobs.length,
          jobIds:jobs.map(job=>job.id)
        }
      }
    };
  }

  match=url.pathname.match(/^\/api\/enrichment\/jobs\/([^/]+)$/);
  if(match&&req.method==='GET'){
    const id=decodePart(match[1]);
    if(!id) return error(400,'invalid_id','Ugyldig jobb-ID.');
    const job=await repositories.enrichmentJobs.get(id);
    if(!job) return error(404,'enrichment_job_not_found','Berik-jobben finnes ikke.');
    return {status:200,body:await withResult(repositories,job)};
  }

  match=url.pathname.match(/^\/api\/enrichment\/accounts\/([^/]+)\/latest$/);
  if(match&&req.method==='GET'){
    const accountId=decodePart(match[1]);
    if(!accountId) return error(400,'invalid_id','Ugyldig konto-ID.');
    const job=await repositories.enrichmentJobs.latestForAccount(accountId);
    return {status:200,body:job?await withResult(repositories,job):null};
  }

  return null;
}

module.exports={
  handleEnrichmentRequest,
  readJson,
  publicJob,
  publicResult,
  requireRepos
};
