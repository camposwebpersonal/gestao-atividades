-- LINKS PROVISÓRIOS v2 (23/11/2026, pedido do usuário):
--  • link para o GRUPO inteiro, para UM lançamento (item + subitens) ou UM subitem (+ descendentes);
--  • validade opcional (1 h, 2 h, 1 dia, 2 dias…; "sem prazo" = expira só quando tudo for conferido);
--  • PIN de 4 dígitos OPCIONAL (desligado por padrão), guardado só como hash bcrypt; 8 erros bloqueiam o link;
--  • Secretaria da Mulher: link/QR da ficha (somente leitura) com a mesma validade e PIN opcionais.
-- O visitante continua sem acesso a tabela nenhuma: só às funções abaixo, que validam token, prazo, PIN e escopo.

alter table public.share_links add column if not exists alvo_tipo text not null default 'grupo';
alter table public.share_links add column if not exists alvo_id text;
alter table public.share_links add column if not exists alvo_nome text;
alter table public.share_links add column if not exists expires_at timestamptz;
alter table public.share_links add column if not exists pin_hash text;
alter table public.share_links add column if not exists pin_falhas integer not null default 0;
do $$ begin
  alter table public.share_links add constraint share_links_alvo_chk check (alvo_tipo in ('grupo','item','sub','mulher'));
exception when duplicate_object then null; end $$;
alter table public.share_links drop constraint if exists share_links_modo_check;
alter table public.share_links add constraint share_links_modo_check check (modo in ('editar','ver'));

-- registros alcançados pelo link: tipo ('item'|'sub') + id
create or replace function public.pms_share_escopo(l public.share_links) returns table(tipo text, id text)
language sql stable security definer set search_path = public as $$
  with recursive subs as (
    select s.id from subitems s where l.alvo_tipo = 'sub' and s.id = l.alvo_id and s.atividade_id = l.atividade_id
    union all
    select s.id from subitems s join subs on s.parent_id = subs.id and s.parent_type = 'subitem'
  )
  select 'item', i.id from items i where i.atividade_id = l.atividade_id and (l.alvo_tipo = 'grupo' or (l.alvo_tipo = 'item' and i.id = l.alvo_id))
  union all
  select 'sub', s.id from subitems s where s.atividade_id = l.atividade_id and (l.alvo_tipo = 'grupo' or (l.alvo_tipo = 'item' and s.item_id = l.alvo_id))
  union all
  select 'sub', id from subs
$$;
revoke all on function public.pms_share_escopo(public.share_links) from public, anon, authenticated;

create or replace function public.pms_share_restantes(l public.share_links) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.pms_share_escopo(l) e
   where coalesce((select public.pms_jsonobj(coalesce(i.extra_fields, s.extra_fields))->'conferencia'->>'link'
                     from (select 1) x left join items i on e.tipo = 'item' and i.id = e.id left join subitems s on e.tipo = 'sub' and s.id = e.id), '') <> l.id::text
$$;
revoke all on function public.pms_share_restantes(public.share_links) from public, anon, authenticated;

-- motivo para NÃO abrir (null = pode abrir). Confere o PIN e conta erros (8 erros = link bloqueado).
create or replace function public.pms_share_barreira(l public.share_links, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if l.id is null then return 'invalido'; end if;
  if l.revoked_at is not null then return case when l.pin_falhas >= 8 then 'bloqueado' else 'revogado' end; end if;
  if l.finished_at is not null then return 'concluido'; end if;
  if l.expires_at is not null and l.expires_at <= now() then return 'expirado'; end if;
  if l.pin_hash is not null then
    if coalesce(p_pin, '') = '' then return 'pin'; end if;
    if crypt(p_pin, l.pin_hash) <> l.pin_hash then
      update share_links set pin_falhas = pin_falhas + 1, revoked_at = case when pin_falhas + 1 >= 8 then now() else revoked_at end where id = l.id;
      return case when l.pin_falhas + 1 >= 8 then 'bloqueado' else 'pin_errado' end;
    end if;
    if l.pin_falhas > 0 then update share_links set pin_falhas = 0 where id = l.id; end if;
  end if;
  return null;
end $$;
revoke all on function public.pms_share_barreira(public.share_links, text) from public, anon, authenticated;

-- CRIAR (logado com acesso ao grupo)
drop function if exists public.pms_share_create(text, text);
create or replace function public.pms_share_create(p_group text, p_modo text default 'editar', p_alvo_tipo text default 'grupo',
  p_alvo_id text default null, p_horas integer default null, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_name text; v_token text; v_link public.share_links; v_alvo_nome text; v_tipo text := coalesce(nullif(p_alvo_tipo, ''), 'grupo');
begin
  if auth.uid() is null then raise exception 'Faça login para criar o link.'; end if;
  if not (public.pms_user_is_admin() or p_group = any(public.pms_my_group_ids())) then raise exception 'Você não tem acesso a este grupo.'; end if;
  if not exists (select 1 from atividades where id = p_group) then raise exception 'Grupo não encontrado.'; end if;
  if v_tipo not in ('grupo','item','sub','mulher') then raise exception 'Tipo de link inválido.'; end if;
  if v_tipo in ('item','mulher') then select description into v_alvo_nome from items where id = p_alvo_id and atividade_id = p_group;
  elsif v_tipo = 'sub' then select description into v_alvo_nome from subitems where id = p_alvo_id and atividade_id = p_group; end if;
  if v_tipo <> 'grupo' and v_alvo_nome is null then raise exception 'Lançamento não encontrado neste grupo.'; end if;
  if p_pin is not null and p_pin !~ '^\d{4}$' then raise exception 'O PIN precisa ter 4 números.'; end if;
  if p_horas is not null and (p_horas < 1 or p_horas > 24 * 365) then raise exception 'Validade inválida.'; end if;
  select coalesce(nullif(u.display_name, ''), split_part(a.email, '@', 1)) into v_name from auth.users a left join public.users u on u.id = a.id::text where a.id = auth.uid();
  perform set_config('pms.whatsapp_off', 'on', true);
  -- um link aberto por alvo de conferência (o novo substitui o anterior); fichas da mulher podem ter vários
  if v_tipo <> 'mulher' then
    update share_links set revoked_at = now() where atividade_id = p_group and alvo_tipo = v_tipo and coalesce(alvo_id, '') = coalesce(p_alvo_id, '') and revoked_at is null and finished_at is null;
  end if;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into share_links (token, atividade_id, modo, created_by, created_by_name, alvo_tipo, alvo_id, alvo_nome, expires_at, pin_hash)
    values (v_token, p_group, case when v_tipo = 'mulher' or p_modo = 'ver' then 'ver' else 'editar' end, auth.uid()::text, v_name, v_tipo, p_alvo_id, v_alvo_nome,
            case when p_horas is null then null else now() + make_interval(hours => p_horas) end,
            case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end)
    returning * into v_link;
  if v_tipo <> 'mulher' then
    -- nova conferência: tira o selo dos lançamentos alcançados
    update items i set extra_fields = public.pms_jsonobj(i.extra_fields) - 'conferencia'
     where i.id in (select e.id from public.pms_share_escopo(v_link) e where e.tipo = 'item') and public.pms_jsonobj(i.extra_fields) ? 'conferencia';
    update subitems s set extra_fields = public.pms_jsonobj(s.extra_fields) - 'conferencia'
     where s.id in (select e.id from public.pms_share_escopo(v_link) e where e.tipo = 'sub') and public.pms_jsonobj(s.extra_fields) ? 'conferencia';
    if v_tipo = 'grupo' then
      update atividades set extra_fields = (public.pms_jsonobj(extra_fields) - 'conferencia_concluida')
             || jsonb_build_object('conferencia_link', v_link.id, 'conferencia_desde', now(), 'conferencia_modo', v_link.modo)
       where id = p_group;
    end if;
  end if;
  return jsonb_build_object('token', v_token, 'id', v_link.id, 'modo', v_link.modo, 'expira', v_link.expires_at, 'pin', v_link.pin_hash is not null, 'alvo', v_tipo);
end $$;
revoke all on function public.pms_share_create(text, text, text, text, integer, text) from public, anon;
grant execute on function public.pms_share_create(text, text, text, text, integer, text) to authenticated;

create or replace function public.pms_share_fechar_se_pronto(l public.share_links, p_nome text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_rest integer;
begin
  v_rest := public.pms_share_restantes(l);
  if v_rest = 0 then
    update share_links set finished_at = now() where id = l.id and finished_at is null;
    if l.alvo_tipo = 'grupo' then
      update atividades set extra_fields = public.pms_jsonobj(extra_fields)
             || jsonb_build_object('conferencia_concluida', jsonb_build_object('link', l.id, 'em', now(), 'por', p_nome))
       where id = l.atividade_id;
    end if;
  end if;
  return v_rest;
end $$;
revoke all on function public.pms_share_fechar_se_pronto(public.share_links, text) from public, anon, authenticated;

-- ABRIR (visitante)
drop function if exists public.pms_share_open(text);
create or replace function public.pms_share_open(p_token text, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.share_links; g record; v_motivo text;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is not null and l.alvo_tipo = 'mulher' then l := null; end if;
  select id, name into g from atividades where id = l.atividade_id;
  v_motivo := public.pms_share_barreira(l, p_pin);
  if v_motivo is not null then return jsonb_build_object('ok', false, 'motivo', v_motivo, 'grupo', g.name, 'em', coalesce(l.finished_at, l.expires_at)); end if;
  update share_links set visits = visits + 1, last_visit_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'modo', l.modo, 'link', l.id, 'criado_por', l.created_by_name, 'criado_em', l.created_at, 'expira', l.expires_at,
    'alvo', l.alvo_tipo, 'alvo_nome', l.alvo_nome,
    'grupo', jsonb_build_object('id', g.id, 'nome', g.name), 'restantes', public.pms_share_restantes(l),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('nome', t.field_name, 'tipo', t.field_type, 'opcoes', t.options, 'escopo', t.scope) order by t.order_num, t.field_name)
                          from field_templates t where t.atividade_id = l.atividade_id), '[]'::jsonb),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'tipo', 'item', 'descricao', i.description, 'observacao', i.observacao,
                          'status', i.status, 'concluido', coalesce(i.concluded, 0) = 1, 'ordem', i.order_num,
                          'campos', public.pms_campos_visiveis(i.extra_fields),
                          'conferido', public.pms_jsonobj(i.extra_fields)->'conferencia'->>'link' = l.id::text,
                          'conferido_por', public.pms_jsonobj(i.extra_fields)->'conferencia'->>'por') order by i.order_num, i.created_at)
                        from items i where i.id in (select e.id from public.pms_share_escopo(l) e where e.tipo = 'item')), '[]'::jsonb),
    'subitens', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', 'sub', 'item_id', s.item_id, 'pai', s.parent_id, 'pai_tipo', s.parent_type,
                          'descricao', s.description, 'observacao', s.observacao, 'status', s.status, 'concluido', coalesce(s.concluded, 0) = 1, 'ordem', s.order_num,
                          'campos', public.pms_campos_visiveis(s.extra_fields),
                          'conferido', public.pms_jsonobj(s.extra_fields)->'conferencia'->>'link' = l.id::text,
                          'conferido_por', public.pms_jsonobj(s.extra_fields)->'conferencia'->>'por') order by s.order_num, s.created_at)
                        from subitems s where s.id in (select e.id from public.pms_share_escopo(l) e where e.tipo = 'sub')), '[]'::jsonb));
end $$;
revoke all on function public.pms_share_open(text, text) from public;
grant execute on function public.pms_share_open(text, text) to anon, authenticated;

-- SALVAR um lançamento (visitante, link de edição)
drop function if exists public.pms_share_save(text, text, text, jsonb, boolean, text);
create or replace function public.pms_share_save(p_token text, p_tipo text, p_id text, p_dados jsonb, p_conferido boolean, p_nome text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; v_ef jsonb; v_campos jsonb := '{}'::jsonb; e record; v_nome text; v_rest integer; v_motivo text;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is not null and l.alvo_tipo = 'mulher' then l := null; end if;
  v_motivo := public.pms_share_barreira(l, p_pin);
  if v_motivo is not null then raise exception '%', case v_motivo when 'expirado' then 'Este link expirou.' when 'pin' then 'Informe o PIN.' when 'pin_errado' then 'PIN incorreto.' else 'Este link não está mais disponível.' end; end if;
  if l.modo <> 'editar' then raise exception 'Este link é somente para visualizar.'; end if;
  if not exists (select 1 from public.pms_share_escopo(l) x where x.tipo = case when p_tipo = 'item' then 'item' else 'sub' end and x.id = p_id) then
    raise exception 'Lançamento não pertence a este link.'; end if;
  v_nome := left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60) || ' · link de conferência';
  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.actor_name', v_nome, true);
  if p_tipo = 'item' then select public.pms_jsonobj(extra_fields) into v_ef from items where id = p_id;
  else select public.pms_jsonobj(extra_fields) into v_ef from subitems where id = p_id; end if;
  if v_ef->'conferencia'->>'link' = l.id::text then raise exception 'Este lançamento já foi conferido e não pode mais ser alterado.'; end if;
  for e in select * from jsonb_each(coalesce(p_dados->'campos', '{}'::jsonb)) loop
    if not public.pms_chave_sistema(e.key) and length(e.key) <= 120 and (jsonb_typeof(e.value) in ('string','number','boolean')
       or (jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) <= 50 and not exists (select 1 from jsonb_array_elements(e.value) x where jsonb_typeof(x) <> 'string'))) then
      v_campos := v_campos || jsonb_build_object(e.key, case when jsonb_typeof(e.value) = 'string' then to_jsonb(left(e.value #>> '{}', 4000)) else e.value end);
    end if;
  end loop;
  v_ef := v_ef || v_campos;
  if p_conferido then v_ef := v_ef || jsonb_build_object('conferencia', jsonb_build_object('link', l.id, 'em', now(), 'por', left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60))); end if;
  if p_tipo = 'item' then
    update items set extra_fields = v_ef, description = coalesce(nullif(left(p_dados->>'descricao', 500), ''), description),
      observacao = case when p_dados ? 'observacao' then left(p_dados->>'observacao', 4000) else observacao end where id = p_id;
  else
    update subitems set extra_fields = v_ef, description = coalesce(nullif(left(p_dados->>'descricao', 500), ''), description),
      observacao = case when p_dados ? 'observacao' then left(p_dados->>'observacao', 4000) else observacao end where id = p_id;
  end if;
  v_rest := public.pms_share_fechar_se_pronto(l, left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60));
  return jsonb_build_object('ok', true, 'restantes', v_rest, 'finalizado', v_rest = 0);
end $$;
revoke all on function public.pms_share_save(text, text, text, jsonb, boolean, text, text) from public;
grant execute on function public.pms_share_save(text, text, text, jsonb, boolean, text, text) to anon, authenticated;

-- CONFERIR TODOS (visitante, link de edição)
drop function if exists public.pms_share_conferir_todos(text, text);
create or replace function public.pms_share_conferir_todos(p_token text, p_nome text, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.share_links; v_nome text; v_conf jsonb; v_rest integer; v_motivo text;
begin
  l := public.pms_share_link(coalesce(p_token, ''));
  if l.id is not null and l.alvo_tipo = 'mulher' then l := null; end if;
  v_motivo := public.pms_share_barreira(l, p_pin);
  if v_motivo is not null then raise exception '%', case v_motivo when 'expirado' then 'Este link expirou.' when 'pin_errado' then 'PIN incorreto.' else 'Este link não está mais disponível.' end; end if;
  if l.modo <> 'editar' then raise exception 'Este link é somente para visualizar.'; end if;
  v_nome := left(coalesce(nullif(trim(p_nome), ''), 'Visitante'), 60);
  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.actor_name', v_nome || ' · link de conferência', true);
  v_conf := jsonb_build_object('conferencia', jsonb_build_object('link', l.id, 'em', now(), 'por', v_nome));
  update items i set extra_fields = public.pms_jsonobj(i.extra_fields) || v_conf
   where i.id in (select e.id from public.pms_share_escopo(l) e where e.tipo = 'item') and coalesce(public.pms_jsonobj(i.extra_fields)->'conferencia'->>'link', '') <> l.id::text;
  update subitems s set extra_fields = public.pms_jsonobj(s.extra_fields) || v_conf
   where s.id in (select e.id from public.pms_share_escopo(l) e where e.tipo = 'sub') and coalesce(public.pms_jsonobj(s.extra_fields)->'conferencia'->>'link', '') <> l.id::text;
  v_rest := public.pms_share_fechar_se_pronto(l, v_nome);
  return jsonb_build_object('ok', true, 'restantes', v_rest, 'finalizado', v_rest = 0);
end $$;
revoke all on function public.pms_share_conferir_todos(text, text, text) from public;
grant execute on function public.pms_share_conferir_todos(text, text, text) to anon, authenticated;

-- FICHA DA MULHER (somente leitura): link novo (share_links alvo 'mulher', validade/PIN opcionais) ou o token antigo do QR
drop function if exists public.pms_mulher_publica(text);
create or replace function public.pms_mulher_publica(p_token text, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; l public.share_links; v_motivo text;
begin
  if coalesce(length(p_token), 0) < 20 then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  l := public.pms_share_link(p_token);
  if l.id is not null and l.alvo_tipo = 'mulher' then
    v_motivo := public.pms_share_barreira(l, p_pin);
    if v_motivo is not null then return jsonb_build_object('ok', false, 'motivo', v_motivo, 'em', l.expires_at); end if;
    update share_links set visits = visits + 1, last_visit_at = now() where id = l.id;
    select i.* into m from items i where i.id = l.alvo_id;
  else
    select i.* into m from items i join atividades a on a.id = i.atividade_id
     where public.pms_jsonobj(i.extra_fields)->>'mulher_token' = p_token and public.pms_jsonobj(a.extra_fields)->>'mulher_cadastro' = '1' limit 1;
  end if;
  if m.id is null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  return jsonb_build_object('ok', true, 'expira', l.expires_at,
    'ficha', jsonb_build_object('nome', m.description, 'observacao', m.observacao, 'campos', public.pms_campos_visiveis(m.extra_fields), 'criado_em', m.created_at),
    'ocorrencias', coalesce((select jsonb_agg(jsonb_build_object('titulo', s.description, 'relato', s.observacao, 'campos', public.pms_campos_visiveis(s.extra_fields), 'criado_em', s.created_at)
                               order by coalesce(public.pms_jsonobj(s.extra_fields)->>'Data', s.created_at::text) desc)
                             from subitems s where s.item_id = m.id), '[]'::jsonb));
end $$;
revoke all on function public.pms_mulher_publica(text, text) from public;
grant execute on function public.pms_mulher_publica(text, text) to anon, authenticated;

drop function if exists public.pms_share_restantes(uuid, text);
