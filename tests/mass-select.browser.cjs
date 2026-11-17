// Tela do grupo: selecionar todos / vários (Shift+clique), concluir em massa com data e Desfazer,
// reabrir, em lista e em cards. Ações de concluir só com Controle de Conclusão.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/mass-select.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, status: 'pendente', concluded: 0, extra_fields: {}, ...o});

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [
      row({id: 'gc', name: 'GRUPO COM CONTROLE', demanda_secretaria_id: 'sec2', controle_pendencias: 1, show_stats: 1, extra_fields: {}}),
      row({id: 'gs', name: 'GRUPO SEM CONTROLE', demanda_secretaria_id: 'sec2', controle_pendencias: 0, extra_fields: {}, items_view_mode: 'cards'}),
    ],
    items: [
      ...['ALFA', 'BETA', 'GAMA', 'DELTA'].map((d, i) => row({id: 'm' + i, atividade_id: 'gc', description: d, order_num: i})),
      row({id: 's0', atividade_id: 'gs', description: 'SEM 1'}), row({id: 's1', atividade_id: 'gs', description: 'SEM 2', order_num: 1}),
    ],
    subitems: [row({id: 'mx', item_id: 'm0', atividade_id: 'gc', description: 'SUB DE ALFA', parent_type: 'item', parent_id: 'm0'})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const db = id => page.evaluate(i => { const r = [...window.__fakeDb.items, ...window.__fakeDb.subitems].find(x => x.id === i); return r && {c: Number(r.concluded), s: r.status, d: r.conclusion_date ? String(r.conclusion_date).slice(0, 10) : null}; }, id);
  const sel = id => `#content .mass-sel[data-id="${id}"]`;

  await page.evaluate(() => window.openActivity('gc'));
  await page.waitForSelector('#mass-bar');
  assert.match(await page.textContent('#mass-bar .mass-all'), /Selecionar todos \(4\)/);
  assert.equal(await page.isVisible('.mass-conclude'), false);
  // Shift + clique: ALFA..GAMA
  await page.click(sel('m0')); await page.click(sel('m2'), {modifiers: ['Shift']});
  assert.deepEqual(await page.$$eval('#content .mass-sel[data-issub="false"]:checked', b => b.map(x => x.dataset.id)), ['m0', 'm1', 'm2']);
  assert.match(await page.textContent('.mass-conclude'), /Concluir\s*3/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('mass-bar'))), []);
  await page.locator('#mass-bar').screenshot({path: os.tmpdir() + `/mass-bar-${W}.png`});
  // selecionar todos / limpar
  await page.check('#mass-bar .mass-all input');
  assert.match(await page.textContent('.mass-all b'), /4 selecionados/);
  await page.click('.mass-clear');
  assert.equal(await page.$$eval('#content .mass-sel:checked', b => b.length), 0);

  // concluir 2 com data escolhida
  await page.check(sel('m0')); await page.check(sel('m3'));
  await page.click('.mass-conclude');
  await page.waitForSelector('#mass-conclude-ok');
  await page.fill('#mass-date', '2026-11-10');
  await page.click('#mass-conclude-ok');
  await page.waitForFunction(() => /concluídos?\./.test(document.getElementById('toast').textContent));
  assert.deepEqual(await db('m0'), {c: 1, s: 'concluido', d: '2026-11-10'});
  assert.deepEqual(await db('mx'), {c: 1, s: 'concluido', d: '2026-11-10'}, 'subitem aberto conclui junto');
  assert.deepEqual(await db('m3'), {c: 1, s: 'concluido', d: '2026-11-10'});
  assert.deepEqual(await db('m1'), {c: 0, s: 'pendente', d: null});
  // desfazer
  await page.locator('.toast-action', {hasText: 'Desfazer'}).click();
  await page.waitForFunction(() => /desfeita/.test(document.getElementById('toast').textContent));
  assert.deepEqual(await db('m0'), {c: 0, s: 'pendente', d: null});
  assert.deepEqual(await db('mx'), {c: 0, s: 'pendente', d: null});

  // Controle de Conclusão: não fica mais como botão na barra do grupo, só dentro de Editar
  assert.equal(await page.$('#content .completion-toggle'), null, 'botão de conclusão saiu da barra');
  await page.evaluate(() => window.openSecModal('gc'));
  await page.waitForSelector('#s-ctrl-pend');
  assert.equal(await page.isChecked('#s-ctrl-pend'), true);
  await page.evaluate(() => window.closeModal());

  // grupo sem controle, em cards: seleção existe, mas sem concluir
  await page.evaluate(() => window.openActivity('gs'));
  await page.waitForSelector('#mass-bar');
  await page.check(sel('s0'));
  assert.equal(await page.isVisible('.mass-conclude'), false);
  assert.equal(await page.isVisible('.mass-delete'), true);
  const overflow = await page.evaluate(() => { const b = document.getElementById('mass-bar'); return b.scrollWidth > b.clientWidth + 1; });
  assert.equal(overflow, false);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - seleção em massa e concluir (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
