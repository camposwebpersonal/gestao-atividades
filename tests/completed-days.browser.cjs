// Concluídos: linhas finas agrupadas pelo dia da conclusão ("04/11/2026 · QUA" + total do dia),
// barra do mês destacada, botão "← Meses" vivo e breadcrumbs Grupo › Concluídos › NOV-2026
// com o Voltar subindo um nível por vez. Uso: NODE_PATH=$(npm root -g) W=1366 node tests/completed-days.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, concluded: 1, status: 'concluido', start_date: '2026-11-01', ...o});
const names = ['RAIMUNDO - UMBURANA', 'FATIMA', 'QUITÉRIA LUZIA DA SILVA', 'BRANCA', 'MARIA JOSÉ DE GOIS', 'LEGO', 'NELIA REGINA', 'DANILO FERREIRA', 'ROSE'];

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'gp', name: 'SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA', demanda_secretaria_id: 'sec1', controle_pendencias: 1, show_stats: 1, concluded: 0, status: 'pendente'})],
    items: names.map((d, i) => row({id: 'c' + i, atividade_id: 'gp', description: d, order_num: i, conclusion_date: i < 6 ? '2026-11-04T00:00:00+00:00' : '2026-11-05T00:00:00+00:00', extra_fields: {Contato: '87 9999-000' + i}})),
  };
  const {page, errors} = await boot(browser, {width: W, seed, tz: 'America/Recife'});
  page.setDefaultTimeout(9000);
  const crumbs = () => page.$$eval('.nav-trail ol li', lis => lis.map(li => (li.querySelector('span span, button span:last-child, .nav-trail-here span')?.textContent || li.textContent).trim()));

  await page.evaluate(() => { window.openActivity('gp'); window.setActivityLane('gp', 'completed'); });
  await page.waitForSelector('.completed-month-card');
  await page.waitForFunction(() => /Concluídos/.test(document.querySelector('.nav-trail')?.textContent || ''));
  assert.match((await crumbs()).slice(-2).join(' > '), /SOLICITAÇÃO DE ÁGUA DE PIPA.*>.*Concluídos/);

  await page.click('.completed-month-card');
  await page.waitForSelector('.cr-day');
  await page.waitForFunction(() => /NOV-2026/.test(document.querySelector('.nav-trail')?.textContent || ''));
  assert.deepEqual((await crumbs()).slice(-2), ['Concluídos', 'NOV-2026']);

  // grupos por dia, mais recente primeiro, com total no fim
  const days = await page.$$eval('.cr-day', ds => ds.map(d => ({t: d.querySelector('.cr-day-title').textContent, n: d.querySelectorAll('.cr-card').length, foot: d.querySelector('.cr-day-foot').textContent})));
  assert.deepEqual(days.map(d => [d.t.replace(/^📅\s*/, ''), d.n]), [['05/11/2026 · QUI', 3], ['04/11/2026 · QUA', 6]]);
  assert.match(days[1].foot, /Total do dia 04\/11\/2026\s*6 lançamentos/);
  // linhas finas: uma linha só no computador
  const h = await page.$eval('.cr-day .cr-card', el => el.getBoundingClientRect().height);
  if (W >= 900) assert.ok(h <= 40, `linha alta demais: ${h}px`);
  // barra do mês destacada e botão Meses vivo (contraste AA)
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.completed-month-screen-head'))), []);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.cr-day'))), []);
  await page.screenshot({path: os.tmpdir() + `/completed-days-${W}.png`, fullPage: false});

  // busca esconde dias vazios e atualiza o total
  await page.fill('.cr-search', 'danilo');
  await page.waitForFunction(() => document.querySelectorAll('.cr-day:not([hidden])').length === 1);
  assert.match(await page.textContent('.cr-day:not([hidden]) [data-day-count]'), /1 de 3/);
  await page.fill('.cr-search', '');

  // Voltar: mês -> meses -> grupo (Em andamento)
  await page.click('.nav-trail-back');
  await page.waitForSelector('.completed-month-card');
  assert.equal(await page.$('.cr-day'), null);
  await page.click('.nav-trail-back');
  await page.waitForFunction(() => !document.querySelector('.completed-archive'));
  assert.equal(await page.evaluate(() => window.getActivityLane('gp')), 'active');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - concluídos por dia, linhas finas e breadcrumbs (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
