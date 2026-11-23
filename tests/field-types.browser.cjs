// Planilha de lote › ⚙️ Colunas e campos › "⋯": trocar o TIPO de um campo, transformar campo fixo em campo
// personalizado de outro tipo, EXCLUIR campo (fixo ou personalizado) e restaurar/desfazer.
// O banco (RPCs pms_*) é simulado aqui; as RPCs reais foram testadas no Supabase em transação desfeita.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=1366 node tests/field-types.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
(async () => {
  const browser = await chromium.launch();
  const seed = {
    field_templates: [{id: 'ft-tipo', atividade_id: 'a2', scope: 'item', field_name: 'Tipo de serviço', field_type: 'text', options: [], order_num: 0, created_at: now, updated_at: now}],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => {
    const tpl = () => window.S.fieldTemplates;
    window.__calls = []; window.__hist = []; window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return true; };
    window.fieldHistory = async () => window.__hist.filter(h => !h.restored_at);
    window.db.rpc = async (fn, a) => {
      window.__calls.push([fn, a]);
      if (fn === 'pms_change_field_type') { const t = tpl().find(x => x.field_name === a.p_name); window.__hist.push({id: 'h' + window.__hist.length, action: 'tipo', field_name: a.p_name, template: {field_type: t.field_type, options: t.options}, new_type: a.p_type, created_at: new Date().toISOString(), scope: 'item'}); return {data: {records: 3, history_id: 'h'}, error: null}; }
      if (fn === 'pms_delete_field') { const i = tpl().findIndex(x => x.field_name === a.p_name); const [t] = tpl().splice(i, 1); window.__hist.push({id: 'h' + window.__hist.length, action: 'excluir', field_name: a.p_name, template: t, created_at: new Date().toISOString(), scope: 'item'}); (window.__fakeDb.field_templates || []).splice(0, 99, ...(window.__fakeDb.field_templates || []).filter(x => x.field_name !== a.p_name)); return {data: {records: 2}, error: null}; }
      if (fn === 'pms_convert_builtin_field') { const t = {id: 'ft-' + a.p_name, atividade_id: a.p_group, scope: 'item', field_name: a.p_name, field_type: a.p_type, options: a.p_options, order_num: 9}; tpl().push(t); (window.__fakeDb.field_templates ||= []).push({...t, created_at: new Date().toISOString(), updated_at: new Date().toISOString()}); for (const g of [window.S.secs.find(s => s.id === a.p_group), (window.__fakeDb.atividades || []).find(s => s.id === a.p_group)].filter(Boolean)) { const e = typeof g.extra_fields === 'string' ? JSON.parse(g.extra_fields) : (g.extra_fields || {}); g.extra_fields = {...e, removed_fields: [...(e.removed_fields || []), a.p_key]}; g.updated_at = g.sync_at = new Date(Date.now() + 1000).toISOString(); } return {data: {records: 5, name: a.p_name}, error: null}; }
      if (fn === 'pms_restore_field') { const h = window.__hist.find(x => x.id === a.p_history); h.restored_at = 1; if (h.action === 'excluir') { tpl().push(h.template); (window.__fakeDb.field_templates ||= []).push(h.template); } else { const t = tpl().find(x => x.field_name === h.field_name); t.field_type = h.template.field_type; t.options = h.template.options; } return {data: {records: 2, field: h.field_name}, error: null}; }
      return {data: null, error: {message: 'rpc desconhecida ' + fn}};
    };
  });
  const head = () => page.$$eval('#bulk-grid-head [data-col-key]', t => t.map(x => x.dataset.colKey));
  await page.evaluate(() => { localStorage.clear(); window.openBulkEntry('a2'); });
  await page.waitForSelector('#bulk-new-title'); await page.fill('#bulk-new-title', 'LOTE TIPOS');
  await page.getByRole('button', {name: /Criar novo lote/}).click();
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Tipo de serviço"]');
  await page.click('#bulk-col-toggle');

  // 1) trocar o tipo de "Tipo de serviço" (texto → múltipla escolha) com opções
  await page.click('#bulk-col-panel li[data-panel-key="ef:Tipo de serviço"] .bulk-col-more');
  await page.waitForSelector('#bce-type');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('bulk-col-panel'))), []);
  await page.selectOption('#bce-type', 'checkboxes');
  await page.fill('#bce-opts', 'Estourado\nTampa\nLimpeza');
  await page.click('.bce-apply');
  await page.waitForFunction(() => window.S.fieldTemplates.find(t => t.field_name === 'Tipo de serviço')?.field_type === 'checkboxes');
  assert.deepEqual(await page.evaluate(() => window.__calls.at(-1)), ['pms_change_field_type', {p_group: 'a2', p_name: 'Tipo de serviço', p_scope: 'item', p_type: 'checkboxes', p_options: ['Estourado', 'Tampa', 'Limpeza']}]);
  await page.waitForSelector('[data-row="0"][data-key="ef:Tipo de serviço"][data-choice-type="checkboxes"]');
  assert.match(await page.textContent('[data-row="0"][data-key="ef:Tipo de serviço"]'), /Tampa/);

  // 2) transformar o campo fixo "Data da solicitação" em campo de TEXTO chamado "Quando pediu"
  await page.click('#bulk-col-panel li[data-panel-key="start_date"] .bulk-col-more');
  await page.fill('#bce-name', 'Quando pediu'); await page.selectOption('#bce-type', 'text');
  await page.fill('[data-row="0"][data-key="description"]', 'FAMÍLIA SILVA').catch(() => {});
  await page.click('.bce-apply');
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Quando pediu"]');
  assert.ok(!(await head()).includes('start_date'), 'o campo fixo saiu da planilha');
  assert.equal(await page.inputValue('[data-row="0"][data-key="description"]'), 'FAMÍLIA SILVA', 'o que foi digitado continua');

  // 3) excluir o campo fixo "Responsável" e o personalizado "Tipo de serviço"
  await page.click('#bulk-col-panel li[data-panel-key="responsaveis"] .bulk-col-more');
  await page.click('#bulk-col-panel .bce-delete');
  await page.waitForFunction(() => !document.querySelector('#bulk-grid-head [data-col-key="responsaveis"]'));
  assert.deepEqual(await page.evaluate(() => window.S.secs.find(s => s.id === 'a2').extra_fields.removed_fields.sort()), ['responsaveis', 'start_date']);
  await page.click('#bulk-col-panel li[data-panel-key="ef:Tipo de serviço"] .bulk-col-more');
  await page.click('#bulk-col-panel .bce-delete');
  await page.waitForFunction(() => !document.querySelector('#bulk-grid-head [data-col-key="ef:Tipo de serviço"]'));

  // 4) lista "Campos excluídos e alterações": restaurar o personalizado e o fixo
  await page.waitForSelector('#bulk-col-history summary');
  await page.click('#bulk-col-history summary');
  const histText = await page.textContent('#bulk-col-history');
  assert.match(histText, /Responsável/); assert.match(histText, /Tipo de serviço/); assert.match(histText, /Data da solicitação/);
  await page.screenshot({path: os.tmpdir() + `/field-types-${W}.png`, fullPage: false});
  await page.locator('#bulk-col-history li', {hasText: 'excluído por'}).first().getByRole('button').click().catch(async () => { await page.locator('#bulk-col-history li', {hasText: 'Tipo de serviço'}).locator('button', {hasText: 'Restaurar'}).click(); });
  await page.waitForSelector('#bulk-grid-head [data-col-key="ef:Tipo de serviço"]');
  if (!(await page.isVisible('#bulk-col-history summary'))) await page.click('#bulk-col-toggle');
  if (!(await page.$('#bulk-col-history details[open]'))) await page.click('#bulk-col-history summary');
  await page.locator('#bulk-col-history li', {hasText: 'Responsável'}).locator('button').click();
  await page.waitForSelector('#bulk-grid-head [data-col-key="responsaveis"]');

  // 5) formulário do item: campo fixo transformado some (o novo campo personalizado aparece)
  await page.click('#bulk-col-panel .bulk-col-done');
  await page.evaluate(() => window.bulkSaveAndClose());
  await page.evaluate(() => window.openItemModal(null, 'a2', false, null));
  await page.waitForSelector('#it-start', {state: 'attached'});
  assert.equal(await page.evaluate(() => document.getElementById('it-start').closest('.form-group').hidden), true, 'Data da solicitação some do formulário');
  assert.equal(await page.evaluate(() => document.getElementById('it-resp').closest('.form-group')?.hidden || false), false, 'Responsáveis restaurado aparece');
  assert.ok(await page.$('#modal-ov label[data-ef-field="Quando pediu"]'));
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - trocar tipo, transformar, excluir e restaurar campos (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
