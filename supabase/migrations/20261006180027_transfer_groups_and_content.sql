-- Move todos os lancamentos entre grupos ou converte um grupo completo em demanda.
-- A operacao e atomica e exclusiva para administradores autenticados.
CREATE OR REPLACE FUNCTION public.transfer_group_content_admin(
  operation text,
  source_group text,
  target_group text DEFAULT NULL,
  target_secretaria text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
DECLARE
  profile public.users%ROWTYPE;
  source_row public.atividades%ROWTYPE;
  target_row public.atividades%ROWTYPE;
  moved_item_ids text[] := ARRAY[]::text[];
  moved_items integer := 0;
  moved_subitems integer := 0;
  moved_templates integer := 0;
  target_last_order integer := -1;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para transferir os lancamentos.';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id=auth.uid()::text;
  IF NOT FOUND OR NOT COALESCE(profile.role='admin' OR profile.is_admin IS TRUE,false) THEN
    RAISE EXCEPTION 'Somente administradores podem transferir grupos e lancamentos.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pms-transfer-groups'));
  SELECT * INTO source_row FROM public.atividades WHERE id=source_group FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Grupo de origem nao encontrado.'; END IF;

  IF operation='content' THEN
    IF target_group IS NULL OR target_group=source_group THEN
      RAISE EXCEPTION 'Escolha outro grupo como destino.';
    END IF;
    SELECT * INTO target_row FROM public.atividades WHERE id=target_group FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Grupo de destino nao encontrado.'; END IF;

    SELECT COALESCE(array_agg(id),ARRAY[]::text[]),count(*)
      INTO moved_item_ids,moved_items
      FROM public.items WHERE atividade_id=source_group;
    SELECT count(*) INTO moved_subitems
      FROM public.subitems
      WHERE atividade_id=source_group OR item_id=ANY(moved_item_ids);
    SELECT COALESCE(max(order_num),-1) INTO target_last_order
      FROM public.items WHERE atividade_id=target_group;

    -- A mudanca de pasta nao reescreve autoria nem datas dos lancamentos.
    PERFORM set_config('pms.audit_override','on',true);
    WITH ordered AS (
      SELECT id,(row_number() OVER(ORDER BY COALESCE(order_num,0),id)-1)::integer AS pos
      FROM public.items WHERE id=ANY(moved_item_ids)
    )
    UPDATE public.items i
      SET atividade_id=target_group,order_num=target_last_order+1+ordered.pos
      FROM ordered WHERE i.id=ordered.id;
    UPDATE public.subitems
      SET atividade_id=target_group
      WHERE atividade_id=source_group OR item_id=ANY(moved_item_ids);
    UPDATE public.field_templates source_template
      SET atividade_id=target_group
      WHERE source_template.atividade_id=source_group
        AND NOT EXISTS (
          SELECT 1 FROM public.field_templates target_template
          WHERE target_template.atividade_id=target_group
            AND lower(trim(target_template.field_name))=lower(trim(source_template.field_name))
        );
    GET DIAGNOSTICS moved_templates=ROW_COUNT;
    PERFORM set_config('pms.audit_override','off',true);

    -- Os grupos registram a transferencia como ultima edicao; os filhos preservam o historico.
    UPDATE public.atividades SET updated_at=now() WHERE id IN(source_group,target_group);
    RETURN jsonb_build_object(
      'operation','content','source_group',source_group,'target_group',target_group,
      'items',moved_items,'subitems',moved_subitems,'templates',moved_templates
    );
  ELSIF operation='group' THEN
    IF target_secretaria IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.secretarias WHERE id=target_secretaria AND demandas_ativa IS TRUE
    ) THEN
      RAISE EXCEPTION 'Escolha uma secretaria ativa de destino.';
    END IF;
    UPDATE public.atividades
      SET demanda_secretaria_id=target_secretaria,
          order_num=(
            SELECT COALESCE(max(a.order_num),-1)+1 FROM public.atividades a
            WHERE a.demanda_secretaria_id=target_secretaria
              AND public.pms_extra(to_jsonb(a))->>'modulo'='atendimentos'
          ),
          extra_fields=public.pms_extra(to_jsonb(atividades)) || jsonb_build_object('modulo','atendimentos'),
          updated_at=now()
      WHERE id=source_group;
    RETURN jsonb_build_object(
      'operation','group','source_group',source_group,'target_secretaria',target_secretaria,
      'items',(SELECT count(*) FROM public.items WHERE atividade_id=source_group),
      'subitems',(SELECT count(*) FROM public.subitems WHERE atividade_id=source_group)
    );
  END IF;
  RAISE EXCEPTION 'Operacao de transferencia invalida.';
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_group_content_admin(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_group_content_admin(text,text,text,text) TO authenticated;
