'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createGateway}=require('../../scripts/gateway');

test('unified Salong root serves authenticated CRM and keeps /demo isolated',async()=>{
  const hits=[];
  const upstream=http.createServer((req,res)=>{
    hits.push({method:req.method,url:req.url,authorization:req.headers.authorization||null});
    res.writeHead(200,{'content-type':'text/html'});
    res.end('<main>Authenticated Salong</main>');
  });
  const demo=fs.mkdtempSync(path.join(os.tmpdir(),'salong-gateway-'));
  fs.writeFileSync(path.join(demo,'index.html'),'<main>Example only</main>');
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const gateway=createGateway({apiOrigin:'http://127.0.0.1:'+upstream.address().port,demoRoot:demo});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  const base='http://127.0.0.1:'+gateway.address().port;
  try{
    let response=await fetch(base+'/#kontakter');
    assert.equal(response.status,200);
    assert.match(await response.text(),/Authenticated Salong/);
    assert.equal(hits.at(-1).url,'/crm');
    response=await fetch(base+'/crm/ux.js');
    assert.equal(response.status,200);
    assert.equal(hits.at(-1).url,'/crm/ux.js');
    response=await fetch(base+'/api/organizations',{headers:{authorization:'Bearer test-token'}});
    assert.equal(response.status,200);
    assert.equal(hits.at(-1).authorization,'Bearer test-token');
    response=await fetch(base+'/demo/');
    assert.match(await response.text(),/Example only/);
    assert.equal(hits.length,3,'demo never reaches authenticated API');
    response=await fetch(base+'/api/organizations',{method:'POST',body:'{}'});
    assert.equal(response.status,200);
    assert.equal(hits.at(-1).method,'POST');
    response=await fetch(base+'/unknown');
    assert.equal(response.status,404);
    response=await fetch(base+'/crm',{method:'POST',body:'bad'});
    assert.equal(response.status,405);
    response=await fetch(base+'/health');
    assert.deepEqual((await response.json()).status,'ok');
  }finally{
    gateway.close();upstream.close();
    await Promise.all([once(gateway,'close'),once(upstream,'close')]);
    fs.rmSync(demo,{recursive:true,force:true});
  }
});

test('CRM client respects old Salong hash routes without breaking login',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/ui/crm-ux.js'),'utf8');
  assert.match(source,/kontakter:'companies'/);
  assert.match(source,/prosp:'workspace'/);
  assert.match(source,/const requested=startView\(\);showView/);
  assert.match(source,/window.addEventListener\('hashchange'/);
});
