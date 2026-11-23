// Planilha de lote: renomear qualquer coluna (fixa ou campo personalizado), ocultar/mostrar sem perder o que foi
// digitado, criar campo novo na hora; o nome escolhido vale também no formulário do item.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/field-labels.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {field_templates: [{id: 'ft-com', atividade_id: 'a2', scope: 'item', field_name: 'Comunidade', field_type: 'text', options: [], order_num: 0, created_at: now, updated_at: now}]};
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  // RPC do banco simulada: renomeia o modelo do campo e devolve as contagens
  await page.evaluate(() => { window.__rpcCalls = []; window.db.rpc = async (fn, args) => { window.__rpcCalls.push([fn, args]); (window.S.fieldTemplates || []).forEach(t => { if (t.atividade_id === args.p_group && t.field_name === args.p_old) t.field_name = args.p_new; }); (window.__fakeDb?.field_templates || []).forEach(t => { if (t.atividade_id === args.p_group && t.field_name === args.p_old) Object.assign(t, {field_name: args.p_new, sync_at: new Date(Date.now() + 1000).toISOString(), updated_at: new Date(Date.now() + 1000).toISOString()}); }); return {data: {templates: 1, items: 2, subitems: 0, drafts: 0}, error: null}; }; });
  const heads = () => page.$$eval('#bulk-grid-head [data-col-key]', ths => ths.map(th => th.dataset.colKey + '=' + th.querySelector('.bulk-col-name').textContent.trim()));
  await page.evaluate(() => { localStorage.clear(); window.openBulkEntry('a2'); });
  await page.waitForSelector('#bulk-new-title'); await page.fill('#bulk-new-title', 'LOTE NOMES');
  await page.getByRole('button', {name: /Criar novo lote/}).click();
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Comunidade"]');
  await page.fill('[data-row="0"][data-key="description"]', 'FAMÍLIA SOUZA');
  await page.fill('[data-row="0"][data-key="responsaveis"]', 'JOÃO');
  await page.fill('[data-row="0"][data-key="ef:Comunidade"]', 'Sítio Jurema');

  // 1) ✏️ no título: "Nome / descrição" → "Nome do morador" (o * de obrigatório continua)
  await page.click('#bulk-grid-head [data-col-key="description"] .bulk-col-rename');
  await page.fill('#bulk-grid-head .bulk-col-edit', 'Nome do morador'); await page.press('#bulk-grid-head .bulk-col-edit', 'Enter');
  await page.waitForFunction(() => /Nome do morador \*/.test(document.querySelector('#bulk-grid-head [data-col-key="description"]').textContent));
  assert.equal(await page.evaluate(() => window.S.secs.find(s => s.id === 'a2').extra_fields.field_labels.description), 'Nome do morador');

  // 2) painel: renomear coluna fixa e campo personalizado
  await page.click('#bulk-col-toggle'); await page.waitForSelector('#bulk-col-panel .bulk-col-label');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('bulk-col-panel'))), []);
  await page.fill('#bulk-col-panel input[data-key="start_date"]', 'Data do pedido'); await page.press('#bulk-col-panel input[data-key="start_date"]', 'Enter');
  await page.waitForFunction(() => /Data do pedido/.test(document.querySelector('#bulk-grid-head [data-col-key="start_date"]').textContent));
  await page.fill('#bulk-col-panel input[data-key="ef:Comunidade"]', 'Localidade / sítio'); await page.press('#bulk-col-panel input[data-key="ef:Comunidade"]', 'Enter');
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Localidade / sítio"]');
  assert.deepEqual(await page.evaluate(() => window.__rpcCalls[0]), ['pms_rename_field', {p_group: 'a2', p_old: 'Comunidade', p_new: 'Localidade / sítio', p_scope: 'item'}]);
  assert.equal(await page.inputValue('[data-row="0"][data-key="ef:Localidade / sítio"]'), 'Sítio Jurema', 'o que foi digitado acompanha o novo nome');

  // 3) ocultar "Responsável": some da planilha, mas o valor digitado continua guardado e volta ao mostrar
  await page.click('#bulk-col-panel li[data-panel-key="responsaveis"] .bulk-col-eye');
  await page.waitForFunction(() => !document.querySelector('#bulk-grid-head [data-col-key="responsaveis"]'));
  assert.equal(await page.isVisible('#bulk-col-panel li[data-panel-key="responsaveis"].is-hidden'), true);
  await page.click('#bulk-col-panel li[data-panel-key="responsaveis"] .bulk-col-eye');
  await page.waitForSelector('#bulk-grid-head [data-col-key="responsaveis"]');
  assert.equal(await page.inputValue('[data-row="0"][data-key="responsaveis"]'), 'JOÃO');

  // 4) criar campo novo (lista) direto na planilha
  await page.click('#bulk-col-panel .bulk-col-new > summary');
  await page.fill('#bulk-new-field-name', 'Tipo de cisterna'); await page.selectOption('#bulk-new-field-type', 'combobox');
  await page.fill('#bulk-new-field-opts', 'Placa\nPolietileno');
  await page.click('.bulk-col-create');
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Tipo de cisterna"]');
  assert.deepEqual(await page.$$eval('[data-row="0"][data-key="ef:Tipo de cisterna"] option', o => o.map(x => x.textContent).filter(Boolean)).then(v => v.slice(-2)), ['Placa', 'Polietileno']);
  await page.locator('#bulk-col-panel').screenshot({path: os.tmpdir() + `/field-labels-panel-${W}.png`});
  await page.screenshot({path: os.tmpdir() + `/field-labels-${W}.png`});
  console.log((await heads()).join(' | ')); // (o banco falso não marca sync_at; no Supabase o gatilho pms_sync_at leva o nome novo a todos os aparelhos)
  await page.click('#bulk-col-panel .bulk-col-done');
  await page.evaluate(() => window.bulkSaveAndClose());

  // 5) formulário do item usa os nomes escolhidos
  await page.evaluate(() => window.openItemModal(null, 'a2', false, null));
  await page.waitForSelector('#it-name');
  await page.waitForFunction(() => /Nome do morador/.test(document.getElementById('it-name').closest('.form-group').querySelector('label').textContent));
  assert.match(await page.evaluate(() => document.getElementById('it-start').closest('.form-group').querySelector('label').textContent), /Data do pedido/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - renomear/ocultar/criar colunas do lote (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
