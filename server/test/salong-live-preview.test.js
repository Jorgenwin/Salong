'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {prepareCrmWorkspace}=require('../src/app');
const {HTML,JS}=require('../src/ui/crm-page');

test('built familiar Salong page is marked read-only and only the exact script hash can run',()=>{
  const source='<html><body><script>\nconst realApp=true;\n</script></body></html>';
  const out=prepareCrmWorkspace(source);
  assert.ok(out);
  assert.match(out.html,/window\.SALONG_CRM_READONLY=true/);
  assert.match(out.csp,/script-src 'sha256-[^']+'/);
  assert.doesNotMatch(out.csp,/script-src 'unsafe-inline'/);
  assert.match(out.csp,/frame-ancestors 'self'/);
  assert.equal(prepareCrmWorkspace('<p>No source bundle</p>'),null);
});

test('login page requires authenticated organization fetch before showing familiar Salong',()=>{
  assert.match(HTML,/id="open-workspace"/);
  assert.match(JS,/get\('open-workspace'\)/);
  assert.match(JS,/if\(!token\|\|!accounts\.length\)/);
  assert.match(JS,/salong:crm-organizations/);
  assert.match(JS,/event\.origin!==location\.origin/);
  assert.ok(JS.includes("closeEditor();closeWorkspace();canWrite=false;token=null"));
});

function runPreview(enabled){
  const script=fs.readFileSync(path.join(__dirname,'../../src/services/live-preview.js'),'utf8');
  const bridge=fs.readFileSync(path.join(__dirname,'../../src/services/organization-bridge.js'),'utf8');
  const listeners={},documentListeners={};
  const notify=[];
  const win={
    SALONG_CRM_READONLY:enabled,parent:{postMessage:(msg)=>notify.push(msg)},
    addEventListener:(event,fn)=>{listeners[event]=fn;}
  };
  const ctx={
    window:win,location:{origin:'https://salong.test'},
    document:{
      createElement:()=>({textContent:''}),
      head:{appendChild:()=>{}},
      addEventListener:(event,fn)=>{documentListeners[event]=fn;}
    },
    S:{orgs:{demo:{name:'Demo'}},settings:{},mtacc:{legacy:{name:'Old legacy'}}},
    STORE_COLLECTIONS:['orgs','mtacc','mtper','acts','deals'],
    PROFILES:{demo:{name:'Demo'}},DEFAULT_SETTINGS:{},UI:{view:'idag',mt:{},ku:{}},
    DV:0,MT_MEMO:{cached:true},render:()=>{},toast:()=>{},
  };
  vm.createContext(ctx);
  vm.runInContext(bridge+
    "\nlet readOnly=false;let loadDemo=()=>{};let syncState=()=>({k:'demo'});\n"+
    script+
    "\nglobalTest={isReadOnly:()=>readOnly,load:()=>loadDemo(),getSync:()=>syncState()};\n",ctx);
  return {ctx,listeners,documentListeners,notify:()=>notify};
}
test('preview starts without synthetic data, rejects foreign messages and applies only real accounts',()=>{
  const h=runPreview(true);
  assert.equal(h.ctx.globalTest.isReadOnly(),true);
  h.ctx.globalTest.load();
  assert.equal(Object.keys(h.ctx.S.orgs).length,0);
  assert.equal(Object.keys(h.ctx.PROFILES).length,0);
  assert.equal(Object.keys(h.ctx.S.mtacc).length,0);
  const data={
    type:'salong:crm-organizations',
    organizations:[{id:'db-1',name:'Forlag',priority:'A',segment:'forlag'}]
  };
  h.listeners.message({origin:'https://untrusted.test',source:h.ctx.window.parent,data});
  assert.equal(Object.keys(h.ctx.S.orgs).length,0);
  h.listeners.message({origin:'https://salong.test',source:h.ctx.window.parent,data});
  assert.equal(h.ctx.S.orgs['db-1'].tier,'A');
  assert.equal(h.ctx.S.orgs['db-1'].segment,'forlag');
  assert.equal(h.ctx.UI.view,'prosp');
  assert.equal(h.ctx.globalTest.getSync().k,'ro');
  assert.equal(h.notify()[0].count,1);
  h.listeners.message({origin:'https://salong.test',source:h.ctx.window.parent,data});
  assert.equal(h.notify().length,1);
});

test('authorized company actions are delegated to the authenticated parent and may refresh data',()=>{
  const h=runPreview(true);
  h.ctx.globalTest.load();
  h.listeners.message({origin:'https://salong.test',source:h.ctx.window.parent,
    data:{type:'salong:crm-organizations',organizations:[{id:'a',name:'Første',priority:'A'}],canWrite:true}
  });
  assert.equal(h.ctx.window.SALONG_CRM_CAN_WRITE,true);
  const button={
    dataset:{salongEdit:'a'},
    matches:()=>false,
    closest(selector){return selector==='[data-salong-edit]'?this:null;}
  };
  let cancelled=false;
  h.documentListeners.click({target:{closest:()=>button},preventDefault:()=>{cancelled=true;},
    stopImmediatePropagation:()=>{}});
  assert.equal(cancelled,true);
  assert.equal(h.notify()[1].type,'salong:crm-edit');
  assert.equal(h.notify()[1].id,'a');
  h.listeners.message({origin:'https://salong.test',source:h.ctx.window.parent,
    data:{type:'salong:crm-organizations-refresh',organizations:[{id:'b',name:'Oppdatert',priority:'B'}],canWrite:true}
  });
  assert.equal(h.ctx.S.orgs.a,undefined);
  assert.equal(h.ctx.S.orgs.b.name,'Oppdatert');
  assert.equal(h.notify()[2].count,1);
});
test('preview blocks mutation buttons before browser UI handlers run',()=>{
  const h=runPreview(true);let prevented=false,stopped=false;
  const btn={matches:()=>false,closest:()=>null};
  h.documentListeners.click({target:{closest:()=>btn},preventDefault:()=>{prevented=true;},
    stopImmediatePropagation:()=>{stopped=true;}});
  assert.equal(prevented,true);
  assert.equal(stopped,true);
});

test('ordinary demo does not activate read-only or clear demo data',()=>{
  const h=runPreview(false);
  assert.equal(h.ctx.globalTest.isReadOnly(),false);
  assert.equal(h.ctx.S.orgs.demo.name,'Demo');
  assert.equal(h.ctx.PROFILES.demo.name,'Demo');
  assert.equal(h.listeners.message,undefined);
});
