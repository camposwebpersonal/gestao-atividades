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
  const ef = r => { let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
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
      const secName = (field(local, 'UNIDADE VINCULADA', 'SECRETARIA') || cat.description || 'SEM SECRETARIA').toUpperCase();
      if (busca.length) {
        const hay = norm([secName, cat.description, local.description, info.contrato, info.relogio, info.endereco, info.lugar, ...rows.map(r => r.observacao)].join(' '));
        if (!busca.every(t => hay.includes(t))) continue;
      }
      if (!groups.has(secName)) groups.set(secName, {name: secName, cats: new Set(), locais: []});
      const g = groups.get(secName); g.cats.add(cat.description || ''); g.locais.push(info);
    }
    let list = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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
  const idLine = l => [l.contrato && `Conta contrato: <b>${esc(l.contrato)}</b>`, l.relogio && `Relógio: <b>${esc(l.relogio)}</b>`, l.lugar && esc(l.lugar)].filter(Boolean).join(' · ');

  window.ccRelatorioHtml = function (secId) {
    const d = build(secId), {cols} = d, head = headCells(cols), n = head.length;
    const valorIdx = head.indexOf('Valor'), sitIdx = head.indexOf('Situação');
    const opt = (v, label, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label)}</option>`;
    const controls = `<div class="ccr-controls">
      <label>Ano<select onchange="ccRelatorioSet('${secId}','ano',this.value)">${opt('', 'Todos os anos', d.anoSel)}${d.anos.map(a => opt(a, a, d.anoSel)).join('')}</select></label>
      <label>Tipo de conta<select onchange="ccRelatorioSet('${secId}','tipo',this.value)">${opt('', 'Todos', d.tipoSel)}${d.tipos.map(t => opt(t, t, d.tipoSel)).join('')}</select></label>
      <label>Secretaria<select onchange="ccRelatorioSet('${secId}','sec',this.value)">${opt('', 'Todas', d.secSel)}${d.secNames.map(s => opt(s, s, d.secSel)).join('')}</select></label>
      <button type="button" class="ccr-pdf" onclick="ccRelatorioPdf('${secId}')">📄 Gerar PDF deste relatório</button></div>`;
    const sum = `<div class="ccr-summary"><div><b>${d.list.length}</b><small>secretaria${d.list.length === 1 ? '' : 's'}</small></div><div><b>${d.tot.locais}</b><small>locais com conta</small></div><div><b>${d.tot.qtd}</b><small>lançamentos</small></div><div><b>${money(d.tot.total)}</b><small>total${d.anoSel ? ' em ' + d.anoSel : ''}</small></div><div class="is-ok"><b>${money(d.tot.pago)}</b><small>pago</small></div><div class="${d.tot.total - d.tot.pago > 0.004 ? 'is-bad' : ''}"><b>${money(d.tot.total - d.tot.pago)}</b><small>pendente</small></div></div>`;
    const body = d.list.map(g => `<section class="ccr-sec">
      <header class="ccr-sec-head"><div><small>SECRETARIA</small><h3>🏛️ ${esc(g.name)}</h3><span>${esc([...g.cats].filter(c => norm(c) !== norm(g.name)).join(' · '))}</span></div><div class="ccr-sec-tot"><b>${money(g.total)}</b><small>${g.com.length} local(is) · ${g.qtd} lançamento(s)</small></div></header>
      ${g.com.length ? `<div class="ccr-table-wrap"><table class="ccr-table"><thead><tr>${head.map((h, i) => `<th class="${i === valorIdx ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
      ${g.com.map(l => `<tbody class="ccr-local"><tr class="ccr-local-row"><td colspan="${n}"><div><strong>📍 ${esc(l.local.description || 'Local')}</strong><span>${idLine(l) || '<i>Sem conta contrato / relógio cadastrados</i>'}</span></div></td></tr>
        ${l.rows.map(r => `<tr class="ccr-row">${rowCells(r, cols).map((v, i) => `<td class="${i === 0 ? 'ccr-mes' : ''} ${i === valorIdx ? 'num' : ''} ${i === sitIdx ? (v === 'Pago' ? 'ok' : 'bad') : ''} ${head[i] === 'Observações' ? 'obs' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}
        <tr class="ccr-local-total"><td colspan="${valorIdx}">Total do local · ${l.rows.length} lançamento(s)</td><td class="num">${money(l.total)}</td><td colspan="${n - valorIdx - 1}">${l.total - l.pago > 0.004 ? `<span class="bad">Pendente ${money(l.total - l.pago)}</span>` : '<span class="ok">Tudo pago</span>'}</td></tr></tbody>`).join('')}
      <tfoot><tr><td colspan="${valorIdx}">TOTAL ${esc(g.name)}</td><td class="num">${money(g.total)}</td><td colspan="${n - valorIdx - 1}">Pago ${money(g.pago)}${g.total - g.pago > 0.004 ? ` · Pendente ${money(g.total - g.pago)}` : ''}</td></tr></tfoot></table></div>` : ''}
      ${g.sem.length ? `<p class="ccr-empty-locals">Sem lançamentos no período: ${g.sem.map(l => esc(l.local.description)).join(' · ')}</p>` : ''}
    </section>`).join('');
    return `<div class="ccr">${controls}${sum}${body || '<div class="empty">Nenhuma conta encontrada para os filtros escolhidos.</div>'}</div>`;
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
    const header = () => {
      doc.setFillColor(247, 250, 248); doc.rect(0, 0, W, 24, 'F'); doc.setFillColor(33, 135, 82); doc.rect(0, 0, 4, 24, 'F');
      doc.setDrawColor(121, 184, 65); doc.setLineWidth(.6); doc.line(0, 24, W, 24);
      if (logo?.d) doc.addImage(logo.d, 'PNG', W - 24, 3, 13, 17, undefined, 'FAST');
      doc.setTextColor(15, 53, 43); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text(`RELATÓRIO POR SECRETARIA · ${(sec?.name || 'CONTROLE DE CONTAS').toUpperCase()}`, mx, 11);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(78, 105, 96);
      doc.text(`Prefeitura Municipal de Sertânia · ${periodo} · Emitido em ${new Date().toLocaleString('pt-BR')}`, mx, 18);
    };
    header();
    // resumo
    const cards = [['SECRETARIAS', String(d.list.length)], ['LOCAIS', String(d.tot.locais)], ['LANÇAMENTOS', String(d.tot.qtd)], ['TOTAL', money(d.tot.total)], ['PAGO', money(d.tot.pago)], ['PENDENTE', money(d.tot.total - d.tot.pago)]];
    const cw = (W - mx * 2 - 5 * 3) / 6; let y = 29;
    cards.forEach(([label, value], i) => {
      const x = mx + i * (cw + 3); doc.setFillColor(247, 250, 248); doc.setDrawColor(218, 228, 224); doc.roundedRect(x, y, cw, 14, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...(label === 'PENDENTE' && d.tot.total - d.tot.pago > 0.004 ? [176, 58, 22] : label === 'PAGO' ? [22, 128, 74] : [15, 53, 43]));
      doc.text(value, x + cw / 2, y + 6.5, {align: 'center'}); doc.setFontSize(6.5); doc.setTextColor(78, 105, 96); doc.text(label, x + cw / 2, y + 11.2, {align: 'center'});
    });
    y += 19;
    const valorIdx = head.indexOf('Valor'), sitIdx = head.indexOf('Situação'), obsIdx = head.indexOf('Observações');
    for (const g of d.list) {
      if (!g.com.length) continue;
      if (y > H - 40) { doc.addPage(); header(); y = 30; }
      // faixa da secretaria
      doc.setFillColor(11, 77, 59); doc.roundedRect(mx, y, W - mx * 2, 10, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(`SECRETARIA: ${g.name}`, mx + 3, y + 6.6);
      doc.setFontSize(9); doc.text(`${money(g.total)}  ·  ${g.com.length} local(is)  ·  ${g.qtd} lançamento(s)`, W - mx - 3, y + 6.6, {align: 'right'});
      y += 12;
      const body = [];
      for (const l of g.com) {
        const ident = [l.contrato && `Conta contrato: ${l.contrato}`, l.relogio && `Relógio: ${l.relogio}`, l.lugar].filter(Boolean).join('   ·   ') || 'Sem conta contrato / relógio cadastrados';
        body.push([{content: `${l.local.description || 'Local'}`, colSpan: Math.max(1, Math.ceil(n / 2)), styles: {fontStyle: 'bold', fontSize: 9, textColor: [15, 53, 43], fillColor: [230, 244, 238]}}, {content: ident, colSpan: n - Math.max(1, Math.ceil(n / 2)), styles: {fontSize: 7.5, textColor: [47, 69, 88], fillColor: [230, 244, 238], halign: 'right'}}]);
        for (const r of l.rows) body.push(rowCells(r, cols).map((v, i) => i === 0 ? {content: '    ' + v} : v));
        body.push([{content: `Total do local · ${l.rows.length} lançamento(s)`, colSpan: valorIdx, styles: {fontStyle: 'bold', halign: 'right', textColor: [47, 69, 88], fillColor: [246, 250, 248]}}, {content: money(l.total), styles: {fontStyle: 'bold', halign: 'right', fillColor: [246, 250, 248], textColor: [15, 53, 43]}}, {content: l.total - l.pago > 0.004 ? `Pendente ${money(l.total - l.pago)}` : 'Tudo pago', colSpan: n - valorIdx - 1, styles: {fontStyle: 'bold', fillColor: [246, 250, 248], textColor: l.total - l.pago > 0.004 ? [176, 58, 22] : [22, 128, 74]}}]);
      }
      body.push([{content: `TOTAL ${g.name}`, colSpan: valorIdx, styles: {fontStyle: 'bold', halign: 'right', fillColor: [11, 77, 59], textColor: [255, 255, 255]}}, {content: money(g.total), styles: {fontStyle: 'bold', halign: 'right', fillColor: [11, 77, 59], textColor: [255, 255, 255]}}, {content: `Pago ${money(g.pago)}${g.total - g.pago > 0.004 ? ` · Pendente ${money(g.total - g.pago)}` : ''}`, colSpan: n - valorIdx - 1, styles: {fontStyle: 'bold', fillColor: [11, 77, 59], textColor: [255, 255, 255]}}]);
      doc.autoTable({startY: y, head: [head], body, theme: 'grid', margin: {left: mx, right: mx, top: 30, bottom: 16},
        styles: {fontSize: 7.8, cellPadding: 1.6, textColor: [33, 52, 63], lineColor: [218, 228, 224], lineWidth: .15, overflow: 'linebreak', valign: 'middle'},
        headStyles: {fillColor: [22, 104, 70], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8},
        columnStyles: Object.fromEntries(head.map((h, i) => [i, h === 'Mês/Ano' ? {cellWidth: 26, fontStyle: 'bold'} : h === 'Valor' ? {halign: 'right', cellWidth: 28} : h === 'Situação' ? {cellWidth: 20} : h === 'Observações' ? {cellWidth: 'auto', fontSize: 7} : {cellWidth: 26}])),
        didParseCell: c => { if (c.section === 'body' && c.column.index === sitIdx && (c.cell.raw === 'Pago' || c.cell.raw === 'Pendente')) { c.cell.styles.fontStyle = 'bold'; c.cell.styles.textColor = c.cell.raw === 'Pago' ? [22, 128, 74] : [176, 58, 22]; } },
        didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) header(); }});
      y = doc.lastAutoTable.finalY + 8;
    }
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFillColor(12, 61, 49); doc.rect(0, H - 10, W, 10, 'F');
      doc.setTextColor(225, 242, 234); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES · CONTROLE DE CONTAS', mx, H - 4);
      doc.text(`Página ${p} de ${pages}`, W - mx, H - 4, {align: 'right'});
    }
    const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`RELATORIO-CONTAS-POR-SECRETARIA${d.tipoSel ? '-' + slug(d.tipoSel) : ''}${d.anoSel ? '-' + d.anoSel : ''}${d.secSel ? '-' + slug(d.secSel) : ''}.pdf`);
    window.toast?.('PDF do relatório gerado!', 'success');
  };
})();
