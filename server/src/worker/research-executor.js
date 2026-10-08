'use strict';

const { runResearch } = require('../research/engine');
const { toRows } = require('../research/persist-map');

const RETRYABLE_CODES=new Set([
  'provider_unavailable',
  'rate_limited',
  'timeout',
  'network_error',
  'temporary_unavailable',
  'server_error'
]);

function normalizeSourceStatus(status){
  return status==='skipped'?'empty':status;
}

function researchFailure(run){
  const code=String(run&&run.errorCode||'research_failed');
  const error=new Error(String(run&&run.errorMessage||'Research failed.'));
  error.code=code;
  error.retryable=RETRYABLE_CODES.has(code) ||
    Boolean(run&&Array.isArray(run.errors)&&run.errors.some(item=>RETRYABLE_CODES.has(String(item&&item.code||''))));
  return error;
}

function requireRepository(repositories,name,methods){
  const repo=repositories&&repositories[name];
  if(!repo) throw new TypeError('createResearchExecutor requires repositories.'+name);
  for(const method of methods){
    if(typeof repo[method]!=='function'){
      throw new TypeError('createResearchExecutor requires repositories.'+name+'.'+method+'()');
    }
  }
  return repo;
}

function createResearchExecutor({
  repositories,
  ports={},
  cache,
  limits,
  now,
  logger=()=>{}
}={}){
  const accounts=requireRepository(repositories,'accounts',['get']);
  const contacts=requireRepository(repositories,'contacts',['listByAccount']);
  const enrichmentResults=requireRepository(repositories,'enrichmentResults',['upsert']);
  const sources=requireRepository(repositories,'sources',['save']);
  const researchedFacts=requireRepository(repositories,'researchedFacts',['save']);

  async function hasApprovedContact(accountId){
    const list=await contacts.listByAccount(accountId);
    return list.some(contact=>contact&&contact.is_primary===true&&contact.active!==false);
  }

  async function persist(job,run){
    const rows=toRows(run,{jobId:job.id,organizationId:job.accountId});

    // Sources first: researched_facts.source_id references them.
    for(const source of rows.sources) await sources.save(source);
    await enrichmentResults.upsert(job.id,rows.result);
    for(const fact of rows.facts) await researchedFacts.save(fact);

    return rows;
  }

  return async function executeResearch(job,context={}){
    if(!job||!job.id||!job.accountId){
      const error=new TypeError('Research executor requires a job with id and accountId.');
      error.code='invalid_job';
      throw error;
    }

    const account=await accounts.get(job.accountId);
    if(!account){
      const error=new Error('Kontoen finnes ikke.');
      error.code='account_not_found';
      throw error;
    }

    const approved=await hasApprovedContact(job.accountId);
    const run=await runResearch({
      account,
      ports,
      cache,
      limits,
      options:{hasApprovedContact:approved},
      onProgress:async progress=>{
        logger({event:'research_progress',jobId:job.id,accountId:job.accountId,progress});
      },
      now
    });

    // Record source state even if research ultimately fails. This keeps provider
    // failures visible instead of turning them into an empty successful result.
    if(typeof context.setSourceStatus==='function'){
      for(const [source,status] of Object.entries(run.sourceStatuses||{})){
        await context.setSourceStatus(source,normalizeSourceStatus(status));
      }
    }

    if(run.status==='failed') throw researchFailure(run);

    try{
      await persist(job,run);
    }catch(error){
      // Repository writes are idempotent/upsert-based. A transient DB failure can
      // safely retry the same job instead of converting partial persistence to success.
      if(!(error instanceof TypeError)) error.retryable=true;
      throw error;
    }

    return {
      status:run.status,
      errorCode:run.errorCode||null,
      errorMessage:run.errorMessage||null,
      sourceStatuses:run.sourceStatuses,
      usage:run.usage,
      recommended:run.recommended
    };
  };
}

module.exports={
  createResearchExecutor,
  normalizeSourceStatus,
  researchFailure,
  RETRYABLE_CODES
};
