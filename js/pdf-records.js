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
 * Desenha a tabela de lançamentos.
 * @param records lista de registros (ver recordWords) + kind:'subtotal'|'total' para linhas de soma
 * @param o {startY, margin:{left,right,top,bottom}, width, head, onPage(data), thumbs: [[{d,w,h}]]}
 */
export function drawRecordsTable(doc, records, o) {
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
      const layout = layoutRich(doc, recordWords(r, o.style), contentW - indent - pad.r - thumbW);
      layouts[data.row.index] = {layout, indent, thumbs};
      data.cell.text = [''];
      data.cell.styles.minCellHeight = Math.max(layout.height + pad.t + pad.b, thumbs.length ? 13.5 : 0);
    },
    didDrawCell: data => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const L = layouts[data.row.index]; if (!L) return;
      const r = records[data.row.index];
      if (r.level) { doc.setFillColor(...(r.accent || [21, 132, 91])); doc.rect(data.cell.x + L.indent - 1.6, data.cell.y + 1.3, 0.7, data.cell.height - 2.6, 'F'); }
      drawRich(doc, L.layout, data.cell.x + L.indent, data.cell.y + pad.t);
      let tx = data.cell.x + data.cell.width - pad.r;
      for (const t of L.thumbs) { const h = 11, w = h * (t.w / t.h); tx -= w; try { doc.addImage(t.d, 'JPEG', tx, data.cell.y + 1.3, w, h); } catch { /* imagem inválida: ignora */ } tx -= 1.5; }
    },
    didDrawPage: data => o.onPage?.(data),
  });
  return doc.lastAutoTable.finalY;
}

/** Faixa de indicadores (cards) com largura dividida igualmente. */
export function drawKpis(doc, x, y, width, cards, {h = 14} = {}) {
  const gap = 2.5, w = (width - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const cx = x + i * (w + gap);
    doc.setFillColor(...(c.fill || [241, 247, 249])); doc.setDrawColor(...(c.border || [210, 224, 232])); doc.setLineWidth(0.2);
    doc.roundedRect(cx, y, w, h, 1.8, 1.8, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...(c.color || [8, 81, 71]));
    doc.text(pdfSafe(String(c.value)), cx + 3.2, y + 6.6);
    doc.setFontSize(6.4); doc.setTextColor(...(c.labelColor || [70, 88, 102]));
    const lab = doc.splitTextToSize(pdfSafe(c.label).toUpperCase(), w - 5);
    if (lab.length > 1) { doc.setFontSize(5.6); doc.text(doc.splitTextToSize(pdfSafe(c.label).toUpperCase(), w - 5).slice(0, 2), cx + 3.2, y + 9.9); }
    else doc.text(lab[0], cx + 3.2, y + 11.2);
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

if (typeof window !== 'undefined') window.safePdf = safePdf;
