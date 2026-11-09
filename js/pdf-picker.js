// Escolha de quais lançamentos entram no PDF: todos, só em andamento, só concluídos ou um a um.
// Na escolha um a um, todos começam DESMARCADOS — o usuário marca o que quer no relatório.
import {recordIsCompleted} from './completed-archive.js?v=8';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const memoryKey = groupId => 'pdf-pick:' + groupId;

function groupData(groupId) {
  const S = window.S || {};
  const items = (S.items || []).filter(i => i.atividade_id === groupId).sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const ids = new Set(items.map(i => i.id));
  const subs = (S.subitems || []).filter(s => ids.has(s.item_id));
  return {items, subs};
}

function monthOf(item) {
  const raw = item.start_date || item.conclusion_date || '';
  const m = String(raw).match(/^(\d{4})-(\d{2})/);
  return m ? {key: m[1] + '-' + m[2], label: MONTHS[Number(m[2]) - 1] + '-' + m[1]} : {key: '0000', label: 'Sem data'};
}

/** Filtra itens e subitens conforme a escolha. */
export function applyPdfScope(items, subitems, {scope = 'todos', pickIds = null} = {}) {
  const done = r => recordIsCompleted(r);
  const keepSub = s => scope === 'todos' || (scope === 'andamento' ? !done(s) : done(s));
  let subs = subitems.filter(keepSub);
  let list = items.filter(item => {
    if (pickIds && !pickIds.has(item.id)) return false;
    if (scope === 'todos') return true;
    const own = scope === 'andamento' ? !done(item) : done(item);
    return own || subs.some(s => s.item_id === item.id);
  });
  const keep = new Set(list.map(i => i.id));
  subs = subs.filter(s => keep.has(s.item_id));
  return {items: list, subitems: subs};
}

export function renderPdfPicker(host, groupId, {dark = false} = {}) {
  if (!host) return;
  const {items, subs} = groupData(groupId);
  const doneCount = items.filter(i => recordIsCompleted(i)).length;
  const subCount = id => subs.filter(s => s.item_id === id).length;
  host.className = 'pdf-pick' + (dark ? ' is-dark' : '');
  host.dataset.group = groupId;
  let previous = [];
  try { previous = JSON.parse(localStorage.getItem(memoryKey(groupId)) || '[]').filter(id => items.some(i => i.id === id)); } catch { /* sem memória */ }
  const sections = [
    ['andamento', '⏳ Em andamento', items.filter(i => !recordIsCompleted(i))],
    ['concluidos', '✅ Concluídos', items.filter(i => recordIsCompleted(i))],
  ];
  const rowHtml = item => `<label class="pdf-pick-row" data-id="${esc(item.id)}" data-search="${esc(norm(item.description + ' ' + (item.responsaveis || '') + ' ' + (item.observacao || '')))}" data-status="${recordIsCompleted(item) ? 'concluidos' : 'andamento'}">
      <input type="checkbox" value="${esc(item.id)}"><span class="pdf-pick-name">${esc(item.description || 'Sem descrição')}</span>${subCount(item.id) ? `<small>${subCount(item.id)} subitem(ns)</small>` : ''}</label>`;
  const sectionHtml = ([key, title, list]) => {
    if (!list.length) return '';
    if (key === 'andamento') return `<section class="pdf-pick-sec" data-status="andamento"><header><b>${title}</b><span>${list.length}</span><button type="button" data-mark="andamento">Marcar todos</button></header>${list.map(rowHtml).join('')}</section>`;
    const months = new Map();
    list.forEach(i => { const m = monthOf(i); if (!months.has(m.key)) months.set(m.key, {...m, list: []}); months.get(m.key).list.push(i); });
    return `<section class="pdf-pick-sec" data-status="concluidos"><header><b>${title}</b><span>${list.length}</span><button type="button" data-mark="concluidos">Marcar todos</button></header>${[...months.values()].sort((a, b) => b.key.localeCompare(a.key)).map(m => `<div class="pdf-pick-month"><div class="pdf-pick-month-head"><span>${esc(m.label)}</span><button type="button" data-month="${esc(m.key)}">Marcar mês (${m.list.length})</button></div>${m.list.map(i => rowHtml(i).replace('class="pdf-pick-row"', `class="pdf-pick-row" data-month="${esc(m.key)}"`)).join('')}</div>`).join('')}</section>`;
  };
  host.innerHTML = `<div class="pdf-pick-title">📋 Lançamentos no PDF</div>
    <div class="pdf-pick-scope" role="radiogroup" aria-label="Quais lançamentos">
      <label><input type="radio" name="pdf-scope-${esc(groupId)}" value="todos" checked> Todos <small>${items.length}</small></label>
      <label><input type="radio" name="pdf-scope-${esc(groupId)}" value="andamento"> Só em andamento <small>${items.length - doneCount}</small></label>
      <label><input type="radio" name="pdf-scope-${esc(groupId)}" value="concluidos"> Só concluídos <small>${doneCount}</small></label>
    </div>
    <label class="pdf-pick-toggle"><input type="checkbox" class="pdf-pick-enable"> <span><b>Escolher os lançamentos um a um</b><small>Aparece uma caixinha ao lado de cada lançamento; todas começam desmarcadas.</small></span></label>
    <div class="pdf-pick-panel" hidden>
      <div class="pdf-pick-tools"><input type="search" class="pdf-pick-search" placeholder="🔎 Procurar lançamento" aria-label="Procurar lançamento">
        <button type="button" data-mark="visiveis">Marcar visíveis</button><button type="button" data-clear>Desmarcar todos</button>
        ${previous.length ? `<button type="button" data-previous>↺ Seleção anterior (${previous.length})</button>` : ''}</div>
      <div class="pdf-pick-count" aria-live="polite">Nenhum lançamento selecionado</div>
      <div class="pdf-pick-list">${sections.map(sectionHtml).join('') || '<p class="pdf-pick-empty">Este grupo ainda não tem lançamentos.</p>'}</div>
    </div>`;
  const panel = host.querySelector('.pdf-pick-panel');
  const boxes = () => [...host.querySelectorAll('.pdf-pick-row input')];
  const visibleRows = () => [...host.querySelectorAll('.pdf-pick-row')].filter(r => !r.hidden && !r.closest('[hidden]'));
  const scope = () => host.querySelector('.pdf-pick-scope input:checked')?.value || 'todos';
  const refresh = () => {
    const q = norm(host.querySelector('.pdf-pick-search').value.trim()), sc = scope();
    host.querySelectorAll('.pdf-pick-sec').forEach(sec => { sec.hidden = sc !== 'todos' && sec.dataset.status !== sc; });
    host.querySelectorAll('.pdf-pick-row').forEach(row => { row.hidden = !!q && !row.dataset.search.includes(q); row.classList.toggle('is-on', row.querySelector('input').checked); });
    host.querySelectorAll('.pdf-pick-month').forEach(m => { m.hidden = ![...m.querySelectorAll('.pdf-pick-row')].some(r => !r.hidden); });
    const n = boxes().filter(b => b.checked && !b.closest('.pdf-pick-sec').hidden).length;
    host.querySelector('.pdf-pick-count').textContent = n ? `${n} lançamento${n === 1 ? '' : 's'} selecionado${n === 1 ? '' : 's'} para o PDF` : 'Nenhum lançamento selecionado';
    host.querySelector('.pdf-pick-count').classList.toggle('is-empty', !n);
  };
  host.addEventListener('change', e => {
    if (e.target.classList.contains('pdf-pick-enable')) panel.hidden = !e.target.checked;
    refresh();
  });
  host.querySelector('.pdf-pick-search').addEventListener('input', refresh);
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !host.contains(b)) return;
    if (b.dataset.mark === 'visiveis') visibleRows().forEach(r => { r.querySelector('input').checked = true; });
    else if (b.dataset.mark) host.querySelectorAll(`.pdf-pick-sec[data-status="${b.dataset.mark}"] .pdf-pick-row`).forEach(r => { if (!r.hidden) r.querySelector('input').checked = true; });
    else if (b.dataset.month) host.querySelectorAll(`.pdf-pick-row[data-month="${b.dataset.month}"]`).forEach(r => { r.querySelector('input').checked = true; });
    else if ('clear' in b.dataset) boxes().forEach(x => { x.checked = false; });
    else if ('previous' in b.dataset) boxes().forEach(x => { x.checked = previous.includes(x.value); });
    refresh();
  });
  refresh();
}

/** Lê a escolha. Retorna {scope, pickIds|null, error}. */
export function readPdfPicker(host) {
  if (!host?.dataset?.group) return {scope: 'todos', pickIds: null};
  const scope = host.querySelector('.pdf-pick-scope input:checked')?.value || 'todos';
  if (!host.querySelector('.pdf-pick-enable')?.checked) return {scope, pickIds: null};
  const ids = [...host.querySelectorAll('.pdf-pick-row input:checked')].filter(b => !b.closest('.pdf-pick-sec').hidden).map(b => b.value);
  if (!ids.length) return {scope, pickIds: null, error: 'Marque pelo menos um lançamento para o PDF (ou desligue “Escolher os lançamentos um a um”).'};
  try { localStorage.setItem(memoryKey(host.dataset.group), JSON.stringify(ids)); } catch { /* sem memória */ }
  return {scope, pickIds: new Set(ids)};
}

if (typeof window !== 'undefined') window.pdfPicker = {render: renderPdfPicker, read: readPdfPicker, apply: applyPdfScope};
