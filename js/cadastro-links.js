// Cadastro único ↔ lançamentos.
// Tudo que é cadastro (estabelecimento, veículo, pessoa…) mora em ADMINISTRAÇÃO › Cadastros.
// Os controles (Contas, Seguros…) guardam só os lançamentos e apontam para o cadastro:
//   registro do controle  → extra_fields.cadastro_id  (+ cadastro_grupo)
//   item do cadastro      → extra_fields.contas_local_id (ou seguro_local_id)
// Ao carregar os dados, o nome e os campos do cadastro passam a valer no controle
// (o nome antigo fica em "Outro nome"). Registros-resumo ("OUTROS", "ILUMINAÇÃO PÚBLICA"…)
// ficam marcados com agrupador:true e aparecem no bloco "📦 sem estabelecimento cadastrado".
(function () {
  const INTERNAL = ['cadastro_id', 'cadastro_grupo', 'contas_local_id', 'seguro_local_id', 'agrupador', 'Origem'];
  // Grupos de cadastro de estabelecimentos usados pelo Controle de Contas.
  const LOCAL_GROUPS = ['cad-predios-locais-publicos', '221b896f-9012-4c97-80b9-0bd5cd294c86', 'c2b09dbc-8a7e-40aa-855d-01742731785c', '2082a757-848b-4a0b-a9ea-d3aaf23bed24'];
  // Grupos de cadastro de veículos/máquinas (Frota) usados pelo controle de Seguros.
  const VEHICLE_GROUPS = {EDUCA: 'e1963945-b131-4949-acfe-424dad296715', ASSIST: '816a7c74-aa7d-4a90-8d41-eff28f7d6800', SAUDE: 'cad-veiculos-saude', AGRICULT: '0641b7d8-76d4-4752-9651-e331e47f399a', GABINETE: '9327bac4-40ba-4872-aab0-e08178cde529', MULHER: 'f42b3fc3-a8a6-42ae-b803-0de59fae465a', INFRA: 'e98e2ff0-063d-4cfb-acf7-08da0c4ea5e1', CEDOCA: '8b11dbf8-388c-4668-8cbb-671a44673ff5', ADMIN: 'b6a1328f-7942-4e70-87c3-fca5fc32e437'};
  const PESSOAS = 'cad-pessoas';
  const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const ef = r => { let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };

  // Ligações só em memória (WeakMap): nada de propriedade nova no registro, que apareceria
  // como coluna nas tabelas dos grupos.
  let cadOf = new WeakMap(), linkedOf = new WeakMap(), ownOf = new WeakMap();
  const cad = rec => (rec && cadOf.get(rec)) || null;
  const linked = rec => (rec && linkedOf.get(rec)) || null;
  const ownName = rec => (rec && ownOf.get(rec)) || '';
  function hydrate(S) {
    if (!S || !Array.isArray(S.items) || !Array.isArray(S.subitems)) return;
    cadOf = new WeakMap(); linkedOf = new WeakMap(); ownOf = new WeakMap();
    const items = new Map(S.items.map(i => [i.id, i]));
    for (const s of S.subitems) {
      const e = ef(s), cad = e.cadastro_id ? items.get(e.cadastro_id) : null;
      if (!cad) continue;
      cadOf.set(s, cad); linkedOf.set(cad, s);
      if (cad.description && cad.atividade_id !== PESSOAS) {   // pessoa: o nome da lista fica como está
        ownOf.set(s, s.description);
        const placa = plate(cad);   // veículo: "ÔNIBUS - PGG7965" (o nome sozinho se repete)
        s.description = placa && !norm(cad.description).replace(/[^A-Z0-9]/g, '').includes(placa) ? `${cad.description} - ${placa}` : cad.description;
      }
    }
  }
  const plate = rec => { const e = ef(rec); const k = Object.keys(e).find(key => norm(key) === 'PLACA'); const v = k ? String(e[k] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') : ''; return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(v) ? v : ''; };
  /** Campos para exibir: o CADASTRO é o coração — os dados dele valem; os do controle só completam
   *  o que o cadastro ainda não tiver. (Tudo que se grava no controle também é gravado no cadastro.) */
  function fields(rec) {
    const out = {}, seen = new Set();
    const add = (k, v) => { if (INTERNAL.includes(k) || /^(item_show_|show_)/.test(k) || v == null || typeof v === 'object' || !String(v).trim()) return; const n = norm(k).replace(/[^A-Z0-9]/g, ''); if (seen.has(n)) return; seen.add(n); out[k] = v; };
    if (cad(rec)) for (const [k, v] of Object.entries(ef(cad(rec)))) add(k, v);
    for (const [k, v] of Object.entries(ef(rec))) add(k, v);
    return out;
  }
  const isAgrupador = rec => ef(rec).agrupador === true || ef(rec).agrupador === 'true';
  const groupName = id => (window.S?.secs || []).find(s => s.id === id)?.name || '';
  /** 'veiculos' para o controle de Seguros/frota; 'locais' para os demais (Contas de luz, água…). */
  function kindOf(secId) {
    const S = window.S || {}, sec = (S.secs || []).find(s => s.id === secId);
    const names = [sec?.name, ...(S.items || []).filter(i => i.atividade_id === secId).map(i => i.description)].map(norm).join(' ');
    return /SEGURO|FROTA|VEICUL/.test(names) ? 'veiculos' : 'locais';
  }
  const groupsOf = kind => kind === 'veiculos' ? Object.values(VEHICLE_GROUPS) : LOCAL_GROUPS;
  /** Itens do cadastro ainda sem registro no controle (para "puxar do cadastro"). */
  const freeLocais = (kind = 'locais') => (window.S?.items || []).filter(i => groupsOf(kind).includes(i.atividade_id) && !ef(i).contas_local_id && !linked(i))
    .sort((a, b) => String(a.description).localeCompare(String(b.description), 'pt-BR'));
  /** Mesmo estabelecimento/veículo já cadastrado (nome igual, ou placa igual)? Evita duplicar. */
  function findDuplicate(kind, name, fieldsObj) {
    const p = plate({extra_fields: fieldsObj || {}});
    return freeLocais(kind).find(i => (p && plate(i) === p) || (!p && norm(i.description) === norm(name))) || null;
  }
  /** Grupo de cadastro que recebe um registro novo, conforme o controle e a categoria. */
  function groupForCategory(catName, kind = 'locais') {
    const n = norm(catName);
    if (kind === 'veiculos') {
      for (const [frag, id] of Object.entries(VEHICLE_GROUPS)) if (n.includes(frag)) return id;
      return VEHICLE_GROUPS.ADMIN;
    }
    if (n.includes('ESCOLA') || n.includes('EDUCA')) return LOCAL_GROUPS[1];
    if (n.includes('SAUDE')) return LOCAL_GROUPS[2];
    if (n.includes('CEMITER')) return LOCAL_GROUPS[3];
    return LOCAL_GROUPS[0];
  }

  // ── "Onde aparece" (cadastro → controles) e "Ficha no cadastro" (controle → cadastro) ──
  // Usa só os dados já carregados (o banco entrega a cada usuário apenas os grupos que ele pode ver)
  // e confere userCanGroup: nunca mostra grupo que o usuário não acessa.
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const canSee = gid => { const g = (window.S?.secs || []).find(x => x.id === gid); return !!g && (typeof window.userCanGroup !== 'function' || window.userCanGroup(g) !== false); };
  function usage() {
    const S = window.S || {}, by = new Map();
    for (const [table, list] of [['items', S.items || []], ['subitems', S.subitems || []]])
      for (const r of list) { const id = ef(r).cadastro_id; if (id) { if (!by.has(id)) by.set(id, []); by.get(id).push({table, rec: r}); } }
    return by;
  }
  function chipsFor(id, by, itemsById) {
    const uses = by.get(id);
    if (uses?.length) {      // é um cadastro: onde ele aparece
      const groups = new Map();
      for (const u of uses) { const g = u.rec.atividade_id; if (!canSee(g)) continue; const e = groups.get(g) || {n: 0, first: u}; e.n++; groups.set(g, e); }
      if (!groups.size) return '';
      return `<span class="cadl-chips" data-cadl="1"><span class="cadl-lbl">🔗 Aparece em</span>${[...groups].map(([g, e]) =>
        `<button type="button" class="cadl-chip" onclick="event.stopPropagation();cadastroLinks.go('${e.first.table}','${esc(e.first.rec.id)}')">${esc(groupName(g) || 'grupo')}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</button>`).join('')}</span>`;
    }
    const rec = itemsById.rec.get(id); const cadId = rec && ef(rec).cadastro_id; const c = cadId && itemsById.items.get(cadId);
    if (!c || !canSee(c.atividade_id) || c.atividade_id === rec.atividade_id) return '';
    const icon = c.atividade_id === PESSOAS ? '👤' : (Object.values(VEHICLE_GROUPS).includes(c.atividade_id) ? '🚗' : '🏢');
    return `<span class="cadl-chips" data-cadl="1"><button type="button" class="cadl-chip is-ficha" title="Abrir a ficha em ${esc(groupName(c.atividade_id))}" onclick="event.stopPropagation();cadastroLinks.go('items','${esc(c.id)}')">${icon} Ficha no cadastro</button></span>`;
  }
  function decorate() {
    const root = document.getElementById('content'); if (!root) return;
    const S = window.S || {}; if (!Array.isArray(S.items)) return;
    const by = usage();
    const rec = new Map();   // id repetido entre tabelas: fica o registro que tem ligação
    for (const r of [...S.items, ...(S.subitems || [])]) if (!rec.has(r.id) || ef(r).cadastro_id) rec.set(r.id, r);
    const itemsById = {items: new Map(S.items.map(i => [i.id, i])), rec};
    const targets = [];
    root.querySelectorAll('tr[data-lista-id]').forEach(tr => { const td = tr.children[2]; if (td) targets.push([tr.dataset.listaId, td]); });
    // formato de tabela: o nome fica na 3ª coluna, com o clique de edição apontando para o id
    root.querySelectorAll('tr > td:nth-child(3) > span[onclick*="Modal("]').forEach(sp => {
      const m = /Modal\(\s*["']([^"']+)["']/.exec(sp.getAttribute('onclick') || ''); if (m) targets.push([m[1], sp.parentElement]);
    });
    root.querySelectorAll('.mass-sel[data-id]').forEach(box => {
      const host = box.closest('.sub-row, .item-header'); const spot = host?.querySelector('.sub-info, .item-info');
      if (spot) targets.push([box.dataset.id, spot]);
    });
    for (const [id, spot] of targets) {
      if (spot.querySelector(':scope > .cadl-chips')) continue;
      const html = chipsFor(id, by, itemsById); if (html) spot.insertAdjacentHTML('beforeend', html);
    }
  }
  let timer = null, observer = null;
  function decorateSoon() { clearTimeout(timer); timer = setTimeout(() => { try { decorate(); } catch (e) { console.warn('[cadastro-links]', e); } }, 120); }
  function watch() {
    const root = document.getElementById('content'); if (!root || observer) return;
    observer = new MutationObserver(muts => { if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !n.closest?.('.cadl-chips') && !n.classList?.contains('cadl-chips')))) decorateSoon(); });
    observer.observe(root, {childList: true, subtree: true});
  }
  window.decorateCadastroLinks = () => { watch(); decorateSoon(); };
  async function go(table, id) {
    if (typeof window.revealRecord === 'function') return window.revealRecord(table, id);
    const r = (window.S?.[table] || []).find(x => x.id === id); if (r) window.openActivity?.(r.atividade_id);
  }

  window.cadastroLinks = {go, decorate, usage, PESSOAS, hydrate, cad, linked, ownName, fields, plate, isAgrupador, kindOf, groupsOf, freeLocais, findDuplicate, groupForCategory, groupName, LOCAL_GROUPS, VEHICLE_GROUPS, INTERNAL};
})();
