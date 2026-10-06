import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildDemandReportRows} from '../js/demand-report.js';
import {recordExtra} from '../js/atendimento-meta.js';

test('gerador profissional monta PDF completo e salva com nome do grupo',async()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('window.gerarPdfDemanda=async function'),html.indexOf('window.gerarPdf=async function'));
  const captured={};
  class FakeDoc{
    constructor(){this.internal={getNumberOfPages:()=>1};}
    setFillColor(){} rect(){} setFont(){} setFontSize(){} setTextColor(){} text(){} setDrawColor(){} roundedRect(){} setLineWidth(){} addImage(){} setPage(){}
    splitTextToSize(value){return [String(value)];}
    autoTable(options){captured.table=options;this.lastAutoTable={finalY:120};}
    save(name){captured.name=name;}
  }
  const window={jspdf:{jsPDF:FakeDoc}};
  const context={window,S:{secs:[{id:'g',name:'Solicitações de Pipa',demanda_secretaria_id:'sec'}],items:[{id:'i',atividade_id:'g',description:'Povoado de Carolina',observacao:'Água para as caixas',responsaveis:'Antônio',urgencia:'vermelho',solicitante:'Evandro',created_by_name:'Carlos',created_at:'2026-10-06T12:00:00Z'}],subitems:[],secretarias:[{id:'sec',name:'Agricultura'}]},buildDemandReportRows,recordExtra,fmtD:value=>value,loadB64:async()=>null,toast(){},Date,Set,console};
  vm.createContext(context);vm.runInContext(source,context);await window.gerarPdfDemanda('g');
  assert.equal(JSON.stringify(captured.table.head),JSON.stringify([['#','SOLICITAÇÃO E INFORMAÇÕES','ATENDIMENTO','REGISTRO']]));
  assert.match(captured.table.body[0][1].content,/Solicitante: Evandro/);assert.match(captured.table.body[0][2],/Urgência: Urgente/);assert.match(captured.table.body[0][3],/Criado por: Carlos/);
  assert.match(captured.name,/RELATORIO-SOLICITACOES-DE-PIPA-\d{4}-\d{2}-\d{2}\.pdf/);
});
