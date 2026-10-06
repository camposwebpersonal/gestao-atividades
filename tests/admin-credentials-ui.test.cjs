const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('credenciais temporárias ficam somente em memória e a cópia usa senha recém-salva',()=>{
  assert.match(source,/const _recentUserPasswords=new Map\(\)/);
  assert.match(source,/const password=_recentUserPasswords\.get\(id\)/);
  assert.match(source,/_recentUserPasswords\.set\(id,pwd\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^)]*(?:password|senha)/i);
});

test('cada card oferece geração, alteração, exibição e cópia de login com a nova senha',()=>{
  assert.match(source,/class="user-access-panel"/);
  assert.match(source,/Gerar senha/);
  assert.match(source,/Salvar nova senha/);
  assert.match(source,/Salvar e copiar acesso/);
  assert.match(source,/navigator\.clipboard\.writeText\(message\)/);
});

test('copiar salva a senha digitada ou gera uma forte antes de montar a mensagem',()=>{
  assert.match(source,/generateUserPassword\(id\)/);
  assert.match(source,/await changeUserPassword\(id,'card'\)/);
  assert.match(source,/crypto\.getRandomValues\(bytes\)/);
});
