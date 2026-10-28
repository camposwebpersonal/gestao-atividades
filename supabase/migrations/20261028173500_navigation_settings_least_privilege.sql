REVOKE ALL ON TABLE public.app_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_settings TO authenticated;
