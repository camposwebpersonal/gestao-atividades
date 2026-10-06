-- Permite corrigir autoria e datas de grupos/lançamentos por uma operação
-- administrativa auditável. A validação acontece no banco, não no navegador.
CREATE OR REPLACE FUNCTION public.admin_update_record_audit(
 record_table text,
 record_id text,
 created_user_id text DEFAULT NULL,
 updated_user_id text DEFAULT NULL,
 created_at_value timestamptz DEFAULT NULL,
 updated_at_value timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
 actor public.users%ROWTYPE;
 creator public.users%ROWTYPE;
 editor public.users%ROWTYPE;
 creator_name text;
 editor_name text;
 changed integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre novamente para corrigir a autoria.'; END IF;
 SELECT * INTO actor FROM public.users WHERE id=auth.uid()::text;
 IF NOT FOUND OR NOT COALESCE(actor.role='admin' OR actor.is_admin IS TRUE,false) THEN
  RAISE EXCEPTION 'Somente administradores podem corrigir autoria e datas.';
 END IF;
 IF record_table NOT IN ('atividades','items','subitems') THEN
  RAISE EXCEPTION 'Tipo de registro não permitido.';
 END IF;
 IF created_user_id IS NOT NULL THEN
  SELECT * INTO creator FROM public.users WHERE id=created_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário de criação não encontrado.'; END IF;
  creator_name:=COALESCE(NULLIF(trim(creator.display_name),''),split_part(creator.email,'@',1));
 END IF;
 IF updated_user_id IS NOT NULL THEN
  SELECT * INTO editor FROM public.users WHERE id=updated_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário da última edição não encontrado.'; END IF;
  editor_name:=COALESCE(NULLIF(trim(editor.display_name),''),split_part(editor.email,'@',1));
 END IF;
 IF created_at_value IS NOT NULL AND updated_at_value IS NOT NULL AND updated_at_value<created_at_value THEN
  RAISE EXCEPTION 'A última edição não pode ser anterior à criação.';
 END IF;

 -- O gatilho normal impede que clientes adulterem a autoria. Esta marca existe
 -- apenas dentro desta transação, após a validação administrativa acima.
 PERFORM set_config('pms.audit_override','on',true);
 EXECUTE format(
  'UPDATE public.%I SET '
  'created_by=CASE WHEN $1 IS NULL THEN created_by ELSE $1 END, '
  'created_by_name=CASE WHEN $1 IS NULL THEN created_by_name ELSE $2 END, '
  'updated_by=CASE WHEN $3 IS NULL THEN updated_by ELSE $3 END, '
  'updated_by_name=CASE WHEN $3 IS NULL THEN updated_by_name ELSE $4 END, '
  'created_at=COALESCE($5,created_at), updated_at=COALESCE($6,updated_at), '
  'audit_created_at=COALESCE($5,audit_created_at), audit_updated_at=COALESCE($6,audit_updated_at) '
  'WHERE id=$7',record_table)
 USING created_user_id,creator_name,updated_user_id,editor_name,created_at_value,updated_at_value,record_id;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
 RETURN jsonb_build_object('updated',true,'table',record_table,'id',record_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_record_audit(text,text,text,text,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.pms_record_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor text := auth.uid()::text; actor_name text;
BEGIN
 IF COALESCE(current_setting('pms.audit_override',true),'')='on' THEN RETURN NEW; END IF;
 IF actor IS NOT NULL THEN
  SELECT COALESCE(NULLIF(u.display_name,''), CASE WHEN lower(a.email)='camposweb.personal@gmail.com' THEN 'RCAMPOS' ELSE split_part(a.email,'@',1) END)
  INTO actor_name FROM auth.users a LEFT JOIN public.users u ON u.id=a.id::text WHERE a.id::text=actor;
 ELSIF COALESCE(auth.jwt()->>'role','')='service_role' AND NEW.updated_by IS NOT NULL THEN
  actor:=NEW.updated_by; actor_name:=COALESCE(NULLIF(NEW.updated_by_name,''),'Sistema / manutenção');
 ELSE
  actor:=NULL; actor_name:='Sistema / manutenção';
 END IF;
 IF TG_OP='INSERT' THEN
  IF COALESCE(current_setting('pms.preserve_author',true),'')<>'on' THEN
   NEW.created_by:=actor; NEW.created_by_name:=actor_name; NEW.audit_created_at:=now();
  END IF;
 ELSE
  NEW.created_by:=OLD.created_by; NEW.created_by_name:=OLD.created_by_name; NEW.audit_created_at:=OLD.audit_created_at;
 END IF;
 NEW.updated_by:=actor; NEW.updated_by_name:=actor_name; NEW.audit_updated_at:=now();
 RETURN NEW;
END $$;
