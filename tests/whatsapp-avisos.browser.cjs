// Avisos por WhatsApp: painel do administrador (destinatários, chave, prévia, histórico),
// ⅓ e ⅔ no pipa e os links #foco/… e #mapa/… usados nas mensagens.
// Uso: python3 -m http.server 8090 (na raiz) e NODE_PATH=$(npm root -g) LIBS=…/node_modules/ W=390 node tests/whatsapp-avisos.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const msg = '🆕 *NOVO LANÇAMENTO*\n━━━━━━━━━━━━━━\n📌 *UBS NOVA SERTÂNIA — TROCA DO TELHADO*\n🏛️ SECRETARIA DE SAÚDE\n📁 MANUTENÇÃO DE UBS\n\n🚦 Pendente · 🔴 Urgente\n▫️ Telefone: (87) 99999-0000\n💬 _Infiltração na sala de vacina_\n\n📍 *Localização*\nGoogle Maps: https://www.google.com/maps?q=-8.070000,-37.260000\nPonto no mapa do sistema: https://camposwebpersonal.github.io/gestao-atividades/#mapa/items/i1\n\n🔗 *Abrir no sistema:* https://camposwebpersonal.github.io/gestao-atividades/#foco/items/i1\n\n✍️ Lançado por *RCAMPOS*\n🕒 06/11/2026 às 11:52\n_Gestão de Atividades · Prefeitura de Sertânia_';
const seed = {
  whatsapp_recipients: [{id: 'w1', nome: 'Ricardo (teste)', telefone: '5587974005690', escopo: 'todos', escopo_id: null, eventos: 'todos', ativo: true, apikey_ok: false, created_at: new Date().toISOString()}],
  whatsapp_log: [{id: 1, created_at: new Date().toISOString(), nome: 'Ricardo (teste)', telefone: '5587974005690', titulo: 'UBS NOVA SERTÂNIA — TROCA DO TELHADO', mensagem: msg, status: 'aguardando-chave', detalhe: 'Destinatário ainda sem a chave da CallMeBot.'}],
};

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {seed});
  // A função do servidor é simulada: devolve a prévia.
  await page.evaluate(m => {
    window.__invoked = [];
    window.__fakeInvoke = async (name, opts) => { window.__invoked.push([name, opts?.body]); return {data: opts?.body?.action === 'preview' ? {text: m} : {ok: true}, error: null}; };
  }, msg);

  // Menu lateral mostra o painel para administradores.
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('nav-whatsapp')).display !== 'none'), true);
  await page.evaluate(() => window.openWhatsappAvisos());
  await page.waitForSelector('.wa-rec');
  assert.match(await page.textContent('.wa-rec'), /\+55 \(87\) 97400-5690/);
  assert.match(await page.textContent('.wa-rec'), /Falta a chave de ativação/);
  assert.match(await page.getAttribute('.wa-btn.whatsapp', 'href'), /^https:\/\/wa\.me\/\d+\?text=I%20allow%20callmebot%20to%20send%20me%20messages$/);
  assert.match(await page.textContent('.wa-log'), /Sem chave/);

  // Funções puras: telefone e formatação do WhatsApp.
  const pure = await page.evaluate(async () => { const m = await import('/js/whatsapp-avisos.js?v=1'); return {a: m.normalizePhone('(87) 97400-5690'), b: m.normalizePhone('5587974005690'), c: m.normalizePhone('123'), d: m.whatsappHtml('*Oi* _tudo_ https://x.y/z')}; });
  assert.deepEqual([pure.a, pure.b, pure.c], ['5587974005690', '5587974005690', null]);
  assert.equal(pure.d, '<b>Oi</b> <i>tudo</i> <a href="https://x.y/z" target="_blank" rel="noopener">https://x.y/z</a>');

  // Adicionar destinatário por secretaria (formulário valida o telefone).
  await page.click('.wa-add');
  await page.fill('#wa-form [name=nome]', 'Secretário de Saúde');
  await page.fill('#wa-form [name=telefone]', '87 9 1234');
  await page.selectOption('#wa-form [name=escopo]', 'secretaria');
  assert.equal(await page.isVisible('#wa-form [data-for=secretaria]'), true);
  assert.equal(await page.isVisible('#wa-form [data-for=grupo]'), false);
  await page.click('#wa-form [type=submit]');
  assert.match(await page.textContent('.wa-form-msg'), /WhatsApp inválido/);
  await page.fill('#wa-form [name=telefone]', '(87) 98888-1111');
  await page.selectOption('#wa-form [name=secretaria]', 'sec1');
  await page.click('#wa-form [type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('.wa-rec').length === 2);
  assert.match(await page.textContent('.wa-list'), /SECRETARIA DE SAÚDE/);
  const saved = await page.evaluate(() => window.__fakeDb.whatsapp_recipients.find(r => r.nome === 'Secretário de Saúde'));
  assert.deepEqual([saved.telefone, saved.escopo, saved.escopo_id], ['5587988881111', 'secretaria', 'sec1']);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('.wa-page'))), [], 'painel legível');
  await page.screenshot({path: os.tmpdir() + `/wa-panel-${W}.png`, fullPage: true});

  // Links da mensagem: #foco abre o grupo com o lançamento destacado; #mapa abre o ponto.
  await page.evaluate(() => { history.replaceState(null, '', '#foco/items/i1'); window.restoreWorkspace(); });
  await page.waitForSelector('[data-sort-id="i1"].geo-spotlight');
  await page.evaluate(() => { history.replaceState(null, '', '#mapa/items/i1'); window.restoreWorkspace(); });
  await page.waitForSelector('.leaflet-popup');
  assert.match(await page.textContent('.leaflet-popup'), /UBS NOVA SERTÂNIA/);

  // Pipa: ⅓ e ⅔ entre as frações rápidas.
  await page.evaluate(() => window.openItemModal('i3', 'a2', false, null));
  await page.waitForSelector('input[type=radio][value=parcial]', {state: 'attached'});
  await page.check('input[type=radio][value=parcial]', {force: true});
  await page.waitForSelector('.pipa-fraction-quick');
  await page.click('.pipa-fraction-quick button[data-pct="33"]');
  assert.equal(await page.evaluate(() => document.querySelector('.pipa-fraction-quick button.is-on')?.dataset.pct), '33');
  const fr = await page.evaluate(() => [...document.querySelectorAll('.pipa-fraction-quick button')].map(b => b.textContent.trim()));
  assert.deepEqual(fr, ['¼', '⅓', '½ meio pipa', '⅔', '¾']);

  await browser.close();
  assert.deepEqual(errors, [], 'erros de JavaScript: ' + errors.join(' | '));
  console.log(`whatsapp-avisos (${W}px): ok`);
})().catch(e => { console.error(e); process.exit(1); });
