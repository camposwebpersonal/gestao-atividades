-- Execute no SQL Editor do projeto xwlmpxypjheuhbxyfplo.
-- Não altera senhas nem apaga registros antigos.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = '133dcf14-7822-42a2-8573-2adbc8bd6488' AND lower(email) = 'camposweb.personal@gmail.com') THEN
    RAISE EXCEPTION 'Projeto incorreto: o login RCAMPOS verificado na auditoria não foi encontrado.';
  END IF;
END $$;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Cópia de segurança privada dos perfis antes das alterações.
CREATE SCHEMA IF NOT EXISTS pms_maintenance;
REVOKE ALL ON SCHEMA pms_maintenance FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS pms_maintenance.users_before_repair (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pms_maintenance.users_before_repair (id, payload)
SELECT id, to_jsonb(p) FROM public.users p ON CONFLICT (id) DO NOTHING;

-- Copia todos os campos do perfil legado para o ID correto, quando o e-mail
-- identifica uma única conta e um único perfil. Preserva permissões e vínculos.
INSERT INTO public.users
SELECT (jsonb_populate_record(NULL::public.users,
  to_jsonb(p) || jsonb_build_object('id', a.id::text, 'email', a.email))).*
FROM public.users p
JOIN auth.users a ON lower(a.email) = lower(p.email)
WHERE p.id <> a.id::text
  AND NOT EXISTS (SELECT 1 FROM public.users current_profile WHERE current_profile.id = a.id::text)
  AND (SELECT count(*) FROM public.users candidate WHERE lower(candidate.email) = lower(p.email)) = 1
  AND (SELECT count(*) FROM auth.users candidate WHERE lower(candidate.email) = lower(a.email)) = 1
ON CONFLICT (id) DO NOTHING;

-- Logins sem nenhum perfil recuperável recebem o nível básico, nunca admin.
INSERT INTO public.users (id, email, display_name, role, is_admin)
SELECT a.id::text, a.email,
  COALESCE(NULLIF(a.raw_user_meta_data->>'display_name', ''), split_part(a.email, '@', 1), 'Usuário'),
  'usuario', false
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = a.id::text)
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE lower(p.email) = lower(a.email))
ON CONFLICT (id) DO NOTHING;

-- Normaliza somente o nome legado do nível básico e indicadores de admin.
UPDATE public.users p SET role = 'usuario'
WHERE p.role = 'user' AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = p.id);
UPDATE public.users p SET is_admin = true
WHERE p.role = 'admin' AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = p.id);
UPDATE public.users p SET role = 'admin'
WHERE p.is_admin = true AND p.role IS DISTINCT FROM 'admin'
  AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = p.id);
COMMIT;

-- Resultado: pendências são explícitas, sem apagar nem inventar logins.
SELECT a.email AS conta, p.role, p.is_admin,
  CASE
    WHEN p.id IS NULL THEN 'PENDENTE: vínculo ambíguo, revisar perfis com este e-mail'
    WHEN p.role NOT IN ('admin','gestor','usuario') OR p.role IS NULL THEN 'PENDENTE: revisar nível de acesso'
    WHEN lower(COALESCE(p.email,'')) <> lower(COALESCE(a.email,'')) THEN 'PENDENTE: e-mail interno divergente'
    ELSE 'OK: login vinculado ao perfil'
  END AS resultado
FROM auth.users a LEFT JOIN public.users p ON p.id = a.id::text
UNION ALL
SELECT p.email, p.role, p.is_admin,
  CASE WHEN EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(p.email))
    OR (lower(p.email) = 'rcampos@pms.sertania' AND EXISTS (
      SELECT 1 FROM auth.users a JOIN public.users active_profile ON active_profile.id = a.id::text
      WHERE lower(a.email) = 'camposweb.personal@gmail.com' AND active_profile.role = 'admin'
    ))
  THEN 'LEGADO: registro preservado; conferir permissões históricas'
  ELSE 'PENDENTE: perfil antigo sem conta de autenticação; precisa cadastrar login'
  END
FROM public.users p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = p.id)
ORDER BY resultado, conta;
