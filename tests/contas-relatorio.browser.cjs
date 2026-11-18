// Controle de Contas › "📑 Relatório por secretaria": SECRETARIA › LOCAL (conta contrato/relógio) ›
// meses com valores e observações, totais por local/secretaria/geral, filtros e PDF com a mesma estrutura.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=1366 node tests/contas-relatorio.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os');
const {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const conta = (id, local, mes, valor, pago, obs, extra = {}) => row({id, atividade_id: 'ccx', nome: 'Luz', valor, extra_fields: {subitem_id: local, item_id: 'x', tipo: 'Luz', mes_ano: mes, pago, observacao: obs, data_vencimento: `2025-${mes.slice(0, 2)}-28`, data_pagamento: pago ? `2025-${mes.slice(0, 2)}-27` : '', leitura_relogio: '', consumo_kwh: '', ...extra}});

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'ccx', name: 'CONTROLE DE CONTAS', controle_contas: 1, extra_fields: {}})],
    items: [row({id: 'cat-esc', atividade_id: 'ccx', description: 'ESCOLAS', order_num: 0}), row({id: 'cat-sau', atividade_id: 'ccx', description: 'UNIDADES DE SAÚDE', order_num: 1})],
    subitems: [
      row({id: 'l1', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', extra_fields: {'Conta Contrato': '22143 - ELO 2106', 'Unidade Vinculada': 'EDUCAÇÃO', 'Número Do Relógio Da Neoenergia': 'A20N169698'}}),
      row({id: 'l2', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'CRECHE BARTOLOMEU', extra_fields: {'Conta Contrato': '3160024541', 'Unidade Vinculada': 'EDUCAÇÃO'}}),
      row({id: 'l3', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'CAPS', extra_fields: {}}),
      row({id: 'l4', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'POSTO SEM CONTA', extra_fields: {}}),
    ],
    contas: [
      conta('k1', 'l1', '01/2025', 4310.9, true, 'Diversos - 931075020 - 28/01/2025'),
      conta('k2', 'l1', '02/2025', 549.38, true, ''),
      conta('k3', 'l2', '01/2025', 100, false, 'Aguardando empenho'),
      conta('k4', 'l3', '03/2025', 250.5, true, ''),
      conta('k5', 'l3', '03/2024', 999, true, 'ano anterior'),
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed, tz: 'America/Recife'});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => { window.renderControleContas('ccx'); window.ccSetModo('ccx', 'relatorio'); });
  await page.waitForFunction(() => document.querySelectorAll('.ccr-sec-head h3').length >= 2);
  const secs = await page.$$eval('.ccr-sec-head h3', h => h.map(x => x.textContent.replace(/^\S+\s*/, '')));
  assert.deepEqual(secs, ['EDUCAÇÃO', 'UNIDADES DE SAÚDE']);
  const edu = page.locator('.ccr-sec').first();
  const locals = await edu.locator('.ccr-local-row').allTextContents();
  assert.match(locals.find(t => /VARGAS/.test(t)) || '', /ESCOLA MUNICIPAL PRESIDENTE VARGAS.*Conta contrato: 22143 - ELO 2106.*Relógio: A20N169698/);
  assert.deepEqual(await edu.locator('tbody.ccr-local', {hasText: 'PRESIDENTE VARGAS'}).locator('.ccr-mes').allTextContents(), ['JAN/2025', 'FEV/2025']);
  assert.match(await edu.locator('tfoot').textContent(), /TOTAL EDUCAÇÃO\s*R\$\s*4\.960,28.*Pendente R\$\s*100,00/);
  assert.match(await page.locator('.ccr-sec').nth(1).textContent(), /Sem lançamentos no período: POSTO SEM CONTA/);
  // ano padrão = mais recente (2025): conta de 2024 fica de fora
  assert.doesNotMatch(await page.textContent('.ccr'), /ano anterior/);
  // colunas vazias (leitura/consumo) não aparecem
  const th = await edu.locator('thead th').allTextContents();
  assert.deepEqual(th, ['Mês/Ano', 'Vencimento', 'Pagamento', 'Valor', 'Situação', 'Observações']);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.ccr'))), []);
  await page.screenshot({path: os.tmpdir() + `/ccr-${W}.png`, fullPage: true});
  // filtro de secretaria
  await page.selectOption('.ccr-controls label:nth-child(3) select', 'UNIDADES DE SAÚDE');
  await page.waitForFunction(() => document.querySelectorAll('.ccr-sec').length === 1);
  await page.selectOption('.ccr-controls label:nth-child(3) select', '');
  await page.waitForFunction(() => document.querySelectorAll('.ccr-sec').length === 2);
  // PDF
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
    await page.click('.ccr-pdf');
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64, name} = await page.evaluate(() => window.__pdf);
    const file = os.tmpdir() + '/ccr-' + W + '.pdf'; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
    assert.equal(name, 'RELATORIO-CONTAS-POR-SECRETARIA-LUZ-2025.pdf');
    for (const piece of ['RELATÓRIO POR SECRETARIA', 'SECRETARIA: EDUCAÇÃO', 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', 'Conta contrato: 22143 - ELO 2106', 'Relógio: A20N169698', 'JAN/2025', 'Diversos - 931075020', 'Total do local', 'TOTAL EDUCAÇÃO', 'SECRETARIA: UNIDADES DE SAÚDE', 'Página 1 de'])
      assert.ok(text.includes(piece), 'faltou no PDF: ' + piece);
    assert.ok(!text.includes('ano anterior'));
  }
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - relatório de contas por secretaria + PDF (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
