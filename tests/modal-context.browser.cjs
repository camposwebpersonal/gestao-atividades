// Topo fixo das janelas de edição: nome do lançamento (atualiza ao digitar) e
// Secretaria › Grupo › Item pai, visíveis mesmo rolando até o fim do formulário.
// Uso: python3 -m http.server 8090 (na raiz) e NODE_PATH=$(npm root -g) W=390 node tests/modal-context.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser);
  const ctx = () => page.evaluate(() => ({name: document.querySelector('#modal-ctx .modal-ctx-name')?.textContent, path: [...document.querySelectorAll('#modal-ctx .modal-ctx-crumb')].map(c => c.textContent.trim())}));

  // Item: nome + secretaria + grupo.
  await page.evaluate(() => window.openItemModal('i1', 'a1', false, null));
  await page.waitForSelector('#modal-ctx .modal-ctx-name');
  let c = await ctx();
  assert.equal(c.name, 'UBS NOVA SERTÂNIA — TROCA DO TELHADO');
  assert.deepEqual(c.path, ['🏛️SECRETARIA DE SAÚDE', '📁MANUTENÇÃO DE UBS']);
  // Digitar o nome atualiza o topo.
  await page.fill('#it-name', 'UBS NOVA SERTÂNIA — TELHADO E CALHAS');
  assert.equal((await ctx()).name, 'UBS NOVA SERTÂNIA — TELHADO E CALHAS');
  // Rolando até o fim, o topo continua visível.
  await page.evaluate(() => { const box = document.querySelector('#modal-ov .modal-box'); box.scrollTop = box.scrollHeight; });
  await page.waitForTimeout(150);
  const visible = await page.evaluate(() => { const r = document.getElementById('modal-ctx').getBoundingClientRect(), b = document.querySelector('#modal-ov .modal-box').getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom && r.height > 20; });
  assert.equal(visible, true, 'topo visível depois de rolar');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#modal-ov .modal-head'))), []);
  await page.screenshot({path: os.tmpdir() + `/modal-ctx-${W}.png`});
  await page.evaluate(() => window.closeModal());

  // Sub-item: mostra também o item onde ele está.
  await page.evaluate(() => window.openItemModal('s1', 'a1', true, 'i1'));
  await page.waitForSelector('#modal-ctx .modal-ctx-name');
  c = await ctx();
  assert.equal(c.name, 'Comprar telhas');
  assert.deepEqual(c.path, ['🏛️SECRETARIA DE SAÚDE', '📁MANUTENÇÃO DE UBS', '↳UBS NOVA SERTÂNIA — TROCA DO TELHADO']);
  await page.evaluate(() => window.closeModal());

  // Novo item: aviso "Novo item" até digitar.
  await page.evaluate(() => window.openItemModal(null, 'a2', false, null));
  await page.waitForSelector('#modal-ctx .modal-ctx-name');
  assert.equal((await ctx()).name, 'Novo item');
  await page.fill('#it-name', 'Sítio Lagoa');
  assert.equal((await ctx()).name, 'Sítio Lagoa');
  await page.evaluate(() => window.closeModal());

  // Janelas que não são de lançamento não ganham faixa.
  await page.evaluate(() => window.openModal('Autoria dos registros', 'Quem criou', '<p>x</p>'));
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.getElementById('modal-ctx')?.hidden !== false), true);

  await browser.close();
  assert.deepEqual(errors, [], 'erros de JavaScript: ' + errors.join(' | '));
  console.log(`modal-context (${W}px): ok`);
})().catch(e => { console.error(e); process.exit(1); });
