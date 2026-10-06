const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('credenciais temporárias ficam somente em memória e a cópia exige senha recém-salva',()=>{
  assert.match(source,/const _recentUserPasswords=new Map\(\)/);
  assert.match(source,/if\(!u\|\|!password\)\{toast\('Defina e salve uma nova senha antes de copiar/);
  assert.match(source,/_recentUserPasswords\.set\(id,pwd\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^)]*(?:password|senha)/i);
});

test('cada card oferece alteração, exibição e cópia de login com a nova senha',()=>{
  assert.match(source,/class="user-access-panel"/);
  assert.match(source,/Salvar nova senha/);
  assert.match(source,/Copiar login e senha/);
  assert.match(source,/navigator\.clipboard\.writeText\(message\)/);
});
