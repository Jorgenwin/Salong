'use strict';

const {randomUUID}=require('node:crypto');

const ACTIVITY_TYPES=new Set(['call','email','meeting','visning','note','task']);

function decodePart(value){
  try{return decodeURIComponent(value);}
  catch(_error){return null;}
}

function failure(status,errorCode,errorMessage){
  return {status,body:{success:false,error_code:errorCode,error_message:errorMessage}};
}

async function readJson(req,{maxBytes=65536}={}){
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

function cleanText(value,{max=1000,nullable=true}={}){
  if(value==null) return nullable?null:'';
  if(typeof value!=='string') return undefined;
  const text=value.trim();
  if(!text) return nullable?null:'';
  return text.slice(0,max);
}

function cleanTimestamp(value){
  if(value==null||value==='') return null;
  if(typeof value!=='string') return undefined;
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
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

function requireRepos(repositories){
  return Boolean(
    repositories&&
    repositories.accounts&&typeof repositories.accounts.get==='function'&&
    repositories.contacts&&typeof repositories.contacts.get==='function'&&
    repositories.opportunities&&typeof repositories.opportunities.get==='function'&&
    repositories.members&&typeof repositories.members.get==='function'&&
    repositories.activities&&
    typeof repositories.activities.get==='function'&&
    typeof repositories.activities.create==='function'&&
    typeof repositories.activities.complete==='function'
  );
}

async function resolveReferences(repositories,{accountId,caseId,contactId,ownerId}){
  let account=null;
  let opportunity=null;
  let contact=null;

  if(caseId){
    opportunity=await repositories.opportunities.get(caseId);
    if(!opportunity) return {error:failure(404,'opportunity_not_found','Saken finnes ikke.')};
    if(accountId&&opportunity.account_id!==accountId){
      return {error:failure(409,'reference_mismatch','Saken tilhører en annen konto.')};
    }
    accountId=accountId||opportunity.account_id;
  }

  if(accountId){
    account=await repositories.accounts.get(accountId);
    if(!account) return {error:failure(404,'account_not_found','Kontoen finnes ikke.')};
  }

  if(contactId){
    contact=await repositories.contacts.get(contactId);
    if(!contact) return {error:failure(404,'contact_not_found','Kontakten finnes ikke.')};
    if(accountId&&contact.account_id!==accountId){
      return {error:failure(409,'reference_mismatch','Kontakten tilhører en annen konto.')};
    }
    accountId=accountId||contact.account_id;
  }

  if(!accountId&&!caseId){
    return {error:failure(400,'invalid_activity','Aktiviteten må være knyttet til en konto eller sak.')};
  }

  if(ownerId){
    const owner=await repositories.members.get(ownerId);
    if(!owner||owner.active===false){
      return {error:failure(404,'owner_not_found','Ansvarlig bruker finnes ikke eller er inaktiv.')};
    }
  }

  return {accountId,opportunity,contact,account};
}

async function handleActivityWriteRequest({
  req,
  url,
  repositories,
  makeActivityId=()=> 'activity_'+randomUUID()
}={}){
  if(!req||!url) return null;
  if(req.method!=='POST') return null;
  const isCreate=url.pathname==='/api/activities';
  const completeMatch=url.pathname.match(/^\/api\/activities\/([^/]+)\/complete$/);
  if(!isCreate&&!completeMatch) return null;

  if(!requireRepos(repositories)){
    return failure(503,'backend_not_ready','Aktivitets-backend er ikke klar.');
  }

  if(isCreate){
    const parsed=await parseBody(req);
    if(!parsed.ok) return parsed.result;
    const body=parsed.body||{};

    const type=cleanText(body.type,{max:40,nullable:false});
    if(!type||!ACTIVITY_TYPES.has(type)){
      return failure(400,'invalid_activity_type','Ugyldig aktivitetstype.');
    }

    const text=cleanText(body.text,{max:1200,nullable:false});
    if(text===undefined){
      return failure(400,'invalid_activity','Aktivitetstekst må være tekst.');
    }
    const fullBody=cleanText(body.body,{max:12000});
    if(fullBody===undefined){
      return failure(400,'invalid_activity','body må være tekst eller null.');
    }

    if(Object.prototype.hasOwnProperty.call(body,'completed')&&typeof body.completed!=='boolean'){
      return failure(400,'invalid_activity','completed må være true eller false.');
    }

    const happenedAt=cleanTimestamp(body.happenedAt);
    const dueAt=cleanTimestamp(body.dueAt);
    if(happenedAt===undefined||dueAt===undefined){
      return failure(400,'invalid_timestamp','Tidspunktet er ugyldig.');
    }

    const accountId=cleanText(body.accountId,{max:200});
    const caseId=cleanText(body.caseId,{max:200});
    const contactId=cleanText(body.contactId,{max:200});
    const ownerId=cleanText(body.ownerId,{max:200});
    if([accountId,caseId,contactId,ownerId].some(value=>value===undefined)){
      return failure(400,'invalid_activity','Referanse-ID må være tekst eller null.');
    }

    const refs=await resolveReferences(repositories,{accountId,caseId,contactId,ownerId});
    if(refs.error) return refs.error;

    const direction=cleanText(body.direction,{max:40});
    const waitReason=cleanText(body.waitReason,{max:500});
    const taskKey=cleanText(body.taskKey,{max:160});
    if([direction,waitReason,taskKey].some(value=>value===undefined)){
      return failure(400,'invalid_activity','Ugyldig tekstfelt.');
    }

    const activity=await repositories.activities.create({
      id:makeActivityId(),
      accountId:refs.accountId,
      caseId,
      contactId,
      type,
      text:text||'',
      body:fullBody,
      happenedAt,
      dueAt,
      completed:Object.prototype.hasOwnProperty.call(body,'completed')
        ?body.completed
        :type!=='task',
      actorId:req.salongUser&&req.salongUser.id||null,
      ownerId,
      direction,
      waitReason,
      taskKey
    });

    return {status:201,body:{success:true,data:activity}};
  }

  const id=decodePart(completeMatch[1]);
  if(!id) return failure(400,'invalid_id','Ugyldig aktivitets-ID.');
  const existing=await repositories.activities.get(id);
  if(!existing) return failure(404,'activity_not_found','Aktiviteten finnes ikke.');
  if(existing.completed){
    return {status:200,body:{success:true,data:existing}};
  }
  const activity=await repositories.activities.complete(id);
  if(!activity) return failure(404,'activity_not_found','Aktiviteten finnes ikke.');
  return {status:200,body:{success:true,data:activity}};
}

module.exports={
  ACTIVITY_TYPES,
  handleActivityWriteRequest,
  readJson,
  cleanText,
  cleanTimestamp,
  resolveReferences
};
