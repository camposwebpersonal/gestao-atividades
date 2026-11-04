// Vários lançamentos viram subitens (botão e arrastando a seleção), subitens em lote
// dentro de um item e aplicação/famílias do pipa. Roda o app real com Supabase simulado.
// Requer: python3 -m http.server 8090 na raiz e Playwright no NODE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser);
  page.on('dialog', d => d.accept());
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fakeDb)));
  const out = {};
  // 1) Botão "Tornar subitens": JANDSON e LUCIA viram subitens da UBS NOVA SERTÂNIA (i1)
  await page.evaluate(() => window.openActivity('a1')); await page.waitForSelector('#ir-i6');
  await page.check('.mass-sel[data-id="i6"]'); await page.check('.mass-sel[data-id="i7"]');
  await page.click('.nest-selected-btn');
  await page.waitForSelector('#nest-picker-list');
  await page.fill('#nest-picker-q', 'nova sert');
  out.opcoesFiltradas = await page.locator('#nest-picker-list>button:not([hidden])').count();
  await page.click('#nest-picker-list>button:not([hidden])');
  await page.waitForFunction(() => !window.__fakeDb.items.some(i => i.id === 'i6'), null, {timeout: 8000});
  let d = await db();
  const jandson = d.subitems.find(s => s.description === 'JANDSON');
  const jx = jandson && (typeof jandson.extra_fields === 'string' ? JSON.parse(jandson.extra_fields) : jandson.extra_fields || {});
  out.jandson = jandson && {item_id: jandson.item_id, parent_type: jandson.parent_type, geo: !!jx.geo_location, tel: jx.Telefone};
  out.netoReligado = d.subitems.find(s => s.id === 's6');
  out.foto = d.entity_images.find(i => i.id === 'img6');
  out.lucia = d.subitems.some(s => s.description === 'LUCIA' && s.item_id === 'i1');
  // 2) Desfazer devolve os itens com o mesmo id
  await page.evaluate(() => window.undoLast());
  await page.waitForFunction(() => window.__fakeDb.items.some(i => i.id === 'i6'), null, {timeout: 8000});
  d = await db();
  out.desfeito = {i6: d.items.some(i => i.id === 'i6'), semCopia: !d.subitems.some(s => s.description === 'JANDSON'), fotoVoltou: d.entity_images.find(i => i.id === 'img6').entity_type, filho: d.subitems.find(s => s.id === 's6').item_id};
  // 3) Arrastar a seleção (MARIA e CARLOS) sobre o item UBS NOVA SERTÂNIA (i1)
  await page.evaluate(() => window.openActivity('a1')); await page.waitForSelector('#ir-i8');
  await page.check('.mass-sel[data-id="i8"]'); await page.check('.mass-sel[data-id="i9"]');
  await page.dragAndDrop('#ir-i8', '#ir-i1');
  await page.waitForFunction(() => !window.__fakeDb.items.some(i => i.id === 'i8' || i.id === 'i9'), null, {timeout: 8000});
  d = await db();
  out.arrastados = d.subitems.filter(s => s.item_id === 'i1' && /MARIA|CARLOS/.test(s.description)).map(s => s.description).sort();
  // 4) Subitens em lote dentro de um item
  await page.evaluate(() => window.openBulkEntry('a1', 'i1'));
  await page.waitForSelector('#bulk-new-target');
  out.preselecionado = await page.$eval('#bulk-new-target', el => el.value);
  await page.fill('#bulk-new-title', 'LOTE DE SUBITENS');
  await page.click('.bulk-new-draft .btn-save');
  await page.waitForSelector('#bulk-target-select');
  out.bannerSub = await page.textContent('.bulk-target');
  await page.fill('[data-row="0"][data-key="description"]', 'Telha quebrada sala 1');
  await page.fill('[data-row="1"][data-key="description"]', 'Telha quebrada sala 2');
  await page.click('#bulk-save');
  await page.waitForFunction(() => window.__fakeDb.subitems.filter(s => s.item_id === 'i1' && /Telha quebrada/.test(s.description)).length === 2, null, {timeout: 8000});
  d = await db();
  out.lote = d.subitems.filter(s => /Telha quebrada/.test(s.description)).map(s => ({item_id: s.item_id, parent_type: s.parent_type}));
  out.rascunhoRemovido = d.bulk_entry_drafts.length === 0;
  // 5) Pipa: parcial ½ e 4 famílias
  await page.evaluate(() => { window.closeModal?.(); window.openItemModal('i3','a2',false); });
  await page.waitForSelector('input[name="it-pipa-apply"][value="parcial"]');
  await page.check('input[name="it-pipa-apply"][value="parcial"]');
  out.parcialVisivel = await page.isVisible('#it-pipa-partial');
  out.percentAuto = await page.inputValue('#it-pipa-percent');
  await page.fill('#it-pipa-families', '4');
  out.previa = await page.textContent('#it-pipa-preview');
  out.contraste = await page.evaluate(() => window.__contrastAudit(document.querySelector('.modal-box')));
  await page.screenshot({path: require('os').tmpdir() + '/pipa-form.png', fullPage: false});
  await page.locator('#it-pipa-box').screenshot({path: require('os').tmpdir() + '/pipa-box.png'});
  await page.click('.modal-actions .btn-save');
  await page.waitForFunction(() => { const i = window.__fakeDb.items.find(x => x.id === 'i3'); const e = typeof i.extra_fields === 'string' ? JSON.parse(i.extra_fields) : i.extra_fields; return e?.pipa_families === 4; }, null, {timeout: 8000});
  d = await db();
  const ex = d.items.find(i => i.id === 'i3').extra_fields; out.pipa = typeof ex === 'string' ? JSON.parse(ex) : ex;
  out.erros = errors.filter(e => !/_leaflet_pos/.test(e));
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  assert.equal(out.opcoesFiltradas, 1);
  assert.deepEqual(out.jandson, {item_id: 'i1', parent_type: 'item', geo: true, tel: '(87) 98888-0000'});
  assert.equal(out.netoReligado.item_id, 'i1'); assert.equal(out.netoReligado.parent_type, 'subitem');
  assert.equal(out.foto.entity_type, 'subitem');
  assert.equal(out.lucia, true);
  assert.deepEqual(out.desfeito, {i6: true, semCopia: true, fotoVoltou: 'item', filho: 'i6'});
  assert.deepEqual(out.arrastados, ['CARLOS', 'MARIA DAS GRAÇAS']);
  assert.equal(out.preselecionado, 'i1');
  assert.match(out.bannerSub, /subitem/);
  assert.deepEqual(out.lote, [{item_id: 'i1', parent_type: 'item'}, {item_id: 'i1', parent_type: 'item'}]);
  assert.equal(out.rascunhoRemovido, true);
  assert.equal(out.parcialVisivel, true); assert.equal(out.percentAuto, '50');
  assert.match(out.previa, /meio pipa/); assert.match(out.previa, /4 famílias/);
  assert.deepEqual(out.contraste, []);
  assert.equal(out.pipa.pipa_application, 'parcial'); assert.equal(out.pipa.pipa_percent, 50); assert.equal(out.pipa.pipa_families, 4);
  assert.deepEqual(out.erros, []);
  console.log('multi-nest: ok');
})();
