// Exclusão por usuário SEM permissão de ver a lixeira: o banco aceita gravar na lixeira,
// mas recusa devolver a linha (RLS de leitura). A exclusão precisa funcionar mesmo assim.
// Requer: python3 -m http.server 8090 na raiz e Playwright no NODE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8090';
const fake = `
const T = globalThis.__db = {items:[{id:'i1',description:'LANÇAMENTO',atividade_id:'a1'}], trash_items:[]};
const RLS = {code:'42501', message:'new row violates row-level security policy for table "trash_items"'};
function from(table){
  const st={filters:[],write:null,select:false};
  const run=()=>{
    T[table]=T[table]||[];
    if(st.write?.kind==='insert'||st.write?.kind==='upsert'){
      if(table==='trash_items'&&st.select)return {data:null,error:RLS}; // pode gravar, não pode reler
      if(table==='trash_items'&&st.write.kind==='upsert')return {data:null,error:RLS};
      const rows=[].concat(st.write.payload);rows.forEach(r=>{const i=T[table].findIndex(x=>x.id===r.id);if(i>=0)T[table][i]={...T[table][i],...r};else T[table].push({...r});});
      return {data:st.select?rows[0]:null,error:null};
    }
    if(st.write?.kind==='delete'){T[table]=T[table].filter(r=>!st.filters.every(f=>f(r)));return {data:null,error:null};}
    if(table==='trash_items')return {data:[],error:null};
    const rows=T[table].filter(r=>st.filters.every(f=>f(r)));return {data:rows[0]||null,error:null};
  };
  const api=new Proxy({}, {get(_,k){
    if(k==='then')return (a,b)=>Promise.resolve().then(run).then(a,b);
    if(k==='insert'||k==='upsert')return p=>(st.write={kind:k,payload:p},api);
    if(k==='delete')return ()=>(st.write={kind:'delete'},api);
    if(k==='select')return ()=>(st.select=true,api);
    if(k==='eq')return (c,v)=>(st.filters.push(r=>String(r[c])===String(v)),api);
    return ()=>api;
  }});
  return api;
}
const session={user:{id:'u2',email:'ana@pms.gov.br'}};
export function createClient(){return {from,rpc:async()=>({data:null,error:null}),channel(){const c={on:()=>c,subscribe:()=>c};return c;},removeChannel(){},
  auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};}`;
const page = `<!doctype html><body><script type="module">
const off=await import('/js/offline-store.js?v=4');off.setOfflineUser('u2');
const C=await import('/supabase_compat.js?v=11');
const out={};
try{const r=await C.deleteDoc(C.doc({}, 'items','i1'));out.ok=true;out.pending=r.pending;}catch(e){out.ok=false;out.error=e.message;}
out.itemRemovido=!globalThis.__db.items.some(r=>r.id==='i1');
out.naLixeira=globalThis.__db.trash_items.length===1&&globalThis.__db.trash_items[0].deleted_by==='u2';
const e=C.friendlyDbError({code:'42501',message:'new row violates row-level security policy for table "items"'},'excluir este registro');
out.msg=e.message;out.friendly=e.friendly;
window.out=out;</script></body>`;
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('esm.sh/@supabase')) return r.fulfill({contentType: 'application/javascript', body: fake});
    if (u === BASE + '/trash-test') return r.fulfill({contentType: 'text/html', body: page});
    if (u.startsWith(BASE)) return r.continue();
    return r.fulfill({status: 204, body: ''});
  });
  await p.goto(BASE + '/trash-test');
  await p.waitForFunction(() => window.out, null, {timeout: 15000});
  const out = await p.evaluate(() => window.out);
  await browser.close();
  console.log(out);
  assert.equal(out.ok, true, 'exclusão não pode falhar: ' + out.error);
  assert.equal(out.pending, false);
  assert.equal(out.itemRemovido, true);
  assert.equal(out.naLixeira, true, 'cópia preservada na lixeira');
  assert.equal(out.friendly, true);
  assert.match(out.msg, /não tem permissão para excluir este registro/);
  console.log('trash-rls: ok');
})();
