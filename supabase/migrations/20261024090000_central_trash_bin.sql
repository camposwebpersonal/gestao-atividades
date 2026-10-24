-- Lixeira central: preserva o registro completo antes de qualquer exclusão.
create table if not exists public.trash_items (
  id text primary key default gen_random_uuid()::text,
  source_table text not null,
  source_id text not null,
  source_label text not null default 'Registro sem título',
  source_activity_id text,
  source_activity_name text,
  source_secretaria_id text,
  source_secretaria_name text,
  record_data jsonb not null,
  batch_id text,
  deleted_by text not null,
  deleted_by_name text,
  deleted_at timestamptz not null default now(),
  constraint trash_items_source_table_check check (source_table ~ '^[a-z][a-z0-9_]*$'),
  constraint trash_items_record_id_check check (record_data ? 'id')
);

create index if not exists trash_items_deleted_at_idx
  on public.trash_items (deleted_at desc);
create index if not exists trash_items_context_idx
  on public.trash_items (source_secretaria_id, source_activity_id, deleted_at desc);
create index if not exists trash_items_deleted_by_idx
  on public.trash_items (deleted_by, deleted_at desc);

alter table public.trash_items enable row level security;

drop policy if exists "trash_insert_own" on public.trash_items;
create policy "trash_insert_own"
on public.trash_items for insert
to authenticated
with check ((select auth.uid())::text = deleted_by);

drop policy if exists "trash_select_own_or_admin" on public.trash_items;
create policy "trash_select_own_or_admin"
on public.trash_items for select
to authenticated
using (
  deleted_by = (select auth.uid())::text
  or exists (
    select 1 from public.users u
    where u.id = (select auth.uid())::text
      and (coalesce(u.is_admin, false) or lower(coalesce(u.role, '')) = 'admin')
  )
);

drop policy if exists "trash_delete_admin" on public.trash_items;
create policy "trash_delete_admin"
on public.trash_items for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())::text
      and (coalesce(u.is_admin, false) or lower(coalesce(u.role, '')) = 'admin')
  )
);

revoke all on table public.trash_items from anon;
grant select, insert, delete on table public.trash_items to authenticated;
grant all on table public.trash_items to service_role;

notify pgrst, 'reload schema';
