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
// Campos fixos que podem ser excluídos do grupo (Nome/descrição é obrigatório; Concluído/Data da conclusão vêm do
// Controle de Conclusão) e os que podem virar campo personalizado com outro tipo.
export const REMOVABLE_BUILTINS = ['start_date', 'responsaveis', 'solicitante', 'urgencia', 'prioritario', 'deadline_date', 'observacao'];
export const CONVERTIBLE_BUILTINS = ['start_date', 'deadline_date', 'responsaveis', 'observacao', 'solicitante'];
export function removedFields(group) { const r = groupExtra(group).removed_fields; return Array.isArray(r) ? r.filter(k => REMOVABLE_BUILTINS.includes(k)) : []; }
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
  window.removedFields = removedFields;
  const rpc = async (fn, args) => { const {data, error} = await window.db.rpc(fn, args); if (error) throw new Error(window.friendlyDbError?.(error) || error.message); return data || {}; };
  const guard = groupId => { const group = groupById(groupId); if (!group) throw new Error('Grupo não encontrado.'); if (!canEditGroup(group)) throw new Error('Você não tem permissão para mudar os campos deste grupo.'); return group; };
  // Recarrega e confere os modelos de campo do grupo direto no banco (o cache local pode estar atrasado).
  const syncTemplates = async groupId => {
    try {
      const {data, error} = await window.db.from('field_templates').select('*').eq('atividade_id', groupId);
      if (error || !Array.isArray(data) || !window.S) return;
      const list = window.S.fieldTemplates || (window.S.fieldTemplates = []);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].atividade_id === groupId) list.splice(i, 1);
      list.push(...data);
    } catch { /* sem rede: fica o que veio do loadData */ }
  };
  const reload = async groupId => { await window.loadData?.(); if (groupId) await syncTemplates(groupId); };
  /** Exclui um campo fixo do grupo (os valores continuam guardados; dá para restaurar). */
  window.setBuiltinRemoved = async function (groupId, key, removed) {
    const group = guard(groupId); if (!REMOVABLE_BUILTINS.includes(key)) throw new Error('Este campo não pode ser excluído.');
    const list = new Set(removedFields(group)); removed ? list.add(key) : list.delete(key);
    await saveGroupExtra(group, {removed_fields: [...list]});
  };
  /** Exclui um campo personalizado: some de todos os lançamentos do grupo, com cópia para desfazer. */
  window.deleteGroupField = async function (groupId, name, scope = 'item') {
    guard(groupId); const res = await rpc('pms_delete_field', {p_group: groupId, p_name: name, p_scope: scope});
    const drop = () => { const list = window.S.fieldTemplates || []; for (let i = list.length - 1; i >= 0; i--) if (list[i].atividade_id === groupId && list[i].scope === scope && list[i].field_name === name) list.splice(i, 1); };
    drop(); await reload(groupId); drop(); return res; // o cache local pode trazer o campo antigo até sincronizar
  };
  /** Troca o tipo de um campo personalizado, convertendo os valores já gravados (com cópia para desfazer). */
  window.changeGroupFieldType = async function (groupId, name, scope, type, options = []) {
    guard(groupId); const res = await rpc('pms_change_field_type', {p_group: groupId, p_name: name, p_scope: scope, p_type: type, p_options: options});
    const patch = () => (window.S.fieldTemplates || []).forEach(t => { if (t.atividade_id === groupId && t.scope === scope && t.field_name === name) { t.field_type = type; t.options = ['combobox', 'radio', 'checkboxes'].includes(type) ? options : []; } });
    patch(); await reload(groupId); patch(); return res;
  };
  /** Campo fixo → campo personalizado do tipo escolhido (copia os valores; o fixo sai do grupo). */
  window.convertBuiltinField = async function (groupId, key, name, type, options = [], scope = 'item') {
    const group = guard(groupId); const res = await rpc('pms_convert_builtin_field', {p_group: groupId, p_key: key, p_name: name, p_type: type, p_options: options, p_scope: scope});
    const mark = () => { const g = groupById(groupId) || group; if (!removedFields(g).includes(key)) g.extra_fields = {...groupExtra(g), removed_fields: [...removedFields(g), key]}; };
    mark(); await reload(groupId); mark(); return res;
  };
  window.restoreFieldHistory = async function (id, groupId) { const res = await rpc('pms_restore_field', {p_history: id}); await reload(groupId); return res; };
  window.fieldHistory = async function (groupId) {
    try { const {data, error} = await window.db.from('field_history').select('id,scope,field_name,action,new_type,template,created_by_name,created_at,restored_at').eq('group_id', groupId).is('restored_at', null).order('created_at', {ascending: false}).limit(30); return error ? [] : (data || []); } catch { return []; }
  };
  /** Valores diferentes já gravados num campo (para sugerir as opções ao virar lista). */
  window.fieldDistinctValues = function (groupId, name, scope = 'item') {
    const rows = scope === 'subitem' ? (window.S.subitems || []).filter(r => r.atividade_id === groupId) : (window.S.items || []).filter(r => r.atividade_id === groupId);
    const out = new Map();
    rows.forEach(r => { const v = window._efv ? window._efv(r, name) : (r.extra_fields || {})[name]; (Array.isArray(v) ? v : String(v ?? '').split(/\s*[,;]\s*/)).map(x => String(x).trim()).filter(Boolean).forEach(x => out.set(x.toLowerCase(), out.has(x.toLowerCase()) ? out.get(x.toLowerCase()) : x)); });
    return [...out.values()].slice(0, 40);
  };
  window.fieldFilledCount = function (groupId, key, scope = 'item') {
    const rows = scope === 'subitem' ? (window.S.subitems || []).filter(r => r.atividade_id === groupId) : (window.S.items || []).filter(r => r.atividade_id === groupId);
    const val = r => key.startsWith('ef:') ? (window._efv ? window._efv(r, key.slice(3)) : (r.extra_fields || {})[key.slice(3)]) : key === 'solicitante' ? (r.extra_fields || {}).solicitante ?? r.solicitante : r[key];
    return rows.filter(r => { const v = val(r); return Array.isArray(v) ? v.length : v != null && String(v).trim() !== ''; }).length;
  };
  // Tabela da tela do grupo: colunas fixas excluídas somem (4ª = Responsáveis, 5ª = Observação)
  window.removedFieldClasses = group => removedFields(group).filter(k => k === 'responsaveis' || k === 'observacao').map(k => ' rm-' + k).join('');
  // PDF: rótulos das colunas fixas excluídas (saem da tabela do PDF)
  window.removedFieldLabels = group => removedFields(group).flatMap(k => [fieldLabel(group, k), BUILTIN_LABELS[k], k === 'responsaveis' ? 'Responsáveis' : '', k === 'observacao' ? 'Observação' : '', k === 'deadline_date' ? 'Prazo' : ''].filter(Boolean));
  window.setBulkColumnHidden = async function (groupId, key, hidden, scope = 'item') {
    const group = groupById(groupId); if (!group || key === 'description') return;
    const all = {...(groupExtra(group).bulk_hidden_columns || {})}, list = new Set(all[scope] || []);
    hidden ? list.add(key) : list.delete(key); all[scope] = [...list];
    await saveGroupExtra(group, {bulk_hidden_columns: all});
  };
  // Formulário do item/subitem: troca os rótulos dos campos fixos pelos nomes escolhidos no grupo
  // e põe um ✏️ em cada rótulo (fixos e personalizados) para renomear ali mesmo.
  const MODAL_MAP = [['it-name', 'description', ' *'], ['it-obs', 'observacao', ''], ['it-resp', 'responsaveis', ''], ['it-start', 'start_date', ''], ['it-deadline', 'deadline_date', ''], ['at-solicitante', 'solicitante', ''], ['at-urgencia', 'urgencia', ''], ['at-prioritario', 'prioritario', '']];
  const labelFor = (root, id) => {
    const input = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); if (!input) return null;
    return input.closest('label') || root.querySelector?.(`label[for="${id}"]`) || input.closest('.form-group')?.querySelector(':scope > label');
  };
  const textNode = lab => [...lab.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
  const setLabelText = (lab, text) => { const t = textNode(lab); if (t) t.textContent = (t.textContent.startsWith(' ') ? ' ' : '') + text + (t.textContent.endsWith(' ') ? ' ' : ''); else lab.prepend(document.createTextNode(text)); };
  window.applyFieldLabelsToModal = function (group, root = document) {
    MODAL_MAP.forEach(([id, key, suffix]) => { const label = customLabel(group, key), lab = label && labelFor(root, id); if (lab) setLabelText(lab, label + suffix); });
    // campos fixos excluídos do grupo somem do formulário (o valor gravado continua guardado)
    const gone = new Set(removedFields(group));
    MODAL_MAP.forEach(([id, key]) => {
      if (!gone.has(key)) return;
      const input = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); if (!input) return;
      const box = key === 'prioritario' ? input.closest('label') : input.closest('.form-group') || input.closest('label');
      if (box) { box.hidden = true; box.classList.add('fl-removed'); }
    });
    const fs = root.querySelector?.('#at-urgencia')?.closest('fieldset');
    if (fs && ['urgencia', 'prioritario', 'solicitante'].every(k => gone.has(k))) fs.hidden = true;
  };
  const canEditGroup = group => Boolean(window.S?.isAdmin || window.userCanGroup?.(group, 'editar'));
  window.decorateFieldLabelEditors = function (group, scope = 'item', root = document) {
    if (!group || !canEditGroup(group)) return;
    const gone = new Set(removedFields(group));
    const targets = MODAL_MAP.filter(([, key]) => !gone.has(key)).map(([id, key, suffix]) => [labelFor(root, id), key, suffix]).filter(([lab]) => lab);
    root.querySelectorAll('label[data-ef-field]').forEach(lab => targets.push([lab, 'ef:' + lab.dataset.efField, '']));
    targets.forEach(([lab, key, suffix]) => {
      if (lab.querySelector('.fl-pencil')) return;
      lab.classList.add('fl-labeled');
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fl-pencil'; btn.textContent = '✏️';
      btn.title = 'Renomear este campo neste grupo'; btn.setAttribute('aria-label', 'Renomear o campo ' + (textNode(lab)?.textContent.trim() || ''));
      btn.dataset.flKey = key;
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); startEdit(group, scope, lab, btn, suffix); });
      lab.appendChild(btn);
    });
  };
  function startEdit(group, scope, lab, btn, suffix) {
    if (lab.querySelector('.fl-edit')) return;
    const node = textNode(lab), current = (node?.textContent || '').trim().replace(/\s*\*$/, '');
    let key = btn.dataset.flKey;
    const input = document.createElement('input'); input.className = 'fl-edit'; input.maxLength = 80; input.value = current;
    input.placeholder = key.startsWith('ef:') ? 'Nome do campo' : (BUILTIN_LABELS[key] || '') + ' (padrão)';
    input.setAttribute('aria-label', 'Novo nome do campo');
    const hint = document.createElement('small'); hint.className = 'fl-hint'; hint.textContent = 'Enter salva · Esc cancela · vale para todo o grupo';
    if (node) node.textContent = ''; btn.hidden = true; [...lab.children].forEach(c => { if (c !== btn) c.dataset.flWasHidden = c.hidden ? '1' : ''; });
    lab.prepend(input); input.after(hint); input.focus(); input.select();
    let done = false;
    const restore = text => { input.remove(); hint.remove(); btn.hidden = false; if (node) node.textContent = text; };
    const finish = async save => {
      if (done) return; done = true;
      const value = input.value.replace(/\s+/g, ' ').trim();
      if (!save || value === current) { restore(current + suffix); return; }
      if (key.startsWith('ef:') && !value) { restore(current + suffix); window.toast?.('O campo precisa de um nome.', 'error'); return; }
      input.disabled = true; hint.textContent = 'Salvando…';
      try {
        const res = await window.renameGroupField(group.id, key, value, {scope});
        const finalName = res?.name || value || BUILTIN_LABELS[key] || current;
        restore(finalName + suffix);
        if (key.startsWith('ef:')) {
          // o formulário aberto passa a gravar no nome novo
          const box = lab.closest('.form-group');
          box?.querySelectorAll('[data-ef-key]').forEach(el => { if (el.dataset.efKey === key.slice(3)) el.dataset.efKey = finalName; });
          box?.querySelectorAll('[data-ef-choice-key]').forEach(el => { if (el.dataset.efChoiceKey === key.slice(3)) el.dataset.efChoiceKey = finalName; });
          lab.dataset.efField = finalName; btn.dataset.flKey = 'ef:' + finalName;
          const n = (res?.result?.items || 0) + (res?.result?.subitems || 0);
          window.toast?.(`Campo “${current}” agora se chama “${finalName}”${n ? ` — atualizado em ${n} lançamento(s)` : ''}.`, 'success', 4500);
        } else window.toast?.(`“${current}” agora se chama “${finalName}” neste grupo (formulário, planilha, tabela e PDF).`, 'success', 4200);
      } catch (error) { restore(current + suffix); window.toast?.(error.message || String(error), 'error', 7000); }
    };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('blur', () => finish(true));
  }
}
