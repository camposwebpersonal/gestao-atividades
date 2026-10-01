// Requer servidor local na porta 8080 e Playwright disponível no NODE_PATH.
const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..');
fs.mkdirSync('/tmp/gestao-demandas-qa',{recursive:true});
const head=fs.readFileSync(root+'/index.html','utf8').split('</head>')[0].replace(/<script[\s\S]*?<\/script>/g,'');
const fixture=head+`</head><body data-workspace="atendimentos"><div id="app"><header id="navbar"><div class="brand"><img src="img/logo_sertania.png">Prefeitura de Sertânia</div></header><nav id="navmenu"><button class="nav-btn">⌂ Visão geral</button><div class="sidebar-divider">Áreas operacionais</div><div id="sidebar-modules"></div></nav><main><div id="content"></div></main></div><div id="modal-ov" style="display:none"><div class="modal-box"><h2 id="modal-ttl"></h2><p id="modal-sub"></p><div id="modal-body"></div></div></div><div id="toast"></div><script type="module">
window.S={isAdmin:true,secs:[],items:[],subitems:[],secretarias:[{id:'agri',name:'AGRICULTURA',demandas_ativa:true},{id:'infra',name:'INFRAESTRUTURA',demandas_ativa:true},{id:'saude',name:'SAÚDE',demandas_ativa:false}]};
const names=['Perfuração de Poços','SOLICITAÇÕES DE PIPA','DESSALINIZADORES','BARREIROS E CACIMBAS','PEDIDOS DE BARRAGENS MUNICIPAIS','REFORMAS DE CISTERNAS','PEDIDOS DE CAIXAS D’ÁGUA','POSTES E LUMINÁRIAS','ESTRADAS','SOLICITAÇÕES DE SANEAMENTO BÁSICO','PASSAGENS MOLHADAS','Novo Atendimentos'];
S.secs=names.map((name,i)=>({id:'g'+i,name,order_num:i,demanda_secretaria_id:i<7?'agri':i<11?'infra':null,extra_fields:{modulo:'atendimentos'},observacoes:i===0?'Cadastro, acompanhamento financeiro e perfuração de poços':'',created_by_name:i===0?'RCAMPOS':null}));
S.items=S.secs.flatMap((g,i)=>Array.from({length:i+1},(_,n)=>({id:g.id+'item'+n,atividade_id:g.id,concluded:n%2})));
window.toast=(msg,type)=>{window.lastToast={msg,type}};window.loadData=async()=>{};window.openActivity=id=>window.opened=id;window.openSecModal=id=>window.edited=id;window.gerarPdf=id=>window.pdf=id;
window.openModal=(title,sub,html)=>{document.getElementById('modal-ttl').textContent=title;document.getElementById('modal-sub').textContent=sub;document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-ov').style.display='flex';};window.closeModal=()=>document.getElementById('modal-ov').style.display='none';
window.db={};window.collection=(_db,name)=>({name});window.serverTimestamp=()=>new Date().toISOString();window.addDoc=async(col,data)=>{await new Promise(r=>setTimeout(r,40));const id='created-'+S.secs.length;S.secs.push({...data,id});return{id}};window.rpcCalls=[];window.mockRpc=async(op,args)=>{rpcCalls.push({op,args});if(window.failRpc)return {error:{message:'Falha simulada'}};if(args.operation==='move')S.secs.find(g=>g.id===args.group_id).demanda_secretaria_id=args.secretaria;if(args.operation==='reorder')args.group_ids.forEach((id,i)=>S.secs.find(g=>g.id===id).order_num=i);if(args.operation==='secretaria'){let sec=S.secretarias.find(s=>s.id===args.secretaria||s.name===args.secretaria_name);if(!sec){sec={id:'new-secretaria',name:args.secretaria_name};S.secretarias.push(sec);}sec.demandas_ativa=true;return{data:{id:sec.id}};}return {data:{}};};
await import('/js/modulos.js?v=68');
const {initAuditUI,rememberRecords}=await import('/js/autoria.js');rememberRecords('atividades',S.secs);initAuditUI();
window.renderModulo('atendimentos');window.ready=true;
</script></body></html>`;
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://127.0.0.1:8080/qa-demandas',r=>r.fulfill({contentType:'text/html',body:fixture}));
await page.route('**/supabase_compat.js',r=>r.fulfill({contentType:'text/javascript',body:'export const supabase={rpc:(...args)=>window.mockRpc(...args)};'}));
await page.goto('http://127.0.0.1:8080/qa-demandas');await page.waitForFunction(()=>window.ready);await page.waitForTimeout(300);
assert.equal(await page.locator('.demand-row').count(),12);assert.equal(await page.locator('.demand-card').count(),0);assert.equal(await page.locator('.demand-subnav-btn').count(),3);
await page.screenshot({path:'/tmp/gestao-demandas-qa/desktop.png',fullPage:true});
await page.locator('[data-demand-id="g0"] .demand-checkbox').check();assert.equal(await page.locator('#demand-delete-selected').isEnabled(),true);await page.locator('[data-demand-id="g0"] .demand-checkbox').uncheck();
await page.getByRole('button',{name:'▦ Cards',exact:true}).click();assert.equal(await page.locator('.demand-card').count(),12);
await page.reload();await page.waitForFunction(()=>window.ready);assert.equal(await page.locator('.demand-card').count(),12);
await page.getByRole('button',{name:'☰ Lista',exact:true}).click();
await page.getByRole('searchbox').fill('perfuracao');assert.equal(await page.locator('.demand-row').count(),1);assert.equal(await page.locator('.demand-drag').isDisabled(),true);
await page.getByRole('searchbox').fill('');
await page.locator('[data-demand-id="g0"] .demand-order-arrows button').last().click();await page.waitForFunction(()=>window.rpcCalls.length===1);assert.deepEqual(await page.evaluate(()=>rpcCalls[0].args.group_ids.slice(0,2)),['g1','g0']);
// Native drag events with shared DataTransfer: move g0 below g3.
await page.evaluate(()=>{const source=document.querySelector('[data-demand-id="g0"] .demand-drag'),target=document.querySelector('[data-demand-id="g3"]');const dt=new DataTransfer();source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));const y=target.getBoundingClientRect().bottom-1;target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:y}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:y}));});await page.waitForFunction(()=>rpcCalls.length===2);assert.deepEqual(await page.evaluate(()=>rpcCalls[1].args.group_ids.slice(0,4)),['g1','g2','g3','g0']);
await page.getByRole('button',{name:'Transferir Perfuração de Poços',exact:true}).click();await page.locator('#demand-transfer-target').selectOption('infra');await page.getByRole('button',{name:'Transferir grupo',exact:true}).click();await page.waitForFunction(()=>currentDemandSecretaria==='infra');assert.equal(await page.locator('.demand-row').count(),5);
await page.getByRole('button',{name:'＋ Nova secretaria',exact:true}).click();await page.locator('#demand-secretaria-name').fill('Secretaria de Teste');await page.getByRole('button',{name:'Salvar secretaria',exact:true}).click();await page.waitForFunction(()=>currentDemandSecretaria==='new-secretaria');assert.equal(await page.locator('.demand-empty').count(),1);assert.equal(await page.locator('.demand-subnav-btn').count(),4);
await page.evaluate(()=>openDemandSecretaria());
// An unsuccessful transfer leaves the group in its original secretary.
await page.evaluate(()=>window.failRpc=true);await page.getByRole('button',{name:'Transferir ESTRADAS',exact:true}).click();await page.locator('#demand-transfer-target').selectOption('agri');await page.getByRole('button',{name:'Transferir grupo',exact:true}).click();await page.waitForFunction(()=>window.lastToast?.type==='error');assert.equal(await page.evaluate(()=>S.secs.find(g=>g.name==='ESTRADAS').demanda_secretaria_id),'infra');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'/tmp/gestao-demandas-qa/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page overflow');
// Group creation persists its secretary and repeated clicks create only one group.
const beforeCreate=await page.evaluate(()=>S.secs.length);
await page.evaluate(async()=>{failRpc=false;await Promise.all([newDemandGroup('agri'),newDemandGroup('agri')]);});
assert.equal(await page.evaluate(()=>S.secs.length),beforeCreate+1);assert.equal(await page.evaluate(()=>S.secs.at(-1).demanda_secretaria_id),'agri');assert.equal(await page.evaluate(()=>S.secs.at(-1).extra_fields.modulo),'atendimentos');
// Read-only accounts cannot transfer, create, or reorder.
await page.evaluate(()=>{S.isAdmin=false;S.permissoes={modulos:{atendimentos:{acesso:true}}};renderModulo('atendimentos');});assert.equal(await page.locator('.demand-transfer,.demand-drag').count(),0);assert.equal(await page.getByRole('button',{name:'＋ Nova secretaria',exact:true}).count(),0);
assert.deepEqual(errors,[]);console.log('PASS browser: list default, cards persistence, search, sidebar, keyboard/buttons, drag, move, new secretary, failure, mobile, permissions');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
