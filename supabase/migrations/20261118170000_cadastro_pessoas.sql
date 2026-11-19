-- Cadastro único de PESSOAS (ADMINISTRAÇÃO › Cadastros › PESSOAS).
-- Só servidores efetivos e comissionados (folha oficial e vigias efetivos) passam a apontar para uma ficha única da pessoa: registro da lista -> extra_fields.cadastro_id.
-- Mesma pessoa = mesmo CPF (11 dígitos) ou, sem CPF, mesmo nome (sem acento, sem parênteses).
-- Na ficha só entram dados de identificação/contato (CPF, RG, NIS, CNH, telefone, endereço, localidade);
-- salário, função, indicação etc. continuam só na lista de origem (protegidos pela permissão daquele grupo).
-- pms_pessoas_sync() é idempotente: liga o que ainda não está ligado, cria a ficha quando falta e completa
-- campos vazios. Roda todo dia às 03:10 (pg_cron) e pode ser chamada à mão. Não dispara WhatsApp.

insert into public.atividades (id,name,description,icon,color,order_num,status,concluded,controle_pendencias,show_stats,extra_fields,created_at,updated_at)
values ('cad-pessoas','PESSOAS','Cadastro único de pessoas (servidores, contratados, taxistas, beneficiários…). As listas e controles puxam daqui.','👥','#0f766e',28,'pendente',0,0,0,'{"modulo":"cadastros","show_table":1}'::jsonb,now(),now())
on conflict (id) do nothing;

create or replace function public.pms_nome_chave(t text) returns text
language sql immutable set search_path to '' as $$
  select upper(trim(regexp_replace(regexp_replace(translate(coalesce(t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '\(.*?\)|\[.*?\]','','g'),'\s+',' ','g')))
$$;

-- Quem entra no cadastro de PESSOAS: SÓ servidores EFETIVOS e COMISSIONADOS (regra do usuário, 18/11/2026).
-- Fonte: CONTROLE DE EMPREGOS / VEREADORES › itens "FOLHA OFICIAL - …" com Vínculo = 1 (efetivos e cargos CC/AP)
-- e LISTA DE VIGIAS com vínculo EFETIVO/COMISSIONADO. Cidadãos, taxistas, beneficiários, BCC/contratados: não.
create or replace function public.pms_pessoas_fontes()
returns table(tb text, id text, description text, ef jsonb, nome_pat text)
language sql stable set search_path to '' as $$
  select 'subitems', s.id, s.description, public.pms_jsonobj(s.extra_fields), null::text
    from public.subitems s join public.items i on i.id = s.item_id
   where s.atividade_id = 'ZnUVKKdfLI1yGlZpxlWk' and i.description ilike 'FOLHA OFICIAL%'
     and trim(coalesce(public.pms_jsonobj(s.extra_fields)->>'Vínculo','')) = '1'
  union all
  select 'items', i.id, i.description, public.pms_jsonobj(i.extra_fields), '^NOME COMPLETO$'
    from public.items i
   where i.atividade_id = '0G0krv3KnKeeYE2mGnU9'
     and exists (select 1 from jsonb_each_text(public.pms_jsonobj(i.extra_fields)) x
                  where upper(x.key) in ('VÍNCULO','VINCULO') and upper(x.value) ~ '(EFETIV|COMISSION)')
$$;
revoke all on function public.pms_pessoas_fontes() from public, anon, authenticated;

create or replace function public.pms_pessoas_sync() returns jsonb
language plpgsql set search_path to '' as $$
declare
  r record; pid text; criadas int := 0; ligadas int := 0; v_cpf text; v_nome text; v_campos jsonb;
begin
  perform set_config('pms.whatsapp_off','on',true);
  for r in
    with recs as (select * from public.pms_pessoas_fontes())
    select * from recs where coalesce(ef->>'cadastro_id','')='' order by tb, description
  loop
    v_nome := coalesce((select x.value from jsonb_each_text(r.ef) x where r.nome_pat is not null and upper(x.key) ~ r.nome_pat and trim(x.value)<>'' limit 1), r.description);
    v_nome := trim(regexp_replace(regexp_replace(v_nome,'\(.*?\)|\[.*?\]','','g'),'\s+',' ','g'));
    continue when length(public.pms_nome_chave(v_nome)) < 5;   -- linha sem nome de pessoa
    v_cpf := (select regexp_replace(x.value,'\D','','g') from jsonb_each_text(r.ef) x where upper(x.key) ~ '^CPF' limit 1);
    if length(coalesce(v_cpf,'')) <> 11 then v_cpf := null; end if;
    -- dados de identificação/contato apenas
    v_campos := jsonb_strip_nulls(jsonb_build_object(
      'CPF', case when v_cpf is null then null else substr(v_cpf,1,3)||'.'||substr(v_cpf,4,3)||'.'||substr(v_cpf,7,3)||'-'||substr(v_cpf,10,2) end,
      'RG', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) in ('RG') limit 1),
      'Nº NIS', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) ~ 'NIS' limit 1),
      'CNH', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) = 'CNH' limit 1),
      'Telefone', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) ~ '^(TELEFONE|CONTATO|CONTATO TELEF|FONE)' limit 1),
      'Endereço', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) ~ '^ENDERE' limit 1),
      'Localidade', (select nullif(trim(x.value),'') from jsonb_each_text(r.ef) x where upper(x.key) ~ '^(LOCALIDADE|LOCALIZA)' limit 1)));
    select p.id into pid from public.items p
     where p.atividade_id='cad-pessoas' and (
       (v_cpf is not null and regexp_replace(coalesce(public.pms_jsonobj(p.extra_fields)->>'CPF',''),'\D','','g') = v_cpf)
       or (public.pms_nome_chave(p.description) = public.pms_nome_chave(v_nome)
           and (v_cpf is null or coalesce(public.pms_jsonobj(p.extra_fields)->>'CPF','') = '')))
     order by (v_cpf is not null and regexp_replace(coalesce(public.pms_jsonobj(p.extra_fields)->>'CPF',''),'\D','','g') = v_cpf) desc
     limit 1;
    if pid is null then
      pid := gen_random_uuid()::text;
      insert into public.items (id,atividade_id,description,observacao,responsaveis,item_icon,item_color,concluded,status,order_num,extra_fields,created_at,updated_at)
      values (pid,'cad-pessoas',upper(v_nome),'','','👤','#0f766e',0,'pendente',0,v_campos,now(),now());
      criadas := criadas + 1;
    else
      -- completa só o que estiver vazio na ficha
      update public.items p set extra_fields = v_campos || public.pms_jsonobj(p.extra_fields)
       where p.id = pid and not (v_campos <@ public.pms_jsonobj(p.extra_fields))
         and exists (select 1 from jsonb_object_keys(v_campos) k where coalesce(public.pms_jsonobj(p.extra_fields)->>k,'') = '');
    end if;
    if r.tb = 'items' then
      update public.items set extra_fields = public.pms_jsonobj(extra_fields) || jsonb_build_object('cadastro_id',pid,'cadastro_grupo','cad-pessoas') where id = r.id;
    else
      update public.subitems set extra_fields = public.pms_jsonobj(extra_fields) || jsonb_build_object('cadastro_id',pid,'cadastro_grupo','cad-pessoas') where id = r.id;
    end if;
    ligadas := ligadas + 1;
  end loop;
  return jsonb_build_object('fichas_criadas',criadas,'registros_ligados',ligadas,
    'pessoas',(select count(*) from public.items where atividade_id='cad-pessoas'));
end;
$$;

create index if not exists items_pessoas_nome_idx on public.items (public.pms_nome_chave(description)) where atividade_id = 'cad-pessoas';

revoke all on function public.pms_pessoas_sync() from public, anon, authenticated;
revoke all on function public.pms_nome_chave(text) from public, anon;
grant execute on function public.pms_nome_chave(text) to authenticated;

select cron.schedule('pessoas-sync', '10 6 * * *', $$select public.pms_pessoas_sync()$$);  -- 06:10 UTC = 03:10 Recife
