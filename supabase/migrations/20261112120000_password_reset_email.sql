-- Redefinição de senha por e-mail (sem "criar acesso").
-- O login usa e-mails sintéticos (usuario@pms.sertania.pe.gov.br), então o reset nativo do
-- Supabase não alcança ninguém. Aqui a função password-reset envia um link de uso único para o
-- e-mail de contato cadastrado em Usuários e acessos (public.users.email_contato).
--
-- Tokens: só o hash SHA-256 fica no banco; validade de 30 min; uso único.
-- SMTP: servidor/usuário/remetente em mail_settings (admin); a senha do SMTP fica no Vault
-- e só a função (service_role) consegue lê-la.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  token_hash text not null unique,
  email_to text not null,
  requested_by text,            -- 'self' ou o id do administrador que enviou
  ip text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  used_at timestamptz
);
create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens (user_id, created_at desc);
alter table public.password_reset_tokens enable row level security;
-- sem políticas: somente service_role (função) acessa.

create table if not exists public.mail_settings (
  id smallint primary key default 1 check (id = 1),
  smtp_host text not null default 'smtp.gmail.com',
  smtp_port integer not null default 465,
  smtp_user text,
  from_email text,
  from_name text not null default 'Prefeitura de Sertânia · Gestão',
  site_url text not null default 'https://camposwebpersonal.github.io/gestao-atividades/',
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.mail_settings (id) values (1) on conflict (id) do nothing;
alter table public.mail_settings enable row level security;
drop policy if exists mail_settings_admin on public.mail_settings;
create policy mail_settings_admin on public.mail_settings for all to authenticated
  using ((select public.pms_user_is_admin())) with check ((select public.pms_user_is_admin()));

-- Grava a senha do SMTP no Vault (somente administrador). Nunca é devolvida ao navegador.
create or replace function public.pms_set_smtp_password(p_password text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if not public.pms_user_is_admin() then raise exception 'Somente administradores.'; end if;
  if coalesce(length(p_password), 0) < 4 then raise exception 'Senha do e-mail inválida.'; end if;
  select id into sid from vault.secrets where name = 'smtp_password';
  if sid is null then perform vault.create_secret(p_password, 'smtp_password', 'Senha do SMTP para e-mails de redefinição de senha');
  else perform vault.update_secret(sid, p_password); end if;
  update public.mail_settings set updated_at = now(), updated_by = (select auth.uid())::text where id = 1;
  return true;
end $$;
revoke all on function public.pms_set_smtp_password(text) from public, anon;
grant execute on function public.pms_set_smtp_password(text) to authenticated;

-- Indica se já existe senha gravada (sem revelar nada).
create or replace function public.pms_smtp_password_set() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pms_user_is_admin() and exists (select 1 from vault.secrets where name = 'smtp_password');
$$;
revoke all on function public.pms_smtp_password_set() from public, anon;
grant execute on function public.pms_smtp_password_set() to authenticated;

-- Leitura da senha: só a função de borda (service_role).
create or replace function public.pms_smtp_password() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'smtp_password' limit 1;
$$;
revoke all on function public.pms_smtp_password() from public, anon, authenticated;
grant execute on function public.pms_smtp_password() to service_role;
