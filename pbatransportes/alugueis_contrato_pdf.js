// Geração de PDF do Contrato de Aluguel
import { appState } from './appState.js';
import { apiClient } from './api.js';

export async function generateContractPDF(contractId) {
    const { jsPDF } = window.jspdf;
    
    // FORÇAR RELOAD dos dados para garantir que estão atualizados
    console.log('📄 Recarregando dados para gerar contrato...');
    appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
    appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
    appState.rentalContractPayments = await apiClient.fetchData('rental_contract_payments') || [];
    console.log('✅ Dados recarregados:', {
        owners: appState.rentalOwners.length,
        ownerPayments: appState.rentalOwnerPayments.length,
        contractPayments: appState.rentalContractPayments.length
    });
    
    // Buscar dados do contrato
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    if (!contract) {
        alert('❌ Contrato não encontrado!');
        return null;
    }
    
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    const property = appState.rentalProperties.find(p => p.id === contract.property_id);
    const owner = appState.rentalOwners.find(o => o.id === property.owner_id);
    
    console.log('🏦 Owner encontrado:', owner);
    console.log('💳 Contract Payments:', appState.rentalContractPayments.filter(cp => cp.contract_id === contract.id));
    
    const contractPayments = appState.rentalContractPayments.filter(cp => cp.contract_id === contract.id);
    const paymentMethods = contractPayments.map(cp => {
        const payment = appState.rentalOwnerPayments.find(p => p.id === cp.owner_payment_id);
        console.log(`💰 Buscando payment ID ${cp.owner_payment_id}:`, payment);
        return payment;
    }).filter(p => p);
    
    console.log('✅ Payment methods final:', paymentMethods);
    
    if (!tenant || !property || !owner) {
        alert('❌ Dados incompletos para gerar o contrato!');
        return null;
    }
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;
    let y = margin;
    
    // Função auxiliar para adicionar texto centralizado
    function addCenteredText(text, yPos, fontSize = 12, isBold = false) {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, yPos);
    }
    
    // Função auxiliar para adicionar texto justificado
    function addJustifiedText(text, yPos, maxWidth = pageWidth - 2 * margin) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, yPos);
        return yPos + (lines.length * lineHeight);
    }
    
    // Função para verificar quebra de página
    function checkPageBreak(currentY, spaceNeeded = 30) {
        if (currentY + spaceNeeded > pageHeight - margin) {
            doc.addPage();
            return margin;
        }
        return currentY;
    }
    
    // === CABEÇALHO ===
    const contractType = contract.is_commercial === 'S' ? 'COMERCIAL' : 'RESIDENCIAL';
    addCenteredText(`CONTRATO DE LOCAÇÃO ${contractType}`, y, 14, true);
    y += lineHeight * 2;
    
    addCenteredText(`Contrato Nº ${contract.contract_code}`, y, 12, true);
    y += lineHeight * 2.5;
    
    // === PARTES ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCADOR:', margin, y);
    y += lineHeight;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${owner.name}`, margin + 5, y);
    y += lineHeight;
    
    // Determinar qual documento mostrar (CPF ou CNPJ) - MESMA LÓGICA DAS ASSINATURAS
    let ownerDocTop = '';
    if (owner.cpf && owner.cnpj) {
        ownerDocTop = owner.document_type === 'cnpj' ? `CNPJ: ${formatCNPJ(owner.cnpj)}` : `CPF: ${formatCPF(owner.cpf)}`;
    } else if (owner.cpf) {
        ownerDocTop = `CPF: ${formatCPF(owner.cpf)}`;
    } else if (owner.cnpj) {
        ownerDocTop = `CNPJ: ${formatCNPJ(owner.cnpj)}`;
    } else if (owner.cpf_cnpj) {
        ownerDocTop = `CPF/CNPJ: ${formatDocument(owner.cpf_cnpj)}`;
    } else {
        ownerDocTop = 'CPF/CNPJ: Não informado';
    }
    
    doc.text(ownerDocTop, margin + 5, y);
    y += lineHeight;
    if (owner.phone) {
        doc.text(`Telefone: ${formatPhone(owner.phone)}`, margin + 5, y);
        y += lineHeight;
    }
    if (owner.email) {
        doc.text(`E-mail: ${owner.email}`, margin + 5, y);
        y += lineHeight;
    }
    
    y += lineHeight;
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATÁRIO:', margin, y);
    y += lineHeight;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${tenant.name}`, margin + 5, y);
    y += lineHeight;
    doc.text(`CPF: ${formatCPF(tenant.cpf)}`, margin + 5, y);
    y += lineHeight;
    if (tenant.phone) {
        doc.text(`Telefone: ${formatPhone(tenant.phone)}`, margin + 5, y);
        y += lineHeight;
    }
    if (tenant.email) {
        doc.text(`E-mail: ${tenant.email}`, margin + 5, y);
        y += lineHeight;
    }
    
    y += lineHeight * 1.5;
    y = checkPageBreak(y);
    
    // === OBJETO DO CONTRATO ===
    doc.setFont('helvetica', 'bold');
    doc.text('DO OBJETO', margin, y);
    y += lineHeight * 1.5;
    
    const propertyAddress = `${property.street}, ${property.number}${property.complement ? ' - ' + property.complement : ''}, ${property.neighborhood}, ${property.city}/${property.state}${property.cep ? ' - CEP: ' + formatCEP(property.cep) : ''}`;
    
    const clausula1 = `CLÁUSULA 1ª - O LOCADOR dá em locação ao LOCATÁRIO o imóvel situado em ${propertyAddress}, doravante denominado simplesmente "IMÓVEL".`;
    y = addJustifiedText(clausula1, y);
    y += lineHeight;
    
    // === PRAZO ===
    y = checkPageBreak(y);
    doc.setFont('helvetica', 'bold');
    doc.text('DO PRAZO', margin, y);
    y += lineHeight * 1.5;
    
    const dataInicio = formatDateFull(contract.start_date);
    const periodoTexto = contract.contract_period === 'indeterminado' 
        ? 'por prazo indeterminado' 
        : `pelo período de ${contract.contract_period} meses`;
    
    const clausula2 = `CLÁUSULA 2ª - O presente contrato vigorará ${periodoTexto}, iniciando-se em ${dataInicio}.`;
    y = addJustifiedText(clausula2, y);
    y += lineHeight;
    
    // === VALOR DO ALUGUEL ===
    y = checkPageBreak(y);
    doc.setFont('helvetica', 'bold');
    doc.text('DO VALOR DO ALUGUEL', margin, y);
    y += lineHeight * 1.5;
    
    const valorAluguel = parseFloat(contract.rent_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dueDayText = contract.due_day ? `até o dia ${contract.due_day} (${numberToWords(contract.due_day).split(' ')[0]}) de cada mês` : 'mensalmente';
    const clausula3 = `CLÁUSULA 3ª - O valor mensal do aluguel é de R$ ${valorAluguel} (${numberToWords(contract.rent_value)}), a ser pago ${dueDayText}, mediante depósito/transferência bancária conforme dados fornecidos pelo LOCADOR.`;
    y = addJustifiedText(clausula3, y);
    y += lineHeight;
    
    // === CAUÇÃO (se houver) ===
    if (contract.has_deposit === 'S') {
        y = checkPageBreak(y);
        doc.setFont('helvetica', 'bold');
        doc.text('DA CAUÇÃO', margin, y);
        y += lineHeight * 1.5;
        
        const valorCaucao = parseFloat(contract.deposit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const quemPaga = contract.tenant_will_pay_deposit === 'S' 
            ? 'O LOCATÁRIO pagará ao LOCADOR a quantia de' 
            : 'Fica consignado o valor de';
        
        const clausula4 = `CLÁUSULA 4ª - ${quemPaga} R$ ${valorCaucao} (${numberToWords(contract.deposit_value)}) a título de caução, que será devolvida ao final do contrato, deduzidos eventuais débitos pendentes.`;
        y = addJustifiedText(clausula4, y);
        y += lineHeight;
    }
    
    // === FORMAS DE PAGAMENTO (apenas se houver) ===
    if (paymentMethods && paymentMethods.length > 0) {
        y = checkPageBreak(y);
        doc.setFont('helvetica', 'bold');
        doc.text('DAS FORMAS DE PAGAMENTO', margin, y);
        y += lineHeight * 1.5;
        
        doc.setFont('helvetica', 'normal');
        doc.text('O pagamento do aluguel poderá ser realizado através de:', margin, y);
        y += lineHeight * 1.5;
        
        paymentMethods.forEach((payment, index) => {
            y = checkPageBreak(y, 20);
            let methodText = `${index + 1}. `;
            
            if (payment.payment_type === 'PIX') {
                methodText += `PIX - Chave: ${payment.pix_key}`;
            } else if (payment.payment_type === 'TRANSFERENCIA') {
                const agency = payment.agency + (payment.agency_digit ? '-' + payment.agency_digit : '');
                const account = payment.account + (payment.account_digit ? '-' + payment.account_digit : '');
                methodText += `Transferência Bancária - ${payment.bank_name} - Agência: ${agency} - Conta: ${account}`;
            } else if (payment.payment_type === 'Boleto') {
                methodText += 'Boleto Bancário (a ser fornecido mensalmente)';
            } else if (payment.payment_type === 'Dinheiro') {
                methodText += 'Dinheiro (mediante recibo)';
            }
            
            const lines = doc.splitTextToSize(methodText, pageWidth - 2 * margin - 10);
            doc.text(lines, margin + 5, y);
            y += lines.length * lineHeight;
        });
        
        y += lineHeight;
    }
    
    // === OBRIGAÇÕES ===
    y = checkPageBreak(y);
    doc.setFont('helvetica', 'bold');
    doc.text('DAS OBRIGAÇÕES DO LOCATÁRIO', margin, y);
    y += lineHeight * 1.5;
    
    const clausula5 = `CLÁUSULA 5ª - São obrigações do LOCATÁRIO: a) pagar pontualmente o aluguel; b) manter o imóvel em bom estado de conservação; c) restituir o imóvel nas mesmas condições em que o recebeu; d) não realizar obras sem autorização prévia e por escrito do LOCADOR; e) comunicar imediatamente ao LOCADOR qualquer dano ou defeito verificado no imóvel.`;
    y = addJustifiedText(clausula5, y);
    y += lineHeight * 1.5;
    
    // === RESCISÃO ===
    y = checkPageBreak(y);
    doc.setFont('helvetica', 'bold');
    doc.text('DA RESCISÃO', margin, y);
    y += lineHeight * 1.5;
    
    const clausula6 = `CLÁUSULA 6ª - O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias, por escrito. Em caso de descumprimento das obrigações contratuais, a parte infratora estará sujeita às penalidades previstas em lei.`;
    y = addJustifiedText(clausula6, y);
    y += lineHeight * 1.5;
    
    // === FORO ===
    y = checkPageBreak(y);
    doc.setFont('helvetica', 'bold');
    doc.text('DO FORO', margin, y);
    y += lineHeight * 1.5;
    
    const clausula7 = `CLÁUSULA 7ª - As partes elegem o foro da comarca de ${property.city} para dirimir quaisquer dúvidas ou questões oriundas do presente contrato, renunciando expressamente a qualquer outro, por mais privilegiado que seja.`;
    y = addJustifiedText(clausula7, y);
    y += lineHeight * 2;
    
    // === ASSINATURAS ===
    y = checkPageBreak(y, 60);
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    addCenteredText(`${property.city}, ${hoje}`, y, 11, false);
    y += lineHeight * 4;
    
    // Linha para assinatura do LOCADOR
    doc.line(margin, y, pageWidth / 2 - 10, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const locadorWidth = doc.getTextWidth('LOCADOR');
    doc.text('LOCADOR', (pageWidth / 4) - (locadorWidth / 2), y);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Determinar qual documento mostrar (CPF ou CNPJ)
    let ownerDoc = '';
    if (owner.cpf && owner.cnpj) {
        ownerDoc = owner.document_type === 'cnpj' ? `CNPJ: ${formatCNPJ(owner.cnpj)}` : `CPF: ${formatCPF(owner.cpf)}`;
    } else if (owner.cpf) {
        ownerDoc = `CPF: ${formatCPF(owner.cpf)}`;
    } else if (owner.cnpj) {
        ownerDoc = `CNPJ: ${formatCNPJ(owner.cnpj)}`;
    } else if (owner.cpf_cnpj) {
        ownerDoc = `CPF/CNPJ: ${formatDocument(owner.cpf_cnpj)}`;
    }
    
    const ownerInfo = `${owner.name}${ownerDoc ? '\n' + ownerDoc : ''}`;
    const ownerLines = doc.splitTextToSize(ownerInfo, (pageWidth / 2) - 30);
    doc.text(ownerLines, margin + 10, y + lineHeight);
    
    // Linha para assinatura do LOCATÁRIO
    y -= lineHeight;
    doc.line(pageWidth / 2 + 10, y, pageWidth - margin, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const locatarioWidth = doc.getTextWidth('LOCATÁRIO');
    doc.text('LOCATÁRIO', ((pageWidth / 4) * 3) - (locatarioWidth / 2), y);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Determinar qual documento mostrar (CPF ou CNPJ)
    let tenantDoc = '';
    if (tenant.cpf && tenant.cnpj) {
        tenantDoc = tenant.document_type === 'cnpj' ? `CNPJ: ${formatCNPJ(tenant.cnpj)}` : `CPF: ${formatCPF(tenant.cpf)}`;
    } else if (tenant.cpf) {
        tenantDoc = `CPF: ${formatCPF(tenant.cpf)}`;
    } else if (tenant.cnpj) {
        tenantDoc = `CNPJ: ${formatCNPJ(tenant.cnpj)}`;
    }
    
    const tenantInfo = `${tenant.name}${tenantDoc ? '\n' + tenantDoc : ''}`;
    const tenantLines = doc.splitTextToSize(tenantInfo, (pageWidth / 2) - 30);
    doc.text(tenantLines, pageWidth / 2 + 20, y + lineHeight);
    
    return doc;
}

// Função para formatar data por extenso
function formatDateFull(dateString) {
    const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    
    const [year, month, day] = dateString.split('-');
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
}

// Função para formatar CPF
function formatCPF(cpf) {
    if (!cpf) return '';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Função para formatar CNPJ
function formatCNPJ(cnpj) {
    if (!cnpj) return '';
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Função para determinar se é CPF ou CNPJ e formatar
function formatDocument(doc) {
    if (!doc) return '';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) return formatCPF(doc);
    if (clean.length === 14) return formatCNPJ(doc);
    return doc;
}

// Função para gerar o nome do arquivo do PDF
export function generateContractFileName(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    if (!contract) return 'Contrato.pdf';
    
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    const property = appState.rentalProperties.find(p => p.id === contract.property_id);
    
    const contractNumber = contract.contract_code || 'SN';
    const tenantName = tenant ? tenant.name.toUpperCase().replace(/\s+/g, '_') : 'INQUILINO';
    const propertyNickname = property && property.nickname ? property.nickname.toUpperCase().replace(/\s+/g, '_') : '';
    
    let fileName = `CONTRATO_${contractNumber}_${tenantName}`;
    if (propertyNickname) {
        fileName += `_${propertyNickname}`;
    }
    fileName += '.pdf';
    
    return fileName;
}

// Função para converter número em extenso (COMPLETA)
function numberToWords(value) {
    const num = parseFloat(value);
    const inteiro = Math.floor(num);
    const centavos = Math.round((num - inteiro) * 100);
    
    // Arrays de nomes
    const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    
    function converterGrupo(n) {
        if (n === 0) return '';
        if (n === 100) return 'cem';
        
        let texto = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;
        
        if (c > 0) texto = centenas[c];
        
        if (d === 1) {
            if (texto) texto += ' e ';
            texto += especiais[u];
        } else {
            if (d > 0) {
                if (texto) texto += ' e ';
                texto += dezenas[d];
            }
            if (u > 0) {
                if (texto) texto += ' e ';
                texto += unidades[u];
            }
        }
        
        return texto;
    }
    
    if (inteiro === 0) {
        return centavos > 0 ? `${centavos} centavos` : 'zero reais';
    }
    
    let texto = '';
    
    // Milhões
    const milhoes = Math.floor(inteiro / 1000000);
    if (milhoes > 0) {
        texto = converterGrupo(milhoes);
        texto += milhoes === 1 ? ' milhão' : ' milhões';
    }
    
    // Milhares
    const milhares = Math.floor((inteiro % 1000000) / 1000);
    if (milhares > 0) {
        if (texto) texto += milhares < 100 && milhoes > 0 ? ' e ' : ', ';
        if (milhares === 1) {
            texto += 'mil';
        } else {
            texto += converterGrupo(milhares) + ' mil';
        }
    }
    
    // Centenas
    const resto = inteiro % 1000;
    if (resto > 0) {
        if (texto) texto += resto < 100 && (milhares > 0 || milhoes > 0) ? ' e ' : ', ';
        texto += converterGrupo(resto);
    }
    
    // Adicionar "reais"
    texto += inteiro === 1 ? ' real' : ' reais';
    
    // Centavos
    if (centavos > 0) {
        texto += ' e ' + converterGrupo(centavos);
        texto += centavos === 1 ? ' centavo' : ' centavos';
    }
    
    return texto;
}

// Função para formatar telefone
function formatPhone(phone) {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
    } else if (clean.length === 10) {
        return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
}

// Função para formatar CEP
function formatCEP(cep) {
    if (!cep) return '';
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
        return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
}
