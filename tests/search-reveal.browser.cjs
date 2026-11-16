// Busca do topo: clicar em um resultado SEMPRE mostra o lançamento, mesmo com filtro salvo,
// aba Concluídos, mês do arquivo ou item recolhido escondendo-o (js/search-reveal.js).
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/search-reveal.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [{id: 'pw', name: 'PERFURAÇÃO DE POÇOS', demanda_secretaria_id: 'sec2', order_num: 20, icon: '💧', controle_pocos: 1, extra_fields: {modulo: 'atendimentos', controle_pocos: 1}, created_at: now, updated_at: now}],
    items: [{id: 'dr1', atividade_id: 'pw', description: 'POÇOS DO SERTÃO LTDA', order_num: 0, extra_fields: {registro_tipo: 'perfurador', tipo_pessoa: 'empresa'}, created_at: now, updated_at: now}],
    subitems: [
      {id: 'wl1', item_id: 'dr1', atividade_id: 'pw', description: 'PAU BRANCO', order_num: 0, extra_fields: {registro_tipo: 'poco', status_pagamento: 'pendente', status_perfuracao: 'solicitada'}, created_at: now, updated_at: now},
      {id: 'wl2', item_id: 'dr1', atividade_id: 'pw', description: 'SÍTIO UMBUZEIRO', order_num: 1, extra_fields: {registro_tipo: 'poco', status_pagamento: 'pago', status_perfuracao: 'executada'}, created_at: now, updated_at: now},
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const visible = sel => page.waitForFunction(s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return el.offsetParent !== null && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }, sel);
  const searchAndClick = async (q, id) => {
    await page.evaluate(v => { document.getElementById('global-search').value = v; window.pesquisarGlobal(v); }, q);
    await page.waitForFunction(v => [...document.querySelectorAll('.global-search-result-copy strong')].some(b => b.textContent.toUpperCase().includes(v.toUpperCase())), id);
    await page.evaluate(v => [...document.querySelectorAll('.global-search-result-copy strong')].find(b => b.textContent.toUpperCase().includes(v.toUpperCase())).closest('.global-search-result').click(), id);
  };

  // 1) poço escondido por filtro salvo (pagos) + busca interna → clique limpa os filtros e mostra
  await page.evaluate(() => window.openActivity('pw'));
  await page.waitForSelector('[data-well-id="wl1"]');
  await page.evaluate(() => { window.pocoFilter('status', 'pago'); window.pocoFilter('busca', 'umbuzeiro'); });
  assert.equal(await page.$('[data-well-id="wl1"]'), null, 'filtro deveria esconder PAU BRANCO');
  await page.evaluate(() => window.setView?.('dash'));
  await searchAndClick('pau branco', 'PAU BRANCO');
  await visible('[data-well-id="wl1"]');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('gestao-pocos-ui-v1'))).status, 'todos');
  await page.waitForFunction(() => /filtros desta tela foram limpos/.test(document.getElementById('toast').textContent));
  // sem filtro atrapalhando: não mexe em nada nem avisa
  await page.evaluate(() => { document.getElementById('toast').innerHTML = ''; window.pocoFilter('execucao', 'solicitada'); });
  await searchAndClick('pau branco', 'PAU BRANCO');
  await visible('[data-well-id="wl1"]');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('gestao-pocos-ui-v1'))).execucao, 'solicitada');
  await page.waitForTimeout(400);
  assert.doesNotMatch(await page.textContent('#toast'), /filtros/);
  // aba errada: prestador
  await searchAndClick('poços do sertão', 'POÇOS DO SERTÃO');
  await visible('[data-driller-id="dr1"]');

  // 2) página "ver todos os resultados": concluído aparece no arquivo, no mês certo
  await page.evaluate(() => window.abrirPaginaBuscaGlobal('marisa'));
  await page.waitForSelector('.search-results-page');
  await page.evaluate(() => window.ativarResultadoBuscaPorId('item', 'i10'));
  await visible('[data-cr="i10"]');
  await page.waitForTimeout(900);
  assert.doesNotMatch(await page.textContent('#toast'), /Abrindo o cadastro/, 'não deveria precisar abrir o cadastro');
  // 3) grupo ficou na aba Concluídos; resultado em andamento volta para a aba certa
  await searchAndClick('riacho do mel', 'RIACHO DO MEL');
  await visible('#ir-i4');
  // 4) subitem dentro de item recolhido
  await searchAndClick('comprar telhas', 'Comprar telhas');
  await visible('[data-sort-id="s1"]');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - busca revela o lançamento (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
