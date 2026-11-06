import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemandRecords, buildDemandReportRows, meaningfulExtraFields, reportDateTime} from '../js/demand-report.js';

test('relatório de demandas: situação em etiquetas, campos preenchidos e subitens em ordem', () => {
  const items = [{id: 'i1', atividade_id: 'g', description: 'Povoado de Carolina', observacao: 'Água para as caixas', responsaveis: 'Antônio Almeida', secretaria_id: 'sec', created_by_name: 'Carlos', created_at: '2026-10-06T12:30:00Z', updated_by_name: 'Ricardo', updated_at: '2026-10-06T14:00:00Z', extra_fields: {urgencia: 'vermelho', prioritario: true, solicitante: 'Evandro', 'Código local': 'ABC', item_show_verba: 0, verba: 0, show_conclusion_date: 0}}];
  const subs = [{id: 's1', item_id: 'i1', parent_id: 'i1', parent_type: 'item', description: 'Confirmar abastecimento', status: 'andamento', order_num: 0, concluded: 1, conclusion_date: '2026-10-08'}];
  const rows = buildDemandRecords(items, subs, {group: {id: 'g', demanda_secretaria_id: 'sec'}, secretarias: [{id: 'sec', name: 'Agricultura'}]});
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].badges.map(b => b.text), ['Urgente', 'Prioritário', 'Pendente']);
  assert.deepEqual(rows[0].fields, [{label: 'Responsável', value: 'Antônio Almeida'}, {label: 'Solicitante', value: 'Evandro'}, {key: 'Código local', label: 'Código local', value: 'ABC'}], 'secretaria igual à do grupo e campos internos não aparecem');
  assert.equal(rows[0].note, 'Água para as caixas');
  assert.equal(rows[0].meta, '', 'registro só aparece quando pedido');
  assert.equal(rows[1].num, '1.1'); assert.equal(rows[1].level, 1);
  assert.deepEqual(rows[1].badges.map(b => b.text), ['Concluído em 08/10/2026']);
  const withMeta = buildDemandRecords(items, [], {showCreated: true, showUpdated: true});
  assert.match(withMeta[0].meta, /Criado por Carlos em 06\/10\/2026/); assert.match(withMeta[0].meta, /Última edição por Ricardo/);
  assert.equal(buildDemandRecords(items, subs, {includeSubitems: false}).length, 1);
  assert.equal(buildDemandReportRows(items, subs)[1].isSubitem, true);
});

test('campos técnicos, vazios e marcações sem valor não poluem o relatório', () => {
  const fields = meaningfulExtraFields({extra_fields: {urgencia: 'vermelho', prioritario: true, solicitante: 'Pessoa', show_conclusion_date: 0, verba: 0, documentacao: 0, licitacao: 0, item_show_verba: 0, geo_location: {latitude: 1}, observacao_interna: 'Útil'}});
  assert.deepEqual(fields, [{label: 'Observacao interna', value: 'Útil'}]);
  assert.equal(reportDateTime(null), '');
});
