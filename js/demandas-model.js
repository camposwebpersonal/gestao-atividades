export const UNASSIGNED='sem-secretaria';
export const normalizeDemand=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function demandSecretaria(group,secretarias){
 return secretarias.some(s=>s.id===group.demanda_secretaria_id)?group.demanda_secretaria_id:UNASSIGNED;
}
export function demandSections(groups,secretarias){
 const sections=secretarias.filter(s=>s.demandas_ativa||groups.some(g=>g.demanda_secretaria_id===s.id))
  .map(s=>({...s,groups:groups.filter(g=>demandSecretaria(g,secretarias)===s.id)}))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const pending=groups.filter(g=>demandSecretaria(g,secretarias)===UNASSIGNED);
 if(pending.length)sections.push({id:UNASSIGNED,name:'A classificar',groups:pending});
 return sections;
}
export function reorderDemand(ids,source,target,after=false){
 if(source===target||!ids.includes(source)||!ids.includes(target))return [...ids];
 const next=ids.filter(id=>id!==source);next.splice(next.indexOf(target)+(after?1:0),0,source);return next;
}
export function demandMatches(group,query){
 return normalizeDemand([group.name,group.assunto,group.observacoes,group.responsaveis].join(' ')).includes(normalizeDemand(query).trim());
}
