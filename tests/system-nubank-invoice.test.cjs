const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const page=fs.readFileSync('system/index.html','utf8');

test('fatura de dezembro registra estabelecimento, compra, vencimento e valor',()=>{
  assert.match(page,/Fatura Dezembro/);
  assert.match(page,/Dezembro 2026/);
  assert.match(page,/Vencimento: 12\/12\/2026/);
  assert.match(page,/MARIA DO SOCORRO OLIVEIRA LEITE/);
  assert.match(page,/03\/11\/2026 às 17:11/);
  assert.match(page,/Total da fatura[\s\S]*R\$ 100,00/);
});

test('fatura aberta reduz exatamente cem reais do limite disponível',()=>{
  assert.match(page,/Limite total do cartão[\s\S]*R\$ 4\.100,00/);
  assert.match(page,/Limite disponível<\/span>\s*<strong>R\$ 4\.000,00/);
  assert.match(page,/R\$ 100,00 utilizados/);
  assert.match(page,/Saldo devedor atual[\s\S]*R\$ 100,00/);
  assert.match(page,/summary-value avail">R\$ 4\.000,00/);
  assert.match(page,/width: 2\.44%/);
});
