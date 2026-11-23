// Topo compacto da planilha de lote + visualizador de imagens (tela cheia, navegação, zoom roda/botões/pinça).
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390|1366 node tests/bulk-topo-viewer.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {atividades: [{id: 'ctlx', name: 'SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA', demanda_secretaria_id: 'gab', controle_pendencias: 1, order_num: 9, extra_fields: {}, created_at: now, updated_at: now}]};
  const {page, errors} = await boot(browser, {width: W, seed, hasTouch: W < 800});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.openBulkEntry('ctlx'));
  await page.waitForSelector('#bulk-new-title'); await page.fill('#bulk-new-title', 'TES');
  await page.getByRole('button', {name: /Criar novo lote/}).click(); await page.waitForSelector('#bulk-grid-head [data-col-key]');
  const m = await page.evaluate(() => {
    const bar = document.querySelector('.bk-bar').getBoundingClientRect(), tools = document.querySelector('.bk-tools').getBoundingClientRect();
    const grid = document.querySelector('.bulk-grid-wrap').getBoundingClientRect(), box = document.querySelector('.bulk-modal-box').getBoundingClientRect();
    const head = document.querySelector('.bulk-modal-box .modal-head');
    const over = [...document.querySelectorAll('.bk-bar *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > box.right + 1 || r.left < box.left - 1); }).map(e => e.className || e.tagName);
    return {top: grid.top - box.top, bar: bar.height, tools: tools.height, headHidden: getComputedStyle(head).display === 'none', over, path: document.querySelector('.bk-path').textContent, title: document.getElementById('bulk-draft-title').value};
  });
  console.log('topo', JSON.stringify(m));
  assert.ok(m.headHidden); assert.deepEqual(m.over, []); assert.equal(m.title, 'TES'); assert.match(m.path, /ÁGUA DE PIPA/);
  assert.ok(m.top <= (W < 800 ? 150 : 100), 'topo compacto: ' + m.top); // antes ~380px
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.bk-bar'))), []);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.bk-tools'))), []);
  // popover de quantidade
  await page.click('#bk-rows-pop > summary'); await page.fill('#bulk-total-count', '20'); await page.getByRole('button', {name: 'Definir'}).click();
  assert.equal(await page.locator('[data-bulk-row]').count(), 20);
  await page.click('.bk-path'); // clique fora do popover fecha
  assert.equal(await page.evaluate(() => document.getElementById('bk-rows-pop').open), false);
  await page.click('.bk-help > summary'); assert.ok(await page.isVisible('.bk-help .bk-pop-body'));
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.bk-help .bk-pop-body'))), []);
  await page.screenshot({path: `/tmp/bulk-topo-${W}.png`});
  await page.click('.bk-x'); await page.waitForFunction(() => document.getElementById('modal-ov').style.display === 'none');

  // ── visualizador ──
  const imgs = await page.evaluate(() => [['#2563eb', 1600, 900], ['#16a34a', 600, 1200], ['#db2777', 1200, 1200]].map(([c, w, h]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(w / 2 - 20, h / 2 - 20, 40, 40); return cv.toDataURL('image/png'); }));
  await page.evaluate(list => { const d = document.createElement('div'); d.className = 'img-section'; d.id = 'tst'; d.innerHTML = list.map((u, i) => `<img alt="Foto ${i + 1}" src="${u}" style="width:40px" onclick="openLb('${u}','DEMANDA PÚBLICA')">`).join(''); document.getElementById('content').prepend(d); }, imgs);
  await page.click('#tst img:nth-child(2)');
  await page.waitForFunction(() => document.getElementById('lightbox').style.display === 'flex' && document.getElementById('lb-img').naturalWidth > 0);
  await page.waitForTimeout(150);
  const fill = () => page.evaluate(() => { const s = document.getElementById('ivw-stage').getBoundingClientRect(), i = document.getElementById('lb-img').getBoundingClientRect(); return {wr: i.width / s.width, hr: i.height / s.height}; });
  let f = await fill(); console.log('aproveitamento', JSON.stringify(f));
  assert.ok(Math.max(f.wr, f.hr) > 0.97, 'imagem usa o máximo da tela');
  assert.equal(await page.textContent('#ivw-count'), '2 / 3');
  assert.equal(await page.textContent('#ivw-title'), 'DEMANDA PÚBLICA');
  assert.equal(await page.locator('.ivw-th').count(), 3);
  // botões de zoom
  await page.click('#ivw-in'); await page.waitForTimeout(260); assert.equal(await page.textContent('#ivw-pct'), '150%');
  await page.click('#ivw-out'); await page.waitForTimeout(260); assert.equal(await page.textContent('#ivw-pct'), '100%');
  // roda do mouse
  if (W >= 800) {
    const s = await page.locator('#ivw-stage').boundingBox();
    await page.mouse.move(s.x + s.width / 2 + 80, s.y + s.height / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(80);
    const pct = parseInt(await page.textContent('#ivw-pct')); assert.ok(pct > 150, 'roda ampliou: ' + pct);
    await page.keyboard.press('0'); await page.waitForTimeout(260);
  }
  // pinça com 2 dedos (eventos de ponteiro touch)
  const pinch = await page.evaluate(async () => {
    const st = document.getElementById('ivw-stage'), r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, id, x, y) => st.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1}));
    ev('pointerdown', 1, cx - 40, cy); ev('pointerdown', 2, cx + 40, cy);
    for (let k = 1; k <= 6; k++) { ev('pointermove', 1, cx - 40 - k * 20, cy); ev('pointermove', 2, cx + 40 + k * 20, cy); }
    ev('pointerup', 1, cx - 160, cy); ev('pointerup', 2, cx + 160, cy);
    return document.getElementById('ivw-pct').textContent;
  });
  console.log('pinça', pinch); assert.ok(parseInt(pinch) >= 250, 'pinça ampliou');
  await page.click('#ivw-pct'); await page.waitForTimeout(260); assert.equal(await page.textContent('#ivw-pct'), '100%');
  // navegação: seta, teclado, miniatura
  await page.click('#ivw-next'); assert.equal(await page.textContent('#ivw-count'), '3 / 3');
  await page.keyboard.press('ArrowRight'); assert.equal(await page.textContent('#ivw-count'), '1 / 3');
  await page.keyboard.press('ArrowLeft'); assert.equal(await page.textContent('#ivw-count'), '3 / 3');
  await page.click('.ivw-th[data-k="0"]'); assert.equal(await page.textContent('#ivw-count'), '1 / 3');
  await page.waitForFunction(() => document.getElementById('lb-img').naturalWidth === 1600); await page.waitForTimeout(100);
  f = await fill(); assert.ok(Math.max(f.wr, f.hr) > 0.97, 'paisagem preenche: ' + JSON.stringify(f));
  // deslizar troca
  await page.evaluate(() => { const st = document.getElementById('ivw-stage'), r = st.getBoundingClientRect(), y = r.top + r.height / 2; const ev = (t, x) => st.dispatchEvent(new PointerEvent(t, {pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true})); ev('pointerdown', r.left + r.width * .8); ev('pointermove', r.left + r.width * .5); ev('pointerup', r.left + r.width * .2); });
  assert.equal(await page.textContent('#ivw-count'), '2 / 3');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.ivw-top'))), []);
  await page.waitForTimeout(400); await page.screenshot({path: `/tmp/viewer-${W}.png`});
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.getElementById('lightbox').style.display), 'none');
  // imagem única: sem setas nem miniaturas
  await page.evaluate(u => window.openLb(u, 'Uma foto'), imgs[0]);
  assert.equal(await page.isVisible('#ivw-next'), false); assert.equal(await page.isVisible('#ivw-strip'), false);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors.filter(e => !/favicon|net::|Failed to load resource/.test(e)), []);
  console.log(`ok - topo do lote compacto + visualizador de imagens (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
