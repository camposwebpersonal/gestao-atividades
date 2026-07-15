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
