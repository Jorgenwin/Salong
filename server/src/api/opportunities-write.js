'use strict';

const OPPORTUNITY_STAGES=new Set(['ny','dialog','visning','tilbud','holdt','bekreftet','tapt']);

function decodePart(value){
  try{return decodeURIComponent(value);}
  catch(_error){return null;}
}

function failure(status,errorCode,errorMessage){
  return {status,body:{success:false,error_code:errorCode,error_message:errorMessage}};
}

async function readJson(req,{maxBytes=32768}={}){
  let total=0;
  const chunks=[];
  for await(const rawChunk of req){
    const chunk=Buffer.isBuffer(rawChunk)?rawChunk:Buffer.from(rawChunk);
    total+=chunk.length;
    if(total>maxBytes){
      const error=new Error('request_too_large');
      error.code='request_too_large';
      throw error;
    }
    chunks.push(chunk);
  }
  if(!chunks.length) return {};
  const text=Buffer.concat(chunks).toString('utf8').trim();
  if(!text) return {};
  try{return JSON.parse(text);}
  catch(_error){
    const error=new Error('invalid_json');
    error.code='invalid_json';
    throw error;
  }
}

async function parseBody(req){
  try{return {ok:true,body:await readJson(req)};}
  catch(error){
    if(error.code==='request_too_large'){
      return {ok:false,result:failure(413,'request_too_large','Forespørselen er for stor.')};
    }
    return {ok:false,result:failure(400,'invalid_json','Forespørselen inneholder ugyldig JSON.')};
  }
}

function cleanText(value,{max=500,nullable=true}={}){
  if(value==null) return nullable?null:'';
  if(typeof value!=='string') return undefined;
  const text=value.trim();
  if(!text) return nullable?null:'';
  return text.slice(0,max);
}

async function handleOpportunityWriteRequest({req,url,repositories}={}){
  if(!req||!url||req.method!=='POST') return null;
  const match=url.pathname.match(/^\/api\/opportunities\/([^/]+)\/stage$/);
  if(!match) return null;
  if(!repositories||!repositories.opportunities||
     typeof repositories.opportunities.get!=='function'||
     typeof repositories.opportunities.setStage!=='function'){
    return failure(503,'backend_not_ready','Saks-backend er ikke klar.');
  }

  const id=decodePart(match[1]);
  if(!id) return failure(400,'invalid_id','Ugyldig saks-ID.');

  const existing=await repositories.opportunities.get(id);
  if(!existing) return failure(404,'opportunity_not_found','Saken finnes ikke.');

  const parsed=await parseBody(req);
  if(!parsed.ok) return parsed.result;
  const body=parsed.body||{};

  const stage=cleanText(body.stage,{max:40,nullable:false});
  if(!stage||!OPPORTUNITY_STAGES.has(stage)){
    return failure(400,'invalid_stage','Ugyldig fase.');
  }

  const expectedStage=cleanText(body.expectedStage,{max:40});
  if(expectedStage===undefined||(expectedStage&&!OPPORTUNITY_STAGES.has(expectedStage))){
    return failure(400,'invalid_stage','Ugyldig forventet fase.');
  }

  const lostReason=cleanText(body.lostReason,{max:500});
  if(lostReason===undefined){
    return failure(400,'invalid_lost_reason','Tapsårsak må være tekst eller null.');
  }

  if(existing.stage===stage&&(!expectedStage||expectedStage===existing.stage)){
    if(stage!=='tapt'||lostReason==null||lostReason===existing.lost_reason){
      return {status:200,body:{success:true,data:existing}};
    }
  }

  const updated=await repositories.opportunities.setStage(id,{
    stage,
    expectedStage,
    lostReason
  });

  if(!updated&&expectedStage){
    return failure(409,'stale_stage','Saken har skiftet fase siden den ble åpnet. Last inn på nytt.');
  }
  if(!updated){
    return failure(404,'opportunity_not_found','Saken finnes ikke.');
  }

  return {status:200,body:{success:true,data:updated}};
}

module.exports={
  OPPORTUNITY_STAGES,
  handleOpportunityWriteRequest,
  readJson
};
