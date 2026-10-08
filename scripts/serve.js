// Static preview server. This is a DEMO, never an authenticated CRM backend.
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','dist');
const port=Number(process.env.PORT)||8080;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
function createStaticServer({directory=root}={}){
  const base=path.resolve(directory);
  return http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Frame-Options','DENY');
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;
    }
    let url;
    try{url=new URL(req.url||'/', 'http://localhost');}
    catch(_){res.writeHead(400);res.end('Invalid URL');return;}
    let pathname;
    try{pathname=decodeURIComponent(url.pathname);}
    catch(_){res.writeHead(400);res.end('Invalid path');return;}
    if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').includes('..')){
      res.writeHead(404);res.end('Not found');return;
    }
    const filename=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
    if(filename!==base&&!filename.startsWith(base+path.sep)){
      res.writeHead(404);res.end('Not found');return;
    }
    fs.realpath(filename,(err,real)=>{
      if(err||(!real.startsWith(base+path.sep)&&real!==base)){
        res.writeHead(404);res.end('Not found');return;
      }
      fs.stat(real,(statErr,stat)=>{
        if(statErr||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
        res.writeHead(200,{'Content-Type':types[path.extname(real)]||'application/octet-stream'});
        if(req.method==='HEAD'){res.end();return;}
        const stream=fs.createReadStream(real);
        stream.on('error',()=>{res.destroy();});
        stream.pipe(res);
      });
    });
  });
}
if(require.main===module){
  createStaticServer().listen(port,'0.0.0.0',()=>console.log('Salong demo listening on port '+port));
}
module.exports={createStaticServer};
