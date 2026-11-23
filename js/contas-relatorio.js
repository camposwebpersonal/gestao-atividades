// Controle de Contas › aba "📑 Relatório por secretaria" (tela + PDF com a mesma estrutura).
//   SECRETARIA (faixa)  →  LOCAL · Conta contrato · Relógio (linha título)  →  meses (linhas recuadas)
//   → total do local → total da secretaria → total geral.
// Secretaria = campo "Unidade Vinculada" do local; sem ele, o nome da categoria (ex.: UNIDADES DE SAÚDE).
// Respeita a busca e o filtro Pago/Pendente do topo; Ano, Tipo e Secretaria escolhidos na própria aba.
(function () {
  const S = () => window.S || {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const money = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const state = new Map();
  // Campos do local = os do cadastro oficial (ADMINISTRAÇÃO › Cadastros) + os próprios do controle.
  const ef = r => { if (window.cadastroLinks && r && r.extra_fields !== undefined) return window.cadastroLinks.fields(r); let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const SEM_CAD = 'CONTAS SEM ESTABELECIMENTO CADASTRADO';
  const semCad = l => !window.cadastroLinks?.cad(l);
  const secLabel = name => name === SEM_CAD ? 'RESUMOS E CONTAS AINDA SEM CADASTRO' : 'SECRETARIA';
  const secIcon = name => name === SEM_CAD ? '📦' : '🏛️';
  const linkTag = l => window.cadastroLinks?.cad(l) ? ' <em class="ccr-linked" title="Nome e dados vindos de ADMINISTRAÇÃO › Cadastros">🔗 cadastro</em>' : '';
  const field = (rec, ...frags) => { const e = ef(rec); for (const frag of frags) { const k = Object.keys(e).find(key => norm(key).includes(norm(frag)) && String(e[key] ?? '').trim()); if (k) return String(e[k]).trim(); } return ''; };
  const day = v => { if (!v) return ''; const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (window.fmtD ? window.fmtD(v) : String(v)); };
  const ano = c => String(c.mes_ano || '').split('/')[1] || '';
  const mesNum = c => Number(String(c.mes_ano || '').split('/')[0]) || 0;
  const mesLabel = c => { const n = mesNum(c); return n ? `${MESES[n - 1]}/${ano(c)}` : (c.mes_ano || '—'); };
  const isPago = c => c.pago === true || c.pago === 'true' || c.pago === 1;

  /** Monta a árvore secretaria → locais → contas, já filtrada. */
  function build(secId) {
    const st = state.get(secId) || {};
    const busca = norm(document.getElementById('cc-busca')?.value || '').split(' ').filter(Boolean);
    const pagoF = document.getElementById('cc-filtro-pago')?.value || '';
    const cats = (S().items || []).filter(i => i.atividade_id === secId);
    const catById = new Map(cats.map(c => [c.id, c]));
    const contas = (S().contas || []).filter(c => c.atividade_id === secId);
    const anos = [...new Set(contas.map(ano).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    const tipos = [...new Set(contas.map(c => c.tipo || 'Outros'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const topAno = document.getElementById('cc-filtro-ano')?.value || '', topTipo = document.getElementById('cc-filtro-tipo')?.value || '';
    const anoSel = st.ano ?? (topAno || anos[0] || ''), tipoSel = st.tipo ?? (topTipo || (tipos.includes('Luz') ? 'Luz' : ''));
    const byLocal = new Map();
    for (const c of contas) {
      if (anoSel && ano(c) !== anoSel) continue;
      if (tipoSel && (c.tipo || 'Outros') !== tipoSel) continue;
      if (pagoF === 'pago' && !isPago(c)) continue;
      if (pagoF === 'pendente' && isPago(c)) continue;
      if (!byLocal.has(c.subitem_id)) byLocal.set(c.subitem_id, []);
      byLocal.get(c.subitem_id).push(c);
    }
    const groups = new Map();
    for (const local of (S().subitems || []).filter(s => catById.has(s.item_id) && s.parent_type !== 'subitem')) {
      const cat = catById.get(local.item_id);
      const rows = (byLocal.get(local.id) || []).sort((a, b) => (ano(a) + String(mesNum(a)).padStart(2, '0')).localeCompare(ano(b) + String(mesNum(b)).padStart(2, '0')));
      const info = {
        local, cat, rows,
        contrato: field(local, 'CONTA CONTRATO', 'CONTRATO'),
        relogio: field(local, 'RELOGIO', 'MEDIDOR'),
        endereco: field(local, 'ENDERECO'),
        lugar: field(local, 'DISTRITO', 'POVOADO'),
      };
      const secName = semCad(local) ? SEM_CAD : (field(local, 'UNIDADE VINCULADA', 'SECRETARIA') || cat.description || 'SEM SECRETARIA').toUpperCase();
      if (busca.length) {
        const hay = norm([secName, cat.description, local.description, info.contrato, info.relogio, info.endereco, info.lugar, ...rows.map(r => r.observacao)].join(' '));
        if (!busca.every(t => hay.includes(t))) continue;
      }
      if (!groups.has(secName)) groups.set(secName, {name: secName, cats: new Set(), locais: []});
      const g = groups.get(secName); g.cats.add(cat.description || ''); g.locais.push(info);
    }
    let list = [...groups.values()].sort((a, b) => (a.name === SEM_CAD) - (b.name === SEM_CAD) || a.name.localeCompare(b.name, 'pt-BR'));
    const secNames = list.map(g => g.name);
    if (st.sec && secNames.includes(st.sec)) list = list.filter(g => g.name === st.sec);
    for (const g of list) {
      g.locais.sort((a, b) => String(a.local.description).localeCompare(String(b.local.description), 'pt-BR'));
      g.com = g.locais.filter(l => l.rows.length); g.sem = g.locais.filter(l => !l.rows.length);
      for (const l of g.com) { l.total = l.rows.reduce((s, r) => s + (Number(r.valor) || 0), 0); l.pago = l.rows.filter(isPago).reduce((s, r) => s + (Number(r.valor) || 0), 0); }
      g.total = g.com.reduce((s, l) => s + l.total, 0); g.pago = g.com.reduce((s, l) => s + l.pago, 0); g.qtd = g.com.reduce((s, l) => s + l.rows.length, 0);
    }
    const all = list.flatMap(g => g.com.flatMap(l => l.rows));
    const cols = {
      leitura: all.some(r => String(r.leitura_relogio ?? '').trim()),
      consumo: all.some(r => String(r.consumo_kwh ?? '').trim()),
      tipo: !tipoSel && new Set(all.map(r => r.tipo)).size > 1,
      venc: all.some(r => r.data_vencimento), pag: all.some(r => r.data_pagamento),
      obs: all.some(r => String(r.observacao ?? '').trim()),
    };
    const tot = {total: list.reduce((s, g) => s + g.total, 0), pago: list.reduce((s, g) => s + g.pago, 0), qtd: all.length, locais: list.reduce((s, g) => s + g.com.length, 0)};
    return {list, anos, tipos, secNames, anoSel, tipoSel, secSel: st.sec || '', cols, tot, pagoF, busca: document.getElementById('cc-busca')?.value || ''};
  }

  const headCells = cols => ['Mês/Ano', ...(cols.tipo ? ['Tipo'] : []), ...(cols.leitura ? ['Leitura'] : []), ...(cols.consumo ? ['Consumo (kWh)'] : []), ...(cols.venc ? ['Vencimento'] : []), ...(cols.pag ? ['Pagamento'] : []), 'Valor', 'Situação', ...(cols.obs ? ['Observações'] : [])];
  const rowCells = (r, cols) => [mesLabel(r), ...(cols.tipo ? [r.tipo || '—'] : []), ...(cols.leitura ? [r.leitura_relogio || '—'] : []), ...(cols.consumo ? [r.consumo_kwh || '—'] : []), ...(cols.venc ? [day(r.data_vencimento) || '—'] : []), ...(cols.pag ? [day(r.data_pagamento) || '—'] : []), money(r.valor), isPago(r) ? 'Pago' : 'Pendente', ...(cols.obs ? [r.observacao || ''] : [])];
  // Contas do mesmo mês ficam sob uma linha pai do mês, com o total do mês embaixo.
  const byMonth = rows => { const out = []; for (const r of rows) { const k = mesLabel(r); const last = out[out.length - 1]; if (last && last.key === k) last.rows.push(r); else out.push({key: k, rows: [r]}); } return out; };
  const idLine = l => [l.contrato && `Conta contrato: <b>${esc(l.contrato)}</b>`, l.relogio && `Relógio: <b>${esc(l.relogio)}</b>`, l.lugar && esc(l.lugar)].filter(Boolean).join(' · ');

  window.ccRelatorioHtml = function (secId) {
    const d = build(secId), {cols} = d, head = headCells(cols), n = head.length;
    const valorIdx = head.indexOf('Valor'), sitIdx = head.indexOf('Situação');
    const rowHtml = (r, nested) => `<tr class="ccr-row${nested ? ' is-nested' : ''}">${rowCells(r, cols).map((v, i) => `<td class="${i === 0 ? 'ccr-mes' : ''} ${i === valorIdx ? 'num' : ''} ${i === sitIdx ? (v === 'Pago' ? 'ok' : 'bad') : ''} ${head[i] === 'Observações' ? 'obs' : ''}">${esc(i === 0 && nested ? '↳ ' + v : v)}</td>`).join('')}</tr>`;
    const opt = (v, label, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label)}</option>`;
    const controls = `<div class="ccr-controls">
      <label>Ano<select onchange="ccRelatorioSet('${secId}','ano',this.value)">${opt('', 'Todos os anos', d.anoSel)}${d.anos.map(a => opt(a, a, d.anoSel)).join('')}</select></label>
      <label>Tipo de conta<select onchange="ccRelatorioSet('${secId}','tipo',this.value)">${opt('', 'Todos', d.tipoSel)}${d.tipos.map(t => opt(t, t, d.tipoSel)).join('')}</select></label>
      <label>Secretaria<select onchange="ccRelatorioSet('${secId}','sec',this.value)">${opt('', 'Todas', d.secSel)}${d.secNames.map(s => opt(s, s, d.secSel)).join('')}</select></label></div>`;
    // neuroarquitetura: situação numa frase + anel de progresso + fichas cujo valor nunca sai do card
    const pend = d.tot.total - d.tot.pago, pct = d.tot.total ? d.tot.pago / d.tot.total * 100 : 0;
    const escopo = [d.tipoSel ? `Contas de ${d.tipoSel}` : 'Todas as contas', d.anoSel ? `em ${d.anoSel}` : 'em todos os anos', d.secSel ? `· ${d.secSel}` : ''].filter(Boolean).join(' ');
    const mood = !d.tot.qtd ? 'calm' : pend > 0.004 ? 'focus' : 'done';
    const titulo = !d.tot.qtd ? 'Nada para mostrar com esses filtros' : pend > 0.004 ? `${money(d.tot.total)} em ${d.tot.locais} local(is)` : 'Tudo pago neste relatório ✨';
    const frase = !d.tot.qtd ? 'Troque o ano, o tipo ou a secretaria abaixo para ver os lançamentos.' : pend > 0.004 ? `${escopo}. Já foram pagos ${money(d.tot.pago)}; faltam ${money(pend)}.` : `${escopo}: ${money(d.tot.total)} em ${d.tot.qtd} lançamento(s), tudo quitado.`;
    const K = window.ccnKpi || ((c, i, l, v, s) => `<div class="ccn-kpi ${c}"><div class="ccn-kpi-body"><span class="ccn-kpi-lbl">${l}</span><b class="ccn-kpi-val">${v}</b><small>${s || ''}</small></div></div>`);
    const sum = `<section class="ccn-hero ccn-hero-sm is-${mood}"><div class="ccn-hero-txt"><span class="ccn-hello">📑 Relatório por secretaria</span><h2>${esc(titulo)}</h2><p>${esc(frase)}</p><small class="ccn-scope">${d.list.length} secretaria(s) · ${d.tot.locais} local(is) com conta · ${d.tot.qtd} lançamento(s)</small></div>${d.tot.qtd && window.ccnRing ? `<div class="ccn-hero-ring">${window.ccnRing(pct)}</div>` : ''}</section>
      <div class="ccn-kpis">${K('is-total', '💰', `Total${d.anoSel ? ' em ' + d.anoSel : ''}`, money(d.tot.total), `${d.tot.qtd} lançamento(s)`)}${K('is-paid', '✅', 'Pago', money(d.tot.pago), `${Math.round(pct)}% do valor`)}${K(pend > 0.004 ? 'is-pend' : 'is-zero', '⏳', 'Pendente', money(pend), pend > 0.004 ? 'a pagar' : 'nada pendente 🎉')}${K('is-total', '🏛️', 'Secretarias', String(d.list.length), `${d.tot.locais} local(is) com conta`)}</div>`;
    const body = d.list.map(g => `<section class="ccr-sec">
      <header class="ccr-sec-head"><div><small>${secLabel(g.name)}</small><h3>${secIcon(g.name)} ${esc(g.name)}</h3><span>${esc([...g.cats].filter(c => norm(c) !== norm(g.name)).join(' · '))}</span></div><div class="ccr-sec-tot"><b>${money(g.total)}</b><small>${g.com.length} local(is) · ${g.qtd} lançamento(s)</small></div></header>
      ${g.com.length ? `<div class="ccr-table-wrap"><table class="ccr-table"><thead><tr>${head.map((h, i) => `<th class="${i === valorIdx ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
      ${g.com.map(l => `<tbody class="ccr-local"><tr class="ccr-local-row"><td colspan="${n}"><div><strong>📍 ${esc(l.local.description || 'Local')}${linkTag(l.local)}</strong><span>${idLine(l) || '<i>Sem conta contrato / relógio cadastrados</i>'}</span></div></td></tr>
        ${byMonth(l.rows).map(m => m.rows.length === 1 ? rowHtml(m.rows[0], false) : `<tr class="ccr-month-row"><td colspan="${n}">🗓️ ${esc(m.key)} <span>${m.rows.length} contas no mês</span></td></tr>${m.rows.map(r => rowHtml(r, true)).join('')}<tr class="ccr-month-total"><td colspan="${valorIdx}">Total de ${esc(m.key)} · ${m.rows.length} contas</td><td class="num">${money(m.rows.reduce((s, r) => s + (Number(r.valor) || 0), 0))}</td><td colspan="${n - valorIdx - 1}"></td></tr>`).join('')}
        <tr class="ccr-local-total"><td colspan="${valorIdx}">Total do local · ${l.rows.length} lançamento(s)</td><td class="num">${money(l.total)}</td><td colspan="${n - valorIdx - 1}">${l.total - l.pago > 0.004 ? `<span class="bad">Pendente ${money(l.total - l.pago)}</span>` : '<span class="ok">Tudo pago</span>'}</td></tr></tbody>`).join('')}
      <tfoot><tr><td colspan="${valorIdx}">TOTAL ${esc(g.name)}</td><td class="num">${money(g.total)}</td><td colspan="${n - valorIdx - 1}">Pago ${money(g.pago)}${g.total - g.pago > 0.004 ? ` · Pendente ${money(g.total - g.pago)}` : ''}</td></tr></tfoot></table></div>` : ''}
      ${g.sem.length ? `<p class="ccr-empty-locals">Sem lançamentos no período: ${g.sem.map(l => esc(l.local.description)).join(' · ')}</p>` : ''}
    </section>`).join('');
    return `<div class="ccr">${controls}${sum}${body || '<div class="empty">Nenhuma conta encontrada para os filtros escolhidos.</div>'}</div>`;
  };
  // ── 🏢 Cadastro dos locais: um local por linha, com conta contrato, relógio e todos os demais dados ──
  const HIDDEN_KEYS = ['ITEM SHOW', 'SHOW CONCLUSION', 'UNIDADE VINCULADA', 'NOME DA ESCOLA', 'CADASTRO ID', 'CADASTRO_ID', 'CADASTRO_GRUPO', 'CONTAS_LOCAL', 'SEGURO_LOCAL', 'AGRUPADOR', 'ORIGEM', 'SHOW_TABLE'];
  const KEY_ALIASES = [['Conta contrato', ['CONTA CONTRATO', 'CONTRATO']], ['Relógio / medidor', ['RELOGIO', 'MEDIDOR']], ['Endereço', ['ENDERECO']], ['Distrito / povoado', ['DISTRITO', 'POVOADO']], ['Prédio do município', ['PREDIO']], ['Responsável', ['RESPONSAVEL']], ['WhatsApp do responsável', ['WHATSAPP']]];
  const canonKey = k => { const n = norm(k); for (const [label, frags] of KEY_ALIASES) if (frags.some(f => n.includes(f)) && !(label === 'Responsável' && n.includes('WHATSAPP'))) return label; return String(k).trim(); };
  function cadastroData(secId) {
    const base = build(secId);
    // todos os locais, inclusive sem conta no período
    const groups = base.list.map(g => {
      const locais = g.locais.map(l => {
        const vals = {};
        for (const [k, v] of Object.entries(ef(l.local))) {
          const nk = norm(k).replace(/_/g, ' ');
          if (/^(ITEM SHOW|SHOW |_)/.test(nk) || HIDDEN_KEYS.some(h => nk.includes(norm(h).replace(/_/g, ' '))) || v == null || typeof v === 'object' || !String(v).trim() || String(v).trim() === '0') continue;
          const key = canonKey(k); if (!vals[key]) vals[key] = String(v).trim();
        }
        if (!vals['Outro nome'] && window.cadastroLinks?.ownName(l.local) && norm(window.cadastroLinks?.ownName(l.local)) !== norm(l.local.description)) vals['Outro nome'] = window.cadastroLinks?.ownName(l.local);
        const contas = (S().contas || []).filter(c => c.subitem_id === l.local.id);
        const last = contas.slice().sort((a, b) => (ano(b) + String(mesNum(b)).padStart(2, '0')).localeCompare(ano(a) + String(mesNum(a)).padStart(2, '0')))[0];
        vals['Contas lançadas'] = contas.length ? `${contas.length} (última ${mesLabel(last)})` : 'Nenhuma';
        return {local: l.local, cat: l.cat, vals};
      });
      return {name: g.name, cats: g.cats, locais};
    });
    const keys = [...new Set(groups.flatMap(g => g.locais.flatMap(l => Object.keys(l.vals))))];
    const order = [...KEY_ALIASES.map(a => a[0]), 'Contas lançadas'];
    keys.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) || a.localeCompare(b, 'pt-BR'));
    const missing = groups.flatMap(g => g.locais).filter(l => !l.vals['Conta contrato']).length;
    return {...base, groups, keys, missing, total: groups.reduce((s, g) => s + g.locais.length, 0)};
  }
  // Um bloco por local, no mesmo estilo compacto do PDF dos cadastros: nome em destaque e, logo abaixo,
  // todos os campos preenchidos em fluxo contínuo "RÓTULO: valor". Nada de colunas vazias.
  const fieldsOf = (l, keys) => keys.filter(k => l.vals[k] || k === 'Conta contrato').map(k => ({label: k, value: l.vals[k] || 'não informado', bad: !l.vals[k]}));
  window.ccCadastroHtml = function (secId) {
    const d = cadastroData(secId);
    let n = 0;
    return `<div class="ccr ccr-cadastro"><div class="ccr-controls"><div class="ccr-cad-intro"><b>Um local por linha</b><span>Conta contrato, relógio, endereço e demais dados.${d.missing ? ` <em>${d.missing} sem conta contrato.</em>` : ''}</span></div></div>
      ${(() => { const K = window.ccnKpi || ((c, i, l, v, s) => `<div class="ccn-kpi ${c}"><div class="ccn-kpi-body"><span class="ccn-kpi-lbl">${l}</span><b class="ccn-kpi-val">${v}</b><small>${s || ''}</small></div></div>`);
        const lig = d.groups.flatMap(g => g.locais).filter(l => window.cadastroLinks?.cad(l.local)).length, com = d.total - d.missing, pct = d.total ? com / d.total * 100 : 0;
        return `<section class="ccn-hero ccn-hero-sm is-${d.missing ? 'focus' : 'done'}"><div class="ccn-hero-txt"><span class="ccn-hello">🏢 Cadastro dos locais</span><h2>${d.missing ? `${d.missing} local(is) sem conta contrato` : 'Cadastro completo ✨'}</h2><p>${d.missing ? 'Complete a conta contrato destes locais (marcados em vermelho) para o relatório e os PDFs saírem perfeitos.' : `Todos os ${d.total} locais têm conta contrato. Excelente!`}</p><small class="ccn-scope">Dados vindos de ADMINISTRAÇÃO › Cadastros (o coração do sistema) + os do controle.</small></div>${d.total && window.ccnRing ? `<div class="ccn-hero-ring">${window.ccnRing(pct, 'completo')}</div>` : ''}</section>
        <div class="ccn-kpis">${K('is-total', '🏛️', 'Secretarias', String(d.groups.length), 'com locais')}${K('is-total', '📍', 'Locais', String(d.total), 'no controle')}${K(d.missing ? 'is-pend' : 'is-paid', '🧾', 'Com conta contrato', String(com), d.missing ? `faltam ${d.missing}` : 'todos 🎉')}${K(lig ? 'is-paid' : 'is-zero', '🔗', 'Ligados ao cadastro', String(lig), `de ${d.total} · 🔗 ligados ao cadastro oficial`)}</div>`; })()}
      ${d.groups.map(g => `<section class="ccr-sec"><header class="ccr-sec-head"><div><small>${secLabel(g.name)}</small><h3>${secIcon(g.name)} ${esc(g.name)}</h3><span>${esc([...g.cats].filter(c => norm(c) !== norm(g.name)).join(' · '))}</span></div><div class="ccr-sec-tot"><b>${g.locais.length}</b><small>local(is)</small></div></header>
        <ol class="ccc-list">${g.locais.map(l => `<li class="ccc-row"><span class="ccc-n">${++n}</span><div class="ccc-body"><div class="ccc-title">📍 ${esc(l.local.description || 'Local')}${linkTag(l.local)}</div><div class="ccc-fields">${fieldsOf(l, d.keys).map(f => `<span class="${f.bad ? 'bad' : ''}"><b>${esc(f.label.toUpperCase())}:</b> ${esc(f.value)}</span>`).join('')}</div></div></li>`).join('')}</ol></section>`).join('') || '<div class="empty">Nenhum local cadastrado.</div>'}</div>`;
  };
  window.ccCadastroPdf = async function (secId) {
    if (!window.jspdf?.jsPDF) { window.toast?.('jsPDF não carregado', 'error'); return; }
    const sec = (S().secs || []).find(s => s.id === secId), d = cadastroData(secId);
    let lay = {}; try { lay = JSON.parse(localStorage.getItem('pdf-layout:geral') || '{}'); } catch { /* padrão */ }
    const perRow = Number(lay.perRow) || 1, fieldCols = Number(lay.fieldCols) || 0;
    const land = lay.orientation === 'landscape' || (lay.orientation !== 'portrait' && perRow > 2);
    const doc = new window.jspdf.jsPDF({orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: 'a4'}); (window.safePdf || (x => x))(doc);
    const W = land ? 297 : 210, H = land ? 210 : 297, mx = 10;
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    const P = window.ccnPdf;
    const header = () => P.header(doc, {W, title: `CADASTRO DOS LOCAIS · ${(sec?.name || 'CONTROLE DE CONTAS').toUpperCase()}`, sub: `Prefeitura Municipal de Sertânia · ${d.total} locais · ${d.groups.length} secretarias · ${d.total - d.missing} com conta contrato · Emitido em ${P.hoje()}`, logo});
    let y = header(), num = 0;
    const lig = d.groups.flatMap(g => g.locais).filter(l => window.cadastroLinks?.cad(l.local)).length;
    y = P.situation(doc, {x: mx, y, w: W - mx * 2, mood: d.missing ? 'focus' : 'done', titulo: d.missing ? `${d.missing} local(is) ainda sem conta contrato` : 'Cadastro completo: todos os locais têm conta contrato',
      frase: d.missing ? 'Os locais sem conta contrato aparecem com "não informado" - complete no sistema para o relatório sair perfeito.' : `${d.total} locais em ${d.groups.length} secretaria(s), todos com conta contrato.`});
    y = P.kpis(doc, {x: mx, y, w: W - mx * 2, cards: [
      {label: 'Secretarias', value: String(d.groups.length), tone: 'total'}, {label: 'Locais', value: String(d.total), tone: 'total'},
      {label: 'Com conta contrato', value: String(d.total - d.missing), sub: d.missing ? `faltam ${d.missing}` : 'todos', tone: d.missing ? 'pend' : 'paid'},
      {label: 'Ligados ao cadastro', value: String(lig), sub: `de ${d.total}`, tone: lig ? 'paid' : 'zero'}]}) + 1;
    for (const g of d.groups) {
      if (y > H - 30) { doc.addPage(); y = header(); }
      doc.setFillColor(236, 247, 243); doc.roundedRect(mx, y, W - mx * 2, 6.5, 1.2, 1.2, 'F'); doc.setFillColor(14, 116, 144); doc.rect(mx, y, 1.4, 6.5, 'F');
      doc.setTextColor(11, 37, 64); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(g.name === SEM_CAD ? g.name : `SECRETARIA: ${g.name}`, mx + 2.5, y + 4.5);
      doc.setFontSize(7.5); doc.text(`${g.locais.length} local(is)`, W - mx - 2.5, y + 4.5, {align: 'right'}); y += 7.5;
      const recs = g.locais.map(l => ({num: String(++num), level: 0, title: l.local.description || 'Local', badges: window.cadastroLinks?.cad(l.local) ? [] : [{text: 'sem cadastro', tone: 'attention'}],
        fields: fieldsOf(l, d.keys).map(f => ({label: f.label.toUpperCase(), value: f.value}))}));
      y = window.drawRecordsTable(doc, recs, {startY: y, width: W - mx * 2, perRow, fieldCols, headColor: [15, 61, 49], margin: {left: mx, right: mx, top: 22, bottom: 12},
        onPage: data => { if (data.pageNumber > 1) header(); }}) + 4;
    }
    P.footer(doc, {W, H, text: 'PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES · CADASTRO DOS LOCAIS'});
    doc.save('CADASTRO-DOS-LOCAIS-CONTROLE-DE-CONTAS.pdf'); window.toast?.('PDF do cadastro gerado!', 'success');
  };
  window.ccRelatorioSet = function (secId, key, value) {
    state.set(secId, {...(state.get(secId) || {}), [key]: value});
    window.renderControleContas(secId);
  };

  window.ccRelatorioPdf = async function (secId) {
    if (!window.jspdf?.jsPDF) { window.toast?.('jsPDF não carregado', 'error'); return; }
    const sec = (S().secs || []).find(s => s.id === secId);
    const d = build(secId), {cols} = d, head = headCells(cols), n = head.length;
    if (!d.tot.qtd) { window.toast?.('Nada para imprimir com esses filtros.', 'error'); return; }
    window.toast?.('Gerando o relatório em PDF…', 'info', 6000);
    const doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'}); (window.safePdf || (x => x))(doc);
    const W = 297, H = 210, mx = 10;
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    const periodo = [d.tipoSel ? `Contas de ${d.tipoSel}` : 'Todas as contas', d.anoSel ? `Ano ${d.anoSel}` : 'Todos os anos', d.secSel || 'Todas as secretarias', d.pagoF === 'pago' ? 'Só pagas' : d.pagoF === 'pendente' ? 'Só pendentes' : '', d.busca ? `Busca: "${d.busca}"` : ''].filter(Boolean).join(' · ');
    const P = window.ccnPdf;
    const header = () => P.header(doc, {W, title: `RELATÓRIO POR SECRETARIA · ${(sec?.name || 'CONTROLE DE CONTAS').toUpperCase()}`, sub: `Prefeitura Municipal de Sertânia · ${periodo} · Emitido em ${P.hoje()}`, logo});
    // neuroarquitetura: situação em uma frase + fichas (valor nunca sai da ficha) + barra do pago
    let y = header();
    const pend = d.tot.total - d.tot.pago, pct = d.tot.total ? d.tot.pago / d.tot.total * 100 : 0;
    const qPago = d.list.reduce((s, g) => s + g.com.reduce((a, l) => a + l.rows.filter(isPago).length, 0), 0);
    y = P.situation(doc, {x: mx, y, w: W - mx * 2, ...P.mood({total: d.tot.total, pago: d.tot.pago, qtd: d.tot.qtd, qtdPago: qPago}, money)});
    y = P.kpis(doc, {x: mx, y, w: W - mx * 2, cards: [
      {label: 'Secretarias', value: String(d.list.length), sub: `${d.tot.locais} local(is) com conta`, tone: 'total'},
      {label: 'Lançamentos', value: String(d.tot.qtd), sub: `${qPago} pago(s)`, tone: 'total'},
      {label: 'Total', value: money(d.tot.total), sub: d.anoSel ? `em ${d.anoSel}` : 'todos os anos', tone: 'total'},
      {label: 'Pago', value: money(d.tot.pago), sub: `${Math.round(pct)}% do valor`, tone: 'paid'},
      {label: 'Pendente', value: money(pend), sub: pend > 0.004 ? 'a pagar' : 'nada pendente', tone: pend > 0.004 ? 'pend' : 'zero'},
    ]});
    y = P.progress(doc, {x: mx, y, w: W - mx * 2, pct}) + 1;
    const valorIdx = head.indexOf('Valor'), sitIdx = head.indexOf('Situação'), obsIdx = head.indexOf('Observações');
    for (const g of d.list) {
      if (!g.com.length) continue;
      if (y > H - 40) { doc.addPage(); y = header(); }
      // faixa da secretaria (tom calmo, barra petróleo à esquerda)
      doc.setFillColor(236, 247, 243); doc.roundedRect(mx, y, W - mx * 2, 9, 1.5, 1.5, 'F');
      doc.setFillColor(14, 116, 144); doc.roundedRect(mx, y, 1.6, 9, .8, .8, 'F');
      const totTxt = `${money(g.total)}  ·  ${g.com.length} local(is)  ·  ${g.qtd} lançamento(s)`;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); const tw = doc.getTextWidth(totTxt);
      doc.setTextColor(12, 74, 110); doc.text(totTxt, W - mx - 3, y + 6, {align: 'right'});
      doc.setTextColor(11, 37, 64); P.fitText(doc, g.name === SEM_CAD ? g.name : `SECRETARIA: ${g.name}`, mx + 4.5, y + 6.1, W - mx * 2 - tw - 14, 11, 7);
      y += 10.5;
      const body = [];
      for (const l of g.com) {
        const ident = [l.contrato && `Conta contrato: ${l.contrato}`, l.relogio && `Relógio: ${l.relogio}`, l.lugar].filter(Boolean).join('   ·   ') || 'Sem conta contrato / relógio cadastrados';
        body.push([{content: `${l.local.description || 'Local'}`, colSpan: Math.max(1, Math.ceil(n / 2)), styles: {fontStyle: 'bold', fontSize: 9, textColor: [15, 53, 43], fillColor: [230, 244, 238]}}, {content: ident, colSpan: n - Math.max(1, Math.ceil(n / 2)), styles: {fontSize: 7.5, textColor: [47, 69, 88], fillColor: [230, 244, 238], halign: 'right'}}]);
        for (const m of byMonth(l.rows)) {
          if (m.rows.length === 1) { body.push(rowCells(m.rows[0], cols).map((v, i) => i === 0 ? {content: '    ' + v} : v)); continue; }
          body.push([{content: `    ${m.key}  ·  ${m.rows.length} contas no mês`, colSpan: n, styles: {fontStyle: 'bold', textColor: [29, 78, 137], fillColor: [238, 244, 255]}}]);
          for (const r of m.rows) body.push(rowCells(r, cols).map((v, i) => i === 0 ? {content: '          ' + v, styles: {fontStyle: 'normal'}} : v));
          body.push([{content: `Total de ${m.key} · ${m.rows.length} contas`, colSpan: valorIdx, styles: {fontStyle: 'bold', halign: 'right', textColor: [29, 78, 137], fillColor: [246, 249, 255]}}, {content: money(m.rows.reduce((s, r) => s + (Number(r.valor) || 0), 0)), styles: {fontStyle: 'bold', halign: 'right', textColor: [29, 78, 137], fillColor: [246, 249, 255]}}, {content: '', colSpan: n - valorIdx - 1, styles: {fillColor: [246, 249, 255]}}]);
        }
        body.push([{content: `Total do local · ${l.rows.length} lançamento(s)`, colSpan: valorIdx, styles: {fontStyle: 'bold', halign: 'right', textColor: [47, 69, 88], fillColor: [246, 250, 248]}}, {content: money(l.total), styles: {fontStyle: 'bold', halign: 'right', fillColor: [246, 250, 248], textColor: [15, 53, 43]}}, {content: l.total - l.pago > 0.004 ? `Pendente ${money(l.total - l.pago)}` : 'Tudo pago', colSpan: n - valorIdx - 1, styles: {fontStyle: 'bold', fillColor: [246, 250, 248], textColor: l.total - l.pago > 0.004 ? [146, 64, 14] : [4, 120, 87]}}]);
      }
      body.push([{content: `TOTAL ${g.name}`, colSpan: valorIdx, styles: {fontStyle: 'bold', halign: 'right', fillColor: [224, 242, 254], textColor: [11, 37, 64]}}, {content: money(g.total), styles: {fontStyle: 'bold', halign: 'right', fillColor: [224, 242, 254], textColor: [12, 74, 110]}}, {content: `Pago ${money(g.pago)}${g.total - g.pago > 0.004 ? ` · Pendente ${money(g.total - g.pago)}` : ''}`, colSpan: n - valorIdx - 1, styles: {fontStyle: 'bold', fillColor: [224, 242, 254], textColor: g.total - g.pago > 0.004 ? [146, 64, 14] : [4, 120, 87]}}]);
      doc.autoTable({startY: y, head: [head], body, theme: 'grid', margin: {left: mx, right: mx, top: 22, bottom: 12},
        styles: {fontSize: 7.8, cellPadding: 1.6, textColor: [33, 52, 63], lineColor: [218, 228, 224], lineWidth: .15, overflow: 'linebreak', valign: 'middle'},
        headStyles: {fillColor: [16, 94, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8}, alternateRowStyles: {fillColor: [250, 252, 251]},
        columnStyles: Object.fromEntries(head.map((h, i) => [i, h === 'Mês/Ano' ? {cellWidth: 26, fontStyle: 'bold'} : h === 'Valor' ? {halign: 'right', cellWidth: 28} : h === 'Situação' ? {cellWidth: 20} : h === 'Observações' ? {cellWidth: 'auto', fontSize: 7} : {cellWidth: 26}])),
        didParseCell: c => { if (c.section === 'body' && c.column.index === sitIdx && (c.cell.raw === 'Pago' || c.cell.raw === 'Pendente')) { c.cell.styles.fontStyle = 'bold'; c.cell.styles.textColor = c.cell.raw === 'Pago' ? [4, 120, 87] : [146, 64, 14]; } },
        didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) header(); }});
      y = doc.lastAutoTable.finalY + 8;
    }
    P.footer(doc, {W, H});
    const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`RELATORIO-CONTAS-POR-SECRETARIA${d.tipoSel ? '-' + slug(d.tipoSel) : ''}${d.anoSel ? '-' + d.anoSel : ''}${d.secSel ? '-' + slug(d.secSel) : ''}.pdf`);
    window.toast?.('PDF do relatório gerado!', 'success');
  };
})();
