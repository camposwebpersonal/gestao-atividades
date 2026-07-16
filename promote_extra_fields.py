#!/usr/bin/env python3
"""Promove valores de extra_fields para as colunas reais no Supabase."""
import os, json, requests

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://xwlmpxypjheuhbxyfplo.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU')

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TABLES = ['atividades', 'items', 'subitems', 'users', 'contas']


def fetch_all(table):
    rows = []
    offset = 0
    while True:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1000&offset={offset}", headers=HEADERS)
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


def main():
    for table in TABLES:
        rows = fetch_all(table)
        if not rows:
            print(f"⏭️ {table}: vazio")
            continue
        columns = set(rows[0].keys())
        updated = 0
        for row in rows:
            ef = row.get('extra_fields')
            if not ef:
                continue
            if isinstance(ef, str):
                try:
                    ef = json.loads(ef)
                except Exception:
                    continue
            if not isinstance(ef, dict) or not ef:
                continue
            patch = {}
            remaining = {}
            for k, v in ef.items():
                if k in columns and k != 'id':
                    cur = row.get(k)
                    # Promove apenas se a coluna está com valor default/vazio
                    if cur is None or cur == 0 or cur == '' or cur is False:
                        if isinstance(v, bool):
                            v = 1 if v else 0
                        patch[k] = v
                    # Chave promovível: remove de extra_fields
                else:
                    remaining[k] = v
            if patch or remaining != ef:
                patch['extra_fields'] = json.dumps(remaining, ensure_ascii=False)
                r = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row['id']}", headers=HEADERS, json=patch)
                if r.status_code not in (200, 204):
                    print(f"❌ {table}/{row['id']}: {r.status_code} {r.text[:200]}")
                else:
                    updated += 1
        print(f"✅ {table}: {updated} registros atualizados de {len(rows)}")


if __name__ == '__main__':
    main()
