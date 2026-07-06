// home_report_pdf.js - Exportação de PDF para Relatórios de Equipamentos
import { showSpinner, hideSpinner, formatDateBR, getEquipTypeName } from './utils.js';
import { appState } from './appState.js';

/**
 * Exporta o relatório de equipamentos para PDF
 * @param {string} containerId - ID do container do relatório
 * @param {string} reportTitle - Título do relatório para o PDF
 */
export async function exportEquipmentReportToPDF(containerId, reportTitle) {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ 
        orientation: 'landscape', 
        unit: 'mm', 
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
    });
    
    // Define a fonte padrão com suporte a UTF-8
    pdf.setFont('helvetica');
    pdf.setLanguage('pt-BR');

    if (typeof pdf.autoTable !== 'function') {
        hideSpinner();
        console.error("jspdf-autotable não está carregado. Verifique se o script está incluído no seu HTML.");
        alert("Erro: A biblioteca para gerar tabelas no PDF não foi encontrada.");
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        hideSpinner();
        alert("Erro: Container do relatório não encontrado.");
        return;
    }

    let printableElement = null;

    try {
        printableElement = container.cloneNode(true);
        printableElement.id = 'printable-clone-home-report';
        printableElement.style.position = 'fixed';
        printableElement.style.top = '0';
        printableElement.style.left = '0';
        printableElement.style.width = '100%';
        printableElement.style.height = '100%';
        printableElement.style.overflow = 'auto';
        printableElement.style.opacity = '0';
        printableElement.style.pointerEvents = 'none';
        printableElement.style.zIndex = '9999';

        document.body.appendChild(printableElement);
        await new Promise(resolve => setTimeout(resolve, 100));

        const headerData = {
            reportTitle: reportTitle,
            currentDate: new Date().toLocaleDateString('pt-BR')
        };

        const addPageHeaders = (doc, title, currentPage, totalPages) => {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, pdf.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Data de Geracao: ${headerData.currentDate}`, 15, 25);
            doc.text(`Pagina ${currentPage} de ${totalPages}`, pdf.internal.pageSize.getWidth() - 15, 25, { align: 'right' });
            doc.line(15, 28, pdf.internal.pageSize.getWidth() - 15, 28);
        };

        const table = printableElement.querySelector('table');
        if (!table) {
            alert('Tabela de relatório não encontrada no elemento clonado.');
            return;
        }

        const columnVisibility = getColumnVisibility(container.querySelector('.home-report-column-toggle')?.dataset.containerId || 'report-by-work-options');

        const fixedPdfHeaders = ["Tipo", "Prefixo", "Ultima Obra", "Empresa Cliente", "Tipo Medicao", "Valor", "Data Inicio Obra", "Ultima data"];
        const toggledPdfHeaders = {
            'show-model': "Modelo",
            'show-characteristic': "Caracteristica",
            'show-capacidade': "Capacidade",
            'show-year': "Ano",
            'show-horimeter-start': "Horimetro Inicio Obra",
            'show-horimeter-end': "Horimetro Fim Obra",
            'show-review-status': "Status Revisao"
        };
        
        let currentPdfHeaders = [...fixedPdfHeaders];
        for (const colId in toggledPdfHeaders) {
            if (columnVisibility[colId]) {
                currentPdfHeaders.push(toggledPdfHeaders[colId]);
            }
        }
        
        const head = [currentPdfHeaders];
        const bodyRows = [];

        Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
            if (tr.classList.contains('main-group-header')) {
                bodyRows.push([{ content: tr.children[0].innerText, colSpan: currentPdfHeaders.length, styles: { fillColor: [230, 247, 255], textColor: [0, 86, 179], fontStyle: 'bold', halign: 'left' } }]);
            } else {
                const rowData = [];
                const tds = Array.from(tr.querySelectorAll('td'));
                const getTdTextByLabel = (label) => {
                    const td = tds.find(t => t.dataset.label === label);
                    return td ? td.innerText : '';
                };

                const item = {
                    equipment: {
                        type: getTdTextByLabel("Tipo"),
                        // NOVO: Limpa o prefixo removendo tags HTML mas mantendo o prefixo da obra
                        prefix: getTdTextByLabel("Prefixo").replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
                        model: getTdTextByLabel("Modelo"),
                        characteristic: getTdTextByLabel("Característica"),
                        capacidade: getTdTextByLabel("Capacidade"),
                        year: getTdTextByLabel("Ano"),
                    },
                    lastWork: { name: getTdTextByLabel("Última Obra") },
                    clientCompany: { name: getTdTextByLabel("Empresa Cliente") },
                    firstDateInWork: getTdTextByLabel("Data Início Obra"),
                    lastDateInWork: getTdTextByLabel("Última data"),
                    firstHorometerInWork: getTdTextByLabel("Horímetro Início Obra"),
                    lastHorometerInWork: getTdTextByLabel("Horímetro Fim Obra"),
                    reviewStatus: getTdTextByLabel("Status Revisão"),
                };
                
                rowData.push(getEquipTypeName(item.equipment.type) || '');
                // NOVO: Mantém o prefixo completo com o prefixo da obra
                rowData.push(item.equipment.prefix || '');
                rowData.push(item.lastWork.name || '');
                rowData.push(item.clientCompany.name || '');
                rowData.push(item.firstDateInWork || '');
                rowData.push(item.lastDateInWork || '');
                if (columnVisibility['show-model']) rowData.push(item.equipment.model || '');
                if (columnVisibility['show-characteristic']) rowData.push(item.equipment.characteristic || '');
                if (columnVisibility['show-capacidade']) rowData.push(item.equipment.capacidade || '');
                if (columnVisibility['show-year']) rowData.push(item.equipment.year || '');
                if (columnVisibility['show-horimeter-start']) rowData.push(item.firstHorometerInWork || '');
                if (columnVisibility['show-horimeter-end']) rowData.push(item.lastHorometerInWork || '');
                if (columnVisibility['show-review-status']) {
                    const cleanReviewStatus = item.reviewStatus.split('⚠️')[0].trim();
                    rowData.push(cleanReviewStatus || '');
                }
                bodyRows.push(rowData);
            }
        });

        const foot = Array.from(table.querySelectorAll('tfoot tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => tr.innerText)
        );
        if (foot.length > 0) {
            foot[0] = [{ content: foot[0][0], colSpan: currentPdfHeaders.length, styles: { halign: 'left' } }];
        }

        // Largura total disponível em A4 landscape: ~277mm (297mm - margens de 15mm de cada lado)
        // Cálculo dinâmico das larguras baseado nas colunas visíveis
        const dynamicColumnStyles = {};
        let currentColumnIndex = 0;
        
        // Colunas fixas - ajustadas para aproveitar melhor o espaço
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 50 };  // Tipo
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 30 };  // Prefixo
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 50 };  // Última Obra
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 45 };  // Empresa Cliente
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 25 };  // Data Início Obra
        dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 25 };  // Data Fim Obra
        
        // Colunas opcionais
        if (columnVisibility['show-model']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 30 };
        if (columnVisibility['show-characteristic']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 30 };
        if (columnVisibility['show-capacidade']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 22 };
        if (columnVisibility['show-year']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 15 };
        if (columnVisibility['show-horimeter-start']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 28 };
        if (columnVisibility['show-horimeter-end']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 28 };
        if (columnVisibility['show-review-status']) dynamicColumnStyles[currentColumnIndex++] = { cellWidth: 35 };

        pdf.autoTable({
            head: head,
            body: bodyRows,
            foot: foot,
            startY: 30,
            margin: { top: 30, bottom: 15, left: 15, right: 15 },
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 1,
                overflow: 'linebreak',
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontStyle: 'bold'
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold'
            },
            columnStyles: dynamicColumnStyles,
            didDrawPage: (data) => {
                addPageHeaders(pdf, headerData.reportTitle, data.pageNumber, pdf.internal.getNumberOfPages());
            },
            didParseCell: function (data) {
                const cellText = data.cell.text.join(' ').toLowerCase();
                if (cellText.includes('conflito com:') || cellText.includes('revisão vencida')) {
                    data.cell.styles.fillColor = [255, 243, 205];
                    data.cell.styles.textColor = [133, 100, 4];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // pdf.save(`Relatorio_Equipamentos_Home_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
        
        // Retorna o PDF para permitir download ou upload
        return pdf;

    } catch (e) {
        console.error("Erro ao gerar PDF do relatório da Home:", e);
        alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
        return null;
    } finally {
        if (printableElement && printableElement.parentNode) {
            setTimeout(() => {
                printableElement.parentNode.removeChild(printableElement);
            }, 100);
        }
        hideSpinner();
    }
}

/**
 * Obtém o estado das checkboxes de colunas para o PDF
 */
const getColumnVisibility = (containerId) => {
    const togglableColumns = [
        { id: 'show-model', label: 'Modelo', default: false },
        { id: 'show-characteristic', label: 'Característica', default: false },
        { id: 'show-capacidade', label: 'Capacidade', default: false },
        { id: 'show-year', label: 'Ano', default: false },
        { id: 'show-horimeter-start', label: 'Horímetro Início Obra', default: false },
        { id: 'show-horimeter-end', label: 'Horímetro Fim Obra', default: true },
        { id: 'show-review-status', label: 'Status Revisão', default: false }
    ];

    const columnVisibility = {};
    const container = document.getElementById(containerId);
    if (!container) {
        // Fallback para o caso de o container não existir
        togglableColumns.forEach(col => columnVisibility[col.id] = col.default);
        columnVisibility['show-terceirizados'] = false;
        return columnVisibility;
    }
    
    // Obtém o estado atual das checkboxes
    const allOptions = [...togglableColumns, { id: 'show-terceirizados', label: 'Terceirizados', default: false }];
    allOptions.forEach(col => {
        const checkbox = document.getElementById(`${col.id}-${containerId}`);
        columnVisibility[col.id] = checkbox ? checkbox.checked : col.default;
    });

    return columnVisibility;
};