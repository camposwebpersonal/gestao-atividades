// Senhas vazadas: o site recusa senha que aparece na base pública (Pwned Passwords) ao criar
// usuário ou trocar senha; se a consulta falhar, NÃO atrapalha (segue normalmente).
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) node tests/pwned-password.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
(async () => {
  const browser = await chromium.launch();
  const {page} = await boot(browser, {width: 390});
  page.setDefaultTimeout(8000);
  let online = true;
  await page.route('https://api.pwnedpasswords.com/range/**', r => online
    ? r.fulfill({contentType: 'text/plain', body: r.request().url().endsWith('7C4A8') ? 'D09CA3762AF61E59520943DC26494F8941B:37359195' : '0000000000000000000000000000000000B:1'})
    : r.abort());
  await page.waitForFunction(() => typeof window.checkPwnedPassword === 'function');
  const r = await page.evaluate(async () => [await window.checkPwnedPassword('123456'), await window.checkPwnedPassword('lua-ipe-52')]);
  assert.deepEqual(r[0], {pwned: true, count: 37359195, checked: true});
  assert.equal(r[1].pwned, false); assert.equal(r[1].checked, true);
  // trocar senha de um usuário com senha vazada: bloqueia sem chamar o servidor
  await page.evaluate(() => { window.__pwCalls = 0; window.S.users.push({id: 'uX', email: 'x@pms.sertania.pe.gov.br', displayName: 'X', role: 'usuario', permissoes: {}}); window.openUserModal('uX'); });
  await page.fill('#usr-nova-senha', '123456');
  await page.waitForFunction(() => /vazamentos/.test(document.querySelector('.user-pass-meter[data-for="usr-nova-senha"]').textContent));
  const blocked = await page.evaluate(() => window.changeUserPassword('uX'));
  assert.equal(blocked, false);
  assert.match(await page.locator('.toast-item').last().textContent(), /vazamentos/);
  // sem acesso à base: não bloqueia
  online = false;
  const off = await page.evaluate(() => window.checkPwnedPassword('qualquer-outra-99'));
  assert.deepEqual(off, {pwned: false, count: 0, checked: false});
  console.log('ok - senhas vazadas');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
