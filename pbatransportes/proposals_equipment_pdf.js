// proposals_equipment_pdf.js
import { showSpinner, hideSpinner, formatCurrency, getEquipTypeName } from './utils.js';
import { appState } from './appState.js';
import { apiClient } from './api.js'; // Importar apiClient para buscar os dados atualizados

// --- Configurações de Estilo do PDF (Variáveis para Fácil Edição) ---
const PDF_CONFIG = {
    margins: {
        top: 15,
        left: 15,
        right: 15,
        bottom: 15
    },
    header: {
        fontSizeTitle: 10,
        fontSizePage: 8,
        logoWidth: 20, // Largura da logo no cabeçalho (ajustado para menor)
        logoMarginRight: 5, // Margem entre a logo e o texto do cabeçalho
        logoYOffset: 5 // Deslocamento vertical da logo no cabeçalho
    },
    footer: {
        fontSize: 8,
        lineSpacing: 3, // Espaçamento entre as linhas do rodapé
        lineHeight: 0.2 // Espessura da linha separadora
    },
    sections: {
        titleFontSize: 16, // Título principal da proposta
        subTitleFontSize: 12, // Títulos de seções (1. EQUIPAMENTOS)
        bodyFontSize: 10, // Texto do corpo
        lineSpacing: 5, // Espaçamento padrão entre linhas de texto
        paragraphSpacing: 10, // Espaçamento padrão entre parágrafos/blocos (fallback)
        // NOVO: Espaçamento individual por seção
        sectionSpacing: {
            section1: 10, // EQUIPAMENTOS - PREÇOS
            section2: 10, // CONDIÇÕES DE APONTAMENTO DA OPERAÇÃO
            section3: 40, // OBRIGAÇÕES DA LOCADORA
            section4: 10, // OBRIGAÇÕES DA LOCATÁRIA
            section5: 10, // PRAZO E REAJUSTE
            section6: 10, // DISPONIBILIDADE
            section7: 10, // CONDIÇÕES DE PAGAMENTO
            section8: 10, // VALIDADE DESTA PROPOSTA
            section9: 10, // CONSIDERAÇÕES GERAIS
            section10: 10, // ÉTICA E CUMPRIMENTO DA LEGISLAÇÃO
            section11: 10, // FORO
            section12: 10, // CONTATO COMERCIAL
            anexo1: 10, // ANEXO I
            imageSection: 10 // IMAGENS DOS EQUIPAMENTOS
        }
    },
    table: {
        fontSize: 8,
        cellPadding: 1.5,
        headFillColor: [200, 200, 200],
        totalRowFillColor: [240, 240, 240]
    },
    imageSection: {
        titleFontSize: 12,
        imagesPerRow: 2, // Mantido em 2 imagens por linha
        // Ajustado para permitir 3 linhas de 2 imagens (total de 6) por página.
        // Valores mais agressivos para maximizar o espaço vertical.
        maxImageHeight: 45, // AJUSTADO para 45mm (valor mais adequado com a correção de Y)
        imageSpacingX: 10, // Espaçamento horizontal entre imagens (mantido)
        imageSpacingY: 8, // AJUSTADO para 8mm (menos espaçamento vertical entre linhas de imagens)
        textUnderImageSpacing: 4, // Espaçamento do texto abaixo da imagem (mantido)
        imageTextFontSize: 6, // AJUSTADO para 6pt (reduzido para caber mais texto)
        imageTextLineHeight: 2.5 // AJUSTADO para 2.5mm (reduzido para compactar o texto)
    }
};
// --- FIM das Configurações de Estilo ---

// Função auxiliar para carregar imagem como uma Promise
function loadImage(url) {
    return new Promise((resolve) => {
        if (!url) {
            console.warn('loadImage: URL da imagem não fornecida.');
            return resolve(null);
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Importante para tentar evitar problemas de CORS
        
        // Adiciona um timestamp à URL para evitar cache do navegador
        const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;

        img.onload = () => resolve(img);
        
        img.onerror = (e) => {
            console.warn(`loadImage: Erro ao carregar imagem da URL: ${urlWithTimestamp}. Verifique se a URL está correta, se a imagem existe, e se há restrições de CORS no servidor de origem. Detalhes do evento:`, e);
            resolve(null); // Resolve com null para indicar falha no carregamento
        };
        img.src = urlWithTimestamp; // Usa a URL com timestamp
    });
}

// NOVO: Função para construir a string de descrição do item, para ser usada tanto na tabela quanto nas imagens.
const buildDescription = (item, equipment) => {
    // Função auxiliar para obter o texto de responsável
    const getResponsibleText = (responsible) => {
        if (responsible === 'contratante') return 'LOCATÁRIA';
        if (responsible === 'contratada') return 'LOCADORA';
        return '';
    };

    // Construção da descrição do item baseada nas checkboxes
    let descriptionParts = [];
    if (equipment?.type) {
        const equipmentType = appState.equipment_types?.find(et => et.id == equipment.type);
        descriptionParts.push(equipmentType?.name || equipment.type);
    }
    if (item.include_prefix_pdf && equipment?.prefix) descriptionParts.push(equipment.prefix);
    if (item.include_brand_pdf && equipment?.brand) descriptionParts.push(equipment.brand);
    if (item.include_model_pdf && equipment?.model) descriptionParts.push(equipment.model);
    if (item.include_year_pdf && equipment?.year) descriptionParts.push(`ANO: ${equipment.year}`);
    if (item.include_characteristic_pdf && equipment?.characteristic) descriptionParts.push(`Característica: ${equipment.characteristic}`);
    if (item.include_capacity_pdf && item.capacidade) descriptionParts.push(`Capacidade: ${item.capacidade}`);
    if (item.include_chassi_pdf && item.chassi) descriptionParts.push(`Chassi: ${item.chassi}`);

     // ✅ LÓGICA: Se checkbox GERAL marcada OU checkbox INDIVIDUAL marcada
    if (item.include_operator) {
        descriptionParts.push('COM OPERADOR');
    }
    
    // Adiciona os custos por item
    if (item.include_food && item.food_responsible) {
        descriptionParts.push(`Alimentação por conta da: ${getResponsibleText(item.food_responsible)}.`);
    }
    if (item.include_lodging && item.lodging_responsible) {
        descriptionParts.push(`Hospedagem por conta da: ${getResponsibleText(item.lodging_responsible)}.`);
    }
    if (item.include_fuel && item.fuel_responsible) {
        descriptionParts.push(`Combustível por conta da: ${getResponsibleText(item.fuel_responsible)}.`);
    }
    if (item.observations) {
        descriptionParts.push(`${item.observations}`);
    }

    // Retorna a string final
    return descriptionParts.filter(Boolean).join(' - ');
};

// NOVA FUNÇÃO: Constrói a string de valor formatada, para ser usada na seção de imagens
const buildValueText = (item) => {
    const value = formatCurrency(item.value);
    let valueType = '';

    if (item.value_type === 'mensal') {
        valueType = 'VALOR MENSAL:';
    } else if (item.value_type === 'diario') {
        valueType = 'VALOR DIÁRIO:';
    } else if (item.value_type === 'horas') {
        valueType = 'VALOR DA HORA:';
    } else if (item.value_type === 'personalizado' && item.custom_value_description) {
        valueType = `VALOR REFERENTE A ${item.custom_value_description.toUpperCase()}:`;
    } else {
        valueType = 'VALOR:'; // Fallback
    }

    return `${valueType} ${value}`;
};


export async function exportEquipmentProposalPDF(proposalData, returnBlob = false) {
    if (!returnBlob) showSpinner();
    const { jsPDF } = window.jspdf;

    try {
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let y = PDF_CONFIG.margins.top;

        // Dados da minha empresa e do cliente (já vêm completos em proposalData)
        const myCompany = proposalData.my_company;
        const clientCompany = proposalData.client_company;

        // NOVO: Força o recarregamento dos dados de equipamentos para garantir que as imagens estejam atualizadas
        try {
            const equipmentData = await apiClient.fetchData('equipment');
            appState.equipment = equipmentData; // Atualiza o appState com os dados mais recentes
        } catch (e) {
            console.error('Falha ao recarregar dados de equipamentos para PDF:', e);
            // Continua mesmo se falhar para não bloquear a geração do PDF, mas as imagens podem estar desatualizadas.
        }

        // Garante que os tipos de equipamento estão carregados para resolver o nome no PDF
        try {
            if (!appState.equipment_types || appState.equipment_types.length === 0) {
                const equipmentTypesData = await apiClient.fetchData('equipment_types', 'id, name, short_name');
                appState.equipment_types = equipmentTypesData;
            }
        } catch (e) {
            console.error('Falha ao carregar tipos de equipamentos para PDF:', e);
        }

        // NOVO: Variáveis de controle para exibição condicional
        const includeTerms = proposalData.include_terms_pdf;
        const includeImages = proposalData.include_images_pdf;
        const includeCnpjPdf = proposalData.include_cnpj_pdf; // NOVO: Captura o estado da checkbox de CNPJ


        // Função para adicionar cabeçalho e rodapé em cada página
        const addPageHeadersFooters = async (doc, pageNumber) => {
            // Cabeçalho
            doc.setFontSize(PDF_CONFIG.header.fontSizeTitle);
            doc.setFont(undefined, 'bold');
            
            let currentXHeader = PDF_CONFIG.margins.left;
            let currentYHeader = PDF_CONFIG.margins.top / 2 + PDF_CONFIG.header.logoYOffset; // Posição vertical para o cabeçalho

            // Adiciona a logomarca no canto superior esquerdo
            if (myCompany && myCompany.logo_url) {
                const logo = await loadImage(myCompany.logo_url);
                if (logo) {
                    const imgWidth = PDF_CONFIG.header.logoWidth;
                    const imgHeight = (logo.height * imgWidth) / logo.width;
                    doc.addImage(logo, 'JPEG', currentXHeader, currentYHeader - (imgHeight / 2), imgWidth, imgHeight);
                    currentXHeader += imgWidth + PDF_CONFIG.header.logoMarginRight;
                }
            }
            
            // Adiciona o nome da empresa no centro
            doc.text(myCompany?.name || 'PBA TRANSPORTES', pdfWidth / 2, currentYHeader, { align: 'center' });
            
            // Rodapé
            doc.setFontSize(PDF_CONFIG.footer.fontSize);
            doc.setFont(undefined, 'normal');
            
            let footerY = pdfHeight - PDF_CONFIG.margins.bottom + 5; // Posição do rodapé

            // Linha separadora antes do rodapé
            doc.setDrawColor(150, 150, 150); // Cor cinza claro
            doc.setLineWidth(PDF_CONFIG.footer.lineHeight);
            doc.line(PDF_CONFIG.margins.left, footerY - 3, pdfWidth - PDF_CONFIG.margins.right, footerY - 3); // Linha horizontal
            
            // Adiciona informações da minha empresa no rodapé (dinâmico)
            const footerInfo = [];
            if (myCompany.name) footerInfo.push(myCompany.name.toUpperCase());
            if (myCompany.address) footerInfo.push(myCompany.address);
            if (myCompany.phone) footerInfo.push(`FONE: ${myCompany.phone}`);
            if (myCompany.cnpj) footerInfo.push(`CNPJ: ${myCompany.cnpj}`);

            // Adiciona cada linha do rodapé
            footerInfo.forEach(line => {
                doc.text(line, PDF_CONFIG.margins.left, footerY);
                footerY += PDF_CONFIG.footer.lineSpacing;
            });

            // Número da página no canto inferior direito
            doc.text(`Página ${pageNumber}`, pdfWidth - PDF_CONFIG.margins.right, pdfHeight - PDF_CONFIG.margins.bottom + 5, { align: 'right' });
        };

        // Adiciona cabeçalho e rodapé na primeira página
        await addPageHeadersFooters(pdf, 1);

        // --- Seção de Cabeçalho e Introdução (Condicional) ---
        pdf.setFontSize(PDF_CONFIG.sections.titleFontSize);
        pdf.setFont(undefined, 'bold');
        y += PDF_CONFIG.sections.sectionSpacing.section1; // Usando espaçamento manual

        if (includeTerms) {
            pdf.text('PROPOSTA DE SERVIÇOS', pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.sectionSpacing.section1;

            pdf.setFontSize(PDF_CONFIG.sections.bodyFontSize);
            pdf.setFont(undefined, 'normal');
            pdf.text(`SERTÂNIA, ${new Date(proposalData.proposal_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text(`${myCompany.name} - CNPJ: ${myCompany.cnpj}`, PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text(`END: ${myCompany.address}`, PDF_CONFIG.margins.left, y);
            
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text('À', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.setFont(undefined, 'bold');
            
            pdf.setFont(undefined, 'bold');

            const clientDisplayName = buildClientCompanyFullName(clientCompany, proposalData.name_complement, includeCnpjPdf);
            pdf.text(clientDisplayName, PDF_CONFIG.margins.left, y);
            
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.setFont(undefined, 'normal');
            pdf.text('Ref.: Locação de Equipamentos', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.sectionSpacing.section1;
            pdf.text('Prezados Senhores,', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text('É com satisfação que apresentamos as nossas condições técnicas e comerciais para a execução dos serviços de', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text('Locação de Equipamentos, conforme as condições abaixo descritas:', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.sectionSpacing.section1;
        } else {
            // NOVO: Cabeçalho simplificado se os termos não forem incluídos
            pdf.text('PROPOSTA DE SERVIÇOS', pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.lineSpacing * 2;
            
            pdf.setFontSize(PDF_CONFIG.sections.bodyFontSize);
            pdf.setFont(undefined, 'normal');
            pdf.text(`SERTÂNIA, ${new Date(proposalData.proposal_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.text('À', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.setFont(undefined, 'bold');

            const clientDisplayName = buildClientCompanyFullName(clientCompany, proposalData.name_complement, includeCnpjPdf);
            pdf.text(clientDisplayName, pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.setFont(undefined, 'normal');
            pdf.text('Ref.: Locação de Equipamentos', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing * 2;
            pdf.text('Prezados Senhores, É com satisfação que apresentamos as nossas condições técnicas e comerciais para a execução dos serviços de Locação de Equipamentos, conforme proposta abaixo:', PDF_CONFIG.margins.left, y, { maxWidth: pdfWidth - 2 * PDF_CONFIG.margins.left });
            y += PDF_CONFIG.sections.sectionSpacing.section1;
        }


        // Numeração inteligente e conteúdo dinâmico (apenas se termos incluídos)
        let currentSection = 1;
        let currentSubsection = 1;

        // Função auxiliar para adicionar título de seção, com quebra de página
        const addSectionTitle = async (title, sectionKey) => {
            if (y + PDF_CONFIG.sections.subTitleFontSize + PDF_CONFIG.sections.sectionSpacing[sectionKey] > pdfHeight - PDF_CONFIG.margins.bottom) {
                pdf.addPage();
                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                y = PDF_CONFIG.margins.top + 15;
            }
            pdf.setFontSize(PDF_CONFIG.sections.subTitleFontSize);
            pdf.setFont(undefined, 'bold');
            pdf.text(`${currentSection}. ${title}`, PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing;
            pdf.setFontSize(PDF_CONFIG.sections.bodyFontSize);
            pdf.setFont(undefined, 'normal');
            currentSubsection = 1; // Reset subsection counter for new major section
        };

        // Função auxiliar para adicionar texto de subseção, com quebra de página e indentação
        const addSubsectionText = async (text, isBold = false) => {
            const prefix = `${currentSection}.${currentSubsection}. `;
            const availableWidth = pdfWidth - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right;
            const prefixWidth = pdf.getStringUnitWidth(prefix) * PDF_CONFIG.sections.bodyFontSize / pdf.internal.scaleFactor;
            const textWidth = availableWidth - prefixWidth;

            const lines = pdf.splitTextToSize(text, textWidth);

            if (y + (lines.length * PDF_CONFIG.sections.lineSpacing) + PDF_CONFIG.sections.lineSpacing * 2 > pdfHeight - PDF_CONFIG.margins.bottom) {
                pdf.addPage();
                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                y = PDF_CONFIG.margins.top + 15;
            }
            
            pdf.setFont(undefined, isBold ? 'bold' : 'normal');
            pdf.text(`${prefix}${lines[0]}`, PDF_CONFIG.margins.left, y);
            for (let i = 1; i < lines.length; i++) {
                y += PDF_CONFIG.sections.lineSpacing;
                pdf.text(lines[i], PDF_CONFIG.margins.left + prefixWidth, y);
            }
            y += PDF_CONFIG.sections.lineSpacing;
            currentSubsection++;
        };
        
        if (includeTerms) {
            // --- SEÇÃO 1: EQUIPAMENTOS - PREÇOS ---
            await addSectionTitle('EQUIPAMENTOS - PREÇOS', 'section1');
            await addSubsectionText('No Anexo I apresentamos tabela contendo a relação dos equipamentos ofertados, suas características, capacidades, prazos considerados em horas e os respectivos preços de aluguel, sem mão de obra.');
            y += PDF_CONFIG.sections.sectionSpacing.section1;


            // --- SEÇÃO 2: CONDIÇÕES DE APONTAMENTO DA OPERAÇÃO ---
            currentSection++;
            await addSectionTitle('CONDIÇÕES DE APONTAMENTO DA OPERAÇÃO', 'section2');
            
            const uniqueMinGuaranteedHours = new Set(proposalData.items.map(item => item.min_guaranteed_hours).filter(h => h !== null && h !== undefined && h > 0));
            let section2_1Text = '';

            if (proposalData.default_min_guaranteed_hours !== null && proposalData.default_min_guaranteed_hours !== undefined && proposalData.default_min_guaranteed_hours > 0) {
                section2_1Text = `A garantia contratual é de ${proposalData.default_min_guaranteed_hours} (${writeNumberToPortuguese(proposalData.default_min_guaranteed_hours)}) horas mínimas. Para efeito de medição, as horas garantidas são divididas pelo número de dias úteis do mês, desconsiderando sábados, domingos e feriados não trabalhados.`;
            } else if (uniqueMinGuaranteedHours.size === 1) {
                const hours = Array.from(uniqueMinGuaranteedHours)[0];
                section2_1Text = `A garantia contratual é de ${hours} (${writeNumberToPortuguese(hours)}) horas mínimas. Para efeito de medição, as horas garantidas são divididas pelo número de dias úteis do mês, desconsiderando sábados, domingos e feriados não trabalhados.`;
            } else if (uniqueMinGuaranteedHours.size > 1) {
                section2_1Text = 'A garantia contratual é variável por equipamento, conforme descrito no Anexo I. Para efeito de medição, as horas garantidas são divididas pelo número de dias úteis do mês, desconsiderando sábados, domingos e feriados não trabalhados.';
            } else {
                section2_1Text = 'A cobrança dos aluguéis iniciará a partir do momento que o EQUIPAMENTO esteja entregue no canteiro de obras da LOCATÁRIA e apto ao uso a que se destina.';
            }
            await addSubsectionText(section2_1Text);


            await addSubsectionText('A cobrança dos aluguéis iniciará a partir do momento que o EQUIPAMENTO esteja entregue no canteiro de obras da LOCATÁRIA e apto ao uso a que se destina.');
            await addSubsectionText('Os apontamentos serão feitos a partir da aprovação do equipamento apresentação dos equipamentos, através do checklist na portaria do empreendimento, ou da retirada da LOCATÁRIA no pátio da LOCADORA, até a saída / entrega do seu último componente, quando da sua desmobilização.');
            await addSubsectionText('Os períodos necessários para identificação e integração do pessoal e verificação de equipamentos, componentes e ferramentas serão apontados normalmente como horas trabalhadas.');
            await addSubsectionText('Consideramos garantia mínima de faturamento de acordo com cada equipamento descrito no ANEXO 1 desta proposta.');
            await addSubsectionText('As horas excedentes ao faturamento mínimo, serão cobradas com base no valor Integral da hora máquina / equipamento, informado no Anexo 1.');
            y += PDF_CONFIG.sections.sectionSpacing.section2;


        // ✅ SEÇÃO 3: OBRIGAÇÕES DA LOCADORA
currentSection++;
await addSectionTitle('OBRIGACÕES DA LOCADORA', 'section3');
await addSubsectionText('Fornecer os equipamentos em perfeitas condições de uso, com toda a manutenção preventiva realizada até o início do período de locação.');
await addSubsectionText('A LOCADORA, manterá uma Base de Manutenção e equipe de manutenção, que se instalará em local (Canteiro de Obra), a ser indicado pela LOCATÁRIA.');
await addSubsectionText('Fornecimento das manutenções preventivas e corretivas.');
await addSubsectionText('Para as manutenções corretivas por mau uso, a LOCADORA, emitirá uma nota de débito para a LOCATÁRIA que deverá pagar no prazo máximo de 30 dias após o recebimento da mesma.');
await addSubsectionText('A LOCADORA no ato da entrega do bem locado, entregará todos os pneus e conchas novos.');

if (proposalData.include_general_fuel && proposalData.general_fuel_responsible === 'contratada') {
    await addSubsectionText('Fornecer combustível e logística de abastecimento para os equipamentos em operação.');
}
if (proposalData.include_general_food && proposalData.general_food_responsible === 'contratada') {
    await addSubsectionText('Fornecer alimentação para o pessoal.');
}
if (proposalData.include_general_lodging && proposalData.general_lodging_responsible === 'contratada') {
    await addSubsectionText('Fornecer hospedagem para o pessoal.');
}

// ✅ NOVO: Adiciona "Fornecer operador" se a checkbox geral estiver marcada
if (proposalData.include_general_operator) {
    await addSubsectionText('Fornecer operador qualificado para operar os equipamentos.');
}

y += PDF_CONFIG.sections.sectionSpacing.section3;
            
            // ✅ SEÇÃO 4: OBRIGAÇÕES DA LOCATÁRIA (CORRIGIDA)
            currentSection++;
            await addSectionTitle('OBRIGACÕES DA LOCATÁRIA', 'section4');
            
            // ✅ SÓ ADICIONA SE AS CHECKBOXES **GERAIS** ESTIVEREM MARCADAS E RESPONSÁVEL = CONTRATANTE
            if (proposalData.include_general_fuel && proposalData.general_fuel_responsible === 'contratante') {
                await addSubsectionText('Fornecer combustível e logística de abastecimento para os equipamentos em operação, sem ônus à LOCADORA.');
            }
            if (proposalData.include_general_food && proposalData.general_food_responsible === 'contratante') {
                await addSubsectionText('Fornecer alimentação para o pessoal.');
            }
            if (proposalData.include_general_lodging && proposalData.general_lodging_responsible === 'contratante') {
                await addSubsectionText('Fornecer hospedagem para o pessoal.');
            }
            
            await addSubsectionText('Durante o prazo da execução dos trabalhos, assume integralmente a responsabilidade quanto à guarda e segurança do (s) equipamento (s), obrigando se a protegê-los contra a ação danosa de terceiros e, no caso do (s) bem (s) ser operado por preposto seu, por prejuízos causados a terceiros, pessoas ou bens, por uso inadequado, imperícia, imprudência ou ainda por dolo.');
            await addSubsectionText('Comunicar, com antecedência mínima de 30 (trinta) dias, a data da efetiva mobilização e desmobilização dos equipamentos.');
            await addSubsectionText('Uma vez que, a LOCATÁRIA, tem total gestão sobre o histograma de equipamentos, caberá a mesma, comunicar com 10 (dez) dias, a data de uma desmobilização parcial de equipamentos.');
            await addSubsectionText('A entrega antecipada do(s) equipamento(s), não exonera a LOCATÁRIA das obrigações relativas ao pagamento das diárias conforme previsto no item acima.');
            await addSubsectionText('Respeitar o direito de propriedade da LOCADORA em relação ao(s) Equipamento(s) locado(s) e seus acessórios, assim como não os oferecê-los em garantia, sublocá-los ou cedê-los a terceiros, seja a título gratuito ou oneroso;');
            await addSubsectionText('Não realizar qualquer modificação ou adaptação nas características, nos acessórios e na estrutura do(s) Equipamento(s), incluindo, mas não se limitando a remoção ou desfiguração de qualquer letreiro ou insígnia, sem prévia e expressa anuência por escrito da LOCADORA, correndo por conta da LOCATÁRIA os prejuízos decorrentes do inadimplemento de sua obrigação;');
            await addSubsectionText('No ato da desmobilização a LOCATÁRIA entregará à LOCADORA os pneus equipamentos novos, assim como as conchas novas.');
            y += PDF_CONFIG.sections.sectionSpacing.section4;

            // --- SEÇÃO 5: PRAZO E REAJUSTE ---
            currentSection++;
            await addSectionTitle('PRAZO E REAJUSTE', 'section5');
            await addSubsectionText('O prazo poderá ser prorrogado, se acordado entre as partes, mediante aditamento contratual');
            await addSubsectionText('A locação não será considerada como terminada, até a devida restituição pela LOCATÁRIA à LOCADORA, do(s) veículo(s), equipamento(s) e máquina(s) objeto da presente proposta, mediante formalização da devolução.');
            await addSubsectionText('Após o período de 12 (doze) meses, os preços aqui pactuados, serão obrigatoriamente reajustados, a partir do décimo terceiro mês de vigência contratual, inclusive, e assim sucessivamente a cada ano de renovação, conforme variação do IGP-M / FGV no período contratual, tornando-se o mês de junho como referência para o início da correção.');
            y += PDF_CONFIG.sections.sectionSpacing.section5;

            // --- SEÇÃO 6: DISPONIBILIDADE ---
            currentSection++;
            await addSectionTitle('DISPONIBILIDADE', 'section6');
            const dispText = `${currentSection}.1. Esta proposta não obriga a LOCADORA a garantir a colocação à disposição da LOCATÁRIA o equipamento especificado para o prazo previsto, pois dependerá da disponibilidade do mesmo quando manifestada a firme intenção de contratação.`;
            await addSubsectionText(dispText);
            y += PDF_CONFIG.sections.sectionSpacing.section6;


            // --- SEÇÃO 7: CONDIÇÕES DE PAGAMENTO ---
            currentSection++;
            await addSectionTitle('CONDIÇÕES DE PAGAMENTO', 'section7');
            await addSubsectionText('Mobilização e Desmobilização: Serão de Responsabilidade da LOCATÁRIA, contudo, caso a LOCADORA seja a empresa escolhida para a prestação desse serviço, o pagamento ocorrerá no Boletim de Medição Mensal, após a conclusão de cada evento.');
            await addSubsectionText('As informações necessárias para a Mobilização e Desmobilização, dos equipamentos relacionados no anexo I desta proposta, poderão ser obtidas nos sites dos fabricantes.');
            await addSubsectionText('Equipamentos: A medição será mensal, após a emissão da nota fiscal a LOCATÁRIA terá um prazo máximo de 20 (vinte) dias para efetuar o adimplemento da nota fiscal emitida.');
            await addSubsectionText('Após o vencimento será cobrada de multa de dois por cento (2%), acrescida de juros de mora de um por cento (1%) ao mês calculados “pro-rata die”, mais correção monetária calculada pela variação do IGP-M, da data do vencimento da obrigação até a data do efetivo pagamento.');
            y += PDF_CONFIG.sections.sectionSpacing.section7;

            // --- SEÇÃO 8: VALIDADE DESTA PROPOSTA ---
            currentSection++;
            await addSectionTitle('VALIDADE DESTA PROPOSTA', 'section8');
            const valText = `${currentSection}.1. Esta proposta é válida por 5 (cinco) dias a partir da data de sua apresentação, contudo não poderemos garantir a disponibilidade do equipamento.`;
            await addSubsectionText(valText);
            y += PDF_CONFIG.sections.sectionSpacing.section8;

            // --- SEÇÃO 9: CONSIDERAÇÕES GERAIS ---
            currentSection++;
            await addSectionTitle('CONSIDERAÇÕES GERAIS', 'section9');
            await addSubsectionText('Nossos preços não contemplam adicionais de periculosidade e/ou insalubridade, e caso sejam devidos no local de prestação dos serviços, será objeto de revisão dos preços ofertados.');
            await addSubsectionText('Caso o serviço seja confirmado, favor devolver-nos esta proposta com todas as folhas rubricadas e a última via assinada e carimbada pelo representante legal da empresa, juntamente com o documento de representação (procuração e contrato social ou estatuto social com a respectiva ata de eleição da diretoria estatutária) via fax ou e-mail.');
            await addSubsectionText('Os equipamentos somente serão mobilizados após confirmação do pedido formal, via e-mail, carta de intenção ou contrato.');
            await addSubsectionText('Ocorrendo alteração na legislação tributária, trabalhista, previdenciária e fiscal, no período compreendido entre a data de assinatura desta proposta e a data de cada faturamento, referente à criação ou extinção de contribuições, tributos e/ou encargos ou modificações dos já existentes, considerando na elaboração do preço, será feita a respectiva correção para mais ou para menos no preço, na proporção em que a referida alteração modifique a respectiva composição do preço.');
            await addSubsectionText('Está excluída a responsabilidade das partes por lucros cessantes, danos indiretos, perdas de aluguéis, receitas, perdas de produção, perdas de venda ou perdas financeiras, sob quaisquer alegações.');
            await addSubsectionText('Nos casos em que não seja realizada uma vistoria prévia, a especificação do equipamento será de inteira responsabilidade da LOCATÁRIA, não se responsabilizando a LOCADORA pela não execução do serviço por falta de capacidade do equipamento ou por condições adversas do terreno.');
            await addSubsectionText('No caso de devolução do(s) equipamento(s) dimensionado e solicitado pela LOCATÁRIA, por deficiência e/ou insuficiência técnica, em vistoria e testes realizados, mediante relatório de entrega técnica e aceita, fica a LOCATÁRIA obrigada a ressarcir os custos de horas trabalhadas e/ou a disposição, bem como dos custos referentes aos eventos de mobilização e desmobilização.');
            await addSubsectionText('A LOCADORA se reserva o direito a não efetuar os serviços contratados sem que isto lhe acarrete quaisquer tipos de ônus e responsabilidades, em função de condições climáticas desfavoráveis, problemas nos processos produtivos, operações consideradas de risco em qualquer momento ou qualquer outro tipo de força maior que venha prejudicar ou colocar em risco a execução dos mesmos.');
            await addSubsectionText('Caso a LOCATÁRIA descumpra o estabelecido nos itens acima, a mesma assumirá integralmente os riscos daí decorrentes.');
            await addSubsectionText('Os equipamentos e valores constantes desta proposta somente serão válidos se permanecerem inalteradas as condições observadas por nosso técnico na data da realização da vistoria ou conforme informado pela LOCATÁRIA.');
            await addSubsectionText('A LOCADORA prevê a utilização de equipamentos subcontratados de terceiros, sendo a mesma responsável por todos os equipamentos que estejam contemplados dentro do objeto do contrato de locação a ser firmado, sendo que todas as tratativas ocorrerão exclusivamente entre a LOCATÁRIA e a LOCADORA.');
            await addSubsectionText('Na hipótese de serem constatadas alterações de peso e/ou dimensões dos equipamentos informados pela LOCATÁRIA e que provoquem um acréscimo de custos operacionais direta ou indiretamente, a LOCADORA se reserva o direito de reavaliar o preço ofertado, ainda que os serviços objetos desta proposta estejam em execução ou já concluídos.');
            y += PDF_CONFIG.sections.sectionSpacing.section9;

            // --- SEÇÃO 10: ÉTICA E CUMPRIMENTO DA LEGISLAÇÃO ---
            currentSection++;
            await addSectionTitle('ÉTICA E CUMPRIMENTO DA LEGISLAÇÃO', 'section10');
            await addSubsectionText('A PBA TRANSPORTES declara que conhece e compreende as disposições das leis relacionadas à ética nos negócios em vigor no Brasil e eventuais normas internacionais aplicáveis às partes sobre o tema, incluindo, mas não se limitando à lei n° 12.846/13.');
            await addSubsectionText('A PBA TRANSPORTES adotará os mais altos padrões éticos de conduta no cumprimento do escopo do contrato e em qualquer outra relação com a LOCATÁRIA e terceiros, devendo ainda cumprir a legislação brasileira e demais normas referidas na cláusula acima.');
            await addSubsectionText('A PBA TRANSPORTES compromete-se, por si, seus empregados, gestores, diretores, representantes legais, prepostos, subcontratados e quaisquer pessoas vinculadas, a não pagar, oferecer, prometer ou autorizar o pagamento de qualquer valor ou qualquer tipo de vantagem, direta ou indiretamente, a qualquer funcionário público ou privado, com o objetivo de influenciá-lo ou recompensá-lo de alguma forma, em troca de algum benefício indevido ou favorecimento para a PBA TRANSPORTES ou para a LOCATÁRIA.');
            y += PDF_CONFIG.sections.sectionSpacing.section10;

            // --- SEÇÃO 11: FORO ---
            currentSection++;
            await addSectionTitle('FORO', 'section11');
            const foroText = `Fica eleito o foro da cidade de Sertânia - PE, que será competente para dirimir as questões decorrentes do presente Contrato, ou sua execução, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`;
            await addSubsectionText(foroText);
            y += PDF_CONFIG.sections.sectionSpacing.section11;

            // --- SEÇÃO 12: CONTATO COMERCIAL ---
            currentSection++;
            await addSectionTitle('CONTATO COMERCIAL', 'section12');
            const contatoText = `Para eventuais dúvidas e esclarecimentos, solicitamos a gentileza de entrar em contato com o seguinte responsável:`;
            await addSubsectionText(contatoText);
            
            // Dados do responsável dinâmicos
            const responsibleName = myCompany.responsible_owner_name || 'NOME DO PROPRIETÁRIO DA EMPRESA';
            const responsiblePhone = myCompany.responsible_owner_phone || myCompany.phone || '(00) 0 0000-0000';
            pdf.setFont(undefined, 'bold');
            if (y + PDF_CONFIG.sections.lineSpacing * 2 > pdfHeight - PDF_CONFIG.margins.bottom) {
                pdf.addPage();
                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                y = PDF_CONFIG.margins.top + 10;
            }
            pdf.text(`${responsibleName} - FONE ${responsiblePhone}`, PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.lineSpacing * 2;
            pdf.setFont(undefined, 'normal');
            pdf.text('Confirmamos os serviços ofertados nesta proposta, estando de acordo com a totalidade de seus termos e condições.', PDF_CONFIG.margins.left, y);
            y += PDF_CONFIG.sections.sectionSpacing.section12;
            
            // Assinatura (baseado no PDF de exemplo)
            if (myCompany.name) {
                pdf.setFont(undefined, 'bold');
                pdf.text(myCompany.name, pdfWidth / 2, y, { align: 'center' });
                y += PDF_CONFIG.sections.lineSpacing;
            }
            if (myCompany.address) {
                pdf.setFont(undefined, 'normal');
                pdf.text(myCompany.address, pdfWidth / 2, y, { align: 'center' });
                y += PDF_CONFIG.sections.lineSpacing;
            }
            if (myCompany.cnpj) {
                pdf.text(`CNPJ: ${myCompany.cnpj}`, pdfWidth / 2, y, { align: 'center' });
                y += PDF_CONFIG.sections.lineSpacing;
            }
        } // Fim do if (includeTerms)

        // --- Início do ANEXO I (Pode ser na mesma página ou nova) ---
        // Se os termos não forem incluídos, o Anexo I começa na primeira página, sem título.
        if (includeTerms || y + PDF_CONFIG.sections.subTitleFontSize + PDF_CONFIG.sections.sectionSpacing.anexo1 > pdfHeight - PDF_CONFIG.margins.bottom) {
            pdf.addPage();
            await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
            y = PDF_CONFIG.margins.top + 10;
        }

        if (includeTerms) { // Título "ANEXO I" só aparece se os termos forem incluídos
            pdf.setFontSize(PDF_CONFIG.sections.subTitleFontSize);
            pdf.setFont(undefined, 'bold');
            pdf.text('ANEXO I', pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.lineSpacing;
            const clientAnexo1Name = buildClientCompanyFullName(clientCompany, proposalData.name_complement, includeCnpjPdf);
            pdf.text(clientAnexo1Name, pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.sectionSpacing.anexo1;
        } else {
            // Se os termos não forem incluídos, apenas o nome da empresa cliente
            pdf.setFontSize(PDF_CONFIG.sections.subTitleFontSize);
            pdf.setFont(undefined, 'bold');
            const clientAnexo1Name = buildClientCompanyFullName(clientCompany, proposalData.name_complement, includeCnpjPdf);
            pdf.text(clientAnexo1Name, pdfWidth / 2, y, { align: 'center' });
            y += PDF_CONFIG.sections.sectionSpacing.anexo1;
        }


        // Determina se a coluna "Horas Mínimas" deve ser exibida
        const hasMinGuaranteedHours = proposalData.items.some(item => item.min_guaranteed_hours !== null && item.min_guaranteed_hours !== undefined && item.min_guaranteed_hours > 0);
        // Determina se a coluna "QTDE" e a linha de total devem ser exibidas
        const showQuantityColumn = proposalData.add_quantity_to_items;

        let tableHeaders = [];
        let columnStylesConfig = {}; 
        let colIndex = 0;
        
        if (showQuantityColumn) {
            tableHeaders.push('QTD');
            columnStylesConfig[colIndex] = { cellWidth: 15 };
            colIndex++;
        }
        tableHeaders.push('DESCRIÇÃO DO ITEM');
        columnStylesConfig[colIndex] = { cellWidth: 'auto' };
        colIndex++;
        
        if (hasMinGuaranteedHours) {
            tableHeaders.push('HORAS MÍNIMAS');
            columnStylesConfig[colIndex] = { cellWidth: 15 };
            colIndex++;
        }
        
        // ✅ LÓGICA: Se quantidade ativada, mostra VALOR UNI e VALOR TOTAL
        if (showQuantityColumn) {
            tableHeaders.push('VALOR UNI');
            columnStylesConfig[colIndex] = { cellWidth: 30 };
            colIndex++;
            tableHeaders.push('VALOR TOTAL');
            columnStylesConfig[colIndex] = { cellWidth: 30 };
            colIndex++;
        } else {
            tableHeaders.push('VALOR');
            columnStylesConfig[colIndex] = { cellWidth: 35 };
            colIndex++;
        }
        tableHeaders.push('MOBILIZAÇÃO');
        columnStylesConfig[colIndex] = { cellWidth: 'auto' }; // Largura automática
        colIndex++;
        tableHeaders.push('DESMOBILIZAÇÃO');
        columnStylesConfig[colIndex] = { cellWidth: 'auto' }; // Largura automática
        colIndex++;


        const finalTableHeaders = [tableHeaders];
        const tableBody = [];
        let totalValue = 0;
        let totalQuantity = 0; // Para somar as quantidades

        // ✅ DEBUG: Verificar os dados da proposta
console.log('=== DEBUG PROPOSTA ===');
console.log('Valores Padrão da Proposta:');
console.log('- default_mobilization_rolling:', proposalData.default_mobilization_rolling);
console.log('- default_demobilization_rolling:', proposalData.default_demobilization_rolling);
console.log('- default_mobilization_non_rolling:', proposalData.default_mobilization_non_rolling);
console.log('- default_demobilization_non_rolling:', proposalData.default_demobilization_non_rolling);
console.log('Total de itens:', proposalData.items.length);
console.log('======================');

proposalData.items.forEach(item => {
    const equipment = appState.equipment.find(e => e.id == item.equipment_id);
    
    const description = buildDescription(item, equipment);

    let valueText = formatCurrency(item.value);
    if (item.value_type === 'personalizado' && item.custom_value_description) {
        valueText += ` (${item.custom_value_description})`;
    } else if (item.value_type === 'diario') {
        valueText += ' (Diário)';
    } else if (item.value_type === 'horas') {
        valueText += ' (Por Hora)';
    } else if (item.value_type === 'mensal') {
        valueText += ' (Mensal)';
    }
    
    // ✅ LÓGICA INTELIGENTE: Usa valor do item OU valor padrão
    let mobilizationValue = '';
    let demobilizationValue = '';
    
    const rollingType = equipment?.rolling_type || item.rolling_type;
    
    // MOBILIZAÇÃO
    if (item.mobilization_cost && parseFloat(item.mobilization_cost) > 0) {
        mobilizationValue = formatCurrency(item.mobilization_cost);
    } else if (rollingType === 'rodante' && proposalData.default_mobilization_rolling && parseFloat(proposalData.default_mobilization_rolling) > 0) {
        mobilizationValue = formatCurrency(parseFloat(proposalData.default_mobilization_rolling));
    } else if (rollingType === 'nao_rodante' && proposalData.default_mobilization_non_rolling && parseFloat(proposalData.default_mobilization_non_rolling) > 0) {
        mobilizationValue = formatCurrency(parseFloat(proposalData.default_mobilization_non_rolling));
    }
    
    // DESMOBILIZAÇÃO
    if (item.demobilization_cost && parseFloat(item.demobilization_cost) > 0) {
        demobilizationValue = formatCurrency(item.demobilization_cost);
    } else if (rollingType === 'rodante' && proposalData.default_demobilization_rolling && parseFloat(proposalData.default_demobilization_rolling) > 0) {
        demobilizationValue = formatCurrency(parseFloat(proposalData.default_demobilization_rolling));
    } else if (rollingType === 'nao_rodante' && proposalData.default_demobilization_non_rolling && parseFloat(proposalData.default_demobilization_non_rolling) > 0) {
        demobilizationValue = formatCurrency(parseFloat(proposalData.default_demobilization_non_rolling));
    }
    
    let rowData = [];
    if (showQuantityColumn) {
        rowData.push(item.quantity || 1);
        totalQuantity += (item.quantity || 1);
    }
    rowData.push(description);

    if (hasMinGuaranteedHours) {
        rowData.push(item.min_guaranteed_hours !== null && item.min_guaranteed_hours !== undefined ? `${item.min_guaranteed_hours} h` : '');
    }
    // ✅ Se quantidade ativada, mostra VALOR UNI e VALOR TOTAL separados
    if (showQuantityColumn) {
        let unitValue = formatCurrency(item.value);
        // 🎯 Adiciona tipo quando tem quantidade
        if (item.value_type === 'personalizado' && item.custom_value_description) {
            unitValue += ` (${item.custom_value_description})`;
        } else if (item.value_type === 'diario') {
            unitValue += ' (Diário)';
        } else if (item.value_type === 'horas') {
            unitValue += ' (Por Hora)';
        } else if (item.value_type === 'mensal') {
            unitValue += ' (Mensal)';
        }
        const totalValue = formatCurrency(item.value * (item.quantity || 1));
        rowData.push(unitValue, totalValue);
    } else {
        rowData.push(valueText);
    }
    
    rowData.push(
        mobilizationValue,
        demobilizationValue
    );
    tableBody.push(rowData);
    totalValue += item.value * (item.quantity || 1);
});



        // Adicionar linha de total SOMENTE se showQuantityColumn for true
       if (showQuantityColumn) {
            let totalRow = [`TOTAL: ${totalQuantity}`];
            totalRow.push(''); // Coluna DESCRIÇÃO
            if (hasMinGuaranteedHours) {
                totalRow.push(''); // Coluna HORAS MÍNIMAS
            }
            totalRow.push(''); // Coluna VALOR UNI (vazia)
            totalRow.push(formatCurrency(totalValue)); // Coluna VALOR TOTAL
            totalRow.push('', ''); // MOBILIZAÇÃO e DESMOBILIZAÇÃO
            
            tableBody.push(totalRow);
        }


        pdf.autoTable({
            startY: y,
            head: finalTableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: PDF_CONFIG.table.fontSize, cellPadding: PDF_CONFIG.table.cellPadding, textColor: [0, 0, 0] },
            headStyles: { fillColor: PDF_CONFIG.table.headFillColor, textColor: [0, 0, 0], fontStyle: 'bold' },
            footStyles: { fillColor: PDF_CONFIG.table.totalRowFillColor, textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: columnStylesConfig, // NOVO: Usa a configuração de estilos flexível
            didDrawPage: async (data) => {
                const totalPagesBeforeTable = pdf.internal.getNumberOfPages() - data.pageNumber + 1;
                if (data.pageNumber > 1 || pdf.internal.getNumberOfPages() > totalPagesBeforeTable) {
                    await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                }
            },
            didParseCell: (data) => {
                if (showQuantityColumn && data.row.index === tableBody.length - 1 && data.section === 'body') { // Última linha (TOTAL)
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = PDF_CONFIG.table.totalRowFillColor;
                }
            }
        });

        y = pdf.lastAutoTable.finalY + PDF_CONFIG.sections.sectionSpacing.anexo1;

        // --- Observações Anexo I (Baseadas no PDF de exemplo) ---
        pdf.setFontSize(PDF_CONFIG.sections.bodyFontSize);
        pdf.setFont(undefined, 'bold');
        pdf.text('OBSERVACÕES:', PDF_CONFIG.margins.left, y);
        y += PDF_CONFIG.sections.lineSpacing;
        pdf.setFont(undefined, 'normal');

        const anexoIObservations = [];

        // Adiciona a observação geral da proposta
        if (proposalData.observations) {
            anexoIObservations.push(`${proposalData.observations}`);
        }

        // Adiciona as observações das novas checkboxes gerais
        const getResponsibleText = (responsible) => {
            if (responsible === 'contratante') return 'LOCATÁRIA';
            if (responsible === 'contratada') return 'LOCADORA';
            return '';
        };

        if (proposalData.include_general_food && proposalData.general_food_responsible) {
            anexoIObservations.push(`ALIMENTAÇÃO: Por conta da ${getResponsibleText(proposalData.general_food_responsible)}.`);
        }
        if (proposalData.include_general_lodging && proposalData.general_lodging_responsible) {
            anexoIObservations.push(`HOSPEDAGEM: Por conta da ${getResponsibleText(proposalData.general_lodging_responsible)}.`);
        }
        if (proposalData.include_general_fuel && proposalData.general_fuel_responsible) {
            anexoIObservations.push(`COMBUSTÍVEL: Por conta da ${getResponsibleText(proposalData.general_fuel_responsible)}.`);
        }

        // 🎯 Lógica inteligente para Franquia mínima Mensal
        const equipmentsWithGuaranteedHours = proposalData.items.filter(item => 
            item.min_guaranteed_hours !== null && 
            item.min_guaranteed_hours !== undefined && 
            item.min_guaranteed_hours > 0
        );
        
        if (equipmentsWithGuaranteedHours.length > 0) {
            // Pega todas as horas únicas
            const uniqueHours = [...new Set(equipmentsWithGuaranteedHours.map(item => item.min_guaranteed_hours))];
            
            // Se só tem 1 equipamento com horas OU todos têm a mesma quantidade de horas
            if (equipmentsWithGuaranteedHours.length === 1 || uniqueHours.length === 1) {
                const hours = uniqueHours[0];
                anexoIObservations.push(`Franquia mínima Mensal: ${hours} HORAS`);
            } else {
                // Equipamentos com horas diferentes OU tem equipamentos sem horas
                anexoIObservations.push('Franquia mínima Mensal: Variável por equipamento, conforme tabela acima.');
            }
        }

        // Adiciona as observações estáticas, incluindo o item em negrito
        anexoIObservations.push('Locação exclusiva para material de primeira e segunda categoria.');

        // ✅ NOVO: Identifica os tipos de equipamentos presentes na proposta
        const equipmentTypesInProposal = new Set();
        proposalData.items.forEach(item => {
            const equipment = appState.equipment.find(e => e.id == item.equipment_id);
            if (equipment && equipment.type) {
                const type = getEquipTypeName(equipment.type).toUpperCase().trim();
                equipmentTypesInProposal.add(type);
            }
        });
        
        // ✅ Define os materiais de desgaste por tipo de equipamento
        const materialsPorTipo = {
            'ESCAVADEIRA': 'ESCAVADEIRA: unhas, parafusos, porcas, dentes, reforma da concha (serão entregues conchas com 100% de vida útil. Devolução da mesma com 100% de vida útil.), lubrificação.',
            'RETROESCAVADEIRA': 'RETROESCAVADEIRA: corte de pneu, lâminas, dentes, parafusos, porcas, concha, lubrificação, borracharia.',
            'MOTONIVELADORA': 'MOTONIVELADORA: lâminas, unhas do escarificador, calço do círculo, calço do bulldozer, canto de lâminas, corte de pneu, porcas, parafusos, lubrificação, borracharia.',
            'TRATOR DE PNEU': 'TRATOR: lâmina, unhas do escarificador, canela do escarificador, porca, parafuso, lubrificação. Será cobrado se for danificado por mal uso (rolete, corrente, roda guia, roda motriz, sapatas).',
            'TRATOR': 'TRATOR: lâmina, unhas do escarificador, canela do escarificador, porca, parafuso, lubrificação. Será cobrado se for danificado por mal uso (rolete, corrente, roda guia, roda motriz, sapatas).',
            'TRATOR DE ESTEIRA': 'TRATOR: lâmina, unhas do escarificador, canela do escarificador, porca, parafuso, lubrificação. Será cobrado se for danificado por mal uso (rolete, corrente, roda guia, roda motriz, sapatas).',
            'CAMINHÃO PIPA': 'CAMINHÕES: corte de pneu, borracharia, mola, lubrificação.',
            'CAMINHÃO BASCULANTE': 'CAMINHÕES: corte de pneu, borracharia, mola, lubrificação.',
            'CAMINHÃO COMBOIO': 'CAMINHÕES: corte de pneu, borracharia, mola, lubrificação.',
            'CAMINHÃO': 'CAMINHÕES: corte de pneu, borracharia, mola, lubrificação.',
            'CARRETA' : 'CAMINHÕES: corte de pneu, borracharia, mola, lubrificação.',
            'ROMPEDOR': 'ROMPEDOR: unhas, parafusos, porcas, lubrificação.', 
            'ROLO COMPACTADOR': 'ROLO: corte de pneu, desgaste de calços.',
            'ROLO': 'ROLO: corte de pneu, desgaste de calços.'
        };
        
        // ✅ Adiciona apenas os materiais dos equipamentos presentes
        if (equipmentTypesInProposal.size > 0) {
            anexoIObservations.push('MATERIAIS DE DESGASTE POR CONTA DA CONTRATANTE');
            
            const materiaisAdicionados = new Set();
            
            equipmentTypesInProposal.forEach(type => {
                const material = materialsPorTipo[type];
                if (material && !materiaisAdicionados.has(material)) {
                    anexoIObservations.push(material);
                    materiaisAdicionados.add(material);
                }
            });
        }
        
        for (const text of anexoIObservations) {
            // Verifica se o texto é o que precisa de negrito
            if (text === 'MATERIAIS DE DESGASTE POR CONTA DA CONTRATANTE') {
                pdf.setFont(undefined, 'bold');
            } else {
                pdf.setFont(undefined, 'normal');
            }
            const lines = pdf.splitTextToSize(text, pdfWidth - 2 * PDF_CONFIG.margins.left);
            if (y + lines.length * PDF_CONFIG.sections.lineSpacing > pdfHeight - PDF_CONFIG.margins.bottom) {
                pdf.addPage();
                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                y = PDF_CONFIG.margins.top + 10;
            }
            pdf.text(lines, PDF_CONFIG.margins.left, y);
            y += lines.length * PDF_CONFIG.sections.lineSpacing + 1;
        }


        // --- Início da Seção de Imagens (Condicional) ---
        if (includeImages) { // NOVO: Bloco de imagens só aparece se a checkbox estiver marcada
            const hasImages = proposalData.items.some(item => {
                const equipmentInAppState = appState.equipment.find(e => e.id == item.equipment_id);
                return item.manual_image_url || equipmentInAppState?.image_url;
            });

            if (hasImages) {
                pdf.addPage();
                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                let currentYForImagesRow = PDF_CONFIG.margins.top + 10; // Inicia o Y para a primeira linha de imagens na nova página

                pdf.setFontSize(PDF_CONFIG.imageSection.titleFontSize);
                pdf.setFont(undefined, 'bold');
                pdf.text('IMAGENS DOS EQUIPAMENTOS', pdfWidth / 2, currentYForImagesRow, { align: 'center' });
                currentYForImagesRow += PDF_CONFIG.sections.sectionSpacing.imageSection; // Avança Y após o título da seção

                let currentX = PDF_CONFIG.margins.left;
                let rowMaxHeight = 0; // Max height of elements in the current row
                let imagesInCurrentRow = 0;

                const totalAvailableWidth = pdfWidth - 2 * PDF_CONFIG.margins.left;
                const imageWidth = (totalAvailableWidth - (PDF_CONFIG.imageSection.imagesPerRow - 1) * PDF_CONFIG.imageSection.imageSpacingX) / PDF_CONFIG.imageSection.imagesPerRow;
                const maxImageHeight = PDF_CONFIG.imageSection.maxImageHeight;

                for (const item of proposalData.items) {
                    const equipmentInAppState = appState.equipment.find(e => e.id == item.equipment_id);
                    const imageUrl = item.manual_image_url || equipmentInAppState?.image_url;

                    if (imageUrl) {
                        const img = await loadImage(imageUrl);

                        if (img) {
                            let finalImgWidth = imageWidth;
                            let finalImgHeight = (img.height * finalImgWidth) / img.width;

                            if (finalImgHeight > maxImageHeight) {
                                finalImgWidth = (finalImgWidth * maxImageHeight) / finalImgHeight;
                                finalImgHeight = maxImageHeight;
                            }
                            
                            // NOVO: Usa a função unificada para construir a descrição da imagem
                            const fullDescription = buildDescription(item, equipmentInAppState);
                            
                            // Separa a parte em negrito do restante do texto
                            const resolvedTypeName = getEquipTypeName(equipmentInAppState?.type) || '';
                            let boldText = resolvedTypeName;
                            if (item.include_operator) {
                                boldText += ' - COM OPERADOR';
                            }
                            
                            // remainingText skips the full bold prefix (type + COM OPERADOR if present)
                            const remainingText = fullDescription.substring(boldText.length).trim().replace(/^-/,'').trim();
                            
                            const valueText = buildValueText(item); // NOVO: Usa a função unificada para o valor
                            
                            // Define o tamanho da fonte para o texto da imagem
                            pdf.setFontSize(PDF_CONFIG.imageSection.imageTextFontSize);
                            
                            // Calcula a altura total do texto para quebra de página
                            const textLinesNormal = pdf.splitTextToSize(remainingText, imageWidth);
                            const textLinesValue = pdf.splitTextToSize(valueText, imageWidth);
                            const totalTextLinesCount = 1 + (textLinesNormal.length > 0 ? textLinesNormal.length : 0) + 1; // Negrito + Normal + Valor
                            const textHeight = totalTextLinesCount * PDF_CONFIG.imageSection.imageTextLineHeight;

                            const totalItemHeight = finalImgHeight + textHeight + PDF_CONFIG.imageSection.textUnderImageSpacing;

                            // Lógica para iniciar uma nova linha ou nova página
                            if (imagesInCurrentRow >= PDF_CONFIG.imageSection.imagesPerRow) {
                                // Move para a próxima linha na página atual
                                currentX = PDF_CONFIG.margins.left;
                                currentYForImagesRow += rowMaxHeight + PDF_CONFIG.imageSection.imageSpacingY;
                                rowMaxHeight = 0; // Reseta rowMaxHeight para a nova linha
                                imagesInCurrentRow = 0;
                            }

                            // Verifica se é necessário uma nova página APÓS avançar para uma nova linha (ou inicialmente)
                            if (currentYForImagesRow + totalItemHeight + PDF_CONFIG.imageSection.imageSpacingY > pdfHeight - PDF_CONFIG.margins.bottom) {
                                pdf.addPage();
                                await addPageHeadersFooters(pdf, pdf.internal.getNumberOfPages());
                                currentX = PDF_CONFIG.margins.left;
                                currentYForImagesRow = PDF_CONFIG.margins.top + 10; // Reseta Y para nova página
                                rowMaxHeight = 0; // Reseta rowMaxHeight para nova página
                                imagesInCurrentRow = 0;
                            }

                            pdf.addImage(img, 'JPEG', currentX, currentYForImagesRow, finalImgWidth, finalImgHeight);
                            
                            let textY = currentYForImagesRow + finalImgHeight + PDF_CONFIG.imageSection.textUnderImageSpacing;
                            
                            // IMPRIME A PARTE EM NEGRITO
                            pdf.setFontSize(PDF_CONFIG.imageSection.imageTextFontSize);
                            pdf.setFont(undefined, 'bold');
                            
                            const linesBold = pdf.splitTextToSize(boldText, imageWidth);
                            pdf.text(linesBold, currentX, textY);
                            textY += linesBold.length * PDF_CONFIG.imageSection.imageTextLineHeight;
                            
                            // IMPRIME A PARTE NORMAL NA PRÓXIMA LINHA
                            pdf.setFont(undefined, 'normal');
                            const linesNormalToPrint = pdf.splitTextToSize(remainingText, imageWidth);
                            if (linesNormalToPrint.length > 0 && remainingText.length > 0) {
                                pdf.text(linesNormalToPrint, currentX, textY);
                                textY += linesNormalToPrint.length * PDF_CONFIG.imageSection.imageTextLineHeight;
                            }
                           
                            // IMPRIME O VALOR
                            pdf.setFont(undefined, 'bold'); // NOVO: Define a fonte como negrito antes de imprimir o valor
                            pdf.text(valueText, currentX, textY);
                            pdf.setFont(undefined, 'normal'); // NOVO: Retorna a fonte para normal para o próximo texto
                            
                            rowMaxHeight = Math.max(rowMaxHeight, totalItemHeight);
                            currentX += imageWidth + PDF_CONFIG.imageSection.imageSpacingX;
                            imagesInCurrentRow++;
                        }
                    }
                }
            }
        } // Fim do if (includeImages)

        // Salvar o PDF ou retornar blob
        if (returnBlob) {
            const blob = pdf.output('blob');
            return blob;
        } else {
            pdf.save(`Proposta_Equipamentos_${clientCompany?.name || 'Cliente'}_${new Date(proposalData.proposal_date).toLocaleDateString('pt-BR')}.pdf`);
        }

    } catch (error) {
        console.error('Erro ao gerar PDF da proposta de equipamento:', error);
        if (!returnBlob) {
            showModal('Erro ao Gerar PDF', 'Não foi possível gerar o PDF da proposta de equipamento. Detalhes: ' + error.message);
        }
        throw error;
    } finally {
        if (!returnBlob) hideSpinner();
    }
}

// Função auxiliar para converter número para extenso em português
function writeNumberToPortuguese(n) {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (n === 0) return 'zero';
    if (n < 0) return 'menos ' + writeNumberToPortuguese(Math.abs(n));

    function convertGroup(num) {
        if (num === 0) return '';
        if (num < 10) return units[num];
        if (num >= 10 && num < 20) return teens[num - 10];
        if (num >= 20 && num < 100) {
            const unit = num % 10;
            const ten = Math.floor(num / 10);
            return tens[ten] + (unit > 0 ? ' e ' + units[unit] : '');
        }
        if (num >= 100 && num < 1000) {
            const hundred = Math.floor(num / 100);
            const remainder = num % 100;
            let result = hundreds[hundred];
            if (num === 100) return 'cem';
            if (remainder > 0) result += ' e ' + convertGroup(remainder);
            return result;
        }
        return '';
    }

    let result = '';
    let num = Math.floor(n);
    let count = 0;

    const scales = ['', 'mil', 'milhões', 'bilhões'];

    do {
        const chunk = num % 1000;
        if (chunk !== 0) {
            let chunkText = convertGroup(chunk);
            if (count > 0 && chunkText !== '') {
                if (chunk === 1) { // Apenas um mil (no lugar de um mil)
                    chunkText = scales[count];
                } else {
                    chunkText += ' ' + scales[count];
                }
            }
            result = chunkText + (result ? (chunkText && result ? ' ' : '') + result : '');
        }
        num = Math.floor(num / 1000);
        count++;
    } while (num > 0);

    return result.trim();
}


// Função para exibir um modal genérico (substituindo alert)
function showModal(title, message) {
    const modal = document.getElementById('generic-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeButton = modal.querySelector('.close-button');

    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${message}</p>`;

    modal.style.display = 'block';

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

function hideModal() {
    const modal = document.getElementById('generic-modal');
    modal.style.display = 'none';
}



const buildClientCompanyFullName = (clientCompany, nameComplement, includeCnpj) => {
    let fullName = clientCompany?.name || 'Empresa Cliente';
    
    if (nameComplement) {
        fullName += ` - ${nameComplement}`;
    }
    
    if (includeCnpj && clientCompany?.cnpj) {
        fullName += ` - CNPJ: ${clientCompany.cnpj}`;
    }
    
    return fullName;
};