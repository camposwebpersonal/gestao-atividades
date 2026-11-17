// Seleção em massa na tela do grupo (lista ou cards): barra fixa com "Selecionar todos",
// contagem, ✓ Concluir / ↺ Reabrir (quando o grupo tem Controle de Conclusão), Excluir e
// "Limpar". Shift + clique marca um intervalo. Concluir pede a data (hoje por padrão) e tem Desfazer.
// Usa as caixinhas .mass-sel que já existem em cada item/subitem.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const S = () => window.S || {};
const hasControl = g => g?.controle_pendencias === 1 || g?.controle_pendencias === true || g?.controle_pendencias === '1';
const isDone = r => Number(r?.concluded) === 1;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let currentGroupId = null, lastClicked = null;

const boxes = () => [...document.querySelectorAll('#content .mass-sel')].filter(b => b.offsetParent !== null && !b.closest('[hidden]'));
const checked = () => [...document.querySelectorAll('#content .mass-sel:checked')];
const recordOf = box => (box.dataset.issub === 'true' ? S().subitems : S().items)?.find(r => r.id === box.dataset.id);

function selection() {
  const list = checked().map(b => ({id: b.dataset.id, isSub: b.dataset.issub === 'true', rec: recordOf(b)})).filter(x => x.rec);
  // subitem marcado junto com o item pai já segue o pai
  const items = new Set(list.filter(x => !x.isSub).map(x => x.id));
  return list.filter(x => !x.isSub || !items.has(x.rec.item_id));
}

function paint() {
  const bar = document.getElementById('mass-bar'); if (!bar) return;
  const group = (S().secs || []).find(g => g.id === currentGroupId);
  const all = boxes(), sel = selection(), n = checked().length;
  const allItems = all.filter(b => b.dataset.issub !== 'true');
  const allOn = allItems.length > 0 && allItems.every(b => b.checked);
  bar.classList.toggle('has-selection', n > 0);
  bar.querySelector('.mass-all input').checked = allOn;
  bar.querySelector('.mass-all input').indeterminate = n > 0 && !allOn;
  bar.querySelector('.mass-all b').textContent = n ? `${n} selecionado${n === 1 ? '' : 's'}` : `Selecionar todos (${allItems.length})`;
  const open = sel.filter(x => !isDone(x.rec)).length, done = sel.filter(x => isDone(x.rec)).length;
  const control = hasControl(group);
  const btn = (cls, show, label) => { const b = bar.querySelector(cls); if (b) { b.hidden = !show; if (label) b.innerHTML = label; } };
  btn('.mass-conclude', control && open > 0, `✓ Concluir <b>${open}</b>`);
  btn('.mass-reopen', control && done > 0, `↺ Reabrir <b>${done}</b>`);
  btn('.mass-delete', n > 0 && window.userCanDeleteItems?.() !== false);
  btn('.mass-clear', n > 0);
  bar.querySelector('.mass-hint').hidden = n > 0;
}

function barHtml(group) {
  const control = hasControl(group);
  return `<div id="mass-bar" class="mass-bar" role="region" aria-label="Seleção de lançamentos">
    <label class="mass-all"><input type="checkbox" aria-label="Selecionar todos os lançamentos visíveis"><b>Selecionar todos</b></label>
    <span class="mass-hint">${control ? 'Marque os lançamentos para concluir, reabrir ou excluir de uma vez.' : 'Marque os lançamentos para excluir de uma vez.'} Shift + clique marca um intervalo.</span>
    <div class="mass-actions">
      <button type="button" class="mass-conclude" hidden>✓ Concluir</button>
      <button type="button" class="mass-reopen" hidden>↺ Reabrir</button>
      <button type="button" class="mass-delete" hidden>🗑 Excluir</button>
      <button type="button" class="mass-clear" hidden>Limpar seleção</button>
    </div>
  </div>`;
}

async function applyStatus(list, done, date) {
  const {updateDoc, doc, db} = window;
  const before = [], jobs = [];
  const put = (table, rec, data) => { before.push({table, id: rec.id, data: {concluded: rec.concluded ?? 0, conclusion_date: rec.conclusion_date ?? null, status: rec.status || 'pendente', auto_concluded: rec.auto_concluded ?? false}}); jobs.push(() => updateDoc(doc(db, table, rec.id), data)); };
  for (const {isSub, rec} of list) {
    if (done) {
      put(isSub ? 'subitems' : 'items', rec, {concluded: 1, conclusion_date: date, status: 'concluido'});
      // item concluído leva junto os subitens que ainda estavam abertos (igual ao botão ✓ do card)
      if (!isSub) for (const sb of (S().subitems || []).filter(s => s.item_id === rec.id && !isDone(s))) put('subitems', sb, {concluded: 1, conclusion_date: date, status: 'concluido', auto_concluded: true});
    } else put(isSub ? 'subitems' : 'items', rec, {concluded: 0, conclusion_date: null, status: 'pendente', auto_concluded: false});
  }
  for (let i = 0; i < jobs.length; i += 15) await Promise.all(jobs.slice(i, i + 15).map(job => job()));
  return before;
}

async function finish(groupId, message, before) {
  await window.loadData?.({forceRemote: true});
  window.openActivity?.(groupId);
  window.toast?.(message, 'success', 9000, before?.length ? {label: 'Desfazer', onClick: async () => {
    const {updateDoc, doc, db} = window;
    for (let i = 0; i < before.length; i += 15) await Promise.all(before.slice(i, i + 15).map(b => updateDoc(doc(db, b.table, b.id), b.data)));
    await window.loadData?.({forceRemote: true}); window.openActivity?.(groupId); window.toast?.('Alteração desfeita.', 'info', 4000);
  }} : null);
}

window.massConclude = function () {
  const group = (S().secs || []).find(g => g.id === currentGroupId);
  const list = selection().filter(x => !isDone(x.rec));
  if (!list.length) { window.toast?.('Nenhum lançamento em aberto selecionado.', 'error'); return; }
  if (!window.userCanGroup?.(group, 'editar')) { window.toast?.('Você não pode alterar lançamentos deste grupo.', 'error'); return; }
  const names = list.slice(0, 4).map(x => `<li>${esc(x.rec.description || 'Sem nome')}</li>`).join('') + (list.length > 4 ? `<li>… e mais ${list.length - 4}</li>` : '');
  window.openModal('✓ Concluir lançamentos', `${list.length} selecionado${list.length === 1 ? '' : 's'} em ${group?.name || ''}`, `<div class="mass-modal">
    <ul class="mass-modal-list">${names}</ul>
    <label class="mass-modal-check"><input type="checkbox" id="mass-use-date" checked onchange="document.getElementById('mass-date').disabled=!this.checked"> Registrar a data de conclusão</label>
    <div class="form-group"><label for="mass-date">Data da conclusão</label><input type="date" id="mass-date" value="${today()}" max="${today()}"></div>
    <p class="mass-modal-note">Itens concluídos levam junto os subitens que ainda estavam abertos. Dá para desfazer logo depois.</p>
    <div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="button" class="btn-save" id="mass-conclude-ok" onclick="massConcludeConfirm()">✓ Concluir ${list.length}</button></div></div>`);
};
window.massConcludeConfirm = async function () {
  const btn = document.getElementById('mass-conclude-ok'); if (btn?.disabled) return; if (btn) { btn.disabled = true; btn.textContent = 'Concluindo…'; }
  const date = document.getElementById('mass-use-date')?.checked ? (document.getElementById('mass-date')?.value || today()) : null;
  const list = selection().filter(x => !isDone(x.rec)), groupId = currentGroupId;
  try {
    const before = await applyStatus(list, true, date);
    window.closeModal();
    await finish(groupId, `✅ ${list.length} lançamento${list.length === 1 ? '' : 's'} concluído${list.length === 1 ? '' : 's'}. Estão na aba Concluídos.`, before);
  } catch (error) { window.toast?.('Não foi possível concluir: ' + (window.friendlyDbError?.(error) || error.message), 'error', 8000); if (btn) { btn.disabled = false; btn.textContent = 'Tentar de novo'; } }
};
window.massReopen = async function () {
  const group = (S().secs || []).find(g => g.id === currentGroupId);
  const list = selection().filter(x => isDone(x.rec));
  if (!list.length) return;
  if (!window.userCanGroup?.(group, 'editar')) { window.toast?.('Você não pode alterar lançamentos deste grupo.', 'error'); return; }
  if (!confirm(`Reabrir ${list.length} lançamento${list.length === 1 ? '' : 's'} (voltam para em andamento)?`)) return;
  try { const before = await applyStatus(list, false, null); await finish(currentGroupId, `↺ ${list.length} reaberto${list.length === 1 ? '' : 's'}.`, before); }
  catch (error) { window.toast?.('Não foi possível reabrir: ' + (window.friendlyDbError?.(error) || error.message), 'error', 8000); }
};

/** Chamado depois que a tela do grupo é desenhada. */
window.decorateMassSelect = function (groupId) {
  currentGroupId = groupId; lastClicked = null;
  document.getElementById('mass-bar')?.remove();
  const content = document.getElementById('content');
  if (!content || !content.querySelector('.mass-sel')) return;
  const group = (S().secs || []).find(g => g.id === groupId);
  const anchor = content.querySelector('#items-cnt') || null;
  const html = barHtml(group);
  if (anchor) anchor.insertAdjacentHTML('beforebegin', html); else content.insertAdjacentHTML('afterbegin', html);
  const bar = document.getElementById('mass-bar');
  bar.querySelector('.mass-all input').addEventListener('change', e => {
    const on = e.target.checked;
    boxes().forEach(b => { if (b.dataset.issub !== 'true' || !on) b.checked = on; });
    document.dispatchEvent(new Event('change')); paint();
  });
  bar.querySelector('.mass-conclude').onclick = () => window.massConclude();
  bar.querySelector('.mass-reopen').onclick = () => window.massReopen();
  bar.querySelector('.mass-delete').onclick = () => window.excluirSelecionados?.(groupId);
  bar.querySelector('.mass-clear').onclick = () => { checked().forEach(b => { b.checked = false; }); paint(); };
  paint();
};

// Shift + clique marca/desmarca o intervalo; qualquer mudança atualiza a barra.
document.addEventListener('click', e => {
  const box = e.target.closest?.('#content .mass-sel'); if (!box) return;
  if (e.shiftKey && lastClicked && lastClicked !== box && lastClicked.isConnected) {
    const list = boxes(), a = list.indexOf(lastClicked), b = list.indexOf(box);
    if (a >= 0 && b >= 0) list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => { x.checked = box.checked; });
  }
  lastClicked = box; setTimeout(paint);
}, true);
document.addEventListener('change', e => { if (e.target?.classList?.contains('mass-sel')) paint(); });
