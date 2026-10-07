const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const port=process.env.TEST_PORT||'8080';
const url=`http://127.0.0.1:${port}/qa-custom-fields`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/custom-fields.css"><style>body{font-family:Arial;background:#edf3f6;padding:30px;color:#18394e}.form{max-width:700px;margin:auto;padding:22px;border-radius:14px;background:#fff}.group{margin-bottom:18px}.group>strong{display:block;margin-bottom:7px}</style></head><body><main class="form"><div class="group"><strong>Tipo de serviço</strong><div id="multiple"></div></div><div class="group"><strong>Área</strong><div id="single"></div></div></main><script type="module">const fields=await import('/js/custom-fields.js?v=1');const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));document.getElementById('multiple').innerHTML=fields.customFieldControl({field_name:'Tipo de serviço',field_type:'checkboxes',options:['Entupido','Estourado','Ligar rede nova','Tampa']},['Estourado'],esc);document.getElementById('single').innerHTML=fields.customFieldControl({field_name:'Área',field_type:'radio',options:['Urbana','Rural']},'Rural',esc);window.collect=()=>fields.collectCustomFieldValues(document,{});window.ready=true;</script></body></html>`;

(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:900,height:620}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(url,route=>route.fulfill({contentType:'text/html',body:fixture}));await page.goto(url);await page.waitForFunction(()=>window.ready);
 assert.equal(await page.locator('#multiple input[type="checkbox"]').count(),4);assert.equal(await page.locator('#single input[type="radio"]').count(),2);
 await page.getByText('Entupido',{exact:true}).click();await page.getByText('Urbana',{exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.collect()),{'Tipo de serviço':['Entupido','Estourado'],Área:'Urbana'});
 assert.equal(await page.locator('#single input:checked').count(),1);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/gestao-custom-fields.png',fullPage:true});await browser.close();console.log('PASS browser: checkboxes múltiplos e radio exclusivo no lançamento individual');
})().catch(error=>{console.error(error);process.exit(1);});
