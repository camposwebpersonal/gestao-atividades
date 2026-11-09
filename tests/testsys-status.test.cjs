const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const home=fs.readFileSync('testsys/index.html','utf8');
const invoice=fs.readFileSync('testsys/fatura.html','utf8');
const script=fs.readFileSync('testsys/app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');

test('fatura atual está paga e libera todo o limite',()=>{
  assert.match(home,/Fatura paga/);
  assert.match(invoice,/Fatura paga/);
  assert.match(invoice,/Pago em 08 nov\./);
  assert.match(invoice,/Disponível<\/span><strong data-sensitive>R\$ 240,00/);
  assert.match(invoice,/Utilizado<\/span><strong>0%/);
});

test('cartão amarelo Itaú Click abre ativado com limite disponível total',()=>{
  assert.match(home,/Itaú Click Múltiplo Plat/);
  assert.match(home,/Cartão ativado/);
  assert.match(home,/Ativado agora/);
  assert.match(home,/data-card-panel="1"[\s\S]*Limite disponível[\s\S]*R\$ 240,00/);
  assert.match(script,/getItem\('testsys-click-5879-activated'\) !== 'false'/);
});

test('protótipo Itaú renovado permanece disponível offline',()=>{
  for(const asset of ['testsys/index.html','testsys/fatura.html','testsys/style.css','testsys/app.js']) assert.match(sw,new RegExp(asset.replace('.','\\.')));
  assert.match(sw,/gestao-pms-v185/);
});
