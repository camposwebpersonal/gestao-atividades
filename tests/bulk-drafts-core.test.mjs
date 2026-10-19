import test from 'node:test';
import assert from 'node:assert/strict';
import {createBulkDraft,updateBulkDraft,submitBulkDraft} from '../js/bulk-drafts-core.js';

test('cria rascunho nomeado com linhas vazias',async()=>{
 let sent;
 const client={from:()=>({insert:value=>(sent=value,{select:()=>({single:async()=>({data:{id:'d1',...value},error:null})})})})};
 const result=await createBulkDraft(client,{groupId:'g1',title:' Lote Ricardo ',rowCount:140,columnSignature:['description']});
 assert.equal(sent.title,'Lote Ricardo');assert.equal(sent.grid_data.rows.length,140);assert.equal(result.id,'d1');
});

test('atualiza rascunho sem permitir troca de dono',async()=>{
 let sent;
 const client={from:()=>({update:value=>(sent=value,{eq:()=>({select:()=>({single:async()=>({data:{id:'d1',...value},error:null})})})})})};
 await updateBulkDraft(client,'d1',{title:'Continuação',owner_id:'outro',grid_data:{rows:[{description:'A'}]}});
 assert.equal(sent.owner_id,undefined);assert.equal(sent.title,'Continuação');assert.ok(sent.updated_at);
});

test('envio atômico exige confirmação de todas as linhas',async()=>{
 const rows=[{id:'1'},{id:'2'}];
 const ok={rpc:async(name,args)=>({data:rows,error:null,name,args})};
 assert.equal((await submitBulkDraft(ok,'d1',rows)).length,2);
 const incomplete={rpc:async()=>({data:[rows[0]],error:null})};
 await assert.rejects(()=>submitBulkDraft(incomplete,'d1',rows),/confirmou 1 de 2/);
});
