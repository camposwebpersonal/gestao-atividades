/* ── CONTROLE DE MULTAS (Frota e Veículos) ──
 * Grupo com extra_fields.controle_multas = 1. Cada multa é um item do grupo; o veículo vem SEMPRE do
 * cadastro da frota (cadastro_id → item do grupo de veículos) e a secretaria sai do cadastro do veículo
 * (campo "Unidade Vinculada"/"Secretaria" ou o grupo: VEÍCULOS DA EDUCAÇÃO → EDUCAÇÃO…).
 * Campos da multa (extra_fields): cadastro_id, cadastro_grupo, Placa, Veículo, Secretaria, Data da ocorrência,
 * Hora, Vencimento, Auto de infração, Órgão autuador, Infração, Gravidade, Pontos, Valor, Local, Condutor,
 * Situação, Data do pagamento, Valor pago, Observações. deadline_date = vencimento; paga/cancelada = concluída.
 */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const S = () => window.S || {};
  const ef = r => { let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const fv = (r, ...names) => { const e = ef(r); for (const n of names) { const k = Object.keys(e).find(x => norm(x) === norm(n)); if (k && e[k] != null && String(e[k]).trim()) return String(e[k]).trim(); } return ''; };
  const money = v => (Number(v) || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const num = v => { const s = String(v ?? '').replace(/[R$\s]/g, ''); const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s); return Number.isFinite(n) ? n : 0; };
  const iso = d => { const x = new Date(); x.setDate(x.getDate() + (d || 0)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const dBR = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10).split('-').reverse().join('/') : (s || '—');
  const days = s => { if (!/^\d{4}-\d{2}-\d{2}/.test(String(s || ''))) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - t) / 864e5); };

  // Tabela do CTB (art. 258): pontos e valor-base por gravidade.
  const GRAV = {'Leve': {pts: 3, valor: 88.38}, 'Média': {pts: 4, valor: 130.16}, 'Grave': {pts: 5, valor: 195.23}, 'Gravíssima': {pts: 7, valor: 293.47}};
  const SITUACOES = ['Em aberto', 'Indicação de condutor', 'Em recurso', 'Paga', 'Cancelada'];
  const FECHADA = s => s === 'Paga' || s === 'Cancelada';
  const INFRACOES = [
    ['Transitar em velocidade até 20% acima da máxima permitida', 'Média'],
    ['Transitar em velocidade de 20% a 50% acima da máxima permitida', 'Grave'],
    ['Transitar em velocidade mais de 50% acima da máxima permitida', 'Gravíssima'],
    ['Avançar o sinal vermelho do semáforo', 'Gravíssima'],
    ['Dirigir segurando ou manuseando telefone celular', 'Gravíssima'],
    ['Deixar o condutor ou passageiro de usar o cinto de segurança', 'Grave'],
    ['Estacionar em local ou horário proibido', 'Média'],
    ['Estacionar em vaga reservada a idoso ou pessoa com deficiência', 'Gravíssima'],
    ['Ultrapassar pela contramão em linha contínua', 'Gravíssima'],
    ['Conduzir veículo com licenciamento vencido / não licenciado', 'Gravíssima'],
    ['Deixar de dar preferência ao pedestre na faixa', 'Gravíssima'],
    ['Transportar passageiros em compartimento de carga', 'Gravíssima'],
    ['Conduzir veículo com excesso de peso', 'Média'],
    ['Deixar de manter acesa a luz baixa nas rodovias', 'Média'],
  ];

  const isMultasGroup = g => { const e = ef(g); return Number(e.controle_multas) === 1 || e.controle_multas === true; };
  window.isMultasGroup = isMultasGroup;

  // ── Veículos: SEMPRE do cadastro (Frota e Veículos) ──
  function vehicleGroups() {
    const ids = new Set(window.cadastroLinks?.groupsOf?.('veiculos') || []);
    for (const g of S().secs || []) if (!isMultasGroup(g) && (ef(g).modulo === 'frota' || /^VE[IÍ]CULOS?\b/i.test(g.name || ''))) ids.add(g.id);
    return ids;
  }
  const rawPlate = v => fv(v, 'PLACA', 'Placa');
  const cleanPlate = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function secretariaOf(v) {
    const own = fv(v, 'Unidade Vinculada', 'Secretaria', 'SECRETARIA');
    const g = (S().secs || []).find(x => x.id === v?.atividade_id);
    const base = own || String(g?.name || '').replace(/^VE[IÍ]CULOS?\s+(D[AOE]S?\s+)?/i, '').trim() || 'SEM SECRETARIA';
    const sec = (S().secretarias || []).find(s => norm(s.name) === norm(base)) || (S().secretarias || []).find(s => norm(s.name).includes(norm(base)) || norm(base).includes(norm(s.name).replace(/^SECRETARIA (D[AOE]S? )?/, '')));
    return {name: (sec?.name || base).toUpperCase(), id: sec?.id || null};
  }
  function vehicles() {
    const gs = vehicleGroups();
    return (S().items || []).filter(i => gs.has(i.atividade_id)).map(v => {
      // Sem placa (0 km, "A/C", XXXX…): identifica pelo chassi, para nenhum veículo do cadastro ficar de fora.
      let p = rawPlate(v), cp = cleanPlate(p);
      if (!cp || /^X+$/.test(cp) || /0\s*KM|A\/C/i.test(p)) { const ch = cleanPlate(fv(v, 'Chassi', 'CHASSI')); if (!ch) return null; p = 'CHASSI …' + ch.slice(-6); cp = ch; }
      const model = fv(v, 'VEÍCULO', 'MODELO', 'MARCA/ MODELO/VERSÃO', 'Outro nome');
      return {id: v.id, rec: v, placa: p.toUpperCase(), cp, nome: v.description || model || 'Veículo', modelo: model && norm(model) !== norm(v.description) ? model : '', grupo: v.atividade_id, sec: secretariaOf(v)};
    }).filter(Boolean).sort((a, b) => a.sec.name.localeCompare(b.sec.name, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // ── Multas ──
  const state = new Map(); // por grupo: {aba, busca, sec, sit, ano}
  const st = id => { if (!state.has(id)) state.set(id, {aba: 'multas', busca: '', sec: '', sit: '', ano: ''}); return state.get(id); };
  function multaOf(r, vmap) {
    const v = vmap.get(fv(r, 'cadastro_id'));
    const sit = fv(r, 'Situação') || (r.concluded == 1 ? 'Paga' : 'Em aberto');
    const venc = fv(r, 'Vencimento') || (r.deadline_date ? String(r.deadline_date).slice(0, 10) : '');
    const dv = FECHADA(sit) ? null : days(venc);
    return {r, v, sit, venc, dv, ocorr: fv(r, 'Data da ocorrência'), valor: num(fv(r, 'Valor')), pts: Number(fv(r, 'Pontos')) || GRAV[fv(r, 'Gravidade')]?.pts || 0,
      placa: v?.placa || fv(r, 'Placa'), nome: v?.nome || fv(r, 'Veículo') || r.description, sec: v?.sec?.name || fv(r, 'Secretaria') || 'SEM SECRETARIA',
      infr: fv(r, 'Infração'), grav: fv(r, 'Gravidade'), auto: fv(r, 'Auto de infração'), condutor: fv(r, 'Condutor'), local: fv(r, 'Local'), orgao: fv(r, 'Órgão autuador'),
      pago: fv(r, 'Data do pagamento'), obs: fv(r, 'Observações')};
  }
  function data(secId) {
    const vs = vehicles(), vmap = new Map(vs.map(v => [v.id, v]));
    const all = (S().items || []).filter(i => i.atividade_id === secId).map(r => multaOf(r, vmap));
    const f = st(secId), toks = norm(f.busca).split(' ').filter(Boolean);
    const list = all.filter(m => (!f.sec || m.sec === f.sec) && (!f.sit || (f.sit === 'abertas' ? !FECHADA(m.sit) : f.sit === 'vencidas' ? m.dv !== null && m.dv < 0 : f.sit === 'semana' ? m.dv !== null && m.dv >= 0 && m.dv <= 7 : m.sit === f.sit))
      && (!f.ano || String(m.ocorr || m.venc).startsWith(f.ano))
      && (!toks.length || toks.every(t => norm([m.placa, m.nome, m.sec, m.infr, m.auto, m.condutor, m.local, m.obs, m.orgao, m.sit].join(' ')).includes(t))))
      .sort((a, b) => (FECHADA(a.sit) - FECHADA(b.sit)) || String(FECHADA(a.sit) ? (b.pago || b.venc) : (a.venc || '9999')).localeCompare(String(FECHADA(a.sit) ? (a.pago || a.venc) : (b.venc || '9999'))) * (FECHADA(a.sit) ? 1 : 1));
    return {vs, vmap, all, list};
  }
  const sitBadge = m => {
    if (m.sit === 'Paga') return `<span class="mt-badge ok">✓ Paga${m.pago ? ' em ' + dBR(m.pago) : ''}</span>`;
    if (m.sit === 'Cancelada') return '<span class="mt-badge off">Cancelada</span>';
    const extra = m.sit !== 'Em aberto' ? `<span class="mt-badge info">${esc(m.sit)}</span>` : '';
    if (m.dv === null) return extra + '<span class="mt-badge warn">Sem vencimento</span>';
    if (m.dv < 0) return extra + `<span class="mt-badge bad">⚠ Vencida há ${-m.dv} dia${m.dv === -1 ? '' : 's'}</span>`;
    if (m.dv === 0) return extra + '<span class="mt-badge bad">⏰ Vence HOJE</span>';
    if (m.dv <= 7) return extra + `<span class="mt-badge warn">⏳ Vence em ${m.dv} dia${m.dv === 1 ? '' : 's'}</span>`;
    return extra + `<span class="mt-badge neutral">Vence ${dBR(m.venc)}</span>`;
  };

  window.renderControleMultas = function (secId) {
    const sec = (S().secs || []).find(s => s.id === secId); if (!sec) return;
    const can = S().isAdmin || window.userCanGroup?.(sec, 'editar');
    const f = st(secId), d = data(secId), all = d.all, open = all.filter(m => !FECHADA(m.sit));
    const ano = String(new Date().getFullYear());
    const kpi = [
      ['Em aberto', open.length, money(open.reduce((a, m) => a + m.valor, 0)), 'abertas', open.length ? 'warn' : 'ok'],
      ['Vencidas', open.filter(m => m.dv !== null && m.dv < 0).length, money(open.filter(m => m.dv !== null && m.dv < 0).reduce((a, m) => a + m.valor, 0)), 'vencidas', 'bad'],
      ['Vencem em 7 dias', open.filter(m => m.dv !== null && m.dv >= 0 && m.dv <= 7).length, 'desconto até o vencimento', 'semana', 'warn'],
      ['Pagas em ' + ano, all.filter(m => m.sit === 'Paga' && String(m.pago || m.venc).startsWith(ano)).length, money(all.filter(m => m.sit === 'Paga' && String(m.pago || m.venc).startsWith(ano)).reduce((a, m) => a + (num(fv(m.r, 'Valor pago')) || m.valor), 0)), 'Paga', 'ok'],
      ['Pontos em ' + ano, all.filter(m => String(m.ocorr).startsWith(ano) && m.sit !== 'Cancelada').reduce((a, m) => a + m.pts, 0), 'na frota toda', '', 'neutral'],
    ];
    const secs = [...new Set(all.map(m => m.sec))].sort();
    const anos = [...new Set(all.map(m => String(m.ocorr || m.venc).slice(0, 4)).filter(a => /^\d{4}$/.test(a)))].sort().reverse();
    const tab = (k, label) => `<button type="button" class="mt-tab ${f.aba === k ? 'on' : ''}" onclick="mtSet('${secId}','aba','${k}')">${label}</button>`;
    let body = '';
    if (f.aba === 'veiculos') body = byVehicle(d);
    else if (f.aba === 'secretarias') body = bySecretaria(d);
    else body = d.list.length ? `<div class="mt-list">${d.list.map(m => row(m, secId, can)).join('')}</div>` : `<div class="mt-empty">${all.length ? 'Nenhuma multa com esses filtros.' : `Nenhuma multa lançada ainda. ${can ? 'Use <b>＋ Lançar multa</b> — o veículo vem do cadastro da frota e a secretaria vem junto.' : ''}`}</div>`;
    const html = `<div class="mt">
      <div class="mt-head"><div><h2>🚦 ${esc(sec.name)}</h2><span>${d.vs.length} veículos do cadastro da frota · ${all.length} multa(s) lançada(s)</span></div>
        <div class="mt-actions">${can ? `<button type="button" class="mt-primary" onclick="mtOpen('${secId}')">＋ Lançar multa</button>` : ''}<button type="button" class="mt-ghost" onclick="mtPdf('${secId}')">📄 PDF</button></div></div>
      <div class="mt-kpis">${kpi.map(([l, n, sub, filt, tone]) => `<button type="button" class="mt-kpi ${tone} ${filt && f.sit === filt ? 'on' : ''}" ${filt ? `onclick="mtSet('${secId}','sit','${f.sit === filt ? '' : filt}')"` : 'disabled'}><b>${n}</b><span>${l}</span><small>${esc(sub)}</small></button>`).join('')}</div>
      <div class="mt-tools">
        <input id="mt-busca" type="search" placeholder="🔍 Placa, veículo, infração, auto, condutor…" value="${esc(f.busca)}" oninput="mtSet('${secId}','busca',this.value,true)">
        <select onchange="mtSet('${secId}','sec',this.value)" aria-label="Secretaria"><option value="">Todas as secretarias</option>${secs.map(s => `<option ${f.sec === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select onchange="mtSet('${secId}','sit',this.value)" aria-label="Situação"><option value="">Todas as situações</option><option value="abertas" ${f.sit === 'abertas' ? 'selected' : ''}>Em aberto (todas)</option><option value="vencidas" ${f.sit === 'vencidas' ? 'selected' : ''}>Vencidas</option><option value="semana" ${f.sit === 'semana' ? 'selected' : ''}>Vencem em 7 dias</option>${SITUACOES.map(s => `<option ${f.sit === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select onchange="mtSet('${secId}','ano',this.value)" aria-label="Ano"><option value="">Todos os anos</option>${anos.map(a => `<option ${f.ano === a ? 'selected' : ''}>${a}</option>`).join('')}</select>
        ${(f.busca || f.sec || f.sit || f.ano) ? `<button type="button" class="mt-ghost" onclick="mtClear('${secId}')">Limpar</button>` : ''}
      </div>
      <div class="mt-tabs">${tab('multas', `📋 Multas (${d.list.length})`)}${tab('veiculos', '🚗 Por veículo')}${tab('secretarias', '🏛️ Por secretaria')}</div>
      ${body}</div>`;
    (window.setC || (h => { document.getElementById('content').innerHTML = h; }))(html);
    const b = document.getElementById('mt-busca'); if (b && f._focus) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); f._focus = false; }
  };
  function row(m, secId, can) {
    const fichaBtn = m.v ? `<button type="button" class="cadl-chip is-ficha" title="Abrir o veículo no cadastro da frota" onclick="event.stopPropagation();cadastroLinks.go('items','${esc(m.v.id)}')">🚗 Ficha</button>` : '<span class="mt-badge bad">veículo fora do cadastro</span>';
    return `<div class="mt-row ${FECHADA(m.sit) ? 'is-closed' : m.dv !== null && m.dv < 0 ? 'is-late' : ''}" data-multa-id="${esc(m.r.id)}">
      <div class="mt-plate">${esc(m.placa || '—')}</div>
      <div class="mt-main"><div class="mt-title"><b>${esc(m.nome)}</b><span class="mt-sec">🏛️ ${esc(m.sec)}</span>${fichaBtn}</div>
        <div class="mt-meta">${[m.infr && `<span>⚖️ ${esc(m.infr)}</span>`, m.grav && `<span>${esc(m.grav)}${m.pts ? ' · ' + m.pts + ' pts' : ''}</span>`, m.ocorr && `<span>📅 Ocorrência ${dBR(m.ocorr)}${fv(m.r, 'Hora') ? ' ' + esc(fv(m.r, 'Hora')) : ''}</span>`, m.auto && `<span>Auto ${esc(m.auto)}</span>`, m.local && `<span>📍 ${esc(m.local)}</span>`, m.condutor && `<span>👤 ${esc(m.condutor)}</span>`, m.obs && `<span class="mt-obs">📝 ${esc(m.obs)}</span>`].filter(Boolean).join('')}</div></div>
      <div class="mt-side"><div class="mt-val">${money(m.valor)}</div>${sitBadge(m)}
        ${can ? `<div class="mt-btns">${!FECHADA(m.sit) ? `<button type="button" title="Marcar como paga" onclick="mtPagar('${esc(m.r.id)}')">✓ Paga</button>` : ''}<button type="button" title="Editar" onclick="mtOpen('${secId}','${esc(m.r.id)}')">✏️</button><button type="button" title="Excluir (vai para a lixeira)" onclick="deleteItem('${esc(m.r.id)}',false)">🗑️</button></div>` : ''}</div></div>`;
  }
  function byVehicle(d) {
    const g = new Map();
    d.list.forEach(m => { const k = m.v?.id || m.placa; if (!g.has(k)) g.set(k, {m, n: 0, abertas: 0, valor: 0, aberto: 0, pts: 0, ult: ''}); const x = g.get(k); x.n++; x.valor += m.valor; x.pts += m.sit === 'Cancelada' ? 0 : m.pts; if (!FECHADA(m.sit)) { x.abertas++; x.aberto += m.valor; } if (String(m.ocorr) > x.ult) x.ult = m.ocorr; });
    const rows = [...g.values()].sort((a, b) => b.n - a.n || b.valor - a.valor);
    if (!rows.length) return '<div class="mt-empty">Nenhuma multa nos filtros atuais.</div>';
    const max = Math.max(...rows.map(r => r.n));
    return `<div class="mt-rank">${rows.map((x, i) => `<div class="mt-rank-row"><span class="mt-pos">${i + 1}º</span><div class="mt-plate">${esc(x.m.placa || '—')}</div><div class="mt-rank-main"><b>${esc(x.m.nome)}</b><small>🏛️ ${esc(x.m.sec)} · última ocorrência ${dBR(x.ult)}</small><i style="width:${Math.max(6, x.n / max * 100)}%"></i></div><div class="mt-rank-num"><b>${x.n}</b> multa(s)<small>${money(x.valor)} · ${x.pts} pts${x.abertas ? ` · <em>${x.abertas} em aberto (${money(x.aberto)})</em>` : ''}</small></div></div>`).join('')}</div>`;
  }
  function bySecretaria(d) {
    const g = new Map();
    d.list.forEach(m => { if (!g.has(m.sec)) g.set(m.sec, {n: 0, valor: 0, aberto: 0, abertas: 0, vencidas: 0, veic: new Set()}); const x = g.get(m.sec); x.n++; x.valor += m.valor; x.veic.add(m.placa); if (!FECHADA(m.sit)) { x.abertas++; x.aberto += m.valor; if (m.dv !== null && m.dv < 0) x.vencidas++; } });
    const rows = [...g.entries()].sort((a, b) => b[1].aberto - a[1].aberto || b[1].n - a[1].n);
    if (!rows.length) return '<div class="mt-empty">Nenhuma multa nos filtros atuais.</div>';
    return `<div class="mt-secgrid">${rows.map(([s, x]) => `<div class="mt-seccard ${x.vencidas ? 'bad' : x.abertas ? 'warn' : 'ok'}"><b>🏛️ ${esc(s)}</b><div><span><strong>${x.n}</strong> multa(s)</span><span><strong>${x.veic.size}</strong> veículo(s)</span><span><strong>${money(x.valor)}</strong> no total</span></div><small>${x.abertas ? `${x.abertas} em aberto · ${money(x.aberto)}${x.vencidas ? ` · <em>${x.vencidas} vencida(s)</em>` : ''}` : '✓ nada em aberto'}</small></div>`).join('')}</div>`;
  }
  window.mtSet = (secId, k, v, typing) => { const f = st(secId); f[k] = v; if (typing) f._focus = true; window.renderControleMultas(secId); };
  // Busca do topo: filtros da tela não podem esconder a multa procurada.
  window.multasReveal = (groupId, id) => { const g = (S().secs || []).find(x => x.id === groupId); if (!isMultasGroup(g)) return false; const f = state.get(groupId); const had = !!(f && (f.busca || f.sec || f.sit || f.ano || f.aba !== 'multas')); state.delete(groupId); return had; };
  window.mtClear = secId => { state.delete(secId); window.renderControleMultas(secId); };

  // ── Lançar / editar ──
  window.mtOpen = function (secId, id) {
    const r = id ? (S().items || []).find(i => i.id === id) : null;
    const vs = vehicles(), cur = r ? fv(r, 'cadastro_id') : '';
    const pessoas = (S().items || []).filter(i => i.atividade_id === 'cad-pessoas').map(p => p.description).slice(0, 3000);
    const val = (k, d = '') => esc(r ? fv(r, k) : d);
    const sit = r ? (fv(r, 'Situação') || 'Em aberto') : 'Em aberto';
    window.openModal(id ? '✏️ Editar multa' : '🚦 Lançar multa', 'O veículo vem do cadastro da frota; a secretaria vem junto, automaticamente.', `
      <div class="form-grid mt-form">
        <div class="form-group full"><label>Veículo (do cadastro da frota) *</label>
          <input id="mt-vbusca" type="search" placeholder="Digite a placa, o modelo ou a secretaria…" autocomplete="off" oninput="mtFiltrarVeiculos()">
          <div id="mt-vlist" class="mt-vlist" role="listbox">${vs.map(v => `<button type="button" role="option" class="mt-vopt ${v.id === cur ? 'on' : ''}" data-id="${esc(v.id)}" data-q="${esc(norm([v.placa, v.cp, v.nome, v.modelo, v.sec.name].join(' ')))}" onclick="mtEscolherVeiculo('${esc(v.id)}')"><span class="mt-plate">${esc(v.placa)}</span><span><b>${esc(v.nome)}</b>${v.modelo ? `<small>${esc(v.modelo)}</small>` : ''}</span><em>🏛️ ${esc(v.sec.name)}</em></button>`).join('') || '<div class="mt-empty">Nenhum veículo com placa no cadastro da frota.</div>'}</div>
          <input type="hidden" id="mt-veiculo" value="${esc(cur)}"><div id="mt-vcard" class="mt-vcard"></div></div>
        <div class="form-group"><label>Data da ocorrência *</label><input id="mt-ocorr" type="date" value="${val('Data da ocorrência')}" max="${iso(0)}"></div>
        <div class="form-group"><label>Hora</label><input id="mt-hora" type="time" value="${val('Hora')}"></div>
        <div class="form-group"><label>Vencimento *</label><input id="mt-venc" type="date" value="${val('Vencimento')}" oninput="mtDesconto()"></div>
        <div class="form-group"><label>Nº do auto de infração</label><input id="mt-auto" value="${val('Auto de infração')}" placeholder="Ex.: AB12345678" oninput="mtDuplicado('${secId}','${id || ''}')"><small id="mt-dup" class="mt-dup"></small></div>
        <div class="form-group full"><label>Infração</label><input id="mt-infr" list="mt-infr-list" value="${val('Infração')}" placeholder="Escolha da lista ou digite" oninput="mtSugerirGravidade()"><datalist id="mt-infr-list">${INFRACOES.map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="form-group"><label>Gravidade</label><select id="mt-grav" onchange="mtGravidade()"><option value="">—</option>${Object.keys(GRAV).map(g => `<option ${(r ? fv(r, 'Gravidade') : '') === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="form-group"><label>Pontos na CNH</label><input id="mt-pts" type="number" min="0" max="21" value="${val('Pontos')}"></div>
        <div class="form-group"><label>Valor (R$) *</label><input id="mt-valor" inputmode="decimal" value="${val('Valor')}" placeholder="0,00" oninput="mtDesconto()"><small id="mt-desc" class="mt-desc"></small></div>
        <div class="form-group"><label>Órgão autuador</label><input id="mt-orgao" list="mt-orgao-list" value="${val('Órgão autuador')}" placeholder="DETRAN-PE, PRF, DER…"><datalist id="mt-orgao-list"><option value="DETRAN-PE"><option value="PRF"><option value="DER-PE"><option value="DNIT"><option value="Trânsito municipal"></datalist></div>
        <div class="form-group full"><label>Local da infração</label><input id="mt-local" value="${val('Local')}" placeholder="Rodovia, km, rua, cidade…"></div>
        <div class="form-group full"><label>Condutor (servidores do cadastro de pessoas)</label><input id="mt-cond" list="mt-cond-list" value="${val('Condutor')}" placeholder="Nome de quem dirigia"><datalist id="mt-cond-list">${pessoas.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
        <div class="form-group"><label>Situação</label><select id="mt-sit" onchange="mtSituacao()">${SITUACOES.map(s => `<option ${s === sit ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group mt-pago-only"><label>Data do pagamento</label><input id="mt-pago" type="date" value="${val('Data do pagamento')}"></div>
        <div class="form-group mt-pago-only"><label>Valor pago (R$)</label><input id="mt-vpago" inputmode="decimal" value="${val('Valor pago')}" placeholder="com desconto, se houve"></div>
        <div class="form-group full"><label>Observações</label><textarea id="mt-obs" rows="2" placeholder="Recurso, notificação, quem foi avisado…">${val('Observações')}</textarea></div>
      </div>
      <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="mtSalvar('${secId}','${id || ''}')">💾 Salvar multa</button></div>`, {kind: 'multa'});
    if (cur) window.mtEscolherVeiculo(cur, true);
    window.mtSituacao(); window.mtDesconto();
  };
  window.mtFiltrarVeiculos = () => { const q = norm(document.getElementById('mt-vbusca')?.value).replace(/[^A-Z0-9 ]/g, ''); const toks = q.split(' ').filter(Boolean); document.querySelectorAll('#mt-vlist .mt-vopt').forEach(b => { b.hidden = !!toks.length && !toks.every(t => b.dataset.q.replace(/[^A-Z0-9 ]/g, '').includes(t)); }); };
  window.mtEscolherVeiculo = function (vid, silent) {
    const v = vehicles().find(x => x.id === vid); if (!v) return;
    document.getElementById('mt-veiculo').value = vid;
    document.querySelectorAll('#mt-vlist .mt-vopt').forEach(b => b.classList.toggle('on', b.dataset.id === vid));
    const fields = window.cadastroLinks ? Object.entries(window.cadastroLinks.fields({extra_fields: {}, ...v.rec, extra_fields: ef(v.rec)})).filter(([k]) => !/^(contas_local_id|Origem)$/i.test(k)).slice(0, 10) : [];
    const multas = (S().items || []).filter(i => isMultasGroup((S().secs || []).find(g => g.id === i.atividade_id)) && fv(i, 'cadastro_id') === vid);
    const abertas = multas.filter(i => !FECHADA(fv(i, 'Situação') || (i.concluded == 1 ? 'Paga' : 'Em aberto')));
    document.getElementById('mt-vcard').innerHTML = `<div class="mt-vcard-in"><span class="mt-plate big">${esc(v.placa)}</span><div><b>${esc(v.nome)}</b><span>🏛️ Secretaria: <strong>${esc(v.sec.name)}</strong> <em>(automática, do cadastro)</em></span>
      <small>${fields.map(([k, x]) => `<i><b>${esc(k)}:</b> ${esc(x)}</i>`).join('')}</small>
      ${multas.length ? `<small class="mt-hist">📊 Histórico deste veículo: ${multas.length} multa(s)${abertas.length ? `, <b>${abertas.length} em aberto</b>` : ''}.</small>` : '<small class="mt-hist ok">✓ Primeira multa deste veículo.</small>'}</div></div>`;
    const list = document.getElementById('mt-vlist'); if (list && !silent) list.classList.add('picked');
  };
  window.mtGravidade = () => { const g = GRAV[document.getElementById('mt-grav').value]; if (!g) return; document.getElementById('mt-pts').value = g.pts; const vEl = document.getElementById('mt-valor'); if (!vEl.value.trim()) vEl.value = g.valor.toFixed(2).replace('.', ','); window.mtDesconto(); };
  window.mtSugerirGravidade = () => { const t = norm(document.getElementById('mt-infr').value); const hit = INFRACOES.find(([x]) => norm(x) === t); if (hit) { document.getElementById('mt-grav').value = hit[1]; window.mtGravidade(); } };
  window.mtDesconto = () => {
    const v = num(document.getElementById('mt-valor')?.value), out = document.getElementById('mt-desc'); if (!out) return;
    const dv = days(document.getElementById('mt-venc')?.value);
    out.innerHTML = v ? `Pagando até o vencimento: <b>${money(v * 0.8)}</b> (−20%) · pelo app SNE: <b>${money(v * 0.6)}</b> (−40%)${dv !== null ? (dv < 0 ? ' · <em>vencimento já passou</em>' : ` · faltam ${dv} dia(s)`) : ''}` : '';
  };
  window.mtSituacao = () => { const pago = document.getElementById('mt-sit')?.value === 'Paga'; document.querySelectorAll('.mt-pago-only').forEach(e => { e.hidden = !pago; }); if (pago && !document.getElementById('mt-pago').value) document.getElementById('mt-pago').value = iso(0); };
  window.mtDuplicado = (secId, id) => {
    const a = norm(document.getElementById('mt-auto')?.value), out = document.getElementById('mt-dup'); if (!out) return;
    const dup = a && (S().items || []).find(i => i.atividade_id === secId && i.id !== id && norm(fv(i, 'Auto de infração')) === a);
    out.textContent = dup ? `⚠ Este auto já foi lançado: ${dup.description}` : '';
  };
  window.mtSalvar = async function (secId, id) {
    const g = k => document.getElementById(k)?.value?.trim() || '';
    const vid = g('mt-veiculo'), v = vehicles().find(x => x.id === vid);
    if (!v) { window.toast?.('Escolha o veículo do cadastro da frota.', 'error'); return; }
    if (!g('mt-ocorr') || !g('mt-venc')) { window.toast?.('Informe a data da ocorrência e o vencimento.', 'error'); return; }
    if (!num(g('mt-valor'))) { window.toast?.('Informe o valor da multa.', 'error'); return; }
    if (document.getElementById('mt-dup')?.textContent && !confirm('Já existe uma multa com este nº de auto. Lançar mesmo assim?')) return;
    const sit = g('mt-sit') || 'Em aberto', closed = FECHADA(sit);
    const old = id ? (S().items || []).find(i => i.id === id) : null;
    const extra = {...(old ? ef(old) : {}),
      cadastro_id: v.id, cadastro_grupo: v.grupo, 'Placa': v.placa, 'Veículo': v.nome, 'Secretaria': v.sec.name,
      'Data da ocorrência': g('mt-ocorr'), 'Hora': g('mt-hora'), 'Vencimento': g('mt-venc'), 'Auto de infração': g('mt-auto'), 'Órgão autuador': g('mt-orgao'),
      'Infração': g('mt-infr'), 'Gravidade': g('mt-grav'), 'Pontos': g('mt-pts'), 'Valor': num(g('mt-valor')).toFixed(2).replace('.', ','), 'Local': g('mt-local'), 'Condutor': g('mt-cond'),
      'Situação': sit, 'Data do pagamento': sit === 'Paga' ? g('mt-pago') : '', 'Valor pago': sit === 'Paga' ? g('mt-vpago') : '', 'Observações': g('mt-obs')};
    Object.keys(extra).forEach(k => { if (extra[k] === '') delete extra[k]; });
    const data = {atividade_id: secId, description: `${v.placa} · ${v.nome} · ${dBR(g('mt-ocorr'))}${g('mt-infr') ? ' · ' + g('mt-infr') : ''}`.slice(0, 240),
      observacao: g('mt-obs'), deadline_date: g('mt-venc'), secretaria_id: v.sec.id || null, concluded: closed ? 1 : 0, status: closed ? 'concluido' : 'pendente',
      conclusion_date: closed ? (g('mt-pago') || iso(0)) : null, item_icon: '🚦', item_color: '#b45309', extra_fields: extra, updated_at: window.serverTimestamp()};
    try {
      if (id) await window.updateDoc(window.doc(window.db, 'items', id), data);
      else await window.addDoc(window.collection(window.db, 'items'), {...data, order_num: (S().items || []).filter(i => i.atividade_id === secId).length, responsaveis: '', created_at: window.serverTimestamp()});
    } catch (e) { window.toast?.('Não foi possível salvar a multa: ' + (window.friendlyDbError?.(e) || e.message || e), 'error', 8000); return; }
    window.closeModal(); await window.loadData?.(); window.renderControleMultas(secId);
    window.toast?.(id ? 'Multa atualizada!' : `Multa lançada para ${v.placa} · ${v.sec.name}`, 'success');
  };
  window.mtPagar = async function (id) {
    const r = (S().items || []).find(i => i.id === id); if (!r) return;
    const quando = prompt('Data do pagamento (DD/MM/AAAA):', iso(0).split('-').reverse().join('/')); if (quando === null) return;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(quando.trim()); if (!m) { window.toast?.('Data inválida. Use DD/MM/AAAA.', 'error'); return; }
    const dia = `${m[3]}-${m[2]}-${m[1]}`;
    try { await window.updateDoc(window.doc(window.db, 'items', id), {concluded: 1, status: 'concluido', conclusion_date: dia, extra_fields: {...ef(r), 'Situação': 'Paga', 'Data do pagamento': dia}, updated_at: window.serverTimestamp()}); }
    catch (e) { window.toast?.('Não foi possível marcar como paga: ' + (window.friendlyDbError?.(e) || e.message || e), 'error', 8000); return; }
    await window.loadData?.(); window.renderControleMultas(r.atividade_id); window.toast?.('Multa marcada como paga ✓', 'success');
  };

  // ── PDF: cabeçalho compacto, por secretaria, com subtotal ──
  window.mtPdf = async function (secId) {
    if (!window.jspdf?.jsPDF) { window.toast?.('jsPDF não carregado', 'error'); return; }
    const sec = (S().secs || []).find(s => s.id === secId), d = data(secId), list = [...d.list].sort((a, b) => a.sec.localeCompare(b.sec, 'pt-BR') || String(a.venc).localeCompare(String(b.venc)));
    const doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'}); (window.safePdf || (x => x))(doc);
    const W = 297, H = 210, mx = 10;
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    const header = () => { doc.setFillColor(247, 250, 248); doc.rect(0, 0, W, 15, 'F'); doc.setFillColor(180, 83, 9); doc.rect(0, 0, 3, 15, 'F'); if (logo?.d) doc.addImage(logo.d, 'PNG', W - 16, 2, 8.5, 11, undefined, 'FAST');
      doc.setTextColor(15, 53, 43); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(`${(sec?.name || 'CONTROLE DE MULTAS').toUpperCase()} · FROTA MUNICIPAL`, mx, 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(78, 105, 96); doc.text(`Prefeitura Municipal de Sertânia · emitido em ${new Date().toLocaleString('pt-BR')}`, mx, 11.8); };
    header();
    const open = list.filter(m => !FECHADA(m.sit));
    let y = (window.drawCompactHeader || ((dd, x, yy) => yy))(doc, mx, 18, W - mx * 2, 'Resumo', [
      {label: 'multas', value: list.length}, {label: 'em aberto (' + money(open.reduce((a, m) => a + m.valor, 0)) + ')', value: open.length, color: [180, 83, 9]},
      {label: 'vencidas', value: open.filter(m => m.dv !== null && m.dv < 0).length, color: [185, 28, 28]}, {label: 'pagas', value: list.filter(m => m.sit === 'Paga').length, color: [22, 128, 74]}], null);
    const body = [];
    let cur = null, sub = {n: 0, v: 0};
    const flushSub = () => { if (cur !== null) body.push([{content: `Subtotal ${cur}: ${sub.n} multa(s) · ${money(sub.v)}`, colSpan: 8, styles: {fontStyle: 'bold', fillColor: [234, 240, 244], textColor: [55, 71, 89], halign: 'right'}}]); };
    list.forEach(m => {
      if (m.sec !== cur) { flushSub(); cur = m.sec; sub = {n: 0, v: 0}; body.push([{content: `SECRETARIA: ${m.sec}`, colSpan: 8, styles: {fontStyle: 'bold', fillColor: [11, 77, 59], textColor: [255, 255, 255]}}]); }
      sub.n++; sub.v += m.valor;
      body.push([`${m.placa}\n${m.nome}`, dBR(m.ocorr), `${m.infr || '—'}${m.grav ? `\n${m.grav}${m.pts ? ' · ' + m.pts + ' pts' : ''}` : ''}`, [m.auto, m.orgao].filter(Boolean).join('\n') || '—', m.condutor || '—', dBR(m.venc), money(m.valor), m.sit === 'Paga' ? `Paga${m.pago ? ' ' + dBR(m.pago) : ''}` : m.sit === 'Cancelada' ? 'Cancelada' : m.dv !== null && m.dv < 0 ? `VENCIDA (${-m.dv}d)` : m.sit]);
    });
    flushSub();
    body.push([{content: `TOTAL: ${list.length} multa(s) · ${money(list.reduce((a, m) => a + m.valor, 0))} · em aberto ${money(open.reduce((a, m) => a + m.valor, 0))}`, colSpan: 8, styles: {fontStyle: 'bold', fillColor: [15, 61, 49], textColor: [255, 255, 255], halign: 'right'}}]);
    // colunas sem nenhum dado (ex.: Condutor) saem do PDF; as faixas de secretaria/subtotal acompanham
    let head = ['Veículo', 'Ocorrência', 'Infração', 'Auto / órgão', 'Condutor', 'Vencimento', 'Valor', 'Situação'];
    const dataRows = body.filter(r => r.length === 8), drop = [2, 3, 4].filter(ci => dataRows.every(r => !String(r[ci]).replace(/—/g, '').trim()));
    if (drop.length) { head = head.filter((_, i) => !drop.includes(i)); body.forEach((r, ri) => { if (r.length === 8) body[ri] = r.filter((_, i) => !drop.includes(i)); else r[0].colSpan = head.length; }); }
    const colW = {'Veículo': {cellWidth: 46, fontStyle: 'bold'}, 'Ocorrência': {cellWidth: 20}, 'Infração': {cellWidth: 'auto'}, 'Auto / órgão': {cellWidth: 32}, 'Condutor': {cellWidth: 36}, 'Vencimento': {cellWidth: 20}, 'Valor': {cellWidth: 22, halign: 'right'}, 'Situação': {cellWidth: 26}};
    const sitCol = head.indexOf('Situação');
    doc.autoTable({startY: y + 1, head: [head], body, margin: {left: mx, right: mx, top: 18, bottom: 13}, showHead: 'everyPage', rowPageBreak: 'avoid',
      styles: {fontSize: 7.3, cellPadding: 1.4, valign: 'top', lineColor: [214, 224, 231], lineWidth: 0.12, textColor: [30, 41, 59]}, headStyles: {fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold'},
      columnStyles: Object.fromEntries(head.map((h, i) => [i, h === 'Veículo' && !head.includes('Infração') ? {cellWidth: 'auto', fontStyle: 'bold'} : colW[h]])),
      didParseCell: c => { if (c.section === 'body' && c.column.index === sitCol && /VENCIDA/.test(String(c.cell.raw))) { c.cell.styles.textColor = [185, 28, 28]; c.cell.styles.fontStyle = 'bold'; } if (c.section === 'body' && c.column.index === sitCol && /^Paga/.test(String(c.cell.raw))) c.cell.styles.textColor = [22, 128, 74]; },
      didDrawPage: dd => { if (dd.pageNumber > 1) header(); }});
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFillColor(12, 61, 49); doc.rect(0, H - 8, W, 8, 'F'); doc.setTextColor(225, 242, 234); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES · CONTROLE DE MULTAS', mx, H - 3); doc.text(`Página ${p} de ${pages}`, W - mx, H - 3, {align: 'right'}); }
    doc.save('CONTROLE-DE-MULTAS.pdf'); window.toast?.('PDF das multas gerado!', 'success');
  };
})();
