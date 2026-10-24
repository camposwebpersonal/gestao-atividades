const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const port=process.env.TEST_PORT||'8080';
const testUrl=`http://127.0.0.1:${port}/qa-bulk-archive`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/bulk-archive.css"><link rel="stylesheet" href="/css/custom-fields.css"></head><body>
<div id="modal-ov" class="open"><div class="modal-box"><h1 id="modal-title"></h1><p id="modal-sub"></p><div id="modal-body"></div></div></div>
<main id="archive"></main>
<script type="module">
window.modForSec=()=> 'atendimentos';
window.S={user:{uid:'u1',displayName:'Ricardo'},isAdmin:true,items:[],fieldTemplates:[{atividade_id:'saneamento',scope:'item',field_name:'Localidade',field_type:'text',order_num:0},{atividade_id:'saneamento',scope:'item',field_name:'Tipo de serviço',field_type:'checkboxes',options:['Entupido','Estourado','Ligar rede nova','Tampa'],order_num:1},{atividade_id:'saneamento',scope:'item',field_name:'Área',field_type:'radio',options:['Urbana','Rural'],order_num:2}],secs:[{id:'saneamento',name:'SOLICITAÇÕES DE SANEAMENTO BÁSICO',demanda_secretaria_id:'agricultura',extra_fields:{modulo:'atendimentos'}}]};
window.userCanGroup=()=>true;
window.openModal=(title,sub,html)=>{document.getElementById('modal-title').textContent=title;document.getElementById('modal-sub').textContent=sub;document.getElementById('modal-body').innerHTML=html;};
window.closeModal=()=>{};window.loadData=async()=>{};window.openActivity=()=>window.activityOpened=true;window.toast=(message)=>window.lastToast=message;
await import('/js/bulk-entry.js?v=5');
const archive=await import('/js/completed-archive.js?v=2');
window.renderArchive=()=>{document.getElementById('archive').innerHTML=archive.renderCompletedArchive({group:window.S.secs[0],items:[{id:'april',description:'Ligação de esgoto concluída',start_date:'2026-04-12',conclusion_date:'2026-05-01',responsaveis:'Equipe A'},{id:'may',description:'Rede concluída',start_date:'2026-05-03',conclusion_date:'2026-05-09'}],subitems:[],progress:()=>({pct:100}),canEdit:true});};
await window.openBulkEntry('saneamento');window.ready=true;
</script></body></html>`;

(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(testUrl,route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.route('**/supabase_compat.js',route=>route.fulfill({contentType:'text/javascript',body:`
let drafts=[];
const result=data=>({data,error:null});
export const supabase={
 from(table){if(table!=='bulk_entry_drafts')return {};
  return {
   select(){return {eq(_key,value){return {order:async()=>result(drafts.filter(d=>d.group_id===value))}}}},
   insert(value){return {select(){return {single:async()=>{const draft={id:'draft-'+(drafts.length+1),owner_id:'u1',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...value};drafts.unshift(draft);return result(draft)}}}}},
   update(value){return {eq(_key,id){return {select(){return {single:async()=>{const index=drafts.findIndex(d=>d.id===id);drafts[index]={...drafts[index],...value};return result(drafts[index])}}}}}}},
   delete(){return {eq:async(_key,id)=>{drafts=drafts.filter(d=>d.id!==id);return result(null)}}
  };
 },
 async rpc(name,args){if(name!=='submit_bulk_entry_draft')return {data:null,error:{message:'RPC inválida'}};window.insertedRows=args.p_items;drafts=drafts.filter(d=>d.id!==args.p_draft_id);return result(args.p_items);}
};`}));
 await page.goto(testUrl);await page.waitForFunction(()=>window.ready);
 await page.locator('#bulk-new-title').fill('LANÇAMENTOS DE RICARDO');await page.getByRole('button',{name:'＋ Criar novo lote'}).click();
 assert.equal(await page.locator('[data-bulk-row]').count(),12);
 await page.locator('[data-row="0"][data-col="0"]').press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.col),'1');
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.row),'1');
 await page.locator('[data-row="0"][data-col="0"]').fill('MODELO');await page.locator('[data-row="0"][data-col="0"]').focus();await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Control+d');
 assert.equal(await page.locator('[data-row="1"][data-col="0"]').inputValue(),'MODELO');assert.equal(await page.locator('[data-row="2"][data-col="0"]').inputValue(),'MODELO');
 await page.locator('#bulk-total-count').fill('140');await page.getByRole('button',{name:'Definir'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),140);
 await page.locator('[data-row="76"][data-col="0"]').fill('PAREI NA LINHA 77');await page.locator('[data-row="76"][data-col="0"]').focus();await page.evaluate(()=>document.querySelector('.bulk-grid-wrap').scrollTop=1200);await page.waitForTimeout(1100);await page.getByRole('button',{name:'← Meus lotes'}).click();await page.getByRole('button',{name:'Continuar'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),140);assert.equal(await page.locator('[data-row="76"][data-col="0"]').inputValue(),'PAREI NA LINHA 77');assert.equal(await page.evaluate(()=>document.querySelector('.bulk-grid-wrap').scrollTop),1200);
 await page.locator('#bulk-add-count').fill('7');await page.getByRole('button',{name:'＋ linhas'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),147);
 await page.locator('#bulk-total-count').fill('140');await page.getByRole('button',{name:'Definir'}).click();assert.equal(await page.locator('[data-bulk-row]').count(),140);
 await page.evaluate(()=>{document.activeElement?.blur();document.querySelector('.bulk-grid-wrap').scrollTop=0;});await page.screenshot({path:'/tmp/gestao-bulk-controls.png'});
 const lines=Array.from({length:100},(_,index)=>[`Solicitação ${index+1}`,'05/04/2026','Equipe A','Morador','Atenção',index===0?'sim':'','10/04/2026','Cadastro em lote','Zona rural','Estourado; Tampa','Rural'].join('\t')).join('\n');
 await page.locator('[data-row="0"][data-col="0"]').evaluate((input,text)=>{const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>text}});input.dispatchEvent(event);},lines);
 assert.equal(await page.locator('[data-bulk-row]').count(),140);
 assert.equal(await page.locator('#bulk-filled-count').textContent(),'100 lançamentos preenchidos');
 await page.locator('#bulk-save').click();await page.waitForFunction(()=>window.insertedRows?.length===100);
 const saved=await page.evaluate(()=>({first:window.insertedRows[0],last:window.insertedRows.at(-1),toast:window.lastToast,opened:window.activityOpened}));
 assert.equal(saved.first.description,'Solicitação 1');assert.equal(saved.first.start_date,'2026-04-05');assert.equal(saved.first.secretaria_id,'agricultura');assert.equal(saved.first.extra_fields.Localidade,'Zona rural');assert.deepEqual(saved.first.extra_fields['Tipo de serviço'],['Estourado','Tampa']);assert.equal(saved.first.extra_fields.Área,'Rural');assert.equal(saved.first.extra_fields.urgencia,'amarelo');assert.equal(saved.last.description,'Solicitação 100');assert.equal(saved.opened,true);assert.match(saved.toast,/100 lançamentos/);
 await page.evaluate(()=>window.renderArchive());
 assert.equal(await page.locator('.completed-month-card').count(),2);assert.equal(await page.getByText('abril',{exact:true}).count(),1);assert.equal(await page.getByText('maio',{exact:true}).count(),1);assert.equal(await page.locator('.completed-year').count(),1);
 await page.screenshot({path:'/tmp/gestao-bulk-archive-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:780});await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'a interface criou rolagem horizontal fora da planilha no celular');
 await page.screenshot({path:'/tmp/gestao-bulk-archive-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS browser: colagem de 100 linhas, salvamento único, arquivo mensal e responsividade');await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
