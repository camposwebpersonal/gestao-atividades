const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const port=process.env.TEST_PORT||'8080';
const testUrl=`http://127.0.0.1:${port}/qa-bulk-archive`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/bulk-archive.css"></head><body>
<div id="modal-ov" class="open"><div class="modal-box"><h1 id="modal-title"></h1><p id="modal-sub"></p><div id="modal-body"></div></div></div>
<main id="archive"></main>
<script type="module">
window.modForSec=()=> 'atendimentos';
window.S={isAdmin:true,items:[],fieldTemplates:[{atividade_id:'saneamento',scope:'item',field_name:'Localidade',field_type:'text',order_num:0}],secs:[{id:'saneamento',name:'SOLICITAÇÕES DE SANEAMENTO BÁSICO',demanda_secretaria_id:'agricultura',extra_fields:{modulo:'atendimentos'}}]};
window.userCanGroup=()=>true;
window.openModal=(title,sub,html)=>{document.getElementById('modal-title').textContent=title;document.getElementById('modal-sub').textContent=sub;document.getElementById('modal-body').innerHTML=html;};
window.closeModal=()=>{};window.loadData=async()=>{};window.openActivity=()=>window.activityOpened=true;window.toast=(message)=>window.lastToast=message;
await import('/js/bulk-entry.js?v=1');
const archive=await import('/js/completed-archive.js?v=1');
window.renderArchive=()=>{document.getElementById('archive').innerHTML=archive.renderCompletedArchive({group:window.S.secs[0],items:[{id:'april',description:'Ligação de esgoto concluída',start_date:'2026-04-12',conclusion_date:'2026-05-01',responsaveis:'Equipe A'},{id:'may',description:'Rede concluída',start_date:'2026-05-03',conclusion_date:'2026-05-09'}],subitems:[],progress:()=>({pct:100}),canEdit:true});};
window.openBulkEntry('saneamento');window.ready=true;
</script></body></html>`;

(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(testUrl,route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.route('**/supabase_compat.js',route=>route.fulfill({contentType:'text/javascript',body:`export const supabase={from:()=>({insert:async rows=>{window.insertedRows=rows;return {error:null};}})};`}));
 await page.goto(testUrl);await page.waitForFunction(()=>window.ready);
 assert.equal(await page.locator('[data-bulk-row]').count(),12);
 await page.locator('[data-row="0"][data-col="0"]').press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.col),'1');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.row),'1');
 await page.locator('#bulk-total-count').fill('140');await page.getByRole('button',{name:'Definir'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),140);
 await page.locator('#bulk-add-count').fill('7');await page.getByRole('button',{name:'＋ linhas'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),147);
 await page.locator('#bulk-total-count').fill('140');await page.getByRole('button',{name:'Definir'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),140);
 await page.evaluate(()=>{document.activeElement?.blur();document.querySelector('.bulk-grid-wrap').scrollTop=0;});await page.screenshot({path:'/tmp/gestao-bulk-controls.png'});
 const lines=Array.from({length:100},(_,index)=>[`Solicitação ${index+1}`,'05/04/2026','Equipe A','Morador','Atenção',index===0?'sim':'','10/04/2026','Cadastro em lote','Zona rural'].join('\t')).join('\n');
 await page.locator('[data-row="0"][data-col="0"]').evaluate((input,text)=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>text}});input.dispatchEvent(event);},lines);
 assert.equal(await page.locator('[data-bulk-row]').count(),140);
 assert.equal(await page.locator('#bulk-filled-count').textContent(),'100 lançamentos preenchidos');
 await page.locator('#bulk-save').click();await page.waitForFunction(()=>window.insertedRows?.length===100);
 const saved=await page.evaluate(()=>({first:window.insertedRows[0],last:window.insertedRows.at(-1),toast:window.lastToast,opened:window.activityOpened}));
 assert.equal(saved.first.description,'Solicitação 1');assert.equal(saved.first.start_date,'2026-04-05');assert.equal(saved.first.secretaria_id,'agricultura');assert.equal(saved.first.extra_fields.Localidade,'Zona rural');assert.equal(saved.first.extra_fields.urgencia,'amarelo');assert.equal(saved.last.description,'Solicitação 100');assert.equal(saved.opened,true);assert.match(saved.toast,/100 lançamentos/);
 await page.evaluate(()=>window.renderArchive());
 assert.equal(await page.locator('.completed-month').count(),2);assert.equal(await page.getByText('abril de 2026',{exact:true}).count(),1);assert.equal(await page.getByText('maio de 2026',{exact:true}).count(),1);
 await page.screenshot({path:'/tmp/gestao-bulk-archive-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:780});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'a interface criou rolagem horizontal fora da planilha no celular');
 await page.screenshot({path:'/tmp/gestao-bulk-archive-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS browser: colagem de 100 linhas, salvamento único, arquivo mensal e responsividade');await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
