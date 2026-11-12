// Navegação coerente: toda tela tem "← Voltar" para a tela pai e o caminho até a Visão geral,
// fixos no topo ao rolar. Uso: python3 -m http.server 8090 e
// NODE_PATH=$(npm root -g) W=390 node tests/nav-trail.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const {boot} = require('./contrast/run.cjs');
const W = Number(process.env.W || 390);

(async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser, {width: W});
  page.setDefaultTimeout(8000);
  const trail = async () => { await page.waitForTimeout(250); return page.evaluate(() => [...document.querySelectorAll('#content > .nav-trail li')].map(li => [...li.querySelectorAll('i,span>span,.nav-trail-here>span,button>span')].map(n => n.textContent.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' '))); };
  const back = () => page.click('#content > .nav-trail .nav-trail-back');
  const stuck = async () => {
    await page.evaluate(() => { const m = document.querySelector('main'); const big = document.createElement('div'); big.style.height = '3000px'; big.className = 'nav-test-spacer'; document.getElementById('content').append(big); [m, document.body, document.scrollingElement].forEach(el => el.scrollTo(0, 1500)); });
    await page.waitForTimeout(200);
    const ok = await page.evaluate(() => { const r = document.querySelector('#content > .nav-trail').getBoundingClientRect(); const sc = [document.querySelector('main'), document.body, document.scrollingElement].some(el => el.scrollTop > 200); return sc && r.top >= 0 && r.top < 140 && r.height > 30; });
    await page.evaluate(() => { document.querySelector('.nav-test-spacer')?.remove(); [document.querySelector('main'), document.body, document.scrollingElement].forEach(el => el.scrollTo(0, 0)); });
    return ok;
  };

  // Visão geral: só o item atual, sem voltar
  await page.evaluate(() => window.setView('mod'));
  assert.deepEqual(await trail(), ['🏠 Visão geral']);
  assert.equal(await page.locator('#content > .nav-trail .nav-trail-back').count(), 0);

  // Mapa geral: volta para a Visão geral, barra fixa ao rolar
  await page.evaluate(() => window.setView('map'));
  assert.deepEqual(await trail(), ['🏠 Visão geral', '🗺 Mapa geral de demandas']);
  assert.equal(await stuck(), true, 'barra fixa no mapa');
  // filtro inteligente: só secretarias com pontos
  const secs = await page.$$eval('.geo-pick select:first-of-type option', o => o.map(x => x.textContent));
  assert.ok(secs[0].startsWith('Todas'), 'opção todas');
  assert.ok(secs.some(t => /SAÚDE \(\d+\)/.test(t)) && !secs.some(t => /CEDOCA/.test(t)), 'só secretarias com pontos: ' + secs.join('|'));
  const secSel = page.locator('.geo-pick select').first();
  await secSel.selectOption({label: secs.find(t => /SAÚDE/.test(t))});
  await page.waitForTimeout(150);
  const groups = await page.$$eval('.geo-pick label:nth-of-type(2) select option', o => o.map(x => x.textContent));
  assert.ok(groups.every((t, i) => i === 0 || /MANUTENÇÃO DE UBS/.test(t)), 'grupos dependem da secretaria: ' + groups.join('|'));
  const items = await page.$$eval('.geo-map-list article', a => a.length);
  assert.equal(items, 2, 'só pontos da Saúde');
  await page.screenshot({path: os.tmpdir() + `/nav-map-${W}.png`});
  await back();
  assert.deepEqual(await trail(), ['🏠 Visão geral']);

  // Grupo de demandas: Visão geral › Secretaria › … › Grupo; voltar sobe um nível
  await page.evaluate(() => window.openActivity('a1'));
  const t = await trail();
  assert.equal(t[0], '🏠 Visão geral'); assert.ok(t.at(-1).includes('MANUTENÇÃO DE UBS')); assert.ok(t.length >= 3, t.join(' › '));
  assert.equal(await stuck(), true, 'barra fixa no grupo');
  assert.equal(await page.locator('#content .nav-legacy-back:visible').count(), 0);
  await page.screenshot({path: os.tmpdir() + `/nav-group-${W}.png`});
  await back();
  const up = await trail();
  assert.equal(up.length, t.length - 1, 'subiu um nível: ' + up.join(' › '));

  // Agricultura: tela de escolha → Locais de Captação de Água e Controle de Demandas
  await page.evaluate(() => window.openSecretaryWorkspace('sec2'));
  const agri = await trail();
  if (agri.length === 2) {
    assert.ok(agri[1].includes('AGRICULTURA'));
    await page.evaluate(() => window.renderWaterCollectionPoints());
    await page.waitForSelector('.water-page');
    assert.deepEqual((await trail()).slice(1).map(x => x.replace(/^\S+ /, '')), ['SECRETARIA DE AGRICULTURA', 'Locais de Captação de Água']);
    await back();
    assert.deepEqual((await trail()).length, 2);
    await page.evaluate(() => window.openDemandSecretaria('sec2'));
    assert.deepEqual((await trail()).slice(1).map(x => x.replace(/^\S+ /, '')), ['SECRETARIA DE AGRICULTURA', 'Controle de Demandas']);
    await back();
    assert.ok((await trail()).at(-1).includes('AGRICULTURA'), 'volta para a escolha da Agricultura');
  }
  // Usuários e acessos e Lixeira
  await page.evaluate(() => window.setView('adm'));
  assert.deepEqual(await trail(), ['🏠 Visão geral', '⚙️ Usuários e acessos']);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.querySelector('#content > .nav-trail'))), []);
  assert.deepEqual(errors.filter(e => !/favicon|net::/.test(e)), [], errors.join('\n'));
  console.log(`ok - navegação e breadcrumbs (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
