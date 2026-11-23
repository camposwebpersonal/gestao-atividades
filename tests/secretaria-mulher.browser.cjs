// SECRETARIA DA MULHER: cadastro das mulheres (ficha em 4 passos, ocorrências, PDF com QR no cabeçalho e no rodapé)
// e LEVANTAMENTO DA REDE (formulário do PDF, "Existe? NÃO" recolhe o equipamento, PDF). Página pública somente
// leitura do QR (mulher.html). Uso: NODE_PATH=$(npm root -g) LIBS=/caminho/node_modules/ W=390 node tests/secretaria-mulher.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
(async () => {
  const browser = await chromium.launch();
  const seed = {
    atividades: [row({id: 'mu-cad', name: 'MULHERES CADASTRADAS', extra_fields: {modulo: 'atendimentos', mulher_cadastro: 1}}), row({id: 'mu-lev', name: 'LEVANTAMENTO DA REDE DE ENFRENTAMENTO', extra_fields: {modulo: 'atendimentos', mulher_levantamento: 1}})],
    items: [row({id: 'mw1', atividade_id: 'mu-cad', description: 'MARIA DAS DORES SILVA', extra_fields: {'Data de nascimento': '1990-05-10', 'Bairro / localidade': 'COHAB', 'Situação do acompanhamento': 'Em acompanhamento', 'Medida protetiva': 'Concedida', Encaminhamentos: ['CREAS', 'DEAM / Delegacia'], mulher_token: 'TOKEN-MARIA'}})],
    subitems: [row({id: 'mo1', atividade_id: 'mu-cad', item_id: 'mw1', parent_type: 'item', description: 'Acolhimento inicial', observacao: 'Chegou acompanhada da irmã.', extra_fields: {Data: now.slice(0, 10), Tipo: 'Acolhimento', Profissional: 'Ana'}})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => window.openActivity('mu-cad'));
  await page.waitForSelector('.mu-hero');
  assert.match(await txt(page, '.mu-hero'), /1 mulher em acompanhamento/);
  assert.equal(await page.locator('.mu-tabs button').count(), 2);
  assert.match(await txt(page, '.mu-row'), /MARIA DAS DORES SILVA.*COHAB.*Em acompanhamento.*Concedida.*1 ocorrência/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), [], 'contraste lista');
  // cadastrar
  await page.click('.mu-cta');
  await page.waitForSelector('.mu-form');
  assert.equal(await page.locator('.mu-step legend').count(), 5);
  assert.ok(await page.locator('label[data-se="Pessoa com deficiência"]').isHidden(), '“Qual deficiência” aparece só com Sim');
  await page.fill('#mu-nome', 'JOANA PEREIRA');
  await page.click('[data-mk="Pessoa com deficiência"] label:has-text("Sim")');
  assert.ok(await page.locator('label[data-se="Pessoa com deficiência"]').isVisible());
  await page.click('[data-mk="Tipos de violência"] label:has-text("Psicológica")');
  await page.click('[data-mk="Situação do acompanhamento"] label:has-text("Em acompanhamento")');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#modal-ov'))), [], 'contraste formulário');
  await page.click('#mu-salvar');
  await page.waitForFunction(() => window.S.items.some(i => i.description === 'JOANA PEREIRA'));
  const joana = await page.evaluate(() => { const i = window.S.items.find(x => x.description === 'JOANA PEREIRA'); return {psico: i['Tipos de violência'] || i.extra_fields?.['Tipos de violência'], tok: i.mulher_token || i.extra_fields?.mulher_token}; });
  assert.deepEqual(joana.psico, ['Psicológica']); assert.ok(String(joana.tok).length >= 30, 'token longo para o QR');
  await page.waitForSelector('.mu-ficha');
  // ocorrência
  await page.click('.mu-actions button:has-text("Ocorrência")');
  await page.waitForSelector('#mo-tit');
  await page.fill('#mo-tit', 'Atendimento psicossocial');
  await page.click('[data-mk="Tipo"] label:has-text("Atendimento")');
  await page.fill('#mo-rel', 'Orientada sobre a rede.');
  await page.click('#mo-salvar');
  await page.waitForSelector('.mu-tl-i');
  assert.match(await txt(page, '.mu-tl'), /Atendimento psicossocial.*Orientada sobre a rede/);
  await page.screenshot({path: os.tmpdir() + `/mulher-ficha-${W}.png`, fullPage: true});
  // 🔗 Criar link: validade + PIN opcional (desligado por padrão), QR na tela, link somente leitura
  await page.evaluate(() => { window.db.from = () => { const q = {select: () => q, eq: () => q, is: () => q, order: () => q, limit: async () => ({data: []})}; return q; };
    window.db.rpc = async (n, a) => { window.__rpc = [n, a]; return {data: {token: 'LINK-NOVO-ABCDEFGHIJKLMNOPQRSTUV'}}; }; });
  await page.click('.mu-actions button:has-text("Criar link")');
  await page.waitForSelector('.mu-share .lk-opts');
  assert.equal(await page.locator('#lk-pin-on').isChecked(), false, 'PIN desligado por padrão');
  await page.click('.lk-chips label:has-text("1 dia")');
  await page.click('#mu-share-go');
  await page.waitForSelector('.mu-share-card .lk-qr');
  assert.deepEqual(await page.evaluate(() => window.__rpc[1]), {p_group: 'mu-cad', p_modo: 'ver', p_alvo_tipo: 'mulher', p_alvo_id: await page.evaluate(() => window.S.items.find(x => x.description === 'JOANA PEREIRA').id), p_horas: 24, p_pin: null});
  assert.match(await page.inputValue('.mu-share-card input'), /mulher\.html\?t=LINK-NOVO-/);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#modal-ov'))), [], 'contraste compartilhar');
  await page.evaluate(() => window.closeModal());
  // PDF com QR
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
    await page.evaluate(() => window.mulherPdf('mu-cad', 'mw1'));
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64, name} = await page.evaluate(() => window.__pdf); const f = os.tmpdir() + `/mulher-${W}.pdf`; fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    const t = execFileSync('pdftotext', ['-layout', f, '-']).toString();
    assert.equal(name, 'FICHA-MARIA-DAS-DORES-SILVA.pdf');
    for (const p of ['SECRETARIA DA MULHER', 'MARIA DAS DORES SILVA', 'Medida protetiva', 'CREAS, DEAM / Delegacia', 'OCORRÊNCIAS (1)', 'Acolhimento inicial', 'Escaneie para ver esta ficha', 'somente leitura', 'Página 1 de']) assert.ok(t.includes(p), 'PDF sem: ' + p);
    execFileSync('pdftoppm', ['-r', '60', '-png', '-f', '1', '-l', '1', f, os.tmpdir() + `/mulher-pdf-${W}`]);
  }
  // levantamento
  await page.click('.mu-tabs button:has-text("Levantamento")');
  await page.waitForSelector('.mu-hero.is-lev');
  await page.click('.mu-cta');
  await page.waitForSelector('.lv-form');
  assert.equal(await page.locator('.lv-rede').count(), 6);
  await page.click('.lv-ompm .mu-pills label:has-text("Secretaria")');
  await page.fill('[data-o="nome"]', 'SECRETARIA MUNICIPAL DA MULHER');
  const deam = page.locator('.lv-rede[data-rede="seguranca"] .lv-eq').first();
  await deam.locator('.mu-pills label:has-text("DEAM")').click();
  await deam.locator('.mu-pills label:has-text("NÃO")').click();
  assert.ok(await deam.locator('.lv-eq-body').isHidden(), 'NÃO recolhe o equipamento');
  const cras = page.locator('.lv-rede[data-rede="assistencia"] .lv-eq').first();
  await cras.locator('.mu-pills label:has-text("CRAS")').click(); await cras.locator('.mu-pills label:has-text("SIM")').click();
  await cras.locator('[data-q="nome"]').fill('CRAS CENTRO');
  await page.click('.lv-rede[data-rede="assistencia"] .lv-add');
  assert.equal(await page.locator('.lv-rede[data-rede="assistencia"] .lv-eq').count(), 2);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#modal-ov'))), [], 'contraste levantamento');
  await page.click('#lv-salvar');
  await page.waitForFunction(() => window.S.items.some(i => i.atividade_id === 'mu-lev'));
  const lev = await page.evaluate(() => { const i = window.S.items.find(x => x.atividade_id === 'mu-lev'); return i.levantamento || i.extra_fields?.levantamento; });
  assert.equal(lev.ompm.nome, 'SECRETARIA MUNICIPAL DA MULHER');
  assert.deepEqual(lev.redes.seguranca.map(e => [e.tipo, e.existe]), [['DEAM', 'NÃO']]);
  assert.deepEqual(lev.redes.assistencia.map(e => e.nome), ['CRAS CENTRO'], 'equipamento vazio não é salvo');
  await page.waitForSelector('.mu-row');
  assert.match(await txt(page, '.mu-list'), /1 equipamento\(s\) existente\(s\)/);
  if (process.env.LIBS) {
    await page.evaluate(() => { window.__pdf = null; });
    const lid = await page.evaluate(() => window.S.items.find(x => x.atividade_id === 'mu-lev').id);
    await page.evaluate(id => window.levPdf('mu-lev', id), lid);
    await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
    const {b64} = await page.evaluate(() => window.__pdf); const f = os.tmpdir() + `/levantamento-${W}.pdf`; fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    const t = execFileSync('pdftotext', ['-layout', f, '-']).toString();
    for (const p of ['LEVANTAMENTO DA REDE DE ENFRENTAMENTO', 'II. ORGANISMO MUNICIPAL', 'SECRETARIA MUNICIPAL DA MULHER', 'IV. REDE DE SEGURANÇA', 'Existe no município: NÃO', 'CRAS CENTRO', 'VIII. ORGANIZAÇÕES', 'Página 1 de']) assert.ok(t.includes(p), 'PDF levantamento sem: ' + p);
  }
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  // página pública do QR (somente leitura)
  const pub = await (await browser.newContext({viewport: {width: W, height: 860}})).newPage();
  await pub.addInitScript({path: path.join(__dirname, 'contrast/audit.js')});
  await pub.addInitScript(() => { window.__PUBLIC_RPC = async (n, a) => a.p_token === 'TOKEN-MARIA' ? {ok: true, ficha: {nome: 'MARIA DAS DORES SILVA', observacao: 'Acompanhamento semanal.', campos: {'Data de nascimento': '1990-05-10', 'Medida protetiva': 'Concedida', Encaminhamentos: ['CREAS']}}, ocorrencias: [{titulo: 'Acolhimento inicial', relato: 'Chegou acompanhada.', campos: {Data: '2026-11-20', Tipo: 'Acolhimento'}}]} : {ok: false}; });
  await pub.goto('http://127.0.0.1:8090/mulher.html?t=TOKEN-MARIA'); await pub.waitForSelector('.mp-hero');
  assert.match(await txt(pub, 'main'), /Somente leitura.*MARIA DAS DORES SILVA.*Medida protetiva.*Concedida.*CREAS.*Ocorrências 1.*Acolhimento inicial.*20\/11\/2026/);
  assert.equal(await pub.locator('input, textarea, button, select').count(), 0, 'nada editável');
  assert.deepEqual(await pub.evaluate(() => window.__contrastAudit(document.body)), []);
  await pub.goto('http://127.0.0.1:8090/mulher.html?t=outro'); await pub.waitForSelector('.mp-end');
  assert.match(await txt(pub, '.mp-end'), /não encontrada/);
  // ficha com PIN: pede, recusa errado, abre com o certo; link vencido
  const pin = await (await browser.newContext({viewport: {width: W, height: 860}})).newPage();
  await pin.addInitScript(() => { window.__PUBLIC_RPC = async (n, a) => /VENCIDO/.test(a.p_token) ? {ok: false, motivo: 'expirado'} : a.p_pin === '2468' ? {ok: true, expira: new Date(Date.now() + 3600e3).toISOString(), ficha: {nome: 'ANA COM PIN', campos: {}}, ocorrencias: []} : {ok: false, motivo: a.p_pin ? 'pin_errado' : 'pin'}; });
  await pin.goto('http://127.0.0.1:8090/mulher.html?t=TOKEN-COM-PIN-1234567890'); await pin.waitForSelector('#mp-pin');
  await pin.fill('#mp-pin', '1111'); await pin.click('#mp-pin-form button'); await pin.waitForSelector('.mp-pin-bad');
  await pin.fill('#mp-pin', '2468'); await pin.click('#mp-pin-form button'); await pin.waitForSelector('.mp-hero');
  assert.match(await txt(pin, 'main'), /válido até.*ANA COM PIN/);
  await pin.goto('http://127.0.0.1:8090/mulher.html?t=TOKEN-VENCIDO-123456789012'); await pin.waitForSelector('.mp-end');
  assert.match(await txt(pin, '.mp-end'), /expirou/);
  console.log(`ok - Secretaria da Mulher (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
