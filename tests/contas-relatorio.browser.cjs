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
    atividades: [row({id: 'ccx', name: 'CONTROLE DE CONTAS', controle_contas: 1, extra_fields: {}}),
      row({id: 'cad-predios-locais-publicos', name: 'PRÉDIOS E LOCAIS PÚBLICOS', extra_fields: {modulo: 'cadastros'}}),
      row({id: '221b896f-9012-4c97-80b9-0bd5cd294c86', name: 'EQUIPAMENTOS DA EDUCAÇÃO', extra_fields: {modulo: 'cadastros'}})],
    items: [row({id: 'cat-esc', atividade_id: 'ccx', description: 'ESCOLAS', order_num: 0}), row({id: 'cat-sau', atividade_id: 'ccx', description: 'UNIDADES DE SAÚDE', order_num: 1}),
      // Cadastro oficial (ADMINISTRAÇÃO › Cadastros): nome e dados valem no Controle de Contas
      row({id: 'cad1', atividade_id: '221b896f-9012-4c97-80b9-0bd5cd294c86', description: 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', extra_fields: {contas_local_id: 'l1', 'Unidade Vinculada': 'EDUCAÇÃO', 'ENDEREÇO': 'RUA DO CADASTRO, 10'}}),
      row({id: 'cad2', atividade_id: '221b896f-9012-4c97-80b9-0bd5cd294c86', description: 'CRECHE MUNICIPAL BARTOLOMEU', extra_fields: {contas_local_id: 'l2', 'Unidade Vinculada': 'EDUCAÇÃO'}}),
      row({id: 'cad3', atividade_id: 'cad-predios-locais-publicos', description: 'CAPS', extra_fields: {contas_local_id: 'l3'}}),
      row({id: 'cad4', atividade_id: 'cad-predios-locais-publicos', description: 'PRAÇA AINDA SEM CONTA', extra_fields: {}})],
    subitems: [
      row({id: 'l1', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', extra_fields: {cadastro_id: 'cad1', 'Conta Contrato': '22143 - ELO 2106', 'Unidade Vinculada': 'EDUCAÇÃO', 'Número Do Relógio Da Neoenergia': 'A20N169698'}}),
      row({id: 'l2', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'CRECHE BARTOLOMEU', extra_fields: {cadastro_id: 'cad2', 'Conta Contrato': '3160024541'}}),
      row({id: 'l3', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'CAPS', extra_fields: {cadastro_id: 'cad3'}}),
      row({id: 'l4', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'POSTO SEM CONTA', extra_fields: {agrupador: true}}),
    ],
    contas: [
      conta('k1', 'l1', '01/2025', 4310.9, true, 'Diversos - 931075020 - 28/01/2025'),
      conta('k2', 'l1', '02/2025', 549.38, true, ''),
      conta('k2b', 'l1', '02/2025', 37.68, true, 'Diversos - 7027496495 - 11/03/2025'),
      conta('k3', 'l2', '01/2025', 100, false, 'Aguardando empenho'),
      conta('k4', 'l3', '03/2025', 250.5, true, ''),
      conta('k5', 'l3', '03/2024', 999, true, 'ano anterior'),
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed, tz: 'America/Recife'});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => { window.renderControleContas('ccx'); window.ccSetModo('ccx', 'relatorio'); });
  await page.waitForFunction(() => document.querySelectorAll('.ccr-sec-head h3').length >= 3);
  const secs = await page.$$eval('.ccr-sec-head h3', h => h.map(x => x.textContent.replace(/^\S+\s*/, '')));
  // locais ligados ao cadastro por secretaria; resumos/sem cadastro num bloco 📦 no fim
  assert.deepEqual(secs, ['EDUCAÇÃO', 'UNIDADES DE SAÚDE', 'CONTAS SEM ESTABELECIMENTO CADASTRADO']);
  assert.ok((await page.locator('.ccr-sec').nth(2).textContent()).includes('RESUMOS E CONTAS AINDA SEM CADASTRO'));
  // nome do cadastro vale (CRECHE BARTOLOMEU → CRECHE MUNICIPAL BARTOLOMEU) e o selo 🔗 aparece
  assert.match(await page.textContent('.ccr'), /CRECHE MUNICIPAL BARTOLOMEU/);
  assert.equal(await page.locator('.ccr-sec').first().locator('.ccr-linked').count(), 2);
  const edu = page.locator('.ccr-sec').first();
  const locals = await edu.locator('.ccr-local-row').allTextContents();
  assert.match(locals.find(t => /VARGAS/.test(t)) || '', /ESCOLA MUNICIPAL PRESIDENTE VARGAS.*Conta contrato: 22143 - ELO 2106.*Relógio: A20N169698/);
  assert.deepEqual(await edu.locator('tbody.ccr-local', {hasText: 'PRESIDENTE VARGAS'}).locator('.ccr-mes').allTextContents(), ['JAN/2025', '↳ FEV/2025', '↳ FEV/2025']);
  assert.match(await edu.locator('tfoot').textContent(), /TOTAL EDUCAÇÃO\s*R\$\s*4\.997,96.*Pendente R\$\s*100,00/);
  assert.match(await edu.locator('.ccr-month-row').textContent(), /FEV\/2025\s*2 contas no mês/);
  assert.match(await edu.locator('.ccr-month-total').textContent(), /Total de FEV\/2025 · 2 contas\s*R\$\s*587,06/);
  assert.match(await page.locator('.ccr-sec').nth(2).textContent(), /Sem lançamentos no período: POSTO SEM CONTA/);
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
  await page.waitForFunction(() => document.querySelectorAll('.ccr-sec').length === 3);
  // PDF
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
    await page.click('.ccn-pdf');
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64, name} = await page.evaluate(() => window.__pdf);
    const file = os.tmpdir() + '/ccr-' + W + '.pdf'; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
    assert.equal(name, 'RELATORIO-CONTAS-POR-SECRETARIA-LUZ-2025.pdf');
    for (const piece of ['RELATÓRIO POR SECRETARIA', 'SECRETARIA: EDUCAÇÃO', 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', 'Conta contrato: 22143 - ELO 2106', 'Relógio: A20N169698', 'JAN/2025', 'Diversos - 931075020', 'Total do local', '2 contas no mês', 'Total de FEV/2025 · 2 contas', 'TOTAL EDUCAÇÃO', 'SECRETARIA: UNIDADES DE SAÚDE', 'Página 1 de'])
      assert.ok(text.includes(piece), 'faltou no PDF: ' + piece);
    assert.ok(!text.includes('ano anterior'));
  }
  // 🏢 Cadastro dos locais: todos os locais (com e sem conta), conta contrato/relógio e demais dados
  await page.evaluate(() => window.ccSetModo('ccx', 'cadastro'));
  // blocos compactos: nome do local e, embaixo, "RÓTULO: valor" (Conta contrato primeiro)
  await page.waitForSelector('.ccc-row');
  const firstFields = await page.locator('.ccc-row').first().locator('.ccc-fields b').allTextContents();
  assert.equal(firstFields[0], 'CONTA CONTRATO:');
  assert.ok(await page.locator('.ccc-fields .bad').count() >= 1, 'falta de conta contrato em vermelho');
  const cadText = await page.textContent('.ccr-cadastro');
  for (const piece of ['ESCOLA MUNICIPAL PRESIDENTE VARGAS', '22143 - ELO 2106', 'A20N169698', 'POSTO SEM CONTA', 'não informado', '3 (última FEV/2025)', 'RUA DO CADASTRO, 10', 'CRECHE BARTOLOMEU', '🔗 ligados ao cadastro']) assert.ok(cadText.includes(piece), 'cadastro sem: ' + piece);
  assert.doesNotMatch(cadText, /item_show|show_|Unidade Vinculada|cadastro_id|cadastro_grupo|contas_local_id|agrupador|AGRUPADOR|cad1/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.ccr-cadastro'))), []);
  await page.screenshot({path: os.tmpdir() + `/ccr-cad-${W}.png`, fullPage: true});
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; });
    await page.click('.ccn-pdf');
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64, name} = await page.evaluate(() => window.__pdf);
    const file = os.tmpdir() + '/ccr-cad-' + W + '.pdf'; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
    assert.equal(name, 'CADASTRO-DOS-LOCAIS-CONTROLE-DE-CONTAS.pdf');
    for (const piece of ['CADASTRO DOS LOCAIS', 'SECRETARIA: EDUCAÇÃO', '22143 - ELO 2106', 'POSTO SEM CONTA', 'Página 1 de']) assert.ok(text.includes(piece), 'PDF cadastro sem: ' + piece);
  }
  // Tela principal: 📦 resumo no fim, selo 🔗 nos ligados; "Novo local" oferece puxar do cadastro (sem duplicar)
  await page.evaluate(() => window.ccSetModo('ccx', 'resumo'));
  await page.evaluate(() => { window.curSecId = 'ccx'; window.ccOpenLocalModal('', 'cat-sau'); });
  await page.waitForSelector('#cc-local-cad');
  const opts = await page.$$eval('#cc-local-cad option', o => o.map(x => x.textContent));
  assert.ok(opts.some(t => t.includes('PRAÇA AINDA SEM CONTA')), 'cadastro livre não oferecido');
  assert.ok(!opts.some(t => t.includes('CAPS')), 'local já ligado não pode ser oferecido de novo');
  await page.selectOption('#cc-local-cad', 'cad4');
  assert.equal(await page.inputValue('#cc-local-name'), 'PRAÇA AINDA SEM CONTA');
  await page.evaluate(() => window.closeModal());
  // Veículos (Seguros ↔ frota): nome do cadastro + placa, campos do seguro mais recentes valem, cadastro completa
  const veic = await page.evaluate(() => {
    const S = {items: [{id: 'v1', atividade_id: 'e1963945-b131-4949-acfe-424dad296715', description: 'ÔNIBUS', extra_fields: {PLACA: 'PGG-7965', ANO: '2013', 'Vigência': '01/01/2024 a 01/01/2025'}}],
      subitems: [{id: 's1', description: '15.190 EOD - PGG7965', extra_fields: {cadastro_id: 'v1', 'Vigência': '29/07/2025 a 29/07/2026'}}]};
    window.cadastroLinks.hydrate(S);
    const f = window.cadastroLinks.fields(S.subitems[0]);
    return {name: S.subitems[0].description, own: window.cadastroLinks.ownName(S.subitems[0]), vig: f['Vigência'], ano: f.ANO, plate: window.cadastroLinks.plate(S.items[0]), keys: Object.keys(f).join(','),
      kind: window.cadastroLinks.groupForCategory('FROTA EDUCAÇÃO - MAPFRE', 'veiculos')};
  });
  assert.deepEqual(veic, {name: 'ÔNIBUS - PGG7965', own: '15.190 EOD - PGG7965', vig: '01/01/2024 a 01/01/2025', ano: '2013', plate: 'PGG7965', keys: 'PLACA,ANO,Vigência', kind: 'e1963945-b131-4949-acfe-424dad296715'});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - relatório de contas por secretaria + PDF (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
