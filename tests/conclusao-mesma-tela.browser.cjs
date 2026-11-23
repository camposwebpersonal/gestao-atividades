// Controle de conclusão "na mesma tela": o lançamento concluído permanece no lugar, marcado ✅ Concluído
// (sem ir para a aba Concluídos). O modo padrão continua separando os concluídos.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'g-inl', name: 'EXPOCOSE TESTE', controle_pendencias: 1, extra_fields: {conclusao_modo: 'mesma_tela'}}), row({id: 'g-aba', name: 'GRUPO PADRÃO', controle_pendencias: 1})],
    items: [row({id: 'cmt1', atividade_id: 'g-inl', description: 'PALCO PRINCIPAL', concluded: 1, status: 'concluido'}), row({id: 'cmt2', atividade_id: 'g-inl', description: 'CAMAROTES', order_num: 1, status: 'pendente'}),
      row({id: 'cmt3', atividade_id: 'g-aba', description: 'FEITO', concluded: 1, status: 'concluido'}), row({id: 'cmt4', atividade_id: 'g-aba', description: 'FALTA', order_num: 1, status: 'pendente'})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  // o banco falso não guarda 'concluded' na carga inicial: marca direto no estado (como os outros testes)
  await page.evaluate(() => ['cmt1', 'cmt3'].forEach(id => Object.assign(window.S.items.find(i => i.id === id), {concluded: 1, status: 'concluido'})));
  await page.evaluate(() => window.openActivity('g-inl'));
  await page.waitForSelector('#ir-cmt1');
  assert.ok(await page.locator('#ir-cmt1.is-done-inline').count(), 'concluído continua na tela, marcado');
  assert.ok(await page.locator('#ir-cmt2').count(), 'pendente na tela');
  assert.equal(await page.locator('#ir-cmt2.is-done-inline').count(), 0);
  const order = await page.$$eval('.item-row', r => r.map(x => x.id));
  assert.deepEqual(order.slice(0, 2), ['ir-cmt1', 'ir-cmt2'], 'mesma posição de antes');
  assert.match((await page.textContent('.inline-done-summary')).replace(/\s+/g, ' '), /1 de 2 concluídos/);
  const stamp = await page.$eval('#ir-cmt1 > .item-header', el => getComputedStyle(el, '::after').content);
  assert.match(stamp, /Concluído/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  // alternar pelo menu leva de volta ao modo com aba
  await page.evaluate(() => window.alternarModoConclusao('g-inl'));
  await page.waitForFunction(() => !document.querySelector('#ir-cmt1'));
  // grupo padrão: concluído sai da tela ativa
  await page.evaluate(() => ['cmt1', 'cmt3'].forEach(id => Object.assign(window.S.items.find(i => i.id === id), {concluded: 1, status: 'concluido'})));
  await page.evaluate(() => window.openActivity('g-aba'));
  await page.waitForSelector('#ir-cmt4');
  assert.equal(await page.locator('#ir-cmt3').count(), 0);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - conclusão na mesma tela (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
