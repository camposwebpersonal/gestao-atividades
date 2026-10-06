import {URGENCIAS,attendanceValue,recordExtra} from './atendimento-meta.js';

const HIDDEN_FIELDS=new Set([
  'id','extra_fields','created_at','updated_at','created_by','created_by_name','updated_by','updated_by_name',
  'urgencia','prioritario','solicitante','show_conclusion_date','item_show_verba','item_show_documentacao',
  'item_show_licitacao','registro_tipo','modulo','controle_pocos'
]);

export function reportDateTime(value){
  if(!value)return '';
  const raw=typeof value?.toDate==='function'?value.toDate():value?.seconds?new Date(value.seconds*1000):new Date(value);
  if(Number.isNaN(raw.getTime()))return '';
  return raw.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
}

export function meaningfulExtraFields(record){
  return Object.entries(recordExtra(record)).filter(([key,value])=>{
    if(HIDDEN_FIELDS.has(key)||key.startsWith('item_show_'))return false;
    if(value==null||value===''||value===false||value===0||value==='0')return false;
    if(typeof value==='object')return false;
    return true;
  }).map(([key,value])=>({
    label:key.replace(/_/g,' ').split(' ').map(word=>word?word.charAt(0).toLocaleUpperCase('pt-BR')+word.slice(1):word).join(' '),
    value:value===true?'Sim':String(value)
  }));
}

function statusOf(record){
  if(record.concluded==1)return 'Concluído';
  const labels={pendente:'Pendente',andamento:'Em andamento',concluido:'Concluído',cancelado:'Cancelado'};
  return labels[record.status]||record.status||'Pendente';
}

function normalizeRecord(record,number,secretariaName){
  const urgency=attendanceValue(record,'urgencia',null);
  const extra=meaningfulExtraFields(record);
  if(Number(record.verba)>0)extra.push({label:'Verba',value:Number(record.verba).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})});
  if(record.origem_verba)extra.push({label:'Origem da Verba',value:String(record.origem_verba)});
  if(record.documentacao==1)extra.push({label:'Documentação',value:'Concluída'});
  if(record.licitacao==1)extra.push({label:'Licitação',value:'Concluída'});
  return {
    number,
    title:record.description||'Sem descrição',
    observation:record.observacao||'',
    responsibles:record.responsaveis||'',
    requester:attendanceValue(record,'solicitante',''),
    urgency:URGENCIAS[urgency]||'Não informada',
    priority:!!attendanceValue(record,'prioritario',false),
    status:statusOf(record),
    deadline:record.deadline_date||'',
    conclusion:record.conclusion_date||'',
    secretariat:secretariaName||'',
    createdBy:record.created_by_name||'Não registrado (cadastro anterior)',
    createdAt:reportDateTime(record.created_at),
    updatedBy:record.updated_by_name||'',
    updatedAt:reportDateTime(record.updated_at),
    extra
  };
}

export function buildDemandReportRows(items,subitems,secretarias=[]){
  const secretaryName=id=>secretarias.find(s=>s.id===id)?.name||'';
  const rows=[];
  const ordered=[...items].sort((a,b)=>(a.order_num||0)-(b.order_num||0));
  const appendChildren=(itemId,parentId,parentType,prefix)=>{
    const children=subitems.filter(s=>s.item_id===itemId&&s.parent_id===parentId&&(parentType==='item'?s.parent_type!=='subitem':s.parent_type==='subitem'))
      .sort((a,b)=>(a.order_num||0)-(b.order_num||0));
    children.forEach((child,index)=>{
      const number=prefix+'.'+(index+1);
      rows.push({...normalizeRecord(child,number,secretaryName(child.secretaria_id)),isSubitem:true});
      appendChildren(itemId,child.id,'subitem',number);
    });
  };
  ordered.forEach((item,index)=>{
    const number=String(index+1);
    rows.push({...normalizeRecord(item,number,secretaryName(item.secretaria_id)),isSubitem:false});
    appendChildren(item.id,item.id,'item',number);
  });
  return rows;
}
