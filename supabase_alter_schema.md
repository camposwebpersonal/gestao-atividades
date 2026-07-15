-- Script para adicionar colunas faltantes ao schema existente.
-- Execute isso no SQL Editor se você já criou as tabelas anteriormente.

ALTER TABLE secretarias ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE atividades ADD COLUMN IF NOT EXISTS order_num INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

ALTER TABLE items ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

ALTER TABLE subitems ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMPTZ;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS contato TEXT;

ALTER TABLE field_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';
