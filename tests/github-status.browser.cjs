// Painel de status: seção GitHub (espaço do repositório, publicações, testes) com dados
// simulados da API pública. Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/github-status.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W});
  page.setDefaultTimeout(9000);
  const now = Date.now(), iso = m => new Date(now - m * 60000).toISOString();
  await page.route('https://api.github.com/**', r => {
    const u = r.request().url();
    if (u.includes('/actions/runs')) return r.fulfill({contentType: 'application/json', body: JSON.stringify({workflow_runs: [
      {name: 'Testes automáticos', status: 'completed', conclusion: 'success', created_at: iso(5), updated_at: iso(3)},
      {name: 'pages build and deployment', status: 'completed', conclusion: 'success', created_at: iso(6), updated_at: iso(5)},
      {name: 'pages build and deployment', status: 'completed', conclusion: 'success', created_at: iso(30), updated_at: iso(29)},
      {name: 'pages build and deployment', status: 'completed', conclusion: 'success', created_at: iso(200), updated_at: iso(199)}]})});
    return r.fulfill({contentType: 'application/json', body: JSON.stringify({size: 9789})});
  });
  await page.evaluate(() => { localStorage.removeItem('gestao-github-status-v1'); window.S.statusAccess = [{id: window.S.user.uid, allowed: true}]; window.setView('supabase-status'); });
  await page.waitForSelector('#github-status-body .gh-facts');
  const txt = await page.textContent('#github-status-body');
  assert.match(txt, /9,6 MB|9,56 MB|9.6 MB|MB usados/);
  assert.match(txt, /2\/10/);
  assert.match(txt, /✅ Passaram/); assert.match(txt, /✅ No ar/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('github-status-body'))), []);
  await page.locator('#github-status-body').screenshot({path: os.tmpdir() + `/gh-status-${W}.png`});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - status do GitHub (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
