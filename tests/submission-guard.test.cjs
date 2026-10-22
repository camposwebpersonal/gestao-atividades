const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function guard(){
  const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const code=source.slice(source.indexOf('const _savingButtons='),source.indexOf('window.toggleSidebar'));
  let clickHandler;
  const messages=[];
  const ctx={window:{},queueMicrotask,clearTimeout,setTimeout,toast:message=>messages.push(message),document:{addEventListener:(name,handler,capture)=>{if(name==='click'&&capture)clickHandler=handler;}}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return{ctx,clickHandler,messages};
}

function button(label='💾 Salvar lançamento'){
  const attrs=new Map();
  return{dataset:{},textContent:label,isConnected:true,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute(key){attrs.delete(key);if(key==='data-saving')delete this.dataset.saving;},attrs,closest(selector){return selector==='button.btn-save'?this:null;}};
}

test('primeiro toque trava imediatamente e o segundo não executa o salvamento',async()=>{
  const app=guard(),target=button();let prevented=0,stopped=0;
  const event={target,preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
  app.clickHandler(event);await Promise.resolve();
  assert.equal(target.dataset.saving,'1');assert.equal(target.attrs.get('aria-busy'),'true');assert.equal(target.textContent,'⏳ Salvando…');
  app.clickHandler({...event,target:button('💾 Salvar no rodapé')});
  assert.equal(prevented,1);assert.equal(stopped,1);assert.match(app.messages[0],/já foi recebido/);
  app.ctx.window.releaseSaveButtons();assert.equal(target.dataset.saving,undefined);assert.equal(target.textContent,'💾 Salvar lançamento');
});

test('ações não relacionadas a salvar permanecem livres',()=>{
  const app=guard(),target={closest:()=>null};let prevented=false;
  app.clickHandler({target,preventDefault:()=>{prevented=true;},stopImmediatePropagation(){}});
  assert.equal(prevented,false);assert.equal(app.messages.length,0);
});
