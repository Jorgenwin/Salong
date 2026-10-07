'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const test=require('node:test');

const {listMigrations,runMigrations}=require('../src/db/migrate');

function tempMigrations(files){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'salong-migrations-'));
  for(const [name,content] of Object.entries(files)){
    fs.writeFileSync(path.join(dir,name),content,'utf8');
  }
  return dir;
}

test('listMigrations only returns versioned sql files in lexical order',()=>{
  const dir=tempMigrations({
    '010_second.sql':'SELECT 2;',
    '002_first.sql':'SELECT 1;',
    'README.md':'ignore',
    'draft.sql':'ignore'
  });
  assert.deepEqual(listMigrations(dir).map(m=>m.version),['002_first','010_second']);
});

test('runMigrations skips applied versions and records new versions',async()=>{
  const dir=tempMigrations({
    '001_old.sql':'SELECT old;',
    '002_new.sql':'BEGIN; SELECT new; COMMIT;'
  });
  const calls=[];
  const db={
    async query(text,params){
      const sql=String(text).trim();
      calls.push({sql,params});
      if(sql.startsWith('SELECT version FROM schema_migrations')){
        return {rows:[{version:'001_old'}]};
      }
      return {rows:[]};
    }
  };
  const events=[];
  const result=await runMigrations(db,{dir,logger:event=>events.push(event)});
  assert.deepEqual(result,{applied:['002_new'],skipped:1});
  assert.equal(calls.some(call=>call.sql.includes('SELECT old')),false);
  assert.equal(calls.some(call=>call.sql.includes('SELECT new')),true);
  const insert=calls.find(call=>call.sql.startsWith('INSERT INTO schema_migrations'));
  assert.deepEqual(insert.params,['002_new']);
  assert.deepEqual(events.map(event=>event.event),['migration_started','migration_completed']);
});

test('runMigrations rolls back and reports the failing migration',async()=>{
  const dir=tempMigrations({'003_broken.sql':'BEGIN; SELECT broken; COMMIT;'});
  const calls=[];
  const db={
    async query(text){
      const sql=String(text).trim();
      calls.push(sql);
      if(sql.startsWith('SELECT version FROM schema_migrations')) return {rows:[]};
      if(sql.includes('SELECT broken')) throw new Error('boom');
      return {rows:[]};
    }
  };
  await assert.rejects(
    runMigrations(db,{dir}),
    error=>error.message==='boom'&&error.migration==='003_broken'
  );
  assert.equal(calls.includes('ROLLBACK'),true);
});

test('runMigrations requires a database boundary',async()=>{
  await assert.rejects(async()=>runMigrations(null),/requires an object with query/);
});
