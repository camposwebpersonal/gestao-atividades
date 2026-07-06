// relatorios_despesas.js - VERSÃO ATUALIZADA COM MÓDULO DE CÁLCULOS CENTRALIZADO
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF } from './relatorios_despesas_pdf.js';
// NOVA IMPORTAÇÃO: Módulo centralizado de cálculos
import { 
    calculateGeneralExpensesImpact,
    EXPENSE_IMPACT_TYPES
} from './calculos_valores.js?v=20260302090000';

const expensesReportWorkSelect = document.getElementById('expenses-report-work-select');
const expensesReportStartDate = document.getElementById('expenses-report-start-date');
const expensesReportEndDate = document.getElementById('expenses-report-end-date');
const generateExpensesReportBtn = document.getElementById('generate-expenses-report-btn');
const exportExpensesPdfBtn = document.getElementById('export-expenses-pdf-btn');
const expensesReportOutput = document.getElementById('expenses-report-output');

/**
 * Inicializa a sub-seção de Relatório de Despesas.
 * Configura os event listeners.
 */
export const initExpenseReport = () => {
    if (generateExpensesReportBtn) {
        generateExpensesReportBtn.addEventListener('click', generateExpenseReport);
    }
    if (exportExpensesPdfBtn) {
        exportExpensesPdfBtn.addEventListener('click', () => exportReportToPDF('expenses-report-output', 'Relatório de Despesas'));
    }
    // Popula o dropdown de obras ao iniciar
    if (expensesReportWorkSelect) {
        expensesReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + appState.works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
};

/**
 * FUNÇÃO AUXILIAR ATUALIZADA: Calcula o total de uma despesa
 * Movida para o topo para facilitar reutilização e manter consistência
 */
const calculateExpenseTotal = (expense) => {
    return parseFloat(expense.impacto_cliente_total) || 0;
};

/**
 * FUNÇÃO PRINCIPAL ATUALIZADA: Gera relatório usando módulo centralizado de cálculos
 */
const generateExpenseReport = async () => {
    const workId = expensesReportWorkSelect?.value;
    const startDate = expensesReportStartDate?.value;
    const endDate = expensesReportEndDate?.value;

    if (!workId || !startDate || !endDate) {
        alert('Selecione a obra e o período para gerar o relatório de despesas.');
        return;
    }

    showSpinner();
    if (expensesReportOutput) expensesReportOutput.innerHTML = '';
    if (exportExpensesPdfBtn) exportExpensesPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        // Fetch expenses and also join with equipment table to get equipment details
        const entries = await apiClient.fetchData(
            'general_expenses',
            '*, equipment(*)',
            'date',
            true // ascending
        ).then(data => data.filter(entry =>
            entry.work_id == workId && entry.date >= startDate && entry.date <= endDate
        ));

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'Minha Empresa'}</h3>
                    <p><strong>Obra:</strong> ${work?.name || 'N/A'}<br>
                       <strong>Cliente:</strong> ${client?.name || 'N/A'}</p>
                    <p><strong>Período:</strong> ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Relatório de Despesas Gerais</h3>
                    <div class="table-wrapper responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Equipamento</th>
                                    <th>Tipo</th>
                                    <th>Descrição</th>
                                    <th>Valor Unit. (R$)</th>
                                    <th>Quantidade</th>
                                    <th>Unidade</th>
                                    <th>Acréscimos (R$)</th>
                                    <th>Descontos (R$)</th>
                                    <th>Observações</th>
                                    <th>Total da Despesa (R$)</th>
                                    <th>Impacto Medição</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        // Adiciona "Equipamento" e "Impacto Medição" aos cabeçalhos
        const headers = ["Data", "Equipamento", "Tipo", "Descrição", "Valor Unit. (R$)", "Quantidade", "Unidade", "Acréscimos (R$)", "Descontos (R$)", "Observações", "Total da Despesa (R$)", "Impacto Medição"];

        // Separa despesas por categoria para usar módulo centralizado
        const expensesByImpact = {
            [EXPENSE_IMPACT_TYPES.ADD_CLIENT]: [],
            [EXPENSE_IMPACT_TYPES.DISC_CLIENT]: [],
            [EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO]: [],
            [EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO]: [],
            [EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO]: [],
            [EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO]: [],
            'none': [] // Para despesas sem impacto
        };

        entries.forEach(entry => {
            const impactType = entry.measurement_impact || 'none';
            if (expensesByImpact[impactType]) {
                expensesByImpact[impactType].push(entry);
            } else {
                expensesByImpact['none'].push(entry);
            }

            // NOVA ABORDAGEM: Usa função consistente para calcular total
            const totalExpense = calculateExpenseTotal(entry);
            
            // Determina display do equipamento com tratamento robusto
            let equipmentDisplay = 'N/A';
            if (entry.equipment_id) {
                if (entry.equipment) {
                    equipmentDisplay = `${entry.equipment.prefix} - ${getEquipTypeName(entry.equipment.type)}`;
                } else {
                    // Busca no appState como fallback
                    const equipment = appState.equipment.find(e => e.id == entry.equipment_id);
                    if (equipment) {
                        equipmentDisplay = `${equipment.prefix} - ${getEquipTypeName(equipment.type)}`;
                    } else {
                        equipmentDisplay = `⚠️ Equipamento Removido (ID: ${entry.equipment_id})`;
                    }
                }
            }

            // Determina display do impacto na medição usando constantes do módulo
            let impactDisplay = 'Nenhum';
            switch (entry.measurement_impact) {
                case EXPENSE_IMPACT_TYPES.ADD_CLIENT: 
                    impactDisplay = 'Acréscimo (Cliente)'; 
                    break;
                case EXPENSE_IMPACT_TYPES.DISC_CLIENT: 
                    impactDisplay = 'Desconto (Cliente)'; 
                    break;
                case EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO: 
                    impactDisplay = 'Acréscimo (Terceirizado)'; 
                    break;
                case EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO: 
                    impactDisplay = 'Desconto (Terceirizado)'; 
                    break;
                case EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO:
                    const thirdPartyAdd = appState.terceirizados.find(t => t.id == entry.terceirizado_id);
                    impactDisplay = `Acréscimo (${thirdPartyAdd?.name || 'Empresa Removida'})`;
                    break;
                case EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO:
                    const thirdPartyDisc = appState.terceirizados.find(t => t.id == entry.terceirizado_id);
                    impactDisplay = `Desconto (${thirdPartyDisc?.name || 'Empresa Removida'})`;
                    break;
                default: 
                    impactDisplay = 'Somente Registrar'; 
                    break;
            }

            reportHTML += `
                                <tr>
                                    <td data-label="${headers[0]}">${new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td data-label="${headers[1]}">${equipmentDisplay}</td>
                                    <td data-label="${headers[2]}">${entry.type}</td>
                                    <td data-label="${headers[3]}">${entry.description}</td>
                                    <td data-label="${headers[4]}">${formatCurrency(entry.impacto_cliente_valor_unitario || 0)}</td>
                                    <td data-label="${headers[5]}">${(entry.impacto_cliente_qtde || 0).toLocaleString('pt-BR')}</td>
                                    <td data-label="${headers[6]}">${entry.impacto_cliente_unidade || 'UN'}</td>
                                    <td data-label="${headers[7]}">${formatCurrency(entry.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT ? (parseFloat(entry.impacto_cliente_total) || 0) : 0)}</td>
                                    <td data-label="${headers[8]}">${formatCurrency(entry.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT ? (parseFloat(entry.impacto_cliente_total) || 0) : 0)}</td>
                                    <td data-label="${headers[9]}">${entry.notes || '---'}</td>
                                    <td data-label="${headers[10]}">${formatCurrency(parseFloat(entry.impacto_cliente_total) || 0)}</td>
                                    <td data-label="${headers[11]}">${impactDisplay}</td>
                                </tr>
            `;
        });

        reportHTML += `
                            </tbody>
                        </table>
                    </div>
        `;

        // NOVA ABORDAGEM: Usa módulo centralizado para calcular totais por categoria
        let grandTotal = 0;
        let detailsByCategory = {};

        // Calcula impactos usando módulo centralizado
        const additionsClient = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_CLIENT], EXPENSE_IMPACT_TYPES.ADD_CLIENT);
        const discountsClient = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_CLIENT], EXPENSE_IMPACT_TYPES.DISC_CLIENT);
        
        const additionsTerceirizado = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO], EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO);
        const discountsTerceirizado = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO], EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO);
        
        const additionsTerceirizadoEsp = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO], EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO);
        const discountsTerceirizadoEsp = calculateGeneralExpensesImpact(expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO], EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO);

        const totalRegistroOnly = expensesByImpact['none'].reduce((sum, expense) => sum + calculateExpenseTotal(expense), 0);

        // Calcula total geral considerando apenas impacto no cliente
        grandTotal = additionsClient - discountsClient;

        detailsByCategory = {
            'Cliente - Acréscimos': { value: additionsClient, count: expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_CLIENT].length },
            'Cliente - Descontos': { value: discountsClient, count: expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_CLIENT].length },
            'Terceirizado - Acréscimos': { value: additionsTerceirizado, count: expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO].length },
            'Terceirizado - Descontos': { value: discountsTerceirizado, count: expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO].length },
            'Terceirizado Específico - Acréscimos': { value: additionsTerceirizadoEsp, count: expensesByImpact[EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO].length },
            'Terceirizado Específico - Descontos': { value: discountsTerceirizadoEsp, count: expensesByImpact[EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO].length },
            'Somente Registro': { value: totalRegistroOnly, count: expensesByImpact['none'].length }
        };

        // Adiciona breakdown por categoria ao relatório
        reportHTML += `
                    <div class="report-breakdown" style="margin-top: 30px;">
                        <h4>Breakdown por Categoria de Impacto</h4>
                        <div class="table-wrapper responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Categoria</th>
                                        <th>Quantidade de Despesas</th>
                                        <th>Valor Total (R$)</th>
                                        <th>Impacta Total Geral?</th>
                                    </tr>
                                </thead>
                                <tbody>
        `;

        Object.entries(detailsByCategory).forEach(([category, data]) => {
            const impactsGrandTotal = category.includes('Cliente');
            const rowStyle = impactsGrandTotal ? 'background-color: #e8f5e9; font-weight: bold;' : '';
            
            reportHTML += `
                                    <tr style="${rowStyle}">
                                        <td>${category}</td>
                                        <td>${data.count}</td>
                                        <td>${formatCurrency(data.value)}</td>
                                        <td>${impactsGrandTotal ? 'Sim' : 'Não'}</td>
                                    </tr>
            `;
        });

        reportHTML += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="report-total">
                        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
                            <p><strong>Total Geral de Despesas (Impacto Cliente): ${formatCurrency(grandTotal)}</strong></p>
                            <p style="margin: 5px 0; font-size: 0.9em; color: #666;">
                                * Apenas despesas com impacto no cliente afetam o total geral da medição
                            </p>
                            <p style="margin: 0; font-size: 0.9em; color: #666;">
                                * Despesas de terceirizados são tratadas separadamente
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        console.log(`📊 RELATÓRIO DE DESPESAS - Módulo Centralizado:`);
        console.log(`   💰 Total Cliente (Acréscimos): ${formatCurrency(additionsClient)}`);
        console.log(`   💸 Total Cliente (Descontos): ${formatCurrency(discountsClient)}`);
        console.log(`   🎯 Total Geral (Impacto Cliente): ${formatCurrency(grandTotal)}`);
        console.log(`   📈 Total Terceirizados: ${formatCurrency(additionsTerceirizado - discountsTerceirizado + additionsTerceirizadoEsp - discountsTerceirizadoEsp)}`);
        console.log(`   📋 Total Somente Registro: ${formatCurrency(totalRegistroOnly)}`);

        if (expensesReportOutput) expensesReportOutput.innerHTML = reportHTML;
        if (exportExpensesPdfBtn) exportExpensesPdfBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatório de despesas:", e);
        if (expensesReportOutput) expensesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório de despesas. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};