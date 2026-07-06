// relatorios_areia_notas.js - Módulo para Relatório de Notas Fiscais de Areia
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, extractReportInfo, generatePDFFileName, addPdfCoverPage , sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';

// Elementos do DOM para o Relatório de Notas Fiscais de Areia
const sandInvoicesStatusSelect = document.getElementById('sand-invoices-status-select');
const sandInvoicesClientSelect = document.getElementById('sand-invoices-client-select');
const sandInvoicesStartDate = document.getElementById('sand-invoices-start-date');
const sandInvoicesEndDate = document.getElementById('sand-invoices-end-date');
const generateSandInvoicesReportBtn = document.getElementById('generate-sand-invoices-report-btn');
const exportSandInvoicesPdfBtn = document.getElementById('export-sand-invoices-pdf-btn');
const sandInvoicesReportOutput = document.getElementById('sand-invoices-report-output');
const sandInvoicesReportCoverCheckbox = document.getElementById('sand-invoices-report-cover-checkbox');

/**
 * Inicializa a sub-seção de Relatório de Notas Fiscais de Areia.
 */
export const initSandInvoicesReport = async () => {
    // Popula dropdown de clientes com base nas configurações de fornecimento
    if (sandInvoicesClientSelect) {
        // Garante que as empresas cliente estejam carregadas
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }
        // Garante que as configurações de fornecimento estejam carregadas para saber quais clientes têm fornecimento
        if (appState.sand_supply_configs.length === 0) {
            appState.sand_supply_configs = await apiClient.fetchSandSupplyConfigs();
        }

        const uniqueClientIds = new Set(appState.sand_supply_configs.map(c => c.client_company_id));
        sandInvoicesClientSelect.innerHTML = '<option value="TODOS">Todos</option>' + 
            Array.from(uniqueClientIds).map(id => {
                const client = appState.client_companies.find(c => c.id == id);
                return client ? `<option value="${client.id}">${client.name}</option>` : '';
            }).join('');
    }

    // Event listeners
    if (generateSandInvoicesReportBtn) {
        generateSandInvoicesReportBtn.addEventListener('click', generateSandInvoicesReport);
    }
    if (exportSandInvoicesPdfBtn) {
        exportSandInvoicesPdfBtn.addEventListener('click', () => generateSandInvoicesReport(false));
    }

    // Limpa output e esconde botão de PDF
    if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = '';
    if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'none';
};

/**
 * Gera o relatório de notas fiscais de areia.
 * @param {boolean} preview - Se é apenas uma pré-visualização.
 */
const generateSandInvoicesReport = async (preview = true) => {
    const statusFilter = sandInvoicesStatusSelect.value;
    const clientFilter = sandInvoicesClientSelect.value;
    let startDate = sandInvoicesStartDate.value;
    let endDate = sandInvoicesEndDate.value;
    const withCover = sandInvoicesReportCoverCheckbox.checked;

    showSpinner();
    if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = '';
    if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'none';

    try {
        // Ajusta as datas se apenas uma for fornecida pelo usuário
        if (startDate && !endDate) {
            endDate = new Date().toISOString().split('T')[0]; // Até a data atual
        } else if (!startDate && endDate) {
            startDate = '2000-01-01'; // Desde uma data muito antiga
        }

        // Busca todas as entregas e filtra no frontend
        const allDeliveries = await apiClient.fetchSandDeliveries(null, startDate, endDate, statusFilter);
        
        let filteredDeliveries = allDeliveries;

        if (clientFilter !== 'TODOS') {
            filteredDeliveries = filteredDeliveries.filter(d => d.supply_config.client_company_id == clientFilter);
        }

        // Agrupa por empresa cliente para o relatório
        const groupedByClient = filteredDeliveries.reduce((acc, delivery) => {
            const clientCompanyId = delivery.supply_config.client_company_id;
            if (!acc[clientCompanyId]) {
                acc[clientCompanyId] = {
                    clientName: appState.client_companies.find(c => c.id == clientCompanyId)?.name || 'N/A',
                    totalRomaneios: 0,
                    totalVolume: 0,
                    totalValue: 0,
                    deliveries: []
                };
            }
            acc[clientCompanyId].totalRomaneios++;
            acc[clientCompanyId].totalVolume += parseFloat(delivery.volume_m3 || 0);
            acc[clientCompanyId].totalValue += parseFloat(delivery.total_value || 0);
            acc[clientCompanyId].deliveries.push(delivery);
            return acc;
        }, {});

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>PBA TRANSPORTES</h3>
                    <p><strong>Relatório de Notas Fiscais de Areia</strong></p>
                    <p><strong>Status:</strong> ${sandInvoicesStatusSelect.options[sandInvoicesStatusSelect.selectedIndex].text}</p>
                    <p><strong>Período:</strong> ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} a ${endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Resumo por Empresa Cliente</h3>
                    <div class="table-wrapper responsive">
                        <table id="sand-invoices-summary-table">
                            <thead>
                                <tr>
                                    <th>Empresa Cliente</th>
                                    <th>Total Romaneios</th>
                                    <th>Volume Total (m³)</th>
                                    <th>Valor Total (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        let grandTotalVolume = 0;
        let grandTotalValue = 0;

        if (Object.keys(groupedByClient).length === 0) {
            reportHTML += `<tr><td colspan="4">Nenhum dado encontrado para os filtros selecionados.</td></tr>`;
        } else {
            Object.values(groupedByClient).forEach(clientData => {
                grandTotalVolume += clientData.totalVolume;
                grandTotalValue += clientData.totalValue;
                reportHTML += `
                                <tr>
                                    <td>${clientData.clientName}</td>
                                    <td>${clientData.totalRomaneios}</td>
                                    <td>${clientData.totalVolume.toFixed(2)}</td>
                                    <td>${formatCurrency(clientData.totalValue)}</td>
                                </tr>
                `;
            });
        }

        reportHTML += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="text-align: right; font-weight: bold;">Total Geral:</td>
                                    <td></td>
                                    <td style="font-weight: bold;">${grandTotalVolume.toFixed(2)}</td>
                                    <td style="font-weight: bold;">${formatCurrency(grandTotalValue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = reportHTML;
        if (exportSandInvoicesPdfBtn) exportSandInvoicesPdfBtn.style.display = 'inline-block';

        if (!preview) {
            // Importa a função de PDF aqui para evitar circular dependency
            const { exportSandInvoicesReportToPDF } = await import('./relatorios_areia_notas_pdf.js');
            await exportSandInvoicesReportToPDF(sandInvoicesReportOutput.id, 'Relatório de Notas Fiscais de Areia', withCover);
        }

    } catch (e) {
        console.error("Erro ao gerar relatório de notas fiscais de areia:", e);
        if (sandInvoicesReportOutput) sandInvoicesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

// 📱 Botão de envio via WhatsApp
const whatsappSandInvoicesBtn = document.getElementById('whatsapp-sand-invoices-btn');
if (whatsappSandInvoicesBtn) {
    whatsappSandInvoicesBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            
            const pdf = await exportSandInvoicesReportToPDF('sand-invoices-report', 'Relatório de Notas Fiscais de Areia', false);
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
                    const fileName = `Relatorio_Notas_Areia_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'AREIA_NOTAS',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=🧾 Olá! Segue o relatório de notas fiscais de areia.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
