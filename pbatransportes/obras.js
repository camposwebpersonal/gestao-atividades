// obras.js - VERSÃO ATUALIZADA COM MÓDULO DE CÁLCULOS CENTRALIZADO E HORAS DE GARANTIA
import { appState } from './appState.js';
import { showSpinner, hideSpinner, openModal, closeModal, formatFieldValue, formatInputDate, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
// NOVA IMPORTAÇÃO: Módulo centralizado de cálculos para validações e tipos
import {
    validateCalculationData,
    MEASUREMENT_TYPES,
    CALCULATION_DEFAULTS
} from './calculos_valores.js?v=20260302090000';

const addWorkBtn = document.getElementById('add-work-btn');
const worksTableBody = document.querySelector('#works-table tbody');

/**
 * Configurações para os CRUDS genéricos, usadas para carregar dados de referência.
 */
const crudConfigForDataLoading = {
    'client_companies': { table: 'client_companies' },
    'my_companies': { table: 'my_companies' },
    'equipment': { table: 'equipment' },
    'employees': { table: 'employees' },
    'stoppage_types': { table: 'stoppage_types' },
    'material_types': { table: 'material_types' },
    'terceirizados': { table: 'terceirizados' },
};

/**
 * Carrega dados de uma tabela específica do API e os armazena no appState.
 * @param {string} key - A chave no appState onde os dados serão armazenados.
 * @returns {Promise<void>}
 */
const loadGenericCrudDataIntoState = async (key) => {
    if (appState[key] && appState[key].length > 0) return;

    const config = crudConfigForDataLoading[key];
    if (!config) {
        console.warn(`Configuração de CRUD para a chave "${key}" não encontrada para carregamento.`);
        return;
    }
    try {
        const data = await apiClient.fetchData(config.table);
        appState[key] = data;
    } catch (e) {
        console.error(`Falha ao carregar dados para ${key}:`, e);
    }
};

/**
 * Inicializa a seção de Obras, carregando e exibindo a lista de obras.
 */
export const initObras = () => {
    if (addWorkBtn) {
        addWorkBtn.addEventListener('click', () => handleEditWork());
    }
    
    if (worksTableBody) {
        document.getElementById('works-table').addEventListener('click', (e) => {
            if (e.target.matches('[data-action="edit-work"]')) {
                handleEditWork(e.target.dataset.id);
            }
            if (e.target.matches('[data-action="delete-work"]')) {
                handleDeleteWork(e.target.dataset.id);
            }
            if (e.target.matches('.save-work-closed-btn')) {
                handleQuickSaveWorkClosed(e.target.dataset.workId);
            }
        });
    }
    
    // 🧹 BOTÃO DE LIMPEZA DE LIXO DO BANCO (SEÇÃO OBRAS)
    const cleanupWorksBtn = document.getElementById('cleanup-works-btn');
    if (cleanupWorksBtn) {
        cleanupWorksBtn.addEventListener('click', handleCleanupOrphanedData);
    }
    
    loadWorks();
};

/**
 * 🧹 Limpa TODOS os dados órfãos do banco de dados
 * Remove registros que referenciam obras, equipamentos ou funcionários que não existem mais
 * NÃO afeta obras encerradas
 */
const handleCleanupOrphanedData = async () => {
    if (!confirm('🧹 Deseja limpar o banco de dados?\n\nSerão removidos:\n- Lançamentos de obras excluídas\n- Lançamentos de equipamentos excluídos\n- Despesas, avarias, transportes órfãos\n- Salários de funcionários órfãos\n- Cache de BMs órfãos\n\nObras ENCERRADAS não serão afetadas.')) {
        return;
    }

    showSpinner();
    try {
        const result = await apiClient.cleanupAllOrphanedData();
        console.log('✅ Resultado da limpeza:', result);
        alert(`✅ Limpeza concluída!\n\n${result.totalDeleted} registros órfãos removidos.\n\nDetalhes no console.`);
        await loadWorks();
    } catch (error) {
        console.error('Erro na limpeza:', error);
        alert(`❌ Erro ao limpar banco de dados:\n${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Carrega a lista de obras do API e atualiza o estado da aplicação.
 */
const loadWorks = async () => {
    showSpinner();
    try {
        const worksData = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        appState.works = worksData;
        renderWorksTable(worksData);

        await Promise.all([
            ...Object.keys(crudConfigForDataLoading).map(key => loadGenericCrudDataIntoState(key)),
            apiClient.fetchWorkEmployeeSalaries().then(data => appState.work_employee_salaries = data)
        ]);

    } catch (error) {
        console.error("Erro ao carregar obras:", error);
        alert("Não foi possível carregar as obras.");
    } finally {
        hideSpinner();
    }
};

/**
 * Abre o modal para adicionar ou editar uma obra.
 * @param {string|null} id - O ID da obra a ser editada, ou null para adicionar uma nova.
 */
const handleEditWork = (id = null) => {
    const work = id ? appState.works.find(w => w.id == id) : {};
    const form = createWorkForm(work);
    openModal(id ? 'Editar Obra' : 'Adicionar Nova Obra', form);
};

/**
 * Lida com a exclusão de uma obra.
 * @param {string|number} id - O ID da obra a ser excluída.
 */
const handleDeleteWork = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta obra? Todos os lançamentos associados também serão excluídos.')) return;

    showSpinner();
    try {
        // 🧹 PASSO 1: Remover TODOS os dados associados à obra (lançamentos, despesas, avarias, etc.)
        console.log('🧹 Limpando dados associados à obra...');
        await apiClient.deleteWorkRelatedData(id);
        
        // 🗑️ PASSO 2: Excluir a obra
        await apiClient.deleteItem('works', id);
        
        // ♻️ PASSO 3: Limpeza geral de dados órfãos (mantém banco organizado)
        console.log('♻️ Executando limpeza geral do banco de dados...');
        const cleanupResult = await apiClient.cleanupAllOrphanedData();
        
        console.log(`✅ Obra excluída e banco limpo! Total de registros órfãos removidos: ${cleanupResult.totalDeleted}`);
        
        await loadWorks();
    } catch (error) {
        console.error("Erro ao excluir obra:", error);
        alert("Erro ao excluir obra.");
    } finally {
        hideSpinner();
    }
};

/**
 * 💾 SALVA TODAS as obras que tiveram o status alterado
 * Chamado quando clica em qualquer botão "Salvar" individual
 * @param {string|number} workId - O ID da obra (não usado, mas mantido para compatibilidade)
 */
const handleQuickSaveWorkClosed = async (workId) => {
    // Coleta TODAS as obras que foram alteradas
    const checkboxes = document.querySelectorAll('.work-is-closed-quick');
    const worksToUpdate = [];
    
    checkboxes.forEach(checkbox => {
        const checkboxWorkId = checkbox.dataset.workId;
        const currentWork = appState.works.find(w => w.id == checkboxWorkId);
        const newStatus = checkbox.checked ? 1 : 0;
        const oldStatus = currentWork?.is_closed || 0;
        
        // Só atualizar se mudou
        if (newStatus !== oldStatus) {
            worksToUpdate.push({ id: checkboxWorkId, is_closed: newStatus, name: currentWork?.name });
        }
    });
    
    if (worksToUpdate.length === 0) {
        console.log('ℹ️ Nenhuma alteração detectada');
        return;
    }
    
    showSpinner();
    let successCount = 0;
    let errorCount = 0;
    
    try {
        for (const work of worksToUpdate) {
            try {
                await apiClient.updateItem('works', work.id, { is_closed: work.is_closed });
                
                // Atualizar o estado local
                const localWork = appState.works.find(w => w.id == work.id);
                if (localWork) {
                    localWork.is_closed = work.is_closed;
                }
                
                console.log(`✅ ${work.name}: ${work.is_closed ? 'ENCERRADA' : 'REATIVADA'}`);
                successCount++;
            } catch (err) {
                console.error(`❌ Erro ao salvar ${work.name}:`, err);
                errorCount++;
            }
        }
        
        // Feedback visual discreto (sem alert)
        if (errorCount === 0) {
            console.log(`✅ ${successCount} obra(s) atualizada(s) com sucesso!`);
        } else {
            console.warn(`⚠️ ${successCount} obra(s) salva(s), ${errorCount} erro(s)`);
            alert(`⚠️ ${successCount} obra(s) salva(s), mas ${errorCount} teve(m) erro(s).`);
        }
        
        // Recarregar para sincronizar
        await loadWorks();
        
    } catch (error) {
        console.error("Erro geral ao salvar obras:", error);
        alert(`Erro ao salvar obras: ${error.message}`);
    } finally {
        hideSpinner();
    }
};



/**
 * FUNÇÃO AUXILIAR ATUALIZADA: Valida configuração de equipamento usando módulo centralizado
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} equipment - Dados do equipamento
 * @returns {Object} Resultado da validação {isValid, warnings}
 */
const validateEquipmentConfiguration = (equipConfig, equipment) => {
    const warnings = [];
    let isValid = true;

    // Validação básica de tipos de medição
    const validMeasurementTypes = Object.values(MEASUREMENT_TYPES);
    
    if (!validMeasurementTypes.includes(equipConfig.measurement_type)) {
        warnings.push(`Tipo de medição inválido: ${equipConfig.measurement_type}`);
        isValid = false;
    }

    if (!equipConfig.measurement_value || isNaN(parseFloat(equipConfig.measurement_value))) {
        warnings.push('Valor de medição é obrigatório e deve ser numérico');
        isValid = false;
    }

    // Validações específicas para terceirizados
    if (equipment?.is_terceirizado) {
        if (equipConfig.measurement_type_terceirizado && 
            !validMeasurementTypes.includes(equipConfig.measurement_type_terceirizado)) {
            warnings.push(`Tipo de medição terceirizado inválido: ${equipConfig.measurement_type_terceirizado}`);
        }

        if (equipConfig.measurement_value_terceirizado && 
            isNaN(parseFloat(equipConfig.measurement_value_terceirizado))) {
            warnings.push('Valor de medição terceirizado deve ser numérico se informado');
        }
    }

    // Validação de cálculo mensal
    if (equipConfig.measurement_type === MEASUREMENT_TYPES.MONTHLY) {
        const monthlyCalc = equipConfig.monthly_calculation || CALCULATION_DEFAULTS.DEFAULT_MONTHLY_CALCULATION;
        if (!['proportional', 'fixed_30'].includes(monthlyCalc)) {
            warnings.push('Tipo de cálculo mensal deve ser "proportional" ou "fixed_30"');
        }
    }

    // NOVA VALIDAÇÃO: Horas de Garantia
    if (equipConfig.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        if (isNaN(parseFloat(equipConfig.guaranteed_hours)) || parseFloat(equipConfig.guaranteed_hours) <= 0) {
            warnings.push('Horas de garantia são obrigatórias e devem ser um número positivo para este tipo de medição');
            isValid = false;
        }
        // Para este tipo, o valor de medição deve ser o valor mensal
        if (isNaN(parseFloat(equipConfig.measurement_value)) || parseFloat(equipConfig.measurement_value) <= 0) {
            warnings.push('Valor mensal é obrigatório e deve ser um número positivo para medição com horas de garantia');
            isValid = false;
        }
    }


    return { isValid, warnings };
};

/**
 * Cria o formulário HTML para adicionar/editar obras, incluindo todas as configurações.
 * @param {Object} work - O objeto da obra a ser editada (ou vazio para nova obra).
 * @returns {HTMLFormElement} O elemento do formulário.
 */
const createWorkForm = (work = {}) => {
    const form = document.createElement('form');
    form.id = 'work-form';
    const workConfig = work.config || {};

    // Ordena empresas clientes alfabeticamente
const sortedClientCompanies = [...appState.client_companies].sort((a, b) => {
    const nameA = (a.name || '').toUpperCase();
    const nameB = (b.name || '').toUpperCase();
    return nameA.localeCompare(nameB);
});
const clientOptions = sortedClientCompanies.map(c => `<option value="${c.id}" ${work.client_company_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('');

// 🎯 NOVA OBRA: Seleciona automaticamente "PBA TRANSPORTES" como padrão
const pbaCompany = appState.my_companies.find(c => c.name && c.name.toUpperCase().includes('PBA TRANSPORTES'));
const defaultMyCompanyId = work.id ? work.my_company_id : (pbaCompany?.id || null);

const myCompanyOptions = [...appState.my_companies].sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR')).map(c => `<option value="${c.id}" ${defaultMyCompanyId == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    
    const sortedEquipment = [...appState.equipment].sort((a, b) => {
        const typeA = getEquipTypeName(a.type).toUpperCase();
        const typeB = getEquipTypeName(b.type).toUpperCase();
        if (typeA < typeB) return -1;
        if (typeA > typeB) return 1;

        const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
        const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
        if (prefixA < prefixB) return -1;
        if (prefixA > prefixB) return 1;
        return 0;
    });

    const equipmentOptions = sortedEquipment.map(e => {
        const parts = [
            getEquipTypeName(e.type),
            e.prefix,
            e.brand,
            e.model,
            e.year,
            e.characteristic,
            e.capacidade
        ].filter(Boolean);

        const displayText = parts.join(' - ');
        return `<option value="${e.id}">${displayText}</option>`;
    }).join('');

    // Ordena funcionários alfabeticamente por nome
const sortedEmployees = [...appState.employees].sort((a, b) => {
    const nameA = (a.name || '').toUpperCase();
    const nameB = (b.name || '').toUpperCase();
    return nameA.localeCompare(nameB);
});
const employeeOptions = sortedEmployees.map(emp => `<option value="${emp.id}">${emp.name} - ${emp.role || 'N/A'}</option>`).join('');
    // Ordena tipos de material alfabeticamente
const sortedMaterialTypes = [...appState.material_types].sort((a, b) => {
    const nameA = (a.name || '').toUpperCase();
    const nameB = (b.name || '').toUpperCase();
    return nameA.localeCompare(nameB);
});
const materialTypeOptions = sortedMaterialTypes.map(mt => `<option value="${mt.id}">${mt.name}</option>`).join('');

    const responsibleEmails = (workConfig.responsible_emails || []).join(', ');
    const ccEmails = (workConfig.cc_emails || []).join(', ');
    const bccEmails = (workConfig.bcc_emails || []).join(', ');

    form.innerHTML = `
        <input type="hidden" name="id" value="${work.id || ''}">
        
        <!-- BOTÕES NO TOPO -->
        <div class="modal-header-buttons" style="display: flex; gap: 10px; margin-bottom: 20px; padding: 15px; background-color: #2a2a2a; border-radius: 8px; justify-content: flex-end;">
            <button type="button" class="btn btn-success save-without-close-btn">Salvar</button>
            <button type="submit" class="btn btn-primary">Salvar Obra</button>
            <button type="button" class="btn btn-secondary close-modal-btn-top">Fechar</button>
        </div>

        <fieldset>
            <legend>Informações Gerais</legend>
            <div class="form-grid">
                <div class="form-group">
                    <label for="work-name">Nome da Obra</label>
                    <input type="text" id="work-name" name="name" value="${work.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="work-my-company">Minha Empresa (Contratada)</label>
                    <select id="work-my-company" name="my_company_id" required><option value="">Selecione...</option>${myCompanyOptions}</select>
                </div>
                <div class="form-group">
                    <label for="work-client">Empresa Contratante (Cliente)</label>
                    <select id="work-client" name="client_company_id" required><option value="">Selecione...</option>${clientOptions}</select>
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label for="responsible-emails">E-mails dos Responsáveis (separados por vírgula ou nova linha)</label>
                    <textarea id="responsible-emails" name="responsible_emails" rows="3" placeholder="email1@example.com, email2@example.com">${responsibleEmails}</textarea>
                    <small class="text-muted">Estes e-mails serão usados como sugestão para envio de relatórios de avarias.</small>
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label for="cc-emails">E-mails com Cópia (CC) - Opcional</label>
                    <textarea id="cc-emails" name="cc_emails" rows="2" placeholder="cc1@example.com, cc2@example.com">${ccEmails}</textarea>
                    <small class="text-muted">E-mails que receberão cópia dos relatórios de avarias.</small>
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label for="bcc-emails">E-mails com Cópia Oculta (BCC) - Opcional</label>
                    <textarea id="bcc-emails" name="bcc_emails" rows="2" placeholder="bcc1@example.com, bcc2@example.com">${bccEmails}</textarea>
                    <small class="text-muted">E-mails que receberão cópia oculta dos relatórios de avarias.</small>
                </div>
            </div>
        </fieldset>

        <fieldset>
            <legend>Configurações Gerais da Obra</legend>
            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                <div class="form-group">
                    <label>Obra Encerrada?</label>
                    <input type="checkbox" name="is_closed" ${work?.is_closed ? 'checked' : ''}>
                </div>
                <div class="form-group">
                    <label>Contabilizar Sábado?</label>
                    <input type="checkbox" name="count_saturday" ${workConfig.count_saturday !== undefined ? (workConfig.count_saturday ? 'checked' : '') : 'checked'}>
                </div>
                <div class="form-group">
                    <label>Contabilizar Domingo?</label>
                    <input type="checkbox" name="count_sunday" ${workConfig.count_sunday !== undefined ? (workConfig.count_sunday ? 'checked' : '') : 'checked'}>
                </div>
                <div class="form-group">
                    <label>Contabilizar Feriados?</label>
                    <input type="checkbox" name="count_holiday" ${workConfig.count_holiday !== undefined ? (workConfig.count_holiday ? 'checked' : '') : 'checked'}>
                </div>
            </div>
        </fieldset>

        <fieldset>
            <legend>Turnos de Trabalho (Formato HH:MM)</legend>
            <h4>Turno Diurno</h4>
            <div class="form-grid">
                <div class="form-group"><label>Início</label><input type="time" name="day_shift_start" value="${workConfig.day_shift_start || '08:00'}"></div>
                <div class="form-group"><label>Fim</label><input type="time" name="day_shift_end" value="${workConfig.day_shift_end || '17:00'}"></div>
                <div class="form-group"><label>Início Refeição</label><input type="time" name="day_meal_start" value="${workConfig.day_meal_start || '12:00'}"></div>
                <div class="form-group"><label>Fim Refeição</label><input type="time" name="day_meal_end" value="${workConfig.day_meal_end || '13:00'}"></div>
            </div>
            <h4>Turno Noturno</h4>
            <div class="form-grid">
                <div class="form-group"><label>Início</label><input type="time" name="night_shift_start" value="${workConfig.night_shift_start || '18:00'}"></div>
                <div class="form-group"><label>Fim</label><input type="time" name="night_shift_end" value="${workConfig.night_shift_end || '04:00'}"></div>
                <div class="form-group"><label>Início Refeição</label><input type="time" name="night_meal_start" value="${workConfig.night_meal_start || '22:00'}"></div>
                <div class="form-group"><label>Fim Refeição</label><input type="time" name="night_meal_end" value="${workConfig.night_meal_end || '23:00'}"></div>
            </div>
        </fieldset>

        <fieldset>
            <legend>Períodos de Medição (BMs)</legend>
            <div id="bm-periods-list"></div>
            <div class="form-grid" style="align-items: end; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                 <div class="form-group"><label>Data Início do Período</label><input type="date" id="add-bm-start-date"></div>
                 <div class="form-group"><label>Data Fim do Período</label><input type="date" id="add-bm-end-date"></div>
                 <button type="button" id="add-bm-btn" class="btn btn-secondary">Adicionar BM</button>
            </div>
            <!-- 💾 BOTÕES DE SALVAMENTO -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <button type="button" class="btn btn-success save-without-close-btn">💾 Salvar</button>
                <button type="submit" class="btn btn-primary">💾 Salvar Obra</button>
                <button type="button" class="btn btn-secondary close-modal-btn-bm">❌ Fechar</button>
            </div>
        </fieldset>

        <fieldset>
            <legend>Equipamentos na Obra</legend>
            <div id="equipment-config-list"></div>
            <div class="form-grid" style="align-items: end; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                <div class="form-group">
                    <label for="add-equipment-select">Adicionar Equipamento</label>
                    <select id="add-equipment-select"><option value="">Selecione...</option>${equipmentOptions}</select>
                </div>
                <button type="button" id="add-equipment-to-work-btn" class="btn btn-secondary">Adicionar</button>
            </div>
        </fieldset>

        <fieldset>
            <legend>⬍ Ordem de Exibição dos Equipamentos</legend>
            <p style="color: #b0b0b0; font-size: 0.9rem; margin-bottom: 15px;">
                Arraste os equipamentos ou use as setas para definir a ordem de exibição nos relatórios e comboboxes.
            </p>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button type="button" id="sort-by-prefix-btn" class="btn btn-secondary">🔤 Ordenar por Prefixo</button>
                <button type="button" id="sort-by-type-btn" class="btn btn-secondary">🏗️ Ordenar por Tipo</button>
            </div>
            <div id="equipment-order-list" style="display: flex; flex-direction: column; gap: 8px; max-width: 600px;"></div>
            <!-- 💾 BOTÕES DE SALVAMENTO -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <button type="button" class="btn btn-success save-without-close-btn">💾 Salvar</button>
                <button type="submit" class="btn btn-primary">💾 Salvar Obra</button>
                <button type="button" class="btn btn-secondary close-modal-btn">❌ Fechar</button>
            </div>
        </fieldset>

        <fieldset>
            <legend>Salário de Funcionários nesta Obra</legend>
            <div id="employee-salary-list"></div>
            <div class="form-grid" style="align-items: end; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                <div class="form-group">
                    <label for="add-employee-salary-select">Adicionar Funcionário</label>
                    <select id="add-employee-salary-select"><option value="">Selecione...</option>${employeeOptions}</select>
                </div>
                <div class="form-group">
                    <label for="add-employee-salary-value">Salário (R$)</label>
                    <input type="number" step="0.01" id="add-employee-salary-value" value="0">
                </div>
                <button type="button" id="add-employee-salary-btn" class="btn btn-secondary">Adicionar Salário</button>
            </div>
            <!-- 💾 BOTÕES DE SALVAMENTO -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <button type="button" class="btn btn-success save-without-close-btn">💾 Salvar</button>
                <button type="submit" class="btn btn-primary">💾 Salvar Obra</button>
                <button type="button" class="btn btn-secondary close-modal-btn">❌ Fechar</button>
            </div>
        </fieldset>

        <fieldset>
            <legend>Preços de Transporte de Materiais</legend>
            <div id="material-transport-price-list"></div>
            <div class="form-grid" style="align-items: end; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
                <div class="form-group">
                    <label for="add-material-type-select">Tipo de Material</label>
                    <select id="add-material-type-select"><option value="">Selecione...</option>${materialTypeOptions}</select>
                </div>
                <div class="form-group">
                    <label for="add-material-volume">Volume (m³)</label>
                    <input type="number" step="0.01" id="add-material-volume" value="0">
                </div>
                <div class="form-group">
                    <label for="add-material-price">Preço por Viagem (R$)</label>
                    <input type="number" step="0.01" id="add-material-price" value="0">
                </div>
                <button type="button" id="add-material-price-btn" class="btn btn-secondary">Adicionar Preço</button>
            </div>
            <!-- 💾 BOTÕES DE SALVAMENTO -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <button type="button" class="btn btn-success save-without-close-btn">💾 Salvar</button>
                <button type="submit" class="btn btn-primary">💾 Salvar Obra</button>
                <button type="button" class="btn btn-secondary close-modal-btn">❌ Fechar</button>
            </div>
        </fieldset>
        
        
        <fieldset>
    <legend>Configurações Padrão dos Relatórios de Medição</legend>
    <p style="color: #b0b0b0; font-size: 0.9rem; margin-bottom: 15px;">
        Defina quais colunas estarão marcadas por padrão ao gerar relatórios para esta obra.
    </p>
    
    <h4 style="color: var(--primary-color); margin-top: 20px;">Relatório de Medição (Cliente)</h4>
    <div class="report-columns-config">
        <div class="column-config-item">
            <input type="checkbox" id="default-dias-trab" name="default_report_dias_trab" ${workConfig.default_report_columns?.dias_trab?.enabled !== false ? 'checked' : ''}>
            <label for="default-dias-trab">Dias Trab.</label>
            <select name="default_report_dias_trab_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.dias_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.dias_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.dias_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-horas-trab" name="default_report_horas_trab" ${workConfig.default_report_columns?.horas_trab?.enabled ? 'checked' : ''}>
            <label for="default-horas-trab">Horas Trab.</label>
            <select name="default_report_horas_trab_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.horas_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.horas_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.horas_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-horimetro-inicial" name="default_report_horimetro_inicial" ${workConfig.default_report_columns?.horimetro_inicial?.enabled ? 'checked' : ''}>
            <label for="default-horimetro-inicial">Horímetro Inicial</label>
            <select name="default_report_horimetro_inicial_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.horimetro_inicial?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.horimetro_inicial?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.horimetro_inicial?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-horimetro-final" name="default_report_horimetro_final" ${workConfig.default_report_columns?.horimetro_final?.enabled ? 'checked' : ''}>
            <label for="default-horimetro-final">Horímetro Final</label>
            <select name="default_report_horimetro_final_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.horimetro_final?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.horimetro_final?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.horimetro_final?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-km-inicial" name="default_report_km_inicial" ${workConfig.default_report_columns?.km_inicial?.enabled ? 'checked' : ''}>
            <label for="default-km-inicial">KM Inicial</label>
            <select name="default_report_km_inicial_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.km_inicial?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.km_inicial?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.km_inicial?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-km-final" name="default_report_km_final" ${workConfig.default_report_columns?.km_final?.enabled ? 'checked' : ''}>
            <label for="default-km-final">KM Final</label>
            <select name="default_report_km_final_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.km_final?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.km_final?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.km_final?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-km-trab" name="default_report_km_trab" ${workConfig.default_report_columns?.km_trab?.enabled ? 'checked' : ''}>
            <label for="default-km-trab">KM Trab.</label>
            <select name="default_report_km_trab_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.km_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.km_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.km_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-acrescimos" name="default_report_acrescimos" ${workConfig.default_report_columns?.acrescimos?.enabled !== false ? 'checked' : ''}>
            <label for="default-acrescimos">Acréscimos (R$)</label>
            <select name="default_report_acrescimos_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.acrescimos?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.acrescimos?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.acrescimos?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-descontos" name="default_report_descontos" ${workConfig.default_report_columns?.descontos?.enabled !== false ? 'checked' : ''}>
            <label for="default-descontos">Descontos (R$)</label>
            <select name="default_report_descontos_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.descontos?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.descontos?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.descontos?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-mobilizacao" name="default_report_mobilizacao" ${workConfig.default_report_columns?.mobilizacao?.enabled !== false ? 'checked' : ''}>
            <label for="default-mobilizacao">Mobilização (R$)</label>
            <select name="default_report_mobilizacao_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.mobilizacao?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.mobilizacao?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.mobilizacao?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-desmobilizacao" name="default_report_desmobilizacao" ${workConfig.default_report_columns?.desmobilizacao?.enabled !== false ? 'checked' : ''}>
            <label for="default-desmobilizacao">Desmobilização (R$)</label>
            <select name="default_report_desmobilizacao_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.desmobilizacao?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.desmobilizacao?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.desmobilizacao?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-horas-paradas" name="default_report_horas_paradas" ${workConfig.default_report_columns?.horas_paradas?.enabled ? 'checked' : ''}>
            <label for="default-horas-paradas">Horas Paradas</label>
            <select name="default_report_horas_paradas_placement" class="placement-select">
                <option value="both" ${(workConfig.default_report_columns?.horas_paradas?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="summary" ${workConfig.default_report_columns?.horas_paradas?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                <option value="details" ${workConfig.default_report_columns?.horas_paradas?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
            </select>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-observacoes" name="default_report_observacoes" ${workConfig.default_report_columns?.observacoes?.enabled !== false ? 'checked' : ''}>
            <label for="default-observacoes">Observações</label>
            <span style="font-size: 0.85rem; color: #b0b0b0;">Detalhes</span>
        </div>
        
        <div class="column-config-item">
            <input type="checkbox" id="default-mostrar-zeros" name="default_report_mostrar_zeros" ${workConfig.default_report_columns?.mostrar_zeros?.enabled !== false ? 'checked' : ''}>
            <label for="default-mostrar-zeros">💰 Mostrar Zeros</label>
            <span style="font-size: 0.85rem; color: #b0b0b0;">Ambos</span>
        </div>
    </div>
    
    <h4 style="color: var(--secondary-color); margin-top: 30px;">Relatório de Medição Terceirizados</h4>
        <div class="report-columns-config">
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-dias-trab" name="default_report_terc_dias_trab" ${workConfig.default_report_columns_terc?.dias_trab?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-dias-trab">Dias Trab.</label>
                <select name="default_report_terc_dias_trab_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.dias_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.dias_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.dias_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-horas-trab" name="default_report_terc_horas_trab" ${workConfig.default_report_columns_terc?.horas_trab?.enabled ? 'checked' : ''}>
                <label for="default-terc-horas-trab">Horas Trab.</label>
                <select name="default_report_terc_horas_trab_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.horas_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.horas_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.horas_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-horimetro-inicial" name="default_report_terc_horimetro_inicial" ${workConfig.default_report_columns_terc?.horimetro_inicial?.enabled ? 'checked' : ''}>
                <label for="default-terc-horimetro-inicial">Horímetro Inicial</label>
                <select name="default_report_terc_horimetro_inicial_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.horimetro_inicial?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.horimetro_inicial?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.horimetro_inicial?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-horimetro-final" name="default_report_terc_horimetro_final" ${workConfig.default_report_columns_terc?.horimetro_final?.enabled ? 'checked' : ''}>
                <label for="default-terc-horimetro-final">Horímetro Final</label>
                <select name="default_report_terc_horimetro_final_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.horimetro_final?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.horimetro_final?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.horimetro_final?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-km-inicial" name="default_report_terc_km_inicial" ${workConfig.default_report_columns_terc?.km_inicial?.enabled ? 'checked' : ''}>
                <label for="default-terc-km-inicial">KM Inicial</label>
                <select name="default_report_terc_km_inicial_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.km_inicial?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.km_inicial?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.km_inicial?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-km-final" name="default_report_terc_km_final" ${workConfig.default_report_columns_terc?.km_final?.enabled ? 'checked' : ''}>
                <label for="default-terc-km-final">KM Final</label>
                <select name="default_report_terc_km_final_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.km_final?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.km_final?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.km_final?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-km-trab" name="default_report_terc_km_trab" ${workConfig.default_report_columns_terc?.km_trab?.enabled ? 'checked' : ''}>
                <label for="default-terc-km-trab">KM Trab.</label>
                <select name="default_report_terc_km_trab_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.km_trab?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.km_trab?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.km_trab?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-paradas-desc" name="default_report_terc_paradas_desc" ${workConfig.default_report_columns_terc?.paradas_desc?.enabled ? 'checked' : ''}>
                <label for="default-terc-paradas-desc">Horas Paradas</label>
                <select name="default_report_terc_paradas_desc_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.paradas_desc?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.paradas_desc?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.paradas_desc?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-dias-parados" name="default_report_terc_dias_parados" ${workConfig.default_report_columns_terc?.dias_parados?.enabled ? 'checked' : ''}>
                <label for="default-terc-dias-parados">Dias Parados</label>
                <select name="default_report_terc_dias_parados_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.dias_parados?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.dias_parados?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.dias_parados?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-valor-mensal" name="default_report_terc_valor_mensal" ${workConfig.default_report_columns_terc?.valor_mensal?.enabled ? 'checked' : ''}>
                <label for="default-terc-valor-mensal">Valor Mensal</label>
                <select name="default_report_terc_valor_mensal_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.valor_mensal?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.valor_mensal?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.valor_mensal?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-valor-diario" name="default_report_terc_valor_diario" ${workConfig.default_report_columns_terc?.valor_diario?.enabled ? 'checked' : ''}>
                <label for="default-terc-valor-diario">Valor Diário</label>
                <select name="default_report_terc_valor_diario_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.valor_diario?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.valor_diario?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.valor_diario?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-valor-horas" name="default_report_terc_valor_horas" ${workConfig.default_report_columns_terc?.valor_horas?.enabled ? 'checked' : ''}>
                <label for="default-terc-valor-horas">Valor das Horas</label>
                <select name="default_report_terc_valor_horas_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.valor_horas?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.valor_horas?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.valor_horas?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-acrescimos" name="default_report_terc_acrescimos" ${workConfig.default_report_columns_terc?.acrescimos?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-acrescimos">Acréscimos (R$)</label>
                <select name="default_report_terc_acrescimos_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.acrescimos?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.acrescimos?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.acrescimos?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-descontos" name="default_report_terc_descontos" ${workConfig.default_report_columns_terc?.descontos?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-descontos">Descontos (R$)</label>
                <select name="default_report_terc_descontos_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.descontos?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.descontos?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.descontos?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-mobilizacao" name="default_report_terc_mobilizacao" ${workConfig.default_report_columns_terc?.mobilizacao?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-mobilizacao">Mobilização (R$)</label>
                <select name="default_report_terc_mobilizacao_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.mobilizacao?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.mobilizacao?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.mobilizacao?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-desmobilizacao" name="default_report_terc_desmobilizacao" ${workConfig.default_report_columns_terc?.desmobilizacao?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-desmobilizacao">Desmobilização (R$)</label>
                <select name="default_report_terc_desmobilizacao_placement" class="placement-select">
                    <option value="both" ${(workConfig.default_report_columns_terc?.desmobilizacao?.placement || 'both') === 'both' ? 'selected' : ''}>Ambos</option>
                    <option value="summary" ${workConfig.default_report_columns_terc?.desmobilizacao?.placement === 'summary' ? 'selected' : ''}>Resumo</option>
                    <option value="details" ${workConfig.default_report_columns_terc?.desmobilizacao?.placement === 'details' ? 'selected' : ''}>Detalhes</option>
                </select>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-observacoes" name="default_report_terc_observacoes" ${workConfig.default_report_columns_terc?.observacoes?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-observacoes">Observações</label>
                <span style="font-size: 0.85rem; color: #b0b0b0;">Detalhes</span>
            </div>
            
            <div class="column-config-item">
                <input type="checkbox" id="default-terc-mostrar-zeros" name="default_report_terc_mostrar_zeros" ${workConfig.default_report_columns_terc?.mostrar_zeros?.enabled !== false ? 'checked' : ''}>
                <label for="default-terc-mostrar-zeros">💰 Mostrar Zeros</label>
                <span style="font-size: 0.85rem; color: #b0b0b0;">Ambos</span>
            </div>
        </div>
        
        <h4 style="color: var(--secondary-color); margin-top: 30px; border-top: 2px solid var(--secondary-color); padding-top: 20px;">Configurações Específicas por Empresa Terceirizada</h4>
<p style="color: #b0b0b0; font-size: 0.9rem; margin-bottom: 15px;">
    Configure colunas personalizadas para empresas terceirizadas específicas. Quando você filtrar apenas essa empresa no relatório, essas configurações serão aplicadas automaticamente.
</p>

<div id="terceirizado-specific-columns-list"></div>

<div class="form-grid" style="align-items: end; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 15px;">
    <div class="form-group">
        <label for="add-terceirizado-column-config-select">Adicionar Configuração para Terceirizado</label>
        <select id="add-terceirizado-column-config-select">
            <option value="">Selecione...</option>
            ${appState.terceirizados.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
    </div>
    <button type="button" id="add-terceirizado-column-config-btn" class="btn btn-secondary">Adicionar Terceirizado</button>
</div>

<h4 style="color: var(--primary-color); margin-top: 30px; border-top: 2px solid var(--primary-color); padding-top: 20px;">Paradas com Desconto Padrão nesta Obra</h4>
<p style="color: #b0b0b0; font-size: 0.9rem; margin-bottom: 15px;">
    Selecione as paradas que serão aplicadas por padrão para todos os equipamentos desta obra.
</p>
<div class="stoppage-checkboxes-grid" id="default-stoppages-container">
    ${appState.stoppage_types.map(st => {
        // Define os nomes que devem vir marcados por padrão
        const defaultStoppageNames = ['CHUVA', 'QUEBRA', 'PARADA', 'MANUTENÇÃO'];
        const stoppageNameUpper = (st.name || '').trim().toUpperCase();
        const shouldBeCheckedByDefault = defaultStoppageNames.includes(stoppageNameUpper);
        
        // Se já existe configuração, usa ela; senão usa o padrão
        const isChecked = workConfig.default_deductible_stoppages 
            ? workConfig.default_deductible_stoppages.includes(st.id.toString())
            : shouldBeCheckedByDefault;
            
        return `
            <div class="stoppage-checkbox-item">
                <input type="checkbox" class="default-stoppage-check" name="default_stoppage_${st.id}"
                       id="default_stoppage_${st.id}" value="${st.id}" 
                       ${isChecked ? 'checked' : ''}>
                <label for="default_stoppage_${st.id}">${st.name}</label>
            </div>
        `;
    }).join('')}
</div>

<button type="button" id="apply-default-stoppages-btn" class="btn btn-primary" style="margin-top: 15px;">
    🔄 Atualizar Todos os Equipamentos com Estas Paradas
</button>

<!-- 💾 BOTÕES DE SALVAMENTO -->
<div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
    <button type="button" class="btn btn-success save-without-close-btn">💾 Salvar</button>
    <button type="submit" class="btn btn-primary">💾 Salvar Obra</button>
    <button type="button" class="btn btn-secondary close-modal-btn">❌ Fechar</button>
</div>

</fieldset>
        
        

        <!-- BOTÕES NA PARTE INFERIOR -->
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: space-between;">
                <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-success save-without-close-btn">Salvar</button>
                    <button type="submit" class="btn btn-primary">Salvar Obra</button>
                    <button type="button" class="btn btn-secondary close-modal-btn-bottom">Fechar</button>
                </div>
            </div>
    `;

    // ... (todo o código de renderização de BMs permanece igual)

    const bmListContainer = form.querySelector('#bm-periods-list');
    const renderBmPeriods = () => {
        const periods = JSON.parse(form.dataset.bmPeriods || '[]');
        bmListContainer.innerHTML = periods.length === 0 ? '<p>Nenhum período de medição definido.</p>' : `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>BM</th>
                            <th>Início</th>
                            <th>Fim</th>
                            <th style="font-size: 0.75rem;">Proporcional<br/>ao Mês</th>
                            <th style="font-size: 0.75rem;">Lógica de<br/>Mês Fechado</th>
                            <th>Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${periods.map((p, i) => {
                            const startDate = new Date(p.start + 'T00:00:00');
                            const endDate = new Date(p.end + 'T00:00:00');
                            const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                            
                            // Detectar se é período completo (aproximadamente 28-31 dias)
                            const isFullMonth = daysDiff >= 28 && daysDiff <= 31;
                            
                            return `
                            <tr>
                                <td>BM ${i + 1}</td>
                                <td>${startDate.toLocaleDateString('pt-BR')}</td>
                                <td>${endDate.toLocaleDateString('pt-BR')}</td>
                                <td style="text-align: center;">
                                    <input 
                                        type="checkbox" 
                                        class="bm-proportional-check" 
                                        data-index="${i}"
                                        ${p.proportional_month ? 'checked' : ''}
                                        ${isFullMonth ? 'disabled' : ''}
                                        title="${isFullMonth ? 'Período completo - sempre usa mês inteiro' : 'Marcar para usar horas do mês completo'}"
                                    />
                                    ${isFullMonth ? '<small style="color: #666;">(Mês completo)</small>' : ''}
                                </td>
                                <td style="text-align: center;">
                                    <select class="bm-month-logic-select" data-index="${i}" style="font-size: 0.75rem; padding: 2px;">
                                        <option value="same_day" ${(p.month_logic || 'same_day') === 'same_day' ? 'selected' : ''}>Mesmo dia mês seguinte</option>
                                        <option value="days_count" ${p.month_logic === 'days_count' ? 'selected' : ''}>Dias do mês inicial</option>
                                    </select>
                                </td>
                                <td><button type="button" class="btn btn-danger btn-sm remove-bm-btn" data-index="${i}">&times;</button></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Adicionar event listeners para os checkboxes e selects
        bmListContainer.querySelectorAll('.bm-proportional-check').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                let periods = JSON.parse(form.dataset.bmPeriods);
                periods[index].proportional_month = e.target.checked;
                form.dataset.bmPeriods = JSON.stringify(periods);
            });
        });
        
        bmListContainer.querySelectorAll('.bm-month-logic-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                let periods = JSON.parse(form.dataset.bmPeriods);
                periods[index].month_logic = e.target.value;
                form.dataset.bmPeriods = JSON.stringify(periods);
            });
        });
    };

    form.dataset.bmPeriods = JSON.stringify(workConfig.measurement_periods || []);
    renderBmPeriods();

    form.querySelector('#add-bm-btn').addEventListener('click', () => {
        const start = form.querySelector('#add-bm-start-date').value;
        const end = form.querySelector('#add-bm-end-date').value;
        if (!start || !end) {
            alert('Preencha as datas de início e fim do BM.');
            return;
        }
        let periods = JSON.parse(form.dataset.bmPeriods);
        periods.push({ 
            start, 
            end,
            proportional_month: false, // Padrão: desmarcado (proporcional aos dias)
            month_logic: 'same_day' // Padrão: mesmo dia no mês seguinte
        });
        periods.sort((a, b) => new Date(a.start) - new Date(b.start));
        form.dataset.bmPeriods = JSON.stringify(periods);
        renderBmPeriods();
        form.querySelector('#add-bm-start-date').value = '';
        form.querySelector('#add-bm-end-date').value = '';
    });

    bmListContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-bm-btn')) {
            const index = e.target.dataset.index;
            let periods = JSON.parse(form.dataset.bmPeriods);
            periods.splice(index, 1);
            form.dataset.bmPeriods = JSON.stringify(periods);
            renderBmPeriods();
        }
    });

    const equipmentListContainer = form.querySelector('#equipment-config-list');
    const renderAssociatedEquipment = () => {
    // ⚠️ CRÍTICO: Salva os valores atuais dos campos ANTES de recriar o HTML
    // Usar equipment_id como chave, NÃO o índice, pois o índice muda após reordenação
    const currentEquipmentValues = {};
    const existingItems = equipmentListContainer.querySelectorAll('.equipment-config-item');
    
    existingItems.forEach((itemDiv) => {
        // ⚠️ USAR data-equipment-id do div, NÃO o índice!
        const equipment_id = parseInt(itemDiv.dataset.equipmentId, 10);
        if (!equipment_id) return;
        const savedValues = {};
        
        itemDiv.querySelectorAll('.config-field').forEach(field => {
            const fieldName = field.name;
            const fieldValue = field.value;
            
            const numericFields = [
                'measurement_value', 'measurement_value_terceirizado',
                'mobilization_cost', 'mobilization_cost_terceirizado',
                'demobilization_cost', 'demobilization_cost_terceirizado',
                'guaranteed_hours', 'guaranteed_hours_terceirizado'
            ];
            
            if (field.type === 'checkbox') {
                savedValues[fieldName] = field.checked;
            } else if (numericFields.includes(fieldName)) {
                savedValues[fieldName] = fieldValue && fieldValue.trim() !== '' ? parseFloat(fieldValue) : null;
            } else {
                savedValues[fieldName] = fieldValue;
            }
        });
        
        // Salva também os checkboxes de paradas
        const deductibleStoppages = [];
        itemDiv.querySelectorAll('.stoppage-deduct-check:checked').forEach(chk => {
            deductibleStoppages.push(chk.value);
        });
        savedValues.deductible_stoppages = deductibleStoppages;
        
        // Salvar usando equipment_id como chave
        currentEquipmentValues[equipment_id] = savedValues;
    });
    
    equipmentListContainer.innerHTML = '';
    const currentEquipment = JSON.parse(form.dataset.equipmentConfig || '[]');

    
        currentEquipment.forEach((equipConfig, index) => {
    // ⚠️ CRÍTICO: Mescla os valores digitados usando equipment_id como chave
    const mergedConfig = { ...equipConfig, ...(currentEquipmentValues[equipConfig.equipment_id] || {}) };
            const equipmentDetails = appState.equipment.find(e => e.id == equipConfig.equipment_id);
            const thirdPartyCompany = equipmentDetails?.is_terceirizado ? appState.terceirizados.find(t => t.id == equipmentDetails.terceirizado_id) : null;
            const myCompanyOwner = !equipmentDetails?.is_terceirizado && equipmentDetails?.my_company_id ? appState.my_companies.find(mc => mc.id == equipmentDetails.my_company_id) : null;
            
            const div = document.createElement('div');
            div.className = 'equipment-config-item';
            div.dataset.index = index;
            div.dataset.equipmentId = equipConfig.equipment_id; // ⚠️ CRÍTICO: ID único para identificação

            // Obter as paradas padrão da obra
            const workDefaultStoppages = work?.config?.default_deductible_stoppages || [];
            
            const stoppageCheckboxes = appState.stoppage_types.map(st => {
                // Verifica se este equipamento é REALMENTE novo (acabou de ser adicionado)
                const isNewEquipment = !equipConfig.deductible_stoppages;
                
                // Verifica se esta parada está nas paradas padrão da obra
                const isDefaultStoppage = workDefaultStoppages.includes(st.id.toString());
                
                // Marca o checkbox se:
                // 1. Já estava marcado anteriormente (equipamento editado), OU
                // 2. É um equipamento NOVO (acabou de ser adicionado) E está nas paradas padrão da obra
                const isChecked = (mergedConfig.deductible_stoppages && mergedConfig.deductible_stoppages.includes(st.id.toString())) || 
                  (isNewEquipment && isDefaultStoppage);
                
                return `
                    <div class="stoppage-checkbox-item">
                        <input type="checkbox" class="stoppage-deduct-check" name="stoppage_${st.id}"
                               id="stoppage_${st.id}_${index}" value="${st.id}" 
                               ${isChecked ? 'checked' : ''}>
                        <label for="stoppage_${st.id}_${index}">${st.name}</label>
                    </div>
                `;
            }).join('');
            
            const terceirizadoFieldsHtml = equipmentDetails?.is_terceirizado ? `
                <div class="form-group">
                    <label>Tipo Medição Terc.</label>
                    <select name="measurement_type_terceirizado" class="config-field">
                        <option value="monthly" ${mergedConfig.measurement_type_terceirizado === 'monthly' ? 'selected' : ''}>Mensal</option>
                        <option value="daily" ${mergedConfig.measurement_type_terceirizado === 'daily' ? 'selected' : ''}>Diário</option>
                        <option value="hourly" ${mergedConfig.measurement_type_terceirizado === 'hourly' ? 'selected' : ''}>Horas</option>
                        <option value="${MEASUREMENT_TYPES.GUARANTEED_HOURS}" ${mergedConfig.measurement_type_terceirizado === MEASUREMENT_TYPES.GUARANTEED_HOURS ? 'selected' : ''}>Horas de Garantia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="color: var(--secondary-color); font-weight: bold;">Valor Medição Terceirizado (R$)</label>
                    <input type="number" step="0.01" name="measurement_value_terceirizado" class="config-field" value="${mergedConfig.measurement_value_terceirizado || ''}">
                </div>
                <div class="form-group">
                    <label style="color: var(--secondary-color); font-weight: bold;">Valor Mobilização Terc. (R$)</label>
                    <input type="number" step="0.01" name="mobilization_cost_terceirizado" class="config-field" value="${mergedConfig.mobilization_cost_terceirizado || ''}">
                </div>
                <div class="form-group">
                    <label style="color: var(--secondary-color); font-weight: bold;">Valor Desmobilização Terc. (R$)</label>
                    <input type="number" step="0.01" name="demobilization_cost_terceirizado" class="config-field" value="${mergedConfig.demobilization_cost_terceirizado || ''}">
                </div>
                <div class="form-group">
                    <label style="color: var(--secondary-color); font-weight: bold;">Cálculo Mensal Terc.</label>
                    <select name="monthly_calculation_terceirizado" class="config-field">
                        <option value="proportional" ${mergedConfig.monthly_calculation_terceirizado === 'proportional' ? 'selected' : ''}>Proporcional aos dias do mês</option>
                        <option value="fixed_30" ${mergedConfig.monthly_calculation_terceirizado === 'fixed_30' ? 'selected' : ''}>Baseado em 30 dias</option>
                    </select>
                </div>
                ${(mergedConfig.measurement_type_terceirizado === MEASUREMENT_TYPES.GUARANTEED_HOURS || mergedConfig.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) ? `
                    <div class="form-group">
                        <label style="color: var(--secondary-color); font-weight: bold;">Horas de Garantia Terc.</label>
                        <input type="number" step="0.01" name="guaranteed_hours_terceirizado" class="config-field" value="${mergedConfig.guaranteed_hours_terceirizado || ''}">
                    </div>
                ` : ''}
            ` : '';

            // Prefixo da obra para exibição no título
            const workPrefixDisplay = mergedConfig.equipment_work_prefix ? `<strong style="color: #4fc3f7;">${mergedConfig.equipment_work_prefix}</strong> - ` : '';
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0;">
                        ${equipmentDetails?.prefix || 'Equipamento'} - ${workPrefixDisplay}${getEquipTypeName(equipmentDetails?.type) || ''} 
                        ${equipmentDetails?.is_terceirizado ? `<span class="terceirizado-badge">TERCEIRIZADO</span>` : ''}
                        ${thirdPartyCompany ? `<span class="terceirizado-owner">(${thirdPartyCompany.name})</span>` : ''}
                        ${myCompanyOwner ? `<span class="my-company-owner">(${myCompanyOwner.name})</span>` : ''}
                    </h4>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" class="btn btn-success btn-sm save-equipment-btn">Salvar</button>
                        <button type="button" class="btn btn-primary btn-sm save-equipment-and-close-btn">Salvar Obra</button>
                        <button type="button" class="btn btn-secondary btn-sm close-modal-btn-equipment">Fechar</button>
                        <button type="button" class="btn btn-danger btn-sm remove-equipment-btn">Remover</button>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label>Tipo Medição Contrato</label>
                        <select name="measurement_type" class="config-field">
                            <option value="monthly" ${mergedConfig.measurement_type === 'monthly' ? 'selected' : ''}>Mensal</option>
                            <option value="daily" ${mergedConfig.measurement_type === 'daily' ? 'selected' : ''}>Diário</option>
                            <option value="hourly" ${mergedConfig.measurement_type === 'hourly' ? 'selected' : ''}>Horas</option>
                            <option value="${MEASUREMENT_TYPES.GUARANTEED_HOURS}" ${mergedConfig.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS ? 'selected' : ''}>Horas de Garantia</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valor Contrato (R$)</label>
                        <input type="number" step="0.01" name="measurement_value" class="config-field" value="${mergedConfig.measurement_value || ''}">
                    </div>
                    ${mergedConfig.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS ? `
                        <div class="form-group">
                            <label>Horas de Garantia</label>
                            <input type="number" step="0.01" name="guaranteed_hours" class="config-field" value="${mergedConfig.guaranteed_hours || ''}">
                        </div>
                    ` : ''}
                    ${terceirizadoFieldsHtml}
                    <div class="form-group">
                        <label>Valor Mobilização (R$)</label>
                        <input type="number" step="0.01" name="mobilization_cost" class="config-field" value="${mergedConfig.mobilization_cost || ''}">
                    </div>
                    <div class="form-group">
                        <label>Valor Desmobilização (R$)</label>
                        <input type="number" step="0.01" name="demobilization_cost" class="config-field" value="${mergedConfig.demobilization_cost || ''}">
                    </div>
                     <div class="form-group">
                        <label>Funcionário Padrão (Opcional)</label>
                        <select name="default_operator_id" class="config-field">
                            <option value="">Selecione...</option>
                            ${sortedEmployees.map(emp => `<option value="${emp.id}" ${mergedConfig.default_operator_id == emp.id ? 'selected' : ''}>${emp.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Prefixo do Equipamento na Obra (Opcional)</label>
                        <input type="text" name="equipment_work_prefix" class="config-field" value="${mergedConfig.equipment_work_prefix || ''}" placeholder="Ex: TE-77">
                    </div>
                    <div class="form-group">
                        <label>Cálculo Mensal</label>
                        <select name="monthly_calculation" class="config-field">
                            <option value="proportional" ${mergedConfig.monthly_calculation === 'proportional' ? 'selected' : ''}>Proporcional aos dias do mês</option>
                            <option value="fixed_30" ${mergedConfig.monthly_calculation === 'fixed_30' ? 'selected' : ''}>Baseado em 30 dias</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
    <label style="margin-bottom: 8px;">Paradas com Desconto nesta Obra</label>
    <div class="stoppage-checkboxes-grid">
        ${stoppageCheckboxes}
    </div>
</div>

                </div>
            `;
            equipmentListContainer.appendChild(div);

            const measurementTypeSelect = div.querySelector('select[name="measurement_type"]');
            if (measurementTypeSelect) {
                measurementTypeSelect.addEventListener('change', (e) => {
                    const parentGrid = measurementTypeSelect.closest('.form-grid');
                    let guaranteedHoursDiv = parentGrid.querySelector('input[name="guaranteed_hours"]')?.closest('.form-group');
                    if (!guaranteedHoursDiv) {
                        guaranteedHoursDiv = document.createElement('div');
                        guaranteedHoursDiv.className = 'form-group';
                        guaranteedHoursDiv.innerHTML = `
                            <label>Horas de Garantia</label>
                            <input type="number" step="0.01" name="guaranteed_hours" class="config-field" value="">
                        `;
                        const valueFieldDiv = parentGrid.querySelector('input[name="measurement_value"]')?.closest('.form-group');
                        if (valueFieldDiv) {
                            valueFieldDiv.after(guaranteedHoursDiv);
                        }
                    }

                    if (e.target.value === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
                        guaranteedHoursDiv.style.display = 'block';
                    } else {
                        guaranteedHoursDiv.style.display = 'none';
                    }
                });
                measurementTypeSelect.dispatchEvent(new Event('change'));
            }

            const measurementTypeTercSelect = div.querySelector('select[name="measurement_type_terceirizado"]');
            if (measurementTypeTercSelect) {
                measurementTypeTercSelect.addEventListener('change', (e) => {
                    const parentGrid = measurementTypeTercSelect.closest('.form-grid');
                    let guaranteedHoursTercDiv = parentGrid.querySelector('input[name="guaranteed_hours_terceirizado"]')?.closest('.form-group');
                    if (!guaranteedHoursTercDiv) {
                        guaranteedHoursTercDiv = document.createElement('div');
                        guaranteedHoursTercDiv.className = 'form-group';
                        guaranteedHoursTercDiv.innerHTML = `
                            <label style="color: var(--secondary-color); font-weight: bold;">Horas de Garantia Terc.</label>
                            <input type="number" step="0.01" name="guaranteed_hours_terceirizado" class="config-field" value="">
                        `;
                        const monthlyCalcTercDiv = parentGrid.querySelector('select[name="monthly_calculation_terceirizado"]')?.closest('.form-group');
                        if (monthlyCalcTercDiv) {
                            monthlyCalcTercDiv.after(guaranteedHoursTercDiv);
                        }
                    }

                    if (e.target.value === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
                        guaranteedHoursTercDiv.style.display = 'block';
                    } else {
                        guaranteedHoursTercDiv.style.display = 'none';
                    }
                });
                measurementTypeTercSelect.dispatchEvent(new Event('change'));
            }
        });
    };

    // 🎯 RENDERIZAR LISTA SIMPLIFICADA PARA REORDENAÇÃO
    const equipmentOrderListContainer = form.querySelector('#equipment-order-list');
    
    const renderEquipmentOrderList = () => {
        const currentEquipment = JSON.parse(form.dataset.equipmentConfig || '[]');
        
        if (currentEquipment.length === 0) {
            equipmentOrderListContainer.innerHTML = '<p style="color: #888; font-style: italic;">Nenhum equipamento adicionado ainda.</p>';
            return;
        }
        
        equipmentOrderListContainer.innerHTML = currentEquipment.map((equipConfig, index) => {
            const equipmentDetails = appState.equipment.find(e => e.id == equipConfig.equipment_id);
            if (!equipmentDetails) return '';
            
            // Adicionar prefixo da obra se existir - usar equipment_work_prefix do equipConfig
            const workPrefix = equipConfig.equipment_work_prefix && equipConfig.equipment_work_prefix.trim() !== '' 
                ? `<strong style="color: #4fc3f7;">${equipConfig.equipment_work_prefix}</strong> - ` 
                : '';
            
            return `
                <div class="equipment-order-item" draggable="true" data-index="${index}" style="
                    background: #2a2a2a; 
                    border: 1px solid #444; 
                    border-radius: 5px; 
                    padding: 10px 15px; 
                    display: flex; 
                    align-items: center; 
                    gap: 12px;
                    cursor: grab;
                    transition: all 0.2s;
                ">
                    <span style="color: #888; font-size: 1.2em; cursor: move; user-select: none;">⣿</span>
                    <span style="flex: 1; font-weight: bold; color: #fff;">${equipmentDetails.prefix} - ${workPrefix}${getEquipTypeName(equipmentDetails.type) || ''}</span>
                    <button type="button" class="move-up-btn" data-index="${index}" style="background: none; border: none; color: #64b5f6; font-size: 1.3em; cursor: pointer; padding: 0 8px;" title="Mover para cima">↑</button>
                    <button type="button" class="move-down-btn" data-index="${index}" style="background: none; border: none; color: #64b5f6; font-size: 1.3em; cursor: pointer; padding: 0 8px;" title="Mover para baixo">↓</button>
                </div>
            `;
        }).join('');
    };

    form.dataset.equipmentConfig = JSON.stringify(workConfig.equipment || []);
    renderAssociatedEquipment();
    renderEquipmentOrderList();

    // 🎯 DRAG AND DROP e SETAS para lista simplificada de reordenação
    let draggedOrderItem = null;
    
    equipmentOrderListContainer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('equipment-order-item')) {
            draggedOrderItem = e.target;
            e.target.style.opacity = '0.5';
            e.target.style.cursor = 'grabbing';
        }
    });
    
    equipmentOrderListContainer.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('equipment-order-item')) {
            e.target.style.opacity = '1';
            e.target.style.cursor = 'grab';
        }
    });
    
    equipmentOrderListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElementOrder(equipmentOrderListContainer, e.clientY);
        const draggable = draggedOrderItem;
        
        if (afterElement == null) {
            equipmentOrderListContainer.appendChild(draggable);
        } else {
            equipmentOrderListContainer.insertBefore(draggable, afterElement);
        }
    });
    
    equipmentOrderListContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        // Atualizar o dataset com a nova ordem
        const items = Array.from(equipmentOrderListContainer.querySelectorAll('.equipment-order-item'));
        let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
        
        const reorderedEquipment = items.map(item => {
            const index = parseInt(item.dataset.index, 10);
            return currentEquipment[index];
        });
        
        form.dataset.equipmentConfig = JSON.stringify(reorderedEquipment);
        renderAssociatedEquipment();
        renderEquipmentOrderList();
        
        console.log('✅ Ordem dos equipamentos atualizada via drag-and-drop');
    });
    
    function getDragAfterElementOrder(container, y) {
        const draggableElements = [...container.querySelectorAll('.equipment-order-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // 🎯 SETAS DE MOVIMENTO (↑ ↓)
    equipmentOrderListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('move-up-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            if (index === 0) return; // Já está no topo
            
            let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
            
            console.log('🔄 ANTES DE TROCAR (movendo para cima):');
            console.log('Posição', index - 1, ':', JSON.stringify(currentEquipment[index - 1]));
            console.log('Posição', index, ':', JSON.stringify(currentEquipment[index]));
            
            // Trocar OBJETOS COMPLETOS com o elemento anterior
            const temp = currentEquipment[index - 1];
            currentEquipment[index - 1] = currentEquipment[index];
            currentEquipment[index] = temp;
            
            console.log('✅ DEPOIS DE TROCAR:');
            console.log('Posição', index - 1, ':', JSON.stringify(currentEquipment[index - 1]));
            console.log('Posição', index, ':', JSON.stringify(currentEquipment[index]));
            
            form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
            renderAssociatedEquipment();
            renderEquipmentOrderList();
            
            console.log('✅ Equipamento movido para cima');
        }
        
        if (e.target.classList.contains('move-down-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
            
            if (index === currentEquipment.length - 1) return; // Já está no final
            
            console.log('🔄 ANTES DE TROCAR (movendo para baixo):');
            console.log('Posição', index, ':', JSON.stringify(currentEquipment[index]));
            console.log('Posição', index + 1, ':', JSON.stringify(currentEquipment[index + 1]));
            
            // Trocar OBJETOS COMPLETOS com o elemento seguinte
            const temp = currentEquipment[index];
            currentEquipment[index] = currentEquipment[index + 1];
            currentEquipment[index + 1] = temp;
            
            console.log('✅ DEPOIS DE TROCAR:');
            console.log('Posição', index, ':', JSON.stringify(currentEquipment[index]));
            console.log('Posição', index + 1, ':', JSON.stringify(currentEquipment[index + 1]));
            
            form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
            renderAssociatedEquipment();
            renderEquipmentOrderList();
            
            console.log('✅ Equipamento movido para baixo');
        }
    });

    // 🎯 BOTÕES DE ORDENAÇÃO AUTOMÁTICA
    form.querySelector('#sort-by-prefix-btn').addEventListener('click', () => {
        let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
        
        if (currentEquipment.length === 0) {
            alert('⚠️ Nenhum equipamento para ordenar.');
            return;
        }
        
        // Ordenar por prefixo
        currentEquipment.sort((a, b) => {
            const equipA = appState.equipment.find(e => e.id == a.equipment_id);
            const equipB = appState.equipment.find(e => e.id == b.equipment_id);
            const prefixA = (equipA?.prefix || '').toUpperCase();
            const prefixB = (equipB?.prefix || '').toUpperCase();
            return prefixA.localeCompare(prefixB);
        });
        
        form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
        renderAssociatedEquipment();
        renderEquipmentOrderList();
        
        console.log('✅ Equipamentos ordenados por prefixo');
        alert('✅ Equipamentos ordenados alfabeticamente por PREFIXO');
    });
    
    form.querySelector('#sort-by-type-btn').addEventListener('click', () => {
        let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
        
        if (currentEquipment.length === 0) {
            alert('⚠️ Nenhum equipamento para ordenar.');
            return;
        }
        
        // Ordenar por tipo, depois por prefixo
        currentEquipment.sort((a, b) => {
            const equipA = appState.equipment.find(e => e.id == a.equipment_id);
            const equipB = appState.equipment.find(e => e.id == b.equipment_id);
            
            const typeA = getEquipTypeName(equipA?.type).toUpperCase();
            const typeB = getEquipTypeName(equipB?.type).toUpperCase();
            
            if (typeA !== typeB) {
                return typeA.localeCompare(typeB);
            }
            
            // Se o tipo for igual, ordenar por prefixo
            const prefixA = (equipA?.prefix || '').toUpperCase();
            const prefixB = (equipB?.prefix || '').toUpperCase();
            return prefixA.localeCompare(prefixB);
        });
        
        form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
        renderAssociatedEquipment();
        renderEquipmentOrderList();
        
        console.log('✅ Equipamentos ordenados por tipo');
        alert('✅ Equipamentos ordenados alfabeticamente por TIPO');
    });

    form.querySelector('#add-equipment-to-work-btn').addEventListener('click', () => {
        const equipmentId = form.querySelector('#add-equipment-select').value;
        if (!equipmentId) return;

        let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
        if (currentEquipment.some(e => e.equipment_id == equipmentId)) {
            alert('Este equipamento já foi adicionado.');
            return;
        }

        currentEquipment.push({ equipment_id: equipmentId });
        form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
        renderAssociatedEquipment();
        renderEquipmentOrderList();
        
        // ✅ RESET: Volta o combobox para "Selecione..."
        form.querySelector('#add-equipment-select').value = '';
    });

    // Event listener para botões de salvar nos equipamentos
    equipmentListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-equipment-btn')) {
            const itemDiv = e.target.closest('.equipment-config-item');
            const indexToRemove = parseInt(itemDiv.dataset.index, 10);

            let currentEquipment = JSON.parse(form.dataset.equipmentConfig);
            currentEquipment.splice(indexToRemove, 1);
            form.dataset.equipmentConfig = JSON.stringify(currentEquipment);
            renderAssociatedEquipment();
            renderEquipmentOrderList();
        }
        
        // Botão "Salvar" ao lado do equipamento (sem fechar)
        if (e.target.classList.contains('save-equipment-btn')) {
            await saveWork(false);
        }
        
        // Botão "Salvar Obra" ao lado do equipamento (salva e fecha)
        if (e.target.classList.contains('save-equipment-and-close-btn')) {
            await saveWork(true);
        }
    });


    const employeeSalaryListContainer = form.querySelector('#employee-salary-list');
    const renderEmployeeSalaries = () => {
        employeeSalaryListContainer.innerHTML = '';
        const currentSalaries = JSON.parse(form.dataset.employeeSalaries || '[]');
        currentSalaries.forEach((empSal, index) => {
            const employeeDetails = appState.employees.find(e => e.id == empSal.employee_id);
            if (!employeeDetails) return;

            const div = document.createElement('div');
            div.className = 'form-grid employee-salary-item';
            div.dataset.index = index;
            div.innerHTML = `
                <div class="form-group">
                    <label>Funcionário</label>
                    <input type="text" value="${employeeDetails.name} - ${employeeDetails.role || 'N/A'}" disabled>
                    <input type="hidden" class="employee-id-field" value="${empSal.employee_id}">
                </div>
                <div class="form-group">
                    <label>Salário (R$)</label>
                    <input type="number" step="0.01" class="employee-salary-field" value="${empSal.salary || 0}">
                </div>
                <button type="button" class="btn btn-danger btn-sm remove-employee-salary-btn" style="align-self: flex-end;">Remover</button>
            `;
            employeeSalaryListContainer.appendChild(div);
        });
        if (currentSalaries.length === 0) {
            employeeSalaryListContainer.innerHTML = '<p>Nenhum salário de funcionário configurado para esta obra.</p>';
        }
    };

    const workSalaries = appState.work_employee_salaries.filter(wes => wes.work_id == work.id);
    form.dataset.employeeSalaries = JSON.stringify(workSalaries.map(ws => ({ employee_id: ws.employee_id, salary: ws.salary })));
    renderEmployeeSalaries();

    form.querySelector('#add-employee-salary-btn').addEventListener('click', () => {
        const employeeId = form.querySelector('#add-employee-salary-select').value;
        const salaryValue = parseFloat(form.querySelector('#add-employee-salary-value').value);

        if (!employeeId || isNaN(salaryValue)) {
            alert('Selecione um funcionário e insira um salário válido.');
            return;
        }

        let currentSalaries = JSON.parse(form.dataset.employeeSalaries);
        if (currentSalaries.some(es => es.employee_id == employeeId)) {
            alert('Este funcionário já tem um salário configurado para esta obra.');
            return;
        }

        currentSalaries.push({ employee_id: employeeId, salary: salaryValue });
        form.dataset.employeeSalaries = JSON.stringify(currentSalaries);
        renderEmployeeSalaries();
        form.querySelector('#add-employee-salary-select').value = '';
        form.querySelector('#add-employee-salary-value').value = '0';
    });

    employeeSalaryListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-employee-salary-btn')) {
            const itemDiv = e.target.closest('.employee-salary-item');
            const indexToRemove = parseInt(itemDiv.dataset.index, 10);

            let currentSalaries = JSON.parse(form.dataset.employeeSalaries);
            currentSalaries.splice(indexToRemove, 1);
            form.dataset.employeeSalaries = JSON.stringify(currentSalaries);
            renderEmployeeSalaries();
        }
    });
    employeeSalaryListContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('employee-salary-field')) {
            const itemDiv = e.target.closest('.employee-salary-item');
            const indexToUpdate = parseInt(itemDiv.dataset.index, 10);
            let currentSalaries = JSON.parse(form.dataset.employeeSalaries);
            currentSalaries[indexToUpdate].salary = parseFloat(e.target.value) || 0;
            form.dataset.employeeSalaries = JSON.stringify(currentSalaries);
        }
    });

    const materialTransportPriceListContainer = form.querySelector('#material-transport-price-list');
    const renderMaterialTransportPrices = () => {
        materialTransportPriceListContainer.innerHTML = '';
        const currentPrices = JSON.parse(form.dataset.materialTransportPrices || '[]');
        currentPrices.forEach((priceConfig, index) => {
            const materialType = appState.material_types.find(mt => mt.id == priceConfig.material_type_id);
            if (!materialType) return;

            const div = document.createElement('div');
            div.className = 'form-grid material-transport-price-item';
            div.dataset.index = index;
            div.innerHTML = `
                <div class="form-group">
                    <label>Material</label>
                    <input type="text" value="${materialType.name}" disabled>
                    <input type="hidden" class="material-type-id-field" value="${priceConfig.material_type_id}">
                </div>
                <div class="form-group">
                    <label>Volume (m³)</label>
                    <input type="number" step="0.01" class="material-volume-field" value="${priceConfig.volume || 0}">
                </div>
                <div class="form-group">
                    <label>Preço por Viagem (R$)</label>
                    <input type="number" step="0.01" class="material-price-field" value="${priceConfig.price || 0}">
                </div>
                <button type="button" class="btn btn-danger btn-sm remove-material-price-btn" style="align-self: flex-end;">Remover</button>
            `;
            materialTransportPriceListContainer.appendChild(div);
        });
        if (currentPrices.length === 0) {
            materialTransportPriceListContainer.innerHTML = '<p>Nenhum preço de transporte de material configurado para esta obra.</p>';
        }
    };

    form.dataset.materialTransportPrices = JSON.stringify(workConfig.material_transport_prices || []);
    renderMaterialTransportPrices();

    form.querySelector('#add-material-price-btn').addEventListener('click', () => {
        const materialTypeId = form.querySelector('#add-material-type-select').value;
        const volume = parseFloat(form.querySelector('#add-material-volume').value);
        const price = parseFloat(form.querySelector('#add-material-price').value);

        if (!materialTypeId || isNaN(volume) || isNaN(price)) {
            alert('Selecione o tipo de material e insira volume e preço válidos.');
            return;
        }

        let currentPrices = JSON.parse(form.dataset.materialTransportPrices);
        const newId = `material-${materialTypeId}-vol-${volume.toFixed(2).replace('.', '-')}-price-${price.toFixed(2).replace('.', '-')}-${Date.now()}`;
        currentPrices.push({ id: newId, material_type_id: materialTypeId, volume: volume, price: price });
        form.dataset.materialTransportPrices = JSON.stringify(currentPrices);
        renderMaterialTransportPrices();
        form.querySelector('#add-material-type-select').value = '';
        form.querySelector('#add-material-volume').value = '0';
        form.querySelector('#add-material-price').value = '0';
    });

    materialTransportPriceListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-material-price-btn')) {
            const itemDiv = e.target.closest('.material-transport-price-item');
            const indexToRemove = parseInt(itemDiv.dataset.index, 10);

            let currentPrices = JSON.parse(form.dataset.materialTransportPrices);
            currentPrices.splice(indexToRemove, 1);
            form.dataset.materialTransportPrices = JSON.stringify(currentPrices);
            renderMaterialTransportPrices();
        }
    });
    materialTransportPriceListContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('material-volume-field') || e.target.classList.contains('material-price-field')) {
            const itemDiv = e.target.closest('.material-transport-price-item');
            const indexToUpdate = parseInt(itemDiv.dataset.index, 10);
            let currentPrices = JSON.parse(form.dataset.materialTransportPrices);
            if (e.target.classList.contains('material-volume-field')) {
                currentPrices[indexToUpdate].volume = parseFloat(e.target.value) || 0;
            } else {
                currentPrices[indexToUpdate].price = parseFloat(e.target.value) || 0;
            }
            form.dataset.materialTransportPrices = JSON.stringify(currentPrices);
        }
    });

        // ============================================================
        // GERENCIAMENTO DE CONFIGURAÇÕES DE COLUNAS POR TERCEIRIZADO
        // ============================================================
        const terceirizadoColumnsListContainer = form.querySelector('#terceirizado-specific-columns-list');
        
        const renderTerceirizadoSpecificColumns = () => {
    terceirizadoColumnsListContainer.innerHTML = '';
    const currentConfigs = JSON.parse(form.dataset.terceirizadoColumnConfigs || '[]');
    
    console.log('[RENDER TERC COLUMNS] Configurações carregadas:', currentConfigs);
    
    if (currentConfigs.length === 0) {
        terceirizadoColumnsListContainer.innerHTML = '<p>Nenhuma configuração específica de terceirizado definida.</p>';
        return;
    }
    
    currentConfigs.forEach((config, index) => {
        const terceirizado = appState.terceirizados.find(t => t.id == config.terceirizado_id);
        if (!terceirizado) return;
        
        const div = document.createElement('div');
        div.className = 'terceirizado-column-config-item';
        div.style.cssText = 'border: 2px solid var(--secondary-color); padding: 15px; margin-bottom: 15px; border-radius: 8px; background: #f8f9fa;';
        div.dataset.index = index;
        
        // Função auxiliar para verificar se está marcado
        const isChecked = (field) => config.columns?.[field]?.enabled !== false;
        const getPlacement = (field) => config.columns?.[field]?.placement || 'both';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h5 style="margin: 0; color: var(--secondary-color);">📋 ${terceirizado.name}</h5>
                <button type="button" class="btn btn-danger btn-sm remove-terceirizado-config-btn">Remover</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-dias-trab" class="terc-column-check" data-field="dias_trab" ${isChecked('dias_trab') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-dias-trab" style="margin: 0; font-size: 0.85rem;">Dias Trab.</label>
                    <select class="terc-placement-select" data-field="dias_trab" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('dias_trab') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('dias_trab') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('dias_trab') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-horas-trab" class="terc-column-check" data-field="horas_trab" ${isChecked('horas_trab') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-horas-trab" style="margin: 0; font-size: 0.85rem;">Horas Trab.</label>
                    <select class="terc-placement-select" data-field="horas_trab" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('horas_trab') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('horas_trab') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('horas_trab') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-horim-inic" class="terc-column-check" data-field="horim_inic" ${isChecked('horim_inic') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-horim-inic" style="margin: 0; font-size: 0.85rem;">Horím. Inic.</label>
                    <select class="terc-placement-select" data-field="horim_inic" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('horim_inic') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('horim_inic') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('horim_inic') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-horim-final" class="terc-column-check" data-field="horim_final" ${isChecked('horim_final') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-horim-final" style="margin: 0; font-size: 0.85rem;">Horím. Final</label>
                    <select class="terc-placement-select" data-field="horim_final" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('horim_final') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('horim_final') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('horim_final') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-km-inicial" class="terc-column-check" data-field="km_inicial" ${isChecked('km_inicial') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-km-inicial" style="margin: 0; font-size: 0.85rem;">KM Inicial</label>
                    <select class="terc-placement-select" data-field="km_inicial" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('km_inicial') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('km_inicial') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('km_inicial') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-km-final" class="terc-column-check" data-field="km_final" ${isChecked('km_final') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-km-final" style="margin: 0; font-size: 0.85rem;">KM Final</label>
                    <select class="terc-placement-select" data-field="km_final" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('km_final') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('km_final') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('km_final') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-km-trab" class="terc-column-check" data-field="km_trab" ${isChecked('km_trab') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-km-trab" style="margin: 0; font-size: 0.85rem;">KM Trab.</label>
                    <select class="terc-placement-select" data-field="km_trab" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('km_trab') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('km_trab') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('km_trab') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-acrescimos" class="terc-column-check" data-field="acrescimos" ${isChecked('acrescimos') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-acrescimos" style="margin: 0; font-size: 0.85rem;">Acréscimos</label>
                    <select class="terc-placement-select" data-field="acrescimos" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('acrescimos') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('acrescimos') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('acrescimos') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px; background: white; border-radius: 4px;">
                    <input type="checkbox" id="terc-${config.terceirizado_id}-descontos" class="terc-column-check" data-field="descontos" ${isChecked('descontos') ? 'checked' : ''}>
                    <label for="terc-${config.terceirizado_id}-descontos" style="margin: 0; font-size: 0.85rem;">Descontos</label>
                    <select class="terc-placement-select" data-field="descontos" style="padding: 2px 4px; font-size: 0.8rem;">
                        <option value="both" ${getPlacement('descontos') === 'both' ? 'selected' : ''}>Ambos</option>
                        <option value="summary" ${getPlacement('descontos') === 'summary' ? 'selected' : ''}>Resumo</option>
                        <option value="details" ${getPlacement('descontos') === 'details' ? 'selected' : ''}>Detalhes</option>
                    </select>
                </div>
            </div>
        `;
        
        terceirizadoColumnsListContainer.appendChild(div);
    });
};

// Inicializar dataset com configurações existentes
form.dataset.terceirizadoColumnConfigs = JSON.stringify(workConfig.terceirizado_specific_columns || []);
renderTerceirizadoSpecificColumns();

// Adicionar novo terceirizado
form.querySelector('#add-terceirizado-column-config-btn').addEventListener('click', () => {
    const terceirizadoId = form.querySelector('#add-terceirizado-column-config-select').value;
    if (!terceirizadoId) {
        alert('Selecione um terceirizado.');
        return;
    }
    
    let currentConfigs = JSON.parse(form.dataset.terceirizadoColumnConfigs);
    
    if (currentConfigs.some(c => c.terceirizado_id == terceirizadoId)) {
        alert('Este terceirizado já possui configurações definidas.');
        return;
    }
    
    currentConfigs.push({
        terceirizado_id: terceirizadoId,
        columns: {}
    });
    
    form.dataset.terceirizadoColumnConfigs = JSON.stringify(currentConfigs);
    renderTerceirizadoSpecificColumns();
    form.querySelector('#add-terceirizado-column-config-select').value = '';
});

// Remover configuração de terceirizado
terceirizadoColumnsListContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-terceirizado-config-btn')) {
        const itemDiv = e.target.closest('.terceirizado-column-config-item');
        const index = parseInt(itemDiv.dataset.index, 10);
        
        let currentConfigs = JSON.parse(form.dataset.terceirizadoColumnConfigs);
        currentConfigs.splice(index, 1);
        form.dataset.terceirizadoColumnConfigs = JSON.stringify(currentConfigs);
        renderTerceirizadoSpecificColumns();
    }
});

// Atualizar configurações quando checkboxes/selects mudarem
terceirizadoColumnsListContainer.addEventListener('change', (e) => {
    const itemDiv = e.target.closest('.terceirizado-column-config-item');
    if (!itemDiv) return;
    
    const index = parseInt(itemDiv.dataset.index, 10);
    let currentConfigs = JSON.parse(form.dataset.terceirizadoColumnConfigs);
    
    if (!currentConfigs[index].columns) {
        currentConfigs[index].columns = {};
    }
    
    // Coletar todas as configurações deste terceirizado
    const checkboxes = itemDiv.querySelectorAll('.terc-column-check');
    checkboxes.forEach(checkbox => {
        const field = checkbox.dataset.field;
        const select = itemDiv.querySelector(`.terc-placement-select[data-field="${field}"]`);
        
        currentConfigs[index].columns[field] = {
            enabled: checkbox.checked,
            placement: select ? select.value : 'both'
        };
    });
    
    form.dataset.terceirizadoColumnConfigs = JSON.stringify(currentConfigs);
});

// Botão para aplicar paradas padrão a todos os equipamentos
form.querySelector('#apply-default-stoppages-btn').addEventListener('click', () => {
    // Coletar paradas padrão selecionadas
    const defaultStoppages = [];
    form.querySelectorAll('.default-stoppage-check:checked').forEach(checkbox => {
        defaultStoppages.push(checkbox.value);
    });
    
    if (defaultStoppages.length === 0) {
        alert('⚠️ Nenhuma parada selecionada. Marque as paradas desejadas antes de atualizar.');
        return;
    }
    
    // Confirmar ação
    const equipmentItems = form.querySelectorAll('.equipment-config-item');
    if (equipmentItems.length === 0) {
        alert('⚠️ Nenhum equipamento cadastrado nesta obra.');
        return;
    }
    
    const confirmAction = confirm(
        `🔄 Atualizar Paradas de Equipamentos\n\n` +
        `Isso irá aplicar as paradas selecionadas para TODOS os ${equipmentItems.length} equipamentos desta obra.\n\n` +
        `Deseja continuar?`
    );
    
    if (!confirmAction) return;
    
    // Atualizar checkboxes de todos os equipamentos
    let updatedCount = 0;
    equipmentItems.forEach(itemDiv => {
        // Desmarcar todos os checkboxes de paradas deste equipamento
        itemDiv.querySelectorAll('.stoppage-deduct-check').forEach(chk => {
            chk.checked = false;
        });
        
        // Marcar apenas as paradas padrão
        defaultStoppages.forEach(stoppageId => {
            const checkbox = itemDiv.querySelector(`.stoppage-deduct-check[value="${stoppageId}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        updatedCount++;
    });
    
    alert(`✅ ${updatedCount} equipamentos atualizados com sucesso!\n\nAs paradas selecionadas foram aplicadas a todos os equipamentos.`);
});



    /**
     * FUNÇÃO AUXILIAR PARA SALVAR A OBRA
     * @param {boolean} shouldClose - Se true, fecha o modal após salvar
     */
    const saveWork = async (shouldClose = true) => {
    const formData = new FormData(form);
    
    const rawEmails = formData.get('responsible_emails') || '';
    const responsibleEmailsArray = rawEmails.split(/[\s,;]+/)
                                         .map(email => email.trim())
                                         .filter(email => email !== '');

    const rawCcEmails = formData.get('cc_emails') || '';
    const ccEmailsArray = rawCcEmails.split(/[\s,;]+/)
                                         .map(email => email.trim())
                                         .filter(email => email !== '');

    const rawBccEmails = formData.get('bcc_emails') || '';
    const bccEmailsArray = rawBccEmails.split(/[\s,;]+/)
                                         .map(email => email.trim())
                                         .filter(email => email !== '');

    const workData = {
        name: formData.get('name'),
        my_company_id: formData.get('my_company_id'),
        client_company_id: formData.get('client_company_id'),
        work_prefix: formData.get('work_prefix') || null,
        is_closed: formData.has('is_closed'),
        config: {
            count_saturday: formData.has('count_saturday'),
            count_sunday: formData.has('count_sunday'),
            count_holiday: formData.has('count_holiday'),
            day_shift_start: formData.get('day_shift_start'),
            day_shift_end: formData.get('day_shift_end'),
            day_meal_start: formData.get('day_meal_start'),
            day_meal_end: formData.get('day_meal_end'),
            night_shift_start: formData.get('night_shift_start'),
            night_shift_end: formData.get('night_shift_end'),
            night_meal_start: formData.get('night_meal_start'),
            night_meal_end: formData.get('night_meal_end'),
            measurement_periods: JSON.parse(form.dataset.bmPeriods),
            equipment: [],
            material_transport_prices: JSON.parse(form.dataset.materialTransportPrices),
            responsible_emails: responsibleEmailsArray,
            cc_emails: ccEmailsArray,
            bcc_emails: bccEmailsArray
        }
    };


        // Salvar configurações padrão dos relatórios
        workData.config.default_report_columns = {
            dias_trab: { 
                enabled: formData.has('default_report_dias_trab'), 
                placement: formData.get('default_report_dias_trab_placement') || 'both' 
            },
            horas_trab: { 
                enabled: formData.has('default_report_horas_trab'), 
                placement: formData.get('default_report_horas_trab_placement') || 'both' 
            },
            horimetro_inicial: { 
                enabled: formData.has('default_report_horimetro_inicial'), 
                placement: formData.get('default_report_horimetro_inicial_placement') || 'both' 
            },
            horimetro_final: { 
                enabled: formData.has('default_report_horimetro_final'), 
                placement: formData.get('default_report_horimetro_final_placement') || 'both' 
            },
            km_inicial: { 
                enabled: formData.has('default_report_km_inicial'), 
                placement: formData.get('default_report_km_inicial_placement') || 'both' 
            },
            km_final: { 
                enabled: formData.has('default_report_km_final'), 
                placement: formData.get('default_report_km_final_placement') || 'both' 
            },
            km_trab: { 
                enabled: formData.has('default_report_km_trab'), 
                placement: formData.get('default_report_km_trab_placement') || 'both' 
            },
            acrescimos: { 
                enabled: formData.has('default_report_acrescimos'), 
                placement: formData.get('default_report_acrescimos_placement') || 'both' 
            },
            descontos: { 
                enabled: formData.has('default_report_descontos'), 
                placement: formData.get('default_report_descontos_placement') || 'both' 
            },
            mobilizacao: { 
                enabled: formData.has('default_report_mobilizacao'), 
                placement: formData.get('default_report_mobilizacao_placement') || 'both' 
            },
            desmobilizacao: { 
                enabled: formData.has('default_report_desmobilizacao'), 
                placement: formData.get('default_report_desmobilizacao_placement') || 'both' 
            },
            horas_paradas: { 
                enabled: formData.has('default_report_horas_paradas'), 
                placement: formData.get('default_report_horas_paradas_placement') || 'both' 
            },
            observacoes: { 
                enabled: formData.has('default_report_observacoes'), 
                placement: 'details' 
            },
            mostrar_zeros: { 
                enabled: formData.has('default_report_mostrar_zeros'), 
                placement: 'both' 
            }
        };
        
        workData.config.terceirizado_specific_columns = JSON.parse(form.dataset.terceirizadoColumnConfigs || '[]');
        
        workData.config.default_report_columns_terc = {
    dias_trab: { 
        enabled: formData.has('default_report_terc_dias_trab'), 
        placement: formData.get('default_report_terc_dias_trab_placement') || 'both' 
    },
    horas_trab: { 
        enabled: formData.has('default_report_terc_horas_trab'), 
        placement: formData.get('default_report_terc_horas_trab_placement') || 'both' 
    },
    horimetro_inicial: { 
        enabled: formData.has('default_report_terc_horimetro_inicial'), 
        placement: formData.get('default_report_terc_horimetro_inicial_placement') || 'both' 
    },
    horimetro_final: { 
        enabled: formData.has('default_report_terc_horimetro_final'), 
        placement: formData.get('default_report_terc_horimetro_final_placement') || 'both' 
    },
    km_inicial: { 
        enabled: formData.has('default_report_terc_km_inicial'), 
        placement: formData.get('default_report_terc_km_inicial_placement') || 'both' 
    },
    km_final: { 
        enabled: formData.has('default_report_terc_km_final'), 
        placement: formData.get('default_report_terc_km_final_placement') || 'both' 
    },
    km_trab: { 
        enabled: formData.has('default_report_terc_km_trab'), 
        placement: formData.get('default_report_terc_km_trab_placement') || 'both' 
    },
    paradas_desc: { 
        enabled: formData.has('default_report_terc_paradas_desc'), 
        placement: formData.get('default_report_terc_paradas_desc_placement') || 'both' 
    },
    dias_parados: { 
        enabled: formData.has('default_report_terc_dias_parados'), 
        placement: formData.get('default_report_terc_dias_parados_placement') || 'both' 
    },
    valor_mensal: { 
        enabled: formData.has('default_report_terc_valor_mensal'), 
        placement: formData.get('default_report_terc_valor_mensal_placement') || 'both' 
    },
    valor_diario: { 
        enabled: formData.has('default_report_terc_valor_diario'), 
        placement: formData.get('default_report_terc_valor_diario_placement') || 'both' 
    },
    valor_horas: { 
        enabled: formData.has('default_report_terc_valor_horas'), 
        placement: formData.get('default_report_terc_valor_horas_placement') || 'both' 
    },
    acrescimos: { 
        enabled: formData.has('default_report_terc_acrescimos'), 
        placement: formData.get('default_report_terc_acrescimos_placement') || 'both' 
    },
    descontos: { 
        enabled: formData.has('default_report_terc_descontos'), 
        placement: formData.get('default_report_terc_descontos_placement') || 'both' 
    },
    mobilizacao: { 
        enabled: formData.has('default_report_terc_mobilizacao'), 
        placement: formData.get('default_report_terc_mobilizacao_placement') || 'both' 
    },
    desmobilizacao: { 
        enabled: formData.has('default_report_terc_desmobilizacao'), 
        placement: formData.get('default_report_terc_desmobilizacao_placement') || 'both' 
    },
    observacoes: { 
        enabled: formData.has('default_report_terc_observacoes'), 
        placement: 'details' 
    },
    mostrar_zeros: { 
        enabled: formData.has('default_report_terc_mostrar_zeros'), 
        placement: 'both' 
    }
};

// Capturar as paradas com desconto padrão da obra
const defaultDeductibleStoppages = [];
form.querySelectorAll('.default-stoppage-check:checked').forEach(checkbox => {
    defaultDeductibleStoppages.push(checkbox.value);
});
workData.config.default_deductible_stoppages = defaultDeductibleStoppages;

// ADICIONE ESTA LINHA NOVA LOGO APÓS O BLOCO ACIMA:
workData.config.terceirizado_specific_columns = JSON.parse(form.dataset.terceirizadoColumnConfigs || '[]');

    const equipmentItems = form.querySelectorAll('.equipment-config-item');
    const currentEquipmentConfig = JSON.parse(form.dataset.equipmentConfig);

    let allEquipmentValid = true;
    const validationWarnings = [];

    // ⚠️ CRÍTICO: Não podemos iterar por equipmentItems diretamente porque eles estão na ordem VISUAL do DOM
    // Precisamos iterar pela ordem correta do currentEquipmentConfig e encontrar o itemDiv correspondente
    currentEquipmentConfig.forEach((originalConfig, configIndex) => {
        // Encontrar o itemDiv que corresponde a este equipamento pelo equipment_id
        let itemDiv = null;
        equipmentItems.forEach((div) => {
            const divIndex = parseInt(div.dataset.index, 10);
            if (currentEquipmentConfig[divIndex]?.equipment_id === originalConfig.equipment_id) {
                itemDiv = div;
            }
        });
        
        if (!itemDiv) {
            console.warn(`⚠️ Não foi possível encontrar itemDiv para equipment_id ${originalConfig.equipment_id}`);
            return;
        }
        
        const newConfig = { equipment_id: originalConfig.equipment_id };

        itemDiv.querySelectorAll('.config-field').forEach(field => {
            const fieldName = field.name;
            const fieldValue = field.value;
            
            const numericFields = [
                'measurement_value', 'measurement_value_terceirizado',
                'mobilization_cost', 'mobilization_cost_terceirizado',
                'demobilization_cost', 'demobilization_cost_terceirizado',
                'guaranteed_hours', 'guaranteed_hours_terceirizado'
            ];
            
            if (field.type === 'checkbox') {
                newConfig[fieldName] = field.checked;
            } else if (numericFields.includes(fieldName)) {
                newConfig[fieldName] = fieldValue && fieldValue.trim() !== '' ? parseFloat(fieldValue) : null;
            } else {
                newConfig[fieldName] = fieldValue;
            }
        });

        const deductibleStoppages = [];
        itemDiv.querySelectorAll('.stoppage-deduct-check:checked').forEach(chk => {
            deductibleStoppages.push(chk.value);
        });
        
        // Se não tiver nenhuma parada selecionada, aplicar as paradas padrão da obra
        if (deductibleStoppages.length === 0 && defaultDeductibleStoppages.length > 0) {
            newConfig.deductible_stoppages = [...defaultDeductibleStoppages];
        } else {
            newConfig.deductible_stoppages = deductibleStoppages;
        }

        const equipmentWorkPrefixInput = itemDiv.querySelector('input[name="equipment_work_prefix"]');
        if (equipmentWorkPrefixInput) {
            newConfig.equipment_work_prefix = equipmentWorkPrefixInput.value || null;
        }

        const equipment = appState.equipment.find(e => e.id == originalConfig.equipment_id);
        const validation = validateEquipmentConfiguration(newConfig, equipment);
        
        if (!validation.isValid) {
            allEquipmentValid = false;
            const equipmentName = equipment ? `${equipment.prefix} - ${getEquipTypeName(equipment.type)}` : `ID: ${originalConfig.equipment_id}`;
            validation.warnings.forEach(warning => {
                validationWarnings.push(`${equipmentName}: ${warning}`);
            });
        }

        workData.config.equipment.push(newConfig);
    });

    if (!allEquipmentValid) {
        const confirmSave = confirm(
            '⚠️ VALIDAÇÃO DE EQUIPAMENTOS:\n\n' +
            validationWarnings.join('\n') +
            '\n\nDeseja salvar mesmo assim? Isso pode causar problemas nos cálculos.'
        );
        
        if (!confirmSave) {
            return;
        } else {
            console.warn('⚠️ Salvando obra com avisos de validação:', validationWarnings);
        }
    }

    showSpinner();
    try {
        let error;
        let workId = work.id;
        if (work.id) {
            ({ error } = await apiClient.updateItem('works', work.id, workData));
            console.log('✅ Obra atualizada com módulo de validação centralizado');
        } else {
            const newWork = await apiClient.addItem('works', workData);
            workId = newWork.id;
            console.log('✅ Nova obra criada com módulo de validação centralizado');
            
            form.querySelector('input[name="id"]').value = workId;
            work.id = workId;
        }
        if (error) throw error;

        const employeeSalariesToSave = JSON.parse(form.dataset.employeeSalaries).map(es => ({
            work_id: workId,
            employee_id: es.employee_id,
            salary: es.salary
        }));

        await apiClient.saveWorkEmployeeSalaries(workId, employeeSalariesToSave);

        console.log('📊 CONFIGURAÇÕES DA OBRA - Módulo Centralizado:');
        console.log(`   🏗️ Equipamentos configurados: ${workData.config.equipment.length}`);
        console.log(`   💰 Salários configurados: ${employeeSalariesToSave.length}`);
        console.log(`   📅 Períodos BM: ${workData.config.measurement_periods.length}`);
        console.log(`   🚛 Preços transporte: ${workData.config.material_transport_prices.length}`);
        console.log(`   📧 E-mails responsáveis: ${workData.config.responsible_emails.length}`);

        if (shouldClose) {
            closeModal();
        } else {
            // 🔄 Atualizar a visualização em tempo real após salvar sem fechar
            form.dataset.equipmentConfig = JSON.stringify(workData.config.equipment);
            renderAssociatedEquipment();
            renderEquipmentOrderList();
        }
        // REMOVIDO: alert('✅ Obra salva com sucesso!');
        
        await loadWorks();
    } catch (e) {
        console.error("Erro ao salvar obra:", e);
        alert(`Erro ao salvar obra: ${e.message}`);
    } finally {
        hideSpinner();
    }
};


    /**
     * EVENT LISTENER PRINCIPAL DO SUBMIT (Salvar Obra - com fechamento)
     */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveWork(true);
    });

    /**
     * EVENT LISTENERS PARA OS BOTÕES "SALVAR" (sem fechar)
     */
    form.querySelectorAll('.save-without-close-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveWork(false);
        });
    });

    form.querySelector('.close-modal-btn').addEventListener('click', closeModal);

    // Event listeners para os novos botões "Fechar"
    form.querySelector('.close-modal-btn-top').addEventListener('click', closeModal);
    form.querySelector('.close-modal-btn-bottom').addEventListener('click', closeModal);
    form.querySelector('.close-modal-btn-bm').addEventListener('click', closeModal);
    
    // Event listener para botão "Fechar" nos equipamentos
    equipmentListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal-btn-equipment')) {
            closeModal();
        }
    });


    return form;
};


/**
 * Renderiza a tabela de obras com os dados fornecidos.
 * @param {Array<Object>} works - A lista de objetos de obra.
 */
const renderWorksTable = (works) => {
    if (!worksTableBody) return;
    worksTableBody.innerHTML = '';
    if (!works || works.length === 0) {
        worksTableBody.innerHTML = '<tr><td colspan="5">Nenhuma obra cadastrada.</td></tr>';
        return;
    }
    
    const headers = ["Nome da Obra", "Minha Empresa", "Cliente", "Equipamentos", "Ações"];
    
    // Ordena as obras alfabeticamente pelo nome
    const sortedWorks = [...works].sort((a, b) => {
        const nameA = (a.name || '').toUpperCase();
        const nameB = (b.name || '').toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
    
    sortedWorks.forEach(work => {
        const associatedEquipmentCount = work.config?.equipment?.length || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="${headers[0]}">${work.name}</td>
            <td data-label="${headers[1]}">${work.my_companies?.name || 'N/A'}</td>
            <td data-label="${headers[2]}">${work.client_companies?.name || 'N/A'}</td>
            <td data-label="${headers[3]}">${associatedEquipmentCount}</td>
            <td data-label="${headers[4]}" class="actions-cell">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm" data-id="${work.id}" data-action="edit-work">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${work.id}" data-action="delete-work">Excluir</button>
                    <div style="display: flex; align-items: center; gap: 5px; background-color: #2c2c2c; padding: 5px 10px; border-radius: 5px;">
                        <input type="checkbox" class="work-is-closed-quick" data-work-id="${work.id}" ${work.is_closed ? 'checked' : ''} style="transform: scale(1.2);">
                        <label style="margin: 0; font-size: 0.85rem; color: #e0e0e0; white-space: nowrap;">Encerrada?</label>
                        <button class="btn btn-success btn-sm save-work-closed-btn" data-work-id="${work.id}" style="padding: 3px 8px; font-size: 0.75rem;">💾 Salvar</button>
                    </div>
                </div>
            </td>
        `;
        worksTableBody.appendChild(row);
    });
};

