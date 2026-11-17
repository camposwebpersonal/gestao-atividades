// Lote em grupo com "Controle de Conclusão": colunas Concluído + Data da conclusão, botão
// "✓ Concluir selecionadas", data preenchida marca concluído sozinha e o envio grava concluded/status/data.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/bulk-conclusion.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {atividades: [{id: 'semctl', name: 'SEM CONTROLE', demanda_secretaria_id: 'gab', controle_pendencias: 0, order_num: 9, extra_fields: {}, created_at: now, updated_at: now}]};
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const keys = () => page.$$eval('#bulk-grid-head [data-col-key]', ths => ths.map(th => th.dataset.colKey));
  const newDraft = async (group, title) => {
    await page.evaluate(g => { window.openBulkEntry(g); }, group);
    await page.waitForSelector('#bulk-new-title'); await page.fill('#bulk-new-title', title);
    await page.getByRole('button', {name: /Criar novo lote/}).click(); await page.waitForSelector('#bulk-grid-head [data-col-key]');
  };
  await page.evaluate(() => localStorage.clear());

  // sem Controle de Conclusão: nada muda
  await newDraft('semctl', 'SEM');
  assert.ok(!(await keys()).includes('concluido'));
  assert.equal(await page.$('.bulk-done-button'), null);
  await page.evaluate(() => window.closeModal());

  // com Controle de Conclusão (a2)
  await page.evaluate(() => { window.__sent = null; window.__bulkDraftApi = {...(window.__bulkDraftApi || {}), submit: async (_id, payloads) => { window.__sent = payloads; return payloads.map(({conclusion_date, ...p}) => p); }}; });
  await newDraft('a2', 'COM');
  const k = await keys();
  assert.ok(k.includes('concluido') && k.includes('conclusion_date'), k.join(','));
  for (const [i, name] of ['SÍTIO A', 'SÍTIO B', 'SÍTIO C', 'SÍTIO D'].entries()) await page.fill(`[data-row="${i}"][data-key="description"]`, name);
  // linha 0: marca a caixa
  await page.check('[data-row="0"][data-key="concluido"]');
  // linha 1: só a data -> marca sozinho
  await page.fill('[data-row="1"][data-key="conclusion_date"]', '10/11/2026');
  await page.press('[data-row="1"][data-key="conclusion_date"]', 'Tab');
  assert.equal(await page.isChecked('[data-row="1"][data-key="concluido"]'), true, 'data de conclusão marca concluído');
  // linhas 2-3: seleção + "Concluir selecionadas"
  const col = await page.getAttribute('[data-row="2"][data-key="description"]', 'data-col');
  await page.click('[data-row="2"][data-key="description"]');
  await page.click('[data-row="3"][data-key="description"]', {modifiers: ['Shift']});
  await page.click('.bulk-done-button');
  assert.equal(await page.isChecked('[data-row="2"][data-key="concluido"]'), true);
  assert.equal(await page.isChecked('[data-row="3"][data-key="concluido"]'), true);
  // clicar de novo desmarca a seleção
  await page.click('.bulk-done-button');
  assert.equal(await page.isChecked('[data-row="3"][data-key="concluido"]'), false);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.bulk-toolbar'))), []);

  await page.evaluate(() => window.saveBulkEntries());
  await page.waitForFunction(() => window.__sent);
  const sent = await page.evaluate(() => window.__sent.map(p => ({d: p.description, c: p.concluded, s: p.status, date: p.conclusion_date || null})));
  assert.equal(sent[0].c, 1); assert.equal(sent[0].s, 'concluido'); assert.match(sent[0].date, /^\d{4}-\d{2}-\d{2}T12:00:00-03:00$/);
  assert.deepEqual(sent[1], {d: 'SÍTIO B', c: 1, s: 'concluido', date: '2026-11-10T12:00:00-03:00'});
  assert.deepEqual(sent.slice(2).map(x => [x.c, x.s, x.date]), [[0, 'pendente', null], [0, 'pendente', null]]);
  assert.ok(col);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - lote com controle de conclusão (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
