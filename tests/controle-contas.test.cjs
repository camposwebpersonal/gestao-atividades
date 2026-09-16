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
 const ctx={console,S,curSecId:null,setTimeout,clearTimeout,requestAnimationFrame:f=>f(),document:{getElementById:id=>filters[id]||null,querySelectorAll:()=>[],querySelector:()=>null},setC:h=>html=h};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/controle-contas.js'),'utf8'),ctx);
 return {ctx,S,filters,panel:()=>html.split('<section class="cc-workspace-panel"').at(-1),html:()=>html};
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
