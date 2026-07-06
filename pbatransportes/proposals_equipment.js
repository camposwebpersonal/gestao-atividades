// proposals_equipment.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatInputDate, openModal, closeModal, sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';
import { exportEquipmentProposalPDF } from './proposals_equipment_pdf.js?v=20260302020000';

// URL da imagem de assinatura de e-mail
const EMAIL_SIGNATURE_IMAGE_URL = "https://res.cloudinary.com/ddobrlzep/image/upload/mailsign/mailsign.jpg";
// URL do backend PHP para envio de emails
const PHP_BACKEND_EMAIL_URL = "https://pbatransportes.com.br/proj/send_email.php";

// Elementos para Propostas de Equipamentos
const proposalsSection = document.getElementById('proposals-section');
const equipmentProposalClientCompanySelect = document.getElementById('equipment-proposal-client-company');
const equipmentProposalMyCompanySelect = document.getElementById('equipment-proposal-my-company');
const equipmentProposalDateInput = document.getElementById('equipment-proposal-date');
const equipmentProposalCnpjInput = document.getElementById('equipment-proposal-cnpj');
const equipmentProposalNameComplementInput = document.getElementById('equipment-proposal-name-complement');
const equipmentProposalOwnerNameDisplay = document.getElementById('equipment-proposal-owner-name-display');
const equipmentProposalOwnerPhoneDisplay = document.getElementById('equipment-proposal-owner-phone-display');
const equipmentProposalItemsContainer = document.getElementById('equipment-proposal-items-container');
const addEquipmentProposalItemBtn = document.getElementById('add-equipment-proposal-item-btn');
const equipmentProposalObservationsTextarea = document.getElementById('equipment-proposal-observations');
const equipmentProposalEmailsTextarea = document.getElementById('equipment-proposal-emails');
const equipmentProposalCcEmailsTextarea = document.getElementById('equipment-proposal-cc-emails');
const equipmentProposalBccEmailsTextarea = document.getElementById('equipment-proposal-bcc-emails');
const saveEquipmentProposalBtn = document.getElementById('save-equipment-proposal-btn');
const equipmentProposalsTableBody = document.querySelector('#equipment-proposals-table tbody');

// Novos campos para valores padrão de mobilização/desmobilização e franquia
const defaultMobilizationRollingInput = document.getElementById('default-mobilization-rolling');
const defaultDemobilizationRollingInput = document.getElementById('default-demobilization-rolling');
const defaultMobilizationNonRollingInput = document.getElementById('default-mobilization-non-rolling');
const defaultDemobilizationNonRollingInput = document.getElementById('default-demobilization-non-rolling');
const defaultMinGuaranteedHoursInput = document.getElementById('default-min-guaranteed-hours');

// Checkboxes para controlar a exibição no PDF (NOVO)
const addQuantityCheckbox = document.getElementById('add-quantity-checkbox');
const includeTermsPdfCheckbox = document.getElementById('include-terms-pdf-checkbox');
const includeImagesPdfCheckbox = document.getElementById('include-images-pdf-checkbox');
const includeCnpjPdfCheckbox = document.getElementById('include-cnpj-pdf-checkbox'); // NOVO: Checkbox para incluir CNPJ no PDF

// NOVOS: Checkboxes e selects para custos gerais da proposta
const includeGeneralFoodCheckbox = document.getElementById('include-general-food-checkbox');
const generalFoodResponsibleSelect = document.getElementById('general-food-responsible-select');
const includeGeneralLodgingCheckbox = document.getElementById('include-general-lodging-checkbox');
const generalLodgingResponsibleSelect = document.getElementById('general-lodging-responsible-select');
const includeGeneralFuelCheckbox = document.getElementById('include-general-fuel-checkbox');
const generalFuelResponsibleSelect = document.getElementById('general-fuel-responsible-select');
const includeGeneralOperatorCheckbox = document.getElementById('include-general-operator-checkbox');


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
 * Inicializa a seção de Propostas de Equipamentos.
 */
export const initEquipmentProposals = async () => {
    // Garante que os tipos de equipamento estão carregados para resolver nomes no combobox
    if (!appState.equipment_types || appState.equipment_types.length === 0) {
        try {
            const equipmentTypesData = await apiClient.fetchData('equipment_types', 'id, name, short_name');
            appState.equipment_types = equipmentTypesData;
        } catch (e) {
            console.error('Falha ao carregar tipos de equipamentos:', e);
        }
    }

    // ✅ DEPOIS (com ordenação cronológica inversa - mais recentes primeiro):
    if (equipmentProposalClientCompanySelect) {
        // Ordenar empresas clientes: mais recentes primeiro (por ID decrescente)
        // Assumindo que IDs maiores = cadastros mais recentes
        const sortedClientCompanies = [...appState.client_companies].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'pt-BR')
        );
        
        equipmentProposalClientCompanySelect.innerHTML = '<option value="">Selecione a Empresa Cliente</option>' + 
            sortedClientCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
        // Selecionar por padrão a última empresa cadastrada (primeira no array ordenado)
        if (sortedClientCompanies.length > 0) {
            equipmentProposalClientCompanySelect.value = sortedClientCompanies[0].id;
            // Preencher automaticamente o CNPJ da empresa selecionada por padrão
            if (equipmentProposalCnpjInput) {
                equipmentProposalCnpjInput.value = sortedClientCompanies[0].cnpj || '';
            }
        }
    
        // NOVO: Adiciona o event listener para preencher o CNPJ automaticamente
        equipmentProposalClientCompanySelect.addEventListener('change', () => {
            const selectedCompanyId = equipmentProposalClientCompanySelect.value;
            const selectedCompany = appState.client_companies.find(c => c.id == selectedCompanyId);
            if (equipmentProposalCnpjInput) {
                // Preenche o campo CNPJ com o valor do cadastro da empresa cliente
                equipmentProposalCnpjInput.value = selectedCompany?.cnpj || '';
            }
        });
    }
    if (equipmentProposalMyCompanySelect) {
        equipmentProposalMyCompanySelect.innerHTML = '<option value="">Selecione Minha Empresa</option>' +
            [...appState.my_companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
            .map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        
        // Selecionar por padrão a empresa "PBA TRANSPORTES"
        const pbaTransportes = appState.my_companies.find(m => m.name === 'PBA TRANSPORTES');
        if (pbaTransportes) {
            equipmentProposalMyCompanySelect.value = pbaTransportes.id;
        }
    }

    // Define a data do input para a data local correta ao iniciar
    if (equipmentProposalDateInput) {
        equipmentProposalDateInput.value = getLocalDateString();
    }

    if (addEquipmentProposalItemBtn) {
        addEquipmentProposalItemBtn.addEventListener('click', addEquipmentProposalItemRow);
    }
    if (saveEquipmentProposalBtn) {
        saveEquipmentProposalBtn.addEventListener('click', saveEquipmentProposal);
    }

    if (equipmentProposalMyCompanySelect) {
        equipmentProposalMyCompanySelect.addEventListener('change', () => {
            const selectedCompanyId = equipmentProposalMyCompanySelect.value;
            const selectedCompany = appState.my_companies.find(m => m.id == selectedCompanyId);
            if (equipmentProposalOwnerNameDisplay) {
                equipmentProposalOwnerNameDisplay.textContent = selectedCompany?.responsible_owner_name || 'Não informado';
            }
            if (equipmentProposalOwnerPhoneDisplay) {
                equipmentProposalOwnerPhoneDisplay.textContent = selectedCompany?.responsible_owner_phone || 'Não informado';
            }
        });
    }

    // REMOVIDO: Event listeners para os campos de valores padrão de mobilização/desmobilização.
    // Eles agora serão aplicados apenas quando o equipamento for selecionado/alterado.

    // Permanece o event listener para a franquia mínima, pois este pode ser aplicado a qualquer momento.
    defaultMinGuaranteedHoursInput?.addEventListener('input', applyDefaultMinGuaranteedHours);

    // NOVO: Event listeners para as checkboxes de controle do PDF
    if (addQuantityCheckbox) {
        addQuantityCheckbox.addEventListener('change', toggleQuantityInputs);
    }
    // As outras checkboxes (includeTermsPdfCheckbox, includeImagesPdfCheckbox, includeCnpjPdfCheckbox)
    // não precisam de listeners aqui, pois sua lógica é apenas para salvar e carregar o estado.

    // NOVO: Event listeners para as novas checkboxes de custos gerais
    if (includeGeneralFoodCheckbox) {
        includeGeneralFoodCheckbox.addEventListener('change', () => {
            generalFoodResponsibleSelect.disabled = !includeGeneralFoodCheckbox.checked;
        });
    }
    if (includeGeneralLodgingCheckbox) {
        includeGeneralLodgingCheckbox.addEventListener('change', () => {
            generalLodgingResponsibleSelect.disabled = !includeGeneralLodgingCheckbox.checked;
        });
    }
    if (includeGeneralFuelCheckbox) {
        includeGeneralFuelCheckbox.addEventListener('change', () => {
            generalFuelResponsibleSelect.disabled = !includeGeneralFuelCheckbox.checked;
        });
    }

    await loadAndRenderEquipmentProposals();

    // Garante que os campos de quantidade estejam visíveis/ocultos corretamente ao carregar a página
    if (equipmentProposalItemsContainer && equipmentProposalItemsContainer.children.length === 0) {
        addEquipmentProposalItemRow();
    }
    toggleQuantityInputs(); // Chama para ajustar a visibilidade inicial
};

/**
 * Aplica os valores padrão de mobilização/desmobilização a UM item específico, se o campo estiver vazio.
 * Esta função agora aceita o elemento da linha do item como argumento.
 * @param {HTMLElement} itemRow - A linha do item do equipamento onde os valores devem ser aplicados.
 */
const applyDefaultMobilizationDemobilizationToOneItem = (itemRow) => {
    const defaultMobRolling = parseFloat(defaultMobilizationRollingInput.value) || 0;
    const defaultDemobRolling = parseFloat(defaultDemobilizationRollingInput.value) || 0;
    const defaultMobNonRolling = parseFloat(defaultMobilizationNonRollingInput.value) || 0;
    const defaultDemobNonRolling = parseFloat(defaultDemobilizationNonRollingInput.value) || 0;

    const equipmentSelect = itemRow.querySelector('.equipment-select');
    const selectedOption = equipmentSelect.options[equipmentSelect.selectedIndex];
    const rollingType = selectedOption ? selectedOption.dataset.rollingType : null;

    const mobilizationInput = itemRow.querySelector('.mobilization-cost');
    const demobilizationInput = itemRow.querySelector('.demobilization-cost');

    // Só aplica se o campo estiver vazio
    if (mobilizationInput.value === '' || parseFloat(mobilizationInput.value) === 0) {
        if (rollingType === 'rodante') {
            mobilizationInput.value = defaultMobRolling;
        } else if (rollingType === 'nao_rodante') {
            mobilizationInput.value = defaultMobNonRolling;
        }
    }
    if (demobilizationInput.value === '' || parseFloat(demobilizationInput.value) === 0) {
        if (rollingType === 'rodante') {
            demobilizationInput.value = defaultDemobRolling;
        } else if (rollingType === 'nao_rodante') {
            demobilizationInput.value = defaultDemobNonRolling;
        }
    }
};

/**
 * Aplica a franquia mínima mensal padrão a todos os itens.
 */
const applyDefaultMinGuaranteedHours = () => {
    const defaultHours = parseFloat(defaultMinGuaranteedHoursInput.value) || null;
    equipmentProposalItemsContainer.querySelectorAll('.min-guaranteed-hours').forEach(input => {
        if (input.value === '' || parseFloat(input.value) === 0) { // Só preenche se estiver vazio ou zero
            input.value = defaultHours !== null ? defaultHours : '';
        }
    });
};

/**
 * Alterna a visibilidade dos campos de quantidade para cada item.
 */
const toggleQuantityInputs = () => {
    const isChecked = addQuantityCheckbox.checked;
    equipmentProposalItemsContainer.querySelectorAll('.equipment-proposal-item-row').forEach(row => {
        const quantityGroup = row.querySelector('.item-quantity-group');
        if (quantityGroup) {
            quantityGroup.style.display = isChecked ? 'block' : 'none';
        }
    });
};


/**
 * Adiciona uma nova linha de item de equipamento ao formulário de proposta.
 */
const addEquipmentProposalItemRow = () => {
    const itemRow = document.createElement('div');
    itemRow.classList.add('form-grid', 'equipment-proposal-item-row');
    
    
    // Ordenar equipamentos por tipo e depois por prefixo antes de criar as opções
    const sortedEquipment = [...appState.equipment].sort((a, b) => {
        const typeA = (appState.equipment_types?.find(et => et.id == a.type)?.name || a.type || '').toUpperCase();
        const typeB = (appState.equipment_types?.find(et => et.id == b.type)?.name || b.type || '').toUpperCase();
        if (typeA < typeB) return -1;
        if (typeA > typeB) return 1;

        const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
        const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
        if (prefixA < prefixB) return -1;
        if (prefixA > prefixB) return 1;
        return 0;
    });

    const equipmentOptions = sortedEquipment.map(e => {
        let imageUrl = e.image_url_manual || e.image_url || '';
        // Formato do nome no combobox: TIPO - PREFIXO - MARCA - MODELO - ANO - CARACTERÍSTICA - CAPACIDADE
        const equipTypeName = appState.equipment_types?.find(et => et.id == e.type)?.name || e.type || '';
        const parts = [
            equipTypeName,
            e.prefix,
            e.brand,
            e.model,
            e.year,
            e.characteristic, // Novo campo
            e.capacidade
        ].filter(Boolean); // Remove valores nulos/vazios

        const displayText = parts.join(' - ');

        // Adiciona todos os atributos como data attributes para fácil acesso
        return `<option value="${e.id}" 
                        data-image-url="${imageUrl}" 
                        data-chassi="${e.chassi || ''}" 
                        data-capacidade="${e.capacidade || ''}"
                        data-prefix="${e.prefix || ''}"
                        data-type="${equipTypeName}"
                        data-brand="${e.brand || ''}"
                        data-model="${e.model || ''}"
                        data-year="${e.year || ''}"
                        data-characteristic="${e.characteristic || ''}" // Novo data attribute
                        data-rolling-type="${e.rolling_type || ''}" // NOVO: tipo de rodante
                        data-is-terceirizado="${e.is_terceirizado ? 'true' : 'false'}" // NOVO: se é terceirizado
                        >${displayText}</option>`;
    }).join('');

    const responsibleOptions = `
        <option value="contratada">Contratada (Minha Empresa)</option>
        <option value="contratante">Contratante (Empresa Cliente)</option>
    `;

    itemRow.innerHTML = `
        <div class="form-group" style="grid-column: span 4;">
            <label>Equipamento</label>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; align-items: start;">
                <!-- COLUNA DA ESQUERDA: Combobox e detalhes -->
                <div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                        <img src="" alt="Miniatura do Equipamento" class="equipment-thumbnail" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ccc; display: none;">
                        <select class="equipment-select" required style="flex: 1;">
                            <option value="">Selecione...</option>
                            ${equipmentOptions}
                        </select>
                    </div>
                    <span class="equipment-details-display" style="font-size: 0.8em; color: #999; display: block; margin-bottom: 5px;"></span>
                    <span class="rolling-type-display" style="font-size: 0.8em; color: #4a9eff; display: block; font-weight: bold; margin-bottom: 5px;"></span>
                    <span class="terceirizado-warning" style="font-size: 0.8em; color: #ff6b6b; display: none; font-weight: bold;">⚠️ EQUIPAMENTO TERCEIRIZADO</span>
                </div>
                
                <!-- COLUNA DA DIREITA: Últimos preços (TEMA ESCURO) -->
                <div class="last-prices-container" style="font-size: 0.9em; display: none; background-color: #2a2a2a; padding: 12px; border-radius: 5px; border: 1px solid #404040; max-height: 280px; overflow-y: auto;">
                    <span class="last-prices-display"></span>
                </div>
            </div>
        </div>
        <div class="form-group item-quantity-group" style="display: ${addQuantityCheckbox?.checked ? 'block' : 'none'};">
            <label>Quantidade</label>
            <input type="number" step="1" min="1" class="item-quantity" value="1" required>
        </div>
        <div class="form-group">
            <label>Valor</label>
            <select class="value-type-select" required>
                <option value="mensal">Mensal</option>
                <option value="diario">Diário</option>
                <option value="horas">Horas</option>
                <option value="personalizado">Personalizado</option>
            </select>
        </div>
        <div class="form-group">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" class="item-value" required>
        </div>
        <div class="form-group custom-value-description" style="display: none;">
            <label>Descrição Valor Personalizado</label>
            <input type="text" class="custom-value-description-input" placeholder="Ex: 15 dias">
        </div>
        <div class="form-group">
            <label>Franquia Mínima Mensal (Horas)</label>
            <input type="number" step="0.01" class="min-guaranteed-hours">
        </div>
        <div class="form-group">
            <label>Custo Mobilização (R$)</label>
            <input type="number" step="0.01" class="mobilization-cost">
        </div>
        <div class="form-group">
            <label>Custo Desmobilização (R$)</label>
            <input type="number" step="0.01" class="demobilization-cost">
        </div>

        <div class="form-group checkbox-with-select">
            <input type="checkbox" class="include-food-checkbox" id="include-food-${Date.now()}"> 
            <label for="include-food-${Date.now()}">Alimentação por conta de:</label>
            <select class="food-responsible-select" disabled>
                ${responsibleOptions}
            </select>
        </div>
        <div class="form-group checkbox-with-select">
            <input type="checkbox" class="include-lodging-checkbox" id="include-lodging-${Date.now()}"> 
            <label for="include-lodging-${Date.now()}">Hospedagem por conta de:</label>
            <select class="lodging-responsible-select" disabled>
                ${responsibleOptions}
            </select>
        </div>
        <div class="form-group checkbox-with-select">
            <input type="checkbox" class="include-fuel-checkbox" id="include-fuel-${Date.now()}"> 
            <label for="include-fuel-${Date.now()}">Combustível por conta de:</label>
            <select class="fuel-responsible-select" disabled>
                ${responsibleOptions}
            </select>
        </div>
        <!-- NOVO CAMPO: COM OPERADOR -->
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; padding: 0 5px;">
            <input type="checkbox" class="include-operator-checkbox" id="include-operator-${Date.now()}">
            <label for="include-operator-${Date.now()}">Com Operador</label>
        </div>

        <div class="form-group" style="grid-column: span 2;">
            <label>Observações do Item</label>
            <textarea class="item-observations" rows="2"></textarea>
        </div>
        <div class="form-group" style="grid-column: span 2;">
            <label>URL da Imagem do Equipamento (Manual - Opcional)</label>
            <input type="text" class="equipment-image-url-manual" placeholder="Cole a URL da imagem aqui para priorizar">
            <small style="color: #b0b0b0; font-size: 0.8em;">Se vazio, usará a imagem do cadastro do equipamento.</small>
        </div>

        <!-- NOVAS CHECKBOXES PARA CONTROLE DE EXIBIÇÃO NO PDF -->
        <div class="form-group" style="grid-column: span 2; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px;">
            <label style="font-weight: bold; margin-bottom: 5px; display: block;">Exibir no PDF (Descrição do Equipamento):</label>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-prefix-pdf-checkbox"> Prefixo
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-brand-pdf-checkbox"> Marca
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-model-pdf-checkbox"> Modelo
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-year-pdf-checkbox"> Ano
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-capacity-pdf-checkbox" checked> Capacidade
                </label>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-chassi-pdf-checkbox"> Chassi
                </label>
                 <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" class="include-characteristic-pdf-checkbox" checked> Característica
                </label>
            </div>
            <small style="color: #b0b0b0; font-size: 0.8em; display: block; margin-top: 5px;">
                Por padrão, apenas o 'Tipo de Equipamento' aparece na descrição do PDF. Marque para incluir mais detalhes.
            </small>
        </div>

        <button type="button" class="btn btn-danger btn-sm remove-item-btn">Remover</button>
    `;

    equipmentProposalItemsContainer.appendChild(itemRow);

    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => itemRow.remove());
    
    const equipmentSelect = itemRow.querySelector('.equipment-select');
    const manualImageUrlInput = itemRow.querySelector('.equipment-image-url-manual');
    const equipmentDetailsDisplay = itemRow.querySelector('.equipment-details-display');
    const rollingTypeDisplay = itemRow.querySelector('.rolling-type-display'); // Elemento para tipo de rodante
    const terceirizadoWarning = itemRow.querySelector('.terceirizado-warning'); // Elemento para aviso de terceirizado
    const thumbnailImg = itemRow.querySelector('.equipment-thumbnail');
    const lastPricesContainer = itemRow.querySelector('.last-prices-container');
    const lastPricesDisplay = itemRow.querySelector('.last-prices-display');

    equipmentSelect.addEventListener('change', async () => {
        const selectedOption = equipmentSelect.options[equipmentSelect.selectedIndex];
        if (!selectedOption || !selectedOption.dataset) {
            thumbnailImg.style.display = 'none';
            lastPricesContainer.style.display = 'none';
            equipmentDetailsDisplay.textContent = '';
            rollingTypeDisplay.textContent = '';
            terceirizadoWarning.style.display = 'none';
            return;
        }

        // 1. Lógica para a miniatura
        const imageUrl = selectedOption.dataset.imageUrl;
        if (imageUrl) {
            thumbnailImg.src = imageUrl;
            thumbnailImg.style.display = 'block';
        } else {
            thumbnailImg.style.display = 'none';
        }

        // 2. Lógica para os últimos 5 preços MENSAIS (busca apenas por MARCA e MODELO, ignorando prefixo)
        const equipmentBrand = selectedOption.dataset.brand;
        const equipmentModel = selectedOption.dataset.model;

        if (equipmentBrand && equipmentModel) {
            lastPricesContainer.style.display = 'block';
            lastPricesDisplay.innerHTML = '<span style="color: #999;">Buscando últimos preços...</span>';
            
            // Array para armazenar os preços mensais encontrados
            const monthlyPricesData = [];
            
            // Percorre todas as propostas de equipamentos
            appState.equipment_proposals.forEach(proposal => {
                if (!proposal.items || !Array.isArray(proposal.items)) return;
                
                // Percorre os itens de cada proposta
                proposal.items.forEach(item => {
                    const eq = appState.equipment.find(e => e.id == item.equipment_id);
                    
                    // Verifica se o equipamento tem a MESMA MARCA e MODELO (ignorando prefixo)
                    if (eq && 
                        eq.brand && eq.brand.toLowerCase() === equipmentBrand.toLowerCase() &&
                        eq.model && eq.model.toLowerCase() === equipmentModel.toLowerCase()) {
                        
                        // Verifica se o item tem valor mensal definido
                        let monthlyPrice = null;
                        
                        // Se o tipo de valor for "mensal", pega direto
                        if (item.value_type === 'mensal' && item.value && parseFloat(item.value) > 0) {
                            monthlyPrice = parseFloat(item.value);
                        }
                        // Se for diário, converte para mensal (assumindo 30 dias)
                        else if (item.value_type === 'diario' && item.value && parseFloat(item.value) > 0) {
                            monthlyPrice = parseFloat(item.value) * 30;
                        }
                        // Se for por horas, não considera (não faz sentido converter para mensal)
                        
                        // Se encontrou um preço mensal válido, adiciona ao array
                        if (monthlyPrice !== null) {
                            // Busca o nome do cliente da proposta
                            const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);
                            const clientName = clientCompany ? clientCompany.name : 'Cliente não identificado';
                            
                            // Verifica se tinha operador marcado
                            const hasOperator = item.include_operator === true;
                            
                            // Verifica alimentação, hospedagem e combustível
                            const hasFood = item.include_food === true;
                            const foodResponsible = item.food_responsible || 'contratada';
                            
                            const hasLodging = item.include_lodging === true;
                            const lodgingResponsible = item.lodging_responsible || 'contratada';
                            
                            const hasFuel = item.include_fuel === true;
                            const fuelResponsible = item.fuel_responsible || 'contratada';
                            
                            monthlyPricesData.push({
                                price: monthlyPrice,
                                date: proposal.proposal_date || proposal.created_at,
                                prefix: eq.prefix || 'N/A',
                                proposalId: proposal.id,
                                clientName: clientName,
                                hasOperator: hasOperator,
                                hasFood: hasFood,
                                foodResponsible: foodResponsible,
                                hasLodging: hasLodging,
                                lodgingResponsible: lodgingResponsible,
                                hasFuel: hasFuel,
                                fuelResponsible: fuelResponsible
                            });
                        }
                    }
                });
            });
            
            // Ordena por data (mais recente primeiro)
            monthlyPricesData.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Pega apenas os 5 últimos preços
            const last5Prices = monthlyPricesData.slice(0, 5);
            
            // Exibe os preços encontrados
            if (last5Prices.length > 0) {
                let pricesHtml = '<div style="margin-bottom: 10px;"><strong style="color: #4ade80; display: block; font-size: 1em;">💰 Últimos 5 Preços Mensais:</strong></div>';
                
                last5Prices.forEach((priceData, index) => {
                    const formattedPrice = new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                    }).format(priceData.price);
                    
                    const formattedDate = new Date(priceData.date + 'T00:00:00').toLocaleDateString('pt-BR');
                    
                    // Array para armazenar todos os badges/indicadores
                    const badges = [];
                    
                    // Operador
                    if (priceData.hasOperator) {
                        badges.push('<span style="background-color: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">👷 COM OPERADOR</span>');
                    }
                    
                    // Alimentação
                    if (priceData.hasFood) {
                        const foodLabel = priceData.foodResponsible === 'contratante' ? 'CONTRATANTE' : 'CONTRATADA';
                        badges.push(`<span style="background-color: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">🍽️ ALIMENTAÇÃO: ${foodLabel}</span>`);
                    }
                    
                    // Hospedagem
                    if (priceData.hasLodging) {
                        const lodgingLabel = priceData.lodgingResponsible === 'contratante' ? 'CONTRATANTE' : 'CONTRATADA';
                        badges.push(`<span style="background-color: #8b5cf6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">🏨 HOSPEDAGEM: ${lodgingLabel}</span>`);
                    }
                    
                    // Combustível
                    if (priceData.hasFuel) {
                        const fuelLabel = priceData.fuelResponsible === 'contratante' ? 'CONTRATANTE' : 'CONTRATADA';
                        badges.push(`<span style="background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; font-weight: bold; margin-left: 5px;">⛽ COMBUSTÍVEL: ${fuelLabel}</span>`);
                    }
                    
                    // Monta a linha completa
                    pricesHtml += `
                        <div style="padding: 8px 10px; margin-bottom: 6px; background-color: #1a1a1a; border-radius: 4px; border-left: 3px solid #4a9eff; color: #e0e0e0; font-size: 0.9em; line-height: 1.6;">
                            <div style="margin-bottom: 3px;">
                                <strong style="color: #60a5fa; font-size: 1.05em;">${formattedPrice}</strong> - 
                                <span style="color: #a0a0a0;">📅 ${formattedDate}</span> - 
                                <span style="color: #a0a0a0;">🏢 ${priceData.clientName}</span> - 
                                <span style="color: #888;">Prefixo: ${priceData.prefix}</span>
                            </div>
                            ${badges.length > 0 ? '<div style="margin-top: 4px;">' + badges.join(' ') + '</div>' : ''}
                        </div>
                    `;
                });
                
                lastPricesDisplay.innerHTML = pricesHtml;
            } else {
                lastPricesDisplay.innerHTML = '<span style="color: #888; font-style: italic;">Nenhum preço mensal anterior encontrado para esta marca e modelo.</span>';
            }

        } else {
            lastPricesContainer.style.display = 'none';
        }

        const prefix = selectedOption.dataset.prefix || 'Não informado';
        const brand = selectedOption.dataset.brand || 'Não informado';
        const model = selectedOption.dataset.model || 'Não informado';
        const year = selectedOption.dataset.year || 'Não informado';
        const chassi = selectedOption.dataset.chassi || 'Não informado';
        const capacidade = selectedOption.dataset.capacidade || 'Não informado';
        const characteristic = selectedOption.dataset.characteristic || 'Não informado';
        const rollingType = selectedOption.dataset.rollingType || '';
        const isTerceirizado = selectedOption.dataset.isTerceirizado === 'true';

        equipmentDetailsDisplay.textContent = `Prefixo: ${prefix} | Marca: ${brand} | Modelo: ${model} | Ano: ${year} | Chassi: ${chassi} | Capacidade: ${capacidade} | Característica: ${characteristic}`;
        rollingTypeDisplay.textContent = rollingType ? `Tipo: ${rollingType.charAt(0).toUpperCase() + rollingType.slice(1)}` : '';
        terceirizadoWarning.style.display = isTerceirizado ? 'block' : 'none'; // Exibe/oculta o aviso de terceirizado


        // Aplica os valores padrão de mobilização/desmobilização e franquia ao selecionar o equipamento
        const mobilizationCostInput = itemRow.querySelector('.mobilization-cost');
        const demobilizationCostInput = itemRow.querySelector('.demobilization-cost');
        const minGuaranteedHoursInput = itemRow.querySelector('.min-guaranteed-hours');

        // Resetar os campos de mobilização/desmobilização e franquia antes de aplicar os padrões
        mobilizationCostInput.value = '';
        demobilizationCostInput.value = '';
        minGuaranteedHoursInput.value = '';

        // CHAMA a nova função para aplicar os padrões a este item específico
        applyDefaultMobilizationDemobilizationToOneItem(itemRow);
        applyDefaultMinGuaranteedHours(); // Esta função já itera sobre todos os itens, pode permanecer assim.
    });

    const valueTypeSelect = itemRow.querySelector('.value-type-select');
    const customValueDescriptionGroup = itemRow.querySelector('.custom-value-description');
    valueTypeSelect.addEventListener('change', () => {
        if (valueTypeSelect.value === 'personalizado') {
            customValueDescriptionGroup.style.display = 'flex';
        } else {
            customValueDescriptionGroup.style.display = 'none';
        }
    });

    const setupResponsibleSelect = (checkbox, select) => {
        checkbox.addEventListener('change', () => {
            select.disabled = !checkbox.checked;
        });
        select.disabled = !checkbox.checked;
    };

    setupResponsibleSelect(itemRow.querySelector('.include-food-checkbox'), itemRow.querySelector('.food-responsible-select'));
    setupResponsibleSelect(itemRow.querySelector('.include-lodging-checkbox'), itemRow.querySelector('.lodging-responsible-select'));
    setupResponsibleSelect(itemRow.querySelector('.include-fuel-checkbox'), itemRow.querySelector('.fuel-responsible-select'));
};

/**
 * Carrega e renderiza as propostas de equipamentos existentes.
 */
const loadAndRenderEquipmentProposals = async () => {
    showSpinner();
    equipmentProposalsTableBody.innerHTML = '';
    try {
        // Assegura que o campo 'cnpj' do cliente também seja buscado
        const proposals = await apiClient.fetchData('equipment_proposals', '*, client_companies(name, cnpj), my_companies(name, responsible_owner_name, responsible_owner_phone, phone, email, address, cnpj)');
        
        // ✅ ORDENA AS PROPOSTAS: Mais recentes primeiro
        proposals.sort((a, b) => {
            const dateA = new Date(a.created_at || a.proposal_date);
            const dateB = new Date(b.created_at || b.proposal_date);
                return dateB - dateA; // Ordem decrescente (mais recente primeiro)
        });
        
        appState.equipment_proposals = proposals;

        if (proposals.length === 0) {
            equipmentProposalsTableBody.innerHTML = `<tr><td colspan="5">Nenhuma proposta de equipamento cadastrada.</td></tr>`;
            hideSpinner();
            return;
        }

        proposals.forEach(proposal => {
            const row = document.createElement('tr');
            const clientName = proposal.client_companies ? proposal.client_companies.name : 'N/A';
            const myCompanyName = proposal.my_companies ? proposal.my_companies.name : 'N/A';
            // Ao exibir, convertemos a string YYYY-MM-DD para o formato de data local
            const proposalDate = new Date(proposal.proposal_date + 'T00:00:00').toLocaleDateString('pt-BR'); // Adiciona T00:00:00 para tratar como data local explícita
            const itemCount = proposal.items ? proposal.items.length : 0; 

            row.innerHTML = `
                <td data-label="Data">${proposalDate}</td>
                <td data-label="Cliente">${clientName}</td>
                <td data-label="Minha Empresa">${myCompanyName}</td>
                <td data-label="Itens">${itemCount} equipamentos</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${proposal.id}" data-action="edit-equipment-proposal">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${proposal.id}" data-action="delete-equipment-proposal">Excluir</button>
                    <button class="btn btn-info btn-sm" data-id="${proposal.id}" data-action="view-equipment-pdf">👁️ Visualizar PDF</button>
                    <button class="btn btn-primary btn-sm" data-id="${proposal.id}" data-action="generate-equipment-pdf">Gerar PDF</button>
                    <button class="btn btn-success btn-sm" data-id="${proposal.id}" data-action="whatsapp-equipment-pdf" title="Enviar via WhatsApp">📱 WhatsApp</button>
                    <button class="btn btn-info btn-sm" data-id="${proposal.id}" data-action="send-equipment-email">📧 Email</button>
                </td>
            `;
            equipmentProposalsTableBody.appendChild(row);
        });

        equipmentProposalsTableBody.querySelectorAll('[data-action="edit-equipment-proposal"]').forEach(btn => {
            btn.addEventListener('click', (e) => editEquipmentProposal(e.target.dataset.id));
        });
        equipmentProposalsTableBody.querySelectorAll('[data-action="delete-equipment-proposal"]').forEach(btn => {
            btn.addEventListener('click', (e) => deleteEquipmentProposal(e.target.dataset.id));
        });
        equipmentProposalsTableBody.querySelectorAll('[data-action="generate-equipment-pdf"]').forEach(btn => {
            btn.addEventListener('click', (e) => generateEquipmentProposalPDF(e.target.dataset.id));
        });
        equipmentProposalsTableBody.querySelectorAll('[data-action="view-equipment-pdf"]').forEach(btn => {
            btn.addEventListener('click', (e) => viewEquipmentProposalPDF(e.target.dataset.id));
        });
        equipmentProposalsTableBody.querySelectorAll('[data-action="whatsapp-equipment-pdf"]').forEach(btn => {
            btn.addEventListener('click', (e) => sendEquipmentProposalViaWhatsApp(e.target.dataset.id));
        });
        equipmentProposalsTableBody.querySelectorAll('[data-action="send-equipment-email"]').forEach(btn => {
            btn.addEventListener('click', (e) => handleSendEquipmentProposalEmail(e.target.dataset.id));
        });

    } catch (error) {
        console.error('Erro ao carregar propostas de equipamentos:', error);
        showModal('Erro ao Carregar Propostas', 'Erro ao carregar propostas de equipamentos. Detalhes: ' + error.message);
    } finally {
        hideSpinner();
    }
};

/**
 * Salva uma nova proposta de equipamento ou atualiza uma existente.
 */
const saveEquipmentProposal = async () => {
    showSpinner();
    const proposalId = saveEquipmentProposalBtn.dataset.id || null;

    const clientCompanyId = equipmentProposalClientCompanySelect.value;
    const myCompanyId = equipmentProposalMyCompanySelect.value;
    // A data já vem do input no formato YYYY-MM-DD
    const proposalDate = equipmentProposalDateInput.value; 
    const cnpj = equipmentProposalCnpjInput.value || null;
    const nameComplement = equipmentProposalNameComplementInput ? equipmentProposalNameComplementInput.value || null : null;
    const observations = equipmentProposalObservationsTextarea.value || null;
    const addQuantity = addQuantityCheckbox ? addQuantityCheckbox.checked : false; // Captura o estado da checkbox "Adicionar Qtde"
    const includeTermsPdf = includeTermsPdfCheckbox ? includeTermsPdfCheckbox.checked : true; // NOVO: Captura o estado da checkbox "Incluir Termos"
    const includeImagesPdf = includeImagesPdfCheckbox ? includeImagesPdfCheckbox.checked : true; // NOVO: Captura o estado da checkbox "Incluir Imagens"
    const includeCnpjPdf = includeCnpjPdfCheckbox ? includeCnpjPdfCheckbox.checked : false; // NOVO: Captura o estado da checkbox "Incluir CNPJ no PDF"

    // NOVOS: Captura o estado das novas checkboxes de custos gerais
    const includeGeneralFood = includeGeneralFoodCheckbox?.checked || false;
    const generalFoodResponsible = generalFoodResponsibleSelect?.value || null;
    const includeGeneralLodging = includeGeneralLodgingCheckbox?.checked || false;
    const generalLodgingResponsible = generalLodgingResponsibleSelect?.value || null;
    const includeGeneralFuel = includeGeneralFuelCheckbox?.checked || false;
    const generalFuelResponsible = generalFuelResponsibleSelect?.value || null;
    const includeGeneralOperator = includeGeneralOperatorCheckbox?.checked || false;


    // Novos campos de valores padrão
    const defaultMobRolling = parseFloat(defaultMobilizationRollingInput.value) || null;
    const defaultDemobRolling = parseFloat(defaultDemobilizationRollingInput.value) || null;
    const defaultMobNonRolling = parseFloat(defaultMobilizationNonRollingInput.value) || null;
    const defaultDemobNonRolling = parseFloat(defaultDemobilizationNonRollingInput.value) || null;
    const defaultMinGuaranteedHours = parseFloat(defaultMinGuaranteedHoursInput.value) || null;


    const items = [];
    equipmentProposalItemsContainer.querySelectorAll('.equipment-proposal-item-row').forEach(row => {
        const equipmentSelect = row.querySelector('.equipment-select');
        const equipmentId = equipmentSelect.value;
        const selectedOption = equipmentSelect.options[equipmentSelect.selectedIndex];

        const quantityInput = row.querySelector('.item-quantity'); // Campo de quantidade
        const quantity = addQuantity && quantityInput ? parseInt(quantityInput.value) : 1; // Pega a quantidade se a checkbox estiver marcada, senão 1

        const valueType = row.querySelector('.value-type-select').value;
        const value = parseFloat(row.querySelector('.item-value').value);
        const customValueDescription = row.querySelector('.custom-value-description-input')?.value || null;
        const minGuaranteedHours = parseFloat(row.querySelector('.min-guaranteed-hours').value) || null;
        const mobilizationCost = parseFloat(row.querySelector('.mobilization-cost').value) || null;
        const demobilizationCost = parseFloat(row.querySelector('.demobilization-cost').value) || null;
        
        const includeFood = row.querySelector('.include-food-checkbox').checked;
        const foodResponsible = row.querySelector('.food-responsible-select').value;
        const includeLodging = row.querySelector('.include-lodging-checkbox').checked;
        const lodgingResponsible = row.querySelector('.lodging-responsible-select').value;
        const includeFuel = row.querySelector('.include-fuel-checkbox').checked;
        const fuelResponsible = row.querySelector('.fuel-responsible-select').value;
        const includeOperator = row.querySelector('.include-operator-checkbox').checked; // NOVO: Captura o estado da checkbox "Com Operador"

        const itemObservations = row.querySelector('.item-observations').value || null;
        const manualImageUrl = row.querySelector('.equipment-image-url-manual').value || null;

        // Adiciona verificação para selectedOption e selectedOption.dataset antes de acessar dataset
        const chassi = (selectedOption && selectedOption.dataset) ? selectedOption.dataset.chassi || null : null;
        const capacidade = (selectedOption && selectedOption.dataset) ? selectedOption.dataset.capacidade || null : null;
        const characteristic = (selectedOption && selectedOption.dataset) ? selectedOption.dataset.characteristic || null : null;
        const rollingType = (selectedOption && selectedOption.dataset) ? selectedOption.dataset.rollingType || null : null;
        const isTerceirizado = (selectedOption && selectedOption.dataset) ? selectedOption.dataset.isTerceirizado === 'true' : false; // NOVO: Salva se é terceirizado

        // Captura o estado das checkboxes de exibição no PDF para cada item
        const includePrefixPdf = row.querySelector('.include-prefix-pdf-checkbox').checked;
        const includeBrandPdf = row.querySelector('.include-brand-pdf-checkbox').checked;
        const includeModelPdf = row.querySelector('.include-model-pdf-checkbox').checked;
        const includeYearPdf = row.querySelector('.include-year-pdf-checkbox').checked;
        const includeCapacityPdf = row.querySelector('.include-capacity-pdf-checkbox').checked;
        const includeChassiPdf = row.querySelector('.include-chassi-pdf-checkbox').checked;
        const includeCharacteristicPdf = row.querySelector('.include-characteristic-pdf-checkbox').checked;


        if (equipmentId && valueType && !isNaN(value)) {
            items.push({
                equipment_id: equipmentId,
                quantity: quantity, // Salva a quantidade
                value_type: valueType,
                value: value,
                custom_value_description: customValueDescription,
                min_guaranteed_hours: minGuaranteedHours,
                mobilization_cost: mobilizationCost,
                demobilization_cost: demobilizationCost,
                include_food: includeFood,
                food_responsible: foodResponsible,
                include_lodging: includeLodging,
                lodging_responsible: lodgingResponsible,
                include_fuel: includeFuel,
                fuel_responsible: fuelResponsible,
                include_operator: includeOperator, // NOVO: Salva o estado da checkbox
                observations: itemObservations,
                manual_image_url: manualImageUrl,
                chassi: chassi,
                capacidade: capacidade,
                characteristic: characteristic, // Salva característica
                rolling_type: rollingType, // Salva o tipo de rodante
                is_terceirizado: isTerceirizado, // NOVO: Salva se é terceirizado
                include_prefix_pdf: includePrefixPdf,
                include_brand_pdf: includeBrandPdf,
                include_model_pdf: includeModelPdf,
                include_year_pdf: includeYearPdf,
                include_capacity_pdf: includeCapacityPdf,
                include_chassi_pdf: includeChassiPdf,
                include_characteristic_pdf: includeCharacteristicPdf // Salva o estado da checkbox
            });
        }
    });

    if (!clientCompanyId || !myCompanyId || !proposalDate || items.length === 0) {
        showModal('Campos Obrigatórios', 'Por favor, preencha todos os campos obrigatórios e adicione pelo menos um item de equipamento.');
        hideSpinner();
        return;
    }

    const proposalData = {
        client_company_id: clientCompanyId,
        my_company_id: myCompanyId,
        proposal_date: proposalDate, // Isso será a string YYYY-MM-DD
        cnpj: cnpj,
        name_complement: nameComplement,
        observations: observations,
        email_recipients: equipmentProposalEmailsTextarea ? equipmentProposalEmailsTextarea.value.trim() : null,
        email_cc: equipmentProposalCcEmailsTextarea ? equipmentProposalCcEmailsTextarea.value.trim() : null,
        email_bcc: equipmentProposalBccEmailsTextarea ? equipmentProposalBccEmailsTextarea.value.trim() : null,
        default_mobilization_rolling: defaultMobRolling,
        default_demobilization_rolling: defaultDemobRolling,
        default_mobilization_non_rolling: defaultMobNonRolling,
        default_demobilization_non_rolling: defaultDemobNonRolling,
        default_min_guaranteed_hours: defaultMinGuaranteedHours,
        add_quantity_to_items: addQuantity, // Salva o estado da checkbox "Adicionar Qtde"
        include_terms_pdf: includeTermsPdf, // NOVO: Salva o estado da checkbox "Incluir Termos"
        include_images_pdf: includeImagesPdf, // NOVO: Salva o estado da checkbox "Incluir Imagens"
        include_cnpj_pdf: includeCnpjPdf, // NOVO: Salva o estado da checkbox "Incluir CNPJ no PDF"
        include_general_food: includeGeneralFood, // NOVO: Salva os custos gerais
        general_food_responsible: generalFoodResponsible,
        include_general_lodging: includeGeneralLodging,
        general_lodging_responsible: generalLodgingResponsible,
        include_general_fuel: includeGeneralFuel,
        general_fuel_responsible: generalFuelResponsible,
        include_general_operator: includeGeneralOperator,
        items: JSON.stringify(items) // Continua stringificando para salvar no banco
    };

    try {
        if (proposalId) {
            await apiClient.updateItem('equipment_proposals', proposalId, proposalData);
            showModal('Sucesso!', 'Proposta de equipamento atualizada com sucesso!');
        } else {
            await apiClient.addItem('equipment_proposals', proposalData);
            showModal('Sucesso!', 'Proposta de equipamento salva com sucesso!');
        }
        resetEquipmentProposalForm();
        loadAndRenderEquipmentProposals();
    } catch (error) {
        console.error('Erro ao salvar proposta de equipamento:', error);
        showModal('Erro ao Salvar Proposta', `Erro ao salvar proposta de equipamento: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Edita uma proposta de equipamento existente.
 * @param {string} id - ID da proposta a ser editada.
 */
const editEquipmentProposal = (id) => {
    const proposal = appState.equipment_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada.');
        return;
    }

    equipmentProposalClientCompanySelect.value = proposal.client_company_id;
    // Dispara o evento 'change' para que o CNPJ seja preenchido automaticamente
    const changeEvent = new Event('change');
    equipmentProposalClientCompanySelect.dispatchEvent(changeEvent);

    equipmentProposalMyCompanySelect.value = proposal.my_company_id;
    
    // Ao editar, garantimos que a data do input seja a data do banco de dados no formato YYYY-MM-DD.
    // Usamos new Date(dateString + 'T00:00:00') para forçar a interpretação como local, evitando problemas de fuso horário.
    const dbDate = new Date(proposal.proposal_date + 'T00:00:00'); 
    const year = dbDate.getFullYear();
    const month = String(dbDate.getMonth() + 1).padStart(2, '0');
    const day = String(dbDate.getDate()).padStart(2, '0');
    equipmentProposalDateInput.value = `${year}-${month}-${day}`;


    equipmentProposalCnpjInput.value = proposal.cnpj || '';
    if (equipmentProposalNameComplementInput) {
        equipmentProposalNameComplementInput.value = proposal.name_complement || '';
    }
    equipmentProposalObservationsTextarea.value = proposal.observations || '';
    
    // Preenche os campos de email ao editar
    if (equipmentProposalEmailsTextarea) equipmentProposalEmailsTextarea.value = proposal.email_recipients || '';
    if (equipmentProposalCcEmailsTextarea) equipmentProposalCcEmailsTextarea.value = proposal.email_cc || '';
    if (equipmentProposalBccEmailsTextarea) equipmentProposalBccEmailsTextarea.value = proposal.email_bcc || '';

    // Preenche os novos campos de valores padrão ao editar
    // Adicionando verificações de existência para evitar 'Cannot set properties of null'
    if (defaultMobilizationRollingInput) defaultMobilizationRollingInput.value = proposal.default_mobilization_rolling || '';
    if (defaultDemobilizationRollingInput) defaultDemobilizationRollingInput.value = proposal.default_demobilization_rolling || '';
    if (defaultMobilizationNonRollingInput) defaultMobilizationNonRollingInput.value = proposal.default_mobilization_non_rolling || '';
    if (defaultDemobilizationNonRollingInput) defaultDemobilizationNonRollingInput.value = proposal.default_demobilization_non_rolling || '';
    if (defaultMinGuaranteedHoursInput) defaultMinGuaranteedHoursInput.value = proposal.default_min_guaranteed_hours || '';

    // NOVO: Define o estado das checkboxes de controle do PDF ao editar
    if (addQuantityCheckbox) {
        addQuantityCheckbox.checked = proposal.add_quantity_to_items || false;
        toggleQuantityInputs(); // Atualiza a visibilidade dos campos de quantidade
    }
    if (includeTermsPdfCheckbox) {
        includeTermsPdfCheckbox.checked = proposal.include_terms_pdf !== undefined ? proposal.include_terms_pdf : true; // Padrão true
    }
    if (includeImagesPdfCheckbox) {
        includeImagesPdfCheckbox.checked = proposal.include_images_pdf !== undefined ? proposal.include_images_pdf : true; // Padrão true
    }
    if (includeCnpjPdfCheckbox) {
        includeCnpjPdfCheckbox.checked = proposal.include_cnpj_pdf || false; // NOVO: Define o estado da checkbox de CNPJ
    }

    // NOVOS: Preenche o estado das novas checkboxes de custos gerais
    if (includeGeneralFoodCheckbox) {
        includeGeneralFoodCheckbox.checked = proposal.include_general_food || false;
        generalFoodResponsibleSelect.disabled = !includeGeneralFoodCheckbox.checked;
        generalFoodResponsibleSelect.value = proposal.general_food_responsible || 'contratada';
    }
    if (includeGeneralLodgingCheckbox) {
        includeGeneralLodgingCheckbox.checked = proposal.include_general_lodging || false;
        generalLodgingResponsibleSelect.disabled = !includeGeneralLodgingCheckbox.checked;
        generalLodgingResponsibleSelect.value = proposal.general_lodging_responsible || 'contratada';
    }
    if (includeGeneralFuelCheckbox) {
        includeGeneralFuelCheckbox.checked = proposal.include_general_fuel || false;
        generalFuelResponsibleSelect.disabled = !includeGeneralFuelCheckbox.checked;
        generalFuelResponsibleSelect.value = proposal.general_fuel_responsible || 'contratada';
    }
    if (includeGeneralOperatorCheckbox) {
    includeGeneralOperatorCheckbox.checked = proposal.include_general_operator || false;
    }


    equipmentProposalItemsContainer.innerHTML = '';
    // 'proposal.items' já deve vir como objeto/array do banco de dados (da última correção).
    const items = proposal.items || []; 
    items.forEach(item => {
        addEquipmentProposalItemRow();
        const lastRow = equipmentProposalItemsContainer.lastElementChild;
        if (lastRow) {
            const equipmentSelect = lastRow.querySelector('.equipment-select');
            equipmentSelect.value = item.equipment_id;
            const event = new Event('change');
            equipmentSelect.dispatchEvent(event); // Dispara para atualizar os detalhes do equipamento e aplicar padrões

            const quantityInput = lastRow.querySelector('.item-quantity'); // Preenche a quantidade
            if (quantityInput) {
                quantityInput.value = item.quantity || 1;
            }

            lastRow.querySelector('.value-type-select').value = item.value_type;
            lastRow.querySelector('.item-value').value = item.value;
            if (item.value_type === 'personalizado') {
                lastRow.querySelector('.custom-value-description').style.display = 'flex';
                lastRow.querySelector('.custom-value-description-input').value = item.custom_value_description || '';
            } else {
                lastRow.querySelector('.custom-value-description').style.display = 'none';
            }
            lastRow.querySelector('.min-guaranteed-hours').value = item.min_guaranteed_hours || '';
            lastRow.querySelector('.mobilization-cost').value = item.mobilization_cost || '';
            lastRow.querySelector('.demobilization-cost').value = item.demobilization_cost || '';
            
            const foodCheckbox = lastRow.querySelector('.include-food-checkbox');
            const foodSelect = lastRow.querySelector('.food-responsible-select');
            foodCheckbox.checked = item.include_food || false;
            foodSelect.disabled = !foodCheckbox.checked;
            foodSelect.value = item.food_responsible || 'contratada';

            const lodgingCheckbox = lastRow.querySelector('.include-lodging-checkbox');
            const lodgingSelect = lastRow.querySelector('.lodging-responsible-select');
            lodgingCheckbox.checked = item.include_lodging || false;
            lodgingSelect.disabled = !lodgingCheckbox.checked;
            lodgingSelect.value = item.lodging_responsible || 'contratada';

            const fuelCheckbox = lastRow.querySelector('.include-fuel-checkbox');
            const fuelSelect = lastRow.querySelector('.fuel-responsible-select');
            fuelCheckbox.checked = item.include_fuel || false;
            fuelSelect.disabled = !fuelCheckbox.checked;
            fuelSelect.value = item.fuel_responsible || 'contratada';
            
            // NOVO: Preenche a checkbox "Com Operador" ao editar
            const operatorCheckbox = lastRow.querySelector('.include-operator-checkbox');
            if (operatorCheckbox) {
                operatorCheckbox.checked = item.include_operator || false;
            }

            lastRow.querySelector('.item-observations').value = item.observations || '';
            lastRow.querySelector('.equipment-image-url-manual').value = item.manual_image_url || '';

            // Preenche o estado das checkboxes de exibição no PDF
            lastRow.querySelector('.include-prefix-pdf-checkbox').checked = item.include_prefix_pdf || false;
            lastRow.querySelector('.include-brand-pdf-checkbox').checked = item.include_brand_pdf || false;
            lastRow.querySelector('.include-model-pdf-checkbox').checked = item.include_model_pdf || false;
            lastRow.querySelector('.include-year-pdf-checkbox').checked = item.include_year_pdf || false;
            lastRow.querySelector('.include-capacity-pdf-checkbox').checked = item.include_capacity_pdf !== undefined ? item.include_capacity_pdf : true; // Padrão marcado
            lastRow.querySelector('.include-chassi-pdf-checkbox').checked = item.include_chassi_pdf || false;
            lastRow.querySelector('.include-characteristic-pdf-checkbox').checked = item.include_characteristic_pdf !== undefined ? item.include_characteristic_pdf : true; // Novo: padrão marcado
        }
    });

    saveEquipmentProposalBtn.dataset.id = id;
    saveEquipmentProposalBtn.textContent = 'Atualizar Proposta';
    proposalsSection.scrollIntoView({ behavior: 'smooth' });
};

/**
 * Exclui uma proposta de equipamento.
 * @param {string} id - ID da proposta a ser excluída.
 */
const deleteEquipmentProposal = async (id) => {
    const confirmDelete = await new Promise(resolve => {
        showModal('Confirmar Exclusão', 'Tem certeza que deseja excluir esta proposta de equipamento?<br><br><button id="confirm-delete-btn" class="btn btn-danger">Sim, Excluir</button> <button id="cancel-delete-btn" class="btn btn-secondary">Cancelar</button>');
        document.getElementById('confirm-delete-btn').onclick = () => { resolve(true); hideModal(); };
        document.getElementById('cancel-delete-btn').onclick = () => { resolve(false); hideModal(); };
    });

    if (!confirmDelete) {
        return;
    }
    showSpinner();
    try {
        await apiClient.deleteItem('equipment_proposals', id);
        showModal('Sucesso!', 'Proposta de equipamento excluída com sucesso!');
        loadAndRenderEquipmentProposals();
    } catch (error) {
        console.error('Erro ao excluir proposta de equipamento:', error);
        showModal('Erro ao Excluir Proposta', `Erro ao excluir proposta de equipamento: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Gera o PDF de uma proposta de equipamento.
 * @param {string} id - ID da proposta a ser gerada.
 */
const generateEquipmentProposalPDF = (id) => {
    const proposal = appState.equipment_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada para gerar PDF.');
        return;
    }

    const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
    const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);

    if (!myCompany) {
        showModal('Dados Incompletos', 'Dados da empresa fornecedora não encontrados para gerar PDF.');
        return;
    }

    const dataForPDF = {
        ...proposal,
        my_company: myCompany,
        client_company: clientCompany,
        // 'proposal.items' já deve vir como objeto/array do banco de dados.
        items: proposal.items || [] 
    };

    exportEquipmentProposalPDF(dataForPDF);
};

/**
 * Visualiza proposta de equipamento em nova aba do navegador.
 */
const viewEquipmentProposalPDF = async (id) => {
    const proposal = appState.equipment_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada para visualizar PDF.');
        return;
    }
    const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
    const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);
    if (!myCompany) {
        showModal('Dados Incompletos', 'Dados da empresa fornecedora não encontrados.');
        return;
    }
    const dataForPDF = { ...proposal, my_company: myCompany, client_company: clientCompany, items: proposal.items || [] };
    try {
        const blob = await exportEquipmentProposalPDF(dataForPDF, true);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
        showModal('Erro ao Visualizar PDF', 'Não foi possível gerar a visualização. Detalhes: ' + err.message);
    }
};

/**
 * Envia proposta de equipamento via WhatsApp
 */
const sendEquipmentProposalViaWhatsApp = async (id) => {
    const proposal = appState.equipment_proposals.find(p => p.id == id);
    if (!proposal) {
        showModal('Proposta Não Encontrada', 'Proposta não encontrada.');
        return;
    }

    // Abre a nova aba AGORA (contexto síncrono do clique) para evitar bloqueio de popup
    // A URL será definida depois que o link do WhatsApp estiver pronto
    const newTab = window.open('about:blank', '_blank');

    try {
        showSpinner();
        
        const clientCompany = appState.client_companies.find(c => c.id == proposal.client_company_id);
        const myCompany = appState.my_companies.find(m => m.id == proposal.my_company_id);
        const clientName = clientCompany?.name || 'Cliente';
        
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

        // Gerar PDF como blob
        const { exportEquipmentProposalPDF } = await import('./proposals_equipment_pdf.js?v=20260302020000');
        const pdfBlob = await exportEquipmentProposalPDF(dataForPDF, true);
        
        if (!pdfBlob) {
            alert('Erro ao gerar PDF!');
            hideSpinner();
            return;
        }

        // Upload para Google Drive
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        
        reader.onloadend = async () => {
            try {
                const base64Data = reader.result;
                const proposalDate = new Date(proposal.proposal_date).toLocaleDateString('pt-BR').replace(/\//g, '_');
                const fileName = `Proposta_Equipamentos_${clientName}_${proposalDate}.pdf`;
                
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
                    const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                    const message = `📄 Olá! Segue a proposta de equipamentos para *${clientName}*.\n\n🔗 Link do PDF:\n${driveLink}\n\nQualquer dúvida, estamos à disposição!`;
                    const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=${encodeURIComponent(message)}`;
                    
                    // Redireciona a aba já aberta para o WhatsApp (sem fechar o site)
                    newTab.location.href = whatsappLink;
                } else {
                    newTab.close();
                    alert('❌ Erro ao fazer upload para o Google Drive: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                newTab.close();
                console.error('❌ Erro:', error);
                alert('❌ Erro ao processar: ' + error.message);
            } finally {
                hideSpinner();
            }
        };
        
    } catch (error) {
        newTab.close();
        console.error('❌ Erro ao enviar via WhatsApp:', error);
        alert('❌ Erro: ' + error.message);
        hideSpinner();
    }
};

/**
 * Reseta o formulário de proposta de equipamento.
 */
const resetEquipmentProposalForm = () => {
    equipmentProposalClientCompanySelect.value = '';
    equipmentProposalMyCompanySelect.value = '';
    // Reseta a data para a data local correta
    equipmentProposalDateInput.value = getLocalDateString();
    
    equipmentProposalCnpjInput.value = '';
    if (equipmentProposalNameComplementInput) {
        equipmentProposalNameComplementInput.value = '';
    }
    equipmentProposalObservationsTextarea.value = '';
    
    // Reseta os novos campos de valores padrão
    if (defaultMobilizationRollingInput) defaultMobilizationRollingInput.value = '';
    if (defaultDemobilizationRollingInput) defaultDemobilizationRollingInput.value = '';
    if (defaultMobilizationNonRollingInput) defaultMobilizationNonRollingInput.value = '';
    if (defaultDemobilizationNonRollingInput) defaultDemobilizationNonRollingInput.value = '';
    if (defaultMinGuaranteedHoursInput) defaultMinGuaranteedHoursInput.value = '';

    // NOVO: Reseta o estado das checkboxes de controle do PDF
    if (addQuantityCheckbox) {
        addQuantityCheckbox.checked = false;
        toggleQuantityInputs(); // Esconde os campos de quantidade
    }
    if (includeTermsPdfCheckbox) {
        includeTermsPdfCheckbox.checked = true; // Padrão true
    }
    if (includeImagesPdfCheckbox) {
        includeImagesPdfCheckbox.checked = true; // Padrão true
    }
    if (includeCnpjPdfCheckbox) {
        includeCnpjPdfCheckbox.checked = false; // NOVO: Padrão false para CNPJ
    }
    
    // NOVOS: Reseta o estado das novas checkboxes de custos gerais
    if (includeGeneralFoodCheckbox) {
        includeGeneralFoodCheckbox.checked = false;
        generalFoodResponsibleSelect.disabled = true;
        generalFoodResponsibleSelect.value = 'contratada';
    }
    if (includeGeneralLodgingCheckbox) {
        includeGeneralLodgingCheckbox.checked = false;
        generalLodgingResponsibleSelect.disabled = true;
        generalLodgingResponsibleSelect.value = 'contratada';
    }
    if (includeGeneralFuelCheckbox) {
        includeGeneralFuelCheckbox.checked = false;
        generalFuelResponsibleSelect.disabled = true;
        generalFuelResponsibleSelect.value = 'contratada';
    }
    if (includeGeneralOperatorCheckbox) {
    includeGeneralOperatorCheckbox.checked = false;
    }

    equipmentProposalItemsContainer.innerHTML = '';
    saveEquipmentProposalBtn.dataset.id = '';
    saveEquipmentProposalBtn.textContent = 'Salvar Proposta';
    addEquipmentProposalItemRow(); // Adiciona uma linha vazia padrão, que terá as checkboxes desmarcadas por padrão

    if (equipmentProposalOwnerNameDisplay) {
        equipmentProposalOwnerNameDisplay.textContent = 'Não informado';
    }
    if (equipmentProposalOwnerPhoneDisplay) {
        equipmentProposalOwnerPhoneDisplay.textContent = 'Não informado';
    }
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
 * Manipula o clique no botão de enviar email da proposta de equipamento
 */
const handleSendEquipmentProposalEmail = async (proposalId) => {
    showSpinner();
    try {
        const proposal = appState.equipment_proposals.find(p => p.id == proposalId);
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
            client_company: clientCompany,
            items: proposal.items || []
        };

        // Gerar o PDF da proposta
        const pdfBlob = await exportEquipmentProposalPDF(dataForPDF, true); // true para retornar blob
        
        if (!pdfBlob) {
            alert('Não foi possível gerar o PDF da proposta.');
            return;
        }

        // Usar os dados da empresa cliente já buscados anteriormente
        const clientName = clientCompany?.name || 'Cliente';
        
        // Verificar se o nome da empresa é "PROPOSTA DE EQUIPAMENTOS"
        const isGenericName = clientName.toUpperCase().includes('PROPOSTA DE EQUIPAMENTO');
        
        // Data de hoje formatada
        const today = new Date().toLocaleDateString('pt-BR');
        
        // Montar o assunto do email
        const emailSubject = isGenericName 
            ? `PROPOSTA DE EQUIPAMENTO(S) - ${today}`
            : `PROPOSTA DE EQUIPAMENTO(S) - ${clientName} - ${today}`;
        
        // Corpo do email em texto puro
        const emailBodyText = `Prezado(s)\n\n` +
                              `Segue proposta de equipamento(s) como solicitado.\n\n` +
                              `Permanecemos à disposição para quaisquer esclarecimentos.\n\n` +
                              `--\n\n` +
                              `Atenciosamente,\n\n` +
                              `RICARDO CAMPOS - PBA`;

        // Corpo do email em HTML
        const emailBodyHtml = `
            <p>Prezado(s)</p>
            <p>Segue proposta de equipamento(s) como solicitado.</p>
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

        openEmailPreparationModal(proposal, pdfBlob, emailSubject, emailBodyText, emailBodyHtml, defaultRecipients, defaultCc, defaultBcc, 'equipment');

    } catch (error) {
        console.error('Erro ao preparar email da proposta:', error);
        alert(`Erro ao preparar email: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Abre modal para preparação e envio de email
 */
const openEmailPreparationModal = (proposal, pdfBlob, subject, bodyText, bodyHtml, defaultRecipients, defaultCc, defaultBcc, proposalType) => {
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
        a.download = `Proposta_${proposalType}_${proposal.id}.pdf`;
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
            const attachmentFileName = `Proposta_${proposalType}_${proposal.id}.pdf`;

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