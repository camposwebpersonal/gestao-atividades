// proposals_sand.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatInputDate, openModal, closeModal, sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';
import { exportSandProposalPDF } from './proposals_sand_pdf.js';

// URL da imagem de assinatura de e-mail
const EMAIL_SIGNATURE_IMAGE_URL = "https://res.cloudinary.com/ddobrlzep/image/upload/mailsign/mailsign.jpg";
// URL do backend PHP para envio de emails
const PHP_BACKEND_EMAIL_URL = "https://pbatransportes.com.br/proj/send_email.php";

// Elementos para Propostas de Areia
const proposalsSection = document.getElementById('proposals-section');
const sandProposalMyCompanySelect = document.getElementById('sand-proposal-my-company');
const sandProposalClientCompanySelect = document.getElementById('sand-proposal-client-company');
const sandProposalDateAutoInput = document.getElementById('sand-proposal-date-auto');
const sandProposalDateManualInput = document.getElementById('sand-proposal-date-manual');
const sandProposalQuantityInput = document.getElementById('sand-proposal-quantity');
const sandProposalDeliveryLocationInput = document.getElementById('sand-proposal-delivery-location');
const sandProposalDeliveryDeadlineInput = document.getElementById('sand-proposal-delivery-deadline');
const sandProposalFreightTypeSelect = document.getElementById('sand-proposal-freight-type');
const sandProposalPriceM3Input = document.getElementById('sand-proposal-price-m3');
const sandProposalMaterialDescriptionInput = document.getElementById('sand-proposal-material-description');
const sandProposalNotesTextarea = document.getElementById('sand-proposal-notes');
const sandProposalManualPickupLocationInput = document.getElementById('sand-proposal-manual-pickup-location');
const sandProposalShowFreightTypeCheckbox = document.getElementById('sand-proposal-show-freight-type'); // Novo elemento
const sandProposalIncludeCnpjClientPdfCheckbox = document.getElementById('sand-proposal-include-cnpj-client-pdf'); // NOVO: Checkbox CNPJ Cliente
const sandProposalEmailsTextarea = document.getElementById('sand-proposal-emails');
const sandProposalCcEmailsTextarea = document.getElementById('sand-proposal-cc-emails');
const sandProposalBccEmailsTextarea = document.getElementById('sand-proposal-bcc-emails');
const saveSandProposalBtn = document.getElementById('save-sand-proposal-btn');
const sandProposalsTableBody = document.querySelector('#sand-proposals-table tbody');

// Flag para controlar se as propostas de areia já estão sendo carregadas/renderizadas
let isSandProposalsLoading = false;

/**
 * Helper para obter a data local atual no formato 'YYYY-MM-DD'.
 * Isso garante que a data represente o dia do calendário local,
 * independentemente do fuso horário ao ser armazenada ou exibida.
 */
const getLocalDateString = () => {
    const now = new Date();
    // Obtém o offset do fuso horário em minutos e converte para milissegundos
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    // Cria um novo objeto Date que representa a data local à meia-noite UTC
    // Ao subtrair o offset, a data UTC "corresponde" ao dia local
    const localDateAtUTC = new Date(now.getTime() - offsetMs);
    // Retorna a string YYYY-MM-DD
    return localDateAtUTC.toISOString().slice(0, 10);
};

/**
 * Inicializa a seção de Propostas de Areia.
 */
export const initSandProposals = async () => {
    // Popular dropdowns para Propostas de Areia
    if (sandProposalMyCompanySelect) {
        sandProposalMyCompanySelect.innerHTML = '<option value="">Selecione a Empresa Fornecedora</option>' +
            [...appState.my_companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
            .map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        
        // Selecionar por padrão a empresa "MINERADORA SÃO JORGE"
        const mineradoraSaoJorge = appState.my_companies.find(m => m.name === 'MINERADORA SÃO JORGE');
        if (mineradoraSaoJorge) {
            sandProposalMyCompanySelect.value = mineradoraSaoJorge.id;
        }
    }
    if (sandProposalClientCompanySelect) {
        // Ordena as empresas cliente por created_at em ordem decrescente (mais recente primeiro)
        const sortedClientCompanies = [...appState.client_companies].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'pt-BR')
        );
        
        sandProposalClientCompanySelect.innerHTML = '<option value="">Selecione a Empresa Cliente</option>' +
            sortedClientCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        // Selecionar por padrão a última empresa cadastrada (primeira no array ordenado)
        if (sortedClientCompanies.length > 0) {
            sandProposalClientCompanySelect.value = sortedClientCompanies[0].id;
        }
    }

    // Inicializar datas com o formato correto
    if (sandProposalDateAutoInput) {
        sandProposalDateAutoInput.value = getLocalDateString();
    }

    // Event Listeners para Propostas de Areia
    // Adicionados apenas uma vez para evitar duplicação de listeners
    if (!sandProposalDateManualInput._hasEventListener) { // Flag para evitar re-registro
        if (sandProposalDateManualInput) {
            sandProposalDateManualInput.addEventListener('change', () => {
                sandProposalDateAutoInput.disabled = !!sandProposalDateManualInput.value;
            });
            sandProposalDateManualInput._hasEventListener = true;
        }
    }
    
    if (!saveSandProposalBtn._hasEventListener) { // Flag para evitar re-registro
        if (saveSandProposalBtn) {
            saveSandProposalBtn.addEventListener('click', saveSandProposal);
            saveSandProposalBtn._hasEventListener = true;
        }
    }

    // Carregar propostas existentes
    await loadAndRenderSandProposals();
};

/**
 * Carrega e renderiza as propostas de areia existentes.
 */
const loadAndRenderSandProposals = async () => {
    // Se já estiver carregando, aborta a chamada para evitar duplicação
    if (isSandProposalsLoading) {
        return;
    }
    isSandProposalsLoading = true; // Define a flag para true

    showSpinner();
    sandProposalsTableBody.innerHTML = ''; // Limpa o conteúdo existente da tabela antes de renderizar

    try {
        // Certifique-se de que my_companies e client_companies estão sendo carregados com todos os campos
        // NOVO: Adiciona 'created_at' para ordenação
        const proposals = await apiClient.fetchData('sand_proposals', '*, client_companies(name, cnpj), my_companies(*)'); 
        
        // NOVO: Ordena as propostas por created_at em ordem decrescente (mais recente primeiro)
        proposals.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB.getTime() - dateA.getTime();
        });

        appState.sand_proposals = proposals;

        if (proposals.length === 0) {
            sandProposalsTableBody.innerHTML = `<tr><td colspan="6">Nenhuma proposta de areia cadastrada.</td></tr>`;
            hideSpinner();
            isSandProposalsLoading = false; // Reseta a flag
            return;
        }

        proposals.forEach(proposal => {
            const row = document.createElement('tr');
            const clientName = proposal.client_companies ? proposal.client_companies.name : 'N/A';
            const myCompanyName = proposal.my_companies ? proposal.my_companies.name : 'N/A';
            const proposalDate = (proposal.manual_date || proposal.proposal_date) ? new Date((proposal.manual_date || proposal.proposal_date) + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
            // Garante que price_m3 seja um número antes de formatar
            const priceM3 = formatCurrency(parseFloat(proposal.price_m3) || 0); 

            row.innerHTML = `
                <td data-label="Data">${proposalDate}</td>
                <td data-label="Fornecedor">${myCompanyName}</td>
                <td data-label="Cliente">${clientName}</td>
                <td data-label="Local Entrega">${proposal.delivery_location || 'N/A'}</td>
                <td data-label="Valor M³">${priceM3}</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${proposal.id}" data-action="edit-sand-proposal">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${proposal.id}" data-action="delete-sand-proposal">Excluir</button>
                    <button class="btn btn-primary btn-sm" data-id="${proposal.id}" data-action="generate-sand-pdf">Gerar PDF</button>
                    <button class="btn btn-success btn-sm" data-id="${proposal.id}" data-action="whatsapp-sand-pdf" title="Enviar via WhatsApp">📱 WhatsApp</button>
                    <button class="btn btn-info btn-sm" data-id="${proposal.id}" data-action="send-sand-email">📧 Email</button>
                </td>
            `;
            sandProposalsTableBody.appendChild(row);
        });

        // Adiciona event listeners para os novos botões criados
        sandProposalsTableBody.querySelectorAll('[data-action="edit-sand-proposal"]').forEach(btn => {
            btn.addEventListener('click', (e) => editSandProposal(e.target.dataset.id));
        });
        sandProposalsTableBody.querySelectorAll('[data-action="delete-sand-proposal"]').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSandProposal(e.target.dataset.id));
        });
        sandProposalsTableBody.querySelectorAll('[data-action="generate-sand-pdf"]').forEach(btn => {
            btn.addEventListener('click', (e) => generateSandProposalPDF(e.target.dataset.id));
        });
        sandProposalsTableBody.querySelectorAll('[data-action="whatsapp-sand-pdf"]').forEach(btn => {
            btn.addEventListener('click', (e) => sendSandProposalViaWhatsApp(e.target.dataset.id));
        });
        sandProposalsTableBody.querySelectorAll('[data-action="send-sand-email"]').forEach(btn => {
            btn.addEventListener('click', (e) => handleSendSandProposalEmail(e.target.dataset.id));
        });

    } catch (error) {
        console.error('Erro ao carregar propostas de areia:', error);
        // Exibir um modal em vez de alert
        showModal('Erro ao Carregar Propostas', 'Não foi possível carregar as propostas de areia. Detalhes: ' + error.message);
    } finally {
        hideSpinner();
        isSandProposalsLoading = false; // Reseta a flag ao finalizar
    }
};

/**
 * Salva uma nova proposta de areia ou atualiza uma existente.
 */
const saveSandProposal = async () => {
    showSpinner();
    const proposalId = saveSandProposalBtn.dataset.id || null;

    const myCompanyId = sandProposalMyCompanySelect.value;
    const clientCompanyId = sandProposalClientCompanySelect.value;
    const proposalDateAuto = sandProposalDateAutoInput.value;
    const proposalDateManual = sandProposalDateManualInput.value || null;
    const quantity = sandProposalQuantityInput.value ? parseFloat(sandProposalQuantityInput.value) : null; 
    const deliveryLocation = sandProposalDeliveryLocationInput.value;
    const deliveryDeadline = sandProposalDeliveryDeadlineInput.value || null;
    const freightType = sandProposalFreightTypeSelect.value;
    const priceM3 = sandProposalPriceM3Input.value ? parseFloat(sandProposalPriceM3Input.value) : null;
    const materialDescription = sandProposalMaterialDescriptionInput.value || null;
    const notes = sandProposalNotesTextarea.value || null;
    const manualPickupLocation = sandProposalManualPickupLocationInput.value || null;
    const showFreightTypeInPdf = sandProposalShowFreightTypeCheckbox.checked;
    const includeCnpjClientPdf = sandProposalIncludeCnpjClientPdfCheckbox.checked;

    // Validação ajustada: 'quantity' e 'price_m3' não são mais obrigatórios
    if (!myCompanyId || !clientCompanyId || !deliveryLocation || !freightType) {
        showModal('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios (Empresa Fornecedora, Empresa Cliente, Local de Entrega e Tipo de Frete).');
        hideSpinner();
        return;
    }

    const proposalData = {
        my_company_id: myCompanyId,
        client_company_id: clientCompanyId,
        proposal_date: proposalDateAuto,
        manual_date: proposalDateManual,
        quantity: quantity,
        delivery_location: deliveryLocation,
        delivery_deadline: deliveryDeadline,
        freight_type: freightType,
        price_m3: priceM3,
        material_description: materialDescription,
        notes: notes,
        manual_pickup_location: manualPickupLocation,
        show_freight_type_in_pdf: showFreightTypeInPdf,
        include_cnpj_client_pdf: includeCnpjClientPdf,
        email_recipients: sandProposalEmailsTextarea ? sandProposalEmailsTextarea.value.trim() : null,
        email_cc: sandProposalCcEmailsTextarea ? sandProposalCcEmailsTextarea.value.trim() : null,
        email_bcc: sandProposalBccEmailsTextarea ? sandProposalBccEmailsTextarea.value.trim() : null
    };

    try {
        if (proposalId) {
            await apiClient.updateItem('sand_proposals', proposalId, proposalData);
            showModal('Sucesso!', 'Proposta de areia atualizada com sucesso!');
        } else {
            await apiClient.addItem('sand_proposals', proposalData);
            showModal('Sucesso!', 'Proposta de areia salva com sucesso!');
        }
        resetSandProposalForm();
        loadAndRenderSandProposals();
    } catch (error) {
        console.error('Erro ao salvar proposta de areia:', error);
        showModal('Erro ao Salvar Proposta', `Erro ao salvar proposta de areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Edita uma proposta de areia existente.
 * @param {string} id - ID da proposta a ser editada.
 */
const editSandProposal = (id) => {
    const proposal = appState.sand_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada.');
        return;
    }

    sandProposalMyCompanySelect.value = proposal.my_company_id;
    sandProposalClientCompanySelect.value = proposal.client_company_id;
    sandProposalDateAutoInput.value = new Date(proposal.proposal_date + 'T00:00:00').toISOString().slice(0, 10);
    sandProposalDateManualInput.value = proposal.manual_date ? new Date(proposal.manual_date + 'T00:00:00').toISOString().slice(0, 10) : '';
    sandProposalQuantityInput.value = proposal.quantity || '';
    sandProposalDeliveryLocationInput.value = proposal.delivery_location;
    sandProposalDeliveryDeadlineInput.value = proposal.delivery_deadline || '';
    sandProposalFreightTypeSelect.value = proposal.freight_type;
    sandProposalPriceM3Input.value = proposal.price_m3 || '';
    sandProposalMaterialDescriptionInput.value = proposal.material_description || '';
    sandProposalNotesTextarea.value = proposal.notes || '';
    sandProposalManualPickupLocationInput.value = proposal.manual_pickup_location || '';
    sandProposalShowFreightTypeCheckbox.checked = proposal.show_freight_type_in_pdf !== undefined ? proposal.show_freight_type_in_pdf : true;
    sandProposalIncludeCnpjClientPdfCheckbox.checked = proposal.include_cnpj_client_pdf !== undefined ? proposal.include_cnpj_client_pdf : false;

    // Preencher campos de email ao editar
    if (sandProposalEmailsTextarea) sandProposalEmailsTextarea.value = proposal.email_recipients || '';
    if (sandProposalCcEmailsTextarea) sandProposalCcEmailsTextarea.value = proposal.email_cc || '';
    if (sandProposalBccEmailsTextarea) sandProposalBccEmailsTextarea.value = proposal.email_bcc || '';

    // Desabilitar/habilitar campo automático conforme o manual
    sandProposalDateAutoInput.disabled = !!sandProposalDateManualInput.value;

    saveSandProposalBtn.dataset.id = id;
    saveSandProposalBtn.textContent = 'Atualizar Proposta';
    proposalsSection.scrollIntoView({ behavior: 'smooth' });
};

/**
 * Exclui uma proposta de areia.
 * @param {string} id - ID da proposta a ser excluída.
 */
const deleteSandProposal = async (id) => {
    const confirmDelete = await new Promise(resolve => {
        showModal('Confirmar Exclusão', 'Tem certeza que deseja excluir esta proposta de areia?<br><br><button id="confirm-delete-btn" class="btn btn-danger">Sim, Excluir</button> <button id="cancel-delete-btn" class="btn btn-secondary">Cancelar</button>');
        document.getElementById('confirm-delete-btn').onclick = () => { resolve(true); hideModal(); };
        document.getElementById('cancel-delete-btn').onclick = () => { resolve(false); hideModal(); };
    });

    if (!confirmDelete) {
        return;
    }
    showSpinner();
    try {
        await apiClient.deleteItem('sand_proposals', id);
        showModal('Sucesso!', 'Proposta de areia excluída com sucesso!');
        loadAndRenderSandProposals();
    } catch (error) {
        console.error('Erro ao excluir proposta de areia:', error);
        showModal('Erro ao Excluir Proposta', `Erro ao excluir proposta de areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Gera o PDF de uma proposta de areia.
 * @param {string} id - ID da proposta a ser gerada.
 */
const generateSandProposalPDF = (id) => {
    const proposal = appState.sand_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada para gerar PDF.');
        return;
    }
    
    // Buscar a empresa completa para passar para o PDF
    const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
    const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);

    if (!myCompany) {
        showModal('Dados Incompletos', 'Dados da empresa fornecedora não encontrados para gerar PDF.');
        return;
    }

    const dataForPDF = {
        ...proposal,
        my_company: myCompany,
        client_company: clientCompany
    };

    exportSandProposalPDF(dataForPDF);
};

/**
 * Reseta o formulário de proposta de areia.
 */
const resetSandProposalForm = () => {
    sandProposalMyCompanySelect.value = '';
    sandProposalClientCompanySelect.value = '';
    sandProposalDateAutoInput.value = getLocalDateString();
    sandProposalDateManualInput.value = '';
    sandProposalQuantityInput.value = '';
    sandProposalDeliveryLocationInput.value = '';
    sandProposalDeliveryDeadlineInput.value = '';
    sandProposalFreightTypeSelect.value = 'CIF';
    sandProposalPriceM3Input.value = '';
    sandProposalMaterialDescriptionInput.value = 'AREIA, CARGA/TRANSPORTE';
    sandProposalNotesTextarea.value = '';
    sandProposalManualPickupLocationInput.value = '';
    sandProposalShowFreightTypeCheckbox.checked = true;
    sandProposalIncludeCnpjClientPdfCheckbox.checked = false;
    sandProposalDateAutoInput.disabled = false;
    saveSandProposalBtn.dataset.id = '';
    saveSandProposalBtn.textContent = 'Salvar Proposta';
};

// Funções auxiliares para modal (substituindo alert/confirm nativos)
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
            hideModal();
        }
    }
}

function hideModal() {
    const modal = document.getElementById('generic-modal');
    modal.style.display = 'none';
}

/**
 * Converte Blob para Base64
 */
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Manipula o clique no botão de enviar email da proposta de areia
 */
const handleSendSandProposalEmail = async (proposalId) => {
    showSpinner();
    try {
        const proposal = appState.sand_proposals.find(p => p.id == proposalId);
        if (!proposal) {
            alert('Proposta não encontrada.');
            return;
        }

        // Enriquecer proposta com dados completos de my_company e client_company
        const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
        const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);

        if (!myCompany) {
            alert('Dados da empresa fornecedora não encontrados.');
            hideSpinner();
            return;
        }

        const dataForPDF = {
            ...proposal,
            my_company: myCompany,
            client_company: clientCompany
        };

        // Gerar o PDF da proposta
        const pdfBlob = await exportSandProposalPDF(dataForPDF, true); // true para retornar blob
        
        if (!pdfBlob) {
            alert('Não foi possível gerar o PDF da proposta.');
            return;
        }

        // Usar os dados da empresa cliente já buscados anteriormente
        const clientName = clientCompany?.name || 'Cliente';
        
        // Verificar o material da descrição
        const materialDescription = (proposal.material_description || 'AREIA, CARGA/TRANSPORTE').toUpperCase();
        
        // Determinar o nome do material para o título
        let materialName = 'AREIA';
        if (materialDescription !== 'AREIA, CARGA/TRANSPORTE') {
            // Usa a descrição do material como está
            materialName = materialDescription;
        }
        
        // Verificar se o nome da empresa é genérico
        const isGenericName = clientName.toUpperCase().includes('PROPOSTA DE AREIA');
        
        // Data de hoje formatada
        const today = new Date().toLocaleDateString('pt-BR');
        
        // Montar o assunto do email
        const emailSubject = isGenericName 
            ? `PROPOSTA DE FORNECIMENTO DE ${materialName} - ${today}`
            : `PROPOSTA DE FORNECIMENTO DE ${materialName} - ${clientName} - ${today}`;
        
        // Corpo do email em texto puro
        const emailBodyText = `Prezado(s)\n\n` +
                              `Segue proposta de fornecimento de ${materialName.toLowerCase()} como solicitado.\n\n` +
                              `Permanecemos à disposição para quaisquer esclarecimentos.\n\n` +
                              `--\n\n` +
                              `Atenciosamente,\n\n` +
                              `RICARDO CAMPOS - PBA`;

        // Corpo do email em HTML
        const emailBodyHtml = `
            <p>Prezado(s)</p>
            <p>Segue proposta de fornecimento de ${materialName.toLowerCase()} como solicitado.</p>
            <p>Permanecemos à disposição para quaisquer esclarecimentos.</p>
            <p>--</p>
            <p>Atenciosamente,</p>
            <p>RICARDO CAMPOS - PBA</p>
            <img src="${EMAIL_SIGNATURE_IMAGE_URL}" alt="Assinatura de E-mail PBA Transportes" style="max-width: 100%; height: auto;">
        `;

        // Extrair emails da proposta
        const defaultRecipients = proposal.email_recipients ? proposal.email_recipients.split(/[\s,;]+/).filter(e => e) : [];
        const defaultCc = proposal.email_cc ? proposal.email_cc.split(/[\s,;]+/).filter(e => e) : [];
        const defaultBcc = proposal.email_bcc ? proposal.email_bcc.split(/[\s,;]+/).filter(e => e) : [];

        openEmailPreparationModalSand(proposal, pdfBlob, emailSubject, emailBodyText, emailBodyHtml, defaultRecipients, defaultCc, defaultBcc);

    } catch (error) {
        console.error('Erro ao preparar email da proposta:', error);
        alert(`Erro ao preparar email: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Abre modal para preparação e envio de email de proposta de areia
 */
const openEmailPreparationModalSand = (proposal, pdfBlob, subject, bodyText, bodyHtml, defaultRecipients, defaultCc, defaultBcc) => {
    const defaultRecipientsString = defaultRecipients.join(', ');
    const defaultCcString = defaultCc.join(', ');
    const defaultBccString = defaultBcc.join(', ');

    const modalContentHtml = `
        <div style="max-width: 700px; padding: 20px;">
            <h3>Preparar E-mail da Proposta</h3>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-recipients">Para:</label>
                <input type="text" id="email-recipients" class="form-control" value="${defaultRecipientsString}" placeholder="emails@destino.com.br, outro@email.com">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-cc">CC (Cópia):</label>
                <input type="text" id="email-cc" class="form-control" value="${defaultCcString}" placeholder="cc@email.com">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-bcc">BCC (Cópia Oculta):</label>
                <input type="text" id="email-bcc" class="form-control" value="${defaultBccString}" placeholder="bcc@email.com">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-subject">Assunto:</label>
                <input type="text" id="email-subject" class="form-control" value="${subject}">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-body">Corpo do E-mail:</label>
                <textarea id="email-body" class="form-control" rows="10" style="resize: vertical;">${bodyText}</textarea>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <p>Assinatura:</p>
                <img src="${EMAIL_SIGNATURE_IMAGE_URL}" alt="Assinatura" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px;">
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px;">
                <button id="send-direct-email-btn" class="btn btn-primary">
                    🚀 Enviar Email Direto
                </button>
                <button id="download-pdf-attachment-btn" class="btn btn-success">
                    ⬇️ Baixar PDF
                </button>
                <button id="copy-email-body-btn" class="btn btn-info">
                    📋 Copiar Corpo
                </button>
                <button id="close-email-modal-btn" class="btn btn-danger">
                    ❌ Fechar
                </button>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContentNode = tempDiv.firstElementChild;

    openModal('Enviar E-mail', modalContentNode);

    const recipientsInput = modalContentNode.querySelector('#email-recipients');
    const ccInput = modalContentNode.querySelector('#email-cc');
    const bccInput = modalContentNode.querySelector('#email-bcc');
    const subjectInput = modalContentNode.querySelector('#email-subject');
    const bodyTextarea = modalContentNode.querySelector('#email-body');
    const downloadPdfBtn = modalContentNode.querySelector('#download-pdf-attachment-btn');
    const copyBodyBtn = modalContentNode.querySelector('#copy-email-body-btn');
    const closeEmailModalBtn = modalContentNode.querySelector('#close-email-modal-btn');
    const sendDirectEmailBtn = modalContentNode.querySelector('#send-direct-email-btn');

    downloadPdfBtn.addEventListener('click', () => {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `Proposta_Areia_${proposal.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pdfUrl);
        alert('PDF baixado com sucesso!');
    });

    copyBodyBtn.addEventListener('click', () => {
        const textToCopy = bodyTextarea.value;
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('Corpo do e-mail copiado!');
        });
    });

    closeEmailModalBtn.addEventListener('click', () => {
        closeModal();
    });

    sendDirectEmailBtn.addEventListener('click', async () => {
        showSpinner();
        try {
            const recipients = recipientsInput.value.split(',').map(e => e.trim()).filter(e => e !== '');
            if (recipients.length === 0) {
                alert('Por favor, insira pelo menos um destinatário.');
                hideSpinner();
                return;
            }

            const ccRecipients = ccInput.value.split(',').map(e => e.trim()).filter(e => e !== '');
            // Adicionar emails automáticos ao CC
            if (!ccRecipients.includes('pbatransportes.sertania@gmail.com')) {
                ccRecipients.push('pbatransportes.sertania@gmail.com');
            }
            if (!ccRecipients.includes('pbatransportes@bol.com.br')) {
                ccRecipients.push('pbatransportes@bol.com.br');
            }
            const bccRecipients = bccInput.value.split(',').map(e => e.trim()).filter(e => e !== '');

            const attachmentBase64 = await blobToBase64(pdfBlob);
            const attachmentFileName = `Proposta_Areia_${proposal.id}.pdf`;

            // Atualizar bodyHtml com o conteúdo editado do textarea
            const updatedBodyHtml = bodyTextarea.value.replace(/\n/g, '<br>') + 
                `<br><br><img src="${EMAIL_SIGNATURE_IMAGE_URL}" alt="Assinatura" style="max-width: 100%; height: auto;">`;

            const payload = {
                to: recipients.join(','),
                cc: ccRecipients.length > 0 ? ccRecipients.join(',') : null,
                bcc: bccRecipients.length > 0 ? bccRecipients.join(',') : null,
                subject: subjectInput.value,
                bodyHtml: updatedBodyHtml,
                attachmentBase64: attachmentBase64,
                attachmentFileName: attachmentFileName
            };

            const response = await fetch(PHP_BACKEND_EMAIL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                mode: 'cors'
            });

            const result = await response.json();

            if (result.status === 'success') {
                alert('E-mail enviado com sucesso!');
                closeModal();
            } else {
                alert(`Erro ao enviar: ${result.message}`);
            }
        } catch (error) {
            console.error('Erro ao enviar email:', error);
            alert(`Erro ao enviar email: ${error.message}`);
        } finally {
            hideSpinner();
        }
    });
};

/**
 * Envia proposta de areia via WhatsApp (gera PDF, faz upload Drive e envia link)
 */
const sendSandProposalViaWhatsApp = async (id) => {
    const proposal = appState.sand_proposals.find(p => p.id == id);
    if (!proposal) {
        alert('Proposta não encontrada!');
        return;
    }

    try {
        showSpinner();
        
        // 1. Buscar dados completos
        const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
        const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);
        const clientName = clientCompany ? clientCompany.name : 'Cliente';
        
        if (!myCompany) {
            alert('Dados da empresa fornecedora não encontrados!');
            hideSpinner();
            return;
        }

        const dataForPDF = {
            ...proposal,
            my_company: myCompany,
            client_company: clientCompany
        };

        // 2. Gerar PDF como blob
        const pdfBlob = await exportSandProposalPDF(dataForPDF, true);
        
        if (!pdfBlob) {
            alert('Erro ao gerar PDF!');
            hideSpinner();
            return;
        }

        // 3. Fazer upload para Google Drive
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        
        reader.onloadend = async () => {
            try {
                const base64Data = reader.result;
                const proposalDate = new Date(proposal.proposal_date).toLocaleDateString('pt-BR').replace(/\//g, '_');
                const fileName = `PROPOSTA_Areia_${clientName}_${proposalDate}.pdf`;
                
                const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pdfData: base64Data,
                        fileName: fileName,
                        workName: clientName,
                        companyName: myCompany.name || 'PBA',
                        bmLabel: 'PROPOSTA',
                        dateRange: new Date().toLocaleDateString('pt-BR')
                    })
                });

                const result = await response.json();
                
                if (result.success && result.fileId) {
                    // 4. Enviar para WhatsApp com link do Drive
                    const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                    const message = `📄 Olá! Segue a proposta de fornecimento de areia para *${clientName}*.\n\n🔗 Link do PDF:\n${driveLink}\n\nQualquer dúvida, estamos à disposição!`;
                    const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=${encodeURIComponent(message)}`;
                    
                    window.open(whatsappLink, '_blank');
                } else {
                    alert('❌ Erro ao fazer upload para o Google Drive: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('❌ Erro:', error);
                alert('❌ Erro ao processar: ' + error.message);
            } finally {
                hideSpinner();
            }
        };
        
        reader.onerror = () => {
            alert('❌ Erro ao ler o arquivo PDF');
            hideSpinner();
        };
        
    } catch (error) {
        console.error('❌ Erro ao enviar via WhatsApp:', error);
        alert('❌ Erro: ' + error.message);
        hideSpinner();
    }
};