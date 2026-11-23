-- SECRETARIA DA MULHER (23/11/2026)
-- 1) MULHERES CADASTRADAS vira o cadastro das mulheres (tela própria js/secretaria-mulher.js). Estava vazia e marcada
--    como grupo de entrada do Registro de Campo; o Registro de Campo recria o grupo dele sozinho na próxima foto
--    (create_field_demand_group), então tiramos só a marca system_group.
-- 2) Novo grupo LEVANTAMENTO DA REDE DE ENFRENTAMENTO (formulário do PDF do usuário).
-- 3) Ficha somente leitura pelo QR do PDF: pms_mulher_publica(token) — devolve SÓ a ficha daquele token
--    (token aleatório de 32 caracteres em extra_fields.mulher_token) e as ocorrências dela. Sem tabela aberta.
-- 4) search_path fixo nas funções auxiliares da conferência (assistente de segurança).

set local pms.whatsapp_off = 'on';

update public.atividades
   set extra_fields = (public.pms_jsonobj(extra_fields) - 'system_group') || jsonb_build_object('mulher_cadastro', 1, 'modulo', 'atendimentos')
 where id = '7665247b-610b-41d8-94cd-5b0f9c89155a';

insert into public.atividades (id, name, description, observacao, icon, color, extra_fields, order_num, controle_pendencias, demanda_secretaria_id, created_at, updated_at)
select 'mulher-levantamento-rede', 'LEVANTAMENTO DA REDE DE ENFRENTAMENTO', '', '', '🗺️', '#7C3AED',
       jsonb_build_object('modulo', 'atendimentos', 'mulher_levantamento', 1, 'items_view_mode', 'list', 'subitems_view_mode', 'list', 'show_table', 0),
       coalesce(a.order_num, 0) + 1, 0, a.demanda_secretaria_id, now(), now()
  from public.atividades a
 where a.id = '7665247b-610b-41d8-94cd-5b0f9c89155a'
   and not exists (select 1 from public.atividades where id = 'mulher-levantamento-rede');

create or replace function public.pms_chave_sistema(k text) returns boolean language sql immutable set search_path = public as $$
  select k = any(array['id','extra_fields','created_at','updated_at','created_by','created_by_name','updated_by','updated_by_name',
    'audit_created_at','audit_updated_at','sync_at','old_id','parent_id','parent_type','is_placeholder','show_conclusion_date',
    'show_external_geolocation','geo_location','latitude','longitude','accuracy','captured_at','verba','verba_obs','verbas_list',
    'origem_verba','documentacao','documentacao_obs','licitacao','licitacao_obs','urgencia','prioritario','solicitante',
    'registro_tipo','modulo','controle_pocos','transfer_history','status_list','status_options','table_columns','exibir_valores',
    'imagens','contatos_responsavel','poco_order','licitacao_group_id','fornecedor_numero','cadastro_id','cadastro_grupo',
    'contas_local_id','seguro_local_id','agrupador','leite_entregas','leite_precos','leite_cotas','controle_leite',
    'produtores_grupo','cadastro_leite','conferencia','share_token','mulher_token','mulher_cadastro','mulher_levantamento','levantamento'])
    or k like 'item\_show\_%' or k like 'import\_%' or k like 'pipa\_%' or k like 'geo\_%' or k like '\_%'
$$;

create or replace function public.pms_campos_visiveis(ef jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    from jsonb_each(public.pms_jsonobj(ef)) e
   where not public.pms_chave_sistema(e.key) and (jsonb_typeof(e.value) in ('string','number','boolean')
         or (jsonb_typeof(e.value) = 'array' and not exists (select 1 from jsonb_array_elements(e.value) x where jsonb_typeof(x) <> 'string')))
$$;

create or replace function public.pms_mulher_publica(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m record;
begin
  if coalesce(length(p_token), 0) < 20 then return jsonb_build_object('ok', false); end if;
  select i.* into m from items i join atividades a on a.id = i.atividade_id
   where public.pms_jsonobj(i.extra_fields)->>'mulher_token' = p_token
     and public.pms_jsonobj(a.extra_fields)->>'mulher_cadastro' = '1'
   limit 1;
  if m.id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true,
    'ficha', jsonb_build_object('nome', m.description, 'observacao', m.observacao, 'campos', public.pms_campos_visiveis(m.extra_fields), 'criado_em', m.created_at),
    'ocorrencias', coalesce((select jsonb_agg(jsonb_build_object('titulo', s.description, 'relato', s.observacao, 'campos', public.pms_campos_visiveis(s.extra_fields), 'criado_em', s.created_at)
                               order by coalesce(public.pms_jsonobj(s.extra_fields)->>'Data', s.created_at::text) desc)
                             from subitems s where s.item_id = m.id), '[]'::jsonb));
end $$;
revoke all on function public.pms_mulher_publica(text) from public;
grant execute on function public.pms_mulher_publica(text) to anon, authenticated;
