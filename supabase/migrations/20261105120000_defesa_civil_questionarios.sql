-- Questionários de Proteção e Defesa Civil (Levantamento ICM do TCE-PE).
-- Uma linha por questionário/ano; cada salvamento registra quem preencheu, data e hora.
create table if not exists public.defesa_civil_questionarios (
  id text primary key,
  questionario text not null,
  ano integer not null,
  respostas jsonb not null default '{}'::jsonb,
  preenchido_por uuid,
  preenchido_por_nome text,
  preenchido_em timestamptz,
  historico jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.defesa_civil_questionarios enable row level security;

drop policy if exists dcq_select on public.defesa_civil_questionarios;
create policy dcq_select on public.defesa_civil_questionarios for select to authenticated using (true);
drop policy if exists dcq_insert on public.defesa_civil_questionarios;
create policy dcq_insert on public.defesa_civil_questionarios for insert to authenticated with check ((select auth.uid()) = preenchido_por);
drop policy if exists dcq_update on public.defesa_civil_questionarios;
create policy dcq_update on public.defesa_civil_questionarios for update to authenticated using (true) with check ((select auth.uid()) = preenchido_por);

grant select, insert, update on public.defesa_civil_questionarios to authenticated;
