// relatorios_partes_diarias_received_pdf.js
import { showSpinner, hideSpinner } from './utils.js';

/**
 * Exporta o relatório de partes diárias recebidas para PDF.
 * @param {string} containerId - O ID do container HTML que contém o relatório.
 * @param {string} reportTitle - O título do relatório para o nome do arquivo PDF e cabeçalho.
 * @returns {Promise<void>}
 */
export async function exportDailyPartsReceivedToPDF(containerId, reportTitle) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
        printableElement.style.position = 'fixed';
        printableElement.style.top = '0';
        printableElement.style.left = '0';
        printableElement.style.width = '100%';
        printableElement.style.height = '100%';
        printableElement.style.overflow = 'auto';
        printableElement.style.opacity = '0';
        printableElement.style.pointerEvents = 'none';
        printableElement.style.zIndex = '9999';

        // Aplicar estilos para garantir que as bordas e padding apareçam no clone
        printableElement.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
        });
        printableElement.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
        });

        document.body.appendChild(printableElement);
        await new Promise(resolve => setTimeout(resolve, 100)); // Pequeno atraso para renderização

        const headerData = {};
        const headerElement = printableElement.querySelector('.pdf-header');
        if (headerElement) {
            const pElements = headerElement.getElementsByTagName('p');
            headerData.myCompany = pElements[0]?.innerText || '';
            headerData.workName = pElements[1]?.innerText || '';
            headerData.clientName = pElements[2]?.innerText || '';
            headerData.reportType = pElements[3]?.innerText || '';
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35; // Espaço reservado para o cabeçalho e título da seção

        const addPageHeaders = (data, sectionTitle) => {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(headerData.myCompany || reportTitle, pdfWidth / 2, margin, { align: 'center' });
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            
            let y = margin + 2;
            const lh = 4.5;
            if (headerData.workName) pdf.text(headerData.workName, margin, y);
            if (headerData.clientName) pdf.text(headerData.clientName, pdfWidth - margin, y, { align: 'right' });
            y += lh;
            if (headerData.reportType) pdf.text(headerData.reportType, margin, y);
            
            if (sectionTitle) {
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(sectionTitle, margin, y + 8);
            }
        };

        const receivedTableContainer = printableElement.querySelector('#daily-parts-received-table-container');
        if (receivedTableContainer) {
            const table = receivedTableContainer.querySelector('table');
            const tableTitle = receivedTableContainer.querySelector('h3')?.innerText || 'Partes Diárias Recebidas';

            const head = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText);
            const body = Array.from(table.querySelectorAll('tbody tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText)
            );
            const foot = Array.from(table.querySelectorAll('tfoot tr')).map(row => 
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
                headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
                footStyles: { fillColor: [210, 210, 210], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawPage: (data) => addPageHeaders(data, tableTitle),
                didParseCell: function (data) {
                    // Nenhuma formatação específica para esta tabela, apenas a estrutura
                }
            });
        }

        const fileName = `${reportTitle.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
        setTimeout(() => {
            pdf.save(fileName);
            hideSpinner();
        }, 50);

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
