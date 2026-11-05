// Questionários de Defesa Civil (ICM / TCE-PE): área própria, respostas, opções exclusivas,
// "Outros", salvar com nome/data/hora, histórico e barra de salvar fixa no topo.
// Requer: python3 -m http.server 8090 na raiz e Playwright no NODE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser);
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  const out = {};
  await page.evaluate(() => { const d = window.S.secretarias.find(s => s.name === 'DEFESA CIVIL'); window.openSecretaryWorkspace(d.id); });
  out.destinos = await page.locator('.secretary-workspace-grid>button').allTextContents();
  await page.click('.secretary-workspace-grid>button:has-text("Questionários")');
  await page.waitForSelector('.dcq-page');
  out.perguntasDiag = await page.locator('.dcq-q').count();
  out.dimensoes = await page.locator('.dcq-dim-title').allTextContents();
  // responde uma pergunta e confere progresso
  await page.check('input[name="dcq-diagnostico-1"][value="Sim"]');
  out.progresso1 = await page.textContent('.dcq-savebar.is-top .dcq-savebar-progress span');
  out.naoSalvo = await page.textContent('.dcq-savebar.is-top .dcq-state');
  // carrega as respostas enviadas ao TCE
  await page.click('.dcq-import');
  out.progressoTce = await page.textContent('.dcq-savebar.is-top .dcq-savebar-progress span');
  out.resumo = await page.textContent('.dcq-summary');
  // barra fixa: rola até o fim e confere que a barra de cima continua visível
  await page.evaluate(() => document.getElementById('dcq-diagnostico-12').scrollIntoView({block: 'center'}));
  await page.waitForTimeout(400);
  out.barraVisivel = await page.evaluate(() => { const bar = document.querySelector('.dcq-savebar.is-float'); const r = bar.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return document.querySelector('.dcq-page').classList.contains('has-floating-bar') && r.top >= 0 && r.bottom <= innerHeight && bar.contains(hit); });
  await page.click('.dcq-savebar.is-top .dcq-save');
  await page.waitForFunction(() => (window.__fakeDb.defesa_civil_questionarios || []).length === 1, null, {timeout: 8000});
  const row = await page.evaluate(() => window.__fakeDb.defesa_civil_questionarios[0]);
  out.salvo = {id: row.id, nome: row.preenchido_por_nome, por: row.preenchido_por, temData: !!row.preenchido_em, hist: row.historico.length, r1: row.respostas['1'], r21: row.respostas['21']};
  out.assinatura = await page.textContent('.dcq-form-head .dcq-sign');
  out.tudoSalvo = await page.textContent('.dcq-savebar.is-top .dcq-state');
  // segundo questionário: múltipla escolha com exclusiva e "Outros"
  await page.click('.dcq-tab:has-text("Estrutura")');
  await page.check('#dcq-estrutura-1 input[value="Equipes em Campo"]');
  await page.check('#dcq-estrutura-1 input[value="Análise de Dados Meteorológicos"]');
  await page.check('#dcq-estrutura-1 input[value="Não realiza Monitoramento"]');
  out.exclusiva = await page.$$eval('#dcq-estrutura-1 input:checked', els => els.map(e => e.value));
  await page.check('#dcq-estrutura-1 input[value="Outros"]');
  await page.fill('#dcq-estrutura-1 .dcq-note input', 'Rádio comunitário');
  out.outros = await page.$$eval('#dcq-estrutura-1 input:checked', els => els.map(e => e.value));
  await page.check('input[name="dcq-estrutura-5"][value="Outros"]');
  out.outrosRadio = await page.isVisible('#dcq-estrutura-5 .dcq-note input');
  await page.click('.dcq-savebar.is-bottom .dcq-save');
  await page.waitForFunction(() => (window.__fakeDb.defesa_civil_questionarios || []).length === 2, null, {timeout: 8000});
  const row2 = await page.evaluate(() => window.__fakeDb.defesa_civil_questionarios.find(r => r.id === 'icm-2026-estrutura'));
  out.salvo2 = {r1: row2.respostas['1'], outros: row2.respostas['1:outros'], r5: row2.respostas['5']};
  // reabrir: rota restaurada e assinatura mantida
  out.hash = await page.evaluate(() => location.hash);
  out.contraste = await page.evaluate(() => window.__contrastAudit(document.querySelector('.dcq-page')));
  await page.click('.dcq-tab:has-text("Diagnóstico")');
  await page.screenshot({path: os.tmpdir() + `/dcq-${process.env.W || 390}.png`});
  await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(150);
  await page.screenshot({path: os.tmpdir() + `/dcq-scroll-${process.env.W || 390}.png`});
  out.erros = errors.filter(e => !/_leaflet_pos/.test(e));
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  assert.ok(out.destinos.some(t => /AUDITORIAQuestionários/.test(t)));
  assert.equal(out.perguntasDiag, 21);
  assert.deepEqual(out.dimensoes, ['Dimensão I', 'Dimensão II', 'Dimensão III']);
  assert.match(out.progresso1, /1 de 21/); assert.match(out.naoSalvo, /não salvas/);
  assert.match(out.progressoTce, /21 de 21/);
  assert.match(out.resumo, /20\s*a implantar/);
  assert.equal(out.barraVisivel, true);
  assert.equal(out.salvo.id, 'icm-2026-diagnostico'); assert.equal(out.salvo.por, 'u1'); assert.equal(out.salvo.temData, true);
  assert.equal(out.salvo.hist, 1); assert.equal(out.salvo.r1, 'Não'); assert.equal(out.salvo.r21, true);
  assert.match(out.assinatura, /Preenchido por Ricardo Campos\s*em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
  assert.match(out.tudoSalvo, /Tudo salvo/);
  assert.deepEqual(out.exclusiva, ['Não realiza Monitoramento'], 'opção exclusiva desmarca as outras');
  assert.deepEqual(out.outros, ['Outros']);
  assert.equal(out.outrosRadio, true);
  assert.deepEqual(out.salvo2, {r1: ['Outros'], outros: 'Rádio comunitário', r5: 'Outros'});
  assert.equal(out.hash, '#page/defesa-questionarios');
  assert.deepEqual(out.contraste, []);
  assert.deepEqual(out.erros, []);
  console.log('defesa-questionarios: ok');
})();
