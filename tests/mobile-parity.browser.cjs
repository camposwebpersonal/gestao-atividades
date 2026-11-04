// O celular mostra nos cards exatamente as mesmas opções do computador
// (Editar, Reabrir, Mover, +Item, +Sub…), em andamento e concluídos.
// Requer: python3 -m http.server 8090 na raiz e Playwright no NODE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
async function actions(width) {
  const browser = await chromium.launch();
  const {page} = await boot(browser, {width});
  const collect = () => page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && +s.opacity > .1; };
    return [...document.querySelectorAll('#content .item-row, #content .sub-row, #content .completed-row')].map(row => {
      const id = row.id || row.querySelector('strong')?.textContent.trim();
      const buttons = [...row.querySelectorAll('button, a, .pring, [onclick]')].filter(el => !el.closest('.item-row,.sub-row,.completed-row') || el.closest('.item-row,.sub-row,.completed-row') === row).filter(visible).map(el => (el.textContent.trim() || el.title || el.className).replace(/\s+/g, ' ').slice(0, 30)).sort();
      return [id, buttons];
    });
  });
  const out = {};
  for (const group of ['a1', 'a2']) {
    await page.evaluate(g => { window.openActivity(g); window.setActivityLane?.(g, 'active'); }, group); await page.waitForTimeout(500);
    out[group + '-andamento'] = await collect();
    await page.evaluate(g => window.setActivityLane?.(g, 'completed'), group); await page.waitForTimeout(400);
    const month = await page.$('.completed-month-card'); if (month) { await month.click(); await page.waitForTimeout(400); }
    out[group + '-concluidos'] = await collect();
    if (width < 900 && group === 'a2') await page.screenshot({path: require('os').tmpdir() + '/concluidos-celular.png', fullPage: false});
  }
  await browser.close();
  return out;
}
(async () => {
  const desktop = await actions(1366), mobile = await actions(390);
  let compared = 0;
  for (const key of Object.keys(desktop)) {
    assert.ok(desktop[key].length, 'sem cards em ' + key);
    assert.deepEqual(mobile[key], desktop[key], 'opções diferentes no celular em ' + key);
    compared += desktop[key].length;
  }
  const completed = desktop['a2-concluidos'].flatMap(([, b]) => b).join(' ');
  assert.match(completed, /Editar/); assert.match(completed, /Reabrir/);
  console.log(`mobile-parity: ok (${compared} cards comparados)`);
})();
