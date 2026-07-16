#!/usr/bin/env python3
"""Compara contagem e IDs de cada coleção Firebase vs tabela Supabase."""
import os, sys, requests

FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY', 'AIzaSyBy_k7nY2legV17h53GaU-7-usDvtnOzjs')
FIREBASE_EMAIL = os.environ.get('FIREBASE_EMAIL', 'rcampos@pms.sertania')
FIREBASE_PASSWORD = os.environ.get('FIREBASE_PASSWORD', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://xwlmpxypjheuhbxyfplo.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU')

COLLECTIONS = {
    'secretarias': 'secretarias',
    'secretariats': 'atividades',
    'responsaveis': 'responsaveis',
    'items': 'items',
    'subitems': 'subitems',
    'fieldTemplates': 'field_templates',
    'entity_images': 'entity_images',
    'users': 'users',
    'contatos': 'contatos',
    'galeria': 'galeria',
    'chamados': 'chamados',
    'contas': 'contas',
}


def firebase_login():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    r = requests.post(url, json={"email": FIREBASE_EMAIL, "password": FIREBASE_PASSWORD, "returnSecureToken": True})
    r.raise_for_status()
    return r.json()['idToken']


def firebase_ids(token, collection):
    base = f"https://firestore.googleapis.com/v1/projects/gestao-atividades-26257/databases/(default)/documents/{collection}"
    ids = set()
    next_page = None
    while True:
        params = {"pageSize": 1000}
        if next_page:
            params["pageToken"] = next_page
        r = requests.get(base, headers={"Authorization": f"Bearer {token}"}, params=params)
        r.raise_for_status()
        data = r.json()
        for doc in data.get('documents', []):
            ids.add(doc['name'].split('/')[-1])
        next_page = data.get('nextPageToken')
        if not next_page:
            break
    return ids


def supabase_ids(table):
    ids = set()
    offset = 0
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    while True:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?select=id&limit=1000&offset={offset}", headers=headers)
        if r.status_code != 200:
            print(f"   ⚠️ Erro lendo tabela {table}: {r.status_code} {r.text[:200]}")
            return ids
        rows = r.json()
        for row in rows:
            ids.add(str(row['id']))
        if len(rows) < 1000:
            break
        offset += 1000
    return ids


def main():
    if not FIREBASE_PASSWORD:
        print("❌ Defina FIREBASE_PASSWORD")
        sys.exit(1)
    token = firebase_login()
    print("✅ Logado no Firebase\n")
    total_missing = 0
    for collection, table in COLLECTIONS.items():
        fb = firebase_ids(token, collection)
        sb = supabase_ids(table)
        missing = fb - sb
        extra = sb - fb
        status = "✅" if not missing else "❌"
        print(f"{status} {collection} -> {table}: Firebase={len(fb)} Supabase={len(sb)} Faltando={len(missing)}")
        if missing:
            total_missing += len(missing)
            print(f"   IDs faltando (até 10): {sorted(missing)[:10]}")
    print(f"\nTotal de documentos faltando: {total_missing}")


if __name__ == '__main__':
    main()
