// relatorios_folha_pagamento.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency , sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF } from './relatorios_folha_pagamento_pdf.js'; // Importa a função de exportação de PDF

const payrollReportWorkSelect = document.getElementById('payroll-report-work-select');
const payrollReportStartDate = document.getElementById('payroll-report-start-date');
const payrollReportEndDate = document.getElementById('payroll-report-end-date');
const generatePayrollReportBtn = document.getElementById('generate-payroll-report-btn');
const exportPayrollPdfBtn = document.getElementById('export-payroll-pdf-btn');
const payrollReportOutput = document.getElementById('payroll-report-output');

/**
 * Inicializa a sub-seção de Relatório de Folha de Pagamento.
 * Configura os event listeners.
 */
export const initPayrollReport = () => {
    if (generatePayrollReportBtn) {
        generatePayrollReportBtn.addEventListener('click', generatePayrollReport);
    }
    if (exportPayrollPdfBtn) {
        // Agora, o botão chama a função importada do módulo de PDF
        exportPayrollPdfBtn.addEventListener('click', () => exportReportToPDF('payroll-report-output', 'Relatório de Folha de Pagamento'));
    }
    // Popula o dropdown de obras ao iniciar
    if (payrollReportWorkSelect) {
        payrollReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + [...appState.works].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
};

/**
 * Gera o relatório de folha de pagamento com base nos filtros selecionados.
 */
const generatePayrollReport = async () => {
    const workId = payrollReportWorkSelect?.value;
    const startDate = payrollReportStartDate?.value;
    const endDate = payrollReportEndDate?.value;

    if (!workId || !startDate || !endDate) {
        alert('Selecione a obra e o período para gerar o relatório de folha de pagamento.');
        return;
    }

    showSpinner();
    if (payrollReportOutput) payrollReportOutput.innerHTML = '';
    if (exportPayrollPdfBtn) exportPayrollPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        const entries = await apiClient.fetchData(
            'payroll_entries',
            '*, employees(name, role)',
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
                    <h3>Relatório de Folha de Pagamento</h3>
                    <div class="table-wrapper responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Função</th>
                                    <th>Dias Trab.</th>
                                    <th>Acréscimos (R$)</th>
                                    <th>Descontos (R$)</th>
                                    <th>Observações</th>
                                    <th>Total a Receber (R$)</th>
                                    <th>Medição</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        let grandTotal = 0;
        const headers = ["Nome", "Função", "Dias Trab.", "Acréscimos (R$)", "Descontos (R$)", "Observações", "Total a Receber (R$)", "Medição"];

        entries.forEach(entry => {
            const employee = appState.employees.find(emp => emp.id == entry.employee_id);
            const employeeName = employee?.name || 'N/A';
            const employeeRole = employee?.role || 'N/A';

            // Recalcular o total para o relatório, considerando manual_total
            let totalToReceive = 0;
            if (entry.manual_total !== null) {
                totalToReceive = entry.manual_total;
            } else {
                const employeeSalaryConfig = appState.work_employee_salaries.find(wes => wes.work_id == workId && wes.employee_id == entry.employee_id);
                const employeeSalary = employeeSalaryConfig ? parseFloat(employeeSalaryConfig.salary) : 0;
                const daysInMonth = 30; // Assumindo 30 dias para cálculo proporcional
                if (employeeSalary > 0) {
                    totalToReceive = (employeeSalary / daysInMonth) * (entry.worked_days || 0);
                }
                totalToReceive += (entry.additions || 0);
                totalToReceive -= (entry.discounts || 0);
            }
            grandTotal += totalToReceive;

            reportHTML += `
                <tr>
                    <td data-label="${headers[0]}">${employeeName}</td>
                    <td data-label="${headers[1]}">${employeeRole}</td>
                    <td data-label="${headers[2]}">${entry.worked_days || '0'}</td>
                    <td data-label="${headers[3]}">${formatCurrency(entry.additions || 0)}</td>
                    <td data-label="${headers[4]}">${formatCurrency(entry.discounts || 0)}</td>
                    <td data-label="${headers[5]}">${entry.notes || '---'}</td>
                    <td data-label="${headers[6]}">${formatCurrency(totalToReceive)}</td>
                    <td data-label="${headers[7]}">${entry.include_in_measurement ? 'Sim' : 'Não'}</td>
                </tr>
            `;
        });

        reportHTML += `
                            </tbody>
                        </table>
                    </div>
                    <div class="report-total">Total Geral da Folha de Pagamento: ${formatCurrency(grandTotal)}</div>
                </div>
            </div>
        `;
        if (payrollReportOutput) payrollReportOutput.innerHTML = reportHTML;
        if (exportPayrollPdfBtn) exportPayrollPdfBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatório de folha de pagamento:", e);
        if (payrollReportOutput) payrollReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório de folha de pagamento. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

// 📱 Botão de envio via WhatsApp
const whatsappPayrollBtn = document.getElementById('whatsapp-payroll-btn');
if (whatsappPayrollBtn) {
    whatsappPayrollBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            
            const pdf = await exportReportToPDF('payroll-report', 'Relatório de Folha de Pagamento');
            if (!pdf) {
                hideSpinner();
                return;
            }
            
            const pdfBlob = pdf.output('blob');
            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            
            reader.onloadend = async () => {
                try {
                    const base64Data = reader.result;
                    const currentDate = new Date().toLocaleDateString('pt-BR').replace(/\//g, '_');
                    const fileName = `Relatorio_Folha_Pagamento_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'FOLHA_PAGAMENTO',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=💵 Olá! Segue o relatório de folha de pagamento.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
                        window.open(whatsappLink, '_blank');
                    } else {
                        alert('❌ Erro ao fazer upload para o Google Drive');
                    }
                } catch (error) {
                    alert('❌ Erro: ' + error.message);
                } finally {
                    hideSpinner();
                }
            };
        } catch (error) {
            alert('❌ Erro ao gerar PDF: ' + error.message);
            hideSpinner();
        }
    });
}
