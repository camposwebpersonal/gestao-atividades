const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../supabase_compat.js'),'utf8');
const code=source.slice(source.indexOf('export async function createUserAdminSession('),source.indexOf('export async function createUserAdmin(')).replace('export ','');
async function invoke(status,body,{token='admin-session',networkError=false}={}){
 const ctx={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-key',supabase:{auth:{getSession:async()=>({data:{session:token?{access_token:token}:null}})}},fetch:async(url,options)=>{
  assert.equal(url,'https://example.supabase.co/functions/v1/super-worker');
  assert.equal(options.headers.Authorization,'Bearer admin-session');
  assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).username,'maria');
  assert.deepEqual(Object.keys(options.headers).sort(),['Authorization','Content-Type','apikey']);
  if(networkError)throw new TypeError('Failed to fetch');
  return {status,ok:status>=200&&status<300,json:async()=>body};
 }};vm.createContext(ctx);vm.runInContext(code,ctx);return ctx.createUserAdminSession('maria','secret','Maria');
}
test('função não encontrada mostra nome e projeto corretos',async()=>{await assert.rejects(invoke(404,{code:'NOT_FOUND'}),/super-worker.*xwlmpxypjheuhbxyfplo/);});
test('distingue rejeição JWT de ausência de função',async()=>{await assert.rejects(invoke(401,{message:'Invalid JWT'}),/Invalid JWT/);});
test('preserva erro de permissão retornado pelo servidor',async()=>{await assert.rejects(invoke(403,{message:'Apenas administradores podem cadastrar usuários.'}),/Apenas administradores/);});
test('envia sessão administrativa e dados, retorna cadastro bem sucedido',async()=>{assert.equal(await invoke(201,{id:'new-id'}),'new-id');});
test('sessão ausente é detectada antes de enviar cadastro',async()=>{await assert.rejects(invoke(201,{}, {token:null}),/sessão expirou/);});
test('falha de rede orienta diagnóstico no console',async()=>{await assert.rejects(invoke(0,{}, {networkError:true}),/Console.*CORS/);});
test('erro sem JSON informativo mantém status HTTP',async()=>{await assert.rejects(invoke(503,{}),/HTTP 503/);});
