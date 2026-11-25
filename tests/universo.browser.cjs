// UNIVERSO SERTÂNIA: cada secretaria é um mundo (página de entrada própria, Praça na Visão geral, aurora + selo no
// grupo, emoji no menu). Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390|1366 node tests/universo.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 1366);
const now = new Date().toISOString();
const day = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA');

(async () => {
  const browser = await chromium.launch();
  const row = o => ({order_num: 0, created_at: now, updated_at: now, extra_fields: {}, ...o});
  const seed = {
    atividades: [row({id: 'uvg1', name: 'SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA', demanda_secretaria_id: 'sec2', order_num: 90}), row({id: 'uvg2', name: 'SEMENTES PARA PRODUTORES', demanda_secretaria_id: 'sec2', order_num: 91})],
    items: [row({id: 'uvi1', atividade_id: 'uvg1', description: 'MARIA DO SÍTIO CAITITU', deadline_date: day(-3), concluded: 0}),
      row({id: 'uvi2', atividade_id: 'uvg1', description: 'JOSÉ DA SERRA', deadline_date: day(2), concluded: 0}),
      row({id: 'uvi3', atividade_id: 'uvg2', description: 'FEIJÃO PARA A ASSOCIAÇÃO', concluded: 1, conclusion_date: day(-1)})],
  };
  const {page, errors} = await boot(browser, {width: W, seed});
  page.setDefaultTimeout(9000);
  const audit = sel => page.evaluate(s => window.__contrastAudit(document.querySelector(s)), sel);
  const over = sel => page.evaluate(s => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll(s + ' *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1 && !e.closest('svg'); }).map(e => e.className || e.tagName).slice(0, 5); }, sel);

  // Praça de Sertânia (Visão geral)
  await page.evaluate(() => { S.secretarias.forEach(s => { s.demandas_ativa = true; }); window.setView('mod'); window.renderModulos(); });
  await page.waitForSelector('.uv-praca-faixa');
  const praca = await page.evaluate(() => ({faixa: document.querySelector('.uv-praca-faixa')?.textContent, hero: !!document.querySelector('.uv-praca'), cards: document.querySelectorAll('.secretary-launch-card').length, uv: document.querySelectorAll('.secretary-launch-card.uv-card').length, mundos: [...document.querySelectorAll('.uv-card-mundo')].map(e => e.textContent), pers: !!document.querySelector('.uv-praca-faixa .uv-pers'), h: document.querySelector('.uv-praca-faixa').getBoundingClientRect().height}));
  console.log('praça', JSON.stringify({...praca, faixa: praca.faixa.slice(0, 90)}));
  assert.equal(praca.hero, false, 'saudação desligada por padrão'); assert.match(praca.faixa, /Praça de Sertânia/); assert.ok(praca.pers, 'admin vê Personalizar');
  await page.screenshot({path: `/tmp/uv-praca-${W}.png`});
  assert.ok(praca.h < (W < 800 ? 200 : 120), 'faixa fina: ' + praca.h);
  assert.equal(praca.cards, praca.uv); assert.ok(praca.mundos.includes('Roça Viva')); assert.ok(praca.mundos.includes('Casa do Cuidado'));
  assert.deepEqual(await audit('.productivity-dashboard'), []); assert.deepEqual(await over('.productivity-dashboard'), []);
  await page.screenshot({path: `/tmp/uv-praca-${W}.png`});
  // personalizar a Praça: liga a saudação (céu) e desliga o mapa
  await page.click('.uv-praca-faixa .uv-pers'); await page.waitForSelector('.bk-lista .bk-item');
  assert.deepEqual(await audit('#modal-ov .modal-box'), []);
  await page.waitForTimeout(400); await page.screenshot({path: `/tmp/uv-blocos-${W}.png`});
  await page.click('.bk-item[data-bloco="saudacao"] .bk-sw'); await page.waitForSelector('.uv-praca');
  await page.click('.bk-item[data-bloco="mapa"] .bk-sw'); await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => document.querySelector('.map-shortcut-card')?.hidden === true || !document.querySelector('.map-shortcut-card')));
  assert.match(await page.textContent('.uv-praca'), /(Bom dia|Boa tarde|Boa noite)/);
  await page.click('.bk-presets button:has-text("Padrão do site")'); await page.waitForSelector('.uv-praca-faixa');
  await page.evaluate(() => window.closeModal());
  // ✏️ frases das secretarias: editar uma, tirar outra (vale para cards, selo e faixa)
  await page.click('.uv-praca-faixa .uv-pers'); await page.waitForSelector('.bk-lista .bk-item');
  await page.click('.bk-rod button:has-text("Frases das secretarias")'); await page.waitForSelector('#fr-lista .fr-item');
  assert.deepEqual(await audit('#modal-ov .modal-box'), []);
  await page.waitForTimeout(450); await page.screenshot({path: `/tmp/uv-frases-${W}.png`});
  await page.evaluate(() => { const lis = [...document.querySelectorAll('#fr-lista .fr-item')];
    const agri = lis.find(li => /AGRICULTURA/.test(li.dataset.sec)); agri.querySelector('.fr-nome').value = 'Terra Boa';
    const outra = lis.find(li => !/AGRICULTURA/.test(li.dataset.sec)); outra.querySelector('.fr-btn').click(); window.__semFrase = outra.dataset.sec; });
  await page.click('#fr-salvar'); await page.waitForTimeout(300);
  await page.evaluate(() => { window.setView('mod'); window.renderModulos(); }); await page.waitForSelector('.uv-praca-faixa');
  const fr = await page.evaluate(() => ({mundos: [...document.querySelectorAll('.uv-card-mundo')].map(e => e.textContent), cards: document.querySelectorAll('.secretary-launch-card').length, v: (S.appSettings.find(r => r.id === 'blocos') || {}).value}));
  console.log('frases', JSON.stringify(fr.v.frases));
  assert.ok(fr.mundos.includes('Terra Boa')); assert.ok(!fr.mundos.includes('Roça Viva')); assert.equal(fr.mundos.length, fr.cards - 1, 'uma secretaria ficou sem frase');
  assert.ok(fr.v.paginas, 'blocos preservados');
  // menu lateral com emoji do mundo
  assert.ok(await page.evaluate(() => document.querySelectorAll('.sidebar-secretary-link.uv-side[data-emoji]').length > 0));

  // página da secretaria (Agricultura)
  await page.evaluate(() => window.openDemandSecretaria('sec2'));
  await page.waitForSelector('.uv-home');
  const home = await page.evaluate(() => ({mundo: document.querySelector('.uv-home').dataset.mundoHome, faixa: document.querySelector('.uv-faixa')?.textContent, hero: !!document.querySelector('.uv-hero'), atencao: !!document.getElementById('uv-atencao'), ultimos: document.querySelectorAll('.uv-painel').length, gestos: [...document.querySelectorAll('.uv-gestos.is-compact .uv-gesto b')].map(b => b.textContent), espacos: [...document.querySelectorAll('.uv-espaco b')].map(b => b.textContent), topo: document.querySelector('.uv-mosaico').getBoundingClientRect().top - document.querySelector('.uv-home').getBoundingClientRect().top}));
  console.log('home', JSON.stringify({...home, faixa: home.faixa?.slice(0, 80)}));
  assert.equal(home.mundo, 'agricultura'); assert.equal(home.hero, false); assert.equal(home.atencao, false); assert.equal(home.ultimos, 0);
  assert.match(home.faixa, /SECRETARIA DE AGRICULTURA/); assert.match(home.faixa, /1 atrasado/);
  assert.ok(home.espacos.includes('SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA')); assert.ok(home.gestos.some(g => /Novo lançamento/.test(g)));
  assert.deepEqual(await audit('.uv-home'), []); assert.deepEqual(await over('.uv-home'), []);
  await page.screenshot({path: `/tmp/uv-home-${W}.png`, fullPage: true});
  // atrasados sem o bloco "Precisa de atenção": abre a lista numa janela
  await page.click('.uv-gesto.is-atencao'); await page.waitForSelector('#modal-ov .uv-lista li.is-late');
  await page.evaluate(() => window.closeModal());
  // personalizar a secretaria: liga Saudação, Precisa de atenção e Últimos; muda a ordem; volta ao padrão
  await page.click('.uv-faixa .uv-pers'); await page.waitForSelector('.bk-item[data-bloco="atencao"]');
  for (const b of ['saudacao', 'atencao', 'ultimos']) await page.click(`.bk-item[data-bloco="${b}"] .bk-sw`);
  await page.waitForFunction(() => document.querySelector('.uv-hero') && document.querySelectorAll('.uv-painel.is-half').length === 2);
  const lig = await page.evaluate(() => ({lema: document.querySelector('.uv-lema').textContent, late: document.querySelectorAll('#uv-atencao li.is-late').length, half: document.querySelectorAll('.uv-painel.is-half').length}));
  assert.match(lig.lema, /1 lançamento passou do prazo/); assert.equal(lig.late, 1); assert.equal(lig.half, 2);
  await page.click('.bk-item[data-bloco="espacos"] .bk-ord button:first-child'); await page.waitForTimeout(150);
  const ordem = await page.evaluate(() => [...document.querySelector('.uv-home').children].map(e => e.className.split(' ')[0]));
  console.log('ordem', ordem.join(','));
  assert.ok(ordem.indexOf('uv-espacos') < ordem.lastIndexOf('uv-painel'), 'espaços subiu');
  assert.equal(await page.evaluate(() => window.uvBlocos('sec:sec2').personalizado), true);
  assert.equal(await page.evaluate(() => window.uvBlocos('sec:sec5').liga('saudacao')), false, 'outras secretarias não mudam');
  await page.click('.bk-presets button:has-text("Padrão do site")'); await page.waitForSelector('.uv-faixa');
  await page.evaluate(() => window.closeModal());
  // busca da secretaria
  await page.fill('#uv-busca', 'caititu'); await page.waitForTimeout(80);
  assert.match(await page.textContent('#uv-find-res'), /MARIA DO SÍTIO CAITITU/);
  // novo lançamento: escolher o espaço
  await page.click('.uv-gesto.is-main'); await page.waitForSelector('.uv-pick .uv-espaco');
  assert.ok(await page.locator('.uv-pick .uv-espaco').count() >= 2);
  assert.deepEqual(await audit('#modal-ov .modal-box'), []);
  await page.evaluate(() => window.closeModal());
  // modo clássico e volta
  await page.click('.uv-rodape button'); await page.waitForSelector('.demand-shell .uv-voltar');
  await page.click('.uv-voltar'); await page.waitForSelector('.uv-home');
  // grupo: aurora + selo do mundo + ícone do espaço
  await page.click('.uv-espaco >> text=SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA');
  await page.waitForSelector('.uv-selo');
  const g = await page.evaluate(() => ({selo: document.querySelector('.uv-selo').textContent, esp: document.querySelector('.uv-esp')?.textContent, mundo: document.getElementById('content').dataset.mundo}));
  console.log('grupo', JSON.stringify(g)); assert.match(g.selo, /Terra Boa/); assert.equal(g.esp, '💧'); assert.equal(g.mundo, 'agricultura');
  assert.deepEqual(await audit('.activity-heading-row'), []);
  await page.screenshot({path: `/tmp/uv-grupo-${W}.png`});
  // personalizar a tela do grupo: some o selo e a barra de seleção
  await page.evaluate(() => window.uvPersonalizarGrupo('uvg1')); await page.waitForSelector('.bk-item[data-bloco="selo"]');
  await page.click('.bk-item[data-bloco="selo"] .bk-sw'); await page.click('.bk-item[data-bloco="selecao"] .bk-sw');
  assert.equal(await page.isVisible('.uv-selo'), false); assert.equal(await page.evaluate(() => document.getElementById('content').dataset.uvOff), 'selo selecao');
  await page.evaluate(() => window.closeModal());
  await page.evaluate(() => window.openActivity('uvg1')); await page.waitForTimeout(200);
  assert.equal(await page.isVisible('.uv-selo'), false, 'escolha do grupo continua depois de reabrir');
  // tela sem mundo: a aurora some
  await page.evaluate(() => window.setView('cont')); await page.waitForTimeout(200);
  console.log('depois', await page.evaluate(() => [location.hash, document.getElementById('content').dataset.mundoOnde, window.__currentView, document.getElementById('content').firstElementChild?.className]));
  assert.equal(await page.evaluate(() => document.getElementById('content').dataset.mundo || ''), '');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - universo Sertânia (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
