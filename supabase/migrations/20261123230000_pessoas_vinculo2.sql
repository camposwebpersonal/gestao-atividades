-- PESSOAS: "Vínculo 2" da Folha Oficial (23/11/2026).
-- Os 20 registros com Vínculo = 2 são o SEGUNDO vínculo de servidores que já constam com Vínculo = 1 (acúmulo de
-- cargos, ex.: professor com duas matrículas) — todos efetivos/comissionados. Passam a ser fonte do cadastro e ficam
-- ligados à MESMA ficha do vínculo 1 (mesmo CPF ou nome). Simulado antes: 0 fichas novas, 20 registros ligados,
-- todos na mesma ficha do vínculo 1. A sincronização diária (pessoas-sync, 03:10) continua igual.
CREATE OR REPLACE FUNCTION public.pms_pessoas_fontes()
 RETURNS TABLE(tb text, id text, description text, ef jsonb, nome_pat text)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select 'subitems', s.id, s.description, public.pms_jsonobj(s.extra_fields), null::text
    from public.subitems s join public.items i on i.id = s.item_id
   where s.atividade_id = 'ZnUVKKdfLI1yGlZpxlWk' and i.description ilike 'FOLHA OFICIAL%'
     and trim(coalesce(public.pms_jsonobj(s.extra_fields)->>'Vínculo','')) in ('1','2')
  union all
  select 'items', i.id, i.description, public.pms_jsonobj(i.extra_fields), '^NOME COMPLETO$'
    from public.items i
   where i.atividade_id = '0G0krv3KnKeeYE2mGnU9'
     and exists (select 1 from jsonb_each_text(public.pms_jsonobj(i.extra_fields)) x
                  where upper(x.key) in ('VÍNCULO','VINCULO') and upper(x.value) ~ '(EFETIV|COMISSION)')
$function$;
select public.pms_pessoas_sync();
