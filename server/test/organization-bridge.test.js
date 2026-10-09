'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../src/services/organization-bridge.js'),'utf8');
const map=vm.runInNewContext(source+'\nsalongMapImportedOrganizations');

test('maps imported priorities to existing Salong org fields without changing input',()=>{
 const rows=[{id:'db-1',name:'Aschehoug',org_number:'123',segment:'forlag',priority:'A',previous_customer:true}];
 const before=JSON.stringify(rows);
 const result=map(rows);
 assert.equal(result[0].id,'db-1');
 assert.equal(result[0].tier,'A');
 assert.equal(result[0].segment,'forlag');
 assert.equal(result[0].former,true);
 assert.equal(result[0].data_origin,'import');
 assert.equal(JSON.stringify(rows),before);
});
test('does not invent A/B/C where none exists and rejects duplicate IDs',()=>{
 assert.equal(map([{id:'x',name:'Ny kunde',priority:'1'}])[0].tier,'');
 assert.throws(()=>map([{id:'x',name:'A'},{id:'x',name:'B'}]),/Duplikat/);
 assert.throws(()=>map([{id:'x'}]),/ID eller navn/);
});
