// Cadastro único (js/cadastro-links.js): a ficha da pessoa mostra onde ela aparece (só grupos visíveis)
// e cada registro ligado de uma lista mostra "👤 Ficha no cadastro", que abre a ficha.
const {chromium} = require('playwright');
const assert = require('assert');
const {boot} = require('./contrast/run.cjs');
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
(async () => {
  const browser = await chromium.launch();
  const W = +(process.env.W || 1366);
  const seed = {
    atividades: [row({id: 'cad-pessoas', name: 'PESSOAS', extra_fields: {modulo: 'cadastros', show_table: 1}}), row({id: 'bccs', name: 'BCCS'}), row({id: 'taxi', name: 'LISTA DE PERMISSIONÁRIOS-TAXISTAS', extra_fields: {modulo: 'atendimentos'}})],
    items: [row({id: 'p1', atividade_id: 'cad-pessoas', description: 'MARIA JOSE GOMES DA SILVA', extra_fields: {Telefone: '87999990000'}}),
      row({id: 'p2', atividade_id: 'cad-pessoas', description: 'JOSE CARLOS DA SILVA', extra_fields: {CPF: '123.456.789-01'}}),
      row({id: 'g1', atividade_id: 'bccs', description: 'AGRICULTURA - TOINHO'}),
      row({id: 't1', atividade_id: 'taxi', description: 'JOSE CARLOS DA SILVA', extra_fields: {cadastro_id: 'p2', cadastro_grupo: 'cad-pessoas', CPF: '123.456.789-01'}})],
    subitems: [row({id: 'sx1', item_id: 'g1', atividade_id: 'bccs', description: 'MARIA JOSE GOMES DA SILVA', extra_fields: {cadastro_id: 'p1', 'função': 'AUXILIAR'}}),
      row({id: 'sx2', item_id: 'g1', atividade_id: 'bccs', description: 'JOSE CARLOS DA SILVA', extra_fields: {cadastro_id: 'p2'}})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  await page.evaluate(() => window.openActivity('cad-pessoas'));
  await page.waitForSelector('.cadl-chips', {timeout: 8000});
  const txt = (await page.textContent('#content')).replace(/\s+/g, ' ');
  assert.match(txt, /MARIA JOSE GOMES DA SILVA.*Aparece em/);
  assert.match(txt, /LISTA DE PERMISSIONÁRIOS-TAXISTAS/);
  assert.doesNotMatch(txt, /cadastro_id|cadastro_grupo|AUXILIAR/);
    await page.evaluate(() => window.openActivity('bccs'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.querySelectorAll('#content .item-header').forEach(h => h.click()); });
  await page.waitForTimeout(800);
  const n = await page.locator('.cadl-chip.is-ficha').count();
  assert.equal(n, 2, 'cada pessoa da lista mostra "Ficha no cadastro"');
    await page.locator('.cadl-chip.is-ficha').first().click();
  await page.waitForTimeout(1200);
  assert.match(await page.textContent('#content'), /PESSOAS/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - cadastro único: "Aparece em" e "Ficha no cadastro" (${W}px)`);
  await browser.close();
})();
