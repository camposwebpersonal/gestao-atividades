// relatorios_transporte_pdf.js
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
    
    // 🎯 PRIMEIRA TENTATIVA: Formato PAISAGEM
    let pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let orientation = 'landscape';

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
            // HTML tem: <h3>empresa</h3> / <p>Obra+Cliente</p> / <p>Período</p>
            headerData.workInfo = pElements[0]?.innerText || ''; // Obra e Cliente
            headerData.period   = pElements[1]?.innerText || ''; // Período
        }

        // 🎯 TESTE: Calcular quantas páginas seriam necessárias em PAISAGEM
        const tables = printableElement.querySelectorAll('table');
        const rowCount = Array.from(tables).reduce((total, table) => {
            return total + table.querySelectorAll('tbody tr').length;
        }, 0);
        
        console.log('📊 Total de linhas na tabela:', rowCount);
        
        // Estimativa: ~20 linhas por página em paisagem, ~30 linhas em retrato
        const estimatedPagesLandscape = Math.ceil(rowCount / 20);
        console.log('📄 Páginas estimadas em paisagem:', estimatedPagesLandscape);
        
        // 🎯 SE MAIS DE 1 PÁGINA EM PAISAGEM → MUDA PARA RETRATO
        if (estimatedPagesLandscape > 1) {
            console.log('🔄 Mudando para formato RETRATO para melhor aproveitamento');
            pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            orientation = 'portrait';
        }

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const headerHeight = 35; // Espaço reservado para o cabeçalho e título da seção

        // Função para adicionar o cabeçalho completo e o título da seção em cada página
        const addPageHeaders = (data, sectionTitle) => {
            // Nome da empresa no canto superior direito
            pdf.setFontSize(11);
            pdf.setFont(undefined, 'bold');
            pdf.text('PBA TRANSPORTES', pdfWidth - margin, margin, { align: 'right' });
            
            // Título centralizado
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(reportTitle, pdfWidth / 2, margin, { align: 'center' });
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            
            let y = margin + 6;
            const lh = 4.5;
            if (headerData.workInfo) {
                // workInfo pode ter múltiplas linhas (Obra + Cliente separados por \n via <br>)
                const lines = headerData.workInfo.split('\n').filter(l => l.trim());
                lines.forEach(line => {
                    pdf.text(line.trim(), margin, y);
                    y += lh;
                });
            }
            if (headerData.period) pdf.text(headerData.period, margin, y);
            // sectionTitle removido — título já aparece no topo central da página
        };

        // 🎯 Declarar currentY
        let currentY = headerHeight;

        // 🎯 CALCULAR RESUMO E CRIAR GRÁFICO
        const resumo = {
            totalViagens: 0,
            volumeTotal: 0,
            valorTotal: 0,
            porEquipamento: {}
        };

        tables.forEach(table => {
            Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                const cells = row.querySelectorAll('td');
                const firstCell = cells[0]?.innerText || '';
                
                // Pular subtotais e totais
                if (firstCell.includes('Subtotal') || firstCell.includes('TOTAIS')) return;
                
                // Extrair dados da linha
                // Colunas: Data(0) | Equipamento(1) | Material(2) | Volume(3) | Preço Viagem(4) | Qtd. Viagens(5) | Volume Total(6) | Valor Total(7)
                const equipamento = cells[1]?.innerText || '';
                const volume = parseFloat((cells[3]?.innerText || '0').replace(',', '.')) || 0;
                const qtdViagens = parseInt(cells[5]?.innerText || '0') || 0;
                const volumeTotal = parseFloat((cells[6]?.innerText || '0').replace(',', '.')) || 0;
                const valorTotalText = cells[7]?.innerText || '0';
                const valorTotal = parseFloat(valorTotalText.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
                
                console.log('🔍 Linha:', {
                    equipamento,
                    valorTotalText,
                    valorTotal,
                    qtdViagens,
                    volumeTotal
                });
                
                resumo.totalViagens += qtdViagens;
                resumo.volumeTotal += volumeTotal; // Usar volumeTotal da coluna
                resumo.valorTotal += valorTotal;
                
                // Agregar por equipamento (filtrar equipamentos vazios)
                if (equipamento && equipamento.trim() !== '') {
                    if (!resumo.porEquipamento[equipamento]) {
                        resumo.porEquipamento[equipamento] = { viagens: 0, volume: 0, valor: 0 };
                    }
                    resumo.porEquipamento[equipamento].viagens += qtdViagens;
                    resumo.porEquipamento[equipamento].volume += volumeTotal;
                    resumo.porEquipamento[equipamento].valor += valorTotal;
                }
            });
        });
        
        console.log('📊 Resumo final:', resumo);

        // 🎯 ADICIONAR RESUMO NO TOPO
        const addResumoComGrafico = () => {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            let y = headerHeight + 5;
            
            // Resumo de totais
            pdf.text(`Quantidade de Viagens: ${resumo.totalViagens}`, margin, y);
            y += 5;
            pdf.text(`Volume Total Aproximado: ${resumo.volumeTotal.toFixed(2)} m³`, margin, y);
            y += 5;
            const valorTotalFormatado = new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            }).format(resumo.valorTotal);
            pdf.text(`Valor Total: ${valorTotalFormatado}`, margin, y);
            console.log('💰 Valor total formatado:', valorTotalFormatado, 'Original:', resumo.valorTotal);
            y += 10;
            
            // Gráfico de barras horizontal
            const equipamentos = Object.keys(resumo.porEquipamento).filter(eq => 
                eq && eq.trim() !== '' && resumo.porEquipamento[eq].valor > 0
            );
            
            if (equipamentos.length === 0) {
                pdf.text('Nenhum equipamento com dados.', margin, y);
                y += 10;
            } else {
                const maxValor = Math.max(...equipamentos.map(eq => resumo.porEquipamento[eq].valor));
                const barWidth = pdfWidth - 2 * margin - 60; // Largura disponível para as barras
                const barHeight = 6;
                const barSpacing = 10;
                
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'bold');
                pdf.text('Desempenho por Equipamento:', margin, y);
                y += 7;
                
                pdf.setFontSize(7);
                pdf.setFont(undefined, 'normal');
                
                equipamentos.forEach(eq => {
                    const data = resumo.porEquipamento[eq];
                    const barLength = (data.valor / maxValor) * barWidth;
                    
                    // Nome do equipamento
                    pdf.setFontSize(7);
                    pdf.setFont(undefined, 'normal');
                    pdf.text(eq, margin, y + 4);
                    
                    // Barra
                    pdf.setFillColor(74, 144, 226); // Azul
                    pdf.rect(margin + 50, y, barLength, barHeight, 'F');
                    
                    // Valores - NEGRITO e LETRA MAIOR
                    pdf.setFontSize(8);
                    pdf.setFont(undefined, 'bold');
                    const valorFormatado = new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                    }).format(data.valor);
                    const texto = `${data.viagens} VIAGENS | ${data.volume.toFixed(0)}m³ | ${valorFormatado}`;
                    pdf.text(texto, margin + 52, y + 4);
                    
                    y += barSpacing;
                });
            }
            
            // Valor total novamente
            y += 5;
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            const valorTotalFinalFormatado = new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            }).format(resumo.valorTotal);
            pdf.text(`VALOR TOTAL: ${valorTotalFinalFormatado}`, margin, y);
            
            return y + 10; // Retorna a posição Y para começar a tabela
        };

        // Adicionar resumo e obter nova posição Y
        currentY = addResumoComGrafico();
        
        // Adicionar título da seção de tabela
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Relatório de Transporte', margin, currentY);
        currentY += 8;

        // Seção de tabelas com autoTable para estilos e totais (reutiliza a variável tables já declarada)

        tables.forEach(table => {
            const head = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText);
            const body = [];
            const subtotalRows = [];
            
            // Processar as linhas do body separando dados normais, subtotais e totais
            Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                const firstCellText = row.cells[0]?.innerText || '';
                
                // Linha de TOTAIS - será tratada como foot
                if (firstCellText.includes('TOTAIS') && !firstCellText.includes('Subtotal')) {
                    return; // Pular, será tratada separadamente
                }
                
                // Linha de Subtotal - mesclar Data+Equipamento (2 colunas)
                if (firstCellText.includes('Subtotal')) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    
                    console.log('🔍 Subtotal cells:', cells.map((c, i) => `[${i}]: ${c.innerText}`));
                    
                    const subtotalRow = [];
                    subtotalRow.push({ content: firstCellText, colSpan: 2, styles: { halign: 'left' } }); // Mescla Data + Equipamento
                    
                    // 🎯 CORREÇÃO: Pular primeira célula (índice 0) que contém o texto do subtotal, adicionar as demais
                    // Colunas: Subtotal(0-mesclado) | Material(1) | Volume(2) | Preço(3) | Qtd(vazio) | Volume Total(vazio) | Valor Total(vazio)
                    // Na tabela HTML, subtotal tem: Subtotal, Volume, Valor
                    for (let i = 1; i < cells.length; i++) {
                        subtotalRow.push(cells[i].innerText);
                    }
                    
                    body.push(subtotalRow);
                    subtotalRows.push(body.length - 1); // Guardar índice da linha de subtotal
                    return;
                }
                
                // Linha normal de dados
                body.push(Array.from(row.querySelectorAll('td')).map(td => td.innerText));
            });
            
            // Extrair a linha de totais manualmente para o foot
            const totalsRow = Array.from(table.querySelectorAll('tbody tr')).find(row => {
                const text = row.cells[0]?.innerText || '';
                return text.includes('TOTAIS') && !text.includes('Subtotal');
            });
            
            let foot = [];
            if (totalsRow) {
                const totalsCells = Array.from(totalsRow.querySelectorAll('td'));
                const firstCell = totalsCells[0];
                const colspanValue = parseInt(firstCell.getAttribute('colspan') || '1');
                
                const footRow = [];
                footRow.push('TOTAIS');
                for (let i = 1; i < colspanValue; i++) {
                    footRow.push('');
                }
                
                for (let i = 1; i < totalsCells.length; i++) {
                    footRow.push(totalsCells[i].innerText);
                }
                
                foot = [footRow];
            }

            // Adiciona uma nova página se a tabela não couber na página atual
            if (currentY + 20 > pdf.internal.pageSize.getHeight()) { // 20mm é uma estimativa de altura mínima da tabela
                pdf.addPage();
                currentY = headerHeight; // Reinicia o Y após o cabeçalho da nova página
            }

            pdf.autoTable({
                head: [head],
                body: body,
                foot: foot.length > 0 ? foot : [],
                showFoot: 'lastPage',
                startY: currentY,
                margin: { left: margin, right: margin, top: headerHeight, bottom: 10 }, // 🔥 Adicionar margem superior para todas as páginas
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1, textColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 5 },
                headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontSize: 7, minCellHeight: 6, lineWidth: 0.1, cellPadding: 1 },
                footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, minCellHeight: 6, cellPadding: 1 },
                didParseCell: function (data) {
                    const header = data.column.header;
                    
                    // Aplicar estilo especial para linhas de subtotal
                    if (data.section === 'body' && subtotalRows.includes(data.row.index)) {
                        data.cell.styles.fillColor = [85, 85, 85]; // #555 em RGB
                        data.cell.styles.textColor = [255, 255, 255]; // Branco
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.minCellHeight = 6; // Altura reduzida para subtotais
                    }
                    
                    // Adiciona verificação para garantir que 'header' não é undefined
                    if (header && (data.section === 'body' || data.section === 'foot')) {
                        const value = parseFloat(data.cell.text.toString().replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.'));

                        // Transporte não tem acréscimos/descontos diretos nas colunas, mas pode ter valor total
                        if (header.includes('Valor Total (R$)') || header.includes('Preço Viagem (R$)')) {
                            if (!isNaN(value) && value > 0) {
                                data.cell.styles.fontStyle = 'bold'; // Apenas negrito para valores monetários
                            }
                        } else if (header.includes('Observações') && data.cell.text.trim() !== '---' && data.cell.text.trim() !== '') {
                            data.cell.styles.fillColor = [227, 242, 253]; // Azul claro
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawPage: (data) => addPageHeaders(data, null), // título já está no topo central
            });
            currentY = pdf.lastAutoTable.finalY + margin;
        });

        // Adiciona o total geral de transporte como texto separado, se existir
        const grandTotalElement = printableElement.querySelector('.report-total');
        if (grandTotalElement) {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            // Ajusta a posição Y para que não sobreponha a tabela
            const totalY = Math.max(currentY, pdf.lastAutoTable.finalY + 5); 
            pdf.text(grandTotalElement.innerText, pdfWidth - margin, totalY, { align: 'right' });
        }

        // pdf.save(`${reportTitle.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
        hideSpinner();
        return pdf;

    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Não foi possível gerar o PDF. Detalhes: " + e.message);
        return null;
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

// 🔍 VERIFICAR AUTENTICAÇÃO DO GOOGLE DRIVE
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
    try {
        // Abrir janela de autorização
        const authWindow = window.open(
            '/proj/api/google_drive_upload.php?action=authorize',
            'GoogleDriveAuth',
            'width=600,height=700'
        );

        // Aguardar fechamento da janela ou autorização
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                if (authWindow.closed) {
                    clearInterval(checkInterval);
                    // Verificar se foi autorizado
                    const isAuth = await checkGoogleDriveAuth();
                    if (isAuth) {
                        resolve(true);
                    } else {
                        reject(new Error('Autorização não concluída'));
                    }
                }
            }, 500);

            // Timeout de 5 minutos
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!authWindow.closed) {
                    authWindow.close();
                }
                reject(new Error('Timeout de autorização'));
            }, 300000);
        });
    } catch (error) {
        console.error('❌ Erro ao renovar autenticação:', error);
        throw error;
    }
}
