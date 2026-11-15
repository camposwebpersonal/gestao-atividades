#!/usr/bin/env node
// Versões automáticas dos arquivos (fim do "?v=" manual).
//
// Cada referência local  arquivo.js?v=…  /  arquivo.css?v=…  recebe uma "impressão digital"
// calculada do conteúdo do próprio arquivo E de tudo o que ele importa. Mudou um arquivo →
// muda a versão dele e de quem depende dele; nada mudou → nada muda. O CACHE_NAME do sw.js
// (gestao-pms-vN) sobe sozinho quando qualquer arquivo guardado offline muda.
//
// Uso:  node tools/stamp-versions.mjs          (aplica)
//       node tools/stamp-versions.mjs --check  (só confere; sai com erro se algo estiver velho — usado no CI)
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join, dirname, relative, resolve, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const QUIET = process.argv.includes('--quiet');

// Arquivos do app que podem conter referências versionadas.
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) { if (['js', 'css'].includes(rel) || rel.startsWith('js/') || rel.startsWith('css/')) walk(rel, out); }
    else if (/\.(js|mjs|css)$/.test(name)) out.push(rel);
  }
  return out;
}
const SOURCES = ['index.html', 'login.html', 'supabase_compat.js', ...walk('js'), ...walk('css')].filter(f => existsSync(join(ROOT, f)));

const REF = /(["'(])((?:\.\.?\/|\/)?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:js|mjs|css))\?v=([0-9A-Za-z]+)/g;
const read = f => readFileSync(join(ROOT, f), 'utf8');
const resolveRef = (from, ref) => {
  const base = ref.startsWith('/') ? ref.slice(1) : posix.normalize(posix.join(posix.dirname(from), ref));
  return existsSync(join(ROOT, base)) ? base : null;
};

const text = new Map(SOURCES.map(f => [f, read(f)]));
const deps = new Map();
const normalized = new Map();
for (const [f, src] of text) {
  const d = new Set();
  normalized.set(f, src.replace(REF, (m, q, ref) => { const t = resolveRef(f, ref); if (t) { d.add(t); return `${q}${ref}?v=`; } return m; }));
  deps.set(f, d);
}
const SW_GENERATED = /^(const CACHE_NAME = .*|\/\/ assets-hash: .*)$/gm; // linhas que este script escreve no sw.js
const normOf = f => normalized.get(f) ?? (existsSync(join(ROOT, f)) ? (f === 'sw.js' ? read(f).replace(SW_GENERATED, '') : read(f)) : '');

// versão = hash do conteúdo (sem os ?v=) do arquivo + todas as dependências transitivas
const memo = new Map();
function version(f) {
  if (memo.has(f)) return memo.get(f);
  const seen = new Set(), stack = [f];
  while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); for (const d of deps.get(x) || []) stack.push(d); }
  const h = createHash('sha256');
  for (const x of [...seen].sort()) h.update(x + '\0' + normOf(x) + '\0');
  const v = h.digest('hex').slice(0, 8);
  memo.set(f, v);
  return v;
}

const changed = [];
for (const [f, src] of text) {
  const out = src.replace(REF, (m, q, ref) => { const t = resolveRef(f, ref); return t ? `${q}${ref}?v=${version(t)}` : m; });
  if (out !== src) { changed.push(f); if (!CHECK) writeFileSync(join(ROOT, f), out); }
}

// sw.js: CACHE_NAME sobe quando qualquer arquivo guardado offline muda.
const swPath = join(ROOT, 'sw.js');
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8');
  const list = (sw.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/) || [, ''])[1].match(/'([^']+)'/g)?.map(s => s.slice(1, -1)) || [];
  const h = createHash('sha256');
  for (const f of [...new Set(list)].sort()) {
    const p = f.replace(/^\.?\//, '');
    if (!p || !existsSync(join(ROOT, p)) || statSync(join(ROOT, p)).isDirectory()) continue;
    const src = text.has(p) ? normalized.get(p) : readFileSync(join(ROOT, p)); // sem ?v= (cada arquivo já entra pelo próprio conteúdo)
    h.update(p + '\0'); h.update(src); h.update('\0');
  }
  h.update(sw.replace(SW_GENERATED, ''));
  const assets = h.digest('hex').slice(0, 12);
  const prev = (sw.match(/^\/\/ assets-hash: ([0-9a-f]+)/m) || [])[1];
  if (prev !== assets) {
    const n = Number((sw.match(/gestao-pms-v(\d+)/) || [, '0'])[1]) + (prev ? 1 : 0);
    let out = sw.replace(/^const CACHE_NAME = .*$/m, `const CACHE_NAME = 'gestao-pms-v${n}';`);
    const line = `// assets-hash: ${assets} (gerado por tools/stamp-versions.mjs — não editar)`;
    out = /^\/\/ assets-hash: /m.test(out) ? out.replace(/^\/\/ assets-hash: .*$/m, line) : out.replace(/^(const CACHE_NAME = .*)$/m, `$1\n${line}`);
    changed.push('sw.js');
    if (!CHECK) writeFileSync(swPath, out);
  }
}

if (CHECK) {
  if (changed.length) { console.error(`Versões desatualizadas em: ${changed.join(', ')}\nRode: node tools/stamp-versions.mjs`); process.exit(1); }
  if (!QUIET) console.log('stamp-versions: ok (todas as versões em dia)');
} else if (!QUIET) console.log(changed.length ? `stamp-versions: atualizado ${changed.join(', ')}` : 'stamp-versions: nada a mudar');
