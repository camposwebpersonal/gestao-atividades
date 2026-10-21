const DB_NAME = 'gestao-pms-offline-v1';
const DB_VERSION = 1;
const USER_KEY = 'gestao-offline-user';
let activeUserId = '';
let dbPromise;

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function database() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB indisponível neste navegador.'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'key' });
        records.createIndex('userTable', ['userId', 'table'], { unique: false });
      }
      if (!db.objectStoreNames.contains('mutations')) {
        const mutations = db.createObjectStore('mutations', { keyPath: 'queueId', autoIncrement: true });
        mutations.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir os dados offline.'));
  });
  return dbPromise;
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Falha ao gravar dados offline.'));
    tx.onabort = () => reject(tx.error || new Error('Gravação offline cancelada.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao ler dados offline.'));
  });
}

function userId() {
  if (activeUserId) return activeUserId;
  try { activeUserId = localStorage.getItem(USER_KEY) || ''; } catch (_) {}
  return activeUserId;
}

export function setOfflineUser(id) {
  activeUserId = id || '';
  try {
    if (activeUserId) localStorage.setItem(USER_KEY, activeUserId);
    else localStorage.removeItem(USER_KEY);
  } catch (_) {}
}

function requireUser() {
  const id = userId();
  if (!id) throw new Error('Entre no sistema uma vez com internet antes de usar o modo offline.');
  return id;
}

function recordKey(uid, table, id) { return `${uid}:${table}:${id}`; }

export async function cacheRows(table, rows, { replace = false } = {}) {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  if (replace) {
    const old = await requestResult(store.index('userTable').getAllKeys(IDBKeyRange.only([uid, table])));
    old.forEach(key => store.delete(key));
  }
  for (const row of rows || []) {
    if (!row?.id) continue;
    store.put({ key: recordKey(uid, table, row.id), userId: uid, table, id: row.id, row: clone(row), cachedAt: Date.now() });
  }
  await transactionDone(tx);
}

export async function getCachedRows(table) {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('records', 'readonly');
  const entries = await requestResult(tx.objectStore('records').index('userTable').getAll(IDBKeyRange.only([uid, table])));
  return entries.map(entry => clone(entry.row));
}

export async function getCachedRow(table, id) {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('records', 'readonly');
  const entry = await requestResult(tx.objectStore('records').get(recordKey(uid, table, id)));
  return entry ? clone(entry.row) : null;
}

export async function putCachedRow(table, row) {
  if (!row?.id) return;
  await cacheRows(table, [row]);
}

export async function deleteCachedRow(table, id) {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').delete(recordKey(uid, table, id));
  await transactionDone(tx);
}

export async function enqueueMutation(mutation) {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('mutations', 'readwrite');
  tx.objectStore('mutations').add({ ...clone(mutation), userId: uid, createdAt: Date.now() });
  await transactionDone(tx);
}

export async function listMutations() {
  const uid = requireUser();
  const db = await database();
  const tx = db.transaction('mutations', 'readonly');
  const rows = await requestResult(tx.objectStore('mutations').index('userId').getAll(IDBKeyRange.only(uid)));
  return rows.sort((a, b) => a.queueId - b.queueId);
}

export async function removeMutation(queueId) {
  const db = await database();
  const tx = db.transaction('mutations', 'readwrite');
  tx.objectStore('mutations').delete(queueId);
  await transactionDone(tx);
}

export async function pendingCount() {
  if (!userId()) return 0;
  return (await listMutations()).length;
}

function comparable(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value && typeof value === 'object' && Number.isFinite(value.seconds)) return value.seconds * 1000;
  return value;
}

export function applyLocalConstraints(rows, constraints = [], snake = value => value) {
  let result = [...(rows || [])];
  for (const c of constraints) {
    if (c._type === 'where') {
      const key = snake(c.field);
      result = result.filter(row => {
        const left = comparable(row[key] !== undefined ? row[key] : row[c.field]);
        const right = comparable(c.value);
        if (c.op === '==') return left === right;
        if (c.op === '!=') return left !== right;
        if (c.op === '>') return left > right;
        if (c.op === '<') return left < right;
        if (c.op === '>=') return left >= right;
        if (c.op === '<=') return left <= right;
        if (c.op === 'in') return Array.isArray(right) && right.includes(left);
        if (c.op === 'array-contains') return Array.isArray(left) && left.includes(right);
        return true;
      });
    } else if (c._type === 'orderBy') {
      const key = snake(c.field), direction = c.direction === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const av = comparable(a[key] !== undefined ? a[key] : a[c.field]);
        const bv = comparable(b[key] !== undefined ? b[key] : b[c.field]);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * direction;
      });
    } else if (c._type === 'limit') result = result.slice(0, c.n);
  }
  return result;
}
