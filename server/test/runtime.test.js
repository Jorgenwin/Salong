'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {createRuntime}=require('../src/runtime');

function config({nodeEnv='development',databaseUrl=null}={}){
  return {nodeEnv,databaseUrl};
}

function fakePg(){
  const calls=[];
  let ended=0;
  class Pool{
    async query(text,params){
      calls.push({text:String(text),params});
      if(String(text).includes('SELECT 1 AS ok')) return {rows:[{ok:1}]};
      if(String(text).includes('FROM organizations')) return {rows:[]};
      return {rows:[]};
    }
    async end(){ ended++; }
  }
  return {module:{Pool},calls,get ended(){return ended;}};
}

test('development runtime remains usable without a database',async()=>{
  const events=[];
  const runtime=await createRuntime({
    config:config(),
    logger:event=>events.push(event)
  });
  assert.equal(runtime.database,null);
  assert.equal(runtime.repositories,null);
  assert.equal(events[0].event,'database_not_configured');
  await runtime.close();
});

test('production refuses to start database runtime without DATABASE_URL',async()=>{
  await assert.rejects(
    createRuntime({config:config({nodeEnv:'production'})}),
    /DATABASE_URL is required in production/
  );
});

test('configured runtime pings database, exposes repositories and closes pool',async()=>{
  const pg=fakePg();
  const events=[];
  const runtime=await createRuntime({
    config:config({
      nodeEnv:'test',
      databaseUrl:'postgres://test:test@example.test/salong_test'
    }),
    pgModule:pg.module,
    migrate:false,
    logger:event=>events.push(event)
  });

  assert.ok(runtime.database);
  assert.ok(runtime.repositories);
  assert.equal(typeof runtime.repositories.accounts.get,'function');
  assert.equal(events[0].event,'database_connected');

  assert.equal(await runtime.repositories.accounts.get('missing'),null);
  await runtime.close();
  await runtime.close();
  assert.equal(pg.ended,1);
  assert.ok(events.some(event=>event.event==='database_closed'));
});

test('failed database bootstrap closes the pool before propagating',async()=>{
  let ended=0;
  class Pool{
    async query(){ throw new Error('connection refused'); }
    async end(){ ended++; }
  }

  await assert.rejects(
    createRuntime({
      config:config({
        nodeEnv:'test',
        databaseUrl:'postgres://test:test@example.test/salong_test'
      }),
      pgModule:{Pool},
      migrate:false
    }),
    /connection refused/
  );
  assert.equal(ended,1);
});
