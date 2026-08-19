# Correção de segurança — habilitar RLS (Row Level Security) no Supabase

**Problema:** hoje as tabelas do projeto estão sem RLS (ou com política
`FOR ALL TO anon, authenticated USING (true)`). Como a chave `anon` é pública
(está no `login.html`, no `supabase_compat.js` e em qualquer navegador que abre
o app), **qualquer pessoa na internet pode ler e alterar todos os dados**,
inclusive a tabela `users`. Verificado com um `GET` anônimo em
`/rest/v1/users?select=*` — retornou dados reais.

**Correção:** rodar o SQL abaixo no SQL Editor do Supabase. Ele habilita RLS em
todas as tabelas do app e substitui as políticas por acesso apenas para
usuários **autenticados** (`authenticated`); o papel `anon` deixa de ter
qualquer acesso. O `service_role` continua ignorando RLS (uso apenas no
servidor / scripts).

```sql
-- Habilita RLS e cria política "somente autenticados" em todas as tabelas do app.
do $$
declare
  t text;
  app_tables text[] := array[
    'secretarias','atividades','items','subitems','field_templates',
    'responsaveis','entity_images','users','contatos','galeria',
    'chamados','contas','estoque','requisicoes'
  ];
begin
  foreach t in array app_tables loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);

      -- remove políticas antigas (inclusive as que liberavam para anon)
      execute (
        select coalesce(string_agg(format('drop policy %I on public.%I;', policyname, t), ' '), '')
        from pg_policies where schemaname = 'public' and tablename = t
      );

      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        t || '_authenticated_all', t
      );
    end if;
  end loop;
end $$;

-- Garante que o papel anônimo não tenha privilégios de tabela no schema public.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
```

## Verificação depois de rodar

```bash
# Deve retornar 401/permission denied (e NÃO dados):
curl -s -i "https://xwlmpxypjheuhbxyfplo.supabase.co/rest/v1/users?select=*&limit=1" \
  -H "apikey: <CHAVE_ANON>" | head -20
```

Em seguida, abrir o app logado e conferir que a listagem, cadastro e edição
continuam funcionando (o app usa o token do usuário autenticado).

## Observação — restrição por papel (próximo passo)

Estas políticas dão a qualquer usuário autenticado acesso de escrita, que é
exatamente o que o app assume hoje (as regras de "admin/gestor/usuário" só
existem no JavaScript e podem ser burladas por quem tem login). O passo
seguinte recomendado é restringir escrita em `users`, `atividades`, `items` e
`subitems` a administradores, por exemplo:

```sql
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.role = 'admin' or u.is_admin from public.users u where u.id = auth.uid()::text),
    false
  );
$$;

-- exemplo para a tabela users
drop policy if exists users_authenticated_all on public.users;
create policy users_select on public.users for select to authenticated using (true);
create policy users_write  on public.users for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());
```
