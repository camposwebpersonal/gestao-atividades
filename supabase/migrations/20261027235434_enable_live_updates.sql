-- Propaga gravações confirmadas a outras telas abertas sem depender de polling.
DO $$
DECLARE
  target_table text;
  live_tables text[] := ARRAY[
    'atividades','items','subitems','field_templates','secretarias','responsaveis',
    'users','contatos','contas','estoque','requisicoes','trash_items','entity_images',
    'galeria','chamados','distribuicao','extintores','extintor_abas','bulk_entry_drafts'
  ];
BEGIN
  FOREACH target_table IN ARRAY live_tables LOOP
    IF to_regclass(format('public.%I',target_table)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=target_table
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',target_table);
    END IF;
  END LOOP;
END $$;
