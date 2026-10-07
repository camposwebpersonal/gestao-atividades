export function recordSecretary(group,record,parent){
 return group?.demanda_secretaria_id||record?.secretaria_id||parent?.secretaria_id||'';
}

export function secretaryIsFixed(group){
 return Boolean(group?.demanda_secretaria_id);
}
