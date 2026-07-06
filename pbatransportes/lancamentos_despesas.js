// lancamentos_despesas.js - VERSÃO COMPLETAMENTE REESCRITA COM CAMPOS DINÂMICOS
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, getBMLabelForDate, formatMonthYear, openModal, closeModal, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { EXPENSE_IMPACT_TYPES } from './calculos_valores.js?v=20260302090000';

const expenseEntryWorkSelect = document.getElementById('expense-entry-work-select');
const expenseEntryDateInput = document.getElementById('expense-entry-date');
const expenseEntryEquipmentSelect = document.getElementById('expense-entry-equipment-select');
const expenseEntryTypeSelect = document.getElementById('expense-entry-type');
const expenseEntryDescriptionInput = document.getElementById('expense-entry-description');
const expenseEntryMeasurementImpact = document.getElementById('expense-entry-measurement-impact');
const expenseEntryNotes = document.getElementById('expense-entry-notes');
const addExpenseEntryBtn = document.getElementById('add-expense-entry-btn');
const expensesEntriesTableBody = document.querySelector('#expenses-entries-table tbody');

// Variável para controlar se estamos editando um lançamento
let editingExpenseId = null;

/**
 * Inicializa a sub-seção de Lançamentos de Despesas.
 */
export const initExpenseEntries = async () => {
    showSpinner();
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        appState.equipment = await apiClient.fetchData('equipment');
        appState.terceirizados = await apiClient.fetchData('terceirizados');
    }

    if (expenseEntryWorkSelect) {
        expenseEntryWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
            appState.works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        expenseEntryWorkSelect.addEventListener('change', handleExpenseWorkSelectChange);
    }
    
    if (addExpenseEntryBtn) {
        addExpenseEntryBtn.addEventListener('click', addExpenseEntry);
    }
    
    if (expenseEntryEquipmentSelect) {
        expenseEntryEquipmentSelect.addEventListener('change', updateDynamicFields);
    }

    // Adiciona o campo de empresa terceirizada
    addThirdPartyCompanyField();
    
    // Adiciona listeners para os campos de impacto
    if (expenseEntryMeasurementImpact) {
        expenseEntryMeasurementImpact.addEventListener('change', updateDynamicFields);
    }

    // Inicializa campos dinâmicos
    updateDynamicFields();
    
    if (expensesEntriesTableBody) expensesEntriesTableBody.innerHTML = '';
    
    hideSpinner();
};

/**
 * Adiciona o campo de seleção de empresa terceirizada no formulário
 */
const addThirdPartyCompanyField = () => {
    const equipmentGroup = document.getElementById('expense-entry-equipment-select').closest('.form-group');
    if (!equipmentGroup) return;

    if (document.getElementById('expense-entry-third-party-select')) return;

    const thirdPartyGroup = document.createElement('div');
    thirdPartyGroup.className = 'form-group';
    thirdPartyGroup.id = 'expense-entry-third-party-group';
    thirdPartyGroup.style.display = 'none';
    thirdPartyGroup.innerHTML = `
        <label for="expense-entry-third-party-select">Empresa Terceirizada</label>
        <select id="expense-entry-third-party-select">
            <option value="">Selecione a empresa terceirizada</option>
        </select>
    `;

    equipmentGroup.parentNode.insertBefore(thirdPartyGroup, equipmentGroup.nextSibling);

    const thirdPartySelect = document.getElementById('expense-entry-third-party-select');
    if (thirdPartySelect) {
        thirdPartySelect.addEventListener('change', updateDynamicFields);
    }
};

/**
 * Lida com a mudança na seleção da obra
 */
const handleExpenseWorkSelectChange = () => {
    const workId = expenseEntryWorkSelect.value;
    if (expensesEntriesTableBody) expensesEntriesTableBody.innerHTML = '';
    
    try {
        if (expenseEntryEquipmentSelect) {
            const work = appState.works.find(w => w.id == workId);
            const equipmentInWork = work?.config?.equipment || [];
            
            const validEquipmentsInWork = equipmentInWork
                .map(ec => appState.equipment.find(e => e.id === parseInt(ec.equipment_id)))
                .filter(equip => equip !== undefined);

            const sortedEquipment = [...validEquipmentsInWork].sort((a, b) => {
                const typeA = a.type ? getEquipTypeName(a.type).toUpperCase() : '';
                const typeB = b.type ? getEquipTypeName(b.type).toUpperCase() : '';
                if (typeA < typeB) return -1;
                if (typeA > typeB) return 1;
                const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
                const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
                if (prefixA < prefixB) return -1;
                if (prefixA > prefixB) return 1;
                return 0;
            });

            const equipmentOptions = sortedEquipment.map(e => {
                const parts = [getEquipTypeName(e.type), e.prefix, e.brand, e.model, e.year, e.characteristic, e.capacidade].filter(Boolean);
                const displayText = parts.join(' - ');
                return `<option value="${e.id}">${displayText}</option>`;
            }).join('');
            
            expenseEntryEquipmentSelect.innerHTML = '<option value="">Nenhum</option>' + equipmentOptions;
            
            console.log(`✅ Carregados ${validEquipmentsInWork.length} equipamentos válidos para a obra`);
        }

        updateThirdPartyDropdown();
        updateDynamicFields();

        if (workId) {
            loadExpenseEntries(workId);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar equipamentos da obra:', error);
        if (expenseEntryEquipmentSelect) {
            expenseEntryEquipmentSelect.innerHTML = '<option value="">Nenhum (Erro ao carregar)</option>';
        }
        alert('Erro ao carregar equipamentos da obra. Recarregue a página.');
    }
};

/**
 * Atualiza o dropdown de empresas terceirizadas baseado na obra selecionada
 */
const updateThirdPartyDropdown = () => {
    const thirdPartyGroup = document.getElementById('expense-entry-third-party-group');
    const thirdPartySelect = document.getElementById('expense-entry-third-party-select');
    
    if (!thirdPartyGroup || !thirdPartySelect) return;

    try {
        const workId = expenseEntryWorkSelect?.value;
        const work = appState.works.find(w => w.id == workId);
        
        if (!work?.config?.equipment) {
            thirdPartyGroup.style.display = 'none';
            return;
        }

        const thirdPartyCompaniesInWork = new Set();
        work.config.equipment.forEach(ec => {
            const equip = appState.equipment.find(e => e.id == ec.equipment_id);
            if (equip?.is_terceirizado && equip.terceirizado_id) {
                const terceirizadaExists = appState.terceirizados.find(t => t.id == equip.terceirizado_id);
                if (terceirizadaExists) {
                    thirdPartyCompaniesInWork.add(equip.terceirizado_id);
                }
            }
        });

        if (thirdPartyCompaniesInWork.size > 0) {
            thirdPartySelect.innerHTML = '<option value="">Selecione a empresa terceirizada</option>' + 
                Array.from(thirdPartyCompaniesInWork).map(tercId => {
                    const terceirizada = appState.terceirizados.find(t => t.id == tercId);
                    return `<option value="${tercId}">${terceirizada?.name || 'N/A'}</option>`;
                }).join('');
            thirdPartyGroup.style.display = 'block';
            
            console.log(`✅ Carregadas ${thirdPartyCompaniesInWork.size} empresas terceirizadas válidas`);
        } else {
            thirdPartyGroup.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro ao atualizar dropdown de terceirizadas:', error);
        thirdPartyGroup.style.display = 'none';
    }
};

/**
 * NOVA FUNÇÃO: Atualiza todos os campos dinâmicos baseado nas seleções
 * Gerencia: Campo Impacto Terceirizado + Campos de Valor/Qtde/Unidade/Total
 */
const updateDynamicFields = () => {
    const selectedEquipmentId = expenseEntryEquipmentSelect?.value;
    const selectedThirdPartyId = document.getElementById('expense-entry-third-party-select')?.value;
    const selectedEquipment = appState.equipment.find(e => e.id == selectedEquipmentId);
    const impactClienteValue = expenseEntryMeasurementImpact?.value || 'none';
    
    // ========== PARTE 1: GERENCIAR CAMPO IMPACTO TERCEIRIZADO ==========
    manageTerceirizadoImpactField(selectedEquipment, selectedThirdPartyId);
    
    // ========== PARTE 2: GERENCIAR CAMPOS DE VALORES (CLIENTE) ==========
    manageClienteValueFields(impactClienteValue);
    
    // ========== PARTE 3: GERENCIAR CAMPOS DE VALORES (TERCEIRIZADO) ==========
    const impactTerceirizadoSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
    const impactTerceirizadoValue = impactTerceirizadoSelect?.value || 'none';
    manageTerceirizadoValueFields(impactTerceirizadoValue);
};

/**
 * Gerencia a visibilidade e opções do campo "Impacto Terceirizado"
 */
const manageTerceirizadoImpactField = (selectedEquipment, selectedThirdPartyId) => {
    let impactTerceirizadoGroup = document.getElementById('expense-entry-measurement-impact-terceirizado-group');
    
    const hasThirdPartyContext = (selectedEquipment && selectedEquipment.is_terceirizado) || selectedThirdPartyId;

    if (hasThirdPartyContext) {
        // Criar campo se não existir
        if (!impactTerceirizadoGroup) {
            const impactGroup = document.getElementById('expense-measurement-impact-group');
            if (!impactGroup) return;

            impactTerceirizadoGroup = document.createElement('div');
            impactTerceirizadoGroup.className = 'form-group';
            impactTerceirizadoGroup.id = 'expense-entry-measurement-impact-terceirizado-group';
            impactTerceirizadoGroup.innerHTML = `
                <label for="expense-entry-measurement-impact-terceirizado">Impacto Terceirizado</label>
                <select id="expense-entry-measurement-impact-terceirizado">
                    <option value="none">Somente Registrar</option>
                    <option value="add_terceirizado">Acréscimo (Terceirizado)</option>
                    <option value="disc_terceirizado">Desconto (Terceirizado)</option>
                </select>
            `;

            impactGroup.parentNode.insertBefore(impactTerceirizadoGroup, impactGroup.nextSibling);
            
            // Adiciona listener
            const impactTercSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
            if (impactTercSelect) {
                impactTercSelect.addEventListener('change', updateDynamicFields);
            }
        }
        
        impactTerceirizadoGroup.style.display = 'block';
    } else {
        if (impactTerceirizadoGroup) {
            impactTerceirizadoGroup.style.display = 'none';
            const impactTercSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
            if (impactTercSelect) impactTercSelect.value = 'none';
        }
    }
};

/**
 * Gerencia os campos de valor/qtde/unidade/total para CLIENTE
 * SEMPRE VISÍVEIS (mesmo com "Somente Registrar")
 */
const manageClienteValueFields = (impactValue) => {
    let clienteFieldsGroup = document.getElementById('expense-cliente-fields-group');
    
    // SEMPRE CRIAR/MOSTRAR os campos (removido o if impactValue !== 'none')
    if (true) {
        // Criar campos se não existirem
        if (!clienteFieldsGroup) {
            const impactGroup = document.getElementById('expense-measurement-impact-group');
            if (!impactGroup) return;

            clienteFieldsGroup = document.createElement('div');
            clienteFieldsGroup.id = 'expense-cliente-fields-group';
            clienteFieldsGroup.style.width = '100%';
            clienteFieldsGroup.style.marginTop = '20px';
            clienteFieldsGroup.style.padding = '20px';
            clienteFieldsGroup.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
            clienteFieldsGroup.style.borderRadius = '10px';
            clienteFieldsGroup.style.border = '3px solid #4caf50';
            clienteFieldsGroup.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.3)';
            
            clienteFieldsGroup.innerHTML = `
                <div style="margin-bottom: 15px; border-bottom: 3px solid #4caf50; padding-bottom: 10px;">
                    <h3 style="margin: 0; color: #81c784; font-size: 1.2em; font-weight: bold; text-transform: uppercase;">
                        📊 VALORES PARA CLIENTE
                    </h3>
                </div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #81c784; margin-bottom: 5px; display: block;">Valor Unitário (R$)</label>
                        <input type="number" step="0.01" id="expense-cliente-valor-unitario" value="0" 
                               style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #66bb6a; border-radius: 6px; background: white;">
                    </div>
                    <div style="flex: 0.6; min-width: 100px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #81c784; margin-bottom: 5px; display: block;">Qtde</label>
                        <input type="number" step="0.001" id="expense-cliente-qtde" value="1" 
                               style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #66bb6a; border-radius: 6px; background: white;">
                    </div>
                    <div style="flex: 0.8; min-width: 120px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #81c784; margin-bottom: 5px; display: block;">Unidade</label>
                        <select id="expense-cliente-unidade" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #66bb6a; border-radius: 6px; background: white;">
                            <option value="UN">UN</option>
                            <option value="LITROS">LITROS</option>
                            <option value="KG">KG</option>
                            <option value="M">M</option>
                            <option value="M2">M²</option>
                            <option value="M3">M³</option>
                            <option value="KM">KM</option>
                            <option value="HR">HR</option>
                            <option value="DIA">DIA</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #81c784; margin-bottom: 5px; display: block;">💰 Total (R$)</label>
                        <input type="text" id="expense-cliente-total" value="R$ 0,00" readonly 
                               style="width: 100%; padding: 12px; font-size: 1.3em; font-weight: bold; color: #81c784; 
                                      background: #81c784; border: 3px solid #2e7d32; border-radius: 6px; text-align: center;">
                    </div>
                </div>
            `;

            impactGroup.parentNode.insertBefore(clienteFieldsGroup, impactGroup.nextSibling);
            
            // Adiciona listeners para calcular total
            const valorInput = document.getElementById('expense-cliente-valor-unitario');
            const qtdeInput = document.getElementById('expense-cliente-qtde');
            const totalInput = document.getElementById('expense-cliente-total');
            
            const calcularTotal = () => {
                const valor = parseFloat(valorInput.value) || 0;
                const qtde = parseFloat(qtdeInput.value) || 0;
                const total = valor * qtde;
                totalInput.value = formatCurrency(total);
            };
            
            if (valorInput) valorInput.addEventListener('input', calcularTotal);
            if (qtdeInput) qtdeInput.addEventListener('input', calcularTotal);
        }
        
        clienteFieldsGroup.style.display = 'block'; // SEMPRE VISÍVEL
    }
};

/**
 * Gerencia os campos de valor/qtde/unidade/total para TERCEIRIZADO
 * SEMPRE VISÍVEIS quando houver contexto terceirizado (mesmo com "Somente Registrar")
 */
const manageTerceirizadoValueFields = (impactValue) => {
    let terceirizadoFieldsGroup = document.getElementById('expense-terceirizado-fields-group');
    
    // Verifica se o campo "Impacto Terceirizado" está visível
    const impactTercGroup = document.getElementById('expense-entry-measurement-impact-terceirizado-group');
    const hasThirdPartyContext = impactTercGroup && impactTercGroup.style.display !== 'none';
    
    // SEMPRE MOSTRAR quando houver contexto terceirizado (removido o check de impactValue !== 'none')
    if (hasThirdPartyContext) {
        // Criar campos se não existirem
        if (!terceirizadoFieldsGroup) {
            const impactTercGroup = document.getElementById('expense-entry-measurement-impact-terceirizado-group');
            if (!impactTercGroup) return;

            terceirizadoFieldsGroup = document.createElement('div');
            terceirizadoFieldsGroup.id = 'expense-terceirizado-fields-group';
            terceirizadoFieldsGroup.style.width = '100%';
            terceirizadoFieldsGroup.style.marginTop = '20px';
            terceirizadoFieldsGroup.style.padding = '20px';
            terceirizadoFieldsGroup.style.background = 'linear-gradient(135deg, #fff3cd 0%, #ffe082 100%)';
            terceirizadoFieldsGroup.style.borderRadius = '10px';
            terceirizadoFieldsGroup.style.border = '3px solid #ffc107';
            terceirizadoFieldsGroup.style.boxShadow = '0 4px 8px rgba(255, 193, 7, 0.3)';
            
            terceirizadoFieldsGroup.innerHTML = `
                <div style="margin-bottom: 15px; border-bottom: 3px solid #ffc107; padding-bottom: 10px;">
                    <h3 style="margin: 0; color: #e65100; font-size: 1.2em; font-weight: bold; text-transform: uppercase;">
                        🏢 VALORES PARA TERCEIRIZADO
                    </h3>
                </div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #e65100; margin-bottom: 5px; display: block;">Valor Unitário (R$)</label>
                        <input type="number" step="0.01" id="expense-terceirizado-valor-unitario" value="0" 
                               style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #ffb300; border-radius: 6px; background: white;">
                    </div>
                    <div style="flex: 0.6; min-width: 100px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #e65100; margin-bottom: 5px; display: block;">Qtde</label>
                        <input type="number" step="0.001" id="expense-terceirizado-qtde" value="1" 
                               style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #ffb300; border-radius: 6px; background: white;">
                    </div>
                    <div style="flex: 0.8; min-width: 120px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #e65100; margin-bottom: 5px; display: block;">Unidade</label>
                        <select id="expense-terceirizado-unidade" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #ffb300; border-radius: 6px; background: white;">
                            <option value="UN">UN</option>
                            <option value="LITROS">LITROS</option>
                            <option value="KG">KG</option>
                            <option value="M">M</option>
                            <option value="M2">M²</option>
                            <option value="M3">M³</option>
                            <option value="KM">KM</option>
                            <option value="HR">HR</option>
                            <option value="DIA">DIA</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="font-size: 0.95em; font-weight: bold; color: #e65100; margin-bottom: 5px; display: block;">💰 Total (R$)</label>
                        <input type="text" id="expense-terceirizado-total" value="R$ 0,00" readonly 
                               style="width: 100%; padding: 12px; font-size: 1.3em; font-weight: bold; color: #e65100; 
                                      background: #ffcc80; border: 3px solid #f57c00; border-radius: 6px; text-align: center;">
                    </div>
                </div>
            `;

            impactTercGroup.parentNode.insertBefore(terceirizadoFieldsGroup, impactTercGroup.nextSibling);
            
            // Adiciona listeners para calcular total
            const valorInput = document.getElementById('expense-terceirizado-valor-unitario');
            const qtdeInput = document.getElementById('expense-terceirizado-qtde');
            const totalInput = document.getElementById('expense-terceirizado-total');
            
            const calcularTotal = () => {
                const valor = parseFloat(valorInput.value) || 0;
                const qtde = parseFloat(qtdeInput.value) || 0;
                const total = valor * qtde;
                totalInput.value = formatCurrency(total);
            };
            
            if (valorInput) valorInput.addEventListener('input', calcularTotal);
            if (qtdeInput) qtdeInput.addEventListener('input', calcularTotal);
        }
        
        terceirizadoFieldsGroup.style.display = 'block';
    } else {
        if (terceirizadoFieldsGroup) {
            terceirizadoFieldsGroup.style.display = 'none';
        }
    }
};

/**
 * Adiciona um novo lançamento de despesa ou atualiza um existente
 */
const addExpenseEntry = async () => {
    const workId = expenseEntryWorkSelect?.value;
    const date = expenseEntryDateInput?.value;
    const equipmentId = expenseEntryEquipmentSelect?.value || null;
    const thirdPartyId = document.getElementById('expense-entry-third-party-select')?.value || null;
    const type = expenseEntryTypeSelect?.value;
    const description = expenseEntryDescriptionInput?.value;
    const measurementImpact = expenseEntryMeasurementImpact?.value || 'none';
    const notes = expenseEntryNotes?.value;

    // Validações básicas
    if (!workId || !date || !type || !description) {
        alert('Preencha todos os campos obrigatórios (Obra, Data, Tipo, Descrição).');
        return;
    }

    // ========== CAPTURA DADOS DO CLIENTE ==========
    let impactoClienteValorUnitario = null;
    let impactoClienteQtde = null;
    let impactoClienteUnidade = null;
    let impactoClienteTotal = null;
    
    // SEMPRE captura os dados (mesmo com "Somente Registrar")
    const valorInputCliente = document.getElementById('expense-cliente-valor-unitario');
    const qtdeInputCliente = document.getElementById('expense-cliente-qtde');
    const unidadeSelectCliente = document.getElementById('expense-cliente-unidade');
    
    if (valorInputCliente && qtdeInputCliente && unidadeSelectCliente) {
        impactoClienteValorUnitario = parseFloat(valorInputCliente.value) || 0;
        impactoClienteQtde = parseFloat(qtdeInputCliente.value) || 0;
        impactoClienteUnidade = unidadeSelectCliente.value;
        impactoClienteTotal = impactoClienteValorUnitario * impactoClienteQtde;
        
        // VALIDAÇÃO: só exige valores > 0 se NÃO for "Somente Registrar"
        if (measurementImpact !== 'none' && (impactoClienteValorUnitario <= 0 || impactoClienteQtde <= 0)) {
            alert('Valor unitário e quantidade do impacto cliente devem ser maiores que zero.');
            return;
        }
    }

    // ========== CAPTURA DADOS DO TERCEIRIZADO ==========
    const impactTerceirizadoSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
    const impactTerceirizado = impactTerceirizadoSelect?.value || null;
    
    let impactoTerceirizadoValorUnitario = null;
    let impactoTerceirizadoQtde = null;
    let impactoTerceirizadoUnidade = null;
    let impactoTerceirizadoTotal = null;
    
    // Se o campo de impacto terceirizado existe e está visível, captura os dados
    const impactTercGroup = document.getElementById('expense-entry-measurement-impact-terceirizado-group');
    if (impactTercGroup && impactTercGroup.style.display !== 'none') {
        const valorInputTerc = document.getElementById('expense-terceirizado-valor-unitario');
        const qtdeInputTerc = document.getElementById('expense-terceirizado-qtde');
        const unidadeSelectTerc = document.getElementById('expense-terceirizado-unidade');
        
        if (valorInputTerc && qtdeInputTerc && unidadeSelectTerc) {
            impactoTerceirizadoValorUnitario = parseFloat(valorInputTerc.value) || 0;
            impactoTerceirizadoQtde = parseFloat(qtdeInputTerc.value) || 0;
            impactoTerceirizadoUnidade = unidadeSelectTerc.value;
            impactoTerceirizadoTotal = impactoTerceirizadoValorUnitario * impactoTerceirizadoQtde;
            
            // VALIDAÇÃO: só exige valores > 0 se NÃO for "Somente Registrar"
            if (impactTerceirizado && impactTerceirizado !== 'none' && 
                (impactoTerceirizadoValorUnitario <= 0 || impactoTerceirizadoQtde <= 0)) {
                alert('Valor unitário e quantidade do impacto terceirizado devem ser maiores que zero.');
                return;
            }
        }
    }

    // ========== MONTA OBJETO DE DADOS ==========
    const entryData = {
        work_id: workId,
        date: date,
        equipment_id: equipmentId,
        terceirizado_id: thirdPartyId,
        type: type,
        description: description,
        measurement_impact: measurementImpact,
        impacto_terceirizado: impactTerceirizado,
        impacto_cliente_valor_unitario: impactoClienteValorUnitario,
        impacto_cliente_qtde: impactoClienteQtde,
        impacto_cliente_unidade: impactoClienteUnidade,
        impacto_cliente_total: impactoClienteTotal,
        impacto_terceirizado_valor_unitario: impactoTerceirizadoValorUnitario,
        impacto_terceirizado_qtde: impactoTerceirizadoQtde,
        impacto_terceirizado_unidade: impactoTerceirizadoUnidade,
        impacto_terceirizado_total: impactoTerceirizadoTotal,
        notes: notes
    };

    showSpinner();
    try {
        let savedExpense;
        if (editingExpenseId) {
            savedExpense = await apiClient.updateItem('general_expenses', editingExpenseId, entryData);
            alert('Despesa atualizada com sucesso!');
            editingExpenseId = null;
            addExpenseEntryBtn.textContent = 'Adicionar Despesa';
            addExpenseEntryBtn.classList.remove('btn-warning');
            addExpenseEntryBtn.classList.add('btn-primary');
        } else {
            savedExpense = await apiClient.addItem('general_expenses', entryData);
            alert('Despesa adicionada com sucesso!');
        }
        
        await loadExpenseEntries(workId);
        clearForm();
        
        // Upload automático para Google Drive (não bloqueia o fluxo)
        try {
            console.log('📤 Iniciando upload automático do PDF da despesa para o Drive...');
            
            // Garante que temos todos os dados necessários
            const expenseToUpload = savedExpense || {
                ...entryData,
                id: savedExpense?.id || entryData.id,
                work_id: workId
            };
            
            console.log('🔍 Objeto para upload:', expenseToUpload);
            await uploadExpensePdfToDrive(expenseToUpload);
            console.log('✅ PDF da despesa enviado para o Drive com sucesso!');
        } catch (uploadError) {
            console.error('❌ Erro no upload do PDF (não crítico):', uploadError);
            console.error('📍 Stack do erro:', uploadError.stack);
        }
    } catch (e) {
        console.error("Erro ao salvar despesa:", e);
        alert(`Erro ao salvar despesa: ${e.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Limpa o formulário
 */
const clearForm = () => {
    if (expenseEntryDateInput) expenseEntryDateInput.value = '';
    if (expenseEntryEquipmentSelect) expenseEntryEquipmentSelect.value = '';
    
    const thirdPartySelect = document.getElementById('expense-entry-third-party-select');
    if (thirdPartySelect) thirdPartySelect.value = '';
    
    if (expenseEntryTypeSelect) expenseEntryTypeSelect.value = '';
    if (expenseEntryDescriptionInput) expenseEntryDescriptionInput.value = '';
    if (expenseEntryMeasurementImpact) expenseEntryMeasurementImpact.value = 'none';
    
    const impactTercSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
    if (impactTercSelect) impactTercSelect.value = 'none';
    
    if (expenseEntryNotes) expenseEntryNotes.value = '';
    
    // Limpa campos dinâmicos
    const clienteValorInput = document.getElementById('expense-cliente-valor-unitario');
    const clienteQtdeInput = document.getElementById('expense-cliente-qtde');
    const clienteUnidadeSelect = document.getElementById('expense-cliente-unidade');
    if (clienteValorInput) clienteValorInput.value = '0';
    if (clienteQtdeInput) clienteQtdeInput.value = '1';
    if (clienteUnidadeSelect) clienteUnidadeSelect.value = 'UN';
    
    const tercValorInput = document.getElementById('expense-terceirizado-valor-unitario');
    const tercQtdeInput = document.getElementById('expense-terceirizado-qtde');
    const tercUnidadeSelect = document.getElementById('expense-terceirizado-unidade');
    if (tercValorInput) tercValorInput.value = '0';
    if (tercQtdeInput) tercQtdeInput.value = '1';
    if (tercUnidadeSelect) tercUnidadeSelect.value = 'UN';
    
    updateDynamicFields();
};

/**
 * Carrega os lançamentos de despesas para uma obra específica
 */
const loadExpenseEntries = async (workId) => {
    showSpinner();
    try {
        console.log(`📊 Carregando despesas para obra ${workId}...`);
        
        const data = await apiClient.fetchData('general_expenses', '*');
        const filteredData = data
            .filter(entry => entry.work_id == workId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`✅ Carregadas ${filteredData.length} despesas para a obra`);
        renderExpensesEntriesTable(filteredData, workId);
        
    } catch (e) {
        console.error("❌ Erro ao carregar despesas:", e);
        if (expensesEntriesTableBody) {
            expensesEntriesTableBody.innerHTML = `
                <tr style="background-color: #f8d7da;">
                    <td colspan="7" style="color: #721c24; text-align: center;">
                        ❌ Erro ao carregar despesas: ${e.message}
                        <br><button class="btn btn-primary btn-sm mt-2" onclick="loadExpenseEntries('${workId}')">Tentar Novamente</button>
                    </td>
                </tr>
            `;
        }
    } finally {
        hideSpinner();
    }
};

/**
 * Renderiza a tabela de lançamentos de despesas
 * 🔥 CORREÇÃO: Exibir valores totais corretamente usando parseFloat
 */
const renderExpensesEntriesTable = (entries, workId) => {
    if (!expensesEntriesTableBody) return;
    expensesEntriesTableBody.innerHTML = '';
    
    if (entries.length === 0) {
        expensesEntriesTableBody.innerHTML = '<tr><td colspan="6">Nenhuma despesa para esta obra.</td></tr>';
        return;
    }

    entries.forEach(entry => {
        try {
            // Busca equipamento
            let equipmentDisplay = 'N/A';
            if (entry.equipment_id) {
                const equipment = appState.equipment.find(e => e.id == entry.equipment_id);
                if (equipment) {
                    equipmentDisplay = `${equipment.prefix} - ${getEquipTypeName(equipment.type)}`;
                } else {
                    equipmentDisplay = `⚠️ Equipamento Removido (ID: ${entry.equipment_id})`;
                }
            }
            
            // Busca empresa terceirizada
            let thirdPartyDisplay = '';
            if (entry.terceirizado_id) {
                const thirdPartyCompany = appState.terceirizados.find(t => t.id == entry.terceirizado_id);
                if (thirdPartyCompany) {
                    thirdPartyDisplay = ` / ${thirdPartyCompany.name}`;
                } else {
                    thirdPartyDisplay = ` / ⚠️ Empresa Removida (ID: ${entry.terceirizado_id})`;
                }
            }
            
            // 🔥 CORREÇÃO: Monta display de impactos usando parseFloat e verificando > 0
            let impactDisplay = '';
            
            // Impacto Cliente - usa impacto_cliente_total
            if (entry.measurement_impact === 'add_client') {
                const valorCliente = parseFloat(entry.impacto_cliente_total) || 0;
                if (valorCliente > 0) {
                    impactDisplay += `<span style="color: #2e7d32; font-weight: bold;">Acréscimo Cliente: ${formatCurrency(valorCliente)}</span>`;
                }
            } else if (entry.measurement_impact === 'disc_client') {
                const valorCliente = parseFloat(entry.impacto_cliente_total) || 0;
                if (valorCliente > 0) {
                    impactDisplay += `<span style="color: #c62828; font-weight: bold;">Desconto Cliente: ${formatCurrency(valorCliente)}</span>`;
                }
            } else {
                impactDisplay += '<span style="color: #b0b0b0;">Sem impacto cliente</span>';
            }
            
            // Impacto Terceirizado - usa impacto_terceirizado_total
            if (entry.impacto_terceirizado === 'add_terceirizado') {
                const valorTerc = parseFloat(entry.impacto_terceirizado_total) || 0;
                if (valorTerc > 0) {
                    impactDisplay += `<br><span style="color: #f57c00; font-weight: bold;">Acréscimo Terc.: ${formatCurrency(valorTerc)}</span>`;
                }
            } else if (entry.impacto_terceirizado === 'disc_terceirizado') {
                const valorTerc = parseFloat(entry.impacto_terceirizado_total) || 0;
                if (valorTerc > 0) {
                    impactDisplay += `<br><span style="color: #d32f2f; font-weight: bold;">Desconto Terc.: ${formatCurrency(valorTerc)}</span>`;
                }
            }

            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td data-label="Data">${new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td data-label="Equipamento">${equipmentDisplay}${thirdPartyDisplay}</td>
                <td data-label="Tipo">${entry.type || 'N/A'}</td>
                <td data-label="Descrição">${entry.description || 'N/A'}</td>
                <td data-label="Valor Total">${impactDisplay}</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-warning btn-sm me-2" onclick="editExpenseEntry('${entry.id}')" title="Editar despesa">EDITAR</button>
                    <button class="btn btn-success btn-sm me-2 generate-expense-pdf-btn" data-id="${entry.id}" title="Gerar PDF da despesa">📄 PDF</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteExpenseEntry('${entry.id}', '${workId}')" title="Excluir despesa">EXCLUIR</button>
                </td>
            `;
            expensesEntriesTableBody.appendChild(row);
            
        } catch (rowError) {
            console.error(`❌ Erro ao renderizar despesa ${entry.id}:`, rowError);
        }
    });
    
    // Event listeners para botões de Gerar PDF
    expensesEntriesTableBody.querySelectorAll('.generate-expense-pdf-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const expenseId = btn.dataset.id;
            console.log('Clicou em Gerar PDF - Despesa ID:', expenseId);
            try {
                const expense = entries.find(e => e.id == expenseId);
                if (expense) {
                    openExpensePdfOptionsModal(expense);
                } else {
                    alert('Despesa não encontrada para gerar PDF.');
                }
            } catch (pdfError) {
                console.error('Erro ao gerar PDF:', pdfError);
                alert('Erro ao gerar PDF da despesa: ' + pdfError.message);
            }
        });
    });
};

/**
 * Prepara o formulário para edição
 */
window.editExpenseEntry = async (expenseId) => {
    showSpinner();
    try {
        const expense = await apiClient.fetchData('general_expenses', '*')
            .then(res => res.find(e => e.id == expenseId));
        
        if (!expense) {
            alert('Lançamento não encontrado.');
            return;
        }

        // Preenche campos básicos
        if (expenseEntryWorkSelect) expenseEntryWorkSelect.value = expense.work_id;
        if (expenseEntryDateInput) expenseEntryDateInput.value = expense.date;
        if (expenseEntryTypeSelect) expenseEntryTypeSelect.value = expense.type;
        if (expenseEntryDescriptionInput) expenseEntryDescriptionInput.value = expense.description;
        if (expenseEntryMeasurementImpact) expenseEntryMeasurementImpact.value = expense.measurement_impact || 'none';
        if (expenseEntryNotes) expenseEntryNotes.value = expense.notes || '';

        handleExpenseWorkSelectChange();
        
        setTimeout(() => {
            // Seleciona equipamento
            if (expenseEntryEquipmentSelect && expense.equipment_id) {
                expenseEntryEquipmentSelect.value = expense.equipment_id;
            }

            // Seleciona terceirizada
            const thirdPartySelect = document.getElementById('expense-entry-third-party-select');
            if (thirdPartySelect && expense.terceirizado_id) {
                thirdPartySelect.value = expense.terceirizado_id;
            }

            updateDynamicFields();
            
            setTimeout(() => {
                // Seleciona impacto terceirizado
                const impactTercSelect = document.getElementById('expense-entry-measurement-impact-terceirizado');
                if (impactTercSelect && expense.impacto_terceirizado) {
                    impactTercSelect.value = expense.impacto_terceirizado;
                }
                
                // Preenche campos de impacto cliente
                const clienteValorInput = document.getElementById('expense-cliente-valor-unitario');
                const clienteQtdeInput = document.getElementById('expense-cliente-qtde');
                const clienteUnidadeSelect = document.getElementById('expense-cliente-unidade');
                
                if (clienteValorInput && expense.impacto_cliente_valor_unitario !== null) {
                    clienteValorInput.value = expense.impacto_cliente_valor_unitario;
                }
                if (clienteQtdeInput && expense.impacto_cliente_qtde !== null) {
                    clienteQtdeInput.value = expense.impacto_cliente_qtde;
                }
                if (clienteUnidadeSelect && expense.impacto_cliente_unidade) {
                    clienteUnidadeSelect.value = expense.impacto_cliente_unidade;
                }
                
                // Preenche campos de impacto terceirizado
                const tercValorInput = document.getElementById('expense-terceirizado-valor-unitario');
                const tercQtdeInput = document.getElementById('expense-terceirizado-qtde');
                const tercUnidadeSelect = document.getElementById('expense-terceirizado-unidade');
                
                if (tercValorInput && expense.impacto_terceirizado_valor_unitario !== null) {
                    tercValorInput.value = expense.impacto_terceirizado_valor_unitario;
                }
                if (tercQtdeInput && expense.impacto_terceirizado_qtde !== null) {
                    tercQtdeInput.value = expense.impacto_terceirizado_qtde;
                }
                if (tercUnidadeSelect && expense.impacto_terceirizado_unidade) {
                    tercUnidadeSelect.value = expense.impacto_terceirizado_unidade;
                }
                
                // Recalcula totais
                const clienteTotalInput = document.getElementById('expense-cliente-total');
                if (clienteTotalInput && expense.impacto_cliente_total !== null) {
                    clienteTotalInput.value = formatCurrency(expense.impacto_cliente_total);
                }
                
                const tercTotalInput = document.getElementById('expense-terceirizado-total');
                if (tercTotalInput && expense.impacto_terceirizado_total !== null) {
                    tercTotalInput.value = formatCurrency(expense.impacto_terceirizado_total);
                }
                
            }, 150);

        }, 100);

        editingExpenseId = expenseId;
        addExpenseEntryBtn.textContent = 'Atualizar Despesa';
        addExpenseEntryBtn.classList.remove('btn-primary');
        addExpenseEntryBtn.classList.add('btn-warning');

        document.getElementById('expense-entry-work-select').scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        console.error("Erro ao carregar dados para edição:", e);
        alert(`Erro ao carregar dados: ${e.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Confirma a exclusão
 */
window.confirmDeleteExpenseEntry = (expenseId, workId) => {
    if (confirm('Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.')) {
        deleteExpenseEntry(expenseId, workId);
    }
};

/**
 * Exclui um lançamento
 */
const deleteExpenseEntry = async (expenseId, workId) => {
    showSpinner();
    try {
        await apiClient.deleteItem('general_expenses', expenseId);
        alert('Despesa excluída com sucesso!');
        await loadExpenseEntries(workId);
        
        if (editingExpenseId === expenseId) {
            editingExpenseId = null;
            addExpenseEntryBtn.textContent = 'Adicionar Despesa';
            addExpenseEntryBtn.classList.remove('btn-warning');
            addExpenseEntryBtn.classList.add('btn-primary');
            clearForm();
        }
    } catch (err) {
        console.error("Erro ao excluir despesa:", err);
        alert(`Erro ao excluir lançamento: ${err.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Gera PDF simples de despesa e retorna blob
 * @param {Object} expense - Dados da despesa
 * @returns {Promise<Blob>} - Blob do PDF gerado
 */
const generateExpensePdfBlob = async (expense) => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        console.error('jsPDF não disponível');
        return null;
    }
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    // Configuração
    const margin = 20;
    let y = margin;
    const lineHeight = 7;
    
    // Título
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('COMPROVANTE DE DESPESA', 105, y, { align: 'center' });
    y += lineHeight * 2;
    
    // Dados da obra
    const work = appState.works.find(w => w.id == expense.work_id);
    const client = appState.client_companies.find(c => c.id == work?.client_company_id);
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Obra: ${work?.name || 'N/A'}`, margin, y);
    y += lineHeight;
    pdf.setFont(undefined, 'normal');
    pdf.text(`Cliente: ${client?.name || 'N/A'}`, margin, y);
    y += lineHeight;
    pdf.text(`Data: ${new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR')}`, margin, y);
    y += lineHeight * 2;
    
    // Dados da despesa
    pdf.setFont(undefined, 'bold');
    pdf.text('DETALHES DA DESPESA:', margin, y);
    y += lineHeight;
    pdf.setFont(undefined, 'normal');
    
    pdf.text(`Tipo: ${expense.type || 'N/A'}`, margin, y);
    y += lineHeight;
    pdf.text(`Descrição: ${expense.description || 'N/A'}`, margin, y);
    y += lineHeight;
    
    // Equipamento (se tiver)
    if (expense.equipment_id) {
        const equipment = appState.equipment.find(e => e.id == expense.equipment_id);
        pdf.text(`Equipamento: ${equipment ? `${equipment.prefix} - ${getEquipTypeName(equipment.type)}` : 'N/A'}`, margin, y);
        y += lineHeight;
    }
    
    // Valores
    y += lineHeight;
    pdf.setFont(undefined, 'bold');
    pdf.text('VALORES:', margin, y);
    y += lineHeight;
    pdf.setFont(undefined, 'normal');
    
    if (expense.impacto_cliente_valor_unitario) {
        pdf.text(`Cliente - Valor Unitário: R$ ${(parseFloat(expense.impacto_cliente_valor_unitario) || 0).toFixed(2)}`, margin, y);
        y += lineHeight;
        pdf.text(`Cliente - Quantidade: ${expense.impacto_cliente_qtde || 0} ${expense.impacto_cliente_unidade || ''}`, margin, y);
        y += lineHeight;
        pdf.text(`Cliente - Total: R$ ${(parseFloat(expense.impacto_cliente_total) || 0).toFixed(2)}`, margin, y);
        y += lineHeight;
    }
    
    if (expense.impacto_terceirizado_valor_unitario) {
        pdf.text(`Terceirizado - Valor Unitário: R$ ${(parseFloat(expense.impacto_terceirizado_valor_unitario) || 0).toFixed(2)}`, margin, y);
        y += lineHeight;
        pdf.text(`Terceirizado - Quantidade: ${expense.impacto_terceirizado_qtde || 0} ${expense.impacto_terceirizado_unidade || ''}`, margin, y);
        y += lineHeight;
        pdf.text(`Terceirizado - Total: R$ ${(parseFloat(expense.impacto_terceirizado_total) || 0).toFixed(2)}`, margin, y);
        y += lineHeight;
    }
    
    // Observações
    if (expense.notes) {
        y += lineHeight;
        pdf.setFont(undefined, 'bold');
        pdf.text('OBSERVAÇÕES:', margin, y);
        y += lineHeight;
        pdf.setFont(undefined, 'normal');
        
        const lines = pdf.splitTextToSize(expense.notes, 170);
        lines.forEach(line => {
            pdf.text(line, margin, y);
            y += lineHeight;
        });
    }
    
    return pdf.output('blob');
};

/**
 * Faz upload do PDF de despesa para o Google Drive automaticamente
 * @param {Object} expense - Objeto da despesa salva
 */
const uploadExpensePdfToDrive = async (expense) => {
    try {
        console.log('🔧 Iniciando upload automático do PDF de despesa para Google Drive...');
        console.log('📋 Despesa:', expense);
        
        // 1. Gerar PDF blob
        const pdfBlob = await generateExpensePdfBlob(expense);
        if (!pdfBlob) {
            console.error('❌ Erro ao gerar PDF de despesa');
            return;
        }
        console.log('✅ PDF gerado, tamanho:', pdfBlob.size);
        
        // 2. Extrair informações
        const work = appState.works.find(w => w.id == expense.work_id);
        const workName = work?.name || 'OBRA_DESCONHECIDA';
        const client = work ? appState.client_companies.find(c => c.id == work.client_company_id) : null;
        const companyName = client?.name || 'EMPRESA';
        const expenseDate = expense.date || new Date().toISOString().split('T')[0];
        
        console.log('🏢 Obra:', workName);
        console.log('👤 Cliente:', companyName);
        console.log('📅 Data:', expenseDate);
        
        // 3. Determinar BM e período CORRETAMENTE usando os períodos da obra
        const bmLabel = getBMLabelForDate(expenseDate, work?.config?.measurement_periods);
        
        // Encontrar o período correspondente para pegar as datas corretas
        let dateRange = formatMonthYear(new Date(expenseDate + 'T00:00:00'));
        if (bmLabel && work?.config?.measurement_periods) {
            const bmNumber = parseInt(bmLabel.replace('BM ', '')) - 1;
            const period = work.config.measurement_periods[bmNumber];
            if (period) {
                const startDate = new Date(period.start + 'T00:00:00');
                const endDate = new Date(period.end + 'T00:00:00');
                dateRange = `${startDate.getDate().toString().padStart(2, '0')}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getFullYear()} a ${endDate.getDate().toString().padStart(2, '0')}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getFullYear()}`;
            }
        }
        
        console.log('📌 BM Label:', bmLabel);
        console.log('📆 Date Range:', dateRange);
        
        // 4. Formatar nome base do arquivo
        const workPart = workName.toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const companyPart = companyName.toUpperCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '_');
        const baseName = `${workPart}_-_${companyPart}_-_${bmLabel}_-_${dateRange}_-_DESPESA`;
        
        console.log('📝 Nome do arquivo:', baseName);
        
        // 5. Converter blob para base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
        });
        reader.readAsDataURL(pdfBlob);
        const pdfData = await base64Promise;
        
        console.log('✅ PDF convertido para base64, tamanho:', pdfData.length);
        console.log('📤 Enviando para API...');
        
        // 6. Enviar para API com flag de sobrescrita
        const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdfData,
                fileName: baseName,
                workName,
                companyName,
                bmLabel,
                dateRange,
                uploadDate: expenseDate,
                overwrite: true  // IMPORTANTE: sobrescrever se já existir
            })
        });
        
        console.log('📥 Resposta recebida, status:', response.status);
        const result = await response.json();
        console.log('📦 Resultado completo:', result);
        
        if (result.success) {
            console.log('✅ PDF de despesa enviado para Google Drive com sucesso!');
            alert('✅ PDF de despesa enviado para o Google Drive!');
        } else {
            console.error('❌ Erro ao enviar PDF para Google Drive:', result.error);
            alert('❌ Erro: ' + result.error);
        }
    } catch (error) {
        console.error('❌ Erro ao fazer upload de PDF de despesa:', error);
        alert('❌ Erro no upload: ' + error.message);
        // Não propaga erro para não interromper o fluxo de salvamento
    }
};

/**
 * Abre modal de opções de PDF para despesa
 */
const openExpensePdfOptionsModal = (expense) => {
    console.log('📄 Abrindo opções de PDF para despesa:', expense.id);

    const work = appState.works.find(w => w.id == expense.work_id);
    const equipment = appState.equipment.find(e => e.id == expense.equipment_id);

    const modalContentHtml = `
        <div style="max-width: 500px; text-align: center;">
            <h3>📄 Gerar PDF - Despesa ${expense.id}</h3>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                <p><strong>Obra:</strong> ${work?.name || 'N/A'}</p>
                <p><strong>Equipamento:</strong> ${equipment ? `${equipment.prefix} - ${getEquipTypeName(equipment.type)}` : 'N/A'}</p>
                <p><strong>Data:</strong> ${expense.date ? new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p>
                <p><strong>Tipo:</strong> ${expense.type || 'N/A'}</p>
                <p><strong>Descrição:</strong> ${expense.description || 'N/A'}</p>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="preview-expense-pdf-btn" class="btn btn-info" style="flex: 1;">
                    👁️ Visualizar PDF
                </button>
                <button id="download-expense-pdf-btn" class="btn btn-success" style="flex: 1;">
                    ⬇️ Baixar PDF
                </button>
            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                <button id="upload-expense-to-drive-btn" class="btn btn-primary" style="flex: 1;">
                    ☁️ Gerar PDF para Google Drive
                </button>
            </div>

            <div style="margin-top: 15px;">
                <button id="close-expense-pdf-modal-btn" class="btn btn-secondary">
                    ❌ Cancelar
                </button>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContentNode = tempDiv.firstElementChild;

    if (typeof openModal === 'function' && modalContentNode) {
        openModal('Opções de PDF', modalContentNode);
        setupExpensePdfOptionsModal(modalContentNode, expense);
    } else {
        console.error('Função openModal não encontrada');
        alert('Erro ao abrir modal de PDF');
    }
};

/**
 * Configura modal de opções de PDF para despesa
 */
const setupExpensePdfOptionsModal = (contentNode, expense) => {
    const previewBtn = contentNode.querySelector('#preview-expense-pdf-btn');
    const downloadBtn = contentNode.querySelector('#download-expense-pdf-btn');
    const uploadToDriveBtn = contentNode.querySelector('#upload-expense-to-drive-btn');
    const closeBtn = contentNode.querySelector('#close-expense-pdf-modal-btn');

    // Botão Visualizar
    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            console.log('📖 Visualizando PDF de despesa');
            showSpinner();
            try {
                const pdfBlob = await generateExpensePdfBlob(expense);
                if (pdfBlob) {
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    window.open(pdfUrl, '_blank');
                }
            } catch (error) {
                console.error('Erro ao visualizar PDF:', error);
                alert('Erro ao visualizar PDF');
            } finally {
                hideSpinner();
                if (typeof closeModal === 'function') closeModal();
            }
        });
    }

    // Botão Download
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            console.log('💾 Baixando PDF de despesa');
            showSpinner();
            try {
                const pdfBlob = await generateExpensePdfBlob(expense);
                if (pdfBlob) {
                    const work = appState.works.find(w => w.id == expense.work_id);
                    const date = new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR').replace(/\//g, '-');
                    const fileName = `DESPESA_${expense.id}_-_${work?.name || 'OBRA'}_-_${date}.pdf`;
                    
                    const url = URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                console.error('Erro ao baixar PDF:', error);
                alert('Erro ao baixar PDF');
            } finally {
                hideSpinner();
                if (typeof closeModal === 'function') closeModal();
            }
        });
    }

    // Botão Upload para Google Drive
    if (uploadToDriveBtn) {
        uploadToDriveBtn.addEventListener('click', async () => {
            console.log('☁️ Enviando PDF de despesa para Google Drive...');
            showSpinner();
            try {
                await uploadExpensePdfToDrive(expense);
                alert('✅ PDF enviado para o Google Drive com sucesso!');
            } catch (error) {
                console.error('❌ Erro ao enviar para Google Drive:', error);
                alert('❌ Erro ao enviar PDF para Google Drive. Verifique o console para detalhes.');
            } finally {
                hideSpinner();
                if (typeof closeModal === 'function') closeModal();
            }
        });
    }

    // Botão Cancelar
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('❌ Cancelando geração de PDF');
            if (typeof closeModal === 'function') closeModal();
        });
    }
};

/**
 * Cancela a edição
 */
window.cancelEditExpenseEntry = () => {
    editingExpenseId = null;
    addExpenseEntryBtn.textContent = 'Adicionar Despesa';
    addExpenseEntryBtn.classList.remove('btn-warning');
    addExpenseEntryBtn.classList.add('btn-primary');
    clearForm();
};