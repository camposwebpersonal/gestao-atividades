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
  };
  const canEditGroup = group => Boolean(window.S?.isAdmin || window.userCanGroup?.(group, 'editar'));
  window.decorateFieldLabelEditors = function (group, scope = 'item', root = document) {
    if (!group || !canEditGroup(group)) return;
    const targets = MODAL_MAP.map(([id, key, suffix]) => [labelFor(root, id), key, suffix]).filter(([lab]) => lab);
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
