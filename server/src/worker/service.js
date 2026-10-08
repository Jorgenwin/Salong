'use strict';

const {createEnrichmentWorker}=require('./runner');
const {createResearchExecutor}=require('./research-executor');
const {createPageCache}=require('../research/page-cache');

function hasProviderPorts(ports={}){
  return Boolean(
    typeof ports.search==='function' ||
    typeof ports.fetch==='function' ||
    ports.apollo ||
    ports.llm
  );
}

function requireWorkerRepositories(repositories){
  if(!repositories) throw new TypeError('worker service requires repositories');
  if(!repositories.enrichmentJobs||typeof repositories.enrichmentJobs.claimNext!=='function'){
    throw new TypeError('worker service requires repositories.enrichmentJobs');
  }
  return repositories;
}

function createWorkerService({
  repositories,
  ports={},
  workerId,
  cache,
  limits,
  logger=()=>{},
  maxAttempts=3,
  retryDelays=[30,120,600],
  pollMs=2000,
  sleep
}={}){
  const repos=requireWorkerRepositories(repositories);
  if(!hasProviderPorts(ports)){
    const error=new Error('Research provider ports are not configured.');
    error.code='providers_not_configured';
    throw error;
  }

  const researchCache=cache||createPageCache();
  const execute=createResearchExecutor({
    repositories:repos,
    ports,
    cache:researchCache,
    limits,
    logger
  });

  const worker=createEnrichmentWorker({
    jobs:repos.enrichmentJobs,
    execute,
    workerId,
    maxAttempts,
    retryDelays,
    pollMs,
    sleep,
    logger
  });

  return {
    workerId:String(workerId||''),
    runOnce:worker.runOnce,
    runLoop:worker.runLoop,
    health:worker.health
  };
}

module.exports={
  createWorkerService,
  hasProviderPorts,
  requireWorkerRepositories
};
