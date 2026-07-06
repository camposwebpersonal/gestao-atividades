// relatorios_partes_diarias.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, getBMLabelForDate, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportDailyPartsReceivedToPDF } from './relatorios_partes_diarias_received_pdf.js';
import { exportDailyPartsNotReceivedToPDF } from './relatorios_partes_diarias_not_received_pdf.js';

const dailyPartsReportWorkSelect = document.getElementById('daily-parts-report-work-select');
const dailyPartsReportBmSelect = document.getElementById('daily-parts-report-bm-select');
const generateDailyPartsReportBtn = document.getElementById('generate-daily-parts-report-btn');
const exportDailyPartsReceivedPdfBtn = document.getElementById('export-daily-parts-received-pdf-btn');
const exportDailyPartsNotReceivedPdfBtn = document.getElementById('export-daily-parts-not-received-pdf-btn');
const dailyPartsReportOutput = document.getElementById('daily-parts-report-output');

/**
 * Verifica se um equipamento está ativo durante um período específico.
 * @param {string} workId - ID da obra
 * @param {string} equipmentId - ID do equipamento  
 * @param {string} startDate - Data de início do período (YYYY-MM-DD)
 * @param {string} endDate - Data de fim do período (YYYY-MM-DD)
 * @returns {Promise<boolean>} - true se o equipamento está ativo no período
 */
const isEquipmentActiveInPeriod = async (workId, equipmentId, startDate, endDate) => {
    try {
        const lastStatusInPeriod = await apiClient.getEquipmentStatusAtDate(workId, equipmentId, endDate);
        
        if (!lastStatusInPeriod) {
            return true;
        }
        
        if (lastStatusInPeriod.is_demobilized) {
            const dailyEntries = await apiClient.fetchDailyEntries(workId, equipmentId, lastStatusInPeriod.date, endDate);
            return dailyEntries.some(entry => entry.date > lastStatusInPeriod.date && entry.is_mobilization);
        }
        
        return lastStatusInPeriod.is_mobilization;
    } catch (error) {
        console.error('Erro ao verificar status do equipamento:', error);
        return true;
    }
};

/**
 * Inicializa a sub-seção de Relatório de Partes Diárias.
 */
export const initDailyPartsReport = async () => {
    showSpinner();
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
    }
    if (appState.equipment.length === 0) {
        appState.equipment = await apiClient.fetchData('equipment');
    }
    if (appState.client_companies.length === 0) {
        appState.client_companies = await apiClient.fetchData('client_companies');
    }
    if (appState.my_companies.length === 0) {
        appState.my_companies = await apiClient.fetchData('my_companies');
    }

    if (dailyPartsReportWorkSelect) {
        dailyPartsReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + appState.works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        dailyPartsReportWorkSelect.addEventListener('change', handleDailyPartsWorkSelectChange);
    }
    if (generateDailyPartsReportBtn) {
        generateDailyPartsReportBtn.addEventListener('click', generateDailyPartsReport);
    }
    if (exportDailyPartsReceivedPdfBtn) {
        exportDailyPartsReceivedPdfBtn.addEventListener('click', () => exportDailyPartsReceivedToPDF('daily-parts-report-output', 'Relatório de Partes Diárias Recebidas'));
    }
    if (exportDailyPartsNotReceivedPdfBtn) {
        exportDailyPartsNotReceivedPdfBtn.addEventListener('click', () => exportDailyPartsNotReceivedToPDF('daily-parts-report-output', 'Relatório de Partes Diárias Não Recebidas'));
    }

    if (dailyPartsReportBmSelect) dailyPartsReportBmSelect.innerHTML = '<option value="">Selecione uma BM</option>';
    if (dailyPartsReportOutput) dailyPartsReportOutput.innerHTML = '';
    if (exportDailyPartsReceivedPdfBtn) exportDailyPartsReceivedPdfBtn.style.display = 'none';
    if (exportDailyPartsNotReceivedPdfBtn) exportDailyPartsNotReceivedPdfBtn.style.display = 'none';

    hideSpinner();
};

/**
 * Lida com a mudança na seleção da obra.
 */
const handleDailyPartsWorkSelectChange = () => {
    const workId = dailyPartsReportWorkSelect.value;
    if (dailyPartsReportBmSelect) dailyPartsReportBmSelect.innerHTML = '<option value="">Selecione uma BM</option>';
    if (dailyPartsReportOutput) dailyPartsReportOutput.innerHTML = '';
    if (exportDailyPartsReceivedPdfBtn) exportDailyPartsReceivedPdfBtn.style.display = 'none';
    if (exportDailyPartsNotReceivedPdfBtn) exportDailyPartsNotReceivedPdfBtn.style.display = 'none';

    if (!workId) return;

    const work = appState.works.find(w => w.id == workId);
    const bmPeriods = work?.config?.measurement_periods || [];
    const bmLabels = new Set(bmPeriods.map((_, index) => `BM ${index + 1}`));

    if (dailyPartsReportBmSelect) {
        dailyPartsReportBmSelect.innerHTML = '<option value="">Selecione uma BM</option>' + Array.from(bmLabels).map(label => `<option value="${label}">${label}</option>`).join('');
    }
};

/**
 * **FUNÇÃO CORRIGIDA E OTIMIZADA**
 * Gera o relatório de partes diárias com base nos filtros selecionados.
 */
const generateDailyPartsReport = async () => {
    const workId = dailyPartsReportWorkSelect?.value;
    const bmLabel = dailyPartsReportBmSelect?.value;

    if (!workId || !bmLabel) {
        alert('Por favor, selecione a obra e a BM para gerar o relatório de partes diárias.');
        return;
    }

    showSpinner();
    if (dailyPartsReportOutput) dailyPartsReportOutput.innerHTML = '';
    if (exportDailyPartsReceivedPdfBtn) exportDailyPartsReceivedPdfBtn.style.display = 'none';
    if (exportDailyPartsNotReceivedPdfBtn) exportDailyPartsNotReceivedPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        const bmIndex = parseInt(bmLabel.replace('BM ', '')) - 1;
        const bmPeriod = work.config?.measurement_periods?.[bmIndex];

        if (!bmPeriod) {
            throw new Error('Período da BM não encontrado.');
        }

        // 1. Pegar todos os equipamentos configurados para a obra.
        const allEquipmentInWork = work.config?.equipment?.map(e => e.equipment_id) || [];
        
        // 2. Filtrar apenas os que estavam ativos no período da BM.
        const activeEquipmentIds = new Set();
        for (const equipId of allEquipmentInWork) {
            if (await isEquipmentActiveInPeriod(workId, equipId, bmPeriod.start, bmPeriod.end)) {
                activeEquipmentIds.add(equipId);
            }
        }
        
        if (activeEquipmentIds.size === 0) {
            dailyPartsReportOutput.innerHTML = '<p>Nenhum equipamento ativo encontrado para esta BM.</p>';
            hideSpinner();
            return;
        }

        // 3. Buscar os lançamentos APENAS dos equipamentos ativos dentro do período da BM.
        const allDailyEntries = await apiClient.fetchDailyEntries(workId, null, bmPeriod.start, bmPeriod.end);
        
        const receivedEquipments = new Set();
        const notReceivedEquipments = new Set();

        // 4. Analisar os lançamentos para cada equipamento ativo.
        for (const equipId of activeEquipmentIds) {
            const equipment = appState.equipment.find(e => e.id == equipId);
            const equipName = equipment ? `${equipment.prefix} - ${getEquipTypeName(equipment.type)}` : `ID ${equipId}`;

            // Filtra os lançamentos para o equipamento e BM específicos.
            const equipmentEntriesInBm = allDailyEntries.filter(
                e => e.equipment_id == equipId && e.bm_label === bmLabel
            );
            
            // Verifica se QUALQUER um dos lançamentos foi marcado como recebido.
            // A verificação `== true` é mais robusta que `=== true`.
            const hasReceivedEntry = equipmentEntriesInBm.some(e => e.is_daily_part_received == true);

            if (hasReceivedEntry) {
                receivedEquipments.add(equipName);
            } else {
                notReceivedEquipments.add(equipName);
            }
        }
        
        // 5. Montar o HTML do relatório (lógica inalterada).
        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'Minha Empresa'}</h3>
                    <p><strong>Obra:</strong> ${work?.name || 'N/A'}<br>
                       <strong>Cliente:</strong> ${client?.name || 'N/A'}</p>
                    <p><strong>Relatório de Partes Diárias para:</strong> ${bmLabel}</p>
                    <p><strong>Período da BM:</strong> ${new Date(bmPeriod.start + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(bmPeriod.end + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>
        `;

        const sortedReceivedEquipments = Array.from(receivedEquipments).sort();
        reportHTML += `
                <div class="report-summary" id="daily-parts-received-table-container">
                    <h3>Partes Diárias Recebidas</h3>
                    <div class="table-wrapper responsive">
                        <table id="daily-parts-received-table">
                            <thead><tr><th>Equipamento</th></tr></thead>
                            <tbody>
        `;
        sortedReceivedEquipments.forEach(equipName => {
            reportHTML += `<tr><td data-label="Equipamento">${equipName}</td></tr>`;
        });
        reportHTML += `
                            </tbody>
                            <tfoot><tr><td><strong>Total: ${sortedReceivedEquipments.length} equipamentos</strong></td></tr></tfoot>
                        </table>
                    </div>
                </div>
        `;

        const sortedNotReceivedEquipments = Array.from(notReceivedEquipments).sort();
        reportHTML += `
                <div class="report-summary" id="daily-parts-not-received-table-container">
                    <h3>Partes Diárias Não Recebidas</h3>
                    <div class="table-wrapper responsive">
                        <table id="daily-parts-not-received-table">
                            <thead><tr><th>Equipamento</th></tr></thead>
                            <tbody>
        `;
        sortedNotReceivedEquipments.forEach(equipName => {
            reportHTML += `<tr><td data-label="Equipamento">${equipName}</td></tr>`;
        });
        reportHTML += `
                            </tbody>
                            <tfoot><tr><td><strong>Total: ${sortedNotReceivedEquipments.length} equipamentos</strong></td></tr></tfoot>
                        </table>
                    </div>
                </div>

                <div class="report-summary" style="margin-top: 30px;">
                    <h3>Resumo Geral</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center;">
                        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px;">
                            <h4 style="color: #2e7d32;">Partes Recebidas</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #2e7d32;">${sortedReceivedEquipments.length}</p>
                        </div>
                        <div style="background-color: #ffebee; padding: 15px; border-radius: 5px;">
                            <h4 style="color: #c62828;">Partes Não Recebidas</h4>
                            <p style="font-size: 2rem; font-weight: bold; color: #c62828;">${sortedNotReceivedEquipments.length}</p>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 15px;">
                        <p><strong>Total de Equipamentos Ativos na BM: ${activeEquipmentIds.size}</strong></p>
                        <p><strong>Taxa de Recebimento: ${activeEquipmentIds.size > 0 ? ((sortedReceivedEquipments.length / activeEquipmentIds.size) * 100).toFixed(1) : 0}%</strong></p>
                    </div>
                </div>
            </div>
        `;

        if (dailyPartsReportOutput) dailyPartsReportOutput.innerHTML = reportHTML;
        if (exportDailyPartsReceivedPdfBtn) exportDailyPartsReceivedPdfBtn.style.display = 'inline-block';
        if (exportDailyPartsNotReceivedPdfBtn) exportDailyPartsNotReceivedPdfBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatório de partes diárias:", e);
        if (dailyPartsReportOutput) dailyPartsReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório de partes diárias. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};