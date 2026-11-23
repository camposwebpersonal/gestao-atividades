// PDFs do Controle de Contas com NEUROARQUITETURA (regra permanente do usuário, 23/11/2026 — docs/NEURO-UX.md).
// Peças comuns aos três PDFs (geral, por secretaria e cadastro dos locais):
//  • cabeçalho compacto e claro (faixa suave + barra verde + brasão), nunca ocupa meia página;
//  • "situação em uma frase" num quadro calmo (azul/verde; âmbar = atenção; vermelho só com atraso real);
//  • fichas de resumo cujo VALOR NUNCA SAI DA FICHA (a letra diminui até caber);
//  • barra de progresso do pago; rodapé com página X de Y. Datas sempre dd/mm/aaaa.
(function () {
  const C = {
    ink: [11, 37, 64], text: [33, 52, 63], muted: [71, 85, 105], line: [218, 228, 224],
    soft: [247, 250, 248], teal: [14, 116, 144], green: [4, 120, 87], amber: [146, 64, 14], red: [159, 18, 57],
    head: [16, 94, 74], band: [12, 61, 49],
  };
  const tone = t => ({paid: C.green, pend: C.amber, late: C.red, total: C.teal, zero: C.muted}[t] || C.ink);
  const bg = t => ({paid: [236, 253, 245], pend: [255, 251, 235], late: [255, 241, 242], total: [240, 249, 255], zero: [248, 250, 252]}[t] || [248, 250, 252]);
  // percentual honesto: só mostra 100% quando está realmente tudo pago
  const pctFmt = p => { p = Number(p) || 0; const r = p >= 100 ? 100 : Math.min(99.9, Math.round(p * 10) / 10); return r.toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%'; };
  const hoje = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  // escreve um texto encolhendo a letra até caber na largura (nunca vaza)
  function fitText(doc, text, x, y, maxW, size, min = 5.5, opts) {
    let s = size; doc.setFontSize(s);
    while (s > min && doc.getTextWidth(String(text)) > maxW) { s -= 0.25; doc.setFontSize(s); }
    doc.text(String(text), x, y, opts); return s;
  }
  function header(doc, {W, title, sub, logo}) {
    doc.setFillColor(...C.soft); doc.rect(0, 0, W, 17, 'F');
    doc.setFillColor(33, 135, 82); doc.rect(0, 0, 3.5, 17, 'F');
    doc.setDrawColor(121, 184, 65); doc.setLineWidth(.5); doc.line(0, 17, W, 17);
    if (logo?.d) doc.addImage(logo.d, 'PNG', W - 18, 2, 9.5, 12.5, undefined, 'FAST');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.ink); fitText(doc, title, 10, 8, W - 34, 12.5, 8);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); fitText(doc, sub, 10, 13.4, W - 34, 7.6, 5.5);
    return 21;
  }
  // quadro "situação em uma frase": mood = done | focus | alert | calm
  function situation(doc, {x, y, w, mood, titulo, frase}) {
    const cor = {done: C.green, focus: C.amber, alert: C.red, calm: C.teal}[mood] || C.teal;
    const fundo = {done: [236, 253, 245], focus: [255, 251, 235], alert: [255, 241, 242], calm: [240, 249, 255]}[mood] || [240, 249, 255];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
    const lines = doc.splitTextToSize(frase || '', w - 10);
    const h = 9 + lines.length * 3.6;
    doc.setFillColor(...fundo); doc.roundedRect(x, y, w, h, 1.8, 1.8, 'F');
    doc.setFillColor(...cor); doc.roundedRect(x, y, 1.6, h, .8, .8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...cor); fitText(doc, titulo, x + 5, y + 5.2, w - 10, 10.5, 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(...C.text); doc.text(lines, x + 5, y + 9.4);
    return y + h + 3;
  }
  // fichas de resumo: [{label, value, sub, tone}] — o valor encolhe até caber
  function kpis(doc, {x, y, w, cards, gap = 3}) {
    const cw = (w - gap * (cards.length - 1)) / cards.length, h = 14.5;
    cards.forEach((k, i) => {
      const cx = x + i * (cw + gap);
      doc.setFillColor(...bg(k.tone)); doc.setDrawColor(...C.line); doc.setLineWidth(.2); doc.roundedRect(cx, y, cw, h, 1.6, 1.6, 'FD');
      doc.setFillColor(...tone(k.tone)); doc.rect(cx, y + 1.2, 1.1, h - 2.4, 'F');
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.muted); fitText(doc, String(k.label).toUpperCase(), cx + 3.2, y + 4.2, cw - 5, 6.4, 4.8);
      doc.setTextColor(...tone(k.tone)); fitText(doc, k.value, cx + 3.2, y + 9.3, cw - 5, 11, 6);
      if (k.sub) { doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); fitText(doc, k.sub, cx + 3.2, y + 12.8, cw - 5, 6.6, 4.8); }
    });
    return y + h + 3;
  }
  function progress(doc, {x, y, w, pct, label}) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    doc.setFillColor(226, 232, 240); doc.roundedRect(x, y, w, 2.6, 1.3, 1.3, 'F');
    if (p > 0) { doc.setFillColor(16, 185, 129); doc.roundedRect(x, y, Math.max(2.6, w * p / 100), 2.6, 1.3, 1.3, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.green);
    doc.text(label || `${pctFmt(p)} do valor já pago`, x + w, y + 6, {align: 'right'});
    return y + 9;
  }
  function footer(doc, {W, H, text}) {
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFillColor(...C.band); doc.rect(0, H - 8, W, 8, 'F');
      doc.setTextColor(225, 242, 234); doc.setFontSize(6.8); doc.setFont('helvetica', 'bold');
      doc.text(text || 'PREFEITURA MUNICIPAL DE SERTÂNIA - GESTÃO DE ATIVIDADES · CONTROLE DE CONTAS', 10, H - 3.2);
      doc.text(`Página ${p} de ${pages}`, W - 10, H - 3.2, {align: 'right'});
    }
  }
  // situação em frase para totais de contas (mesma linguagem da tela)
  function mood({total, pago, qtd, qtdPago, vencidas = 0, totVencido = 0}, money) {
    const pend = total - pago, pct = total ? pago / total * 100 : 0, pctTxt = pctFmt(pct);
    if (!qtd) return {mood: 'calm', titulo: 'Nenhuma conta para estes filtros', frase: 'Ajuste os filtros na tela e gere o PDF novamente.'};
    if (vencidas) return {mood: 'alert', titulo: `${vencidas} conta(s) vencida(s) · ${money(totVencido)} em atraso`, frase: `Total de ${money(total)} em ${qtd} conta(s). Já foram pagos ${money(pago)} (${pctTxt}); faltam ${money(pend)}.`};
    if (pend > 0.004) return {mood: 'focus', titulo: `Faltam ${qtd - qtdPago} conta(s) para fechar 100% · ${money(pend)}`, frase: `Total de ${money(total)} em ${qtd} conta(s). Já foram pagos ${money(pago)} (${pctTxt}). Nenhuma conta em atraso.`};
    return {mood: 'done', titulo: 'Tudo em dia: todas as contas estão pagas', frase: `${qtd} conta(s) quitadas, somando ${money(total)}.`};
  }
  // estilos de tabela suaves (cabeçalho petróleo, zebra clarinha, linhas finas)
  const table = {
    theme: 'grid',
    headStyles: {fillColor: C.head, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8},
    styles: {fontSize: 7.8, cellPadding: 1.5, textColor: C.text, lineColor: C.line, lineWidth: .15, overflow: 'linebreak', valign: 'middle', font: 'helvetica'},
    alternateRowStyles: {fillColor: [250, 252, 251]},
  };
  window.ccnPdf = {C, pctFmt, fitText, header, situation, kpis, progress, footer, mood, table, hoje};
})();
