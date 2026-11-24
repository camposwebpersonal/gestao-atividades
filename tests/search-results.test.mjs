import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recordSearchFields, foundIn, snippetHtml, organizeResults, resultsPageHtml, dropdownRowHtml, prioritizeResults, dropdownHtml} from '../js/search-results.js';

const retro = {id: 'g1', name: 'SERVIÇOS DE URGENCIA PARA A RETRO'};
const pipaGroup = {id: 'g2', name: 'SOLICITAÇÃO DE ÁGUA DE PIPA'};
const adriana = {id: 'i1', description: 'ADRIANA MARIA DA SILVA', extra_fields: JSON.stringify({Telefone: '(87)99144-6021', Endereco: 'SÍTIO CAITITU', Assunto: "PIPA D'ÁGUA", show_conclusion_date: 0, item_show_verba: 0})};

test('campos do lançamento ignoram configurações internas e mantêm os campos digitados', () => {
    const fields = recordSearchFields(adriana);
    const labels = fields.map(f => f.label);
    assert.deepEqual(labels, ['Nome', 'Telefone', 'Endereco', 'Assunto']);
});

test('mostra em qual campo o termo foi encontrado, com destaque', () => {
    const hits = foundIn(recordSearchFields(adriana), 'pipa', {exclude: ['Nome']});
    assert.equal(hits.length, 1);
    assert.equal(hits[0].label, 'Assunto');
    assert.equal(hits[0].html, "<mark>PIPA</mark> D&#39;ÁGUA");
});

test('trecho longo é recortado em volta do termo', () => {
    const long = 'A'.repeat(200) + ' carro pipa urgente ' + 'B'.repeat(200);
    const html = snippetHtml(long, 'pipa');
    assert.match(html, /^…/);
    assert.match(html, /<mark>pipa<\/mark>/);
    assert.ok(html.length < 200);
});

test('organiza por Secretaria → Grupo → lançamentos e separa os demais tipos', () => {
    const results = [
        {type: 'item', title: 'RICARDINHO TESTANDO', data: {id: 'i2'}, group: pipaGroup, secretaryId: 's1', secretaryName: 'GABINETE', score: 200},
        {type: 'item', title: 'ADRIANA MARIA DA SILVA', data: adriana, group: retro, secretaryId: 's2', secretaryName: 'SECRETARIA DE AGRICULTURA', score: 120},
        {type: 'group', title: pipaGroup.name, data: pipaGroup, secretaryId: 's1', secretaryName: 'GABINETE', score: 180},
        {type: 'contact', title: 'Posto da Pipa', data: {id: 'c1'}, context: 'Contato', score: 90}
    ];
    const {tree, others} = organizeResults(results);
    assert.deepEqual(tree.map(s => s.name), ['GABINETE', 'SECRETARIA DE AGRICULTURA']);
    assert.equal(tree[0].groups[0].groupMatched, true);
    assert.equal(tree[0].groups[0].rows.length, 1);
    assert.equal(tree[0].count, 1);
    assert.equal(others[0][0], 'contact');
});

test('página mostra secretaria, grupo, lançamento destacado e onde o termo apareceu', () => {
    const entry = {type: 'item', icon: '•', title: 'ADRIANA MARIA DA SILVA', data: adriana, group: retro, secretaryId: 's2', secretaryName: 'SECRETARIA DE AGRICULTURA', score: 100, foundIn: foundIn(recordSearchFields(adriana), 'pipa', {exclude: ['Nome']})};
    const {html, launchCount, secretaryCount} = resultsPageHtml([entry], 'pipa');
    assert.equal(launchCount, 1);
    assert.equal(secretaryCount, 1);
    assert.match(html, /SECRETARIA DE AGRICULTURA/);
    assert.match(html, /SERVIÇOS DE URGENCIA PARA A RETRO/);
    assert.match(html, /<b>Assunto:<\/b> <mark>PIPA<\/mark>/);
    assert.match(html, /Abrir grupo/);
    const row = dropdownRowHtml({...entry, crumbs: ['SECRETARIA DE AGRICULTURA', retro.name]}, 'pipa', 0, true);
    assert.match(row, /search-crumbs/);
    assert.match(row, /<i aria-hidden="true">›<\/i>/);
    assert.match(row, /Lançamento/);
});

test('busca do topo usa a nova organização e a película não cobre mais o campo no celular', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const css = fs.readFileSync('css/global-search-premium.css', 'utf8');
    assert.match(html, /resultsPageHtml\(_globalSearchResults,q\)/);
    assert.match(html, /dropdownHtml\(_globalSearchResults,q,_globalSearchActive\)/);
    assert.match(html, /prioritizeResults\(rankSearch\(/);
    assert.match(html, /secretaryOf=\(group,record\)/);
    assert.match(css, /body\.global-search-open #navbar\{z-index:1601!important\}/);
});

// Regressão: grupo sem secretaria cujo nome casou não pode aparecer duas vezes
// ("Sem secretaria" + a secretaria dos lançamentos).
{
    const {organizeResults: org} = await import('../js/search-results.js');
    const group = {id: 'g1', name: 'BENEFICIÁRIOS MINHA CASA MINHA VIDA'};
    const rows = [
        {type: 'group', data: group, secretaryId: '', secretaryName: '', score: 9},
        ...Array.from({length: 3}, (_, i) => ({type: 'item', group, data: {id: 'i' + i}, secretaryId: 'adm', secretaryName: 'ADMINISTRAÇÃO', score: 5})),
        {type: 'item', group, data: {id: 'x'}, secretaryId: 'soc', secretaryName: 'AÇÃO SOCIAL', score: 4},
    ];
    const {tree} = org(rows);
    const sem = tree.find(sec => sec.name === 'Sem secretaria');
    if (sem) throw new Error('grupo duplicado em "Sem secretaria"');
    const adm = tree.find(sec => sec.id === 'adm');
    if (!adm.groups[0].groupMatched || adm.count !== 3) throw new Error('grupo deveria ficar em ADMINISTRAÇÃO');
    console.log('ok - grupo sem secretaria não duplica na busca');
}

test('grupo cujo nome tem o termo vem antes de qualquer lançamento (ex.: "areia")', () => {
    const areia = {id: 'ga', name: 'PEDIDOS DE AREIA'};
    const results = [
        {type: 'item', title: 'AREIA', data: {id: 'i1'}, group: retro, score: 400},
        {type: 'item', title: 'JOÃO', data: {id: 'i2'}, group: retro, score: 300, foundIn: []},
        {type: 'group', title: areia.name, data: areia, crumbs: ['INFRAESTRUTURA'], counts: {total: 0, open: 0}, score: 90},
        {type: 'contact', title: 'Depósito de areia', data: {id: 'c1'}, score: 500},
    ];
    const sorted = prioritizeResults(results, 'areia');
    assert.equal(sorted[0].type, 'group');
    assert.equal(sorted[1].data.id, 'i1', 'lançamento com o termo no nome vem antes do que casou em outro campo');
    assert.equal(sorted.at(-1).data.id, 'i2');
    const html = dropdownHtml(sorted, 'areia', 0);
    assert.ok(html.indexOf('Grupos de lançamento') < html.indexOf('Lançamentos'), 'seção de grupos primeiro');
    assert.match(html, /grupo sem lançamentos ainda/);
    const page = resultsPageHtml(sorted, 'areia').html;
    assert.ok(page.indexOf('search-group-card') > -1 && page.indexOf('search-group-card') < page.indexOf('search-sec-head', page.indexOf('search-group-cards')), 'cards de grupo no topo da página');
});

test('secretaria cujo nome tem o termo vem antes de tudo e vira "porta" com atalhos (ex.: "mulher")', () => {
    const results = [
        {type: 'subitem', title: 'PONTO DE APOIO A MULHER', data: {id: 's1'}, group: retro, score: 900},
        {type: 'group', title: 'MULHERES CADASTRADAS', data: {id: 'g9'}, score: 800},
        {type: 'contact', title: 'Galba', context: 'Secretaria da Mulher', data: {id: 'c1'}, score: 700},
        {type: 'secretary', title: 'SECRETARIA DA MULHER', data: {id: 'smul'}, counts: {groups: 2, total: 3, open: 1}, shortcuts: [{id: 'g9', name: 'MULHERES CADASTRADAS', open: 1}], score: 100},
    ];
    const sorted = prioritizeResults(results, 'mulher');
    assert.equal(sorted[0].type, 'secretary');
    assert.equal(sorted[0].exact, 2, 'nome da secretaria sem o "SECRETARIA DA" é igual ao termo');
    assert.equal(sorted[1].type, 'group');
    const html = dropdownHtml(sorted, 'mulher', 0);
    assert.ok(html.indexOf('Secretarias') < html.indexOf('Grupos de lançamento'));
    assert.match(html, /gs-door/); assert.match(html, /Entrar/); assert.match(html, /openActivity/);
    const page = resultsPageHtml(sorted, 'mulher').html;
    assert.ok(page.indexOf('busca-secretarias') > -1 && page.indexOf('busca-secretarias') < page.indexOf('busca-grupos'));
});
