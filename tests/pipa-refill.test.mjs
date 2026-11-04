import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as mod from '../js/pipa-refill.js';
import {isRefillGroup, refillStatus, recordRefillStatus, applyRefillToExtra, pipaGroupSummary, parseLocalDate, PIPA_ALERT_DAYS} from '../js/pipa-refill.js';

const day = (y, m, d) => new Date(y, m - 1, d);

test('grupos de água de pipa ativam o controle automaticamente (e podem ser ligados/desligados)', () => {
    assert.equal(isRefillGroup({name: 'SOLICITAÇÃO DE ÁGUA DE PIPA'}), true);
    assert.equal(isRefillGroup({name: 'Carros-pipa — Zona rural'}), true);
    assert.equal(isRefillGroup({name: 'PEDIDOS DE CAIXAS D\'AGUA'}), false);
    assert.equal(isRefillGroup({name: 'Pipoca'}), false);
    assert.equal(isRefillGroup({name: 'Abastecimento rural', extra_fields: {refill_control: true}}), true);
    assert.equal(isRefillGroup({name: 'ÁGUA DE PIPA', extra_fields: JSON.stringify({refill_control: false})}), false);
});

test('exemplo do pedido: abastecido em 03/11/2026 com 30 dias vence em 03/12/2026', () => {
    const s = refillStatus('2026-11-03', 30, day(2026, 11, 3));
    assert.equal(s.state, 'em-dia');
    assert.equal(s.due.getDate(), 3);
    assert.equal(s.due.getMonth(), 11); // dezembro
    assert.equal(s.daysLeft, 30);
});

test('verde em dia, amarelo a partir de 5 dias do vencimento, vermelho quando vence', () => {
    assert.equal(refillStatus('2026-11-03', 30, day(2026, 11, 27)).state, 'em-dia');   // faltam 6
    assert.equal(refillStatus('2026-11-03', 30, day(2026, 11, 28)).state, 'alerta');   // faltam 5
    assert.equal(PIPA_ALERT_DAYS, 5);
    const hoje = refillStatus('2026-11-03', 30, day(2026, 12, 3));
    assert.equal(hoje.state, 'alerta');
    assert.match(hoje.text, /Vence hoje/);
    const vencido = refillStatus('2026-11-03', 30, day(2026, 12, 4));
    assert.equal(vencido.state, 'vencido');
    assert.match(vencido.text, /Vencido há 1 dia/);
});

test('sem data ou sem intervalo fica como "sem dados"', () => {
    assert.equal(refillStatus('', 30).state, 'sem-dados');
    assert.equal(refillStatus('2026-11-03', '').state, 'sem-dados');
    assert.equal(refillStatus('2026-02-30', 30).state, 'sem-dados');
    assert.equal(parseLocalDate('2026-02-30'), null);
});

test('lê os valores salvos em extra_fields (objeto ou texto JSON)', () => {
    const asString = {extra_fields: JSON.stringify({pipa_last_refill: '2026-10-01', pipa_refill_days: 15})};
    assert.equal(recordRefillStatus(asString, day(2026, 11, 3)).state, 'vencido');
    const asObject = {extra_fields: {pipa_last_refill: '2026-11-01', pipa_refill_days: 10}};
    assert.equal(recordRefillStatus(asObject, day(2026, 11, 3)).state, 'em-dia');
});

test('salvar grava e limpar remove os campos, sem mexer nos outros campos', () => {
    const extra = {Assunto: 'PIPA', geo_location: {latitude: 1, longitude: 2}};
    applyRefillToExtra(extra, {last: '2026-11-03', days: 30});
    assert.deepEqual([extra.pipa_last_refill, extra.pipa_refill_days, extra.Assunto], ['2026-11-03', 30, 'PIPA']);
    applyRefillToExtra(extra, {last: '', days: null});
    assert.equal('pipa_last_refill' in extra, false);
    assert.equal('pipa_refill_days' in extra, false);
    assert.ok(extra.geo_location);
});

test('resumo do grupo conta cada situação e os locais com mapa', () => {
    const records = [
        {extra_fields: {pipa_last_refill: '2026-10-01', pipa_refill_days: 10}, geo: true},
        {extra_fields: {pipa_last_refill: '2026-11-01', pipa_refill_days: 5}, geo: true},
        {extra_fields: {pipa_last_refill: '2026-11-01', pipa_refill_days: 30}},
        {extra_fields: {}}
    ];
    const {counts, mapped, total} = pipaGroupSummary(records, r => Boolean(r.geo), day(2026, 11, 3));
    assert.deepEqual(counts, {vencido: 1, alerta: 1, 'em-dia': 1, 'sem-dados': 1});
    assert.equal(mapped, 2);
    assert.equal(total, 4);
});

test('formulário, mapa e cards usam o controle de reabastecimento', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const geo = fs.readFileSync('js/geolocation.js', 'utf8');
    const autoria = fs.readFileSync('js/autoria.js', 'utf8');
    assert.match(html, /isRefillGroup\(sec\)\?refillEditorHtml\(it,'it-pipa'\)/);
    assert.match(html, /applyRefillToExtra\(ef,readRefillEditor\('it-pipa'\)\)/);
    assert.match(html, /decoratePipaGroup/);
    assert.match(geo, /data-refill-filter/);
    assert.match(geo, /refillMarkerHtml\(refill\.state\)/);
    assert.match(geo, /window\.openGroupGeoMap=/);
    assert.match(autoria, /recordRefillBadge/);
    const css = fs.readFileSync('css/pipa-refill.css', 'utf8');
    for (const color of ['#dc2626', '#eab308', '#16a34a']) assert.ok(css.includes(color), color);
});

test('aplicação do pipa (completo/parcial) e famílias beneficiadas', () => {
    const {applicationText, recordSupply, applyRefillToExtra, pipaGroupSummary} = mod;
    assert.equal(applicationText('completo'), 'Pipa completo');
    assert.equal(applicationText('parcial', 50), 'Parcial · meio pipa (½)');
    assert.equal(applicationText('parcial', 40), 'Parcial · 40% do pipa');
    const extra = applyRefillToExtra({}, {last: '2026-11-01', days: 30, application: 'parcial', percent: 50, families: 4});
    assert.deepEqual(extra, {pipa_last_refill: '2026-11-01', pipa_refill_days: 30, pipa_application: 'parcial', pipa_percent: 50, pipa_families: 4});
    assert.equal(recordSupply({extra_fields: extra}).text, 'Parcial · meio pipa (½) · 4 famílias');
    const full = applyRefillToExtra({...extra}, {last: '2026-11-01', days: 30, application: 'completo', percent: null, families: 1});
    assert.equal(full.pipa_percent, undefined, 'completo não guarda porcentagem');
    assert.equal(recordSupply({extra_fields: full}).text, 'Pipa completo · 1 família');
    const summary = pipaGroupSummary([{extra_fields: extra}, {extra_fields: full}, {extra_fields: {}}]);
    assert.equal(summary.families, 5); assert.equal(summary.pipas, 1.5); assert.equal(summary.applied, 2);
    assert.match(mod.refillEditorHtml({extra_fields: extra}, 'it-pipa'), /name="it-pipa-apply" value="parcial" checked/);
    assert.match(mod.refillBadgeHtml({extra_fields: extra}), /4 famílias/);
});
