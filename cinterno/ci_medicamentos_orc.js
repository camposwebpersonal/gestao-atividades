// ════════════════════════════════════════════════════════════════════
//  MÓDULO MEDICAMENTOS (ORC)
//  Integrado ao cinterno — todas as chamadas usam a mesma api() helper
//  Ações prefixadas com orc_ em api.php para não conflitar com CI
// ════════════════════════════════════════════════════════════════════

// ─── ORC State ───────────────────────────────────────────────────────
let orcState = {
  items:  [],
  totals: {},          // { [itemId]: { total_qty, total_value, num_compras } }
  tab:    'dashboard', // 'dashboard' | 'itens' | 'compras'
  search: '',
  filter: 'all',       // 'all' | 'ok' | 'warn' | 'danger'
  loaded: false,
};

// ─── ORC Entry ───────────────────────────────────────────────────────
async function renderOrcSection() {
  if (!orcState.loaded) {
    document.getElementById('content').innerHTML =
      '<div class="loading">Carregando medicamentos…</div>';
    await orcLoadData();
  }
  orcBuildLayout();
  orcRenderTab();
  orcUpdateSidebarBadge();
}

async function orcLoadData() {
  const r = await api('orc_data');
  if (!r.ok) { toast('Erro ao carregar medicamentos', 'error'); return; }
  orcState.items  = r.items || [];
  orcState.totals = {};
  for (const it of orcState.items) {
    orcState.totals[it.id] = it.totals || { total_qty:0, total_value:0, num_compras:0 };
  }
  orcState.loaded = true;
}

function orcUpdateSidebarBadge() {
  const badge = document.getElementById('orc-sidebar-badge');
  if (!badge) return;
  const exc = orcState.items.filter(i => orcItemStatus(i).status === 'danger').length;
  badge.textContent   = exc > 0 ? `${exc} ⚠️` : `${orcState.items.length}`;
  badge.style.background = exc > 0 ? '#EF444420' : '#0D948820';
  badge.style.color      = exc > 0 ? '#EF4444'   : '#14B8A6';
}

function orcBuildLayout() {
  const TABS = [
    ['dashboard',    '📊 Dashboard'],
    ['itens',        '💊 Medicamentos'],
    ['compras',      '🛒 Histórico'],
    ['relatorio_nf', '🧾 Relatório de NFs'],
  ];
  const tabHtml = TABS.map(([t, l]) =>
    `<button class="orc-tab${orcState.tab===t?' active':''}" onclick="orcSwitchTab('${t}')">${l}</button>`
  ).join('');
  document.getElementById('content').innerHTML = `
  ${ciMedModuleTabs('orc')}
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div>
      <div class="page-title">💊 Medicamentos Orçados</div>
      <div class="page-sub">${orcState.items.length} itens cadastrados</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="text" id="orc-search" placeholder="🔍 Buscar medicamento…"
             value="${escHtml(orcState.search)}" oninput="orcHandleSearch(this.value)"
             style="background:var(--bg);border:1px solid var(--border);border-radius:8px;
                    color:var(--text);padding:7px 12px;font-size:13px;outline:none;width:210px">
      <button class="btn-add-main" onclick="orcOpenItemModal(null)">＋ Novo Item</button>
    </div>
  </div>
  <div class="orc-tabs">${tabHtml}</div>
  <div id="orc-content"></div>`;
}

function orcSwitchTab(tab) {
  orcState.tab    = tab;
  orcState.search = '';
  orcState.filter = 'all';
  orcBuildLayout();
  orcRenderTab();
}

function orcRenderTab() {
  if (orcState.search) { orcRenderSearch(); return; }
  if (orcState.tab === 'dashboard')    orcRenderDashboard();
  else if (orcState.tab === 'itens')   orcRenderItens();
  else if (orcState.tab === 'relatorio_nf') orcRenderRelatorioNFs();
  else orcRenderComprasTab();
}

// ─── Helpers ─────────────────────────────────────────────────────────
function fmtBRL(v) {
  return 'R$\u00a0' + (+v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtNum(v) {
  return (+v).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:3 });
}
function orcFmtDate(s) {
  if (!s) return '—';
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(s).toLocaleDateString('pt-BR');
}

function orcItemStatus(item) {
  const t  = orcState.totals[item.id] || {};
  const vd = item.valor_global * (1 - item.desconto_pct / 100);
  const pq = item.quantidade > 0 ? (t.total_qty   / item.quantidade * 100) : 0;
  const pv = vd > 0             ? (t.total_value / vd * 100) : 0;
  const pct = Math.max(pq, pv);
  return {
    pct:    Math.round(pct * 10) / 10,
    pq:     Math.round(pq  * 10) / 10,
    pv:     Math.round(pv  * 10) / 10,
    status: pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok',
    vd,
  };
}

function orcStatusBadge(status, pct) {
  if (status === 'danger') return `<span class="orc-exc-tag">⚠️ EXCEDIDO ${pct.toFixed(1)}%</span>`;
  if (status === 'warn')   return `<span class="orc-warn-badge">${pct.toFixed(1)}%</span>`;
  return `<span class="orc-ok-badge">${pct.toFixed(1)}%</span>`;
}

function orcGetFiltered() {
  let items = [...orcState.items];
  if (orcState.filter !== 'all')
    items = items.filter(i => orcItemStatus(i).status === orcState.filter);
  if (orcState.search) {
    const q = orcState.search.toLowerCase();
    items = items.filter(i =>
      i.descricao.toLowerCase().includes(q) ||
      (i.numero_lote + ' ' + i.numero_item).toLowerCase().includes(q)
    );
  }
  return items;
}

function orcHandleSearch(q) {
  orcState.search = q.trim().toLowerCase();
  orcRenderTab();
}

function orcSetFilter(f) {
  orcState.filter = f;
  orcRenderItens();
}

// ─── Dashboard ───────────────────────────────────────────────────────
function orcRenderDashboard() {
  const totOrc  = orcState.items.reduce((a,i) => {
    return a + i.valor_global * (1 - i.desconto_pct / 100);
  }, 0);
  const totComp = Object.values(orcState.totals).reduce((a,t) => a + (t.total_value||0), 0);
  const saldo   = totOrc - totComp;
  const pct     = totOrc > 0 ? Math.min(100, Math.round(totComp / totOrc * 100)) : 0;
  const cls     = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  const exc     = orcState.items.filter(i => orcItemStatus(i).status === 'danger');
  const warns   = orcState.items.filter(i => orcItemStatus(i).status === 'warn');

  const alertHtml = exc.length ? `
  <div class="orc-alert">
    <div class="orc-alert-title">⚠️ ATENÇÃO — ${exc.length} item(s) com valor EXCEDIDO</div>
    ${exc.map(it => {
      const s = orcItemStatus(it);
      const lot = it.numero_lote ? `Lote&nbsp;${escHtml(it.numero_lote)}/${escHtml(it.numero_item)}&nbsp;—&nbsp;` : '';
      return `<div class="orc-alert-item">
        <span style="font-size:15px">🔴</span>
        <div class="oai-name"><b>${lot}</b>${escHtml(it.descricao)}</div>
        <span class="oai-badge">+${(s.pct-100).toFixed(1)}% acima</span>
        <button class="orc-btn-icon teal" onclick="orcOpenCompraModal(${it.id})">Ver</button>
      </div>`;
    }).join('')}
  </div>` : '';

  const warnHtml = warns.length ? `
  <div style="background:#1a1200;border:1px solid #F59E0B40;border-radius:12px;padding:16px 20px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#FCD34D;margin-bottom:10px">
      🟡 ${warns.length} item(s) próximo(s) do limite (≥80%)
    </div>
    ${warns.map(it => {
      const s = orcItemStatus(it);
      return `<div class="orc-alert-item" style="border-bottom-color:#2a2000">
        <span style="font-size:15px">🟡</span>
        <div class="oai-name">${escHtml(it.descricao)}</div>
        <span class="orc-warn-badge">${s.pct.toFixed(1)}%</span>
        <button class="orc-btn-icon teal" onclick="orcOpenCompraModal(${it.id})">Comprar</button>
      </div>`;
    }).join('')}
  </div>` : '';

  const top5  = [...orcState.items].sort((a,b) => b.valor_global - a.valor_global).slice(0, 5);
  const el    = document.getElementById('orc-content');
  el.innerHTML = `
  <div class="orc-grid">
    <div class="orc-sum-card">
      <div class="osc-icon">💊</div>
      <div class="osc-val" style="color:var(--teal2)">${orcState.items.length}</div>
      <div class="osc-lbl">Itens</div>
    </div>
    <div class="orc-sum-card">
      <div class="osc-icon">💰</div>
      <div class="osc-val" style="color:var(--accent);font-size:15px">${fmtBRL(totOrc)}</div>
      <div class="osc-lbl">Total Orçado</div>
    </div>
    <div class="orc-sum-card ${saldo<0?'danger':'ok'}">
      <div class="osc-icon">${saldo<0?'⚠️':'✅'}</div>
      <div class="osc-val" style="font-size:15px;color:${saldo<0?'var(--danger)':'var(--ok)'}">${fmtBRL(totComp)}</div>
      <div class="osc-lbl">Total Comprado</div>
    </div>
    <div class="orc-sum-card ${saldo<0?'danger':''}">
      <div class="osc-icon">${saldo<0?'🔴':'💳'}</div>
      <div class="osc-val" style="font-size:15px;color:${saldo<0?'var(--danger)':'var(--ok)'}">${fmtBRL(saldo)}</div>
      <div class="osc-lbl">${saldo<0?'Saldo NEGATIVO':'Saldo Disponível'}</div>
    </div>
    <div class="orc-sum-card ${exc.length?'danger':''}">
      <div class="osc-icon">${exc.length?'🔴':'🟢'}</div>
      <div class="osc-val" style="color:${exc.length?'var(--danger)':'var(--ok)'}">${exc.length}</div>
      <div class="osc-lbl">Excedidos</div>
    </div>
    <div class="orc-sum-card ${warns.length?'warn':''}">
      <div class="osc-icon">${warns.length?'🟡':'🟢'}</div>
      <div class="osc-val" style="color:${warns.length?'var(--warn)':'var(--ok)'}">${warns.length}</div>
      <div class="osc-lbl">Alertas ≥80%</div>
    </div>
  </div>
  <div class="orc-prog-wrap">
    <div class="orc-prog-head">
      <span style="font-size:13px;font-weight:700">Execução Geral do Orçamento</span>
      <span style="font-size:20px;font-weight:800;color:${pct>=100?'var(--danger)':pct>=80?'var(--warn)':'var(--teal2)'}">${pct}%</span>
    </div>
    <div class="orc-prog-bar"><div class="orc-prog-fill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
    <div style="font-size:11px;color:var(--dim);margin-top:6px">${fmtBRL(totComp)} de ${fmtBRL(totOrc)} executados</div>
  </div>
  ${alertHtml}
  ${warnHtml}`;
}

function orcTopRow(it) {
  const s = orcItemStatus(it);
  const t = orcState.totals[it.id] || {};
  const lote = it.numero_lote ? `${escHtml(it.numero_lote)}/${escHtml(it.numero_item)}` : '—';
  return `<tr${s.status==='danger'?' class="excedido"':''}>
    <td style="color:var(--muted);font-weight:600;font-size:11px">${lote}</td>
    <td style="max-width:220px;font-size:12px">${escHtml(it.descricao)}</td>
    <td style="text-align:right">${fmtBRL(s.vd)}</td>
    <td style="text-align:right">${fmtBRL(t.total_value||0)}</td>
    <td style="min-width:100px">
      <div class="orc-mini-pct">${s.pct.toFixed(1)}%</div>
      <div class="orc-mini-bar"><div class="orc-mini-fill ${s.status}" style="width:${Math.min(100,s.pct)}%"></div></div>
    </td>
    <td>${orcStatusBadge(s.status, s.pct)}</td>
  </tr>`;
}

// ─── Items Tab ───────────────────────────────────────────────────────
function orcRenderItens() {
  const filterRow = [['all','Todos'],['ok','✅ Ok'],['warn','⚠️ Alerta'],['danger','🔴 Excedido']]
    .map(([v,l]) =>
      `<button class="orc-fbtn${orcState.filter===v?' active':''}" onclick="orcSetFilter('${v}')">${l}</button>`
    ).join('');
  const items = orcGetFiltered();
  const rows  = items.length
    ? items.map((it,i) => orcItemRow(it, i+1)).join('')
    : '<tr><td colspan="12" class="empty">Nenhum item.</td></tr>';
  document.getElementById('orc-content').innerHTML = `
  <div class="orc-filter-bar">
    <span style="font-size:12px;color:var(--dim);font-weight:600">Filtrar:</span>
    ${filterRow}
  </div>
  <div class="orc-tbl-wrap">
    <table>
      <thead><tr>
        <th>#</th><th>Lote</th><th>Item</th><th style="min-width:160px">Descrição</th>
        <th>Un.</th><th>Qtd.Sol.</th><th>Qtd.Comp.</th>
        <th>Vl.Orçado</th><th>Vl.Comprado</th><th>Desc%</th>
        <th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function orcItemRow(it, num) {
  const s = orcItemStatus(it);
  const t = orcState.totals[it.id] || {};
  return `<tr${s.status==='danger'?' class="excedido"':''}>
    <td style="color:var(--dim)">${num}</td>
    <td style="color:var(--muted);font-weight:600;font-size:11px">${escHtml(it.numero_lote||'—')}</td>
    <td style="color:var(--muted);font-weight:600;font-size:11px">${escHtml(it.numero_item||'—')}</td>
    <td style="max-width:230px;font-size:12px">
      ${escHtml(it.descricao)}
      ${it.fornecedor?`<div style="font-size:10px;color:var(--teal2);margin-top:3px">🏭 ${escHtml(it.fornecedor)}</div>`:''}
      ${it.created_at?`<div style="font-size:10px;color:var(--dim);margin-top:1px">📅 ${fmtDate(it.created_at)}</div>`:''}
      ${it.observacoes?`<div style="font-size:10px;color:var(--dim);margin-top:2px">${escHtml(it.observacoes)}</div>`:''}
    </td>
    <td style="color:var(--muted);font-size:11px">${escHtml(it.unidade)}</td>
    <td style="text-align:right">${fmtNum(it.quantidade)}</td>
    <td style="text-align:right">
      ${fmtNum(t.total_qty||0)}
      <div class="orc-mini-bar"><div class="orc-mini-fill ${s.status}" style="width:${Math.min(100,s.pq)}%"></div></div>
      <div class="orc-mini-pct">${s.pq.toFixed(1)}%</div>
    </td>
    <td style="text-align:right">
      ${fmtBRL(s.vd)}
      ${it.desconto_pct>0?`<div style="font-size:10px;color:var(--dim)">(bruto&nbsp;${fmtBRL(it.valor_global)})</div>`:''}
    </td>
    <td style="text-align:right">
      ${fmtBRL(t.total_value||0)}
      <div class="orc-mini-bar"><div class="orc-mini-fill ${s.status}" style="width:${Math.min(100,s.pv)}%"></div></div>
      <div class="orc-mini-pct">${s.pv.toFixed(1)}%</div>
    </td>
    <td style="text-align:center;color:${it.desconto_pct>0?'var(--ok)':'var(--dim)'}">${it.desconto_pct>0?it.desconto_pct.toFixed(1)+'%':'—'}</td>
    <td>${orcStatusBadge(s.status,s.pct)}</td>
    <td>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-list')">👥 Ver Lista</button>
        <button class="orc-btn-icon teal" onclick="orcOpenDetalhes(${it.id})"    title="Histórico">📋</button>
        <button class="orc-btn-icon"      onclick="orcOpenItemModal(${it.id})"   title="Editar">✏️</button>
        <button class="orc-btn-icon red"  onclick="orcDeleteItem(${it.id})"      title="Excluir">🗑️</button>
      </div>
    </td>
  </tr>`;
}

function orcRenderSearch() {
  const items = orcGetFiltered();
  const rows  = items.length
    ? items.map((it,i) => orcItemRow(it,i+1)).join('')
    : '<tr><td colspan="12" class="empty">Nenhum resultado.</td></tr>';
  const el = document.getElementById('orc-content');
  if (el) el.innerHTML = `
  <div style="font-size:13px;color:var(--muted);margin-bottom:12px">
    🔍 "${escHtml(orcState.search)}" — ${items.length} resultado(s)
  </div>
  <div class="orc-tbl-wrap">
    <table>
      <thead><tr>
        <th>#</th><th>Lote</th><th>Item</th><th>Descrição</th>
        <th>Un.</th><th>Qtd.Sol.</th><th>Qtd.Comp.</th>
        <th>Vl.Orçado</th><th>Vl.Comprado</th><th>Desc%</th>
        <th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

async function orcRenderComprasTab() {
  const el = document.getElementById('orc-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Carregando compras…</div>';
  const r = await api('orc_compras');
  if (!r.ok) { el.innerHTML = '<div class="empty">Erro ao carregar.</div>'; return; }
  const rows = r.compras || [];
  if (!rows.length) {
    el.innerHTML = '<div class="empty">Nenhuma compra registrada.<br>Acesse 💊 Medicamentos e clique em 🛒 para registrar.</div>';
    return;
  }
  const totVal = rows.reduce((a,c) => a + (c.valor_total||0), 0);
  el.innerHTML = `
  <div style="font-size:12px;color:var(--muted);margin-bottom:14px">
    ${rows.length} registros · Total: <b style="color:var(--text)">${fmtBRL(totVal)}</b>
  </div>
  <div class="orc-tbl-wrap">
    <table>
      <thead><tr>
        <th>Data</th><th>Lote/Item</th><th>Descrição</th><th>Fornecedor</th>
        <th>Processo</th><th>Qtd.</th><th>Valor Total</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(c => {
          const lotTxt = c.numero_lote ? escHtml(c.numero_lote+'/'+c.numero_item) : '—';
          return `<tr>
            <td style="font-size:11px;color:var(--dim)">${orcFmtDate(c.data_compra)}</td>
            <td style="color:var(--muted);font-size:11px;font-weight:600">${lotTxt}</td>
            <td style="max-width:200px;font-size:12px">${escHtml(c.descricao||'—')}</td>
            <td style="color:var(--muted)">${escHtml(c.fornecedor||'—')}</td>
            <td style="color:var(--muted)">${escHtml(c.num_processo||'—')}</td>
            <td style="text-align:right">${fmtNum(c.quantidade)}</td>
            <td style="text-align:right">${fmtBRL(c.valor_total)}</td>
            <td><button class="orc-btn-icon red" onclick="orcDeleteCompra(${c.id},${c.item_id})">🗑️</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ─── Relatório de Notas Fiscais ──────────────────────────────────────
async function orcRenderRelatorioNFs() {
  const el = document.getElementById('orc-content');
  el.innerHTML = '<div class="loading">Carregando relatório…</div>';
  const r = await api('orc_notas');
  if (!r.ok) { el.innerHTML = '<div class="empty">Erro ao carregar notas.</div>'; return; }
  const notas = r.notas || [];
  if (!notas.length) {
    el.innerHTML = '<div class="empty">Nenhuma nota fiscal lançada ainda.</div>';
    return;
  }

  function extrairProcesso(obs) {
    if (!obs) return 'Sem processo';
    const m = obs.match(/PROCESSO\s+ADMINISTRATIVO\s+N[.º°]?\s*([\d\/\.]+)/i);
    if (m) return 'Processo ' + m[1].replace(/\.$/, '');
    const m2 = obs.match(/PREGAO[^N]*N[.º°]?\s*([\d\/\.]+)/i);
    if (m2) return 'Pregão ' + m2[1].replace(/\.$/, '');
    return obs.substring(0, 60);
  }

  function extrairPregao(obs) {
    if (!obs) return '';
    const m = obs.match(/PREGAO\s+ELETRONICO\s+N[.º°]?\s*([\d\/\.]+)/i);
    return m ? m[1].replace(/\.$/, '') : '';
  }

  function extrairDestino(obs) {
    if (!obs) return '';
    if (/MAC/i.test(obs)) return 'MAC';
    if (/PAP/i.test(obs)) return 'PAP';
    if (/ADITIVO/i.test(obs)) return 'PAP-ADITIVO';
    return '';
  }

  const grupos = {};
  notas.forEach(n => {
    const proc = extrairProcesso(n.observacoes);
    const preg = extrairPregao(n.observacoes);
    if (!grupos[proc]) grupos[proc] = { pregao: preg, fornecedores: {}, total: 0 };
    const forn = n.fornecedor || 'Fornecedor não informado';
    if (!grupos[proc].fornecedores[forn]) grupos[proc].fornecedores[forn] = { cnpj: n.cnpj_fornecedor || '', notas: [], subtotal: 0 };
    grupos[proc].fornecedores[forn].notas.push(n);
    grupos[proc].fornecedores[forn].subtotal += (n.valor_total_real || n.valor_total || 0);
    grupos[proc].total += (n.valor_total_real || n.valor_total || 0);
  });

  const totalGeral = notas.reduce((s, n) => s + (n.valor_total_real || n.valor_total || 0), 0);
  const totalNotas = notas.length;

  const CORES = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#06B6D4'];
  let cIdx = 0;
  const corForn = {};
  notas.forEach(n => {
    if (n.fornecedor && !corForn[n.fornecedor]) {
      corForn[n.fornecedor] = CORES[cIdx % CORES.length];
      cIdx++;
    }
  });

  window._rnfRelData = { notas, grupos, corForn, totalGeral, totalNotas };

  const totalSemMatch = notas.reduce((s, n) => s + (n.sem_match_count || 0), 0);
  let html = `
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px;align-items:flex-start">
    <div style="flex:1;display:flex;gap:14px;flex-wrap:wrap">
      <div class="orc-sum-card"><div class="osc-icon">🧾</div><div class="osc-val">${totalNotas}</div><div class="osc-lbl">Total de NFs</div></div>
      <div class="orc-sum-card"><div class="osc-icon">🏭</div><div class="osc-val">${Object.keys(corForn).length}</div><div class="osc-lbl">Fornecedores</div></div>
      <div class="orc-sum-card"><div class="osc-icon">📂</div><div class="osc-val">${Object.keys(grupos).length}</div><div class="osc-lbl">Processos</div></div>
      <div class="orc-sum-card" style="border-color:#10B98150"><div class="osc-icon">💰</div><div class="osc-val" style="color:#10B981;font-size:15px">${fmtBRL(totalGeral)}</div><div class="osc-lbl">Valor Total Geral</div></div>
      ${totalSemMatch > 0 ? `<div class="orc-sum-card" style="border-color:#991b1b50"><div class="osc-icon">⚠️</div><div class="osc-val" style="color:#FCA5A5">${totalSemMatch}</div><div class="osc-lbl">Itens S/ Match</div></div>` : ''}
    </div>
    <div><button onclick="orcRelatorioNFsPDF()" style="padding:10px 18px;border-radius:8px;background:#1e3a5f;color:#93C5FD;border:1px solid #2563EB;cursor:pointer;font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px">📄 PDF</button></div>
  </div>`;

  for (const [proc, gData] of Object.entries(grupos)) {
    const qtdNFs = Object.values(gData.fornecedores).reduce((s, f) => s + f.notas.length, 0);
    html += `
  <div class="rnf-processo">
    <div class="rnf-proc-header">
      <div class="rnf-proc-title">
        <span class="rnf-proc-icon">📂</span>
        <span>${escHtml(proc)}</span>
        ${gData.pregao ? `<span class="rnf-proc-badge">Pregão ${escHtml(gData.pregao)}</span>` : ''}
      </div>
      <div style="display:flex;gap:20px;align-items:center">
        <span style="font-size:12px;color:var(--dim)">${qtdNFs} nota${qtdNFs!==1?'s':''}</span>
        <span class="rnf-proc-total">${fmtBRL(gData.total)}</span>
      </div>
    </div>`;

    for (const [forn, fData] of Object.entries(gData.fornecedores)) {
      const cor = corForn[forn] || '#64748B';
      const fornNotas = fData.notas.sort((a,b) => a.numero_nota.localeCompare(b.numero_nota));
      html += `
    <div class="rnf-fornecedor">
      <div class="rnf-forn-header" style="border-left:4px solid ${cor}">
        <div>
          <div class="rnf-forn-nome" style="color:${cor}">🏭 ${escHtml(forn)}</div>
          ${fData.cnpj ? `<div class="rnf-forn-cnpj">CNPJ: ${escHtml(fData.cnpj)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="rnf-forn-subtotal" style="color:${cor}">${fmtBRL(fData.subtotal)}</div>
          <div style="font-size:11px;color:var(--dim)">${fData.notas.length} nota${fData.notas.length!==1?'s':''}</div>
        </div>
      </div>
      <table class="rnf-table">
        <thead>
          <tr>
            <th>Nota Fiscal</th>
            <th>Data Emissão</th>
            <th>Destino</th>
            <th>Itens</th>
            <th>⚠️ S/Match</th>
            <th style="text-align:right">Valor Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;

      let linhaIdx = 0;
      for (const n of fornNotas) {
        const dest = extrairDestino(n.observacoes);
        const destBadge = dest ? `<span class="rnf-dest-badge rnf-dest-${dest.toLowerCase().replace('-','_')}">${dest}</span>` : '';
        const semMatchCnt = n.sem_match_count || 0;
        const semMatchCell = semMatchCnt > 0
          ? `<span style="background:#7c2d12;color:#FCA5A5;border:1px solid #991b1b;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700">⚠️ ${semMatchCnt}</span>`
          : `<span style="color:var(--dim);font-size:11px">—</span>`;
        html += `
          <tr class="rnf-row${linhaIdx%2===1?' rnf-row-alt':''}">
            <td><span class="rnf-nf-num">NF ${escHtml(n.numero_nota)}</span>${n.serie?' <span class="rnf-serie">Série '+escHtml(n.serie)+'</span>':''}</td>
            <td>${n.data_emissao ? fmtDateOnly(n.data_emissao) : '—'}</td>
            <td>${destBadge}</td>
            <td><span class="rnf-itens-cnt">${n.num_compras || 0}</span></td>
            <td>${semMatchCell}</td>
            <td style="text-align:right"><span class="rnf-valor">${fmtBRL(n.valor_total_real || n.valor_total)}</span></td>
            <td><button class="btn-nf-detail" onclick="nfOpenDetail(${n.id})" style="padding:4px 10px;font-size:11px">📋 Ver</button></td>
          </tr>`;
        linhaIdx++;
      }

      html += `
        </tbody>
        <tfoot>
          <tr class="rnf-subtotal-row">
            <td colspan="5" style="text-align:right;font-weight:700;color:var(--dim);font-size:12px;padding-right:12px">Subtotal ${escHtml(forn)}:</td>
            <td style="text-align:right"><span class="rnf-subtotal-val" style="color:${cor}">${fmtBRL(fData.subtotal)}</span></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
    }

    html += `
    <div class="rnf-proc-footer">
      <span>Total do Processo</span>
      <span class="rnf-proc-footer-val">${fmtBRL(gData.total)}</span>
    </div>
  </div>`;
  }

  html += `
  <div class="rnf-total-geral">
    <span>💰 TOTAL GERAL — ${totalNotas} Notas Fiscais · ${Object.keys(grupos).length} Processo${Object.keys(grupos).length!==1?'s':''}</span>
    <span class="rnf-total-geral-val">${fmtBRL(totalGeral)}</span>
  </div>`;

  el.innerHTML = html;
}

// ─── PDF — Relatório de NFs ─────────────────────────────────────────
function orcRelatorioNFsPDF() {
  const d = window._rnfRelData;
  if (!d) { toast('Abra a aba Relatório de NFs primeiro.', 'error'); return; }
  const { notas, grupos, corForn, totalGeral, totalNotas } = d;

  function extrairDestino(obs) {
    if (!obs) return '';
    if (/MAC/i.test(obs)) return 'MAC';
    if (/PAP/i.test(obs)) return 'PAP';
    return '';
  }

  const totalSemMatch = notas.reduce((s, n) => s + (n.sem_match_count || 0), 0);
  const sections = [];

  sections.push({ type: 'header',
    title: 'Relatório de Notas Fiscais',
    subtitle: 'PREGÃO 023/2025 · PROCESSO ADMINISTRATIVO 078/2025',
    right: `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    color: [13, 34, 64]
  });
  sections.push({ type: 'cards', items: [
    { label: 'Total de NFs',    value: totalNotas,                       color: [13, 34, 64] },
    { label: 'Fornecedores',    value: Object.keys(corForn).length,      color: [8, 106, 130] },
    { label: 'Processos',       value: Object.keys(grupos).length,        color: [8, 106, 130] },
    { label: 'Itens S/ Match',  value: totalSemMatch || '0',              color: [153, 27, 27] },
    { label: 'Valor Total',     value: fmtBRL(totalGeral),                color: [6, 95, 70] },
  ]});

  for (const [proc, gData] of Object.entries(grupos)) {
    sections.push({ type: 'section-title', text: `📂 ${proc}` });
    for (const [forn, fData] of Object.entries(gData.fornecedores)) {
      sections.push({ type: 'org-header',
        name: forn,
        sub: fData.cnpj ? `CNPJ: ${fData.cnpj}` : '',
        right: fmtBRL(fData.subtotal),
        right2: `${fData.notas.length} nota${fData.notas.length!==1?'s':''}`,
        color: [13, 34, 64]
      });
      const sortedNotas = [...fData.notas].sort((a,b) => a.numero_nota.localeCompare(b.numero_nota));
      const body = sortedNotas.map(n => {
        const dest = extrairDestino(n.observacoes);
        const smCnt = n.sem_match_count || 0;
        return [
          `NF ${n.numero_nota}${n.serie?' S.'+n.serie:''}`,
          n.data_emissao ? (n.data_emissao+'').substring(0,10).split('-').reverse().join('/') : '—',
          dest || '—',
          String(n.num_compras || 0),
          smCnt > 0 ? `⚠️ ${smCnt}` : '—',
          { content: fmtBRL(n.valor_total_real || n.valor_total), styles: { halign: 'right', fontStyle: 'bold' } }
        ];
      });
      body.push([
        { content: `Subtotal ${forn}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240,244,248] } },
        { content: fmtBRL(fData.subtotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240,244,248] } }
      ]);
      sections.push({ type: 'table',
        head: [['Nota Fiscal', 'Data', 'Destino', 'Itens', 'S/Match', 'Valor Total']],
        body,
        fontSize: 8
      });
    }
    sections.push({ type: 'total-block',
      label: `Total do Processo: ${proc}`,
      value: fmtBRL(gData.total),
      color: [13, 34, 64]
    });
  }
  sections.push({ type: 'total-block',
    label: `TOTAL GERAL — ${totalNotas} Notas Fiscais`,
    meta: `${Object.keys(grupos).length} processo${Object.keys(grupos).length!==1?'s':''}`,
    value: fmtBRL(totalGeral),
    color: [6, 78, 59]
  });

  _downloadPdf({ orientation: 'portrait', sections });
}

// ─── ORC Modal ───────────────────────────────────────────────────────
function orcOpenModal()  { document.getElementById('orc-modal-overlay').style.display = 'flex'; }
function orcCloseModal() { document.getElementById('orc-modal-overlay').style.display = 'none'; }

// ─── Item Modal ───────────────────────────────────────────────────────
function orcOpenItemModal(id) {
  const it = id ? orcState.items.find(i => i.id == id) : null;
  document.getElementById('orc-modal-title').textContent = it ? '✏️ Editar Item' : '➕ Novo Medicamento';
  document.getElementById('orc-modal-sub').textContent   = it ? it.descricao : 'Preencha os dados do medicamento/material';
  document.getElementById('orc-modal-body').innerHTML = `
  <div class="form-grid">
    <div class="form-group">
      <label>Nº Lote</label>
      <input type="text" id="f-lote" placeholder="01" value="${escHtml(it?.numero_lote||'')}">
    </div>
    <div class="form-group">
      <label>Nº Item</label>
      <input type="text" id="f-item" placeholder="01" value="${escHtml(it?.numero_item||'')}">
    </div>
    <div class="form-group full">
      <label>Descrição do Medicamento *</label>
      <input type="text" id="f-desc" placeholder="Ex: PARACETAMOL 500MG comprimido"
             value="${escHtml(it?.descricao||'')}">
    </div>
    <div class="form-group">
      <label>Quantidade Solicitada *</label>
      <input type="number" id="f-qty" placeholder="0" min="0" step="0.001"
             value="${it?.quantidade||''}" oninput="orcCalcGlobal()">
    </div>
    <div class="form-group">
      <label>Unidade</label>
      <input type="text" id="f-un" placeholder="UN / CX / FR"
             value="${escHtml(it?.unidade||'UN')}" style="text-transform:uppercase">
    </div>
    <div class="form-group">
      <label>Valor Unitário (R$) *</label>
      <input type="number" id="f-vun" placeholder="0,00" min="0" step="0.01"
             value="${it?.valor_unitario||''}" oninput="orcCalcGlobal()">
    </div>
    <div class="form-group">
      <label>Desconto (%)</label>
      <input type="number" id="f-dpct" placeholder="0,00" min="0" max="100" step="0.01"
             value="${it?.desconto_pct||0}" oninput="orcCalcGlobal()">
    </div>
    <div class="form-group">
      <label>Valor Global (R$)</label>
      <input type="number" id="f-vglb" placeholder="Auto" min="0" step="0.01"
             value="${it?.valor_global||''}">
    </div>
    <div class="form-group full"
         style="background:#0f172a;border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted)">
      Valor final c/ desconto: <b id="f-vfinal" style="color:var(--teal2)">—</b>
    </div>
    <div class="form-group full">
      <label>Observações</label>
      <textarea id="f-obs" placeholder="Observações, especificações…">${escHtml(it?.observacoes||'')}</textarea>
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-cancel" onclick="orcCloseModal()">Cancelar</button>
    <button class="btn-save"   onclick="orcSaveItem(${id||0})">💾 Salvar</button>
  </div>`;
  orcCalcGlobal();
  orcOpenModal();
}

function orcCalcGlobal() {
  const qty  = parseFloat(document.getElementById('f-qty')?.value)  || 0;
  const vun  = parseFloat(document.getElementById('f-vun')?.value)  || 0;
  const disc = parseFloat(document.getElementById('f-dpct')?.value) || 0;
  const vglb = document.getElementById('f-vglb');
  if (vglb && qty > 0 && vun > 0) vglb.value = (qty * vun).toFixed(2);
  const finalGlb = parseFloat(vglb?.value) || (qty * vun);
  const vfinal   = finalGlb * (1 - disc / 100);
  const el = document.getElementById('f-vfinal');
  if (el) el.textContent = vfinal > 0 ? fmtBRL(vfinal) : '—';
}

async function orcSaveItem(id) {
  const btn  = document.querySelector('#orc-modal .btn-save');
  const desc = document.getElementById('f-desc').value.trim();
  if (!desc) { toast('Descrição obrigatória', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Salvando…';
  const body = {
    id,
    numero_lote:    document.getElementById('f-lote').value.trim(),
    numero_item:    document.getElementById('f-item').value.trim(),
    descricao:      desc,
    quantidade:     document.getElementById('f-qty').value,
    unidade:        document.getElementById('f-un').value.trim().toUpperCase() || 'UN',
    valor_unitario: document.getElementById('f-vun').value,
    valor_global:   document.getElementById('f-vglb').value,
    desconto_pct:   document.getElementById('f-dpct').value,
    observacoes:    document.getElementById('f-obs').value.trim(),
  };
  const r = await api(id ? 'orc_edit_item' : 'orc_add_item', body);
  btn.disabled = false; btn.textContent = '💾 Salvar';
  if (r.ok) {
    orcCloseModal();
    orcState.loaded = false;
    await orcLoadData();
    orcBuildLayout();
    orcRenderTab();
    orcUpdateSidebarBadge();
    toast(id ? 'Medicamento atualizado!' : 'Medicamento adicionado!');
  } else {
    toast(r.error || 'Erro ao salvar', 'error');
  }
}

async function orcDeleteItem(id) {
  const it = orcState.items.find(i => i.id == id);
  if (!confirm(`Excluir "${it?.descricao}"?\nIsso removerá também todas as compras vinculadas.`)) return;
  const r = await api('orc_delete_item', { id });
  if (r.ok) {
    orcState.loaded = false;
    await orcLoadData();
    orcBuildLayout();
    orcRenderTab();
    orcUpdateSidebarBadge();
    toast('Item excluído.');
  } else toast(r.error || 'Erro', 'error');
}

// ─── Compra Modal ─────────────────────────────────────────────────────
function orcOpenCompraModal(itemId) {
  const it = orcState.items.find(i => i.id == itemId);
  if (!it) return;
  const t  = orcState.totals[itemId] || {};
  const s  = orcItemStatus(it);
  const vd = s.vd;
  const saldoQty = it.quantidade - (t.total_qty  || 0);
  const saldoVal = vd            - (t.total_value|| 0);

  document.getElementById('orc-modal-title').textContent = '🛒 Registrar Compra';
  document.getElementById('orc-modal-sub').textContent   = it.descricao;
  document.getElementById('orc-modal-body').innerHTML = `
  <div class="orc-budget-status">
    <div class="orc-bs-row"><span>Qtd. orçada</span>       <span>${fmtNum(it.quantidade)} ${escHtml(it.unidade)}</span></div>
    <div class="orc-bs-row"><span>Já comprado (qtd)</span> <span>${fmtNum(t.total_qty||0)} ${escHtml(it.unidade)}</span></div>
    <div class="orc-bs-row"><span>Saldo qtd.</span>
      <span style="color:${saldoQty<0?'var(--danger)':'var(--ok)'}">${fmtNum(saldoQty)} ${escHtml(it.unidade)}</span></div>
    <hr style="border-color:var(--border);margin:8px 0">
    <div class="orc-bs-row"><span>Vl. orçado (c/ desc.)</span> <span>${fmtBRL(vd)}</span></div>
    <div class="orc-bs-row"><span>Já comprado (valor)</span>   <span>${fmtBRL(t.total_value||0)}</span></div>
    <div class="orc-bs-row"><span>Saldo valor</span>
      <span style="color:${saldoVal<0?'var(--danger)':'var(--ok)'}">${fmtBRL(saldoVal)}</span></div>
    ${s.status==='danger'?`<div class="orc-exceed-warn" style="display:block">⚠️ Este item já ultrapassou o orçado! (${s.pct.toFixed(1)}%)</div>`:''}
  </div>
  <div class="form-grid">
    <div class="form-group">
      <label>Data da Compra</label>
      <input type="date" id="c-data" value="${new Date().toISOString().slice(0,10)}">
    </div>
    <div class="form-group">
      <label>Nº Processo / Empenho</label>
      <input type="text" id="c-proc" placeholder="2026/0001">
    </div>
    <div class="form-group full">
      <label>Fornecedor</label>
      <input type="text" id="c-forn" placeholder="Nome do fornecedor">
    </div>
    <div class="form-group">
      <label>Quantidade Comprada *</label>
      <input type="number" id="c-qty" placeholder="0" min="0.001" step="0.001"
             oninput="orcCalcCompraTotal(${vd},${t.total_value||0})">
    </div>
    <div class="form-group">
      <label>Valor Unitário (R$)</label>
      <input type="number" id="c-vun" placeholder="0,00" min="0" step="0.01"
             oninput="orcCalcCompraTotal(${vd},${t.total_value||0})">
    </div>
    <div class="form-group full">
      <label>Valor Total da Compra (R$) *</label>
      <input type="number" id="c-vtot" placeholder="0,00" min="0" step="0.01"
             oninput="orcCheckExceed(${vd},${t.total_value||0})">
    </div>
    <div class="orc-exceed-warn" id="c-exceed" style="grid-column:1/-1">
      ⚠️ ATENÇÃO: Esta compra ultrapassará o valor orçado disponível!
    </div>
    <div class="form-group full">
      <label>Observações</label>
      <textarea id="c-obs" placeholder="Observações…"></textarea>
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-cancel" onclick="orcCloseModal()">Cancelar</button>
    <button class="btn-save" id="c-save" onclick="orcSaveCompra(${itemId},${vd})">💾 Registrar</button>
  </div>`;
  orcOpenModal();
}

function orcCalcCompraTotal(vd, alreadySpent) {
  const qty  = parseFloat(document.getElementById('c-qty')?.value)  || 0;
  const vun  = parseFloat(document.getElementById('c-vun')?.value)  || 0;
  const vtot = document.getElementById('c-vtot');
  if (vtot && qty > 0 && vun > 0) vtot.value = (qty * vun).toFixed(2);
  orcCheckExceed(vd, alreadySpent);
}

function orcCheckExceed(vd, alreadySpent) {
  const vtot = parseFloat(document.getElementById('c-vtot')?.value) || 0;
  const warn = document.getElementById('c-exceed');
  if (warn) warn.style.display = (alreadySpent + vtot) > vd ? 'block' : 'none';
}

async function orcSaveCompra(itemId, vd) {
  const btn  = document.getElementById('c-save');
  const qty  = parseFloat(document.getElementById('c-qty').value);
  const vtot = parseFloat(document.getElementById('c-vtot').value);
  if (!qty || qty <= 0) { toast('Informe a quantidade', 'error'); return; }
  if (vtot === undefined || vtot < 0) { toast('Informe o valor total', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Salvando…';
  const body = {
    item_id:      itemId,
    data_compra:  document.getElementById('c-data').value,
    fornecedor:   document.getElementById('c-forn').value.trim(),
    num_processo: document.getElementById('c-proc').value.trim(),
    quantidade:   qty,
    valor_total:  vtot,
    observacoes:  document.getElementById('c-obs').value.trim(),
  };
  const r = await api('orc_add_compra', body);
  btn.disabled = false; btn.textContent = '💾 Registrar';
  if (r.ok) {
    orcState.totals[itemId] = {
      total_qty:   r.total_qty,
      total_value: r.total_value,
      num_compras: (orcState.totals[itemId]?.num_compras || 0) + 1,
    };
    orcCloseModal();
    orcBuildLayout();
    orcRenderTab();
    orcUpdateSidebarBadge();
    const s = orcItemStatus(orcState.items.find(i => i.id == itemId));
    if (s.status === 'danger') toast(`⚠️ Valor EXCEDIDO em ${(s.pct-100).toFixed(1)}%!`, 'error');
    else toast('Compra registrada!' + (s.status==='warn'?' ⚠️ Próximo do limite.':''));
  } else {
    toast(r.error || 'Erro ao registrar', 'error');
  }
}

// ─── Detalhes Modal ───────────────────────────────────────────────────
async function orcOpenDetalhes(itemId) {
  const it = orcState.items.find(i => i.id == itemId);
  if (!it) return;
  const t = orcState.totals[itemId] || {};
  const s = orcItemStatus(it);
  document.getElementById('orc-modal-title').textContent = '📋 Histórico de Compras';
  document.getElementById('orc-modal-sub').textContent   = it.descricao;
  document.getElementById('orc-modal-body').innerHTML    = '<div class="loading">Carregando…</div>';
  orcOpenModal();

  const r = await api('orc_compras&item_id=' + itemId);
  if (!r.ok) {
    document.getElementById('orc-modal-body').innerHTML = '<div class="empty">Erro ao carregar.</div>';
    return;
  }
  const compras = r.compras || [];
  const rows = compras.length
    ? compras.map(c => `<tr>
        <td>${orcFmtDate(c.data_compra)}</td>
        <td>${escHtml(c.fornecedor||'—')}</td>
        <td>${escHtml(c.num_processo||'—')}</td>
        <td style="text-align:right">${fmtNum(c.quantidade)}&nbsp;${escHtml(it.unidade)}</td>
        <td style="text-align:right">${fmtBRL(c.valor_total)}</td>
        <td style="font-size:11px;color:var(--dim)">${escHtml(c.observacoes||'')}</td>
        <td><button class="orc-btn-icon red" onclick="orcDeleteCompra(${c.id},${itemId})">🗑️</button></td>
      </tr>`).join('') +
      `<tr class="orc-det-total">
        <td colspan="3"><b>TOTAL</b></td>
        <td style="text-align:right"><b>${fmtNum(t.total_qty||0)}</b></td>
        <td style="text-align:right"><b>${fmtBRL(t.total_value||0)}</b></td>
        <td colspan="2"></td>
      </tr>`
    : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--dim)">Nenhuma compra registrada.</td></tr>';

  document.getElementById('orc-modal-body').innerHTML = `
  <div class="orc-budget-status" style="margin-bottom:14px">
    <div class="orc-bs-row"><span>Qtd. orçada</span>    <span>${fmtNum(it.quantidade)} ${escHtml(it.unidade)}</span></div>
    <div class="orc-bs-row"><span>Qtd. comprada</span>  <span>${fmtNum(t.total_qty||0)}</span></div>
    <div class="orc-bs-row"><span>Valor orçado</span>   <span>${fmtBRL(s.vd)}</span></div>
    <div class="orc-bs-row"><span>Valor comprado</span> <span>${fmtBRL(t.total_value||0)}</span></div>
    <div class="orc-bs-row"><span>Execução</span>
      <span style="color:${s.status==='danger'?'var(--danger)':s.status==='warn'?'var(--warn)':'var(--ok)'}">
        ${s.pct.toFixed(1)}% ${s.status==='danger'?'⚠️ EXCEDIDO':''}
      </span>
    </div>
  </div>
  <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
    <table class="orc-det-table">
      <thead><tr><th>Data</th><th>Fornecedor</th><th>Processo</th><th>Qtd.</th><th>Valor</th><th>Obs.</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="modal-actions">
    <button class="btn-cancel" onclick="orcCloseModal()">Fechar</button>
    <button class="btn-save"   onclick="orcCloseModal();orcOpenCompraModal(${itemId})">🛒 Nova Compra</button>
  </div>`;
}

async function orcDeleteCompra(id, itemId) {
  if (!confirm('Excluir esta compra?')) return;
  const r = await api('orc_delete_compra', { id });
  if (r.ok) {
    orcState.totals[itemId] = {
      total_qty:   r.total_qty,
      total_value: r.total_value,
      num_compras: Math.max(0, (orcState.totals[itemId]?.num_compras||1) - 1),
    };
    orcCloseModal();
    orcBuildLayout();
    orcRenderTab();
    orcUpdateSidebarBadge();
    toast('Compra excluída.');
  } else toast(r.error || 'Erro', 'error');
}