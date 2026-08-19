/* ── CONTROLE DE DISTRIBUIÇÃO ──
   Renderizador genérico para atividades do tipo "distribuição".
   Cada beneficiário/paciente é um item da atividade, com campos extras.
   Uso: marque a atividade com controle_distribuicao=true.
   v2026-07-09-09-45 */

const DIST_CAMPOS = [
  { key: 'CPF do Paciente', label: 'CPF do Paciente', required: false, type: 'cpf' },
  { key: 'Nome do Responsável', label: 'Nome do Responsável', required: false, type: 'responsavel' },
  { key: 'CPF do Responsável', label: 'CPF do Responsável', required: false, type: 'cpf' },
  { key: 'Fórmula', label: 'Fórmula', required: false, type: 'text' },
  { key: 'Número do Processo', label: 'Número do Processo', required: false, type: 'text' },
  { key: 'Quantidade Distribuído Mensal', label: 'Quantidade Distribuído Mensal', required: false, type: 'number' },
  { key: 'Telefone', label: 'Telefone', required: false, type: 'tel' },
  { key: 'Data de Nascimento do Paciente', label: 'Data de Nascimento do Paciente', required: true, type: 'date' }
];

const _distEsc = PMS.esc;
const _distFmtCPF = PMS.fmtCPF;
const _distFmtTel = PMS.fmtTel;

function _distCalcIdade(nascimento){
  if (!nascimento) return '';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const nasc = new Date(nascimento + 'T00:00:00');
  if (isNaN(nasc.getTime())) return '';
  let anos = hoje.getFullYear() - nasc.getFullYear();
  let meses = hoje.getMonth() - nasc.getMonth();
  let dias = hoje.getDate() - nasc.getDate();
  if (dias < 0) {
    meses--;
    dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
  }
  if (meses < 0) { anos--; meses += 12; }
  if (anos > 0) return meses > 0 ? `${anos}a ${meses}m` : `${anos}a`;
  if (meses > 0) return dias > 0 ? `${meses}m ${dias}d` : `${meses}m`;
  return `${dias}d`;
}

function _distGetExtra(it, chave){
  return (it && it.extra_fields && it.extra_fields[chave]) || '';
}

const _distNorm = PMS.normUpper;
function _distMatchesBusca(it, buscaNorm){
  if(!buscaNorm) return true;
  const ef = it.extra_fields || {};
  const text = _distNorm([
    it.description || '',
    ef['CPF do Paciente'] || '',
    ef['Nome do Responsável'] || '',
    ef['CPF do Responsável'] || '',
    ef['Fórmula'] || '',
    ef['Número do Processo'] || '',
    ef['Telefone'] || ''
  ].join(' '));
  return text.includes(buscaNorm);
}
function _distStats(itens){
  const total = itens.length;
  let criancas = 0, adultos = 0, idosos = 0, qtdTotal = 0;
  itens.forEach(it => {
    const nasc = _distGetExtra(it, 'Data de Nascimento do Paciente');
    const idadeAnos = nasc ? (parseInt(_distCalcIdade(nasc), 10) || 0) : null;
    if (idadeAnos === null) adultos++;
    else if (idadeAnos < 1) criancas++;
    else if (idadeAnos >= 60) idosos++;
    else adultos++;
    qtdTotal += parseFloat(_distGetExtra(it, 'Quantidade Distribuído Mensal')) || 0;
  });
  return { total, criancas, adultos, idosos, qtdTotal };
}

window.renderControleDistribuicao = function(secId){
  const sec = S.secs.find(s => s.id === secId); if (!sec) return;
  curSecId = secId;
  const busca = _distNorm(document.getElementById('dist-busca')?.value || '');
  const itens = [...S.items.filter(i => i.atividade_id === secId)].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const filtrados = itens.filter(it => _distMatchesBusca(it, busca));

  const stats = _distStats(itens);
  const statsHtml = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <div class="stat-card"><div class="stat-val" style="color:#60a5fa">${stats.total}</div><div class="stat-lbl">Total</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#f59e0b">${stats.criancas}</div><div class="stat-lbl">&lt; 1 ano</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#10b981">${stats.adultos}</div><div class="stat-lbl">1 a 59 anos</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#a78bfa">${stats.idosos}</div><div class="stat-lbl">≥ 60 anos</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#ec4899">${stats.qtdTotal.toLocaleString('pt-BR')}</div><div class="stat-lbl">Qtd. Mensal Total</div></div>
  </div>`;

  const rows = filtrados.map((it, idx) => {
    const ef = it.extra_fields || {};
    const idade = _distCalcIdade(ef['Data de Nascimento do Paciente'] || '');
    const nasc = PMS.fmtD(ef['Data de Nascimento do Paciente']);
    return `<tr style="background:${idx % 2 === 0 ? '#0a1222' : '#060c18'}">
      <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#e2e8f0">${_distEsc(it.description)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#94a3b8;white-space:nowrap">${_distEsc(ef['CPF do Paciente'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#e2e8f0">${_distEsc(ef['Nome do Responsável'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#94a3b8;white-space:nowrap">${_distEsc(ef['CPF do Responsável'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#e2e8f0">${_distEsc(ef['Fórmula'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#e2e8f0;white-space:nowrap">${_distEsc(ef['Número do Processo'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#e2e8f0;text-align:center;font-weight:700">${_distEsc(ef['Quantidade Distribuído Mensal'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#e2e8f0;white-space:nowrap">${_distEsc(ef['Telefone'] || '—')}</td>
      <td style="padding:8px 10px;font-size:12px;color:#94a3b8;white-space:nowrap">${nasc}</td>
      <td style="padding:8px 10px;font-size:12px;color:#38bdf8;font-weight:700;white-space:nowrap">${idade || '—'}</td>
      <td style="padding:8px 10px;white-space:nowrap">
        ${S.isAdmin ? `<button class="card-btn" onclick="distOpenModal('${it.id}', '${secId}')" title="Editar">✏️</button>
        <button class="card-btn" style="font-size:10px;background:#1e3a5f;color:#60a5fa" onclick="distDuplicar('${it.id}', '${secId}')" title="Duplicar">📋</button>
        <button class="card-btn" style="font-size:10px;background:#7f1d1d;color:#fca5a5" onclick="distDelete('${it.id}', '${secId}')" title="Excluir">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  const mobileCards = filtrados.map(it => {
    const ef = it.extra_fields || {};
    const idade = _distCalcIdade(ef['Data de Nascimento do Paciente'] || '');
    const nasc = PMS.fmtD(ef['Data de Nascimento do Paciente']);
    return `<div class="cc-mobile-card" style="margin-bottom:8px">
      <div class="cc-mobile-title">${_distEsc(it.description)} ${idade ? `<span style="color:#38bdf8;font-size:11px">(${idade})</span>` : ''}</div>
      <div class="cc-mobile-row"><span>CPF</span><span>${_distEsc(ef['CPF do Paciente'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Responsável</span><span>${_distEsc(ef['Nome do Responsável'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>CPF Resp.</span><span>${_distEsc(ef['CPF do Responsável'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Fórmula</span><span>${_distEsc(ef['Fórmula'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Processo</span><span>${_distEsc(ef['Número do Processo'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Qtd. Mensal</span><span>${_distEsc(ef['Quantidade Distribuído Mensal'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Telefone</span><span>${_distEsc(ef['Telefone'] || '—')}</span></div>
      <div class="cc-mobile-row"><span>Nascimento</span><span>${nasc}</span></div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${S.isAdmin ? `<button class="card-btn" onclick="distOpenModal('${it.id}', '${secId}')">✏️ Editar</button>
        <button class="card-btn" style="background:#1e3a5f;color:#60a5fa" onclick="distDuplicar('${it.id}', '${secId}')">📋 Duplicar</button>
        <button class="card-btn" style="background:#7f1d1d;color:#fca5a5" onclick="distDelete('${it.id}', '${secId}')">🗑️ Excluir</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const headerHtml = `<div style="margin-bottom:14px">
    <div class="page-title">🎁 ${_distEsc(sec.name)}</div>
    <div class="page-sub">${_distEsc(sec.observacoes || 'Controle de distribuição de beneficiários/pacientes')}</div>
  </div>
  <div class="top-actions-fixed" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="btn-action" onclick="window.renderModulo(window.modForSec(S.secs.find(s=>s.id==='${secId}')))">← Voltar</button>
      <div style="flex:1;min-width:20px"></div>
      ${S.isAdmin ? `<button class="btn-action primary" onclick="distOpenModal(null, '${secId}')">+ Beneficiário</button>` : ''}
      ${S.isAdmin ? `<button class="btn-action" onclick="openSecModal('${secId}')">✏️ Editar</button>` : ''}
      <button class="btn-action" onclick="distExportarPDF('${secId}')">📄 PDF${busca ? ' (filtrado)' : ''}</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" id="dist-busca" placeholder="🔍 Buscar por nome, CPF, responsável, fórmula, processo ou telefone..." value="${busca ? _distEsc(busca) : ''}" oninput="distBusca('${secId}')" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:#0f172a;color:var(--text);font-size:13px">
      <button class="btn-action" style="font-size:12px;padding:6px 12px" onclick="document.getElementById('dist-busca').value='';distBusca('${secId}')">Limpar</button>
    </div>
  </div>`;

  const searchHtml = '';

  const tableHtml = `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px;background:#0a1222;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#0e1729">
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Paciente *</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">CPF</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Responsável</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">CPF Resp.</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Fórmula</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Processo</th>
        <th style="padding:8px 10px;text-align:center;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Qtd./Mês</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Telefone</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Nascimento</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap">Idade</th>
        <th style="padding:8px 10px;text-align:left;color:#94a3b8;font-size:11px;font-weight:700;border-bottom:1px solid #1e3a5f;white-space:nowrap"></th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted)">Nenhum beneficiário cadastrado.</td></tr>`}</tbody>
    </table>
  </div>`;

  const footerHtml = `<div style="padding:8px 12px;font-size:12px;font-weight:700;color:#60a5fa;border-top:2px solid #1e3a5f;margin-top:6px;text-align:right;background:#060c18;border-radius:0 0 8px 8px">Σ Total: ${filtrados.length} beneficiário(s)${filtrados.length !== itens.length ? ` (filtrados de ${itens.length})` : ''}</div>`;
  const mobileHtml = mobileCards || '<div class="cc-mobile-card"><div class="empty" style="padding:10px">Nenhum beneficiário cadastrado.</div></div>';

  setC(`${headerHtml}${statsHtml}${searchHtml}<div class="cc-table-wrap">${tableHtml}</div>${mobileHtml}${footerHtml}`);
};

window.distBusca = function(secId){
  renderControleDistribuicao(secId);
};

window.distOpenModal = function(id, secId){
  const it = id ? S.items.find(i => i.id === id) : null;
  const ef = it ? (it.extra_fields || {}) : {};
  const camposHtml = DIST_CAMPOS.map(c => {
    const val = ef[c.key] || '';
    let input = '';
    if (c.type === 'responsavel') {
      const currentName = String(val).trim();
      const currentCPF = String(ef['CPF do Responsável'] || '').trim().replace(/\D/g, '');
      let selectedId = '';
      const matched = S.responsaveis.find(r => String(r.name || '').trim() === currentName && (currentCPF ? String(r.cpf || '').trim() === currentCPF : true));
      if (matched) selectedId = matched.id;
      let options = '<option value="">-- Selecionar --</option>';
      S.responsaveis.forEach(r => {
        const sel = r.id === selectedId ? ' selected' : '';
        const cpf = r.cpf ? ` (${_distFmtCPF(r.cpf)})` : '';
        options += `<option value="${_distEsc(r.id)}" data-name="${_distEsc(r.name || '')}" data-cpf="${_distEsc(r.cpf || '')}"${sel}>${_distEsc(r.name)}${cpf}</option>`;
      });
      if (currentName && !matched) {
        options += `<option value="legacy" data-name="${_distEsc(currentName)}" data-cpf="${_distEsc(currentCPF)}" selected>${_distEsc(currentName)}${currentCPF ? ` (${_distFmtCPF(currentCPF)})` : ''}</option>`;
      }
      input = `<select id="dist-${c.key.replace(/\s+/g, '-')}" onchange="distSelectResponsavel(this)" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:#0f172a;color:var(--text);font-size:13px">${options}</select>`;
    } else if (c.type === 'cpf') {
      input = `<input type="text" id="dist-${c.key.replace(/\s+/g, '-')}" value="${_distEsc(val)}" oninput="distFormatCPF(this)" placeholder="000.000.000-00" maxlength="14">`;
    } else if (c.type === 'tel') {
      input = `<input type="text" id="dist-${c.key.replace(/\s+/g, '-')}" value="${_distEsc(val)}" oninput="distFormatTel(this)" placeholder="(00) 00000-0000" maxlength="15">`;
    } else if (c.type === 'date') {
      input = `<input type="date" id="dist-${c.key.replace(/\s+/g, '-')}" value="${_distEsc(val)}" onchange="distAtualizaIdade()">`;
    } else if (c.type === 'number') {
      input = `<input type="number" step="any" id="dist-${c.key.replace(/\s+/g, '-')}" value="${_distEsc(val)}" placeholder="Quantidade">`;
    } else {
      input = `<input type="text" id="dist-${c.key.replace(/\s+/g, '-')}" value="${_distEsc(val)}" placeholder="${c.label}">`;
    }
    return `<div class="form-group full">
      <label>${c.label}${c.required ? ' *' : ''}</label>
      ${input}
    </div>`;
  }).join('');

  const idadeHtml = `<div class="form-group full">
    <label>Idade do Paciente</label>
    <div id="dist-idade-display" style="padding:8px 12px;background:#0e1729;border:1px solid var(--border);border-radius:8px;color:#38bdf8;font-weight:700;min-height:20px"></div>
  </div>`;

  openModal(id ? '✏️ Editar Beneficiário' : '➕ Novo Beneficiário', '',
    `<div class="form-grid">
      <div class="form-group full"><label>Nome do Paciente *</label><input id="dist-nome" value="${_distEsc(it?.description || '')}" placeholder="Nome completo do paciente"></div>
      ${camposHtml}
      ${idadeHtml}
    </div>
    <div class="modal-actions">
      ${id ? `<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="distDelete('${id}', '${secId}')">🗑️ Excluir</button>` : ''}
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" onclick="distSave('${id || ''}', '${secId}')">💾 Salvar</button>
    </div>`);
  setTimeout(() => distAtualizaIdade(), 0);
};

window.distSave = async function(id, secId){
  const nome = document.getElementById('dist-nome')?.value.trim();
  if (!nome) { toast('Nome do Paciente é obrigatório', 'error'); return; }
  const nasc = document.getElementById('dist-Data-de-Nascimento-do-Paciente')?.value || '';
  if (!nasc) { toast('Data de Nascimento do Paciente é obrigatória', 'error'); return; }

  const ef = {};
  let respCPF = '';
  DIST_CAMPOS.forEach(c => {
    const el = document.getElementById('dist-' + c.key.replace(/\s+/g, '-'));
    if (!el) return;
    if (c.type === 'responsavel') {
      const opt = el.options[el.selectedIndex];
      ef[c.key] = opt?.dataset?.name || '';
      respCPF = opt?.dataset?.cpf || '';
    } else {
      ef[c.key] = el.value.trim();
    }
  });
  if (respCPF) ef['CPF do Responsável'] = _distFmtCPF(respCPF);

  const data = {
    description: nome,
    atividade_id: secId,
    observacao: '',
    responsaveis: '',
    secretaria_id: null,
    start_date: null,
    deadline_date: null,
    item_icon: '👤',
    item_color: '#8B5CF6',
    concluded: 0,
    extra_fields: ef,
    updated_at: serverTimestamp()
  };

  if (id) {
    const antigo = S.items.find(i => i.id === id);
    data.order_num = antigo?.order_num ?? 0;
    await updateDoc(doc(db, 'items', id), data);
  } else {
    data.order_num = S.items.filter(i => i.atividade_id === secId).length;
    data.created_at = serverTimestamp();
    await addDoc(collection(db, 'items'), data);
  }
  await loadData();
  closeModal();
  toast('Salvo!');
  renderControleDistribuicao(secId);
};

window.distDelete = async function(id, secId){
  if (!confirm('Excluir este beneficiário?')) return;
  await deleteDoc(doc(db, 'items', id));
  await loadData();
  closeModal();
  toast('Excluído!');
  renderControleDistribuicao(secId);
};

window.distDuplicar = async function(id, secId){
  const it = S.items.find(i => i.id === id); if (!it) return;
  const ef = { ...(it.extra_fields || {}) };
  const data = {
    description: (it.description || '') + ' (cópia)',
    atividade_id: secId,
    observacao: it.observacao || '',
    responsaveis: it.responsaveis || '',
    secretaria_id: it.secretaria_id || null,
    start_date: it.start_date || null,
    deadline_date: it.deadline_date || null,
    item_icon: it.item_icon || '👤',
    item_color: it.item_color || '#8B5CF6',
    concluded: 0,
    extra_fields: ef,
    order_num: S.items.filter(i => i.atividade_id === secId).length,
    created_at: serverTimestamp()
  };
  await addDoc(collection(db, 'items'), data);
  await loadData();
  toast('Duplicado!');
  renderControleDistribuicao(secId);
};

window.distFormatCPF = function(el){
  el.value = _distFmtCPF(el.value);
};

window.distFormatTel = function(el){
  el.value = _distFmtTel(el.value);
};

window.distSelectResponsavel = function(sel){
  const opt = sel.options[sel.selectedIndex];
  const name = opt?.dataset?.name || '';
  const cpf = opt?.dataset?.cpf || '';
  const cpfInput = document.getElementById('dist-CPF-do-Responsável');
  if (cpfInput) cpfInput.value = _distFmtCPF(cpf);
};

window.distAtualizaIdade = function(){
  const nasc = document.getElementById('dist-Data-de-Nascimento-do-Paciente')?.value || '';
  const display = document.getElementById('dist-idade-display');
  if (!display) return;
  const idade = _distCalcIdade(nasc);
  display.textContent = idade ? `${idade} (atualizado automaticamente)` : 'Preencha a data de nascimento';
};

window.distExportarPDF = function(secId){
  const sec = S.secs.find(s => s.id === secId); if (!sec) return;
  const jsPDF = PMS.getJsPDF(); if (!jsPDF) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const buscaAtiva = _distNorm(document.getElementById('dist-busca')?.value || '');
  const itens = [...S.items.filter(i => i.atividade_id === secId)].filter(it => _distMatchesBusca(it, buscaAtiva)).sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const agora = PMS.hojeBR();

  doc.setFillColor(13, 34, 64);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(_distEsc(sec.name || 'Controle de Distribuição'), 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 255);
  doc.text('Relatório de distribuição  •  ' + agora + (buscaAtiva ? '  •  Busca ativa (resultado filtrado)' : ''), 14, 19);

  const header = ['#', 'Paciente', ...DIST_CAMPOS.map(c => c.label), 'Idade'];
  const body = itens.map((it, idx) => {
    const ef = it.extra_fields || {};
    const idade = _distCalcIdade(ef['Data de Nascimento do Paciente'] || '');
    return [String(idx + 1), it.description || '', ...DIST_CAMPOS.map(c => ef[c.key] || ''), idade];
  });

  doc.autoTable({
    startY: 28,
    head: [header],
    body: body,
    margin: { left: 10, right: 10, top: 28, bottom: 16 },
    styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: [26, 32, 44], lineColor: [200, 210, 220], lineWidth: 0.15 },
    headStyles: { fillColor: [13, 34, 64], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    rowPageBreak: 'avoid',
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(data.pageNumber + '/' + doc.internal.getNumberOfPages(), 287, 205, { align: 'right' });
    }
  });

  const totalQty = itens.reduce((acc, it) => acc + (parseFloat(it.extra_fields?.['Quantidade Distribuído Mensal']) || 0), 0);
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(13, 34, 64);
  doc.text(`Total de beneficiários: ${itens.length}    |    Quantidade mensal total: ${totalQty}`, 14, finalY);

  doc.save(PMS.slugArquivo(sec.name, 'distribuicao') + '_' + agora.replace(/\//g, '-') + '.pdf');
  toast('PDF gerado!');
};
