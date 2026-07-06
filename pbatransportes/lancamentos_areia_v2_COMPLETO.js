// lancamentos_areia_v2.js - Módulo REFATORADO COMPLETO para Fornecimento de Areia
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatInputDate, formatDateBR } from './utils.js';
import { apiClient } from './api.js';

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
        
        // Configura navegação entre abas principais
        document.querySelectorAll('[data-sand-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.sandTab;
                document.querySelectorAll('[data-sand-tab]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('#sand-cadastros-tab, #sand-lancamentos-tab, #sand-relatorios-tab').forEach(t => t.style.display = 'none');
                document.getElementById(tabId).style.display = 'block';
                
                // Inicializa aba específica
                if (tabId === 'sand-cadastros-tab') {
                    initCadastros();
                } else if (tabId === 'sand-lancamentos-tab') {
                    initLancamentos();
                } else if (tabId === 'sand-relatorios-tab') {
                    initRelatorios();
                }
            });
        });
        
        // Inicia na aba de cadastros
        initCadastros();
        
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
            document.querySelectorAll('#obras-areia-sub, #associacoes-sub').forEach(t => t.style.display = 'none');
            document.getElementById(tabId).style.display = 'block';
        });
    });
    
    // Botões de Obras de Areia
    document.getElementById('save-sand-work-btn').onclick = saveSandWork;
    document.getElementById('cancel-sand-work-btn').onclick = cancelEditSandWork;
    
    // Botões de Associações
    document.getElementById('save-association-btn').onclick = saveAssociation;
    document.getElementById('cancel-association-btn').onclick = cancelEditAssociation;
    
    // Popula combos de associações
    populateAssociationCombos();
    
    // Renderiza tabelas
    renderSandWorks();
    renderAssociations();
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
    
    clientSelect.innerHTML = '<option value="">Selecione...</option>';
    appState.client_companies.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    
    workSelect.innerHTML = '<option value="">Selecione...</option>';
    appState.sand_works.forEach(w => {
        workSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
    });
    
    myCompanySelect.innerHTML = '<option value="">Selecione...</option>';
    appState.my_companies.forEach(m => {
        myCompanySelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });
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
    document.getElementById('assoc-my-company').value = '';
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
        const clientCompany = appState.client_companies.find(c => c.id === assoc.client_company_id);
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

const addTripRow = () => {
    tripCounter++;
    const container = document.getElementById('sand-trips-rows-container');
    
    const row = document.createElement('div');
    row.className = 'trip-row';
    row.id = `trip-row-${tripCounter}`;
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 150px 100px 80px; gap: 10px; margin-bottom: 10px; align-items: end;';
    
    // Monta opções do combo "EMPRESA - OBRA - R$ XX,XX"
    let options = '<option value="">Selecione EMPRESA - OBRA - PREÇO</option>';
    appState.sand_associations.forEach(assoc => {
        const clientCompany = appState.client_companies.find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const price = formatCurrency(assoc.price_m3);
        options += `<option value="${assoc.id}">${clientCompany?.name || '?'} - ${sandWork?.name || '?'} - ${price}</option>`;
    });
    
    row.innerHTML = `
        <div>
            <select class="trip-association-select" style="width: 100%;">
                ${options}
            </select>
        </div>
        <div>
            <input type="text" class="trip-romaneio-input" placeholder="Romaneio" style="width: 100%;">
        </div>
        <div>
            <input type="number" class="trip-count-input" placeholder="Viagens" min="1" value="1" style="width: 100%;">
        </div>
        <div>
            <button type="button" class="btn btn-sm btn-danger" onclick="window.removeTripRow('trip-row-${tripCounter}')">🗑️</button>
        </div>
    `;
    
    container.appendChild(row);
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
    
    const deliveryDate = new Date().toISOString().split('T')[0]; // Hoje
    const notes = document.getElementById('sand-delivery-notes').value.trim();
    
    const trips = [];
    for (const row of rows) {
        const associationId = parseInt(row.querySelector('.trip-association-select').value);
        const romaneio = row.querySelector('.trip-romaneio-input').value.trim();
        const tripCount = parseInt(row.querySelector('.trip-count-input').value);
        
        if (!associationId || !romaneio || isNaN(tripCount) || tripCount < 1) {
            alert('Preencha todos os campos de todas as viagens!');
            return;
        }
        
        trips.push({
            association_id: associationId,
            romaneio,
            delivery_date: deliveryDate,
            trip_count: tripCount,
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum lançamento encontrado</td></tr>';
        return;
    }
    
    appState.sand_deliveries.forEach(delivery => {
        const assoc = appState.sand_associations.find(a => a.id === delivery.association_id);
        if (!assoc) return;
        
        const clientCompany = appState.client_companies.find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const totalValue = delivery.trip_count * assoc.price_m3;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${delivery.romaneio || '-'}</td>
            <td>${formatDateBR(delivery.delivery_date)}</td>
            <td>${clientCompany?.name || '?'} - ${sandWork?.name || '?'}</td>
            <td>${delivery.trip_count}</td>
            <td>${formatCurrency(totalValue)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="window.deleteSandDelivery(${delivery.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(tr);
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

// ====================================================================
// ABA 3: RELATÓRIOS
// ====================================================================

const initRelatorios = () => {
    // Popula combo de associações
    populateReportAssociationCombo();
    
    // Botão gerar relatório
    document.getElementById('generate-sand-report-btn').onclick = generateSandReport;
    
    // Carrega relatórios salvos
    loadAndRenderSavedReports();
};

const populateReportAssociationCombo = () => {
    const select = document.getElementById('report-association-select');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    appState.sand_associations.forEach(assoc => {
        const clientCompany = appState.client_companies.find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const price = formatCurrency(assoc.price_m3);
        select.innerHTML += `<option value="${assoc.id}">${clientCompany?.name || '?'} - ${sandWork?.name || '?'} - ${price}</option>`;
    });
};

const generateSandReport = async () => {
    const associationId = parseInt(document.getElementById('report-association-select').value);
    const invoiceStatus = document.getElementById('report-invoice-status').value;
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    
    if (!associationId || !invoiceStatus) {
        alert('Selecione a Empresa-Obra e o Status da Nota!');
        return;
    }
    
    showSpinner();
    try {
        // Busca lançamentos filtrados
        const deliveries = await apiClient.fetchData('sand_deliveries_v2', '*', {
            association_id: associationId,
            invoice_status: invoiceStatus
        });
        
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
            totalValue += d.trip_count * assoc.price_m3;
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
        
        // TODO: Gerar PDF aqui (implementar depois)
        alert(`✅ Relatório gerado com sucesso!\n\nTotal: ${formatCurrency(totalValue)}\nViagens: ${filteredDeliveries.length}`);
        
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
        const assoc = appState.sand_associations.find(a => a.id === report.association_id);
        if (!assoc) return;
        
        const clientCompany = appState.client_companies.find(c => c.id === assoc.client_company_id);
        const sandWork = appState.sand_works.find(w => w.id === assoc.sand_work_id);
        const createdDate = formatDateBR(report.created_at);
        const statusLabel = report.report_type === 'NAO_EMITIDA' ? 'Não Emitidas' : 'Emitidas';
        
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
            <td>${clientCompany?.name || '?'} - ${sandWork?.name || '?'}</td>
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

const editSandReport = (id) => {
    alert('⚠️ Funcionalidade EDITAR RELATÓRIO em desenvolvimento!');
    // TODO: Implementar edição
};

const viewSandReport = (id) => {
    alert('⚠️ Funcionalidade VISUALIZAR RELATÓRIO em desenvolvimento!');
    // TODO: Abrir PDF em nova aba
};

const downloadSandReport = (id) => {
    alert('⚠️ Funcionalidade BAIXAR RELATÓRIO em desenvolvimento!');
    // TODO: Baixar PDF
};

const whatsappSandReport = (id) => {
    alert('⚠️ Funcionalidade WHATSAPP RELATÓRIO em desenvolvimento!');
    // TODO: Enviar por WhatsApp
};

const emailSandReport = (id) => {
    alert('⚠️ Funcionalidade EMAIL RELATÓRIO em desenvolvimento!');
    // TODO: Enviar por email
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
window.editSandReport = editSandReport;
window.viewSandReport = viewSandReport;
window.downloadSandReport = downloadSandReport;
window.whatsappSandReport = whatsappSandReport;
window.emailSandReport = emailSandReport;
window.deleteSandReport = deleteSandReport;
