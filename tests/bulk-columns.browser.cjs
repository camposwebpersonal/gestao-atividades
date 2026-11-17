// Planilha de lançamentos em lote: mudar a ordem das colunas (arrastar o título, Alt+→ ou painel
// "⇄ Colunas"), sem perder o que foi digitado, e a ordem fica salva para os próximos lotes do grupo.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/bulk-columns.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W});
  page.setDefaultTimeout(9000);
  const heads = () => page.$$eval('#bulk-grid-head [data-col-key]', ths => ths.map(th => th.dataset.colKey));
  await page.evaluate(() => { localStorage.clear(); window.openBulkEntry('a2'); });
  await page.waitForSelector('#bulk-new-title');
  await page.fill('#bulk-new-title', 'LOTE TESTE');
  await page.getByRole('button', {name: /Criar novo lote/}).click();
  await page.waitForSelector('#bulk-grid-head [data-col-key]');
  const before = await heads();
  assert.equal(before[0], 'description');
  // digita algo antes de mexer nas colunas
  await page.fill('[data-row="0"][data-key="description"]', 'SÍTIO JUREMA');
  await page.fill('[data-row="0"][data-key="observacao"]', 'Cisterna vazia');

  // 1) computador: arrastar "Observação" para a 1ª posição; celular: botão ↑ do painel até o topo
  if (W >= 900) {
    const src = page.locator('#bulk-grid-head [data-col-key="observacao"]'), dst = page.locator('#bulk-grid-head [data-col-key="description"]');
    const a = await src.boundingBox(), b = await dst.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 - 40, a.y + a.height / 2, {steps: 4});
    await page.mouse.move(b.x + 6, b.y + b.height / 2, {steps: 8}); await page.mouse.up();
  } else {
    await page.click('#bulk-col-toggle');
    for (let i = 0; i < 8 && (await heads())[0] !== 'observacao'; i++) {
      const idx = (await heads()).indexOf('observacao');
      await page.click(`#bulk-col-panel li:nth-child(${idx + 1}) button[aria-label^="Subir"]`);
    }
    await page.click('#bulk-col-panel .bulk-col-done');
  }
  let now = await heads();
  assert.equal(now[0], 'observacao', now.join(','));
  // valores continuam nas colunas certas
  assert.equal(await page.inputValue('[data-row="0"][data-key="observacao"]'), 'Cisterna vazia');
  assert.equal(await page.inputValue('[data-row="0"][data-key="description"]'), 'SÍTIO JUREMA');
  assert.equal(await page.getAttribute('[data-row="0"][data-key="observacao"]', 'data-col'), '0');

  // 2) teclado: Alt+→ leva "Observação" para a 2ª posição
  await page.focus('#bulk-grid-head [data-col-key="observacao"]'); await page.keyboard.press('Alt+ArrowRight');
  now = await heads(); assert.equal(now[1], 'observacao', now.join(','));

  // 3) painel "⇄ Colunas": descer "Nome" uma posição
  await page.click('#bulk-col-toggle');
  await page.waitForSelector('#bulk-col-panel li');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('bulk-col-panel'))), []);
  await page.locator('#bulk-col-panel').screenshot({path: os.tmpdir() + `/bulk-cols-${W}.png`});
  await page.click('#bulk-col-panel li:nth-child(1) button[aria-label^="Descer"]');
  now = await heads(); assert.deepEqual(now.slice(0, 2), ['observacao', 'description'], now.join(','));
  const saved = now;

  // 4) salvo: um lote NOVO do mesmo grupo abre com a mesma ordem
  await page.waitForTimeout(900);
  assert.deepEqual(await page.evaluate(() => (window.S.secs.find(g => g.id === 'a2').extra_fields || {}).bulk_column_order?.item), saved, 'ordem salva no grupo');
  await page.evaluate(() => window.bulkBackToDrafts());
  await page.waitForSelector('#bulk-new-title');
  await page.fill('#bulk-new-title', 'OUTRO LOTE');
  await page.getByRole('button', {name: /Criar novo lote/}).click();
  await page.waitForSelector('#bulk-grid-head [data-col-key]');
  assert.deepEqual(await heads(), saved, 'novo lote usa a ordem salva');
  // 5) ordem padrão
  await page.click('#bulk-col-toggle');
  await page.getByRole('button', {name: /Ordem padrão/}).click();
  assert.deepEqual(await heads(), before);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - ordem das colunas do lote (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
