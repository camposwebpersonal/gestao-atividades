import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {averageLuminance,shouldUseTorch} from '../js/smart-camera.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('medição de luz e regras dos três modos de flash',()=>{
  assert.ok(Math.abs(averageLuminance(new Uint8ClampedArray([0,0,0,255,255,255,255,255]))-127.5)<.01);
  assert.equal(shouldUseTorch('auto',30,true),true);
  assert.equal(shouldUseTorch('auto',180,true),false);
  assert.equal(shouldUseTorch('on',255,true),true);
  assert.equal(shouldUseTorch('off',0,true),false);
  assert.equal(shouldUseTorch('on',0,false),false);
});

test('câmera oferece escolha explícita, arquivo leve e fallback nativo',()=>{
  const source=fs.readFileSync(path.join(root,'js/smart-camera.js'),'utf8');
  assert.match(source,/data-flash-mode="auto"/);
  assert.match(source,/data-flash-mode="on"/);
  assert.match(source,/data-flash-mode="off"/);
  assert.match(source,/canvas\.toBlob[\s\S]*'image\/jpeg',\.72/);
  assert.match(source,/maxWidth=1280/);
  assert.match(source,/Usar câmera do aparelho/);
});

test('service worker prioriza versão publicada e mantém fallback offline',()=>{
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(sw,/gestao-pms-v162/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)/);
  assert.match(sw,/setTimeout\(\(\)=>cached\(\)\.then\(resolve\),1400\)/);
  assert.match(sw,/offlineCached/);
  assert.match(html,/updateViaCache:'none'/);
  assert.match(html,/registration\.update\(\)/);
});
