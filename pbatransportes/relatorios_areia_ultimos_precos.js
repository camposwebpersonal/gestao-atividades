// relatorios_areia_ultimos_precos.js - Módulo para Relatório de Últimos Preços de Areia
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, extractReportInfo, generatePDFFileName, addPdfCoverPage , sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';

// Elementos do DOM para o Relatório de Últimos Preços de Areia
const sandLatestPricesReportBtn = document.getElementById('generate-sand-latest-prices-report-btn');
const exportSandLatestPricesPdfBtn = document.getElementById('export-sand-latest-prices-pdf-btn');
const sandLatestPricesReportOutput = document.getElementById('sand-latest-prices-report-output');
const sandLatestPricesReportCoverCheckbox = document.getElementById('sand-latest-prices-report-cover-checkbox');

/**
 * Inicializa a sub-seção de Últimos Preços de Areia.
 */
export const initSandLatestPricesReport = async () => {
    // Event listeners
    if (sandLatestPricesReportBtn) {
        sandLatestPricesReportBtn.addEventListener('click', generateSandLatestPricesReport);
    }
    if (exportSandLatestPricesPdfBtn) {
        exportSandLatestPricesPdfBtn.addEventListener('click', () => generateSandLatestPricesReport(false));
    }

    // Limpa output e esconde botão de PDF
    if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = '';
    if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'none';

    // Gera o relatório inicial
    await generateSandLatestPricesReport();
};

/**
 * Gera o relatório de últimos preços de areia.
 * @param {boolean} preview - Se é apenas uma pré-visualização.
 */
const generateSandLatestPricesReport = async (preview = true) => {
    showSpinner();
    if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = '';
    if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'none';
    const withCover = sandLatestPricesReportCoverCheckbox.checked;

    try {
        // Garante que as empresas estejam carregadas para exibir os nomes
        if (appState.my_companies.length === 0) {
            appState.my_companies = await apiClient.fetchData('my_companies');
        }
        if (appState.client_companies.length === 0) {
            appState.client_companies = await apiClient.fetchData('client_companies');
        }

        const latestPrices = await apiClient.fetchLatestSandPrices();

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>PBA TRANSPORTES</h3>
                    <p><strong>Relatório de Últimos Preços de Fornecimento de Areia por Rota</strong></p>
                    <p><strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Últimos Preços Registrados</h3>
                    <div class="table-wrapper responsive">
                        <table id="sand-latest-prices-table">
                            <thead>
                                <tr>
                                    <th>Empresa Fornecedora</th>
                                    <th>Empresa Cliente</th>
                                    <th>Local de Saída</th>
                                    <th>Local de Entrega</th>
                                    <th>Último Preço M³ (R$)</th>
                                    <th>Data do Registro</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        if (latestPrices.length === 0) {
            reportHTML += `<tr><td colspan="6">Nenhum preço de areia registrado.</td></tr>`;
        } else {
            latestPrices.forEach(price => {
                const myCompanyName = price.my_company?.name || 'N/A';
                const clientCompanyName = price.client_company?.name || 'N/A';
                const registeredDate = new Date(price.created_at).toLocaleDateString('pt-BR');

                reportHTML += `
                                <tr>
                                    <td>${myCompanyName}</td>
                                    <td>${clientCompanyName}</td>
                                    <td>${price.output_location || 'AREAL'}</td>
                                    <td>${price.delivery_location}</td>
                                    <td>${formatCurrency(price.price_m3)}</td>
                                    <td>${registeredDate}</td>
                                </tr>
                `;
            });
        }

        reportHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = reportHTML;
        if (exportSandLatestPricesPdfBtn) exportSandLatestPricesPdfBtn.style.display = 'inline-block';

        if (!preview) {
            // Importa a função de PDF aqui para evitar circular dependency
            const { exportSandLatestPricesReportToPDF } = await import('./relatorios_areia_ultimos_precos_pdf.js');
            await exportSandLatestPricesReportToPDF(sandLatestPricesReportOutput.id, 'Relatório de Últimos Preços de Areia', withCover);
        }

    } catch (e) {
        console.error("Erro ao gerar relatório de últimos preços de areia:", e);
        if (sandLatestPricesReportOutput) sandLatestPricesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

// 📱 Botão de envio via WhatsApp
const whatsappSandPricesBtn = document.getElementById('whatsapp-sand-prices-btn');
if (whatsappSandPricesBtn) {
    whatsappSandPricesBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            
            const pdf = await exportSandLatestPricesReportToPDF('sand-prices-report', 'Relatório de Últimos Preços de Areia', false);
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
                    const fileName = `Relatorio_Ultimos_Precos_Areia_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'AREIA_PRECOS',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=🏖️ Olá! Segue o relatório de últimos preços de areia.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
