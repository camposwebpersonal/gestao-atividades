// lancamentos_folha_pagamento.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency } from './utils.js';
import { apiClient } from './api.js';

const payrollEntryWorkSelect = document.getElementById('payroll-entry-work-select');
const payrollEntryEmployeeSelect = document.getElementById('payroll-entry-employee-select');
const payrollEntryDateType = document.getElementById('payroll-entry-date-type');
const payrollSingleDateGroup = document.getElementById('payroll-single-date-group');
const payrollStartDateGroup = document.getElementById('payroll-start-date-group');
const payrollEndDateGroup = document.getElementById('payroll-end-date-group');
const payrollEntryDateInput = document.getElementById('payroll-entry-date');
const payrollEntryStartDateInput = document.getElementById('payroll-entry-start-date');
const payrollEntryEndDateInput = document.getElementById('payroll-entry-end-date');
const payrollEntryWorkedDaysInput = document.getElementById('payroll-entry-worked-days');
const payrollEntryAdditionsInput = document.getElementById('payroll-entry-additions');
const payrollEntryDiscountsInput = document.getElementById('payroll-entry-discounts');
const payrollEntryManualTotalInput = document.getElementById('payroll-entry-manual-total');
const payrollEntryIncludeMeasurement = document.getElementById('payroll-entry-include-measurement');
const payrollEntryNotes = document.getElementById('payroll-entry-notes');
const addPayrollEntryBtn = document.getElementById('add-payroll-entry-btn');
const payrollEntriesTableBody = document.querySelector('#payroll-entries-table tbody');

/**
 * Inicializa a sub-seção de Lançamentos de Efetivo (Folha de Pagamento).
 * Carrega os dados iniciais e configura os event listeners.
 */
export const initPayrollEntries = async () => {
    showSpinner();
    // Garante que as obras, funcionários e salários por obra estejam carregados
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        appState.employees = await apiClient.fetchData('employees');
        appState.work_employee_salaries = await apiClient.fetchWorkEmployeeSalaries();
    }

    if (payrollEntryWorkSelect) {
        payrollEntryWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + appState.works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        payrollEntryWorkSelect.addEventListener('change', handlePayrollWorkSelectChange);
    }
    if (payrollEntryDateType) {
        payrollEntryDateType.addEventListener('change', handlePayrollDateTypeChange);
    }
    if (addPayrollEntryBtn) {
        addPayrollEntryBtn.addEventListener('click', addPayrollEntry);
    }

    // Inicializa os dropdowns vazios
    if (payrollEntryEmployeeSelect) payrollEntryEmployeeSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
    if (payrollEntriesTableBody) payrollEntriesTableBody.innerHTML = '';

    hideSpinner();
};

/**
 * Lida com a mudança na seleção da obra para lançamentos de folha de pagamento.
 * Popula o dropdown de funcionários e carrega os lançamentos existentes.
 */
const handlePayrollWorkSelectChange = async () => {
    const workId = payrollEntryWorkSelect.value;
    if (payrollEntryEmployeeSelect) payrollEntryEmployeeSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
    if (payrollEntriesTableBody) payrollEntriesTableBody.innerHTML = '';

    if (!workId) return;

    // Carrega funcionários associados à obra e seus salários
    const employeesInWork = appState.employees.filter(emp =>
        appState.work_employee_salaries.some(wes => wes.work_id == workId && wes.employee_id == emp.id)
    );

    if (payrollEntryEmployeeSelect) {
        payrollEntryEmployeeSelect.innerHTML = '<option value="">Selecione um funcionário</option>' + employeesInWork.map(emp => `<option value="${emp.id}">${emp.name} - ${emp.role || 'N/A'}</option>`).join('');
    }

    loadPayrollEntries(workId);
};

/**
 * Lida com a mudança no tipo de lançamento de data (única ou período).
 * Alterna a visibilidade dos campos de entrada de data.
 */
const handlePayrollDateTypeChange = () => {
    if (payrollEntryDateType.value === 'single') {
        if (payrollSingleDateGroup) payrollSingleDateGroup.style.display = 'block';
        if (payrollStartDateGroup) payrollStartDateGroup.style.display = 'none';
        if (payrollEndDateGroup) payrollEndDateGroup.style.display = 'none';
        if (payrollEntryWorkedDaysInput) payrollEntryWorkedDaysInput.value = '1';
    } else {
        if (payrollSingleDateGroup) payrollSingleDateGroup.style.display = 'none';
        if (payrollStartDateGroup) payrollStartDateGroup.style.display = 'block';
        if (payrollEndDateGroup) payrollEndDateGroup.style.display = 'block';
        if (payrollEntryWorkedDaysInput) payrollEntryWorkedDaysInput.value = ''; // Clear worked days for range
    }
};

/**
 * Adiciona um novo lançamento de folha de pagamento ao banco de dados.
 */
const addPayrollEntry = async () => {
    const workId = payrollEntryWorkSelect?.value;
    const employeeId = payrollEntryEmployeeSelect?.value;
    const dateType = payrollEntryDateType?.value;
    const workedDays = parseFloat(payrollEntryWorkedDaysInput?.value || '0');
    const additions = parseFloat(payrollEntryAdditionsInput?.value || '0');
    const discounts = parseFloat(payrollEntryDiscountsInput?.value || '0');
    const manualTotal = payrollEntryManualTotalInput?.value ? parseFloat(payrollEntryManualTotalInput.value) : null;
    const notes = payrollEntryNotes?.value;
    const includeInMeasurement = payrollEntryIncludeMeasurement?.checked || false;

    if (!workId || !employeeId || (workedDays <= 0 && manualTotal === null)) {
        alert('Preencha a obra, funcionário e dias trabalhados ou valor total manual.');
        return;
    }

    let entryDate = null;
    let startDate = null;
    let endDate = null;

    if (dateType === 'single') {
        entryDate = payrollEntryDateInput?.value;
        if (!entryDate) { alert('Selecione a data do lançamento.'); return; }
    } else {
        startDate = payrollEntryStartDateInput?.value;
        endDate = payrollEntryEndDateInput?.value;
        if (!startDate || !endDate) { alert('Selecione o período do lançamento.'); return; }
        entryDate = startDate; // Use start date as reference for unique constraint
    }

    // Calculate total if not manual
    let calculatedTotal = 0;
    if (manualTotal === null) {
        const employeeSalaryConfig = appState.work_employee_salaries.find(wes => wes.work_id == workId && wes.employee_id == employeeId);
        const employeeSalary = employeeSalaryConfig ? parseFloat(employeeSalaryConfig.salary) : 0;
        const daysInMonth = 30; // Assumindo 30 dias para cálculo proporcional

        if (employeeSalary > 0) {
            calculatedTotal = (employeeSalary / daysInMonth) * workedDays;
        }
        calculatedTotal += additions;
        calculatedTotal -= discounts;
    } else {
        calculatedTotal = manualTotal;
    }

    const entryData = {
        work_id: workId,
        employee_id: employeeId,
        date: entryDate, // Use a data única ou a data de início para a coluna 'date'
        start_date: startDate,
        end_date: endDate,
        worked_days: workedDays,
        additions: additions,
        discounts: discounts,
        manual_total: manualTotal,
        notes: notes,
        include_in_measurement: includeInMeasurement,
        calculated_total: calculatedTotal // Adiciona o total calculado para facilitar o relatório
    };

    showSpinner();
    try {
        await apiClient.upsertItem('payroll_entries', entryData, 'work_id, employee_id, date');
        alert('Lançamento de efetivo adicionado/atualizado com sucesso!');
        await loadPayrollEntries(workId);
        // Limpar formulário
        if (payrollEntryDateInput) payrollEntryDateInput.value = '';
        if (payrollEntryStartDateInput) payrollEntryStartDateInput.value = '';
        if (payrollEntryEndDateInput) payrollEntryEndDateInput.value = '';
        if (payrollEntryWorkedDaysInput) payrollEntryWorkedDaysInput.value = '1';
        if (payrollEntryAdditionsInput) payrollEntryAdditionsInput.value = '0';
        if (payrollEntryDiscountsInput) payrollEntryDiscountsInput.value = '0';
        if (payrollEntryManualTotalInput) payrollEntryManualTotalInput.value = '';
        if (payrollEntryNotes) payrollEntryNotes.value = '';
        if (payrollEntryIncludeMeasurement) payrollEntryIncludeMeasurement.checked = false;
    } catch (e) {
        console.error("Erro ao adicionar lançamento de efetivo:", e);
        alert(`Erro ao adicionar lançamento de efetivo: ${e.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Carrega os lançamentos de folha de pagamento para uma obra específica.
 * @param {string} workId - ID da obra.
 */
const loadPayrollEntries = async (workId) => {
    showSpinner();
    try {
        const data = await apiClient.fetchPayrollEntries(workId);
        renderPayrollEntriesTable(data, workId);
    } catch (e) {
        console.error("Erro ao carregar lançamentos de efetivo:", e);
        if (payrollEntriesTableBody) payrollEntriesTableBody.innerHTML = '<tr><td colspan="8">Erro ao carregar lançamentos.</td></tr>';
    } finally {
        hideSpinner();
    }
};

/**
 * Renderiza a tabela de lançamentos de folha de pagamento.
 * @param {Array<Object>} entries - Lista de lançamentos de folha de pagamento.
 * @param {string} workId - ID da obra.
 */
const renderPayrollEntriesTable = (entries, workId) => {
    if (!payrollEntriesTableBody) return;
    payrollEntriesTableBody.innerHTML = '';
    if (entries.length === 0) {
        payrollEntriesTableBody.innerHTML = '<tr><td colspan="8">Nenhum lançamento de efetivo para esta obra.</td></tr>';
        return;
    }

    entries.forEach(entry => {
        const employee = appState.employees.find(emp => emp.id == entry.employee_id);
        const employeeName = employee?.name || 'N/A';
        const employeeRole = employee?.role || 'N/A';

        const dateDisplay = entry.start_date && entry.end_date ?
            `${new Date(entry.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(entry.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}` :
            new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR');

        // Usa o total calculado salvo ou recalcula se manual_total for null
        const displayTotal = entry.calculated_total !== undefined && entry.calculated_total !== null
            ? entry.calculated_total
            : (entry.manual_total !== null
                ? entry.manual_total
                : (() => {
                    const employeeSalaryConfig = appState.work_employee_salaries.find(wes => wes.work_id == workId && wes.employee_id == entry.employee_id);
                    const employeeSalary = employeeSalaryConfig ? parseFloat(employeeSalaryConfig.salary) : 0;
                    const daysInMonth = 30;
                    let total = 0;
                    if (employeeSalary > 0) {
                        total = (employeeSalary / daysInMonth) * (entry.worked_days || 0);
                    }
                    total += (entry.additions || 0);
                    total -= (entry.discounts || 0);
                    return total;
                })());


        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Funcionário">${employeeName} - ${employeeRole}</td>
            <td data-label="Data/Período">${dateDisplay}</td>
            <td data-label="Dias Trab.">${entry.worked_days || '0'}</td>
            <td data-label="Acréscimos">${formatCurrency(entry.additions || 0)}</td>
            <td data-label="Descontos">${formatCurrency(entry.discounts || 0)}</td>
            <td data-label="Total Manual">${entry.manual_total !== null ? formatCurrency(entry.manual_total) : '---'}</td>
            <td data-label="Medição">${entry.include_in_measurement ? 'Sim' : 'Não'}</td>
            <td data-label="Ações" class="actions-cell">
                <button class="btn btn-danger btn-sm" data-id="${entry.id}" data-action="delete-payroll-entry">Excluir</button>
            </td>
        `;
        payrollEntriesTableBody.appendChild(row);
    });

    payrollEntriesTableBody.querySelectorAll('[data-action="delete-payroll-entry"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Tem certeza que deseja excluir este lançamento de efetivo?')) {
                showSpinner();
                try {
                    await apiClient.deleteItem('payroll_entries', e.target.dataset.id);
                    alert('Lançamento excluído com sucesso!');
                    await loadPayrollEntries(workId);
                } catch (err) {
                    console.error("Erro ao excluir lançamento de efetivo:", err);
                    alert(`Erro ao excluir lançamento: ${err.message}`);
                } finally {
                    hideSpinner();
                }
            }
        });
    });
};
