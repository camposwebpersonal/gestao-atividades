import {isSystemKey, isBlankValue} from './record-fields.js?v=d7293707';
// Organização e exibição dos resultados da busca global.
// Lançamentos aparecem agrupados por Secretaria → Grupo, com o termo destacado e a
// indicação do campo onde ele foi encontrado (ex.: "Assunto: PIPA D'ÁGUA").
import {highlightSearchText, normalizeSearchText, searchText, searchTokens} from './search-engine.js?v=b4129240';

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
    for (const [key, value] of Object.entries(extraOf(record))) if (!INTERNAL_KEY.test(key) && !isSystemKey(key) && !isBlankValue(value)) push(prettyKey(key), value);
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
    // Um grupo nunca aparece duas vezes: se o nome do grupo casou e ele também tem
    // lançamentos encontrados, a marca "grupo encontrado" vai para a seção onde estão
    // os lançamentos (a de mais lançamentos), em vez de criar uma seção à parte.
    const rowSecs = new Map();
    for (const entry of results) {
        if (entry.type !== 'item' && entry.type !== 'subitem') continue;
        const gid = String(entry.group?.id || '');
        const key = entry.secretaryId || '__sem__';
        const m = rowSecs.get(gid) || new Map();
        if (!m.has(key)) m.set(key, {id: entry.secretaryId || '', name: entry.secretaryName || '', n: 0});
        m.get(key).n += 1;
        rowSecs.set(gid, m);
    }
    for (const entry of results) {
        if (!['group', 'item', 'subitem'].includes(entry.type)) {
            if (!others.has(entry.type)) others.set(entry.type, []);
            others.get(entry.type).push(entry);
            continue;
        }
        const group = entry.type === 'group' ? entry.data : entry.group;
        let secKey = entry.secretaryId || '__sem__';
        let secId = entry.secretaryId || '', secName = entry.secretaryName || '';
        if (entry.type === 'group') {
            const homes = rowSecs.get(String(group?.id || ''));
            if (homes && homes.size && !homes.has(secKey)) {
                const best = [...homes.entries()].sort((a, b) => b[1].n - a[1].n)[0];
                secKey = best[0]; secId = best[1].id; secName = best[1].name;
            }
        }
        if (!secretaries.has(secKey)) secretaries.set(secKey, {id: secId, name: secName || 'Sem secretaria', score: 0, count: 0, groups: new Map()});
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

/**
 * Ordem da busca do topo (regras do usuário): 1º SECRETARIAS cujo nome tem o termo (23/11/2026 — clicar entra
 * nela), 2º áreas do sistema pelo nome, 3º GRUPOS DE LANÇAMENTO pelo nome (20/11/2026), 4º LANÇAMENTOS com o termo
 * no nome e, por último, o que só casou em outros campos. Dentro de cada faixa: nome igual ao termo > começa com o
 * termo > relevância.
 */
const TITLE_TIER = {secretary: 0, module: 0.5, group: 1, item: 2, subitem: 2};
export function prioritizeResults(results, query) {
    const nq = normalizeSearchText(query);
    return results.map((entry, i) => {
        const t = searchText(entry.title, query);
        const tier = t.matched ? (TITLE_TIER[entry.type] ?? 2.5) : (entry.type === 'secretary' ? 2.6 : entry.type === 'group' ? 2.8 : 3);
        const nt = normalizeSearchText(entry.title).replace(/^SECRETARIA (MUNICIPAL )?(ESPECIAL )?(D[AEO]S? )?/i, '');
        const exact = t.matched && nq && (normalizeSearchText(entry.title) === nq || nt === nq) ? 2 : t.matched && nq && nt.startsWith(nq) ? 1 : 0;
        return {...entry, tier, titleHit: t.matched, exact, titleScore: t.matched ? t.score : 0, _order: i};
    }).sort((a, b) => a.tier - b.tier || b.exact - a.exact || b.titleScore - a.titleScore || (b.score || 0) - (a.score || 0) || a._order - b._order);
}

const DROP_SECTIONS = [
    ['place', '🏛️ Secretarias e áreas', 4],
    ['group', '📁 Grupos de lançamento', 6],
    ['launch', '📝 Lançamentos', 8],
    ['other', '👤 Contatos e outros', 3],
];
const dropKind = type => type === 'group' ? 'group' : type === 'item' || type === 'subitem' ? 'launch' : type === 'module' || type === 'secretary' ? 'place' : 'other';

/** Painel instantâneo organizado em seções (secretarias primeiro). `results` já vem de prioritizeResults. */
export function dropdownHtml(results, query, active) {
    const buckets = new Map(DROP_SECTIONS.map(([k]) => [k, []]));
    results.forEach((entry, index) => buckets.get(dropKind(entry.type)).push([entry, index]));
    // secretaria/área só entra na faixa do topo quando o NOME casou; as demais descem para "outros"
    const place = buckets.get('place');
    buckets.set('place', place.filter(([e]) => e.titleHit));
    buckets.get('other').push(...place.filter(([e]) => !e.titleHit));
    return DROP_SECTIONS.map(([k, label, max]) => {
        const list = buckets.get(k); if (!list.length) return '';
        return `<div class="global-search-section is-${k}"><span>${label}</span><b>${list.length > max ? `${max} de ${list.length}` : list.length}</b></div>`
            + list.slice(0, max).map(([entry, index]) => (entry.type === 'secretary' && entry.titleHit ? secretaryDoorHtml(entry, query, index, index === active) : dropdownRowHtml(entry, query, index, index === active))).join('');
    }).join('');
}

/** "Porta" da secretaria no topo do painel: entrar com um clique + atalhos para os grupos mais movimentados. */
export function secretaryDoorHtml(entry, query, index, active) {
    const c = entry.counts || {};
    const facts = [c.groups ? plural(c.groups, 'grupo', 'grupos') : '', c.open ? `<b>${c.open} em andamento</b>` : (c.total ? plural(c.total, 'lançamento', 'lançamentos') : '')].filter(Boolean).join(' · ');
    const shortcuts = (entry.shortcuts || []).slice(0, 3);
    return `<div class="gs-door${active ? ' active' : ''}">`
        + `<button type="button" class="global-search-result is-door${active ? ' active' : ''}" role="option" aria-selected="${active}" data-search-index="${index}" onmouseenter="selecionarResultadoBuscaGlobal(${index})" onclick="ativarResultadoBuscaGlobal(${index})">`
        + `<span class="global-search-result-icon gs-door-icon">🏛️</span>`
        + `<span class="global-search-result-copy"><strong>${highlightSearchText(entry.title, query)}</strong><small class="search-crumbs">${facts || 'Secretaria municipal'}</small></span>`
        + `<span class="gs-door-go">Entrar <i aria-hidden="true">→</i></span></button>`
        + (shortcuts.length ? `<div class="gs-door-shortcuts" aria-label="Atalhos para grupos da secretaria">${shortcuts.map(g => `<button type="button" onclick="fecharBuscaGlobal();openActivity(${jsArg(g.id)})" title="${esc(g.name)}"><span aria-hidden="true">${esc(g.icon || '▤')}</span>${esc(g.name)}${g.open ? `<b>${g.open}</b>` : ''}</button>`).join('')}</div>` : '')
        + `</div>`;
}

/** Painel com o campo vazio: buscas recentes e o que foi aberto pela busca por último. */
export function recentPanelHtml({queries = [], opened = []} = {}) {
    if (!queries.length && !opened.length) return '';
    return `<div class="gs-recent">`
        + (queries.length ? `<div class="global-search-section is-recent"><span>🕘 Buscas recentes</span><button type="button" class="gs-recent-clear" onclick="limparBuscasRecentes()">limpar</button></div><div class="gs-recent-chips">${queries.map(q => `<button type="button" onclick="usarBuscaRecente(${jsArg(q)})">${esc(q)}</button>`).join('')}</div>` : '')
        + (opened.length ? `<div class="global-search-section is-recent"><span>⭐ Abertos pela busca</span></div>${opened.map(o => `<button type="button" class="global-search-result gs-recent-open" onclick="ativarResultadoBuscaPorId(${jsArg(o.type)},${jsArg(o.id)})"><span class="global-search-result-icon">${esc(o.type === 'secretary' ? '🏛️' : o.icon || '•')}</span><span class="global-search-result-copy"><strong>${esc(o.title)}</strong>${o.context ? `<small class="search-crumbs">${esc(o.context)}</small>` : ''}</span><span class="global-search-result-type is-${esc(o.type)}">${esc(searchTypeLabel(o.type))}</span><span class="global-search-open">↗</span></button>`).join('')}` : '')
        + `</div>`;
}

/** Linha do painel que aparece enquanto digita. */
export function dropdownRowHtml(entry, query, index, active) {
    const crumbs = (entry.crumbs || [entry.context]).filter(Boolean);
    return `<button type="button" class="global-search-result${active ? ' active' : ''}${entry.type === 'group' && entry.titleHit ? ' is-group-hit' : ''}" role="option" aria-selected="${active}" data-search-index="${index}" onmouseenter="selecionarResultadoBuscaGlobal(${index})" onclick="ativarResultadoBuscaGlobal(${index})">`
        + `<span class="global-search-result-icon">${esc(entry.icon)}</span>`
        + `<span class="global-search-result-copy"><strong>${highlightSearchText(entry.title, query)}</strong>`
        + `<small class="search-crumbs">${crumbs.map(c => highlightSearchText(c, query)).join('<i aria-hidden="true">›</i>')}</small>`
        + (entry.type === 'group' && entry.counts ? `<small class="search-group-count">${entry.counts.total ? `${plural(entry.counts.total, 'lançamento', 'lançamentos')}${entry.counts.open ? ` · <b>${entry.counts.open} em andamento</b>` : ''}` : 'grupo sem lançamentos ainda'}</small>` : '')
        + foundInHtml({foundIn: (entry.foundIn || []).slice(0, 1)}, query) + `</span>`
        + `<span class="global-search-result-type is-${esc(entry.type)}">${esc(searchTypeLabel(entry.type))}</span><span class="global-search-open">↗</span></button>`;
}

/** Página completa de resultados. */
export function resultsPageHtml(results, query) {
    const {tree: fullTree, others} = organizeResults(results);
    // Grupos cujo nome casou ganham a seção do topo; na árvore ficam só os grupos com lançamentos encontrados.
    const groupHits = results.filter(e => e.type === 'group' && searchText(e.title, query).matched);
    const secHits = results.filter(e => e.type === 'secretary' && searchText(e.title, query).matched);
    const otherList = others.map(([type, rows]) => [type, type === 'secretary' ? rows.filter(e => !secHits.includes(e)) : rows]).filter(([, rows]) => rows.length);
    const secCards = secHits.length ? `<section class="search-sec search-sec-secretarias" id="busca-secretarias"><header class="search-sec-head"><span aria-hidden="true">🏛️</span><div><h2>Secretarias</h2><small>${plural(secHits.length, 'secretaria encontrada', 'secretarias encontradas')} pelo nome · clique para entrar</small></div></header>`
        + `<div class="search-group-cards search-sec-cards">${secHits.map(e => { const c = e.counts || {}; return `<div class="search-sec-card"><button type="button" class="search-group-card is-secretary" onclick="ativarResultadoBuscaPorId('secretary',${jsArg(e.data?.id)})"><span class="sgc-icon" aria-hidden="true">🏛️</span><span class="sgc-copy"><strong>${highlightSearchText(e.title, query)}</strong><small>Secretaria municipal</small><em>${[c.groups ? plural(c.groups, 'grupo', 'grupos') : '', c.open ? `${c.open} em andamento` : c.total ? plural(c.total, 'lançamento', 'lançamentos') : ''].filter(Boolean).join(' · ') || 'Entre para ver as áreas'}</em></span><span class="sgc-open">Entrar →</span></button>${(e.shortcuts || []).length ? `<div class="gs-door-shortcuts">${e.shortcuts.slice(0, 4).map(g => `<button type="button" onclick="openActivity(${jsArg(g.id)})" title="${esc(g.name)}"><span aria-hidden="true">${esc(g.icon || '▤')}</span>${esc(g.name)}${g.open ? `<b>${g.open}</b>` : ''}</button>`).join('')}</div>` : ''}</div>`; }).join('')}</div></section>` : '';
    const tree = fullTree.map(sec => ({...sec, groups: sec.groups.filter(g => g.rows.length)})).filter(sec => sec.groups.length);
    const launchCount = tree.reduce((sum, sec) => sum + sec.count, 0);
    const groupCards = groupHits.length ? `<section class="search-sec search-sec-groups" id="busca-grupos"><header class="search-sec-head"><span aria-hidden="true">📁</span><div><h2>Grupos de lançamento</h2><small>${plural(groupHits.length, 'grupo encontrado', 'grupos encontrados')} pelo nome</small></div></header>`
        + `<div class="search-group-cards">${groupHits.map(e => `<button type="button" class="search-group-card" onclick="ativarResultadoBuscaPorId('group',${jsArg(e.data?.id)})"><span class="sgc-icon" aria-hidden="true">${esc(e.icon || '▤')}</span><span class="sgc-copy"><strong>${highlightSearchText(e.title, query)}</strong><small>${(e.crumbs || [e.context]).filter(Boolean).map(c => esc(c)).join(' › ')}</small>${e.counts ? `<em>${e.counts.total ? `${plural(e.counts.total, 'lançamento', 'lançamentos')}${e.counts.open ? ` · ${e.counts.open} em andamento` : ''}` : 'sem lançamentos ainda'}</em>` : ''}</span><span class="sgc-open">Abrir →</span></button>`).join('')}</div></section>` : '';
    const summaryChips = [
        ...(secHits.length ? [`<a href="#busca-secretarias" class="search-chip is-secs">🏛️ Secretarias <b>${secHits.length}</b></a>`] : []),
        ...(groupHits.length ? [`<a href="#busca-grupos" class="search-chip is-groups">📁 Grupos <b>${groupHits.length}</b></a>`] : []),
        ...tree.map((sec, i) => `<a href="#busca-sec-${i}" class="search-chip">🏛️ ${esc(sec.name)} <b>${sec.count}</b></a>`),
        ...otherList.map(([type, rows]) => `<a href="#busca-tipo-${esc(type)}" class="search-chip">${esc(searchTypeLabel(type))} <b>${rows.length}</b></a>`)
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
    const otherSections = otherList.map(([type, rows]) => `<section class="search-sec search-sec-other" id="busca-tipo-${esc(type)}">`
        + `<header class="search-sec-head"><span aria-hidden="true">${esc(rows[0]?.icon || '•')}</span><div><h2>${esc(searchTypeLabel(type))}</h2><small>${plural(rows.length, 'resultado', 'resultados')}</small></div></header>`
        + `<div class="search-group-rows">${rows.map(entry => `<button type="button" class="search-launch" onclick="ativarResultadoBuscaPorId(${jsArg(entry.type)},${jsArg(entry.data?.id)})"><span class="search-launch-type is-${esc(type)}">${esc(searchTypeLabel(type))}</span><span class="search-launch-copy"><strong>${highlightSearchText(entry.title, query)}</strong>${entry.context ? `<small class="search-parent">${highlightSearchText(entry.context, query)}</small>` : ''}</span><span class="search-launch-open" aria-hidden="true">→</span></button>`).join('')}</div></section>`).join('');
    return {html: (summaryChips ? `<nav class="search-chips" aria-label="Resumo dos resultados">${summaryChips}</nav>` : '') + secCards + groupCards + secSections + otherSections, launchCount, secretaryCount: tree.length};
}
