// Link de conferência DENTRO do sistema: menu ⚙️ Mais › 🔗 Link de conferência, janela (editar padrão / só ver,
// aviso de que um link novo zera a conferência), faixa "Conferência em andamento · X de Y", selo ✓ Conferido
// no canto dos lançamentos, "Grupo conferido" quando termina e "Conferência" no PDF (controlFields).
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'g-conf', name: 'ESCOLAS PARA CONFERIR', extra_fields: {conferencia_link: 'L1', conferencia_desde: now, conferencia_modo: 'editar'}})],
    items: [row({id: 'lc1', atividade_id: 'g-conf', description: 'ESCOLA JOSÉ'}), row({id: 'lc2', atividade_id: 'g-conf', description: 'CRECHE MARIA', order_num: 1})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  await page.evaluate(() => { const it = window.S.items.find(i => i.id === 'lc1'); it.conferencia = {link: 'L1', em: '2026-11-23T20:00:00Z', por: 'Ana'}; it.extra_fields = {...(it.extra_fields || {}), conferencia: it.conferencia}; });
  await page.evaluate(() => window.openActivity('g-conf'));
  await page.waitForSelector('.conf-banner');
  assert.match((await page.textContent('.conf-banner')).replace(/\s+/g, ' '), /Conferência em andamento · 1 de 2/);
  assert.equal(await page.locator('#ir-lc1.is-conferido').count(), 1);
  assert.equal(await page.locator('#ir-lc2.is-conferido').count(), 0);
  assert.match(await page.$eval('#ir-lc1 > .item-header', el => getComputedStyle(el, '::before').content), /Conferido/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  // PDF: campo "Conferência"
  const cf = await page.evaluate(async () => (await import('./js/record-fields.js')).controlFields(window.S.items.find(i => i.id === 'lc1'), {}, false));
  assert.match(cf.find(f => f.key === 'conferencia').value, /Conferido em 23\/11\/2026 por Ana/);
  // menu + janela
  assert.ok(await page.locator('.gcb-item', {hasText: 'Link de conferência'}).count());
  await page.evaluate(() => {
    const link = {id: 'L2', token: 'TOKEN123', modo: 'editar', created_at: new Date().toISOString(), created_by_name: 'RCAMPOS', visits: 0};
    window.__links = [];
    window.db.from = () => { const q = {select: () => q, eq: () => q, is: () => q, order: () => q, limit: async () => ({data: window.__links})}; return q; };
    window.db.rpc = async (name, args) => { window.__rpc = [name, args]; if (name === 'pms_share_create') { window.__links = [link]; return {data: {token: link.token, id: link.id, modo: args.p_modo}}; } return {data: null}; };
    window.confirm = () => true;
  });
  await page.evaluate(() => window.openConferenciaLink('g-conf'));
  await page.waitForSelector('.conf-modes');
  assert.equal(await page.locator('input[name="conf-modo"][value="editar"]').isChecked(), true, 'editar vem marcado');
  assert.match(await page.textContent('.conf-warn'), /recomeça do zero/);
  await page.click('.conf-create');
  await page.waitForSelector('.conf-url input');
  assert.deepEqual(await page.evaluate(() => window.__rpc), ['pms_share_create', {p_group: 'g-conf', p_modo: 'editar'}]);
  assert.match(await page.inputValue('.conf-url input'), /conferir\.html\?t=TOKEN123$/);
  assert.match(await page.getAttribute('.conf-zap', 'href'), /wa\.me/);
  // grupo conferido
  await page.evaluate(() => { const g = window.S.secs.find(s => s.id === 'g-conf'); g.conferencia_concluida = {em: '2026-11-23', por: 'Ana'}; window.closeModal(); window.openActivity('g-conf'); });
  await page.waitForSelector('.conf-banner.is-done');
  assert.match(await page.textContent('.conf-banner.is-done'), /Grupo conferido/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - link de conferência no sistema (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
