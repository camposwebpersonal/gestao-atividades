// Leitura de localizações vindas do Google Maps: coordenadas copiadas, links compartilhados
// (inclusive os curtos maps.app.goo.gl) e coordenadas em graus/minutos/segundos.
// Módulo puro (sem DOM) para poder ser testado no Node.

const inRange = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const point = (lat, lng, source) => inRange(lat, lng) ? {latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)), source} : null;
const NUM = '[-+]?\\d{1,3}(?:[.,]\\d+)?';

export const SHORT_LINK = /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i;

function dmsToDecimal(deg, min, sec, hemi) {
  const value = Number(deg) + Number(min || 0) / 60 + Number(String(sec || 0).replace(',', '.')) / 3600;
  return /[SWO]/i.test(hemi) ? -value : value;
}

function fromDms(text) {
  const part = '(\\d{1,3})\\s*[°º]\\s*(?:(\\d{1,2})\\s*[\'’′]\\s*)?(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:"|”|″|\'\')\\s*)?([NSLOEW])';
  const m = text.match(new RegExp(part + '[\\s,;]+' + part, 'i'));
  if (!m) return null;
  let lat = dmsToDecimal(m[1], m[2], m[3], m[4]), lng = dmsToDecimal(m[5], m[6], m[7], m[8]);
  if (/[LOEW]/i.test(m[4]) && /[NS]/i.test(m[8])) [lat, lng] = [lng, lat];
  return point(lat, lng, 'google-dms');
}

function fromUrl(text) {
  let url;
  try { url = new URL(text.trim()); } catch { return null; }
  const href = decodeURIComponent(url.href).replace(/\+/g, ' ');
  // 1) Pino do lugar escolhido (mais preciso que o centro da tela)
  let m = href.match(new RegExp(`!3d(${NUM})!4d(${NUM})`));
  if (m) return point(Number(m[1]), Number(m[2]), 'google-link');
  // 2) Parâmetros com coordenadas explícitas
  for (const key of ['q', 'query', 'll', 'destination', 'daddr', 'center', 'sll']) {
    const value = url.searchParams.get(key);
    const pair = value && value.match(new RegExp(`^\\s*(?:loc:)?(${NUM})\\s*,\\s*(${NUM})`));
    if (pair) return point(Number(pair[1]), Number(pair[2]), 'google-link');
  }
  // 3) /place/-8.07,-37.26 ou /search/-8.07,+-37.26
  m = href.match(new RegExp(`/(?:place|search|dir)/[^/@]*?(${NUM})\\s*,\\s*(${NUM})`));
  if (m) return point(Number(m[1]), Number(m[2]), 'google-link');
  // 4) Centro do mapa: /@-8.07,-37.26,17z
  m = href.match(new RegExp(`@(${NUM}),(${NUM})(?:,|$)`));
  if (m) return point(Number(m[1]), Number(m[2]), 'google-link');
  return null;
}


// Plus Code (ex.: "WPCM+VG Sertânia" ou "6934WPCM+VG"), mostrado pelo Google Maps ao tocar num ponto.
// Algoritmo aberto Open Location Code; códigos curtos usam a cidade (ou o ponto atual) como referência.
const OLC = '23456789CFGHJMPQRVWX';
function olcEncode(lat, lng) {
  let la = Math.min(Math.max(lat, -90), 89.9999999) + 90, lo = ((lng + 180) % 360 + 360) % 360, res = 20, code = '';
  for (let i = 0; i < 5; i += 1) { const a = Math.floor(la / res), b = Math.floor(lo / res); code += OLC[a] + OLC[b]; la -= a * res; lo -= b * res; res /= 20; }
  return code.slice(0, 8) + '+' + code.slice(8);
}
function olcDecode(full) {
  const clean = full.replace('+', '').replace(/0+$/, '').toUpperCase();
  let lat = -90, lng = -180, latRes = 20, lngRes = 20;
  for (let i = 0; i < Math.min(clean.length, 10); i += 2) {
    const res = 20 / 20 ** (i / 2);
    lat += OLC.indexOf(clean[i]) * res; lng += OLC.indexOf(clean[i + 1] || '2') * res; latRes = lngRes = res;
  }
  for (let i = 10; i < clean.length; i += 1) { latRes /= 5; lngRes /= 4; const d = OLC.indexOf(clean[i]); lat += Math.floor(d / 4) * latRes; lng += (d % 4) * lngRes; }
  return [lat + latRes / 2, lng + lngRes / 2];
}
export function decodePlusCode(code, reference = [-8.073, -37.264]) {
  const value = String(code || '').toUpperCase().trim();
  if (!/^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/.test(value)) return null;
  const sep = value.indexOf('+');
  if (sep === 8) { const [lat, lng] = olcDecode(value); return point(lat, lng, 'google-pluscode'); }
  if (sep % 2 || sep < 2) return null;
  const pad = 8 - sep, resolution = 20 ** (2 - pad / 2), half = resolution / 2;
  let [lat, lng] = olcDecode(olcEncode(reference[0], reference[1]).slice(0, pad) + value);
  if (reference[0] + half < lat && lat - resolution >= -90) lat -= resolution; else if (reference[0] - half > lat && lat + resolution <= 90) lat += resolution;
  if (reference[1] + half < lng) lng -= resolution; else if (reference[1] - half > lng) lng += resolution;
  return point(lat, lng, 'google-pluscode');
}

// Retorna {latitude, longitude, source} ou null. Links curtos precisam ser resolvidos antes (resolveShortLink).
export function parseGoogleLocation(input, reference) {
  const text = String(input || '').trim();
  if (!text) return null;
  const link = text.match(/https?:\/\/\S+/i);
  if (link) { const found = fromUrl(link[0].replace(/[)\].,;]+$/, '')); if (found) return found; }
  const geo = text.match(new RegExp(`geo:(${NUM}),(${NUM})`, 'i'));
  if (geo) return point(Number(geo[1]), Number(geo[2]), 'google-link');
  const dms = fromDms(text);
  if (dms) return dms;
  const plus = text.toUpperCase().match(/(?:^|[^A-Z0-9+])([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3})(?![A-Z0-9])/);
  if (plus) { const found = decodePlusCode(plus[1], reference || undefined); if (found) return found; }
  const pair = text.replace(/[()]/g, ' ').match(new RegExp(`(?:^|[^\\d.])(${NUM.replace('[.,]', '\\.')})\\s*[,;\\s]\\s*(${NUM.replace('[.,]', '\\.')})(?![\\d])`));
  if (pair) return point(Number(pair[1]), Number(pair[2]), 'google-coords');
  return null;
}

export function shortLinkIn(input) {
  const link = String(input || '').match(/https?:\/\/\S+/i)?.[0]?.replace(/[)\].,;]+$/, '');
  return link && SHORT_LINK.test(link) ? link : null;
}

// Endereço para abrir o Google Maps já posicionado (ponto salvo, ou Sertânia por padrão).
export function googleMapsPickUrl(location, fallback = [-8.073, -37.264]) {
  const [lat, lng] = location && inRange(Number(location.latitude), Number(location.longitude)) ? [Number(location.latitude), Number(location.longitude)] : fallback;
  return location ? `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}` : `https://www.google.com/maps/@${lat.toFixed(6)},${lng.toFixed(6)},15z`;
}
