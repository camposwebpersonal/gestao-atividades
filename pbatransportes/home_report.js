// home_report.js - Relatório de Equipamentos na Aba Início
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatDateBR, addPdfCoverPage, debounce, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportEquipmentReportToPDF } from './home_report_pdf.js'; // Importa a função de PDF
import { calculateEquipmentTotalValue, calculateGeneralExpensesImpact, EXPENSE_IMPACT_TYPES, MEASUREMENT_TYPES } from './calculos_valores.js?v=20260302090000';

// Utilitário de arredondamento preciso (mesma lógica do relatório de medição)
const preciseRounding = {
    round2(value) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    formatCurrencyPrecise(value) {
        const rounded = this.round2(value);
        return formatCurrency(rounded);
    }
};

/**
 * 🔄 RECARREGA a lista de obras do servidor para refletir mudanças em "is_closed"
 * @param {string} reportType - Tipo de relatório ('byWork' ou 'lastWork')
 */
async function reloadWorksListAndGenerate(reportType) {
    console.log(`🔄 Recarregando lista de obras para relatório: ${reportType}`);
    
    try {
        // Busca obras atualizadas do servidor
        const allWorks = await apiClient.fetchData('works', '*, client_companies(name)');
        
        // Atualiza appState com obras NÃO ENCERRADAS
        const oldCount = appState.works.length;
        appState.works = allWorks
            .filter(work => !work.is_closed) // Filtra apenas obras não encerradas
            .sort((a, b) => {
                // Ordena por data de início da primeira BM (mais recente primeiro)
                const dateA = a.config?.measurement_periods?.[0]?.start || '1900-01-01';
                const dateB = b.config?.measurement_periods?.[0]?.start || '1900-01-01';
                return dateB.localeCompare(dateA);
            });
        
        const newCount = appState.works.length;
        
        if (oldCount !== newCount) {
            console.log(`✅ Obras atualizadas: ${oldCount} → ${newCount} (${newCount - oldCount > 0 ? '+' : ''}${newCount - oldCount})`);
        } else {
            console.log(`✅ Lista de obras atualizada (${newCount} obras ativas)`);
        }
        
        // Invalida cache das Últimas BMs para forçar recálculo
        if (reportType === 'lastWork') {
            lastBmsCache = null;
            lastBmsCacheTime = null;
            console.log('♻️ Cache de Últimas BMs invalidado');
        }
        
        // Atualiza controles de filtro de obras
        updateWorkFilterControls();
        
    } catch (error) {
        console.error('❌ Erro ao recarregar lista de obras:', error);
        alert('Erro ao atualizar lista de obras. Tente recarregar a página.');
    }
}

const homeReportContainers = {
    byWork: document.getElementById('equipment-by-work-report'),
    lastWork: document.getElementById('equipment-last-work-report'),
    history: document.getElementById('equipment-history-report')
};

const tables = {
    byWork: document.querySelector('#equipment-by-work-table tbody'),
    lastWork: document.getElementById('equipment-last-work-table'),
    history: document.getElementById('equipment-history-output')
};

const pdfButtons = {
    byWork: document.getElementById('generate-equipment-report-pdf'),
    lastWork: document.getElementById('generate-last-work-report-pdf'),
    history: document.getElementById('generate-history-report-pdf')
};

const whatsappButtons = {
    byWork: document.getElementById('whatsapp-equipment-report-btn'),
    lastWork: document.getElementById('whatsapp-last-work-report-btn')
};

// Cache para Últimas BMs (carregamento rápido)
let lastBmsCache = null;
let lastBmsCacheTime = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

// ========================================
// 🧠 SISTEMA INTELIGENTE DE CACHE DE BMs
// ========================================

/**
 * Calcula hash RÁPIDO dos dados de uma BM para detectar mudanças
 * Usa apenas COUNTs e SUMs para ser mais rápido que buscar todos os registros
 * @param {number} workId - ID da obra
 * @param {string} startDate - Data início BM (YYYY-MM-DD)
 * @param {string} endDate - Data fim BM (YYYY-MM-DD)
 * @returns {Promise<string>} Hash SHA-256 dos dados
 */
async function calculateBmHash(workId, startDate, endDate) {
    try {
        // Busca apenas IDs e valores chave (muito mais rápido que trazer todos os dados)
        const [entries, expenses, damages] = await Promise.all([
            apiClient.fetchDailyEntries(workId, null, startDate, endDate).then(data => 
                data.map(e => `${e.id}:${e.equipment_id}:${e.hours_worked}:${e.total_value}`)
            ),
            apiClient.fetchData('general_expenses', 'id,value,date,impact_type', null, false).then(data => 
                data.filter(e => e.work_id == workId && e.date >= startDate && e.date <= endDate)
                    .map(e => `${e.id}:${e.value}:${e.impact_type}`)
            ),
            apiClient.fetchDamages(workId, startDate, endDate).then(data =>
                data.map(d => `${d.id}:${d.total_value || d.repair_cost}`)
            )
        ]);
        
        // Cria string compacta (só IDs e valores críticos)
        const dataString = `E:${entries.join('|')}|X:${expenses.join('|')}|D:${damages.join('|')}`;
        
        // Calcula hash SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    } catch (error) {
        console.error('❌ Erro ao calcular hash da BM:', error);
        return null;
    }
}

/**
 * Verifica RAPIDAMENTE se uma BM precisa ser recarregada (por timestamp, não hash)
 * Muito mais rápido que calcular hash!
 * @param {number} workId - ID da obra
 * @param {string} bmLabel - Label da BM (ex: "BM 1")
 * @param {string} startDate - Data início (YYYY-MM-DD)
 * @param {string} endDate - Data fim (YYYY-MM-DD)
 * @returns {Promise<Object>} { needs_reload: boolean, reason: string }
 */
async function checkBmCacheFast(workId, bmLabel, startDate, endDate) {
    try {
        const response = await fetch('/proj/api/bm_cache_fast.php?action=check_fast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                work_id: workId,
                bm_label: bmLabel,
                start_date: startDate,
                end_date: endDate
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao verificar cache');
        }
        
        const result = await response.json();
        console.log(`⚡ Cache check RÁPIDO ${bmLabel}:`, result.message);
        return result;
    } catch (error) {
        console.error('❌ Erro ao verificar cache:', error);
        return { needs_reload: true, reason: 'error' };
    }
}

/**
 * Atualiza o cache após processar uma BM
 * @param {number} workId - ID da obra
 * @param {string} bmLabel - Label da BM (ex: "BM 1")
 * @param {string} startDate - Data início (YYYY-MM-DD)
 * @param {string} endDate - Data fim (YYYY-MM-DD)
 */
async function updateBmCache(workId, bmLabel, startDate, endDate) {
    try {
        const response = await fetch('/proj/api/bm_cache_fast.php?action=update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                work_id: workId,
                bm_label: bmLabel,
                start_date: startDate,
                end_date: endDate
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao atualizar cache');
        }
        
        const result = await response.json();
        console.log(`✅ Cache atualizado para ${bmLabel}: ${result.signature}`);
        return result;
    } catch (error) {
        console.error('❌ Erro ao atualizar cache:', error);
    }
}

// Configuração das colunas que podem ser ligadas/desligadas
const togglableColumns = [
    { id: 'show-model', label: 'Modelo', default: false },
    { id: 'show-characteristic', label: 'Característica', default: false },
    { id: 'show-capacidade', label: 'Capacidade', default: false },
    { id: 'show-year', label: 'Ano', default: false },
    { id: 'show-horimeter-start', label: 'Horímetro Início Obra', default: false },
    { id: 'show-horimeter-end', label: 'Horímetro Fim Obra', default: true },
    { id: 'show-review-status', label: 'Status Revisão', default: false }
];

export const initHomeReport = async () => {
    // Carrega os dados iniciais uma única vez
    await loadInitialData();
    
    // 🚨 NOVO: Gera alerta de BMs próximas do fechamento
    await generateBmClosingAlert();
    
    // 🏠 NOVO: Gera alerta de contratos próximos do vencimento
    const { generateRentalExpiringAlert } = await import('./alugueis.js');
    await generateRentalExpiringAlert();
    
    // 🔄 VERIFICAR: Qual sub-aba está ativa ao entrar na seção
    const homeSection = document.getElementById('home-section');
    const activeButton = homeSection?.querySelector('.home-report-type-btn.active');
    const activeReportType = activeButton?.dataset.reportType;
    
    console.log(`🔍 Sub-aba ativa ao carregar: ${activeReportType || 'nenhuma'}`);
    
    // 🔄 Se a sub-aba "Últimas BM's" estiver ativa, recarregar automaticamente
    if (activeReportType === 'equipment-last-work-report') {
        console.log('🔄 Detectada sub-aba "Últimas BMs" ativa - recarregando automaticamente...');
        await reloadWorksListAndGenerate('lastWork');
        await generateLastWorkReport();
    }
    
    // Configura os botões da sub-aba
    document.querySelectorAll('.home-report-type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const reportType = e.target.dataset.reportType;
            // ✅ CORREÇÃO: Limitar o escopo apenas à seção Home
            const homeSection = document.getElementById('home-section');
            if (!homeSection) return;
            
            // Remove a classe 'active' de todos os botões DENTRO da home
            homeSection.querySelectorAll('.home-report-type-btn').forEach(btn => btn.classList.remove('active'));
            
            // Oculta todos os containers DENTRO da home
            homeSection.querySelectorAll('.report-content').forEach(container => container.style.display = 'none');
            
            // Adiciona 'active' ao botão clicado e mostra o container correspondente
            e.target.classList.add('active');
            const targetContainer = document.getElementById(reportType);
            if (targetContainer) {
                targetContainer.style.display = 'block';
            }

            // Gera o relatório correspondente
            if (reportType === 'equipment-by-work-report') {
                // 🔄 ATUALIZAR: Recarrega lista de obras antes de gerar relatório
                reloadWorksListAndGenerate('byWork').then(() => {
                    debouncedGenerateEquipmentReport();
                });
            } else if (reportType === 'equipment-last-work-report') {
                // 🔄 ATUALIZAR: Recarrega lista de obras antes de gerar relatório de Últimas BMs
                // 🔄 SEMPRE RECARREGA lista de obras ao entrar na aba
                console.log('🔄 Recarregando obras e gerando relatório de Últimas BMs');
                reloadWorksListAndGenerate('lastWork').then(() => {
                    generateLastWorkReport();
                });
            } else if (reportType === 'equipment-history-report') {
                // Inicia o relatório de histórico sem gerar a tabela
                // A tabela será gerada apenas quando um equipamento for selecionado
            }
        });
    });

    // Renderiza as opções de coluna para o primeiro relatório
    renderColumnOptions('report-by-work-options', togglableColumns, debouncedGenerateEquipmentReport);
    
    // Adiciona controles de filtro de obras
    addWorkFilterControls();
    
    // Configura a primeira sub-aba
    await generateEquipmentReport();

    // Configura os botões de PDF
    if (pdfButtons.byWork) {
        pdfButtons.byWork.addEventListener('click', () => exportEquipmentReportToPDF('equipment-by-work-report', 'Relatório de Equipamentos por Obra'));
    }
    if (pdfButtons.lastWork) {
        pdfButtons.lastWork.addEventListener('click', () => exportEquipmentReportToPDF('equipment-last-work-report', 'Últimas BMs de Cada Obra'));
    }
    
    // Configura os botões de WhatsApp
    if (whatsappButtons.byWork) {
        whatsappButtons.byWork.addEventListener('click', async () => {
            try {
                showSpinner();
                
                // 1. Gerar PDF
                const { jsPDF } = window.jspdf;
                const pdf = await exportEquipmentReportToPDF('equipment-by-work-report', 'Relatório de Equipamentos por Obra');
                
                // 2. Converter para blob
                const pdfBlob = pdf.output('blob');
                
                // 3. Upload para Drive
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                
                reader.onloadend = async () => {
                    try {
                        const base64Data = reader.result;
                        const fileName = 'Relatorio_Equipamentos_por_Obra.pdf';
                        
                        const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pdfData: base64Data,
                                fileName: fileName,
                                workName: 'EQUIPAMENTOS',
                                companyName: 'PBA TRANSPORTES',
                                bmLabel: 'RELATÓRIO',
                                dateRange: new Date().toLocaleDateString('pt-BR')
                            })
                        });

                        const result = await response.json();
                        
                        if (result.success && result.fileId) {
                            const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                            const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=📊 Olá! Segue o relatório de equipamentos por obra.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
    if (whatsappButtons.lastWork) {
        whatsappButtons.lastWork.addEventListener('click', async () => {
            try {
                showSpinner();
                
                const pdf = await exportEquipmentReportToPDF('equipment-last-work-report', 'Últimas BMs de Cada Obra');
                const pdfBlob = pdf.output('blob');
                
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                
                reader.onloadend = async () => {
                    try {
                        const base64Data = reader.result;
                        const fileName = 'Relatorio_Ultimas_BMs.pdf';
                        
                        const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pdfData: base64Data,
                                fileName: fileName,
                                workName: 'ULTIMAS_BMS',
                                companyName: 'PBA TRANSPORTES',
                                bmLabel: 'RELATÓRIO',
                                dateRange: new Date().toLocaleDateString('pt-BR')
                            })
                        });

                        const result = await response.json();
                        
                        if (result.success && result.fileId) {
                            const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                            const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=📊 Olá! Segue o relatório das últimas BMs de cada obra.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
};

const loadInitialData = async () => {
    showSpinner();
    try {
        // Busca todos os dados necessários
        appState.equipment = await apiClient.fetchData('equipment');
        // Busca obras NÃO ENCERRADAS e ordena por data de início (mais recente primeiro)
        const allWorks = await apiClient.fetchData('works', '*, client_companies(name)');
        appState.works = allWorks
            .filter(work => !work.is_closed) // Filtra apenas obras não encerradas
            .sort((a, b) => {
                // Ordena por data de início da primeira BM (mais recente primeiro)
                const dateA = a.config?.measurement_periods?.[0]?.start || '1900-01-01';
                const dateB = b.config?.measurement_periods?.[0]?.start || '1900-01-01';
                return dateB.localeCompare(dateA);
            });
        // Buscar todas as entradas diárias para ter dados completos para o histórico
        appState.daily_entries = await apiClient.fetchData('daily_entries', 'work_id, equipment_id, date, horometer_start, horometer_end, is_mobilization, is_demobilized, is_worked');
        appState.client_companies = await apiClient.fetchData('client_companies');
        appState.terceirizados = await apiClient.fetchData('terceirizados');
        appState.my_companies = await apiClient.fetchData('my_companies');
        
        console.log('📊 DADOS CARREGADOS:');
        console.log('- Obras:', appState.works.length);
        console.log('- Equipamentos:', appState.equipment.length);
        appState.works.forEach(work => {
            console.log(`  Obra: ${work.name}, BMs:`, work.config?.measurement_periods?.length || 0);
            if (work.config?.measurement_periods) {
                work.config.measurement_periods.forEach((bm, i) => {
                    console.log(`    BM ${i+1}: ${bm.start} a ${bm.end}`);
                });
            }
        });
        
        // ⚡ OTIMIZAÇÃO: NÃO carregar "Últimas BMs" automaticamente
        // Só carrega quando usuário clicar na aba (carregamento sob demanda)
        console.log('⚡ "Últimas BMs" será carregada SOB DEMANDA (ao clicar na aba)');
        
    } catch (error) {
        console.error("Erro ao carregar dados iniciais para o relatório da Home:", error);
        alert("Não foi possível carregar os dados para os relatórios. Verifique sua conexão ou tente novamente.");
    } finally {
        hideSpinner();
    }
};

/**
 * Adiciona controles de filtro de obras (checkboxes para selecionar obras)
 */
const addWorkFilterControls = () => {
    const container = document.getElementById('report-by-work-options');
    if (!container) return;

    const filterDiv = document.createElement('div');
    filterDiv.id = 'work-filter-controls';
    filterDiv.className = 'filter-controls-container'; // Adiciona classe CSS
    
    filterDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
            <input type="checkbox" id="select-all-works" checked>
            <label for="select-all-works" style="font-weight: bold;">Marcar/Desmarcar Todas as Obras</label>
        </div>
        <div id="work-checkboxes-container" class="work-checkboxes-grid">
        </div>
    `;
    
    container.appendChild(filterDiv);


    // Adiciona listener para o checkbox "Marcar/Desmarcar Todos"
    document.getElementById('select-all-works').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.work-filter-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        debouncedGenerateEquipmentReport();
    });
};

/**
 * Renderiza os checkboxes de obras disponíveis
 */
const renderWorkFilterCheckboxes = () => {
    const container = document.getElementById('work-checkboxes-container');
    if (!container) return;

    // Obtém todas as obras únicas do relatório
    const workNames = new Set();
    appState.works.forEach(work => {
        if (work.name) workNames.add(work.name);
    });

    // Ordena alfabeticamente
    const sortedWorkNames = Array.from(workNames).sort();

    container.innerHTML = sortedWorkNames.map(workName => `
        <div style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" class="work-filter-checkbox" data-work-name="${workName}" checked>
            <label style="margin: 0; font-size: 0.9em;">${workName}</label>
        </div>
    `).join('');

    // Adiciona listeners para os checkboxes individuais
    container.querySelectorAll('.work-filter-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Atualiza o estado do "Marcar/Desmarcar Todos"
            const allChecked = Array.from(document.querySelectorAll('.work-filter-checkbox')).every(cb => cb.checked);
            const selectAllCheckbox = document.getElementById('select-all-works');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
            }
            debouncedGenerateEquipmentReport();
        });
    });
};

/**
 * 🔄 ATUALIZA os checkboxes de obras após recarregar a lista
 * Mantém o estado de seleção dos checkboxes existentes
 */
const updateWorkFilterControls = () => {
    const container = document.getElementById('work-checkboxes-container');
    if (!container) return;

    // Salva o estado atual dos checkboxes
    const selectedWorks = new Set();
    container.querySelectorAll('.work-filter-checkbox:checked').forEach(checkbox => {
        selectedWorks.add(checkbox.dataset.workName);
    });

    // Obtém todas as obras únicas do relatório
    const workNames = new Set();
    appState.works.forEach(work => {
        if (work.name) workNames.add(work.name);
    });

    // Ordena alfabeticamente
    const sortedWorkNames = Array.from(workNames).sort();

    // Recria os checkboxes mantendo o estado de seleção
    container.innerHTML = sortedWorkNames.map(workName => {
        const isChecked = selectedWorks.size === 0 || selectedWorks.has(workName);
        return `
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" class="work-filter-checkbox" data-work-name="${workName}" ${isChecked ? 'checked' : ''}>
                <label style="margin: 0; font-size: 0.9em;">${workName}</label>
            </div>
        `;
    }).join('');

    // Adiciona listeners para os checkboxes individuais
    container.querySelectorAll('.work-filter-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Atualiza o estado do "Marcar/Desmarcar Todos"
            const allChecked = Array.from(document.querySelectorAll('.work-filter-checkbox')).every(cb => cb.checked);
            const selectAllCheckbox = document.getElementById('select-all-works');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
            }
            debouncedGenerateEquipmentReport();
        });
    });
    
    console.log(`✅ Filtros de obras atualizados: ${sortedWorkNames.length} obras ativas`);
};

/**
 * Obtém as obras selecionadas pelos checkboxes
 */
const getSelectedWorks = () => {
    const selectedWorks = new Set();
    document.querySelectorAll('.work-filter-checkbox:checked').forEach(checkbox => {
        selectedWorks.add(checkbox.dataset.workName);
    });
    return selectedWorks;
};

/**
 * Renderiza as opções de colunas (checkboxes) para um relatório específico.
 */
const renderColumnOptions = (containerId, options, listenerFunc) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    let optionsHtml = `
        <div id="${containerId}-options" class="column-options-container">
            <span class="column-options-title">Exibir Colunas Adicionais:</span>
    `;

    options.forEach(col => {
        optionsHtml += `
            <div class="column-option-item">
                <input type="checkbox" id="${col.id}-${containerId}" class="home-report-column-toggle" data-container-id="${containerId}" ${col.default ? 'checked' : ''}>
                <label for="${col.id}-${containerId}">${col.label}</label>
            </div>
        `;
    });

    optionsHtml += `</div>`;

    container.innerHTML = optionsHtml;


    // Adiciona event listeners para regenerar o relatório quando as opções mudarem
    container.querySelectorAll('.home-report-column-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', () => listenerFunc());
    });
};

/**
 * Gerar o relatório de equipamentos agrupados por obra.
 */
const generateEquipmentReport = async () => {
    showSpinner();
    if (tables.byWork) tables.byWork.innerHTML = '';

    try {
        if (!appState.equipment || appState.equipment.length === 0) {
            if (tables.byWork) tables.byWork.innerHTML = '<tr><td colspan="13">Nenhum equipamento cadastrado.</td></tr>';
            return;
        }

        const columnVisibility = getColumnVisibility('report-by-work-options');
        const reportData = {}; 
        
        // Renderiza os checkboxes de obras apenas se ainda não existirem
        if (document.querySelectorAll('.work-filter-checkbox').length === 0) {
            renderWorkFilterCheckboxes();
        }
        
        // Agrupar entradas por equipamento para fácil acesso
        const equipmentEntriesMap = new Map();
        appState.daily_entries.forEach(entry => {
            if (!equipmentEntriesMap.has(entry.equipment_id)) {
                equipmentEntriesMap.set(entry.equipment_id, []);
            }
            equipmentEntriesMap.get(entry.equipment_id).push(entry);
        });

        for (const equipment of appState.equipment) {
            // Filtra equipamentos sem tipo definido ou com tipo "EQP"
            if (!equipment.type || equipment.type.trim() === '' || equipment.type.trim().toUpperCase() === 'EQP') {
                continue;
            }
            
            const entriesForEquipment = equipmentEntriesMap.get(equipment.id) || [];
            
            if (entriesForEquipment.length === 0) {
                // Equipamento sem lançamentos
                if (!reportData['Sem Obra Registrada']) {
                    reportData['Sem Obra Registrada'] = [];
                }
                reportData['Sem Obra Registrada'].push({
                    equipment: equipment,
                    lastWork: null,
                    clientCompany: null,
                    firstDateInWork: null,
                    lastDateInWork: null,
                    firstHorometerInWork: null,
                    lastHorometerInWork: null,
                    reviewStatus: getReviewStatus(equipment, null),
                    conflicts: []
                });
                continue;
            }

            // Ordena todas as entradas por data (cronológica)
            const sortedEntries = [...entriesForEquipment].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Agrupa entradas por obra e encontra o período mais recente de cada obra
            const workPeriodsMap = new Map();
            
            sortedEntries.forEach(entry => {
                const workId = entry.work_id;
                
                if (!workPeriodsMap.has(workId)) {
                    workPeriodsMap.set(workId, {
                        workId: workId,
                        entries: [],
                        firstDate: entry.date,
                        lastDate: entry.date,
                        lastMobilization: null,
                        lastDemobilization: null,
                        firstHorometer: null,
                        lastHorometer: null
                    });
                }
                
                const period = workPeriodsMap.get(workId);
                period.entries.push(entry);
                period.lastDate = entry.date;
                
                if (entry.is_mobilization) {
                    period.lastMobilization = entry.date;
                }
                if (entry.is_demobilized) {
                    period.lastDemobilization = entry.date;
                }
                
                if (entry.horometer_start !== null && (period.firstHorometer === null || entry.horometer_start < period.firstHorometer)) {
                    period.firstHorometer = entry.horometer_start;
                }
                if (entry.horometer_end !== null && (period.lastHorometer === null || entry.horometer_end > period.lastHorometer)) {
                    period.lastHorometer = entry.horometer_end;
                }
            });
            
            let mostRecentWorkId = null;
            let mostRecentDate = null;
            
            workPeriodsMap.forEach(period => {
                const periodLastDate = period.lastDate;
                
                if (!mostRecentDate || new Date(periodLastDate) >= new Date(mostRecentDate)) {
                    mostRecentWorkId = period.workId;
                    mostRecentDate = periodLastDate;
                }
            });
            
            const mostRecentPeriod = workPeriodsMap.get(mostRecentWorkId);
            const lastWorkId = mostRecentWorkId;
            const today = new Date().toISOString().split('T')[0];
            
            let groupName;
            let firstDateInWork;
            let lastDateInWork;
            
            if (mostRecentPeriod.lastDemobilization && new Date(mostRecentPeriod.lastDemobilization) <= new Date(today)) {
                groupName = 'DESMOBILIZADOS';
                firstDateInWork = mostRecentPeriod.lastMobilization || mostRecentPeriod.firstDate;
                lastDateInWork = mostRecentPeriod.lastDemobilization;
            } else {
                const lastWorkDetails = appState.works.find(w => w.id === lastWorkId);
                groupName = lastWorkDetails?.name || 'Obra Desconhecida';
                
                const workEntries = mostRecentPeriod.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
                const lastMobilizationInWork = [...workEntries].reverse().find(entry => entry.is_mobilization);
                firstDateInWork = lastMobilizationInWork ? lastMobilizationInWork.date : mostRecentPeriod.firstDate;
                lastDateInWork = mostRecentPeriod.lastDemobilization || today;
            }
            
            const lastWorkDetails = appState.works.find(w => w.id === lastWorkId);
            const clientCompany = appState.client_companies.find(c => c.id === lastWorkDetails?.client_company_id);
            const conflicts = findConflicts(equipment.id, lastWorkId, equipmentEntriesMap);
            const reviewStatus = getReviewStatus(equipment, mostRecentPeriod.lastHorometer);
            
            if (!reportData[groupName]) {
                reportData[groupName] = [];
            }
            
            reportData[groupName].push({
                equipment: equipment,
                lastWork: lastWorkDetails,
                clientCompany: clientCompany,
                firstDateInWork: firstDateInWork,
                lastDateInWork: lastDateInWork,
                firstHorometerInWork: mostRecentPeriod.firstHorometer,
                lastHorometerInWork: mostRecentPeriod.lastHorometer,
                reviewStatus: reviewStatus,
                conflicts: conflicts
            });
        }
        
        // Filtra os grupos indesejados antes de renderizar
        const filteredReportData = {};
        const selectedWorks = getSelectedWorks();
        
        for (const groupName in reportData) {
            // Ignora os grupos: "Obra Desconhecida", "DESMOBILIZADOS" e "Sem Obra Registrada"
            if (groupName !== 'Obra Desconhecida' && groupName !== 'DESMOBILIZADOS' && groupName !== 'Sem Obra Registrada') {
                // Filtra também pelas obras selecionadas
                if (selectedWorks.has(groupName)) {
                    filteredReportData[groupName] = reportData[groupName];
                }
            }
        }
        
        renderReportTable(filteredReportData, columnVisibility, 'equipment-by-work-table');

    } catch (error) {
        console.error("Erro ao gerar relatório de equipamentos da Home:", error);
        if (tables.byWork) tables.byWork.innerHTML = `<tr><td colspan="13" style="color: red;">Ocorreu um erro ao gerar o relatório. ${error.message}</td></tr>`;
    } finally {
        hideSpinner();
    }
};

const debouncedGenerateEquipmentReport = debounce(generateEquipmentReport, 500);

/**
 * 📊 ÚLTIMAS BM'S - Mostra resumo da última BM de cada obra (igual ao Resumo Geral da Medição)
 */
const generateLastWorkReport = async () => {
    console.log('📊 INICIANDO RELATÓRIO DE ÚLTIMAS BMs...');
    showSpinner();
    if (tables.lastWork) tables.lastWork.innerHTML = '';
    
    try {
        // Usa timezone do Brasil para evitar problemas com hora
        const today = new Date();
        const brazilOffset = -3 * 60; // UTC-3 (horário de Brasília)
        const localOffset = today.getTimezoneOffset();
        const brazilTime = new Date(today.getTime() + (localOffset + brazilOffset) * 60000);
        brazilTime.setHours(0, 0, 0, 0);
        console.log('📅 Data de hoje (Brasil):', brazilTime.toISOString().split('T')[0]);
        
        let htmlContent = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background: #2a2a2a; color: #fff;">
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Obra</th>
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: left;">Cliente</th>
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">BM</th>
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">Período</th>
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: right;">Total da BM</th>
                        <th style="padding: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center; width: 80px;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        let workCount = 0;
        let cacheHits = 0;
        let cacheUpdates = 0;

        console.log('🔍 Total de obras:', appState.works?.length || 0);

        // ⚡⚡⚡ ETAPA 1: IDENTIFICA TODAS AS BMs E CONTA LANÇAMENTOS ⚡⚡⚡
        const bmList = [];
        for (const work of appState.works) {
            if (!work.config?.measurement_periods || work.config.measurement_periods.length === 0) continue;

            let lastBm = null;
            let lastBmIndex = -1;

            for (let i = work.config.measurement_periods.length - 1; i >= 0; i--) {
                const bmEndDate = new Date(work.config.measurement_periods[i].end + 'T23:59:59');
                bmEndDate.setHours(0, 0, 0, 0);
                if (bmEndDate <= brazilTime) {
                    lastBm = work.config.measurement_periods[i];
                    lastBmIndex = i;
                    break;
                }
            }

            if (!lastBm) continue;

            const bmLabel = `BM ${lastBmIndex + 1}`;
            const startDate = lastBm.start;
            const endDate = lastBm.end;

            // Conta lançamentos rapidamente (SEM buscar dados completos)
            const entriesCount = await apiClient.fetchDailyEntries(work.id, null, startDate, endDate).then(e => e.length);

            bmList.push({ work, lastBm, lastBmIndex, bmLabel, startDate, endDate, entriesCount });
        }

        // ⚡⚡⚡ ETAPA 2: VERIFICA CACHE EM BATCH (1 chamada só!) ⚡⚡⚡
        const cacheCheckData = bmList.map(bm => ({
            work_id: bm.work.id,
            bm_label: bm.bmLabel,
            bm_start: bm.startDate,
            bm_end: bm.endDate,
            equipment_count: bm.entriesCount
        }));

        let cacheResults = [];
        try {
            const cacheResponse = await fetch('api/bm_value_check_fast.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bms: cacheCheckData })
            });
            const cacheData = await cacheResponse.json();
            if (cacheData.success) {
                cacheResults = cacheData.results;
                console.log(`✅ Cache verificado: ${cacheData.stats?.cache_hits || 0} sem mudanças, ${cacheData.stats?.needs_recalc || 0} precisam recalcular`);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar cache:', error);
        }

        // ⚡⚡⚡ ETAPA 3: PROCESSA CADA BM (calcula SÓ se necessário!) ⚡⚡⚡
        for (const bm of bmList) {
            workCount++;
            const { work, lastBm, lastBmIndex, bmLabel, startDate, endDate } = bm;

            // Busca resultado do cache para esta BM
            const cacheResult = cacheResults.find(r => r.work_id === work.id && r.bm_label === bmLabel);

            let cacheStatus = '🆕 Nova';
            let bmTotalValue = 0;
            let needsCalculation = true;

            // ✅ SE CACHE EXISTE E ESTÁ IGUAL → USA CACHE (SUPER RÁPIDO!)
            if (cacheResult && cacheResult.status === 'unchanged' && cacheResult.cached_value !== undefined) {
                bmTotalValue = cacheResult.cached_value;
                cacheStatus = '✅ Sem mudanças';
                needsCalculation = false;
                cacheHits++;
                console.log(`⚡ ${work.name} ${bmLabel}: Usando cache (R$ ${bmTotalValue.toFixed(2)})`);
            } else {
                cacheStatus = cacheResult?.status === 'changed' ? '🔄 Atualizada' : '🆕 Primeira vez';
                cacheUpdates++;
                console.log(`🔄 ${work.name} ${bmLabel}: Calculando...`);
            }

            // 🔄 SÓ CALCULA SE NECESSÁRIO!
            if (needsCalculation) {
                // Busca dados completos
                const entries = await apiClient.fetchDailyEntries(work.id, null, startDate, endDate);
            
            const generalExpenses = await apiClient.fetchData(
                'general_expenses',
                '*, equipment(*)',
                'date',
                true
            ).then(data => data.filter(entry =>
                entry.work_id == work.id && 
                entry.date >= startDate && 
                entry.date <= endDate
            ));
            
            let damages = [];
            if (typeof apiClient.fetchDamages === 'function') {
                damages = await apiClient.fetchDamages(work.id, startDate, endDate);
            }

            // Validação de avarias
            const validateDamageForMeasurement = (damage) => {
                if (!damage || !damage.id) return false;
                const validImpacts = [EXPENSE_IMPACT_TYPES.ADD_CLIENT, EXPENSE_IMPACT_TYPES.DISC_CLIENT];
                if (!validImpacts.includes(damage.client_impact_type)) return false;
                const totalValue = preciseRounding.round2(parseFloat(damage.total_value) || 0);
                if (totalValue <= 0) return false;
                if (!damage.damage_date) return false;
                return true;
            };

            // Agrupa por equipamento
            const entriesByEquipment = entries.reduce((acc, entry) => {
                (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
                return acc;
            }, {});

            // Busca substituições
            const substitutionsInPeriod = await apiClient.fetchEquipmentSubstitutions(work.id, startDate, endDate);
            const substitutionsBySubstitutingEquip = new Map(
                substitutionsInPeriod.map(sub => [sub.substituting_equipment_id, sub])
            );

            // Configs de equipamentos
            const allEquipConfigs = new Map();
            if (work?.config?.equipment) {
                work.config.equipment.forEach(ec => {
                    allEquipConfigs.set(parseInt(ec.equipment_id), ec);
                });
            }

            // Calcula valor total da BM e monta lista de equipamentos
            let bmTotalValue = 0;
            const equipmentList = [];

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

                const equipment = appState.equipment.find(e => e.id == equipmentId);
                if (equipment) {
                    equipmentList.push({
                        equipment,
                        config: configForCalculation,
                        total: equipmentCalculation.totalValue,
                        workedDays: equipmentCalculation.workedDays,
                        totalHours: equipmentCalculation.totalHoursWorked
                    });
                }
            }

            // Adiciona despesas e avarias gerais
            const generalWorkExpenses = generalExpenses.filter(expense => !expense.equipment_id);
            const generalAdditions = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
            const generalDiscounts = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);
            bmTotalValue += generalAdditions - generalDiscounts;
            
            const generalWorkDamages = damages.filter(damage => !damage.equipment_id && validateDamageForMeasurement(damage));
            const generalDamageAdditions = generalWorkDamages
                .filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                .reduce((sum, d) => sum + (d.total_value || 0), 0);
            const generalDamageDiscounts = generalWorkDamages
                .filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                .reduce((sum, d) => sum + (d.total_value || 0), 0);
            bmTotalValue += generalDamageAdditions - generalDamageDiscounts;

                // Atualiza o cache com o novo valor calculado
                try {
                    await fetch('api/bm_value_check_fast.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            bms: [{
                                work_id: work.id,
                                bm_label: bmLabel,
                                bm_start: startDate,
                                bm_end: endDate,
                                current_value: bmTotalValue,
                                equipment_count: bm.entriesCount
                            }]
                        })
                    });
                } catch (error) {
                    console.error('❌ Erro ao atualizar cache:', error);
                }
            }

            // Gera linha da tabela
            const rowBg = workCount % 2 === 0 ? '#1a1a2e' : '#15151f';
            htmlContent += `
                <tr style="background: ${rowBg}; color: #e0e0e0;">
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.05); font-weight: bold;">${work.name}</td>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.05);">${work.client_companies?.name || 'N/A'}</td>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">BM ${String(lastBmIndex + 1).padStart(2, '0')}</td>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">${formatDateBR(startDate)} a ${formatDateBR(endDate)}</td>
                    <td style="padding: 10px; border: 1px solid rgba(255,255,255,0.05); text-align: right; font-weight: bold; color: #4CAF50;">${preciseRounding.formatCurrencyPrecise(bmTotalValue)}</td>
                    <td style="padding: 6px; border: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 0.85rem;" title="${cacheStatus}">${cacheStatus}</td>
                </tr>
            `;
        }

        htmlContent += `
                </tbody>
            </table>
        `;
        
        // 📊 Estatísticas de cache
        const totalBms = workCount;
        const cacheEfficiency = totalBms > 0 ? Math.round((cacheHits / totalBms) * 100) : 0;
        
        htmlContent += `
            <div style="margin-top: 15px; padding: 10px; background: #1a1a2e; border-radius: 5px; font-size: 0.9rem; color: #b0b0b0;">
                <strong style="color: #64b5f6;">📊 Cache Inteligente:</strong> 
                ${totalBms} BM(s) processada(s) | 
                <span style="color: #81c784;">✅ ${cacheHits} sem mudanças</span> | 
                <span style="color: #ffb74d;">🔄 ${cacheUpdates} atualizada(s)</span> | 
                <strong style="color: ${cacheEfficiency >= 50 ? '#81c784' : '#ffb74d'};">Eficiência: ${cacheEfficiency}%</strong>
            </div>
        `;

        if (workCount === 0) {
            htmlContent = '<p style="text-align: center; color: #b0b0b0; padding: 40px;">Nenhuma BM finalizada encontrada para exibir.</p>';
        }

        if (tables.lastWork) {
            tables.lastWork.innerHTML = htmlContent;
            // Salva no cache para próximas visualizações
            lastBmsCache = htmlContent;
            lastBmsCacheTime = Date.now();
            console.log(`💾 Cache das Últimas BMs atualizado (${cacheHits} hits, ${cacheUpdates} updates)`);
        }

    } catch (error) {
        console.error("Erro ao gerar relatório de últimas BMs:", error);
        if (tables.lastWork) tables.lastWork.innerHTML = `<div style="color: red; padding: 20px;">Ocorreu um erro ao gerar o relatório. ${error.message}</div>`;
    } finally {
        hideSpinner();
    }
};

const debouncedGenerateLastWorkReport = debounce(generateLastWorkReport, 500);

/**
 * Gerar o relatório de histórico de um equipamento.
 */
const generateEquipmentHistoryReport = async (equipmentId) => {
    showSpinner();
    if (tables.history) tables.history.innerHTML = '';

    try {
        const equipment = appState.equipment.find(e => e.id == equipmentId);
        if (!equipment) {
            if (tables.history) tables.history.innerHTML = '<p>Equipamento não encontrado.</p>';
            return;
        }

        const columnVisibility = getColumnVisibility('report-history-options');
        const includeTerceirizados = columnVisibility['show-terceirizados'];

        if (equipment.is_terceirizado && !includeTerceirizados) {
            if (tables.history) tables.history.innerHTML = '<p>Este equipamento é terceirizado e o filtro está ativo.</p>';
            return;
        }
        
        const entriesForEquipment = appState.daily_entries.filter(e => e.equipment_id == equipmentId);
        const sortedEntries = [...entriesForEquipment].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const workPeriods = findWorkPeriods(sortedEntries);
        const today = new Date().toISOString().split('T')[0];

        let htmlContent = `
            <div class="equipment-history-header">
                <h4>Histórico de Obras para: ${getEquipTypeName(equipment.type)} - ${equipment.prefix}</h4>
            </div>
            <div class="table-wrapper responsive">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Obra</th>
                            <th>Empresa Cliente</th>
                            <th>Data Início Obra</th>
                            <th>Data Fim Obra</th>
                            <th>Horímetro Início</th>
                            <th>Horímetro Fim</th>
                            <th>Status Revisão</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (workPeriods.length === 0) {
            htmlContent += `<tr><td colspan="10">Nenhuma obra registrada para este equipamento.</td></tr>`;
        } else {
            workPeriods.forEach(period => {
                const workDetails = appState.works.find(w => w.id === period.workId);
                const clientCompany = appState.client_companies.find(c => c.id === workDetails?.client_company_id);
                const reviewStatus = getReviewStatus(equipment, period.lastHorometer);
                const lastDate = period.demobilizationDate ? period.demobilizationDate : today;

                htmlContent += `
                    <tr>
                        <td data-label="Obra">${workDetails?.name || 'Obra Desconhecida'}</td>
                        <td data-label="Empresa Cliente">${clientCompany?.name || 'N/A'}</td>
                        <td data-label="Data Início Obra">${formatDateBR(period.mobilizationDate || period.firstActiveDate)}</td>
                        <td data-label="Data Fim Obra">${formatDateBR(lastDate)}</td>
                        <td data-label="Horímetro Início">${period.firstHorometer !== null ? period.firstHorometer : '---'}</td>
                        <td data-label="Horímetro Fim">${period.lastHorometer !== null ? period.lastHorometer : '---'}</td>
                        <td data-label="Status Revisão">${reviewStatus}</td>
                    </tr>
                `;
            });
        }

        htmlContent += `
                    </tbody>
                </table>
            </div>
        `;
        
        tables.history.innerHTML = htmlContent;

    } catch (error) {
        console.error("Erro ao gerar relatório de histórico:", error);
        if (tables.history) tables.history.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${error.message}</p>`;
    } finally {
        hideSpinner();
    }
};

/**
 * Obtém o estado das checkboxes de colunas.
 */
const getColumnVisibility = (containerId) => {
    const columnVisibility = {};
    const container = document.getElementById(containerId);
    if (!container) {
        togglableColumns.forEach(col => columnVisibility[col.id] = col.default);
        columnVisibility['show-terceirizados'] = false;
        return columnVisibility;
    }
    
    const allOptions = [...togglableColumns, { id: 'show-terceirizados', label: 'Terceirizados', default: false }];
    allOptions.forEach(col => {
        const checkbox = document.getElementById(`${col.id}-${containerId}`);
        columnVisibility[col.id] = checkbox ? checkbox.checked : col.default;
    });

    return columnVisibility;
};

/**
 * Função utilitária para encontrar períodos de obra a partir de entradas diárias.
 */
const findWorkPeriods = (entries) => {
    if (!entries || entries.length === 0) return [];

    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const workPeriods = [];
    let currentPeriod = null;

    sortedEntries.forEach(entry => {
        if (!currentPeriod || entry.work_id !== currentPeriod.workId) {
            if (currentPeriod) {
                workPeriods.push(currentPeriod);
            }
            currentPeriod = {
                workId: entry.work_id,
                mobilizationDate: entry.is_mobilization ? entry.date : (entry.is_worked ? entry.date : null), 
                demobilizationDate: null,
                firstActiveDate: entry.date,
                lastActiveDate: entry.date,
                firstHorometer: entry.horometer_start,
                lastHorometer: entry.horometer_end,
                allEntries: [entry]
            };
        } else {
            currentPeriod.lastActiveDate = entry.date;
            if (entry.is_demobilized) {
                currentPeriod.demobilizationDate = entry.date;
            }
            if (entry.is_mobilization && !currentPeriod.mobilizationDate) {
                 currentPeriod.mobilizationDate = entry.date;
            }
            if (entry.horometer_start !== null && (currentPeriod.firstHorometer === null || entry.horometer_start < currentPeriod.firstHorometer)) {
                currentPeriod.firstHorometer = entry.horometer_start;
            }
            if (entry.horometer_end !== null && (currentPeriod.lastHorometer === null || entry.horometer_end > currentPeriod.lastHorometer)) {
                currentPeriod.lastHorometer = entry.horometer_end;
            }
            currentPeriod.allEntries.push(entry);
        }
    });

    if (currentPeriod) {
        workPeriods.push(currentPeriod);
    }
    
    return workPeriods;
};

/**
 * Encontra conflitos de datas para um equipamento.
 */
const findConflicts = (equipmentId, currentWorkId, equipmentEntriesMap) => {
    const conflicts = [];
    const entriesForEquipment = equipmentEntriesMap.get(equipmentId) || [];

    const entriesGroupedByWork = new Map();
    entriesForEquipment.forEach(entry => {
        if (!entriesGroupedByWork.has(entry.work_id)) {
            entriesGroupedByWork.set(entry.work_id, []);
        }
        entriesGroupedByWork.get(entry.work_id).push(entry);
    });

    const currentWorkEntries = entriesGroupedByWork.get(currentWorkId) || [];
    const currentWorkActiveDates = new Set(currentWorkEntries.filter(e => e.is_worked || e.is_mobilization || e.is_demobilized).map(e => e.date));

    entriesGroupedByWork.forEach((otherWorkEntries, otherWorkId) => {
        if (otherWorkId === currentWorkId) return;

        const otherWorkActiveDates = new Set(otherWorkEntries.filter(e => e.is_worked || e.is_mobilization || e.is_demobilized).map(e => e.date));
        const conflictingDays = [];
        
        otherWorkActiveDates.forEach(dateStr => {
            if (currentWorkActiveDates.has(dateStr)) {
                const currentEntry = currentWorkEntries.find(e => e.date === dateStr);
                const otherEntry = otherWorkEntries.find(e => e.date === dateStr);
                
                if (currentEntry.is_worked && otherEntry.is_worked) {
                    return;
                }
                
                const isCleanTransition = 
                    ((currentEntry.is_demobilized && otherEntry.is_mobilization) || (otherEntry.is_demobilized && currentEntry.is_mobilization)) &&
                    !currentEntry.is_worked && !otherEntry.is_worked;
                
                if (!isCleanTransition) {
                    conflictingDays.push(dateStr);
                }
            }
        });

        if (conflictingDays.length > 0) {
            const otherWorkName = appState.works.find(w => w.id === otherWorkId)?.name || 'Obra Desconhecida';
            const sortedConflictingDays = conflictingDays.sort((a, b) => new Date(a) - new Date(b));
            let conflictDateString = '';
            if (sortedConflictingDays.length === 1) {
                conflictDateString = `(${formatDateBR(sortedConflictingDays[0])})`;
            } else {
                conflictDateString = `(${formatDateBR(sortedConflictingDays[0])} a ${formatDateBR(sortedConflictingDays[sortedConflictingDays.length - 1])})`;
            }
            conflicts.push(`${otherWorkName} ${conflictDateString}`);
        }
    });

    return conflicts;
};

const getReviewStatus = (equipment, lastHorometer) => {
    if (!equipment.maintenance_interval_hours || !equipment.last_maintenance_horometer || lastHorometer === null) {
        return 'N/A';
    }

    const nextMaintenanceHorometer = equipment.last_maintenance_horometer + equipment.maintenance_interval_hours;
    if (lastHorometer >= nextMaintenanceHorometer) {
        return 'REVISÃO VENCIDA';
    } else {
        const remainingHours = nextMaintenanceHorometer - lastHorometer;
        return `${remainingHours.toFixed(2)}h p/ Revisão`;
    }
};

const renderReportTable = (data, columnVisibility, tableId, isLastWorkReport = false) => {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const tableHead = document.querySelector(`#${tableId} thead`);
    const tableFoot = document.querySelector(`#${tableId} tfoot`);
    
    if (!tableBody || !tableHead) return;

    tableBody.innerHTML = '';
    if (tableFoot) tableFoot.remove();
    let totalEquipmentCount = 0;

    const fixedHeaders = ["Tipo", "Prefixo", "Última Obra", "Empresa Cliente", "Tipo Medição", "Valor", "Data Início Obra", "Última Data"];
    const toggledHeaders = {
        'show-model': "Modelo",
        'show-characteristic': "Característica",
        'show-capacidade': "Capacidade",
        'show-year': "Ano",
        'show-horimeter-start': "Horímetro Início Obra",
        'show-horimeter-end': "Horímetro Fim Obra",
        'show-review-status': "Status Revisão"
    };

    let currentHeaders = [...fixedHeaders];
    let visibleColumnCount = fixedHeaders.length;

    for (const colId in toggledHeaders) {
        if (columnVisibility[colId]) {
            currentHeaders.push(toggledHeaders[colId]);
            visibleColumnCount++;
        }
    }

    tableHead.innerHTML = `<tr>${currentHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`;

    // Array para definir cores alternadas por obra
    const workColors = [
        { bg: '#1a1a2e', titleBg: '#16213e', border: '#0f3460' },
        { bg: '#1a2332', titleBg: '#2d4059', border: '#ea5455' },
        { bg: '#1e2a3a', titleBg: '#0f4c75', border: '#3282b8' },
        { bg: '#1c1c2e', titleBg: '#533483', border: '#7c4dff' },
        { bg: '#1e2d24', titleBg: '#2d5016', border: '#76ff03' },
        { bg: '#2e1c1a', titleBg: '#5a3a30', border: '#ff6b6b' }
    ];
    
    let workIndex = 0;

    for (const workName in data) {
        const equipmentsInWork = data[workName].filter(item => {
            if (columnVisibility['show-terceirizados']) {
                return true;
            }
            return !item.equipment.is_terceirizado;
        }).sort((a, b) => {
            const typeA = a.equipment.type ? getEquipTypeName(a.equipment.type).toUpperCase() : '';
            const typeB = b.equipment.type ? getEquipTypeName(b.equipment.type).toUpperCase() : '';
            if (typeA < typeB) return -1;
            if (typeA > typeB) return 1;

            const prefixA = a.equipment.prefix ? a.equipment.prefix.toUpperCase() : '';
            const prefixB = b.equipment.prefix ? b.equipment.prefix.toUpperCase() : '';
            if (prefixA < prefixB) return -1;
            if (prefixA > prefixB) return 1;
            return 0;
        });

        if (equipmentsInWork.length === 0) continue;

        const colorScheme = workColors[workIndex % workColors.length];
        workIndex++;

        // Linha de espaçamento antes do grupo (exceto o primeiro)
        if (workIndex > 1) {
            const spacerRow = document.createElement('tr');
            spacerRow.classList.add('work-group-spacer');
            spacerRow.innerHTML = `<td colspan="${visibleColumnCount}" style="height: 12px; background: transparent; border: none;"></td>`;
            tableBody.appendChild(spacerRow);
        }

        // Cabeçalho do grupo com estilo aprimorado
        const groupHeader = document.createElement('tr');
        groupHeader.classList.add('main-group-header', 'work-group-header');
        groupHeader.style.background = `linear-gradient(135deg, ${colorScheme.titleBg} 0%, ${colorScheme.bg} 100%)`;
        groupHeader.style.borderLeft = `4px solid ${colorScheme.border}`;
        
        // Filtra equipamentos que não têm configuração válida (para evitar N/A)
        const validEquipments = equipmentsInWork.filter(item => {
            if (!item.lastWork?.id) return false;
            const fullWork = appState.works.find(w => w.id === item.lastWork.id);
            if (!fullWork?.config?.equipment) return false;
            const equipmentWorkConfig = fullWork.config.equipment.find(e => parseInt(e.equipment_id) === parseInt(item.equipment.id));
            if (!equipmentWorkConfig) return false;
            // Também filtra equipamentos sem tipo de medição ou valor configurado
            if (!equipmentWorkConfig.measurement_type || !equipmentWorkConfig.measurement_value) return false;
            return true;
        });
        
        groupHeader.innerHTML = `<td colspan="${visibleColumnCount}" style="padding: 10px; font-size: 0.95em; font-weight: bold; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
            📍 ${workName} <span style="color: ${colorScheme.border}; font-size: 0.85em;">(${validEquipments.length} equipamentos)</span>
        </td>`;
        tableBody.appendChild(groupHeader);

        validEquipments.forEach((item, index) => {
            totalEquipmentCount++;
            const row = document.createElement('tr');
            row.classList.add('work-group-row');
            
            // Aplica cor de fundo alternada dentro do grupo
            row.style.background = index % 2 === 0 ? colorScheme.bg : `${colorScheme.bg}dd`;
            row.style.borderLeft = `3px solid ${colorScheme.border}50`;
            
            let conflictWarning = '';
            if (item.conflicts && item.conflicts.length > 0) {
                conflictWarning = `<br><span style="color: red; font-weight: bold;">⚠️ Conflito com: ${item.conflicts.join(', ')}</span>`;
                row.classList.add('warning-row');
            }
            
            // Adiciona o nome do dono terceirizado/próprio E o prefixo na obra
            const terceirizadoOwner = item.equipment.is_terceirizado ? appState.terceirizados.find(t => t.id == item.equipment.terceirizado_id)?.name : null;
            const myCompanyOwner = !item.equipment.is_terceirizado && item.equipment.my_company_id ? appState.my_companies.find(mc => mc.id == item.equipment.my_company_id)?.name : null;
            const ownerDisplay = terceirizadoOwner ? `<span class="terceirizado-owner">(${terceirizadoOwner})</span>` : (myCompanyOwner ? `<span class="my-company-owner">(${myCompanyOwner})</span>` : '');

            // Busca a configuração do equipamento na obra
            // Primeiro tenta pela work referenciada, depois busca no appState.works
            let equipmentWorkConfig = null;
            
            if (item.lastWork?.id) {
                // Busca a obra completa no appState para ter a config atualizada
                const fullWork = appState.works.find(w => w.id === item.lastWork.id);
                if (fullWork?.config?.equipment) {
                    equipmentWorkConfig = fullWork.config.equipment.find(e => parseInt(e.equipment_id) === parseInt(item.equipment.id));
                }
            }
            
            const equipmentWorkPrefix = equipmentWorkConfig?.equipment_work_prefix;
            const workPrefixDisplay = equipmentWorkPrefix ? `<span style="color: #0066cc; font-weight: bold;"> [${equipmentWorkPrefix}]</span>` : '';
            
            // Busca tipo de medição e valor
            const measurementType = equipmentWorkConfig?.measurement_type || 'N/A';
            const measurementValue = equipmentWorkConfig?.measurement_value ? preciseRounding.formatCurrencyPrecise(parseFloat(equipmentWorkConfig.measurement_value)) : 'N/A';
            const measurementTypeLabel = measurementType === 'MONTHLY' ? 'MENSAL' : measurementType === 'DAILY' ? 'DIÁRIO' : measurementType === 'HOURLY' ? 'HORA' : measurementType === 'GUARANTEED_HOURS' ? 'HRS GARANTIDAS' : measurementType;
            const measurementDisplay = measurementValue !== 'N/A' ? `${measurementValue} (${measurementTypeLabel})` : 'N/A';

            let rowHtmlContent = `
                <td data-label="Tipo">${getEquipTypeName(item.equipment.type) || ''}</td>
                <td data-label="Prefixo">${item.equipment.prefix || ''} ${ownerDisplay}${workPrefixDisplay}</td>
                <td data-label="Última Obra">${item.lastWork?.name || ''}</td>
                <td data-label="Empresa Cliente">${item.clientCompany?.name || ''}</td>
                <td data-label="Tipo Medição">${measurementTypeLabel}</td>
                <td data-label="Valor">${measurementDisplay}</td>
                <td data-label="Data Início Obra">${item.firstDateInWork ? formatDateBR(item.firstDateInWork) : ''}</td>
                <td data-label="Última Data">${item.lastDateInWork ? formatDateBR(item.lastDateInWork) : ''}</td>
            `;
            
            if (columnVisibility['show-model']) {
                rowHtmlContent += `<td data-label="Modelo">${item.equipment.model || ''}</td>`;
            }
            if (columnVisibility['show-characteristic']) {
                rowHtmlContent += `<td data-label="Característica">${item.equipment.characteristic || ''}</td>`;
            }
            if (columnVisibility['show-capacidade']) {
                rowHtmlContent += `<td data-label="Capacidade">${item.equipment.capacidade || ''}</td>`;
            }
            if (columnVisibility['show-year']) {
                rowHtmlContent += `<td data-label="Ano">${item.equipment.year || ''}</td>`;
            }
            if (columnVisibility['show-horimeter-start']) {
                rowHtmlContent += `<td data-label="Horímetro Início Obra">${item.firstHorometerInWork !== null ? item.firstHorometerInWork : ''}</td>`;
            }
            if (columnVisibility['show-horimeter-end']) {
                rowHtmlContent += `<td data-label="Horímetro Fim Obra">${item.lastHorometerInWork !== null ? item.lastHorometerInWork : ''}</td>`;
            }
            if (columnVisibility['show-review-status']) {
                rowHtmlContent += `<td data-label="Status Revisão">${item.reviewStatus || ''}${conflictWarning}</td>`;
            }

            row.innerHTML = rowHtmlContent;
            tableBody.appendChild(row);
        });
    }

    const newTfoot = document.createElement('tfoot');
    const totalRow = document.createElement('tr');
    totalRow.classList.add('total-row');
    totalRow.innerHTML = `<td colspan="${visibleColumnCount}">Total de Equipamentos no Relatório: ${totalEquipmentCount}</td>`;
    newTfoot.appendChild(totalRow);
    document.getElementById(tableId).appendChild(newTfoot);
};

/**
 * 🚨 ALERTA DE BMs PRÓXIMAS DO FECHAMENTO (3 dias ou menos)
 */
const generateBmClosingAlert = async () => {
    console.log('🚨 INICIANDO ALERTA DE BMs...');
    const alertContainer = document.getElementById('bm-closing-alert');
    if (!alertContainer) {
        console.warn('⚠️ Elemento bm-closing-alert não encontrado');
        return;
    }
    console.log('✅ Container do alerta encontrado');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('📅 Data de hoje:', today.toISOString().split('T')[0]);
    
    const closingBms = [];

    console.log('🔍 Verificando obras:', appState.works?.length || 0);

    for (const work of appState.works) {
        if (!work.config?.measurement_periods || work.config.measurement_periods.length === 0) continue;

        work.config.measurement_periods.forEach((bm, index) => {
            const bmEndDate = new Date(bm.end + 'T00:00:00');
            const diffTime = bmEndDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            console.log(`BM ${index + 1} de ${work.name}: termina em ${bm.end}, faltam ${diffDays} dias`);

            // Se falta 3 dias ou menos (e não passou ainda)
            if (diffDays >= 0 && diffDays <= 3) {
                closingBms.push({
                    workName: work.name,
                    bmNumber: index + 1,
                    bmEnd: bm.end,
                    daysLeft: diffDays,
                    clientName: work.client_companies?.name || 'N/A'
                });
                console.log(`✅ Adicionada ao alerta: ${work.name} BM ${index + 1}`);
            }
        });
    }

    console.log('📊 BMs próximas do fechamento:', closingBms.length);

    if (closingBms.length === 0) {
        alertContainer.style.display = 'none';
        console.log('✅ Nenhuma BM próxima do fechamento');
        return;
    }

    // Ordena por dias restantes (mais urgente primeiro)
    closingBms.sort((a, b) => a.daysLeft - b.daysLeft);

    let alertHTML = `
        <div class="bm-closing-alert-box">
            <h3 style="margin: 0 0 15px 0; color: #ff6b6b; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5em;">⚠️</span>
                <span>ATENÇÃO: BMs Próximas do Fechamento!</span>
            </h3>
            <div class="bm-closing-list">
    `;

    closingBms.forEach(bm => {
        const urgencyClass = bm.daysLeft === 0 ? 'urgency-today' : bm.daysLeft === 1 ? 'urgency-tomorrow' : 'urgency-soon';
        const daysText = bm.daysLeft === 0 ? 'FECHA HOJE!' : bm.daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${bm.daysLeft} dias`;
        
        alertHTML += `
            <div class="bm-closing-item ${urgencyClass}">
                <div class="bm-closing-info">
                    <strong>🏗️ ${bm.workName}</strong> - <span style="color: #b0b0b0;">${bm.clientName}</span>
                    <br>
                    <span style="color: #4a90e2;">BM ${String(bm.bmNumber).padStart(2, '0')}</span> 
                    <span style="color: #f5a623;">📅 ${formatDateBR(bm.bmEnd)}</span>
                </div>
                <div class="bm-closing-countdown">
                    ${daysText}
                </div>
            </div>
        `;
    });

    alertHTML += `
            </div>
        </div>
    `;

    alertContainer.innerHTML = alertHTML;
    alertContainer.style.display = 'block';
};