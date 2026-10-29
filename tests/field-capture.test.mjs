import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cameraInputAttributes,fieldDemandTitle,isFieldDemandGroup} from '../js/camera-capture-core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const initialMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261028134133_field_capture_workflow.sql'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028233000_remove_permanent_field_demands.sql'),'utf8');
const hardeningMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261028234500_harden_lazy_field_group_creation.sql'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const authorship=fs.readFileSync(path.join(root,'js/autoria.js'),'utf8');
const attendanceFlow=fs.readFileSync(path.join(root,'js/atendimento-fluxo.js'),'utf8');

test('câmera solicita lente traseira sem limitar novas capturas',()=>{
  assert.match(cameraInputAttributes(),/capture="environment"/);
  assert.match(cameraInputAttributes(),/accept="image\/\*"/);
});

test('grupo de entrada é reconhecido somente pela marca de sistema',()=>{
  assert.equal(isFieldDemandGroup({extra_fields:{system_group:'demandas-gerais-campo'}}),true);
  assert.equal(isFieldDemandGroup({name:'Demandas Gerais de Campo'}),false);
});

test('título da demanda nasce da observação sem espaços repetidos',()=>{
  assert.equal(fieldDemandTitle('  Buraco   próximo à escola  '),'Buraco próximo à escola');
  assert.equal(fieldDemandTitle('x'.repeat(200)).length,140);
});

test('banco remove a permanência e recria o grupo somente quando uma nova foto exigir',()=>{
  assert.match(initialMigration,/CREATE OR REPLACE FUNCTION public\.create_field_demand\(/);
  assert.match(migration,/DROP TRIGGER IF EXISTS protect_field_demand_group/);
  assert.match(migration,/DROP TRIGGER IF EXISTS ensure_field_demand_group_after_secretaria/);
  assert.match(migration,/extra_fields = COALESCE\(extra_fields, '\{\}'::jsonb\) - 'permanent'/);
  assert.match(migration,/group_id := public\.create_field_demand_group\(target_secretaria\)/);
  assert.match(hardeningMigration,/CREATE OR REPLACE FUNCTION public\.create_field_demand_group/);
  assert.match(hardeningMigration,/SECURITY INVOKER/);
  assert.match(hardeningMigration,/ALTER FUNCTION public\.create_field_demand\(text, text, jsonb\) SECURITY INVOKER/);
  assert.doesNotMatch(migration,/grupo permanente/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.create_field_demand\(/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.create_field_demand[\s\S]+TO authenticated/);
  assert.match(migration,/INSERT INTO public\.entity_images/);
});

test('interface não bloqueia edição ou exclusão do grupo de entrada',()=>{
  assert.doesNotMatch(index,/Demandas Gerais de Campo é um grupo permanente/);
  assert.doesNotMatch(index,/!window\.isFieldDemandGroup\?\.\(sec\)/);
});

test('nenhum input de imagem visível perde a opção de câmera',()=>{
  assert.match(index,/capture="environment"/);
  assert.match(index,/Tirar foto/);
});

test('triagem oferece redirecionamento explícito preservando fotos e observação',()=>{
  assert.match(authorship,/fieldDemand\?'Redirecionar':'Mover'/);
  assert.match(attendanceFlow,/Redirecionar demanda de campo/);
  assert.match(attendanceFlow,/Fotos, dados e autoria serão preservados/);
});
