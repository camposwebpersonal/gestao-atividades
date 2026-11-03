const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const page=fs.readFileSync('sys88/index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');

test('simulação informa que Adriana está sem dívidas e com nome limpo',()=>{
  assert.match(page,/Olá, Adriana!/);
  assert.match(page,/Seu nome está limpo/);
  assert.match(page,/nenhuma dívida ativa/i);
  assert.match(page,/Nenhuma pendência ativa/);
  assert.match(page,/não realiza consulta real/i);
});

test('subsite é responsivo e fica disponível no cache offline',()=>{
  assert.match(page,/name="viewport"/);
  assert.match(page,/@media\(max-width:360px\)/);
  assert.match(sw,/sys88\/index\.html/);
  assert.match(sw,/gestao-pms-v167/);
});
