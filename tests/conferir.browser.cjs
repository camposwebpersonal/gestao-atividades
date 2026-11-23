// Página pública do LINK DE CONFERÊNCIA (conferir.html): nome, corrigir, CONFERIDO trava o lançamento,
// CONFERIR TODOS + Salvar com confirmação, link expira quando tudo conferido; somente-ver não edita.
// O banco é simulado (window.__PUBLIC_RPC) com as MESMAS regras das funções pms_share_* do SQL.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('path');
const W = Number(process.env.W || 390);
const fake = modo => `(() => {
  const st = {modo: '${modo}', fim: false, itens: [
    {id: 'a', tipo: 'item', descricao: 'ESCOLA JOSÉ', observacao: '', status: 'pendente', campos: {'Telefone': '87 9999', 'Situação': 'SIM'}, conferido: false},
    {id: 'b', tipo: 'item', descricao: 'CRECHE MARIA', observacao: 'ok', status: 'pendente', campos: {}, conferido: false}],
    subitens: [{id: 'c', tipo: 'sub', item_id: 'b', pai: 'b', pai_tipo: 'item', descricao: 'SALA 1', campos: {}, conferido: false}],
    campos: [{nome: 'Telefone', tipo: 'text', escopo: 'item'}, {nome: 'Situação', tipo: 'combobox', opcoes: '["SIM","NÃO"]', escopo: 'item'}]};
  try { const saved = JSON.parse(sessionStorage.getItem('fake-share-${modo}') || 'null'); if (saved) Object.assign(st, saved); } catch {}
  const keep = () => sessionStorage.setItem('fake-share-${modo}', JSON.stringify(st));
  window.__calls = [];
  const all = () => [...st.itens, ...st.subitens];
  const rest = () => all().filter(r => !r.conferido).length;
  window.__PUBLIC_RPC = async (name, a) => {
    window.__calls.push([name, a]);
    if (name === 'pms_share_open') { if (a.p_token !== 'tok') return {ok: false, motivo: 'invalido'}; if (st.fim) return {ok: false, motivo: 'concluido', grupo: 'ESCOLAS'};
      return JSON.parse(JSON.stringify({ok: true, modo: st.modo, criado_por: 'RCAMPOS', criado_em: '2026-11-23T20:00:00Z', grupo: {id: 'g', nome: 'ESCOLAS'}, restantes: rest(), campos: st.campos, itens: st.itens, subitens: st.subitens})); }
    if (st.fim) throw new Error('Este link expirou.');
    if (st.modo !== 'editar') throw new Error('Este link é somente para visualizar.');
    if (name === 'pms_share_save') { const r = all().find(x => x.id === a.p_id); if (r.conferido) throw new Error('já conferido');
      if (a.p_dados.descricao) r.descricao = a.p_dados.descricao; Object.assign(r.campos, a.p_dados.campos || {}); if (a.p_conferido) { r.conferido = true; r.conferido_por = a.p_nome; }
      const n = rest(); if (!n) st.fim = true; keep(); return {ok: true, restantes: n, finalizado: !n}; }
    if (name === 'pms_share_conferir_todos') { all().forEach(r => { r.conferido = true; }); st.fim = true; keep(); return {ok: true, restantes: 0, finalizado: true}; }
  };
})()`;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: W, height: 860}, locale: 'pt-BR'});
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript({path: path.join(__dirname, 'contrast/audit.js')});
  await page.addInitScript(fake('editar'));
  await page.goto('http://127.0.0.1:8090/conferir.html?t=tok');
  await page.waitForSelector('#cf-nome');
  assert.match(await page.textContent('.cf-hero h1'), /ESCOLAS/);
  assert.match(await page.textContent('.cf-hero'), /0 de 3/);
  await page.fill('#cf-nome', 'Ana Paula'); await page.click('#cf-nome-ok');
  await page.waitForSelector('.cf-bar');
  assert.match(await page.textContent('.cf-hello'), /Ana/);
  assert.equal(await page.locator('.cf-card').count(), 3);
  assert.deepEqual(await page.evaluate(() => window.__contrastAudit(document.body)), [], 'contraste');
  // corrigir + conferir um lançamento
  const a = page.locator('.cf-card[data-k="item:a"]');
  await a.locator('[data-act="edit"]').click();
  await a.locator('[data-campo="Telefone"]').fill('87 3841-0000');
  await a.locator('[data-campo="Telefone"]').dispatchEvent('change');
  await a.locator('[data-act="mark"]').click();
  await page.locator('.cf-card[data-k="item:a"] [data-act="save"]').click();
  await page.click('#cf-dialog button[value="yes"]');
  await page.waitForSelector('.cf-card[data-k="item:a"] .cf-stamp');
  assert.match(await page.textContent('.cf-card[data-k="item:a"]'), /Conferido · Ana Paula/);
  assert.equal(await page.locator('.cf-card[data-k="item:a"] [data-act="edit"]').count(), 0, 'conferido fica travado');
  const save = await page.evaluate(() => window.__calls.find(c => c[0] === 'pms_share_save')[1]);
  assert.equal(save.p_dados.campos.Telefone, '87 3841-0000'); assert.equal(save.p_conferido, true); assert.equal(save.p_nome, 'Ana Paula');
  assert.match(await page.textContent('.cf-hero'), /1 de 3/);
  await page.locator('.cf-card[data-k="item:b"] [data-act="edit"]').click();
  await page.screenshot({path: require('os').tmpdir() + `/conferir-lista-${W}.png`, fullPage: true});
  await page.locator('.cf-card[data-k="item:b"] [data-act="edit"]').click();
  // CONFERIR TODOS + Salvar → confirmação → link expira
  await page.click('#cf-all');
  assert.match(await page.textContent('#cf-all'), /Todos marcados/);
  await page.click('#cf-save');
  assert.match(await page.textContent('#cf-dialog'), /todos os 2 lançamentos/);
  await page.click('#cf-dialog button[value="yes"]');
  await page.waitForSelector('.cf-end.is-done');
  assert.match(await page.textContent('.cf-end'), /Conferência concluída/);
  await page.screenshot({path: require('os').tmpdir() + `/conferir-${W}.png`, fullPage: true});
  // reabrir o link: expirou
  await page.reload(); await page.waitForSelector('.cf-end');
  assert.match(await page.textContent('.cf-end'), /expirou/);
  // somente visualizar
  const p2 = await ctx.newPage(); await p2.addInitScript(fake('ver'));
  await p2.goto('http://127.0.0.1:8090/conferir.html?t=tok'); await p2.waitForSelector('.cf-card');
  assert.equal(await p2.locator('#cf-nome, .cf-bar, [data-act]').count(), 0);
  assert.match(await p2.textContent('.cf-view-note'), /Somente visualização/);
  // token inválido
  await p2.goto('http://127.0.0.1:8090/conferir.html?t=xxx'); await p2.waitForSelector('.cf-end');
  assert.match(await p2.textContent('.cf-end'), /não encontrado/);
  // PIN opcional: pede, recusa errado, abre com o certo e manda o PIN junto ao salvar; link de UM lançamento
  const p3 = await ctx.newPage(); p3.on('pageerror', e => errors.push(String(e)));
  await p3.addInitScript(() => {
    window.__calls = [];
    window.__PUBLIC_RPC = async (n, a) => { window.__calls.push([n, a]);
      if (a.p_pin !== '4321') return n === 'pms_share_open' ? {ok: false, motivo: a.p_pin ? 'pin_errado' : 'pin'} : (() => { throw new Error('PIN incorreto.'); })();
      if (n === 'pms_share_open') return {ok: true, modo: 'editar', alvo: 'item', alvo_nome: 'PALCO PRINCIPAL', expira: new Date(Date.now() + 2 * 3600e3).toISOString(), criado_em: '2026-11-23', grupo: {id: 'g', nome: 'EXPOCOSE'}, campos: [], itens: [{id: 'p', tipo: 'item', descricao: 'PALCO PRINCIPAL', campos: {}, conferido: false}], subitens: []};
      return {ok: true, restantes: 0, finalizado: true}; };
    localStorage.setItem('conferir-nome', 'Ana');
  });
  await p3.goto('http://127.0.0.1:8090/conferir.html?t=tok'); await p3.waitForSelector('#cf-pin');
  await p3.fill('#cf-pin', '1111'); await p3.click('#cf-pin-form button');
  await p3.waitForSelector('.cf-pin-bad'); assert.match(await p3.textContent('.cf-pin-bad'), /PIN incorreto/);
  await p3.fill('#cf-pin', '4321'); await p3.click('#cf-pin-form button');
  await p3.waitForSelector('.cf-card');
  assert.match(await p3.textContent('.cf-hero'), /PALCO PRINCIPAL.*EXPOCOSE.*válido até/s);
  await p3.click('[data-act="mark"]'); await p3.click('[data-act="save"]'); await p3.click('#cf-dialog button[value="yes"]');
  await p3.waitForSelector('.cf-end.is-done');
  assert.equal(await p3.evaluate(() => window.__calls.find(c => c[0] === 'pms_share_save')[1].p_pin), '4321');
  // link vencido
  const p4 = await ctx.newPage(); await p4.addInitScript(() => { window.__PUBLIC_RPC = async () => ({ok: false, motivo: 'expirado'}); });
  await p4.goto('http://127.0.0.1:8090/conferir.html?t=tok'); await p4.waitForSelector('.cf-end');
  assert.match(await p4.textContent('.cf-end'), /expirou/);
  assert.deepEqual(errors, []);
  console.log(`ok - link de conferência (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
