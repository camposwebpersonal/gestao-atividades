/* Prévia compartilhada da ordenação: abre espaço ao entrar no próximo registro. */
(function(){
  'use strict';
  const selector='.ftpl-option,.ftpl-row,.sub-row,.item-row,tr[data-lista-id]';
  let active=null;
  const rowOf=target=>target?.closest?.(selector);
  const identity=row=>row.dataset.sortId||row.dataset.listaId;
  function descendant(id,parent){
    let current=(window.S?.subitems||[]).find(s=>s.id===id);const visited=new Set();
    while(current&&!visited.has(current.id)){
      visited.add(current.id);
      const p=current.parent_type==='subitem'?current.parent_id:current.item_id;
      if(p===parent)return true;
      current=(window.S?.subitems||[]).find(s=>s.id===p);
    }
    return false;
  }
  function blockOf(source){
    const block=[source],id=identity(source);
    if(id){let next=source.nextElementSibling;while(next&&identity(next)&&descendant(identity(next),id)){block.push(next);next=next.nextElementSibling;}}
    return block;
  }
  function allowed(source,target){
    if(!target||source===target||source.contains(target)||descendant(identity(target),identity(source)))return false;
    if(source.matches('.ftpl-option'))return target.matches('.ftpl-option')&&source.parentElement===target.parentElement;
    if(source.matches('.ftpl-row')){
      if(!target.matches('.ftpl-row')||document.querySelector('.ftpl-editor'))return false;
      const ts=window.S?.fieldTemplates||[],a=ts.find(t=>t.id===source.dataset.tplId),b=ts.find(t=>t.id===target.dataset.tplId);
      return !!a&&!!b&&a.atividade_id===b.atividade_id&&a.scope===b.scope;
    }
    if(source.matches('tr'))return target.matches('tr')&&source.parentElement===target.parentElement;
    if(source.matches('.item-row'))return target.matches('.item-row')&&source.parentElement===target.parentElement;
    return target.matches('.sub-row,.item-row');
  }
  function openSpace(session){
    if(active!==session||session.placeholder||!session.source.isConnected)return;
    session.block=blockOf(session.source);
    const height=session.block.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);
    const table=session.source.matches('tr'),placeholder=document.createElement(table?'tr':'div');
    placeholder.className='sort-live-placeholder';
    const label=table?placeholder.appendChild(document.createElement('td')):placeholder;
    if(table)label.colSpan=Math.max(1,session.source.cells.length);
    label.style.height=height+'px';label.textContent='Solte aqui para mover';
    session.source.before(placeholder);session.placeholder=placeholder;
    session.block.forEach(row=>{row.style.setProperty('--sort-live-width',row.getBoundingClientRect().width+'px');row.classList.add('sort-live-source');});
  }
  function over(event){
    if(!active)return;
    const placeholder=event.target.closest?.('.sort-live-placeholder');
    if(placeholder){event.preventDefault();active.hovered=null;
      // Encaminha o evento ao alvo para preservar o gesto de segurar para aninhar.
      if(active.target){const forwarded=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:event.dataTransfer});forwarded.sortLiveForwarded=true;active.target.dispatchEvent(forwarded);}
      return;
    }
    if(event.sortLiveForwarded)return;
    const target=rowOf(event.target);if(!allowed(active.source,target))return;
    event.preventDefault();event.dataTransfer.dropEffect='move';openSpace(active);
    if(!active.placeholder||active.hovered===target)return;
    active.hovered=target;
    const space=active.placeholder,below=target.parentElement===space.parentElement?
      [...space.parentElement.children].indexOf(target)>[...space.parentElement.children].indexOf(space):target.getBoundingClientRect().top>space.getBoundingClientRect().top;
    const targetBlock=blockOf(target),reference=below?targetBlock[targetBlock.length-1].nextSibling:target;
    if(reference===space||space.nextSibling===reference)return;
    const rows=[...new Set([...space.parentElement.children,...target.parentElement.children])].filter(row=>row!==space&&!active.block.includes(row));
    const positions=new Map(rows.map(row=>[row,row.getBoundingClientRect().top]));
    target.parentElement.insertBefore(space,reference);active.target=target;active.after=below;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)rows.forEach(row=>{
      const delta=positions.get(row)-row.getBoundingClientRect().top;
      if(delta)row.animate?.([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
    });
  }
  function finish(commit=false){
    if(!active)return;
    if(commit&&active.placeholder){active.block.forEach(row=>active.placeholder.before(row));}
    active.block?.forEach(row=>{row.classList.remove('sort-live-source');row.style.removeProperty('--sort-live-width');});
    active.placeholder?.remove();active=null;
    document.querySelectorAll('.drag-over,.drag-nest,.drag-nesting').forEach(row=>row.classList.remove('drag-over','drag-nest','drag-nesting'));
  }
  document.addEventListener('dragstart',event=>{
    const source=rowOf(event.target);if(!source||event.target.closest('.pw-card')||!event.target.closest('[draggable="true"]'))return;
    if(source.matches('.ftpl-row')&&document.querySelector('.ftpl-editor')){event.preventDefault();window.toast?.('Salve ou cancele a edição antes de ordenar','error');return;}
    finish();const session={source,placeholder:null,block:[],hovered:null,target:null,after:false};active=session;
    setTimeout(()=>{if(event.defaultPrevented){if(active===session)finish();return;}openSpace(session);},0);
  },true);
  document.addEventListener('dragenter',over,true);document.addEventListener('dragover',over,true);
  document.addEventListener('drop',event=>{
    if(!active)return;
    if(event.target.closest?.('.sort-live-placeholder')){
      event.preventDefault();event.stopPropagation();const session=active;
      if(!session.target){finish();return;}
      const forwarded=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:event.dataTransfer});forwarded.sortAfter=session.after;
      const target=session.target;finish(true);target.dispatchEvent(forwarded);return;
    }
    const target=rowOf(event.target);
    if(!allowed(active.source,target)){finish();return;}
    over(event);event.sortAfter=active.after;finish(true);
  },true);
  document.addEventListener('dragend',()=>finish(),true);
  const style=document.createElement('style');style.textContent=`
    .sort-live-source{position:absolute!important;opacity:0!important;pointer-events:none!important;width:var(--sort-live-width)!important}
    .sort-live-placeholder{box-sizing:border-box;border:2px dashed #087f8c!important;border-radius:9px;background:#e0f4ef!important;color:#087f8c!important;font-size:12px;text-align:center;overflow:hidden}
    div.sort-live-placeholder{display:flex;align-items:center;justify-content:center;font-weight:700}
    tr.sort-live-placeholder td{box-sizing:border-box;background:#e0f4ef!important;color:#087f8c!important;border:2px dashed #087f8c!important;vertical-align:middle!important}
  `;document.head.appendChild(style);
})();
