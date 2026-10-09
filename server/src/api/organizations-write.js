'use strict';

const {randomUUID}=require('node:crypto');
const {readJson}=require('./contacts-write');

const FIELDS=new Set(['name','org_number','website','segment','priority','previous_customer','notes']);

function fail(status,code,message){
  return {status,body:{success:false,error_code:code,error_message:message}};
}
function validText(value,max,{required=false}={}){
  if(value===null&&!required)return null;
  if(typeof value!=='string')throw Error('Tekstfeltet må være tekst.');
  const clean=value.normalize('NFKC').trim().replace(/[ \t]+/g,' ');
  if(clean.length>max)throw Error('Teksten er for lang (maks '+max+' tegn).');
  if(required&&!clean)throw Error('Organisasjonen må ha et navn.');
  return clean||null;
}
function parseOrgPayload(body,{create=false}={}){
  if(!body||Array.isArray(body)||typeof body!=='object')
    throw Error('Forventet et JSON-objekt.');
  for(const key of Object.keys(body)){
    if(!FIELDS.has(key))throw Error('Ukjent felt: '+key);
  }
  const out={};
  for(const [key,max] of [
    ['name',160],['segment',160],['notes',5000]
  ])if(Object.prototype.hasOwnProperty.call(body,key)){
    out[key]=validText(body[key],max,{required:key==='name'});
  }
  if(Object.prototype.hasOwnProperty.call(body,'priority')){
    if(body.priority!==null&&!['A','B','C'].includes(body.priority))
      throw Error('Prioritet må være A, B, C eller tom.');
    out.priority=body.priority;
  }
  if(Object.prototype.hasOwnProperty.call(body,'previous_customer')){
    if(typeof body.previous_customer!=='boolean')
      throw Error('Tidligere kunde må være ja eller nei.');
    out.previous_customer=body.previous_customer;
  }
  if(Object.prototype.hasOwnProperty.call(body,'org_number')){
    const orgNumber=validText(body.org_number,32);
    if(orgNumber&&!/^[0-9]{9}$/.test(orgNumber))
      throw Error('Organisasjonsnummer må være ni sifre.');
    out.org_number=orgNumber;
  }
  if(Object.prototype.hasOwnProperty.call(body,'website')){
    const website=validText(body.website,1000);
    if(!website){out.website=null;out.domain=null;}
    else{
      let url;
      try{url=new URL(website);}catch(_error){throw Error('Ugyldig nettsideadresse. Bruk https://...');}
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password)
        throw Error('Nettsiden må være en offentlig http/https-adresse uten innlogging.');
      if(!url.hostname.includes('.')||url.hostname.length>250)
        throw Error('Ugyldig nettsted.');
      out.website=url.href;
      out.domain=url.hostname.replace(/^www\./i,'').toLowerCase();
    }
  }
  if(create&&!out.name)throw Error('Organisasjonen må ha et navn.');
  if(!create&&!Object.keys(out).length)throw Error('Ingen felter å lagre.');
  return out;
}

async function handleOrganizationsWrite({req,url,repositories,makeId=()=>`org_${randomUUID()}`,makeAuditId=()=>`audit_${randomUUID()}`}={}){
  if(!req||!url||!['POST','PATCH'].includes(req.method))return null;
  const create=url.pathname==='/api/organizations'&&req.method==='POST';
  const match=url.pathname.match(/^/api/organizations/([^/]+)$/);
  const update=req.method==='PATCH'&&match;
  if(!create&&!update)return null;
  if(!repositories||!repositories.accounts||
      typeof repositories.accounts.createOrganization!=='function'||
      typeof repositories.accounts.updateOrganization!=='function')
    return fail(503,'backend_not_ready','Selskapsredigering er ikke klar.');
  if(!req.salongUser||!req.salongUser.id)
    return fail(401,'unauthorized','Innlogging kreves for å lagre selskaper.');
  if(!/^application/json(?:s*;|$)/i.test(String(req.headers['content-type']||'')))
    return fail(415,'unsupported_media_type','Bruk JSON.');
  let body;
  try{body=await readJson(req,{maxBytes:16384});}
  catch(error){
    return error.code==='request_too_large'?
      fail(413,'request_too_large','Forespørselen er for stor.'):
      fail(400,'invalid_json','Ugyldig JSON.');
  }
  let input;
  try{input=parseOrgPayload(body,{create});}
  catch(error){return fail(400,'invalid_organization',error.message);}
  if(create){
    const result=await repositories.accounts.createOrganization(input,{
      actorId:req.salongUser.id,id:makeId(),auditId:makeAuditId()
    });
    if(result.duplicate)return fail(409,'duplicate_organization',
      'Organisasjonen finnes allerede: '+result.existing.name);
    return {status:201,body:{success:true,data:result.organization}};
  }
  let id;
  try{id=decodeURIComponent(match[1]);}
  catch(_error){return fail(400,'invalid_id','Ugyldig selskaps-ID.');}
  if(!id||id.length>160)return fail(400,'invalid_id','Ugyldig selskaps-ID.');
  const result=await repositories.accounts.updateOrganization(id,input,{
    actorId:req.salongUser.id,auditId:makeAuditId()
  });
  if(result.missing)return fail(404,'organization_not_found','Organisasjonen finnes ikke.');
  if(result.duplicate)return fail(409,'duplicate_organization',
    'Organisasjonen finnes allerede: '+result.existing.name);
  return {status:200,body:{success:true,data:result.organization}};
}

module.exports={handleOrganizationsWrite,parseOrgPayload};
