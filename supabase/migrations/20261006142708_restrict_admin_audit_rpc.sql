-- Projetos antigos podem ter concessão explícita de EXECUTE para anon.
REVOKE ALL ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) TO authenticated;
