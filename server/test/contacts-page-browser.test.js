'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {once}=require('node:events');
const {chromium}=require('playwright');
const {HTML,JS}=require('../src/ui/crm-page');

test('contacts can be added, edited and marked primary/do-not-contact from company', {timeout:45000},async t=>{
  let browser;
  try{browser=await chromium.launch({headless:true});}
  catch(error){t.skip('Chromium missing: '+error.message.slice(0,85));return;}
  let origin, contacts=[],nextId=0;const writes=[];
  const send=(res,status,body,type='application/json')=>{
    res.statusCode=status;res.setHeader('content-type',type);
    res.end(typeof body==='string'?body:JSON.stringify(body));
  };
  const server=http.createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/crm'){
      res.setHeader('content-security-policy',
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'");
      send(res,200,HTML,'text/html');return;
    }
    if(path==='/crm/config.js'){
      send(res,200,'window.SALONG_PUBLIC_CONFIG='+JSON.stringify({supabaseUrl:origin,publishableKey:'example'})+';','application/javascript');return;
    }
    if(path==='/crm/client.js'){send(res,200,JS,'application/javascript');return;}
    if(path==='/auth/v1/token'){send(res,200,{access_token:'test-token'});return;}
    if(req.headers.authorization!=='Bearer test-token'){send(res,401,{success:false});return;}
    if(path==='/api/me'){send(res,200,{role:'owner'});return;}
    if(path==='/api/organizations'){send(res,200,[{id:'o-1',name:'Forlag',priority:'A',segment:'forlag'}]);return;}
    if(path==='/api/outreach/summary'){send(res,200,{contacted:0,goal:500,remaining:500,daily_required:3,deadline:'2027-05-31'});return;}
    if(path==='/api/accounts/o-1/contacts'){
      if(req.method==='GET'){send(res,200,contacts);return;}
      if(req.method==='POST'){
        let text='';for await(const part of req)text+=part;
        const payload=JSON.parse(text);
        writes.push({action:'create',payload});
        const data={id:'c-'+(++nextId),account_id:'o-1',...payload,is_primary:false,do_not_contact:false};
        contacts.push(data);send(res,201,{success:true,data});return;
      }
    }
    const match=path.match(/^\/api\/contacts\/([^/]+)(?:\/(primary|do-not-contact))?$/);
    if(match){
      const id=match[1],action=match[2],index=contacts.findIndex(c=>c.id===id);
      if(index<0){send(res,404,{success:false});return;}
      let text='';for await(const part of req)text+=part;
      const payload=text?JSON.parse(text):{};
      writes.push({action:action||'patch',payload});
      if(action==='primary'){
        contacts=contacts.map(c=>({...c,is_primary:c.id===id}));
      }else if(action==='do-not-contact'){
        contacts[index]={...contacts[index],do_not_contact:true,is_primary:false};
      }else if(req.method==='PATCH')contacts[index]={...contacts[index],...payload};
      send(res,200,{success:true,data:contacts[index]});return;
    }
    send(res,404,{success:false});
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage();
    page.on('dialog',async dialog=>dialog.accept('Brukeren ba om å ikke bli kontaktet'));
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/crm');
    await page.locator('#form [name="email"]').fill('owner@example.test');
    await page.locator('#form [name="password"]').fill('test');
    await page.locator('#form button').click();
    await page.locator('.edit-org').waitFor({state:'visible'});
    await page.locator('.edit-org').click();
    await page.locator('#contacts-panel').waitFor({state:'visible'});
    await page.locator('#contact-form [name="name"]').fill('Kari Kontakt');
    await page.locator('#contact-form [name="email"]').fill('kari@example.test');
    await page.locator('#contact-save').click();
    await page.locator('#contact-list').filter({hasText:'Kari Kontakt'}).waitFor();
    assert.equal(contacts.length,1);
    assert.equal(contacts[0].name,'Kari Kontakt');
    assert.equal(writes[0].payload.email,'kari@example.test');
    await page.locator('#contact-list button').filter({hasText:'Rediger'}).click();
    await page.locator('#contact-form [name="phone"]').fill('+47 123 45 678');
    await page.locator('#contact-save').click();
    await page.locator('#contact-list').filter({hasText:'+47 123 45 678'}).waitFor();
    assert.equal(writes[1].action,'patch');
    assert.deepEqual(writes[1].payload,{phone:'+47 123 45 678'});
    await page.locator('#contact-list button').filter({hasText:'Sett som primær'}).click();
    await page.locator('#contact-list').filter({hasText:'Primær'}).waitFor();
    await page.locator('#contact-list button').filter({hasText:'Ikke kontakt'}).click();
    await page.locator('#contact-list').filter({hasText:'IKKE KONTAKT'}).waitFor();
    assert.equal(contacts[0].do_not_contact,true);
    assert.equal(writes.find(w=>w.action==='do-not-contact').payload.reason,
      'Brukeren ba om å ikke bli kontaktet');
    assert.deepEqual(errors,[]);
    await page.locator('#editor-close').click();
    assert.equal(await page.locator('#contacts-panel').isHidden(),true);
    await page.locator('#logout').click();
    assert.equal(await page.locator('#data').isHidden(),true);
  }finally{
    await browser.close();
    server.close();await once(server,'close');
  }
});
