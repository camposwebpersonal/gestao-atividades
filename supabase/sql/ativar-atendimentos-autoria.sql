-- Ativa autoria em todas as tabelas de cadastros/lançamentos do projeto
-- e transferência transacional entre grupos de Atendimentos.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id::text='133dcf14-7822-42a2-8573-2adbc8bd6488' AND lower(email)='camposweb.personal@gmail.com') THEN
  RAISE EXCEPTION 'Projeto incorreto: RCAMPOS não encontrado.';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pms_extra(row_data jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE value jsonb := row_data->'extra_fields';
BEGIN
 IF value IS NULL OR value='null'::jsonb THEN RETURN '{}'::jsonb; END IF;
 IF jsonb_typeof(value)='string' THEN value := (row_data->>'extra_fields')::jsonb; END IF;
 IF jsonb_typeof(value)<>'object' THEN RETURN '{}'::jsonb; END IF;
 RETURN value;
EXCEPTION WHEN others THEN RETURN '{}'::jsonb;
END $$;

CREATE OR REPLACE FUNCTION public.pms_record_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor text := auth.uid()::text; actor_name text;
BEGIN
 IF actor IS NOT NULL THEN
  SELECT COALESCE(NULLIF(u.display_name,''), CASE WHEN lower(a.email)='camposweb.personal@gmail.com' THEN 'RCAMPOS' ELSE split_part(a.email,'@',1) END)
  INTO actor_name FROM auth.users a LEFT JOIN public.users u ON u.id=a.id::text WHERE a.id::text=actor;
 ELSIF auth.role()='service_role' AND NEW.updated_by IS NOT NULL THEN
  actor:=NEW.updated_by; actor_name:=COALESCE(NULLIF(NEW.updated_by_name,''),'Sistema / manutenção');
 ELSE
  actor:=NULL; actor_name:='Sistema / manutenção';
 END IF;
 IF TG_OP='INSERT' THEN
  IF COALESCE(current_setting('pms.preserve_author',true),'')<>'on' THEN
   NEW.created_by:=actor; NEW.created_by_name:=actor_name; NEW.audit_created_at:=now();
  END IF;
 ELSE
  NEW.created_by:=OLD.created_by; NEW.created_by_name:=OLD.created_by_name; NEW.audit_created_at:=OLD.audit_created_at;
 END IF;
 NEW.updated_by:=actor; NEW.updated_by_name:=actor_name; NEW.audit_updated_at:=now();
 RETURN NEW;
END $$;

DO $$ DECLARE tab record; BEGIN
 FOR tab IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
 ON t.table_schema=c.table_schema AND t.table_name=c.table_name
 WHERE c.table_schema='public' AND c.column_name='id' AND t.table_type='BASE TABLE'
 LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by text, ADD COLUMN IF NOT EXISTS created_by_name text, ADD COLUMN IF NOT EXISTS updated_by text, ADD COLUMN IF NOT EXISTS updated_by_name text, ADD COLUMN IF NOT EXISTS audit_created_at timestamptz, ADD COLUMN IF NOT EXISTS audit_updated_at timestamptz',tab.table_name);
  EXECUTE format('DROP TRIGGER IF EXISTS pms_record_author_trigger ON public.%I',tab.table_name);
  EXECUTE format('CREATE TRIGGER pms_record_author_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pms_record_author()',tab.table_name);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pms_is_attendance(group_row jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN public.pms_extra(group_row)->>'modulo' IS NOT NULL
 THEN public.pms_extra(group_row)->>'modulo'='atendimentos'
 ELSE COALESCE(group_row->>'name','') ~* '(atendimento|urg[eê]ncia|retro|perfura|po[çc]o)' END
 OR COALESCE(public.pms_extra(group_row)->>'controle_pocos','0')='1'
$$;

CREATE OR REPLACE FUNCTION public.move_attendance_record(
 source_id text, source_table text, target_group text, target_parent text DEFAULT NULL,
 well_local text DEFAULT NULL, well_date text DEFAULT NULL, well_execution text DEFAULT 'solicitada'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
 profile public.users%ROWTYPE; source jsonb; origin public.atividades%ROWTYPE; destination public.atividades%ROWTYPE;
 target_item public.items%ROWTYPE; extra jsonb; permissions jsonb; kind text; new_parent text; root_item text;
 descendants text[]; is_well boolean; new_number integer; payload jsonb; old_type text; new_type text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre novamente para mover atendimentos.'; END IF;
 SELECT * INTO profile FROM public.users WHERE id=auth.uid()::text;
 permissions:=public.pms_extra(to_jsonb(profile))->'permissoes'->'modulos'->'atendimentos';
 IF NOT FOUND OR NOT COALESCE((profile.role='admin' OR profile.is_admin IS TRUE OR
   (COALESCE(permissions->>'gerenciar','false')='true') OR
   (COALESCE(permissions->>'editar','false')='true' AND COALESCE(permissions->>'criar','false')='true')),false) THEN
  RAISE EXCEPTION 'Você precisa de permissão para criar e editar atendimentos.';
 END IF;
 IF source_table NOT IN ('items','subitems') THEN RAISE EXCEPTION 'Tipo de lançamento inválido.'; END IF;
 IF source_table='items' THEN SELECT to_jsonb(i) INTO source FROM public.items i WHERE id=source_id FOR UPDATE;
 ELSE SELECT to_jsonb(s) INTO source FROM public.subitems s WHERE id=source_id FOR UPDATE; END IF;
 IF source IS NULL THEN RAISE EXCEPTION 'Lançamento não encontrado.'; END IF;
 SELECT * INTO origin FROM public.atividades WHERE id=source->>'atividade_id';
 SELECT * INTO destination FROM public.atividades WHERE id=target_group FOR UPDATE;
 IF NOT FOUND OR NOT public.pms_is_attendance(to_jsonb(origin)) OR NOT public.pms_is_attendance(to_jsonb(destination)) THEN RAISE EXCEPTION 'Escolha um grupo válido de Atendimentos.'; END IF;
 IF origin.id=target_group THEN RAISE EXCEPTION 'Escolha um grupo diferente do atual.'; END IF;
 extra:=public.pms_extra(source);
 IF extra->>'registro_tipo'='perfurador' THEN RAISE EXCEPTION 'O cadastro de perfurador não é um atendimento.'; END IF;
 is_well:=COALESCE(public.pms_extra(to_jsonb(destination))->>'controle_pocos','0')='1';
 WITH RECURSIVE children AS (
  SELECT id FROM public.subitems WHERE (source_table='items' AND item_id=source_id) OR (source_table='subitems' AND parent_type='subitem' AND parent_id=source_id)
  UNION
  SELECT s.id FROM public.subitems s JOIN children c ON s.parent_id=c.id AND s.parent_type='subitem'
 ) SELECT array_agg(id) INTO descendants FROM children;
 PERFORM id FROM public.subitems WHERE id=ANY(descendants) FOR UPDATE;
 IF is_well AND COALESCE(cardinality(descendants),0)>0 THEN RAISE EXCEPTION 'Para perfuração de poços, mova cada solicitação individualmente, sem sublançamentos.'; END IF;
 new_parent:=NULLIF(target_parent,'');
 IF new_parent IS NOT NULL THEN
  SELECT * INTO target_item FROM public.items WHERE id=new_parent AND atividade_id=target_group;
  IF NOT FOUND THEN RAISE EXCEPTION 'O item de destino não pertence ao grupo escolhido.'; END IF;
  IF is_well AND public.pms_extra(to_jsonb(target_item))->>'registro_tipo' IS DISTINCT FROM 'perfurador' THEN RAISE EXCEPTION 'Escolha um perfurador válido.'; END IF;
 END IF;
 IF is_well THEN
  IF NULLIF(trim(well_local),'') IS NULL OR well_date IS NULL OR well_execution NOT IN ('solicitada','executada') THEN RAISE EXCEPTION 'Informe localidade, data e situação da perfuração.'; END IF;
  PERFORM well_date::date;
  IF new_parent IS NULL THEN
   SELECT id INTO new_parent FROM public.items WHERE atividade_id=target_group AND public.pms_extra(to_jsonb(items))->>'is_placeholder'='1' ORDER BY id LIMIT 1;
   IF new_parent IS NULL THEN
    new_parent:=gen_random_uuid()::text;
    INSERT INTO public.items(id,atividade_id,description,order_num,concluded,extra_fields)
    VALUES(new_parent,target_group,'NÃO INFORMADO',0,0,jsonb_build_object('registro_tipo','perfurador','is_placeholder',1,'tipo_pessoa','pessoa'));
   END IF;
  END IF;
  SELECT COALESCE(max(CASE WHEN public.pms_extra(to_jsonb(s))->>'poco_order' ~ '^\d+$' THEN (public.pms_extra(to_jsonb(s))->>'poco_order')::integer END),-1)+1 INTO new_number
  FROM public.subitems s WHERE atividade_id=target_group AND public.pms_extra(to_jsonb(s))->>'registro_tipo'='poco';
  extra:=extra||jsonb_build_object('registro_tipo','poco','poco_order',new_number,'numero','POÇO '||(new_number+1),'status_perfuracao',well_execution);
  IF NOT (extra ? 'status_pagamento') THEN extra:=extra||jsonb_build_object('status_pagamento','pendente','valor',0,'data_pagamento',NULL); END IF;
  -- Integra imagens já existentes ao formato usado pela tela de poços.
  SELECT extra||jsonb_build_object('imagens',COALESCE(jsonb_agg(url ORDER BY position),'[]'::jsonb)) INTO extra FROM (
   SELECT url,min(position) AS position FROM (
    SELECT value AS url,ordinality AS position FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(extra->'imagens')='array' THEN extra->'imagens' ELSE '[]'::jsonb END) WITH ORDINALITY
    UNION ALL
    SELECT img.imgbb_url,100000+COALESCE(img.order_num,0)::bigint FROM public.entity_images img WHERE img.entity_id=source_id AND img.entity_type=CASE WHEN source_table='items' THEN 'item' ELSE 'subitem' END
   ) photos GROUP BY url
  ) unique_photos;
 END IF;
 kind:=CASE WHEN new_parent IS NULL THEN 'items' ELSE 'subitems' END;
 root_item:=COALESCE(new_parent,source_id);
 extra:=extra||jsonb_build_object('transfer_history',COALESCE(extra->'transfer_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('from',origin.id,'to',target_group,'by',auth.uid(),'at',now())));
 payload:=source||jsonb_build_object('atividade_id',target_group,'extra_fields',extra,'item_id',root_item,'parent_id',new_parent,'parent_type',CASE WHEN new_parent IS NULL THEN NULL ELSE 'item' END);
 IF is_well THEN payload:=payload||jsonb_build_object('description',upper(trim(well_local)),'start_date',well_date,'concluded',CASE WHEN well_execution='executada' THEN 1 ELSE 0 END,'status',CASE WHEN well_execution='executada' THEN 'concluido' ELSE 'pendente' END); END IF;
 PERFORM set_config('pms.preserve_author','on',true);
 IF kind=source_table THEN
  IF kind='items' THEN UPDATE public.items SET atividade_id=target_group,extra_fields=extra WHERE id=source_id;
  ELSE UPDATE public.subitems SET atividade_id=target_group,item_id=root_item,parent_id=new_parent,parent_type='item',extra_fields=extra,
   description=payload->>'description',start_date=payload->>'start_date',concluded=(payload->>'concluded')::integer,status=payload->>'status' WHERE id=source_id; END IF;
 ELSE
  IF kind='items' THEN
   INSERT INTO public.items SELECT (jsonb_populate_record(NULL::public.items,payload)).*;
   UPDATE public.subitems SET atividade_id=target_group,item_id=root_item,
     parent_id=CASE WHEN parent_id=source_id THEN root_item ELSE parent_id END,
     parent_type=CASE WHEN parent_id=source_id THEN 'item' ELSE parent_type END WHERE id=ANY(descendants);
   DELETE FROM public.subitems WHERE id=source_id;
  ELSE
   INSERT INTO public.subitems SELECT (jsonb_populate_record(NULL::public.subitems,payload)).*;
   UPDATE public.subitems SET atividade_id=target_group,item_id=root_item,
    parent_type=CASE WHEN parent_id=source_id THEN 'subitem' ELSE parent_type END WHERE id=ANY(descendants);
   DELETE FROM public.items WHERE id=source_id;
  END IF;
 END IF;
 UPDATE public.subitems SET atividade_id=target_group,item_id=root_item WHERE id=ANY(descendants);
 old_type:=CASE WHEN source_table='items' THEN 'item' ELSE 'subitem' END;
 new_type:=CASE WHEN kind='items' THEN 'item' ELSE 'subitem' END;
 UPDATE public.entity_images SET entity_type=new_type WHERE entity_id=source_id AND entity_type=old_type;
 IF NOT is_well AND public.pms_extra(source)->>'registro_tipo'='poco' THEN
  INSERT INTO public.entity_images(id,entity_type,entity_id,imgbb_url,order_num)
  SELECT gen_random_uuid()::text,new_type,source_id,photo.value,photo.ordinality::integer
  FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(extra->'imagens')='array' THEN extra->'imagens' ELSE '[]'::jsonb END) WITH ORDINALITY AS photo
  WHERE NOT EXISTS(SELECT 1 FROM public.entity_images img WHERE img.entity_id=source_id AND img.imgbb_url=photo.value);
 END IF;
 PERFORM set_config('pms.preserve_author','off',true);
 RETURN jsonb_build_object('id',source_id,'table',kind,'group',target_group);
END $$;
REVOKE ALL ON FUNCTION public.move_attendance_record(text,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.move_attendance_record(text,text,text,text,text,text,text) TO authenticated;
COMMIT;
SELECT 'Autoria e transferências ativadas' AS resultado;
