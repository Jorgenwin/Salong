'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {
  rawDocuments,buildImportPlan,companyFirstPlan,applyImport,insertSQL,TABLES
}=require('../src/db/artifact-import');

function sample(){
  return {collections:{
    orgs:{
      'o-1':{name:'Test Arrangement AS',website:'https://example.test',segment:'Fag',tier:'A'},
      'o-demo':{name:'Example Only',example:true}
    },
    mtacc:{
      'o-1':{name:'Test Arrangement AS',rel:'prospekt',segId:'fag',fit:{total:72}},
      'o-2':{name:'Other Synthetic Org',website:'test.example'},
      'o-demo':{name:'Excluded organization',example:true}
    },
    mtper:{
      'p-1':{accId:'o-1',name:'Test Contact',email:'person@example.test',active:true},
      'p-orphan':{accId:'o-demo',name:'Demo orphan'}
    },
    deals:{
      'd-1':{orgId:'o-1',title:'Synthetic booking',stage:'tilbud',date:'2027-06-01',value:12000}
    },
    acts:{
      'a-1':{orgId:'o-1',dealId:'d-1',type:'task',text:'Call',at:'2026-10-08T08:00:00Z',done:false}
    },
    mtbat:{
      'b-1':{name:'Synthetic Batch',accIds:['o-1','o-2','o-demo','o-1']}
    },
    mtjob:{
      'j-1':{accId:'o-1',status:'running',kind:'enrich'},
      'j-2':{accId:'o-1',status:'done',kind:'enrich',outcome:'ok'}
    },
    audit:{
      'event-1':{action:'synthetic audit'}
    },
    settings:{
      'sample-1':{example:true}
    }
  }};
}
test('rejects invalid artifact document formats',()=>{
  assert.throws(()=>rawDocuments({}),/collections object/);
  assert.throws(()=>rawDocuments({collections:{orgs:[]}}),/Collection must be an object/);
  assert.throws(()=>rawDocuments({collections:{orgs:{bad:'text'}}}),/Document must be an object/);
});
test('stages every raw document but maps no example records',()=>{
  const p=buildImportPlan(sample());
  assert.equal(p.raw.length,14);
  assert.equal(p.report.example_documents,3);
  assert.equal(p.rows.organizations.length,2);
  assert.equal(p.rows.prospects.length,2);
  assert.equal(p.rows.contacts.length,1);
  assert.equal(p.rows.opportunities.length,1);
  assert.equal(p.rows.activities.length,1);
  assert.equal(p.rows.prospect_batches.length,1);
  assert.equal(p.rows.prospect_batch_accounts.length,2);
  assert.equal(p.rows.enrichment_jobs.length,2);
  assert.ok(p.report.not_mapped.some(x=>x.collection==='audit'&&x.reason==='staging_only_no_mapping'));
  assert.ok(p.report.not_mapped.some(x=>x.doc_id==='p-orphan'&&x.reason==='missing_or_excluded_organization'));
  assert.equal(p.rows.organizations[0].name,'Test Arrangement AS');
  assert.equal(p.rows.prospects[0].fit_score,72);
  assert.equal(p.rows.enrichment_jobs[0].status,'cancelled');
  assert.equal(p.rows.enrichment_jobs[0].error_code,'legacy_job_not_resumed');
  assert.equal(p.rows.enrichment_jobs[1].status,'needs_review');
  assert.equal(p.rows.contacts[0].is_primary,false);
});
test('never uses untrusted field names as SQL identifiers',()=>{
  const {sql,values}=insertSQL('organizations',{id:'o-1',name:'Robert ); DROP TABLE',website:'x'});
  assert.match(sql,/INSERT INTO public\.organizations/);
  assert.equal(sql.includes('Robert'),false);
  assert.equal(values[1],'Robert ); DROP TABLE');
});
test('unmapped real records require manual override before any transaction',async()=>{
  const plan=buildImportPlan(sample());
  let queried=false;
  await assert.rejects(()=>applyImport({async query(){queried=true;}},plan),/needs review/);
  assert.equal(queried,false);
  assert.ok(plan.report.review_required_count>0);
  assert.ok(plan.report.review_reason_counts.staging_only_no_mapping>0);
});
test('import stages all raw documents before CRM inserts and commits',async()=>{
  const p=buildImportPlan(sample());
  const calls=[];
  const db={
    async query(sql,params){
      calls.push({sql:String(sql),params});
      if(sql.startsWith('SELECT (SELECT count(*)')) return {rows:[{organizations:0,enrichment_jobs:0,documents:0}]};
      if(sql.startsWith('SELECT id,role,active FROM public.members')) return {rows:[{id:'salong-owner',role:'owner',active:true}]};
      if(sql.startsWith('SELECT count(*)::integer')) return {rows:[{n:0}]};
      return {rows:[]};
    }
  };
  const report=await applyImport(db,p,{allowUnmapped:true});
  assert.equal(report.staged_documents,0);
  assert.deepEqual(Object.keys(report.actual),TABLES);
  assert.equal(calls[0].sql,'BEGIN');
  const staging=calls.filter(x=>x.sql.includes('INSERT INTO artifact_export.documents'));
  assert.equal(staging.length,p.raw.length);
  assert.equal(staging.find(x=>x.params[1]==='o-demo').params[2],JSON.stringify({name:'Example Only',example:true}));
  const firstCRM=calls.findIndex(x=>x.sql.includes('INSERT INTO public.organizations'));
  const lastStaging=calls.map(x=>x.sql).lastIndexOf('INSERT INTO artifact_export.documents(collection,doc_id,data) VALUES ($1,$2,$3::jsonb)');
  assert.ok(firstCRM>lastStaging);
  assert.equal(calls.at(-1).sql,'COMMIT');
});
test('rejects import into nonempty database and rolls back without staging',async()=>{
  const calls=[];
  const db={async query(sql){
    calls.push(String(sql));
    if(String(sql).startsWith('SELECT (SELECT count(*)'))
      return {rows:[{organizations:'1',enrichment_jobs:'0',documents:'0'}]};
    return {rows:[]};
  }};
  await assert.rejects(()=>applyImport(db,buildImportPlan(sample()),{allowUnmapped:true}),/not empty/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.some(x=>x.includes('INSERT INTO artifact_export.documents')));
});

test('company-first mode stages all documents but normalizes only companies and tiers',()=>{
  const full=buildImportPlan(sample());
  const lite=companyFirstPlan(sample());
  assert.equal(lite.report.mode,'companies_only');
  assert.equal(lite.raw.length,full.raw.length);
  assert.equal(lite.rows.organizations.length,2);
  assert.equal(lite.rows.prospects.length,2);
  for(const table of TABLES.filter(t=>!['organizations','prospects'].includes(t))){
    assert.deepEqual(lite.rows[table],[]);
  }
  assert.equal(lite.report.review_required_count,0);
  assert.ok(lite.report.deferred_collections.includes('mtper'));
  assert.equal(lite.rows.organizations[0].tier,'A');
});

test('company-first mode defers nameless prospect links without inventing company names',()=>{
  const lite=companyFirstPlan({collections:{mtacc:{'unknown-1':{status:'new'}}}});
  assert.equal(lite.report.review_required_count,0);
  assert.equal(lite.report.deferred_unnamed_accounts,1);
  assert.equal(lite.rows.organizations.length,0);
  assert.equal(lite.raw.length,1);
});

test('company-first import refuses unprovisioned or multiple owner accounts',async()=>{
  const plan=companyFirstPlan(sample());
  const db={async query(sql){
    if(sql.startsWith('SELECT (SELECT count(*)')) return {rows:[{organizations:0,prospects:0,documents:0}]};
    if(sql.startsWith('SELECT id,role,active FROM public.members'))return {rows:[]};
    return {rows:[]};
  }};
  await assert.rejects(()=>applyImport(db,plan),/exactly one active provisioned owner/);
});
