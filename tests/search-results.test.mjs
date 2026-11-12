import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recordSearchFields, foundIn, snippetHtml, organizeResults, resultsPageHtml, dropdownRowHtml} from '../js/search-results.js';

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
    assert.match(html, /dropdownRowHtml\(entry,q,index,index===_globalSearchActive\)/);
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
