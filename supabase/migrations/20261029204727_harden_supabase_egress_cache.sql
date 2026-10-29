-- O cache é consumido exclusivamente pela Edge Function com service_role.
-- Remove RPCs de cliente que se tornaram desnecessárias e mantém uma política
-- de negação explícita como defesa adicional aos privilégios já revogados.

drop function if exists public.get_supabase_egress_cache();
drop function if exists public.supabase_status_caller_allowed();

drop policy if exists supabase_egress_cache_no_client_access
on public.supabase_egress_cache;

create policy supabase_egress_cache_no_client_access
on public.supabase_egress_cache
for all
to authenticated
using (false)
with check (false);
