// Recursos por grupo: mapa embutido (map_inline + map_emoji) e CADASTRO RESERVA (reserva_destino):
// reserva fora do relatório do destino, envio por card e por seleção, desfazer e aviso de duplicado.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=390 node tests/group-extras.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const geo = (lat, lng) => ({latitude: lat, longitude: lng, accuracy: 8, maps_url: `https://www.google.com/maps?q=${lat},${lng}`, captured_at: now});

(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [
      {id: 'boi', name: 'LOCAIS DE PEGA DE BOI', demanda_secretaria_id: 'sx4', order_num: 9, icon: '🐂', extra_fields: {modulo: 'atendimentos', map_inline: true, map_emoji: '🐂'}, created_at: now, updated_at: now},
      {id: 'res', name: 'CADASTRO RESERVA DE SOLICITAÇÃO DE ÁGUA DE PIPA', demanda_secretaria_id: 'gab', order_num: 10, icon: '📥', extra_fields: {modulo: 'atendimentos', refill_control: false, reserva_destino: 'a2'}, created_at: now, updated_at: now},
    ],
    items: [
      {id: 'b1', atividade_id: 'boi', description: 'PARQUE DO VAQUEIRO', status: 'pendente', concluded: 0, order_num: 0, extra_fields: {geo_location: geo(-8.07, -37.26)}, created_at: now, updated_at: now},
      {id: 'b2', atividade_id: 'boi', description: 'SÍTIO JUREMA', status: 'pendente', concluded: 0, order_num: 1, extra_fields: {}, created_at: now, updated_at: now},
      {id: 'rv1', atividade_id: 'res', description: 'SÍTIO NOVO — JOSÉ', status: 'pendente', concluded: 0, order_num: 0, extra_fields: {}, created_at: now, updated_at: now},
      {id: 'rv2', atividade_id: 'res', description: 'POVOADO RIACHO DO MEL', status: 'pendente', concluded: 0, order_num: 1, extra_fields: {}, created_at: now, updated_at: now},
    ],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);

  // ── mapa embutido ──
  await page.evaluate(() => window.openActivity('boi'));
  await page.waitForSelector('.group-inline-map');
  assert.match(await page.textContent('.group-inline-map'), /1 de 2 com localização · 1 sem ponto marcado/);
  if (process.env.LIBS) { await page.waitForSelector('#group-inline-map .emoji-pin'); assert.match(await page.textContent('#group-inline-map .emoji-pin'), /🐂/); }
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.group-inline-map header'))), []);
  await page.locator('.group-inline-map').screenshot({path: os.tmpdir() + `/boi-${W}.png`});

  // ── reserva ── (RPC simulada: move no banco falso)
  await page.evaluate(() => { window.confirm = () => true; window.moveAttendanceRecord = async ({source_id, target_group}) => { const r = window.__fakeDb.items.find(i => i.id === source_id); r.atividade_id = target_group; r.updated_at = new Date(Date.now() + 1000).toISOString(); return {}; }; });
  await page.evaluate(() => window.openActivity('res'));
  await page.waitForSelector('.reserve-bar');
  assert.match(await page.textContent('.reserve-bar'), /2 em espera/);
  assert.match(await page.textContent('.reserve-bar'), /1 já parece existir/); // RIACHO DO MEL já está no destino
  assert.equal(await page.isDisabled('.reserve-send-selected'), true);
  await page.waitForSelector('.reserve-send-button');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.reserve-bar'))), []);
  await page.locator('.reserve-bar').screenshot({path: os.tmpdir() + `/reserva-${W}.png`});
  // envio pelo botão do card
  await page.locator('.reserve-send-button').first().click();
  await page.waitForFunction(() => document.querySelector('.reserve-bar')?.textContent.includes('1 em espera'));
  assert.equal(await page.evaluate(() => window.S.items.filter(i => ['rv1', 'rv2'].includes(i.id) && i.atividade_id === 'a2').length), 1);
  // desfazer
  await page.locator('.toast-action', {hasText: 'Desfazer'}).click();
  await page.waitForFunction(() => document.querySelector('.reserve-bar')?.textContent.includes('2 em espera'));
  // enviar selecionados
  await page.click('.reserve-select-all');
  assert.equal(await page.isDisabled('.reserve-send-selected'), false);
  await page.click('.reserve-send-selected');
  await page.waitForFunction(() => document.querySelector('.reserve-bar')?.textContent.includes('0 em espera'));
  // destino mostra os novos e o aviso da reserva some quando vazia
  await page.evaluate(() => window.openActivity('a2'));
  await page.waitForSelector('.reserve-chip');
  assert.match(await page.textContent('.reserve-chip'), /0 solicitações aguardam/);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.group-extra-bar')].filter(el => el.scrollWidth > el.clientWidth + 1).length);
  assert.equal(overflow, 0);
  assert.deepEqual(errors.filter(e => !/favicon|net::|tile\.openstreetmap/.test(e)), []);
  console.log(`ok - mapa no grupo e cadastro reserva (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
