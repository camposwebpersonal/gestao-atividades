#!/usr/bin/env python3
"""
Script de migração Firebase -> Supabase.

Uso:
  export FIREBASE_API_KEY="..."
  export FIREBASE_EMAIL="rcampos@pms.sertania"
  export FIREBASE_PASSWORD="..."
  export SUPABASE_URL="https://xwlmpxypjheuhbxyfplo.supabase.co"
  export SUPABASE_SERVICE_KEY="..."   # service role key (necessário para inserir dados)
  python3 migrate_to_supabase.py

OU preencha as variáveis abaixo diretamente (não recomendado para produção).
"""

import os, sys, json, math, time, requests

FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY', 'AIzaSyBy_k7nY2legV17h53GaU-7-usDvtnOzjs')
FIREBASE_EMAIL = os.environ.get('FIREBASE_EMAIL', 'rcampos@pms.sertania')
FIREBASE_PASSWORD = os.environ.get('FIREBASE_PASSWORD', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://xwlmpxypjheuhbxyfplo.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Coleções do Firebase Firestore (ordem importa para referências)
COLLECTIONS = [
    'secretarias',
    'secretariats',   # atividades no app
    'responsaveis',
    'items',
    'subitems',
    'fieldTemplates',
    'entity_images',
    'users',
    'contatos',
    'galeria',
    'chamados',
    'contas',
]

FIELD_CONVERSIONS = {
    'secretariats': 'atividades',
}


def firebase_login():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    r = requests.post(url, json={"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True})
    r.raise_for_status()
    return r.json()['idToken']


def list_firestore_documents(id_token, collection):
    base = f"https://firestore.googleapis.com/v1/projects/gestao-atividades-26257/databases/(default)/documents/{collection}"
    docs = []
    next_page = None
    while True:
        params = {"pageSize": 1000}
        if next_page:
            params["pageToken"] = next_page
        r = requests.get(base, headers={"Authorization": f"Bearer {id_token}"}, params=params)
        if r.status_code == 429:
            print(f"⚠️ Cota excedida lendo {collection}. Aguardando 60s...")
            time.sleep(60)
            continue
        r.raise_for_status()
        data = r.json()
        docs.extend(data.get('documents', []))
        next_page = data.get('nextPageToken')
        if not next_page:
            break
    return docs


def convert_firestore_value(v):
    """Converte valor do Firestore REST para Python nativo."""
    if 'stringValue' in v:
        return v['stringValue']
    if 'integerValue' in v:
        return int(v['integerValue'])
    if 'doubleValue' in v:
        return float(v['doubleValue'])
    if 'booleanValue' in v:
        return bool(v['booleanValue'])
    if 'timestampValue' in v:
        return v['timestampValue']
    if 'nullValue' in v:
        return None
    if 'mapValue' in v:
        return {k: convert_firestore_value(val) for k, val in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v:
        return [convert_firestore_value(val) for val in v['arrayValue'].get('values', [])]
    if 'referenceValue' in v:
        return v['referenceValue'].split('/')[-1]
    return v


def doc_to_dict(doc):
    """Converte documento Firestore REST para dict Python."""
    doc_id = doc['name'].split('/')[-1]
    fields = doc.get('fields', {})
    d = {'id': doc_id}
    for k, v in fields.items():
        d[k] = convert_firestore_value(v)
    return d


def snake_case_keys(d):
    """Converte camelCase keys para snake_case."""
    if not isinstance(d, dict):
        return d
    out = {}
    for k, v in d.items():
        nk = ''.join(['_' + c.lower() if c.isupper() else c for c in k]).lstrip('_')
        if nk == 'id':
            out[nk] = v
        elif isinstance(v, dict):
            out[nk] = snake_case_keys(v)
        elif isinstance(v, list):
            out[nk] = [snake_case_keys(i) if isinstance(i, dict) else i for i in v]
        else:
            out[nk] = v
    return out


def clean_for_supabase(table, row):
    """Limpa e converte row para o schema Supabase."""
    # Converter JSON/dict para string JSON
    for k, v in list(row.items()):
        if isinstance(v, dict):
            row[k] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, list):
            row[k] = json.dumps(v, ensure_ascii=False)
    # Para a tabela contas, mover campos desconhecidos para extra_fields
    if table == 'contas':
        known = {'id', 'nome', 'valor', 'atividade_id', 'extra_fields', 'created_at', 'updated_at'}
        extra = {}
        for k in list(row.keys()):
            if k not in known:
                extra[k] = row.pop(k)
        if extra:
            existing = json.loads(row.get('extra_fields', '{}') or '{}')
            existing.update(extra)
            row['extra_fields'] = json.dumps(existing, ensure_ascii=False)
    return row


def insert_to_supabase(table, rows):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }
    # Normalizar chaves: todos os objetos do lote devem ter as mesmas chaves
    all_keys = set()
    for row in rows:
        all_keys.update(row.keys())
    all_keys.discard('id')
    all_keys = ['id'] + sorted(all_keys)
    normalized = []
    for row in rows:
        new_row = {}
        for k in all_keys:
            new_row[k] = row.get(k)
        normalized.append(new_row)
    # Supabase REST aceita arrays para upsert
    r = requests.post(url, headers=headers, json=normalized)
    if r.status_code not in (200, 201, 204):
        print(f"❌ Erro inserindo em {table}: {r.status_code} {r.text[:500]}")
    else:
        print(f"✅ {table}: {len(normalized)} registros")


def migrate():
    if not FIREBASE_PASSWORD:
        print("❌ Defina FIREBASE_PASSWORD")
        sys.exit(1)
    key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    if not key:
        print("❌ Defina SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY")
        sys.exit(1)

    print("🔐 Logando no Firebase...")
    id_token = firebase_login()
    print("✅ Logado no Firebase")

    for collection in COLLECTIONS:
        table = FIELD_CONVERSIONS.get(collection, collection.lower())
        print(f"\n📦 Lendo {collection} (tabela {table})...")
        docs = list_firestore_documents(id_token, collection)
        print(f"   {len(docs)} documentos encontrados")
        rows = []
        for doc in docs:
            d = doc_to_dict(doc)
            d = snake_case_keys(d)
            d = clean_for_supabase(table, d)
            rows.append(d)
        # Inserir em lotes de 100
        for i in range(0, len(rows), 100):
            batch = rows[i:i+100]
            insert_to_supabase(table, batch)

    print("\n🎉 Migração concluída!")


if __name__ == '__main__':
    migrate()
