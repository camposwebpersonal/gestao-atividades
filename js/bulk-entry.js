import {supabase,collection,doc,getDocs,query,where,orderBy,addDoc,updateDoc,deleteDoc,permanentDeleteDoc,setDoc} from '../supabase_compat.js?v=7';
import {bulkColumns,bulkPayloads,normalizeBulkDate,persistBulkPayloads} from './bulk-entry-core.js?v=3';
import {listBulkDrafts,createBulkDraft,updateBulkDraft,deleteBulkDraft,submitBulkDraft} from './bulk-drafts-core.js?v=1';

export {bulkColumns,bulkPayloads,normalizeBulkDate,persistBulkPayloads};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={group:null,columns:[],busy:false,drafts:[],draft:null,editor:false,selection:null,dragging:false,clipboard:null,dirty:false,saveTimer:0,scrollTimer:0,saving:null};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const draftList=async groupId=>{
 if(window.__bulkDraftApi?.list)return window.__bulkDraftApi.list(groupId);
 const snap=await getDocs(query(collection(supabase,'bulk_entry_drafts'),where('group_id','==',groupId),orderBy('updated_at','desc')));
 return snap.docs.map(item=>({id:item.id,...item.data()}));
};
const draftCreate=async({groupId,title,rowCount=12,columnSignature=[]})=>{
 if(window.__bulkDraftApi?.create)return window.__bulkDraftApi.create({groupId,title,rowCount,columnSignature});
 const now=new Date().toISOString(),payload={owner_id:window.S?.user?.uid,group_id:groupId,title:String(title||'').trim(),row_count:rowCount,column_signature:columnSignature,grid_data:{version:1,rows:Array.from({length:rowCount},()=>({}))},scroll_top:0,scroll_left:0,active_row:0,active_col:0,created_at:now,updated_at:now};
 if(!payload.title)throw new Error('Informe um título para o lote.');
 const ref=await addDoc(collection(supabase,'bulk_entry_drafts'),payload);
 return {...payload,id:ref.id,offline_pending:Boolean(ref.pending)};
};
const draftUpdate=async(id,patch)=>{
 if(window.__bulkDraftApi?.update)return window.__bulkDraftApi.update(id,patch);
 const saved={...patch,updated_at:new Date().toISOString()};
 const result=await updateDoc(doc(supabase,'bulk_entry_drafts',id),saved);
 return {...saved,id,offline_pending:Boolean(state.draft?.offline_pending||result?.pending)};
};
const draftDelete=async id=>{
 if(window.__bulkDraftApi?.delete)return window.__bulkDraftApi.delete(id);
 await deleteDoc(doc(supabase,'bulk_entry_drafts',id));return true;
};
const draftSubmit=async(id,payloads)=>{
 if(window.__bulkDraftApi?.submit)return window.__bulkDraftApi.submit(id,payloads);
 if(navigator.onLine&&!state.draft?.offline_pending)return submitBulkDraft(supabase,id,payloads);
 for(const payload of payloads)await setDoc(doc(supabase,'items',payload.id),payload);
 await permanentDeleteDoc(doc(supabase,'bulk_entry_drafts',id));
 return payloads;
};

function localKey(id){return `bulk-draft-emergency:${window.S?.user?.uid||'unknown'}:${id}`;}
function formatDate(value){if(!value)return 'agora';try{return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch{return 'agora';}}
function filledRows(rows){return (rows||[]).filter(row=>Object.values(row||{}).some(value=>Array.isArray(value)?value.length:value!==''&&value!==false&&value!=null)).length;}
function columnSignature(){return state.columns.map(column=>column.key);}

function cell(column,rowIndex,columnIndex){
 const common=`data-bulk-cell data-row="${rowIndex}" data-col="${columnIndex}" data-key="${esc(column.key)}" aria-label="${esc(column.label)} da linha ${rowIndex+1}"`;
 if(column.type==='checkbox')return `<input ${common} type="checkbox">`;
 if(column.type==='select')return `<select ${common}><option value=""></option>${(column.options||[]).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select>`;
 if(column.type==='checkboxes'||column.type==='radio')return `<div ${common} class="bulk-choice-cell" tabindex="0" data-choice-type="${column.type}">${(column.options||[]).map(([value,label])=>`<label><input type="${column.type==='checkboxes'?'checkbox':'radio'}" name="bulk-choice-${rowIndex}-${columnIndex}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}</div>`;
 return `<input ${common} type="${column.type==='number'?'number':'text'}" ${column.type==='number'?'inputmode="decimal"':''} ${column.type==='date'?'placeholder="dd/mm/aaaa"':''}>`;
}

function rowHtml(index){return `<tr data-bulk-row="${index}"><th><span>${index+1}</span><button type="button" onclick="bulkRemoveRow(${index})" aria-label="Remover linha ${index+1}" title="Remover linha">×</button></th>${state.columns.map((column,columnIndex)=>`<td style="min-width:${column.width}px">${cell(column,index,columnIndex)}</td>`).join('')}</tr>`;}
function allRows(){return [...document.querySelectorAll('[data-bulk-row]')];}
function cellAt(row,column){return document.querySelector(`[data-row="${row}"][data-col="${column}"]`);}

function cellValue(cell){
 if(cell.dataset.choiceType){const checked=[...cell.querySelectorAll('input:checked')].map(input=>input.value);return cell.dataset.choiceType==='checkboxes'?(checked.length?checked:''):checked[0]||'';}
 return cell.type==='checkbox'?cell.checked:String(cell.value??'').trim();
}
function clearCell(cell){if(cell.dataset.choiceType)cell.querySelectorAll('input').forEach(input=>input.checked=false);else if(cell.type==='checkbox')cell.checked=false;else cell.value='';}
function rowHasValues(row){return [...row.querySelectorAll('[data-bulk-cell]')].some(cell=>{const value=cellValue(cell);return Array.isArray(value)?value.length>0:value!==''&&value!==false;});}
function setCell(input,value){
 const column=state.columns[Number(input.dataset.col)],arrayValue=Array.isArray(value)?value:[],raw=Array.isArray(value)?value.join('; '):String(value??'').trim();
 if(column.type==='checkboxes'||column.type==='radio'){
  const wanted=(arrayValue.length?arrayValue:raw.split(/\s*(?:;|\||,)\s*/)).map(item=>String(item).toLocaleLowerCase('pt-BR')).filter(Boolean);
  input.querySelectorAll('input').forEach(option=>{const label=option.closest('label')?.textContent.trim().toLocaleLowerCase('pt-BR');option.checked=wanted.includes(option.value.toLocaleLowerCase('pt-BR'))||wanted.includes(label);});return;
 }
 if(column.type==='checkbox')input.checked=typeof value==='boolean'?value:/^(1|sim|s|true|x|yes)$/i.test(raw);
 else if(column.type==='select'){
  const option=[...input.options].find(item=>item.value.toLocaleLowerCase('pt-BR')===raw.toLocaleLowerCase('pt-BR')||item.textContent.toLocaleLowerCase('pt-BR')===raw.toLocaleLowerCase('pt-BR'));
  input.value=option?.value||raw;
 }else input.value=column.type==='date'?(normalizeBulkDate(raw)||raw):raw;
}

function updateCount(){
 const count=allRows().filter(rowHasValues).length,badge=document.getElementById('bulk-filled-count');
 if(badge)badge.textContent=`${count} lançamento${count===1?'':'s'} preenchido${count===1?'':'s'}`;
 const selected=document.getElementById('bulk-selection-count'),bounds=selectionBounds();
 if(selected)selected.textContent=bounds?`${(bounds.bottom-bounds.top+1)*(bounds.right-bounds.left+1)} célula(s) selecionada(s)`:'Selecione células';
}
function renumber(){
 allRows().forEach((row,index)=>{row.dataset.bulkRow=index;row.querySelector('th span').textContent=index+1;row.querySelector('th button').setAttribute('onclick',`bulkRemoveRow(${index})`);row.querySelectorAll('[data-bulk-cell]').forEach(entry=>{entry.dataset.row=index;entry.setAttribute('aria-label',`${state.columns[Number(entry.dataset.col)].label} da linha ${index+1}`);entry.querySelectorAll('input[type="radio"]').forEach(input=>input.name=`bulk-choice-${index}-${entry.dataset.col}`);});});
 const total=document.getElementById('bulk-total-count');if(total)total.value=allRows().length;updateCount();paintSelection();
}
function addRows(amount=10,focus=false){
 const body=document.getElementById('bulk-grid-body');if(!body)return;
 const start=body.children.length,requested=Math.max(0,Math.floor(Number(amount)||0)),allowed=Math.min(requested,500-start);
 if(!allowed){window.toast?.('A planilha permite até 500 linhas.','error');return;}
 body.insertAdjacentHTML('beforeend',Array.from({length:allowed},(_,offset)=>rowHtml(start+offset)).join(''));
 const total=document.getElementById('bulk-total-count');if(total)total.value=start+allowed;
 if(allowed<requested)window.toast?.('A planilha foi limitada a 500 linhas.','error');
 if(focus){selectCell(start,0);focusCell(start,0);}updateCount();
}
function focusCell(row,column){const target=cellAt(row,column);if(!target)return false;target.focus();target.scrollIntoView({block:'nearest',inline:'nearest'});return true;}

function selectionBounds(){
 const selection=state.selection;if(!selection)return null;
 return {top:Math.min(selection.anchorRow,selection.focusRow),bottom:Math.max(selection.anchorRow,selection.focusRow),left:Math.min(selection.anchorCol,selection.focusCol),right:Math.max(selection.anchorCol,selection.focusCol)};
}
function paintSelection(){
 const bounds=selectionBounds();document.querySelectorAll('[data-bulk-cell]').forEach(cell=>{const row=Number(cell.dataset.row),column=Number(cell.dataset.col),selected=bounds&&row>=bounds.top&&row<=bounds.bottom&&column>=bounds.left&&column<=bounds.right;cell.classList.toggle('bulk-cell-selected',Boolean(selected));cell.classList.toggle('bulk-cell-anchor',Boolean(selected&&row===state.selection.anchorRow&&column===state.selection.anchorCol));});updateCount();
}
function selectCell(row,column,extend=false){
 row=clamp(row,0,Math.max(0,allRows().length-1));column=clamp(column,0,Math.max(0,state.columns.length-1));
 if(extend&&state.selection)state.selection={...state.selection,focusRow:row,focusCol:column};else state.selection={anchorRow:row,anchorCol:column,focusRow:row,focusCol:column};paintSelection();
}
function selectionMatrix(){
 const bounds=selectionBounds();if(!bounds)return [];
 return Array.from({length:bounds.bottom-bounds.top+1},(_,rowOffset)=>Array.from({length:bounds.right-bounds.left+1},(_,colOffset)=>cellValue(cellAt(bounds.top+rowOffset,bounds.left+colOffset))));
}
function matrixText(matrix){return matrix.map(row=>row.map(value=>Array.isArray(value)?value.join('; '):value===true?'SIM':value===false?'':String(value??'')).join('\t')).join('\n');}
function applyMatrix(matrix,startRow,startCol,tileSelection=true){
 if(!matrix.length||!matrix.some(row=>row.length))return;
 const bounds=selectionBounds(),selectedHeight=bounds?bounds.bottom-bounds.top+1:1,selectedWidth=bounds?bounds.right-bounds.left+1:1;
 const tile=tileSelection&&bounds&&(selectedHeight>1||selectedWidth>1)&&matrix.length<=selectedHeight&&Math.max(...matrix.map(row=>row.length))<=selectedWidth;
 const height=tile?selectedHeight:matrix.length,width=tile?selectedWidth:Math.max(...matrix.map(row=>row.length));
 const needed=startRow+height-allRows().length;if(needed>0)addRows(needed);
 for(let rowOffset=0;rowOffset<height;rowOffset++)for(let colOffset=0;colOffset<width;colOffset++){
  const target=cellAt(startRow+rowOffset,startCol+colOffset);if(!target)continue;
  const row=matrix[rowOffset%matrix.length]||[],value=row[colOffset%Math.max(1,row.length)];if(value!==undefined)setCell(target,value);
 }
 state.selection={anchorRow:startRow,anchorCol:startCol,focusRow:Math.min(499,startRow+height-1),focusCol:Math.min(state.columns.length-1,startCol+width-1)};paintSelection();markDirty();
}
function fillDown(){
 const bounds=selectionBounds();if(!bounds)return;
 const sourceRow=bounds.bottom>bounds.top?bounds.top:bounds.top-1;if(sourceRow<0){window.toast('Selecione também a primeira linha que servirá de modelo.','info');return;}
 const firstTarget=bounds.bottom>bounds.top?bounds.top+1:bounds.top;
 for(let row=firstTarget;row<=bounds.bottom;row++)for(let column=bounds.left;column<=bounds.right;column++)setCell(cellAt(row,column),cellValue(cellAt(sourceRow,column)));
 paintSelection();markDirty();window.toast?.('Conteúdo repetido nas células selecionadas.','success',2200);
}

function gridRows(){return allRows().map(row=>Object.fromEntries([...row.querySelectorAll('[data-bulk-cell]')].map(cell=>[cell.dataset.key,cellValue(cell)])));}
function draftPatch(){
 const wrap=document.querySelector('.bulk-grid-wrap'),active=document.activeElement?.closest?.('[data-bulk-cell]'),selection=state.selection||{focusRow:0,focusCol:0};
 return {title:(document.getElementById('bulk-draft-title')?.value||state.draft?.title||'').trim(),grid_data:{version:1,rows:gridRows()},column_signature:columnSignature(),row_count:allRows().length,scroll_top:Math.round(wrap?.scrollTop||0),scroll_left:Math.round(wrap?.scrollLeft||0),active_row:Number(active?.dataset.row??selection.focusRow??0),active_col:Number(active?.dataset.col??selection.focusCol??0)};
}
function saveEmergency(patch){if(!state.draft?.id)return;try{localStorage.setItem(localKey(state.draft.id),JSON.stringify({...patch,local_updated_at:new Date().toISOString()}));}catch(error){console.warn('Não foi possível manter cópia local do lote',error);}}
function status(text,tone=''){const element=document.getElementById('bulk-save-status');if(element){element.textContent=text;element.dataset.tone=tone;}}
function markDirty(){
 if(!state.editor||!state.draft?.id)return;state.dirty=true;const patch=draftPatch();saveEmergency(patch);status('Alterações pendentes…','pending');clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>saveDraftNow(),650);updateCount();
}
async function saveDraftNow(silent=false){
 if(!state.editor||!state.draft?.id||!document.getElementById('bulk-grid-body'))return state.draft;
 if(state.saving){await state.saving;if(state.dirty)return saveDraftNow(silent);return state.draft;}
 if(!state.dirty&&!silent)return state.draft;
 const patch=draftPatch();if(!patch.title){if(!silent)window.toast('Informe um título para este lote.','error');return state.draft;}
 state.dirty=false;status(navigator.onLine?'Salvando…':'Salvando neste aparelho…','saving');
 state.saving=draftUpdate(state.draft.id,patch).then(saved=>{state.draft={...state.draft,...saved};saveEmergency({...patch,local_updated_at:saved.updated_at});status(saved.offline_pending?'Salvo neste aparelho · sincronização pendente':`Salvo às ${new Date(saved.updated_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`,'saved');return state.draft;}).catch(error=>{state.dirty=true;status('Cópia local segura · sem sincronizar','error');if(!silent)window.toast('O lote ficou salvo neste aparelho, mas não sincronizou: '+error.message,'error',7000);throw error;}).finally(()=>{state.saving=null;});
 try{return await state.saving;}catch{return state.draft;}finally{if(state.dirty){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>saveDraftNow(true),1600);}}
}

function restoreGrid(draft){
 let source=draft;try{const local=JSON.parse(localStorage.getItem(localKey(draft.id))||'null');if(local&&new Date(local.local_updated_at)>new Date(draft.updated_at))source={...draft,...local};}catch{}
 const rows=Array.isArray(source.grid_data?.rows)?source.grid_data.rows:[],count=clamp(Math.max(source.row_count||12,rows.length,1),1,500);addRows(count);
 rows.slice(0,count).forEach((values,row)=>state.columns.forEach((column,col)=>{if(Object.prototype.hasOwnProperty.call(values||{},column.key))setCell(cellAt(row,col),values[column.key]);}));
 const row=clamp(source.active_row,0,count-1),col=clamp(source.active_col,0,state.columns.length-1);selectCell(row,col);
 requestAnimationFrame(()=>{const wrap=document.querySelector('.bulk-grid-wrap'),target=cellAt(row,col);if(wrap){wrap.scrollTop=source.scroll_top||0;wrap.scrollLeft=source.scroll_left||0;}target?.focus({preventScroll:true});updateCount();});
}

function readRows(validate=true){
 const rows=[];allRows().forEach(row=>{const values={};row.querySelectorAll('[data-bulk-cell]').forEach(input=>{values[input.dataset.key]=cellValue(input);input.classList.remove('invalid');});const used=Object.values(values).some(value=>Array.isArray(value)?value.length>0:value!==''&&value!==false);if(!used)return;if(validate&&!values.description){row.querySelector('[data-key="description"]')?.classList.add('invalid');throw new Error(`Informe o nome na linha ${Number(row.dataset.bulkRow)+1}.`);}if(validate)for(const key of ['start_date','deadline_date'])if(values[key]&&!normalizeBulkDate(values[key])){row.querySelector(`[data-key="${key}"]`)?.classList.add('invalid');throw new Error(`Confira a data na linha ${Number(row.dataset.bulkRow)+1}. Use dd/mm/aaaa.`);}rows.push(values);});return rows;
}

function bindGrid(){
 const body=document.getElementById('bulk-grid-body'),wrap=document.querySelector('.bulk-grid-wrap');if(!body)return;
 body.addEventListener('focusin',event=>{const target=event.target.closest('[data-bulk-cell]');if(target&&!state.dragging&&!target.classList.contains('bulk-cell-selected'))selectCell(Number(target.dataset.row),Number(target.dataset.col));});
 body.addEventListener('pointerdown',event=>{const target=event.target.closest('[data-bulk-cell]');if(!target)return;selectCell(Number(target.dataset.row),Number(target.dataset.col),event.shiftKey);state.dragging=true;});
 body.addEventListener('pointerover',event=>{if(!state.dragging)return;const target=event.target.closest('[data-bulk-cell]');if(target)selectCell(Number(target.dataset.row),Number(target.dataset.col),true);});
 body.addEventListener('input',markDirty);body.addEventListener('change',markDirty);
 body.addEventListener('copy',event=>{if(!state.selection)return;const matrix=selectionMatrix(),text=matrixText(matrix);event.preventDefault();event.clipboardData?.setData('text/plain',text);state.clipboard=matrix;status(`${matrix.length} linha(s) copiada(s)`,'saved');});
 body.addEventListener('paste',event=>{const target=event.target.closest('[data-bulk-cell]');if(!target)return;const text=event.clipboardData?.getData('text/plain');if(text==null)return;event.preventDefault();const matrix=text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));const bounds=selectionBounds();applyMatrix(matrix,bounds?.top??Number(target.dataset.row),bounds?.left??Number(target.dataset.col));});
 body.addEventListener('keydown',event=>{
  const target=event.target.closest('[data-bulk-cell]');if(!target)return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){event.preventDefault();fillDown();return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(event.key))return;
  event.preventDefault();let row=Number(target.dataset.row),column=Number(target.dataset.col);
  if(event.key==='ArrowLeft')column--;if(event.key==='ArrowRight')column++;if(event.key==='ArrowUp'||(event.key==='Enter'&&event.shiftKey))row--;if(event.key==='ArrowDown'||(event.key==='Enter'&&!event.shiftKey))row++;
  if(row>=allRows().length&&row<500)addRows(1);row=clamp(row,0,allRows().length-1);column=clamp(column,0,state.columns.length-1);selectCell(row,column,event.shiftKey&&event.key!=='Enter');focusCell(row,column);
 });
 wrap?.addEventListener('scroll',()=>{clearTimeout(state.scrollTimer);state.scrollTimer=setTimeout(markDirty,400);},{passive:true});
}
document.addEventListener('pointerup',()=>{state.dragging=false;});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.editor)saveDraftNow(true);});

function renderEditor(draft){
 state.draft=draft;state.editor=true;state.busy=false;state.dirty=false;state.selection=null;
 window.openModal('▦ Planilha de lançamentos',state.group.name,`<div class="bulk-draft-head"><button type="button" class="btn-action" onclick="bulkBackToDrafts()">← Meus lotes</button><label><span>Título deste lote</span><input id="bulk-draft-title" maxlength="180" value="${esc(draft.title)}" oninput="bulkDraftChanged()"></label><span id="bulk-save-status" data-tone="saved">Salvo no Supabase</span></div><div class="bulk-intro"><div><strong>Planilha inteligente</strong><span>Selecione células arrastando ou com Shift + setas. Funciona como no Excel.</span></div><div class="bulk-shortcuts"><kbd>Ctrl C</kbd> copiar <kbd>Ctrl V</kbd> colar <kbd>Ctrl D</kbd> repetir de cima</div></div><div class="bulk-toolbar"><button type="button" class="btn-action" onclick="bulkAddRows(10,true)">＋ 10 linhas</button><button type="button" class="btn-action" onclick="bulkAddRows(25,true)">＋ 25 linhas</button><label class="bulk-quantity"><span>Adicionar</span><input id="bulk-add-count" type="number" min="1" max="500" value="50" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkAddCustomRows()}"><button type="button" onclick="bulkAddCustomRows()">＋ linhas</button></label><label class="bulk-quantity"><span>Total</span><input id="bulk-total-count" type="number" min="1" max="500" value="12" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkSetRowCount()}"><button type="button" onclick="bulkSetRowCount()">Definir</button></label><button type="button" class="btn-action" onclick="bulkCopySelection()">Copiar</button><button type="button" class="btn-action" onclick="bulkPasteSelection()">Colar</button><button type="button" class="btn-action bulk-fill-button" onclick="bulkFillDown()">Repetir ↓</button><button type="button" class="btn-action" onclick="bulkClearGrid()">Limpar</button><span id="bulk-selection-count">Selecione células</span><span id="bulk-filled-count">0 lançamentos preenchidos</span></div><div class="bulk-grid-wrap"><table class="bulk-grid"><thead><tr><th>#</th>${state.columns.map(column=>`<th style="min-width:${column.width}px">${esc(column.label)}</th>`).join('')}</tr></thead><tbody id="bulk-grid-body"></tbody></table></div><div class="bulk-foot"><p>Salvamento automático ativo. O lote só vira cadastro quando você enviar.</p><div class="modal-actions"><button type="button" class="btn-cancel" onclick="bulkSaveAndClose()">Salvar e fechar</button><button type="button" class="btn-save" id="bulk-save" onclick="saveBulkEntries()">Enviar lançamentos</button></div></div>`);
 document.querySelector('#modal-ov .modal-box')?.classList.add('bulk-modal-box');restoreGrid(draft);bindGrid();window.bulkModalClosing=()=>{const saving=saveDraftNow(true);state.editor=false;return saving;};
}

function renderManager(){
 state.editor=false;state.draft=null;state.selection=null;window.bulkModalClosing=null;
 const user=window.S?.user?.displayName||window.S?.user?.email?.split('@')[0]||'usuário';
 const cards=state.drafts.map(draft=>{const count=filledRows(draft.grid_data?.rows);return `<article class="bulk-draft-card"><div class="bulk-draft-icon">▦</div><div><strong>${esc(draft.title)}</strong><span>${count} preenchido(s) · ${draft.row_count} linhas</span><small>Atualizado em ${esc(formatDate(draft.updated_at))}</small></div><div class="bulk-draft-actions"><button type="button" class="btn-action primary" onclick="bulkOpenDraft('${esc(draft.id)}')">Continuar</button><button type="button" class="btn-action danger" onclick="bulkDeleteDraft('${esc(draft.id)}')">Excluir</button></div></article>`;}).join('');
 window.openModal('▦ Meus lançamentos em lote',state.group.name,`<section class="bulk-drafts-manager"><div class="bulk-drafts-banner"><div><strong>Seus lotes ficam guardados automaticamente</strong><span>Continue deste computador, de casa ou de outro dispositivo com seu usuário.</span></div><b>👤 ${esc(user)}</b></div><div class="bulk-new-draft"><label for="bulk-new-title">Título do novo lote</label><div><input id="bulk-new-title" maxlength="180" placeholder="Ex.: LANÇAMENTOS DE RICARDO — ${esc(state.group.name)}"><button type="button" class="btn-save" onclick="bulkCreateDraft()">＋ Criar novo lote</button></div></div><div class="bulk-drafts-heading"><strong>Rascunhos deste cadastro</strong><span>${state.drafts.length} lote(s)</span></div><div class="bulk-drafts-list">${cards||'<div class="bulk-drafts-empty"><b>Nenhum lote pendente</b><span>Crie um acima. Ele só desaparecerá depois do envio ou se você excluir.</span></div>'}</div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Fechar</button></div></section>`);
 document.querySelector('#modal-ov .modal-box')?.classList.add('bulk-drafts-modal-box');
 setTimeout(()=>document.getElementById('bulk-new-title')?.focus(),60);
}

window.openBulkEntry=async function(groupId){
 if(!window.userCanCreateItems?.()){window.toast('Seu usuário não tem permissão para criar itens ou subitens.','error',7000);return;}
 const group=window.S?.secs?.find(item=>item.id===groupId);if(!group||(!window.S.isAdmin&&!window.userCanGroup?.(group,'editar'))){window.toast('Você não pode lançar neste grupo.','error');return;}
 state.group=group;state.columns=bulkColumns(group,(window.S.fieldTemplates||[]).filter(t=>t.atividade_id===groupId));state.busy=false;
 window.openModal('▦ Meus lançamentos em lote',group.name,'<div class="bulk-drafts-loading">Carregando seus lotes salvos…</div>');
 try{state.drafts=await draftList(groupId);renderManager();}catch(error){console.error(error);window.openModal('Não foi possível abrir os lotes',group.name,`<div class="bulk-drafts-empty"><b>Falha ao acessar seus rascunhos</b><span>${esc(error.message)}</span><button type="button" class="btn-action" onclick="openBulkEntry('${esc(groupId)}')">Tentar novamente</button></div>`);}
};
window.bulkCreateDraft=async function(){
 const input=document.getElementById('bulk-new-title'),title=input?.value.trim();if(!title){window.toast('Dê um título para identificar este lote.','error');input?.focus();return;}
 const button=input.parentElement.querySelector('button');button.disabled=true;button.textContent='Criando…';
 try{const draft=await draftCreate({groupId:state.group.id,title,rowCount:12,columnSignature:columnSignature()});state.drafts.unshift(draft);renderEditor(draft);}catch(error){window.toast('Não foi possível criar o lote: '+error.message,'error',7000);button.disabled=false;button.textContent='＋ Criar novo lote';}
};
window.bulkOpenDraft=id=>{const draft=state.drafts.find(item=>item.id===id);if(draft)renderEditor(draft);};
window.bulkDeleteDraft=async function(id){
 const draft=state.drafts.find(item=>item.id===id);if(!draft||!window.confirm(`Enviar o lote “${draft.title}” para a lixeira?\n\nEle poderá ser restaurado pela administração.`))return;
 try{await draftDelete(id);localStorage.removeItem(localKey(id));state.drafts=state.drafts.filter(item=>item.id!==id);renderManager();window.toast('Lote enviado para a lixeira.','success');}catch(error){window.toast('Não foi possível excluir: '+error.message,'error',7000);}
};
window.bulkBackToDrafts=async function(){await saveDraftNow(true);state.drafts=await draftList(state.group.id).catch(()=>state.drafts);renderManager();};
window.bulkSaveAndClose=async function(){await saveDraftNow(true);const pending=state.draft?.offline_pending;state.editor=false;window.bulkModalClosing=null;window.closeModal();window.toast(pending?'Lote salvo neste aparelho. Ele irá para os outros dispositivos após sincronizar.':'Lote salvo. Você pode continuar depois de qualquer dispositivo.','success',4500);};
window.bulkDraftChanged=markDirty;
window.bulkAddRows=(amount,focus)=>{addRows(amount,focus);markDirty();};
window.bulkAddCustomRows=function(){const input=document.getElementById('bulk-add-count'),amount=Math.floor(Number(input?.value));if(!Number.isInteger(amount)||amount<1){window.toast('Informe quantas linhas deseja adicionar.','error');input?.focus();return;}addRows(amount,true);markDirty();};
window.bulkSetRowCount=function(){const input=document.getElementById('bulk-total-count'),desired=Math.floor(Number(input?.value));if(!Number.isInteger(desired)||desired<1||desired>500){window.toast('Informe um total entre 1 e 500 linhas.','error');input?.focus();return;}const rows=allRows(),current=rows.length;if(desired>current)addRows(desired-current,true);else if(desired<current){const removed=rows.slice(desired);if(removed.some(rowHasValues)&&!window.confirm(`As últimas ${current-desired} linhas possuem dados. Deseja removê-las?`)){input.value=current;return;}removed.forEach(row=>row.remove());renumber();selectCell(Math.min(desired-1,current-1),0);focusCell(Math.min(desired-1,current-1),0);}markDirty();};
window.bulkRemoveRow=function(index){const rows=allRows();if(rows.length===1)rows[0].querySelectorAll('[data-bulk-cell]').forEach(clearCell);else rows[index]?.remove();renumber();markDirty();};
window.bulkClearGrid=function(){if(!window.confirm('Limpar todos os valores desta planilha? O rascunho continuará existindo.'))return;document.querySelectorAll('[data-bulk-cell]').forEach(clearCell);renumber();markDirty();};
window.bulkFillDown=fillDown;
window.bulkCopySelection=async function(){const matrix=selectionMatrix();if(!matrix.length)return;state.clipboard=matrix;try{await navigator.clipboard.writeText(matrixText(matrix));window.toast('Células copiadas.','success',1800);}catch{window.toast('Use Ctrl+C para copiar as células selecionadas.','info');}};
window.bulkPasteSelection=async function(){try{const text=await navigator.clipboard.readText();if(!text)return;const bounds=selectionBounds()||{top:0,left:0};applyMatrix(text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t')),bounds.top,bounds.left);}catch{if(state.clipboard){const bounds=selectionBounds()||{top:0,left:0};applyMatrix(state.clipboard,bounds.top,bounds.left);}else window.toast('Use Ctrl+V para colar nas células selecionadas.','info');}};

window.saveBulkEntries=async function(){
 if(state.busy||!state.group||!state.draft)return;let rows;
 try{rows=readRows(true);}catch(error){window.toast(error.message,'error');document.querySelector('.bulk-grid .invalid')?.focus();return;}
 if(!rows.length){window.toast('Preencha pelo menos uma linha.','error');return;}if(rows.length>500){window.toast('Envie no máximo 500 lançamentos por vez.','error');return;}
 await saveDraftNow(true);const button=document.getElementById('bulk-save');state.busy=true;button.disabled=true;button.textContent=`Enviando ${rows.length}…`;
 try{
  const current=window.S.items.filter(item=>item.atividade_id===state.group.id),start=current.length?Math.max(...current.map(item=>Number(item.order_num)||0))+1:0,payloads=bulkPayloads(rows,state.group,start);
  const saved=await draftSubmit(state.draft.id,payloads);button.textContent='Atualizando a tela…';localStorage.removeItem(localKey(state.draft.id));
  await window.loadData();const loadedIds=new Set((window.S.items||[]).map(item=>item.id)),missing=saved.filter(item=>!loadedIds.has(item.id));if(missing.length)window.S.items.push(...missing);
  const groupId=state.group.id;state.editor=false;state.draft=null;window.bulkModalClosing=null;window.closeModal();window.toast(`${saved.length} lançamentos enviados e o rascunho concluído foi removido!`,'success',6500);window.openActivity(groupId);
 }catch(error){console.error(error);window.toast('Não foi possível enviar o lote: '+(error.message||error)+'. O rascunho foi preservado.','error',9000);button.disabled=false;button.textContent='Enviar lançamentos';}
 finally{state.busy=false;}
};
