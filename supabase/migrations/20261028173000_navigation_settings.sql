CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_settings TO authenticated;

DROP POLICY IF EXISTS app_settings_read_authenticated ON public.app_settings;
CREATE POLICY app_settings_read_authenticated
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS app_settings_write_admin ON public.app_settings;
CREATE POLICY app_settings_write_admin
ON public.app_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users profile
    WHERE profile.id = (SELECT auth.uid())::text
      AND (profile.role = 'admin' OR profile.is_admin IS TRUE)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users profile
    WHERE profile.id = (SELECT auth.uid())::text
      AND (profile.role = 'admin' OR profile.is_admin IS TRUE)
  )
);

INSERT INTO public.app_settings (id, value)
VALUES ('navigation', '{"modules":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
