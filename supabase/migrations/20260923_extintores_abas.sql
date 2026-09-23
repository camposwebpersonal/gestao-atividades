-- Abas organizadoras para separar o inventário de extintores por secretaria/setor.
CREATE TABLE IF NOT EXISTS extintor_abas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  setor_responsavel TEXT,
  order_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extintor_abas_order ON extintor_abas(order_num, nome);

DROP TRIGGER IF EXISTS update_extintor_abas_updated_at ON extintor_abas;
CREATE TRIGGER update_extintor_abas_updated_at
BEFORE UPDATE ON extintor_abas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE extintor_abas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "extintor_abas_all" ON extintor_abas;
CREATE POLICY "extintor_abas_all" ON extintor_abas
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO extintor_abas (id, nome, setor_responsavel, order_num)
VALUES ('educacao', 'Educação', 'Secretaria Municipal de Educação', 1)
ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, setor_responsavel=EXCLUDED.setor_responsavel;

ALTER TABLE extintores ADD COLUMN IF NOT EXISTS aba_id TEXT;
CREATE INDEX IF NOT EXISTS idx_extintores_aba ON extintores(aba_id);

-- Todo o primeiro lote veio do laudo da Educação e fica nesta aba.
UPDATE extintores
SET aba_id='educacao'
WHERE aba_id IS NULL
  AND setor_responsavel='Secretaria Municipal de Educação';

