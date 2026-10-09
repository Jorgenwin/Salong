'use strict';

const {randomUUID}=require('node:crypto');
const {readJson}=require('./activities-write');

const STAGES=new Set(['ny','dialog','visning','tilbud','holdt','bekreftet','tapt']);

function fail(status,errorCode,errorMessage){
  return {status,body:{success:false,error_code:errorCode,error_message:errorMessage}};
}
function stringField(value,max,{required=false}={}){
  if(value==null){
    if(required)throw Error('Et påkrevd felt mangler.');
    return null;
  }
  if(typeof value!=='string')throw Error('Feltet må være tekst.');
  const clean=value.normalize('NFKC').trim();
  if(clean.length>max)throw Error('Teksten er for lang.');
  if(required&&!clean)throw Error('Tittel er påkrevd.');
  return clean||null;
}
function isoDate(value){
  if(value==null||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw Error('Dato må skrives ÅÅÅÅ-MM-DD.');
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)
    throw Error('Datoen finnes ikke.');
  return value;
}
function parseCreate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Forventet et JSON-objekt.');
  const allowed=new Set(['accountId','title','eventDate','value','room','notes']);
  for(const key of Object.keys(body))if(!allowed.has(key))throw Error('Ukjent felt: '+key);
  const accountId=stringField(body.accountId,160,{required:true});
  const title=stringField(body.title,180,{required:true});
  const eventDate=isoDate(body.eventDate);
  const room=stringField(body.room,180);
  const notes=stringField(body.notes,5000);
  let value=null;
  if(body.value!=null&&body.value!==''){
    if(typeof body.value!=='number'||!Number.isFinite(body.value)||
       body.value<0||body.value>10000000000||
       Math.abs(body.value*100-Math.round(body.value*100))>0.000001)
      throw Error('Verdi må være et ikke-negativt beløp med maks to desimaler.');
    value=body.value;
  }
  return {accountId,title,eventDate,value,room,notes};
}
function parseStage(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Forventet et JSON-objekt.');
  const allowed=new Set(['stage','expectedStage','lostReason']);
  for(const key of Object.keys(body))if(!allowed.has(key))throw Error('Ukjent felt: '+key);
  const stage=body.stage,expectedStage=body.expectedStage;
  if(!STAGES.has(stage)||!STAGES.has(expectedStage))
    throw Error('Fasen og forrige fase må være gyldige.');
  const lostReason=stringField(body.lostReason,500);
  if(stage==='tapt'&&!lostReason)throw Error('Oppgi årsak ved tapt sak.');
  if(stage!=='tapt'&&lostReason)throw Error('Årsak til tapt sak kan bare settes i fasen Tapt.');
  return {stage,expectedStage,lostReason};
}

async function handleOpportunityWriteRequest({
  req,url,repositories,makeId=()=> 'opportunity_'+randomUUID(),
  makeAuditId=()=> 'audit_'+randomUUID()
}={}){
  if(!req||!url||req.method!=='POST')return null;
  const create=url.pathname==='/api/opportunities';
  const match=url.pathname.match(/^\/api\/opportunities\/([^/]+)\/stage$/);
  if(!create&&!match)return null;
  if(!repositories||!repositories.opportunities||
      typeof repositories.opportunities.create!=='function'||
      typeof repositories.opportunities.changeStage!=='function')
    return fail(503,'backend_not_ready','Pipeline-lagring er ikke klar.');
  if(!req.salongUser?.id)return fail(401,'unauthorized','Logg inn før du endrer pipeline.');
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')
    return fail(415,'unsupported_media_type','Bruk JSON.');
  let body;
  try{body=await readJson(req,{maxBytes:16384});}
  catch(error){
    return error.code==='request_too_large'?
      fail(413,'request_too_large','Forespørselen er for stor.'):
      fail(400,'invalid_json','Ugyldig JSON.');
  }
  let parsed;
  try{parsed=create?parseCreate(body):parseStage(body);}
  catch(error){return fail(400,'invalid_opportunity',error.message);}
  if(create){
    const result=await repositories.opportunities.create(parsed,{
      id:makeId(),auditId:makeAuditId(),actorId:req.salongUser.id
    });
    if(result.missingAccount)return fail(404,'account_not_found','Selskapet finnes ikke.');
    if(result.duplicate)return fail(409,'duplicate_opportunity',
      'En salgsmulighet med denne tittelen og datoen finnes allerede.');
    return {status:201,body:{success:true,data:result.opportunity}};
  }
  let id;
  try{id=decodeURIComponent(match[1]);}
  catch(_error){return fail(400,'invalid_id','Ugyldig saks-ID.');}
  if(!id||id.length>180)return fail(400,'invalid_id','Ugyldig saks-ID.');
  const result=await repositories.opportunities.changeStage(id,parsed,{
    auditId:makeAuditId(),actorId:req.salongUser.id
  });
  if(result.missing)return fail(404,'opportunity_not_found','Saken finnes ikke.');
  if(result.conflict)return fail(409,'stage_conflict',
    'Saken er endret av noen andre. Oppdater pipeline og prøv igjen.');
  return {status:200,body:{success:true,data:result.opportunity,unchanged:result.unchanged===true}};
}

module.exports={STAGES,parseCreate,parseStage,handleOpportunityWriteRequest};
