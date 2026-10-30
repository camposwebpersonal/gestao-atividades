const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('js/water-points.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20261030003958_create_water_collection_points.sql','utf8');
const compat=fs.readFileSync('supabase_compat.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');

test('cadastro de captação reúne fotos leves, GPS, mapa, rota e compartilhamento',()=>{
  assert.match(source,/optimizePhoto\(data,\{maxDimension:1280,maxBytes:320000\}\)/);
  assert.match(source,/locationEditorHtml\(row,'wp-geo'\)/);
  assert.match(source,/capture="environment"/);
  assert.match(source,/multiple onchange="addWaterPhotos/);
  assert.match(source,/Abrir rota/);
  assert.match(source,/shareGeoLocation/);
});

test('tabela própria tem RLS, valida coordenadas e fica disponível offline',()=>{
  assert.match(migration,/create table if not exists public\.water_collection_points/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/latitude between -90 and 90/);
  assert.match(migration,/longitude between -180 and 180/);
  assert.match(compat,/waterCollectionPoints': 'water_collection_points'/);
  assert.match(sw,/js\/water-points\.js/);
  assert.match(sw,/css\/water-points\.css/);
});
