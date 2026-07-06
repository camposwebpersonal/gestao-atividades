// relatorios_medicao_terceirizados.js - VERSÃO ATUALIZADA COM MÓDULO DE CÁLCULOS CENTRALIZADO E LÓGICA DE SOMA CORRIGIDA
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, getBMLabelForDate, sendPDFViaWhatsApp } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF } from './relatorios_medicao_terceirizados_pdf.js';
// NOVA IMPORTAÇÃO: Módulo centralizado de cálculos
import { 
    calculateEquipmentTotalValueTerceirizado,
    calculateGeneralExpensesImpact,
    calculateDailyBaseValueTerceirizado,
    calculateStoppageDiscountValue,
    EXPENSE_IMPACT_TYPES,
    calculateTotalShiftHours,
    calculateDeductibleStoppageHours,
    calculateExpenseTotal,
    calculateMobilizationCost,
    calculateDemobilizationCost,
    calculateNotesAdditions,
    calculateNotesDiscounts
} from './calculos_valores.js?v=20260302090000';


const calculateIndividualStoppageHours = (singleStoppage, entry, equipConfig, work) => {
    if (!equipConfig?.deductible_stoppages?.includes(singleStoppage.type_id)) {
        return 0;
    }

    const dayShiftStartStr = String(work?.config?.day_shift_start || '07:00');
    const dayShiftEndStr = String(work?.config?.day_shift_end || '17:00');
    const dayMealStartStr = String(work?.config?.day_meal_start || '12:00');
    const dayMealEndStr = String(work?.config?.day_meal_end || '13:00');

    // Calcular total de horas do turno para referência
    const totalShiftHours = calculateTotalShiftHours(work);

    let stoppageHours = 0;

    if (!singleStoppage.start && !singleStoppage.end) {
        // Parada sem horário específico = turno inteiro
        stoppageHours = totalShiftHours;
    } else {
        // Parada com horários específicos
        let stoppageStart = singleStoppage.start ? new Date(`${entry.date}T${singleStoppage.start}`) : null;
        let stoppageEnd = singleStoppage.end ? new Date(`${entry.date}T${singleStoppage.end}`) : null;
        
        // Limites do turno
        const shiftStart = new Date(`${entry.date}T${dayShiftStartStr}`);
        let shiftEnd = new Date(`${entry.date}T${dayShiftEndStr}`);
        if (shiftEnd < shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
        }

        // Se só tem início, vai até o fim do turno
        if (stoppageStart && !stoppageEnd) {
            stoppageEnd = shiftEnd;
        }
        
        // Se só tem fim, vem do início do turno
        if (!stoppageStart && stoppageEnd) {
            stoppageStart = shiftStart;
        }

        if (stoppageStart && stoppageEnd) {
            // Ajustar se a parada vai para o dia seguinte
            if (stoppageEnd < stoppageStart) {
                stoppageEnd.setDate(stoppageEnd.getDate() + 1);
            }

            // Garantir que a parada esteja dentro dos limites do turno
            const effectiveStart = new Date(Math.max(stoppageStart.getTime(), shiftStart.getTime()));
            const effectiveEnd = new Date(Math.min(stoppageEnd.getTime(), shiftEnd.getTime()));

            if (effectiveStart < effectiveEnd) {
                // Calcular duração bruta da parada
                let duration = (effectiveEnd.getTime() - effectiveStart.getTime()) / 3600000;

                // Subtrair horário de refeição se a parada incluir o período de refeição
                if (dayMealStartStr && dayMealEndStr) {
                    const mealStart = new Date(`${entry.date}T${dayMealStartStr}`);
                    let mealEnd = new Date(`${entry.date}T${dayMealEndStr}`);
                    if (mealEnd < mealStart) {
                        mealEnd.setDate(mealEnd.getDate() + 1);
                    }

                    // Verificar se há sobreposição entre parada e refeição
                    const overlapStart = Math.max(effectiveStart.getTime(), mealStart.getTime());
                    const overlapEnd = Math.min(effectiveEnd.getTime(), mealEnd.getTime());
                    const overlapDuration = Math.max(0, overlapEnd - overlapStart);
                    duration -= overlapDuration / 3600000;
                }

                stoppageHours = Math.max(0, duration);
            }
        }
    }

    return stoppageHours;
};


// NOVA FUNÇÃO: Utilitários para arredondamento preciso (MOVIDA PARA ESTE ARQUIVO)
const preciseRounding = {
    // Arredonda para 2 casas decimais de forma consistente
    round2(value) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    
    // Formata moeda com arredondamento preciso
    formatCurrencyPrecise(value) {
        const rounded = this.round2(value);
        return formatCurrency(rounded);
    },
    
    // Soma valores com arredondamento preciso
    sumPrecise(...values) {
        const sum = values.reduce((acc, val) => {
            const numVal = typeof val === 'number' && !isNaN(val) ? val : 0;
            return acc + numVal;
        }, 0);
        return this.round2(sum);
    }
};

const reportWorkSelect = document.getElementById('terceirizados-report-work-select');
const reportStartDate = document.getElementById('terceirizados-report-start-date');
const reportEndDate = document.getElementById('terceirizados-report-end-date');
const filterSelect = document.getElementById('terceirizados-report-filter-select');
const generateReportBtn = document.getElementById('generate-measurement-terceirizados-report-btn');
const exportPdfBtn = document.getElementById('export-terceirizados-pdf-btn');
const exportPdfDriveBtn = document.getElementById('export-terceirizados-pdf-drive-btn');
const reportOutput = document.getElementById('measurement-terceirizados-report-output');
const measurementTerceirizadosReportOptions = document.getElementById('measurement-terceirizados-report-options');
const reportBmSelect = document.getElementById('terceirizados-report-bm-select'); // NOVO: Select de BM

const columnConfigs = [
    { id: 'show-dias-trab-terc', label: 'Dias Trab.', summary: true, detail: true, default: true, combo: true },
    { id: 'show-horas-trab-terc', label: 'Horas Trab.', summary: false, detail: true, default: false, combo: true },
    { id: 'show-horimetro-inicial-terc', label: 'Horimetro Inicial', summary: false, detail: true, default: false, combo: false },
    { id: 'show-horimetro-final-terc', label: 'Horimetro Final', summary: false, detail: true, default: false, combo: false },
    { id: 'show-km-inicial-terc', label: 'KM Inicial', summary: false, detail: true, default: false, combo: false },
    { id: 'show-km-final-terc', label: 'KM Final', summary: false, detail: true, default: false, combo: false },
    { id: 'show-km-trab-terc', label: 'KM Trab.', summary: false, detail: true, default: false, combo: true },
    { id: 'show-acrescimos-terc', label: 'Acrescimos (R$)', summary: true, detail: true, default: true, combo: true },
    { id: 'show-descontos-terc', label: 'Descontos (R$)', summary: true, detail: true, default: true, combo: true },
    { id: 'show-mobilizacao-terc', label: 'Mobilizacao (R$)', summary: true, detail: false, default: true, combo: false },
    { id: 'show-desmobilizacao-terc', label: 'Desmobilizacao (R$)', summary: true, detail: false, default: true, combo: false },
    { id: 'show-paradas-desc-terc', label: 'Paradas Desc.(h)', summary: false, detail: true, default: true, combo: false },
    { id: 'show-observacoes-terc', label: 'Observacoes', summary: false, detail: true, default: true, combo: false },
    { id: 'show-dias-parados-terc', label: 'Dias Parados', summary: false, detail: true, default: false, combo: false },
    { id: 'show-valor-mensal-terc', label: 'Valor Mensal', summary: false, detail: true, default: false, combo: false },
    { id: 'show-valor-diario-terc', label: 'Valor Diario', summary: false, detail: true, default: false, combo: false },
    { id: 'show-valor-horas-terc', label: 'Valor das Horas', summary: false, detail: true, default: false, combo: false },
];

const renderColumnOptionsInlineMini = () => {
    if (!measurementTerceirizadosReportOptions) return;
    
    let html = `
        <div style="
            padding: 12px; 
            border: 1px solid var(--border-color); 
            border-radius: 6px; 
            background: var(--background-tertiary);
        ">
            <div class="report-columns-responsive-grid">
    `;
    
    columnConfigs.forEach(col => {
        html += `
            <div class="report-column-item">
                <input type="checkbox" 
                       id="${col.id}" 
                       class="column-toggle-checkbox" 
                       data-column-id="${col.id}" 
                       ${col.default ? 'checked' : ''}>
                
                <label for="${col.id}">${col.label}</label>
                
                ${col.combo ? `
                    <select id="${col.id}-placement" class="column-placement-select">
                        <option value="both">Ambos</option>
                        <option value="summary">Resumo</option>
                        <option value="detail">Detalhes</option>
                    </select>
                ` : `
                    <span class="column-placement-fixed">
                        ${col.summary && col.detail ? 'Ambos' : 
                          col.summary ? 'Resumo' : 'Detalhes'}
                    </span>
                `}
            </div>
        `;
    });
    
    html += `
            <div class="report-column-item report-column-highlight">
                <input type="checkbox" 
                       id="show-zero-values-terc" 
                       checked>
                <label for="show-zero-values-terc">💰 Mostrar Zeros</label>
            </div>
            </div>
        </div>
    `;
    
    measurementTerceirizadosReportOptions.innerHTML = html;
    
    // Event listeners
    measurementTerceirizadosReportOptions.querySelectorAll('.column-toggle-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const select = document.getElementById(`${e.target.dataset.columnId}-placement`);
            if (select && e.target.checked) {
                select.value = 'both';
            }
        });
    });
};

/**
 * FUNÇÃO CORRIGIDA: Verifica se um equipamento terceirizado deve aparecer no relatório
 * Mantida a lógica original, mas com melhor documentação
 */
const shouldEquipmentAppearInReport = async (workId, equipmentId, startDate, endDate) => {
    try {
        console.log(`=== DEBUG EQUIPAMENTO ${equipmentId} ===`);
        console.log(`Período: ${startDate} a ${endDate}`);

        // 1. BUSCAR ENTRADAS NO PERÍODO
        const entriesInPeriod = await apiClient.fetchDailyEntries(workId, equipmentId, startDate, endDate);
        console.log(`Entradas no período: ${entriesInPeriod.length}`);
        
        // 2. VERIFICAR DIAS TRABALHADOS NO PERÍODO
        const workedDays = entriesInPeriod.filter(entry => entry.is_worked);
        console.log(`Dias trabalhados: ${workedDays.length}`);
        
        // REGRA 1: SE TRABALHOU NO PERÍODO → APARECE (SEMPRE)
        if (workedDays.length > 0) {
            console.log(`RESULTADO: APARECE (trabalhou no período)`);
            return true;
        }

        // 3. SE NÃO TRABALHOU, VERIFICAR SE ESTAVA ATIVO DURANTE O PERÍODO
        console.log(`Não trabalhou no período. Verificando status durante o período...`);

        // Buscar histórico completo para analisar mobilizações/desmobilizações
        const allEntries = await apiClient.fetchData('daily_entries');
        const equipmentEntries = allEntries.filter(entry => 
            entry.work_id == workId && entry.equipment_id == equipmentId
        );
        console.log(`Histórico encontrado: ${equipmentEntries.length} entradas`);

        // Converter datas do período para comparação
        const periodStart = new Date(startDate + 'T00:00:00');
        const periodEnd = new Date(endDate + 'T00:00:00');

        // 4. ENCONTRAR MOBILIZAÇÕES E DESMOBILIZAÇÕES
        const mobilizations = [];
        const demobilizations = [];
        
        equipmentEntries.forEach(entry => {
            const entryDate = new Date(entry.date + 'T00:00:00');
            
            if (entry.is_mobilization) {
                mobilizations.push({
                    date: entryDate,
                    dateStr: entry.date
                });
            }
            if (entry.is_demobilized) {
                demobilizations.push({
                    date: entryDate,
                    dateStr: entry.date
                });
            }
        });

        // Ordenar por data
        mobilizations.sort((a, b) => a.date - b.date);
        demobilizations.sort((a, b) => a.date - b.date);

        console.log(`Mobilizações:`, mobilizations.map(m => m.dateStr));
        console.log(`Desmobilizações:`, demobilizations.map(d => d.dateStr));

        // 5. 🔥 CORREÇÃO PRINCIPAL: VERIFICAR STATUS NO INÍCIO DO PERÍODO (NÃO NO FIM)
        let lastMobilizationBeforeStart = null;
        let lastDemobilizationBeforeStart = null;

        // Encontrar a última mobilização ANTES do INÍCIO do período
        mobilizations.forEach(mob => {
            if (mob.date < periodStart) { // 🔥 MUDANÇA: < ao invés de <=
                lastMobilizationBeforeStart = mob;
            }
        });

        // Encontrar a última desmobilização ANTES do INÍCIO do período
        demobilizations.forEach(demob => {
            if (demob.date < periodStart) { // 🔥 MUDANÇA: < ao invés de <=
                lastDemobilizationBeforeStart = demob;
            }
        });

        console.log(`Última mobilização ANTES do início (${startDate}):`, lastMobilizationBeforeStart?.dateStr || 'NUNCA');
        console.log(`Última desmobilização ANTES do início (${startDate}):`, lastDemobilizationBeforeStart?.dateStr || 'NUNCA');

        // 6. DETERMINAR SE ESTAVA ATIVO NO INÍCIO DO PERÍODO
        let wasActiveAtPeriodStart = false;

        if (lastDemobilizationBeforeStart && lastMobilizationBeforeStart) {
            // Se ambas existem ANTES do início, comparar datas
            wasActiveAtPeriodStart = lastMobilizationBeforeStart.date > lastDemobilizationBeforeStart.date;
        } else if (lastMobilizationBeforeStart && !lastDemobilizationBeforeStart) {
            // Só tem mobilização ANTES do início e nunca foi desmobilizado = estava ativo
            wasActiveAtPeriodStart = true;
        } else {
            // Só tem desmobilização ou nenhuma das duas ANTES do início = estava inativo
            wasActiveAtPeriodStart = false;
        }

        console.log(`Status no início do período: ${wasActiveAtPeriodStart ? 'ATIVO' : 'INATIVO'}`);

        // 7. VERIFICAR SE HOUVE MOBILIZAÇÃO DURANTE O PERÍODO
        const mobilizationsDuringPeriod = mobilizations.filter(mob => 
            mob.date >= periodStart && mob.date <= periodEnd
        );

        console.log(`Mobilizações durante o período:`, mobilizationsDuringPeriod.map(m => m.dateStr));

        // 8. 🔥 REGRA FINAL CORRIGIDA:
        // Aparece SE:
        // - Estava ativo no início do período OU
        // - Foi mobilizado durante o período
        
        const shouldAppear = wasActiveAtPeriodStart || mobilizationsDuringPeriod.length > 0;

        if (shouldAppear) {
            console.log(`✅ RESULTADO: APARECE (estava ativo no início OU foi mobilizado durante o período)`);
        } else {
            console.log(`❌ RESULTADO: NÃO APARECE (não estava ativo no início E não foi mobilizado durante)`);
        }

        return shouldAppear;

    } catch (error) {
        console.error(`ERRO ao verificar equipamento ${equipmentId}:`, error);
        return false;
    }
};


export const initThirdPartyMeasurementReport = async () => {
    showSpinner();
    if (appState.terceirizados.length === 0) {
        appState.terceirizados = await apiClient.fetchData('terceirizados');
    }
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
    }
    if (appState.equipment.length === 0) {
        appState.equipment = await apiClient.fetchData('equipment');
    }
    if (appState.employees.length === 0) {
        appState.employees = await apiClient.fetchData('employees');
    }
    if (appState.stoppage_types.length === 0) {
        appState.stoppage_types = await apiClient.fetchData('stoppage_types');
    }

    renderColumnOptionsInlineMini();

    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    
    // 📄 Botão de download local (SEM upload)
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            exportReportToPDF('measurement-terceirizados-report-output', 'Relatorio_Medicao_Terceirizados', false, true, false);
        });
    }
    
    // ☁️ Botão de upload para Google Drive
    if (exportPdfDriveBtn) {
        exportPdfDriveBtn.addEventListener('click', () => {
            exportReportToPDF('measurement-terceirizados-report-output', 'Relatorio_Medicao_Terceirizados', false, true, true);
        });
    }
    
    // 📱 Botão de envio via WhatsApp
    const whatsappTerceirizadosBtn = document.getElementById('whatsapp-terceirizados-btn');
    if (whatsappTerceirizadosBtn) {
        whatsappTerceirizadosBtn.addEventListener('click', async () => {
            try {
                showSpinner();
                
                // 1. Gerar PDF
                const pdf = await exportReportToPDF('measurement-terceirizados-report', 'Relatório de Medição de Terceirizados');
                if (!pdf) {
                    hideSpinner();
                    return;
                }
                
                // 2. Converter para blob
                const pdfBlob = pdf.output('blob');
                
                // 3. Upload para Drive
                const reader = new FileReader();
                reader.readAsDataURL(pdfBlob);
                
                reader.onloadend = async () => {
                    try {
                        const base64Data = reader.result;
                        const fileName = 'Relatorio_Medicao_Terceirizados.pdf';
                        
                        const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pdfData: base64Data,
                                fileName: fileName,
                                workName: 'MEDICAO_TERCEIRIZADOS',
                                companyName: 'PBA TRANSPORTES',
                                bmLabel: 'RELATÓRIO',
                                dateRange: new Date().toLocaleDateString('pt-BR')
                            })
                        });

                        const result = await response.json();
                        
                        if (result.success && result.fileId) {
                            const driveLink = `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`;
                            const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=📊 Olá! Segue o relatório de medição de terceirizados.%0A%0A🔗 Link do PDF:%0A${driveLink}%0A%0AQualquer dúvida, estamos à disposição!`;
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
    
    // ✅ DEPOIS (com ordenação alfabética):
    if (reportWorkSelect) {
        // Ordenar obras alfabeticamente por nome
        const sortedWorks = [...appState.works].sort((a, b) => {
            const nameA = (a.name || '').toUpperCase();
            const nameB = (b.name || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });
        
        reportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
            sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        reportWorkSelect.addEventListener('change', handleWorkSelectChange);
    }
    
    // NOVO: Adiciona listener para mudança de BM
    if (reportBmSelect) {
        reportBmSelect.addEventListener('change', handleBmSelectChange);
    }
    
    if (filterSelect) {
    filterSelect.innerHTML = appState.terceirizados.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    // NOVO: Listener para mudança no filtro
    filterSelect.addEventListener('change', () => {
        const workId = reportWorkSelect?.value;
        if (workId) {
            applyWorkDefaultColumnsTerceirizados(workId);
        }
    });
}

// NOVO: Botão "Selecionar Todos"
const selectAllTercBtn = document.getElementById('select-all-terceirizados-btn');
if (selectAllTercBtn && filterSelect) {
    selectAllTercBtn.addEventListener('click', () => {
        Array.from(filterSelect.options).forEach(option => option.selected = true);
        
        // Reaplicar configurações
        const workId = reportWorkSelect?.value;
        if (workId) {
            applyWorkDefaultColumnsTerceirizados(workId);
        }
    });
}
    hideSpinner();
   
};


/**
 * Aplica as configurações padrão da obra aos checkboxes do relatório de terceirizados
 */
const applyWorkDefaultColumnsTerceirizados = (workId) => {
    const work = appState.works.find(w => w.id == workId);
    
    // Verificar quais terceirizados estão selecionados no filtro
    const selectedThirdParties = Array.from(filterSelect.selectedOptions).map(opt => opt.value);
    
    console.log('🔍 Terceirizados selecionados:', selectedThirdParties);
    
    // LÓGICA INTELIGENTE:
    // Se APENAS 1 terceirizado está selecionado, usar sua configuração específica
    // Senão, usar a configuração padrão geral
    
    let workDefaultColumns = work?.config?.default_report_columns_terc || {};
    
    if (selectedThirdParties.length === 1) {
        // Buscar configuração específica deste terceirizado
        const specificConfig = work?.config?.terceirizado_specific_columns?.find(
            config => config.terceirizado_id == selectedThirdParties[0]
        );
        
        if (specificConfig && specificConfig.columns) {
            console.log('✅ Usando configuração específica do terceirizado:', specificConfig);
            workDefaultColumns = specificConfig.columns;
        } else {
            console.log('⚠️ Terceirizado não tem configuração específica, usando padrão geral');
        }
    } else if (selectedThirdParties.length > 1) {
        // Se múltiplos terceirizados selecionados, verificar se TODOS têm a mesma coluna habilitada
        const allSpecificConfigs = work?.config?.terceirizado_specific_columns?.filter(
            config => selectedThirdParties.includes(config.terceirizado_id.toString())
        ) || [];
        
        if (allSpecificConfigs.length > 0) {
            console.log('🔀 Múltiplos terceirizados selecionados, mesclando configurações...');
            
            // Criar objeto mesclado: uma coluna só fica marcada se TODOS os terceirizados a tiverem
            const mergedColumns = {};
            
            columnConfigs.forEach(col => {
                const configKey = col.id.replace('show-', '').replace('-terc', '').replace(/-/g, '_');
                
                // Verificar se TODOS os terceirizados selecionados têm esta coluna habilitada
                const allHaveEnabled = allSpecificConfigs.every(config => 
                    config.columns?.[configKey]?.enabled === true
                );
                
                if (allHaveEnabled) {
                    // Se todos têm, usar a configuração do primeiro como referência para placement
                    mergedColumns[configKey] = {
                        enabled: true,
                        placement: allSpecificConfigs[0].columns[configKey]?.placement || 'both'
                    };
                } else {
                    // Se nem todos têm, usar configuração padrão geral
                    mergedColumns[configKey] = workDefaultColumns[configKey] || { enabled: false, placement: 'both' };
                }
            });
            
            workDefaultColumns = mergedColumns;
        }
    } else {
        console.log('📋 Usando configuração padrão geral (nenhum filtro específico)');
    }
    
    // SEMPRE aplicar as configurações (resetando as anteriores)
    columnConfigs.forEach(col => {
        const configKey = col.id.replace('show-', '').replace('-terc', '').replace(/-/g, '_');
        const workDefault = workDefaultColumns[configKey];
        
        const checkbox = document.getElementById(col.id);
        if (checkbox) {
            // SEMPRE aplicar a configuração determinada (ou padrão se não houver)
            if (workDefault !== undefined) {
                checkbox.checked = workDefault.enabled !== false;
            } else {
                // Se não há configuração, usar o padrão da coluna
                checkbox.checked = col.default || false;
            }
        }
        
        if (col.combo) {
            const placementSelect = document.getElementById(`${col.id}-placement`);
            if (placementSelect) {
                if (workDefault?.placement) {
                    placementSelect.value = workDefault.placement;
                } else {
                    placementSelect.value = 'both'; // Padrão
                }
            }
        }
    });
    
    // Mostrar Zeros
    const showZerosCheckbox = document.getElementById('show-zero-values-terc');
    if (showZerosCheckbox) {
        if (workDefaultColumns.mostrar_zeros !== undefined) {
            showZerosCheckbox.checked = workDefaultColumns.mostrar_zeros.enabled !== false;
        } else {
            showZerosCheckbox.checked = true; // Padrão
        }
    }
};






/**
 * FUNÇÃO PRINCIPAL ATUALIZADA: Gera relatório usando módulo centralizado de cálculos
 */
const generateReport = async () => {
    const workId = reportWorkSelect?.value;
    const startDate = reportStartDate?.value;
    const endDate = reportEndDate?.value;
    const selectedThirdParties = Array.from(filterSelect.selectedOptions).map(opt => opt.value);

    if (!workId || !startDate || !endDate) {
        alert('Selecione a obra e o periodo para gerar o relatorio.');
        return;
    }

    showSpinner();
    if (reportOutput) reportOutput.innerHTML = '';
    if (exportPdfBtn) exportPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        const dailyEntries = await apiClient.fetchDailyEntries(workId, null, startDate, endDate);
        const generalExpenses = await apiClient.fetchData(
            'general_expenses',
            '*, equipment(*)',
            'date',
            true
        ).then(data => data.filter(entry =>
            entry.work_id == workId && entry.date >= startDate && entry.date <= endDate
        ));
        // NOVO: Busca avarias para o período
        const damages = await apiClient.fetchDamages(workId, startDate, endDate);

        // Filtra apenas equipamentos terceirizados que estão configurados na obra E que existem
        const allThirdPartyEquipmentInWork = appState.equipment
            .filter(e => {
                // Verifica se é terceirizado
                if (!e.is_terceirizado) return false;
                
                // Verifica se está configurado na obra
                const isInWork = work.config?.equipment?.some(ec => ec.equipment_id == e.id);
                if (!isInWork) return false;
                
                // Aplica filtro de empresa terceirizada selecionada, se houver
                if (selectedThirdParties.length > 0 && 
                    !selectedThirdParties.includes(e.terceirizado_id.toString())) {
                    return false;
                }
                
                return true;
            });

        const validEquipmentIds = new Set();
        for (const equip of allThirdPartyEquipmentInWork) {
            const shouldAppear = await shouldEquipmentAppearInReport(workId, equip.id, startDate, endDate);
            if (shouldAppear) {
                validEquipmentIds.add(equip.id);
            }
        }
        
        // Separa despesas por equipamento e despesas gerais para terceirizados
        const expensesByEquipment = generalExpenses.reduce((acc, expense) => {
            if (expense.equipment_id && validEquipmentIds.has(expense.equipment_id)) {
                (acc[expense.equipment_id] = acc[expense.equipment_id] || []).push(expense);
            }
            return acc;
        }, {});

        // NOVO: Separa avarias por equipamento
        const damagesByEquipment = damages.reduce((acc, damage) => {
            if (damage.equipment_id && validEquipmentIds.has(damage.equipment_id)) {
                (acc[damage.equipment_id] = acc[damage.equipment_id] || []).push(damage);
            }
            return acc;
        }, {});
        
        const generalThirdPartyExpenses = generalExpenses.filter(expense => 
            !expense.equipment_id && 
            (expense.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO || 
             expense.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO_ESPECIFICO) &&
            (selectedThirdParties.length === 0 || selectedThirdParties.includes(expense.terceirizado_id.toString()))
        );

        // NOVO: Avarias gerais para terceirizados (sem equipamento específico)
        const generalThirdPartyDamages = damages.filter(damage =>
            !damage.equipment_id &&
            (damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.ADD_DAMAGE_TERCEIRIZADO ||
             damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.DISC_DAMAGE_TERCEIRIZADO) &&
            (selectedThirdParties.length === 0 || selectedThirdParties.includes(damage.terceirizado_id.toString()))
        );


        const entriesByEquipment = dailyEntries.reduce((acc, entry) => {
            if (validEquipmentIds.has(entry.equipment_id)) {
                (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
            }
            return acc;
        }, {});

        const allRelevantEquipmentIds = new Set([...Object.keys(entriesByEquipment), ...Object.keys(expensesByEquipment), ...Object.keys(damagesByEquipment)]);
        
        // 🎯 Converter Set para Array e ordenar pela ordem do cadastro da obra
        const sortedEquipmentIds = Array.from(allRelevantEquipmentIds).sort((idA, idB) => {
            const equipmentInWork = work?.config?.equipment || [];
            const indexA = equipmentInWork.findIndex(ec => ec.equipment_id == idA);
            const indexB = equipmentInWork.findIndex(ec => ec.equipment_id == idB);
            
            if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
                return indexA - indexB; // Respeita a ordem do cadastro
            }
            
            // Fallback: alfabético
            const equipA = appState.equipment.find(e => e.id == idA);
            const equipB = appState.equipment.find(e => e.id == idB);
            const prefixA = equipA?.prefix || '';
            const prefixB = equipB?.prefix || '';
            return prefixA.localeCompare(prefixB);
        });

        if (sortedEquipmentIds.length === 0 && generalThirdPartyExpenses.length === 0 && generalThirdPartyDamages.length === 0) {
            reportOutput.innerHTML = '<p>Nenhum lancamento encontrado para equipamentos terceirizados ativos no periodo e filtros selecionados.</p>';
            hideSpinner();
            return;
        }

        // Carregar configurações padrão da obra para terceirizados

const workDefaultColumns = work?.config?.default_report_columns_terc || {};

const columnVisibility = {};
columnConfigs.forEach(col => {
    const checkbox = document.getElementById(col.id);
    const placementSelect = document.getElementById(`${col.id}-placement`);
    
    // Mapear IDs das checkboxes para as chaves da configuração
    let configKey = col.id.replace('show-', '').replace('-terc', '').replace(/-/g, '_');
    const workDefault = workDefaultColumns[configKey];
    
    columnVisibility[col.id] = {
        show: checkbox ? checkbox.checked : (workDefault?.enabled !== undefined ? workDefault.enabled : col.default),
        placement: placementSelect ? placementSelect.value : (workDefault?.placement || (col.summary && col.detail ? 'both' : (col.summary ? 'summary' : 'detail')))
    };
});

        const showZeroValues = document.getElementById('show-zero-values-terc')?.checked ?? true;
        
        // DECLARAÇÃO DAS VARIÁVEIS FORA DO LOOP
        let grandTotal = 0;
        let seqNum = 1;

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'Minha Empresa'}</h3>
                    <p><strong>Obra:</strong> ${work?.name || 'N/A'}</p>
                    <p><strong>Relatorio de Medicao - Empresas Terceirizadas</strong></p>
                    <p><strong>Periodo Medido:</strong> ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    <hr>
                </div>
                <div class="report-summary">
                    <h3>Resumo Geral da Medicao de Terceirizados</h3>
                    <div class="table-wrapper responsive">
                        <table id="summary-table">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #ddd;">SEQ</th>
                                    <th style="border: 1px solid #ddd;">Empresa Terceirizada</th>
                                    <th style="border: 1px solid #ddd;">Equipamento</th>
                                    <th style="border: 1px solid #ddd;">Valor Unit.</th>
                                    ${columnVisibility['show-dias-trab-terc'].show && (columnVisibility['show-dias-trab-terc'].placement === 'summary' || columnVisibility['show-dias-trab-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Dias Trab.</th>' : ''}
                                    ${columnVisibility['show-horas-trab-terc'].show && (columnVisibility['show-horas-trab-terc'].placement === 'summary' || columnVisibility['show-horas-trab-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Horas Trab.</th>' : ''}
                                    ${columnVisibility['show-horimetro-inicial-terc'].show && (columnVisibility['show-horimetro-inicial-terc'].placement === 'summary' || columnVisibility['show-horimetro-inicial-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Horímetro Inicial</th>' : ''}
                                    ${columnVisibility['show-horimetro-final-terc'].show && (columnVisibility['show-horimetro-final-terc'].placement === 'summary' || columnVisibility['show-horimetro-final-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Horímetro Final</th>' : ''}
                                    ${columnVisibility['show-km-inicial-terc'].show && (columnVisibility['show-km-inicial-terc'].placement === 'summary' || columnVisibility['show-km-inicial-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Inicial</th>' : ''}
                                    ${columnVisibility['show-km-final-terc'].show && (columnVisibility['show-km-final-terc'].placement === 'summary' || columnVisibility['show-km-final-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Final</th>' : ''}
                                    ${columnVisibility['show-km-trab-terc'].show && (columnVisibility['show-km-trab-terc'].placement === 'summary' || columnVisibility['show-km-trab-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Trab.</th>' : ''}
                                    ${columnVisibility['show-acrescimos-terc'].show && (columnVisibility['show-acrescimos-terc'].placement === 'summary' || columnVisibility['show-acrescimos-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">ACRÉSC. (R$)</th>' : ''}
                                    ${columnVisibility['show-descontos-terc'].show && (columnVisibility['show-descontos-terc'].placement === 'summary' || columnVisibility['show-descontos-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">DESC. (R$)</th>' : ''}
                                    ${columnVisibility['show-mobilizacao-terc'].show && (columnVisibility['show-mobilizacao-terc'].placement === 'summary' || columnVisibility['show-mobilizacao-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">MOB. (R$)</th>' : ''}
                                    ${columnVisibility['show-desmobilizacao-terc'].show && (columnVisibility['show-desmobilizacao-terc'].placement === 'summary' || columnVisibility['show-desmobilizacao-terc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">DESMOB. (R$)</th>' : ''}
                                    <th style="border: 1px solid #ddd;">TOTAL (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        
        for (const equipmentId of allRelevantEquipmentIds) {
            const equipmentDailyEntries = entriesByEquipment[equipmentId] || [];
            const equipmentGeneralExpenses = expensesByEquipment[equipmentId] || [];
            const equipmentDamagesForEquip = damagesByEquipment[equipmentId] || [];

            const equipment = appState.equipment.find(e => e.id == equipmentId);
            
            if (!equipment) {
                console.warn(`Equipamento ID ${equipmentId} nao encontrado no cadastro geral`);
                continue;
            }
            
            const thirdPartyCompany = appState.terceirizados.find(t => t.id == equipment.terceirizado_id);
            const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);
            
            if (!equipConfig) continue;

            const equipmentCalculation = calculateEquipmentTotalValueTerceirizado(
                equipmentDailyEntries, 
                equipmentGeneralExpenses, 
                equipConfig, 
                work,
                equipmentDamagesForEquip
            );

            let totalWorkedHours = 0;
            let totalKmWorked = 0;

            const workedEntries = equipmentDailyEntries.filter(entry => entry.is_worked);
            let firstHorometerStart = '---';
            let lastHorometerEnd = '---';
            let firstKmStart = '---'; 
            let lastKmEnd = '---'; 

            if (workedEntries.length > 0) {
                const sortedWorkedEntries = [...workedEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
                firstHorometerStart = sortedWorkedEntries[0].horometer_start || '---';
                lastHorometerEnd = sortedWorkedEntries[sortedWorkedEntries.length - 1].horometer_end || '---';
                firstKmStart = sortedWorkedEntries[0].km_start || '---';
                lastKmEnd = sortedWorkedEntries[sortedWorkedEntries.length - 1].km_end || '---';
            }

            equipmentDailyEntries.forEach(entry => {
                // 🔥 Validação: só calcula se AMBOS os valores existirem
                const horometerStart = parseFloat(entry.horometer_start);
                const horometerEnd = parseFloat(entry.horometer_end);
                const kmStart = parseFloat(entry.km_start);
                const kmEnd = parseFloat(entry.km_end);
                
                if (horometerStart && horometerEnd && horometerStart > 0 && horometerEnd > 0) {
                    totalWorkedHours += horometerEnd - horometerStart;
                }
                
                if (kmStart && kmEnd && kmStart > 0 && kmEnd > 0) {
                    totalKmWorked += kmEnd - kmStart;
                }
            });

            const measureType = equipConfig?.measurement_type_terceirizado || equipConfig?.measurement_type;
            const measureValue = parseFloat(equipConfig?.measurement_value_terceirizado || equipConfig?.measurement_value || 0);
            const guaranteedHours = equipConfig?.guaranteed_hours_terceirizado || equipConfig?.guaranteed_hours;

            const shouldShowEquipment = showZeroValues || (equipmentCalculation.workedDays > 0 || equipmentCalculation.totalValue !== 0);

            if (shouldShowEquipment) {
                const totalDetailFooter = calculateDetailFooterTotalTerceirizado(
                    equipmentDailyEntries,
                    equipConfig,
                    work,
                    equipmentCalculation.mobilizationCost,
                    equipmentCalculation.demobilizationCost
                );
                
                grandTotal += totalDetailFooter;
                
                const totalAdditions = preciseRounding.sumPrecise(
                    equipmentCalculation.notesAdditions,
                    equipmentCalculation.expensesAdditions,
                    equipmentCalculation.damagesAdditions || 0
                );
                
                const totalDiscounts = preciseRounding.sumPrecise(
                    equipmentCalculation.stoppageDiscounts,
                    equipmentCalculation.notesDiscounts,
                    equipmentCalculation.expensesDiscounts,
                    equipmentCalculation.damagesDiscounts || 0
                );
                
                reportHTML += `
                    <tr>
                        <td data-label="SEQ">${seqNum++}</td>
                        <td data-label="Empresa Terceirizada">${thirdPartyCompany?.name || 'N/A'}</td>
                        <td data-label="Equipamento">${equipment?.prefix || 'N/A'}${equipConfig?.equipment_work_prefix ? ` (${equipConfig.equipment_work_prefix})` : ''}</td>
                        <td data-label="Valor Unit.">${formatCurrency(measureValue)} / ${formatMeasurementType(measureType || 'N/A', guaranteedHours)}</td>
                        ${columnVisibility['show-dias-trab-terc'].show && (columnVisibility['show-dias-trab-terc'].placement === 'summary' || columnVisibility['show-dias-trab-terc'].placement === 'both') ? `<td data-label="Dias Trab.">${equipmentCalculation.workedDays}</td>` : ''}
                        ${columnVisibility['show-horas-trab-terc'].show && (columnVisibility['show-horas-trab-terc'].placement === 'summary' || columnVisibility['show-horas-trab-terc'].placement === 'both') ? `<td data-label="Horas Trab.">${totalWorkedHours.toFixed(2)}h</td>` : ''}
                        ${columnVisibility['show-horimetro-inicial-terc'].show && (columnVisibility['show-horimetro-inicial-terc'].placement === 'summary' || columnVisibility['show-horimetro-inicial-terc'].placement === 'both') ? `<td data-label="Horímetro Inicial">${firstHorometerStart}</td>` : ''}
                        ${columnVisibility['show-horimetro-final-terc'].show && (columnVisibility['show-horimetro-final-terc'].placement === 'summary' || columnVisibility['show-horimetro-final-terc'].placement === 'both') ? `<td data-label="Horímetro Final">${lastHorometerEnd}</td>` : ''}
                        ${columnVisibility['show-km-inicial-terc'].show && (columnVisibility['show-km-inicial-terc'].placement === 'summary' || columnVisibility['show-km-inicial-terc'].placement === 'both') ? `<td data-label="KM Inicial">${firstKmStart}</td>` : ''}
                        ${columnVisibility['show-km-final-terc'].show && (columnVisibility['show-km-final-terc'].placement === 'summary' || columnVisibility['show-km-final-terc'].placement === 'both') ? `<td data-label="KM Final">${lastKmEnd}</td>` : ''}
                        ${columnVisibility['show-km-trab-terc'].show && (columnVisibility['show-km-trab-terc'].placement === 'summary' || columnVisibility['show-km-trab-terc'].placement === 'both') ? `<td data-label="KM Trab.">${totalKmWorked.toFixed(2)} km</td>` : ''}
                        ${columnVisibility['show-acrescimos-terc'].show && (columnVisibility['show-acrescimos-terc'].placement === 'summary' || columnVisibility['show-acrescimos-terc'].placement === 'both') ? `<td data-label="Acrescimos (R$)" style="${totalAdditions > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${formatCurrency(totalAdditions)}</td>` : ''}
                        ${columnVisibility['show-descontos-terc'].show && (columnVisibility['show-descontos-terc'].placement === 'summary' || columnVisibility['show-descontos-terc'].placement === 'both') ? `<td data-label="Descontos (R$)" style="${totalDiscounts > 0 ? 'background-color: #ffebee; font-weight: bold;' : ''}">${formatCurrency(totalDiscounts)}</td>` : ''}
                        ${columnVisibility['show-mobilizacao-terc'].show && (columnVisibility['show-mobilizacao-terc'].placement === 'summary' || columnVisibility['show-mobilizacao-terc'].placement === 'both') ? `<td data-label="Mobilizacao (R$)" style="${equipmentCalculation.mobilizationCost > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${formatCurrency(equipmentCalculation.mobilizationCost)}</td>` : ''}
                        ${columnVisibility['show-desmobilizacao-terc'].show && (columnVisibility['show-desmobilizacao-terc'].placement === 'summary' || columnVisibility['show-desmobilizacao-terc'].placement === 'both') ? `<td data-label="Desmobilizacao (R$)" style="${equipmentCalculation.demobilizationCost > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${formatCurrency(equipmentCalculation.demobilizationCost)}</td>` : ''}
                        <td data-label="Total Equip. (R$)"><strong>${formatCurrency(totalDetailFooter)}</strong></td>
                    </tr>
                `;
            }
        }

        reportHTML += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4">Total: ${sortedEquipmentIds.length} equipamentos</td>
                                    <td colspan="${(Object.keys(columnVisibility).filter(k => columnVisibility[k].show && (columnVisibility[k].placement === 'summary' || columnVisibility[k].placement === 'both')).length > 0 ? Object.keys(columnVisibility).filter(k => columnVisibility[k].show && (columnVisibility[k].placement === 'summary' || columnVisibility[k].placement === 'both')).length : 0)}"></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div class="report-total" id="grand-total">Total Geral (Terceirizados): ${formatCurrency(grandTotal)}</div>
                </div>
        `;
        
        const detailHeaders = ["Data", "Dia Sem.", "Status", "Horímetro/KM", "Horas Trab.", "KM Trab.", "Paradas (h)", "Valor Dia", "Observações"];

        for (const equipmentId of sortedEquipmentIds) {
            const equipmentDailyEntries = entriesByEquipment[equipmentId] || [];
            const equipmentGeneralExpenses = expensesByEquipment[equipmentId] || [];
            const equipmentDamagesForEquip = damagesByEquipment[equipmentId] || [];

            const equipment = appState.equipment.find(e => e.id == equipmentId);
            if (!equipment) continue;
            
            const thirdPartyCompany = appState.terceirizados.find(t => t.id == equipment.terceirizado_id);
            const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);
            
            if (!equipConfig) continue;
            
            const totalDetailFooter = calculateDetailFooterTotalTerceirizado(
                equipmentDailyEntries, 
                equipConfig, 
                work, 
                calculateMobilizationCost(equipmentDailyEntries, equipConfig, true),
                calculateDemobilizationCost(equipmentDailyEntries, equipConfig, true)
            );

            const detailRows = equipmentDailyEntries.map(entry => {
    const dateObj = new Date(entry.date + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
    const status = entry.is_worked ? 'Trab.' : 'Parad.';
    
    // 🔥 Validação: só calcula se AMBOS os valores existirem
    let hoursWorked = 0;
    let kmWorked = 0;
    
    const horometerStart = parseFloat(entry.horometer_start);
    const horometerEnd = parseFloat(entry.horometer_end);
    const kmStart = parseFloat(entry.km_start);
    const kmEnd = parseFloat(entry.km_end);
    
    if (horometerStart && horometerEnd && horometerStart > 0 && horometerEnd > 0) {
        hoursWorked = preciseRounding.round2(horometerEnd - horometerStart);
    }
    
    if (kmStart && kmEnd && kmStart > 0 && kmEnd > 0) {
        kmWorked = preciseRounding.round2(kmEnd - kmStart);
    }
    
    const dailyStoppageDiscountHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
    const dailyValue = calculateCompleteDailyValueForReportTerceirizado(entry, equipConfig, work);
    
    let mobilizationCostForDay = 0;
    let demobilizationCostForDay = 0;
    
    if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
        if (entry.mobilization_manual_value) {
            mobilizationCostForDay = parseFloat(entry.mobilization_manual_value);
        } else if (equipConfig.mobilization_cost_terceirizado) {
            mobilizationCostForDay = parseFloat(equipConfig.mobilization_cost_terceirizado);
        }
    }
    
    if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
        if (entry.demobilization_manual_value) {
            demobilizationCostForDay = parseFloat(entry.demobilization_manual_value);
        } else if (equipConfig.demobilization_cost_terceirizado) {
            demobilizationCostForDay = parseFloat(equipConfig.demobilization_cost_terceirizado);
        }
    }
    
    const completeDailyValueTercWithMobDemob = preciseRounding.sumPrecise(
        dailyValue,
        mobilizationCostForDay,
        demobilizationCostForDay
    );

    const dailyObservations = [];
    if (entry.notes && entry.notes.length > 0) {
        entry.notes.forEach(note => {
            // ---> INÍCIO DA ALTERAÇÃO <---
            // Respeitar a flag para não exibir a nota no relatório OU NO PDF
            if (note.hide_in_report || note.hide_in_pdf) {
                console.log(`🔒 Nota oculta (terc): hide_in_report=${note.hide_in_report}, hide_in_pdf=${note.hide_in_pdf}, descrição="${note.description}"`);
                return; // Pula para a próxima nota, mas o valor já foi contabilizado
            }
            // ---> FIM DA ALTERAÇÃO <---
            
            const noteValue = preciseRounding.round2((note.quantity || 0) * (note.value || 0));
            if (note.type === 'addition' && (note.target === 'terceirizado' || note.target === 'both')) {
                dailyObservations.push(`Acréscimo: ${note.description} (${preciseRounding.formatCurrencyPrecise(noteValue)})`);
            }
            if (note.type === 'discount' && (note.target === 'terceirizado' || note.target === 'both')) {
                dailyObservations.push(`Desconto: ${preciseRounding.formatCurrencyPrecise(noteValue)}`);
            }
            if (note.type === 'observation' && (note.target === 'terceirizado' || note.target === 'both')) {
                dailyObservations.push(`Nota: ${note.description}`);
            }
        });
    }
    
    if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
        let mobCostTerc = 0;
        if (entry.mobilization_manual_value) {
            mobCostTerc = parseFloat(entry.mobilization_manual_value);
        } else if (equipConfig.mobilization_cost_terceirizado) {
            mobCostTerc = parseFloat(equipConfig.mobilization_cost_terceirizado);
        }
        if (mobCostTerc > 0) {
            dailyObservations.push(`MOBILIZAÇÃO (${preciseRounding.formatCurrencyPrecise(mobCostTerc)})`);
        } else {
            dailyObservations.push(`MOBILIZAÇÃO`);
        }
    }
    
    if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
        let demobCostTerc = 0;
        if (entry.demobilization_manual_value) {
            demobCostTerc = parseFloat(entry.demobilization_manual_value);
        } else if (equipConfig.demobilization_cost_terceirizado) {
            demobCostTerc = parseFloat(equipConfig.demobilization_cost_terceirizado);
        }
        if (demobCostTerc > 0) {
            dailyObservations.push(`DESMOBILIZAÇÃO (${preciseRounding.formatCurrencyPrecise(demobCostTerc)})`);
        } else {
            dailyObservations.push(`DESMOBILIZAÇÃO`);
        }
    }
    
    if (entry.stoppages && entry.stoppages.length > 0) {
        const deductibleStoppageNames = [];
        entry.stoppages.forEach(stoppage => {
            const stopType = appState.stoppage_types.find(st => st.id == stoppage.type_id);
            if (stopType) {
                deductibleStoppageNames.push(stopType.name);
            }
        });
        if (deductibleStoppageNames.length > 0 && dailyStoppageDiscountHours > 0) {
            dailyObservations.push(`Parada: ${deductibleStoppageNames.join(', ')} (${dailyStoppageDiscountHours.toFixed(2)}h)`);
        }
    }
    
    // Adicionar avarias que ocorreram nesta data
    const entryDate = entry.date;
    equipmentDamagesForEquip.forEach(damage => {
        if (damage.damage_date === entryDate) {
            const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
            const impactType = damage.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT ? 'Acréscimo' : 'Desconto';
            const valueStr = damageTotal > 0 ? ` - ${preciseRounding.formatCurrencyPrecise(damageTotal)}` : '';
            const obsStr = damage.observations ? ` - ${damage.observations}` : '';
            dailyObservations.push(`⚠️ AVARIA Cód ${damage.id} (${impactType})${obsStr}${valueStr}`);
        }
    });
    
    const formattedObservations = dailyObservations.length > 0 ? dailyObservations.join('; ') : '---';

    return `
            <tr>
                <td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td>
                <td style="border: 1px solid #ddd;">${dayOfWeek}</td>
                <td style="border: 1px solid #ddd;">${status}</td>
                <td style="border: 1px solid #ddd;">${entry.horometer_start || '---'} - ${entry.horometer_end || '---'}</td>
                <td style="border: 1px solid #ddd;">${hoursWorked.toFixed(2)}</td>
                <td style="border: 1px solid #ddd;">${kmWorked.toFixed(2)}</td>
                <td style="border: 1px solid #ddd;">${dailyStoppageDiscountHours.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(completeDailyValueTercWithMobDemob)}</td>
                <td style="border: 1px solid #ddd;">${formattedObservations}</td>
            </tr>
        `;
}).join('');

            
            const totalWorkedHoursDetail = equipmentDailyEntries.reduce((sum, entry) => sum + preciseRounding.round2((entry.horometer_end || 0) - (entry.horometer_start || 0)), 0);
            const totalKmWorkedDetail = equipmentDailyEntries.reduce((sum, entry) => sum + preciseRounding.round2((entry.km_end || 0) - (entry.km_start || 0)), 0);
            const totalStoppageHoursDetail = equipmentDailyEntries.reduce((sum, entry) => sum + calculateDeductibleStoppageHours(entry, equipConfig, work), 0);

            let mobilizationDate = null;
            let demobilizationDate = null;
            equipmentDailyEntries.forEach(entry => {
                if (entry.is_mobilization && !mobilizationDate) {
                    mobilizationDate = entry.date;
                }
                if (entry.is_demobilized && !demobilizationDate) {
                    demobilizationDate = entry.date;
                }
            });
            
            const detailSummaryRows = `
                ${generateDetailedTercAdditionsRows(equipmentDailyEntries, equipmentGeneralExpenses, equipmentDamagesForEquip, equipConfig, work)}
                ${generateDetailedTercDiscountsRows(equipmentDailyEntries, equipmentGeneralExpenses, equipmentDamagesForEquip, equipConfig, work)}
                <tr><td style="border: 1px solid #ddd;"><strong>Total Equipamento</strong></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"><strong>${formatCurrency(totalDetailFooter)}</strong></td></tr>
            `;

            
            reportHTML += `
                <div class="report-detail" data-equip-id="${equipmentId}">
                    <h3>Detalhamento: ${equipment?.prefix || 'N/A'}${equipConfig?.equipment_work_prefix ? ` (${equipConfig.equipment_work_prefix})` : ''} <span class="terceirizado-owner">(${thirdPartyCompany?.name || 'N/A'})</span></h3>
                    <div class="table-wrapper responsive">
                        <table style="border-collapse: collapse;">
                            <thead><tr>
                                ${detailHeaders.map(h => `<th style="border: 1px solid #ddd;">${h}</th>`).join('')}
                            </tr></thead>
                            <tbody>${detailRows}</tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" style="border: 1px solid #ddd; text-align: right; font-weight: bold;">Totais:</td>
                                    <td style="border: 1px solid #ddd; font-weight: bold;">${totalWorkedHoursDetail.toFixed(2)}h</td>
                                    <td style="border: 1px solid #ddd; font-weight: bold;">${totalKmWorkedDetail.toFixed(2)} km</td>
                                    <td style="border: 1px solid #ddd; font-weight: bold;">${totalStoppageHoursDetail.toFixed(2)}h</td>
                                    <td style="border: 1px solid #ddd; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(totalDetailFooter)}</td>
                                    <td style="border: 1px solid #ddd;"></td>
                                </tr>
                                
                            </tfoot>
                        </table>
                    </div>
                    <div class="table-wrapper">
                        <table class="detail-summary-table" style="border-collapse: collapse;">
                         <thead><tr><th style="border: 1px solid #ddd;">Tipo</th><th style="border: 1px solid #ddd;">Data</th><th style="border: 1px solid #ddd;">Descricao</th><th style="border: 1px solid #ddd;">Valor</th></tr></thead>
                         <tbody>${detailSummaryRows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }

                if (generalThirdPartyExpenses.length > 0 || generalThirdPartyDamages.length > 0) {
                    const expensesByCompanyAndType = {};
                    
                    // CORREÇÃO 1: Cálculo correto das despesas gerais
                    // 🔥 CORREÇÃO: Usar impacto_terceirizado_total ao invés de campos que não existem
                    generalThirdPartyExpenses.forEach(expense => {
                        // ✅ CORRETO: Usar o campo que realmente existe no banco
                        const expenseTotal = parseFloat(expense.impacto_terceirizado_total) || 0;
                        
                        const thirdPartyId = expense.terceirizado_id;
                        const isAddition = expense.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO_ESPECIFICO;
                        const key = `${thirdPartyId}_${isAddition ? 'addition' : 'discount'}`;
                        
                        if (!expensesByCompanyAndType[key]) {
                            expensesByCompanyAndType[key] = {
                                thirdPartyId,
                                isAddition,
                                total: 0,
                                details: []
                            };
                        }
                        
                        // ✅ Somar o valor correto
                        expensesByCompanyAndType[key].total += expenseTotal;
                        expensesByCompanyAndType[key].details.push({
                            description: expense.description,
                            value: expenseTotal,
                            date: expense.date
                        });
                    });
                
                
                    // CORREÇÃO 3: Cálculo correto das avarias gerais (manter igual, mas garantir consistência)
                    generalThirdPartyDamages.forEach(damage => {
                        const damageTotal = parseFloat(damage.total_value) || 0; // JÁ ESTÁ CORRETO
                        const thirdPartyId = damage.terceirizado_id;
                        const isAddition = damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.ADD_DAMAGE_TERCEIRIZADO;
                        const key = `${thirdPartyId}_${isAddition ? 'addition' : 'discount'}`;
                
                        if (!expensesByCompanyAndType[key]) {
                            expensesByCompanyAndType[key] = {
                                thirdPartyId,
                                isAddition,
                                total: 0,
                                details: []
                            };
                        }
                        
                        expensesByCompanyAndType[key].total += damageTotal;
                        expensesByCompanyAndType[key].details.push({
                            description: `Avaria - Cód: ${damage.id} - ${damage.observations || 'N/A'}`,
                            value: damageTotal,
                            date: damage.damage_date
                        });
                    });
                
                    let newTableRows = '';
                    let allDetailSections = '';
                    
                    Object.values(expensesByCompanyAndType).forEach(group => {
                        const thirdParty = appState.terceirizados.find(t => t.id == group.thirdPartyId);
                        const companyName = thirdParty?.name || 'N/A';
                        const typeLabel = group.isAddition ? 'ACRESCIMO' : 'DESCONTO';
                        const equipmentLabel = `"${companyName}" - ${typeLabel} - DESPESA`;
                        
                        // CORREÇÃO 4: Aplicar corretamente o sinal no grandTotal
                        const totalGroupValue = preciseRounding.round2(group.total);
                        grandTotal += group.isAddition ? totalGroupValue : -totalGroupValue;
                
                        newTableRows += `
                            <tr>
                                <td data-label="SEQ">${seqNum++}</td>
                                <td data-label="Empresa Terceirizada">${equipmentLabel}</td>
                                <td data-label="Equipamento">---</td>
                                <td data-label="Valor Unit.">---</td>
                                ${columnVisibility['show-dias-trab-terc'].show && (columnVisibility['show-dias-trab-terc'].placement === 'summary' || columnVisibility['show-dias-trab-terc'].placement === 'both') ? '<td data-label="Dias Trab.">---</td>' : ''}
                                ${columnVisibility['show-horas-trab-terc'].show && (columnVisibility['show-horas-trab-terc'].placement === 'summary' || columnVisibility['show-horas-trab-terc'].placement === 'both') ? '<td data-label="Horas Trab.">---</td>' : ''}
                                ${columnVisibility['show-horimetro-inicial-terc'].show && (columnVisibility['show-horimetro-inicial-terc'].placement === 'summary' || columnVisibility['show-horimetro-inicial-terc'].placement === 'both') ? `<td style="border: 1px solid #ddd;">---</td>` : ''}
                                ${columnVisibility['show-horimetro-final-terc'].show && (columnVisibility['show-horimetro-final-terc'].placement === 'summary' || columnVisibility['show-horimetro-final-terc'].placement === 'both') ? `<td style="border: 1px solid #ddd;">---</td>` : ''}
                                ${columnVisibility['show-km-inicial-terc'].show && (columnVisibility['show-km-inicial-terc'].placement === 'summary' || columnVisibility['show-km-inicial-terc'].placement === 'both') ? `<td style="border: 1px solid #ddd;">---</td>` : ''}
                                ${columnVisibility['show-km-final-terc'].show && (columnVisibility['show-km-final-terc'].placement === 'summary' || columnVisibility['show-km-final-terc'].placement === 'both') ? `<td style="border: 1px solid #ddd;">---</td>` : ''}
                                ${columnVisibility['show-km-trab-terc'].show && (columnVisibility['show-km-trab-terc'].placement === 'summary' || columnVisibility['show-km-trab-terc'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                                ${columnVisibility['show-acrescimos-terc'].show && (columnVisibility['show-acrescimos-terc'].placement === 'summary' || columnVisibility['show-acrescimos-terc'].placement === 'both') ? `<td data-label="Acrescimos (R$)" style="${group.isAddition ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${group.isAddition ? formatCurrency(totalGroupValue) : formatCurrency(0)}</td>` : ''}
                                ${columnVisibility['show-descontos-terc'].show && (columnVisibility['show-descontos-terc'].placement === 'summary' || columnVisibility['show-descontos-terc'].placement === 'both') ? `<td data-label="Descontos (R$)" style="${!group.isAddition ? 'background-color: #ffebee; font-weight: bold;' : ''}">${!group.isAddition ? formatCurrency(totalGroupValue) : formatCurrency(0)}</td>` : ''}
                                ${columnVisibility['show-mobilizacao-terc'].show && (columnVisibility['show-mobilizacao-terc'].placement === 'summary' || columnVisibility['show-mobilizacao-terc'].placement === 'both') ? '<td data-label="Mobilizacao (R$)">---</td>' : ''}
                                ${columnVisibility['show-desmobilizacao-terc'].show && (columnVisibility['show-desmobilizacao-terc'].placement === 'summary' || columnVisibility['show-desmobilizacao-terc'].placement === 'both') ? '<td data-label="Desmobilizacao (R$)">---</td>' : ''}
                                <td data-label="Total Equip. (R$)"><strong>${formatCurrency(group.isAddition ? totalGroupValue : -totalGroupValue)}</strong></td>
                            </tr>
                        `;
                
                        // CORREÇÃO 5: Detalhes corretos com formatação de valor
                        const detailRows = group.details.map(detail => {
                            const formatDateBR = (dateString) => {
                                if (!dateString) return startDate;
                                try {
                                    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
                                } catch {
                                    return startDate;
                                }
                            };
                            
                            const valueToDisplay = group.isAddition ? Math.abs(detail.value) : -Math.abs(detail.value);
                            return `<tr><td style="border: 1px solid #ddd;">${typeLabel}</td><td style="border: 1px solid #ddd;">${formatDateBR(detail.date)}</td><td style="border: 1px solid #ddd;">${detail.description}</td><td style="border: 1px solid #ddd; ${valueToDisplay > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : valueToDisplay < 0 ? 'background-color: #ffebee; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(valueToDisplay)}</td></tr>`;
                        }).join('');
                        
                        const totalRow = `<tr><td style="border: 1px solid #ddd;"><strong>Total ${typeLabel}</strong></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"><strong>${preciseRounding.formatCurrencyPrecise(group.isAddition ? totalGroupValue : -totalGroupValue)}</strong></td></tr>`;
                
                        allDetailSections += `
                            <div class="report-detail" data-equip-id="expenses-${group.thirdPartyId}-${group.isAddition ? 'add' : 'disc'}">
                                <h3>Detalhamento: ${equipmentLabel}</h3>
                                <div class="table-wrapper">
                                    <table class="detail-summary-table" style="border-collapse: collapse;">
                                     <thead><tr><th style="border: 1px solid #ddd;">Tipo</th><th style="border: 1px solid #ddd;">Data</th><th style="border: 1px solid #ddd;">Descricao</th><th style="border: 1px solid #ddd;">Valor</th></tr></thead>
                                     <tbody>${detailRows}${totalRow}</tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    });
                
                    if (newTableRows) {
                        reportHTML = reportHTML.replace('</tbody>', newTableRows + '</tbody>');
                        reportHTML += allDetailSections;
                        
                        reportHTML = reportHTML.replace(
                            /Total Geral \(Terceirizados\): [^<]+/,
                            `Total Geral (Terceirizados): ${formatCurrency(grandTotal)}`
                        );
                    }
                }
        
        reportHTML += `</div>`;
        
        if (reportOutput) reportOutput.innerHTML = reportHTML;
        if (exportPdfBtn) exportPdfBtn.style.display = 'inline-block';
        if (exportPdfDriveBtn) exportPdfDriveBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatorio de medicao de terceirizados:", e);
        if (reportOutput) reportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatorio. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

/**
 * Formata o tipo de medicao para exibicao em portugues.
 */
const formatMeasurementType = (type, guaranteedHours = null) => {
    switch (type) {
        case 'monthly': return 'MENSAL';
        case 'daily': return 'DIARIO';
        case 'hourly': return 'HORA';
        case 'guaranteed_hours': return guaranteedHours ? `${guaranteedHours}H MÍNIMAS` : 'GAR';
        default: return type.toUpperCase();
    }
};


// NOVA FUNÇÃO: Handler para mudança de obra (ADICIONE ESTA FUNÇÃO)
const handleWorkSelectChange = () => {
    const workId = reportWorkSelect.value;
    
    if (!workId) {
        if (reportBmSelect) reportBmSelect.innerHTML = '<option value="">Selecione o Período</option>';
        if (filterSelect) filterSelect.innerHTML = '';
        return;
    }

    const work = appState.works.find(w => w.id == workId);
    
    // NOVO: Filtrar apenas terceirizados que têm equipamentos nesta obra
    const terceirizadosNaObra = new Set();
    
    if (work?.config?.equipment) {
        work.config.equipment.forEach(equipConfig => {
            const equipment = appState.equipment.find(e => e.id == equipConfig.equipment_id);
            if (equipment?.is_terceirizado && equipment.terceirizado_id) {
                terceirizadosNaObra.add(equipment.terceirizado_id);
            }
        });
    }
    
    // Atualizar o select de filtro com apenas os terceirizados desta obra
    if (filterSelect) {
        filterSelect.innerHTML = Array.from(terceirizadosNaObra)
            .map(tercId => {
                const terc = appState.terceirizados.find(t => t.id == tercId);
                return terc ? `<option value="${terc.id}">${terc.name}</option>` : '';
            })
            .filter(Boolean)
            .join('');
        
        // Selecionar todos por padrão
        Array.from(filterSelect.options).forEach(option => option.selected = true);
    }
    
    // Auto-selecionar BM
    if (reportBmSelect) {
        const bmPeriods = work?.config?.measurement_periods || [];
        let bmOptions = '<option value="">Selecione o Período</option>' + bmPeriods.map((bm, index) => {
            const startFormatted = new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR');
            const endFormatted = new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR');
            return `<option value="${index}">BM ${index + 1} - ${startFormatted} a ${endFormatted}</option>`;
        }).join('');
        reportBmSelect.innerHTML = bmOptions;
        if (bmPeriods.length > 0) {
            const lastBmIndex = bmPeriods.length - 1;
            reportBmSelect.value = lastBmIndex;
            const lastBmPeriod = bmPeriods[lastBmIndex];
            if (lastBmPeriod) {
                if (reportStartDateEl) reportStartDateEl.value = lastBmPeriod.start;
                if (reportEndDateEl) reportEndDateEl.value = lastBmPeriod.end;
            }
            
            // 🔥 AUTO-BUSCAR após selecionar obra
            setTimeout(() => {
                if (reportWorkSelect.value && reportBmSelect.value !== '' && filterSelect && filterSelect.selectedOptions.length > 0) {
                    document.getElementById('generate-measurement-terceirizados-report-btn')?.click();
                }
            }, 100);
        }
    }
    
    if (reportBmSelect) {
        const bmPeriods = work?.config?.measurement_periods || [];
        let bmOptions = '<option value="">Selecione o Período</option>' + bmPeriods.map((bm, index) => {
            const startFormatted = new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR');
            const endFormatted = new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR');
            return `<option value="${index}">BM ${index + 1} - ${startFormatted} a ${endFormatted}</option>`;
        }).join('');
        
        reportBmSelect.innerHTML = bmOptions;
        
        if (bmPeriods.length > 0) {
            const lastBmIndex = bmPeriods.length - 1;
            reportBmSelect.value = lastBmIndex;
            
            const lastBmPeriod = bmPeriods[lastBmIndex];
            if (lastBmPeriod) {
                if (reportStartDate) reportStartDate.value = lastBmPeriod.start;
                if (reportEndDate) reportEndDate.value = lastBmPeriod.end;
            }
        }
    }
    
    // Aplicar configurações padrão das checkboxes
    applyWorkDefaultColumnsTerceirizados(workId);
};


// NOVA FUNÇÃO: Handler para mudança de BM (ADICIONE ESTA FUNÇÃO)
const handleBmSelectChange = () => {
    const workId = reportWorkSelect.value;
    const bmIndex = reportBmSelect.value;
    
    if (workId && bmIndex !== '') {
        const work = appState.works.find(w => w.id == workId);
        const bmPeriod = work?.config?.measurement_periods[parseInt(bmIndex)];
        
        if (bmPeriod) {
            if (reportStartDate) reportStartDate.value = bmPeriod.start;
            if (reportEndDate) reportEndDate.value = bmPeriod.end;
        }
        
        // 🔥 AUTO-BUSCAR após mudar BM
        setTimeout(() => {
            if (reportWorkSelect.value && reportBmSelect.value !== '' && filterSelect && filterSelect.selectedOptions.length > 0) {
                document.getElementById('generate-measurement-terceirizados-report-btn')?.click();
            }
        }, 100);
    }
};




// =======================================================================
// SEÇÃO DE CÁLCULO CORRIGIDA
// As funções abaixo foram reescritas para corrigir o bug reportado.
// A lógica agora é mais simples e depende das funções de cálculo
// centralizadas em `calculos_valores.js`, que já lidam corretamente
// com a priorização dos campos `_terceirizado`.
// =======================================================================

/**
 * FUNÇÃO CORRIGIDA: Calcula o valor total do rodapé do detalhamento.
 * A versão anterior tinha uma lógica complexa e com bugs para medições mensais.
 * Esta versão simplificada soma os valores diários (já corrigidos) e adiciona os custos de mobilização.
 */
const calculateDetailFooterTotalTerceirizado = (equipmentEntries, equipConfig, work, mobilizationCost = 0, demobilizationCost = 0) => {
    console.log('[FOOTER TERCEIRIZADO CORRIGIDO] === CALCULANDO TOTAL DO RODAPÉ ===');
    
    // Para equipamentos mensais terceirizados, usar cálculo especial para evitar acúmulo de erros
    const measurementTypeTerc = equipConfig?.measurement_type_terceirizado || equipConfig?.measurement_type;
    
    if (measurementTypeTerc === 'monthly') {
        const monthlyValueTerc = parseFloat(equipConfig?.measurement_value_terceirizado || equipConfig?.measurement_value || 0);
        const workedEntries = equipmentEntries.filter(entry => entry.is_worked);
        
        if (workedEntries.length > 0 && monthlyValueTerc > 0) {
            // Usar o tipo de cálculo da primeira entrada trabalhada
            const firstWorkedEntry = workedEntries[0];
            let calculationType = equipConfig?.monthly_calculation_terceirizado || 
                                equipConfig?.monthly_calculation || 'proportional';
            
            if (firstWorkedEntry.monthly_calculation_manual_terceirizado) {
                calculationType = firstWorkedEntry.monthly_calculation_manual_terceirizado;
            } else if (firstWorkedEntry.monthly_calculation_override_terceirizado) {
                calculationType = firstWorkedEntry.monthly_calculation_override_terceirizado;
            }
            
            let daysInMonth = 30;
            if (calculationType === 'proportional') {
                const entryDate = new Date(firstWorkedEntry.date + 'T00:00:00');
                daysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
            }
            
            // CORREÇÃO PRINCIPAL: Cálculo mais preciso para evitar os 11 centavos extras
            // Se todos os dias do mês foram trabalhados e não há ajustes, o total deve ser exato
            const totalWorkedDays = workedEntries.length;
            
            // Verificar se não há ajustes significativos
            let totalAdjustments = 0;
            equipmentEntries.forEach(entry => {
                // Notas
                const notesAdd = calculateNotesAdditions(entry, 'terceirizado');
                const notesDisc = calculateNotesDiscounts(entry, 'terceirizado');
                totalAdjustments += notesAdd - notesDisc;
                
                // Paradas
                const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
                if (stoppageHours > 0) {
                    const totalShiftHours = calculateTotalShiftHours(work);
                    if (totalShiftHours > 0) {
                        const dailyValue = monthlyValueTerc / daysInMonth;
                        const hourlyRate = dailyValue / totalShiftHours;
                        totalAdjustments -= stoppageHours * hourlyRate;
                    }
                }
            });
            
            // Se trabalhou todos os dias do mês e não há ajustes, retornar valor mensal exato
            if (totalWorkedDays === daysInMonth && Math.abs(totalAdjustments) < 0.01) {
                console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Mês completo sem ajustes: R$ ${monthlyValueTerc}`);
                const finalTotal = preciseRounding.sumPrecise(monthlyValueTerc, mobilizationCost, demobilizationCost);
                return finalTotal;
            }
            
            // Caso contrário, calcular proporcionalmente
            const baseTotal = preciseRounding.round2((monthlyValueTerc / daysInMonth) * totalWorkedDays);
            const totalWithAdjustments = preciseRounding.sumPrecise(baseTotal, totalAdjustments);
            const finalTotal = preciseRounding.sumPrecise(totalWithAdjustments, mobilizationCost, demobilizationCost);
            
            console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Base proporcional: R$ ${baseTotal}`);
            console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Com ajustes: R$ ${totalWithAdjustments}`);
            console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Total final: R$ ${finalTotal}`);
            
            return finalTotal;
        }
    }
    
    // Para outros tipos, somar valores diários normalmente
    let totalDailyValues = 0;
    equipmentEntries.forEach(entry => {
        const dailyValue = calculateCompleteDailyValueForReportTerceirizado(entry, equipConfig, work);
        totalDailyValues += dailyValue;
    });
    
    const finalTotal = preciseRounding.sumPrecise(totalDailyValues, mobilizationCost, demobilizationCost);
    
    console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Total diário: R$ ${totalDailyValues.toFixed(2)}`);
    console.log(`[FOOTER TERCEIRIZADO CORRIGIDO] Total final: R$ ${finalTotal}`);
    
    return finalTotal;
};


/**
 * FUNÇÃO CORRIGIDA: Calcula o valor completo diário para o relatório do terceirizado.
 * A versão anterior tinha uma condição `if` que misturava a lógica do cliente com a do terceirizado,
 * causando o bug. Esta versão usa as funções centralizadas para garantir o cálculo correto.
 */
const calculateCompleteDailyValueForReportTerceirizado = (entry, equipConfig, work) => {
    console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] === CALCULANDO VALOR DIÁRIO ===`);
    console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Data: ${entry.date}`);

    // Se houver valor manual, ele tem prioridade máxima
    if (entry.daily_manual_value_terceirizado !== null && 
        entry.daily_manual_value_terceirizado !== undefined && 
        entry.daily_manual_value_terceirizado !== '') {
        const manualValue = parseFloat(entry.daily_manual_value_terceirizado);
        console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Usando valor manual: R$ ${manualValue}`);
        return manualValue;
    }

    // Se não trabalhou, valor é zero (mais ajustes de notas)
    if (!entry.is_worked) {
        const notesAdditions = calculateNotesAdditions(entry, 'terceirizado');
        const notesDiscounts = calculateNotesDiscounts(entry, 'terceirizado');
        const totalAdjustments = notesAdditions - notesDiscounts;
        console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Dia não trabalhado, apenas ajustes: R$ ${totalAdjustments}`);
        return preciseRounding.round2(totalAdjustments);
    }

    // CORREÇÃO PRINCIPAL: Para equipamentos mensais terceirizados, usar cálculo preciso
    const measurementTypeTerc = equipConfig?.measurement_type_terceirizado || equipConfig?.measurement_type;
    
    if (measurementTypeTerc === 'monthly') {
        const monthlyValueTerc = parseFloat(equipConfig?.measurement_value_terceirizado || equipConfig?.measurement_value || 0);
        
        if (monthlyValueTerc > 0) {
            // Determinar tipo de cálculo
            let calculationType = equipConfig?.monthly_calculation_terceirizado || 
                                equipConfig?.monthly_calculation || 'proportional';
            
            // Verificar override da entrada
            if (entry.monthly_calculation_manual_terceirizado) {
                calculationType = entry.monthly_calculation_manual_terceirizado;
            } else if (entry.monthly_calculation_override_terceirizado) {
                calculationType = entry.monthly_calculation_override_terceirizado;
            }
            
            // Calcular dias no mês
            let daysInMonth = 30;
            if (calculationType === 'proportional') {
                const entryDate = new Date(entry.date + 'T00:00:00');
                daysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
            }
            
            // ARREDONDAMENTO PRECISO: Usar a mesma lógica do cliente
            // Para um mês de 31 dias com R$ 7.000,00:
            // Valor diário = 7000 / 31 = 225.806451612903...
            // Para evitar acúmulo de erros, usar arredondamento consistente
            
            const exactDailyValue = monthlyValueTerc / daysInMonth;
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Valor mensal: R$ ${monthlyValueTerc}`);
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Dias no mês: ${daysInMonth}`);
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Valor diário exato: R$ ${exactDailyValue.toFixed(10)}`);
            
            // CORREÇÃO ESPECÍFICA: Aplicar arredondamento preciso no valor base
            let baseValue = preciseRounding.round2(exactDailyValue);
            
            // Aplicar ajustes (notas, paradas) sobre o valor arredondado
            const notesAdditions = calculateNotesAdditions(entry, 'terceirizado');
            const notesDiscounts = calculateNotesDiscounts(entry, 'terceirizado');
            
            // Desconto por paradas (calculado sobre o valor base arredondado)
            let stoppageDiscount = 0;
            if (entry.stoppages && Array.isArray(entry.stoppages)) {
                const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
                if (stoppageHours > 0) {
                    const totalShiftHours = calculateTotalShiftHours(work);
                    if (totalShiftHours > 0) {
                        const hourlyRate = baseValue / totalShiftHours;
                        stoppageDiscount = preciseRounding.round2(stoppageHours * hourlyRate);
                    }
                }
            }
            
            const finalValue = baseValue + notesAdditions - notesDiscounts - stoppageDiscount;
            const roundedFinal = preciseRounding.round2(Math.max(0, finalValue));
            
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Valor base arredondado: R$ ${baseValue}`);
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Ajustes: +${notesAdditions} -${notesDiscounts} -${stoppageDiscount}`);
            console.log(`[DEBUG TERCEIRIZADO CORRIGIDO] Valor final: R$ ${roundedFinal}`);
            
            return roundedFinal;
        }
    }
    
    // Para outros tipos de medição, usar cálculo original
    const baseValue = calculateDailyBaseValueTerceirizado(entry, equipConfig, work);
    const notesAdditions = calculateNotesAdditions(entry, 'terceirizado');
    const notesDiscounts = calculateNotesDiscounts(entry, 'terceirizado');
    const stoppageDiscount = calculateStoppageDiscountValue(entry, equipConfig, work, true);
    
    const finalValue = baseValue + notesAdditions - notesDiscounts - stoppageDiscount;
    
    return preciseRounding.round2(Math.max(0, finalValue));
};



// Função auxiliar para formatar data
const formatDateBR = (dateString) => {
    if (!dateString) return '---';
    try {
        return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch {
        return '---';
    }
};


const generateDetailedTercAdditionsRows = (equipmentEntries, equipmentExpenses, equipmentDamages, equipConfig, work) => {
    let rows = '';

    // Acréscimos de Notas das Entradas Diárias
    equipmentEntries.forEach(entry => {
        (entry.notes || []).forEach(note => {
            // ---> INÍCIO DA ALTERAÇÃO <---
            // Respeitar a flag para não exibir a nota no relatório OU NO PDF
            if (note.hide_in_report || note.hide_in_pdf) {
                console.log(`🔒 Nota oculta no relatório (terc): ${note.description}`);
                return; // Pula para a próxima nota, mas o valor já foi contabilizado
            }
            // ---> FIM DA ALTERAÇÃO <---
            
            if (note.type === 'addition' && (note.target === 'terceirizado' || note.target === 'both')) {
                const value = preciseRounding.round2((note.quantity || 0) * (note.value || 0));
                if (value > 0) {
                    rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">${note.description}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(value)}</td></tr>`;
                }
            }
        });
    });

    // CORREÇÃO: Acréscimos de Mobilização - APENAS se há valor específico para terceirizado
    equipmentEntries.forEach(entry => {
        if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
            let mobCostTerc = 0;
            
            if (entry.mobilization_manual_value) {
                mobCostTerc = parseFloat(entry.mobilization_manual_value);
            } else if (equipConfig.mobilization_cost_terceirizado) {
                mobCostTerc = parseFloat(equipConfig.mobilization_cost_terceirizado);
            }
            
            mobCostTerc = preciseRounding.round2(mobCostTerc);
            
            if (mobCostTerc > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">MOBILIZAÇÃO</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(mobCostTerc)}</td></tr>`;
            }
        }
    });

    // CORREÇÃO: Acréscimos de Desmobilização - APENAS se há valor específico para terceirizado
    equipmentEntries.forEach(entry => {
        if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
            let demobCostTerc = 0;
            
            if (entry.demobilization_manual_value) {
                demobCostTerc = parseFloat(entry.demobilization_manual_value);
            } else if (equipConfig.demobilization_cost_terceirizado) {
                demobCostTerc = parseFloat(equipConfig.demobilization_cost_terceirizado);
            }
            
            demobCostTerc = preciseRounding.round2(demobCostTerc);
            
            if (demobCostTerc > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">DESMOBILIZAÇÃO</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(demobCostTerc)}</td></tr>`;
            }
        }
    });

    // Acréscimos de Despesas Gerais (mantém igual)
    equipmentExpenses.forEach(expense => {
        if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO) {
            const expenseTotal = preciseRounding.round2(calculateExpenseTotal(expense.unit_value, expense.quantity, expense.additions, expense.discounts));
            if (expenseTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
            }
        }
    });

    // Acréscimos de Avarias (mantém igual)
    equipmentDamages.forEach(damage => {
        if (damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.ADD_DAMAGE_TERCEIRIZADO) {
            const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
            if (damageTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
            }
        }
    });

    return rows;
};


/**
 * Gera linhas de descontos detalhadas para terceirizados (igual ao cliente)
 */
const generateDetailedTercDiscountsRows = (equipmentEntries, equipmentExpenses, equipmentDamages, equipConfig, work) => {
    let rows = '';

    // Descontos de Paradas
    equipmentEntries.forEach(entry => {
        if (entry.stoppages && Array.isArray(entry.stoppages)) {
            entry.stoppages.forEach(stoppage => {
                if ((equipConfig?.deductible_stoppages || []).includes(stoppage.type_id)) {
                    const currentStoppageHours = calculateIndividualStoppageHours(stoppage, entry, equipConfig, work);
                    
                    if (currentStoppageHours > 0) {
                        const stopType = appState.stoppage_types.find(st => st.id == stoppage.type_id);
                        const entryDailyValue = calculateDailyBaseValueTerceirizado(entry, equipConfig, work);
                        const totalShiftHours = calculateTotalShiftHours(work);
                        const hourlyRateForEntry = totalShiftHours > 0 ? entryDailyValue / totalShiftHours : 0;
                        
                        const discountValue = preciseRounding.round2(currentStoppageHours * hourlyRateForEntry);
                        
                        if (stopType && discountValue > 0) {
                            rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">Parada - ${stopType.name} (${currentStoppageHours.toFixed(2)}h)</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(discountValue)}</td></tr>`;
                        }
                    }
                }
            });
        }
    });

    // Descontos de Notas
    equipmentEntries.forEach(entry => {
        (entry.notes || []).forEach(note => {
            // ---> INÍCIO DA ALTERAÇÃO <---
            // Respeitar a flag para não exibir a nota no relatório OU NO PDF
            if (note.hide_in_report || note.hide_in_pdf) {
                return; // Pula para a próxima nota, mas o valor já foi contabilizado
            }
            // ---> FIM DA ALTERAÇÃO <---

            if (note.type === 'discount' && (note.target === 'terceirizado' || note.target === 'both')) {
                const value = preciseRounding.round2((note.quantity || 0) * (note.value || 0));
                if (value > 0) {
                    rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">${note.description}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(value)}</td></tr>`;
                }
            }
        });
    });

    // Descontos de Despesas Gerais
    equipmentExpenses.forEach(expense => {
        if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO) {
            const expenseTotal = preciseRounding.round2(calculateExpenseTotal(expense.unit_value, expense.quantity, expense.additions, expense.discounts));
            if (expenseTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
            }
        }
    });

    // Descontos de Avarias
    equipmentDamages.forEach(damage => {
        if (damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.DISC_DAMAGE_TERCEIRIZADO) {
            const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
            if (damageTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
            }
        }
    });

    return rows;
};


const debugEquipmentAppearance = async (workId, equipmentId, startDate, endDate) => {
    console.log(`🔍 DEBUG EQUIPAMENTO ${equipmentId} NO PERÍODO ${startDate} a ${endDate}`);
    
    // Busca direta no banco
    const entries = await apiClient.fetchDailyEntries(workId, equipmentId, startDate, endDate);
    console.log(`📊 ENTRADAS ENCONTRADAS:`, entries);
    
    // Verifica se há dias trabalhados
    const workedDays = entries.filter(e => e.is_worked);
    console.log(`🔨 DIAS TRABALHADOS:`, workedDays);
    
    // Verifica o resultado da função
    const shouldAppear = await shouldEquipmentAppearInReport(workId, equipmentId, startDate, endDate);
    console.log(`✅ RESULTADO shouldEquipmentAppearInReport:`, shouldAppear);
    
    return { entries, workedDays, shouldAppear };
};