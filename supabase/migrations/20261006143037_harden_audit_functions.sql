-- A função administrativa não precisa elevar privilégios porque as três tabelas
-- já permitem UPDATE autenticado; a checagem interna continua exigindo admin.
ALTER FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) SECURITY INVOKER;

-- Funções de gatilho são acionadas pelo próprio Postgres e não devem ser RPCs.
REVOKE ALL ON FUNCTION public.pms_record_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pms_record_author() FROM anon;
REVOKE ALL ON FUNCTION public.pms_record_author() FROM authenticated;
