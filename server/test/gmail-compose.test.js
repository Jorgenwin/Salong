'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../../src/tierseq.js'),'utf8');
const a=source.indexOf('function tsGmailCompose(');
const b=source.indexOf('/* utkast som er forfalt i dag */',a);
assert.ok(a!==-1&&b>a,'Gmail composer helper must be present');
const build=vm.runInNewContext(source.slice(a,b)+'\ntsGmailCompose',{URLSearchParams});

test('Gmail link pre-fills recipient, subject and message without sending',()=>{
  const url=new URL(build({to:'test@example.org',subject:'Hei og takk',body:'Hei,\nVil dere komme på visning?'}));
  assert.equal(url.origin,'https://mail.google.com');
  assert.equal(url.searchParams.get('view'),'cm');
  assert.equal(url.searchParams.get('to'),'test@example.org');
  assert.equal(url.searchParams.get('su'),'Hei og takk');
  assert.equal(url.searchParams.get('body'),'Hei,\nVil dere komme på visning?');
});
test('missing recipient or subject does not generate a send-ready link',()=>{
  assert.equal(build({to:'',subject:'Hi',body:'hello'}),'');
  assert.equal(build({to:'test@example.org',subject:'',body:'hello'}),'');
});
