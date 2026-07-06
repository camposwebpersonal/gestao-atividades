// relatorios_fornecimento_areia_pdf.js
import { showSpinner, hideSpinner, formatCurrency, extractReportInfo, generatePDFFileName, addPdfCoverPage, getEquipTypeName } from './utils.js';

/**
 * Exporta o relatório de fornecimento de areia para PDF.
 * @param {Array<Object>} deliveries - Lista de entregas de areia a serem incluídas no relatório.
 * @param {Object} config - Configuração de fornecimento de areia (my_company, client_company, price_m3, etc.).
 * @param {string} filterStatus - Status da nota para o título ('EMITIDA' ou 'NAO_EMITIDA').
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @returns {Promise<void>}
 */
export async function exportSandDeliveriesReportToPDF(deliveries, config, filterStatus, withCover) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); // A4 Paisagem

    try {
        if (!deliveries || deliveries.length === 0) {
            alert(`Não há entregas com status "${filterStatus === 'EMITIDA' ? 'Emitida' : 'Não Emitida'}" para gerar o PDF.`);
            hideSpinner();
            return;
        }

        const myCompany = config.my_company;
        const clientCompany = config.client_company;

        let totalVolume = 0;
        let totalValue = 0;
        let minDate = new Date();
        let maxDate = new Date(0);

        deliveries.forEach(d => {
            totalVolume += parseFloat(d.volume_m3 || 0);
            totalValue += parseFloat(d.total_value || 0);
            const dDate = new Date(d.delivery_date + 'T00:00:00');
            if (dDate < minDate) minDate = dDate;
            if (dDate > maxDate) maxDate = dDate;
        });

        const headerInfo = {
            myCompany: myCompany?.name || 'PBA TRANSPORTES',
            clientName: clientCompany?.name || 'N/A',
            reportSpecificTitle: `RELATÓRIO DE FORNECIMENTO DE AREIA - ${clientCompany?.name || 'Cliente'}`,
            period: `${minDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()} ATÉ ${maxDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()}`,
            totalDeliveries: deliveries.length,
            totalVolume: totalVolume,
            totalValue: totalValue,
            priceM3: config.price_m3
        };

        // Adiciona capa se solicitado
        if (withCover) {
            addPdfCoverPage(pdf, headerInfo, 'FORNECIMENTO DE AREIA', myCompany?.name || 'PBA TRANSPORTES');
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35; // Espaço reservado para o cabeçalho e título da seção

        // Função para adicionar cabeçalho e rodapé em cada página
        const addPageHeadersFooters = (doc, pageNumber) => {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(myCompany?.name || 'PBA TRANSPORTES', pdfWidth / 2, 10, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${pageNumber}`, pdfWidth - margin, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text('Rua Luiz Cajueiro de Albuquerque, n°1130, Loteamento dos Lins, Sertânia-PE-56600-000', margin, pdf.internal.pageSize.getHeight() - 10, { align: 'left' });
            
            // Informações adicionais no cabeçalho (repetidas em cada página)
            let y = 18;
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(`RELATÓRIO DE FORNECIMENTO DE AREIA - ${clientCompany?.name || 'Cliente'}`, margin, y);
            y += 4;
            doc.setFont(undefined, 'normal');
            doc.text(`${headerInfo.period}`, margin, y);
            y += 4;
            doc.text(`Qtd. Viagens: ${headerInfo.totalDeliveries} | Volume Total: ${headerInfo.totalVolume.toFixed(2)} m³ | Valor M³: ${formatCurrency(headerInfo.priceM3)} | Valor Total: ${formatCurrency(headerInfo.totalValue)}`, margin, y);
            doc.line(margin, y + 2, pdfWidth - margin, y + 2); // Linha separadora
        };

        let y = 15; // Posição inicial para o conteúdo
        if (!withCover) {
            addPageHeadersFooters(pdf, 1);
            y = 30; // Ajusta o Y inicial se não tiver capa
        } else {
            y = 40; // Começa um pouco mais abaixo após a capa
        }

        const tableHeaders = [['ROMANEIO', 'DATA', 'EQUIPAMENTO', 'VOLUME (m³)', 'VALOR (R$)', 'STATUS NOTA']];
        const tableBody = [];

        deliveries.forEach(d => {
            const equipmentOwner = d.equipment?.is_terceirizado ? 'TERCEIRIZADO' : 'PRÓPRIO';
            const equipmentDisplay = `${d.equipment?.prefix || 'N/A'} - ${getEquipTypeName(d.equipment?.type) || 'N/A'} (${equipmentOwner})`;
            const deliveryDateFormatted = new Date(d.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR');
            const statusText = filterStatus === 'EMITIDA' ? 'Emitida' : 'A Emitir'; // Usa o status do filtro para o texto

            tableBody.push([
                d.delivery_code,
                deliveryDateFormatted,
                equipmentDisplay,
                (d.volume_m3 || 0).toFixed(2),
                formatCurrency(d.total_value || 0),
                statusText
            ]);
        });

        pdf.autoTable({
            startY: y,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
            didDrawPage: (data) => {
                // Adiciona cabeçalho e rodapé em páginas subsequentes, começando da página 2 se tiver capa, ou página 1 se não tiver
                if (data.pageNumber > (withCover ? 1 : 0)) { 
                    addPageHeadersFooters(pdf, data.pageNumber);
                }
            },
            didParseCell: (data) => {
                const header = data.column.header;
                const value = data.cell.text;
                if (header.includes('STATUS NOTA')) {
                    if (value === 'Emitida') {
                        data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                    } else if (value === 'A Emitir') {
                        data.cell.styles.fillColor = [255, 235, 238]; // Vermelho claro
                    }
                }
            }
        });

        const fileName = generatePDFFileName(
            clientCompany?.name || 'Cliente',
            null, // Sem BM number para este relatório
            minDate.toISOString().split('T')[0],
            maxDate.toISOString().split('T')[0],
            `Areia_${filterStatus === 'EMITIDA' ? 'Emitida' : 'A_Emitir'}`
        ) + '.pdf';
        
        pdf.save(fileName);

    } catch (error) {
        console.error('Erro ao gerar PDF de entregas de areia:', error);
        alert('Não foi possível gerar o PDF de entregas de areia. Detalhes: ' + error.message);
    } finally {
        hideSpinner();
    }
}
