// Página pública do LINK DE CONFERÊNCIA (conferir.html?t=TOKEN) — neuroarquitetura:
// acolhe pelo nome, diz em uma frase o que fazer, mostra o progresso (anel) e deixa cada lançamento
// com duas ações claras: ✏️ corrigir e ✓ CONFERIDO. "CONFERIR TODOS" + "💾 Salvar" (com confirmação).
// Conferido = travado. Quando tudo estiver conferido, o link expira e a página agradece.
import {rpc} from './public-client.js?v=4b46995c';

const app = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t') || '';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dBR = v => { if (!v) return ''; const s = String(v); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return s; if (s.length <= 10) return `${m[3]}/${m[2]}/${m[1]}`; const d = new Date(s); return isNaN(d) ? `${m[3]}/${m[2]}/${m[1]}` : d.toLocaleDateString('pt-BR'); };
const parseOpts = o => { let v = o; for (let i = 0; i < 3 && typeof v === 'string'; i++) { try { v = JSON.parse(v); } catch { break; } } return Array.isArray(v) ? v.map(String) : []; };
const NAME_KEY = 'conferir-nome';
let data = null, nome = '', dirty = new Map(), marked = new Set(), open = new Set(), allMode = false, saving = false;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const records = () => [...(data.itens || []), ...(data.subitens || [])];
const key = r => r.tipo + ':' + r.id;
const isDone = r => r.conferido;
const pendentes = () => records().filter(r => !isDone(r));
const tplFor = r => (data.campos || []).filter(t => (t.escopo || 'item') === (r.tipo === 'item' ? 'item' : 'subitem'));

function ring(p) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - p / 100);
  return `<svg class="cf-ring" viewBox="0 0 84 84" role="img" aria-label="${p}% conferido"><circle cx="42" cy="42" r="${r}" class="bg"/><circle cx="42" cy="42" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="42" y="47" text-anchor="middle">${p}%</text></svg>`;
}

function fieldsView(r) {
  const tpl = tplFor(r), vals = r.campos || {}, seen = new Set();
  const rows = [];
  tpl.forEach(t => { const v = vals[t.nome]; seen.add(t.nome); if (v != null && String(v).trim() !== '' && !(Array.isArray(v) && !v.length)) rows.push([t.nome, Array.isArray(v) ? v.join(', ') : t.tipo === 'date' ? dBR(v) : v]); });
  Object.entries(vals).forEach(([k, v]) => { if (!seen.has(k) && v != null && String(v).trim() !== '') rows.push([k, Array.isArray(v) ? v.join(', ') : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dBR(v) : v]); });
  if (r.observacao) rows.push(['Observação', r.observacao]);
  return rows.length ? `<dl class="cf-fields">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '<p class="cf-empty">Sem outros dados preenchidos.</p>';
}

function input(t, value, id) {
  const name = `data-campo="${esc(t.nome)}"`, opts = parseOpts(t.opcoes), v = value ?? '';
  if (t.tipo === 'textarea') return `<textarea id="${id}" ${name} rows="3">${esc(v)}</textarea>`;
  if (t.tipo === 'number') return `<input id="${id}" ${name} type="text" inputmode="decimal" value="${esc(v)}">`;
  if (t.tipo === 'date') return `<input id="${id}" ${name} type="text" inputmode="numeric" placeholder="dd/mm/aaaa" data-date value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dBR(v) : v)}">`;
  if ((t.tipo === 'combobox' || t.tipo === 'radio') && opts.length) return `<select id="${id}" ${name}><option value="">—</option>${opts.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (t.tipo === 'checkboxes' && opts.length) { const set = new Set(Array.isArray(v) ? v : String(v).split(/\s*,\s*/)); return `<div class="cf-checks" ${name} data-multi>${opts.map(o => `<label><input type="checkbox" value="${esc(o)}" ${set.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`; }
  return `<input id="${id}" ${name} type="text" value="${esc(v)}">`;
}

function formHtml(r) {
  const tpl = tplFor(r), vals = {...(r.campos || {}), ...(dirty.get(key(r))?.campos || {})}, d = dirty.get(key(r)) || {};
  const extras = Object.keys(r.campos || {}).filter(k => !tpl.some(t => t.nome === k));
  return `<div class="cf-form">
    <label class="cf-full">Nome / descrição<input type="text" data-k="descricao" value="${esc(d.descricao ?? r.descricao ?? '')}"></label>
    ${[...tpl, ...extras.map(k => ({nome: k, tipo: 'text'}))].map((t, i) => `<label ${t.tipo === 'textarea' || t.tipo === 'checkboxes' ? 'class="cf-full"' : ''}>${esc(t.nome)}${input(t, vals[t.nome], `f-${r.id}-${i}`)}</label>`).join('')}
    <label class="cf-full">Observação<textarea data-k="observacao" rows="2">${esc(d.observacao ?? r.observacao ?? '')}</textarea></label>
  </div>`;
}

function card(r, depth) {
  const k = key(r), done = isDone(r), edit = data.modo === 'editar', isOpen = open.has(k) && !done, mk = marked.has(k);
  const st = r.concluido ? '<span class="cf-tag ok">Concluído</span>' : r.status && r.status !== 'pendente' ? `<span class="cf-tag">${esc(r.status.replace(/_/g, ' '))}</span>` : '';
  return `<article class="cf-card ${done ? 'is-done' : ''} ${mk ? 'is-marked' : ''} ${dirty.has(k) ? 'is-dirty' : ''}" data-k="${k}" style="--d:${depth}">
    ${done ? `<span class="cf-stamp">✓ Conferido${r.conferido_por ? ' · ' + esc(r.conferido_por) : ''}</span>` : ''}
    <header><h3>${esc(r.descricao || 'Sem nome')}</h3>${st}</header>
    ${isOpen ? formHtml(r) : fieldsView(r)}
    ${edit && !done ? `<footer>
      <button type="button" class="cf-btn ghost" data-act="edit">${isOpen ? '▴ Fechar edição' : '✏️ Corrigir'}</button>
      <button type="button" class="cf-check ${mk ? 'on' : ''}" data-act="mark" aria-pressed="${mk}"><span aria-hidden="true">${mk ? '☑' : '☐'}</span> CONFERIDO</button>
      ${(dirty.has(k) || mk) ? '<button type="button" class="cf-btn primary" data-act="save">💾 Salvar</button>' : ''}
    </footer>` : ''}
  </article>`;
}

function listHtml() {
  const subs = data.subitens || [];
  const kids = (pid, ptype) => subs.filter(s => ptype === 'item' ? s.item_id === pid && s.pai_tipo !== 'subitem' : s.pai === pid && s.pai_tipo === 'subitem');
  const tree = (r, depth) => card(r, depth) + kids(r.id, r.tipo === 'item' ? 'item' : 'subitem').map(s => tree(s, depth + 1)).join('');
  return (data.itens || []).map(i => tree(i, 0)).join('') || '<p class="cf-empty">Este grupo ainda não tem lançamentos.</p>';
}

function render() {
  if (!data.ok) return renderEnd();
  const total = records().length, feitos = total - pendentes().length, pct = total ? Math.round(feitos / total * 100) : 0, edit = data.modo === 'editar';
  const needName = edit && !nome;
  app.innerHTML = `
  <header class="cf-hero">
    <img src="img/logo_sertania.png" alt="Prefeitura de Sertânia" class="cf-logo">
    <div class="cf-hero-txt"><span class="cf-hello">${greeting()}${nome ? ', ' + esc(nome.split(' ')[0]) : ''} 👋</span>
      <h1>${esc(data.grupo.nome)}</h1>
      <p>${edit ? (pct === 100 ? 'Tudo conferido. Obrigado!' : `Confira cada lançamento. Se algo estiver errado, toque em <b>✏️ Corrigir</b>; quando estiver certo, marque <b>CONFERIDO</b> e salve.`) : 'Você pode ver todos os lançamentos deste grupo (somente leitura).'}</p>
      <small>Link enviado${data.criado_por ? ' por ' + esc(data.criado_por) : ''} em ${dBR(data.criado_em)}</small></div>
    <div class="cf-hero-ring">${ring(pct)}<small>${feitos} de ${total}</small></div>
  </header>
  ${needName ? `<section class="cf-name"><label for="cf-nome"><b>Antes de começar: qual é o seu nome?</b><small>Ele fica registrado em cada lançamento que você conferir.</small></label><div><input id="cf-nome" type="text" autocomplete="name" placeholder="Seu nome"><button type="button" class="cf-btn primary" id="cf-nome-ok">Começar</button></div></section>` : ''}
  ${edit && !needName ? `<div class="cf-bar" role="toolbar" aria-label="Ações gerais">
    <span class="cf-bar-st"><b>${feitos}</b> de ${total} conferidos${marked.size ? ` · <b>${marked.size}</b> marcado(s) para salvar` : ''}</span>
    <button type="button" class="cf-btn ${allMode ? 'on' : ''}" id="cf-all" ${pendentes().length ? '' : 'disabled'}>${allMode ? '☑ Todos marcados' : '☐ CONFERIR TODOS'}</button>
    <button type="button" class="cf-btn primary" id="cf-save" ${(dirty.size || marked.size) ? '' : 'disabled'}>💾 Salvar</button>
  </div>` : ''}
  ${!edit ? '<p class="cf-view-note">👁 Somente visualização</p>' : ''}
  <section class="cf-list ${needName ? 'is-locked' : ''}">${listHtml()}</section>
  <footer class="cf-foot">Prefeitura Municipal de Sertânia · Gestão de Atividades</footer>
  <dialog id="cf-dialog" class="cf-dialog"></dialog>`;
  bind();
}

function renderEnd() {
  const m = data.motivo;
  const t = m === 'concluido' ? ['✓', 'Conferência concluída', `Todos os lançamentos${data.grupo ? ' de <b>' + esc(data.grupo) + '</b>' : ''} foram conferidos${data.em ? ' em ' + dBR(data.em) : ''}. Este link expirou. Obrigado!`, 'is-done']
    : m === 'revogado' ? ['⛔', 'Link encerrado', 'Quem enviou este link o encerrou. Se precisar, peça um link novo.', 'is-off']
    : ['🔎', 'Link não encontrado', 'Confira se o endereço foi copiado inteiro ou peça um novo link.', 'is-off'];
  app.innerHTML = `<section class="cf-end ${t[3]}"><span class="cf-end-ico" aria-hidden="true">${t[0]}</span><h1>${t[1]}</h1><p>${t[2]}</p><img src="img/logo_sertania.png" alt="Prefeitura de Sertânia" class="cf-logo"></section>`;
}

function collect(cardEl, r) {
  const d = {...(dirty.get(key(r)) || {})}, campos = {...(d.campos || {})};
  cardEl.querySelectorAll('[data-k]').forEach(el => { if (el.tagName !== 'ARTICLE') d[el.dataset.k] = el.value; });
  cardEl.querySelectorAll('[data-campo]').forEach(el => {
    const k = el.dataset.campo;
    if (el.hasAttribute('data-multi')) campos[k] = [...el.querySelectorAll('input:checked')].map(i => i.value);
    else if (el.hasAttribute('data-date')) { const m = el.value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); campos[k] = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : el.value.trim(); }
    else campos[k] = el.value;
  });
  d.campos = campos;
  const changed = d.descricao !== undefined && d.descricao !== (r.descricao || '') || d.observacao !== undefined && d.observacao !== (r.observacao || '') || Object.entries(campos).some(([k, v]) => JSON.stringify(v ?? '') !== JSON.stringify(r.campos?.[k] ?? (Array.isArray(v) ? [] : '')));
  if (changed) dirty.set(key(r), d); else dirty.delete(key(r));
}

const byKey = k => records().find(r => key(r) === k);

function bind() {
  document.getElementById('cf-nome-ok')?.addEventListener('click', () => { const v = document.getElementById('cf-nome').value.trim(); if (v.length < 2) { document.getElementById('cf-nome').focus(); return; } nome = v; try { localStorage.setItem(NAME_KEY, v); } catch { /* sem armazenamento */ } render(); });
  document.getElementById('cf-nome')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('cf-nome-ok').click(); });
  document.getElementById('cf-all')?.addEventListener('click', () => { allMode = !allMode; pendentes().forEach(r => allMode ? marked.add(key(r)) : marked.delete(key(r))); render(); });
  document.getElementById('cf-save')?.addEventListener('click', () => saveAll());
  app.querySelectorAll('.cf-card').forEach(el => {
    const r = byKey(el.dataset.k); if (!r) return;
    el.querySelectorAll('input,textarea,select').forEach(inp => inp.addEventListener('change', () => collect(el, r)));
    el.querySelector('[data-act="edit"]')?.addEventListener('click', () => { if (open.has(key(r))) { collect(el, r); open.delete(key(r)); } else open.add(key(r)); render(); });
    el.querySelector('[data-act="mark"]')?.addEventListener('click', () => { if (open.has(key(r))) collect(el, r); marked.has(key(r)) ? marked.delete(key(r)) : marked.add(key(r)); if (!marked.has(key(r))) allMode = false; render(); });
    el.querySelector('[data-act="save"]')?.addEventListener('click', () => { if (open.has(key(r))) collect(el, r); saveOne(r); });
  });
}

function toast(msg, bad) { const t = document.createElement('div'); t.className = 'cf-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

function ask(title, text, okLabel) {
  return new Promise(resolve => {
    const dlg = document.getElementById('cf-dialog');
    dlg.innerHTML = `<form method="dialog"><h2>${title}</h2><p>${text}</p><div><button value="no" class="cf-btn ghost">Voltar</button><button value="yes" class="cf-btn primary" autofocus>${okLabel}</button></div></form>`;
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), {once: true});
    dlg.showModal ? dlg.showModal() : resolve(confirm(text.replace(/<[^>]+>/g, '')));
  });
}

async function saveRecord(r, conferido) {
  const d = dirty.get(key(r)) || {};
  const res = await rpc('pms_share_save', {p_token: token, p_tipo: r.tipo === 'item' ? 'item' : 'sub', p_id: r.id, p_dados: {descricao: d.descricao, ...(d.observacao !== undefined ? {observacao: d.observacao} : {}), campos: d.campos || {}}, p_conferido: !!conferido, p_nome: nome});
  if (d.descricao) r.descricao = d.descricao; if (d.observacao !== undefined) r.observacao = d.observacao; r.campos = {...(r.campos || {}), ...(d.campos || {})};
  if (conferido) { r.conferido = true; r.conferido_por = nome; marked.delete(key(r)); }
  dirty.delete(key(r)); open.delete(key(r));
  return res;
}

async function saveOne(r) {
  if (saving) return; saving = true;
  try {
    const conf = marked.has(key(r));
    if (conf && !(await ask('Marcar como conferido?', `<b>${esc(r.descricao || '')}</b> ficará travado: depois de conferido não dá mais para alterar por este link.`, '✓ Sim, conferido'))) return;
    const res = await saveRecord(r, conf);
    toast(conf ? '✓ Conferido e salvo!' : '💾 Correção salva.');
    if (res?.finalizado) return finish();
    render();
  } catch (e) { toast(e.message || 'Não foi possível salvar.', true); }
  finally { saving = false; }
}

async function saveAll() {
  if (saving) return;
  const todos = allMode && pendentes().every(r => marked.has(key(r)));
  const n = marked.size;
  if (todos && !(await ask('Conferir todos?', `Você está marcando <b>todos os ${pendentes().length} lançamentos</b> como conferidos. Depois disso ninguém mais poderá alterá-los por este link e o link expira. Deseja continuar?`, '✓ Sim, conferir todos'))) return;
  if (!todos && n && !(await ask('Salvar conferência?', `${n} lançamento(s) serão marcados como conferidos e ficarão travados.`, '✓ Salvar'))) return;
  saving = true;
  try {
    for (const k of [...new Set([...dirty.keys(), ...marked])]) { const r = byKey(k); if (r && !r.conferido) await saveRecord(r, marked.has(k) && !todos); }
    if (todos) { const res = await rpc('pms_share_conferir_todos', {p_token: token, p_nome: nome}); records().forEach(r => { r.conferido = true; r.conferido_por = r.conferido_por || nome; }); if (res?.finalizado !== false) return finish(); }
    toast('💾 Tudo salvo!');
    if (!pendentes().length) return finish();
    allMode = false; render();
  } catch (e) { toast(e.message || 'Não foi possível salvar.', true); }
  finally { saving = false; }
}

function finish() {
  app.innerHTML = `<section class="cf-end is-done"><span class="cf-end-ico" aria-hidden="true">🎉</span><h1>Conferência concluída!</h1><p>Obrigado${nome ? ', ' + esc(nome.split(' ')[0]) : ''}. Os ${records().length} lançamentos de <b>${esc(data.grupo.nome)}</b> foram conferidos e a equipe já pode ver o selo ✓ no sistema. Este link expirou.</p><img src="img/logo_sertania.png" alt="Prefeitura de Sertânia" class="cf-logo"></section>`;
}

(async () => {
  try { nome = localStorage.getItem(NAME_KEY) || ''; } catch { nome = ''; }
  if (!token) { data = {ok: false, motivo: 'invalido'}; return renderEnd(); }
  try { data = await rpc('pms_share_open', {p_token: token}); }
  catch (e) { app.innerHTML = `<section class="cf-end is-off"><span class="cf-end-ico">📶</span><h1>Sem conexão</h1><p>Não foi possível abrir agora. Verifique a internet e tente de novo.</p><button class="cf-btn primary" onclick="location.reload()">Tentar de novo</button></section>`; return; }
  render();
})();
