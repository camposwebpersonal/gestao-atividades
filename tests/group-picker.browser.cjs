// Janela "Mover atendimento": destino organizado por secretaria, secretaria pai sempre visível,
// busca por secretaria ou grupo, Enter escolhe, cartão "Destino" e "Usados recentemente".
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/group-picker.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, ...o});
const att = {modulo: 'atendimentos'};

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [
      row({id: 'dg1', name: 'Demandas Gerais de Campo', demanda_secretaria_id: 'sec1', icon: '🧭', extra_fields: att}),
      row({id: 'dg2', name: 'Demandas Gerais de Campo', demanda_secretaria_id: 'sec2', icon: '🧭', extra_fields: att}),
      row({id: 'dg3', name: 'Demandas Gerais de Campo', demanda_secretaria_id: 'gab', icon: '🧭', extra_fields: att}),
      row({id: 'gpp', name: 'OPERAÇÃO CARRO PIPA', demanda_secretaria_id: 'gab', icon: '🚚', extra_fields: att}),
      row({id: 'met', name: 'SOLICITAÇÃO DE METRALHA', demanda_secretaria_id: 'sec2', icon: '🧱', extra_fields: att}),
    ],
    items: [row({id: 'mv1', atividade_id: 'dg3', description: 'GERALDO FIRMINO', concluded: 0, status: 'pendente', extra_fields: {}})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => localStorage.removeItem('gestao-move-recentes-v1'));
  await page.evaluate(() => window.openMoveAttendance('mv1', 'items'));
  await page.waitForSelector('#move-group-picker .gp-group');

  // agrupado por secretaria, origem (GABINETE) primeiro, e cada grupo mostra a secretaria pai
  const heads = await page.$$eval('.gp-block:not(.gp-recent) h4 span', els => els.map(e => e.textContent));
  assert.equal(heads[0], 'GABINETE', heads.join(' | '));
  assert.ok(heads.includes('SECRETARIA DE SAÚDE') && heads.includes('SECRETARIA DE AGRICULTURA'), heads.join(' | '));
  assert.equal(await page.isVisible('.gp-chosen'), false, 'cartão Destino só aparece depois de escolher');
  const dupes = await page.$$eval('.gp-group', els => els.filter(e => e.textContent.includes('Demandas Gerais de Campo')).map(e => e.querySelector('small').textContent));
  assert.ok(dupes.some(t => t.includes('SECRETARIA DE SAÚDE')) && dupes.some(t => t.includes('SECRETARIA DE AGRICULTURA')), dupes.join(' | '));
  assert.equal(await page.$('.gp-group[data-group="dg3"]'), null, 'o grupo de origem não aparece como destino');
  assert.equal(await page.isDisabled('#move-attendance-submit'), true);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.group-picker'))), []);
  await page.locator('#modal-ov .modal-box').screenshot({path: os.tmpdir() + `/picker-${W}.png`});

  // busca pelo nome da secretaria mostra os grupos dela
  await page.fill('.gp-search input', 'agricult');
  const vis = () => page.$$eval('.gp-group:not([hidden])', els => els.filter(e => !e.closest('[hidden]')).map(e => e.dataset.group));
  assert.deepEqual((await vis()).sort(), ['dg2', 'met']);
  // busca pelo nome do grupo, sem acento, com destaque
  await page.fill('.gp-search input', 'metralha');
  assert.deepEqual(await vis(), ['met']);
  assert.equal(await page.textContent('.gp-group[data-group="met"] mark'), 'METRALHA');
  // secretaria + grupo juntos
  await page.fill('.gp-search input', 'saude gerais');
  assert.deepEqual(await vis(), ['dg1']);
  await page.fill('.gp-search input', 'xyz inexistente');
  assert.equal(await page.isHidden('.gp-empty'), false);
  // Enter escolhe o primeiro resultado e mostra o caminho
  await page.fill('.gp-search input', 'saude gerais');
  await page.press('.gp-search input', 'Enter');
  assert.match(await page.textContent('.gp-chosen-path'), /SECRETARIA DE SAÚDE\s*›\s*🧭 Demandas Gerais de Campo/);
  assert.equal(await page.inputValue('#move-group'), 'dg1');
  assert.equal(await page.isDisabled('#move-attendance-submit'), false);
  assert.ok(await page.$('#move-parent'), 'campos do destino aparecem');
  await page.locator('#modal-ov .modal-box').screenshot({path: os.tmpdir() + `/picker-chosen-${W}.png`});
  assert.equal(await page.isVisible('.gp-search'), false, 'lista some depois de escolher');
  // trocar volta para a lista
  await page.click('.gp-change');
  assert.equal(await page.inputValue('#move-group'), '');
  assert.equal(await page.isDisabled('#move-attendance-submit'), true);
  await page.click('.gp-group[data-group="met"]');

  // mover de verdade (RPC simulada) e lembrar o destino
  await page.evaluate(() => { window.__moved = null; });
  await page.route('**/rest/v1/rpc/move_attendance_record**', r => r.fulfill({status: 200, contentType: 'application/json', body: '{}'}));
  await page.evaluate(() => window.confirmMoveAttendance());
  await page.waitForFunction(() => document.getElementById('modal-ov').style.display === 'none' || /Erro/.test(document.getElementById('toast').textContent));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gestao-move-recentes-v1') || '[]')), ['met']);
  // na próxima vez, "Usados recentemente" aparece no topo
  await page.evaluate(() => { window.S.items.push({id: 'mv2', atividade_id: 'dg1', description: 'OUTRO', concluded: 0, extra_fields: {}}); window.openMoveAttendance('mv2', 'items'); });
  await page.waitForSelector('.gp-recent .gp-group[data-group="met"]');
  const overflow = await page.evaluate(() => { const b = document.querySelector('#modal-ov .modal-box'); return b.scrollWidth > b.clientWidth + 1; });
  assert.equal(overflow, false, 'janela não pode vazar na horizontal');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - seletor de destino por secretaria (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
