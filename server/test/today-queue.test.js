'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Load the real queue selection function, not a second copy of its logic.
// This function has no dependencies on browser state, storage or time.
const file=fs.readFileSync(path.join(__dirname,'../../src/idag.js'),'utf8');
const start=file.indexOf('function idSelectAccounts(');
const end=file.indexOf('function idQueue(){',start);
assert.ok(start>=0&&end>start,'expected pure queue selection function');
const select=vm.runInNewContext(file.slice(start,end)+'\nidSelectAccounts');

test('shows at most seven distinct accounts, preserving urgency order',()=>{
  const input=[
    {key:'reply-1',orgId:'norla',rank:1},
    {key:'task-1',orgId:'norla',rank:2},
    ...Array.from({length:8},(_,i)=>({key:'task-'+(i+2),orgId:'org-'+i,rank:3}))
  ];
  const result=select(input,7);
  assert.deepEqual(Array.from(result.shown,x=>x.orgId),
    ['norla','org-0','org-1','org-2','org-3','org-4','org-5']);
  assert.equal(result.more,2);
  assert.equal(input.length,10);
});
test('never invents work if fewer than seven accounts are due',()=>{
  const result=select([{key:'a',orgId:'a'},{key:'b',orgId:'b'}],7);
  assert.equal(result.shown.length,2);
  assert.equal(result.more,0);
});
test('uses unique item keys for tasks without an account ID',()=>{
  const result=select([{key:'task-a'},{key:'task-b'},{key:'task-a'}],7);
  assert.equal(result.shown.length,2);
  assert.equal(result.more,0);
});
