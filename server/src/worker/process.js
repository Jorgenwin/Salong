'use strict';

function requireService(service){
  if(!service||typeof service.runLoop!=='function'||typeof service.health!=='function'){
    throw new TypeError('worker process requires service.runLoop() and service.health()');
  }
  return service;
}

function createWorkerProcess({
  service,
  logger=()=>{},
  heartbeatMs=30000,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval
}={}){
  const worker=requireService(service);
  const interval=Math.max(1000,Number(heartbeatMs)||30000);
  let controller=null;
  let heartbeat=null;
  let running=false;

  function health(){
    return {
      processRunning:running,
      ...worker.health()
    };
  }

  async function run({signal}={}){
    if(running) throw new Error('worker process is already running');
    controller=new AbortController();
    running=true;

    let detach=()=>{};
    if(signal){
      const abort=()=>controller.abort(signal.reason);
      if(signal.aborted) abort();
      else{
        signal.addEventListener('abort',abort,{once:true});
        detach=()=>signal.removeEventListener('abort',abort);
      }
    }

    logger({event:'enrichment_worker_process_started',...health()});
    heartbeat=setIntervalFn(()=>{
      logger({event:'enrichment_worker_heartbeat',...health()});
    },interval);

    try{
      await worker.runLoop({signal:controller.signal});
    }finally{
      if(heartbeat!==null){
        clearIntervalFn(heartbeat);
        heartbeat=null;
      }
      detach();
      running=false;
      logger({event:'enrichment_worker_process_stopped',...health()});
      controller=null;
    }
  }

  function stop(reason='shutdown'){
    if(controller&&!controller.signal.aborted){
      controller.abort(reason);
      return true;
    }
    return false;
  }

  return {
    run,
    stop,
    health,
    get running(){ return running; }
  };
}

module.exports={
  createWorkerProcess,
  requireService
};
