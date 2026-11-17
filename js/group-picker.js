// Seletor de grupo de destino organizado por secretaria (janela "Mover atendimento" / "Redirecionar").
// - Busca por nome da secretaria OU do grupo (sem acento, sem maiúsculas); Enter escolhe o 1º resultado.
// - Secretaria de origem primeiro, depois as outras em ordem alfabética; cada grupo mostra a
//   secretaria pai, quantos lançamentos tem e, se houver nomes repetidos, o caminho completo.
// - "Usados recentemente" no topo (por aparelho) e cartão "Destino" com a secretaria › grupo escolhidos.
// Uso: groupPickerHtml({targets, source, inputId}) dentro do modal e bindGroupPicker(inputId, onChange).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const RECENT_KEY = 'gestao-move-recentes-v1';
const NO_SEC = {id: '', name: 'OUTROS GRUPOS'};

const secOf = group => window.groupHomeSecretary?.(group) || (window.S?.secretarias || []).find(s => String(s.id) === String(group?.demanda_secretaria_id)) || null;
const countOf = group => (window.S?.items || []).filter(i => i.atividade_id === group.id && i.concluded != 1).length;
function recent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
export function rememberDestination(groupId) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([groupId, ...recent().filter(id => id !== groupId)].slice(0, 5))); } catch { /* sem armazenamento */ }
}

/** Organiza os grupos: [{sec, groups:[{group, count, dupe}]}], origem primeiro. */
export function organizeTargets(targets, source) {
  const sourceSec = secOf(source);
  const bySec = new Map();
  for (const group of targets) {
    const sec = secOf(group) || NO_SEC;
    if (!bySec.has(sec.id)) bySec.set(sec.id, {sec, groups: []});
    bySec.get(sec.id).groups.push({group, count: countOf(group)});
  }
  const blocks = [...bySec.values()];
  for (const block of blocks) {
    block.groups.sort((a, b) => String(a.group.name).localeCompare(String(b.group.name), 'pt-BR'));
    const names = new Map(); block.groups.forEach(g => names.set(norm(g.group.name), (names.get(norm(g.group.name)) || 0) + 1));
    block.groups.forEach(g => { g.dupe = names.get(norm(g.group.name)) > 1; });
  }
  return blocks.sort((a, b) => (a.sec.id === sourceSec?.id ? -1 : b.sec.id === sourceSec?.id ? 1 : a.sec === NO_SEC ? 1 : b.sec === NO_SEC ? -1 : String(a.sec.name).localeCompare(String(b.sec.name), 'pt-BR')));
}

const groupButton = ({group, count, dupe}, sec, sourceSecId) => `<button type="button" class="gp-group" role="option" data-group="${esc(group.id)}" data-search="${esc(norm(`${sec.name} ${group.name}`))}" data-sec-search="${esc(norm(sec.name))}" data-name-search="${esc(norm(group.name))}">
  <span class="gp-icon" aria-hidden="true">${esc(group.icon || '📁')}</span>
  <span class="gp-text"><strong>${esc(group.name || 'Sem nome')}</strong><small>${esc(sec.name)}${dupe ? ` · ${count} em aberto` : ''}</small></span>
  ${dupe ? '' : `<span class="gp-count" title="Lançamentos em aberto">${count}</span>`}
</button>`;

export function groupPickerHtml({targets, source, inputId = 'move-group'}) {
  const blocks = organizeTargets(targets, source);
  const sourceSecId = secOf(source)?.id || '';
  const byId = new Map(targets.map(g => [g.id, g]));
  const recents = recent().map(id => byId.get(id)).filter(Boolean).slice(0, 4);
  const total = targets.length, secs = blocks.length;
  return `<div class="group-picker" id="${esc(inputId)}-picker">
  <input type="hidden" id="${esc(inputId)}" value="">
  <div class="gp-chosen" hidden><span class="gp-chosen-label">Destino</span><div class="gp-chosen-path"></div><button type="button" class="gp-change">Trocar</button></div>
  <div class="gp-browser">
    <label class="gp-search"><span aria-hidden="true">🔎</span><input type="search" placeholder="Buscar secretaria ou grupo…" aria-label="Buscar secretaria ou grupo de destino" autocomplete="off"></label>
    <p class="gp-summary">${total} grupo${total === 1 ? '' : 's'} em ${secs} secretaria${secs === 1 ? '' : 's'}</p>
    ${recents.length ? `<section class="gp-block gp-recent"><h4>🕘 Usados recentemente</h4><div class="gp-list">${recents.map(g => { const sec = secOf(g) || NO_SEC; return groupButton({group: g, count: countOf(g), dupe: false}, sec, sourceSecId); }).join('')}</div></section>` : ''}
    ${blocks.map(({sec, groups}) => `<section class="gp-block" data-sec="${esc(sec.id)}"><h4><span>${esc(sec.name)}</span>${sec.id && sec.id === sourceSecId ? '<em>mesma secretaria</em>' : ''}<b>${groups.length}</b></h4><div class="gp-list" role="listbox" aria-label="${esc(sec.name)}">${groups.map(g => groupButton(g, sec, sourceSecId)).join('')}</div></section>`).join('')}
    <p class="gp-empty" hidden>Nenhuma secretaria ou grupo com esse nome.</p>
  </div>
</div>`;
}

export function bindGroupPicker(inputId = 'move-group', onChange = () => {}) {
  const root = document.getElementById(`${inputId}-picker`); if (!root) return;
  const input = document.getElementById(inputId), search = root.querySelector('.gp-search input');
  const browser = root.querySelector('.gp-browser'), chosen = root.querySelector('.gp-chosen');
  const choose = id => {
    const group = (window.S?.secs || []).find(g => g.id === id); if (!group) return;
    const sec = secOf(group);
    input.value = id;
    chosen.querySelector('.gp-chosen-path').innerHTML = `<span>${esc(sec?.name || 'Sem secretaria')}</span><b>›</b><strong>${esc(group.icon || '📁')} ${esc(group.name)}</strong>`;
    chosen.hidden = false; browser.hidden = true;
    onChange(id);
    chosen.querySelector('.gp-change').focus({preventScroll: true});
  };
  const reopen = () => { input.value = ''; chosen.hidden = true; browser.hidden = false; search.value = ''; filter(); onChange(''); search.focus(); };
  const filter = () => {
    const words = norm(search.value).split(' ').filter(Boolean);
    let shown = 0;
    for (const block of root.querySelectorAll('.gp-block')) {
      const recentBlock = block.classList.contains('gp-recent');
      if (recentBlock) { block.hidden = words.length > 0; continue; }
      let any = 0;
      for (const btn of block.querySelectorAll('.gp-group')) {
        const ok = words.every(w => btn.dataset.search.includes(w));
        btn.hidden = !ok; if (ok) any++;
        // destaca o trecho achado no nome do grupo
        const strong = btn.querySelector('strong'), raw = strong.textContent;
        strong.innerHTML = esc(raw);
        const w = words.find(x => btn.dataset.nameSearch.includes(x));
        if (w) { const at = norm(raw).indexOf(w); if (at >= 0) strong.innerHTML = `${esc(raw.slice(0, at))}<mark>${esc(raw.slice(at, at + w.length))}</mark>${esc(raw.slice(at + w.length))}`; }
      }
      block.hidden = !any; shown += any;
    }
    root.querySelector('.gp-empty').hidden = shown > 0;
    root.querySelector('.gp-summary').textContent = words.length ? `${shown} resultado${shown === 1 ? '' : 's'} · Enter escolhe o primeiro` : root.querySelector('.gp-summary').dataset.base;
  };
  root.querySelector('.gp-summary').dataset.base = root.querySelector('.gp-summary').textContent;
  search.addEventListener('input', filter);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const first = root.querySelector('.gp-block:not([hidden]):not(.gp-recent) .gp-group:not([hidden])'); if (first) choose(first.dataset.group); }
    if (e.key === 'ArrowDown') { e.preventDefault(); root.querySelector('.gp-block:not([hidden]) .gp-group:not([hidden])')?.focus(); }
  });
  root.addEventListener('keydown', e => {
    if (!e.target.classList?.contains('gp-group') || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const all = [...root.querySelectorAll('.gp-block:not([hidden]) .gp-group:not([hidden])')], i = all.indexOf(e.target);
    (e.key === 'ArrowDown' ? all[i + 1] : all[i - 1] || search)?.focus();
  });
  root.addEventListener('click', e => {
    const btn = e.target.closest('.gp-group'); if (btn) { choose(btn.dataset.group); return; }
    if (e.target.closest('.gp-change')) reopen();
  });
  if (matchMedia('(pointer:fine)').matches) setTimeout(() => search.focus({preventScroll: true}), 60);
}
