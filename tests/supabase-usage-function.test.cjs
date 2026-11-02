const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadHandler(){
  const context={Response,URLSearchParams,Date,fetch:()=>{},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../supabase/functions/supabase-usage/handler.js'),'utf8').replace('export function','function'),context);
  return context.supabaseUsageHandler;
}

function queryResult(rows){
  const query={select(){return query},eq(){return query},limit(){return Promise.resolve({data:rows,error:null})},maybeSingle(){return Promise.resolve({data:rows?.[0]||null,error:null})}};
  return query;
}

function clientFor({email='camposweb.personal@gmail.com',allowed=true,token='sbp_abcdefghijklmnopqrstuvwxyz123456',cache=[]}={}){
  const calls=[];
  return {
    calls,
    auth:{getUser:async()=>({data:{user:{id:'user-1',email}},error:null})},
    from(name){return queryResult(name==='supabase_status_access'?[{allowed}]:cache)},
    async rpc(name,args){calls.push([name,args]);if(name==='get_supabase_management_token_for_runtime')return {data:token,error:null};return {data:null,error:null};}
  };
}

function officialFetch(url){
  if(/\/v1\/projects\/[a-z]+$/.test(url))return Promise.resolve(new Response(JSON.stringify({id:'xwlmpxypjheuhbxyfplo',status:'ACTIVE_HEALTHY'}),{status:200}));
  if(url.includes('/billing/subscription'))return Promise.resolve(new Response(JSON.stringify({current_period_start:1790812800,current_period_end:1793491200}),{status:200}));
  if(url.includes('/usage/daily'))return Promise.resolve(new Response(JSON.stringify({usages:[{date:'2026-10-28',metric:'EGRESS',usage:1200}]}),{status:200}));
  if(url.includes('/usage?'))return Promise.resolve(new Response(JSON.stringify({usages:[{metric:'EGRESS',usage:1200,pricing_free_units:5000000000}]}),{status:200}));
  return Promise.resolve(new Response('{}',{status:404}));
}

function request(body){return new Request('https://example.test/functions/v1/supabase-usage',{method:'POST',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},body:JSON.stringify(body)});}

test('função entrega o consumo oficial e salva somente o cache sem devolver a credencial',async()=>{
  const client=clientFor();
  const response=await loadHandler()(client,{fetchImpl:officialFetch})(request({action:'usage',force:true}));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.configured,true);
  assert.equal(body.summary.usages[0].metric,'EGRESS');
  assert.equal('management_token' in body,false);
  assert.ok(client.calls.some(([name])=>name==='save_supabase_egress_cache_for_runtime'));
});

test('somente RCAMPOS consegue configurar a credencial administrativa',async()=>{
  const client=clientFor({email:'outro@pms.sertania.pe.gov.br',allowed:true});
  const response=await loadHandler()(client,{fetchImpl:officialFetch})(request({action:'configure',management_token:'sbp_abcdefghijklmnopqrstuvwxyz123456'}));
  assert.equal(response.status,403);
  assert.match((await response.json()).message,/Somente RCAMPOS/);
  assert.equal(client.calls.some(([name])=>name==='set_supabase_management_token_for_runtime'),false);
});

test('usuário sem a permissão do painel também não consulta tráfego',async()=>{
  const client=clientFor({email:'outro@pms.sertania.pe.gov.br',allowed:false});
  const response=await loadHandler()(client,{fetchImpl:officialFetch})(request({action:'usage'}));
  assert.equal(response.status,403);
});

// Situação real: o token pessoal (sbp_) funciona na API /v1, mas o endpoint interno
// /platform recusa. O painel deve aceitar a credencial e mostrar as requisições.
function personalTokenFetch(url){
  if(url.includes('/platform/'))return Promise.resolve(new Response(JSON.stringify({message:'Unauthorized'}),{status:401}));
  if(/\/v1\/projects\/[a-z]+$/.test(url))return Promise.resolve(new Response(JSON.stringify({id:'xwlmpxypjheuhbxyfplo'}),{status:200}));
  if(url.includes('usage.api-counts'))return Promise.resolve(new Response(JSON.stringify({result:[
    {timestamp:'2026-10-31T00:00:00.000Z',total_rest_requests:100,total_auth_requests:10,total_storage_requests:5,total_realtime_requests:1},
    {timestamp:'2026-10-31T12:00:00.000Z',total_rest_requests:50,total_auth_requests:0,total_storage_requests:0,total_realtime_requests:0},
    {timestamp:'2026-11-01T00:00:00.000Z',total_rest_requests:20,total_auth_requests:2,total_storage_requests:0,total_realtime_requests:0}
  ]}),{status:200}));
  return Promise.resolve(new Response('{}',{status:404}));
}

test('token pessoal recusado no /platform é aceito e mostra requisições oficiais',async()=>{
  const client=clientFor();
  const response=await loadHandler()(client,{fetchImpl:personalTokenFetch})(request({action:'configure',management_token:'sbp_abcdefghijklmnopqrstuvwxyz123456'}));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.mode,'requests');
  assert.equal(body.daily.days.length,2);
  assert.equal(body.summary.totals.rest,170);
  assert.equal(body.summary.totals.auth,12);
  assert.match(body.summary.note,/requisições oficiais/);
  assert.ok(client.calls.some(([name])=>name==='set_supabase_management_token_for_runtime'));
});

test('token realmente inválido continua sendo recusado e não é guardado',async()=>{
  const client=clientFor();
  const rejectAll=()=>Promise.resolve(new Response(JSON.stringify({message:'Unauthorized'}),{status:401}));
  const response=await loadHandler()(client,{fetchImpl:rejectAll})(request({action:'configure',management_token:'sbp_abcdefghijklmnopqrstuvwxyz123456'}));
  assert.equal(response.status,401);
  assert.match((await response.json()).message,/recusada/);
  assert.equal(client.calls.some(([name])=>name==='set_supabase_management_token_for_runtime'),false);
});
