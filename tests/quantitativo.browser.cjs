// Resumo "Colaboradores e folha salarial por grupo": soma o campo mesmo com o nome em
// minúsculas no banco ("remuneração") e não quebra no celular.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/quantitativo.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [{id: 'bccs', name: 'BCCS', description: 'Cadastro de Beneficiários BCCS', order_num: 50, show_quantitativo: 1, quantitativo_campo: 'Remuneração', created_at: now, updated_at: now}],
    items: [
      {id: 'gi1', atividade_id: 'bccs', description: 'AGRICULTURA - TOINHO ALMEIDA', order_num: 1, created_at: now, updated_at: now},
      {id: 'gi2', atividade_id: 'bccs', description: 'SERVIÇOS PÚBLICOS E INFRAESTRUTURA - SEDE - ADAUTO JUNIOR', order_num: 2, created_at: now, updated_at: now},
    ],
    subitems: [
      {id: 's1', item_id: 'gi1', description: 'CARLOS', extra_fields: {'remuneração': '550'}, created_at: now, updated_at: now},
      {id: 's2', item_id: 'gi1', description: 'CLARELICE', extra_fields: {'remuneração': 'R$ 550,00'}, created_at: now, updated_at: now},
      {id: 's3', item_id: 'gi2', description: 'DAMIAO', extra_fields: JSON.stringify({'Remuneração': 'R$ 1.825,50'}), created_at: now, updated_at: now},
      {id: 's4', item_id: 'gi2', description: 'DIEGO', extra_fields: {}, created_at: now, updated_at: now},
      {id: 's5', item_id: 'gi2', description: 'INATIVO', concluded: 1, extra_fields: {'remuneração': '9999'}, created_at: now, updated_at: now},
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(8000);
  await page.evaluate(() => window.openActivity('bccs'));
  await page.waitForSelector('.qt-box');
  const money = await page.$$eval('.qt-row .qt-money', els => els.map(e => e.textContent.replace(/\s/g, ' ')));
  assert.deepEqual(money, ['R$ 1.100,00', 'R$ 1.825,50']);
  assert.match(await page.textContent('.qt-total'), /4 ativo\(s\) · R\$ 2\.925,50/);
  assert.match(await page.textContent('.qt-warn'), /1 ativo sem remuneração/);
  // nada vaza da caixa
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.qt-box *')].filter(el => { const r = el.getBoundingClientRect(), b = document.querySelector('.qt-box').getBoundingClientRect(); return r.width && (r.right > b.right + 1 || r.left < b.left - 1); }).map(e => e.className));
  assert.deepEqual(overflow, []);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.qt-box'))), []);
  await page.locator('.qt-box').screenshot({path: os.tmpdir() + `/qt-${W}.png`});
  // breadcrumb: o nível atual aparece inteiro
  const cur = await page.evaluate(() => { const el = document.querySelector('.nav-trail li[aria-current] span:not([aria-hidden])') || document.querySelector('.nav-trail li[aria-current] .nav-trail-here span'); return el.scrollWidth <= el.clientWidth + 1; });
  assert.equal(cur, true, 'nível atual cortado');
  await page.locator('.nav-trail').screenshot({path: os.tmpdir() + `/qt-trail-${W}.png`});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - resumo quantitativo (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
