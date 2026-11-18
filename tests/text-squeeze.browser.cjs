// REGRA PERMANENTE: texto NUNCA pode ser espremido numa coluna fininha (letras empilhadas).
// Varre larguras de celular, tablet e computador nas telas de grupo (lista, cards, atendimento e
// concluídos) e falha se algum texto ficar com menos de 70px de largura e mais de 2 linhas de altura,
// ou se o nome de um lançamento tiver menos de 140px. Uso: NODE_PATH=$(npm root -g) node tests/text-squeeze.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, concluded: 0, status: 'solicitado', ...o});
const names = ['Isabel (Bela)', 'Pedido de Moradores da Rua Projetada Sem Número', 'Rafael Júnior', 'JONAS GRANDE DA SILVA'];
const WIDTHS = [360, 390, 600, 768, 800, 900, 1024, 1100, 1180, 1280, 1366, 1600];

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [
      row({id: 'ga', name: 'SOLICITAÇÕES DE SANEAMENTO BÁSICO', demanda_secretaria_id: 'sec1', controle_pendencias: 1, show_stats: 1, extra_fields: {modulo: 'atendimentos'}}),
      row({id: 'gl', name: 'GRUPO EM LISTA', demanda_secretaria_id: 'sec2', controle_pendencias: 1, show_stats: 1}),
      row({id: 'gc', name: 'GRUPO EM CARDS', demanda_secretaria_id: 'sec2', items_view_mode: 'cards', extra_fields: {items_view_mode: 'cards'}}),
    ],
    items: [
      ...names.map((d, i) => row({id: 'a' + i, atividade_id: 'ga', description: d, order_num: i, responsaveis: i % 2 ? '' : 'DANIEL MEDEIROS', extra_fields: {urgencia: 'Necessita de atenção', solicitante: 'JONAS ELETRICISTA'}})),
      ...names.map((d, i) => row({id: 'l' + i, atividade_id: 'gl', description: d, order_num: i, responsaveis: 'ADAUTO JR', deadline_date: '2026-11-30', status: 'pendente'})),
      ...names.map((d, i) => row({id: 'c' + i, atividade_id: 'gc', description: d, order_num: i, status: 'pendente'})),
      ...names.map((d, i) => row({id: 'k' + i, atividade_id: 'gl', description: d + ' (feito)', order_num: 10 + i, concluded: 1, status: 'concluido', start_date: '2026-11-01', conclusion_date: '2026-11-04'})),
    ],
    subitems: names.map((d, i) => row({id: 's' + i, item_id: 'l0', atividade_id: 'gl', description: 'Subitem ' + d, parent_type: 'item', parent_id: 'l0', order_num: i, status: 'pendente'})),
  };
  const {page, errors} = await boot(browser, {width: 1366, seed});
  page.setDefaultTimeout(9000);
  const scan = () => page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#content *')) {
      if (!el.offsetParent || el.closest('svg,canvas,.leaflet-container,[hidden]')) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (own.length < 6) continue;
      const r = el.getBoundingClientRect(), lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
      if (r.width < 70 && r.height > lh * 2.6) bad.push(`${el.className || el.tagName} "${own.slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of document.querySelectorAll('#content .item-name,#content .cr-name')) {
      if (!el.offsetParent) continue;
      const w = el.getBoundingClientRect().width;
      if (w < 140) bad.push(`nome com ${Math.round(w)}px: "${el.textContent.trim().slice(0, 24)}"`);
    }
    return bad;
  });
  const fails = [];
  for (const W of WIDTHS) {
    await page.setViewportSize({width: W, height: 900});
    for (const [group, lane] of [['ga', 'active'], ['gl', 'active'], ['gc', 'active'], ['gl', 'completed']]) {
      await page.evaluate(([g, l]) => { window.openActivity(g); if (l === 'completed') window.setActivityLane(g, l); }, [group, lane]);
      if (lane === 'completed') { await page.waitForSelector('.completed-month-card,.cr-day'); if (!(await page.$('.cr-day'))) await page.click('.completed-month-card'); await page.waitForSelector('.cr-day'); }
      else { await page.evaluate(g => window.toggleAllItems?.(g, true), group); }
      await page.waitForTimeout(250);
      for (const b of await scan()) fails.push(`${W}px ${group}/${lane}: ${b}`);
      if (lane === 'completed') await page.evaluate(g => window.setActivityLane(g, 'active'), group);
    }
  }
  assert.deepEqual(fails, [], 'texto espremido:\n' + fails.slice(0, 20).join('\n'));
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - nenhum texto espremido em ${WIDTHS.length} larguras`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
