// Supabase compatibility layer that mimics Firebase API used by the app.
// This is a pragmatic first pass; not all Firebase features are covered.

import {rememberRecords} from './js/autoria.js';
import {hasLocalImage} from './js/image-storage.js?v=1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0?bundle';
import {
  setOfflineUser, cacheRows, getCachedRows, getCachedRow, putCachedRow,
  deleteCachedRow, enqueueMutation, listMutations, removeMutation, pendingCount,
  applyLocalConstraints, isOfflineFailure, currentOfflineUser
} from './js/offline-store.js?v=4';

export const SUPABASE_URL = 'https://xwlmpxypjheuhbxyfplo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const OFFLINE_AUTH_KEY = 'gestao-offline-auth-user';
let offlineImageUploader = null;
let syncPromise = null;
let syncRetryTimer = 0;
let syncRetryDelay = 15000;

function scheduleSyncRetry({reset=false}={}) {
  if (reset) syncRetryDelay = 15000;
  if (syncRetryTimer || globalThis.navigator?.onLine === false) return;
  syncRetryTimer = globalThis.setTimeout?.(async () => {
    syncRetryTimer = 0;
    try {
      const result = await syncOfflineNow();
      if (result?.pending) {
        syncRetryDelay = Math.min(syncRetryDelay * 2, 300000);
        scheduleSyncRetry();
      } else syncRetryDelay = 15000;
    } catch (error) {
      syncRetryDelay = Math.min(syncRetryDelay * 2, 300000);
      console.warn('Nova tentativa de sincronização agendada:', error?.message || error);
      scheduleSyncRetry();
    }
  }, syncRetryDelay) || 0;
}

function isOfflineError(error) {
  return isOfflineFailure(error);
}

async function notifyOfflineState(extra = {}) {
  const detail = {
    online: globalThis.navigator?.onLine !== false,
    pending: await pendingCount().catch(() => 0),
    syncing: Boolean(syncPromise),
    ...extra
  };
  globalThis.dispatchEvent?.(new CustomEvent('gestao-offline-state', { detail }));
  return detail;
}

async function queueMutation(mutation) {
  await enqueueMutation(mutation);
  await notifyOfflineState();
  scheduleSyncRetry();
}

async function hasPendingMutations() {
  return (await pendingCount().catch(() => 0)) > 0;
}

async function replaceOfflineImages(value) {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    if (!offlineImageUploader) throw new Error('Upload de imagem offline ainda não inicializado.');
    return offlineImageUploader(value, { forceOnline: true });
  }
  if (typeof value === 'string' && value.includes('data:image/') && /^[\[{]/.test(value.trim())) {
    let parsed;
    try { parsed = JSON.parse(value); } catch (_) { return value; }
    return JSON.stringify(await replaceOfflineImages(parsed));
  }
  if (Array.isArray(value)) return Promise.all(value.map(replaceOfflineImages));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await replaceOfflineImages(item)]));
    return Object.fromEntries(entries);
  }
  return value;
}

// Tabelas em que o usuário pode GRAVAR mas nem sempre pode LER de volta (ex.: lixeira,
// visível só para quem tem permissão). Nelas a gravação não pede a linha de volta.
const WRITE_ONLY_TABLES = new Set(['trash_items']);
const isRlsError = error => error?.code === '42501' || /row-level security|permission denied/i.test(error?.message || '');
const isDuplicate = error => error?.code === '23505' || /duplicate key/i.test(error?.message || '');

// Grava uma linha com segurança: se a política do banco permitir gravar mas não reler,
// repete a gravação sem pedir retorno em vez de falhar.
async function writeRow(table, payload) {
  if (WRITE_ONLY_TABLES.has(table)) {
    const {error} = await supabase.from(table).insert(payload);
    if (error && !isDuplicate(error)) throw error; // duplicada = já gravada antes (reenvio offline)
    return null;
  }
  const {data, error} = await supabase.from(table).upsert(payload).select().maybeSingle();
  if (!error) return data;
  if (!isRlsError(error)) throw error;
  const retry = await supabase.from(table).upsert(payload);
  if (retry.error) throw retry.error;
  return null;
}

// Mensagens do banco em português claro para o usuário (o técnico continua no console).
export function friendlyDbError(error, action = 'concluir esta ação') {
  if (!error || error.friendly) return error;
  const raw = error.message || String(error);
  let message = null;
  if (isRlsError(error)) message = `Seu usuário não tem permissão para ${action}. Nada foi alterado. Se precisar, peça ao administrador para revisar suas permissões.`;
  else if (isDuplicate(error)) message = 'Este registro já existe. Atualize a página e tente novamente.';
  else if (error.code === '23503') message = 'Este registro está ligado a outro que não existe mais. Atualize a página e tente novamente.';
  else if (error.code === '23502') message = 'Falta preencher uma informação obrigatória. Revise o formulário e tente novamente.';
  if (!message) return error;
  console.warn('Erro do banco:', raw, error);
  return Object.assign(new Error(message), {code: error.code, details: raw, friendly: true});
}

async function executeMutation(mutation) {
  const payload = mutation.payload ? await replaceOfflineImages(mutation.payload) : null;
  let data, error;
  if (mutation.type === 'upsert') {
    try { data = await writeRow(mutation.table, payload); } catch (writeError) { error = writeError; }
  } else if (mutation.type === 'update') {
    ({ data, error } = await supabase.from(mutation.table).update(payload).eq('id', mutation.id).select().maybeSingle());
  } else if (mutation.type === 'delete') {
    ({ error } = await supabase.from(mutation.table).delete().eq('id', mutation.id));
  } else throw new Error('Operação offline desconhecida.');
  if (error) throw error;
  if (data) await putCachedRow(mutation.table, data);
}

export function registerOfflineImageUploader(uploader) { offlineImageUploader = uploader; }

export async function getOfflineStatus() { const state=await notifyOfflineState();if(state.pending)scheduleSyncRetry();return state; }

export async function syncOfflineNow() {
  if (syncPromise) return syncPromise;
  if (globalThis.navigator?.onLine === false) return notifyOfflineState();
  syncPromise = (async () => {
    await notifyOfflineState({ syncing: true });
    const mutations = await listMutations();
    let applied = 0;
    for (const mutation of mutations) {
      try {
        await executeMutation(mutation);
        await removeMutation(mutation.queueId);
        applied++;
      } catch (error) {
        if (isOfflineError(error)) break;
        await notifyOfflineState({ syncing: false, error: error?.message || String(error) });
        throw error;
      }
    }
    return { applied, pending: await pendingCount() };
  })().finally(async () => {
    syncPromise = null;
    const state = await notifyOfflineState({ syncing: false });
    if (!state.pending) globalThis.dispatchEvent?.(new CustomEvent('gestao-offline-synced'));
  });
  return syncPromise;
}

globalThis.addEventListener?.('online', () => { scheduleSyncRetry({reset:true}); syncOfflineNow().catch(error => console.error('Sincronização offline:', error)); });
globalThis.addEventListener?.('offline', () => notifyOfflineState());

// Map Firebase collection names to Supabase table names
const TABLE_MAP = {
  'secretariats': 'atividades',   // legacy naming in Firebase
  'secretarias': 'secretarias',
  'items': 'items',
  'subitems': 'subitems',
  'fieldTemplates': 'field_templates',
  'responsaveis': 'responsaveis',
  'entity_images': 'entity_images',
  'users': 'users',
  'supabaseStatusAccess': 'supabase_status_access',
  'contatos': 'contatos',
  'galeria': 'galeria',
  'chamados': 'chamados',
  'contas': 'contas',
  'trashItems': 'trash_items',
  'trash_items': 'trash_items',
  'appSettings': 'app_settings',
  'waterCollectionPoints': 'water_collection_points'
};

const REALTIME_TABLES = [
  'atividades','items','subitems','field_templates','secretarias','responsaveis',
  'users','supabase_status_access','contatos','contas','estoque','requisicoes','trash_items','entity_images',
  'galeria','chamados','distribuicao','extintores','extintor_abas','bulk_entry_drafts','app_settings','water_collection_points'
];

function toSnake(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// Tabelas que possuem coluna extra_fields para flexibilidade de schema
const EXTRA_TABLES = new Set(['atividades', 'items', 'subitems', 'users', 'contas']);

// Colunas conhecidas que devem ficar no nível superior de cada tabela
const SCHEMA_FIELDS = {
  atividades: new Set(['demanda_secretaria_id','id','name','description','observacao','observacoes','show_conclusion_date','show_documentacao','show_licitacao','order_num','controle_contas','controle_pendencias','controle_distribuicao','icon','color','concluded','conclusion_date','status','cover_url','resp_url','extra_fields','created_at','updated_at','responsaveis','start_date','end_date','show_stats','show_verba','verba_on_subitems','verba_sum_subitems','verba_has_obs','show_origem_verba','origem_verba_on_subitems','origem_verba_has_obs','documentacao_on_subitems','documentacao_has_obs','licitacao_on_subitems','licitacao_has_obs','controle_estoque','ce_nome_secretaria','ce_titulo_controle']),
  items: new Set(['id','atividade_id','description','observacao','responsaveis','secretaria_id','start_date','item_icon','item_color','order_num','concluded','conclusion_date','status','auto_concluded','cover_url','resp_url','deadline_date','extra_fields','created_at','updated_at']),
  subitems: new Set(['id','atividade_id','item_id','parent_id','parent_type','description','observacao','responsaveis','secretaria_id','start_date','extra_fields','deadline_date','order_num','concluded','conclusion_date','status','auto_concluded','cover_url','resp_url','created_at','updated_at']),
  users: new Set(['id','display_name','email','email_contato','role','is_admin','setor_id','responsavel_id','created_at','updated_at']),
  contas: new Set(['id','nome','valor','atividade_id','extra_fields','created_at','updated_at'])
};

function cleanPayload(payload) {
  for (const key of ['created_by','created_by_name','updated_by','updated_by_name','audit_created_at','audit_updated_at','sync_at']) delete payload[key];
  for (const k in payload) {
    const v = payload[k];
    if (k.endsWith('_id') && (v === '' || v === undefined)) {
      payload[k] = null;
    }
    if (typeof v === 'string' && v.trim() === '') {
      // IDs de referência vazios viram null
      if (k.endsWith('_id')) payload[k] = null;
    }
  }
  return payload;
}

function mergeExtraFields(row) {
  if (row) { row = {...row, ...(row.display_name != null ? {displayName:row.display_name} : {}), ...(row.is_admin != null ? {isAdmin:row.is_admin} : {})}; delete row.sync_at; }
  if (!row || !row.extra_fields) return row;
  try {
    const extra = typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields;
    if (extra && typeof extra === 'object') {
      const merged = { ...row };
      for (const [k, v] of Object.entries(extra)) {
        if (merged[k] === null || merged[k] === undefined) merged[k] = v;
      }
      merged.extra_fields = extra;
      return merged;
    }
  } catch (e) {
    console.warn('extra_fields com JSON inválido, ignorado:', row.id, e);
  }
  return { ...row };
}

function emitRecordChange(table, eventType, row, oldRow = null, source = 'local') {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  const detail = {
    table,
    eventType,
    record: row ? mergeExtraFields({...row}) : null,
    oldRecord: oldRow ? mergeExtraFields({...oldRow}) : null,
    source
  };
  globalThis.dispatchEvent(new CustomEvent('gestao-record-change', { detail }));
}

function moveUnknownToExtra(table, payload, existingExtra) {
  if (!EXTRA_TABLES.has(table)) return payload;
  const known = SCHEMA_FIELDS[table];
  if (!known) return payload;
  const extra = {};
  if (existingExtra) {
    const parsed = typeof existingExtra === 'string' ? JSON.parse(existingExtra) : existingExtra;
    if (parsed && typeof parsed === 'object') Object.assign(extra, parsed);
  }
  if (payload.extra_fields !== undefined) {
    const parsed = typeof payload.extra_fields === 'string' ? JSON.parse(payload.extra_fields) : payload.extra_fields;
    if (parsed && typeof parsed === 'object') Object.assign(extra, parsed);
    delete payload.extra_fields;
  }
  for (const k of Object.keys(payload)) {
    if (!known.has(k)) {
      extra[k] = payload[k];
      delete payload[k];
    }
  }
  if (Object.keys(extra).length > 0) {
    payload.extra_fields = JSON.stringify(extra);
  }
  return payload;
}

function tableName(path) {
  return TABLE_MAP[path] || path.toLowerCase();
}

// ===== AUTH (Firebase-style) =====
export function initializeApp(config) { return { name: 'supabase-compat' }; }
export function getAuth(app) { return supabase.auth; }

function mapUser(su) {
  if (!su) return null;
  setOfflineUser(su.id);
  const mapped = {
    uid: su.id,
    id: su.id,
    email: su.email,
    displayName: su.user_metadata?.display_name || su.user_metadata?.name || su.email?.split('@')[0] || '',
    emailVerified: su.email_confirmed_at ? true : false,
    metadata: su.user_metadata || {}
  };
  try { localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(mapped)); } catch (_) {}
  return mapped;
}

function cachedOfflineUser() {
  try {
    const user = JSON.parse(localStorage.getItem(OFFLINE_AUTH_KEY) || 'null');
    return user?.uid ? user : null;
  } catch (_) { return null; }
}

export function onAuthStateChanged(auth, callback, errorCallback) {
  let initialDone = false;
  const onError = (err) => {
    console.error('onAuthStateChanged: falha ao recuperar sessão', err);
    if (errorCallback) errorCallback(err instanceof Error ? err : new Error(err?.message || String(err)));
  };
  // Primeiro verifica sessão existente
  auth.getSession().then(({ data, error }) => {
    if (error) {
      const cached = globalThis.navigator?.onLine === false && cachedOfflineUser();
      if (cached) { initialDone = true; callback(cached); return; }
      onError(error); return;
    }
    if (data?.session?.user) {
      initialDone = true;
      callback(mapUser(data.session.user));
    }
  }).catch(onError);
  // Também escuta mudanças, mas evita chamar null antes de verificar a sessão
  const { subscription } = auth.onAuthStateChange((event, session) => {
    const user = mapUser(session?.user || null) || (globalThis.navigator?.onLine === false ? cachedOfflineUser() : null);
    if (!initialDone && !user) {
      // Aguarda um pouco para a sessão ser recuperada do storage
      setTimeout(() => {
        auth.getSession().then(({ data, error }) => {
          if (error) { onError(error); return; }
          if (!data?.session?.user) callback(null);
        }).catch(onError);
      }, 800);
      return;
    }
    initialDone = true;
    callback(user);
  });
  return () => subscription?.unsubscribe();
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: mapUser(data.user) };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const { data, error } = await auth.signUp({ email, password });
  if (error) throw error;
  return { user: mapUser(data.user) };
}

// A sessão do administrador autoriza o cadastro; a chave fica no servidor.
export async function createUserAdminSession(username, password, name) {
  const {data: sessionData, error: sessionError} = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (sessionError || !token) throw new Error('Sua sessão expirou. Saia e entre novamente no sistema para cadastrar usuários.');
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/super-worker`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({username, password, name})
    });
  } catch {
    throw new Error('O navegador não conseguiu acessar a função super-worker. Confira o erro na aba Console (F12) para identificar bloqueio de rede ou CORS.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 || body.code === 'NOT_FOUND') {
      throw new Error('A função super-worker não foi encontrada no projeto xwlmpxypjheuhbxyfplo. Confira o nome e o projeto no Supabase.');
    }
    if (response.status === 401) {
      throw new Error(body.message === 'Invalid JWT'
        ? 'O Supabase recusou a sessão (Invalid JWT). Verifique a configuração JWT da função super-worker.'
        : 'Sua sessão não foi aceita. Saia e entre novamente no sistema.');
    }
    throw new Error(body.message || body.error || `O cadastro administrativo retornou HTTP ${response.status}. Verifique os logs da função super-worker.`);
  }
  if (!body.id) throw new Error('O serviço não retornou o cadastro do usuário.');
  return body.id;
}

export async function createUserAdmin(email, password, serviceKey, metadata={}) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.message || json.error || `HTTP ${resp.status}`);
  return json.id || json.user?.id || json.users?.[0]?.id;
}

export async function updateUserPassword(uid, password, serviceKey) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.message || json.error || `HTTP ${resp.status}`);
  return true;
}

export async function sendPasswordResetEmail(auth, email) {
  const { error } = await auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOut(auth) {
  let error;
  try { ({ error } = await auth.signOut({ scope: 'local' })); }
  finally {
    if (syncRetryTimer) globalThis.clearTimeout?.(syncRetryTimer);
    syncRetryTimer = 0;
    syncRetryDelay = 15000;
    setOfflineUser('');
    try { localStorage.removeItem(OFFLINE_AUTH_KEY); } catch (_) {}
  }
  if (error) throw error;
}

export function getFirestore(app) { return supabase; }

export function serverTimestamp() { return new Date().toISOString(); }

export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds || 0;
  }
  toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6); }
  static fromDate(date) { return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1e6); }
  static now() { return Timestamp.fromDate(new Date()); }
}

// ===== FIRESTORE-LIKE API =====

export function collection(db, path) {
  return { _type: 'collection', _path: path, _db: db };
}

export function doc(db, path, id) {
  if (arguments.length === 2) {
    const parts = path.split('/');
    return { _type: 'doc', _path: parts[0], _id: parts[1], _db: db };
  }
  return { _type: 'doc', _path: path, _id: id, _db: db };
}

export function query(collectionRef, ...constraints) {
  return { _type: 'query', _collection: collectionRef, _constraints: constraints };
}

export function where(field, op, value) {
  return { _type: 'where', field, op, value };
}

export function orderBy(field, direction) {
  return { _type: 'orderBy', field, direction: direction || 'asc' };
}

export function limit(n) {
  return { _type: 'limit', n };
}

// Build Supabase select string from constraints (only simple ones for now)
function buildQuery(collectionRef, constraints) {
  const table = tableName(collectionRef._path);
  let q = supabase.from(table).select('*');
  for (const c of constraints) {
    if (c._type === 'where') {
      const col = toSnake(c.field);
      let op = c.op;
      if (op === '==') op = 'eq';
      if (op === '!=') op = 'neq';
      if (op === '>') op = 'gt';
      if (op === '<') op = 'lt';
      if (op === '>=') op = 'gte';
      if (op === '<=') op = 'lte';
      if (op === 'in') op = 'in';
      if (op === 'array-contains') op = 'contains';
      q = q.filter(col, op, c.value);
    } else if (c._type === 'orderBy') {
      q = q.order(toSnake(c.field), { ascending: c.direction === 'asc' });
    } else if (c._type === 'limit') {
      q = q.limit(c.n);
    }
  }
  return q;
}

// ===== SINCRONIZAÇÃO INCREMENTAL =====
// Antes, cada abertura do sistema baixava todas as tabelas inteiras (~6 MB).
// Agora a cópia local (IndexedDB) é reaproveitada e só vêm do servidor:
//   1) as linhas criadas/alteradas desde a última sincronização (coluna sync_at,
//      marcada pelo próprio banco em todo INSERT/UPDATE — gatilho pms_sync_at);
//   2) uma contagem (sem dados) para detectar exclusões; só se a contagem não bater,
//      a lista de ids é conferida para remover o que foi apagado.
// Uma carga completa ainda acontece na primeira vez, ao trocar de usuário ou a cada 7 dias.
export const INCREMENTAL_TABLES = new Set([
  'atividades','items','subitems','field_templates','secretarias','responsaveis','users',
  'supabase_status_access','contatos','contas','estoque','requisicoes','trash_items',
  'app_settings','water_collection_points','entity_images','galeria','chamados',
  'distribuicao','extintores','extintor_abas','bulk_entry_drafts'
]);
// Tabelas cujo updated_at é marcado pelo próprio banco em todo UPDATE (gatilho
// update_updated_at_column / touch). Enquanto a coluna sync_at não existir, a
// sincronização incremental usa updated_at só nessas tabelas.
const SERVER_UPDATED_AT_TABLES = new Set([
  'atividades','items','subitems','users','contatos','contas','estoque','requisicoes',
  'water_collection_points','galeria','chamados','extintores','extintor_abas'
]);
const SYNC_META_PREFIX = 'gestao-sync:v1:';
const SYNC_MODES = {
  sync_at: {overlap: 2 * 60 * 1000, fullEvery: 7 * 24 * 3600 * 1000},
  updated_at: {overlap: 15 * 60 * 1000, fullEvery: 24 * 3600 * 1000}
};
function syncColumnFor(table, rows) {
  const sample = rows.find(row => row && typeof row === 'object');
  if (sample && 'sync_at' in sample) return 'sync_at';
  if (SERVER_UPDATED_AT_TABLES.has(table) && (!sample || 'updated_at' in sample)) return 'updated_at';
  return null;
}
const syncStats = {full: 0, incremental: 0, rowsFetched: 0, idChecks: 0};
globalThis.__gestaoSyncStats = syncStats;

function syncMetaKey(table) { return `${SYNC_META_PREFIX}${currentOfflineUser() || 'anon'}:${table}`; }
function readSyncMeta(table) {
  try { return JSON.parse(localStorage.getItem(syncMetaKey(table)) || 'null'); } catch (_) { return null; }
}
function writeSyncMeta(table, meta) {
  try { localStorage.setItem(syncMetaKey(table), JSON.stringify(meta)); } catch (_) {}
}
export function clearSyncMeta() {
  try { Object.keys(localStorage).filter(key => key.startsWith(SYNC_META_PREFIX)).forEach(key => localStorage.removeItem(key)); } catch (_) {}
}
function maxSyncAt(rows, current = '', column = 'sync_at') {
  // Ignora datas no futuro (registros com data histórica adiantada): usá-las como
  // referência faria as próximas alterações passarem despercebidas.
  const limit = Date.now() + 10 * 60 * 1000;
  let max = current || '', maxTime = max ? Date.parse(max) : 0;
  for (const row of rows) {
    const value = row?.[column];
    const time = value ? Date.parse(value) : NaN;
    if (Number.isFinite(time) && time <= limit && time > maxTime) { max = new Date(time).toISOString(); maxTime = time; }
  }
  return max;
}
async function fetchPaged(build, pageSize = 1000) {
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await build().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) return rows;
    offset += pageSize;
  }
}
async function fullTableLoad(table, constraints) {
  const rows = await fetchPaged(() => buildQuery({_path: table}, constraints));
  await cacheRows(table, rows, { replace: true });
  const column = INCREMENTAL_TABLES.has(table) ? syncColumnFor(table, rows) : null;
  if (column) writeSyncMeta(table, {column, maxSyncAt: maxSyncAt(rows, '', column), fullAt: Date.now(), count: rows.length});
  syncStats.full += 1; syncStats.rowsFetched += rows.length;
  return rows;
}
/** Retorna as linhas atualizadas da tabela usando o cache + diferenças, ou null se precisar de carga completa. */
async function incrementalTableLoad(table, constraints) {
  if (!INCREMENTAL_TABLES.has(table) || !currentOfflineUser()) return null;
  const meta = readSyncMeta(table);
  const mode = SYNC_MODES[meta?.column];
  if (!mode || !meta.maxSyncAt || !meta.fullAt || Date.now() - meta.fullAt > mode.fullEvery) return null;
  const cached = await getCachedRows(table);
  if (!cached.length && meta.count > 0) return null;
  // Se a coluna sync_at passou a existir no banco, migra para ela na próxima carga completa.
  if (meta.column !== 'sync_at' && cached.some(row => row && 'sync_at' in row)) return null;
  const since = new Date(Date.parse(meta.maxSyncAt) - mode.overlap).toISOString();
  const [delta, countResult] = await Promise.all([
    fetchPaged(() => supabase.from(table).select('*').gt(meta.column, since).order(meta.column, { ascending: true })),
    supabase.from(table).select('id', { count: 'exact', head: true })
  ]);
  if (countResult.error) throw countResult.error;
  const byId = new Map(cached.map(row => [String(row.id), row]));
  for (const row of delta) byId.set(String(row.id), row);
  let removed = [], missing = [];
  if (typeof countResult.count === 'number' && countResult.count !== byId.size) {
    // Algo foi apagado (ou ficou visível/oculto por permissão): confere só os ids.
    syncStats.idChecks += 1;
    const ids = new Set((await fetchPaged(() => supabase.from(table).select('id').order('id', { ascending: true }))).map(row => String(row.id)));
    removed = [...byId.keys()].filter(id => !ids.has(id));
    removed.forEach(id => byId.delete(id));
    missing = [...ids].filter(id => !byId.has(id));
    for (let i = 0; i < missing.length; i += 200) {
      const { data, error } = await supabase.from(table).select('*').in('id', missing.slice(i, i + 200));
      if (error) throw error;
      for (const row of data || []) { byId.set(String(row.id), row); delta.push(row); }
    }
  }
  if (delta.length) await cacheRows(table, delta);
  for (const id of removed) await deleteCachedRow(table, id);
  writeSyncMeta(table, {...meta, maxSyncAt: maxSyncAt(delta, meta.maxSyncAt, meta.column), count: byId.size});
  syncStats.incremental += 1; syncStats.rowsFetched += delta.length;
  return applyLocalConstraints([...byId.values()], constraints, toSnake);
}

export async function getDocs(queryRef) {
  let collectionRef, constraints;
  if (queryRef._type === 'collection') {
    collectionRef = queryRef;
    constraints = [];
  } else {
    collectionRef = queryRef._collection;
    constraints = queryRef._constraints || [];
  }
  const table = tableName(collectionRef._path);
  const hasLimit = constraints.some(c => c._type === 'limit');
  const PAGE = 1000;
  let allRows = [];
  try {
    // Enquanto há alterações locais, a cópia local é a fonte de verdade para não
    // apagar inclusões/edições otimistas antes da sincronização terminar.
    if (await hasPendingMutations()) throw Object.assign(new Error('Alterações locais pendentes'), { offlineCache: true });
    const onlyOrdering = constraints.every(c => c._type === 'orderBy');
    if (hasLimit) {
      const q = buildQuery(collectionRef, constraints);
      const { data, error } = await q;
      if (error) throw error;
      allRows = data || [];
      await cacheRows(table, allRows);
    } else if (onlyOrdering) {
      // Tabela inteira: tenta trazer só as diferenças; se não der, carga completa.
      const incremental = await incrementalTableLoad(table, constraints).catch(error => {
        if (isOfflineError(error)) throw error;
        console.warn('Sincronização incremental indisponível; usando carga completa:', table, error?.message || error);
        return null;
      });
      allRows = incremental || (await fullTableLoad(table, constraints));
    } else {
      let offset = 0;
      while (true) {
        const q = buildQuery(collectionRef, constraints).range(offset, offset + PAGE - 1);
        const { data, error } = await q;
        if (error) throw error;
        allRows = allRows.concat(data || []);
        if (!data || data.length < PAGE) break;
        offset += PAGE;
      }
      await cacheRows(table, allRows);
    }
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw error;
    allRows = applyLocalConstraints(await getCachedRows(table), constraints, toSnake);
    await notifyOfflineState({ usingCache: true });
  }
  rememberRecords(table,allRows,true);
  const docs = allRows.map(row => ({
    id: row.id,
    exists: () => true,
    data: () => mergeExtraFields(row)
  }));
  return { docs, empty: docs.length === 0, size: docs.length };
}

export async function getDocsFromCache(queryRef) {
  let collectionRef, constraints;
  if (queryRef._type === 'collection') {
    collectionRef = queryRef;
    constraints = [];
  } else {
    collectionRef = queryRef._collection;
    constraints = queryRef._constraints || [];
  }
  const table = tableName(collectionRef._path);
  const rows = applyLocalConstraints(await getCachedRows(table), constraints, toSnake);
  rememberRecords(table, rows, true);
  const docs = rows.map(row => ({
    id: row.id,
    exists: () => true,
    data: () => mergeExtraFields(row)
  }));
  return { docs, empty: docs.length === 0, size: docs.length, fromCache: true };
}

export async function getDoc(docRef) {
  const table = tableName(docRef._path);
  let data;
  try {
    if (await hasPendingMutations()) throw Object.assign(new Error('Alterações locais pendentes'), { offlineCache: true });
    const result = await supabase.from(table).select('*').eq('id', docRef._id).maybeSingle();
    if (result.error) throw result.error;
    data = result.data;
    if (data) await putCachedRow(table, data);
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw error;
    data = await getCachedRow(table, docRef._id);
    await notifyOfflineState({ usingCache: true });
  }
  if (!data) return { exists: () => false, data: () => null, id: docRef._id };
  rememberRecords(table,[data]);
  return { exists: () => true, data: () => mergeExtraFields(data), id: data.id };
}

export async function addDoc(collectionRef, data) {
  const table = tableName(collectionRef._path);
  if ((table === 'items' || table === 'subitems') && globalThis.userCanCreateItems && !globalThis.userCanCreateItems()) {
    throw new Error('Seu usuário não tem permissão para criar itens ou subitens.');
  }
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  if (!payload.id) {
    payload.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  cleanPayload(payload);
  moveUnknownToExtra(table, payload);
  try {
    if (await hasPendingMutations() || globalThis.navigator?.onLine === false || globalThis.__forceOfflinePersistence === true || hasLocalImage(payload)) throw Object.assign(new Error('Modo offline'), { offlineCache: true });
    if (WRITE_ONLY_TABLES.has(table)) { await writeRow(table, payload); await putCachedRow(table, payload); return { id: payload.id, path: `${collectionRef._path}/${payload.id}` }; }
    const { data: inserted, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    rememberRecords(table,[inserted]);
    await putCachedRow(table, inserted);
    emitRecordChange(table, 'INSERT', inserted);
    return { id: inserted.id, path: `${collectionRef._path}/${inserted.id}` };
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw friendlyDbError(error, 'salvar este registro');
    await putCachedRow(table, payload);
    await queueMutation({ type: 'upsert', table, id: payload.id, payload });
    rememberRecords(table,[payload]);
    emitRecordChange(table, 'INSERT', payload);
    return { id: payload.id, path: `${collectionRef._path}/${payload.id}`, pending: true };
  }
}

export async function setDoc(docRef, data, options) {
  const table = tableName(docRef._path);
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  cleanPayload(payload);
  if (options?.merge) {
    let existing = null;
    if (globalThis.navigator?.onLine !== false && !await hasPendingMutations()) {
      const result = await supabase.from(table).select('*').eq('id', docRef._id).maybeSingle();
      if (result.error && !isOfflineError(result.error)) throw result.error;
      existing = result.data || null;
    }
    if (!existing) existing = await getCachedRow(table, docRef._id).catch(() => null);
    if (existing) Object.assign(payload, { ...mergeExtraFields(existing), ...payload });
  }
  payload.id = docRef._id;
  cleanPayload(payload);
  for(const key of ['created_by','created_by_name','updated_by','updated_by_name','audit_created_at','audit_updated_at'])delete payload[key];
  moveUnknownToExtra(table, payload);
  try {
    if (await hasPendingMutations() || globalThis.navigator?.onLine === false || globalThis.__forceOfflinePersistence === true || hasLocalImage(payload)) throw Object.assign(new Error('Modo offline'), { offlineCache: true });
    const {data:saved,error}=await supabase.from(table).upsert(payload).select().maybeSingle();
    if(error)throw error;
    if(saved){rememberRecords(table,[saved]);await putCachedRow(table,saved);emitRecordChange(table,'UPDATE',saved);}
    return {pending:false};
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw friendlyDbError(error, 'salvar este registro');
    await putCachedRow(table,payload);
    await queueMutation({type:'upsert',table,id:docRef._id,payload});
    emitRecordChange(table,'UPDATE',payload);
    return {pending:true};
  }
}

export async function updateDoc(docRef, data) {
  const table = tableName(docRef._path);
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  delete payload.id;
  cleanPayload(payload);
  let existingExtra = null;
  let cachedExisting = await getCachedRow(table, docRef._id).catch(() => null);
  if (EXTRA_TABLES.has(table)) {
    if (globalThis.navigator?.onLine !== false && !await hasPendingMutations()) {
      const { data: existing, error } = await supabase.from(table).select('extra_fields').eq('id', docRef._id).maybeSingle();
      if (error && !isOfflineError(error)) throw error;
      if (existing?.extra_fields) existingExtra = existing.extra_fields;
    }
    if (!existingExtra && cachedExisting?.extra_fields) existingExtra = cachedExisting.extra_fields;
  }
  moveUnknownToExtra(table, payload, existingExtra);
  try {
    if (await hasPendingMutations() || globalThis.navigator?.onLine === false || globalThis.__forceOfflinePersistence === true || hasLocalImage(payload)) throw Object.assign(new Error('Modo offline'), { offlineCache: true });
    const {data:saved,error}=await supabase.from(table).update(payload).eq('id',docRef._id).select().maybeSingle();
    if(error)throw error;
    if(saved){rememberRecords(table,[saved]);await putCachedRow(table,saved);emitRecordChange(table,'UPDATE',saved,cachedExisting);}
    return {pending:false};
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw friendlyDbError(error, 'alterar este registro');
    cachedExisting = cachedExisting || {id:docRef._id};
    const local = {...cachedExisting,...payload,id:docRef._id};
    await putCachedRow(table,local);
    await queueMutation({type:'update',table,id:docRef._id,payload});
    rememberRecords(table,[local]);
    emitRecordChange(table,'UPDATE',local,cachedExisting);
    return {pending:true};
  }
}

async function physicalDelete(docRef) {
  const table = tableName(docRef._path);
  try {
    if (await hasPendingMutations() || globalThis.navigator?.onLine === false) throw Object.assign(new Error('Modo offline'), { offlineCache: true });
    const { error } = await supabase.from(table).delete().eq('id', docRef._id);
    if (error) throw error;
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw error;
    await queueMutation({type:'delete',table,id:docRef._id});
  }
  await deleteCachedRow(table,docRef._id);
  globalThis.__recordIndex?.delete(table+'/'+docRef._id);globalThis.refreshAuditUI?.();
  emitRecordChange(table,'DELETE',null,{id:docRef._id});
}

function trashContext(table, row, options = {}) {
  const state = globalThis.S || {};
  const parentItem = state.items?.find(item => item.id === row.item_id);
  const parentSubitem = state.subitems?.find(item => item.id === row.parent_id);
  const activityId = options.activityId || row.atividade_id || parentItem?.atividade_id || parentSubitem?.atividade_id || (table === 'atividades' ? row.id : null);
  const activity = state.secs?.find(item => item.id === activityId);
  const secretariaId = options.secretariaId || row.secretaria_id || row.demanda_secretaria_id || activity?.demanda_secretaria_id || (table === 'secretarias' ? row.id : null);
  const secretaria = state.secretarias?.find(item => item.id === secretariaId);
  return {
    source_label: options.label || row.description || row.name || row.nome || row.titulo || row.field_name || row.inventory_code || row.numero || 'Registro sem título',
    source_activity_id: activityId,
    source_activity_name: options.activityName || activity?.name || null,
    source_secretaria_id: secretariaId,
    source_secretaria_name: options.secretariaName || secretaria?.name || (table === 'secretarias' ? row.name : null) || null
  };
}

async function rowForDeletion(table, id) {
  let row = await getCachedRow(table, id).catch(() => null);
  if (globalThis.navigator?.onLine !== false && !await hasPendingMutations()) {
    const result = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    if (result.error && !isOfflineError(result.error)) throw result.error;
    row = result.data || row;
  }
  return row;
}

async function saveRawRow(table, payload, action = 'gravar este registro') {
  try {
    if (await hasPendingMutations() || globalThis.navigator?.onLine === false) throw Object.assign(new Error('Modo offline'), { offlineCache: true });
    const data = await writeRow(table, payload);
    await putCachedRow(table, data || payload);
    return {pending:false, data: data || payload};
  } catch (error) {
    if (!error?.offlineCache && !isOfflineError(error)) throw friendlyDbError(error, action);
    await putCachedRow(table, payload);
    await queueMutation({type:'upsert', table, id:payload.id, payload});
    return {pending:true, data:payload};
  }
}

export async function permanentDeleteDoc(docRef) {
  return physicalDelete(docRef);
}

// Toda exclusão funcional é recuperável. A remoção física fica reservada à
// própria lixeira e a rollbacks técnicos marcados explicitamente.
export async function deleteDoc(docRef, options = {}) {
  const table = tableName(docRef._path);
  if (table === 'trash_items' || options.permanent === true) return physicalDelete(docRef);
  if ((table === 'items' || table === 'subitems') && globalThis.userCanDeleteItems && !globalThis.userCanDeleteItems()) {
    throw new Error('Seu usuário não tem permissão para excluir itens ou subitens.');
  }
  const row = options.record || await rowForDeletion(table, docRef._id);
  if (!row) throw new Error('A exclusão foi cancelada porque não foi possível preservar uma cópia na lixeira.');
  const {data:sessionData} = await supabase.auth.getSession();
  const user = sessionData?.session?.user || cachedOfflineUser();
  if (!user?.id && !user?.uid) throw new Error('Entre novamente antes de excluir. O registro não foi alterado.');
  const deletedBy = user.id || user.uid;
  const trashId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const trash = {
    id: trashId,
    source_table: table,
    source_id: docRef._id,
    ...trashContext(table, row, options),
    record_data: {...row, id:docRef._id},
    batch_id: options.batchId || null,
    deleted_by: deletedBy,
    deleted_by_name: options.deletedByName || globalThis.S?.me?.displayName || globalThis.S?.user?.displayName || user.email?.split('@')[0] || 'Usuário',
    deleted_at: new Date().toISOString()
  };
  let saved;
  saved = await saveRawRow('trash_items', trash, 'excluir este registro');
  try { await physicalDelete(docRef); }
  catch (error) { throw friendlyDbError(error, 'excluir este registro'); }
  return {trashId, pending:saved.pending};
}

export async function restoreTrashItem(trashId) {
  const trash = await rowForDeletion('trash_items', trashId);
  if (!trash) throw new Error('Registro não encontrado na lixeira.');
  const sourceTable = tableName(trash.source_table);
  if (!/^[a-z][a-z0-9_]*$/.test(sourceTable)) throw new Error('Origem inválida; a restauração foi bloqueada.');
  const existing = await rowForDeletion(sourceTable, trash.source_id);
  if (existing) throw new Error('Já existe um registro ativo com o mesmo identificador. Nada foi sobrescrito.');
  const raw = typeof trash.record_data === 'string' ? JSON.parse(trash.record_data) : trash.record_data;
  const result = await saveRawRow(sourceTable, {...raw, id:trash.source_id});
  await physicalDelete({_path:'trash_items', _id:trashId});
  return result;
}

export function writeBatch(db) {
  const ops = [];
  const batch = {
    set: (docRef, data) => { ops.push({ type: 'set', docRef, data }); return batch; },
    update: (docRef, data) => { ops.push({ type: 'update', docRef, data }); return batch; },
    delete: (docRef) => { ops.push({ type: 'delete', docRef }); return batch; },
    commit: async () => {
      // Sem transação real: informa quantas operações já foram aplicadas quando falha
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        try {
          if (op.type === 'set') await setDoc(op.docRef, op.data);
          else if (op.type === 'update') await updateDoc(op.docRef, op.data);
          else if (op.type === 'delete') await deleteDoc(op.docRef);
        } catch (e) {
          const err = new Error(`batch falhou em ${op.type} ${op.docRef._path}/${op.docRef._id} (operação ${i + 1} de ${ops.length}; ${i} já aplicadas): ${e.message || e}`);
          err.cause = e;
          err.appliedOps = i;
          throw err;
        }
      }
    }
  };
  return batch;
}

// Real-time: simple polling fallback. Proper Supabase realtime can be added later.
export function onSnapshot(queryRef, callback, errorCallback) {
  let lastData = null;
  const run = async () => {
    try {
      let snap;
      if (queryRef._type === 'doc') {
        const d = await getDoc(queryRef);
        snap = { docs: d.exists() ? [d] : [], empty: !d.exists(), size: d.exists() ? 1 : 0 };
      } else {
        snap = await getDocs(queryRef);
      }
      const rows = snap.docs.map(d => d.data());
      const hash = JSON.stringify(rows);
      if (hash !== lastData) {
        lastData = hash;
        callback(snap);
      }
    } catch (e) {
      console.error('onSnapshot poll error', e);
      if (errorCallback) errorCallback(e);
    }
  };
  run();
  const interval = setInterval(run, 3000);
  return () => clearInterval(interval);
}

// Sincronização imediata entre navegadores. O polling acima continua disponível
// para compatibilidade, mas as telas principais recebem cada alteração assim que
// o Postgres confirma a gravação.
export function subscribeToRealtimeChanges(callback, tables = REALTIME_TABLES) {
  const channelName = `gestao-live-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  let channel = supabase.channel(channelName);
  for (const table of tables) {
    channel = channel.on('postgres_changes', {event:'*', schema:'public', table}, async payload => {
      const eventType = payload.eventType || payload.event || 'UPDATE';
      const row = eventType === 'DELETE' ? null : payload.new;
      const oldRow = payload.old || null;
      try {
        if (eventType === 'DELETE') {
          const id = oldRow?.id;
          if (id) await deleteCachedRow(table,id);
        } else if (row?.id) {
          await putCachedRow(table,row);
          rememberRecords(table,[row]);
        }
      } catch (error) {
        console.warn('Não foi possível atualizar o cache em tempo real:',table,error);
      }
      emitRecordChange(table,eventType,row,oldRow,'remote');
      callback?.({table,eventType,record:row?mergeExtraFields({...row}):null,oldRecord:oldRow?mergeExtraFields({...oldRow}):null,source:'remote'});
    });
  }
  channel.subscribe(status => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      globalThis.dispatchEvent?.(new CustomEvent('gestao-realtime-state',{detail:{status}}));
    }
  });
  return () => supabase.removeChannel(channel);
}

export { supabase };

export async function moveAttendanceRecord(args) {
 const {data,error}=await supabase.rpc('move_attendance_record',args);
 if(error)throw new Error(error.message||'Não foi possível mover o atendimento.');
 return data;
}
export async function updateRecordAuditAdmin(args) {
 const {data,error}=await supabase.rpc('admin_update_record_audit',args);
 if(error)throw new Error(error.message||'Não foi possível corrigir a autoria do registro.');
 return data;
}
export async function editUserAdminSession(body) {
 const {data:sessionData}=await supabase.auth.getSession();
 const token=sessionData?.session?.access_token;
 if(!token)throw new Error('Entre novamente para editar usuários.');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/super-worker`,{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...body,action:body.action||'update'})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.message||'Não foi possível atualizar o login. Atualize a função super-worker no Supabase.');
 if(!result.updated)throw new Error('A função de edição ainda não foi atualizada no Supabase.');
 return result;
}
