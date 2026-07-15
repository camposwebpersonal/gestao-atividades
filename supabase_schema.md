-- Schema SQL para Supabase
-- Cole isso no SQL Editor do Supabase e execute.

-- IMPORTANTE: Todos os IDs são TEXT porque os IDs do Firebase não são UUIDs.
-- As referências (atividade_id, item_id, etc.) também são TEXT.
-- Isso garante compatibilidade total com os dados migrados.

-- Secretarias
CREATE TABLE IF NOT EXISTS secretarias (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Atividades (no Firebase chamada 'secretariats')
CREATE TABLE IF NOT EXISTS atividades (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  observacao TEXT,
  show_conclusion_date INTEGER DEFAULT 1,
  show_documentacao INTEGER DEFAULT 0,
  show_licitacao INTEGER DEFAULT 0,
  icon TEXT DEFAULT '📋',
  color TEXT DEFAULT '#3B82F6',
  concluded INTEGER DEFAULT 0,
  conclusion_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pendente',
  cover_url TEXT,
  resp_url TEXT,
  extra_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Itens
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  atividade_id TEXT NOT NULL,
  description TEXT NOT NULL,
  secretaria_id TEXT,
  item_icon TEXT DEFAULT '📁',
  item_color TEXT DEFAULT '#3B82F6',
  order_num INTEGER DEFAULT 0,
  concluded INTEGER DEFAULT 0,
  conclusion_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pendente',
  auto_concluded BOOLEAN DEFAULT false,
  cover_url TEXT,
  resp_url TEXT,
  deadline_date TIMESTAMPTZ,
  extra_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sub-itens
CREATE TABLE IF NOT EXISTS subitems (
  id TEXT PRIMARY KEY,
  atividade_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  parent_id TEXT,
  parent_type TEXT DEFAULT 'item',
  description TEXT NOT NULL,
  extra_fields JSONB DEFAULT '{}',
  deadline_date TIMESTAMPTZ,
  order_num INTEGER DEFAULT 0,
  concluded INTEGER DEFAULT 0,
  conclusion_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pendente',
  auto_concluded BOOLEAN DEFAULT false,
  cover_url TEXT,
  resp_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Templates de campos extras
CREATE TABLE IF NOT EXISTS field_templates (
  id TEXT PRIMARY KEY,
  atividade_id TEXT,
  scope TEXT NOT NULL DEFAULT 'subitem',
  field_name TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  options JSONB DEFAULT NULL,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Responsáveis
CREATE TABLE IF NOT EXISTS responsaveis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cargo TEXT,
  setor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Imagens de entidades
CREATE TABLE IF NOT EXISTS entity_images (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  is_representative BOOLEAN DEFAULT false,
  imgbb_url TEXT NOT NULL,
  title TEXT,
  obs TEXT,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usuários (sincronizado com auth.users do Supabase)
-- id como TEXT para permitir migração dos UIDs antigos do Firebase
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  email_contato TEXT,
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN DEFAULT false,
  setor_id TEXT,
  responsavel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contatos
CREATE TABLE IF NOT EXISTS contatos (
  id TEXT PRIMARY KEY,
  nome TEXT,
  cargo TEXT,
  setor TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Galeria
CREATE TABLE IF NOT EXISTS galeria (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  titulo TEXT,
  atividade_id TEXT,
  data TEXT,
  local TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chamados
CREATE TABLE IF NOT EXISTS chamados (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'aberto',
  atividade_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contas
CREATE TABLE IF NOT EXISTS contas (
  id TEXT PRIMARY KEY,
  nome TEXT,
  valor NUMERIC(12,2),
  atividade_id TEXT,
  extra_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_items_atividade_id ON items(atividade_id);
CREATE INDEX IF NOT EXISTS idx_subitems_item_id ON subitems(item_id);
CREATE INDEX IF NOT EXISTS idx_subitems_atividade_id ON subitems(atividade_id);
CREATE INDEX IF NOT EXISTS idx_field_templates_atividade_id ON field_templates(atividade_id);
CREATE INDEX IF NOT EXISTS idx_entity_images_entity ON entity_images(entity_type, entity_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_atividades_updated_at BEFORE UPDATE ON atividades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subitems_updated_at BEFORE UPDATE ON subitems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contatos_updated_at BEFORE UPDATE ON contatos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_galeria_updated_at BEFORE UPDATE ON galeria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chamados_updated_at BEFORE UPDATE ON chamados FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (inicialmente desabilitado para facilitar migração; depois ativaremos políticas)
-- ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subitems ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE field_templates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE secretarias ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE responsaveis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE entity_images ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE galeria ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
