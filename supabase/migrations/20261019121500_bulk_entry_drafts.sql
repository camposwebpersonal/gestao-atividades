-- Rascunhos privados e retomáveis para lançamentos em lote.
CREATE TABLE IF NOT EXISTS public.bulk_entry_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 180),
  grid_data jsonb NOT NULL DEFAULT '{"version":1,"rows":[]}'::jsonb CHECK (jsonb_typeof(grid_data) = 'object' AND octet_length(grid_data::text) <= 2097152),
  column_signature jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(column_signature) = 'array'),
  row_count integer NOT NULL DEFAULT 12 CHECK (row_count BETWEEN 1 AND 500),
  scroll_top integer NOT NULL DEFAULT 0 CHECK (scroll_top >= 0),
  scroll_left integer NOT NULL DEFAULT 0 CHECK (scroll_left >= 0),
  active_row integer NOT NULL DEFAULT 0 CHECK (active_row BETWEEN 0 AND 499),
  active_col integer NOT NULL DEFAULT 0 CHECK (active_col BETWEEN 0 AND 199),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_entry_drafts_owner_group_updated_idx
  ON public.bulk_entry_drafts(owner_id, group_id, updated_at DESC);

ALTER TABLE public.bulk_entry_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk drafts select own" ON public.bulk_entry_drafts;
CREATE POLICY "bulk drafts select own" ON public.bulk_entry_drafts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "bulk drafts insert own" ON public.bulk_entry_drafts;
CREATE POLICY "bulk drafts insert own" ON public.bulk_entry_drafts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "bulk drafts update own" ON public.bulk_entry_drafts;
CREATE POLICY "bulk drafts update own" ON public.bulk_entry_drafts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "bulk drafts delete own" ON public.bulk_entry_drafts;
CREATE POLICY "bulk drafts delete own" ON public.bulk_entry_drafts
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.bulk_entry_drafts FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bulk_entry_drafts TO authenticated;

-- O envio e a exclusão do rascunho acontecem na mesma transação. Assim, uma
-- queda de conexão não deixa um lote já enviado disponível para envio duplicado.
CREATE OR REPLACE FUNCTION public.submit_bulk_entry_draft(p_draft_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  selected_draft public.bulk_entry_drafts%ROWTYPE;
  inserted_rows jsonb;
  item_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para enviar o lote.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO selected_draft
  FROM public.bulk_entry_drafts
  WHERE id = p_draft_id AND owner_id = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rascunho não encontrado ou pertencente a outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Formato de lançamentos inválido.' USING ERRCODE = '22023';
  END IF;
  item_count := jsonb_array_length(p_items);
  IF item_count < 1 OR item_count > 500 THEN
    RAISE EXCEPTION 'O lote deve conter entre 1 e 500 lançamentos.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) entry WHERE entry->>'atividade_id' IS DISTINCT FROM selected_draft.group_id) THEN
    RAISE EXCEPTION 'O lote contém lançamento para outro grupo.' USING ERRCODE = '42501';
  END IF;

  WITH payload AS (
    SELECT * FROM jsonb_to_recordset(p_items) AS row_data(
      id text, atividade_id text, description text, observacao text,
      responsaveis text, secretaria_id text, start_date text,
      deadline_date timestamptz, item_icon text, item_color text,
      concluded integer, status text, order_num integer, extra_fields jsonb,
      created_at timestamptz, updated_at timestamptz
    )
  ), inserted AS (
    INSERT INTO public.items (
      id, atividade_id, description, observacao, responsaveis, secretaria_id,
      start_date, deadline_date, item_icon, item_color, concluded, status,
      order_num, extra_fields, created_at, updated_at
    )
    SELECT id, atividade_id, description, COALESCE(observacao,''), COALESCE(responsaveis,''),
      secretaria_id, start_date, deadline_date, COALESCE(item_icon,'📋'),
      COALESCE(item_color,'#3B82F6'), COALESCE(concluded,0), COALESCE(status,'pendente'),
      order_num, COALESCE(extra_fields,'{}'::jsonb), COALESCE(created_at,now()), COALESCE(updated_at,now())
    FROM payload
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb) INTO inserted_rows FROM inserted;

  IF jsonb_array_length(inserted_rows) <> item_count THEN
    RAISE EXCEPTION 'O banco não confirmou todos os lançamentos.';
  END IF;

  DELETE FROM public.bulk_entry_drafts WHERE id = p_draft_id;
  RETURN inserted_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_bulk_entry_draft(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bulk_entry_draft(uuid,jsonb) TO authenticated;
