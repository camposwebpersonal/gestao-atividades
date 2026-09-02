/* Controle especializado de perfuração de poços.
 * Usa atividades/items/subitems existentes para não exigir migração de banco.
 */
(function(){
  'use strict';

  const EF=x=>x?.extra_fields&&typeof x.extra_fields==='object'?x.extra_fields:{};
  const V=(x,k,d='')=>x?.[k]??EF(x)[k]??d;
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateBR=v=>{if(!v)return '—';const s=String(v).slice(0,10).split('-');return s.length===3?`${s[2]}/${s[1]}/${s[0]}`:String(v);};
  const isoToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Recife'});
  const state={secId:null,status:'todos',perfurador:'todos',busca:'',tab:'pocos'};
  const isWell=x=>V(x,'registro_tipo')==='poco';
  const isDriller=x=>V(x,'registro_tipo')==='perfurador';
  const isPlaceholder=x=>isDriller(x)&&Number(V(x,'is_placeholder',0))===1;
  const canEdit=()=>window.S?.isAdmin||window.userCan?.('atendimentos','editar');
  const allWells=secId=>(window.S?.subitems||[]).filter(x=>x.atividade_id===secId&&isWell(x));
  const allDrillers=secId=>(window.S?.items||[]).filter(x=>x.atividade_id===secId&&isDriller(x));
  const drillerName=id=>{const d=(window.S?.items||[]).find(x=>x.id===id);return d&&!isPlaceholder(d)?d.description:'Não informado';};

  const style=document.createElement('style');
  style.textContent=`
    .pw-hero{background:linear-gradient(135deg,#052e2b,#0f3d2e 55%,#123b66);border:1px solid #1f6f5c;border-radius:18px;padding:20px;margin-bottom:16px;position:relative;overflow:hidden}
    .pw-hero:after{content:'💧';position:absolute;right:18px;top:-15px;font-size:100px;opacity:.08;transform:rotate(12deg)}
    .pw-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
    .pw-tabs{display:flex;gap:5px;background:#071323;border:1px solid #1e3a5f;border-radius:10px;padding:4px}
    .pw-tab{border:0;background:transparent;color:#64748b;padding:7px 12px;border-radius:7px;font-weight:700;cursor:pointer}.pw-tab.active{background:#0f766e;color:#fff}
    .pw-stats{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-bottom:16px}
    .pw-stat{background:#0e1729;border:1px solid #1e3a5f;border-radius:13px;padding:14px}.pw-stat b{display:block;font-size:23px;margin-bottom:3px}.pw-stat span{font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:800;letter-spacing:.4px}
    .pw-filters{display:grid;grid-template-columns:minmax(180px,1.5fr) repeat(2,minmax(145px,1fr));gap:9px;background:#0a1222;border:1px solid #1e3a5f;border-radius:12px;padding:11px;margin-bottom:14px}
    .pw-filters input,.pw-filters select{width:100%;background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;padding:9px 11px}
    .pw-list{display:grid;gap:12px}.pw-card{background:#0e1729;border:1px solid #1e3a5f;border-radius:14px;overflow:hidden}.pw-card.pago{border-left:4px solid #10b981}.pw-card.pendente{border-left:4px solid #f59e0b}
    .pw-card-head{display:flex;align-items:flex-start;gap:10px;padding:14px 15px;border-bottom:1px solid #172640}.pw-card-main{flex:1;min-width:0}.pw-num{font-size:11px;font-weight:900;color:#38bdf8;text-transform:uppercase}.pw-local{font-size:17px;font-weight:850;color:#f8fafc;margin-top:2px}.pw-badge{border-radius:999px;padding:5px 10px;font-size:10px;font-weight:900;white-space:nowrap}.pw-badge.pago{background:#064e3b;color:#6ee7b7}.pw-badge.pendente{background:#78350f;color:#fcd34d}
    .pw-card-body{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:12px;padding:13px 15px}.pw-field small{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:3px}.pw-field div{color:#cbd5e1;font-size:12px;line-height:1.35}
    .pw-card-actions{display:flex;gap:7px;justify-content:flex-end;padding:10px 15px;background:#0a1222;flex-wrap:wrap}.pw-mini{border:1px solid #1e3a5f;background:#111c31;color:#cbd5e1;border-radius:7px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer}.pw-mini:hover{border-color:#38bdf8;color:#38bdf8}
    .pw-company-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}.pw-company{background:#0e1729;border:1px solid #1e3a5f;border-radius:14px;padding:15px}.pw-company h3{font-size:15px;color:#f8fafc;margin-bottom:4px}.pw-company-meta{color:#64748b;font-size:11px;line-height:1.55}.pw-company-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 0}.pw-company-totals div{background:#091323;border-radius:8px;padding:8px;text-align:center;font-size:10px;color:#64748b}.pw-company-totals b{display:block;font-size:15px;color:#e2e8f0;margin-bottom:2px}
    @media(max-width:760px){.pw-stats{grid-template-columns:repeat(2,1fr)}.pw-filters{grid-template-columns:1fr}.pw-card-body{grid-template-columns:repeat(2,1fr)}.pw-toolbar>.btn-action{flex:1}.pw-tabs{width:100%}.pw-tab{flex:1}.pw-card-head{align-items:center}.pw-local{font-size:15px}}
    @media(max-width:420px){.pw-card-body{grid-template-columns:1fr}.pw-stats{gap:7px}.pw-stat{padding:11px}.pw-stat b{font-size:20px}}
  `;
  document.head.appendChild(style);

  window.ensurePocosSetup=async function(){
    let sec=(window.S.secs||[]).find(s=>Number(V(s,'controle_pocos',0))===1)||(window.S.secs||[]).find(s=>(s.name||'').toLowerCase()==='perfuração de poços');
    if(!sec){
      const data={name:'Perfuração de Poços',description:'Controle dos poços perfurados, prestadores e pagamentos.',observacoes:'Cadastro, acompanhamento financeiro e relatórios das perfurações realizadas.',order_num:(window.S.secs||[]).length,controle_pendencias:0,extra_fields:{modulo:'atendimentos',controle_pocos:1},created_at:window.serverTimestamp(),updated_at:window.serverTimestamp()};
      const ref=await window.addDoc(window.collection(window.db,'secretariats'),data);sec={...data,id:ref.id,controle_pocos:1};window.S.secs.push(sec);
    }else if(Number(V(sec,'controle_pocos',0))!==1){
      await window.updateDoc(window.doc(window.db,'secretariats',sec.id),{controle_pocos:1,modulo:'atendimentos',updated_at:window.serverTimestamp()});
      sec.controle_pocos=1;sec.extra_fields={...EF(sec),controle_pocos:1,modulo:'atendimentos'};
    }
    let bucket=allDrillers(sec.id).find(isPlaceholder);
    if(!bucket){
      const data={atividade_id:sec.id,description:'NÃO INFORMADO',order_num:0,concluded:0,extra_fields:{registro_tipo:'perfurador',is_placeholder:1,tipo_pessoa:'pessoa'},created_at:window.serverTimestamp(),updated_at:window.serverTimestamp()};
      const ref=await window.addDoc(window.collection(window.db,'items'),data);bucket={...data,id:ref.id,registro_tipo:'perfurador',is_placeholder:1};window.S.items.push(bucket);
    }
    const seeds=[
      {numero:'POÇO 1',local:'SITIO SANTANA',representante:'JOSEMAR FREIRE DE SIQUEIRA'},
      {numero:'POÇO 2',local:'SITIO SANTO ANTÔNIO',representante:'DEMA'},
      {numero:'POÇO 3',local:'SITIO PEDRA GRANDE',representante:'INÁCIO PEDRO DA SILVA'},
      {numero:'POÇO 4',local:'SITIO URUBU',representante:'FRANCISCO FABRÍCIO'}
    ];
    if(Number(V(sec,'pocos_seed_v1',0))!==1){
      for(let i=0;i<seeds.length;i++){
        const s=seeds[i];
        const exists=allWells(sec.id).some(p=>String(V(p,'numero')).toUpperCase()===s.numero||String(p.description||'').toUpperCase()===s.local);
        if(exists)continue;
        const data={atividade_id:sec.id,item_id:bucket.id,parent_id:bucket.id,parent_type:'item',description:s.local,responsaveis:s.representante,start_date:'2026-09-02',observacao:'',order_num:i,concluded:0,status:'pendente',extra_fields:{registro_tipo:'poco',numero:s.numero,status_pagamento:'pendente',valor:0,data_pagamento:null},created_at:window.serverTimestamp(),updated_at:window.serverTimestamp()};
        const ref=await window.addDoc(window.collection(window.db,'subitems'),data);window.S.subitems.push({...data,id:ref.id,registro_tipo:'poco',numero:s.numero,status_pagamento:'pendente',valor:0});
      }
      await window.updateDoc(window.doc(window.db,'secretariats',sec.id),{pocos_seed_v1:1,updated_at:window.serverTimestamp()});
      sec.pocos_seed_v1=1;sec.extra_fields={...EF(sec),pocos_seed_v1:1};
    }
  };

  function filteredWells(){
    const q=state.busca.trim().toLowerCase();
    return allWells(state.secId).filter(p=>{
      const st=V(p,'status_pagamento','pendente');
      if(state.status!=='todos'&&st!==state.status)return false;
      if(state.perfurador!=='todos'&&p.item_id!==state.perfurador)return false;
      if(q&&!`${V(p,'numero')} ${p.description} ${p.responsaveis} ${p.observacao} ${drillerName(p.item_id)}`.toLowerCase().includes(q))return false;
      return true;
    }).sort((a,b)=>String(a.start_date||'').localeCompare(String(b.start_date||''))||Number(a.order_num||0)-Number(b.order_num||0));
  }

  window.renderPocos=function(secId){
    state.secId=secId;
    const wells=allWells(secId),paid=wells.filter(p=>V(p,'status_pagamento')==='pago'),pending=wells.filter(p=>V(p,'status_pagamento')!=='pago');
    const total=wells.reduce((a,p)=>a+Number(V(p,'valor',0)||0),0),pendingValue=pending.reduce((a,p)=>a+Number(V(p,'valor',0)||0),0);
    const editable=canEdit();
    const sec=window.S.secs.find(s=>s.id===secId);
    document.getElementById('content').innerHTML=`
      <div class="pw-hero"><div style="font-size:12px;color:#5eead4;font-weight:800;text-transform:uppercase;letter-spacing:.7px">Atendimentos · Infraestrutura Rural</div><div style="font-size:clamp(23px,4vw,34px);font-weight:900;margin:4px 0">💧 Perfuração de Poços</div><div style="max-width:720px;color:#a7c8c0;font-size:13px">Controle completo das perfurações, localidades, representantes, prestadores e pagamentos da Prefeitura Municipal de Sertânia.</div></div>
      <div class="pw-toolbar"><button class="btn-action" onclick="window.renderModulo('atendimentos')">← Atendimentos</button><div class="pw-tabs"><button class="pw-tab ${state.tab==='pocos'?'active':''}" onclick="pocoSetTab('pocos')">💧 Poços</button><button class="pw-tab ${state.tab==='perfuradores'?'active':''}" onclick="pocoSetTab('perfuradores')">🏢 Perfuradores</button></div><div style="flex:1"></div>${editable?'<button class="btn-action primary" onclick="openPocoModal()">+ Nova Perfuração</button><button class="btn-action" onclick="openPerfuradorModal()">+ Novo Perfurador</button>':''}<button class="btn-action" onclick="gerarPdfPocos()">📄 Gerar PDF</button></div>
      <div class="pw-stats"><div class="pw-stat"><b style="color:#38bdf8">${wells.length}</b><span>Poços perfurados</span></div><div class="pw-stat"><b style="color:#10b981">${paid.length}</b><span>Serviços pagos</span></div><div class="pw-stat"><b style="color:#f59e0b">${pending.length}</b><span>Aguardando pagamento</span></div><div class="pw-stat"><b style="color:#fbbf24;font-size:18px">${pendingValue?money(pendingValue):'—'}</b><span>Valor pendente</span></div></div>
      <div id="pw-view">${state.tab==='pocos'?renderWellList(editable):renderDrillerList(editable)}</div>
      <div style="margin-top:12px;color:#475569;font-size:10px;text-align:right">Controle: ${esc(sec?.name||'Perfuração de Poços')} · Valor total registrado: ${money(total)}</div>`;
  };

  function renderWellList(editable){
    const drillers=allDrillers(state.secId).filter(d=>!isPlaceholder(d));
    const rows=filteredWells();
    return `<div class="pw-filters"><input value="${esc(state.busca)}" placeholder="🔎 Buscar localidade, representante ou perfurador..." oninput="pocoFilter('busca',this.value)"><select onchange="pocoFilter('status',this.value)"><option value="todos" ${state.status==='todos'?'selected':''}>Todos os pagamentos</option><option value="pendente" ${state.status==='pendente'?'selected':''}>Somente pendentes</option><option value="pago" ${state.status==='pago'?'selected':''}>Somente pagos</option></select><select onchange="pocoFilter('perfurador',this.value)"><option value="todos">Todos os perfuradores</option>${drillers.map(d=>`<option value="${esc(d.id)}" ${state.perfurador===d.id?'selected':''}>${esc(d.description)}</option>`).join('')}</select></div>
      <div style="color:#64748b;font-size:11px;margin:0 0 8px 3px">Exibindo ${rows.length} de ${allWells(state.secId).length} perfuração(ões)</div>
      <div class="pw-list">${rows.map(p=>wellCard(p,editable)).join('')||'<div class="empty">Nenhuma perfuração encontrada com estes filtros.</div>'}</div>`;
  }

  function wellCard(p,editable){
    const st=V(p,'status_pagamento','pendente'),val=Number(V(p,'valor',0)||0);
    return `<article class="pw-card ${st}"><div class="pw-card-head"><div style="font-size:25px">${st==='pago'?'✅':'💧'}</div><div class="pw-card-main"><div class="pw-num">${esc(V(p,'numero','POÇO'))}</div><div class="pw-local">${esc(p.description||'Local não informado')}</div></div><span class="pw-badge ${st}">${st==='pago'?'PAGO':'PENDENTE'}</span></div><div class="pw-card-body"><div class="pw-field"><small>Data da execução</small><div>${dateBR(p.start_date)}</div></div><div class="pw-field"><small>Representante local</small><div>${esc(p.responsaveis||'Não informado')}</div></div><div class="pw-field"><small>Empresa / Perfurador</small><div>${esc(drillerName(p.item_id))}</div></div><div class="pw-field"><small>Valor do serviço</small><div style="color:${val?'#fbbf24':'#64748b'};font-weight:800">${val?money(val):'Não informado'}</div></div>${p.observacao?`<div class="pw-field" style="grid-column:1/-1"><small>Observações</small><div>${esc(p.observacao)}</div></div>`:''}${st==='pago'?`<div class="pw-field"><small>Data do pagamento</small><div>${dateBR(V(p,'data_pagamento'))}</div></div>`:''}</div>${editable?`<div class="pw-card-actions">${st==='pago'?`<button class="pw-mini" onclick="togglePocoPagamento('${p.id}','pendente')">↩ Marcar pendente</button>`:`<button class="pw-mini" style="border-color:#047857;color:#6ee7b7" onclick="togglePocoPagamento('${p.id}','pago')">✓ Marcar pago</button>`}<button class="pw-mini" onclick="openPocoModal('${p.id}')">✏️ Editar</button><button class="pw-mini" style="color:#fca5a5" onclick="deletePoco('${p.id}')">🗑️ Excluir</button></div>`:''}</article>`;
  }

  function renderDrillerList(editable){
    const ds=allDrillers(state.secId).filter(d=>!isPlaceholder(d));
    return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px"><div><div style="font-size:16px;font-weight:850">Empresas e pessoas responsáveis pelas perfurações</div><div style="font-size:11px;color:#64748b">Use este cadastro para agrupar serviços e identificar pagamentos pendentes.</div></div></div><div class="pw-company-grid">${ds.map(d=>drillerCard(d,editable)).join('')||'<div class="empty" style="grid-column:1/-1">Nenhum perfurador cadastrado. Os poços já lançados estão como “Não informado”.</div>'}</div>`;
  }

  function drillerCard(d,editable){
    const ws=allWells(state.secId).filter(p=>p.item_id===d.id),pd=ws.filter(p=>V(p,'status_pagamento')==='pago'),pn=ws.filter(p=>V(p,'status_pagamento')!=='pago');
    return `<div class="pw-company"><div style="display:flex;gap:10px"><div style="font-size:28px">${V(d,'tipo_pessoa')==='empresa'?'🏢':'👷'}</div><div style="flex:1"><h3>${esc(d.description)}</h3><div class="pw-company-meta">${esc(V(d,'documento')||'Documento não informado')}<br>${esc(V(d,'telefone')||'Telefone não informado')}${V(d,'contato')?` · ${esc(V(d,'contato'))}`:''}</div></div></div><div class="pw-company-totals"><div><b>${ws.length}</b>Serviços</div><div><b style="color:#6ee7b7">${pd.length}</b>Pagos</div><div><b style="color:#fcd34d">${pn.length}</b>Pendentes</div></div><div style="font-size:11px;color:#94a3b8">A receber: <b style="color:#fbbf24">${money(pn.reduce((a,p)=>a+Number(V(p,'valor',0)||0),0))}</b></div>${editable?`<div class="pw-card-actions" style="margin:12px -15px -15px"><button class="pw-mini" onclick="openPerfuradorModal('${d.id}')">✏️ Editar</button><button class="pw-mini" style="color:#fca5a5" onclick="deletePerfurador('${d.id}')">🗑️ Excluir</button></div>`:''}</div>`;
  }

  window.pocoSetTab=function(tab){state.tab=tab;window.renderPocos(state.secId);};
  window.pocoFilter=function(key,value){state[key]=value;const view=document.getElementById('pw-view');if(view)view.innerHTML=renderWellList(canEdit());};

  window.openPocoModal=function(id){
    const p=id?allWells(state.secId).find(x=>x.id===id):null;
    const ds=allDrillers(state.secId);
    const next=allWells(state.secId).reduce((m,x)=>Math.max(m,parseInt(String(V(x,'numero')).replace(/\D/g,''))||0),0)+1;
    window.openModal(id?'✏️ Editar perfuração':'💧 Nova perfuração','Informe os dados do poço e do pagamento.',`<div class="form-grid"><div class="form-group"><label>Identificação do poço *</label><input id="pw-numero" value="${esc(V(p,'numero',`POÇO ${next}`))}" placeholder="Ex.: POÇO 5"></div><div class="form-group"><label>Data da execução *</label><input type="date" id="pw-data" value="${esc(p?.start_date||isoToday())}"></div><div class="form-group full"><label>Localidade *</label><input id="pw-local" value="${esc(p?.description||'')}" placeholder="Ex.: SÍTIO SANTANA"></div><div class="form-group full"><label>Responsável / representante do local</label><input id="pw-representante" value="${esc(p?.responsaveis||'')}"></div><div class="form-group full"><label>Empresa ou pessoa que realizou a perfuração</label><select id="pw-perfurador">${ds.map(d=>`<option value="${esc(d.id)}" ${p?.item_id===d.id?'selected':''}>${isPlaceholder(d)?'— Não informado —':esc(d.description)}</option>`).join('')}</select></div><div class="form-group"><label>Valor do serviço (R$)</label><input type="number" min="0" step="0.01" id="pw-valor" value="${esc(V(p,'valor',''))}" placeholder="0,00"></div><div class="form-group"><label>Status do pagamento</label><select id="pw-status" onchange="document.getElementById('pw-data-pgto-wrap').style.display=this.value==='pago'?'flex':'none'"><option value="pendente" ${V(p,'status_pagamento','pendente')==='pendente'?'selected':''}>Pendente</option><option value="pago" ${V(p,'status_pagamento')==='pago'?'selected':''}>Pago</option></select></div><div class="form-group" id="pw-data-pgto-wrap" style="display:${V(p,'status_pagamento')==='pago'?'flex':'none'}"><label>Data do pagamento</label><input type="date" id="pw-data-pgto" value="${esc(V(p,'data_pagamento',''))}"></div><div class="form-group full"><label>Observações</label><textarea id="pw-obs" placeholder="Detalhes da perfuração, acesso, profundidade ou outras informações...">${esc(p?.observacao||'')}</textarea></div></div><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="savePoco('${id||''}')">💾 Salvar perfuração</button></div>`);
  };

  window.savePoco=async function(id){
    const numero=document.getElementById('pw-numero').value.trim(),local=document.getElementById('pw-local').value.trim(),data=document.getElementById('pw-data').value;
    if(!numero||!local||!data){window.toast('Identificação, localidade e data são obrigatórios','error');return;}
    const status=document.getElementById('pw-status').value;
    const perfuradorId=document.getElementById('pw-perfurador').value;
    const payload={atividade_id:state.secId,item_id:perfuradorId,parent_id:perfuradorId,parent_type:'item',description:local,responsaveis:document.getElementById('pw-representante').value.trim(),start_date:data,observacao:document.getElementById('pw-obs').value.trim(),status:status==='pago'?'concluido':'pendente',concluded:status==='pago'?1:0,updated_at:window.serverTimestamp(),registro_tipo:'poco',numero,status_pagamento:status,valor:Number(document.getElementById('pw-valor').value||0),data_pagamento:status==='pago'?(document.getElementById('pw-data-pgto').value||isoToday()):null};
    try{if(id)await window.updateDoc(window.doc(window.db,'subitems',id),payload);else{payload.order_num=allWells(state.secId).length;payload.created_at=window.serverTimestamp();await window.addDoc(window.collection(window.db,'subitems'),payload);}await window.loadData();window.closeModal();window.toast(id?'Perfuração atualizada!':'Perfuração cadastrada!');window.renderPocos(state.secId);}catch(e){console.error(e);window.toast('Erro ao salvar perfuração: '+(e.message||e),'error');}
  };

  window.togglePocoPagamento=async function(id,status){
    try{await window.updateDoc(window.doc(window.db,'subitems',id),{status_pagamento:status,data_pagamento:status==='pago'?isoToday():null,status:status==='pago'?'concluido':'pendente',concluded:status==='pago'?1:0,updated_at:window.serverTimestamp()});await window.loadData();window.toast(status==='pago'?'Pagamento confirmado!':'Pagamento voltou para pendente.');window.renderPocos(state.secId);}catch(e){window.toast('Erro ao atualizar pagamento: '+(e.message||e),'error');}
  };

  window.deletePoco=async function(id){if(!confirm('Excluir definitivamente este lançamento de perfuração?'))return;try{await window.deleteDoc(window.doc(window.db,'subitems',id));await window.loadData();window.toast('Lançamento excluído!');window.renderPocos(state.secId);}catch(e){window.toast('Erro ao excluir: '+(e.message||e),'error');}};

  window.openPerfuradorModal=function(id){
    const d=id?allDrillers(state.secId).find(x=>x.id===id):null;
    window.openModal(id?'✏️ Editar perfurador':'🏢 Novo perfurador','Cadastre empresa ou pessoa responsável pela execução.',`<div class="form-grid"><div class="form-group"><label>Tipo</label><select id="pd-tipo"><option value="empresa" ${V(d,'tipo_pessoa','empresa')==='empresa'?'selected':''}>Empresa</option><option value="pessoa" ${V(d,'tipo_pessoa')==='pessoa'?'selected':''}>Pessoa física</option></select></div><div class="form-group"><label>Nome / Razão social *</label><input id="pd-nome" value="${esc(d?.description||'')}"></div><div class="form-group"><label>CPF / CNPJ</label><input id="pd-doc" value="${esc(V(d,'documento',''))}"></div><div class="form-group"><label>Telefone</label><input id="pd-tel" value="${esc(V(d,'telefone',''))}"></div><div class="form-group full"><label>Pessoa de contato</label><input id="pd-contato" value="${esc(V(d,'contato',''))}"></div><div class="form-group full"><label>Observações</label><textarea id="pd-obs">${esc(d?.observacao||'')}</textarea></div></div><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="savePerfurador('${id||''}')">💾 Salvar perfurador</button></div>`);
  };

  window.savePerfurador=async function(id){
    const name=document.getElementById('pd-nome').value.trim();if(!name){window.toast('Nome é obrigatório','error');return;}
    const payload={atividade_id:state.secId,description:name,observacao:document.getElementById('pd-obs').value.trim(),concluded:0,updated_at:window.serverTimestamp(),registro_tipo:'perfurador',tipo_pessoa:document.getElementById('pd-tipo').value,documento:document.getElementById('pd-doc').value.trim(),telefone:document.getElementById('pd-tel').value.trim(),contato:document.getElementById('pd-contato').value.trim()};
    try{if(id)await window.updateDoc(window.doc(window.db,'items',id),payload);else{payload.order_num=allDrillers(state.secId).length;payload.created_at=window.serverTimestamp();await window.addDoc(window.collection(window.db,'items'),payload);}await window.loadData();window.closeModal();state.tab='perfuradores';window.toast(id?'Perfurador atualizado!':'Perfurador cadastrado!');window.renderPocos(state.secId);}catch(e){window.toast('Erro ao salvar perfurador: '+(e.message||e),'error');}
  };

  window.deletePerfurador=async function(id){
    const linked=allWells(state.secId).filter(p=>p.item_id===id);if(linked.length){window.toast(`Este perfurador possui ${linked.length} serviço(s). Reatribua os poços antes de excluir.`,'error',6000);return;}if(!confirm('Excluir este cadastro de perfurador?'))return;try{await window.deleteDoc(window.doc(window.db,'items',id));await window.loadData();window.toast('Perfurador excluído!');window.renderPocos(state.secId);}catch(e){window.toast('Erro ao excluir: '+(e.message||e),'error');}
  };

  window.gerarPdfPocos=async function(secId){
    if(secId)state.secId=secId;
    if(!window.jspdf?.jsPDF){window.toast('jsPDF não carregado','error');return;}
    const wells=filteredWells();if(!wells.length){window.toast('Não há perfurações nos filtros atuais','error');return;}
    window.toast('Gerando relatório institucional…','info',6000);
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,H=210,mx=12,HDR=30,FTR=15,top=36,bottom=H-FTR-4;
    const logo=await window.loadB64('img/logo_sertania.png','png',140).catch(()=>null);
    const sf=(n,b,c)=>{doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(n);doc.setTextColor(...(c||[30,41,59]));};
    const header=()=>{doc.setFillColor(245,252,245);doc.rect(0,0,W,HDR,'F');doc.setFillColor(20,82,20);doc.rect(0,0,6,HDR,'F');doc.setFillColor(110,192,46);doc.rect(0,HDR-3,W,3,'F');if(logo){let h=22,w=h*(logo.w/logo.h);if(w>30){w=30;h=w/(logo.w/logo.h);}doc.addImage(logo.d,'PNG',W-mx-w,3+(23-h)/2,w,h,'pw_logo_h','FAST');}sf(14,true,[20,82,20]);doc.text('RELATÓRIO DE PERFURAÇÃO DE POÇOS',mx+8,13);sf(7.5,false,[30,123,30]);doc.text('Prefeitura Municipal de Sertânia — PE  •  Controle de Atendimentos  •  '+new Date().toLocaleDateString('pt-BR'),mx+8,22);};
    const footer=()=>{doc.setFillColor(20,82,20);doc.rect(0,H-FTR,W,FTR,'F');doc.setFillColor(110,192,46);doc.rect(0,H-FTR,W,2,'F');if(logo){let h=10,w=h*(logo.w/logo.h);doc.addImage(logo.d,'PNG',mx,H-FTR+3,w,h,'pw_logo_f','FAST');}sf(7,true,[210,250,210]);doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA — PE',mx+17,H-FTR+8);sf(6.5,false,[190,240,190]);doc.text('Sertânia — PE  |  (87) 3841-1156  |  www.sertania.pe.gov.br',W/2,H-FTR+12,{align:'center'});};
    header();footer();
    const paid=wells.filter(p=>V(p,'status_pagamento')==='pago'),pending=wells.filter(p=>V(p,'status_pagamento')!=='pago'),total=wells.reduce((a,p)=>a+Number(V(p,'valor',0)||0),0),pendVal=pending.reduce((a,p)=>a+Number(V(p,'valor',0)||0),0);
    const cards=[['PERFURAÇÕES',String(wells.length),[59,130,246]],['PAGAS',String(paid.length),[16,185,129]],['PENDENTES',String(pending.length),[245,158,11]],['VALOR PENDENTE',money(pendVal),[220,120,20]]];
    const cw=(W-mx*2-9)/4;cards.forEach((c,i)=>{const x=mx+i*(cw+3);doc.setFillColor(248,250,252);doc.setDrawColor(210,225,215);doc.roundedRect(x,top,cw,17,2,2,'FD');doc.setFillColor(...c[2]);doc.rect(x,top,cw,2,'F');sf(11,true,c[2]);doc.text(c[1],x+cw/2,top+9,{align:'center'});sf(6,false,[100,116,139]);doc.text(c[0],x+cw/2,top+14,{align:'center'});});
    const body=wells.map(p=>[V(p,'numero','—'),p.description||'—',p.responsaveis||'—',dateBR(p.start_date),drillerName(p.item_id),money(V(p,'valor',0)),V(p,'status_pagamento')==='pago'?'PAGO':'PENDENTE',dateBR(V(p,'data_pagamento')),p.observacao||'']);
    doc.autoTable({startY:top+22,head:[['Poço','Localidade','Representante','Execução','Empresa / Perfurador','Valor','Pagamento','Data pgto.','Observações']],body,margin:{left:mx,right:mx,top,bottom:H-(bottom-1)},styles:{fontSize:7,cellPadding:1.8,overflow:'linebreak',textColor:[30,41,59],lineColor:[203,213,225],lineWidth:.1},headStyles:{fillColor:[13,34,64],textColor:[255,255,255],fontStyle:'bold',fontSize:7},alternateRowStyles:{fillColor:[248,252,248]},columnStyles:{0:{cellWidth:14},1:{cellWidth:32},2:{cellWidth:31},3:{cellWidth:17},4:{cellWidth:35},5:{cellWidth:22,halign:'right'},6:{cellWidth:18,halign:'center'},7:{cellWidth:17},8:{cellWidth:67}},didParseCell:d=>{if(d.section==='body'&&d.column.index===6){const paid=String(d.cell.raw)==='PAGO';d.cell.styles.textColor=paid?[5,150,105]:[217,119,6];d.cell.styles.fontStyle='bold';}},didDrawPage:d=>{if(d.pageNumber>1)header();footer();}});
    let y=doc.lastAutoTable.finalY+5;if(y+24>bottom){doc.addPage();header();footer();y=top;}
    sf(9,true,[20,82,20]);doc.text('RESUMO POR EMPRESA / PERFURADOR',mx,y+5);y+=8;
    const groups=new Map();wells.forEach(p=>{const n=drillerName(p.item_id);if(!groups.has(n))groups.set(n,[]);groups.get(n).push(p);});
    const sumBody=[...groups.entries()].map(([n,ws])=>{const p=ws.filter(x=>V(x,'status_pagamento')==='pago'),pn=ws.filter(x=>V(x,'status_pagamento')!=='pago');return[n,String(ws.length),String(p.length),String(pn.length),money(ws.reduce((a,x)=>a+Number(V(x,'valor',0)||0),0)),money(pn.reduce((a,x)=>a+Number(V(x,'valor',0)||0),0))];});
    doc.autoTable({startY:y,head:[['Empresa / Perfurador','Serviços','Pagos','Pendentes','Valor total','A pagar']],body:sumBody,margin:{left:mx,right:mx,top,bottom:H-(bottom-1)},styles:{fontSize:8,cellPadding:2,textColor:[30,41,59]},headStyles:{fillColor:[20,82,20],textColor:[255,255,255]},didDrawPage:d=>{if(d.pageNumber>1)header();footer();}});
    footer();doc.save(`relatorio-pocos-${isoToday()}.pdf`);window.toast(`PDF gerado: ${wells.length} perfuração(ões) · total ${money(total)}`,'success',5000);
  };

  function installIntegration(){
    if(!window.renderModulo||!window.openActivity){setTimeout(installIntegration,50);return;}
    if(window.__pocosIntegrationInstalled)return;
    window.__pocosIntegrationInstalled=true;
    const originalRenderModulo=window.renderModulo;
    window.renderModulo=async function(id){
      if(id==='atendimentos'&&window.S?.isAdmin){
        try{await window.ensurePocosSetup();}
        catch(e){console.error('Erro ao preparar controle de poços',e);window.toast?.('Não foi possível preparar o controle de poços: '+(e.message||e),'error',8000);}
      }
      return originalRenderModulo(id);
    };
    const originalOpenActivity=window.openActivity;
    window.openActivity=function(secId){
      const sec=window.S?.secs?.find(s=>s.id===secId);
      if(sec&&(Number(V(sec,'controle_pocos',0))===1)){window.renderPocos(secId);return;}
      return originalOpenActivity(secId);
    };
  }
  setTimeout(installIntegration,0);
})();
