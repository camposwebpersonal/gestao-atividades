// Fluxo "Marcar no Google Maps": abrir o Google Maps, copiar o ponto e voltar → a localização
// aparece salva sozinha; colar link/coordenadas também funciona; Compartilhar usa o ponto salvo.
// Requer: python3 -m http.server 8090 na raiz e Playwright no NODE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
(async () => {
  const browser = await chromium.launch();
  const {page, ctx} = await boot(browser);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; navigator.share = undefined; });
  await page.evaluate(() => window.openItemModal('i3'));
  await page.waitForSelector('#it-geo-gpaste');
  const out = {};
  // 1) Botão "Marcar no Google Maps" abre o Google já no ponto salvo e mostra o passo a passo
  await page.click('button.google[onclick*="it-geo"]');
  out.abriu = await page.evaluate(() => window.__opened.at(-1));
  out.guia = await page.isVisible('#it-geo-gguide');
  // 2) Usuário copia as coordenadas no Google Maps e volta para a aba
  await page.evaluate(() => navigator.clipboard.writeText('-8.081234, -37.271234'));
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
  await page.waitForFunction(() => document.getElementById('it-geo-lat')?.value === '-8.081234', null, {timeout: 5000});
  out.salvo = await page.textContent('#it-geo-panel');
  out.link = await page.getAttribute('#it-geo-panel a', 'href');
  // 3) Colar um link do Google Maps no campo
  await page.fill('#it-geo-gpaste', 'https://www.google.com/maps/place/UBS/@-8.07,-37.26,17z/data=!3m1!4b1!4m6!3m5!8m2!3d-8.0654321!4d-37.2554321');
  await page.waitForFunction(() => document.getElementById('it-geo-lat')?.value === '-8.0654321', null, {timeout: 5000});
  out.colado = await page.textContent('#it-geo-panel');
  // 4) Compartilhar e Copiar usam exatamente o ponto salvo
  await page.click('#it-geo-panel button:has-text("Compartilhar")');
  out.compartilhado = await page.evaluate(() => navigator.clipboard.readText());
  await page.click('#it-geo-panel button:has-text("Copiar")');
  out.copiado = await page.evaluate(() => navigator.clipboard.readText());
  // 5) Ao salvar o item, a localização vai junto (lida do editor)
  out.lido = await page.evaluate(async () => (await import('/js/geolocation.js?v=12')).readLocationEditor('it-geo'));
  // 6) Mapa rápido aceita colar do Google
  await page.evaluate(() => window.openManualLocationPicker('it-geo'));
  await page.fill('#geo-picker-query', 'WPCM+VG Sertânia');
  await page.click('.geo-picker-methods button[type=submit]');
  await page.waitForFunction(() => /Ponto selecionado/.test(document.getElementById('geo-picker-status')?.textContent || ''), null, {timeout: 5000});
  out.picker = await page.textContent('#geo-picker-status');
  await page.click('#geo-picker-confirm');
  out.pickerSalvo = await page.evaluate(() => document.getElementById('it-geo-lat').value);
  await page.screenshot({path: require('os').tmpdir() + '/google-maps-editor.png'});
  out.contrasteLista = await page.evaluate(() => window.__contrastAudit(document.querySelector('.modal-box'))); out.contraste = out.contrasteLista.length;
  await browser.close();
  console.log(out);
  assert.match(out.abriu, /google\.com\/maps\/search\/\?api=1&query=-8\.060000,-37\.250000/);
  assert.equal(out.guia, true);
  assert.match(out.salvo, /marcada no Google Maps/i); assert.match(out.salvo, /-8\.081234, -37\.271234/);
  assert.match(out.link, /q=-8\.081234,-37\.271234/);
  assert.match(out.colado, /-8\.065432, -37\.255432/);
  assert.match(out.compartilhado, /q=-8\.065432,-37\.255432/);
  assert.equal(out.copiado, '-8.065432, -37.255432');
  assert.equal(out.lido.latitude, -8.0654321); assert.equal(out.lido.source, 'google-link');
  assert.match(out.picker, /Marcado no Google Maps/);
  assert.notEqual(out.pickerSalvo, '-8.0654321');
  assert.equal(out.contraste, 0, 'sem problemas de contraste');
  console.log('google-maps: ok');
})();
