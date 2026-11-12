-- Aplica as políticas por grupo/módulo (fase 2) alterando as políticas existentes
-- (sem apagar nenhuma) e confere tudo na mesma transação: se qualquer verificação
-- falhar, a migração inteira é desfeita automaticamente.

alter policy atividades_logados on public.atividades
  using (id = any((select public.pms_my_group_ids())::text[]) or created_by = (select auth.uid())::text)
  with check (id = any((select public.pms_my_group_ids())::text[]) or created_by = (select auth.uid())::text);

alter policy items_logados on public.items using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy subitems_logados on public.subitems using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy field_templates_logados on public.field_templates using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy contas_logados on public.contas using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy chamados_logados on public.chamados using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy galeria_logados on public.galeria using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy estoque_all on public.estoque using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));
alter policy requisicoes_all on public.requisicoes using (atividade_id = any((select public.pms_my_group_ids())::text[])) with check (atividade_id = any((select public.pms_my_group_ids())::text[]));

alter policy entity_images_logados on public.entity_images
  using ((entity_type = 'activity' and entity_id = any((select public.pms_my_group_ids())::text[]))
      or (entity_type <> 'activity' and (exists (select 1 from public.items i where i.id = entity_id) or exists (select 1 from public.subitems s where s.id = entity_id))))
  with check ((entity_type = 'activity' and entity_id = any((select public.pms_my_group_ids())::text[]))
      or (entity_type <> 'activity' and (exists (select 1 from public.items i where i.id = entity_id) or exists (select 1 from public.subitems s where s.id = entity_id))));

alter policy extintores_all on public.extintores using ((select public.pms_my_module_allows('extintores'))) with check ((select public.pms_my_module_allows('extintores')));
alter policy extintor_abas_all on public.extintor_abas using ((select public.pms_my_module_allows('extintores'))) with check ((select public.pms_my_module_allows('extintores')));

alter policy users_select_logados on public.users using (id = (select auth.uid())::text or (select public.pms_user_is_admin()));

-- ── Verificação automática (desfaz tudo se algo não bater) ──
do $$
declare
  claudia text := (select id from public.users where email ilike 'claudia%' limit 1);
  ricardo text := (select id from public.users where email = 'camposweb.personal@gmail.com' limit 1);
  olavo text := '7b68b9e2-3823-4008-a38e-7ec8aa1d01b7';
  emanuel text := 'b5bc1e68-ce93-4951-837a-1066c44e5bbd';
  total_g bigint := (select count(*) from public.atividades);
  total_u bigint := (select count(*) from public.users);
  total_e bigint := (select count(*) from public.extintores);
  claudia_items bigint := (select count(*) from public.items where atividade_id = '800a0ee6-5504-42f0-9fab-dbdb85ee1f4d');
  g bigint; it bigint; u bigint; e bigint; n bigint;
begin
  perform set_config('pms.whatsapp_off', 'on', true);

  -- Cláudia: só o grupo dela, só a própria linha de usuário, sem extintores
  perform set_config('request.jwt.claims', json_build_object('sub', claudia, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into g from public.atividades; select count(*) into it from public.items;
  select count(*) into u from public.users; select count(*) into e from public.extintores;
  if g <> 1 or it <> claudia_items or u <> 1 or e <> 0 then
    raise exception 'Verificação Cláudia falhou: grupos=% itens=% (esperado %) users=% ext=%', g, it, claudia_items, u, e; end if;
  insert into public.items(id, atividade_id, description, order_num, concluded) values ('rls-verificacao-1', '800a0ee6-5504-42f0-9fab-dbdb85ee1f4d', 'VERIFICAÇÃO', 9999, 0);
  update public.items set description = description where atividade_id <> '800a0ee6-5504-42f0-9fab-dbdb85ee1f4d';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cláudia conseguiu alterar % lançamentos de outros grupos', n; end if;
  execute 'reset role';
  delete from public.items where id = 'rls-verificacao-1';

  -- Ricardo (admin): tudo
  perform set_config('request.jwt.claims', json_build_object('sub', ricardo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into g from public.atividades; select count(*) into u from public.users; select count(*) into e from public.extintores;
  if g <> total_g or u <> total_u or e <> total_e then raise exception 'Verificação admin falhou: grupos=%/% users=%/% ext=%/%', g, total_g, u, total_u, e, total_e; end if;
  execute 'reset role';

  -- Olavo: estoque + cadastros (8 grupos), sem extintores
  perform set_config('request.jwt.claims', json_build_object('sub', olavo, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into g from public.atividades; select count(*) into e from public.extintores;
  if g <> 8 or e <> 0 then raise exception 'Verificação Olavo falhou: grupos=% ext=%', g, e; end if;
  execute 'reset role';

  -- Emanuel: secretarias inteiras + extintores
  perform set_config('request.jwt.claims', json_build_object('sub', emanuel, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into g from public.atividades; select count(*) into e from public.extintores;
  if g < 105 or e <> total_e then raise exception 'Verificação Emanuel falhou: grupos=% ext=%/%', g, e, total_e; end if;
  execute 'reset role';

  -- Sem login: nada
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into g from public.atividades; select count(*) into it from public.items;
  if g <> 0 or it <> 0 then raise exception 'Sem login ainda vê dados: grupos=% itens=%', g, it; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
