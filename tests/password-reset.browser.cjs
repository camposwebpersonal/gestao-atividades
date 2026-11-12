// "Esqueci minha senha" na tela de login (sem criar acesso) e a tela do link #redefinir-senha.
// Uso: python3 -m http.server 8090 e NODE_PATH=$(npm root -g) W=390 node tests/password-reset.browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const os = require('os');
const W = Number(process.env.W || 390);
const FAKE = `
const calls=(globalThis.__calls=[]);
export function createClient(){return {
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},signInWithPassword:async()=>({error:{code:'invalid_credentials',message:'Invalid login credentials'}}),setSession:async()=>({})},
  functions:{invoke:async(name,{body})=>{calls.push({name,body});
    if(body.action==='request')return body.login==='semmail'?{data:{ok:false,reason:'sem_email'}}:{data:{ok:true,sent_to:'cl••••@gmail.com'}};
    if(body.action==='check')return body.token.startsWith('bom')?{data:{ok:true,name:'CLAUDIA',login:'claudiaif'}}:{data:{ok:false,reason:'invalido'}};
    if(body.action==='confirm')return {data:{ok:true,login:'claudiaif'}};
    return {data:{ok:false}};}}};}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: W, height: 860}});
  page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/esm.sh/**', r => r.fulfill({contentType: 'application/javascript', body: FAKE}));
  await page.goto('http://127.0.0.1:8090/login.html');
  await page.click('text=Esqueci minha senha');
  await page.fill('#f-usuario', 'claudiaif');
  await page.click('#f-btn');
  await page.waitForSelector('#f-ok:not([hidden])');
  assert.match(await page.textContent('#f-ok'), /cl••••@gmail\.com/);
  assert.equal(await page.locator('text=Criar acesso').count(), 0, 'sem criar acesso');
  await page.screenshot({path: os.tmpdir() + `/reset-forgot-${W}.png`});
  await page.fill('#f-usuario', 'semmail'); await page.click('#f-btn');
  await page.waitForSelector('#err', {state: 'visible'});
  assert.match(await page.textContent('#err'), /e-mail de contato/);

  // Link do e-mail
  await page.goto('http://127.0.0.1:8090/login.html#redefinir-senha/bom' + 'x'.repeat(30));
  await page.waitForSelector('#r-who code');
  assert.equal(await page.textContent('#r-who code'), 'claudiaif');
  assert.equal(await page.getAttribute('#r-senha', 'type'), 'text');
  await page.click('text=🎲 Sugerir');
  assert.match(await page.textContent('#r-meter'), /caracteres/);
  await page.screenshot({path: os.tmpdir() + `/reset-new-${W}.png`});
  await page.click('#r-btn');
  await page.waitForSelector('#r-ok:not([hidden])');
  assert.match(await page.textContent('#r-ok'), /Senha alterada/);
  // Link inválido
  await page.goto('http://127.0.0.1:8090/login.html#redefinir-senha/ruim' + 'x'.repeat(30));
  await page.waitForSelector('#err', {state: 'visible'});
  assert.match(await page.textContent('#err'), /expirou/);
  assert.deepEqual(errors, []);
  console.log(`ok - esqueci minha senha (${W}px)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
