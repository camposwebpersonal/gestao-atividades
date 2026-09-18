const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const helper=fs.readFileSync(path.join(__dirname,'../js/usuario-login.js'),'utf8').replace(/export /g,'');
function context(extra={}){const ctx={...extra};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(helper,ctx);return ctx;}
test('identificador válido e nomes de contas novas e antigas',()=>{
 const c=context();assert.equal(c.userEmail(' José '),'jose@pms.sertania.pe.gov.br');
 assert.equal(c.usernameFromEmail('jose@pms.sertania'),'jose');
 assert.equal(c.usernameFromEmail(c.userEmail('José')),'jose');
});
test('login aceita contas antigas e preserva acesso do administrador',async()=>{
 const c=context();const calls=[];
 const result=await c.signInUsername({signInWithPassword:async args=>{calls.push(args);return calls.length===1?{error:{code:'invalid_credentials'}}:{data:{session:{}}};}},'Maria','secret');
 assert.equal(result.error,undefined);assert.equal(calls[1].email,'maria@pms.sertania');
 assert.equal(c.loginEmails('RCAMPOS')[0],'camposweb.personal@gmail.com');
});
test('login não repete chamadas em caso de limite de tentativas',async()=>{
 const c=context();let count=0;await c.signInUsername({signInWithPassword:async()=>{count++;return {error:{code:'over_request_rate_limit'}};}},'Maria','secret');assert.equal(count,1);
});
function admin(users=[]){
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const values={'usr-name':'Maria','usr-user':'MARIA','usr-password':'secret','usr-email-contato':''};const saved=[];const notices=[];const created=[];
 const c=context({document:{getElementById:id=>({value:values[id]||''})},S:{users},_usernameFromEmail:email=>email.replace(/@pms\.sertania(?:\.pe\.gov\.br)?$/i,''),_toEmail:user=>user+'@pms.sertania.pe.gov.br',_readPermMatrix:()=>({modulos:{}}),toast:msg=>notices.push(msg),localStorage:{getItem:()=> 'test-key'},createUserAdmin:async(...args)=>{created.push(args);return 'new-id';},setDoc:async(ref,data)=>saved.push(data),doc:()=>({}),db:{},serverTimestamp:()=>0,loadData:async()=>{},closeModal(){},renderAdmin(){},console});
 vm.runInContext(source.slice(source.indexOf('window.saveUser=async function(id){'),source.indexOf('window.changeUserPassword=async function(id){')),c);return {c,saved,notices,created};
}
test('cadastro sem e-mail de contato salva e permite tentativas imediatas',async()=>{
 const {c,saved,created}=admin();await c.saveUser('');await c.saveUser('');assert.equal(saved.length,2);assert.equal(saved[0].email_contato,'');assert.equal(created[0][0],'maria@pms.sertania.pe.gov.br');assert.equal(c._savingUser,false);
});
test('cadastro impede duplicar nome de usuário legado',async()=>{
 const {c,created,notices}=admin([{email:'maria@pms.sertania'}]);await c.saveUser('');assert.equal(created.length,0);assert.match(notices[0],/já existe/);
});
test('cadastro sem chave usa serviço administrativo sem signup nem troca de sessão',async()=>{
 const {c,saved}=admin();let calls=0;
 c.localStorage.getItem=()=>null;
 c.createUserAdminSession=async(username,password,name)=>{calls++;assert.equal(username,'maria');assert.equal(name,'Maria');return 'new-id';};
 await c.saveUser('');assert.equal(calls,1);assert.equal(saved.length,1);
});
function server(profile){
 let creations=0;const client={auth:{getUser:async()=>({data:{user:{id:'admin-id'}}}),admin:{createUser:async body=>{creations++;assert.equal(body.email_confirm,true);return {data:{user:{id:'new-id'}}};}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile})})})})};
 const ctx={Response};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../supabase/functions/admin-create-user/handler.js'),'utf8').replace('export ',''),ctx);
 return {handle:ctx.adminCreateUserHandler(client),creations:()=>creations};
}
function request(token='session'){return new Request('http://localhost',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({username:'maria',password:'secret',name:'Maria'})});}
test('servidor cria conta confirmada para administrador',async()=>{
 const s=server({role:'admin'});const r=await s.handle(request());assert.equal(r.status,201);assert.equal((await r.json()).id,'new-id');assert.equal(s.creations(),1);
});
test('servidor rejeita usuários sem sessão, sem perfil ou sem administração',async()=>{
 for(const profile of [null,{role:'usuario'}]){const s=server(profile);assert.equal((await s.handle(request())).status,403);assert.equal(s.creations(),0);}
 const s=server({role:'admin'});assert.equal((await s.handle(request(''))).status,401);assert.equal(s.creations(),0);
});
test('servidor reconhece permissão administrativa migrada em extra_fields',async()=>{
 for(const extra of [{isAdmin:true},JSON.stringify({is_admin:true})]){
  const s=server({role:'usuario',extra_fields:extra});assert.equal((await s.handle(request())).status,201);
 }
});
