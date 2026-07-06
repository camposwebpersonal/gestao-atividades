// lancamentos_pagamento_bm.js - VERSÃO COMPLETA CORRIGIDA
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, openModal, closeModal } from './utils.js';
import { apiClient } from './api.js';

const bmPaymentWorkSelect = document.getElementById('bm-payment-work-select');
const bmPaymentDateInput = document.getElementById('bm-payment-date');
const bmPaymentTypeSelect = document.getElementById('bm-payment-type');
const bmPaymentAmountInput = document.getElementById('bm-payment-amount');
const bmPaymentNotesInput = document.getElementById('bm-payment-notes');
const addBmPaymentBtn = document.getElementById('add-bm-payment-btn');
const bmPaymentsTableBody = document.querySelector('#bm-payments-table tbody');

/**
 * Inicializa a sub-seção de Lançamentos de Pagamento de BM.
 * Carrega os dados iniciais e configura os event listeners.
 */
export const initBmPayments = async () => {
    showSpinner();
    try {
        console.log('🚀 Inicializando pagamentos BM...');
        
        // Garante que as obras estejam carregadas para popular o dropdown
        if (appState.works.length === 0) {
            appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        }

        // CORREÇÃO: Carrega todos os pagamentos de BM no appState com debug
        console.log('📊 Carregando pagamentos do banco...');
        const allPayments = await apiClient.fetchData('bm_payments');
        
        console.log(`✅ ${allPayments.length} pagamentos carregados do banco:`);
        allPayments.forEach((payment, index) => {
            console.log(`   ${index + 1}. ID: ${payment.id}, Work: ${payment.work_id}, Amount: ${payment.amount} (${typeof payment.amount})`);
        });
        
        // Processa e garante que amounts sejam números
        appState.bm_payments = allPayments.map(payment => ({
            ...payment,
            amount: payment.amount ? parseFloat(payment.amount) : 0
        }));

        if (bmPaymentWorkSelect) {
            bmPaymentWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
                appState.works.map(w => `<option value="${w.id}">${w.name} - ${w.client_companies?.name || 'N/A'}</option>`).join('');
            bmPaymentWorkSelect.addEventListener('change', handleBmWorkSelectChange);
        }
        if (addBmPaymentBtn) {
            addBmPaymentBtn.addEventListener('click', addBmPayment);
        }

        // Inicializa a tabela vazia
        if (bmPaymentsTableBody) bmPaymentsTableBody.innerHTML = '';

        console.log('✅ Inicialização dos pagamentos BM concluída');

    } catch (error) {
        console.error("❌ Erro ao inicializar pagamentos de BM:", error);
        alert(`Erro ao carregar dados: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Lida com a mudança na seleção da obra para lançamentos de pagamento de BM.
 * Carrega e exibe os pagamentos existentes para a obra selecionada.
 */
const handleBmWorkSelectChange = () => {
    const workId = bmPaymentWorkSelect.value;
    console.log(`🔄 Obra selecionada: ${workId}`);
    
    if (bmPaymentsTableBody) bmPaymentsTableBody.innerHTML = '';

    if (workId) {
        loadBmPayments(workId);
    }
};

/**
 * Adiciona um novo lançamento de pagamento de BM ao banco de dados.
 */
const addBmPayment = async () => {
    const workId = bmPaymentWorkSelect?.value;
    const paymentDate = bmPaymentDateInput?.value;
    const paymentType = bmPaymentTypeSelect?.value || 'Outros';
    const amountRaw = bmPaymentAmountInput?.value;
    const amount = parseFloat(amountRaw?.replace(/[^\d,.-]/g, '').replace(',', '.') || '0');
    const notes = bmPaymentNotesInput?.value || null;

    // DEBUG: Verificar valores antes de salvar
    console.log('🔍 DEBUG NOVO PAGAMENTO BM:');
    console.log('   Work ID:', workId);
    console.log('   Payment Date:', paymentDate);
    console.log('   Payment Type:', paymentType);
    console.log('   Amount Raw:', amountRaw);
    console.log('   Amount Parsed:', amount);
    console.log('   Amount Type:', typeof amount);
    console.log('   Amount Valid?', !isNaN(amount) && amount > 0);
    console.log('   Notes:', notes);

    // Validações
    if (!workId) {
        alert('Por favor, selecione uma obra.');
        return;
    }
    if (!paymentDate) {
        alert('Por favor, informe a data do pagamento.');
        return;
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
        alert(`Valor inválido: "${amountRaw}" → ${amount}.\nPor favor, informe um valor válido maior que zero.`);
        return;
    }

    const paymentData = {
        work_id: workId,
        payment_date: paymentDate,
        payment_type: paymentType,
        amount: amount, // Garante que é number
        notes: notes
    };

    console.log('📤 Dados sendo enviados para API:', paymentData);

    showSpinner();
    try {
        const newPayment = await apiClient.addItem('bm_payments', paymentData);
        
        console.log('📥 Resposta da API (novo pagamento):', newPayment);
        
        // CORREÇÃO: Garante que o amount seja number e atualiza appState
        const processedPayment = {
            ...newPayment,
            amount: typeof newPayment.amount === 'string' ? parseFloat(newPayment.amount) : newPayment.amount
        };
        
        if (!appState.bm_payments) {
            appState.bm_payments = [];
        }
        appState.bm_payments.push(processedPayment);
        
        console.log('✅ Pagamento adicionado ao appState:', processedPayment);
        
        alert('Pagamento de BM adicionado com sucesso!');
        await loadBmPayments(workId);
        
        // Limpar formulário
        clearForm();
        
    } catch (e) {
        console.error("❌ Erro ao adicionar pagamento de BM:", e);
        alert(`Erro ao adicionar pagamento de BM: ${e.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Limpa o formulário após adicionar um pagamento
 */
const clearForm = () => {
    if (bmPaymentDateInput) bmPaymentDateInput.value = '';
    if (bmPaymentTypeSelect) bmPaymentTypeSelect.value = '';
    if (bmPaymentAmountInput) bmPaymentAmountInput.value = '';
    if (bmPaymentNotesInput) bmPaymentNotesInput.value = '';
};

/**
 * Carrega os lançamentos de pagamento de BM para uma obra específica.
 * @param {string} workId - ID da obra.
 */
const loadBmPayments = async (workId) => {
    console.log(`📊 Carregando pagamentos para obra ${workId}...`);
    showSpinner();
    try {
        // CORREÇÃO: Busca diretamente da API para garantir dados atualizados
        let data;
        
        // Verifica se existe a função específica fetchBmPayments
        if (typeof apiClient.fetchBmPayments === 'function') {
            console.log('   📡 Usando fetchBmPayments específica...');
            data = await apiClient.fetchBmPayments(workId);
        } else {
            console.log('   📡 Usando fetchData genérica...');
            const allPayments = await apiClient.fetchData('bm_payments');
            data = allPayments.filter(p => p.work_id == workId);
        }
        
        console.log(`📊 ${data.length} pagamentos encontrados para obra ${workId}:`);
        data.forEach((payment, index) => {
            console.log(`   ${index + 1}. ID: ${payment.id}, Amount: ${payment.amount} (${typeof payment.amount}), Date: ${payment.payment_date}`);
        });
        
        // CORREÇÃO: Processa e garante que todos os amounts sejam números
        const processedData = data.map(payment => {
            const processedAmount = payment.amount ? parseFloat(payment.amount) : 0;
            console.log(`   🔧 Processando pagamento ${payment.id}: ${payment.amount} → ${processedAmount}`);
            return {
                ...payment,
                amount: processedAmount
            };
        });
        
        // Atualiza o appState com os dados processados
        appState.bm_payments = appState.bm_payments || [];
        appState.bm_payments = appState.bm_payments.filter(p => p.work_id != workId);
        appState.bm_payments.push(...processedData);
        
        console.log('✅ AppState atualizado com pagamentos processados');
        
        renderBmPaymentsTable(processedData);
        
    } catch (e) {
        console.error("❌ Erro ao carregar pagamentos de BM:", e);
        if (bmPaymentsTableBody) {
            bmPaymentsTableBody.innerHTML = '<tr><td colspan="5" style="color: red; text-align: center;">❌ Erro ao carregar pagamentos</td></tr>';
        }
    } finally {
        hideSpinner();
    }
};

/**
 * Renderiza a tabela de pagamentos de BM.
 * @param {Array<Object>} payments - Lista de pagamentos de BM.
 */
const renderBmPaymentsTable = (payments) => {
    console.log(`🎨 Renderizando tabela com ${payments.length} pagamentos...`);
    
    if (!bmPaymentsTableBody) {
        console.warn('⚠️ Elemento bmPaymentsTableBody não encontrado');
        return;
    }
    
    bmPaymentsTableBody.innerHTML = '';
    
    if (payments.length === 0) {
        bmPaymentsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">Nenhum pagamento de BM para esta obra.</td></tr>';
        return;
    }

    let totalRendered = 0;
    payments.forEach((payment, index) => {
        try {
            // DEBUG: Verificar cada pagamento antes de renderizar
            const amountValue = payment.amount;
            const amountType = typeof amountValue;
            const isValidAmount = amountValue !== null && amountValue !== undefined && !isNaN(amountValue) && amountValue !== 0;
            
            console.log(`🔍 Renderizando pagamento ${index + 1}:`, {
                id: payment.id,
                amount: amountValue,
                type: amountType,
                isValid: isValidAmount,
                date: payment.payment_date,
                formatted: formatCurrency(amountValue || 0)
            });

            const formattedAmount = formatCurrency(amountValue || 0);
            const formattedDate = payment.payment_date ? 
                new Date(payment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR') : 
                'Data inválida';

            const row = document.createElement('tr');
            
            // Adiciona classe de aviso se o valor for zero ou inválido
            if (!isValidAmount) {
                row.style.backgroundColor = '#fff3cd';
                row.style.borderLeft = '4px solid #856404';
            }
            
            row.innerHTML = `
                <td data-label="Data">${formattedDate}</td>
                <td data-label="Tipo">${payment.payment_type || 'N/A'}</td>
                <td data-label="Valor" style="font-weight: bold; ${!isValidAmount ? 'color: #856404;' : 'color: #28a745;'}">${formattedAmount}</td>
                <td data-label="Observações">${payment.notes || '---'}</td>
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-danger btn-sm" data-id="${payment.id}" data-action="delete-bm-payment" title="Excluir pagamento">Excluir</button>
                    <button class="btn btn-info btn-sm" onclick="debugSinglePayment('${payment.id}')" title="Debug este pagamento">🔍</button>
                </td>
            `;
            
            bmPaymentsTableBody.appendChild(row);
            totalRendered++;
            
        } catch (error) {
            console.error(`❌ Erro ao renderizar pagamento ${index + 1}:`, error, payment);
            
            // Adiciona linha de erro
            const errorRow = document.createElement('tr');
            errorRow.style.backgroundColor = '#f8d7da';
            errorRow.innerHTML = `
                <td colspan="5" style="color: #721c24; text-align: center;">
                    ❌ Erro ao renderizar pagamento ID: ${payment.id || 'N/A'}
                </td>
            `;
            bmPaymentsTableBody.appendChild(errorRow);
        }
    });

    console.log(`✅ ${totalRendered} pagamentos renderizados com sucesso`);

    // Adiciona event listeners para botões de excluir
    bmPaymentsTableBody.querySelectorAll('[data-action="delete-bm-payment"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const paymentId = e.target.dataset.id;
            console.log(`🗑️ Solicitação de exclusão do pagamento: ${paymentId}`);
            
            openModal('Confirmar Exclusão', createConfirmationModal(() => {
                deleteBmPayment(paymentId, bmPaymentWorkSelect.value);
            }));
        });
    });
};

/**
 * Função auxiliar para criar um modal de confirmação.
 * @param {Function} onConfirm - Função a ser executada se o usuário confirmar.
 * @returns {HTMLElement} O elemento do modal de confirmação.
 */
const createConfirmationModal = (onConfirm) => {
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">⚠️</div>
            <p style="font-size: 16px; margin-bottom: 20px;">Tem certeza que deseja excluir este pagamento?</p>
            <p style="font-size: 14px; color: #666; margin-bottom: 30px;">Esta ação não pode ser desfeita.</p>
            <div class="modal-footer" style="justify-content: center; gap: 15px;">
                <button class="btn btn-secondary" id="cancel-delete-btn">Cancelar</button>
                <button class="btn btn-danger" id="confirm-delete-btn">🗑️ Excluir</button>
            </div>
        </div>
    `;
    
    modalContent.querySelector('#cancel-delete-btn').addEventListener('click', closeModal);
    modalContent.querySelector('#confirm-delete-btn').addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    
    return modalContent;
};

/**
 * Exclui um lançamento de pagamento de BM do banco de dados.
 * @param {string} id - ID do pagamento a ser excluído.
 * @param {string} workId - ID da obra à qual o pagamento pertence (para recarregar a lista).
 */
const deleteBmPayment = async (id, workId) => {
    console.log(`🗑️ Excluindo pagamento ${id} da obra ${workId}...`);
    showSpinner();
    try {
        await apiClient.deleteItem('bm_payments', id);
        
        // CORREÇÃO: Remove do appState também
        if (appState.bm_payments) {
            const initialLength = appState.bm_payments.length;
            appState.bm_payments = appState.bm_payments.filter(p => p.id != id);
            console.log(`✅ Removido do appState: ${initialLength} → ${appState.bm_payments.length}`);
        }
        
        alert('Pagamento excluído com sucesso!');
        await loadBmPayments(workId);
        
    } catch (err) {
        console.error("❌ Erro ao excluir pagamento de BM:", err);
        alert(`Erro ao excluir pagamento: ${err.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Função de debug para investigar problemas com pagamentos específicos
 * @param {string} paymentId - ID do pagamento para debug
 */
window.debugSinglePayment = (paymentId) => {
    console.log('🔍 DEBUG PAGAMENTO ESPECÍFICO:', paymentId);
    
    // Procura o pagamento no appState
    const paymentInAppState = appState.bm_payments?.find(p => p.id == paymentId);
    console.log('   No appState:', paymentInAppState);
    
    // Busca direto do banco
    apiClient.fetchData('bm_payments')
        .then(allPayments => {
            const paymentInDB = allPayments.find(p => p.id == paymentId);
            console.log('   No banco:', paymentInDB);
            
            if (paymentInDB && paymentInAppState) {
                console.log('   Comparação:');
                console.log(`     Amount DB: ${paymentInDB.amount} (${typeof paymentInDB.amount})`);
                console.log(`     Amount App: ${paymentInAppState.amount} (${typeof paymentInAppState.amount})`);
                console.log(`     São iguais? ${paymentInDB.amount === paymentInAppState.amount}`);
            }
        })
        .catch(error => console.error('Erro no debug:', error));
};

/**
 * Função de debug geral para investigar problemas
 * @param {string} workId - ID da obra (opcional)
 */
export const debugBmPayments = (workId = null) => {
    console.log('🔍 DEBUG COMPLETO PAGAMENTOS BM:');
    console.log('='.repeat(50));
    
    if (workId) {
        console.log('Work ID:', workId);
        const workPayments = appState.bm_payments?.filter(p => p.work_id == workId) || [];
        console.log(`Pagamentos desta obra no appState: ${workPayments.length}`);
        workPayments.forEach((payment, index) => {
            console.log(`  ${index + 1}. ID: ${payment.id}, Amount: ${payment.amount} (${typeof payment.amount}), Date: ${payment.payment_date}`);
        });
    } else {
        console.log('Todos os pagamentos no appState:', appState.bm_payments?.length || 0);
        appState.bm_payments?.forEach((payment, index) => {
            console.log(`  ${index + 1}. Work: ${payment.work_id}, ID: ${payment.id}, Amount: ${payment.amount} (${typeof payment.amount})`);
        });
    }
    
    // Debug form atual
    if (bmPaymentAmountInput) {
        console.log('Input atual:', {
            value: bmPaymentAmountInput.value,
            parsed: parseFloat(bmPaymentAmountInput.value || '0'),
            type: typeof parseFloat(bmPaymentAmountInput.value || '0')
        });
    }
    
    console.log('='.repeat(50));
};

// Exporta a função de debug para uso no console
window.debugBmPayments = debugBmPayments;