// Auditoria de legibilidade: roda o app real com um Supabase simulado (nada é gravado no banco)
// e verifica o contraste de texto (WCAG AA) em todas as telas, módulos, grupos e modais.
// Uso: python3 -m http.server 8090 (na raiz do projeto) e depois
//      NODE_PATH=$(npm root -g) node tests/contrast/run.cjs   (W=1366 para desktop)
// Falha (código 1) se algum texto ficar com contraste abaixo de 4,5:1 (ou 3:1 para texto grande).
const {chromium} = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8090';
const DIR = __dirname, LIBS = process.env.LIBS || ''; // pasta node_modules com leaflet/jspdf (opcional)
const OUT = process.env.OUT || require('os').tmpdir() + '/contrast-audit';
fs.mkdirSync(OUT, {recursive: true});
const width = Number(process.env.W || 390);

async function boot(browser) {
  const ctx = await browser.newContext({viewport: {width, height: width < 900 ? 844 : 900}, isMobile: width < 900, hasTouch: width < 900, permissions: ['geolocation'], geolocation: {latitude: -8.073, longitude: -37.264, accuracy: 6}});
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('esm.sh/@supabase')) return route.fulfill({contentType: 'application/javascript', path: DIR + '/fake-supabase.js'});
    if (LIBS && url.includes('leaflet') && url.includes('/dist/')) return route.fulfill({path: LIBS + 'leaflet/dist/' + url.split('/dist/')[1].split('?')[0]});
    if (LIBS && url.includes('jspdf.umd')) return route.fulfill({path: LIBS + 'jspdf/dist/jspdf.umd.min.js'});
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.fulfill({status: 204, body: ''});
  });
  await page.addInitScript({path: DIR + '/audit.js'});
  await page.addInitScript(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto(BASE + '/index.html', {waitUntil: 'load'});
  await page.waitForFunction(() => window.S?.user && document.querySelector('#content')?.children.length, null, {timeout: 20000});
  await page.waitForTimeout(1200);
  return {ctx, page, errors};
}
module.exports = {boot};

if (require.main === module) (async () => {
  const browser = await chromium.launch();
  const {page, errors} = await boot(browser);
  const report = {};
  const audit = async (name, shot = true) => {
    await page.waitForTimeout(350);
    const issues = await page.evaluate(() => window.__contrastAudit());
    // Confere a cor realmente pintada dos campos (o navegador pode ignorar regras de correção em <input>).
    const pixels = (await page.screenshot()).toString('base64');
    issues.push(...await page.evaluate(async b64 => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const cv = new OffscreenCanvas(img.width, img.height), cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const k = img.width / innerWidth, out = [];
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=hidden]),textarea,select')) {
        const r = el.getBoundingClientRect(); if (r.width < 30 || r.height < 14 || r.bottom < 0 || r.top > innerHeight || r.right > innerWidth) continue;
        const top = document.elementFromPoint(r.left + r.width * .85, r.top + 4); if (top !== el) continue;
        const px = cx.getImageData(Math.round((r.left + r.width * .85) * k), Math.round((r.top + 4) * k), 1, 1).data;
        const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
        const x = lum(px), y = lum(m), ratio = (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
        if (ratio < 4.5) out.push({ratio: +ratio.toFixed(2), need: 4.5, text: '[campo pintado] ' + (el.placeholder || el.id || el.tagName).slice(0, 40), color: getComputedStyle(el).color, bg: `rgb(${px[0]},${px[1]},${px[2]})`, path: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '')});
      }
      return out;
    }, pixels));
    report[name] = issues;
    if (shot) await page.screenshot({path: `${OUT}/${name}-${width}.png`, fullPage: false});
  };
  for (const v of ['mod', 'map', 'secr', 'resp', 'cont', 'trash', 'adm', 'supabase-status']) {
    await page.evaluate(v => window.setView(v), v).catch(e => report['ERR ' + v] = e.message);
    await audit('view-' + v);
  }
  for (const m of ['eventos','projetos','obras','frota','atendimentos','rh','cadastros','contas','distribuicao','estoque','extintores','alugueis','mulher','agenda_prefeita','atividades','water_points']) { await page.evaluate(m => window.renderModulo(m), m).catch(() => {}); await audit('modulo-' + m); }
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) { await page.evaluate(id => window.openActivity(id), id).catch(() => {}); await audit('grupo-' + id); }
  await page.evaluate(() => { window.openActivity('a1'); const el = document.querySelector('[onclick*="openStatusMenu"]'); el?.click(); }).catch(() => {}); await audit('status-menu');
  await page.evaluate(() => document.querySelector('.st-popup')?.remove());
  // modais: chama cada window.open* com argumentos plausíveis
  const opens = await page.evaluate(() => Object.keys(window).filter(k => /^open[A-Z]/.test(k) && typeof window[k] === 'function'));
  report.__opens = opens;
  const args = [[], ['a1'], ['i1'], ['i1', 'a1'], ['item', 'i1']];
  for (const fn of opens) {
    if (/^open(Activity|Lightbox|External|Whats)/.test(fn)) continue;
    for (const a of args) {
      await page.evaluate(() => { window.closeModal?.(); document.querySelectorAll('.lightbox,.geo-map-overlay,.geo-picker-overlay,.st-popup').forEach(n => n.remove()); }).catch(() => {});
      await page.evaluate(() => window.setView('mod'));
      const ok = await page.evaluate(async ([fn, a]) => { try { const r = window[fn](...a); if (r?.then) await Promise.race([r, new Promise(s => setTimeout(s, 1500))]); } catch (e) { return false; } const m = document.querySelector('.modal-overlay.open,.modal-overlay.active,.modal-overlay[style*="flex"],.modal-overlay:not([hidden])'); return !!m && getComputedStyle(m).display !== 'none'; }, [fn, a]).catch(() => false);
      if (ok) { await audit('modal-' + fn + (a.length ? '-' + a.join('_') : '')); break; }
    }
  }
  report.__errors = errors;
  fs.writeFileSync(`${OUT}/report-${width}.json`, JSON.stringify(report, null, 1));
  const flat = Object.entries(report).filter(([k]) => !k.startsWith('__')).flatMap(([k, v]) => (Array.isArray(v) ? v : []).map(i => ({screen: k, ...i})));
  const bySel = {}; flat.forEach(i => { const key = i.path.split(' > ').slice(-2).join(' > ') + ' | ' + i.color + ' on ' + i.bg; (bySel[key] ||= {n: 0, ratio: i.ratio, ex: i.text, screens: new Set()}); bySel[key].n++; bySel[key].screens.add(i.screen); });
  console.log('views/modals auditados:', Object.keys(report).filter(k => !k.startsWith('__')).length, '| problemas:', flat.length, '| padrões distintos:', Object.keys(bySel).length, '| erros js:', errors.length);
  Object.entries(bySel).sort((a, b) => a[1].ratio - b[1].ratio).forEach(([k, v]) => console.log(v.ratio, '|', k, '|', JSON.stringify(v.ex), '|', [...v.screens].slice(0, 3).join(',')));
  await browser.close();
  if (flat.length) { console.error('FALHOU: textos com contraste insuficiente (veja a lista acima).'); process.exit(1); }
  console.log('OK: nenhum texto com contraste insuficiente.');
})();
