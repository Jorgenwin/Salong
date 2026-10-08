'use strict';

const {randomUUID}=require('node:crypto');

function decodePart(value){
  try{return decodeURIComponent(value);}
  catch(_error){return null;}
}

function failure(status,errorCode,errorMessage){
  return {
    status,
    body:{success:false,error_code:errorCode,error_message:errorMessage}
  };
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

function cleanText(value,{max=500,nullable=true}={}){
  if(value==null) return nullable?null:'';
  const text=String(value).trim();
  if(!text) return nullable?null:'';
  return text.slice(0,max);
}

function booleanField(value,{nullable=false}={}){
  if(value==null&&nullable) return null;
  if(typeof value!=='boolean') return undefined;
  return value;
}

function mapPatch(body){
  const out={};
  const fields=[
    ['name','name',160,false],
    ['title','title',180,true],
    ['email','email',320,true],
    ['emailStatus','email_status',80,true],
    ['phone','phone',80,true],
    ['phoneStatus','phone_status',80,true],
    ['linkedinUrl','linkedin_url',1000,true],
    ['roleMatch','role_match',160,true]
  ];
  for(const [input,output,max,nullable] of fields){
    if(!Object.prototype.hasOwnProperty.call(body,input)) continue;
    out[output]=cleanText(body[input],{max,nullable});
  }
  if(Object.prototype.hasOwnProperty.call(body,'relevant')){
    const value=booleanField(body.relevant,{nullable:true});
    if(value!==undefined) out.relevant=value;
  }
  if(Object.prototype.hasOwnProperty.call(body,'active')){
    const value=booleanField(body.active);
    if(value!==undefined) out.active=value;
  }
  return out;
}

function requireRepos(repositories){
  return Boolean(
    repositories&&
    repositories.accounts&&typeof repositories.accounts.get==='function'&&
    repositories.contacts&&
    typeof repositories.contacts.get==='function'&&
    typeof repositories.contacts.add==='function'&&
    typeof repositories.contacts.update==='function'&&
    typeof repositories.contacts.setPrimary==='function'&&
    typeof repositories.contacts.setDoNotContact==='function'
  );
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

async function handleContactWriteRequest({
  req,
  url,
  repositories,
  makeContactId=()=> 'contact_'+randomUUID()
}={}){
  if(!url||!req) return null;
  if(!['POST','PATCH'].includes(req.method)) return null;
  const isContactPath=url.pathname.startsWith('/api/contacts/');
  const isAccountContacts=/^\/api\/accounts\/[^/]+\/contacts$/.test(url.pathname);
  if(!isContactPath&&!isAccountContacts) return null;
  if(!requireRepos(repositories)){
    return failure(503,'backend_not_ready','Kontakt-backend er ikke klar.');
  }

  let match=url.pathname.match(/^\/api\/accounts\/([^/]+)\/contacts$/);
  if(match&&req.method==='POST'){
    const accountId=decodePart(match[1]);
    if(!accountId) return failure(400,'invalid_id','Ugyldig konto-ID.');
    if(!await repositories.accounts.get(accountId)){
      return failure(404,'account_not_found','Kontoen finnes ikke.');
    }

    const parsed=await parseBody(req);
    if(!parsed.ok) return parsed.result;
    const body=parsed.body||{};
    const name=cleanText(body.name,{max:160,nullable:false});
    if(!name) return failure(400,'invalid_contact','Kontakt krever navn.');

    if(Object.prototype.hasOwnProperty.call(body,'active')&&typeof body.active!=='boolean'){
      return failure(400,'invalid_contact','active må være true eller false.');
    }
    if(Object.prototype.hasOwnProperty.call(body,'relevant')&&body.relevant!=null&&typeof body.relevant!=='boolean'){
      return failure(400,'invalid_contact','relevant må være true, false eller null.');
    }

    const contact=await repositories.contacts.add({
      id:makeContactId(),
      accountId,
      name,
      title:cleanText(body.title,{max:180}),
      email:cleanText(body.email,{max:320}),
      emailStatus:cleanText(body.emailStatus,{max:80}),
      phone:cleanText(body.phone,{max:80}),
      phoneStatus:cleanText(body.phoneStatus,{max:80}),
      linkedinUrl:cleanText(body.linkedinUrl,{max:1000}),
      roleMatch:cleanText(body.roleMatch,{max:160}),
      relevant:body.relevant==null?null:body.relevant,
      active:body.active!==false,
      sourceState:'manual',
      verifiedAt:null
    });
    return {status:201,body:{success:true,data:contact}};
  }

  match=url.pathname.match(/^\/api\/contacts\/([^/]+)$/);
  if(match&&req.method==='PATCH'){
    const id=decodePart(match[1]);
    if(!id) return failure(400,'invalid_id','Ugyldig kontakt-ID.');
    if(!await repositories.contacts.get(id)){
      return failure(404,'contact_not_found','Kontakten finnes ikke.');
    }

    const parsed=await parseBody(req);
    if(!parsed.ok) return parsed.result;
    const body=parsed.body||{};
    if(Object.prototype.hasOwnProperty.call(body,'active')&&typeof body.active!=='boolean'){
      return failure(400,'invalid_contact','active må være true eller false.');
    }
    if(Object.prototype.hasOwnProperty.call(body,'relevant')&&body.relevant!=null&&typeof body.relevant!=='boolean'){
      return failure(400,'invalid_contact','relevant må være true, false eller null.');
    }

    const patch=mapPatch(body);
    if(!Object.keys(patch).length){
      return failure(400,'nothing_to_update','Ingen støttede felt å oppdatere.');
    }
    if(Object.prototype.hasOwnProperty.call(patch,'name')&&!patch.name){
      return failure(400,'invalid_contact','Kontakt krever navn.');
    }

    const contact=await repositories.contacts.update(id,patch);
    return {status:200,body:{success:true,data:contact}};
  }

  match=url.pathname.match(/^\/api\/contacts\/([^/]+)\/primary$/);
  if(match&&req.method==='POST'){
    const id=decodePart(match[1]);
    if(!id) return failure(400,'invalid_id','Ugyldig kontakt-ID.');
    const existing=await repositories.contacts.get(id);
    if(!existing) return failure(404,'contact_not_found','Kontakten finnes ikke.');
    if(existing.do_not_contact){
      return failure(409,'do_not_contact','Kontakten er markert som ikke kontakt.');
    }
    const contact=await repositories.contacts.setPrimary(id);
    return {status:200,body:{success:true,data:contact}};
  }

  match=url.pathname.match(/^\/api\/contacts\/([^/]+)\/do-not-contact$/);
  if(match&&req.method==='POST'){
    const id=decodePart(match[1]);
    if(!id) return failure(400,'invalid_id','Ugyldig kontakt-ID.');
    if(!await repositories.contacts.get(id)){
      return failure(404,'contact_not_found','Kontakten finnes ikke.');
    }
    const parsed=await parseBody(req);
    if(!parsed.ok) return parsed.result;
    const body=parsed.body||{};
    if(Object.prototype.hasOwnProperty.call(body,'value')&&typeof body.value!=='boolean'){
      return failure(400,'invalid_contact','value må være true eller false.');
    }
    const value=body.value!==false;
    const reason=value?cleanText(body.reason,{max:500}):null;
    if(value&&!reason){
      return failure(400,'reason_required','Årsak er påkrevd for ikke kontakt.');
    }
    const contact=await repositories.contacts.setDoNotContact(id,{value,reason});
    return {status:200,body:{success:true,data:contact}};
  }

  return null;
}

module.exports={
  handleContactWriteRequest,
  readJson,
  cleanText,
  mapPatch,
  requireRepos
};
