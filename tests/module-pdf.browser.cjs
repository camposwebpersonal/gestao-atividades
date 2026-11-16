// "PDF do módulo": resumo no topo, colunas só com conteúdo, atrasados, grupos vazios juntos e "Página X de Y".
// Também confere: cadastro reserva herda a permissão do grupo de destino (userCanGroup).
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ node tests/module-pdf.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os');
const {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, ...o});

(async () => {
  if (!process.env.LIBS) { console.log('ok - PDF do módulo (pulado: sem LIBS)'); return; }
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'gf', name: 'VEÍCULOS DA AGRICULTURA', order_num: 1, extra_fields: {modulo: 'frota'}}), row({id: 'gf2', name: 'VEÍCULOS DO GABINETE', order_num: 2, extra_fields: {modulo: 'frota'}}),
      row({id: 'dst', name: 'SOLICITAÇÕES', demanda_secretaria_id: 'gab', extra_fields: {modulo: 'atendimentos'}}), row({id: 'outro', name: 'OUTRO GRUPO', demanda_secretaria_id: 'gab', extra_fields: {modulo: 'atendimentos'}}),
      row({id: 'resv', name: 'RESERVA', demanda_secretaria_id: 'gab', extra_fields: {modulo: 'atendimentos', reserva_destino: 'dst'}})],
    field_templates: ['Placa', 'Motorista', 'Renavam'].map((n, i) => ({id: 'mp' + i, atividade_id: 'gf', scope: 'item', field_name: n, field_type: 'text', order_num: i})),
    items: [row({id: 'mf0', atividade_id: 'gf', description: 'HILUX', concluded: 0, deadline_date: '2099-12-01', responsaveis: 'MARCOS', extra_fields: {Placa: 'PCA-0001', Motorista: 'JOSÉ'}}),
      row({id: 'mf1', atividade_id: 'gf', description: 'CAMINHÃO PIPA', concluded: 1, status: 'concluido', extra_fields: {placa: 'KLM-9087'}}),
      row({id: 'mf2', atividade_id: 'gf', description: 'TRATOR', concluded: 0, deadline_date: '2020-01-01', extra_fields: {}})],
  };
  const {page, errors} = await boot(browser, {width: 1366, seed});
  await page.waitForFunction(() => window.S?.secs?.some(g => g.id === 'gf'));
  await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await page.evaluate(() => window.gerarRelatorioModulo('frota'));
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {b64, name} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + '/modulo-' + Date.now() + '.pdf';
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
  assert.match(name, /^RELATORIO-FROTA-E-VEICULOS-\d{4}-\d{2}-\d{2}\.pdf$/);
  for (const piece of ['GRUPOS', 'LANÇAMENTOS', 'CONCLUÍDOS', 'ATRASADOS', '33% concluído', '3 lançamentos', '1 atrasado', 'Placa', 'Motorista', 'Responsável', 'KLM-9087', 'Atrasado', 'Página 1 de 1', 'Grupos ainda sem lançamentos (1)', 'VEÍCULOS DO GABINETE'])
    assert.ok(text.includes(piece), 'faltou no PDF: ' + piece + '\n' + text);
  assert.ok(!text.includes('Renavam'), 'coluna sem conteúdo não deve aparecer');

  // reserva herda a permissão do destino
  const can = await page.evaluate(() => {
    const S = window.S, wasAdmin = S.isAdmin, old = S.permissoes;
    S.isAdmin = false; S.permissoes = {modulos: {atendimentos: {acesso: true, gerenciar: true, escopo_configurado: true, grupos: {dst: {acesso: true, gerenciar: true}}}}};
    const g = id => S.secs.find(x => x.id === id);
    const out = {reserva: window.userCanGroup(g('resv'), 'editar'), outro: window.userCanGroup(g('outro'), 'acesso')};
    S.isAdmin = wasAdmin; S.permissoes = old; return out;
  });
  assert.deepEqual(can, {reserva: true, outro: false});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log('ok - PDF do módulo e permissão herdada da reserva');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
