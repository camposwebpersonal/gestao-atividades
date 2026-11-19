// Motor de PDF compacto para lançamentos (jsPDF + autoTable).
// Cada lançamento vira um bloco único: título + etiquetas de situação na mesma linha, campos
// preenchidos em fluxo contínuo ("Rótulo: valor · Rótulo: valor"), observação e, se pedido,
// uma linha pequena de registro (criado/editado). Nada de colunas vazias ou repetidas.

const PT = 0.3528; // 1 pt em mm

export const TONES = {
  urgent: {fill: [253, 228, 225], text: [160, 28, 20]},
  attention: {fill: [255, 240, 205], text: [122, 72, 0]},
  calm: {fill: [222, 244, 231], text: [17, 101, 52]},
  done: {fill: [214, 240, 224], text: [15, 95, 50]},
  late: {fill: [253, 228, 225], text: [160, 28, 20]},
  pending: {fill: [232, 238, 245], text: [45, 64, 86]},
  info: {fill: [225, 238, 250], text: [12, 74, 128]},
  star: {fill: [255, 236, 179], text: [110, 64, 0]},
  muted: {fill: [238, 241, 244], text: [72, 85, 99]},
};

// As fontes padrão do PDF (Helvetica/WinAnsi) não têm alguns símbolos: troca por equivalentes seguros.
export function pdfSafe(text) {
  return String(text ?? '')
    .replace(/\u2153/g, '1/3').replace(/\u2154/g, '2/3').replace(/\u215b/g, '1/8')
    .replace(/[\u2211\u03a3]\s*(?=(sub)?total)/gi, '')
    .replace(/[\u2211\u03a3]/g, 'Soma')
    .replace(/[✓✔✅]/g, '')
    .replace(/[⚠⚡]/g, '')
    .replace(/[→➜]/g, '->')
    .replace(/[⭐★]/g, '*')
    .replace(/ /g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ–—‘’“”•…‹›€]/g, '')
    .replace(/[ \t]+/g, ' ').trim();
}

function setStyle(doc, st) {
  doc.setFont('helvetica', st.italic ? (st.bold ? 'bolditalic' : 'italic') : (st.bold ? 'bold' : 'normal'));
  doc.setFontSize(st.size);
}

/**
 * Quebra um texto rico em linhas.
 * @param blocks [{type:'title'|'fields'|'note'|'meta', ...}] ver recordBlocks()
 * @returns {lines, height}
 */
export function layoutRich(doc, words, width) {
  const lines = [];
  let line = {words: [], w: 0, size: 0};
  const push = () => { if (line.words.length) lines.push(line); line = {words: [], w: 0, size: 0}; };
  for (const word of words) {
    if (word.newline) { push(); if (word.gap) lines.push({words: [], w: 0, size: 0, gap: word.gap}); continue; }
    let w = 0;
    for (const part of word.parts) { setStyle(doc, part); part.w = part.pill ? doc.getTextWidth(part.text) + 2.6 : doc.getTextWidth(part.text); w += part.w; }
    word.w = w;
    setStyle(doc, word.parts[word.parts.length - 1]);
    const space = word.space ?? doc.getTextWidth(' ');
    if (line.words.length && line.w + space + w > width) push();
    if (w > width && !word.parts.some(p => p.pill)) {
      // Palavra maior que a linha (ex.: link ou código longo): corta por caracteres.
      const part = word.parts[word.parts.length - 1]; setStyle(doc, part);
      let chunk = '';
      for (const ch of part.text) {
        if (doc.getTextWidth(chunk + ch) > width - 1 && chunk) { line.words.push({parts: [{...part, text: chunk, w: doc.getTextWidth(chunk)}], x: 0, w: doc.getTextWidth(chunk)}); line.size = Math.max(line.size, part.size); push(); chunk = ''; }
        chunk += ch;
      }
      if (chunk) { const cw = doc.getTextWidth(chunk); line.words.push({parts: [{...part, text: chunk, w: cw}], x: 0, w: cw}); line.w = cw; line.size = Math.max(line.size, part.size); }
      continue;
    }
    word.x = line.words.length ? line.w + space : 0;
    line.words.push(word); line.w = word.x + w;
    line.size = Math.max(line.size, ...word.parts.map(p => p.size));
  }
  push();
  let height = 0;
  for (const l of lines) { l.h = l.gap ?? l.size * PT * 1.28; height += l.h; }
  return {lines, height};
}

export function drawRich(doc, layout, x, y) {
  let cy = y;
  for (const l of layout.lines) {
    const base = cy + l.h * 0.78;
    for (const word of l.words) {
      let px = x + word.x;
      for (const part of word.parts) {
        setStyle(doc, part);
        if (part.pill) {
          const h = part.size * PT * 1.18, top = base - part.size * PT * 0.86;
          doc.setFillColor(...part.fill); doc.roundedRect(px, top, part.w, h, 1.1, 1.1, 'F');
          doc.setTextColor(...part.color); doc.text(part.text, px + 1.3, base - 0.15);
        } else {
          doc.setTextColor(...(part.color || [30, 41, 59])); doc.text(part.text, px, base);
        }
        px += part.w;
      }
    }
    cy += l.h;
  }
}

// Números separados por espaço (telefones, códigos) não se quebram no meio.
const words = (text, style) => pdfSafe(text).replace(/(\d) (?=\d)/g, '$1\u00a0').split(/[ \t\r\n]+/).filter(Boolean).map(t => ({parts: [{...style, text: t}]}));

/**
 * Converte um lançamento em palavras estilizadas.
 * record: {title, badges:[{text,tone}], fields:[{label,value}], note, meta, level, kind}
 */
export function recordWords(record, {base = 7.4, titleSize = 8.6} = {}) {
  const out = [];
  const sub = record.level > 0;
  const tSize = sub ? titleSize - 0.6 : titleSize;
  out.push(...words(record.title || 'Sem descrição', {bold: true, size: tSize, color: sub ? [30, 50, 70] : [10, 37, 58]}));
  for (const b of record.badges || []) {
    const tone = TONES[b.tone] || TONES.muted;
    out.push({parts: [{text: pdfSafe(b.text), bold: true, size: base - 0.9, pill: true, fill: tone.fill, color: tone.text}], space: 1.6});
  }
  const fields = (record.fields || []).filter(f => pdfSafe(f.value));
  if (fields.length) {
    out.push({newline: true, gap: 0.6});
    fields.forEach((f, i) => {
      const val = words(f.value, {size: base, color: [35, 48, 64]});
      const label = {text: pdfSafe(f.label) + ': ', bold: true, size: base, color: [13, 79, 120]};
      const first = val.shift();
      out.push({parts: first ? [label, ...first.parts] : [label], space: i ? 3.2 : undefined});
      out.push(...val);
    });
  }
  if (record.note) {
    out.push({newline: true, gap: 0.5});
    out.push({parts: [{text: 'Obs.: ', bold: true, italic: true, size: base, color: [90, 70, 20]}]});
    out.push(...words(record.note, {italic: true, size: base, color: [72, 60, 30]}));
  }
  if (record.meta) {
    out.push({newline: true, gap: 0.4});
    out.push(...words(record.meta, {size: 5.9, color: [100, 116, 130]}));
  }
  return out;
}

/**
 * Layout de um lançamento dentro de uma largura.
 * fieldCols = 0 → campos em texto corrido ("Rótulo: valor · Rótulo: valor");
 * fieldCols = N → campos alinhados em N colunas (cada campo em sua "caixinha" de largura fixa).
 * @returns {height, draw(x, y)}
 */
export function recordLayout(doc, r, width, style, fieldCols = 0) {
  if (!fieldCols || !(r.fields || []).length) {
    const L = layoutRich(doc, recordWords(r, style), width);
    return {height: L.height, draw: (x, y) => drawRich(doc, L, x, y)};
  }
  const base = style?.base || 7.4;
  const head = layoutRich(doc, recordWords({...r, fields: [], note: '', meta: ''}, style), width);
  const gap = 3, colW = (width - gap * (fieldCols - 1)) / fieldCols;
  const cells = (r.fields || []).filter(f => pdfSafe(f.value)).map(f => {
    const val = words(f.value, {size: base, color: [35, 48, 64]}); const first = val.shift();
    return layoutRich(doc, [{parts: [{text: pdfSafe(f.label) + ': ', bold: true, size: base, color: [13, 79, 120]}, ...(first ? first.parts : [])]}, ...val], colW);
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += fieldCols) rows.push(cells.slice(i, i + fieldCols));
  const rowsH = rows.map(row => Math.max(...row.map(c => c.height)) + 0.5);
  const tw = [];
  if (r.note) { tw.push({newline: true, gap: 0.5}, {parts: [{text: 'Obs.: ', bold: true, italic: true, size: base, color: [90, 70, 20]}]}, ...words(r.note, {italic: true, size: base, color: [72, 60, 30]})); }
  if (r.meta) { tw.push({newline: true, gap: 0.4}, ...words(r.meta, {size: 5.9, color: [100, 116, 130]})); }
  const tail = tw.length ? layoutRich(doc, tw, width) : null;
  const height = head.height + 0.8 + rowsH.reduce((a, b) => a + b, 0) + (tail ? tail.height : 0);
  return {height, draw: (x, y) => {
    drawRich(doc, head, x, y); let cy = y + head.height + 0.8;
    rows.forEach((row, ri) => { row.forEach((c, ci) => drawRich(doc, c, x + ci * (colW + gap), cy)); cy += rowsH[ri]; });
    if (tail) drawRich(doc, tail, x, cy);
  }};
}

/**
 * Desenha a tabela de lançamentos.
 * @param records lista de registros (ver recordWords) + kind:'subtotal'|'total' para linhas de soma
 * @param o {startY, margin:{left,right,top,bottom}, width, head, onPage(data), thumbs: [[{d,w,h}]]}
 */
export function drawRecordsTable(doc, records, o) {
  if ((o.perRow || 1) > 1) return drawRecordsGrid(doc, records, o);
  const numW = o.numW || 11, contentW = o.width - numW;
  const pad = {t: 1.7, b: 1.9, r: 2.2};
  const layouts = [];
  const body = records.map((r, i) => {
    if (r.kind === 'total' || r.kind === 'subtotal') {
      return [{content: '', styles: {fillColor: r.kind === 'total' ? [15, 61, 49] : [234, 240, 244]}}, {content: pdfSafe(r.title), styles: {fontStyle: 'bold', fontSize: r.kind === 'total' ? 8.2 : 7, textColor: r.kind === 'total' ? [255, 255, 255] : [55, 71, 89], fillColor: r.kind === 'total' ? [15, 61, 49] : [234, 240, 244], cellPadding: {top: 1.6, bottom: 1.6, left: 3 + (r.level || 0) * 4, right: 2}}}];
    }
    return [{content: pdfSafe(r.num || ''), styles: {halign: 'center', fontStyle: 'bold', fontSize: r.level ? 6.8 : 7.8, textColor: r.level ? [80, 100, 118] : [8, 81, 71], fillColor: r.level ? [246, 249, 251] : [255, 255, 255]}}, {content: '', _rec: i, styles: {fillColor: r.level ? [246, 249, 251] : [255, 255, 255]}}];
  });
  doc.autoTable({
    startY: o.startY, head: o.head ? [o.head] : undefined, body,
    margin: o.margin, rowPageBreak: 'avoid', showHead: 'everyPage',
    styles: {fontSize: 7.4, cellPadding: {top: pad.t, bottom: pad.b, left: 2, right: pad.r}, overflow: 'linebreak', valign: 'top', textColor: [30, 41, 59], lineColor: [214, 224, 231], lineWidth: 0.15},
    headStyles: {fillColor: o.headColor || [8, 81, 71], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2},
    columnStyles: {0: {cellWidth: numW}, 1: {cellWidth: contentW}},
    didParseCell: data => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const r = records[data.row.index];
      if (!r || r.kind) return;
      const thumbs = o.thumbs?.[data.row.index] || [];
      const thumbW = thumbs.reduce((a, t) => a + 11 * (t.w / t.h) + 1.5, 0);
      const indent = 2 + (r.level || 0) * 3.2;
      const layout = recordLayout(doc, r, contentW - indent - pad.r - thumbW, o.style, o.fieldCols || 0);
      layouts[data.row.index] = {layout, indent, thumbs};
      data.cell.text = [''];
      data.cell.styles.minCellHeight = Math.max(layout.height + pad.t + pad.b, thumbs.length ? 13.5 : 0);
    },
    didDrawCell: data => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const L = layouts[data.row.index]; if (!L) return;
      const r = records[data.row.index];
      if (r.level) { doc.setFillColor(...(r.accent || [21, 132, 91])); doc.rect(data.cell.x + L.indent - 1.6, data.cell.y + 1.3, 0.7, data.cell.height - 2.6, 'F'); }
      L.layout.draw(data.cell.x + L.indent, data.cell.y + pad.t);
      let tx = data.cell.x + data.cell.width - pad.r;
      for (const t of L.thumbs) { const h = 11, w = h * (t.w / t.h); tx -= w; try { doc.addImage(t.d, 'JPEG', tx, data.cell.y + 1.3, w, h); } catch { /* imagem inválida: ignora */ } tx -= 1.5; }
    },
    didDrawPage: data => o.onPage?.(data),
  });
  return doc.lastAutoTable.finalY;
}

/**
 * Vários blocos por linha (2, 3, 4…): cada lançamento vira um cartão com o número no título.
 * Linhas de subtotal/total ocupam a largura toda.
 */
export function drawRecordsGrid(doc, records, o) {
  const n = Math.max(2, Math.min(6, o.perRow | 0)), pad = {t: 1.7, b: 1.9, l: 2, r: 2};
  const cellW = o.width / n, body = [], map = [];
  let row = [], rowMap = [];
  const flush = () => { if (!row.length) return; while (row.length < n) { row.push({content: '', styles: {fillColor: [255, 255, 255]}}); rowMap.push(null); } body.push(row); map.push(rowMap); row = []; rowMap = []; };
  records.forEach(r => {
    if (r.kind) { flush(); body.push([{content: pdfSafe(r.title), colSpan: n, styles: {fontStyle: 'bold', fontSize: r.kind === 'total' ? 8.2 : 7, textColor: r.kind === 'total' ? [255, 255, 255] : [55, 71, 89], fillColor: r.kind === 'total' ? [15, 61, 49] : [234, 240, 244]}}]); map.push([null]); return; }
    row.push({content: '', styles: {fillColor: r.level ? [246, 249, 251] : [255, 255, 255]}}); rowMap.push({...r, title: (r.num ? r.num + '. ' : '') + (r.title || '')});
    if (row.length === n) flush();
  });
  flush();
  const layouts = new Map();
  doc.autoTable({
    startY: o.startY, head: o.head ? [[{content: o.head[o.head.length - 1], colSpan: n}]] : undefined, body,
    margin: o.margin, rowPageBreak: 'avoid', showHead: 'everyPage',
    styles: {fontSize: 7.4, cellPadding: {top: pad.t, bottom: pad.b, left: pad.l, right: pad.r}, overflow: 'linebreak', valign: 'top', textColor: [30, 41, 59], lineColor: [214, 224, 231], lineWidth: 0.15},
    headStyles: {fillColor: o.headColor || [8, 81, 71], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6, cellPadding: 2},
    columnStyles: Object.fromEntries(Array.from({length: n}, (_, i) => [i, {cellWidth: cellW}])),
    didParseCell: data => {
      if (data.section !== 'body') return;
      const r = map[data.row.index]?.[data.column.index]; if (!r) return;
      const L = recordLayout(doc, r, cellW - pad.l - pad.r - (r.level ? 2 : 0), o.style, o.fieldCols || 0);
      layouts.set(data.row.index + ':' + data.column.index, L);
      data.cell.text = [''];
      data.cell.styles.minCellHeight = L.height + pad.t + pad.b;
    },
    didDrawCell: data => {
      if (data.section !== 'body') return;
      const L = layouts.get(data.row.index + ':' + data.column.index); if (!L) return;
      const r = map[data.row.index][data.column.index];
      if (r.level) { doc.setFillColor(...(r.accent || [21, 132, 91])); doc.rect(data.cell.x + 1.2, data.cell.y + 1.3, 0.7, data.cell.height - 2.6, 'F'); }
      L.draw(data.cell.x + pad.l + (r.level ? 2 : 0), data.cell.y + pad.t);
    },
    didDrawPage: data => o.onPage?.(data),
  });
  return doc.lastAutoTable.finalY;
}

/**
 * Cabeçalho COMPACTO de relatório (regra permanente): título + números + barrinha discreta em
 * no máximo ~11 mm. Nunca cards grandes nem barra de progresso larga ocupando meia folha.
 * stats: [{label, value, color?}] · pct: 0–100 ou null
 */
export function drawCompactHeader(doc, x, y, width, title, stats = [], pct = null) {
  doc.setFontSize(7.4); doc.setFont('helvetica', 'bold');
  const parts = stats.filter(s => s && s.value !== undefined && s.value !== null && s.value !== '').map(s => ({...s, text: pdfSafe(String(s.value)) + ' ' + pdfSafe(s.label)}));
  const statsW = parts.reduce((a, p) => a + doc.getTextWidth(p.text) + 4.4, 0);
  doc.setFontSize(11); doc.setTextColor(10, 37, 58);
  // título inteiro: se não couber ao lado dos números, os números descem para a linha de baixo
  const full = pdfSafe(title || '');
  const sameLine = doc.getTextWidth(full) <= width - statsW - 4;
  const tl = doc.splitTextToSize(full, sameLine ? width - statsW - 4 : width);
  doc.text(tl, x, y + 4.2);
  if (!sameLine) y += tl.length * 4.6;
  else if (tl.length > 1) y += (tl.length - 1) * 4.6;
  let sx = x + width; doc.setFontSize(7.4);
  for (const st of parts.slice().reverse()) {
    doc.setFont('helvetica', 'bold'); const w = doc.getTextWidth(st.text) + 3.4; sx -= w;
    doc.setFillColor(241, 246, 249); doc.roundedRect(sx, y + 0.9, w - 1, 4.6, 1, 1, 'F');
    doc.setTextColor(...(st.color || [8, 81, 71])); doc.text(st.text, sx + 1.2, y + 4.2); sx -= 1;
  }
  let yy = y + 6.4;
  if (pct !== null && pct !== undefined && Number.isFinite(Number(pct))) {
    const p = Math.max(0, Math.min(100, Number(pct)));
    doc.setFillColor(226, 232, 240); doc.roundedRect(x, yy, width, 1.2, 0.6, 0.6, 'F');
    if (p > 0) { doc.setFillColor(...(p === 100 ? [34, 160, 94] : [59, 130, 246])); doc.roundedRect(x, yy, width * p / 100, 1.2, 0.6, 0.6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(90, 105, 120); doc.text(p + '% concluído', x + width, yy + 3.6, {align: 'right'});
    yy += 4.6;
  }
  return yy + 1.2;
}

/** Faixa de indicadores (cards) com largura dividida igualmente. */
export function drawKpis(doc, x, y, width, cards, {h = 7.5} = {}) {
  // COMPACTO (regra permanente): ficha baixa com número à esquerda e rótulo à direita.
  const gap = 2, w = (width - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const cx = x + i * (w + gap);
    doc.setFillColor(...(c.fill || [241, 247, 249])); doc.setDrawColor(...(c.border || [210, 224, 232])); doc.setLineWidth(0.15);
    doc.roundedRect(cx, y, w, h, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...(c.color || [8, 81, 71]));
    const v = pdfSafe(String(c.value)); doc.text(v, cx + 2.2, y + h / 2 + 1.6);
    const vw = doc.getTextWidth(v);
    doc.setFontSize(5.8); doc.setTextColor(...(c.labelColor || [70, 88, 102]));
    const lab = doc.splitTextToSize(pdfSafe(c.label).toUpperCase(), Math.max(10, w - vw - 6))[0] || '';
    doc.text(lab, cx + w - 1.8, y + h / 2 + 1.2, {align: 'right'});
  });
  return y + h;
}

/** Caixa de "Informações comuns a todos os lançamentos" (valores repetidos tirados das linhas). */
export function drawCommonBox(doc, x, y, width, items, title = 'Comum a todos os lançamentos') {
  if (!items.length) return y;
  const w = [{parts: [{text: pdfSafe(title) + ':', bold: true, size: 7, color: [21, 100, 70]}]}];
  items.forEach((f, i) => {
    const val = words(f.value, {size: 7, color: [35, 48, 64]}), first = val.shift();
    w.push({parts: [{text: pdfSafe(f.label) + ': ', bold: true, size: 7, color: [13, 79, 120]}, ...(first ? first.parts : [])], space: i ? 3.2 : undefined}, ...val);
  });
  const layout = layoutRich(doc, w, width - 6);
  const h = layout.height + 3.6;
  doc.setFillColor(237, 248, 242); doc.setDrawColor(190, 228, 206); doc.setLineWidth(0.2); doc.roundedRect(x, y, width, h, 1.6, 1.6, 'FD');
  drawRich(doc, layout, x + 3, y + 1.8);
  return y + h;
}

/**
 * Protege um documento jsPDF inteiro contra símbolos que a fonte padrão não tem
 * (∑, Σ, ✓, ⚠, emojis viravam "£", "&" ou quadrados no PDF).
 */
export function safePdf(doc) {
  if (!doc || doc.__safe) return doc;
  doc.__safe = true;
  const clean = t => Array.isArray(t) ? t.map(clean) : typeof t === 'string' ? (/^[∑Σ]$/.test(t.trim()) ? '' : pdfSafe(t)) : t;
  const keepLines = t => typeof t === 'string' ? t.split('\n').map(l => clean(l)).join('\n') : clean(t);
  const text = doc.text.bind(doc);
  doc.text = (t, ...rest) => text(keepLines(t), ...rest);
  if (typeof doc.autoTable === 'function') {
    const at = doc.autoTable.bind(doc);
    doc.autoTable = options => {
      const user = options?.didParseCell;
      return at({...options, didParseCell: data => { if (user) user(data); if (Array.isArray(data.cell.text)) data.cell.text = data.cell.text.map(l => clean(l)); }});
    };
  }
  return doc;
}

if (typeof window !== 'undefined') Object.assign(window, {safePdf, drawRecordsTable, drawRecordsGrid, drawCompactHeader, drawCommonBox, pdfRecordLayout: recordLayout});
