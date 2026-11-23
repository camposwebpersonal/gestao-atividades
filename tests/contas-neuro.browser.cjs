// Controle de Contas › Visão geral com neuroarquitetura: acolhimento (saudação + situação em frase humana),
// anel de progresso, valores que NUNCA vazam do card em nenhuma largura (360 a 1920px), "portas" para as tarefas,
// categorias clicáveis (filtram os lançamentos), detalhamento por local agrupado com busca própria e contraste AA.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/contas-neuro.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const conta = (id, cat, local, mes, valor, pago, venc) => row({id, atividade_id: 'ccx', nome: 'Luz', valor, extra_fields: {subitem_id: local, item_id: cat, tipo: 'Luz', mes_ano: mes, pago, data_vencimento: venc || `2025-${mes.slice(0, 2)}-28`, data_pagamento: pago ? `2025-${mes.slice(0, 2)}-27` : ''}});
(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'ccx', name: 'CONTROLE DE CONTAS', controle_contas: 1})],
    items: [row({id: 'cat-sec', atividade_id: 'ccx', description: 'SECRETARIAS'}), row({id: 'cat-sau', atividade_id: 'ccx', description: 'UNIDADES DE SAÚDE', order_num: 1})],
    subitems: [
      row({id: 'l1', item_id: 'cat-sec', atividade_id: 'ccx', parent_type: 'item', description: 'PREFEITURA MUNICIPAL'}),
      row({id: 'l2', item_id: 'cat-sec', atividade_id: 'ccx', parent_type: 'item', description: 'SECRETARIA DE INFRAESTRUTURA, SERVIÇOS PÚBLICOS E PROJETOS ESPECIAIS'}),
      row({id: 'l3', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'HOSPITAL MARIA ALICE GOMES LAFAYETTE'}),
    ],
    // valores enormes de propósito (R$ 2.574.316,48 no total) para provar que nada sai do card
    contas: [conta('k1', 'cat-sec', 'l1', '01/2025', 1853378.61, true), conta('k2', 'cat-sec', 'l2', '02/2025', 455662.94, true),
      conta('k3', 'cat-sau', 'l3', '03/2025', 210077.02, true), conta('k4', 'cat-sau', 'l3', '04/2025', 55197.91, false, '2025-04-10')],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => { window.renderControleContas('ccx'); window.ccSetModo('ccx', 'resumo'); });
  await page.waitForSelector('.ccn-hero');
  const hero = (await page.textContent('.ccn-hero')).replace(/\s+/g, ' ');
  assert.match(hero, /(Bom dia|Boa tarde|Boa noite)/);
  assert.match(hero, /1 conta vencida pede sua atenção/, 'situação em linguagem humana');
  assert.match(hero, /97,9%/, 'anel de progresso com o percentual pago');
  assert.ok(await page.isVisible('.ccn-cta'), 'atalho direto para as vencidas');
  assert.equal(await page.locator('.ccn-door').count(), 4, 'portas para cada tarefa');
  assert.match(await page.getAttribute('.ccn-kpi.is-total', 'title'), /R\$ 2\.574\.316,48/);
  // nenhum valor vaza do card, em nenhuma largura
  for (const width of [360, 390, 480, 600, 768, 900, 1024, 1180, 1280, 1366, 1600, 1920]) {
    await page.setViewportSize({width, height: 900});
    await page.waitForTimeout(250); // o encaixe automático reage sozinho ao novo tamanho (ResizeObserver)
    const bad = await page.evaluate(() => [...document.querySelectorAll('.ccn-kpi, .ccn-cat, .ccn-door')].flatMap(card => {
      const c = card.getBoundingClientRect();
      return [...card.querySelectorAll('b,small,span,em')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > c.right + 0.5 || r.left < c.left - 0.5 || el.scrollWidth > el.clientWidth + 1); }).map(el => `${card.className}: "${el.textContent.trim().slice(0, 40)}"`);
    }));
    assert.deepEqual(bad, [], `vazou em ${width}px`);
  }
  await page.setViewportSize({width: W, height: 900}); await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  await page.screenshot({path: os.tmpdir() + `/contas-neuro-${W}.png`, fullPage: true});
  // detalhamento: agrupado por categoria (sem repetir) e busca própria
  await page.click('.ccn-detail > summary');
  assert.equal(await page.locator('.ccn-table .ccn-cat-row').count(), 2);
  await page.fill('.ccn-detail-search', 'hospital');
  assert.deepEqual(await page.$$eval('.ccn-table tbody tr[data-q]', rows => rows.filter(r => !r.hidden && !r.closest('tbody').hidden).map(r => r.cells[0].textContent)), ['HOSPITAL MARIA ALICE GOMES LAFAYETTE']);
  // categoria clicável → lançamentos filtrados
  await page.click('.ccn-cat:has-text("UNIDADES DE SAÚDE")');
  await page.waitForFunction(() => document.getElementById('cc-busca')?.value === 'UNIDADES DE SAÚDE');
  assert.match(await page.textContent('.cc-workspace-tab.active'), /Lançamentos/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - visão geral do Controle de Contas (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
