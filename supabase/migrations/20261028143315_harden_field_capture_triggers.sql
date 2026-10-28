-- Gatilhos internos nao devem ficar expostos como RPCs.
BEGIN;

REVOKE ALL ON FUNCTION public.is_field_demand_group(public.atividades) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_field_demand_group_after_secretaria() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_field_demand_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND COALESCE(OLD.extra_fields ->> 'system_group', '') = 'demandas-gerais-campo' THEN
    RAISE EXCEPTION 'Demandas Gerais de Campo e um grupo permanente e nao pode ser excluido.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.extra_fields ->> 'system_group', '') = 'demandas-gerais-campo' THEN
    NEW.name := 'Demandas Gerais de Campo';
    NEW.demanda_secretaria_id := OLD.demanda_secretaria_id;
    NEW.extra_fields := COALESCE(NEW.extra_fields, '{}'::jsonb)
      || jsonb_build_object('modulo', 'atendimentos', 'system_group', 'demandas-gerais-campo', 'permanent', true);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_field_demand_group() FROM PUBLIC, anon, authenticated;

COMMIT;
