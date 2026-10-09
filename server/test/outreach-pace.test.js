'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const pure=fs.readFileSync(path.join(__dirname,'../../src/outreach-pace.js'),'utf8');
const {outreachPace,outreachWeekdays}=vm.runInNewContext(pure+
  '\n({outreachPace,outreachWeekdays})');

test('weekdays exclude weekends and never include dates after deadline',()=>{
  assert.equal(outreachWeekdays('2026-12-04','2026-12-07'),2);
  assert.equal(outreachWeekdays('2027-06-01','2027-05-31'),0);
});
test('500-company goal is paced over remaining workdays, not visible queue cards',()=>{
  const pace=outreachPace({goal:500,contacted:100,
    start:'2026-12-01',deadline:'2026-12-07',today:'2026-11-10'});
  assert.equal(pace.remaining,400);
  assert.equal(pace.days,5);
  assert.equal(pace.daily,80);
  assert.equal(pace.weekly,400);
  assert.equal(pace.beforeStart,true);
});
test('goal can be reached early and overdue target never yields negative pace',()=>{
  const done=outreachPace({goal:500,contacted:510,start:'2026-12-01',
    deadline:'2027-05-31',today:'2027-01-01'});
  assert.equal(done.remaining,0);
  assert.equal(done.daily,0);
  const late=outreachPace({goal:500,contacted:475,start:'2026-12-01',
    deadline:'2027-05-31',today:'2027-06-02'});
  assert.equal(late.remaining,25);
  assert.equal(late.days,0);
  assert.equal(late.daily,25);
  assert.equal(late.overdue,true);
});
test('daily queue has an explicit expand action instead of a seven-company cap',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../../src/idag.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../../src/idagui.js'),'utf8');
  assert.match(code,/idSelectAccounts\(vis,UI\.id\.queueLimit\|\|ID\.topN\)/);
  assert.match(ui,/data-idmore="1"/);
  assert.match(ui,/UI\.id\.queueLimit=\(UI\.id\.queueLimit\|\|ID\.topN\)\+ID\.topN/);
  assert.match(ui,/idOutreachPace\(\)/);
});
