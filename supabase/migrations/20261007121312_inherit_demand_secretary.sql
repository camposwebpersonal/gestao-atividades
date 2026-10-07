-- Demandas pertencem à secretaria do grupo. Itens e subitens herdam esse vínculo
-- inclusive quando são criados por clientes antigos ou movidos entre grupos.
CREATE OR REPLACE FUNCTION public.pms_inherit_demand_secretary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public,pg_temp
AS $$
DECLARE fixed_secretary text;
BEGIN
 SELECT demanda_secretaria_id INTO fixed_secretary
 FROM public.atividades WHERE id=NEW.atividade_id;
 IF fixed_secretary IS NOT NULL THEN NEW.secretaria_id:=fixed_secretary; END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pms_items_inherit_demand_secretary ON public.items;
CREATE TRIGGER pms_items_inherit_demand_secretary
BEFORE INSERT OR UPDATE OF atividade_id,secretaria_id ON public.items
FOR EACH ROW EXECUTE FUNCTION public.pms_inherit_demand_secretary();

DROP TRIGGER IF EXISTS pms_subitems_inherit_demand_secretary ON public.subitems;
CREATE TRIGGER pms_subitems_inherit_demand_secretary
BEFORE INSERT OR UPDATE OF atividade_id,secretaria_id ON public.subitems
FOR EACH ROW EXECUTE FUNCTION public.pms_inherit_demand_secretary();

REVOKE ALL ON FUNCTION public.pms_inherit_demand_secretary() FROM PUBLIC,anon,authenticated;

-- Preserve authorship and valid historical timestamps while repairing legacy rows.
SELECT set_config('pms.audit_override','on',true);

UPDATE public.items i SET
 secretaria_id=a.demanda_secretaria_id,
 updated_at=CASE WHEN i.created_at IS NOT NULL AND i.updated_at<i.created_at THEN i.created_at ELSE i.updated_at END
FROM public.atividades a
WHERE i.atividade_id=a.id AND a.demanda_secretaria_id IS NOT NULL
  AND i.secretaria_id IS DISTINCT FROM a.demanda_secretaria_id;

UPDATE public.subitems s SET
 secretaria_id=a.demanda_secretaria_id,
 updated_at=CASE WHEN s.created_at IS NOT NULL AND s.updated_at<s.created_at THEN s.created_at ELSE s.updated_at END
FROM public.atividades a
WHERE s.atividade_id=a.id AND a.demanda_secretaria_id IS NOT NULL
  AND s.secretaria_id IS DISTINCT FROM a.demanda_secretaria_id;

SELECT set_config('pms.audit_override','off',true);
