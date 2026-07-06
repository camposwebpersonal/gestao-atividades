// relatorios_resumo_medicoes_pdf.js - VERSÃO ATUALIZADA COM STATUS E PAGAMENTO

import { showSpinner, hideSpinner, generatePDFFileName, extractReportInfo, addPdfCoverPage } from './utils.js';

/**
 * Exporta o relatório de resumo de medições para PDF.
 * @param {string} containerId - O ID do container HTML que contém o relatório.
 * @param {string} reportTitle - O título do relatório.
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @param {boolean} includePayments - Se deve incluir a seção de pagamentos.
 */
export async function exportSummaryMeasurementsToPDF(containerId, reportTitle, withCover = false, includePayments = true) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    if (typeof pdf.autoTable !== 'function') {
        hideSpinner();
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
        // Clonamos o container para não afetar a página principal
        printableElement = container.cloneNode(true);
        // Removemos os botões para o PDF, deixando apenas o texto
        printableElement.querySelectorAll('button.status-btn, button.payment-btn').forEach(btn => {
            const text = document.createTextNode(btn.innerText);
            btn.parentNode.replaceChild(text, btn);
        });
        document.body.appendChild(printableElement);
        printableElement.style.display = 'none'; // Esconde o clone

        const headerElement = printableElement.querySelector('.pdf-header');
        const reportInfo = headerElement ? extractReportInfo(headerElement) : {};

        const headerData = {
            myCompany: reportInfo.myCompany || '',
            workName: reportInfo.workName || '',
            clientName: reportInfo.clientName || '',
            period: reportInfo.period || '',
        };

        if (withCover) {
            addPdfCoverPage(pdf, headerData, reportTitle, headerData.myCompany);
            pdf.addPage();
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        let currentY = margin;

        const addCompanyHeader = (doc, yPos) => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(headerData.myCompany || reportTitle, pdfWidth / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            if (headerData.workName) doc.text(`Obra: ${headerData.workName}`, margin, yPos);
            if (headerData.clientName) doc.text(`Cliente: ${headerData.clientName}`, pdfWidth - margin, yPos, { align: 'right'});
            return yPos + 8;
        };

        currentY = addCompanyHeader(pdf, currentY);

        // Tabela de Valores por BM
        const bmSummaryContainer = printableElement.querySelector('#bm-summary-table')?.closest('.report-summary');
        if (bmSummaryContainer) {
            const table = bmSummaryContainer.querySelector('table');
            const tableTitle = bmSummaryContainer.querySelector('h3')?.innerText || 'Valores por BM';
            
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(tableTitle, margin, currentY);
            currentY += 8;

            const head = [Array.from(table.querySelectorAll('thead th')).map(th => th.innerText)];
            const body = Array.from(table.querySelectorAll('tbody tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
            );
            
            pdf.autoTable({
                head: head,
                body: body,
                startY: currentY,
                margin: { left: margin, right: margin },
                theme: 'grid',
                styles: { fontSize: 8, textColor: [0, 0, 0] },
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
            });
            currentY = pdf.lastAutoTable.finalY + 10;
        }

        // Bloco de Resumo das Notas
        const statsContainer = printableElement.querySelector('#bm-stats-summary');
        if (statsContainer) {
            const statsTitle = statsContainer.querySelector('h4')?.innerText;
            const statsItems = Array.from(statsContainer.querySelectorAll('.stats-grid div')).map(div => div.innerText);

            if (currentY + 25 > pdf.internal.pageSize.getHeight() - margin) {
                pdf.addPage();
                currentY = addCompanyHeader(pdf, margin);
            }
            
            pdf.setFontSize(11);
            pdf.setFont(undefined, 'bold');
            pdf.text(statsTitle, margin, currentY);
            currentY += 6;

            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            statsItems.forEach(item => {
                pdf.text(item, margin + 2, currentY);
                currentY += 5;
            });
            currentY += 5;
        }

        // Tabela de Pagamentos Adicionais
        if (includePayments) {
            const paymentsContainer = printableElement.querySelector('#payments-section');
            if (paymentsContainer) {
                const table = paymentsContainer.querySelector('table');
                const tableTitle = paymentsContainer.querySelector('h3')?.innerText;

                if (currentY + 40 > pdf.internal.pageSize.getHeight() - margin) {
                    pdf.addPage();
                    currentY = addCompanyHeader(pdf, margin);
                }

                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(tableTitle, margin, currentY);
                currentY += 8;

                const head = [Array.from(table.querySelectorAll('thead th')).map(th => th.innerText)];
                const body = Array.from(table.querySelectorAll('tbody tr')).map(row => {
                    return Array.from(row.querySelectorAll('td')).map((td, idx) => {
                        // Coluna Data: remover horário
                        if (idx === 0 && td.innerText.includes(',')) {
                            return td.innerText.split(',')[0];
                        }
                        return td.innerText;
                    });
                });
                const foot = Array.from(table.querySelectorAll('tfoot tr')).map(row => {
                    return Array.from(row.querySelectorAll('td')).map(td => td.innerText);
                });
                
                pdf.autoTable({
                    head: head, body: body, foot: foot,
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    theme: 'grid',
                    showFoot: 'lastPage',
                    styles: { fontSize: 8, textColor: [0, 0, 0] },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
                    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
                    columnStyles: {
                        0: { halign: 'left' },   // Data
                        1: { halign: 'left' },   // Tipo
                        2: { halign: 'right' },  // Obs (onde fica o texto "Total Pago")
                        3: { halign: 'right' }   // Valor Pago
                    }
                });
                currentY = pdf.lastAutoTable.finalY + 10;
                
                // 🎯 Totais após a tabela de Pagamentos
                const totalContainer = printableElement.querySelector('#payments-section').parentElement.querySelector('.report-total');
                if (totalContainer) {
                    if (currentY + 25 > pdf.internal.pageSize.getHeight() - margin) {
                        pdf.addPage();
                        currentY = addCompanyHeader(pdf, margin);
                    }
                    
                    pdf.setFontSize(11);
                    pdf.setFont(undefined, 'bold');
                    const paragraphs = Array.from(totalContainer.querySelectorAll('p'));
                    paragraphs.forEach(p => {
                        pdf.text(p.innerText, pdfWidth - margin, currentY, { align: 'right' });
                        currentY += 6;
                    });
                    currentY += 2;

                    pdf.setFontSize(13);
                    pdf.setFont(undefined, 'bold');
                    const finalTotal = totalContainer.querySelector('h4')?.innerText || '';
                    pdf.text(finalTotal, pdfWidth - margin, currentY, { align: 'right' });
                    currentY += 10;
                }
            }
        }
        
        const fileName = generatePDFFileName(
            reportInfo.workName, reportInfo.bmNumber, reportInfo.startDate, reportInfo.endDate, 'RESUMO_MEDICOES'
        ) + '.pdf';
        
        pdf.save(fileName);

    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
    } finally {
        if (printableElement) {
            document.body.removeChild(printableElement);
        }
        hideSpinner();
    }
}
