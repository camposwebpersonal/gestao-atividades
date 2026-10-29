const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const geo=fs.readFileSync(path.join(root,'js/geolocation.js'),'utf8');
const camera=fs.readFileSync(path.join(root,'js/camera-capture.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const demands=fs.readFileSync(path.join(root,'js/demandas-secretarias.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028164717_add_photo_geolocation.sql'),'utf8');

test('captura geolocalização com precisão e gera link compartilhável do Google Maps',()=>{
 assert.match(geo,/navigator\.geolocation\.getCurrentPosition/);
 assert.match(geo,/enableHighAccuracy:true/);
 assert.match(geo,/https:\/\/www\.google\.com\/maps\?q=/);
 assert.match(geo,/navigator\.share/);
 assert.match(geo,/Capturar geolocalização/);
 assert.match(index,/locationEditorHtml\(it,'it-geo'\)/);
 assert.match(index,/ef\.geo_location=geoLocation/);
});

test('geolocalização também permite busca e seleção manual no mapa',()=>{
 assert.match(geo,/openManualLocationPicker/);
 assert.match(geo,/searchPlaces/);
 assert.match(geo,/nominatim\.openstreetmap\.org\/search/);
 assert.match(geo,/map\.on\('click'/);
 assert.match(geo,/draggable:true/);
 assert.match(geo,/Usar GPS deste aparelho/);
 assert.match(geo,/Escolher no mapa/);
 assert.match(geo,/A busca acontece somente ao apertar/);
});

test('atalho externo de geolocalização é opt-in para grupos, itens e subitens',()=>{
 assert.match(geo,/show_group_external_geolocation===true/);
 assert.match(geo,/show_external_geolocation/);
 assert.match(geo,/default_external_geolocation===true/);
 assert.match(geo,/!externalGeolocationEnabled\(record,table\)/);
 assert.match(index,/id="it-show-external-geo"/);
 assert.match(index,/id="s-show-group-external-geo"/);
 assert.match(index,/id="s-default-item-external-geo"/);
 assert.match(index,/ef\.show_external_geolocation=/);
});

test('mapa geral e mapas por secretaria exibem os pontos permitidos',()=>{
 assert.match(index,/id="nav-map"/);
 assert.match(index,/renderGeneralGeoMap/);
 assert.match(geo,/openSecretaryGeoMap/);
 assert.match(geo,/userCanGroup/);
 assert.match(geo,/tile\.openstreetmap\.org/);
 assert.match(demands,/openSecretaryGeoMap/);
});

test('fotos são compactadas e podem receber carimbo de coordenadas e data',()=>{
 assert.match(geo,/maxDimension=1280,maxBytes=360000/);
 assert.match(geo,/toDataURL\('image\/jpeg',quality\)/);
 assert.match(geo,/location\.latitude\.toFixed\(6\)/);
 assert.match(camera,/optimizePhoto\(raw,\{location,stamp,maxDimension:1280,maxBytes:360000\}/);
 assert.match(index,/Gravar coordenadas e data visíveis na foto/);
});

test('banco guarda geolocalização das fotos com limites válidos',()=>{
 for(const field of ['latitude','longitude','accuracy_meters','maps_url','captured_at']) assert.match(migration,new RegExp(field));
 assert.match(migration,/latitude BETWEEN -90 AND 90/);
 assert.match(migration,/longitude BETWEEN -180 AND 180/);
 assert.match(migration,/entity_images_geolocation_idx/);
});

test('recursos de mapas e geolocalização ficam disponíveis offline',()=>{
 assert.match(sw,/gestao-pms-v159/);
 assert.match(sw,/'js\/geolocation\.js'/);
 assert.match(sw,/'css\/geolocation\.css'/);
 assert.match(sw,/leaflet@1\.9\.4/);
});
