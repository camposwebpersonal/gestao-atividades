-- Corrige registros legados cujo updated_at ficou anterior ao created_at e
-- impede que a ordem alfabética dos gatilhos bloqueie atualizações normais.
-- As datas anteriores são preservadas em área privada para reversão/auditoria.

CREATE SCHEMA IF NOT EXISTS pms_maintenance;

CREATE TABLE IF NOT EXISTS pms_maintenance.audit_timestamp_repair_20261027 (
  table_name text NOT NULL,
  record_id text NOT NULL,
  previous_updated_at timestamptz,
  created_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, record_id)
);

INSERT INTO pms_maintenance.audit_timestamp_repair_20261027
  (table_name, record_id, previous_updated_at, created_at)
SELECT 'atividades', id, updated_at, created_at
FROM public.atividades
WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at
ON CONFLICT (table_name, record_id) DO NOTHING;

INSERT INTO pms_maintenance.audit_timestamp_repair_20261027
  (table_name, record_id, previous_updated_at, created_at)
SELECT 'items', id, updated_at, created_at
FROM public.items
WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at
ON CONFLICT (table_name, record_id) DO NOTHING;

INSERT INTO pms_maintenance.audit_timestamp_repair_20261027
  (table_name, record_id, previous_updated_at, created_at)
SELECT 'subitems', id, updated_at, created_at
FROM public.subitems
WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at
ON CONFLICT (table_name, record_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pms_protect_record_creation_date() RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
DECLARE
  audit_override boolean := COALESCE(current_setting('pms.audit_override', true), '') = 'on';
BEGIN
  IF NOT audit_override THEN
    NEW.created_at := OLD.created_at;

    -- Registros importados antigos podem chegar aqui com updated_at inválido.
    -- A atualização atual deve repará-los, não impedir a ação do usuário.
    IF NEW.created_at IS NOT NULL
       AND (NEW.updated_at IS NULL OR NEW.updated_at < NEW.created_at) THEN
      NEW.updated_at := GREATEST(clock_timestamp(), NEW.created_at);
    END IF;
  ELSIF NEW.created_at IS NOT NULL
        AND NEW.updated_at IS NOT NULL
        AND NEW.updated_at < NEW.created_at THEN
    RAISE EXCEPTION 'A última edição não pode ser anterior à criação.';
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('pms.audit_override', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Mesmo com relógio divergente ou data histórica futura, nunca produza uma
  -- última edição anterior à criação.
  NEW.updated_at := GREATEST(clock_timestamp(), COALESCE(NEW.created_at, clock_timestamp()));
  RETURN NEW;
END $$;

DO $$
BEGIN
  PERFORM set_config('pms.audit_override', 'on', true);

  UPDATE public.atividades
  SET updated_at = created_at
  WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at;

  UPDATE public.items
  SET updated_at = created_at
  WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at;

  UPDATE public.subitems
  SET updated_at = created_at
  WHERE created_at IS NOT NULL AND updated_at IS NOT NULL AND updated_at < created_at;
END $$;

REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM anon;
REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM authenticated;
