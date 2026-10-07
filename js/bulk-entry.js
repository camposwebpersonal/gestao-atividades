import {supabase} from '../supabase_compat.js';
import {bulkColumns,bulkPayloads,normalizeBulkDate} from './bulk-entry-core.js?v=1';

export {bulkColumns,bulkPayloads,normalizeBulkDate};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={group:null,columns:[],busy:false};


function cell(column,rowIndex,columnIndex){
 const common=`data-bulk-cell data-row="${rowIndex}" data-col="${columnIndex}" data-key="${esc(column.key)}" aria-label="${esc(column.label)} da linha ${rowIndex+1}"`;
 if(column.type==='checkbox')return `<input ${common} type="checkbox">`;
 if(column.type==='select')return `<select ${common}><option value=""></option>${(column.options||[]).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select>`;
 return `<input ${common} type="${column.type==='number'?'number':column.type==='date'?'text':'text'}" ${column.type==='number'?'inputmode="decimal"':''} ${column.type==='date'?'placeholder="dd/mm/aaaa"':''}>`;
}

function rowHtml(index){
 return `<tr data-bulk-row="${index}"><th><span>${index+1}</span><button type="button" onclick="bulkRemoveRow(${index})" aria-label="Remover linha ${index+1}" title="Remover linha">×</button></th>${state.columns.map((column,columnIndex)=>`<td style="min-width:${column.width}px">${cell(column,index,columnIndex)}</td>`).join('')}</tr>`;
}

function renumber(){
 [...document.querySelectorAll('[data-bulk-row]')].forEach((row,index)=>{row.dataset.bulkRow=index;row.querySelector('th span').textContent=index+1;row.querySelector('th button').setAttribute('onclick',`bulkRemoveRow(${index})`);row.querySelectorAll('[data-bulk-cell]').forEach(cell=>{cell.dataset.row=index;cell.setAttribute('aria-label',`${state.columns[Number(cell.dataset.col)].label} da linha ${index+1}`);});});
 updateCount();
}

function addRows(amount=10,focus=false){
 const body=document.getElementById('bulk-grid-body');if(!body)return;
 const start=body.children.length,requested=Math.max(0,Math.floor(Number(amount)||0)),allowed=Math.min(requested,500-start);
 if(!allowed){window.toast?.('A planilha permite até 500 linhas.','error');return;}
 body.insertAdjacentHTML('beforeend',Array.from({length:allowed},(_,offset)=>rowHtml(start+offset)).join(''));
 const total=document.getElementById('bulk-total-count');if(total)total.value=start+allowed;
 if(allowed<requested)window.toast?.('A planilha foi limitada a 500 linhas.','error');
 if(focus)body.querySelector(`[data-row="${start}"][data-col="0"]`)?.focus();
 updateCount();
}

function rowHasValues(row){return [...row.querySelectorAll('[data-bulk-cell]')].some(input=>input.type==='checkbox'?input.checked:input.value.trim()!=='');}

function focusCell(row,column){
 const target=document.querySelector(`[data-row="${row}"][data-col="${column}"]`);
 if(!target)return false;
 target.focus();target.scrollIntoView({block:'nearest',inline:'nearest'});return true;
}

function updateCount(){
 const rows=readRows(false),count=rows.filter(row=>Object.values(row).some(value=>value!==''&&value!==false)).length;
 const badge=document.getElementById('bulk-filled-count');if(badge)badge.textContent=`${count} lançamento${count===1?'':'s'} preenchido${count===1?'':'s'}`;
}

function setCell(input,value){
 const column=state.columns[Number(input.dataset.col)],raw=String(value??'').trim();
 if(column.type==='checkbox')input.checked=/^(1|sim|s|true|x|yes)$/i.test(raw);
 else if(column.type==='select'){
  const option=[...input.options].find(item=>item.value.toLocaleLowerCase('pt-BR')===raw.toLocaleLowerCase('pt-BR')||item.textContent.toLocaleLowerCase('pt-BR')===raw.toLocaleLowerCase('pt-BR'));
  input.value=option?.value||raw;
 }else input.value=column.type==='date'?(normalizeBulkDate(raw)||''):raw;
}

function readRows(validate=true){
 const rows=[];
 document.querySelectorAll('[data-bulk-row]').forEach(row=>{
  const values={};row.querySelectorAll('[data-bulk-cell]').forEach(input=>{values[input.dataset.key]=input.type==='checkbox'?input.checked:input.value.trim();input.classList.remove('invalid');});
  const used=Object.values(values).some(value=>value!==''&&value!==false);
  if(!used)return;
  if(validate&&!values.description){row.querySelector('[data-key="description"]')?.classList.add('invalid');throw new Error(`Informe o nome na linha ${Number(row.dataset.bulkRow)+1}.`);}
  if(validate){
   for(const key of ['start_date','deadline_date'])if(values[key]&&!normalizeBulkDate(values[key])){row.querySelector(`[data-key="${key}"]`)?.classList.add('invalid');throw new Error(`Confira a data na linha ${Number(row.dataset.bulkRow)+1}. Use dd/mm/aaaa.`);}
  }
  rows.push(values);
 });
 return rows;
}

window.openBulkEntry=function(groupId){
 const group=window.S?.secs?.find(item=>item.id===groupId);
 if(!group||(!window.S.isAdmin&&!window.userCanGroup?.(group,'editar'))){window.toast('Você não pode lançar neste grupo.','error');return;}
 state.group=group;state.columns=bulkColumns(group,(window.S.fieldTemplates||[]).filter(t=>t.atividade_id===groupId));state.busy=false;
 window.openModal('▦ Lançamentos em lote',group.name,`<div class="bulk-intro"><div><strong>Planilha rápida</strong><span>Digite normalmente ou copie linhas do Excel/Google Planilhas e cole em qualquer célula.</span></div><div class="bulk-shortcuts"><kbd>← ↑ → ↓</kbd> navegar <kbd>Tab</kbd> avançar <kbd>Enter</kbd> descer</div></div><div class="bulk-toolbar"><button type="button" class="btn-action" onclick="bulkAddRows(10,true)">＋ 10 linhas</button><button type="button" class="btn-action" onclick="bulkAddRows(25,true)">＋ 25 linhas</button><label class="bulk-quantity"><span>Adicionar</span><input id="bulk-add-count" type="number" min="1" max="500" value="50" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkAddCustomRows()}"><button type="button" onclick="bulkAddCustomRows()">＋ linhas</button></label><label class="bulk-quantity"><span>Total de linhas</span><input id="bulk-total-count" type="number" min="1" max="500" value="12" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkSetRowCount()}"><button type="button" onclick="bulkSetRowCount()">Definir</button></label><button type="button" class="btn-action" onclick="bulkClearGrid()">Limpar planilha</button><span id="bulk-filled-count">0 lançamentos preenchidos</span></div><div class="bulk-grid-wrap"><table class="bulk-grid"><thead><tr><th>#</th>${state.columns.map(column=>`<th style="min-width:${column.width}px">${esc(column.label)}</th>`).join('')}</tr></thead><tbody id="bulk-grid-body"></tbody></table></div><div class="bulk-foot"><p>Até 500 lançamentos por envio. A secretaria e a autoria são preenchidas automaticamente.</p><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button><button type="button" class="btn-save" id="bulk-save" onclick="saveBulkEntries()">Salvar lançamentos</button></div></div>`);
 document.querySelector('#modal-ov .modal-box')?.classList.add('bulk-modal-box');
 addRows(12);
 document.getElementById('bulk-grid-body').addEventListener('input',updateCount);
 document.getElementById('bulk-grid-body').addEventListener('change',updateCount);
 document.getElementById('bulk-grid-body').addEventListener('paste',event=>{
  const target=event.target.closest('[data-bulk-cell]');if(!target)return;
  const text=event.clipboardData?.getData('text/plain');if(!text||(!text.includes('\t')&&!text.includes('\n')))return;
  event.preventDefault();const matrix=text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
  const needed=Number(target.dataset.row)+matrix.length-document.querySelectorAll('[data-bulk-row]').length;if(needed>0)addRows(needed);
  matrix.forEach((values,rowOffset)=>values.forEach((value,columnOffset)=>{const input=document.querySelector(`[data-row="${Number(target.dataset.row)+rowOffset}"][data-col="${Number(target.dataset.col)+columnOffset}"]`);if(input)setCell(input,value);}));
  updateCount();
 });
 document.getElementById('bulk-grid-body').addEventListener('keydown',event=>{
  const target=event.target.closest('[data-bulk-cell]');if(!target||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(event.key))return;
  event.preventDefault();let row=Number(target.dataset.row),column=Number(target.dataset.col);
  if(event.key==='ArrowLeft')column--;
  if(event.key==='ArrowRight')column++;
  if(event.key==='ArrowUp'||(event.key==='Enter'&&event.shiftKey))row--;
  if(event.key==='ArrowDown'||(event.key==='Enter'&&!event.shiftKey))row++;
  if(row>=document.querySelectorAll('[data-bulk-row]').length&&row<500)addRows(1);
  focusCell(Math.max(0,row),Math.max(0,Math.min(column,state.columns.length-1)));
 });
 document.querySelector('[data-row="0"][data-col="0"]')?.focus();
};

window.bulkAddRows=(amount,focus)=>addRows(amount,focus);
window.bulkAddCustomRows=function(){const input=document.getElementById('bulk-add-count'),amount=Math.floor(Number(input?.value));if(!Number.isInteger(amount)||amount<1){window.toast('Informe quantas linhas deseja adicionar.','error');input?.focus();return;}addRows(amount,true);document.getElementById('bulk-total-count').value=document.querySelectorAll('[data-bulk-row]').length;};
window.bulkSetRowCount=function(){const input=document.getElementById('bulk-total-count'),desired=Math.floor(Number(input?.value));if(!Number.isInteger(desired)||desired<1||desired>500){window.toast('Informe um total entre 1 e 500 linhas.','error');input?.focus();return;}const rows=[...document.querySelectorAll('[data-bulk-row]')],current=rows.length;if(desired>current){addRows(desired-current,true);return;}if(desired===current)return;const removed=rows.slice(desired);if(removed.some(rowHasValues)&&!window.confirm(`As últimas ${current-desired} linhas possuem dados. Deseja removê-las?`)){input.value=current;return;}removed.forEach(row=>row.remove());renumber();focusCell(Math.min(desired-1,current-1),0);};
window.bulkRemoveRow=function(index){const rows=[...document.querySelectorAll('[data-bulk-row]')];if(rows.length===1){rows[0].querySelectorAll('[data-bulk-cell]').forEach(input=>{input.value='';input.checked=false;});return updateCount();}rows[index]?.remove();renumber();const total=document.getElementById('bulk-total-count');if(total)total.value=rows.length-1;};
window.bulkClearGrid=function(){if(!window.confirm('Limpar todos os valores digitados nesta planilha?'))return;document.querySelectorAll('[data-bulk-cell]').forEach(input=>{input.value='';input.checked=false;});renumber();};
window.saveBulkEntries=async function(){
 if(state.busy||!state.group)return;
 let rows;try{rows=readRows(true);}catch(error){window.toast(error.message,'error');document.querySelector('.bulk-grid .invalid')?.focus();return;}
 if(!rows.length){window.toast('Preencha pelo menos uma linha.','error');return;}
 if(rows.length>500){window.toast('Envie no máximo 500 lançamentos por vez.','error');return;}
 const button=document.getElementById('bulk-save');state.busy=true;button.disabled=true;button.textContent=`Salvando ${rows.length}…`;
 try{
  const current=window.S.items.filter(item=>item.atividade_id===state.group.id),start=current.length?Math.max(...current.map(item=>Number(item.order_num)||0))+1:0;
  const payloads=bulkPayloads(rows,state.group,start);
  const {error}=await supabase.from('items').insert(payloads);if(error)throw error;
  await window.loadData();window.closeModal();window.toast(`${rows.length} lançamentos salvos de uma vez!`,'success',6000);window.openActivity(state.group.id);
 }catch(error){console.error(error);window.toast('Não foi possível salvar o lote: '+(error.message||error),'error',9000);button.disabled=false;button.textContent='Salvar lançamentos';}
 finally{state.busy=false;}
};
