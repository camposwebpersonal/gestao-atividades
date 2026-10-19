-- Cobre a chave estrangeira isoladamente para exclusões eficientes de grupos.
CREATE INDEX IF NOT EXISTS bulk_entry_drafts_group_idx
  ON public.bulk_entry_drafts(group_id);
