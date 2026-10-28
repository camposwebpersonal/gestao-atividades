ALTER TABLE public.entity_images
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS accuracy_meters double precision,
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone;

ALTER TABLE public.entity_images
  DROP CONSTRAINT IF EXISTS entity_images_latitude_valid,
  DROP CONSTRAINT IF EXISTS entity_images_longitude_valid;

ALTER TABLE public.entity_images
  ADD CONSTRAINT entity_images_latitude_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT entity_images_longitude_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

CREATE INDEX IF NOT EXISTS entity_images_geolocation_idx
  ON public.entity_images (entity_type, entity_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

ALTER TABLE public.galeria
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS accuracy_meters double precision,
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone;

ALTER TABLE public.galeria
  DROP CONSTRAINT IF EXISTS galeria_latitude_valid,
  DROP CONSTRAINT IF EXISTS galeria_longitude_valid;

ALTER TABLE public.galeria
  ADD CONSTRAINT galeria_latitude_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT galeria_longitude_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
