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
  await page.waitForSelector('.uv-praca');
  const praca = await page.evaluate(() => ({hero: document.querySelector('.uv-praca')?.textContent, ceu: [...document.querySelector('.uv-praca').classList].find(c => c.startsWith('is-')), cards: document.querySelectorAll('.secretary-launch-card').length, uv: document.querySelectorAll('.secretary-launch-card.uv-card').length, mundos: [...document.querySelectorAll('.uv-card-mundo')].map(e => e.textContent), mundo: document.getElementById('content').dataset.mundo}));
  console.log('praça', JSON.stringify({...praca, hero: praca.hero.slice(0, 120)}));
  assert.match(praca.hero, /(Bom dia|Boa tarde|Boa noite)/); assert.match(praca.hero, /Praça de Sertânia/); assert.ok(praca.ceu);
  assert.equal(praca.cards, praca.uv); assert.ok(praca.mundos.includes('Roça Viva'), 'Agricultura vira Roça Viva');
  assert.ok(praca.mundos.includes('Casa do Cuidado'), 'Saúde vira Casa do Cuidado');
  assert.deepEqual(await audit('.productivity-dashboard'), []); assert.deepEqual(await over('.productivity-dashboard'), []);
  await page.screenshot({path: `/tmp/uv-praca-${W}.png`});
  // menu lateral com emoji do mundo
  assert.ok(await page.evaluate(() => document.querySelectorAll('.sidebar-secretary-link.uv-side[data-emoji]').length > 0));

  // página da secretaria (Agricultura)
  await page.evaluate(() => window.openDemandSecretaria('sec2'));
  await page.waitForSelector('.uv-home');
  const home = await page.evaluate(() => ({mundo: document.querySelector('.uv-home').dataset.mundoHome, h1: document.querySelector('.uv-hero h1').textContent, lema: document.querySelector('.uv-lema').textContent, gestos: [...document.querySelectorAll('.uv-gesto b')].map(b => b.textContent), espacos: [...document.querySelectorAll('.uv-espaco b')].map(b => b.textContent), ico: document.querySelector('.uv-espaco .uv-esp-ico')?.textContent, atencao: document.querySelectorAll('#uv-atencao li').length, late: document.querySelectorAll('#uv-atencao li.is-late').length}));
  console.log('home', JSON.stringify(home));
  assert.equal(home.mundo, 'agricultura'); assert.match(home.lema, /1 lançamento passou do prazo/);
  assert.ok(home.espacos.includes('SOLICITAÇÃO DE ÁGUA DE PIPA - AGRICULTURA')); assert.equal(home.atencao, 2); assert.equal(home.late, 1);
  assert.ok(home.gestos.some(g => /Novo lançamento/.test(g)));
  assert.deepEqual(await audit('.uv-home'), []); assert.deepEqual(await over('.uv-home'), []);
  await page.screenshot({path: `/tmp/uv-home-${W}.png`, fullPage: true});
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
  console.log('grupo', JSON.stringify(g)); assert.match(g.selo, /Roça Viva/); assert.equal(g.esp, '💧'); assert.equal(g.mundo, 'agricultura');
  assert.deepEqual(await audit('.activity-heading-row'), []);
  await page.screenshot({path: `/tmp/uv-grupo-${W}.png`});
  // tela sem mundo: a aurora some
  await page.evaluate(() => window.setView('cont')); await page.waitForTimeout(200);
  console.log('depois', await page.evaluate(() => [location.hash, document.getElementById('content').dataset.mundoOnde, window.__currentView, document.getElementById('content').firstElementChild?.className]));
  assert.equal(await page.evaluate(() => document.getElementById('content').dataset.mundo || ''), '');
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), []);
  console.log(`ok - universo Sertânia (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
