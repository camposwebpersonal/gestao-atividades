const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function app(){
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),images=[];
 const nodes={'lb-img':{src:'',removeAttribute(){this.src='';}},lightbox:{style:{display:'none'}},'lb-close':{focus(){}}};
 class Image{constructor(){images.push(this);}decode(){return Promise.resolve();}}
 const ctx={Image,document:{getElementById:id=>nodes[id],addEventListener(){},activeElement:{isConnected:true,focus(){}}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let _lbPreviousFocus=null'),source.indexOf('// ── IMGBB ──')),ctx);
 return {ctx,nodes,images};
}
test('miniatura aparece imediatamente e versão ampliada só substitui após carregar',async()=>{
 const a=app();a.ctx.openLb('original','Foto','miniatura','webp');assert.equal(a.nodes['lb-img'].src,'miniatura');assert.equal(a.nodes.lightbox.style.display,'flex');assert.equal(a.images[0].src,'webp');
 a.images[0].onload();await settle();assert.equal(a.nodes['lb-img'].src,'webp');
 a.ctx.closeLb();a.ctx.openLb('original','Foto','miniatura','webp');await settle();assert.equal(a.nodes['lb-img'].src,'webp');assert.equal(a.images.length,1);
});
test('pré-carregamento é reutilizado e erro da versão leve usa o original',async()=>{
 const a=app();a.ctx.preloadLb('webp');a.ctx.openLb('original','Foto','miniatura','webp');assert.equal(a.images.length,1);assert.equal(a.images[0].fetchPriority,'high');
 a.images[0].onerror();await settle();assert.equal(a.nodes['lb-img'].src,'miniatura');assert.equal(a.images[1].src,'original');a.images[1].onload();await settle();assert.equal(a.nodes['lb-img'].src,'original');
});
test('respostas atrasadas não reabrem imagem fechada nem substituem outra foto',async()=>{
 const a=app();a.ctx.openLb('a','Foto A','thumb-a','webp-a');a.ctx.openLb('b','Foto B','thumb-b','webp-b');a.images[0].onload();await settle();assert.equal(a.nodes['lb-img'].src,'thumb-b');
 a.ctx.closeLb();a.images[1].onload();await settle();assert.equal(a.nodes.lightbox.style.display,'none');assert.equal(a.nodes['lb-img'].src,'');
});
