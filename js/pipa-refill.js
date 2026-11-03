// Controle de reabastecimento de água de pipa.
// Cada lançamento de um grupo de pipa guarda em extra_fields:
//   pipa_last_refill  → data do último abastecimento (AAAA-MM-DD)
//   pipa_refill_days  → em quantos dias o local precisa de novo abastecimento
// Situação: vencido (vermelho) · faltam até 5 dias (amarelo) · em dia (verde).

export const PIPA_ALERT_DAYS = 5;
export const REFILL_STATES = {
    vencido: {label: 'Vencido', color: '#dc2626', soft: '#fee2e2', ink: '#991b1b', icon: '⚠'},
    alerta: {label: 'Vence em até 5 dias', color: '#eab308', soft: '#fef9c3', ink: '#854d0e', icon: '⏳'},
    'em-dia': {label: 'Em dia', color: '#16a34a', soft: '#dcfce7', ink: '#166534', icon: '✔'},
    'sem-dados': {label: 'Sem dados de abastecimento', color: '#64748b', soft: '#f1f5f9', ink: '#334155', icon: '•'}
};

const DAY = 86400000;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const plain = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function extraOf(record) {
    try { return typeof record?.extra_fields === 'string' ? JSON.parse(record.extra_fields || '{}') || {} : record?.extra_fields || {}; }
    catch { return {}; }
}

/** Grupo usa o controle? Automático para grupos com "pipa" no nome; pode ser ligado/desligado em extra_fields.refill_control. */
export function isRefillGroup(group) {
    if (!group) return false;
    const flag = extraOf(group).refill_control;
    if (flag === true || flag === false) return flag;
    return /\bpipa\b/.test(plain(group.name));
}

function groupForRecord(record, groups, items) {
    let groupId = record?.atividade_id;
    if (!groupId && record?.item_id) groupId = (items || []).find(item => item.id === record.item_id)?.atividade_id;
    return (groups || []).find(group => String(group.id) === String(groupId));
}

/** Data local (meia-noite) a partir de AAAA-MM-DD; null se inválida. */
export function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) || date.getDate() !== Number(match[3]) ? null : date;
}

export function toInputDate(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const formatDate = date => date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Calcula a situação a partir da data do último abastecimento e do intervalo em dias. */
export function refillStatus(last, days, today = new Date()) {
    const lastDate = parseLocalDate(last);
    const interval = Math.round(Number(days));
    if (!lastDate || !Number.isFinite(interval) || interval < 1) return {state: 'sem-dados', ...REFILL_STATES['sem-dados'], text: 'Informe a data do último abastecimento e os dias para reabastecer.'};
    const due = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + interval);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysLeft = Math.round((due - base) / DAY);
    const state = daysLeft < 0 ? 'vencido' : daysLeft <= PIPA_ALERT_DAYS ? 'alerta' : 'em-dia';
    const text = state === 'vencido'
        ? `Vencido há ${plural(-daysLeft, 'dia', 'dias')} (desde ${formatDate(due)})`
        : daysLeft === 0 ? `Vence hoje (${formatDate(due)})`
        : state === 'alerta' ? `Vence em ${plural(daysLeft, 'dia', 'dias')} (${formatDate(due)})`
        : `Em dia · próximo abastecimento em ${formatDate(due)} (${plural(daysLeft, 'dia', 'dias')})`;
    return {state, ...REFILL_STATES[state], last: lastDate, interval, due, daysLeft, text};
}

export function recordRefillStatus(record, today = new Date()) {
    const extra = extraOf(record);
    return refillStatus(extra.pipa_last_refill, extra.pipa_refill_days, today);
}

/** Bloco do formulário do lançamento. */
export function refillEditorHtml(record, prefix = 'it-pipa') {
    const extra = extraOf(record);
    const last = parseLocalDate(extra.pipa_last_refill) ? extra.pipa_last_refill : '';
    const days = Number(extra.pipa_refill_days) > 0 ? Math.round(Number(extra.pipa_refill_days)) : '';
    const status = refillStatus(last, days);
    return `<section class="pipa-refill-editor" id="${prefix}-box">
  <div class="pipa-refill-head"><span aria-hidden="true">💧</span><div><strong>Reabastecimento de água de pipa</strong><small>O mapa marca o local em vermelho quando vencer e em amarelo quando faltarem até ${PIPA_ALERT_DAYS} dias.</small></div></div>
  <div class="pipa-refill-fields">
    <label for="${prefix}-last"><span>Último abastecimento</span>
      <span class="pipa-refill-date"><input type="date" id="${prefix}-last" value="${esc(last)}" oninput="previewPipaRefill('${prefix}')"><button type="button" onclick="setPipaRefillToday('${prefix}')">Hoje</button></span></label>
    <label for="${prefix}-days"><span>Dias para reabastecer</span>
      <input type="number" id="${prefix}-days" min="1" max="365" step="1" inputmode="numeric" placeholder="Ex.: 30" value="${esc(days)}" oninput="previewPipaRefill('${prefix}')"></label>
  </div>
  <p class="pipa-refill-preview is-${status.state}" id="${prefix}-preview" aria-live="polite">${esc(status.text)}</p>
</section>`;
}

/** Lê o formulário. Retorna {last, days} (strings vazias/nulos removem o controle) ou lança erro de validação. */
export function readRefillEditor(prefix = 'it-pipa', root = document) {
    const lastInput = root.getElementById ? root.getElementById(`${prefix}-last`) : root.querySelector(`#${prefix}-last`);
    const daysInput = root.getElementById ? root.getElementById(`${prefix}-days`) : root.querySelector(`#${prefix}-days`);
    if (!lastInput && !daysInput) return null;
    const last = String(lastInput?.value || '').trim();
    const rawDays = String(daysInput?.value || '').trim();
    if (last && !parseLocalDate(last)) throw new Error('Data do último abastecimento inválida.');
    if (rawDays && (!/^\d+$/.test(rawDays) || Number(rawDays) < 1 || Number(rawDays) > 365)) throw new Error('Dias para reabastecer: use um número inteiro de 1 a 365.');
    return {last, days: rawDays ? Number(rawDays) : null};
}

/** Aplica os valores lidos em extra_fields (remove quando vazio). */
export function applyRefillToExtra(extra, values) {
    if (!values) return extra;
    if (values.last) extra.pipa_last_refill = values.last; else delete extra.pipa_last_refill;
    if (values.days) extra.pipa_refill_days = values.days; else delete extra.pipa_refill_days;
    return extra;
}

/** Selo exibido no card do lançamento. */
export function refillBadgeHtml(record, today = new Date()) {
    const status = recordRefillStatus(record, today);
    if (status.state === 'sem-dados') return `<div class="pipa-refill-badge is-sem-dados" title="Abra o lançamento para informar o abastecimento">💧 Sem data de abastecimento</div>`;
    return `<div class="pipa-refill-badge is-${status.state}" title="${esc(status.label)}">💧 ${esc(status.text)}</div>`;
}

/** Ícone colorido para o mapa (Leaflet divIcon). */
export function refillMarkerHtml(state) {
    const s = REFILL_STATES[state] || REFILL_STATES['sem-dados'];
    return `<span class="pipa-pin is-${state}" style="--pin:${s.color}"><i>💧</i></span>`;
}

if (typeof window !== 'undefined') {
    window.pipaRefill = {isRefillGroup, recordRefillStatus, refillStatus, REFILL_STATES};
    window.previewPipaRefill = prefix => {
        const box = document.getElementById(`${prefix}-preview`);
        if (!box) return;
        const status = refillStatus(document.getElementById(`${prefix}-last`)?.value, document.getElementById(`${prefix}-days`)?.value);
        box.className = `pipa-refill-preview is-${status.state}`;
        box.textContent = status.text;
    };
    window.setPipaRefillToday = prefix => {
        const input = document.getElementById(`${prefix}-last`);
        if (!input) return;
        input.value = toInputDate(new Date());
        window.previewPipaRefill(prefix);
    };
    window.recordRefillBadge = (record, table) => {
        if (table !== 'items' && table !== 'subitems') return '';
        const group = groupForRecord(record, window.S?.secs, window.S?.items);
        return isRefillGroup(group) ? refillBadgeHtml(record) : '';
    };
}

/** Resumo no topo da página do grupo de pipa (contagem por situação + atalho para o mapa). */
export function pipaGroupSummary(records, hasLocation = () => false, today = new Date()) {
    const counts = {vencido: 0, alerta: 0, 'em-dia': 0, 'sem-dados': 0};
    let mapped = 0;
    for (const record of records) { counts[recordRefillStatus(record, today).state] += 1; if (hasLocation(record)) mapped += 1; }
    return {counts, mapped, total: records.length};
}

if (typeof window !== 'undefined') {
    window.decoratePipaGroup = groupId => {
        const group = window.S?.secs?.find(item => String(item.id) === String(groupId));
        const content = document.getElementById('content');
        content?.querySelector(':scope > .pipa-group-bar')?.remove();
        if (!group || !content || !isRefillGroup(group)) return;
        const items = (window.S?.items || []).filter(item => String(item.atividade_id) === String(group.id));
        const ids = new Set(items.map(item => item.id));
        const records = [...items, ...(window.S?.subitems || []).filter(sub => String(sub.atividade_id) === String(group.id) || ids.has(sub.item_id))];
        const {counts, mapped, total} = pipaGroupSummary(records, record => Boolean(window.recordLocation?.(record)));
        const arg = JSON.stringify(String(group.id)).replace(/"/g, '&quot;');
        const chip = (state, label) => `<button type="button" class="pipa-group-chip is-${state}" onclick="openGroupGeoMap(${arg},'${state}')" title="Ver no mapa: ${esc(label)}"><b>${counts[state]}</b><span>${esc(label)}</span></button>`;
        content.insertAdjacentHTML('afterbegin', `<section class="pipa-group-bar" aria-label="Controle de reabastecimento de água de pipa">
  <div class="pipa-group-title"><span aria-hidden="true">💧</span><div><strong>Controle de reabastecimento</strong><small>${total} lançamento${total === 1 ? '' : 's'} · ${mapped} com localização no mapa</small></div></div>
  <div class="pipa-group-chips">${chip('vencido', 'Vencidos')}${chip('alerta', 'Vencem em até 5 dias')}${chip('em-dia', 'Em dia')}${chip('sem-dados', 'Sem data')}</div>
  <button type="button" class="pipa-group-map" onclick="openGroupGeoMap(${arg})">🗺️ Ver no mapa</button>
</section>`);
    };
}
