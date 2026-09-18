-- Restaura o perfil do login RCAMPOS, que usa camposweb.personal@gmail.com.
-- Não altera senha nem concede privilégios a outros usuários.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'camposweb.personal@gmail.com') THEN
    RAISE EXCEPTION 'O login camposweb.personal@gmail.com não existe neste projeto. Confira o projeto antes de continuar.';
  END IF;
END $$;

INSERT INTO public.users (id, email, display_name, role, is_admin)
SELECT id::text, email, 'RCAMPOS', 'admin', true
FROM auth.users
WHERE lower(email) = 'camposweb.personal@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_admin = true;
COMMIT;

SELECT id, email, role, is_admin FROM public.users
WHERE id IN (SELECT id::text FROM auth.users WHERE lower(email) = 'camposweb.personal@gmail.com');
