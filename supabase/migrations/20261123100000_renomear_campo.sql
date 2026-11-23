-- Renomear um campo personalizado de um grupo (planilha de lote, formulário, tabela, PDF):
-- troca o nome no modelo do campo (field_templates) e a chave em TODOS os lançamentos do grupo
-- (itens e subitens, inclusive grafias antigas do mesmo campo), na ordem das colunas salva e nos
-- lotes em rascunho. É mudança de estrutura, não edição: não muda autor/data de atualização nem
-- dispara aviso de WhatsApp (sync_at continua sendo tocado para os aparelhos receberem a mudança).
create or replace function public.pms_rename_field(p_group text, p_old text, p_new text, p_scope text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new text := btrim(coalesce(p_new, ''));
  v_old_key text := public.pms_nome_chave(p_old);
  n_tpl int; n_items int := 0; n_subs int := 0; n_drafts int := 0;
  old_col text := to_jsonb('ef:' || p_old)::text;
  new_col text := to_jsonb('ef:' || v_new)::text;
begin
  if auth.uid() is null then raise exception 'Faça login para renomear campos.'; end if;
  if not (public.pms_user_is_admin() or p_group = any(public.pms_my_group_ids())) then
    raise exception 'Você não tem permissão para alterar os campos deste grupo.';
  end if;
  if v_new = '' then raise exception 'Informe o novo nome do campo.'; end if;
  if length(v_new) > 80 then raise exception 'O nome do campo pode ter no máximo 80 letras.'; end if;
  if v_new = p_old then return jsonb_build_object('templates', 0, 'items', 0, 'subitems', 0, 'drafts', 0); end if;
  if exists (select 1 from field_templates where atividade_id = p_group and (p_scope is null or scope = p_scope)
             and public.pms_nome_chave(field_name) = public.pms_nome_chave(v_new) and public.pms_nome_chave(field_name) <> v_old_key) then
    raise exception 'Já existe um campo chamado "%" neste grupo.', v_new;
  end if;

  perform set_config('pms.whatsapp_off', 'on', true);
  perform set_config('pms.audit_override', 'on', true);

  update field_templates set field_name = v_new
   where atividade_id = p_group and field_name = p_old and (p_scope is null or scope = p_scope);
  get diagnostics n_tpl = row_count;
  if n_tpl = 0 then raise exception 'Campo "%" não encontrado neste grupo.', p_old; end if;

  -- chave nova = valor da chave nova (se já preenchido) ou da antiga/grafias antigas do mesmo campo
  if p_scope is null or p_scope = 'item' then
    update items i set extra_fields = x.novo from (
      select it.id, (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(public.pms_jsonobj(it.extra_fields)) e(k, v)
                      where public.pms_nome_chave(k) <> v_old_key)
             || jsonb_build_object(v_new, coalesce(public.pms_jsonobj(it.extra_fields) -> v_new,
                  (select v from jsonb_each(public.pms_jsonobj(it.extra_fields)) e(k, v) where public.pms_nome_chave(k) = v_old_key and v <> '""'::jsonb and v <> 'null'::jsonb limit 1),
                  public.pms_jsonobj(it.extra_fields) -> p_old)) novo
        from items it
       where it.atividade_id = p_group
         and exists (select 1 from jsonb_object_keys(public.pms_jsonobj(it.extra_fields)) k where public.pms_nome_chave(k) = v_old_key)
    ) x where i.id = x.id;
    get diagnostics n_items = row_count;
  end if;
  if p_scope is null or p_scope = 'subitem' then
    update subitems s set extra_fields = x.novo from (
      select it.id, (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(public.pms_jsonobj(it.extra_fields)) e(k, v)
                      where public.pms_nome_chave(k) <> v_old_key)
             || jsonb_build_object(v_new, coalesce(public.pms_jsonobj(it.extra_fields) -> v_new,
                  (select v from jsonb_each(public.pms_jsonobj(it.extra_fields)) e(k, v) where public.pms_nome_chave(k) = v_old_key and v <> '""'::jsonb and v <> 'null'::jsonb limit 1),
                  public.pms_jsonobj(it.extra_fields) -> p_old)) novo
        from subitems it
       where it.atividade_id = p_group
         and exists (select 1 from jsonb_object_keys(public.pms_jsonobj(it.extra_fields)) k where public.pms_nome_chave(k) = v_old_key)
    ) x where s.id = x.id;
    get diagnostics n_subs = row_count;
  end if;

  -- ordem das colunas da planilha, rótulos e campo do quantitativo guardados no grupo
  update atividades set extra_fields = (replace(public.pms_jsonobj(extra_fields)::text, old_col, new_col))::jsonb
   where id = p_group and public.pms_jsonobj(extra_fields)::text like '%' || old_col || '%';
  update atividades set extra_fields = public.pms_jsonobj(extra_fields) || jsonb_build_object('quantitativo_campo', v_new)
   where id = p_group and public.pms_jsonobj(extra_fields) ->> 'quantitativo_campo' = p_old;

  -- lotes em rascunho deste grupo (de todos os usuários): a coluna continua com o que já foi digitado
  update bulk_entry_drafts set grid_data = (replace(grid_data::text, old_col, new_col))::jsonb,
         column_signature = (replace(column_signature::text, old_col, new_col))::jsonb
   where group_id = p_group and (grid_data::text like '%' || old_col || '%' or column_signature::text like '%' || old_col || '%');
  get diagnostics n_drafts = row_count;

  return jsonb_build_object('templates', n_tpl, 'items', n_items, 'subitems', n_subs, 'drafts', n_drafts);
end;
$$;

revoke all on function public.pms_rename_field(text, text, text, text) from public, anon;
grant execute on function public.pms_rename_field(text, text, text, text) to authenticated;
