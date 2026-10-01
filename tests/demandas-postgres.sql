BEGIN;

-- Dados temporários: toda a sessão termina em rollback.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM public.users WHERE role='admin' ORDER BY id LIMIT 1),'role','authenticated')::text,true);
DO $$
DECLARE created text; result jsonb; n integer; blocked boolean; current_unassigned text[];
BEGIN
 result:=public.organize_demandas('secretaria',secretaria_name=>'__QA Demandas rollback');created:=result->>'id';
 IF created IS NULL THEN RAISE EXCEPTION 'Cadastro falhou'; END IF;
 result:=public.organize_demandas('secretaria',secretaria_name=>'__QA Demandas rollback');
 IF result->>'id'<>created THEN RAISE EXCEPTION 'Secretaria duplicada'; END IF;
 INSERT INTO public.atividades(id,name,order_num,extra_fields,demanda_secretaria_id) VALUES
 ('__qa_demand_a','Grupo A',0,'{"modulo":"atendimentos","custom":"preserve"}',created),
 ('__qa_demand_b','Grupo B',1,'{"modulo":"atendimentos"}',created);
 INSERT INTO public.items(id,atividade_id,description) VALUES('__qa_demand_item','__qa_demand_a','Preservar lançamento');
 PERFORM public.organize_demandas('reorder',secretaria=>created,group_ids=>ARRAY['__qa_demand_b','__qa_demand_a']);
 IF (SELECT order_num FROM public.atividades WHERE id='__qa_demand_b')<>0 THEN RAISE EXCEPTION 'Ordem não salva'; END IF;
 blocked:=false;
 BEGIN PERFORM public.organize_demandas('reorder',secretaria=>created,group_ids=>ARRAY['__qa_demand_a','__qa_demand_a']); EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicação de IDs aceita'; END IF;
 blocked:=false;
 BEGIN PERFORM public.organize_demandas('reorder',secretaria=>created,group_ids=>ARRAY['__qa_demand_a']); EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Lista incompleta aceita'; END IF;
 PERFORM public.organize_demandas('move',secretaria=>'CudV3PMNdr8JXBjJXVt7',group_id=>'__qa_demand_a');
 IF (SELECT atividade_id FROM public.items WHERE id='__qa_demand_item')<>'__qa_demand_a' THEN RAISE EXCEPTION 'Lançamento alterado'; END IF;
 IF (SELECT extra_fields->>'custom' FROM public.atividades WHERE id='__qa_demand_a')<>'preserve' THEN RAISE EXCEPTION 'Dados apagados'; END IF;
 -- Um grupo de Eventos cujo nome contém 'poco' não entra na ordenação.
 INSERT INTO public.atividades(id,name,order_num,extra_fields) VALUES('__qa_expocose','EXPOCOSE teste',0,'{}');
 SELECT array_agg(id ORDER BY order_num,id) INTO current_unassigned FROM public.atividades a WHERE demanda_secretaria_id IS NULL AND public.pms_extra(to_jsonb(a))->>'modulo'='atendimentos';
 IF current_unassigned IS NOT NULL THEN PERFORM public.organize_demandas('reorder',group_ids=>current_unassigned); END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
 blocked:=false;
 BEGIN PERFORM public.organize_demandas('move',secretaria=>created,group_id=>'__qa_demand_a'); EXCEPTION WHEN others THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Aceitou usuário sem sessão'; END IF;
END $$;
SELECT 'PASS: cadastro sem duplicação, ordenação, integridade da lista, transferência e sessão' AS test;
ROLLBACK;
