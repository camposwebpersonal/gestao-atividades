import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkColumns,bulkPayloads,normalizeBulkDate,persistBulkPayloads} from '../js/bulk-entry-core.js';
import {clearCompletedArchiveMonth,completedArchiveEntries,renderCompletedArchive,selectCompletedArchiveMonth} from '../js/completed-archive.js';

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

test('salvamento em lote só confirma depois que o banco devolve todas as linhas',async()=>{
 const payloads=[{id:'a',description:'A'},{id:'b',description:'B'}];
 let requestedSelect='';
 const client={from:table=>({insert:rows=>({select:async columns=>{requestedSelect=columns;assert.equal(table,'items');assert.deepEqual(rows,payloads);return{data:rows,error:null};}})})};
 assert.deepEqual(await persistBulkPayloads(client,payloads),payloads);
 assert.equal(requestedSelect,'*');
 const incomplete={from:()=>({insert:()=>({select:async()=>({data:[payloads[0]],error:null})})})};
 await assert.rejects(()=>persistBulkPayloads(incomplete,payloads),/confirmou 1 de 2/);
});

test('arquivo inclui cada item e subitem concluído sem esconder filhos quando o pai chega a 100%',()=>{
 const items=[{id:'i1',description:'Concluído',concluded:1},{id:'i2',description:'Em andamento'}];
 const subs=[{id:'s1',item_id:'i1',concluded:1},{id:'s2',item_id:'i2',concluded:1,parent_type:'item',parent_id:'i2'},{id:'s3',item_id:'i2',concluded:1,parent_type:'subitem',parent_id:'s2'}];
 const progress=item=>({pct:item.id==='i1'?100:50});
 const entries=completedArchiveEntries(items,subs,progress);
 assert.deepEqual(entries.map(entry=>entry.record.id),['i1','s1','s2','s3']);
});

test('arquivo agrupa pela Data Início e abre o mês em tela própria',()=>{
 const data={group:{id:'g1'},items:[{id:'a',description:'<script>abril</script>',start_date:'2026-04-12',concluded:1},{id:'m',description:'maio',start_date:'2026-05-03',status:'concluído'}],subitems:[],progress:()=>({pct:100}),canEdit:false};
 const html=renderCompletedArchive(data);
 assert.match(html,/>2026</);
 assert.match(html,/>maio</);
 assert.match(html,/>abril</);
 assert.match(html,/ARQUIVO DE CONCLUÍDOS/);
 assert.ok(html.indexOf('maio')<html.indexOf('abril'));
 assert.equal((html.match(/class="completed-month-card/g)||[]).length,2);
 assert.equal((html.match(/class="completed-row"/g)||[]).length,0);
 assert.doesNotMatch(html,/completed-month-screen/);
 assert.match(html,/Abrir mês/);
 assert.doesNotMatch(html,/<details/);
 assert.doesNotMatch(html,/<script>/);
 selectCompletedArchiveMonth('g1','2026-04');
 const detail=renderCompletedArchive(data);
 assert.match(detail,/completed-month-screen/);
 assert.match(detail,/>ABR-2026</);
 assert.equal((detail.match(/class="completed-row"/g)||[]).length,1);
 assert.doesNotMatch(detail,/completed-month-card/);
 clearCompletedArchiveMonth('g1');
});

test('arquivo concluído usa Data Início do item ou subitem, nunca a data da conclusão',()=>{
 const data={
  group:{id:'datas-inicio'},
  items:[
   {id:'pai',description:'Item janeiro',start_date:'2025-01-15',conclusion_date:'2026-10-26',concluded:1},
   {id:'pai-sub',description:'Pai abril',start_date:'2024-04-10'}
  ],
  subitems:[
   {id:'sub-propria',item_id:'pai-sub',description:'Subitem março',start_date:'2023-03-20',conclusion_date:'2026-10-26',concluded:1},
   {id:'sub-herdada',item_id:'pai-sub',description:'Subitem herda abril',conclusion_date:'2026-10-26',concluded:1}
  ],
  progress:()=>({pct:100}),canEdit:false
 };
 const html=renderCompletedArchive(data);
 assert.match(html,/MÊS DA DATA INÍCIO/);
 assert.match(html,/>2025</);assert.match(html,/>janeiro</);
 assert.match(html,/>2024</);assert.match(html,/>abril</);
 assert.match(html,/>2023</);assert.match(html,/>março</);
 assert.doesNotMatch(html,/>2026</);
 selectCompletedArchiveMonth('datas-inicio','2023-03');
 const ownDate=renderCompletedArchive(data);
 assert.match(ownDate,/Subitem março/);assert.doesNotMatch(ownDate,/Subitem herda abril/);
 selectCompletedArchiveMonth('datas-inicio','2024-04');
 const inheritedDate=renderCompletedArchive(data);
 assert.match(inheritedDate,/Subitem herda abril/);assert.doesNotMatch(inheritedDate,/Subitem março/);
 clearCompletedArchiveMonth('datas-inicio');
});
