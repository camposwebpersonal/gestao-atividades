// Monta os lançamentos do "Relatório de demandas" no formato compacto do motor de PDF.
import {URGENCIAS, attendanceValue, recordExtra} from './atendimento-meta.js';
import {customFields, controlFields} from './record-fields.js?v=1';

export const STATUS_LABELS = {pendente: 'Pendente', solicitado: 'Solicitado', recebido: 'Recebido', analisando: 'Analisando', aprovado: 'Aprovado', ressalva: 'Ressalva', reprovado: 'Reprovado', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado'};
const URGENCY_TONE = {vermelho: 'urgent', amarelo: 'attention', verde: 'calm'};
const URGENCY_SHORT = {vermelho: 'Urgente', amarelo: 'Necessita de atenção', verde: 'Pode aguardar'};

export function reportDateTime(value) {
  if (!value) return '';
  const raw = typeof value?.toDate === 'function' ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(raw.getTime())) return '';
  return raw.toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
}

export function fmtDay(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '';
}

/** Mantido para quem ainda usa: campos personalizados preenchidos, sem dados internos. */
export function meaningfulExtraFields(record) {
  return customFields(record).map(f => ({label: f.label, value: f.value}));
}

function statusOf(record) {
  if (Number(record.concluded) === 1) return 'Concluído';
  return STATUS_LABELS[record.status] || (record.status ? String(record.status).charAt(0).toUpperCase() + String(record.status).slice(1) : 'Pendente');
}

/**
 * Converte um item/subitem em registro do PDF.
 * opts: {group, templates, secretarias, showCreated, showUpdated, today}
 */
export function demandRecord(record, number, level, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const urgency = attendanceValue(record, 'urgencia', null);
  const done = Number(record.concluded) === 1;
  const badges = [];
  if (URGENCIAS[urgency]) badges.push({text: URGENCY_SHORT[urgency] || URGENCIAS[urgency], tone: URGENCY_TONE[urgency] || 'muted'});
  if (attendanceValue(record, 'prioritario', false)) badges.push({text: 'Prioritário', tone: 'star'});
  if (done) badges.push({text: record.conclusion_date ? 'Concluído em ' + fmtDay(record.conclusion_date) : 'Concluído', tone: 'done'});
  else {
    badges.push({text: statusOf(record), tone: 'pending'});
    const deadline = String(record.deadline_date || '').slice(0, 10);
    if (deadline) badges.push(deadline < today ? {text: 'Atrasado · prazo ' + fmtDay(deadline), tone: 'late'} : {text: 'Prazo ' + fmtDay(deadline), tone: 'info'});
  }
  const fields = [];
  if (record.responsaveis) fields.push({label: 'Responsável', value: record.responsaveis});
  const requester = attendanceValue(record, 'solicitante', '');
  if (requester) fields.push({label: 'Solicitante', value: requester});
  const groupSecretary = opts.group?.demanda_secretaria_id;
  if (record.secretaria_id && record.secretaria_id !== groupSecretary) {
    const name = (opts.secretarias || []).find(s => s.id === record.secretaria_id)?.name;
    if (name) fields.push({label: 'Secretaria', value: name});
  }
  const tpl = (opts.templates || []).filter(t => t.atividade_id === opts.group?.id);
  fields.push(...customFields(record, tpl), ...controlFields(record, opts.group, level > 0).map(f => ({label: f.label, value: f.value})));
  if (!done && Number(record.show_conclusion_date) === 1 && record.conclusion_date) fields.push({label: 'Data de conclusão', value: fmtDay(record.conclusion_date)});
  const meta = [];
  if (opts.showCreated) meta.push('Criado por ' + (record.created_by_name || 'não registrado') + (record.created_at ? ' em ' + reportDateTime(record.created_at) : ''));
  if (opts.showUpdated && record.updated_by_name) meta.push('Última edição por ' + record.updated_by_name + (record.updated_at ? ' em ' + reportDateTime(record.updated_at) : ''));
  return {
    num: number, level, title: record.description || 'Sem descrição', badges, fields,
    note: record.observacao || '', meta: meta.join('  ·  '),
    priority: !!attendanceValue(record, 'prioritario', false), urgency, done,
    late: !done && !!record.deadline_date && String(record.deadline_date).slice(0, 10) < today,
  };
}

/** Lista na ordem da tela: item, seus subitens (em árvore), próximo item… */
export function buildDemandRecords(items, subitems, opts = {}) {
  const rows = [];
  const ordered = [...items].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const children = (itemId, parentId, parentType) => subitems
    .filter(s => s.item_id === itemId && s.parent_id === parentId && (parentType === 'item' ? s.parent_type !== 'subitem' : s.parent_type === 'subitem'))
    .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const walk = (itemId, parentId, parentType, prefix, level) => children(itemId, parentId, parentType).forEach((child, i) => {
    const number = prefix + '.' + (i + 1);
    if (opts.includeSubitems !== false && (opts.includeDone !== false || Number(child.concluded) !== 1)) rows.push(demandRecord(child, number, level, opts));
    walk(itemId, child.id, 'subitem', number, level + 1);
  });
  ordered.forEach((item, index) => {
    if (opts.includeDone === false && Number(item.concluded) === 1) return;
    const number = String(index + 1);
    rows.push(demandRecord(item, number, 0, opts));
    walk(item.id, item.id, 'item', number, 1);
  });
  return rows;
}

// Compatibilidade com chamadas antigas.
export function buildDemandReportRows(items, subitems, secretarias = []) {
  return buildDemandRecords(items, subitems, {secretarias}).map(r => ({...r, isSubitem: r.level > 0, extra: r.fields}));
}
export {recordExtra};
