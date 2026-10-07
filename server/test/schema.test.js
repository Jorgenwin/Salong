'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const ROOT=path.resolve(__dirname,'../..');
const migration=fs.readFileSync(
  path.join(ROOT,'server/db/migrations/001_initial.sql'),
  'utf8'
);

function hasTable(name){
  return new RegExp('CREATE TABLE(?: IF NOT EXISTS)?\\s+'+name+'\\s*\\(','i').test(migration);
}

test('initial migration contains the backend v1 system-of-record tables',()=>{
  const required=[
    'schema_migrations',
    'members',
    'organizations',
    'contacts',
    'opportunities',
    'activities',
    'prospects',
    'prospect_batches',
    'prospect_batch_accounts',
    'bookings',
    'enrichment_jobs',
    'enrichment_results',
    'sources',
    'researched_facts'
  ];
  assert.deepEqual(required.filter(name=>!hasTable(name)),[]);
});

test('roles and enrichment job states match ADR 0001',()=>{
  for(const role of ['owner','editor','reader']){
    assert.match(migration,new RegExp("'"+role+"'"));
  }
  for(const state of ['queued','running','needs_review','completed','partial','failed','cancelled']){
    assert.match(migration,new RegExp("'"+state+"'"));
  }
});

test('enrichment queue has a partial index for queued work',()=>{
  assert.match(
    migration,
    /CREATE INDEX enrichment_jobs_queue_idx[\s\S]*WHERE status='queued'/i
  );
});

test('research provenance can be linked to a source',()=>{
  assert.match(
    migration,
    /source_id text REFERENCES sources\(id\) ON DELETE SET NULL/i
  );
  assert.match(
    migration,
    /review_state text NOT NULL DEFAULT 'unreviewed'/i
  );
});

test('operational tables use explicit soft-delete columns where frontend semantics need them',()=>{
  for(const table of ['organizations','contacts','opportunities','activities']){
    const pattern=new RegExp(
      'CREATE TABLE '+table+' \\([\\s\\S]*?deleted_at timestamptz[\\s\\S]*?\\);',
      'i'
    );
    assert.match(migration,pattern);
  }
});
