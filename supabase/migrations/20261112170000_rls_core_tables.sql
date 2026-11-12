-- Proteção por linha (RLS) nas tabelas principais.
-- Antes: 12 tabelas sem RLS e 4 com política aberta para anon — qualquer pessoa com a chave
-- pública do site lia e alterava dados sem login. Agora:
--   • sem login (anon): nada;
--   • logado (authenticated): mesmo acesso que o site já usava;
--   • public.users: todos os logados leem; só administradores criam, alteram ou excluem
--     (impede alguém se promover a admin pela API).
-- Funções de borda usam service_role e não são afetadas.
do $$
declare t text;
begin
  foreach t in array array['atividades','chamados','contas','contatos','entity_images','field_templates',
                           'galeria','items','responsaveis','secretarias','subitems'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_logados', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t||'_logados', t);
  end loop;
end $$;

alter table public.users enable row level security;
drop policy if exists users_select_logados on public.users;
drop policy if exists users_write_admin on public.users;
create policy users_select_logados on public.users for select to authenticated using (true);
create policy users_insert_admin on public.users for insert to authenticated with check ((select public.pms_user_is_admin()));
create policy users_update_admin on public.users for update to authenticated using ((select public.pms_user_is_admin())) with check ((select public.pms_user_is_admin()));
create policy users_delete_admin on public.users for delete to authenticated using ((select public.pms_user_is_admin()));

-- Políticas que ainda aceitavam anon passam a exigir login.
alter policy estoque_all on public.estoque to authenticated;
alter policy extintor_abas_all on public.extintor_abas to authenticated;
alter policy extintores_all on public.extintores to authenticated;
alter policy requisicoes_all on public.requisicoes to authenticated;
