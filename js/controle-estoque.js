/* ── CONTROLE DE ESTOQUE ── */

const CE_UNIDADES = ['UNIDADE','FRASCO','LITRO','CAIXA'];
const CE_TIPOS = ['ENTRADA','SAIDA'];

function _ceEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _ceFmtMoney(v){ return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function _ceFmtNum(v){ const n=parseFloat(v||0); return Number.isInteger(n)?n.toString():n.toFixed(2).replace('.',','); }
function _ceFator(prod, unidade){
  const ef = (prod && prod.extra_fields) || {};
  const k = 'ce_fator_' + unidade;
  const f = parseFloat(ef[k]);
  return isNaN(f) ? 1 : f;
}
function _ceUnidadeBase(prod){ return String(((prod && prod.extra_fields && prod.extra_fields.ce_unidade_base) || 'UNIDADE')).toUpperCase().trim(); }
function _ceCritico(prod){ const c=parseFloat(((prod && prod.extra_fields) || {}).ce_estoque_critico); return isNaN(c)?0:c; }
function _ceCalc(prod, lancs){
  const id = prod.id;
  const ent = lancs.filter(e=>e.subitem_id===id && e.tipo==='ENTRADA').reduce((a,e)=>a+(parseFloat(e.qtd_base)||0),0);
  const sai = lancs.filter(e=>e.subitem_id===id && e.tipo==='SAIDA').reduce((a,e)=>a+(parseFloat(e.qtd_base)||0),0);
  const saldo = ent - sai;
  const total = lancs.filter(e=>e.subitem_id===id && e.tipo==='ENTRADA').reduce((a,e)=>a+(parseFloat(e.valor_total)||0),0);
  return {ent,sai,saldo,total,critico:_ceCritico(prod)};
}
function _ceHoje(){ return new Date().toISOString().split('T')[0]; }

function ceInjectStyles(){
  if(document.getElementById('ce-style')) return;
  const st = document.createElement('style'); st.id='ce-style';
  st.textContent = `
    .ce-wrap{padding:0 8px 20px}
    .ce-header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:14px}
    .ce-header h2{margin:0;font-size:18px;color:#e2e8f0}
    .ce-sub{font-size:13px;color:#94a3b8}
    .ce-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .ce-tab{padding:8px 16px;border-radius:8px;background:#0e1729;border:1px solid #1e3a5f;color:#94a3b8;cursor:pointer;font-size:13px}
    .ce-tab.active{background:#0ea5e9;color:#fff;border-color:#0ea5e9;font-weight:700}
    .ce-sec{display:none}
    .ce-sec.active{display:block}
    .ce-categoria{margin-bottom:16px;background:#0a1222;border:1px solid #1e3a5f;border-radius:12px;padding:12px}
    .ce-cat-title{font-size:15px;font-weight:800;color:#60a5fa;margin-bottom:10px}
    .ce-prod{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#0e1729;border:1px solid #1e3a5f;border-radius:10px;padding:10px;margin-bottom:8px}
    .ce-prod-info{flex:1;min-width:220px}
    .ce-prod-name{font-size:14px;font-weight:700;color:#e2e8f0}
    .ce-prod-saldo{font-size:13px;color:#94a3b8}
    .ce-prod-saldo strong{font-size:15px;color:#e2e8f0}
    .ce-prod-saldo.critico{color:#f87171}
    .ce-prod-actions{display:flex;gap:6px;flex-wrap:wrap}
    .ce-badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700}
    .ce-badge-ok{background:rgba(16,185,129,.15);color:#10b981}
    .ce-badge-critico{background:rgba(248,113,113,.15);color:#f87171}
    .ce-btn{padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600}
    .ce-btn-entrada{background:#10b981;color:#fff}
    .ce-btn-saida{background:#f87171;color:#fff}
    .ce-btn-ghost{background:#1e293b;color:#e2e8f0;border:1px solid #334155}
    .ce-btn-pdf{background:#0ea5e9;color:#fff}
    .ce-table{width:100%;border-collapse:collapse;font-size:13px}
    .ce-table th,.ce-table td{padding:8px 6px;border-bottom:1px solid #1e3a5f}
    .ce-table th{color:#94a3b8;font-weight:700;text-align:left;background:#0a1222}
    .ce-table tr:hover{background:#0e1729}
    .ce-total-bar{background:#0a1222;border:1px solid #1e3a5f;border-radius:10px;padding:10px 12px;margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center}
    .ce-mini{font-size:11px;color:#94a3b8}
    .ce-empty{text-align:center;padding:16px;color:#64748b;font-size:13px}
    .ce-card{background:#0a1222;border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin-bottom:10px}
    .ce-row{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #1e293f}
    .ce-row:last-child{border-bottom:none}
    .ce-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
    .ce-stat{padding:12px;border-radius:10px;background:#0e1729;border:1px solid #1e3a5f}
    .ce-stat-val{font-size:20px;font-weight:800;color:#e2e8f0}
    .ce-stat-lbl{font-size:11px;color:#94a3b8}
    .ce-mobile{display:none}
    .ce-mobile-prod{margin-bottom:10px;background:#0e1729;border:1px solid #1e3a5f;border-radius:10px;padding:10px}
    @media(max-width:700px){.ce-table-wrap{display:none}.ce-mobile{display:block}}
  `;
  document.head.appendChild(st);
}

window.ceSetTab = function(tab){
  document.querySelectorAll('.ce-tab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.ce-sec').forEach(el=>el.classList.remove('active'));
  const t=document.getElementById('ce-tab-'+tab); if(t) t.classList.add('active');
  const s=document.getElementById('ce-sec-'+tab); if(s) s.classList.add('active');
};

function _ceProdCard(p, lancs, can){
  const c = _ceCalc(p,lancs);
  const base = _ceUnidadeBase(p);
  const fatorCaixa = _ceFator(p,'CAIXA');
  const cx = fatorCaixa>1 ? Math.floor(c.saldo/fatorCaixa) : 0;
  const resto = fatorCaixa>1 ? c.saldo - (cx*fatorCaixa) : 0;
  const cxTxt = fatorCaixa>1 ? ` (${cx} CAIXA${cx!==1?'S':''}${resto>0?` e ${_ceFmtNum(resto)} ${base}`:''})` : '';
  const crit = c.saldo <= c.critico;
  return `<div class="ce-prod">
    <div class="ce-prod-info">
      <div class="ce-prod-name">${_ceEsc(p.description||'Produto')}</div>
      <div class="ce-prod-saldo ${crit?'critico':''}"><strong>${_ceFmtNum(c.saldo)} ${base}</strong>${cxTxt} · Entr. ${_ceFmtNum(c.ent)} · Sai. ${_ceFmtNum(c.sai)} · Crítico: ${_ceFmtNum(c.critico)} ${crit?'<span class="ce-badge ce-badge-critico">CRÍTICO</span>':''}</div>
    </div>
    <div class="ce-prod-actions">
      ${can?`<button class="ce-btn ce-btn-entrada" onclick="ceOpenLancamentoModal(null,'${p.id}','ENTRADA')">+ Entrada</button><button class="ce-btn ce-btn-saida" onclick="ceOpenLancamentoModal(null,'${p.id}','SAIDA')">- Saída</button><button class="ce-btn ce-btn-ghost" onclick="ceOpenProdutoModal('${p.id}')">⚙️ Config</button>`:''}
    </div>
  </div>`;
}

window.renderControleEstoque = function(secId){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  curSecId = secId;
  ceInjectStyles();
  const can = S.isAdmin || (window.userCan && window.userCan(window.modForSec(sec),'editar'));
  const titulo = _ceEsc(sec.ce_titulo_controle || sec.name || 'CONTROLE DE ESTOQUE');
  const secretaria = _ceEsc(sec.ce_nome_secretaria || '');
  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const produtos = [...S.subitems.filter(s=>items.some(i=>i.id===s.item_id) && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const lancs = [...S.estoque.filter(e=>e.atividade_id===secId)].sort((a,b)=>{const da=new Date((a.data||'2000-01-01')+'T00:00'), db=new Date((b.data||'2000-01-01')+'T00:00'); return db-da;});

  const filtItem = document.getElementById('ce-filtro-item')?.value || '';
  const filtTipo = document.getElementById('ce-filtro-tipo')?.value || '';
  const filtIni = document.getElementById('ce-filtro-ini')?.value || '';
  const filtFim = document.getElementById('ce-filtro-fim')?.value || '';
  let lancsFil = lancs.filter(e=>{
    if(filtItem && e.subitem_id!==filtItem) return false;
    if(filtTipo && e.tipo!==filtTipo) return false;
    if(filtIni && (e.data||'')<filtIni) return false;
    if(filtFim && (e.data||'')>filtFim) return false;
    return true;
  });

  let totalEnt=0, totalSai=0, totalDin=0, qtdProd=0, qtdCrit=0;
  produtos.forEach(p=>{
    const c=_ceCalc(p,lancs);
    totalEnt+=c.ent; totalSai+=c.sai; totalDin+=c.total; qtdProd++;
    if(c.saldo<=c.critico) qtdCrit++;
  });

  const prodCards = produtos.map(p=>_ceProdCard(p,lancs,can)).join('');
  const catsHtml = items.map(item=>{
    const prods = produtos.filter(p=>p.item_id===item.id);
    const card = prods.map(p=>_ceProdCard(p,lancs,can)).join('');
    return `<div class="ce-categoria">
      <div class="ce-cat-title">${_ceEsc(item.description||'Categoria')}</div>
      ${card || '<div class="ce-empty">Nenhum produto cadastrado nesta categoria</div>'}
    </div>`;
  }).join('');

  const itemOpts = `<option value="">Todos</option>`+produtos.map(p=>`<option value="${p.id}" ${p.id===filtItem?'selected':''}>${_ceEsc(p.description||'')}</option>`).join('');
  const tipoOpts = `<option value="">Todos</option>`+CE_TIPOS.map(t=>`<option value="${t}" ${t===filtTipo?'selected':''}>${t}</option>`).join('');

  const movRows = lancsFil.map(e=>{
    const prod = produtos.find(p=>p.id===e.subitem_id);
    const isEnt = e.tipo==='ENTRADA';
    const qtd = parseFloat(e.quantidade)||0;
    return `<tr>
      <td>${e.data?fmtD(e.data):'—'}</td>
      <td><span class="ce-badge ${isEnt?'ce-badge-ok':'ce-badge-critico'}">${_ceEsc(e.tipo)}</span></td>
      <td>${_ceEsc(prod?.description||'—')}</td>
      <td>${_ceFmtNum(qtd)} ${_ceEsc(e.unidade||'UNIDADE')}</td>
      <td>${_ceFmtNum(e.qtd_base||0)} ${_ceEsc(prod?_ceUnidadeBase(prod):'—')}</td>
      <td>${isEnt?'R$ '+_ceFmtMoney(e.preco_unitario):'—'}</td>
      <td>${isEnt?'R$ '+_ceFmtMoney(e.valor_total):'—'}</td>
      <td>${_ceEsc(e.destino||'—')}</td>
      <td>${_ceEsc(e.observacao||'—')}</td>
      <td>${can?`<button class="ce-btn ce-btn-ghost" onclick="ceDeleteLancamento('${e.id}')">🗑️</button>`:''}</td>
    </tr>`;
  }).join('');

  const relStats = `
    <div class="ce-grid" style="margin-bottom:14px">
      <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalEnt)}</div><div class="ce-stat-lbl">Total Entradas (base)</div></div>
      <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalSai)}</div><div class="ce-stat-lbl">Total Saídas (base)</div></div>
      <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalEnt-totalSai)}</div><div class="ce-stat-lbl">Saldo em Estoque</div></div>
      <div class="ce-stat"><div class="ce-stat-val" style="color:#10b981">R$ ${_ceFmtMoney(totalDin)}</div><div class="ce-stat-lbl">Investimento em Entradas</div></div>
      <div class="ce-stat"><div class="ce-stat-val" style="color:${qtdCrit?'#f87171':'#10b981'}">${qtdCrit}</div><div class="ce-stat-lbl">Produtos em Estoque Crítico</div></div>
      <div class="ce-stat"><div class="ce-stat-val">${qtdProd}</div><div class="ce-stat-lbl">Produtos Cadastrados</div></div>
    </div>`;

  const critList = produtos.filter(p=>{
    const c=_ceCalc(p,lancs);
    return c.saldo<=c.critico;
  }).map(p=>{
    const c=_ceCalc(p,lancs);
    const base = _ceUnidadeBase(p);
    return `<div class="ce-row"><span>${_ceEsc(p.description||'')}</span><span style="color:#f87171;font-weight:700">${_ceFmtNum(c.saldo)} ${base}</span></div>`;
  }).join('');

  const filterBar = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:end">
      <div class="form-group" style="margin:0"><label style="font-size:11px;color:#94a3b8">Produto</label><select id="ce-filtro-item" onchange="renderControleEstoque(curSecId)" style="padding:6px 10px;border-radius:6px;background:#0a1222;color:#e2e8f0;border:1px solid #1e3a5f">${itemOpts}</select></div>
      <div class="form-group" style="margin:0"><label style="font-size:11px;color:#94a3b8">Tipo</label><select id="ce-filtro-tipo" onchange="renderControleEstoque(curSecId)" style="padding:6px 10px;border-radius:6px;background:#0a1222;color:#e2e8f0;border:1px solid #1e3a5f">${tipoOpts}</select></div>
      <div class="form-group" style="margin:0"><label style="font-size:11px;color:#94a3b8">De</label><input type="date" id="ce-filtro-ini" value="${filtIni}" onchange="renderControleEstoque(curSecId)" style="padding:6px 10px;border-radius:6px;background:#0a1222;color:#e2e8f0;border:1px solid #1e3a5f"></div>
      <div class="form-group" style="margin:0"><label style="font-size:11px;color:#94a3b8">Até</label><input type="date" id="ce-filtro-fim" value="${filtFim}" onchange="renderControleEstoque(curSecId)" style="padding:6px 10px;border-radius:6px;background:#0a1222;color:#e2e8f0;border:1px solid #1e3a5f"></div>
    </div>`;

  const html = `
    <div class="ce-wrap">
      <div class="ce-header">
        <div>
          <h2>${titulo}</h2>
          ${secretaria?`<div class="ce-sub">${secretaria}</div>`:''}
          <div class="ce-sub">Lançamento · Consulta · Relatório</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${can?`<button class="ce-btn ce-btn-entrada" onclick="openItemModal(null,curSecId)">+ Categoria</button><button class="ce-btn ce-btn-ghost" onclick="openItemModal(null,curSecId)">+ Produto</button>`:''}
          <button class="ce-btn ce-btn-pdf" onclick="ceGerarPdf(curSecId)">📄 PDF</button>
        </div>
      </div>
      <div class="ce-tabs">
        <div class="ce-tab active" id="ce-tab-lancamentos" onclick="ceSetTab('lancamentos')">Lançamentos</div>
        <div class="ce-tab" id="ce-tab-movimentacoes" onclick="ceSetTab('movimentacoes')">Consulta / Movimentações</div>
        <div class="ce-tab" id="ce-tab-relatorio" onclick="ceSetTab('relatorio')">Relatório</div>
      </div>

      <div class="ce-sec active" id="ce-sec-lancamentos">
        ${items.length?catsHtml:`<div class="ce-empty">Nenhuma categoria/produto cadastrado ainda. Use "+ Categoria" para começar.</div>`}
      </div>

      <div class="ce-sec" id="ce-sec-movimentacoes">
        ${filterBar}
        <div class="ce-table-wrap">
          <table class="ce-table">
            <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Qtd Base</th><th>Preço Unit.</th><th>Total</th><th>Destino</th><th>Obs.</th><th></th></tr></thead>
            <tbody>${movRows || '<tr><td colspan="10" class="ce-empty">Nenhuma movimentação encontrada</td></tr>'}</tbody>
          </table>
        </div>
        <div class="ce-mobile">
          ${lancsFil.map(e=>{
            const prod = produtos.find(p=>p.id===e.subitem_id);
            return `<div class="ce-mobile-prod">
              <div style="font-weight:700;color:#e2e8f0">${e.data?fmtD(e.data):'—'} · ${_ceEsc(e.tipo)}</div>
              <div class="ce-row"><span>Produto</span><span>${_ceEsc(prod?.description||'—')}</span></div>
              <div class="ce-row"><span>Qtd</span><span>${_ceFmtNum(e.quantidade||0)} ${_ceEsc(e.unidade||'UNIDADE')}</span></div>
              <div class="ce-row"><span>Qtd Base</span><span>${_ceFmtNum(e.qtd_base||0)} ${_ceEsc(prod?_ceUnidadeBase(prod):'—')}</span></div>
              <div class="ce-row"><span>Total</span><span>${e.tipo==='ENTRADA'?'R$ '+_ceFmtMoney(e.valor_total):'—'}</span></div>
              <div class="ce-row"><span>Destino</span><span>${_ceEsc(e.destino||'—')}</span></div>
            </div>`;
          }).join('') || '<div class="ce-empty">Nenhuma movimentação encontrada</div>'}
        </div>
      </div>

      <div class="ce-sec" id="ce-sec-relatorio">
        ${relStats}
        ${critList?`<div class="ce-card"><div style="font-size:14px;font-weight:700;color:#f87171;margin-bottom:10px">⚠️ Produtos em Estoque Crítico</div>${critList}</div>`:'<div class="ce-card ce-empty">Nenhum produto em estoque crítico</div>'}
        <div class="ce-total-bar">
          <div style="font-size:13px;font-weight:700">Resumo Geral</div>
          <div class="ce-mini">${qtdProd} produtos · ${_ceFmtNum(totalEnt)} entradas · ${_ceFmtNum(totalSai)} saídas · R$ ${_ceFmtMoney(totalDin)} investido</div>
        </div>
      </div>
    </div>`;

  setC(html);
  ceSetTab('lancamentos');
};

window.ceOpenProdutoModal = function(subitemId){
  const prod = S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const ef = (prod.extra_fields||{});
  const base = _ceEsc(ef.ce_unidade_base || 'UNIDADE');
  const crit = _ceEsc(ef.ce_estoque_critico || '0');
  const fatores = CE_UNIDADES.map(u=>{
    const v = _ceEsc(ef['ce_fator_'+u] || '1');
    return `<div class="form-group"><label>1 ${u} = quantas <span style="text-transform:lowercase">${base}</span>?</label><input type="number" step="0.01" id="ce-prod-fator-${u}" value="${v}" placeholder="Fator de conversão"></div>`;
  }).join('');
  openModal('⚙️ Configurar Produto','',`
    <div class="form-grid">
      <div class="form-group full"><label>Produto</label><input type="text" disabled value="${_ceEsc(prod.description||'')}" style="background:#0a1222"></div>
      <div class="form-group"><label>Unidade base</label><input type="text" id="ce-prod-unidade-base" value="${base}" placeholder="Ex: UNIDADE"></div>
      <div class="form-group"><label>Estoque crítico</label><input type="number" step="0.01" id="ce-prod-critico" value="${crit}" placeholder="Em unidade base"></div>
      ${fatores}
    </div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveProduto('${subitemId}')">💾 Salvar</button></div>`);
};

window.ceSaveProduto = async function(subitemId){
  const prod = S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const ef = {...(prod.extra_fields||{})};
  ef.ce_unidade_base = String(document.getElementById('ce-prod-unidade-base')?.value || 'UNIDADE').toUpperCase().trim();
  ef.ce_estoque_critico = parseFloat(document.getElementById('ce-prod-critico')?.value) || 0;
  CE_UNIDADES.forEach(u=>{ ef['ce_fator_'+u] = parseFloat(document.getElementById('ce-prod-fator-'+u)?.value) || 1; });
  await updateDoc(doc(db,'subitems',subitemId), { extra_fields: ef, updated_at: serverTimestamp() });
  await loadData(); closeModal(); toast('Produto configurado!');
  renderControleEstoque(curSecId);
};

window.ceOpenLancamentoModal = function(id, subitemId, tipo){
  const prod = S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const ef = prod.extra_fields||{};
  const base = _ceUnidadeBase(prod);
  const unidadeOpts = CE_UNIDADES.map(u=>`<option value="${u}" ${u===base?'selected':''}>${_ceEsc(u)}</option>`).join('');
  const precoHtml = tipo==='ENTRADA'?`<div class="form-group"><label>Preço unitário (R$)</label><input type="number" step="0.01" id="ce-lanc-preco" value="0" placeholder="R$ na unidade selecionada"></div>`:'';
  const destinoHtml = tipo==='SAIDA'?`<div class="form-group full"><label>Destino / Setor / Departamento</label><input type="text" id="ce-lanc-destino" placeholder="Ex: UBS Centro, Farmácia, Enfermagem"></div>`:'';
  openModal((tipo==='ENTRADA'?'📥 Entrada':'📤 Saída')+' - '+_ceEsc(prod.description||''),'',`
    <div class="form-grid">
      <div class="form-group full"><label>Produto</label><input type="text" disabled value="${_ceEsc(prod.description||'')} (${base})" style="background:#0a1222"></div>
      <div class="form-group"><label>Quantidade *</label><input type="number" step="0.01" id="ce-lanc-qtd" value="1" placeholder="Ex: 2"></div>
      <div class="form-group"><label>Unidade *</label><select id="ce-lanc-unidade" onchange="ceAtualizaInfoLanc()">${unidadeOpts}</select></div>
      ${precoHtml}
      <div class="form-group"><label>Data *</label><input type="date" id="ce-lanc-data" value="${_ceHoje()}"></div>
      ${destinoHtml}
      <div class="form-group full"><label>Observação</label><textarea id="ce-lanc-obs" rows="2" placeholder="Observações adicionais"></textarea></div>
    </div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveLancamento('${id||''}','${subitemId}','${tipo}')">💾 Salvar</button></div>`);
};

window.ceAtualizaInfoLanc = function(){};

window.ceSaveLancamento = async function(id, subitemId, tipo){
  const prod = S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const qtd = parseFloat(document.getElementById('ce-lanc-qtd')?.value) || 0;
  const unidade = String(document.getElementById('ce-lanc-unidade')?.value || 'UNIDADE').toUpperCase().trim();
  const fator = _ceFator(prod, unidade);
  const qtd_base = qtd * fator;
  const data = document.getElementById('ce-lanc-data')?.value || '';
  const obs = document.getElementById('ce-lanc-obs')?.value?.trim() || '';
  if(qtd<=0 || !unidade || !data){toast('Quantidade, unidade e data são obrigatórios','error'); return;}
  const base = _ceUnidadeBase(prod);
  if(tipo==='SAIDA'){
    const c = _ceCalc(prod, S.estoque.filter(e=>e.atividade_id===curSecId));
    if(qtd_base > c.saldo){toast('Saldo insuficiente. Disponível: '+_ceFmtNum(c.saldo)+' '+base,'error'); return;}
  }
  const preco = tipo==='ENTRADA' ? (parseFloat(document.getElementById('ce-lanc-preco')?.value) || 0) : 0;
  const destino = tipo==='SAIDA' ? (document.getElementById('ce-lanc-destino')?.value?.trim() || '') : '';
  const dataDoc = { atividade_id: curSecId, item_id: prod.item_id, subitem_id: subitemId, produto: prod.description||'', tipo, quantidade: qtd, unidade, fator, qtd_base, preco_unitario: preco, valor_total: qtd*preco, data, destino, observacao: obs, updated_at: serverTimestamp() };
  if(id){ await updateDoc(doc(db,'estoque',id), dataDoc); }
  else { dataDoc.created_at = serverTimestamp(); await addDoc(collection(db,'estoque'), dataDoc); }
  await loadData(); closeModal(); toast('Movimentação salva!');
  renderControleEstoque(curSecId);
};

window.ceDeleteLancamento = async function(id){
  if(!confirm('Excluir movimentação?')) return;
  const e = S.estoque.find(x=>x.id===id);
  await deleteDoc(doc(db,'estoque',id));
  await loadData(); toast('Excluído!');
  renderControleEstoque(e?.atividade_id||curSecId);
};

window.ceGerarPdf = async function(secId){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error'); return;}
  toast('Gerando PDF...','info',8000);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297, mx=12, cw=W-mx*2;
  const fmtPdfD=d=>d?fmtD(d):'—';
  const sf=(sz,bold,clr)=>{doc.setFontSize(sz||9);doc.setFont('helvetica',bold?'bold':'normal');const c=clr||[26,32,44];doc.setTextColor(c[0],c[1],c[2]);};
  const now = new Date().toLocaleDateString('pt-BR');

  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const produtos = [...S.subitems.filter(s=>items.some(i=>i.id===s.item_id) && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const lancs = [...S.estoque.filter(e=>e.atividade_id===secId)].sort((a,b)=>{const da=new Date((a.data||'2000-01-01')+'T00:00'), db=new Date((b.data||'2000-01-01')+'T00:00'); return db-da;});

  let totalEnt=0, totalSai=0, totalDin=0, qtdCrit=0;
  const prodRows = produtos.map(p=>{
    const c = _ceCalc(p,lancs);
    totalEnt += c.ent; totalSai += c.sai; totalDin += c.total;
    if(c.saldo<=c.critico) qtdCrit++;
    return [_ceEsc(p.description||''), _ceEsc(_ceUnidadeBase(p)), _ceFmtNum(c.ent), _ceFmtNum(c.sai), _ceFmtNum(c.saldo), _ceFmtNum(c.critico), 'R$ '+_ceFmtMoney(c.total)];
  });

  let y=18;
  doc.setFillColor(13,34,64); doc.rect(mx,12,cw,0.7,'F');
  sf(18,true,[13,34,64]); const titulo = doc.splitTextToSize(_ceEsc(sec.ce_titulo_controle || sec.name || 'CONTROLE DE ESTOQUE'), cw-10); doc.text(titulo, mx, y); y += titulo.length*5 + 4;
  sf(9,false,[100,116,139]); doc.text('Prefeitura de Sertania - PE · '+_ceEsc(sec.ce_nome_secretaria||'')+' · '+now, mx, y); y += 10;

  sf(12,true,[13,34,64]); doc.text('SALDO POR PRODUTO', mx, y); y += 8;
  doc.autoTable({
    startY:y, margin:{left:mx,right:mx}, theme:'grid',
    head:[['Produto','Unid. Base','Entradas','Saídas','Saldo','Crítico','Investimento']],
    body:prodRows,
    headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:9},
    bodyStyles:{fontSize:9,textColor:[40,40,40]},
    alternateRowStyles:{fillColor:[245,250,245]},
    styles:{cellPadding:2,overflow:'linebreak',font:'helvetica'},
    columnStyles:{0:{cellWidth:80},1:{cellWidth:30},2:{cellWidth:25,halign:'right'},3:{cellWidth:25,halign:'right'},4:{cellWidth:25,halign:'right'},5:{cellWidth:25,halign:'right'},6:{cellWidth:35,halign:'right'}},
    didParseCell:(data)=>{
      if(data.section!=='body') return;
      if(data.column.index>=2 && data.column.index<=5) data.cell.styles.fontStyle='bold';
      if(data.column.index===4 && String(data.row.raw[4]).replace(',','.')<=0) data.cell.styles.textColor=[239,68,68];
    }
  });

  const movRows = lancs.map(e=>{
    const prod = produtos.find(p=>p.id===e.subitem_id);
    const isEnt = e.tipo==='ENTRADA';
    return [fmtPdfD(e.data), e.tipo, _ceEsc(prod?.description||''), _ceFmtNum(e.quantidade||0)+' '+_ceEsc(e.unidade||''), _ceFmtNum(e.qtd_base||0)+' '+_ceEsc(prod?_ceUnidadeBase(prod):''), isEnt?('R$ '+_ceFmtMoney(e.preco_unitario)):'—', isEnt?('R$ '+_ceFmtMoney(e.valor_total)):'—', _ceEsc(e.destino||''), _ceEsc(e.observacao||'')];
  });

  const yMov = doc.lastAutoTable ? doc.lastAutoTable.finalY+12 : y+50;
  sf(12,true,[13,34,64]); doc.text('MOVIMENTAÇÕES', mx, yMov-6);
  if(movRows.length){
    doc.autoTable({
      startY:yMov, margin:{left:mx,right:mx}, theme:'grid',
      head:[['Data','Tipo','Produto','Qtd Original','Qtd Base','Preço Unit.','Total','Destino','Obs.']],
      body:movRows,
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:8},
      bodyStyles:{fontSize:8,textColor:[40,40,40]},
      alternateRowStyles:{fillColor:[245,250,245]},
      styles:{cellPadding:1.5,overflow:'linebreak',font:'helvetica'},
      columnStyles:{0:{cellWidth:22},1:{cellWidth:22},2:{cellWidth:50},3:{cellWidth:25},4:{cellWidth:25},5:{cellWidth:24,halign:'right'},6:{cellWidth:24,halign:'right'},7:{cellWidth:35},8:{cellWidth:66}},
      didParseCell:(data)=>{
        if(data.section!=='body') return;
        if(data.column.index===1) data.cell.styles.textColor = data.row.raw[1]==='ENTRADA'?[16,185,129]:[239,68,68];
      }
    });
  } else {
    sf(10,false,[120,120,120]); doc.text('Nenhuma movimentação registrada.', mx, yMov+10);
  }

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY+10 : yMov+30;
  const saldo = totalEnt - totalSai;
  const footer = `TOTAL GERAL: ${_ceFmtNum(saldo)} UNID. BASE · ENTRADAS: ${_ceFmtNum(totalEnt)} · SAÍDAS: ${_ceFmtNum(totalSai)} · INVESTIMENTO: R$ ${_ceFmtMoney(totalDin)} · CRÍTICOS: ${qtdCrit}`;
  const ftLines = doc.splitTextToSize(footer, cw-12);
  const fh = 10 + ftLines.length*4.5;
  doc.setFillColor(13,34,64); doc.roundedRect(mx, finalY, cw, fh, 2, 2, 'F');
  sf(9,true,[255,255,255]); doc.text(ftLines, mx+6, finalY+6);

  doc.save((_ceEsc((sec.name||'controle-estoque').replace(/[^a-zA-Z0-9À-ú ]/g,'_'))).trim()+'_estoque_'+now.replace(/\//g,'-')+'.pdf');
  toast('PDF gerado!','success');
};
