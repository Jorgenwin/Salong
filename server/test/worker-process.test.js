'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {createWorkerProcess}=require('../src/worker/process');

function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}

test('worker process requires service lifecycle methods',()=>{
  assert.throws(
    ()=>createWorkerProcess({service:{}}),
    /service\.runLoop\(\) and service\.health\(\)/
  );
});

test('worker process emits heartbeat and stops through abort signal',async()=>{
  const events=[];
  const loopStarted=deferred();
  let loopSignal=null;
  let timerFn=null;
  let cleared=null;

  const service={
    health(){
      return {status:'ok',workerId:'worker-1',running:Boolean(loopSignal&&!loopSignal.aborted)};
    },
    async runLoop({signal}){
      loopSignal=signal;
      loopStarted.resolve();
      await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    }
  };

  const process=createWorkerProcess({
    service,
    logger:event=>events.push(event),
    heartbeatMs:5000,
    setIntervalFn(fn,ms){
      assert.equal(ms,5000);
      timerFn=fn;
      return 42;
    },
    clearIntervalFn(id){ cleared=id; }
  });

  const run=process.run();
  await loopStarted.promise;

  assert.equal(process.running,true);
  assert.equal(process.health().processRunning,true);
  timerFn();
  assert.equal(events.some(e=>e.event==='enrichment_worker_heartbeat'),true);

  assert.equal(process.stop('test_shutdown'),true);
  await run;

  assert.equal(loopSignal.aborted,true);
  assert.equal(loopSignal.reason,'test_shutdown');
  assert.equal(cleared,42);
  assert.equal(process.running,false);
  assert.equal(events[0].event,'enrichment_worker_process_started');
  assert.equal(events.at(-1).event,'enrichment_worker_process_stopped');
});

test('external abort is forwarded to the worker loop',async()=>{
  const outer=new AbortController();
  const loopStarted=deferred();
  let seen=null;

  const service={
    health(){ return {status:'ok'}; },
    async runLoop({signal}){
      seen=signal;
      loopStarted.resolve();
      await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    }
  };

  const process=createWorkerProcess({
    service,
    setIntervalFn(){ return 1; },
    clearIntervalFn(){}
  });

  const run=process.run({signal:outer.signal});
  await loopStarted.promise;
  outer.abort('sigterm');
  await run;

  assert.equal(seen.aborted,true);
  assert.equal(seen.reason,'sigterm');
});

test('worker process refuses a second concurrent run',async()=>{
  const loopStarted=deferred();
  let finish;

  const service={
    health(){ return {status:'ok'}; },
    async runLoop({signal}){
      loopStarted.resolve();
      await new Promise(resolve=>{
        finish=resolve;
        signal.addEventListener('abort',resolve,{once:true});
      });
    }
  };

  const process=createWorkerProcess({
    service,
    setIntervalFn(){ return 1; },
    clearIntervalFn(){}
  });

  const first=process.run();
  await loopStarted.promise;
  await assert.rejects(()=>process.run(),/already running/);
  process.stop();
  finish();
  await first;
});
