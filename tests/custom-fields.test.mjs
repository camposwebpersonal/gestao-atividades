import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldTypeHasOptions,normalizeChoiceValues,customFieldControl,collectCustomFieldValues,formatCustomFieldValue} from '../js/custom-fields.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('campos de múltipla e única escolha compartilham opções configuráveis',()=>{
 assert.equal(fieldTypeHasOptions('checkboxes'),true);assert.equal(fieldTypeHasOptions('radio'),true);
 const multiple=customFieldControl({field_name:'Tipo de serviço',field_type:'checkboxes',options:['Entupido','Estourado','Tampa']},['Estourado','Tampa'],esc);
 assert.match(multiple,/type="checkbox"/);assert.equal((multiple.match(/checked/g)||[]).length,2);assert.match(multiple,/Estourado/);
 const single=customFieldControl({field_name:'Área',field_type:'radio',options:['Urbana','Rural']},'Rural',esc);
 assert.match(single,/type="radio"/);assert.equal((single.match(/checked/g)||[]).length,1);
});

test('valores antigos e valores múltiplos são normalizados e formatados',()=>{
 assert.deepEqual(normalizeChoiceValues('Entupido; Tampa'),['Entupido','Tampa']);
 assert.equal(formatCustomFieldValue(['Entupido','Tampa']),'Entupido, Tampa');
 assert.doesNotMatch(customFieldControl({field_name:'Teste',field_type:'radio',options:['A']},'<script>',esc),/<script>/);
});

test('coleta escolhas sem apagar outros campos extras',()=>{
 const normal=[{dataset:{efKey:'Endereço'},value:'Rua A'}];
 const groups=[
  {dataset:{efChoiceKey:'Tipo de serviço',efChoiceType:'checkboxes'},querySelectorAll:()=>[{value:'Entupido'},{value:'Tampa'}]},
  {dataset:{efChoiceKey:'Área',efChoiceType:'radio'},querySelectorAll:()=>[{value:'Rural'}]}
 ];
 const root={querySelectorAll:selector=>selector==='[data-ef-key]'?normal:groups};
 assert.deepEqual(collectCustomFieldValues(root,{solicitante:'Maria'}),{solicitante:'Maria',Endereço:'Rua A','Tipo de serviço':['Entupido','Tampa'],Área:'Rural'});
});
