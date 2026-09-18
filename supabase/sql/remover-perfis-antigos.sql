-- Remove somente perfis antigos com domínio legado e sem login vinculado.
-- Execute no SQL Editor do projeto xwlmpxypjheuhbxyfplo.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = '133dcf14-7822-42a2-8573-2adbc8bd6488' AND lower(email) = 'camposweb.personal@gmail.com') THEN
    RAISE EXCEPTION 'Projeto incorreto: conta RCAMPOS não encontrada.';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS pms_maintenance;
REVOKE ALL ON SCHEMA pms_maintenance FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS pms_maintenance.removed_legacy_users (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE legacy_users_to_remove ON COMMIT DROP AS
SELECT p.id
FROM public.users p
WHERE lower(trim(p.email)) ~ '@pms\.(sertania|sertanis)$'
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = p.id)
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE lower(trim(a.email)) = lower(trim(p.email)));

INSERT INTO pms_maintenance.removed_legacy_users (id,payload)
SELECT p.id,to_jsonb(p) FROM public.users p
JOIN legacy_users_to_remove r ON r.id = p.id
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.users p
USING legacy_users_to_remove r
WHERE p.id = r.id
RETURNING p.email AS registro_removido, p.role;
COMMIT;
