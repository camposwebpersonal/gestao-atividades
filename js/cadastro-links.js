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
      if (cad.description) {
        ownOf.set(s, s.description);
        const placa = plate(cad);   // veículo: "ÔNIBUS - PGG7965" (o nome sozinho se repete)
        s.description = placa && !norm(cad.description).replace(/[^A-Z0-9]/g, '').includes(placa) ? `${cad.description} - ${placa}` : cad.description;
      }
    }
  }
  const plate = rec => { const e = ef(rec); const k = Object.keys(e).find(key => norm(key) === 'PLACA'); const v = k ? String(e[k] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') : ''; return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(v) ? v : ''; };
  /** Campos para exibir: os do próprio controle (mais recentes: vigência renovada, conta contrato…)
   *  e, completando, todos os do cadastro oficial. */
  function fields(rec) {
    const out = {}, seen = new Set();
    const add = (k, v) => { if (INTERNAL.includes(k) || v == null || typeof v === 'object' || !String(v).trim()) return; const n = norm(k); if (seen.has(n)) return; seen.add(n); out[k] = v; };
    for (const [k, v] of Object.entries(ef(rec))) add(k, v);
    if (cad(rec)) for (const [k, v] of Object.entries(ef(cad(rec)))) add(k, v);
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

  window.cadastroLinks = {hydrate, cad, linked, ownName, fields, plate, isAgrupador, kindOf, groupsOf, freeLocais, findDuplicate, groupForCategory, groupName, LOCAL_GROUPS, VEHICLE_GROUPS, INTERNAL};
})();
