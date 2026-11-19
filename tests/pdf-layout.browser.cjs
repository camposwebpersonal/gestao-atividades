// PDF da atividade: layout escolhido na janela (Paisagem/Retrato, Blocos N por linha, campos em N colunas,
// Tabela) + cabeçalho COMPACTO (título, números e barrinha discreta numa faixa fina — nunca meia folha).
// Também: tabela da tela sem colunas internas (created_by…, item_show_…) e Verba/Doc/Licitação só se o
// grupo marcar.  Uso: python3 -m http.server 8090 e
//   NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=1366 node tests/pdf-layout.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const iso = d => new Date(Date.now() - d * 864e5).toISOString();
const seed = {
  atividades: [{id: 'edu', name: 'EQUIPAMENTOS DA EDUCAÇÃO: ESCOLAS E CRECHES', controle_pendencias: 1, show_verba: 0, show_documentacao: 0, show_licitacao: 0, order_num: 3, extra_fields: {modulo: 'cadastros'}, created_at: iso(30), updated_at: iso(1)}],
  field_templates: ['GESTOR(A)', 'CONTATO', 'LOCALIDADE', 'Conta Contrato'].map((f, i) => ({id: 'ft' + i, atividade_id: 'edu', scope: 'item', field_name: f, field_type: 'text', order_num: i})),
  items: Array.from({length: 12}, (_, i) => ({id: 'e' + i, atividade_id: 'edu', description: 'ESCOLA MUNICIPAL NÚMERO ' + (i + 1), order_num: i, concluded: i < 7 ? 1 : 0, status: i < 7 ? 'concluido' : 'pendente', conclusion_date: iso(5),
    created_by: 'uid-abc', created_by_name: 'Fulano', updated_by: 'uid-def', audit_created_at: iso(3),
    extra_fields: {'GESTOR(A)': 'GESTORA ' + i, CONTATO: '(87)9999-000' + i, LOCALIDADE: 'SÍTIO ' + i, 'Conta Contrato': '31' + (800000 + i), item_show_verba: 0, item_show_documentacao: 1, item_show_licitacao: 0, verba: 0, documentacao: 0}})),
};
async function capturePdf(page, run) {
  await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await run();
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {b64} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + `/pdf-layout-${Date.now()}.pdf`; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  const info = execFileSync('pdfinfo', [file]).toString();
  const [, w, h] = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
  return {file, text: execFileSync('pdftotext', ['-layout', file, '-']).toString(), landscape: Number(w) > Number(h)};
}
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W, seed});
  await page.waitForFunction(() => window.jspdf?.jsPDF?.API?.autoTable, null, {timeout: 15000});

  // Tabela da tela: nada de created_by / audit / item_show_ / verba "0"
  await page.evaluate(() => { localStorage.clear(); window.openActivity('edu'); });
  await page.evaluate(() => { const c = document.getElementById('ativ-table-mode'); if (c && !c.checked) c.click(); });
  await page.waitForSelector('.activity-data-table', {timeout: 8000});
  const heads = await page.$$eval('.activity-data-table thead th', t => t.map(x => x.textContent.trim()));
  for (const bad of ['created_by', 'created_by_name', 'updated_by', 'audit_created_at', 'item_show_verba', 'item_show_documentacao', 'verba', 'documentacao', 'Documentação', 'Verba'])
    assert.ok(!heads.includes(bad), 'coluna interna/desmarcada na tabela: ' + bad);
  assert.ok(heads.includes('Conta Contrato'));

  // Janela do PDF: escolher Paisagem, Blocos, 3 por linha, campos em 2 colunas
  await page.evaluate(() => window.abrirPdfOpts('edu'));
  await page.waitForSelector('#popt-layout .pl-seg');
  for (const [name, v] of [['orientation', 'landscape'], ['layout', 'blocos'], ['perRow', '3'], ['fieldCols', '2']]) await page.click(`#popt-layout .pl-seg[data-name="${name}"] button[data-v="${v}"]`);
  assert.equal(await page.locator('#popt-layout .pl-sheet.is-land').count(), 1, 'miniatura em paisagem');
  assert.equal(await page.locator('#popt-layout .pl-row').first().locator('.pl-b').count(), 3, 'miniatura com 3 blocos por linha');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('popt-layout'))), []);
  await page.screenshot({path: os.tmpdir() + `/pdf-layout-dialog-${W}.png`});
  const a = await capturePdf(page, () => page.evaluate(() => window.confirmarGerarPdf()));
  assert.ok(a.landscape, 'paisagem escolhida');
  assert.match(a.text, /12 itens/); assert.match(a.text, /7 concluídos/); assert.match(a.text, /58% concluído/);
  assert.doesNotMatch(a.text, /ITENS DA ATIVIDADE|Progresso Geral: |Total Itens|Documenta|Verba|created|uid-/);
  assert.match(a.text, /Conta Contrato:\s*31800000/);
  execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '1', a.file, os.tmpdir() + '/pdf-layout-land']);
  // a escolha fica lembrada; Retrato + Tabela
  await page.evaluate(() => window.abrirPdfOpts('edu'));
  assert.equal(await page.locator('#popt-layout .pl-seg[data-name="perRow"] button.on').textContent(), '3', 'lembra a última escolha');
  for (const [name, v] of [['orientation', 'portrait'], ['layout', 'tabela']]) await page.click(`#popt-layout .pl-seg[data-name="${name}"] button[data-v="${v}"]`);
  const b = await capturePdf(page, () => page.evaluate(() => window.confirmarGerarPdf()));
  assert.ok(!b.landscape, 'retrato escolhido');
  assert.match(b.text, /GESTOR\(A\)/); // cabeçalho de coluna da tabela
  execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '1', b.file, os.tmpdir() + '/pdf-layout-port']);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - layout do PDF (paisagem/retrato, blocos/tabela) + cabeçalho compacto (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
