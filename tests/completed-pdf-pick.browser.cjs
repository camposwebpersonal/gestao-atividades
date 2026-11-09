// Concluídos do mês: o nome abre/fecha um card com os campos preenchidos (expandir todos, busca).
// PDF: escolher em andamento / concluídos / um a um (caixinhas começam desmarcadas).
// Uso: python3 -m http.server 8090 (na raiz) e NODE_PATH=$(npm root -g) LIBS=…/node_modules/ W=390 node tests/completed-pdf-pick.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const person = (id, name, done, extra = {}) => ({id, atividade_id: 'mcmv', description: name, order_num: Number(id.slice(1)), concluded: done ? 1 : 0, status: done ? 'concluido' : 'pendente', start_date: '2026-08-10', conclusion_date: done ? '2026-08-23' : null, responsaveis: 'MICHELINE', extra_fields: {CPF: '000.000.000-0' + id.slice(1), 'Endereço': 'Rua das Flores, ' + id.slice(1), item_show_verba: 0, ...extra}, created_at: now, updated_at: now, updated_by_name: 'MICHELINE'});
const seed = {
  atividades: [{id: 'mcmv', name: 'BENEFICIÁRIOS MINHA CASA MINHA VIDA-GOVERNO FEDERAL', demanda_secretaria_id: 'sec1', order_num: 20, icon: '🏠', controle_pendencias: 1, extra_fields: {}, created_at: now, updated_at: now}],
  field_templates: [{id: 'fm1', atividade_id: 'mcmv', scope: 'item', field_name: 'CPF', field_type: 'text', order_num: 0}, {id: 'fm2', atividade_id: 'mcmv', scope: 'item', field_name: 'Endereço', field_type: 'text', order_num: 1}],
  items: [
    person('m1', 'ELENILDO MAGALHÃES ROCHA', true, {geo_location: {latitude: -8.07, longitude: -37.26, maps_url: 'https://www.google.com/maps?q=-8.07,-37.26'}}),
    person('m2', 'CÍCERA MARIA DA SILVA MELO', true),
    person('m3', 'YASMIM JULLY PEREIRA DE ALBUQUERQUE', true),
    person('m4', 'JOSÉ CARLOS SEVERINO (EM ANÁLISE)', false),
    person('m5', 'MARIA ENILDA DE SOUZA (EM ANÁLISE)', false),
  ],
};

async function capturePdf(page, run) {
  await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await run();
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {b64} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + '/pick-' + Date.now() + '.pdf';
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return {file, text: execFileSync('pdftotext', ['-layout', file, '-']).toString()};
}

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {seed});
  await page.waitForFunction(() => window.jspdf?.jsPDF?.API?.autoTable, null, {timeout: 15000});

  // Concluídos do mês.
  await page.evaluate(() => { window.openActivity('mcmv'); window.setActivityLane('mcmv', 'completed'); window.setCompletedArchiveMonth('mcmv', '2026-08'); });
  await page.waitForSelector('.completed-month-screen .cr-card');
  assert.equal(await page.locator('.cr-card').count(), 3);
  const card = page.locator('.cr-card[data-cr="m1"]');
  assert.equal(await card.locator('.cr-details').isHidden(), true, 'começa recolhido');
  assert.match(await card.locator('.cr-toggle').textContent(), /2 campos/);
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; }); }); await card.locator('.cr-toggle').click();
  assert.equal(await card.locator('.cr-details').isVisible(), true, 'abre ao clicar no nome');
  const details = await card.locator('.cr-details').textContent();
  assert.match(details, /CPF:\s*000\.000\.000-01/); assert.match(details, /Endereço:\s*Rua das Flores, 1/); assert.match(details, /Conclusão\s*23\/08\/2026/);
  assert.doesNotMatch(details, /verba/i);
  assert.equal(await card.locator('.cr-map').count(), 1, 'atalho para o mapa quando tem localização');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.completed-month-screen'))), [], 'legível');
  await page.screenshot({path: os.tmpdir() + `/completed-open-${W}.png`});
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; }); }); await card.locator('.cr-toggle').click();
  assert.equal(await card.locator('.cr-details').isHidden(), true, 'recolhe ao clicar de novo');
  // Expandir/recolher todos e busca no mês.
  await page.click('.cr-tools button');
  assert.equal(await page.locator('.cr-details:visible').count(), 3);
  await page.click('.cr-tools button');
  assert.equal(await page.locator('.cr-details:visible').count(), 0);
  await page.fill('.cr-search', 'albuquerque');
  assert.equal(await page.locator('.cr-card:visible').count(), 1);
  await page.fill('.cr-search', '');

  // PDF: só concluídos.
  await page.evaluate(() => window.abrirPdfOpts('mcmv'));
  await page.waitForSelector('#popt-pick .pdf-pick-scope');
  assert.match(await page.textContent('#popt-pick .pdf-pick-scope'), /Todos\s*5.*Só em andamento\s*2.*Só concluídos\s*3/s);
  await page.check('#popt-pick input[value="concluidos"]');
  let pdf = await capturePdf(page, () => page.evaluate(() => window.confirmarGerarPdf()));
  assert.match(pdf.text, /ELENILDO/); assert.match(pdf.text, /YASMIM/); assert.doesNotMatch(pdf.text, /EM ANÁLISE/);

  // PDF: escolha um a um — tudo começa desmarcado; sem nada marcado não gera.
  await page.evaluate(() => window.abrirPdfOpts('mcmv'));
  await page.waitForSelector('#popt-pick .pdf-pick-enable');
  await page.check('#popt-pick .pdf-pick-enable');
  assert.equal(await page.isVisible('#popt-pick .pdf-pick-list'), true);
  assert.equal(await page.locator('#popt-pick .pdf-pick-row input:checked').count(), 0, 'todas desmarcadas');
  assert.equal(await page.locator('#popt-pick .pdf-pick-row').count(), 5);
  await page.evaluate(() => window.confirmarGerarPdf());
  assert.match(await page.locator('.toast-item').last().textContent(), /Marque pelo menos um lançamento/);
  await page.fill('#popt-pick .pdf-pick-search', 'cícera');
  assert.equal(await page.locator('#popt-pick .pdf-pick-row:visible').count(), 1);
  await page.click('#popt-pick [data-mark="visiveis"]');
  await page.fill('#popt-pick .pdf-pick-search', '');
  await page.check('#popt-pick .pdf-pick-row[data-id="m4"] input');
  assert.match(await page.textContent('#popt-pick .pdf-pick-count'), /2 lançamentos selecionados/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('popt-pick'))), [], 'seletor legível');
  await page.screenshot({path: os.tmpdir() + `/pdf-pick-${W}.png`});
  pdf = await capturePdf(page, () => page.evaluate(() => window.confirmarGerarPdf()));
  assert.match(pdf.text, /CÍCERA/); assert.match(pdf.text, /JOSÉ CARLOS/);
  assert.doesNotMatch(pdf.text, /ELENILDO|YASMIM|MARIA ENILDA/);
  assert.equal(await page.evaluate(() => window.S.items.filter(i => i.atividade_id === 'mcmv').length), 5, 'dados da tela intactos depois do PDF');
  // Seleção anterior fica disponível (sem vir marcada).
  await page.evaluate(() => window.abrirPdfOpts('mcmv'));
  await page.check('#popt-pick .pdf-pick-enable');
  assert.equal(await page.locator('#popt-pick .pdf-pick-row input:checked').count(), 0);
  await page.click('#popt-pick [data-previous]');
  assert.equal(await page.locator('#popt-pick .pdf-pick-row input:checked').count(), 2);
  await page.evaluate(() => window.fecharPdfOpts());

  await browser.close();
  assert.deepEqual(errors, [], 'erros de JavaScript: ' + errors.join(' | '));
  console.log(`completed-pdf-pick (${W}px): ok`);
})().catch(e => { console.error(e); process.exit(1); });
