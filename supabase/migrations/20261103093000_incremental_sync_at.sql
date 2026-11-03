-- Sincronização incremental (reduz o tráfego de saída do Supabase).
-- Cada tabela sincronizada pelo app ganha a coluna sync_at, marcada SEMPRE pelo
-- banco em todo INSERT/UPDATE (independente de updated_at, que tem exceções de
-- auditoria e pode vir do relógio do aparelho na criação). O app baixa só as linhas
-- com sync_at mais recente que a última sincronização.
create or replace function public.pms_touch_sync_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.sync_at := clock_timestamp();
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'atividades','items','subitems','field_templates','secretarias','responsaveis','users',
    'supabase_status_access','contatos','contas','estoque','requisicoes','trash_items',
    'app_settings','water_collection_points','entity_images','galeria','chamados',
    'distribuicao','extintores','extintor_abas','bulk_entry_drafts'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'tabela % não existe, ignorada', t;
      continue;
    end if;
    execute format('alter table public.%I add column if not exists sync_at timestamptz not null default clock_timestamp()', t);
    execute format('create index if not exists %I on public.%I (sync_at)', t || '_sync_at_idx', t);
    execute format('drop trigger if exists pms_sync_at on public.%I', t);
    execute format('create trigger pms_sync_at before insert or update on public.%I for each row execute function public.pms_touch_sync_at()', t);
  end loop;
end
$$;
