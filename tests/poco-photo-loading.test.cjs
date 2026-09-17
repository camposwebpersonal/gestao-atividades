const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('fotos visíveis carregam antecipadamente com até duas requisições e sem miniatura',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/perfuracao-pocos.js'),'utf8');const calls=[],resolvers=[],opened=[],photos=Array.from({length:3},(_,i)=>({isConnected:true,dataset:{full:'https://i.ibb.co/test/photo'+i+'.jpg'},alt:'Foto'}));let observer;
 class IntersectionObserver{constructor(cb){this.cb=cb;observer=this;}disconnect(){}unobserve(){}observe(){}}
 const ctx={URL,Promise,IntersectionObserver,document:{querySelectorAll:()=>photos},preloadLb:url=>{calls.push(url);return new Promise(resolve=>resolvers.push(resolve));},openLb:(...args)=>opened.push(args)};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const fastFullPhoto='),source.indexOf('  const style=document.createElement'))+'\nwindow.prepare=prepareVisiblePhotos;',ctx);
 ctx.prepare();observer.cb(photos.map(target=>({isIntersecting:true,target})));assert.equal(calls.length,2);
 const url=new URL(calls[0]);assert.equal(url.searchParams.get('w'),'800');assert.equal(url.searchParams.get('q'),'40');assert.equal(url.searchParams.get('output'),'webp');
 resolvers[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,3);
 ctx.pocoOpenPhoto(photos[0]);assert.equal(opened[0][2],'');assert.equal(opened[0][3],calls[0]);
 resolvers.slice(1).forEach(resolve=>resolve());
});
