// Controle de reabastecimento de água de pipa.
// Cada lançamento de um grupo de pipa guarda em extra_fields:
//   pipa_last_refill  → data do último abastecimento (AAAA-MM-DD)
//   pipa_refill_days  → em quantos dias o local precisa de novo abastecimento
//   pipa_application  → 'completo' ou 'parcial' (como o último pipa foi aplicado)
//   pipa_percent      → quanto do pipa foi aplicado quando parcial (1 a 99, ex.: 50 = meio pipa)
//   pipa_families     → quantas famílias são beneficiadas pelo abastecimento
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

const FRACTIONS = {25: '¼ de pipa', 50: 'meio pipa (½)', 75: '¾ de pipa'};
/** Texto da quantidade aplicada: "Pipa completo", "meio pipa (½)", "30% do pipa". */
export function applicationText(application, percent) {
    if (application === 'completo') return 'Pipa completo';
    if (application !== 'parcial') return '';
    const value = Math.round(Number(percent));
    if (!Number.isFinite(value) || value < 1 || value > 99) return 'Pipa parcial';
    return 'Parcial · ' + (FRACTIONS[value] || `${value}% do pipa`);
}
/** Dados do abastecimento: aplicação, porcentagem, famílias e o equivalente em pipas. */
export function recordSupply(record) {
    const extra = extraOf(record);
    const application = extra.pipa_application === 'completo' || extra.pipa_application === 'parcial' ? extra.pipa_application : '';
    const percent = application === 'parcial' && Number(extra.pipa_percent) >= 1 && Number(extra.pipa_percent) <= 99 ? Math.round(Number(extra.pipa_percent)) : null;
    const families = Number(extra.pipa_families) >= 1 ? Math.round(Number(extra.pipa_families)) : null;
    const share = application === 'completo' ? 1 : application === 'parcial' ? (percent || 0) / 100 : 0;
    const parts = [applicationText(application, percent), families ? plural(families, 'família', 'famílias') : ''].filter(Boolean);
    return {application, percent, families, share, text: parts.join(' · ')};
}

export function recordRefillStatus(record, today = new Date()) {
    const extra = extraOf(record);
    const status = refillStatus(extra.pipa_last_refill, extra.pipa_refill_days, today);
    const supply = recordSupply(record);
    return {...status, supply, detail: [status.state === 'sem-dados' ? '' : status.text, supply.text].filter(Boolean).join(' · ') || status.text};
}

/** Bloco do formulário do lançamento. */
export function refillEditorHtml(record, prefix = 'it-pipa') {
    const extra = extraOf(record);
    const last = parseLocalDate(extra.pipa_last_refill) ? extra.pipa_last_refill : '';
    const days = Number(extra.pipa_refill_days) > 0 ? Math.round(Number(extra.pipa_refill_days)) : '';
    const status = refillStatus(last, days);
    const supply = recordSupply(record);
    return `<section class="pipa-refill-editor" id="${prefix}-box">
  <div class="pipa-refill-head"><span aria-hidden="true">💧</span><div><strong>Reabastecimento de água de pipa</strong><small>O mapa marca o local em vermelho quando vencer e em amarelo quando faltarem até ${PIPA_ALERT_DAYS} dias.</small></div></div>
  <div class="pipa-refill-fields">
    <label for="${prefix}-last"><span>Último abastecimento</span>
      <span class="pipa-refill-date"><input type="date" id="${prefix}-last" value="${esc(last)}" oninput="previewPipaRefill('${prefix}')"><button type="button" onclick="setPipaRefillToday('${prefix}')">Hoje</button></span></label>
    <label for="${prefix}-days"><span>Dias para reabastecer</span>
      <input type="number" id="${prefix}-days" min="1" max="365" step="1" inputmode="numeric" placeholder="Ex.: 30" value="${esc(days)}" oninput="previewPipaRefill('${prefix}')"></label>
  </div>
  <div class="pipa-supply">
    <fieldset class="pipa-apply"><legend>Como o pipa foi aplicado neste local?</legend>
      <div class="pipa-apply-options">
        <label class="pipa-choice"><input type="radio" name="${prefix}-apply" value="completo" ${supply.application === 'completo' ? 'checked' : ''} onchange="pipaApplyChanged('${prefix}')"><span><b>✔ Pipa completo</b><small>Todo o carro-pipa foi descarregado aqui</small></span></label>
        <label class="pipa-choice"><input type="radio" name="${prefix}-apply" value="parcial" ${supply.application === 'parcial' ? 'checked' : ''} onchange="pipaApplyChanged('${prefix}')"><span><b>◐ Parcial</b><small>Meio pipa ou outra proporção</small></span></label>
      </div>
      <div class="pipa-partial" id="${prefix}-partial" ${supply.application === 'parcial' ? '' : 'hidden'}>
        <span>Quanto do pipa foi aplicado?</span>
        <div class="pipa-fraction-quick">${[[25, '¼'], [50, '½ meio pipa'], [75, '¾']].map(([v, l]) => `<button type="button" data-pct="${v}" class="${supply.percent === v ? 'is-on' : ''}" onclick="setPipaPercent('${prefix}',${v})">${l}</button>`).join('')}</div>
        <label for="${prefix}-percent" class="pipa-percent">ou informe: <input type="number" id="${prefix}-percent" min="1" max="99" step="1" inputmode="numeric" placeholder="Ex.: 40" value="${esc(supply.percent ?? '')}" oninput="previewPipaRefill('${prefix}')"> % do pipa</label>
      </div>
    </fieldset>
    <label for="${prefix}-families" class="pipa-families"><span>👨‍👩‍👧 Famílias beneficiadas</span><input type="number" id="${prefix}-families" min="1" max="9999" step="1" inputmode="numeric" placeholder="Ex.: 4" value="${esc(supply.families ?? '')}" oninput="previewPipaRefill('${prefix}')"></label>
  </div>
  <p class="pipa-refill-preview is-${status.state}" id="${prefix}-preview" aria-live="polite">${esc([status.text, supply.text].filter(Boolean).join(' · '))}</p>
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
    const pick = id => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
    const scope = root.querySelectorAll ? root : document;
    const application = scope.querySelector?.(`input[name="${prefix}-apply"]:checked`)?.value || '';
    const rawPercent = String(pick(`${prefix}-percent`)?.value || '').trim();
    const rawFamilies = String(pick(`${prefix}-families`)?.value || '').trim();
    if (application === 'parcial' && (!/^\d+$/.test(rawPercent) || Number(rawPercent) < 1 || Number(rawPercent) > 99)) throw new Error('Pipa parcial: escolha ¼, ½, ¾ ou informe a porcentagem de 1 a 99.');
    if (rawFamilies && (!/^\d+$/.test(rawFamilies) || Number(rawFamilies) < 1 || Number(rawFamilies) > 9999)) throw new Error('Famílias beneficiadas: use um número inteiro (ex.: 4).');
    return {last, days: rawDays ? Number(rawDays) : null, application, percent: application === 'parcial' ? Number(rawPercent) : null, families: rawFamilies ? Number(rawFamilies) : null};
}

/** Aplica os valores lidos em extra_fields (remove quando vazio). */
export function applyRefillToExtra(extra, values) {
    if (!values) return extra;
    if (values.last) extra.pipa_last_refill = values.last; else delete extra.pipa_last_refill;
    if (values.days) extra.pipa_refill_days = values.days; else delete extra.pipa_refill_days;
    if ('application' in values) {
        if (values.application) extra.pipa_application = values.application; else delete extra.pipa_application;
        if (values.application === 'parcial' && values.percent) extra.pipa_percent = values.percent; else delete extra.pipa_percent;
        if (values.families) extra.pipa_families = values.families; else delete extra.pipa_families;
    }
    return extra;
}

/** Selo exibido no card do lançamento. */
export function refillBadgeHtml(record, today = new Date()) {
    const status = recordRefillStatus(record, today);
    const supply = status.supply?.text ? `<span class="pipa-supply-tag">${esc(status.supply.text)}</span>` : '';
    if (status.state === 'sem-dados') return `<div class="pipa-refill-badge is-sem-dados" title="Abra o lançamento para informar o abastecimento">💧 Sem data de abastecimento${supply}</div>`;
    return `<div class="pipa-refill-badge is-${status.state}" title="${esc(status.label)}">💧 ${esc(status.text)}${supply}</div>`;
}

/** Ícone colorido para o mapa (Leaflet divIcon). */
export function refillMarkerHtml(state) {
    const s = REFILL_STATES[state] || REFILL_STATES['sem-dados'];
    return `<span class="pipa-pin is-${state}" style="--pin:${s.color}"><i>💧</i></span>`;
}

if (typeof window !== 'undefined') {
    window.pipaRefill = {isRefillGroup, recordRefillStatus, refillStatus, recordSupply, REFILL_STATES};
    window.previewPipaRefill = prefix => {
        const box = document.getElementById(`${prefix}-preview`);
        if (!box) return;
        const status = refillStatus(document.getElementById(`${prefix}-last`)?.value, document.getElementById(`${prefix}-days`)?.value);
        const application = document.querySelector(`input[name="${prefix}-apply"]:checked`)?.value || '';
        const percent = document.getElementById(`${prefix}-percent`)?.value;
        const families = Math.round(Number(document.getElementById(`${prefix}-families`)?.value));
        document.querySelectorAll(`#${prefix}-partial [data-pct]`).forEach(button => button.classList.toggle('is-on', Number(button.dataset.pct) === Number(percent)));
        box.className = `pipa-refill-preview is-${status.state}`;
        box.textContent = [status.text, applicationText(application, percent), families >= 1 ? plural(families, 'família', 'famílias') : ''].filter(Boolean).join(' · ');
    };
    window.pipaApplyChanged = prefix => {
        const partial = document.querySelector(`input[name="${prefix}-apply"]:checked`)?.value === 'parcial';
        const box = document.getElementById(`${prefix}-partial`);
        if (box) box.hidden = !partial;
        if (partial && !document.getElementById(`${prefix}-percent`)?.value) window.setPipaPercent(prefix, 50);
        else window.previewPipaRefill(prefix);
    };
    window.setPipaPercent = (prefix, value) => {
        const input = document.getElementById(`${prefix}-percent`);
        if (input) input.value = value;
        window.previewPipaRefill(prefix);
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
    let families = 0, pipas = 0, applied = 0;
    for (const record of records) {
        const status = recordRefillStatus(record, today);
        counts[status.state] += 1; if (hasLocation(record)) mapped += 1;
        families += status.supply.families || 0; pipas += status.supply.share; if (status.supply.application) applied += 1;
    }
    return {counts, mapped, total: records.length, families, pipas: Math.round(pipas * 100) / 100, applied};
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
        const {counts, mapped, total, families, pipas, applied} = pipaGroupSummary(records, record => Boolean(window.recordLocation?.(record)));
        const pipasText = pipas.toLocaleString('pt-BR', {maximumFractionDigits: 2});
        const arg = JSON.stringify(String(group.id)).replace(/"/g, '&quot;');
        const chip = (state, label) => `<button type="button" class="pipa-group-chip is-${state}" onclick="openGroupGeoMap(${arg},'${state}')" title="Ver no mapa: ${esc(label)}"><b>${counts[state]}</b><span>${esc(label)}</span></button>`;
        content.insertAdjacentHTML('afterbegin', `<section class="pipa-group-bar" aria-label="Controle de reabastecimento de água de pipa">
  <div class="pipa-group-title"><span aria-hidden="true">💧</span><div><strong>Controle de reabastecimento</strong><small>${total} lançamento${total === 1 ? '' : 's'} · ${mapped} com localização no mapa</small></div></div>
  <div class="pipa-group-impact" title="Somatório dos lançamentos que informaram aplicação e famílias"><span><b>${families.toLocaleString('pt-BR')}</b>${families === 1 ? 'família beneficiada' : 'famílias beneficiadas'}</span><span><b>${pipasText}</b>${pipas === 1 ? 'pipa aplicado' : 'pipas aplicados'}${applied ? ` em ${applied} ${applied === 1 ? 'local' : 'locais'}` : ''}</span></div>
  <div class="pipa-group-chips">${chip('vencido', 'Vencidos')}${chip('alerta', 'Vencem em até 5 dias')}${chip('em-dia', 'Em dia')}${chip('sem-dados', 'Sem data')}</div>
  <button type="button" class="pipa-group-map" onclick="openGroupGeoMap(${arg})">🗺️ Ver no mapa</button>
</section>`);
    };
}
