// Janela "Editar usuário": senha logo abaixo de Usuário/Nível, sempre visível (texto),
// secretarias em cards recolhidos e topo fixo "NOME · login".
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/user-modal.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W, seed: {users: [{id: 'u9', uid: 'u9', email: 'claudiaif@pms.sertania.pe.gov.br', displayName: 'CLAUDIA', role: 'usuario', permissoes: {}}]}});
  page.setDefaultTimeout(8000);
  await page.evaluate(() => { window.S.users = [...(window.S.users || []).filter(u => u.id !== 'u9'), {id: 'u9', email: 'claudiaif@pms.sertania.pe.gov.br', displayName: 'CLAUDIA', role: 'usuario', permissoes: {}}]; window.openUserModal('u9'); });
  await page.waitForSelector('#usr-nova-senha');
  // senha visível e logo depois do nível de acesso
  assert.equal(await page.getAttribute('#usr-nova-senha', 'type'), 'text');
  const order = await page.evaluate(() => { const els = [...document.querySelectorAll('#usr-user,#usr-role,#usr-nova-senha,.user-general-permissions')]; return els.map(e => e.id || e.className.split(' ')[0]); });
  assert.deepEqual(order.slice(0, 3), ['usr-user', 'usr-role', 'usr-nova-senha']);
  // topo: nome + login
  const head = () => page.evaluate(() => ({name: document.querySelector('#modal-ctx .modal-ctx-name')?.textContent, login: document.querySelector('#modal-ctx .modal-ctx-suffix')?.textContent}));
  assert.deepEqual(await head(), {name: 'CLAUDIA', login: 'claudiaif'});
  await page.fill('#usr-user', 'claudia.if');
  assert.equal((await head()).login, 'claudia.if');
  // sugerir senha preenche e mede
  await page.click('button:has-text("Sugerir")');
  assert.match(await page.inputValue('#usr-nova-senha'), /^[a-z]+-[a-z]+-\d\d$/);
  assert.match(await page.textContent('.user-pass-meter'), /caracteres/);
  // cards de secretaria recolhidos
  const cards = await page.locator('.perm-card').count();
  if (cards) {
    assert.equal(await page.locator('.perm-card.is-collapsed').count(), cards);
    await page.locator('.perm-card-toggle').first().scrollIntoViewIfNeeded();
    await page.locator('.perm-card-toggle').first().click();
    assert.equal(await page.locator('.perm-card-toggle').first().getAttribute('aria-expanded'), 'true');
  }
  // rolando até o fim, o topo continua visível
  await page.evaluate(() => { const box = document.querySelector('#modal-ov .modal-box'); box.scrollTop = box.scrollHeight; });
  await page.waitForTimeout(150);
  const visible = await page.evaluate(() => { const r = document.getElementById('modal-ctx').getBoundingClientRect(), b = document.querySelector('#modal-ov .modal-box').getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom && r.height > 20; });
  assert.equal(visible, true);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#modal-ov'))), []);
  await page.screenshot({path: os.tmpdir() + `/user-modal-${W}.png`});
  console.log(`ok - janela de usuário (${W}px) · cards: ${cards}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
