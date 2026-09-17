const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function app(){
 const nodes={content:{innerHTML:''},'pw-view':{innerHTML:''}},tables=[],messages=[],images=[],settings=[],saved=[];
 const well=(id,status,payment)=>({id,atividade_id:'s',item_id:'d',description:id,extra_fields:{registro_tipo:'poco',status_perfuracao:status,status_pagamento:payment}});
 const S={secs:[{id:'s'}],items:[{id:'d',atividade_id:'s',description:'EMPRESA',extra_fields:{registro_tipo:'perfurador'}}],subitems:[well('SOLICITADO','solicitada','pendente'),well('EXECUTADO','executada','pendente'),well('PAGO','executada','pago'),well('ANTIGO',undefined,undefined)]};
 const pdf={lastAutoTable:{finalY:80},autoTable(options){tables.push(options);},save(name){saved.push(name);},addImage(...args){images.push(args);},splitTextToSize:text=>[text]};
 for(const name of ['setFont','setFontSize','setTextColor','setFillColor','setDrawColor','rect','roundedRect','text','addPage'])pdf[name]=()=>{};
 const ctx={S,URL,console:{error(){}},setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},document:{createElement:()=>({}),head:{appendChild(){}},getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},toast:(...args)=>messages.push(args),loadB64:async()=>null,jspdf:{jsPDF:function(options){settings.push(options);return pdf;}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/perfuracao-pocos.js'),'utf8'),ctx);return{ctx,nodes,tables,messages,images,settings,saved,pdf,S};
}

function photosApp(mode='ok'){
 const a=app(),loads=[],encodings=[];let concurrent=0,maxConcurrent=0;
 a.S.subitems.forEach((p,i)=>{p.extra_fields.imagens=[`https://i.ibb.co/PHOTO${i}/image.jpg?existing=1`];});
 a.ctx.setTimeout=(fn,ms)=>ms===8000?setTimeout(fn,mode==='timeout'?2:1000):0;a.ctx.clearTimeout=clearTimeout;
 a.ctx.Image=class{
  naturalWidth=3200;naturalHeight=2000;
  set src(url){if(!url)return;loads.push(url);concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);
   if(mode==='timeout'&&url.includes('images.weserv.nl')){concurrent--;return;}
   setImmediate(()=>{concurrent--;if(mode==='fail'||(mode==='fallback'&&url.includes('images.weserv.nl')))this.onerror?.();else this.onload?.();});
  }
 };
 a.ctx.document.createElement=type=>type==='canvas'?{width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toDataURL(format,quality){encodings.push({format,quality,w:this.width,h:this.height});return 'data:image/jpeg;base64,'+'A'.repeat(mode==='large'?this.width>480?100000:60000:12000);}}:{};
 return{...a,loads,encodings,maxConcurrent:()=>maxConcurrent};
}
test('inclui fotos de todos os poços, compacta e limita concorrência; reutiliza cache',async()=>{
 const a=photosApp();a.S.subitems[0].extra_fields.imagens=Array.from({length:7},(_,i)=>`https://i.ibb.co/SET${i}/photo.jpg`);
 await a.ctx.gerarPdfPocos('s');assert.equal(a.saved.length,1);assert.equal(a.images.length,10);assert.equal(a.maxConcurrent(),3);
 assert.ok(a.encodings.every(e=>e.format==='image/jpeg'&&e.quality<=.38&&e.w<=640&&e.h<=640));assert.equal(a.settings[0].compress,true);
 assert.ok(a.loads.every(url=>url.includes('w=640')&&url.includes('q=35')&&!url.includes('?t=')));
 const reads=a.loads.length;await a.ctx.gerarPdfPocos('s');assert.equal(a.loads.length,reads);assert.equal(a.saved.length,2);
});
test('falha na versão compacta tenta origem estável sem perder fotos',async()=>{
 const a=photosApp('fallback');await a.ctx.gerarPdfPocos('s');assert.equal(a.images.length,4);assert.equal(a.saved.length,1);
 assert.ok(a.loads.includes('https://i.ibb.co/PHOTO0/image.jpg?existing=1'));assert.ok(!a.loads.some(url=>url.includes('?t=')));
});
test('timeout libera carregamento e tenta a próxima origem',async()=>{
 const a=photosApp('timeout');await a.ctx.gerarPdfPocos('s');assert.equal(a.saved.length,1);assert.equal(a.images.length,4);
});
test('falhas definitivas não baixam PDF incompleto e podem ser repetidas',async()=>{
 const a=photosApp('fail');await a.ctx.gerarPdfPocos('s');assert.equal(a.saved.length,0);assert.match(a.messages.at(-1)[0],/4 foto.*não carregaram/);
 const attempts=a.loads.length;await a.ctx.gerarPdfPocos('s');assert.ok(a.loads.length>attempts);assert.equal(a.saved.length,0);
});
test('erro ao inserir foto não salva PDF incompleto; resumo sem fotos permanece disponível',async()=>{
 const a=photosApp();a.pdf.addImage=()=>{throw Error('JPEG inválido');};await a.ctx.gerarPdfPocos('s');assert.equal(a.saved.length,0);assert.match(a.messages.at(-1)[0],/inserir a imagem/);
 await a.ctx.gerarPdfPocos('s',{incluirFotos:false});assert.equal(a.saved.length,1);
});
test('fotos maiores recebem compressão adicional sem recorte',async()=>{
 const a=photosApp('large');await a.ctx.gerarPdfPocos('s');assert.equal(a.saved.length,1);assert.ok(a.encodings.some(e=>e.w===480&&e.h===300&&e.quality===.25));
});
