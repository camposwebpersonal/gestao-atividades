-- A lixeira é um recurso sensível: somente perfis explicitamente autorizados
-- podem listar seu conteúdo. A exclusão definitiva continua exigindo admin.

update public.users
set extra_fields = jsonb_set(
  public.pms_extra(to_jsonb(users)),
  '{permissoes}',
  (
    case
      when jsonb_typeof(public.pms_extra(to_jsonb(users)) -> 'permissoes') = 'object'
        then public.pms_extra(to_jsonb(users)) -> 'permissoes'
      else '{}'::jsonb
    end
  ) || jsonb_build_object(
    'pode_ver_lixeira',
    lower(trim(coalesce(display_name, ''))) in ('rcampos', 'micheline')
  ),
  true
);

drop policy if exists "trash_select_own_or_admin" on public.trash_items;
drop policy if exists "trash_select_authorized" on public.trash_items;
create policy "trash_select_authorized"
on public.trash_items for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and lower(coalesce(public.pms_extra(to_jsonb(u)) #>> '{permissoes,pode_ver_lixeira}', 'false')) = 'true'
  )
);

drop policy if exists "trash_delete_admin" on public.trash_items;
create policy "trash_delete_admin"
on public.trash_items for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())::text
      and lower(coalesce(public.pms_extra(to_jsonb(u)) #>> '{permissoes,pode_ver_lixeira}', 'false')) = 'true'
      and (coalesce(u.is_admin, false) or lower(coalesce(u.role, '')) = 'admin')
  )
);

notify pgrst, 'reload schema';
