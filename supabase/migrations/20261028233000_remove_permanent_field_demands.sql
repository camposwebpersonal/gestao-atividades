-- Demandas de campo continuam identificadas para a captura rapida, mas deixam de ser permanentes.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Retira a protecao que impedia renomear, transferir ou excluir o grupo.
DROP TRIGGER IF EXISTS protect_field_demand_group ON public.atividades;
DROP FUNCTION IF EXISTS public.protect_field_demand_group();

-- Novas secretarias nao recebem mais um grupo vazio automaticamente.
-- O grupo e criado sob demanda, somente na primeira captura de campo.
DROP TRIGGER IF EXISTS ensure_field_demand_group_after_secretaria ON public.secretarias;
DROP FUNCTION IF EXISTS public.ensure_field_demand_group_after_secretaria();

-- Remove somente os grupos vazios cujas secretarias ja nao existem.
DELETE FROM public.atividades AS activity
WHERE COALESCE(activity.extra_fields ->> 'system_group', '') = 'demandas-gerais-campo'
  AND NOT EXISTS (
    SELECT 1 FROM public.secretarias AS secretaria
    WHERE secretaria.id = activity.demanda_secretaria_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.items AS item
    WHERE item.atividade_id = activity.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.subitems AS subitem
    WHERE subitem.atividade_id = activity.id
  );

-- Nenhum grupo existente conserva a antiga marca de permanencia.
UPDATE public.atividades
SET extra_fields = COALESCE(extra_fields, '{}'::jsonb) - 'permanent',
    updated_at = now()
WHERE COALESCE(extra_fields ->> 'system_group', '') = 'demandas-gerais-campo';

CREATE OR REPLACE FUNCTION public.create_field_demand_group(target_secretaria text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  group_id text;
BEGIN
  IF target_secretaria IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.secretarias WHERE id = target_secretaria
  ) THEN
    RAISE EXCEPTION 'Secretaria nao encontrada.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('demandas-gerais-campo:' || target_secretaria));
  SELECT id INTO group_id
  FROM public.atividades
  WHERE demanda_secretaria_id = target_secretaria
    AND COALESCE(extra_fields ->> 'system_group', '') = 'demandas-gerais-campo'
  ORDER BY created_at, id
  LIMIT 1;

  IF group_id IS NULL THEN
    group_id := gen_random_uuid()::text;
    INSERT INTO public.atividades (
      id, name, description, observacoes, demanda_secretaria_id, order_num,
      controle_pendencias, show_stats, icon, color, status, extra_fields,
      created_at, updated_at
    ) VALUES (
      group_id,
      'Demandas Gerais de Campo',
      'Entrada para registros fotograficos feitos em campo.',
      'Registre, confira a observacao e mova cada demanda para o grupo correto.',
      target_secretaria,
      (SELECT COALESCE(max(order_num), -1) + 1 FROM public.atividades WHERE demanda_secretaria_id = target_secretaria),
      1, 1, '📍', '#0f766e', 'pendente',
      jsonb_build_object('modulo', 'atendimentos', 'system_group', 'demandas-gerais-campo'),
      now(), now()
    );
  END IF;

  UPDATE public.secretarias SET demandas_ativa = true WHERE id = target_secretaria;
  RETURN group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_field_demand_group(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_field_demand(
  target_secretaria text,
  observation text,
  photo_urls jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  profile public.users%ROWTYPE;
  permissions jsonb := '{}'::jsonb;
  module_permissions jsonb := '{}'::jsonb;
  can_edit boolean := false;
  group_id text;
  item_id text := gen_random_uuid()::text;
  clean_observation text := regexp_replace(trim(COALESCE(observation, '')), '[[:space:]]+', ' ', 'g');
  photo_count integer := COALESCE(jsonb_array_length(photo_urls), 0);
  photo_url text;
  photo_index integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre novamente para registrar a demanda.'; END IF;
  IF clean_observation = '' OR length(clean_observation) > 4000 THEN
    RAISE EXCEPTION 'Informe uma observacao de ate 4000 caracteres.';
  END IF;
  IF jsonb_typeof(photo_urls) <> 'array' OR photo_count < 1 OR photo_count > 20 THEN
    RAISE EXCEPTION 'Envie de 1 a 20 fotos.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.secretarias WHERE id = target_secretaria) THEN
    RAISE EXCEPTION 'Secretaria nao encontrada.';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = auth.uid()::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil nao encontrado.'; END IF;
  permissions := COALESCE(public.pms_extra(to_jsonb(profile)) -> 'permissoes', '{}'::jsonb);
  module_permissions := COALESCE(permissions -> 'modulos' -> 'atendimentos', '{}'::jsonb);
  can_edit := COALESCE(profile.role = 'admin' OR profile.is_admin IS TRUE, false)
    OR (
      COALESCE(module_permissions ->> 'acesso', 'false') = 'true'
      AND (
        COALESCE(module_permissions ->> 'gerenciar', 'false') = 'true'
        OR COALESCE(module_permissions ->> 'editar', 'false') = 'true'
        OR COALESCE(module_permissions ->> 'criar', 'false') = 'true'
      )
      AND (
        COALESCE(module_permissions ->> 'escopo_configurado', 'false') <> 'true'
        OR COALESCE(module_permissions #>> '{todos_grupos,gerenciar}', 'false') = 'true'
        OR COALESCE(module_permissions #>> ARRAY['secretarias', target_secretaria, 'gerenciar'], 'false') = 'true'
      )
    );
  IF NOT can_edit THEN
    RAISE EXCEPTION 'Voce nao pode registrar demandas nesta secretaria.' USING ERRCODE = '42501';
  END IF;

  -- Se o usuario excluiu o grupo anterior, uma nova captura cria outro grupo normal e excluivel.
  group_id := public.create_field_demand_group(target_secretaria);

  FOR photo_url IN SELECT jsonb_array_elements_text(photo_urls) LOOP
    IF photo_url !~ '^https://.+' OR length(photo_url) > 4096 THEN
      RAISE EXCEPTION 'Uma das fotos possui endereco invalido.';
    END IF;
  END LOOP;

  INSERT INTO public.items (
    id, atividade_id, description, observacao, secretaria_id, start_date,
    item_icon, item_color, order_num, concluded, status, cover_url,
    extra_fields, created_at, updated_at
  ) VALUES (
    item_id, group_id, left(clean_observation, 140), clean_observation,
    target_secretaria, current_date::text, '📷', '#0f766e',
    (SELECT COALESCE(max(order_num), -1) + 1 FROM public.items WHERE atividade_id = group_id),
    0, 'pendente', photo_urls ->> 0,
    jsonb_build_object('registro_tipo', 'demanda_campo', 'origem', 'captura_rapida', 'captured_at', now()),
    now(), now()
  );

  FOR photo_url IN SELECT jsonb_array_elements_text(photo_urls) LOOP
    photo_index := photo_index + 1;
    INSERT INTO public.entity_images (
      id, entity_type, entity_id, is_representative, imgbb_url, title, obs, order_num, created_at
    ) VALUES (
      gen_random_uuid()::text, 'item', item_id, photo_index = 1, photo_url,
      'Registro de campo ' || photo_index, clean_observation, photo_index - 1, now()
    );
  END LOOP;

  RETURN jsonb_build_object('group_id', group_id, 'item_id', item_id, 'photos', photo_count);
END;
$$;

REVOKE ALL ON FUNCTION public.create_field_demand(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_field_demand(text, text, jsonb) TO authenticated;

COMMIT;
