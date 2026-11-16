-- Cadastro reserva (extra_fields.reserva_destino): quem acessa o grupo de destino acessa a reserva dele.
-- Espelho de window.userCanGroup (js/modulos.js). Aplicada em 16/11/2026.
create or replace function public.pms_my_group_ids()
 returns text[]
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare perms jsonb; uid text := (select auth.uid())::text;
begin
  if uid is null then return array[]::text[]; end if;
  if public.pms_user_is_admin() then return (select coalesce(array_agg(a.id), array[]::text[]) from public.atividades a); end if;
  perms := coalesce(public.pms_my_perms(), '{}'::jsonb);
  return (select coalesce(array_agg(a.id), array[]::text[]) from public.atividades a
    where a.created_by = uid
       or public.pms_group_allows(perms,
            public.pms_group_module(a.name, a.description, a.extra_fields, a.controle_estoque, a.controle_contas, a.controle_distribuicao),
            a.id, a.demanda_secretaria_id, 'acesso')
       or exists (select 1 from public.atividades d
            where d.id = public.pms_jsonobj(a.extra_fields)->>'reserva_destino'
              and public.pms_group_allows(perms,
                    public.pms_group_module(d.name, d.description, d.extra_fields, d.controle_estoque, d.controle_contas, d.controle_distribuicao),
                    d.id, d.demanda_secretaria_id, 'acesso')));
end $function$;
