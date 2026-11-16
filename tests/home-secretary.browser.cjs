// Nenhum lançamento fica "sem secretaria" quando o grupo tem lugar na navegação:
// groupHomeSecretary (js/modulos.js) vale para busca (lista e página organizada), mapa e contexto.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/home-secretary.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, ...o});

(async () => {
  const browser = await chromium.launch();
  const seed = {
    secretarias: [row({id: 'tr', name: 'TRANSPORTES'})],
    atividades: [
      row({id: 'gfrota', name: 'VEÍCULOS DA AGRICULTURA', extra_fields: {modulo: 'frota'}}),
      row({id: 'grh', name: 'BCCS', extra_fields: {}}),                 // módulo pelo nome (RH)
      row({id: 'gproj', name: 'CONVÊNIOS', extra_fields: {modulo: 'projetos'}}),
    ],
    items: [
      row({id: 'hs1', atividade_id: 'gfrota', description: 'HILUX ZETA', secretaria_id: 'sec2', extra_fields: {geo_location: {latitude: -8.07, longitude: -37.26, accuracy: 5, maps_url: 'https://www.google.com/maps?q=-8.07,-37.26', captured_at: now}}}),
      row({id: 'hs2', atividade_id: 'grh', description: 'FULANO ZETA'}),
      row({id: 'hs3', atividade_id: 'gproj', description: 'PRAÇA ZETA', secretaria_id: 'sx7'}),
    ],
    subitems: [row({id: 'hs4', item_id: 'hs2', atividade_id: 'grh', description: 'PORTARIA ZETA'})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const home = id => page.evaluate(g => window.groupHomeSecretary(window.S.secs.find(s => s.id === g))?.name, id);
  assert.equal(await home('gfrota'), 'TRANSPORTES');
  assert.equal(await home('grh'), 'ADMINISTRAÇÃO');
  assert.equal(await home('gproj'), 'ADMINISTRAÇÃO');
  assert.equal(await home('a2'), 'GABINETE'); // demandas: continua a secretaria do próprio grupo

  // lista instantânea: caminho Secretaria › Área › Grupo, sem "Sem secretaria"
  await page.evaluate(() => { document.getElementById('global-search').value = 'zeta'; window.pesquisarGlobal('zeta'); });
  await page.waitForFunction(() => document.querySelectorAll('.global-search-result').length >= 4);
  const crumbs = await page.$$eval('.global-search-result .search-crumbs', els => els.map(e => e.textContent));
  assert.equal(crumbs.some(c => /sem secretaria/i.test(c)), false, crumbs.join(' | '));
  assert.ok(crumbs.some(c => /^TRANSPORTES›.+›VEÍCULOS DA AGRICULTURA/.test(c)), crumbs.join(' | '));
  assert.ok(crumbs.some(c => /^ADMINISTRAÇÃO›.+›BCCS›FULANO ZETA/.test(c)), crumbs.join(' | '));

  // página organizada
  await page.evaluate(() => window.abrirPaginaBuscaGlobal('zeta'));
  await page.waitForSelector('.search-results-page');
  const text = await page.textContent('.search-results-page');
  assert.doesNotMatch(text, /sem secretaria/i);
  assert.match(text, /TRANSPORTES/); assert.match(text, /ADMINISTRAÇÃO/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false, 'página de resultados não pode vazar na horizontal');

  // mapa: o ponto aparece na secretaria de casa e o filtro por secretaria o encontra
  assert.equal(await page.evaluate(() => window.groupMapPoints('gfrota')[0]?.secretary?.name), 'TRANSPORTES');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - nenhum resultado sem secretaria (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
