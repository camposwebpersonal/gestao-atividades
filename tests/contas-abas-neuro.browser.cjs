// Controle de Contas › TODAS as abas com neuroarquitetura (Lançamentos, Vencimentos, Relatório, Cadastro) + PDF geral.
// Garante: passos numerados e meses com situação em palavras; vencimentos por urgência com "✓ Marcar paga";
// fichas de resumo em todas as abas; NENHUM texto sai do seu card de 360 a 1920 px; contraste AA; PDF com
// cabeçalho compacto, situação em frase, fichas e "Página X de Y".
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=1366 node tests/contas-abas-neuro.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os');
const {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const Y = new Date().getFullYear();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const conta = (id, local, mes, valor, pago, venc) => row({id, atividade_id: 'ccx', nome: 'Luz', valor, extra_fields: {subitem_id: local, item_id: 'x', tipo: 'Luz', mes_ano: mes, pago, data_vencimento: venc, data_pagamento: pago ? venc : ''}});
(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'ccx', name: 'CONTROLE DE CONTAS', controle_contas: 1})],
    items: [row({id: 'cat-esc', atividade_id: 'ccx', description: 'ESCOLAS'}), row({id: 'cat-sau', atividade_id: 'ccx', description: 'UNIDADES DE SAÚDE', order_num: 1})],
    subitems: [
      row({id: 'l1', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'ESCOLA MUNICIPAL PRESIDENTE VARGAS', extra_fields: {'Conta Contrato': '22143'}}),
      row({id: 'l2', item_id: 'cat-esc', atividade_id: 'ccx', parent_type: 'item', description: 'CRECHE BARTOLOMEU'}),
      row({id: 'l3', item_id: 'cat-sau', atividade_id: 'ccx', parent_type: 'item', description: 'HOSPITAL MARIA ALICE GOMES LAFAYETTE'}),
    ],
    // valores enormes de propósito para provar que nada sai do card
    contas: [conta('k1', 'l1', `01/${Y}`, 1853378.61, true, `${Y}-01-28`), conta('k2', 'l1', `02/${Y}`, 549.38, false, iso(-13)),
      conta('k3', 'l2', `03/${Y}`, 100, false, iso(3)), conta('k4', 'l3', `04/${Y}`, 455662.94, false, iso(-40)), conta('k5', 'l3', `05/${Y}`, 210.5, false, iso(20))],
  };
  const {page, errors} = await boot(browser, {width: W, seed, tz: 'America/Recife'});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => window.renderControleContas('ccx'));
  const txt = async sel => (await page.textContent(sel)).replace(/\s+/g, ' ');
  const overflow = () => page.evaluate(() => [...document.querySelectorAll('.ccn-kpi, .ccn-mini, button.cc-month, .ccv-row, .ccn-intro, .ccn-hero')].filter(c => c.offsetParent).flatMap(card => {
    const c = card.getBoundingClientRect();
    return [...card.querySelectorAll('b,small,span,strong')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > c.right + 0.5 || r.left < c.left - 0.5 || el.scrollWidth > el.clientWidth + 1); }).map(el => `${card.className}: "${el.textContent.trim().slice(0, 40)}"`);
  }));
  const sweep = async tab => {
    for (const width of [360, 390, 600, 900, 1280, 1920]) {
      await page.setViewportSize({width, height: 900}); await page.evaluate(() => document.fonts?.ready); await page.waitForTimeout(450);
      assert.deepEqual(await overflow(), [], `${tab}: vazou em ${width}px`);
    }
    await page.setViewportSize({width: W, height: 900}); await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), [], `${tab}: contraste`);
    await page.screenshot({path: os.tmpdir() + `/contas-${tab}-${W}.png`, fullPage: true});
  };

  // 🧾 Lançamentos: faixa de orientação, passos numerados, meses com situação em palavras
  await page.evaluate(() => window.ccSetModo('ccx', 'lancamentos'));
  await page.waitForSelector('.cc-drilldown');
  assert.match(await txt('.ccn-intro'), /Lançar e conferir.*Siga os passos/);
  assert.deepEqual(await page.$$eval('.cc-drill-label i', e => e.map(x => x.textContent)), ['1', '2', '3', '4', '5']);
  assert.match(await txt('button.cc-month.all-paid'), /JAN.*1\.853\.378,61.*tudo pago/);
  assert.match(await txt('button.cc-month.has-pend'), /FEV.*1 pendente/);
  assert.equal(await page.locator('button.cc-month').count(), 12);
  assert.match(await txt('.cc-local-summary'), /Total do ano: R\$ 1\.853\.927,99.*Pendente: R\$ 549,38/);
  // seletor compacto de locais: pílulas com bolinha de situação + filtro instantâneo; PDF do topo = aba ativa
  assert.equal(await page.locator('.cc-lpill').count(), 2);
  assert.match(await txt('.ccn-pdf'), /PDF dos lançamentos/);
  await page.evaluate(() => window.ccNavegar('ccx', 'setor', 'cat-esc'));
  assert.equal(await page.locator('.cc-lpill.st-pend').count(), 2);
  await sweep('lancamentos');

  // ⏰ Vencimentos: situação em frase, grupos por urgência, ação direta
  await page.evaluate(() => window.ccSetModo('ccx', 'vencimentos'));
  await page.waitForSelector('.ccv-row');
  assert.match(await txt('.cc-venc-panel .ccn-hero'), /2 contas vencidas · R\$ 456\.212,32.*Comece pela mais antiga \(HOSPITAL MARIA ALICE GOMES LAFAYETTE, há 40 dias\)/);
  assert.deepEqual(await page.$$eval('.ccv-group h3', h => h.map(x => x.textContent.replace(/^\S+\s/, ''))), ['Vencidas', 'Vencem esta semana', 'Próximos 30 dias']);
  assert.match(await txt('.ccv-group.is-late .ccv-row'), /HOSPITAL.*UNIDADES DE SAÚDE · Luz.*há 40 dias.*R\$ 455\.662,94.*Marcar paga/);
  assert.match(await txt('.ccv-group.is-week'), /CRECHE BARTOLOMEU.*em 3 dias/);
  await sweep('vencimentos');
  assert.match(await txt('.ccn-pdf'), /PDF dos vencimentos/);
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
    await page.click('.ccn-pdf');
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const v = await page.evaluate(() => window.__pdf); const vf = os.tmpdir() + `/contas-venc-${W}.pdf`; fs.writeFileSync(vf, Buffer.from(v.b64, 'base64'));
    const vt = execFileSync('pdftotext', ['-layout', vf, '-']).toString();
    for (const piece of ['VENCIMENTOS', 'conta(s) vencida(s)', 'Vencidas · 2 conta(s)', 'HOSPITAL MARIA ALICE', 'Vencem esta semana', 'Página 1 de']) assert.ok(vt.includes(piece), 'faltou no PDF de vencimentos: ' + piece);
    assert.match(v.name, /^VENCIMENTOS-/);
  }
  await page.click('.ccv-group.is-late .ccv-row:first-child .ccv-pay');
  await page.waitForFunction(() => window.S.contas.find(c => c.id === 'k4')?.pago === true);
  const k4 = await page.evaluate(() => window.S.contas.find(c => c.id === 'k4'));
  assert.ok(k4.data_pagamento, 'data de pagamento preenchida ao marcar como paga');

  // 📑 Relatório e 🏢 Cadastro: situação + fichas
  await page.evaluate(() => window.ccSetModo('ccx', 'relatorio'));
  await page.waitForSelector('.ccr .ccn-kpi');
  assert.match(await txt('.ccr .ccn-hero'), /Relatório por secretaria.*Já foram pagos/);
  assert.equal(await page.locator('.ccr .ccn-kpi').count(), 4);
  await sweep('relatorio');
  await page.evaluate(() => window.ccSetModo('ccx', 'cadastro'));
  await page.waitForSelector('.ccr-cadastro .ccn-kpi');
  assert.match(await txt('.ccr-cadastro .ccn-hero'), /2 local\(is\) sem conta contrato/);
  await sweep('cadastro');

  // 📄 PDF geral com neuroarquitetura
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
    await page.evaluate(() => window.ccGerarPdf('ccx', {ano: null, tipo: '', pago: '', busca: '', buscaTokens: []}));
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64} = await page.evaluate(() => window.__pdf);
    const file = os.tmpdir() + `/contas-geral-${W}.pdf`; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const text = execFileSync('pdftotext', ['-layout', file, '-']).toString();
    for (const piece of ['CONTROLE DE CONTAS', 'Prefeitura Municipal de Sertânia', 'conta(s) vencida(s)', 'TOTAL EM CONTAS', 'PAGO', 'PENDENTE', 'VENCIDAS', 'do valor já pago', 'Resumo por categoria', 'Detalhamento por lançamento', 'Total geral:', 'Página 1 de'])
      assert.ok(text.includes(piece), 'faltou no PDF: ' + piece);
    assert.doesNotMatch(text, /\d{2}\/\d{2}\/\d{4}/.test(text) ? /\b(0?[1-9]|1[0-2])\/(1[3-9]|2\d|3[01])\/\d{4}\b/ : /^$/, 'datas no formato dd/mm/aaaa');
  }
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - todas as abas do Controle de Contas com neuroarquitetura + PDF (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
