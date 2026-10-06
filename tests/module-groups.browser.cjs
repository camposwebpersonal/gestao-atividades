// Requer servidor local na porta 8080 e Playwright disponível no NODE_PATH.
const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..');fs.mkdirSync('/tmp/gestao-module-groups-qa',{recursive:true});
const head=fs.readFileSync(root+'/index.html','utf8').split('</head>')[0].replace(/<script[\s\S]*?<\/script>/g,'');
const fixture=head+`</head><body data-workspace="cadastros"><main><div id="content"></div></main><div class="modal-overlay" id="modal-ov"><div class="modal-box"><div id="modal-ttl"></div><div id="modal-sub"></div><div id="modal-body"></div></div></div><div id="toast"></div><script type="module">
window.S={isAdmin:true,permissoes:{},secs:[
 {id:'source',name:'CORREIOS',order_num:0,observacoes:'Cadastros e endereços',extra_fields:{modulo:'cadastros'},created_by_name:'RCAMPOS'},
 {id:'source2',name:'LIDERANÇAS',order_num:1,extra_fields:{modulo:'cadastros'}},
 {id:'target',name:'CORREIOS',order_num:0,demanda_secretaria_id:'gab',extra_fields:{modulo:'atendimentos'}}
],items:Array.from({length:9},(_,i)=>({id:'i'+i,atividade_id:'source',concluded:i<7})),subitems:[],secretarias:[{id:'gab',name:'GABINETE',demandas_ativa:true}],fieldTemplates:[],estoque:[],requisicoes:[],contas:[],distribuicao:[]};
window.toast=(msg,type)=>window.lastToast={msg,type};window.loadData=async()=>{};window.setView=()=>{};window.openActivity=id=>window.opened=id;window.openSecModal=id=>window.edited=id;window.gerarPdf=()=>{};window.gerarRelatorioModulo=()=>{};
window.openModal=(title,sub,html)=>{document.getElementById('modal-ttl').textContent=title;document.getElementById('modal-sub').textContent=sub;document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-ov').style.display='flex'};window.closeModal=()=>document.getElementById('modal-ov').style.display='none';
window.refreshAuditUI=()=>{};window.rpcCalls=[];window.mockRpc=async(_name,args)=>{rpcCalls.push(args);if(args.operation==='group'){const g=S.secs.find(x=>x.id===args.source_group);g.extra_fields.modulo='atendimentos';g.demanda_secretaria_id=args.target_secretaria;}return{data:{items:9,subitems:0},error:null}};
await import('/js/modulos.js?v=69');window.renderModulo('cadastros');window.ready=true;
</script></body></html>`;
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1500,height:900}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://127.0.0.1:8080/qa-module-groups',r=>r.fulfill({contentType:'text/html',body:fixture}));
await page.route('**/supabase_compat.js',r=>r.fulfill({contentType:'text/javascript',body:'export const supabase={rpc:(...args)=>window.mockRpc(...args)};'}));
await page.goto('http://127.0.0.1:8080/qa-module-groups');await page.waitForFunction(()=>window.ready);
assert.equal(await page.locator('.module-group-row').count(),2);assert.equal(await page.locator('#content .activity-card').count(),0);assert.ok((await page.locator('.module-group-row').first().boundingBox()).height<90);
await page.screenshot({path:'/tmp/gestao-module-groups-qa/desktop.png',fullPage:true});
await page.getByRole('button',{name:'Transferir CORREIOS',exact:true}).click();assert.equal(await page.locator('.module-transfer-choice').count(),2);
await page.getByRole('button',{name:/Grupo completo/}).click();await page.locator('#module-transfer-secretaria').selectOption('gab');await page.getByRole('button',{name:'Transferir com segurança'}).click();await page.waitForFunction(()=>rpcCalls.length===1);
assert.deepEqual(await page.evaluate(()=>rpcCalls[0]),{operation:'group',source_group:'source',target_group:null,target_secretaria:'gab'});
await page.evaluate(()=>{S.secs.find(x=>x.id==='source').extra_fields.modulo='cadastros';renderModulo('cadastros')});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:'/tmp/gestao-module-groups-qa/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);console.log('PASS browser: compact module groups, two transfer modes, admin RPC and responsive layout');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
