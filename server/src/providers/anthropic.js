'use strict';

const DEFAULT_BASE_URL='https://api.anthropic.com';
const DEFAULT_MODEL='claude-sonnet-5';
const ANTHROPIC_VERSION='2023-06-01';

function anthropicError(status,payload){
  const message=String(
    payload&&(
      payload.error&&payload.error.message||
      payload.message||
      payload.error_message
    )||
    'Anthropic request failed.'
  ).slice(0,500);
  const error=new Error(message);
  if(status===401) error.code='unauthorized';
  else if(status===403) error.code='forbidden';
  else if(status===429) error.code='rate_limited';
  else if(status===529||status>=500) error.code='provider_unavailable';
  else error.code='provider_error';
  error.status=status;
  return error;
}

function textFromContent(content){
  return (Array.isArray(content)?content:[])
    .filter(block=>block&&block.type==='text')
    .map(block=>String(block.text||''))
    .join('\n')
    .trim();
}

function createAnthropicPort({
  apiKey,
  model=DEFAULT_MODEL,
  fetchFn=global.fetch,
  baseUrl=DEFAULT_BASE_URL,
  version=ANTHROPIC_VERSION,
  timeoutMs=30000
}={}){
  const key=String(apiKey||'').trim();
  const selectedModel=String(model||'').trim();
  if(typeof fetchFn!=='function') throw new TypeError('Anthropic adapter requires fetch');

  async function complete({system,prompt,maxTokens=1400,tier}={}){
    if(!key){
      const error=new Error('ANTHROPIC_API_KEY is not configured.');
      error.code='not_configured';
      throw error;
    }
    if(!selectedModel){
      const error=new Error('Anthropic model is not configured.');
      error.code='not_configured';
      throw error;
    }

    let signal;
    try{
      signal=AbortSignal.timeout(Math.max(1000,Number(timeoutMs)||30000));
    }catch(_error){
      signal=undefined;
    }

    const body={
      model:selectedModel,
      max_tokens:Math.max(1,Math.min(8192,Number(maxTokens)||1400)),
      messages:[{
        role:'user',
        content:String(prompt||'')
      }]
    };
    if(system) body.system=String(system);

    let response;
    try{
      response=await fetchFn(baseUrl.replace(/\/$/,'')+'/v1/messages',{
        method:'POST',
        headers:{
          accept:'application/json',
          'content-type':'application/json',
          'x-api-key':key,
          'anthropic-version':version
        },
        body:JSON.stringify(body),
        signal
      });
    }catch(error){
      const wrapped=new Error(String(error&&error.message||'Anthropic network request failed.'));
      wrapped.code=error&&error.name==='TimeoutError'?'timeout':'network_error';
      throw wrapped;
    }

    const raw=await response.text();
    let payload={};
    if(raw){
      try{ payload=JSON.parse(raw); }
      catch(_error){ payload={message:raw}; }
    }
    if(!response.ok) throw anthropicError(response.status,payload);

    const text=textFromContent(payload.content);
    if(!text){
      const error=new Error('Anthropic returned no text content.');
      error.code='bad_output';
      throw error;
    }

    return {
      text,
      usage:{
        inputTokens:Number(payload.usage&&payload.usage.input_tokens)||0,
        outputTokens:Number(payload.usage&&payload.usage.output_tokens)||0
      },
      model:String(payload.model||selectedModel),
      tier:tier||null
    };
  }

  return {complete};
}

module.exports={
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  ANTHROPIC_VERSION,
  createAnthropicPort,
  anthropicError,
  textFromContent
};
