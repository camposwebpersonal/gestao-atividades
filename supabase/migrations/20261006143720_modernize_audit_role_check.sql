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

REVOKE ALL ON FUNCTION public.pms_record_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pms_record_author() FROM anon;
REVOKE ALL ON FUNCTION public.pms_record_author() FROM authenticated;
