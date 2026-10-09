'use strict';

const { randomUUID,createHash } = require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {HTML:CRM_HTML,JS:CRM_JS}=require('./ui/crm-page');
const { handleReadRequest } = require('./api/read');
const { handleEnrichmentRequest } = require('./api/enrichment');
const { handleContactWriteRequest } = require('./api/contacts-write');
const { handleActivityWriteRequest } = require('./api/activities-write');
const { handleOrganizationsWrite } = require('./api/organizations-write');

function prepareCrmWorkspace(source){
  const marker='<script>\n';
  if(typeof source!=='string'||!source.includes(marker))return null;
  const html=source.replace(marker,marker+'window.SALONG_CRM_READONLY=true;\n');
  const scriptHashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match=>"'sha256-"+createHash('sha256').update(match[1]).digest('base64')+"'");
  if(!scriptHashes.length)return null;
  const csp="default-src 'none'; script-src "+scriptHashes.join(' ')+
    "; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
  return {html,csp};
}

function writeJson(res, statusCode, body, requestId) {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(payload));
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-request-id', requestId);
  res.end(payload);
}

function createApp({ config, repositories = null, authBoundary = null, now = () => new Date(), makeRequestId = randomUUID } = {}) {
  if (!config) throw new Error('createApp requires config');

  return async function handleRequest(req, res) {
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim().slice(0, 128)
      : makeRequestId();

    try {
      const url = new URL(req.url || '/', 'http://salong.local');

      // Served only by Salong API. A public static document contains no CRM
      // records or credentials. The authenticated parent sends data in memory.
      if(req.method==='GET'&&url.pathname==='/crm/workspace'){
        if(!config.supabaseUrl||!config.supabasePublishableKey){
          writeJson(res,503,{success:false,error_code:'crm_auth_not_configured'},requestId);
          return;
        }
        let page;
        try{page=fs.readFileSync(path.join(__dirname,'../public/salong.html'),'utf8');}
        catch(error){
          if(error.code==='ENOENT'){
            writeJson(res,503,{success:false,error_code:'workspace_not_built'},requestId);
            return;
          }
          throw error;
        }
        const prepared=prepareCrmWorkspace(page);
        if(!prepared){
          writeJson(res,503,{success:false,error_code:'workspace_build_invalid'},requestId);
          return;
        }
        res.statusCode=200;
        res.setHeader('content-type','text/html; charset=utf-8');
        res.setHeader('cache-control','no-store');
        res.setHeader('x-content-type-options','nosniff');
        res.setHeader('referrer-policy','no-referrer');
        res.setHeader('content-security-policy',prepared.csp);
        res.end(prepared.html);
        return;
      }

      // A separate private CRM interface; not the public static demo.
      // Public auth configuration contains only a Supabase publishable key.
      if(req.method==='GET' && ['/crm','/crm/','/crm/client.js','/crm/config.js'].includes(url.pathname)){
        if(!config.supabaseUrl||!config.supabasePublishableKey){
          writeJson(res,503,{success:false,error_code:'crm_auth_not_configured'},requestId);
          return;
        }
        const origin=new URL(config.supabaseUrl).origin;
        let data,contentType;
        if(url.pathname==='/crm/client.js'){
          data=CRM_JS;contentType='application/javascript; charset=utf-8';
        }else if(url.pathname==='/crm/config.js'){
          data='window.SALONG_PUBLIC_CONFIG='+JSON.stringify({
            supabaseUrl:config.supabaseUrl,publishableKey:config.supabasePublishableKey
          }).replace(/</g,'\\u003c')+';';
          contentType='application/javascript; charset=utf-8';
        }else{
          data=CRM_HTML;contentType='text/html; charset=utf-8';
        }
        res.statusCode=200;
        res.setHeader('content-type',contentType);
        res.setHeader('cache-control','no-store');
        res.setHeader('x-content-type-options','nosniff');
        res.setHeader('referrer-policy','no-referrer');
        res.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self' "+origin+"; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        res.end(data);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        writeJson(res, 200, {
          status: 'ok',
          service: 'salong-api',
          environment: config.nodeEnv,
          time: now().toISOString(),
          requestId
        }, requestId);
        return;
      }

      if (!authBoundary && (config.nodeEnv === 'production' || Boolean(config.databaseUrl)) && url.pathname.startsWith('/api/')) {
        writeJson(res, 503, {
          success: false,
          error_code: 'auth_not_ready',
          error_message: 'Autentisering er ikke aktivert.',
          requestId
        }, requestId);
        return;
      }

      if (authBoundary && url.pathname.startsWith('/api/')) {
        const minimumRole = req.method === 'GET' ? 'reader' : 'editor';
        const auth = await authBoundary.authorizeRequest(req, { minimumRole });
        if (!auth.ok) {
          writeJson(res, auth.status, { ...auth.body, requestId }, requestId);
          return;
        }
        req.salongUser = auth.user;
      }

      const orgWriteResult=await handleOrganizationsWrite({req,url,repositories});
      if(orgWriteResult){
        const body=orgWriteResult.body&&orgWriteResult.body.success===false
          ? {...orgWriteResult.body,requestId}:orgWriteResult.body;
        writeJson(res,orgWriteResult.status,body,requestId);
        return;
      }

      const activityWriteResult=await handleActivityWriteRequest({req,url,repositories});
      if(activityWriteResult){
        const body=activityWriteResult.body&&activityWriteResult.body.success===false
          ? {...activityWriteResult.body,requestId}:activityWriteResult.body;
        writeJson(res,activityWriteResult.status,body,requestId);
        return;
      }

      const contactWriteResult = await handleContactWriteRequest({ req, url, repositories });
      if (contactWriteResult) {
        const body = contactWriteResult.body && contactWriteResult.body.success === false
          ? { ...contactWriteResult.body, requestId }
          : contactWriteResult.body;
        writeJson(res, contactWriteResult.status, body, requestId);
        return;
      }

      const enrichmentResult = await handleEnrichmentRequest({ req, url, repositories });
      if (enrichmentResult) {
        const body = enrichmentResult.body && enrichmentResult.body.success === false
          ? { ...enrichmentResult.body, requestId }
          : enrichmentResult.body;
        writeJson(res, enrichmentResult.status, body, requestId);
        return;
      }

      const readResult = await handleReadRequest({ req, url, repositories });
      if (readResult) {
        const body = readResult.body && readResult.body.success === false
          ? { ...readResult.body, requestId }
          : readResult.body;
        writeJson(res, readResult.status, body, requestId);
        return;
      }

      writeJson(res, 404, {
        success: false,
        error_code: 'not_found',
        error_message: 'Endepunktet finnes ikke.',
        requestId
      }, requestId);
    } catch (error) {
      writeJson(res, 500, {
        success: false,
        error_code: 'internal_error',
        error_message: 'Uventet serverfeil.',
        requestId
      }, requestId);
    }
  };
}

module.exports = { createApp,prepareCrmWorkspace };
