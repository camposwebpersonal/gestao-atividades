// relatorios_avarias_pdf.js
import { showSpinner, hideSpinner, formatCurrency, extractReportInfo, generatePDFFileName, addPdfCoverPage } from './utils.js';

/**
 * Exporta o relatório de avarias para PDF.
 * @param {string} containerId - O ID do container HTML que contém o relatório.
 * @param {string} reportTitle - O título do relatório para o nome do arquivo PDF.
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @returns {Promise<void>}
 */
export async function exportDamagesReportToPDF(containerId, reportTitle, withCover) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
        printableElement.id = 'printable-clone-damages-report-pdf'; // ID único para o clone
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

        // EXTRAI O NOME DO CLIENTE DIRETAMENTE DO OBJETO WORK NO appState
        // Assumindo que appState.works e appState.client_companies estão carregados
        const workId = reportInfo.workId; // Você precisará garantir que 'workId' seja extraído em 'extractReportInfo'
        let clientNameOnCover = 'N/A';
        if (workId) {
            const work = appState.works?.find(w => w.id == workId);
            if (work && work.client_companies) {
                clientNameOnCover = work.client_companies.name;
            } else if (work && work.client_company_id && appState.client_companies) {
                const client = appState.client_companies.find(c => c.id == work.client_company_id);
                if (client) {
                    clientNameOnCover = client.name;
                }
            }
        }

        // Adiciona capa se solicitado, passando o nome do cliente correto
        if (withCover) {
            // A função addPdfCoverPage precisa aceitar o nome do cliente como um parâmetro ou obtê-lo do reportInfo.
            // Se addPdfCoverPage não foi modificada, passaremos aqui o clientNameOnCover para reportInfo.clientName
            // para garantir que a capa use o nome correto.
            reportInfo.clientName = clientNameOnCover; 
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
            if (reportInfo.workName) doc.text(`Obra: ${reportInfo.workName}`, margin, y);
            if (reportInfo.clientName) doc.text(`Cliente: ${reportInfo.clientName}`, pdfWidth - margin, y, { align: 'right' });
            y += lh;
            doc.text(reportInfo.reportSpecificTitle, margin, y);
            doc.text(reportInfo.period, pdfWidth - margin, y, { align: 'right' });
            
            if (sectionTitle) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(sectionTitle, margin, y + 8);
            }
        };

        // Tabela de Resumo
        const summaryTable = printableElement.querySelector('#damages-report-summary-table');
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
                didDrawPage: (data) => addPageHeaders(pdf, data, 'Resumo de Avarias'),
                didParseCell: (data) => {
                    // Estilos para colunas de impacto
                    const header = data.column.header;
                    const value = data.cell.text;
                    if (header.includes('Impacto Cliente') || header.includes('Impacto Terceirizado')) {
                        if (value.includes('Acréscimo')) {
                            data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                        } else if (value.includes('Desconto')) {
                            data.cell.styles.fillColor = [255, 235, 238]; // Vermelho claro
                        }
                    }
                }
            });
        }

        // Nome do arquivo PDF
        // A função generatePDFFileName será usada, mas garantiremos que ela tenha as informações necessárias.
        // O formato completo do nome do arquivo PDF será tratado em `lancamentos_avarias.js` ao gerar o PDF da avaria individual.
        // Este `generatePDFFileName` é para o relatório consolidado de avarias.
        const fileName = generatePDFFileName(
            reportInfo.workName,
            reportInfo.bmNumber,
            reportInfo.startDate,
            reportInfo.endDate,
            'Avarias'
        ) + '.pdf';
        
        pdf.save(fileName);

    } catch (e) {
        console.error("Erro ao gerar PDF do relatório de avarias:", e);
        alert("Não foi possível gerar o PDF do relatório de avarias. Detalhes: " + e.message);
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
