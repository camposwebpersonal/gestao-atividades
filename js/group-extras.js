// Recursos extras por grupo, ligados por extra_fields do grupo:
//
//  map_inline: true      → mapa dentro da tela do grupo, com os locais marcados
//                          (ex.: LOCAIS DE PEGA DE BOI, pino 🐂 via map_emoji).
//  reserva_destino: <id> → o grupo é um CADASTRO RESERVA de outro grupo: os lançamentos ficam
//                          em espera e NÃO entram no relatório do destino até serem enviados
//                          (botão "➡ Enviar" em cada lançamento e "Enviar selecionados").
//                          O grupo de destino mostra quantos aguardam na reserva.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const arg = v => JSON.stringify(String(v ?? '')).replace(/"/g, '&quot;');
const S = () => window.S || {};
export function extraOf(record) {
  let e = record?.extra_fields;
  if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } }
  return {...(e || {}), ...(record?.reserva_destino ? {reserva_destino: record.reserva_destino} : {}), ...(record?.map_inline ? {map_inline: record.map_inline} : {})};
}
const groupById = id => (S().secs || []).find(g => String(g.id) === String(id)) || null;
export const reserveTarget = group => { const id = extraOf(group).reserva_destino; return id ? groupById(id) : null; };
export const isReserveGroup = group => Boolean(extraOf(group).reserva_destino);
export const reservesOf = group => (S().secs || []).filter(g => String(extraOf(g).reserva_destino || '') === String(group?.id || ''));
window.isReserveGroup = isReserveGroup;

const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const digits = v => String(v || '').replace(/\D+/g, '');
/** Lançamento parecido já existe no grupo de destino? (mesmo nome ou mesmo telefone) */
export function findDuplicate(record, target) {
  if (!record || !target) return null;
  const ef = r => { let e = r.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e || {}; };
  const phone = r => digits(Object.entries(ef(r)).find(([k]) => /contato|telefone|whats/i.test(k))?.[1]);
  const name = norm(record.description), tel = phone(record);
  return (S().items || []).find(i => String(i.atividade_id) === String(target.id) && i.concluded != 1 &&
    ((name && norm(i.description) === name) || (tel.length >= 8 && phone(i).slice(-8) === tel.slice(-8)))) || null;
}

// ── Envio da reserva para o grupo de destino ──
window.sendReserveRecords = async function (entries, {silent = false} = {}) {
  const list = (entries || []).filter(e => e && e.id);
  if (!list.length) { window.toast?.('Marque pelo menos um lançamento para enviar.', 'error'); return; }
  const first = (list[0].table === 'subitems' ? S().subitems : S().items).find(r => r.id === list[0].id);
  const reserve = groupById(first?.atividade_id), target = reserveTarget(reserve);
  if (!reserve || !target) { window.toast?.('Grupo de destino não encontrado.', 'error'); return; }
  if (!window.userCanGroup?.(reserve, 'editar') || !window.userCanGroup?.(target, 'editar')) { window.toast?.(`Você precisa poder gerenciar "${target.name}" para enviar.`, 'error', 7000); return; }
  const dups = list.map(e => (e.table === 'subitems' ? S().subitems : S().items).find(r => r.id === e.id)).filter(Boolean).filter(r => findDuplicate(r, target));
  const msg = `Enviar ${list.length} lançamento${list.length === 1 ? '' : 's'} para "${target.name}"?\n\nA partir daí ${list.length === 1 ? 'ele entra' : 'eles entram'} no relatório e nos avisos desse grupo.` +
    (dups.length ? `\n\n⚠️ ${dups.length} parece${dups.length === 1 ? '' : 'm'} já existir lá (mesmo nome ou telefone): ${dups.slice(0, 3).map(r => r.description).join(', ')}${dups.length > 3 ? '…' : ''}` : '');
  if (!silent && !confirm(msg)) return;
  const move = window.moveAttendanceRecord;
  if (typeof move !== 'function') { window.toast?.('Atualize a página e tente de novo.', 'error'); return; }
  let ok = 0; const moved = [], failed = [];
  for (const e of list) {
    try { await move({source_id: e.id, source_table: e.table || 'items', target_group: target.id, target_parent: null}); ok++; moved.push(e); }
    catch (error) { failed.push(error.message || String(error)); }
  }
  await window.loadData?.({forceRemote: true});
  window.openActivity?.(reserve.id);
  if (ok) window.toast?.(`📤 ${ok} enviado${ok === 1 ? '' : 's'} para "${target.name}".`, 'success', 9000, {label: 'Desfazer', onClick: () => window.returnToReserve(moved, reserve.id)});
  if (failed.length) window.toast?.(`${failed.length} não ${failed.length === 1 ? 'foi enviado' : 'foram enviados'}: ${failed[0]}`, 'error', 9000);
};
/** Desfazer: volta os lançamentos enviados para a reserva. */
window.returnToReserve = async function (entries, reserveId) {
  let ok = 0;
  for (const e of entries || []) { try { await window.moveAttendanceRecord({source_id: e.id, source_table: e.table || 'items', target_group: reserveId, target_parent: null}); ok++; } catch (_) { /* segue */ } }
  await window.loadData?.({forceRemote: true}); window.openActivity?.(reserveId);
  window.toast?.(`↩ ${ok} lançamento${ok === 1 ? '' : 's'} de volta à reserva.`, 'info', 5000);
};
window.sendReserveSelected = function (groupId) {
  const picked = [...document.querySelectorAll('#content .mass-sel:checked')].map(cb => ({id: cb.dataset.id, table: cb.dataset.issub === 'true' ? 'subitems' : 'items'}));
  const items = new Set(picked.filter(p => p.table === 'items').map(p => p.id));
  // subitem marcado junto com o item pai já vai com ele
  const list = picked.filter(p => p.table === 'items' || !items.has((S().subitems || []).find(s => s.id === p.id)?.item_id));
  window.sendReserveRecords(list);
};
window.selectAllReserve = function (on = true) {
  document.querySelectorAll('#content .mass-sel').forEach(cb => { if (cb.dataset.issub !== 'true') cb.checked = on; });
  updateReserveCount();
};
function updateReserveCount() {
  const n = document.querySelectorAll('#content .mass-sel:checked').length;
  const b = document.querySelector('#content .reserve-send-selected'); if (b) { b.disabled = !n; b.querySelector('b').textContent = n; }
}
document.addEventListener('change', e => { if (e.target?.classList?.contains('mass-sel')) updateReserveCount(); });

function reserveBar(group) {
  const target = reserveTarget(group);
  const items = (S().items || []).filter(i => String(i.atividade_id) === String(group.id) && i.concluded != 1);
  const dupCount = target ? items.filter(i => findDuplicate(i, target)).length : 0;
  return `<section class="group-extra-bar reserve-bar" aria-label="Cadastro reserva">
    <div class="reserve-bar-title"><span aria-hidden="true">📥</span><div><strong>Cadastro reserva · ${items.length} em espera</strong>
      <small>Estes lançamentos <b>não entram</b> no relatório de “${esc(target?.name || 'grupo de destino')}”. Quando for atender, envie.</small></div></div>
    ${dupCount ? `<p class="reserve-dup">⚠️ ${dupCount} já ${dupCount === 1 ? 'parece existir' : 'parecem existir'} em “${esc(target?.name)}” (mesmo nome ou telefone).</p>` : ''}
    <div class="reserve-bar-actions">
      <button type="button" class="reserve-select-all" onclick="selectAllReserve(true)">☑ Marcar todos</button>
      <button type="button" class="reserve-send-selected" onclick="sendReserveSelected(${arg(group.id)})" disabled>➡ Enviar selecionados (<b>0</b>)</button>
      ${target ? `<button type="button" class="reserve-open-target" onclick="openActivity(${arg(target.id)})">Abrir ${esc(target.name)} ›</button>` : ''}
    </div></section>`;
}
function targetChip(group) {
  const reserves = reservesOf(group);
  if (!reserves.length) return '';
  const total = reserves.reduce((n, r) => n + (S().items || []).filter(i => String(i.atividade_id) === String(r.id) && i.concluded != 1).length, 0);
  return `<section class="group-extra-bar reserve-chip"><span aria-hidden="true">📥</span><span><b>${total}</b> solicitaç${total === 1 ? 'ão aguarda' : 'ões aguardam'} no cadastro reserva</span>${reserves.map(r => `<button type="button" onclick="openActivity(${arg(r.id)})">Ver reserva ›</button>`).join('')}</section>`;
}

// ── Mapa dentro do grupo ──
let inlineMap = null;
function inlineMapSection(group) {
  const points = window.groupMapPoints?.(group.id) || [];
  const total = (S().items || []).filter(i => String(i.atividade_id) === String(group.id)).length;
  const emoji = extraOf(group).map_emoji || '📍';
  return `<section class="group-extra-bar group-inline-map" aria-label="Mapa dos locais">
    <header><span aria-hidden="true">${esc(emoji)}</span><div><strong>Mapa dos locais</strong><small>${points.length} de ${total} com localização${total > points.length ? ` · ${total - points.length} sem ponto marcado` : ''}</small></div>
    <button type="button" onclick="openGroupGeoMap(${arg(group.id)})">🗺️ Abrir mapa grande</button></header>
    ${points.length ? `<div class="group-inline-map-canvas" id="group-inline-map"></div>` : `<p class="group-inline-map-empty">Nenhum local marcado ainda. Ao lançar ou editar, use <b>📍 Localização</b> para marcar o ponto.</p>`}
  </section>`;
}
function drawInlineMap(group) {
  try { inlineMap?.remove(); } catch (_) { /* */ }
  inlineMap = null;
  const host = document.getElementById('group-inline-map');
  if (!host) return;
  const start = () => {
    if (!window.L) { setTimeout(start, 250); return; }
    if (!host.isConnected) return;
    const points = window.groupMapPoints?.(group.id) || [];
    inlineMap = window.L.map(host, {zoomControl: true});
    window.cooperativeGestures?.(inlineMap, host);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(inlineMap);
    const emoji = extraOf(group).map_emoji;
    const bounds = [];
    for (const p of points) {
      const ll = [p.location.latitude, p.location.longitude]; bounds.push(ll);
      const opts = emoji && window.emojiPinIcon ? {icon: window.emojiPinIcon(emoji), title: p.record.description || ''} : {};
      window.L.marker(ll, opts).addTo(inlineMap).bindPopup(`<div class="geo-popup"><strong>${esc(p.record.description || 'Local')}</strong><div class="geo-popup-actions"><button type="button" onclick="geoOpenRecord('${p.table}','${esc(p.record.id)}')">Abrir</button><a href="${esc(p.location.maps_url)}" target="_blank" rel="noopener">Google Maps</a></div></div>`);
    }
    if (bounds.length === 1) inlineMap.setView(bounds[0], 15); else inlineMap.fitBounds(bounds, {padding: [30, 30], maxZoom: 15});
  };
  start();
}

/** Chamado depois que a tela do grupo é desenhada (junto com decoratePipaGroup). */
window.decorateGroupExtras = function (groupId) {
  const group = groupById(groupId);
  const content = document.getElementById('content');
  if (!content) return;
  content.querySelectorAll(':scope > .group-extra-bar').forEach(el => el.remove());
  if (!group) return;
  const e = extraOf(group);
  const anchor = content.querySelector(':scope > .nav-trail');
  const add = html => { if (!html) return; anchor ? anchor.insertAdjacentHTML('afterend', html) : content.insertAdjacentHTML('afterbegin', html); };
  if (e.map_inline) add(inlineMapSection(group));
  if (e.reserva_destino) add(reserveBar(group));
  else add(targetChip(group));
  if (e.map_inline) drawInlineMap(group);
  updateReserveCount();
};
