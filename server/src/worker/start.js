'use strict';

const {hostname}=require('node:os');
const {loadConfig,publicConfigSummary}=require('../config');
const {createRuntime}=require('../runtime');
const {createProviderPorts,configuredProviderNames}=require('../providers');
const {createWorkerService}=require('./service');
const {createWorkerProcess}=require('./process');

function log(level,event,data={}){
  process.stdout.write(JSON.stringify({
    level,
    event,
    time:new Date().toISOString(),
    ...data
  })+'\n');
}

function defaultWorkerId(){
  return 'salong-'+hostname()+'-'+process.pid;
}

async function startWorker({
  env=process.env,
  fetchFn=global.fetch,
  logger=(entry)=>log('info',entry.event||'worker_event',entry),
  runtimeFactory=createRuntime
}={}){
  const config=loadConfig(env);
  const runtime=await runtimeFactory({
    config,
    logger:entry=>logger(entry)
  });

  if(!runtime.repositories){
    await runtime.close();
    const error=new Error('DATABASE_URL is required to start the enrichment worker.');
    error.code='database_not_configured';
    throw error;
  }

  const ports=createProviderPorts({config,fetchFn});
  const providerNames=configuredProviderNames(config);
  if(!providerNames.length){
    await runtime.close();
    const error=new Error('At least one research provider must be configured.');
    error.code='providers_not_configured';
    throw error;
  }

  const service=createWorkerService({
    repositories:runtime.repositories,
    ports,
    workerId:String(env.WORKER_ID||defaultWorkerId()),
    logger
  });

  const processRunner=createWorkerProcess({
    service,
    heartbeatMs:Number(env.WORKER_HEARTBEAT_MS)||30000,
    logger
  });

  const controller=new AbortController();
  const stop=signal=>{
    logger({event:'enrichment_worker_shutdown_requested',signal});
    controller.abort(signal);
    processRunner.stop(signal);
  };
  const onTerm=()=>stop('SIGTERM');
  const onInt=()=>stop('SIGINT');
  process.once('SIGTERM',onTerm);
  process.once('SIGINT',onInt);

  logger({
    event:'enrichment_worker_ready',
    workerId:service.workerId,
    providers:providerNames,
    config:publicConfigSummary(config)
  });

  try{
    await processRunner.run({signal:controller.signal});
  }finally{
    process.removeListener('SIGTERM',onTerm);
    process.removeListener('SIGINT',onInt);
    await runtime.close();
  }
}

if(require.main===module){
  startWorker().catch(error=>{
    process.stderr.write(JSON.stringify({
      level:'error',
      event:'enrichment_worker_start_failed',
      time:new Date().toISOString(),
      code:error.code||'worker_start_failed',
      message:error.message
    })+'\n');
    process.exit(1);
  });
}

module.exports={
  startWorker,
  defaultWorkerId
};
