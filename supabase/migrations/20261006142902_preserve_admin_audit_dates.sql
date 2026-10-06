-- O projeto já atualiza updated_at automaticamente. Durante a correção
-- administrativa, preserve a data escolhida pelo administrador.
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('pms.audit_override',true),'')='on' THEN RETURN NEW; END IF;
  NEW.updated_at=now();
  RETURN NEW;
END $$;
