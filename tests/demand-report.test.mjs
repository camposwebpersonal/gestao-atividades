import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemandReportRows,meaningfulExtraFields,reportDateTime} from '../js/demand-report.js';

test('relatório de demandas reúne atendimento, autoria, datas e subitens em ordem',()=>{
  const items=[{id:'i1',description:'Povoado de Carolina',observacao:'Água para as caixas',responsaveis:'Antônio Almeida',urgencia:'vermelho',prioritario:true,solicitante:'Evandro',created_by_name:'Carlos',created_at:'2026-10-06T12:30:00Z',updated_by_name:'Ricardo',updated_at:'2026-10-06T14:00:00Z',extra_fields:{urgencia:'vermelho',prioritario:true,solicitante:'Evandro','Código local':'ABC'}}];
  const subs=[{id:'s1',item_id:'i1',parent_id:'i1',parent_type:'item',description:'Confirmar abastecimento',status:'andamento',order_num:0}];
  const rows=buildDemandReportRows(items,subs,[]);
  assert.equal(rows.length,2);assert.equal(rows[0].requester,'Evandro');assert.equal(rows[0].urgency,'Urgente');assert.equal(rows[0].priority,true);
  assert.equal(rows[0].createdBy,'Carlos');assert.match(rows[0].createdAt,/06\/10\/2026/);assert.equal(rows[0].extra[0].label,'Código Local');
  assert.equal(rows[1].number,'1.1');assert.equal(rows[1].isSubitem,true);assert.equal(rows[1].status,'Em andamento');
});

test('campos técnicos, vazios e padrões sem valor não poluem o relatório',()=>{
  const fields=meaningfulExtraFields({extra_fields:{urgencia:'vermelho',prioritario:true,solicitante:'Pessoa',show_conclusion_date:0,verba:0,documentacao:0,licitacao:0,observacao_interna:'Útil'}});
  assert.deepEqual(fields,[{label:'Observacao Interna',value:'Útil'}]);
  assert.equal(reportDateTime(null),'');
});
