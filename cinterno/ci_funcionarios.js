// ─── Contratados Module ───────────────────────────────────────
const contState = {
  orgaos: [],
  contratados: [],
  cargoVagas: [],
  search: '',
  searchNome: '',
  searchCargo: '',
  searchUO: '',
  searchOrgao: '',
  catFilter: 'all',
  loaded: false,
  _ft: null
};

async function contLoad() {
  if (contState.loaded) return;
  const CACHE_KEY = 'cont_data_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, orgaos, contratados, cargoVagas } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        contState.orgaos      = orgaos;
        contState.contratados = contratados;
        contState.cargoVagas  = cargoVagas;
        contState.loaded = true;
        return;
      }
    }
  } catch(e) {}
  const [orgaosRes, contRes, vagasRes] = await Promise.all([
    fetch('api.php?action=contratados_orgaos').then(r => r.json()),
    fetch('api.php?action=contratados_list').then(r => r.json()),
    fetch('api.php?action=cargo_vagas_list').then(r => r.json()).catch(() => [])
  ]);
  contState.orgaos      = Array.isArray(orgaosRes) ? orgaosRes : (orgaosRes.data || []);
  contState.contratados = Array.isArray(contRes) ? contRes : (contRes.data || []);
  contState.cargoVagas  = Array.isArray(vagasRes) ? vagasRes : [];
  contState.loaded = true;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), orgaos: contState.orgaos, contratados: contState.contratados, cargoVagas: contState.cargoVagas }));
  } catch(e) {}
}

function normalizeCargoNome(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^\s*\d+\s*-\s*/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCargoVaga(orgaoId, cargoNome) {
  const targetOrg = parseInt(orgaoId) || 0;
  const targetCargo = normalizeCargoNome(cargoNome);
  if (!targetOrg || !targetCargo) return null;
  return contState.cargoVagas.find(v =>
    (parseInt(v.orgao_id) || 0) === targetOrg && normalizeCargoNome(v.cargo_nome) === targetCargo
  ) || null;
}

// Auto-sync vagas where ocupados > disponivel
async function contAutoSyncVagas() {
  // v3 — força re-execução desta versão (limpa flag antiga)
  if (sessionStorage.getItem('cont_vagas_v') !== '3') {
    sessionStorage.removeItem('cont_vagas_synced');
    sessionStorage.setItem('cont_vagas_v', '3');
  }
  // Executa somente UMA vez por sessão (sessionStorage)
  if (sessionStorage.getItem('cont_vagas_synced')) return;
  // Bidirecional: sincroniza disponivel = ocupados para qualquer divergência
  const toSync = contState.cargoVagas.filter(v => (parseInt(v.ocupados)||0) !== (parseInt(v.quantidade_disponivel)||0));
  if (toSync.length) {
    for (const v of toSync) {
      const newQtd = parseInt(v.ocupados) || 0;
      await fetch('api.php?action=cargo_vagas_save', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: v.id, orgao_id: v.orgao_id, cargo_nome: v.cargo_nome, quantidade_disponivel: newQtd, observacao: v.observacao||'' })
      }).catch(()=>{});
      v.quantidade_disponivel = newQtd;
    }
  }
  sessionStorage.setItem('cont_vagas_synced', '1');
}

async function renderContratados() {
  await contLoad();
  await contAutoSyncVagas();

  const allRows = contState.contratados;
  const fmtBRL = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const orgaos = contState.orgaos || [];
  const hasOfficialData = orgaos.some(o => parseFloat(o.total_proventos_folha||0) > 0);

  // Build unique option lists for searchable comboboxes
  const uniqueCargos = [...new Set(allRows.map(c => c.cargo||'').filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  const uniqueUOs    = [...new Set(allRows.map(c => c.unidade_orcamentaria||'').filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  const uniqueOrgaos = [...new Set(allRows.map(c => c.orgao_nome||'').filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR'));

  const dlOpts = arr => arr.map(v => `<option value="${escHtml(v)}">`).join('');

  // Render shell only once
  if (!document.getElementById('cont-results')) {
    document.getElementById('content').innerHTML = `
  <div style="padding:20px;max-width:1200px;margin:0 auto">
    ${ciFuncModuleTabs('list')}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <div>
        <h2 style="font-size:18px;font-weight:800;margin:0">👥 Servidores / Funcionários</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:2px">${allRows.length} vínculos${hasOfficialData?' · dados oficiais da folha':''}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="openContModal(0)">+ Novo</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-orgaos')">🏛️ Órgãos</button>
      </div>
    </div>

    <!-- Painel de filtros avançados -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">🔍 Filtros de Busca</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:160px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">📝 Nome</label>
          <input type="text" id="cont-s-nome" class="search-box" style="width:100%" placeholder="Buscar por nome…" value="${escHtml(contState.searchNome)}" autocomplete="off">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:150px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">💼 Cargo</label>
          <input type="text" id="cont-s-cargo" list="cont-dl-cargo" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(contState.searchCargo)}" autocomplete="off">
          <datalist id="cont-dl-cargo">${dlOpts(uniqueCargos)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:3;min-width:180px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">📂 Unid. Orçamentária</label>
          <input type="text" id="cont-s-uo" list="cont-dl-uo" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(contState.searchUO)}" autocomplete="off">
          <datalist id="cont-dl-uo">${dlOpts(uniqueUOs)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:150px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">🏛️ Órgão</label>
          <input type="text" id="cont-s-orgao" list="cont-dl-orgao" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(contState.searchOrgao)}" autocomplete="off">
          <datalist id="cont-dl-orgao">${dlOpts(uniqueOrgaos)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:130px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">🏷️ Categoria</label>
          <select id="cont-cat-sel" class="search-box" style="width:100%">
            <option value="all" ${contState.catFilter==='all'?'selected':''}>Todos</option>
            <option value="efetivo" ${contState.catFilter==='efetivo'?'selected':''}>Efetivos</option>
            <option value="comissionado" ${contState.catFilter==='comissionado'?'selected':''}>Comissionados</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;justify-content:flex-end">
          <label style="font-size:10px;color:transparent">.</label>
          <button onclick="contLimparFiltros()" style="padding:8px 14px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#ef4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">✖ Limpar</button>
        </div>
      </div>
    </div>

    <!-- Cards dinâmicos (atualizados pelo filtro) -->
    <div id="cont-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:18px"></div>

    <div id="cont-results"></div>
  </div>`;

    document.getElementById('cont-s-nome').addEventListener('input', function(){ contState.searchNome=this.value; clearTimeout(contState._ft); contState._ft=setTimeout(_contRenderResults,250); });
    document.getElementById('cont-s-cargo').addEventListener('input', function(){ contState.searchCargo=this.value; clearTimeout(contState._ft); contState._ft=setTimeout(_contRenderResults,300); });
    document.getElementById('cont-s-uo').addEventListener('input', function(){ contState.searchUO=this.value; clearTimeout(contState._ft); contState._ft=setTimeout(_contRenderResults,300); });
    document.getElementById('cont-s-orgao').addEventListener('input', function(){ contState.searchOrgao=this.value; clearTimeout(contState._ft); contState._ft=setTimeout(_contRenderResults,300); });
    document.getElementById('cont-cat-sel').addEventListener('change', function(){ contState.catFilter=this.value; _contRenderResults(); });
  }

  _contRenderResults();
}

function contLimparFiltros() {
  contState.searchNome = contState.searchCargo = contState.searchUO = contState.searchOrgao = contState.search = '';
  contState.catFilter = 'all';
  const ids = ['cont-s-nome','cont-s-cargo','cont-s-uo','cont-s-orgao'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const sel = document.getElementById('cont-cat-sel'); if(sel) sel.value='all';
  _contRenderResults();
}

function _contRenderResults() {
  const fmtBRL = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  let items = [...contState.contratados];
  if (contState.catFilter !== 'all') items = items.filter(c => c.categoria === contState.catFilter);
  if (contState.searchNome || contState.search) {
    const q = (contState.searchNome || contState.search).toLowerCase();
    items = items.filter(c => c.nome.toLowerCase().includes(q) || (c.cpf||'').toLowerCase().includes(q));
  }
  if (contState.searchCargo) {
    const q = contState.searchCargo.toLowerCase();
    items = items.filter(c => (c.cargo||'').toLowerCase().includes(q));
  }
  if (contState.searchUO) {
    const q = contState.searchUO.toLowerCase();
    items = items.filter(c => (c.unidade_orcamentaria||'').toLowerCase().includes(q));
  }
  if (contState.searchOrgao) {
    const q = contState.searchOrgao.toLowerCase();
    items = items.filter(c => (c.orgao_nome||'').toLowerCase().includes(q));
  }

  // ── Atualizar cards com totais dos itens filtrados ──
  const _keyFn = c => (c.cpf && c.cpf.trim()) ? c.cpf.trim() : c.nome.trim().toLowerCase();
  const filteredServs  = new Set(items.map(_keyFn)).size;
  const filteredVinc   = items.length;
  const filteredEf     = new Set(items.filter(c => c.categoria === 'efetivo').map(_keyFn)).size;
  const filteredCom    = new Set(items.filter(c => c.categoria === 'comissionado').map(_keyFn)).size;
  const _pC  = c => { const p=parseFloat(c.proventos||0); return p>0?p:(parseFloat(c.vencimento_base||0)+parseFloat(c.gratificacao||0)); };
  const _dC  = c => parseFloat(c.descontos||0);
  const _lC  = c => { const l=parseFloat(c.liquido||0); if(l>0) return l; const p=_pC(c),d=_dC(c); return p>0?(p-d):0; };
  // Usa as funções canônicas de VB e Gratif (do relatório, no mesmo escopo)
  const _vbC = typeof _contCalcVB    === 'function' ? _contCalcVB    : c => parseFloat(c.vencimento_base||0);
  const _grC = typeof _contCalcGratif=== 'function' ? _contCalcGratif: c => parseFloat(c.gratificacao||0);
  // Se filtro ativo e há dados oficiais, usa soma individual dos filtrados
  const isFiltered = contState.searchNome||contState.search||contState.searchCargo||contState.searchUO||contState.searchOrgao||contState.catFilter!=='all';
  const orgaos = contState.orgaos||[];
  const hasOfficialData = orgaos.some(o => parseFloat(o.total_proventos_folha||0)>0);
  let fProv, fDesc, fLiq;
  if (isFiltered || !hasOfficialData) {
    fProv = items.reduce((a,c) => a+_pC(c), 0);
    fDesc = items.reduce((a,c) => a+_dC(c), 0);
    fLiq  = items.reduce((a,c) => a+_lC(c), 0);
  } else {
    fProv = orgaos.reduce((a,o) => a+parseFloat(o.total_proventos_folha||0),0);
    fDesc = orgaos.reduce((a,o) => a+parseFloat(o.total_descontos_folha||0),0);
    fLiq  = orgaos.reduce((a,o) => a+parseFloat(o.total_liquido_folha||0),0);
  }
  // VB e Gratif: sempre por servidor individual (campo direto)
  const fVB   = items.reduce((a,c) => a+_vbC(c), 0);
  const fGrat = items.reduce((a,c) => a+_grC(c), 0);
  const totalVagasDisp = contState.cargoVagas.reduce((s,v) => s+(parseInt(v.quantidade_disponivel)||0), 0);
  const totalVagasOcup = contState.cargoVagas.reduce((s,v) => s+(parseInt(v.ocupados)||0), 0);
  const totalVagasRest = Math.max(0, totalVagasDisp - totalVagasOcup);
  const hasVagas = contState.cargoVagas.length > 0;
  const activeFilters = [contState.searchNome||contState.search, contState.searchCargo, contState.searchUO, contState.searchOrgao].filter(Boolean).length + (contState.catFilter!=='all'?1:0);
  const filterBadge = activeFilters > 0 ? `<span style="font-size:9px;background:#f59e0b22;color:#f59e0b;border-radius:4px;padding:1px 5px;font-weight:700;margin-left:4px">${activeFilters} filtro(s)</span>` : '';
  const cardsEl = document.getElementById('cont-cards');
  if (cardsEl) cardsEl.innerHTML = `
    <div class="cstat-card"><span class="cstat-ico">👥</span><span class="cstat-val" style="color:var(--accent)">${filteredServs.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Servidores${filterBadge}</span></div>
    <div class="cstat-card"><span class="cstat-ico">📋</span><span class="cstat-val" style="color:var(--teal2)">${filteredVinc.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Vínculos</span></div>
    <div class="cstat-card"><span class="cstat-ico">👤</span><span class="cstat-val" style="color:#818cf8">${filteredEf.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Efetivos</span></div>
    <div class="cstat-card"><span class="cstat-ico">🎖️</span><span class="cstat-val" style="color:#f59e0b">${filteredCom.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Comissionados</span></div>
    ${hasVagas ? `<div class="cstat-card"><span class="cstat-ico">📂</span><span class="cstat-val" style="color:#8B5CF6">${totalVagasDisp.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Vagas</span></div>` : ''}
    ${hasVagas ? `<div class="cstat-card" title="${totalVagasDisp} disponíveis · ${totalVagasOcup} ocupadas"><span class="cstat-ico">${totalVagasRest===0?'🔴':'🟢'}</span><span class="cstat-val" style="color:${totalVagasRest===0?'#EF4444':'#22C55E'}">${totalVagasRest.toLocaleString('pt-BR')}</span><span class="cstat-lbl">Restantes</span></div>` : ''}
    ${fVB>0?`<div class="cstat-card cstat-fin"><span class="cstat-ico">💰</span><span class="cstat-val cstat-money" style="color:#a78bfa">${fmtBRL(fVB)}</span><span class="cstat-lbl">Venc. Base</span></div>`:''}
    ${fGrat>0?`<div class="cstat-card cstat-fin"><span class="cstat-ico">⭐</span><span class="cstat-val cstat-money" style="color:#F59E0B">${fmtBRL(fGrat)}</span><span class="cstat-lbl">Gratificações</span></div>`:''}
    <div class="cstat-card cstat-fin"><span class="cstat-ico">✅</span><span class="cstat-val cstat-money" style="color:#22C55E">${fmtBRL(fProv)}</span><span class="cstat-lbl">Proventos</span></div>
    <div class="cstat-card cstat-fin"><span class="cstat-ico">🔻</span><span class="cstat-val cstat-money" style="color:#EF4444">${fmtBRL(fDesc)}</span><span class="cstat-lbl">Descontos</span></div>
    <div class="cstat-card cstat-fin"><span class="cstat-ico">💎</span><span class="cstat-val cstat-money" style="color:#38bdf8">${fmtBRL(fLiq)}</span><span class="cstat-lbl">Líquido</span></div>
  `;

  // Group by órgão → unidade → categoria
  const orgMap = {};
  for (const c of items) {
    const org = c.orgao_nome || 'Sem Órgão';
    const und = c.unidade_orcamentaria || 'Sem Unidade';
    if (!orgMap[org]) orgMap[org] = {};
    if (!orgMap[org][und]) orgMap[org][und] = { efetivo: [], comissionado: [] };
    orgMap[org][und][c.categoria === 'comissionado' ? 'comissionado' : 'efetivo'].push(c);
  }

  const orgBlocks = Object.keys(orgMap).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(orgNome => {
    const undMap = orgMap[orgNome];
    const undBlocks = Object.keys(undMap).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(undNome => {
      const ef  = undMap[undNome].efetivo;
      const com = undMap[undNome].comissionado;
      const rows = cat => cat.map(c => `
        <div class="cont-row">
          <div class="cont-nome">${escHtml(c.nome)}${c.matricula ? ' <span style="font-size:10px;color:var(--teal2);font-weight:400">#'+escHtml(c.matricula)+'</span>' : ''}</div>
          <div class="cont-info">${escHtml(c.cargo || '—')}${c.funcao && c.funcao !== c.cargo ? ' <span style="color:var(--dim)">/ '+escHtml(c.funcao)+'</span>' : ''}</div>
          <div class="cont-info" style="color:var(--ok)">${c.vencimento_base > 0 ? 'R$ '+parseFloat(c.vencimento_base).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''}</div>
          <div class="cont-info">${fmtDate(c.data_contratacao)}</div>
          <div class="cont-acts">
            <button class="btn-icon" onclick="openContModal(${c.id})" title="Editar">✏️</button>
            <button class="btn-icon btn-del" onclick="deleteContratado(${c.id})" title="Excluir">🗑️</button>
          </div>
        </div>`).join('');
      const efBlock  = ef.length  ? `<div class="cont-cat-label eff">Efetivos (${ef.length})</div>${rows(ef)}` : '';
      const comBlock = com.length ? `<div class="cont-cat-label com">Comissionados (${com.length})</div>${rows(com)}` : '';
      return `<div class="cont-und-block">
        <div class="cont-und-title">📂 ${escHtml(undNome)}</div>
        ${efBlock}${comBlock}
      </div>`;
    }).join('');
    const total = Object.values(undMap).reduce((a, u) => a + u.efetivo.length + u.comissionado.length, 0);
    return `<div class="cont-orgao-block">
      <div class="cont-orgao-header">
        <div>
          <div class="cont-orgao-title">🏛️ ${escHtml(orgNome)}</div>
          <div class="cont-orgao-sub">${total} servidor(es)</div>
        </div>
      </div>
      ${undBlocks}
    </div>`;
  }).join('');

  // ── Linha de totais salariais no rodapé ──
  const totalRow = items.length > 0 ? `
  <div style="background:linear-gradient(90deg,#0d1f35,#071120);border-radius:0 0 12px 12px;padding:14px 20px;border-top:3px solid #1e3a5f;margin-top:4px">
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">🏆 Totais — ${filteredVinc} vínculos${activeFilters>0?' (filtrado)':''}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      ${fVB>0?`<div style="text-align:center;min-width:110px"><div style="font-size:9px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">💰 Venc. Base</div><div style="font-size:16px;font-weight:900;color:#a78bfa">${fmtBRL(fVB)}</div></div>`:''}
      ${fGrat>0?`<div style="text-align:center;min-width:110px"><div style="font-size:9px;font-weight:700;color:#fcd34d;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">⭐ Gratificações</div><div style="font-size:16px;font-weight:900;color:#F59E0B">${fmtBRL(fGrat)}</div></div>`:''}
      <div style="text-align:center;min-width:110px"><div style="font-size:9px;font-weight:700;color:#86efac;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">✅ Proventos</div><div style="font-size:16px;font-weight:900;color:#22C55E">${fmtBRL(fProv)}</div></div>
      <div style="text-align:center;min-width:110px"><div style="font-size:9px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">🔻 Descontos</div><div style="font-size:16px;font-weight:900;color:#EF4444">${fmtBRL(fDesc)}</div></div>
      <div style="text-align:center;min-width:130px;margin-left:auto;padding-left:20px;border-left:2px solid #1e3a5f"><div style="font-size:9px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">💎 Líquido a Pagar</div><div style="font-size:22px;font-weight:900;color:#38bdf8">${fmtBRL(fLiq)}</div></div>
    </div>
  </div>` : '';

  const el = document.getElementById('cont-results');
  if (el) el.innerHTML = items.length ? (orgBlocks + totalRow) : '<div class="empty">Nenhum resultado encontrado. <button onclick="contLimparFiltros()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;text-decoration:underline">Limpar filtros</button></div>';
}

function contSearch(v) {
  contState.search = v;
  contState.searchNome = v;
  clearTimeout(contState._ft);
  contState._ft = setTimeout(_contRenderResults, 280);
}
function contCatFilter(v) {
  contState.catFilter = v;
  _contRenderResults();
}

// ── Duplicidades ─────────────────────────────────────────────
async function renderContDuplicados() {
  document.getElementById('content').innerHTML = '<div class="loading">Analisando duplicidades\u2026</div>';
  await contLoad();

  // Detectar por nome normalizado (sem acento, lowercase, sem espaços duplos)
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  const nameMap = {};
  for (const c of contState.contratados) {
    const key = norm(c.nome);
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(c);
  }

  const dups = Object.values(nameMap).filter(arr => arr.length > 1)
    .sort((a, b) => b.length - a.length || a[0].nome.localeCompare(b[0].nome, 'pt-BR'));

  const totalDup = dups.reduce((a, g) => a + g.length, 0);

  if (!dups.length) {
    document.getElementById('content').innerHTML = `
    <div style="padding:24px 20px;max-width:1100px;margin:0 auto">
      <h2 style="font-size:20px;font-weight:800;margin:0 0 8px">\u26a0\ufe0f Duplicidades de Funcion\u00e1rios</h2>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:40px;text-align:center;margin-top:24px">
        <div style="font-size:48px;margin-bottom:12px">\u2705</div>
        <div style="font-size:18px;font-weight:700;color:var(--ok)">Nenhuma duplicidade encontrada!</div>
        <div style="color:var(--muted);margin-top:6px">Todos os ${contState.contratados.length} funcion\u00e1rios t\u00eam nomes \u00fanicos no cadastro.</div>
      </div>
    </div>`;
    return;
  }

  const thS = 'padding:7px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--dim);border-bottom:1px solid var(--border);text-align:left';
  const tdS = 'padding:7px 12px;font-size:12px;border-bottom:1px solid #1a2840;vertical-align:top';

  const blocks = dups.map(group => {
    const badge = cat => `<span style="background:${cat==='comissionado'?'#16a34a22':'#3b82f622'};color:${cat==='comissionado'?'var(--ok)':'var(--accent)'};border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700">${cat==='comissionado'?'Comissionado':'Efetivo'}</span>`;
    const rows = group.map(c => `
      <tr>
        <td style="${tdS};font-weight:600">${escHtml(c.nome)}</td>
        <td style="${tdS}">${badge(c.categoria)}</td>
        <td style="${tdS};color:var(--muted)">${escHtml(c.cargo || '\u2014')}</td>
        <td style="${tdS};color:var(--muted)">${escHtml(c.orgao_nome || '\u2014')}</td>
        <td style="${tdS};color:var(--muted);font-size:11px">${escHtml(c.unidade_orcamentaria || '\u2014')}</td>
        <td style="${tdS};color:var(--dim);font-size:11px">${escHtml(c.cpf || '\u2014')}</td>
        <td style="${tdS}">
          <button class="btn-icon" onclick="openContModal(${c.id})" title="Editar">\u270f\ufe0f</button>
          <button class="btn-icon btn-del" onclick="deleteContratado(${c.id})" title="Excluir">\ud83d\uddd1\ufe0f</button>
        </td>
      </tr>`).join('');

    const cpfs = [...new Set(group.map(c => c.cpf).filter(Boolean))];
    const motivo = cpfs.length === 1
      ? '\ud83d\udccd Mesmo CPF em mais de um registro'
      : group.every(c => !c.cpf)
        ? '\u2753 Nomes id\u00eanticos (CPF n\u00e3o informado)'
        : '\ud83d\udc64 Nomes id\u00eanticos — CPFs diferentes';

    return `
    <div style="background:var(--card);border:1px solid var(--border);border-left:4px solid #F59E0B;border-radius:0 12px 12px 0;margin-bottom:16px;overflow:hidden">
      <div style="padding:10px 16px;background:#1e2010;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-weight:800;font-size:14px;color:#F59E0B">${escHtml(group[0].nome)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${motivo}</div>
        </div>
        <span style="background:#F59E0B22;color:#F59E0B;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:800">${group.length} registros</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:700px">
          <thead><tr style="background:#0f172a">
            <th style="${thS}">Nome</th>
            <th style="${thS}">Categoria</th>
            <th style="${thS}">Cargo</th>
            <th style="${thS}">\u00d3rg\u00e3o</th>
            <th style="${thS}">Unidade Or\u00e7ament\u00e1ria</th>
            <th style="${thS}">CPF</th>
            <th style="${thS}">A\u00e7\u00f5es</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:1100px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">\u26a0\ufe0f Duplicidades de Funcion\u00e1rios</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${dups.length} nome(s) duplicado(s) \u00b7 ${totalDup} registros envolvidos</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-list')">\ud83d\udc65 Ver Lista</button>
        <button onclick="contDupPdf()" style="padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">\ud83d\udcc4 Gerar PDF</button>
      </div>
    </div>
    <div class="orc-sum-row" style="margin-bottom:20px">
      <div class="orc-sum-card"><div class="osc-icon">\u26a0\ufe0f</div><div class="osc-val" style="color:#F59E0B">${dups.length}</div><div class="osc-lbl">Nomes duplicados</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udc64</div><div class="osc-val" style="color:#EF4444">${totalDup}</div><div class="osc-lbl">Registros afetados</div></div>
      <div class="orc-sum-card"><div class="osc-icon">\ud83d\udc65</div><div class="osc-val">${contState.contratados.length}</div><div class="osc-lbl">Total no cadastro</div></div>
    </div>
    <div style="background:#1e150a;border:1px solid #F59E0B44;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#F59E0B">
      \u2139\ufe0f A detec\u00e7\u00e3o compara nomes ignorando acentos, mai\u00fasculas e espa\u00e7os extras. Verifique cada caso: pode ser mesma pessoa em dois cargos, ou dois servidores distintos com nomes id\u00eanticos.
    </div>
    ${blocks}
  </div>`;
}

function contDupPdf() {
  const allData = contState.contratados;
  if (!allData.length) { toast('Nenhum dado carregado', 'error'); return; }

  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const nameMap = {};
  for (const c of allData) { const k = norm(c.nome); if (!nameMap[k]) nameMap[k]=[]; nameMap[k].push(c); }
  const dups     = Object.values(nameMap).filter(a => a.length > 1).sort((a,b) => b.length-a.length || a[0].nome.localeCompare(b[0].nome,'pt-BR'));
  const totalDup = dups.reduce((a,g) => a+g.length, 0);
  if (!dups.length) { toast('Nenhuma duplicidade encontrada!', 'ok'); return; }

  const now   = new Date();
  const dtStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const sections = [];

  sections.push({
    type:     'header',
    title:    'Duplicidades de Funcionarios',
    subtitle: 'Prefeitura Municipal de Sertania',
    right:    'Emitido em: ' + dtStr,
    color:    [245, 158, 11],
  });

  sections.push({ type: 'cards', items: [
    { value: String(dups.length),     label: 'Nomes duplicados',   color: [245, 158, 11] },
    { value: String(totalDup),         label: 'Registros afetados', color: [239, 68, 68] },
    { value: String(allData.length),   label: 'Total no cadastro',  color: [13, 122, 116] },
  ]});

  sections.push({ type: 'note', text: 'A deteccao compara nomes ignorando acentos, maiusculas e espacos extras. Verifique cada caso: pode ser a mesma pessoa em dois cargos ou dois servidores distintos com nomes identicos.' });

  for (const group of dups) {
    const cpfs   = [...new Set(group.map(c => c.cpf).filter(Boolean))];
    const motivo = cpfs.length === 1 ? 'Mesmo CPF em mais de um registro'
                 : group.every(c => !c.cpf) ? 'Nomes identicos (CPF nao informado)'
                 : 'Nomes identicos - CPFs diferentes';
    sections.push({
      type:   'org-header',
      name:   group[0].nome,
      sub:    motivo,
      right:  group.length + ' registros',
      color:  [245, 158, 11],
    });
    const head = [['Nome', 'Categoria', 'Cargo', 'Orgao', 'Unidade Orcamentaria', 'CPF']];
    const body = group.map(c => [
      { content: c.nome, styles: { fontStyle: 'bold' } },
      c.categoria === 'comissionado' ? 'Comissionado' : 'Efetivo',
      c.cargo || '\u2014',
      c.orgao_nome || '\u2014',
      { content: c.unidade_orcamentaria || '\u2014', styles: { fontSize: 7 } },
      c.cpf || '\u2014',
    ]);
    sections.push({ type: 'table', head, body, fontSize: 8 });
  }

  _downloadPdf({ filename: 'duplicidades-funcionarios.pdf', orientation: 'portrait', sections });
}


const contRelState = {
  showOrgao:        true,
  showCat:          true,
  showCargo:        false,
  showFuncao:       false,
  showMatricula:    false,
  showUnidade:      false,
  showNomes:        false,
  showVencBase:     true,
  showVencimento:   true,
  showGratificacao: true,
  showLiquido:      true,
  showGratif:       true,
  orgaoSel:         null,
  catSel:           { efetivo: true, comissionado: true },
  searchNome:       '',
  searchCargo:      '',
  searchUO:         '',
  searchOrgao:      '',
  _ft:              null
};

function _contCalcProv(c) {
  const pCalc = parseFloat(c.calc_proventos ?? 0);
  if (pCalc > 0) return pCalc;
  const p = parseFloat(c.proventos || 0);
  return p > 0 ? p : (parseFloat(c.vencimento_base || 0) + parseFloat(c.gratificacao || 0));
}

function _contCalcDesc(c) {
  const dCalc = parseFloat(c.calc_descontos ?? 0);
  if (dCalc > 0) return dCalc;
  return parseFloat(c.descontos || 0);
}

function _contCalcLiq(c) {
  const lCalc = parseFloat(c.calc_liquido ?? 0);
  if (lCalc > 0) return lCalc;
  const l = parseFloat(c.liquido || 0);
  if (l > 0) return l;
  const p = _contCalcProv(c), d = _contCalcDesc(c);
  return p > 0 ? Math.max(0, p - d) : 0;
}

function _vbIsCorrupted(c) {
  // vencimento_base foi gravado com o valor dos descontos (erro de importação)
  const vb = parseFloat(c.vencimento_base || 0);
  const d  = parseFloat(c.descontos || 0);
  return vb > 0 && d > 0 && Math.abs(vb - d) < 0.02;
}

function _contCalcGratif(c) {
  if (_vbIsCorrupted(c)) return 0; // VB corrompido: sem gratificação real
  const gCalc = parseFloat(c.calc_gratificacao ?? 0);
  if (gCalc > 0) return gCalc;
  const g = parseFloat(c.gratificacao || 0);
  if (g > 0) return g;
  const p = parseFloat(c.proventos || 0);
  const vb = parseFloat(c.vencimento_base || 0);
  return (p > 0 && vb > 0) ? Math.max(0, p - vb) : 0;
}

function _contCalcVB(c) {
  if (_vbIsCorrupted(c)) return parseFloat(c.proventos || 0); // usar proventos como VB real
  const vbCalc = parseFloat(c.calc_vencimento_base ?? 0);
  if (vbCalc > 0) return vbCalc;
  return parseFloat(c.vencimento_base || 0);
}

async function renderContRelatorio() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando relatório de custo de pessoal…</div>';
  // Corrige dados com vencimento_base gravado errado (= descontos) — apenas uma vez por sessão
  if (!sessionStorage.getItem('cont_fix_vb_done')) {
    try { await fetch('api.php?action=contratados_fix_vb', {method:'POST', body:'{}'}); } catch(e) {}
    sessionStorage.setItem('cont_fix_vb_done', '1');
  }
  await contLoad();
  // Fetch organ-level folha totals (from pms_orgaos totals stored by popular_folha.php)
  let orgTotals = [];
  try {
    const r = await fetch(`api.php?action=contratados_relatorio_custo`);
    const j = await r.json(); if(j.ok) orgTotals = j.data || [];
  } catch(e) {}
  contRelState.orgTotals = orgTotals;
  _contRelRender();
}

function _contRelSelectAllOrgs(val) {
  const allOrgs = [...new Set(contState.contratados.map(c => c.orgao_nome || 'Sem Órgão'))];
  allOrgs.forEach(o => contRelState.orgaoSel[o] = val);
  _contRelRender();
}

function _contRelRender() {
  const allData   = contState.contratados;
  const s         = contRelState;
  const orgTotals = s.orgTotals || [];

  // ── listas únicas para comboboxes de busca ───────────────
  const uniqueRelCargos = [...new Set(allData.map(c => c.cargo||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const uniqueRelUOs    = [...new Set(allData.map(c => c.unidade_orcamentaria||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const uniqueRelOrgaos = [...new Set(allData.map(c => c.orgao_nome||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const dlOptsRel = arr => arr.map(v => `<option value="${escHtml(v)}">`).join('');

  // ── inicializar / sincronizar filtro de órgãos ──────────
  const allOrgs = [...new Set(allData.map(c => c.orgao_nome || 'Sem Órgão'))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  if (!s.orgaoSel) { s.orgaoSel = {}; allOrgs.forEach(o => s.orgaoSel[o] = true); }
  else allOrgs.forEach(o => { if (s.orgaoSel[o] === undefined) s.orgaoSel[o] = true; });

  // ── auto-marcar checkboxes de colunas quando há busca ───
  if (s.searchNome  && !s.showNomes)   s.showNomes   = true;
  if (s.searchCargo && !s.showCargo)   s.showCargo   = true;
  if (s.searchUO    && !s.showUnidade) s.showUnidade = true;

  // ── aplicar filtros ──────────────────────────────────────
  const _sNome  = (s.searchNome  || '').toLowerCase().trim();
  const _sCargo = (s.searchCargo || '').toLowerCase().trim();
  const _sUO    = (s.searchUO    || '').toLowerCase().trim();
  const _sOrgao = (s.searchOrgao || '').toLowerCase().trim();
  const data = allData.filter(c => {
    const org = c.orgao_nome || 'Sem Órgão';
    if (s.orgaoSel[org] === false) return false;
    if (s.catSel[c.categoria] === false) return false;
    if (_sNome  && !(c.nome||'').toLowerCase().includes(_sNome))               return false;
    if (_sCargo && !(c.cargo||'').toLowerCase().includes(_sCargo))              return false;
    if (_sUO    && !(c.unidade_orcamentaria||'').toLowerCase().includes(_sUO)) return false;
    if (_sOrgao && !org.toLowerCase().includes(_sOrgao))                       return false;
    return true;
  });
  const activeRelFilters = [s.searchNome, s.searchCargo, s.searchUO, s.searchOrgao].filter(Boolean).length;

  const totalEf    = data.filter(c => c.categoria === 'efetivo').length;
  const totalCom   = data.filter(c => c.categoria === 'comissionado').length;
  const fmtBRL     = v => 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  // Helper: pega proventos reais (campo folha), ou cai em vencimento_base+gratificacao
  const _prov = _contCalcProv;
  const _desc = _contCalcDesc;
  const _liq  = _contCalcLiq;
  // ── órgãos visíveis + folha oficial ──────────────────────
  const visOrgs = allOrgs.filter(o => s.orgaoSel[o] !== false);
  const orgaosComFolha = contState.orgaos
    .filter(o => parseFloat(o.total_proventos_folha || 0) > 0 || parseFloat(o.total_liquido_folha || 0) > 0)
    .sort((a, b) => parseFloat(b.total_proventos_folha || 0) - parseFloat(a.total_proventos_folha || 0));
  const orgaosVisiveis = orgaosComFolha.filter(o => s.orgaoSel[o.nome] !== false);
  // Quando categoria filtrada, totais do órgão (folha importada) não podem ser divididos por cat
  // Quando filtro de texto ativo, totais do órgão não refletem os registros filtrados
  // → forçamos uso dos registros individuais para todos os cálculos em ambos os casos
  const _catFilterActive  = !(s.catSel.efetivo !== false && s.catSel.comissionado !== false);
  const _textFilterActive = !!(s.searchNome || s.searchCargo || s.searchUO || s.searchOrgao);
  const _useOrgTotals  = orgaosVisiveis.length > 0 && !_catFilterActive && !_textFilterActive;
  // Totais: dados oficiais de órgão (folha PDF importada) > servidores individualmente cadastrados
  const totalProv  = _useOrgTotals
    ? orgaosVisiveis.reduce((a, o) => a + parseFloat(o.total_proventos_folha || 0), 0)
    : data.reduce((a, c) => a + _prov(c), 0);
  const totalDesc  = _useOrgTotals
    ? orgaosVisiveis.reduce((a, o) => a + parseFloat(o.total_descontos_folha || 0), 0)
    : data.reduce((a, c) => a + _desc(c), 0);
  const totalLiq   = _useOrgTotals
    ? orgaosVisiveis.reduce((a, o) => a + parseFloat(o.total_liquido_folha || 0), 0)
    : data.reduce((a, c) => a + _liq(c), 0);
  const gtServRel  = _useOrgTotals
    ? orgaosVisiveis.reduce((a, o) => a + parseInt(o.total_servidores_folha || 0), 0)
    : (totalEf + totalCom);
  const totalFolha = totalProv;
  // Gratificações: usa campo direto ou deriva como proventos − vencimento_base
  const _gratif = _contCalcGratif;
  const _vencBase = _contCalcVB;
  // orgTotals tem campo categoria — filtramos tanto por órgão quanto por categoria
  const _orgRowsVisiveis = orgTotals.filter(r => {
    const orgOk = s.orgaoSel[r.orgao_nome || 'Sem Órgão'] !== false;
    const catOk = s.catSel[r.categoria || 'efetivo'] !== false;
    return orgOk && catOk;
  });
  const totalGratif = _useOrgTotals
    ? _orgRowsVisiveis.reduce((a, r) => a + parseFloat(r.total_gratificacao || 0), 0)
    : data.reduce((a,c) => a + _gratif(c), 0);
  const totalVencBase = _useOrgTotals
    ? _orgRowsVisiveis.reduce((a, r) => a + parseFloat(r.total_vencimento_base || 0), 0)
    : data.reduce((a,c) => a + _vencBase(c), 0);
  // Helper: gratificacao por órgão
  const _gratByOrg  = nm => _useOrgTotals
    ? _orgRowsVisiveis
        .filter(r => (r.orgao_nome || 'Sem Órgão') === nm)
        .reduce((a, r) => a + parseFloat(r.total_gratificacao || 0), 0)
    : data.filter(c => (c.orgao_nome||'Sem Órgão')===nm).reduce((a,c)=>a+_gratif(c),0);
  // ── resumo matricial (por órgãos visíveis) ───────────────
  const matrixRows = visOrgs.map(org => {
    const ef  = data.filter(c => (c.orgao_nome||'Sem Órgão') === org && c.categoria === 'efetivo').length;
    const com = data.filter(c => (c.orgao_nome||'Sem Órgão') === org && c.categoria === 'comissionado').length;
    if (ef + com === 0) return '';
    return `<tr>
      <td style="padding:8px 12px;font-weight:600">${escHtml(org)}</td>
      <td style="padding:8px 12px;text-align:center;color:var(--accent)">${ef || '—'}</td>
      <td style="padding:8px 12px;text-align:center;color:var(--ok)">${com || '—'}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:800;color:var(--teal2)">${ef+com}</td>
    </tr>`;
  }).join('');

  // ── _panelOrgaos: fonte de dados para o painel de custo ─────────
  // Quando filtro de categoria ativo: recalcula a partir dos registros individuais (data)
  // Quando tudo selecionado: usa totais oficiais importados da folha (orgaosVisiveis)
  const _panelOrgaos = _useOrgTotals
    ? orgaosVisiveis
    : visOrgs.map(orgNome => {
        const recs = data.filter(c => (c.orgao_nome||'Sem Órgão') === orgNome);
        if (!recs.length) return null;
        const prov = recs.reduce((a,c) => a + _prov(c), 0);
        const desc = recs.reduce((a,c) => a + _desc(c), 0);
        const liq  = recs.reduce((a,c) => a + _liq(c), 0);
        const grat = recs.reduce((a,c) => a + _gratif(c), 0);
        return {
          nome: orgNome,
          total_proventos_folha: prov,
          total_descontos_folha: desc,
          total_liquido_folha:   liq,
          total_servidores_folha: recs.length,
          ultima_competencia: null,
          _grat: grat,
        };
      }).filter(Boolean).filter(o => o.total_proventos_folha > 0);

  // ── painel espetacular: custo de pessoal por órgão (folha real) ─
  let folhaCostoPanel = '';
  if (_panelOrgaos.length > 0) {
    const gtProv  = _panelOrgaos.reduce((a, o) => a + parseFloat(o.total_proventos_folha || 0), 0);
    const gtDesc  = _panelOrgaos.reduce((a, o) => a + parseFloat(o.total_descontos_folha || 0), 0);
    const gtLiq   = _panelOrgaos.reduce((a, o) => a + parseFloat(o.total_liquido_folha  || 0), 0);
    const gtServ  = _useOrgTotals
      ? _panelOrgaos.reduce((a, o) => a + parseInt(o.total_servidores_folha || 0), 0)
      : data.length;
    // Gratificações: usa _grat sintético quando viemos de registros individuais
    const _orgGratif = (o) => o._grat !== undefined
      ? o._grat
      : _orgRowsVisiveis.filter(r => (r.orgao_nome||'Sem Órgão') === o.nome)
          .reduce((a,r) => a + parseFloat(r.total_gratificacao || 0), 0);
    const gtGratif = _panelOrgaos.reduce((a, o) => a + _orgGratif(o), 0);
    const compPeriods = [...new Set(_panelOrgaos.map(o => o.ultima_competencia).filter(Boolean))];
    const compLabel   = compPeriods.length === 1 ? compPeriods[0] : compPeriods.join(', ');

    const maxProv = _panelOrgaos.reduce((m, o) => Math.max(m, parseFloat(o.total_proventos_folha||0)), 0) || 1;

    const orgRows = _panelOrgaos.map((o, idx) => {
      const prov  = parseFloat(o.total_proventos_folha || 0);
      const desc  = parseFloat(o.total_descontos_folha || 0);
      const liq   = parseFloat(o.total_liquido_folha  || 0);
      const serv  = parseInt(o.total_servidores_folha || 0);
      const grat  = _orgGratif(o);
      const vbase = prov - grat;
      const pct   = (prov / gtProv * 100).toFixed(1);
      const barW  = Math.round(prov / maxProv * 100);
      const gratW = Math.round(grat / maxProv * 100);
      const descW = Math.round(desc / maxProv * 100);
      const colors = ['#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
      const barColor = colors[idx % colors.length];
      const comp = o.ultima_competencia ? `<span style="background:#1e3a5f;color:#60a5fa;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;margin-left:8px">${escHtml(o.ultima_competencia)}</span>` : '';
      const descTax = prov > 0 ? (desc / prov * 100).toFixed(1) : '0.0';
      const gratPct = prov > 0 ? (grat / prov * 100).toFixed(1) : '0.0';
      return `
      <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.05);transition:background .2s" onmouseover="this.style.background='#0f1e35'" onmouseout="this.style.background=''">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              <span style="font-size:14px;font-weight:800;color:#f1f5f9">${escHtml(o.nome)}</span>
              ${comp}
              <span style="font-size:10px;color:#64748b;background:#1e293b;border-radius:4px;padding:2px 6px">${serv} servidores</span>
            </div>
            <!-- barra de proventos (vencimento base) -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
              <span style="font-size:10px;color:#a78bfa;width:110px;flex-shrink:0">Venc. Base</span>
              <div style="flex:1;background:#1e293b;border-radius:4px;height:9px;overflow:hidden">
                <div style="width:${barW}%;height:100%;background:linear-gradient(90deg,#a78bfa,#7c3aed);border-radius:4px"></div>
              </div>
              <span style="font-size:12px;font-weight:700;color:#a78bfa;width:145px;text-align:right;flex-shrink:0">${fmtBRL(vbase > 0 ? vbase : prov)}</span>
            </div>
            ${grat > 0 ? `<!-- barra de gratificações -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
              <span style="font-size:10px;color:#94a3b8;width:110px;flex-shrink:0">⭐ Gratificações</span>
              <div style="flex:1;background:#1e293b;border-radius:4px;height:9px;overflow:hidden">
                <div style="width:${gratW}%;height:100%;background:linear-gradient(90deg,#f59e0b,#d97706);border-radius:4px"></div>
              </div>
              <span style="font-size:12px;font-weight:700;color:#f59e0b;width:145px;text-align:right;flex-shrink:0">${fmtBRL(grat)}</span>
            </div>` : ''}
            <!-- separador — proventos totais -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
              <span style="font-size:10px;color:#86efac;width:110px;flex-shrink:0;font-weight:700">= Proventos</span>
              <div style="flex:1"></div>
              <span style="font-size:13px;font-weight:900;color:#22c55e;width:145px;text-align:right;flex-shrink:0;border-top:1px solid #22c55e33;padding-top:3px">${fmtBRL(prov)}</span>
            </div>
            <!-- barra de descontos -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:2px">
              <span style="font-size:10px;color:#94a3b8;width:110px;flex-shrink:0">🔻 Descontos</span>
              <div style="flex:1;background:#1e293b;border-radius:4px;height:9px;overflow:hidden">
                <div style="width:${descW}%;height:100%;background:linear-gradient(90deg,#ef4444,#ef444499);border-radius:4px"></div>
              </div>
              <span style="font-size:12px;font-weight:700;color:#ef4444;width:145px;text-align:right;flex-shrink:0">(${fmtBRL(desc)})</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;min-width:155px;padding-left:12px;border-left:1px solid #1e293b">
            <div style="font-size:10px;color:#64748b;margin-bottom:3px">Líquido a Pagar</div>
            <div style="font-size:24px;font-weight:900;color:#38bdf8;letter-spacing:-.5px">${fmtBRL(liq)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:5px">${pct}% da folha</div>
            <div style="font-size:10px;color:#ef4444;margin-top:2px">${descTax}% descontos</div>
            ${grat > 0 ? `<div style="font-size:10px;color:#f59e0b;margin-top:2px">${gratPct}% gratific.</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    // UO breakdown — usa orgTotals sem filtro de texto; reconstrói de data individual quando filtro ativo
    let uoSection = '';
    const _uoDataRows = _textFilterActive
      ? (() => {
          const groups = {};
          data.forEach(c => {
            const org = c.orgao_nome || 'Sem Órgão';
            const uo  = c.unidade_orcamentaria || '—';
            const cat = c.categoria || 'efetivo';
            const key = `${org}|||${uo}|||${cat}`;
            if (!groups[key]) groups[key] = { orgao_nome: org, unidade_orcamentaria: uo, categoria: cat, recs: [] };
            groups[key].recs.push(c);
          });
          return Object.values(groups).map(g => {
            const prov = g.recs.reduce((a,c) => a + _prov(c), 0);
            const desc = g.recs.reduce((a,c) => a + _desc(c), 0);
            const liq  = g.recs.reduce((a,c) => a + _liq(c), 0);
            const vb   = g.recs.reduce((a,c) => a + _vencBase(c), 0);
            return { orgao_nome: g.orgao_nome, unidade_orcamentaria: g.unidade_orcamentaria,
                     categoria: g.categoria, total_vencimento_base: vb,
                     total_proventos: prov, total_descontos: desc,
                     total_liquido: liq, total_servidores: g.recs.length };
          });
        })()
      : _orgRowsVisiveis;
    if (_uoDataRows.length > 0) {
      const uoByOrg = {};
      _uoDataRows.forEach(row => {
        const nome = row.orgao_nome || 'Sem Órgão';
        if (!uoByOrg[nome]) uoByOrg[nome] = [];
        uoByOrg[nome].push(row);
      });
      const uoOrgs = Object.keys(uoByOrg).sort((a,b) => a.localeCompare(b,'pt-BR'));
      let uoRows = '';
      for (const orgNome of uoOrgs) {
        const rows = uoByOrg[orgNome].sort((a,b) => parseFloat(b.total_proventos||0) - parseFloat(a.total_proventos||0));
        const orgSum = rows.reduce((s, r) => s + parseFloat(r.total_proventos||0), 0);
        if (orgSum === 0) continue;
        let subVB=0, subGrat=0, subProv=0, subDesc=0, subLiq=0, subCnt=0;
        uoRows += `<tr style="background:#151f35"><td colspan="8" style="padding:8px 14px;font-weight:800;font-size:12px;color:#94a3b8">🏛️ ${escHtml(orgNome)}</td></tr>`;
        rows.forEach(row => {
          const uo    = row.unidade_orcamentaria || '—';
          const cat   = row.categoria === 'comissionado' ? '🎖️ Comissionado' : '👤 Efetivo';
          const vbase = parseFloat(row.total_vencimento_base || 0);
          const prov  = parseFloat(row.total_proventos || 0);
          const grat  = Math.max(0, prov - vbase);
          const desc  = parseFloat(row.total_descontos || 0);
          const liq   = parseFloat(row.total_liquido   || 0);
          const cnt   = parseInt(row.total_servidores  || 0);
          if (prov === 0) return;
          subVB+=vbase; subGrat+=grat; subProv+=prov; subDesc+=desc; subLiq+=liq; subCnt+=cnt;
          uoRows += `<tr style="border-bottom:1px solid #1a2840">
            <td style="padding:7px 14px;font-size:11px;color:#e2e8f0">${escHtml(uo)}</td>
            <td style="padding:7px 10px;font-size:11px;color:#94a3b8;text-align:center">${escHtml(cat)}</td>
            <td style="padding:7px 10px;font-size:11px;color:#94a3b8;text-align:center;font-weight:700">${cnt}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#a78bfa;text-align:right">${vbase > 0 ? fmtBRL(vbase) : '—'}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#f59e0b;text-align:right">${grat > 0 ? fmtBRL(grat) : '—'}</td>
            <td style="padding:7px 10px;font-size:12px;font-weight:700;color:#22c55e;text-align:right">${fmtBRL(prov)}</td>
            <td style="padding:7px 10px;font-size:12px;font-weight:700;color:#ef4444;text-align:right">${desc > 0 ? fmtBRL(desc) : '—'}</td>
            <td style="padding:7px 14px;font-size:12px;font-weight:800;color:#38bdf8;text-align:right">${fmtBRL(liq)}</td>
          </tr>`;
        });
        uoRows += `<tr style="background:#1a2f4a;border-top:2px solid #334155;border-bottom:3px solid #0f172a">
          <td colspan="2" style="padding:8px 14px;font-size:11px;font-weight:800;color:#cbd5e1">📊 Subtotal — ${escHtml(orgNome)}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:900;color:#f1f5f9;text-align:center">${subCnt}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:800;color:#a78bfa;text-align:right">${subVB > 0 ? fmtBRL(subVB) : '—'}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:800;color:#f59e0b;text-align:right">${subGrat > 0 ? fmtBRL(subGrat) : '—'}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:800;color:#22c55e;text-align:right">${fmtBRL(subProv)}</td>
          <td style="padding:8px 10px;font-size:12px;font-weight:800;color:#ef4444;text-align:right">${subDesc > 0 ? fmtBRL(subDesc) : '—'}</td>
          <td style="padding:8px 14px;font-size:12px;font-weight:900;color:#38bdf8;text-align:right">${fmtBRL(subLiq)}</td>
        </tr>
        <tr style="height:14px;background:transparent"><td colspan="8"></td></tr>`;
      }
      if (uoRows) {
        uoSection = `
        <div style="border-top:2px solid #1e293b;margin-top:0">
          <div style="padding:11px 18px;background:#0c1829;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">📂 Detalhamento por Unidade Orçamentária</div>
          <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:700px">
            <thead><tr style="background:#0f172a">
              <th style="padding:7px 14px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">Unidade Orçamentária</th>
              <th style="padding:7px 10px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">Categoria</th>
              <th style="padding:7px 10px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">Serv.</th>
              <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">Venc. Base</th>
              <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">⭐ Gratificações</th>
              <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">= Proventos</th>
              <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">🔻 Descontos</th>
              <th style="padding:7px 14px;text-align:right;font-size:10px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e293b">Líquido</th>
            </tr></thead>
            <tbody>${uoRows}</tbody>
          </table>
          </div>
        </div>`;
      }
    }

    folhaCostoPanel = `
    <div style="background:var(--card);border:1px solid #1e3a5f;border-radius:16px;overflow:hidden;margin-bottom:24px;box-shadow:0 4px 24px rgba(0,100,200,.12)">
      <!-- cabeçalho espetacular -->
      <div style="background:linear-gradient(135deg,#0d1f35 0%,#0f2d50 50%,#0a1e34 100%);padding:18px 22px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">💼 RELATÓRIO DE CUSTO DE PESSOAL</div>
            <div style="font-size:17px;font-weight:900;color:#f1f5f9">Resumo da Folha de Pagamento por Órgão</div>
            ${compLabel ? `<div style="font-size:12px;color:#64748b;margin-top:3px">Competência: <strong style="color:#60a5fa">${escHtml(compLabel)}</strong></div>` : ''}
          </div>

        </div>
        <!-- totais gerais em destaque -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px">
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:4px">� Total de Cargos Ocupados</div>
            <div style="font-size:28px;font-weight:900;color:#f1f5f9">${gtServ.toLocaleString('pt-BR')}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${_panelOrgaos.length} órgão(s)</div>
          </div>
          ${gtGratif > 0 ? `<div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.3);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#c4b5fd;font-weight:600;margin-bottom:4px">💰 Total Venc. Base</div>
            <div style="font-size:20px;font-weight:900;color:#a78bfa">${fmtBRL(gtProv - gtGratif)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${gtProv>0?((gtProv-gtGratif)/gtProv*100).toFixed(1):0}% dos proventos</div>
          </div>` : ''}
          ${gtGratif > 0 ? `<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#fcd34d;font-weight:600;margin-bottom:4px">⭐ Gratificações</div>
            <div style="font-size:20px;font-weight:900;color:#f59e0b">${fmtBRL(gtGratif)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${gtProv>0?(gtGratif/gtProv*100).toFixed(1):0}% dos proventos</div>
          </div>` : ''}
          <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#86efac;font-weight:600;margin-bottom:4px">✅ Total de Proventos</div>
            <div style="font-size:20px;font-weight:900;color:#22c55e">${fmtBRL(gtProv)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">bruto total</div>
          </div>
          <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#fca5a5;font-weight:600;margin-bottom:4px">🔻 Total de Descontos</div>
            <div style="font-size:20px;font-weight:900;color:#ef4444">${fmtBRL(gtDesc)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${gtProv > 0 ? (gtDesc/gtProv*100).toFixed(1) : '0'}% dos proventos</div>
          </div>
          <div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:12px;padding:14px 16px;text-align:center">
            <div style="font-size:11px;color:#7dd3fc;font-weight:600;margin-bottom:4px">💎 Total Líquido a Pagar</div>
            <div style="font-size:20px;font-weight:900;color:#38bdf8">${fmtBRL(gtLiq)}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${gtProv > 0 ? (gtLiq/gtProv*100).toFixed(1) : '0'}% dos proventos</div>
          </div>
        </div>
      </div>
      <!-- linhas de custo por órgão -->
      <div style="padding:0">
        <div style="padding:10px 18px;background:#0a1628;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Custo detalhado por órgão</div>
        ${orgRows}
      </div>
      <!-- detalhamento por UO -->
      ${uoSection}
      <!-- rodapé com total -->
      <div style="background:linear-gradient(90deg,#0d1f35,#071120);padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-top:2px solid #1e3a5f">
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          ${gtGratif > 0 ? `<span style="font-size:13px;color:#94a3b8">💰 VB: <strong style="color:#a78bfa">${fmtBRL(gtProv - gtGratif)}</strong></span>` : ''}
          ${gtGratif > 0 ? `<span style="font-size:13px;color:#94a3b8">⭐ Gratif.: <strong style="color:#f59e0b">${fmtBRL(gtGratif)}</strong></span>` : ''}
          <span style="font-size:13px;color:#94a3b8">Proventos: <strong style="color:#22c55e">${fmtBRL(gtProv)}</strong></span>
          <span style="font-size:13px;color:#94a3b8">Descontos: <strong style="color:#ef4444">${fmtBRL(gtDesc)}</strong></span>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#64748b;margin-bottom:2px">TOTAL LÍQUIDO GERAL</div>
          <div style="font-size:26px;font-weight:900;color:#38bdf8">${fmtBRL(gtLiq)}</div>
        </div>
      </div>
    </div>`;
  }

  const summaryMatrix = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
    <div style="padding:12px 16px;background:#151f35;font-size:13px;font-weight:800">📊 Resumo por Órgão e Categoria</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#0f172a">
        <th style="padding:8px 12px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Órgão</th>
        <th style="padding:8px 12px;text-align:center;color:var(--accent);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Cargos Efetivos</th>
        <th style="padding:8px 12px;text-align:center;color:var(--ok);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Cargos Comissionados</th>
        <th style="padding:8px 12px;text-align:center;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Total</th>
      </tr></thead>
      <tbody>
        ${matrixRows}
        <tr style="background:#151f35;border-top:2px solid var(--border)">
          <td style="padding:9px 12px;font-weight:800">TOTAL GERAL</td>
          <td style="padding:9px 12px;text-align:center;font-weight:800;color:var(--accent)">${totalEf} cargos</td>
          <td style="padding:9px 12px;text-align:center;font-weight:800;color:var(--ok)">${totalCom} cargos</td>
          <td style="padding:9px 12px;text-align:center;font-weight:900;font-size:15px">${totalEf+totalCom}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

  // ── painel financeiro com mini gráfico ──────────────────
  const finOrgData = _useOrgTotals
    ? orgaosVisiveis.slice(0, 10).map(o => ({
        org:   o.nome,
        prov:  parseFloat(o.total_proventos_folha || 0),
        desc:  parseFloat(o.total_descontos_folha || 0),
        liq:   parseFloat(o.total_liquido_folha   || 0),
        grat:  _gratByOrg(o.nome),
        total: parseFloat(o.total_proventos_folha || 0),
      }))
    : visOrgs.map(org => {
        const rowData = data.filter(c => (c.orgao_nome||'Sem Órgão') === org);
        const prov = rowData.reduce((a, c) => a + _prov(c), 0);
        const desc = rowData.reduce((a, c) => a + _desc(c), 0);
        const liq  = rowData.reduce((a, c) => a + _liq(c), 0);
        const grat = rowData.reduce((a, c) => a + _gratif(c), 0);
        return { org, prov, desc, liq, grat, total: prov };
      }).filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

  const maxFinVal = finOrgData.reduce((m, d) => Math.max(m, d.total), 0) || 1;

  const finRows = finOrgData.map(d => {
    const vb       = Math.max(0, d.prov - d.grat);
    const pctVb    = (vb      / maxFinVal * 100).toFixed(1);
    const pctGrat  = (d.grat  / maxFinVal * 100).toFixed(1);
    const pctDesc  = (d.desc  / maxFinVal * 100).toFixed(1);
    const pctLiq   = (d.liq   / maxFinVal * 100).toFixed(1);
    const shortOrg = d.org.length > 30 ? d.org.substring(0, 29) + '…' : d.org;
    return `
    <div style="display:grid;grid-template-columns:170px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(d.org)}">${escHtml(shortOrg)}</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <!-- VB + Gratif na mesma barra bicolor -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:#1e293b;border-radius:5px;height:10px;overflow:hidden;display:flex;min-width:0">
            <div style="width:${pctVb}%;min-width:${vb>0?'4px':'0'};height:100%;background:linear-gradient(90deg,#a78bfa,#7c3aed);flex-shrink:0"></div>
            <div style="width:${pctGrat}%;min-width:${d.grat>0?'4px':'0'};height:100%;background:linear-gradient(90deg,#f59e0b,#d97706);flex-shrink:0"></div>
          </div>
          <span style="font-size:10px;white-space:nowrap">${vb>0?`<span style="color:#a78bfa">VB: ${fmtBRL(vb)}</span>`:''} ${vb>0&&d.grat>0?'<span style="color:#475569">+</span>':''} ${d.grat>0?`<span style="color:#f59e0b">⭐ ${fmtBRL(d.grat)}</span>`:''}</span>
        </div>
        <!-- Descontos -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:#1e293b;border-radius:5px;height:7px;overflow:hidden">
            <div style="width:${pctDesc}%;min-width:${d.desc>0?'4px':'0'};height:100%;background:linear-gradient(90deg,#ef4444,#dc2626);border-radius:5px"></div>
          </div>
          <span style="font-size:10px;color:#ef4444;white-space:nowrap">${d.desc > 0 ? '▼ '+fmtBRL(d.desc) : '<span style="color:#334155">—</span>'}</span>
        </div>
        <!-- Líquido -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:#1e293b;border-radius:5px;height:7px;overflow:hidden">
            <div style="width:${pctLiq}%;min-width:${d.liq>0?'4px':'0'};height:100%;background:linear-gradient(90deg,#38bdf8,#0ea5e9);border-radius:5px"></div>
          </div>
          <span style="font-size:10px;color:#38bdf8;font-weight:700;white-space:nowrap">💎 ${fmtBRL(d.liq)}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;padding-left:8px;border-left:1px solid #1e293b">
        <div style="font-size:9px;color:#475569;margin-bottom:2px">Líquido</div>
        <div style="font-size:14px;font-weight:900;color:#38bdf8;white-space:nowrap">${fmtBRL(d.liq)}</div>
        ${d.prov>0?`<div style="font-size:9px;color:#64748b;margin-top:3px">${(d.liq/d.prov*100).toFixed(0)}% dos prov.</div>`:''}
      </div>
    </div>`;
  }).join('');

  const financialPanel = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;background:linear-gradient(90deg,#0d2b1e,#0f172a);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="font-size:13px;font-weight:800;color:#22C55E">💰 Folha Salarial — Visão Financeira</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${totalVencBase>0?`<span style="font-size:11px;color:var(--muted)">💰 VB: <strong style="color:#a78bfa">${fmtBRL(totalVencBase)}</strong></span>`:''}
        ${totalGratif>0?`<span style="font-size:11px;color:var(--muted)">⭐ Gratif.: <strong style="color:#F59E0B">${fmtBRL(totalGratif)}</strong></span>`:''}
        <span style="font-size:11px;color:var(--muted)">Proventos: <strong style="color:#22C55E">${fmtBRL(totalProv)}</strong></span>
        <span style="font-size:11px;color:var(--muted)">Descontos: <strong style="color:#EF4444">${fmtBRL(totalDesc)}</strong></span>
        <span style="font-size:11px;color:var(--muted)">Líquido: <strong style="color:#38bdf8">${fmtBRL(totalLiq)}</strong></span>
      </div>
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <div style="display:grid;grid-template-columns:repeat(${(totalVencBase>0?1:0)+(totalGratif>0?1:0)+3},minmax(130px,1fr));gap:1px;background:var(--border);min-width:${(totalVencBase>0?1:0)+(totalGratif>0?1:0)+3}00px">
      ${totalVencBase > 0 ? `<div style="padding:16px;background:var(--card);text-align:center">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#c4b5fd;margin-bottom:6px">💰 Venc. Base</div>
        <div style="font-size:20px;font-weight:900;color:#a78bfa">${fmtBRL(totalVencBase)}</div>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">${totalProv>0?(totalVencBase/totalProv*100).toFixed(1):0}% dos proventos</div>
      </div>` : ''}
      ${totalGratif > 0 ? `<div style="padding:16px;background:var(--card);text-align:center">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fcd34d;margin-bottom:6px">⭐ Gratificações</div>
        <div style="font-size:20px;font-weight:900;color:#F59E0B">${fmtBRL(totalGratif)}</div>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">${totalProv>0?(totalGratif/totalProv*100).toFixed(1):0}% dos proventos</div>
      </div>` : ''}
      <div style="padding:16px;background:var(--card);text-align:center">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#86efac;margin-bottom:6px">✅ Proventos Totais</div>
        <div style="font-size:20px;font-weight:900;color:#22C55E">${fmtBRL(totalProv)}</div>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">${gtServRel.toLocaleString('pt-BR')} servidores</div>
      </div>
      <div style="padding:16px;background:var(--card);text-align:center">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px">🔻 Descontos Totais</div>
        <div style="font-size:20px;font-weight:900;color:#EF4444">${fmtBRL(totalDesc)}</div>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">${totalProv>0?(totalDesc/totalProv*100).toFixed(1):0}% dos proventos</div>
      </div>
      <div style="padding:16px;background:var(--card);text-align:center">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px">💎 Líquido a Pagar</div>
        <div style="font-size:20px;font-weight:900;color:#38bdf8">${fmtBRL(totalLiq)}</div>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">${totalProv>0?(totalLiq/totalProv*100).toFixed(1):0}% dos proventos</div>
      </div>
    </div>
    </div>
    ${totalProv > 0 ? `
    <div style="padding:12px 18px 6px">
      <div style="display:flex;gap:2px;height:22px;border-radius:8px;overflow:hidden">
        <div style="width:${totalProv>0?(totalLiq/totalProv*100).toFixed(1):0}%;background:linear-gradient(90deg,#38bdf8,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;min-width:40px">
          ${totalProv>0?Math.round(totalLiq/totalProv*100):0}%
        </div>
        <div style="flex:1;background:linear-gradient(90deg,#EF4444,#dc2626);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff">
          ${totalProv>0?Math.round(totalDesc/totalProv*100):0}%
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:6px;padding-bottom:6px">
        <span style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#38bdf8;border-radius:2px;display:inline-block"></span> Líquido</span>
        <span style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#EF4444;border-radius:2px;display:inline-block"></span> Descontos</span>
      </div>
    </div>` : ''}
    ${finOrgData.length > 0 ? `
    <div style="padding:12px 18px 16px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">📊 Por Órgão (top ${finOrgData.length}) — Proventos (verde) / Descontos (vermelho) · Líquido à direita</div>
      ${finRows}
    </div>` : '<div style="padding:16px 18px;color:var(--dim);font-size:12px;">Nenhum valor salarial cadastrado ainda.</div>'}
  </div>`;

  // ── painel: filtro de categoria ──────────────────────────
  const cs = s.catSel;
  const catFilterPanel = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">🏷️ Filtrar por Categoria</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;background:${cs.efetivo?'#3b82f622':'var(--card)'};border:1px solid ${cs.efetivo?'var(--accent)':'var(--border)'};border-radius:8px">
        <input type="checkbox" ${cs.efetivo?'checked':''} onchange="contRelState.catSel.efetivo=this.checked;_contRelRender()" style="width:16px;height:16px;accent-color:var(--accent)">
        <span style="font-size:13px;font-weight:${cs.efetivo?'700':'500'}">👤 Efetivos</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;background:${cs.comissionado?'#16a34a22':'var(--card)'};border:1px solid ${cs.comissionado?'var(--ok)':'var(--border)'};border-radius:8px">
        <input type="checkbox" ${cs.comissionado?'checked':''} onchange="contRelState.catSel.comissionado=this.checked;_contRelRender()" style="width:16px;height:16px;accent-color:var(--ok)">
        <span style="font-size:13px;font-weight:${cs.comissionado?'700':'500'}">🎖️ Comissionados</span>
      </label>
    </div>
  </div>`;

  // ── painel: filtro de órgão ──────────────────────────────
  const orgFilterPanel = `
  <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">🏛️ Filtrar por Órgão</div>
      <div style="display:flex;gap:6px">
        <button onclick="_contRelSelectAllOrgs(true)"  style="padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer;font-weight:700">✓ Todos</button>
        <button onclick="_contRelSelectAllOrgs(false)" style="padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--muted);cursor:pointer;font-weight:700">✗ Nenhum</button>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${allOrgs.map(org => {
        const sel = s.orgaoSel[org] !== false;
        const jk  = org.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 10px;background:${sel?'var(--teal2)22':'var(--card)'};border:1px solid ${sel?'var(--teal2)':'var(--border)'};border-radius:8px;font-size:12px;font-weight:${sel?'600':'400'}">
          <input type="checkbox" ${sel?'checked':''} onchange="contRelState.orgaoSel['${jk}']=this.checked;_contRelRender()" style="width:14px;height:14px;accent-color:var(--teal2)">
          ${escHtml(org)}
        </label>`;
      }).join('')}
    </div>
  </div>`;

  // ── listagem detalhada com subtotais ─────────────────────
  let detailHtml = '';
  if (s.showCargo || s.showUnidade || s.showNomes || s.showMatricula || s.showVencimento || s.showGratificacao) {
    const thS = 'padding:7px 10px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)';
    const tdS = 'padding:6px 10px;font-size:12px';
    const badge = cat => `<span style="background:${cat==='comissionado'?'#16a34a22':'#3b82f622'};color:${cat==='comissionado'?'var(--ok)':'var(--accent)'};border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700">${cat==='comissionado'?'Comissionado':'Efetivo'}</span>`;

    let colCount = 1; // nome ou qtd — sempre 1
    if (s.showOrgao)      colCount++;
    if (s.showCat)        colCount++;
    if (s.showMatricula)  colCount++;
    if (s.showCargo)      colCount++;
    if (s.showUnidade)    colCount++;
    if (s.showVencBase)      colCount++;
    if (s.showGratif)         colCount++;
    if (s.showVencimento)    colCount++;
    if (s.showGratificacao)  colCount++;
    const showTotal = s.showVencimento || s.showGratif || s.showGratificacao || s.showLiquido || s.showVencBase;
    if (s.showLiquido || (s.showVencimento && s.showGratificacao)) colCount++;

    // No outer thead — headers appear only inside each category block
    const theadCols = '';

    // Helper: busca totais financeiros apenas dos registros individuais exibidos no detalhe
    const _orgFin = nm => {
      const recs = data.filter(c => (c.orgao_nome||'Sem Órgão') === nm);
      return { prov: recs.reduce((a,c)=>a+_prov(c),0), desc: recs.reduce((a,c)=>a+_desc(c),0), liq: recs.reduce((a,c)=>a+_liq(c),0) };
    };
    let finColCount = 0;
    if (s.showVencBase)     finColCount++;
    if (s.showGratif)       finColCount++;
    if (s.showVencimento)   finColCount++;
    if (s.showGratificacao) finColCount++;
    if (s.showLiquido || (s.showVencimento && s.showGratificacao)) finColCount++;
    const nonFinCols = Math.max(1, colCount - finColCount);

    // Agrupar por órgão
    const orgMap = {};
    for (const c of data) {
      const org = c.orgao_nome || 'Sem Órgão';
      if (!orgMap[org]) orgMap[org] = { efetivo: [], comissionado: [] };
      orgMap[org][c.categoria === 'comissionado' ? 'comissionado' : 'efetivo'].push(c);
    }

    let tbodyRows = '';
    for (const orgNome of Object.keys(orgMap).sort((a,b) => a.localeCompare(b,'pt-BR'))) {
      const { efetivo, comissionado } = orgMap[orgNome];
      const orgTotal = efetivo.length + comissionado.length;
      const orgFin = _orgFin(orgNome);

        const _orgVB = orgFin.prov - _gratByOrg(orgNome);
        const orgFinCols = [];
        if (s.showVencBase)     orgFinCols.push(`<td style="padding:9px 10px;text-align:right;color:#a78bfa;font-weight:700;font-size:11px;white-space:nowrap">${_orgVB>0?fmtBRL(_orgVB):'—'}</td>`);
        if (s.showGratif)       orgFinCols.push(`<td style="padding:9px 10px;text-align:right;color:#F59E0B;font-weight:700;font-size:11px;white-space:nowrap">${_gratByOrg(orgNome)>0?fmtBRL(_gratByOrg(orgNome)):'—'}</td>`);
        if (s.showVencimento)   orgFinCols.push(`<td style="padding:9px 10px;text-align:right;color:#22C55E;font-weight:700;font-size:11px;white-space:nowrap">${orgFin.prov>0?fmtBRL(orgFin.prov):'—'}</td>`);
        if (s.showGratificacao) orgFinCols.push(`<td style="padding:9px 10px;text-align:right;color:#EF4444;font-weight:700;font-size:11px;white-space:nowrap">${orgFin.desc>0?fmtBRL(orgFin.desc):'—'}</td>`);
        if (s.showLiquido||(s.showVencimento&&s.showGratificacao)) orgFinCols.push(`<td style="padding:9px 10px;text-align:right;color:#38bdf8;font-weight:800;font-size:13px;white-space:nowrap">${orgFin.liq>0?fmtBRL(orgFin.liq):'—'}</td>`);

      // Cabeçalho do órgão — só o nome (totais vão no subtotal ao final)
      tbodyRows += `<tr style="background:#151f35">
        <td colspan="${colCount}" style="padding:9px 14px;font-weight:800;font-size:13px;letter-spacing:.2px">🏛️ ${escHtml(orgNome)}</td>
      </tr>`;

      if (s.showNomes) {
        // ── modo nomes: uma linha por servidor agrupada por categoria ──
        const cats = [];
        if (efetivo.length)     cats.push({ label:'👤 Cargos Efetivos',     color:'var(--accent)', rows: efetivo });
        if (comissionado.length) cats.push({ label:'🎖️ Cargos Comissionados', color:'var(--ok)',    rows: comissionado });
        for (const { label, color, rows } of cats) {
          tbodyRows += `<tr style="background:#0d1a30">
            <td colspan="${colCount}" style="padding:5px 14px 5px 28px;font-size:11px;font-weight:800;color:${color}">${label === '👤 Efetivos' ? '👤 Cargos Efetivos' : '🎖️ Cargos Comissionados'} (${rows.length})</td>
          </tr>`;
          // ── cabeçalho de colunas dentro do bloco ─────────────────
          tbodyRows += `<tr style="background:#0a1628">`;
          tbodyRows += `<th style="${thS}">Nome</th>`;
          if (s.showMatricula)    tbodyRows += `<th style="${thS}">Matrícula</th>`;
          if (s.showCargo)        tbodyRows += `<th style="${thS}">Cargo</th>`;
          if (s.showCat)          tbodyRows += `<th style="${thS}">Categoria</th>`;
          if (s.showUnidade)      tbodyRows += `<th style="${thS}">Unidade Orçamentária</th>`;
          if (s.showOrgao)        tbodyRows += `<th style="${thS}">Órgão</th>`;
          if (s.showVencBase)     tbodyRows += `<th style="${thS};text-align:right;color:#a78bfa">Venc. Base</th>`;
          if (s.showGratif)       tbodyRows += `<th style="${thS};text-align:right;color:#F59E0B">Gratificações</th>`;
          if (s.showVencimento)   tbodyRows += `<th style="${thS};text-align:right;color:#22C55E">Proventos</th>`;
          if (s.showGratificacao) tbodyRows += `<th style="${thS};text-align:right;color:#EF4444">Descontos</th>`;
          if (s.showLiquido||showTotal) tbodyRows += `<th style="${thS};text-align:right;color:#38bdf8">Líquido</th>`;
          tbodyRows += `</tr>`;
          rows.sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR')).forEach(c => {
            const pR  = _prov(c);
            const dR  = _desc(c);
            const lR  = _liq(c);
            const gR  = _gratif(c);
            const vbR = _vencBase(c);
            let tds = `<td style="${tdS};font-weight:600">${escHtml(c.nome)}</td>`;
            if (s.showMatricula)  tds += `<td style="${tdS};color:var(--teal2);font-weight:700">${escHtml(c.matricula||'—')}</td>`;
            if (s.showCargo)      tds += `<td style="${tdS};color:var(--muted)">${escHtml(c.cargo||'—')}</td>`;
            if (s.showCat)        tds += `<td style="${tdS}">${badge(c.categoria)}</td>`;
            if (s.showUnidade)    tds += `<td style="${tdS};color:var(--muted);font-size:11px">${escHtml(c.unidade_orcamentaria||'—')}</td>`;
            if (s.showOrgao)      tds += `<td style="${tdS}">${escHtml(c.orgao_nome||'Sem Órgão')}</td>`;
            if (s.showVencBase)   tds += `<td style="${tdS};text-align:right;color:#a78bfa;font-weight:700">${vbR > 0 ? fmtBRL(vbR) : '—'}</td>`;
            if (s.showGratif)     tds += `<td style="${tdS};text-align:right;color:#F59E0B;font-weight:700">${gR > 0 ? fmtBRL(gR) : '—'}</td>`;
            if (s.showVencimento) tds += `<td style="${tdS};text-align:right;color:#22C55E;font-weight:700">${pR > 0 ? fmtBRL(pR) : '—'}</td>`;
            if (s.showGratificacao) tds += `<td style="${tdS};text-align:right;color:#EF4444;font-weight:700">${dR > 0 ? fmtBRL(dR) : '—'}</td>`;
            if (s.showLiquido||showTotal) tds += `<td style="${tdS};text-align:right;color:#38bdf8;font-weight:800">${lR > 0 ? fmtBRL(lR) : '—'}</td>`;
            tbodyRows += `<tr style="border-bottom:1px solid #1a2840">${tds}</tr>`;
          });
        }
      } else {
        // ── modo agregado: grupos únicos dentro do órgão ──
        const subGroups = {};
        for (const c of [...efetivo, ...comissionado]) {
          const parts = [];
          if (s.showCargo)   parts.push(c.cargo||'—');
          if (s.showCat)     parts.push(c.categoria);
          if (s.showUnidade) parts.push(c.unidade_orcamentaria||'—');
          if (s.showOrgao)   parts.push(c.orgao_nome||'Sem Órgão');
          const key = parts.join('\x00');
          if (!subGroups[key]) subGroups[key] = { parts: [...parts], count: 0, prov: 0, desc: 0, liq: 0, grat: 0 };
          subGroups[key].count++;
          subGroups[key].prov += _prov(c);
          subGroups[key].desc += _desc(c);
          subGroups[key].liq  += _liq(c);
          subGroups[key].grat += _gratif(c);
        }
        // Sempre distribui o total oficial do órgão proporcionalmente:
        // ratio = prov individual (se existir) ou count
        const sgList = Object.values(subGroups);
        const sgProvSum = sgList.reduce((a,g)=>a+g.prov,0);
        const sgGratSum = sgList.reduce((a,g)=>a+g.grat,0);
        if (orgFin.prov > 0) {
          const totalCount = sgList.reduce((a,g)=>a+g.count,0) || 1;
          sgList.forEach(g => {
            const ratio = sgProvSum > 0 ? g.prov / sgProvSum : g.count / totalCount;
            const ratioG = sgGratSum > 0 ? g.grat / sgGratSum : g.count / totalCount;
            g.prov = orgFin.prov * ratio;
            g.desc = orgFin.desc * ratio;
            g.liq  = orgFin.liq  * ratio;
            g.grat = _gratByOrg(orgNome) * ratioG;
          });
        }
        Object.keys(subGroups).sort().forEach(key => {
          const { parts, count, prov, desc, liq, grat } = subGroups[key];
          let pi = 0, tds = '';
          tds += `<td style="${tdS};text-align:center;font-weight:800;font-size:14px">${count}</td>`;
          if (s.showMatricula)  tds += `<td style="${tdS};color:var(--teal2)">—</td>`;
          if (s.showCargo)      { tds += `<td style="${tdS};color:var(--muted)">${escHtml(parts[pi++])}</td>`; }
          if (s.showCat)        { const cat = parts[pi++]; tds += `<td style="${tdS}">${badge(cat)}</td>`; }
          if (s.showUnidade)    tds += `<td style="${tdS};color:var(--muted);font-size:11px">${escHtml(parts[pi++])}</td>`;
          if (s.showOrgao)      tds += `<td style="${tdS}">${escHtml(parts[pi++])}</td>`;
          if (s.showVencBase)     tds += `<td style="${tdS};text-align:right;color:#a78bfa;font-weight:700">${(prov-grat)>0?fmtBRL(prov-grat):'—'}</td>`;
          if (s.showGratif)       tds += `<td style="${tdS};text-align:right;color:#F59E0B;font-weight:700">${grat>0?fmtBRL(grat):'—'}</td>`;
          if (s.showVencimento)   tds += `<td style="${tdS};text-align:right;color:#22C55E;font-weight:700">${prov>0?fmtBRL(prov):'—'}</td>`;
          if (s.showGratificacao) tds += `<td style="${tdS};text-align:right;color:#EF4444;font-weight:700">${desc>0?fmtBRL(desc):'—'}</td>`;
          if (s.showLiquido || (s.showVencimento && s.showGratificacao)) tds += `<td style="${tdS};text-align:right;color:#38bdf8;font-weight:800">${liq>0?fmtBRL(liq):'—'}</td>`;
          tbodyRows += `<tr style="border-bottom:1px solid #1a2840">${tds}</tr>`;
        });
      }

      // ── subtotal do órgão com totais financeiros ──
      const subParts = [];
      if (efetivo.length)     subParts.push(`<span style="color:var(--accent);font-weight:800">${efetivo.length} efetivo(s)</span>`);
      if (comissionado.length) subParts.push(`<span style="color:var(--ok);font-weight:800">${comissionado.length} comissionado(s)</span>`);
      tbodyRows += `<tr style="background:#1a2f4a;border-top:3px solid var(--teal2);border-bottom:2px solid #0f172a">
        <td colspan="${nonFinCols}" style="padding:8px 14px;font-size:12px;color:var(--dim)">
          <span style="font-size:11px;font-weight:800;color:var(--text)">📊 Subtotal ${escHtml(orgNome)}</span> · ${subParts.join(' · ')} · <span style="color:var(--text);font-size:14px;font-weight:900">${orgTotal} serv.</span>
        </td>
        ${orgFinCols.join('')}
      </tr>
      <tr style="height:16px;background:transparent"><td colspan="${nonFinCols + finColCount}"></td></tr>`;
    }

    const grandVB   = data.reduce((a,c) => a + _vencBase(c), 0);
    const grandGrat = data.reduce((a,c) => a + _gratif(c),   0);
    const grandProv = data.reduce((a,c) => a + _prov(c),     0);
    const grandDesc = data.reduce((a,c) => a + _desc(c),     0);
    const grandLiq  = data.reduce((a,c) => a + _liq(c),      0);
    const theadRow = `<tr style="background:#0a1628;position:sticky;top:0;z-index:2">
      <th style="${thS}${s.showNomes?'':';text-align:center'}">${s.showNomes?'Nome':'Qtd'}</th>
      ${s.showMatricula?`<th style="${thS}">Matrícula</th>`:''}
      ${s.showCargo?`<th style="${thS}">Cargo</th>`:''}
      ${s.showCat?`<th style="${thS}">Categoria</th>`:''}
      ${s.showUnidade?`<th style="${thS}">Unid. Orçamentária</th>`:''}
      ${s.showOrgao?`<th style="${thS}">Órgão</th>`:''}
      ${s.showVencBase?`<th style="${thS};text-align:right;color:#a78bfa">💰 Venc. Base</th>`:''}
      ${s.showGratif?`<th style="${thS};text-align:right;color:#F59E0B">⭐ Gratif.</th>`:''}
      ${s.showVencimento?`<th style="${thS};text-align:right;color:#22C55E">Proventos</th>`:''}
      ${s.showGratificacao?`<th style="${thS};text-align:right;color:#EF4444">🔻 Descontos</th>`:''}
      ${(s.showLiquido||showTotal)?`<th style="${thS};text-align:right;color:#38bdf8">Líquido</th>`:''}
    </tr>`;
    const tfootRow = `<tr style="background:linear-gradient(90deg,#0d1f35,#071120);border-top:3px solid #334155">
      <td colspan="${nonFinCols}" style="padding:10px 14px;font-size:13px;font-weight:900;color:#f1f5f9;letter-spacing:.2px">🏆 TOTAL GERAL — ${data.length} servidor(es)</td>
      ${s.showVencBase?`<td style="padding:10px 10px;text-align:right;font-weight:900;font-size:13px;color:#a78bfa;white-space:nowrap">${grandVB>0?fmtBRL(grandVB):'—'}</td>`:''}
      ${s.showGratif?`<td style="padding:10px 10px;text-align:right;font-weight:900;font-size:13px;color:#F59E0B;white-space:nowrap">${grandGrat>0?fmtBRL(grandGrat):'—'}</td>`:''}
      ${s.showVencimento?`<td style="padding:10px 10px;text-align:right;font-weight:900;font-size:13px;color:#22C55E;white-space:nowrap">${fmtBRL(grandProv)}</td>`:''}
      ${s.showGratificacao?`<td style="padding:10px 10px;text-align:right;font-weight:900;font-size:13px;color:#EF4444;white-space:nowrap">${grandDesc>0?fmtBRL(grandDesc):'—'}</td>`:''}
      ${(s.showLiquido||(s.showVencimento&&s.showGratificacao))?`<td style="padding:10px 14px;text-align:right;font-weight:900;font-size:16px;color:#38bdf8;white-space:nowrap">${fmtBRL(grandLiq)}</td>`:''}
    </tr>`;
    detailHtml = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
      <div style="padding:12px 16px;background:#151f35;font-size:13px;font-weight:800">📋 Listagem Detalhada — ${data.length} servidor(es)</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>${theadRow}</thead>
          <tbody>${tbodyRows}</tbody>
          <tfoot>${tfootRow}</tfoot>
        </table>
      </div>
    </div>`;
  }

  // ── vagas panel ──────────────────────────────────────────
  const vagasAll = contState.cargoVagas;
  let vagasPanelHtml = '';
  // Ocultar quando filtro de texto ativo: vagas é conceito organizacional,
  // não faz sentido em buscas por nome/cargo/UO individuais
  if (vagasAll.length > 0 && !_textFilterActive) {
    const _vagasOrgs = visOrgs;
    const vOrgData = _vagasOrgs.map(orgNome => {
      const vs = vagasAll.filter(v => (v.org_nome || '') === orgNome);
      const disp = vs.reduce((s,v) => s + (parseInt(v.quantidade_disponivel)||0), 0);
      const ocup = vs.reduce((s,v) => s + (parseInt(v.ocupados)||0), 0);
      if (disp === 0 && ocup === 0) return null;
      const rest = Math.max(0, disp - ocup);
      return { orgNome, disp, ocup, rest, vagas: vs };
    }).filter(Boolean);

    const totalVDisp = vOrgData.reduce((s,d) => s + d.disp, 0);
    const totalVOcup = vOrgData.reduce((s,d) => s + d.ocup, 0);
    const totalVRest = Math.max(0, totalVDisp - totalVOcup);

    const vagasRows = vOrgData.map(d => {
      const pct = d.disp > 0 ? Math.round(d.ocup / d.disp * 100) : 0;
      const barColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#22C55E';
      return `<tr>
        <td style="padding:7px 12px;font-weight:600;font-size:12px">${escHtml(d.orgNome)}</td>
        <td style="padding:7px 12px;text-align:center;font-weight:700;color:#8B5CF6;font-size:12px">${d.disp}</td>
        <td style="padding:7px 12px;text-align:center;font-weight:700;color:${d.ocup>=d.disp&&d.disp>0?'#EF4444':'var(--text)'};font-size:12px">${d.ocup}</td>
        <td style="padding:7px 12px;text-align:center;font-weight:700;color:${d.rest===0&&d.disp>0?'#EF4444':'#22C55E'};font-size:12px">${d.rest}</td>
        <td style="padding:7px 12px;min-width:110px">
          <div style="background:#1a2840;border-radius:3px;height:6px;overflow:hidden"><div style="background:${barColor};height:100%;width:${Math.min(100,pct)}%"></div></div>
          <div style="font-size:10px;color:var(--dim);text-align:center;margin-top:2px">${pct}%</div>
        </td>
      </tr>`;
    }).join('');

    vagasPanelHtml = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
      <div style="padding:12px 16px;background:#151f35;font-size:13px;font-weight:800;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>📂 Controle de Vagas por Órgão</span>
        <div style="display:flex;gap:16px;font-size:11px">
          <span style="color:#8B5CF6">Disponíveis: <strong>${totalVDisp}</strong></span>
          <span style="color:var(--teal2)">Ocupados: <strong>${totalVOcup}</strong></span>
          <span style="color:${totalVRest===0&&totalVDisp>0?'#EF4444':'#22C55E'}">Restantes: <strong>${totalVRest}</strong></span>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#0f172a">
            <th style="padding:8px 12px;text-align:left;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border)">Órgão</th>
            <th style="padding:8px 12px;text-align:center;color:#8B5CF6;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border)">Vagas Disponíveis</th>
            <th style="padding:8px 12px;text-align:center;color:var(--teal2);font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border)">Cargos Ocupados</th>
            <th style="padding:8px 12px;text-align:center;color:#22C55E;font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border)">Vagas Restantes</th>
            <th style="padding:8px 12px;text-align:center;color:var(--dim);font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border)">Ocupação</th>
          </tr></thead>
          <tbody>${vagasRows}</tbody>
        </table>
      </div>
      <button onclick="ciGoSectionPage('cont-vagas')" style="display:block;width:100%;padding:10px;background:transparent;border:none;border-top:1px solid var(--border);color:var(--teal2);font-size:12px;font-weight:700;cursor:pointer;text-align:center">📋 Gerenciar Cargos e Vagas →</button>
    </div>`;
  }

  // ── checkboxes de colunas ────────────────────────────────
  const chk = (field, label, icon) => `
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;background:${s[field]?'var(--teal2)22':'var(--card)'};border:1px solid ${s[field]?'var(--teal2)':'var(--border)'};border-radius:8px;transition:all.2s">
    <input type="checkbox" ${s[field]?'checked':''} onchange="contRelState['${field}']=this.checked;_contRelRender()" style="width:16px;height:16px;accent-color:var(--teal2)">
    <span style="font-size:13px;font-weight:${s[field]?'700':'500'}">${icon} ${label}</span>
  </label>`;

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:1100px;margin:0 auto">
    ${ciFuncModuleTabs('rel')}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">📊 Relatório de Contratados</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${data.length} vínculo(s)${activeRelFilters > 0 ? ` · <span style="color:#f59e0b;font-weight:700">⚡ ${activeRelFilters} filtro(s) de busca ativo(s)</span>` : ` — ${totalEf} efetivos · ${totalCom} comissionados`}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-list')">👥 Ver Lista</button>
        <button onclick="contRelPdf()" style="padding:9px 18px;background:#EF4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">📄 Gerar PDF</button>
        <button onclick="contVerificarVBSwap()" style="padding:9px 18px;background:#7C3AED;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer" title="Detecta servidores com Vencimento Base e Gratificação invertidos">🔍 Verificar VB</button>
      </div>
    </div>
    <!-- Painel de filtros de busca -->
    <div style="background:var(--card);border:1px solid ${activeRelFilters>0?'rgba(245,158,11,.4)':'var(--border)'};border-radius:12px;padding:14px 18px;margin-bottom:12px${activeRelFilters>0?';box-shadow:0 0 0 2px rgba(245,158,11,.1)':''}">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">🔍 Filtros de Busca${activeRelFilters>0?` <span style="color:#f59e0b">— ${activeRelFilters} ativo(s)</span>`:''}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:160px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">📝 Nome</label>
          <input type="text" id="crel-s-nome" class="search-box" style="width:100%" placeholder="Buscar por nome…" value="${escHtml(s.searchNome)}" autocomplete="off">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:150px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">💼 Cargo</label>
          <input type="text" id="crel-s-cargo" list="crel-dl-cargo" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(s.searchCargo)}" autocomplete="off">
          <datalist id="crel-dl-cargo">${dlOptsRel(uniqueRelCargos)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:3;min-width:180px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">📂 Unid. Orçamentária</label>
          <input type="text" id="crel-s-uo" list="crel-dl-uo" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(s.searchUO)}" autocomplete="off">
          <datalist id="crel-dl-uo">${dlOptsRel(uniqueRelUOs)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:2;min-width:150px">
          <label style="font-size:10px;color:var(--dim);font-weight:600;text-transform:uppercase">🏛️ Órgão</label>
          <input type="text" id="crel-s-orgao" list="crel-dl-orgao" class="search-box" style="width:100%" placeholder="Digite ou selecione…" value="${escHtml(s.searchOrgao)}" autocomplete="off">
          <datalist id="crel-dl-orgao">${dlOptsRel(uniqueRelOrgaos)}</datalist>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;justify-content:flex-end">
          <label style="font-size:10px;color:transparent">.</label>
          <button onclick="contRelLimparFiltros()" style="padding:8px 14px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#ef4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">✖ Limpar</button>
        </div>
      </div>
    </div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Exibir colunas</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${chk('showOrgao','Órgão','🏛️')}
        ${chk('showCat','Categoria','🏷️')}
        ${chk('showMatricula','Matrícula','🔖')}
        ${chk('showCargo','Cargo','💼')}
        ${chk('showUnidade','Unidade Orçamentária','📂')}
        ${chk('showVencBase','Venc. Base','💰')}
        ${chk('showGratif','Gratificações','⭐')}
        ${chk('showVencimento','Proventos','✅')}
        ${chk('showGratificacao','Descontos','🔻')}
        ${chk('showLiquido','Líquido','💎')}
        ${chk('showNomes','Nomes','👤')}
      </div>
    </div>
    ${catFilterPanel}
    ${orgFilterPanel}
    ${folhaCostoPanel}
    ${summaryMatrix}
    ${vagasPanelHtml}
    ${financialPanel}
    ${detailHtml}
  </div>`;

  // Re-attach search listeners every render (innerHTML is fully replaced)
  const _crel = id => document.getElementById(id);
  if (_crel('crel-s-nome')) {
    _crel('crel-s-nome').addEventListener('input', function(){ contRelState.searchNome=this.value; contRelState._lastFocus={id:'crel-s-nome',ss:this.selectionStart,se:this.selectionEnd}; clearTimeout(contRelState._ft); contRelState._ft=setTimeout(_contRelRender,250); });
    _crel('crel-s-cargo').addEventListener('input', function(){ contRelState.searchCargo=this.value; contRelState._lastFocus={id:'crel-s-cargo',ss:this.selectionStart,se:this.selectionEnd}; clearTimeout(contRelState._ft); contRelState._ft=setTimeout(_contRelRender,300); });
    _crel('crel-s-uo').addEventListener('input', function(){ contRelState.searchUO=this.value; contRelState._lastFocus={id:'crel-s-uo',ss:this.selectionStart,se:this.selectionEnd}; clearTimeout(contRelState._ft); contRelState._ft=setTimeout(_contRelRender,300); });
    _crel('crel-s-orgao').addEventListener('input', function(){ contRelState.searchOrgao=this.value; contRelState._lastFocus={id:'crel-s-orgao',ss:this.selectionStart,se:this.selectionEnd}; clearTimeout(contRelState._ft); contRelState._ft=setTimeout(_contRelRender,300); });
  }
  // Restaurar foco e posição do cursor após re-render
  if (contRelState._lastFocus) {
    const _lf = contRelState._lastFocus;
    contRelState._lastFocus = null;
    const _lfel = document.getElementById(_lf.id);
    if (_lfel) { _lfel.focus(); try { _lfel.setSelectionRange(_lf.ss, _lf.se); } catch(e){} }
  }
}

function contRelLimparFiltros() {
  contRelState.searchNome  = '';
  contRelState.searchCargo = '';
  contRelState.searchUO    = '';
  contRelState.searchOrgao = '';
  _contRelRender();
}

function contRelFolhaPdf() {
  const orgaosComFolha = contState.orgaos.filter(o =>
    parseFloat(o.total_proventos_folha || 0) > 0
  ).sort((a, b) => parseFloat(b.total_proventos_folha||0) - parseFloat(a.total_proventos_folha||0));

  if (!orgaosComFolha.length) {
    toast('Nenhum dado de folha disponível. Execute a importação primeiro.', 'warn');
    return;
  }

  const fmtPdf  = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum  = v => parseInt(v||0).toLocaleString('pt-BR');
  const gtProv  = orgaosComFolha.reduce((a, o) => a + parseFloat(o.total_proventos_folha  || 0), 0);
  const gtDesc  = orgaosComFolha.reduce((a, o) => a + parseFloat(o.total_descontos_folha  || 0), 0);
  const gtLiq   = orgaosComFolha.reduce((a, o) => a + parseFloat(o.total_liquido_folha    || 0), 0);
  const gtServ  = orgaosComFolha.reduce((a, o) => a + parseInt(o.total_servidores_folha   || 0), 0);
  const compSet = [...new Set(orgaosComFolha.map(o => o.ultima_competencia).filter(Boolean))];
  const compLabel = compSet.length === 1 ? compSet[0] : compSet.join(', ');

  const now   = new Date();
  const dtStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, margin = 14;
  let y = 0;

  const addPage = () => { doc.addPage(); y = 14; };
  const checkY = (need) => { if (y + need > 280) addPage(); };

  // ══════════ CAPA / CABEÇALHO ════════════════════════════════
  // Fundo degradê topo
  doc.setFillColor(10, 24, 48);
  doc.rect(0, 0, W, 60, 'F');
  doc.setFillColor(13, 34, 80);
  doc.rect(0, 40, W, 20, 'F');

  // Brasão / ícone (texto estilizado)
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA - PE', W / 2, 14, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text('Controle Interno Municipal', W / 2, 21, { align: 'center' });

  doc.setFillColor(59, 130, 246);
  doc.rect(margin, 26, W - margin * 2, 0.6, 'F');

  doc.setFontSize(16);
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE CUSTO DE PESSOAL', W / 2, 34, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(`Competência: ${compLabel || '—'}   |   Emitido em: ${dtStr}`, W / 2, 41, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${orgaosComFolha.length} órgão(s)   ·   ${fmtNum(gtServ)} servidores`, W / 2, 47, { align: 'center' });

  // Linha divisória
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 58, W, 2, 'F');
  y = 68;

  // ══════════ CARDS TOTAIS GERAIS ══════════════════════════════
  const cards = [
    { label: 'TOTAL DE SERVIDORES', value: fmtNum(gtServ),  unit: `${orgaosComFolha.length} órgão(s)`, bg: [13, 34, 80], hl: [59, 130, 246] },
    { label: 'TOTAL DE PROVENTOS',  value: fmtPdf(gtProv),  unit: 'bruto total',                         bg: [7, 30, 18],  hl: [34, 197, 94]  },
    { label: 'TOTAL DE DESCONTOS',  value: fmtPdf(gtDesc),  unit: `${gtProv>0?(gtDesc/gtProv*100).toFixed(1):0}% dos proventos`, bg: [40, 12, 12], hl: [239, 68, 68]   },
    { label: 'LÍQUIDO A PAGAR',     value: fmtPdf(gtLiq),   unit: `${gtProv>0?(gtLiq/gtProv*100).toFixed(1):0}% dos proventos`, bg: [7, 25, 38],  hl: [56, 189, 248]  },
  ];

  const cardW = (W - margin * 2 - 6) / 4;
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 2);
    doc.setFillColor(...c.bg);
    doc.roundedRect(cx, y, cardW, 28, 2, 2, 'F');
    doc.setFillColor(...c.hl);
    doc.rect(cx, y, cardW, 1.5, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...c.hl);
    doc.setFont('helvetica', 'bold');
    doc.text(c.label, cx + cardW / 2, y + 7, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(241, 245, 249);
    doc.text(c.value, cx + cardW / 2, y + 15, { align: 'center', maxWidth: cardW - 4 });
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(c.unit, cx + cardW / 2, y + 22, { align: 'center', maxWidth: cardW - 4 });
  });
  y += 34;

  // ══════════ TABELA: CUSTO POR ÓRGÃO ══════════════════════════
  checkY(20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(241, 245, 249);
  doc.setFillColor(13, 34, 80);
  doc.rect(margin, y, W - margin * 2, 8, 'F');
  doc.text('  RESUMO DE CUSTO POR ÓRGÃO', margin + 2, y + 5.5);
  y += 10;

  const orgBody = orgaosComFolha.map(o => {
    const prov = parseFloat(o.total_proventos_folha || 0);
    const desc = parseFloat(o.total_descontos_folha || 0);
    const liq  = parseFloat(o.total_liquido_folha   || 0);
    const serv = parseInt(o.total_servidores_folha  || 0);
    const pct  = gtProv > 0 ? (prov / gtProv * 100).toFixed(1) + '%' : '0%';
    const comp = o.ultima_competencia || '—';
    return [
      { content: o.nome, styles: { fontStyle: 'bold', fontSize: 9 } },
      { content: comp,            styles: { halign: 'center', fontSize: 9, textColor: [96, 165, 250] } },
      { content: fmtNum(serv),    styles: { halign: 'center', fontSize: 9 } },
      { content: fmtPdf(prov),    styles: { halign: 'right',  fontSize: 9, textColor: [34, 197, 94] } },
      { content: fmtPdf(desc),    styles: { halign: 'right',  fontSize: 9, textColor: [239, 68, 68] } },
      { content: fmtPdf(liq),     styles: { halign: 'right',  fontSize: 9, fontStyle: 'bold', textColor: [56, 189, 248] } },
      { content: pct,             styles: { halign: 'center', fontSize: 8, textColor: [100, 116, 139] } },
    ];
  });
  orgBody.push([
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold', fillColor: [13, 34, 80], textColor: [248, 250, 252], fontSize: 9 } },
    { content: compLabel || '—', styles: { halign: 'center', fillColor: [13, 34, 80], textColor: [96, 165, 250], fontSize: 9 } },
    { content: fmtNum(gtServ),   styles: { halign: 'center', fillColor: [13, 34, 80], fontStyle: 'bold', textColor: [248, 250, 252], fontSize: 9 } },
    { content: fmtPdf(gtProv),   styles: { halign: 'right',  fillColor: [13, 34, 80], fontStyle: 'bold', textColor: [34, 197, 94],   fontSize: 9 } },
    { content: fmtPdf(gtDesc),   styles: { halign: 'right',  fillColor: [13, 34, 80], fontStyle: 'bold', textColor: [239, 68, 68],   fontSize: 9 } },
    { content: fmtPdf(gtLiq),    styles: { halign: 'right',  fillColor: [13, 34, 80], fontStyle: 'bold', textColor: [56, 189, 248],  fontSize: 9 } },
    { content: '100%',           styles: { halign: 'center', fillColor: [13, 34, 80], fontStyle: 'bold', textColor: [248, 250, 252],  fontSize: 8 } },
  ]);

  doc.autoTable({
    startY: y,
    head: [[
      { content: 'Órgão',       styles: { halign: 'left'   } },
      { content: 'Competência', styles: { halign: 'center' } },
      { content: 'Serv.',       styles: { halign: 'center' } },
      { content: 'Proventos',   styles: { halign: 'right', textColor: [34, 197, 94]  } },
      { content: 'Descontos',   styles: { halign: 'right', textColor: [239, 68, 68]  } },
      { content: 'Líquido',     styles: { halign: 'right', textColor: [56, 189, 248] } },
      { content: '% Folha',     styles: { halign: 'center' } },
    ]],
    body: orgBody,
    styles:     { fontSize: 9, cellPadding: 3.5, textColor: [226, 232, 240] },
    headStyles: { fillColor: [13, 44, 80], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [18, 30, 50] },
    bodyStyles: { fillColor: [13, 23, 40] },
    margin: { left: margin, right: margin },
    tableWidth: W - margin * 2,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ══════════ TABELA: DETALHAMENTO POR UO ══════════════════════
  const orgTotals = contRelState.orgTotals || [];
  if (orgTotals.length > 0) {
    const validRows = orgTotals.filter(r => parseFloat(r.total_proventos||0) > 0);
    if (validRows.length > 0) {
      checkY(20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(241, 245, 249);
      doc.setFillColor(13, 34, 80);
      doc.rect(margin, y, W - margin * 2, 8, 'F');
      doc.text('  DETALHAMENTO POR UNIDADE ORÇAMENTÁRIA', margin + 2, y + 5.5);
      y += 10;

      // Group by org
      const uoByOrg = {};
      validRows.forEach(r => {
        const org = r.orgao_nome || 'Sem Órgão';
        if (!uoByOrg[org]) uoByOrg[org] = [];
        uoByOrg[org].push(r);
      });

      const uoBody = [];
      Object.keys(uoByOrg).sort((a,b) => a.localeCompare(b,'pt-BR')).forEach(orgNome => {
        uoBody.push([{
          content: orgNome, colSpan: 8,
          styles: { fillColor: [10, 25, 50], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 9 }
        }]);
        const rows = uoByOrg[orgNome].sort((a,b) => parseFloat(b.total_proventos||0) - parseFloat(a.total_proventos||0));
        let subProv = 0, subDesc = 0, subLiq = 0, subServ = 0, subVB = 0, subGrat = 0;
        rows.forEach(r => {
          const prov = parseFloat(r.total_proventos || 0);
          const desc = parseFloat(r.total_descontos || 0);
          const liq  = parseFloat(r.total_liquido   || 0);
          const serv = parseInt(r.total_servidores  || 0);
          const vb   = parseFloat(r.total_vencimento_base || 0);
          const grat = Math.max(0, prov - vb);
          const uo   = r.unidade_orcamentaria || '—';
          const cat  = r.categoria === 'comissionado' ? 'Comissionado' : 'Efetivo';
          subProv += prov; subDesc += desc; subLiq += liq; subServ += serv; subVB += vb; subGrat += grat;
          uoBody.push([
            { content: uo,          styles: { fontSize: 8 } },
            { content: cat,         styles: { halign: 'center', fontSize: 8, textColor: r.categoria==='comissionado'?[16,185,129]:[59,130,246] } },
            { content: fmtNum(serv),styles: { halign: 'center', fontSize: 8 } },
            { content: vb>0?fmtPdf(vb):'—',    styles: { halign: 'right', fontSize: 8, textColor: [148,163,184] } },
            { content: grat>0?fmtPdf(grat):'—', styles: { halign: 'right', fontSize: 8, textColor: [245,158,11] } },
            { content: fmtPdf(prov),styles: { halign: 'right',  fontSize: 8, textColor: [34,197,94]  } },
            { content: fmtPdf(desc),styles: { halign: 'right',  fontSize: 8, textColor: [239,68,68]  } },
            { content: fmtPdf(liq), styles: { halign: 'right',  fontSize: 8, fontStyle: 'bold', textColor: [56,189,248] } },
          ]);
        });
        uoBody.push([
          { content: `Subtotal — ${orgNome}`, colSpan: 2, styles: { fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [148,163,184] } },
          { content: fmtNum(subServ),  styles: { halign: 'center', fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8 } },
          { content: fmtPdf(subVB),    styles: { halign: 'right',  fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [148,163,184] } },
          { content: fmtPdf(subGrat),  styles: { halign: 'right',  fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [245,158,11] } },
          { content: fmtPdf(subProv),  styles: { halign: 'right',  fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [34,197,94]  } },
          { content: fmtPdf(subDesc),  styles: { halign: 'right',  fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [239,68,68]  } },
          { content: fmtPdf(subLiq),   styles: { halign: 'right',  fillColor: [20,40,70], fontStyle: 'bold', fontSize: 8, textColor: [56,189,248] } },
        ]);
      });

      doc.autoTable({
        startY: y,
        head: [[
          { content: 'Unidade Orçamentária', styles: { halign: 'left' } },
          { content: 'Categoria', styles: { halign: 'center' } },
          { content: 'Serv.',     styles: { halign: 'center' } },
          { content: 'Venc. Base', styles: { halign: 'right', textColor: [148,163,184] } },
          { content: 'Gratific.', styles: { halign: 'right', textColor: [245,158,11] } },
          { content: 'Proventos', styles: { halign: 'right', textColor: [34,197,94]  } },
          { content: 'Descontos', styles: { halign: 'right', textColor: [239,68,68]  } },
          { content: 'Líquido',   styles: { halign: 'right', textColor: [56,189,248] } },
        ]],
        body: uoBody,
        styles:     { fontSize: 8, cellPadding: 3, textColor: [226, 232, 240] },
        headStyles: { fillColor: [13, 44, 80], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [18, 30, 50] },
        bodyStyles: { fillColor: [13, 23, 40] },
        margin: { left: margin, right: margin },
        tableWidth: W - margin * 2,
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // ══════════ RODAPÉ ═══════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(10, 20, 40);
    doc.rect(0, 287, W, 10, 'F');
    doc.text('Prefeitura Municipal de Sertânia — Controle Interno   |   Gerado em: ' + dtStr, margin, 292);
    doc.text(`Pág. ${pg} / ${totalPages}`, W - margin, 292, { align: 'right' });
  }

  doc.save(`custo-pessoal-${(compLabel||'relatorio').replace(/\//g,'-')}.pdf`);
  toast('PDF gerado com sucesso!', 'ok');
}

function contRelPdf() {
  const allData = contState.contratados;
  const s       = contRelState;
  if (!allData.length) { toast('Nenhum dado para gerar PDF', 'error'); return; }

  const allOrgs = [...new Set(allData.map(c => c.orgao_nome || 'Sem Orgao'))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  // Aplicar os mesmos filtros de texto que a tela usa
  const _sNomePdf  = (s.searchNome  || '').toLowerCase().trim();
  const _sCargoPdf = (s.searchCargo || '').toLowerCase().trim();
  const _sUOPdf    = (s.searchUO    || '').toLowerCase().trim();
  const _sOrgaoPdf = (s.searchOrgao || '').toLowerCase().trim();
  const _textFilterActive = !!(_sNomePdf || _sCargoPdf || _sUOPdf || _sOrgaoPdf);
  const _catFilterActive  = !!(s.catSel && !(s.catSel.efetivo !== false && s.catSel.comissionado !== false));
  const data = allData.filter(c => {
    const org = c.orgao_nome || 'Sem Orgao';
    if (s.orgaoSel && s.orgaoSel[org] === false) return false;
    if (s.catSel   && s.catSel[c.categoria] === false) return false;
    if (_sNomePdf  && !(c.nome||'').toLowerCase().includes(_sNomePdf))               return false;
    if (_sCargoPdf && !(c.cargo||'').toLowerCase().includes(_sCargoPdf))              return false;
    if (_sUOPdf    && !(c.unidade_orcamentaria||'').toLowerCase().includes(_sUOPdf)) return false;
    if (_sOrgaoPdf && !org.toLowerCase().includes(_sOrgaoPdf))                       return false;
    return true;
  });

  const totalEf  = data.filter(c => c.categoria === 'efetivo').length;
  const totalCom = data.filter(c => c.categoria === 'comissionado').length;
  const fmtPdf = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const _provP = _contCalcProv;
  const _descP = _contCalcDesc;
  const _liqP  = _contCalcLiq;
  // Dados oficiais de folha (órgãos com totais importados de PDF)
  const orgaosFolhaPdf = contState.orgaos
    .filter(o => parseFloat(o.total_proventos_folha || 0) > 0 || parseFloat(o.total_liquido_folha || 0) > 0)
    .sort((a, b) => parseFloat(b.total_proventos_folha || 0) - parseFloat(a.total_proventos_folha || 0));
  const orgFolhaVis = orgaosFolhaPdf.filter(o => !s.orgaoSel || s.orgaoSel[o.nome] !== false);
  // Quando filtro de texto ativo, totais de órgão não refletem o subconjunto filtrado → usar registros individuais
  const _useOrgPdf  = orgFolhaVis.length > 0 && !_textFilterActive && !_catFilterActive;
  const totalProv   = _useOrgPdf
    ? orgFolhaVis.reduce((a, o) => a + parseFloat(o.total_proventos_folha || 0), 0)
    : data.reduce((a, c) => a + _provP(c), 0);
  const totalDesc   = _useOrgPdf
    ? orgFolhaVis.reduce((a, o) => a + parseFloat(o.total_descontos_folha || 0), 0)
    : data.reduce((a, c) => a + _descP(c), 0);
  const totalLiqPdf = _useOrgPdf
    ? orgFolhaVis.reduce((a, o) => a + parseFloat(o.total_liquido_folha || 0), 0)
    : data.reduce((a, c) => a + _liqP(c), 0);
  const uniqueServsPdf = data.length;
  const gtServPdf   = _useOrgPdf
    ? orgFolhaVis.reduce((a, o) => a + parseInt(o.total_servidores_folha || 0), 0)
    : uniqueServsPdf;
  const totalFolha = totalProv;

  // Gratificações PDF: deriva de proventos − vencimento_base quando gratificacao=0
  const _gratifP = _contCalcGratif;
  const totalGratifPdf = data.reduce((a,c) => a + _gratifP(c), 0);
  const _gratByOrgPdf  = nm => data.filter(c => (c.orgao_nome||'Sem Orgao')===nm).reduce((a,c)=>a+_gratifP(c),0);
  const catAtivas = Object.entries(s.catSel||{efetivo:true,comissionado:true}).filter(([,v])=>v).map(([k])=>k==='comissionado'?'Comissionados':'Efetivos');
  const visOrgs = allOrgs.filter(o => !s.orgaoSel || s.orgaoSel[o] !== false);
  const _textNotesPdf = [_sNomePdf&&('Nome: '+_sNomePdf), _sCargoPdf&&('Cargo: '+_sCargoPdf), _sUOPdf&&('UO: '+_sUOPdf), _sOrgaoPdf&&('Orgao: '+_sOrgaoPdf)].filter(Boolean);
  // Quando filtro de texto ativo, contar apenas os órgãos presentes nos resultados filtrados
  const _pdfOrgCount = _textFilterActive
    ? [...new Set(data.map(c => c.orgao_nome || 'Sem Orgao'))].length
    : visOrgs.length;
  const filterNote = 'Filtros: ' + catAtivas.join(' + ') + (_textNotesPdf.length ? ' \u00b7 ' + _textNotesPdf.join(' \u00b7 ') : '') + ' \u00b7 ' + _pdfOrgCount + ' orgao(s)';

  const now   = new Date();
  const dtStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sections = [];

  sections.push({
    type:     'header',
    title:    'Relatorio de Servidores Contratados',
    subtitle: 'Prefeitura Municipal de Sertania \u00b7 ' + filterNote,
    right:    'Emitido em: ' + dtStr,
    right2:   gtServPdf.toLocaleString('pt-BR') + ' vinculo(s)',
    color:    [13, 34, 64],
  });

  sections.push({ type: 'cards', items: [
    { value: uniqueServsPdf.toLocaleString('pt-BR'), label: 'Vinculos Cadastrados', color: [99, 102, 241] },
    { value: gtServPdf.toLocaleString('pt-BR'), label: 'Total Vinculos (Folha)', color: [13, 34, 64]  },
    { value: String(totalEf),              label: 'Cargos Efetivos',       color: [59, 130, 246] },
    { value: String(totalCom),             label: 'Cargos Comissionados',  color: [16, 185, 129] },
  ]});

  // ── Resumo da Folha de Pagamento por Órgão (dados oficiais PDF) ──────────
  // Omitir quando filtro de texto ativo: totais de órgão são dados globais, não filtraveis por nome/cargo
  if (orgaosFolhaPdf.length > 0 && !_textFilterActive) {
    const _gtProv = orgaosFolhaPdf.reduce((a, o) => a + parseFloat(o.total_proventos_folha || 0), 0);
    const _gtDesc = orgaosFolhaPdf.reduce((a, o) => a + parseFloat(o.total_descontos_folha || 0), 0);
    const _gtLiq  = orgaosFolhaPdf.reduce((a, o) => a + parseFloat(o.total_liquido_folha  || 0), 0);
    const _gtServ = orgaosFolhaPdf.reduce((a, o) => a + parseInt(o.total_servidores_folha  || 0), 0);
    const _cPeriods = [...new Set(orgaosFolhaPdf.map(o => o.ultima_competencia).filter(Boolean))];
    const _cLabel   = _cPeriods.length === 1 ? _cPeriods[0] : _cPeriods.join(', ');
    sections.push({ type: 'section-title', text: 'Resumo da Folha de Pagamento por Orgao' + (_cLabel ? ' \u2014 Competencia: ' + _cLabel : '') });
    sections.push({ type: 'cards', items: [
      { value: _gtServ.toLocaleString('pt-BR'),  label: 'Total de Servidores',  color: [99, 102, 241] },
      { value: fmtPdf(_gtProv),                  label: 'Total de Proventos',   color: [34, 197, 94]  },
      { value: fmtPdf(_gtDesc),                  label: 'Total de Descontos',   color: [239, 68, 68]  },
      { value: fmtPdf(_gtLiq),                   label: 'Liquido a Pagar',      color: [13, 122, 116] },
    ]});
    const _resumoRows = orgaosFolhaPdf.map(o => {
      const prov = parseFloat(o.total_proventos_folha || 0);
      const desc = parseFloat(o.total_descontos_folha || 0);
      const liq  = parseFloat(o.total_liquido_folha   || 0);
      const serv = parseInt(o.total_servidores_folha   || 0);
      const pct  = _gtProv > 0 ? Math.round(prov / _gtProv * 100) : 0;
      const descTax = prov > 0 ? (desc / prov * 100).toFixed(1) : '0.0';
      return [
        { content: o.nome,                          styles: { fontStyle: 'bold' } },
        { content: o.ultima_competencia || '\u2014', styles: { halign: 'center', textColor: [96, 165, 250] } },
        { content: serv.toLocaleString('pt-BR'),    styles: { halign: 'center' } },
        { content: fmtPdf(prov), styles: { halign: 'right', textColor: [34, 197, 94]  } },
        { content: fmtPdf(desc), styles: { halign: 'right', textColor: [239, 68, 68]  } },
        { content: fmtPdf(liq),  styles: { halign: 'right', textColor: [56, 189, 248], fontStyle: 'bold' } },
        { content: pct + '% / ' + descTax + '%', styles: { halign: 'center', fontSize: 7, textColor: [100, 116, 139] } },
      ];
    });
    _resumoRows.push([
      { content: 'TOTAL GERAL', styles: { fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [255,255,255] } },
      { content: _cLabel || '\u2014', styles: { halign: 'center', fillColor: [13, 34, 64], textColor: [96, 165, 250] } },
      { content: _gtServ.toLocaleString('pt-BR'), styles: { halign: 'center', fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [255,255,255] } },
      { content: fmtPdf(_gtProv), styles: { halign: 'right', fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [34, 197, 94]  } },
      { content: fmtPdf(_gtDesc), styles: { halign: 'right', fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [239, 68, 68]  } },
      { content: fmtPdf(_gtLiq),  styles: { halign: 'right', fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [56, 189, 248] } },
      { content: '100% / ' + (_gtProv>0?(_gtDesc/_gtProv*100).toFixed(1):0) + '%', styles: { halign: 'center', fontStyle: 'bold', fillColor: [13, 34, 64], textColor: [255,255,255] } },
    ]);
    sections.push({ type: 'table',
      head: [[
        'Orgao',
        { content: 'Competencia', styles: { halign: 'center' } },
        { content: 'Servidores',  styles: { halign: 'center' } },
        { content: 'Proventos',   styles: { halign: 'right', textColor: [34, 197, 94]  } },
        { content: 'Descontos',   styles: { halign: 'right', textColor: [239, 68, 68]  } },
        { content: 'Liquido',     styles: { halign: 'right', textColor: [56, 189, 248] } },
        { content: 'Folha% / Desc%', styles: { halign: 'center' } },
      ]],
      body: _resumoRows,
      fontSize: 9,
    });
  }

  sections.push({ type: 'section-title', text: 'Folha Salarial \u2014 Vis\u00E3o Financeira' });
  sections.push({ type: 'cards', items: [
    { value: fmtPdf(totalProv),    label: 'Total de Proventos',    color: [34, 197, 94]  },
    ...(totalGratifPdf > 0 ? [{ value: fmtPdf(totalGratifPdf), label: 'Gratificacoes',       color: [245, 158, 11] }] : []),
    { value: fmtPdf(totalDesc),    label: 'Total de Descontos',    color: [239, 68, 68]  },
    { value: fmtPdf(totalLiqPdf),  label: 'Liquido a Pagar',       color: [13, 122, 116] },
  ]});

  sections.push({ type: 'section-title', text: 'Resumo por Orgao e Categoria' });

  const matrixBody = visOrgs.map(org => {
    const ef  = data.filter(c => (c.orgao_nome||'Sem Orgao') === org && c.categoria === 'efetivo').length;
    const com = data.filter(c => (c.orgao_nome||'Sem Orgao') === org && c.categoria === 'comissionado').length;
    if (ef + com === 0) return null;
    return [
      org,
      { content: String(ef  || '\u2014'), styles: { halign: 'center', textColor: ef  ? [59,130,246] : [150,150,150] } },
      { content: String(com || '\u2014'), styles: { halign: 'center', textColor: com ? [16,185,129] : [150,150,150] } },
      { content: String(ef + com),        styles: { halign: 'center', fontStyle: 'bold' } },
    ];
  }).filter(Boolean);
  const matrixFoot = [[
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' } },
    { content: String(totalEf),            styles: { halign: 'center', fontStyle: 'bold', textColor: [59,130,246] } },
    { content: String(totalCom),           styles: { halign: 'center', fontStyle: 'bold', textColor: [16,185,129] } },
    { content: String(totalEf + totalCom), styles: { halign: 'center', fontStyle: 'bold' } },
  ]];
  sections.push({ type: 'table',
    head: [['Orgao',
      { content: 'Cargos Efetivos',      styles: { halign: 'center' } },
      { content: 'Cargos Comissionados', styles: { halign: 'center' } },
      { content: 'Total',               styles: { halign: 'center' } }]],
    body: matrixBody,
    foot: matrixFoot,
    fontSize: 9,
  });

  // ── Gráfico financeiro por Órgão ────────────────────────
  if (totalFolha > 0) {
    const _chartData = _useOrgPdf
      ? orgFolhaVis.slice(0, 8).map(o => ({
          org: o.nome,
          vb:  parseFloat(o.total_liquido_folha   || 0),
          gr:  parseFloat(o.total_proventos_folha || 0) - parseFloat(o.total_liquido_folha || 0),
        })).filter(d => d.vb + d.gr > 0)
      : visOrgs.map(org => {
          const rowD = data.filter(c => (c.orgao_nome||'Sem Orgao') === org);
          const prov = rowD.reduce((a, c) => a + _provP(c), 0);
          const liq  = rowD.reduce((a, c) => a + _liqP(c), 0);
          return { org, vb: liq, gr: prov - liq };
        }).filter(d => d.vb + d.gr > 0).sort((a, b) => (b.vb + b.gr) - (a.vb + a.gr)).slice(0, 8);
    if (_chartData.length > 0)
      sections.push({ type: 'salary-chart', data: _chartData, fmtPdf, totalFolha });
  }

  if (s.showCargo || s.showUnidade || s.showNomes || s.showMatricula || s.showVencimento || s.showGratificacao || s.showLiquido) {
    const colDefs = [s.showNomes ? 'Nome' : 'Qtd'];
    if (s.showMatricula)  colDefs.push('Matricula');
    if (s.showCargo)      colDefs.push('Cargo');
    if (s.showCat)        colDefs.push('Categoria');
    if (s.showUnidade)    colDefs.push('Unidade Orcamentaria');
    if (s.showOrgao)      colDefs.push('Orgao');
    if (s.showVencimento)   colDefs.push({ content: 'Proventos',      styles: { halign: 'right', textColor: [34, 197, 94]   } });
    if (s.showGratif)       colDefs.push({ content: 'Gratificacoes',  styles: { halign: 'right', textColor: [245, 158, 11]  } });
    if (s.showGratificacao) colDefs.push({ content: 'Descontos',      styles: { halign: 'right', textColor: [239, 68, 68]   } });
    const showTotalPdf = s.showLiquido || (s.showVencimento && s.showGratificacao);
    if (showTotalPdf) colDefs.push({ content: 'Liquido', styles: { halign: 'right', textColor: [56, 189, 248] } });
    const colCount = colDefs.length;

    sections.push({ type: 'section-title', text: 'Listagem Detalhada \u2014 ' + data.length + ' vinculo(s)' });

    const orgMap = {};
    for (const c of data) {
      const org = c.orgao_nome || 'Sem Orgao';
      if (!orgMap[org]) orgMap[org] = { efetivo: [], comissionado: [] };
      orgMap[org][c.categoria === 'comissionado' ? 'comissionado' : 'efetivo'].push(c);
    }

    // Helper: totais financeiros por órgão para PDF apenas dos registros individuais exibidos
    const _orgFinPdf = nm => {
      const recs = data.filter(c => (c.orgao_nome||'Sem Orgao') === nm);
      return { prov: recs.reduce((a,c)=>a+_provP(c),0), desc: recs.reduce((a,c)=>a+_descP(c),0), liq: recs.reduce((a,c)=>a+_liqP(c),0) };
    };
    let finColCountPdf = 0;
    if (s.showVencimento)   finColCountPdf++;
    if (s.showGratif)       finColCountPdf++;
    if (s.showGratificacao) finColCountPdf++;
    if (showTotalPdf) finColCountPdf++;
    const nonFinColsPdf = Math.max(1, colCount - finColCountPdf);

    const body = [];
    for (const orgNome of Object.keys(orgMap).sort((a,b) => a.localeCompare(b,'pt-BR'))) {
      const { efetivo, comissionado } = orgMap[orgNome];
      const orgTotal = efetivo.length + comissionado.length;
      const orgFinPdf = _orgFinPdf(orgNome);
      const orgGratPdf = _gratByOrgPdf(orgNome);
      const orgHeaderRow = [{ content: orgNome, colSpan: nonFinColsPdf, styles: { fillColor: [13,34,64], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 } }];
      if (s.showVencimento)   orgHeaderRow.push({ content: orgFinPdf.prov>0?fmtPdf(orgFinPdf.prov):'\u2014', styles: { fillColor:[13,34,64], textColor:[34,197,94],   halign:'right', fontStyle:'bold', fontSize:8 } });
      if (s.showGratif)       orgHeaderRow.push({ content: orgGratPdf>0?fmtPdf(orgGratPdf):'\u2014',         styles: { fillColor:[13,34,64], textColor:[245,158,11],  halign:'right', fontStyle:'bold', fontSize:8 } });
      if (s.showGratificacao) orgHeaderRow.push({ content: orgFinPdf.desc>0?fmtPdf(orgFinPdf.desc):'\u2014', styles: { fillColor:[13,34,64], textColor:[239,68,68],  halign:'right', fontStyle:'bold', fontSize:8 } });
      if (showTotalPdf)       orgHeaderRow.push({ content: orgFinPdf.liq>0?fmtPdf(orgFinPdf.liq):'\u2014',   styles: { fillColor:[13,34,64], textColor:[56,189,248], halign:'right', fontStyle:'bold', fontSize:8 } });
      body.push(orgHeaderRow);

      if (s.showNomes) {
        const cats = [];
        if (efetivo.length)      cats.push({ label: 'Cargos Efetivos (' + efetivo.length + ')',            rows: efetivo,      fill: [239,246,255], clr: [59,130,246] });
        if (comissionado.length) cats.push({ label: 'Cargos Comissionados (' + comissionado.length + ')', rows: comissionado, fill: [240,253,244], clr: [16,185,129] });
        for (const { label, rows, fill, clr } of cats) {
          body.push([{ content: label, colSpan: colCount, styles: { fillColor: fill, textColor: clr, fontStyle: 'bold', fontSize: 8 } }]);
          // ── cabeçalho de colunas dentro do bloco ──
          const hdr = [{ content: 'Nome', styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } }];
          if (s.showMatricula)  hdr.push({ content: 'Matricula',             styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } });
          if (s.showCargo)      hdr.push({ content: 'Cargo',                 styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } });
          if (s.showCat)        hdr.push({ content: 'Categoria',             styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } });
          if (s.showUnidade)    hdr.push({ content: 'Unidade Orcamentaria', styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } });
          if (s.showOrgao)      hdr.push({ content: 'Orgao',                styles: { fontStyle: 'bold', fontSize: 7, textColor: [100,116,139] } });
          if (s.showVencimento)   hdr.push({ content: 'Proventos',     styles: { fontStyle:'bold', fontSize:7, textColor:[34,197,94],   halign:'right' } });
          if (s.showGratif)       hdr.push({ content: 'Gratificacoes', styles: { fontStyle:'bold', fontSize:7, textColor:[245,158,11], halign:'right' } });
          if (s.showGratificacao) hdr.push({ content: 'Descontos',     styles: { fontStyle:'bold', fontSize:7, textColor:[239,68,68],  halign:'right' } });
          if (showTotalPdf) hdr.push({ content: 'Liquido',  styles: { fontStyle: 'bold', fontSize: 7, textColor: [56,189,248],  halign: 'right' } });
          body.push(hdr);
          rows.sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR')).forEach(c => {
            const pR  = _provP(c);
            const dR  = _descP(c);
            const lR  = _liqP(c);
            const gR  = _gratifP(c);
            const row = [{ content: c.nome, styles: { fontStyle: 'bold' } }];
            if (s.showMatricula)  row.push({ content: c.matricula || '\u2014', styles: { textColor: [13, 122, 116] } });
            if (s.showCargo)      row.push(c.cargo || '\u2014');
            if (s.showCat)        row.push(c.categoria === 'comissionado' ? 'Comissionado' : 'Efetivo');
            if (s.showUnidade)    row.push({ content: c.unidade_orcamentaria || '\u2014', styles: { fontSize: 7 } });
            if (s.showOrgao)      row.push(c.orgao_nome || 'Sem Orgao');
            if (s.showVencimento)   row.push({ content: pR > 0 ? fmtPdf(pR) : '\u2014', styles: { halign: 'right', textColor: [34, 197, 94]   } });
            if (s.showGratif)       row.push({ content: gR > 0 ? fmtPdf(gR) : '\u2014', styles: { halign: 'right', textColor: [245, 158, 11]  } });
            if (s.showGratificacao) row.push({ content: dR > 0 ? fmtPdf(dR) : '\u2014', styles: { halign: 'right', textColor: [239, 68, 68]   } });
            if (showTotalPdf)       row.push({ content: lR > 0 ? fmtPdf(lR) : '\u2014', styles: { halign: 'right', textColor: [56,189,248], fontStyle: 'bold' } });
            body.push(row);
          });
        }
      } else {
        const subGroups = {};
        for (const c of [...efetivo, ...comissionado]) {
          const parts = [];
          if (s.showCargo)   parts.push(c.cargo || '\u2014');
          if (s.showCat)     parts.push(c.categoria);
          if (s.showUnidade) parts.push(c.unidade_orcamentaria || '\u2014');
          if (s.showOrgao)   parts.push(c.orgao_nome || 'Sem Orgao');
          const key = parts.join('\x00');
          if (!subGroups[key]) subGroups[key] = { parts: [...parts], count: 0, prov: 0, desc: 0, liq: 0, grat: 0 };
          subGroups[key].count++;
          subGroups[key].prov += _provP(c);
          subGroups[key].desc += _descP(c);
          subGroups[key].liq  += _liqP(c);
          subGroups[key].grat += _gratifP(c);
        }
        Object.keys(subGroups).sort().forEach(key => {
          const { parts, count, prov, desc, liq, grat } = subGroups[key];
          let pi = 0; const row = [];
          row.push({ content: String(count), styles: { halign: 'center', fontStyle: 'bold' } });
          if (s.showMatricula)  row.push('\u2014');
          if (s.showCargo)      row.push(parts[pi++]);
          if (s.showCat)        { const cat = parts[pi++]; row.push(cat === 'comissionado' ? 'Comissionado' : 'Efetivo'); }
          if (s.showUnidade)    row.push({ content: parts[pi++], styles: { fontSize: 7 } });
          if (s.showOrgao)      row.push(parts[pi++]);
          if (s.showVencimento)   row.push({ content: prov>0?fmtPdf(prov):'\u2014', styles: { halign:'right', textColor:[34,197,94]   } });
          if (s.showGratif)       row.push({ content: grat>0?fmtPdf(grat):'\u2014', styles: { halign:'right', textColor:[245,158,11]  } });
          if (s.showGratificacao) row.push({ content: desc>0?fmtPdf(desc):'\u2014', styles: { halign:'right', textColor:[239,68,68]   } });
          if (showTotalPdf)       row.push({ content: liq>0?fmtPdf(liq):'\u2014',   styles: { halign:'right', textColor:[56,189,248], fontStyle:'bold' } });
          body.push(row);
        });
      }
      const subParts = [];
      if (efetivo.length)      subParts.push(efetivo.length + ' efetivo(s)');
      if (comissionado.length) subParts.push(comissionado.length + ' comissionado(s)');
      body.push([{ content: orgNome + ' \u2014 Subtotal: ' + subParts.join(' \u00b7 ') + ' = ' + orgTotal,
                   colSpan: colCount, styles: { fillColor: [248,250,252], fontStyle: 'bold', textColor: [55,65,81] } }]);
    }
    sections.push({ type: 'table', head: [colDefs], body, fontSize: 8, cellPadding: 1.1 });
  }

  _downloadPdf({ filename: 'relatorio-funcionarios.pdf', orientation: 'landscape', sections });
}

async function renderContOrgaos() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando órgãos…</div>';
  await contLoad();
  const cards = contState.orgaos.map(o => `
  <div class="org-card">
    <div class="org-card-icon">🏛️</div>
    <div class="org-card-name">${escHtml(o.nome)}</div>
    ${o.cnpj ? `<div class="org-card-cnpj">CNPJ: ${escHtml(o.cnpj)}</div>` : ''}
    ${o.endereco ? `<div class="org-card-end" title="${escHtml(o.endereco)}">${escHtml(o.endereco)}</div>` : ''}
    <div class="org-card-acts">
      <button class="btn-icon" onclick="openOrgaoModal(${o.id})">✏️</button>
      <button class="btn-icon btn-del" onclick="deleteOrgao(${o.id})">🗑️</button>
    </div>
  </div>`).join('');

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:1100px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <h2 style="font-size:20px;font-weight:800;margin:0">🏛️ Órgãos / Secretarias</h2>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="openOrgaoModal(0)">+ Novo Órgão</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-list')">👥 Ver Contratados</button>
      </div>
    </div>
    <div class="org-grid">
      ${contState.orgaos.length ? cards : '<div class="empty" style="grid-column:1/-1">Nenhum órgão cadastrado.</div>'}
    </div>
  </div>`;
}

// ── Órgão CRUD ───────────────────────────────────────────────
function openOrgaoModal(id) {
  const o = id ? contState.orgaos.find(x => x.id === id) : null;
  document.getElementById('co-id').value       = id || 0;
  document.getElementById('co-nome').value     = o ? o.nome : '';
  document.getElementById('co-cnpj').value     = o ? (o.cnpj || '') : '';
  document.getElementById('co-end').value      = o ? (o.endereco || '') : '';
  document.getElementById('co-overlay').style.display = 'flex';
}
function closeOrgaoModal() {
  document.getElementById('co-overlay').style.display = 'none';
}
async function saveOrgao() {
  const id   = parseInt(document.getElementById('co-id').value) || 0;
  const nome = document.getElementById('co-nome').value.trim();
  if (!nome) { alert('Informe o nome do órgão.'); return; }
  const payload = {
    id,
    nome,
    cnpj:      document.getElementById('co-cnpj').value.trim(),
    endereco:  document.getElementById('co-end').value.trim()
  };
  const r = await fetch('api.php?action=contratados_save_orgao', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  closeOrgaoModal();
  contState.loaded = false;
  await contLoad();
  renderContOrgaos();
}
async function deleteOrgao(id) {
  if (!confirm('Excluir este órgão? Os contratados vinculados ficarão sem órgão.')) return;
  const r = await fetch('api.php?action=contratados_delete_orgao', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  contState.loaded = false;
  await contLoad();
  renderContOrgaos();
}

// ── Cargo Vagas CRUD ─────────────────────────────────────────
async function renderCargoVagas() {
  document.getElementById('content').innerHTML = '<div class="loading">Carregando…</div>';
  await contLoad();

  const vagas = contState.cargoVagas;
  const totalDisp = vagas.reduce((s,v) => s + (parseInt(v.quantidade_disponivel)||0), 0);
  const totalOcup = vagas.reduce((s,v) => s + (parseInt(v.ocupados)||0), 0);
  const totalRest = Math.max(0, totalDisp - totalOcup);

  const rows = vagas.map(v => {
    const ocup = parseInt(v.ocupados) || 0;
    const disp = parseInt(v.quantidade_disponivel) || 0;
    const rest = Math.max(0, disp - ocup);
    const pct  = disp > 0 ? Math.round(ocup / disp * 100) : 0;
    const barColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#22C55E';
    return `<tr>
      <td style="font-weight:600">${escHtml(v.org_nome || '—')}</td>
      <td>${escHtml(v.cargo_nome)}</td>
      <td style="text-align:center;font-weight:700;color:#8B5CF6">${disp}</td>
      <td style="text-align:center;font-weight:700;color:${ocup>=disp&&disp>0?'#EF4444':'var(--text)'}">${ocup}</td>
      <td style="text-align:center;font-weight:700;color:${rest===0&&disp>0?'#EF4444':'#22C55E'}">${rest}</td>
      <td style="min-width:100px">
        <div style="background:#1a2840;border-radius:4px;height:6px;overflow:hidden">
          <div style="background:${barColor};height:100%;width:${Math.min(100,pct)}%;transition:width .3s"></div>
        </div>
        <div style="font-size:10px;color:var(--dim);margin-top:2px;text-align:center">${pct}% ocupado</div>
      </td>
      <td>${escHtml(v.observacao || '')}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="openVagaModal(${v.id})">✏️</button>
          <button class="btn-icon btn-del" onclick="deleteVaga(${v.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('content').innerHTML = `
  <div style="padding:24px 20px;max-width:1200px;margin:0 auto">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="font-size:20px;font-weight:800;margin:0">📋 Cargos por Órgão</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">Controle de vagas disponíveis por cargo em cada órgão. O sistema bloqueia novos cadastros quando as vagas se esgotam.</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="openVagaModal(0)">+ Novo Cargo / Vaga</button>
        <button class="btn-secondary" onclick="ciGoSectionPage('cont-list')">👥 Ver Funcionários</button>
      </div>
    </div>

    <div class="orc-sum-row" style="margin-bottom:20px">
      <div class="orc-sum-card"><div class="osc-icon">📂</div><div class="osc-val" style="color:#8B5CF6">${vagas.length}</div><div class="osc-lbl">Cargos Configurados</div></div>
      <div class="orc-sum-card"><div class="osc-icon">🟢</div><div class="osc-val" style="color:#22C55E">${totalDisp}</div><div class="osc-lbl">Total Vagas Disponíveis</div></div>
      <div class="orc-sum-card"><div class="osc-icon">📋</div><div class="osc-val" style="color:var(--teal2)">${totalOcup}</div><div class="osc-lbl">Total Cargos Ocupados</div></div>
      <div class="orc-sum-card"><div class="osc-icon">${totalRest===0&&totalDisp>0?'🔴':'🟡'}</div><div class="osc-val" style="color:${totalRest===0&&totalDisp>0?'#EF4444':'#F59E0B'}">${totalRest}</div><div class="osc-lbl">Vagas Restantes</div></div>
    </div>

    ${vagas.length ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#151f35;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">
            <th style="padding:12px 16px;text-align:left">Órgão</th>
            <th style="padding:12px 16px;text-align:left">Cargo</th>
            <th style="padding:12px 8px;text-align:center">Disponíveis</th>
            <th style="padding:12px 8px;text-align:center">Ocupados</th>
            <th style="padding:12px 8px;text-align:center">Restantes</th>
            <th style="padding:12px 8px;text-align:center;min-width:120px">Ocupação</th>
            <th style="padding:12px 16px;text-align:left">Obs.</th>
            <th style="padding:12px 16px;text-align:left">Ações</th>
          </tr>
        </thead>
        <tbody style="divide-y:1px solid var(--border)">
          ${rows}
        </tbody>
      </table>
    </div>` : '<div class="empty">Nenhum cargo configurado ainda. Clique em <strong>+ Novo Cargo / Vaga</strong> para começar.</div>'}

    <div style="background:#0d1f3a;border:1px solid #1e3a5f;border-radius:10px;padding:14px 18px;margin-top:16px;font-size:12px;color:var(--muted);line-height:1.7">
      <strong style="color:var(--accent)">ℹ️ Como funciona:</strong> Configure quantas vagas cada cargo pode ter em cada órgão. Ao cadastrar um novo funcionário, o sistema verifica automaticamente a disponibilidade e avisa quando as vagas estiverem esgotadas.
    </div>
  </div>`;
}

function openVagaModal(id) {
  const v = id ? contState.cargoVagas.find(x => x.id === id) : null;
  document.getElementById('vg-id').value   = id || 0;
  document.getElementById('vg-qtd').value  = v ? v.quantidade_disponivel : '';
  document.getElementById('vg-obs').value  = v ? (v.observacao || '') : '';
  document.getElementById('vg-cargo').value = v ? v.cargo_nome : '';
  const sel = document.getElementById('vg-orgao');
  sel.innerHTML = '<option value="">— Selecione o Órgão —</option>' +
    contState.orgaos.map(o => `<option value="${o.id}" ${v && v.orgao_id == o.id ? 'selected' : ''}>${escHtml(o.nome)}</option>`).join('');
  document.getElementById('vg-overlay').style.display = 'flex';
}
function closeVagaModal() {
  document.getElementById('vg-overlay').style.display = 'none';
}
async function saveVaga() {
  const id    = parseInt(document.getElementById('vg-id').value) || 0;
  const oid   = parseInt(document.getElementById('vg-orgao').value) || 0;
  const cargo = document.getElementById('vg-cargo').value.trim();
  const qtd   = parseInt(document.getElementById('vg-qtd').value) || 0;
  const obs   = document.getElementById('vg-obs').value.trim();
  if (!cargo) { alert('Informe o nome do cargo.'); return; }
  if (!oid)   { alert('Selecione o órgão.'); return; }
  const r = await fetch('api.php?action=cargo_vagas_save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, orgao_id: oid, cargo_nome: cargo, quantidade_disponivel: qtd, observacao: obs })
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  closeVagaModal();
  contState.loaded = false;
  await contLoad();
  renderCargoVagas();
}
async function deleteVaga(id) {
  if (!confirm('Excluir este registro de vaga?')) return;
  const r = await fetch('api.php?action=cargo_vagas_delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  contState.loaded = false;
  await contLoad();
  renderCargoVagas();
}

// ── Contratado CRUD ──────────────────────────────────────────
function openContModal(id) {
  const c = id ? contState.contratados.find(x => x.id === id) : null;
  document.getElementById('cnt-id').value          = id || 0;
  document.getElementById('cnt-nome').value        = c ? c.nome : '';
  document.getElementById('cnt-cpf').value         = c ? (c.cpf || '') : '';
  document.getElementById('cnt-matricula').value   = c ? (c.matricula || '') : '';
  document.getElementById('cnt-cargo').value       = c ? (c.cargo || '') : '';
  document.getElementById('cnt-funcao').value      = c ? (c.funcao || '') : '';
  document.getElementById('cnt-vencimento').value  = c ? (parseFloat(c.vencimento_base || 0).toFixed(2)) : '';
  document.getElementById('cnt-gratificacao').value= c ? (parseFloat(c.gratificacao || 0).toFixed(2)) : '';
  document.getElementById('cnt-und').value         = c ? (c.unidade_orcamentaria || '') : '';
  document.getElementById('cnt-data').value        = c ? (c.data_contratacao || '') : '';
  document.getElementById('cnt-admissao').value    = c ? (c.admissao || '') : '';
  document.getElementById('cnt-agencia').value     = c ? (c.agencia || '') : '';
  document.getElementById('cnt-conta').value       = c ? (c.conta_bancaria || '') : '';
  document.getElementById('cnt-mes-ano').value     = c ? (c.mes_ano || '') : '';
  document.getElementById('cnt-proventos').value   = c ? (parseFloat(c.proventos || 0).toFixed(2)) : '';
  document.getElementById('cnt-descontos').value   = c ? (parseFloat(c.descontos || 0).toFixed(2)) : '';
  document.getElementById('cnt-liquido').value     = c ? (parseFloat(c.liquido || 0).toFixed(2)) : '';
  // Build órgão dropdown
  const sel = document.getElementById('cnt-orgao');
  sel.innerHTML = '<option value="">— Sem Órgão —</option>' +
    contState.orgaos.map(o => `<option value="${o.id}" ${c && c.orgao_id == o.id ? 'selected' : ''}>${escHtml(o.nome)}</option>`).join('');
  // Cat radio
  const cat = c ? c.categoria : 'efetivo';
  document.querySelectorAll('input[name="cnt-cat"]').forEach(r => r.checked = (r.value === cat));
  document.getElementById('cnt-overlay').style.display = 'flex';

  // Live vaga check
  function _checkVaga() {
    const oid   = parseInt(document.getElementById('cnt-orgao').value) || 0;
    const cargo = document.getElementById('cnt-cargo').value.trim();
    const box   = document.getElementById('cnt-vaga-info');
    if (!oid || !cargo) { box.style.display = 'none'; return; }
    const vaga = findCargoVaga(oid, cargo);
    if (!vaga) { box.style.display = 'none'; return; }
    const ocup = parseInt(vaga.ocupados) || 0;
    const ocupAdjusted = id ? Math.max(0, ocup - 1) : ocup; // editing: subtract self
    const disp = parseInt(vaga.quantidade_disponivel) || 0;
    const rest = Math.max(0, disp - ocupAdjusted);
    const full = rest === 0;
    box.style.display = 'block';
    box.style.background = full ? '#3b0f0f' : '#0a2a1a';
    box.style.borderColor = full ? '#EF444440' : '#22C55E40';
    box.innerHTML = full
      ? `<strong style="color:#EF4444">⛔ Vagas esgotadas!</strong> ${cargo} no ${vaga.org_nome||'órgão'}: ${disp} disponíveis / ${ocupAdjusted} ocupados.`
      : `<span style="color:#22C55E">✅ Vagas disponíveis:</span> <strong>${rest}</strong> de ${disp} (${ocupAdjusted} ocupados) — ${cargo} em ${vaga.org_nome||'este órgão'}.`;
  }
  document.getElementById('cnt-cargo').addEventListener('input', _checkVaga);
  document.getElementById('cnt-orgao').addEventListener('change', _checkVaga);
  _checkVaga();
}
function closeContModal() {
  document.getElementById('cnt-overlay').style.display = 'none';
}

// ── Verificar e Corrigir VB/Gratificação Invertidos ──────────
async function contVerificarVBSwap() {
  const el = document.getElementById('vb-swap-overlay');
  if (el) el.remove();

  const ov = document.createElement('div');
  ov.id = 'vb-swap-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `<div style="background:var(--card);border-radius:16px;max-width:900px;width:100%;max-height:90vh;overflow-y:auto;padding:28px;border:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <span style="font-size:28px">🔍</span>
      <h3 style="margin:0;font-size:18px;font-weight:800">Verificar VB / Gratificação Invertidos</h3>
    </div>
    <div style="color:var(--muted);font-size:12px;margin-bottom:20px;line-height:1.6">
      O sistema compara o <b>Vencimento Base</b> cadastrado com o campo <b>Base Prev</b> importado da folha de pagamento.<br>
      Quando diferem, significa que VB e Gratificação foram invertidos na importação — o sistema corrige automaticamente.
    </div>
    <div id="vb-swap-body" style="text-align:center;padding:30px;color:var(--muted)">⏳ Analisando banco de dados…</div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
      <button onclick="document.getElementById('vb-swap-overlay').remove()" style="padding:10px 20px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  const fmtBRL = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

  try {
    const r = await fetch('api.php?action=contratados_detect_swap').then(x => x.json());
    const body = document.getElementById('vb-swap-body');
    if (!body) return;

    if (!r.ok) { body.innerHTML = `<div style="color:#F87171">❌ Erro: ${r.error || 'Desconhecido'}</div>`; return; }

    if (r.total === 0) {
      body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px">
        <span style="font-size:48px">✅</span>
        <div style="font-size:16px;font-weight:700;color:#34D399">Nenhuma inconsistência encontrada!</div>
        <div style="font-size:12px;color:var(--muted)">Todos os servidores estão com VB e Gratificação corretos.</div>
      </div>`;
      return;
    }

    const rows = r.items.map(it => {
      const methodBadge = it.method === 'base_prev'
        ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#0D948820;color:var(--teal2);border:1px solid #0D948840">Base Prev</span>`
        : `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#F59E0B20;color:#FCD34D;border:1px solid #F59E0B40">Inversão</span>`;
      return `<tr>
        <td style="padding:8px 10px;font-weight:600;font-size:12px">${escHtml(it.nome)}</td>
        <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${escHtml(it.orgao)}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;color:#F87171">${fmtBRL(it.vb_atual)}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;color:#F87171">${fmtBRL(it.grat_atual)}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;color:#34D399;font-weight:700">${fmtBRL(it.novo_vb)}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;color:#34D399;font-weight:700">${fmtBRL(it.novo_grat)}</td>
        <td style="padding:8px 10px;text-align:center">${methodBadge}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `
      <div style="background:#1a0a0a;border:1px solid #EF444450;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">⚠️</span>
        <div>
          <div style="font-weight:700;color:#F87171;font-size:14px">${r.total} servidor(es) com VB/Gratificação invertidos</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">Revise a lista abaixo antes de aplicar a correção.</div>
        </div>
      </div>
      <div style="overflow-x:auto;border-radius:10px;border:1px solid var(--border);margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px">
          <thead style="background:#151f35">
            <tr>
              <th style="padding:8px 10px;text-align:left;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Servidor</th>
              <th style="padding:8px 10px;text-align:left;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)">Órgão</th>
              <th style="padding:8px 10px;text-align:right;color:#F87171;font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">VB Atual</th>
              <th style="padding:8px 10px;text-align:right;color:#F87171;font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">Grat. Atual</th>
              <th style="padding:8px 10px;text-align:right;color:#34D399;font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">Novo VB</th>
              <th style="padding:8px 10px;text-align:right;color:#34D399;font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">Nova Grat.</th>
              <th style="padding:8px 10px;text-align:center;color:var(--muted);font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">Método</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div id="vb-swap-status" style="font-size:12px;color:var(--muted);min-height:18px;margin-bottom:10px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="document.getElementById('vb-swap-overlay').remove()" style="padding:10px 20px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600">Cancelar</button>
        <button onclick="contAplicarVBSwap()" style="padding:10px 24px;background:#7C3AED;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px">⚡ Corrigir Todos (${r.total})</button>
      </div>`;
  } catch(err) {
    const body = document.getElementById('vb-swap-body');
    if (body) body.innerHTML = `<div style="color:#F87171">❌ Erro de rede: ${err.message}</div>`;
  }
}

async function contAplicarVBSwap() {
  const btn = document.querySelector('#vb-swap-overlay button[onclick="contAplicarVBSwap()"]');
  const status = document.getElementById('vb-swap-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Corrigindo…'; }
  if (status) status.innerHTML = '<span style="color:var(--muted)">⏳ Aplicando correções no banco de dados…</span>';

  try {
    const r = await fetch('api.php?action=contratados_fix_swap', {method:'POST', body:'{}'}).then(x => x.json());
    if (r.ok) {
      if (status) status.innerHTML = `<span style="color:#34D399;font-weight:700">✅ ${r.fixed} registro(s) corrigido(s) com sucesso! (${r.fixed_baseprev} via Base Prev · ${r.fixed_swap} por inversão direta)</span>`;
      if (btn) { btn.textContent = '✅ Concluído'; btn.style.background = '#10B981'; }
      // Reload dados após 2s
      setTimeout(() => {
        document.getElementById('vb-swap-overlay')?.remove();
        contState.loaded = false;
        renderContRelatorio();
      }, 2200);
    } else {
      if (status) status.innerHTML = `<span style="color:#F87171">❌ Erro: ${r.error || 'Desconhecido'}</span>`;
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Tentar novamente'; }
    }
  } catch(err) {
    if (status) status.innerHTML = `<span style="color:#F87171">❌ Erro de rede: ${err.message}</span>`;
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Tentar novamente'; }
  }
}

async function saveContratado() {
  const id   = parseInt(document.getElementById('cnt-id').value) || 0;
  const nome = document.getElementById('cnt-nome').value.trim();
  if (!nome) { alert('Informe o nome do contratado.'); return; }
  const cat = document.querySelector('input[name="cnt-cat"]:checked');
  const oidVal = parseInt(document.getElementById('cnt-orgao').value) || null;
  const cargoVal = document.getElementById('cnt-cargo').value.trim();

  // Validate vaga if configured
  if (oidVal && cargoVal) {
    const vaga = findCargoVaga(oidVal, cargoVal);
    if (vaga) {
      const ocup = parseInt(vaga.ocupados) || 0;
      const ocupAdjusted = id ? Math.max(0, ocup - 1) : ocup;
      const disp = parseInt(vaga.quantidade_disponivel) || 0;
      if (ocupAdjusted >= disp) {
        const confirmed = confirm(
          `⛔ ATENÇÃO: As vagas para "${cargoVal}" neste órgão estão ESGOTADAS!\n` +
          `Disponíveis: ${disp} | Ocupados: ${ocupAdjusted}\n\nDeseja cadastrar mesmo assim?`
        );
        if (!confirmed) return;
      }
    }
  }

  const payload = {
    id,
    nome,
    cpf:                   document.getElementById('cnt-cpf').value.trim(),
    matricula:             document.getElementById('cnt-matricula').value.trim(),
    cargo:                 cargoVal,
    funcao:                document.getElementById('cnt-funcao').value.trim(),
    vencimento_base:       parseFloat(document.getElementById('cnt-vencimento').value) || 0,
    gratificacao:          parseFloat(document.getElementById('cnt-gratificacao').value) || 0,
    orgao_id:              oidVal,
    unidade_orcamentaria:  document.getElementById('cnt-und').value.trim(),
    categoria:             cat ? cat.value : 'efetivo',
    data_contratacao:      document.getElementById('cnt-data').value || null,
    admissao:              document.getElementById('cnt-admissao').value || null,
    agencia:               document.getElementById('cnt-agencia').value.trim(),
    conta_bancaria:        document.getElementById('cnt-conta').value.trim(),
    mes_ano:               document.getElementById('cnt-mes-ano').value.trim(),
    proventos:             parseFloat(document.getElementById('cnt-proventos').value) || 0,
    descontos:             parseFloat(document.getElementById('cnt-descontos').value) || 0,
    liquido:               parseFloat(document.getElementById('cnt-liquido').value) || 0,
  };
  const r = await fetch('api.php?action=contratados_save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  closeContModal();
  contState.loaded = false;
  await contLoad();
  renderContratados();
}
async function deleteContratado(id) {
  if (!confirm('Excluir este contratado?')) return;
  const r = await fetch('api.php?action=contratados_delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }).then(x => x.json());
  if (r.error) { alert('Erro: ' + r.error); return; }
  contState.loaded = false;
  await contLoad();
  renderContratados();
}

