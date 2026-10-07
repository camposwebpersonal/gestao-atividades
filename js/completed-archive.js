const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes=new Map();
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function dateValue(value){if(!value)return null;const raw=typeof value==='object'&&value.seconds?new Date(value.seconds*1000):new Date(String(value).length===10?String(value)+'T12:00:00':value);return Number.isNaN(raw.valueOf())?null:raw;}
function dateLabel(value){const date=dateValue(value);return date?date.toLocaleDateString('pt-BR'):'—';}
function monthInfo(record,parent){
 const raw=record.start_date||parent?.start_date||record.created_at||record.conclusion_date,date=dateValue(raw);
 return date?{key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,label:`${MONTHS[date.getMonth()]} de ${date.getFullYear()}`}:{key:'sem-data',label:'Sem data de solicitação'};
}

export function activityLane(groupId){return modes.get(groupId)||'active';}
if(typeof window!=='undefined')window.setActivityLane=function(groupId,lane){modes.set(groupId,lane==='completed'?'completed':'active');window.openActivity(groupId);};

export function completedArchiveEntries(items,subitems,progress){
 const entries=[];
 items.forEach(item=>{
  const complete=progress(item).pct===100;
  if(complete){entries.push({record:item,parent:null,isSub:false});return;}
  const byId=new Map(subitems.filter(sub=>sub.item_id===item.id).map(sub=>[sub.id,sub]));
  subitems.filter(sub=>sub.item_id===item.id&&sub.concluded==1).forEach(sub=>{
   const parent=byId.get(sub.parent_id);
   if(parent?.concluded==1)return;
   entries.push({record:sub,parent:item,isSub:true});
  });
 });
 return entries;
}

export function renderCompletedArchive({group,items,subitems,progress,canEdit}){
 const entries=completedArchiveEntries(items,subitems,progress);
 if(!entries.length)return '<div class="completed-empty"><span>✓</span><strong>Nenhum lançamento concluído ainda</strong><p>Quando um lançamento for concluído, ele será organizado aqui pelo mês da solicitação.</p></div>';
 const months=new Map();entries.forEach(entry=>{const info=monthInfo(entry.record,entry.parent);if(!months.has(info.key))months.set(info.key,{...info,entries:[]});months.get(info.key).entries.push(entry);});
 return `<div class="completed-archive">${[...months.values()].sort((a,b)=>a.key==='sem-data'?1:b.key==='sem-data'?-1:b.key.localeCompare(a.key)).map((month,index)=>`<details class="completed-month" ${index===0?'open':''}><summary><span class="completed-month-icon">✓</span><strong>${esc(month.label)}</strong><b>${month.entries.length} lançamento${month.entries.length===1?'':'s'}</b><i></i></summary><div class="completed-month-list">${month.entries.sort((a,b)=>String(b.record.start_date||b.record.created_at||'').localeCompare(String(a.record.start_date||a.record.created_at||''))).map(entry=>{
  const record=entry.record,parent=entry.parent;
  return `<article class="completed-row"><div class="completed-row-check">✓</div><div class="completed-row-main">${entry.isSub?'<small>SUBITEM CONCLUÍDO</small>':''}<strong>${esc(record.description||'Sem descrição')}</strong>${parent?`<span>Em ${esc(parent.description||'item')}</span>`:''}${record.observacao?`<p>${esc(record.observacao)}</p>`:''}</div><div class="completed-row-meta"><span><small>Solicitação</small>${dateLabel(record.start_date||parent?.start_date)}</span><span><small>Conclusão</small>${dateLabel(record.conclusion_date)}</span>${record.responsaveis?`<span><small>Responsável</small>${esc(record.responsaveis)}</span>`:''}</div>${canEdit?`<div class="completed-row-actions"><button type="button" onclick="openItemModal('${esc(record.id)}','${esc(group.id)}',${entry.isSub},'${esc(entry.isSub?(record.parent_id||record.item_id):'')}','it-name')">Editar</button><button type="button" onclick="toggleConcluidoPendente('${esc(record.id)}',${entry.isSub})">↺ Reabrir</button></div>`:''}</article>`;
 }).join('')}</div></details>`).join('')}</div>`;
}

export function completionLaneTabs(groupId,activeCount,completedCount,lane){
 return `<div class="activity-lanes" role="tablist" aria-label="Situação dos lançamentos"><button type="button" role="tab" aria-selected="${lane==='active'}" class="${lane==='active'?'active':''}" onclick="setActivityLane('${esc(groupId)}','active')"><span>Em andamento</span><b>${activeCount}</b></button><button type="button" role="tab" aria-selected="${lane==='completed'}" class="${lane==='completed'?'active':''}" onclick="setActivityLane('${esc(groupId)}','completed')"><span>Concluídos por mês</span><b>${completedCount}</b></button></div>`;
}
