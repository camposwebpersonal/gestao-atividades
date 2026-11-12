// Mapa no celular: um dedo rola a página (mapa parado), dois dedos mexem no mapa, com aviso.
// No computador o mapa arrasta normal. E o atalho do Mapa geral aparece na Visão geral.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ node tests/map-gestures.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
(async () => {
  const browser = await chromium.launch();
  // celular (toque)
  {
    const {page, errors} = await boot(browser, {width: 390, touch: true});
    page.setDefaultTimeout(9000);
    await page.evaluate(() => window.setView('mod'));
    await page.waitForSelector('.map-shortcut-card');
    const order = await page.evaluate(() => { const c = document.querySelector('.dashboard-field-focus'), m = document.querySelector('.map-shortcut-card'), a = document.querySelector('.secretary-launch-section'); return [c.compareDocumentPosition(m) & 4, m.compareDocumentPosition(a) & 4]; });
    assert.deepEqual(order, [4, 4], 'atalho entre Atalho de campo e Acesso direto');
    assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.map-shortcut-card'))), []);
    await page.locator('.map-shortcut-card').screenshot({path: os.tmpdir() + '/map-card-390.png'});
    await page.click('.map-shortcut-card');
    await page.waitForFunction(() => window.__geoMap && document.querySelector('.geo-coop'));
    assert.equal(await page.evaluate(() => window.__geoMap.dragging.enabled()), false, 'um dedo não arrasta o mapa');
    assert.equal(await page.evaluate(() => window.__geoMap.touchZoom.enabled()), true, 'dois dedos dão zoom/movem');
    assert.match(await page.textContent('.geo-coop-badge'), /dois dedos/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.geo-coop')).touchAction), 'pan-x pan-y');
    // um dedo deslizando sobre o mapa mostra o aviso
    await page.evaluate(() => { const el = document.querySelector('.geo-coop'); const r = el.getBoundingClientRect(); const t = new Touch({identifier: 1, target: el, clientX: r.left + 50, clientY: r.top + 80}); el.dispatchEvent(new TouchEvent('touchmove', {touches: [t], bubbles: true})); });
    assert.equal(await page.evaluate(() => document.querySelector('.geo-coop-hint').classList.contains('is-on')), true);
    await page.screenshot({path: os.tmpdir() + '/map-touch-390.png'});
    assert.deepEqual(errors.filter(e => !/favicon|net::|tile/.test(e)), []);
  }
  // computador (mouse)
  {
    const {page} = await boot(browser, {width: 1366});
    await page.evaluate(() => window.setView('map'));
    await page.waitForFunction(() => window.__geoMap);
    assert.equal(await page.evaluate(() => window.__geoMap.dragging.enabled()), true);
    assert.equal(await page.locator('.geo-coop-badge').count(), 0);
  }
  console.log('ok - gestos do mapa e atalho do mapa');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
