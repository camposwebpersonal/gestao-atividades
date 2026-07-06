import { appState } from './appState.js';
import { apiClient } from './api.js';
import { showSpinner, hideSpinner } from './utils.js';
import { generateContractPDF } from './alugueis_contrato_pdf.js';
import { initRentalBanksTab, initRentalPaymentsTab, initRentalReportsTab } from './alugueis_extended.js';

// Exportar funções para uso global
window.initRentalBanksTab = initRentalBanksTab;
window.initRentalPaymentsTab = initRentalPaymentsTab;
window.initRentalReportsTab = initRentalReportsTab;

/**
 * Módulo de Controle de Aluguéis de Imóveis
 * Gerencia inquilinos, proprietários, imóveis e contratos de aluguel
 */

// ==================== INQUILINOS ====================

export async function initRentalTenantsTab() {
    console.log('🏠 Inicializando aba de Inquilinos');
    await loadTenants();
    renderTenantsForm();
    renderTenantsList();
}

async function loadTenants() {
    if (!appState.rentalTenants || appState.rentalTenants.length === 0) {
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
    }
}

function renderTenantsForm() {
    const container = document.getElementById('rental-tenants-container');
    container.innerHTML = `
        <form id="tenant-form" class="crud-form">
            <div class="form-grid">
                <div class="form-group">
                    <label for="tenant-name">Nome Completo *</label>
                    <input type="text" id="tenant-name" required>
                </div>
                <div class="form-group">
                    <label for="tenant-cpf">CPF</label>
                    <input type="text" id="tenant-cpf" maxlength="14" placeholder="000.000.000-00">
                </div>
                <div class="form-group">
                    <label for="tenant-cnpj">CNPJ</label>
                    <input type="text" id="tenant-cnpj" maxlength="18" placeholder="00.000.000/0000-00">
                </div>
                <div class="form-group">
                    <label for="tenant-document-type">Documento Principal *</label>
                    <select id="tenant-document-type" required>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                    </select>
                    <small style="color: #999;">Usado nas assinaturas</small>
                </div>
                <div class="form-group">
                    <label for="tenant-gender">Sexo *</label>
                    <select id="tenant-gender" required>
                        <option value="">Selecione</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                        <option value="O">Outro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tenant-phone">Telefone</label>
                    <input type="tel" id="tenant-phone" placeholder="(00) 00000-0000">
                </div>
                <div class="form-group">
                    <label for="tenant-email">E-mail</label>
                    <input type="email" id="tenant-email">
                </div>
                <div class="form-group">
                    <label for="tenant-birth-date">Data de Nascimento</label>
                    <input type="date" id="tenant-birth-date">
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">💾 Salvar</button>
                <button type="button" id="tenant-cancel-btn" class="btn btn-secondary">❌ Cancelar</button>
            </div>
        </form>
        <hr>
        <h4>Inquilinos Cadastrados</h4>
        <div id="tenants-list"></div>
    `;

    // Event listeners
    const form = document.getElementById('tenant-form');
    form.addEventListener('submit', handleTenantSubmit);
    
    document.getElementById('tenant-cancel-btn').addEventListener('click', () => {
        form.reset();
        delete form.dataset.editingId;
    });

    // Máscara de CPF
    const cpfInput = document.getElementById('tenant-cpf');
    cpfInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        e.target.value = value;
    });

    // Máscara de CNPJ
    const cnpjInput = document.getElementById('tenant-cnpj');
    cnpjInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 14) {
            value = value.replace(/(\d{2})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1/$2');
            value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        e.target.value = value;
    });

    // Máscara de telefone
    const phoneInput = document.getElementById('tenant-phone');
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
            value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        }
        e.target.value = value;
    });
}

async function handleTenantSubmit(e) {
    e.preventDefault();
    
    const cpf = document.getElementById('tenant-cpf').value;
    const cnpj = document.getElementById('tenant-cnpj').value;
    
    // Validar que pelo menos um documento foi preenchido
    if (!cpf && !cnpj) {
        alert('❌ Preencha pelo menos CPF ou CNPJ!');
        return;
    }
    
    showSpinner();

    const form = e.target;
    const tenantData = {
        name: document.getElementById('tenant-name').value,
        cpf: cpf || null,
        cnpj: cnpj || null,
        document_type: document.getElementById('tenant-document-type').value,
        gender: document.getElementById('tenant-gender').value,
        phone: document.getElementById('tenant-phone').value || null,
        email: document.getElementById('tenant-email').value || null,
        birth_date: document.getElementById('tenant-birth-date').value || null
    };

    if (form.dataset.editingId) {
        tenantData.id = form.dataset.editingId;
    }

    try {
        await apiClient.upsertItem('rental_tenants', tenantData);
        alert('✅ Inquilino salvo com sucesso!');
        form.reset();
        delete form.dataset.editingId;
        
        // RELOAD FORÇADO
        console.log('🔄 Recarregando inquilinos...');
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
        console.log('✅ Inquilinos recarregados:', appState.rentalTenants.length);
        
        renderTenantsList();
    } catch (error) {
        alert('❌ Erro ao salvar inquilino: ' + error.message);
    } finally {
        hideSpinner();
    }
}

function renderTenantsList() {
    const container = document.getElementById('tenants-list');
    if (!appState.rentalTenants || appState.rentalTenants.length === 0) {
        container.innerHTML = '<p>Nenhum inquilino cadastrado.</p>';
        return;
    }

    const html = appState.rentalTenants.map(tenant => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${tenant.name}</strong>
                <span>CPF: ${tenant.cpf}</span>
                ${tenant.phone ? `<span>Tel: ${tenant.phone}</span>` : ''}
            </div>
            <div class="list-item-actions">
                <button class="btn btn-sm btn-warning" onclick="editTenant(${tenant.id})">✏️ Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTenant(${tenant.id})">🗑️ Excluir</button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

window.editTenant = async function(id) {
    const tenant = appState.rentalTenants.find(t => t.id === id);
    if (!tenant) return;

    document.getElementById('tenant-name').value = tenant.name || '';
    document.getElementById('tenant-cpf').value = tenant.cpf || '';
    document.getElementById('tenant-cnpj').value = tenant.cnpj || '';
    document.getElementById('tenant-document-type').value = tenant.document_type || 'cpf';
    document.getElementById('tenant-gender').value = tenant.gender || '';
    document.getElementById('tenant-phone').value = tenant.phone || '';
    document.getElementById('tenant-email').value = tenant.email || '';
    document.getElementById('tenant-birth-date').value = tenant.birth_date || '';

    const form = document.getElementById('tenant-form');
    form.dataset.editingId = id;
    form.scrollIntoView({ behavior: 'smooth' });
};

window.deleteTenant = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este inquilino?')) return;

    showSpinner();
    try {
        await apiClient.deleteItem('rental_tenants', id);
        alert('✅ Inquilino excluído com sucesso!');
        
        // RELOAD FORÇADO
        console.log('🔄 Recarregando inquilinos...');
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
        console.log('✅ Inquilinos recarregados:', appState.rentalTenants.length);
        
        renderTenantsList();
    } catch (error) {
        alert('❌ Erro ao excluir inquilino: ' + error.message);
    } finally {
        hideSpinner();
    }
};

// ==================== PROPRIETÁRIOS ====================

export async function initRentalOwnersTab() {
    console.log('🏠 Inicializando aba de Proprietários');
    await loadOwners();
    await loadBanks(); // Carregar bancos para o combobox
    renderOwnersForm();
    renderOwnersList();
}

async function loadBanks() {
    if (!appState.rentalBanks || appState.rentalBanks.length === 0) {
        appState.rentalBanks = await apiClient.fetchData('rental_banks') || [];
    }
}

async function loadOwners() {
    if (!appState.rentalOwners || appState.rentalOwners.length === 0) {
        appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
    }
    if (!appState.rentalOwnerPayments || appState.rentalOwnerPayments.length === 0) {
        appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
    }
}

function renderOwnersForm() {
    const container = document.getElementById('rental-owners-container');
    container.innerHTML = `
        <form id="owner-form" class="crud-form">
            <div class="form-grid">
                <div class="form-group">
                    <label for="owner-name">Nome Completo *</label>
                    <input type="text" id="owner-name" required>
                </div>
                <div class="form-group">
                    <label for="owner-cpf">CPF</label>
                    <input type="text" id="owner-cpf" maxlength="14" placeholder="000.000.000-00">
                </div>
                <div class="form-group">
                    <label for="owner-cnpj">CNPJ</label>
                    <input type="text" id="owner-cnpj" maxlength="18" placeholder="00.000.000/0000-00">
                </div>
                <div class="form-group">
                    <label for="owner-document-type">Documento Principal *</label>
                    <select id="owner-document-type" required>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                    </select>
                    <small style="color: #999;">Usado nas assinaturas</small>
                </div>
                <div class="form-group">
                    <label for="owner-phone">Telefone</label>
                    <input type="tel" id="owner-phone">
                </div>
                <div class="form-group">
                    <label for="owner-email">E-mail</label>
                    <input type="email" id="owner-email">
                </div>
            </div>

            <h4 style="margin-top: 20px;">Formas de Pagamento</h4>
            <div id="owner-payments-container"></div>
            <button type="button" id="add-payment-btn" class="btn btn-secondary btn-sm">➕ Adicionar Forma de Pagamento</button>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">💾 Salvar</button>
                <button type="button" id="owner-cancel-btn" class="btn btn-secondary">❌ Cancelar</button>
            </div>
        </form>
        <hr>
        <h4>Proprietários Cadastrados</h4>
        <div id="owners-list"></div>
    `;

    document.getElementById('add-payment-btn').addEventListener('click', addPaymentMethod);
    
    const form = document.getElementById('owner-form');
    form.addEventListener('submit', handleOwnerSubmit);
    
    document.getElementById('owner-cancel-btn').addEventListener('click', () => {
        form.reset();
        delete form.dataset.editingId;
        document.getElementById('owner-payments-container').innerHTML = '';
    });
    
    // Máscaras CPF e CNPJ
    const cpfInput = document.getElementById('owner-cpf');
    cpfInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        e.target.value = value;
    });

    const cnpjInput = document.getElementById('owner-cnpj');
    cnpjInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 14) {
            value = value.replace(/(\d{2})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1/$2');
            value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        e.target.value = value;
    });

    // Adicionar primeira forma de pagamento por padrão
    addPaymentMethod();
}

let paymentMethodCount = 0;

function addPaymentMethod() {
    const container = document.getElementById('owner-payments-container');
    const index = paymentMethodCount++;
    
    const div = document.createElement('div');
    div.className = 'payment-method-item';
    div.dataset.index = index;
    div.innerHTML = `
        <div class="form-grid" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
            <div class="form-group">
                <label>Tipo de Pagamento</label>
                <select class="payment-type" data-index="${index}">
                    <option value="">Selecione</option>
                    <option value="PIX">PIX</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="BOLETO">Boleto</option>
                </select>
            </div>
            <div class="payment-details-${index}"></div>
            <div class="form-group">
                <button type="button" class="btn btn-danger btn-sm" onclick="removePaymentMethod(${index})">🗑️ Remover</button>
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    div.querySelector('.payment-type').addEventListener('change', (e) => {
        updatePaymentFields(index, e.target.value);
    });
}

function updatePaymentFields(index, type) {
    const detailsContainer = document.querySelector(`.payment-details-${index}`);
    let html = '';
    
    if (type === 'PIX') {
        html = `
            <div class="form-group">
                <label>Chave PIX</label>
                <input type="text" class="payment-pix-key" data-index="${index}" placeholder="CPF, telefone, e-mail ou chave aleatória">
            </div>
        `;
    } else if (type === 'TRANSFERENCIA') {
        const banksOptions = (appState.rentalBanks || []).map(b => 
            `<option value="${b.id}">${b.name}${b.code ? ' - ' + b.code : ''}</option>`
        ).join('');
        
        html = `
            <div class="form-group">
                <label>Banco</label>
                <select class="payment-bank" data-index="${index}">
                    <option value="">Selecione o banco</option>
                    ${banksOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Agência</label>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px;">
                    <input type="text" class="payment-agency" data-index="${index}" placeholder="Ex: 1234">
                    <input type="text" class="payment-agency-digit" data-index="${index}" placeholder="Díg.">
                </div>
            </div>
            <div class="form-group">
                <label>Conta</label>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 5px;">
                    <input type="text" class="payment-account" data-index="${index}" placeholder="Ex: 12345-6">
                    <input type="text" class="payment-account-digit" data-index="${index}" placeholder="Díg.">
                </div>
            </div>
        `;
    }
    
    detailsContainer.innerHTML = html;
}

window.removePaymentMethod = function(index) {
    const element = document.querySelector(`[data-index="${index}"]`);
    if (element) element.remove();
};

async function handleOwnerSubmit(e) {
    e.preventDefault();
    
    const cpf = document.getElementById('owner-cpf').value;
    const cnpj = document.getElementById('owner-cnpj').value;
    
    // Validar que pelo menos um documento foi preenchido
    if (!cpf && !cnpj) {
        alert('❌ Preencha pelo menos CPF ou CNPJ!');
        return;
    }
    
    showSpinner();

    const form = e.target;
    const ownerData = {
        name: document.getElementById('owner-name').value,
        cpf: cpf || null,
        cnpj: cnpj || null,
        document_type: document.getElementById('owner-document-type').value,
        phone: document.getElementById('owner-phone').value || null,
        email: document.getElementById('owner-email').value || null
    };

    if (form.dataset.editingId) {
        ownerData.id = form.dataset.editingId;
    }

    try {
        const result = await apiClient.upsertItem('rental_owners', ownerData);
        const ownerId = result.id || form.dataset.editingId;

        // ===== DELETAR FORMAS DE PAGAMENTO ANTIGAS (se editando) =====
        if (form.dataset.editingId) {
            console.log('🗑️ Deletando formas de pagamento antigas do owner', ownerId);
            const oldPayments = appState.rentalOwnerPayments.filter(p => p.owner_id == ownerId);
            for (const oldPayment of oldPayments) {
                await apiClient.deleteItem('rental_owner_payments', oldPayment.id);
                console.log('❌ Deletado payment ID:', oldPayment.id);
            }
        }

        // ===== SALVAR NOVAS FORMAS DE PAGAMENTO =====
        const paymentItems = document.querySelectorAll('.payment-method-item');
        console.log('💾 Salvando', paymentItems.length, 'formas de pagamento...');
        
        for (const item of paymentItems) {
            const index = item.dataset.index;
            const type = item.querySelector('.payment-type').value;
            if (!type) continue;

            const paymentData = {
                owner_id: ownerId,
                payment_type: type
            };

            if (type === 'PIX') {
                const keyInput = item.querySelector('.payment-pix-key');
                paymentData.pix_key = keyInput ? keyInput.value : null;
            } else if (type === 'TRANSFERENCIA') {
                const bankInput = item.querySelector('.payment-bank');
                const agencyInput = item.querySelector('.payment-agency');
                const agencyDigitInput = item.querySelector('.payment-agency-digit');
                const accountInput = item.querySelector('.payment-account');
                const accountDigitInput = item.querySelector('.payment-account-digit');
                
                paymentData.bank_id = bankInput ? bankInput.value : null;
                paymentData.agency = agencyInput ? agencyInput.value : null;
                paymentData.agency_digit = agencyDigitInput ? agencyDigitInput.value : null;
                paymentData.account = accountInput ? accountInput.value : null;
                paymentData.account_digit = accountDigitInput ? accountDigitInput.value : null;
                
                // Buscar nome do banco para compatibilidade
                if (paymentData.bank_id) {
                    const bank = appState.rentalBanks.find(b => b.id == paymentData.bank_id);
                    paymentData.bank_name = bank ? bank.name : null;
                }
            }

            const savedPayment = await apiClient.upsertItem('rental_owner_payments', paymentData);
            console.log('✅ Salvo payment:', savedPayment);
        }

        alert('✅ Proprietário salvo com sucesso!');
        form.reset();
        delete form.dataset.editingId;
        document.getElementById('owner-payments-container').innerHTML = '';
        paymentMethodCount = 0;
        
        // RELOAD FORÇADO de owners e payments
        console.log('🔄 Recarregando proprietários e formas de pagamento...');
        appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
        appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
        console.log('✅ Dados recarregados:', {
            owners: appState.rentalOwners.length,
            payments: appState.rentalOwnerPayments.length
        });
        
        renderOwnersList();
    } catch (error) {
        alert('❌ Erro ao salvar proprietário: ' + error.message);
    } finally {
        hideSpinner();
    }
}

function renderOwnersList() {
    const container = document.getElementById('owners-list');
    if (!appState.rentalOwners || appState.rentalOwners.length === 0) {
        container.innerHTML = '<p>Nenhum proprietário cadastrado.</p>';
        return;
    }

    const html = appState.rentalOwners.map(owner => {
        const payments = (appState.rentalOwnerPayments || []).filter(p => p.owner_id === owner.id);
        const paymentInfo = payments.length > 0 ? 
            `<small>${payments.length} forma(s) de pagamento</small>` : 
            '<small>Sem formas de pagamento</small>';

        return `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>${owner.name}</strong>
                    <span>${owner.cpf_cnpj}</span>
                    ${paymentInfo}
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-sm btn-warning" onclick="editOwner(${owner.id})">✏️ Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteOwner(${owner.id})">🗑️ Excluir</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

window.editOwner = async function(id) {
    console.log('✏️ Editando proprietário ID:', id);
    
    // ===== RELOAD FORÇADO DOS DADOS =====
    showSpinner();
    console.log('📦 Recarregando proprietários e formas de pagamento...');
    appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
    appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
    appState.rentalBanks = await apiClient.fetchData('rental_banks') || [];
    console.log('✅ Dados recarregados:', {
        owners: appState.rentalOwners.length,
        payments: appState.rentalOwnerPayments.length,
        banks: appState.rentalBanks.length
    });
    hideSpinner();
    
    const owner = appState.rentalOwners.find(o => o.id === id);
    if (!owner) {
        alert('❌ Proprietário não encontrado!');
        return;
    }

    // ===== PREENCHER DADOS BÁSICOS =====
    document.getElementById('owner-name').value = owner.name || '';
    document.getElementById('owner-document-type').value = owner.document_type || 'cpf';
    document.getElementById('owner-cpf').value = owner.cpf || '';
    document.getElementById('owner-cnpj').value = owner.cnpj || '';
    document.getElementById('owner-phone').value = owner.phone || '';
    document.getElementById('owner-email').value = owner.email || '';

    // ===== CARREGAR FORMAS DE PAGAMENTO EXISTENTES =====
    const payments = appState.rentalOwnerPayments.filter(p => p.owner_id === id);
    console.log('💳 Formas de pagamento encontradas:', payments.length, payments);
    
    const container = document.getElementById('owner-payments-container');
    container.innerHTML = '';
    paymentMethodCount = 0;

    payments.forEach(payment => {
        console.log('🔍 Processando payment:', payment);
        const index = paymentMethodCount++;
        
        // Criar o div manualmente (mesma lógica de addPaymentMethod)
        const div = document.createElement('div');
        div.className = 'payment-method-item';
        div.dataset.index = index;
        div.innerHTML = `
            <div class="form-grid" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                <div class="form-group">
                    <label>Tipo de Pagamento</label>
                    <select class="payment-type" data-index="${index}">
                        <option value="">Selecione</option>
                        <option value="PIX">PIX</option>
                        <option value="TRANSFERENCIA">Transferência Bancária</option>
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="BOLETO">Boleto</option>
                    </select>
                </div>
                <div class="payment-details-${index}"></div>
                <div class="form-group">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removePaymentMethod(${index})">🗑️ Remover</button>
                </div>
            </div>
        `;
        
        container.appendChild(div);
        
        // Adicionar event listener
        div.querySelector('.payment-type').addEventListener('change', (e) => {
            updatePaymentFields(index, e.target.value);
        });
        
        // Preencher tipo
        div.querySelector('.payment-type').value = payment.payment_type;
        
        // Atualizar campos
        updatePaymentFields(index, payment.payment_type);
        
        // Preencher valores específicos
        if (payment.payment_type === 'PIX' && payment.pix_key) {
            const keyInput = div.querySelector('.payment-pix-key');
            if (keyInput) {
                keyInput.value = payment.pix_key;
                console.log('✅ PIX key preenchida:', payment.pix_key);
            }
        } else if (payment.payment_type === 'TRANSFERENCIA') {
            const bankInput = div.querySelector('.payment-bank');
            const agencyInput = div.querySelector('.payment-agency');
            const agencyDigitInput = div.querySelector('.payment-agency-digit');
            const accountInput = div.querySelector('.payment-account');
            const accountDigitInput = div.querySelector('.payment-account-digit');
            
            if (bankInput && payment.bank_id) {
                bankInput.value = payment.bank_id;
                console.log('✅ Banco preenchido:', payment.bank_id);
            }
            if (agencyInput && payment.agency) {
                agencyInput.value = payment.agency;
            }
            if (agencyDigitInput && payment.agency_digit) {
                agencyDigitInput.value = payment.agency_digit;
            }
            if (accountInput && payment.account) {
                accountInput.value = payment.account;
            }
            if (accountDigitInput && payment.account_digit) {
                accountDigitInput.value = payment.account_digit;
            }
            console.log('✅ Transferência preenchida');
        }
        
        console.log('✅ Payment index', index, 'carregado completamente');
    });

    const form = document.getElementById('owner-form');
    form.dataset.editingId = id;
    form.scrollIntoView({ behavior: 'smooth' });
    
    console.log('✅ Edição pronta! Total de payments carregados:', payments.length);
};

window.deleteOwner = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este proprietário?')) return;

    showSpinner();
    try {
        await apiClient.deleteItem('rental_owners', id);
        alert('✅ Proprietário excluído com sucesso!');
        
        // RELOAD FORÇADO
        console.log('🔄 Recarregando proprietários...');
        appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
        appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
        console.log('✅ Dados recarregados:', appState.rentalOwners.length);
        
        renderOwnersList();
    } catch (error) {
        alert('❌ Erro ao excluir proprietário: ' + error.message);
    } finally {
        hideSpinner();
    }
};

// ==================== IMÓVEIS ====================

export async function initRentalPropertiesTab() {
    console.log('🏠 Inicializando aba de Imóveis');
    await loadProperties();
    await loadOwners(); // Precisa dos proprietários
    renderPropertiesForm();
    renderPropertiesList();
}

async function loadProperties() {
    if (!appState.rentalProperties || appState.rentalProperties.length === 0) {
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
    }
}

function renderPropertiesForm() {
    const container = document.getElementById('rental-properties-container');
    
    const ownersOptions = (appState.rentalOwners || [])
        .map(o => `<option value="${o.id}">${o.name}</option>`)
        .join('');

    container.innerHTML = `
        <form id="property-form" class="crud-form">
            <div class="form-grid">
                <div class="form-group">
                    <label for="property-nickname">Apelido do Imóvel *</label>
                    <input type="text" id="property-nickname" required placeholder="Ex: Casa Azul, Apto 301">
                </div>
                <div class="form-group">
                    <label for="property-owner">Proprietário *</label>
                    <select id="property-owner" required>
                        <option value="">Selecione</option>
                        ${ownersOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="property-street">Rua/Avenida *</label>
                    <input type="text" id="property-street" required>
                </div>
                <div class="form-group">
                    <label for="property-number">Número *</label>
                    <input type="text" id="property-number" required>
                </div>
                <div class="form-group">
                    <label for="property-complement">Complemento</label>
                    <input type="text" id="property-complement" placeholder="Apto, casa, etc">
                </div>
                <div class="form-group">
                    <label for="property-neighborhood">Bairro *</label>
                    <input type="text" id="property-neighborhood" required>
                </div>
                <div class="form-group">
                    <label for="property-city">Cidade *</label>
                    <input type="text" id="property-city" required>
                </div>
                <div class="form-group">
                    <label for="property-state">Estado *</label>
                    <input type="text" id="property-state" required maxlength="2" placeholder="PE">
                </div>
                <div class="form-group">
                    <label for="property-cep">CEP</label>
                    <input type="text" id="property-cep" maxlength="9" placeholder="00000-000">
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">💾 Salvar</button>
                <button type="button" id="property-cancel-btn" class="btn btn-secondary">❌ Cancelar</button>
            </div>
        </form>
        <hr>
        <h4>Imóveis Cadastrados</h4>
        <div id="properties-list"></div>
    `;

    const form = document.getElementById('property-form');
    form.addEventListener('submit', handlePropertySubmit);
    
    document.getElementById('property-cancel-btn').addEventListener('click', () => {
        form.reset();
        delete form.dataset.editingId;
    });
}

async function handlePropertySubmit(e) {
    e.preventDefault();
    showSpinner();

    const form = e.target;
    const propertyData = {
        nickname: document.getElementById('property-nickname').value,
        owner_id: document.getElementById('property-owner').value,
        street: document.getElementById('property-street').value,
        number: document.getElementById('property-number').value,
        complement: document.getElementById('property-complement').value || null,
        neighborhood: document.getElementById('property-neighborhood').value,
        city: document.getElementById('property-city').value,
        state: document.getElementById('property-state').value,
        cep: document.getElementById('property-cep').value || null
    };

    if (form.dataset.editingId) {
        propertyData.id = form.dataset.editingId;
    }

    try {
        await apiClient.upsertItem('rental_properties', propertyData);
        alert('✅ Imóvel salvo com sucesso!');
        form.reset();
        delete form.dataset.editingId;
        
        // RELOAD COMPLETO dos dados para garantir consistência
        console.log('🔄 Recarregando todos os dados de imóveis...');
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
        appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
        console.log('✅ Dados recarregados:', {
            properties: appState.rentalProperties.length,
            owners: appState.rentalOwners.length
        });
        
        renderPropertiesList();
    } catch (error) {
        alert('❌ Erro ao salvar imóvel: ' + error.message);
    } finally {
        hideSpinner();
    }
}

function renderPropertiesList() {
    const container = document.getElementById('properties-list');
    if (!appState.rentalProperties || appState.rentalProperties.length === 0) {
        container.innerHTML = '<p>Nenhum imóvel cadastrado.</p>';
        return;
    }

    const html = appState.rentalProperties.map(property => {
        const owner = (appState.rentalOwners || []).find(o => o.id === property.owner_id);
        const ownerName = owner ? owner.name : 'Proprietário não encontrado';
        const address = `${property.street}, ${property.number}${property.complement ? ' - ' + property.complement : ''} - ${property.neighborhood}, ${property.city}/${property.state}`;

        return `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>${property.nickname}</strong>
                    <span>${address}</span>
                    <small>Proprietário: ${ownerName}</small>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-sm btn-warning" onclick="editProperty(${property.id})">✏️ Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProperty(${property.id})">🗑️ Excluir</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

window.editProperty = async function(id) {
    console.log('✏️ Editando imóvel ID:', id);
    
    // FORÇAR RELOAD dos proprietários para evitar cache/duplicação
    showSpinner();
    appState.rentalOwners = await apiClient.fetchData('rental_owners', 'id, name, cpf, cnpj, document_type, phone, email') || [];
    console.log('📦 Proprietários recarregados:', appState.rentalOwners.length);
    
    // Recarregar dropdown de proprietários SEM duplicação
    const ownerSelect = document.getElementById('property-owner');
    if (ownerSelect) {
        const currentValue = ownerSelect.value;
        ownerSelect.innerHTML = '<option value="">Selecione</option>' + 
            appState.rentalOwners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        if (currentValue) ownerSelect.value = currentValue;
    }
    hideSpinner();
    
    const property = appState.rentalProperties.find(p => p.id === id);
    if (!property) return;

    document.getElementById('property-nickname').value = property.nickname || '';
    document.getElementById('property-owner').value = property.owner_id || '';
    document.getElementById('property-street').value = property.street || '';
    document.getElementById('property-number').value = property.number || '';
    document.getElementById('property-complement').value = property.complement || '';
    document.getElementById('property-neighborhood').value = property.neighborhood || '';
    document.getElementById('property-city').value = property.city || '';
    document.getElementById('property-state').value = property.state || '';
    document.getElementById('property-cep').value = property.cep || '';

    const form = document.getElementById('property-form');
    form.dataset.editingId = id;
    form.scrollIntoView({ behavior: 'smooth' });
};

window.deleteProperty = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este imóvel?')) return;

    showSpinner();
    try {
        await apiClient.deleteItem('rental_properties', id);
        alert('✅ Imóvel excluído com sucesso!');
        
        // RELOAD COMPLETO dos dados
        console.log('🔄 Recarregando dados após exclusão...');
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
        console.log('✅ Dados recarregados:', appState.rentalProperties.length);
        
        renderPropertiesList();
    } catch (error) {
        alert('❌ Erro ao excluir imóvel: ' + error.message);
    } finally {
        hideSpinner();
    }
};

// ==================== CONTRATOS ====================

export async function initRentalContractsTab() {
    console.log('🏠 Inicializando aba de Contratos');
    await loadContracts();
    renderContractsSection();
}

async function loadContracts() {
    showSpinner();
    try {
        // Carregar todos os dados necessários e atribuir ao appState
        appState.rentalContracts = await apiClient.fetchData('rental_contracts');
        appState.rentalContractPayments = await apiClient.fetchData('rental_contract_payments');
        appState.rentalTenants = await apiClient.fetchData('rental_tenants');
        appState.rentalProperties = await apiClient.fetchData('rental_properties');
        appState.rentalOwners = await apiClient.fetchData('rental_owners');
        appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments');
        
        console.log('📊 Contratos carregados:', appState.rentalContracts.length);
    } catch (error) {
        console.error('❌ Erro ao carregar contratos:', error);
        alert('Erro ao carregar dados de contratos');
    } finally {
        hideSpinner();
    }
}

function renderContractsSection() {
    const container = document.getElementById('rental-contracts-container');
    
    container.innerHTML = `
        <button class="btn btn-primary" onclick="showContractForm()">➕ Novo Contrato</button>
        
        <div id="contract-form-area" style="display: none; margin-top: 20px;">
            <h4 id="contract-form-title">Novo Contrato de Aluguel</h4>
            <form id="contract-form" onsubmit="event.preventDefault(); saveContract();">
                <input type="hidden" id="contract-id">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label>Código do Contrato*</label>
                        <input type="text" id="contract-code" readonly style="background: #2a2a2a; color: #fff;" placeholder="Gerado automaticamente">
                    </div>
                    
                    <div>
                        <label>Status*</label>
                        <select id="contract-status" required>
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>
                    
                    <div>
                        <label>Inquilino*</label>
                        <select id="contract-tenant" required>
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    
                    <div>
                        <label>Imóvel*</label>
                        <select id="contract-property" required onchange="loadPropertyPaymentMethods()">
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    
                    <div>
                        <label>Data de Início*</label>
                        <input type="date" id="contract-start-date" required>
                    </div>
                    
                    <div>
                        <label>Período do Contrato (meses)*</label>
                        <input type="text" id="contract-period" placeholder="12 ou 'indeterminado' (vazio = 12 meses)">
                        <small style="color: #666;">Deixe vazio para usar 12 meses como padrão</small>
                    </div>
                    
                    <div>
                        <label>Dia do Vencimento</label>
                        <input type="number" id="contract-due-day" min="1" max="31" placeholder="Ex: 10">
                        <small style="color: #666;">Deixe vazio se não houver dia específico</small>
                    </div>
                    
                    <div>
                        <label>Valor do Aluguel (R$)*</label>
                        <input type="number" id="contract-rent-value" step="0.01" min="0" required>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="margin: 0;">
                            <input type="checkbox" id="contract-is-commercial">
                            Contrato Comercial?
                        </label>
                    </div>
                    
                    <div style="grid-column: 1 / -1;">
                        <label>Observações</label>
                        <textarea id="contract-observations" rows="3" placeholder="Observações adicionais sobre o contrato"></textarea>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="margin: 0;">
                            <input type="checkbox" id="contract-has-deposit" onchange="toggleDepositFields()">
                            Possui Caução?
                        </label>
                    </div>
                    
                    <div id="deposit-fields" style="display: none; grid-column: 1 / -1; background: #2a2a2a; padding: 15px; border-radius: 5px; border: 1px solid #444;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <label>Valor da Caução (R$)</label>
                                <input type="number" id="contract-deposit-value" step="0.01" min="0" placeholder="Deixe vazio para usar valor do aluguel">
                                <small style="color: #666;">Se vazio, será igual ao valor do aluguel</small>
                            </div>
                            
                            <div>
                                <label>Inquilino Pagará a Caução?*</label>
                                <select id="contract-tenant-pays-deposit">
                                    <option value="S">Sim</option>
                                    <option value="N">Não</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="payment-methods-section" style="margin-top: 20px; display: none;">
                    <h5>Formas de Pagamento do Proprietário</h5>
                    <div id="payment-methods-list" style="background: #2a2a2a; padding: 15px; border-radius: 5px; border: 1px solid #444;">
                        <p style="color: #999;">Selecione um imóvel para ver as formas de pagamento</p>
                    </div>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-success">💾 Salvar Contrato</button>
                    <button type="button" class="btn btn-secondary" onclick="cancelContractForm()">❌ Cancelar</button>
                </div>
            </form>
        </div>
        
        <div id="contracts-list" style="margin-top: 30px;"></div>
    `;
    
    // Preencher dropdowns
    populateTenantsDropdown();
    populatePropertiesDropdown();
    
    renderContractsList();
}

function populateTenantsDropdown() {
    const select = document.getElementById('contract-tenant');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    appState.rentalTenants.forEach(tenant => {
        const option = document.createElement('option');
        option.value = tenant.id;
        option.textContent = `${tenant.name} - CPF: ${tenant.cpf}`;
        select.appendChild(option);
    });
    
    if (currentValue) select.value = currentValue;
}

function populatePropertiesDropdown() {
    const select = document.getElementById('contract-property');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    appState.rentalProperties.forEach(property => {
        const owner = appState.rentalOwners.find(o => o.id === property.owner_id);
        const ownerName = owner ? owner.name : 'Proprietário desconhecido';
        
        const option = document.createElement('option');
        option.value = property.id;
        option.textContent = `${property.nickname} - ${property.street}, ${property.number} (${ownerName})`;
        select.appendChild(option);
    });
    
    if (currentValue) select.value = currentValue;
}

window.toggleDepositFields = function() {
    const hasDeposit = document.getElementById('contract-has-deposit').checked;
    const depositFields = document.getElementById('deposit-fields');
    
    if (hasDeposit) {
        depositFields.style.display = 'block';
    } else {
        depositFields.style.display = 'none';
        document.getElementById('contract-deposit-value').value = '';
    }
};

window.loadPropertyPaymentMethods = function() {
    const propertyId = document.getElementById('contract-property').value;
    const methodsSection = document.getElementById('payment-methods-section');
    const methodsList = document.getElementById('payment-methods-list');
    
    if (!propertyId) {
        methodsSection.style.display = 'none';
        return;
    }
    
    const property = appState.rentalProperties.find(p => p.id == propertyId);
    if (!property) return;
    
    const ownerPayments = appState.rentalOwnerPayments.filter(p => p.owner_id === property.owner_id);
    
    if (ownerPayments.length === 0) {
        methodsList.innerHTML = '<p style="color: #ff9800;">⚠️ Este proprietário não possui formas de pagamento cadastradas</p>';
        methodsSection.style.display = 'block';
        return;
    }
    
    let html = '<p style="margin-bottom: 10px; font-weight: bold; color: #fff;">Selecione as formas de pagamento para este contrato:</p>';
    
    ownerPayments.forEach(payment => {
        let details = '';
        if (payment.payment_type === 'PIX' && payment.pix_key) {
            details = `PIX: ${payment.pix_key}`;
        } else if (payment.payment_type === 'Transferência' && payment.bank_name) {
            details = `${payment.bank_name} - Ag: ${payment.agency} - Conta: ${payment.account}`;
        } else {
            details = payment.payment_type;
        }
        
        html += `
            <label style="display: block; padding: 8px; background: #2a2a2a; color: #fff; margin-bottom: 5px; border-radius: 3px; cursor: pointer; border: 1px solid #444;">
                <input type="checkbox" name="payment-method" value="${payment.id}" style="margin-right: 8px;">
                ${details}
            </label>
        `;
    });
    
    methodsList.innerHTML = html;
    methodsSection.style.display = 'block';
};

window.showContractForm = function(contractId = null) {
    const formArea = document.getElementById('contract-form-area');
    const formTitle = document.getElementById('contract-form-title');
    const form = document.getElementById('contract-form');
    
    formArea.style.display = 'block';
    form.reset();
    document.getElementById('contract-id').value = '';
    document.getElementById('deposit-fields').style.display = 'none';
    document.getElementById('payment-methods-section').style.display = 'none';
    
    if (contractId) {
        formTitle.textContent = 'Editar Contrato';
        const contract = appState.rentalContracts.find(c => c.id === contractId);
        if (contract) {
            document.getElementById('contract-id').value = contract.id;
            document.getElementById('contract-code').value = contract.contract_code;
            document.getElementById('contract-status').value = contract.status;
            document.getElementById('contract-tenant').value = contract.tenant_id;
            document.getElementById('contract-property').value = contract.property_id;
            document.getElementById('contract-start-date').value = contract.start_date;
            document.getElementById('contract-period').value = contract.contract_period;
            document.getElementById('contract-rent-value').value = contract.rent_value;
            
            if (contract.has_deposit === 'S') {
                document.getElementById('contract-has-deposit').checked = true;
                toggleDepositFields();
                document.getElementById('contract-deposit-value').value = contract.deposit_value || '';
                document.getElementById('contract-tenant-pays-deposit').value = contract.tenant_will_pay_deposit || 'S';
            }
            
            loadPropertyPaymentMethods();
            
            // Marcar formas de pagamento selecionadas
            const contractPayments = appState.rentalContractPayments.filter(cp => cp.contract_id === contract.id);
            setTimeout(() => {
                contractPayments.forEach(cp => {
                    const checkbox = document.querySelector(`input[name="payment-method"][value="${cp.owner_payment_id}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }, 100);
        }
    } else {
        formTitle.textContent = 'Novo Contrato de Aluguel';
        generateNextContractCode();
    }
    
    formArea.scrollIntoView({ behavior: 'smooth' });
};

async function generateNextContractCode() {
    try {
        // Buscar o maior código existente
        const codes = appState.rentalContracts
            .map(c => parseInt(c.contract_code))
            .filter(n => !isNaN(n));
        
        const maxCode = codes.length > 0 ? Math.max(...codes) : 0;
        const nextCode = (maxCode + 1).toString().padStart(4, '0');
        
        document.getElementById('contract-code').value = nextCode;
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        document.getElementById('contract-code').value = '0001';
    }
}

window.cancelContractForm = function() {
    document.getElementById('contract-form-area').style.display = 'none';
    document.getElementById('contract-form').reset();
};

window.saveContract = async function() {
    const id = document.getElementById('contract-id').value;
    const contractCode = document.getElementById('contract-code').value;
    const status = document.getElementById('contract-status').value;
    const tenantId = document.getElementById('contract-tenant').value;
    const propertyId = document.getElementById('contract-property').value;
    const startDate = document.getElementById('contract-start-date').value;
    let contractPeriod = document.getElementById('contract-period').value;
    const rentValue = document.getElementById('contract-rent-value').value;
    const hasDeposit = document.getElementById('contract-has-deposit').checked ? 'S' : 'N';
    let depositValue = document.getElementById('contract-deposit-value').value;
    const tenantPaysDeposit = document.getElementById('contract-tenant-pays-deposit').value;
    const isCommercial = document.getElementById('contract-is-commercial').checked ? 'S' : 'N';
    const observations = document.getElementById('contract-observations').value;
    const dueDay = document.getElementById('contract-due-day').value;
    
    // Período padrão 12 meses se vazio
    if (!contractPeriod || contractPeriod.trim() === '') {
        contractPeriod = '12';
    }
    
    // Se tem caução mas valor vazio, usar valor do aluguel
    if (hasDeposit === 'S' && !depositValue) {
        depositValue = rentValue;
    }
    
    // Validação
    if (!tenantId || !propertyId || !startDate || !rentValue) {
        alert('❌ Preencha todos os campos obrigatórios!');
        return;
    }
    
    // Pegar formas de pagamento selecionadas
    const selectedPayments = Array.from(document.querySelectorAll('input[name="payment-method"]:checked'))
        .map(cb => cb.value);
    
    if (selectedPayments.length === 0) {
        alert('❌ Selecione pelo menos uma forma de pagamento!');
        return;
    }
    
    showSpinner();
    try {
        const contractData = {
            contract_code: contractCode,
            status,
            tenant_id: tenantId,
            property_id: propertyId,
            start_date: startDate,
            contract_period: contractPeriod,
            rent_value: rentValue,
            has_deposit: hasDeposit,
            deposit_value: hasDeposit === 'S' ? depositValue : null,
            tenant_will_pay_deposit: hasDeposit === 'S' ? tenantPaysDeposit : null,
            is_commercial: isCommercial,
            observations: observations || null,
            due_day: dueDay || null
        };
        
        if (id) contractData.id = id;
        
        // Salvar contrato
        const savedContract = await apiClient.upsertItem('rental_contracts', contractData);
        const contractId = savedContract.id || id;
        
        // Remover formas de pagamento antigas (se editando)
        if (id) {
            const oldPayments = appState.rentalContractPayments.filter(cp => cp.contract_id == id);
            for (const oldPayment of oldPayments) {
                await apiClient.deleteItem('rental_contract_payments', oldPayment.id);
            }
        }
        
        // Salvar novas formas de pagamento
        for (const paymentId of selectedPayments) {
            await apiClient.upsertItem('rental_contract_payments', {
                contract_id: contractId,
                owner_payment_id: paymentId
            });
        }
        
        alert(id ? '✅ Contrato atualizado!' : '✅ Contrato criado!');
        
        // RELOAD FORÇADO DE TODOS OS DADOS RELACIONADOS
        console.log('🔄 Recarregando dados de contratos...');
        appState.rentalContracts = await apiClient.fetchData('rental_contracts') || [];
        appState.rentalContractPayments = await apiClient.fetchData('rental_contract_payments') || [];
        appState.rentalOwnerPayments = await apiClient.fetchData('rental_owner_payments') || [];
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
        appState.rentalOwners = await apiClient.fetchData('rental_owners') || [];
        console.log('✅ Todos os dados recarregados:', {
            contracts: appState.rentalContracts.length,
            contractPayments: appState.rentalContractPayments.length,
            ownerPayments: appState.rentalOwnerPayments.length
        });
        
        renderContractsList();
        cancelContractForm();
        
    } catch (error) {
        alert('❌ Erro ao salvar contrato: ' + error.message);
    } finally {
        hideSpinner();
    }
};

function renderContractsList() {
    const container = document.getElementById('contracts-list');
    
    if (appState.rentalContracts.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Nenhum contrato cadastrado</p>';
        return;
    }
    
    let html = '<h4>Contratos Cadastrados</h4><div class="table-wrapper responsive"><table><thead><tr>';
    html += '<th>Código</th><th>Inquilino</th><th>Imóvel</th><th>Início</th><th>Período</th>';
    html += '<th>Aluguel</th><th>Caução</th><th>Status</th><th>Ações</th>';
    html += '</tr></thead><tbody>';
    
    appState.rentalContracts.forEach(contract => {
        const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
        const property = appState.rentalProperties.find(p => p.id === contract.property_id);
        
        const statusColor = contract.status === 'Ativo' ? 'green' : (contract.status === 'Cancelado' ? 'red' : 'orange');
        
        html += '<tr>';
        html += `<td><strong>${String(contract.contract_code).padStart(4, '0')}</strong></td>`;
        html += `<td>${tenant ? tenant.name : 'N/A'}</td>`;
        html += `<td>${property ? property.nickname : 'N/A'}</td>`;
        html += `<td>${formatDate(contract.start_date)}</td>`;
        html += `<td>${contract.contract_period}</td>`;
        html += `<td>R$ ${parseFloat(contract.rent_value).toFixed(2)}</td>`;
        html += `<td>${contract.has_deposit === 'S' ? 'R$ ' + parseFloat(contract.deposit_value).toFixed(2) : '-'}</td>`;
        html += `<td><span style="color: ${statusColor}; font-weight: bold;">${contract.status}</span></td>`;
        html += `<td style="white-space: nowrap;">
            <button class="btn btn-sm" onclick="viewContract(${contract.id})" title="Ver PDF" style="background: #3a3a3a; color: white; border: 1px solid #555;">📄</button>
            <button class="btn btn-sm" onclick="downloadContractPDFDirect(${contract.id})" title="Baixar PDF" style="background: #4CAF50; color: white;">💾</button>
            <button class="btn btn-sm" onclick="sendContractWhatsAppDirect(${contract.id})" title="WhatsApp" style="background: #25D366; color: white;">📱</button>
            <button class="btn btn-sm" onclick="showContractEmailForm(${contract.id})" title="Email" style="background: #0078D4; color: white;">📧</button>
            <button class="btn btn-sm" onclick="showContractForm(${contract.id})" title="Editar" style="background: #3a3a3a; color: white; border: 1px solid #555;">✏️</button>
            <button class="btn btn-sm" onclick="deleteContract(${contract.id})" title="Excluir" style="background: #d32f2f; color: white;">🗑️</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

window.deleteContract = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return;
    
    showSpinner();
    try {
        // Excluir formas de pagamento associadas
        const contractPayments = appState.rentalContractPayments.filter(cp => cp.contract_id == id);
        for (const cp of contractPayments) {
            await apiClient.deleteItem('rental_contract_payments', cp.id);
        }
        
        // Excluir contrato
        await apiClient.deleteItem('rental_contracts', id);
        
        alert('✅ Contrato excluído com sucesso!');
        await loadContracts();
        renderContractsList();
    } catch (error) {
        alert('❌ Erro ao excluir contrato: ' + error.message);
    } finally {
        hideSpinner();
    }
};

window.viewContract = async function(id) {
    try {
        showSpinner();
        const doc = await generateContractPDF(id);
        
        if (!doc) {
            hideSpinner();
            return;
        }
        
        // Abrir PDF em nova aba
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        
        hideSpinner();
        
    } catch (error) {
        hideSpinner();
        alert('❌ Erro ao gerar PDF: ' + error.message);
        console.error(error);
    }
};

// Função para baixar PDF direto
window.downloadContractPDFDirect = async function(id) {
    try {
        showSpinner();
        const doc = await generateContractPDF(id);
        
        if (!doc) {
            hideSpinner();
            return;
        }
        
        // Importar função de geração de nome
        const { generateContractFileName } = await import('./alugueis_contrato_pdf.js');
        const fileName = generateContractFileName(id);
        
        // Baixar PDF
        doc.save(fileName);
        
        hideSpinner();
        
    } catch (error) {
        hideSpinner();
        alert('❌ Erro ao baixar PDF: ' + error.message);
        console.error(error);
    }
};

function showContractSendOptions(contractId, pdfDoc) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    
    const html = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #2a2a2a; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.8); border: 1px solid #555;
                    z-index: 10000; min-width: 400px;">
            <h3 style="margin-top: 0;">📄 Contrato Nº ${contract.contract_code}</h3>
            <p>O PDF foi aberto em uma nova aba. Escolha uma opção abaixo:</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="downloadContractPDF(${contractId})" style="padding: 12px;">
                    💾 Baixar PDF
                </button>
                
                ${tenant && tenant.phone ? `
                    <button class="btn btn-success" onclick="sendContractWhatsApp(${contractId})" style="padding: 12px;">
                        📱 Enviar via WhatsApp para ${tenant.name}
                    </button>
                ` : '<p style="color: #999; margin: 0;">WhatsApp indisponível (inquilino sem telefone)</p>'}
                
                ${tenant && tenant.email ? `
                    <button class="btn btn-info" onclick="sendContractEmail(${contractId})" style="padding: 12px;">
                        📧 Enviar via Email para ${tenant.email}
                    </button>
                ` : '<p style="color: #999; margin: 0;">Email indisponível (inquilino sem email)</p>'}
                
                <button class="btn btn-secondary" onclick="closeContractOptions()" style="padding: 12px; margin-top: 10px;">
                    ❌ Fechar
                </button>
            </div>
        </div>
        <div id="contract-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                                           background: rgba(0,0,0,0.5); z-index: 9999;" 
             onclick="closeContractOptions()"></div>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'contract-options-container';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    
    // Armazenar o PDF para download posterior
    window.currentContractPDF = pdfDoc;
    window.currentContractId = contractId;
}

window.closeContractOptions = function() {
    const container = document.getElementById('contract-options-container');
    if (container) {
        container.remove();
    }
    window.currentContractPDF = null;
    window.currentContractId = null;
};

window.downloadContractPDF = function(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    if (!window.currentContractPDF) {
        alert('❌ Erro: PDF não disponível');
        return;
    }
    
    const filename = `Contrato_${contract.contract_code}_${contract.tenant_id}.pdf`;
    window.currentContractPDF.save(filename);
    
    alert('✅ PDF baixado com sucesso!');
    closeContractOptions();
};

window.sendContractWhatsApp = async function(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    const property = appState.rentalProperties.find(p => p.id === contract.property_id);
    
    if (!tenant || !tenant.phone) {
        alert('❌ Telefone do inquilino não cadastrado!');
        return;
    }
    
    // Formatar telefone (remover caracteres não numéricos)
    const phoneClean = tenant.phone.replace(/\D/g, '');
    
    // Mensagem WhatsApp
    const propertyAddress = `${property.street}, ${property.number}, ${property.neighborhood}, ${property.city}/${property.state}`;
    const valorAluguel = parseFloat(contract.rent_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let message = `Olá ${tenant.name}!%0A%0A`;
    message += `Segue o *Contrato de Locação Nº ${contract.contract_code}*%0A%0A`;
    message += `📍 *Imóvel:* ${propertyAddress}%0A`;
    message += `💰 *Valor:* R$ ${valorAluguel}/mês%0A`;
    message += `📅 *Início:* ${formatDateBR(contract.start_date)}%0A`;
    message += `⏱️ *Período:* ${contract.contract_period === 'indeterminado' ? 'Indeterminado' : contract.contract_period + ' meses'}%0A%0A`;
    
    if (contract.has_deposit === 'S') {
        const valorCaucao = parseFloat(contract.deposit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        message += `🔒 *Caução:* R$ ${valorCaucao}%0A%0A`;
    }
    
    message += `O contrato completo foi gerado em PDF.%0A`;
    message += `Por favor, faça o download, leia atentamente e assine.%0A%0A`;
    message += `Em caso de dúvidas, estou à disposição!`;
    
    // Abrir WhatsApp
    const whatsappUrl = `https://wa.me/55${phoneClean}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    alert('✅ WhatsApp aberto! Não esqueça de anexar o PDF ao enviar a mensagem.');
    closeContractOptions();
};

window.sendContractEmail = async function(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    const property = appState.rentalProperties.find(p => p.id === contract.property_id);
    
    if (!tenant || !tenant.email) {
        alert('❌ Email do inquilino não cadastrado!');
        return;
    }
    
    // Gerar PDF como base64
    if (!window.currentContractPDF) {
        alert('❌ Erro: PDF não disponível');
        return;
    }
    
    const pdfBase64 = window.currentContractPDF.output('dataurlstring').split(',')[1];
    const filename = `Contrato_${contract.contract_code}.pdf`;
    
    // Preparar dados do email
    const propertyAddress = `${property.street}, ${property.number}, ${property.neighborhood}, ${property.city}/${property.state}`;
    const valorAluguel = parseFloat(contract.rent_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let emailBody = `Olá ${tenant.name}!\n\n`;
    emailBody += `Segue em anexo o Contrato de Locação Nº ${contract.contract_code}.\n\n`;
    emailBody += `DADOS DO CONTRATO:\n`;
    emailBody += `📍 Imóvel: ${propertyAddress}\n`;
    emailBody += `💰 Valor: R$ ${valorAluguel}/mês\n`;
    emailBody += `📅 Início: ${formatDateBR(contract.start_date)}\n`;
    emailBody += `⏱️ Período: ${contract.contract_period === 'indeterminado' ? 'Indeterminado' : contract.contract_period + ' meses'}\n`;
    
    if (contract.has_deposit === 'S') {
        const valorCaucao = parseFloat(contract.deposit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        emailBody += `🔒 Caução: R$ ${valorCaucao}\n`;
    }
    
    emailBody += `\nPor favor, leia o contrato atentamente e assine.\n\n`;
    emailBody += `Em caso de dúvidas, estou à disposição!\n\n`;
    emailBody += `Atenciosamente.`;
    
    showSpinner();
    
    try {
        const response = await fetch('send_email.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: tenant.email,
                subject: `Contrato de Locação Nº ${contract.contract_code}`,
                body: emailBody,
                attachment: {
                    filename: filename,
                    content: pdfBase64
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Email enviado com sucesso para ' + tenant.email);
            closeContractOptions();
        } else {
            alert('❌ Erro ao enviar email: ' + result.message);
        }
        
    } catch (error) {
        alert('❌ Erro ao enviar email: ' + error.message);
        console.error(error);
    } finally {
        hideSpinner();
    }
};

function formatDateBR(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Função para enviar contrato por WhatsApp diretamente (número fixo)
window.sendContractWhatsAppDirect = async function(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
    const property = appState.rentalProperties.find(p => p.id === contract.property_id);
    
    if (!contract || !tenant || !property) {
        alert('❌ Dados incompletos!');
        return;
    }
    
    showSpinner();
    
    try {
        // Gerar PDF
        const doc = await generateContractPDF(contractId);
        if (!doc) {
            hideSpinner();
            return;
        }
        
        // Converter para base64
        const pdfBase64 = doc.output('dataurlstring').split(',')[1];
        const filename = `Contrato_${contract.contract_code}_${Date.now()}.pdf`;
        
        // Fazer upload do PDF para o servidor
        const uploadResponse = await fetch('api/upload_contract_pdf.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename,
                pdfBase64: pdfBase64
            })
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
            throw new Error(uploadResult.message || 'Erro ao fazer upload do PDF');
        }
        
        hideSpinner();
        
        // Número fixo do WhatsApp
        const phoneClean = '5587991034022';
        
        // Mensagem WhatsApp com link do PDF
        const propertyAddress = `${property.street}, ${property.number}, ${property.neighborhood}, ${property.city}/${property.state}`;
        const valorAluguel = parseFloat(contract.rent_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        let message = `📄 *CONTRATO DE ALUGUEL Nº ${contract.contract_code}*%0A%0A`;
        message += `👤 *Inquilino:* ${tenant.name}%0A`;
        message += `📍 *Imóvel:* ${propertyAddress}%0A`;
        message += `💰 *Valor:* R$ ${valorAluguel}/mês%0A`;
        message += `📅 *Início:* ${formatDateBR(contract.start_date)}%0A`;
        message += `⏱️ *Período:* ${contract.contract_period === 'indeterminado' ? 'Indeterminado' : contract.contract_period + ' meses'}%0A`;
        
        if (contract.has_deposit === 'S') {
            const valorCaucao = parseFloat(contract.deposit_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            message += `🔒 *Caução:* R$ ${valorCaucao}%0A`;
        }
        
        message += `%0A%0A📎 *Baixe o contrato completo aqui:*%0A${uploadResult.url}%0A%0A`;
        message += `_Clique no link acima para visualizar e assinar o contrato_`;
        
        // Abrir WhatsApp
        const whatsappUrl = `https://wa.me/${phoneClean}?text=${message}`;
        window.open(whatsappUrl, '_blank');
        
    } catch (error) {
        hideSpinner();
        alert('❌ Erro ao enviar WhatsApp: ' + error.message);
        console.error(error);
    }
};

// Função para mostrar formulário de emails
window.showContractEmailForm = function(contractId) {
    const contract = appState.rentalContracts.find(c => c.id === contractId);
    if (!contract) return;
    
    const html = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #2a2a2a; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    z-index: 10000; min-width: 500px; color: white;">
            <h3 style="margin-top: 0;">📧 Enviar Contrato por Email</h3>
            <p style="color: #ccc;">Digite os emails separados por vírgula:</p>
            
            <textarea id="contract-emails" rows="4" style="width: 100%; padding: 10px; border-radius: 5px; 
                      background: #1a1a1a; color: white; border: 1px solid #555;" 
                      placeholder="email1@example.com, email2@example.com"></textarea>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="sendContractToEmails(${contractId})" style="flex: 1; padding: 12px;">
                    📧 Enviar
                </button>
                <button class="btn btn-secondary" onclick="closeEmailForm()" style="flex: 1; padding: 12px;">
                    ❌ Cancelar
                </button>
            </div>
        </div>
        <div id="email-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                                        background: rgba(0,0,0,0.7); z-index: 9999;" 
             onclick="closeEmailForm()"></div>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'email-form-container';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

window.closeEmailForm = function() {
    const container = document.getElementById('email-form-container');
    if (container) {
        container.remove();
    }
};

window.sendContractToEmails = async function(contractId) {
    const emailsText = document.getElementById('contract-emails').value.trim();
    if (!emailsText) {
        alert('❌ Digite pelo menos um email!');
        return;
    }
    
    const emails = emailsText.split(',').map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
        alert('❌ Nenhum email válido!');
        return;
    }
    
    // Gerar PDF
    showSpinner();
    try {
        const doc = await generateContractPDF(contractId);
        if (!doc) {
            hideSpinner();
            return;
        }
        
        const pdfBase64 = doc.output('dataurlstring').split(',')[1];
        const contract = appState.rentalContracts.find(c => c.id === contractId);
        const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
        const property = appState.rentalProperties.find(p => p.id === contract.property_id);
        
        const filename = `Contrato_${contract.contract_code}.pdf`;
        const propertyAddress = `${property.street}, ${property.number}, ${property.neighborhood}, ${property.city}/${property.state}`;
        const valorAluguel = parseFloat(contract.rent_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        let emailBody = `Contrato de Locação Nº ${contract.contract_code}\n\n`;
        emailBody += `Inquilino: ${tenant.name}\n`;
        emailBody += `Imóvel: ${propertyAddress}\n`;
        emailBody += `Valor: R$ ${valorAluguel}/mês\n`;
        emailBody += `Início: ${formatDateBR(contract.start_date)}\n\n`;
        emailBody += `Segue em anexo o contrato completo.\n\n`;
        emailBody += `Atenciosamente.`;
        
        // Enviar para cada email
        let successCount = 0;
        for (const email of emails) {
            try {
                const response = await fetch('send_email.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        to: email,
                        subject: `Contrato de Locação Nº ${contract.contract_code}`,
                        body: emailBody,
                        attachment: {
                            filename: filename,
                            content: pdfBase64
                        }
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    successCount++;
                }
            } catch (error) {
                console.error('Erro ao enviar para', email, error);
            }
        }
        
        if (successCount > 0) {
            alert(`✅ Email enviado com sucesso para ${successCount} de ${emails.length} destinatário(s)!`);
            closeEmailForm();
        } else {
            alert('❌ Não foi possível enviar para nenhum destinatário');
        }
        
    } catch (error) {
        alert('❌ Erro ao enviar emails: ' + error.message);
        console.error(error);
    } finally {
        hideSpinner();
    }
};

/**
 * 🏠 ALERTA DE CONTRATOS PRÓXIMOS DO VENCIMENTO (30 dias ou menos)
 */
export const generateRentalExpiringAlert = async () => {
    console.log('🏠 INICIANDO ALERTA DE CONTRATOS...');
    const alertContainer = document.getElementById('rental-expiring-alert');
    if (!alertContainer) {
        console.warn('⚠️ Elemento rental-expiring-alert não encontrado');
        return;
    }

    // Carregar contratos se necessário
    if (!appState.rentalContracts || appState.rentalContracts.length === 0) {
        appState.rentalContracts = await apiClient.fetchData('rental_contracts') || [];
    }
    if (!appState.rentalTenants || appState.rentalTenants.length === 0) {
        appState.rentalTenants = await apiClient.fetchData('rental_tenants') || [];
    }
    if (!appState.rentalProperties || appState.rentalProperties.length === 0) {
        appState.rentalProperties = await apiClient.fetchData('rental_properties') || [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiringContracts = [];

    for (const contract of appState.rentalContracts) {
        // Apenas contratos ativos
        if (contract.status !== 'Ativo') continue;
        
        // Pular contratos indeterminados
        if (contract.contract_period === 'indeterminado') continue;
        
        // Calcular data de vencimento
        const startDate = new Date(contract.start_date + 'T00:00:00');
        const months = parseInt(contract.contract_period);
        if (isNaN(months)) continue;
        
        const expiryDate = new Date(startDate);
        expiryDate.setMonth(expiryDate.getMonth() + months);
        
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Se falta 30 dias ou menos (e não venceu ainda)
        if (diffDays >= 0 && diffDays <= 30) {
            const tenant = appState.rentalTenants.find(t => t.id === contract.tenant_id);
            const property = appState.rentalProperties.find(p => p.id === contract.property_id);
            
            expiringContracts.push({
                contractCode: contract.contract_code,
                tenantName: tenant ? tenant.name : 'N/A',
                propertyNickname: property ? property.nickname : 'N/A',
                expiryDate: expiryDate.toISOString().split('T')[0],
                daysLeft: diffDays,
                rentValue: contract.rent_value
            });
        }
    }

    if (expiringContracts.length === 0) {
        alertContainer.style.display = 'none';
        console.log('✅ Nenhum contrato próximo do vencimento');
        return;
    }

    // Ordena por dias restantes (mais urgente primeiro)
    expiringContracts.sort((a, b) => a.daysLeft - b.daysLeft);

    let alertHTML = `
        <div class="bm-closing-alert-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-left: 5px solid #ff6b6b;">
            <h3 style="margin: 0 0 15px 0; color: white; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5em;">🏠</span>
                <span>ATENÇÃO: Contratos Próximos do Vencimento!</span>
            </h3>
            <div class="bm-closing-list">
    `;

    expiringContracts.forEach(contract => {
        const urgencyColor = contract.daysLeft <= 7 ? '#ff6b6b' : (contract.daysLeft <= 15 ? '#ffa500' : '#4CAF50');
        const urgencyIcon = contract.daysLeft <= 7 ? '🚨' : (contract.daysLeft <= 15 ? '⚠️' : '📅');
        
        alertHTML += `
            <div class="bm-item" style="background: rgba(255,255,255,0.95); border-left: 4px solid ${urgencyColor};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 1.1em; color: #333;">Contrato ${contract.contractCode}</strong>
                        <p style="margin: 5px 0; color: #666;">
                            <strong>Inquilino:</strong> ${contract.tenantName}<br>
                            <strong>Imóvel:</strong> ${contract.propertyNickname}<br>
                            <strong>Valor:</strong> R$ ${parseFloat(contract.rentValue).toFixed(2)}/mês
                        </p>
                    </div>
                    <div style="text-align: right; padding-left: 20px;">
                        <div style="background: ${urgencyColor}; color: white; padding: 10px 15px; border-radius: 50px; font-weight: bold; white-space: nowrap;">
                            ${urgencyIcon} ${contract.daysLeft} ${contract.daysLeft === 1 ? 'dia' : 'dias'}
                        </div>
                        <small style="color: #666; display: block; margin-top: 5px;">Vence em ${formatDateBR(contract.expiryDate)}</small>
                    </div>
                </div>
            </div>
        `;
    });

    alertHTML += `
            </div>
        </div>
    `;

    alertContainer.innerHTML = alertHTML;
    alertContainer.style.display = 'block';
    console.log('✅ Alerta de contratos exibido:', expiringContracts.length);
};
