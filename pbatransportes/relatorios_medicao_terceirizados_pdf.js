// relatorios_medicao_terceirizados_pdf.js - VERSÃO CORRIGIDA FINAL

import { showSpinner, hideSpinner, generatePDFFileName, extractReportInfo, getDateRangeFormatted } from './utils.js';
import { addDamagePagesToExistingPDF } from './lancamentos_avarias.js';
import { appState } from './appState.js';

function findObservacoesColumnIndex(headers) {
    return headers.findIndex(h => h.trim().toLowerCase().includes('observa'));
}

function findColumnIndexes(headers, searchTerms) {
    const lowered = headers.map(h => h.trim().toLowerCase());
    return searchTerms.map(term => lowered.findIndex(h => h.includes(term.toLowerCase())));
}

function extractTableData(tableElement) {
    if (!tableElement) return { head: [], body: [], foot: [] };

    const head = Array.from(tableElement.querySelectorAll('thead tr')).map(tr => 
        Array.from(tr.querySelectorAll('th')).map(th => th.innerText)
    );

    const bodyRows = [];
    const footRows = [];

    const allRows = Array.from(tableElement.querySelectorAll('tbody tr, tfoot tr'));

    let valorDiaTotal = 0;
    let valorDiaColumnIndex = -1;

    if (head.length > 0) {
        valorDiaColumnIndex = head[0].findIndex(h => h.trim() === 'Valor Dia (R$)');
    }

    allRows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th'));
        const isOfficiallyFooter = tr.parentElement.tagName.toLowerCase() === 'tfoot';
        const hasColspan = cells.some(cell => cell.hasAttribute('colspan'));
        const hasTotalText = cells.some(cell => cell.innerText.trim().toLowerCase().startsWith('total'));

        if (isOfficiallyFooter || hasColspan || hasTotalText) {
            footRows.push(cells.map(cell => cell.innerText));
            return;
        }

        const rowData = cells.map(cell => cell.innerText);
        bodyRows.push(rowData);
        if (valorDiaColumnIndex !== -1 && rowData[valorDiaColumnIndex]) {
            const value = parseFloat(rowData[valorDiaColumnIndex].replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.'));
            if (!isNaN(value)) {
                valorDiaTotal += value;
            }
        }
    });

    if (valorDiaColumnIndex !== -1 && bodyRows.length > 0) {
        const totalRow = new Array(head[0].length).fill('');
        if (valorDiaColumnIndex > 0) {
            totalRow[valorDiaColumnIndex - 1] = 'Total Dia:';
        } else {
            totalRow[valorDiaColumnIndex] = 'Total Dia:';
        }
        totalRow[valorDiaColumnIndex] = valorDiaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        footRows.push(totalRow);
    }

    return { head, body: bodyRows, foot: footRows };
}

export async function exportReportToPDF(containerId, reportTitle) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    if (typeof pdf.autoTable !== 'function') {
        hideSpinner();
        console.error("jspdf-autotable não está carregado. Verifique se o script está incluído no seu HTML.");
        alert("Erro: A biblioteca para gerar tabelas no PDF não foi encontrada.");
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        hideSpinner();
        alert("Erro: Contêiner do relatório não encontrado.");
        return;
    }

    let printableElement = null;

    try {
        printableElement = container.cloneNode(true);
        printableElement.id = 'printable-clone';
        printableElement.style.position = 'fixed';
        printableElement.style.top = '0';
        printableElement.style.left = '0';
        printableElement.style.width = '100%';
        printableElement.style.height = '100%';
        printableElement.style.overflow = 'auto';
        printableElement.style.opacity = '0';
        printableElement.style.pointerEvents = 'none';
        printableElement.style.zIndex = '9999';

        printableElement.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
        });
        printableElement.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
        });

        document.body.appendChild(printableElement);
        await new Promise(resolve => setTimeout(resolve, 100));

        const headerData = {};
        const headerElement = printableElement.querySelector('.pdf-header');
        if (headerElement) {
            const pElements = headerElement.getElementsByTagName('p');
            headerData.myCompany = pElements[0]?.innerText || '';
            headerData.workName = pElements[1]?.innerText || '';
            headerData.reportType = pElements[2]?.innerText || '';
            headerData.period = pElements[3]?.innerText || '';
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();

        const addPageHeaders = (data, sectionTitle) => {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(headerData.myCompany || reportTitle, pdfWidth / 2, margin, { align: 'center' });
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            
            let y = margin + 2;
            const lh = 4.5;
            if (headerData.workName) pdf.text(headerData.workName, margin, y);
            y += lh;
            if (headerData.reportType) pdf.text(headerData.reportType, margin, y);
            if (headerData.period) pdf.text(headerData.period, pdfWidth - margin, y, { align: 'right' });
            
            if (sectionTitle) {
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(sectionTitle, margin, y + 8);
            }
        };

        const headerHeight = 35;

        // 1. SEÇÃO DE RESUMO (PAISAGEM) - ESTRUTURA IGUAL AO PRINCIPAL
        const summaryElement = printableElement.querySelector('.report-summary');
        if (summaryElement) {
            const summaryTitle = 'Resumo Geral da Medição de Terceirizados';
            const summaryTable = summaryElement.querySelector('#summary-table');
            if (summaryTable) {
                const summaryTableData = extractTableData(summaryTable);
                const headers = summaryTableData.head[0] || [];
                const observacoesIndex = findObservacoesColumnIndex(headers);
                const [acrescimosIndex, descontosIndex, mobilizacaoIndex, desmobilizacaoIndex] = findColumnIndexes(headers, [
                    'acréscimos', 'descontos', 'mobilização', 'desmobilização'
                ]);
                
                // Encontrar índices para larguras customizadas
                const valorUnitIndex = headers.findIndex(h => h.toLowerCase().includes('valor unit'));
                const diasTrabIndex = headers.findIndex(h => h.toLowerCase().includes('dias trab'));
                const horimetroInicialIndex = headers.findIndex(h => h.toLowerCase().includes('horímetro inicial'));
                const horimetroFinalIndex = headers.findIndex(h => h.toLowerCase().includes('horímetro final'));
                const horasTrabIndex = headers.findIndex(h => h.toLowerCase().includes('horas trab'));
                const acrescimosColIndex = headers.findIndex(h => h.toLowerCase().includes('acrésc'));
                const descontosColIndex = headers.findIndex(h => h.toLowerCase().includes('desc.'));
                const mobilizacaoColIndex = headers.findIndex(h => h.toLowerCase().includes('mob.'));
                const desmobilizacaoColIndex = headers.findIndex(h => h.toLowerCase().includes('desmob.'));

                let grandTotal = 0;
                const totalColumnIndex = headers.findIndex(h => h.toLowerCase().includes('total'));

                if (totalColumnIndex !== -1) {
                    summaryTableData.body.forEach(row => {
                        const valueStr = row[totalColumnIndex] || '0';
                        const cleaned = valueStr.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');
                        const num = parseFloat(cleaned);
                        if (!isNaN(num)) grandTotal += num;
                    });
                }

                // IGUAL AO PRINCIPAL: Remove linha de total de equipamentos e processa separadamente
                const summaryTableDataModified = { ...summaryTableData };
                let totalEquipamentosText = '';

                summaryTableDataModified.foot = summaryTableData.foot.filter(row => {
                    const firstCell = row[0] || '';
                    if (firstCell.toLowerCase().includes('total') && firstCell.toLowerCase().includes('equipamento')) {
                        totalEquipamentosText = firstCell;
                        return false;
                    }
                    return true;
                });

                pdf.autoTable({
                    head: summaryTableDataModified.head,
                    body: summaryTableDataModified.body,
                    foot: summaryTableDataModified.foot,
                    startY: headerHeight,
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 1.5, textColor: [0, 0, 0] },
                    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
                    footStyles: { fillColor: [210, 210, 210], textColor: [0, 0, 0], fontStyle: 'bold' },
                    columnStyles: { 
                        0: { cellWidth: 10 }, // SEQ
                        1: { cellWidth: 'auto' }, // Equipamento
                        ...(valorUnitIndex !== -1 ? { [valorUnitIndex]: { cellWidth: 'auto' } } : {}), // Valor Unit. (AUTO)
                        ...(diasTrabIndex !== -1 ? { [diasTrabIndex]: { cellWidth: 12 } } : {}), // Dias Trab.
                        ...(horimetroInicialIndex !== -1 ? { [horimetroInicialIndex]: { cellWidth: 18 } } : {}), // Horímetro Inicial (reduzido)
                        ...(horimetroFinalIndex !== -1 ? { [horimetroFinalIndex]: { cellWidth: 18 } } : {}), // Horímetro Final (reduzido)
                        ...(horasTrabIndex !== -1 ? { [horasTrabIndex]: { cellWidth: 15 } } : {}), // HORAS TRAB. (reduzido)
                        ...(acrescimosColIndex !== -1 ? { [acrescimosColIndex]: { cellWidth: 20 } } : {}), // Acréscimos
                        ...(descontosColIndex !== -1 ? { [descontosColIndex]: { cellWidth: 20 } } : {}), // Descontos
                        ...(mobilizacaoColIndex !== -1 ? { [mobilizacaoColIndex]: { cellWidth: 20 } } : {}), // Mobilização
                        ...(desmobilizacaoColIndex !== -1 ? { [desmobilizacaoColIndex]: { cellWidth: 20 } } : {}), // Desmobilização
                        ...(totalColumnIndex !== -1 ? { [totalColumnIndex]: { cellWidth: 25, halign: 'right', fontStyle: 'bold' } } : {}) // Total Equip. (aumentado)
                    },
                    showHead: 'everyPage',
                    didDrawPage: (data) => {
                        if (data.pageNumber === 1) {
                            addPageHeaders(data, summaryTitle);
                        } else {
                            pdf.setFontSize(12);
                            pdf.setFont(undefined, 'bold');
                            pdf.text(headerData.myCompany || reportTitle, pdfWidth / 2, margin, { align: 'center' });
                            pdf.setFontSize(9);
                            pdf.setFont(undefined, 'normal');
                            
                            let y = margin + 2;
                            const lh = 4.5;
                            if (headerData.workName) pdf.text(headerData.workName, margin, y);
                            y += lh;
                            if (headerData.reportType) pdf.text(headerData.reportType, margin, y);
                            if (headerData.period) pdf.text(headerData.period, pdfWidth - margin, y, { align: 'right' });
                        }
                    },
                    didParseCell: function (data) {
                        const text = (Array.isArray(data.cell.text) ? data.cell.text.join(' ') : data.cell.text || '').trim();
                        const idx = data.column.index;
                        
                        if (data.section === 'body') {
                            // Colorir colunas da tabela de resumo
                            if (idx === acrescimosColIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === descontosColIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238]; // Rosa claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === mobilizacaoColIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === desmobilizacaoColIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            }
                            
                            // Colorir colunas de outras tabelas (detalhamento)
                            if (idx === observacoesIndex && text && text !== '---') {
                                data.cell.styles.fillColor = [227, 242, 253];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === acrescimosIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === descontosIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            } else if ((idx === mobilizacaoIndex || idx === desmobilizacaoIndex) && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                });

                const grandTotalElement = summaryElement.querySelector('#grand-total');
                if (totalEquipamentosText || grandTotalElement) {
                    const finalY = pdf.lastAutoTable.finalY || headerHeight + 50;
                    pdf.setDrawColor(200, 200, 200);
                    pdf.line(margin, finalY + 3, pdfWidth - margin, finalY + 3);
                    pdf.setFillColor(210, 210, 210);
                    pdf.rect(margin, finalY + 5, pdfWidth - (margin * 2), 8, 'F');
                    pdf.setFontSize(10);
                    pdf.setFont(undefined, 'bold');
                    pdf.setTextColor(0, 0, 0);
                    if (totalEquipamentosText) {
                        pdf.text(totalEquipamentosText, margin + 5, finalY + 10, { align: 'left' });
                    }
                    if (grandTotalElement) {
                        pdf.text(grandTotalElement.innerText, pdfWidth - margin - 5, finalY + 10, { align: 'right' });
                    }
                }
            }
        }

        // 2. SEÇÕES DE DETALHAMENTO (RETRATO) - IGUAL AO PRINCIPAL
        const detailElements = printableElement.querySelectorAll('.report-detail');
        for (const detail of detailElements) {
            pdf.addPage('a4', 'portrait');
            const detailTitle = detail.querySelector('h3')?.innerText || 'Detalhamento';
            const allTablesInDetail = detail.querySelectorAll('table');

        if (allTablesInDetail.length > 0) {
            const mainDetailTableData = extractTableData(allTablesInDetail[0]);
            const headers = mainDetailTableData.head[0] || [];
            const observacoesIndex = findObservacoesColumnIndex(headers);
            const [acrescimosDetailIndex, descontosDetailIndex, paradasIndex] = findColumnIndexes(headers, [
                'acréscimos', 'descontos', 'paradas desc.(h)'
            ]);
        
            // CORREÇÃO: Extrair valores do rodapé e mapear para posições corretas
            const originalFootRow = mainDetailTableData.foot.find(row => 
                row.some(cell => cell && cell.toLowerCase().includes('totais:'))
            );
            
            // Encontrar índices das colunas
            const horasTrabIndex = headers.findIndex(h => h.trim().toLowerCase().includes('horas trab.'));
            const kmTrabIndex = headers.findIndex(h => h.trim().toLowerCase().includes('km trab.'));
            const paradasHIndex = headers.findIndex(h => h.trim().toLowerCase().includes('paradas (h)'));
            const valorDiarioIndex = headers.findIndex(h => h.trim().toLowerCase().includes('valor dia'));
            
            // Criar array com o tamanho correto
            const totalsTableRow = Array(headers.length).fill('');
            
            if (originalFootRow) {
                // Extrair valores específicos do rodapé original
                const totalHorasText = originalFootRow.find(cell => cell && cell.includes('h') && !cell.includes('km') && !cell.toLowerCase().includes('totais'));
                const totalKmText = originalFootRow.find(cell => cell && cell.includes('km'));
                const totalParadasText = originalFootRow.find(cell => {
                    // Procurar pela célula de paradas (pode ser "0.00h" ou valor diferente)
                    const text = cell ? cell.toString().toLowerCase() : '';
                    return text.includes('h') && !text.includes('km') && !text.includes('totais') && 
                           originalFootRow.indexOf(cell) !== originalFootRow.indexOf(totalHorasText);
                });
                const totalValorText = originalFootRow.find(cell => cell && cell.includes('R$'));
                
                // Mapear para as posições corretas
                totalsTableRow[0] = 'Totais:';
                
                if (horasTrabIndex !== -1 && totalHorasText) {
                    totalsTableRow[horasTrabIndex] = totalHorasText;
                }
                if (kmTrabIndex !== -1 && totalKmText) {
                    totalsTableRow[kmTrabIndex] = totalKmText;
                }
                if (paradasHIndex !== -1) {
                    totalsTableRow[paradasHIndex] = totalParadasText || '0.00h';
                }
                if (valorDiarioIndex !== -1 && totalValorText) {
                    totalsTableRow[valorDiarioIndex] = totalValorText;
                }
            } else {
                // Se não encontrou o rodapé original, criar um vazio
                totalsTableRow[0] = 'Totais:';
                if (horasTrabIndex !== -1) totalsTableRow[horasTrabIndex] = '0.00h';
                if (kmTrabIndex !== -1) totalsTableRow[kmTrabIndex] = '0.00 km';
                if (paradasHIndex !== -1) totalsTableRow[paradasHIndex] = '0.00h';
                if (valorDiarioIndex !== -1) totalsTableRow[valorDiarioIndex] = 'R$ 0,00';
            }

        
            pdf.autoTable({
                head: mainDetailTableData.head,
                body: mainDetailTableData.body,
                foot: [totalsTableRow],
                startY: headerHeight,
                margin: { left: margin, right: margin },
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak', textColor: [0, 0, 0] },
                headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
                footStyles: { 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fillColor: [240, 240, 240]
                },
                columnStyles: { 
                    0: { cellWidth: 16 },   // Data (ajustado)
                    1: { cellWidth: 12 },   // Dia Sem. (ajustado)
                    2: { cellWidth: 12 },   // Status (ajustado)
                    3: { cellWidth: 25 },   // Horímetro/KM (aumentado)
                    4: { cellWidth: 13, halign: 'right' },  // Horas Trab. (reduzido)
                    5: { cellWidth: 12, halign: 'right' },  // KM Trab. (reduzido)
                    6: { cellWidth: 13, halign: 'right' },  // Paradas (h) (reduzido)
                    7: { cellWidth: 20, halign: 'right' },  // Valor Dia (reduzido)
                    8: { cellWidth: 'auto' }  // Observações
                },
                showHead: 'everyPage',
                pageBreak: 'auto',
                didDrawPage: (data) => {
                    if (data.pageNumber === 1) {
                        addPageHeaders(data, detailTitle);
                    } else {
                        pdf.setFontSize(12);
                        pdf.setFont(undefined, 'bold');
                        pdf.text(headerData.myCompany || reportTitle, pdfWidth / 2, margin, { align: 'center' });
                        pdf.setFontSize(9);
                        pdf.setFont(undefined, 'normal');
                        
                        let y = margin + 2;
                        const lh = 4.5;
                        if (headerData.workName) pdf.text(headerData.workName, margin, y);
                        y += lh;
                        if (headerData.reportType) pdf.text(headerData.reportType, margin, y);
                        if (headerData.period) pdf.text(headerData.period, pdfWidth - margin, y, { align: 'right' });
                    }
                },
                didParseCell: function (data) {
                    const text = (Array.isArray(data.cell.text) ? data.cell.text.join(' ') : data.cell.text || '').trim();
                    const idx = data.column.index;
                    if (data.section === 'body') {
                        if (idx === observacoesIndex && text && text !== '---') {
                            data.cell.styles.fillColor = [227, 242, 253];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (idx === acrescimosDetailIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                            data.cell.styles.fillColor = [232, 245, 233];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (idx === descontosDetailIndex && parseFloat(text.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.')) > 0) {
                            data.cell.styles.fillColor = [255, 235, 238];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (idx === paradasIndex && parseFloat(text.replace(/h\s?/, '').replace(',', '.')) > 0) {
                            data.cell.styles.fillColor = [255, 248, 220];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
        }

            
            // Tabela de resumo do detalhamento com estilos corretos
            if (allTablesInDetail.length > 1) {
                const totalsTableData = extractTableData(allTablesInDetail[1]);
            
                // Processar dados para garantir 4 colunas
                const processedBody = [];
                let totalEquipamentoValue = 0;
                let foundTotalEquipamento = false;
            
                // CORREÇÃO: Primeiro, procurar pela linha "Total Equipamento" nos dados originais
                totalsTableData.body.forEach(row => {
                    // Garantir que temos 4 colunas
                    while (row.length < 4) {
                        row.push('');
                    }
            
                    const firstCell = (row[0] || '').toLowerCase();
                    
                    // CORREÇÃO: Capturar valor do total equipamento se existir
                    if (firstCell.includes('total') && firstCell.includes('equipamento')) {
                        foundTotalEquipamento = true;
                        // CORREÇÃO: Pegar o valor da coluna correta e processar adequadamente
                        const valueText = row[3] || '0';
                        // Remover formatação e converter para número
                        const cleanValue = valueText.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                        totalEquipamentoValue = parseFloat(cleanValue) || 0;
                        console.log(`PDF: Total Equipamento encontrado: ${valueText} -> ${totalEquipamentoValue}`);
                        return; // Não adiciona esta linha ao processedBody ainda
                    }
                    
                    // Adicionar outras linhas normalmente
                    processedBody.push([
                        row[0] || '', // Tipo
                        row[1] || '', // Data
                        row[2] || '', // Descrição
                        row[3] || ''  // Valor
                    ]);
                });
            
                // CORREÇÃO: Se não encontrou, tentar buscar no HTML diretamente
                if (!foundTotalEquipamento) {
                    console.log('PDF: Total Equipamento não encontrado na tabela, buscando no HTML...');
                    
                    // Buscar na tabela HTML diretamente
                    const totalEquipRows = allTablesInDetail[1].querySelectorAll('tbody tr');
                    totalEquipRows.forEach(tr => {
                        const cells = tr.querySelectorAll('td');
                        if (cells.length >= 4) {
                            const firstCellText = cells[0].innerText.toLowerCase();
                            if (firstCellText.includes('total') && firstCellText.includes('equipamento')) {
                                const valueText = cells[3].innerText || '0';
                                const cleanValue = valueText.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                                totalEquipamentoValue = parseFloat(cleanValue) || 0;
                                foundTotalEquipamento = true;
                                console.log(`PDF: Total Equipamento encontrado no HTML: ${valueText} -> ${totalEquipamentoValue}`);
                            }
                        }
                    });
                }
            
                // CORREÇÃO: Se ainda não encontrou, calcular das linhas de acréscimos/descontos
                if (!foundTotalEquipamento && processedBody.length > 0) {
                    console.log('PDF: Calculando Total Equipamento das linhas existentes...');
                    totalEquipamentoValue = 0;
                    processedBody.forEach(row => {
                        if (row[3]) {
                            const cleanValue = row[3].replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                            const numValue = parseFloat(cleanValue) || 0;
                            
                            // CORREÇÃO: Verificar se é desconto (valor negativo ou tipo desconto)
                            const isDesconto = (row[0] || '').toLowerCase().includes('desconto') || numValue < 0;
                            if (isDesconto) {
                                // Se já é negativo, somar diretamente; se positivo, subtrair
                                totalEquipamentoValue += numValue < 0 ? numValue : -numValue;
                            } else {
                                totalEquipamentoValue += Math.abs(numValue);
                            }
                            console.log(`PDF: Processando linha: ${row[0]} = ${numValue} (isDesconto: ${isDesconto})`);
                        }
                    });
                    console.log(`PDF: Total calculado: ${totalEquipamentoValue}`);
                }
            
                // SEMPRE adicionar linha de Total Equipamento com valor correto
                processedBody.push([
                    'Total Equipamento',
                    '',
                    '',
                    totalEquipamentoValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                ]);
            
                // SEMPRE criar a tabela, mesmo se só tiver a linha de total
                pdf.autoTable({
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: processedBody,
                    startY: pdf.lastAutoTable.finalY + 5,
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: { 
                        fontSize: 8,
                        cellPadding: 1.5,
                        textColor: [0, 0, 0],
                        fillColor: [255, 255, 255],
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200]
                    },
                    headStyles: { 
                        fillColor: [230, 230, 230],
                        textColor: [0, 0, 0],
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200],
                        fontStyle: 'bold'
                    },
                    columnStyles: {
                        0: { cellWidth: 30, halign: 'left' },   // Tipo
                        1: { cellWidth: 25, halign: 'center' }, // Data
                        2: { cellWidth: 85, halign: 'left' },   // Descrição
                        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }   // Valor - ADICIONAR fontStyle: 'bold'
                    },

                    didParseCell: function (data) {
                        const text = (Array.isArray(data.cell.text) ? data.cell.text.join(' ') : data.cell.text || '').trim();
                        const textLower = text.toLowerCase();
                        
                        if (data.section === 'body') {
                            // Detectar tipos de linha
                            const isTotalEquipamento = textLower.includes('total') && textLower.includes('equipamento');
                            const isMobilizacao = textLower.includes('mobili') || textLower.includes('desmobili');
                            const isAcrescimo = textLower.includes('acrÃ©scimo') || textLower.includes('acrescimo');
                            const isDesconto = textLower.includes('desconto');
                            
                            if (isTotalEquipamento) {
                                // Total Equipamento: Cinza suave igual ao cliente
                                data.cell.styles.fillColor = [240, 240, 240];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (isMobilizacao || isAcrescimo) {
                                // MobilizaÃ§Ã£o/DesmobilizaÃ§Ã£o e AcrÃ©scimos: Verde claro
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (isDesconto) {
                                // Descontos: Vermelho claro
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            } else {
                                // Outras linhas: Branco
                                data.cell.styles.fillColor = [255, 255, 255];
                            }
                            
                            // NOVA CORREÇÃO: Forçar negrito na coluna Valor (índice 3) para linha Total Equipamento
                            if (data.column.index === 3 && isTotalEquipamento) {
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        
                        // Garantir bordas consistentes
                        data.cell.styles.lineWidth = 0.1;
                        data.cell.styles.lineColor = [200, 200, 200];
                    }
                });
            } else {
                // FALLBACK: Se não há segunda tabela, criar uma básica com "Total Equipamento"
                // CORREÇÃO: Tentar buscar o valor total no HTML da seção de detalhes
                let fallbackTotal = 0;
                const detailTotalElements = detail.querySelectorAll('strong, .total-value, [class*="total"]');
                detailTotalElements.forEach(el => {
                    const text = el.innerText || el.textContent || '';
                    if (text.includes('R$') && (text.includes('Total') || text.includes('total'))) {
                        const valueMatch = text.match(/R\$\s?([\d.,]+)/);
                        if (valueMatch) {
                            const cleanValue = valueMatch[1].replace(/\./g, '').replace(',', '.');
                            const numValue = parseFloat(cleanValue);
                            if (!isNaN(numValue)) {
                                fallbackTotal = numValue;
                            }
                        }
                    }
                });
                
                pdf.autoTable({
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: [
                        ['Total Equipamento', '', '', fallbackTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
                    ],
                    startY: pdf.lastAutoTable.finalY + 5,
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: { 
                        fontSize: 8,
                        cellPadding: 1.5,
                        textColor: [0, 0, 0],
                        fillColor: [240, 240, 240], // Cinza suave
                        fontStyle: 'bold'
                    },
                    headStyles: { 
                        fillColor: [230, 230, 230],
                        fontStyle: 'bold'
                    },
                    columnStyles: {
                        0: { cellWidth: 30, halign: 'left' },
                        1: { cellWidth: 25, halign: 'center' },
                        2: { cellWidth: 85, halign: 'left' },
                        3: { cellWidth: 35, halign: 'right' }
                    }
                });
            }
            
            // 🔧 NOVO: Adicionar avarias deste equipamento após o detalhamento
            const equipmentId = detail.dataset.equipId;
            if (equipmentId && appState.damages) {
                // Pegar período da medição
                const reportContainer = document.getElementById(containerId);
                const reportInfo = extractReportInfo(reportContainer);
                const startDate = reportInfo?.startDate;
                const endDate = reportInfo?.endDate;
                
                // Filtrar avarias deste equipamento no período
                const equipmentDamages = appState.damages.filter(damage => 
                    damage.equipment_id == equipmentId &&
                    damage.damage_date >= startDate &&
                    damage.damage_date <= endDate
                ).sort((a, b) => new Date(a.damage_date) - new Date(b.damage_date));
                
                if (equipmentDamages.length > 0) {
                    console.log(`📎 Adicionando ${equipmentDamages.length} avaria(s) do equipamento ${equipmentId} (terceirizado)`);
                    
                    // Adicionar cada avaria
                    for (const damage of equipmentDamages) {
                        const newPageNumber = await addDamagePagesToExistingPDF(
                            pdf, 
                            damage, 
                            (doc, pageNum) => addBasicHeader(doc, pdfWidth, margin), 
                            pdf.internal.getNumberOfPages()
                        );
                    }
                }
            }
        }

        // 3. SALVAR O PDF
        const reportInfo = extractReportInfo(headerElement);
        
        // 🎯 NOVO FORMATO: OBRA_-_EMPRESA_-_BM X TERCEIRIZADO_-_DD-MM-YYYY a DD-MM-YYYY
        const workPart = (reportInfo.workName || 'OBRA').toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const companyPart = (reportInfo.clientName || reportInfo.myCompany || 'EMPRESA').toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const bmPart = `BM ${reportInfo.bmNumber || ''} TERCEIRIZADO`;
        const dateRange = getDateRangeFormatted(reportInfo.startDate, reportInfo.endDate);
        const fileName = `${workPart}_-_${companyPart}_-_${bmPart}_-_${dateRange}.pdf`;
        
        setTimeout(() => {
            // Comentado: pdf.save(fileName);
            // Retorna o PDF para permitir uso posterior (WhatsApp, etc)
            hideSpinner();
        }, 100);
        
        return pdf;

    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
    } finally {
        if (printableElement && printableElement.parentNode) {
            setTimeout(() => {
                printableElement.parentNode.removeChild(printableElement);
            }, 100);
        }
    }
}

// 🚀 FUNÇÃO DE UPLOAD PARA GOOGLE DRIVE
async function uploadToGoogleDrive(pdfBlob, fileName, reportInfo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        
        reader.onloadend = async () => {
            const base64Data = reader.result;
            
            const workName = reportInfo.workName || 'OBRA DESCONHECIDA';
            const companyName = reportInfo.clientName || reportInfo.myCompany || 'EMPRESA';
            const bmLabel = `BM ${reportInfo.bmNumber || ''} TERCEIRIZADO`;
            const dateRange = getDateRangeFormatted(reportInfo.startDate, reportInfo.endDate);
            
            console.log('📤 Upload para Drive - Relatório Terceirizado');
            console.log('🏛️ Obra:', workName);
            console.log('👤 Empresa:', companyName);
            console.log('📊 BM:', bmLabel);
            console.log('📆 Período:', dateRange);
            
            try {
                const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pdfData: base64Data,
                        fileName: fileName,
                        workName: workName,
                        companyName: companyName,
                        bmLabel: bmLabel,
                        dateRange: dateRange
                    })
                });
                
                console.log('📊 Status da resposta:', response.status);
                const result = await response.json();
                console.log('📋 Resultado completo:', result);
                
                if (result.success) {
                    console.log(`✅ PDF salvo em: ${result.folderPath}`);
                    resolve(result);
                } else {
                    console.error('❌ Detalhes do erro:', result);
                    console.warn('⚠️ Erro ao salvar no Drive:', result.error);
                    reject(result.error);
                }
            } catch (error) {
                console.error('❌ Erro na requisição:', error);
                console.warn('⚠️ Falha na comunicação com Drive:', error);
                reject(error);
            }
        };
        
        reader.onerror = (error) => reject(error);
    });
}
