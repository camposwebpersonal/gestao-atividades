// Datas sempre dd/mm/aaaa no site (mesmo com o navegador em inglês): o campo de data ganha uma caixa dd/mm/aaaa
// por cima do campo nativo, que continua guardando AAAA-MM-DD para o resto do código.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/date-br.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W});
  page.setDefaultTimeout(9000);
  assert.equal(await page.evaluate(() => navigator.language.startsWith('pt')), false, 'o teste roda com o navegador em inglês');
  await page.evaluate(() => window.openItemModal(null, 'a2', false, null));
  await page.waitForSelector('#modal-ov .dbr-text[data-dbr-for="it-start"]');
  const txt = '#modal-ov .dbr-text[data-dbr-for="it-start"]';
  assert.equal(await page.getAttribute(txt, 'placeholder'), 'dd/mm/aaaa');
  // digitar só números monta dd/mm/aaaa e o campo nativo guarda AAAA-MM-DD
  await page.click(txt); await page.keyboard.type('20112026');
  assert.equal(await page.inputValue(txt), '20/11/2026');
  assert.equal(await page.evaluate(() => document.getElementById('it-start').value), '2026-11-20');
  // o código que grava .value no campo nativo atualiza a caixa
  await page.evaluate(() => { document.getElementById('it-deadline').value = '2027-01-05'; });
  assert.equal(await page.inputValue('#modal-ov .dbr-text[data-dbr-for="it-deadline"]'), '05/01/2027');
  // tecla H = hoje
  await page.fill('#modal-ov .dbr-text[data-dbr-for="it-deadline"]', ''); await page.focus('#modal-ov .dbr-text[data-dbr-for="it-deadline"]'); await page.keyboard.press('h');
  const today = await page.evaluate(() => { const n = new Date(); return [n.getDate(), n.getMonth() + 1].map(x => String(x).padStart(2, '0')).join('/') + '/' + n.getFullYear(); });
  assert.equal(await page.inputValue('#modal-ov .dbr-text[data-dbr-for="it-deadline"]'), today);
  // data impossível é recusada
  await page.fill(txt, '31/02/2026'); await page.locator(txt).blur();
  assert.equal(await page.evaluate(sel => document.querySelector(sel).classList.contains('dbr-invalid'), txt), true);
  assert.equal(await page.evaluate(() => document.getElementById('it-start').value), '2026-11-20', 'valor anterior mantido');
  // nenhum campo de data visível em mm/dd/yyyy
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('input[type="date"],input[type="datetime-local"]')].filter(e => e.getBoundingClientRect().width > 2 && getComputedStyle(e).opacity !== '0').length), 0);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('modal-ov'))), []);
  await page.screenshot({path: os.tmpdir() + `/date-br-${W}.png`});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - datas em dd/mm/aaaa (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
