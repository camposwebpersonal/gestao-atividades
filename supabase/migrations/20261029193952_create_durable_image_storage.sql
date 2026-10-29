INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gestao-imagens',
  'gestao-imagens',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    updated_at = now();

DROP POLICY IF EXISTS "gestao_images_insert_own_folder" ON storage.objects;
CREATE POLICY "gestao_images_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gestao-imagens'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  AND lower(storage.extension(name)) = ANY (ARRAY['jpg','jpeg','png','webp'])
);
