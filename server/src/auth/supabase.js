'use strict';

// Verify the access token with Supabase Auth itself. This supports both
// asymmetric signing keys and legacy HS256 without importing any JWT secrets.
// A successful token does NOT grant a Salong role: members.auth_subject does.
function createSupabaseVerifier({url,publishableKey,fetchFn=global.fetch,timeoutMs=8000}={}){
  const base=String(url||'').trim().replace(/\/+$/,'');
  const key=String(publishableKey||'').trim();
  let parsed;
  try{ parsed=new URL(base); }catch(_){ throw new TypeError('Valid SUPABASE_URL is required'); }
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password||
     parsed.pathname!=='/'||parsed.search||parsed.hash){
    throw new TypeError('SUPABASE_URL must be an https project origin');
  }
  if(!key) throw new TypeError('SUPABASE_PUBLISHABLE_KEY is required');
  if(typeof fetchFn!=='function') throw new TypeError('fetchFn is required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000){
    throw new TypeError('timeoutMs must be 1..30000');
  }
  const userEndpoint=parsed.origin+'/auth/v1/user';

  return async function verifyToken(token){
    const jwt=String(token||'').trim();
    if(!jwt||jwt.length>16384) throw new Error('Invalid access token');
    const response=await fetchFn(userEndpoint,{
      method:'GET',
      headers:{
        apikey:key,
        authorization:'Bearer '+jwt,
        accept:'application/json'
      },
      signal:AbortSignal.timeout(timeoutMs)
    });
    if(!response||!response.ok) throw new Error('Supabase access token rejected');
    const user=await response.json();
    if(!user||typeof user.id!=='string'||!user.id.trim()||user.is_anonymous===true){
      throw new Error('Supabase identity is invalid');
    }
    return {sub:user.id};
  };
}

module.exports={createSupabaseVerifier};
