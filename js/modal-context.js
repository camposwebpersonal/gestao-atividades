// Contexto fixo no topo das janelas de edição: nome do lançamento (atualiza enquanto digita)
// e o caminho Secretaria › Grupo › Item pai. Fica no cabeçalho, que já acompanha a rolagem.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const EDIT_TITLE = /(✏️|➕|🆕|🧯|editar|novo|nova|lançamento)/i;
const NAME_FIELDS = '#it-name,#wp-name,input[id$="-name"],input[id$="-nome"],input[id$="-descricao"],input[id$="-desc"],input[name="nome"],input[name="name"]';
let explicit = false, bound = null, boundSuffix = null;

function host() {
  const head = document.querySelector('#modal-ov .modal-head > div');
  if (!head) return null;
  let el = document.getElementById('modal-ctx');
  if (!el) { el = document.createElement('div'); el.id = 'modal-ctx'; el.className = 'modal-ctx'; head.appendChild(el); }
  return el;
}

function currentGroupFromHash() {
  const m = location.hash.match(/^#activity\/([^/?]+)/);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  return (window.S?.secs || []).find(g => String(g.id) === id) || null;
}

/** Crumbs padrão a partir de um grupo: Secretaria › Grupo. */
export function groupCrumbs(group, secretariaId) {
  if (!group) return [];
  const secId = secretariaId || group.demanda_secretaria_id;
  const sec = (window.S?.secretarias || []).find(s => s.id === secId);
  return [sec && {icon: '🏛️', label: sec.name, kind: 'sec'}, {icon: '📁', label: group.name, kind: 'group'}].filter(Boolean);
}

function render({name = '', nameInput = null, crumbs = [], placeholder = 'Novo lançamento', suffixInput = null, suffix = '', suffixPrefix = ''} = {}) {
  const el = host(); if (!el) return;
  if (bound) { bound.input.removeEventListener('input', bound.fn); bound = null; }
  if (boundSuffix) { boundSuffix.input.removeEventListener('input', boundSuffix.fn); boundSuffix = null; }
  crumbs = crumbs.filter(c => c && c.label);
  const input = typeof nameInput === 'string' ? document.getElementById(nameInput) : nameInput;
  if (!name && !input && !crumbs.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="modal-ctx-name" title=""></div>${crumbs.length ? `<nav class="modal-ctx-path" aria-label="Onde está este lançamento">${crumbs.map(c => `<span class="modal-ctx-crumb is-${c.kind || 'x'}" title="${esc(c.label)}"><i aria-hidden="true">${c.icon || ''}</i>${esc(c.label)}</span>`).join('<b aria-hidden="true">›</b>')}</nav>` : ''}`;
  const nameEl = el.querySelector('.modal-ctx-name');
  const paint = value => { const v = String(value || '').trim(); nameEl.textContent = v || placeholder; nameEl.classList.toggle('is-empty', !v); nameEl.title = v; };
  paint(input ? input.value || name : name);
  if (!input && !name) nameEl.remove();
  if (input) { const fn = () => paint(input.value); input.addEventListener('input', fn); bound = {input, fn}; }
  // Complemento ao lado do nome (ex.: login do usuário "CLAUDIA · claudiaif").
  const sInput = typeof suffixInput === 'string' ? document.getElementById(suffixInput) : suffixInput;
  if (sInput || suffix) {
    const row = document.createElement('div'); row.className = 'modal-ctx-line';
    const nameNode = el.querySelector('.modal-ctx-name');
    if (nameNode) { el.insertBefore(row, nameNode); row.appendChild(nameNode); } else el.prepend(row);
    const tag = document.createElement('span'); tag.className = 'modal-ctx-suffix'; row.appendChild(tag);
    const paintS = value => { const v = String(value || '').trim(); tag.textContent = v ? `${suffixPrefix}${v}` : ''; tag.hidden = !v; tag.title = v; };
    paintS(sInput ? sInput.value || suffix : suffix);
    if (sInput) { const fn = () => paintS(sInput.value); sInput.addEventListener('input', fn); boundSuffix = {input: sInput, fn}; }
  }
}

/** Define o contexto da janela aberta agora (chamado logo após openModal). */
window.setModalContext = ctx => { explicit = true; render(ctx || {}); };

/** Chamado pelo openModal: limpa e, se ninguém definir um contexto, monta um automático. */
window.applyModalContext = (title, ctx) => {
  explicit = false;
  render({});
  if (ctx) { window.setModalContext(ctx); return; }
  queueMicrotask(() => {
    if (explicit || !EDIT_TITLE.test(String(title || ''))) return;
    const body = document.getElementById('modal-body');
    const input = body?.querySelector(NAME_FIELDS);
    const crumbs = groupCrumbs(currentGroupFromHash());
    if (!input && !crumbs.length) return;
    render({nameInput: input, crumbs});
  });
};
