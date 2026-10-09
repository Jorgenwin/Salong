'use strict';

// Public Salong domain: same-origin entrance to the authenticated API CRM.
// This service never holds database credentials or Supabase access tokens.
// The previous standalone example is still available at /demo/.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const defaultOrigin = 'https://salong-api-production.up.railway.app';
const launchScript = `(()=>{
  const views={
    idag:'today',kontakter:'companies',prosp:'workspace',
    pipeline:'pipeline'
  };
  const section=decodeURIComponent(location.hash.slice(1)).toLowerCase();
  const view=views[section]||'companies';
  const extra=view==='workspace'?'&section=prosp':'';
  location.replace('/crm?view='+view+extra);
})();`;
const launchCsp = "default-src 'none'; script-src 'sha256-"+
  createHash('sha256').update(launchScript).digest('base64')+
  "'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
const launchHtml = `<!doctype html><html lang="nb"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salong 2027 · Arbeidsflate</title>
<style>html{font-family:system-ui,-apple-system,sans-serif;background:#f6f9f6;color:#183b29}
body{min-height:90vh;display:grid;place-items:center;margin:0;padding:24px}
main{max-width:470px;padding:35px;background:white;border:1px solid #dce6de;border-radius:16px}
h1{letter-spacing:-.03em;margin:0 0 8px}p{line-height:1.6;color:#536759}
a{display:inline-block;background:#184b33;color:#fff;padding:12px 17px;border-radius:9px;font-weight:650}
small{display:block;margin-top:18px;color:#617369}</style></head>
<body><main><h1>Salong 2027</h1>
<p>Åpner Salong med innlogging og oppdaterte selskapsdata.</p>
<a href="/crm?view=companies">Åpne Salong</a>
<small>Trenger du eksempelutgaven? <a style="background:transparent;color:#184b33;padding:0" href="/demo/">Vis demo</a>.</small>
</main><script>${launchScript}</script></body></html>`;

const noStore = {
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'
};

function createGateway({apiOrigin=defaultOrigin,demoRoot=path.resolve(__dirname,'../dist')}={}){
  const upstream = new URL(apiOrigin);
  if(!['https:','http:'].includes(upstream.protocol) || upstream.username || upstream.password ||
    upstream.pathname!=='/' || upstream.search || upstream.hash){
    throw new Error('Invalid fixed Salong API origin');
  }
  const agent = upstream.protocol==='https:'?https:http;
  return http.createServer((req,res)=>{
    let requestUrl;
    try{requestUrl=new URL(req.url||'/', 'http://salong.local');}
    catch(_error){res.writeHead(400,noStore);res.end('Invalid URL');return;}
    const name=requestUrl.pathname;
    if(name==='/' && (req.method==='GET'||req.method==='HEAD')){
      res.writeHead(200,{...noStore,'content-type':'text/html; charset=utf-8',
        'content-security-policy':launchCsp});
      res.end(req.method==='HEAD'?'':launchHtml);return;
    }
    if(name==='/health' && (req.method==='GET'||req.method==='HEAD')){
      res.writeHead(200,{...noStore,'content-type':'application/json; charset=utf-8'});
      res.end(req.method==='HEAD'?'':JSON.stringify({status:'ok',service:'salong-gateway'}));return;
    }
    if((name==='/demo'||name==='/demo/') && (req.method==='GET'||req.method==='HEAD')){
      const filename=path.resolve(demoRoot,'index.html');
      fs.stat(filename,(err,stat)=>{
        if(err||!stat.isFile()){
          res.writeHead(503,noStore);res.end('Demo er ikke tilgjengelig.');return;
        }
        res.writeHead(200,{...noStore,'content-type':'text/html; charset=utf-8',
          'x-frame-options':'DENY'});
        if(req.method==='HEAD'){res.end();return;}
        fs.createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
      });return;
    }
    // Only the authenticated CRM and API may be proxied. No proxy to arbitrary URLs.
    if(name==='/crm'||name.startsWith('/crm/')||name.startsWith('/api/')){
      const headers={...req.headers,host:upstream.host};
      for(const name of ['connection','proxy-connection','keep-alive','te','trailer','upgrade']){
        delete headers[name];
      }
      // Do not let an upstream content-encoding break browsers or iframe CSP.
      headers['accept-encoding']='identity';
      const proxy=agent.request({
        protocol:upstream.protocol,hostname:upstream.hostname,port:upstream.port||undefined,
        method:req.method,path:requestUrl.pathname+requestUrl.search,headers
      },upstreamResponse=>{
        const responseHeaders={...upstreamResponse.headers,...noStore};
        delete responseHeaders.connection;
        delete responseHeaders['transfer-encoding'];
        // Node writes correct transfer framing for the response it streams.
        res.writeHead(upstreamResponse.statusCode||502,responseHeaders);
        if(req.method==='HEAD'){upstreamResponse.resume();res.end();return;}
        upstreamResponse.pipe(res);
      });
      proxy.setTimeout(20000,()=>proxy.destroy(new Error('Upstream timed out')));
      proxy.on('error',()=>{
        if(!res.headersSent){
          res.writeHead(502,{...noStore,'content-type':'text/plain; charset=utf-8'});
          res.end('Salong kunne ikke nå datatjenesten. Prøv igjen.');
        }else res.destroy();
      });
      req.on('aborted',()=>proxy.destroy());
      req.pipe(proxy);
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{...noStore,allow:'GET, HEAD'});res.end('Method not allowed');return;
    }
    res.writeHead(404,noStore);res.end('Not found');
  });
}
if(require.main===module){
  const port=Number(process.env.PORT)||8080;
  createGateway({apiOrigin:process.env.SALONG_API_ORIGIN||defaultOrigin})
    .listen(port,'0.0.0.0',()=>console.log('Salong unified gateway on port '+port));
}
module.exports={createGateway,launchHtml,launchCsp};
