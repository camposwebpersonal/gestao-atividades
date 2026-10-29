import {initDemandas,renderDemandas,demandSidebar} from './demandas-secretarias.js?v=6';
import {supabase} from '../supabase_compat.js?v=7';
import {modulePermission,groupPermission,demandSecretaryPermission,groupCreationPermission,groupDeletionPermission,itemCreationPermission,itemDeletionPermission} from './access-scope.js';
import {fieldCaptureDashboardCard,initFieldCapture,isFieldDemandGroup} from './camera-capture.js?v=4';
import './perfuracao-pocos.js?v=102';
import './controle-extintores.js?v=4';
import './controle-licitacoes.js?v=8';

/* ── SISTEMA MODULAR DE LANÇAMENTOS ── */
const MODULOS = [
  {id:'eventos', label:'Eventos', desc:'Exposições, seminários, agenda e programações especiais.', icon:'🎪', color:'#ec4899', modulo:'eventos'},
  {id:'projetos', label:'Controle de Projetos', desc:'Projetos que a Prefeitura está trabalhando atualmente.', icon:'🚀', color:'#f59e0b', modulo:'projetos'},
  {id:'obras', label:'Obras e Infraestrutura', desc:'Cisternas, barragens, barreiros e demandas de infraestrutura.', icon:'🏗️', color:'#a16207', modulo:'obras'},
  {id:'frota', label:'Frota e Veículos', desc:'IPVA, seguros e aluguéis dos veículos municipais.', icon:'🚗', color:'#6366f1', modulo:'frota'},
  {id:'atendimentos', label:'Demandas por Secretarias', desc:'Grupos e demandas organizados por secretaria responsável.', icon:'🏛️', color:'#ef4444', modulo:'atendimentos'},
  {id:'rh', label:'RH e Empregos', desc:'BCCS, comissionados, contratos e gestão de pessoas.', icon:'👥', color:'#8b5cf6', modulo:'rh'},
  {id:'cadastros', label:'Cadastros', desc:'Associações, lideranças e listas diversas.', icon:'📋', color:'#06b6d4', modulo:'cadastros'},
  {id:'contas', label:'Controle de Contas', desc:'Água, luz, telefone, internet, seguros e contas.', icon:'💰', color:'#10b981', modulo:'contas', flag:'controle_contas'},
  {id:'distribuicao', label:'Controle de Distribuição', desc:'Distribuição de leite, cestas e benefícios.', icon:'🚚', color:'#14b8a6', modulo:'distribuicao', flag:'controle_distribuicao'},
  {id:'estoque', label:'Controle de Estoque', desc:'Entradas, saídas e estoque crítico de produtos.', icon:'📦', color:'#0ea5e9', modulo:'estoque', flag:'controle_estoque'},
  {id:'extintores', label:'Controle de Extintores', desc:'Inventário, validade, recarga e localização dos equipamentos.', icon:'🧯', color:'#dc2626', modulo:'extintores', especial:true},
  {id:'alugueis', label:'Controle de Aluguéis', desc:'Imóveis, equipamentos, veículos alugados e contratos.', icon:'🏠', color:'#f97316', modulo:'alugueis'},
  {id:'mulher', label:'Rede de Assistência e Proteção da Mulher', desc:'Ações, atendimentos e programas de proteção à mulher.', icon:'🙋‍♀️', color:'#d946ef', modulo:'mulher'},
  {id:'agenda_prefeita', label:'Agenda da Prefeita', desc:'Compromissos, agendas e atividades da Prefeita.', icon:'📅', color:'#0d9488', modulo:'agenda_prefeita'},
  {id:'atividades', label:'Outros / Geral', desc:'Demandas e itens não classificados em outro módulo.', icon:'⚙️', color:'#3b82f6', isAtividades:true}
];
window.MODULOS = MODULOS;

const NOME_MODULO = {
  eventos:['expocose','expo','seminário','seminario','agenda','evento','eventos','festa','palestra'],
  projetos:['projetos','projeto'],
  obras:['cisterna','cisternas','barreiro','barreiros','barragem','barragens','infraestrutura','pontos de cisterna','demandas de barreiros','obras'],
  frota:['veiculo','veículos','frota','ipva','seguro dos veiculos','seguro dos veículos'],
  atendimentos:['urgencia','urgência','atendimento','atendimentos','ouvidoria','serviços de urgencia','servicos de urgencia','retro','perfuracao','perfuração','poco','poço','pocos','poços'],
  rh:['rh','empregos','vereadores','bcc s','bcc','comissionados','contratos','igespe','genesis','vigia','vigias'],
  cadastros:['associações','associacoes','lideranças','liderancas','lideres','cadastro'],
  contas:['controle de contas','contas','seguro','seguros'],
  distribuicao:['distribuição','distribuicao','distribuicao de leite','leite'],
  estoque:['estoque','controle de estoque','secretaria de saude','secretaria de saúde','farmacia','farmácia','insumos'],
  extintores:['extintor','extintores','combate a incendio','combate a incêndio'],
  alugueis:['aluguel','alugueis','aluguéis'],
  mulher:['rede de assistencia','rede de assistência','protecao da mulher','proteção da mulher','mulher','atendimento mulher'],
  agenda_prefeita:['agenda da prefeita','prefeita','compromisso da prefeita','agenda prefeitura']
};
function _modFromName(name){
  const n=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for(const id of MODULOS){
    const keys=NOME_MODULO[id.id];
    if(keys&&keys.some(k=>n.includes(k))) return id.id;
  }
  return 'atividades';
}

function _myPerms(){ if(!window.S) return {modulos:{}}; if(window.S.isAdmin) return {modulos:{}, all:true}; return window.S.permissoes || {modulos:{}}; }
window.userCan = function(modId, action='acesso'){
  const p = _myPerms();
  if(p.all) return true;
  return modulePermission(p,modId,action);
};
window.userCanGroup=function(group,action='acesso'){
 if(window.S?.isAdmin)return true;
 if(!group)return false;
 return groupPermission(_myPerms(),_md.modFor(group),group,action);
};
window.userCanDemandSecretaria=function(secretariaId,action='acesso'){
 if(window.S?.isAdmin)return true;
 return demandSecretaryPermission(_myPerms(),secretariaId,action);
};
window.userCanCreateGroups=function(){
 if(window.S?.isAdmin)return true;
 return groupCreationPermission(_myPerms());
};
window.userCanDeleteGroups=function(){
 if(window.S?.isAdmin)return true;
 return groupDeletionPermission(_myPerms());
};
window.userCanCreateItems=function(){
 if(window.S?.isAdmin)return true;
 return itemCreationPermission(_myPerms());
};
window.userCanDeleteItems=function(){
 if(window.S?.isAdmin)return true;
 return itemDeletionPermission(_myPerms());
};

const _md = {
  esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  arg: s => String(JSON.stringify(String(s==null?'':s))).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  setC: h => document.getElementById('content').innerHTML = h,
  fmtD: d => { if(!d) return '—'; try { let s=String(d); if(!s.includes('T') && !s.includes(' ')) s+='T00:00'; return new Date(s).toLocaleDateString('pt-BR'); } catch { return String(d); } },
  pColor: p => p===100 ? '#10b981' : p>0 ? '#3b82f6' : '#334155',
  extra: g => { try { const e=g.extra_fields||{}; return typeof e==='string' ? JSON.parse(e) : e; } catch { return {}; } },
  modFor: s => { const e=_md.extra(s); if(e.modulo) return e.modulo; if(s.controle_estoque==1||s.controle_estoque_modelo==1) return 'estoque'; if(s.controle_contas==1) return 'contas'; if(s.controle_distribuicao==1) return 'distribuicao'; return _modFromName(s.name||s.description||''); },
  pct: g => { if(window.isLicitacaoGroup?.(g)){const rows=(window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='licitacao_lancamento'||s.extra_fields?.registro_tipo==='licitacao_lancamento'));return rows.length?Math.round(rows.filter(s=>{const list=s.status_list||s.extra_fields?.status_list||[];return s.concluded==1||list.includes('CONCLUÍDO');}).length/rows.length*100):0;} if(g.controle_pocos==1||g.extra_fields?.controle_pocos==1){const ps=(window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='poco'||s.extra_fields?.registro_tipo==='poco'));return ps.length?Math.round(ps.filter(s=>(s.status_pagamento||s.extra_fields?.status_pagamento)==='pago').length/ps.length*100):0;} const its = (window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []; if(!its.length) return 0; return Math.round(its.filter(i=>i.concluded==1).length / its.length * 100); },
  ativTotal: g => { if(window.isLicitacaoGroup?.(g))return (window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='licitacao_lancamento'||s.extra_fields?.registro_tipo==='licitacao_lancamento')).length; if(g.controle_pocos==1||g.extra_fields?.controle_pocos==1)return (window.S?.subitems||[]).filter(s=>s.atividade_id===g.id&&(s.registro_tipo==='poco'||s.extra_fields?.registro_tipo==='poco')).length; return ((window.S && S.items && S.items.filter(i=>i.atividade_id===g.id)) || []).length; },
  grupos: mod => (window.S && S.secs || []).filter(s=>_md.modFor(s)===mod.id&&window.userCanGroup(s,'acesso')).sort((a,b)=>(a.order_num||0)-(b.order_num||0))
};

function _navigationValue(){
 const row=(window.S?.appSettings||[]).find(item=>item.id==='navigation');
 try{return typeof row?.value==='string'?JSON.parse(row.value):row?.value||{};}catch{return {};}
}
function _configuredModules(includeHidden=false){
 const saved=Array.isArray(_navigationValue().modules)?_navigationValue().modules:[],byId=new Map(saved.map(item=>[item.id,item]));
 return MODULOS.map((module,index)=>{const pref=byId.get(module.id)||{};return {...module,label:String(pref.label||module.label).trim()||module.label,navigation_hidden:pref.hidden===true,navigation_order:Number.isFinite(Number(pref.order))?Number(pref.order):index,original_label:module.label};})
  .filter(module=>includeHidden||!module.navigation_hidden)
  .sort((a,b)=>a.navigation_order-b.navigation_order||a.label.localeCompare(b.label,'pt-BR'));
}
window.visibleSystemModules=()=>_configuredModules(false);

function _menuOrganizerRows(){
 return _configuredModules(true).map(module=>`<div class="menu-organizer-row ${module.navigation_hidden?'is-hidden':''}" data-module-id="${_md.esc(module.id)}" draggable="true"><span class="menu-organizer-icon" title="Arraste para reordenar">${module.icon}</span><div class="menu-organizer-name"><label>Nome exibido no menu</label><input maxlength="70" value="${_md.esc(module.label)}" aria-label="Nome de ${_md.esc(module.original_label)}"></div><div class="menu-organizer-order"><button type="button" onclick="menuOrganizerMove(this,-1)" title="Mover para cima">↑</button><button type="button" onclick="menuOrganizerMove(this,1)" title="Mover para baixo">↓</button></div><input class="menu-organizer-visible" type="checkbox" ${module.navigation_hidden?'':'checked'} hidden><button type="button" class="menu-organizer-visibility" onclick="toggleMenuOrganizerVisibility(this)">${module.navigation_hidden?'↩ Restaurar':'× Remover'}</button></div>`).join('');
}
window.openMenuOrganizer=function(){
 if(!window.S?.isAdmin){window.toast('Somente administradores podem organizar o menu.','error');return;}
 window.closeSidebar?.();
 window.openModal('⚙ Organizar menu lateral','Renomeie, reordene ou remova áreas do menu sem apagar nenhum lançamento.',`<p class="menu-organizer-intro"><strong>Organização segura:</strong> remover uma área daqui apenas a oculta do menu. Todos os grupos, itens e lançamentos permanecem preservados.</p><div id="menu-organizer-list" class="menu-organizer-list">${_menuOrganizerRows()}</div><div class="menu-organizer-footer"><button type="button" class="reset" onclick="resetMenuOrganizer()">Restaurar nomes e ordem originais</button><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="button" class="btn-save" onclick="saveMenuOrganizer()">Salvar organização</button></div></div>`);
 const list=document.getElementById('menu-organizer-list');let dragged=null;
 list?.addEventListener('dragstart',event=>{dragged=event.target.closest('.menu-organizer-row');dragged?.classList.add('dragging');});
 list?.addEventListener('dragover',event=>{const target=event.target.closest('.menu-organizer-row');if(!dragged||!target||target===dragged)return;event.preventDefault();const after=event.clientY>target.getBoundingClientRect().top+target.offsetHeight/2;list.insertBefore(dragged,after?target.nextSibling:target);});
 list?.addEventListener('dragend',()=>{dragged?.classList.remove('dragging');dragged=null;});
};
window.menuOrganizerMove=function(button,delta){const row=button.closest('.menu-organizer-row'),list=row?.parentElement;if(!row||!list)return;const target=delta<0?row.previousElementSibling:row.nextElementSibling;if(target)list.insertBefore(row,delta<0?target:target.nextSibling);};
window.toggleMenuOrganizerVisibility=function(button){const row=button.closest('.menu-organizer-row'),input=row?.querySelector('.menu-organizer-visible');if(!row||!input)return;input.checked=!input.checked;row.classList.toggle('is-hidden',!input.checked);button.textContent=input.checked?'× Remover':'↩ Restaurar';};
window.saveMenuOrganizer=async function(){
 if(!window.S?.isAdmin)return;const rows=[...document.querySelectorAll('#menu-organizer-list .menu-organizer-row')];
 if(!rows.some(row=>row.querySelector('.menu-organizer-visible')?.checked)){window.toast('Mantenha ao menos uma área visível no menu.','error');return;}
 const modules=rows.map((row,order)=>({id:row.dataset.moduleId,label:row.querySelector('input:not(.menu-organizer-visible)')?.value.trim()||MODULOS.find(module=>module.id===row.dataset.moduleId)?.label||row.dataset.moduleId,hidden:!row.querySelector('.menu-organizer-visible')?.checked,order}));
 try{await window.setDoc(window.doc(window.db,'appSettings','navigation'),{value:{modules},updated_at:window.serverTimestamp(),updated_by:window.S.user?.uid||null});await window.loadData({forceRemote:true});window.closeModal();window.renderModulos();window.toast('Menu reorganizado para todo o sistema!','success',5500);}catch(error){window.toast('Não foi possível salvar o menu: '+(error.message||error),'error',8000);}
};
window.resetMenuOrganizer=async function(){if(!window.S?.isAdmin||!confirm('Restaurar nomes, ordem e visibilidade originais do menu?'))return;try{await window.setDoc(window.doc(window.db,'appSettings','navigation'),{value:{modules:[]},updated_at:window.serverTimestamp(),updated_by:window.S.user?.uid||null});await window.loadData({forceRemote:true});window.closeModal();window.renderModulos();window.toast('Menu original restaurado!');}catch(error){window.toast('Não foi possível restaurar o menu: '+(error.message||error),'error',8000);}};

initDemandas({groups:()=>_md.grupos(MODULOS.find(m=>m.id==='atendimentos')),pct:_md.pct,total:_md.ativTotal});
initFieldCapture();

function _mdCard(mod){
  const grupos = _md.grupos(mod);
  const total = grupos.reduce((a,g)=>a+_md.ativTotal(g),0);
  const disabled = !window.userCan(mod.id,'acesso');
  const style = disabled ? 'opacity:.45;pointer-events:none;filter:grayscale(.8)' : 'cursor:pointer';
  return `<div class="activity-card" ${disabled?'':'onclick="window.renderModulo(\''+mod.id+'\')"'} style="border-top:4px solid ${mod.color};${style}">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <div style="width:60px;height:60px;border-radius:16px;background:${mod.color}22;display:flex;align-items:center;justify-content:center;font-size:32px">${mod.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="card-title" style="font-size:16px">${_md.esc(mod.label)}</div>
        <div class="card-obs">${_md.esc(mod.desc)}</div>
      </div>
    </div>
    <div class="card-foot">
      <div style="font-size:11px;color:var(--muted);font-weight:600">${grupos.length} grupo(s) · ${total} lançamento(s)</div>
      <div class="card-btns" style="font-size:18px;color:${mod.color}">➡️</div>
    </div>
  </div>`;
}

window.renderModulos = function(){
  const html = MODULOS.filter(m=>window.userCan(m.id,'acesso')).map(_mdCard).join('');
  _md.setC(`<div class="page-title" style="font-size:clamp(20px,3.2vw,34px);font-weight:800;margin-bottom:4px">🏠 Central de Lançamentos</div>
    <div class="page-sub">Escolha abaixo o tipo de controle que deseja acessar</div>
    <div class="cards-grid">${html || '<div class="empty" style="grid-column:1/-1">Nenhum módulo liberado para o seu usuário.</div>'}</div>`);
};

window.renderModulo = function(id){
  const mod = _configuredModules(true).find(x=>x.id===id);
  if(!mod){ toast('Módulo não encontrado','error'); return; }
  if(!window.userCan(id,'acesso')){ toast('Acesso negado a este módulo','error'); return; }
  renderModuloGrupos(mod);
};

function renderModuloGrupos(mod){
  if(mod.id==='atendimentos')return renderDemandas();
  const grupos = _md.grupos(mod);
  const title = `${mod.icon} ${mod.label}`;
  const moduleScope=S.permissoes?.modulos?.[mod.id];
  const podeCriar = S.isAdmin||window.userCanCreateGroups()&&window.userCan(mod.id,'criar')&&(moduleScope?.escopo_configurado!==true||moduleScope?.todos_grupos?.gerenciar===true);
  const podeEditar = window.userCan(mod.id,'editar');
  const admin = window.S && S.isAdmin;
  const pode = admin || podeEditar;
  const novo = admin || podeCriar ? `<button class="btn-action primary demand-create-primary" onclick="window.criarGrupoModulo('${mod.id}')">＋ Criar grupo</button>` : '';
  const mass = pode&&window.userCanDeleteGroups() ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-left:auto"><label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" id="ce-sel-all" onchange="window._ceToggleAllGrupos(this.checked)"> Selecionar todos</label><button class="btn-action" style="background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c" onclick="window._ceExcluirSelecionados('${mod.id}')">🗑️ Excluir selecionados</button></div>` : '';
  const cards = grupos.map((g,index)=>{
    const p=_md.pct(g), col=_md.pColor(p);
    const total=_md.ativTotal(g),well=g.controle_pocos==1||g.extra_fields?.controle_pocos==1;
    const protegido=isFieldDemandGroup(g);
    const podeGrupo=(admin||window.userCanGroup(g,'editar'))&&!protegido;
    return `<article class="module-group-row" style="--module-accent:${mod.color}" data-gid="${_md.esc(g.id)}" data-audit-id="${_md.esc(g.id)}">
      ${podeGrupo&&window.userCanDeleteGroups()?`<input type="checkbox" class="cb-grupo module-group-checkbox" value="${_md.esc(g.id)}" aria-label="Selecionar ${_md.esc(g.name||'grupo')}">`:''}
      <button type="button" class="module-group-open" onclick="window.openActivity(${_md.arg(g.id)})">
        <span class="module-group-number">${String(index+1).padStart(2,'0')}</span>
        <span class="module-group-copy"><strong>${_md.esc(g.name||'Sem nome')}</strong>${g.observacoes?`<small>${_md.esc(g.observacoes)}</small>`:''}</span>
      </button>
      <span class="module-group-total"><b>${total}</b> lançamento${total===1?'':'s'}</span>
      <span class="module-group-progress" style="--progress:${col}"><span><b>${p}%</b> ${well?'pagos':'concluído'}</span><i><b style="width:${p}%"></b></i></span>
      <div class="module-group-actions">
        ${podeGrupo?`<button type="button" class="card-btn" onclick="window.stepModuleGroup(${_md.arg(g.id)},${_md.arg(mod.id)},-1)" ${index===0?'disabled':''} aria-label="Mover ${_md.esc(g.name)} para cima" title="Mover para cima">↑</button><button type="button" class="card-btn" onclick="window.stepModuleGroup(${_md.arg(g.id)},${_md.arg(mod.id)},1)" ${index===grupos.length-1?'disabled':''} aria-label="Mover ${_md.esc(g.name)} para baixo" title="Mover para baixo">↓</button>`:''}
        ${podeGrupo?`<button type="button" class="card-btn" onclick="window.openSecModal(${_md.arg(g.id)})" aria-label="Editar ${_md.esc(g.name)}" title="Editar grupo">✎</button>`:''}
        ${admin?`<button type="button" class="card-btn transfer" onclick="window.openModuleGroupTransfer(${_md.arg(g.id)},${_md.arg(mod.id)})" aria-label="Transferir ${_md.esc(g.name)}" title="Transferir lançamentos ou grupo">⇄ <span>Transferir</span></button>`:''}
        ${podeGrupo&&window.userCanDeleteGroups()?`<button type="button" class="card-btn danger" onclick="window.confirmarExcluirAtividade(${_md.arg(g.id)})" aria-label="Excluir ${_md.esc(g.name)}" title="Enviar grupo para a lixeira">🗑</button>`:''}
        <button type="button" class="card-btn" onclick="${well?`window.gerarPdfPocos(${_md.arg(g.id)})`:`window.gerarPdf(${_md.arg(g.id)})`}" aria-label="PDF de ${_md.esc(g.name)}" title="Gerar PDF">PDF</button>
      </div>
    </article>`;
  }).join('') || `<div class="empty">Nenhum grupo de <strong>${_md.esc(mod.label)}</strong> cadastrado ainda.<br>Clique em <strong>+ Novo Grupo</strong> para começar.</div>`;
  _md.setC(`<section class="module-groups-shell" style="--module-accent:${mod.color}"><div class="page-title">${title}</div>
    <div class="page-sub">${_md.esc(mod.desc)}</div>
    <div class="module-groups-toolbar">
      ${novo}
      <button class="btn-action" onclick="window.setView('mod')">← Voltar ao início</button>
      <button class="btn-action" onclick="window.gerarRelatorioModulo('${mod.id}')">📄 PDF do módulo</button>
      ${mass}
    </div>
    <div class="module-group-list">${cards}</div></section>`);
  window.refreshAuditUI?.();
}

window.stepModuleGroup=async function(id,modId,delta){
 const mod=_configuredModules(true).find(module=>module.id===modId),group=window.S?.secs?.find(item=>item.id===id);if(!mod||!group||!window.userCanGroup?.(group,'editar'))return;
 const list=_md.grupos(mod),index=list.findIndex(item=>item.id===id),target=index+delta;if(index<0||target<0||target>=list.length)return;
 [list[index],list[target]]=[list[target],list[index]];
 try{await Promise.all(list.map((item,order)=>window.updateDoc(window.doc(window.db,'secretariats',item.id),{order_num:order,updated_at:window.serverTimestamp()})));await window.loadData();renderModuloGrupos(mod);window.toast('Ordem dos grupos atualizada!','success');}catch(error){window.toast('Não foi possível reordenar: '+(error.message||error),'error',7000);}
};

function transferGroupOptions(sourceId){
  return _configuredModules(true).map(mod=>{
    const options=_md.grupos(mod).filter(g=>g.id!==sourceId).map(g=>`<option value="${_md.esc(g.id)}">${_md.esc(g.name||'Sem nome')}</option>`).join('');
    return options?`<optgroup label="${_md.esc(mod.label)}">${options}</optgroup>`:'';
  }).join('');
}

window.toggleModuleTransferMode=function(mode){
  document.querySelectorAll('[data-transfer-panel]').forEach(el=>el.hidden=el.dataset.transferPanel!==mode);
  document.querySelectorAll('.module-transfer-choice').forEach(el=>el.classList.toggle('selected',el.dataset.mode===mode));
};

window.openModuleGroupTransfer=function(id,modId){
  if(!window.S?.isAdmin){toast('Somente o administrador pode transferir grupos e lançamentos.','error');return;}
  const group=S.secs.find(g=>g.id===id);if(!group)return;
  const secretarias=(S.secretarias||[]).filter(s=>s.demandas_ativa).sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR'));
  window.__moduleGroupTransfer={id,modId};
  openModal('Transferir conteúdo',group.name||'Grupo',`<p class="module-transfer-intro">Escolha exatamente o que deseja mover. A transferência conserva responsáveis, autoria, datas, fotos, campos e subitens.</p>
    <div class="module-transfer-choices">
      <button type="button" class="module-transfer-choice selected" data-mode="content" onclick="toggleModuleTransferMode('content')"><b>⇄ Apenas os lançamentos</b><small>Move todos os lançamentos para outro grupo. Este grupo permanece vazio no local atual.</small></button>
      <button type="button" class="module-transfer-choice" data-mode="group" onclick="toggleModuleTransferMode('group')"><b>▤ Grupo completo</b><small>Leva este card, com todo o conteúdo, para uma secretaria em Demandas.</small></button>
    </div>
    <form onsubmit="event.preventDefault();confirmModuleGroupTransfer()">
      <div data-transfer-panel="content" class="form-group"><label for="module-transfer-group">Grupo de destino</label><select id="module-transfer-group"><option value="">Selecione o grupo que receberá os lançamentos…</option>${transferGroupOptions(id)}</select></div>
      <div data-transfer-panel="group" class="form-group" hidden><label for="module-transfer-secretaria">Secretaria de destino</label><select id="module-transfer-secretaria"><option value="">Selecione a secretaria…</option>${secretarias.map(s=>`<option value="${_md.esc(s.id)}">${_md.esc(s.name)}</option>`).join('')}</select><small>O grupo passará a seguir o layout de Demandas por Secretarias.</small></div>
      <div class="module-transfer-summary" id="module-transfer-summary"><b>${_md.ativTotal(group)}</b> lançamento(s) neste grupo</div>
      <div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-save" id="module-transfer-save">Transferir com segurança</button></div>
    </form>`);
};

window.confirmModuleGroupTransfer=async function(){
  if(window.__moduleTransferBusy||!S.isAdmin)return;
  const state=window.__moduleGroupTransfer;if(!state)return;
  const mode=document.querySelector('.module-transfer-choice.selected')?.dataset.mode||'content';
  const targetGroup=document.getElementById('module-transfer-group')?.value||null;
  const targetSecretaria=document.getElementById('module-transfer-secretaria')?.value||null;
  if(mode==='content'&&!targetGroup){toast('Escolha o grupo que receberá os lançamentos.','error');return;}
  if(mode==='group'&&!targetSecretaria){toast('Escolha a secretaria de destino.','error');return;}
  const button=document.getElementById('module-transfer-save');window.__moduleTransferBusy=true;button.disabled=true;button.textContent='Transferindo…';
  try{
    const {data,error}=await supabase.rpc('transfer_group_content_admin',{operation:mode,source_group:state.id,target_group:targetGroup,target_secretaria:targetSecretaria});
    if(error)throw error;
    await window.loadData();closeModal();
    if(mode==='group'){
      window.currentDemandSecretaria=targetSecretaria;window.renderModulo('atendimentos');
      toast(`Grupo transferido com ${data?.items||0} lançamento(s)!`,'success');
    }else{
      window.renderModulo(state.modId);toast(`${data?.items||0} lançamento(s) e ${data?.subitems||0} subitem(ns) transferidos!`,'success');
    }
  }catch(error){toast('Não foi possível transferir: '+error.message,'error',8000);button.disabled=false;button.textContent='Transferir com segurança';}
  finally{window.__moduleTransferBusy=false;}
};

window._ceToggleAllGrupos=function(checked){
  document.querySelectorAll('.cb-grupo').forEach(cb=>cb.checked=checked);
};

window._ceExcluirSelecionados=async function(modId){
 if(!window.userCanDeleteGroups?.()){window.toast('Seu usuário não tem permissão para excluir grupos.','error',7000);return;}
  const ids=[...document.querySelectorAll('.cb-grupo:checked')].map(cb=>cb.value);
  if(!ids.length){toast('Selecione ao menos um grupo','error'); return;}
  if(ids.some(id=>isFieldDemandGroup(S.secs.find(group=>group.id===id)))){toast('Demandas Gerais de Campo é um grupo permanente e não pode ser excluído.','error',7000);return;}
  const nomes=ids.map(id=>_md.esc(S.secs.find(s=>s.id===id)?.name||'Grupo')).slice(0,20).join('\n');
  const mais=ids.length>20?`\n... e mais ${ids.length-20}`:'';
  if(!confirm(`Enviar ${ids.length} grupo(s) para a lixeira?\n\n${nomes}${mais}\n\nTodos os itens, subitens e lançamentos vinculados irão juntos e poderão ser restaurados pela lixeira.`)) return;
  for(const id of ids){
    const its=S.items.filter(i=>i.atividade_id===id);
    for(const it of its){const sbs=S.subitems.filter(s=>s.item_id===it.id);for(const sb of sbs)await window.wDeleteDoc(doc(db,'subitems',sb.id),{...sb},'Excluir sub-item');const orig=S.items.find(i=>i.id===it.id);if(orig)await window.wDeleteDoc(doc(db,'items',it.id),{...orig},'Excluir item');}
    const fts=S.fieldTemplates.filter(t=>t.atividade_id===id);for(const ft of fts)await window.wDeleteDoc(doc(db,'fieldTemplates',ft.id),{...ft},'Excluir campo');
    const estqs=S.estoque.filter(e=>e.atividade_id===id);for(const e of estqs)await window.wDeleteDoc(doc(db,'estoque',e.id),{...e},'Excluir lançamento');
    const reqs=S.requisicoes.filter(r=>r.atividade_id===id);for(const r of reqs)await window.wDeleteDoc(doc(db,'requisicoes',r.id),{...r},'Excluir requisição');
    const contas=S.contas.filter(c=>c.atividade_id===id);for(const c of contas)await window.wDeleteDoc(doc(db,'contas',c.id),{...c},'Excluir conta');
    const distrs=(S.distribuicao||[]).filter(d=>d.atividade_id===id);for(const d of distrs)await window.wDeleteDoc(doc(db,'distribuicao',d.id),{...d},'Excluir distribuição');
    const sec=S.secs.find(s=>s.id===id); if(sec) await window.wDeleteDoc(doc(db,'secretariats',id),{...sec},'Excluir grupo');
  }
  await loadData();
  toast(ids.length+' grupo(s) enviado(s) para a lixeira!','success');
  window.renderModulo(modId);
};

window.criarGrupoModulo = async function(modId,secretariaId=null){
  const mod = MODULOS.find(x=>x.id===modId); if(!mod) return;
  if(!window.userCanCreateGroups()){ toast('Seu usuário não tem permissão para criar grupos.','error'); return; }
  if(!window.userCan(modId,'criar')){ toast('Sem permissão para criar neste módulo','error'); return; }
  const scope=window.S?.permissoes?.modulos?.[modId];
  if(!window.S?.isAdmin&&scope?.escopo_configurado===true){
    const allowed=modId==='atendimentos'?window.userCanDemandSecretaria(secretariaId,'editar'):scope.todos_grupos?.gerenciar===true;
    if(!allowed){toast('Seu acesso permite gerenciar grupos existentes, mas não criar neste local.','error');return;}
  }
  const base = {
    name: modId==='atendimentos'?'Novo grupo de demandas':`Novo ${mod.label}`,
    description: mod.desc,
    observacoes: '',
    responsaveis: '',
    start_date: null,
    end_date: null,
    order_num: (window.S && S.secs && S.secs.length) || 0,
    controle_pendencias: 0,
    controle_contas: 0,
    controle_distribuicao: 0,
    show_stats:0, items_view_mode:'list', subitems_view_mode:'list', show_verba:0, verba_on_subitems:0, verba_sum_subitems:0, verba_has_obs:0,
    show_origem_verba:0, origem_verba_on_subitems:0, origem_verba_has_obs:0,
    show_documentacao:0, documentacao_on_subitems:0, documentacao_has_obs:0,
    show_licitacao:0, licitacao_on_subitems:0, licitacao_has_obs:0,
    extra_fields: {modulo: mod.modulo || mod.id},
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };
  if(modId==='atendimentos'){
    if(!S.secretarias.some(s=>s.id===secretariaId&&s.demandas_ativa)){toast('Selecione uma secretaria para o grupo.','error');return;}
    base.demanda_secretaria_id=secretariaId;
    base.demandas_view_default=window.getDemandViewDefault?.()||'list';
  }
  if(mod.flag) base[mod.flag] = 1;
  try{
    const ref = await addDoc(collection(db,'secretariats'), base);
    await loadData();
    window.renderModulo(modId);
    window.openSecModal(ref.id);
  }catch(e){
    console.error(e);
    toast('Erro ao criar grupo','error');
  }
};

window.gerarRelatorioModulo = async function(modId){
  const mod = MODULOS.find(x=>x.id===modId); if(!mod){ toast('Módulo não encontrado','error'); return; }
  if(!window.jspdf || !window.jspdf.jsPDF){ toast('jsPDF não carregado','error'); return; }
  toast('Gerando PDF do módulo…','info',8000);
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const W = 210, mx = 14;
  const now = new Date().toLocaleString('pt-BR');
  doc.setFillColor(15,23,42); doc.rect(0,0,W,30,'F');
  doc.setTextColor(226,232,240); doc.setFontSize(18); doc.text(`${mod.icon} ${mod.label}`, mx, 18);
  doc.setTextColor(148,163,184); doc.setFontSize(10); doc.text(`Prefeitura de Sertania - PE • ${now}`, mx, 25);
  let y = 38;
  const grupos = _md.grupos(mod);
  for(const g of grupos){
    if(y > 260){ doc.addPage(); y = 20; }
    doc.setTextColor(226,232,240); doc.setFontSize(13); doc.text(_md.esc(g.name||'Sem nome'), mx, y); y += 7;
    const items = ((window.S && S.items) || []).filter(i=>i.atividade_id===g.id).sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    if(items.length){
      const rows = items.map((it, idx)=>{
        const subs = ((window.S && S.subitems) || []).filter(s=>s.item_id===it.id && s.parent_type!=='subitem');
        const done = subs.length ? subs.every(s=>s.concluded==1) : it.concluded==1;
        return [String(idx+1), _md.esc(it.description||''), done ? 'Concluído' : 'Pendente', _md.fmtD(it.deadline_date)];
      });
      doc.autoTable({startY:y, head:[['#','Descrição','Situação','Prazo']], body:rows,
        margin:{left:mx, right:mx}, styles:{fontSize:9, textColor:226232240, fillColor:[15,23,42]},
        headStyles:{fillColor:[59,130,246], textColor:255}, theme:'grid'});
      y = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setTextColor(100,116,139); doc.setFontSize(9); doc.text('Nenhum lançamento neste grupo.', mx, y); y += 8;
    }
  }
  if(!grupos.length){
    doc.setTextColor(100,116,139); doc.setFontSize(11); doc.text('Nenhum grupo cadastrado neste módulo.', mx, y);
  }
  doc.save(`relatorio-${mod.id}-${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF do módulo gerado!','success');
};

/* Relatório institucional padronizado pelo modelo de Perfuração de Poços. */
window.gerarRelatorioModulo = async function(modId){
  const mod=MODULOS.find(x=>x.id===modId);
  if(!mod){toast('Módulo não encontrado','error');return;}
  if(!window.jspdf?.jsPDF){toast('jsPDF não carregado','error');return;}
  toast('Gerando relatório institucional…','info',8000);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297,mx=14;
  let logo=null;
  try{logo=await window.loadB64?.('img/logo_sertania.png','png',120);}catch(e){}
  const header=()=>{
    doc.setFillColor(247,250,248);doc.rect(0,0,W,31,'F');
    doc.setFillColor(33,135,82);doc.rect(0,0,4,31,'F');
    doc.setDrawColor(121,184,65);doc.setLineWidth(.7);doc.line(0,31,W,31);
    if(logo?.d)doc.addImage(logo.d,'PNG',W-30,5,16,20,undefined,'FAST');
    doc.setTextColor(15,53,43);doc.setFont('helvetica','bold');doc.setFontSize(16);
    doc.text(`RELATÓRIO - ${String(mod.label).toUpperCase()}`,mx,14);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(78,105,96);
    doc.text(`Prefeitura Municipal de Sertânia - Emitido em ${new Date().toLocaleString('pt-BR')}`,mx,21);
  };
  const footer=()=>{
    const pg=doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFillColor(12,61,49);doc.rect(0,H-13,W,13,'F');
    doc.setTextColor(225,242,234);doc.setFontSize(7);doc.setFont('helvetica','bold');
    doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES',mx,H-5);
    doc.text(`Página ${pg}`,W-mx,H-5,{align:'right'});
  };
  header();
  let y=40;
  const grupos=_md.grupos(mod);
  for(const g of grupos){
    if(y>253){footer();doc.addPage();header();y=40;}
    doc.setFillColor(231,244,235);doc.roundedRect(mx,y-5,W-mx*2,9,1.5,1.5,'F');
    doc.setTextColor(24,98,61);doc.setFont('helvetica','bold');doc.setFontSize(10);
    doc.text(String(g.name||'Sem nome'),mx+3,y+1);y+=8;
    const items=((window.S&&S.items)||[]).filter(i=>i.atividade_id===g.id).sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    if(items.length){
      const rows=items.map((it,idx)=>{
        const subs=((window.S&&S.subitems)||[]).filter(s=>s.item_id===it.id&&s.parent_type!=='subitem');
        const done=subs.length?subs.every(s=>s.concluded==1):it.concluded==1;
        return[String(idx+1),String(it.description||''),done?'Concluído':'Em andamento',_md.fmtD(it.deadline_date)];
      });
      doc.autoTable({startY:y,head:[['#','Descrição','Situação','Prazo']],body:rows,
        margin:{left:mx,right:mx,top:38,bottom:20},theme:'grid',
        styles:{fontSize:8,textColor:[33,52,63],lineColor:[218,228,224],lineWidth:.2,cellPadding:2.2},
        headStyles:{fillColor:[22,104,70],textColor:[255,255,255],fontStyle:'bold'},
        alternateRowStyles:{fillColor:[247,250,248]},
        didDrawPage:()=>{if(doc.internal.getCurrentPageInfo().pageNumber>1)header();}});
      y=doc.lastAutoTable.finalY+10;
    }else{
      doc.setTextColor(104,122,115);doc.setFontSize(8);
      doc.text('Nenhum lançamento neste grupo.',mx,y);y+=8;
    }
  }
  if(!grupos.length){doc.setTextColor(104,122,115);doc.text('Nenhum grupo cadastrado neste módulo.',mx,y);}
  const pages=doc.internal.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);footer();}
  doc.save(`RELATORIO-${String(mod.id).toUpperCase()}-${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF do módulo gerado!','success');
};

window.modForSec = s => _md.modFor(s);

/* ── PAINEL INSTITUCIONAL 2026 ────────────────────────────────────────────
   A navegação foi reorganizada sem alterar as rotinas ou os dados dos módulos. */
function _visibleModules(){
  return _configuredModules(false).filter(m=>window.userCan(m.id,'acesso'));
}

function _moduleNumbers(mod){
  if(mod.especial)return{grupos:[],total:Number(window.extintoresCachedCount||0)};
  const grupos=_md.grupos(mod);
  return{
    grupos,
    total:grupos.reduce((sum,g)=>sum+_md.ativTotal(g),0)
  };
}

function _renderSidebarModules(activeId=''){
  const host=document.getElementById('sidebar-modules');
  if(!host)return;
  host.innerHTML=_visibleModules().map(mod=>{
    const numbers=_moduleNumbers(mod);
    return `<button type="button" class="sidebar-module-btn ${activeId===mod.id?'active':''}" onclick="${mod.id==='atendimentos'?"window.openDemandSecretaria()":`window.renderModulo('${mod.id}')`}" title="${_md.esc(mod.label)}" style="--module-soft:${mod.color}28;--module-color:${mod.color}">
      <span class="sidebar-module-icon">${mod.icon}</span>
      <span class="sidebar-module-label">${_md.esc(mod.label)}</span>
      <span class="sidebar-module-count">${numbers.grupos.length}</span>
    </button>${mod.id==='atendimentos'?demandSidebar(activeId===mod.id):''}`;
  }).join('');
}
window.refreshSidebarModules=_renderSidebarModules;

window.renderModulos=function(){
  const mods=_visibleModules();
  const numbers=mods.map(mod=>({mod,..._moduleNumbers(mod)}));
  const totalGroups=numbers.reduce((sum,item)=>sum+item.grupos.length,0);
  const totalEntries=numbers.reduce((sum,item)=>sum+item.total,0);
  _renderSidebarModules('');
  const directory=numbers.map(({mod,grupos,total})=>`<button type="button" class="module-row" onclick="window.renderModulo('${mod.id}')" style="--module-soft:${mod.color}18;--module-color:${mod.color}">
    <span class="module-row-icon">${mod.icon}</span>
    <span class="module-row-copy">
      <span class="module-row-title">${_md.esc(mod.label)}</span>
      <span class="module-row-meta">${grupos.length} grupo(s) · ${total} lançamento(s)</span>
    </span>
    <span class="module-row-action" aria-hidden="true">›</span>
  </button>`).join('');
  _md.setC(`<section class="home-shell" aria-labelledby="home-title">
    <div class="home-hero">
      <div>
        <div class="workspace-kicker">Central integrada</div>
        <h1 class="home-title" id="home-title">Gestão municipal em um só lugar</h1>
        <p class="home-copy">Acesse as áreas operacionais, acompanhe os registros e mantenha as informações da Prefeitura organizadas com rapidez.</p>
      </div>
      <div class="home-totals" aria-label="Resumo geral">
        <div class="home-total"><strong>${totalGroups}</strong><span>Grupos ativos</span></div>
        <div class="home-total"><strong>${totalEntries}</strong><span>Lançamentos</span></div>
      </div>
    </div>
    <div class="home-directory">
      <div class="home-directory-head"><h2>Áreas de trabalho</h2><span>${mods.length} áreas disponíveis para o seu perfil</span></div>
      <div class="module-directory">${directory||'<div class="empty">Nenhuma área liberada para o seu usuário.</div>'}</div>
    </div>
  </section>`);
};

/* Visão geral produtiva: captura em campo e acesso direto às secretarias. */
const _dashboardIcons={
  people:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h1m12 7v-2a5 5 0 0 0-5-5h-1m-4 7v-2a5 5 0 0 1 10 0v2"/>',
  building:'<path d="M3 21h18M5 18V8l7-4 7 4v10M9 10v6m6-6v6M8 21v-3h8v3"/>',
  leaf:'<path d="M20 4C12 4 5 7 5 14c0 3 2 5 5 5 7 0 10-7 10-15Z"/><path d="M4 21c3-6 7-10 13-13"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="M12 8v8m-3-4h6"/>',
  megaphone:'<path d="m3 11 13-5v12L3 14v-3Z"/><path d="M7 15v5h4l-1-4m9-7a4 4 0 0 1 0 6"/>',
  book:'<path d="M4 5a3 3 0 0 1 3-1h5v16H7a3 3 0 0 0-3 1V5Zm16 0a3 3 0 0 0-3-1h-5v16h5a3 3 0 0 1 3 1V5Z"/>',
  chart:'<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  road:'<path d="m8 3-4 18m12-18 4 18M12 5v4m0 4v6"/>',
  heart:'<path d="M20 5c-2-2-5-2-7 0l-1 1-1-1C9 3 6 3 4 5c-3 3-1 8 8 15 9-7 11-12 8-15Z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
  file:'<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M9 13h6m-6 4h6"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-2-2-3-3 1a7 7 0 0 0-2-1l-1-3h-3L9 6a7 7 0 0 0-2 1L4 6 2 9l2 2a7 7 0 0 0 0 2l-2 2 2 3 3-1a7 7 0 0 0 2 1l1 3h3l1-3a7 7 0 0 0 2-1l3 1 2-3-2-2a7 7 0 0 0 .1-1Z"/>',
  tools:'<path d="m14 7 3-3 3 3-3 3M4 20l10-10M6 4l4 4-2 2-4-4V4h2Zm9 10 5 5-1 1-5-5"/>',
  bus:'<path d="M5 4h14a2 2 0 0 1 2 2v10H3V6a2 2 0 0 1 2-2Z"/><path d="M3 11h18M7 16v3m10-3v3M6 20h2m8 0h2"/>',
  tree:'<path d="M12 22v-7m0 2-4-3m4 1 4-4"/><path d="M7 13a5 5 0 1 1 10 0 4 4 0 0 1-5 2 4 4 0 0 1-5-2Z"/>',
  scales:'<path d="M12 3v18M5 7h14M7 7l-4 7h8L7 7Zm10 0-4 7h8l-4-7ZM8 21h8"/>'
};
function _dashboardSvg(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${_dashboardIcons[name]||_dashboardIcons.building}</svg>`;}
function _dashboardVisual(name,index){
  const value=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const rules=[[/ACAO SOCIAL|ASSISTENCIA/,'people','#2563eb','#e8f2ff'],[/ADMINISTRACAO|FINANCAS/,'building','#2563eb','#e8f2ff'],[/AGRICULTURA|MEIO AMBIENTE/,'leaf','#16835f','#e5f6ee'],[/CEDOCA|CONSELHO/,'people','#d84d5b','#fff0f2'],[/COMUNICACAO/,'megaphone','#6657c8','#f0edff'],[/CULTURA|TURISMO|ESPORTE/,'book','#b87818','#fff4d9'],[/DEFESA CIVIL/,'shield','#d84d5b','#fff0f2'],[/EDUCACAO/,'book','#2878b9','#e8f5ff'],[/GABINETE/,'user','#2868ad','#e9f3ff'],[/INFRAESTRUTURA|OBRAS/,'road','#a86b16','#fff2d7'],[/SAUDE/,'heart','#d94e65','#ffedf1'],[/DESENVOLVIMENTO/,'gear','#3970ba','#edf3ff'],[/SEGURANCA/,'shield','#4b57b8','#efefff'],[/SERVICOS PUBLICOS/,'tools','#a96b16','#fff2da'],[/TRANSPORTES|FROTA/,'bus','#2878b9','#e6f5ff'],[/NEMIP|PLANEJAMENTO/,'file','#7655c6','#f2edff'],[/JURIDICO/,'scales','#5266a8','#edf1ff']];
  const matched=rules.find(([pattern])=>pattern.test(value));
  if(matched)return{icon:matched[1],color:matched[2],soft:matched[3]};
  const fallback=[['building','#2878b9','#e8f5ff'],['tree','#16835f','#e7f7ef'],['shield','#6657c8','#f1efff'],['people','#d84d5b','#fff0f2']][index%4];
  return{icon:fallback[0],color:fallback[1],soft:fallback[2]};
}
let _dashboardSecretaryView=localStorage.getItem('dashboard-secretary-view')==='list'?'list':'grid';
window.filterDashboardSecretaries=function(value){
  const query=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();let visible=0;
  document.querySelectorAll('.secretary-launch-card').forEach(card=>{card.hidden=!!query&&!card.dataset.search.includes(query);if(!card.hidden)visible++;});
  const count=document.getElementById('dashboard-secretary-count');if(count)count.textContent=`${visible} secretaria${visible===1?'':'s'}`;
};
window.setDashboardSecretaryView=function(mode){
  _dashboardSecretaryView=mode==='list'?'list':'grid';localStorage.setItem('dashboard-secretary-view',_dashboardSecretaryView);
  document.querySelector('.secretary-launch-grid')?.classList.toggle('is-list',_dashboardSecretaryView==='list');
  document.querySelectorAll('[data-dashboard-view]').forEach(button=>{const active=button.dataset.dashboardView===_dashboardSecretaryView;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
};
window.renderModulos=function(){
  const demandModule=MODULOS.find(mod=>mod.id==='atendimentos');
  const groups=_md.grupos(demandModule);
  const secretaries=(S.secretarias||[]).filter(secretary=>secretary.demandas_ativa&&(S.isAdmin||window.userCanDemandSecretaria(secretary.id,'acesso')||groups.some(group=>group.demanda_secretaria_id===secretary.id))).sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR'));
  _renderSidebarModules('');
  const cards=secretaries.map((secretary,index)=>{
    const own=groups.filter(group=>group.demanda_secretaria_id===secretary.id);
    const total=own.reduce((sum,group)=>sum+_md.ativTotal(group),0);
    const visual=_dashboardVisual(secretary.name,index),search=String(secretary.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return `<button type="button" class="secretary-launch-card" style="--secretary-color:${visual.color};--secretary-soft:${visual.soft}" data-search="${_md.esc(search)}" onclick="openDemandSecretaria(${_md.arg(secretary.id)})"><span class="secretary-launch-icon">${_dashboardSvg(visual.icon)}</span><span class="secretary-launch-copy"><strong>${_md.esc(secretary.name)}</strong><span>${own.length} grupo(s) · ${total} lançamento(s)</span></span><span class="secretary-launch-arrow" aria-hidden="true">›</span></button>`;
  }).join('');
  _md.setC(`<section class="dashboard-shell productivity-dashboard" aria-labelledby="dashboard-title">
    <header class="productivity-heading"><div><span class="workspace-kicker">Painel de gestão</span><h1 id="dashboard-title">Gestão na Palma da Mão</h1><p>Mais organização. Mais agilidade. Uma cidade bem cuidada.</p></div><button type="button" class="dashboard-new-demand" onclick="openFieldCapture()" ${secretaries.length?'':'disabled'}><b>＋</b> Nova demanda</button></header>
    <div class="dashboard-field-focus">${fieldCaptureDashboardCard()}</div>
    <section class="secretary-launch-section"><header><div><span class="workspace-kicker">Acesso direto</span><h2>Demandas por secretaria</h2><p>Acesse rapidamente as áreas de atuação do município.</p></div><div class="secretary-launch-tools"><label><span>⌕</span><input type="search" aria-label="Buscar secretaria" placeholder="Buscar secretaria..." oninput="filterDashboardSecretaries(this.value)"></label><div class="secretary-view-toggle" role="group" aria-label="Formato de visualização"><button type="button" data-dashboard-view="grid" class="${_dashboardSecretaryView==='grid'?'active':''}" aria-pressed="${_dashboardSecretaryView==='grid'}" onclick="setDashboardSecretaryView('grid')" title="Grade">▦</button><button type="button" data-dashboard-view="list" class="${_dashboardSecretaryView==='list'?'active':''}" aria-pressed="${_dashboardSecretaryView==='list'}" onclick="setDashboardSecretaryView('list')" title="Lista">☷</button></div></div></header><div class="secretary-launch-summary"><span id="dashboard-secretary-count">${secretaries.length} secretaria${secretaries.length===1?'':'s'}</span></div><div class="secretary-launch-grid ${_dashboardSecretaryView==='list'?'is-list':''}">${cards||'<div class="empty">Nenhuma secretaria de demandas está liberada para o seu perfil.</div>'}</div></section>
  </section>`);
};

const _renderModuloBeforeRedesign=window.renderModulo;
window.renderModulo=function(id){
  _renderSidebarModules(id);
  document.querySelectorAll('#navmenu > .nav-btn').forEach(btn=>btn.classList.remove('active'));
  return _renderModuloBeforeRedesign(id);
};
