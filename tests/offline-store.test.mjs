import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLocalConstraints} from '../js/offline-store.js';

const snake=value=>value.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
const where=(field,op,value)=>({_type:'where',field,op,value});
const orderBy=(field,direction='asc')=>({_type:'orderBy',field,direction});
const limit=n=>({_type:'limit',n});

test('filtros offline repetem igualdade, inclusão e array-contains',()=>{
  const rows=[
    {id:'1',group_id:'a',status:'pendente',tags:['urgente']},
    {id:'2',group_id:'b',status:'pago',tags:['normal']},
    {id:'3',group_id:'a',status:'executado',tags:['urgente','foto']}
  ];
  assert.deepEqual(applyLocalConstraints(rows,[where('groupId','==','a')],snake).map(x=>x.id),['1','3']);
  assert.deepEqual(applyLocalConstraints(rows,[where('status','in',['pago','executado'])],snake).map(x=>x.id),['2','3']);
  assert.deepEqual(applyLocalConstraints(rows,[where('tags','array-contains','foto')],snake).map(x=>x.id),['3']);
});

test('ordenação e limite offline preservam a consulta da interface',()=>{
  const rows=[{id:'a',order_num:20},{id:'b',order_num:5},{id:'c',order_num:10}];
  assert.deepEqual(applyLocalConstraints(rows,[orderBy('orderNum','asc'),limit(2)],snake).map(x=>x.id),['b','c']);
  assert.deepEqual(applyLocalConstraints(rows,[orderBy('orderNum','desc')],snake).map(x=>x.id),['a','c','b']);
});

test('datas ausentes ficam no fim da ordenação offline',()=>{
  const rows=[{id:'vazio',updated_at:null},{id:'novo',updated_at:'2026-10-21'},{id:'antigo',updated_at:'2026-10-20'}];
  assert.deepEqual(applyLocalConstraints(rows,[orderBy('updatedAt','desc')],snake).map(x=>x.id),['novo','antigo','vazio']);
});
