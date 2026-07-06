// lancamentos_areia.js - Módulo para Fornecimento de Areia
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatInputDate, formatMonthYear, createConfirmationModal, addPdfCoverPage } from './utils.js';
import { apiClient } from './api.js';

// ====================================================================
// Sub-seção: Lançamentos de Fornecimento de Areia (Configuração Principal)
// ====================================================================

// Elementos do DOM para a Configuração de Fornecimento de Areia
const sandSection = document.getElementById('sand-section');
const sandSupplyMyCompanySelect = document.getElementById('sand-supply-my-company');
const sandSupplyClientCompanySelect = document.getElementById('sand-supply-client-company');
const sandSupplyOutputLocationInput = document.getElementById('sand-supply-output-location');
const sandSupplyDeliveryLocationInput = document.getElementById('sand-supply-delivery-location');
const sandSupplyPriceM3Input = document.getElementById('sand-supply-price-m3');
const sandSupplyLastInvoiceDateInput = document.getElementById('sand-supply-last-invoice-date');
const sandSupplyObservationsTextarea = document.getElementById('sand-supply-observations');
const saveSandSupplyBtn = document.getElementById('save-sand-supply-btn');
const cancelEditSandSupplyBtn = document.getElementById('cancel-edit-sand-supply-btn');
const sandSupplyTableBody = document.querySelector('#sand-supply-table tbody');

// Variável para controle de edição de configuração de fornecimento
let editingSandSupplyConfigId = null;

/**
 * Inicializa a seção de Fornecimento de Areia.
 * Configura os event listeners para as sub-abas e carrega dados iniciais.
 */
export const initSandSection = async () => {
    showSpinner();
    try {
        // Garante que os dados básicos estejam carregados
        if (appState.my_companies.length === 0) {
            appState.my_companies = await apiClient.fetchData('my_companies');
        }
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }
        if (appState.equipment.length === 0) {
            appState.equipment = await apiClient.fetchData('equipment', '*, my_companies(name)'); // Inclui my_companies
        }

        // Configura os event listeners para as sub-abas
        sandSection.querySelectorAll('.report-type-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const reportType = e.target.dataset.sandReport;
                sandSection.querySelectorAll('.report-type-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                sandSection.querySelectorAll('.report-content').forEach(content => content.style.display = 'none');
                document.getElementById(reportType).style.display = 'block';
                
                // Inicializa a sub-seção correta
                if (reportType === 'sand-supply-entries-sub') {
                    initSandSupplyEntries();
                } else if (reportType === 'sand-invoices-report-sub') {
                    initSandInvoicesReport();
                } else if (reportType === 'sand-latest-prices-report-sub') {
                    initSandLatestPricesReport();
                }
            });
        });

        // Inicializa a aba padrão (Lançamentos de Fornecimento de Areia)
        await initSandSupplyEntries();

    } catch (error) {
        console.error('Erro ao inicializar seção de Areia:', error);
        alert(`Erro ao carregar dados da seção de Areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Inicializa a sub-seção de Lançamentos de Fornecimento de Areia (Configuração Principal).
 */
const initSandSupplyEntries = async () => {
    // Popula dropdowns
    if (sandSupplyMyCompanySelect) {
        sandSupplyMyCompanySelect.innerHTML = '<option value="">Selecione...</option>' + 
            appState.my_companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (sandSupplyClientCompanySelect) {
        sandSupplyClientCompanySelect.innerHTML = '<option value="">Selecione...</option>' + 
            appState.client_companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Event listeners para botões de salvar/cancelar
    if (saveSandSupplyBtn) {
        saveSandSupplyBtn.addEventListener('click', saveSandSupplyConfig);
    }
    if (cancelEditSandSupplyBtn) {
        cancelEditSandSupplyBtn.addEventListener('click', cancelEditSandSupplyConfig);
    }

    // Carrega e renderiza configurações existentes
    await loadAndRenderSandSupplyConfigs();
    resetSandSupplyForm(); // Garante que o formulário esteja limpo ao iniciar
};

/**
 * Salva uma nova configuração de fornecimento de areia ou atualiza uma existente.
 */
const saveSandSupplyConfig = async () => {
    const myCompanyId = sandSupplyMyCompanySelect.value;
    const clientCompanyId = sandSupplyClientCompanySelect.value;
    const outputLocation = sandSupplyOutputLocationInput.value || 'AREAL';
    const deliveryLocation = sandSupplyDeliveryLocationInput.value;
    const priceM3 = parseFloat(sandSupplyPriceM3Input.value);
    const lastInvoiceDate = sandSupplyLastInvoiceDateInput.value || null;
    const observations = sandSupplyObservationsTextarea.value || null;

    if (!myCompanyId || !clientCompanyId || !deliveryLocation || isNaN(priceM3) || priceM3 <= 0) {
        alert('Por favor, preencha todos os campos obrigatórios (Minha Empresa, Cliente, Local de Entrega, Valor do M³).');
        return;
    }

    const configData = {
        my_company_id: myCompanyId,
        client_company_id: clientCompanyId,
        output_location: outputLocation,
        delivery_location: deliveryLocation,
        price_m3: priceM3,
        last_invoice_date: lastInvoiceDate,
        observations: observations
    };

    showSpinner();
    try {
        if (editingSandSupplyConfigId) {
            await apiClient.updateSandSupplyConfig(editingSandSupplyConfigId, configData);
            alert('Configuração de fornecimento de areia atualizada com sucesso!');
        } else {
            await apiClient.addSandSupplyConfig(configData);
            alert('Configuração de fornecimento de areia salva com sucesso!');
        }
        resetSandSupplyForm();
        await loadAndRenderSandSupplyConfigs();
    } catch (error) {
        console.error('Erro ao salvar configuração de fornecimento de areia:', error);
        alert(`Erro ao salvar configuração de fornecimento de areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Carrega e renderiza as configurações de fornecimento de areia existentes.
 */
const loadAndRenderSandSupplyConfigs = async () => {
    showSpinner();
    sandSupplyTableBody.innerHTML = '';
    try {
        const configs = await apiClient.fetchSandSupplyConfigs();
        appState.sand_supply_configs = configs; // Armazena no appState

        if (configs.length === 0) {
            sandSupplyTableBody.innerHTML = `<tr><td colspan="6">Nenhuma configuração de fornecimento de areia cadastrada.</td></tr>`;
            hideSpinner();
            return;
        }

        configs.forEach(config => {
            const row = document.createElement('tr');
            const myCompanyName = config.my_company?.name || 'N/A';
            const clientCompanyName = config.client_company?.name || 'N/A';

            row.innerHTML = `
                <td data-label="Fornecedor">${myCompanyName}</td>
                <td data-label="Cliente">${clientCompanyName}</td>
                <td data-label="Local Saída">${config.output_location || 'AREAL'}</td>
                <td data-label="Local Entrega">${config.delivery_location}</td>
                <td data-label="Valor M³">${formatCurrency(config.price_m3)}</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${config.id}" data-action="manage-deliveries">Lançamentos</button>
                    <button class="btn btn-secondary btn-sm" data-id="${config.id}" data-action="edit-supply">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${config.id}" data-action="delete-supply">Excluir</button>
                </td>
            `;
            sandSupplyTableBody.appendChild(row);
        });

        sandSupplyTableBody.querySelectorAll('[data-action="manage-deliveries"]').forEach(btn => {
            btn.addEventListener('click', (e) => openSandDeliveriesModal(e.target.dataset.id));
        });
        sandSupplyTableBody.querySelectorAll('[data-action="edit-supply"]').forEach(btn => {
            btn.addEventListener('click', (e) => editSandSupplyConfig(e.target.dataset.id));
        });
        sandSupplyTableBody.querySelectorAll('[data-action="delete-supply"]').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSandSupplyConfig(e.target.dataset.id));
        });

    } catch (error) {
        console.error('Erro ao carregar configurações de fornecimento de areia:', error);
        alert(`Erro ao carregar configurações de fornecimento de areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Preenche o formulário para edição de uma configuração de fornecimento de areia.
 * @param {number} configId - ID da configuração a ser editada.
 */
const editSandSupplyConfig = (configId) => {
    const config = appState.sand_supply_configs.find(c => c.id == configId);
    if (!config) {
        alert('Configuração não encontrada para edição.');
        return;
    }

    editingSandSupplyConfigId = configId;
    saveSandSupplyBtn.textContent = 'Atualizar Configuração';
    saveSandSupplyBtn.classList.remove('btn-primary');
    saveSandSupplyBtn.classList.add('btn-warning');
    cancelEditSandSupplyBtn.style.display = 'inline-block';

    sandSupplyMyCompanySelect.value = config.my_company_id;
    sandSupplyClientCompanySelect.value = config.client_company_id;
    sandSupplyOutputLocationInput.value = config.output_location || '';
    sandSupplyDeliveryLocationInput.value = config.delivery_location;
    sandSupplyPriceM3Input.value = config.price_m3;
    sandSupplyLastInvoiceDateInput.value = formatInputDate(config.last_invoice_date, 'date');
    sandSupplyObservationsTextarea.value = config.observations || '';

    sandSection.scrollIntoView({ behavior: 'smooth' });
};

/**
 * Cancela a edição e reseta o formulário de configuração de fornecimento de areia.
 */
const cancelEditSandSupplyConfig = () => {
    editingSandSupplyConfigId = null;
    saveSandSupplyBtn.textContent = 'Salvar Configuração';
    saveSandSupplyBtn.classList.remove('btn-warning');
    saveSandSupplyBtn.classList.add('btn-primary');
    cancelEditSandSupplyBtn.style.display = 'none';
    resetSandSupplyForm();
};

/**
 * Reseta o formulário de configuração de fornecimento de areia.
 */
const resetSandSupplyForm = () => {
    editingSandSupplyConfigId = null;
    sandSupplyMyCompanySelect.value = '';
    sandSupplyClientCompanySelect.value = '';
    sandSupplyOutputLocationInput.value = '';
    sandSupplyDeliveryLocationInput.value = '';
    sandSupplyPriceM3Input.value = '0';
    sandSupplyLastInvoiceDateInput.value = '';
    sandSupplyObservationsTextarea.value = '';
    saveSandSupplyBtn.textContent = 'Salvar Configuração';
    saveSandSupplyBtn.classList.remove('btn-warning');
    saveSandSupplyBtn.classList.add('btn-primary');
    cancelEditSandSupplyBtn.style.display = 'none';
};

/**
 * Exclui uma configuração de fornecimento de areia.
 * @param {number} configId - ID da configuração a ser excluída.
 */
const deleteSandSupplyConfig = async (configId) => {
    openModal('Confirmar Exclusão', createConfirmationModal(async () => {
        showSpinner();
        try {
            await apiClient.deleteSandSupplyConfig(configId);
            alert('Configuração de fornecimento de areia excluída com sucesso!');
            await loadAndRenderSandSupplyConfigs();
            if (editingSandSupplyConfigId === configId) {
                cancelEditSandSupplyConfig();
            }
        } catch (error) {
            console.error('Erro ao excluir configuração de fornecimento de areia:', error);
            alert(`Erro ao excluir configuração de fornecimento de areia: ${error.message}`);
        } finally {
            hideSpinner();
        }
    }, 'Tem certeza que deseja excluir esta configuração e todas as suas entregas associadas? Esta ação não pode ser desfeita.', 'Excluir'));
};

// ====================================================================
// Sub-seção: Lançamentos de Entregas de Areia (Modal de Detalhes)
// ====================================================================

// Elementos do DOM do Modal de Lançamentos de Entrega de Areia
const currentSandSupplyConfigDisplay = document.getElementById('current-sand-supply-config-display');
const sandDeliveryNotesInput = document.getElementById('sand-delivery-notes');
const addSandDeliveryBtn = document.getElementById('add-sand-delivery-btn');
const cancelEditSandDeliveryBtn = document.getElementById('cancel-edit-sand-delivery-btn');
const sandDeliveriesTableBody = document.querySelector('#sand-deliveries-table tbody');
const sandDeliveryPdfCoverCheckbox = document.getElementById('sand-delivery-pdf-cover-checkbox');
const generateSandDeliveryPdfEmittedBtn = document.getElementById('generate-sand-delivery-pdf-emitted-btn');
const generateSandDeliveryPdfPendingBtn = document.getElementById('generate-sand-delivery-pdf-pending-btn');

// 🆕 NOVO: Container para múltiplas viagens
const addSandTripBtn = document.getElementById('add-sand-trip-btn');
const sandTripsRowsContainer = document.getElementById('sand-trips-rows-container');
let sandTripRowsData = [];

let currentSupplyConfigId = null;
let currentSupplyConfig = null; // Armazena a config atual para acesso fácil
let editingSandDeliveryId = null;

// 🆕 FUNÇÃO: Adiciona uma linha de viagem
const addSandTripRow = (data = {}) => {
    const rowId = Date.now() + Math.random();
    const row = document.createElement('div');
    row.className = 'equipment-row sand-trip-row';
    row.dataset.rowId = rowId;
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 2fr 1.5fr auto 0.5fr; gap: 10px; margin-bottom: 10px; align-items: end; border: 1px solid #ddd; padding: 10px; border-radius: 5px;';
    
    // 📦 COMBOBOX: Empresas Clientes
    const clientCompaniesOptions = '<option value="">Selecione...</option>' + 
        appState.client_companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // 📦 COMBOBOX: Obras (será preenchido dinamicamente quando selecionar empresa)
    const worksOptions = '<option value="">Selecione empresa primeiro</option>';
    
    row.innerHTML = `
        <div>
            <label style="font-size: 0.85em; color: #aaa;">Nº Romaneio</label>
            <input type="text" class="romaneio-input" value="${data.romaneio || ''}" placeholder="Ex: 001" style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff;" required>
        </div>
        <div>
            <label style="font-size: 0.85em; color: #aaa;">Empresa Contratante</label>
            <select class="client-company-select" style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff;" required>
                ${clientCompaniesOptions}
            </select>
        </div>
        <div>
            <label style="font-size: 0.85em; color: #aaa;">Obra</label>
            <select class="work-select" style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff;" required>
                ${worksOptions}
            </select>
        </div>
        <div>
            <label style="font-size: 0.85em; color: #aaa;">Data</label>
            <input type="date" class="date-input" value="${data.date || ''}" style="width: 100%; padding: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff;" required>
        </div>
        <div>
            <label style="font-size: 0.85em; color: #aaa;">Qtd Viagens</label>
            <input type="number" class="trip-count-input" value="${data.tripCount || 1}" min="1" style="width: 80px; padding: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; text-align: center;" required>
        </div>
        <div style="display: flex; align-items: end;">
            <button type="button" class="remove-trip-btn" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; font-size: 18px;">×</button>
        </div>
    `;
    
    // Event listener para remover linha
    row.querySelector('.remove-trip-btn').addEventListener('click', () => {
        row.remove();
        sandTripRowsData = sandTripRowsData.filter(r => r.rowId !== rowId);
    });
    
    // Event listener para atualizar obras quando empresa mudars
    const clientSelect = row.querySelector('.client-company-select');
    const workSelect = row.querySelector('.work-select');
    
    clientSelect.addEventListener('change', () => {
        const clientId = clientSelect.value;
        if (clientId) {
            // Filtra obras dessa empresa cliente
            const clientWorks = appState.works.filter(w => w.client_company_id == clientId);
            workSelect.innerHTML = '<option value="">Selecione...</option>' + 
                clientWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        } else {
            workSelect.innerHTML = '<option value="">Selecione empresa primeiro</option>';
        }
    });
    
    // Se tem dados, preenche
    if (data.clientCompanyId) {
        clientSelect.value = data.clientCompanyId;
        // Trigger change para popular obras
        clientSelect.dispatchEvent(new Event('change'));
        setTimeout(() => {
            if (data.workId) {
                workSelect.value = data.workId;
            }
        }, 100);
    }
    
    sandTripsRowsContainer.appendChild(row);
    sandTripRowsData.push({ rowId, element: row });
    
    return row;
};

// 🆕 FUNÇÃO: Limpa todas as viagens
const clearSandTrips = () => {
    sandTripsRowsContainer.innerHTML = '';
    sandTripRowsData = [];
};

// O listener do botão add-sand-trip é gerenciado pela v2 (lancamentos_areia_v2.js)

/**
 * Abre o modal para gerenciar os lançamentos de entrega de areia para uma configuração.
 * @param {number} supplyConfigId - ID da configuração de fornecimento.
 */
const openSandDeliveriesModal = async (supplyConfigId) => {
    showSpinner();
    currentSupplyConfigId = supplyConfigId;
    currentSupplyConfig = appState.sand_supply_configs.find(c => c.id == supplyConfigId);

    if (!currentSupplyConfig) {
        alert('Configuração de fornecimento não encontrada.');
        hideSpinner();
        return;
    }

    // Exibe o nome da configuração no cabeçalho do modal
    if (currentSandSupplyConfigDisplay) {
        const myCompanyName = appState.my_companies.find(mc => mc.id == currentSupplyConfig.my_company_id)?.name || 'N/A';
        const clientCompanyName = appState.client_companies.find(cc => cc.id == currentSupplyConfig.client_company_id)?.name || 'N/A';
        currentSandSupplyConfigDisplay.textContent = `${myCompanyName} para ${clientCompanyName} (Entrega: ${currentSupplyConfig.delivery_location})`;
    }

    // 🆕 Carrega obras se necessário
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works');
    }

    // Event listener para botão de salvar lançamento
    if (addSandDeliveryBtn) {
        addSandDeliveryBtn.removeEventListener('click', saveSandDelivery); // Remove anterior
        addSandDeliveryBtn.addEventListener('click', saveSandDelivery);
    }
    if (cancelEditSandDeliveryBtn) {
        cancelEditSandDeliveryBtn.removeEventListener('click', cancelEditSandDelivery);
        cancelEditSandDeliveryBtn.addEventListener('click', cancelEditSandDelivery);
    }

    // Botões de PDF
    if (generateSandDeliveryPdfEmittedBtn) {
        generateSandDeliveryPdfEmittedBtn.removeEventListener('click', () => generateSandDeliveryPdf('EMITIDA'));
        generateSandDeliveryPdfEmittedBtn.addEventListener('click', () => generateSandDeliveryPdf('EMITIDA'));
    }
    if (generateSandDeliveryPdfPendingBtn) {
        generateSandDeliveryPdfPendingBtn.removeEventListener('click', () => generateSandDeliveryPdf('NAO_EMITIDA'));
        generateSandDeliveryPdfPendingBtn.addEventListener('click', () => generateSandDeliveryPdf('NAO_EMITIDA'));
    }

    // Exibe a sub-seção de entregas
    document.getElementById('sand-supply-entries-sub').style.display = 'none';
    document.getElementById('sand-deliveries-sub').style.display = 'block';

    await loadAndRenderSandDeliveries(currentSupplyConfigId);
    resetSandDeliveryForm();
    
    // 🆕 Adiciona primeira viagem automaticamente
    clearSandTrips();
    addSandTripRow();
    
    hideSpinner();
};

// 🗑️ FUNÇÕES ANTIGAS REMOVIDAS (updateDeliveryDateDisplay, updateEquipmentInfoDisplay, updateDeliveryValue, updateInvoiceStatusAuto)
// Não são mais necessárias com o novo sistema de múltiplas viagens

/**
 * Salva múltiplos lançamentos de entrega de areia de uma vez.
 */
const saveSandDelivery = async () => {
    // 🆕 VALIDAÇÃO: Verifica se há viagens adicionadas
    const tripRows = document.querySelectorAll('.sand-trip-row');
    if (tripRows.length === 0) {
        alert('⚠️ Adicione pelo menos uma viagem!');
        return;
    }
    
    // 🆕 COLETA DADOS DE TODAS AS VIAGENS
    const tripsData = [];
    let hasErrors = false;
    
    tripRows.forEach((row, index) => {
        const romaneio = row.querySelector('.romaneio-input').value.trim();
        const clientCompanyId = row.querySelector('.client-company-select').value;
        const workId = row.querySelector('.work-select').value;
        const date = row.querySelector('.date-input').value;
        const tripCount = parseInt(row.querySelector('.trip-count-input').value) || 1;
        
        // Validação
        if (!romaneio || !clientCompanyId || !workId || !date) {
            alert(`⚠️ Preencha todos os campos da viagem ${index + 1}!`);
            hasErrors = true;
            return;
        }
        
        tripsData.push({
            romaneio,
            clientCompanyId,
            workId,
            date,
            tripCount
        });
    });
    
    if (hasErrors) return;
    
    // Observações gerais
    const notes = sandDeliveryNotesInput.value || null;
    
    try {
        showSpinner();
        
        // 🆕 SALVA CADA VIAGEM (com quantidade de viagens)
        for (const trip of tripsData) {
            const deliveryData = {
                supply_config_id: currentSupplyConfigId,
                delivery_code: trip.romaneio,
                delivery_date: trip.date,
                equipment_id: null, // Não usamos mais equipamento individual
                volume_m3: trip.tripCount, // Quantidade de viagens
                total_value: 0, // Será calculado no backend se necessário
                notes: notes,
                invoice_status: 'NAO_EMITIDA',
                work_id: trip.workId,
                client_company_id: trip.clientCompanyId
            };
            
            await apiClient.upsertItem('sand_deliveries', deliveryData);
        }
        
        alert(`✅ ${tripsData.length} lançamento(s) adicionado(s) com sucesso!`);
        await loadAndRenderSandDeliveries(currentSupplyConfigId);
        resetSandDeliveryForm();
        clearSandTrips();
        addSandTripRow(); // Adiciona nova linha vazia
        
    } catch (error) {
        console.error('❌ Erro ao salvar entregas:', error);
        alert(`Erro ao salvar entregas: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Cancela edição e reseta formulário.
 */
const cancelEditSandDelivery = () => {
    editingSandDeliveryId = null;
    resetSandDeliveryForm();
    clearSandTrips();
    addSandTripRow();
};

/**
 * Reseta o formulário de entregas.
 */
const resetSandDeliveryForm = () => {
    editingSandDeliveryId = null;
    if (sandDeliveryNotesInput) {
        sandDeliveryNotesInput.value = '';
    }
    if (addSandDeliveryBtn) {
        addSandDeliveryBtn.textContent = 'ADICIONAR LANÇAMENTO';
        addSandDeliveryBtn.classList.remove('btn-warning');
        addSandDeliveryBtn.classList.add('btn-primary');
    }
    if (cancelEditSandDeliveryBtn) {
        cancelEditSandDeliveryBtn.style.display = 'none';
    }
};

/**
 * Cancela edição e volta para a lista de configurações.
 */
const closeSandDeliveriesModal = () => {
    document.getElementById('sand-deliveries-sub').style.display = 'none';
    document.getElementById('sand-supply-entries-sub').style.display = 'block';
    currentSupplyConfigId = null;
    currentSupplyConfig = null;
    editingSandDeliveryId = null;
    clearSandTrips();
};

/**
 * Carrega e renderiza os lançamentos de entrega de areia para uma configuração.
 * @param {number} supplyConfigId - ID da configuração de fornecimento.
 */
const loadAndRenderSandDeliveries = async (supplyConfigId) => {
    showSpinner();
    sandDeliveriesTableBody.innerHTML = '';
    try {
        const deliveries = await apiClient.fetchSandDeliveries(supplyConfigId);
        appState.sand_deliveries = deliveries; // Armazena no appState

        if (deliveries.length === 0) {
            sandDeliveriesTableBody.innerHTML = `<tr><td colspan="7">Nenhum lançamento de entrega de areia para esta configuração.</td></tr>`;
            // Esconde botões de PDF se não houver entregas
            generateSandDeliveryPdfEmittedBtn.style.display = 'none';
            generateSandDeliveryPdfPendingBtn.style.display = 'none';
            hideSpinner();
            return;
        }

        deliveries.forEach(delivery => {
            const row = document.createElement('tr');
            const equipmentDisplay = `${delivery.equipment?.prefix || 'N/A'} - ${delivery.equipment?.type || 'N/A'}`;
            const deliveryDate = new Date(delivery.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR');
            const totalValue = formatCurrency(delivery.total_value || 0);
            
            let statusText = '';
            let statusClass = '';
            switch (delivery.invoice_status) {
                case 'EMITIDA':
                    statusText = 'Emitida';
                    statusClass = 'status-emitted'; // Adicionar classe CSS para verde
                    break;
                case 'NAO_EMITIDA':
                    statusText = 'Não Emitida';
                    statusClass = 'status-pending'; // Adicionar classe CSS para laranja/vermelho
                    break;
                default:
                    statusText = 'Nenhum';
                    statusClass = '';
                    break;
            }

            row.innerHTML = `
                <td data-label="Romaneio">${delivery.delivery_code}</td>
                <td data-label="Data">${deliveryDate}</td>
                <td data-label="Equipamento">${equipmentDisplay}</td>
                <td data-label="Volume (m³)">${(delivery.volume_m3 || 0).toFixed(2)}</td>
                <td data-label="Valor (R$)">${totalValue}</td>
                <td data-label="Status Nota" class="${statusClass}">${statusText}</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${delivery.id}" data-action="edit-delivery">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${delivery.id}" data-action="delete-delivery">Excluir</button>
                </td>
            `;
            sandDeliveriesTableBody.appendChild(row);
        });

        sandDeliveriesTableBody.querySelectorAll('[data-action="edit-delivery"]').forEach(btn => {
            btn.addEventListener('click', (e) => editSandDelivery(e.target.dataset.id));
        });
        sandDeliveriesTableBody.querySelectorAll('[data-action="delete-delivery"]').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSandDelivery(e.target.dataset.id));
        });

        // Exibe botões de PDF
        generateSandDeliveryPdfEmittedBtn.style.display = 'inline-block';
        generateSandDeliveryPdfPendingBtn.style.display = 'inline-block';

    } catch (error) {
        console.error('Erro ao carregar entregas de areia:', error);
        alert(`Erro ao carregar entregas de areia: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Preenche o formulário para edição de um lançamento de entrega de areia.
 * @param {number} deliveryId - ID da entrega a ser editada.
 */
const editSandDelivery = (deliveryId) => {
    const delivery = appState.sand_deliveries.find(d => d.id == deliveryId);
    if (!delivery) {
        alert('Entrega não encontrada para edição.');
        return;
    }

    editingSandDeliveryId = deliveryId;
    addSandDeliveryBtn.textContent = 'Atualizar Entrega';
    addSandDeliveryBtn.classList.remove('btn-primary');
    addSandDeliveryBtn.classList.add('btn-warning');
    cancelEditSandDeliveryBtn.style.display = 'inline-block';

    sandDeliveryCodeInput.value = delivery.delivery_code;
    sandDeliveryDateInput.value = formatInputDate(delivery.delivery_date, 'date');
    updateDeliveryDateDisplay(); // Atualiza o display da data
    sandDeliveryEquipmentSelect.value = delivery.equipment_id;
    updateEquipmentInfoDisplay(); // Atualiza o display do equipamento
    sandDeliveryVolumeInput.value = delivery.volume_m3;
    updateDeliveryValue(); // Recalcula o valor
    sandDeliveryInvoiceStatusSelect.value = delivery.invoice_status || 'NENHUM';
    updateInvoiceStatusAuto(); // Atualiza o display do status automático
    sandDeliveryNotesInput.value = delivery.notes || '';
};

/**
 * Exclui um lançamento de entrega de areia.
 * @param {number} deliveryId - ID da entrega a ser excluída.
 */
const deleteSandDelivery = async (deliveryId) => {
    openModal('Confirmar Exclusão', createConfirmationModal(async () => {
        showSpinner();
        try {
            await apiClient.deleteSandDelivery(deliveryId);
            alert('Entrega de areia excluída com sucesso!');
            await loadAndRenderSandDeliveries(currentSupplyConfigId);
            if (editingSandDeliveryId === deliveryId) {
                cancelEditSandDelivery();
            }
        } catch (error) {
            console.error('Erro ao excluir entrega de areia:', error);
            alert(`Erro ao excluir entrega de areia: ${error.message}`);
        } finally {
            hideSpinner();
        }
    }, 'Tem certeza que deseja excluir esta entrega de areia? Esta ação não pode ser desfeita.', 'Excluir'));
};

/**
 * Gera o PDF do relatório de entregas de areia.
 * @param {string} filterStatus - Status da nota para filtrar ('EMITIDA' ou 'NAO_EMITIDA').
 */
const generateSandDeliveryPdf = async (filterStatus) => {
    showSpinner();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    const withCover = sandDeliveryPdfCoverCheckbox.checked;

    try {
        const deliveries = appState.sand_deliveries.filter(d => d.invoice_status === filterStatus);
        const config = currentSupplyConfig;

        if (deliveries.length === 0) {
            alert(`Não há entregas com status "${filterStatus === 'EMITIDA' ? 'Emitida' : 'Não Emitida'}" para gerar o PDF.`);
            hideSpinner();
            return;
        }

        const myCompany = appState.my_companies.find(mc => mc.id == config.my_company_id);
        const clientCompany = appState.client_companies.find(cc => cc.id == config.client_company_id);

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
            period: `${formatMonthYear(minDate)} ATÉ ${formatMonthYear(maxDate)}`,
            totalDeliveries: deliveries.length,
            totalVolume: totalVolume,
            totalValue: totalValue,
            priceM3: config.price_m3
        };

        // Adiciona capa se solicitado
        if (withCover) {
            addPdfCoverPage(pdf, headerInfo, 'FORNECIMENTO DE AREIA', myCompany?.name || 'PBA TRANSPORTES');
        }

        // Função para adicionar cabeçalho e rodapé em cada página
        const addPageHeadersFooters = (doc, pageNumber) => {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(myCompany?.name || 'PBA TRANSPORTES', pdf.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${pageNumber}`, pdf.internal.pageSize.getWidth() - 15, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text('Rua Luiz Cajueiro de Albuquerque, n°1130, Loteamento dos Lins, Sertânia-PE-56600-000', 15, pdf.internal.pageSize.getHeight() - 10, { align: 'left' });
            
            // Informações adicionais no cabeçalho (repetidas em cada página)
            let y = 18;
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(`RELATÓRIO DE FORNECIMENTO DE AREIA - ${clientCompany?.name || 'Cliente'}`, 15, y);
            y += 4;
            doc.setFont(undefined, 'normal');
            doc.text(`${headerInfo.period}`, 15, y);
            y += 4;
            doc.text(`Qtd. Viagens: ${headerInfo.totalDeliveries} | Volume Total: ${headerInfo.totalVolume.toFixed(2)} m³ | Valor M³: ${formatCurrency(headerInfo.priceM3)} | Valor Total: ${formatCurrency(headerInfo.totalValue)}`, 15, y);
            doc.line(15, y + 2, pdf.internal.pageSize.getWidth() - 15, y + 2); // Linha separadora
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
            const equipmentDisplay = `${d.equipment?.prefix || 'N/A'} - ${d.equipment?.type || 'N/A'} (${equipmentOwner})`;
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
                if (data.pageNumber > (withCover ? 1 : 0)) { // Se tiver capa, cabeçalho a partir da 2ª página (página 1 do conteúdo)
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
};


// ====================================================================
// Sub-seção: Relatório de Notas Fiscais de Areia
// ====================================================================

// Elementos do DOM para o Relatório de Notas Fiscais de Areia
const sandInvoicesStatusSelect = document.getElementById('sand-invoices-status-select');
const sandInvoicesClientSelect = document.getElementById('sand-invoices-client-select');
const sandInvoicesStartDate = document.getElementById('sand-invoices-start-date');
const sandInvoicesEndDate = document.getElementById('sand-invoices-end-date');
const generateSandInvoicesReportBtn = document.getElementById('generate-sand-invoices-report-btn');
const exportSandInvoicesPdfBtn = document.getElementById('export-sand-invoices-pdf-btn');
const sandInvoicesReportOutput = document.getElementById('sand-invoices-report-output');
const sandInvoicesReportCoverCheckbox = document.getElementById('sand-invoices-report-cover-checkbox');

/**
 * Inicializa a sub-seção de Relatório de Notas Fiscais de Areia.
 */
export const initSandInvoicesReport = async () => { // EXPORTED
    // Popula dropdown de clientes com base nas configurações de fornecimento
    if (sandInvoicesClientSelect) {
        // Garante que as empresas cliente estejam carregadas
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }
        // Garante que as configurações de fornecimento estejam carregadas para saber quais clientes têm fornecimento
        if (appState.sand_supply_configs.length === 0) {
            appState.sand_supply_configs = await apiClient.fetchSandSupplyConfigs();
        }

        const uniqueClientIds = new Set(appState.sand_supply_configs.map(c => c.client_company_id));
        sandInvoicesClientSelect.innerHTML = '<option value="TODOS">Todos</option>' + 
            Array.from(uniqueClientIds).map(id => {
                const client = appState.client_companies.find(c => c.id == id);
                return client ? `<option value="${client.id}">${client.name}</option>` : '';
            }).join('');
    }

    // Event listeners
    if (generateSandInvoicesReportBtn) {
        generateSandInvoicesReportBtn.addEventListener('click', generateSandInvoicesReport);
    }
    if (exportSandInvoicesPdfBtn) {
        exportSandInvoicesPdfBtn.addEventListener('click', () => generateSandInvoicesReport(false));
    }

    // Limpa output e esconde botão de PDF
    if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = '';
    if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'none';
};

/**
 * Gera o relatório de notas fiscais de areia.
 * @param {boolean} preview - Se é apenas uma pré-visualização.
 */
const generateSandInvoicesReport = async (preview = true) => {
    const statusFilter = sandInvoicesStatusSelect.value;
    const clientFilter = sandInvoicesClientSelect.value;
    let startDate = sandInvoicesStartDate.value;
    let endDate = sandInvoicesEndDate.value;
    const withCover = sandInvoicesReportCoverCheckbox.checked;

    showSpinner();
    if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = '';
    if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'none';

    try {
        // Ajusta as datas se apenas uma for fornecida pelo usuário
        if (startDate && !endDate) {
            endDate = new Date().toISOString().split('T')[0]; // Até a data atual
        } else if (!startDate && endDate) {
            startDate = '2000-01-01'; // Desde uma data muito antiga
        }

        // Busca todas as entregas e filtra no frontend
        const allDeliveries = await apiClient.fetchSandDeliveries(null, startDate, endDate, statusFilter);
        
        let filteredDeliveries = allDeliveries;

        if (clientFilter !== 'TODOS') {
            filteredDeliveries = filteredDeliveries.filter(d => d.supply_config.client_company_id == clientFilter);
        }

        // Agrupa por empresa cliente para o relatório
        const groupedByClient = filteredDeliveries.reduce((acc, delivery) => {
            const clientCompanyId = delivery.supply_config.client_company_id;
            if (!acc[clientCompanyId]) {
                acc[clientCompanyId] = {
                    clientName: appState.client_companies.find(c => c.id == clientCompanyId)?.name || 'N/A',
                    totalRomaneios: 0,
                    totalVolume: 0,
                    totalValue: 0,
                    deliveries: []
                };
            }
            acc[clientCompanyId].totalRomaneios++;
            acc[clientCompanyId].totalVolume += parseFloat(delivery.volume_m3 || 0);
            acc[clientCompanyId].totalValue += parseFloat(delivery.total_value || 0);
            acc[clientCompanyId].deliveries.push(delivery);
            return acc;
        }, {});

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>PBA TRANSPORTES</h3>
                    <p><strong>Relatório de Notas Fiscais de Areia</strong></p>
                    <p><strong>Status:</strong> ${sandInvoicesStatusSelect.options[sandInvoicesStatusSelect.selectedIndex].text}</p>
                    <p><strong>Período:</strong> ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} a ${endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Resumo por Empresa Cliente</h3>
                    <div class="table-wrapper responsive">
                        <table id="sand-invoices-summary-table">
                            <thead>
                                <tr>
                                    <th>Empresa Cliente</th>
                                    <th>Total Romaneios</th>
                                    <th>Volume Total (m³)</th>
                                    <th>Valor Total (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        let grandTotalVolume = 0;
        let grandTotalValue = 0;

        if (Object.keys(groupedByClient).length === 0) {
            reportHTML += `<tr><td colspan="4">Nenhum dado encontrado para os filtros selecionados.</td></tr>`;
        } else {
            Object.values(groupedByClient).forEach(clientData => {
                grandTotalVolume += clientData.totalVolume;
                grandTotalValue += clientData.totalValue;
                reportHTML += `
                                <tr>
                                    <td>${clientData.clientName}</td>
                                    <td>${clientData.totalRomaneios}</td>
                                    <td>${clientData.totalVolume.toFixed(2)}</td>
                                    <td>${formatCurrency(clientData.totalValue)}</td>
                                </tr>
                `;
            });
        }

        reportHTML += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="text-align: right; font-weight: bold;">Total Geral:</td>
                                    <td></td>
                                    <td style="font-weight: bold;">${grandTotalVolume.toFixed(2)}</td>
                                    <td style="font-weight: bold;">${formatCurrency(grandTotalValue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = reportHTML;
        if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'inline-block';

        if (!preview) {
            // Importa a função de PDF aqui para evitar circular dependency
            const { exportSandInvoicesReportToPDF } = await import('./relatorios_areia_notas_pdf.js');
            await exportSandInvoicesReportToPDF(sandInvoicesReportOutput.id, 'Relatório de Notas Fiscais de Areia', withCover);
        }

    } catch (e) {
        console.error("Erro ao gerar relatório de notas fiscais de areia:", e);
        if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

// ====================================================================
// Sub-seção: Últimos Preços de Areia
// ====================================================================

// Elementos do DOM para o Relatório de Últimos Preços de Areia
const sandLatestPricesReportBtn = document.getElementById('generate-sand-latest-prices-report-btn');
const exportSandLatestPricesPdfBtn = document.getElementById('export-sand-latest-prices-pdf-btn');
const sandLatestPricesReportOutput = document.getElementById('sand-latest-prices-report-output');
const sandLatestPricesReportCoverCheckbox = document.getElementById('sand-latest-prices-report-cover-checkbox');

/**
 * Inicializa a sub-seção de Últimos Preços de Areia.
 */
export const initSandLatestPricesReport = async () => { // EXPORTED
    // Event listeners
    if (sandLatestPricesReportBtn) {
        sandLatestPricesReportBtn.addEventListener('click', generateSandLatestPricesReport);
    }
    if (exportSandLatestPricesPdfBtn) {
        exportSandLatestPricesPdfBtn.addEventListener('click', () => generateSandLatestPricesReport(false));
    }

    // Limpa output e esconde botão de PDF
    if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = '';
    if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'none';

    // Gera o relatório inicial
    await generateSandLatestPricesReport();
};

/**
 * Gera o relatório de últimos preços de areia.
 * @param {boolean} preview - Se é apenas uma pré-visualização.
 */
const generateSandLatestPricesReport = async (preview = true) => {
    showSpinner();
    if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = '';
    if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'none';
    const withCover = sandLatestPricesReportCoverCheckbox.checked;

    try {
        // Garante que as empresas estejam carregadas para exibir os nomes
        if (appState.my_companies.length === 0) {
            appState.my_companies = await apiClient.fetchData('my_companies');
        }
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }

        const latestPrices = await apiClient.fetchLatestSandPrices();

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>PBA TRANSPORTES</h3>
                    <p><strong>Relatório de Últimos Preços de Fornecimento de Areia por Rota</strong></p>
                    <p><strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Últimos Preços Registrados</h3>
                    <div class="table-wrapper responsive">
                        <table id="sand-latest-prices-table">
                            <thead>
                                <tr>
                                    <th>Empresa Fornecedora</th>
                                    <th>Empresa Cliente</th>
                                    <th>Local de Saída</th>
                                    <th>Local de Entrega</th>
                                    <th>Último Preço M³ (R$)</th>
                                    <th>Data do Registro</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        if (latestPrices.length === 0) {
            reportHTML += `<tr><td colspan="6">Nenhum preço de areia registrado.</td></tr>`;
        } else {
            latestPrices.forEach(price => {
                const myCompanyName = price.my_company?.name || 'N/A';
                const clientCompanyName = price.client_company?.name || 'N/A';
                const registeredDate = new Date(price.created_at).toLocaleDateString('pt-BR');

                reportHTML += `
                                <tr>
                                    <td>${myCompanyName}</td>
                                    <td>${clientCompanyName}</td>
                                    <td>${price.output_location || 'AREAL'}</td>
                                    <td>${price.delivery_location}</td>
                                    <td>${formatCurrency(price.price_m3)}</td>
                                    <td>${registeredDate}</td>
                                </tr>
                `;
            });
        }

        reportHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = reportHTML;
        if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'inline-block';

        if (!preview) {
            // Importa a função de PDF aqui para evitar circular dependency
            const { exportSandLatestPricesReportToPDF } = await import('./relatorios_areia_ultimos_precos_pdf.js');
            await exportSandLatestPricesReportToPDF(sandLatestPricesReportOutput.id, 'Relatório de Últimos Preços de Areia', withCover);
        }

    } catch (e) {
        console.error("Erro ao gerar relatório de últimos preços de areia:", e);
        if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};
