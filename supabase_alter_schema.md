-- Script COMPLETO para adicionar todas as colunas usadas pelo aplicativo.
-- Execute isso no SQL Editor do Supabase (pode rodar mais de uma vez sem problema).

ALTER TABLE secretarias ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Atividades: todas as colunas usadas pelo app
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS order_num INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS controle_contas INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS controle_pendencias INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS controle_distribuicao INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS responsaveis TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS show_stats INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS show_verba INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS verba_on_subitems INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS verba_sum_subitems INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS verba_has_obs INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS show_origem_verba INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS origem_verba_on_subitems INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS origem_verba_has_obs INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS documentacao_on_subitems INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS documentacao_has_obs INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS licitacao_on_subitems INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS licitacao_has_obs INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

-- Items: colunas usadas pelo app
ALTER TABLE items ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS responsaveis TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

-- Subitems: colunas usadas pelo app
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS responsaveis TEXT;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS secretaria_id TEXT;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS deadline_date TIMESTAMPTZ;
ALTER TABLE subitems ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

-- Responsáveis
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS contato TEXT;
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS setor TEXT;
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Chamados
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS destinatario_setor TEXT;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS responsavel_id TEXT;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS prioridade TEXT;

-- Field templates
ALTER TABLE field_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}';

-- Controle de Estoque (novo módulo)
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS controle_estoque INTEGER DEFAULT 0;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS ce_nome_secretaria TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS ce_titulo_controle TEXT;

CREATE TABLE IF NOT EXISTS estoque (
  id TEXT PRIMARY KEY,
  atividade_id TEXT,
  item_id TEXT,
  subitem_id TEXT,
  produto TEXT,
  tipo TEXT,
  quantidade NUMERIC(12,3),
  unidade TEXT,
  fator NUMERIC(12,4) DEFAULT 1,
  qtd_base NUMERIC(12,3),
  preco_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  data DATE,
  destino TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_atividade_id ON estoque(atividade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_subitem_id ON estoque(subitem_id);
CREATE INDEX IF NOT EXISTS idx_estoque_created_at ON estoque(created_at DESC);

CREATE TRIGGER update_estoque_updated_at
BEFORE UPDATE ON estoque
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vínculo entre movimentações de estoque e requisições de compra
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS requisicao_id TEXT;
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS requisicao_item_id TEXT;

-- Requisições de compra (pedidos)
CREATE TABLE IF NOT EXISTS requisicoes (
  id TEXT PRIMARY KEY,
  atividade_id TEXT,
  numero INTEGER,
  data DATE,
  origem TEXT,
  destino TEXT,
  observacao TEXT,
  itens JSONB DEFAULT '[]',
  status TEXT DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisicoes_atividade_id ON requisicoes(atividade_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_numero ON requisicoes(numero);

CREATE TRIGGER update_requisicoes_updated_at
BEFORE UPDATE ON requisicoes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de acesso (RLS) para requisicoes e estoque
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requisicoes_all" ON requisicoes;
CREATE POLICY "requisicoes_all" ON requisicoes
FOR ALL TO anon, authenticated
USING (true) WITH CHECK (true);

ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "estoque_all" ON estoque;
CREATE POLICY "estoque_all" ON estoque
FOR ALL TO anon, authenticated
USING (true) WITH CHECK (true);
