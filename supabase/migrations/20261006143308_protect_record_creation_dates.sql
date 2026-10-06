CREATE OR REPLACE FUNCTION public.pms_protect_record_creation_date() RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('pms.audit_override',true),'')<>'on' THEN
    NEW.created_at=OLD.created_at;
  END IF;
  IF NEW.created_at IS NOT NULL AND NEW.updated_at IS NOT NULL AND NEW.updated_at<NEW.created_at THEN
    RAISE EXCEPTION 'A última edição não pode ser anterior à criação.';
  END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['atividades','items','subitems'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pms_protect_record_creation_date_trigger ON public.%I',table_name);
    EXECUTE format('CREATE TRIGGER pms_protect_record_creation_date_trigger BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pms_protect_record_creation_date()',table_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM anon;
REVOKE ALL ON FUNCTION public.pms_protect_record_creation_date() FROM authenticated;
