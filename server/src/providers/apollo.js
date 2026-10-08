'use strict';

const DEFAULT_BASE_URL='https://api.apollo.io/api/v1';

function textMessage(payload,fallback='Apollo request failed.'){
  if(!payload) return fallback;
  if(typeof payload==='string') return payload.slice(0,500);
  return String(
    payload.error||
    payload.error_message||
    payload.message||
    payload.detail||
    fallback
  ).slice(0,500);
}

function errorFromResponse(status,payload){
  const message=textMessage(payload,'Apollo request failed.');
  const lower=message.toLowerCase();
  const error=new Error(message);

  if(status===401) error.code='unauthorized';
  else if(status===403){
    error.code=/plan|upgrade|access|permission|inaccessible/.test(lower)
      ?'plan_restricted'
      :'forbidden';
  }else if(status===429) error.code='rate_limited';
  else if(status>=500) error.code='provider_unavailable';
  else if((status===400||status===402||status===422)&&/plan|upgrade|credit|access|inaccessible/.test(lower)){
    error.code='plan_restricted';
  }else{
    error.code='provider_error';
  }
  error.status=status;
  return error;
}

function normalizeDomain(value){
  return String(value||'')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,'')
    .replace(/^www\./,'')
    .split('/')[0];
}

function mapPeople(list){
  const out=[];
  for(const p of Array.isArray(list)?list:[]){
    if(!p||typeof p!=='object') continue;
    const first=String(p.first_name||'').trim();
    const last=String(p.last_name||p.last_name_obfuscated||'').trim();
    const name=String(p.name||[first,last].filter(Boolean).join(' ')).trim();
    const title=String(p.title||'').trim();
    if(!name||!title) continue;
    const country=String(p.country||'').trim();
    const city=String(p.city||'').trim();
    out.push({
      name,
      title:title.slice(0,100),
      apolloId:String(p.id||''),
      linkedin:String(p.linkedin_url||''),
      loc:country
        ?(/norway|norge/i.test(country)?(/oslo/i.test(city)?'Oslo':'Norge'):'utland:'+country)
        :'',
      masked:/\*/.test(last)||/\*/.test(name),
      email:'',
      orgOk:true,
      cur:true
    });
  }
  return out;
}

function createApolloPort({
  apiKey,
  fetchFn=global.fetch,
  baseUrl=DEFAULT_BASE_URL,
  timeoutMs=15000
}={}){
  const key=String(apiKey||'').trim();
  if(typeof fetchFn!=='function'){
    throw new TypeError('Apollo adapter requires fetch');
  }

  async function request(path,{method='GET',query,body}={}){
    if(!key){
      const error=new Error('APOLLO_API_KEY is not configured.');
      error.code='not_configured';
      throw error;
    }

    const url=new URL(baseUrl.replace(/\/$/,'')+path);
    for(const [name,value] of Object.entries(query||{})){
      if(value==null||value==='') continue;
      if(Array.isArray(value)){
        for(const item of value) url.searchParams.append(name,String(item));
      }else{
        url.searchParams.set(name,String(value));
      }
    }

    let signal;
    try{
      signal=AbortSignal.timeout(Math.max(1000,Number(timeoutMs)||15000));
    }catch(_error){
      signal=undefined;
    }

    let response;
    try{
      response=await fetchFn(url,{
        method,
        headers:{
          accept:'application/json',
          'content-type':'application/json',
          'x-api-key':key
        },
        body:body==null?undefined:JSON.stringify(body),
        signal
      });
    }catch(error){
      const wrapped=new Error(String(error&&error.message||'Apollo network request failed.'));
      wrapped.code=error&&error.name==='TimeoutError'?'timeout':'network_error';
      throw wrapped;
    }

    const raw=await response.text();
    let payload=null;
    if(raw){
      try{ payload=JSON.parse(raw); }
      catch(_error){ payload={message:raw}; }
    }

    if(!response.ok) throw errorFromResponse(response.status,payload);
    return payload||{};
  }

  async function findOrganization({name,domain}={}){
    const normalized=normalizeDomain(domain);
    if(!normalized&&!name) return {matched:false,note:'Mangler domene.'};
    const payload=await request('/organizations/enrich',{
      query:{
        domain:normalized||undefined,
        name:name||undefined
      }
    });
    const org=payload.organization||null;
    if(!org) return {matched:false};
    return {
      matched:true,
      id:String(org.id||''),
      name:String(org.name||''),
      domain:normalizeDomain(org.primary_domain||org.domain||org.website_url||normalized)
    };
  }

  async function searchPeople({domain,orgId,titles,keywords}={}){
    const normalized=normalizeDomain(domain);
    if(!normalized&&!orgId) return {people:[],count:0};

    const body={
      per_page:25,
      page:1
    };
    if(normalized) body.q_organization_domains_list=[normalized];
    if(orgId) body.organization_ids=[String(orgId)];
    if(Array.isArray(titles)&&titles.length) body.person_titles=titles.slice(0,12);
    if(keywords) body.q_keywords=String(keywords);

    const payload=await request('/mixed_people/api_search',{method:'POST',body});
    const raw=payload.people||payload.contacts||[];
    const people=mapPeople(raw);
    return {
      people,
      count:payload.pagination&&Number.isFinite(Number(payload.pagination.total_entries))
        ?Number(payload.pagination.total_entries)
        :people.length
    };
  }

  async function matchPerson({id,name,organizationName,domain}={}){
    const body={
      reveal_personal_emails:false,
      reveal_phone_number:false
    };
    if(id) body.id=String(id);
    else{
      if(name) body.name=String(name);
      if(organizationName) body.organization_name=String(organizationName);
      const normalized=normalizeDomain(domain);
      if(normalized) body.domain=normalized;
    }

    const payload=await request('/people/match',{method:'POST',body});
    const person=payload.person||{};
    return {
      email:String(person.email||''),
      emailStatus:String(person.email_status||''),
      linkedin:String(person.linkedin_url||''),
      id:String(person.id||''),
      credits:payload.credits_consumed??payload.mcp_credits??null
    };
  }

  return {
    findOrganization,
    searchPeople,
    matchPerson
  };
}

module.exports={
  DEFAULT_BASE_URL,
  createApolloPort,
  errorFromResponse,
  normalizeDomain,
  mapPeople
};
