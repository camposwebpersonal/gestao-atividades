const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function setup(saveFails=false,role='admin'){
 const logins=[],profiles=[];const account={id:'target',email:'maria@pms.sertania',user_metadata:{display_name:'Maria'}};
 const client={auth:{getUser:async()=>({data:{user:{id:'actor',email:'admin@example.com'}}}),admin:{getUserById:async()=>({data:{user:account}}),updateUserById:async(id,data)=>{logins.push(data);return {};}}},from:()=>({select:()=>({eq:(key,id)=>({maybeSingle:async()=>({data:id==='actor'?{role,display_name:'Administrador'}:{id:'target',role:'usuario',extra_fields:{observacao:'preservar',permissoes:{modulos:{}}}}})})}),update:data=>({eq:async()=>{profiles.push(data);return saveFails?{error:new Error('fail')}:{};}})})};
 const c={Response};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../supabase/functions/admin-create-user/handler.js'),'utf8').replace('export ',''),c);return {handler:c.adminCreateUserHandler(client),logins,profiles};
}
const req=body=>new Request('http://local',{method:'POST',headers:{Authorization:'Bearer actor'},body:JSON.stringify(body)});
test('editar nome de usuário sincroniza login e perfil preservando extras',async()=>{
 const s=setup();const result=await s.handler(req({action:'update',id:'target',username:'mariasilva',name:'Maria Silva',profile:{role:'gestor',email_contato:'MARIA@EXAMPLE.COM',permissoes:{modulos:{atendimentos:{acesso:true}}}}}));
 assert.equal(result.status,200);assert.equal((await result.json()).updated,true);assert.equal(s.logins[0].email,'mariasilva@pms.sertania.pe.gov.br');assert.equal(s.profiles[0].email,s.logins[0].email);assert.equal(s.profiles[0].extra_fields.observacao,'preservar');assert.equal(s.profiles[0].role,'gestor');assert.equal(s.profiles[0].is_admin,false);
});
test('erro ao salvar perfil restaura login anterior',async()=>{
 const s=setup(true);const result=await s.handler(req({action:'update',id:'target',username:'mariasilva',name:'Maria Silva'}));assert.equal(result.status,500);assert.equal(s.logins[1].email,'maria@pms.sertania');
});
test('alteração de senha usa sessão de administrador e exige mínimo',async()=>{
 const s=setup();assert.equal((await s.handler(req({action:'password',id:'target',password:'secret123'}))).status,200);assert.equal(s.logins[0].password,'secret123');assert.equal((await s.handler(req({action:'password',id:'target',password:'123'}))).status,400);
});
test('usuário sem administração não altera outro login',async()=>{
 const s=setup(false,'usuario');assert.equal((await s.handler(req({action:'update',id:'target',username:'mariasilva',name:'Maria'}))).status,403);assert.equal(s.logins.length,0);
});
