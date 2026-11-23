-- LINK PROVISÓRIO DE CONFERÊNCIA (23/11/2026)
-- Qualquer grupo de lançamentos pode gerar um link temporário (somente ver, ou editar — padrão).
-- Quem recebe o link edita os lançamentos e marca cada um como CONFERIDO (ou "Conferir todos").
-- Lançamento conferido não pode mais ser editado pelo link; quando todos estão conferidos o link expira.
-- Gerar um novo link zera a conferência anterior do grupo.
--
-- Segurança: a tabela share_links só é visível para usuários logados com acesso ao grupo (RLS).
-- O visitante NÃO acessa tabela nenhuma: usa apenas as funções pms_share_* (security definer),
-- que validam o token (aleatório, 32 caracteres) e só tocam nos lançamentos DAQUELE grupo.

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  atividade_id text not null,
  modo text not null default 'editar' check (modo in ('editar', 'ver')),
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  revoked_at timestamptz,
  last_visit_at timestamptz,
  visits integer not null default 0
);
create index if not exists share_links_grupo on public.share_links (atividade_id);
alter table public.share_links enable row level security;
drop policy if exists share_links_logados on public.share_links;
create policy share_links_logados on public.share_links for select to authenticated
  using (public.pms_user_is_admin() or atividade_id = any(public.pms_my_group_ids()));

-- autoria: as funções do link informam o nome de quem conferiu ("Fulano · link de conferência")
create or replace function public.pms_record_author()
 returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
DECLARE actor text := auth.uid()::text; actor_name text;
BEGIN
 IF COALESCE(current_setting('pms.audit_override',true),'')='on' THEN RETURN NEW; END IF;
 IF actor IS NOT NULL THEN
  SELECT COALESCE(NULLIF(u.display_name,''), CASE WHEN lower(a.email)='camposweb.personal@gmail.com' THEN 'RCAMPOS' ELSE split_part(a.email,'@',1) END)
  INTO actor_name FROM auth.users a LEFT JOIN public.users u ON u.id=a.id::text WHERE a.id::text=actor;
 ELSIF COALESCE(current_setting('pms.actor_name',true),'')<>'' THEN
  actor:=NULL; actor_name:=current_setting('pms.actor_name',true);
 ELSIF COALESCE(auth.jwt()->>'role','')='service_role' AND NEW.updated_by IS NOT NULL THEN
  actor:=NEW.updated_by; actor_name:=COALESCE(NULLIF(NEW.updated_by_name,''),'Sistema / manutenção');
 ELSE
  actor:=NULL; actor_name:='Sistema / manutenção';
 END IF;
 IF TG_OP='INSERT' THEN
  IF COALESCE(current_setting('pms.preserve_author',true),'')<>'on' THEN
   NEW.created_by:=actor; NEW.created_by_name:=actor_name; NEW.audit_created_at:=now();
  END IF;
 ELSE
  NEW.created_by:=OLD.created_by; NEW.created_by_name:=OLD.created_by_name; NEW.audit_created_at:=OLD.audit_created_at;
 END IF;
 NEW.updated_by:=actor; NEW.updated_by_name:=actor_name; NEW.audit_updated_at:=now();
 RETURN NEW;
END $function$;

-- chave interna do sistema? (espelha js/record-fields.js — nunca vai para o visitante nem é gravada por ele)
create or replace function public.pms_chave_sistema(k text) returns boolean language sql immutable as $$
  select k = any(array['id','extra_fields','created_at','updated_at','created_by','created_by_name','updated_by','updated_by_name',
    'audit_created_at','audit_updated_at','sync_at','old_id','parent_id','parent_type','is_placeholder','show_conclusion_date',
    'show_external_geolocation','geo_location','latitude','longitude','accuracy','captured_at','verba','verba_obs','verbas_list',
    'origem_verba','documentacao','documentacao_obs','licitacao','licitacao_obs','urgencia','prioritario','solicitante',
    'registro_tipo','modulo','controle_pocos','transfer_history','status_list','status_options','table_columns','exibir_valores',
    'imagens','contatos_responsavel','poco_order','licitacao_group_id','fornecedor_numero','cadastro_id','cadastro_grupo',
    'contas_local_id','seguro_local_id','agrupador','leite_entregas','leite_precos','leite_cotas','controle_leite',
    'produtores_grupo','cadastro_leite','conferencia','share_token','mulher_token'])
    or k like 'item\_show\_%' or k like 'import\_%' or k like 'pipa\_%' or k like 'geo\_%' or k like '\_%'
$$;

-- só os campos que a pessoa vê (texto/número/data), sem objetos internos
create or replace function public.pms_campos_visiveis(ef jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    from jsonb_each(public.pms_jsonobj(ef)) e
   where not public.pms_chave_sistema(e.key) and (jsonb_typeof(e.value) in ('string','number','boolean')
         or (jsonb_typeof(e.value) = 'array' and not exists (select 1 from jsonb_array_elements(e.value) x where jsonb_typeof(x) <> 'string')))
$$;

-- link aberto?
create or replace function public.pms_share_link(p_token text) returns public.share_links
language sql stable security definer set search_path = public as $$
  select * from public.share_links where token = p_token limit 1
$$;
revoke all on function public.pms_share_link(text) from public, anon, authenticated;

-- conta quantos lançamentos ainda faltam conferir no link
create or replace function public.pms_share_restantes(p_link uuid, p_group text) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*) from items i where i.atividade_id = p_group and coalesce(public.pms_jsonobj(i.extra_fields)->'conferencia'->>'link','') <> p_link::text)
       + (select count(*) from subitems s where s.atividade_id = p_group and coalesce(public.pms_jsonobj(s.extra_fields)->'conferencia'->>'link','') <> p_link::text)
$$;
revoke all on function public.pms_share_restantes(uuid, text) from public, anon, authenticated;

-- 1) CRIAR (usuário logado com acesso ao grupo): revoga links abertos, zera a conferência e devolve o token
create or replace function public.pms_share_create(p_group text, p_modo text default 'editar') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_name text; v_token text; v_link public.share_links;
begin
  if auth.uid() is null then raise exception 'Faça login para criar o link.'; end if;
  if not (public.pms_user_is_admin() or p_group = any(public.pms_my_group_ids())) then
    raise exception 'Você não tem acesso a este grupo.';
  end if;
  if not exists (select 1 from atividades where id = p_group) then raise exception 'Grupo não encontrado.'; end if;
  select coalesce(nullif(u.display_name, ''), split_part(a.email, '@', 1)) into v_name
    from auth.users a left join public.users u on u.id = a.id::text where a.id = auth.uid();
  perform set_config('pms.whatsapp_off', 'on', true);
  update share_links set revoked_at = now() where atividade_id = p_group and revoked_at is null and finished_at is null;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into share_links (token, atividade_id, modo, created_by, created_by_name)
    values (v_token, p_group, case when p_modo = 'ver' then 'ver' else 'editar' end, auth.uid()::text, v_name)
    returning * into v_link;
  -- novo link = nova conferência: tira o selo dos lançamentos e do grupo
  update items set extra_fields = public.pms_jsonobj(extra_fields) - 'conferencia'
   where atividade_id = p_group and public.pms_jsonobj(extra_fields) ? 'conferencia';
  update subitems set extra_fields = public.pms_jsonobj(extra_fields) - 'conferencia'
   where atividade_id = p_group and public.pms_jsonobj(extra_fields) ? 'conferencia';
  update atividades set extra_fields = (public.pms_jsonobj(extra_fields) - 'conferencia_concluida')
         || jsonb_build_object('conferencia_link', v_link.id, 'conferencia_desde', now(), 'conferencia_modo', v_link.modo)
   where id = p_group;
  return jsonb_build_object('token', v_token, 'id', v_link.id, 'modo', v_link.modo);
end $$;
revoke all on function public.pms_share_create(text, text) from public, anon;
grant execute on function public.pms_share_create(text, text) to authenticated;

-- 2) REVOGAR (logado)
create or replace function public.pms_share_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_group text;
begin
  select atividade_id into v_group from share_links where id = p_id;
  if v_group is null then raise exception 'Link não encontrado.'; end if;
  if auth.uid() is null or not (public.pms_user_is_admin() or v_group = any(public.pms_my_group_ids())) then
    raise exception 'Você não tem acesso a este grupo.';
  end if;
  update share_links set revoked_at = now() where id = p_id and revoked_at is null;
end $$;
revoke all on function public.pms_share_revoke(uuid) from public, anon;
grant execute on function public.pms_share_revoke(uuid) to authenticated;

-- 3) ABRIR (visitante): grupo, campos e lançamentos — ou o motivo de não abrir
create or replace function public.pms_share_open(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.share_links; g record; v_rest integer;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  select id, name into g from atividades where id = l.atividade_id;
  if l.revoked_at is not null then return jsonb_build_object('ok', false, 'motivo', 'revogado', 'grupo', g.name); end if;
  if l.finished_at is not null then return jsonb_build_object('ok', false, 'motivo', 'concluido', 'grupo', g.name, 'em', l.finished_at); end if;
  update share_links set visits = visits + 1, last_visit_at = now() where id = l.id;
  v_rest := public.pms_share_restantes(l.id, l.atividade_id);
  return jsonb_build_object('ok', true, 'modo', l.modo, 'link', l.id, 'criado_por', l.created_by_name, 'criado_em', l.created_at,
    'grupo', jsonb_build_object('id', g.id, 'nome', g.name), 'restantes', v_rest,
    'campos', coalesce((select jsonb_agg(jsonb_build_object('nome', t.field_name, 'tipo', t.field_type, 'opcoes', t.options, 'escopo', t.scope) order by t.order_num, t.field_name)
                          from field_templates t where t.atividade_id = l.atividade_id), '[]'::jsonb),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'tipo', 'item', 'descricao', i.description, 'observacao', i.observacao,
                          'status', i.status, 'concluido', coalesce(i.concluded, 0) = 1, 'ordem', i.order_num,
                          'campos', public.pms_campos_visiveis(i.extra_fields),
                          'conferido', public.pms_jsonobj(i.extra_fields)->'conferencia'->>'link' = l.id::text,
                          'conferido_por', public.pms_jsonobj(i.extra_fields)->'conferencia'->>'por') order by i.order_num, i.created_at)
                        from items i where i.atividade_id = l.atividade_id), '[]'::jsonb),
    'subitens', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', 'sub', 'item_id', s.item_id, 'pai', s.parent_id, 'pai_tipo', s.parent_type,
                          'descricao', s.description, 'observacao', s.observacao, 'status', s.status, 'concluido', coalesce(s.concluded, 0) = 1, 'ordem', s.order_num,
                          'campos', public.pms_campos_visiveis(s.extra_fields),
                          'conferido', public.pms_jsonobj(s.extra_fields)->'conferencia'->>'link' = l.id::text,
                          'conferido_por', public.pms_jsonobj(s.extra_fields)->'conferencia'->>'por') order by s.order_num, s.created_at)
                        from subitems s where s.atividade_id = l.atividade_id), '[]'::jsonb));
end $$;
revoke all on function public.pms_share_open(text) from public;
grant execute on function public.pms_share_open(text) to anon, authenticated;

-- finaliza o link se tudo foi conferido
create or replace function public.pms_share_fechar_se_pronto(l public.share_links, p_nome text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_rest integer;
begin
  v_rest := public.pms_share_restantes(l.id, l.atividade_id);
  if v_rest = 0 then
    update share_links set finished_at = now() where id = l.id and finished_at is null;
    update atividades set extra_fields = public.pms_jsonobj(extra_fields)
           || jsonb_build_object('conferencia_concluida', jsonb_build_object('link', l.id, 'em', now(), 'por', p_nome))
     where id = l.atividade_id;
  end if;
  return v_rest;
end $$;
revoke all on function public.pms_share_fechar_se_pronto(public.share_links, text) from public, anon, authenticated;

-- 4) SALVAR um lançamento (visitante, link de edição). Conferido = trava aquele lançamento.
create or replace function public.pms_share_save(p_token text, p_tipo text, p_id text, p_dados jsonb, p_conferido boolean, p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; v_ef jsonb; v_campos jsonb := '{}'::jsonb; e record; v_nome text; v_rest integer; v_found boolean;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is null or l.revoked_at is not null or l.finished_at is not null then raise exception 'Este link expirou.'; end if;
  if l.modo <> 'editar' then raise exception 'Este link é somente para visualizar.'; end if;
  v_nome := left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60) || ' · link de conferência';
  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.actor_name', v_nome, true);
  if p_tipo = 'item' then select public.pms_jsonobj(extra_fields), true into v_ef, v_found from items where id = p_id and atividade_id = l.atividade_id;
  else select public.pms_jsonobj(extra_fields), true into v_ef, v_found from subitems where id = p_id and atividade_id = l.atividade_id; end if;
  if not coalesce(v_found, false) then raise exception 'Lançamento não pertence a este link.'; end if;
  if v_ef->'conferencia'->>'link' = l.id::text then raise exception 'Este lançamento já foi conferido e não pode mais ser alterado.'; end if;
  -- só campos visíveis (nunca chaves internas), texto curto
  for e in select * from jsonb_each(coalesce(p_dados->'campos', '{}'::jsonb)) loop
    if not public.pms_chave_sistema(e.key) and length(e.key) <= 120 and (jsonb_typeof(e.value) in ('string','number','boolean')
       or (jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) <= 50 and not exists (select 1 from jsonb_array_elements(e.value) x where jsonb_typeof(x) <> 'string'))) then
      v_campos := v_campos || jsonb_build_object(e.key, case when jsonb_typeof(e.value) = 'string' then to_jsonb(left(e.value #>> '{}', 4000)) else e.value end);
    end if;
  end loop;
  v_ef := v_ef || v_campos;
  if p_conferido then v_ef := v_ef || jsonb_build_object('conferencia', jsonb_build_object('link', l.id, 'em', now(), 'por', left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60))); end if;
  if p_tipo = 'item' then
    update items set extra_fields = v_ef,
      description = coalesce(nullif(left(p_dados->>'descricao', 500), ''), description),
      observacao = case when p_dados ? 'observacao' then left(p_dados->>'observacao', 4000) else observacao end
     where id = p_id;
  else
    update subitems set extra_fields = v_ef,
      description = coalesce(nullif(left(p_dados->>'descricao', 500), ''), description),
      observacao = case when p_dados ? 'observacao' then left(p_dados->>'observacao', 4000) else observacao end
     where id = p_id;
  end if;
  v_rest := public.pms_share_fechar_se_pronto(l, left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60));
  return jsonb_build_object('ok', true, 'restantes', v_rest, 'finalizado', v_rest = 0);
end $$;
revoke all on function public.pms_share_save(text, text, text, jsonb, boolean, text) from public;
grant execute on function public.pms_share_save(text, text, text, jsonb, boolean, text) to anon, authenticated;

-- 5) CONFERIR TODOS (visitante, link de edição) — expira o link
create or replace function public.pms_share_conferir_todos(p_token text, p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.share_links; v_nome text; v_conf jsonb; v_rest integer;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is null or l.revoked_at is not null or l.finished_at is not null then raise exception 'Este link expirou.'; end if;
  if l.modo <> 'editar' then raise exception 'Este link é somente para visualizar.'; end if;
  v_nome := left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60);
  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.actor_name', v_nome || ' · link de conferência', true);
  v_conf := jsonb_build_object('conferencia', jsonb_build_object('link', l.id, 'em', now(), 'por', v_nome));
  update items set extra_fields = public.pms_jsonobj(extra_fields) || v_conf
   where atividade_id = l.atividade_id and coalesce(public.pms_jsonobj(extra_fields)->'conferencia'->>'link', '') <> l.id::text;
  update subitems set extra_fields = public.pms_jsonobj(extra_fields) || v_conf
   where atividade_id = l.atividade_id and coalesce(public.pms_jsonobj(extra_fields)->'conferencia'->>'link', '') <> l.id::text;
  v_rest := public.pms_share_fechar_se_pronto(l, v_nome);
  return jsonb_build_object('ok', true, 'restantes', v_rest, 'finalizado', v_rest = 0);
end $$;
revoke all on function public.pms_share_conferir_todos(text, text) from public;
grant execute on function public.pms_share_conferir_todos(text, text) to anon, authenticated;
