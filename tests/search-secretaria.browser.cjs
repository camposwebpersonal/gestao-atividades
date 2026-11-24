// Busca do topo: SECRETARIA primeiro ("porta" com Entrar + atalhos), Enter entra direto quando o termo é o nome
// da secretaria, ↑↓ + Enter abre o escolhido, buscas recentes no campo vazio e página com secretarias no topo.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390|1366 node tests/search-secretaria.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {
    secretarias: [{id: 'smul', name: 'SECRETARIA DA MULHER', updated_at: now}],
    atividades: [
      {id: 'gmul1', name: 'MULHERES CADASTRADAS', demanda_secretaria_id: 'smul', order_num: 50, extra_fields: {}, created_at: now, updated_at: now},
      {id: 'gmul2', name: 'PALESTRAS E RODAS DE CONVERSA', demanda_secretaria_id: 'smul', order_num: 51, extra_fields: {}, created_at: now, updated_at: now},
      {id: 'gout', name: 'ASSOCIAÇÃO DE MULHERES RURAIS', demanda_secretaria_id: 'sec2', order_num: 52, extra_fields: {}, created_at: now, updated_at: now},
    ],
    items: [
      {id: 'imul-a', atividade_id: 'gmul2', description: 'RODA NO CENTRO DA MULHER', concluded: 0, created_at: now, updated_at: now},
      {id: 'imul-b', atividade_id: 'gout', description: 'PONTO DE APOIO A MULHER', concluded: 0, created_at: now, updated_at: now},
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const open = async () => { if (W < 961) { await page.evaluate(() => window.abrirBuscaGlobalMobile()); await page.waitForTimeout(80); } };
  const type = async q => { await open(); await page.fill('#global-search', q); await page.waitForTimeout(180); };

  await type('mulher');
  const first = await page.evaluate(() => {
    const p = document.getElementById('global-search-panel');
    const sec = p.querySelector('.global-search-section'), row = p.querySelector('.global-search-result');
    return {section: sec?.textContent, row: row?.textContent, door: !!row?.closest('.gs-door'), active: row?.classList.contains('active'), hint: p.querySelector('.global-search-summary span')?.textContent, shortcuts: [...p.querySelectorAll('.gs-door-shortcuts button')].map(b => b.textContent)};
  });
  console.log(JSON.stringify(first));
  assert.match(first.section, /Secretarias/); assert.match(first.row, /SECRETARIA DA MULHER/); assert.ok(first.door && first.active);
  assert.match(first.row, /Entrar/); assert.match(first.hint, /Enter entra na secretaria/);
  assert.ok(first.shortcuts.some(t => /PALESTRAS/.test(t)), 'atalhos para os grupos da secretaria');
  const order = await page.evaluate(() => [...document.querySelectorAll('#global-search-panel .global-search-section')].map(s => s.textContent.replace(/\d.*$/, '').trim()));
  assert.match(order[0], /Secretarias/); assert.match(order[1], /Grupos/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('global-search-panel'))), []);
  await page.screenshot({path: `/tmp/search-sec-${W}.png`});

  // Enter com o nome exato entra na secretaria (Casa Lilás / área da secretaria)
  await page.press('#global-search', 'Enter');
  await page.waitForFunction(() => /MULHER/i.test(document.querySelector('#content')?.textContent || '') && document.getElementById('global-search-panel').hidden);
  const route = await page.evaluate(() => ({hash: location.hash, view: window.__currentView, sel: window.currentDemandSecretaria}));
  console.log('entrou', JSON.stringify(route)); assert.match(route.hash, /smul/);

  // ↑↓ + Enter abre o escolhido (não a página de todos)
  await type('mulher');
  await page.press('#global-search', 'ArrowDown');
  const chosen = await page.evaluate(() => document.querySelector('.global-search-result.active')?.textContent);
  await page.press('#global-search', 'Enter');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__currentView === 'search'), false, 'Enter após setas não abre a página de todos');
  console.log('escolhido', chosen?.slice(0, 60));

  // Shift+Enter → página completa com secretarias no topo
  await type('mulher');
  await page.press('#global-search', 'Shift+Enter');
  await page.waitForSelector('.search-results-page');
  const pg = await page.evaluate(() => { const c = document.querySelector('.search-results-page'); const s = c.querySelector('#busca-secretarias'), g = c.querySelector('#busca-grupos'); return {sec: !!s, before: s && g ? !!(s.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) : !!s, chip: c.querySelector('.search-chip')?.textContent}; });
  assert.ok(pg.sec && pg.before); assert.match(pg.chip, /Secretarias/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.search-results-page'))), []);

  // Campo vazio: buscas recentes e abertos
  await open(); await page.fill('#global-search', ''); await page.focus('#global-search'); await page.evaluate(() => window.pesquisarGlobal('')); await page.waitForTimeout(150);
  const rec = await page.evaluate(() => ({chips: [...document.querySelectorAll('.gs-recent-chips button')].map(b => b.textContent), opened: [...document.querySelectorAll('.gs-recent-open strong')].map(b => b.textContent)}));
  console.log('recentes', JSON.stringify(rec));
  assert.ok(rec.chips.includes('mulher')); assert.ok(rec.opened.includes('SECRETARIA DA MULHER'));
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('global-search-panel'))), []);
  await page.click('.gs-recent-chips button'); await page.waitForTimeout(150);
  assert.equal(await page.inputValue('#global-search'), 'mulher');
  assert.deepEqual(errors, []);
  console.log(`ok - busca com secretaria primeiro (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
