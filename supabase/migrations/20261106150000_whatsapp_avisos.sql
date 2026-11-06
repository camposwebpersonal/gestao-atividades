-- Avisos por WhatsApp de lançamentos novos e atualizados.
-- Fluxo: gatilho em items/subitems → fila (whatsapp_outbox) → a cada 30 s o pg_cron chama a
-- função whatsapp-notify, que agrupa, monta a mensagem e envia a cada destinatário.

create table if not exists public.whatsapp_recipients (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null check (telefone ~ '^[0-9]{12,13}$'),
  escopo text not null default 'todos' check (escopo in ('todos', 'secretaria', 'grupo')),
  escopo_id text,
  eventos text not null default 'todos' check (eventos in ('todos', 'novos')),
  ativo boolean not null default true,
  apikey text,
  apikey_ok boolean generated always as (coalesce(length(trim(apikey)), 0) > 0) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (escopo = 'todos' or escopo_id is not null)
);

create table if not exists public.whatsapp_outbox (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  atividade_id text,
  operacao text not null,
  antes jsonb,
  autor text,
  created_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'ignorado', 'erro')),
  processed_at timestamptz,
  detalhe text
);
create index if not exists whatsapp_outbox_pending_idx on public.whatsapp_outbox (status, created_at);

create table if not exists public.whatsapp_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  recipient_id uuid,
  nome text,
  telefone text,
  titulo text,
  mensagem text,
  status text not null,
  detalhe text,
  outbox_ids bigint[]
);
create index if not exists whatsapp_log_created_idx on public.whatsapp_log (created_at desc);

-- Somente administradores veem e mudam a configuração. A chave (apikey) nunca volta ao navegador.
create or replace function public.pms_user_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = (select auth.uid())::text and (u.role = 'admin' or u.is_admin is true));
$$;
revoke all on function public.pms_user_is_admin() from public, anon;
grant execute on function public.pms_user_is_admin() to authenticated;

alter table public.whatsapp_recipients enable row level security;
alter table public.whatsapp_outbox enable row level security;
alter table public.whatsapp_log enable row level security;
drop policy if exists whatsapp_recipients_admin on public.whatsapp_recipients;
create policy whatsapp_recipients_admin on public.whatsapp_recipients for all to authenticated
  using ((select public.pms_user_is_admin())) with check ((select public.pms_user_is_admin()));
drop policy if exists whatsapp_log_admin on public.whatsapp_log;
create policy whatsapp_log_admin on public.whatsapp_log for select to authenticated using ((select public.pms_user_is_admin()));
drop policy if exists whatsapp_outbox_admin on public.whatsapp_outbox;
create policy whatsapp_outbox_admin on public.whatsapp_outbox for select to authenticated using ((select public.pms_user_is_admin()));

revoke all on public.whatsapp_recipients, public.whatsapp_outbox, public.whatsapp_log from anon, authenticated;
grant select (id, nome, telefone, escopo, escopo_id, eventos, ativo, apikey_ok, created_at, updated_at) on public.whatsapp_recipients to authenticated;
grant insert (nome, telefone, escopo, escopo_id, eventos, ativo, apikey) on public.whatsapp_recipients to authenticated;
grant update (nome, telefone, escopo, escopo_id, eventos, ativo, apikey, updated_at) on public.whatsapp_recipients to authenticated;
grant delete on public.whatsapp_recipients to authenticated;
grant select on public.whatsapp_log, public.whatsapp_outbox to authenticated;

-- Campos que não contam como "mudança" (ordem, sincronização, autoria, imagens).
create or replace function public.pms_whatsapp_snapshot(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select (row_data - array['updated_at','sync_at','order_num','updated_by','updated_by_name','audit_updated_at','audit_created_at',
                           'created_by','created_by_name','created_at','auto_concluded','cover_url','resp_url','extra_fields'])
         || jsonb_build_object('extra', public.pms_extra(row_data) - array['transfer_history','table_columns','status_list','status_options','old_id']);
$$;

create or replace function public.pms_whatsapp_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  novo jsonb := to_jsonb(new);
  grupo text;
begin
  if coalesce(current_setting('pms.whatsapp_off', true), '') = 'on' then return new; end if;
  if not exists (select 1 from public.whatsapp_recipients where ativo) then return new; end if;
  if tg_op = 'UPDATE' and public.pms_whatsapp_snapshot(to_jsonb(old)) = public.pms_whatsapp_snapshot(novo) then return new; end if;
  grupo := coalesce(novo->>'atividade_id', (select i.atividade_id from public.items i where i.id = novo->>'item_id'));
  insert into public.whatsapp_outbox (tabela, registro_id, atividade_id, operacao, antes, autor)
  values (tg_table_name, novo->>'id', grupo, lower(tg_op), case when tg_op = 'UPDATE' then to_jsonb(old) end, novo->>'updated_by_name');
  return new;
exception when others then
  return new; -- aviso nunca impede o lançamento de ser salvo
end;
$$;

drop trigger if exists pms_whatsapp_items on public.items;
create trigger pms_whatsapp_items after insert or update on public.items for each row execute function public.pms_whatsapp_enqueue();
drop trigger if exists pms_whatsapp_subitems on public.subitems;
create trigger pms_whatsapp_subitems after insert or update on public.subitems for each row execute function public.pms_whatsapp_enqueue();

-- Segredo que autoriza o pg_cron a chamar a função (guardado no Vault, nunca no código).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'whatsapp_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'whatsapp_cron_secret', 'Autoriza o pg_cron a chamar whatsapp-notify');
  end if;
end $$;

create or replace function public.pms_whatsapp_check_secret(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'whatsapp_cron_secret' and decrypted_secret = candidate);
$$;
revoke all on function public.pms_whatsapp_check_secret(text) from public, anon, authenticated;
grant execute on function public.pms_whatsapp_check_secret(text) to service_role;

create or replace function public.pms_whatsapp_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.whatsapp_outbox where status = 'pendente') then
    perform net.http_post(
      url := 'https://xwlmpxypjheuhbxyfplo.supabase.co/functions/v1/whatsapp-notify',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_cron_secret')),
      body := '{"action":"process"}'::jsonb,
      timeout_milliseconds := 55000);
  end if;
end;
$$;
revoke all on function public.pms_whatsapp_tick() from public, anon, authenticated;

select cron.unschedule('whatsapp-avisos') where exists (select 1 from cron.job where jobname = 'whatsapp-avisos');
select cron.schedule('whatsapp-avisos', '30 seconds', 'select public.pms_whatsapp_tick()');

-- Teste inicial: só o número do Ricardo recebe (chave da CallMeBot informada depois pelo painel).
insert into public.whatsapp_recipients (nome, telefone, escopo, eventos)
select 'Ricardo (teste)', '5587974005690', 'todos', 'todos'
where not exists (select 1 from public.whatsapp_recipients where telefone = '5587974005690');
