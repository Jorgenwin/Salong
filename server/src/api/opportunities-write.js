'use strict';

const {randomUUID}=require('node:crypto');
const {readJson}=require('./activities-write');

const STAGES=new Set(['ny','dialog','visning','tilbud','holdt','bekreftet','tapt']);
const CREATE_KEYS=new Set(['accountId','title','room','eventDate','value','notes']);
const UPDATE_KEYS=new Set(['stage','expectedStage','lostReason']);
const fail=(status,error_code,error_message)=>({
  status,body:{success:false,error_code,error_message}
});
function text(value,max,{required=false}={}){
  if(value==null)return required?undefined:null;
  if(typeof value!=='string')return undefined;
  const v=value.normalize('NFKC').trim();
  if(v.length>max||required&&!v)return undefined;
  return v||null;
}
function strictDate(value){
  if(value==null||value==='')return null;
  if(typeof value!=='string'||!(/^\d{4}-\d{2}-\d{2}$/).test(value))return undefined;
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?value:undefined;
}
function validateCreate(body){
  if(!body||Array.isArray(body)||typeof body!=='object')return null;
  if(Object.keys(body).some(k=>!CREATE_KEYS.has(k)))return null;
  const accountId=text(body.accountId,160,{required:true});
  const title=text(body.title,180,{required:true});
  const room=text(body.room,160);
  const notes=text(body.notes,5000);
  const eventDate=strictDate(body.eventDate);
  if(!accountId||!title||room===undefined||notes===undefined||eventDate===undefined)return null;
  const value=body.value===null||body.value===undefined||body.value===''?null:body.value;
  if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||
    value>999999999999.99||Math.abs(Math.round(value*100)-value*100)>0.000001))return null;
  return {accountId,title,room,eventDate,notes,value};
}
function validateStage(body){
  if(!body||Array.isArray(body)||typeof body!=='object')return null;
  if(Object.keys(body).some(k=>!UPDATE_KEYS.has(k)))return null;
  if(!STAGES.has(body.stage)||!STAGES.has(body.expectedStage))return null;
  const lostReason=text(body.lostReason,500);
  if(lostReason===undefined)return null;
  if(body.stage==='tapt'&&!lostReason)return null;
  if(body.stage!=='tapt'&&lostReason)return null;
  return {stage:body.stage,expectedStage:body.expectedStage,lostReason};
}
async function handleOpportunityWrite({req,url,repositories,
  makeId=()=> 'opp_'+randomUUID(),makeAuditId=()=> 'audit_'+randomUUID()}={}){
  if(!req||!url||req.method!=='POST')return null;
  const isCreate=url.pathname==='/api/opportunities';
  const stageMatch=url.pathname.match(/^\/api\/opportunities\/([^/]+)\/stage$/);
  if(!isCreate&&!stageMatch)return null;
  if(!req.salongUser||!req.salongUser.id)
    return fail(401,'unauthorized','Innlogging kreves.');
  if(!repositories||!repositories.opportunities||
    typeof repositories.opportunities.create!=='function'||
    typeof repositories.opportunities.changeStage!=='function')
    return fail(503,'backend_not_ready','Pipeline er ikke klar for lagring.');
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')
    return fail(415,'unsupported_media_type','Bruk application/json.');
  let body;
  try{body=await readJson(req,{maxBytes:16384});}
  catch(error){return error.code==='request_too_large'?
    fail(413,'request_too_large','Forespørselen er for stor.'):
    fail(400,'invalid_json','Ugyldig JSON.');}
  if(isCreate){
    const input=validateCreate(body);
    if(!input)return fail(400,'invalid_opportunity','Ugyldig tittel, selskap, dato eller beløp.');
    const result=await repositories.opportunities.create(input,{
      actorId:req.salongUser.id,id:makeId(),auditId:makeAuditId()
    });
    if(result.accountMissing)return fail(404,'account_not_found','Selskapet finnes ikke.');
    return {status:201,body:{success:true,data:result.opportunity}};
  }
  let id;
  try{id=decodeURIComponent(stageMatch[1]);}
  catch(_error){return fail(400,'invalid_id','Ugyldig saks-ID.');}
  if(!id||id.length>160||id.includes('/'))
    return fail(400,'invalid_id','Ugyldig saks-ID.');
  const input=validateStage(body);
  if(!input)return fail(400,'invalid_stage','Velg gyldig fase og tapsårsak.');
  const result=await repositories.opportunities.changeStage(id,{
    ...input,actorId:req.salongUser.id,auditId:makeAuditId()
  });
  if(result.missing)return fail(404,'opportunity_not_found','Saken finnes ikke.');
  if(result.stale)return fail(409,'stale_stage','Saken har endret fase. Oppdater pipeline.');
  return {status:200,body:{success:true,data:result.opportunity,unchanged:result.unchanged===true}};
}
module.exports={STAGES,validateCreate,validateStage,handleOpportunityWrite};
