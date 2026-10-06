// Requer servidor local (porta 8080 por padrão) e Playwright disponível.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),port=process.env.TEST_PORT||'8080',url=`http://127.0.0.1:${port}/qa-autoria-admin`;
const head=fs.readFileSync(path.join(root,'index.html'),'utf8').split('</head>')[0].replace(/<script[\s\S]*?<\/script>/g,'');
const fixture=head+`<style>body{background:#eaf1f5;padding:20px}.modal-body{display:block;max-width:720px;margin:auto;background:#fff;padding:18px;border-radius:14px}</style></head><body><main class="modal-body" id="host"></main><script type="module">
const {adminAuditFields}=await import('/js/autoria.js');
const users=[{id:'u1',displayName:'CARLOS EDNAILTON'},{id:'u2',displayName:'RCAMPOS'}];
host.innerHTML=adminAuditFields({created_by:'u1',created_at:'2026-10-06T12:11:00Z',updated_by:'u2',updated_at:'2026-10-06T12:14:00Z'},users,'audit');window.ready=true;
</script></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:900,height:560}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto(url);await page.waitForFunction(()=>window.ready);
 assert.equal(await page.locator('.audit-admin-fields select').count(),2);assert.equal(await page.locator('.audit-admin-fields input[type="datetime-local"]').count(),2);
 assert.equal(await page.locator('#audit-created-user').inputValue(),'u1');assert.equal(await page.locator('#audit-updated-user').inputValue(),'u2');
 await page.screenshot({path:'/tmp/autoria-admin-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:700});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/autoria-admin-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS browser: histórico administrativo responsivo e preenchido');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
