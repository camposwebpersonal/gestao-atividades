import {recordSecretary} from './record-context.js';
import {isAttendanceSection} from './atendimento-fluxo.js?v=2';

function templateOptions(template){
 const raw=template?.options;
 if(Array.isArray(raw))return raw;
 if(typeof raw==='string'){
  try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:raw.split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean);}
  catch{return raw.split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean);}
 }
 return [];
}

export function bulkColumns(group,templates=[]){
 const columns=[
  {key:'description',label:'Nome / descrição *',type:'text',width:250,required:true},
  {key:'start_date',label:'Data da solicitação',type:'date',width:145},
  {key:'responsaveis',label:'Responsável',type:'text',width:190}
 ];
 if(isAttendanceSection(group))columns.push(
  {key:'solicitante',label:'Solicitante',type:'text',width:180,extra:true},
  {key:'urgencia',label:'Urgência',type:'select',width:145,extra:true,options:[['verde','Pode aguardar'],['amarelo','Atenção'],['vermelho','Urgente']]},
  {key:'prioritario',label:'Prioritário',type:'checkbox',width:100,extra:true}
 );
 columns.push(
  {key:'deadline_date',label:'Prazo',type:'date',width:145},
  {key:'observacao',label:'Observação',type:'text',width:260}
 );
 templates.filter(template=>template.scope==='item').sort((a,b)=>(a.order_num||0)-(b.order_num||0)).forEach(template=>{
  const type=template.field_type==='combobox'?'select':template.field_type||'text',choices=['checkboxes','radio'].includes(type);
  columns.push({key:'ef:'+template.field_name,label:template.field_name,type,width:choices?Math.max(260,templateOptions(template).length*95):template.field_type==='textarea'?260:170,extra:true,options:templateOptions(template).map(value=>[String(value),String(value)])});
 });
 return columns;
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
  return {id:crypto.randomUUID(),atividade_id:group.id,description:row.description.trim(),observacao:row.observacao||'',responsaveis:row.responsaveis||'',secretaria_id:fixedSecretary,start_date:normalizeBulkDate(row.start_date),deadline_date:normalizeBulkDate(row.deadline_date),item_icon:'📋',item_color:'#3B82F6',concluded:0,status:'pendente',order_num:startOrder+index,extra_fields:extra,created_at:now,updated_at:now};
 });
}
