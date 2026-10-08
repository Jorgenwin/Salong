'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');

const {
  createAnthropicPort,
  anthropicError,
  textFromContent,
  DEFAULT_MODEL,
  ANTHROPIC_VERSION
}=require('../src/providers/anthropic');

function response(status,payload){
  return {
    ok:status>=200&&status<300,
    status,
    async text(){ return payload==null?'':JSON.stringify(payload); }
  };
}

test('Anthropic adapter fails closed without API key',async()=>{
  let called=false;
  const port=createAnthropicPort({
    fetchFn:async()=>{ called=true; return response(200,{}); }
  });
  await assert.rejects(
    ()=>port.complete({prompt:'hello'}),
    error=>error.code==='not_configured'
  );
  assert.equal(called,false);
});

test('messages request keeps key server-side and maps text plus usage',async()=>{
  const calls=[];
  const port=createAnthropicPort({
    apiKey:'anthropic-secret',
    model:'claude-test-model',
    fetchFn:async(url,options)=>{
      calls.push({url,options});
      return response(200,{
        model:'claude-test-model',
        content:[
          {type:'text',text:'{"people":[]}'}
        ],
        usage:{input_tokens:123,output_tokens:45}
      });
    }
  });

  const result=await port.complete({
    system:'Return JSON only.',
    prompt:'Extract people.',
    maxTokens:900,
    tier:'quick'
  });

  assert.equal(calls[0].url,'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].options.headers['x-api-key'],'anthropic-secret');
  assert.equal(calls[0].options.headers['anthropic-version'],ANTHROPIC_VERSION);
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.model,'claude-test-model');
  assert.equal(body.max_tokens,900);
  assert.equal(body.system,'Return JSON only.');
  assert.deepEqual(body.messages,[{role:'user',content:'Extract people.'}]);
  assert.deepEqual(result,{
    text:'{"people":[]}',
    usage:{inputTokens:123,outputTokens:45},
    model:'claude-test-model',
    tier:'quick'
  });
});

test('multiple text blocks are joined while non-text blocks are ignored',()=>{
  assert.equal(textFromContent([
    {type:'text',text:'first'},
    {type:'tool_use',name:'ignored'},
    {type:'text',text:'second'}
  ]),'first\nsecond');
});

test('empty text response fails instead of becoming a successful empty extraction',async()=>{
  const port=createAnthropicPort({
    apiKey:'secret',
    fetchFn:async()=>response(200,{content:[],usage:{}})
  });
  await assert.rejects(
    ()=>port.complete({prompt:'x'}),
    error=>error.code==='bad_output'
  );
});

test('Anthropic HTTP failures map to explicit provider states',()=>{
  assert.equal(anthropicError(401,{error:{message:'bad key'}}).code,'unauthorized');
  assert.equal(anthropicError(403,{error:{message:'forbidden'}}).code,'forbidden');
  assert.equal(anthropicError(429,{error:{message:'rate limit'}}).code,'rate_limited');
  assert.equal(anthropicError(529,{error:{message:'overloaded'}}).code,'provider_unavailable');
  assert.equal(anthropicError(400,{error:{message:'bad request'}}).code,'provider_error');
});

test('adapter has an explicit overridable default model',()=>{
  assert.equal(typeof DEFAULT_MODEL,'string');
  assert.ok(DEFAULT_MODEL.length>0);
});
