const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function app(){
 const filters={};let html='';
 const S={isAdmin:true,secs:[{id:'s',name:'Contas'}],items:[{id:'a',atividade_id:'s',description:'Saúde'},{id:'b',atividade_id:'s',description:'Educação'}],subitems:[{id:'l1',item_id:'a',atividade_id:'s',description:'Hospital',extra_fields:{}},{id:'l2',item_id:'b',atividade_id:'s',description:'Escola',extra_fields:{}}],contas:[
 {id:'c1',atividade_id:'s',item_id:'a',subitem_id:'l1',tipo:'Luz',mes_ano:'01/2026',valor:100,pago:true},
 {id:'c2',atividade_id:'s',item_id:'a',subitem_id:'l1',tipo:'Luz',mes_ano:'02/2025',valor:200,pago:false},
 {id:'c3',atividade_id:'s',item_id:'a',subitem_id:'l1',tipo:'Internet',mes_ano:'03/2026',valor:300,pago:false},
 {id:'c4',atividade_id:'s',item_id:'b',subitem_id:'l2',tipo:'Água',mes_ano:'04/2024',valor:400,pago:true}]};
 const ctx={console,S,scrollTo:()=>{},curSecId:null,setTimeout,clearTimeout,requestAnimationFrame:f=>f(),document:{getElementById:id=>filters[id]||null,querySelectorAll:()=>[],querySelector:()=>null},setC:h=>html=h};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/controle-contas.js'),'utf8'),ctx);
 return {ctx,S,filters,panel:()=>html.split('<section class="cc-workspace-panel cc-month-workspace"').at(-1),html:()=>html};
}
test('setor → tipo → ano seleciona os registros e mantém resumo geral',()=>{
 const a=app();a.ctx.ccSetModo('s','lancamentos');
 a.ctx.ccNavegar('s','tipo','Luz');a.ctx.ccNavegar('s','ano','2025');
 assert.match(a.panel(),/FEV · 02\/2025/);assert.doesNotMatch(a.panel(),/JAN · 01\/2026|MAR · 03\/2026|ABR · 04\/2024/);
 assert.match(a.html(),/1\.000,00/);assert.equal((a.panel().match(/class="cc-month /g)||[]).length,12);
 a.ctx.ccNavegar('s','setor','b');assert.match(a.panel(),/ABR · 04\/2024/);assert.doesNotMatch(a.panel(),/Hospital/);
});
test('filtros e busca recalculam a navegação sem esconder resultados válidos',()=>{
 const a=app();a.filters['cc-filtro-ano']={value:'2024'};a.ctx.renderControleContas('s');assert.match(a.panel(),/Escola/);assert.doesNotMatch(a.panel(),/Hospital/);
 a.filters['cc-filtro-ano'].value='';a.filters['cc-busca']={value:'Hospital'};a.ctx.renderControleContas('s');assert.match(a.panel(),/Hospital/);assert.doesNotMatch(a.panel(),/Escola/);
 a.filters['cc-busca'].value='inexistente';a.ctx.renderControleContas('s');assert.doesNotMatch(a.panel(),/cc-local-card/);
});
test('sem lançamentos ainda permite gerenciar os locais e setores',()=>{
 const a=app();a.S.contas=[];a.ctx.renderControleContas('s');assert.match(a.panel(),/Hospital/);assert.match(a.panel(),/Nenhum lançamento/);
 a.ctx.ccNavegar('s','setor','b');assert.match(a.panel(),/Escola/);
});
test('cada item/local tem sua aba e isola anos, meses e lançamentos',()=>{
 const a=app();a.S.subitems.push({id:'l3',item_id:'a',atividade_id:'s',description:'Posto de Saúde',extra_fields:{}});
 a.S.contas.push({id:'c5',atividade_id:'s',item_id:'a',subitem_id:'l3',tipo:'Luz',mes_ano:'05/2024',valor:50,pago:true},{id:'c6',atividade_id:'s',item_id:'a',subitem_id:'l1',tipo:'Luz',mes_ano:'02/2026',valor:60,pago:false});
 a.ctx.ccSetModo('s','lancamentos');a.ctx.ccNavegar('s','tipo','Luz');a.ctx.ccNavegar('s','ano','2026');a.ctx.ccNavegar('s','mes','2');
 assert.match(a.panel(),/data-cc-level="local" data-cc-value="l1"/);assert.match(a.panel(),/data-cc-level="local" data-cc-value="l3"/);
 assert.match(a.panel(),/FEV · 02\/2026/);assert.doesNotMatch(a.panel(),/JAN · 01\/2026|MAI · 05\/2024|id="cc-local-l3"/);
 a.ctx.ccNavegar('s','local','l3');assert.match(a.panel(),/MAI · 05\/2024/);assert.doesNotMatch(a.panel(),/id="cc-local-l1"|data-cc-level="ano" data-cc-value="2026"/);
});
test('meses vazios ficam selecionáveis e mostram lista vazia sem outros meses',()=>{
 const a=app();a.ctx.ccSetModo('s','lancamentos');a.ctx.ccNavegar('s','tipo','Luz');a.ctx.ccNavegar('s','ano','2026');a.ctx.ccNavegar('s','mes','12');
 assert.match(a.panel(),/data-cc-level="mes" data-cc-value="12" aria-pressed="true"/);
 assert.match(a.panel(),/Nenhum lançamento em DEZ \/ 2026/);assert.doesNotMatch(a.panel(),/JAN · 01\/2026/);
});
test('local sem contas continua acessível mesmo com outros locais preenchidos',()=>{
 const a=app();a.S.subitems.push({id:'vazio',item_id:'a',atividade_id:'s',description:'Novo posto',extra_fields:{}});
 a.ctx.ccSetModo('s','lancamentos');a.ctx.ccNavegar('s','local','vazio');
 assert.match(a.panel(),/id="cc-local-vazio"/);assert.doesNotMatch(a.panel(),/id="cc-local-l1"/);assert.match(a.panel(),/\+ Lançamento/);
});
test('trocar mês restaura rolagem interna, móvel e horizontal sem animação',()=>{
 const a=app();const content={style:{minHeight:''},offsetHeight:1800};
 const main={scrollTop:480,scrollLeft:7,scrollTo(args){this.scrollTop=args.top;this.scrollLeft=args.left;assert.equal(args.behavior,'instant');}};
 let months={scrollLeft:240};const get=a.ctx.document.getElementById;
 a.ctx.document.getElementById=id=>id==='content'?content:get(id);
 a.ctx.document.querySelector=q=>q==='main'?main:q==='.cc-months'?months:null;
 a.ctx.scrollY=330;a.ctx.scrollX=4;a.ctx.scrollTo=args=>{assert.equal(args.behavior,'instant');a.ctx.scrollY=args.top;a.ctx.scrollX=args.left;};
 const render=a.ctx.setC;a.ctx.setC=html=>{render(html);main.scrollTop=0;main.scrollLeft=0;a.ctx.scrollY=0;a.ctx.scrollX=0;months={scrollLeft:0};};
 a.ctx.ccNavegar('s','mes','12');
 assert.equal(main.scrollTop,480);assert.equal(main.scrollLeft,7);assert.equal(a.ctx.scrollY,330);assert.equal(a.ctx.scrollX,4);assert.equal(months.scrollLeft,240);assert.equal(content.style.minHeight,'');
 assert.match(a.panel(),/data-cc-level="mes" data-cc-value="12" aria-pressed="true"/);
});
test('lançamentos não exibem a coluna Situação nem barras e mantêm avisos dos meses',()=>{
 const a=app();a.ctx.ccSetModo('s','lancamentos');assert.doesNotMatch(a.panel(),/Situação|<svg|\d+%/);assert.match(a.panel(),/Sem lançamento/);
 a.ctx.ccNavegar('s','mes','12');assert.match(a.panel(),/colspan="11"/);
});
test('trocar mês atualiza somente a lista e conserva os cards existentes',()=>{
 const a=app();a.S.contas.push({id:'fev',atividade_id:'s',item_id:'a',subitem_id:'l1',tipo:'Luz',mes_ano:'02/2026',valor:70,pago:true});
 a.ctx.ccSetModo('s','lancamentos');a.ctx.ccNavegar('s','tipo','Luz');
 const results={innerHTML:''},cards=['1','2'].map(value=>({dataset:{ccValue:value},classList:{toggle(name,active){this.active=active;}},setAttribute(name,value){this[name]=value;}}));
 const get=a.ctx.document.getElementById;a.ctx.document.getElementById=id=>id==='cc-month-results'?results:get(id);
 a.ctx.document.querySelectorAll=selector=>selector==='[data-cc-level="mes"]'?cards:[];
 a.ctx.setC=()=>assert.fail('Trocar mês não deve substituir o conteúdo da página');
 a.ctx.ccNavegar('s','mes','2');
 assert.match(results.innerHTML,/FEV · 02\/2026/);assert.doesNotMatch(results.innerHTML,/JAN · 01\/2026/);
 assert.equal(cards[0]['aria-pressed'],'false');assert.equal(cards[1]['aria-pressed'],'true');
});
test('total geral do local soma todos os meses e anos sem incluir outros locais',()=>{
 const a=app();a.ctx.ccSetModo('s','lancamentos');a.ctx.ccNavegar('s','tipo','Luz');a.ctx.ccNavegar('s','ano','2026');
 const summary=()=>a.panel().split('<div class="cc-local-summary"')[1].split('<div class="cc-lancamentos">')[0];
 assert.match(summary(),/Total geral: R\$ 600,00/);assert.match(summary(),/Pago: R\$ 100,00/);assert.match(summary(),/Pendente: R\$ 500,00/);
 assert.match(a.panel(),/Total do mês: R\$ 100,00/);
 a.ctx.ccNavegar('s','mes','12');assert.match(summary(),/Total geral: R\$ 600,00/);assert.match(a.panel(),/Total do mês: R\$ 0,00/);
 a.filters['cc-filtro-pago']={value:'pago'};a.ctx.renderControleContas('s');assert.match(summary(),/Total geral: R\$ 600,00/);
 a.filters['cc-filtro-pago'].value='';a.ctx.ccNavegar('s','setor','b');assert.match(summary(),/Total geral: R\$ 400,00/);assert.doesNotMatch(summary(),/600,00/);
});
