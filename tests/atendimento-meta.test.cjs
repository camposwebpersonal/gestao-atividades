const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/atendimento-meta.js'),'utf8').replace(/export /g,'');
const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);
test('urgência, prioridade e solicitante são independentes e preservados',()=>{
 const values={'at-urgencia':{value:'vermelho'},'at-prioritario':{checked:true},'at-solicitante':{value:' João '}};
 const data=ctx.readAttendance('at',{getElementById:id=>values[id]});assert.equal(data.urgencia,'vermelho');assert.equal(data.prioritario,true);assert.equal(data.solicitante,'João');
});
test('edição de grupos fora de atendimentos não inventa metadados',()=>{assert.equal(Object.keys(ctx.readAttendance('at',{getElementById:()=>null})).length,0);});
test('validação rejeita cor desconhecida e protege conteúdo do solicitante',()=>{
 const html=ctx.attendanceFields({extra_fields:JSON.stringify({urgencia:'amarelo',solicitante:'<img onerror="alert(1)">',prioritario:true})});
 assert.match(html,/value="amarelo" selected/);assert.match(html,/checked/);assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 const data=ctx.readAttendance('at',{getElementById:id=>id==='at-urgencia'?{value:'azul'}:null});assert.equal(data.urgencia,null);
});
test('cadastros anteriores mostram urgência não informada',()=>{assert.match(ctx.attendanceBadges({}),/Urgência não informada/);});
test('autoria distingue registros antigos e mantém nomes seguros',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../js/autoria.js'),'utf8').replace(/export /g,'');const c={};vm.createContext(c);vm.runInContext(code,c);
 assert.match(c.auditLabel({}),/cadastro anterior/);assert.match(c.auditLabel({created_by_name:'João',updated_by_name:'Pedro'}),/João.*Pedro/);assert.ok(!c.auditLabel({created_by_name:'<script>'}).includes('<script>'));
});
