-- Organização dos grupos existentes, sem alterar seus itens ou subitens.
BEGIN;
ALTER TABLE public.secretarias ADD COLUMN IF NOT EXISTS demandas_ativa boolean NOT NULL DEFAULT false;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS demanda_secretaria_id text REFERENCES public.secretarias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS atividades_demanda_secretaria_idx ON public.atividades(demanda_secretaria_id,order_num);

-- Marca explicitamente o grupo legado, evitando inferências por substrings
-- (por exemplo, EXPOCOSE contém 'poco', mas pertence a Eventos).
UPDATE public.atividades SET extra_fields=public.pms_extra(to_jsonb(atividades)) || jsonb_build_object('modulo','atendimentos')
WHERE id='AFgFJZv3y6XYr6GOhC2A' AND public.pms_extra(to_jsonb(atividades))->>'modulo' IS NULL;

-- Reutiliza as secretarias institucionais; cria apenas se ainda não existirem.
DO $$
DECLARE agri text; infra text;
BEGIN
 SELECT id INTO agri FROM public.secretarias WHERE upper(trim(name))='AGRICULTURA' ORDER BY id LIMIT 1;
 IF agri IS NULL THEN agri:=gen_random_uuid()::text; INSERT INTO public.secretarias(id,name,demandas_ativa) VALUES(agri,'AGRICULTURA',true); END IF;
 SELECT id INTO infra FROM public.secretarias WHERE upper(trim(name))='INFRAESTRUTURA' ORDER BY id LIMIT 1;
 IF infra IS NULL THEN infra:=gen_random_uuid()::text; INSERT INTO public.secretarias(id,name,demandas_ativa) VALUES(infra,'INFRAESTRUTURA',true); END IF;
 UPDATE public.secretarias SET demandas_ativa=true WHERE id IN (agri,infra) AND NOT demandas_ativa;
 UPDATE public.atividades a SET demanda_secretaria_id=CASE
 WHEN a.id IN ('12aaeaf0-8938-487f-be1a-36cf8b5902b1','5ec63e8d-f61a-4bf6-9f07-a9a63164cc7d','903a4eeb-d042-4f2b-9583-001fd95052ef','dc7a1298-771f-43d7-bf2e-2739200b0e58','2d9f09b1-cd41-4876-a89a-566ec3ee168a','21513756-4b57-479b-95f7-bdc77d113f3a','43078c41-7204-436f-b865-4bdc18a8320c','d00a333b-7cd2-45c7-9633-fa93171f67d6','ebcf2464-6d4c-4247-aadd-9fa19fb352ca','25f4761d-538c-4c43-880d-db7ed74dbf87') THEN agri
 ELSE infra END
 WHERE a.demanda_secretaria_id IS NULL AND a.id IN (
 '12aaeaf0-8938-487f-be1a-36cf8b5902b1','5ec63e8d-f61a-4bf6-9f07-a9a63164cc7d','903a4eeb-d042-4f2b-9583-001fd95052ef','dc7a1298-771f-43d7-bf2e-2739200b0e58','2d9f09b1-cd41-4876-a89a-566ec3ee168a','21513756-4b57-479b-95f7-bdc77d113f3a','43078c41-7204-436f-b865-4bdc18a8320c','d00a333b-7cd2-45c7-9633-fa93171f67d6','ebcf2464-6d4c-4247-aadd-9fa19fb352ca','25f4761d-538c-4c43-880d-db7ed74dbf87',
 'AFgFJZv3y6XYr6GOhC2A','a20ecb4b-2f9e-4a78-b0f7-a5874ce4da84','b427adf5-b381-499a-a478-eb2597b2a4af','800a0ee6-5504-42f0-9fab-dbdb85ee1f4d','b4940086-b62e-4507-bf95-5632daefe05d','6359b98a-181c-48f3-812c-440e70c89200','5b59ed6e-7716-4470-85b7-e41b474eaf8f','f364d931-2465-46a1-aea1-ab61288a3cbc','ba6e4efe-f1b7-4f85-8032-e271622a0770');
END $$;

CREATE OR REPLACE FUNCTION public.organize_demandas(
 operation text, secretaria text DEFAULT NULL, group_id text DEFAULT NULL,
 group_ids text[] DEFAULT NULL, secretaria_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE profile public.users%ROWTYPE; permissions jsonb; can_edit boolean; can_create boolean;
 target text; current_ids text[]; group_row public.atividades%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre novamente para organizar as demandas.'; END IF;
 SELECT * INTO profile FROM public.users WHERE id=auth.uid()::text;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
 permissions:=public.pms_extra(to_jsonb(profile))->'permissoes'->'modulos'->'atendimentos';
 can_edit:=COALESCE(profile.role='admin' OR profile.is_admin IS TRUE OR permissions->>'gerenciar'='true' OR (permissions->>'acesso'='true' AND permissions->>'editar'='true'),false);
 can_create:=COALESCE(profile.role='admin' OR profile.is_admin IS TRUE OR permissions->>'gerenciar'='true' OR (permissions->>'acesso'='true' AND permissions->>'criar'='true'),false);
 IF operation='secretaria' THEN
  IF NOT can_create THEN RAISE EXCEPTION 'Sem permissão para cadastrar secretarias de demandas.'; END IF;
  IF secretaria IS NOT NULL THEN
   UPDATE public.secretarias SET demandas_ativa=true WHERE id=secretaria RETURNING id INTO target;
   IF target IS NULL THEN RAISE EXCEPTION 'Secretaria não encontrada.'; END IF;
  ELSE
   IF nullif(trim(secretaria_name),'') IS NULL OR length(trim(secretaria_name))>120 THEN RAISE EXCEPTION 'Informe um nome de até 120 caracteres.'; END IF;
   PERFORM pg_advisory_xact_lock(hashtext('demandas-secretarias'));
   SELECT id INTO target FROM public.secretarias WHERE lower(trim(name))=lower(trim(secretaria_name)) ORDER BY id LIMIT 1;
   IF target IS NULL THEN
    target:=gen_random_uuid()::text;
    INSERT INTO public.secretarias(id,name,demandas_ativa) VALUES(target,trim(secretaria_name),true);
   ELSE UPDATE public.secretarias SET demandas_ativa=true WHERE id=target; END IF;
  END IF;
  RETURN jsonb_build_object('id',target);
 END IF;
 IF NOT can_edit THEN RAISE EXCEPTION 'Sem permissão para organizar os grupos.'; END IF;
 -- Serializa movimentações e ordenações; cada operação é uma única transação.
 PERFORM pg_advisory_xact_lock(hashtext('demandas-grupos'));
 IF secretaria IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.secretarias WHERE id=secretaria AND demandas_ativa) THEN RAISE EXCEPTION 'Escolha uma secretaria ativa.'; END IF;
 IF operation='move' THEN
  SELECT * INTO group_row FROM public.atividades WHERE id=group_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(public.pms_extra(to_jsonb(group_row))->>'modulo','')<>'atendimentos' THEN RAISE EXCEPTION 'Grupo de demandas não encontrado.'; END IF;
  IF group_row.demanda_secretaria_id IS NOT DISTINCT FROM secretaria THEN RETURN jsonb_build_object('id',group_id); END IF;
  UPDATE public.atividades SET demanda_secretaria_id=secretaria,
   order_num=(SELECT COALESCE(max(order_num),-1)+1 FROM public.atividades WHERE demanda_secretaria_id IS NOT DISTINCT FROM secretaria AND public.pms_extra(to_jsonb(atividades))->>'modulo'='atendimentos')
   WHERE id=group_id;
  RETURN jsonb_build_object('id',group_id);
 ELSIF operation='reorder' THEN
  SELECT array_agg(id ORDER BY id) INTO current_ids FROM public.atividades a WHERE a.demanda_secretaria_id IS NOT DISTINCT FROM secretaria AND public.pms_extra(to_jsonb(a))->>'modulo'='atendimentos';
  IF group_ids IS NULL OR cardinality(group_ids)=0 OR cardinality(group_ids)<>(SELECT count(DISTINCT x) FROM unnest(group_ids) x)
    OR current_ids IS DISTINCT FROM ARRAY(SELECT x FROM unnest(group_ids) x ORDER BY x) THEN
   RAISE EXCEPTION 'A lista mudou. Atualize a página e tente ordenar novamente.';
  END IF;
  UPDATE public.atividades a SET order_num=o.position-1 FROM unnest(group_ids) WITH ORDINALITY AS o(id,position) WHERE a.id=o.id;
  RETURN jsonb_build_object('count',cardinality(group_ids));
 END IF;
 RAISE EXCEPTION 'Operação inválida.';
END $$;
REVOKE ALL ON FUNCTION public.organize_demandas(text,text,text,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organize_demandas(text,text,text,text[],text) TO authenticated;
COMMIT;
