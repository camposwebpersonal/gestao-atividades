// Proteção contra senhas vazadas (gratuita, feita no próprio site).
// Consulta a base pública "Pwned Passwords" (Have I Been Pwned) por k-anonimato: só os 5
// primeiros caracteres do SHA-1 da senha saem do aparelho; a senha nunca é enviada.
// Se a consulta falhar (sem internet, serviço fora), NÃO bloqueia: o site segue normalmente.
const cache = new Map();

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** @returns {Promise<{pwned:boolean,count:number,checked:boolean}>} */
export async function checkPwnedPassword(password, {timeoutMs = 4000} = {}) {
  const value = String(password || '');
  if (!value) return {pwned: false, count: 0, checked: false};
  try {
    const hash = await sha1Hex(value);
    const prefix = hash.slice(0, 5), suffix = hash.slice(5);
    let body = cache.get(prefix);
    if (!body) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {headers: {'Add-Padding': 'true'}, signal: ctrl.signal});
        if (!res.ok) return {pwned: false, count: 0, checked: false};
        body = await res.text();
        cache.set(prefix, body);
      } finally { clearTimeout(timer); }
    }
    for (const line of body.split('\n')) {
      const [suf, n] = line.trim().split(':');
      if (suf === suffix) { const count = Number(n) || 0; return {pwned: count > 0, count, checked: true}; }
    }
    return {pwned: false, count: 0, checked: true};
  } catch {
    return {pwned: false, count: 0, checked: false};
  }
}

export function pwnedMessage(count) {
  const n = Number(count) || 0;
  const vezes = n >= 1000 ? `mais de ${Math.floor(n / 1000).toLocaleString('pt-BR')} mil vezes` : `${n.toLocaleString('pt-BR')} ${n === 1 ? 'vez' : 'vezes'}`;
  return `Essa senha já apareceu em vazamentos na internet (${vezes}). Escolha outra — use 🎲 Sugerir.`;
}

window.checkPwnedPassword = checkPwnedPassword;
window.pwnedMessage = pwnedMessage;
