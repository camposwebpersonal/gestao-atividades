import {supabase,collection,doc,getDocs,query,where,orderBy,addDoc,updateDoc,deleteDoc,permanentDeleteDoc,setDoc} from '../supabase_compat.js?v=7a75381f';
import {bulkColumns,hasConclusionControl,bulkPayloads,bulkSubPayloads,normalizeBulkDate,persistBulkPayloads,persistBulkSubPayloads} from './bulk-entry-core.js?v=075c8b28';
import {listBulkDrafts,createBulkDraft,updateBulkDraft,deleteBulkDraft,submitBulkDraft} from './bulk-drafts-core.js?v=36f81519';

export {bulkColumns,bulkPayloads,normalizeBulkDate,persistBulkPayloads};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={group:null,target:null,preselect:'',columns:[],busy:false,drafts:[],draft:null,editor:false,selection:null,dragging:false,clipboard:null,dirty:false,saveTimer:0,scrollTimer:0,saving:null};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const draftList=async groupId=>{
 if(window.__bulkDraftApi?.list)return window.__bulkDraftApi.list(groupId);
 const snap=await getDocs(query(collection(supabase,'bulk_entry_drafts'),where('group_id','==',groupId),orderBy('updated_at','desc')));
 return snap.docs.map(item=>({id:item.id,...item.data()}));
};
const draftCreate=async({groupId,title,rowCount=12,columnSignature=[],targetItemId=''})=>{
 if(window.__bulkDraftApi?.create)return window.__bulkDraftApi.create({groupId,title,rowCount,columnSignature,targetItemId});
 const now=new Date().toISOString(),payload={owner_id:window.S?.user?.uid,group_id:groupId,title:String(title||'').trim(),row_count:rowCount,column_signature:columnSignature,grid_data:{version:1,target_item_id:targetItemId||null,rows:Array.from({length:rowCount},()=>({}))},scroll_top:0,scroll_left:0,active_row:0,active_col:0,created_at:now,updated_at:now};
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
// Destino do lote: itens do grupo (padrão) ou subitens dentro de um item escolhido.
function groupItems(){return (window.S?.items||[]).filter(item=>item.atividade_id===state.group?.id).sort((a,b)=>(Number(a.order_num)||0)-(Number(b.order_num)||0));}
function targetOf(draft){const id=draft?.grid_data?.target_item_id;return id?(window.S?.items||[]).find(item=>item.id===id)||null:null;}
const freshGroup=()=>{const g=(window.S?.secs||[]).find(s=>s.id===state.group?.id);if(g)state.group=g;return state.group;};
const groupTemplates=()=>{freshGroup();return (window.S.fieldTemplates||[]).filter(t=>t.atividade_id===state.group.id);};
function buildColumns(target){state.target=target||null;state.columns=applyColumnOrder(bulkColumns(state.group,groupTemplates(),{scope:target?'subitem':'item'}),savedColumnOrder());}
const allColumns=()=>applyColumnOrder(bulkColumns(state.group,groupTemplates(),{scope:orderScope(),includeHidden:true}),[...new Set([...state.columns.map(c=>c.key),...savedColumnOrder()])]);
const canManage=()=>Boolean(window.S?.isAdmin||window.userCanGroup?.(state.group,'editar'));
// ── Ordem das colunas (arrastar o título, setas ou painel "⇄ Colunas") ──
// Fica salva por grupo e por tipo (itens/subitens): no grupo (extra_fields.bulk_column_order, vale para todos)
// quando o usuário pode gerenciar o grupo, e sempre neste aparelho. Os valores são guardados pela chave da
// coluna, então reordenar nunca embaralha o que já foi digitado.
const orderScope=()=>state.target?'subitem':'item';
const orderLocalKey=()=>`bulk-col-order:${window.S?.user?.uid||'anon'}:${state.group?.id}:${orderScope()}`;
const groupExtra=group=>{let e=group?.extra_fields;if(typeof e==='string'){try{e=JSON.parse(e);}catch{e={};}}return e&&typeof e==='object'?e:{};};
function savedColumnOrder(){
 try{const local=JSON.parse(localStorage.getItem(orderLocalKey())||'null');if(Array.isArray(local)&&local.length)return local;}catch{}
 const shared=groupExtra(state.group).bulk_column_order?.[orderScope()];return Array.isArray(shared)?shared:[];
}
function applyColumnOrder(columns,order){
 if(!order?.length)return columns;
 const rank=new Map(order.map((key,index)=>[key,index]));
 // colunas novas (campo criado depois) ficam logo depois da vizinha natural anterior
 const known=columns.filter(c=>rank.has(c.key)).sort((a,b)=>rank.get(a.key)-rank.get(b.key));
 columns.forEach((c,i)=>{if(rank.has(c.key))return;const prev=columns.slice(0,i).reverse().find(x=>known.includes(x));known.splice(prev?known.indexOf(prev)+1:0,0,c);});
 return known;
}
function headHtml(){const can=canManage();return `<th>#</th>${state.columns.map((column,index)=>`<th style="min-width:${column.width}px" data-col-key="${esc(column.key)}" tabindex="0" title="Arraste para mudar a posição (ou Alt + ← →)${can?' · clique duas vezes no nome para renomear':''}"><span class="bulk-col-head"><span class="bulk-col-grip" aria-hidden="true">⠿</span><span class="bulk-col-name" ${can?`ondblclick="bulkRenameColumn('${esc(column.key)}')"`:''}>${esc(column.label)}</span>${can?`<button type="button" class="bulk-col-rename" onclick="bulkRenameColumn('${esc(column.key)}')" aria-label="Renomear a coluna ${esc(column.label)}" title="Renomear coluna">✏️</button>`:''}</span></th>`).join('')}`;}
const TYPE_NAMES={text:'Texto',number:'Número',date:'Data',textarea:'Texto longo',combobox:'Lista',select:'Lista',checkboxes:'Múltipla escolha',radio:'Escolha única',checkbox:'Sim / não'};
function columnPanelHtml(){
 const can=canManage(),cols=allColumns(),visible=state.columns.map(c=>c.key);
 const rows=cols.map(column=>{const index=visible.indexOf(column.key),hidden=index<0,fixed=!column.custom;
  return `<li class="${hidden?'is-hidden':''}" data-panel-key="${esc(column.key)}"><span class="bulk-col-pos">${hidden?'—':index+1}</span>
   ${can?`<input class="bulk-col-label" value="${esc(fixed?window.customFieldLabel?.(state.group,column.key)||column.baseLabel:column.label)}" placeholder="${esc(column.baseLabel)}" aria-label="Nome da coluna ${esc(column.label)}" data-key="${esc(column.key)}" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}else if(event.key==='Escape'){this.value=this.defaultValue;this.blur()}" onchange="bulkRenameColumn('${esc(column.key)}',this.value)">`:`<span class="bulk-col-label-ro">${esc(column.label)}</span>`}
   <small class="bulk-col-type ${fixed?'is-fixed':''}">${fixed?'fixo':esc(TYPE_NAMES[column.fieldType]||column.fieldType||'Texto')}${column.required?' · obrigatório':''}</small>
   ${hidden?'':`<button type="button" onclick="bulkMoveColumn(${index},${index-1})" ${index?'':'disabled'} aria-label="Subir ${esc(column.label)}">↑</button><button type="button" onclick="bulkMoveColumn(${index},${index+1})" ${index<visible.length-1?'':'disabled'} aria-label="Descer ${esc(column.label)}">↓</button>`}
   ${can&&!column.required?`<button type="button" class="bulk-col-eye" onclick="bulkToggleHidden('${esc(column.key)}',${hidden?'false':'true'})" aria-label="${hidden?'Mostrar':'Ocultar'} ${esc(column.label)}" title="${hidden?'Mostrar esta coluna':'Ocultar esta coluna da planilha (os dados continuam guardados)'}">${hidden?'🚫':'👁'}</button>`:''}</li>`;}).join('');
 const add=can?`<details class="bulk-col-new"><summary>＋ Criar novo campo neste grupo</summary><div class="bulk-col-new-form">
   <label><span>Nome do campo</span><input id="bulk-new-field-name" maxlength="80" placeholder="Ex.: Comunidade, Quantidade, Nº do pedido…" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkCreateField()}"></label>
   <label><span>Tipo</span><select id="bulk-new-field-type" onchange="document.getElementById('bulk-new-field-opts-wrap').hidden=!['combobox','checkboxes','radio'].includes(this.value)">${Object.entries({text:'Texto',number:'Número',date:'Data',textarea:'Texto longo',combobox:'Lista (escolher 1)',radio:'Escolha única (botões)',checkboxes:'Múltipla escolha'}).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
   <label id="bulk-new-field-opts-wrap" hidden><span>Opções (uma por linha)</span><textarea id="bulk-new-field-opts" rows="3" placeholder="Sítio&#10;Povoado&#10;Zona urbana"></textarea></label>
   <button type="button" class="bulk-col-create" onclick="bulkCreateField()">Criar campo</button></div></details>`:'';
 return `<div class="bulk-col-panel-head"><strong>⚙️ Colunas e campos deste grupo</strong><span>${can?'Troque o nome de qualquer coluna (vale no formulário, na tabela e no PDF), mude a ordem, oculte o que não usa e crie campos novos. Apagar o nome de uma coluna fixa volta ao padrão.':'Só quem gerencia o grupo pode renomear ou criar campos.'}</span></div><ol>${rows}</ol>${add}<div class="bulk-col-panel-foot"><button type="button" onclick="bulkResetColumns()">↺ Ordem padrão</button><button type="button" class="bulk-col-done" onclick="bulkToggleColumnPanel(false)">Pronto</button></div>`;
}
function rerenderGrid(rowsOverride){
 const rows=rowsOverride||gridRows(),count=Math.max(rows.length,1),wrap=document.querySelector('.bulk-grid-wrap'),scroll=[wrap?.scrollTop||0,wrap?.scrollLeft||0];
 const head=document.getElementById('bulk-grid-head'),body=document.getElementById('bulk-grid-body');if(!head||!body)return;
 head.innerHTML=headHtml();body.innerHTML='';addRows(count);
 rows.forEach((values,row)=>state.columns.forEach((column,col)=>{if(Object.prototype.hasOwnProperty.call(values||{},column.key))setCell(cellAt(row,col),values[column.key]);}));
 stashHidden(rows);
 const panel=document.getElementById('bulk-col-panel');if(panel&&!panel.hidden)panel.innerHTML=columnPanelHtml();
 if(wrap){wrap.scrollTop=scroll[0];wrap.scrollLeft=scroll[1];}updateCount();
}
let orderTimer=0;
function persistColumnOrder(){
 const keys=state.columns.map(c=>c.key),scope=orderScope(),group=state.group;
 try{localStorage.setItem(orderLocalKey(),JSON.stringify(keys));}catch{}
 clearTimeout(orderTimer);
 if(!window.userCanGroup?.(group,'editar'))return;
 orderTimer=setTimeout(async()=>{
  const extra=groupExtra(group),bulk_column_order={...(extra.bulk_column_order||{}),[scope]:keys};
  try{await updateDoc(doc(window.db,'secretariats',group.id),{extra_fields:{...extra,bulk_column_order}});group.extra_fields={...extra,bulk_column_order};}
  catch(error){console.warn('Ordem das colunas salva só neste aparelho',error);}
 },700);
}
window.bulkMoveColumn=function(from,to,silent=false){
 if(to<0||to>=state.columns.length||from===to)return;
 const [column]=state.columns.splice(from,1);state.columns.splice(to,0,column);
 rerenderGrid();persistColumnOrder();markDirty();
 if(!silent)window.toast?.(`“${column.label}” agora é a coluna ${to+1}. Ordem salva para os próximos lançamentos.`,'success',2600);
 document.querySelector(`#bulk-grid-head [data-col-key="${CSS.escape(column.key)}"]`)?.classList.add('bulk-col-moved');
};
window.bulkMarkConcluded=function(){
 const col=state.columns.findIndex(c=>c.key==='concluido');if(col<0)return;
 const b=state.selection?selectionBounds():null,rows=allRows();
 let targets=b&&b.bottom>b.top?rows.slice(b.top,b.bottom+1):rows.filter(rowHasValues);
 if(!targets.length&&b)targets=[rows[b.top]];
 const boxes=targets.map(row=>cellAt(Number(row.dataset.bulkRow),col)).filter(Boolean),allOn=boxes.length&&boxes.every(x=>x.checked);
 boxes.forEach(x=>{x.checked=!allOn;});markDirty();
 window.toast?.(allOn?`${boxes.length} linha(s) voltaram para em andamento.`:`${boxes.length} linha(s) marcadas como concluídas. Sem data, vale a de hoje.`,'success',3200);
};
// ── Renomear / ocultar / criar campos (regra do usuário, 23/11/2026: flexibilidade total) ──
function remapRows(rows,from,to){return rows.map(row=>{if(!Object.prototype.hasOwnProperty.call(row,from))return row;const copy={...row};if(copy[to]===undefined||copy[to]===''||copy[to]===false)copy[to]=copy[from];delete copy[from];return copy;});}
function remapLocalOrder(from,to){try{const key=orderLocalKey(),local=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(local))localStorage.setItem(key,JSON.stringify(local.map(k=>k===from?to:k)));}catch{}}
function refreshColumns(rows){const order=state.columns.map(c=>c.key);state.columns=applyColumnOrder(bulkColumns(state.group,groupTemplates(),{scope:orderScope()}),order);rerenderGrid(rows);bindColumnDrag();}
window.bulkRenameColumn=async function(key,value){
 if(!canManage()){window.toast?.('Só quem gerencia o grupo pode renomear colunas.','error');return;}
 const column=allColumns().find(c=>c.key===key);if(!column)return;
 if(value===undefined){ // edição direto no título da coluna
  const th=document.querySelector(`#bulk-grid-head [data-col-key="${CSS.escape(key)}"]`),span=th?.querySelector('.bulk-col-name');if(!span||th.querySelector('.bulk-col-edit'))return;
  const input=document.createElement('input');input.className='bulk-col-edit';input.maxLength=80;input.value=column.custom?column.label:(window.customFieldLabel?.(state.group,key)||column.baseLabel);input.placeholder=column.baseLabel;input.setAttribute('aria-label','Novo nome da coluna');
  span.hidden=true;span.after(input);input.focus();input.select();let done=false;
  const finish=save=>{if(done)return;done=true;const v=input.value;input.remove();span.hidden=false;if(save&&v.trim()!==(column.custom?column.label:column.label.replace(/\s*\*$/,'')))window.bulkRenameColumn(key,v);};
  input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);}});
  input.addEventListener('blur',()=>finish(true));return;
 }
 const before=column.label.replace(/\s*\*$/,'');
 if(column.custom&&!String(value).trim()){window.toast?.('O campo precisa de um nome.','error');refreshPanel();return;}
 status('Renomeando…','pending');
 try{
  const rows=gridRows(),res=await window.renameGroupField(state.group.id,key,value,{scope:orderScope()});
  let finalRows=rows;
  if(column.custom&&res?.name&&res.name!==before){const to='ef:'+res.name;finalRows=remapRows(rows,key,to);remapLocalOrder(key,to);state.columns=state.columns.map(c=>c.key===key?{...c,key:to}:c);
   const r=res.result||{},n=(r.items||0)+(r.subitems||0);window.toast?.(`Campo “${before}” agora se chama “${res.name}”${n?` — atualizado em ${n} lançamento(s) já gravado(s)`:''}.`,'success',5000);}
  else window.toast?.(`Coluna “${before}” agora se chama “${res?.name||before}” neste grupo (planilha, formulário, tabela e PDF).`,'success',4200);
  refreshColumns(finalRows);refreshPanel();markDirty();status('Salvo','saved');
 }catch(error){status('Não renomeado','error');window.toast?.(error.message||String(error),'error',7000);refreshPanel();}
};
function refreshPanel(){const panel=document.getElementById('bulk-col-panel');if(panel&&!panel.hidden){const open=panel.querySelector('.bulk-col-new')?.open;panel.innerHTML=columnPanelHtml();if(open)panel.querySelector('.bulk-col-new').open=true;}}
window.bulkToggleHidden=async function(key,hide){
 const rows=gridRows(),column=allColumns().find(c=>c.key===key);
 try{await window.setBulkColumnHidden(state.group.id,key,hide,orderScope());}catch(error){window.toast?.('Não foi possível salvar: '+(error.message||error),'error',6000);return;}
 const order=state.columns.map(c=>c.key);if(!hide&&!order.includes(key)){const all=allColumns().map(c=>c.key),i=all.indexOf(key);order.splice(Math.min(order.length,Math.max(0,i)),0,key);}
 state.columns=applyColumnOrder(bulkColumns(state.group,groupTemplates(),{scope:orderScope()}),order);rerenderGrid(rows);refreshPanel();persistColumnOrder();markDirty();
 window.toast?.(hide?`“${column?.label}” ocultada da planilha. O que já foi digitado continua guardado.`:`“${column?.label}” de volta na planilha.`,'success',3200);
};
window.bulkCreateField=async function(){
 const name=document.getElementById('bulk-new-field-name')?.value.replace(/\s+/g,' ').trim(),type=document.getElementById('bulk-new-field-type')?.value||'text';
 if(!name){window.toast?.('Dê um nome ao campo novo.','error');document.getElementById('bulk-new-field-name')?.focus();return;}
 const scope=orderScope(),same=groupTemplates().filter(t=>t.scope===scope);
 const norm=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
 if(same.some(t=>norm(t.field_name)===norm(name))||allColumns().some(c=>norm(c.label.replace(/\s*\*$/,''))===norm(name))){window.toast?.(`Já existe uma coluna chamada “${name}”.`,'error');return;}
 let options=[];if(['combobox','checkboxes','radio'].includes(type)){options=[...new Set((document.getElementById('bulk-new-field-opts')?.value||'').split('\n').map(v=>v.trim()).filter(Boolean))];if(!options.length){window.toast?.('Escreva as opções da lista, uma por linha.','error');return;}}
 const rows=gridRows();
 try{await window.addDoc(window.collection(window.db,'fieldTemplates'),{atividade_id:state.group.id,scope,field_name:name,field_type:type,options,order_num:Math.max(-1,...same.map(t=>Number(t.order_num)||0))+1,created_at:window.serverTimestamp()});await window.loadData?.();}
 catch(error){window.toast?.('Não foi possível criar o campo: '+(window.friendlyDbError?.(error)||error.message||error),'error',7000);return;}
 const order=[...state.columns.map(c=>c.key),'ef:'+name];state.columns=applyColumnOrder(bulkColumns(state.group,groupTemplates(),{scope}),order);rerenderGrid(rows);refreshPanel();persistColumnOrder();markDirty();
 window.toast?.(`Campo “${name}” criado — já aparece na planilha, no formulário e no PDF deste grupo.`,'success',4500);
 document.querySelector(`#bulk-grid-head [data-col-key="${CSS.escape('ef:'+name)}"]`)?.scrollIntoView({inline:'center',block:'nearest'});
};
window.bulkResetColumns=function(){
 try{localStorage.removeItem(orderLocalKey());}catch{}
 state.columns=bulkColumns(state.group,(window.S.fieldTemplates||[]).filter(t=>t.atividade_id===state.group.id),{scope:orderScope()});
 rerenderGrid();persistColumnOrder();markDirty();window.toast?.('Colunas de volta à ordem padrão.','success',2200);
};
window.bulkToggleColumnPanel=function(show){
 const panel=document.getElementById('bulk-col-panel');if(!panel)return;
 const open=show??panel.hidden;panel.hidden=!open;if(open)panel.innerHTML=columnPanelHtml();
 document.getElementById('bulk-col-toggle')?.setAttribute('aria-expanded',String(open));
};
function bindColumnDrag(){
 const head=document.getElementById('bulk-grid-head');if(!head||head.dataset.bound)return;head.dataset.bound='1';
 let drag=null;
 const ths=()=>[...head.querySelectorAll('[data-col-key]')];
 const clearMarks=()=>ths().forEach(th=>th.classList.remove('bulk-drop-before','bulk-drop-after','bulk-col-dragging'));
 const targetIndex=x=>{const list=ths();for(let i=0;i<list.length;i++){const r=list[i].getBoundingClientRect();if(x<r.left+r.width/2)return i;}return list.length;};
 head.addEventListener('pointerdown',event=>{const th=event.target.closest('[data-col-key]');if(!th||event.button>0||event.target.closest('button,input'))return;drag={th,from:ths().indexOf(th),x:event.clientX,active:false,id:event.pointerId};});
 head.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(!drag.active){if(Math.abs(event.clientX-drag.x)<8)return;drag.active=true;head.setPointerCapture(event.pointerId);drag.th.classList.add('bulk-col-dragging');}
  event.preventDefault();clearMarks();drag.th.classList.add('bulk-col-dragging');
  const index=targetIndex(event.clientX),list=ths();drag.to=index;
  if(index<list.length)list[index].classList.add('bulk-drop-before');else list[list.length-1].classList.add('bulk-drop-after');
  const wrap=document.querySelector('.bulk-grid-wrap'),r=wrap?.getBoundingClientRect();if(r){if(event.clientX>r.right-40)wrap.scrollLeft+=18;else if(event.clientX<r.left+40)wrap.scrollLeft-=18;}
 });
 const end=()=>{if(drag?.active){clearMarks();const to=drag.to>drag.from?drag.to-1:drag.to;window.bulkMoveColumn(drag.from,Math.max(0,Math.min(state.columns.length-1,to)));}drag=null;};
 head.addEventListener('pointerup',end);head.addEventListener('pointercancel',()=>{clearMarks();drag=null;});
 head.addEventListener('keydown',event=>{
  const th=event.target.closest('[data-col-key]');if(!th||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();const from=ths().indexOf(th),to=from+(event.key==='ArrowLeft'?-1:1);window.bulkMoveColumn(from,to,true);
  head.querySelector(`[data-col-key="${CSS.escape(th.dataset.colKey)}"]`)?.focus();
 });
}
function targetOptions(selected=''){return `<option value="">📋 Itens deste grupo</option>${groupItems().map((item,index)=>`<option value="${esc(item.id)}" ${item.id===selected?'selected':''}>↳ Subitens dentro de: ${index+1}. ${esc(item.description||'Sem nome')}</option>`).join('')}`;}
function targetBanner(){return `<div class="bulk-target ${state.target?'is-sub':''}"><label for="bulk-target-select"><span>Onde estes lançamentos vão entrar?</span><select id="bulk-target-select" onchange="bulkChangeTarget(this.value)">${targetOptions(state.target?.id||'')}</select></label><p>${state.target?`Cada linha vira um <b>subitem</b> dentro de “${esc(state.target.description||'item')}”.`:'Cada linha vira um <b>item</b> do grupo.'}</p></div>`;}

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

function gridRows(){return allRows().map(row=>({...(row._hidden||{}),...Object.fromEntries([...row.querySelectorAll('[data-bulk-cell]')].map(cell=>[cell.dataset.key,cellValue(cell)]))}));}
// Valores de colunas ocultas ficam guardados na linha (não se perdem ao ocultar nem ao enviar).
function stashHidden(rows){const visible=new Set(state.columns.map(c=>c.key));allRows().forEach((row,index)=>{const values=rows[index]||{},keep={};Object.keys(values).forEach(key=>{if(!visible.has(key)&&values[key]!==''&&values[key]!=null&&values[key]!==false)keep[key]=values[key];});row._hidden=Object.keys(keep).length?keep:undefined;});}
function draftPatch(){
 const wrap=document.querySelector('.bulk-grid-wrap'),active=document.activeElement?.closest?.('[data-bulk-cell]'),selection=state.selection||{focusRow:0,focusCol:0};
 return {title:(document.getElementById('bulk-draft-title')?.value||state.draft?.title||'').trim(),grid_data:{version:1,target_item_id:state.target?.id||null,rows:gridRows()},column_signature:columnSignature(),row_count:allRows().length,scroll_top:Math.round(wrap?.scrollTop||0),scroll_left:Math.round(wrap?.scrollLeft||0),active_row:Number(active?.dataset.row??selection.focusRow??0),active_col:Number(active?.dataset.col??selection.focusCol??0)};
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
 stashHidden(rows);
 const row=clamp(source.active_row,0,count-1),col=clamp(source.active_col,0,state.columns.length-1);selectCell(row,col);
 requestAnimationFrame(()=>{const wrap=document.querySelector('.bulk-grid-wrap'),target=cellAt(row,col);if(wrap){wrap.scrollTop=source.scroll_top||0;wrap.scrollLeft=source.scroll_left||0;}target?.focus({preventScroll:true});updateCount();});
}

function readRows(validate=true){
 const rows=[];allRows().forEach(row=>{const values={...(row._hidden||{})};row.querySelectorAll('[data-bulk-cell]').forEach(input=>{values[input.dataset.key]=cellValue(input);input.classList.remove('invalid');});const used=Object.values(values).some(value=>Array.isArray(value)?value.length>0:value!==''&&value!==false);if(!used)return;if(validate&&!values.description){row.querySelector('[data-key="description"]')?.classList.add('invalid');throw new Error(`Informe o nome na linha ${Number(row.dataset.bulkRow)+1}.`);}if(validate)for(const key of ['start_date','deadline_date','conclusion_date'])if(values[key]&&!normalizeBulkDate(values[key])){row.querySelector(`[data-key="${key}"]`)?.classList.add('invalid');throw new Error(`Confira a data na linha ${Number(row.dataset.bulkRow)+1}. Use dd/mm/aaaa.`);}rows.push(values);});return rows;
}

function bindGrid(){
 const body=document.getElementById('bulk-grid-body'),wrap=document.querySelector('.bulk-grid-wrap');if(!body)return;
 body.addEventListener('focusin',event=>{const target=event.target.closest('[data-bulk-cell]');if(target&&!state.dragging&&!target.classList.contains('bulk-cell-selected'))selectCell(Number(target.dataset.row),Number(target.dataset.col));});
 body.addEventListener('pointerdown',event=>{const target=event.target.closest('[data-bulk-cell]');if(!target)return;selectCell(Number(target.dataset.row),Number(target.dataset.col),event.shiftKey);state.dragging=true;});
 body.addEventListener('pointerover',event=>{if(!state.dragging)return;const target=event.target.closest('[data-bulk-cell]');if(target)selectCell(Number(target.dataset.row),Number(target.dataset.col),true);});
 body.addEventListener('input',markDirty);body.addEventListener('change',markDirty);
 body.addEventListener('change',event=>{const cell=event.target.closest?.('[data-key="conclusion_date"]');if(!cell||!String(cell.value||'').trim())return;const box=document.querySelector(`[data-row="${cell.dataset.row}"][data-key="concluido"]`);if(box&&!box.checked){box.checked=true;markDirty();}});
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
 buildColumns(targetOf(draft));
 state.draft=draft;state.editor=true;state.busy=false;state.dirty=false;state.selection=null;
 window.openModal('▦ Planilha de lançamentos',state.group.name,`<div class="bulk-draft-head"><button type="button" class="btn-action" onclick="bulkBackToDrafts()">← Meus lotes</button><label><span>Título deste lote</span><input id="bulk-draft-title" maxlength="180" value="${esc(draft.title)}" oninput="bulkDraftChanged()"></label><span id="bulk-save-status" data-tone="saved">Salvo no Supabase</span></div>${targetBanner()}<div class="bulk-intro"><div><strong>Planilha inteligente</strong><span>Selecione células arrastando ou com Shift + setas. Funciona como no Excel.</span></div><div class="bulk-shortcuts"><kbd>Ctrl C</kbd> copiar <kbd>Ctrl V</kbd> colar <kbd>Ctrl D</kbd> repetir de cima <span class="bulk-col-tip">· arraste o título para mudar a ordem · ✏️ ou duplo clique no título para renomear</span></div></div><div class="bulk-toolbar"><button type="button" class="btn-action" onclick="bulkAddRows(10,true)">＋ 10 linhas</button><button type="button" class="btn-action" onclick="bulkAddRows(25,true)">＋ 25 linhas</button><label class="bulk-quantity"><span>Adicionar</span><input id="bulk-add-count" type="number" min="1" max="500" value="50" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkAddCustomRows()}"><button type="button" onclick="bulkAddCustomRows()">＋ linhas</button></label><label class="bulk-quantity"><span>Total</span><input id="bulk-total-count" type="number" min="1" max="500" value="12" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkSetRowCount()}"><button type="button" onclick="bulkSetRowCount()">Definir</button></label><button type="button" class="btn-action" onclick="bulkCopySelection()">Copiar</button><button type="button" class="btn-action" onclick="bulkPasteSelection()">Colar</button><button type="button" class="btn-action bulk-fill-button" onclick="bulkFillDown()">Repetir ↓</button><button type="button" class="btn-action" onclick="bulkClearGrid()">Limpar</button>${hasConclusionControl(state.group)?'<button type="button" class="btn-action bulk-done-button" onclick="bulkMarkConcluded()" title="Marca como concluídas as linhas selecionadas (ou todas as preenchidas)">✓ Concluir selecionadas</button>':''}<button type="button" class="btn-action bulk-col-toggle" id="bulk-col-toggle" aria-expanded="false" onclick="bulkToggleColumnPanel()" title="Renomear, ordenar, ocultar e criar colunas">⚙️ Colunas e campos</button><span id="bulk-selection-count">Selecione células</span><span id="bulk-filled-count">0 lançamentos preenchidos</span></div><div id="bulk-col-panel" class="bulk-col-panel" hidden></div><div class="bulk-grid-wrap"><table class="bulk-grid"><thead><tr id="bulk-grid-head">${headHtml()}</tr></thead><tbody id="bulk-grid-body"></tbody></table></div><div class="bulk-foot"><p>Salvamento automático ativo. O lote só vira cadastro quando você enviar.</p><div class="modal-actions"><button type="button" class="btn-cancel" onclick="bulkSaveAndClose()">Salvar e fechar</button><button type="button" class="btn-save" id="bulk-save" onclick="saveBulkEntries()">${state.target?'Enviar subitens':'Enviar lançamentos'}</button></div></div>`);
 document.querySelector('#modal-ov .modal-box')?.classList.add('bulk-modal-box');restoreGrid(draft);bindGrid();bindColumnDrag();window.bulkModalClosing=()=>{const saving=saveDraftNow(true);state.editor=false;return saving;};
}

function renderManager(){
 state.editor=false;state.draft=null;state.selection=null;window.bulkModalClosing=null;
 const user=window.S?.user?.displayName||window.S?.user?.email?.split('@')[0]||'usuário';
 const cards=state.drafts.map(draft=>{const count=filledRows(draft.grid_data?.rows);return `<article class="bulk-draft-card"><div class="bulk-draft-icon">▦</div><div><strong>${esc(draft.title)}</strong><span>${count} preenchido(s) · ${draft.row_count} linhas${targetOf(draft)?` · ↳ subitens de ${esc(targetOf(draft).description||'item')}`:''}</span><small>Atualizado em ${esc(formatDate(draft.updated_at))}</small></div><div class="bulk-draft-actions"><button type="button" class="btn-action primary" onclick="bulkOpenDraft('${esc(draft.id)}')">Continuar</button><button type="button" class="btn-action danger" onclick="bulkDeleteDraft('${esc(draft.id)}')">Excluir</button></div></article>`;}).join('');
 window.openModal('▦ Meus lançamentos em lote',state.group.name,`<section class="bulk-drafts-manager"><div class="bulk-drafts-banner"><div><strong>Seus lotes ficam guardados automaticamente</strong><span>Continue deste computador, de casa ou de outro dispositivo com seu usuário.</span></div><b>👤 ${esc(user)}</b></div><div class="bulk-new-draft"><label for="bulk-new-title">Título do novo lote</label><div><input id="bulk-new-title" maxlength="180" placeholder="Ex.: LANÇAMENTOS DE RICARDO — ${esc(state.group.name)}"><button type="button" class="btn-save" onclick="bulkCreateDraft()">＋ Criar novo lote</button></div><label class="bulk-new-target" for="bulk-new-target"><span>Os lançamentos deste lote serão</span><select id="bulk-new-target">${targetOptions(state.preselect)}</select></label></div><div class="bulk-drafts-heading"><strong>Rascunhos deste cadastro</strong><span>${state.drafts.length} lote(s)</span></div><div class="bulk-drafts-list">${cards||'<div class="bulk-drafts-empty"><b>Nenhum lote pendente</b><span>Crie um acima. Ele só desaparecerá depois do envio ou se você excluir.</span></div>'}</div><div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Fechar</button></div></section>`);
 document.querySelector('#modal-ov .modal-box')?.classList.add('bulk-drafts-modal-box');
 setTimeout(()=>document.getElementById('bulk-new-title')?.focus(),60);
}

window.openBulkEntry=async function(groupId,targetItemId=''){
 if(!window.userCanCreateItems?.()){window.toast('Seu usuário não tem permissão para criar itens ou subitens.','error',7000);return;}
 const group=window.S?.secs?.find(item=>item.id===groupId);if(!group||(!window.S.isAdmin&&!window.userCanGroup?.(group,'editar'))){window.toast('Você não pode lançar neste grupo.','error');return;}
 state.group=group;state.preselect=targetItemId||'';buildColumns(null);state.busy=false;
 window.openModal('▦ Meus lançamentos em lote',group.name,'<div class="bulk-drafts-loading">Carregando seus lotes salvos…</div>');
 try{state.drafts=await draftList(groupId);renderManager();}catch(error){console.error(error);window.openModal('Não foi possível abrir os lotes',group.name,`<div class="bulk-drafts-empty"><b>Falha ao acessar seus rascunhos</b><span>${esc(error.message)}</span><button type="button" class="btn-action" onclick="openBulkEntry('${esc(groupId)}')">Tentar novamente</button></div>`);}
};
window.bulkCreateDraft=async function(){
 const input=document.getElementById('bulk-new-title'),title=input?.value.trim();if(!title){window.toast('Dê um título para identificar este lote.','error');input?.focus();return;}
 const button=input.parentElement.querySelector('button');button.disabled=true;button.textContent='Criando…';
 const targetItemId=document.getElementById('bulk-new-target')?.value||'';buildColumns(targetItemId?(window.S?.items||[]).find(item=>item.id===targetItemId):null);
 try{const draft=await draftCreate({groupId:state.group.id,title,rowCount:12,columnSignature:columnSignature(),targetItemId});state.drafts.unshift(draft);renderEditor(draft);}catch(error){window.toast('Não foi possível criar o lote: '+error.message,'error',7000);button.disabled=false;button.textContent='＋ Criar novo lote';}
};
window.bulkOpenDraft=id=>{const draft=state.drafts.find(item=>item.id===id);if(draft)renderEditor(draft);};
window.bulkDeleteDraft=async function(id){
 const draft=state.drafts.find(item=>item.id===id);if(!draft||!window.confirm(`Enviar o lote “${draft.title}” para a lixeira?\n\nEle poderá ser restaurado pela administração.`))return;
 try{await draftDelete(id);localStorage.removeItem(localKey(id));state.drafts=state.drafts.filter(item=>item.id!==id);renderManager();window.toast('Lote enviado para a lixeira.','success');}catch(error){window.toast('Não foi possível excluir: '+error.message,'error',7000);}
};
window.bulkBackToDrafts=async function(){await saveDraftNow(true);state.drafts=await draftList(state.group.id).catch(()=>state.drafts);renderManager();};
window.bulkSaveAndClose=async function(){await saveDraftNow(true);const pending=state.draft?.offline_pending;state.editor=false;window.bulkModalClosing=null;window.closeModal();window.toast(pending?'Lote salvo neste aparelho. Ele irá para os outros dispositivos após sincronizar.':'Lote salvo. Você pode continuar depois de qualquer dispositivo.','success',4500);};
window.bulkDraftChanged=markDirty;
window.bulkChangeTarget=async function(itemId){
 const rows=gridRows(),target=itemId?(window.S?.items||[]).find(item=>item.id===itemId)||null:null;
 const draft={...state.draft,title:(document.getElementById('bulk-draft-title')?.value||state.draft.title),grid_data:{...(state.draft.grid_data||{}),target_item_id:target?.id||null,rows},row_count:allRows().length};
 try{localStorage.removeItem(localKey(draft.id));}catch(_){}
 renderEditor(draft);state.dirty=true;await saveDraftNow(true);
 window.toast?.(target?`Este lote agora cria subitens dentro de “${target.description||'item'}”.`:'Este lote agora cria itens do grupo.','info',4500);
};
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
  let saved;
  if(state.target){
   const parent=(window.S.items||[]).find(item=>item.id===state.target.id);if(!parent)throw new Error('O item de destino não existe mais. Escolha outro no topo da planilha.');
   const siblings=(window.S.subitems||[]).filter(sub=>sub.item_id===parent.id&&sub.parent_type!=='subitem'),start=siblings.length?Math.max(...siblings.map(sub=>Number(sub.order_num)||0))+1:0;
   const payloads=bulkSubPayloads(rows,state.group,parent,start);
   if(navigator.onLine!==false&&!state.draft?.offline_pending&&!window.__bulkDraftApi){saved=await persistBulkSubPayloads(supabase,payloads);await permanentDeleteDoc(doc(supabase,'bulk_entry_drafts',state.draft.id));}
   else{for(const payload of payloads)await setDoc(doc(supabase,'subitems',payload.id),payload);await draftDelete(state.draft.id).catch(()=>permanentDeleteDoc(doc(supabase,'bulk_entry_drafts',state.draft.id)));saved=payloads;}
  }else{
  const current=window.S.items.filter(item=>item.atividade_id===state.group.id),start=current.length?Math.max(...current.map(item=>Number(item.order_num)||0))+1:0,payloads=bulkPayloads(rows,state.group,start);
  saved=await draftSubmit(state.draft.id,payloads);
  // garante a data de conclusão mesmo se a função do banco ainda não grava conclusion_date
  const wanted=new Map(payloads.filter(p=>p.concluded===1).map(p=>[p.id,p.conclusion_date]));
  for(const row of saved||[])if(wanted.has(row.id)&&!row.conclusion_date){try{await updateDoc(doc(supabase,'items',row.id),{conclusion_date:wanted.get(row.id),concluded:1,status:'concluido'});row.conclusion_date=wanted.get(row.id);}catch(error){console.warn('conclusão do lote',error);}}
  }button.textContent='Atualizando a tela…';localStorage.removeItem(localKey(state.draft.id));
  await window.loadData();const list=state.target?'subitems':'items',loadedIds=new Set((window.S[list]||[]).map(item=>item.id)),missing=saved.filter(item=>!loadedIds.has(item.id));if(missing.length)window.S[list].push(...missing);
  const groupId=state.group.id;state.editor=false;state.draft=null;window.bulkModalClosing=null;window.closeModal();window.toast(state.target?`${saved.length} subitens criados dentro de “${state.target.description||'item'}”!`:`${saved.length} lançamentos enviados e o rascunho concluído foi removido!`,'success',6500);window.openActivity(groupId);
 }catch(error){console.error(error);window.toast('Não foi possível enviar o lote: '+(error.message||error)+'. O rascunho foi preservado.','error',9000);button.disabled=false;button.textContent='Enviar lançamentos';}
 finally{state.busy=false;}
};
