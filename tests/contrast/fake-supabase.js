// Cliente Supabase simulado (permissivo) para rodar o app real no navegador sem tocar no banco.
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const geo = (lat, lng) => ({latitude: lat, longitude: lng, accuracy: 8, maps_url: `https://www.google.com/maps?q=${lat},${lng}`, captured_at: iso(now)});
const T = globalThis.__fakeDb = {
  users: [{id: 'u1', uid: 'u1', email: 'ricardo@pms.gov.br', displayName: 'Ricardo Campos', role: 'admin', isAdmin: true, permissoes: {pode_ver_lixeira: true}, updated_at: iso(now)},
    {id: 'u2', uid: 'u2', email: 'ana@pms.gov.br', displayName: 'Ana Souza', role: 'usuario', permissoes: {}, updated_at: iso(now)}],
  secretarias: [{id: 'sec1', name: 'SECRETARIA DE SAÚDE', updated_at: iso(now)}, {id: 'sec2', name: 'SECRETARIA DE AGRICULTURA', updated_at: iso(now)}, {id: 'gab', name: 'GABINETE', updated_at: iso(now)}, ...['AÇÃO SOCIAL','ADMINISTRAÇÃO','CEDOCA','COMUNICAÇÃO','CULTURA','DEFESA CIVIL','EDUCAÇÃO','FINANÇAS','INFRAESTRUTURA','MEIO AMBIENTE','NEMIP'].map((name, i) => ({id: 'sx' + i, name, updated_at: iso(now)}))],
  atividades: [
    {id: 'a1', name: 'MANUTENÇÃO DE UBS', description: 'Reformas e reparos', demanda_secretaria_id: 'sec1', order_num: 0, icon: '🏥', color: '#16803d', show_stats: 1, show_verba: 1, show_documentacao: 1, show_licitacao: 1, controle_pendencias: 1, extra_fields: {}, created_at: iso(now - 9e8), updated_at: iso(now)},
    {id: 'a2', name: 'SOLICITAÇÃO DE ÁGUA DE PIPA', description: 'Abastecimento', demanda_secretaria_id: 'gab', order_num: 1, icon: '💧', color: '#0ea5e9', extra_fields: {}, created_at: iso(now - 9e8), updated_at: iso(now)},
    {id: 'a3', name: 'CONTROLE DE CONTAS', description: 'Contas de energia', demanda_secretaria_id: 'sec2', order_num: 2, icon: '💡', color: '#f59e0b', controle_contas: 1, extra_fields: {}, created_at: iso(now - 9e8), updated_at: iso(now)},
    {id: 'a5', name: 'DISTRIBUIÇÃO DE LEITE', demanda_secretaria_id: 'sec2', order_num: 4, icon: '🥛', controle_distribuicao: 1, extra_fields: {}, created_at: iso(now - 9e8), updated_at: iso(now)},
    {id: 'a4', name: 'ESTOQUE DE MEDICAMENTOS', demanda_secretaria_id: 'sec1', order_num: 3, icon: '📦', controle_estoque: 1, extra_fields: {}, created_at: iso(now - 9e8), updated_at: iso(now)}
  ],
  items: [
    {id: 'i1', atividade_id: 'a1', description: 'UBS NOVA SERTÂNIA — TROCA DO TELHADO', observacao: 'Infiltração na sala de vacina', status: 'pendente', concluded: 0, order_num: 0, item_icon: '🔧', extra_fields: {geo_location: geo(-8.07, -37.26), Telefone: '(87) 99999-0000'}, created_at: iso(now - 5e8), updated_at: iso(now)},
    {id: 'i2', atividade_id: 'a1', description: 'UBS CENTRO — PINTURA', status: 'concluido', concluded: 1, conclusion_date: iso(now - 1e8), order_num: 1, extra_fields: {}, created_at: iso(now - 5e8), updated_at: iso(now)},
    {id: 'i3', atividade_id: 'a2', description: 'SÍTIO CAITITU — FAMÍLIA SILVA', status: 'pendente', concluded: 0, order_num: 0, extra_fields: {geo_location: geo(-8.06, -37.25), pipa_last_refill: iso(now - 40 * 864e5).slice(0, 10), pipa_refill_days: 30}, created_at: iso(now - 5e8), updated_at: iso(now)},
    {id: 'i4', atividade_id: 'a2', description: 'POVOADO RIACHO DO MEL', status: 'andamento', concluded: 0, order_num: 1, extra_fields: {geo_location: geo(-8.04, -37.22), pipa_last_refill: iso(now - 2 * 864e5).slice(0, 10), pipa_refill_days: 30}, created_at: iso(now - 5e8), updated_at: iso(now)},
    {id: 'i5', atividade_id: 'a3', description: 'ESCOLA MUNICIPAL JOSÉ — CONTA 123', status: 'pendente', concluded: 0, order_num: 0, extra_fields: {}, created_at: iso(now - 5e8), updated_at: iso(now)}
  ],
  subitems: [
    {id: 's1', item_id: 'i1', description: 'Comprar telhas', status: 'pendente', concluded: 0, order_num: 0, extra_fields: {}, created_at: iso(now - 4e8), updated_at: iso(now)},
    {id: 's2', item_id: 'i1', description: 'Contratar mão de obra', status: 'concluido', concluded: 1, order_num: 1, extra_fields: {}, created_at: iso(now - 4e8), updated_at: iso(now)}
  ],
  field_templates: [], responsaveis: [{id: 'r1', name: 'JOÃO PEREIRA', cargo: 'Engenheiro', updated_at: iso(now)}],
  contatos: [{id: 'c1', nome: 'MARIA DAS DORES', telefone: '(87) 98888-1111', updated_at: iso(now)}],
  contas: [], estoque: [], requisicoes: [], app_settings: [], supabase_status_access: [],
  water_collection_points: [{id: 'w1', name: 'POÇO DO CENTRO', latitude: -8.07, longitude: -37.27, updated_at: iso(now)}],
  trash_items: [{id: 't1', source_table: 'items', source_label: 'ITEM REMOVIDO', source_secretaria_name: 'SAÚDE', source_activity_name: 'MANUTENÇÃO', deleted_at: iso(now - 1e7), deleted_by_name: 'Ricardo', payload: {}}],
  entity_images: [], galeria: [], chamados: [], extintores: [], extintor_abas: [], bulk_entry_drafts: [], distribuicao: []
};
const val = (r, c) => r?.[c];
function builder(table) {
  const st = {filters: [], order: [], range: null, head: false, cols: '*', single: false, write: null};
  const run = () => {
    if (!T[table]) T[table] = [];
    let rows = T[table];
    if (st.write) {
      const {kind, payload} = st.write;
      if (kind === 'insert' || kind === 'upsert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map(r => ({id: r.id || 'n' + Math.random().toString(36).slice(2, 8), ...r}));
        list.forEach(r => { const i = T[table].findIndex(x => x.id === r.id); if (i >= 0) T[table][i] = {...T[table][i], ...r}; else T[table].push(r); });
        rows = list;
      } else if (kind === 'update') { rows = rows.filter(r => st.filters.every(f => f(r))); rows.forEach(r => Object.assign(r, payload)); }
      else if (kind === 'delete') { const del = rows.filter(r => st.filters.every(f => f(r))); T[table] = rows.filter(r => !del.includes(r)); rows = del; }
    } else rows = rows.filter(r => st.filters.every(f => f(r)));
    rows = rows.map(r => ({...r}));
    for (const o of st.order.slice().reverse()) rows.sort((a, b) => (val(a, o.c) > val(b, o.c) ? 1 : val(a, o.c) < val(b, o.c) ? -1 : 0) * (o.asc ? 1 : -1));
    const count = rows.length;
    if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
    if (st.head) return {data: null, count, error: null};
    if (st.single) return {data: rows[0] || null, error: null};
    return {data: rows, count, error: null};
  };
  const add = f => (st.filters.push(f), api);
  const api = new Proxy({}, {get(_, k) {
    switch (k) {
      case 'then': return (res, rej) => Promise.resolve().then(run).then(res, rej);
      case 'select': return (cols = '*', o = {}) => (st.cols = cols, st.head = !!o.head, api);
      case 'insert': case 'upsert': case 'update': return p => (st.write = {kind: k, payload: p}, api);
      case 'delete': return () => (st.write = {kind: 'delete'}, api);
      case 'eq': return (c, v) => add(r => String(val(r, c)) === String(v));
      case 'neq': return (c, v) => add(r => String(val(r, c)) !== String(v));
      case 'in': return (c, vs) => add(r => vs.map(String).includes(String(val(r, c))));
      case 'gt': return (c, v) => add(r => val(r, c) > v);
      case 'gte': return (c, v) => add(r => val(r, c) >= v);
      case 'lt': return (c, v) => add(r => val(r, c) < v);
      case 'lte': return (c, v) => add(r => val(r, c) <= v);
      case 'is': return (c, v) => add(r => (val(r, c) ?? null) === v);
      case 'order': return (c, o = {}) => (st.order.push({c, asc: o.ascending !== false}), api);
      case 'range': return (a, b) => (st.range = [a, b], api);
      case 'limit': return n => (st.range = [0, n - 1], api);
      case 'single': case 'maybeSingle': return () => (st.single = true, api);
      default: return () => api; // or, not, ilike, like, filter, contains, abortSignal...
    }
  }});
  return api;
}
const user = {id: 'u1', email: 'ricardo@pms.gov.br', user_metadata: {displayName: 'Ricardo Campos'}};
const session = {user, access_token: 'fake', expires_at: Math.floor(now / 1000) + 3600};
export function createClient() {
  const channel = () => { const c = {on: () => c, subscribe: (cb) => (cb?.('SUBSCRIBED'), c), unsubscribe: () => {}}; return c; };
  return {
    from: builder,
    rpc: async () => ({data: {}, error: null}),
    channel, removeChannel: () => {}, removeAllChannels: () => {},
    functions: {invoke: async () => ({data: {}, error: null})},
    storage: {from: () => ({upload: async () => ({data: {path: 'x'}, error: null}), getPublicUrl: () => ({data: {publicUrl: 'data:,'}}), remove: async () => ({error: null})})},
    auth: {
      getSession: async () => ({data: {session}, error: null}), getUser: async () => ({data: {user}, error: null}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}), signOut: async () => ({error: null}),
      refreshSession: async () => ({data: {session}, error: null})
    }
  };
}
export default {createClient};
