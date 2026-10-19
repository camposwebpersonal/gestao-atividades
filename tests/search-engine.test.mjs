import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearchText,searchText,searchRecord,rankSearch,highlightSearchText} from '../js/search-engine.js';

test('normaliza acentos, pontuação e caixa',()=>assert.equal(normalizeSearchText('  SOLICITAÇÃO — Básica! '),'solicitacao basica'));
test('encontra várias palavras mesmo fora de ordem',()=>assert.equal(searchText('Maria Silva responsável pela Educação','educacao maria').matched,true));
test('entende abreviações e termos relacionados',()=>assert.equal(searchText('Telefone institucional 87 9999','fone 9999').matched,true));
test('tolera pequeno erro de digitação sem aceitar termo distante',()=>{
 assert.equal(searchText('Secretaria de Educação','educasao').matched,true);
 assert.equal(searchText('Secretaria de Educação','agricultura').matched,false);
});
test('busca valores aninhados de campos personalizados',()=>assert.equal(searchRecord({extra_fields:{'Número do Processo':'2026-0042'}},'processo 0042').matched,true));
test('ordena a correspondência exata antes da parcial',()=>{
 const ranked=rankSearch(['Educação infantil','Secretaria de Educação'],'secretaria educacao',value=>value);
 assert.equal(ranked[0].record,'Secretaria de Educação');
});
test('destaca texto ignorando acentos e escapa HTML',()=>assert.equal(highlightSearchText('Educação <b>','educacao'),'<mark>Educação</mark> &lt;b&gt;'));
