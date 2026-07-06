// relatorios_despesas_pdf.js
import { showSpinner, hideSpinner } from './utils.js'; // Importa showSpinner e hideSpinner

/**
 * Exporta o conteúdo de um elemento HTML para PDF.
 * @param {string} containerId - O ID do container HTML a ser exportado.
 * @param {string} reportTitle - O título do relatório para o nome do arquivo PDF.
 * @returns {Promise<void>}
 */
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

    let printableElement = null; // Declarar aqui para garantir o escopo no finally

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

        // Aplicar estilos para garantir que as bordas e padding apareçam no clone para html2canvas
        printableElement.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
        });
        printableElement.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
        });

        document.body.appendChild(printableElement);
        await new Promise(resolve => setTimeout(resolve, 100)); // Pequeno atraso para renderização

        // --- Extração de dados do cabeçalho ---
        const headerData = {};
        const headerElement = printableElement.querySelector('.pdf-header');
        if (headerElement) {
            const pElements = headerElement.getElementsByTagName('p');
            headerData.myCompany = pElements[0]?.innerText || '';
            headerData.workInfo = pElements[1]?.innerText || ''; // Obra e Cliente
            headerData.period = pElements[2]?.innerText || '';
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35; // Espaço reservado para o cabeçalho e título da seção

        // Função para adicionar o cabeçalho completo e o título da seção em cada página
        const addPageHeaders = (data, sectionTitle) => {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(headerData.myCompany || reportTitle, pdfWidth / 2, margin, { align: 'center' });
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            
            let y = margin + 2;
            const lh = 4.5;
            if (headerData.workInfo) pdf.text(headerData.workInfo, margin, y);
            y += lh;
            if (headerData.period) pdf.text(headerData.period, margin, y);
            
            if (sectionTitle) {
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(sectionTitle, margin, y + 8);
            }
        };

        // Seção de tabelas com autoTable para estilos e totais
        const tables = printableElement.querySelectorAll('table');
        let currentY = headerHeight; // Começa após o cabeçalho fixo

        tables.forEach(table => {
            const head = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText);
            const body = Array.from(table.querySelectorAll('tbody tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText)
            );
            const foot = Array.from(table.querySelectorAll('tfoot tr')).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.innerText)
            );

            // Adiciona uma nova página se a tabela não couber na página atual
            if (currentY + 20 > pdf.internal.pageSize.getHeight()) { // 20mm é uma estimativa de altura mínima da tabela
                pdf.addPage();
                currentY = headerHeight; // Reinicia o Y após o cabeçalho da nova página
            }

            pdf.autoTable({
                head: [head],
                body: body,
                foot: foot.length > 0 ? foot : [],
                startY: currentY,
                margin: { left: margin, right: margin },
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
                headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0] },
                didParseCell: function (data) {
                    const header = data.column.header;
                    if (header && (data.section === 'body' || data.section === 'foot')) {
                        const value = parseFloat(data.cell.text.toString().replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.'));

                        if (header.includes('Acréscimos (R$)')) {
                            if (!isNaN(value) && value > 0) {
                                data.cell.styles.fillColor = [232, 245, 233]; // Verde claro
                                data.cell.styles.fontStyle = 'bold';
                            }
                        } else if (header.includes('Descontos (R$)')) {
                            if (!isNaN(value) && value > 0) {
                                data.cell.styles.fillColor = [255, 235, 238]; // Vermelho claro
                                data.cell.styles.fontStyle = 'bold';
                            }
                        } else if (header.includes('Observações') && data.cell.text.trim() !== '---' && data.cell.text.trim() !== '') {
                            data.cell.styles.fillColor = [227, 242, 253]; // Azul claro
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawPage: (data) => addPageHeaders(data, reportTitle), // Passa o título do relatório para o cabeçalho
            });
            currentY = pdf.lastAutoTable.finalY + margin;
        });

        // Adiciona o total geral da despesa como texto separado, se existir
        const grandTotalElement = printableElement.querySelector('.report-total');
        if (grandTotalElement) {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            // Ajusta a posição Y para que não sobreponha a tabela
            const totalY = Math.max(currentY, pdf.lastAutoTable.finalY + 5); 
            pdf.text(grandTotalElement.innerText, pdfWidth - margin, totalY, { align: 'right' });
        }


        pdf.save(`${reportTitle.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
        hideSpinner(); // Chamar hideSpinner imediatamente após pdf.save()

    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
    } finally {
        // Garantir que o elemento imprimível seja sempre removido
        if (printableElement && printableElement.parentNode) {
            // Adicionar um pequeno atraso antes de remover o elemento para garantir a renderização
            setTimeout(() => {
                printableElement.parentNode.removeChild(printableElement);
            }, 100); // Atraso um pouco maior para remoção
        }
    }
}
