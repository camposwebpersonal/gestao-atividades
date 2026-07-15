// Supabase compatibility layer that mimics Firebase API used by the app.
// This is a pragmatic first pass; not all Firebase features are covered.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const SUPABASE_URL = 'https://xwlmpxypjheuhbxyfplo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  'contatos': 'contatos',
  'galeria': 'galeria',
  'chamados': 'chamados',
  'contas': 'contas'
};

function toSnake(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/[A-Z]/g, c => '_' + c.toLowerCase()).replace(/^_/, '');
}

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function cleanPayload(payload) {
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

function tableName(path) {
  return TABLE_MAP[path] || path.toLowerCase();
}

// ===== AUTH (Firebase-style) =====
export function initializeApp(config) { return { name: 'supabase-compat' }; }
export function getAuth(app) { return supabase.auth; }

function mapUser(su) {
  if (!su) return null;
  return {
    uid: su.id,
    id: su.id,
    email: su.email,
    displayName: su.user_metadata?.display_name || su.user_metadata?.name || su.email?.split('@')[0] || '',
    emailVerified: su.email_confirmed_at ? true : false,
    metadata: su.user_metadata || {}
  };
}

export function onAuthStateChanged(auth, callback) {
  let initialDone = false;
  // Primeiro verifica sessão existente
  auth.getSession().then(({ data }) => {
    if (data?.session?.user) {
      initialDone = true;
      callback(mapUser(data.session.user));
    }
  });
  // Também escuta mudanças, mas evita chamar null antes de verificar a sessão
  const { subscription } = auth.onAuthStateChange((event, session) => {
    const user = mapUser(session?.user || null);
    if (!initialDone && !user) {
      // Aguarda um pouco para a sessão ser recuperada do storage
      setTimeout(() => {
        auth.getSession().then(({ data }) => {
          if (!data?.session?.user) callback(null);
        });
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

export async function sendPasswordResetEmail(auth, email) {
  const { error } = await auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOut(auth) {
  const { error } = await auth.signOut();
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

export async function getDocs(queryRef) {
  let collectionRef, constraints;
  if (queryRef._type === 'collection') {
    collectionRef = queryRef;
    constraints = [];
  } else {
    collectionRef = queryRef._collection;
    constraints = queryRef._constraints || [];
  }
  const q = buildQuery(collectionRef, constraints);
  const { data, error } = await q;
  if (error) throw error;
  const docs = (data || []).map(row => ({
    id: row.id,
    exists: () => true,
    data: () => row
  }));
  return { docs, empty: docs.length === 0, size: docs.length };
}

export async function getDoc(docRef) {
  const table = tableName(docRef._path);
  const { data, error } = await supabase.from(table).select('*').eq('id', docRef._id).maybeSingle();
  if (error) throw error;
  if (!data) return { exists: () => false, data: () => null, id: docRef._id };
  return { exists: () => true, data: () => data, id: data.id };
}

export async function addDoc(collectionRef, data) {
  const table = tableName(collectionRef._path);
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  cleanPayload(payload);
  const { data: inserted, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return { id: inserted.id, path: `${collectionRef._path}/${inserted.id}` };
}

export async function setDoc(docRef, data, options) {
  const table = tableName(docRef._path);
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  cleanPayload(payload);
  if (options?.merge) {
    const { data: existing, error: e1 } = await supabase.from(table).select('*').eq('id', docRef._id).single();
    if (!e1) {
      for (const [k, v] of Object.entries(existing)) {
        if (payload[k] === undefined) payload[k] = v;
      }
    }
  }
  payload.id = docRef._id;
  cleanPayload(payload);
  const { error } = await supabase.from(table).upsert(payload);
  if (error) throw error;
}

export async function updateDoc(docRef, data) {
  const table = tableName(docRef._path);
  const payload = {};
  for (const [k, v] of Object.entries(data)) payload[toSnake(k)] = v;
  delete payload.id;
  cleanPayload(payload);
  const { error } = await supabase.from(table).update(payload).eq('id', docRef._id);
  if (error) throw error;
}

export async function deleteDoc(docRef) {
  const table = tableName(docRef._path);
  const { error } = await supabase.from(table).delete().eq('id', docRef._id);
  if (error) throw error;
}

export function writeBatch(db) {
  const ops = [];
  const batch = {
    set: (docRef, data) => { ops.push({ type: 'set', docRef, data }); return batch; },
    update: (docRef, data) => { ops.push({ type: 'update', docRef, data }); return batch; },
    delete: (docRef) => { ops.push({ type: 'delete', docRef }); return batch; },
    commit: async () => {
      for (const op of ops) {
        if (op.type === 'set') await setDoc(op.docRef, op.data);
        else if (op.type === 'update') await updateDoc(op.docRef, op.data);
        else if (op.type === 'delete') await deleteDoc(op.docRef);
      }
    }
  };
  return batch;
}

// Real-time: simple polling fallback. Proper Supabase realtime can be added later.
export function onSnapshot(queryRef, callback) {
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
    } catch (e) { console.error('onSnapshot poll error', e); }
  };
  run();
  const interval = setInterval(run, 3000);
  return () => clearInterval(interval);
}

export { supabase };
