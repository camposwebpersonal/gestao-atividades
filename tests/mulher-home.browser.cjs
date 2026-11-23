// CASA LILÁS — página de entrada própria da SECRETARIA DA MULHER (não é a grade genérica): saudação, gestos
// (Acolher uma mulher, Registrar ocorrência, Todas as fichas), busca instantânea de fichas, pulso do cuidado,
// agenda de retornos, últimas ocorrências, mosaico dos espaços (grupos), rede de apoio com telefones (180/190 +
// levantamento) e modo clássico a um toque. Nada sai do card de 360 a 1920 px; contraste AA.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);
const now = new Date().toISOString();
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
(async () => {
  const browser = await chromium.launch();
  const at = {modulo: 'atendimentos'};
  const seed = {
    secretarias: [row({id: 'sec-mulher', name: 'SECRETARIA DA MULHER', demandas_ativa: true})],
    atividades: [
      row({id: 'mh-cad', name: 'MULHERES CADASTRADAS', demanda_secretaria_id: 'sec-mulher', extra_fields: {...at, mulher_cadastro: 1}}),
      row({id: 'mh-lev', name: 'LEVANTAMENTO DA REDE DE ENFRENTAMENTO', demanda_secretaria_id: 'sec-mulher', order_num: 1, extra_fields: {...at, mulher_levantamento: 1}}),
      row({id: 'mh-pat', name: 'PATRULHA MARIA DA PENHA-MULHERES ACOMPANHADAS', demanda_secretaria_id: 'sec-mulher', order_num: 2, extra_fields: at}),
      row({id: 'mh-cur', name: 'CURSOS', demanda_secretaria_id: 'sec-mulher', order_num: 3, extra_fields: at})],
    items: [
      row({id: 'hw1', atividade_id: 'mh-cad', description: 'MARIA DAS DORES SILVA', extra_fields: {'Bairro / localidade': 'COHAB', 'Situação do acompanhamento': 'Em acompanhamento', 'Medida protetiva': 'Concedida', CPF: '111.222.333-44'}}),
      row({id: 'hw2', atividade_id: 'mh-cad', description: 'JOANA PEREIRA LIMA', extra_fields: {'Bairro / localidade': 'CENTRO', 'Situação do acompanhamento': 'Em acompanhamento'}}),
      row({id: 'hlev', atividade_id: 'mh-lev', description: 'Levantamento', extra_fields: {levantamento: {data: day(-5), municipio: 'Sertânia', redes: {assistencia: [{tipo: 'CREAS', existe: 'SIM', nome: 'CREAS SERTÂNIA', telefone: '(87) 3841-1111'}], seguranca: [{tipo: 'DEAM', existe: 'NÃO'}]}}}}),
      row({id: 'hcur', atividade_id: 'mh-cur', description: 'Curso de costura'})],
    subitems: [
      row({id: 'ho1', atividade_id: 'mh-cad', item_id: 'hw1', parent_type: 'item', description: 'Atendimento psicossocial', extra_fields: {Data: day(-2), Tipo: 'Atendimento', 'Próximo retorno': day(3)}}),
      row({id: 'ho2', atividade_id: 'mh-cad', item_id: 'hw2', parent_type: 'item', description: 'Acolhimento inicial', extra_fields: {Data: day(-10), Tipo: 'Acolhimento', 'Próximo retorno': day(-1)}})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  await page.evaluate(() => window.openDemandSecretaria('sec-mulher'));
  await page.waitForSelector('.mh');
  assert.equal(await page.locator('.demand-shell').count(), 0, 'não usa a grade genérica');
  assert.match(await txt(page, '.mh-hero'), /(Bom dia|Boa tarde|Boa noite).*1 retorno passou da data.*Acolher uma mulher.*Registrar ocorrência.*Todas as fichas.*2 cadastradas/);
  assert.match(await txt(page, '.mh-pulso'), /2 ?em acompanhamento.*1 ?com medida protetiva.*2 ?ocorrências em 30 dias.*1 ?retornos nesta semana/);
  assert.deepEqual(await page.$$eval('.mh-agenda li', l => l.map(x => x.className.trim())), ['is-late', ''], 'atrasado primeiro, em âmbar');
  assert.match(await txt(page, '.mh-agenda'), /há \d+ d.*JOANA PEREIRA LIMA.*em \d+ d.*MARIA DAS DORES SILVA/);
  assert.equal(await page.locator('.mh-espaco').count(), 4);
  assert.equal(await page.locator('.mh-espaco.is-big').count(), 2);
  assert.deepEqual(await page.$$eval('.mh-contato[href]', a => a.map(x => x.getAttribute('href'))), ['tel:180', 'tel:190', 'tel:8738411111']);
  // busca instantânea de fichas
  await page.fill('#mh-busca', '111.222');
  await page.waitForSelector('#mh-find-res button');
  assert.match(await txt(page, '#mh-find-res'), /MARIA DAS DORES SILVA/);
  await page.click('#mh-find-res button');
  await page.waitForSelector('.mu-ficha');
  await page.evaluate(() => window.closeModal());
  await page.fill('#mh-busca', '');
  // ocorrência rápida
  await page.click('.mh-gesto:has-text("Registrar ocorrência")');
  await page.fill('#mh-pick-q', 'joana');
  await page.click('#mh-pick-list button');
  await page.waitForSelector('#mo-tit');
  assert.match(await page.textContent('.mu-for'), /JOANA PEREIRA LIMA/);
  await page.evaluate(() => window.closeModal());
  // nada sai do card + contraste
  for (const width of [360, 390, 768, 1280, 1920]) {
    await page.setViewportSize({width, height: 900}); await page.waitForTimeout(250);
    const bad = await page.evaluate(() => [...document.querySelectorAll('.mh-gesto,.mh-bolha,.mh-espaco,.mh-contato,.mh-agenda button')].flatMap(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('b,small,em')].filter(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + .5 || e.scrollWidth > e.clientWidth + 1); }).map(e => e.textContent.slice(0, 30)); }));
    assert.deepEqual(bad, [], 'vazou em ' + width);
  }
  await page.setViewportSize({width: W, height: 900}); await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.getElementById('content'))), []);
  await page.screenshot({path: os.tmpdir() + `/mulher-home-${W}.png`, fullPage: true});
  // modo clássico e volta
  await page.click('.mh-rodape button:has-text("modo clássico")');
  await page.waitForSelector('.demand-shell .mh-voltar');
  await page.click('.mh-voltar');
  await page.waitForSelector('.mh');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - Casa Lilás da Secretaria da Mulher (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
