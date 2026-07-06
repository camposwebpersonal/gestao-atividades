// relatorios_areia_ultimos_precos_pdf.js
import { showSpinner, hideSpinner, formatCurrency, extractReportInfo, generatePDFFileName, addPdfCoverPage } from './utils.js';

/**
 * Exporta o relatório de últimos preços de areia para PDF.
 * @param {string} containerId - O ID do container HTML que contém o relatório.
 * @param {string} reportTitle - O título do relatório para o nome do arquivo PDF.
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @returns {Promise<void>}
 */
export async function exportSandLatestPricesReportToPDF(containerId, reportTitle, withCover) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); // A4 Paisagem

    const container = document.getElementById(containerId);
    if (!container) {
        hideSpinner();
        alert("Erro: Contêiner do relatório não encontrado.");
        return;
    }

    let printableElement = null;

    try {
        // Clona o elemento para manipulação sem afetar o DOM visível
        printableElement = container.cloneNode(true);
        printableElement.id = 'printable-clone-sand-latest-prices-report-pdf'; // ID único para o clone
        printableElement.style.position = 'fixed';
        printableElement.style.top = '0';
        printableElement.style.left = '0';
        printableElement.style.width = '100%';
        printableElement.style.height = '100%';
        printableElement.style.overflow = 'auto';
        printableElement.style.opacity = '0'; // Torna invisível
        printableElement.style.pointerEvents = 'none';
        printableElement.style.zIndex = '9999';

        // Aplica estilos básicos para garantir que as bordas e padding apareçam no PDF
        printableElement.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
        });
        printableElement.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
        });

        document.body.appendChild(printableElement);
        // Pequeno atraso para garantir que o clone seja renderizado no DOM antes de capturar
        await new Promise(resolve => setTimeout(resolve, 100));

        const headerElement = printableElement.querySelector('.pdf-header');
        const reportInfo = extractReportInfo(headerElement);

        // Adiciona capa se solicitado
        if (withCover) {
            addPdfCoverPage(pdf, reportInfo, reportTitle, reportInfo.myCompany);
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35; // Espaço reservado para o cabeçalho e título da seção

        // Função para adicionar o cabeçalho completo e o título da seção em cada página
        const addPageHeaders = (doc, data, sectionTitle) => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(reportInfo.myCompany, pdfWidth / 2, margin, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            
            let y = margin + 2;
            const lh = 4.5;
            // Adapta o cabeçalho para este relatório específico
            doc.text(reportInfo.reportSpecificTitle, margin, y);
            doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, pdfWidth - margin, y, { align: 'right' });
            
            if (sectionTitle) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(sectionTitle, margin, y + 8);
            }
        };

        // Tabela de Resumo
        const summaryTable = printableElement.querySelector('#sand-latest-prices-table');
        if (summaryTable) {
            const head = Array.from(summaryTable.querySelectorAll('thead th')).map(th => th.innerText);
            const body = Array.from(summaryTable.querySelectorAll('tbody tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText)
            );
            const foot = Array.from(summaryTable.querySelectorAll('tfoot tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText)
            );

            pdf.autoTable({
                head: [head],
                body: body,
                foot: foot.length > 0 ? foot : [],
                startY: headerHeight,
                margin: { left: margin, right: margin },
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
                headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
                footStyles: { fillColor: [210, 210, 210], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawPage: (data) => addPageHeaders(pdf, data, 'Últimos Preços Registrados'),
            });
        }

        const fileName = generatePDFFileName(
            'Ultimos Precos Areia', // Nome base para o arquivo
            null, // Sem BM number
            null, null, // Sem datas específicas de período
            reportTitle // Usa o título do relatório como parte do nome
        ) + '.pdf';
        
        // pdf.save(fileName);
        return pdf;

    } catch (e) {
        console.error("Erro ao gerar PDF do relatório de últimos preços de areia:", e);
        alert("Não foi possível gerar o PDF do relatório de últimos preços de areia. Detalhes: " + e.message);
        return null;
    } finally {
        hideSpinner();
        // Remove o elemento clonado do DOM
        if (printableElement && printableElement.parentNode) {
            setTimeout(() => {
                printableElement.parentNode.removeChild(printableElement);
            }, 100);
        }
    }
}
