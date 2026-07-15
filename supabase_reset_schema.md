-- Script para resetar o banco de dados do Supabase.
-- Execute isso no SQL Editor antes de rodar o schema atualizado.
-- CUIDADO: apaga todos os dados das tabelas.

DROP TABLE IF EXISTS contas CASCADE;
DROP TABLE IF EXISTS chamados CASCADE;
DROP TABLE IF EXISTS galeria CASCADE;
DROP TABLE IF EXISTS contatos CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS entity_images CASCADE;
DROP TABLE IF EXISTS field_templates CASCADE;
DROP TABLE IF EXISTS subitems CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS responsaveis CASCADE;
DROP TABLE IF EXISTS atividades CASCADE;
DROP TABLE IF EXISTS secretarias CASCADE;
