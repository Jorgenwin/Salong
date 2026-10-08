'use strict';

const DEFAULT_BASE_URL='https://api.exa.ai';

function exaError(status,payload){
  const message=String(
    payload&&(
      payload.error||
      payload.error_message||
      payload.message||
      payload.detail
    )||
    'Exa request failed.'
  ).slice(0,500);
  const error=new Error(message);
  if(status===401) error.code='unauthorized';
  else if(status===403) error.code='forbidden';
  else if(status===429) error.code='rate_limited';
  else if(status>=500) error.code='provider_unavailable';
  else error.code='provider_error';
  error.status=status;
  return error;
}

function mapResult(item){
  if(!item||!item.url) return null;
  const highlights=Array.isArray(item.highlights)?item.highlights.filter(Boolean):[];
  const text=String(item.text||highlights.join('\n')||item.summary||'');
  return {
    url:String(item.url),
    title:String(item.title||''),
    text,
    published:item.publishedDate||item.published||''
  };
}

function createExaPorts({
  apiKey,
  fetchFn=global.fetch,
  baseUrl=DEFAULT_BASE_URL,
  timeoutMs=20000
}={}){
  const key=String(apiKey||'').trim();
  if(typeof fetchFn!=='function') throw new TypeError('Exa adapter requires fetch');

  async function request(path,body){
    if(!key){
      const error=new Error('EXA_API_KEY is not configured.');
      error.code='not_configured';
      throw error;
    }

    let signal;
    try{
      signal=AbortSignal.timeout(Math.max(1000,Number(timeoutMs)||20000));
    }catch(_error){
      signal=undefined;
    }

    let response;
    try{
      response=await fetchFn(baseUrl.replace(/\/$/,'')+path,{
        method:'POST',
        headers:{
          accept:'application/json',
          'content-type':'application/json',
          'x-api-key':key
        },
        body:JSON.stringify(body||{}),
        signal
      });
    }catch(error){
      const wrapped=new Error(String(error&&error.message||'Exa network request failed.'));
      wrapped.code=error&&error.name==='TimeoutError'?'timeout':'network_error';
      throw wrapped;
    }

    const raw=await response.text();
    let payload={};
    if(raw){
      try{ payload=JSON.parse(raw); }
      catch(_error){ payload={message:raw}; }
    }
    if(!response.ok) throw exaError(response.status,payload);
    return payload;
  }

  async function search(query,{numResults=10}={}){
    const q=String(query||'').trim();
    if(!q) return [];
    const limit=Math.min(100,Math.max(1,Number(numResults)||10));
    const payload=await request('/search',{
      query:q,
      numResults:limit,
      type:'auto',
      contents:{highlights:true}
    });
    return (Array.isArray(payload.results)?payload.results:[])
      .map(mapResult)
      .filter(Boolean);
  }

  async function fetchPages(urls){
    const list=[...new Set((Array.isArray(urls)?urls:[])
      .map(v=>String(v||'').trim())
      .filter(Boolean))]
      .slice(0,100);
    if(!list.length) return [];

    const payload=await request('/contents',{
      urls:list,
      text:true
    });
    return (Array.isArray(payload.results)?payload.results:[])
      .map(mapResult)
      .filter(item=>item&&item.text);
  }

  return {
    search,
    fetch:fetchPages
  };
}

module.exports={
  DEFAULT_BASE_URL,
  createExaPorts,
  exaError,
  mapResult
};
