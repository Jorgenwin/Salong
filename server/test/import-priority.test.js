'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {analyzeAccount,rankAccounts,suggestForCompanyPlan}=require('../src/db/import-priority');

const event=(level='Dokumentert')=>({
  event_signals:[{level,source_url:'https://example.test/events',sourceDate:'2026-10-06'}]
});
const publisher=(id,name,extra={})=>({
  id,name,segId:'forlag',geo:'oslo',size:'',about:'Utgir litteratur og holder boklanseringer',
  enr:event(),...extra
});

test('cultural venue mentioned only in notes does not make trade organization cultural core',()=>{
  const a=analyzeAccount({
    id:'e1',name:'Fagorganisasjon for bygg',segId:'fag',geo:'oslo',
    about:'Arrangerer kurs for medlemmer',why:'Holdt en konferanse pa museum',
    enr:event()
  });
  assert.equal(a.culture,2);
  assert.equal(a.event,'Dokumentert');
  assert.equal(a.fit,60);
});
test('artificial intelligence does not count as the art keyword',()=>{
  const a=analyzeAccount({
    id:'ai',name:'Forskning pa maskinlaering',segId:'forskning',
    about:'Arbeider med kunstig intelligens',why:'',
    enr:event('Indikasjon')
  });
  assert.equal(a.culture,2);
});
test('top tier respects capacity and retains explicit user tiers',()=>{
  const result=rankAccounts([
    publisher('a','Kulturlitteratur A'),
    publisher('b','Kulturlitteratur B'),
    publisher('c','Kulturlitteratur C',{existing_tier:'B'})
  ],{limitA:1});
  assert.equal(result.filter(r=>r.tier==='A').length,1);
  assert.equal(result.find(r=>r.id==='c').tier,'B');
  assert.equal(result.find(r=>r.id==='c').tier_origin,'existing');
  assert.equal(result.find(r=>r.tier==='A').culture,3);
});
test('company import tiers do not mutate raw export and do not classify unnamed links',()=>{
  const raw=[
    {collection:'orgs',docId:'keep',data:{name:'Uendret',tier:'B'}},
    {collection:'mtacc',docId:'book',data:{name:'Nytt Bokforlag',segId:'forlag',about:'Utgir litteratur',
      geo:'oslo',enr:event()}},
    {collection:'mtacc',docId:'old-link',data:{createdFrom:'profil'}},
    {collection:'mtacc',docId:'example',data:{name:'Demo Verlag',example:true,segId:'forlag'}}
  ];
  const orig=JSON.stringify(raw);
  const rows={
    organizations:[{id:'keep',name:'Uendret',tier:'B'},
      {id:'book',name:'Nytt Bokforlag',tier:null}],
    prospects:[{organization_id:'book',metadata:{artifact_collection:'mtacc'}}]
  };
  const report=suggestForCompanyPlan(rows,raw);
  assert.equal(report.classified,2);
  assert.equal(report.retained_manual,1);
  assert.equal(report.counts.B,1);
  assert.equal(rows.organizations.find(o=>o.id==='book').tier,'A');
  assert.equal(rows.organizations.find(o=>o.id==='keep').tier,'B');
  assert.equal(rows.prospects[0].metadata.import_priority.tier,'A');
  assert.equal(rows.prospects[0].metadata.import_priority.fit_parts.room,0);
  assert.equal(JSON.stringify(raw),orig);
});
test('without event evidence, no invented documented arrangements or room points',()=>{
  const result=rankAccounts([{
    id:'unknown',name:'Kultur og litteratur',segId:'forlag',geo:'oslo',size:'',enr:{}
  }]);
  assert.equal(result[0].event,'Ukjent');
  assert.equal(result[0].fit_parts.room,0);
  assert.equal(result[0].fit,30);
  assert.equal(result[0].tier,'B');
});
