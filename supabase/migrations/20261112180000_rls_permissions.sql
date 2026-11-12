-- Fase 2 da proteção: o banco confere as MESMAS permissões que o site (js/access-scope.js).
-- Cada usuário só recebe/altera grupos (atividades), lançamentos, subitens, campos, imagens,
-- contas, estoque e requisições dos grupos liberados para ele. Administrador continua vendo tudo.
-- Bônus: quem tem acesso restrito baixa só os próprios dados (site mais leve).
--
-- Espelhos fiéis do JavaScript:
--   pms_group_module   ↔ _md.modFor (js/modulos.js: extra.modulo, flags, palavras do nome)
--   pms_perm_allows    ↔ permissionAllows
--   pms_module_allows  ↔ modulePermission
--   pms_group_allows   ↔ groupPermission
-- Ao mudar a regra no JS, mudar aqui também (teste: tests/rls-parity.test.mjs).

-- extra_fields às vezes está gravado como texto JSON dentro do jsonb.
create or replace function public.pms_jsonobj(x jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare r jsonb;
begin
  if x is null then return '{}'::jsonb; end if;
  if jsonb_typeof(x) = 'object' then return x; end if;
  if jsonb_typeof(x) = 'string' then
    begin r := nullif(x #>> '{}', '')::jsonb; exception when others then return '{}'::jsonb; end;
    if jsonb_typeof(r) = 'object' then return r; end if;
  end if;
  return '{}'::jsonb;
end $$;

create or replace function public.pms_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select lower(translate(coalesce(t,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuucccnn'));
$$;

create or replace function public.pms_group_module(p_name text, p_description text, p_extra jsonb,
  p_estoque integer, p_contas integer, p_distribuicao integer) returns text
language plpgsql immutable set search_path = '' as $$
declare e jsonb := public.pms_jsonobj(p_extra); n text; m record;
  is1 constant text[] := array['1','true'];
begin
  if coalesce(e->>'modulo','') <> '' then return e->>'modulo'; end if;
  if coalesce(p_estoque::text, e->>'controle_estoque') = any(is1) or (e->>'controle_estoque_modelo') = any(is1) then return 'estoque'; end if;
  if coalesce(p_contas::text, e->>'controle_contas') = any(is1) then return 'contas'; end if;
  if coalesce(p_distribuicao::text, e->>'controle_distribuicao') = any(is1) then return 'distribuicao'; end if;
  n := public.pms_norm(coalesce(nullif(p_name,''), nullif(p_description,''), ''));
  -- mesma ordem de MODULOS e mesmas palavras de NOME_MODULO (palavras com acento nunca casam,
  -- exatamente como no JS, que compara o nome sem acento com a palavra como está escrita)
  for m in select * from (values
    (1,'eventos',array['expocose','expo','seminário','seminario','agenda','evento','eventos','festa','palestra']),
    (2,'projetos',array['projetos','projeto']),
    (3,'obras',array['cisterna','cisternas','barreiro','barreiros','barragem','barragens','infraestrutura','pontos de cisterna','demandas de barreiros','obras']),
    (4,'frota',array['veiculo','veículos','frota','ipva','seguro dos veiculos','seguro dos veículos']),
    (5,'atendimentos',array['urgencia','urgência','atendimento','atendimentos','ouvidoria','serviços de urgencia','servicos de urgencia','retro','perfuracao','perfuração','poco','poço','pocos','poços']),
    (6,'rh',array['rh','empregos','vereadores','bcc s','bcc','comissionados','contratos','igespe','genesis','vigia','vigias']),
    (7,'cadastros',array['associações','associacoes','lideranças','liderancas','lideres','cadastro']),
    (8,'contas',array['controle de contas','contas','seguro','seguros']),
    (9,'distribuicao',array['distribuição','distribuicao','distribuicao de leite','leite']),
    (10,'estoque',array['estoque','controle de estoque','secretaria de saude','secretaria de saúde','farmacia','farmácia','insumos']),
    (11,'extintores',array['extintor','extintores','combate a incendio','combate a incêndio']),
    (12,'alugueis',array['aluguel','alugueis','aluguéis']),
    (13,'mulher',array['rede de assistencia','rede de assistência','protecao da mulher','proteção da mulher','mulher','atendimento mulher']),
    (14,'agenda_prefeita',array['agenda da prefeita','prefeita','compromisso da prefeita','agenda prefeitura'])
  ) as t(ord, id, keys) order by ord loop
    if exists (select 1 from unnest(m.keys) k where position(k in n) > 0) then return m.id; end if;
  end loop;
  return 'atividades';
end $$;

create or replace function public.pms_perm_allows(entry jsonb, action text) returns boolean
language sql immutable set search_path = '' as $$
  select case when entry is null or jsonb_typeof(entry) <> 'object' then false
    when action = 'acesso' then entry->'acesso' = 'true'::jsonb or entry->'gerenciar' = 'true'::jsonb
    else entry->'gerenciar' = 'true'::jsonb end;
$$;

create or replace function public.pms_module_allows(perms jsonb, module text, action text) returns boolean
language sql immutable set search_path = '' as $$
  select case when perms->'modulos'->module is null or jsonb_typeof(perms->'modulos'->module) <> 'object' then false
    when action = 'acesso' then perms->'modulos'->module->'acesso' = 'true'::jsonb or perms->'modulos'->module->'gerenciar' = 'true'::jsonb
    else perms->'modulos'->module->'gerenciar' = 'true'::jsonb or perms->'modulos'->module->'editar' = 'true'::jsonb or perms->'modulos'->module->'criar' = 'true'::jsonb end;
$$;

create or replace function public.pms_group_allows(perms jsonb, module text, group_id text, secretaria_id text, action text) returns boolean
language sql immutable set search_path = '' as $$
  select public.pms_module_allows(perms, module, action) and (
    perms->'modulos'->module->'escopo_configurado' is distinct from 'true'::jsonb
    or public.pms_perm_allows(perms->'modulos'->module->'todos_grupos', action)
    or public.pms_perm_allows(perms->'modulos'->module->'grupos'->group_id, action)
    or (module = 'atendimentos' and secretaria_id is not null and public.pms_perm_allows(perms->'modulos'->module->'secretarias'->secretaria_id, action))
  );
$$;

-- Perfil do usuário logado (definer: lê a própria linha sem depender das políticas).
create or replace function public.pms_my_perms() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(public.pms_jsonobj(u.extra_fields)->'permissoes', '{}'::jsonb)
  from public.users u where u.id = (select auth.uid())::text;
$$;

-- Ids dos grupos que o usuário logado pode acessar (uma vez por consulta).
create or replace function public.pms_my_group_ids() returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare perms jsonb; uid text := (select auth.uid())::text;
begin
  if uid is null then return array[]::text[]; end if;
  if public.pms_user_is_admin() then return (select coalesce(array_agg(a.id), array[]::text[]) from public.atividades a); end if;
  perms := coalesce(public.pms_my_perms(), '{}'::jsonb);
  return (select coalesce(array_agg(a.id), array[]::text[]) from public.atividades a
    where a.created_by = uid
       or public.pms_group_allows(perms,
            public.pms_group_module(a.name, a.description, a.extra_fields, a.controle_estoque, a.controle_contas, a.controle_distribuicao),
            a.id, a.demanda_secretaria_id, 'acesso'));
end $$;

create or replace function public.pms_my_module_allows(module text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pms_user_is_admin() or public.pms_module_allows(coalesce(public.pms_my_perms(), '{}'::jsonb), module, 'acesso');
$$;

revoke all on function public.pms_my_perms() from public, anon;
revoke all on function public.pms_my_group_ids() from public, anon;
revoke all on function public.pms_my_module_allows(text) from public, anon;
grant execute on function public.pms_my_perms(), public.pms_my_group_ids(), public.pms_my_module_allows(text) to authenticated;

-- As políticas que usam estas funções estão em 20261112180500_rls_permissions_policies.sql
-- (aplicadas com ALTER POLICY e verificação automática na mesma transação).

-- Diretório sem dados sensíveis (nome, login e vínculo), para mostrar autores e responsáveis.
create or replace function public.pms_users_directory()
returns table(id text, display_name text, email text, role text, setor_id text, responsavel_id text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.display_name, u.email, u.role, u.setor_id, u.responsavel_id
  from public.users u where (select auth.uid()) is not null order by u.display_name;
$$;
revoke all on function public.pms_users_directory() from public, anon;
grant execute on function public.pms_users_directory() to authenticated;
