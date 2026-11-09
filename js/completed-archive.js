const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes=new Map();
const selectedMonths=new Map();
const openRows=new Set(); // cards abertos continuam abertos quando a tela se atualiza
const monthFilters=new Map();
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTH_ABBR=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function dateValue(value){if(!value)return null;const raw=typeof value==='object'&&value.seconds?new Date(value.seconds*1000):new Date(String(value).length===10?String(value)+'T12:00:00':value);return Number.isNaN(raw.valueOf())?null:raw;}
function firstValidDate(...values){for(const value of values){const date=dateValue(value);if(date)return date;}return null;}
function dateLabel(value){const date=dateValue(value);return date?date.toLocaleDateString('pt-BR'):'—';}
export function recordIsCompleted(record){
 const status=String(record?.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return Number(record?.concluded)===1||status==='concluido';
}
function monthInfo(record,parent){
 const date=firstValidDate(record.start_date,parent?.start_date,record.created_at,parent?.created_at,record.conclusion_date);
 return date?{key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,year:String(date.getFullYear()),month:date.getMonth(),label:MONTHS[date.getMonth()],date}:{key:'sem-data',year:'Sem data',month:99,label:'Sem Data Início',date:null};
}

export function activityLane(groupId){return modes.get(groupId)||'active';}
export function selectCompletedArchiveMonth(groupId,monthKey){selectedMonths.set(groupId,monthKey);}
export function clearCompletedArchiveMonth(groupId){selectedMonths.delete(groupId);}
if(typeof window!=='undefined')window.setActivityLane=function(groupId,lane){modes.set(groupId,lane==='completed'?'completed':'active');window.openActivity(groupId);};
if(typeof window!=='undefined'){
 window.setCompletedArchiveMonth=function(groupId,monthKey){selectCompletedArchiveMonth(groupId,monthKey);window.openActivity(groupId);requestAnimationFrame(()=>document.querySelector('.completed-month-screen')?.scrollIntoView({block:'start'}));};
 window.closeCompletedArchiveMonth=function(groupId){clearCompletedArchiveMonth(groupId);window.openActivity(groupId);requestAnimationFrame(()=>document.querySelector('.completed-archive')?.scrollIntoView({block:'start'}));};
}

export function completedArchiveEntries(items,subitems,progress){
 const entries=[],seen=new Set(),byItem=new Map();
 subitems.forEach(sub=>{if(!byItem.has(sub.item_id))byItem.set(sub.item_id,[]);byItem.get(sub.item_id).push(sub);});
 items.forEach(item=>{
  if(recordIsCompleted(item)){entries.push({record:item,parent:null,isSub:false});seen.add(item.id);}
  (byItem.get(item.id)||[]).filter(recordIsCompleted).forEach(sub=>{entries.push({record:sub,parent:item,isSub:true});seen.add(sub.id);});
 });
 // Registros antigos podem ter perdido o pai, mas continuam pertencendo ao grupo.
 // Eles também precisam permanecer visíveis e recuperáveis na interface.
 subitems.filter(sub=>recordIsCompleted(sub)&&!seen.has(sub.id)).forEach(sub=>entries.push({record:sub,parent:null,isSub:true,orphan:true}));
 return entries;
}

export function renderCompletedArchive({group,items,subitems,progress,canEdit}){
 const entries=completedArchiveEntries(items,subitems,progress);
 if(!entries.length)return '<div class="completed-empty"><span>✓</span><strong>Nenhum lançamento concluído ainda</strong><p>Quando um lançamento for concluído, ele será organizado aqui pelo mês e ano da Data Início.</p></div>';
 const months=new Map();entries.forEach(entry=>{const info=monthInfo(entry.record,entry.parent);if(!months.has(info.key))months.set(info.key,{...info,entries:[]});months.get(info.key).entries.push(entry);});
 const years=new Map();[...months.values()].forEach(month=>{if(!years.has(month.year))years.set(month.year,[]);years.get(month.year).push(month);});
 const yearList=[...years.entries()].sort(([a],[b])=>a==='Sem data'?1:b==='Sem data'?-1:Number(b)-Number(a));
 yearList.forEach(([,list])=>list.sort((a,b)=>b.month-a.month));
 const selectedKey=selectedMonths.get(group.id),selected=months.get(selectedKey);
 if(selectedKey&&!selected)selectedMonths.delete(group.id);
 if(!selected)return `<div class="completed-archive">${yearList.map(([year,yearMonths])=>`<section class="completed-year"><header class="completed-year-head"><span>✓</span><div><small>ARQUIVO DE CONCLUÍDOS</small><strong>${esc(year)}</strong></div><b>${yearMonths.reduce((total,month)=>total+month.entries.length,0)} lançamentos</b></header><div class="completed-month-grid">${yearMonths.map(month=>`<button type="button" class="completed-month-card" onclick="setCompletedArchiveMonth('${esc(group.id)}','${esc(month.key)}')"><span class="completed-month-icon">${month.month===99?'—':String(month.month+1).padStart(2,'0')}</span><span class="completed-month-copy"><small>MÊS DA DATA INÍCIO</small><strong>${esc(month.label)}</strong><em>${month.entries.length} lançamento${month.entries.length===1?'':'s'} concluído${month.entries.length===1?'':'s'}</em></span><b>${month.entries.length}</b><i>Abrir mês <span>→</span></i></button>`).join('')}</div></section>`).join('')}</div>`;
 const monthTitle=selected.month===99?'SEM-DATA':`${MONTH_ABBR[selected.month]}-${selected.year}`;
 const S=window.S||{};
 const templates=(S.fieldTemplates||[]).filter(t=>t.atividade_id===group.id);
 const chips=(record,isSub)=>window.recordChipsHtml?window.recordChipsHtml(record,group,{isSub,templates}):'';
 const fieldCount=record=>(window.recordCustomFields?.(record,templates)||[]).length;
 const geo=record=>{try{const e=typeof record.extra_fields==='string'?JSON.parse(record.extra_fields):record.extra_fields;const g=e?.geo_location;return g&&Number.isFinite(Number(g.latitude))&&!(Number(g.latitude)===0&&Number(g.longitude)===0)?g:null;}catch{return null;}};
 const filter=(monthFilters.get(group.id+'|'+selected.key)||'').trim();
 const normTxt=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const rows=selected.entries.sort((a,b)=>(monthInfo(b.record,b.parent).date?.valueOf()||0)-(monthInfo(a.record,a.parent).date?.valueOf()||0)).map(entry=>{
  const record=entry.record,parent=entry.parent,id=esc(record.id),open=openRows.has(record.id),n=fieldCount(record),loc=geo(record);
  const kids=entry.isSub?[]:subitems.filter(s=>s.item_id===record.id);
  const search=normTxt([record.description,record.responsaveis,record.observacao,parent?.description,...(window.recordCustomFields?.(record,templates)||[]).map(f=>f.label+' '+f.value)].join(' '));
  const details=`<div class="cr-details" id="crd-${id}" ${open?'':'hidden'}>
    ${parent?`<p class="cr-parent">↳ Dentro de <b>${esc(parent.description||'item')}</b></p>`:''}
    <dl class="cr-facts"><div><dt>Data início</dt><dd>${dateLabel(record.start_date||parent?.start_date)}</dd></div><div><dt>Conclusão</dt><dd>${dateLabel(record.conclusion_date)}</dd></div>${record.responsaveis?`<div><dt>Responsável</dt><dd>${esc(record.responsaveis)}</dd></div>`:''}${record.updated_by_name?`<div><dt>Última edição</dt><dd>${esc(record.updated_by_name)}</dd></div>`:''}</dl>
    ${chips(record,entry.isSub)||'<p class="cr-empty">Nenhum campo personalizado preenchido neste lançamento.</p>'}
    ${record.observacao?`<p class="cr-note"><b>Observação:</b> ${esc(record.observacao)}</p>`:''}
    ${kids.length?`<div class="cr-kids"><b>Subitens (${kids.length})</b><ul>${kids.map(k=>`<li class="${recordIsCompleted(k)?'is-done':''}">${recordIsCompleted(k)?'✓':'○'} ${esc(k.description||'Sem descrição')}</li>`).join('')}</ul></div>`:''}
    ${loc?`<button type="button" class="cr-map" onclick="openGeoMapFocus('${entry.isSub?'subitems':'items'}','${id}')">📍 Ver no mapa</button>`:''}
  </div>`;
  return `<article class="completed-row cr-card ${open?'is-open':''}" data-cr="${id}" data-search="${esc(search)}" ${filter&&!search.includes(normTxt(filter))?'hidden':''}>
   <div class="cr-head"><div class="completed-row-check" aria-hidden="true">✓</div>
    <button type="button" class="cr-toggle" aria-expanded="${open}" aria-controls="crd-${id}" onclick="toggleCompletedRow('${id}')" title="Mostrar ou recolher os campos deste lançamento"><span class="cr-caret" aria-hidden="true"></span><span class="cr-name">${entry.isSub?'<small>SUBITEM</small> ':''}${esc(record.description||'Sem descrição')}</span>${n?`<em class="cr-count">${n} campo${n===1?'':'s'}</em>`:''}${loc?'<em class="cr-pin" title="Tem localização">📍</em>':''}</button>
    <span class="cr-date"><small>Conclusão</small>${dateLabel(record.conclusion_date)}</span>
    ${canEdit?`<div class="completed-row-actions"><button type="button" onclick="openItemModal('${id}','${esc(group.id)}',${entry.isSub},'${esc(entry.isSub?(record.parent_id||record.item_id):'')}','it-name')">Editar</button><button type="button" onclick="toggleConcluidoPendente('${id}',${entry.isSub})">↺ Reabrir</button></div>`:''}
   </div>${details}</article>`;
 }).join('');
 const anyOpen=selected.entries.some(e=>openRows.has(e.record.id));
 const shownCount=(rows.match(/<article /g)||[]).length-(rows.match(/<article [^>]* hidden>/g)||[]).length;
 return `<section class="completed-month-screen" data-group="${esc(group.id)}" data-month="${esc(selected.key)}"><header class="completed-month-screen-head"><button type="button" onclick="closeCompletedArchiveMonth('${esc(group.id)}')">← Meses</button><div><small>LANÇAMENTOS CONCLUÍDOS</small><h2>${esc(monthTitle)}</h2></div><b>${selected.entries.length} lançamento${selected.entries.length===1?'':'s'}</b>
  <div class="cr-tools"><input type="search" class="cr-search" placeholder="🔎 Procurar neste mês (nome, campos, responsável…)" value="${esc(filter)}" oninput="filterCompletedMonth('${esc(group.id)}','${esc(selected.key)}',this.value)" aria-label="Procurar neste mês"><button type="button" onclick="toggleAllCompletedRows('${esc(group.id)}',${!anyOpen})">${anyOpen?'▴ Recolher todos':'▾ Expandir todos'}</button></div></header>
  <div class="completed-month-list">${rows}</div><p class="cr-none" ${shownCount?'hidden':''}>Nenhum lançamento encontrado.</p></section>`;
}

// Abre/fecha o card sem redesenhar a tela (mantém a rolagem).
export function toggleCompletedRow(id){
 const card=document.querySelector(`.cr-card[data-cr="${CSS.escape(id)}"]`);
 const open=!openRows.has(id);open?openRows.add(id):openRows.delete(id);
 if(!card)return;
 card.classList.toggle('is-open',open);
 card.querySelector('.cr-toggle')?.setAttribute('aria-expanded',String(open));
 const d=card.querySelector('.cr-details');if(d)d.hidden=!open;
 syncToggleAll(card.closest('.completed-month-screen'));
}
function syncToggleAll(screen){
 if(!screen)return;const btn=screen.querySelector('.cr-tools button');if(!btn)return;
 const anyOpen=[...screen.querySelectorAll('.cr-card')].some(c=>c.classList.contains('is-open'));
 btn.textContent=anyOpen?'▴ Recolher todos':'▾ Expandir todos';
 btn.setAttribute('onclick',`toggleAllCompletedRows('${screen.dataset.group}',${!anyOpen})`);
}
export function toggleAllCompletedRows(groupId,open){
 const screen=document.querySelector(`.completed-month-screen[data-group="${CSS.escape(groupId)}"]`);if(!screen)return;
 screen.querySelectorAll('.cr-card').forEach(card=>{if(card.hidden)return;const id=card.dataset.cr;open?openRows.add(id):openRows.delete(id);card.classList.toggle('is-open',open);card.querySelector('.cr-toggle')?.setAttribute('aria-expanded',String(open));const d=card.querySelector('.cr-details');if(d)d.hidden=!open;});
 syncToggleAll(screen);
}
export function filterCompletedMonth(groupId,monthKey,value){
 monthFilters.set(groupId+'|'+monthKey,value);
 const screen=document.querySelector(`.completed-month-screen[data-group="${CSS.escape(groupId)}"]`);if(!screen)return;
 const q=String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
 let shown=0;screen.querySelectorAll('.cr-card').forEach(card=>{const ok=!q||card.dataset.search.includes(q);card.hidden=!ok;if(ok)shown++;});
 const none=screen.querySelector('.cr-none');if(none)none.hidden=shown>0;
}
if(typeof window!=='undefined'){window.toggleCompletedRow=toggleCompletedRow;window.toggleAllCompletedRows=toggleAllCompletedRows;window.filterCompletedMonth=filterCompletedMonth;}

export function completionLaneTabs(groupId,activeCount,completedCount,lane){
 return `<div class="activity-lanes" role="tablist" aria-label="Situação dos lançamentos"><button type="button" role="tab" aria-selected="${lane==='active'}" class="${lane==='active'?'active':''}" onclick="setActivityLane('${esc(groupId)}','active')"><span><small>TRABALHO ATUAL</small>Em andamento</span><b>${activeCount}</b></button><button type="button" role="tab" aria-selected="${lane==='completed'}" class="${lane==='completed'?'active':''}" onclick="setActivityLane('${esc(groupId)}','completed')"><span><small>HISTÓRICO COMPLETO</small>Concluídos por ano e mês</span><b>${completedCount}</b></button></div>`;
}
