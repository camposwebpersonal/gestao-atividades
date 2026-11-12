const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=name=>fs.readFileSync(`system/${name}`,'utf8');
const home=read('index.html'),card=read('cartao.html'),payment=read('pagar.html'),more=read('mais.html'),script=read('app.js'),sw=fs.readFileSync('sw.js','utf8');

test('a titular aparece com o nome completo',()=>{
  assert.match(home,/Adriana Amorim/);
  assert.match(home,/ADRIANA AMORIM/);
});

test('navegação inferior abre páginas reais e destaca a guia atual',()=>{
  for(const page of [home,card,payment,more])for(const href of ['index.html','cartao.html','pagar.html','mais.html'])assert.match(page,new RegExp(`href="${href}"`));
  assert.match(card,/nav-item active[^>]+href="cartao\.html"/);
  assert.match(payment,/nav-item active[^>]+href="pagar\.html"/);
  assert.match(more,/nav-item active[^>]+href="mais\.html"/);
});

test('página do cartão informa bloqueio e endereço da nova via',()=>{
  assert.match(card,/cartão físico foi bloqueado/i);
  assert.match(card,/questões de segurança/i);
  assert.match(card,/AVENIDA JOAQUIM NABUCO, 268/);
  assert.match(card,/CENTRO · SERTÂNIA–PE/);
});

test('pagamento oferece Pix, boleto e parcelamento sem executar operação real',()=>{
  for(const method of ['Pix','Boleto','Parcelado'])assert.match(payment,new RegExp(`data-method="${method}"`));
  assert.match(payment,/Nenhuma cobrança ou transação financeira real/);
  assert.match(script,/Nenhuma operação financeira real foi realizada/);
});

test('configurações são funcionais, persistentes e disponíveis offline',()=>{
  for(const setting of ['showValues','invoiceNotifications','securityAlerts','biometrics','darkTheme'])assert.match(more,new RegExp(`data-setting="${setting}"`));
  assert.match(script,/localStorage\.setItem\(SETTINGS_KEY/);
  for(const asset of ['system/cartao.html','system/pagar.html','system/mais.html','system/app.css','system/app.js'])assert.match(sw,new RegExp(asset.replace('.','\\.')));
  assert.match(sw,/gestao-pms-v190/);
});
