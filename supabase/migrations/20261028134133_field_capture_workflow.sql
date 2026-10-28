-- Registro rapido de campo e grupos permanentes de triagem por secretaria.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_field_demand_group(group_row public.atividades)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(group_row.extra_fields ->> 'system_group', '') = 'demandas-gerais-campo'
$$;

REVOKE ALL ON FUNCTION public.is_field_demand_group(public.atividades) FROM PUBLIC, anon, authenticated;

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
      'Entrada permanente para registros fotograficos feitos em campo.',
      'Registre, confira a observacao e mova cada demanda para o grupo correto.',
      target_secretaria,
      (SELECT COALESCE(max(order_num), -1) + 1 FROM public.atividades WHERE demanda_secretaria_id = target_secretaria),
      1, 1, '📍', '#0f766e', 'pendente',
      jsonb_build_object('modulo', 'atendimentos', 'system_group', 'demandas-gerais-campo', 'permanent', true),
      now(), now()
    );
  END IF;

  UPDATE public.secretarias SET demandas_ativa = true WHERE id = target_secretaria;
  RETURN group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_field_demand_group(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_field_demand_group_after_secretaria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.create_field_demand_group(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_field_demand_group_after_secretaria() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_field_demand_group_after_secretaria ON public.secretarias;
CREATE TRIGGER ensure_field_demand_group_after_secretaria
AFTER INSERT ON public.secretarias
FOR EACH ROW EXECUTE FUNCTION public.ensure_field_demand_group_after_secretaria();

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

DROP TRIGGER IF EXISTS protect_field_demand_group ON public.atividades;
CREATE TRIGGER protect_field_demand_group
BEFORE UPDATE OR DELETE ON public.atividades
FOR EACH ROW EXECUTE FUNCTION public.protect_field_demand_group();

CREATE UNIQUE INDEX IF NOT EXISTS atividades_one_field_group_per_secretaria
ON public.atividades (demanda_secretaria_id)
WHERE COALESCE(extra_fields ->> 'system_group', '') = 'demandas-gerais-campo';

DO $$
DECLARE
  secretaria_row record;
BEGIN
  FOR secretaria_row IN SELECT id FROM public.secretarias LOOP
    PERFORM public.create_field_demand_group(secretaria_row.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_field_demand(
  target_secretaria text,
  observation text,
  photo_urls jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  profile public.users%ROWTYPE;
  permissions jsonb := '{}'::jsonb;
  module_permissions jsonb := '{}'::jsonb;
  can_edit boolean := false;
  group_id text;
  item_id text := gen_random_uuid()::text;
  clean_observation text := regexp_replace(trim(COALESCE(observation, '')), '\s+', ' ', 'g');
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
  IF NOT can_edit THEN RAISE EXCEPTION 'Voce nao pode registrar demandas nesta secretaria.' USING ERRCODE = '42501'; END IF;

  SELECT id INTO group_id FROM public.atividades
  WHERE demanda_secretaria_id = target_secretaria
    AND COALESCE(extra_fields ->> 'system_group', '') = 'demandas-gerais-campo'
  LIMIT 1;
  IF group_id IS NULL THEN RAISE EXCEPTION 'O grupo permanente da secretaria ainda nao foi preparado.'; END IF;

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
