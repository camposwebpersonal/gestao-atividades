// Nomes dos campos/colunas POR GRUPO (regra do usuário, 23/11/2026: "flexibilidade total").
// • Campos fixos (Nome/descrição, Data da solicitação, Responsável, Prazo, Observação, Solicitante…):
//   o nome escolhido fica em extra_fields.field_labels do grupo e vale na planilha de lote, no formulário,
//   na tabela e no PDF. Apagar o nome = volta ao padrão.
// • Campos personalizados: renomear troca o nome do campo e a chave em todos os lançamentos do grupo de uma vez
//   (RPC pms_rename_field — sem mexer no autor nem disparar WhatsApp).
// • Colunas ocultas da planilha: extra_fields.bulk_hidden_columns { item: [...], subitem: [...] }.
export const BUILTIN_LABELS = {
  description: 'Nome / descrição', start_date: 'Data da solicitação', responsaveis: 'Responsável',
  solicitante: 'Solicitante', urgencia: 'Urgência', prioritario: 'Prioritário', deadline_date: 'Prazo',
  concluido: 'Concluído', conclusion_date: 'Data da conclusão', observacao: 'Observação',
};
export const groupExtra = group => { let e = group?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
export function customLabel(group, key) { const l = groupExtra(group).field_labels?.[key]; return typeof l === 'string' && l.trim() ? l.trim() : ''; }
export function fieldLabel(group, key, fallback) { return customLabel(group, key) || fallback || BUILTIN_LABELS[key] || key; }
export function hiddenColumns(group, scope = 'item') { const h = groupExtra(group).bulk_hidden_columns?.[scope]; return Array.isArray(h) ? h : []; }

if (typeof window !== 'undefined') {
  window.fieldLabel = fieldLabel;
  window.customFieldLabel = customLabel;
  const groupById = id => (window.S?.secs || []).find(s => s.id === id);
  const saveGroupExtra = async (group, patch) => {
    const extra = {...groupExtra(group), ...patch};
    await window.updateDoc(window.doc(window.db, 'secretariats', group.id), {extra_fields: extra});
    group.extra_fields = extra;
  };
  /** Renomeia a coluna/campo `key` (fixo ou 'ef:<nome>') do grupo. Retorna o nome final. */
  window.renameGroupField = async function (groupId, key, newName, {scope = 'item'} = {}) {
    const group = groupById(groupId); if (!group) throw new Error('Grupo não encontrado.');
    if (!(window.S?.isAdmin || window.userCanGroup?.(group, 'editar'))) throw new Error('Você não tem permissão para mudar os campos deste grupo.');
    const name = String(newName ?? '').replace(/\s+/g, ' ').trim().replace(/\s*\*$/, '');
    if (name.length > 80) throw new Error('O nome pode ter no máximo 80 letras.');
    if (key.startsWith('ef:')) {
      const old = key.slice(3);
      if (!name) throw new Error('O campo precisa de um nome.');
      if (name === old) return name;
      const {data, error} = await window.db.rpc('pms_rename_field', {p_group: groupId, p_old: old, p_new: name, p_scope: scope});
      if (error) throw new Error(window.friendlyDbError?.(error) || error.message);
      const patch = () => (window.S.fieldTemplates || []).forEach(t => { if (t.atividade_id === groupId && t.field_name === old && t.scope === scope) t.field_name = name; });
      patch(); await window.loadData?.(); patch(); // o cache local pode trazer o nome antigo até sincronizar
      return {name, result: data};
    }
    const labels = {...(groupExtra(group).field_labels || {})};
    if (!name || name === BUILTIN_LABELS[key]) delete labels[key]; else labels[key] = name;
    await saveGroupExtra(group, {field_labels: labels});
    return {name: name || BUILTIN_LABELS[key]};
  };
  window.setBulkColumnHidden = async function (groupId, key, hidden, scope = 'item') {
    const group = groupById(groupId); if (!group || key === 'description') return;
    const all = {...(groupExtra(group).bulk_hidden_columns || {})}, list = new Set(all[scope] || []);
    hidden ? list.add(key) : list.delete(key); all[scope] = [...list];
    await saveGroupExtra(group, {bulk_hidden_columns: all});
  };
  // Formulário do item/subitem: troca os rótulos dos campos fixos pelos nomes escolhidos no grupo.
  const MODAL_MAP = [['it-name', 'description', ' *'], ['it-obs', 'observacao', ''], ['it-resp', 'responsaveis', ''], ['it-start', 'start_date', ''], ['it-deadline', 'deadline_date', ''], ['at-solicitante', 'solicitante', ''], ['at-urgencia', 'urgencia', ''], ['at-prioritario', 'prioritario', '']];
  window.applyFieldLabelsToModal = function (group, root = document) {
    MODAL_MAP.forEach(([id, key, suffix]) => {
      const label = customLabel(group, key); if (!label) return;
      const input = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); if (!input) return;
      const lab = root.querySelector?.(`label[for="${id}"]`) || input.closest('.form-group')?.querySelector(':scope > label');
      if (!lab) return;
      const text = [...lab.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
      if (text) text.textContent = (text.textContent.startsWith(' ') ? ' ' : '') + label + suffix; else lab.textContent = label + suffix;
    });
  };
}
