const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes=new Map();
const selectedMonths=new Map();
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTH_ABBR=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function dateValue(value){if(!value)return null;const raw=typeof value==='object'&&value.seconds?new Date(value.seconds*1000):new Date(String(value).length===10?String(value)+'T12:00:00':value);return Number.isNaN(raw.valueOf())?null:raw;}
function dateLabel(value){const date=dateValue(value);return date?date.toLocaleDateString('pt-BR'):'—';}
export function recordIsCompleted(record){
 const status=String(record?.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return Number(record?.concluded)===1||status==='concluido';
}
function monthInfo(record,parent){
 const raw=record.start_date||parent?.start_date||record.created_at||record.conclusion_date,date=dateValue(raw);
 return date?{key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,year:String(date.getFullYear()),month:date.getMonth(),label:MONTHS[date.getMonth()]}:{key:'sem-data',year:'Sem data',month:99,label:'Sem data de solicitação'};
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
 if(!entries.length)return '<div class="completed-empty"><span>✓</span><strong>Nenhum lançamento concluído ainda</strong><p>Quando um lançamento for concluído, ele será organizado aqui pelo mês da solicitação.</p></div>';
 const months=new Map();entries.forEach(entry=>{const info=monthInfo(entry.record,entry.parent);if(!months.has(info.key))months.set(info.key,{...info,entries:[]});months.get(info.key).entries.push(entry);});
 const years=new Map();[...months.values()].forEach(month=>{if(!years.has(month.year))years.set(month.year,[]);years.get(month.year).push(month);});
 const yearList=[...years.entries()].sort(([a],[b])=>a==='Sem data'?1:b==='Sem data'?-1:Number(b)-Number(a));
 yearList.forEach(([,list])=>list.sort((a,b)=>b.month-a.month));
 const selectedKey=selectedMonths.get(group.id),selected=months.get(selectedKey);
 if(selectedKey&&!selected)selectedMonths.delete(group.id);
 if(!selected)return `<div class="completed-archive">${yearList.map(([year,yearMonths])=>`<section class="completed-year"><header class="completed-year-head"><span>✓</span><div><small>ARQUIVO DE CONCLUÍDOS</small><strong>${esc(year)}</strong></div><b>${yearMonths.reduce((total,month)=>total+month.entries.length,0)} lançamentos</b></header><div class="completed-month-grid">${yearMonths.map(month=>`<button type="button" class="completed-month-card" onclick="setCompletedArchiveMonth('${esc(group.id)}','${esc(month.key)}')"><span class="completed-month-icon">${month.month===99?'—':String(month.month+1).padStart(2,'0')}</span><span class="completed-month-copy"><small>MÊS DA SOLICITAÇÃO</small><strong>${esc(month.label)}</strong><em>${month.entries.length} lançamento${month.entries.length===1?'':'s'} concluído${month.entries.length===1?'':'s'}</em></span><b>${month.entries.length}</b><i>Abrir mês <span>→</span></i></button>`).join('')}</div></section>`).join('')}</div>`;
 const monthTitle=selected.month===99?'SEM-DATA':`${MONTH_ABBR[selected.month]}-${selected.year}`;
 const rows=selected.entries.sort((a,b)=>String(b.record.start_date||b.record.created_at||'').localeCompare(String(a.record.start_date||a.record.created_at||''))).map(entry=>{
  const record=entry.record,parent=entry.parent;
  return `<article class="completed-row"><div class="completed-row-check">✓</div><div class="completed-row-main">${entry.isSub?'<small>SUBITEM CONCLUÍDO</small>':''}<strong>${esc(record.description||'Sem descrição')}</strong>${parent?`<span>Em ${esc(parent.description||'item')}</span>`:''}${record.observacao?`<p>${esc(record.observacao)}</p>`:''}</div><div class="completed-row-meta"><span><small>Solicitação</small>${dateLabel(record.start_date||parent?.start_date)}</span><span><small>Conclusão</small>${dateLabel(record.conclusion_date)}</span>${record.responsaveis?`<span><small>Responsável</small>${esc(record.responsaveis)}</span>`:''}</div>${canEdit?`<div class="completed-row-actions"><button type="button" onclick="openItemModal('${esc(record.id)}','${esc(group.id)}',${entry.isSub},'${esc(entry.isSub?(record.parent_id||record.item_id):'')}','it-name')">Editar</button><button type="button" onclick="toggleConcluidoPendente('${esc(record.id)}',${entry.isSub})">↺ Reabrir</button></div>`:''}</article>`;
 }).join('');
 return `<section class="completed-month-screen"><header class="completed-month-screen-head"><button type="button" onclick="closeCompletedArchiveMonth('${esc(group.id)}')">← Meses</button><div><small>LANÇAMENTOS CONCLUÍDOS</small><h2>${esc(monthTitle)}</h2></div><b>${selected.entries.length} lançamento${selected.entries.length===1?'':'s'}</b></header><div class="completed-month-list">${rows}</div></section>`;
}

export function completionLaneTabs(groupId,activeCount,completedCount,lane){
 return `<div class="activity-lanes" role="tablist" aria-label="Situação dos lançamentos"><button type="button" role="tab" aria-selected="${lane==='active'}" class="${lane==='active'?'active':''}" onclick="setActivityLane('${esc(groupId)}','active')"><span><small>TRABALHO ATUAL</small>Em andamento</span><b>${activeCount}</b></button><button type="button" role="tab" aria-selected="${lane==='completed'}" class="${lane==='completed'?'active':''}" onclick="setActivityLane('${esc(groupId)}','completed')"><span><small>HISTÓRICO COMPLETO</small>Concluídos por ano e mês</span><b>${completedCount}</b></button></div>`;
}
