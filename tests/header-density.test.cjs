const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/header-density.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('carrega a densidade de cabeçalhos depois da densidade de lançamentos', () => {
  const records = html.indexOf('css/record-density.css?v=7');
  const headers = html.indexOf('css/header-density.css?v=5');
  assert.ok(records >= 0);
  assert.ok(headers > records);
});

test('compacta por estrutura sem reduzir o tamanho das fontes aprovadas', () => {
  assert.match(css, /--header-height:\s*62px/);
  assert.match(css, /\.top-actions-fixed\s*\{/);
  assert.match(css, /\.activity-page-heading\s*\{/);
  assert.match(css, /font-size:\s*clamp\(1\.25rem, 1\.55vw, 1\.55rem\)/);
  assert.match(css, /\.activity-heading-row\s*\{/);
  assert.match(css, /\.activity-tools-row\s*\{/);
  assert.match(css, /\.activity-command-summary-row\s*\{/);
  assert.match(css, /\.activity-audit-popover\s*\{/);
  assert.match(css, /\.activity-stats\s*\{/);
  assert.match(css, /\.demand-heading\s*\{/);
  assert.match(css, /\.lic-hero\s*\{/);
  assert.match(css, /\.pw-hero\s*\{/);
  assert.match(css, /\.trash-hero\s*\{/);
  assert.match(css, /\.registry-heading/);
  assert.doesNotMatch(css, /\.activity-stat[^}]*font-size\s*:/is);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test('mantém reorganização responsiva dos cabeçalhos sem esmagar conteúdo', () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /row-gap:\s*4px/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-width:\s*0/);
});

test('inclui a nova camada no cache offline com versão renovada', () => {
  assert.match(sw, /gestao-pms-v154/);
  assert.match(sw, /'css\/header-density\.css'/);
  assert.match(sw, /'css\/productivity-redesign\.css'/);
});

test('a tela de atividade expõe classes semânticas para todos os blocos do cabeçalho', () => {
  for (const className of [
    'activity-page-heading',
    'activity-heading-row',
    'activity-tools-row',
    'activity-command-summary-row',
    'activity-audit-popover',
    'activity-view-options',
    'activity-expand-tools',
    'activity-stats',
    'activity-stat'
  ]) assert.match(html, new RegExp(`class="[^"]*${className}`));
  assert.match(html, /<div class="activity-heading-row" data-audit-skip>[\s\S]*?\$\{laneTabs\}[\s\S]*?<\/div>/);
  assert.match(html, /<div class="activity-command-summary-row">[\s\S]*?activity-tools-row[\s\S]*?\$\{expandirHtml\}[\s\S]*?\$\{statsHtml\}[\s\S]*?<\/div>/);
  assert.match(html, /data-audit-skip/);
  assert.match(html, /Mostrar informações de criação e edição/);
});
