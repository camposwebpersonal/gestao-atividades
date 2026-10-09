export function permissionAllows(entry,action='acesso'){
 if(!entry)return false;
 return action==='acesso'?entry.acesso===true||entry.gerenciar===true:entry.gerenciar===true;
}

export function modulePermission(permissoes,moduleId,action='acesso'){
 const entry=permissoes?.modulos?.[moduleId];
 if(!entry)return false;
 return action==='acesso'?entry.acesso===true||entry.gerenciar===true:entry.gerenciar===true||entry.editar===true||entry.criar===true;
}

export function groupCreationPermission(permissoes){
 return permissoes?.pode_criar_grupos===true;
}

export function groupPermission(permissoes,moduleId,group,action='acesso'){
 const module=permissoes?.modulos?.[moduleId];
 if(!modulePermission(permissoes,moduleId,action))return false;
 // Cadastros anteriores não tinham escopo; continuam com o comportamento original.
 if(module.escopo_configurado!==true)return true;
 if(permissionAllows(module.todos_grupos,action))return true;
 if(permissionAllows(module.grupos?.[group?.id],action))return true;
 if(moduleId==='atendimentos'&&permissionAllows(module.secretarias?.[group?.demanda_secretaria_id],action))return true;
 return false;
}

export function demandSecretaryPermission(permissoes,secretariaId,action='acesso'){
 const module=permissoes?.modulos?.atendimentos;
 if(!modulePermission(permissoes,'atendimentos',action))return false;
 if(module.escopo_configurado!==true)return true;
 if(permissionAllows(module.todos_grupos,action))return true;
 return permissionAllows(module.secretarias?.[secretariaId],action);
}

export function scopeCount(module){
 if(!module||module.escopo_configurado!==true)return null;
 return Object.values(module.grupos||{}).filter(x=>permissionAllows(x)).length+
  Object.values(module.secretarias||{}).filter(x=>permissionAllows(x)).length+
  (permissionAllows(module.todos_grupos)?1:0);
}
