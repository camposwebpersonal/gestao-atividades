// relatorios_medicao.js - VERSÃO CORRIGIDA COM ARREDONDAMENTO PRECISO E LÓGICA DE SOMA APRIMORADA
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, calculateDeductibleHours, sendPDFViaWhatsApp, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { exportReportToPDF, renewGoogleDriveAuth } from './relatorios_medicao_pdf.js?v=20260302060000';
// NOVA IMPORTAÇÃO: Módulo centralizado de cálculos
import {
    calculateEquipmentTotalValue,
    calculateGeneralExpensesImpact,
    calculateDailyBaseValue,
    calculateStoppageDiscountValue,
    calculateDeductibleStoppageHours,
    calculateTotalShiftHours,
    calculateNotesAdditions,
    calculateNotesDiscounts,
    calculateMobilizationCost,
    calculateDemobilizationCost,
    getEffectiveMonthlyCalculationType,
    getEffectiveMonthlyCalculationTypeTerceirizado,
    MEASUREMENT_TYPES,
    EXPENSE_IMPACT_TYPES,
    calculateExpenseTotal
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

// NOVA FUNÇÃO: Utilitários para arredondamento preciso
const preciseRounding = {
    // Usar uma abordagem mais precisa para evitar erros de ponto flutuante
    round2(value) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        // Adiciona um epsilon muito pequeno antes de arredondar para evitar problemas de precisão
        return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    
    // Formatar com maior precisão
    formatCurrencyPrecise(value) {
        const rounded = this.round2(value);
        return formatCurrency(rounded);
    },
    
    // Soma mais precisa
    sumPrecise(...values) {
        const numbers = values.map(val => {
            if (typeof val === 'number' && !isNaN(val)) return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        });
        
        const sum = numbers.reduce((acc, val) => acc + val, 0);
        
        return this.round2(sum);
    },

    // Multiplicação precisa
    multiplyPrecise(value1, value2) {
        const num1 = typeof value1 === 'number' ? value1 : parseFloat(value1) || 0;
        const num2 = typeof value2 === 'number' ? value2 : parseFloat(value2) || 0;
        
        const result = num1 * num2;
        return this.round2(result);
    }
};


const reportWorkSelect = document.getElementById('report-work-select');
const reportStartDateEl = document.getElementById('report-start-date');
const reportEndDateEl = document.getElementById('report-end-date');
const generateMeasurementReportBtn = document.getElementById('generate-measurement-report-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportPdfDriveBtn = document.getElementById('export-pdf-drive-btn');
const renewDriveAuthBtn = document.getElementById('renew-drive-auth-btn');
const whatsappMeasurementBtn = document.getElementById('whatsapp-measurement-btn');
const measurementReportOutput = document.getElementById('measurement-report-output');
const measurementReportOptions = document.getElementById('measurement-report-options');
const reportBmSelect = document.getElementById('report-bm-select');

// Função para formatar data no formato brasileiro
const formatDateBR = (dateString) => {
    if (!dateString) return '---';
    const cleanDate = String(dateString).trim();
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        date = new Date(cleanDate + 'T00:00:00');
    }
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
        const [day, month, year] = cleanDate.split('/');
        date = new Date(`${year}-${month}-${day}T00:00:00`);
    }
    else {
        date = new Date(cleanDate);
    }

    if (isNaN(date.getTime())) {
        console.warn('Data inválida encontrada:', dateString);
        return '---';
    }

    return date.toLocaleDateString('pt-BR');
};

const columnConfigs = [
    { id: 'show-dias-trab', label: 'Dias Trab.', summary: true, detail: false, default: true, combo: true },
    { id: 'show-horas-trab', label: 'Horas Trab.', summary: true, detail: true, default: false, combo: true },
    { id: 'show-horas-garantia-receber', label: 'Horas Garantia a Receber', summary: true, detail: false, default: false, combo: true },
    { id: 'show-horimetro-inicial', label: 'Horímetro Inicial', summary: true, detail: true, default: false, combo: true },
    { id: 'show-horimetro-final', label: 'Horímetro Final', summary: true, detail: true, default: false, combo: true },
    { id: 'show-km-inicial', label: 'KM Inicial', summary: true, detail: true, default: false, combo: true },
    { id: 'show-km-final', label: 'KM Final', summary: true, detail: true, default: false, combo: true },
    { id: 'show-km-trab', label: 'KM Trab.', summary: true, detail: true, default: false, combo: true },
    { id: 'show-acrescimos', label: 'Acréscimos (R$)', summary: true, detail: true, default: true, combo: true },
    { id: 'show-descontos', label: 'Descontos (R$)', summary: true, detail: true, default: true, combo: true },
    { id: 'show-mobilizacao', label: 'Mobilização (R$)', summary: true, detail: false, default: true, combo: true },
    { id: 'show-desmobilizacao', label: 'Desmobilização (R$)', summary: true, detail: false, default: true, combo: true },
    { id: 'show-paradas-desc', label: 'HORAS PARADAS', summary: true, detail: true, default: false, combo: true },
    { id: 'show-observacoes', label: 'Observações', summary: false, detail: true, default: true, combo: false },
    { id: 'show-dias-parados', label: 'Dias Parados', summary: true, detail: true, default: false, combo: true },
    { id: 'show-valor-mensal', label: 'Valor Mensal', summary: true, detail: true, default: false, combo: true },
    { id: 'show-valor-diario', label: 'Valor Diário', summary: true, detail: true, default: false, combo: true },
    { id: 'show-valor-horas', label: 'Valor das Horas', summary: true, detail: true, default: false, combo: true },
];

/**
 * Renderiza opções de colunas personalizadas
 */
const renderColumnOptionsInlineMini = () => {
    if (!measurementReportOptions) return;

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
                       id="show-zero-values" 
                       checked>
                <label for="show-zero-values">💰 Mostrar Zeros</label>
            </div>
            </div>
        </div>
    `;

    measurementReportOptions.innerHTML = html;

    // Event listeners
    measurementReportOptions.querySelectorAll('.column-toggle-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const select = document.getElementById(`${e.target.dataset.columnId}-placement`);
            if (select && e.target.checked) {
                select.value = 'both';
            }
        });
    });
};

export const initMeasurementReport = () => {
    renderColumnOptionsInlineMini();
    
    if (generateMeasurementReportBtn) {
        generateMeasurementReportBtn.addEventListener('click', generateMeasurementReport);
    }
    
    // Botão de download local (SEM upload)
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            const withCoverCheckbox = document.getElementById('measurement-report-cover-checkbox');
            const withCover = withCoverCheckbox ? withCoverCheckbox.checked : false;
            
            const includeBMPeriodCheckbox = document.getElementById('measurement-report-cover-include-bm-period-checkbox');
            const includeBMPeriod = includeBMPeriodCheckbox ? includeBMPeriodCheckbox.checked : true;
            
            // 📄 Download local apenas (uploadToDrive = false)
            exportReportToPDF('measurement-report-output', 'Relatório de Medição', withCover, includeBMPeriod, false);
        });
    }
    
    // ☁️ Botão de upload para Google Drive
    if (exportPdfDriveBtn) {
        exportPdfDriveBtn.addEventListener('click', () => {
            const withCoverCheckbox = document.getElementById('measurement-report-cover-checkbox');
            const withCover = withCoverCheckbox ? withCoverCheckbox.checked : false;
            
            const includeBMPeriodCheckbox = document.getElementById('measurement-report-cover-include-bm-period-checkbox');
            const includeBMPeriod = includeBMPeriodCheckbox ? includeBMPeriodCheckbox.checked : true;
            
            // 🚀 Upload para Google Drive (uploadToDrive = true)
            exportReportToPDF('measurement-report-output', 'Relatório de Medição', withCover, includeBMPeriod, true);
        });
    }
    
    // 🔄 Botão manual de renovação de autenticação do Google Drive
    if (renewDriveAuthBtn) {
        renewDriveAuthBtn.addEventListener('click', async () => {
            try {
                await renewGoogleDriveAuth();
                alert('✅ Autenticação renovada com sucesso!');
            } catch (error) {
                alert('❌ Erro ao renovar autenticação: ' + error.message);
            }
        });
    }
    
    // 📱 Botão de envio via WhatsApp (gera PDF + upload Drive + envia link)
    if (whatsappMeasurementBtn) {
        whatsappMeasurementBtn.addEventListener('click', async () => {
            try {
                showSpinner();
                
                // 1. Importar jsPDF
                const { jsPDF } = window.jspdf;
                if (!jsPDF) {
                    alert('❌ Biblioteca jsPDF não carregada!');
                    return;
                }
                
                // 2. Gerar PDF (mesmo código do botão "Gerar PDF no Google Drive")
                const withCoverCheckbox = document.getElementById('measurement-report-cover-checkbox');
                const withCover = withCoverCheckbox ? withCoverCheckbox.checked : false;
                
                const includeBMPeriodCheckbox = document.getElementById('measurement-report-cover-include-bm-period-checkbox');
                const includeBMPeriod = includeBMPeriodCheckbox ? includeBMPeriodCheckbox.checked : true;
                
                // 3. Chamar função de export que retorna blob E faz upload
                const { exportReportToPDF } = await import('./relatorios_medicao_pdf.js?v=20260302060000');
                const result = await exportReportToPDF('measurement-report-output', 'Relatório de Medição', withCover, includeBMPeriod, true, true); // último parâmetro = retornar link
                
                if (result && result.driveLink) {
                    // 4. Enviar para WhatsApp com link do Drive
                    const message = `📊 Olá! Segue o relatório de medição da obra.\n\n📎 Link do PDF:\n${result.driveLink}\n\nQualquer dúvida, estamos à disposição!`;
                    const whatsappLink = `https://api.whatsapp.com/send?phone=5587991034022&text=${encodeURIComponent(message)}`;
                    window.open(whatsappLink, '_blank');
                } else {
                    alert('❌ Erro ao gerar PDF ou fazer upload para o Drive.');
                }
            } catch (error) {
                console.error('❌ Erro ao enviar via WhatsApp:', error);
                alert('❌ Erro ao processar: ' + error.message);
            } finally {
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
        
        // ✅ NOVO: Restaurar a obra selecionada anteriormente (se existir)
        const savedWorkId = sessionStorage.getItem('selectedWorkId');
        if (savedWorkId && sortedWorks.find(w => w.id == savedWorkId)) {
            reportWorkSelect.value = savedWorkId;
            // Acionar a função para preencher os campos relacionados
            handleWorkSelectChange();
        }
        
        reportWorkSelect.addEventListener('change', handleWorkSelectChange);
    }
    
    if (reportBmSelect) {
        reportBmSelect.addEventListener('change', handleBmSelectChange);
    }
};

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





const generateDetailedAdditionsRows = (equipmentEntries, equipmentExpenses, equipmentDamages, equipConfig, work) => {
    let rows = '';

    // Acréscimos de Notas
    equipmentEntries.forEach(entry => {
        (entry.notes || []).forEach(note => {
            // 🔒 RESPEITAR FLAG DE OCULTAR NO RELATÓRIO
            if (note.hide_in_report) {
                console.log(`🔒 Nota oculta no relatório: ${note.description}`);
                return; // Pula esta nota, mas ela JÁ FOI contabilizada no valor total
            }
            
            if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                const value = preciseRounding.round2((note.quantity || 0) * (note.value || 0));
                if (value > 0) {
                    rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">${note.description}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(value)}</td></tr>`;
                }
            }
        });
    });

    // Acréscimos de Mobilização
    equipmentEntries.forEach(entry => {
        if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
            const mobCost = preciseRounding.round2(parseFloat(entry.mobilization_manual_value || equipConfig.mobilization_cost || 0));
            if (mobCost > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">MOBILIZAÇÃO</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(mobCost)}</td></tr>`;
            }
        }
    });

    // Acréscimos de Desmobilização
    equipmentEntries.forEach(entry => {
        if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
            const demobCost = preciseRounding.round2(parseFloat(entry.demobilization_manual_value || equipConfig.demobilization_cost || 0));
            if (demobCost > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Desmobilização</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">DESMOBILIZAÇÃO</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(demobCost)}</td></tr>`;
            }
        }
    });

    // Acréscimos de Despesas Gerais
    equipmentExpenses.forEach(expense => {
        if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT) {
            const expenseTotal = preciseRounding.round2(parseFloat(expense.impacto_cliente_total) || 0);
            if (expenseTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
            }
        }
    });

    // Acréscimos de Avarias
    equipmentDamages.forEach(damage => {
        if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT) {
            const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
            if (damageTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
            }
        }
    });

    return rows;
};

const generateDetailedDiscountsRows = (equipmentEntries, equipmentExpenses, equipmentDamages, equipConfig, work) => {
    let rows = '';

    // CORREÇÃO PRINCIPAL: Calcular cada parada individualmente
    equipmentEntries.forEach(entry => {
        if (entry.stoppages && Array.isArray(entry.stoppages)) {
            entry.stoppages.forEach(stoppage => {
                if ((equipConfig?.deductible_stoppages || []).includes(stoppage.type_id)) {
                    // NOVO: Calcular horas específicas desta parada individual
                    const currentStoppageHours = calculateIndividualStoppageHours(stoppage, entry, equipConfig, work);
                    
                    if (currentStoppageHours > 0) {
                        const stopType = appState.stoppage_types.find(st => st.id == stoppage.type_id);
                        const entryDailyValue = calculateDailyBaseValue(entry, equipConfig, work);
                        const totalShiftHours = calculateTotalShiftHours(work);
                        const hourlyRateForEntry = totalShiftHours > 0 ? entryDailyValue / totalShiftHours : 0;
                        
                        // CORREÇÃO: Valor do desconto baseado nas horas DESTA parada específica
                        const discountValue = preciseRounding.round2(currentStoppageHours * hourlyRateForEntry);
                        
                        if (stopType && discountValue > 0) {
                            rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">Parada - ${stopType.name} (${currentStoppageHours.toFixed(2)}h)</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(discountValue)}</td></tr>`;
                        }
                    }
                }
            });
        }
    });

    // Resto da função continua igual (notas, despesas, avarias)
    equipmentEntries.forEach(entry => {
        (entry.notes || []).forEach(note => {
            // 🔥 ADICIONAR VERIFICAÇÃO DE HIDE_IN_REPORT
            if (note.hide_in_report) {
                console.log(`🔒 Nota oculta no relatório: ${note.description}`);
                return; // Pula esta nota
            }
            
            if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                const value = preciseRounding.round2((note.quantity || 0) * (note.value || 0));
                if (value > 0) {
                    rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td><td style="border: 1px solid #ddd;">${note.description}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(value)}</td></tr>`;
                }
            }
        });
    });

    equipmentExpenses.forEach(expense => {
        if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT) {
            const expenseTotal = preciseRounding.round2(parseFloat(expense.impacto_cliente_total) || 0);
            if (expenseTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
            }
        }
    });

    equipmentDamages.forEach(damage => {
        if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT) {
            const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
            if (damageTotal > 0) {
                rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
            }
        }
    });

    return rows;
};


const fetchDamagesForReport = async (workId, startDate, endDate) => {
    try {
        let damages = [];
        if (typeof apiClient.fetchDamages === 'function') {
            damages = await apiClient.fetchDamages(workId, startDate, endDate);
        } else if (typeof apiClient.fetchData === 'function') {
            const allDamages = await apiClient.fetchData('damages');
            damages = allDamages.filter(damage => {
                const matchesWork = damage.work_id == workId;
                const matchesDate = damage.damage_date >= startDate && damage.damage_date <= endDate;
                return matchesWork && matchesDate;
            });
        } else {
            console.warn('⚠️ Nenhum método para buscar avarias encontrado');
            damages = [];
        }
        return damages;
    } catch (error) {
        console.error('❌ Erro ao buscar avarias:', error);
        return [];
    }
};

const processeDamageImpacts = (damages) => {
    const processedDamages = damages.map(damage => {
        const totalValue = preciseRounding.round2(parseFloat(damage.total_value) || 0);
        const validClientImpactTypes = [EXPENSE_IMPACT_TYPES.ADD_CLIENT, EXPENSE_IMPACT_TYPES.DISC_CLIENT];
        const clientImpactType = validClientImpactTypes.includes(damage.client_impact_type)
            ? damage.client_impact_type
            : null;
        return {
            ...damage,
            total_value: totalValue,
            client_impact_type: clientImpactType,
            has_client_impact: clientImpactType !== null && totalValue > 0
        };
    });
    return processedDamages;
};

const validateDamageForMeasurement = (damage) => {
    if (!damage || !damage.id) {
        console.warn('⚠️ Avaria inválida: sem ID');
        return false;
    }
    const validImpacts = [EXPENSE_IMPACT_TYPES.ADD_CLIENT, EXPENSE_IMPACT_TYPES.DISC_CLIENT];
    if (!validImpacts.includes(damage.client_impact_type)) {
        return false;
    }
    const totalValue = preciseRounding.round2(parseFloat(damage.total_value) || 0);
    if (totalValue <= 0) {
        return false;
    }
    if (!damage.damage_date) {
        return false;
    }
    return true;
};

const generateGeneralWorkExpensesAndDamagesDetailRows = (generalWorkExpenses, generalWorkDamages) => {
    let rows = '';

    generalWorkExpenses.forEach(expense => {
        // NOVA LÓGICA: Usa impacto_cliente_total diretamente
        const expenseTotal = preciseRounding.round2(parseFloat(expense.impacto_cliente_total) || 0);
        
        if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT && expenseTotal > 0) {
            rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
        } else if (expense.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT && expenseTotal > 0) {
            rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(expense.date)}</td><td style="border: 1px solid #ddd;">Despesa - ${expense.description}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(expenseTotal)}</td></tr>`;
        }
    });

    generalWorkDamages.forEach(damage => {
        const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
        if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT && damageTotal > 0) {
            rows += `<tr><td style="border: 1px solid #ddd;">Acréscimo</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #e8f5e9; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
        } else if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT && damageTotal > 0) {
            rows += `<tr><td style="border: 1px solid #ddd;">Desconto</td><td style="border: 1px solid #ddd;">${formatDateBR(damage.damage_date)}</td><td style="border: 1px solid #ddd;">Avaria - Cód: ${damage.id}${damage.observations ? ' - ' + damage.observations : ''}</td><td style="border: 1px solid #ddd; background-color: #ffebee; font-weight: bold;">-${preciseRounding.formatCurrencyPrecise(damageTotal)}</td></tr>`;
        }
    });

    return rows;
};

// Nova função para calcular o total de um equipamento mensal de forma precisa
const calculateMonthlyTotalForReport = (equipmentEntries, equipConfig, work) => {
    // --- INÍCIO DA CORREÇÃO ---
    // Verifica se há entradas no array antes de prosseguir
    if (!equipmentEntries || equipmentEntries.length === 0) {
        return 0;
    }
    // --- FIM DA CORREÇÃO ---

    const monthlyValue = parseFloat(equipConfig?.measurement_value || 0);
    if (monthlyValue === 0) return 0;

    let workedDays = 0;
    equipmentEntries.forEach(entry => {
        if (entry.is_worked) {
            workedDays++;
        }
    });

    const entryDate = new Date(equipmentEntries[0].date + 'T00:00:00');
    const daysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
    
    // Calcula o valor exato por dia e multiplica pelos dias trabalhados, depois arredonda
    const dailyValue = monthlyValue / daysInMonth;
    const total = dailyValue * workedDays;

    return preciseRounding.round2(total);
};


/**
 * Aplica as configurações padrão da obra aos checkboxes do relatório
 */
const applyWorkDefaultColumns = (workId) => {
    const work = appState.works.find(w => w.id == workId);
    const workDefaultColumns = work?.config?.default_report_columns || {};
    
    columnConfigs.forEach(col => {
        const configKey = col.id.replace('show-', '').replace(/-/g, '_');
        const workDefault = workDefaultColumns[configKey];
        
        const checkbox = document.getElementById(col.id);
        if (checkbox) {
            // SEMPRE aplicar a configuração da obra (ou padrão se não houver)
            if (workDefault !== undefined) {
                checkbox.checked = workDefault.enabled !== false;
            } else {
                // Se a obra não tem configuração para esta coluna, usar o padrão da coluna
                checkbox.checked = col.default || false;
            }
        }
        
        if (col.combo) {
            const placementSelect = document.getElementById(`${col.id}-placement`);
            if (placementSelect) {
                if (workDefault?.placement) {
                    placementSelect.value = workDefault.placement;
                } else {
                    // Resetar para o padrão
                    placementSelect.value = 'both';
                }
            }
        }
    });
    
    // Mostrar Zeros
    const showZerosCheckbox = document.getElementById('show-zero-values');
    if (showZerosCheckbox) {
        if (workDefaultColumns.mostrar_zeros !== undefined) {
            showZerosCheckbox.checked = workDefaultColumns.mostrar_zeros.enabled !== false;
        } else {
            showZerosCheckbox.checked = true; // Padrão
        }
    }
};




const generateMeasurementReport = async () => {
    const workId = reportWorkSelect?.value;
    const startDate = reportStartDateEl?.value;
    const endDate = reportEndDateEl?.value;

    if (!workId || !startDate || !endDate) {
        alert('Selecione a obra e o período para gerar o relatório.');
        return;
    }

    showSpinner();
    if (measurementReportOutput) measurementReportOutput.innerHTML = '';
    if (exportPdfBtn) exportPdfBtn.style.display = 'none';
    if (exportPdfDriveBtn) exportPdfDriveBtn.style.display = 'none';
    if (renewDriveAuthBtn) renewDriveAuthBtn.style.display = 'none';
    if (whatsappMeasurementBtn) whatsappMeasurementBtn.style.display = 'none';

    try {
        if (appState.equipment.length === 0) appState.equipment = await apiClient.fetchData('equipment');
        if (appState.stoppage_types.length === 0) appState.stoppage_types = await apiClient.fetchData('stoppage_types');
        if (appState.client_companies.length === 0) appState.client_companies = await apiClient.fetchData('client_companies');
        if (appState.my_companies.length === 0) appState.my_companies = await apiClient.fetchData('my_companies');
        if (!appState.equipment_types || appState.equipment_types.length === 0) appState.equipment_types = await apiClient.fetchData('equipment_types');

        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        const reportStartDateObj = new Date(startDate + 'T00:00:00');
        const reportEndDateObj = new Date(endDate + 'T00:00:00');

        const bmPeriods = work?.config?.measurement_periods || [];
        const bmsInPeriod = bmPeriods.map((bm, index) => ({ ...bm, name: `BM ${index + 1}`, index })).filter(bm => bm.start <= endDate && bm.end >= startDate);
        const bmString = bmsInPeriod.length > 0 ? bmsInPeriod.map(bm => bm.name).join(', ') : 'N/A';
        
        // 🎯 CRÍTICO: Buscar o período CORRETO baseado no que o usuário selecionou
        let periodConfig = null;
        const selectedBmIndex = parseInt(reportBmSelect?.value);
        
        if (!isNaN(selectedBmIndex) && bmPeriods[selectedBmIndex]) {
            // Usuário selecionou uma BM específica - usar ESSA BM
            periodConfig = bmPeriods[selectedBmIndex];
            console.log(`🎯 BM ${selectedBmIndex + 1} SELECIONADA - Config carregada:`, periodConfig);
        } else if (bmsInPeriod.length > 0) {
            // Fallback: usar o primeiro período que intersecta
            periodConfig = bmPeriods[bmsInPeriod[0].index];
            console.log('🎯 Config do período (fallback):', periodConfig);
        }
        
        console.log('\n🚨🚨🚨 GERANDO RELATÓRIO 🚨🚨🚨');
        console.log(`reportBmSelect.value:`, reportBmSelect?.value);
        console.log(`selectedBmIndex após parseInt:`, selectedBmIndex);
        console.log(`bmPeriods.length:`, bmPeriods.length);
        console.log(`bmPeriods[${selectedBmIndex}]:`, bmPeriods[selectedBmIndex]);
        
        console.log('📅 Períodos no intervalo:', bmsInPeriod.length);
        console.log('✅ periodConfig final:', periodConfig);

        const entries = await apiClient.fetchDailyEntries(workId, null, startDate, endDate);
        const generalExpenses = await apiClient.fetchData(
            'general_expenses',
            '*, equipment(*)',
            'date',
            true
        ).then(data => data.filter(entry =>
            entry.work_id == workId && entry.date >= startDate && entry.date <= endDate
        ));
        const damages = await apiClient.fetchDamages(workId, startDate, endDate);

        const expensesByEquipment = generalExpenses.reduce((acc, expense) => {
            if (expense.equipment_id) {
                (acc[expense.equipment_id] = acc[expense.equipment_id] || []).push(expense);
            }
            return acc;
        }, {});

        const damagesByEquipment = damages.reduce((acc, damage) => {
            if (damage.equipment_id) {
                (acc[damage.equipment_id] = acc[damage.equipment_id] || []).push(damage);
            }
            return acc;
        }, {});

        const generalWorkExpenses = generalExpenses.filter(expense => !expense.equipment_id);
        const generalWorkDamages = damages.filter(damage => !damage.equipment_id);

        // Carregar configurações padrão da obra

const workDefaultColumns = work?.config?.default_report_columns || {};

const columnVisibility = {};
columnConfigs.forEach(col => {
    const checkbox = document.getElementById(col.id);
    const placementSelect = document.getElementById(`${col.id}-placement`);
    
    // Mapear IDs das checkboxes para as chaves da configuração
    const configKey = col.id.replace('show-', '').replace(/-/g, '_');
    const workDefault = workDefaultColumns[configKey];
    
    columnVisibility[col.id] = {
        show: checkbox ? checkbox.checked : (workDefault?.enabled !== undefined ? workDefault.enabled : col.default),
        placement: placementSelect ? placementSelect.value : (workDefault?.placement || (col.summary ? 'summary' : 'detail'))
    };
});

        const showZeroValues = document.getElementById('show-zero-values')?.checked ?? true;

        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'Minha Empresa'}</h3>
                    <p><strong>Obra:</strong> ${work?.name || 'N/A'}<br>
                       <strong>Cliente:</strong> ${client?.name || 'N/A'}</p>
                    <p><strong>Período Medido:</strong> ${reportStartDateObj.toLocaleDateString('pt-BR')} a ${reportEndDateObj.toLocaleDateString('pt-BR')}<br>
                       <strong>Boletim(ns) de Medição:</strong> ${bmString}</p>
                    <hr>
                </div>
                <div class="report-summary">
                    <h3>Resumo Geral da Medição</h3>
                    <div class="table-wrapper responsive">
                        <table id="summary-table" style="border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #ddd;">SEQ</th>
                                    <th style="border: 1px solid #ddd;">Equipamento</th>
                                    <th style="border: 1px solid #ddd;">Valor Unit.</th>
                                    ${columnVisibility['show-dias-trab'].show ? '<th style="border: 1px solid #ddd;">Dias Trab.</th>' : ''}
                                    ${columnVisibility['show-dias-parados'].show && (columnVisibility['show-dias-parados'].placement === 'summary' || columnVisibility['show-dias-parados'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Dias Parados</th>' : ''}
                                    ${columnVisibility['show-horimetro-inicial'].show && (columnVisibility['show-horimetro-inicial'].placement === 'summary' || columnVisibility['show-horimetro-inicial'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Horímetro Inicial</th>' : ''}
                                    ${columnVisibility['show-horimetro-final'].show && (columnVisibility['show-horimetro-final'].placement === 'summary' || columnVisibility['show-horimetro-final'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Horímetro Final</th>' : ''}
                                    ${columnVisibility['show-horas-trab'].show && (columnVisibility['show-horas-trab'].placement === 'summary' || columnVisibility['show-horas-trab'].placement === 'both') ? '<th style="border: 1px solid #ddd;">HORAS TRAB.</th>' : ''}
                                    ${columnVisibility['show-horas-garantia-receber'].show && (columnVisibility['show-horas-garantia-receber'].placement === 'summary' || columnVisibility['show-horas-garantia-receber'].placement === 'both') ? '<th style="border: 1px solid #ddd;">HORAS GARANTIA A RECEBER</th>' : ''}
                                    ${columnVisibility['show-paradas-desc'].show && (columnVisibility['show-paradas-desc'].placement === 'summary' || columnVisibility['show-paradas-desc'].placement === 'both') ? '<th style="border: 1px solid #ddd;">HORAS PARAD.</th>' : ''}
                                    ${columnVisibility['show-km-inicial'].show && (columnVisibility['show-km-inicial'].placement === 'summary' || columnVisibility['show-km-inicial'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Inicial</th>' : ''}
                                    ${columnVisibility['show-km-final'].show && (columnVisibility['show-km-final'].placement === 'summary' || columnVisibility['show-km-final'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Final</th>' : ''}
                                    ${columnVisibility['show-km-trab'].show && (columnVisibility['show-km-trab'].placement === 'summary' || columnVisibility['show-km-trab'].placement === 'both') ? '<th style="border: 1px solid #ddd;">KM Trab.</th>' : ''}
                                    ${columnVisibility['show-acrescimos'].show && (columnVisibility['show-acrescimos'].placement === 'summary' || columnVisibility['show-acrescimos'].placement === 'both') ? '<th style="border: 1px solid #ddd;">ACRÉSC. (R$)</th>' : ''}
                                    ${columnVisibility['show-descontos'].show && (columnVisibility['show-descontos'].placement === 'summary' || columnVisibility['show-descontos'].placement === 'both') ? '<th style="border: 1px solid #ddd;">DESC. (R$)</th>' : ''}
                                    ${columnVisibility['show-mobilizacao'].show ? '<th style="border: 1px solid #ddd;">MOB. (R$)</th>' : ''}
                                    ${columnVisibility['show-desmobilizacao'].show ? '<th style="border: 1px solid #ddd;">DESMOB. (R$)</th>' : ''}
                                    ${columnVisibility['show-valor-mensal'].show && (columnVisibility['show-valor-mensal'].placement === 'summary' || columnVisibility['show-valor-mensal'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Valor Mensal</th>' : ''}
                                    ${columnVisibility['show-valor-diario'].show && (columnVisibility['show-valor-diario'].placement === 'summary' || columnVisibility['show-valor-diario'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Valor Diário</th>' : ''}
                                    ${columnVisibility['show-valor-horas'].show && (columnVisibility['show-valor-horas'].placement === 'summary' || columnVisibility['show-valor-horas'].placement === 'both') ? '<th style="border: 1px solid #ddd;">Valor das Horas</th>' : ''}
                                    <th style="border: 1px solid #ddd;">TOTAL (R$)</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="report-total" id="grand-total"></div>
                </div>
        `;

        let grandTotal = 0;
        const entriesByEquipment = entries.reduce((acc, entry) => {
            (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
            return acc;
        }, {});

        const substitutionsInPeriod = await apiClient.fetchEquipmentSubstitutions(workId, startDate, endDate);
        const substitutionsBySubstitutingEquip = new Map(
            substitutionsInPeriod.map(sub => [sub.substituting_equipment_id, sub])
        );
        const substitutionsBySubstitutedEquip = new Map(
            substitutionsInPeriod.map(sub => [sub.substituted_equipment_id, sub])
        );

        const allEquipmentInWork = work.config?.equipment?.map(e => e.equipment_id) || [];
        const allEquipConfigs = new Map(work.config?.equipment?.map(ec => [parseInt(ec.equipment_id), ec]));

        let equipmentIdsToReport = [];
        for (const equipId of allEquipmentInWork) {
            const equipment = appState.equipment.find(e => e.id == equipId);
            if (!equipment) continue;
            const shouldAppear = await shouldEquipmentAppearInReport(workId, equipId, startDate, endDate);
            if (shouldAppear) {
                equipmentIdsToReport.push(equipId);
            }
        }

        equipmentIdsToReport.sort((idA, idB) => {
            // 🎯 PRIORIDADE 1: Ordem definida no cadastro da obra
            const equipmentInWork = work?.config?.equipment || [];
            const indexA = equipmentInWork.findIndex(ec => ec.equipment_id == idA);
            const indexB = equipmentInWork.findIndex(ec => ec.equipment_id == idB);
            
            if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
                return indexA - indexB; // Respeita a ordem do cadastro
            }
            
            // PRIORIDADE 2: Alfabético (fallback para equipamentos sem ordem definida)
            const equipA = appState.equipment.find(e => e.id == idA);
            const equipB = appState.equipment.find(e => e.id == idB);
            const prefixA = equipA?.prefix || '';
            const prefixB = equipB?.prefix || '';
            return prefixA.localeCompare(prefixB);
        });


        const summaryBody = document.createElement('tbody');
        let seqNum = 1;
        let generalWorkTotal = 0;

        for (const equipmentId of equipmentIdsToReport) {
            const equipmentEntries = entriesByEquipment[equipmentId] || [];
            const equipmentExpenses = generalExpenses.filter(e => e.equipment_id == equipmentId) || [];
            const equipmentDamages = damages.filter(d => d.equipment_id == equipmentId) || [];
            const equipment = appState.equipment.find(e => e.id == equipmentId);
            let equipConfig = allEquipConfigs.get(parseInt(equipmentId));

            if (!equipConfig || !equipment) continue;

            const validDamages = equipmentDamages.filter(damage => validateDamageForMeasurement(damage));
            const substitutionDetails = substitutionsBySubstitutingEquip.get(parseInt(equipmentId));
            const wasSubstitutedDetails = substitutionsBySubstitutedEquip.get(parseInt(equipmentId));

            let configForCalculation = equipConfig;
            let measureValueForDisplay = preciseRounding.round2(parseFloat(equipConfig?.measurement_value || 0));
            let measurementTypeDisplay = formatMeasurementType(equipConfig?.measurement_type || 'N/A', equipConfig?.guaranteed_hours);
            
            if (substitutionDetails) {
                 const substitutedEquipConfig = allEquipConfigs.get(parseInt(substitutionDetails.substituted_equipment_id));
                 if (substitutedEquipConfig) {
                    configForCalculation = { ...substitutedEquipConfig, equipment_id: equipConfig.equipment_id, equipment_work_prefix: equipConfig.equipment_work_prefix };
                    measureValueForDisplay = preciseRounding.round2(parseFloat(substitutedEquipConfig.measurement_value));
                    measurementTypeDisplay = formatMeasurementType(substitutedEquipConfig.measurement_type, substitutedEquipConfig.guaranteed_hours);
                 }
            }
           
            // 🔍 LOG CRÍTICO: Verificar o que está sendo passado
            console.log(`\n🔍🔍🔍 RELATÓRIO - CALCULANDO EQUIPAMENTO ${equipment?.prefix}:`);
            console.log(`   📅 Período: ${startDate} a ${endDate}`);
            console.log(`   ⚙️ Tipo medição: ${configForCalculation?.measurement_type}`);
            console.log(`   ⏰ Horas garantia: ${configForCalculation?.guaranteed_hours}`);
            console.log(`   💰 Valor mensal: ${configForCalculation?.measurement_value}`);
            console.log(`   📊 Entries: ${equipmentEntries.length}`);
            console.log(`   ⚠️ NÃO PASSANDO periodConfig para igualar com lançamentos!`);
            
            const equipmentCalculation = calculateEquipmentTotalValue(
                equipmentEntries,
                equipmentExpenses,
                configForCalculation,
                work,
                validDamages,
                substitutionDetails,
                startDate,
                endDate
                // ⚠️ NÃO PASSAR periodConfig!
            );
            
            console.log(`   💵 RESULTADO: R$ ${equipmentCalculation.totalValue.toFixed(2)}`);
            console.log(`\n────────────────────\n`);

            let totalWorkedHours = 0;
            let totalKmWorked = 0;
            
            const workedEntries = equipmentEntries.filter(entry => entry.is_worked);

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

            workedEntries.forEach(entry => {
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

            totalWorkedHours = preciseRounding.round2(totalWorkedHours);
            totalKmWorked = preciseRounding.round2(totalKmWorked);
            const shouldShowEquipment = await shouldEquipmentAppearInReport(workId, equipmentId, startDate, endDate);

            
            let totalDaysInPeriodForEquipment = 0;
            if (equipmentEntries.length > 0) {
                const sortedDates = equipmentEntries.map(entry => new Date(entry.date + 'T00:00:00')).sort((a, b) => a - b);
                const firstDate = sortedDates[0];
                const lastDate = sortedDates[sortedDates.length - 1];
                totalDaysInPeriodForEquipment = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
            }

            let totalDeductibleStoppageHoursSummary = 0;
            equipmentEntries.forEach(entry => {
                totalDeductibleStoppageHoursSummary += calculateDeductibleStoppageHours(entry, equipConfig, work);
            });
            totalDeductibleStoppageHoursSummary = preciseRounding.round2(totalDeductibleStoppageHoursSummary);

            let daysStoppedSummary = 0;
            if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
                if (substitutionDetails) {
                    daysStoppedSummary = 0;
                } else if (wasSubstitutedDetails) {
                    const substDate = new Date(wasSubstitutedDetails.substitution_date + 'T00:00:00');
                    const entriesBeforeSubst = equipmentEntries.filter(entry => new Date(entry.date + 'T00:00:00') < substDate);
                    const workedDaysBeforeSubst = entriesBeforeSubst.filter(entry => entry.is_worked).length;
                    let daysInPeriodBeforeSubst = 0;
                    if (entriesBeforeSubst.length > 0) {
                        const firstDay = new Date(entriesBeforeSubst[0].date + 'T00:00:00');
                        const lastDay = new Date(entriesBeforeSubst[entriesBeforeSubst.length - 1].date + 'T00:00:00');
                        daysInPeriodBeforeSubst = Math.round((lastDay - firstDay) / (1000 * 60 * 60 * 24)) + 1;
                    }
                    daysStoppedSummary = Math.max(0, daysInPeriodBeforeSubst - workedDaysBeforeSubst);
                } else {
                    daysStoppedSummary = totalDaysInPeriodForEquipment - equipmentCalculation.workedDays;
                }
            } else {
                daysStoppedSummary = totalDaysInPeriodForEquipment - equipmentCalculation.workedDays;
            }
            daysStoppedSummary = Math.max(0, daysStoppedSummary);

            const monthlyValueSummary = (configForCalculation?.measurement_type === 'monthly' || configForCalculation?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) ? preciseRounding.formatCurrencyPrecise(measureValueForDisplay) : '---';
            const dailyValueSummary = (configForCalculation?.measurement_type === 'daily') ? preciseRounding.formatCurrencyPrecise(measureValueForDisplay) : '---';
            const hourlyValueSummary = (configForCalculation?.measurement_type === 'hourly') ? preciseRounding.formatCurrencyPrecise(measureValueForDisplay) : '---';

            if (shouldShowEquipment) {
                // CORREÇÃO: Consolidar acréscimos e descontos corretamente para exibição
                // 🔒 RECALCULAR NOTAS SEM AS OCULTAS (hide_in_report)
let visibleNotesAdditions = 0;
let visibleNotesDiscounts = 0;

equipmentEntries.forEach(entry => {
    (entry.notes || []).forEach(note => {
        if (note.hide_in_report) {
            return; // Pula notas ocultas
        }
        
        if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
            const noteValue = preciseRounding.round2(note.quantity * note.value);
            visibleNotesAdditions = preciseRounding.sumPrecise(visibleNotesAdditions, noteValue);
        }
        if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
            const noteValue = preciseRounding.round2(note.quantity * note.value);
            visibleNotesDiscounts = preciseRounding.sumPrecise(visibleNotesDiscounts, noteValue);
        }
    });
});

const totalAdditionsForSummary = preciseRounding.sumPrecise(
    visibleNotesAdditions, // ← MUDOU: Usar notas visíveis
    equipmentCalculation.expensesAdditions,
    equipmentCalculation.damagesAdditions
    
);

const totalDiscountsForSummary = preciseRounding.sumPrecise(
    equipmentCalculation.stoppageDiscounts,
    visibleNotesDiscounts, // ← MUDOU: Usar notas visíveis
    equipmentCalculation.expensesDiscounts,
    equipmentCalculation.damagesDiscounts
);
    
                const detailHeaders = ["Data", "Dia Sem.", "Status", "Horímetro/KM", "Horas Trab.", "KM Trab.", "Paradas (h)", "Valor Dia", "Observações"];
                let detailRows = '';
                let totalWorkedHoursDetail = 0;
                let totalKmWorkedDetail = 0;
                let totalStoppageHoursDetail = 0;

                equipmentEntries.forEach(entry => {
                const dateObj = new Date(entry.date + 'T00:00:00');
                const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                const status = entry.is_worked ? 'Trab.' : 'Parad.';
            
                const totalStoppageHours = calculateDeductibleStoppageHours(entry, configForCalculation, work);
                
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
                
                // MUDANÇA 1: Calcular o valor base do dia
                const dailyValue = calculateDailyBaseValue(entry, configForCalculation, work);
                const stoppageDiscount = calculateStoppageDiscountValue(entry, configForCalculation, work, false);
                
                // 🔥 CORREÇÃO: Calcular acréscimos e descontos EXCLUINDO os ocultos (hide_in_report)
                // para mostrar o valor correto na coluna "Valor do Dia"
                let notesAdditionsVisible = 0;
                let notesDiscountsVisible = 0;
                
                (entry.notes || []).forEach(note => {
                    // Pular notas marcadas como ocultas
                    if (note.hide_in_report) {
                        return;
                    }
                    
                    if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                        notesAdditionsVisible += (note.quantity || 0) * (note.value || 0);
                    }
                    if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                        notesDiscountsVisible += (note.quantity || 0) * (note.value || 0);
                    }
                });
                
                notesAdditionsVisible = preciseRounding.round2(notesAdditionsVisible);
                notesDiscountsVisible = preciseRounding.round2(notesDiscountsVisible);
                
                // MUDANÇA 2: Calcular mobilização e desmobilização separadamente
                let mobilizationCostForDay = 0;
                let demobilizationCostForDay = 0;
                
                if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
                    mobilizationCostForDay = parseFloat(entry.mobilization_manual_value || configForCalculation.mobilization_cost || 0);
                }
                
                if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
                    demobilizationCostForDay = parseFloat(entry.demobilization_manual_value || configForCalculation.demobilization_cost || 0);
                }
                
                // MUDANÇA 3: Valor completo do dia INCLUINDO mobilização/desmobilização
                // usando APENAS os valores VISÍVEIS (sem os ocultos)
                const completeDailyValueWithMobDemob = preciseRounding.sumPrecise(
                    dailyValue, 
                    notesAdditionsVisible, 
                    -stoppageDiscount, 
                    -notesDiscountsVisible, 
                    mobilizationCostForDay, 
                    demobilizationCostForDay
                );
                
                // MUDANÇA 4: Atualizar os totais usando o valor completo
                totalWorkedHoursDetail = preciseRounding.sumPrecise(totalWorkedHoursDetail, hoursWorked);
                totalKmWorkedDetail = preciseRounding.sumPrecise(totalKmWorkedDetail, kmWorked);
                totalStoppageHoursDetail = preciseRounding.sumPrecise(totalStoppageHoursDetail, totalStoppageHours);
            
                const dailyObservations = [];
                if (entry.notes && entry.notes.length > 0) {
                   entry.notes.forEach(note => {
                        // 🔒 OCULTAR NOTA SE MARCADA PARA NÃO APARECER NO RELATÓRIO OU NO PDF
                        if (note.hide_in_report || note.hide_in_pdf) {
                            console.log(`🔒 Nota oculta: hide_in_report=${note.hide_in_report}, hide_in_pdf=${note.hide_in_pdf}, descrição="${note.description}"`);
                            return; // Não exibe, mas JÁ foi contabilizada no cálculo
                        }
                        
                        if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                            const noteValue = preciseRounding.round2(note.quantity * note.value);
                            dailyObservations.push(`Acréscimo: ${note.description} (${preciseRounding.formatCurrencyPrecise(noteValue)})`);
                        }
                        if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                            const noteValue = preciseRounding.round2(note.quantity * note.value);
                            dailyObservations.push(`Desconto: ${preciseRounding.formatCurrencyPrecise(noteValue)}`);
                        }
                        if (note.type === 'observation' && (note.target === 'client' || note.target === 'both')) {
                            dailyObservations.push(`Nota: ${note.description}`);
                        }
                    });
                }
                // CORREÇÃO: Mudei a lógica para exibir a observação de mobilização/desmobilização
                // apenas com o nome, se o valor for 0
                if (entry.is_mobilization && entry.is_mobilization_contabilized === 1) {
                    const mobCost = preciseRounding.round2(parseFloat(entry.mobilization_manual_value || configForCalculation.mobilization_cost || 0));
                    if (mobCost > 0) {
                        dailyObservations.push(`MOBILIZAÇÃO (${preciseRounding.formatCurrencyPrecise(mobCost)})`);
                    } else {
                        dailyObservations.push(`MOBILIZAÇÃO`);
                    }
                }
                if (entry.is_demobilized && entry.is_demobilization_contabilized === 1) {
                    const demobCost = preciseRounding.round2(parseFloat(entry.demobilization_manual_value || configForCalculation.demobilization_cost || 0));
                    if (demobCost > 0) {
                        dailyObservations.push(`DESMOBILIZAÇÃO (${preciseRounding.formatCurrencyPrecise(demobCost)})`);
                    } else {
                        dailyObservations.push(`DESMOBILIZAÇÃO`);
                    }
                }
                if (entry.stoppages && entry.stoppages.length > 0) {
                    const deductibleStoppageNames = [];
                    entry.stoppages.forEach(stoppage => {
                        if ((configForCalculation?.deductible_stoppages || []).includes(stoppage.type_id)) {
                            const stopType = appState.stoppage_types.find(st => st.id == stoppage.type_id);
                            if (stopType) {
                                deductibleStoppageNames.push(stopType.name);
                            }
                        }
                    });
                    if (deductibleStoppageNames.length > 0 && totalStoppageHours > 0) {
                        dailyObservations.push(`Parada: ${deductibleStoppageNames.join(', ')} (${totalStoppageHours.toFixed(2)}h)`);
                    }
                }
            
            const entryDate = entry.date;
            if (substitutionDetails && substitutionDetails.substitution_date === entryDate) {
                const substitutedEquip = appState.equipment.find(e => e.id == substitutionDetails.substituted_equipment_id);
                dailyObservations.push(`SUBSTITUIU O ${substitutedEquip?.prefix || 'equipamento'}`);
            }
            if (wasSubstitutedDetails && wasSubstitutedDetails.substitution_date === entryDate) {
                const substitutingEquip = appState.equipment.find(e => e.id == wasSubstitutedDetails.substituting_equipment_id);
                dailyObservations.push(`SUBSTITUÍDO POR ${substitutingEquip?.prefix || 'outro equipamento'}`);
            }
            
            // Adicionar avarias que ocorreram nesta data
            validDamages.forEach(damage => {
                if (damage.damage_date === entryDate) {
                    const damageTotal = preciseRounding.round2(parseFloat(damage.total_value) || 0);
                    const impactType = damage.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT ? 'Acréscimo' : 'Desconto';
                    const valueStr = damageTotal > 0 ? ` - ${preciseRounding.formatCurrencyPrecise(damageTotal)}` : '';
                    const obsStr = damage.observations ? ` - ${damage.observations}` : '';
                    dailyObservations.push(`⚠️ AVARIA Cód ${damage.id} (${impactType})${obsStr}${valueStr}`);
                }
            });
            
            const formattedObservations = dailyObservations.length > 0 ? dailyObservations.join('; ') : '---';                detailRows += `
                        <tr>
                            <td style="border: 1px solid #ddd;">${formatDateBR(entry.date)}</td>
                            <td style="border: 1px solid #ddd;">${dayOfWeek}</td>
                            <td style="border: 1px solid #ddd;">${status}</td>
                            <td style="border: 1px solid #ddd;">${entry.horometer_start || '---'} - ${entry.horometer_end || '---'}</td>
                            <td style="border: 1px solid #ddd;">${hoursWorked.toFixed(2)}</td>
                            <td style="border: 1px solid #ddd;">${kmWorked.toFixed(2)}</td>
                            <td style="border: 1px solid #ddd;">${totalStoppageHours.toFixed(2)}</td>
                            <td style="border: 1px solid #ddd; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(completeDailyValueWithMobDemob)}</td>
                            <td style="border: 1px solid #ddd;">${formattedObservations}</td>
                        </tr>
                    `;
                });

                let mobilizationDate = null;
                let demobilizationDate = null;

                equipmentEntries.forEach(entry => {
                    if (entry.is_mobilization && !mobilizationDate) mobilizationDate = entry.date;
                    if (entry.is_demobilized && !demobilizationDate) demobilizationDate = entry.date;
                });
    
                const finalTotalForEquipment = equipmentCalculation.totalValue;

                grandTotal = preciseRounding.sumPrecise(grandTotal, finalTotalForEquipment);
                
                // O total do rodapé do detalhamento agora corresponde ao valor total do equipamento
                const totalDetailFooter = finalTotalForEquipment;

                // 🎯 CALCULAR HORAS DE GARANTIA A RECEBER (apenas para equipamentos com horas de garantia)
                let guaranteedHoursToReceive = 0;
                if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
                    const guaranteedHours = parseFloat(equipConfig?.guaranteed_hours || 0);
                    
                    // Calcular total de dias no período BM
                    const periodStartDate = new Date(startDate + 'T00:00:00');
                    const periodEndDate = new Date(endDate + 'T00:00:00');
                    const totalDaysInBM = Math.round((periodEndDate - periodStartDate) / (1000 * 60 * 60 * 24)) + 1;
                    
                    // Dias trabalhados pelo equipamento
                    const workedDays = equipmentCalculation.workedDays;
                    
                    // Horas proporcionais baseadas nos dias trabalhados
                    if (totalDaysInBM > 0 && guaranteedHours > 0) {
                        guaranteedHoursToReceive = (workedDays / totalDaysInBM) * guaranteedHours;
                        console.log(`📊 Horas Garantia a Receber: ${workedDays} dias ÷ ${totalDaysInBM} dias × ${guaranteedHours}h = ${guaranteedHoursToReceive.toFixed(2)}h`);
                    }
                }

                const summaryRow = document.createElement('tr');
                summaryRow.innerHTML = `
                    <td style="border: 1px solid #ddd;">${seqNum++}</td>
                    <td style="border: 1px solid #ddd;">${equipment?.prefix || 'N/A'}${equipConfig?.equipment_work_prefix ? ` (${equipConfig.equipment_work_prefix})` : ''}${substitutionDetails ? ' 🔄' : ''}${wasSubstitutedDetails ? ' 🔚' : ''}${validDamages.length > 0 ? ' ⚠️' : ''}</td>
                    <td style="border: 1px solid #ddd;">${preciseRounding.formatCurrencyPrecise(measureValueForDisplay)} / ${measurementTypeDisplay}</td>
                    ${columnVisibility['show-dias-trab'].show ? `<td style="border: 1px solid #ddd;">${equipmentCalculation.workedDays}</td>` : ''}
                    ${columnVisibility['show-dias-parados'].show && (columnVisibility['show-dias-parados'].placement === 'summary' || columnVisibility['show-dias-parados'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${daysStoppedSummary}</td>` : ''}
                    ${columnVisibility['show-horimetro-inicial'].show && (columnVisibility['show-horimetro-inicial'].placement === 'summary' || columnVisibility['show-horimetro-inicial'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${firstHorometerStart}</td>` : ''}
                    ${columnVisibility['show-horimetro-final'].show && (columnVisibility['show-horimetro-final'].placement === 'summary' || columnVisibility['show-horimetro-final'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${lastHorometerEnd}</td>` : ''}
                    ${columnVisibility['show-horas-trab'].show && (columnVisibility['show-horas-trab'].placement === 'summary' || columnVisibility['show-horas-trab'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${totalWorkedHours.toFixed(2)}h</td>` : ''}
                    ${columnVisibility['show-horas-garantia-receber'].show && (columnVisibility['show-horas-garantia-receber'].placement === 'summary' || columnVisibility['show-horas-garantia-receber'].placement === 'both') ? `<td style="border: 1px solid #ddd; ${guaranteedHoursToReceive > 0 ? 'background-color: #e3f2fd; font-weight: bold;' : ''}">${guaranteedHoursToReceive > 0 ? guaranteedHoursToReceive.toFixed(2) + 'h' : '---'}</td>` : ''}
                    ${columnVisibility['show-paradas-desc'].show && (columnVisibility['show-paradas-desc'].placement === 'summary' || columnVisibility['show-paradas-desc'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${totalDeductibleStoppageHoursSummary.toFixed(2)}h</td>` : ''}
                    ${columnVisibility['show-km-inicial'].show && (columnVisibility['show-km-inicial'].placement === 'summary' || columnVisibility['show-km-inicial'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${firstKmStart}</td>` : ''}
                    ${columnVisibility['show-km-final'].show && (columnVisibility['show-km-final'].placement === 'summary' || columnVisibility['show-km-final'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${lastKmEnd}</td>` : ''}
                    ${columnVisibility['show-km-trab'].show && (columnVisibility['show-km-trab'].placement === 'summary' || columnVisibility['show-km-trab'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${totalKmWorked.toFixed(2)} km</td>` : ''}
                    ${columnVisibility['show-acrescimos'].show && (columnVisibility['show-acrescimos'].placement === 'summary' || columnVisibility['show-acrescimos'].placement === 'both') ? `<td style="border: 1px solid #ddd; ${totalAdditionsForSummary > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(totalAdditionsForSummary)}</td>` : ''}
                    ${columnVisibility['show-descontos'].show && (columnVisibility['show-descontos'].placement === 'summary' || columnVisibility['show-descontos'].placement === 'both') ? `<td style="border: 1px solid #ddd; ${totalDiscountsForSummary > 0 ? 'background-color: #ffebee; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(totalDiscountsForSummary)}</td>` : ''}
                    ${columnVisibility['show-mobilizacao'].show ? `<td style="border: 1px solid #ddd; ${equipmentCalculation.mobilizationCost > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(equipmentCalculation.mobilizationCost)}</td>` : ''}
                    ${columnVisibility['show-desmobilizacao'].show ? `<td style="border: 1px solid #ddd; ${equipmentCalculation.demobilizationCost > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(equipmentCalculation.demobilizationCost)}</td>` : ''}
                    ${columnVisibility['show-valor-mensal'].show && (columnVisibility['show-valor-mensal'].placement === 'summary' || columnVisibility['show-valor-mensal'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${monthlyValueSummary}</td>` : ''}
                    ${columnVisibility['show-valor-diario'].show && (columnVisibility['show-valor-diario'].placement === 'summary' || columnVisibility['show-valor-diario'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${dailyValueSummary}</td>` : ''}
                    ${columnVisibility['show-valor-horas'].show && (columnVisibility['show-valor-horas'].placement === 'summary' || columnVisibility['show-valor-horas'].placement === 'both') ? `<td style="border: 1px solid #ddd;">${hourlyValueSummary}</td>` : ''}
                    <td style="border: 1px solid #ddd;"><strong>${preciseRounding.formatCurrencyPrecise(finalTotalForEquipment)}</strong></td>
                `;

                summaryBody.appendChild(summaryRow);

                const detailSummaryRows = `
                    ${generateDetailedAdditionsRows(equipmentEntries, equipmentExpenses, validDamages, equipConfig, work)}
                    ${generateDetailedDiscountsRows(equipmentEntries, equipmentExpenses, validDamages, equipConfig, work)}
                    <tr><td style="border: 1px solid #ddd;"><strong>Total Equipamento</strong></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"><strong>${preciseRounding.formatCurrencyPrecise(finalTotalForEquipment)}</strong></td></tr>
                `;

                const damageIndicator = validDamages.length > 0 ?
                    `<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; margin-bottom: 10px; border-radius: 4px;">
                        <strong>⚠️ AVARIAS DETECTADAS:</strong> Este equipamento possui ${validDamages.length} avaria(s) que impactam a medição.
                    </div>` : '';

                const substitutionIndicator = substitutionDetails ?
                    `<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; margin-bottom: 10px; border-radius: 4px;">
                        <strong>🔄 EQUIPAMENTO SUBSTITUTO:</strong> Este equipamento está substituindo outro equipamento e usando seus valores de horas de garantia.
                    </div>` : '';

                const wasSubstitutedIndicator = wasSubstitutedDetails ?
                    `<div style="background: #fdf6e3; border: 1px solid #ffecb3; padding: 8px; margin-bottom: 10px; border-radius: 4px;">
                        <strong>🔚 EQUIPAMENTO SUBSTITUÍDO:</strong> Este equipamento foi substituído por outro a partir de ${formatDateBR(wasSubstitutedDetails.substitution_date)}.
                    </div>` : '';

                reportHTML += `
                    <div class="report-detail" data-equip-id="${equipmentId}">
                        <h3>Detalhamento: ${equipment?.prefix || 'N/A'}${equipConfig?.equipment_work_prefix ? ` (${equipConfig.equipment_work_prefix})` : ''} - ${getEquipTypeName(equipment?.type) || 'N/A'}</h3>
                        ${substitutionIndicator}
                        ${wasSubstitutedIndicator}
                        ${damageIndicator}
                        <div class="table-wrapper responsive">
                            <table style="border-collapse: collapse;">
                                <thead><tr>${detailHeaders.map(h => `<th style="border: 1px solid #ddd;">${h}</th>`).join('')}</tr></thead>
                                <tbody>${detailRows}</tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" style="border: 1px solid #ddd; text-align: right; font-weight: bold;">Totais:</td>
                                        <td style="border: 1px solid #ddd; font-weight: bold;">${totalWorkedHoursDetail.toFixed(2)}h</td>
                                        <td style="border: 1px solid #ddd; font-weight: bold;">${totalKmWorkedDetail.toFixed(2)} km</td>
                                        <td style="border: 1px solid #ddd; font-weight: bold;">${totalStoppageHoursDetail.toFixed(2)}h</td>
                                        <td style="border: 1px solid #ddd; font-weight: bold;">${preciseRounding.formatCurrencyPrecise(finalTotalForEquipment)}</td>
                                        <td style="border: 1px solid #ddd;"></td>
                                    </tr>
                                    
                                </tfoot>
                            </table>
                        </div>
                        <div class="table-wrapper">
                            <table class="detail-summary-table" style="border-collapse: collapse;">
                            <thead><tr><th style="border: 1px solid #ddd;">Tipo</th><th style="border: 1px solid #ddd;">Data</th><th style="border: 1px solid #ddd;">Descrição</th><th style="border: 1px solid #ddd;">Valor</th></tr></thead>
                            <tbody>${detailSummaryRows}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        }

        const generalWorkAdditions = preciseRounding.round2(calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT));
        const generalWorkDiscounts = preciseRounding.round2(calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT));

        const generalDamageAdditions = preciseRounding.round2(
            generalWorkDamages.filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                              .reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0)
        );
        const generalDamageDiscounts = preciseRounding.round2(
            generalWorkDamages.filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                              .reduce((sum, d) => sum + (parseFloat(d.total_value) || 0), 0)
        );

        generalWorkTotal = preciseRounding.sumPrecise(
            generalWorkAdditions,
            generalDamageAdditions,
            -generalWorkDiscounts,
            -generalDamageDiscounts
        );

        if (generalWorkTotal !== 0) {
            grandTotal = preciseRounding.sumPrecise(grandTotal, generalWorkTotal);
            const totalGeneralAdditions = preciseRounding.sumPrecise(generalWorkAdditions, generalDamageAdditions);
            const totalGeneralDiscounts = preciseRounding.sumPrecise(generalWorkDiscounts, generalDamageDiscounts);

            const generalWorkSummaryRow = document.createElement('tr');
            generalWorkSummaryRow.innerHTML = `
                <td style="border: 1px solid #ddd;">${seqNum++}</td>
                <td style="border: 1px solid #ddd;">DESPESAS GERAIS DA OBRA</td>
                <td style="border: 1px solid #ddd;">---</td>
                ${columnVisibility['show-dias-trab'].show ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-horimetro-inicial'].show && (columnVisibility['show-horimetro-inicial'].placement === 'summary' || columnVisibility['show-horimetro-inicial'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-horimetro-final'].show && (columnVisibility['show-horimetro-final'].placement === 'summary' || columnVisibility['show-horimetro-final'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-horas-trab'].show && (columnVisibility['show-horas-trab'].placement === 'summary' || columnVisibility['show-horas-trab'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-km-inicial'].show && (columnVisibility['show-km-inicial'].placement === 'summary' || columnVisibility['show-km-inicial'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-km-final'].show && (columnVisibility['show-km-final'].placement === 'summary' || columnVisibility['show-km-final'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-km-trab'].show && (columnVisibility['show-km-trab'].placement === 'summary' || columnVisibility['show-km-trab'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-acrescimos'].show && (columnVisibility['show-acrescimos'].placement === 'summary' || columnVisibility['show-acrescimos'].placement === 'both') ? `<td style="border: 1px solid #ddd; ${totalGeneralAdditions > 0 ? 'background-color: #e8f5e9; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(totalGeneralAdditions)}</td>` : ''}
                ${columnVisibility['show-descontos'].show && (columnVisibility['show-descontos'].placement === 'summary' || columnVisibility['show-descontos'].placement === 'both') ? `<td style="border: 1px solid #ddd; ${totalGeneralDiscounts > 0 ? 'background-color: #ffebee; font-weight: bold;' : ''}">${preciseRounding.formatCurrencyPrecise(totalGeneralDiscounts)}</td>` : ''}
                ${columnVisibility['show-mobilizacao'].show ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-desmobilizacao'].show ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-paradas-desc'].show && (columnVisibility['show-paradas-desc'].placement === 'summary' || columnVisibility['show-paradas-desc'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-dias-parados'].show && (columnVisibility['show-dias-parados'].placement === 'summary' || columnVisibility['show-dias-parados'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-valor-mensal'].show && (columnVisibility['show-valor-mensal'].placement === 'summary' || columnVisibility['show-valor-mensal'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-valor-diario'].show && (columnVisibility['show-valor-diario'].placement === 'summary' || columnVisibility['show-valor-diario'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                ${columnVisibility['show-valor-horas'].show && (columnVisibility['show-valor-horas'].placement === 'summary' || columnVisibility['show-valor-horas'].placement === 'both') ? '<td style="border: 1px solid #ddd;">---</td>' : ''}
                <td style="border: 1px solid #ddd;"><strong>${preciseRounding.formatCurrencyPrecise(generalWorkTotal)}</strong></td>
            `;
            summaryBody.appendChild(generalWorkSummaryRow);

            const generalWorkDetailSummaryRows = `
                ${generateGeneralWorkExpensesAndDamagesDetailRows(generalWorkExpenses, generalWorkDamages)}
                <tr><td style="border: 1px solid #ddd;"><strong>Total Despesas Gerais</strong></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"></td><td style="border: 1px solid #ddd;"><strong>${preciseRounding.formatCurrencyPrecise(generalWorkTotal)}</strong></td></tr>
            `;

            reportHTML += `
                <div class="report-detail" data-equip-id="general-work-expenses">
                    <h3>Detalhamento: DESPESAS GERAIS DA OBRA</h3>
                    <div class="table-wrapper">
                        <table class="detail-summary-table" style="border-collapse: collapse;">
                        <thead><tr><th style="border: 1px solid #ddd;">Tipo</th><th style="border: 1px solid #ddd;">Data</th><th style="border: 1px solid #ddd;">Descrição</th><th style="border: 1px solid #ddd;">Valor</th></tr></thead>
                        <tbody>${generalWorkDetailSummaryRows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const totalEquipmentsRow = document.createElement('tr');
        if(summaryBody.rows.length > 0) {
            const colspan = summaryBody.rows[0].cells.length - 2;
            const equipmentCount = equipmentIdsToReport.length;
            totalEquipmentsRow.innerHTML = `<td colspan="2" style="border: 1px solid #ddd; font-weight: bold;">TOTAL: ${equipmentCount} EQUIPAMENTOS</td><td colspan="${colspan > 0 ? colspan : 1}" style="border: 1px solid #ddd;"></td>`;
            summaryBody.appendChild(totalEquipmentsRow);
        }

        reportHTML += `</div>`;
        if (measurementReportOutput) {
            measurementReportOutput.innerHTML = reportHTML;
            measurementReportOutput.querySelector('#summary-table tbody')?.replaceWith(summaryBody);
            measurementReportOutput.querySelector('#grand-total').textContent = `Total Geral da Medição: ${preciseRounding.formatCurrencyPrecise(grandTotal)}`;
        }

        if (exportPdfBtn) exportPdfBtn.style.display = 'inline-block';
        if (exportPdfDriveBtn) exportPdfDriveBtn.style.display = 'inline-block';
        if (renewDriveAuthBtn) renewDriveAuthBtn.style.display = 'inline-block';
        if (whatsappMeasurementBtn) whatsappMeasurementBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Erro ao gerar relatório:", e);
        if (measurementReportOutput) measurementReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

const formatMeasurementType = (type, guaranteedHours = null) => {
    switch (type) {
        case 'monthly': return 'MENS.';
        case 'daily': return 'DIA';
        case 'hourly': return 'HORA';
        case 'guaranteed_hours': return guaranteedHours ? `${guaranteedHours}H MÍNIMAS` : 'GAR';
        default: return type.toUpperCase();
    }
};

const handleWorkSelectChange = () => {
    const workId = reportWorkSelect.value;
    
    // ✅ NOVO: Salvar a obra selecionada no sessionStorage
    if (workId) {
        sessionStorage.setItem('selectedWorkId', workId);
    } else {
        sessionStorage.removeItem('selectedWorkId');
    }
    
    if (!workId) {
        if (reportBmSelect) reportBmSelect.innerHTML = '<option value="">Selecione o Período</option>';
        return;
    }
    const work = appState.works.find(w => w.id == workId);
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
                if (reportWorkSelect.value && reportBmSelect.value !== '') {
                    document.getElementById('generate-measurement-report-btn')?.click();
                }
            }, 100);
        }
    }
    
        applyWorkDefaultColumns(workId);

    
    
};

const handleBmSelectChange = () => {
    const workId = reportWorkSelect.value;
    const bmIndex = reportBmSelect.value;
    if (workId && bmIndex !== '') {
        const work = appState.works.find(w => w.id == workId);
        const bmPeriod = work?.config?.measurement_periods[parseInt(bmIndex)];
        if (bmPeriod) {
            if (reportStartDateEl) reportStartDateEl.value = bmPeriod.start;
            if (reportEndDateEl) reportEndDateEl.value = bmPeriod.end;
        }
        
        // 🔥 AUTO-BUSCAR após mudar BM
        setTimeout(() => {
            if (reportWorkSelect.value && reportBmSelect.value !== '') {
                document.getElementById('generate-measurement-report-btn')?.click();
            }
        }, 100);
    }
};

// 1. SUBSTITUIR a função calculateCompleteDailyValueForReport existente por esta versão:
const calculateCompleteDailyValueForReport = (entry, equipConfig, work) => {
    
    // 🔥 HORAS DE GARANTIA - CORREÇÃO APLICADA
    if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        console.log(`\n🔥 [RELATÓRIO] Calculando dia ${entry.date}`);
        
        const monthlyValue = parseFloat(equipConfig?.measurement_value || 0);
        const guaranteedHours = parseFloat(equipConfig?.guaranteed_hours || 0);
        
        if (monthlyValue === 0 || guaranteedHours === 0) {
            console.warn(`❌ [RELATÓRIO] Valores inválidos`);
            return 0;
        }
        
        const hourlyRate = monthlyValue / guaranteedHours;
        
        // 🔥🔥🔥 CORREÇÃO CRÍTICA 🔥🔥🔥
        // SEMPRE USAR 30 DIAS FIXOS, NUNCA O NÚMERO REAL DE DIAS DO MÊS!
        const guaranteedHoursPerDay = guaranteedHours / 30;  // ← SEMPRE 30!
        
        console.log(`   💵 Valor mensal: R$ ${monthlyValue.toFixed(2)}`);
        console.log(`   ⏰ Horas garantidas total: ${guaranteedHours}h`);
        console.log(`   💵 Taxa horária: R$ ${hourlyRate.toFixed(4)}/h`);
        console.log(`   🎯 Garantia por dia: ${guaranteedHours}h ÷ 30 dias FIXOS = ${guaranteedHoursPerDay.toFixed(4)}h/dia`);
        
        let baseValue = 0;
        
        if (entry.is_worked) {
            const hoursWorked = (parseFloat(entry.horometer_end) || 0) - (parseFloat(entry.horometer_start) || 0);
            
            // 🔥 APLICAR GARANTIA MÍNIMA POR DIA
            const effectiveHours = Math.max(hoursWorked, guaranteedHoursPerDay);
            baseValue = effectiveHours * hourlyRate;
            
            console.log(`   ⏰ Trabalhadas: ${hoursWorked.toFixed(2)}h`);
            console.log(`   ✅ Efetivas (MAIOR): ${effectiveHours.toFixed(2)}h`);
            console.log(`   💰 Base: R$ ${baseValue.toFixed(2)}`);
        }
        
        let adjustments = 0;
        
        (entry.notes || []).forEach(note => {
            if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                const noteValue = (note.quantity || 0) * (note.value || 0);
                adjustments += noteValue;
                console.log(`   ➕ Acréscimo: R$ ${noteValue.toFixed(2)}`);
            }
        });
        
        (entry.notes || []).forEach(note => {
            if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                const noteValue = (note.quantity || 0) * (note.value || 0);
                adjustments -= noteValue;
                console.log(`   ➖ Desconto: R$ ${noteValue.toFixed(2)}`);
            }
        });
        
        if (entry.stoppages && Array.isArray(entry.stoppages)) {
            const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
            if (stoppageHours > 0) {
                const stoppageDiscount = stoppageHours * hourlyRate;
                adjustments -= stoppageDiscount;
                console.log(`   ⏸️ Paradas: ${stoppageHours.toFixed(2)}h = -R$ ${stoppageDiscount.toFixed(2)}`);
            }
        }
        
        const finalValue = baseValue + adjustments;
        console.log(`   🎯 TOTAL DIA: R$ ${finalValue.toFixed(2)}`);
        
        if (entry.daily_manual_value !== null && entry.daily_manual_value !== undefined && entry.daily_manual_value !== '') {
            const manualValue = parseFloat(entry.daily_manual_value);
            console.log(`   ⚠️ MANUAL OVERRIDE: R$ ${manualValue.toFixed(2)}`);
            return preciseRounding.round2(manualValue);
        }
        
        return preciseRounding.round2(finalValue);
    }
    
    // 🔥 MENSAL
    if (equipConfig?.measurement_type === 'monthly') {
        const monthlyValue = parseFloat(equipConfig?.measurement_value || 0);
        
        if (entry.is_worked && monthlyValue > 0) {
            const calculationType = getEffectiveMonthlyCalculationType(entry, equipConfig, work);
            
            // CORREÇÃO URGENTE: Calcular dias do mês SEMPRE com base na data da entrada
            const entryDate = new Date(entry.date + 'T00:00:00');
            const realDaysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
            
            // NOVO: Usar dias reais por padrão, só usar 30 se explicitamente configurado como fixed_30
            let daysInMonth = realDaysInMonth;
            if (calculationType === 'fixed_30') {
                daysInMonth = 30;
                console.log(`⚠️ [CALC DIÁRIO] Forçando 30 dias fixos (mês tem ${realDaysInMonth} dias reais)`);
            } else {
                console.log(`✅ [CALC DIÁRIO] Usando ${realDaysInMonth} dias reais do mês (proporcional)`);
            }
            
            const exactDailyValue = monthlyValue / daysInMonth;
            let adjustments = 0;
            
            (entry.notes || []).forEach(note => {
                if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                    adjustments += (note.quantity || 0) * (note.value || 0);
                }
            });
            
            (entry.notes || []).forEach(note => {
                if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                    adjustments -= (note.quantity || 0) * (note.value || 0);
                }
            });
            
            if (entry.stoppages && Array.isArray(entry.stoppages)) {
                const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
                if (stoppageHours > 0) {
                    const totalShiftHours = calculateTotalShiftHours(work);
                    if (totalShiftHours > 0) {
                        const hourlyRate = exactDailyValue / totalShiftHours;
                        adjustments -= stoppageHours * hourlyRate;
                    }
                }
            }
            
            const finalValue = exactDailyValue + adjustments;
            
            if (entry.daily_manual_value !== null && entry.daily_manual_value !== undefined && entry.daily_manual_value !== '') {
                return preciseRounding.round2(parseFloat(entry.daily_manual_value));
            }
            
            return preciseRounding.round2(finalValue);
        }
    }
    
    // Para outros tipos (diário, horário), usar cálculo padrão
    const baseValue = calculateDailyBaseValue(entry, equipConfig, work);
    let adjustments = 0;
    
    (entry.notes || []).forEach(note => {
        if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
            adjustments += (note.quantity || 0) * (note.value || 0);
        }
    });
    
    (entry.notes || []).forEach(note => {
        if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
            adjustments -= (note.quantity || 0) * (note.value || 0);
        }
    });
    
    if (entry.stoppages && Array.isArray(entry.stoppages)) {
        const stoppageDiscount = calculateStoppageDiscountValue(entry, equipConfig, work, false);
        adjustments -= stoppageDiscount;
    }
    
    const finalValue = baseValue + adjustments;
    
    if (entry.daily_manual_value !== null && entry.daily_manual_value !== undefined && entry.daily_manual_value !== '') {
        return preciseRounding.round2(parseFloat(entry.daily_manual_value));
    }
    
    return preciseRounding.round2(finalValue);
};




// FUNÇÃO 2: calculateDetailFooterTotal
const calculateDetailFooterTotal = (equipmentEntries, equipConfig, work, mobilizationCost = 0, demobilizationCost = 0) => {
    console.log('\n🔥🔥🔥 CALCULANDO RODAPÉ 🔥🔥🔥\n');
    
    // 🔥 HORAS DE GARANTIA
    if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        console.log('✅ Equipamento de HORAS DE GARANTIA\n');
        
        let totalDailyValues = 0;
        
        equipmentEntries.forEach(entry => {
            const dailyValue = calculateCompleteDailyValueForReport(entry, equipConfig, work);
            totalDailyValues += dailyValue;
        });
        
        console.log(`\n💰 Soma dos dias: R$ ${totalDailyValues.toFixed(2)}`);
        console.log(`🚚 + Mobilização: R$ ${(mobilizationCost || 0).toFixed(2)}`);
        console.log(`📦 + Desmobilização: R$ ${(demobilizationCost || 0).toFixed(2)}`);
        
        const finalTotal = preciseRounding.round2(totalDailyValues + mobilizationCost + demobilizationCost);
        console.log(`✅ TOTAL RODAPÉ: R$ ${finalTotal.toFixed(2)}\n`);
        
        return finalTotal;
    }
    
    // Resto do código mantido...
    if (equipConfig?.measurement_type === 'monthly') {
        const monthlyValue = parseFloat(equipConfig?.measurement_value || 0);
        const workedEntries = equipmentEntries.filter(entry => entry.is_worked);
        
        if (workedEntries.length > 0 && monthlyValue > 0) {
            const firstWorkedEntry = workedEntries[0];
            
            // DEBUG DETALHADO
            console.log(`\n🔍 [DEBUG URGENTE] Analisando cálculo mensal:`);
            console.log(`   Valor Mensal: R$ ${monthlyValue.toFixed(2)}`);
            console.log(`   Dias Trabalhados: ${workedEntries.length}`);
            console.log(`   equipConfig.monthly_calculation: "${equipConfig?.monthly_calculation || 'undefined'}"`);
            console.log(`   monthly_calculation_manual: "${firstWorkedEntry.monthly_calculation_manual || 'undefined'}"`);
            console.log(`   monthly_calculation_override: "${firstWorkedEntry.monthly_calculation_override || 'undefined'}"`);
            
            let calculationType = equipConfig?.monthly_calculation || 'proportional';
            if (firstWorkedEntry.monthly_calculation_manual) {
                calculationType = firstWorkedEntry.monthly_calculation_manual;
                console.log(`   ✓ Usando MANUAL: "${calculationType}"`);
            } else if (firstWorkedEntry.monthly_calculation_override) {
                calculationType = firstWorkedEntry.monthly_calculation_override;
                console.log(`   ✓ Usando OVERRIDE: "${calculationType}"`);
            } else {
                console.log(`   ✓ Usando CONFIG PADRÃO: "${calculationType}"`);
            }
            
            // CORREÇÃO URGENTE: Calcular dias do mês SEMPRE com base na data
            const entryDate = new Date(firstWorkedEntry.date + 'T00:00:00');
            const realDaysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
            
            // NOVO: Usar dias reais por padrão, só usar 30 se explicitamente configurado como fixed_30
            let daysInMonth = realDaysInMonth;
            if (calculationType === 'fixed_30') {
                daysInMonth = 30;
                console.log(`⚠️ [RODAPÉ] FIXO 30 dias (mês real: ${realDaysInMonth} dias)`);
            } else {
                console.log(`✅ [RODAPÉ] PROPORCIONAL ${realDaysInMonth} dias reais do mês`);
            }
            
            const exactDailyValue = monthlyValue / daysInMonth;
            const baseTotal = exactDailyValue * workedEntries.length;
            
            let totalAdjustments = 0;
            equipmentEntries.forEach(entry => {
                (entry.notes || []).forEach(note => {
                    const noteValue = (note.quantity || 0) * (note.value || 0);
                    if (note.type === 'addition' && (note.target === 'client' || note.target === 'both')) {
                        totalAdjustments += noteValue;
                    } else if (note.type === 'discount' && (note.target === 'client' || note.target === 'both')) {
                        totalAdjustments -= noteValue;
                    }
                });
                
                if (entry.stoppages && Array.isArray(entry.stoppages)) {
                    const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
                    if (stoppageHours > 0) {
                        const totalShiftHours = calculateTotalShiftHours(work);
                        if (totalShiftHours > 0) {
                            const hourlyRate = exactDailyValue / totalShiftHours;
                            totalAdjustments -= stoppageHours * hourlyRate;
                        }
                    }
                }
            });
            
            const totalDailyValues = baseTotal + totalAdjustments;
            const finalTotal = preciseRounding.round2(totalDailyValues + mobilizationCost + demobilizationCost);
            return finalTotal;
        }
    }
    
    let totalDailyValues = 0;
    equipmentEntries.forEach(entry => {
        const dailyValue = calculateCompleteDailyValueForReport(entry, equipConfig, work);
        totalDailyValues += dailyValue;
    });
    
    const finalTotal = preciseRounding.round2(totalDailyValues + mobilizationCost + demobilizationCost);
    return finalTotal;
};