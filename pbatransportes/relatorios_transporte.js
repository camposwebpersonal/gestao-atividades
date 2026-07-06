// relatorios_transporte.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF, renewGoogleDriveAuth } from './relatorios_transporte_pdf.js?v=20260302060000'; // Importa a função de exportação de PDF e renovação de autenticação

const transportReportWorkSelect = document.getElementById('transport-report-work-select');
const transportReportBmSelect = document.getElementById('transport-report-bm-select');
const transportReportStartDate = document.getElementById('transport-report-start-date');
const transportReportEndDate = document.getElementById('transport-report-end-date');
const transportReportShowVolume = document.getElementById('transport-report-show-volume');
const transportReportShowUnitVolume = document.getElementById('transport-report-show-unit-volume');
const transportReportShowMeasurement = document.getElementById('transport-report-show-measurement');
const transportReportShowCompany = document.getElementById('transport-report-show-company');
const generateTransportReportBtn = document.getElementById('generate-transport-report-btn');
const exportTransportPdfBtn = document.getElementById('export-transport-pdf-btn');
const transportReportOutput = document.getElementById('transport-report-output');

/**
 * Inicializa a sub-seção de Relatório de Transporte.
 * Configura os event listeners.
 */
export const initTransportReport = () => {
    console.log('🚚 Inicializando relatório de transporte');
    
    if (generateTransportReportBtn) {
        generateTransportReportBtn.addEventListener('click', generateTransportReport);
    }
    if (exportTransportPdfBtn) {
        // Agora, o botão chama a função importada do módulo de PDF
        exportTransportPdfBtn.addEventListener('click', async () => {
            const pdf = await exportReportToPDF('transport-report-output', 'Relatório de Transporte');
            if (pdf) {
                pdf.save(`Relatorio_Transporte_${new Date().toISOString().slice(0, 10)}.pdf`);
            }
        });
    }
    
    // Popula o dropdown de obras ao iniciar (ordenado alfabeticamente)
    if (transportReportWorkSelect) {
        const sortedWorks = [...appState.works].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        transportReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        
        // Event listener para carregar BMs quando obra é selecionada
        transportReportWorkSelect.addEventListener('change', async () => {
            const workId = transportReportWorkSelect.value;
            
            if (!transportReportBmSelect) {
                console.error('❌ Elemento transportReportBmSelect não encontrado');
                return;
            }
            
            if (!workId) {
                transportReportBmSelect.innerHTML = '<option value="">Selecione uma obra primeiro</option>';
                transportReportBmSelect.disabled = true;
                if (transportReportStartDate) transportReportStartDate.value = '';
                if (transportReportEndDate) transportReportEndDate.value = '';
                return;
            }
            
            // Carregar BMs da obra selecionada
            showSpinner();
            try {
                const work = appState.works.find(w => w.id == workId);
                const bmPeriods = work?.config?.measurement_periods || [];
                
                if (bmPeriods.length === 0) {
                    transportReportBmSelect.innerHTML = '<option value="">Nenhuma BM encontrada</option>';
                    transportReportBmSelect.disabled = true;
                } else {
                    transportReportBmSelect.disabled = false;
                    transportReportBmSelect.innerHTML = '<option value="">Selecione a BM</option>' + 
                        bmPeriods.map((bm, index) => {
                            const startFormatted = new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR');
                            const endFormatted = new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR');
                            return `<option value="${index}" data-start="${bm.start}" data-end="${bm.end}">BM ${index + 1} - ${startFormatted} a ${endFormatted}</option>`;
                        }).join('');
                    
                    // Selecionar última BM automaticamente
                    if (bmPeriods.length > 0) {
                        const lastBmIndex = bmPeriods.length - 1;
                        const lastBM = bmPeriods[lastBmIndex];
                        transportReportBmSelect.value = lastBmIndex;
                        if (transportReportStartDate) transportReportStartDate.value = lastBM.start;
                        if (transportReportEndDate) transportReportEndDate.value = lastBM.end;
                        
                        // Gerar relatório automaticamente
                        setTimeout(() => generateTransportReport(), 100);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar BMs:', error);
            } finally {
                hideSpinner();
            }
        });
        
        // Event listener para atualizar datas quando BM é selecionada manualmente
        if (transportReportBmSelect) {
            transportReportBmSelect.addEventListener('change', () => {
                const selectedOption = transportReportBmSelect.options[transportReportBmSelect.selectedIndex];
                if (selectedOption && selectedOption.dataset.start && selectedOption.dataset.end) {
                    if (transportReportStartDate) transportReportStartDate.value = selectedOption.dataset.start;
                    if (transportReportEndDate) transportReportEndDate.value = selectedOption.dataset.end;
                    generateTransportReport();
                }
            });
        }
    }
    
    // 🔄 Botão Renovar Autenticação Drive
    const renewDriveAuthBtn = document.getElementById('renew-drive-auth-transport-btn');
    if (renewDriveAuthBtn) {
        console.log('🔄 Configurando botão Renovar Auth Drive para TRANSPORTE');
        // Remove event listener antigo para evitar duplicação
        renewDriveAuthBtn.replaceWith(renewDriveAuthBtn.cloneNode(true));
        const newRenewBtn = document.getElementById('renew-drive-auth-transport-btn');
        
        newRenewBtn.addEventListener('click', async () => {
            try {
                await renewGoogleDriveAuth();
                alert('✅ Autenticação renovada com sucesso!');
            } catch (error) {
                alert('❌ Erro ao renovar autenticação: ' + error.message);
            }
        });
    }
};

/**
 * Gera o relatório de transporte com base nos filtros selecionados.
 */
const generateTransportReport = async () => {
    const workId = transportReportWorkSelect?.value;
    const startDate = transportReportStartDate?.value;
    const endDate = transportReportEndDate?.value;
    const showVolumeColumn = transportReportShowVolume?.checked !== false; // Padrão: true (Volume Total)
    const showUnitVolumeColumn = transportReportShowUnitVolume?.checked !== false; // Padrão: true (Volume m³)
    const showMeasurementColumn = transportReportShowMeasurement?.checked || false;

    if (!workId || !startDate || !endDate) {
        alert('Selecione a obra e o período para gerar o relatório de transporte.');
        return;
    }

    showSpinner();
    if (transportReportOutput) transportReportOutput.innerHTML = '';
    if (exportTransportPdfBtn) exportTransportPdfBtn.style.display = 'none';

    try {
        // Garantir que material_types está carregado
        if (!appState.material_types || appState.material_types.length === 0) {
            console.log('📦 Carregando material_types...');
            appState.material_types = await apiClient.fetchData('material_types', 'id, name');
            console.log('✅ material_types carregado:', appState.material_types.length, 'tipos');
        }

        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);
        const materialTransportPrices = work?.config?.material_transport_prices || [];

        const entries = await apiClient.fetchData(
            'transport_entries',
            '*',
            'date',
            true // ascending
        ).then(data => data.filter(entry =>
            entry.work_id == workId && entry.date >= startDate && entry.date <= endDate
        ));

        // Buscar equipamentos do appState
        entries.forEach(entry => {
            if (entry.equipment_id) {
                entry.equipment = appState.equipment.find(eq => eq.id === parseInt(entry.equipment_id));
            }
        });

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
                    <h3>Relatório de Transporte de Materiais</h3>
                    <div class="table-wrapper responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Equipamento</th>
                                    <th>Material</th>
                                    ${showUnitVolumeColumn ? '<th>Volume (m³)</th>' : ''}
                                    <th>Preço Viagem (R$)</th>
                                    <th>Qtd. Viagens</th>
                                    ${showVolumeColumn ? '<th>Volume Total (m³)</th>' : ''}
                                    <th>Valor Total (R$)</th>
                                    ${showMeasurementColumn ? '<th>Medição</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
        `;

        let grandTotal = 0;
        let totalTrips = 0;
        let totalVolume = 0;

        // Agrupar entries por data para inserir subtotais
        const entriesByDate = {};
        entries.forEach(entry => {
            const dateKey = entry.date;
            if (!entriesByDate[dateKey]) {
                entriesByDate[dateKey] = [];
            }
            entriesByDate[dateKey].push(entry);
        });

        // Processar cada grupo de data
        Object.keys(entriesByDate).sort().forEach(dateKey => {
            const dateEntries = entriesByDate[dateKey];
            let dateTotal = 0;
            let dateTrips = 0;
            let dateVolume = 0;

            // Processar cada entry da data
            dateEntries.forEach(entry => {
                console.log('🔍 Entry completo:', JSON.stringify(entry, null, 2));
                console.log('🔍 materialTransportPrices:', JSON.stringify(materialTransportPrices, null, 2));
                
                const materialConfig = materialTransportPrices.find(mp => mp.id == entry.material_price_config_id);
                console.log('🔍 materialConfig encontrado:', JSON.stringify(materialConfig, null, 2));
                console.log('🔍 appState.material_types:', JSON.stringify(appState.material_types, null, 2));
                
                // Tentar buscar o nome do material de várias formas
                let materialName = 'Material não especificado';
                
                if (materialConfig) {
                    // 1. Tentar buscar pelo material_type_id
                    if (materialConfig.material_type_id) {
                        const materialType = appState.material_types.find(mt => mt.id == materialConfig.material_type_id);
                        if (materialType && materialType.name) {
                            materialName = materialType.name;
                        }
                    }
                    // 2. Se não encontrou, tentar propriedades diretas do config
                    if (materialName === 'Material não especificado') {
                        materialName = materialConfig.material_name || materialConfig.name || materialConfig.description || 'Config sem nome';
                    }
                }
                
                console.log('🟢 Material final:', materialName);
                
                const volume = materialConfig?.volume || 0;
                const pricePerTrip = materialConfig?.price || 0;
                const tripCount = entry.trip_count || 0;
                const totalValue = pricePerTrip * tripCount;
                const totalVolumeForEntry = volume * tripCount;
                
                grandTotal += totalValue;
                totalTrips += tripCount;
                totalVolume += totalVolumeForEntry;
                
                dateTotal += totalValue;
                dateTrips += tripCount;
                dateVolume += totalVolumeForEntry;

                reportHTML += `
                    <tr>
                        <td>${new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>${entry.equipment?.prefix || 'N/A'} - ${entry.equipment?.type_short || getEquipTypeName(entry.equipment?.type) || 'N/A'}</td>
                        <td>${materialName}</td>
                        ${showUnitVolumeColumn ? `<td>${volume.toFixed(2)}</td>` : ''}
                        <td>${formatCurrency(pricePerTrip)}</td>
                        <td>${tripCount}</td>
                        ${showVolumeColumn ? `<td>${totalVolumeForEntry.toFixed(2)}</td>` : ''}
                        <td>${formatCurrency(totalValue)}</td>
                        ${showMeasurementColumn ? `<td>${entry.include_in_measurement ? 'Sim' : 'Não'}</td>` : ''}
                    </tr>
                `;
            });

            // Adicionar linha de subtotal da data
            const numEmptyColsSubtotal = 3 + (showUnitVolumeColumn ? 1 : 0) + 1; // Data+Equip+Material + Volume(m³) + Preço
            reportHTML += `
                <tr style="font-weight: bold; background: #555; color: #fff;">
                    <td colspan="${numEmptyColsSubtotal}">Subtotal ${new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>${dateTrips}</td>
                    ${showVolumeColumn ? `<td>${dateVolume.toFixed(2)}</td>` : ''}
                    <td>${formatCurrency(dateTotal)}</td>
                    ${showMeasurementColumn ? '<td></td>' : ''}
                </tr>
                <tr style="height: 12px; background: transparent;">
                    <td colspan="${5 + (showUnitVolumeColumn ? 1 : 0) + (showVolumeColumn ? 1 : 0) + (showMeasurementColumn ? 1 : 0)}" style="border: none; background: transparent;"></td>
                </tr>
            `;
        });

        // Adicionar linha vazia separadora antes dos totais
        const totalCols = 5 + (showUnitVolumeColumn ? 1 : 0) + (showVolumeColumn ? 1 : 0) + (showMeasurementColumn ? 1 : 0);
        reportHTML += `
                            <tr style="height: 15px; background: transparent;">
                                <td colspan="${totalCols}" style="border: none; background: transparent;"></td>
                            </tr>
        `;

        // Adicionar linha de totais
        const numEmptyCols = 3 + (showUnitVolumeColumn ? 1 : 0) + 1; // Data+Equip+Material + Volume(m³) + Preço
        reportHTML += `
                            <tr style="font-weight: bold; background: #3a3a3a; color: #fff;">
                                <td colspan="${numEmptyCols}">TOTAIS</td>
                                <td>${totalTrips}</td>
                                ${showVolumeColumn ? `<td>${totalVolume.toFixed(2)}</td>` : ''}
                                <td>${formatCurrency(grandTotal)}</td>
                                ${showMeasurementColumn ? '<td></td>' : ''}
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="report-total">Total Geral de Transporte: ${formatCurrency(grandTotal)}</div>
                </div>
            </div>
        `;
        if (transportReportOutput) transportReportOutput.innerHTML = reportHTML;
        if (exportTransportPdfBtn) exportTransportPdfBtn.style.display = 'inline-block';
        
        // Mostrar botões WhatsApp e Drive
        const whatsappBtn = document.getElementById('whatsapp-transport-btn');
        const driveBtn = document.getElementById('drive-transport-btn');
        if (whatsappBtn) whatsappBtn.style.display = 'inline-block';
        if (driveBtn) driveBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatório de transporte:", e);
        if (transportReportOutput) transportReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório de transporte. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

// 📱 Botão WhatsApp - Envia via Google Drive
const whatsappTransportBtn = document.getElementById('whatsapp-transport-btn');
if (whatsappTransportBtn) {
    whatsappTransportBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            const pdf = await exportReportToPDF('transport-report-output', 'Relatório de Transporte');
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
                    const fileName = `Relatorio_Transporte_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'TRANSPORTE',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=🚚%20Relatório%20de%20Transporte%0A%0A📎%20Link%20do%20PDF:%0A${encodeURIComponent(driveLink)}`;
                        window.open(whatsappLink, '_blank');
                    } else {
                        alert('❌ Erro ao fazer upload: ' + (result.error || 'Erro desconhecido'));
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

// ☁️ Botão Google Drive - Salva direto no Drive
const driveTransportBtn = document.getElementById('drive-transport-btn');
if (driveTransportBtn) {
    driveTransportBtn.addEventListener('click', async () => {
        try {
            showSpinner();
            const pdf = await exportReportToPDF('transport-report-output', 'Relatório de Transporte');
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
                    const fileName = `Relatorio_Transporte_${currentDate}.pdf`;
                    
                    const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pdfData: base64Data,
                            fileName: fileName,
                            workName: 'TRANSPORTE',
                            companyName: 'PBA TRANSPORTES',
                            bmLabel: 'RELATÓRIO',
                            dateRange: new Date().toLocaleDateString('pt-BR')
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success && result.fileId) {
                        const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                        alert(`✅ PDF salvo no Google Drive!\\n\\n📎 Link: ${driveLink}`);
                        // Copiar link para clipboard
                        navigator.clipboard.writeText(driveLink);
                    } else {
                        alert('❌ Erro ao fazer upload: ' + (result.error || 'Erro desconhecido'));
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
