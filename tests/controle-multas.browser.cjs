// Controle de Multas: o veículo vem SEMPRE do cadastro da frota e a secretaria vem dele; KPIs, filtros,
// ranking por veículo/secretaria, marcar paga, PDF e contraste.
//   python3 -m http.server 8090 ; NODE_PATH=$(npm root -g) LIBS=…/node_modules/ W=1366 node tests/controle-multas.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), {execFileSync} = require('child_process');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const day = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const now = new Date().toISOString();
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const seed = {
  secretarias: [row({id: 'sec-edu', name: 'EDUCAÇÃO'}), row({id: 'sec-sau', name: 'SAÚDE'}), row({id: 'sec-tra', name: 'TRANSPORTES'})],
  atividades: [
    row({id: 'e1963945-b131-4949-acfe-424dad296715', name: 'VEÍCULOS DA EDUCAÇÃO', extra_fields: {modulo: 'frota'}}),
    row({id: 'cad-veiculos-saude', name: 'VEÍCULOS DA SAÚDE', extra_fields: {modulo: 'frota'}}),
    row({id: 'multas', name: 'CONTROLE DE MULTAS', extra_fields: {modulo: 'frota', controle_multas: 1}}),
  ],
  items: [
    row({id: 'v-onibus', atividade_id: 'e1963945-b131-4949-acfe-424dad296715', description: 'ÔNIBUS', extra_fields: {PLACA: 'PGG7965', ANO: '2013', Chassi: '9532E82W6DR323931'}}),
    row({id: 'v-gol', atividade_id: 'e1963945-b131-4949-acfe-424dad296715', description: 'GOL', extra_fields: {PLACA: 'QYH-3J10'}}),
    row({id: 'v-amb', atividade_id: 'cad-veiculos-saude', description: 'FIAT FIORINO AMBULÂNCIA', extra_fields: {Placa: 'SPB8I44'}}),
    row({id: 'v-sem', atividade_id: 'cad-veiculos-saude', description: 'MOTONIVELADORA', extra_fields: {PLACA: 'XXXXXXXX'}}),
    row({id: 'v-0km', atividade_id: 'cad-veiculos-saude', description: 'FIAT CRONOS 0KM', extra_fields: {Placa: 'A/C (0KM)', Chassi: '8AP359ATHSU453463'}}),
    row({id: 'm1', atividade_id: 'multas', description: 'PGG7965 · ÔNIBUS', deadline_date: day(-3), extra_fields: {cadastro_id: 'v-onibus', 'Data da ocorrência': day(-40), Vencimento: day(-3), Valor: '195,23', Gravidade: 'Grave', Pontos: '5', Infração: 'Deixar o condutor ou passageiro de usar o cinto de segurança', Situação: 'Em aberto', 'Auto de infração': 'AB111'}}),
    row({id: 'm2', atividade_id: 'multas', description: 'SPB8I44 · AMBULÂNCIA', concluded: 1, extra_fields: {cadastro_id: 'v-amb', 'Data da ocorrência': day(-60), Vencimento: day(-20), Valor: '130,16', Situação: 'Paga', 'Data do pagamento': day(-25)}}),
  ],
};
async function capturePdf(page, run) {
  await page.evaluate(() => { window.__pdf = null; window.jspdf.jsPDF.API.save = function (name) { window.__pdf = {name, b64: this.output('datauristring').split(',')[1]}; }; });
  await run();
  await page.waitForFunction(() => window.__pdf, null, {timeout: 20000});
  const {b64} = await page.evaluate(() => window.__pdf);
  const file = os.tmpdir() + `/multas-${W}.pdf`; fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return {file, text: execFileSync('pdftotext', ['-layout', file, '-']).toString()};
}
(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W, seed});
  await page.evaluate(() => window.openActivity('multas'));
  await page.waitForSelector('.mt-row');
  const txt = (await page.textContent('#content')).replace(/\s+/g, ' ');
  assert.match(txt, /4 veículos do cadastro da frota/, 'só veículos com placa do cadastro');
  assert.match(txt, /Vencida há 3 dias/);
  assert.ok(await page.evaluate(() => document.body.innerHTML.includes('CHASSI …453463')) === false); // só aparece na lista do formulário
  assert.match(txt, /🏛️ EDUCAÇÃO/); assert.match(txt, /🏛️ SAÚDE/);
  assert.equal(await page.locator('.mt-kpi.bad b').first().textContent(), '1', 'KPI vencidas');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  await page.screenshot({path: os.tmpdir() + `/multas-${W}.png`, fullPage: true});

  // Lançar: escolher o veículo pela busca da placa; secretaria aparece sozinha
  await page.click('.mt-primary');
  await page.waitForSelector('#mt-vbusca');
  await page.fill('#mt-vbusca', '453463');
  assert.match(await page.locator('#mt-vlist .mt-vopt:visible').first().textContent(), /CHASSI …453463/, 'veículo 0 km pelo chassi');
  await page.fill('#mt-vbusca', 'qyh3');
  assert.equal(await page.locator('#mt-vlist .mt-vopt:visible').count(), 1, 'busca por placa sem hífen');
  assert.equal(await page.locator('.mt-pago-only:visible').count(), 0, 'pagamento só aparece quando Paga');
  await page.click('#mt-vlist .mt-vopt:not([hidden])');
  assert.match(await page.textContent('#mt-vcard'), /Secretaria: EDUCAÇÃO/);
  await page.fill('#mt-ocorr', day(-5)); await page.fill('#mt-venc', day(4));
  await page.fill('#mt-infr', 'Avançar o sinal vermelho do semáforo'); await page.dispatchEvent('#mt-infr', 'input');
  assert.equal(await page.inputValue('#mt-grav'), 'Gravíssima', 'gravidade sugerida pela infração');
  assert.equal(await page.inputValue('#mt-pts'), '7');
  assert.equal(await page.inputValue('#mt-valor'), '293,47', 'valor do CTB');
  assert.match(await page.textContent('#mt-desc'), /R\$\s?176,08/, 'desconto SNE 40%');
  await page.fill('#mt-auto', 'AB111'); await page.dispatchEvent('#mt-auto', 'input');
  assert.match(await page.textContent('#mt-dup'), /já foi lançado/, 'aviso de auto duplicado');
  await page.fill('#mt-auto', 'ZZ999'); await page.dispatchEvent('#mt-auto', 'input');
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('modal-ov'))), []);
  await page.screenshot({path: os.tmpdir() + `/multas-form-${W}.png`});
  await page.click('.modal-actions .btn-save');
  await page.waitForFunction(() => document.querySelectorAll('.mt-row').length === 3, null, {timeout: 8000});
  const saved = await page.evaluate(() => S.items.find(i => i.atividade_id === 'multas' && (i.extra_fields || {})['Auto de infração'] === 'ZZ999'));
  assert.equal(saved.extra_fields.cadastro_id, 'v-gol'); assert.equal(saved.extra_fields.Secretaria, 'EDUCAÇÃO');
  assert.equal(String(saved.deadline_date).slice(0, 10), day(4));
  // Marcar paga
  await page.evaluate(() => { window.prompt = () => new Date().toLocaleDateString('pt-BR'); });
  await page.click(`.mt-row[data-multa-id="${saved.id}"] .mt-btns button[title="Marcar como paga"]`);
  await page.waitForFunction(id => (S.items.find(i => i.id === id) || {}).concluded == 1, saved.id);
  // Abas
  await page.click('.mt-tab:has-text("Por veículo")'); await page.waitForSelector('.mt-rank-row');
  await page.click('.mt-tab:has-text("Por secretaria")'); await page.waitForSelector('.mt-seccard');
  assert.match(await page.textContent('.mt-secgrid'), /EDUCAÇÃO.*2.*multa/s);
  // PDF
  const pdf = await capturePdf(page, () => page.evaluate(() => window.mtPdf('multas')));
  assert.match(pdf.text, /SECRETARIA: EDUCAÇÃO/); assert.doesNotMatch(pdf.text, /Condutor/, 'coluna vazia sai'); assert.match(pdf.text, /PGG7965/); assert.match(pdf.text, /VENCIDA/); assert.match(pdf.text, /Página 1 de 1/);
  // No cadastro do veículo aparece "Aparece em CONTROLE DE MULTAS"
  await page.evaluate(() => window.openActivity('e1963945-b131-4949-acfe-424dad296715'));
  await page.waitForSelector('.cadl-chips', {timeout: 8000});
  assert.match(await page.textContent('#content'), /CONTROLE DE MULTAS/);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - controle de multas (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
