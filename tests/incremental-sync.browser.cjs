// Testa a sincronização incremental do supabase_compat.js com um Supabase simulado no navegador.
const {chromium} = require('playwright');
const fs = require('fs');
// Requer servidor local na porta 8080 (python3 -m http.server 8080) e Playwright no NODE_PATH.
const BASE = 'http://127.0.0.1:8080';

// Simulação mínima do cliente PostgREST usado pelo compat (from/select/gt/order/range/in/head count).
const fakeSupabase = `
const tables = globalThis.__fakeDb = globalThis.__fakeDb || {};
globalThis.__fakeLog = globalThis.__fakeLog || [];
function builder(table){
  const st={table,cols:'*',filters:[],order:null,range:null,head:false,count:null};
  const exec=()=>{
    let rows=(tables[table]||[]).map(r=>({...r}));
    for(const f of st.filters)rows=rows.filter(f);
    if(st.order){const {col,asc}=st.order;rows.sort((a,b)=>(a[col]>b[col]?1:a[col]<b[col]?-1:0)*(asc?1:-1));}
    const total=rows.length;
    if(st.range)rows=rows.slice(st.range[0],st.range[1]+1);
    if(st.cols==='id')rows=rows.map(r=>({id:r.id}));
    if(st.head){globalThis.__fakeLog.push({table,kind:'count',rows:0});return {data:null,count:total,error:null};}
    globalThis.__fakeLog.push({table,kind:st.cols==='id'?'ids':'rows',rows:rows.length,bytes:JSON.stringify(rows).length});
    return {data:rows,error:null,count:st.count?total:null};
  };
  const api={
    select(cols='*',opts={}){st.cols=cols;st.head=!!opts.head;st.count=opts.count||null;return api;},
    gt(col,v){st.filters.push(r=>r[col]!=null&&Date.parse(r[col])>Date.parse(v));return api;},
    eq(col,v){st.filters.push(r=>r[col]===v);return api;},
    in(col,vals){const set=new Set(vals.map(String));st.filters.push(r=>set.has(String(r[col])));return api;},
    filter(col,op,v){if(op==='eq')st.filters.push(r=>r[col]===v);return api;},
    order(col,o={}){st.order={col,asc:o.ascending!==false};return api;},
    range(a,b){st.range=[a,b];return api;},
    limit(n){st.range=[0,n-1];return api;},
    maybeSingle(){return Promise.resolve(exec()).then(r=>({data:(r.data||[])[0]||null,error:null}));},
    then(res,rej){return Promise.resolve(exec()).then(res,rej);}
  };
  return api;
}
export function createClient(){return {from:builder,rpc:async()=>({data:null,error:null}),channel(){return {on(){return this;},subscribe(){return this;}};},removeChannel(){},
  auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}}};}
`;

const page = `<!doctype html><html><body><script type="module">
const off = await import('/js/offline-store.js?v=4');
off.setOfflineUser('u1');
const C = await import('/supabase_compat.js');
const now = Date.now(), iso = ms => new Date(ms).toISOString();
// Banco simulado: 3000 subitens (com updated_at do servidor) e 5 secretarias (sem gatilho)
const db = globalThis.__fakeDb;
db.subitems = Array.from({length: 3000}, (_, i) => ({id: 's' + i, description: 'Subitem ' + i + ' ' + 'x'.repeat(300), order_num: i, updated_at: iso(now - 30 * 86400000 + i * 600000)}));
db.secretarias = Array.from({length: 5}, (_, i) => ({id: 'sec' + i, name: 'Secretaria ' + i, updated_at: iso(now - 86400000)}));
const log = globalThis.__fakeLog;
const read = async (path, order) => (await C.getDocs(C.query(C.collection({}, path), C.orderBy(order, 'asc')))).docs.map(d => ({id: d.id, ...d.data()}));
const take = () => { const copy = log.splice(0); return {req: copy.length, rows: copy.reduce((s, e) => s + e.rows, 0), bytes: copy.reduce((s, e) => s + (e.bytes || 0), 0)}; };
const out = {};
let rows = await read('subitems', 'order_num'); out.primeira = {...take(), total: rows.length};
rows = await read('subitems', 'order_num'); out.segundaSemMudanca = {...take(), total: rows.length};
// servidor: altera 1, cria 1
db.subitems[10] = {...db.subitems[10], description: 'ALTERADO', updated_at: iso(Date.now())};
db.subitems.push({id: 'novo', description: 'NOVO', order_num: 5000, updated_at: iso(Date.now())});
rows = await read('subitems', 'order_num');
out.alteraECria = {...take(), total: rows.length, alterado: rows.find(r => r.id === 's10')?.description, novo: !!rows.find(r => r.id === 'novo')};
// servidor: apaga 2
db.subitems = db.subitems.filter(r => r.id !== 's1' && r.id !== 's2');
rows = await read('subitems', 'order_num');
out.apaga = {...take(), total: rows.length, apagadosSumiram: !rows.some(r => r.id === 's1' || r.id === 's2')};
// ordenação preservada e sem coluna interna
out.ordemOk = rows.every((r, i) => i === 0 || rows[i - 1].order_num <= r.order_num);
// tabela sem gatilho de servidor: sempre completa (é pequena)
await read('secretarias', 'name'); take(); await read('secretarias', 'name'); out.secretariasSegunda = take();
// quando a coluna sync_at existir: migra sozinho
db.subitems = db.subitems.map((r, i) => ({...r, sync_at: iso(now - 30 * 86400000 + i * 600000)}));
const C2 = C; await read('subitems', 'order_num'); out.descobreSyncAt = take();
await off.putCachedRow('subitems', {...db.subitems[0]});
rows = await read('subitems', 'order_num'); out.migraParaSyncAt = {...take(), meta: JSON.parse(localStorage.getItem('gestao-sync:v1:u1:subitems')).column, semSyncAtNoApp: !('sync_at' in rows[0])};
rows = await read('subitems', 'order_num'); out.incrementalComSyncAt = take();
window.out = out;
</script></body></html>`;

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.route('**/*', route => {
        const url = route.request().url();
        if (url === BASE + '/qa-sync') return route.fulfill({contentType: 'text/html', body: page});
        if (url.includes('esm.sh/@supabase')) return route.fulfill({contentType: 'application/javascript', body: fakeSupabase});
        if (url.startsWith(BASE)) return route.continue();
        return route.abort();
    });
    await p.goto(BASE + '/qa-sync');
    await p.waitForFunction(() => window.out, null, {timeout: 60000}).catch(() => {});
    console.log(JSON.stringify({out: await p.evaluate(() => window.out), errors}, null, 1));
    await browser.close();
})();
