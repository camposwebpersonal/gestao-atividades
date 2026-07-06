// alugueis_extended.js - Extensões para Bancos, Lançamentos e Relatórios
import { appState } from './appState.js';
import { apiClient } from './api.js';
import { showSpinner, hideSpinner, formatCurrency } from './utils.js';

// ==================== BANCOS ====================

export async function initRentalBanksTab() {
    console.log('🏦 Inicializando aba de Bancos');
    await loadBanks();
    renderBanksForm();
    renderBanksList();
}

async function loadBanks() {
    if (!appState.rentalBanks || appState.rentalBanks.length === 0) {
        appState.rentalBanks = await apiClient.fetchData('rental_banks') || [];
    }
}

function renderBanksForm() {
    const container = document.getElementById('rental-banks-container');
    container.innerHTML = `
        <form id="bank-form" onsubmit="event.preventDefault(); saveBank();" style="background: #2a2a2a; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <input type="hidden" id="bank-id">
            <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 15px; align-items: end;">
                <div>
                    <label>Nome do Banco*</label>
                    <input type="text" id="bank-name" required placeholder="Ex: Banco do Brasil">
                </div>
                <div>
                    <label>Código</label>
                    <input type="text" id="bank-code" placeholder="Ex: 001">
                </div>
                <button type="submit" class="btn btn-success">💾 Salvar</button>
            </div>
        </form>
        <div id="banks-list"></div>
    `;
}

window.saveBank = async function() {
    const id = document.getElementById('bank-id').value;
    const name = document.getElementById('bank-name').value.trim();
    const code = document.getElementById('bank-code').value.trim();
    
    if (!name) {
        alert('❌ Preencha o nome do banco!');
        return;
    }
    
    showSpinner();
    try {
        const bankData = { name, code: code || null };
        if (id) bankData.id = id;
        
        await apiClient.upsertItem('rental_banks', bankData);
        alert(id ? '✅ Banco atualizado!' : '✅ Banco cadastrado!');
        
        // RELOAD FORÇADO
        console.log('🔄 Recarregando bancos...');
        appState.rentalBanks = await apiClient.fetchData('rental_banks') || [];
        console.log('✅ Bancos recarregados:', appState.rentalBanks.length);
        
        document.getElementById('bank-form').reset();
        document.getElementById('bank-id').value = '';
        renderBanksList();
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        hideSpinner();
    }
};

function renderBanksList() {
    const container = document.getElementById('banks-list');
    const banks = appState.rentalBanks || [];
    
    let html = '<h4>Bancos Cadastrados</h4><div class="table-wrapper"><table><thead><tr>';
    html += '<th>Código</th><th>Nome</th><th>Ações</th>';
    html += '</tr></thead><tbody>';
    
    banks.forEach(bank => {
        html += '<tr>';
        html += `<td>${bank.code || '-'}</td>`;
        html += `<td>${bank.name}</td>`;
        html += `<td><button class="btn btn-sm btn-warning" onclick="editBank(${bank.id})">✏️</button>`;
        html += `<button class="btn btn-sm btn-danger" onclick="deleteBank(${bank.id})">🗑️</button></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

window.editBank = function(id) {
    const bank = appState.rentalBanks.find(b => b.id === id);
    if (!bank) return;
    
    document.getElementById('bank-id').value = bank.id;
    document.getElementById('bank-name').value = bank.name;
    document.getElementById('bank-code').value = bank.code || '';
};

window.deleteBank = async function(id) {
    if (!confirm('Excluir este banco?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('rental_banks', id);
        alert('✅ Banco excluído!');
        
        // RELOAD FORÇADO
        console.log('🔄 Recarregando bancos...');
        appState.rentalBanks = await apiClient.fetchData('rental_banks') || [];
        console.log('✅ Bancos recarregados:', appState.rentalBanks.length);
        
        renderBanksList();
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        hideSpinner();
    }
};

// ==================== LANÇAMENTOS ====================

export async function initRentalPaymentsTab() {
    console.log('💰 Inicializando aba de Lançamentos');
    await Promise.all([
        loadPaymentEntries(),
        loadContracts(),
        loadTenants(),
        loadProperties()
    ]);
    renderPaymentsForm();
    renderPaymentsList();
}

async function loadPaymentEntries() {
    appState.rentalPaymentEntries = await apiClient.fetchData('rental_payment_entries') || [];
}

async function loadContracts() {
    if (!appState.rentalContracts || appState.rentalContracts.length === 0) {
        appState.rentalContracts = await apiClient.fetchData('rental_contracts') || [];
    }
}

async function loadTenants() {
    if (!appState.rentalTenants || appState.rentalTenants.length === 0) {
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
    }
}

async function loadProperties() {
    if (!appState.rentalProperties || appState.rentalProperties.length === 0) {
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
    }
}

function renderPaymentsForm() {
    const activeContracts = (appState.rentalContracts || []).filter(c => c.status === 'Ativo');
    
    const contractsOptions = activeContracts.map(c => {
        const tenant = appState.rentalTenants.find(t => t.id === c.tenant_id);
        const property = appState.rentalProperties.find(p => p.id === c.property_id);
        return `<option value="${c.id}">Contrato ${c.contract_code} - ${tenant?.name} - ${property?.nickname || property?.street}</option>`;
    }).join('');
    
    const container = document.getElementById('rental-payments-container');
    container.innerHTML = `
        <form id="payment-form" onsubmit="event.preventDefault(); savePaymentEntry();" style="background: #2a2a2a; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <input type="hidden" id="payment-id">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 15px;">
                <div>
                    <label>Contrato*</label>
                    <select id="payment-contract" required onchange="updateContractInfo()">
                        <option value="">Selecione...</option>
                        ${contractsOptions}
                    </select>
                </div>
                <div>
                    <label>Data Pagamento*</label>
                    <input type="date" id="payment-date" required>
                </div>
                <div>
                    <label>Mês Referência*</label>
                    <input type="month" id="payment-reference-month" required>
                </div>
                <div>
                    <label>Valor (R$)*</label>
                    <input type="number" id="payment-amount" step="0.01" required>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <label>Observações</label>
                <textarea id="payment-observations" rows="2"></textarea>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" id="payment-end-contract">
                    <span>Contrato Encerrado (inquilino saiu)</span>
                </label>
                <div id="end-contract-date-field" style="display: none;">
                    <label>Data Encerramento:</label>
                    <input type="date" id="payment-end-date">
                </div>
            </div>
            <button type="submit" class="btn btn-success" style="margin-top: 15px;">💾 Salvar Lançamento</button>
        </form>
        <div id="payments-list"></div>
    `;
    
    document.getElementById('payment-end-contract').addEventListener('change', function() {
        document.getElementById('end-contract-date-field').style.display = this.checked ? 'block' : 'none';
    });
}

window.updateContractInfo = function() {
    const contractId = document.getElementById('payment-contract').value;
    if (!contractId) return;
    
    const contract = appState.rentalContracts.find(c => c.id == contractId);
    if (contract) {
        document.getElementById('payment-amount').value = contract.rent_value;
    }
};

window.savePaymentEntry = async function() {
    const id = document.getElementById('payment-id').value;
    const contractId = document.getElementById('payment-contract').value;
    const paymentDate = document.getElementById('payment-date').value;
    const referenceMonth = document.getElementById('payment-reference-month').value + '-01';
    const amount = document.getElementById('payment-amount').value;
    const observations = document.getElementById('payment-observations').value;
    const endContract = document.getElementById('payment-end-contract').checked;
    const endDate = document.getElementById('payment-end-date').value;
    
    if (!contractId || !paymentDate || !referenceMonth || !amount) {
        alert('❌ Preencha todos os campos obrigatórios!');
        return;
    }
    
    showSpinner();
    try {
        const paymentData = {
            contract_id: contractId,
            payment_date: paymentDate,
            reference_month: referenceMonth,
            amount,
            observations: observations || null
        };
        if (id) paymentData.id = id;
        
        await apiClient.upsertItem('rental_payment_entries', paymentData);
        
        // Se marcar como encerrado, atualizar contrato
        if (endContract && endDate) {
            await apiClient.upsertItem('rental_contracts', {
                id: contractId,
                status: 'Encerrado',
                actual_end_date: endDate
            });
        }
        
        alert(id ? '✅ Lançamento atualizado!' : '✅ Lançamento registrado!');
        
        await loadPaymentEntries();
        await loadContracts();
        document.getElementById('payment-form').reset();
        document.getElementById('payment-id').value = '';
        renderPaymentsList();
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        hideSpinner();
    }
};

function renderPaymentsList() {
    const container = document.getElementById('payments-list');
    const payments = appState.rentalPaymentEntries || [];
    
    let html = '<h4>Lançamentos Registrados</h4><div class="table-wrapper"><table><thead><tr>';
    html += '<th>Data Pgto</th><th>Contrato</th><th>Inquilino</th><th>Mês Ref.</th><th>Valor</th><th>Obs.</th><th>Ações</th>';
    html += '</tr></thead><tbody>';
    
    payments.forEach(payment => {
        const contract = appState.rentalContracts.find(c => c.id === payment.contract_id);
        const tenant = contract ? appState.rentalTenants.find(t => t.id === contract.tenant_id) : null;
        const refMonth = new Date(payment.reference_month + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        
        html += '<tr>';
        html += `<td>${new Date(payment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>`;
        html += `<td>${contract?.contract_code || 'N/A'}</td>`;
        html += `<td>${tenant?.name || 'N/A'}</td>`;
        html += `<td>${refMonth}</td>`;
        html += `<td>${formatCurrency(payment.amount)}</td>`;
        html += `<td>${payment.observations || '-'}</td>`;
        html += `<td><button class="btn btn-sm btn-danger" onclick="deletePaymentEntry(${payment.id})">🗑️</button></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

window.deletePaymentEntry = async function(id) {
    if (!confirm('Excluir este lançamento?')) return;
    
    showSpinner();
    try {
        await apiClient.deleteItem('rental_payment_entries', id);
        alert('✅ Lançamento excluído!');
        await loadPaymentEntries();
        renderPaymentsList();
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        hideSpinner();
    }
};

// ==================== RELATÓRIOS ====================

export async function initRentalReportsTab() {
    console.log('📊 Inicializando aba de Relatórios');
    await Promise.all([
        loadPaymentEntries(),
        loadContracts(),
        loadTenants(),
        loadProperties()
    ]);
    renderReportsForm();
}

function renderReportsForm() {
    const container = document.getElementById('rental-reports-container');
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            <div style="background: #2a2a2a; padding: 20px; border-radius: 5px;">
                <h4>📊 Relatório de Pagamentos Recebidos</h4>
                <div style="display: grid; gap: 10px; margin-top: 15px;">
                    <div>
                        <label>Período:</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <input type="month" id="paid-start-month">
                            <input type="month" id="paid-end-month">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="generatePaidReport()">Gerar Relatório</button>
                </div>
                <div id="paid-report-output" style="margin-top: 20px;"></div>
            </div>
            
            <div style="background: #2a2a2a; padding: 20px; border-radius: 5px;">
                <h4>⚠️ Relatório de Pagamentos Pendentes</h4>
                <div style="display: grid; gap: 10px; margin-top: 15px;">
                    <div>
                        <label>Até o mês:</label>
                        <input type="month" id="pending-month">
                    </div>
                    <button class="btn btn-warning" onclick="generatePendingReport()">Gerar Relatório</button>
                </div>
                <div id="pending-report-output" style="margin-top: 20px;"></div>
            </div>
        </div>
    `;
}

window.generatePaidReport = function() {
    const startMonth = document.getElementById('paid-start-month').value;
    const endMonth = document.getElementById('paid-end-month').value;
    
    if (!startMonth || !endMonth) {
        alert('❌ Selecione o período!');
        return;
    }
    
    const payments = appState.rentalPaymentEntries.filter(p => {
        return p.reference_month >= startMonth + '-01' && p.reference_month <= endMonth + '-01';
    });
    
    let html = '<h5>Pagamentos Recebidos</h5><div class="table-wrapper"><table><thead><tr>';
    html += '<th>Contrato</th><th>Inquilino</th><th>Mês Ref.</th><th>Valor</th><th>Data Pgto</th>';
    html += '</tr></thead><tbody>';
    
    let total = 0;
    payments.forEach(payment => {
        const contract = appState.rentalContracts.find(c => c.id === payment.contract_id);
        const tenant = contract ? appState.rentalTenants.find(t => t.id === contract.tenant_id) : null;
        const refMonth = new Date(payment.reference_month + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        
        html += '<tr>';
        html += `<td>${contract?.contract_code || 'N/A'}</td>`;
        html += `<td>${tenant?.name || 'N/A'}</td>`;
        html += `<td>${refMonth}</td>`;
        html += `<td>${formatCurrency(payment.amount)}</td>`;
        html += `<td>${new Date(payment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>`;
        html += '</tr>';
        
        total += parseFloat(payment.amount);
    });
    
    html += `</tbody><tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td colspan="2"><strong>${formatCurrency(total)}</strong></td></tr></tfoot></table></div>`;
    document.getElementById('paid-report-output').innerHTML = html;
};

window.generatePendingReport = function() {
    const untilMonth = document.getElementById('pending-month').value;
    
    if (!untilMonth) {
        alert('❌ Selecione o mês!');
        return;
    }
    
    const activeContracts = appState.rentalContracts.filter(c => c.status === 'Ativo');
    const pendingList = [];
    
    activeContracts.forEach(contract => {
        const startDate = new Date(contract.start_date);
        const currentDate = new Date(untilMonth + '-01');
        
        let checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        
        while (checkDate <= currentDate) {
            const monthStr = checkDate.toISOString().slice(0, 7) + '-01';
            const hasPaid = appState.rentalPaymentEntries.some(p => 
                p.contract_id == contract.id && p.reference_month === monthStr
            );
            
            if (!hasPaid) {
                const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
                const property = appState.rentalProperties.find(p => p.id === contract.property_id);
                pendingList.push({
                    contract,
                    tenant,
                    property,
                    month: monthStr
                });
            }
            
            checkDate.setMonth(checkDate.getMonth() + 1);
        }
    });
    
    let html = '<h5>Pagamentos Pendentes</h5><div class="table-wrapper"><table><thead><tr>';
    html += '<th>Contrato</th><th>Inquilino</th><th>Imóvel</th><th>Mês Pendente</th><th>Valor</th>';
    html += '</tr></thead><tbody>';
    
    let total = 0;
    pendingList.forEach(item => {
        const refMonth = new Date(item.month + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        
        html += '<tr style="background: #fff3cd;">';
        html += `<td>${item.contract?.contract_code || 'N/A'}</td>`;
        html += `<td>${item.tenant?.name || 'N/A'}</td>`;
        html += `<td>${item.property?.nickname || item.property?.street || 'N/A'}</td>`;
        html += `<td>${refMonth}</td>`;
        html += `<td>${formatCurrency(item.contract.rent_value)}</td>`;
        html += '</tr>';
        
        total += parseFloat(item.contract.rent_value);
    });
    
    html += `</tbody><tfoot><tr><td colspan="4"><strong>TOTAL PENDENTE</strong></td><td><strong>${formatCurrency(total)}</strong></td></tr></tfoot></table></div>`;
    document.getElementById('pending-report-output').innerHTML = html;
};
