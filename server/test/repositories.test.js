'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createRepositories,
  mapAccount,
  mapContact,
  mapOpportunity,
  buildProspectWhere
}=require('../src/db/repositories');

test('account mapper exposes the Salong account contract instead of raw rows',()=>{
  const account=mapAccount({
    id:'o-1',
    name:'Eksempel AS',
    org_number:'123',
    domain:'example.no',
    website:'https://example.no',
    segment:'Forlag',
    owner_id:'m-1',
    relationship:'prospekt',
    prospect_kind:'target',
    prospect_status:'qualified',
    prospect_stage:'research',
    fit_score:'81.5',
    batch_id:'b-1',
    deleted_at:null
  });

  assert.deepEqual(account,{
    id:'o-1',
    name:'Eksempel AS',
    org_number:'123',
    domain:'example.no',
    website:'https://example.no',
    segment_id:'Forlag',
    owner_id:'m-1',
    relation:'prospekt',
    kind:'target',
    status:'qualified',
    stage:'research',
    fit_score:81.5,
    batch_id:'b-1',
    data_status:'active'
  });
  assert.equal('deleted_at' in account,false);
});

test('contact mapper keeps unknown enrichment values null',()=>{
  const contact=mapContact({
    id:'p-1',
    organization_id:'o-1',
    name:'',
    title:null,
    email:null,
    email_status:null,
    phone:null,
    phone_status:null,
    linkedin_url:null,
    role_match:null,
    relevant:null,
    active:true,
    do_not_contact:false,
    verified_at:new Date('2026-10-07T09:30:00.000Z'),
    last_enriched_at:null
  });

  assert.equal(contact.name,'');
  assert.equal(contact.email,null);
  assert.equal(contact.relevant,null);
  assert.equal(contact.verified,true);
  assert.equal(contact.last_enriched_at,'2026-10-07T09:30:00.000Z');
});

test('opportunity mapper follows the current frontend service shape',()=>{
  const opportunity=mapOpportunity({
    id:'d-1',
    organization_id:'o-1',
    title:'Fagdag',
    stage:'dialog',
    value_amount:'25000.00',
    room:'solstad',
    event_date:new Date('2027-03-10T00:00:00.000Z'),
    attendees:200,
    owner_id:null,
    stage_at:new Date('2026-10-07T10:00:00.000Z'),
    lost_reason:null
  });

  assert.equal(opportunity.account_id,'o-1');
  assert.equal(opportunity.value,25000);
  assert.equal(opportunity.attendees,200);
  assert.equal(opportunity.event_date,'2027-03-10');
  assert.equal(opportunity.stage_changed_at,'2026-10-07T10:00:00.000Z');
});

test('prospect filter is parameterized and never interpolates user values into SQL',()=>{
  const filter=buildProspectWhere({
    segment_id:"Forlag' OR 1=1 --",
    owner_id:'m-1',
    status:'qualified',
    batch_id:'b-1'
  });

  assert.deepEqual(filter.params,[
    "Forlag' OR 1=1 --",
    'm-1',
    'qualified',
    'b-1'
  ]);
  assert.match(filter.where,/o\.segment = \$1/);
  assert.match(filter.where,/batch_id = \$4/);
  assert.equal(filter.where.includes("OR 1=1"),false);
});

test('repositories use parameterized account/contact queries and return mapped rows',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text,params});
      if(/FROM contacts/.test(text)){
        return {rows:[{
          id:'p-1',
          organization_id:'o-1',
          name:'Pia Testesen',
          active:true,
          do_not_contact:false
        }]};
      }
      return {rows:[{
        id:'o-1',
        name:'Eksempel AS',
        segment:'Forlag',
        fit_score:'90',
        deleted_at:null
      }]};
    }
  };

  const repositories=createRepositories(db);
  const account=await repositories.accounts.get('o-1');
  const contacts=await repositories.contacts.listByAccount('o-1');

  assert.equal(account.id,'o-1');
  assert.equal(account.fit_score,90);
  assert.equal(contacts[0].name,'Pia Testesen');
  assert.deepEqual(calls[0].params,['o-1']);
  assert.deepEqual(calls[1].params,['o-1']);
});

test('createRepositories requires an injected database boundary',()=>{
  assert.throws(()=>createRepositories(null),/requires an object with query/);
});

test('calendar repository combines opportunities, bookings and actionable activities',async()=>{
  const calls=[];
  const db={
    async query(text,params){
      calls.push({text:String(text),params});
      if(/FROM opportunities d/.test(text)){
        return {rows:[{
          id:'d-1',
          title:'Årskonferanse',
          stage:'bekreftet',
          event_date:new Date('2027-10-14T00:00:00.000Z'),
          organization_name:'Recovery Norge',
          room:'solstad',
          owner_id:'m-1'
        }]};
      }
      if(/FROM bookings b/.test(text)){
        return {rows:[{
          id:'b-1',
          organization_id:'o-2',
          organization_name:'Eksempel AS',
          title:'Frokostmøte',
          status:'bekreftet',
          room:'collett',
          starts_at:new Date('2027-10-15T08:30:00.000Z')
        }]};
      }
      if(/FROM activities a/.test(text)){
        return {rows:[{
          id:'a-1',
          organization_id:'o-3',
          opportunity_id:'d-3',
          organization_name:'Forlaget',
          opportunity_room:'hagerup',
          opportunity_owner_id:'m-2',
          type:'meeting',
          text:'Møte om vårprogrammet',
          happened_at:new Date('2027-10-16T11:00:00.000Z'),
          due_at:null,
          owner_id:null
        }]};
      }
      return {rows:[]};
    }
  };

  const repositories=createRepositories(db);
  const items=await repositories.calendar.list({
    from:'2027-10-01',
    to:'2027-10-31'
  });

  assert.deepEqual(items.map(item=>[item.date,item.kind,item.open]),[
    ['2027-10-14','event','deal:d-1'],
    ['2027-10-15','event','org:o-2'],
    ['2027-10-16','meet','deal:d-3']
  ]);
  assert.equal(items[1].time,'08:30');
  assert.equal(items[2].owner,'m-2');
  assert.equal(calls.length,3);
  for(const call of calls){
    assert.deepEqual(call.params,['2027-10-01','2027-10-31']);
  }
});
