// Campos dos lançamentos e PDFs: só campos reais e preenchidos nos cards (nada de "verba: 0"),
// PDF de atividade com os campos dos itens, PDF de demandas compacto (sem colunas "Atendimento"
// e "Registro"; "Criado por"/"Última edição" só quando marcados) e apagar a geolocalização.
// Uso: python3 -m http.server 8090 (na raiz) e
//      NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=390 node tests/reports-fields.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const iso = d => new Date(Date.now() - d * 864e5).toISOString();

const seed = {
  atividades: [
    {id: 'veic', name: 'VEÍCULOS DA AGRICULTURA', demanda_secretaria_id: 'sec2', order_num: 9, icon: '🚜', extra_fields: {}, created_at: iso(30), updated_at: iso(1)},
    {id: 'sane', name: 'SOLICITAÇÕES DE SANEAMENTO BÁSICO', demanda_secretaria_id: 'sec2', order_num: 10, icon: '🚰', extra_fields: {modulo: 'atendimentos'}, created_at: iso(30), updated_at: iso(1)},
  ],
  field_templates: ['VEÍCULO', 'FABRICANTE', 'ANO', 'PLACA', 'POSSUI EXTINTOR'].map((f, i) => ({id: 'ft' + i, atividade_id: 'veic', scope: 'item', field_name: f, field_type: 'text', order_num: i}))
    .concat(['Assunto', 'Endereco', 'Telefone'].map((f, i) => ({id: 'fs' + i, atividade_id: 'sane', scope: 'item', field_name: f, field_type: 'text', order_num: i}))),
  items: [
    {id: 'v1', atividade_id: 'veic', description: 'PIPA', order_num: 0, concluded: 0, status: 'pendente', conclusion_date: iso(40), extra_fields: JSON.stringify({'VEÍCULO': 'PIPA', FABRICANTE: 'IVECO', ANO: '2019', PLACA: 'SOC5851', 'POSSUI EXTINTOR': 'SIM', show_conclusion_date: 0, item_show_verba: 0, item_show_documentacao: 0, item_show_licitacao: 0}), created_at: iso(20), updated_at: iso(2), created_by_name: 'MICHELINE', updated_by_name: 'MICHELINE'},
    {id: 'v2', atividade_id: 'veic', description: 'TRATOR DE PNEU', order_num: 1, concluded: 0, status: 'pendente', extra_fields: {'VEÍCULO': 'TRATOR', FABRICANTE: 'NEW HOLLAND', ANO: '2015', PLACA: 'PFX1A23', 'POSSUI EXTINTOR': 'SIM', item_show_verba: 0}, created_at: iso(20), updated_at: iso(2)},
    {id: 'v3', atividade_id: 'veic', description: 'MOTONIVELADORA', order_num: 2, concluded: 0, status: 'pendente', observacao: 'Revisão em dezembro', extra_fields: {'VEÍCULO': 'MOTONIVELADORA', FABRICANTE: 'CATERPILLAR', PLACA: 'QXZ9B87', 'POSSUI EXTINTOR': 'SIM', item_show_licitacao: 0}, created_at: iso(20), updated_at: iso(2)},
    ...Array.from({length: 14}, (_, i) => ({id: 'd' + i, atividade_id: 'sane', description: ['Isabel (Bela)', 'Pedido de Moradores', 'Rafael Júnior', 'Lúcia', 'Warla Grasiela'][i % 5] + (i > 4 ? ' ' + i : ''), order_num: i, concluded: i % 4 === 3 ? 1 : 0, status: i % 4 === 3 ? 'concluido' : 'solicitado', conclusion_date: i % 4 === 3 ? iso(3) : null, deadline_date: i % 3 === 0 ? iso(i % 2 ? -5 : 5).slice(0, 10) : null, responsaveis: i % 2 ? 'ADAUTO JR' : 'DANIEL MEDEIROS', secretaria_id: 'sec2', observacao: i === 1 ? 'Obs. aos cuidados de Nego' : '', extra_fields: {urgencia: ['amarelo', 'vermelho', 'verde'][i % 3], prioritario: i % 5 === 4, solicitante: '', Assunto: 'Esgoto ' + ['entupido', 'estourado', 'problema de entupimento'][i % 3], Endereco: 'Rua Santa Águida número ' + (30 + i), Telefone: '87 99124-67' + String(10 + i), show_conclusion_date: 0, item_show_verba: 0}, created_at: iso(60), updated_at: iso(20), created_by_name: null, updated_by_name: 'CARLOS EDNAILTON'})),
  ],
  subitems: [
    {id: 'ds1', item_id: 'd0', atividade_id: 'sane', parent_id: 'd0', parent_type: 'item', description: 'Visita técnica', status: 'solicitado', concluded: 0, order_num: 0, extra_fields: {urgencia: 'amarelo', item_show_verba: 0}, created_at: iso(10), updated_at: iso(5)},
  ],
};

async function capturePdf(page, run) {
  await page.evaluate(() => { window.__pdf = null; const P = window.jspdf.jsPDF; P.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await run();
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {name, b64} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + '/' + name.replace(/[^\w.-]/g, '_');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return {file, text: execFileSync('pdftotext', ['-layout', file, '-']).toString()};
}

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {seed});
  await page.waitForFunction(() => window.jspdf?.jsPDF?.API?.autoTable || window.jspdf?.jsPDF?.prototype?.autoTable, null, {timeout: 15000});

  // 1) Card do veículo: só os campos reais, sem "verba/documentacao/licitacao: 0" nem "Data de Demissão".
  await page.evaluate(() => window.openActivity('veic'));
  await page.waitForSelector('#ib-v1', {state: 'attached'});
  await page.evaluate(() => { document.getElementById('ib-v1').style.display = 'block'; });
  const card = await page.textContent('#ib-v1');
  assert.match(card, /PLACA:\s*SOC5851/); assert.match(card, /FABRICANTE:\s*IVECO/);
  assert.doesNotMatch(card, /verba|documenta|licita|Demiss/i, 'card não pode mostrar campos internos');
  const chipAudit = await page.evaluate(() => window.__contrastAudit(document.getElementById('ib-v1')));
  assert.deepEqual(chipAudit, [], 'etiquetas legíveis');
  await page.screenshot({path: os.tmpdir() + `/rf-card-${W}.png`});

  // 2) PDF da atividade: campos dos itens aparecem; nada de símbolo quebrado.
  const veic = await capturePdf(page, () => page.evaluate(() => window.gerarPdf('veic')));
  assert.match(veic.text, /PLACA:\s*SOC5851/); assert.match(veic.text, /FABRICANTE:\s*NEW HOLLAND/);
  assert.match(veic.text, /Comum a todos os itens:\s*POSSUI EXTINTOR:\s*SIM/, 'valor igual em todos vai para o topo');
  assert.doesNotMatch(veic.text, /£|verba|Demiss|Criado por/i);
  execFileSync('pdftoppm', ['-png', '-r', '70', '-f', '1', '-l', '1', veic.file, os.tmpdir() + '/rf-veic']);

  // 3) Opções do PDF da atividade: campos dos itens listados e marcados; registro desmarcado.
  await page.evaluate(() => window.abrirPdfOpts('veic'));
  const opt = await page.evaluate(() => ({fields: [...document.querySelectorAll('#popt-ef-list input[data-ef]')].map(c => [c.dataset.ef, c.checked]), created: document.getElementById('popt-show-created').checked, updated: document.getElementById('popt-show-updated').checked}));
  assert.deepEqual(opt.fields.map(f => f[0]), ['VEÍCULO', 'FABRICANTE', 'ANO', 'PLACA', 'POSSUI EXTINTOR']);
  assert.ok(opt.fields.every(f => f[1])); assert.equal(opt.created, false); assert.equal(opt.updated, false);
  await page.evaluate(() => window.fecharPdfOpts());

  // 4) PDF de demandas: pergunta as opções (registro desmarcado), sem colunas Atendimento/Registro.
  await page.evaluate(() => { window.__p = window.gerarPdfDemanda('sane'); });
  await page.waitForSelector('#rpt-opts');
  assert.equal(await page.isChecked('#rpt-created'), false); assert.equal(await page.isChecked('#rpt-updated'), false);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('rpt-opts'))), []);
  await page.screenshot({path: os.tmpdir() + `/rf-opts-${W}.png`});
  const dem = await capturePdf(page, () => page.click('#rpt-opts .rpt-go'));
  assert.doesNotMatch(dem.text, /ATENDIMENTO\s+REGISTRO|Criado por|Última edição/);
  assert.match(dem.text, /Assunto:\s*Esgoto/); assert.match(dem.text, /Urgente/); assert.match(dem.text, /Concluído em/);
assert.doesNotMatch(dem.text, /Secretaria:\s*SECRETARIA DE AGRICULTURA/, 'secretaria do grupo não se repete');
  assert.doesNotMatch(dem.text, /£/);
  execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', dem.file, os.tmpdir() + '/rf-dem']);
  const pagesBefore = Number(execFileSync('pdfinfo', [dem.file]).toString().match(/Pages:\s+(\d+)/)[1]);

  // 5) Com "Criado por" e "Última edição" marcados: texto pequeno em cada lançamento.
  await page.evaluate(() => { window.gerarPdfDemanda('sane'); });
  await page.waitForSelector('#rpt-opts'); await page.check('#rpt-created'); await page.check('#rpt-updated');
  const dem2 = await capturePdf(page, () => page.click('#rpt-opts .rpt-go'));
  assert.match(dem2.text, /Criado por não registrado/); assert.match(dem2.text, /Última edição por CARLOS EDNAILTON/);

  // 6) Apagar a geolocalização salva (com desfazer) e gravar sem ela.
  await page.evaluate(() => window.openItemModal('i1', 'a1', false, null));
  await page.waitForSelector('#it-geo-panel .geo-remove');
  await page.click('#it-geo-panel .geo-remove');
  assert.match(await page.textContent('#it-geo-panel'), /Localização apagada/);
  await page.click('#it-geo-panel .geo-undo');
  assert.match(await page.textContent('#it-geo-panel'), /-8\.070000, -37\.260000/);
  await page.click('#it-geo-panel .geo-remove');
  await page.evaluate(() => window.saveItem('i1', 'a1', false, null));
  await page.waitForFunction(() => { const r = window.__fakeDb.items.find(x => x.id === 'i1'); const e = typeof r.extra_fields === 'string' ? JSON.parse(r.extra_fields) : r.extra_fields; return e.geo_location === null; }, null, {timeout: 8000});
  await page.evaluate(() => window.openItemModal('i1', 'a1', false, null));
  await page.waitForSelector('#it-geo-panel');
  assert.match(await page.textContent('#it-geo-panel'), /Nenhuma localização/);

  await browser.close();
  assert.deepEqual(errors, [], 'erros de JavaScript: ' + errors.join(' | '));
  console.log(`reports-fields (${W}px): ok · PDF demandas ${pagesBefore} pág.`);
})().catch(e => { console.error(e); process.exit(1); });
