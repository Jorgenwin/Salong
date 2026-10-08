'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createExaPorts,
  exaError,
  mapResult
}=require('../src/providers/exa');

function response(status,payload){
  return {
    ok:status>=200&&status<300,
    status,
    async text(){ return payload==null?'':JSON.stringify(payload); }
  };
}

test('Exa adapter fails closed without API key',async()=>{
  let called=false;
  const port=createExaPorts({
    fetchFn:async()=>{ called=true; return response(200,{}); }
  });
  await assert.rejects(
    ()=>port.search('test'),
    error=>error.code==='not_configured'
  );
  assert.equal(called,false);
});

test('search uses Exa search endpoint and maps highlights to snippet text',async()=>{
  const calls=[];
  const port=createExaPorts({
    apiKey:'exa-secret',
    fetchFn:async(url,options)=>{
      calls.push({url,options});
      return response(200,{results:[{
        url:'https://example.no/team',
        title:'Team',
        highlights:['Kari Testesen – arrangementsansvarlig'],
        publishedDate:'2026-09-01T00:00:00Z'
      }]});
    }
  });

  const result=await port.search('site:example.no arrangement',{numResults:4});

  assert.equal(calls[0].url,'https://api.exa.ai/search');
  assert.equal(calls[0].options.headers['x-api-key'],'exa-secret');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.query,'site:example.no arrangement');
  assert.equal(body.numResults,4);
  assert.deepEqual(body.contents,{highlights:true});
  assert.deepEqual(result,[{
    url:'https://example.no/team',
    title:'Team',
    text:'Kari Testesen – arrangementsansvarlig',
    published:'2026-09-01T00:00:00Z'
  }]);
});

test('fetch retrieves full page text through Exa contents endpoint',async()=>{
  let body=null;
  const port=createExaPorts({
    apiKey:'exa-secret',
    fetchFn:async(url,options)=>{
      assert.equal(url,'https://api.exa.ai/contents');
      body=JSON.parse(options.body);
      return response(200,{results:[{
        url:'https://example.no/team',
        title:'Team',
        text:'Hele siden med Kari Testesen og stilling.'
      }]});
    }
  });

  const pages=await port.fetch([
    'https://example.no/team',
    'https://example.no/team'
  ]);

  assert.deepEqual(body,{urls:['https://example.no/team'],text:true});
  assert.equal(pages.length,1);
  assert.match(pages[0].text,/Hele siden/);
});

test('empty results are honest and never simulated',async()=>{
  const port=createExaPorts({
    apiKey:'exa-secret',
    fetchFn:async()=>response(200,{results:[]})
  });
  assert.deepEqual(await port.search('nothing'),[]);
  assert.deepEqual(await port.fetch([]),[]);
});

test('Exa HTTP failures map to explicit provider states',()=>{
  assert.equal(exaError(401,{message:'bad key'}).code,'unauthorized');
  assert.equal(exaError(403,{message:'forbidden'}).code,'forbidden');
  assert.equal(exaError(429,{message:'slow down'}).code,'rate_limited');
  assert.equal(exaError(503,{message:'down'}).code,'provider_unavailable');
  assert.equal(exaError(400,{message:'bad request'}).code,'provider_error');
});

test('result mapper prefers full text, then highlights, then summary',()=>{
  assert.equal(mapResult({url:'u',text:'full',highlights:['highlight']}).text,'full');
  assert.equal(mapResult({url:'u',highlights:['a','b']}).text,'a\nb');
  assert.equal(mapResult({url:'u',summary:'summary'}).text,'summary');
  assert.equal(mapResult({title:'missing url'}),null);
});
