-- Cache seguro das métricas mensais oficiais de egress do Supabase.
-- A credencial da Management API nunca é salva em tabela comum: permanece
-- criptografada no Supabase Vault e só pode ser lida pela service_role.

create table if not exists public.supabase_egress_cache (
  singleton boolean primary key default true check (singleton is true),
  period_start timestamptz,
  period_end timestamptz,
  summary jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.supabase_egress_cache enable row level security;
revoke all on table public.supabase_egress_cache from public, anon, authenticated;
grant all on table public.supabase_egress_cache to service_role;

create or replace function public.supabase_status_caller_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and (
      lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'camposweb.personal@gmail.com'
      or exists (
        select 1
        from public.supabase_status_access access_row
        where access_row.id = (select auth.uid())::text
          and access_row.allowed is true
      )
    );
$$;

revoke all on function public.supabase_status_caller_allowed() from public, anon;
grant execute on function public.supabase_status_caller_allowed() to authenticated, service_role;

create or replace function public.get_supabase_egress_cache()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.supabase_status_caller_allowed() then
    raise exception 'Seu usuário não possui permissão para visualizar o tráfego do Supabase.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'configured', true,
    'period_start', cache.period_start,
    'period_end', cache.period_end,
    'summary', cache.summary,
    'daily', cache.daily,
    'fetched_at', cache.fetched_at
  )
  into result
  from public.supabase_egress_cache cache
  where cache.singleton is true;

  return coalesce(result, jsonb_build_object('configured', false));
end;
$$;

revoke all on function public.get_supabase_egress_cache() from public, anon;
grant execute on function public.get_supabase_egress_cache() to authenticated, service_role;

create or replace function public.get_supabase_management_token_for_runtime()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
declare
  caller_role text := coalesce((select auth.jwt()) ->> 'role', '');
  management_token text;
begin
  if caller_role <> 'service_role' then
    raise exception 'Operação exclusiva do serviço protegido.' using errcode = '42501';
  end if;

  select secret.decrypted_secret
  into management_token
  from vault.decrypted_secrets secret
  where secret.name = 'gestao_supabase_management_token'
  order by secret.created_at desc
  limit 1;

  return management_token;
end;
$$;

revoke all on function public.get_supabase_management_token_for_runtime() from public, anon, authenticated;
grant execute on function public.get_supabase_management_token_for_runtime() to service_role;

create or replace function public.set_supabase_management_token_for_runtime(token_value text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault, pg_temp
as $$
declare
  caller_role text := coalesce((select auth.jwt()) ->> 'role', '');
  existing_id uuid;
begin
  if caller_role <> 'service_role' then
    raise exception 'Operação exclusiva do serviço protegido.' using errcode = '42501';
  end if;
  if token_value is null or token_value !~ '^sbp_[A-Za-z0-9_-]{20,}$' then
    raise exception 'Token administrativo inválido.' using errcode = '22023';
  end if;

  select secret.id
  into existing_id
  from vault.decrypted_secrets secret
  where secret.name = 'gestao_supabase_management_token'
  order by secret.created_at desc
  limit 1;

  if existing_id is null then
    perform vault.create_secret(
      token_value,
      'gestao_supabase_management_token',
      'Leitura protegida do consumo mensal no painel RCAMPOS'
    );
  else
    perform vault.update_secret(
      existing_id,
      token_value,
      'gestao_supabase_management_token',
      'Leitura protegida do consumo mensal no painel RCAMPOS'
    );
  end if;
end;
$$;

revoke all on function public.set_supabase_management_token_for_runtime(text) from public, anon, authenticated;
grant execute on function public.set_supabase_management_token_for_runtime(text) to service_role;

create or replace function public.save_supabase_egress_cache_for_runtime(
  new_period_start timestamptz,
  new_period_end timestamptz,
  new_summary jsonb,
  new_daily jsonb,
  new_fetched_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  caller_role text := coalesce((select auth.jwt()) ->> 'role', '');
begin
  if caller_role <> 'service_role' then
    raise exception 'Operação exclusiva do serviço protegido.' using errcode = '42501';
  end if;

  insert into public.supabase_egress_cache (
    singleton, period_start, period_end, summary, daily, fetched_at, updated_at
  ) values (
    true, new_period_start, new_period_end,
    coalesce(new_summary, '{}'::jsonb), coalesce(new_daily, '{}'::jsonb),
    new_fetched_at, now()
  )
  on conflict (singleton) do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    summary = excluded.summary,
    daily = excluded.daily,
    fetched_at = excluded.fetched_at,
    updated_at = now();
end;
$$;

revoke all on function public.save_supabase_egress_cache_for_runtime(timestamptz, timestamptz, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.save_supabase_egress_cache_for_runtime(timestamptz, timestamptz, jsonb, jsonb, timestamptz) to service_role;

comment on table public.supabase_egress_cache is
'Cache horário das métricas oficiais de egress; sem credenciais administrativas.';
