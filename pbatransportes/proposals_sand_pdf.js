// proposals_sand_pdf.js
import { showSpinner, hideSpinner, formatCurrency } from './utils.js';

// Função auxiliar para carregar imagem como uma Promise
function loadImage(url) {
    return new Promise((resolve) => {
        if (!url) {
            console.warn('loadImage: URL da imagem não fornecida.');
            return resolve(null);
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;

        img.onload = () => resolve(img);
        
        img.onerror = (e) => {
            console.warn(`loadImage: Erro ao carregar imagem da URL: ${urlWithTimestamp}. Verifique se a URL está correta, se a imagem existe, e se há restrições de CORS no servidor de origem. Detalhes do evento:`, e);
            resolve(null);
        };
        img.src = urlWithTimestamp;
    });
}

export async function exportSandProposalPDF(proposalData, returnBlob = false) {
    if (!returnBlob) showSpinner();
    const { jsPDF } = window.jspdf;

    try {
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        const myCompany = proposalData.my_company;
        const clientCompany = proposalData.client_company;

        // Função para adicionar cabeçalho e rodapé em cada página
        const addPageHeadersFooters = (doc, pageNumber) => {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(myCompany?.name || 'MINHA EMPRESA', pdfWidth / 2, 10, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${pageNumber}`, pdfWidth - margin, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text('Rua Luiz Cajueiro de Albuquerque, n°1130, Loteamento dos Lins, Sertânia-PE-56600-000', margin, pdf.internal.pageSize.getHeight() - 10, { align: 'left' });
        };

        // Adicionar logo principal
        if (myCompany && myCompany.logo_url) {
            const logoUrl = myCompany.logo_url;
            const img = await loadImage(logoUrl);

            if (img) {
                const imgWidth = 50;
                const imgHeight = (img.height * imgWidth) / img.width;
                const x = (pdfWidth - imgWidth) / 2;
                
                pdf.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
                y += imgHeight + 5;
            } else {
                console.warn(`Logo principal não foi adicionada. URL: ${logoUrl}`);
                y += 10;
            }
        } else {
            console.warn('URL da logomarca da empresa fornecedora não encontrada ou é inválida. Logo principal não será exibida.');
            y += 10;
        }

        const watermarkYOffset = 70;
        await addWatermark(pdf, myCompany, pdfWidth, pdfHeight, watermarkYOffset);

        const rawProposalDate = proposalData.manual_date || proposalData.proposal_date;
        const displayDate = new Date(rawProposalDate + 'T00:00:00');

        generateContent(pdf, y, proposalData, pdfWidth, pdfHeight, margin, myCompany, clientCompany, addPageHeadersFooters, watermarkYOffset, displayDate);
        
        // Determina o nome do material para o arquivo PDF
        let materialFileName = 'Areia';
        const materialDesc = proposalData.material_description;
        
        if (materialDesc && materialDesc !== 'AREIA, CARGA/TRANSPORTE') {
            // Extrai apenas o nome do material (remove vírgula e tudo após ela)
            materialFileName = materialDesc.split(',')[0].trim();
        }
        
        // Salvar o PDF ou retornar blob
        if (returnBlob) {
            const blob = pdf.output('blob');
            return blob;
        } else {
            pdf.save(`PROPOSTA_${materialFileName}_${clientCompany?.name || 'Cliente'}_${displayDate.toLocaleDateString('pt-BR')}.pdf`);
        }

    } catch (error) {
        console.error('Erro geral ao gerar PDF da proposta de areia:', error);
        if (!returnBlob) {
            showModal('Erro ao Gerar PDF', 'Não foi possível gerar o PDF da proposta de areia. Por favor, verifique os dados e tente novamente. Detalhes técnicos: ' + error.message);
        }
        throw error;
    } finally {
        if (!returnBlob) hideSpinner();
    }
}

function addWatermark(pdf, myCompany, pdfWidth, pdfHeight, yOffset = 0) {
    return new Promise(async (resolve) => {
        if (myCompany && myCompany.logo_url) {
            const logoUrl = myCompany.logo_url;
            const imgWatermark = await loadImage(logoUrl);

            if (imgWatermark) {
                const watermarkWidth = pdfWidth * 0.8;
                const watermarkHeight = (imgWatermark.height * watermarkWidth) / imgWatermark.width;
                
                const xWatermark = (pdfWidth - watermarkWidth) / 2;
                const yWatermark = ((pdfHeight - watermarkHeight) / 2) + yOffset;

                pdf.saveGraphicsState();
                pdf.setGState(new pdf.GState({ opacity: 0.1 }));

                pdf.addImage(imgWatermark, 'JPEG', xWatermark, yWatermark, watermarkWidth, watermarkHeight);

                pdf.restoreGraphicsState();
            } else {
                console.warn(`Marca d'água não foi adicionada. URL: ${logoUrl}`);
            }
        } else {
            console.warn('URL da logomarca da empresa fornecedora não encontrada ou é inválida. Marca d\'água não será exibida.');
        }
        resolve();
    });
}

function generateContent(pdf, y, proposalData, pdfWidth, pdfHeight, margin, myCompany, clientCompany, addPageHeadersFooters, watermarkYOffset, displayDate) {
    addPageHeadersFooters(pdf, 1);

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    y += 15;
    
    // Determina o título baseado no material_description
    let pdfTitle = 'PROPOSTA DE FORNECIMENTO DE AREIA';
    const materialDesc = proposalData.material_description;
    
    if (materialDesc && materialDesc !== 'AREIA, CARGA/TRANSPORTE') {
        // Extrai apenas o nome do material (remove vírgula e tudo após ela)
        const materialName = materialDesc.split(',')[0].trim().toUpperCase();
        pdfTitle = `PROPOSTA DE FORNECIMENTO DE ${materialName}`;
    }
    
    pdf.text(pdfTitle, pdfWidth / 2, y, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    y += 15;
    pdf.text(`SERTÂNIA, ${displayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y);
    y += 7;
    pdf.text('DADOS DO CLIENTE:', margin, y);
    y += 5;
    pdf.setFont(undefined, 'bold');
    
    // Exibição condicional do CNPJ do cliente
    let clientDisplayName = clientCompany?.name || 'Empresa Cliente';
    if (proposalData.include_cnpj_client_pdf && clientCompany?.cnpj) {
        clientDisplayName += ` - CNPJ: ${clientCompany.cnpj}`;
    }
    pdf.text(clientDisplayName, margin, y);
    y += 5;
    pdf.setFont(undefined, 'normal');
    pdf.text(`LOCAL: ${proposalData.delivery_location}`, margin, y);
    y += 5;
    
    // 🎯 NOVA LÓGICA: Observação manual sempre aparece (se existir)
    // Tipo de frete só aparece se checkbox marcado E aparece ABAIXO da tabela
    
    // Exibir observação manual (se existir) - SEM redundância de frete
    if (proposalData.notes && proposalData.notes.trim() !== '') {
        const finalNotesText = `OBSERVAÇÃO: ${proposalData.notes}`;
        const textLines = pdf.splitTextToSize(finalNotesText, pdfWidth - 2 * margin);
        
        if (y + textLines.length * 5 > pdfHeight - margin) {
            pdf.addPage();
            addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
            y = margin;
        }

        pdf.text(textLines, margin, y);
        y += textLines.length * 5;
    }

    pdf.text(`PRAZO DE ENTREGA: ${proposalData.delivery_deadline || 'DISPONIBILIDADE IMEDIATA'}`, margin, y);
    y += 5;
    if (proposalData.manual_pickup_location) {
        pdf.text(`LOCAL DE RETIRADA: ${proposalData.manual_pickup_location}`, margin, y);
        y += 5;
    }

    // Tabela de Material
    y += 10;
    const tableHeaders = [['DESCRIÇÃO MATERIAL', 'VALOR DO M³']];
    const tableBody = [];
    tableBody.push([
        proposalData.material_description || 'AREIA, CARGA/TRANSPORTE',
        formatCurrency(parseFloat(proposalData.price_m3) || 0) 
    ]);

    pdf.autoTable({
        startY: y,
        head: tableHeaders,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, textColor: [0, 0, 0] },
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
        didDrawPage: (data) => {
            addWatermark(pdf, myCompany, pdfWidth, pdfHeight, watermarkYOffset);
            addPageHeadersFooters(pdf, data.pageNumber);
        }
    });

    y = pdf.lastAutoTable.finalY + 10;
    
    // 🎯 TIPO DE FRETE aparece ABAIXO da tabela (se checkbox marcado)
    if (proposalData.show_freight_type_in_pdf) {
        let freightTypeText = '';

        if (proposalData.freight_type === 'CIF') {
            const myCompanyName = myCompany?.name || 'Nossa Empresa';
            freightTypeText = `TIPO DE FRETE: CIF (A "${myCompanyName}" IRÁ FAZER A ENTREGA)`;
        } else if (proposalData.freight_type === 'FOB') {
            freightTypeText = `TIPO DE FRETE: FOB (O CLIENTE IRÁ FAZER A RETIRADA)`;
        }
        
        if (freightTypeText) {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'normal');
            pdf.text(freightTypeText, margin, y);
            y += 7;
        }
    }
    
    y += 10;

    // Informações de contato no final
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    
    // NOVO: Adiciona o nome da minha empresa fornecedora
    if (myCompany.name) {
        pdf.setFont(undefined, 'bold');
        pdf.text(myCompany.name.toUpperCase(), margin, y);
        y += 5;
        pdf.setFont(undefined, 'normal'); // Volta para normal após o nome da empresa
    }

    if (myCompany.phone) {
        pdf.text(`FONE: ${myCompany.phone}`, margin, y);
        y += 5;
    } else {
        pdf.text('FONE: (87) 98108-0160 (87) 99968-0020', margin, y); 
        y += 5;
    }

    if (myCompany.email) {
        pdf.text(`EMAIL: ${myCompany.email}`, margin, y);
        y += 5;
    } else {
        pdf.text('EMAIL: pbatransportes@bol.com.br', margin, y);
        y += 5;
    }

    if (myCompany.address) {
        pdf.text(`END: ${myCompany.address}`, margin, y);
        y += 5;
    } else {
        pdf.text('END: Rua Luiz Cajueiro de Albuquerque, n°1130, Loteamento dos Lins, Sertânia-PE-56600-000', margin, y);
        y += 5;
    }
    
    if (myCompany.cnpj) {
        pdf.text(`CNPJ: ${myCompany.cnpj}`, margin, y);
        y += 5;
    }
}

function showModal(title, message) {
    const modal = document.getElementById('generic-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeButton = modal.querySelector('.close-button');

    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${message}</p>`;
    
    const oldCloseButton = closeButton.cloneNode(true);
    closeButton.parentNode.replaceChild(oldCloseButton, closeButton);
    oldCloseButton.onclick = function() {
        hideModal();
    }

    modal.style.display = 'block';

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}