// Datas de conclusão/prazo gravadas como o dia à meia-noite UTC precisam aparecer no MESMO dia em
// Recife (UTC-3): aba Concluídos, card, mês do arquivo, edição e concluir em massa (js: calendarDate).
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/calendar-dates.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'gd', name: 'GRUPO DATAS', demanda_secretaria_id: 'sec2', controle_pendencias: 1, show_stats: 1})],
    items: [
      row({id: 'd1', atividade_id: 'gd', description: 'CONCLUÍDO EM 04/11', concluded: 1, status: 'concluido', start_date: '2026-11-01', conclusion_date: '2026-11-04T00:00:00+00:00', deadline_date: '2026-11-05T00:00:00+00:00'}),
      row({id: 'd2', atividade_id: 'gd', description: 'VIRADA DO MÊS', concluded: 1, status: 'concluido', start_date: '2026-11-01', conclusion_date: '2026-12-01T00:00:00+00:00'}),
      row({id: 'd3', atividade_id: 'gd', description: 'ABERTO', concluded: 0, status: 'pendente', deadline_date: '2026-11-20T00:00:00+00:00'}),
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed, tz: 'America/Recife'});
  page.setDefaultTimeout(9000);
  assert.equal(await page.evaluate(() => new Date().getTimezoneOffset()), 180, 'navegador em Recife');
  assert.equal(await page.evaluate(() => window.S.items.find(i => i.id === 'd1').conclusion_date.slice(0, 10)), '2026-11-04');
  assert.equal(await page.evaluate(() => window.calendarDate('2026-11-04T00:00:00+00:00')), '2026-11-04T12:00:00');
  assert.equal(await page.evaluate(() => window.calendarDate('2026-11-04T15:30:00+00:00')), '2026-11-04T15:30:00+00:00', 'hora real não é mexida');

  // aba Concluídos
  await page.evaluate(() => window.revealRecord('items', 'd1'));
  await page.waitForSelector('[data-cr="d1"]');
  const txt = await page.textContent('[data-cr="d1"]');
  assert.match(txt, /04\/11\/2026/); assert.doesNotMatch(txt, /03\/11\/2026/);
  // revela o de dezembro: precisa estar no mês 12, não em novembro
  await page.evaluate(() => window.revealRecord('items', 'd2'));
  await page.waitForFunction(() => /01\/12\/2026/.test(document.getElementById('content').textContent));
  assert.doesNotMatch(await page.textContent('#content'), /30\/11\/2026/);

  // concluir em massa com 04/11 e conferir a exibição
  await page.evaluate(() => { window.setActivityLane('gd', 'active'); window.openActivity('gd'); });
  await page.waitForSelector('#content .mass-sel[data-id="d3"]');
  await page.check('#content .mass-sel[data-id="d3"]');
  await page.click('.mass-conclude'); await page.waitForSelector('#mass-date');
  await page.fill('#mass-date', '2026-11-04'); await page.click('#mass-conclude-ok');
  await page.waitForFunction(() => /concluído/.test(document.getElementById('toast').textContent));
  assert.equal(await page.evaluate(() => String(window.__fakeDb.items.find(i => i.id === 'd3').conclusion_date).slice(0, 10)), '2026-11-04');
  await page.evaluate(() => window.revealRecord('items', 'd3'));
  await page.waitForSelector('[data-cr="d3"]');
  assert.match(await page.textContent('[data-cr="d3"]'), /04\/11\/2026/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - datas de calendário no mesmo dia em Recife (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
