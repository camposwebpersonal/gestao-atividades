/* ── CONTROLE DE CONTAS ── */

const CC_TIPOS = ['Luz','Água','Aluguel','Apólice','Seguro','Telefone','Internet','Outros'];

const ccEsc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
if (typeof window.esc !== 'function') window.esc = ccEsc;
if (typeof window.fmtD !== 'function') window.fmtD = d => { if(!d) return '—'; try { return new Date(d+'T00:00').toLocaleDateString('pt-BR'); } catch { return d; } };
if (typeof window.setC !== 'function') window.setC = h => document.getElementById('content').innerHTML = h;

const _ccNorm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
function _ccFindKey(ef, frag){
  return Object.keys(ef).find(k => _ccNorm(k).includes(_ccNorm(frag))) || null;
}
function _ccLocalExtraFields(local){
  const ef = (local && local.extra_fields) || {};
  const get = frag => { const k = _ccFindKey(ef, frag); return k ? ef[k] : ''; };
  return {
    numero_relogio: get('RELOGIO'),
    conta_contrato: get('CONTA CONTRATO') || get('CONTRATO'),
    endereco: get('ENDERECO'),
    medidor: get('MEDIDOR'),
  };
}

window.renderControleContas = function(secId){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  curSecId = secId;
  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const tipoFiltro = document.getElementById('cc-filtro-tipo')?.value || '';
  const anoFiltro = document.getElementById('cc-filtro-ano')?.value || '';
  const pagoFiltro = document.getElementById('cc-filtro-pago')?.value || '';

  let totalGeral = 0, totalPago = 0, totalPendente = 0;
  let qtdPago = 0, qtdPendente = 0, qtdTotal = 0;

  const categoriasHtml = items.map((item, idx)=>{
    const locais = [...S.subitems.filter(s=>s.item_id===item.id && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    let locaisHtml = '';
    locais.forEach((local, li)=>{
      const lancamentos = S.contas.filter(c=>c.subitem_id===local.id).sort((a,b)=>{
        const da = (a.mes_ano||'').split('/').reverse().join('-');
        const db = (b.mes_ano||'').split('/').reverse().join('-');
        return da.localeCompare(db);
      });
      let locRows = lancamentos.filter(c=>{
        if(tipoFiltro && c.tipo !== tipoFiltro) return false;
        if(anoFiltro && !String(c.mes_ano||'').includes('/'+anoFiltro)) return false;
        if(pagoFiltro === 'pago' && !c.pago) return false;
        if(pagoFiltro === 'pendente' && c.pago) return false;
        return true;
      });
      if(!locRows.length && (tipoFiltro || anoFiltro || pagoFiltro)) return '';
      const locTotal = locRows.reduce((a,c)=>a+(parseFloat(c.valor)||0),0);
      const locPago = locRows.filter(c=>c.pago).reduce((a,c)=>a+(parseFloat(c.valor)||0),0);
      const locPendente = locTotal - locPago;
      totalGeral += locTotal; totalPago += locPago; totalPendente += locPendente;
      qtdTotal += locRows.length; qtdPago += locRows.filter(c=>c.pago).length; qtdPendente += locRows.filter(c=>!c.pago).length;
      const efAll = (local && local.extra_fields) || {};
      const headMeta = Object.entries(efAll).filter(([k,v])=>String(v||'').trim()).map(([k,v])=>k+': '+v);
      const headMetaStr = headMeta.join(' • ') || 'Clique em editar para preencher dados do local';
      const tableRows = locRows.map((c,ri)=>{
        const pagoCls = c.pago ? 'cc-pago-row' : '';
        return `<tr class="${pagoCls}">
          <td>${esc(c.mes_ano||'—')}</td>
          <td>${esc(c.tipo||'—')}</td>
          <td><input type="text" value="${esc(c.leitura_relogio||'')}" onchange="ccSalvarCampo('${c.id}','leitura_relogio',this.value)" placeholder="Leitura"></td>
          <td><input type="text" value="${esc(c.consumo_kwh||'')}" onchange="ccSalvarCampo('${c.id}','consumo_kwh',this.value)" placeholder="kWh"></td>
          <td><input type="number" step="0.01" value="${esc(String(c.valor||''))}" onchange="ccSalvarCampo('${c.id}','valor',this.value)" placeholder="R$"></td>
          <td><input type="date" value="${esc(c.data_vencimento||'')}" onchange="ccSalvarCampo('${c.id}','data_vencimento',this.value)"></td>
          <td><input type="date" value="${esc(c.data_pagamento||'')}" onchange="ccSalvarCampo('${c.id}','data_pagamento',this.value)"></td>
          <td class="cc-col-pago"><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></td>
          <td><input type="text" value="${esc(c.observacao||'')}" onchange="ccSalvarCampo('${c.id}','observacao',this.value)" placeholder="Obs."></td>
          <td style="white-space:nowrap">${S.isAdmin?`<button class="card-btn" onclick="ccDeleteLancamento('${c.id}')">🗑️</button>`:''}</td>
        </tr>`;
      }).join('');

      const mobileRows = locRows.map(c=>{
        return `<div class="cc-mobile-card">
          <div class="cc-mobile-title">${esc(c.mes_ano||'—')} — ${esc(c.tipo||'—')}</div>
          <div class="cc-mobile-row"><span>Leitura</span><span>${esc(c.leitura_relogio||'—')}</span></div>
          <div class="cc-mobile-row"><span>Consumo</span><span>${esc(c.consumo_kwh||'—')}</span></div>
          <div class="cc-mobile-row"><span>Valor</span><span>R$ ${esc(String((parseFloat(c.valor)||0).toFixed(2)))}</span></div>
          <div class="cc-mobile-row"><span>Vencimento</span><span>${fmtD(c.data_vencimento)}</span></div>
          <div class="cc-mobile-row"><span>Pagamento</span><span>${fmtD(c.data_pagamento)}</span></div>
          <div class="cc-mobile-row"><span>Pago</span><span><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></span></div>
          <div class="cc-mobile-row"><span>Obs.</span><span>${esc(c.observacao||'—')}</span></div>
        </div>`;
      }).join('');

      locaisHtml += `<div class="cc-local-card">
        <div class="cc-local-head">
          <div class="cc-local-title">
            <div class="cc-local-name">${esc(local.description||'Local')}</div>
            <div class="cc-local-meta">${esc(headMetaStr)}</div>
          </div>
          <div class="cc-local-actions">
            ${S.isAdmin?`<button class="card-btn" onclick="ccOpenLocalModal('${local.id}','${item.id}')">✏️</button>`:''}
            <button class="btn-action primary" style="font-size:12px;padding:5px 12px" onclick="ccOpenLancamentoModal(null,'${local.id}')">+ Lançamento</button>
          </div>
        </div>
        <div class="cc-lancamentos">
          <div class="cc-table-wrap">
            <table class="cc-table">
              <thead><tr>
                <th>Mês/Ano</th><th>Tipo</th><th>Leitura</th><th>Consumo</th><th>Valor</th><th>Vencimento</th><th>Pagamento</th><th class="cc-col-pago">Pago</th><th>Obs.</th><th></th>
              </tr></thead>
              <tbody>${tableRows || '<tr><td colspan="10" style="text-align:center;color:var(--muted)">Nenhum lançamento</td></tr>'}</tbody>
            </table>
          </div>
          ${mobileRows}
          <div class="cc-total-bar">
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <span class="cc-badge">Total: R$ ${locTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
              <span class="cc-badge" style="background:rgba(16,185,129,.15);color:#10b981">Pago: R$ ${locPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
              <span class="cc-badge" style="background:rgba(248,113,113,.15);color:#f87171">Pendente: R$ ${locPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>
            <div style="font-size:11px;color:var(--muted)">${locRows.length} lançamento(s)</div>
          </div>
        </div>
      </div>`;
    });
    if(!locaisHtml) return '';
    return `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <div style="font-size:15px;font-weight:800;color:#60a5fa">${esc(item.description||'Categoria')}</div>
        ${S.isAdmin?`<button class="card-btn" onclick="ccOpenCategoriaModal('${item.id}','${secId}')">✏️</button>`:''}
      </div>
      ${locaisHtml}
      ${S.isAdmin?`<button class="btn-action" style="font-size:12px;padding:5px 12px" onclick="ccOpenLocalModal(null,'${item.id}')">+ Local</button>`:''}
    </div>`;
  }).join('');

  const anos = [...new Set(S.contas.filter(c=>c.atividade_id===secId && c.mes_ano).map(c=>String(c.mes_ano).split('/')[1]).filter(Boolean))].sort();
  const anoOptions = anos.map(a=>`<option value="${esc(a)}" ${a===anoFiltro?'selected':''}>${esc(a)}</option>`).join('');
  const tipoOptions = CC_TIPOS.map(t=>`<option value="${esc(t)}" ${t===tipoFiltro?'selected':''}>${esc(t)}</option>`).join('');
  const currentYear = String(new Date().getFullYear());

  setC(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn-action" onclick="setView('ativ')">← Voltar</button>
    <div style="flex:1;min-width:60px"></div>
    ${S.isAdmin?`<button class="btn-action" onclick="ccOpenCategoriaModal(null,'${secId}')">+ Categoria</button>`:''}
    ${S.isAdmin?`<button class="btn-action" onclick="openSecModal('${secId}')">✏️ Editar</button>`:''}
    <button class="btn-action" onclick="ccOpenPdfOpts('${secId}')">📄 PDF</button>
  </div>
  <div style="margin-bottom:18px">
    ${sec.cover_url?`<img src="${esc(sec.cover_url)}" style="max-height:80px;max-width:260px;border-radius:10px;object-fit:contain;margin-bottom:10px;display:block;background:transparent">`:''}
    <div class="page-title">${esc(sec.name)}</div>
    <div class="page-sub">${esc(sec.observacoes||'Controle de pagamento de contas por local')}</div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <div class="stat-card"><div class="stat-val" style="color:#60a5fa">R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="stat-lbl">Total</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#10b981">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="stat-lbl">Pago</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#f87171">R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="stat-lbl">Pendente</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#f59e0b">${qtdPago}/${qtdTotal}</div><div class="stat-lbl">Pagas</div></div>
  </div>
  <div class="cc-filtros">
    <select id="cc-filtro-tipo" onchange="renderControleContas('${secId}')"><option value="">Todos os tipos</option>${tipoOptions}</select>
    <select id="cc-filtro-ano" onchange="renderControleContas('${secId}')"><option value="">Todos os anos</option>${anoOptions}</select>
    <select id="cc-filtro-pago" onchange="renderControleContas('${secId}')"><option value="">Todos</option><option value="pago" ${pagoFiltro==='pago'?'selected':''}>Pago</option><option value="pendente" ${pagoFiltro==='pendente'?'selected':''}>Pendente</option></select>
    <button class="btn-action" style="font-size:12px;padding:6px 12px" onclick="document.getElementById('cc-filtro-tipo').value='';document.getElementById('cc-filtro-ano').value='';document.getElementById('cc-filtro-pago').value='';renderControleContas('${secId}')">Limpar</button>
  </div>
  ${categoriasHtml || '<div class="empty">Nenhuma categoria/local cadastrado.</div>'}`);
};

window.ccOpenCategoriaModal = function(id, secId){
  const it = id ? S.items.find(i=>i.id===id) : null;
  openModal(id ? '✏️ Editar Categoria' : '➕ Nova Categoria', '',
    `<div class="form-grid"><div class="form-group full"><label>Nome *</label><input id="cc-cat-name" value="${esc(it?.description||'')}"></div></div>
     <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteCategoria('${id}','${secId}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveCategoria('${id||''}','${secId}')">💾 Salvar</button></div>`);
};

window.ccSaveCategoria = async function(id, secId){
  const name = document.getElementById('cc-cat-name')?.value.trim();
  if(!name){toast('Nome é obrigatório','error');return;}
  const data = {description:name, atividade_id:secId, item_icon:'📁', item_color:'#3B82F6', updated_at:serverTimestamp()};
  if(id){ await updateDoc(doc(db,'items',id),data); }
  else { data.order_num = S.items.filter(i=>i.atividade_id===secId).length; data.concluded=0; data.created_at=serverTimestamp(); await addDoc(collection(db,'items'),data); }
  await loadData(); closeModal(); toast('Salvo!'); renderControleContas(secId);
};

window.ccDeleteCategoria = async function(id, secId){
  if(!confirm('Excluir categoria e todos os locais/lançamentos?')) return;
  const locais = S.subitems.filter(s=>s.item_id===id);
  for(const l of locais){
    const lancs = S.contas.filter(c=>c.subitem_id===l.id);
    for(const c of lancs) await deleteDoc(doc(db,'contas',c.id));
    await deleteDoc(doc(db,'subitems',l.id));
  }
  await deleteDoc(doc(db,'items',id));
  await loadData(); closeModal(); toast('Excluído!'); renderControleContas(secId);
};

window.ccOpenLocalModal = function(id, itemId){
  const local = id ? S.subitems.find(s=>s.id===id) : null;
  const ef = local ? (local.extra_fields||{}) : {};
  openModal(id ? '✏️ Editar Local' : '➕ Novo Local', '',
    `<div class="form-grid">
      <div class="form-group full"><label>Nome do Local *</label><input id="cc-local-name" value="${esc(local?.description||'')}"></div>
      <div class="form-group"><label>Número do Relógio</label><input id="cc-local-relogio" value="${esc(_ccLocalExtraFields(local).numero_relogio)}" placeholder="Ex: 123456"></div>
      <div class="form-group"><label>Conta/Contrato</label><input id="cc-local-contrato" value="${esc(_ccLocalExtraFields(local).conta_contrato)}" placeholder="Ex: 987654"></div>
      <div class="form-group full"><label>Endereço</label><input id="cc-local-endereco" value="${esc(_ccLocalExtraFields(local).endereco)}" placeholder="Ex: Rua..."></div>
    </div>
    <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteLocal('${id}','${itemId}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveLocal('${id||''}','${itemId}')">💾 Salvar</button></div>`);
};

window.ccSaveLocal = async function(id, itemId){
  const name = document.getElementById('cc-local-name')?.value.trim();
  if(!name){toast('Nome é obrigatório','error');return;}
  const local = id ? S.subitems.find(s=>s.id===id) : null;
  const ef = {...((local && local.extra_fields) || {})};
  const rel = document.getElementById('cc-local-relogio')?.value.trim();
  const contr = document.getElementById('cc-local-contrato')?.value.trim();
  const end = document.getElementById('cc-local-endereco')?.value.trim();
  const setEf = (frag, defKey, val) => { const k = _ccFindKey(ef, frag) || defKey; if(val) ef[k] = val; else if(k in ef) delete ef[k]; };
  setEf('RELOGIO', 'Número do Relógio', rel);
  setEf('CONTA CONTRATO', 'Conta Contrato', contr);
  setEf('ENDERECO', 'Endereço', end);
  const data = {description:name, item_id:itemId, parent_type:'item', concluded:0, extra_fields:ef, updated_at:serverTimestamp()};
  if(id){ await updateDoc(doc(db,'subitems',id),data); }
  else { data.order_num = S.subitems.filter(s=>s.item_id===itemId).length; data.created_at=serverTimestamp(); await addDoc(collection(db,'subitems'),data); }
  await loadData(); closeModal(); toast('Salvo!'); renderControleContas(curSecId);
};

window.ccDeleteLocal = async function(id, itemId){
  if(!confirm('Excluir local e todos os lançamentos?')) return;
  const lancs = S.contas.filter(c=>c.subitem_id===id);
  for(const c of lancs) await deleteDoc(doc(db,'contas',c.id));
  await deleteDoc(doc(db,'subitems',id));
  await loadData(); closeModal(); toast('Excluído!'); renderControleContas(curSecId);
};

window.ccOpenLancamentoModal = function(id, subitemId){
  const c = id ? S.contas.find(x=>x.id===id) : null;
  const local = S.subitems.find(s=>s.id===subitemId);
  const tipoOpts = CC_TIPOS.map(t=>`<option value="${esc(t)}" ${c?.tipo===t?'selected':''}>${esc(t)}</option>`).join('');
  const today = new Date().toISOString().split('T')[0];
  openModal(id ? '✏️ Editar Lançamento' : '➕ Novo Lançamento', 'Local: '+(local?.description||''),
    `<div class="form-grid">
      <div class="form-group"><label>Mês/Ano *</label><input id="cc-lanc-mes" value="${esc(c?.mes_ano||'')}" placeholder="MM/AAAA"></div>
      <div class="form-group"><label>Tipo *</label><select id="cc-lanc-tipo">${tipoOpts}</select></div>
      <div class="form-group"><label>Leitura do Relógio</label><input id="cc-lanc-leitura" value="${esc(c?.leitura_relogio||'')}"></div>
      <div class="form-group"><label>Consumo (kWh)</label><input id="cc-lanc-consumo" value="${esc(c?.consumo_kwh||'')}"></div>
      <div class="form-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="cc-lanc-valor" value="${esc(String(c?.valor||''))}"></div>
      <div class="form-group"><label>Data Vencimento</label><input type="date" id="cc-lanc-venc" value="${esc(c?.data_vencimento||'')}"></div>
      <div class="form-group"><label>Data Pagamento</label><input type="date" id="cc-lanc-pag" value="${esc(c?.data_pagamento||'')}"></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="cc-lanc-pago" ${c?.pago?'checked':''}> Pago</label></div>
      <div class="form-group full"><label>Observação</label><textarea id="cc-lanc-obs">${esc(c?.observacao||'')}</textarea></div>
    </div>
    <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteLancamento('${id}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveLancamento('${id||''}','${subitemId}')">💾 Salvar</button></div>`);
};

window.ccSaveLancamento = async function(id, subitemId){
  const mes = document.getElementById('cc-lanc-mes')?.value.trim();
  const tipo = document.getElementById('cc-lanc-tipo')?.value;
  const valor = parseFloat(document.getElementById('cc-lanc-valor')?.value||0);
  if(!mes || !tipo){toast('Mês/Ano e Tipo são obrigatórios','error');return;}
  const local = S.subitems.find(s=>s.id===subitemId);
  const ativId = local ? local.atividade_id : curSecId;
  const data = {
    atividade_id: ativId,
    item_id: local?.item_id || null,
    subitem_id: subitemId,
    mes_ano: mes,
    tipo,
    leitura_relogio: document.getElementById('cc-lanc-leitura')?.value.trim() || '',
    consumo_kwh: document.getElementById('cc-lanc-consumo')?.value.trim() || '',
    valor,
    data_vencimento: document.getElementById('cc-lanc-venc')?.value || '',
    data_pagamento: document.getElementById('cc-lanc-pag')?.value || '',
    pago: document.getElementById('cc-lanc-pago')?.checked || false,
    observacao: document.getElementById('cc-lanc-obs')?.value.trim() || '',
    updated_at: serverTimestamp()
  };
  if(id){ await updateDoc(doc(db,'contas',id),data); }
  else { data.created_at = serverTimestamp(); await addDoc(collection(db,'contas'),data); }
  await loadData(); closeModal(); toast('Salvo!'); renderControleContas(ativId);
};

window.ccDeleteLancamento = async function(id){
  if(!confirm('Excluir lançamento?')) return;
  const c = S.contas.find(x=>x.id===id);
  await deleteDoc(doc(db,'contas',id));
  await loadData(); closeModal(); toast('Excluído!'); renderControleContas(c?.atividade_id||curSecId);
};

window.ccSalvarCampo = async function(id, campo, valor){
  const c = S.contas.find(x=>x.id===id);
  if(!c) return;
  const data = {updated_at:serverTimestamp()};
  if(campo==='valor') data[campo] = parseFloat(valor)||0;
  else if(campo==='pago') data[campo] = !!valor;
  else data[campo] = valor;
  await updateDoc(doc(db,'contas',id),data);
  await loadData();
  renderControleContas(c.atividade_id);
  toast('Atualizado','success',1200);
};

window.ccTogglePago = async function(id, checked){
  await ccSalvarCampo(id,'pago',checked);
};

window.ccOpenPdfOpts = function(secId){
  _pdfOptsSecId = secId;
  const anos = [...new Set(S.contas.filter(c=>c.atividade_id===secId && c.mes_ano).map(c=>String(c.mes_ano).split('/')[1]).filter(Boolean))].sort();
  const currentYear = String(new Date().getFullYear());
  document.getElementById('cc-pdf-ano').innerHTML = anos.map(a=>`<option value="${esc(a)}" ${a===currentYear?'selected':''}>${esc(a)}</option>`).join('');
  document.getElementById('cc-pdf-overlay').style.display = 'flex';
};

window.ccFecharPdfOpts = function(){ document.getElementById('cc-pdf-overlay').style.display='none'; };

window.ccConfirmarPdf = function(){
  const ano = document.getElementById('cc-pdf-ano')?.value;
  const todos = document.getElementById('cc-pdf-todos')?.checked;
  const apenasPagas = document.getElementById('cc-pdf-pagas')?.checked;
  ccFecharPdfOpts();
  ccGerarPdf(_pdfOptsSecId, {ano: todos ? null : ano, apenasPagas});
};

window.ccGerarPdf = async function(secId, opts){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error');return;}
  toast('Gerando PDF...','info',8000);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, mx=14, cw=W-mx*2;
  const sf=(sz,bold,clr)=>{doc.setFontSize(sz||9);doc.setFont('helvetica',bold?'bold':'normal');const c=clr||[26,32,44];doc.setTextColor(c[0],c[1],c[2]);};
  const now = new Date().toLocaleDateString('pt-BR');
  let y = 22;
  doc.setFillColor(13,34,64); doc.rect(mx,12,cw,0.7,'F');
  sf(15,true,[13,34,64]); doc.text(sec.name||'CONTROLE DE CONTAS', mx, y);
  y+=8;
  sf(9,false,[100,116,139]); doc.text('Prefeitura de Sertânia - PE • Controle PMS • '+now, mx, y);
  y+=12;
  if(sec.observacoes){ sf(8,false,[60,60,60]); const obs = doc.splitTextToSize(sec.observacoes, cw-10); doc.text(obs, mx, y); y += obs.length*4 + 4; }

  let totalGeral=0, totalPago=0, totalPendente=0, qtdPago=0, qtdTotal=0;
  const rows = [];
  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  items.forEach(item=>{
    const locais = [...S.subitems.filter(s=>s.item_id===item.id && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    locais.forEach(local=>{
      let lancs = S.contas.filter(c=>c.subitem_id===local.id).sort((a,b)=>{const da=(a.mes_ano||'').split('/').reverse().join('-');const db=(b.mes_ano||'').split('/').reverse().join('-');return da.localeCompare(db);});
      if(opts.ano) lancs = lancs.filter(c=>String(c.mes_ano||'').includes('/'+opts.ano));
      if(opts.apenasPagas) lancs = lancs.filter(c=>c.pago);
      lancs.forEach(c=>{
        totalGeral += parseFloat(c.valor)||0;
        qtdTotal++;
        if(c.pago){ totalPago += parseFloat(c.valor)||0; qtdPago++; }
        rows.push([
          item.description||'—',
          local.description||'—',
          c.mes_ano||'—',
          c.tipo||'—',
          c.leitura_relogio||'—',
          c.consumo_kwh||'—',
          'R$ '+((parseFloat(c.valor)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})),
          c.pago?'SIM':'NÃO',
          fmtD(c.data_vencimento),
          fmtD(c.data_pagamento),
          c.observacao||'—'
        ]);
      });
    });
  });
  totalPendente = totalGeral - totalPago;

  if(rows.length){
    doc.autoTable({
      startY:y,
      margin:{left:mx,right:mx},
      head:[['Categoria','Local','Mês/Ano','Tipo','Leitura','Consumo','Valor','Pago','Vencimento','Pagamento','Obs.']],
      body:rows,
      theme:'grid',
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:8},
      bodyStyles:{fontSize:8,textColor:[40,40,40]},
      alternateRowStyles:{fillColor:[245,250,245]},
      styles:{cellPadding:2,overflow:'linebreak',font:'helvetica'},
      columnStyles:{6:{halign:'right'},7:{halign:'center'}},
      didParseCell:(data)=>{ if(data.row.raw[7]==='SIM') data.cell.styles.textColor=[16,185,129]; }
    });
  } else {
    sf(10,false,[120,120,120]); doc.text('Nenhum lançamento encontrado para os filtros selecionados.', mx, y+10);
  }

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y+30;
  doc.setFillColor(235,255,235); doc.roundedRect(mx, finalY, cw, 24, 3, 3, 'F');
  sf(10,true,[20,82,20]); doc.text('Resumo', mx+6, finalY+8);
  sf(9,false,[40,60,40]); doc.text(`Total: R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}   |   Pago: R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}   |   Pendente: R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}   |   ${qtdPago}/${qtdTotal} pagas`, mx+6, finalY+18);

  doc.save((sec.name||'controle-contas').replace(/[^a-zA-Z0-9\u00C0-\u00FA ]/g,'_').trim()+'_relatorio_'+now.replace(/\//g,'-')+'.pdf');
  toast('PDF gerado!','success');
};
