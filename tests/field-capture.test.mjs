import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cameraInputAttributes,fieldDemandTitle,isFieldDemandGroup} from '../js/camera-capture-core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028134133_field_capture_workflow.sql'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const authorship=fs.readFileSync(path.join(root,'js/autoria.js'),'utf8');
const attendanceFlow=fs.readFileSync(path.join(root,'js/atendimento-fluxo.js'),'utf8');

test('câmera solicita lente traseira sem limitar novas capturas',()=>{
  assert.match(cameraInputAttributes(),/capture="environment"/);
  assert.match(cameraInputAttributes(),/accept="image\/\*"/);
});

test('grupo permanente é reconhecido somente pela marca de sistema',()=>{
  assert.equal(isFieldDemandGroup({extra_fields:{system_group:'demandas-gerais-campo'}}),true);
  assert.equal(isFieldDemandGroup({name:'Demandas Gerais de Campo'}),false);
});

test('título da demanda nasce da observação sem espaços repetidos',()=>{
  assert.equal(fieldDemandTitle('  Buraco   próximo à escola  '),'Buraco próximo à escola');
  assert.equal(fieldDemandTitle('x'.repeat(200)).length,140);
});

test('banco cria, protege e recebe o registro fotográfico em transação',()=>{
  assert.match(migration,/AFTER INSERT ON public\.secretarias/);
  assert.match(migration,/BEFORE UPDATE OR DELETE ON public\.atividades/);
  assert.match(migration,/Demandas Gerais de Campo e um grupo permanente/);
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.create_field_demand\(/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.create_field_demand[\s\S]+TO authenticated/);
  assert.match(migration,/INSERT INTO public\.entity_images/);
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
