-- Mantem a criacao sob demanda com privilegios do proprio usuario e validacao de escopo.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_field_demand_group(target_secretaria text)
RETURNS text
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para registrar a demanda.' USING ERRCODE = '42501';
  END IF;
  IF target_secretaria IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.secretarias WHERE id = target_secretaria
  ) THEN
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

REVOKE ALL ON FUNCTION public.create_field_demand_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_field_demand_group(text) TO authenticated;

ALTER FUNCTION public.create_field_demand(text, text, jsonb) SECURITY INVOKER;

COMMIT;
