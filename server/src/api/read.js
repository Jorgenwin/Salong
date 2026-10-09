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

const CONTACT_GOAL={count:500,start:'2026-12-01',deadline:'2027-05-31'};
function osloToday(date=new Date()){
  const pieces=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return pieces.year+'-'+pieces.month+'-'+pieces.day;
}
function workdaysInclusive(start,end){
  if(start>end)return 0;
  const a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z');
  if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime()))return 0;
  let count=0;
  for(const d=new Date(a);d<=b;d.setUTCDate(d.getUTCDate()+1)){
    if(d.getUTCDay()>0&&d.getUTCDay()<6)count++;
  }
  return count;
}
function progressFromStoredOutreach(summary,{today=osloToday(),config=CONTACT_GOAL}={}){
  const contacted=Math.max(0,Number(summary.contacted)||0);
  const remaining=Math.max(0,config.count-contacted);
  const from=today>config.start?today:config.start;
  const weekdays=workdaysInclusive(from,config.deadline);
  return {...summary,contacted,goal:config.count,start:config.start,
    deadline:config.deadline,today,remaining,weekdays,
    daily_required:remaining?Math.ceil(remaining/Math.max(weekdays,1)):0,
    deadline_passed:today>config.deadline&&remaining>0};
}

async function handleReadRequest({ req, url, repositories }) {
  if (req.method !== 'GET' || !repositories) return null;

  if(url.pathname==='/api/me'){
    if(!req.salongUser)return {status:401,body:{success:false,error_code:'unauthorized',error_message:'Innlogging mangler.'}};
    const {id,name,role}=req.salongUser;
    return {status:200,body:{id,name,role}};
  }

  if(url.pathname==='/api/outreach/summary'){
    if(!repositories.activities||typeof repositories.activities.outreachSummary!=='function')
      return {status:503,body:{success:false,error_code:'backend_not_ready'}};
    const summary=await repositories.activities.outreachSummary(CONTACT_GOAL);
    return {status:200,body:progressFromStoredOutreach(summary)};
  }

  const activityMatch=url.pathname.match(/^\/api\/accounts\/([^/]+)\/activities$/);
  if(activityMatch){
    const id=decodePathPart(activityMatch[1]);
    if(!id)return {status:400,body:{success:false,error_code:'invalid_id'}};
    if(!await repositories.accounts.get(id))
      return {status:404,body:{success:false,error_code:'account_not_found'}};
    if(!repositories.activities||typeof repositories.activities.listForAccount!=='function')
      return {status:503,body:{success:false,error_code:'backend_not_ready'}};
    return {status:200,body:await repositories.activities.listForAccount(id)};
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

module.exports={handleReadRequest,decodePathPart,nonEmpty,validIsoDate,workdaysInclusive,osloToday,progressFromStoredOutreach};
