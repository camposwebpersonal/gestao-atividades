// PDF "Relatório de demandas": um bloco por lançamento, com situação e campos na mesma área.
import {buildDemandRecords, fmtDay} from './demand-report.js?v=3';
import {drawRecordsTable, drawKpis, drawCommonBox, pdfSafe, safePdf} from './pdf-records.js?v=2';
import {commonValues} from './record-fields.js?v=2';
import {askDemandReportOptions} from './report-options.js?v=2';
import {recordExtra} from './atendimento-meta.js';

const fileName = name => ('RELATORIO-' + (name || 'DEMANDAS')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();

export async function generateDemandPdf(secId, opts) {
  const S = window.S, toast = window.toast || (() => {});
  const sec = S.secs.find(s => s.id === secId); if (!sec) return;
  if (!window.jspdf?.jsPDF) { toast('O gerador de PDF ainda não carregou. Recarregue a página.', 'error'); return; }
  const items = S.items.filter(i => i.atividade_id === secId);
  const itemIds = new Set(items.map(i => i.id));
  const subs = S.subitems.filter(s => itemIds.has(s.item_id));
  if (!opts) {
    opts = await askDemandReportOptions({title: sec.name, groupId: secId, counts: {subitems: subs.length}});
    if (!opts) return;
  }
  toast('Preparando o relatório…', 'info', 6000);
  const secretariat = S.secretarias?.find(s => s.id === sec.demanda_secretaria_id)?.name || '';
  const scoped = window.pdfPicker && (opts.pickIds || (opts.scope && opts.scope !== 'todos')) ? window.pdfPicker.apply(items, subs, opts) : {items, subitems: subs};
  let records = buildDemandRecords(scoped.items, scoped.subitems, {...opts, group: sec, templates: S.fieldTemplates || [], secretarias: S.secretarias || []});
  if (opts.includeNotes === false) records.forEach(r => { r.note = ''; });

  // Informações iguais em todos os lançamentos vão para o cabeçalho, não para cada linha.
  const common = commonValues(records.map(r => ({fields: r.fields})));
  if (common.length) records.forEach(r => { r.fields = r.fields.filter(f => !common.some(c => c.label === f.label && c.value === f.value)); });

  const {jsPDF} = window.jspdf, doc = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
  safePdf(doc);
  const W = 210, H = 297, mx = 10, cw = W - mx * 2, footer = 9, slim = 12;
  const generated = new Date().toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
  const logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120).catch(() => null);
  const font = (size, bold = false, color = [27, 45, 61]) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  const title = pdfSafe(String(sec.name || 'Demandas').toUpperCase());

  // Cabeçalho completo só na 1ª página; nas demais, faixa fina para sobrar espaço.
  const firstHeader = () => {
    doc.setFillColor(8, 51, 68); doc.rect(0, 0, W, 22, 'F'); doc.setFillColor(21, 132, 91); doc.rect(0, 21, W, 1.4, 'F');
    if (logo) { const h = 14, w = h * logo.w / logo.h; doc.addImage(logo.d, 'PNG', W - mx - w, 4, w, h, 'demand-logo', 'FAST'); }
    font(7.5, true, [152, 229, 203]); doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA', mx, 7.5);
    font(13, true, [255, 255, 255]); doc.text('RELATÓRIO DE DEMANDAS', mx, 14);
    font(7.2, false, [218, 235, 240]); doc.text('Gestão de Atividades  •  Emitido em ' + generated, mx, 18.8);
  };
  const slimHeader = () => {
    doc.setFillColor(8, 51, 68); doc.rect(0, 0, W, slim - 3, 'F'); doc.setFillColor(21, 132, 91); doc.rect(0, slim - 3, W, 0.8, 'F');
    font(7.5, true, [255, 255, 255]); doc.text(doc.splitTextToSize(title, cw - 50)[0], mx, 5.8);
    font(6.8, false, [218, 235, 240]); doc.text('Relatório de demandas  •  ' + generated, W - mx, 5.8, {align: 'right'});
  };
  const pageFooter = () => {
    doc.setDrawColor(21, 132, 91); doc.setLineWidth(0.4); doc.line(mx, H - footer, W - mx, H - footer);
    font(6.6, false, [70, 88, 102]); doc.text('Prefeitura Municipal de Sertânia — Sistema de Gestão de Atividades', mx, H - 4.2);
  };

  firstHeader();
  let y = 29;
  font(15, true, [12, 42, 62]);
  const tl = doc.splitTextToSize(title, cw); doc.text(tl, mx, y); y += tl.length * 6;
  const sub = [secretariat && secretariat.toUpperCase(), (sec.assunto || recordExtra(sec).assunto) && 'Assunto: ' + (sec.assunto || recordExtra(sec).assunto), sec.responsaveis && 'Responsáveis: ' + sec.responsaveis, sec.start_date && 'Início: ' + fmtDay(sec.start_date), sec.end_date && 'Término: ' + fmtDay(sec.end_date)].filter(Boolean).map(pdfSafe).join('   •   ');
  if (sub) { font(7.8, true, [21, 110, 75]); const l = doc.splitTextToSize(sub, cw); doc.text(l, mx, y); y += l.length * 3.6 + 1.5; }
  if (sec.observacoes) {
    font(7.4, false, [60, 80, 95]); const l = doc.splitTextToSize(pdfSafe(sec.observacoes), cw - 7), h = l.length * 3.3 + 4;
    doc.setFillColor(245, 249, 251); doc.setDrawColor(210, 224, 232); doc.roundedRect(mx, y, cw, h, 1.5, 1.5, 'FD'); doc.setFillColor(21, 132, 91); doc.rect(mx, y, 1.6, h, 'F');
    doc.text(l, mx + 4.5, y + 4.3); y += h + 3;
  }
  const mains = records.filter(r => r.level === 0), all = records;
  y = drawKpis(doc, mx, y, cw, [
    {value: mains.length, label: 'Itens'},
    {value: all.length - mains.length, label: 'Subitens'},
    {value: all.filter(r => r.priority).length, label: 'Prioritários', fill: [255, 248, 230], color: [150, 85, 10]},
    {value: all.filter(r => r.urgency === 'vermelho' && !r.done).length, label: 'Urgentes', fill: [253, 240, 238], color: [160, 28, 20]},
    {value: all.filter(r => r.late).length, label: 'Atrasados', fill: [253, 240, 238], color: [160, 28, 20]},
    {value: all.filter(r => r.done).length, label: 'Concluídos', fill: [236, 248, 241], color: [15, 95, 50]},
  ]) + 3;
  if (common.length) y = drawCommonBox(doc, mx, y, cw, common) + 3;

  if (!records.length) records = [{num: '—', level: 0, title: 'Nenhum lançamento para os filtros escolhidos.', badges: [], fields: []}];
  drawRecordsTable(doc, records, {
    startY: y, width: cw, head: ['Nº', 'SOLICITAÇÃO, SITUAÇÃO E INFORMAÇÕES'],
    margin: {left: mx, right: mx, top: slim + 2, bottom: footer + 3},
    onPage: data => { if (data.pageNumber > 1) slimHeader(); pageFooter(); },
  });
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); font(6.8, true, [8, 51, 68]); doc.text(`${p}/${pages}`, W - mx, H - 4.2, {align: 'right'}); }
  doc.save(fileName(sec.name) + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
  toast('Relatório gerado!', 'success');
}
