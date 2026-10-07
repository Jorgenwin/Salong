'use strict';

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return null;
  }
}

function nonEmpty(value) {
  return value == null || value === '' ? null : String(value);
}

async function handleReadRequest({ req, url, repositories }) {
  if (req.method !== 'GET' || !repositories) return null;

  let match=url.pathname.match(/^\/api\/accounts\/([^/]+)\/contacts$/);
  if(match){
    const accountId=decodePathPart(match[1]);
    if(!accountId) return {status:400,body:{success:false,error_code:'invalid_id',error_message:'Ugyldig konto-ID.'}};
    const contacts=await repositories.contacts.listByAccount(accountId);
    return {status:200,body:contacts};
  }

  match=url.pathname.match(/^\/api\/accounts\/([^/]+)$/);
  if(match){
    const id=decodePathPart(match[1]);
    if(!id) return {status:400,body:{success:false,error_code:'invalid_id',error_message:'Ugyldig konto-ID.'}};
    const account=await repositories.accounts.get(id);
    if(!account){
      return {status:404,body:{success:false,error_code:'account_not_found',error_message:'Kontoen finnes ikke.'}};
    }
    return {status:200,body:account};
  }

  if(url.pathname==='/api/prospects'){
    const filter={
      segment_id:nonEmpty(url.searchParams.get('segment_id')),
      owner_id:nonEmpty(url.searchParams.get('owner_id')),
      status:nonEmpty(url.searchParams.get('status')),
      batch_id:nonEmpty(url.searchParams.get('batch_id'))
    };
    const prospects=await repositories.accounts.listProspects(
      Object.fromEntries(Object.entries(filter).filter(([,value])=>value!==null))
    );
    return {status:200,body:prospects};
  }

  if(url.pathname==='/api/opportunities'){
    const accountId=nonEmpty(url.searchParams.get('account_id'));
    const opportunities=await repositories.opportunities.list(accountId);
    return {status:200,body:opportunities};
  }

  return null;
}

module.exports={handleReadRequest,decodePathPart,nonEmpty};
