// Organização e exibição dos resultados da busca global.
// Lançamentos aparecem agrupados por Secretaria → Grupo, com o termo destacado e a
// indicação do campo onde ele foi encontrado (ex.: "Assunto: PIPA D'ÁGUA").
import {highlightSearchText, normalizeSearchText, searchText, searchTokens} from './search-engine.js?v=1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Chaves internas de extra_fields que não são conteúdo digitado pelo usuário.
const INTERNAL_KEY = /^(show_|item_show_|sub_show_|default_|geo_location$|pipa_|attendance|audit|order|sort|layout|view_|cover|resp_url|color$|icon$)/i;

function extraOf(record) {
    try { return typeof record?.extra_fields === 'string' ? JSON.parse(record.extra_fields || '{}') || {} : record?.extra_fields || {}; }
    catch { return {}; }
}

const prettyKey = key => String(key || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

/** Campos legíveis de um lançamento (item ou subitem), na ordem em que serão mostrados. */
export function recordSearchFields(record, {parent} = {}) {
    const fields = [];
    const push = (label, value) => {
        if (value == null || typeof value === 'boolean' || typeof value === 'object') return;
        const text = String(value).trim();
        if (text) fields.push({label, value: text});
    };
    push('Nome', record?.description || record?.name);
    push('Observação', record?.observacao);
    push('Responsáveis', record?.responsaveis);
    for (const [key, value] of Object.entries(extraOf(record))) if (!INTERNAL_KEY.test(key)) push(prettyKey(key), value);
    if (parent) push('Item principal', parent.description);
    return fields;
}

/** Trecho do texto em volta do primeiro termo encontrado, com destaque. */
export function snippetHtml(value, query, radius = 56) {
    const source = String(value ?? '');
    const tokens = searchTokens(query).filter(token => token.length > 1);
    if (source.length <= radius * 2 || !tokens.length) return highlightSearchText(source, query);
    const plain = source.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
    // índice aproximado: a remoção de acentos não muda a quantidade de letras base
    let first = -1;
    for (const token of tokens) { const at = plain.indexOf(token); if (at >= 0 && (first < 0 || at < first)) first = at; }
    if (first < 0) return highlightSearchText(source.slice(0, radius * 2), query) + '…';
    const start = Math.max(0, first - radius), end = Math.min(source.length, first + radius);
    return (start > 0 ? '…' : '') + highlightSearchText(source.slice(start, end).trim(), query) + (end < source.length ? '…' : '');
}

/** Campos onde os termos aparecem (os que têm mais termos primeiro). */
export function foundIn(fields, query, {exclude = [], max = 2} = {}) {
    const tokens = searchTokens(query);
    if (!tokens.length) return [];
    const hits = [];
    fields.forEach((field, order) => {
        if (exclude.includes(field.label)) return;
        const normalized = normalizeSearchText(field.value);
        let count = 0;
        for (const token of tokens) if (normalized.includes(token) || searchText(field.value, token).matched) count += 1;
        if (count) hits.push({...field, count, order});
    });
    return hits.sort((a, b) => b.count - a.count || a.order - b.order).slice(0, max)
        .map(hit => ({label: hit.label, html: snippetHtml(hit.value, query)}));
}

const TYPE_LABEL = {module: 'Área', group: 'Grupo', item: 'Lançamento', subitem: 'Subitem', contact: 'Contato', responsible: 'Responsável', secretary: 'Secretaria', user: 'Usuário', water: 'Captação'};
export const searchTypeLabel = type => TYPE_LABEL[type] || 'Outros';
const OTHER_ORDER = ['module', 'secretary', 'contact', 'responsible', 'water', 'user'];

/**
 * Separa os resultados:
 *  - tree: Secretaria → Grupo → lançamentos (itens e subitens), ordenados pela relevância
 *  - others: demais tipos (áreas, contatos, responsáveis, secretarias...)
 */
export function organizeResults(results) {
    const secretaries = new Map();
    const others = new Map();
    for (const entry of results) {
        if (!['group', 'item', 'subitem'].includes(entry.type)) {
            if (!others.has(entry.type)) others.set(entry.type, []);
            others.get(entry.type).push(entry);
            continue;
        }
        const group = entry.type === 'group' ? entry.data : entry.group;
        const secKey = entry.secretaryId || '__sem__';
        if (!secretaries.has(secKey)) secretaries.set(secKey, {id: entry.secretaryId || '', name: entry.secretaryName || 'Sem secretaria', score: 0, count: 0, groups: new Map()});
        const sec = secretaries.get(secKey);
        sec.score = Math.max(sec.score, entry.score || 0);
        const gKey = String(group?.id || '');
        if (!sec.groups.has(gKey)) sec.groups.set(gKey, {group, score: 0, groupMatched: false, rows: []});
        const bucket = sec.groups.get(gKey);
        bucket.score = Math.max(bucket.score, entry.score || 0);
        if (entry.type === 'group') bucket.groupMatched = true;
        else { bucket.rows.push(entry); sec.count += 1; }
    }
    const tree = [...secretaries.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
        .map(sec => ({...sec, groups: [...sec.groups.values()].sort((a, b) => b.score - a.score)}));
    const otherList = [...others.entries()].sort((a, b) => OTHER_ORDER.indexOf(a[0]) - OTHER_ORDER.indexOf(b[0]));
    return {tree, others: otherList};
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const jsArg = value => esc(JSON.stringify(String(value ?? '')));

function foundInHtml(entry, query) {
    const hits = entry.foundIn || [];
    if (!hits.length) return '';
    return `<span class="search-found">${hits.map(hit => `<span><b>${esc(hit.label)}:</b> ${hit.html}</span>`).join('')}</span>`;
}

/** Linha do painel que aparece enquanto digita. */
export function dropdownRowHtml(entry, query, index, active) {
    const crumbs = (entry.crumbs || [entry.context]).filter(Boolean);
    return `<button type="button" class="global-search-result${active ? ' active' : ''}" role="option" aria-selected="${active}" data-search-index="${index}" onmouseenter="selecionarResultadoBuscaGlobal(${index})" onclick="ativarResultadoBuscaGlobal(${index})">`
        + `<span class="global-search-result-icon">${esc(entry.icon)}</span>`
        + `<span class="global-search-result-copy"><strong>${highlightSearchText(entry.title, query)}</strong>`
        + `<small class="search-crumbs">${crumbs.map(c => highlightSearchText(c, query)).join('<i aria-hidden="true">›</i>')}</small>`
        + foundInHtml({foundIn: (entry.foundIn || []).slice(0, 1)}, query) + `</span>`
        + `<span class="global-search-result-type is-${esc(entry.type)}">${esc(searchTypeLabel(entry.type))}</span><span class="global-search-open">↗</span></button>`;
}

/** Página completa de resultados. */
export function resultsPageHtml(results, query) {
    const {tree, others} = organizeResults(results);
    const launchCount = tree.reduce((sum, sec) => sum + sec.count, 0);
    const summaryChips = [
        ...tree.map((sec, i) => `<a href="#busca-sec-${i}" class="search-chip">🏛️ ${esc(sec.name)} <b>${sec.count}</b></a>`),
        ...others.map(([type, rows]) => `<a href="#busca-tipo-${esc(type)}" class="search-chip">${esc(searchTypeLabel(type))} <b>${rows.length}</b></a>`)
    ].join('');
    const row = entry => `<button type="button" class="search-launch" onclick="ativarResultadoBuscaPorId(${jsArg(entry.type)},${jsArg(entry.data?.id)})">`
        + `<span class="search-launch-type is-${esc(entry.type)}">${esc(searchTypeLabel(entry.type))}</span>`
        + `<span class="search-launch-copy"><strong>${highlightSearchText(entry.title, query)}</strong>`
        + (entry.type === 'subitem' && entry.parentTitle ? `<small class="search-parent">Dentro de: ${highlightSearchText(entry.parentTitle, query)}</small>` : '')
        + foundInHtml(entry, query) + `</span><span class="search-launch-open" aria-hidden="true">→</span></button>`;
    const groupBlock = bucket => {
        const name = bucket.group?.name || 'Grupo sem nome';
        return `<div class="search-group">`
            + `<header><span aria-hidden="true">${esc(bucket.group?.icon || '▤')}</span><div><strong>${highlightSearchText(name, query)}</strong>`
            + `<small>${bucket.rows.length ? plural(bucket.rows.length, 'lançamento encontrado', 'lançamentos encontrados') : 'O nome do grupo corresponde à busca'}</small></div>`
            + `<button type="button" onclick="ativarResultadoBuscaPorId('group',${jsArg(bucket.group?.id)})">Abrir grupo</button></header>`
            + (bucket.rows.length ? `<div class="search-group-rows">${bucket.rows.map(row).join('')}</div>` : '')
            + `</div>`;
    };
    const secSections = tree.map((sec, i) => `<section class="search-sec" id="busca-sec-${i}">`
        + `<header class="search-sec-head"><span aria-hidden="true">🏛️</span><div><h2>${highlightSearchText(sec.name, query)}</h2>`
        + `<small>${plural(sec.groups.length, 'grupo', 'grupos')} · ${plural(sec.count, 'lançamento', 'lançamentos')}</small></div></header>`
        + sec.groups.map(groupBlock).join('') + `</section>`).join('');
    const otherSections = others.map(([type, rows]) => `<section class="search-sec search-sec-other" id="busca-tipo-${esc(type)}">`
        + `<header class="search-sec-head"><span aria-hidden="true">${esc(rows[0]?.icon || '•')}</span><div><h2>${esc(searchTypeLabel(type))}</h2><small>${plural(rows.length, 'resultado', 'resultados')}</small></div></header>`
        + `<div class="search-group-rows">${rows.map(entry => `<button type="button" class="search-launch" onclick="ativarResultadoBuscaPorId(${jsArg(entry.type)},${jsArg(entry.data?.id)})"><span class="search-launch-type is-${esc(type)}">${esc(searchTypeLabel(type))}</span><span class="search-launch-copy"><strong>${highlightSearchText(entry.title, query)}</strong>${entry.context ? `<small class="search-parent">${highlightSearchText(entry.context, query)}</small>` : ''}</span><span class="search-launch-open" aria-hidden="true">→</span></button>`).join('')}</div></section>`).join('');
    return {html: (summaryChips ? `<nav class="search-chips" aria-label="Resumo dos resultados">${summaryChips}</nav>` : '') + secSections + otherSections, launchCount, secretaryCount: tree.length};
}
