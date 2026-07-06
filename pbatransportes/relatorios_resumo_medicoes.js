// relatorios_resumo_medicoes.js - VERSÃO COM STATUS SALVOS NO BANCO DE DADOS
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency , sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';
import { exportSummaryMeasurementsToPDF } from './relatorios_resumo_medicoes_pdf.js';
import { calculateEquipmentTotalValue, calculateGeneralExpensesImpact, EXPENSE_IMPACT_TYPES } from './calculos_valores.js?v=20260302090000';

// Utilitário de arredondamento preciso (mesma lógica do relatório de medição)
const preciseRounding = {
    round2(value) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    formatCurrencyPrecise(value) {
        const rounded = this.round2(value);
        return formatCurrency(rounded);
    },
    sumPrecise(...values) {
        const numbers = values.map(val => {
            if (typeof val === 'number' && !isNaN(val)) return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        });
        const sum = numbers.reduce((acc, val) => acc + val, 0);
        return this.round2(sum);
    },
    multiplyPrecise(value1, value2) {
        const num1 = typeof value1 === 'number' ? value1 : parseFloat(value1) || 0;
        const num2 = typeof value2 === 'number' ? value2 : parseFloat(value2) || 0;
        const result = num1 * num2;
        return this.round2(result);
    }
};

const summaryMeasurementsReportWorkSelect = document.getElementById('summary-measurements-report-work-select');
const generateSummaryMeasurementsReportBtn = document.getElementById('generate-summary-measurements-report-btn');
const exportSummaryMeasurementsPdfBtn = document.getElementById('export-summary-measurements-pdf-btn');
const summaryMeasurementsReportOutput = document.getElementById('summary-measurements-report-output');
const includePaymentsCheckbox = document.getElementById('include-payments-checkbox');

// URL base da sua API
const API_BASE_URL = 'https://pbatransportes.com.br/proj/api/api.php';

/**
 * Busca os status dos BMs do banco de dados
 */
const fetchBmStatusFromDatabase = async (workId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/fetchBmStatus?workId=${workId}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao buscar status');
        }
        
        return result.data || [];
    } catch (error) {
        console.error("❌ Erro ao buscar status dos BMs:", error);
        return [];
    }
};

/**
 * Salva o status de um BM no banco de dados
 */
const saveBmStatusToDatabase = async (workId, bmIndex, status, paymentStatus) => {
    try {
        const response = await fetch(`${API_BASE_URL}/saveBmStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                work_id: workId,
                bm_index: bmIndex,
                status: status,
                payment_status: paymentStatus
            })
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao salvar status');
        }

        console.log(`✅ Status do BM ${bmIndex} da obra ${workId} salvo com sucesso.`);
        return true;
        
    } catch (error) {
        console.error("❌ Erro ao salvar status do BM:", error);
        alert("Não foi possível salvar as alterações. Verifique sua conexão e tente novamente.");
        return false;
    }
};

/**
 * Manipula o clique nos botões de status ('A EMITIR' / 'EMITIDO')
 */
const handleStatusToggle = async (event) => {
    const button = event.target;
    const workId = parseInt(button.dataset.workId);
    const bmIndex = parseInt(button.dataset.bmIndex);

    showSpinner();

    try {
        // Busca o status atual do banco
        const bmStatuses = await fetchBmStatusFromDatabase(workId);
        const currentBm = bmStatuses.find(bm => bm.bm_index === bmIndex);
        
        const currentStatus = currentBm ? currentBm.status : 'A EMITIR';
        const newStatus = currentStatus === 'EMITIDO' ? 'A EMITIR' : 'EMITIDO';
        
        // Se voltar para 'A EMITIR', o pagamento também deve ser resetado para 'A PAGAR'
        let paymentStatus = currentBm ? currentBm.payment_status : 'A PAGAR';
        if (newStatus === 'A EMITIR') {
            paymentStatus = 'A PAGAR';
        }
        
        // Salva no banco
        const saved = await saveBmStatusToDatabase(workId, bmIndex, newStatus, paymentStatus);
        
        if (saved) {
            // Regera o relatório para refletir a mudança
            await generateSummaryMeasurementsReport();
        }
    } catch (error) {
        console.error("Erro ao alternar status:", error);
        alert("Erro ao alterar status. Tente novamente.");
    } finally {
        hideSpinner();
    }
};

/**
 * Manipula o clique nos botões de pagamento ('A PAGAR' / 'PAGO')
 */
const handlePaymentToggle = async (event) => {
    const button = event.target;
    const workId = parseInt(button.dataset.workId);
    const bmIndex = parseInt(button.dataset.bmIndex);

    showSpinner();

    try {
        // Busca o status atual do banco
        const bmStatuses = await fetchBmStatusFromDatabase(workId);
        const currentBm = bmStatuses.find(bm => bm.bm_index === bmIndex);
        
        if (!currentBm || currentBm.status !== 'EMITIDO') {
            alert('Este BM precisa estar EMITIDO antes de marcar como PAGO.');
            hideSpinner();
            return;
        }
        
        const currentPaymentStatus = currentBm.payment_status;
        const newPaymentStatus = currentPaymentStatus === 'PAGO' ? 'A PAGAR' : 'PAGO';
        
        // Salva no banco
        const saved = await saveBmStatusToDatabase(workId, bmIndex, currentBm.status, newPaymentStatus);
        
        if (saved) {
            await generateSummaryMeasurementsReport();
        }
    } catch (error) {
        console.error("Erro ao alternar pagamento:", error);
        alert("Erro ao alterar status de pagamento. Tente novamente.");
    } finally {
        hideSpinner();
    }
};

/**
 * Inicializa a sub-seção de Relatório de Resumo de Medições
 */
export const initSummaryMeasurementsReport = async () => {
    showSpinner();
    try {
        console.log('🚀 Inicializando relatório resumo de medições...');
        
        if (appState.works.length === 0) {
            appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        }
        
        // Carrega dados para cálculos
        if (appState.equipment.length === 0) appState.equipment = await apiClient.fetchData('equipment');
        if (appState.stoppage_types.length === 0) appState.stoppage_types = await apiClient.fetchData('stoppage_types');
        if (appState.client_companies.length === 0) appState.client_companies = await apiClient.fetchData('client_companies');
        if (appState.my_companies.length === 0) appState.my_companies = await apiClient.fetchData('my_companies');
        if (appState.damages.length === 0) appState.damages = await apiClient.fetchDamages();

        appState.bm_payments = (await apiClient.fetchData('bm_payments')).map(p => ({ ...p, amount: p.amount ? parseFloat(p.amount) : 0 }));

        // ✅ DEPOIS (com ordenação alfabética):
        if (summaryMeasurementsReportWorkSelect) {
            // Ordenar obras alfabeticamente por nome
            const sortedWorks = [...appState.works].sort((a, b) => {
                const nameA = (a.name || '').toUpperCase();
                const nameB = (b.name || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });
            
            summaryMeasurementsReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
                sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        }
        if (generateSummaryMeasurementsReportBtn) {
            generateSummaryMeasurementsReportBtn.addEventListener('click', generateSummaryMeasurementsReport);
        }
        if (exportSummaryMeasurementsPdfBtn) {
            exportSummaryMeasurementsPdfBtn.addEventListener('click', () => {
                const includePayments = includePaymentsCheckbox ? includePaymentsCheckbox.checked : true;
                exportSummaryMeasurementsToPDF('summary-measurements-report-output', 'Resumo de Medições', false, includePayments);
            });
        }
        if (includePaymentsCheckbox) {
            includePaymentsCheckbox.addEventListener('change', () => {
                if (summaryMeasurementsReportOutput?.innerHTML.trim()) {
                    generateSummaryMeasurementsReport();
                }
            });
        }
        
        // Listener delegado para os botões de status e pagamento
        if (summaryMeasurementsReportOutput) {
            summaryMeasurementsReportOutput.addEventListener('click', (event) => {
                if (event.target.classList.contains('status-btn')) {
                    handleStatusToggle(event);
                }
                if (event.target.classList.contains('payment-btn')) {
                    handlePaymentToggle(event);
                }
            });
        }

        if (summaryMeasurementsReportOutput) summaryMeasurementsReportOutput.innerHTML = '';
        if (exportSummaryMeasurementsPdfBtn) exportSummaryMeasurementsPdfBtn.style.display = 'none';

        console.log('✅ Inicialização do resumo de medições concluída');

    } catch (error) {
        console.error("❌ Erro ao inicializar relatório de resumo de medições:", error);
        alert(`Erro ao carregar dados: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Gera o relatório de resumo de medições
 */
const generateSummaryMeasurementsReport = async () => {
    const workId = summaryMeasurementsReportWorkSelect?.value;
    if (!workId) {
        alert('Por favor, selecione uma obra.');
        return;
    }

    showSpinner();
    if (summaryMeasurementsReportOutput) summaryMeasurementsReportOutput.innerHTML = '';
    if (exportSummaryMeasurementsPdfBtn) exportSummaryMeasurementsPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        if (!work) {
            alert('Obra não encontrada.');
            hideSpinner();
            return;
        }
        
        const client = appState.client_companies.find(c => c.id == work.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work.my_company_id);
        const bmPayments = appState.bm_payments.filter(p => p.work_id == workId);
        const includePayments = includePaymentsCheckbox ? includePaymentsCheckbox.checked : true;

        // Busca os status dos BMs do banco de dados
        const bmStatusesFromDb = await fetchBmStatusFromDatabase(workId);
        
        // Processa períodos de medição, mesclando com os status do banco
        const bmPeriods = (work.config?.measurement_periods || []).map((bm, index) => {
            const statusFromDb = bmStatusesFromDb.find(s => s.bm_index === index);
            return {
                ...bm,
                status: statusFromDb ? statusFromDb.status : 'A EMITIR',
                paymentStatus: statusFromDb ? statusFromDb.payment_status : 'A PAGAR'
            };
        });

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'Minha Empresa'}</h3>
                    <p><strong>Obra:</strong> ${work.name || 'N/A'}<br>
                       <strong>Cliente:</strong> ${client?.name || 'N/A'}</p>
                    <p><strong>Resumo de Medições da Obra</strong></p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Valores por Boletim de Medição (BM)</h3>
                    <div class="table-wrapper responsive">
                        <table id="bm-summary-table">
                            <thead>
                                <tr>
                                    <th>BM</th>
                                    <th>Período</th>
                                    <th>Valor Total (R$)</th>
                                    <th>Status</th>
                                    <th>Pagamento</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        let totalGeralObra = 0;
        const bmValues = [];

        // NOVA ABORDAGEM: Usa a MESMA lógica do relatório de medição
        for (let i = 0; i < bmPeriods.length; i++) {
            const startDate = bmPeriods[i].start;
            const endDate = bmPeriods[i].end;
            
            // 1. Buscar lançamentos do período
            const entries = await apiClient.fetchDailyEntries(workId, null, startDate, endDate);
            
            // 2. Buscar despesas gerais do período
            const generalExpenses = await apiClient.fetchData(
                'general_expenses',
                '*, equipment(*)',
                'date',
                true
            ).then(data => data.filter(entry =>
                entry.work_id == workId && 
                entry.date >= startDate && 
                entry.date <= endDate
            ));
            
            // 3. Buscar avarias do período
            let damages = [];
            if (typeof apiClient.fetchDamages === 'function') {
                damages = await apiClient.fetchDamages(workId, startDate, endDate);
            }
            
            // 4. Validar avarias (MESMA LÓGICA DO RELATÓRIO)
            const validateDamageForMeasurement = (damage) => {
                if (!damage || !damage.id) return false;
                const validImpacts = [EXPENSE_IMPACT_TYPES.ADD_CLIENT, EXPENSE_IMPACT_TYPES.DISC_CLIENT];
                if (!validImpacts.includes(damage.client_impact_type)) return false;
                const totalValue = preciseRounding.round2(parseFloat(damage.total_value) || 0);
                if (totalValue <= 0) return false;
                if (!damage.damage_date) return false;
                return true;
            };
            
            // 5. Agrupar por equipamento
            const entriesByEquipment = entries.reduce((acc, entry) => {
                (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
                return acc;
            }, {});
            
            // 6. Buscar substituições do período
            const substitutionsInPeriod = await apiClient.fetchEquipmentSubstitutions(workId, startDate, endDate);
            const substitutionsBySubstitutingEquip = new Map(
                substitutionsInPeriod.map(sub => [sub.substituting_equipment_id, sub])
            );
            
            // 7. Buscar configs de equipamentos
            const allEquipConfigs = new Map();
            if (work?.config?.equipment) {
                work.config.equipment.forEach(ec => {
                    allEquipConfigs.set(parseInt(ec.equipment_id), ec);
                });
            }
            
            let bmTotalValue = 0;
            
            // 8. Calcular por equipamento (MESMA LÓGICA DO RELATÓRIO)
            for (const equipmentId of Object.keys(entriesByEquipment)) {
                const equipmentEntries = entriesByEquipment[equipmentId];
                const equipmentExpenses = generalExpenses.filter(e => e.equipment_id == equipmentId);
                const equipmentDamages = damages.filter(d => d.equipment_id == equipmentId);
                const validDamages = equipmentDamages.filter(damage => validateDamageForMeasurement(damage));
                
                let equipConfig = allEquipConfigs.get(parseInt(equipmentId));
                if (!equipConfig) continue;
                
                const substitutionDetails = substitutionsBySubstitutingEquip.get(parseInt(equipmentId));
                
                let configForCalculation = equipConfig;
                if (substitutionDetails) {
                    const substitutedEquipConfig = allEquipConfigs.get(parseInt(substitutionDetails.substituted_equipment_id));
                    if (substitutedEquipConfig) {
                        configForCalculation = { ...substitutedEquipConfig, equipment_id: equipConfig.equipment_id };
                    }
                }
                
                const equipmentCalculation = calculateEquipmentTotalValue(
                    equipmentEntries,
                    equipmentExpenses,
                    configForCalculation,
                    work,
                    validDamages,
                    substitutionDetails,
                    startDate,
                    endDate
                );
                
                bmTotalValue += equipmentCalculation.totalValue;
            }
            
            // 9. Adicionar despesas gerais (sem equipamento)
            const generalWorkExpenses = generalExpenses.filter(expense => !expense.equipment_id);
            const generalAdditions = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
            const generalDiscounts = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);
            bmTotalValue += generalAdditions - generalDiscounts;
            
            // 10. Adicionar avarias gerais (sem equipamento)
            const generalWorkDamages = damages.filter(damage => !damage.equipment_id && validateDamageForMeasurement(damage));
            const generalDamageAdditions = generalWorkDamages
                .filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                .reduce((sum, d) => sum + (d.total_value || 0), 0);
            const generalDamageDiscounts = generalWorkDamages
                .filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                .reduce((sum, d) => sum + (d.total_value || 0), 0);
            bmTotalValue += generalDamageAdditions - generalDamageDiscounts;
            
            bmValues.push({ ...bmPeriods[i], value: bmTotalValue });
            totalGeralObra += bmTotalValue;
        }
        
        bmValues.forEach((bm, index) => {
            const bmLabel = `BM ${String(index + 1).padStart(2, '0')}`;
            const bmStartDate = new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR');
            const bmEndDate = new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR');

            const isEmitido = bm.status === 'EMITIDO';
            const isPago = bm.paymentStatus === 'PAGO';
            
            const statusBtnClass = isEmitido ? 'btn-success' : 'btn-secondary';
            const paymentBtnClass = isPago ? 'btn-success' : 'btn-warning';
            const paymentBtnDisabled = !isEmitido ? 'disabled' : '';

            reportHTML += `
                <tr>
                    <td data-label="BM">${bmLabel}</td>
                    <td data-label="Período">${bmStartDate} a ${bmEndDate}</td>
                    <td data-label="Valor Total" class="currency">${formatCurrency(bm.value)}</td>
                    <td data-label="Status">
                        <button class="btn btn-sm status-btn ${statusBtnClass}" data-work-id="${workId}" data-bm-index="${index}">
                            ${bm.status}
                        </button>
                    </td>
                    <td data-label="Pagamento">
                        <button class="btn btn-sm payment-btn ${paymentBtnClass}" data-work-id="${workId}" data-bm-index="${index}" ${paymentBtnDisabled}>
                            ${bm.paymentStatus}
                        </button>
                    </td>
                </tr>
            `;
        });

        reportHTML += `</tbody></table></div>`;

        // Cálculos para o resumo
        const totalNotas = bmValues.length;
        const totalEmitidas = bmValues.filter(bm => bm.status === 'EMITIDO').length;
        const totalNaoEmitidas = totalNotas - totalEmitidas;
        const emitidasPagas = bmValues.filter(bm => bm.status === 'EMITIDO' && bm.paymentStatus === 'PAGO').length;
        const emitidasNaoPagas = totalEmitidas - emitidasPagas;
        
        const valorPagoBMs = bmValues
            .filter(bm => bm.paymentStatus === 'PAGO')
            .reduce((sum, bm) => sum + bm.value, 0);
            
        const saldoAReceber = totalGeralObra - valorPagoBMs;

        // Bloco de resumo de status
        reportHTML += `
            <div id="bm-stats-summary" class="report-summary-box" style="margin-top: 20px;">
                <h4>Resumo das Notas</h4>
                <div class="stats-grid">
                    <div><strong>QTDE DE NOTAS:</strong> ${totalNotas}</div>
                    <div><strong>EMITIDAS:</strong> ${totalEmitidas}</div>
                    <div><strong>NÃO EMITIDAS:</strong> ${totalNaoEmitidas}</div>
                    <div><strong>EMITIDAS PAGAS:</strong> ${emitidasPagas}</div>
                    <div><strong>EMITIDAS NÃO PAGAS:</strong> ${emitidasNaoPagas}</div>
                </div>
            </div>
        `;

        if (includePayments) {
            let totalPaid = bmPayments.reduce((sum, p) => sum + p.amount, 0);
            reportHTML += `
                <div class="report-summary" id="payments-section" style="margin-top: 30px;">
                    <h3>Pagamentos Adicionais Recebidos</h3>
                    <div class="table-wrapper responsive"><table id="payments-table">
                        <thead><tr>
                            <th style="font-weight: bold; font-size: 1.1em; color: #4a90e2;">Data</th>
                            <th style="font-weight: bold; font-size: 1.1em; color: #4a90e2;">Tipo</th>
                            <th style="font-weight: bold; font-size: 1.1em; color: #4a90e2;">Obs.</th>
                            <th style="font-weight: bold; font-size: 1.1em; color: #4a90e2;">Valor Pago (R$)</th>
                        </tr></thead>
                        <tbody>`;
            if (bmPayments.length === 0) {
                reportHTML += `<tr><td colspan="4" class="text-center">Nenhum pagamento adicional registrado.</td></tr>`;
            } else {
                bmPayments.forEach(payment => {
                    reportHTML += `<tr>
                        <td data-label="Data">${new Date(payment.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td data-label="Tipo">${payment.payment_type || 'N/A'}</td>
                        <td data-label="Obs.">${payment.notes || '---'}</td>
                        <td data-label="Valor Pago" class="currency">${formatCurrency(payment.amount)}</td>
                    </tr>`;
                });
            }
            reportHTML += `</tbody><tfoot>
                    <tr class="total-row"><td></td><td></td><td style="text-align: right; font-weight: bold; font-size: 1.1em; color: #007bff;">Total Pago (Adicionais):</td><td class="currency" style="font-weight: bold; font-size: 1.1em; color: #007bff;">${formatCurrency(totalPaid)}</td></tr>
                </tfoot></table></div>
                <div class="report-total" style="margin-top: 15px;">
                    <p><strong>Valor Total da Obra:</strong> ${formatCurrency(totalGeralObra)}</p>
                    <p style="color: #dc3545;"><strong>Total Deduzido (BMs Pagas):</strong> ${formatCurrency(valorPagoBMs)}</p>
                    <p style="color: #007bff;"><strong>Total Pago (Adicionais):</strong> ${formatCurrency(totalPaid)}</p>
                    <h4 style="color: #28a745;">Saldo Final a Receber: ${formatCurrency(saldoAReceber - totalPaid)}</h4>
                </div></div>`;
        }
        reportHTML += `</div>`;

        if (summaryMeasurementsReportOutput) summaryMeasurementsReportOutput.innerHTML = reportHTML;
        if (exportSummaryMeasurementsPdfBtn) exportSummaryMeasurementsPdfBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("❌ Erro ao gerar relatório:", e);
        if (summaryMeasurementsReportOutput) {
            summaryMeasurementsReportOutput.innerHTML = `<div class="alert alert-danger"><h4>Erro ao gerar relatório</h4><p>${e.message}</p></div>`;
        }
    } finally {
        hideSpinner();
    }
};