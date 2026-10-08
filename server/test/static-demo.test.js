'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {createStaticServer}=require('../../scripts/serve');

test('static demo serves index but denies writes and path escapes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'salong-demo-'));
  fs.writeFileSync(path.join(dir,'index.html'),'<h1>Safe synthetic demo</h1>');
  const outside=path.join(os.tmpdir(),'salong-outside-'+process.pid+'.txt');
  fs.writeFileSync(outside,'outside secret');
  try{
    fs.symlinkSync(outside,path.join(dir,'secret.txt'));
    const server=createStaticServer({directory:dir});
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    const base='http://127.0.0.1:'+server.address().port;
    try{
      let result=await fetch(base+'/');
      assert.equal(result.status,200);
      assert.match(await result.text(),/Safe synthetic demo/);
      assert.equal(result.headers.get('cache-control'),'no-store');
      assert.equal(result.headers.get('x-content-type-options'),'nosniff');
      result=await fetch(base+'/anything',{method:'POST',body:'{}'});
      assert.equal(result.status,405);
      result=await fetch(base+'/secret.txt');
      assert.equal(result.status,404);
      result=await fetch(base+'/missing.txt');
      assert.equal(result.status,404);
      result=await fetch(base+'/%2e%2e/%2e%2e/etc/passwd');
      assert.equal(result.status,404);
      result=await fetch(base+'/',{method:'HEAD'});
      assert.equal(result.status,200);
      assert.equal(await result.text(),'');
    }finally{
      server.close();
      await once(server,'close');
    }
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(outside,{force:true});
  }
});
