// Campos visíveis de um lançamento.
// O banco guarda no mesmo JSON (extra_fields) os campos personalizados digitados pelo usuário
// e dados internos do sistema (marcações de verba/documentação/licitação, localização, importação,
// histórico…). Tudo que é mostrado ao usuário — cards, listas e PDFs — passa por aqui, para que
// só apareçam informações reais e preenchidas, com rótulo legível e na ordem do cadastro.

const SYSTEM_KEYS = new Set([
  'id', 'extra_fields', 'created_at', 'updated_at', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
  'audit_created_at', 'audit_updated_at', 'sync_at', 'old_id', 'parent_id', 'parent_type', 'is_placeholder',
  'show_conclusion_date', 'show_external_geolocation', 'geo_location', 'latitude', 'longitude', 'accuracy', 'captured_at',
  'verba', 'verba_obs', 'verbas_list', 'origem_verba', 'documentacao', 'documentacao_obs', 'licitacao', 'licitacao_obs',
  'urgencia', 'prioritario', 'solicitante', 'registro_tipo', 'modulo', 'controle_pocos', 'transfer_history',
  'status_list', 'status_options', 'table_columns', 'exibir_valores', 'imagens', 'contatos_responsavel', 'poco_order',
  'licitacao_group_id', 'fornecedor_numero',
]);
const SYSTEM_PREFIXES = ['item_show_', 'import_', 'pipa_', 'geo_', '_'];

export function recordExtraOf(record) {
  try {
    const raw = record?.extra_fields;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function isSystemKey(key) {
  const k = String(key || '');
  return SYSTEM_KEYS.has(k) || SYSTEM_PREFIXES.some(p => k.startsWith(p));
}

/** Valor vazio para exibição: nada digitado, falso, zero de marcação ou objeto interno. */
export function isBlankValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'object') return true;
  const s = String(value).trim();
  return s === '' || s === '-' || s === '—';
}

/** "nome do órgão" → "Nome do órgão"; rótulos já escritos pelo usuário (VEÍCULO, Placa) ficam como estão. */
export function fieldLabel(key) {
  const k = String(key).replace(/_/g, ' ').trim();
  return k === k.toLowerCase() ? k.charAt(0).toLocaleUpperCase('pt-BR') + k.slice(1) : k;
}

function formatValue(value, type) {
  if (value === true) return 'Sim';
  const s = String(value).trim();
  if (type === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  if (type === 'number' && s !== '' && Number.isFinite(Number(s))) return Number(s).toLocaleString('pt-BR');
  return s;
}

/**
 * Campos personalizados preenchidos de um lançamento, na ordem dos modelos do grupo.
 * @param record item ou subitem
 * @param templates field_templates do grupo (opcional) — define ordem e tipo
 * @param scope 'item' | 'subitem' (opcional)
 * @returns [{key, label, value}]
 */
export function customFields(record, templates = [], scope = null) {
  const extra = recordExtraOf(record);
  const tpl = (templates || []).filter(t => !scope || t.scope === scope);
  const order = new Map(tpl.map((t, i) => [t.field_name, [Number(t.order_num ?? i), t.field_type]]));
  const out = [];
  const seen = new Set();
  for (const [key, value] of Object.entries(extra)) {
    if (isSystemKey(key) || isBlankValue(value)) continue;
    if (key === 'origem' && /^[a-z]+(_[a-z]+)+$/.test(String(value))) continue; // marca técnica (ex.: captura_rapida)
    const norm = key.trim().toLocaleLowerCase('pt-BR');
    if (seen.has(norm)) continue; // mesmo campo gravado com maiúsculas diferentes
    seen.add(norm);
    out.push({key, label: fieldLabel(key), value: formatValue(value, order.get(key)?.[1]), _o: order.has(key) ? order.get(key)[0] : 1e6 + out.length});
  }
  return out.sort((a, b) => a._o - b._o).map(({key, label, value}) => ({key, label, value}));
}

/** Verba, documentação e licitação só aparecem quando o grupo ou o próprio lançamento os habilita. */
export function controlFields(record, group, isSub = false) {
  const on = f => !!(group?.['show_' + f] && (!isSub || group?.[f + '_on_subitems'])) || Number(record?.['item_show_' + f]) === 1;
  const out = [];
  if (on('verba') && record?.verba != null && record.verba !== '' && Number(record.verba) > 0) {
    out.push({key: 'verba', label: 'Verba', value: Number(record.verba).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) + (record.verba_obs ? ' · ' + record.verba_obs : '')});
  }
  if ((on('origem_verba') || on('verba')) && record?.origem_verba) out.push({key: 'origem_verba', label: 'Origem da verba', value: String(record.origem_verba)});
  if (on('documentacao') && record?.documentacao != null && record.documentacao !== '') out.push({key: 'documentacao', label: 'Documentação', value: Number(record.documentacao) === 1 ? 'Concluída' : 'Pendente', ok: Number(record.documentacao) === 1});
  if (on('licitacao') && record?.licitacao != null && record.licitacao !== '') out.push({key: 'licitacao', label: 'Licitação', value: Number(record.licitacao) === 1 ? 'Concluída' : 'Pendente', ok: Number(record.licitacao) === 1});
  return out;
}

/** Data de conclusão só quando o lançamento está concluído e a exibição foi pedida. */
export function conclusionShown(record) {
  return Number(record?.show_conclusion_date) === 1 && !!record?.conclusion_date;
}

/**
 * Valores iguais em todos os lançamentos (ex.: a mesma Secretaria em 300 linhas) — usados no
 * cabeçalho do relatório em vez de repetidos linha a linha.
 */
export function commonValues(rows, minRows = 3) {
  if (rows.length < minRows) return [];
  const first = new Map(rows[0].fields.map(f => [f.label, f.value]));
  return [...first].filter(([label, value]) => rows.every(r => r.fields.some(f => f.label === label && f.value === value))).map(([label, value]) => ({label, value}));
}

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** Etiquetas (chips) dos campos preenchidos para cards e listas. */
export function recordChipsHtml(record, group, {isSub = false, templates = [], small = false} = {}) {
  const scope = isSub ? 'subitem' : 'item';
  const tpl = (templates || []).filter(t => t.atividade_id === group?.id);
  const chips = customFields(record, tpl, null).map(f => `<span class="rf-chip"><b>${escHtml(f.label)}:</b> ${escHtml(f.value)}</span>`);
  for (const f of controlFields(record, group, isSub)) {
    const icon = {verba: '💰', origem_verba: '📍', documentacao: '📁', licitacao: '⚖️'}[f.key];
    chips.push(`<span class="rf-chip ${f.ok === true ? 'is-ok' : f.ok === false ? 'is-pending' : 'is-money'}">${icon} <b>${escHtml(f.label)}:</b> ${escHtml(f.value)}</span>`);
  }
  if (!chips.length) return '';
  return `<div class="rf-chips${small ? ' is-small' : ''}" data-scope="${scope}">${chips.join('')}</div>`;
}
if (typeof window !== 'undefined') { window.recordChipsHtml = recordChipsHtml; window.recordCustomFields = customFields; }
