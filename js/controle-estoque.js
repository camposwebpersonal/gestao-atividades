/* ── CONTROLE DE ESTOQUE + REQUISIÇÕES DE COMPRA ── */

const CE_UNIDADES = ['UNIDADE','FRASCO','LITRO','CAIXA'];

function _ceEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _ceFmtMoney(v){ return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function _ceFmtNum(v){ const n=parseFloat(v||0); return Number.isInteger(n)?n.toString():n.toFixed(2).replace('.',','); }
function _ceFator(prod, unidade){
  const ef=(prod&&prod.extra_fields)||{};
  const k='ce_fator_'+unidade;
  const f=parseFloat(ef[k]);
  return isNaN(f)?1:f;
}
function _ceUnidadeBase(prod){ return String(((prod&&prod.extra_fields&&prod.extra_fields.ce_unidade_base)||'UNIDADE')).toUpperCase().trim(); }
function _ceCritico(prod){ const c=parseFloat(((prod&&prod.extra_fields)||{}).ce_estoque_critico); return isNaN(c)?0:c; }
function _ceCalc(prod,lancs){
  const id=prod.id;
  const ent=lancs.filter(e=>e.subitem_id===id&&e.tipo==='ENTRADA').reduce((a,e)=>a+(parseFloat(e.qtd_base)||0),0);
  const sai=lancs.filter(e=>e.subitem_id===id&&e.tipo==='SAIDA').reduce((a,e)=>a+(parseFloat(e.qtd_base)||0),0);
  return {ent,sai,saldo:ent-sai,total:lancs.filter(e=>e.subitem_id===id&&e.tipo==='ENTRADA').reduce((a,e)=>a+(parseFloat(e.valor_total)||0),0),critico:_ceCritico(prod)};
}
function _ceHoje(){ return new Date().toISOString().split('T')[0]; }
function _ceReqId(){ return 'ri_'+(++_ceReqId._n); }
_ceReqId._n=0;
function _ceNovaReqId(){ return 'ri_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
function _ceReqComprado(reqId,itemId,lancs){
  return lancs.filter(e=>e.requisicao_id===reqId && e.requisicao_item_id===itemId && e.tipo==='ENTRADA').reduce((a,e)=>a+(parseFloat(e.qtd_base)||0),0);
}
function _ceReqItemStatus(reqId,item,lancs){
  const comp=_ceReqComprado(reqId,item.id,lancs);
  const req=parseFloat(item.qtd_base)||0;
  if(comp===0) return 'PENDENTE';
  if(comp<req) return 'PARCIAL';
  if(comp===req) return 'COMPRADO';
  return 'EXCEDENTE';
}
function _ceReqStatus(req,lancs){
  const itens=Array.isArray(req.itens)?req.itens:[];
  if(!itens.length) return 'PENDENTE';
  const sts=itens.map(it=>_ceReqItemStatus(req.id,it,lancs));
  if(sts.every(s=>s==='PENDENTE')) return 'PENDENTE';
  if(sts.every(s=>s==='COMPRADO')) return 'COMPRADO';
  if(sts.some(s=>s==='EXCEDENTE')) return 'EXCEDENTE';
  return 'PARCIAL';
}
let CE_REQ_ITEMS=[];

function ceInjectStyles(){
  if(document.getElementById('ce-style')) return;
  const st=document.createElement('style'); st.id='ce-style';
  st.textContent=`
    .ce-wrap{padding:0 8px 20px}
    .ce-header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:14px}
    .ce-header h2{margin:0;font-size:20px;color:#e2e8f0}
    .ce-sub{font-size:13px;color:#94a3b8}
    .ce-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .ce-tab{padding:8px 16px;border-radius:8px;background:#0e1729;border:1px solid #1e3a5f;color:#94a3b8;cursor:pointer;font-size:13px}
    .ce-tab.active{background:#0ea5e9;color:#fff;border-color:#0ea5e9;font-weight:700}
    .ce-sec{display:none}
    .ce-sec.active{display:block}
    .ce-btn{padding:7px 14px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600}
    .ce-btn-pri{background:#0ea5e9;color:#fff}
    .ce-btn-ok{background:#10b981;color:#fff}
    .ce-btn-warn{background:#f59e0b;color:#fff}
    .ce-btn-dan{background:#f87171;color:#fff}
    .ce-btn-ghost{background:#1e293b;color:#e2e8f0;border:1px solid #334155}
    .ce-badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700}
    .ce-empty{text-align:center;padding:20px;color:#64748b;font-size:13px}
    .ce-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .ce-card{background:#0a1222;border:1px solid #1e3a5f;border-radius:14px;padding:14px;margin-bottom:12px}
    .ce-card-title{font-size:15px;font-weight:800;color:#60a5fa;margin-bottom:10px;display:flex;gap:10px;align-items:center}
    .ce-card-sub{font-size:12px;color:#94a3b8;margin-bottom:10px}
    .ce-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
    .ce-table th,.ce-table td{padding:7px 6px;border-bottom:1px solid #1e3a5f}
    .ce-table th{color:#94a3b8;font-weight:700;text-align:left;background:#0e1729}
    .ce-table tr:hover{background:#0e1729}
    .ce-stat{padding:12px;border-radius:10px;background:#0e1729;border:1px solid #1e3a5f}
    .ce-stat-val{font-size:20px;font-weight:800;color:#e2e8f0}
    .ce-stat-lbl{font-size:11px;color:#94a3b8}
    .ce-prod{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#0e1729;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:8px}
    .ce-prod-info{flex:1;min-width:240px}
    .ce-prod-name{font-size:14px;font-weight:700;color:#e2e8f0}
    .ce-prod-saldo{font-size:13px;color:#94a3b8}
    .ce-prod-saldo.critico{color:#f87171}
    .ce-form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px}
    .ce-input{width:100%;padding:7px 10px;border:1px solid #1e3a5f;border-radius:6px;background:#0a1222;color:#e2e8f0;font-size:13px}
    .ce-req-item{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 90px;gap:8px;align-items:end;background:#0e1729;border:1px solid #1e3a5f;border-radius:8px;padding:10px;margin-bottom:8px}
    .ce-req-item-btn{width:100%;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:7px 0;cursor:pointer}
    .ce-filtro{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:end}
    .ce-status-PENDENTE{background:rgba(148,163,184,.15);color:#94a3b8}
    .ce-status-PARCIAL{background:rgba(245,158,11,.15);color:#f59e0b}
    .ce-status-COMPRADO{background:rgba(16,185,129,.15);color:#10b981}
    .ce-status-EXCEDENTE{background:rgba(248,113,113,.15);color:#f87171}
    .ce-mobile{display:none}
    @media(max-width:720px){.ce-table-wrap{display:none}.ce-mobile{display:block}}
  `;
  document.head.appendChild(st);
}

window.ceSetTab=function(tab){
  document.querySelectorAll('.ce-tab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.ce-sec').forEach(el=>el.classList.remove('active'));
  const t=document.getElementById('ce-tab-'+tab); if(t) t.classList.add('active');
  const s=document.getElementById('ce-sec-'+tab); if(s) s.classList.add('active');
};

function _ceProdCard(p,lancs,can){
  const c=_ceCalc(p,lancs);
  const base=_ceUnidadeBase(p);
  const fatorCaixa=_ceFator(p,'CAIXA');
  const cx=fatorCaixa>1?Math.floor(c.saldo/fatorCaixa):0;
  const resto=fatorCaixa>1?c.saldo-(cx*fatorCaixa):0;
  const cxTxt=fatorCaixa>1?` (${cx} CX${resto>0?` e ${_ceFmtNum(resto)} ${base}`:''})`:'';
  const crit=c.saldo<=c.critico;
  return `<div class="ce-prod">
    <div class="ce-prod-info">
      <div class="ce-prod-name">${_ceEsc(p.description||'Produto')}</div>
      <div class="ce-prod-saldo ${crit?'critico':''}"><strong>${_ceFmtNum(c.saldo)} ${base}</strong>${cxTxt} · Entr. ${_ceFmtNum(c.ent)} · Sai. ${_ceFmtNum(c.sai)} · Crítico: ${_ceFmtNum(c.critico)} ${crit?'<span class="ce-badge ce-status-EXCEDENTE">CRÍTICO</span>':''}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${can?`<button class="ce-btn ce-btn-ok" onclick="ceOpenLancamentoModal(null,'${p.id}','ENTRADA')">+ Entrada</button><button class="ce-btn ce-btn-dan" onclick="ceOpenLancamentoModal(null,'${p.id}','SAIDA')">- Saída</button><button class="ce-btn ce-btn-ghost" onclick="ceOpenProdutoModal('${p.id}')">⚙️</button>`:''}
    </div>
  </div>`;
}

function _ceReqItemRow(it,idx){
  const prods=[...S.subitems].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const opts=`<option value="">Selecione ou digite</option>`+prods.map(p=>`<option value="${p.id}" ${p.id===it.subitem_id?'selected':''}>${_ceEsc(p.description||'')}</option>`).join('');
  const un=CE_UNIDADES.map(u=>`<option value="${u}" ${u===it.unidade?'selected':''}>${u}</option>`).join('');
  return `<div class="ce-req-item" data-idx="${idx}">
    <div><label style="font-size:11px;color:#94a3b8">Produto</label><select class="ce-input" id="ce-req-prod-${idx}">${opts}</select></div>
    <div><label style="font-size:11px;color:#94a3b8">Qtd</label><input type="number" step="0.01" class="ce-input" id="ce-req-qtd-${idx}" value="${_ceFmtNum(it.qtd||1)}"></div>
    <div><label style="font-size:11px;color:#94a3b8">Unidade</label><select class="ce-input" id="ce-req-un-${idx}">${un}</select></div>
    <div><label style="font-size:11px;color:#94a3b8">1 un = ? base</label><input type="number" step="0.01" class="ce-input" id="ce-req-fator-${idx}" value="${_ceFmtNum(it.fator||1)}"></div>
    <div><label style="font-size:11px;color:#94a3b8">Preço unit. R$</label><input type="number" step="0.01" class="ce-input" id="ce-req-preco-${idx}" value="${_ceFmtNum(it.preco_unitario||0)}"></div>
    <button class="ce-req-item-btn" onclick="ceRemoveReqItem(${idx})">Remover</button>
  </div>`;
}

function _ceRefreshReqItems(){
  const wrap=document.getElementById('ce-req-items');
  if(wrap) wrap.innerHTML=CE_REQ_ITEMS.map((it,i)=>_ceReqItemRow(it,i)).join('') || '<div class="ce-empty">Nenhum item</div>';
}

window.ceAddReqItem=function(){ CE_REQ_ITEMS.push({id:_ceNovaReqId(),subitem_id:'',qtd:1,unidade:'UNIDADE',fator:1,preco_unitario:0}); _ceRefreshReqItems(); };
window.ceRemoveReqItem=function(idx){ CE_REQ_ITEMS.splice(idx,1); _ceRefreshReqItems(); };

window.renderControleEstoque=function(secId){
  const sec=S.secs.find(s=>s.id===secId); if(!sec) return;
  curSecId=secId;
  ceInjectStyles();
  const can=S.isAdmin || (window.userCan && window.userCan(window.modForSec(sec),'editar'));
  const titulo=_ceEsc(sec.ce_titulo_controle || sec.name || 'CONTROLE DE ESTOQUE');
  const secretaria=_ceEsc(sec.ce_nome_secretaria || '');
  const items=[...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const produtos=[...S.subitems.filter(s=>items.some(i=>i.id===s.item_id) && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const lancs=[...S.estoque.filter(e=>e.atividade_id===secId)].sort((a,b)=>{const da=new Date((a.data||'2000-01-01')+'T00:00'), db=new Date((b.data||'2000-01-01')+'T00:00'); return db-da;});
  const requisicoes=[...S.requisicoes.filter(r=>r.atividade_id===secId)].sort((a,b)=>(parseInt(b.numero)||0)-(parseInt(a.numero)||0));

  let totalEnt=0,totalSai=0,totalDin=0,qtdCrit=0,totalReq=requisicoes.length;
  produtos.forEach(p=>{ const c=_ceCalc(p,lancs); totalEnt+=c.ent; totalSai+=c.sai; totalDin+=c.total; if(c.saldo<=c.critico) qtdCrit++; });

  const estqHtml=items.map(item=>{
    const prods=produtos.filter(p=>p.item_id===item.id);
    const card=prods.map(p=>_ceProdCard(p,lancs,can)).join('');
    return `<div class="ce-card">
      <div class="ce-card-title">${_ceEsc(item.description||'Categoria')}</div>
      ${card || '<div class="ce-empty">Nenhum produto</div>'}
    </div>`;
  }).join('') || '<div class="ce-empty">Nenhuma categoria cadastrada</div>';

  const movFilter=`<div class="ce-filtro">
    <div><select id="ce-filtro-tipo" onchange="renderControleEstoque(curSecId)" class="ce-input"><option value="">Todos</option>${['ENTRADA','SAIDA'].map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
    <div><input type="date" id="ce-filtro-ini" onchange="renderControleEstoque(curSecId)" class="ce-input" placeholder="De"></div>
    <div><input type="date" id="ce-filtro-fim" onchange="renderControleEstoque(curSecId)" class="ce-input" placeholder="Até"></div>
  </div>`;

  const filtTipo=document.getElementById('ce-filtro-tipo')?.value||'';
  const filtIni=document.getElementById('ce-filtro-ini')?.value||'';
  const filtFim=document.getElementById('ce-filtro-fim')?.value||'';
  const movs=lancs.filter(e=>{
    if(filtTipo && e.tipo!==filtTipo) return false;
    if(filtIni && (e.data||'')<filtIni) return false;
    if(filtFim && (e.data||'')>filtFim) return false;
    return true;
  });

  const movRows=movs.map(e=>{
    const prod=produtos.find(p=>p.id===e.subitem_id);
    const isEnt=e.tipo==='ENTRADA';
    return `<tr>
      <td>${e.data?fmtD(e.data):'—'}</td>
      <td><span class="ce-badge ce-status-${isEnt?'COMPRADO':'EXCEDENTE'}">${_ceEsc(e.tipo)}</span></td>
      <td>${_ceEsc(prod?.description||e.produto||'—')}</td>
      <td>${_ceFmtNum(e.quantidade||0)} ${_ceEsc(e.unidade||'')}</td>
      <td>${_ceFmtNum(e.qtd_base||0)} ${_ceEsc(prod?_ceUnidadeBase(prod):'—')}</td>
      <td>${isEnt?'R$ '+_ceFmtMoney(e.preco_unitario):'—'}</td>
      <td>${isEnt?'R$ '+_ceFmtMoney(e.valor_total):'—'}</td>
      <td>${_ceEsc(e.destino||'—')}</td>
      <td>${can && !e.requisicao_id?`<button class="ce-btn ce-btn-ghost" onclick="ceDeleteLancamento('${e.id}')">🗑️</button>`:''}</td>
    </tr>`;
  }).join('');

  const relStats=`<div class="ce-grid" style="margin-bottom:14px">
    <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalEnt)}</div><div class="ce-stat-lbl">Entradas (base)</div></div>
    <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalSai)}</div><div class="ce-stat-lbl">Saídas (base)</div></div>
    <div class="ce-stat"><div class="ce-stat-val">${_ceFmtNum(totalEnt-totalSai)}</div><div class="ce-stat-lbl">Saldo em Estoque</div></div>
    <div class="ce-stat"><div class="ce-stat-val" style="color:#10b981">R$ ${_ceFmtMoney(totalDin)}</div><div class="ce-stat-lbl">Investimento</div></div>
    <div class="ce-stat"><div class="ce-stat-val" style="color:${qtdCrit?'#f87171':'#10b981'}">${qtdCrit}</div><div class="ce-stat-lbl">Produtos Críticos</div></div>
    <div class="ce-stat"><div class="ce-stat-val" style="color:#0ea5e9">${totalReq}</div><div class="ce-stat-lbl">Requisições</div></div>
  </div>`;

  const critList=produtos.filter(p=>_ceCalc(p,lancs).saldo<=_ceCritico(p)).map(p=>{
    const c=_ceCalc(p,lancs);
    return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #1e293f"><span>${_ceEsc(p.description||'')}</span><span style="color:#f87171;font-weight:700">${_ceFmtNum(c.saldo)} ${_ceUnidadeBase(p)}</span></div>`;
  }).join('');

  const reqCards=requisicoes.map(r=>{
    const itens=Array.isArray(r.itens)?r.itens:[];
    const status=_ceReqStatus(r,lancs);
    const stMap={PENDENTE:['PENDENTE','#94a3b8'],PARCIAL:['PARCIAL','#f59e0b'],COMPRADO:['COMPRADO','#10b981'],EXCEDENTE:['EXCEDENTE','#f87171']};
    const [stLabel,stColor]=stMap[status]||stMap.PENDENTE;
    const itemRows=itens.map(it=>{
      const prod=produtos.find(p=>p.id===it.subitem_id);
      const comp=_ceReqComprado(r.id,it.id,lancs);
      const reqBase=parseFloat(it.qtd_base)||0;
      const st=_ceReqItemStatus(r.id,it,lancs);
      const diff=comp-reqBase;
      const diffTxt=diff===0?'<span style="color:#10b981">ok</span>':(diff>0?`<span style="color:#f87171">+${_ceFmtNum(diff)} base</span>`:`<span style="color:#f59e0b">falta ${_ceFmtNum(Math.abs(diff))} base</span>`);
      return `<tr>
        <td>${_ceEsc(prod?prod.description:(it.descricao||'—'))}</td>
        <td>${_ceFmtNum(it.qtd||0)} ${_ceEsc(it.unidade||'')}</td>
        <td>${_ceFmtNum(reqBase)} ${_ceEsc(prod?_ceUnidadeBase(prod):'base')}</td>
        <td>${_ceFmtNum(comp)}</td>
        <td>${diffTxt}</td>
        <td><span class="ce-badge" style="background:${stColor}22;color:${stColor}">${st}</span></td>
        <td>${can?`<button class="ce-btn ce-btn-ok" onclick="ceConfirmarCompra('${r.id}','${it.id}')">Comprar</button>`:''}</td>
      </tr>`;
    }).join('');
    return `<div class="ce-card">
      <div class="ce-card-title" style="justify-content:space-between">
        <div style="display:flex;gap:10px;align-items:center">
          <span style="background:#0ea5e9;color:#fff;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:800">#${r.numero}</span>
          <span style="font-size:16px">Requisição</span>
          <span class="ce-badge" style="background:${stColor}22;color:${stColor}">${stLabel}</span>
        </div>
        <div style="display:flex;gap:6px">
          ${can?`<button class="ce-btn ce-btn-ghost" onclick="ceOpenRequisicaoModal('${r.id}')">✏️</button><button class="ce-btn ce-btn-dan" onclick="ceDeleteRequisicao('${r.id}')">🗑️</button>`:''}
        </div>
      </div>
      <div class="ce-card-sub">Data: ${r.data?fmtD(r.data):'—'} · Origem: ${_ceEsc(r.origem||'—')} → Destino: ${_ceEsc(r.destino||'—')}${r.observacao?' · Obs: '+_ceEsc(r.observacao):''}</div>
      ${itens.length?`<table class="ce-table"><thead><tr><th>Produto</th><th>Solicitado</th><th>Base</th><th>Comprado</th><th>Diferença</th><th>Status</th><th></th></tr></thead><tbody>${itemRows}</tbody></table>`:'<div class="ce-empty">Nenhum item nesta requisição</div>'}
    </div>`;
  }).join('') || '<div class="ce-empty">Nenhuma requisição cadastrada</div>';

  const html=`<div class="ce-wrap">
    <div class="ce-header">
      <div>
        <h2>${titulo}</h2>
        ${secretaria?`<div class="ce-sub">${secretaria}</div>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${can?`<button class="ce-btn ce-btn-ok" onclick="openItemModal(null,curSecId)">+ Categoria</button><button class="ce-btn ce-btn-ghost" onclick="openItemModal(null,curSecId)">+ Produto</button>`:''}
        <button class="ce-btn ce-btn-pri" onclick="ceGerarPdf(curSecId)">📄 PDF</button>
      </div>
    </div>
    <div class="ce-tabs">
      <div class="ce-tab" id="ce-tab-requisicoes" onclick="ceSetTab('requisicoes')">Requisições</div>
      <div class="ce-tab" id="ce-tab-estoque" onclick="ceSetTab('estoque')">Estoque</div>
      <div class="ce-tab" id="ce-tab-movimentacoes" onclick="ceSetTab('movimentacoes')">Movimentações</div>
      <div class="ce-tab" id="ce-tab-relatorio" onclick="ceSetTab('relatorio')">Relatório</div>
    </div>
    <div class="ce-sec" id="ce-sec-requisicoes">
      <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap">
        ${can?`<button class="ce-btn ce-btn-pri" onclick="ceOpenRequisicaoModal()">+ Nova Requisição</button>`:''}
        ${can?`<button class="ce-btn ce-btn-ghost" onclick="ceImportarRequisicoesPdf()">📥 Importar PDF 31/07</button>`:''}
        ${can?`<button class="ce-btn ce-btn-ghost" onclick="ceImportarArquivo('js/requisicoes-licitacao.json','a Licitação de Medicamentos (Pregão 028/2022, 144 itens)')">💊 Importar Licitação Medicamentos</button>`:''}
      </div>
      ${reqCards}
    </div>
    <div class="ce-sec" id="ce-sec-estoque">${estqHtml}</div>
    <div class="ce-sec" id="ce-sec-movimentacoes">
      ${movFilter}
      <div class="ce-table-wrap">
        <table class="ce-table"><thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Base</th><th>Preço</th><th>Total</th><th>Destino</th><th></th></tr></thead><tbody>${movRows || '<tr><td colspan="9" class="ce-empty">Nenhuma movimentação</td></tr>'}</tbody></table>
      </div>
    </div>
    <div class="ce-sec" id="ce-sec-relatorio">
      ${relStats}
      ${critList?`<div class="ce-card"><div class="ce-card-title" style="color:#f87171">⚠️ Produtos em Estoque Crítico</div>${critList}</div>`:'<div class="ce-card ce-empty">Nenhum produto em estoque crítico</div>'}
    </div>
  </div>`;

  setC(html);
  ceSetTab('requisicoes');
};

window.ceOpenProdutoModal=function(subitemId){
  const prod=S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const ef=prod.extra_fields||{};
  const base=_ceEsc(ef.ce_unidade_base || 'UNIDADE');
  const crit=_ceEsc(ef.ce_estoque_critico || '0');
  const fatores=CE_UNIDADES.map(u=>{
    const v=_ceEsc(ef['ce_fator_'+u] || '1');
    return `<div class="ce-form-row-item"><label style="font-size:11px;color:#94a3b8">1 ${u} = ? base</label><input type="number" step="0.01" class="ce-input" id="ce-prod-fator-${u}" value="${v}"></div>`;
  }).join('');
  openModal('⚙️ Configurar Produto','',`
    <div class="ce-form-row">
      <div><label style="font-size:11px;color:#94a3b8">Produto</label><input type="text" class="ce-input" disabled value="${_ceEsc(prod.description||'')}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Unidade base</label><input type="text" class="ce-input" id="ce-prod-unidade-base" value="${base}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Estoque crítico</label><input type="number" step="0.01" class="ce-input" id="ce-prod-critico" value="${crit}"></div>
    </div>
    <div class="ce-form-row">${fatores}</div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveProduto('${subitemId}')">💾 Salvar</button></div>`);
};

window.ceSaveProduto=async function(subitemId){
  const prod=S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const ef={...(prod.extra_fields||{})};
  ef.ce_unidade_base=String(document.getElementById('ce-prod-unidade-base')?.value || 'UNIDADE').toUpperCase().trim();
  ef.ce_estoque_critico=parseFloat(document.getElementById('ce-prod-critico')?.value) || 0;
  CE_UNIDADES.forEach(u=>{ ef['ce_fator_'+u]=parseFloat(document.getElementById('ce-prod-fator-'+u)?.value) || 1; });
  await updateDoc(doc(db,'subitems',subitemId),{extra_fields:ef,updated_at:serverTimestamp()});
  await loadData(); closeModal(); toast('Produto configurado!');
  renderControleEstoque(curSecId);
};

window.ceOpenLancamentoModal=function(id,subitemId,tipo){
  const prod=S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const base=_ceUnidadeBase(prod);
  const un=CE_UNIDADES.map(u=>`<option value="${u}" ${u===base?'selected':''}>${u}</option>`).join('');
  openModal((tipo==='ENTRADA'?'📥 Entrada':'📤 Saída')+' - '+_ceEsc(prod.description||''),'',`
    <div class="ce-form-row">
      <div><label style="font-size:11px;color:#94a3b8">Produto</label><input type="text" class="ce-input" disabled value="${_ceEsc(prod.description||'')} (${base})"></div>
      <div><label style="font-size:11px;color:#94a3b8">Quantidade</label><input type="number" step="0.01" class="ce-input" id="ce-lanc-qtd" value="1"></div>
      <div><label style="font-size:11px;color:#94a3b8">Unidade</label><select class="ce-input" id="ce-lanc-unidade">${un}</select></div>
      ${tipo==='ENTRADA'?`<div><label style="font-size:11px;color:#94a3b8">Preço unit. R$</label><input type="number" step="0.01" class="ce-input" id="ce-lanc-preco" value="0"></div>`:''}
      <div><label style="font-size:11px;color:#94a3b8">Data</label><input type="date" class="ce-input" id="ce-lanc-data" value="${_ceHoje()}"></div>
      ${tipo==='SAIDA'?`<div><label style="font-size:11px;color:#94a3b8">Destino</label><input type="text" class="ce-input" id="ce-lanc-destino" placeholder="Setor/departamento"></div>`:''}
    </div>
    <div class="ce-form-row"><div style="grid-column:1/-1"><label style="font-size:11px;color:#94a3b8">Observação</label><textarea class="ce-input" id="ce-lanc-obs" rows="2"></textarea></div></div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveLancamento('${id||''}','${subitemId}','${tipo}')">💾 Salvar</button></div>`);
};

window.ceSaveLancamento=async function(id,subitemId,tipo){
  const prod=S.subitems.find(s=>s.id===subitemId); if(!prod) return;
  const qtd=parseFloat(document.getElementById('ce-lanc-qtd')?.value)||0;
  const unidade=String(document.getElementById('ce-lanc-unidade')?.value||'UNIDADE').toUpperCase().trim();
  const fator=_ceFator(prod,unidade);
  const qtd_base=qtd*fator;
  const data=document.getElementById('ce-lanc-data')?.value||'';
  const obs=document.getElementById('ce-lanc-obs')?.value?.trim()||'';
  if(qtd<=0 || !data){toast('Quantidade e data são obrigatórios','error'); return;}
  if(tipo==='SAIDA'){
    const c=_ceCalc(prod,S.estoque.filter(e=>e.atividade_id===curSecId));
    if(qtd_base>c.saldo){toast('Saldo insuficiente. Disponível: '+_ceFmtNum(c.saldo)+' '+_ceUnidadeBase(prod),'error'); return;}
  }
  const preco=tipo==='ENTRADA'?(parseFloat(document.getElementById('ce-lanc-preco')?.value)||0):0;
  const destino=tipo==='SAIDA'?(document.getElementById('ce-lanc-destino')?.value?.trim()||''):'';
  const docData={atividade_id:curSecId,item_id:prod.item_id,subitem_id:subitemId,produto:prod.description||'',tipo,quantidade:qtd,unidade,fator,qtd_base,preco_unitario:preco,valor_total:qtd*preco,data,destino,observacao:obs,requisicao_id:'',requisicao_item_id:'',updated_at:serverTimestamp()};
  if(id){ await updateDoc(doc(db,'estoque',id),docData); }
  else { docData.created_at=serverTimestamp(); await addDoc(collection(db,'estoque'),docData); }
  await loadData(); closeModal(); toast('Movimentação salva!');
  renderControleEstoque(curSecId);
};

window.ceDeleteLancamento=async function(id){
  if(!confirm('Excluir movimentação?')) return;
  const e=S.estoque.find(x=>x.id===id);
  await deleteDoc(doc(db,'estoque',id));
  await loadData(); toast('Excluído!');
  renderControleEstoque(e?.atividade_id||curSecId);
};

window.ceOpenRequisicaoModal=function(id){
  const req=id?S.requisicoes.find(r=>r.id===id):null;
  CE_REQ_ITEMS=[];
  if(req && Array.isArray(req.itens)) CE_REQ_ITEMS=req.itens.map(it=>({...it}));
  const numero=id?(req.numero||'—'):'Automático';
  openModal((id?'✏️ Editar Requisição #'+req.numero:'🆕 Nova Requisição'),'',`
    <div class="ce-form-row">
      <div><label style="font-size:11px;color:#94a3b8">Número</label><input type="text" class="ce-input" id="ce-req-numero" value="${numero}" disabled></div>
      <div><label style="font-size:11px;color:#94a3b8">Data</label><input type="date" class="ce-input" id="ce-req-data" value="${req?.data || _ceHoje()}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Origem</label><input type="text" class="ce-input" id="ce-req-origem" value="${_ceEsc(req?.origem||'')}" placeholder="Ex: Secretaria de Saúde"></div>
      <div><label style="font-size:11px;color:#94a3b8">Destino</label><input type="text" class="ce-input" id="ce-req-destino" value="${_ceEsc(req?.destino||'')}" placeholder="Ex: Farmácia"></div>
    </div>
    <div class="ce-form-row"><div style="grid-column:1/-1"><label style="font-size:11px;color:#94a3b8">Observação</label><textarea class="ce-input" id="ce-req-obs" rows="2">${_ceEsc(req?.observacao||'')}</textarea></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px"><span class="ce-card-title" style="margin:0">Itens da Requisição</span>
      <button class="ce-btn ce-btn-pri" onclick="ceAddReqItem()">+ Item</button>
    </div>
    <div id="ce-req-items"></div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveRequisicao('${id||''}')">💾 Salvar</button></div>`);
  _ceRefreshReqItems();
};

window.ceSaveRequisicao=async function(id){
  const data=document.getElementById('ce-req-data')?.value||'';
  const origem=document.getElementById('ce-req-origem')?.value?.trim()||'';
  const destino=document.getElementById('ce-req-destino')?.value?.trim()||'';
  const obs=document.getElementById('ce-req-obs')?.value?.trim()||'';
  const prods=[...S.subitems];
  const itens=[];
  for(let i=0;i<CE_REQ_ITEMS.length;i++){
    const subitemId=document.getElementById('ce-req-prod-'+i)?.value||'';
    const qtd=parseFloat(document.getElementById('ce-req-qtd-'+i)?.value)||0;
    const unidade=String(document.getElementById('ce-req-un-'+i)?.value||'UNIDADE').toUpperCase().trim();
    const fator=parseFloat(document.getElementById('ce-req-fator-'+i)?.value)||1;
    const preco=parseFloat(document.getElementById('ce-req-preco-'+i)?.value)||0;
    if(qtd<=0) continue;
    const prod=prods.find(p=>p.id===subitemId);
    itens.push({id:CE_REQ_ITEMS[i].id||_ceNovaReqId(),subitem_id:subitemId,descricao:prod?prod.description:'',qtd,unidade,fator,qtd_base:qtd*fator,preco_unitario:preco});
  }
  if(!itens.length){toast('Adicione ao menos um item com quantidade','error'); return;}
  let numero;
  if(id){ numero=S.requisicoes.find(r=>r.id===id)?.numero; }
  else { numero=Math.max(0,...S.requisicoes.filter(r=>r.atividade_id===curSecId).map(r=>parseInt(r.numero)||0))+1; }
  const dataDoc={atividade_id:curSecId,numero,data,origem,destino,observacao:obs,itens,status:'PENDENTE',updated_at:serverTimestamp()};
  if(id){ await updateDoc(doc(db,'requisicoes',id),dataDoc); }
  else { dataDoc.created_at=serverTimestamp(); await addDoc(collection(db,'requisicoes'),dataDoc); }
  await loadData(); closeModal(); toast('Requisição salva!');
  renderControleEstoque(curSecId);
};

window.ceDeleteRequisicao=async function(id){
  if(!confirm('Excluir requisição e todos os itens?')) return;
  await deleteDoc(doc(db,'requisicoes',id));
  await loadData(); toast('Requisição excluída!');
  renderControleEstoque(curSecId);
};

function _ceNormDesc(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
async function _ceFindOrCreateProduto(desc){
  const norm=_ceNormDesc(desc);
  let prod=S.subitems.find(s=>s.atividade_id===curSecId && s.parent_type!=='subitem' && _ceNormDesc(s.description)===norm);
  if(prod) return prod.id;
  let item=S.items.find(i=>i.atividade_id===curSecId);
  if(!item){
    const itemRef=await addDoc(collection(db,'items'),{atividade_id:curSecId,description:'PRODUTOS',concluded:0,extra_fields:{},order_num:0,created_at:serverTimestamp(),updated_at:serverTimestamp()});
    item={id:itemRef.id,atividade_id:curSecId,description:'PRODUTOS'};
  }
  const subRef=await addDoc(collection(db,'subitems'),{atividade_id:curSecId,item_id:item.id,parent_id:item.id,parent_type:'item',description:desc,concluded:0,extra_fields:{},order_num:S.subitems.filter(s=>s.item_id===item.id).length,created_at:serverTimestamp(),updated_at:serverTimestamp()});
  return subRef.id;
}

window.ceConfirmarCompra=function(requisicaoId,itemId){
  const req=S.requisicoes.find(r=>r.id===requisicaoId); if(!req) return;
  const it=(Array.isArray(req.itens)?req.itens:[]).find(x=>x.id===itemId); if(!it) return;
  const nomeProd=(it.descricao.split('|').pop()||it.descricao).trim();
  const prod=it.subitem_id?S.subitems.find(s=>s.id===it.subitem_id):null;
  const prodName=_ceEsc(prod?prod.description:nomeProd);
  const prodId=_ceEsc(it.subitem_id||'');
  const un=CE_UNIDADES.map(u=>`<option value="${u}" ${u===it.unidade?'selected':''}>${u}</option>`).join('');
  openModal('✅ Confirmar Compra - Item #'+_ceEsc(itemId.slice(-6)),'',`
    <div class="ce-form-row">
      <div><label style="font-size:11px;color:#94a3b8">Produto *</label><input type="hidden" id="ce-comp-prod" value="${prodId}"><input type="text" class="ce-input" disabled value="${prodName}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Qtd recebida *</label><input type="number" step="0.01" class="ce-input" id="ce-comp-qtd" value="${_ceFmtNum(it.qtd||1)}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Unidade</label><select class="ce-input" id="ce-comp-un">${un}</select></div>
      <div><label style="font-size:11px;color:#94a3b8">Preço unit. R$</label><input type="number" step="0.01" class="ce-input" id="ce-comp-preco" value="${_ceFmtNum(it.preco_unitario||0)}"></div>
      <div><label style="font-size:11px;color:#94a3b8">Data</label><input type="date" class="ce-input" id="ce-comp-data" value="${_ceHoje()}"></div>
    </div>
    <div class="ce-form-row"><div style="grid-column:1/-1"><label style="font-size:11px;color:#94a3b8">Observação</label><textarea class="ce-input" id="ce-comp-obs" rows="2" placeholder="Fornecedor, nota fiscal, diferenças"></textarea></div></div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ceSaveCompra('${requisicaoId}','${itemId}')">💾 Confirmar</button></div>`);
};

window.ceSaveCompra=async function(requisicaoId,itemId){
  const req=S.requisicoes.find(r=>r.id===requisicaoId); if(!req) return;
  const it=(Array.isArray(req.itens)?req.itens:[]).find(x=>x.id===itemId); if(!it){toast('Item não encontrado','error'); return;}
  let prodId=document.getElementById('ce-comp-prod')?.value||'';
  const qtd=parseFloat(document.getElementById('ce-comp-qtd')?.value)||0;
  const unidade=String(document.getElementById('ce-comp-un')?.value||'UNIDADE').toUpperCase().trim();
  const preco=parseFloat(document.getElementById('ce-comp-preco')?.value)||0;
  const data=document.getElementById('ce-comp-data')?.value||'';
  const obs=document.getElementById('ce-comp-obs')?.value?.trim()||'';
  if(!prodId){
    const nomeProd=(it.descricao.split('|').pop()||it.descricao).trim();
    prodId=await _ceFindOrCreateProduto(nomeProd);
    it.subitem_id=prodId;
    await updateDoc(doc(db,'requisicoes',requisicaoId),{itens:req.itens,updated_at:serverTimestamp()});
  }
  if(!prodId || qtd<=0 || !data){toast('Produto, quantidade e data são obrigatórios','error'); return;}
  const prodSnap=await getDoc(doc(db,'subitems',prodId));
  const prod=prodSnap.data()||{};
  prod.id=prodId;
  const fator=_ceFator(prod,unidade);
  const qtd_base=qtd*fator;
  const docData={atividade_id:curSecId,item_id:prod?.item_id||'',subitem_id:prodId,produto:prod?.description||it.descricao||'',tipo:'ENTRADA',quantidade:qtd,unidade,fator,qtd_base,preco_unitario:preco,valor_total:qtd*preco,data,destino:'',observacao:obs,requisicao_id:requisicaoId,requisicao_item_id:itemId,updated_at:serverTimestamp(),created_at:serverTimestamp()};
  await addDoc(collection(db,'estoque'),docData);
  await loadData(); closeModal(); toast('Compra registrada no estoque!');
  renderControleEstoque(curSecId);
};

window.ceGerarPdf=async function(secId){
  const sec=S.secs.find(s=>s.id===secId); if(!sec) return;
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error'); return;}
  toast('Gerando PDF…','info',8000);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297, mx=12, cw=W-mx*2;
  const now=new Date().toLocaleDateString('pt-BR');

  const items=[...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const produtos=[...S.subitems.filter(s=>items.some(i=>i.id===s.item_id) && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const lancs=[...S.estoque.filter(e=>e.atividade_id===secId)].sort((a,b)=>new Date(b.data||'2000-01-01')-new Date(a.data||'2000-01-01'));
  const requisicoes=[...S.requisicoes.filter(r=>r.atividade_id===secId)].sort((a,b)=>(parseInt(b.numero)||0)-(parseInt(a.numero)||0));

  let y=16;
  doc.setFillColor(13,34,64); doc.rect(mx,10,cw,0.7,'F');
  doc.setTextColor(226,232,240); doc.setFontSize(18); doc.setFont('helvetica','bold');
  const tit=_ceEsc(sec.ce_titulo_controle || sec.name || 'CONTROLE DE ESTOQUE');
  doc.text(tit,mx,y); y+=10;
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  doc.text(_ceEsc(sec.ce_nome_secretaria||'')+' · '+now,mx,y); y+=16;

  const reqRows=requisicoes.map(r=>{
    const itens=Array.isArray(r.itens)?r.itens:[];
    const st=_ceReqStatus(r,lancs);
    return [_ceEsc(String(r.numero)), _ceEsc(r.data?fmtD(r.data):'—'), _ceEsc(st), _ceEsc(r.origem||'—'), _ceEsc(r.destino||'—'), String(itens.length)];
  });
  if(reqRows.length){
    doc.setTextColor(226,232,240); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('REQUISIÇÕES DE COMPRA',mx,y); y+=8;
    doc.autoTable({startY:y,margin:{left:mx,right:mx},theme:'grid',
      head:[['Nº','Data','Status','Origem','Destino','Itens']],
      body:reqRows,
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:9},
      bodyStyles:{fontSize:9,textColor:[40,40,40]},
      styles:{cellPadding:2,font:'helvetica'},
      columnStyles:{0:{cellWidth:22,halign:'center'},1:{cellWidth:25},2:{cellWidth:30},3:{cellWidth:55},4:{cellWidth:55},5:{cellWidth:25,halign:'right'}}
    });
    y=doc.lastAutoTable.finalY+12;
  }

  const prodRows=produtos.map(p=>{
    const c=_ceCalc(p,lancs);
    return [_ceEsc(p.description||''), _ceEsc(_ceUnidadeBase(p)), _ceFmtNum(c.ent), _ceFmtNum(c.sai), _ceFmtNum(c.saldo), 'R$ '+_ceFmtMoney(c.total)];
  });
  if(prodRows.length){
    doc.setTextColor(226,232,240); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('SALDO POR PRODUTO',mx,y); y+=8;
    doc.autoTable({startY:y,margin:{left:mx,right:mx},theme:'grid',
      head:[['Produto','Unid.','Entradas','Saídas','Saldo','Investimento']],
      body:prodRows,
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:9},
      bodyStyles:{fontSize:9,textColor:[40,40,40]},
      styles:{cellPadding:2,font:'helvetica'},
      columnStyles:{0:{cellWidth:80},1:{cellWidth:30},2:{cellWidth:30,halign:'right'},3:{cellWidth:30,halign:'right'},4:{cellWidth:30,halign:'right'},5:{cellWidth:35,halign:'right'}}
    });
    y=doc.lastAutoTable.finalY+12;
  }

  const movRows=lancs.map(e=>{
    const prod=produtos.find(p=>p.id===e.subitem_id);
    const isEnt=e.tipo==='ENTRADA';
    return [fmtD(e.data), e.tipo, _ceEsc(prod?.description||e.produto||''), _ceFmtNum(e.quantidade||0)+' '+_ceEsc(e.unidade||''), _ceFmtNum(e.qtd_base||0), isEnt?('R$ '+_ceFmtMoney(e.valor_total)):'—'];
  });
  if(movRows.length){
    doc.setTextColor(226,232,240); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('MOVIMENTAÇÕES',mx,y); y+=8;
    doc.autoTable({startY:y,margin:{left:mx,right:mx},theme:'grid',
      head:[['Data','Tipo','Produto','Qtd','Base','Total']],
      body:movRows,
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:8},
      bodyStyles:{fontSize:8,textColor:[40,40,40]},
      styles:{cellPadding:1.5,font:'helvetica'},
      columnStyles:{0:{cellWidth:25},1:{cellWidth:25},2:{cellWidth:80},3:{cellWidth:30},4:{cellWidth:25,halign:'right'},5:{cellWidth:30,halign:'right'}}
    });
  }

  doc.save((_ceEsc((sec.name||'controle-estoque').replace(/[^a-zA-Z0-9À-ú ]/g,'_'))).trim()+'_estoque_'+now.replace(/\//g,'-')+'.pdf');
  toast('PDF gerado!','success');
};

window.ceImportarRequisicoesPdf=function(){
  return ceImportarArquivo('js/requisicoes-pdf.json','a Requisição nº 65/2026 do PDF 31/07/2026 (28 itens)');
};

window.ceImportarArquivo=async function(url,label){
  if(!curSecId){toast('Abra o Controle de Estoque primeiro','error');return;}
  if(!confirm('Importar '+label+'?')) return;
  try{
    const res=await fetch(url);
    if(!res.ok){toast('Arquivo de requisições não encontrado','error');return;}
    const data=await res.json();
    let next=Math.max(0,...S.requisicoes.filter(r=>r.atividade_id===curSecId).map(r=>parseInt(r.numero)||0));
    for(const req of data){
      if(req.numero!=null && S.requisicoes.some(r=>r.atividade_id===curSecId && parseInt(r.numero)===parseInt(req.numero))){
        toast('Requisição nº '+req.numero+' já existe, ignorada','info');
        continue;
      }
      const itens=[];
      for(const it of (req.itens||[])){
        const qtd=parseFloat(it.qtd)||0;
        itens.push({id:_ceNovaReqId(),subitem_id:'',descricao:it.descricao||'',qtd:qtd,unidade:String(it.unidade||'UNIDADE').toUpperCase().trim(),fator:1,qtd_base:qtd,preco_unitario:parseFloat(it.preco_unitario)||0});
      }
      if(!itens.length) continue;
      const num=req.numero!=null?parseInt(req.numero):(++next);
      const docData={atividade_id:curSecId,numero:num,data:req.data||'',origem:req.origem||'',destino:req.destino||'',observacao:req.observacao||'',itens,status:'PENDENTE',updated_at:serverTimestamp(),created_at:serverTimestamp()};
      await addDoc(collection(db,'requisicoes'),docData);
    }
    await loadData();
    toast('Requisições importadas com sucesso!');
    renderControleEstoque(curSecId);
  }catch(e){
    console.error(e);
    toast('Erro ao importar: '+e.message,'error');
  }
};
