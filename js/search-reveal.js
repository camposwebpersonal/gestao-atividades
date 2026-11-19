// Busca do topo: todo resultado clicado PRECISA aparecer na tela.
// revealRecord abre o grupo do lançamento e, se algo o esconde (filtro salvo, busca interna,
// aba Em andamento/Concluídos, mês do arquivo, item recolhido), limpa/ajusta e avisa o usuário.
// Módulo novo com filtro próprio deve expor um gancho como pocoReveal/licitacaoReveal.
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
const S = () => window.S || {};
// Espera a tela terminar de desenhar: procura o elemento por até `ms` (telas do celular desenham em etapas).
async function waitEl(id, ms = 450) { const end = Date.now() + ms; for (;;) { await frame(); const el = findRecordElement(id); if (el || Date.now() > end) return el; } }
const done = r => Number(r?.concluded) === 1 || String(r?.status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === 'concluido';

export function findRecordElement(id) {
  const v = CSS.escape(String(id)), q = s => document.querySelector(s);
  return q(`#content [data-well-id="${v}"],#content [data-driller-id="${v}"],#content [data-cr="${v}"],#content [data-sort-id="${v}"],#content #ir-${v},#content [data-audit-id="${v}"],#content [data-lista-id="${v}"],#content tr[data-id="${v}"],#content [data-multa-id="${v}"],#content [data-leite-dia="${v}"]`)
    || [...document.querySelectorAll('#content [onclick]')].find(el => (el.getAttribute('onclick') || '').includes(`'${id}'`))?.closest('tr,article,[class*="card"],[class*="row"]') || null;
}
/** Abre tudo que estiver recolhido/oculto em volta do elemento. Devolve true se algo estava escondendo. */
function unhide(el) {
  let changed = false;
  for (let node = el; node && node.id !== 'content'; node = node.parentElement) {
    if (node.hidden) { node.hidden = false; changed = true; }
    if (node.tagName === 'DETAILS' && !node.open) node.open = true;
    if (node.style?.display === 'none') {
      if (node.id?.startsWith('ib-') && window.togItem) window.togItem(node.id.slice(3)); else node.style.display = '';
    }
  }
  return changed;
}
function spotlight(el) {
  document.querySelectorAll('.search-arrival').forEach(n => n.classList.remove('search-arrival'));
  el.classList.add('search-arrival');
  el.scrollIntoView({behavior: 'smooth', block: 'center'});
  setTimeout(() => el.classList.remove('search-arrival'), 4500);
}

window.revealRecord = async function (table, id) {
  const st = S(), isSub = table === 'subitems';
  const record = (isSub ? st.subitems : st.items)?.find(r => String(r.id) === String(id));
  if (!record) { window.toast?.('Lançamento não encontrado. Ele pode ter sido excluído.', 'error'); return false; }
  const item = isSub ? (st.items || []).find(i => i.id === record.item_id) : record;
  const groupId = record.atividade_id || item?.atividade_id, group = (st.secs || []).find(g => g.id === groupId);
  if (!group) { window.toast?.('O grupo deste lançamento não está disponível para seu usuário.', 'error'); return false; }
  let cleared = false;
  // ganchos dos módulos com filtros próprios (ajustam o estado ANTES de desenhar)
  for (const hook of [window.pocoReveal, window.licitacaoReveal, window.multasReveal, window.leiteReveal]) { try { if (hook?.(groupId, id) === true) cleared = true; } catch (e) { console.error('[busca]', e); } }
  window.openActivity(groupId);
  let el = await waitEl(id);
  const laneNow = window.getActivityLane?.(groupId);
  if (!el && laneNow === 'completed' && !done(record)) { window.setActivityLane(groupId, 'active'); el = await waitEl(id); cleared = true; }
  if (!el && window.revealCompletedRecord && (done(record) || done(item) || laneNow !== 'completed')) {
    if (window.revealCompletedRecord(groupId, record, isSub ? item : null)) cleared = true;
    el = await waitEl(id, 700);
    if (!el && laneNow !== 'completed') { window.setActivityLane(groupId, 'active'); el = await waitEl(id); }
  }
  if (!el) { // buscas internas que ficam no campo da tela
    for (const input of document.querySelectorAll('#content input[type="search"],#content #dist-busca')) if (input.value) { input.value = ''; input.dispatchEvent(new Event('input', {bubbles: true})); cleared = true; }
    el = await waitEl(id);
  }
  if (el && unhide(el)) cleared = true;
  if (!el) { // último recurso: mostra o próprio cadastro
    if (typeof window.openItemModal === 'function' && (st.isAdmin || window.userCanGroup?.(group, 'editar')) && !group.controle_distribuicao && !group.controle_contas && !group.controle_estoque) {
      window.toast?.('Este lançamento não aparece na lista desta tela. Abrindo o cadastro dele.', 'info', 6000);
      window.openItemModal(record.id, groupId, isSub, isSub ? (record.parent_id || record.item_id) : null);
      return true;
    }
    window.toast?.(`O lançamento "${record.description || ''}" está em "${group.name}", mas não foi possível posicioná-lo na tela.`, 'error', 8000);
    return false;
  }
  await frame(); spotlight(el);
  if (cleared) window.toast?.('Os filtros desta tela foram limpos para mostrar o resultado da busca.', 'info', 6000);
  return true;
};
/** Cadastros simples (contatos, responsáveis, secretarias, usuários): rola até a linha, limpando filtro se preciso. */
window.revealRow = async function (id) {
  await frame(); await frame();
  let el = findRecordElement(id);
  if (!el || el.hidden || el.offsetParent === null) {
    for (const input of document.querySelectorAll('#content input[type="search"],#content input[oninput*="filter"]')) if (input.value) { input.value = ''; input.dispatchEvent(new Event('input', {bubbles: true})); }
    await frame(); el = findRecordElement(id);
  }
  if (el) { unhide(el); spotlight(el); }
};
