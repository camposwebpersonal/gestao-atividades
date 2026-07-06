// lancamentos_areia_v2.js - Módulo REFATORADO COMPLETO para Fornecimento de Areia
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatInputDate, formatDateBR } from './utils.js';
import { apiClient } from './api.js?v=20260223340000';

// ====================================================================
// FLATPICKR: configuração comum DD/MM/YYYY para todos os date inputs
// ====================================================================
let editDeliveryDateFP = null;

const fpDarkStyle = {
    background: '#2a2a2a',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '5px 8px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
};

const fpConfig = () => ({
    locale: window.flatpickr?.l10ns?.pt || 'pt',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd/m/Y',
    allowInput: true,
    onReady: (_d, _s, instance) => {
        if (instance.altInput) {
            Object.assign(instance.altInput.style, fpDarkStyle);
            instance.altInput.addEventListener('focus', () => instance.altInput.select());
        }
    },
});

/** Inicializa flatpickr nos inputs de data estáticos da seção de areia */
function initAreiaFlatpickr() {
    if (typeof flatpickr === 'undefined') return;
    const cfg = fpConfig();
    ['report-start-date', 'report-end-date',
     'geral-start-date',  'geral-end-date',
     'emissao-start-date','emissao-end-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._flatpickr) flatpickr(el, cfg);
    });
    // Edit delivery modal
    const editDateEl = document.getElementById('edit-delivery-date');
    if (editDateEl && !editDateEl._flatpickr) {
        editDeliveryDateFP = flatpickr(editDateEl, cfg);
    } else if (editDateEl?._flatpickr) {
        editDeliveryDateFP = editDateEl._flatpickr;
    }
}

// ====================================================================
// INICIALIZAÇÃO PRINCIPAL
// ====================================================================

export const initSandSection = async () => {
    showSpinner();
    try {
        // Carrega dados básicos
        if (appState.my_companies.length === 0) {
            appState.my_companies = await apiClient.fetchData('my_companies');
        }
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }
        
        // Carrega obras e associações
        await loadSandWorks();
        await loadAssociations();
        
        // Garante que as tabelas existem no servidor
        await fetch('/proj/api/setup_sand_emissions_table.php').catch(() => {});
        await fetch('/proj/api/setup_sand_companies_table.php').catch(() => {});
        await fetch('/proj/api/setup_sand_vehicles.php').catch(() => {});

        // Carrega empresas clientes da seção de areia (tabela independente do cadastro global)
        appState.sand_client_companies = await apiClient.fetchData('sand_client_companies').catch(() => []);

        // Carrega veículos de transporte de areia
        appState.sand_vehicles = await apiClient.fetchData('sand_vehicles', '*', null, 'vehicle').catch(() => []);

        // Carrega emissões de notas
        if (!appState.sand_invoice_emissions) {
            appState.sand_invoice_emissions = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
        }

        // Configura navegação entre abas principais
        document.querySelectorAll('[data-sand-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.sandTab;
                document.querySelectorAll('[data-sand-tab]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('#sand-cadastros-tab, #sand-lancamentos-tab, #sand-relatorios-tab, #sand-emissoes-tab').forEach(t => t.style.display = 'none');
                document.getElementById(tabId).style.display = 'block';

                // Inicializa aba específica
                if (tabId === 'sand-cadastros-tab') {
                    initCadastros();
                } else if (tabId === 'sand-lancamentos-tab') {
                    initLancamentos();
                } else if (tabId === 'sand-relatorios-tab') {
                    initRelatorios();
                } else if (tabId === 'sand-emissoes-tab') {
                    initEmissoes();
                }
            });
        });
        
        // Inicia na aba de lançamentos
        initLancamentos();
        // Inicializa flatpickr nos campos de data da seção de areia
        setTimeout(initAreiaFlatpickr, 0);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar seção de Areia:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

// ====================================================================
// ABA 1: CADASTROS
// ====================================================================

const initCadastros = () => {
    // Sub-abas de Cadastros
    document.querySelectorAll('[data-cadastro-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.cadastroTab;
            document.querySelectorAll('[data-cadastro-tab]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#obras-areia-sub, #associacoes-sub, #sand-clientes-sub, #sand-veiculos-sub').forEach(t => t.style.display = 'none');
            document.getElementById(tabId).style.display = 'block';
        });
    });
    
    // Botões de Obras de Areia
    document.getElementById('save-sand-work-btn').onclick = saveSandWork;
    document.getElementById('cancel-sand-work-btn').onclick = cancelEditSandWork;
    
    // Botões de Associações
    document.getElementById('save-association-btn').onclick = saveAssociation;
    document.getElementById('cancel-association-btn').onclick = cancelEditAssociation;
    
    // Botões de Empresas Clientes (areia)
    document.getElementById('save-sand-client-btn').onclick = saveSandClient;
    document.getElementById('cancel-sand-client-btn').onclick = cancelEditSandClient;

    // Botões de Veículos de Areia
    document.getElementById('save-sand-vehicle-btn').onclick = saveSandVehicle;
    document.getElementById('cancel-sand-vehicle-btn').onclick = cancelEditSandVehicle;
    
    // Popula combos de associações
    populateAssociationCombos();
    
    // Renderiza tabelas
    renderSandWorks();
    renderAssociations();
    renderSandClientCompanies();
    renderSandVehicles();
};

// -------- OBRAS DE AREIA --------

let editingSandWorkId = null;

const loadSandWorks = async () => {
    appState.sand_works = await apiClient.fetchData('sand_works', '*', null, 'name');
};

const saveSandWork = async () => {
    const name = document.getElementById('sand-work-name').value.trim();
    const location = document.getElementById('sand-work-location').value.trim();
    const notes = document.getElementById('sand-work-notes').value.trim();
    
    if (!name) {
        alert('Preencha o nome da obra!');
        return;
    }
    
    showSpinner();
    try {
        const data = { name, location, notes };
        let result;
        
        if (editingSandWorkId) {
            result = await apiClient.upsertItem('sand_works', { ...data, id: editingSandWorkId });
            const index = appState.sand_works.findIndex(w => w.id === editingSandWorkId);
            if (index !== -1) appState.sand_works[index] = result;
        } else {
            result = await apiClient.upsertItem('sand_works', data);
            appState.sand_works.push(result);
        }
        
        clearSandWorkForm();
        renderSandWorks();
        populateAssociationCombos();
        alert('✅ Obra salva com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar obra:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const editSandWork = (id) => {
    const work = appState.sand_works.find(w => w.id === id);
    if (!work) return;
    
    document.getElementById('sand-work-name').value = work.name || '';
    document.getElementById('sand-work-location').value = work.location || '';
    document.getElementById('sand-work-notes').value = work.notes || '';
    
    editingSandWorkId = id;
    document.getElementById('save-sand-work-btn').textContent = 'ATUALIZAR OBRA';
    document.getElementById('cancel-sand-work-btn').style.display = 'inline-block';
};

const deleteSandWork = async (id) => {
    if (!confirm('Deseja realmente excluir esta obra de areia?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('sand_works', id);
        appState.sand_works = appState.sand_works.filter(w => w.id !== id);
        renderSandWorks();
        populateAssociationCombos();
        alert('✅ Obra excluída com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir obra:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const cancelEditSandWork = () => {
    clearSandWorkForm();
};

const clearSandWorkForm = () => {
    document.getElementById('sand-work-name').value = '';
    document.getElementById('sand-work-location').value = '';
    document.getElementById('sand-work-notes').value = '';
    editingSandWorkId = null;
    document.getElementById('save-sand-work-btn').textContent = 'SALVAR OBRA';
    document.getElementById('cancel-sand-work-btn').style.display = 'none';
};

const renderSandWorks = () => {
    const tbody = document.querySelector('#sand-works-table tbody');
    tbody.innerHTML = '';
    
    appState.sand_works.forEach(work => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${work.name || '-'}</td>
            <td>${work.location || '-'}</td>
            <td>${work.notes || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editSandWork(${work.id})">EDITAR</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandWork(${work.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// -------- ASSOCIAÇÕES --------

let editingAssociationId = null;

const loadAssociations = async () => {
    appState.sand_associations = await apiClient.fetchData('sand_associations', '*');
};

const populateAssociationCombos = () => {
    const clientSelect = document.getElementById('assoc-client-company');
    const workSelect = document.getElementById('assoc-sand-work');
    const myCompanySelect = document.getElementById('assoc-my-company');
    
    const sortedClients  = [...(appState.sand_client_companies || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const sortedWorks    = [...appState.sand_works].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    clientSelect.innerHTML = '<option value="">Selecione...</option>';
    sortedClients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    workSelect.innerHTML = '<option value="">Selecione...</option>';
    sortedWorks.forEach(w => {
        workSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
    });
    
    myCompanySelect.innerHTML = '<option value="">Selecione...</option>';
    appState.my_companies.forEach(m => {
        myCompanySelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
    // Pré-seleciona MINERADORA SÃO JORGE por padrão
    const minSaoJorge = appState.my_companies.find(m => m.name.toUpperCase().includes('MINERADORA') && m.name.toUpperCase().includes('JORGE'));
    if (minSaoJorge && !myCompanySelect.value) myCompanySelect.value = minSaoJorge.id;
};

const saveAssociation = async () => {
    const myCompanyId = parseInt(document.getElementById('assoc-my-company').value);
    const clientCompanyId = parseInt(document.getElementById('assoc-client-company').value);
    const sandWorkId = parseInt(document.getElementById('assoc-sand-work').value);
    const priceM3 = parseFloat(document.getElementById('assoc-price-m3').value);
    
    if (!myCompanyId || !clientCompanyId || !sandWorkId || isNaN(priceM3)) {
        alert('Preencha todos os campos!');
        return;
    }
    
    showSpinner();
    try {
        const data = {
            my_company_id: myCompanyId,
            client_company_id: clientCompanyId,
            sand_work_id: sandWorkId,
            price_m3: priceM3
        };
        let result;
        
        if (editingAssociationId) {
            result = await apiClient.upsertItem('sand_associations', { ...data, id: editingAssociationId });
            const index = appState.sand_associations.findIndex(a => a.id === editingAssociationId);
            if (index !== -1) appState.sand_associations[index] = result;
        } else {
            result = await apiClient.upsertItem('sand_associations', data);
            appState.sand_associations.push(result);
        }
        
        clearAssociationForm();
        renderAssociations();
        populateAssociationComboForDeliveries();
        alert('✅ Associação salva com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar associação:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const editAssociation = (id) => {
    const assoc = appState.sand_associations.find(a => a.id === id);
    if (!assoc) return;
    
    document.getElementById('assoc-my-company').value = assoc.my_company_id || '';
    document.getElementById('assoc-client-company').value = assoc.client_company_id || '';
    document.getElementById('assoc-sand-work').value = assoc.sand_work_id || '';
    document.getElementById('assoc-price-m3').value = assoc.price_m3 || '';
    
    editingAssociationId = id;
    document.getElementById('save-association-btn').textContent = 'ATUALIZAR ASSOCIAÇÃO';
    document.getElementById('cancel-association-btn').style.display = 'inline-block';
};

const deleteAssociation = async (id) => {
    if (!confirm('Deseja realmente excluir esta associação?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('sand_associations', id);
        appState.sand_associations = appState.sand_associations.filter(a => a.id !== id);
        renderAssociations();
        populateAssociationComboForDeliveries();
        alert('✅ Associação excluída com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir associação:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const cancelEditAssociation = () => {
    clearAssociationForm();
};

const clearAssociationForm = () => {
    const minSaoJorge = appState.my_companies.find(m => m.name.toUpperCase().includes('MINERADORA') && m.name.toUpperCase().includes('JORGE'));
    document.getElementById('assoc-my-company').value = minSaoJorge ? minSaoJorge.id : '';
    document.getElementById('assoc-client-company').value = '';
    document.getElementById('assoc-sand-work').value = '';
    document.getElementById('assoc-price-m3').value = '';
    editingAssociationId = null;
    document.getElementById('save-association-btn').textContent = 'SALVAR ASSOCIAÇÃO';
    document.getElementById('cancel-association-btn').style.display = 'none';
};

const renderAssociations = () => {
    const tbody = document.querySelector('#associations-table tbody');
    tbody.innerHTML = '';
    
    appState.sand_associations.forEach(assoc => {
        const myCompany = appState.my_companies.find(m => m.id === assoc.my_company_id);
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${myCompany?.name || '-'}</td>
            <td>${clientCompany?.name || '-'}</td>
            <td>${sandWork?.name || '-'}</td>
            <td>${formatCurrency(assoc.price_m3)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editAssociation(${assoc.id})">EDITAR</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteAssociation(${assoc.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// -------- EMPRESAS CLIENTES (areia) --------

let editingSandClientId = null;

const saveSandClient = async () => {
    const name = document.getElementById('sand-client-name').value.trim();
    const cnpj = document.getElementById('sand-client-cnpj').value.trim();
    const observations = document.getElementById('sand-client-observations').value.trim();

    if (!name) {
        alert('Preencha o nome da empresa!');
        return;
    }

    showSpinner();
    try {
        const data = { name, cnpj, observations };
        let result;

        if (editingSandClientId) {
            result = await apiClient.upsertItem('sand_client_companies', { ...data, id: editingSandClientId });
            const index = (appState.sand_client_companies || []).findIndex(c => c.id === editingSandClientId);
            if (index !== -1) appState.sand_client_companies[index] = result;
        } else {
            result = await apiClient.upsertItem('sand_client_companies', data);
            if (!appState.sand_client_companies) appState.sand_client_companies = [];
            appState.sand_client_companies.push(result);
        }

        clearSandClientForm();
        renderSandClientCompanies();
        populateAssociationCombos();
        populateReportClientCombo();
        alert('✅ Empresa salva com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar empresa:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

window.editSandClient = (id) => {
    const client = (appState.sand_client_companies || []).find(c => c.id === id);
    if (!client) return;

    document.getElementById('sand-client-name').value = client.name || '';
    document.getElementById('sand-client-cnpj').value = client.cnpj || '';
    document.getElementById('sand-client-observations').value = client.observations || '';

    editingSandClientId = id;
    document.getElementById('save-sand-client-btn').textContent = 'ATUALIZAR EMPRESA';
    document.getElementById('cancel-sand-client-btn').style.display = 'inline-block';
};

window.deleteSandClient = async (id) => {
    if (!confirm('Deseja realmente excluir esta empresa cliente?')) return;

    showSpinner();
    try {
        await apiClient.deleteItem('sand_client_companies', id);
        appState.sand_client_companies = (appState.sand_client_companies || []).filter(c => c.id !== id);
        renderSandClientCompanies();
        populateAssociationCombos();
        populateReportClientCombo();
        alert('✅ Empresa excluída com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir empresa:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const cancelEditSandClient = () => {
    clearSandClientForm();
};

const clearSandClientForm = () => {
    document.getElementById('sand-client-name').value = '';
    document.getElementById('sand-client-cnpj').value = '';
    document.getElementById('sand-client-observations').value = '';
    editingSandClientId = null;
    document.getElementById('save-sand-client-btn').textContent = 'SALVAR EMPRESA';
    document.getElementById('cancel-sand-client-btn').style.display = 'none';
};

const renderSandClientCompanies = () => {
    const tbody = document.querySelector('#sand-clients-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...(appState.sand_client_companies || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    sorted.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${client.name || '-'}</td>
            <td>${client.cnpj || '-'}</td>
            <td>${client.observations || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editSandClient(${client.id})">EDITAR</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandClient(${client.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// -------- VEÍCULOS DE TRANSPORTE DE AREIA --------

let editingSandVehicleId = null;

const saveSandVehicle = async () => {
    const vehicle = document.getElementById('sand-vehicle-name').value.trim();
    if (!vehicle) { alert('Preencha o veículo!'); return; }

    // Bloqueia duplicatas
    const isDuplicate = (appState.sand_vehicles || []).some(
        v => v.vehicle.toUpperCase() === vehicle.toUpperCase() && v.id !== editingSandVehicleId
    );
    if (isDuplicate) {
        alert(`Veículo “${vehicle}” já está cadastrado! Não é permitido duplicar.`);
        return;
    }
    showSpinner();
    try {
        const data = { vehicle };
        let result;
        if (editingSandVehicleId) {
            result = await apiClient.upsertItem('sand_vehicles', { ...data, id: editingSandVehicleId });
            const index = (appState.sand_vehicles || []).findIndex(v => v.id === editingSandVehicleId);
            if (index !== -1) appState.sand_vehicles[index] = result;
        } else {
            result = await apiClient.upsertItem('sand_vehicles', data);
            if (!appState.sand_vehicles) appState.sand_vehicles = [];
            appState.sand_vehicles.push(result);
        }
        clearSandVehicleForm();
        renderSandVehicles();
        alert('✅ Veículo salvo com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao salvar veículo:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

window.editSandVehicle = (id) => {
    const v = (appState.sand_vehicles || []).find(x => x.id === id);
    if (!v) return;
    document.getElementById('sand-vehicle-name').value = v.vehicle || '';
    editingSandVehicleId = id;
    document.getElementById('save-sand-vehicle-btn').textContent = 'ATUALIZAR VEÍCULO';
    document.getElementById('cancel-sand-vehicle-btn').style.display = 'inline-block';
};

window.deleteSandVehicle = async (id) => {
    if (!confirm('Deseja realmente excluir este veículo?')) return;
    showSpinner();
    try {
        await apiClient.deleteItem('sand_vehicles', id);
        appState.sand_vehicles = (appState.sand_vehicles || []).filter(v => v.id !== id);
        renderSandVehicles();
        alert('✅ Veículo excluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir veículo:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const cancelEditSandVehicle = () => clearSandVehicleForm();

const clearSandVehicleForm = () => {
    document.getElementById('sand-vehicle-name').value = '';
    editingSandVehicleId = null;
    document.getElementById('save-sand-vehicle-btn').textContent = 'SALVAR VEÍCULO';
    document.getElementById('cancel-sand-vehicle-btn').style.display = 'none';
};

const renderSandVehicles = () => {
    const tbody = document.querySelector('#sand-vehicles-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const sorted = [...(appState.sand_vehicles || [])].sort((a, b) => a.vehicle.localeCompare(b.vehicle, 'pt-BR'));
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#aaa;">Nenhum veículo cadastrado.</td></tr>';
        return;
    }
    sorted.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v.vehicle}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editSandVehicle(${v.id})">EDITAR</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandVehicle(${v.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ====================================================================
// ABA 2: LANÇAMENTOS
// ====================================================================

let tripCounter = 0;

const initLancamentos = () => {
    // Popula combo de associações
    populateAssociationComboForDeliveries();
    
    // Botão adicionar viagem
    document.getElementById('add-sand-trip-btn').onclick = addTripRow;
    
    // Botão salvar lançamentos
    document.getElementById('add-sand-delivery-btn').onclick = addSandDelivery;
    
    // Adiciona primeira linha automaticamente
    if (document.getElementById('sand-trips-rows-container').children.length === 0) {
        addTripRow();
    }
    
    // Carrega lançamentos salvos
    loadAndRenderDeliveries();
};

const populateAssociationComboForDeliveries = () => {
    // Não faz nada aqui, será populado nas linhas individuais
};

// Navegação estilo planilha entre as linhas de viagem
// Enter/Tab → mesma coluna, próxima linha | Shift+Tab → linha anterior
// ArrowDown/Up → mesma coluna, próxima/anterior linha
// ArrowRight/Left → próxima/anterior coluna na mesma linha
const setupRowNavigation = (row) => {
    const container = document.getElementById('sand-trips-rows-container');
    const colSelectors = [
        '.trip-association-select',
        '.trip-romaneio-input',
        '.trip-vehicle-select',
        '.trip-date-input',
        '.trip-volume-input',
        '.trip-count-input'
    ];
    const getRows = () => Array.from(container.querySelectorAll('.trip-row'));

    // Retorna o elemento focável: para a data usa o altInput do flatpickr se disponível
    const focusEl = (targetRow, sel) => {
        const el = targetRow.querySelector(sel);
        if (!el) return null;
        return (sel === '.trip-date-input' && el._flatpickr?.altInput) ? el._flatpickr.altInput : el;
    };

    colSelectors.forEach((selector, colIdx) => {
        const field = row.querySelector(selector);
        if (!field) return;

        // Para a coluna de data, o listener vai no altInput (visível); para as demais, no próprio campo
        const listenTarget = (selector === '.trip-date-input' && field._flatpickr?.altInput)
            ? field._flatpickr.altInput
            : field;

        listenTarget.addEventListener('keydown', (e) => {
            const rows = getRows();
            const rowIdx = rows.indexOf(row);

            // Enter ou Tab → próxima linha, mesma coluna
            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                e.preventDefault();
                const target = rows[rowIdx + 1];
                if (target) focusEl(target, selector)?.focus();

            // Shift+Tab → linha anterior, mesma coluna
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                const target = rows[rowIdx - 1];
                if (target) focusEl(target, selector)?.focus();

            // Seta baixo → próxima linha, mesma coluna
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const target = rows[rowIdx + 1];
                if (target) focusEl(target, selector)?.focus();

            // Seta cima → linha anterior, mesma coluna
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const target = rows[rowIdx - 1];
                if (target) focusEl(target, selector)?.focus();

            // Seta direita → próxima coluna na mesma linha
            } else if (e.key === 'ArrowRight') {
                if (colIdx + 1 < colSelectors.length) {
                    e.preventDefault();
                    focusEl(row, colSelectors[colIdx + 1])?.focus();
                }

            // Seta esquerda → coluna anterior na mesma linha
            } else if (e.key === 'ArrowLeft') {
                if (colIdx - 1 >= 0) {
                    e.preventDefault();
                    focusEl(row, colSelectors[colIdx - 1])?.focus();
                }
            }
        });
    });
};

const buildVehicleOptions = () =>
    (appState.sand_vehicles || [])
        .sort((a, b) => a.vehicle.localeCompare(b.vehicle, 'pt-BR'))
        .map(v => `<option value="${v.id}">${v.vehicle}</option>`)
        .join('');

const addTripRow = () => {
    tripCounter++;
    const container = document.getElementById('sand-trips-rows-container');
    
    const row = document.createElement('div');
    row.className = 'trip-row';
    row.id = `trip-row-${tripCounter}`;
    row.style.cssText = 'display: grid; grid-template-columns: 1.8fr 120px 120px 145px 90px 90px 44px; gap: 8px; margin-bottom: 8px; align-items: center;';
    
    // Monta opções: CLIENTE - OBRA - PREÇO - FORNECEDOR
    let options = '<option value="">Selecione EMPRESA - OBRA - PREÇO</option>';
    appState.sand_associations.forEach(assoc => {
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const myCompany = appState.my_companies.find(m => m.id === assoc.my_company_id);
        const price = formatCurrency(assoc.price_m3);
        const label = `${clientCompany?.name || '?'} - ${sandWork?.name || '?'} - ${price} - ${myCompany?.name || '?'}`;
        options += `<option value="${assoc.id}">${label}</option>`;
    });
    
    // Data de hoje no formato YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    const darkInput = 'background:#2a2a2a;color:#e0e0e0;border:1px solid #555;border-radius:4px;padding:5px 8px;font-size:13px;';
    const darkSelect = darkInput + 'width:100%;';
    
    row.innerHTML = `
        <select class="trip-association-select" style="${darkSelect}">
            ${options}
        </select>
        <input type="text" class="trip-romaneio-input" placeholder="N\u00ba Romaneio" style="${darkInput}width:100%;">
        <select class="trip-vehicle-select" style="${darkSelect}"><option value="">-- Veículo --</option>${buildVehicleOptions()}</select>
        <input type="date" class="trip-date-input" lang="pt-BR" value="${today}" style="${darkInput}width:100%;color-scheme:dark;">
        <input type="number" class="trip-volume-input" placeholder="m³" min="0" step="0.01" style="${darkInput}width:100%;">
        <input type="number" class="trip-count-input" placeholder="Qtd" min="1" value="1" style="${darkInput}width:100%;">
        <button type="button" class="btn btn-sm btn-danger" onclick="window.removeTripRow('trip-row-${tripCounter}')" style="padding:4px 8px;">🗑️</button>
    `;
    
    container.appendChild(row);

    // Flatpickr ANTES de setupRowNavigation para que o altInput já exista ao registrar eventos
    if (typeof flatpickr !== 'undefined') {
        const tripDateEl = row.querySelector('.trip-date-input');
        if (tripDateEl && !tripDateEl._flatpickr) {
            flatpickr(tripDateEl, fpConfig());
        }
    }

    setupRowNavigation(row);

    // Pré-seleciona SOI1I70 por padrão
    const defaultVehicle = (appState.sand_vehicles || []).find(
        v => v.vehicle.toUpperCase().includes('SOI1I70')
    );
    if (defaultVehicle) {
        row.querySelector('.trip-vehicle-select').value = defaultVehicle.id;
    }
};

const removeTripRow = (rowId) => {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    
    // Se não sobrar nenhuma linha, adiciona uma nova
    const container = document.getElementById('sand-trips-rows-container');
    if (container.children.length === 0) {
        addTripRow();
    }
};

const addSandDelivery = async () => {
    const container = document.getElementById('sand-trips-rows-container');
    const rows = Array.from(container.querySelectorAll('.trip-row'));
    
    if (rows.length === 0) {
        alert('Adicione pelo menos uma viagem!');
        return;
    }
    
    const notes = document.getElementById('sand-delivery-notes').value.trim();
    
    const trips = [];
    for (const row of rows) {
        const associationId = parseInt(row.querySelector('.trip-association-select').value);
        const romaneio = row.querySelector('.trip-romaneio-input').value.trim();
        const deliveryDate = row.querySelector('.trip-date-input').value;
        const tripCount = parseInt(row.querySelector('.trip-count-input').value);
        const volumeM3 = parseFloat(row.querySelector('.trip-volume-input').value) || 0;
        const vehicleId = parseInt(row.querySelector('.trip-vehicle-select')?.value) || null;
        
        if (!associationId || !romaneio || !deliveryDate || isNaN(tripCount) || tripCount < 1) {
            alert('Preencha todos os campos de todas as viagens!');
            return;
        }
        
        trips.push({
            association_id: associationId,
            romaneio,
            delivery_date: deliveryDate,
            trip_count: tripCount,
            volume_m3: volumeM3,
            vehicle_id: vehicleId,
            invoice_status: 'NAO_EMITIDA',
            notes
        });
    }
    
    showSpinner();
    try {
        for (const trip of trips) {
            await apiClient.upsertItem('sand_deliveries_v2', trip);
        }
        
        alert('✅ Lançamentos adicionados com sucesso!');
        
        // Limpa formulário
        container.innerHTML = '';
        document.getElementById('sand-delivery-notes').value = '';
        tripCounter = 0;
        addTripRow();
        
        // Recarrega tabela
        loadAndRenderDeliveries();
    } catch (error) {
        console.error('❌ Erro ao adicionar lançamentos:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const loadAndRenderDeliveries = async () => {
    showSpinner();
    try {
        appState.sand_deliveries = await apiClient.fetchData('sand_deliveries_v2', '*', null, 'delivery_date DESC');
        // Recarrega emissões para garantir status atualizado na tabela
        appState.sand_invoice_emissions = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
        renderDeliveries();
    } catch (error) {
        console.error('❌ Erro ao carregar lançamentos:', error);
    } finally {
        hideSpinner();
    }
};

const renderDeliveries = () => {
    const tbody = document.querySelector('#sand-deliveries-table tbody');
    tbody.innerHTML = '';
    
    if (!appState.sand_deliveries || appState.sand_deliveries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">Nenhum lançamento encontrado</td></tr>';
        return;
    }

    // Pré-calcula emissionMap por association_id ─────────────────────────
    const getEmissionMap = (assocId, deliveriesForAssoc) => {
        const emissions = (appState.sand_invoice_emissions || []).filter(e => e.association_id == assocId);
        const assoc = appState.sand_associations.find(a => a.id === assocId);
        const priceM3 = parseFloat(assoc?.price_m3 || 0);
        const map = new Map();
        for (const em of emissions) {
            if (em.emission_type === 'date_range') {
                deliveriesForAssoc.forEach(d => {
                    if (em.start_date && d.delivery_date < em.start_date) return;
                    if (em.end_date   && d.delivery_date > em.end_date)   return;
                    const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    map.set(d.id, (map.get(d.id) || 0) + fullVal);
                });
            } else if (em.emission_type === 'value') {
                const valuePaid = parseFloat(em.value_paid || 0);
                const sorted = [...deliveriesForAssoc].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
                let running = 0;
                for (const d of sorted) {
                    if (running >= valuePaid - 0.001) break;
                    const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    const canEmit = Math.min(fullVal, valuePaid - running);
                    map.set(d.id, (map.get(d.id) || 0) + canEmit);
                    running += canEmit;
                }
            }
        }
        return map;
    };

    // Agrupa entregas por association_id para o cálculo proporcional
    const byAssoc = {};
    appState.sand_deliveries.forEach(d => {
        if (!byAssoc[d.association_id]) byAssoc[d.association_id] = [];
        byAssoc[d.association_id].push(d);
    });
    const emissionMaps = {};
    Object.keys(byAssoc).forEach(aId => {
        emissionMaps[aId] = getEmissionMap(parseInt(aId), byAssoc[aId]);
    });
    // ─────────────────────────────────────────────────────────────────────
    
    appState.sand_deliveries.forEach(delivery => {
        const assoc = appState.sand_associations.find(a => a.id === delivery.association_id);
        if (!assoc) return;
        
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const totalValue = parseFloat(delivery.volume_m3 || 0) * parseFloat(assoc.price_m3) * (delivery.trip_count || 1);

        // Status da emissão
        const emittedAmt = emissionMaps[delivery.association_id]?.get(delivery.id) || 0;
        let statusHtml = '';
        let obsHtml = '';
        if (emittedAmt >= totalValue - 0.001 && totalValue > 0) {
            statusHtml = '<span style="color:#27ae60;font-weight:bold;">EMITIDO</span>';
        } else if (emittedAmt > 0.001) {
            statusHtml = '<span style="color:#e67e22;font-weight:bold;">PARCIAL</span>';
            obsHtml = `<span style="color:#2980b9;font-weight:bold;">${formatCurrency(emittedAmt)}</span>`;
        }
        
        const deliveryVehicle = (appState.sand_vehicles || []).find(v => v.id === delivery.vehicle_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${delivery.romaneio || '-'}</td>
            <td>${formatDateBR(delivery.delivery_date)}</td>
            <td>${deliveryVehicle?.vehicle || '-'}</td>
            <td>${clientCompany?.name || '?'} - ${sandWork?.name || '?'}</td>
            <td>${delivery.trip_count}</td>
            <td>${parseFloat(delivery.volume_m3 || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})} m³</td>
            <td>${formatCurrency(assoc.price_m3)}</td>
            <td>${formatCurrency(totalValue)}</td>
            <td>${statusHtml}</td>
            <td>${obsHtml}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editSandDelivery(${delivery.id})">EDITAR</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandDelivery(${delivery.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // ─── Saldo Adiantado por associação ──────────────────────────────────
    Object.keys(byAssoc).forEach(aId => {
        const assoc = appState.sand_associations.find(a => a.id === parseInt(aId));
        if (!assoc) return;
        const emissions = (appState.sand_invoice_emissions || []).filter(e => e.association_id == aId);
        let totalPaid = 0;
        for (const em of emissions) {
            if (em.emission_type === 'value') totalPaid += parseFloat(em.value_paid || 0);
        }
        if (totalPaid <= 0.001) return;
        const priceM3 = parseFloat(assoc.price_m3);
        const totalValue = byAssoc[aId].reduce((sum, d) =>
            sum + parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1), 0);
        const saldo = totalPaid - totalValue;
        if (saldo <= 0.001) return;
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const trSaldo = document.createElement('tr');
        trSaldo.style.background = 'rgba(39,174,96,0.13)';
        trSaldo.innerHTML = `
            <td colspan="6" style="text-align:right;font-weight:bold;color:#1a7a2e;font-style:italic;padding-right:8px;">
                ${clientCompany?.name || '?'} - ${sandWork?.name || '?'}
            </td>
            <td style="font-weight:bold;"></td>
            <td style="font-weight:bold;color:#1a7a2e;">${formatCurrency(saldo)}</td>
            <td><span style="color:#1a7a2e;font-weight:bold;">ADIANTADO</span></td>
            <td><span style="color:#1a7a2e;font-size:0.82em;">Saldo a usar em próx. viagens</span></td>
            <td></td>
        `;
        tbody.appendChild(trSaldo);
    });
};

const deleteSandDelivery = async (id) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('sand_deliveries_v2', id);
        loadAndRenderDeliveries();
        alert('✅ Lançamento excluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir lançamento:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const editSandDelivery = (id) => {
    const delivery = (appState.sand_deliveries || []).find(d => d.id === id);
    if (!delivery) { alert('Lançamento não encontrado.'); return; }

    // Popula selects
    const assocSel = document.getElementById('edit-delivery-association');
    assocSel.innerHTML = '';
    appState.sand_associations.forEach(a => {
        const client = (appState.sand_client_companies || []).find(c => c.id === a.client_company_id);
        const work   = appState.sand_works.find(w => w.id === a.sand_work_id);
        const price  = formatCurrency(a.price_m3);
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${client?.name || '?'} – ${work?.name || '?'} – ${price}`;
        assocSel.appendChild(opt);
    });

    const vehSel = document.getElementById('edit-delivery-vehicle');
    vehSel.innerHTML = '<option value="">-- Nenhum --</option>';
    (appState.sand_vehicles || []).sort((a, b) => a.vehicle.localeCompare(b.vehicle, 'pt-BR')).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.vehicle;
        vehSel.appendChild(opt);
    });

    // Preenche campos
    document.getElementById('edit-delivery-id').value        = delivery.id;
    assocSel.value = delivery.association_id || '';
    document.getElementById('edit-delivery-romaneio').value  = delivery.romaneio || '';
    vehSel.value = delivery.vehicle_id || '';
    initAreiaFlatpickr();
    if (editDeliveryDateFP) {
        editDeliveryDateFP.setDate(delivery.delivery_date || '', true);
    } else {
        document.getElementById('edit-delivery-date').value = delivery.delivery_date || '';
    }
    document.getElementById('edit-delivery-volume').value    = delivery.volume_m3 || '';
    document.getElementById('edit-delivery-trips').value     = delivery.trip_count || 1;
    document.getElementById('edit-delivery-notes').value     = delivery.notes || '';

    // Mostra modal
    const modal = document.getElementById('sand-delivery-edit-modal');
    modal.style.display = 'flex';

    // Botores
    document.getElementById('confirm-edit-delivery-btn').onclick = updateSandDelivery;
    document.getElementById('cancel-edit-delivery-btn').onclick = () => { modal.style.display = 'none'; };
};

const updateSandDelivery = async () => {
    const id            = parseInt(document.getElementById('edit-delivery-id').value);
    const associationId = parseInt(document.getElementById('edit-delivery-association').value);
    const romaneio      = document.getElementById('edit-delivery-romaneio').value.trim();
    const vehicleId     = parseInt(document.getElementById('edit-delivery-vehicle').value) || null;
    const deliveryDate  = document.getElementById('edit-delivery-date').value;
    const volumeM3      = parseFloat(document.getElementById('edit-delivery-volume').value) || 0;
    const tripCount     = parseInt(document.getElementById('edit-delivery-trips').value) || 1;
    const notes         = document.getElementById('edit-delivery-notes').value.trim();

    if (!associationId || !romaneio || !deliveryDate) {
        alert('Preencha os campos obrigatórios (associação, romaneio, data).');
        return;
    }

    showSpinner();
    try {
        const payload = { id, association_id: associationId, romaneio, vehicle_id: vehicleId, delivery_date: deliveryDate, volume_m3: volumeM3, trip_count: tripCount, notes };
        await apiClient.upsertItem('sand_deliveries_v2', payload);
        document.getElementById('sand-delivery-edit-modal').style.display = 'none';
        await loadAndRenderDeliveries();
        alert('✅ Lançamento atualizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao atualizar lançamento:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

// ====================================================================
// ABA 3: RELATÓRIOS
// ====================================================================

const initRelatorios = () => {
    // Sub-abas de Relatórios
    document.querySelectorAll('[data-relatorio-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.relatorioTab;
            document.querySelectorAll('[data-relatorio-tab]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('#sand-relatorios-notas-sub, #sand-relatorios-gerais-sub').forEach(t => t.style.display = 'none');
            document.getElementById(tabId).style.display = 'block';
        });
    });

    // Relatórios Gerais: controle de visibilidade dos campos de período
    const tipoPeriodoSel = document.getElementById('geral-periodo-tipo');
    const toggleGeralFields = () => {
        const tipo = tipoPeriodoSel?.value || 'date_range';
        document.getElementById('geral-start-group').style.display  = tipo === 'date_range' ? '' : 'none';
        document.getElementById('geral-end-group').style.display    = tipo === 'date_range' ? '' : 'none';
        document.getElementById('geral-year-group').style.display   = tipo === 'year'       ? '' : 'none';
        document.getElementById('geral-month-group').style.display  = tipo === 'month'      ? '' : 'none';
        if (tipo === 'year')  populateGeralYearSelect();
        if (tipo === 'month') populateGeralMonthSelect();
    };
    tipoPeriodoSel?.removeEventListener('change', toggleGeralFields);
    tipoPeriodoSel?.addEventListener('change', toggleGeralFields);
    toggleGeralFields();
    document.getElementById('generate-geral-report-btn').onclick = generateGeneralReport;

    // Popula combo de empresa cliente (filtro)
    populateReportClientCombo();
    // Popula combo de associações
    populateReportAssociationCombo();

    // Quando muda o cliente, filtra as associações e ativa/desativa o combo
    const clientSel = document.getElementById('report-client-company-select');
    const assocSel  = document.getElementById('report-association-select');
    clientSel.onchange = () => {
        const clientId = parseInt(clientSel.value) || null;
        if (clientId) {
            assocSel.disabled = true;
            assocSel.value = '';
        } else {
            assocSel.disabled = false;
            populateReportAssociationCombo();
        }
    };

    // Botão gerar relatório
    document.getElementById('generate-sand-report-btn').onclick = generateSandReport;

    // Carrega relatórios salvos
    loadAndRenderSavedReports();

    // Botão gerar relatório geral
    const geralBtn = document.getElementById('generate-geral-report-btn');
    if (geralBtn) {
        const newBtn = geralBtn.cloneNode(true);
        geralBtn.parentNode.replaceChild(newBtn, geralBtn);
        newBtn.onclick = generateGeneralReport;
    }
    // Controle de visibilidade dos campos de período geral
    const periodoTipo = document.getElementById('geral-periodo-tipo');
    const toggleGeralPeriodoFields = () => {
        const tipo = periodoTipo?.value || 'date_range';
        document.getElementById('geral-start-group').style.display  = tipo === 'date_range' ? '' : 'none';
        document.getElementById('geral-end-group').style.display    = tipo === 'date_range' ? '' : 'none';
        document.getElementById('geral-year-group').style.display   = tipo === 'year'       ? '' : 'none';
        document.getElementById('geral-month-group').style.display  = tipo === 'month'      ? '' : 'none';
        if (tipo === 'year')  populateGeralYearSelect();
        if (tipo === 'month') populateGeralMonthSelect();
    };
    if (periodoTipo) {
        periodoTipo.removeEventListener('change', toggleGeralPeriodoFields);
        periodoTipo.addEventListener('change', toggleGeralPeriodoFields);
    }
    toggleGeralPeriodoFields();
};

const populateReportClientCombo = () => {
    const select = document.getElementById('report-client-company-select');
    if (!select) return;
    const sorted = [...(appState.sand_client_companies || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    select.innerHTML = '<option value="">-- Todas as obras --</option>';
    sorted.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
};

const populateReportAssociationCombo = () => {
    const select = document.getElementById('report-association-select');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    appState.sand_associations.forEach(assoc => {
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const price = formatCurrency(assoc.price_m3);
        select.innerHTML += `<option value="${assoc.id}">${clientCompany?.name || '?'} - ${sandWork?.name || '?'} - ${price}</option>`;
    });
};

const generateSandReport = async () => {
    const clientId      = parseInt(document.getElementById('report-client-company-select').value) || null;
    const associationId = parseInt(document.getElementById('report-association-select').value);
    const invoiceStatus = document.getElementById('report-invoice-status').value;
    const startDate = document.getElementById('report-start-date').value;
    const endDate   = document.getElementById('report-end-date').value;

    if (!clientId && !associationId) {
        alert('Selecione uma Empresa Cliente ou uma Empresa-Obra!');
        return;
    }

    showSpinner();
    try {
        if (clientId) {
            // ── MODO CLIENTE: gera PDF com todas as obras do cliente ──
            // Calcula total somando todas as associações do cliente
            const clientAssocs = appState.sand_associations.filter(a => a.client_company_id == clientId);
            let clientTotal = 0;
            for (const a of clientAssocs) {
                const aDeliveries = await apiClient.fetchData('sand_deliveries_v2', '*', { association_id: a.id });
                const filtered = aDeliveries.filter(d => {
                    if (startDate && d.delivery_date < startDate) return false;
                    if (endDate   && d.delivery_date > endDate)   return false;
                    return true;
                });
                filtered.forEach(d => {
                    clientTotal += parseFloat(d.volume_m3 || 0) * parseFloat(a.price_m3) * (d.trip_count || 1);
                });
            }
            const reportData = {
                client_mode:       1,
                client_company_id: clientId,
                report_type:       invoiceStatus,
                start_date:        startDate || null,
                end_date:          endDate   || null,
                total_value:       clientTotal,
                created_at:        new Date().toISOString()
            };
            const savedReport  = await apiClient.upsertItem('sand_reports', reportData);
            const reportForPDF = Object.assign({}, savedReport || {}, reportData);
            reportForPDF.client_mode = 1;
            const pdf = await buildSandReportPDF(reportForPDF);
            window.open(pdf.output('bloburl'), '_blank');
            loadAndRenderSavedReports();
            return;
        }

        // ── MODO NORMAL: uma associação específica ──
        const fetchFilter = { association_id: associationId };
        if (invoiceStatus !== 'TODOS') fetchFilter.invoice_status = invoiceStatus;
        const deliveries = await apiClient.fetchData('sand_deliveries_v2', '*', fetchFilter);
        
        // Filtra por data se informado
        let filteredDeliveries = deliveries;
        if (startDate || endDate) {
            filteredDeliveries = deliveries.filter(d => {
                const deliveryDate = new Date(d.delivery_date);
                if (startDate && new Date(startDate) > deliveryDate) return false;
                if (endDate && new Date(endDate) < deliveryDate) return false;
                return true;
            });
        }
        
        if (filteredDeliveries.length === 0) {
            alert('❌ Nenhum lançamento encontrado com os filtros selecionados!');
            return;
        }
        
        // Calcula total
        const assoc = appState.sand_associations.find(a => a.id === associationId);
        let totalValue = 0;
        filteredDeliveries.forEach(d => {
            totalValue += parseFloat(d.volume_m3 || 0) * parseFloat(assoc.price_m3) * (d.trip_count || 1);
        });
        
        // Salva relatório
        const reportData = {
            association_id: associationId,
            report_type: invoiceStatus,
            start_date: startDate || null,
            end_date: endDate || null,
            total_value: totalValue,
            pdf_url: '', // Será gerado em seguida
            created_at: new Date().toISOString()
        };
        
        const savedReport = await apiClient.upsertItem('sand_reports', reportData);

        // Gera PDF imediatamente — reportData tem prioridade para garantir o status do combobox
        // (savedReport do DB pode ter report_type diferente se DB tiver ENUM antiga)
        const reportForPDF = Object.assign({}, savedReport || {}, reportData);
        reportForPDF.report_type = invoiceStatus; // garante o valor do combobox
        const pdf = await buildSandReportPDF(reportForPDF);
        const blobUrl = pdf.output('bloburl');
        window.open(blobUrl, '_blank');

        loadAndRenderSavedReports();
    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const loadAndRenderSavedReports = async () => {
    showSpinner();
    try {
        appState.sand_reports = await apiClient.fetchData('sand_reports', '*', null, 'created_at DESC');
        renderSavedReports();
    } catch (error) {
        console.error('❌ Erro ao carregar relatórios:', error);
    } finally {
        hideSpinner();
    }
};

const renderSavedReports = () => {
    const tbody = document.querySelector('#saved-sand-reports-table tbody');
    tbody.innerHTML = '';
    
    if (!appState.sand_reports || appState.sand_reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum relatório salvo</td></tr>';
        return;
    }
    
    appState.sand_reports.forEach(report => {
        // Verifica se é relatório em modo cliente (por empresa, sem associação específica)
        const isClientMode = report.client_mode == 1 || (!report.association_id && report.client_company_id);
        const assoc = isClientMode ? null : appState.sand_associations.find(a => a.id === report.association_id);
        if (!isClientMode && !assoc) return;

        let clientCompany, sandWork, descricao;
        if (isClientMode) {
            clientCompany = (appState.sand_client_companies || []).find(c => c.id == report.client_company_id);
            sandWork = null;
            descricao = `${clientCompany?.name || '?'} <span style="background:#2980b9;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;font-weight:bold;">POR EMPRESA</span>`;
        } else {
            clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
            sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
            descricao = `${clientCompany?.name || '?'} - ${sandWork?.name || '?'}`;
        }

        const createdDate = formatDateBR(report.created_at);
        const rt = report.report_type || 'TODOS';
        const statusLabel = rt === 'TODOS' ? 'Todas' : rt === 'NAO_EMITIDA' ? 'Não Emitidas' : 'Emitidas';
        
        let periodo = 'Todos';
        if (report.start_date && report.end_date) {
            periodo = `${formatDateBR(report.start_date)} - ${formatDateBR(report.end_date)}`;
        } else if (report.start_date) {
            periodo = `A partir de ${formatDateBR(report.start_date)}`;
        } else if (report.end_date) {
            periodo = `Até ${formatDateBR(report.end_date)}`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${createdDate}</td>
            <td>${descricao}</td>
            <td>${statusLabel}</td>
            <td>${periodo}</td>
            <td>${formatCurrency(report.total_value)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="window.editSandReport(${report.id})">EDITAR</button>
                <button class="btn btn-sm btn-primary" onclick="window.viewSandReport(${report.id})">VISUALIZAR</button>
                <button class="btn btn-sm btn-success" onclick="window.downloadSandReport(${report.id})">BAIXAR</button>
                <button class="btn btn-sm btn-info" onclick="window.whatsappSandReport(${report.id})">WHATSAPP</button>
                <button class="btn btn-sm btn-warning" onclick="window.emailSandReport(${report.id})">EMAIL</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandReport(${report.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ============================================================
// ABA 4: NOTAS EMITIDAS
// ============================================================

let editingEmissaoId = null;

const populateGeralYearSelect = () => {
    const sel = document.getElementById('geral-year');
    if (!sel) return;
    const years = new Set();
    (appState.sand_deliveries || []).forEach(d => { if (d.delivery_date) years.add(d.delivery_date.substring(0, 4)); });
    const curYear = new Date().getFullYear().toString();
    if (!years.has(curYear)) years.add(curYear);
    const sorted = [...years].sort((a, b) => b.localeCompare(a));
    sel.innerHTML = sorted.map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`).join('');
};

const populateGeralMonthSelect = () => {
    const sel = document.getElementById('geral-month');
    if (!sel) return;
    const months = new Set();
    (appState.sand_deliveries || []).forEach(d => { if (d.delivery_date) months.add(d.delivery_date.substring(0, 7)); });
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(curMonth)) months.add(curMonth);
    const sorted = [...months].sort((a, b) => b.localeCompare(a));
    const ptMonths = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    sel.innerHTML = sorted.map(m => {
        const [y, mo] = m.split('-');
        const label = `${ptMonths[parseInt(mo) - 1]}/${y.substring(2)}`;
        return `<option value="${m}" ${m === curMonth ? 'selected' : ''}>${label}</option>`;
    }).join('');
};

const generateGeneralReport = async () => {
    const tipoPeriodo  = document.getElementById('geral-periodo-tipo')?.value  || 'date_range';
    const statusFilter = document.getElementById('geral-invoice-status')?.value || 'TODOS';
    let startDate = null, endDate = null;

    if (tipoPeriodo === 'date_range') {
        startDate = document.getElementById('geral-start-date')?.value || null;
        endDate   = document.getElementById('geral-end-date')?.value   || null;
    } else if (tipoPeriodo === 'year') {
        const year = document.getElementById('geral-year')?.value;
        if (!year) { alert('Selecione o ano!'); return; }
        startDate = `${year}-01-01`;
        endDate   = `${year}-12-31`;
    } else if (tipoPeriodo === 'month') {
        const monthVal = document.getElementById('geral-month')?.value;
        if (!monthVal) { alert('Selecione o mês!'); return; }
        const [y, mo] = monthVal.split('-');
        const daysInMonth = new Date(parseInt(y), parseInt(mo), 0).getDate();
        startDate = `${y}-${mo}-01`;
        endDate   = `${y}-${mo}-${String(daysInMonth).padStart(2, '0')}`;
    }

    showSpinner();
    try {
        const allDeliveries = await apiClient.fetchData('sand_deliveries_v2', '*', null, 'delivery_date');
        const allEmissions  = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
        await buildGeneralReportPDF({ startDate, endDate, statusFilter, allDeliveries, allEmissions });
    } catch (err) {
        console.error('❌ Erro ao gerar relatório geral:', err);
        alert(`Erro: ${err.message}`);
    } finally {
        hideSpinner();
    }
};

const buildGeneralReportPDF = async ({ startDate, endDate, statusFilter, allDeliveries, allEmissions }) => {
    const { jsPDF } = window.jspdf;

    // Filtra pelo período
    let deliveries = allDeliveries || [];
    if (startDate || endDate) {
        deliveries = deliveries.filter(d => {
            if (startDate && d.delivery_date < startDate) return false;
            if (endDate   && d.delivery_date > endDate)   return false;
            return true;
        });
    }
    if (deliveries.length === 0) {
        alert('Nenhum lançamento encontrado para o período selecionado.');
        return;
    }

    // Agrupa por associação
    const assocEntries = new Map();
    deliveries.forEach(d => {
        if (!assocEntries.has(d.association_id))
            assocEntries.set(d.association_id, { deliveries: [], totalViagens: 0, totalVolume: 0, totalValue: 0, totalEmitido: 0, totalNaoEmitido: 0 });
        assocEntries.get(d.association_id).deliveries.push(d);
    });

    // Calcula totais por associação usando lógica de emissões
    for (const [assocId, entry] of assocEntries) {
        const assoc = appState.sand_associations.find(a => a.id == assocId);
        if (!assoc) continue;
        const priceM3 = parseFloat(assoc.price_m3);
        const assocEmissions = (allEmissions || []).filter(e => e.association_id == assocId);
        const emissionMap = new Map();
        let totalEmitidoDeclarado = 0, hasValueEmission = false;

        for (const em of assocEmissions) {
            if (em.emission_type === 'date_range') {
                entry.deliveries.forEach(d => {
                    if (em.start_date && d.delivery_date < em.start_date) return;
                    if (em.end_date   && d.delivery_date > em.end_date)   return;
                    const v = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + v);
                });
            } else if (em.emission_type === 'value') {
                hasValueEmission = true;
                const valuePaid = parseFloat(em.value_paid || 0);
                totalEmitidoDeclarado += valuePaid;
                const sorted = [...entry.deliveries].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
                let running = 0;
                for (const d of sorted) {
                    if (running >= valuePaid - 0.001) break;
                    const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    const canEmit = Math.min(fullVal, valuePaid - running);
                    emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + canEmit);
                    running += canEmit;
                }
            }
        }
        let sumViagens = 0, sumVolume = 0, sumTotal = 0, sumEmitido = 0;
        for (const d of entry.deliveries) {
            const val = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
            sumViagens += (d.trip_count || 1);
            sumVolume  += parseFloat(d.volume_m3 || 0);
            sumTotal   += val;
            sumEmitido += emissionMap.get(d.id) || 0;
        }
        if (hasValueEmission) sumEmitido = Math.min(totalEmitidoDeclarado, sumTotal);
        entry.totalViagens    = sumViagens;
        entry.totalVolume     = sumVolume;
        entry.totalValue      = sumTotal;
        entry.totalEmitido    = sumEmitido;
        entry.totalNaoEmitido = sumTotal - sumEmitido;
    }

    // Agrupa por empresa cliente
    const clientMap = new Map();
    for (const [assocId, entry] of assocEntries) {
        const assoc = appState.sand_associations.find(a => a.id == assocId);
        if (!assoc) continue;
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const clientId = assoc.client_company_id;
        if (!clientMap.has(clientId)) clientMap.set(clientId, { clientName: clientCompany?.name || '?', rows: [] });
        clientMap.get(clientId).rows.push({ obra: sandWork?.name || '?', ...entry });
    }

    // Colunas conforme filtro
    const showEmitido    = statusFilter === 'TODOS' || statusFilter === 'EMITIDA';
    const showNaoEmitido = statusFilter === 'TODOS' || statusFilter === 'NAO_EMITIDA';
    const head = ['Empresa / Obra', 'Qtd Viagens', 'Volume (m³)'];
    if (showEmitido)    head.push('Valor Emitido');
    if (showNaoEmitido) head.push('Valor Não Emitido');
    head.push('Valor Total');

    const body = [];
    let grandViagens = 0, grandVolume = 0, grandTotal = 0, grandEmitido = 0, grandNaoEmitido = 0;
    const sortedClients = [...clientMap.entries()].sort((a, b) => a[1].clientName.localeCompare(b[1].clientName, 'pt-BR'));

    for (const [, clientData] of sortedClients) {
        body.push([{ content: clientData.clientName, colSpan: head.length, styles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' } }]);
        let cVia = 0, cVol = 0, cTot = 0, cEm = 0, cNao = 0;
        clientData.rows.sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));
        for (const row of clientData.rows) {
            if (statusFilter === 'EMITIDA'     && row.totalEmitido    < 0.001) continue;
            if (statusFilter === 'NAO_EMITIDA' && row.totalNaoEmitido < 0.001) continue;
            const r = [`  ${row.obra}`, row.totalViagens, row.totalVolume.toFixed(2)];
            if (showEmitido)    r.push(formatCurrency(row.totalEmitido));
            if (showNaoEmitido) r.push(formatCurrency(row.totalNaoEmitido));
            r.push(formatCurrency(row.totalValue));
            body.push(r);
            cVia += row.totalViagens; cVol += row.totalVolume;
            cTot += row.totalValue;   cEm  += row.totalEmitido; cNao += row.totalNaoEmitido;
        }
        const sub = [{ content: `  Subtotal — ${clientData.clientName}`, styles: { fontStyle: 'bold', fillColor: [220, 235, 255] } }, cVia, cVol.toFixed(2)];
        if (showEmitido)    sub.push(formatCurrency(cEm));
        if (showNaoEmitido) sub.push(formatCurrency(cNao));
        sub.push(formatCurrency(cTot));
        body.push(sub);
        grandViagens += cVia; grandVolume += cVol; grandTotal += cTot; grandEmitido += cEm; grandNaoEmitido += cNao;
    }

    const footRow = ['TOTAL GERAL', grandViagens, grandVolume.toFixed(2)];
    if (showEmitido)    footRow.push(formatCurrency(grandEmitido));
    if (showNaoEmitido) footRow.push(formatCurrency(grandNaoEmitido));
    footRow.push(formatCurrency(grandTotal));

    let periodoText = 'Todos os períodos';
    if (startDate && endDate)  periodoText = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
    else if (startDate)        periodoText = `A partir de ${formatDateBR(startDate)}`;
    else if (endDate)          periodoText = `Até ${formatDateBR(endDate)}`;
    const statusLabel = statusFilter === 'TODOS' ? 'Todos (Emitidos + Não Emitidos)'
        : statusFilter === 'EMITIDA' ? 'Somente Emitidos' : 'Somente Não Emitidos';

    const renderPDF = (orientation) => {
        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = pdf.internal.pageSize.getWidth();

        const addHeader = () => {
            pdf.setFontSize(11); pdf.setFont(undefined, 'bold');
            pdf.text('PBA TRANSPORTES', pageW - margin, margin, { align: 'right' });
            pdf.setFontSize(13);
            pdf.text('Relatório Geral de Fornecimento de Areia', pageW / 2, margin, { align: 'center' });
            pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
            let y = margin + 6;
            pdf.text(`Período: ${periodoText}  |  Status: ${statusLabel}`, margin, y); y += 4.5;
            pdf.setFont(undefined, 'bold');
            pdf.text(`Total Geral: ${formatCurrency(grandTotal)}   |   Emitido: ${formatCurrency(grandEmitido)}   |   Não Emitido: ${formatCurrency(grandNaoEmitido)}`, margin, y);
            pdf.setFont(undefined, 'normal');
            pdf.setDrawColor(180); pdf.line(margin, y + 2, pageW - margin, y + 2);
        };

        addHeader();
        pdf.autoTable({
            startY: margin + 20,
            head: [head],
            body,
            foot: [footRow],
            margin: { left: margin, right: margin },
            headStyles:         { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            footStyles:         { fillColor: [44, 62, 80],   textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                const emIdx  = showEmitido ? 3 : -1;
                const naoIdx = showNaoEmitido ? (showEmitido ? 4 : 3) : -1;
                if (data.column.index === emIdx)  { data.cell.styles.textColor = [39, 174, 96];  data.cell.styles.fontStyle = 'bold'; }
                if (data.column.index === naoIdx) { data.cell.styles.textColor = [192, 57, 43];  data.cell.styles.fontStyle = 'bold'; }
            },
            didDrawPage: (data) => { if (data.pageNumber > 1) addHeader(); }
        });
        return pdf;
    };

    let pdf = renderPDF('landscape');
    if (pdf.internal.getNumberOfPages() > 1) pdf = renderPDF('portrait');
    pdf.save('relatorio-geral-areia.pdf');
};

const initEmissoes = async () => {
    // Recarrega dados frescos
    showSpinner();
    try {
        appState.sand_invoice_emissions = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
    } finally {
        hideSpinner();
    }

    // Preenche o select de associações
    const sel = document.getElementById('emissao-association-select');
    if (sel) {
        sel.innerHTML = '<option value="">Selecione...</option>';
        appState.sand_associations.forEach(a => {
            const client = (appState.sand_client_companies || []).find(c => c.id === a.client_company_id);
            const work   = appState.sand_works.find(w => w.id === a.sand_work_id);
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${client?.name || '?'} – ${work?.name || '?'} (R$ ${parseFloat(a.price_m3).toFixed(2)}/m³)`;
            sel.appendChild(opt);
        });
    }

    // Controle de visibilidade dos campos por tipo
    const tipoSel = document.getElementById('emissao-tipo');
    const toggleTipoFields = () => {
        const tipo = tipoSel?.value || 'date_range';
        const isDates = tipo === 'date_range';
        document.getElementById('emissao-start-group').style.display = isDates ? '' : 'none';
        document.getElementById('emissao-end-group').style.display   = isDates ? '' : 'none';
        document.getElementById('emissao-value-group').style.display  = isDates ? 'none' : '';
    };
    tipoSel?.removeEventListener('change', toggleTipoFields);
    tipoSel?.addEventListener('change', toggleTipoFields);
    toggleTipoFields();

    // Salvar/cancelar emissão — clonar botões para evitar listeners duplicados
    const saveBtn   = document.getElementById('save-emissao-btn');
    const cancelBtn = document.getElementById('cancel-emissao-btn');
    const newSaveBtn   = saveBtn?.cloneNode(true);
    const newCancelBtn = cancelBtn?.cloneNode(true);
    saveBtn?.parentNode?.replaceChild(newSaveBtn, saveBtn);
    cancelBtn?.parentNode?.replaceChild(newCancelBtn, cancelBtn);

    const resetEmissaoForm = () => {
        editingEmissaoId = null;
        document.getElementById('emissao-association-select').value = '';
        document.getElementById('emissao-tipo').value = 'date_range';
        document.getElementById('emissao-start-date').value = '';
        document.getElementById('emissao-end-date').value = '';
        document.getElementById('emissao-value-paid').value = '';
        document.getElementById('emissao-notes').value = '';
        if (newCancelBtn) newCancelBtn.style.display = 'none';
        if (newSaveBtn) newSaveBtn.textContent = 'SALVAR EMISSÃO';
        toggleTipoFields();
    };

    newSaveBtn?.addEventListener('click', async () => {
        const assocId   = parseInt(document.getElementById('emissao-association-select')?.value);
        const tipo      = document.getElementById('emissao-tipo')?.value || 'date_range';
        const startDate = document.getElementById('emissao-start-date')?.value || null;
        const endDate   = document.getElementById('emissao-end-date')?.value || null;
        const valuePaid = parseFloat(document.getElementById('emissao-value-paid')?.value) || null;
        const notes     = document.getElementById('emissao-notes')?.value?.trim() || null;

        if (!assocId) { alert('Selecione uma associação.'); return; }
        if (tipo === 'date_range' && !startDate && !endDate) { alert('Informe ao menos uma data.'); return; }
        if (tipo === 'value'      && (!valuePaid || valuePaid <= 0)) { alert('Informe o valor pago.'); return; }

        showSpinner();
        try {
            const payload = {
                association_id: assocId,
                emission_type:  tipo,
                start_date:     tipo === 'date_range' ? startDate : null,
                end_date:       tipo === 'date_range' ? endDate   : null,
                value_paid:     tipo === 'value'      ? valuePaid : null,
                notes
            };
            if (editingEmissaoId) payload.id = editingEmissaoId;

            const result = await apiClient.upsertItem('sand_invoice_emissions', payload);

            if (editingEmissaoId) {
                const idx = appState.sand_invoice_emissions.findIndex(e => e.id === editingEmissaoId);
                if (idx !== -1) appState.sand_invoice_emissions[idx] = result;
            } else {
                appState.sand_invoice_emissions = appState.sand_invoice_emissions || [];
                appState.sand_invoice_emissions.push(result);
            }

            resetEmissaoForm();
            renderEmissoesTable();
        } catch (err) {
            alert(`Erro ao salvar: ${err.message}`);
        } finally {
            hideSpinner();
        }
    });

    newCancelBtn?.addEventListener('click', resetEmissaoForm);

    renderEmissoesTable();
};

const renderEmissoesTable = () => {
    const tbody = document.querySelector('#sand-emissoes-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const emissions = appState.sand_invoice_emissions || [];
    if (emissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;">Nenhuma emissão registrada.</td></tr>';
        return;
    }

    [...emissions].reverse().forEach(em => {
        const assoc  = appState.sand_associations.find(a => a.id === em.association_id);
        const client = (appState.sand_client_companies || []).find(c => c.id === assoc?.client_company_id);
        const work   = appState.sand_works.find(w => w.id === assoc?.sand_work_id);
        const tipoLabel = em.emission_type === 'date_range' ? 'Intervalo de Datas' : 'Valor Pago';
        let periodoValor = '';
        if (em.emission_type === 'date_range') {
            if (em.start_date && em.end_date) periodoValor = `${formatDateBR(em.start_date)} a ${formatDateBR(em.end_date)}`;
            else if (em.start_date) periodoValor = `A partir de ${formatDateBR(em.start_date)}`;
            else if (em.end_date)   periodoValor = `Até ${formatDateBR(em.end_date)}`;
        } else {
            periodoValor = formatCurrency(em.value_paid || 0);
        }
        const createdAt = em.created_at ? formatDateBR(em.created_at.substring(0,10)) : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${createdAt}</td>
            <td>${client?.name || '?'} – ${work?.name || '?'}</td>
            <td>${tipoLabel}</td>
            <td>${periodoValor}</td>
            <td>${em.notes || ''}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandEmission(${em.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteSandEmission = async (id) => {
    if (!confirm('Excluir este registro de emissão?')) return;
    showSpinner();
    try {
        await apiClient.deleteItem('sand_invoice_emissions', id);
        appState.sand_invoice_emissions = (appState.sand_invoice_emissions || []).filter(e => e.id !== id);
        renderEmissoesTable();
    } catch (err) {
        alert(`Erro ao excluir: ${err.message}`);
    } finally {
        hideSpinner();
    }
};

// ============================================================
// GERAÇÃO DE PDF PARA RELATÓRIOS SALVOS DE AREIA
// ============================================================

const buildSandReportPDF = async (report) => {
    const { jsPDF } = window.jspdf;

    // ══════════════════════════════════════════════════════════════
    // MODO CLIENTE: agrupa todas as obras do cliente selecionado
    // ══════════════════════════════════════════════════════════════
    if (report.client_mode == 1 || report.client_mode === true) {
        return buildClientSandReportPDF(report);
    }

    const assoc = appState.sand_associations.find(a => a.id === report.association_id);
    if (!assoc) throw new Error('Associação não encontrada');
    const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc.client_company_id);
    const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
    const myCompany = appState.my_companies.find(m => m.id === assoc.my_company_id);

    // Busca TODOS os lançamentos da associação (filtro de data aplicado em JS)
    const allDeliveries = await apiClient.fetchData('sand_deliveries_v2', '*', {
        association_id: report.association_id
    });
    let deliveries = allDeliveries;
    if (report.start_date || report.end_date) {
        deliveries = allDeliveries.filter(d => {
            if (report.start_date && d.delivery_date < report.start_date) return false;
            if (report.end_date   && d.delivery_date > report.end_date)   return false;
            return true;
        });
    }

    // Busca emissões frescas
    const allEmissions = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
    appState.sand_invoice_emissions = allEmissions;
    const emissions = allEmissions.filter(e => e.association_id == assoc.id);

    // ─── emissionMap: id → valor emitido (pode ser proporcional) ──────────
    const emissionMap = new Map(); // deliveryId → emittedAmount
    const priceM3 = parseFloat(assoc.price_m3);
    let totalEmitidoDeclarado = 0;
    let hasValueEmission = false;

    for (const em of emissions) {
        if (em.emission_type === 'date_range') {
            deliveries.forEach(d => {
                if (em.start_date && d.delivery_date < em.start_date) return;
                if (em.end_date   && d.delivery_date > em.end_date)   return;
                const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + fullVal);
            });
        } else if (em.emission_type === 'value') {
            hasValueEmission = true;
            const valuePaid = parseFloat(em.value_paid || 0);
            totalEmitidoDeclarado += valuePaid;
            const sorted = [...deliveries].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
            let running = 0;
            for (const d of sorted) {
                if (running >= valuePaid - 0.001) break;
                const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                const canEmit = Math.min(fullVal, valuePaid - running);
                emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + canEmit);
                running += canEmit;
            }
        }
    }

    // ─── Totais globais ───────────────────────────────────────────────────
    const allTotal = deliveries.reduce((sum, d) =>
        sum + parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1), 0);

    let totalEmitido;
    if (hasValueEmission) {
        totalEmitido = Math.min(totalEmitidoDeclarado, allTotal);
    } else {
        totalEmitido = [...emissionMap.values()].reduce((s, v) => s + v, 0);
    }
    const totalAEmitir = allTotal - totalEmitido;

    // ─── Linhas de exibição com valores proporcionais ─────────────────────
    const reportType = report.report_type || 'TODOS';

    // Ordena por data crescente
    deliveries.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));

    const displayRows = [];

    for (const d of deliveries) {
        const fullVal  = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
        const emittedAmt   = emissionMap.get(d.id) || 0;
        const remainingAmt = fullVal - emittedAmt;
        const isFullEmitted = emittedAmt >= fullVal - 0.001;
        const isPartial     = emittedAmt > 0.001 && !isFullEmitted;
        const isNotEmitted  = emittedAmt < 0.001;

        if (reportType === 'TODOS') {
            const status = isFullEmitted ? 'EMITIDO' : isPartial ? 'PARCIAL' : '';
            displayRows.push({ d, displayValue: fullVal, emittedAmt, status });
        } else if (reportType === 'EMITIDA') {
            if (isFullEmitted) displayRows.push({ d, displayValue: fullVal,    emittedAmt: fullVal,    status: 'EMITIDO' });
            if (isPartial)     displayRows.push({ d, displayValue: emittedAmt, emittedAmt,             status: 'PARCIAL' });
            // não emitido: não aparece
        } else { // NAO_EMITIDA
            if (isNotEmitted)  displayRows.push({ d, displayValue: fullVal,       emittedAmt: 0,      status: '' });
            if (isPartial)     displayRows.push({ d, displayValue: remainingAmt,  emittedAmt,         status: 'PARCIAL' });
            // totalmente emitido: não aparece
        }
    }

    const displayedTotal = displayRows.reduce((s, r) => s + r.displayValue, 0);

    // ─── Estrutura de colunas ─────────────────────────────────────────────
    // Sem nada emitido → 5 colunas (sem Status nem Valor Emitido)
    // NAO_EMITIDA      → 6 colunas (A Emitir, Status) — sem Valor Emitido
    // TODOS e EMITIDA  → 7 colunas (Valor Total, Status, Valor Emitido)
    const isNaoEmitida  = reportType === 'NAO_EMITIDA';
    const nadaEmitido   = totalEmitido < 0.001;
    const valorTotalLabel = isNaoEmitida ? 'A Emitir' : 'Valor Total';

    const tableHead = nadaEmitido
        ? [['Nº Romaneio', 'Data', 'Qtd Viagens', 'Volume (m³)', 'Preço/m³', valorTotalLabel]]
        : isNaoEmitida
            ? [['Nº Romaneio', 'Data', 'Qtd Viagens', 'Volume (m³)', 'Preço/m³', valorTotalLabel, 'Status']]
            : [['Nº Romaneio', 'Data', 'Qtd Viagens', 'Volume (m³)', 'Preço/m³', valorTotalLabel, 'Status', 'Valor Emitido']];

    const tableBody = displayRows.map(r => {
        const vol = parseFloat(r.d.volume_m3 || 0);
        const qty = r.d.trip_count || 1;
        const row = [
            r.d.romaneio || '-',
            formatDateBR(r.d.delivery_date),
            qty,
            vol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
            formatCurrency(priceM3),
            formatCurrency(r.displayValue)
        ];
        if (!nadaEmitido) row.push(r.status || '');
        if (!nadaEmitido && !isNaoEmitida) row.push(r.emittedAmt > 0.001 ? formatCurrency(r.emittedAmt) : '');
        return row;
    });

    // ─── Rodapé ───────────────────────────────────────────────────────────
    const tableFoot = nadaEmitido
        ? [['', '', '', '', 'TOTAL', formatCurrency(displayedTotal)]]
        : isNaoEmitida
            ? [['', '', '', '', 'TOTAL', formatCurrency(displayedTotal), '']]
            : [['', '', '', '', 'TOTAL', formatCurrency(displayedTotal), '', formatCurrency(totalEmitido)]];

    // ─── Labels do cabeçalho ─────────────────────────────────────────────
    const statusLabel = reportType === 'TODOS' ? 'Todas'
        : reportType === 'NAO_EMITIDA' ? 'Notas Não Emitidas' : 'Notas Emitidas';
    let periodoText = 'Todos os períodos';
    if (report.start_date && report.end_date) periodoText = `${formatDateBR(report.start_date)} a ${formatDateBR(report.end_date)}`;
    else if (report.start_date) periodoText = `A partir de ${formatDateBR(report.start_date)}`;
    else if (report.end_date)   periodoText = `Até ${formatDateBR(report.end_date)}`;

    // ─── Função interna de renderização (suporta orientação dinâmica) ─────
    const renderPDF = (orientation) => {
        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = pdf.internal.pageSize.getWidth();

        const addHeader = () => {
            pdf.setFontSize(11); pdf.setFont(undefined, 'bold');
            pdf.text('PBA TRANSPORTES', pageW - margin, margin, { align: 'right' });
            pdf.setFontSize(12);
            pdf.text('Relatório de Fornecimento de Areia', pageW / 2, margin, { align: 'center' });
            pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
            let y = margin + 6;
            pdf.text(`Cliente: ${clientCompany?.name || '?'}  |  Obra: ${sandWork?.name || '?'}`, margin, y); y += 4.5;
            pdf.text(`Fornecedor: ${myCompany?.name || '?'}  |  Preço/m³: ${formatCurrency(assoc.price_m3)}`, margin, y); y += 4.5;
            pdf.text(`Período: ${periodoText}  |  Status: ${statusLabel}`, margin, y); y += 4.5;
            pdf.setFont(undefined, 'bold');
            // Todos os relatórios sempre exibem a linha completa de totais
            const saldoAdiantado = hasValueEmission ? Math.max(0, totalEmitidoDeclarado - allTotal) : 0;
            const totalsText = saldoAdiantado > 0.001
                ? `Total: ${formatCurrency(allTotal)}   |   Total Emitido: ${formatCurrency(totalEmitido)}   |   Saldo Adiantado: ${formatCurrency(saldoAdiantado)}`
                : `Total: ${formatCurrency(allTotal)}   |   Total Emitido: ${formatCurrency(totalEmitido)}   |   Total a Emitir: ${formatCurrency(totalAEmitir)}`;
            if (saldoAdiantado > 0.001) pdf.setTextColor(26, 122, 46);
            pdf.text(totalsText, margin, y);
            pdf.setTextColor(0);
            pdf.setDrawColor(180); pdf.line(margin, y + 2, pageW - margin, y + 2);
        };

        addHeader();

        pdf.autoTable({
            startY: margin + 32,
            head: tableHead,
            body: tableBody,
            foot: tableFoot,
            margin: { left: margin, right: margin },
            headStyles:          { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            footStyles:          { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold' },
            alternateRowStyles:  { fillColor: [245, 245, 245] },
            didParseCell: (data) => {
                // Colore coluna Status (índice 6)
                if (data.section === 'body' && data.column.index === 6) {
                    const val = data.cell.raw;
                    if (val === 'EMITIDO')      data.cell.styles.textColor = [39, 174, 96];
                    else if (val === 'PARCIAL') data.cell.styles.textColor = [230, 126, 34];
                    data.cell.styles.fontStyle = 'bold';
                }
                // Colore coluna Valor Emitido (índice 7) em azul — só existe se não for NAO_EMITIDA
                if (!isNaoEmitida && data.section === 'body' && data.column.index === 7 && data.cell.raw) {
                    data.cell.styles.textColor = [41, 128, 185];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawPage: (data) => { if (data.pageNumber > 1) addHeader(); }
        });

        return pdf;
    };

    // ─── Tenta paisagem; se ultrapassar 1 página usa retrato ─────────────
    let pdf = renderPDF('landscape');
    if (pdf.internal.getNumberOfPages() > 1) {
        pdf = renderPDF('portrait');
    }

    return pdf;
};

// ──────────────────────────────────────────────────────────────────────────────
// PDF no modo cliente: todas as obras do cliente em uma única tabela
// ──────────────────────────────────────────────────────────────────────────────
const buildClientSandReportPDF = async (report) => {
    const { jsPDF } = window.jspdf;
    const reportType = report.report_type || 'TODOS';

    const clientCompany = (appState.sand_client_companies || []).find(c => c.id == report.client_company_id);
    if (!clientCompany) throw new Error('Empresa cliente não encontrada');

    const clientAssocs = appState.sand_associations.filter(a => a.client_company_id == report.client_company_id);
    if (!clientAssocs.length) throw new Error('Nenhuma obra encontrada para este cliente');

    // Busca emissões frescas uma única vez
    const allEmissions = await apiClient.fetchData('sand_invoice_emissions', '*').catch(() => []);
    appState.sand_invoice_emissions = allEmissions;

    let grandAllTotal = 0, grandEmitido = 0;
    const allDisplayRows = [];

    for (const assoc of clientAssocs) {
        const sandWork   = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const myCompany  = appState.my_companies.find(m => m.id === assoc.my_company_id);
        const priceM3    = parseFloat(assoc.price_m3);
        const emissions  = allEmissions.filter(e => e.association_id == assoc.id);

        // Busca entregas desta associação
        let deliveries = await apiClient.fetchData('sand_deliveries_v2', '*', { association_id: assoc.id });
        if (report.start_date || report.end_date) {
            deliveries = deliveries.filter(d => {
                if (report.start_date && d.delivery_date < report.start_date) return false;
                if (report.end_date   && d.delivery_date > report.end_date)   return false;
                return true;
            });
        }
        deliveries.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));

        // emissionMap para esta associação
        const emissionMap = new Map();
        let totalEmitidoDeclarado = 0;
        for (const em of emissions) {
            if (em.emission_type === 'date_range') {
                deliveries.forEach(d => {
                    if (em.start_date && d.delivery_date < em.start_date) return;
                    if (em.end_date   && d.delivery_date > em.end_date)   return;
                    const v = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + v);
                });
            } else if (em.emission_type === 'value') {
                const valuePaid = parseFloat(em.value_paid || 0);
                totalEmitidoDeclarado += valuePaid;
                const sorted = [...deliveries].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
                let running = 0;
                for (const d of sorted) {
                    if (running >= valuePaid - 0.001) break;
                    const fullVal = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
                    const canEmit = Math.min(fullVal, valuePaid - running);
                    emissionMap.set(d.id, (emissionMap.get(d.id) || 0) + canEmit);
                    running += canEmit;
                }
            }
        }

        const assocTotal = deliveries.reduce((s, d) =>
            s + parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1), 0);
        const hasValueEmission = emissions.some(e => e.emission_type === 'value');
        const assocEmitido = hasValueEmission
            ? Math.min(totalEmitidoDeclarado, assocTotal)
            : [...emissionMap.values()].reduce((s, v) => s + v, 0);

        grandAllTotal += assocTotal;
        grandEmitido  += assocEmitido;

        for (const d of deliveries) {
            const fullVal      = parseFloat(d.volume_m3 || 0) * priceM3 * (d.trip_count || 1);
            const emittedAmt   = emissionMap.get(d.id) || 0;
            const remainingAmt = fullVal - emittedAmt;
            const isFullEmitted = emittedAmt >= fullVal - 0.001;
            const isPartial     = emittedAmt > 0.001 && !isFullEmitted;
            const isNotEmitted  = emittedAmt < 0.001;

            const meta = { d, assoc, sandWork, myCompany, priceM3 };

            if (reportType === 'TODOS') {
                allDisplayRows.push({ ...meta, displayValue: fullVal, emittedAmt,
                    status: isFullEmitted ? 'EMITIDO' : isPartial ? 'PARCIAL' : '' });
            } else if (reportType === 'EMITIDA') {
                if (isFullEmitted) allDisplayRows.push({ ...meta, displayValue: fullVal,    emittedAmt: fullVal, status: 'EMITIDO' });
                if (isPartial)     allDisplayRows.push({ ...meta, displayValue: emittedAmt, emittedAmt,          status: 'PARCIAL' });
            } else { // NAO_EMITIDA
                if (isNotEmitted)  allDisplayRows.push({ ...meta, displayValue: fullVal,       emittedAmt: 0,    status: '' });
                if (isPartial)     allDisplayRows.push({ ...meta, displayValue: remainingAmt,  emittedAmt,       status: 'PARCIAL' });
            }
        }
    }

    const grandAEmitir    = grandAllTotal - grandEmitido;
    const displayedTotal  = allDisplayRows.reduce((s, r) => s + r.displayValue, 0);
    const valorColLabel   = reportType === 'NAO_EMITIDA' ? 'A Emitir' : 'Valor Total';
    const statusLabel     = reportType === 'TODOS' ? 'Todas' : reportType === 'NAO_EMITIDA' ? 'Notas Não Emitidas' : 'Notas Emitidas';
    const isNaoEmitida    = reportType === 'NAO_EMITIDA';
    const nadaEmitido     = grandEmitido < 0.001;

    let periodoText = 'Todos os períodos';
    if (report.start_date && report.end_date) periodoText = `${formatDateBR(report.start_date)} a ${formatDateBR(report.end_date)}`;
    else if (report.start_date) periodoText = `A partir de ${formatDateBR(report.start_date)}`;
    else if (report.end_date)   periodoText = `Até ${formatDateBR(report.end_date)}`;

    const baseHead = ['Nº Romaneio', 'Data', 'Cliente', 'Obra', 'Fornecedor', 'Qtd Viagens', 'Volume (m³)', 'Preço/m³', valorColLabel];
    const tableHead = nadaEmitido
        ? [baseHead]
        : isNaoEmitida
            ? [[...baseHead, 'Status']]
            : [[...baseHead, 'Status', 'Valor Emitido']];

    const tableBody = allDisplayRows.map(r => {
        const vol = parseFloat(r.d.volume_m3 || 0);
        const qty = r.d.trip_count || 1;
        const row = [
            r.d.romaneio || '-',
            formatDateBR(r.d.delivery_date),
            clientCompany.name,
            r.sandWork?.name || '?',
            r.myCompany?.name || '?',
            qty,
            vol.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
            formatCurrency(r.priceM3),
            formatCurrency(r.displayValue)
        ];
        if (!nadaEmitido) row.push(r.status || '');
        if (!nadaEmitido && !isNaoEmitida) row.push(r.emittedAmt > 0.001 ? formatCurrency(r.emittedAmt) : '');
        return row;
    });

    const footBase = ['', '', '', '', '', '', '', 'TOTAL', formatCurrency(displayedTotal)];
    const tableFoot = nadaEmitido
        ? [footBase]
        : isNaoEmitida
            ? [[...footBase, '']]
            : [[...footBase, '', formatCurrency(grandEmitido)]];

    const renderPDF = (orientation) => {
        const pdf    = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
        const margin = 14;
        const pageW  = pdf.internal.pageSize.getWidth();

        const addHeader = () => {
            pdf.setFontSize(11); pdf.setFont(undefined, 'bold');
            pdf.text('PBA TRANSPORTES', pageW - margin, margin, { align: 'right' });
            pdf.setFontSize(12);
            pdf.text('Relatório de Fornecimento de Areia', pageW / 2, margin, { align: 'center' });
            pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
            let y = margin + 6;
            pdf.text(`Cliente: ${clientCompany.name}`, margin, y); y += 4.5;
            pdf.text(`Período: ${periodoText}  |  Status: ${statusLabel}`, margin, y); y += 4.5;
            pdf.setFont(undefined, 'bold');
            pdf.text(
                `Total: ${formatCurrency(grandAllTotal)}   |   Total Emitido: ${formatCurrency(grandEmitido)}   |   Total a Emitir: ${formatCurrency(grandAEmitir)}`,
                margin, y
            );
            pdf.setDrawColor(180); pdf.line(margin, y + 2, pageW - margin, y + 2);
        };

        addHeader();

        pdf.autoTable({
            startY: margin + 24,
            head: tableHead,
            body: tableBody,
            foot: tableFoot,
            margin: { left: margin, right: margin },
            headStyles:         { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            bodyStyles:         { fontSize: 7 },
            footStyles:         { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            didParseCell: (data) => {
                if (!nadaEmitido && data.section === 'body' && data.column.index === 9) {
                    const val = data.cell.raw;
                    if (val === 'EMITIDO')      data.cell.styles.textColor = [39, 174, 96];
                    else if (val === 'PARCIAL') data.cell.styles.textColor = [230, 126, 34];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (!nadaEmitido && !isNaoEmitida && data.section === 'body' && data.column.index === 10 && data.cell.raw) {
                    data.cell.styles.textColor = [41, 128, 185];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawPage: (data) => { if (data.pageNumber > 1) addHeader(); }
        });

        return pdf;
    };

    let pdf = renderPDF('landscape');
    if (pdf.internal.getNumberOfPages() > 1) pdf = renderPDF('portrait');
    return pdf;
};

const editSandReport = async (id) => {
    const report = appState.sand_reports?.find(r => r.id === id);
    if (!report) return;

    // Relatórios por empresa não suportam edição de período por associação
    if (report.client_mode == 1 || (!report.association_id && report.client_company_id)) {
        alert('ℹ️ Relatórios por Empresa Cliente não suportam edição de período. Gere um novo relatório com as datas desejadas.');
        return;
    }

    const assoc = appState.sand_associations.find(a => a.id === report.association_id);
    const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc?.client_company_id);
    const sandWork = appState.sand_works.find(w => w.id === assoc?.sand_work_id);

    const newStart = prompt(`Editar data início (YYYY-MM-DD)\nAtual: ${report.start_date || 'sem filtro'}`, report.start_date || '');
    if (newStart === null) return;
    const newEnd = prompt(`Editar data fim (YYYY-MM-DD)\nAtual: ${report.end_date || 'sem filtro'}`, report.end_date || '');
    if (newEnd === null) return;

    showSpinner();
    try {
        // Recalcula total com novos filtros (sem filtro de status quando TODOS)
        const editFilter = { association_id: report.association_id };
        if (report.report_type && report.report_type !== 'TODOS') editFilter.invoice_status = report.report_type;
        const allDeliveries = await apiClient.fetchData('sand_deliveries_v2', '*', editFilter);
        let filtered = allDeliveries;
        if (newStart || newEnd) {
            filtered = allDeliveries.filter(d => {
                if (newStart && d.delivery_date < newStart) return false;
                if (newEnd && d.delivery_date > newEnd) return false;
                return true;
            });
        }
        const newTotal = filtered.reduce((sum, d) => {
            return sum + parseFloat(d.volume_m3 || 0) * parseFloat(assoc.price_m3) * (d.trip_count || 1);
        }, 0);

        await apiClient.upsertItem('sand_reports', {
            id: report.id,
            start_date: newStart || null,
            end_date: newEnd || null,
            total_value: newTotal
        });
        alert(`✅ Relatório atualizado!\nTotal: ${formatCurrency(newTotal)}\nViagens: ${filtered.length}`);
        loadAndRenderSavedReports();
    } catch (error) {
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const viewSandReport = async (id) => {
    showSpinner();
    try {
        // Sempre recarrega lista fresh do servidor antes de gerar PDF
        appState.sand_reports = await apiClient.fetchData('sand_reports', '*', null, 'created_at DESC');
        const report = appState.sand_reports?.find(r => r.id === id);
        if (!report) { alert('Relatório não encontrado.'); return; }
        const pdf = await buildSandReportPDF(report);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        alert(`Erro ao visualizar: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const downloadSandReport = async (id) => {
    showSpinner();
    try {
        appState.sand_reports = await apiClient.fetchData('sand_reports', '*', null, 'created_at DESC');
        const report = appState.sand_reports?.find(r => r.id === id);
        if (!report) { alert('Relatório não encontrado.'); return; }
        const isClientMode = report.client_mode == 1 || (!report.association_id && report.client_company_id);
        let fileName;
        if (isClientMode) {
            const clientCompany = (appState.sand_client_companies || []).find(c => c.id == report.client_company_id);
            fileName = `relatorio_areia_${clientCompany?.name || 'cliente'}_${report.created_at?.substring(0,10) || 'data'}.pdf`.replace(/\s/g, '_');
        } else {
            const assoc = appState.sand_associations.find(a => a.id === report.association_id);
            const sandWork = appState.sand_works.find(w => w.id === assoc?.sand_work_id);
            fileName = `relatorio_areia_${sandWork?.name || 'obra'}_${report.created_at?.substring(0,10) || 'data'}.pdf`.replace(/\s/g, '_');
        }
        const pdf = await buildSandReportPDF(report);
        pdf.save(fileName);
    } catch (error) {
        alert(`Erro ao baixar: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const whatsappSandReport = async (id) => {
    const newTab = window.open('about:blank', '_blank');
    showSpinner();
    try {
        appState.sand_reports = await apiClient.fetchData('sand_reports', '*', null, 'created_at DESC');
        const report = appState.sand_reports?.find(r => r.id === id);
        if (!report) { newTab?.close(); hideSpinner(); return; }

        const isClientModeWA = report.client_mode == 1 || (!report.association_id && report.client_company_id);
        const assoc = isClientModeWA ? null : appState.sand_associations.find(a => a.id === report.association_id);
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id == (isClientModeWA ? report.client_company_id : assoc?.client_company_id));
        const sandWork = isClientModeWA ? null : appState.sand_works.find(w => w.id === assoc?.sand_work_id);
        const pdf = await buildSandReportPDF(report);
        const blob = pdf.output('blob');

        // Upload para Google Drive
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            try {
                const fileName = isClientModeWA
                    ? `relatorio_areia_${clientCompany?.name || 'cliente'}_${report.created_at?.substring(0,10) || 'data'}.pdf`.replace(/\s/g, '_')
                    : `relatorio_areia_${sandWork?.name || 'obra'}_${report.created_at?.substring(0,10) || 'data'}.pdf`.replace(/\s/g, '_');
                const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pdfData: reader.result,
                        fileName: fileName,
                        workName: sandWork?.name || clientCompany?.name || 'Obra',
                        companyName: clientCompany?.name || 'Cliente',
                        bmLabel: 'Areia',
                        dateRange: report.start_date ? `${report.start_date}_${report.end_date}` : 'todos'
                    })
                });
                const result = await response.json();
                const link = result.webViewLink || result.url || (result.fileId ? `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing` : '');
                if (!link) throw new Error('Link não retornado pelo servidor');
                const msg = encodeURIComponent(`Relatório de Areia - ${clientCompany?.name || ''} - ${sandWork?.name || ''}\n\nTotal: ${formatCurrency(report.total_value)}\n\n${link}`);
                newTab.location.href = `https://wa.me/5587991034022?text=${msg}`;
            } catch (err) {
                newTab?.close();
                alert(`Erro ao enviar WhatsApp: ${err.message}`);
            } finally {
                hideSpinner();
            }
        };
    } catch (error) {
        newTab?.close();
        alert(`Erro: ${error.message}`);
        hideSpinner();
    }
};

const emailSandReport = async (id) => {
    showSpinner();
    try {
        appState.sand_reports = await apiClient.fetchData('sand_reports', '*', null, 'created_at DESC');
        const report = appState.sand_reports?.find(r => r.id === id);
        if (!report) return;
        const assoc = appState.sand_associations.find(a => a.id === report.association_id);
        const clientCompany = (appState.sand_client_companies || []).find(c => c.id === assoc?.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc?.sand_work_id);

        // Baixa o PDF e abre cliente de email
        const pdf = await buildSandReportPDF(report);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);

        // Abre o PDF para o usuário salvar e depois anexar
        window.open(url, '_blank');

        const subject = encodeURIComponent(`Relatório de Areia - ${clientCompany?.name || ''} - ${sandWork?.name || ''}`);
        const periodoText = report.start_date && report.end_date
            ? `${formatDateBR(report.start_date)} a ${formatDateBR(report.end_date)}`
            : 'todos os períodos';
        const body = encodeURIComponent(
            `Prezado(a),\n\nSegue relatório de fornecimento de areia.\n\nObra: ${sandWork?.name || ''}\nCliente: ${clientCompany?.name || ''}\nPeríodo: ${periodoText}\nValor Total: ${formatCurrency(report.total_value)}\n\nO PDF foi aberto em outra aba para você salvar e anexar.\n\nAtenciosamente,\nPBA Transportes`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const deleteSandReport = async (id) => {
    if (!confirm('Deseja realmente excluir este relatório salvo?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('sand_reports', id);
        loadAndRenderSavedReports();
        alert('✅ Relatório excluído com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao excluir relatório:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

// ====================================================================
// EXPOR FUNÇÕES NO WINDOW PARA ONCLICK
// ====================================================================

window.editSandWork = editSandWork;
window.deleteSandWork = deleteSandWork;
window.editAssociation = editAssociation;
window.deleteAssociation = deleteAssociation;
window.removeTripRow = removeTripRow;
window.deleteSandDelivery = deleteSandDelivery;
window.editSandDelivery = editSandDelivery;
window.editSandReport = editSandReport;
window.viewSandReport = viewSandReport;
window.downloadSandReport = downloadSandReport;
window.whatsappSandReport = whatsappSandReport;
window.emailSandReport = emailSandReport;
window.deleteSandReport = deleteSandReport;
