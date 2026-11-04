// Resolve links curtos do Google Maps (maps.app.goo.gl) para coordenadas.
// O navegador não consegue seguir esse redirecionamento sozinho (CORS), então a função
// segue os redirecionamentos — somente para domínios do Google — e devolve latitude/longitude.
// Exige usuário logado (verify_jwt padrão do Supabase).
import {parseGoogleLocation} from './google-location.js';

const ALLOWED = /^(?:maps\.app\.goo\.gl|goo\.gl|g\.co|(?:www\.|maps\.)?google\.[a-z.]{2,6}|consent\.google\.[a-z.]{2,6})$/i;
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'Content-Type': 'application/json'}});
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function allowed(url: URL) { return url.protocol === 'https:' && ALLOWED.test(url.hostname); }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return reply({error: 'Método não permitido.'}, 405);
  let current: URL;
  try { current = new URL(String((await req.json())?.url || '').trim()); } catch { return reply({error: 'Link inválido.'}, 400); }
  if (!allowed(current)) return reply({error: 'Envie um link do Google Maps.'}, 400);
  let response: Response | null = null;
  for (let hop = 0; hop < 6; hop += 1) {
    const found = parseGoogleLocation(current.href);
    if (found) return reply({url: current.href, ...found});
    if (/^consent\./i.test(current.hostname) && current.searchParams.get('continue')) { current = new URL(current.searchParams.get('continue')!); continue; }
    response = await fetch(current.href, {redirect: 'manual', headers: {'User-Agent': UA, 'Accept-Language': 'pt-BR'}});
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, current);
      if (!allowed(next)) return reply({error: 'O link não aponta para o Google Maps.'}, 400);
      current = next; await response.body?.cancel(); continue;
    }
    break;
  }
  const final = parseGoogleLocation(current.href);
  if (final) return reply({url: current.href, ...final});
  // Lugares compartilhados pela busca: a página traz o ponto na imagem de prévia (center=lat,lng)
  if (response?.ok) {
    const html = (await response.text()).slice(0, 1_500_000);
    const m = html.match(/center=(-?\d{1,3}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/) || html.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+),\d+(?:\.\d+)?z/) || html.match(/\[null,null,(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)\]/);
    const fromPage = m && parseGoogleLocation(`${m[1]}, ${m[2]}`);
    if (fromPage) return reply({url: current.href, ...fromPage, source: 'google-link'});
  } else await response?.body?.cancel();
  return reply({error: 'Não encontrei coordenadas nesse link. No Google Maps, toque e segure o ponto e copie as coordenadas.'}, 422);
});
