import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkColumns,bulkPayloads,normalizeBulkDate} from '../js/bulk-entry-core.js';
import {completedArchiveEntries,renderCompletedArchive} from '../js/completed-archive.js';

test('planilha inclui atendimento e campos personalizados do grupo',()=>{
 globalThis.window={modForSec:()=> 'atendimentos'};
 const columns=bulkColumns({id:'saneamento',extra_fields:{modulo:'atendimentos'}},[
  {scope:'item',field_name:'Localidade',field_type:'text',order_num:0},
  {scope:'item',field_name:'Tipo de serviço',field_type:'checkboxes',options:['Entupido','Estourado','Ligar rede nova','Tampa'],order_num:1},
  {scope:'item',field_name:'Área',field_type:'radio',options:['Urbana','Rural'],order_num:2},
  {scope:'subitem',field_name:'Documento',field_type:'text',order_num:1}
 ]);
 assert.deepEqual(columns.map(column=>column.key),['description','start_date','responsaveis','solicitante','urgencia','prioritario','deadline_date','observacao','ef:Localidade','ef:Tipo de serviço','ef:Área']);
 assert.equal(columns.at(-2).type,'checkboxes');assert.equal(columns.at(-1).type,'radio');
});

test('datas coladas do Brasil e números de data do Excel são normalizados',()=>{
 assert.equal(normalizeBulkDate('07/10/2026'),'2026-10-07');
 assert.equal(normalizeBulkDate('2026-04-03'),'2026-04-03');
 assert.match(normalizeBulkDate('46000'),/^2025-/);
 assert.equal(normalizeBulkDate('31/02/2026'),null);
});

test('cem linhas viram lançamentos completos com secretaria e ordem herdadas',()=>{
 const rows=Array.from({length:100},(_,index)=>({description:`Solicitação ${index+1}`,start_date:'05/04/2026',responsaveis:'Equipe',solicitante:'Morador',urgencia:'amarelo',prioritario:index===0,deadline_date:'10/04/2026',observacao:'', 'ef:Localidade':'Zona rural','ef:Tipo de serviço':['Entupido','Tampa'],'ef:Área':'Rural'}));
 const payloads=bulkPayloads(rows,{id:'saneamento',demanda_secretaria_id:'agricultura'},40,'2026-10-07T12:00:00.000Z');
 assert.equal(payloads.length,100);
 assert.equal(payloads[0].secretaria_id,'agricultura');
 assert.equal(payloads[0].start_date,'2026-04-05');
 assert.equal(payloads[0].order_num,40);
 assert.equal(payloads[99].order_num,139);
 assert.deepEqual(payloads[0].extra_fields,{Localidade:'Zona rural','Tipo de serviço':['Entupido','Tampa'],Área:'Rural',solicitante:'Morador',urgencia:'amarelo',prioritario:true});
});

test('arquivo inclui itens concluídos e subitens concluídos de itens ainda abertos sem duplicar filhos',()=>{
 const items=[{id:'i1',description:'Concluído'},{id:'i2',description:'Em andamento'}];
 const subs=[{id:'s1',item_id:'i1',concluded:1},{id:'s2',item_id:'i2',concluded:1,parent_type:'item',parent_id:'i2'},{id:'s3',item_id:'i2',concluded:1,parent_type:'subitem',parent_id:'s2'}];
 const progress=item=>({pct:item.id==='i1'?100:50});
 const entries=completedArchiveEntries(items,subs,progress);
 assert.deepEqual(entries.map(entry=>entry.record.id),['i1','s2']);
});

test('arquivo agrupa pela data da solicitação e protege o conteúdo exibido',()=>{
 const html=renderCompletedArchive({group:{id:'g1'},items:[{id:'a',description:'<script>abril</script>',start_date:'2026-04-12'},{id:'m',description:'maio',start_date:'2026-05-03'}],subitems:[],progress:()=>({pct:100}),canEdit:false});
 assert.match(html,/maio de 2026/);
 assert.match(html,/abril de 2026/);
 assert.ok(html.indexOf('maio de 2026')<html.indexOf('abril de 2026'));
 assert.doesNotMatch(html,/<script>/);
});
