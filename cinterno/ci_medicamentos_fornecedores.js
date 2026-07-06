// ════════════════════════════════════════════════════════════════════
//  MÓDULO MEDICAMENTOS (RELATÓRIO POR FORNECEDOR)
//  Depende do estado e helpers do módulo ORC carregado em ci_medicamentos_orc.js
// ════════════════════════════════════════════════════════════════════

let relFornState = {
  mode: 'all',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  dateFrom: '',
  dateTo: '',
  search: '',
  showComprado: true,
};

async function renderRelFornecedor() {
  if (!orcState.loaded) {
    document.getElementById('content').innerHTML = '<div class="loading">Carregando medicamentos…</div>';
    await orcLoadData();
  }
  const groups = getRelFornGroups();
  const grandTotal = rfGrandTotal(groups);
  const totalItems = groups.reduce((a, g) => a + g.items.length, 0);

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let filterExtras = '';
  if (relFornState.mode === 'year' || relFornState.mode === 'month') {
    filterExtras += `
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Ano</span>
      <select onchange="relFornState.year=parseInt(this.value);renderRelFornecedor()" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 10px;font-size:13px;outline:none">${[2024,2025,2026,2027,2028].map(y => `<option value="${y}"${y===relFornState.year?' selected':''}>${y}</option>`).join('')}</select>
    </div>`;
  }
  if (relFornState.mode === 'month') {
    filterExtras += `
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Mês</span>
      <select onchange="relFornState.month=parseInt(this.value);renderRelFornecedor()" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 10px;font-size:13px;outline:none">${MONTHS_SHORT.map((m, i) => `<option value="${i + 1}"${i+1===relFornState.month?' selected':''}>${m}</option>`).join('')}</select>
    </div>`;
  }
  if (relFornState.mode === 'range') {
    filterExtras += `
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">De</span>
      <input type="date" value="${relFornState.dateFrom}" onchange="relFornState.dateFrom=this.value;renderRelFornecedor()" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 10px;font-size:13px;outline:none">
    </div>
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Até</span>
      <input type="date" value="${relFornState.dateTo}" onchange="relFornState.dateTo=this.value;renderRelFornecedor()" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 10px;font-size:13px;outline:none">
    </div>`;
  }

  const filterBar = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Período</span>
      <div style="display:flex;gap:4px">
        ${['all','year','month','range'].map(m => `<button class="orc-fbtn${relFornState.mode===m?' active':''}" onclick="relFornState.mode='${m}';renderRelFornecedor()">${['Tudo','Ano','Mês','Intervalo'][['all','year','month','range'].indexOf(m)]}</button>`).join('')}
      </div>
    </div>
    ${filterExtras}
    <div style="display:flex;flex-direction:column;gap:5px">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Buscar</span>
      <input type="text" id="rf-search-inp" value="${escHtml(relFornState.search)}" placeholder="Fornecedor ou item…" oninput="rfSearchInput(this.value)"
        style="background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 12px;font-size:13px;outline:none;width:200px">
    </div>
    <label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:7px 12px;background:${relFornState.showComprado?'#0d9a8818':'var(--bg)'};border:1px solid ${relFornState.showComprado?'var(--teal2)':'var(--border)'};border-radius:8px;align-self:flex-end">
      <input type="checkbox" ${relFornState.showComprado?'checked':''} onchange="relFornState.showComprado=this.checked;relFornRenderResults()" style="width:15px;height:15px;accent-color:var(--teal2)">
      <span style="font-size:12px;font-weight:600;color:var(--text)">Mostrar valores comprados</span>
    </label>
    <button onclick="relFornPdf()" style="margin-left:auto;padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">📄 Gerar PDF</button>
  </div>`;

  document.getElementById('content').innerHTML = `
  ${ciMedModuleTabs('forn')}
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:12px;flex-wrap:wrap">
    <div class="page-title">📋 Relatório por Fornecedor</div>
    <button onclick="relFornPdf()" style="padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">📄 Gerar PDF / Imprimir</button>
  </div>
  <div class="page-sub">Medicamentos orçados agrupados por fornecedor — Processo N° 023/2025</div>
  ${filterBar}
  <div id="rf-results"></div>`;
  relFornRenderResults();
}

function rfSearchInput(v) {
  relFornState.search = v.trim();
  relFornRenderResults();
}

function getRelFornGroups() {
  let items = orcState.items.filter(i => i.fornecedor && i.fornecedor.trim() !== '');

  if (relFornState.mode === 'year') {
    items = items.filter(i => new Date(i.created_at).getFullYear() === relFornState.year);
  } else if (relFornState.mode === 'month') {
    items = items.filter(i => {
      const d = new Date(i.created_at);
      return d.getFullYear() === relFornState.year && d.getMonth() + 1 === relFornState.month;
    });
  } else if (relFornState.mode === 'range') {
    const from = relFornState.dateFrom ? new Date(relFornState.dateFrom + 'T00:00:00') : null;
    const to = relFornState.dateTo ? new Date(relFornState.dateTo + 'T23:59:59') : null;
    items = items.filter(i => {
      const d = new Date(i.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  if (relFornState.search) {
    const q = relFornState.search.toLowerCase();
    items = items.filter(i =>
      i.fornecedor.toLowerCase().includes(q) ||
      i.descricao.toLowerCase().includes(q) ||
      (i.numero_item || '').toLowerCase().includes(q)
    );
  }

  const map = {};
  for (const item of items) {
    const key = item.fornecedor.trim();
    if (!map[key]) map[key] = { fornecedor: key, cnpj: item.cnpj_fornecedor || '', items: [] };
    map[key].items.push(item);
  }
  return Object.values(map).sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, 'pt-BR'));
}

function relFornRenderResults() {
  const groups = getRelFornGroups();
  const grandTotal = rfGrandTotal(groups);
  const totalItems = groups.reduce((a, g) => a + g.items.length, 0);
  const RF_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#14B8A6','#F97316','#EC4899','#06B6D4','#84CC16'];
  const showC = relFornState.showComprado;
  const grandComprado = groups.reduce((a, g) => a + g.items.reduce((b, it) => b + (orcState.totals[it.id]?.total_value || 0), 0), 0);

  const summaryCards = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:22px">
    <div class="orc-sum-card"><div class="osc-icon">🏭</div><div class="osc-val" style="color:var(--teal2)">${groups.length}</div><div class="osc-lbl">Fornecedores</div></div>
    <div class="orc-sum-card"><div class="osc-icon">💊</div><div class="osc-val" style="color:var(--accent)">${totalItems}</div><div class="osc-lbl">Itens</div></div>
    <div class="orc-sum-card"><div class="osc-icon">💰</div><div class="osc-val" style="color:var(--ok);font-size:14px">${fmtBRL(grandTotal)}</div><div class="osc-lbl">Total Geral c/ Desc.</div></div>
    ${showC ? `<div class="orc-sum-card"><div class="osc-icon">🛒</div><div class="osc-val" style="color:var(--teal2);font-size:14px">${fmtBRL(grandComprado)}</div><div class="osc-lbl">Total Comprado</div></div>` : ''}
  </div>`;

  const supplierBlocks = groups.length ? groups.map((g, gi) => {
    const color = RF_COLORS[gi % RF_COLORS.length];
    const subtotal = g.items.reduce((a, i) => a + i.valor_global * (1 - i.desconto_pct / 100), 0);
    const bruto = g.items.reduce((a, i) => a + i.valor_global, 0);
    const subComprado = g.items.reduce((a, it) => a + (orcState.totals[it.id]?.total_value || 0), 0);
    const saldoRestSup = subtotal - subComprado;
    const pct = grandTotal > 0 ? (subtotal / grandTotal * 100).toFixed(1) : '0.0';
    const rows = g.items.map((it, idx) => {
      const vd = it.valor_global * (1 - it.desconto_pct / 100);
      const comprado = orcState.totals[it.id]?.total_value || 0;
      const saldoRest = vd - comprado;
      return `<tr style="border-bottom:1px solid #1a2840">
        <td style="padding:7px 10px;color:var(--dim);font-size:11px">${idx + 1}</td>
        <td style="padding:7px 10px;color:var(--muted);font-weight:600;font-size:11px">${escHtml(it.numero_item || '—')}</td>
        <td style="padding:7px 10px;font-size:12px;max-width:260px;line-height:1.5">${escHtml(it.descricao)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px">${fmtNum(it.quantidade)}</td>
        <td style="padding:7px 10px;text-align:center;color:var(--muted);font-size:11px">${escHtml(it.unidade)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px">${fmtBRL(it.valor_unitario)}</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:${it.desconto_pct > 0 ? 'var(--ok)' : 'var(--dim)'}">${it.desconto_pct > 0 ? it.desconto_pct.toFixed(2) + '%' : '—'}</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px;color:var(--muted)">${fmtBRL(it.valor_global)}</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:${color}">${fmtBRL(vd)}</td>
        ${showC ? `<td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--teal2)">${fmtBRL(comprado)}</td><td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:${saldoRest >= 0 ? '#F59E0B' : '#EF4444'}">${fmtBRL(saldoRest)}</td>` : ''}
      </tr>`;
    }).join('');
    return `
    <div style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${color};border-radius:0 12px 12px 0;margin-bottom:18px;overflow:hidden">
      <div style="padding:14px 18px;background:#151f35;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:22px">🏭</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:${color}">${escHtml(g.fornecedor)}</div>
          ${g.cnpj ? `<div style="font-size:11px;color:var(--dim);margin-top:2px">CNPJ: ${escHtml(g.cnpj)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:20px;font-weight:800;color:${color}">${fmtBRL(subtotal)}</div>
          ${showC ? `<div style="font-size:13px;font-weight:700;color:var(--teal2)">🛒 ${fmtBRL(subComprado)}</div>` : ''}
          <div style="font-size:11px;color:var(--dim)">${g.items.length} item(s) · ${pct}% do total</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${showC ? '960' : '760'}px">
          <thead><tr style="background:#0f172a">
            <th style="padding:7px 10px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">#</th>
            <th style="padding:7px 10px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Item</th>
            <th style="padding:7px 10px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);min-width:180px">Descrição</th>
            <th style="padding:7px 10px;text-align:right;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Qtd</th>
            <th style="padding:7px 10px;text-align:center;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Un.</th>
            <th style="padding:7px 10px;text-align:right;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Vl.Unit.</th>
            <th style="padding:7px 10px;text-align:center;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Desc%</th>
            <th style="padding:7px 10px;text-align:right;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Vl.Bruto</th>
            <th style="padding:7px 10px;text-align:right;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Vl.c/Desc</th>
            ${showC ? `<th style="padding:7px 10px;text-align:right;color:var(--teal2);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Vl.Comprado</th><th style="padding:7px 10px;text-align:right;color:#F59E0B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Saldo Restante</th>` : ''}
          </tr></thead>
          <tbody>
            ${rows}
            <tr style="background:#151f35">
              <td colspan="7" style="padding:9px 10px;font-size:12px;font-weight:700;color:var(--muted)">SUBTOTAL — ${escHtml(g.fornecedor)}</td>
              <td style="padding:9px 10px;text-align:right;font-size:12px;color:var(--muted)">${fmtBRL(bruto)}</td>
              <td style="padding:9px 10px;text-align:right;font-size:14px;font-weight:800;color:${color}">${fmtBRL(subtotal)}</td>
              ${showC ? `<td style="padding:9px 10px;text-align:right;font-size:14px;font-weight:800;color:var(--teal2)">${fmtBRL(subComprado)}</td><td style="padding:9px 10px;text-align:right;font-size:13px;font-weight:800;color:#F59E0B">${fmtBRL(saldoRestSup)}</td>` : ''}
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('') : '<div class="empty">Nenhum item encontrado para este filtro.</div>';

  const grandTotalBlock = groups.length ? (() => {
    const saldoRestTotal = grandTotal - grandComprado;
    return `
  <div style="background:linear-gradient(135deg,#0D9488,#1D4ED8);border-radius:12px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;margin-top:4px;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:15px;font-weight:800;color:#fff">💰 VALOR TOTAL GERAL — Processo N° 023/2025</div>
      <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px">${groups.length} fornecedores · ${totalItems} itens</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <div style="font-size:28px;font-weight:900;color:#fff">${fmtBRL(grandTotal)}</div>
      ${showC ? `<div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.85)">🛒 Comprado: <strong>${fmtBRL(grandComprado)}</strong></div><div style="font-size:14px;font-weight:700;color:#FCD34D">⏳ Saldo Restante: <strong>${fmtBRL(saldoRestTotal)}</strong></div>` : ''}
    </div>
  </div>`;
  })() : '';

  const thS = 'padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);color:var(--dim)';
  const tdS = 'padding:8px 12px;font-size:13px;border-bottom:1px solid #1a2840;vertical-align:middle';

  const summaryTableRows = groups.map((g, gi) => {
    const color = RF_COLORS[gi % RF_COLORS.length];
    const subtotal = g.items.reduce((a, i) => a + i.valor_global * (1 - i.desconto_pct / 100), 0);
    const subComp = g.items.reduce((a, it) => a + (orcState.totals[it.id]?.total_value || 0), 0);
    const saldo = subtotal - subComp;
    return `<tr>
      <td style="${tdS}">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};margin-right:7px;vertical-align:middle"></span>
        <span style="font-weight:700;color:${color}">${escHtml(g.fornecedor)}</span>
        ${g.cnpj ? `<div style="font-size:11px;color:var(--dim);margin-left:17px">CNPJ: ${escHtml(g.cnpj)}</div>` : ''}
      </td>
      <td style="${tdS};text-align:center;color:var(--muted)">${g.items.length}</td>
      <td style="${tdS};text-align:right;font-weight:700;color:${color}">${fmtBRL(subtotal)}</td>
      ${showC ? `<td style="${tdS};text-align:right;font-weight:700;color:var(--teal2)">${fmtBRL(subComp)}</td>
      <td style="${tdS};text-align:right;font-weight:700;color:${saldo < 0 ? '#F87171' : '#F59E0B'}">${fmtBRL(saldo)}</td>` : ''}
    </tr>`;
  }).join('');

  const summaryTable = groups.length ? `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#151f35;font-size:13px;font-weight:800">📋 Resumo por Fornecedor</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:500px">
        <thead><tr style="background:#0f172a">
          <th style="${thS};text-align:left">Fornecedor</th>
          <th style="${thS};text-align:center">Itens</th>
          <th style="${thS};text-align:right">Vl. Orçado</th>
          ${showC ? `<th style="${thS};text-align:right;color:var(--teal2)">Vl. Comprado</th><th style="${thS};text-align:right;color:#F59E0B">Saldo Restante</th>` : ''}
        </tr></thead>
        <tbody>${summaryTableRows}</tbody>
        <tfoot><tr style="background:#151f35;border-top:2px solid var(--teal2)">
          <td style="padding:10px 12px;font-weight:800;font-size:13px">TOTAL GERAL</td>
          <td style="padding:10px 12px;text-align:center;font-weight:700;color:var(--muted)">${totalItems}</td>
          <td style="padding:10px 12px;text-align:right;font-weight:900;font-size:15px;color:var(--ok)">${fmtBRL(grandTotal)}</td>
          ${showC ? `<td style="padding:10px 12px;text-align:right;font-weight:900;font-size:15px;color:var(--teal2)">${fmtBRL(grandComprado)}</td>
          <td style="padding:10px 12px;text-align:right;font-weight:900;font-size:15px;color:#F59E0B">${fmtBRL(grandTotal - grandComprado)}</td>` : ''}
        </tr></tfoot>
      </table>
    </div>
  </div>` : '';

  const el = document.getElementById('rf-results');
  if (el) el.innerHTML = summaryCards + summaryTable + supplierBlocks + grandTotalBlock;
}

function rfGrandTotal(groups) {
  return groups.reduce((a, g) => a + g.items.reduce((b, i) => b + i.valor_global * (1 - i.desconto_pct / 100), 0), 0);
}

function relFornPdf() {
  const groups = getRelFornGroups();
  if (!groups.length) {
    toast('Nenhum dado para gerar PDF', 'error');
    return;
  }

  const grandTotal = rfGrandTotal(groups);
  const totalItems = groups.reduce((a, g) => a + g.items.length, 0);
  const showC = relFornState.showComprado;
  const grandComp = groups.reduce((a, g) => a + g.items.reduce((b, it) => b + (orcState.totals[it.id]?.total_value || 0), 0), 0);
  const totBruto = groups.reduce((a, g) => a + g.items.reduce((b, i) => b + i.valor_global, 0), 0);

  const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let periodLabel = 'Todos os periodos';
  if (relFornState.mode === 'year') periodLabel = 'Ano ' + relFornState.year;
  else if (relFornState.mode === 'month') periodLabel = MONTHS_SHORT[relFornState.month - 1] + '/' + relFornState.year;
  else if (relFornState.mode === 'range' && (relFornState.dateFrom || relFornState.dateTo)) {
    periodLabel = (relFornState.dateFrom || 'inicio') + ' a ' + (relFornState.dateTo || 'hoje');
  }

  const brl = v => 'R$\u00a0' + (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = v => (+v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  const PDF_COLORS = [
    [21,88,160],[10,102,64],[122,79,0],[74,32,128],[138,21,21],
    [8,95,90],[138,64,0],[144,0,96],[3,84,112],[58,96,0],
  ];

  const now = new Date();
  const dtStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sections = [];

  sections.push({
    type: 'header',
    title: 'Relatorio de Medicamentos por Fornecedor',
    subtitle: 'Processo N\u00ba 023/2025 \u2014 Prefeitura Municipal de Sertania',
    right: 'Emitido em: ' + dtStr,
    right2: groups.length + ' fornecedores \u00b7 ' + totalItems + ' itens \u00b7 Periodo: ' + periodLabel,
    color: [13, 34, 64],
  });

  const cardItems = [
    { value: String(groups.length), label: 'Fornecedores', color: [13, 34, 64] },
    { value: String(totalItems), label: 'Total de Itens', color: [13, 34, 64] },
    { value: brl(totBruto), label: 'Total Bruto', color: [100, 100, 110] },
    { value: brl(grandTotal), label: 'Total c/ Desconto', color: [13, 122, 116] },
  ];
  if (showC) cardItems.push({ value: brl(grandComp), label: 'Total Comprado', color: [10, 102, 64] });
  sections.push({ type: 'cards', items: cardItems });
  sections.push({ type: 'section-title', text: 'Resumo por Fornecedor' });

  const sumHead = [showC
    ? ['Fornecedor', 'Itens',
        { content: 'Vl. Orcado', styles: { halign: 'right' } },
        { content: 'Vl. Comprado', styles: { halign: 'right', textColor: [10,102,64] } },
        { content: 'Saldo Restante', styles: { halign: 'right', textColor: [122,79,0] } }]
    : ['Fornecedor', 'Itens',
        { content: 'Vl. Orcado', styles: { halign: 'right' } }]
  ];
  const sumBody = groups.map((g, gi) => {
    const [r2, g2, b2] = PDF_COLORS[gi % PDF_COLORS.length];
    const subtotal = g.items.reduce((a, i) => a + i.valor_global * (1 - i.desconto_pct / 100), 0);
    const subComp = g.items.reduce((a, it) => a + (orcState.totals[it.id]?.total_value || 0), 0);
    const saldo = subtotal - subComp;
    const row = [
      { content: g.fornecedor + (g.cnpj ? '\nCNPJ: ' + g.cnpj : ''), styles: { textColor: [r2, g2, b2], fontStyle: 'bold' } },
      { content: String(g.items.length), styles: { halign: 'center' } },
      { content: brl(subtotal), styles: { halign: 'right', fontStyle: 'bold' } },
    ];
    if (showC) {
      row.push({ content: brl(subComp), styles: { halign: 'right', textColor: [10,102,64], fontStyle: 'bold' } });
      row.push({ content: brl(saldo), styles: { halign: 'right', textColor: saldo < 0 ? [192,0,0] : [122,79,0], fontStyle: 'bold' } });
    }
    return row;
  });
  const sumFoot = [[
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' } },
    { content: String(totalItems), styles: { halign: 'center', fontStyle: 'bold' } },
    { content: brl(grandTotal), styles: { halign: 'right', fontStyle: 'bold' } },
    ...(showC ? [
      { content: brl(grandComp), styles: { halign: 'right', fontStyle: 'bold', textColor: [10,102,64] } },
      { content: brl(grandTotal - grandComp), styles: { halign: 'right', fontStyle: 'bold', textColor: [122,79,0] } },
    ] : []),
  ]];
  sections.push({ type: 'table', head: sumHead, body: sumBody, foot: sumFoot, fontSize: 9 });

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const [r2, g2, b2] = PDF_COLORS[gi % PDF_COLORS.length];
    const subtotal = g.items.reduce((a, i) => a + i.valor_global * (1 - i.desconto_pct / 100), 0);
    const bruto = g.items.reduce((a, i) => a + i.valor_global, 0);
    const subComp = g.items.reduce((a, it) => a + (orcState.totals[it.id]?.total_value || 0), 0);
    const pct = grandTotal > 0 ? (subtotal / grandTotal * 100).toFixed(1) : '0.0';

    sections.push({
      type: 'org-header',
      name: g.fornecedor,
      sub: g.cnpj ? 'CNPJ: ' + g.cnpj : undefined,
      right: brl(subtotal),
      right2: g.items.length + ' item(s) \u00b7 ' + pct + '% do total' + (showC ? ' \u00b7 Comprado: ' + brl(subComp) : ''),
      color: [r2, g2, b2],
    });

    const head = [[
      '#', 'Item', 'Descricao',
      { content: 'Qtd', styles: { halign: 'right' } },
      { content: 'Un.', styles: { halign: 'center' } },
      { content: 'Vl.Unit.', styles: { halign: 'right' } },
      { content: 'Desc%', styles: { halign: 'center' } },
      { content: 'Vl.Bruto', styles: { halign: 'right' } },
      { content: 'Vl.c/Desc', styles: { halign: 'right' } },
      ...(showC ? [{ content: 'Vl.Comprado', styles: { halign: 'right', textColor: [10,102,64] } }] : []),
    ]];
    const body = g.items.map((it, idx) => {
      const vd = it.valor_global * (1 - it.desconto_pct / 100);
      const comprado = orcState.totals[it.id]?.total_value || 0;
      return [
        String(idx + 1),
        String(it.numero_item || '\u2014'),
        String(it.descricao),
        { content: num(it.quantidade), styles: { halign: 'right' } },
        { content: String(it.unidade), styles: { halign: 'center' } },
        { content: brl(it.valor_unitario), styles: { halign: 'right' } },
        { content: it.desconto_pct > 0 ? it.desconto_pct.toFixed(2) + '%' : '\u2014', styles: { halign: 'center' } },
        { content: brl(it.valor_global), styles: { halign: 'right', textColor: [150,150,150] } },
        { content: brl(vd), styles: { halign: 'right', textColor: [r2,g2,b2], fontStyle: 'bold' } },
        ...(showC ? [{ content: brl(comprado), styles: { halign: 'right', textColor: [10,102,64], fontStyle: 'bold' } }] : []),
      ];
    });
    const foot = [[
      { content: 'SUBTOTAL \u2014 ' + g.fornecedor, colSpan: 7, styles: { fontStyle: 'bold' } },
      { content: brl(bruto), styles: { halign: 'right', textColor: [150,150,150] } },
      { content: brl(subtotal), styles: { halign: 'right', textColor: [r2,g2,b2], fontStyle: 'bold' } },
      ...(showC ? [{ content: brl(subComp), styles: { halign: 'right', textColor: [10,102,64], fontStyle: 'bold' } }] : []),
    ]];
    const colStyles = {
      0: { cellWidth: 7 }, 1: { cellWidth: 14 }, 2: { cellWidth: 'auto' },
      3: { cellWidth: 18, halign: 'right' }, 4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 22, halign: 'right' }, 8: { cellWidth: 22, halign: 'right' },
    };
    if (showC) colStyles[9] = { cellWidth: 22, halign: 'right' };
    sections.push({ type: 'table', head, body, foot, fontSize: 7.5, colStyles });
  }

  sections.push({
    type: 'total-block',
    label: 'VALOR TOTAL GERAL \u2014 Processo N\u00ba 023/2025',
    meta: groups.length + ' fornecedores \u00b7 ' + totalItems + ' itens' + (showC ? ' \u00b7 Comprado: ' + brl(grandComp) : ''),
    value: brl(grandTotal),
  });

  _downloadPdf({ filename: 'relatorio-fornecedor.pdf', orientation: 'portrait', sections });
}