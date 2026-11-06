import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PDF de demandas usa o motor compacto (sem colunas Atendimento/Registro) e pergunta as opções', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /window\.gerarPdfDemanda=\(secId,opts\)=>generateDemandPdf\(secId,opts\)/);
  assert.doesNotMatch(html, /'ATENDIMENTO','REGISTRO'/);
  const pdf = fs.readFileSync(new URL('../js/demand-pdf.js', import.meta.url), 'utf8');
  assert.match(pdf, /askDemandReportOptions/);
  assert.match(pdf, /head: \['Nº', 'SOLICITAÇÃO, SITUAÇÃO E INFORMAÇÕES'\]/);
  const opts = fs.readFileSync(new URL('../js/report-options.js', import.meta.url), 'utf8');
  assert.match(opts, /opt\('rpt-created', 'Mostrar “Criado por”', [^)]*, false\)/);
  assert.match(opts, /opt\('rpt-updated', 'Mostrar “Última edição”', [^)]*, false\)/);
});
