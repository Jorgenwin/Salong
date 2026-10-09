'use strict';

// The familiar Salong domain serves the authenticated CRM through a same-origin
// gateway. It never stores access tokens or database credentials. The original
// standalone fixture remains accessible as an explicitly separate /demo/ page.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const API_ORIGIN = 'https://salong-api-production.up.railway.app';
const NO_STORE = {
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'
};

function createGateway({apiOrigin=API_ORIGIN,demoRoot=path.resolve(__dirname,'../dist')}={}){
  const upstream = new URL(apiOrigin);
  if(!['https:','http:'].includes(upstream.protocol) ||
    upstream.username || upstream.password || upstream.pathname!=='/' ||
    upstream.search || upstream.hash){
    throw new Error('Invalid Salong API origin');
  }
  const transport = upstream.protocol==='https:' ? https : http;
  const safeDemoRoot = path.resolve(demoRoot);

  return http.createServer((req,res)=>{
    let url;
    try{url=new URL(req.url||'/', 'http://salong.local');}
    catch(_error){res.writeHead(400,NO_STORE);res.end('Invalid URL');return;}
    const pathname=url.pathname;

    if(pathname==='/health' && ['GET','HEAD'].includes(req.method)){
      res.writeHead(200,{...NO_STORE,'content-type':'application/json; charset=utf-8'});
      res.end(req.method==='HEAD'?'':JSON.stringify({status:'ok',service:'salong-gateway'}));
      return;
    }

    // Deliberately separate, clearly labelled synthetic data. No /api proxy
    // credentials or direct write methods are made available to demo pages.
    if(pathname==='/demo'||pathname==='/demo/'){
      if(!['GET','HEAD'].includes(req.method)){
        res.writeHead(405,{...NO_STORE,allow:'GET, HEAD'});
        res.end('Method not allowed');return;
      }
      const filename=path.resolve(safeDemoRoot,'index.html');
      fs.realpath(filename,(error,realPath)=>{
        if(error || !realPath.startsWith(safeDemoRoot+path.sep)){
          res.writeHead(503,NO_STORE);res.end('Demo is unavailable');return;
        }
        fs.stat(realPath,(statError,stat)=>{
          if(statError||!stat.isFile()){
            res.writeHead(503,NO_STORE);res.end('Demo is unavailable');return;
          }
          res.writeHead(200,{...NO_STORE,'content-type':'text/html; charset=utf-8',
            'x-frame-options':'DENY'});
          if(req.method==='HEAD'){res.end();return;}
          fs.createReadStream(realPath).on('error',()=>res.destroy()).pipe(res);
        });
      });
      return;
    }

    // The root URL, including #kontakter/#prosp bookmarks, is the same
    // authenticated Salong experience as /crm on the API service. Fragments
    // never reach this server; the browser-side UI interprets them.
    const home=pathname==='/'&&['GET','HEAD'].includes(req.method);
    const crm=pathname==='/crm'||pathname.startsWith('/crm/');
    const api=pathname.startsWith('/api/');
    if(!home&&!crm&&!api){
      res.writeHead(404,NO_STORE);res.end('Not found');return;
    }
    if(crm&&!['GET','HEAD'].includes(req.method)){
      res.writeHead(405,{...NO_STORE,allow:'GET, HEAD'});
      res.end('Method not allowed');return;
    }

    const headers={...req.headers,host:upstream.host};
    for(const hop of ['connection','proxy-connection','keep-alive','te','trailer','upgrade']){
      delete headers[hop];
    }
    headers['accept-encoding']='identity';
    const targetPath=(home?'/crm':pathname)+url.search;
    const proxy=transport.request({
      protocol:upstream.protocol,hostname:upstream.hostname,
      port:upstream.port||undefined,method:req.method,
      path:targetPath,headers
    },upstreamResponse=>{
      const responseHeaders={...upstreamResponse.headers,...NO_STORE};
      delete responseHeaders.connection;
      delete responseHeaders['transfer-encoding'];
      res.writeHead(upstreamResponse.statusCode||502,responseHeaders);
      if(req.method==='HEAD'){upstreamResponse.resume();res.end();return;}
      upstreamResponse.on('error',()=>res.destroy());
      upstreamResponse.pipe(res);
    });
    proxy.setTimeout(20000,()=>proxy.destroy(new Error('Upstream timeout')));
    proxy.on('error',()=>{
      if(!res.headersSent){
        res.writeHead(502,{...NO_STORE,'content-type':'text/plain; charset=utf-8'});
        res.end('Kunne ikke kontakte Salong. Prov igjen.');
      }else res.destroy();
    });
    req.on('aborted',()=>proxy.destroy());
    req.pipe(proxy);
  });
}

if(require.main===module){
  const port=Number(process.env.PORT)||8080;
  createGateway({apiOrigin:process.env.SALONG_API_ORIGIN||API_ORIGIN})
    .listen(port,'0.0.0.0',()=>console.log('Salong gateway listening on port '+port));
}

module.exports={createGateway};
