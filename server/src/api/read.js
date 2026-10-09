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

function validIsoDate(value) {
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year,month,day]=text.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year &&
    date.getUTCMonth()===month-1 &&
    date.getUTCDate()===day;
}

async function handleReadRequest({ req, url, repositories }) {
  if (req.method !== 'GET' || !repositories) return null;

  if(url.pathname==='/api/me'){
    if(!req.salongUser)return {status:401,body:{success:false,error_code:'unauthorized',error_message:'Innlogging mangler.'}};
    const {id,name,role}=req.salongUser;
    return {status:200,body:{id,name,role}};
  }

  if(url.pathname==='/api/organizations'){
    const organizations=await repositories.accounts.listOrganizations();
    return {status:200,body:organizations};
  }

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

  if(url.pathname==='/api/calendar'){
    const from=nonEmpty(url.searchParams.get('from'));
    const to=nonEmpty(url.searchParams.get('to'))||from;
    if(!validIsoDate(from)||!validIsoDate(to)||to<from){
      return {
        status:400,
        body:{
          success:false,
          error_code:'invalid_date_range',
          error_message:'Kalender krever gyldig fra- og til-dato.'
        }
      };
    }
    const items=await repositories.calendar.list({from,to});
    return {status:200,body:items};
  }

  return null;
}

module.exports={handleReadRequest,decodePathPart,nonEmpty,validIsoDate};
