const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const page=fs.readFileSync('sys88/index.html','utf8'),cpf=fs.readFileSync('sys88/cpf.html','utf8'),debts=fs.readFileSync('sys88/dividas.html','utf8'),services=fs.readFileSync('sys88/servicos.html','utf8'),css=fs.readFileSync('sys88/app.css','utf8'),sw=fs.readFileSync('sw.js','utf8');

test('simulação informa que Adriana Amorim está sem dívidas e com nome limpo',()=>{
  assert.match(page,/Adriana Amorim/);
  assert.match(cpf,/Adriana Amorim/);
  assert.match(cpf,/050\.\*\*\*\.\*\*\*-88/);
  assert.doesNotMatch(cpf,/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  assert.match(page,/Seu nome está limpo/);
  assert.match(page,/nenhuma dívida ativa/i);
  assert.match(page,/Nenhuma pendência ativa/);
  assert.match(page,/não consulta bases reais/i);
});

test('subsite é responsivo e fica disponível no cache offline',()=>{
  assert.match(page,/name="viewport"/);
  assert.match(css,/@media\(max-width:370px\)/);
  assert.match(sw,/sys88\/index\.html/);
  assert.match(sw,/gestao-pms-v184/);
});

test('o score 877 aparece em um gráfico acessível e responsivo',()=>{
  for(const html of [page,cpf]){
    assert.match(html,/Seu Score/);
    assert.match(html,/>877</);
    assert.match(html,/de 1000/);
    assert.match(html,/aria-label="Score 877 de 1000"/);
  }
  const scoreCss=fs.readFileSync('sys88/score.css','utf8');
  assert.match(scoreCss,/\.score-gauge/);
  assert.match(scoreCss,/87\.7%/);
  assert.match(scoreCss,/grid-template-columns: 1fr/);
  assert.match(sw,/sys88\/score\.css/);
});

test('as quatro abas são links acessíveis e abrem páginas próprias',()=>{
  const pages=[page,cpf,debts,services],links=['index.html','cpf.html','dividas.html','servicos.html'];
  for(const document of pages){assert.match(document,/aria-label="Navegação principal"/);for(const link of links)assert.match(document,new RegExp(`href="${link}"`));}
  for(const document of pages)assert.match(document,/aria-current="page"/);
});
