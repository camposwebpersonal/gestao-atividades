-- A criação de grupos é uma permissão separada da manutenção dos lançamentos.
CREATE OR REPLACE FUNCTION public.enforce_activity_group_creation_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  profile public.users%ROWTYPE;
  profile_extra jsonb := '{}'::jsonb;
  can_create_groups boolean := false;
BEGIN
  -- Rotinas administrativas do Supabase continuam aptas a importar/restaurar dados.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para criar grupos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile
  FROM public.users
  WHERE id = (SELECT auth.uid())::text;

  IF jsonb_typeof(profile.extra_fields) = 'object' THEN
    profile_extra := profile.extra_fields;
  ELSIF jsonb_typeof(profile.extra_fields) = 'string' THEN
    profile_extra := (profile.extra_fields #>> '{}')::jsonb;
  END IF;

  can_create_groups := profile.role = 'admin'
    OR profile.is_admin IS TRUE
    OR COALESCE(profile_extra -> 'permissoes' ->> 'pode_criar_grupos', 'false') = 'true';

  IF NOT can_create_groups THEN
    RAISE EXCEPTION 'Seu usuário não tem permissão para criar grupos.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_activity_group_creation_permission() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_activity_group_creation_permission ON public.atividades;
CREATE TRIGGER enforce_activity_group_creation_permission
BEFORE INSERT ON public.atividades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_group_creation_permission();

-- Impede que um usuário comum conceda a permissão a si mesmo pela API.
CREATE OR REPLACE FUNCTION public.enforce_user_admin_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_is_admin boolean := false;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(role = 'admin' OR is_admin IS TRUE, false)
  INTO actor_is_admin
  FROM public.users
  WHERE id = (SELECT auth.uid())::text;

  IF NOT actor_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar usuários e permissões.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_admin_writes() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_user_admin_writes ON public.users;
CREATE TRIGGER enforce_user_admin_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_admin_writes();
