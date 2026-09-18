const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=source.indexOf("    if(ud.exists()){const d=ud.data();S.isAdmin=");
const code=source.slice(start,source.indexOf('\n  }catch(e){',start));
function permissions(profile){const ctx={S:{},ud:{exists:()=>!!profile,data:()=>profile},toast(){}};vm.createContext(ctx);vm.runInContext(code,ctx);return ctx.S;}
test('conta sem perfil não recebe administração',()=>{const s=permissions(null);assert.equal(s.isAdmin,false);assert.equal(s.userRole,'usuario');});
test('perfis existentes conservam admin, gestor e consulta',()=>{assert.equal(permissions({role:'admin'}).isAdmin,true);assert.equal(permissions({role:'gestor'}).isAdmin,false);assert.equal(permissions({role:'usuario'}).isAdmin,false);assert.equal(permissions({isAdmin:true}).isAdmin,true);});
