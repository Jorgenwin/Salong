'use strict';

const ROLES=new Set(['owner','editor','reader']);
const ROLE_LEVEL={reader:1,editor:2,owner:3};

function authError(status,errorCode,errorMessage){
  return {status,body:{success:false,error_code:errorCode,error_message:errorMessage}};
}

function bearerToken(headers={}){
  const raw=headers.authorization||headers.Authorization||'';
  if(typeof raw!=='string') return null;
  const match=raw.match(/^Bearer\s+(.+)$/i);
  const token=match&&match[1]&&match[1].trim();
  return token||null;
}

function hasRole(role,minimumRole='reader'){
  if(!ROLES.has(role)||!ROLES.has(minimumRole)) return false;
  return ROLE_LEVEL[role]>=ROLE_LEVEL[minimumRole];
}

function createAuthBoundary({verifyToken,members}={}){
  if(typeof verifyToken!=='function'){
    throw new TypeError('createAuthBoundary requires verifyToken(token)');
  }
  if(!members||typeof members.getByAuthSubject!=='function'){
    throw new TypeError('createAuthBoundary requires members.getByAuthSubject(subject)');
  }

  async function authenticateRequest(req){
    const token=bearerToken(req&&req.headers||{});
    if(!token){
      return authError(401,'unauthorized','Innlogging mangler eller er ugyldig.');
    }

    let identity;
    try{
      identity=await verifyToken(token);
    }catch(_error){
      return authError(401,'unauthorized','Innlogging mangler eller er ugyldig.');
    }

    const subject=identity&&String(identity.sub||identity.subject||'').trim();
    if(!subject){
      return authError(401,'unauthorized','Innlogging mangler eller er ugyldig.');
    }

    const member=await members.getByAuthSubject(subject);
    if(!member||member.active===false||!ROLES.has(member.role)){
      return authError(403,'forbidden','Brukeren har ikke tilgang til Salong.');
    }

    return {ok:true,user:member,identity};
  }

  async function authorizeRequest(req,{minimumRole='reader'}={}){
    const auth=await authenticateRequest(req);
    if(!auth.ok) return auth;
    if(!hasRole(auth.user.role,minimumRole)){
      return authError(403,'forbidden','Du har ikke tilgang til denne handlingen.');
    }
    return auth;
  }

  return {authenticateRequest,authorizeRequest};
}

module.exports={
  ROLES,
  ROLE_LEVEL,
  bearerToken,
  hasRole,
  createAuthBoundary
};
