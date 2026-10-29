-- Painel seguro de saúde e consumo do Supabase.
-- RCAMPOS possui acesso permanente. Outros usuários dependem de autorização
-- explícita nesta tabela, que somente RCAMPOS pode alterar.

create table if not exists public.supabase_status_access (
  id text primary key references public.users(id) on delete cascade,
  allowed boolean not null default false,
  granted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supabase_status_access enable row level security;

revoke all on table public.supabase_status_access from public, anon;
grant select, insert, update, delete on table public.supabase_status_access to authenticated;
grant all on table public.supabase_status_access to service_role;

drop policy if exists supabase_status_access_read on public.supabase_status_access;
create policy supabase_status_access_read
on public.supabase_status_access
for select
to authenticated
using (
  id = (select auth.uid())::text
  or lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com'
);

drop policy if exists supabase_status_access_manage_rcampos on public.supabase_status_access;
drop policy if exists supabase_status_access_insert_rcampos on public.supabase_status_access;
create policy supabase_status_access_insert_rcampos
on public.supabase_status_access
for insert
to authenticated
with check (
  lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com'
  and granted_by = (select auth.uid())
);

drop policy if exists supabase_status_access_update_rcampos on public.supabase_status_access;
create policy supabase_status_access_update_rcampos
on public.supabase_status_access
for update
to authenticated
using (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com')
with check (
  lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com'
  and granted_by = (select auth.uid())
);

drop policy if exists supabase_status_access_delete_rcampos on public.supabase_status_access;
create policy supabase_status_access_delete_rcampos
on public.supabase_status_access
for delete
to authenticated
using (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com');

create or replace function public.get_supabase_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, storage, pg_temp
as $$
declare
  caller_id text := (select auth.uid())::text;
  caller_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  has_access boolean := false;
  database_bytes bigint := 0;
  storage_bytes bigint := 0;
  storage_files bigint := 0;
  image_bytes bigint := 0;
  image_files bigint := 0;
begin
  if caller_id is null or caller_id = '' then
    raise exception 'Autenticação necessária para consultar o status.' using errcode = '42501';
  end if;

  has_access := caller_email = 'camposweb.personal@gmail.com'
    or exists (
      select 1
      from public.supabase_status_access access_row
      where access_row.id = caller_id and access_row.allowed is true
    );

  if not has_access then
    raise exception 'Seu usuário não possui permissão para visualizar o status do Supabase.' using errcode = '42501';
  end if;

  select pg_database_size(current_database()) into database_bytes;

  select
    coalesce(sum(nullif(objects.metadata ->> 'size', '')::bigint), 0),
    count(*)
  into storage_bytes, storage_files
  from storage.objects objects;

  select
    coalesce(sum(nullif(objects.metadata ->> 'size', '')::bigint), 0),
    count(*)
  into image_bytes, image_files
  from storage.objects objects
  where objects.bucket_id = 'gestao-imagens';

  return jsonb_build_object(
    'sampled_at', clock_timestamp(),
    'project_ref', 'xwlmpxypjheuhbxyfplo',
    'region', 'ca-central-1',
    'plan', 'free',
    'database_bytes', database_bytes,
    'database_limit_bytes', 500000000,
    'storage_bytes', storage_bytes,
    'storage_limit_bytes', 1000000000,
    'storage_files', storage_files,
    'image_storage_bytes', image_bytes,
    'image_storage_files', image_files,
    'uncached_egress_limit_bytes', 5000000000,
    'cached_egress_limit_bytes', 5000000000,
    'egress_usage_available', false,
    'database_status', 'online',
    'storage_status', 'online'
  );
end;
$$;

revoke all on function public.get_supabase_status() from public, anon;
grant execute on function public.get_supabase_status() to authenticated;
grant execute on function public.get_supabase_status() to service_role;

comment on function public.get_supabase_status() is
'Retorna métricas agregadas do projeto somente para RCAMPOS ou usuários explicitamente autorizados.';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'supabase_status_access'
  ) then
    alter publication supabase_realtime add table public.supabase_status_access;
  end if;
end;
$$;
