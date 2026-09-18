const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../supabase_compat.js'),'utf8');
const code=source.slice(source.indexOf('export async function createUserAdminSession('),source.indexOf('export async function createUserAdmin(')).replace('export ','');
async function invoke(result){const ctx={supabase:{functions:{invoke:async()=>result}}};vm.createContext(ctx);vm.runInContext(code,ctx);return ctx.createUserAdminSession('maria','secret','Maria');}
test('função não encontrada mostra nome e projeto corretos',async()=>{
 await assert.rejects(invoke({error:{context:{status:404,json:async()=>({code:'NOT_FOUND',message:'Requested function was not found'})}}}),/admin-create-user.*xwlmpxypjheuhbxyfplo/);
});
test('distingue rejeição JWT de ausência de função',async()=>{
 await assert.rejects(invoke({error:{context:{status:401,json:async()=>({message:'Invalid JWT'})}}}),/Invalid JWT/);
});
test('preserva erro de permissão retornado pelo servidor',async()=>{
 await assert.rejects(invoke({error:{context:{status:403,json:async()=>({message:'Apenas administradores podem cadastrar usuários.'})}}}),/Apenas administradores/);
});
test('retorna cadastro bem sucedido',async()=>{assert.equal(await invoke({data:{id:'new-id'}}),'new-id');});
