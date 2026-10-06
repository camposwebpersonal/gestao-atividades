const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function auditDate(value){
 const date=typeof value?.toDate==='function'?value.toDate():value?.seconds?new Date(value.seconds*1000):value?new Date(value):null;
 if(!date||Number.isNaN(date.getTime()))return '';
 return date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
}
export function auditLabel(record){
 const author=record.created_by_name,editor=record.updated_by_name;
 const created=auditDate(record.created_at),updated=auditDate(record.updated_at);
 return `<span>Lançado por <strong>${esc(author||'não registrado (cadastro anterior)')}</strong>${created?` <time datetime="${esc(String(record.created_at))}">em ${esc(created)}</time>`:''}</span>${editor?`<span>Última edição por <strong>${esc(editor)}</strong>${updated?` <time datetime="${esc(String(record.updated_at))}">em ${esc(updated)}</time>`:''}</span>`:''}`;
}
export function rememberRecords(table,rows,replace=false){
 const index=globalThis.__recordIndex||(globalThis.__recordIndex=new Map());
 if(replace){for(const [key,entry] of index)if(entry.table===table)index.delete(key);}
 for(const row of rows)index.set(table+'/'+row.id,{table,record:row});
 globalThis.refreshAuditUI?.();
}
export function auditTarget(host,isAttendance){
 if(isAttendance&&host.classList.contains('item-row')){
  const header=host.querySelector(':scope > .item-header'),info=header?.querySelector(':scope > .item-info');
  if(header&&info){
   let inline=header.querySelector(':scope > .attendance-inline-meta');
   if(!inline){inline=document.createElement('div');inline.className='attendance-inline-meta';info.insertAdjacentElement('afterend',inline);}
   host.classList.add('attendance-compact');
   return inline;
  }
 }
 if(isAttendance&&host.classList.contains('sub-row'))return host.querySelector(':scope > div[style*="flex:1"]')||host;
 return host.classList.contains('user-card')?host.querySelector('.user-identity > div'):host.tagName==='TR'?host.querySelector('td:nth-child(2)')||host.querySelector('td'):host;
}
export function initAuditUI(){
 let pending=false;
 const decorate=()=>{
  pending=false;const content=document.getElementById('content');if(!content)return;
  const byId=new Map();for(const entry of globalThis.__recordIndex?.values()||[])byId.set(String(entry.record.id),entry);
  const hosts=new Map();
  for(const el of content.querySelectorAll('[onclick],[data-audit-id],[data-lista-id],[data-sort-id],[data-well-id]')){
   if(el.closest('.record-audit'))continue;
   const recordId=el.dataset.auditId||el.dataset.listaId||el.dataset.sortId||el.dataset.wellId;
   const keys=recordId?[recordId]:[...(el.getAttribute('onclick')||'').matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
   const entry=keys.map(id=>byId.get(id)).find(Boolean);if(!entry)continue;
   const host=el.closest('tr,article,.user-card,.item-row,.sub-row,.pw-company,.mod-grupo-card,.sec-card,.dist-card,.ce-card,.cc-card')||el.closest('[class*="card"],[class*="row"]');
   if(host&&!hosts.has(host))hosts.set(host,entry);
  }
  for(const [host,{record,table}] of hosts){
   const attendance=['items','subitems'].includes(table)&&window.isAttendanceRecord?.(record);
   const target=auditTarget(host,attendance);
   if(!target)continue;
   let stamp=target.querySelector(':scope > .record-audit');
   if(!stamp){stamp=document.createElement('div');stamp.className='record-audit';target.append(stamp);}
   const markup=auditLabel(record);if(stamp.innerHTML!==markup)stamp.innerHTML=markup;
   if(attendance){
    let meta=target.querySelector(':scope > .attendance-record-meta');
    if(!meta){meta=document.createElement('div');meta.className='attendance-record-meta';target.insertBefore(meta,stamp);}
    const badges=window.attendanceBadges(record);if(meta.innerHTML!==badges)meta.innerHTML=badges;
    if(window.userCan?.('atendimentos','editar')&&!target.querySelector(':scope > .attendance-move-button')){
     const button=document.createElement('button');button.type='button';button.className='attendance-move-button';button.textContent='Mover';button.title='Mover atendimento para outro grupo';button.onclick=event=>{event.stopPropagation();window.openMoveAttendance(record.id,table);};target.append(button);
    }
   }
  }
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(decorate);}};
 new MutationObserver(mutations=>{if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.matches('.record-audit,.attendance-record-meta,.attendance-move-button,.attendance-inline-meta')&&!n.closest('.record-audit,.attendance-record-meta,.attendance-move-button,.attendance-inline-meta'))))schedule();}).observe(document.getElementById('content'),{childList:true,subtree:true});
 window.refreshAuditUI=schedule;
 window.openAuthorship=function(){
  window.openModal('Autoria dos registros','Quem cadastrou e quem editou por último.',`<label class="audit-search-label" for="audit-search">Buscar registro</label><input id="audit-search" type="search" placeholder="Nome do registro ou usuário" oninput="filterAuthorship()"><div id="audit-records"></div>`);window.filterAuthorship();
 };
 window.filterAuthorship=function(){
  const query=document.getElementById('audit-search').value.toLowerCase();
  const records=[...(globalThis.__recordIndex?.values()||[])].filter(({record,table})=>([record.display_name,record.name,record.description,record.nome,record.created_by_name,record.updated_by_name,table].join(' ').toLowerCase()).includes(query));
  const names={atividades:'Grupo',items:'Item',subitems:'Lançamento',users:'Usuário',contas:'Conta',estoque:'Estoque',requisicoes:'Requisição',contatos:'Contato',responsaveis:'Responsável',secretarias:'Secretaria'};
  document.getElementById('audit-records').innerHTML='<p class="audit-count">'+records.length+' registro(s) encontrado(s)'+(records.length>200?' · mostrando os primeiros 200; refine a busca':'')+'</p>'+records.slice(0,200).map(({table,record})=>`<article class="audit-record"><small>${esc(names[table]||table)}</small><strong>${esc(record.display_name||record.name||record.description||record.nome||record.id)}</strong><div class="record-audit">${auditLabel(record)}</div></article>`).join('')+(records.length?'':'<p>Nenhum registro encontrado.</p>');
 };
 schedule();
}
