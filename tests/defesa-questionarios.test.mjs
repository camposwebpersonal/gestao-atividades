import assert from 'node:assert/strict';
globalThis.window = undefined;
const m = await import('../js/defesa-civil-questionarios.js').catch(() => null);
// O módulo importa o cliente do Supabase por URL; testa as regras puras extraindo-as do código.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/defesa-civil-questionarios.js', import.meta.url), 'utf8');
assert.match(src, /'O Plano Plurianual do município inclui Proteção e Defesa Civil\?'/);
assert.equal((src.match(/yesNo\(\d+, 'Dimensão/g) || []).length, 20, '20 perguntas Sim/Não no diagnóstico');
assert.match(src, /exclusivas: \['Não tem', 'Não sei'\]/);
assert.match(src, /Preenchido por/);
assert.match(src, /dcq-savebar is-top|is-top/);
console.log('defesa-questionarios (estático): ok', m ? '' : '(módulo depende do navegador)');
