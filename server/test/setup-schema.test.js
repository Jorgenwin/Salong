'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectSchema}=require('../scripts/setup-schema');

test('schema check reports missing CRM tables and pending migrations without revealing secrets',async()=>{
  const queries=[];
  const db={async query(sql,params){
    queries.push({sql,params});
    if(sql.includes('information_schema.tables'))return {rows:[{table_name:'members'},{table_name:'organizations'}]};
    if(sql.includes('to_regclass'))return {rows:[{migration_table:null}]};
    return {rows:[]};
  }};
  const status=await inspectSchema(db);
  assert.deepEqual(status.tables_present,['members','organizations']);
  assert.ok(status.tables_missing.includes('prospects'));
  assert.ok(status.migrations_pending.includes('001_initial'));
  assert.ok(status.migrations_pending.includes('002_artifact_export'));
  assert.equal(queries[0].params.length,1);
});

test('schema check recognizes previously applied migrations',async()=>{
  const db={async query(sql){
    if(sql.includes('information_schema.tables'))return {rows:[{table_name:'organizations'},{table_name:'members'}]};
    if(sql.includes('to_regclass'))return {rows:[{migration_table:'schema_migrations'}]};
    if(sql.includes('SELECT version'))return {rows:[{version:'001_initial'},{version:'002_artifact_export'},{version:'003_crm_edit_and_rls'}]};
    throw Error('unexpected query');
  }};
  const status=await inspectSchema(db);
  assert.deepEqual(status.migrations_pending,[]);
  assert.deepEqual(status.migrations_applied,['001_initial','002_artifact_export','003_crm_edit_and_rls']);
});
