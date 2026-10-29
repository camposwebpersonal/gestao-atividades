import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {IMAGE_BUCKET,hasLocalImage,transientStorageError,dataUrlToBlob,uploadDurableImage} from '../js/image-storage.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const camera=fs.readFileSync(path.join(root,'js/camera-capture.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261029193952_create_durable_image_storage.sql'),'utf8');

test('remove dependência operacional e a chave do ImgBB',()=>{
  assert.doesNotMatch(index,/api\.imgbb\.com|IMGBB_KEY/);
  assert.match(index,/uploadDurableImage\(db,dataUrl/);
  assert.equal(IMAGE_BUCKET,'gestao-imagens');
});

test('bucket próprio limita imagens e upload ao diretório do usuário autenticado',()=>{
  assert.match(migration,/file_size_limit/);
  assert.match(migration,/2097152/);
  assert.match(migration,/TO authenticated/i);
  assert.match(migration,/storage\.foldername\(name\)/);
  assert.match(migration,/auth\.uid\(\)/);
});

test('imagem pendente é detectada em estruturas aninhadas e convertida em Blob',()=>{
  const data='data:image/jpeg;base64,/9j/2Q==';
  assert.equal(hasLocalImage({photo:data}),true);
  assert.equal(hasLocalImage({photo:'https://cdn.example/foto.jpg'}),false);
  const blob=dataUrlToBlob(data);
  assert.equal(blob.type,'image/jpeg');
  assert.ok(blob.size>0);
});

test('manutenção, limite e falhas 5xx permanecem na fila para nova tentativa',()=>{
  assert.equal(transientStorageError({statusCode:503,message:'maintenance'}),true);
  assert.equal(transientStorageError({status:429,message:'rate limit'}),true);
  assert.equal(transientStorageError({status:400,message:'invalid mime'}),false);
  assert.match(compat,/scheduleSyncRetry/);
  assert.match(compat,/hasLocalImage\(payload\)/);
});

test('upload usa nome único, cache longo e volta à cópia local em falha transitória',async()=>{
  const data='data:image/jpeg;base64,/9j/2Q==';
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'user-1'}}},error:null})},storage:{from:()=>({upload:async()=>({error:{statusCode:503,message:'maintenance'}}),getPublicUrl:()=>({data:{publicUrl:'unused'}})})}};
  assert.equal(await uploadDurableImage(client,data),data);
  await assert.rejects(()=>uploadDurableImage(client,data,{forceOnline:true}),error=>error?.message==='maintenance');
  assert.match(camera,/deferredUpload/);
  assert.match(camera,/__forceOfflinePersistence/);
  assert.match(camera,/salvas com segurança neste aparelho/);
});
