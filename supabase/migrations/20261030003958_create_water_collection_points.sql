create table if not exists public.water_collection_points (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(btrim(name)) between 2 and 180),
  locality text,
  reference text,
  description text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy double precision,
  maps_url text,
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists water_collection_points_name_idx on public.water_collection_points (name);
create index if not exists water_collection_points_location_idx on public.water_collection_points (latitude, longitude) where latitude is not null and longitude is not null;

alter table public.water_collection_points enable row level security;
grant select, insert, update, delete on public.water_collection_points to authenticated;
revoke all on public.water_collection_points from anon;

create policy water_points_read_authenticated on public.water_collection_points for select to authenticated using ((select auth.uid()) is not null);
create policy water_points_insert_authenticated on public.water_collection_points for insert to authenticated with check ((select auth.uid()) is not null and created_by = (select auth.uid()));
create policy water_points_update_authenticated on public.water_collection_points for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy water_points_delete_authenticated on public.water_collection_points for delete to authenticated using ((select auth.uid()) is not null);

create or replace function public.touch_water_collection_point()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists water_collection_points_touch on public.water_collection_points;
create trigger water_collection_points_touch before update on public.water_collection_points for each row execute function public.touch_water_collection_point();

comment on table public.water_collection_points is 'Locais de captação de água para orientação de caminhões-pipa.';
