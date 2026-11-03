// Legibilidade: campos de formulário não podem nascer com fundo escuro embutido no HTML
// (o navegador pode ignorar a correção via CSS e pintar texto escuro sobre fundo escuro).
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lum = hex => { let h = hex.slice(1); if (h.length === 3) h = [...h].map(c => c + c).join(''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const files = ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
const offenders = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  for (const tag of src.match(/<(?:input|select|textarea)\b[^>]*>/g) || []) {
    const style = (tag.match(/style="([^"]*)"/) || [])[1] || '';
    const bg = style.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    if (bg && lum(bg[1]) < .08) offenders.push(`${file}: ${tag.slice(0, 90)}…`);
  }
}
assert.deepEqual(offenders, [], 'Campos com fundo escuro embutido:\n' + offenders.join('\n'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sheets = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)/g)].map(m => m[1]);
assert.equal(sheets.at(-1), 'css/contrast-guard.css', 'a folha de legibilidade precisa ser a última');
const guard = fs.readFileSync(path.join(root, 'css/contrast-guard.css'), 'utf8');
assert.match(guard, /\.modal-box label\.field-gallery-button\{color:#0f4f49!important\}/);
assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /'css\/contrast-guard\.css'/);
console.log('contrast-source: ok');
