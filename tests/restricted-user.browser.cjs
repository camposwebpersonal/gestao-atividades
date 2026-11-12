// Usuário com acesso a UM grupo de uma secretaria: o menu lateral mostra só essa secretaria,
// o atalho da câmera fica ativo (pode lançar no grupo dele) e o "Sair" aparece no topo do celular.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/restricted-user.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);

(async () => {
  const browser = await chromium.launch();
  const seed = {atividades: [{id: 'g9', name: 'MANUTENÇÃO DE ESTRADAS', demanda_secretaria_id: 'sec2', order_num: 9, extra_fields: {modulo: 'atendimentos'}, created_at: new Date().toISOString(), updated_at: new Date().toISOString()}]};
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(8000);
  const modFor = await page.evaluate(() => window.modForSec(window.S.secs.find(g => g.id === 'g9')));
  assert.equal(modFor, 'atendimentos');
  await page.evaluate(() => {
    window.S.isAdmin = false;
    window.S.permissoes = {pode_criar_grupos: false, pode_criar_itens: true, modulos: {atendimentos: {acesso: true, criar: true, editar: true, gerenciar: true, escopo_configurado: true, todos_grupos: {}, secretarias: {}, grupos: {g9: {acesso: true, gerenciar: true}}}}};
    window.setView('mod');
  });
  await page.waitForTimeout(300);
  const sidebar = await page.$$eval('#sidebar-modules .sidebar-secretary-link', els => els.map(e => e.textContent.replace(/[›\s]+$/, '').trim()));
  assert.deepEqual(sidebar, ['SECRETARIA DE AGRICULTURA'], 'menu lateral: ' + sidebar.join(' | '));
  // atalho da câmera ativo
  assert.equal(await page.locator('.field-capture-banner.disabled').count(), 0, 'câmera desativada');
  assert.equal(await page.locator('.field-capture-banner').count(), 1);
  // secretaria sem grupo liberado não abre nem pela tela de escolha
  const canSee = await page.evaluate(() => [window.userCanSeeSecretaria('sec2'), window.userCanSeeSecretaria('sec1'), window.secretaryDestinationCount('sec1')]);
  assert.deepEqual(canSee, [true, false, 0]);
  if (W <= 640) {
    const sair = page.locator('#logout-btn');
    assert.equal(await sair.isVisible(), true, 'Sair visível no celular');
    assert.equal((await page.locator('#logout-btn span').innerText()).trim(), 'Sair');
    const box = await sair.boundingBox(); const nav = await page.locator('#navbar').boundingBox();
    assert.ok(box.x + box.width <= nav.x + nav.width + 1, 'Sair dentro do cabeçalho');
    assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('navbar'))), []);
  }
  await page.screenshot({path: os.tmpdir() + `/restricted-${W}.png`});
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - usuário restrito (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
