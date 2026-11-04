// Localização vinda do Google Maps: coordenadas copiadas, links e graus/minutos/segundos.
import assert from 'node:assert/strict';
import {parseGoogleLocation as p, shortLinkIn, googleMapsPickUrl} from '../js/google-location.js';
const near = (got, lat, lng) => { assert.ok(got, 'deveria encontrar coordenadas'); assert.ok(Math.abs(got.latitude - lat) < 1e-5 && Math.abs(got.longitude - lng) < 1e-5, JSON.stringify(got)); };
near(p('-8.071234, -37.263456'), -8.071234, -37.263456);            // toque e segure → copiar
near(p('(-8.071234,-37.263456)'), -8.071234, -37.263456);
near(p('-8.071234 -37.263456'), -8.071234, -37.263456);
near(p('8°04\'16.4"S 37°15\'48.4"W'), -8.071222, -37.263444);        // formato do Google em graus
near(p('https://www.google.com/maps/place/UBS+Centro/@-8.0700,-37.2600,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d-8.0712345!4d-37.2634567'), -8.0712345, -37.2634567); // pino, não o centro
near(p('https://www.google.com/maps/search/?api=1&query=-8.07,-37.26'), -8.07, -37.26);
near(p('https://maps.google.com/?q=-8.0712,-37.2634'), -8.0712, -37.2634);
near(p('https://www.google.com/maps/@-8.0712,-37.2634,18z'), -8.0712, -37.2634);
near(p('https://www.google.com/maps/search/-8.0712,+-37.2634?entry=tts'), -8.0712, -37.2634);
near(p('Veja: https://www.google.com/maps?q=-8.0712,-37.2634 obrigado'), -8.0712, -37.2634);
near(p('geo:-8.0712,-37.2634?z=17'), -8.0712, -37.2634);
assert.equal(p('0.000000, 0.000000'), null, '0,0 não é localização');
assert.equal(p('Rua do Comércio, 120'), null);
assert.equal(p('99, 300'), null);
assert.equal(shortLinkIn('olha https://maps.app.goo.gl/AbC123xyz'), 'https://maps.app.goo.gl/AbC123xyz');
assert.equal(shortLinkIn('https://www.google.com/maps/@-8,-37,10z'), null);
assert.match(googleMapsPickUrl({latitude: -8.07, longitude: -37.26}), /query=-8\.070000,-37\.260000/);
assert.match(googleMapsPickUrl(null), /@-8\.073000,-37\.264000,15z/);
console.log('google-location: ok');
import {decodePlusCode} from '../js/google-location.js';
// Igreja em Sertânia (Plus Code completo 6934WPCM+VG) e o mesmo código curto "WPCM+VG Sertânia"
const full = decodePlusCode('6934WPCM+VG');
assert.ok(full.latitude < -8.0 && full.latitude > -8.1 && full.longitude < -37.2 && full.longitude > -37.3, JSON.stringify(full));
const zurich = decodePlusCode('8FVC9G8F+6X'); assert.ok(Math.abs(zurich.latitude - 47.36556) < 1e-4 && Math.abs(zurich.longitude - 8.52494) < 1e-4); // vetor oficial do Open Location Code
near(p('WPCM+VG Sertânia, PE'), full.latitude, full.longitude);
console.log('plus-code: ok');
