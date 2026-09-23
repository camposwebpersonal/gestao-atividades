-- Controle de extintores: inventário individual, com origem rastreável do laudo.
CREATE TABLE IF NOT EXISTS extintores (
  id TEXT PRIMARY KEY,
  source_key TEXT UNIQUE,
  inventory_code TEXT UNIQUE,
  registro_tipo TEXT NOT NULL DEFAULT 'extintor',
  categoria TEXT NOT NULL DEFAULT 'predio',
  setor_responsavel TEXT,
  local_nome TEXT NOT NULL,
  local_tipo TEXT,
  endereco TEXT,
  placa TEXT,
  veiculo_modelo TEXT,
  capacidade_passageiros INTEGER,
  ano_referencia INTEGER,
  tipo_extintor TEXT NOT NULL,
  agente_extintor TEXT,
  capacidade NUMERIC(10,2),
  unidade_capacidade TEXT,
  data_inicial DATE,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacao TEXT,
  documento_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extintores_local ON extintores(local_nome);
CREATE INDEX IF NOT EXISTS idx_extintores_status ON extintores(status);
CREATE INDEX IF NOT EXISTS idx_extintores_vencimento ON extintores(data_vencimento);

DROP TRIGGER IF EXISTS update_extintores_updated_at ON extintores;
CREATE TRIGGER update_extintores_updated_at
BEFORE UPDATE ON extintores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE extintores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "extintores_all" ON extintores;
CREATE POLICY "extintores_all" ON extintores
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Inventário extraído do arquivo EXTINTORES.pdf. Datas individuais não foram
-- informadas no laudo e, por isso, permanecem NULL até a conferência física.
WITH escolas(source_key_base, local_nome, local_tipo, endereco, tipo_extintor, agente_extintor, capacidade, unidade_capacidade, quantidade, status, observacao) AS (
  VALUES
  ('EDU-SEDE-MARCELO-LAFAYETTE-PQS','Escola em Tempo Integral Marcelo Lafayette','Escola','Sítio Apito (Agrícola)','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-MARCELO-LAFAYETTE-AP','Escola em Tempo Integral Marcelo Lafayette','Escola','Sítio Apito (Agrícola)','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-ISAURA-XAVIER-PQS','Escola Municipal Isaura Xavier','Escola','Praça Francisco Sales, s/n, Centro','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 3 PQS de 6 kg.'),
  ('EDU-SEDE-ISAURA-XAVIER-AP','Escola Municipal Isaura Xavier','Escola','Praça Francisco Sales, s/n, Centro','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 3 PQS de 6 kg.'),
  ('EDU-SEDE-ETELVINO-LINS-PQS','Escola Etelvino Lins de Albuquerque','Escola','Rua Vicente Caetano, s/n, Vila da Cohab','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-ETELVINO-LINS-AP','Escola Etelvino Lins de Albuquerque','Escola','Rua Vicente Caetano, s/n, Vila da Cohab','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-GETULIO-VARGAS-PQS','Escola Presidente Getúlio Vargas','Escola','Rua Catarina dos Santos, Centro','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-GETULIO-VARGAS-AP','Escola Presidente Getúlio Vargas','Escola','Rua Catarina dos Santos, Centro','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-CONSTANCIA-RODRIGUES-PQS','Escola Constância Rodrigues','Escola','Avenida Luís Cajueiro de Albuquerque, PE-180','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-SEDE-CONSTANCIA-RODRIGUES-AP','Escola Constância Rodrigues','Escola','Avenida Luís Cajueiro de Albuquerque, PE-180','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-SEDE-CRECHE-BARTOLOMEU-PQS','Creche Doutor Bartolomeu Brasiliano','Creche','Rua Ubirajara Chaves, Centro','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-CRECHE-BARTOLOMEU-AP','Creche Doutor Bartolomeu Brasiliano','Creche','Rua Ubirajara Chaves, Centro','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-CRECHE-RAIMUNDO-GOIS-PQS','Creche Prefeito Raimundo Góis','Creche','Rua Edson Leite, Alto do Céu','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-SEDE-CRECHE-RAIMUNDO-GOIS-AP','Creche Prefeito Raimundo Góis','Creche','Rua Edson Leite, Alto do Céu','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar os existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-RURAL-MANOEL-XAVIER-PQS','Escola Manoel Xavier','Escola','Sítio Caroá','PQS','Pó químico seco',4,'kg',5,'necessita_recarga','Laudo: recarregar 5 extintores existentes; recomendada aquisição de 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-JOSE-SERGIO-PQS','Escola José Sérgio Veras','Escola','Cruzeiro do Nordeste','PQS','Pó químico seco',4,'kg',2,'ativo','Laudo: recomendada aquisição de 1 PQS de 6 kg.'),
  ('EDU-RURAL-JOSE-SERGIO-AP','Escola José Sérgio Veras','Escola','Cruzeiro do Nordeste','Água Pressurizada','Água pressurizada',10,'L',1,'ativo','Laudo: recomendada aquisição de 1 PQS de 6 kg.'),
  ('EDU-RURAL-LAURA-CHAVES-PQS','Escola Laura Chaves','Escola','Algodões','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 2 PQS de 6 kg e 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-LAURA-CHAVES-AP','Escola Laura Chaves','Escola','Algodões','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 2 PQS de 6 kg e 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-MARIA-MORAIS-PQS','Escola Maria Morais','Escola','Caroalina','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 3 PQS de 6 kg e 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-MARIA-MORAIS-AP','Escola Maria Morais','Escola','Caroalina','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 3 PQS de 6 kg e 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-CORONEL-ERNANE-PQS','Escola Coronel Ernane Araújo','Escola','Rio da Barra','PQS','Pó químico seco',4,'kg',5,'necessita_recarga','Laudo: recarregar 5 extintores existentes; recomendada aquisição de 1 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-ALCIDES-LOPES-PQS','Escola Alcides Lopes','Escola','Albuquerque-Né','PQS','Pó químico seco',4,'kg',1,'ativo','Laudo: recomendada aquisição de 4 unidades, incluindo 2 PQS de 6 kg para o anexo e 2 Água Pressurizada de 10 L.'),
  ('EDU-RURAL-MARIA-VERONICA-PQS','Escola Maria Verônica da Soledade','Escola','Caianas','PQS','Pó químico seco',4,'kg',1,'ativo','Laudo: recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-RURAL-MARIA-VERONICA-AP','Escola Maria Verônica da Soledade','Escola','Caianas','Água Pressurizada','Água pressurizada',10,'L',1,'ativo','Laudo: recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-RURAL-ANTONIA-MARCOS-PQS','Escola Antônia Marcos de Siqueira','Escola','Riacho dos Porcos','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-RURAL-ANTONIA-MARCOS-AP','Escola Antônia Marcos de Siqueira','Escola','Riacho dos Porcos','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 2 PQS de 6 kg.'),
  ('EDU-RURAL-ANTONIO-BATISTA-PQS','Escola Antônio Batista','Escola','Bom Nome','PQS','Pó químico seco',4,'kg',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-RURAL-ANTONIO-BATISTA-AP','Escola Antônio Batista','Escola','Bom Nome','Água Pressurizada','Água pressurizada',10,'L',1,'necessita_recarga','Laudo: recarregar 2 existentes; recomendada aquisição de 4 PQS de 6 kg.'),
  ('EDU-RURAL-ELOI-CADETE-PQS','Escola Elói Cadete','Escola','Coxi dos Cadetes','PQS','Pó químico seco',6,'kg',1,'ativo','Laudo: possui PQS de 6 kg e Água Pressurizada de 10 L; recomendada aquisição de 1 PQS de 6 kg.'),
  ('EDU-RURAL-ELOI-CADETE-AP','Escola Elói Cadete','Escola','Coxi dos Cadetes','Água Pressurizada','Água pressurizada',10,'L',1,'ativo','Laudo: possui PQS de 6 kg e Água Pressurizada de 10 L; recomendada aquisição de 1 PQS de 6 kg.')
)
INSERT INTO extintores (id,source_key,inventory_code,categoria,setor_responsavel,local_nome,local_tipo,endereco,tipo_extintor,agente_extintor,capacidade,unidade_capacidade,status,observacao,documento_origem)
SELECT 'ext-'||lower(replace(source_key_base||'-'||lpad(n::text,2,'0'),'_','-')),
       source_key_base||'-'||lpad(n::text,2,'0'),
       'EXT-'||replace(source_key_base,'EDU-','EDU-')||'-'||lpad(n::text,2,'0'),
       CASE WHEN source_key_base LIKE 'EDU-SEDE-%' THEN 'educacao_sede' ELSE 'educacao_rural' END,
       'Secretaria Municipal de Educação',local_nome,local_tipo,endereco,tipo_extintor,agente_extintor,capacidade,unidade_capacidade,status,observacao,'EXTINTORES.pdf'
FROM escolas CROSS JOIN LATERAL generate_series(1,quantidade) AS n
ON CONFLICT (source_key) DO NOTHING;

WITH veiculos(tipo_local, local_nome, placa, veiculo_modelo, capacidade_passageiros, ano_referencia, status, observacao) AS (
  VALUES
  ('Ônibus','Ônibus escolar 01','PGG-6825','Ônibus',40,2013,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 02','RZN-6B89','Ônibus',40,2022,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 03','SOC-4H49','Ônibus',50,2024,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 04','PFP-4672','Ônibus',48,2010,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 05','QYW-6G59','Ônibus',38,2021,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 06','PDV-4319','Ônibus',40,2015,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 07','RZN-6E59','Ônibus',40,2022,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 08','PFN-6161','Ônibus',40,2010,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 09','PGG-7965','Ônibus',40,2013,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 10','SOE-6E54','Ônibus',59,2024,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 11','SOG-1D39','Ônibus',59,2024,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 12','SOE-6F39','Ônibus',30,2024,'necessita_recarga',NULL),('Ônibus','Ônibus escolar 13','SOT-2H06','Ônibus',24,2025,'vencido','Laudo: extintor vencido recentemente.'),
  ('Micro-ônibus','Micro-ônibus escolar 01','RZW-6G55','Micro-ônibus',22,2021,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 02','PDC-0846','Micro-ônibus',24,2017,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 03','SNQ-8B14','Micro-ônibus',25,2023,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 04','RZW-5C56','Micro-ônibus',24,2022,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 05','SOB-5B15','Micro-ônibus',25,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 06','OYL-4502','Micro-ônibus',22,2013,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 07','RZP-5F95','Micro-ônibus',24,2022,'necessita_recarga','Placa transcrita do laudo digitalizado; confirmar na vistoria física.'),('Micro-ônibus','Micro-ônibus escolar 08','RZP-5E88','Micro-ônibus',24,2022,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 09','SOE-4E29','Micro-ônibus',24,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 10','SOE-3G29','Micro-ônibus',24,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 11','SOD-9E43','Micro-ônibus',24,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 12','SOE-0A69','Micro-ônibus',24,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 13','SOT-2B65','Micro-ônibus',24,2025,'vencido','Laudo: extintor vencido recentemente.'),('Micro-ônibus','Micro-ônibus escolar 14','SOG-7F92','Micro-ônibus',30,2024,'necessita_recarga',NULL),('Micro-ônibus','Micro-ônibus escolar 15','SPB-8144','Micro-ônibus',28,2025,'atencao','Laudo: extintor vencerá em 60 dias.'),('Micro-ônibus','Micro-ônibus escolar 16','SOW-5B80','Micro-ônibus',24,2025,'ativo','Laudo: vencimento informado somente como maio de 2027; dia não informado.'),('Micro-ônibus','Micro-ônibus escolar 17','SPA-7F94','Micro-ônibus',24,2025,'ativo','Laudo: vencimento informado somente como maio de 2027; dia não informado.'),('Micro-ônibus','Micro-ônibus escolar 18','SOY-1C59','Micro-ônibus',24,2025,'ativo','Laudo: vencimento informado somente como maio de 2027; dia não informado.'),('Micro-ônibus','Micro-ônibus escolar 19','SOW-5D70','Micro-ônibus',24,2025,'vencido','Laudo: extintor vencido recentemente.'),
  ('Fiat Ducato','Fiat Ducato 01','RZH-6B76','Fiat Ducato',16,2021,'necessita_recarga',NULL),('Fiat Ducato','Fiat Ducato 02','SNV-9J39','Fiat Ducato',16,2024,'necessita_recarga',NULL),('Fiat Ducato','Fiat Ducato 03','RZH-5I66','Fiat Ducato',16,2021,'necessita_recarga','Placa transcrita do laudo digitalizado; confirmar na vistoria física.'),('Fiat Ducato','Fiat Ducato 04','RZH-6A66','Fiat Ducato',16,2021,'necessita_recarga',NULL),('Fiat Ducato','Fiat Ducato 05','RZH-6B66','Fiat Ducato',16,2021,'necessita_recarga',NULL),('Fiat Ducato','Fiat Ducato 06','SOE-6B55','Fiat Ducato',16,2024,'necessita_recarga',NULL),
  ('Agrale Marruá','Agrale Marruá 01','SOS-8C36','Agrale Marruá',13,2025,'necessita_recarga','Laudo: extintor fabricado em 2024.')
)
INSERT INTO extintores (id,source_key,inventory_code,categoria,setor_responsavel,local_nome,local_tipo,placa,veiculo_modelo,capacidade_passageiros,ano_referencia,tipo_extintor,agente_extintor,capacidade,unidade_capacidade,status,observacao,documento_origem)
SELECT 'ext-veiculo-'||lower(replace(placa,'-','')),'VEICULO-'||placa,'EXT-VEICULO-'||placa,'transporte','Secretaria Municipal de Educação',local_nome,tipo_local,placa,veiculo_modelo,capacidade_passageiros,ano_referencia,'PQS-ABC','Pó químico seco ABC',4,'kg',status,observacao,'EXTINTORES.pdf'
FROM veiculos
ON CONFLICT (source_key) DO NOTHING;
