-- Testes de integração: executar APENAS no banco isolado com fixture de testes.
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
INSERT INTO atividades(id,name,extra_fields) VALUES('test-retro','Serviços de urgência da retro','{"modulo":"atendimentos"}'),('test-demandas','Demandas','{"modulo":"atendimentos"}'),('test-pocos','Perfuração de Poços','{"modulo":"atendimentos","controle_pocos":1}'),('test-estoque','Estoque','{"modulo":"estoque"}');
INSERT INTO items(id,atividade_id,description,extra_fields) VALUES('test-root','test-retro','SÍTIO TESTE','{"urgencia":"vermelho","prioritario":true,"solicitante":"Maria","campo_customizado":"preservado"}'),('test-target','test-demandas','Solicitações','{}'),('test-group','test-retro','Solicitações com filhos','{}');
INSERT INTO subitems(id,atividade_id,item_id,parent_id,parent_type,description,extra_fields) VALUES('test-sub','test-retro','test-group','test-group','item','Demanda principal','{}'),('test-child','test-retro','test-group','test-sub','subitem','Demanda filha','{}'),('test-promote','test-retro','test-group','test-group','item','Demanda avulsa','{}');
INSERT INTO entity_images(id,entity_type,entity_id,imgbb_url) VALUES('test-image','item','test-root','https://example.com/foto.jpg');
SELECT set_config('request.jwt.claim.sub','133dcf14-7822-42a2-8573-2adbc8bd6488',true);
SELECT move_attendance_record('test-root','items','test-pocos',NULL,'Sítio Teste','2026-09-18','solicitada');
DO $$ DECLARE r subitems%ROWTYPE; e jsonb; BEGIN
 SELECT * INTO r FROM subitems WHERE id='test-root'; e:=pms_extra(to_jsonb(r));
 IF r.atividade_id<>'test-pocos' OR e->>'registro_tipo'<>'poco' OR e->>'numero'<>'POÇO 1' OR e->>'status_perfuracao'<>'solicitada' OR e->>'urgencia'<>'vermelho' OR e->>'solicitante'<>'Maria' OR e->>'campo_customizado'<>'preservado' OR e->>'prioritario'<>'true' THEN RAISE EXCEPTION 'Adaptação para poços perdeu dados'; END IF;
 IF r.created_by_name<>'João' OR r.updated_by_name<>'RCAMPOS' THEN RAISE EXCEPTION 'Transferência perdeu autoria'; END IF;
 IF EXISTS(SELECT 1 FROM items WHERE id='test-root') THEN RAISE EXCEPTION 'Origem duplicada'; END IF;
 IF (SELECT entity_type FROM entity_images WHERE id='test-image')<>'subitem' OR e->'imagens'->>0<>'https://example.com/foto.jpg' THEN RAISE EXCEPTION 'Imagens não migradas'; END IF;
END $$;
SELECT move_attendance_record('test-sub','subitems','test-demandas','test-target');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM subitems WHERE id='test-child' AND item_id='test-target' AND atividade_id='test-demandas' AND parent_id='test-sub') THEN RAISE EXCEPTION 'Filhos não acompanharam transferência'; END IF;
END $$;
SELECT move_attendance_record('test-promote','subitems','test-demandas');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM items WHERE id='test-promote' AND atividade_id='test-demandas' AND created_by_name='João') OR EXISTS(SELECT 1 FROM subitems WHERE id='test-promote') THEN RAISE EXCEPTION 'Promoção falhou'; END IF;
END $$;
INSERT INTO subitems(id,atividade_id,item_id,parent_id,parent_type,description) VALUES('test-new-child','test-retro','test-group','test-group','item','Filho');
DO $$ DECLARE rejected boolean:=false; BEGIN
 BEGIN PERFORM move_attendance_record('test-group','items','test-pocos',NULL,'Local','2026-09-18','solicitada'); EXCEPTION WHEN others THEN rejected:=true; END;
 IF NOT rejected OR NOT EXISTS(SELECT 1 FROM items WHERE id='test-group' AND atividade_id='test-retro') THEN RAISE EXCEPTION 'Grupo incompatível não foi rejeitado de forma atômica'; END IF;
END $$;
SELECT move_attendance_record('test-root','subitems','test-retro');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM items WHERE id='test-root' AND atividade_id='test-retro' AND created_by_name='João') THEN RAISE EXCEPTION 'Retorno do poço perdeu autoria ou destino'; END IF;
 IF (SELECT count(*) FROM entity_images WHERE entity_id='test-root' AND entity_type='item' AND imgbb_url='https://example.com/foto.jpg') <> 1 THEN RAISE EXCEPTION 'Retorno do poço perdeu ou duplicou foto'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $$ DECLARE rejected boolean:=false; BEGIN
 BEGIN PERFORM move_attendance_record('test-promote','items','test-retro'); EXCEPTION WHEN others THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Usuário sem permissão transferiu demanda'; END IF;
END $$;
UPDATE items SET description='Editado por Pedro',created_by='falso',created_by_name='Falso',updated_by_name='Falso' WHERE id='test-promote';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM items WHERE id='test-promote' AND created_by_name='João' AND updated_by_name='Pedro') THEN RAISE EXCEPTION 'Autoria original ou editor incorretos'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE items SET description='Manutenção' WHERE id='test-promote';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM items WHERE id='test-promote' AND updated_by_name='Sistema / manutenção') THEN RAISE EXCEPTION 'Manutenção atribuída ao usuário anterior'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: transferência, poços, imagens, filhos, atomicidade, permissões e autoria' AS resultado;
