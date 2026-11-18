-- Lote: lançamentos podem entrar já concluídos (grupos com Controle de Conclusão) -> grava conclusion_date.
-- Aplicada no banco em 18/11/2026.
CREATE OR REPLACE FUNCTION public.submit_bulk_entry_draft(p_draft_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  selected_draft public.bulk_entry_drafts%ROWTYPE;
  inserted_rows jsonb;
  item_count integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para enviar o lote.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO selected_draft FROM public.bulk_entry_drafts
  WHERE id = p_draft_id AND owner_id = (SELECT auth.uid()) FOR UPDATE;
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
      concluded integer, status text, conclusion_date timestamptz, order_num integer, extra_fields jsonb,
      created_at timestamptz, updated_at timestamptz)
  ), inserted AS (
    INSERT INTO public.items (id, atividade_id, description, observacao, responsaveis, secretaria_id,
      start_date, deadline_date, item_icon, item_color, concluded, status, conclusion_date,
      order_num, extra_fields, created_at, updated_at)
    SELECT id, atividade_id, description, COALESCE(observacao,''), COALESCE(responsaveis,''),
      secretaria_id, start_date, deadline_date, COALESCE(item_icon,'📋'),
      COALESCE(item_color,'#3B82F6'), COALESCE(concluded,0), COALESCE(status,'pendente'),
      CASE WHEN COALESCE(concluded,0) = 1 THEN COALESCE(conclusion_date, now()) ELSE NULL END,
      order_num, COALESCE(extra_fields,'{}'::jsonb), COALESCE(created_at,now()), COALESCE(updated_at,now())
    FROM payload RETURNING *)
  SELECT COALESCE(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb) INTO inserted_rows FROM inserted;
  IF jsonb_array_length(inserted_rows) <> item_count THEN
    RAISE EXCEPTION 'O banco não confirmou todos os lançamentos.';
  END IF;
  DELETE FROM public.bulk_entry_drafts WHERE id = p_draft_id;
  RETURN inserted_rows;
END;
$function$;
