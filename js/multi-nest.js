// Transformar vários lançamentos em subitens de um item — arrastando a seleção ou pelo botão
// "Tornar subitens". Mantém tudo do lançamento: campos personalizados (extra_fields), fotos,
// geolocalização, capa, responsáveis, datas e os subitens que ele já tinha. Desfazer restaura
// os itens com o mesmo identificador.

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const W = () => window;
const S = () => window.S || {items: [], subitems: []};
const plain = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lançamentos marcados nas caixas de seleção da tela atual. */
export function selectedRecords(root = document) {
  const items = [], subs = [];
  root.querySelectorAll('.mass-sel:checked').forEach(box => (box.dataset.issub === 'true' ? subs : items).push(box.dataset.id));
  // Subitem cujo item também foi marcado já vai junto com o item.
  const itemSet = new Set(items);
  return {items: [...new Set(items)], subs: [...new Set(subs)].filter(id => !itemSet.has(S().subitems.find(s => s.id === id)?.item_id))};
}

function descendantsOfSub(subId) {
  const out = [], queue = [subId];
  while (queue.length) {
    const id = queue.shift();
    for (const child of S().subitems) if (child.parent_type === 'subitem' && child.parent_id === id && !out.includes(child)) { out.push(child); queue.push(child.id); }
  }
  return out;
}

/** Plano puro (testável): o que será criado/alterado para aninhar a seleção no item de destino. */
export function planNest({items = [], subs = []}, targetItemId, state = S()) {
  const target = state.items.find(i => i.id === targetItemId);
  if (!target) throw new Error('Item de destino não encontrado.');
  const itemRows = items.filter(id => id !== targetItemId).map(id => state.items.find(i => i.id === id)).filter(Boolean);
  if (itemRows.some(item => item.atividade_id !== target.atividade_id)) throw new Error('Só é possível aninhar lançamentos do mesmo grupo.');
  const subRows = subs.map(id => state.subitems.find(s => s.id === id)).filter(Boolean)
    .filter(sub => !(sub.item_id === targetItemId && sub.parent_type !== 'subitem'));
  return {target, itemRows, subRows};
}

function subPayloadFromItem(item, target, order) {
  return {
    item_id: target.id, atividade_id: target.atividade_id, parent_id: target.id, parent_type: 'item', order_num: order,
    description: item.description || 'Sem nome', observacao: item.observacao || '', responsaveis: item.responsaveis || '',
    secretaria_id: item.secretaria_id || null, start_date: item.start_date || null, deadline_date: item.deadline_date || null,
    concluded: item.concluded || 0, status: item.status || 'pendente', conclusion_date: item.conclusion_date || null,
    auto_concluded: item.auto_concluded || 0, cover_url: item.cover_url || null, resp_url: item.resp_url || null,
    extra_fields: item.extra_fields || {}, created_at: item.created_at || W().serverTimestamp()
  };
}

/** Executa: itens viram subitens do destino; subitens marcados passam a ficar direto no destino. */
export async function nestIntoItem(selection, targetItemId, secId, {silent = false} = {}) {
  const {doc, db, addDoc, updateDoc, setDoc, collection, permanentDeleteDoc, getDocs, query, where} = W();
  const {target, itemRows, subRows} = planNest(selection, targetItemId);
  if (!itemRows.length && !subRows.length) { W().toast?.('Selecione lançamentos diferentes do item de destino.', 'info'); return null; }
  const siblings = S().subitems.filter(s => s.item_id === target.id && s.parent_type !== 'subitem');
  let order = siblings.length ? Math.max(...siblings.map(s => Number(s.order_num) || 0)) + 1 : 0;
  const undo = {items: [], subMoves: []};
  W().__nestBusy = true;
  try {
    for (const item of itemRows) {
      const sub = await addDoc(collection(db, 'subitems'), subPayloadFromItem(item, target, order++));
      const children = S().subitems.filter(s => s.item_id === item.id);
      const childBackup = children.map(c => ({id: c.id, parent_id: c.parent_id, parent_type: c.parent_type, item_id: c.item_id, atividade_id: c.atividade_id}));
      for (const child of children) {
        const top = child.parent_type !== 'subitem';
        await updateDoc(doc(db, 'subitems', child.id), {item_id: target.id, atividade_id: target.atividade_id, ...(top ? {parent_id: sub.id, parent_type: 'subitem'} : {})});
      }
      // Fotos e documentos vinculados acompanham o lançamento.
      let images = [];
      try { images = (await getDocs(query(collection(db, 'entity_images'), where('entity_type', '==', 'item'), where('entity_id', '==', item.id)))).docs.map(d => d.id); } catch (_) {}
      for (const id of images) await updateDoc(doc(db, 'entity_images', id), {entity_type: 'subitem', entity_id: sub.id});
      await permanentDeleteDoc(doc(db, 'items', item.id));
      undo.items.push({item, subId: sub.id, childBackup, images});
    }
    for (const sub of subRows) {
      const before = {parent_id: sub.parent_id, parent_type: sub.parent_type, item_id: sub.item_id, atividade_id: sub.atividade_id, order_num: sub.order_num || 0};
      await updateDoc(doc(db, 'subitems', sub.id), {parent_id: target.id, parent_type: 'item', item_id: target.id, atividade_id: target.atividade_id, order_num: order++});
      const descendants = descendantsOfSub(sub.id).map(d => ({id: d.id, item_id: d.item_id, atividade_id: d.atividade_id}));
      for (const d of descendants) await updateDoc(doc(db, 'subitems', d.id), {item_id: target.id, atividade_id: target.atividade_id});
      undo.subMoves.push({id: sub.id, before, descendants});
    }
  } finally { W().__nestBusy = false; }
  const total = itemRows.length + subRows.length;
  W().pushUndo?.(`Tornar ${total} lançamento(s) subitens`, async () => {
    for (const entry of undo.items.reverse()) {
      const {created_by, created_by_name, updated_by, updated_by_name, audit_created_at, audit_updated_at, sync_at, ...row} = entry.item;
      await setDoc(doc(db, 'items', entry.item.id), row);
      for (const child of entry.childBackup) await updateDoc(doc(db, 'subitems', child.id), {parent_id: child.parent_id, parent_type: child.parent_type, item_id: child.item_id, atividade_id: child.atividade_id});
      for (const id of entry.images) await updateDoc(doc(db, 'entity_images', id), {entity_type: 'item', entity_id: entry.item.id});
      await permanentDeleteDoc(doc(db, 'subitems', entry.subId));
    }
    for (const move of undo.subMoves) {
      await updateDoc(doc(db, 'subitems', move.id), move.before);
      for (const d of move.descendants) await updateDoc(doc(db, 'subitems', d.id), {item_id: d.item_id, atividade_id: d.atividade_id});
    }
    await W().loadData?.(); W().openActivity?.(secId);
  }, async () => { W().toast?.('Use “Tornar subitens” novamente para refazer.', 'info'); });
  await W().loadData?.(); W().openActivity?.(secId);
  if (!silent) W().toast?.(`✓ ${total} lançamento${total === 1 ? '' : 's'} agora ${total === 1 ? 'é subitem' : 'são subitens'} de “${target.description || 'item'}”. Use Desfazer se precisar.`, 'success', 7000);
  return {total, target};
}

// ── Arrastar a seleção ──
let dragSelection = null;
export function startMultiDrag(event, itemId) {
  const box = document.querySelector(`.mass-sel[data-id="${CSS.escape(itemId)}"][data-issub="false"]`);
  const selection = selectedRecords();
  const count = selection.items.length + selection.subs.length;
  if (!box?.checked || count < 2) { dragSelection = null; return false; }
  dragSelection = selection;
  const ghost = document.createElement('div');
  ghost.className = 'multi-drag-ghost';
  ghost.innerHTML = `<b>${count}</b> lançamentos<small>Solte sobre o item que vai recebê-los</small>`;
  document.body.append(ghost);
  try { event.dataTransfer.setDragImage(ghost, 24, 24); } catch (_) {}
  setTimeout(() => ghost.remove(), 0);
  document.body.classList.add('multi-dragging');
  document.querySelectorAll('.mass-sel:checked').forEach(c => c.closest('.item-row,.sub-row')?.classList.add('multi-drag-source'));
  return true;
}
export function multiDragActive() { return Boolean(dragSelection); }
export function endMultiDrag() {
  dragSelection = null;
  document.body.classList.remove('multi-dragging');
  document.querySelectorAll('.multi-drag-source,.multi-drop-target').forEach(row => row.classList.remove('multi-drag-source', 'multi-drop-target'));
}
export async function dropMultiOn(targetItemId, secId) {
  const selection = dragSelection; endMultiDrag();
  if (!selection) return false;
  if (selection.items.includes(targetItemId)) { W().toast?.('Solte sobre um item que não esteja selecionado.', 'info'); return true; }
  await nestIntoItem(selection, targetItemId, secId);
  return true;
}

// ── Botão "Tornar subitens de…" (funciona no celular, sem arrastar) ──
export function openNestPicker(secId) {
  const selection = selectedRecords();
  const count = selection.items.length + selection.subs.length;
  if (!count) { W().toast?.('Marque as caixinhas dos lançamentos que vão virar subitens.', 'info', 6000); return; }
  const chosen = new Set(selection.items);
  const options = S().items.filter(i => i.atividade_id === secId && !chosen.has(i.id)).sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  if (!options.length) { W().toast?.('Não há outro item neste grupo para receber os subitens.', 'info'); return; }
  W().__nestPicker = {secId, selection};
  W().openModal('↳ Tornar subitens', `${count} lançamento${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'} · escolha o item que vai recebê-${count === 1 ? 'lo' : 'los'}`, `
    <div class="nest-picker">
      <input type="search" id="nest-picker-q" placeholder="Buscar item de destino…" oninput="filterNestPicker(this.value)" autocomplete="off">
      <div class="nest-picker-list" id="nest-picker-list">${options.map((item, index) => `<button type="button" data-q="${esc(plain(item.description))}" onclick="confirmNestPicker('${esc(item.id)}')"><span>${index + 1}.</span><strong>${esc(item.description || 'Sem nome')}</strong><small>${S().subitems.filter(s => s.item_id === item.id).length} subitem(ns)</small><i>›</i></button>`).join('')}</div>
      <p class="nest-picker-note">Tudo é preservado: campos, fotos, localização e os subitens que cada lançamento já tinha. Dá para desfazer.</p>
    </div>
    <div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button></div>`);
  setTimeout(() => document.getElementById('nest-picker-q')?.focus(), 60);
}

if (typeof window !== 'undefined') {
  window.nestIntoItem = nestIntoItem;
  window.multiNest = {startMultiDrag, multiDragActive, endMultiDrag, dropMultiOn, selectedRecords};
  window.openNestPicker = openNestPicker;
  window.filterNestPicker = value => { const q = plain(value).trim(); document.querySelectorAll('#nest-picker-list>button').forEach(b => { b.hidden = q && !b.dataset.q.includes(q); }); };
  window.confirmNestPicker = async targetId => {
    const state = W().__nestPicker; if (!state) return;
    W().closeModal?.();
    try { await nestIntoItem(state.selection, targetId, state.secId); } catch (error) { W().toast?.(error.message || String(error), 'error', 8000); }
  };
  document.addEventListener('dragend', () => { if (dragSelection) setTimeout(endMultiDrag, 0); }, true);
}
