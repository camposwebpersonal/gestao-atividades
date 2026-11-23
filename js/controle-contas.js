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

// Locais ligados ao cadastro oficial primeiro; resumos/sem cadastro (📦) no fim de cada categoria.
const _ccSemCadastro = local => !window.cadastroLinks?.cad(local);
const _ccOrdemLocal = (a,b) => (_ccSemCadastro(a)-_ccSemCadastro(b)) || ((a.order_num||0)-(b.order_num||0));
const _ccNomeLocal = local => (_ccSemCadastro(local)?'📦 ':'')+(local?.description||'Local');
function _ccLocalMatchesBusca(item, local, buscaTokens, localContas){
  if(!buscaTokens || !buscaTokens.length) return true;
  const efLocal = (local && local.extra_fields) || {};
  const obsTodas = (localContas || []).map(c=>c.observacao||'');
  const partesBusca = [item?.description, local?.description, window.cadastroLinks?.ownName(local), ...Object.values(efLocal), ...Object.values((window.cadastroLinks?.cad(local)?.extra_fields)||{}).filter(v=>typeof v!=='object'), ...obsTodas];
  const searchable = _ccNorm(partesBusca.filter(Boolean).join(' '));
  const rawQuery=buscaTokens.join(' ');
  return window.smartSearchText?window.smartSearchText(partesBusca,rawQuery).matched:buscaTokens.every(tok => searchable.includes(tok));
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

const CC_LOCAIS_POR_PAGINA = 12;
const CC_LANCAMENTOS_POR_LOCAL = 40;
const _ccPaginaPorSecao = new Map();
const _ccPaginasPorLocal = new Map();
const _ccModoPorSecao = new Map();
const _ccNavegacaoPorSecao = new Map();
const CC_MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const ccAno = c => String(c.mes_ano||'').split('/')[1]||'Sem ano';
const ccMes = c => CC_MESES[Number(String(c.mes_ano||'').split('/')[0])-1]||'Sem mês';
window.ccNavegar = function(secId,nivel,valor){
 const nav={...(_ccNavegacaoPorSecao.get(secId)||{})};nav[nivel]=valor;
 const niveis=['setor','local','tipo','ano','mes'];
 const indice=niveis.indexOf(nivel);if(indice<0)return;
 niveis.slice(indice+1).forEach(chave=>delete nav[chave]);
 const main=document.querySelector('main'),content=document.getElementById('content');
 const top=main?.scrollTop||0,left=main?.scrollLeft||0;
 const windowTop=window.scrollY||0,windowLeft=window.scrollX||0;
 const monthsLeft=document.querySelector('.cc-months')?.scrollLeft||0;
 const minHeight=content?.style.minHeight||'';
 // Mantém a altura durante a troca para o navegador não limitar a rolagem ao esvaziar o conteúdo.
 if(content)content.style.minHeight=content.offsetHeight+'px';
 _ccNavegacaoPorSecao.set(secId,nav);_ccPaginaPorSecao.set(secId,1);_ccPaginasPorLocal.clear();
 try{renderControleContas(secId,{somenteMes:nivel==='mes'});}finally{
   requestAnimationFrame(()=>{
     if(content)content.style.minHeight=minHeight;
     main?.scrollTo({top,left,behavior:'instant'});
     window.scrollTo({top:windowTop,left:windowLeft,behavior:'instant'});
     const months=document.querySelector('.cc-months');if(months)months.scrollLeft=monthsLeft;
   });
 }

};
let _ccBuscaTimer = null;
window.ccSetModo = function(secId, modo){
  _ccModoPorSecao.set(secId,modo);
  renderControleContas(secId);
};
window.ccSetPagina = function(secId, pagina){
  _ccPaginaPorSecao.set(secId, Math.max(1, Number(pagina)||1));
  renderControleContas(secId);
  requestAnimationFrame(()=>document.querySelector('.cc-paginacao')?.scrollIntoView({behavior:'smooth',block:'center'}));
};
window.ccResetPaginaERender = function(secId){
  _ccPaginaPorSecao.set(secId, 1);
  renderControleContas(secId);
};
window.ccSetPaginaLocal = function(secId, localId, pagina){
  _ccPaginasPorLocal.set(secId+':'+localId, Math.max(1,Number(pagina)||1));
  renderControleContas(secId);
  requestAnimationFrame(()=>document.getElementById('cc-local-'+localId)?.scrollIntoView({behavior:'smooth',block:'start'}));
};
window.ccBuscaInput = function(secId){
  clearTimeout(_ccBuscaTimer);
  _ccPaginaPorSecao.set(secId, 1);
  const inp = document.getElementById('cc-busca');
  const pos = inp ? inp.selectionStart : null;
  _ccBuscaTimer = setTimeout(()=>{
    renderControleContas(secId);
    const novo = document.getElementById('cc-busca');
    if(novo){ novo.focus(); if(pos!=null){ try{ novo.setSelectionRange(pos,pos); }catch(e){} } }
  }, 320);
};

window.renderControleContas = function(secId,opcoes={}){
  const sec = S.secs.find(s=>s.id===secId); if(!sec) return;
  curSecId = secId;
  const modo=_ccModoPorSecao.get(secId)||'resumo';
  const items = [...S.items.filter(i=>i.atividade_id===secId)].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const tipoFiltro = document.getElementById('cc-filtro-tipo')?.value || '';
  const anoFiltro = document.getElementById('cc-filtro-ano')?.value || '';
  const pagoFiltro = document.getElementById('cc-filtro-pago')?.value || '';
  const buscaFiltro = document.getElementById('cc-busca')?.value || '';
  const buscaTokens = _ccNorm(buscaFiltro).split(/\s+/).filter(Boolean);

  // Um unico indice substitui milhares de varreduras completas em S.contas/S.subitems.
  const contasSecao = S.contas.filter(c=>c.atividade_id===secId);
  const contasPorLocal = new Map();
  S.contas.forEach(c=>{
    if(!contasPorLocal.has(c.subitem_id)) contasPorLocal.set(c.subitem_id, []);
    contasPorLocal.get(c.subitem_id).push(c);
  });
  const locaisPorCategoria = new Map();
  S.subitems.forEach(local=>{
    if(local.parent_type==='subitem') return;
    if(!locaisPorCategoria.has(local.item_id)) locaisPorCategoria.set(local.item_id, []);
    locaisPorCategoria.get(local.item_id).push(local);
  });
  // A navegação afeta apenas os detalhes; o resumo geral mantém seus totais.
  const nav={...(_ccNavegacaoPorSecao.get(secId)||{})};
  const matchesFiltros=c=>(!tipoFiltro||c.tipo===tipoFiltro)&&(!anoFiltro||ccAno(c)===anoFiltro)&&(!pagoFiltro||(pagoFiltro==='pago'?c.pago:!c.pago));
  const locaisElegiveis=item=>(locaisPorCategoria.get(item.id)||[]).filter(local=>_ccLocalMatchesBusca(item,local,buscaTokens,contasPorLocal.get(local.id)||[]));
  const contasPorSetor=new Map(items.map(item=>[item.id,locaisElegiveis(item).flatMap(local=>contasPorLocal.get(local.id)||[]).filter(matchesFiltros)]));
  const contasSetor=item=>contasPorSetor.get(item.id)||[];
  const setoresNavegaveis=items.filter(item=>contasSetor(item).length||(!tipoFiltro&&!anoFiltro&&!pagoFiltro&&(!buscaTokens.length||locaisElegiveis(item).length)));
  if(!setoresNavegaveis.some(i=>i.id===nav.setor))nav.setor=setoresNavegaveis[0]?.id||'';
  const setorAtivo=items.find(i=>i.id===nav.setor);
  const locaisNavegaveis=(setorAtivo?locaisElegiveis(setorAtivo):[]).filter(local=>!(tipoFiltro||anoFiltro||pagoFiltro)||(contasPorLocal.get(local.id)||[]).some(matchesFiltros)).sort(_ccOrdemLocal);
  if(!locaisNavegaveis.some(local=>local.id===nav.local))nav.local=locaisNavegaveis[0]?.id||'';
  const localAtivo=locaisNavegaveis.find(local=>local.id===nav.local);
  const contasAtivas=(contasPorLocal.get(nav.local)||[]).filter(matchesFiltros);
  const tiposNavegaveis=[...new Set(contasAtivas.map(c=>c.tipo||'Outros'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  if(!tiposNavegaveis.includes(nav.tipo))nav.tipo=tiposNavegaveis[0]||'';
  const contasTipo=contasAtivas.filter(c=>(c.tipo||'Outros')===nav.tipo);
  const anosNavegaveis=[...new Set(contasTipo.map(ccAno))].sort((a,b)=>b.localeCompare(a));
  if(!anosNavegaveis.includes(nav.ano))nav.ano=anosNavegaveis.includes(String(new Date().getFullYear()))?String(new Date().getFullYear()):anosNavegaveis[0]||'';
  const contasAno=contasTipo.filter(c=>ccAno(c)===nav.ano);
  const mesesNavegaveis=CC_MESES.map((mes,i)=>({id:String(i+1),label:mes}));
  if(contasAno.some(c=>ccMes(c)==='Sem mês'))mesesNavegaveis.push({id:'0',label:'Sem mês'});
  const numeroMes=c=>{const n=Number(String(c.mes_ano||'').split('/')[0]);return n>=1&&n<=12?String(n):'0';};
  if(!mesesNavegaveis.some(m=>m.id===nav.mes))nav.mes=mesesNavegaveis.find(m=>contasAno.some(c=>numeroMes(c)===m.id))?.id||'1';
  _ccNavegacaoPorSecao.set(secId,nav);
  const navTabs=(nivel,values,selected)=>`<div class="cc-drill-tabs ${nivel==='local'?'cc-local-grid':''}" role="group" aria-label="${nivel}">${values.map(v=>`<button type="button" data-cc-level="${nivel}" data-cc-value="${esc(v.id)}" aria-pressed="${v.id===selected}" class="${v.id===selected?'active':''}">${esc(v.label)}</button>`).join('')}</div>`;
  // Neuroarquitetura: passos numerados (um caminho claro), meses com a situação em palavras e cor calma.
  const passo=(n,t)=>`<div class="cc-drill-label"><i aria-hidden="true">${n}</i>${t}</div>`;
  const mesBtn=mes=>{const rows=contasAno.filter(c=>numeroMes(c)===mes.id),total=rows.reduce((v,c)=>v+(parseFloat(c.valor)||0),0),pend=rows.filter(c=>!c.pago).length;
    return `<button type="button" data-cc-level="mes" data-cc-value="${mes.id}" aria-pressed="${mes.id===nav.mes}" class="cc-month ${rows.length?'has-data':''} ${rows.length?(pend?'has-pend':'all-paid'):''} ${mes.id===nav.mes?'active':''}" title="${rows.length?esc(mes.label+': '+_ccMoney(total)+' · '+rows.length+' lançamento(s)'):esc(mes.label+': sem lançamento')}"><strong>${mes.label}</strong><small class="ccn-fit">${rows.length?_ccMoney(total):'Sem lançamento'}</small><small class="cc-month-st">${rows.length?(pend?`⏳ ${pend} pendente${pend>1?'s':''}`:'✓ tudo pago'):'—'}</small></button>`;};
  const navegacaoHtml=`<div class="ccn-intro"><span class="ccn-intro-ico" aria-hidden="true">🧾</span><div><b>Lançar e conferir</b><small>Siga os passos: setor → local → tipo → ano → mês. A conta do mês aparece logo abaixo, pronta para editar.</small></div></div>
  <div class="cc-drilldown">${passo(1,'Setor')}${navTabs('setor',setoresNavegaveis.map(i=>({id:i.id,label:i.description||'Setor'})),nav.setor)}
  ${locaisNavegaveis.length?`${passo(2,'Item / local')}${navTabs('local',locaisNavegaveis.map(local=>({id:local.id,label:_ccNomeLocal(local)})),nav.local)}`:''}
  ${tiposNavegaveis.length?`<div class="cc-drill-row"><div>${passo(3,'Tipo de conta')}${navTabs('tipo',tiposNavegaveis.map(t=>({id:t,label:t})),nav.tipo)}</div><div>${passo(4,'Ano')}${navTabs('ano',anosNavegaveis.map(a=>({id:a,label:a})),nav.ano)}</div></div>
  ${passo(5,'Mês')}<div class="cc-months" role="group" aria-label="Mês do lançamento">${mesesNavegaveis.map(mesBtn).join('')}</div>
  <div class="cc-path">${esc(setorAtivo?.description||'')} › ${esc(localAtivo?.description||'')} › ${esc(nav.tipo)} › ${esc(nav.ano)} › ${mesesNavegaveis.find(m=>m.id===nav.mes)?.label||''}</div>`:'<div class="empty">Nenhum lançamento neste item/local para os filtros selecionados.</div>'}</div>`;
  const paginaSolicitada = Math.max(1, _ccPaginaPorSecao.get(secId)||1);
  const inicioPagina = (paginaSolicitada-1)*CC_LOCAIS_POR_PAGINA;
  const fimPagina = inicioPagina+CC_LOCAIS_POR_PAGINA;
  let quantidadeLocaisEncontrados = 0;

  let totalGeral = 0, totalPago = 0, totalPendente = 0;
  let qtdPago = 0, qtdPendente = 0, qtdTotal = 0;
  const colsOff = new Set(sec.cc_cols_ocultas || []);
  const resumoCats = [];
  const tipoMap = {};
  const locaisResumo = [];

  const categoriasHtml = items.map((item, idx)=>{
    const locais = [...(locaisPorCategoria.get(item.id)||[])].sort(_ccOrdemLocal);
    let locaisHtml = '',resumoLocalHtml = '';
    let catTotal = 0, catPago = 0, catPendente = 0, catQtd = 0, catQPago = 0, catQPendente = 0;
    locais.forEach((local, li)=>{
      // Busca em TUDO: categoria, local, todos os campos extras do local
      // (ex: Distrito/Povoado/Sitio/Vila, Conta Contrato, Endereço, etc.)
      // e a observação de cada lançamento. Se bater em qualquer lugar,
      // o local inteiro aparece com todos os seus lançamentos.
      const lancamentos = [...(contasPorLocal.get(local.id)||[])].sort((a,b)=>{
        const da = (a.mes_ano||'').split('/').reverse().join('-');
        const db = (b.mes_ano||'').split('/').reverse().join('-');
        return da.localeCompare(db);
      });
      if(!_ccLocalMatchesBusca(item, local, buscaTokens, lancamentos)) return;
      let locRows = lancamentos.filter(c=>{
        if(tipoFiltro && c.tipo !== tipoFiltro) return false;
        if(anoFiltro && !String(c.mes_ano||'').includes('/'+anoFiltro)) return false;
        if(pagoFiltro === 'pago' && !c.pago) return false;
        if(pagoFiltro === 'pendente' && c.pago) return false;
        return true;
      });
      if(!locRows.length && (tipoFiltro || anoFiltro || pagoFiltro)) return '';
      const detailRows=locRows.filter(c=>item.id===nav.setor&&local.id===nav.local&&(c.tipo||'Outros')===nav.tipo&&ccAno(c)===nav.ano&&numeroMes(c)===nav.mes);
      const localSelecionado=item.id===nav.setor&&local.id===nav.local;
      const ordemLocal = localSelecionado?quantidadeLocaisEncontrados++:-1;
      const renderizarDetalhes = localSelecionado&&ordemLocal>=inicioPagina && ordemLocal<fimPagina;
      const chavePaginaLocal = secId+':'+local.id;
      const totalPaginasLocal = Math.max(1,Math.ceil(detailRows.length/CC_LANCAMENTOS_POR_LOCAL));
      const paginaLocal = Math.min(totalPaginasLocal,Math.max(1,_ccPaginasPorLocal.get(chavePaginaLocal)||1));
      _ccPaginasPorLocal.set(chavePaginaLocal,paginaLocal);
      const inicioLocal = (paginaLocal-1)*CC_LANCAMENTOS_POR_LOCAL;
      const linhasVisiveis = detailRows.slice(inicioLocal,inicioLocal+CC_LANCAMENTOS_POR_LOCAL);
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
      const efAll = window.cadastroLinks ? window.cadastroLinks.fields(local) : ((local && local.extra_fields) || {});
      const headMeta = Object.entries(efAll).filter(([k,v])=>String(v||'').trim()).map(([k,v])=>k+': '+v);
      const headMetaStr = headMeta.join(' • ') || 'Clique em editar para preencher dados do local';
      const contaContrato = _ccLocalExtraFields(local).conta_contrato;
      const tableRows = renderizarDetalhes ? linhasVisiveis.map((c,ri)=>{
        const pagoCls = c.pago ? 'cc-pago-row' : '';
        return `<tr class="${pagoCls}">
          ${colsOff.has('mes')?'':`<td>${ccMes(c)} · ${esc(c.mes_ano||'—')}</td>`}
          ${colsOff.has('tipo')?'':`<td>${esc(c.tipo||'—')}</td>`}
          ${colsOff.has('contrato')?'':`<td><input type="text" class="${_ccTokenHit(contaContrato,buscaTokens)?'cc-obs-match':''}" value="${esc(contaContrato||'')}" onchange="ccSalvarContaContratoLocal('${local.id}',this.value)" placeholder="Conta Contrato"></td>`}
          ${colsOff.has('leitura')?'':`<td><input type="text" value="${esc(c.leitura_relogio||'')}" onchange="ccSalvarCampo('${c.id}','leitura_relogio',this.value)" placeholder="Leitura"></td>`}
          ${colsOff.has('consumo')?'':`<td><input type="text" value="${esc(c.consumo_kwh||'')}" onchange="ccSalvarCampo('${c.id}','consumo_kwh',this.value)" placeholder="kWh"></td>`}
          <td><input type="number" step="0.01" value="${esc(String(c.valor||''))}" onchange="ccSalvarCampo('${c.id}','valor',this.value)" placeholder="R$"></td>
          <td><input type="date" value="${esc(c.data_vencimento||'')}" onchange="ccSalvarCampo('${c.id}','data_vencimento',this.value)"></td>
          <td><input type="date" value="${esc(c.data_pagamento||'')}" onchange="ccSalvarCampo('${c.id}','data_pagamento',this.value)"></td>
          <td class="cc-col-pago"><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></td>
          <td><input type="text" class="${_ccTokenHit(c.observacao,buscaTokens)?'cc-obs-match':''}" value="${esc(c.observacao||'')}" onchange="ccSalvarCampo('${c.id}','observacao',this.value)" placeholder="Obs."></td>
          <td style="white-space:nowrap"><button class="card-btn" onclick="ccOpenLancamentoModal('${c.id}','${local.id}')" title="Editar lançamento completo">✏️</button>${S.isAdmin?`<button class="card-btn" onclick="ccDeleteLancamento('${c.id}')">🗑️</button>`:''}</td>
        </tr>`;
      }).join('') : '';

      const mobileRows = renderizarDetalhes ? linhasVisiveis.map(c=>{
        return `<div class="cc-mobile-card">
          <div class="cc-mobile-title">${ccMes(c)} · ${esc(c.mes_ano||'—')} — ${esc(c.tipo||'—')}</div>
          ${colsOff.has('contrato')?'':`<div class="cc-mobile-row"><span>Conta Contrato</span><span>${_ccHighlight(contaContrato||'—', buscaTokens)}</span></div>`}
          ${colsOff.has('leitura')?'':`<div class="cc-mobile-row"><span>Leitura</span><span>${esc(c.leitura_relogio||'—')}</span></div>`}
          ${colsOff.has('consumo')?'':`<div class="cc-mobile-row"><span>Consumo</span><span>${esc(c.consumo_kwh||'—')}</span></div>`}
          <div class="cc-mobile-row cc-mobile-valor"><span>Valor</span><span>${_ccMoney(c.valor)}</span></div>
          <div class="cc-mobile-row"><span>Vencimento</span><span>${fmtD(c.data_vencimento)}</span></div>
          <div class="cc-mobile-row"><span>Pagamento</span><span>${fmtD(c.data_pagamento)}</span></div>
          <div class="cc-mobile-row"><span>Pago</span><span><input type="checkbox" ${c.pago?'checked':''} onchange="ccTogglePago('${c.id}',this.checked)"></span></div>
          <div class="cc-mobile-row"><span>Obs.</span><span>${_ccHighlight(c.observacao||'—', buscaTokens)}</span></div>
          <div class="cc-mobile-row" style="justify-content:flex-end;gap:8px;margin-top:4px">
            <button class="card-btn" onclick="ccOpenLancamentoModal('${c.id}','${local.id}')" title="Editar lançamento completo">✏️ Editar</button>
            ${S.isAdmin?`<button class="card-btn" onclick="ccDeleteLancamento('${c.id}')">🗑️</button>`:''}
          </div>
        </div>`;
      }).join('') : '';

      const paginacaoLocalHtml = detailRows.length>CC_LANCAMENTOS_POR_LOCAL ? `<div class="cc-paginacao cc-paginacao-local">
        <div><strong>${inicioLocal+1}–${Math.min(inicioLocal+CC_LANCAMENTOS_POR_LOCAL,detailRows.length)}</strong> de <strong>${detailRows.length}</strong> lançamentos</div>
        <div class="cc-paginacao-acoes"><button class="btn-action" ${paginaLocal<=1?'disabled':''} onclick="ccSetPaginaLocal('${secId}','${local.id}',${paginaLocal-1})">←</button><span>Página <strong>${paginaLocal}</strong> de ${totalPaginasLocal}</span><button class="btn-action" ${paginaLocal>=totalPaginasLocal?'disabled':''} onclick="ccSetPaginaLocal('${secId}','${local.id}',${paginaLocal+1})">→</button></div>
      </div>` : '';
      const detailTotal=detailRows.reduce((v,c)=>v+(parseFloat(c.valor)||0),0),detailPago=detailRows.filter(c=>c.pago).reduce((v,c)=>v+(parseFloat(c.valor)||0),0);
      const lancamentosAno=lancamentos.filter(c=>ccAno(c)===nav.ano&&(c.tipo||'Outros')===nav.tipo);
      const totalLocalGeral=lancamentosAno.reduce((v,c)=>v+(parseFloat(c.valor)||0),0);
      const totalLocalPago=lancamentosAno.filter(c=>c.pago).reduce((v,c)=>v+(parseFloat(c.valor)||0),0);
      const _pend=totalLocalGeral-totalLocalPago;
      if(renderizarDetalhes) resumoLocalHtml = `<div class="cc-local-summary"><span class="ccn-mini is-total"><i aria-hidden="true">📅</i><span>Total do ano: ${_ccMoney(totalLocalGeral)}</span></span><span class="ccn-mini is-paid"><i aria-hidden="true">✅</i><span>Pago: ${_ccMoney(totalLocalPago)}</span></span><span class="ccn-mini ${_pend>0.004?'is-pend':'is-zero'}"><i aria-hidden="true">${_pend>0.004?'⏳':'🎉'}</i><span>Pendente: ${_ccMoney(_pend)}</span></span><small class="ccn-mini-note">${lancamentosAno.length} lançamento(s) no ano</small></div>`;
      if(renderizarDetalhes) locaisHtml += `<div class="cc-local-card" id="cc-local-${local.id}">
        <div class="cc-local-head">
          <div class="cc-local-title">
            <div class="cc-local-name">${_ccSemCadastro(local)?'📦 ':''}${_ccHighlight(local.description||'Local', buscaTokens)}${window.cadastroLinks?.cad(local)?' <em class="ccr-linked" title="Nome e dados vindos de ADMINISTRAÇÃO › Cadastros">🔗 cadastro</em>':' <span class="cc-unlinked-tag">sem cadastro</span>'}</div>
            <div class="cc-local-meta">${_ccHighlight(headMetaStr, buscaTokens)}</div>
          </div>
          <div class="cc-local-actions">
            ${S.isAdmin?`<button class="card-btn" onclick="ccOpenLocalModal('${local.id}','${item.id}')">✏️</button>`:''}
            <button class="btn-action primary ccn-add" onclick="ccOpenLancamentoModal(null,'${local.id}')">+ Lançamento</button>
          </div>
        </div>
        <div class="cc-lancamentos">
          ${paginacaoLocalHtml}
          <div class="cc-table-wrap">
            <table class="cc-table">
              <thead><tr>
                ${colsOff.has('mes')?'':'<th>Mês/Ano</th>'}${colsOff.has('tipo')?'':'<th>Tipo</th>'}${colsOff.has('contrato')?'':'<th>Conta Contrato</th>'}${colsOff.has('leitura')?'':'<th>Leitura</th>'}${colsOff.has('consumo')?'':'<th>Consumo</th>'}<th>Valor</th><th>Vencimento</th><th>Pagamento</th><th class="cc-col-pago">Pago</th><th>Obs.</th><th></th>
              </tr></thead>
              <tbody>${tableRows || `<tr><td colspan="${11-['mes','tipo','contrato','leitura','consumo'].filter(col=>colsOff.has(col)).length}" style="text-align:center;color:var(--muted)">Nenhum lançamento${nav.ano?' em '+esc(mesesNavegaveis.find(m=>m.id===nav.mes)?.label||'')+' / '+esc(nav.ano):''}</td></tr>`}</tbody>
            </table>
          </div>
          ${mobileRows}
          <div class="cc-total-bar"><span class="ccn-mini is-total"><i aria-hidden="true">🗓️</i><span>Total do mês: ${_ccMoney(detailTotal)}</span></span><span class="ccn-mini is-paid"><i aria-hidden="true">✅</i><span>Pago: ${_ccMoney(detailPago)}</span></span><span class="ccn-mini ${detailTotal-detailPago>0.004?'is-pend':'is-zero'}"><i aria-hidden="true">${detailTotal-detailPago>0.004?'⏳':'🎉'}</i><span>Pendente: ${_ccMoney(detailTotal-detailPago)}</span></span><small class="ccn-mini-note">${detailRows.length} lançamento(s)</small></div>
        </div>
      </div>`;
    });
    const catEf = (item.extra_fields)||{};
    const catMeta = Object.entries(catEf).filter(([k,v])=>String(v==null?'':v).trim()).map(([k,v])=>`<span class="cc-badge" style="font-size:11px">${esc(k)}: ${esc(v)}</span>`).join(' ');
    const catPend = catTotal - catPago;
    if(catQtd > 0) resumoCats.push({ nome: item.description || 'Categoria', qtd: catQtd, qPago: catQPago, qPendente: catQPendente, total: catTotal, pago: catPago, pendente: catPend });
    const mostrarCategoriaVazia = item.id===nav.setor && !locais.length && paginaSolicitada===1 && !buscaTokens.length && !tipoFiltro && !anoFiltro && !pagoFiltro;
    if(!locaisHtml && !mostrarCategoriaVazia) return '';
    return `<div class="ccn-catblock">
      <div class="ccn-catblock-head">
        <div class="ccn-catblock-name">🗂️ ${_ccHighlight(item.description||'Categoria', buscaTokens)}</div>
        ${S.isAdmin?`<button class="card-btn" onclick="ccOpenCategoriaModal('${item.id}','${secId}')" title="Editar categoria">✏️</button>`:''}
        ${resumoLocalHtml}
      </div>
      ${catMeta?`<div class="ccn-catblock-meta">${catMeta}</div>`:''}
      ${locaisHtml}
      ${S.isAdmin?`<button class="btn-action ccn-soft-btn" onclick="ccOpenLocalModal(null,'${item.id}')">+ Local</button>`:''}
    </div>`;
  }).join('');

  const totalPaginas = Math.max(1, Math.ceil(quantidadeLocaisEncontrados/CC_LOCAIS_POR_PAGINA));
  if(paginaSolicitada>totalPaginas){
    _ccPaginaPorSecao.set(secId,totalPaginas);
    return renderControleContas(secId);
  }
  const primeiroLocal = quantidadeLocaisEncontrados ? inicioPagina+1 : 0;
  const ultimoLocal = Math.min(fimPagina, quantidadeLocaisEncontrados);
  const paginacaoHtml = `<div class="cc-paginacao" aria-label="Paginação dos locais">
    <div><strong>${primeiroLocal}–${ultimoLocal}</strong> de <strong>${quantidadeLocaisEncontrados}</strong> locais</div>
    <div class="cc-paginacao-acoes">
      <button class="btn-action" ${paginaSolicitada<=1?'disabled':''} onclick="ccSetPagina('${secId}',${paginaSolicitada-1})">← Anterior</button>
      <span>Página <strong>${paginaSolicitada}</strong> de ${totalPaginas}</span>
      <button class="btn-action" ${paginaSolicitada>=totalPaginas?'disabled':''} onclick="ccSetPagina('${secId}',${paginaSolicitada+1})">Próxima →</button>
    </div>
  </div>`;

  const anos = [...new Set(contasSecao.filter(c=>c.mes_ano).map(c=>String(c.mes_ano).split('/')[1]).filter(Boolean))].sort();
  const anoOptions = anos.map(a=>`<option value="${esc(a)}" ${a===anoFiltro?'selected':''}>${esc(a)}</option>`).join('');
  const tipoOptions = CC_TIPOS.map(t=>`<option value="${esc(t)}" ${t===tipoFiltro?'selected':''}>${esc(t)}</option>`).join('');
  const currentYear = String(new Date().getFullYear());

  // ── PAINEL DE VENCIMENTOS (vencidas + próximas a vencer) ──
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmtBR = d => { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const pendComData = contasSecao
    .filter(c => !c.pago && c.data_vencimento)
    .map(c => {
      const dt = new Date(c.data_vencimento+'T00:00:00');
      const dias = Math.round((dt-hoje)/86400000);
      const local = S.subitems.find(s=>s.id===c.subitem_id);
      const cat = S.items.find(i=>i.id===(local?.item_id||c.item_id));
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
  // ── PAINEL DE VIGÊNCIA DAS APÓLICES (por local/veículo) ──
  const _efGet = (ef, frag) => {
    for(const [k,v] of Object.entries(ef||{})){
      if(_ccNorm(k).includes(_ccNorm(frag))) return String(v||'').trim();
    }
    return '';
  };
  const vigItens = [];
  const idsCategorias = new Set(items.map(i=>i.id));
  S.subitems.filter(s=>s.parent_type!=='subitem' && (s.atividade_id===secId || idsCategorias.has(s.item_id))).forEach(loc=>{
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
  const nVigVencidas = vigItens.filter(x=>x.dias<0).length;
  const nVigProximas = vigItens.length - nVigVencidas;
  if(vigItens.length && !window.__ccVigAlarme){
    window.__ccVigAlarme = true;
    setTimeout(()=>toast(`🛡️ Atenção: ${nVigVencidas?nVigVencidas+' apólice(s) VENCIDA(S)':''}${nVigVencidas&&nVigProximas?' e ':''}${nVigProximas?nVigProximas+' apólice(s) vencendo em até 30 dias':''}!`,'error',7000),400);
  }

  const vencPanel=_ccVencimentosHtml(secId,{vencidas,proximas,totVencido,totProximo,vigItens,vencOrdem,nVigVencidas,nVigProximas,_efGet});

  // Ao trocar o mês, conserva os cards, o foco e todos os elementos acima da lista.
  const resultados=opcoes.somenteMes?document.getElementById('cc-month-results'):null;
  if(resultados){
    resultados.innerHTML=categoriasHtml||'<div class="empty">Nenhum item/local disponível para os filtros selecionados.</div>';
    document.querySelectorAll('[data-cc-level="mes"]').forEach(button=>{
      const active=button.dataset.ccValue===nav.mes;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    const path=document.querySelector('.cc-path');
    if(path)path.textContent=[setorAtivo?.description,localAtivo?.description,nav.tipo,nav.ano,mesesNavegaveis.find(m=>m.id===nav.mes)?.label].filter(Boolean).join(' › ');
    requestAnimationFrame(()=>window.refreshStickyTableScroll?.());
    return;
  }
  const _ccTemFiltro=!!(tipoFiltro||anoFiltro||pagoFiltro||String(buscaFiltro||'').trim());
  setC(`<div class="ccn-top">
    <div class="ccn-title">
      ${sec.cover_url?`<img src="${esc(sec.cover_url)}" alt="" class="ccn-cover">`:''}
      <div><div class="page-title">${esc(sec.name)}</div>
      <div class="page-sub">${esc(sec.observacoes||'Controle de pagamento de contas por local')}</div></div>
    </div>
    ${S.isAdmin?`<details class="gcb-menu gcb-actions ccn-admin"><summary class="btn-action gcb-tool">⚙️ Ajustes<i aria-hidden="true"></i></summary><div class="gcb-pop" role="menu"><div class="gcb-sec"><span>Controle de contas</span>
      <button type="button" class="gcb-item" onclick="ccOpenCategoriaModal(null,'${secId}')">＋ Nova categoria<small>ex.: Escolas, Unidades de saúde</small></button>
      <button type="button" class="gcb-item" onclick="openSecModal('${secId}')">✏️ Editar este controle<small>nome, descrição e campos</small></button>
      <button type="button" class="gcb-item" onclick="ccOpenColunasModal('${secId}')">🧱 Colunas da tabela<small>o que aparece em cada conta</small></button></div></div></details>`:''}
  </div>
  <div class="cc-filtros-fixas ccn-filterbar">
    <input id="cc-busca" type="search" value="${esc(buscaFiltro)}" placeholder="🔍 Buscar local, endereço, conta contrato, categoria…" oninput="ccBuscaInput('${secId}')" class="cc-busca-input" aria-label="Buscar no controle de contas">
    <div class="cc-filtros">
      <select id="cc-filtro-tipo" aria-label="Tipo de conta" onchange="ccResetPaginaERender('${secId}')"><option value="">⚡ Todos os tipos</option>${tipoOptions}</select>
      <select id="cc-filtro-ano" aria-label="Ano" onchange="ccResetPaginaERender('${secId}')"><option value="">📅 Todos os anos</option>${anoOptions}</select>
      <select id="cc-filtro-pago" aria-label="Situação" onchange="ccResetPaginaERender('${secId}')"><option value="">● Pagas e pendentes</option><option value="pago" ${pagoFiltro==='pago'?'selected':''}>✅ Só pagas</option><option value="pendente" ${pagoFiltro==='pendente'?'selected':''}>⏳ Só pendentes</option></select>
      ${_ccTemFiltro?`<button class="btn-action ccn-clear" onclick="document.getElementById('cc-busca').value='';document.getElementById('cc-filtro-tipo').value='';document.getElementById('cc-filtro-ano').value='';document.getElementById('cc-filtro-pago').value='';ccResetPaginaERender('${secId}')">✕ Limpar filtros</button>`:''}
      <button class="btn-action ccn-pdf" onclick="ccOpenPdfOpts('${secId}')">📄 PDF${_ccTemFiltro?' (filtrado)':''}</button>
    </div>
  </div>
  <nav class="cc-workspace-tabs" aria-label="Áreas do controle de contas">
    <button class="cc-workspace-tab ${modo==='resumo'?'active':''}" onclick="ccSetModo('${secId}','resumo')">📊 Visão geral</button>
    <button class="cc-workspace-tab ${modo==='lancamentos'?'active':''}" onclick="ccSetModo('${secId}','lancamentos')">🧾 Lançamentos <span>${qtdTotal}</span></button>
    <button class="cc-workspace-tab ${modo==='vencimentos'?'active':''}" onclick="ccSetModo('${secId}','vencimentos')">⏰ Vencimentos <span>${linhas.length+vigItens.length}</span></button>
    <button class="cc-workspace-tab ${modo==='relatorio'?'active':''}" onclick="ccSetModo('${secId}','relatorio')">📑 Relatório por secretaria</button>
    <button class="cc-workspace-tab ${modo==='cadastro'?'active':''}" onclick="ccSetModo('${secId}','cadastro')">🏢 Cadastro dos locais</button>
  </nav>
  <section class="cc-workspace-panel" ${modo==='resumo'?'':'hidden'}>
  ${_ccOverviewHtml(secId,{totalGeral,totalPago,totalPendente,qtdTotal,qtdPago,qtdPendente,resumoCats,tipoMap,locaisResumo,vencidas,proximas,totVencido,totProximo,vigItens,tipoFiltro,anoFiltro,pagoFiltro,buscaFiltro:String(buscaFiltro||'').trim()})}
  </section>
  <section class="cc-workspace-panel cc-cadastro-panel" ${modo==='cadastro'?'':'hidden'}>${modo==='cadastro'?(window.ccCadastroHtml?.(secId)||''):''}</section>
  <section class="cc-workspace-panel cc-relatorio-panel" ${modo==='relatorio'?'':'hidden'}>${modo==='relatorio'?(window.ccRelatorioHtml?.(secId)||''):''}</section>
  <section class="cc-workspace-panel cc-venc-panel" ${modo==='vencimentos'?'':'hidden'}>${vencPanel}</section>
  <section class="cc-workspace-panel cc-month-workspace" ${modo==='lancamentos'?'':'hidden'}>
  ${navegacaoHtml}
  <div id="cc-month-results">${categoriasHtml || '<div class="empty">Nenhum item/local disponível para os filtros selecionados.</div>'}</div>
  ${quantidadeLocaisEncontrados>CC_LOCAIS_POR_PAGINA?paginacaoHtml:''}
  </section>`);
  document.querySelectorAll('[data-cc-level]').forEach(button=>button.onclick=()=>ccNavegar(secId,button.dataset.ccLevel,button.dataset.ccValue));
  requestAnimationFrame(()=>window.ccOverviewEnhance?.(document.getElementById('content')||document));
};


// ── VENCIMENTOS com neuroarquitetura: situação em frase, grupos por urgência (vencidas → esta semana → 30 dias),
// cada conta numa linha clara com ação direta ("✓ Marcar paga"), apólices com WhatsApp e "Renovado".
function _ccVencimentosHtml(secId, d){
  const ord=list=>d.vencOrdem==='desc'?[...list].reverse():list;
  const late=d.vencidas, semana=d.proximas.filter(x=>x.dias<=7), mes=d.proximas.filter(x=>x.dias>7);
  const sum=l=>l.reduce((a,x)=>a+(parseFloat(x.c.valor)||0),0);
  const nVig=d.vigItens.length;
  let mood='done',titulo='Tudo tranquilo por aqui 🌿',frase='Nenhuma conta vence nos próximos 30 dias e nenhuma está atrasada.';
  if(late.length){mood='alert';titulo=`${late.length} conta${late.length>1?'s':''} vencida${late.length>1?'s':''} · ${_ccMoney(d.totVencido)}`;frase=`Comece pela mais antiga (${late[0].localNome}, há ${-late[0].dias} dia${-late[0].dias>1?'s':''}).${semana.length?` Depois, ${semana.length} vence${semana.length>1?'m':''} ainda esta semana.`:''}`;}
  else if(semana.length){mood='focus';titulo=`${semana.length} conta${semana.length>1?'s':''} vence${semana.length>1?'m':''} esta semana`;frase=`${_ccMoney(sum(semana))} para pagar nos próximos 7 dias. Nada atrasado — ótimo!`;}
  else if(mes.length){mood='calm';titulo=`Nada atrasado ✨`;frase=`${mes.length} conta${mes.length>1?'s':''} vence${mes.length>1?'m':''} nos próximos 30 dias (${_ccMoney(sum(mes))}). Dá para se planejar com calma.`;}
  if(nVig&&mood==='done'){mood='focus';titulo=`${nVig} apólice${nVig>1?'s':''} precisa${nVig>1?'m':''} de renovação`;frase='As contas estão em dia; só falta cuidar do seguro abaixo.';}
  const kpi=(cls,icon,label,val,sub)=>`<div class="ccn-kpi ${cls}" title="${esc(label)}: ${esc(val)}"><span class="ccn-kpi-ico" aria-hidden="true">${icon}</span><div class="ccn-kpi-body"><span class="ccn-kpi-lbl">${label}</span><b class="ccn-kpi-val">${esc(val)}</b><small>${sub}</small></div></div>`;
  const kpis=`<div class="ccn-kpis">
    ${kpi(late.length?'is-late':'is-zero','🔴','Vencidas',late.length?_ccMoney(d.totVencido):'Nenhuma',late.length?`${late.length} conta(s) em atraso`:'continue assim')}
    ${kpi(semana.length?'is-pend':'is-zero','🟠','Esta semana',semana.length?_ccMoney(sum(semana)):'Nada',semana.length?`${semana.length} conta(s) em até 7 dias`:'semana livre')}
    ${kpi(mes.length?'is-total':'is-zero','🗓️','Próximos 30 dias',mes.length?_ccMoney(sum(mes)):'Nada',mes.length?`${mes.length} conta(s)`:'sem vencimentos')}
    ${kpi(d.nVigVencidas?'is-late':nVig?'is-pend':'is-zero','🛡️','Apólices',nVig?String(nVig):'Em dia',nVig?`${d.nVigVencidas?d.nVigVencidas+' vencida(s) · ':''}${d.nVigProximas} a vencer`:'nenhuma a renovar')}
  </div>`;
  const row=(x,tone)=>{const [y,m,dd]=x.c.data_vencimento.split('-');const quando=x.dias<0?`há ${-x.dias} dia${-x.dias>1?'s':''}`:x.dias===0?'vence hoje':x.dias===1?'vence amanhã':`em ${x.dias} dias`;
    return `<div class="ccv-row ${tone}"><span class="ccv-date" title="Vencimento ${dd}/${m}/${y}"><b>${dd}/${m}</b><small>${y}</small></span>
      <span class="ccv-main"><b>${esc(x.localNome)}</b><small>${esc([x.catNome,x.c.tipo,x.c.mes_ano].filter(Boolean).join(' · '))}</small></span>
      <span class="ccv-when">${quando}</span><span class="ccv-val">${_ccMoney(x.c.valor)}</span>
      <span class="ccv-acts"><button type="button" class="ccv-pay" onclick="ccPagarRapido('${x.c.id}')" title="Marcar como paga hoje">✓ Marcar paga</button><button type="button" class="ccv-edit" onclick="ccOpenLancamentoModal('${x.c.id}','${x.c.subitem_id}')" title="Abrir o lançamento" aria-label="Editar lançamento">✏️</button></span></div>`;};
  const group=(list,tone,icon,title,hint)=>list.length?`<section class="ccn-card ccv-group ${tone}"><header class="ccn-head"><h3>${icon} ${title}</h3><small>${list.length} conta(s) · ${_ccMoney(sum(list))}${hint?' · '+hint:''}</small></header><div class="ccv-list">${ord(list).map(x=>row(x,tone)).join('')}</div></section>`:'';
  const porCat={};[...late,...d.proximas].forEach(x=>{const k=x.catNome||'Sem categoria';(porCat[k]??={q:0,v:0});porCat[k].q++;porCat[k].v+=parseFloat(x.c.valor)||0;});
  const chips=Object.keys(porCat).length>1?`<div class="ccv-chips" aria-label="Por categoria">${Object.entries(porCat).sort((a,b)=>b[1].v-a[1].v).map(([k,v])=>`<span class="ccv-chip"><b>${esc(k)}</b> ${v.q} · ${_ccMoney(v.v)}</span>`).join('')}</div>`:'';
  const vig=nVig?`<section class="ccn-card ccv-group is-vig"><header class="ccn-head"><h3>🛡️ Vigência das apólices</h3><small>${d.nVigVencidas?d.nVigVencidas+' vencida(s) · ':''}${d.nVigProximas} vencendo em até 30 dias</small></header><div class="ccv-list">${d.vigItens.map(x=>{
      const tone=x.dias<0||x.dias===0?'is-late':x.dias<=15?'is-week':'is-month';
      const quando=x.dias<0?`venceu há ${-x.dias} dia${-x.dias>1?'s':''}`:x.dias===0?'vence hoje':`vence em ${x.dias} dias`;
      const placa=d._efGet(x.loc.extra_fields,'PLACA');
      const msg=encodeURIComponent(`⚠️ ALERTA DE SEGURO — ${x.loc.description}${placa?` (placa ${placa})`:''}: a vigência da apólice ${x.dias<0?`VENCEU há ${-x.dias} dia(s)`:x.dias===0?'VENCE HOJE':`vence em ${x.dias} dia(s)`} (${x.fimStr}). Favor providenciar a renovação.`);
      const [dd,mm,yy]=x.fimStr.split('/');
      return `<div class="ccv-row ${tone}"><span class="ccv-date"><b>${dd}/${mm}</b><small>${yy}</small></span><span class="ccv-main"><b>${esc(x.loc.description)}</b><small>${x.resp?'Responsável: '+esc(x.resp):'Sem responsável — edite o local e preencha RESPONSÁVEL e WHATSAPP'}</small></span><span class="ccv-when">${quando}</span>
        <span class="ccv-acts">${x.zap?`<a class="ccv-zap" target="_blank" rel="noopener" href="https://wa.me/${x.zap.length<=11?'55'+x.zap:x.zap}?text=${msg}">📱 Avisar${x.resp?' '+esc(x.resp.split(' ')[0]):''}</a>`:''}${S.isAdmin?`<button type="button" class="ccv-pay" onclick="ccOpenRenovarModal('${x.loc.id}')">✅ Renovado</button>`:''}</span></div>`;}).join('')}</div></section>`:'';
  const nada=!late.length&&!d.proximas.length;
  return `<div class="ccn">
    <section class="ccn-hero ccn-hero-sm is-${mood}"><div class="ccn-hero-txt"><span class="ccn-hello">⏰ Vencimentos</span><h2>${esc(titulo)}</h2><p>${esc(frase)}</p></div>
      ${nada?'':`<label class="ccv-order">Ordem<select id="cc-venc-ordem" onchange="renderControleContas('${secId}')"><option value="asc" ${d.vencOrdem==='asc'?'selected':''}>Mais antiga primeiro</option><option value="desc" ${d.vencOrdem==='desc'?'selected':''}>Mais recente primeiro</option></select></label>`}</section>
    ${kpis}${chips}
    ${group(late,'is-late','🔴','Vencidas','comece por aqui')}
    ${group(semana,'is-week','🟠','Vencem esta semana','')}
    ${group(mes,'is-month','🗓️','Próximos 30 dias','')}
    ${vig}
    ${nada&&!nVig?'<p class="ccn-note ccv-empty">🌿 Nenhum vencimento ou apólice exige atenção neste momento. Aproveite!</p>':''}
  </div>`;
}
window.ccPagarRapido = async function(id){
  const c=S.contas.find(x=>x.id===id); if(!c) return;
  const hoje=new Date(), iso=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  const data={pago:true,updated_at:serverTimestamp()}; if(!c.data_pagamento) data.data_pagamento=iso;
  await updateDoc(doc(db,'contas',id),data);
  await loadData(); renderControleContas(c.atividade_id);
  toast('✓ Conta marcada como paga. Uma a menos!','success',2500);
};

// ── VISÃO GERAL com neuroarquitetura (regra do usuário, 23/11/2026) ──
// Acolhimento (saudação + situação em linguagem humana), progresso visível (anel), "portas" para cada tarefa,
// números que NUNCA saem do card (container queries + valor completo no title), cores calmas (azul/verde =
// confiança/tranquilidade; âmbar = atenção; vermelho só quando existe problema de verdade), revelação
// progressiva (detalhamento recolhível com busca própria) e microinterações suaves (respeitam reduzir movimento).
const _ccMoney = v => 'R$ ' + (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const _ccShort = v => { const n=Number(v)||0, a=Math.abs(n); if(a>=1e6) return 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi'; if(a>=1e4) return 'R$ '+(n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil'; return _ccMoney(n); };
// peças visuais compartilhadas com as outras abas (js/contas-relatorio.js)
window.ccnMoney = v => _ccMoney(v);
window.ccnRing = (pct, sub='pago') => {const p=Math.max(0,Math.min(100,Number(pct)||0)),txt=(p>=100?100:Math.min(99.9,Math.round(p*10)/10)).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%',r=44,c=2*Math.PI*r,off=c*(1-p/100);return `<svg class="ccn-ring" viewBox="0 0 100 100" role="img" aria-label="${txt} ${esc(sub)}"><circle class="ccn-ring-bg" cx="50" cy="50" r="${r}"/><circle class="ccn-ring-fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="--ccn-c:${c.toFixed(1)}"/><text x="50" y="49" text-anchor="middle" class="ccn-ring-pct">${esc(txt)}</text><text x="50" y="64" text-anchor="middle" class="ccn-ring-sub">${esc(sub)}</text></svg>`;};
window.ccnKpi = (cls,icon,label,val,sub='') => `<div class="ccn-kpi ${cls}" title="${esc(label)}: ${esc(val)}"><span class="ccn-kpi-ico" aria-hidden="true">${icon}</span><div class="ccn-kpi-body"><span class="ccn-kpi-lbl">${esc(label)}</span><b class="ccn-kpi-val">${esc(val)}</b>${sub?`<small>${sub}</small>`:''}</div></div>`;
function _ccGreeting(){ const h=new Date().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }
function _ccOverviewHtml(secId, d){
  const nome=String(S.me?.display_name||S.me?.nome||'').trim().split(/\s+/)[0]||'';
  const pct=d.totalGeral?(d.totalPago>=d.totalGeral?100:Math.min(99.9,Math.round(d.totalPago/d.totalGeral*1000)/10)):0;
  const pctTxt=(Math.round(pct*10)/10).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  const filtros=[d.tipoFiltro,d.anoFiltro,d.pagoFiltro==='pago'?'pagas':d.pagoFiltro==='pendente'?'pendentes':'',d.buscaFiltro&&`“${d.buscaFiltro}”`].filter(Boolean);
  const escopo=filtros.length?`Mostrando: ${filtros.map(esc).join(' · ')}`:'Todas as contas lançadas';
  const nVenc=d.vencidas.length, nProx=d.proximas.length, nVig=d.vigItens.length;
  let mood='calm', titulo, frase;
  if(!d.qtdTotal){ titulo='Vamos começar?'; frase='Ainda não há contas lançadas aqui. Abra “Lançamentos” para registrar a primeira.'; mood='calm'; }
  else if(nVenc){ mood='alert'; titulo=`${nVenc} conta${nVenc>1?'s':''} vencida${nVenc>1?'s':''} pede${nVenc>1?'m':''} sua atenção`; frase=`${_ccMoney(d.totVencido)} em atraso. Resolva primeiro estas e o restante segue tranquilo.`; }
  else if(d.qtdPendente){ mood='focus'; titulo=`Faltam ${d.qtdPendente} conta${d.qtdPendente>1?'s':''} para fechar 100%`; frase=`${_ccMoney(d.totalPendente)} ainda a pagar${nProx?` · ${nProx} vence${nProx>1?'m':''} nos próximos 30 dias`:''}. Você já concluiu ${pctTxt} do valor.`; }
  else { mood='done'; titulo='Tudo em dia ✨'; frase=`Todas as ${d.qtdTotal.toLocaleString('pt-BR')} contas estão pagas — ${_ccMoney(d.totalPago)}. Excelente trabalho!`; }
  const ring=(()=>{const r=44,c=2*Math.PI*r,off=c*(1-Math.min(100,pct)/100);return `<svg class="ccn-ring" viewBox="0 0 100 100" role="img" aria-label="${pctTxt} do valor já pago"><circle class="ccn-ring-bg" cx="50" cy="50" r="${r}"/><circle class="ccn-ring-fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="--ccn-c:${c.toFixed(1)}"/><text x="50" y="49" text-anchor="middle" class="ccn-ring-pct">${esc(pctTxt)}</text><text x="50" y="64" text-anchor="middle" class="ccn-ring-sub">pago</text></svg>`;})();
  const go=(modo,icon,label,sub,tone='')=>`<button type="button" class="ccn-door ${tone}" onclick="ccSetModo('${secId}','${modo}')"><span class="ccn-door-ico" aria-hidden="true">${icon}</span><span class="ccn-door-txt"><b>${label}</b><small>${sub}</small></span><span class="ccn-door-go" aria-hidden="true">→</span></button>`;
  const doors=`<div class="ccn-doors" role="navigation" aria-label="O que você quer fazer?">
    ${go('lancamentos','🧾','Lançar e conferir contas',`${d.qtdTotal.toLocaleString('pt-BR')} lançamento(s) por local e mês`)}
    ${go('vencimentos','⏰','Vencimentos',nVenc||nProx||nVig?`${nVenc?nVenc+' vencida(s) · ':''}${nProx} nos próximos 30 dias${nVig?` · ${nVig} apólice(s)`:''}`:'Nada vencendo — tudo tranquilo',nVenc?'is-alert':nProx?'is-focus':'')}
    ${go('relatorio','📑','Relatório por secretaria','Mês a mês, com totais e PDF')}
    ${go('cadastro','🏢','Cadastro dos locais','Conta contrato, relógio, endereço')}
  </div>`;
  const kpi=(cls,icon,label,full,short,sub)=>`<div class="ccn-kpi ${cls}" title="${esc(label)}: ${esc(full)}"><span class="ccn-kpi-ico" aria-hidden="true">${icon}</span><div class="ccn-kpi-body"><span class="ccn-kpi-lbl">${label}</span><b class="ccn-kpi-val" data-full="${esc(full)}">${esc(short)}</b>${sub?`<small>${sub}</small>`:''}</div></div>`;
  const kpis=`<div class="ccn-kpis">
    ${kpi('is-total','💰','Total em contas',_ccMoney(d.totalGeral),_ccMoney(d.totalGeral),`${d.qtdTotal.toLocaleString('pt-BR')} conta(s)`)}
    ${kpi('is-paid','✅','Pago',_ccMoney(d.totalPago),_ccMoney(d.totalPago),`${d.qtdPago.toLocaleString('pt-BR')} conta(s) · ${pctTxt}`)}
    ${kpi(d.totalPendente?'is-pend':'is-zero','⏳','Pendente',_ccMoney(d.totalPendente),_ccMoney(d.totalPendente),d.qtdPendente?`${d.qtdPendente.toLocaleString('pt-BR')} conta(s)`:'nada pendente 🎉')}
    ${kpi(nVenc?'is-late':'is-zero','⏰','Vencidas',_ccMoney(d.totVencido),nVenc?_ccMoney(d.totVencido):'Nenhuma',nVenc?`${nVenc} conta(s) em atraso`:'continue assim')}
  </div>`;
  const maxCat=Math.max(1,...d.resumoCats.map(c=>c.total));
  const cats=d.resumoCats.length?`<section class="ccn-card"><header class="ccn-head"><h3>🗂️ Onde está o dinheiro</h3><small>Por categoria · toque para ver os lançamentos</small></header>
    <div class="ccn-cats">${[...d.resumoCats].sort((a,b)=>b.total-a.total).map(c=>{const p=c.total?Math.round(c.pago/c.total*100):0,share=Math.round(c.total/maxCat*100);return `<button type="button" class="ccn-cat" onclick="ccFiltrarCategoria('${secId}',${JSON.stringify(String(c.nome)).replace(/"/g,'&quot;')})" title="${esc(c.nome)}: ${_ccMoney(c.total)} (${p}% pago)">
      <span class="ccn-cat-top"><b>${esc(c.nome)}</b><em class="${p===100?'ok':p>=80?'mid':'low'}">${p===100?'✓ ':''}${p}% pago</em></span>
      <span class="ccn-cat-val">${_ccMoney(c.total)}</span>
      <span class="ccn-bar" aria-hidden="true"><i style="width:${share}%"><s style="width:${p}%"></s></i></span>
      <small>${c.qPago} de ${c.qtd} pagas${c.pendente>0?` · falta ${_ccMoney(c.pendente)}`:''}</small></button>`;}).join('')}</div></section>`:'';
  const tipos=Object.entries(d.tipoMap).sort((a,b)=>b[1].total-a[1].total);
  const tiposHtml=tipos.length>1||tipos.length&&tipos[0][1].qtd!==d.qtdTotal?`<section class="ccn-card"><header class="ccn-head"><h3>⚡ Por tipo de conta</h3></header><div class="ccn-types">${tipos.map(([t,v])=>{const p=v.total?Math.round(v.pago/v.total*100):0;return `<div class="ccn-type"><span><b>${esc(t)}</b><small>${v.qtd} lanç.</small></span><span class="ccn-bar" aria-hidden="true"><i style="width:${Math.round(v.total/(tipos[0][1].total||1)*100)}%"><s style="width:${p}%"></s></i></span><span class="ccn-type-val">${_ccMoney(v.total)}<small>${p}% pago</small></span></div>`;}).join('')}</div></section>`:(tipos.length?`<p class="ccn-note">⚡ Todas as contas são do tipo <b>${esc(tipos[0][0])}</b>.</p>`:'');
  // detalhamento por local: agrupado por categoria (sem repetir o nome), busca própria, zeros discretos
  const grupos={};d.locaisResumo.forEach(l=>{(grupos[l.categoria]??=[]).push(l);});
  const z=(v,txt,cls)=>v?`<td class="${cls}">${txt}</td>`:`<td class="ccn-zero">—</td>`;
  const det=d.locaisResumo.length?`<details class="ccn-card ccn-detail" ${d.buscaFiltro?'open':''}><summary class="ccn-head"><h3>📋 Detalhamento por local</h3><small>${d.locaisResumo.length} locais · toque para abrir</small></summary>
    <div class="ccn-detail-tools"><input type="search" class="ccn-detail-search" placeholder="🔍 Filtrar locais nesta tabela…" oninput="ccFiltrarDetalhe(this)" aria-label="Filtrar locais"></div>
    <div class="cc-table-wrap ccn-table-wrap"><table class="cc-table ccn-table"><thead><tr><th>Local</th><th class="n">Lanç.</th><th class="n">Pagas</th><th class="n">Pendentes</th><th class="m">Total</th><th class="m">Pago</th><th class="m">Pendente</th></tr></thead>
    ${Object.entries(grupos).map(([cat,ls])=>{const t=ls.reduce((a,l)=>({q:a.q+l.qtd,qp:a.qp+l.qPago,v:a.v+l.total,p:a.p+l.pago,pe:a.pe+l.pendente}),{q:0,qp:0,v:0,p:0,pe:0});return `<tbody class="ccn-group"><tr class="ccn-cat-row"><th colspan="4" scope="rowgroup">${esc(cat)} <small>${ls.length} local(is)</small></th><td class="m">${_ccMoney(t.v)}</td><td class="m ok">${_ccMoney(t.p)}</td>${z(t.pe,_ccMoney(t.pe),'m bad')}</tr>${ls.map(l=>`<tr data-q="${esc(_ccNorm(l.local+' '+cat))}"><td>${esc(l.local)}</td><td class="n">${l.qtd}</td><td class="n ok">${l.qPago}</td>${z(l.qtd-l.qPago,l.qtd-l.qPago,'n bad')}<td class="m strong">${_ccMoney(l.total)}</td><td class="m ok">${_ccMoney(l.pago)}</td>${z(l.pendente,_ccMoney(l.pendente),'m bad')}</tr>`).join('')}</tbody>`;}).join('')}
    <tfoot><tr><td>TOTAL GERAL</td><td class="n">${d.qtdTotal}</td><td class="n">${d.qtdPago}</td><td class="n">${d.qtdPendente||'—'}</td><td class="m">${_ccMoney(d.totalGeral)}</td><td class="m">${_ccMoney(d.totalPago)}</td><td class="m">${d.totalPendente?_ccMoney(d.totalPendente):'—'}</td></tr></tfoot></table></div></details>`:'';
  return `<div class="ccn">
    <section class="ccn-hero is-${mood}">
      <div class="ccn-hero-txt"><span class="ccn-hello">${_ccGreeting()}${nome?', '+esc(nome):''} 👋</span><h2>${esc(titulo)}</h2><p>${esc(frase)}</p>
        ${nVenc?`<button type="button" class="ccn-cta" onclick="ccSetModo('${secId}','vencimentos')">Ver vencidas agora →</button>`:''}<small class="ccn-scope">${escopo}</small></div>
      <div class="ccn-hero-ring">${ring}</div>
    </section>
    ${kpis}
    ${doors}
    ${cats}
    ${tiposHtml}
    ${det}
  </div>`;
}
window.ccFiltrarCategoria = function(secId, nome){
  const inp=document.getElementById('cc-busca'); if(inp) inp.value=nome;
  _ccPaginaPorSecao.set(secId,1); _ccModoPorSecao.set(secId,'lancamentos'); renderControleContas(secId);
  window.toast?.(`Mostrando os lançamentos de “${nome}”. Use “Limpar” para ver tudo.`,'success',3500);
};
window.ccFiltrarDetalhe = function(input){
  const t=_ccNorm(input.value).split(/\s+/).filter(Boolean);const table=input.closest('.ccn-detail')?.querySelector('table');if(!table)return;
  table.querySelectorAll('tbody.ccn-group').forEach(g=>{let any=false;g.querySelectorAll('tr[data-q]').forEach(r=>{const ok=!t.length||t.every(k=>r.dataset.q.includes(k));r.hidden=!ok;any=any||ok;});g.hidden=!any;});
};
// números animados (contagem suave) e encaixe do valor no card — nunca vaza
window.ccOverviewEnhance = function(root=document){
  if(typeof root?.querySelectorAll!=='function')return;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('.ccn-kpi-val,.ccn-cat-val,.ccn-fit').forEach(el=>{
    // encaixe: diminui a letra até o valor caber inteiro no card (e refaz quando o card muda de tamanho)
    const fit=()=>{el.style.fontSize='';let size=parseFloat(getComputedStyle(el).fontSize)||22;while(el.scrollWidth>el.clientWidth+1&&size>11){size-=0.5;el.style.fontSize=size+'px';}};
    el.__ccnFit=fit;fit();
    if(!el.__ccnRO&&typeof ResizeObserver!=='undefined'){el.__ccnRO=new ResizeObserver(()=>el.__ccnFit());el.__ccnRO.observe(el.parentElement);}
    if(!reduce&&el.classList.contains('ccn-kpi-val')&&/^R\$/.test(el.textContent)&&!el.dataset.counted){el.dataset.counted='1';const full=el.textContent,target=Number(full.replace(/[^\d,]/g,'').replace(',','.'))||0;if(!target)return;const t0=performance.now();const tick=now=>{const k=Math.min(1,(now-t0)/700),e=1-Math.pow(1-k,3);el.textContent=_ccMoney(target*e);if(k<1)requestAnimationFrame(tick);else{el.textContent=full;fit();}};requestAnimationFrame(tick);}
  });
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
  const _intKeys = window.cadastroLinks?.INTERNAL || [];
  // Local ligado: o formulário mostra TODOS os dados do cadastro (o coração) + os do controle.
  const _baseEf = local && window.cadastroLinks?.cad(local) ? window.cadastroLinks.fields(local) : (local ? (local.extra_fields||{}) : {});
  const ef = Object.fromEntries(Object.entries(_baseEf).filter(([k])=>!_intKeys.includes(k) && !/^(item_show_|show_)/.test(k)));
  const _kind = window.cadastroLinks ? window.cadastroLinks.kindOf(curSecId) : 'locais';
  const _livres = !id && window.cadastroLinks ? window.cadastroLinks.freeLocais(_kind) : [];
  const _cadBox = window.cadastroLinks?.cad(local)
    ? `<div class="form-group full"><div class="cc-cad-link-info">🔗 Ligado ao cadastro <b>${esc(window.cadastroLinks.groupName(window.cadastroLinks?.cad(local).atividade_id)||'Cadastros')}</b> · o nome é o do cadastro e, se mudar aqui, muda lá também. <button type="button" class="btn-action" style="font-size:12px;padding:4px 10px;margin-left:6px" onclick="closeModal();openActivity('${window.cadastroLinks.cad(local).atividade_id}')">Abrir no cadastro ↗</button>${window.cadastroLinks?.ownName(local)&&window.cadastroLinks?.ownName(local)!==local.description?` <span>Outro nome: ${esc(window.cadastroLinks?.ownName(local))}</span>`:''}</div></div>`
    : (!id ? `<div class="form-group full"><label>${_kind==='veiculos'?'Puxar do cadastro da frota (veículos e máquinas)':'Puxar do cadastro de estabelecimentos'}</label><select id="cc-local-cad" onchange="ccEscolherDoCadastro(this)"><option value="">— ${_kind==='veiculos'?'Veículo novo (será criado também no cadastro da frota da secretaria)':'Novo estabelecimento (será criado também em Cadastros › PRÉDIOS E LOCAIS PÚBLICOS)'} —</option>${_livres.map(i=>`<option value="${esc(i.id)}">${esc(i.description)} · ${esc(window.cadastroLinks.groupName(i.atividade_id))}</option>`).join('')}</select></div>` : '');
  const standardKeys = ['Local','Número do Relógio','Conta Contrato','Endereço','Medidor','RESPONSÁVEL','WHATSAPP DO RESPONSÁVEL'];
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
      ${_cadBox}
      <div class="form-group full"><label>Nome do Local *</label><input id="cc-local-name" value="${esc(local?.description||'')}"></div>
      <div class="form-group full" style="display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:4px">
        <label>Campos do local</label>
        <button class="btn-action" style="font-size:12px;padding:5px 10px" type="button" onclick="ccAddLocalField()">+ Adicionar campo</button>
      </div>
      <div class="cc-fields-container" style="display:contents">${fieldsHtml}</div>
    </div>
    <div class="modal-actions">${id?`<button class="btn-cancel" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="ccDeleteLocal('${id}','${itemId}')">🗑️ Excluir</button>`:''}<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ccSaveLocal('${id||''}','${itemId}')">💾 Salvar</button></div>`);
};

window.ccEscolherDoCadastro = function(sel){
  const it = S.items.find(i=>i.id===sel.value), input = document.getElementById('cc-local-name');
  if(it && input) input.value = it.description||'';
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
  // Campos internos de ligação com o cadastro nunca se perdem ao editar.
  const oldEf = local ? (local.extra_fields||{}) : {};
  for(const k of (window.cadastroLinks?.INTERNAL||[]).concat(['Outro nome'])) if(oldEf[k]!==undefined && newEf[k]===undefined) newEf[k]=oldEf[k];
  const data = {description:name, item_id:itemId, parent_type: local?.parent_type || 'item', concluded:0, extra_fields:newEf, updated_at:serverTimestamp()};
  const cadEf = it => ({...((it&&it.extra_fields)||{})});
  try{
    if(id){
      await updateDoc(doc(db,'subitems',id),data);
      // O cadastro é o coração: tudo o que foi preenchido aqui também fica gravado lá.
      if(window.cadastroLinks?.cad(local)){
        const toCad = Object.fromEntries(Object.entries(newEf).filter(([k,v])=>!(window.cadastroLinks.INTERNAL||[]).includes(k) && k!=='Outro nome' && !/^(item_show_|show_)/.test(k) && String(v??'').trim()!==''));
        if(Object.keys(toCad).length) await _ccSyncCadastro(local, toCad);
      }
      // Nome igual nos dois lugares: renomear aqui renomeia o cadastro.
      if(window.cadastroLinks?.cad(local) && window.cadastroLinks?.cad(local).description!==name) await updateDoc(doc(db,'items',window.cadastroLinks?.cad(local).id),{description:name,updated_at:serverTimestamp()});
    } else {
      data.order_num = S.subitems.filter(s=>s.item_id===itemId).length; data.created_at=serverTimestamp();
      let cad = S.items.find(i=>i.id===document.getElementById('cc-local-cad')?.value);
      if(!cad && window.cadastroLinks){
        // Local novo no Controle de Contas = estabelecimento novo no cadastro (sem duplicar).
        const kind = window.cadastroLinks.kindOf(curSecId), cat = S.items.find(i=>i.id===itemId), grupo = window.cadastroLinks.groupForCategory(cat?.description||'', kind);
        const same = window.cadastroLinks.findDuplicate(kind, name, newEf);
        if(same) cad = same;
        else {
          const efCad = {...Object.fromEntries(Object.entries(newEf).filter(([k])=>!(window.cadastroLinks.INTERNAL).includes(k))), Origem:'Controle de Contas'};
          if(kind==='locais' && cat?.description && !Object.keys(efCad).some(k=>_ccNorm(k).includes('UNIDADE VINCULADA'))) efCad['Unidade Vinculada']=cat.description;
          const ref = await addDoc(collection(db,'items'),{atividade_id:grupo,description:name,observacao:'',responsaveis:'',item_icon:kind==='veiculos'?'🚗':'🏢',item_color:'#0f766e',concluded:0,status:'pendente',order_num:S.items.filter(i=>i.atividade_id===grupo).length,extra_fields:efCad,created_at:serverTimestamp(),updated_at:serverTimestamp()});
          cad = {id:ref.id, atividade_id:grupo, description:name, extra_fields:efCad};
        }
      }
      if(cad){ data.description = name; data.extra_fields = {...newEf, cadastro_id:cad.id, cadastro_grupo:cad.atividade_id}; }
      const novo = await addDoc(collection(db,'subitems'),data);
      if(cad && novo?.id) await updateDoc(doc(db,'items',cad.id),{extra_fields:{...cadEf(cad), contas_local_id:novo.id},updated_at:serverTimestamp()});
    }
  }catch(e){ toast('Não foi possível salvar o local: '+(e.message||e),'error',8000); return; }
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
  const tipoOpts = `<option value="">-- Selecionar --</option>`+CC_TIPOS.map(t=>`<option value="${esc(t)}" ${c?.tipo===t?'selected':''}>${esc(t)}</option>`).join('');
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
  if(!mes){toast('Mês/Ano é obrigatório','error');return;}
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

// O que muda no controle e também é dado do cadastro (conta contrato, vigência…) é gravado nos dois.
async function _ccSyncCadastro(loc, patch){
  const cad = window.cadastroLinks?.cad(loc); if(!cad) return;
  const ef = {...(cad.extra_fields||{})};
  for(const [k,v] of Object.entries(patch)){ const key = _ccFindKey(ef, k) || k; ef[key] = v; }
  try{ await updateDoc(doc(db,'items',cad.id), { extra_fields: ef, updated_at: serverTimestamp() }); }catch(e){ console.warn('Cadastro não atualizado:', e?.message||e); }
}

// Conta Contrato pertence ao cadastro do LOCAL (compartilhado por todos os
// lancamentos daquele local), entao a edicao inline salva no subitem.
window.ccSalvarContaContratoLocal = async function(localId, valor){
  const local = S.subitems.find(s=>s.id===localId);
  if(!local) return;
  const ef = { ...(local.extra_fields||{}) };
  const chave = _ccFindKey(ef, 'CONTA CONTRATO') || _ccFindKey(ef, 'CONTRATO') || 'Conta Contrato';
  ef[chave] = valor;
  await updateDoc(doc(db,'subitems',localId), { extra_fields: ef, updated_at: serverTimestamp() });
  await _ccSyncCadastro(local, {'Conta Contrato': valor});
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
  await _ccSyncCadastro(loc, anterior ? {[chave]: ef[chave], 'VIGÊNCIA ANTERIOR': anterior} : {[chave]: ef[chave]});
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
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); (window.safePdf||(d=>d))(doc);
  const W=297, mx=12, cw=W-mx*2;
  const fmtMoney=v=>parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const fmtPdfD=d=>d?fmtD(d):'-';
  const sf=(sz,bold,clr)=>{doc.setFontSize(sz||9);doc.setFont('helvetica',bold?'bold':'normal');const c=clr||[26,32,44];doc.setTextColor(c[0],c[1],c[2]);};
  const now = new Date().toLocaleDateString('pt-BR');
  const P = window.ccnPdf, H = 210;
  let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch(e) { /* sem logo */ }
  const filtros=[];
  if(opts.busca) filtros.push('Busca: "'+opts.busca+'"');
  if(opts.tipo) filtros.push('Tipo: '+opts.tipo);
  if(opts.ano) filtros.push('Ano: '+opts.ano); else filtros.push('Todos os anos');
  if(opts.pago==='pago') filtros.push('Apenas contas pagas');
  if(opts.pago==='pendente') filtros.push('Apenas contas pendentes');
  const hojeIso = (()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})();
  let qtdVencidas=0, totVencido=0;
  let totalGeral=0, totalPago=0, qtdPago=0, qtdTotal=0;
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
        totalGeral+=v; qtdTotal++; catTotal+=v; catQtd++; locTotal+=v; locQtd++;
        if(c.pago){ totalPago+=v; qtdPago++; catPago+=v; locPago++; }
        else if(c.data_vencimento && c.data_vencimento<hojeIso){ qtdVencidas++; totVencido+=v; }
        if(!catMap[item.id]) catMap[item.id]={nome:item.description||'-',qtd:0,qPago:0,total:0,pago:0};
        catMap[item.id].qtd++; catMap[item.id].total+=v; if(c.pago){ catMap[item.id].qPago++; catMap[item.id].pago+=v; }
        if(!tipoMap[tipo]) tipoMap[tipo]={qtd:0,qPago:0,total:0,pago:0};
        tipoMap[tipo].qtd++; tipoMap[tipo].total+=v; if(c.pago){ tipoMap[tipo].qPago++; tipoMap[tipo].pago+=v; }
        rows.push([item.description||'-', local.description||'-', c.mes_ano||'-', c.tipo||'-', c.leitura_relogio||'-', c.consumo_kwh||'-','R$ '+fmtMoney(v), c.pago?'SIM':'NÃO', fmtPdfD(c.data_vencimento), fmtPdfD(c.data_pagamento), c.observacao||'-']);
      });
      if(locQtd>0){
        rows.push([item.description||'-', (local.description||'-')+' - SUBTOTAL LOCAL', '', '', '', '', 'R$ '+fmtMoney(locTotal), (locPago+'/'+locQtd+' pagas'), '', '', '']);
        rows.push(['','','','','','','','','','','']);
      }
    });
    if(catQtd>0){
      rows.push([(item.description||'-')+' - TOTAL UNIDADE', '', '', '', '', '', 'R$ '+fmtMoney(catTotal), (catPago+'/'+catQtd+' pagas'), '', '', '']);
      rows.push(['','','','','','','','','','','']);
      rows.push(['','','','','','','','','','','']);
    }
  });
  const totalPendente=totalGeral-totalPago;
  const qtdPendente=qtdTotal-qtdPago;
  const pctPago=totalGeral ? (totalPago/totalGeral*100) : 0;

  const summaryRows=Object.values(catMap).sort((a,b)=>b.total-a.total).map(c=>{
    const pend=c.total-c.pago;
    return [c.nome,c.qtd,c.qPago,c.qtd-c.qPago,'R$ '+fmtMoney(c.total),'R$ '+fmtMoney(c.pago),'R$ '+fmtMoney(pend),P.pctFmt(c.total?c.pago/c.total*100:0)];
  });
  summaryRows.push(['TOTAL GERAL',qtdTotal,qtdPago,qtdPendente,'R$ '+fmtMoney(totalGeral),'R$ '+fmtMoney(totalPago),'R$ '+fmtMoney(totalPendente),P.pctFmt(pctPago)]);

  // ── topo com neuroarquitetura: cabeçalho compacto, situação em uma frase, fichas que nunca vazam, progresso ──
  const titulo = `CONTROLE DE CONTAS · ${(sec.name||'').toUpperCase()}`.replace(/ · CONTROLE DE CONTAS$/,'');
  const sub = `Prefeitura Municipal de Sertânia · ${filtros.join(' · ')} · Emitido em ${P.hoje()}`;
  const drawHeader = () => P.header(doc, {W, title: titulo, sub, logo});
  let y = drawHeader();
  const sit = P.mood({total: totalGeral, pago: totalPago, qtd: qtdTotal, qtdPago, vencidas: qtdVencidas, totVencido}, v => 'R$ '+fmtMoney(v));
  y = P.situation(doc, {x: mx, y, w: cw, ...sit});
  y = P.kpis(doc, {x: mx, y, w: cw, cards: [
    {label: 'Total em contas', value: 'R$ '+fmtMoney(totalGeral), sub: `${qtdTotal} conta(s)`, tone: 'total'},
    {label: 'Pago', value: 'R$ '+fmtMoney(totalPago), sub: `${qtdPago} conta(s)`, tone: 'paid'},
    {label: 'Pendente', value: 'R$ '+fmtMoney(totalPendente), sub: qtdPendente ? `${qtdPendente} conta(s)` : 'nada pendente', tone: totalPendente>0.004 ? 'pend' : 'zero'},
    {label: 'Vencidas', value: qtdVencidas ? 'R$ '+fmtMoney(totVencido) : 'Nenhuma', sub: qtdVencidas ? `${qtdVencidas} em atraso` : 'em dia', tone: qtdVencidas ? 'late' : 'zero'},
  ]});
  y = P.progress(doc, {x: mx, y, w: cw, pct: pctPago});
  if(sec.observacoes){ sf(7.5,false,[71,85,105]); const obs = doc.splitTextToSize(sec.observacoes, cw); doc.text(obs, mx, y); y += obs.length*3.2 + 2; }
  const secTitle = (t, yy) => { doc.setFillColor(14,116,144); doc.roundedRect(mx, yy-3.6, 1.4, 4.6, .6, .6, 'F'); sf(10,true,[11,37,64]); doc.text(t, mx+3.5, yy); };
  const pageHook = {margin:{left:mx,right:mx,top:22,bottom:12}, didDrawPage:()=>{ if(doc.internal.getCurrentPageInfo().pageNumber>1) drawHeader(); }};
  const PEND=[146,64,14], PAGO=[4,120,87];
  secTitle('Resumo por categoria', y+3); y+=6;

  doc.autoTable({
    ...P.table, ...pageHook,
    startY:y,
    head:[['Categoria','Lanç.','Pagos','Pendentes','Valor Total','Valor Pago','Valor Pendente','% Pago']],
    body:summaryRows,
    columnStyles:{0:{cellWidth:50},1:{cellWidth:18},2:{cellWidth:18},3:{cellWidth:22},4:{cellWidth:32,halign:'right'},5:{cellWidth:32,halign:'right'},6:{cellWidth:32,halign:'right'},7:{cellWidth:20,halign:'center'}},
    didParseCell:(data)=>{
      if(data.section!=='body') return;
      if(data.row.raw[0]==='TOTAL GERAL'){ data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[224,242,254]; data.cell.styles.textColor=[11,37,64]; return; }
      if(data.column.index===4) data.cell.styles.fontStyle='bold';
      if(data.column.index===5) data.cell.styles.textColor=PAGO;
      if(data.column.index===6) data.cell.styles.textColor=data.cell.raw==='R$ 0,00'?[100,116,139]:PEND;
    }
  });

  const tipoRows=Object.entries(tipoMap).sort((a,b)=>b[1].total-a[1].total).map(([t,v])=>{
    const pend=v.total-v.pago;
    return [t, v.qtd, v.qPago, v.qtd-v.qPago, 'R$ '+fmtMoney(v.total), 'R$ '+fmtMoney(v.pago), 'R$ '+fmtMoney(pend)];
  });
  const startTipoY=doc.lastAutoTable?doc.lastAutoTable.finalY+10:y+30;
  secTitle('Resumo por tipo de conta', startTipoY-4);
  doc.autoTable({
    ...P.table, ...pageHook,
    startY:startTipoY,
    head:[['Tipo de Conta','Quant.','Pagas','Pendentes','Valor Total','Valor Pago','Valor Pendente']],
    body:tipoRows,
    columnStyles:{0:{cellWidth:50},1:{cellWidth:22,halign:'center'},2:{cellWidth:22,halign:'center'},3:{cellWidth:22,halign:'center'},4:{cellWidth:34,halign:'right'},5:{cellWidth:34,halign:'right'},6:{cellWidth:34,halign:'right'}},
    didParseCell:(data)=>{
      if(data.section!=='body') return;
      if(data.column.index===4) data.cell.styles.fontStyle='bold';
      if(data.column.index===5) data.cell.styles.textColor=PAGO;
      if(data.column.index===6) data.cell.styles.textColor=data.cell.raw==='R$ 0,00'?[100,116,139]:PEND;
    }
  });

  let startDetailY=doc.lastAutoTable?doc.lastAutoTable.finalY+10:y+30;
  if(startDetailY>H-40){ doc.addPage(); drawHeader(); startDetailY=30; }
  secTitle('Detalhamento por lançamento', startDetailY-4);
  if(rows.length){
    doc.autoTable({
      ...P.table, ...pageHook,
      startY:startDetailY,
      head:[['Categoria','Local','Mês/Ano','Tipo','Leitura','Consumo','Valor','Pago','Vencimento','Pagamento','Obs.']],
      body:rows,
      columnStyles:{0:{cellWidth:28},1:{cellWidth:34},2:{cellWidth:16},3:{cellWidth:15},4:{cellWidth:17},5:{cellWidth:17},6:{cellWidth:28,halign:'right'},7:{cellWidth:17,halign:'center'},8:{cellWidth:21},9:{cellWidth:21},10:{cellWidth:'auto'}},
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
          data.cell.styles.fillColor = isCat ? [224,242,254] : [236,253,245];
          data.cell.styles.textColor = [11,37,64];
        } else {
          [2,6].forEach(idx=>{ if(data.column.index===idx) data.cell.styles.fontStyle='bold'; });
          if(data.column.index===7){ data.cell.styles.fontStyle='bold'; data.cell.styles.textColor = data.row.raw[7]==='SIM' ? PAGO : PEND; }
        }
      }
    });
  } else {
    sf(10,false,[120,120,120]); doc.text('Nenhum lancamento encontrado para os filtros selecionados.', mx, startDetailY+10);
  }

  // fechamento: o mesmo resumo em frase, num quadro calmo, e rodapé com página X de Y
  let finalY=doc.lastAutoTable?doc.lastAutoTable.finalY+6:startDetailY+30;
  if(finalY>H-34){ doc.addPage(); drawHeader(); finalY=24; }
  P.situation(doc, {x: mx, y: finalY, w: cw, mood: sit.mood, titulo: `Total geral: R$ ${fmtMoney(totalGeral)} · ${qtdPago}/${qtdTotal} contas pagas (${P.pctFmt(pctPago)})`, frase: `Pago: R$ ${fmtMoney(totalPago)}   ·   Pendente: R$ ${fmtMoney(totalPendente)}${qtdVencidas?`   ·   Vencidas: ${qtdVencidas} (R$ ${fmtMoney(totVencido)})`:''}`});
  P.footer(doc, {W, H});

  doc.save((sec.name||'controle-contas').replace(/[^a-zA-Z0-9\u00C0-\u00FA ]/g,'_').trim()+'_relatorio_'+now.replace(/\//g,'-')+'.pdf');
  toast('PDF gerado!','success');
};
