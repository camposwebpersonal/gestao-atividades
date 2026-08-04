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

function _ccLocalMatchesBusca(item, local, buscaTokens){
  if(!buscaTokens || !buscaTokens.length) return true;
  const efLocal = (local && local.extra_fields) || {};
  const obsTodas = S.contas.filter(c=>c.subitem_id===local.id).map(c=>c.observacao||'');
  const partesBusca = [item?.description, local?.description, ...Object.values(efLocal), ...obsTodas];
  const searchable = _ccNorm(partesBusca.filter(Boolean).join(' '));
  return buscaTokens.every(tok => searchable.includes(tok));
}
function _ccTokenHit(text, tokens){
  if(!tokens || !tokens.length) return false;
  const norm = _ccNorm(text);
  return tokens.some(tok => norm.includes(tok));
}
function _ccHighlight(text, tokens){
  const raw = String(text==null?'':text);
  if(!tokens || !tokens.length) return esc(raw);
  // mapeia cada caractere original para sua versao normalizada (sem acento, maiuscula)
  let norm = '', idxMap = [];
  for(let i=0;i<raw.length;i++){
    const ch = raw[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    for(let k=0;k<ch.length;k++){ norm += ch[k]; idxMap.push(i); }
  }
  const ranges = [];
  tokens.forEach(tok=>{
    if(!tok) return;
    let from = 0;
    while(true){
      const pos = norm.indexOf(tok, from);
      if(pos === -1) break;
      ranges.push([idxMap[pos], idxMap[pos+tok.length-1]+1]);
      from = pos + 1;
    }
  });
  if(!ranges.length) return esc(raw);
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged = [];
  ranges.forEach(r=>{
    if(merged.length && r[0] <= merged[merged.length-1][1]) merged[merged.length-1][1] = Math.max(merged[merged.length-1][1], r[1]);
    else merged.push([...r]);
  });
  let out = '', last = 0;
  merged.forEach(([s,e])=>{ out += raw.slice(last,s) + '\u0001' + raw.slice(s,e) + '\u0002'; last = e; });
  out += raw.slice(last);
  return esc(out).replace(/\u0001/g,'<mark class="cc-hl">').replace(/\u0002/g,'</mark>');
}

let _ccBuscaTimer = null;
window.ccBuscaInput = function(secId){
  clearTimeout(_ccBuscaTimer);
  const inp = document.getElementById('cc-busca');
  const pos = inp ? inp.selectionStart : null;
  _ccBuscaTimer = setTimeout(()=>{
    renderControleContas(secId);
    const novo = document.getElementById('cc-busca');
    if(novo){ novo.focus(); if(pos!=null){ try{ novo.setSelectionRange(pos,pos); }catch(e){} } }
  }, 220);
};

window.renderControleContas = function(secId){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  curSecId = secId;
  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const tipoFiltro = document.getElementById('cc-filtro-tipo')?.value || '';
  const anoFiltro = document.getElementById('cc-filtro-ano')?.value || '';
  const pagoFiltro = document.getElementById('cc-filtro-pago')?.value || '';
  const buscaFiltro = document.getElementById('cc-busca')?.value || '';
  const buscaTokens = _ccNorm(buscaFiltro).split(/\s+/).filter(Boolean);

  let totalGeral = 0, totalPago = 0, totalPendente = 0;
  let qtdPago = 0, qtdPendente = 0, qtdTotal = 0;
  const globalMax = Math.max(...S.contas.filter(c=>c.atividade_id===secId && c.valor).map(c=>parseFloat(c.valor)||0), 1);
  const colsOff = new Set(sec.cc_cols_ocultas || []);
  const resumoCats = [];
  const tipoMap = {};
  const locaisResumo = [];

  const categoriasHtml = items.map((item, idx)=>{
    const locais = [...S.subitems.filter(s=>s.item_id===item.id && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    let locaisHtml = '';
    let catTotal = 0, catPago = 0, catPendente = 0, catQtd = 0, catQPago = 0, catQPendente = 0;
    locais.forEach((local, li)=>{
      // Busca em TUDO: categoria, local, todos os campos extras do local
      // (ex: Distrito/Povoado/Sitio/Vila, Conta Contrato, Endereço, etc.)
      // e a observação de cada lançamento. Se bater em qualquer lugar,
      // o local inteiro aparece com todos os seus lançamentos.
      if(!_ccLocalMatchesBusca(item, local, buscaTokens)) return;
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
      if(locRows.length) locaisResumo.push({categoria:item.description||'Categoria', local:local.description||'Local', qtd:locRows.length, qPago:locRows.filter(c=>c.pago).length, total:locTotal, pago:locPago, pendente:locPendente});
      for(const c of locRows){
        const tipo = c.tipo || 'N/A';
        const v = parseFloat(c.valor) || 0;
        if(!tipoMap[tipo]) tipoMap[tipo] = {qtd:0, qPago:0, total:0, pago:0};
        tipoMap[tipo].qtd++; tipoMap[tipo].total += v;
        if(c.pago){ tipoMap[tipo].qPago++; tipoMap[tipo].pago += v; }
      }
      totalGeral += locTotal; totalPago += locPago; totalPendente += locPendente;
      qtdTotal += locRows.length; qtdPago += locRows.filter(c=>c.pago).length; qtdPendente += locRows.filter(c=>!c.pago).length;
      catTotal += locTotal; catPago += locPago; catPendente += locPendente; catQtd += locRows.length;
      catQPago += locRows.filter(c=>c.pago).length; catQPendente += locRows.filter(c=>!c.pago).length;
      const efAll = (local && local.extra_fields) || {};
      const headMeta = Object.entries(efAll).filter(([k,v])=>String(v||'').trim()).map(([k,v])=>k+': '+v);
      const headMetaStr = headMeta.join(' • ') || 'Clique em editar para preencher dados do local';
      const contaContrato = _ccLocalExtraFields(local).conta_contrato;
      const tableRows = locRows.map((c,ri)=>{
        const pagoCls = c.pago ? 'cc-pago-row' : '';
        const vLanc = parseFloat(c.valor)||0;
        const pctLanc = globalMax ? Math.round(vLanc/globalMax*100) : 0;
        const corLanc = c.pago ? '#10b981' : '#f87171';
        const situacaoSvg = `<svg width="46" height="12" style="vertical-align:middle"><rect x="0" y="0" width="46" height="12" fill="#1e293b" rx="2"/><rect x="0" y="0" width="${Math.max(0,pctLanc/100*46)}" height="12" fill="${corLanc}" rx="2"/></svg> <span style="font-size:10px;color:${corLanc};font-weight:700">${pctLanc}%</span>`;
        return `<tr class="${pagoCls}">
          ${colsOff.has('mes')?'':`<td>${esc(c.mes_ano||'—')}</td>`}
          ${colsOff.has('tipo')?'':`<td>${esc(c.tipo||'—')}</td>`}
          ${colsOff.has('contrato')?'':`<td><input type="text" class="${_ccTokenHit(contaContrato,buscaTokens)?'cc-obs-match':''}" value="${esc(contaContrato||'')}" onchange="ccSalvarContaContratoLocal('${local.id}',this.value)" placeholder="Conta Contrato"></td>`}
          ${colsOff.has('leitura')?'':`<td><input type="text" value="${esc(c.leitura_relogio||'')}" onchange="ccSalvarCampo('${c.id}','leitura_relogio',this.value)" placeholder="Leitura"></td>`}
          ${colsOff.has('consumo')?'':`<td><input type="text" value="${esc(c.consumo_kwh||'')}" onchange="ccSalvarCampo('${c.id}','consumo_kwh',this.value)" placeholder="kWh"></td>`}
          <td><input type="number" step="0.01" value="${esc(String(c.valor||''))}" onchange="ccSalvarCampo('${c.id}','valor',this.value)" placeholder="R$"></td>
          <td><input type="date" value="${esc(c.data_vencimento||'')}" onchange="ccSalvarCampo('${c.id}','data_vencimento',this.value)"></td>
          <td><input type="date" value="${esc(c.data_pagamento||'')}" onchange="ccSalvarCampo('${c.id}','data_pagamento',this.value)"></td>
          <td class="cc-col-pago"><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></td>
          <td><input type="text" class="${_ccTokenHit(c.observacao,buscaTokens)?'cc-obs-match':''}" value="${esc(c.observacao||'')}" onchange="ccSalvarCampo('${c.id}','observacao',this.value)" placeholder="Obs."></td>
          <td style="text-align:center">${situacaoSvg}</td>
          <td style="white-space:nowrap"><button class="card-btn" onclick="ccOpenLancamentoModal('${c.id}','${local.id}')" title="Editar lançamento completo">✏️</button>${S.isAdmin?`<button class="card-btn" onclick="ccDeleteLancamento('${c.id}')">🗑️</button>`:''}</td>
        </tr>`;
      }).join('');

      const mobileRows = locRows.map(c=>{
        const vLanc = parseFloat(c.valor)||0;
        const pctLanc = globalMax ? Math.round(vLanc/globalMax*100) : 0;
        const corLanc = c.pago ? '#10b981' : '#f87171';
        const situacaoSvg = `<svg width="46" height="12" style="vertical-align:middle"><rect x="0" y="0" width="46" height="12" fill="#1e293b" rx="2"/><rect x="0" y="0" width="${Math.max(0,pctLanc/100*46)}" height="12" fill="${corLanc}" rx="2"/></svg> <span style="font-size:10px;color:${corLanc};font-weight:700">${pctLanc}%</span>`;
        return `<div class="cc-mobile-card">
          <div class="cc-mobile-title">${esc(c.mes_ano||'—')} — ${esc(c.tipo||'—')}</div>
          ${colsOff.has('contrato')?'':`<div class="cc-mobile-row"><span>Conta Contrato</span><span>${_ccHighlight(contaContrato||'—', buscaTokens)}</span></div>`}
          ${colsOff.has('leitura')?'':`<div class="cc-mobile-row"><span>Leitura</span><span>${esc(c.leitura_relogio||'—')}</span></div>`}
          ${colsOff.has('consumo')?'':`<div class="cc-mobile-row"><span>Consumo</span><span>${esc(c.consumo_kwh||'—')}</span></div>`}
          <div class="cc-mobile-row"><span>Valor</span><span>R$ ${esc(String((parseFloat(c.valor)||0).toFixed(2)))}</span></div>
          <div class="cc-mobile-row"><span>Vencimento</span><span>${fmtD(c.data_vencimento)}</span></div>
          <div class="cc-mobile-row"><span>Pagamento</span><span>${fmtD(c.data_pagamento)}</span></div>
          <div class="cc-mobile-row"><span>Pago</span><span><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></span></div>
          <div class="cc-mobile-row"><span>Situação</span><span>${situacaoSvg}</span></div>
          <div class="cc-mobile-row"><span>Obs.</span><span>${_ccHighlight(c.observacao||'—', buscaTokens)}</span></div>
          <div class="cc-mobile-row" style="justify-content:flex-end;gap:8px;margin-top:4px">
            <button class="card-btn" onclick="ccOpenLancamentoModal('${c.id}','${local.id}')" title="Editar lançamento completo">✏️ Editar</button>
            ${S.isAdmin?`<button class="card-btn" onclick="ccDeleteLancamento('${c.id}')">🗑️</button>`:''}
          </div>
        </div>`;
      }).join('');

      locaisHtml += `<div class="cc-local-card">
        <div class="cc-local-head">
          <div class="cc-local-title">
            <div class="cc-local-name">${_ccHighlight(local.description||'Local', buscaTokens)}</div>
            <div class="cc-local-meta">${_ccHighlight(headMetaStr, buscaTokens)}</div>
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
                ${colsOff.has('mes')?'':'<th>Mês/Ano</th>'}${colsOff.has('tipo')?'':'<th>Tipo</th>'}${colsOff.has('contrato')?'':'<th>Conta Contrato</th>'}${colsOff.has('leitura')?'':'<th>Leitura</th>'}${colsOff.has('consumo')?'':'<th>Consumo</th>'}<th>Valor</th><th>Vencimento</th><th>Pagamento</th><th class="cc-col-pago">Pago</th><th>Obs.</th><th>Situação</th><th></th>
              </tr></thead>
              <tbody>${tableRows || `<tr><td colspan="${12-colsOff.size}" style="text-align:center;color:var(--muted)">Nenhum lançamento</td></tr>`}</tbody>
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
    if(!locaisHtml && (tipoFiltro || anoFiltro || pagoFiltro)) return '';
    const catEf = (item.extra_fields)||{};
    const catMeta = Object.entries(catEf).filter(([k,v])=>String(v==null?'':v).trim()).map(([k,v])=>`<span class="cc-badge" style="font-size:11px">${esc(k)}: ${esc(v)}</span>`).join(' ');
    const catPend = catTotal - catPago;
    if(catQtd > 0) resumoCats.push({ nome: item.description || 'Categoria', qtd: catQtd, qPago: catQPago, qPendente: catQPendente, total: catTotal, pago: catPago, pendente: catPend });
    return `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        <div style="font-size:15px;font-weight:800;color:#60a5fa">${_ccHighlight(item.description||'Categoria', buscaTokens)}</div>
        ${S.isAdmin?`<button class="card-btn" onclick="ccOpenCategoriaModal('${item.id}','${secId}')">✏️</button>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto">
          <span class="cc-badge" style="font-weight:700">Total: R$ ${catTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span class="cc-badge" style="background:rgba(16,185,129,.15);color:#10b981">Pago: R$ ${catPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span class="cc-badge" style="background:rgba(248,113,113,.15);color:#f87171">Pendente: R$ ${catPend.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span class="cc-badge" style="color:var(--muted)">${catQtd} lanç.</span>
        </div>
      </div>
      ${catMeta?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${catMeta}</div>`:''}
      ${locaisHtml}
      ${S.isAdmin?`<button class="btn-action" style="font-size:12px;padding:5px 12px" onclick="ccOpenLocalModal(null,'${item.id}')">+ Local</button>`:''}
    </div>`;
  }).join('');

  const tipoResumoHtml = (()=>{
    const tipos = Object.entries(tipoMap).sort((a,b)=>b[1].total-a[1].total);
    if(!tipos.length) return '';
    const max = Math.max(...tipos.map(x=>x[1].total));
    return `<div style='margin-bottom:16px;background:#0a1222;border:1px solid #1e3a5f;border-radius:12px;padding:14px'>
  <div style='display:flex;align-items:center;gap:10px;margin-bottom:12px'><div style='font-size:18px'>📑</div><div style='font-size:14px;font-weight:700;color:#60a5fa'>Relatorio por Tipo de Conta</div></div>
  <div style='display:grid;gap:10px'>
    ${tipos.map(([t,v])=>{
      const pct = max ? (v.total/max*100) : 0;
      return `<div style='background:#0e1729;border:1px solid #1e3a5f;border-radius:10px;padding:10px'>
        <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px'>
          <span style='font-size:13px;font-weight:700;color:#e2e8f0'>${esc(t)}</span>
          <span style='font-size:12px;color:#94a3b8'>${v.qtd} lanc. · R$ ${v.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
        <div style='display:flex;align-items:center;gap:10px'>
          <div style='flex:1;background:#1e293b;border-radius:999px;height:12px;overflow:hidden'><div style='width:${Math.min(100,Math.round(pct))}%;height:100%;background:linear-gradient(90deg,#60a5fa,#34d399);border-radius:999px'></div></div>
          <span style='font-size:12px;font-weight:700;color:#60a5fa;min-width:60px;text-align:right'>${Math.round(pct)}% do total</span>
        </div>
        <div style='display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:6px'>
          <span>${v.qPago} pagos · R$ ${v.pago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span style='color:#f87171'>${v.qtd-v.qPago} pendentes · R$ ${(v.total-v.pago).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
      </div>`;
    }).join('')}
  </div>
</div>`;
  })();
  const locaisResumoHtml = (()=>{
    if(!locaisResumo.length) return '';
    return `<div class='cc-table-wrap' style='margin-bottom:14px'>
    <table class='cc-table'>
      <thead><tr>
        <th>Categoria</th><th>Local</th><th style='text-align:center'>Lanc.</th>
        <th style='text-align:center'>Pagos</th><th style='text-align:center'>Pendentes</th>
        <th style='text-align:right'>Valor Total</th><th style='text-align:right'>Valor Pago</th><th style='text-align:right'>Valor Pendente</th>
      </tr></thead>
      <tbody>${locaisResumo.map(l=>`<tr>
        <td>${esc(l.categoria)}</td><td>${esc(l.local)}</td>
        <td style='text-align:center'>${l.qtd}</td>
        <td style='text-align:center;color:#10b981'>${l.qPago}</td>
        <td style='text-align:center;color:#f87171'>${l.qtd-l.qPago}</td>
        <td style='text-align:right;font-weight:700'>R$ ${l.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style='text-align:right;color:#10b981'>R$ ${l.pago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style='text-align:right;color:#f87171'>R$ ${l.pendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style='background:rgba(13,34,64,.35);font-weight:700'>
        <td colspan='2'>TOTAL GERAL</td>
        <td style='text-align:center'>${qtdTotal}</td>
        <td style='text-align:center;color:#10b981'>${qtdPago}</td>
        <td style='text-align:center;color:#f87171'>${qtdPendente}</td>
        <td style='text-align:right'>R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style='text-align:right;color:#10b981'>R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style='text-align:right;color:#f87171'>R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr></tfoot>
    </table>
  </div>`;
  })();

  const anos = [...new Set(S.contas.filter(c=>c.atividade_id===secId && c.mes_ano).map(c=>String(c.mes_ano).split('/')[1]).filter(Boolean))].sort();
  const anoOptions = anos.map(a=>`<option value="${esc(a)}" ${a===anoFiltro?'selected':''}>${esc(a)}</option>`).join('');
  const tipoOptions = CC_TIPOS.map(t=>`<option value="${esc(t)}" ${t===tipoFiltro?'selected':''}>${esc(t)}</option>`).join('');
  const currentYear = String(new Date().getFullYear());

  // ── PAINEL DE VENCIMENTOS (vencidas + próximas a vencer) ──
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmtBR = d => { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const pendComData = S.contas
    .filter(c => c.atividade_id===secId && !c.pago && c.data_vencimento)
    .map(c => {
      const dt = new Date(c.data_vencimento+'T00:00:00');
      const dias = Math.round((dt-hoje)/86400000);
      const local = S.subitems.find(s=>s.id===c.subitem_id);
      const cat = S.items.find(i=>i.id===c.item_id);
      return { c, dias, localNome: local?.description||'—', catNome: cat?.description||'' };
    })
    .sort((a,b)=>a.dias-b.dias);
  const vencidas = pendComData.filter(x=>x.dias<0);
  const proximas = pendComData.filter(x=>x.dias>=0 && x.dias<=30);
  const totVencido = vencidas.reduce((a,x)=>a+(parseFloat(x.c.valor)||0),0);
  const totProximo = proximas.reduce((a,x)=>a+(parseFloat(x.c.valor)||0),0);
  const vencOrdem = document.getElementById('cc-venc-ordem')?.value || 'asc';
  let linhas = [...vencidas, ...proximas];
  if(vencOrdem === 'desc') linhas = [...linhas].reverse();
  // resumo quantitativo por categoria (item)
  const porCat = {};
  linhas.forEach(x=>{
    const k = x.catNome || 'Sem categoria';
    if(!porCat[k]) porCat[k] = { qtd: 0, valor: 0 };
    porCat[k].qtd++; porCat[k].valor += (parseFloat(x.c.valor)||0);
  });
  const resumoCatHtml = Object.entries(porCat).sort((a,b)=>b[1].valor-a[1].valor).map(([k,v])=>
    `<span class="cc-badge" style="font-size:11px"><b>${esc(k)}</b>: ${v.qtd} lanç. — R$ ${v.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
  ).join(' ');
  const linhasHtml = linhas.map(x=>{
    const venc = x.dias<0;
    const cor = venc ? '#f87171' : (x.dias<=7 ? '#f59e0b' : '#fbbf24');
    const status = venc ? `VENCIDA há ${-x.dias} dia(s)` : (x.dias===0 ? 'VENCE HOJE' : `vence em ${x.dias} dia(s)`);
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap">
      <span style="font-weight:800;color:${cor};min-width:86px">${fmtBR(x.c.data_vencimento)}</span>
      <span style="font-size:11px;font-weight:700;color:${cor};min-width:130px">${venc?'🔴':(x.dias<=7?'🟠':'🟡')} ${status}</span>
      <span style="flex:1;min-width:160px;font-size:12px">${esc(x.localNome)}${x.catNome?` <span style="color:var(--muted);font-size:11px">(${esc(x.catNome)})</span>`:''}</span>
      <span style="font-size:12px;color:var(--muted)">${esc(x.c.tipo||'')}</span>
      <span style="font-weight:800;min-width:100px;text-align:right">R$ ${(parseFloat(x.c.valor)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
    </div>`;
  }).join('');
  // ── PAINEL DE VIGÊNCIA DAS APÓLICES (por local/veículo) ──
  const _efGet = (ef, frag) => {
    for(const [k,v] of Object.entries(ef||{})){
      if(_ccNorm(k).includes(_ccNorm(frag))) return String(v||'').trim();
    }
    return '';
  };
  const vigItens = [];
  S.subitems.filter(s=>s.parent_type!=='subitem' && (s.atividade_id===secId || items.some(i=>i.id===s.item_id))).forEach(loc=>{
    const vig = _efGet(loc.extra_fields, 'VIGENCIA');
    const m = vig.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|-)\s*(\d{2}\/\d{2}\/\d{4})/i);
    if(!m) return;
    const [d2,m2,y2] = m[2].split('/');
    const fim = new Date(`${y2}-${m2}-${d2}T00:00:00`);
    const dias = Math.round((fim-hoje)/86400000);
    if(dias > 30) return; // sem alarme ainda
    const resp = _efGet(loc.extra_fields, 'RESPONSAVEL');
    const zap = _efGet(loc.extra_fields, 'WHATSAPP').replace(/\D/g,'');
    vigItens.push({ loc, vig, fimStr: m[2], dias, resp, zap });
  });
  vigItens.sort((a,b)=>a.dias-b.dias);
  const vigRows = vigItens.map(x=>{
    let cor, icone, status;
    if(x.dias < 0){ cor='#f87171'; icone='🔴'; status=`APÓLICE VENCIDA há ${-x.dias} dia(s)`; }
    else if(x.dias === 0){ cor='#f87171'; icone='🚨'; status='VENCE HOJE'; }
    else if(x.dias <= 15){ cor='#f59e0b'; icone='🟠'; status=`vence em ${x.dias} dia(s) (≤15)`; }
    else { cor='#fbbf24'; icone='🟡'; status=`vence em ${x.dias} dia(s) (≤30)`; }
    const placa = _efGet(x.loc.extra_fields,'PLACA');
    const msg = encodeURIComponent(`⚠️ ALERTA DE SEGURO — ${x.loc.description}${placa?` (placa ${placa})`:''}: a vigência da apólice ${x.dias<0?`VENCEU há ${-x.dias} dia(s)`:x.dias===0?'VENCE HOJE':`vence em ${x.dias} dia(s)`} (${x.fimStr}). Favor providenciar a renovação.`);
    const zapBtn = x.zap ? `<a class="btn-action" style="font-size:11px;padding:4px 10px;text-decoration:none" target="_blank" href="https://wa.me/${x.zap.length<=11?'55'+x.zap:x.zap}?text=${msg}">📱 WhatsApp${x.resp?' ('+esc(x.resp.split(' ')[0])+')':''}</a>` : `<span style="font-size:11px;color:var(--muted)">sem WhatsApp — edite o local e preencha RESPONSÁVEL e WHATSAPP</span>`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap">
      <span style="font-weight:800;color:${cor};min-width:86px">${esc(x.fimStr)}</span>
      <span style="font-size:11px;font-weight:700;color:${cor};min-width:170px">${icone} ${status}</span>
      <span style="flex:1;min-width:160px;font-size:12px">${esc(x.loc.description)}${x.resp?` <span style="color:var(--muted);font-size:11px">— Resp.: ${esc(x.resp)}</span>`:''}</span>
      ${zapBtn}
      ${S.isAdmin?`<button class="btn-action" style="font-size:11px;padding:4px 10px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.4)" onclick="ccOpenRenovarModal('${x.loc.id}')">✅ Renovado</button>`:''}
    </div>`;
  }).join('');
  const nVigVencidas = vigItens.filter(x=>x.dias<0).length;
  const nVigProximas = vigItens.length - nVigVencidas;
  const vigPanel = vigItens.length ? `<div style="background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.35);border-radius:12px;padding:12px 16px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-size:14px;font-weight:800">🛡️ Vigência das Apólices</div>
      ${nVigVencidas?`<span class="cc-badge" style="background:rgba(248,113,113,.18);color:#f87171;font-weight:700">${nVigVencidas} vencida(s)</span>`:''}
      ${nVigProximas?`<span class="cc-badge" style="background:rgba(245,158,11,.15);color:#f59e0b;font-weight:700">${nVigProximas} vencendo em até 30 dias</span>`:''}
    </div>
    ${vigRows}
  </div>` : '';
  if(vigItens.length && !window.__ccVigAlarme){
    window.__ccVigAlarme = true;
    setTimeout(()=>toast(`🛡️ Atenção: ${nVigVencidas?nVigVencidas+' apólice(s) VENCIDA(S)':''}${nVigVencidas&&nVigProximas?' e ':''}${nVigProximas?nVigProximas+' apólice(s) vencendo em até 30 dias':''}!`,'error',7000),400);
  }

  const alertPanel = linhas.length ? `<div style="background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.25);border-radius:12px;padding:12px 16px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-size:14px;font-weight:800">⏰ Vencimentos</div>
      ${vencidas.length?`<span class="cc-badge" style="background:rgba(248,113,113,.18);color:#f87171;font-weight:700">${vencidas.length} vencida(s): R$ ${totVencido.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`:''}
      ${proximas.length?`<span class="cc-badge" style="background:rgba(245,158,11,.15);color:#f59e0b;font-weight:700">${proximas.length} nos próximos 30 dias: R$ ${totProximo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`:''}
      <div style="flex:1"></div>
      <select id="cc-venc-ordem" onchange="renderControleContas('${secId}')" style="font-size:12px;padding:4px 8px;border-radius:8px;background:var(--card,#1e293b);color:inherit;border:1px solid rgba(255,255,255,.15)">
        <option value="asc" ${vencOrdem==='asc'?'selected':''}>Mais antiga → mais recente</option>
        <option value="desc" ${vencOrdem==='desc'?'selected':''}>Mais recente → mais antiga</option>
      </select>
    </div>
    ${resumoCatHtml?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)">${resumoCatHtml}</div>`:''}
    ${linhasHtml}
  </div>` : '';

  const pctPago = totalGeral ? (totalPago / totalGeral * 100) : 0;
  const pctPend = totalGeral ? (totalPendente / totalGeral * 100) : 0;
  const dashHtml = `<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px'>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px'><div style='font-size:32px;filter:grayscale(0.2)'>💰</div><div><div class='stat-val' style='color:#60a5fa'>R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class='stat-lbl'>Total em Contas</div></div></div>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px'><div style='font-size:32px;filter:grayscale(0.2)'>✅</div><div><div class='stat-val' style='color:#10b981'>R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class='stat-lbl'>Pago</div></div></div>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px'><div style='font-size:32px;filter:grayscale(0.2)'>⏳</div><div><div class='stat-val' style='color:#f87171'>R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class='stat-lbl'>Pendente</div></div></div>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px'><div style='font-size:32px;filter:grayscale(0.2)'>📊</div><div><div class='stat-val' style='color:#f59e0b'>${qtdPago} / ${qtdTotal}</div><div class='stat-lbl'>Contas Pagas</div></div></div>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px;position:relative;overflow:hidden'>
    <div style='position:relative;width:64px;height:64px'>
      <svg width='64' height='64' viewBox='0 0 100 100' style='transform:rotate(-90deg)'><circle cx='50' cy='50' r='42' fill='none' stroke='#1e3a5f' stroke-width='12'/><circle cx='50' cy='50' r='42' fill='none' stroke='#10b981' stroke-width='12' stroke-dasharray='${Math.min(264, Math.round(pctPago*2.64))} 264' stroke-linecap='round'/></svg>
      <div style='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#10b981'>${Math.round(pctPago)}%</div>
    </div>
    <div><div class='stat-val' style='color:#10b981'>${Math.round(pctPago)}%</div><div class='stat-lbl'>Percentual Pago</div></div>
  </div>
  <div class='stat-card' style='display:flex;align-items:center;gap:12px;position:relative;overflow:hidden'>
    <div style='position:relative;width:64px;height:64px'>
      <svg width='64' height='64' viewBox='0 0 100 100' style='transform:rotate(-90deg)'><circle cx='50' cy='50' r='42' fill='none' stroke='#1e3a5f' stroke-width='12'/><circle cx='50' cy='50' r='42' fill='none' stroke='#f87171' stroke-width='12' stroke-dasharray='${Math.min(264, Math.round(pctPend*2.64))} 264' stroke-linecap='round'/></svg>
      <div style='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#f87171'>${Math.round(pctPend)}%</div>
    </div>
    <div><div class='stat-val' style='color:#f87171'>${Math.round(pctPend)}%</div><div class='stat-lbl'>Percentual Pendente</div></div>
  </div>
</div>`;
  const catsProgressHtml = resumoCats.length?`<div style='margin-bottom:16px;background:#0a1222;border:1px solid #1e3a5f;border-radius:12px;padding:14px'>
  <div style='display:flex;align-items:center;gap:10px;margin-bottom:12px'><div style='font-size:18px'>📊</div><div style='font-size:14px;font-weight:700;color:#60a5fa'>Progresso por Categoria</div></div>
  <div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px'>
    ${resumoCats.map(c=>{
      const pct = c.total ? (c.pago/c.total*100) : 0;
      return `<div style='background:#0e1729;border:1px solid #1e3a5f;border-radius:10px;padding:10px'>
        <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'><span style='font-size:13px;font-weight:700;color:#e2e8f0'>${esc(c.nome)}</span><span style='font-size:12px;color:#10b981;font-weight:700'>${Math.round(pct)}% pago</span></div>
        <div style='background:#1e293b;border-radius:999px;height:10px;overflow:hidden;margin-bottom:6px'><div style='width:${Math.min(100,Math.round(pct))}%;height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:999px;transition:width .5s ease'></div></div>
        <div style='display:flex;justify-content:space-between;font-size:11px;color:#94a3b8'><span>${c.qPago} de ${c.qtd} pagos</span><span>R$ ${c.pago.toLocaleString('pt-BR',{minimumFractionDigits:2})} / R$ ${c.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
      </div>`;
    }).join('')}
  </div>
</div>`:'';

  setC(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn-action" onclick="window.renderModulo(window.modForSec(S.secs.find(s=>s.id==='${secId}')))">← Voltar</button>
    <div style="flex:1;min-width:60px"></div>
    ${S.isAdmin?`<button class="btn-action" onclick="ccOpenCategoriaModal(null,'${secId}')">+ Categoria</button>`:''}
    ${S.isAdmin?`<button class="btn-action" onclick="openSecModal('${secId}')">✏️ Editar</button>`:''}
    ${S.isAdmin?`<button class="btn-action" onclick="ccOpenColunasModal('${secId}')">⚙️ Colunas</button>`:''}
  </div>
  <div style="margin-bottom:18px">
    ${sec.cover_url?`<img src="${esc(sec.cover_url)}" style="max-height:80px;max-width:260px;border-radius:10px;object-fit:contain;margin-bottom:10px;display:block;background:transparent">`:''}
    <div class="page-title">${esc(sec.name)}</div>
    <div class="page-sub">${esc(sec.observacoes||'Controle de pagamento de contas por local')}</div>
  </div>
  <div class="cc-filtros-fixas">
    <input id="cc-busca" type="text" value="${esc(buscaFiltro)}" placeholder="🔍 Buscar por local, endereço, conta contrato, categoria... (combine vários termos)" oninput="ccBuscaInput('${secId}')" class="cc-busca-input">
    <div class="cc-filtros">
      <select id="cc-filtro-tipo" onchange="renderControleContas('${secId}')"><option value="">Todos os tipos</option>${tipoOptions}</select>
      <select id="cc-filtro-ano" onchange="renderControleContas('${secId}')"><option value="">Todos os anos</option>${anoOptions}</select>
      <select id="cc-filtro-pago" onchange="renderControleContas('${secId}')"><option value="">Todos</option><option value="pago" ${pagoFiltro==='pago'?'selected':''}>Pago</option><option value="pendente" ${pagoFiltro==='pendente'?'selected':''}>Pendente</option></select>
      <button class="btn-action" style="font-size:12px;padding:6px 12px" onclick="document.getElementById('cc-busca').value='';document.getElementById('cc-filtro-tipo').value='';document.getElementById('cc-filtro-ano').value='';document.getElementById('cc-filtro-pago').value='';renderControleContas('${secId}')">Limpar</button>
      <div style="flex:1;min-width:8px"></div>
      <button class="btn-action" onclick="ccOpenPdfOpts('${secId}')">📄 PDF${(tipoFiltro||anoFiltro||pagoFiltro||buscaFiltro.trim())?' (filtrado)':''}</button>
    </div>
  </div>
  ${dashHtml}
  ${catsProgressHtml}
  ${tipoResumoHtml}
  ${locaisResumoHtml}
  ${resumoCats.length?`<div class="cc-table-wrap" style="margin-bottom:14px">
    <table class="cc-table">
      <thead><tr>
        <th>Categoria</th>
        <th style="text-align:center">Lançamentos</th>
        <th style="text-align:center">Pagos</th>
        <th style="text-align:center">Pendentes</th>
        <th style="text-align:right">Valor Total</th>
        <th style="text-align:right">Valor Pago</th>
        <th style="text-align:right">Valor Pendente</th>
      </tr></thead>
      <tbody>${resumoCats.map(c=>`<tr>
        <td>${esc(c.nome)}</td>
        <td style="text-align:center">${c.qtd}</td>
        <td style="text-align:center;color:#10b981">${c.qPago}</td>
        <td style="text-align:center;color:#f87171">${c.qPendente}</td>
        <td style="text-align:right;font-weight:700">R$ ${c.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#10b981">R$ ${c.pago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#f87171">R$ ${c.pendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="background:rgba(13,34,64,.35);font-weight:700">
        <td>TOTAL GERAL</td>
        <td style="text-align:center">${qtdTotal}</td>
        <td style="text-align:center;color:#10b981">${qtdPago}</td>
        <td style="text-align:center;color:#f87171">${qtdPendente}</td>
        <td style="text-align:right">R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#10b981">R$ ${totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#f87171">R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr></tfoot>
    </table>
  </div>`:''}
  ${vigPanel}
  ${alertPanel}
  ${categoriasHtml || '<div class="empty">Nenhuma categoria/local cadastrado.</div>'}`);
};

window.ccOpenCategoriaModal = function(id, secId){
  const it = id ? S.items.find(i=>i.id===id) : null;
  const ef = it ? (it.extra_fields||{}) : {};
  const fieldsHtml = Object.entries(ef).map(([k,v])=>`
    <div class="form-group cc-dynamic-field">
      <div style="display:flex;gap:8px;align-items:center;width:100%">
        <input class="cc-field-key" value="${esc(k)}" placeholder="Nome do campo" style="flex:1;min-width:120px">
        <input class="cc-field-val" value="${esc(v)}" placeholder="Valor" style="flex:2;min-width:180px">
        <button class="card-btn" type="button" onclick="this.closest('.cc-dynamic-field').remove()">🗑️</button>
      </div>
    </div>`).join('');
  openModal(id ? '✏️ Editar Categoria' : '➕ Nova Categoria', '',
    `<div class="form-grid">
      <div class="form-group full"><label>Nome *</label><input id="cc-cat-name" value="${esc(it?.description||'')}"></div>
      <div class="form-group full" style="display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:4px">
        <label>Campos da categoria</label>
        <button class="btn-action" style="font-size:12px;padding:5px 10px" type="button" onclick="ccAddLocalField()">+ Adicionar campo</button>
      </div>
      <div class="cc-fields-container" style="display:contents">${fieldsHtml}</div>
    </div>
     <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteCategoria('${id}','${secId}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveCategoria('${id||''}','${secId}')">💾 Salvar</button></div>`);
};

window.ccSaveCategoria = async function(id, secId){
  const name = document.getElementById('cc-cat-name')?.value.trim();
  if(!name){toast('Nome é obrigatório','error');return;}
  const efNew = {};
  document.querySelectorAll('.cc-dynamic-field').forEach(el => {
    const k = el.querySelector('.cc-field-key')?.value.trim();
    const v = el.querySelector('.cc-field-val')?.value.trim();
    if(k) efNew[k] = v;
  });
  const data = {description:name, atividade_id:secId, item_icon:'📁', item_color:'#3B82F6', extra_fields:efNew, updated_at:serverTimestamp()};
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
  const standardKeys = ['Número do Relógio','Conta Contrato','Endereço','Medidor','RESPONSÁVEL','WHATSAPP DO RESPONSÁVEL'];
  const existingKeysNorm = Object.keys(ef).map(k=>_ccNorm(k));
  const allFields = [];
  Object.entries(ef).forEach(([k,v])=>allFields.push({k,v}));
  standardKeys.forEach(k=>{ if(!existingKeysNorm.some(ek=>ek.includes(_ccNorm(k)))) allFields.push({k,v:''}); });
  const fieldsHtml = allFields.map(f=>`
    <div class="form-group cc-dynamic-field">
      <div style="display:flex;gap:8px;align-items:center;width:100%">
        <input class="cc-field-key" value="${esc(f.k)}" placeholder="Nome do campo" style="flex:1;min-width:120px">
        <input class="cc-field-val" value="${esc(f.v)}" placeholder="Valor" style="flex:2;min-width:180px">
        <button class="card-btn" type="button" onclick="this.closest('.cc-dynamic-field').remove()">🗑️</button>
      </div>
    </div>`).join('');
  openModal(id ? '✏️ Editar Local' : '➕ Novo Local', '',
    `<div class="form-grid">
      <div class="form-group full"><label>Nome do Local *</label><input id="cc-local-name" value="${esc(local?.description||'')}"></div>
      <div class="form-group full" style="display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:4px">
        <label>Campos do local</label>
        <button class="btn-action" style="font-size:12px;padding:5px 10px" type="button" onclick="ccAddLocalField()">+ Adicionar campo</button>
      </div>
      <div class="cc-fields-container" style="display:contents">${fieldsHtml}</div>
    </div>
    <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteLocal('${id}','${itemId}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveLocal('${id||''}','${itemId}')">💾 Salvar</button></div>`);
};

window.ccAddLocalField = function(){
  const container = document.querySelector('.cc-fields-container');
  if(!container) return;
  container.insertAdjacentHTML('beforeend', `
    <div class="form-group cc-dynamic-field">
      <div style="display:flex;gap:8px;align-items:center;width:100%">
        <input class="cc-field-key" value="" placeholder="Nome do campo" style="flex:1;min-width:120px">
        <input class="cc-field-val" value="" placeholder="Valor" style="flex:2;min-width:180px">
        <button class="card-btn" type="button" onclick="this.closest('.cc-dynamic-field').remove()">🗑️</button>
      </div>
    </div>`);
};

window.ccSaveLocal = async function(id, itemId){
  const name = document.getElementById('cc-local-name')?.value.trim();
  if(!name){toast('Nome é obrigatório','error');return;}
  const local = id ? S.subitems.find(s=>s.id===id) : null;
  const newEf = {};
  document.querySelectorAll('.cc-dynamic-field').forEach(el => {
    const k = el.querySelector('.cc-field-key')?.value.trim();
    const v = el.querySelector('.cc-field-val')?.value.trim();
    if(k) newEf[k] = v;
  });
  const data = {description:name, item_id:itemId, parent_type: local?.parent_type || 'item', concluded:0, extra_fields:newEf, updated_at:serverTimestamp()};
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

// Conta Contrato pertence ao cadastro do LOCAL (compartilhado por todos os
// lancamentos daquele local), entao a edicao inline salva no subitem.
window.ccSalvarContaContratoLocal = async function(localId, valor){
  const local = S.subitems.find(s=>s.id===localId);
  if(!local) return;
  const ef = { ...(local.extra_fields||{}) };
  const chave = _ccFindKey(ef, 'CONTA CONTRATO') || _ccFindKey(ef, 'CONTRATO') || 'Conta Contrato';
  ef[chave] = valor;
  await updateDoc(doc(db,'subitems',localId), { extra_fields: ef, updated_at: serverTimestamp() });
  await loadData();
  renderControleContas(local.atividade_id || curSecId);
  toast('Conta Contrato atualizada','success',1200);
};

// ── Configuração de colunas visíveis da tabela ──
window.ccOpenColunasModal = function(secId){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  const off = new Set(sec.cc_cols_ocultas || []);
  const opts = [['mes','Mês/Ano'],['tipo','Tipo'],['contrato','Conta Contrato'],['leitura','Leitura'],['consumo','Consumo']];
  const checks = opts.map(([k,lbl])=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0"><input type="checkbox" class="cc-col-chk" data-col="${k}" ${off.has(k)?'':'checked'}> ${lbl}</label>`).join('');
  openModal('⚙️ Colunas da Tabela', 'Desmarque as colunas que não fazem sentido para esta atividade. Valor, Vencimento, Pagamento, Pago e Obs. são fixas.',
    `<div class="form-grid"><div class="form-group full">${checks}</div></div>
     <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveColunas('${secId}')">💾 Salvar</button></div>`);
};

window.ccSaveColunas = async function(secId){
  const ocultas = [...document.querySelectorAll('.cc-col-chk')].filter(el=>!el.checked).map(el=>el.dataset.col);
  await updateDoc(doc(db,'secretariats',secId), { cc_cols_ocultas: ocultas, updated_at: serverTimestamp() });
  await loadData(); closeModal(); toast('Colunas atualizadas!'); renderControleContas(secId);
};

// ── Renovação de vigência de apólice ──
window.ccOpenRenovarModal = function(subitemId){
  const loc = S.subitems.find(s=>s.id===subitemId); if(!loc) return;
  openModal('✅ Renovar Apólice', 'Veículo: '+(loc.description||''),
    `<div class="form-grid">
      <div class="form-group"><label>Início da nova vigência *</label><input type="date" id="cc-renov-ini"></div>
      <div class="form-group"><label>Fim da nova vigência *</label><input type="date" id="cc-renov-fim"></div>
    </div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveRenovacao('${subitemId}')">💾 Confirmar Renovação</button></div>`);
};

window.ccSaveRenovacao = async function(subitemId){
  const ini = document.getElementById('cc-renov-ini')?.value;
  const fim = document.getElementById('cc-renov-fim')?.value;
  if(!ini || !fim){ toast('Informe as duas datas','error'); return; }
  if(fim <= ini){ toast('A data de fim deve ser depois do início','error'); return; }
  const loc = S.subitems.find(s=>s.id===subitemId); if(!loc) return;
  const fmt = d => { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const ef = { ...(loc.extra_fields||{}) };
  let chave = 'VIGÊNCIA';
  for(const k of Object.keys(ef)){ if(_ccNorm(k).includes(_ccNorm('VIGENCIA'))){ chave = k; break; } }
  const anterior = ef[chave] || '';
  ef[chave] = `${fmt(ini)} a ${fmt(fim)}`;
  if(anterior) ef['VIGÊNCIA ANTERIOR'] = anterior;
  await updateDoc(doc(db,'subitems',subitemId), { extra_fields: ef, updated_at: serverTimestamp() });
  await loadData(); closeModal();
  toast('Apólice renovada! Nova vigência: '+ef[chave],'success',5000);
  renderControleContas(loc.atividade_id||curSecId);
};

function _ccFiltrosTela(secId){
  const tipo = document.getElementById('cc-filtro-tipo')?.value || '';
  const ano = document.getElementById('cc-filtro-ano')?.value || '';
  const pago = document.getElementById('cc-filtro-pago')?.value || '';
  const busca = document.getElementById('cc-busca')?.value || '';
  const buscaTokens = _ccNorm(busca).split(/\s+/).filter(Boolean);
  return { tipo, ano, pago, busca: busca.trim(), buscaTokens };
}

window.ccOpenPdfOpts = function(secId){
  _pdfOptsSecId = secId;
  const anos = [...new Set(S.contas.filter(c=>c.atividade_id===secId && c.mes_ano).map(c=>String(c.mes_ano).split('/')[1]).filter(Boolean))].sort();
  const currentYear = String(new Date().getFullYear());
  const ft = _ccFiltrosTela(secId);
  document.getElementById('cc-pdf-ano').innerHTML = anos.map(a=>`<option value="${esc(a)}" ${a===(ft.ano||currentYear)?'selected':''}>${esc(a)}</option>`).join('');
  document.getElementById('cc-pdf-todos').checked = !ft.ano;
  document.getElementById('cc-pdf-pagas').checked = ft.pago === 'pago';
  const avisoEl = document.getElementById('cc-pdf-filtro-ativo');
  const ativos = [];
  if(ft.busca) ativos.push('busca: "'+ft.busca+'"');
  if(ft.tipo) ativos.push('tipo: '+ft.tipo);
  if(ft.ano) ativos.push('ano: '+ft.ano);
  if(ft.pago) ativos.push(ft.pago==='pago'?'apenas pagas':'apenas pendentes');
  if(ativos.length){
    avisoEl.style.display = 'block';
    avisoEl.innerHTML = '⚠️ Há filtro(s) ativo(s) na tela (' + esc(ativos.join(', ')) + '). O PDF sairá apenas com esse resultado filtrado.';
  } else {
    avisoEl.style.display = 'none';
  }
  document.getElementById('cc-pdf-overlay').style.display = 'flex';
};

window.ccFecharPdfOpts = function(){ document.getElementById('cc-pdf-overlay').style.display='none'; };

window.ccConfirmarPdf = function(){
  const ano = document.getElementById('cc-pdf-ano')?.value;
  const todos = document.getElementById('cc-pdf-todos')?.checked;
  const apenasPagas = document.getElementById('cc-pdf-pagas')?.checked;
  const ft = _ccFiltrosTela(_pdfOptsSecId);
  ccFecharPdfOpts();
  ccGerarPdf(_pdfOptsSecId, {
    ano: todos ? null : ano,
    apenasPagas,
    tipo: ft.tipo,
    pago: apenasPagas ? 'pago' : ft.pago,
    busca: ft.busca,
    buscaTokens: ft.buscaTokens
  });
};

window.ccGerarPdf = async function(secId, opts){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error');return;}
  toast('Gerando PDF...','info',8000);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297, mx=12, cw=W-mx*2;
  const fmtMoney=v=>parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const fmtPdfD=d=>d?fmtD(d):'-';
  const sf=(sz,bold,clr)=>{doc.setFontSize(sz||9);doc.setFont('helvetica',bold?'bold':'normal');const c=clr||[26,32,44];doc.setTextColor(c[0],c[1],c[2]);};
  const now = new Date().toLocaleDateString('pt-BR');
  let y = 18;
  doc.setFillColor(13,34,64); doc.rect(mx,12,cw,0.7,'F');
  sf(18,true,[13,34,64]); const titleLines = doc.splitTextToSize(sec.name||'CONTROLE DE CONTAS', cw-10); doc.text(titleLines, mx, y); y += titleLines.length*5 + 4;
  sf(9,false,[100,116,139]); doc.text('Prefeitura de Sertania - PE - Controle PMS - '+now, mx, y);
  y+=6;
  const filtros=[];
  if(opts.busca) filtros.push('Busca: "'+opts.busca+'"');
  if(opts.tipo) filtros.push('Tipo: '+opts.tipo);
  if(opts.ano) filtros.push('Ano: '+opts.ano);
  if(opts.pago==='pago') filtros.push('Apenas contas pagas');
  if(opts.pago==='pendente') filtros.push('Apenas contas pendentes');
  if(filtros.length){ sf(8,false,[180,60,20]); doc.text('Filtros aplicados: '+filtros.join(' | '), mx, y); y+=5; }
  if(sec.observacoes){ sf(8,false,[60,60,60]); const obs = doc.splitTextToSize(sec.observacoes, cw-10); doc.text(obs, mx, y); y += obs.length*3.5 + 4; }

  let totalGeral=0, totalPago=0, qtdPago=0, qtdTotal=0;
  const maxValor = S.contas.filter(c=>c.atividade_id===secId && c.valor).reduce((a,c)=>Math.max(a, parseFloat(c.valor)||0), 1);
  const rows=[];
  const catMap={};
  const tipoMap={};
  const items=[...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  items.forEach(item=>{
    const locais=[...S.subitems.filter(s=>s.item_id===item.id && s.parent_type!=='subitem')].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    let catQtd=0, catPago=0, catTotal=0;
    locais.forEach(local=>{
      if(!_ccLocalMatchesBusca(item, local, opts.buscaTokens)) return;
      let lancs=S.contas.filter(c=>c.subitem_id===local.id).sort((a,b)=>{const da=(a.mes_ano||'').split('/').reverse().join('-');const db=(b.mes_ano||'').split('/').reverse().join('-');return da.localeCompare(db);});
      if(opts.tipo) lancs=lancs.filter(c=>c.tipo===opts.tipo);
      if(opts.ano) lancs=lancs.filter(c=>String(c.mes_ano||'').includes('/'+opts.ano));
      if(opts.pago==='pago') lancs=lancs.filter(c=>c.pago);
      if(opts.pago==='pendente') lancs=lancs.filter(c=>!c.pago);
      let locQtd=0, locPago=0, locTotal=0;
      lancs.forEach(c=>{
        const v=parseFloat(c.valor)||0;
        const tipo=c.tipo||'N/A';
        const pctLanc = maxValor ? Math.round(v/maxValor*100) : 0;
        const situacao=pctLanc+'%';
        totalGeral+=v; qtdTotal++; catTotal+=v; catQtd++; locTotal+=v; locQtd++;
        if(c.pago){ totalPago+=v; qtdPago++; catPago+=v; locPago++; }
        if(!catMap[item.id]) catMap[item.id]={nome:item.description||'-',qtd:0,qPago:0,total:0,pago:0};
        catMap[item.id].qtd++; catMap[item.id].total+=v; if(c.pago){ catMap[item.id].qPago++; catMap[item.id].pago+=v; }
        if(!tipoMap[tipo]) tipoMap[tipo]={qtd:0,qPago:0,total:0,pago:0};
        tipoMap[tipo].qtd++; tipoMap[tipo].total+=v; if(c.pago){ tipoMap[tipo].qPago++; tipoMap[tipo].pago+=v; }
        rows.push([item.description||'-', local.description||'-', c.mes_ano||'-', c.tipo||'-', c.leitura_relogio||'-', c.consumo_kwh||'-','R$ '+fmtMoney(v), c.pago?'SIM':'NÃO', fmtPdfD(c.data_vencimento), fmtPdfD(c.data_pagamento), c.observacao||'-', situacao]);
      });
      if(locQtd>0){
        rows.push([item.description||'-', (local.description||'-')+' - SUBTOTAL LOCAL', '', '', '', '', 'R$ '+fmtMoney(locTotal), (locPago+'/'+locQtd+' PAGOS'), '', '', '', '']);
        rows.push(['','','','','','','','','','','','']);
      }
    });
    if(catQtd>0){
      rows.push([(item.description||'-')+' - TOTAL UNIDADE', '', '', '', '', '', 'R$ '+fmtMoney(catTotal), (catPago+'/'+catQtd+' PAGOS'), '', '', '', '']);
      rows.push(['','','','','','','','','','','','']);
      rows.push(['','','','','','','','','','','','']);
    }
  });
  const totalPendente=totalGeral-totalPago;
  const qtdPendente=qtdTotal-qtdPago;
  const pctPago=totalGeral ? (totalPago/totalGeral*100) : 0;

  const summaryRows=Object.values(catMap).sort((a,b)=>b.total-a.total).map(c=>{
    const pend=c.total-c.pago;
    const pct=c.total ? (c.pago/c.total*100).toFixed(1) : '0.0';
    return [c.nome,c.qtd,c.qPago,c.qtd-c.qPago,'R$ '+fmtMoney(c.total),'R$ '+fmtMoney(c.pago),'R$ '+fmtMoney(pend),pct+'%'];
  });
  summaryRows.push(['TOTAL GERAL',qtdTotal,qtdPago,qtdPendente,'R$ '+fmtMoney(totalGeral),'R$ '+fmtMoney(totalPago),'R$ '+fmtMoney(totalPendente),pctPago.toFixed(1)+'%']);

  sf(12,true,[13,34,64]); doc.text('RESUMO POR CATEGORIA', mx, y); y+=8;
  doc.autoTable({
    startY:y,
    margin:{left:mx,right:mx},
    head:[['Categoria','Lanc.','Pagos','Pendentes','Valor Total','Valor Pago','Valor Pendente','% Pago']],
    body:summaryRows,
    theme:'grid',
    headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:9},
    bodyStyles:{fontSize:9,textColor:[40,40,40]},
    alternateRowStyles:{fillColor:[245,250,245]},
    styles:{cellPadding:2,overflow:'linebreak',font:'helvetica'},
    columnStyles:{0:{cellWidth:50},1:{cellWidth:18},2:{cellWidth:18},3:{cellWidth:22},4:{cellWidth:32,halign:'right'},5:{cellWidth:32,halign:'right'},6:{cellWidth:32,halign:'right'},7:{cellWidth:20,halign:'center'}},
    didParseCell:(data)=>{
      if(data.row.raw[0]==='TOTAL GERAL'){ data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[224,242,254]; }
      if(data.column.index===4) data.cell.styles.fontStyle='bold';
      if(data.column.index===5) data.cell.styles.textColor=[16,185,129];
      if(data.column.index===6) data.cell.styles.textColor=[239,68,68];
    }
  });

  const tipoRows=Object.entries(tipoMap).sort((a,b)=>b[1].total-a[1].total).map(([t,v])=>{
    const pend=v.total-v.pago;
    return [t, v.qtd, v.qPago, v.qtd-v.qPago, 'R$ '+fmtMoney(v.total), 'R$ '+fmtMoney(v.pago), 'R$ '+fmtMoney(pend)];
  });
  const startTipoY=doc.lastAutoTable?doc.lastAutoTable.finalY+12:y+30;
  sf(12,true,[13,34,64]); doc.text('RESUMO POR TIPO DE CONTA', mx, startTipoY-6);
  doc.autoTable({
    startY:startTipoY,
    margin:{left:mx,right:mx},
    head:[['Tipo de Conta','Quant.','Pagas','Pendentes','Valor Total','Valor Pago','Valor Pendente']],
    body:tipoRows,
    theme:'grid',
    headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:9},
    bodyStyles:{fontSize:9,textColor:[40,40,40]},
    alternateRowStyles:{fillColor:[245,250,245]},
    styles:{cellPadding:2,overflow:'linebreak',font:'helvetica'},
    columnStyles:{0:{cellWidth:50},1:{cellWidth:22,halign:'center'},2:{cellWidth:22,halign:'center'},3:{cellWidth:22,halign:'center'},4:{cellWidth:34,halign:'right'},5:{cellWidth:34,halign:'right'},6:{cellWidth:34,halign:'right'}},
    didParseCell:(data)=>{
      if(data.column.index===4) data.cell.styles.fontStyle='bold';
      if(data.column.index===5) data.cell.styles.textColor=[16,185,129];
      if(data.column.index===6) data.cell.styles.textColor=[239,68,68];
    }
  });

  const startDetailY=doc.lastAutoTable?doc.lastAutoTable.finalY+12:y+30;
  sf(12,true,[13,34,64]); doc.text('DETALHAMENTO POR LANCAMENTO', mx, startDetailY-6);
  if(rows.length){
    doc.autoTable({
      startY:startDetailY,
      margin:{left:mx,right:mx},
      head:[['Categoria','Local','Mes/Ano','Tipo','Leitura','Consumo','Valor','Pago','Vencimento','Pagamento','Obs.','Situacao']],
      body:rows,
      theme:'grid',
      headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontSize:8},
      bodyStyles:{fontSize:8,textColor:[40,40,40]},
      alternateRowStyles:{fillColor:[245,250,245]},
      styles:{cellPadding:1.5,overflow:'linebreak',font:'helvetica'},
      columnStyles:{0:{cellWidth:28},1:{cellWidth:32},2:{cellWidth:18},3:{cellWidth:20},4:{cellWidth:18},5:{cellWidth:18},6:{cellWidth:22,halign:'right'},7:{cellWidth:12,halign:'center'},8:{cellWidth:18},9:{cellWidth:18},10:{cellWidth:43},11:{cellWidth:18,halign:'center'}},
      didParseCell:(data)=>{
        if(data.section!=='body') return;
        const isBlank = Array.isArray(data.row.raw) && data.row.raw.every(x=>String(x).trim()==='');
        const isSub = !isBlank && typeof data.row.raw[1]==='string' && data.row.raw[1].includes('SUBTOTAL LOCAL');
        const isCat = !isBlank && typeof data.row.raw[0]==='string' && data.row.raw[0].includes('TOTAL UNIDADE');
        if(isBlank){
          data.cell.styles.minCellHeight=5;
          data.cell.styles.fillColor=[255,255,255];
          data.cell.styles.lineColor=[255,255,255];
          data.cell.styles.textColor=[255,255,255];
          data.cell.styles.cellPadding=1;
          data.cell.styles.fontSize=1;
          return;
        }
        if(isSub || isCat){
          data.cell.styles.fontStyle='bold';
          data.cell.styles.fillColor = isCat ? [200,230,255] : [230,255,235];
          data.cell.styles.textColor = [0,0,0];
        } else {
          [2,6,8,9].forEach(idx=>{ if(data.column.index===idx) data.cell.styles.fontStyle='bold'; });
          if(data.column.index===7 && data.row.raw[7]==='SIM') data.cell.styles.textColor=[0,0,0];
        }
      },
      didDrawCell:(data)=>{
        if(data.section!=='body' || data.column.index!==11) return;
        const txt = data.row.raw[11];
        if(!txt) return;
        const pct = parseInt(txt);
        if(isNaN(pct)) return;
        const isPaid = data.row.raw[7]==='SIM';
        const col = isPaid ? [16,185,129] : [248,113,113];
        doc.setFillColor(col[0],col[1],col[2]);
        const barW = Math.max(0.5,(data.cell.width-2)*(pct/100));
        doc.rect(data.cell.x+1, data.cell.y+2, barW, data.cell.height-4, 'F');
      }
    });
  } else {
    sf(10,false,[120,120,120]); doc.text('Nenhum lancamento encontrado para os filtros selecionados.', mx, startDetailY+10);
  }

  const finalY=doc.lastAutoTable?doc.lastAutoTable.finalY+10:startDetailY+30;
  const footerText=`TOTAL GERAL: R$ ${fmtMoney(totalGeral)}   |   PAGO: R$ ${fmtMoney(totalPago)}   |   PENDENTE: R$ ${fmtMoney(totalPendente)}   |   ${qtdPago}/${qtdTotal} CONTAS PAGAS (${pctPago.toFixed(1)}%)`;
  const ftLines=doc.splitTextToSize(footerText, cw-12);
  const fh=10+ftLines.length*4.5;
  doc.setFillColor(13,34,64); doc.roundedRect(mx, finalY, cw, fh, 2, 2, 'F');
  sf(9,true,[255,255,255]); doc.text(ftLines, mx+6, finalY+6);

  doc.save((sec.name||'controle-contas').replace(/[^a-zA-Z0-9\u00C0-\u00FA ]/g,'_').trim()+'_relatorio_'+now.replace(/\//g,'-')+'.pdf');
  toast('PDF gerado!','success');
};
