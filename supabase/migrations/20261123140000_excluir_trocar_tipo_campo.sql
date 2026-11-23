-- Excluir campo personalizado, trocar o tipo de um campo e transformar campo fixo em personalizado,
-- sempre por grupo e SEMPRE com volta: cada operação guarda o modelo do campo e os valores anteriores em
-- field_history, e pms_restore_field desfaz (re-cria o campo e devolve os valores aos lançamentos).
-- Nada dispara aviso de WhatsApp nem muda autor/data de atualização dos lançamentos (é mudança de estrutura).
create table if not exists public.field_history (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  scope text not null default 'item',
  field_name text not null,
  action text not null check (action in ('excluir', 'tipo')),
  template jsonb,
  valores jsonb not null default '{}'::jsonb,
  new_type text,
  created_by uuid default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now(),
  restored_at timestamptz
);
create index if not exists field_history_group_idx on public.field_history (group_id, created_at desc);
alter table public.field_history enable row level security;
drop policy if exists field_history_read on public.field_history;
create policy field_history_read on public.field_history for select to authenticated
  using (public.pms_user_is_admin() or group_id = any(public.pms_my_group_ids()));
-- gravação só pelas funções abaixo (security definer)

create or replace function public.pms_field_guard(p_group text) returns text
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'Faça login para alterar campos.'; end if;
  if not (public.pms_user_is_admin() or p_group = any(public.pms_my_group_ids())) then
    raise exception 'Você não tem permissão para alterar os campos deste grupo.';
  end if;
  select coalesce(nullif(u.display_name, ''), split_part(a.email, '@', 1)) into v_name
    from auth.users a left join public.users u on u.id = a.id::text where a.id = auth.uid();
  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.audit_override', 'on', true);
  return coalesce(v_name, 'usuário');
end $$;
revoke all on function public.pms_field_guard(text) from public, anon;

-- valores atuais de um campo (todas as grafias) em {"i:<id>": valor, "s:<id>": valor}
create or replace function public.pms_field_values(p_group text, p_name text, p_scope text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
    select 'i:' || i.id k, (select e.value from jsonb_each(public.pms_jsonobj(i.extra_fields)) e
             where public.pms_nome_chave(e.key) = public.pms_nome_chave(p_name) and e.value not in ('""'::jsonb, 'null'::jsonb, '[]'::jsonb) limit 1) v
      from items i where p_scope = 'item' and i.atividade_id = p_group
    union all
    select 's:' || s.id, (select e.value from jsonb_each(public.pms_jsonobj(s.extra_fields)) e
             where public.pms_nome_chave(e.key) = public.pms_nome_chave(p_name) and e.value not in ('""'::jsonb, 'null'::jsonb, '[]'::jsonb) limit 1)
      from subitems s where p_scope = 'subitem' and s.atividade_id = p_group
  ) x where v is not null
$$;
revoke all on function public.pms_field_values(text, text, text) from public, anon;

-- grava valores {"i:<id>": valor|null} na chave p_name (remove grafias antigas; null = apaga)
create or replace function public.pms_field_write(p_name text, p_vals jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; c int;
begin
  update items i set extra_fields = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(public.pms_jsonobj(i.extra_fields)) e
                                     where public.pms_nome_chave(e.key) <> public.pms_nome_chave(p_name))
         || case when jsonb_typeof(p_vals -> ('i:' || i.id)) in ('null') or p_vals -> ('i:' || i.id) is null then '{}'::jsonb else jsonb_build_object(p_name, p_vals -> ('i:' || i.id)) end
   where p_vals ? ('i:' || i.id);
  get diagnostics c = row_count; n := n + c;
  update subitems s set extra_fields = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(public.pms_jsonobj(s.extra_fields)) e
                                        where public.pms_nome_chave(e.key) <> public.pms_nome_chave(p_name))
         || case when jsonb_typeof(p_vals -> ('s:' || s.id)) in ('null') or p_vals -> ('s:' || s.id) is null then '{}'::jsonb else jsonb_build_object(p_name, p_vals -> ('s:' || s.id)) end
   where p_vals ? ('s:' || s.id);
  get diagnostics c = row_count; n := n + c;
  return n;
end $$;
revoke all on function public.pms_field_write(text, jsonb) from public, anon;

-- conversão de um valor para o tipo novo
create or replace function public.pms_field_convert(v jsonb, p_type text) returns jsonb
language plpgsql immutable as $$
declare t text; m text[];
begin
  if v is null then return null; end if;
  t := case when jsonb_typeof(v) = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(v) x) else v #>> '{}' end;
  t := btrim(coalesce(t, ''));
  if t = '' then return null; end if;
  if p_type = 'checkboxes' then
    if jsonb_typeof(v) = 'array' then return v; end if;
    return (select coalesce(jsonb_agg(btrim(x)), '[]'::jsonb) from unnest(regexp_split_to_array(t, '\s*[,;]\s*')) x where btrim(x) <> '');
  end if;
  if p_type = 'date' then
    m := regexp_match(t, '^(\d{1,2})/(\d{1,2})/(\d{4})');
    if m is not null then return to_jsonb(format('%s-%s-%s', m[3], lpad(m[2], 2, '0'), lpad(m[1], 2, '0'))); end if;
    if t ~ '^\d{4}-\d{2}-\d{2}' then return to_jsonb(left(t, 10)); end if;
    return to_jsonb(t);
  end if;
  if p_type in ('text', 'textarea', 'combobox', 'radio', 'number') then
    if p_type <> 'number' and t ~ '^\d{4}-\d{2}-\d{2}$' then return to_jsonb(to_char(t::date, 'DD/MM/YYYY')); end if;
    return to_jsonb(t);
  end if;
  return to_jsonb(t);
end $$;

create or replace function public.pms_delete_field(p_group text, p_name text, p_scope text default 'item') returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text; tpl jsonb; vals jsonb; hid uuid; n int;
begin
  who := public.pms_field_guard(p_group);
  select to_jsonb(t) into tpl from field_templates t where t.atividade_id = p_group and t.scope = p_scope and t.field_name = p_name limit 1;
  if tpl is null then raise exception 'Campo "%" não encontrado neste grupo.', p_name; end if;
  vals := public.pms_field_values(p_group, p_name, p_scope);
  insert into field_history (group_id, scope, field_name, action, template, valores, created_by_name)
    values (p_group, p_scope, p_name, 'excluir', tpl, vals, who) returning id into hid;
  n := public.pms_field_write(p_name, (select coalesce(jsonb_object_agg(k, 'null'::jsonb), '{}'::jsonb) from jsonb_object_keys(vals) k));
  delete from field_templates where atividade_id = p_group and scope = p_scope and field_name = p_name;
  return jsonb_build_object('history_id', hid, 'records', n);
end $$;

create or replace function public.pms_change_field_type(p_group text, p_name text, p_scope text, p_type text, p_options jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text; tpl jsonb; vals jsonb; novos jsonb; hid uuid; n int;
begin
  if p_type not in ('text', 'number', 'date', 'textarea', 'combobox', 'radio', 'checkboxes') then raise exception 'Tipo de campo inválido.'; end if;
  who := public.pms_field_guard(p_group);
  select to_jsonb(t) into tpl from field_templates t where t.atividade_id = p_group and t.scope = p_scope and t.field_name = p_name limit 1;
  if tpl is null then raise exception 'Campo "%" não encontrado neste grupo.', p_name; end if;
  vals := public.pms_field_values(p_group, p_name, p_scope);
  insert into field_history (group_id, scope, field_name, action, template, valores, new_type, created_by_name)
    values (p_group, p_scope, p_name, 'tipo', tpl, vals, p_type, who) returning id into hid;
  select coalesce(jsonb_object_agg(k, public.pms_field_convert(vals -> k, p_type)), '{}'::jsonb) into novos from jsonb_object_keys(vals) k;
  n := public.pms_field_write(p_name, novos);
  update field_templates set field_type = p_type,
         options = case when p_type in ('combobox', 'radio', 'checkboxes') then coalesce(p_options, '[]'::jsonb) else '[]'::jsonb end
   where atividade_id = p_group and scope = p_scope and field_name = p_name;
  return jsonb_build_object('history_id', hid, 'records', n);
end $$;

-- campo fixo → campo personalizado (com o tipo escolhido), copiando os valores; o fixo deixa de aparecer no grupo
create or replace function public.pms_convert_builtin_field(p_group text, p_key text, p_name text, p_type text, p_options jsonb default '[]'::jsonb, p_scope text default 'item') returns jsonb
language plpgsql security definer set search_path = public as $$
declare who text; v_name text := btrim(coalesce(p_name, '')); vals jsonb; novos jsonb; n int; hid uuid; ord int;
begin
  if p_key not in ('start_date', 'deadline_date', 'responsaveis', 'observacao', 'solicitante') then raise exception 'Este campo não pode ser transformado.'; end if;
  if p_type not in ('text', 'number', 'date', 'textarea', 'combobox', 'radio', 'checkboxes') then raise exception 'Tipo de campo inválido.'; end if;
  if v_name = '' then raise exception 'Informe o nome do campo.'; end if;
  who := public.pms_field_guard(p_group);
  if exists (select 1 from field_templates where atividade_id = p_group and scope = p_scope and public.pms_nome_chave(field_name) = public.pms_nome_chave(v_name)) then
    raise exception 'Já existe um campo chamado "%" neste grupo.', v_name;
  end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into vals from (
    select 'i:' || i.id k, case p_key
        when 'start_date' then to_jsonb(nullif(left(coalesce(i.start_date, ''), 10), ''))
        when 'deadline_date' then to_jsonb(to_char(i.deadline_date, 'YYYY-MM-DD'))
        when 'responsaveis' then to_jsonb(nullif(i.responsaveis, ''))
        when 'observacao' then to_jsonb(nullif(i.observacao, ''))
        else public.pms_jsonobj(i.extra_fields) -> 'solicitante' end v
      from items i where p_scope = 'item' and i.atividade_id = p_group
    union all
    select 's:' || s.id, case p_key
        when 'start_date' then to_jsonb(nullif(left(coalesce(s.start_date, ''), 10), ''))
        when 'deadline_date' then to_jsonb(to_char(s.deadline_date, 'YYYY-MM-DD'))
        when 'responsaveis' then to_jsonb(nullif(s.responsaveis, ''))
        when 'observacao' then to_jsonb(nullif(s.observacao, ''))
        else public.pms_jsonobj(s.extra_fields) -> 'solicitante' end
      from subitems s where p_scope = 'subitem' and s.atividade_id = p_group
  ) x where v is not null and v <> 'null'::jsonb and v <> '""'::jsonb;
  select coalesce(jsonb_object_agg(k, public.pms_field_convert(vals -> k, p_type)), '{}'::jsonb) into novos from jsonb_object_keys(vals) k;
  select coalesce(max(order_num), -1) + 1 into ord from field_templates where atividade_id = p_group and scope = p_scope;
  insert into field_templates (id, atividade_id, scope, field_name, field_type, options, order_num, created_at, updated_at)
    values (gen_random_uuid()::text, p_group, p_scope, v_name, p_type,
            case when p_type in ('combobox', 'radio', 'checkboxes') then coalesce(p_options, '[]'::jsonb) else '[]'::jsonb end, ord, now(), now());
  n := public.pms_field_write(v_name, novos);
  update atividades set extra_fields = public.pms_jsonobj(extra_fields) || jsonb_build_object('removed_fields',
           (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (select jsonb_array_elements_text(coalesce(public.pms_jsonobj(extra_fields) -> 'removed_fields', '[]'::jsonb)) x union select p_key) y))
   where id = p_group;
  return jsonb_build_object('records', n, 'name', v_name);
end $$;

create or replace function public.pms_restore_field(p_history uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h field_history; who text; tpl jsonb; n int;
begin
  select * into h from field_history where id = p_history;
  if h.id is null then raise exception 'Registro não encontrado.'; end if;
  if h.restored_at is not null then raise exception 'Isso já foi desfeito.'; end if;
  who := public.pms_field_guard(h.group_id);
  tpl := h.template;
  if h.action = 'excluir' then
    if exists (select 1 from field_templates where atividade_id = h.group_id and scope = h.scope and public.pms_nome_chave(field_name) = public.pms_nome_chave(h.field_name)) then
      raise exception 'Já existe um campo chamado "%" neste grupo. Renomeie-o antes de restaurar.', h.field_name;
    end if;
    insert into field_templates (id, atividade_id, scope, field_name, field_type, options, order_num, created_at, updated_at)
      values (case when exists (select 1 from field_templates where id = tpl ->> 'id') then gen_random_uuid()::text else tpl ->> 'id' end,
              h.group_id, h.scope, h.field_name, coalesce(tpl ->> 'field_type', 'text'), coalesce(tpl -> 'options', '[]'::jsonb),
              coalesce((tpl ->> 'order_num')::int, 0), coalesce((tpl ->> 'created_at')::timestamptz, now()), now());
  else
    update field_templates set field_type = coalesce(tpl ->> 'field_type', 'text'), options = coalesce(tpl -> 'options', '[]'::jsonb)
     where atividade_id = h.group_id and scope = h.scope and field_name = h.field_name;
    if not found then raise exception 'O campo "%" não existe mais neste grupo.', h.field_name; end if;
  end if;
  n := public.pms_field_write(h.field_name, h.valores);
  update field_history set restored_at = now() where id = h.id;
  return jsonb_build_object('records', n, 'field', h.field_name);
end $$;

revoke all on function public.pms_delete_field(text, text, text) from public, anon;
revoke all on function public.pms_change_field_type(text, text, text, text, jsonb) from public, anon;
revoke all on function public.pms_convert_builtin_field(text, text, text, text, jsonb, text) from public, anon;
revoke all on function public.pms_restore_field(uuid) from public, anon;
grant execute on function public.pms_delete_field(text, text, text) to authenticated;
grant execute on function public.pms_change_field_type(text, text, text, text, jsonb) to authenticated;
grant execute on function public.pms_convert_builtin_field(text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.pms_restore_field(uuid) to authenticated;
grant select on public.field_history to authenticated;
