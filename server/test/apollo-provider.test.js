'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createApolloPort,
  errorFromResponse,
  normalizeDomain,
  mapPeople
}=require('../src/providers/apollo');

function response(status,payload){
  return {
    ok:status>=200&&status<300,
    status,
    async text(){ return payload==null?'':JSON.stringify(payload); }
  };
}

test('domain normalization is safe and predictable',()=>{
  assert.equal(normalizeDomain('https://www.Example.no/path'),'example.no');
  assert.equal(normalizeDomain('WWW.Example.no'),'example.no');
  assert.equal(normalizeDomain(''), '');
});

test('Apollo adapter fails closed when key is missing',async()=>{
  let called=false;
  const port=createApolloPort({
    fetchFn:async()=>{ called=true; return response(200,{}); }
  });

  await assert.rejects(
    ()=>port.findOrganization({domain:'example.no'}),
    error=>error.code==='not_configured'
  );
  assert.equal(called,false);
});

test('organization enrichment sends key server-side and maps organization',async()=>{
  const calls=[];
  const port=createApolloPort({
    apiKey:'secret-key',
    fetchFn:async(url,options)=>{
      calls.push({url:String(url),options});
      return response(200,{organization:{
        id:'org-1',
        name:'Eksempel AS',
        primary_domain:'example.no'
      }});
    }
  });

  const result=await port.findOrganization({
    name:'Eksempel AS',
    domain:'https://www.example.no'
  });

  assert.deepEqual(result,{
    matched:true,
    id:'org-1',
    name:'Eksempel AS',
    domain:'example.no'
  });
  assert.match(calls[0].url,/\/organizations\/enrich\?/);
  assert.match(calls[0].url,/domain=example\.no/);
  assert.equal(calls[0].options.headers['x-api-key'],'secret-key');
});

test('people search maps neutral contact candidates and never returns email',async()=>{
  let body=null;
  const port=createApolloPort({
    apiKey:'secret-key',
    fetchFn:async(_url,options)=>{
      body=JSON.parse(options.body);
      return response(200,{
        people:[{
          id:'p-1',
          first_name:'Kari',
          last_name_obfuscated:'N******n',
          title:'Head of Events',
          linkedin_url:'https://linkedin.test/kari',
          city:'Oslo',
          country:'Norway',
          email:'should-not-leak@example.no'
        }],
        pagination:{total_entries:1}
      });
    }
  });

  const result=await port.searchPeople({
    domain:'example.no',
    orgId:'org-1',
    titles:['Head of Events'],
    keywords:'events'
  });

  assert.deepEqual(body.q_organization_domains_list,['example.no']);
  assert.deepEqual(body.organization_ids,['org-1']);
  assert.deepEqual(body.person_titles,['Head of Events']);
  assert.equal(body.q_keywords,'events');
  assert.equal(result.count,1);
  assert.equal(result.people[0].name,'Kari N******n');
  assert.equal(result.people[0].masked,true);
  assert.equal(result.people[0].loc,'Oslo');
  assert.equal(result.people[0].email,'');
});

test('person match stays explicit and disables personal email/phone reveal flags',async()=>{
  let body=null;
  const port=createApolloPort({
    apiKey:'secret-key',
    fetchFn:async(_url,options)=>{
      body=JSON.parse(options.body);
      return response(200,{person:{
        id:'p-1',
        email:'kari@example.no',
        email_status:'verified',
        linkedin_url:'https://linkedin.test/kari'
      }});
    }
  });

  const result=await port.matchPerson({id:'p-1'});

  assert.equal(body.id,'p-1');
  assert.equal(body.reveal_personal_emails,false);
  assert.equal(body.reveal_phone_number,false);
  assert.equal(result.email,'kari@example.no');
  assert.equal(result.emailStatus,'verified');
});

test('Apollo HTTP errors are classified explicitly',()=>{
  assert.equal(errorFromResponse(401,{message:'bad key'}).code,'unauthorized');
  assert.equal(errorFromResponse(403,{message:'Upgrade your plan'}).code,'plan_restricted');
  assert.equal(errorFromResponse(429,{message:'slow down'}).code,'rate_limited');
  assert.equal(errorFromResponse(503,{message:'down'}).code,'provider_unavailable');
  assert.equal(errorFromResponse(422,{message:'invalid field'}).code,'provider_error');
});

test('people mapper drops incomplete records',()=>{
  assert.deepEqual(mapPeople([{name:'Only Name'}]),[]);
  assert.equal(mapPeople([{name:'Ola Test',title:'Markedssjef'}]).length,1);
});
