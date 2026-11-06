// Localização automática no Registro de Campo: leitura das coordenadas GPS gravadas na foto (EXIF)
// e checkbox "Gravar coordenadas e data visíveis na foto" marcado por padrão.
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {addEventListener() {}, getElementById: () => null, querySelectorAll: () => []};
const {readPhotoLocation} = await import('../js/geolocation.js?v=8');

const photo = new Blob([fs.readFileSync(new URL('./fixtures-gps.jpg', import.meta.url))], {type: 'image/jpeg'});
const location = await readPhotoLocation(photo);
assert.equal(location.latitude, -8.075, 'latitude sul (8°4′30″ S)');
assert.equal(location.longitude, -37.27, 'longitude oeste (37°16′12″ W)');
assert.match(location.maps_url, /-8\.075/);
assert.equal(await readPhotoLocation(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {type: 'image/jpeg'})), null, 'foto sem GPS não inventa localização');
assert.equal(await readPhotoLocation(new Blob(['x'], {type: 'image/png'})), null);

const capture = fs.readFileSync(new URL('../js/camera-capture.js', import.meta.url), 'utf8');
assert.match(capture, /id="field-stamp-location" type="checkbox" checked/, 'gravar coordenadas vem marcado');
assert.match(capture, /readPhotoLocation/, 'galeria usa as coordenadas da foto');
assert.match(capture, /const primary=fieldLocation\|\|/, 'a demanda salva a localização registrada');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /id="gal-stamp-location" type="checkbox" checked/);
assert.match(html, /id="photo-stamp-\$\{type\}-\$\{id\}" checked/);
assert.match(html, /css\/contrast-guard\.css\?v=\d+">/, 'folha de legibilidade carregada');
console.log('photo-location: ok');
