/* Central de licitações: anos, grupos independentes e planilhas editáveis/offline. */
import {supabase,collection,doc,addDoc,updateDoc,deleteDoc,serverTimestamp} from '../supabase_compat.js?v=3';

(function(){
  'use strict';
  const YEAR='licitacao_ano',GROUP='licitacao_grupo',ROW='licitacao_lancamento';
  const STATUSES=['CONCLUÍDO','PENDENTE','SOLICITADO','AUTORIZADO','EM AVALIAÇÃO','EM EXECUÇÃO','RESSALVA'];
  const COLUMNS=[
    {key:'processo',label:'N° PROCESSO',width:140},{key:'modalidade',label:'MODALIDADE',width:145},
    {key:'objeto',label:'OBJETO',width:270},{key:'fornecedor_numero',label:'FORNECEDOR / N°',width:210},
    {key:'contrato',label:'CONTRATO',width:130},{key:'valor_global',label:'VALOR GLOBAL',width:145},
    {key:'vigencia',label:'VIGÊNCIA',width:170},{key:'obs',label:'OBS',width:250}
  ];
  const SEED_GROUPS=['FUNDO GERAL','SEC. EDUCAÇÃO','SEC. SAÚDE','SEC. ASSISTÊNCIA SOCIAL'];
  const state={secId:'',scope:'2025',groupId:'',search:'',saving:false,seedJobs:new Map(),seeded:new Set(),selected:new Set(),anchor:null};
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const arg=v=>String(JSON.stringify(String(v??''))).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const val=(row,key,fallback='')=>row?.[key]??row?.extra_fields?.[key]??fallback;
  const type=row=>val(row,'registro_tipo');
  const statuses=row=>{const s=val(row,'status_list',[]);return Array.isArray(s)?s.filter(x=>STATUSES.includes(norm(x))):[];};
  const canEdit=sec=>Boolean(window.S?.isAdmin||window.userCanGroup?.(sec,'editar'));
  const currentSec=()=>window.S?.secs?.find(s=>String(s.id)===String(state.secId));
  const years=()=>window.S.items.filter(x=>x.atividade_id===state.secId&&type(x)===YEAR).sort((a,b)=>Number(val(a,'ano'))-Number(val(b,'ano')));
  const looseGroups=()=>window.S.items.filter(x=>x.atividade_id===state.secId&&type(x)===GROUP);
  const yearGroups=yearId=>window.S.subitems.filter(x=>x.atividade_id===state.secId&&type(x)===GROUP&&String(val(x,'parent_id',x.item_id))===String(yearId));
  const allGroups=()=>[...looseGroups(),...years().flatMap(y=>yearGroups(y.id))];
  const findGroup=id=>allGroups().find(x=>String(x.id)===String(id));
  const groupRows=group=>window.S.subitems.filter(x=>x.atividade_id===state.secId&&type(x)===ROW&&String(val(x,'parent_id'))===String(group?.id)).sort((a,b)=>(Number(a.order_num)||0)-(Number(b.order_num)||0));
  const groupYear=g=>type(g)===GROUP&&g.item_id?years().find(y=>String(y.id)===String(g.item_id)):null;
  const now=()=>serverTimestamp();
  const money=v=>{if(v===''||v==null)return null;if(typeof v==='number')return Number.isFinite(v)?v:null;let s=String(v).trim().replace(/R\$\s?/gi,'').replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null;};
  const moneyBR=v=>v===''||v==null?'':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const statusSlug=s=>norm(s).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const statusBadges=list=>list.length?list.map(s=>`<span class="lic-status ${statusSlug(s)}">${esc(s)}</span>`).join(''):'<span class="lic-status vazio">SEM STATUS</span>';
  const columnsFor=g=>{const saved=val(g,'table_columns',[]);return Array.isArray(saved)&&saved.length?saved:COLUMNS;};
  const payloadBase=(extra={})=>({updated_at:now(),...extra});

  window.isLicitacaoGroup=function(sec){
    if(!sec)return false;
    return val(sec,'controle_licitacoes')===1||val(sec,'controle_licitacoes')===true||norm(sec.name||sec.description)==='LICITACAO';
  };

  async function createYear(year){
    const existing=years().find(y=>Number(val(y,'ano'))===Number(year));if(existing)return existing;
    const data={atividade_id:state.secId,description:String(year),order_num:Number(year),created_at:now(),updated_at:now(),registro_tipo:YEAR,ano:Number(year)};
    const ref=await addDoc(collection(supabase,'items'),data);const row={id:ref.id,...data};window.S.items.push(row);return row;
  }
  async function createGroup(name,year=null){
    const data={atividade_id:state.secId,description:name,order_num:year?yearGroups(year.id).length:looseGroups().length,created_at:now(),updated_at:now(),registro_tipo:GROUP,ano:year?Number(val(year,'ano')):null,parent_id:year?.id||null,parent_type:year?'item':'atividade',status_list:[],table_columns:COLUMNS};
    const table=year?'subitems':'items';if(year)data.item_id=year.id;
    const ref=await addDoc(collection(supabase,table),data);const row={id:ref.id,...data};window.S[table].push(row);return row;
  }
  async function seed(secId){
    if(state.seedJobs.has(secId))return state.seedJobs.get(secId);
    const job=(async()=>{
      const sec=window.S.secs.find(s=>String(s.id)===String(secId));if(!sec||!canEdit(sec))return;
      state.secId=secId;
      if(!val(sec,'controle_licitacoes')){await updateDoc(doc(supabase,'secretariats',sec.id),{controle_licitacoes:1,updated_at:now()});sec.controle_licitacoes=1;}
      const y2025=await createYear(2025);await createYear(2026);
      for(const name of SEED_GROUPS){if(!yearGroups(y2025.id).some(g=>norm(g.description)===norm(name)))await createGroup(name,y2025);}
      state.seeded.add(secId);
      await window.loadData();
    })().finally(()=>state.seedJobs.delete(secId));
    state.seedJobs.set(secId,job);return job;
  }
  function seedReady(){const y25=years().find(y=>Number(val(y,'ano'))===2025),y26=years().find(y=>Number(val(y,'ano'))===2026);return Boolean(y25&&y26&&SEED_GROUPS.every(name=>yearGroups(y25.id).some(g=>norm(g.description)===norm(name))));}

  function top(sec){
    const rows=allGroups().flatMap(groupRows),total=rows.reduce((s,r)=>s+(money(val(r,'valor_global'))||0),0);
    return `<section class="lic-page"><header class="lic-hero"><div><div class="lic-kicker">🏛️ Secretaria de Finanças</div><h1>Licitações</h1><p>Anos, grupos e processos independentes, organizados em planilhas de alta produtividade.</p></div><div class="lic-hero-stats"><span><b>${years().length}</b> anos</span><span><b>${allGroups().length}</b> grupos</span><span><b>${rows.length}</b> lançamentos</span><span><b>${esc(moneyBR(total)||'R$ 0,00')}</b> valor global</span></div></header><div class="lic-toolbar"><button class="btn-action" onclick="renderModulo('atendimentos')">← Demandas</button>${canEdit(sec)?'<button class="btn-action primary" onclick="openLicitacaoYearModal()">＋ Ano</button><button class="btn-action" onclick="openLicitacaoGroupModal()">＋ Grupo</button>':''}<label class="lic-search"><span>⌕</span><input id="lic-search" type="search" value="${esc(state.search)}" placeholder="Buscar grupo, processo, objeto ou fornecedor" oninput="licitacaoSearch(this.value)"></label></div>`;
  }
  function scopeTabs(){
    return `<nav class="lic-year-tabs" aria-label="Anos das licitações">${years().map(y=>`<button class="${state.scope===String(val(y,'ano'))?'active':''}" onclick="selectLicitacaoScope('${esc(val(y,'ano'))}')"><span>${esc(val(y,'ano'))}</span><small>${yearGroups(y.id).length} grupos</small></button>`).join('')}<button class="${state.scope==='sem-ano'?'active':''}" onclick="selectLicitacaoScope('sem-ano')"><span>Sem ano</span><small>${looseGroups().length} grupos permanentes</small></button></nav>`;
  }
  function groupCard(g){
    const rows=groupRows(g),sum=rows.reduce((s,r)=>s+(money(val(r,'valor_global'))||0),0),q=norm(state.search);
    if(q){const hay=norm([g.description,...rows.flatMap(r=>COLUMNS.map(c=>val(r,c.key))),...rows.flatMap(statuses)].join(' '));if(!hay.includes(q))return '';}
    return `<article class="lic-group-card"><div class="lic-group-head"><div class="lic-folder">🗂</div><div><h3>${esc(g.description||'Grupo sem nome')}</h3><div class="lic-statuses">${statusBadges(statuses(g))}</div></div></div><div class="lic-group-metrics"><span><b>${rows.length}</b> processos</span><span><b>${esc(moneyBR(sum)||'R$ 0,00')}</b> valor global</span></div><div class="lic-group-actions"><button class="btn-action primary" onclick="openLicitacaoTable(${arg(g.id)})">Abrir planilha →</button>${canEdit(currentSec())?`<button class="card-btn" title="Status do grupo" onclick="openLicitacaoStatus('group',${arg(g.id)})">🏷️</button><button class="card-btn" title="Renomear grupo" onclick="openLicitacaoGroupModal(${arg(g.id)})">✏️</button><button class="card-btn danger" title="Excluir grupo" onclick="deleteLicitacaoGroup(${arg(g.id)})">🗑️</button>`:''}</div></article>`;
  }
  function renderGroups(sec){
    const year=years().find(y=>String(val(y,'ano'))===state.scope),groups=state.scope==='sem-ano'?looseGroups():(year?yearGroups(year.id):[]);
    const cards=groups.map(groupCard).join('');
    document.getElementById('content').innerHTML=top(sec)+scopeTabs()+`<div class="lic-scope-head"><div><h2>${state.scope==='sem-ano'?'Grupos permanentes':'Exercício '+esc(state.scope)}</h2><p>${state.scope==='sem-ano'?'Grupos que continuam fora de um exercício específico.':'Cada grupo e seus lançamentos pertencem exclusivamente a este ano.'}</p></div>${canEdit(sec)?`<button class="btn-action primary" onclick="openLicitacaoGroupModal()">＋ Novo grupo ${state.scope==='sem-ano'?'permanente':'em '+esc(state.scope)}</button>`:''}</div><div class="lic-groups">${cards||`<div class="lic-empty"><b>Nenhum grupo encontrado.</b><span>${state.search?'Limpe a busca ou tente outro termo.':'Crie o primeiro grupo desta seção.'}</span></div>`}</div></section>`;
  }
  function statusChoices(selected=[],prefix='lic-st'){
    return STATUSES.map((s,i)=>`<label class="lic-status-choice"><input type="checkbox" id="${prefix}-${i}" value="${esc(s)}" ${selected.includes(s)?'checked':''}><span class="lic-status ${statusSlug(s)}">${esc(s)}</span></label>`).join('');
  }
  function rowHtml(r,index,cols,editable){
    const list=r?statuses(r):[],rid=r?.id||'',cells=cols.map((c,col)=>`<td><input ${editable?'':'disabled'} class="lic-cell" data-row="${index}" data-col="${col}" data-key="${esc(c.key)}" value="${esc(c.key==='valor_global'&&val(r,c.key)!==''?moneyBR(val(r,c.key)):val(r,c.key))}" ${c.key==='valor_global'?'inputmode="decimal"':''} autocomplete="off"></td>`).join('');
    return `<tr data-id="${esc(rid)}" data-index="${index}"><td class="lic-row-number">${index+1}</td>${cells}<td class="lic-row-status"><details><summary>${list.length?`${list.length} status`:'Selecionar'}</summary><div class="lic-status-menu">${statusChoices(list,'rs-'+index)}</div></details></td>${editable?`<td class="lic-row-actions"><button type="button" title="Excluir linha" onclick="deleteLicitacaoRow(this)">×</button></td>`:''}</tr>`;
  }
  function renderTable(sec,g){
    const cols=columnsFor(g),rows=groupRows(g),editable=canEdit(sec),year=groupYear(g);
    document.getElementById('content').innerHTML=`<section class="lic-page lic-table-page"><div class="lic-table-title"><button class="btn-action" onclick="backLicitacaoGroups()">← Grupos</button><div><div class="lic-kicker">${year?'Exercício '+esc(val(year,'ano')):'Grupo permanente'}</div><h1>${esc(g.description)}</h1><div class="lic-statuses">${statusBadges(statuses(g))}</div></div><div class="lic-table-title-actions">${editable?`<button class="btn-action" onclick="openLicitacaoStatus('group',${arg(g.id)})">🏷️ Status do grupo</button><button class="btn-action" onclick="appendLicitacaoRows(5)">＋ 5 linhas</button><button class="btn-action primary btn-save" onclick="saveLicitacaoTable()">💾 Salvar planilha</button>`:''}</div></div><div class="lic-grid-hint"><b>Planilha inteligente</b><span>Copie e cole do Excel. Use <kbd>Ctrl+C</kbd>, <kbd>Ctrl+V</kbd>, <kbd>Ctrl+D</kbd>, setas, Tab e Enter. Arraste para selecionar várias células.</span></div><div class="lic-table-wrap sticky-scroll-source"><table class="lic-grid"><colgroup><col style="width:44px">${cols.map(c=>`<col style="width:${Number(c.width)||160}px">`).join('')}<col style="width:170px">${editable?'<col style="width:48px">':''}</colgroup><thead><tr><th>#</th>${cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>STATUS</th>${editable?'<th></th>':''}</tr></thead><tbody id="lic-grid-body">${rows.map((r,i)=>rowHtml(r,i,cols,editable)).join('')}${editable?Array.from({length:Math.max(3,rows.length?1:5)},(_,i)=>rowHtml(null,rows.length+i,cols,true)).join(''):''}</tbody></table></div><div class="lic-table-footer"><span>${rows.length} lançamento(s) salvo(s) neste grupo.</span>${editable?'<button class="btn-action primary btn-save" onclick="saveLicitacaoTable()">💾 Salvar todos os lançamentos</button>':''}</div></section>`;
    bindGrid();
  }

  window.renderLicitacoes=function(secId){
    state.secId=String(secId);const sec=currentSec();if(!sec)return;
    if(!state.seeded.has(state.secId)&&seedReady())state.seeded.add(state.secId);
    if(!state.seeded.has(state.secId)&&canEdit(sec)){
      document.getElementById('content').innerHTML='<div class="lic-loading"><span></span><b>Preparando a Central de Licitações…</b><small>Criando os exercícios e grupos iniciais sem duplicar dados.</small></div>';
      seed(state.secId).then(()=>{if(!years().some(y=>String(val(y,'ano'))===state.scope))state.scope=years()[0]?String(val(years()[0],'ano')):'sem-ano';window.renderLicitacoes(state.secId);}).catch(e=>{console.error(e);window.toast('Não foi possível preparar as licitações: '+(e.message||e),'error',8000);});return;
    }
    if(state.groupId){const g=findGroup(state.groupId);if(g){renderTable(sec,g);return;}state.groupId='';}
    if(!years().some(y=>String(val(y,'ano'))===state.scope)&&state.scope!=='sem-ano')state.scope=years()[0]?String(val(years()[0],'ano')):'sem-ano';renderGroups(sec);
  };
  window.selectLicitacaoScope=s=>{state.scope=String(s);state.groupId='';window.renderLicitacoes(state.secId);};
  window.licitacaoSearch=v=>{state.search=v||'';renderGroups(currentSec());requestAnimationFrame(()=>{const el=document.getElementById('lic-search');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}});};
  window.openLicitacaoTable=id=>{state.groupId=String(id);state.search='';window.renderLicitacoes(state.secId);};
  window.backLicitacaoGroups=()=>{state.groupId='';window.renderLicitacoes(state.secId);};

  window.openLicitacaoYearModal=function(){
    window.openModal('📅 Novo exercício','Crie um ano independente para receber seus próprios grupos e lançamentos.',`<form onsubmit="event.preventDefault();saveLicitacaoYear()"><div class="form-group"><label>Ano *</label><input id="lic-year" type="number" min="2000" max="2200" value="${new Date().getFullYear()}" inputmode="numeric" required></div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" type="submit">Criar ano</button></div></form>`);
  };
  window.saveLicitacaoYear=async function(){const year=Number(document.getElementById('lic-year')?.value);if(year<2000||year>2200){window.toast('Informe um ano entre 2000 e 2200.','error');return;}if(years().some(y=>Number(val(y,'ano'))===year)){window.toast('Este ano já existe.','info');return;}try{await createYear(year);await window.loadData();state.scope=String(year);window.closeModal();window.toast(`Ano ${year} criado!`);window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível criar o ano: '+(e.message||e),'error');}};
  window.openLicitacaoGroupModal=function(id=''){
    const g=findGroup(id),currentYear=years().find(y=>String(val(y,'ano'))===state.scope),selected=g?(groupYear(g)?.id||'sem-ano'):(currentYear?.id||'sem-ano');
    window.openModal(g?'✏️ Editar grupo':'🗂 Novo grupo de licitações','O grupo manterá uma planilha e status totalmente independentes.',`<form onsubmit="event.preventDefault();saveLicitacaoGroup(${arg(id)})"><div class="form-group"><label>Nome do grupo *</label><input id="lic-group-name" maxlength="140" value="${esc(g?.description||'')}" placeholder="Ex.: Solicitação de Licitações" required></div>${g?'':`<div class="form-group"><label>Localização</label><select id="lic-group-year">${years().map(y=>`<option value="${esc(y.id)}" ${selected===y.id?'selected':''}>Ano ${esc(val(y,'ano'))}</option>`).join('')}<option value="sem-ano" ${selected==='sem-ano'?'selected':''}>Fora dos anos · grupo permanente</option></select></div>`}<div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" type="submit">${g?'Salvar nome':'Criar grupo e planilha'}</button></div></form>`);
  };
  window.saveLicitacaoGroup=async function(id=''){
    const name=document.getElementById('lic-group-name')?.value.trim();if(!name){window.toast('Informe o nome do grupo.','error');return;}
    try{const g=findGroup(id);if(g){await updateDoc(doc(supabase,window.S.items.some(x=>x.id===g.id)?'items':'subitems',g.id),payloadBase({description:name}));}
      else{const yearId=document.getElementById('lic-group-year')?.value,year=years().find(y=>String(y.id)===String(yearId));await createGroup(name,year||null);state.scope=year?String(val(year,'ano')):'sem-ano';}
      await window.loadData();window.closeModal();window.toast(g?'Grupo atualizado!':'Grupo e planilha criados!');window.renderLicitacoes(state.secId);
    }catch(e){window.toast('Não foi possível salvar o grupo: '+(e.message||e),'error',8000);}
  };
  window.openLicitacaoStatus=function(kind,id){
    const entity=kind==='group'?findGroup(id):window.S.subitems.find(x=>x.id===id);if(!entity)return;
    window.openModal('🏷️ Status simultâneos',kind==='group'?'Estes status representam o grupo inteiro. Marque quantos precisar.':'Marque todos os status aplicáveis ao lançamento.',`<div class="lic-status-picker">${statusChoices(statuses(entity),'modal-st')}</div><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="saveLicitacaoStatus('${kind}',${arg(id)})">Salvar status</button></div>`);
  };
  window.saveLicitacaoStatus=async function(kind,id){const list=[...document.querySelectorAll('.lic-status-picker input:checked')].map(x=>x.value),entity=kind==='group'?findGroup(id):window.S.subitems.find(x=>x.id===id);if(!entity)return;const table=window.S.items.some(x=>x.id===entity.id)?'items':'subitems';try{await updateDoc(doc(supabase,table,entity.id),payloadBase({status_list:list,status:list[0]||null,concluded:list.includes('CONCLUÍDO')?1:0}));await window.loadData();window.closeModal();window.toast('Status atualizados!');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível salvar os status: '+(e.message||e),'error');}};

  window.appendLicitacaoRows=function(count=5){const body=document.getElementById('lic-grid-body'),g=findGroup(state.groupId);if(!body||!g)return;const start=body.rows.length,cols=columnsFor(g);body.insertAdjacentHTML('beforeend',Array.from({length:count},(_,i)=>rowHtml(null,start+i,cols,true)).join(''));bindGrid();body.rows[start]?.querySelector('.lic-cell')?.focus();};
  window.deleteLicitacaoRow=async function(button){const tr=button.closest('tr'),id=tr?.dataset.id;if(!id){tr?.remove();reindexRows();return;}if(!confirm('Excluir este lançamento da planilha?'))return;try{await deleteDoc(doc(supabase,'subitems',id));await window.loadData();window.toast('Lançamento excluído.');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível excluir: '+(e.message||e),'error');}};
  window.deleteLicitacaoGroup=async function(id){const g=findGroup(id);if(!g||!confirm(`Excluir o grupo "${g.description}" e todos os seus lançamentos?`))return;try{for(const r of groupRows(g))await deleteDoc(doc(supabase,'subitems',r.id));await deleteDoc(doc(supabase,window.S.items.some(x=>x.id===g.id)?'items':'subitems',g.id));await window.loadData();window.toast('Grupo excluído.');window.renderLicitacoes(state.secId);}catch(e){window.toast('Não foi possível excluir o grupo: '+(e.message||e),'error');}};
  window.saveLicitacaoTable=async function(){
    if(state.saving){window.toast('A planilha já está sendo salva. Aguarde.','info');return;}const g=findGroup(state.groupId),body=document.getElementById('lic-grid-body');if(!g||!body)return;
    const trs=[...body.querySelectorAll('tr')],year=groupYear(g);let changed=0;state.saving=true;
    try{for(let index=0;index<trs.length;index++){const tr=trs[index],values={};tr.querySelectorAll('.lic-cell').forEach(input=>values[input.dataset.key]=input.value.trim());const list=[...tr.querySelectorAll('.lic-status-menu input:checked')].map(x=>x.value),used=Object.values(values).some(Boolean)||list.length;if(!used&&!tr.dataset.id)continue;values.valor_global=money(values.valor_global);const data={atividade_id:state.secId,item_id:year?.id||g.id,parent_id:g.id,parent_type:year?'subitem':'item',description:values.objeto||values.processo||'Licitação',observacao:values.obs||'',order_num:index,registro_tipo:ROW,...values,status_list:list,status:list[0]||null,concluded:list.includes('CONCLUÍDO')?1:0,updated_at:now()};if(tr.dataset.id)await updateDoc(doc(supabase,'subitems',tr.dataset.id),data);else{data.created_at=now();await addDoc(collection(supabase,'subitems'),data);}changed++;}
      await window.loadData();window.toast(navigator.onLine?`${changed} linha(s) salvas com sucesso!`:`${changed} linha(s) salvas neste aparelho. A sincronização ocorrerá quando a internet voltar.`,'success',6000);window.renderLicitacoes(state.secId);
    }catch(e){console.error(e);window.toast('Não foi possível salvar a planilha: '+(e.message||e),'error',9000);}finally{state.saving=false;window.releaseSaveButtons?.();}
  };

  function reindexRows(){document.querySelectorAll('#lic-grid-body tr').forEach((tr,i)=>{tr.dataset.index=i;const n=tr.querySelector('.lic-row-number');if(n)n.textContent=i+1;tr.querySelectorAll('.lic-cell').forEach(x=>x.dataset.row=i);});}
  function cells(){return [...document.querySelectorAll('#lic-grid-body .lic-cell')];}
  function cellAt(r,c){return document.querySelector(`#lic-grid-body .lic-cell[data-row="${r}"][data-col="${c}"]`);}
  function clearSelection(){cells().forEach(x=>x.classList.remove('selected','selection-edge'));state.selected.clear();}
  function selectRect(a,b){clearSelection();const r1=Math.min(a.r,b.r),r2=Math.max(a.r,b.r),c1=Math.min(a.c,b.c),c2=Math.max(a.c,b.c);for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const el=cellAt(r,c);if(el){el.classList.add('selected');state.selected.add(`${r}:${c}`);}}}
  function selectedMatrix(){const pos=[...state.selected].map(x=>x.split(':').map(Number));if(!pos.length)return null;const rs=pos.map(x=>x[0]),cs=pos.map(x=>x[1]),r1=Math.min(...rs),r2=Math.max(...rs),c1=Math.min(...cs),c2=Math.max(...cs);return{r1,r2,c1,c2};}
  function gridKey(e){
    const el=e.target.closest('.lic-cell');if(!el)return;const r=Number(el.dataset.row),c=Number(el.dataset.col);
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();const box=selectedMatrix()||{r1:r,r2:r,c1:c,c2:c},multi=box.r2>box.r1,sourceRow=multi?box.r1:box.r1-1,targetStart=multi?box.r1+1:box.r1;if(sourceRow<0)return;for(let col=box.c1;col<=box.c2;col++){const source=cellAt(sourceRow,col)?.value??'';for(let row=targetStart;row<=box.r2;row++){const target=cellAt(row,col);if(target)target.value=source;}}return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){const box=selectedMatrix();if(box){e.preventDefault();const text=Array.from({length:box.r2-box.r1+1},(_,ri)=>Array.from({length:box.c2-box.c1+1},(_,ci)=>cellAt(box.r1+ri,box.c1+ci)?.value||'').join('\t')).join('\n');navigator.clipboard?.writeText(text);}return;}
    const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Enter:[1,0]};let move=moves[e.key];if(e.key==='Tab')move=[0,e.shiftKey?-1:1];if(!move)return;if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&el.selectionStart!==el.selectionEnd)return;e.preventDefault();let nr=r+move[0],nc=c+move[1];const max=columnsFor(findGroup(state.groupId)).length-1;if(nc>max){nc=0;nr++;}if(nc<0){nc=max;nr--;}const target=cellAt(nr,nc);if(target){target.focus();target.select();if(e.shiftKey)selectRect(state.anchor||{r,c},{r:nr,c:nc});else{state.anchor={r:nr,c:nc};selectRect(state.anchor,state.anchor);}}
  }
  function gridPaste(e){const el=e.target.closest('.lic-cell');if(!el)return;const text=e.clipboardData?.getData('text/plain');if(!text||(!text.includes('\t')&&!text.includes('\n')))return;e.preventDefault();const startR=Number(el.dataset.row),startC=Number(el.dataset.col),data=text.replace(/\r/g,'').split('\n').filter((x,i,a)=>x!==''||i<a.length-1).map(x=>x.split('\t'));const required=startR+data.length-document.querySelectorAll('#lic-grid-body tr').length;if(required>0)window.appendLicitacaoRows(required);data.forEach((row,ri)=>row.forEach((v,ci)=>{const target=cellAt(startR+ri,startC+ci);if(target)target.value=v;}));selectRect({r:startR,c:startC},{r:startR+data.length-1,c:startC+Math.max(...data.map(x=>x.length))-1});}
  function bindGrid(){const body=document.getElementById('lic-grid-body');if(!body||body.dataset.bound)return;body.dataset.bound='1';body.addEventListener('keydown',gridKey);body.addEventListener('paste',gridPaste);body.addEventListener('pointerdown',e=>{const el=e.target.closest('.lic-cell');if(!el)return;const p={r:Number(el.dataset.row),c:Number(el.dataset.col)};if(e.shiftKey&&state.anchor)selectRect(state.anchor,p);else{state.anchor=p;selectRect(p,p);}body.dataset.selecting='1';document.addEventListener('pointerup',()=>{delete body.dataset.selecting;},{once:true});});body.addEventListener('pointerover',e=>{if(body.dataset.selecting!=='1'||!state.anchor)return;const el=e.target.closest('.lic-cell');if(el)selectRect(state.anchor,{r:Number(el.dataset.row),c:Number(el.dataset.col)});});}

  window.__licitacaoTest={YEAR,GROUP,ROW,STATUSES,COLUMNS,SEED_GROUPS,norm,money,isLicitacaoGroup:window.isLicitacaoGroup};
})();
