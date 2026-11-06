// Mapa geral → lançamento: nome clicável abre o cadastro; "Ver no grupo" abre o grupo, expande o
// item, rola até o lançamento e o destaca; "Voltar ao mapa" reabre o mapa no mesmo ponto.
// Uso: python3 -m http.server 8090 (na raiz) e NODE_PATH=$(npm root -g) LIBS=…/node_modules/ W=390 node tests/map-focus.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const geo = (lat, lng) => ({latitude: lat, longitude: lng, accuracy: 8, maps_url: `https://www.google.com/maps?q=${lat},${lng}`, captured_at: new Date().toISOString()});
const seed = {subitems: [{id: 's9', item_id: 'i1', atividade_id: 'a1', parent_id: 'i1', parent_type: 'item', description: 'Vistoria do telhado', status: 'pendente', concluded: 0, order_num: 5, extra_fields: {geo_location: geo(-8.0712, -37.2655)}, created_at: new Date().toISOString(), updated_at: new Date().toISOString()}]};

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {seed});
  const openMap = async () => { await page.evaluate(() => window.renderGeneralGeoMap()); await page.waitForSelector('.leaflet-marker-icon'); await page.waitForTimeout(400); };
  await openMap();

  // Lista: nome clicável + botões novos em cada card.
  const card = page.locator('.geo-map-list article[data-geo-key="subitems:s9"]');
  assert.equal(await card.locator('.geo-record-link').count(), 1);
  assert.match(await card.textContent(), /dentro de\s*UBS NOVA SERTÂNIA/);
  for (const label of ['Ver no grupo', 'No mapa', 'Abrir mapa', 'Como chegar', 'Compartilhar']) assert.equal(await card.locator(`text=${label}`).count(), 1, label);
  assert.match(await card.locator('a:has-text("Como chegar")').getAttribute('href'), /maps\/dir\/\?api=1&destination=-8\.0712,-37\.2655/);

  // "No mapa": aproxima e abre o quadro do ponto, com o nome clicável.
  await card.locator('button:has-text("No mapa")').click();
  await page.waitForSelector('.leaflet-popup .geo-record-link');
  assert.match(await page.textContent('.leaflet-popup'), /Vistoria do telhado/);
  assert.equal(await card.evaluate(el => el.classList.contains('is-current')), true);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.geo-map-page'))), [], 'mapa legível');
  await page.waitForTimeout(700);
  await page.screenshot({path: os.tmpdir() + `/map-popup-${W}.png`});

  // Nome no quadro → abre o próprio lançamento.
  await page.click('.leaflet-popup .geo-record-link');
  await page.waitForSelector('#it-name');
  assert.equal(await page.inputValue('#it-name'), 'Vistoria do telhado');
  await page.evaluate(() => window.closeModal ? window.closeModal() : document.querySelector('.modal-overlay')?.remove());
  await page.waitForTimeout(200);

  // "Ver no grupo" → grupo aberto, item pai expandido, subitem destacado e visível.
  await openMap();
  await page.locator('.geo-map-list article[data-geo-key="subitems:s9"] .geo-goto').click();
  await page.waitForSelector('[data-sort-id="s9"].geo-spotlight');
  assert.equal(await page.evaluate(() => document.getElementById('ib-i1').style.display), 'block');
  const inView = await page.evaluate(() => { const r = document.querySelector('[data-sort-id="s9"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => { const r = document.querySelector('[data-sort-id="s9"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) || inView, true, 'lançamento visível na tela');
  assert.ok(await page.isVisible('#geo-back-pill'));
  await page.screenshot({path: os.tmpdir() + `/map-focus-${W}.png`});

  // Item principal pelo quadro do mapa.
  await openMap();
  await page.evaluate(() => window.geoFocusRecord('items', 'i4'));
  await page.waitForSelector('[data-sort-id="i4"].geo-spotlight');

  // Voltar ao mapa → mesmo ponto com o quadro aberto.
  await page.click('#geo-back-pill .geo-back-go');
  await page.waitForSelector('.leaflet-popup');
  assert.match(await page.textContent('.leaflet-popup'), /POVOADO RIACHO DO MEL/);

  await browser.close();
  assert.deepEqual(errors, [], 'erros de JavaScript: ' + errors.join(' | '));
  console.log(`map-focus (${W}px): ok`);
})().catch(e => { console.error(e); process.exit(1); });
