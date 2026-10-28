-- Criar/excluir itens e subitens é independente de criar/excluir grupos.
-- Usuários antigos permanecem autorizados: somente `false` explícito bloqueia.
CREATE OR REPLACE FUNCTION public.enforce_item_creation_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  profile public.users%ROWTYPE;
  profile_extra jsonb := '{}'::jsonb;
  can_create_items boolean := true;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para criar itens ou subitens.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile
  FROM public.users
  WHERE id = (SELECT auth.uid())::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de usuário não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(profile.extra_fields) = 'object' THEN
    profile_extra := profile.extra_fields;
  ELSIF jsonb_typeof(profile.extra_fields) = 'string' THEN
    profile_extra := (profile.extra_fields #>> '{}')::jsonb;
  END IF;

  can_create_items := profile.role = 'admin'
    OR profile.is_admin IS TRUE
    OR COALESCE(profile_extra -> 'permissoes' ->> 'pode_criar_itens', 'true') <> 'false';

  IF NOT can_create_items THEN
    RAISE EXCEPTION 'Seu usuário não tem permissão para criar itens ou subitens.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_item_deletion_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  profile public.users%ROWTYPE;
  profile_extra jsonb := '{}'::jsonb;
  can_delete_items boolean := true;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN OLD;
  END IF;

  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para excluir itens ou subitens.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile
  FROM public.users
  WHERE id = (SELECT auth.uid())::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de usuário não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(profile.extra_fields) = 'object' THEN
    profile_extra := profile.extra_fields;
  ELSIF jsonb_typeof(profile.extra_fields) = 'string' THEN
    profile_extra := (profile.extra_fields #>> '{}')::jsonb;
  END IF;

  can_delete_items := profile.role = 'admin'
    OR profile.is_admin IS TRUE
    OR COALESCE(profile_extra -> 'permissoes' ->> 'pode_excluir_itens', 'true') <> 'false';

  IF NOT can_delete_items THEN
    RAISE EXCEPTION 'Seu usuário não tem permissão para excluir itens ou subitens.' USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_item_creation_permission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_item_deletion_permission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_item_creation_permission ON public.items;
CREATE TRIGGER enforce_item_creation_permission
BEFORE INSERT ON public.items
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_creation_permission();

DROP TRIGGER IF EXISTS enforce_subitem_creation_permission ON public.subitems;
CREATE TRIGGER enforce_subitem_creation_permission
BEFORE INSERT ON public.subitems
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_creation_permission();

DROP TRIGGER IF EXISTS enforce_item_deletion_permission ON public.items;
CREATE TRIGGER enforce_item_deletion_permission
BEFORE DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_deletion_permission();

DROP TRIGGER IF EXISTS enforce_subitem_deletion_permission ON public.subitems;
CREATE TRIGGER enforce_subitem_deletion_permission
BEFORE DELETE ON public.subitems
FOR EACH ROW EXECUTE FUNCTION public.enforce_item_deletion_permission();
