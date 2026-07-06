// ════════════════════════════════════════════════════════════════════
//  MÓDULO NOTAS FISCAIS
// ════════════════════════════════════════════════════════════════════

let nfState = { notas: [], loaded: false };
let nfRowCount = 0;
let nfDetailCurrentId = null;
let nfDetailData      = null;
let nfEdRowCount      = 0;

async function renderNotasFiscais() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando notas fiscais…</div>';
  const r = await api('orc_notas');
  if (!r.ok) { document.getElementById('content').innerHTML = '<div class="empty">Erro ao carregar notas.</div>'; return; }
  nfState.notas = r.notas || [];
  nfBuildLayout();
}

function nfBuildLayout() {
  const notas = nfState.notas;
  const totalNF  = notas.length;
  const totalVal = notas.reduce((s,n) => s + (n.valor_total_real || n.valor_total || 0), 0);
  const totalItens = notas.reduce((s,n) => s + (n.num_compras || 0), 0);

  const cards = notas.length ? notas.map(n => `
  <div class="nf-card">
    <div class="nf-card-head">
      <div>
        <div class="nf-num">NF ${escHtml(n.numero_nota)}${n.serie ? ' · Série '+escHtml(n.serie) : ''}</div>
        <div class="nf-forn">🏭 ${escHtml(n.fornecedor)}</div>
        ${n.cnpj_fornecedor ? `<div class="nf-cnpj">CNPJ: ${escHtml(n.cnpj_fornecedor)}</div>` : ''}
      </div>
      <div class="nf-value">${fmtBRL(n.valor_total_real || n.valor_total)}</div>
    </div>
    <div class="nf-meta">
      <div class="nf-meta-item">📅 Emissão: <b>${n.data_emissao ? fmtDateOnly(n.data_emissao) : '—'}</b></div>
      <div class="nf-meta-item">📦 Itens: <b>${n.num_compras}</b></div>
      <div class="nf-meta-item">🕐 Lançado: <b>${fmtDate(n.created_at)}</b></div>
    </div>
    ${n.observacoes ? `<div style="font-size:11px;color:var(--dim)">${escHtml(n.observacoes)}</div>` : ''}
    <div class="nf-actions">
      <button class="btn-nf-detail" onclick="nfOpenDetail(${n.id})">📋 Ver Itens</button>
      <button class="btn-nf-del" onclick="nfDelete(${n.id},'${escHtml(n.numero_nota).replace(/'/g,"\\'")}')">🗑️ Excluir</button>
    </div>
  </div>`).join('')
  : '<div class="nf-empty">Nenhuma nota fiscal lançada ainda.<br><br>Clique em <b>"+ Nova Nota Fiscal"</b> para começar.</div>';

  document.getElementById('content').innerHTML = `
  ${ciMedModuleTabs('notas')}
  <div class="page-title">🧾 Notas Fiscais</div>
  <div class="page-sub">Lançamento em massa de medicamentos comprados por nota fiscal</div>

  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:16px">
    <div class="orc-sum-card"><div class="osc-icon">🧾</div><div class="osc-val">${totalNF}</div><div class="osc-lbl">Notas Lançadas</div></div>
    <div class="orc-sum-card"><div class="osc-icon">📦</div><div class="osc-val">${totalItens}</div><div class="osc-lbl">Itens Registrados</div></div>
    <div class="orc-sum-card"><div class="osc-icon">💰</div><div class="osc-val" style="color:var(--ok);font-size:16px">${fmtBRL(totalVal)}</div><div class="osc-lbl">Total Comprado</div></div>
    <div style="margin-left:auto;display:flex;align-items:center">
      <button class="btn-save" onclick="nfOpenCreate()">+ Nova Nota Fiscal</button>
    </div>
  </div>

  <div class="nf-grid">${cards}</div>`;
}

function nfOpenCreate() {
  if (!orcState.loaded || !orcState.items.length) {
    toast('Carregando itens orçados…','info');
    orcLoadData().then(() => nfOpenCreate());
    return;
  }
  nfRowCount = 0;
  document.getElementById('nf-numero').value    = '';
  document.getElementById('nf-serie').value     = '';
  document.getElementById('nf-forn').value      = '';
  document.getElementById('nf-cnpj').value      = '';
  document.getElementById('nf-data').value      = new Date().toISOString().slice(0,10);
  document.getElementById('nf-obs').value       = '';
  document.getElementById('nf-rows').innerHTML  = '';
  nfUpdateTotal();
  nfAddRow();
  document.getElementById('nfModalOverlay').style.display = 'flex';
}

function nfCloseCreate() {
  document.getElementById('nfModalOverlay').style.display = 'none';
}

function nfAddRow() {
  nfRowCount++;
  const idx = nfRowCount;
  const opts = orcState.items.map(it =>
    `<option value="${it.id}">[Lote ${escHtml(it.numero_lote||'?')} Item ${escHtml(it.numero_item||'?')}] ${escHtml(it.descricao)} (${escHtml(it.unidade)})</option>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'nf-item-row';
  row.id = `nf-row-${idx}`;
  row.innerHTML = `
    <select onchange="nfFillUnitPrice(${idx})"><option value="">— Selecione o item —</option>${opts}</select>
    <input type="number" id="nf-qty-${idx}" placeholder="Qtd." min="0.001" step="0.001" oninput="nfCalcRow(${idx})">
    <input type="number" id="nf-vun-${idx}" placeholder="Vl. Unit. (R$)" min="0" step="0.01" oninput="nfCalcRow(${idx})">
    <div class="nf-item-total" id="nf-tot-${idx}">R$ 0,00</div>
    <button class="btn-rm-row" onclick="nfRemoveRow(${idx})" title="Remover">✕</button>`;
  document.getElementById('nf-rows').appendChild(row);
}

function nfFillUnitPrice(idx) {
  const sel = document.querySelector(`#nf-row-${idx} select`);
  const itemId = parseInt(sel.value);
  if (!itemId) return;
  const it = orcState.items.find(i => i.id === itemId);
  if (it) {
    const vd = it.valor_global * (1 - (it.desconto_pct || 0) / 100);
    const vUn = it.quantidade > 0 ? vd / it.quantidade : it.valor_unitario;
    document.getElementById(`nf-vun-${idx}`).value = vUn.toFixed(4);
    nfCalcRow(idx);
  }
}

function nfCalcRow(idx) {
  const qty  = parseFloat(document.getElementById(`nf-qty-${idx}`)?.value || 0) || 0;
  const vun  = parseFloat(document.getElementById(`nf-vun-${idx}`)?.value || 0) || 0;
  const tot  = qty * vun;
  const el   = document.getElementById(`nf-tot-${idx}`);
  if (el) el.textContent = fmtBRL(tot);
  nfUpdateTotal();
}

function nfRemoveRow(idx) {
  const el = document.getElementById(`nf-row-${idx}`);
  if (el) el.remove();
  nfUpdateTotal();
}

function nfUpdateTotal() {
  let total = 0;
  document.querySelectorAll('.nf-item-row').forEach((row, i) => {
    const qty = parseFloat(row.querySelector('input[type="number"]:nth-child(2)')?.value || 0) || 0;
    const vun = parseFloat(row.querySelector('input[type="number"]:nth-child(3)')?.value || 0) || 0;
    total += qty * vun;
  });
  const el = document.getElementById('nf-grand-total');
  if (el) el.textContent = fmtBRL(total);
}

async function nfSave() {
  const numNota = document.getElementById('nf-numero').value.trim();
  const serie   = document.getElementById('nf-serie').value.trim();
  const forn    = document.getElementById('nf-forn').value.trim();
  const cnpj    = document.getElementById('nf-cnpj').value.trim();
  const data    = document.getElementById('nf-data').value;
  const obs     = document.getElementById('nf-obs').value.trim();

  if (!numNota) { toast('Informe o número da nota fiscal','error'); return; }
  if (!forn)    { toast('Informe o nome do fornecedor','error'); return; }

  const items = [];
  let valid = true;
  document.querySelectorAll('.nf-item-row').forEach(row => {
    const sel  = row.querySelector('select');
    const inps = row.querySelectorAll('input[type="number"]');
    const itemId = parseInt(sel?.value || 0);
    const qty    = parseFloat(inps[0]?.value || 0) || 0;
    const vun    = parseFloat(inps[1]?.value || 0) || 0;
    if (!itemId) return;
    if (qty <= 0) { toast('Informe a quantidade para todos os itens','error'); valid = false; return; }
    items.push({ item_id: itemId, quantidade: qty, valor_unitario: vun });
  });

  if (!valid) return;
  if (!items.length) { toast('Adicione pelo menos um item na nota','error'); return; }

  const btn = document.querySelector('.btn-nf-save');
  btn.disabled = true; btn.textContent = 'Salvando…';

  const r = await api('orc_create_nota', { numero_nota: numNota, serie, fornecedor: forn,
    cnpj_fornecedor: cnpj, data_emissao: data, observacoes: obs, items });

  btn.disabled = false; btn.textContent = '💾 Salvar Nota Fiscal';

  if (r.ok) {
    toast(`Nota NF ${numNota} salva! ${r.itens_count} item(ns) · ${fmtBRL(r.total)}`);
    nfCloseCreate();
    orcState.loaded = false;
    await renderNotasFiscais();
  } else {
    toast(r.error || 'Erro ao salvar nota', 'error');
  }
}

async function nfOpenDetail(notaId) {
  nfDetailCurrentId = notaId;
  document.getElementById('nfDetailOverlay').style.display = 'flex';
  document.getElementById('nf-detail-body').innerHTML = '<div class="loading">Carregando…</div>';
  const r = await api(`orc_nota_detail&nota_id=${notaId}`);
  if (!r.ok) { document.getElementById('nf-detail-body').innerHTML = '<div class="empty">Erro ao carregar.</div>'; return; }
  nfDetailData = r;
  nfRenderDetailView();
}

function nfRenderDetailView() {
  const n = nfDetailData.nota;
  const itens = nfDetailData.itens;
  const total = itens.reduce((s,i) => s + parseFloat(i.valor_total||0), 0);
  const semMatchCount = itens.filter(i => i.sem_match).length;
  const rows = itens.map(it => {
    const nomeMed = it.sem_match
      ? (it.observacoes ? it.observacoes.replace(/^\[AVISO:[^\]]+\]\s*/,'').split(/[,;]/)[0].trim() : it.descricao_compra || '?')
      : it.descricao;
    const matchBadge = it.sem_match
      ? `<span style="background:#7c2d12;color:#FCA5A5;border:1px solid #991b1b;border-radius:4px;font-size:10px;padding:1px 5px;margin-left:4px">⚠️ S/orch</span>`
      : '';
    return `
  <tr style="${it.sem_match ? 'background:rgba(153,27,27,0.08)' : ''}">
    <td style="font-size:11px;color:var(--muted)">${it.sem_match ? '—' : `[Lote ${escHtml(it.numero_lote||'?')} Item ${escHtml(it.numero_item||'?')}]`}</td>
    <td style="font-size:13px">${escHtml(nomeMed)}${matchBadge}</td>
    <td style="text-align:center;color:var(--muted)">${escHtml(it.unidade||'')}</td>
    <td style="text-align:right">${fmtNum(it.quantidade)}</td>
    <td style="text-align:right;color:var(--muted)">${fmtBRL(it.valor_unitario)}</td>
    <td style="text-align:right;font-weight:700;color:${it.sem_match ? '#FCA5A5' : 'var(--ok)'}">${fmtBRL(it.valor_total)}</td>
  </tr>`;
  }).join('');
  document.getElementById('nf-detail-body').innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <button class="btn-nf-edit" onclick="nfEnterEditMode()">✏️ Editar Nota</button>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
    <div><div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase">Nota Fiscal</div>
         <div style="font-size:16px;font-weight:800;margin-top:4px">NF ${escHtml(n.numero_nota)}${n.serie?` · Série ${escHtml(n.serie)}`:''}</div></div>
    <div><div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase">Fornecedor</div>
         <div style="font-size:14px;font-weight:700;color:var(--teal2);margin-top:4px">${escHtml(n.fornecedor)}</div>
         ${n.cnpj_fornecedor?`<div style="font-size:11px;color:var(--dim)">${escHtml(n.cnpj_fornecedor)}</div>`:''}</div>
    <div><div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase">Data Emissão</div>
         <div style="font-size:14px;font-weight:700;margin-top:4px">${n.data_emissao?fmtDateOnly(n.data_emissao):'—'}</div>
         <div style="font-size:11px;color:var(--dim)">Lançado: ${fmtDate(n.created_at)}</div></div>
  </div>
  ${semMatchCount > 0 ? `<div style="background:#7c2d1220;border:1px solid #991b1b;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#FCA5A5">⚠️ <strong>${semMatchCount} item${semMatchCount!==1?'s':''} sem correspondência no orçamento</strong> — marcados em vermelho abaixo.</div>` : ''}
  ${n.observacoes?`<div style="font-size:12px;color:var(--muted);margin-bottom:16px;padding:10px;background:var(--bg);border-radius:8px">${escHtml(n.observacoes)}</div>`:''}
  <div class="table-wrap">
    <table>
      <thead><tr><th>Lote/Item</th><th>Descrição</th><th>Un.</th><th style="text-align:right">Qtd.</th><th style="text-align:right">Vl. Unit.</th><th style="text-align:right">Vl. Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="text-align:right;margin-top:14px;font-size:18px;font-weight:800;color:var(--ok)">Total: ${fmtBRL(total)}</div>`;
}

async function nfEnterEditMode() {
  if (!orcState.loaded) {
    document.getElementById('nf-detail-body').innerHTML = '<div class="loading">Carregando itens…</div>';
    const r = await api('orc_data');
    if (r.ok) { orcState.items = r.items || []; orcState.loaded = true; }
  }
  const n = nfDetailData.nota;
  const itens = nfDetailData.itens;
  nfEdRowCount = 0;
  const editRows = itens.map(it => { nfEdRowCount++; return nfDetRowHtml(nfEdRowCount, it.item_id, it.quantidade, it.valor_unitario, it.valor_total); }).join('');
  const total = itens.reduce((s,i) => s + parseFloat(i.valor_total||0), 0);
  const dataVal = n.data_emissao ? (n.data_emissao+'').split('T')[0] : '';
  document.getElementById('nf-detail-body').innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group" style="margin:0"><label>Fornecedor *</label>
      <input id="nfed-forn" type="text" value="${escHtml(n.fornecedor)}"></div>
    <div class="form-group" style="margin:0"><label>CNPJ</label>
      <input id="nfed-cnpj" type="text" value="${escHtml(n.cnpj_fornecedor||'')}"></div>
  </div>
  <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="form-group" style="margin:0"><label>Número da Nota *</label>
      <input id="nfed-numero" type="text" value="${escHtml(n.numero_nota)}"></div>
    <div class="form-group" style="margin:0"><label>Série</label>
      <input id="nfed-serie" type="text" value="${escHtml(n.serie||'')}"></div>
    <div class="form-group" style="margin:0"><label>Data Emissão</label>
      <input id="nfed-data" type="date" value="${dataVal}"></div>
  </div>
  <div class="form-group" style="margin-bottom:14px"><label>Observações</label>
    <input id="nfed-obs" type="text" value="${escHtml(n.observacoes||'')}"></div>
  <div style="font-size:11px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📦 Itens da Nota</div>
  <div class="nf-col-headers" style="grid-template-columns:2fr 80px 110px 80px 100px 28px"><span>Item Orçado</span><span>Qtd.</span><span>Vl. Unitário</span><span>Auto</span><span style="color:#F59E0B">✏️ Manual</span><span></span></div>
  <div id="nfed-rows">${editRows}</div>
  <button class="btn-nf-add-row" onclick="nfDetAddRow()">+ Adicionar Item</button>
  <div class="nf-total-bar" style="margin-top:12px;flex-wrap:wrap;gap:12px">
    <span>Total da Nota (auto):</span>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <strong id="nfed-total">${fmtBRL(total)}</strong>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:#F59E0B;font-weight:600">✏️ Total Manual:</span>
        <input type="number" id="nfed-total-man" min="0" step="0.01" placeholder="Opcional"
          style="width:145px;background:var(--bg);border:1px solid #F59E0B50;border-radius:8px;color:#F59E0B;padding:6px 10px;font-size:14px;font-weight:700;font-family:inherit;outline:none">
      </div>
    </div>
  </div>
  <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
    <button class="btn-nf-cancel" onclick="nfRenderDetailView()">✕ Cancelar</button>
    <button class="btn-nf-save" onclick="nfSaveEdit()" id="nfed-save-btn">💾 Salvar Alterações</button>
  </div>`;
}

function nfDetRowHtml(idx, itemId, qty, vUn, savedTotal) {
  const id0  = parseInt(itemId) || 0;
  const qtyF = parseFloat(qty)  || 0;
  const vUnF = parseFloat(vUn)  || 0;
  const vTot = Math.round(qtyF * vUnF * 100) / 100;
  const saved = parseFloat(savedTotal) || 0;
  const manVal = saved > 0 && Math.abs(saved - vTot) > 0.001 ? saved : '';
  const opts = (orcState.items||[]).map(it =>
    `<option value="${it.id}"${it.id===id0?' selected':''}>[L${escHtml(it.numero_lote||'?')} I${escHtml(it.numero_item||'?')}] ${escHtml(it.descricao)} (${escHtml(it.unidade||'')})</option>`
  ).join('');
  return `<div class="nfed-item-row" id="nfed-row-${idx}">
    <select onchange="nfEdFillPrice(${idx})"><option value="">— Selecione —</option>${opts}</select>
    <input type="number" id="nfed-qty-${idx}" min="0.001" step="0.001" value="${qtyF||''}" placeholder="Qtd." oninput="nfEdCalcRow(${idx})">
    <input type="number" id="nfed-vun-${idx}" min="0" step="0.01" value="${vUnF||''}" placeholder="Vl. Unit." oninput="nfEdCalcRow(${idx})">
    <div class="nf-item-total" id="nfed-tot-${idx}">${fmtBRL(manVal !== '' ? manVal : vTot)}</div>
    <input type="number" id="nfed-man-${idx}" min="0" step="0.01" placeholder="Manual" value="${manVal}" oninput="nfEdUpdateTotal()" class="nfed-man-input" title="Total manual — sobrescreve o cálculo automático">
    <button class="btn-rm-row" onclick="document.getElementById('nfed-row-${idx}').remove();nfEdUpdateTotal()" title="Remover">✕</button>
  </div>`;
}

function nfDetAddRow() {
  nfEdRowCount++;
  const div = document.createElement('div');
  div.innerHTML = nfDetRowHtml(nfEdRowCount, 0, '', '');
  document.getElementById('nfed-rows').appendChild(div.firstElementChild);
}

function nfEdFillPrice(idx) {
  const sel = document.querySelector(`#nfed-row-${idx} select`);
  const itemId = parseInt(sel?.value||0);
  if (!itemId) return;
  const it = (orcState.items||[]).find(i => i.id === itemId);
  if (it) {
    const vd  = it.valor_global * (1 - (it.desconto_pct||0)/100);
    const vUn = it.quantidade > 0 ? vd / it.quantidade : it.valor_unitario;
    const el  = document.getElementById(`nfed-vun-${idx}`);
    if (el) { el.value = vUn.toFixed(4); }
    nfEdCalcRow(idx);
  }
}

function nfEdCalcRow(idx) {
  const qty = parseFloat(document.getElementById(`nfed-qty-${idx}`)?.value||0)||0;
  const vun = parseFloat(document.getElementById(`nfed-vun-${idx}`)?.value||0)||0;
  const el  = document.getElementById(`nfed-tot-${idx}`);
  if (el) el.textContent = fmtBRL(qty * vun);
  nfEdUpdateTotal();
}

function nfEdUpdateTotal() {
  let total = 0;
  document.querySelectorAll('#nfed-rows .nfed-item-row').forEach(row => {
    const inputs = row.querySelectorAll('input[type="number"]');
    const qty = parseFloat(inputs[0]?.value||0)||0;
    const vun = parseFloat(inputs[1]?.value||0)||0;
    const man = parseFloat(inputs[2]?.value||0)||0;
    total += man > 0 ? man : (qty * vun);
  });
  const el = document.getElementById('nfed-total');
  if (el) el.textContent = fmtBRL(total);
}

async function nfSaveEdit() {
  const numNota = document.getElementById('nfed-numero')?.value.trim();
  const forn    = document.getElementById('nfed-forn')?.value.trim();
  if (!numNota) { toast('Informe o número da nota','error'); return; }
  if (!forn)    { toast('Informe o fornecedor','error'); return; }

  const items = [];
  let valid = true;
  document.querySelectorAll('#nfed-rows .nfed-item-row').forEach(row => {
    const sel    = row.querySelector('select');
    const inps   = row.querySelectorAll('input[type="number"]');
    const itemId = parseInt(sel?.value||0);
    const qty    = parseFloat(inps[0]?.value||0)||0;
    const vun    = parseFloat(inps[1]?.value||0)||0;
    const man    = parseFloat(inps[2]?.value||0)||0;
    if (!itemId) return;
    if (qty <= 0) { toast('Informe a quantidade para todos os itens','error'); valid = false; return; }
    const item = { item_id: itemId, quantidade: qty, valor_unitario: vun };
    if (man > 0) item.valor_total = man;
    items.push(item);
  });
  if (!valid) return;
  if (!items.length) { toast('Adicione pelo menos um item','error'); return; }

  const btn = document.getElementById('nfed-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const totalMan = parseFloat(document.getElementById('nfed-total-man')?.value||0)||0;
  const payload   = {
    nota_id: nfDetailCurrentId,
    numero_nota: numNota,
    serie: document.getElementById('nfed-serie')?.value.trim()||'',
    fornecedor: forn,
    cnpj_fornecedor: document.getElementById('nfed-cnpj')?.value.trim()||'',
    data_emissao: document.getElementById('nfed-data')?.value||null,
    observacoes: document.getElementById('nfed-obs')?.value.trim()||'',
    items,
  };
  if (totalMan > 0) payload.valor_total_nota = totalMan;
  const r = await api('orc_update_nota', payload);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Alterações'; }

  if (r.ok) {
    toast(`Nota atualizada! ${r.itens_count} item(ns) · ${fmtBRL(r.total)}`);
    const detail = await api(`orc_nota_detail&nota_id=${nfDetailCurrentId}`);
    if (detail.ok) nfDetailData = detail;
    nfRenderDetailView();
    orcState.loaded = false;
    renderNotasFiscais();
  } else {
    toast(r.error||'Erro ao salvar','error');
  }
}

function nfCloseDetail() {
  document.getElementById('nfDetailOverlay').style.display = 'none';
}

async function nfDelete(notaId, numNota) {
  if (!confirm(`Excluir a NF "${numNota}"?\n\nTodos os itens comprados vinculados a ela serão removidos e os percentuais voltarão ao estado anterior.`)) return;
  const r = await api('orc_delete_nota', {nota_id: notaId});
  if (r.ok) {
    toast('Nota fiscal excluída!');
    orcState.loaded = false;
    await renderNotasFiscais();
  } else {
    toast(r.error || 'Erro ao excluir', 'error');
  }
}

function fmtDateOnly(iso) {
  if (!iso) return '—';
  const [y,m,d] = (iso+'').split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}