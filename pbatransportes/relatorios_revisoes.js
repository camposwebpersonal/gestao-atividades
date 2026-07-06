// relatorios_revisoes.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF } from './relatorios_revisoes_pdf.js';

const generateMaintenanceReportBtn = document.getElementById('generate-maintenance-report-btn');
const exportMaintenancePdfBtn = document.getElementById('export-maintenance-pdf-btn');
const maintenanceReportOutput = document.getElementById('maintenance-report-output');

/**
 * Inicializa a sub-seção de Relatório de Revisões.
 * Configura os event listeners.
 */
export const initMaintenanceReport = () => {
    if (generateMaintenanceReportBtn) {
        generateMaintenanceReportBtn.addEventListener('click', generateMaintenanceReport);
    }
    if (exportMaintenancePdfBtn) {
        exportMaintenancePdfBtn.addEventListener('click', () => exportReportToPDF('maintenance-report-output', 'Relatório de Manutenções'));
    }
    // Gera o relatório inicial ao carregar a aba
    generateMaintenanceReport();
};

/**
 * Gera o relatório de revisões de equipamentos.
 */
const generateMaintenanceReport = async () => {
    showSpinner();
    if (maintenanceReportOutput) maintenanceReportOutput.innerHTML = '';
    if (exportMaintenancePdfBtn) exportMaintenancePdfBtn.style.display = 'none';

    try {
        // Garante que os equipamentos estejam carregados
        if (appState.equipment.length === 0) {
            appState.equipment = await apiClient.fetchData('equipment');
        }

        const latestEntries = await apiClient.getLatestHorometer();

        const latestHorometers = latestEntries.reduce((acc, item) => {
            acc[item.equipment_id] = item.latest_horometer;
            return acc;
        }, {});

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>Relatório de Revisões de Equipamentos</h3>
                    <p><strong>Data de Geração:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>
                <div class="table-wrapper responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th>Próxima Revisão (h)</th>
                            <th>Horímetro Atual</th>
                            <th>Horas Restantes</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const headers = ["Equipamento", "Próxima Revisão (h)", "Horímetro Atual", "Horas Restantes", "Status"];
        
        // Filtra equipamentos com intervalo de manutenção configurado
        const equipmentsWithMaintenance = appState.equipment.filter(e => 
            e.maintenance_interval_hours && 
            parseFloat(e.maintenance_interval_hours) > 0
        );

        if (equipmentsWithMaintenance.length === 0) {
            reportHTML += `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px;">
                        Nenhum equipamento com intervalo de manutenção configurado.
                    </td>
                </tr>
            `;
        } else {
            equipmentsWithMaintenance.forEach(equip => {
                // Garante que os valores sejam números válidos
                const lastMaintenanceHorometer = parseFloat(equip.last_maintenance_horometer) || 0;
                const maintenanceInterval = parseFloat(equip.maintenance_interval_hours) || 0;
                const currentHorometer = parseFloat(latestHorometers[equip.id]) || lastMaintenanceHorometer || 0;
                
                // Calcula a próxima manutenção
                const nextMaintenance = lastMaintenanceHorometer + maintenanceInterval;
                const remainingHours = nextMaintenance - currentHorometer;

                let status = 'OK';
                let rowClass = '';
                let statusClass = '';
                
                if (remainingHours <= 0) {
                    status = '⚠️ Vencido';
                    rowClass = 'maintenance-overdue';
                    statusClass = 'status-overdue';
                } else if (remainingHours <= (maintenanceInterval * 0.1)) {
                    status = '⏰ Próximo';
                    rowClass = 'maintenance-due-soon';
                    statusClass = 'status-due-soon';
                } else {
                    status = '✅ OK';
                    statusClass = 'status-ok';
                }

                reportHTML += `
                    <tr class="${rowClass}">
                        <td data-label="${headers[0]}">${equip.prefix || 'N/A'} - ${getEquipTypeName(equip.type) || 'N/A'}</td>
                        <td data-label="${headers[1]}">${nextMaintenance.toFixed(2)}</td>
                        <td data-label="${headers[2]}">${currentHorometer.toFixed(2)}</td>
                        <td data-label="${headers[3]}">${remainingHours.toFixed(2)}</td>
                        <td data-label="${headers[4]}" class="${statusClass}">${status}</td>
                    </tr>
                `;
            });
        }

        reportHTML += `
                    </tbody>
                </table>
                </div>
            </div>
        `;

        if (maintenanceReportOutput) maintenanceReportOutput.innerHTML = reportHTML;
        if (exportMaintenancePdfBtn) exportMaintenancePdfBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro no relatório de manutenção:", e);
        if (maintenanceReportOutput) {
            maintenanceReportOutput.innerHTML = `
                <p style="color: red;">
                    Erro ao gerar relatório de manutenção: ${e.message}
                </p>
            `;
        }
    } finally {
        hideSpinner();
    }
};

// 📱 Botão de envio via WhatsApp
const whatsappMaintenanceBtn = document.getElementById('whatsapp-maintenance-btn');
if (whatsappMaintenanceBtn) {
    whatsappMaintenanceBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            
            const pdf = await exportReportToPDF('maintenance-report', 'Relatório de Revisões de Equipamentos');
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
                    const fileName = `Relatorio_Revisoes_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'REVISOES',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=🔧 Olá! Segue o relatório de revisões de equipamentos.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
