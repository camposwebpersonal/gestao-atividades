// ─── Contas Module ────────────────────────────────────────────
let contasCurTab   = 'luz';
let contasInst     = [];
let contasSelInst  = null;
let contasChart    = null;
const contasIcons  = {luz:'⚡',agua:'💧',internet:'🌐',aluguel:'🏠'};
const contasColors = {luz:'#f59e0b',agua:'#06b6d4',internet:'#8b5cf6',aluguel:'#22c55e'};
const contasTabTitles = {luz:'Contas de Energia Elétrica',agua:'Contas de Água',internet:'Contas de Internet',aluguel:'Imóveis Alugados'};
const contasFmtBRL = v => 'R$\u00a0' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const contasFmtD   = d => { if (!d) return '—'; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
const contasEscH   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function renderContas() {
  setActiveNav('nav-contas');
  const yr = new Date().getFullYear();
  const yrs = [];
  for (let y = 2023; y <= yr; y++) yrs.push(`<option value="${y}"${y===yr?' selected':''}>${y}</option>`);
  document.getElementById('content').innerHTML = `
  <div style="padding:24px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <div class="page-title">💡 Gestão de Contas</div>
        <div class="page-sub">Água · Luz · Internet · Aluguel — Sertânia / PE</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="contas_pdf.php?tipo=all&inicio=2023-01&fim=${yr}-12" target="_blank"
          style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;border-radius:8px;font-size:.82rem;font-weight:700;text-decoration:none">
          📄 Relatório PDF
        </a>
        <button onclick="contasOpenNovaInst()"
          style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer">
          + Nova Instalação
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="contas-cards" id="contas-cards">
      ${['luz','agua','internet','aluguel'].map(t=>`
      <div class="contas-cat-card" data-tipo="${t}" onclick="contasSetTab('${t}')">
        <span class="contas-cc-badge" id="contas-badge-${t}" style="background:${contasColors[t]}20;color:${contasColors[t]}">—</span>
        <div class="contas-cc-icon">${contasIcons[t]}</div>
        <div class="contas-cc-name">${t==='agua'?'Água':t==='internet'?'Internet':t==='aluguel'?'Aluguéis':'Energia Elétrica'}</div>
        <div class="contas-cc-total" id="contas-total-${t}">R$ 0,00</div>
        <div class="contas-cc-sub"  id="contas-sub-${t}">Carregando…</div>
      </div>`).join('')}
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:4px;margin-bottom:18px;flex-wrap:wrap">
      <button class="filter-btn active" id="ctab-luz"        onclick="contasSetTab('luz')">⚡ Luz</button>
      <button class="filter-btn"        id="ctab-agua"       onclick="contasSetTab('agua')">💧 Água</button>
      <button class="filter-btn"        id="ctab-internet"   onclick="contasSetTab('internet')">🌐 Internet</button>
      <button class="filter-btn"        id="ctab-aluguel"    onclick="contasSetTab('aluguel')">🏠 Aluguel</button>
      <button class="filter-btn"        id="ctab-relatorios" onclick="contasSetTab('relatorios')">📊 Relatórios</button>
    </div>
  </div>

  <!-- Main split layout -->
  <div id="contas-main" style="display:grid;grid-template-columns:1fr 380px;gap:16px;padding:0 24px 40px">
    <!-- Left: instalações -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)">
        <span style="font-size:.95rem;font-weight:700;color:var(--text)" id="contas-panel-title">Contas de Energia Elétrica</span>
        <div style="display:flex;gap:6px">
          <input type="text" id="contas-search" placeholder="🔍 Pesquisar…"
            style="padding:5px 10px;font-size:.78rem;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);width:160px"
            oninput="contasFilterInst()">
          <button onclick="contasOpenNovaFatura()"
            style="padding:5px 12px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer">
            + Fatura
          </button>
        </div>
      </div>
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;gap:8px;background:#0f172a">
        <select id="contas-filtro-ug" onchange="contasRenderInst()"
          style="font-size:.78rem;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text)">
          <option value="">Todas as unidades</option>
        </select>
        <span style="flex:1"></span>
        <button onclick="contasOpenNovaInst()"
          style="padding:5px 10px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:7px;font-size:.75rem;cursor:pointer">
          + Instalação
        </button>
      </div>
      <div id="contas-inst-list" style="max-height:520px;overflow-y:auto">
        <div style="text-align:center;padding:32px;color:var(--muted);font-size:.85rem">Carregando…</div>
      </div>
    </div>

    <!-- Right panel -->
    <div style="display:flex;flex-direction:column;gap:14px">
      <!-- Faturas da instalação selecionada -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)">
          <span style="font-size:.9rem;font-weight:700;color:var(--text)" id="contas-fat-title">Selecione uma instalação</span>
          <button id="contas-btn-add-fat" onclick="contasOpenNovaFatura()" disabled
            style="padding:4px 11px;background:#10B981;color:#fff;border:none;border-radius:7px;font-size:.75rem;font-weight:700;cursor:pointer;opacity:.5">
            + Fatura
          </button>
        </div>
        <div id="contas-fat-list" style="max-height:280px;overflow-y:auto">
          <div class="contas-empty"><div class="contas-empty-icon">📋</div><p>Clique em uma instalação para ver as faturas</p></div>
        </div>
      </div>

      <!-- Chart mensal -->
      <div class="contas-chart-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:.88rem;font-weight:700;color:var(--text)">📈 Gastos Mensais</span>
          <select id="contas-chart-ano" onchange="contasLoadChart()"
            style="font-size:.76rem;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">
            ${yrs.join('')}
          </select>
        </div>
        <div style="height:160px;position:relative"><canvas id="contasChartCanvas"></canvas></div>
      </div>

      <!-- Faturas recentes -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <span style="font-size:.88rem;font-weight:700;color:var(--text)">⏱ Faturas Recentes</span>
        </div>
        <div id="contas-recentes" style="max-height:240px;overflow-y:auto">
          <div style="text-align:center;padding:24px;color:var(--muted);font-size:.82rem">Carregando…</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Relatórios (oculto) -->
  <div id="contas-rel-tab" style="display:none;padding:0 24px 40px">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
      ${[['luz','⚡','Energia Elétrica','#f59e0b'],['agua','💧','Água','#06b6d4'],
         ['internet','🌐','Internet','#8b5cf6'],['aluguel','🏠','Aluguéis','#22c55e'],
         ['all','📊','Consolidado','#3B82F6']].map(([t,ic,lb,co])=>`
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;border-top:4px solid ${co}">
        <div style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:6px">${ic} ${lb}</div>
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px">Relatório por ano</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[2023,2024,yr].map(y=>`<a href="contas_pdf.php?tipo=${t}&ano=${y}" target="_blank"
            style="padding:5px 12px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;border-radius:6px;font-size:.75rem;font-weight:700;text-decoration:none">${y}</a>`).join('')}
        </div>
      </div>`).join('')}
      <!-- Período customizado -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;border-top:4px solid var(--dim)">
        <div style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:6px">📅 Período Customizado</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <select id="contas-rel-tipo" style="padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-size:.82rem">
            <option value="all">Todas</option><option value="luz">Luz</option>
            <option value="agua">Água</option><option value="internet">Internet</option>
            <option value="aluguel">Aluguel</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input type="month" id="contas-rel-ini" value="${yr}-01"
              style="padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-size:.82rem">
            <input type="month" id="contas-rel-fim" value="${yr}-12"
              style="padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);font-size:.82rem">
          </div>
          <button onclick="contasRelCustom()"
            style="padding:8px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff;border:none;border-radius:7px;font-size:.82rem;font-weight:700;cursor:pointer">
            📄 Gerar PDF
          </button>
        </div>
      </div>
    </div>
  </div>`;

  contasInit();
}

function contasInit() {
  contasCurTab  = 'luz';
  contasInst    = [];
  contasSelInst = null;
  contasLoadDashboard();
  contasLoadInstPorTab('luz');
  contasLoadRecentes();
  contasLoadChart();
}

async function contasLoadDashboard() {
  const data = await api('contas_dashboard');
  if (!data) return;
  for (const [t, v] of Object.entries(data)) {
    const inst  = parseInt(v.inst||0);
    const pago  = parseFloat(v.pago||0);
    const pend  = parseFloat(v.pendente||0);
    const venc  = parseInt(v.vencidas||0);
    const el = id => document.getElementById(id);
    if (!el('contas-total-'+t)) continue;
    el('contas-total-'+t).textContent = contasFmtBRL(parseFloat(v.total||0));
    el('contas-badge-'+t).textContent = inst + (inst===1?' conta':' contas');
    el('contas-sub-'+t).innerHTML =
      `<span style="color:#10B981">✓ ${contasFmtBRL(pago)}</span>` +
      (pend > 0 ? ` · <span style="color:#F59E0B">⏳ ${contasFmtBRL(pend)}</span>` : '') +
      (venc > 0 ? ` · <span style="color:#EF4444">⚠ ${venc} venc.</span>` : '');
  }
}

function contasSetTab(tab) {
  contasCurTab = tab;
  document.querySelectorAll('[id^="ctab-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('ctab-'+tab);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.contas-cat-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.contas-cat-card[data-tipo="${tab}"]`);
  if (card) card.classList.add('active');
  const isRel = tab === 'relatorios';
  const main = document.getElementById('contas-main');
  const rel  = document.getElementById('contas-rel-tab');
  if (main) main.style.display = isRel ? 'none' : '';
  if (rel)  rel.style.display  = isRel ? 'block' : 'none';
  if (!isRel) {
    const pt = document.getElementById('contas-panel-title');
    if (pt) pt.textContent = contasTabTitles[tab] || tab;
    contasSelInst = null;
    contasShowEmptyFaturas();
    contasLoadInstPorTab(tab);
    contasLoadRecentes();
    contasLoadChart();
  }
}

async function contasLoadInstPorTab(tab) {
  const list = document.getElementById('contas-inst-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.82rem">Carregando…</div>';
  const res = await fetch(`api.php?action=contas_instalacoes&tipo=${encodeURIComponent(tab)}`);
  contasInst = (await res.json()) || [];
  const ug = document.getElementById('contas-filtro-ug');
  if (ug) {
    const ugs = [...new Set(contasInst.map(i=>i.unidade_gestora).filter(Boolean))].sort();
    ug.innerHTML = '<option value="">Todas as unidades</option>' + ugs.map(u=>`<option value="${u}">${u}</option>`).join('');
  }
  contasRenderInst();
}

function contasRenderInst() {
  const list = document.getElementById('contas-inst-list');
  if (!list) return;
  const ug  = (document.getElementById('contas-filtro-ug')?.value || '');
  const q   = (document.getElementById('contas-search')?.value || '').toLowerCase();
  const filtered = contasInst.filter(i =>
    (!ug || i.unidade_gestora === ug) &&
    (!q  || i.apelido.toLowerCase().includes(q) || (i.matricula_codigo||'').toLowerCase().includes(q))
  );
  if (!filtered.length) {
    list.innerHTML = `<div class="contas-empty"><div class="contas-empty-icon">${contasIcons[contasCurTab]}</div><p>Nenhuma instalação cadastrada.<br><a href="#" onclick="contasOpenNovaInst()" style="color:var(--accent)">Adicionar nova</a></p></div>`;
    return;
  }
  const col = contasColors[contasCurTab] || '#3B82F6';
  list.innerHTML = filtered.map(i => {
    const pend = parseFloat(i.total_pendente||0);
    const tot  = parseFloat(i.total_valor||0);
    const sel  = contasSelInst?.id == i.id;
    return `<div class="contas-inst-row${sel?' selected':''}" onclick="contasSelectInst(${i.id})" data-id="${i.id}">
      <div class="contas-inst-icon" style="background:${col}20">${contasIcons[contasCurTab]}</div>
      <div style="flex:1;min-width:0">
        <div class="contas-inst-name">${contasEscH(i.apelido)}</div>
        <div class="contas-inst-sub">${contasEscH(i.unidade_gestora||'')}${i.matricula_codigo?' · '+contasEscH(i.matricula_codigo):''}</div>
      </div>
      <div>
        <div class="contas-inst-val">${contasFmtBRL(tot)}</div>
        <div class="contas-inst-val-sub">${pend>0?`<span style="color:#EF4444">⏳ ${contasFmtBRL(pend)}</span>`:i.total_fat+' fat.'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-left:6px">
        <button onclick="contasEditInst(${i.id},event)" title="Editar"
          style="padding:3px 7px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:5px;font-size:.7rem;cursor:pointer">✏️</button>
        <button onclick="contasDelInst(${i.id},event)" title="Excluir"
          style="padding:3px 7px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:5px;font-size:.7rem;cursor:pointer">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function contasFilterInst() { contasRenderInst(); }

async function contasSelectInst(id) {
  contasSelInst = contasInst.find(i => i.id == id) || {id};
  const btn = document.getElementById('contas-btn-add-fat');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  document.querySelectorAll('.contas-inst-row').forEach(r =>
    r.classList.toggle('selected', r.dataset.id == id));
  const ft = document.getElementById('contas-fat-title');
  if (ft) ft.textContent = contasSelInst.apelido || 'Faturas';
  await contasLoadFaturas(id);
}

async function contasLoadFaturas(instId) {
  const el = document.getElementById('contas-fat-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.82rem">Carregando…</div>';
  const res = await fetch(`api.php?action=contas_faturas&iid=${instId}`);
  const fat = (await res.json()) || [];
  if (!fat.length) {
    el.innerHTML = '<div class="contas-empty"><div class="contas-empty-icon">📄</div><p>Nenhuma fatura cadastrada</p></div>';
    return;
  }
  el.innerHTML = `<table class="contas-table">
    <thead><tr><th>Ref.</th><th>Venc.</th><th>Pag.</th><th>Valor</th><th>Status</th><th></th></tr></thead>
    <tbody>${fat.map(f=>`<tr>
      <td style="font-family:monospace;font-size:.78rem">${contasEscH(f.referencia||'—')}</td>
      <td style="font-family:monospace;font-size:.78rem">${contasFmtD(f.data_vencimento)}</td>
      <td style="font-family:monospace;font-size:.78rem">${contasFmtD(f.data_pagamento)}</td>
      <td style="font-weight:700;font-size:.8rem">${contasFmtBRL(f.valor)}</td>
      <td><span class="contas-badge contas-badge-${f.status}">${f.status}</span></td>
      <td style="white-space:nowrap">
        <button onclick="contasEditFatura(${JSON.stringify(f).replace(/"/g,'&quot;')})" title="Editar"
          style="padding:2px 6px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:5px;font-size:.68rem;cursor:pointer">✏️</button>
        <button onclick="contasDelFatura(${f.id})" title="Excluir"
          style="padding:2px 6px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:5px;font-size:.68rem;cursor:pointer">🗑</button>
        ${f.status==='pendente'?`<button onclick="contasMarcarPago(${f.id})" title="Marcar pago"
          style="padding:2px 6px;background:#10B98120;color:#10B981;border:1px solid #10B98140;border-radius:5px;font-size:.68rem;cursor:pointer">✓</button>`:''}
      </td>
    </tr>`).join('')}</tbody></table>`;
}

function contasShowEmptyFaturas() {
  const ft = document.getElementById('contas-fat-title');
  const fl = document.getElementById('contas-fat-list');
  const btn = document.getElementById('contas-btn-add-fat');
  if (ft) ft.textContent = 'Selecione uma instalação';
  if (fl) fl.innerHTML = '<div class="contas-empty"><div class="contas-empty-icon">📋</div><p>Clique em uma instalação para ver as faturas</p></div>';
  if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
}

async function contasLoadRecentes() {
  const el = document.getElementById('contas-recentes');
  if (!el) return;
  const tipo = contasCurTab === 'relatorios' ? '' : contasCurTab;
  const res = await fetch(`api.php?action=contas_recentes${tipo?'&tipo='+tipo:''}`);
  const fat = (await res.json()) || [];
  if (!fat.length) {
    el.innerHTML = '<div class="contas-empty"><div class="contas-empty-icon">📋</div><p>Nenhuma fatura</p></div>';
    return;
  }
  el.innerHTML = fat.slice(0,12).map(f=>`
    <div class="contas-inst-row" style="cursor:default">
      <div class="contas-inst-icon" style="background:${(contasColors[f.tipo]||'#334155')}20;font-size:.9rem">${contasIcons[f.tipo]||'📄'}</div>
      <div style="flex:1;min-width:0">
        <div class="contas-inst-name" style="font-size:.8rem">${contasEscH(f.apelido)}</div>
        <div class="contas-inst-sub">${f.referencia||''}${f.data_vencimento?' · '+contasFmtD(f.data_vencimento):''}</div>
      </div>
      <div>
        <div class="contas-inst-val">${contasFmtBRL(f.valor)}</div>
        <div style="text-align:right"><span class="contas-badge contas-badge-${f.status}">${f.status}</span></div>
      </div>
    </div>`).join('');
}

async function contasLoadChart() {
  const canvas = document.getElementById('contasChartCanvas');
  if (!canvas) return;
  const ano  = document.getElementById('contas-chart-ano')?.value || new Date().getFullYear();
  const tipo = (contasCurTab === 'relatorios') ? '' : contasCurTab;
  const res  = await fetch(`api.php?action=contas_grafico&ano=${ano}${tipo?'&tipo='+tipo:''}`);
  const data = (await res.json()) || [];
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const totais = Array(12).fill(0);
  for (const r of data) { if (r.mes) totais[r.mes-1] += parseFloat(r.total||0); }
  if (contasChart) { contasChart.destroy(); contasChart = null; }
  const col = contasColors[tipo] || '#3B82F6';
  contasChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{ label:'Total (R$)', data:totais, backgroundColor:col+'80', borderColor:col, borderWidth:1, borderRadius:4 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{ticks:{callback:v=>'R$'+Number(v).toLocaleString('pt-BR'),font:{size:9},color:'#94A3B8'},grid:{color:'#334155'}},
        x:{ticks:{font:{size:9},color:'#94A3B8'},grid:{color:'#334155'}}
      }
    }
  });
}

// ─── Contas: Modais Instalação ────────────────────────────────
function contasEnsureModals() {
  if (document.getElementById('ci-modal-inst') && document.getElementById('ci-modal-fat')) return;

  const host = document.createElement('div');
  host.innerHTML = `
<div class="contas-overlay" id="ci-modal-inst" onclick="contasCloseModal('ci-modal-inst',event)">
  <div class="contas-modal">
    <div class="contas-modal-hdr">
      <h2 id="ci-inst-modal-title">Nova Instalação</h2>
      <button class="contas-close-btn" onclick="contasCloseModal('ci-modal-inst')">&times;</button>
    </div>
    <div class="contas-modal-body">
      <input type="hidden" id="ci-inst-id">
      <div class="contas-grid2" style="gap:12px">
        <div class="contas-fg">
          <label>Tipo *</label>
          <select id="ci-inst-tipo" onchange="contasToggleInstFields()">
            <option value="luz">⚡ Energia Elétrica</option>
            <option value="agua">💧 Água</option>
            <option value="internet">🌐 Internet</option>
            <option value="aluguel">🏠 Aluguel</option>
          </select>
        </div>
        <div class="contas-fg">
          <label>Unidade Gestora</label>
          <select id="ci-inst-ug">
            <option value="">Selecione…</option>
            <option value="PMS">Prefeitura Municipal (PMS)</option>
            <option value="FMS">Fundo Mun. de Saúde (FMS)</option>
            <option value="FME">Fundo Mun. de Educação (FME)</option>
            <option value="FMAS">Fundo Mun. Assist. Social (FMAS)</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
        <div class="contas-fg contas-full">
          <label>Apelido / Nome da Instalação *</label>
          <input type="text" id="ci-inst-apelido" placeholder="Ex: Hospital Maria Alice Lafayette">
        </div>
        <div id="ci-inst-campos-contrato" class="contas-full">
          <div class="contas-grid2" style="gap:12px">
            <div class="contas-fg">
              <label>Matrícula / Código do Cliente</label>
              <input type="text" id="ci-inst-matricula" placeholder="Ex: 7036352781">
            </div>
            <div class="contas-fg">
              <label>Fornecedor</label>
              <input type="text" id="ci-inst-fornecedor" placeholder="Ex: NEOENERGIA / COPASA">
            </div>
          </div>
        </div>
        <div id="ci-inst-campos-aluguel" style="display:none" class="contas-full">
          <div class="contas-grid2" style="gap:12px">
            <div class="contas-fg contas-full">
              <label>Endereço do Imóvel</label>
              <input type="text" id="ci-inst-endereco" placeholder="Rua, Avenida…">
            </div>
            <div class="contas-fg">
              <label>Número</label>
              <input type="text" id="ci-inst-numero" placeholder="123">
            </div>
            <div class="contas-fg">
              <label>Complemento</label>
              <input type="text" id="ci-inst-complemento" placeholder="Apt, Sala…">
            </div>
            <div class="contas-fg">
              <label>Cidade</label>
              <input type="text" id="ci-inst-cidade" value="Sertânia">
            </div>
            <div class="contas-fg">
              <label>Estado</label>
              <select id="ci-inst-estado">
                <option value="PE" selected>PE</option>
                <option value="AL">AL</option><option value="BA">BA</option>
                <option value="CE">CE</option><option value="MA">MA</option>
                <option value="PB">PB</option><option value="PI">PI</option>
                <option value="RN">RN</option><option value="SE">SE</option>
              </select>
            </div>
            <div class="contas-fg">
              <label>CEP</label>
              <input type="text" id="ci-inst-cep" placeholder="56600-000">
            </div>
          </div>
        </div>
        <div class="contas-fg">
          <label>Valor de Referência (R$)</label>
          <input type="number" id="ci-inst-valref" step="0.01" placeholder="0,00">
        </div>
        <div class="contas-fg">
          <label>Dia de Vencimento</label>
          <input type="number" id="ci-inst-diavenc" min="1" max="31" placeholder="Ex: 15">
        </div>
        <div class="contas-fg contas-full">
          <label>Observações</label>
          <textarea id="ci-inst-obs" placeholder="Informações adicionais…"></textarea>
        </div>
      </div>
    </div>
    <div class="contas-modal-footer">
      <button onclick="contasCloseModal('ci-modal-inst')"
        style="padding:8px 18px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;font-size:.85rem;cursor:pointer">
        Cancelar
      </button>
      <button onclick="contasSalvarInst()"
        style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer">
        💾 Salvar
      </button>
    </div>
  </div>
</div>

<div class="contas-overlay" id="ci-modal-fat" onclick="contasCloseModal('ci-modal-fat',event)">
  <div class="contas-modal">
    <div class="contas-modal-hdr">
      <h2 id="ci-fat-modal-title">Nova Fatura</h2>
      <button class="contas-close-btn" onclick="contasCloseModal('ci-modal-fat')">&times;</button>
    </div>
    <div class="contas-modal-body">
      <input type="hidden" id="ci-fat-id">
      <div class="contas-grid2" style="gap:12px">
        <div class="contas-fg contas-full">
          <label>Instalação *</label>
          <select id="ci-fat-inst"><option value="">Selecione…</option></select>
        </div>
        <div class="contas-fg">
          <label>Referência (mês/ano)</label>
          <input type="text" id="ci-fat-ref" placeholder="01/2025" maxlength="7">
        </div>
        <div class="contas-fg">
          <label>Nº do Documento</label>
          <input type="text" id="ci-fat-doc" placeholder="Nº da fatura">
        </div>
        <div class="contas-fg">
          <label>Data de Vencimento</label>
          <input type="date" id="ci-fat-venc">
        </div>
        <div class="contas-fg">
          <label>Data de Pagamento</label>
          <input type="date" id="ci-fat-pag">
        </div>
        <div class="contas-fg">
          <label>Valor (R$) *</label>
          <input type="number" id="ci-fat-valor" step="0.01" min="0" placeholder="0,00">
        </div>
        <div class="contas-fg">
          <label>Status</label>
          <select id="ci-fat-status">
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div class="contas-fg contas-full">
          <label>Observações</label>
          <textarea id="ci-fat-obs" placeholder="Observações adicionais…"></textarea>
        </div>
      </div>
    </div>
    <div class="contas-modal-footer">
      <button onclick="contasCloseModal('ci-modal-fat')"
        style="padding:8px 18px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;font-size:.85rem;cursor:pointer">
        Cancelar
      </button>
      <button onclick="contasSalvarFatura()"
        style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer">
        💾 Salvar
      </button>
    </div>
  </div>
</div>`;

  while (host.firstElementChild) {
    document.body.appendChild(host.firstElementChild);
  }
}

function contasOpenNovaInst() {
  contasEnsureModals();
  document.getElementById('ci-inst-id').value = '';
  document.getElementById('ci-inst-tipo').value = contasCurTab === 'relatorios' ? 'luz' : contasCurTab;
  ['apelido','matricula','fornecedor','ug','endereco','numero','complemento','cep','valref','diavenc','obs'].forEach(f=>{ const el=document.getElementById('ci-inst-'+f); if(el) el.value=''; });
  document.getElementById('ci-inst-cidade').value = 'Sertânia';
  document.getElementById('ci-inst-estado').value = 'PE';
  document.getElementById('ci-inst-modal-title').textContent = 'Nova Instalação';
  contasToggleInstFields();
  contasOpenModal('ci-modal-inst');
}

function contasEditInst(id, ev) {
  ev?.stopPropagation();
  contasEnsureModals();
  const i = contasInst.find(x => x.id == id);
  if (!i) return;
  document.getElementById('ci-inst-id').value        = i.id;
  document.getElementById('ci-inst-tipo').value      = i.tipo;
  document.getElementById('ci-inst-apelido').value   = i.apelido||'';
  document.getElementById('ci-inst-matricula').value = i.matricula_codigo||'';
  document.getElementById('ci-inst-fornecedor').value= i.fornecedor||'';
  document.getElementById('ci-inst-ug').value        = i.unidade_gestora||'';
  document.getElementById('ci-inst-endereco').value  = i.endereco||'';
  document.getElementById('ci-inst-numero').value    = i.numero||'';
  document.getElementById('ci-inst-complemento').value = i.complemento||'';
  document.getElementById('ci-inst-cidade').value    = i.cidade||'Sertânia';
  document.getElementById('ci-inst-estado').value    = i.estado||'PE';
  document.getElementById('ci-inst-cep').value       = i.cep||'';
  document.getElementById('ci-inst-valref').value    = i.valor_referencia||'';
  document.getElementById('ci-inst-diavenc').value   = i.dia_vencimento||'';
  document.getElementById('ci-inst-obs').value       = i.observacoes||'';
  document.getElementById('ci-inst-modal-title').textContent = 'Editar Instalação';
  contasToggleInstFields();
  contasOpenModal('ci-modal-inst');
}

function contasToggleInstFields() {
  contasEnsureModals();
  const t = document.getElementById('ci-inst-tipo').value;
  document.getElementById('ci-inst-campos-contrato').style.display = t === 'aluguel' ? 'none' : 'block';
  document.getElementById('ci-inst-campos-aluguel').style.display  = t === 'aluguel' ? 'block' : 'none';
}

async function contasSalvarInst() {
  const apelido = document.getElementById('ci-inst-apelido').value.trim();
  if (!apelido) { toast('Informe o apelido/nome da instalação', 'error'); return; }
  const tipo = document.getElementById('ci-inst-tipo').value;
  const r = await api('contas_salvar_instalacao', {
    id: document.getElementById('ci-inst-id').value,
    tipo, apelido,
    matricula_codigo: tipo!=='aluguel' ? document.getElementById('ci-inst-matricula').value : null,
    fornecedor:       tipo!=='aluguel' ? document.getElementById('ci-inst-fornecedor').value : null,
    unidade_gestora:  document.getElementById('ci-inst-ug').value,
    endereco:         tipo==='aluguel' ? document.getElementById('ci-inst-endereco').value : null,
    numero:           tipo==='aluguel' ? document.getElementById('ci-inst-numero').value : null,
    complemento:      tipo==='aluguel' ? document.getElementById('ci-inst-complemento').value : null,
    cidade: document.getElementById('ci-inst-cidade').value,
    estado: document.getElementById('ci-inst-estado').value,
    cep:    tipo==='aluguel' ? document.getElementById('ci-inst-cep').value : null,
    valor_referencia: document.getElementById('ci-inst-valref').value || null,
    dia_vencimento:   document.getElementById('ci-inst-diavenc').value || null,
    observacoes:      document.getElementById('ci-inst-obs').value || null,
  });
  if (r?.ok) { contasCloseModal('ci-modal-inst'); toast('Instalação salva!'); contasLoadInstPorTab(contasCurTab); contasLoadDashboard(); }
  else toast('Erro ao salvar instalação', 'error');
}

async function contasDelInst(id, ev) {
  ev?.stopPropagation();
  if (!confirm('Excluir esta instalação? As faturas associadas serão mantidas.')) return;
  const r = await api('contas_del_instalacao', {id});
  if (r?.ok) { toast('Instalação removida'); contasLoadInstPorTab(contasCurTab); contasLoadDashboard(); }
}

// ─── Contas: Modais Fatura ────────────────────────────────────
function contasOpenNovaFatura() {
  contasEnsureModals();
  contasPopulateInstSelect();
  document.getElementById('ci-fat-id').value = '';
  document.getElementById('ci-fat-inst').value = contasSelInst?.id || '';
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('ci-fat-ref').value    = hoje.slice(0,7).replace('-','/');
  document.getElementById('ci-fat-doc').value    = '';
  document.getElementById('ci-fat-venc').value   = '';
  document.getElementById('ci-fat-pag').value    = '';
  document.getElementById('ci-fat-valor').value  = contasSelInst?.valor_referencia || '';
  document.getElementById('ci-fat-status').value = 'pendente';
  document.getElementById('ci-fat-obs').value    = '';
  document.getElementById('ci-fat-modal-title').textContent = 'Nova Fatura';
  contasOpenModal('ci-modal-fat');
}

function contasEditFatura(f) {
  contasEnsureModals();
  contasPopulateInstSelect();
  document.getElementById('ci-fat-id').value     = f.id;
  document.getElementById('ci-fat-inst').value   = f.instalacao_id;
  document.getElementById('ci-fat-ref').value    = f.referencia||'';
  document.getElementById('ci-fat-doc').value    = f.numero_doc||'';
  document.getElementById('ci-fat-venc').value   = f.data_vencimento||'';
  document.getElementById('ci-fat-pag').value    = f.data_pagamento||'';
  document.getElementById('ci-fat-valor').value  = f.valor||'';
  document.getElementById('ci-fat-status').value = f.status||'pendente';
  document.getElementById('ci-fat-obs').value    = f.observacoes||'';
  document.getElementById('ci-fat-modal-title').textContent = 'Editar Fatura';
  contasOpenModal('ci-modal-fat');
}

function contasPopulateInstSelect() {
  contasEnsureModals();
  const sel = document.getElementById('ci-fat-inst');
  sel.innerHTML = '<option value="">Selecione a instalação…</option>' +
    contasInst.map(i=>`<option value="${i.id}">${contasEscH(i.apelido)}${i.unidade_gestora?' ('+i.unidade_gestora+')':''}</option>`).join('');
}

async function contasSalvarFatura() {
  const iid = document.getElementById('ci-fat-inst').value;
  const val = document.getElementById('ci-fat-valor').value;
  if (!iid) { toast('Selecione a instalação', 'error'); return; }
  if (!val)  { toast('Informe o valor', 'error'); return; }
  const r = await api('contas_salvar_fatura', {
    id: document.getElementById('ci-fat-id').value,
    instalacao_id: iid,
    referencia: document.getElementById('ci-fat-ref').value,
    data_vencimento: document.getElementById('ci-fat-venc').value || null,
    data_pagamento:  document.getElementById('ci-fat-pag').value  || null,
    valor: val,
    numero_doc: document.getElementById('ci-fat-doc').value || null,
    status: document.getElementById('ci-fat-status').value,
    observacoes: document.getElementById('ci-fat-obs').value || null,
  });
  if (r?.ok) {
    contasCloseModal('ci-modal-fat');
    toast('Fatura salva!');
    if (contasSelInst) contasLoadFaturas(contasSelInst.id);
    contasLoadDashboard(); contasLoadRecentes(); contasLoadChart();
  } else toast('Erro ao salvar fatura', 'error');
}

async function contasDelFatura(id) {
  if (!confirm('Excluir esta fatura?')) return;
  const r = await api('contas_del_fatura', {id});
  if (r?.ok) { toast('Fatura excluída'); if(contasSelInst) contasLoadFaturas(contasSelInst.id); contasLoadDashboard(); contasLoadChart(); }
}

async function contasMarcarPago(id) {
  const hoje = new Date().toISOString().slice(0,10);
  const r = await api('contas_salvar_fatura', {id, status:'pago', data_pagamento:hoje});
  if (r?.ok) { toast('Marcado como pago ✓'); if(contasSelInst) contasLoadFaturas(contasSelInst.id); contasLoadDashboard(); contasLoadRecentes(); }
}

function contasRelCustom() {
  const tipo = document.getElementById('contas-rel-tipo')?.value || 'all';
  const ini  = document.getElementById('contas-rel-ini')?.value;
  const fim  = document.getElementById('contas-rel-fim')?.value;
  if (!ini||!fim) { toast('Selecione o período', 'error'); return; }
  window.open(`contas_pdf.php?tipo=${tipo}&inicio=${ini}&fim=${fim}`, '_blank');
}

function contasOpenModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function contasCloseModal(id, ev) {
  if (ev && !ev.target.classList.contains('contas-overlay')) return;
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}