import {recordSecretary} from './record-context.js';
import {isAttendanceSection} from './atendimento-fluxo.js?v=96e12139';
import {fieldLabel,hiddenColumns,removedFields} from './field-labels.js?v=b924ccca';

function templateOptions(template){
 const raw=template?.options;
 if(Array.isArray(raw))return raw;
 if(typeof raw==='string'){
  try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:raw.split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean);}
  catch{return raw.split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean);}
 }
 return [];
}

export const hasConclusionControl=group=>group?.controle_pendencias===1||group?.controle_pendencias===true||group?.controle_pendencias==='1';
const todayIso=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
// Concluído na planilha: marcado OU com data de conclusão preenchida. Sem data, usa a data de hoje.
export function bulkConclusion(row,group){
 if(!hasConclusionControl(group))return {concluded:0,status:'pendente'};
 const date=normalizeBulkDate(row.conclusion_date),done=Boolean(row.concluido)||Boolean(date);
 return done?{concluded:1,status:'concluido',conclusion_date:date||todayIso()}:{concluded:0,status:'pendente'};
}

// Nomes das colunas fixas podem ser trocados por grupo (extra_fields.field_labels) e colunas podem ser
// ocultadas (extra_fields.bulk_hidden_columns); com includeHidden as ocultas vêm marcadas com hidden:true.
export function bulkColumns(group,templates=[],{scope='item',includeHidden=false}={}){
 const L=key=>fieldLabel(group,key);
 const columns=[
  {key:'description',label:L('description')+' *',type:'text',width:250,required:true},
  {key:'start_date',label:L('start_date'),type:'date',width:145},
  {key:'responsaveis',label:L('responsaveis'),type:'text',width:190}
 ];
 if(isAttendanceSection(group))columns.push(
  {key:'solicitante',label:L('solicitante'),type:'text',width:180,extra:true},
  {key:'urgencia',label:L('urgencia'),type:'select',width:145,extra:true,options:[['verde','Pode aguardar'],['amarelo','Atenção'],['vermelho','Urgente']]},
  {key:'prioritario',label:L('prioritario'),type:'checkbox',width:100,extra:true}
 );
 columns.push({key:'deadline_date',label:L('deadline_date'),type:'date',width:145});
 // Controle de Conclusão ligado no grupo: dá para lançar já concluído (marcar e, se quiser, informar a data).
 if(hasConclusionControl(group))columns.push(
  {key:'concluido',label:L('concluido'),type:'checkbox',width:100},
  {key:'conclusion_date',label:L('conclusion_date'),type:'date',width:150}
 );
 columns.push(
  {key:'observacao',label:L('observacao'),type:'text',width:260}
 );
 templates.filter(template=>template.scope===(scope==='subitem'?'subitem':'item')).sort((a,b)=>(a.order_num||0)-(b.order_num||0)).forEach(template=>{
  const type=template.field_type==='combobox'?'select':template.field_type||'text',choices=['checkboxes','radio'].includes(type);
  columns.push({key:'ef:'+template.field_name,label:template.field_name,type,width:choices?Math.max(260,templateOptions(template).length*95):template.field_type==='textarea'?260:170,extra:true,custom:true,fieldType:template.field_type||'text',templateId:template.id,options:templateOptions(template).map(value=>[String(value),String(value)])});
 });
 const hidden=new Set(hiddenColumns(group,scope==='subitem'?'subitem':'item')),removed=new Set(removedFields(group));
 columns.splice(0,columns.length,...columns.filter(column=>!removed.has(column.key)));
 columns.forEach(column=>{column.baseLabel=column.custom?column.label:L(column.key);if(hidden.has(column.key)&&!column.required)column.hidden=true;});
 return includeHidden?columns:columns.filter(column=>!column.hidden);
}

export function normalizeBulkDate(value){
 const raw=String(value??'').trim();if(!raw)return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
  const [year,month,day]=raw.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?raw:null;
 }
 const br=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
 if(br){
  const day=Number(br[1]),month=Number(br[2]),year=Number(br[3]),date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`:null;
 }
 if(/^\d{5}$/.test(raw)){const date=new Date(Date.UTC(1899,11,30)+Number(raw)*86400000);return date.toISOString().slice(0,10);}
 return null;
}

export function bulkPayloads(rows,group,startOrder=0,now=new Date().toISOString()){
 const fixedSecretary=recordSecretary(group)||null;
 return rows.map((row,index)=>{
  const extra={};
  Object.entries(row).forEach(([key,value])=>{if(key.startsWith('ef:')&&value!=='')extra[key.slice(3)]=value;});
  ['solicitante','urgencia'].forEach(key=>{if(row[key])extra[key]=row[key];});
  if(row.prioritario)extra.prioritario=true;
  return {id:crypto.randomUUID(),atividade_id:group.id,description:row.description.trim(),observacao:row.observacao||'',responsaveis:row.responsaveis||'',secretaria_id:fixedSecretary,start_date:normalizeBulkDate(row.start_date),deadline_date:normalizeBulkDate(row.deadline_date),item_icon:'📋',item_color:'#3B82F6',...bulkConclusion(row,group),order_num:startOrder+index,extra_fields:extra,created_at:now,updated_at:now};
 });
}

// Subitens em lote: as mesmas linhas da planilha viram subitens diretamente dentro de um item.
export function bulkSubPayloads(rows,group,parentItem,startOrder=0,now=new Date().toISOString()){
 if(!parentItem?.id)throw new Error('Escolha o item que vai receber os subitens.');
 return bulkPayloads(rows,group,startOrder,now).map(({item_icon,item_color,...payload})=>({...payload,item_id:parentItem.id,parent_id:parentItem.id,parent_type:'item',secretaria_id:payload.secretaria_id||parentItem.secretaria_id||null}));
}

export async function persistBulkSubPayloads(client,payloads){
 if(!client?.from)throw new Error('Conexão com o banco indisponível.');
 if(!Array.isArray(payloads)||!payloads.length)throw new Error('Nenhum subitem para salvar.');
 const {data,error}=await client.from('subitems').insert(payloads).select('*');
 if(error)throw error;
 if(!Array.isArray(data)||data.length!==payloads.length)throw new Error(`O banco confirmou ${Array.isArray(data)?data.length:0} de ${payloads.length} subitens. Nada foi considerado concluído.`);
 return data;
}

export async function persistBulkPayloads(client,payloads){
 if(!client?.from)throw new Error('Conexão com o banco indisponível.');
 if(!Array.isArray(payloads)||!payloads.length)throw new Error('Nenhum lançamento para salvar.');
 const {data,error}=await client.from('items').insert(payloads).select('*');
 if(error)throw error;
 if(!Array.isArray(data)||data.length!==payloads.length){
  throw new Error(`O banco confirmou ${Array.isArray(data)?data.length:0} de ${payloads.length} lançamentos. Nada foi considerado concluído.`);
 }
 return data;
}
