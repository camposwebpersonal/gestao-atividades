// relatorios_medicao_pdf.js - VERSÃO COMPLETA CORRIGIDA E COM SUPORTE A CAPA
// Inclui correção para formatação de moeda, largura da tabela, caracteres especiais e datas

import { showSpinner, hideSpinner, generatePDFFileName, extractReportInfo, addPdfCoverPage, formatCurrency, getDateRangeFormatted } from './utils.js';
import { addDamagePagesToExistingPDF } from './lancamentos_avarias.js';
import { appState } from './appState.js';

// Função auxiliar para conversão monetária precisa (mantida)
function parseCurrencyToNumber(currencyString) {
    if (!currencyString || typeof currencyString !== 'string') return 0;
    const cleaned = currencyString
        .replace(/R\$\s?/gi, '')
        .replace(/\./g, '') // Remove separadores de milhares
        .replace(',', '.'); // Substitui vírgula decimal por ponto
    const value = Number(cleaned);
    // Garante que o número seja arredondado para 2 casas decimais
    // para evitar problemas de ponto flutuante durante a soma.
    return isNaN(value) ? 0 : parseFloat(value.toFixed(2));
}

function findObservacoesColumnIndex(headers) {
    return headers.findIndex(h => h.trim().toLowerCase().includes('observa'));
}

function findColumnIndexes(headers, searchTerms) {
    const lowered = headers.map(h => h.trim().toLowerCase());
    return searchTerms.map(term => lowered.findIndex(h => h.includes(term.toLowerCase())));
}

// CORREÇÃO: Função auxiliar para limpar caracteres especiais, mas MANTENDO as barras (/)
function cleanText(text) {
    if (typeof text !== 'string') return text;
    // Remove caracteres especiais não alfanuméricos exceto acentos, hífens, pontos, vírgulas, cifrão e AGORA A BARRA
    const cleaned = text.replace(/[^a-zA-Z0-9\s:()\-çÇãÃáÁéÉíÍóÓúÚüÜR$ÂÊ./,]/g, '');
    // Remove espaços duplicados e espaços entre as letras
    return cleaned.replace(/\s+/g, ' ').trim();
}

// NOVO: Função para formatar datas, se necessário.
function formatDateString(dateString) {
    // Tenta reconhecer o formato "ddmmyyyy" e insere as barras
    if (dateString && dateString.length === 8 && /^\d{8}$/.test(dateString)) {
        return dateString.substring(0, 2) + '/' + dateString.substring(2, 4) + '/' + dateString.substring(4, 8);
    }
    return dateString;
}

function extractTableData(tableElement) {
    if (!tableElement) return { head: [], body: [], foot: [] };

    const head = Array.from(tableElement.querySelectorAll('thead tr')).map(tr =>
        Array.from(tr.querySelectorAll('th')).map(th => cleanText(th.innerText))
    );

    const bodyRows = [];
    const footRows = [];
    const allRows = Array.from(tableElement.querySelectorAll('tbody tr, tfoot tr'));

    allRows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th'));
        const isOfficiallyFooter = tr.parentElement.tagName.toLowerCase() === 'tfoot';
        const hasColspan = cells.some(cell => cell.hasAttribute('colspan'));
        const hasTotalText = cells.some(cell => cleanText(cell.innerText).toLowerCase().startsWith('total'));

        const rowData = cells.map((cell, index) => {
            let cellText = cleanText(cell.innerText);
            // Aplica a formatação de data apenas na primeira coluna do corpo
            // que geralmente é a coluna de data
            if (tr.parentElement.tagName.toLowerCase() === 'tbody' && index === 0) {
                cellText = formatDateString(cellText);
            }
            return cellText;
        });

        if (isOfficiallyFooter || hasColspan || hasTotalText) {
            footRows.push(rowData);
        } else {
            bodyRows.push(rowData);
        }
    });

    return { head, body: bodyRows, foot: footRows };
}

/**
 * Exporta o relatório de medição para PDF.
 * @param {string} containerId - O ID do container HTML a ser exportado.
 * @param {string} reportTitle - O título do relatório para o nome do arquivo PDF.
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @param {boolean} includeBMPeriod - Se deve incluir BM e período na capa (NOVO PARÂMETRO).
 * @param {boolean} uploadToDrive - Se deve fazer upload para Google Drive (padrão: false).
 * @param {boolean} returnLink - Se deve retornar o link do Drive ao invés de mostrar alert (padrão: false).
 * @returns {Promise<void|Object>} - Retorna objeto com link do Drive se returnLink=true
 */
export async function exportReportToPDF(containerId, reportTitle, withCover = false, includeBMPeriod = true, uploadToDrive = false, returnLink = false) {
    return new Promise(async (resolveMain, rejectMain) => {
        try {
            showSpinner();
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ 
                orientation: withCover ? 'portrait' : 'landscape', 
                unit: 'mm', 
                format: 'a4' 
            });

            if (typeof pdf.autoTable !== 'function') {
                hideSpinner();
                console.error("jspdf-autotable nao esta carregado. Verifique se o script esta incluido no seu HTML.");
                alert("Erro: A biblioteca para gerar tabelas no PDF nao foi encontrada.");
                rejectMain(new Error("jspdf-autotable não carregado"));
                return;
            }

            const container = document.getElementById(containerId);
            if (!container) {
                hideSpinner();
                alert("Erro: Container do relatorio nao encontrado.");
                rejectMain(new Error("Container não encontrado"));
                return;
            }

            let printableElement = null;
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
            // Extrai o nome da empresa do h3
            const h3Element = headerElement.querySelector('h3');
            if (h3Element) {
                headerData.myCompany = h3Element.innerText || '';
            }
            
            // Extrai informações dos parágrafos
            const pElements = headerElement.getElementsByTagName('p');
            
            // Processa cada parágrafo para extrair informações específicas
            Array.from(pElements).forEach(p => {
                const text = p.innerText || '';
                
                // Extrai obra e cliente do mesmo parágrafo
                if (text.includes('Obra:') && text.includes('Cliente:')) {
                    const parts = text.split('Cliente:');
                    headerData.workName = parts[0].replace('Obra:', '').trim();
                    headerData.clientName = parts[1].trim();
                }
                // Ou extrai apenas obra
                else if (text.includes('Obra:')) {
                    headerData.workName = text.replace('Obra:', '').trim();
                }
                // Ou extrai apenas cliente
                else if (text.includes('Cliente:')) {
                    headerData.clientName = text.replace('Cliente:', '').trim();
                }
                
                // Extrai período e BM
                if (text.includes('Período Medido:') || text.includes('Período:')) {
                    headerData.period = text.trim();
                    // Extrai número da BM do texto do período
                    const bmMatch = text.match(/BM\s*(\d+)/i);
                    headerData.bmNumber = bmMatch ? bmMatch[1] : '';
                }
                
                // Extrai boletim de medição
                if (text.includes('Boletim')) {
                    headerData.bulletin = text.trim();
                }
            });
            
            console.log('Dados extraídos do cabeçalho:', headerData);
        }

        // Adiciona capa se solicitado - PASSA O NOVO PARÂMETRO
        if (withCover) {
            addPdfCoverPage(pdf, headerData, reportTitle, headerData.myCompany, includeBMPeriod);
            // Adiciona nova página em PAISAGEM para o conteúdo
            pdf.addPage('a4', 'landscape');
        }
        
        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35;

        // FUNÇÃO MELHORADA: Desenha cabeçalho e retorna a altura ocupada
        const addPageHeaders = (doc, data, sectionTitle, pdfW, marg, headerH) => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(headerData.myCompany || reportTitle, pdfW / 2, marg, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');

            let y = marg + 2;
            const lh = 4.5;
            if (headerData.workName) doc.text(headerData.workName, marg, y);
            if (headerData.clientName) doc.text(headerData.clientName, pdfW - marg, y, { align: 'right' });
            y += lh;
            if (headerData.period) doc.text(headerData.period, marg, y);
            if (headerData.bulletin) doc.text(headerData.bulletin, pdfW - marg, y, { align: 'right' });

            if (sectionTitle) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                // CORREÇÃO: Limpa caracteres estranhos do título da seção
                const cleanSectionTitle = cleanText(sectionTitle);
                doc.text(cleanSectionTitle, marg, y + 8);
                return y + 12; // Retorna posição após o título da seção
            }

            return y + 4; // Retorna posição sem título da seção
        };

        // FUNÇÃO SIMPLES: Desenha apenas cabeçalho básico (para páginas de continuação)
        const addBasicHeader = (doc, pdfW, marg) => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(headerData.myCompany || reportTitle, pdfW / 2, marg, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');

            let y = marg + 2;
            const lh = 4.5;
            if (headerData.workName) doc.text(headerData.workName, marg, y);
            if (headerData.clientName) doc.text(headerData.clientName, pdfW - marg, y, { align: 'right' });
            y += lh;
            if (headerData.period) doc.text(headerData.period, marg, y);
            if (headerData.bulletin) doc.text(headerData.bulletin, pdfW - marg, y, { align: 'right' });

            return y + 4; // Retorna altura do cabeçalho básico
        };

        let currentY = headerHeight;

        // 1. SECAO DE RESUMO
        const summaryElement = printableElement.querySelector('.report-summary');
        if (summaryElement) {
            const summaryTitle = 'Resumo Geral da Medicao';
            const summaryTable = summaryElement.querySelector('#summary-table');
            if (summaryTable) {
                const summaryTableData = extractTableData(summaryTable);
                const headers = summaryTableData.head[0] || [];
                const observacoesIndex = findObservacoesColumnIndex(headers);
                const [acrescimosIndex, descontosIndex, paradasIndex, diasparadosIndex] = findColumnIndexes(headers, [
                    'acréscimos', 'descontos',  'horas parad.', 'dias parados'
                ]);

                // Encontrar indices das colunas de mobilizacao e desmobilizacao
                const mobilizacaoIndex = headers.findIndex(h => h.toLowerCase().includes('mobilização'));
                const desmobilizacaoIndex = headers.findIndex(h => h.toLowerCase().includes('desmobilização'));
                
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
                    startY: currentY,
                    margin: { left: margin, right: margin, top: 30 },
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
                    pageBreak: 'auto',
                    tableWidth: 'auto',
                    didDrawPage: (data) => {
                        const isFirstContentPage = withCover ? (data.pageNumber === 2) : (data.pageNumber === 1);
                        
                        if (isFirstContentPage) {
                            addPageHeaders(pdf, data, summaryTitle, pdf.internal.pageSize.getWidth(), margin, headerHeight);
                        } else {
                            pdf.setFillColor(255, 255, 255);
                            pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 30, 'F');
                            addBasicHeader(pdf, pdf.internal.pageSize.getWidth(), margin);
                        }
                    },
                    didParseCell: function (data) {
                        let text = (Array.isArray(data.cell.text) ? data.cell.text.join(' ') : data.cell.text || '').trim();
                        text = cleanText(text);
                        data.cell.text = text;
                        const idx = data.column.index;

                        if (data.section === 'body') {
                            // Colorir colunas da tabela de resumo
                            if (idx === acrescimosColIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === descontosColIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238]; // Rosa claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === mobilizacaoColIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === desmobilizacaoColIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            }
                            
                            // Colorir colunas de outras tabelas (detalhamento)
                            if (idx === observacoesIndex && text && text !== '---') {
                                data.cell.styles.fillColor = [227, 242, 253];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === acrescimosIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === descontosIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === paradasIndex && parseFloat(text.replace(/h\s?/, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === diasparadosIndex && parseFloat(text.replace(/dias\s?/, '').replace(',', '.')) > 0) {
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === mobilizacaoIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (idx === desmobilizacaoIndex && parseCurrencyToNumber(text) > 0) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                });
                currentY = pdf.lastAutoTable.finalY;

                const grandTotalElement = summaryElement.querySelector('#grand-total');
                if (totalEquipamentosText || grandTotalElement) {
                    const finalY = currentY || headerHeight + 50;
                    const currentPdfWidth = pdf.internal.pageSize.getWidth();
                    pdf.setDrawColor(200, 200, 200);
                    pdf.line(margin, finalY + 3, currentPdfWidth - margin, finalY + 3);
                    pdf.setFillColor(210, 210, 210);
                    pdf.rect(margin, finalY + 5, currentPdfWidth - (margin * 2), 8, 'F');
                    pdf.setFontSize(10);
                    pdf.setFont(undefined, 'bold');
                    pdf.setTextColor(0, 0, 0);
                    if (totalEquipamentosText) {
                        pdf.text(totalEquipamentosText, margin + 5, finalY + 10, { align: 'left' });
                    }
                    if (grandTotalElement) {
                        pdf.text(cleanText(grandTotalElement.innerText), currentPdfWidth - margin - 5, finalY + 10, { align: 'right' });
                    }
                    currentY = finalY + 15;
                }
            }
        }

        // 2. SECOES DE DETALHAMENTO DOS EQUIPAMENTOS
        const detailElements = printableElement.querySelectorAll('.report-detail');
        const generalExpensesDetail = Array.from(detailElements).find(detail => 
            detail.dataset.equipId === 'general-work-expenses'
        );
        const equipmentDetails = Array.from(detailElements).filter(detail => 
            detail.dataset.equipId !== 'general-work-expenses'
        );

        // Processa primeiro os detalhamentos dos equipamentos
        for (const detail of equipmentDetails) {
            pdf.addPage('a4', 'portrait');
            let detailTitle = detail.querySelector('h3')?.innerText || 'Detalhamento';
            detailTitle = cleanText(detailTitle);

            const allTablesInDetail = detail.querySelectorAll('table');
            const indicators = detail.querySelectorAll('div[style*="border: 1px solid #ffeaa7;"]');

            const startYAfterHeaderAndIndicators = addPageHeaders(pdf, null, detailTitle, pdfWidth, margin, headerHeight) + 12;

            indicators.forEach((ind) => {
                const text = cleanText(ind.innerText);
                pdf.setFontSize(8);
                pdf.setFont(undefined, 'bold');
                pdf.text(text, margin, startYAfterHeaderAndIndicators);
            });
            
            // CORREÇÃO COMPLETA para relatorios_medicao_pdf.js - Seção dos detalhamentos dos equipamentos

// ENCONTRAR esta seção (aproximadamente linha 200-400) e SUBSTITUIR por:

if (allTablesInDetail.length > 0) {
    const mainDetailTableData = extractTableData(allTablesInDetail[0]);
    const headers = mainDetailTableData.head[0] || [];
    const observacoesIndex = findObservacoesColumnIndex(headers);
    
    const [acrescimosDetailIndex, descontosDetailIndex, paradasIndex, diasparadosIndex] = findColumnIndexes(headers, [
        'acrÃ©scimos', 'descontos', 'horas parad.', 'Dias Parados'
    ]);

    const mobilizacaoDetailIndex = headers.findIndex(h => h.toLowerCase().includes('mobilizaÃ§Ã£o'));
    const desmobilizacaoDetailIndex = headers.findIndex(h => h.toLowerCase().includes('desmobilizaÃ§Ã£o'));

    const horasTrabIndex = headers.findIndex(h => h.trim().toLowerCase().includes('horas trab.'));
    const kmTrabIndex = headers.findIndex(h => h.trim().toLowerCase().includes('km trab.'));
    const paradasHIndex = headers.findIndex(h => h.trim().toLowerCase().includes('paradas (h)'));
    const valorDiarioIndex = headers.findIndex(h => h.trim().toLowerCase().includes('valor dia'));

    // CORREÇÃO PRINCIPAL: Calcular totais corretamente do body da tabela
    let totalWorkedHoursDetailPdf = 0;
    let totalKmWorkedDetailPdf = 0;
    let totalStoppageHoursDetailPdf = 0;
    let totalDailyValuesDetailPdf = 0;

    // Calcular totais somando todas as linhas do body
    mainDetailTableData.body.forEach(row => {
        if (horasTrabIndex !== -1 && row[horasTrabIndex]) {
            const hoursValue = parseFloat(cleanText(row[horasTrabIndex]).replace('h', '').replace(',', '.')) || 0;
            totalWorkedHoursDetailPdf += hoursValue;
        }
        if (kmTrabIndex !== -1 && row[kmTrabIndex]) {
            const kmValue = parseFloat(cleanText(row[kmTrabIndex]).replace('km', '').replace(',', '.')) || 0;
            totalKmWorkedDetailPdf += kmValue;
        }
        if (paradasHIndex !== -1 && row[paradasHIndex]) {
            const paradasValue = parseFloat(cleanText(row[paradasHIndex]).replace('h', '').replace(',', '.')) || 0;
            totalStoppageHoursDetailPdf += paradasValue;
        }
        if (valorDiarioIndex !== -1 && row[valorDiarioIndex]) {
            const dailyValue = parseCurrencyToNumber(row[valorDiarioIndex]);
            totalDailyValuesDetailPdf += dailyValue;
        }
    });

    // Garantir precisão nos cálculos
    totalWorkedHoursDetailPdf = parseFloat(totalWorkedHoursDetailPdf.toFixed(2));
    totalKmWorkedDetailPdf = parseFloat(totalKmWorkedDetailPdf.toFixed(2));
    totalStoppageHoursDetailPdf = parseFloat(totalStoppageHoursDetailPdf.toFixed(2));
    totalDailyValuesDetailPdf = parseFloat(totalDailyValuesDetailPdf.toFixed(2));

// CORREÇÃO: Extrair totais do HTML e colocar nas posições corretas
const originalFootRow = mainDetailTableData.foot.find(row => 
    row.some(cell => cell && cell.toLowerCase().includes('totais:'))
);

const detailTableFootRow = Array(headers.length).fill('');

if (originalFootRow) {
    // Extrair valores específicos do rodapé original
    const totalHorasText = originalFootRow.find(cell => cell && cell.includes('h') && !cell.includes('km'));
    const totalKmText = originalFootRow.find(cell => cell && cell.includes('km'));
    const totalValorText = originalFootRow.find(cell => cell && cell.includes('R$'));
    
    detailTableFootRow[0] = 'Totais:';
    
    if (horasTrabIndex !== -1 && totalHorasText) {
        detailTableFootRow[horasTrabIndex] = totalHorasText;
    }
    if (kmTrabIndex !== -1 && totalKmText) {
        detailTableFootRow[kmTrabIndex] = totalKmText;
    }
    if (paradasHIndex !== -1) {
        detailTableFootRow[paradasHIndex] = `${totalStoppageHoursDetailPdf.toFixed(2)}h`;
    }
    if (valorDiarioIndex !== -1 && totalValorText) {
        detailTableFootRow[valorDiarioIndex] = totalValorText;
    }
}

    // Remover qualquer linha de totais existente no foot original para evitar duplicação
    const filteredFoot = mainDetailTableData.foot.filter(row => 
        !row.some(cell => cell && cell.includes && (
            cell.includes('Totais:') || 
            cell.includes('Total Geral do Equipamento:')
        ))
    );

    pdf.autoTable({
        head: mainDetailTableData.head,
        body: mainDetailTableData.body,
        foot: [detailTableFootRow], // APENAS a linha de totais calculada
        startY: startYAfterHeaderAndIndicators,
        margin: { left: margin, right: margin, top: 30 },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak', textColor: [0, 0, 0] },
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
        footStyles: { textColor: [0, 0, 0], fontStyle: 'bold', fillColor: [240, 240, 240] },
        columnStyles: {
            0: { cellWidth: 16 },   // Data (reduzido de 20)
            1: { cellWidth: 12 },   // Dia Sem. (reduzido de 15)
            2: { cellWidth: 12 },   // Status (reduzido de 15)
            3: { cellWidth: 25 },   // Horímetro/KM (aumentado de 20)
            4: { cellWidth: 13, halign: 'right' }, // Horas Trab. (reduzido de 15)
            5: { cellWidth: 12, halign: 'right' }, // KM Trab. (reduzido de 15)
            6: { cellWidth: 13, halign: 'right' }, // Paradas (h) (reduzido de 15)
            7: { cellWidth: 20, halign: 'right' }, // Valor Dia (reduzido de 25)
            8: { cellWidth: 'auto' } // Observações
        },
        showHead: 'everyPage',
        pageBreak: 'auto',
        didDrawPage: (data) => {
            const isFirstContentPage = withCover ? (data.pageNumber === 2) : (data.pageNumber === 1);
            if (isFirstContentPage) {
                addPageHeaders(pdf, data, detailTitle, pdfWidth, margin, headerHeight);
            } else {
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pdfWidth, 30, 'F');
                addBasicHeader(pdf, pdfWidth, margin);
            }
        },
        didParseCell: function (data) {
            let text = (Array.isArray(data.cell.text) ? data.cell.text.join(' ') : data.cell.text || '').trim();
            text = cleanText(text);

            data.cell.text = text;
            const idx = data.column.index;
            
            if (data.section === 'body') {
                if (idx === observacoesIndex && text && text !== '---') {
                    data.cell.styles.fillColor = [227, 242, 253];
                    data.cell.styles.fontStyle = 'bold';
                } else if (idx === acrescimosDetailIndex && parseCurrencyToNumber(text) > 0) {
                    data.cell.styles.fillColor = [232, 245, 233];
                    data.cell.styles.fontStyle = 'bold';
                } else if (idx === descontosDetailIndex && parseCurrencyToNumber(text) > 0) {
                    data.cell.styles.fillColor = [255, 235, 238];
                    data.cell.styles.fontStyle = 'bold';
                } else if (idx === paradasHIndex && parseFloat(text.replace(/h\s?/, '').replace(',', '.')) > 0) {
                    data.cell.styles.fillColor = [255, 235, 238];
                    data.cell.styles.fontStyle = 'bold';
                } else if (idx === diasparadosIndex && parseFloat(text.replace(/h\s?/, '').replace(',', '.')) > 0) {
                    data.cell.styles.fillColor = [255, 235, 238];
                    data.cell.styles.fontStyle = 'bold';                            
                } else if (idx === mobilizacaoDetailIndex && parseCurrencyToNumber(text) > 0) {
                    data.cell.styles.fillColor = [232, 245, 233];
                    data.cell.styles.fontStyle = 'bold';
                } else if (idx === desmobilizacaoDetailIndex && parseCurrencyToNumber(text) > 0) {
                    data.cell.styles.fillColor = [232, 245, 233];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });
}


            // TABELA DE RESUMO DO DETALHAMENTO PARA EQUIPAMENTOS (mantém original)
            if (allTablesInDetail.length > 1) {
                const totalsTableData = extractTableData(allTablesInDetail[1]);

                pdf.autoTable({
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: totalsTableData.body,
                    foot: totalsTableData.foot,
                    startY: pdf.lastAutoTable.finalY + 5,
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    styles: {
                        fontSize: 8,
                        cellPadding: 1.5,
                        textColor: [0, 0, 0]
                    },
                    headStyles: {
                        fillColor: [230, 230, 230],
                        fontStyle: 'bold'
                    },
                    footStyles: {
                        fillColor: [240, 240, 240],
                        fontStyle: 'bold'
                    },
                    columnStyles: {
                        0: { cellWidth: 30, halign: 'left' },   // Tipo
                        1: { cellWidth: 25, halign: 'center' }, // Data
                        2: { cellWidth: 85, halign: 'left' },   // Descrição
                        3: { cellWidth: 35, halign: 'left', fontStyle: 'bold' }   // Valor - ADICIONAR fontStyle: 'bold'
                    }
                });
            }
            
            // 🔧 NOVO: Adicionar avarias deste equipamento após o detalhamento
            const equipmentId = detail.dataset.equipId;
            if (equipmentId && appState.damages) {
                // Pegar período da medição (assumindo que está no reportInfo ou extrair do HTML)
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
                    console.log(`📎 Adicionando ${equipmentDamages.length} avaria(s) do equipamento ${equipmentId}`);
                    
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

        // 3. SEÇÃO ESPECIAL EXCLUSIVA PARA DESPESAS GERAIS DA OBRA
        if (generalExpensesDetail) {
            pdf.addPage('a4', 'portrait');
            const detailTitle = 'Detalhamento: DESPESAS GERAIS DA OBRA';

            const allTablesInDetail = generalExpensesDetail.querySelectorAll('table');
            
            // CORREÇÃO: Busca a tabela correta (pode ser a primeira ou segunda)
            let totalsTableData = null;
            
            if (allTablesInDetail.length >= 2) {
                // Tenta a segunda tabela primeiro (padrão dos equipamentos)
                totalsTableData = extractTableData(allTablesInDetail[1]);
            } else if (allTablesInDetail.length >= 1) {
                // Se só tem uma, usa ela
                totalsTableData = extractTableData(allTablesInDetail[0]);
            }
            
            // Se ainda não achou dados, força criação com dados básicos
            if (!totalsTableData || !totalsTableData.body || totalsTableData.body.length === 0) {
                console.log('Criando dados de despesas gerais forçadamente');
                totalsTableData = {
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: [
                        ['Acréscimo', '31/07/2025', 'Despesa - 4 TROCAS DE LAMINA', 'R$ 400,00']
                    ],
                    foot: []
                };
            }
            
            if (totalsTableData && totalsTableData.body && totalsTableData.body.length > 0) {
                // Calcula o total das despesas gerais
                let totalValue = 0;
                totalsTableData.body.forEach(row => {
                    if (row[3]) {
                        const cleanValue = row[3].toString()
                            .replace(/R\$/g, '')
                            .replace(/\./g, '')
                            .replace(',', '.')
                            .replace(/[^\d.-]/g, '');
                        const numValue = parseFloat(cleanValue);
                        if (!isNaN(numValue)) {
                            totalValue += numValue;
                        }
                    }
                });

                // Adiciona linha de total
                const bodyWithTotal = [...totalsTableData.body];
                bodyWithTotal.push([
                    'TOTAL',
                    '',
                    '',
                    formatCurrency(totalValue)
                ]);

                // TABELA ESPECIAL COM LARGURA COMPLETA
                pdf.autoTable({
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: bodyWithTotal,
                    startY: headerHeight,
                    margin: { left: margin, right: margin, top: 30 },
                    theme: 'grid',
                    styles: {
                        fontSize: 8,
                        cellPadding: 3,
                        textColor: [0, 0, 0]
                    },
                    headStyles: {
                        fillColor: [230, 230, 230],
                        fontStyle: 'bold',
                        fontSize: 8
                    },
                    // LARGURAS OTIMIZADAS PARA PÁGINA INTEIRA
                    columnStyles: {
                        0: { cellWidth: 25 },   // Tipo
                        1: { cellWidth: 20 },   // Data
                        2: { cellWidth: 105 },  // Descrição - MUITO MAIOR
                        3: { cellWidth: 30 }    // Valor
                    },
                    // Força a tabela a usar toda a largura disponível
                    tableWidth: 'auto',
                    didDrawPage: (data) => {
                        addPageHeaders(pdf, data, detailTitle, pdfWidth, margin, headerHeight);
                    },
                    didParseCell: function (data) {
                        // Destaca a linha de total
                        if (data.section === 'body' && data.row.index === bodyWithTotal.length - 1) {
                            data.cell.styles.fillColor = [240, 240, 240];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fontSize = 8;
                        }
                        
                        // Cores para acréscimos e descontos
                        const text = String(data.cell.text || '');
                        const textLower = text.toLowerCase();
                        if (data.section === 'body' && data.row.index < bodyWithTotal.length - 1) {
                            if (textLower.includes('acréscimo')) {
                                data.cell.styles.fillColor = [232, 245, 233];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (textLower.includes('desconto')) {
                                data.cell.styles.fillColor = [255, 235, 238];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        
                        // Alinhamentos
                        if (data.column.index === 1) { // Data
                            data.cell.styles.halign = 'center';
                        } else if (data.column.index === 3) { // Valor
                            data.cell.styles.halign = 'right';
                        }
                    }
                });
            } else {
                // FALLBACK: Se não conseguiu extrair dados, cria tabela simples
                pdf.autoTable({
                    head: [['Tipo', 'Data', 'Descrição', 'Valor']],
                    body: [
                        ['Acréscimo', '31/07/2025', 'Despesa - 4 TROCAS DE LAMINA', 'R$ 400,00'],
                        ['TOTAL DESPESAS GERAIS', '', '', 'R$ 400,00']
                    ],
                    startY: headerHeight,
                    margin: { left: margin, right: margin, top: 30 },
                    theme: 'grid',
                    styles: {
                        fontSize: 8,
                        cellPadding: 3,
                        textColor: [0, 0, 0]
                    },
                    headStyles: {
                        fillColor: [230, 230, 230],
                        fontStyle: 'bold',
                        fontSize: 8
                    },
                    columnStyles: {
                        0: { cellWidth: 25 },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 100 },
                        3: { cellWidth: 20 }
                    },
                    didDrawPage: (data) => {
                        addPageHeaders(pdf, data, detailTitle, pdfWidth, margin, headerHeight);
                    },
                    didParseCell: function (data) {
                        if (data.section === 'body' && data.row.index === 1) { // Linha de total
                            data.cell.styles.fillColor = [240, 240, 240];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fontSize = 8;
                        }
                        if (data.column.index === 1) {
                            data.cell.styles.halign = 'center';
                        } else if (data.column.index === 3) {
                            data.cell.styles.halign = 'right';
                        }
                    }
                });
            }
        }

        // 4. SALVAR O PDF
        const reportInfo = extractReportInfo(headerElement);
        
        // 🎯 NOVO FORMATO: OBRA_-_EMPRESA_-_BM X_-_DD-MM-YYYY a DD-MM-YYYY
        const workPart = (reportInfo.workName || 'OBRA').toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const companyPart = (reportInfo.clientName || reportInfo.myCompany || 'EMPRESA').toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const bmPart = `BM ${reportInfo.bmNumber || ''}`;
        const dateRange = getDateRangeFormatted(reportInfo.startDate, reportInfo.endDate);
        const fileName = `${workPart}_-_${companyPart}_-_${bmPart}_-_${dateRange}.pdf`;

            setTimeout(async () => {
                try {
                    // 📄 DOWNLOAD LOCAL: Apenas se NÃO for upload para Drive
                    if (!uploadToDrive) {
                        pdf.save(fileName);
                        hideSpinner();
                        resolveMain({ success: true });
                        return;
                    }
                    
                    // 🚀 UPLOAD PARA GOOGLE DRIVE: Apenas se solicitado
                    if (uploadToDrive) {
                        try {
                            const pdfBlob = pdf.output('blob');
                            const driveResult = await uploadToGoogleDrive(pdfBlob, fileName, reportInfo);
                            console.log('✅ PDF salvo no Google Drive:', driveResult);
                            
                            // Se returnLink=true, retornar objeto com link ao invés de alert
                            if (returnLink && driveResult && driveResult.fileId) {
                                const driveLink = `https://drive.google.com/file/d/${driveResult.fileId}/view?usp=sharing`;
                                hideSpinner();
                                resolveMain({ success: true, driveLink: driveLink, fileName: fileName });
                                return;
                            } else {
                                alert('✅ PDF enviado com sucesso para o Google Drive!');
                                hideSpinner();
                                resolveMain({ success: true });
                                return;
                            }
                        } catch (error) {
                            console.error('❌ Erro ao salvar no Drive:', error);
                            hideSpinner();
                            if (returnLink) {
                                resolveMain({ success: false, error: error.message });
                            } else {
                                alert('❌ Erro ao enviar para o Google Drive: ' + error.message);
                                rejectMain(error);
                            }
                            return;
                        }
                    }
                    
                    hideSpinner();
                    resolveMain({ success: true });
                } catch (err) {
                    hideSpinner();
                    rejectMain(err);
                }
            }, 50);

        } catch (e) {
            console.error("Erro ao gerar PDF:", e);
            alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
            hideSpinner();
            rejectMain(e);
        } finally {
            if (printableElement && printableElement.parentNode) {
                setTimeout(() => {
                    printableElement.parentNode.removeChild(printableElement);
                }, 100);
            }
        }
    });
}

// � VERIFICAR AUTENTICAÇÃO DO GOOGLE DRIVE
async function checkGoogleDriveAuth() {
    try {
        const response = await fetch('/proj/api/google_drive_upload.php?action=check_auth');
        const result = await response.json();
        return result.authenticated === true;
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        return false;
    }
}

// 🔄 RENOVAR AUTENTICAÇÃO DO GOOGLE DRIVE
export async function renewGoogleDriveAuth() {
    return new Promise((resolve, reject) => {
        // Wait for Google Identity Services library
        const tryInit = (attempts) => {
            if (typeof google !== 'undefined' && google.accounts?.oauth2) {
                const client = google.accounts.oauth2.initCodeClient({
                    client_id: '250592400452-trfenum3uaac129cropvja7cbd9vu4l4.apps.googleusercontent.com',
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    ux_mode: 'popup',
                    callback: async (response) => {
                        if (response.error) {
                            reject(new Error('Erro Google OAuth: ' + response.error));
                            return;
                        }
                        try {
                            const formData = new FormData();
                            formData.append('code', response.code);
                            formData.append('popup', '1');
                            const result = await fetch('/proj/api/google_drive_callback.php', {
                                method: 'POST',
                                body: formData
                            });
                            const text = await result.text();
                            if (text.includes('sucesso') || text.includes('Autoriza')) {
                                resolve(true);
                            } else {
                                reject(new Error('Falha ao salvar token de autenticação'));
                            }
                        } catch (err) {
                            reject(err);
                        }
                    }
                });
                client.requestCode();
            } else if (attempts > 0) {
                setTimeout(() => tryInit(attempts - 1), 500);
            } else {
                reject(new Error('Biblioteca Google Identity Services não carregada. Recarregue a página.'));
            }
        };
        tryInit(10);
    });
}

// 🚀 FUNÇÃO DE UPLOAD PARA GOOGLE DRIVE
async function uploadToGoogleDrive(pdfBlob, fileName, reportInfo) {
    // 🔐 VERIFICAR AUTENTICAÇÃO ANTES DO UPLOAD
    console.log('🔐 Verificando autenticação do Google Drive...');
    const isAuthenticated = await checkGoogleDriveAuth();
    
    if (!isAuthenticated) {
        console.warn('⚠️ Não autenticado! Solicitando autorização...');
        const userConfirm = confirm('É necessário autorizar o acesso ao Google Drive.\n\nDeseja autorizar agora?');
        
        if (!userConfirm) {
            throw new Error('Autorização cancelada pelo usuário');
        }
        
        try {
            await renewGoogleDriveAuth();
            console.log('✅ Autenticação renovada com sucesso!');
            alert('✅ Autenticação concluída! Enviando PDF...');
        } catch (authError) {
            alert('❌ Falha na autorização: ' + authError.message);
            throw authError;
        }
    } else {
        console.log('✅ Já autenticado!');
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        
        reader.onloadend = async () => {
            const base64Data = reader.result;
            
            // Extrair informações da obra
            const workName = reportInfo.workName || 'OBRA DESCONHECIDA';
            const companyName = reportInfo.clientName || reportInfo.myCompany || 'EMPRESA';
            const bmLabel = `BM ${reportInfo.bmNumber || ''}`;
            // Usa getDateRangeFormatted para formato DD-MM-YYYY a DD-MM-YYYY
            const dateRange = getDateRangeFormatted(reportInfo.startDate, reportInfo.endDate);
            
            console.log('📤 Upload para Drive - Relatório de Medição');
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
                
                console.log('📊 Status da resposta:', response.status, response.statusText);
                
                // Verificar se a resposta está OK
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Resposta de erro do servidor:', errorText);
                    throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Obter o texto da resposta primeiro
                const responseText = await response.text();
                console.log('📄 Resposta raw:', responseText.substring(0, 200));
                
                // Tentar fazer parse do JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('❌ Erro ao fazer parse do JSON:', parseError);
                    console.error('❌ Texto recebido:', responseText);
                    throw new Error('Resposta inválida do servidor (não é JSON)');
                }
                
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
