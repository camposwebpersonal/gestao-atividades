-- A exclusão de grupos é independente da permissão de editar seus lançamentos.
CREATE OR REPLACE FUNCTION public.enforce_activity_group_deletion_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  profile public.users%ROWTYPE;
  profile_extra jsonb := '{}'::jsonb;
  can_delete_groups boolean := false;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para excluir grupos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile
  FROM public.users
  WHERE id = (SELECT auth.uid())::text;

  IF jsonb_typeof(profile.extra_fields) = 'object' THEN
    profile_extra := profile.extra_fields;
  ELSIF jsonb_typeof(profile.extra_fields) = 'string' THEN
    profile_extra := (profile.extra_fields #>> '{}')::jsonb;
  END IF;

  can_delete_groups := profile.role = 'admin'
    OR profile.is_admin IS TRUE
    OR COALESCE(profile_extra -> 'permissoes' ->> 'pode_excluir_grupos', 'false') = 'true';

  IF NOT can_delete_groups THEN
    RAISE EXCEPTION 'Seu usuário não tem permissão para excluir grupos.' USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_activity_group_deletion_permission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_activity_group_deletion_permission ON public.atividades;
CREATE TRIGGER enforce_activity_group_deletion_permission
BEFORE DELETE ON public.atividades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_group_deletion_permission();
