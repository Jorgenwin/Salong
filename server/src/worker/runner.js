'use strict';

const TERMINAL_SUCCESS=new Set(['completed','partial','needs_review']);

function positiveNumber(value,fallback){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?n:fallback;
}

function errorCode(error){
  return String(error&&error.code||'worker_error').slice(0,120);
}

function errorMessage(error){
  return String(error&&error.message||'Enrichment worker failed.').slice(0,500);
}

function retryable(error){
  return Boolean(error&&error.retryable===true);
}

function retryDelaySeconds(attemptCount,delays){
  const list=Array.isArray(delays)&&delays.length?delays:[30,120,600];
  const index=Math.max(0,Math.min(list.length-1,Number(attemptCount||1)-1));
  return positiveNumber(list[index],30);
}

function createEnrichmentWorker({
  jobs,
  execute,
  workerId,
  maxAttempts=3,
  retryDelays=[30,120,600],
  pollMs=2000,
  lockHeartbeatMs=30000,
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval,
  logger=()=>{}
}={}){
  if(!jobs||typeof jobs.claimNext!=='function'){
    throw new TypeError('createEnrichmentWorker requires jobs repository');
  }
  if(typeof execute!=='function'){
    throw new TypeError('createEnrichmentWorker requires execute(job, context)');
  }
  const id=String(workerId||'').trim();
  if(!id) throw new TypeError('workerId is required');

  const state={
    workerId:id,
    running:false,
    currentJobId:null,
    claimed:0,
    completed:0,
    rescheduled:0,
    failed:0,
    lastStartedAt:null,
    lastCompletedAt:null,
    lastError:null
  };

  const emit=(event,data={})=>{
    logger({event,workerId:id,...data});
  };

  async function runOnce(){
    const job=await jobs.claimNext(id);
    if(!job) return {claimed:false};

    state.running=true;
    state.currentJobId=job.id;
    state.claimed+=1;
    state.lastStartedAt=new Date().toISOString();
    emit('enrichment_job_claimed',{jobId:job.id,attemptCount:job.attemptCount});

    let lockTimer=null;
    if(typeof jobs.touch==='function'&&Number(lockHeartbeatMs)>0){
      lockTimer=setIntervalFn(()=>{
        Promise.resolve(jobs.touch(job.id,id)).then(updated=>{
          if(!updated){
            emit('enrichment_job_lock_heartbeat_lost',{jobId:job.id});
          }
        }).catch(error=>{
          emit('enrichment_job_lock_heartbeat_failed',{
            jobId:job.id,
            code:errorCode(error),
            message:errorMessage(error)
          });
        });
      },Number(lockHeartbeatMs));
    }

    const context={
      workerId:id,
      async setSourceStatus(source,status){
        const updated=await jobs.setSourceStatus(job.id,id,source,status);
        if(!updated){
          const error=new Error('Job lock was lost while updating source status.');
          error.code='job_lock_lost';
          throw error;
        }
        return updated;
      }
    };

    try{
      const result=await execute(job,context);
      const status=result&&result.status||'completed';
      if(!TERMINAL_SUCCESS.has(status)){
        const error=new Error('Executor returned invalid terminal status: '+status);
        error.code='invalid_executor_status';
        throw error;
      }

      const finished=await jobs.finish(job.id,id,{
        status,
        errorCode:result&&result.errorCode||null,
        errorMessage:result&&result.errorMessage||null
      });
      if(!finished){
        const error=new Error('Job lock was lost before completion.');
        error.code='job_lock_lost';
        throw error;
      }

      state.completed+=1;
      state.lastError=null;
      emit('enrichment_job_completed',{jobId:job.id,status});
      return {claimed:true,action:'finished',job:finished,result};
    }catch(error){
      const code=errorCode(error), message=errorMessage(error);
      const attempts=Number(job.attemptCount)||1;

      if(retryable(error)&&attempts<maxAttempts){
        const delaySeconds=retryDelaySeconds(attempts,retryDelays);
        const rescheduled=await jobs.reschedule(job.id,id,{
          delaySeconds,
          errorCode:code,
          errorMessage:message
        });
        if(!rescheduled){
          const lockError=new Error('Job lock was lost before reschedule.');
          lockError.code='job_lock_lost';
          throw lockError;
        }
        state.rescheduled+=1;
        state.lastError={code,message};
        emit('enrichment_job_rescheduled',{jobId:job.id,code,delaySeconds,attemptCount:attempts});
        return {claimed:true,action:'rescheduled',job:rescheduled,error:{code,message},delaySeconds};
      }

      const failed=await jobs.finish(job.id,id,{
        status:'failed',
        errorCode:code,
        errorMessage:message
      });
      if(!failed){
        const lockError=new Error('Job lock was lost before failure could be recorded.');
        lockError.code='job_lock_lost';
        throw lockError;
      }
      state.failed+=1;
      state.lastError={code,message};
      emit('enrichment_job_failed',{jobId:job.id,code,attemptCount:attempts});
      return {claimed:true,action:'failed',job:failed,error:{code,message}};
    }finally{
      if(lockTimer!==null){
        clearIntervalFn(lockTimer);
        lockTimer=null;
      }
      state.running=false;
      state.currentJobId=null;
      state.lastCompletedAt=new Date().toISOString();
    }
  }

  async function runLoop({signal}={}){
    emit('enrichment_worker_started');
    while(!(signal&&signal.aborted)){
      const outcome=await runOnce();
      if(!outcome.claimed){
        await sleep(pollMs);
      }
    }
    emit('enrichment_worker_stopped');
  }

  function health(){
    return {
      status:'ok',
      workerId:id,
      running:state.running,
      currentJobId:state.currentJobId,
      claimed:state.claimed,
      completed:state.completed,
      rescheduled:state.rescheduled,
      failed:state.failed,
      lastStartedAt:state.lastStartedAt,
      lastCompletedAt:state.lastCompletedAt,
      lastError:state.lastError
    };
  }

  return {runOnce,runLoop,health};
}

module.exports={
  createEnrichmentWorker,
  retryDelaySeconds,
  retryable,
  errorCode,
  errorMessage
};
