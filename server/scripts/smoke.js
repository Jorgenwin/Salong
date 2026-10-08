'use strict';

const TERMINAL=new Set(['needs_review','completed','partial','failed','cancelled']);

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function requestJson(fetchFn,url,{method='GET',token,body}={}){
  const headers={accept:'application/json'};
  if(token) headers.authorization='Bearer '+String(token);
  if(body!==undefined) headers['content-type']='application/json';

  let response;
  try{
    response=await fetchFn(url,{
      method,
      headers,
      body:body===undefined?undefined:JSON.stringify(body)
    });
  }catch(error){
    const wrapped=new Error('Could not reach Salong API.');
    wrapped.code='network_error';
    wrapped.cause=error;
    throw wrapped;
  }

  let payload=null;
  try{ payload=await response.json(); }catch(_error){}
  if(!response.ok){
    const error=new Error(payload&&payload.error_message||('HTTP '+response.status));
    error.code=payload&&payload.error_code||'http_error';
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function runSmoke({
  baseUrl,
  token=null,
  accountId=null,
  fetchFn=global.fetch,
  pollMs=1000,
  maxPolls=60,
  logger=()=>{}
}={}){
  if(typeof fetchFn!=='function') throw new TypeError('runSmoke requires fetch');
  const base=String(baseUrl||'http://127.0.0.1:3000').replace(/\/$/,'');

  const health=await requestJson(fetchFn,base+'/health');
  if(!health||health.status!=='ok'){
    const error=new Error('Health check did not return status ok.');
    error.code='health_not_ok';
    throw error;
  }
  logger({event:'smoke_health_ok',service:health.service||null});

  if(!accountId){
    return {health:true,enrichment:null};
  }
  if(!token){
    const error=new Error('SALONG_ACCESS_TOKEN is required when SALONG_ACCOUNT_ID is set.');
    error.code='token_required';
    throw error;
  }

  const queued=await requestJson(
    fetchFn,
    base+'/api/enrichment/accounts/'+encodeURIComponent(accountId),
    {method:'POST',token,body:{}}
  );
  const jobId=queued&&queued.data&&queued.data.jobId;
  if(!jobId){
    const error=new Error('Enrichment enqueue did not return jobId.');
    error.code='missing_job_id';
    throw error;
  }
  logger({event:'smoke_enrichment_queued',jobId,accountId});

  for(let i=0;i<maxPolls;i++){
    const job=await requestJson(
      fetchFn,
      base+'/api/enrichment/jobs/'+encodeURIComponent(jobId),
      {token}
    );
    logger({event:'smoke_enrichment_status',jobId,status:job&&job.status||null});
    if(job&&TERMINAL.has(job.status)){
      if(job.status==='failed'||job.status==='cancelled'){
        const error=new Error('Enrichment smoke ended with status '+job.status+'.');
        error.code='enrichment_'+job.status;
        error.job=job;
        throw error;
      }
      return {
        health:true,
        enrichment:{
          jobId,
          status:job.status,
          sourceStatuses:job.sourceStatuses||{},
          hasResult:Boolean(job.result)
        }
      };
    }
    await sleep(Math.max(10,Number(pollMs)||1000));
  }

  const error=new Error('Timed out waiting for enrichment job.');
  error.code='enrichment_timeout';
  throw error;
}

async function main(){
  const result=await runSmoke({
    baseUrl:process.env.SALONG_API_URL||'http://127.0.0.1:3000',
    token:process.env.SALONG_ACCESS_TOKEN||null,
    accountId:process.env.SALONG_ACCOUNT_ID||null,
    pollMs:Number(process.env.SALONG_SMOKE_POLL_MS)||1000,
    maxPolls:Number(process.env.SALONG_SMOKE_MAX_POLLS)||60,
    logger:entry=>process.stdout.write(JSON.stringify({
      time:new Date().toISOString(),
      ...entry
    })+'\n')
  });
  process.stdout.write(JSON.stringify({
    event:'salong_smoke_ok',
    result
  })+'\n');
}

if(require.main===module){
  main().catch(error=>{
    process.stderr.write(JSON.stringify({
      event:'salong_smoke_failed',
      code:error.code||'smoke_failed',
      message:error.message
    })+'\n');
    process.exitCode=1;
  });
}

module.exports={runSmoke,requestJson,TERMINAL};
