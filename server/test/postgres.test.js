'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createPostgres,
  requireConnectionString,
  loadPg
}=require('../src/db/postgres');

function fakePg(){
  const calls=[];
  let ends=0;
  class Pool{
    constructor(options){
      calls.push(['construct',options]);
    }
    async query(text,params){
      calls.push(['query',String(text),params]);
      if(String(text).includes('SELECT 1 AS ok')) return {rows:[{ok:1}]};
      return {rows:[]};
    }
    async end(){
      ends++;
      calls.push(['end']);
    }
  }
  return {module:{Pool},calls,get ends(){return ends;}};
}

test('postgres adapter requires a connection string and Pool implementation',()=>{
  assert.throws(()=>requireConnectionString(''),/DATABASE_URL is required/);
  assert.throws(()=>loadPg({}),/pg\.Pool/);
});

test('postgres adapter uses parameterized query boundary and closes once',async()=>{
  const pg=fakePg();
  const db=createPostgres({
    connectionString:'postgres://user:secret@example.test:5432/salong',
    pgModule:pg.module,
    max:4
  });

  assert.equal(await db.ping(),true);
  const result=await db.query('SELECT * FROM organizations WHERE id=$1',['o-1']);
  assert.deepEqual(result.rows,[]);

  const options=pg.calls[0][1];
  assert.equal(options.connectionString,'postgres://user:secret@example.test:5432/salong');
  assert.equal(options.max,4);
  assert.equal(options.application_name,'salong');
  assert.deepEqual(pg.calls[2],['query','SELECT * FROM organizations WHERE id=$1',['o-1']]);

  await db.close();
  await db.close();
  assert.equal(pg.ends,1);
  assert.equal(db.closed,true);
  await assert.rejects(db.query('SELECT 1'),/pool is closed/i);
});
