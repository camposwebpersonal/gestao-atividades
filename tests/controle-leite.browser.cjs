// Recebimento de Leite (CEDOCA): produtores do cadastro, planilha produtor × dia, semana/quinzena/mês,
// ranking, lançamento do dia (Enter passa, total ao vivo), PDF do período, recibos e contraste.
//   python3 -m http.server 8090 ; NODE_PATH=$(npm root -g) LIBS=…/node_modules/ W=1366 node tests/controle-leite.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const P = 'prod-leite';
const dia = (d, ent, extra = {}) => row({id: 'leite-dia-' + d, atividade_id: 'leite', description: 'Recebimento ' + d, start_date: d, extra_fields: {Data: d, 'Preço por litro': 3.69, leite_entregas: ent, ...extra}});
const seed = {
  secretarias: [row({id: 'sec-cedoca', name: 'CEDOCA'})],
  atividades: [
    row({id: P, name: 'PRODUTORES DE LEITE DE CABRA', extra_fields: {modulo: 'atendimentos', cadastro_leite: 1}, demanda_secretaria_id: 'sec-cedoca'}),
    row({id: 'leite', name: 'RECEBIMENTO DE LEITE', demanda_secretaria_id: 'sec-cedoca', extra_fields: {modulo: 'atendimentos', controle_leite: 1, produtores_grupo: P, leite_precos: {'2026-11-1': 3.69, '2026-11-2': 3.69}, leite_cotas: {'2026-11-1': 300}}}),
  ],
  items: [
    row({id: 'p1', atividade_id: P, description: 'Adriana Helena da Silva', order_num: 1, extra_fields: {'Nº': '1', 'Situação': 'Ativo', 'Chave PIX': '(87) 99999-0000'}}),
    row({id: 'p2', atividade_id: P, description: 'Amauri Severino da Silva', order_num: 2, extra_fields: {'Nº': '2', 'Situação': 'Ativo', 'Referência / responsável': 'Givaldo'}}),
    row({id: 'p3', atividade_id: P, description: 'Edenilton', order_num: 51, extra_fields: {'Nº': '51', 'Situação': 'Ativo'}}),
    row({id: 'p4', atividade_id: P, description: 'Produtor Parado', order_num: 9, extra_fields: {'Nº': '9', 'Situação': 'Ativo'}}),
    dia('2026-11-02', {p1: 40, p2: 20.5, p3: 100}),
    dia('2026-11-03', {p1: 30, p3: 50.5}, {'Resfriador (L)': 900}),
    dia('2026-11-16', {p1: 10, p2: 10}),
    dia('2026-10-27', {p1: 77}, {'Preço por litro': 3.51}),
  ],
};
async function capturePdf(page, run, tag) {
  await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await run();
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {b64, name} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + `/leite-${tag}-${W}.pdf`; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return {file, name, text: execFileSync('pdftotext', ['-layout', file, '-']).toString()};
}
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W, seed});
  await page.evaluate(() => { window.openActivity('leite'); window.ltSet('leite', 'anchor', '2026-11-05'); });
  await page.waitForSelector('.lt-mx');
  const txt = (await page.textContent('#content')).replace(/\s+/g, ' ');
  assert.match(txt, /1ª QUINZENA DE NOVEMBRO 2026/);
  assert.match(txt, /241 L/, 'total da quinzena (40+20,5+100+30+50,5)');
  assert.match(txt, /3\/4/, 'produtores que entregaram de ativos');
  assert.match(txt, /Cota da quinzena: 241 de 300 L/);
  assert.match(txt, /Edenilton/); assert.match(txt, /Resfriador/);
  assert.equal(await page.locator('.lt-mx tbody tr').count(), 4, 'ativos aparecem mesmo sem entrega');
  assert.match(await page.textContent('.lt-mx tfoot'), /241/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  await page.screenshot({path: os.tmpdir() + `/leite-${W}.png`, fullPage: true});
  // Mês: colunas por semana + quinzenas
  await page.click('.lt-seg:has-text("Mês")'); await page.waitForSelector('.lt-mx th.q');
  assert.match(await page.textContent('.lt-mx thead'), /1ª quinz\..*2ª quinz\./s);
  assert.match(await page.textContent('.lt-mx tfoot'), /261/, 'total do mês');
  // Semana e navegação
  await page.click('.lt-seg:has-text("Semana")');
  assert.match(await page.textContent('.lt-nav b'), /SEMANA DE 02\/11\/2026 A 08\/11\/2026/);
  await page.click('.lt-nav button[aria-label="Período anterior"]');
  assert.match(await page.textContent('.lt-nav b'), /26\/10\/2026/);
  assert.match(await page.textContent('.lt-kpis'), /77 L/);
  await page.click('.lt-seg:has-text("Quinzena")'); await page.evaluate(() => window.ltSet('leite', 'anchor', '2026-11-05'));
  // Ranking
  await page.click('.lt-tab:has-text("Por produtor")'); await page.waitForSelector('.lt-rank-row');
  assert.match(await page.locator('.lt-rank-row').first().textContent(), /Edenilton.*150,5 L/s, 'maior produtor primeiro');
  assert.match(await page.textContent('.lt-rank'), /nunca entregou/);
  await page.click('.lt-tab:has-text("Por dia")'); await page.waitForSelector('.lt-day');
  assert.equal(await page.locator('.lt-day').count(), 2);
  // Lançar: Enter passa para o próximo, total ao vivo
  await page.click('.lt-primary'); await page.waitForSelector('.lt-q');
  await page.fill('#lt-data', '2026-11-05'); await page.dispatchEvent('#lt-data', 'change');
  await page.fill('.lt-q[data-pid="p1"]', '12,5'); await page.press('.lt-q[data-pid="p1"]', 'Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.pid), 'p2', 'Enter passa para o próximo produtor');
  await page.keyboard.type('7');
  assert.match(await page.textContent('#lt-sum'), /19,5 L/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('modal-ov'))), []);
  await page.screenshot({path: os.tmpdir() + `/leite-form-${W}.png`});
  await page.click('.modal-actions .btn-save');
  await page.waitForFunction(() => S.items.some(i => i.atividade_id === 'leite' && (i.extra_fields || {}).Data === '2026-11-05'), null, {timeout: 8000});
  const saved = await page.evaluate(() => S.items.find(i => i.atividade_id === 'leite' && (i.extra_fields || {}).Data === '2026-11-05'));
  assert.deepEqual(saved.extra_fields.leite_entregas, {p1: 12.5, p2: 7});
  assert.match(await page.textContent('.lt-kpis'), /260,5 L/, 'novo total na tela');
  // PDF do período e recibos
  const pdf = await capturePdf(page, () => page.evaluate(() => window.ltPdf('leite')), 'q');
  assert.match(pdf.text, /RECEBIMENTO DE LEITE/); assert.match(pdf.text, /Edenilton/); assert.match(pdf.text, /TOTAL/); assert.match(pdf.text, /Página 1 de 1/);
  assert.match(pdf.text, /Sem entrega no período \(Nº\): 9/);
  const rec = await capturePdf(page, () => page.evaluate(() => window.ltRecibos('leite')), 'r');
  assert.match(rec.text, /RECIBO DE ENTREGA DE LEITE/); assert.match(rec.text, /\(87\) 99999-0000/); assert.match(rec.text, /Página 2 de 2/, '3 recibos = 2 folhas');
  // tabela comum nunca mostra as chaves internas
  assert.ok(!(await page.textContent('#content')).includes('leite_entregas'));
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - recebimento de leite (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
