import {supabase} from '../supabase_compat.js';
import {UNASSIGNED,demandSections,demandSecretaria,reorderDemand,demandMatches} from './demandas-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Encode IDs before embedding in handlers (including apostrophes in legacy IDs).
const arg=s=>esc(JSON.stringify(String(s??'')));
let api,mode='list',query='',busy=false,drag=null,creatingGroup=false;
try{mode=localStorage.getItem('pms-demandas-view')==='cards'?'cards':'list';}catch{}
const can=action=>window.userCan?.('atendimentos',action);
const groups=()=>api.groups();
const sections=()=>demandSections(groups(),window.S.secretarias||[]);
const selected=()=>window.currentDemandSecretaria||'';
const selectionLabel=()=>sections().find(s=>s.id===selected())?.name||'Todas as secretarias';
const secretaryOf=g=>demandSecretaria(g,window.S.secretarias||[]);
const canOrder=()=>can('editar')&&!query.trim()&&!busy;
function button(label,fn,cls='',attrs=''){return `<button type="button" class="btn-action ${cls}" onclick="${fn}" ${attrs}>${label}</button>`;}
function titleFor(s){return s.id===UNASSIGNED?s.name:/secretaria/i.test(s.name)?s.name:`Secretaria de ${s.name}`;}
export function initDemandas(options){api=options;}
export function demandSidebar(active){
 const current=selected();
 return `<div class="demand-subnav" aria-label="Secretarias de demandas">${sections().map(s=>`<button type="button" class="demand-subnav-btn ${active&&current===s.id?'active':''}" onclick="openDemandSecretaria(${arg(s.id)})" title="${esc(titleFor(s))}" ${active&&current===s.id?'aria-current="page"':''}><span class="demand-dot ${s.id===UNASSIGNED?'pending':''}"></span><span>${esc(s.name)}</span><b>${s.groups.length}</b></button>`).join('')}</div>`;
}
window.openDemandSecretaria=function(id=''){
 window.currentDemandSecretaria=id;query='';window.renderModulo('atendimentos');
};
window.setDemandView=function(value){
 mode=value==='cards'?'cards':'list';try{localStorage.setItem('pms-demandas-view',mode);}catch{}
 renderDemandas();
};
window.searchDemandas=function(value){query=value;renderResults();};
function row(g,index){
 const pct=api.pct(g),total=api.total(g),well=g.controle_pocos==1||g.extra_fields?.controle_pocos==1;
 const sid=secretaryOf(g),list=groups().filter(x=>secretaryOf(x)===sid),position=list.findIndex(x=>x.id===g.id);
 const subtitle=[g.assunto||g.extra_fields?.assunto,g.observacoes].filter(Boolean).join(' · ');
 const permission=can('editar'),order=canOrder();
 return `<article class="demand-row ${mode==='cards'?'demand-card':''}" data-demand-id="${esc(g.id)}" data-secretaria="${esc(sid)}" data-audit-id="${esc(g.id)}">
  ${permission?`<input class="cb-grupo demand-checkbox" type="checkbox" value="${esc(g.id)}" aria-label="Selecionar ${esc(g.name)}" onchange="updateDemandSelection()"><span class="demand-order"><button type="button" class="demand-drag" draggable="${order}" ${order?'':'disabled'} aria-label="Arrastar ${esc(g.name)} para reordenar" title="Arraste para ordenar; use Alt + ↑ ou ↓ pelo teclado" onkeydown="demandOrderKey(event,${arg(g.id)})">⠿</button><span class="demand-order-arrows"><button type="button" onclick="stepDemand(${arg(g.id)},-1)" ${!order||position===0?'disabled':''} aria-label="Mover ${esc(g.name)} para cima">↑</button><button type="button" onclick="stepDemand(${arg(g.id)},1)" ${!order||position===list.length-1?'disabled':''} aria-label="Mover ${esc(g.name)} para baixo">↓</button></span></span>`:''}
  ${mode==='cards'?`<div class="demand-cover">${g.cover_url?`<img src="${esc(g.cover_url)}" alt="" loading="lazy">`:'<span>▤</span>'}</div>`:''}
  <button type="button" class="demand-open" onclick="openActivity(${arg(g.id)})"><span class="demand-number">${String(index+1).padStart(2,'0')}</span><span class="demand-copy"><strong>${esc(g.name||'Sem nome')}</strong>${subtitle?`<small title="${esc(subtitle)}">${esc(subtitle)}</small>`:''}</span></button>
  <span class="demand-total"><b>${total}</b> <span>lançamentos</span></span>
  <span class="demand-progress ${pct===100?'complete':''}" title="${pct}% ${well?'pagos':'concluídos'}"><span>${pct}% <small>${well?'pagos':'concluído'}</small></span><i><b style="width:${pct}%"></b></i></span>
  <div class="demand-actions">${permission?`${button('✎',`openSecModal(${arg(g.id)})`,'',`aria-label="Editar ${esc(g.name)}" title="Editar grupo"`)}${button('⇄ <span>Transferir</span>',`openDemandTransfer(${arg(g.id)})`,'demand-transfer',`aria-label="Transferir ${esc(g.name)}" title="Transferir grupo para outra secretaria"`)}`:''}${button('PDF',well?`gerarPdfPocos(${arg(g.id)})`:`gerarPdf(${arg(g.id)})`,'',`aria-label="PDF de ${esc(g.name)}"`)}</div>
 </article>`;
}
export function renderDemandas(){
 const all=groups(),secs=sections();
 if(selected()&&!secs.some(s=>s.id===selected()))window.currentDemandSecretaria='';
 const create=can('criar');
 document.getElementById('content').innerHTML=`<section class="demand-shell" aria-labelledby="demand-title">
  <header class="demand-heading"><div><span class="workspace-kicker">Organização municipal</span><h1 id="demand-title">Demandas por Secretarias</h1><p>As demandas no lugar certo. Cada grupo, todos os seus lançamentos.</p></div><div class="demand-summary"><b>${secs.filter(s=>s.id!==UNASSIGNED).length}<small>secretarias</small></b><b>${all.length}<small>grupos</small></b><b>${all.reduce((n,g)=>n+api.total(g),0)}<small>lançamentos</small></b></div></header>
  <div class="demand-toolbar"><div class="demand-create">${create?button('＋ Nova secretaria','openDemandSecretariaModal()','primary')+button('＋ Novo grupo','newDemandGroup()'):''}${button('PDF do módulo',"gerarRelatorioModulo('atendimentos')")}</div><div class="demand-view" role="group" aria-label="Visualização dos grupos">${button('☰ Lista',"setDemandView('list')",mode==='list'?'selected':'',`aria-pressed="${mode==='list'}"`)}${button('▦ Cards',"setDemandView('cards')",mode==='cards'?'selected':'',`aria-pressed="${mode==='cards'}"`)}</div></div>
  <div class="demand-filterbar"><label class="demand-search"><span aria-hidden="true">⌕</span><input id="demand-search" type="search" value="${esc(query)}" placeholder="Buscar grupo, assunto ou responsável…" aria-label="Buscar grupos de demandas" oninput="searchDemandas(this.value)"></label><label class="demand-filter">Secretaria <select aria-label="Filtrar por secretaria" onchange="openDemandSecretaria(this.value)"><option value="">Todas as secretarias</option>${secs.map(s=>`<option value="${esc(s.id)}" ${selected()===s.id?'selected':''}>${esc(s.name)} (${s.groups.length})</option>`).join('')}</select></label></div>
  <div class="demand-context"><span>${esc(selectionLabel())}</span><small>${can('editar')?'Arraste pela alça ⠿ para ordenar. Use ⇄ para transferir.':'Selecione um grupo para consultar os lançamentos.'}</small></div>
  ${can('editar')?`<div class="demand-bulk"><label><input type="checkbox" id="ce-sel-all" onchange="_ceToggleAllGrupos(this.checked);updateDemandSelection()"> Selecionar grupos visíveis</label><button type="button" class="btn-action" id="demand-delete-selected" disabled onclick="_ceExcluirSelecionados('atendimentos')">Excluir selecionados</button></div>`:''}<div id="demand-results"></div><div id="demand-status" class="demand-sr" role="status" aria-live="polite"></div>
 </section>`;
 renderResults();window.refreshSidebarModules?.('atendimentos');
}
function renderResults(){
 const host=document.getElementById('demand-results');if(!host)return;
 const all=sections().filter(s=>!selected()||s.id===selected());
 let found=0;
 host.innerHTML=all.map(s=>{
  const filtered=s.groups.filter(g=>demandMatches(g,query));found+=filtered.length;
  if(query.trim()&&!filtered.length)return '';
  return `<section class="demand-section" data-demand-section="${esc(s.id)}"><header class="demand-section-head"><div><span class="demand-section-icon ${s.id===UNASSIGNED?'pending':''}">${s.id===UNASSIGNED?'?':'▥'}</span><h2>${esc(titleFor(s))}</h2><span class="demand-count">${filtered.length}</span></div>${can('criar')?button('＋ Grupo',`newDemandGroup(${arg(s.id)})`,'',`aria-label="Criar grupo em ${esc(s.name)}"`):''}</header><div class="demand-group-list ${mode==='cards'?'demand-grid':''}">${filtered.map(row).join('')||'<div class="demand-empty">Esta secretaria está pronta para receber seus grupos.</div>'}</div></section>`;
 }).join('');
 if(!all.length||(!found&&query.trim()))host.innerHTML=`<div class="demand-empty"><strong>${query.trim()?'Nenhum grupo encontrado':'Vamos organizar as demandas'}</strong><p>${query.trim()?'Tente outro nome ou escolha todas as secretarias.':'Cadastre uma secretaria e adicione o primeiro grupo.'}</p></div>`;
 host.classList.toggle('is-busy',busy);host.setAttribute('aria-busy',String(busy));
 bindDrag(host);window.updateDemandSelection();window.refreshAuditUI?.();
}
window.updateDemandSelection=function(){
 const boxes=[...document.querySelectorAll('.demand-checkbox')],count=boxes.filter(el=>el.checked).length;
 const button=document.getElementById('demand-delete-selected'),all=document.getElementById('ce-sel-all');
 if(button){button.disabled=!count||busy;button.textContent=count?`Excluir selecionados (${count})`:'Excluir selecionados';}
 if(all){all.checked=!!boxes.length&&count===boxes.length;all.indeterminate=count>0&&count<boxes.length;}
};
async function run(operation,args,success){
 if(busy)return false;busy=true;renderResults();
 try{
  const {data,error}=await supabase.rpc('organize_demandas',{operation,...args});if(error)throw error;
  await window.loadData();window.toast(success);return data||true;
 }catch(e){window.toast('Não foi possível salvar: '+e.message,'error',7000);return false;}
 finally{busy=false;if(document.querySelector('.demand-shell'))renderDemandas();window.refreshSidebarModules?.('atendimentos');}
}
window.openDemandSecretariaModal=function(){
 if(!can('criar'))return;
 window.openModal('Nova secretaria de demandas','Cadastre uma secretaria ou aproveite o cadastro municipal existente.',`<form onsubmit="event.preventDefault();saveDemandSecretaria()"><div class="form-group"><label for="demand-existing">Usar secretaria existente</label><select id="demand-existing" onchange="document.getElementById('demand-secretaria-name').disabled=!!this.value"><option value="">Cadastrar pelo nome…</option>${(window.S.secretarias||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div><div class="form-group"><label for="demand-secretaria-name">Nome da secretaria</label><input id="demand-secretaria-name" maxlength="120" placeholder="Ex.: Secretaria de Saúde" autocomplete="off"></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-save" id="demand-secretaria-save">Salvar secretaria</button></div></form>`);
 document.getElementById('demand-secretaria-name').focus();
};
window.saveDemandSecretaria=async function(){
 if(!can('criar')||busy)return;
 const id=document.getElementById('demand-existing').value,name=document.getElementById('demand-secretaria-name').value.trim();
 if(!id&&!name){window.toast('Informe o nome da secretaria.','error');return;}
 const button=document.getElementById('demand-secretaria-save');button.disabled=true;
 const result=await run('secretaria',{secretaria:id||null,secretaria_name:name||null},'Secretaria disponível nas demandas!');
 if(result){window.closeModal();window.openDemandSecretaria(result.id);}else button.disabled=false;
};
window.openDemandTransfer=function(id){
 if(!can('editar')||busy)return;
 const g=groups().find(g=>g.id===id);if(!g)return;
 const sid=secretaryOf(g);
 window.openModal('Transferir grupo',g.name,`<p class="demand-modal-hint">Todos os itens, subitens, fotos e históricos continuam vinculados ao grupo.</p><form onsubmit="event.preventDefault();confirmDemandTransfer(${arg(id)})"><div class="form-group"><label for="demand-transfer-target">Secretaria de destino</label><select id="demand-transfer-target"><option value="">Selecione uma secretaria</option>${sections().filter(s=>s.id!==sid&&s.id!==UNASSIGNED).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="submit" id="demand-transfer-save" class="btn-save">Transferir grupo</button></div></form>`);
};
window.confirmDemandTransfer=async function(id){
 if(!can('editar')||busy)return;
 const target=document.getElementById('demand-transfer-target').value;
 if(!target){window.toast('Escolha a secretaria de destino.','error');return;}
 const button=document.getElementById('demand-transfer-save');button.disabled=true;
 const result=await run('move',{group_id:id,secretaria:target},'Grupo transferido com todos os lançamentos!');
 if(result){window.closeModal();window.openDemandSecretaria(target);}else button.disabled=false;
};
window.newDemandGroup=async function(id=selected()){
 if(!can('criar')||busy||creatingGroup)return;
 if(id&&id!==UNASSIGNED){
  creatingGroup=true;window.currentDemandSecretaria=id;
  try{await window.criarGrupoModulo('atendimentos',id);}finally{creatingGroup=false;}
  return;
 }
 window.openModal('Novo grupo de demandas','Escolha a secretaria responsável pelo novo grupo.',`<form onsubmit="event.preventDefault();createDemandGroupInSelection()"><div class="form-group"><label for="demand-new-group-secretaria">Secretaria</label><select id="demand-new-group-secretaria"><option value="">Selecione…</option>${sections().filter(s=>s.id!==UNASSIGNED).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="submit" id="demand-new-group-save" class="btn-save">Criar grupo</button></div></form>`);
};
window.createDemandGroupInSelection=async function(){
 const sid=document.getElementById('demand-new-group-secretaria').value;if(!sid){window.toast('Selecione uma secretaria.','error');return;}
 document.getElementById('demand-new-group-save').disabled=true;
 window.closeModal();await window.newDemandGroup(sid);
};
async function persistOrder(sid,ids){
 const result=await run('reorder',{secretaria:sid===UNASSIGNED?null:sid,group_ids:ids},'Ordem dos grupos salva!');
 if(result&&document.getElementById('demand-status'))document.getElementById('demand-status').textContent='Ordem dos grupos salva.';
}
window.stepDemand=async function(id,delta){
 if(!canOrder())return;const g=groups().find(x=>x.id===id);if(!g)return;
 const sid=secretaryOf(g),ids=groups().filter(x=>secretaryOf(x)===sid).map(x=>x.id),i=ids.indexOf(id),j=i+delta;
 if(j<0||j>=ids.length)return;
 await persistOrder(sid,reorderDemand(ids,id,ids[j],delta>0));
 document.querySelector(`[data-demand-id="${CSS.escape(id)}"] .demand-drag`)?.focus();
};
window.demandOrderKey=function(event,id){
 if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();window.stepDemand(id,event.key==='ArrowUp'?-1:1);}
};
function bindDrag(host){
 const clear=()=>{host.querySelectorAll('.demand-dragging,.demand-drop-before,.demand-drop-after').forEach(el=>el.classList.remove('demand-dragging','demand-drop-before','demand-drop-after'));drag=null;};
 host.ondragstart=e=>{
  if(!canOrder()||!e.target.closest('.demand-drag')){e.preventDefault();return;}
  const row=e.target.closest('[data-demand-id]');drag={id:row.dataset.demandId,sid:row.dataset.secretaria};
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',drag.id);e.dataTransfer.setDragImage(row,30,20);
  row.classList.add('demand-dragging');
 };
 host.ondragover=e=>{
  const row=e.target.closest('[data-demand-id]');if(!drag||!row||row.dataset.secretaria!==drag.sid||row.dataset.demandId===drag.id)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';
  host.querySelectorAll('.demand-drop-before,.demand-drop-after').forEach(el=>el.classList.remove('demand-drop-before','demand-drop-after'));
  const after=e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;
  row.classList.add(after?'demand-drop-after':'demand-drop-before');
 };
 host.ondrop=async e=>{
  const row=e.target.closest('[data-demand-id]');if(!drag||!row||row.dataset.secretaria!==drag.sid){clear();return;}
  e.preventDefault();const {id,sid}=drag,target=row.dataset.demandId,after=row.classList.contains('demand-drop-after');clear();
  if(id===target)return;
  const ids=groups().filter(g=>secretaryOf(g)===sid).map(g=>g.id);
  await persistOrder(sid,reorderDemand(ids,id,target,after));
 };
 host.ondragend=clear;
}
