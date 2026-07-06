// lancamentos_equipamentos.js - VERSÃO CORRIGIDA COM DESPESAS GERAIS - v2.0.1
console.log('📦 Lançamentos Equipamentos v2 - REPLICAR SÓ MOBILIZADOS! ✅');
console.log('🔥🔥🔥 VERSÃO ATUALIZADA: 03/02/2026 - 01:30 🔥🔥🔥');
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, getBMLabelForDate, parseCurrencyToNumber, createConfirmationModalAsync, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js';
import { 
    calculateDailyBaseValue, 
    calculateDailyBaseValueTerceirizado,
    recalculateCardValues,
    validateCalculationData,
    calculateEquipmentTotalValue,
    MEASUREMENT_TYPES
} from './calculos_valores.js?v=20260302090000';

// 🎯 ARREDONDAMENTO PRECISO (igual ao relatório) para evitar diferenças de centavos
const preciseRounding = {
    round2(value) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        return Math.round((value + Number.EPSILON) * 100) / 100;
    },
    
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
    }
};

const entryWorkSelect = document.getElementById('entry-work-select');
const entryBmSelect = document.getElementById('entry-bm-select');
const entryEquipmentSelect = document.getElementById('entry-equipment-select');
const entryStartDate = document.getElementById('entry-start-date');
const entryEndDate = document.getElementById('entry-end-date');
const generateEntriesBtn = document.getElementById('generate-entries-btn');
const entriesListContainer = document.getElementById('entries-list');
const bulkActionsContainer = document.getElementById('bulk-actions-container');
const markAllWorkedBtn = document.getElementById('mark-all-worked-btn');
const unmarkAllWorkedBtn = document.getElementById('unmark-all-worked-btn');
const saveAllEntriesBtn = document.getElementById('save-all-entries-btn');
const replicateEntriesBtn = document.getElementById('replicate-entries-btn');


// FUNÇÃO AUXILIAR: Converte horário HH:MM para minutos desde meia-noite
const timeToMinutes = (timeString) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

// FUNÇÃO AUXILIAR: Converte minutos para horário HH:MM
const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// FUNÇÃO AUXILIAR: Calcula horas efetivas de trabalho no turno (excluindo refeição)
const calculateEffectiveWorkHours = (workConfig, isNightShift = false) => {
    let shiftStart, shiftEnd, mealStart, mealEnd;
    
    if (isNightShift) {
        shiftStart = timeToMinutes(workConfig.night_shift_start || '18:00');
        shiftEnd = timeToMinutes(workConfig.night_shift_end || '04:00');
        mealStart = timeToMinutes(workConfig.night_meal_start || '22:00');
        mealEnd = timeToMinutes(workConfig.night_meal_end || '23:00');
    } else {
        shiftStart = timeToMinutes(workConfig.day_shift_start || '07:00');
        shiftEnd = timeToMinutes(workConfig.day_shift_end || '17:00');
        mealStart = timeToMinutes(workConfig.day_meal_start || '12:00');
        mealEnd = timeToMinutes(workConfig.day_meal_end || '13:00');
    }
    
    // Tratar turnos que passam da meia-noite
    if (shiftEnd < shiftStart) {
        shiftEnd += 24 * 60; // Adiciona 24 horas
    }
    
    if (mealEnd < mealStart) {
        mealEnd += 24 * 60;
    }
    
    const totalShiftMinutes = shiftEnd - shiftStart;
    const mealMinutes = mealEnd - mealStart;
    const effectiveWorkMinutes = totalShiftMinutes - mealMinutes;
    
    return {
        shiftStart,
        shiftEnd,
        mealStart,
        mealEnd,
        effectiveWorkHours: effectiveWorkMinutes / 60,
        effectiveWorkMinutes
    };
};

// FUNÇÃO AUXILIAR: Calcula minutos efetivos de parada (excluindo refeição)
const calculateEffectiveStoppageMinutes = (stoppageStart, stoppageEnd, workShift) => {
    let startMinutes = stoppageStart;
    let endMinutes = stoppageEnd;
    
    // Se fim menor que início, assumir que passou da meia-noite
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
    }
    
    // Garantir que a parada esteja dentro do turno de trabalho
    startMinutes = Math.max(startMinutes, workShift.shiftStart);
    endMinutes = Math.min(endMinutes, workShift.shiftEnd);
    
    if (startMinutes >= endMinutes) {
        return 0; // Parada fora do turno
    }
    
    let effectiveStoppageMinutes = endMinutes - startMinutes;
    
    // Subtrair tempo de refeição se a parada incluir o horário de refeição
    const mealStart = workShift.mealStart;
    const mealEnd = workShift.mealEnd;
    
    if (startMinutes < mealEnd && endMinutes > mealStart) {
        // A parada sobrepõe o horário de refeição
        const overlapStart = Math.max(startMinutes, mealStart);
        const overlapEnd = Math.min(endMinutes, mealEnd);
        const mealOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
        effectiveStoppageMinutes -= mealOverlapMinutes;
    }
    
    return Math.max(0, effectiveStoppageMinutes);
};

// FUNÇÃO: Atualizar badges de alerta dinamicamente
const updateAlertBadges = (card) => {
    const alertBadgesContainer = card.querySelector('.alert-badges-container');
    if (!alertBadgesContainer) return;
    
    const alertBadges = [];
    const equipmentId = parseInt(card.dataset.equipmentId);
    const entryDate = card.dataset.date;
    const workId = parseInt(card.dataset.workId);
    
    // Buscar configurações
    const work = appState.works.find(w => w.id == workId);
    const equipConfig = work?.config?.equipment?.find(ec => parseInt(ec.equipment_id) == equipmentId);
    const equipment = appState.equipment.find(e => e.id == equipmentId);
    
    console.log('🔍 DEBUG BUSCA CONFIG:', {
        workId,
        equipmentId,
        hasWork: !!work,
        hasEquipConfig: !!equipConfig,
        allEquipConfigs: work?.config?.equipment?.map(ec => ({id: ec.equipment_id, type: typeof ec.equipment_id}))
    });
    
    // 🔥 1. PARADAS COM TEMPO E VALOR DE DESCONTO
    const stoppagesContainer = card.querySelector('.stoppages-container');
    if (stoppagesContainer) {
        const stoppageRows = Array.from(stoppagesContainer.querySelectorAll('.form-grid')).filter(row => {
            const typeSelect = row.querySelector('.stoppage-type');
            return typeSelect && typeSelect.value;
        });
        
        if (stoppageRows.length > 0) {
            let totalStoppageMinutes = 0;
            let totalStoppageDiscount = 0;
            
            // Determinar tarifa horária
            let hourlyRate = 0;
            if (equipConfig) {
                const measurementType = equipConfig.measurement_type;
                if (measurementType === 'guaranteed_hours') {
                    // Para garantia de horas, calcular taxa = valor mensal / horas garantidas
                    const monthlyValue = parseFloat(equipConfig.measurement_value) || 0;
                    const guaranteedHours = parseFloat(equipConfig.guaranteed_hours) || 200;
                    hourlyRate = monthlyValue / guaranteedHours;
                } else if (measurementType === 'hourly' && equipConfig.measurement_value) {
                    hourlyRate = parseFloat(equipConfig.measurement_value) || 0;
                } else if (measurementType === 'daily' && equipConfig.measurement_value) {
                    hourlyRate = (parseFloat(equipConfig.measurement_value) || 0) / 8;
                } else if (measurementType === 'monthly' && equipConfig.measurement_value) {
                    hourlyRate = (parseFloat(equipConfig.measurement_value) || 0) / 200;
                }
            }
            
            console.log('🔍 DEBUG BADGES - Configuração:', {
                equipmentId,
                measurementType: equipConfig?.measurement_type,
                measurement_value: equipConfig?.measurement_value,
                guaranteed_hours: equipConfig?.guaranteed_hours,
                hourlyRate,
                deductibleStoppages: equipConfig?.deductible_stoppages
            });
            
            stoppageRows.forEach(row => {
                const stoppageTypeId = row.querySelector('.stoppage-type')?.value;
                const startTime = row.querySelector('.stoppage-start')?.value;
                const endTime = row.querySelector('.stoppage-end')?.value;
                const hoursHHMM = row.querySelector('.stoppage-hours-hhmm')?.value;
                const hoursDecimal = row.querySelector('.stoppage-hours-decimal')?.value;
                
                let stoppageMinutes = 0;
                
                // Prioridade 1: Decimal
                if (hoursDecimal && hoursDecimal.trim() !== '') {
                    const decimal = parseFloat(hoursDecimal.replace(',', '.'));
                    if (!isNaN(decimal)) {
                        stoppageMinutes = decimal * 60;
                    }
                }
                // Prioridade 2: HH:MM
                else if (hoursHHMM && hoursHHMM.trim() !== '') {
                    const parts = hoursHHMM.split(':');
                    if (parts.length === 2) {
                        const hours = parseInt(parts[0]) || 0;
                        const minutes = parseInt(parts[1]) || 0;
                        stoppageMinutes = (hours * 60) + minutes;
                    }
                }
                // Prioridade 3: Start/End com lógica especial para campos vazios
                else {
                    const workConfig = work?.config || {};
                    const shiftStart = workConfig.day_shift_start || '07:00';
                    const shiftEnd = workConfig.day_shift_end || '17:00';
                    const mealStartStr = workConfig.day_meal_start || '';
                    const mealEndStr = workConfig.day_meal_end || '';

                    // Helper: subtrai interseção com horário de refeição (em minutos)
                    const subtractMeal = (startMin, endMin) => {
                        if (!mealStartStr || !mealEndStr) return endMin - startMin;
                        const mStart = timeToMinutes(mealStartStr);
                        const mEnd = timeToMinutes(mealEndStr);
                        const interStart = Math.max(startMin, mStart);
                        const interEnd = Math.min(endMin, mEnd);
                        const intersection = Math.max(0, interEnd - interStart);
                        return (endMin - startMin) - intersection;
                    };

                    if (!startTime && !endTime) {
                        // Ambos vazios = parada o dia todo (turno inteiro)
                        const start = timeToMinutes(shiftStart);
                        const end = timeToMinutes(shiftEnd);
                        stoppageMinutes = subtractMeal(start, end);
                    } else if (!startTime && endTime) {
                        // Só fim preenchido = do início do turno até o fim informado
                        const start = timeToMinutes(shiftStart);
                        const end = timeToMinutes(endTime);
                        let raw = end - start;
                        if (raw < 0) raw += 24 * 60;
                        stoppageMinutes = subtractMeal(start, start + raw);
                    } else if (startTime && !endTime) {
                        // Só início preenchido = do início informado até fim do turno
                        const start = timeToMinutes(startTime);
                        const end = timeToMinutes(shiftEnd);
                        let raw = end - start;
                        if (raw < 0) raw += 24 * 60;
                        stoppageMinutes = subtractMeal(start, start + raw);
                    } else if (startTime && endTime) {
                        // Ambos preenchidos: subtrai horário de almoço se sobreposto
                        const start = timeToMinutes(startTime);
                        const end = timeToMinutes(endTime);
                        let raw = end - start;
                        if (raw < 0) raw += 24 * 60;
                        stoppageMinutes = subtractMeal(start, start + raw);
                    }
                }
                
                totalStoppageMinutes += stoppageMinutes;
                
                // Calcular desconto se for parada dedutível
                console.log('🔍 DEBUG PARADA:', {
                    stoppageTypeId,
                    stoppageMinutes,
                    stoppageHours: (stoppageMinutes / 60).toFixed(2),
                    hourlyRate,
                    calculatedDiscount: ((stoppageMinutes / 60) * hourlyRate).toFixed(2),
                    isDeductible: equipConfig?.deductible_stoppages?.includes(stoppageTypeId?.toString()),
                    deductibleList: equipConfig?.deductible_stoppages
                });
                
                if (equipConfig?.deductible_stoppages?.includes(stoppageTypeId?.toString())) {
                    const discountValue = (stoppageMinutes / 60) * hourlyRate;
                    totalStoppageDiscount += discountValue;
                    console.log('✅ DESCONTO CALCULADO:', discountValue);
                }
            });
            
            const hours = Math.floor(totalStoppageMinutes / 60);
            const mins = totalStoppageMinutes % 60;
            const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            
            let badge = `⚠️ PARADA - ${timeStr}`;
            if (totalStoppageDiscount > 0) {
                badge += ` - DESCONTO: ${formatCurrency(totalStoppageDiscount)}`;
            }
            if (stoppageRows.length > 1) badge += ` (${stoppageRows.length})`;
            
            alertBadges.push(`<span class="alert-badge alert-badge-stoppage">${badge}</span>`);
        }
    }
    
    // 🔥 2. OBSERVAÇÕES/DESPESAS/ACRÉSCIMOS COM VALORES
    const notesContainer = card.querySelector('.notes-container');
    if (notesContainer) {
        const noteRows = Array.from(notesContainer.querySelectorAll('.form-grid'));
        
        let obsValue = 0, obsCount = 0;
        let expenseValue = 0, expenseCount = 0;
        let additionValue = 0, additionCount = 0;
        
        noteRows.forEach(row => {
            const noteTypeSelect = row.querySelector('.note-type');
            const valueInput = row.querySelector('.note-value');
            const value = parseFloat(valueInput?.value) || 0;
            
            if (noteTypeSelect && noteTypeSelect.value) {
                if (noteTypeSelect.value === 'observation') {
                    obsCount++;
                    obsValue += value;
                } else if (noteTypeSelect.value === 'expense') {
                    expenseCount++;
                    expenseValue += value;
                } else if (noteTypeSelect.value === 'addition') {
                    additionCount++;
                    additionValue += value;
                }
            }
        });
        
        if (obsCount > 0) {
            let badge = '📝 OBSERVAÇÃO';
            if (obsValue > 0) badge += ` ACRÉSCIMO: ${formatCurrency(obsValue)}`;
            else badge += ' REGISTRADA';
            if (obsCount > 1) badge += ` (${obsCount})`;
            alertBadges.push(`<span class="alert-badge alert-badge-observacao">${badge}</span>`);
        }
        
        if (expenseCount > 0) {
            let badge = '💰 DESPESA';
            if (expenseValue > 0) badge += ` DESCONTO: ${formatCurrency(expenseValue)}`;
            else badge += ' REGISTRADA';
            if (expenseCount > 1) badge += ` (${expenseCount})`;
            alertBadges.push(`<span class="alert-badge alert-badge-despesa">${badge}</span>`);
        }
        
        if (additionCount > 0) {
            let badge = '➕ ACRÉSCIMO';
            if (additionValue > 0) badge += `: ${formatCurrency(additionValue)}`;
            else badge += ' REGISTRADO';
            if (additionCount > 1) badge += ` (${additionCount})`;
            alertBadges.push(`<span class="alert-badge alert-badge-acrescimo">${badge}</span>`);
        }
    }
    
    // 🔥 3. MOBILIZAÇÃO/DESMOBILIZAÇÃO
    const isMobilizing = card.querySelector('.mobilize-check')?.checked;
    const isDemobilizing = card.querySelector('.demobilize-check')?.checked;
    
    if (isMobilizing) {
        alertBadges.push(`<span class="alert-badge alert-badge-mobilizacao">🚛 MOBILIZAÇÃO</span>`);
    }
    if (isDemobilizing) {
        alertBadges.push(`<span class="alert-badge alert-badge-desmobilizacao">🏁 DESMOBILIZAÇÃO</span>`);
    }
    
    // 🔥 4. AVARIAS COM VALOR E TIPO (ACRÉSCIMO/DESCONTO)
    if (equipmentId && entryDate && appState.damages) {
        const damages = appState.damages.filter(damage => {
            if (damage.equipment_id != equipmentId || damage.damage_date !== entryDate) {
                return false;
            }
            const hasClientImpact = damage.client_impact_type === 'add_client' || damage.client_impact_type === 'disc_client';
            const hasThirdPartyImpact = damage.terceirizado_impact_type === 'add_terceirizado' || damage.terceirizado_impact_type === 'disc_terceirizado';
            return hasClientImpact || hasThirdPartyImpact;
        });
        
        if (damages.length > 0) {
            let totalAddition = 0, totalDiscount = 0;
            
            damages.forEach(damage => {
                const value = parseFloat(damage.total_value) || 0;
                if (damage.client_impact_type === 'add_client') {
                    totalAddition += value;
                } else if (damage.client_impact_type === 'disc_client') {
                    totalDiscount += value;
                }
            });
            
            let badge = '🔧 AVARIA';
            if (totalAddition > 0) badge += ` ACRÉSCIMO: ${formatCurrency(totalAddition)}`;
            else if (totalDiscount > 0) badge += ` DESCONTO: ${formatCurrency(totalDiscount)}`;
            if (damages.length > 1) badge += ` (${damages.length})`;
            
            alertBadges.push(`<span class="alert-badge alert-badge-avaria">${badge}</span>`);
        }
    }
    
    // 🔥 5. DESPESAS DO EQUIPAMENTO COM TIPO
    if (equipmentId && entryDate && appState.expenses && workId) {
        const equipmentExpenses = appState.expenses.filter(exp => 
            exp.work_id == workId &&
            exp.equipment_id == equipmentId &&
            exp.date === entryDate
        );
        
        if (equipmentExpenses.length > 0) {
            let totalAddition = 0, totalDiscount = 0;
            
            equipmentExpenses.forEach(exp => {
                const value = parseFloat(exp.impacto_cliente_total) || 0;
                if (exp.measurement_impact === 'add_client') {
                    totalAddition += value;
                } else if (exp.measurement_impact === 'disc_client') {
                    totalDiscount += value;
                }
            });
            
            let badge = '💼 DESPESA EQUIP.';
            if (totalAddition > 0) badge += ` ACRÉSCIMO: ${formatCurrency(totalAddition)}`;
            else if (totalDiscount > 0) badge += ` DESCONTO: ${formatCurrency(totalDiscount)}`;
            if (equipmentExpenses.length > 1) badge += ` (${equipmentExpenses.length})`;
            
            alertBadges.push(`<span class="alert-badge alert-badge-equipment-expense" style="background-color: #DC143C; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; display: inline-block; margin: 2px;">${badge}</span>`);
        }
    }
    
    // Atualizar HTML
    alertBadgesContainer.innerHTML = alertBadges.join('');
};

// FUNÇÃO: Buscar último horímetro registrado antes de uma data
const getLastHorometer = (equipmentId, currentDate) => {
    if (!appState.daily_entries || appState.daily_entries.length === 0) {
        return null;
    }
    
    // Filtrar entries do mesmo equipamento e antes da data atual
    const previousEntries = appState.daily_entries
        .filter(entry => 
            entry.equipment_id == equipmentId && 
            entry.date < currentDate
        )
        .sort((a, b) => b.date.localeCompare(a.date)); // Mais recente primeiro
    
    if (previousEntries.length === 0) {
        return null;
    }
    
    // Pegar o entry mais recente
    const lastEntry = previousEntries[0];
    
    // Priorizar horímetro final, se não tiver usar inicial
    const horometer = parseFloat(lastEntry.horometer_end) || parseFloat(lastEntry.horometer_start) || null;
    
    if (horometer) {
        return {
            date: lastEntry.date,
            value: horometer,
            type: lastEntry.horometer_end ? 'final' : 'inicial'
        };
    }
    
    return null;
};

// FUNÇÃO: Buscar último KM registrado antes de uma data
const getLastKm = (equipmentId, currentDate) => {
    if (!appState.daily_entries || appState.daily_entries.length === 0) {
        return null;
    }
    
    // Filtrar entries do mesmo equipamento e antes da data atual
    const previousEntries = appState.daily_entries
        .filter(entry => 
            entry.equipment_id == equipmentId && 
            entry.date < currentDate
        )
        .sort((a, b) => b.date.localeCompare(a.date)); // Mais recente primeiro
    
    if (previousEntries.length === 0) {
        return null;
    }
    
    // Pegar o entry mais recente
    const lastEntry = previousEntries[0];
    
    // Priorizar KM final, se não tiver usar inicial
    const km = parseFloat(lastEntry.km_end) || parseFloat(lastEntry.km_start) || null;
    
    if (km) {
        return {
            date: lastEntry.date,
            value: km,
            type: lastEntry.km_end ? 'final' : 'inicial'
        };
    }
    
    return null;
};


export const initDailyEntries = async () => {
    showSpinner();
    
    try {
        // CORREÇÃO: Garantir que TODOS os dados necessários sejam carregados sempre
        if (appState.works.length === 0 || 
            !appState.equipment || appState.equipment.length === 0 ||
            !appState.employees || appState.employees.length === 0 ||
            !appState.stoppage_types || appState.stoppage_types.length === 0 ||
            !appState.terceirizados ||
            !appState.damages) {
            
            console.log('🔄 Carregando dados necessários para lançamentos...');
            
            // Carregar dados em paralelo para melhor performance
            const [works, equipment, employees, stoppageTypes, terceirizados, damages] = await Promise.all([
                apiClient.fetchData('works', '*, client_companies(name), my_companies(name)'),
                apiClient.fetchData('equipment'),
                apiClient.fetchData('employees'),
                apiClient.fetchData('stoppage_types'),
                apiClient.fetchData('terceirizados'),
                apiClient.fetchData('damages')
            ]);
            
            appState.works = works;
            appState.equipment = equipment;
            appState.employees = employees;
            appState.stoppage_types = stoppageTypes;
            appState.terceirizados = terceirizados;
            appState.damages = damages || [];
            
            console.log('✅ Dados carregados:', {
                obras: works.length,
                equipamentos: equipment.length, 
                funcionarios: employees.length,
                tiposParada: stoppageTypes.length,
                terceirizados: terceirizados.length,
                avarias: (damages || []).length
            });
        }

            // ✅ PRIMEIRO: Registrar todos os event listeners ANTES de restaurar a obra
            if (entryBmSelect) {
                entryBmSelect.innerHTML = '<option value="">Selecione o Período</option>';
                entryBmSelect.addEventListener('change', handleBmSelectChange);
            }
            
            if (entryEquipmentSelect) {
                entryEquipmentSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
                entryEquipmentSelect.addEventListener('change', handleEquipmentSelectChange);
            }
            
            // ✅ DEPOIS: Configurar o combobox de obras (com ordenação alfabética)
            if (entryWorkSelect) {
                // Ordenar obras alfabeticamente por nome
                const sortedWorks = [...appState.works].sort((a, b) => {
                    const nameA = (a.name || '').toUpperCase();
                    const nameB = (b.name || '').toUpperCase();
                    return nameA.localeCompare(nameB);
                });
                
                entryWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
                    sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
                
                entryWorkSelect.addEventListener('change', handleWorkSelectChange);
                
                // ✅ POR ÚLTIMO: Restaurar a obra selecionada anteriormente (se existir)
                const savedWorkId = sessionStorage.getItem('selectedWorkIdLancamentos');
                if (savedWorkId && sortedWorks.find(w => w.id == savedWorkId)) {
                    entryWorkSelect.value = savedWorkId;
                    // Acionar a função para preencher os campos relacionados
                    handleWorkSelectChange();
                    
                    // ✅ NOVO: Executar automaticamente a busca do período após restaurar tudo
                    // Aguardar um momento para garantir que todos os campos foram preenchidos
                    setTimeout(() => {
                        const startDate = entryStartDate?.value;
                        const endDate = entryEndDate?.value;
                        const equipmentId = entryEquipmentSelect?.value;
                        
                        // Se todos os campos necessários estiverem preenchidos, executar a busca automaticamente
                        if (startDate && endDate && savedWorkId && equipmentId) {
                            console.log('🔄 Restaurando período automaticamente...');
                            handleGenerateEntries();
                        }
                    }, 100);
                }
            }
        
        if (generateEntriesBtn) {
            generateEntriesBtn.addEventListener('click', handleGenerateEntries);
        }
        
        if (markAllWorkedBtn) {
            markAllWorkedBtn.addEventListener('click', handleMarkAllWorked);
        }
        
        if (unmarkAllWorkedBtn) {
            unmarkAllWorkedBtn.addEventListener('click', handleUnmarkAllWorked);
        }
        
        if (saveAllEntriesBtn) {
            saveAllEntriesBtn.addEventListener('click', handleSaveAllEntries);
        }
        
        if (replicateEntriesBtn) {
            replicateEntriesBtn.addEventListener('click', handleReplicateEntries);
        }

        if (entriesListContainer) {
            entriesListContainer.innerHTML = '';
        }
        
        if (bulkActionsContainer) {
            bulkActionsContainer.style.display = 'none';
        }

        console.log('✅ Lançamentos de equipamentos inicializados com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao inicializar lançamentos:', error);
        alert('Erro ao carregar dados necessários para lançamentos. Verifique sua conexão.');
    } finally {
        hideSpinner();
    }
    
    // ==================== AÇÕES EM MASSA ====================
    setupMassActions();
};

// ==================== SETUP DE AÇÕES EM MASSA ====================
const setupMassActions = () => {
    // Popula tipos de parada
    const bulkStoppageTypeSelect = document.getElementById('bulk-stoppage-type');
    if (bulkStoppageTypeSelect && appState.stoppage_types) {
        bulkStoppageTypeSelect.innerHTML = '<option value="">Selecione...</option>';
        appState.stoppage_types.forEach(st => {
            bulkStoppageTypeSelect.innerHTML += `<option value="${st.id}">${st.name}</option>`;
        });
    }
    
    // Event listeners para mostrar/ocultar lista de equipamentos
    document.getElementById('bulk-note-target')?.addEventListener('change', (e) => {
        const list = document.getElementById('bulk-note-equipment-list');
        if (e.target.value === 'selected') {
            list.style.display = 'block';
            populateEquipmentCheckboxes('bulk-note-equipment-list');
        } else {
            list.style.display = 'none';
        }
    });
    
    document.getElementById('bulk-stoppage-target')?.addEventListener('change', (e) => {
        const list = document.getElementById('bulk-stoppage-equipment-list');
        if (e.target.value === 'selected') {
            list.style.display = 'block';
            populateEquipmentCheckboxes('bulk-stoppage-equipment-list');
        } else {
            list.style.display = 'none';
        }
    });
    
    // Botões de gerar
    document.getElementById('bulk-note-generate-btn')?.addEventListener('click', handleBulkNotes);
    document.getElementById('bulk-stoppage-generate-btn')?.addEventListener('click', handleBulkStoppages);
};

const populateEquipmentCheckboxes = async (containerId) => {
    const container = document.getElementById(containerId);
    const workId = entryWorkSelect?.value;
    
    if (!container || !workId) return;

    // Garante que equipment_types esteja carregado para getEquipTypeName()
    if (!appState.equipment_types || appState.equipment_types.length === 0) {
        appState.equipment_types = await apiClient.fetchData('equipment_types', 'id, name, short_name');
    }
    
    const work = appState.works.find(w => w.id == workId);
    const equipmentConfigs = work?.config?.equipment || [];
    
    if (equipmentConfigs.length === 0) {
        container.innerHTML = '<p style="color: #888;">Nenhum equipamento cadastrado na obra</p>';
        return;
    }
    
    container.innerHTML = equipmentConfigs.map(ec => {
        const equip = appState.equipment.find(e => e.id == ec.equipment_id);
        if (!equip) return '';
        return `
            <label style="display: block; padding: 5px; cursor: pointer; color: #fff;">
                <input type="checkbox" value="${equip.id}" style="margin-right: 8px;">
                ${equip.prefix} - ${getEquipTypeName(equip.type)}
            </label>
        `;
    }).join('');
};

const handleBulkNotes = async () => {
    const noteText = document.getElementById('bulk-note-text')?.value.trim();
    const startDate = document.getElementById('bulk-note-start-date')?.value;
    const endDate = document.getElementById('bulk-note-end-date')?.value || startDate;
    const target = document.getElementById('bulk-note-target')?.value;
    const workId = entryWorkSelect?.value;
    
    if (!noteText || !startDate || !workId) {
        alert('Preencha a observação e a data inicial!');
        return;
    }
    
    let equipmentIds = [];
    
    if (target === 'all') {
        const work = appState.works.find(w => w.id == workId);
        equipmentIds = work?.config?.equipment?.map(ec => ec.equipment_id) || [];
    } else {
        const checkboxes = document.querySelectorAll('#bulk-note-equipment-list input[type="checkbox"]:checked');
        equipmentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    if (equipmentIds.length === 0) {
        alert('Nenhum equipamento selecionado!');
        return;
    }
    
    const confirm = window.confirm(
        `Adicionar observação "${noteText}" em ${equipmentIds.length} equipamento(s) de ${startDate} até ${endDate}?`
    );
    
    if (!confirm) return;
    
    showSpinner();
    
    try {
        let updatedCount = 0;
        
        // Para cada equipamento
        for (const equipId of equipmentIds) {
            // Buscar entries no intervalo
            const entries = await apiClient.fetchDailyEntries(workId, equipId, startDate, endDate);
            const entriesMap = new Map(entries.map(e => [e.date, e]));
            
            // Para cada data no intervalo
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                let entry = entriesMap.get(dateStr);
                
                if (entry) {
                    // Entry existe - adicionar nota
                    const notes = entry.notes || [];
                    const noteObj = {
                        type: 'observation',
                        description: noteText,
                        quantity: 1,
                        value: 0,
                        target: 'both',
                        hide_in_report: false,
                        hide_in_pdf: false
                    };
                    
                    // Verificar se já existe essa observação
                    const alreadyHas = notes.some(n => 
                        typeof n === 'object' && n.description === noteText && n.type === 'observation'
                    );
                    
                    if (!alreadyHas) {
                        notes.push(noteObj);
                        entry.notes = notes;
                        await apiClient.upsertItem('daily_entries', entry);
                        updatedCount++;
                    }
                } else {
                    // Entry não existe - criar com nota
                    const work = appState.works.find(w => w.id == workId);
                    const noteObj = {
                        type: 'observation',
                        description: noteText,
                        quantity: 1,
                        value: 0,
                        target: 'both',
                        hide_in_report: false,
                        hide_in_pdf: false
                    };
                    
                    const newEntry = {
                        work_id: workId,
                        equipment_id: equipId,
                        date: dateStr,
                        bm_label: getBMLabelForDate(dateStr, work?.config?.measurement_periods),
                        is_worked: false,
                        notes: [noteObj],
                        stoppages: [],
                        daily_total_value: 0,
                        daily_total_value_terceirizado: 0
                    };
                    await apiClient.upsertItem('daily_entries', newEntry);
                    updatedCount++;
                }
            }
        }
        
        alert(`✅ Observação adicionada com sucesso em ${updatedCount} lançamento(s)!`);
        
        // Recarregar se estiver visualizando
        const currentEquipId = entryEquipmentSelect?.value;
        const currentStart = entryStartDate?.value;
        const currentEnd = entryEndDate?.value;
        
        if (currentEquipId && currentStart && currentEnd) {
            await displayPeriodEntries(workId, currentEquipId, currentStart, currentEnd);
        }
        
    } catch (error) {
        console.error('❌ Erro ao adicionar observações:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const handleBulkStoppages = async () => {
    const stoppageTypeId = parseInt(document.getElementById('bulk-stoppage-type')?.value);
    const startDate = document.getElementById('bulk-stoppage-start-date')?.value;
    const endDate = document.getElementById('bulk-stoppage-end-date')?.value || startDate;
    const target = document.getElementById('bulk-stoppage-target')?.value;
    const workId = entryWorkSelect?.value;
    
    if (!stoppageTypeId || !startDate || !workId) {
        alert('Selecione o tipo de parada e a data inicial!');
        return;
    }
    
    const stoppageType = appState.stoppage_types.find(st => st.id === stoppageTypeId);
    if (!stoppageType) {
        alert('Tipo de parada não encontrado!');
        return;
    }
    
    let equipmentIds = [];
    
    if (target === 'all') {
        const work = appState.works.find(w => w.id == workId);
        equipmentIds = work?.config?.equipment?.map(ec => ec.equipment_id) || [];
    } else {
        const checkboxes = document.querySelectorAll('#bulk-stoppage-equipment-list input[type="checkbox"]:checked');
        equipmentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    if (equipmentIds.length === 0) {
        alert('Nenhum equipamento selecionado!');
        return;
    }
    
    const confirm = window.confirm(
        `Adicionar parada "${stoppageType.name}" em ${equipmentIds.length} equipamento(s) de ${startDate} até ${endDate}?`
    );
    
    if (!confirm) return;
    
    showSpinner();
    
    try {
        let updatedCount = 0;
        
        // Para cada equipamento
        for (const equipId of equipmentIds) {
            // Buscar entries no intervalo
            const entries = await apiClient.fetchDailyEntries(workId, equipId, startDate, endDate);
            const entriesMap = new Map(entries.map(e => [e.date, e]));
            
            // Para cada data no intervalo
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                let entry = entriesMap.get(dateStr);
                
                if (entry) {
                    // Entry existe - adicionar parada
                    const stoppages = entry.stoppages || [];
                    const alreadyHas = stoppages.some(s => 
                        (s.type_id?.toString() === stoppageTypeId.toString()) || 
                        (s.stoppage_type_id?.toString() === stoppageTypeId.toString())
                    );
                    
                    if (!alreadyHas) {
                        stoppages.push({
                            type_id: stoppageTypeId.toString(),
                            start: null,
                            end: null,
                            hours_hhmm: null,
                            hours_decimal: null
                        });
                        entry.stoppages = stoppages;
                        await apiClient.upsertItem('daily_entries', entry);
                        updatedCount++;
                    }
                } else {
                    // Entry não existe - criar com parada
                    const work = appState.works.find(w => w.id == workId);
                    const newEntry = {
                        work_id: workId,
                        equipment_id: equipId,
                        date: dateStr,
                        bm_label: getBMLabelForDate(dateStr, work?.config?.measurement_periods),
                        is_worked: false,
                        notes: [],
                        stoppages: [{
                            type_id: stoppageTypeId.toString(),
                            start: null,
                            end: null,
                            hours_hhmm: null,
                            hours_decimal: null
                        }],
                        daily_total_value: 0,
                        daily_total_value_terceirizado: 0
                    };
                    await apiClient.upsertItem('daily_entries', newEntry);
                    updatedCount++;
                }
            }
        }
        
        alert(`✅ Parada adicionada com sucesso em ${updatedCount} lançamento(s)!`);
        
        // Recarregar se estiver visualizando
        const currentEquipId = entryEquipmentSelect?.value;
        const currentStart = entryStartDate?.value;
        const currentEnd = entryEndDate?.value;
        
        if (currentEquipId && currentStart && currentEnd) {
            await displayPeriodEntries(workId, currentEquipId, currentStart, currentEnd);
        }
        
    } catch (error) {
        console.error('❌ Erro ao adicionar paradas:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

const handleMarkAllWorked = () => {
    document.querySelectorAll('#entries-list .entry-card .is-worked-check').forEach(chk => {
        if (!chk.checked) {
            chk.checked = true;
            chk.dispatchEvent(new Event('change'));
        }
    });
};

const handleUnmarkAllWorked = () => {
    document.querySelectorAll('#entries-list .entry-card .is-worked-check').forEach(chk => {
        if (chk.checked) {
            chk.checked = false;
            chk.dispatchEvent(new Event('change'));
        }
    });
};

/**
 * 🎯 Determina o status de mobilização de um equipamento no período da BM
 * @returns {Object} { status: 'mobilized'|'never_mobilized'|'demobilized', lastMobilizationDate: string|null }
 */
const getEquipmentMobilizationStatus = async (equipmentId, workId, startDate, endDate) => {
    try {
        // 🔧 BUSCAR DESDE O INÍCIO DO PROJETO até o INÍCIO DO PERÍODO DA BM
        // Assim detectamos desmobilizações que ocorreram ANTES do período da BM começar
        const allEntriesBeforeBm = appState.daily_entries.filter(e => 
            e.work_id == workId && 
            e.equipment_id == equipmentId &&
            e.date < startDate  // ANTES do início da BM
        ).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 🔧 BUSCAR ENTRIES DURANTE A BM
        const entriesDuringBm = appState.daily_entries.filter(e => 
            e.work_id == workId && 
            e.equipment_id == equipmentId &&
            e.date >= startDate &&
            e.date <= endDate
        ).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const allEntries = [...allEntriesBeforeBm, ...entriesDuringBm];
        
        // 🔍 BUSCAR EQUIPAMENTO NO APPSTATE PARA LOG
        const equipment = appState.equipment.find(eq => eq.id == equipmentId);
        const equipPrefix = equipment?.prefix || equipmentId;
        
        console.log(`🔍 [${equipPrefix}] Status para equipamento ${equipmentId}: ${allEntriesBeforeBm.length} entries antes BM (< ${startDate}) + ${entriesDuringBm.length} durante BM (${startDate} a ${endDate}) = ${allEntries.length} total`);
        
        if (!allEntries || allEntries.length === 0) {
            console.log(`⚪ [${equipPrefix}] Nunca mobilizado (sem entries)`);
            return { status: 'never_mobilized', lastMobilizationDate: null };
        }
        
        // Verificar se TEM alguma desmobilização marcada (em qualquer período)
        const hasDemobilization = allEntries.some(e => e.is_demobilized);
        const hasMobilization = allEntries.some(e => e.is_mobilization);
        const hasWorked = allEntries.some(e => e.is_worked);
        
        // 🔍 LISTAR TODAS AS DESMOBILIZAÇÕES
        const demobEntries = allEntries.filter(e => e.is_demobilized);
        if (demobEntries.length > 0) {
            console.log(`   [${equipPrefix}] 🔴 Desmobilizações encontradas:`, demobEntries.map(e => e.date).join(', '));
        }
        
        console.log(`   [${equipPrefix}] Desmob: ${hasDemobilization}, Mob: ${hasMobilization}, Trabalhou: ${hasWorked}`);
        
        // Encontrar última mobilização
        let lastMobilizationDate = null;
        for (let i = allEntries.length - 1; i >= 0; i--) {
            if (allEntries[i].is_mobilization) {
                lastMobilizationDate = allEntries[i].date;
                break;
            }
        }
        
        // 🔴 DESMOBILIZADO: Se tem desmobilização E não trabalhou DURANTE O PERÍODO DA BM
        if (hasDemobilization) {
            // Encontrar data da última desmobilização (ANTES ou DURANTE a BM)
            let lastDemobDate = null;
            for (let i = allEntries.length - 1; i >= 0; i--) {
                if (allEntries[i].is_demobilized) {
                    lastDemobDate = allEntries[i].date;
                    break;
                }
            }
            
            console.log(`   [${equipPrefix}] 🔴 Última desmobilização: ${lastDemobDate}`);
            
            // 🎯 NOVA LÓGICA: Verificar se trabalhou DURANTE O PERÍODO DA BM (não antes!)
            const workedDuringBm = entriesDuringBm.some(e => e.is_worked || e.is_mobilization);
            
            if (workedDuringBm) {
                const workDates = entriesDuringBm
                    .filter(e => e.is_worked || e.is_mobilization)
                    .map(e => e.date)
                    .join(', ');
                console.log(`   [${equipPrefix}] 🟢 TRABALHOU NO PERÍODO DA BM: ${workDates}`);
            } else {
                console.log(`   [${equipPrefix}] 🔴 DESMOBILIZADO - Não trabalhou no período da BM (${startDate} a ${endDate})`);
                return { status: 'demobilized', lastMobilizationDate };
            }
        }
        
        // 🟢 MOBILIZADO: Se trabalhou OU foi mobilizado
        if (hasMobilization || hasWorked) {
            console.log(`   [${equipPrefix}] 🟢 MOBILIZADO`);
            return { status: 'mobilized', lastMobilizationDate };
        }
        
        // ⚪ Nunca mobilizado
        console.log(`   [${equipPrefix}] ⚪ Nunca mobilizado`);
        return { status: 'never_mobilized', lastMobilizationDate: null };
        
    } catch (error) {
        console.error('❌ Erro ao verificar status de mobilização:', error);
        return { status: 'never_mobilized', lastMobilizationDate: null };
    }
};

// 🎯 Função para ordenar equipamentos por status de mobilização (mobilizados primeiro)
const sortEquipmentsByMobilizationStatus = async (equipmentList, workId, startDate, endDate, equipmentInWork) => {
    let equipmentsWithStatus = [];
    
    if (startDate && endDate) {
        equipmentsWithStatus = await Promise.all(
            equipmentList.map(async (equip) => {
                const status = await getEquipmentMobilizationStatus(
                    equip.id,
                    workId,
                    startDate,
                    endDate
                );
                return { ...equip, mobilizationStatus: status };
            })
        );
    } else {
        equipmentsWithStatus = equipmentList.map(equip => ({
            ...equip,
            mobilizationStatus: { status: 'never_mobilized', lastMobilizationDate: null }
        }));
    }

    // Ordenar: 1) Mobilizados primeiro, 2) Never mobilized, 3) Demobilizados por último
    const sortedEquipment = [...equipmentsWithStatus].sort((a, b) => {
        // PRIORIDADE 1: Status de mobilização
        const priorityMap = {
            'mobilized': 1,
            'never_mobilized': 2,
            'demobilized': 3
        };
        
        const priorityA = priorityMap[a.mobilizationStatus.status] || 999;
        const priorityB = priorityMap[b.mobilizationStatus.status] || 999;
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // PRIORIDADE 2: Ordem do cadastro da obra (se fornecida)
        if (equipmentInWork) {
            const indexA = equipmentInWork.findIndex(ec => ec.equipment_id == a.id);
            const indexB = equipmentInWork.findIndex(ec => ec.equipment_id == b.id);
            
            if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
                return indexA - indexB;
            }
        }
        
        // PRIORIDADE 3: Alfabético (fallback)
        const typeA = a.type ? a.type.toUpperCase() : '';
        const typeB = b.type ? b.type.toUpperCase() : '';
        if (typeA !== typeB) return typeA.localeCompare(typeB);

        const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
        const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
        return prefixA.localeCompare(prefixB);
    });
    
    return sortedEquipment;
};

const handleWorkSelectChange = async () => {
    const workId = entryWorkSelect.value;
    
    // ✅ NOVO: Salvar a obra selecionada no sessionStorage
    if (workId) {
        sessionStorage.setItem('selectedWorkIdLancamentos', workId);
    } else {
        sessionStorage.removeItem('selectedWorkIdLancamentos');
    }
    
    if (entriesListContainer) entriesListContainer.innerHTML = '';
    if (bulkActionsContainer) bulkActionsContainer.style.display = 'none';

    if (!workId) {
        if (entryEquipmentSelect) entryEquipmentSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
        if (entryBmSelect) entryBmSelect.innerHTML = '<option value="">Selecione o Período</option>';
        
        // Limpar bloco de informações
        const periodWorkName = document.getElementById('period-work-name');
        const periodClientName = document.getElementById('period-client-name');
        const periodBmTotal = document.getElementById('period-bm-total');
        if (periodWorkName) periodWorkName.textContent = 'OBRA: -';
        if (periodClientName) periodClientName.textContent = 'CLIENTE: -';
        if (periodBmTotal) periodBmTotal.textContent = 'TOTAL DA BM: R$ 0,00';
        return;
    }

    const work = appState.works.find(w => w.id == workId);
    
    // 🎯 ATUALIZAR BLOCO IMEDIATAMENTE COM NOME DA OBRA E CLIENTE
    const periodWorkName = document.getElementById('period-work-name');
    const periodClientName = document.getElementById('period-client-name');
    const periodBmTotal = document.getElementById('period-bm-total');
    
    if (periodWorkName && periodClientName && periodBmTotal && work) {
        // O nome do cliente já vem carregado no work via join
        const clientName = work.client_companies?.name || '-';
        
        periodWorkName.textContent = `OBRA: ${work.name || '-'}`;
        periodClientName.textContent = `CLIENTE: ${clientName}`;
        periodBmTotal.textContent = 'TOTAL DA BM: Selecione uma BM';
    }
    
    // CORREÇÃO: Auto-selecionar o último BM (mais recente)
    if (entryBmSelect) {
        const bmPeriods = work?.config?.measurement_periods || [];
        let bmOptions = '<option value="">Selecione o Período</option>' + bmPeriods.map((bm, index) => {
            const startFormatted = new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR');
            const endFormatted = new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR');
            return `<option value="${index}">${work?.work_prefix || 'BM'} ${index + 1} - ${startFormatted} a ${endFormatted}</option>`;
        }).join('');
        
        entryBmSelect.innerHTML = bmOptions;
        
        // Auto-selecionar o último BM se houver períodos disponíveis
        if (bmPeriods.length > 0) {
            const lastBmIndex = bmPeriods.length - 1;
            entryBmSelect.value = lastBmIndex;
            
            // Disparar o evento de mudança para preencher as datas automaticamente
            entryBmSelect.dispatchEvent(new Event('change'));
            
            // 🔥 AUTO-BUSCAR PERÍODO após selecionar obra
            setTimeout(() => {
                if (entryEquipmentSelect.value) {
                    handleGenerateEntries();
                }
            }, 100);
        }
    }

    const equipmentInWork = work?.config?.equipment || [];

    if (entryEquipmentSelect) {
        const validEquipmentsInWork = equipmentInWork
            .map(ec => appState.equipment.find(e => e.id === parseInt(ec.equipment_id)))
            .filter(equip => equip !== undefined);

        // 🎯 ORDENAÇÃO INTELIGENTE BASEADA NO STATUS DE MOBILIZAÇÃO
        const bmIndex = parseInt(entryBmSelect?.value);
        const bmPeriods = work?.config?.measurement_periods || [];
        const selectedBm = bmPeriods[bmIndex];
        
        console.log('🚀🚀🚀 ANTES DE CHAMAR sortEquipmentsByMobilizationStatus 🚀🚀🚀');
        console.log('   Equipamentos válidos:', validEquipmentsInWork.map(e => e.prefix).join(', '));
        console.log('   Work ID:', workId);
        console.log('   BM Selecionada:', selectedBm);
        console.log('   Start:', selectedBm?.start, 'End:', selectedBm?.end);
        
        // Usar função centralizada de ordenação
        const sortedEquipment = await sortEquipmentsByMobilizationStatus(
            validEquipmentsInWork,
            workId,
            selectedBm?.start,
            selectedBm?.end,
            equipmentInWork
        );
        
        console.log('🏁🏁🏁 DEPOIS DE CHAMAR sortEquipmentsByMobilizationStatus 🏁🏁🏁');

           // 🎯 LOG DETALHADO DOS STATUS
        console.log('');
        console.log('🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨');
        console.log('🎨 STATUS DE MOBILIZAÇÃO DOS EQUIPAMENTOS - COMBOBOX');
        console.log('🎨 Total de equipamentos:', sortedEquipment.length);
        console.log('🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨');
        sortedEquipment.forEach(e => {
            const statusEmoji = e.mobilizationStatus?.status === 'demobilized' ? '🔴' : 
                               e.mobilizationStatus?.status === 'never_mobilized' ? '🔘' : '🟢';
            console.log(`   ${statusEmoji} ${e.prefix}: ${e.mobilizationStatus?.status || 'SEM STATUS'}`);
        });
        console.log('🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨🎨');
        console.log('');
        
        // 🎯 CALCULAR VALOR DA MEDIÇÃO DE CADA EQUIPAMENTO NO PERÍODO DA BM
        const equipmentOptions = await Promise.all(sortedEquipment.map(async (e) => {
        // Busca o prefixo do equipamento na obra (equipment_work_prefix)
        const equipConfigInWork = equipmentInWork.find(ec => ec.equipment_id == e.id);
        const workPrefix = equipConfigInWork?.equipment_work_prefix;
        
        // Monta o prefixo com o prefixo da obra entre parênteses (se existir)
        let prefixDisplay = e.prefix;
        if (workPrefix && workPrefix.trim() !== '') {
            prefixDisplay = `${e.prefix} (${workPrefix})`;
        }
        
        // 🎯 CALCULAR VALOR DA MEDIÇÃO NO PERÍODO DA BM SELECIONADA
        let measurementValue = 0;
        if (selectedBm) {
            const entriesForEquipment = appState.daily_entries.filter(entry => 
                entry.work_id == workId &&
                entry.equipment_id == e.id &&
                entry.date >= selectedBm.start &&
                entry.date <= selectedBm.end
            );
            
            const equipConfig = equipmentInWork.find(ec => ec.equipment_id == e.id);
            if (equipConfig && entriesForEquipment.length > 0) {
                // 🎯 Buscar periodConfig correto para o intervalo
                const bmPeriods = work?.config?.measurement_periods || [];
                const periodForCalc = bmPeriods.find(bm => bm.start <= bmPeriod.end && bm.end >= bmPeriod.start);
                
                const calculation = calculateEquipmentTotalValue(
                    entriesForEquipment,
                    [],  // sem despesas gerais
                    equipConfig,
                    work,
                    [],   // sem avarias
                    null, // substitution details
                    bmPeriod.start,
                    bmPeriod.end,
                    periodForCalc  // 🎯 CRÍTICO: Passar config do período
                );
                measurementValue = calculation.totalValue || 0;
            }
        }
        
        // Monta a lista de informações do equipamento
        const parts = [
            prefixDisplay,
            e.type,
            e.brand,
            e.model,
            e.year,
            e.characteristic,
            e.capacidade
        ].filter(Boolean);  // Remove valores null/undefined/vazios
    
        const displayText = parts.join(' - ');
        
        // 🎨 ADICIONAR INDICADOR VISUAL NO TEXTO
        let prefix = '';
        let dataStatus = '';
        
        // 🔍 LOG DO STATUS RECEBIDO
        console.log(`   🎨 [${e.prefix}] Aplicando visual - Status: ${e.mobilizationStatus?.status}`);
        
        if (e.mobilizationStatus.status === 'demobilized') {
            prefix = '🔴 '; // Emoji vermelho
            dataStatus = 'data-status="demobilized"';
            console.log(`      ✅ [${e.prefix}] Aplicado: 🔴 VERMELHO (desmobilizado)`);
        } else if (e.mobilizationStatus.status === 'never_mobilized') {
            prefix = '🔘 '; // Emoji cinza claro
            dataStatus = 'data-status="never_mobilized"';
            console.log(`      ✅ [${e.prefix}] Aplicado: 🔘 CINZA CLARO (nunca mobilizado)`);
        } else {
            prefix = '🟢 '; // Emoji verde para mobilizado
            dataStatus = 'data-status="mobilized"';
            console.log(`      ✅ [${e.prefix}] Aplicado: 🟢 VERDE (mobilizado)`);
        }
        
        // 🎯 FORMATAR COM VALOR DA MEDIÇÃO
        const valueDisplay = measurementValue > 0 ? `${formatCurrency(measurementValue)} - ` : '';
        
        return `<option value="${e.id}" ${dataStatus}>${prefix}${valueDisplay}${displayText}</option>`;
    }));


        // Auto-selecionar o primeiro equipamento se houver equipamentos disponíveis
        if (sortedEquipment.length > 0) {
            entryEquipmentSelect.innerHTML = equipmentOptions.join('');
            entryEquipmentSelect.value = sortedEquipment[0].id; // Seleciona automaticamente o primeiro
        } else {
            entryEquipmentSelect.innerHTML = '<option value="">Nenhum equipamento disponível</option>';
        }
    }
};


// ✅ DEPOIS (MANTÉM o equipamento selecionado):
const handleBmSelectChange = async () => {
    const workId = entryWorkSelect.value;
    const bmIndex = entryBmSelect.value;
    
    if (workId && bmIndex !== '') {
        const work = appState.works.find(w => w.id == workId);
        const bmPeriod = work?.config?.measurement_periods[parseInt(bmIndex)];
        
        if (bmPeriod) {
            if (entryStartDate) entryStartDate.value = bmPeriod.start;
            if (entryEndDate) entryEndDate.value = bmPeriod.end;
        }

        // 🔥 CORREÇÃO: SALVAR o equipamento que estava selecionado ANTES de recriar a lista
        const previouslySelectedEquipmentId = entryEquipmentSelect?.value;

        // Recriar a lista de equipamentos (mantendo a ordenação)
        const equipmentInWork = work?.config?.equipment || [];

        if (entryEquipmentSelect) {
            const validEquipmentsInWork = equipmentInWork
                .map(ec => appState.equipment.find(e => e.id === parseInt(ec.equipment_id)))
                .filter(equip => equip !== undefined);

            // 🎯 ORDENAÇÃO INTELIGENTE COM STATUS DE MOBILIZAÇÃO
            const sortedEquipment = await sortEquipmentsByMobilizationStatus(
                validEquipmentsInWork,
                workId,
                bmPeriod?.start,
                bmPeriod?.end,
                equipmentInWork
            );

            const equipmentOptions = await Promise.all(sortedEquipment.map(async (e) => {
                const equipConfigInWork = equipmentInWork.find(ec => ec.equipment_id == e.id);
                const workPrefix = equipConfigInWork?.equipment_work_prefix;
                
                let prefixDisplay = e.prefix;
                if (workPrefix && workPrefix.trim() !== '') {
                    prefixDisplay = `${e.prefix} (${workPrefix})`;
                }
                
                // 🎯 CALCULAR VALOR DA MEDIÇÃO NO PERÍODO DA BM SELECIONADA
                let measurementValue = 0;
                if (bmPeriod) {
                    const entriesForEquipment = appState.daily_entries.filter(entry => 
                        entry.work_id == workId &&
                        entry.equipment_id == e.id &&
                        entry.date >= bmPeriod.start &&
                        entry.date <= bmPeriod.end
                    );
                    
                    if (equipConfigInWork && entriesForEquipment.length > 0) {
                        // 🎯 Passar periodConfig para cálculo correto
                        const calculation = calculateEquipmentTotalValue(
                            entriesForEquipment,
                            [],  // sem despesas gerais
                            equipConfigInWork,
                            work,
                            [],   // sem avarias
                            null, // substitution details
                            bmPeriod.start,
                            bmPeriod.end,
                            bmPeriod  // 🎯 CRÍTICO: Passar config do período
                        );
                        measurementValue = calculation.totalValue || 0;
                    }
                }
                
                const parts = [
                    prefixDisplay,
                    getEquipTypeName(e.type),
                    e.brand,
                    e.model,
                    e.year,
                    e.characteristic,
                    e.capacidade
                ].filter(Boolean);
            
                const displayText = parts.join(' - ');
                
                // 🎨 ADICIONAR EMOJI COLORIDO
                let prefix = '';
                if (e.mobilizationStatus.status === 'demobilized') {
                    prefix = '🔴 ';
                } else if (e.mobilizationStatus.status === 'never_mobilized') {
                    prefix = '⚪ ';
                } else {
                    prefix = '🟢 ';
                }
                
                // 🎯 FORMATAR COM VALOR DA MEDIÇÃO
                const valueDisplay = measurementValue > 0 ? `${formatCurrency(measurementValue)} - ` : '';
                
                return `<option value="${e.id}">${prefix}${valueDisplay}${displayText}</option>`;
            }));

            if (sortedEquipment.length > 0) {
                entryEquipmentSelect.innerHTML = equipmentOptions.join('');
                
                if (previouslySelectedEquipmentId && 
                    sortedEquipment.some(e => e.id == previouslySelectedEquipmentId)) {
                    entryEquipmentSelect.value = previouslySelectedEquipmentId;
                } else {
                    entryEquipmentSelect.value = sortedEquipment[0].id;
                }
            } else {
                entryEquipmentSelect.innerHTML = '<option value="">Nenhum equipamento disponível</option>';
            }
        }
        
        // 🎯 Atualizar label da BM no bloco de informações
        const periodBmTotal = document.getElementById('period-bm-total');
        if (periodBmTotal && work) {
            const bmLabel = `${work?.work_prefix || 'BM'} ${parseInt(bmIndex) + 1}`;
            periodBmTotal.textContent = `TOTAL DA ${bmLabel}: Calculando...`;
        }
        
        // 🔥 AUTO-BUSCAR PERÍODO após mudar BM (prevenir se vier de salvamento)
        if (!window.preventAutoBuscar) {
            setTimeout(() => {
                if (entryEquipmentSelect?.value) {
                    handleGenerateEntries();
                }
            }, 100);
        }
    }
};

const handleEquipmentSelectChange = () => {
    if (entriesListContainer) entriesListContainer.innerHTML = '';
    if (bulkActionsContainer) bulkActionsContainer.style.display = 'none';
    
    // 🔥 AUTO-BUSCAR PERÍODO quando mudar equipamento (para comodidade do usuário)
    const startDate = document.getElementById('entry-start-date')?.value;
    const endDate = document.getElementById('entry-end-date')?.value;
    const workId = entryWorkSelect?.value;
    const equipmentId = entryEquipmentSelect?.value;
    
    if (startDate && endDate && workId && equipmentId) {
        console.log('🔥 Auto-buscando período após mudança de equipamento...');
        handleGenerateEntries();
    }
};

const handleGenerateEntries = () => {
    const startDate = document.getElementById('entry-start-date')?.value;
    const endDate = document.getElementById('entry-end-date')?.value;
    const workId = entryWorkSelect?.value;
    const equipmentId = entryEquipmentSelect?.value;
    const bmIndex = entryBmSelect?.value;

    console.log('🔍 [DEBUG BUSCAR PERÍODO]', {
        bmSelecionada: bmIndex,
        startDate,
        endDate,
        workId,
        equipmentId
    });

    if (!startDate || !endDate || !workId || !equipmentId) {
        alert('Por favor, selecione a obra, equipamento e o período para buscar.');
        return;
    }

    displayPeriodEntries(workId, equipmentId, startDate, endDate);
};

const displayPeriodEntries = async (workId, equipmentId, startDateStr, endDateStr) => {
    showSpinner();
    if (entriesListContainer) entriesListContainer.innerHTML = '';

    try {
        const existingEntries = await apiClient.fetchDailyEntries(workId, equipmentId, startDateStr, endDateStr);
        const entriesMap = new Map(existingEntries.map(e => [e.date, e]));

        appState.equipmentSubstitutions = await apiClient.fetchEquipmentSubstitutions(workId, startDateStr, endDateStr, equipmentId);
        const currentSubstitution = appState.equipmentSubstitutions.find(sub => 
            sub.substituting_equipment_id == equipmentId && sub.substitution_date >= startDateStr && sub.substitution_date <= endDateStr
        );
        
        // 🎯 CARREGAR DESPESAS E AVARIAS PARA CALCULAR TOTAL DAS BMs
        console.log('📦 Carregando general_expenses e damages para cálculo de BM...');
        if (!appState.expenses) {
            appState.expenses = await apiClient.fetchData('general_expenses', 'id, work_id, equipment_id, expense_date, expense_type, total_value, client_impact_type, third_party_impact_type');
        }
        if (!appState.damages) {
            appState.damages = await apiClient.fetchData('damages', 'id, work_id, equipment_id, damage_date, description, total_value, client_impact_type, third_party_impact_type');
        }
        console.log('✅ General_expenses e damages carregados:', {
            expensesCount: appState.expenses?.length || 0,
            damagesCount: appState.damages?.length || 0
        });
        
        const startDate = new Date(startDateStr + 'T00:00:00');
        const endDate = new Date(endDateStr + 'T00:00:00');

        let cardsHtml = '';
        const work = appState.works.find(w => w.id == workId);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const entryData = entriesMap.get(dateStr) || { date: dateStr, work_id: workId, equipment_id: equipmentId };
            
            // 🔥 SEMPRE RECALCULAR O BM_LABEL BASEADO NA DATA (IGNORAR O SALVO NO BANCO)
            entryData.bm_label = getBMLabelForDate(dateStr, work?.config?.measurement_periods);
            
            cardsHtml += createEntryCard(entryData, currentSubstitution);
        }
        if (entriesListContainer) {
            console.log('🔄 ATUALIZAÇÃO v2.5 - Labels encurtados carregados');
            entriesListContainer.innerHTML = cardsHtml;
            
            // DEBUG: Verificar se entry-card-content existe após innerHTML
            const testCards = entriesListContainer.querySelectorAll('.entry-card');
            console.log('📊 Total de cards criados:', testCards.length);
            testCards.forEach((card, index) => {
                const content = card.querySelector('.entry-card-content');
                console.log(`Card ${index}: .entry-card-content encontrado?`, !!content);
                if (!content) {
                    console.log('HTML do card:', card.outerHTML.substring(0, 500));
                }
            });
            
            // 🔧 ATUALIZAR BADGES DE TODOS OS CARTÕES APÓS RENDERIZAÇÃO
            console.log('🔧 Atualizando badges de avarias para todos os cartões...');
            testCards.forEach(card => {
                updateAlertBadges(card);
            });
            console.log('✅ Badges atualizados para', testCards.length, 'cartões');
            
            attachCardEventListeners();
            
            // Calcular e exibir valores de medição para cada BM
            await addMeasurementValuesToCards(workId, equipmentId);
        }

        if (bulkActionsContainer) bulkActionsContainer.style.display = 'flex';

        // 🚨 Verificar e exibir alerta de equipamentos desmobilizados trabalhados
        await checkAndDisplayDemobilizationAlert(workId, startDate, endDate);

    } catch (e) {
        console.error(e);
        alert("Erro ao buscar lançamentos.");
    } finally {
        hideSpinner();
    }
};

// 🚨 Função para verificar equipamentos desmobilizados que foram marcados como trabalhados
const checkAndDisplayDemobilizationAlert = async (workId, startDate, endDate) => {
    try {
        console.log('🚨 Verificando equipamentos desmobilizados trabalhados...');
        
        // 1. Buscar todos os lançamentos trabalhados no período
        const workedEntries = appState.daily_entries.filter(entry => 
            entry.work_id == workId &&
            entry.date >= startDate &&
            entry.date <= endDate &&
            entry.is_worked === true
        );

        if (workedEntries.length === 0) {
            removeAlert();
            return;
        }

        // 2. Agrupar por equipamento
        const equipmentEntries = {};
        workedEntries.forEach(entry => {
            if (!equipmentEntries[entry.equipment_id]) {
                equipmentEntries[entry.equipment_id] = [];
            }
            equipmentEntries[entry.equipment_id].push(entry.date);
        });

        // 3. Verificar status de mobilização para cada equipamento
        const violations = [];
        for (const equipmentId in equipmentEntries) {
            const status = await getEquipmentMobilizationStatus(equipmentId, workId, startDate, endDate);
            
            if (status.status === 'demobilized') {
                const equip = appState.equipment.find(e => e.id == equipmentId);
                const dates = equipmentEntries[equipmentId].sort();
                
                violations.push({
                    equipmentId: equipmentId,
                    equipmentName: equip ? equip.prefix : `Equipamento ${equipmentId}`,
                    dates: dates,
                    demobilizationDate: status.demobilization_date
                });
            }
        }

        // 4. Exibir ou remover alerta
        if (violations.length > 0) {
            displayDemobilizationAlert(violations);
        } else {
            removeAlert();
        }

    } catch (error) {
        console.error('❌ Erro ao verificar equipamentos desmobilizados:', error);
    }
};

// 🚨 Função para exibir alerta visual de violações
const displayDemobilizationAlert = (violations) => {
    console.log('⚠️ Violações encontradas:', violations);
    
    // Remove alerta existente se houver
    removeAlert();
    
    // Criar HTML do alerta
    let alertHtml = `
        <div id="demobilization-alert" style="
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
            border: 3px solid #ff5252;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 24px rgba(255, 82, 82, 0.4);
            animation: pulse-alert 2s infinite;
        ">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <span style="font-size: 32px;">⚠️</span>
                <h3 style="margin: 0; color: white; font-size: 18px; font-weight: bold;">
                    ATENÇÃO: Equipamentos Desmobilizados Marcados como Trabalhados
                </h3>
            </div>
            <div style="background: rgba(255, 255, 255, 0.95); border-radius: 8px; padding: 15px;">
    `;
    
    violations.forEach((violation, index) => {
        // Formatar datas
        const formatDate = (dateStr) => {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        };
        
        // Agrupar datas em intervalos contínuos
        const dateRanges = [];
        let rangeStart = violation.dates[0];
        let rangeEnd = violation.dates[0];
        
        for (let i = 1; i < violation.dates.length; i++) {
            const currentDate = new Date(violation.dates[i]);
            const previousDate = new Date(rangeEnd);
            const diffDays = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                rangeEnd = violation.dates[i];
            } else {
                dateRanges.push(rangeStart === rangeEnd ? formatDate(rangeStart) : `${formatDate(rangeStart)} a ${formatDate(rangeEnd)}`);
                rangeStart = violation.dates[i];
                rangeEnd = violation.dates[i];
            }
        }
        dateRanges.push(rangeStart === rangeEnd ? formatDate(rangeStart) : `${formatDate(rangeStart)} a ${formatDate(rangeEnd)}`);
        
        const demobDate = violation.demobilizationDate ? formatDate(violation.demobilizationDate) : 'N/A';
        
        alertHtml += `
            <div style="
                padding: 12px;
                margin-bottom: ${index < violations.length - 1 ? '12px' : '0'};
                background: white;
                border-left: 4px solid #ff5252;
                border-radius: 6px;
            ">
                <div style="font-weight: bold; color: #d32f2f; margin-bottom: 8px; font-size: 15px;">
                    🚜 ${violation.equipmentName}
                </div>
                <div style="color: #555; font-size: 13px; margin-bottom: 6px;">
                    📅 <strong>Desmobilizado em:</strong> ${demobDate}
                </div>
                <div style="color: #555; font-size: 13px;">
                    ⚡ <strong>Dias trabalhados:</strong> ${dateRanges.join(', ')}
                </div>
            </div>
        `;
    });
    
    alertHtml += `
            </div>
        </div>
        <style>
            @keyframes pulse-alert {
                0%, 100% { box-shadow: 0 8px 24px rgba(255, 82, 82, 0.4); }
                50% { box-shadow: 0 8px 32px rgba(255, 82, 82, 0.7); }
            }
        </style>
    `;
    
    // Inserir alerta no topo da lista de lançamentos
    if (entriesListContainer) {
        entriesListContainer.insertAdjacentHTML('afterbegin', alertHtml);
    }
};

// 🗑️ Função para remover alerta
const removeAlert = () => {
    const existingAlert = document.getElementById('demobilization-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
};

const createEntryCard = (entryData, currentSubstitution = null) => {
    const work = appState.works.find(w => w.id == entryData.work_id);
    const equip = appState.equipment.find(e => e.id == entryData.equipment_id);
    const thirdPartyCompany = equip?.is_terceirizado ? appState.terceirizados.find(t => t.id == equip.terceirizado_id) : null;
    const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == entryData.equipment_id);

    const operatorId = entryData.operator_id || equipConfig?.default_operator_id;
    const employeeOptions = appState.employees.map(emp => `<option value="${emp.id}" ${operatorId == emp.id ? 'selected' : ''}>${emp.name}</option>`).join('');

    const bmLabel = entryData.bm_label || getBMLabelForDate(entryData.date, work?.config?.measurement_periods);
    
    // 📅 Obter intervalo de datas da BM
    let bmDateRange = '';
    if (bmLabel && work?.config?.measurement_periods) {
        // Extrair número do BM (ex: "BM 3" -> 3)
        const bmNumber = parseInt(bmLabel.replace('BM ', '').trim());
        
        // 🔧 Buscar período pelo índice (BM 1 = índice 0)
        const bmPeriod = !isNaN(bmNumber) ? work.config.measurement_periods[bmNumber - 1] : null;
        
        if (bmPeriod && bmPeriod.start && bmPeriod.end) {
            const formatDate = (dateStr) => {
                const [y, m, d] = dateStr.split('-');
                return `${d}/${m}/${y}`;
            };
            bmDateRange = ` <span style="color: #00D4FF; font-weight: bold;">(${formatDate(bmPeriod.start)} a ${formatDate(bmPeriod.end)})</span>`;
        }
    }
    
    const dateObj = new Date(entryData.date + 'T00:00:00');
    
    const initialDailyPartStatus = appState.dailyPartStatus[`${entryData.work_id}-${entryData.equipment_id}-${bmLabel}`] !== undefined 
                                   ? appState.dailyPartStatus[`${entryData.work_id}-${entryData.equipment_id}-${bmLabel}`] 
                                   : (entryData.is_daily_part_received || false);

    // Calcular valor da medição para o período da BM
    let measurementValue = null;
    let measurementValueTerceirizado = null;
    let bmTotalValue = null; // 🎯 VALOR TOTAL DA BM (TODOS EQUIPAMENTOS)
    
    console.log('🎯 [MEDIÇÃO CARTÃO] Verificando condições:', {
        equipPrefix: equip?.prefix,
        bmLabel,
        hasBmLabel: !!bmLabel,
        hasWork: !!work,
        hasWorkConfig: !!work?.config,
        hasMeasurementPeriods: !!work?.config?.measurement_periods,
        measurementPeriodsCount: work?.config?.measurement_periods?.length || 0
    });
    
    if (bmLabel && work?.config?.measurement_periods) {
        // 🔧 Extrair número do BM (ex: "BM 2" -> 2)
        const bmNumber = parseInt(bmLabel.replace('BM', '').trim());
        // 🔧 Buscar período pelo índice (BM 1 = índice 0, BM 2 = índice 1, etc.)
        const period = work.config.measurement_periods[bmNumber - 1];
        console.log('🔍 Calculando medição para:', {
            equipPrefix: equip?.prefix,
            bmLabel,
            bmNumber,
            period,
            hasEquipConfig: !!equipConfig,
            measurementType: equipConfig?.measurement_type
        });
        
        if (period && equipConfig) {
            // Buscar todas as entradas do equipamento neste período
            const equipmentEntries = appState.daily_entries.filter(entry =>
                entry.work_id == work.id &&
                entry.equipment_id == equip.id &&
                entry.date >= period.start &&
                entry.date <= period.end
            );
            
            // Buscar despesas gerais do período
            const equipmentExpenses = appState.expenses ? appState.expenses.filter(exp =>
                exp.work_id == work.id &&
                exp.equipment_id == equip.id &&
                exp.date >= period.start &&
                exp.date <= period.end
            ) : [];
            
            // Buscar avarias
            const validDamages = appState.damages ? appState.damages.filter(damage =>
                damage.work_id == work.id &&
                damage.equipment_id == equip.id &&
                damage.damage_date >= period.start &&
                damage.damage_date <= period.end
            ) : [];
            
            // Buscar substituições
            const substitutionDetails = appState.equipment_substitutions ? appState.equipment_substitutions.filter(sub =>
                sub.work_id == work.id &&
                sub.guarantor_equipment_id == equip.id &&
                sub.substitution_date >= period.start &&
                sub.substitution_date <= period.end
            ) : [];
            
            console.log('📊 Dados para cálculo:', {
                entriesCount: equipmentEntries.length,
                expensesCount: equipmentExpenses.length,
                damagesCount: validDamages.length,
                substitutionsCount: substitutionDetails.length
            });
            
            try {
                const calculation = calculateEquipmentTotalValue(
                    equipmentEntries,
                    equipmentExpenses,
                    equipConfig,
                    work,
                    validDamages,
                    substitutionDetails,
                    period.start,
                    period.end
                    // ⚠️ NÃO PASSAR periodConfig - estava funcionando sem!
                );
                measurementValue = calculation.totalValue;
                measurementValueTerceirizado = calculation.totalValueTerceirizado;
                console.log('✅ Cálculo concluído:', {
                    totalValue: measurementValue,
                    totalValueTerceirizado: measurementValueTerceirizado
                });
                
                // 🎯 CALCULAR VALOR TOTAL DA BM (TODOS OS EQUIPAMENTOS)
                try {
                    let bmTotal = 0;
                    
                    // Percorrer TODOS os equipamentos da obra
                    const allEquipmentConfigs = work.config.equipment || [];
                    for (const eqConfig of allEquipmentConfigs) {
                        const eqData = appState.equipment.find(e => e.id == eqConfig.equipment_id);
                        if (!eqData) continue;
                        
                        const eqEntries = appState.daily_entries.filter(entry =>
                            entry.work_id == work.id &&
                            entry.equipment_id == eqData.id &&
                            entry.date >= period.start &&
                            entry.date <= period.end
                        );
                        
                        const eqExpenses = appState.expenses ? appState.expenses.filter(exp =>
                            exp.work_id == work.id &&
                            exp.equipment_id == eqData.id &&
                            exp.date >= period.start &&
                            exp.date <= period.end
                        ) : [];
                        
                        const eqDamages = appState.damages ? appState.damages.filter(damage =>
                            damage.work_id == work.id &&
                            damage.equipment_id == eqData.id &&
                            damage.damage_date >= period.start &&
                            damage.damage_date <= period.end
                        ) : [];
                        
                        const eqSubstitutions = appState.equipment_substitutions ? appState.equipment_substitutions.filter(sub =>
                            sub.work_id == work.id &&
                            sub.guarantor_equipment_id == eqData.id &&
                            sub.substitution_date >= period.start &&
                            sub.substitution_date <= period.end
                        ) : [];
                        
                        const eqCalculation = calculateEquipmentTotalValue(
                            eqEntries,
                            eqExpenses,
                            eqConfig,
                            work,
                            eqDamages,
                            eqSubstitutions,
                            period.start,
                            period.end
                            // ⚠️ NÃO PASSAR periodConfig
                        );
                        
                        bmTotal += eqCalculation.totalValue;
                    }
                    
                    // 🎯 ADICIONAR DESPESAS GERAIS DA OBRA (como no relatório)
                    try {
                        const generalExpenses = appState.expenses ? appState.expenses.filter(exp =>
                            exp.work_id == work.id &&
                            !exp.equipment_id &&
                            exp.date >= period.start &&
                            exp.date <= period.end
                        ) : [];
                        
                        const generalDamages = appState.damages ? appState.damages.filter(damage =>
                            damage.work_id == work.id &&
                            !damage.equipment_id &&
                            damage.damage_date >= period.start &&
                            damage.damage_date <= period.end
                        ) : [];
                        
                        const calculateGeneralExpensesImpact = (expenses, impactType) => {
                            const filtered = expenses.filter(exp => exp.measurement_impact === impactType);
                            const values = filtered.map(exp => parseFloat(exp.impacto_cliente_total) || 0);
                            return preciseRounding.round2(values.reduce((sum, val) => sum + val, 0));
                        };
                        
                        const generalWorkAdditions = calculateGeneralExpensesImpact(generalExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
                        const generalWorkDiscounts = calculateGeneralExpensesImpact(generalExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);
                        
                        const generalDamageAdditions = preciseRounding.round2(
                            generalDamages
                                .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                                .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0)
                        );
                        
                        const generalDamageDiscounts = preciseRounding.round2(
                            generalDamages
                                .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                                .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0)
                        );
                        
                        const generalWorkTotal = preciseRounding.sumPrecise(
                            generalWorkAdditions,
                            generalDamageAdditions,
                            -generalWorkDiscounts,
                            -generalDamageDiscounts
                        );
                        
                        bmTotal = preciseRounding.sumPrecise(bmTotal, generalWorkTotal);
                        
                        console.log('💰 DESPESAS GERAIS DA OBRA:', {
                            additions: generalWorkAdditions,
                            discounts: generalWorkDiscounts,
                            damageAdditions: generalDamageAdditions,
                            damageDiscounts: generalDamageDiscounts,
                            generalWorkTotal,
                            formatted: formatCurrency(generalWorkTotal)
                        });
                    } catch (generalExpError) {
                        console.error('❌ Erro ao calcular despesas gerais:', generalExpError);
                    }
                    
                    bmTotalValue = bmTotal;
                    console.log('🎯 VALOR TOTAL DA BM (EQUIPAMENTOS + DESPESAS GERAIS):', {
                        bmLabel,
                        bmTotal,
                        formatted: formatCurrency(bmTotal),
                        equipmentCount: allEquipmentConfigs.length
                    });
                    
                } catch (bmTotalError) {
                    console.error('❌ Erro ao calcular valor total da BM:', bmTotalError);
                }
                
            } catch (e) {
                console.error('❌ Erro ao calcular valor da medição:', e);
            }
        }
    }

    console.log('🔍 VALORES FINAIS ANTES DE RENDERIZAR:', {
        equipPrefix: equip?.prefix,
        bmLabel,
        measurementValue,
        bmTotalValue,
        willShowBmTotal: bmTotalValue !== null,
        measurementValueIsNull: measurementValue === null,
        bmTotalValueIsNull: bmTotalValue === null
    });
    
    // 🚨 ATENÇÃO: Se os valores estão null, significa que:
    // 1. bmLabel está undefined/null OU
    // 2. work?.config?.measurement_periods não existe OU
    // 3. period não foi encontrado OU
    // 4. equipConfig não existe
    if (bmLabel && (measurementValue === null || bmTotalValue === null)) {
        console.error('❌❌❌ VALORES NULL - DEBUGANDO:', {
            bmLabel,
            hasMeasurementPeriods: !!work?.config?.measurement_periods,
            measurementPeriodsCount: work?.config?.measurement_periods?.length,
            hasEquipConfig: !!equipConfig,
            workId: work?.id,
            equipId: equip?.id
        });
    }

    // Normaliza stoppages: campos legados → campos atuais
    const normalizeStoppage = (s) => ({
        type_id:       s.type_id       ?? s.stoppage_type_id ?? '',
        start:         s.start         ?? s.start_time       ?? null,
        end:           s.end           ?? s.end_time         ?? null,
        hours_hhmm:    s.hours_hhmm    ?? null,
        hours_decimal: s.hours_decimal ?? null
    });
    const stoppagesHtml = (entryData.stoppages || []).map(s => createStoppageRow(normalizeStoppage(s))).join('');
    const notesHtml = (entryData.notes || []).map(note => createNoteRow(note)).join('');
    
    const finalValue = entryData.daily_manual_value !== null && entryData.daily_manual_value !== undefined 
        ? entryData.daily_manual_value 
        : (entryData.daily_total_value || 0);

    // 🎯 GERAR HTML COM CONFIGURAÇÃO DE PREÇO DO EQUIPAMENTO
    let priceConfigHtml = '';
    if (equipConfig) {
        const measurementType = equipConfig.measurement_type;
        const contractValue = equipConfig.measurement_value || 0; // Campo universal usado para todos os tipos
        
        if (measurementType === MEASUREMENT_TYPES.MONTHLY) {
            // Mensal
            priceConfigHtml = `<strong style="color: #90EE90; font-size: 0.9em; white-space: nowrap;">Mensal: ${formatCurrency(contractValue)}</strong>`;
            
        } else if (measurementType === MEASUREMENT_TYPES.HOURLY) {
            // Por Hora
            priceConfigHtml = `<strong style="color: #87CEEB; font-size: 0.9em; white-space: nowrap;">Hora: ${formatCurrency(contractValue)}</strong>`;
            
        } else if (measurementType === MEASUREMENT_TYPES.DAILY) {
            // Diário
            priceConfigHtml = `<strong style="color: #FFB6C1; font-size: 0.9em; white-space: nowrap;">Diário: ${formatCurrency(contractValue)}</strong>`;
            
        } else if (measurementType === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
            // Garantia de Horas
            const guaranteedHours = equipConfig.guaranteed_hours || 0;
            priceConfigHtml = `<strong style="color: #DDA0DD; font-size: 0.9em; white-space: nowrap;">Mensal: ${formatCurrency(contractValue)} | Garantia: ${guaranteedHours}h</strong>`;
        }
    }

    let thirdPartyValuesHtml = '';
    if (equip?.is_terceirizado) {
        const finalValueTerceirizado = entryData.daily_manual_value_terceirizado !== null && entryData.daily_manual_value_terceirizado !== undefined
            ? entryData.daily_manual_value_terceirizado
            : (entryData.daily_total_value_terceirizado || 0);

        thirdPartyValuesHtml = `
            <div class="form-group" style="margin: 0; display: flex; align-items: center; gap: 6px; background-color: rgba(245, 166, 35, 0.1); border: 1px solid var(--secondary-color); padding: 3px 6px; border-radius: 3px;">
                <label style="margin: 0; font-size: 0.8em; white-space: nowrap;">Valor Manual Terc. (R$)</label>
                <input type="number" step="0.01" class="daily-manual-value-terceirizado-header" value="${entryData.daily_manual_value_terceirizado ?? ''}" placeholder="Substituir" style="width: 90px; padding: 3px 6px; font-size: 0.8em;">
            </div>
            <strong class="daily-total-terceirizado-display" style="font-size: 0.9em; white-space: nowrap;">Terc.: ${formatCurrency(finalValueTerceirizado)}</strong>
            ${measurementValueTerceirizado !== null ? `<strong class="measurement-total-terceirizado-display" style="color: #ff6b35; font-size: 0.9em; white-space: nowrap;">${bmLabel || 'BM'} Terc.: ${formatCurrency(measurementValueTerceirizado)}</strong>` : ''}
        `;
    }

    // 🎯 Construir linha de valores com hifens corretos
    let valuesLine = '<span style="color: #999;"> - </span><strong class="daily-total-display" style="color: #64b5f6; white-space: nowrap;">Dia: ' + formatCurrency(finalValue) + '</strong>';
    
    console.log('🔧🔧🔧 DEBUG valuesLine - VERSÃO 16:45 🔧🔧🔧');
    console.log('🔧 DEBUG priceConfigHtml CONTEÚDO COMPLETO:', JSON.stringify(priceConfigHtml));
    console.log('🔧 DEBUG measurementValue:', measurementValue);
    console.log('🔧 DEBUG bmTotalValue:', bmTotalValue);
    
    if (priceConfigHtml) {
        console.log('🔧 ANTES de adicionar priceConfigHtml, valuesLine =', JSON.stringify(valuesLine));
        valuesLine += '<span style="color: #999;"> - </span>' + priceConfigHtml;
        console.log('🔧 DEPOIS de adicionar priceConfigHtml, valuesLine =', JSON.stringify(valuesLine));
    }
    if (measurementValue !== null) {
        console.log('🔧 ANTES de adicionar measurementValue, valuesLine =', JSON.stringify(valuesLine));
        valuesLine += '<span style="color: #999;"> - </span><strong class="measurement-total-display" style="color: #64b5f6; white-space: nowrap;">' + (bmLabel || 'BM') + ': ' + formatCurrency(measurementValue) + '</strong>';
        console.log('🔧 DEPOIS de adicionar measurementValue, valuesLine =', JSON.stringify(valuesLine));
    }
    if (bmTotalValue !== null) {
        valuesLine += '<span style="color: #999;"> - </span><strong class="bm-total-display" style="color: #FFD700; white-space: nowrap;">Total ' + (bmLabel || 'BM') + ': ' + formatCurrency(bmTotalValue) + '</strong>';
    }
    if (thirdPartyValuesHtml) {
        valuesLine += '<span style="color: #999;"> - </span>' + thirdPartyValuesHtml;
    }
    
    console.log('🔧 DEBUG valuesLine FINAL:', JSON.stringify(valuesLine));
    console.log('🔧🔧🔧 FIM DEBUG valuesLine 🔧🔧🔧');

    // Campos de cálculo mensal melhorados - AGORA INCLUI GUARANTEED_HOURS
    const monthlyCalculationHtml = (equipConfig?.measurement_type === 'monthly' || equipConfig?.measurement_type === 'guaranteed_hours') ? `
        <div class="form-group">
            <label>Tipo Cálculo Mensal (Auto)</label>
            <select class="monthly-calculation-auto" disabled style="background-color: #2c2c2c; color: #b0b0b0;">
                <option value="proportional" ${(entryData.monthly_calculation_override || equipConfig?.monthly_calculation) === 'proportional' ? 'selected' : ''}>Proporção</option>
                <option value="fixed_30" ${(entryData.monthly_calculation_override || equipConfig?.monthly_calculation) === 'fixed_30' ? 'selected' : ''}>Fixo 30 dias</option>
            </select>
        </div>
        <div class="form-group">
            <label>Tipo Cálculo Mensal Manual</label>
            <select class="monthly-calculation-manual">
                <option value="">Automático</option>
                <option value="proportional" ${entryData.monthly_calculation_manual === 'proportional' ? 'selected' : ''}>Proporção</option>
                <option value="fixed_30" ${entryData.monthly_calculation_manual === 'fixed_30' ? 'selected' : ''}>Fixo 30 dias</option>
            </select>
        </div>
    ` : '';

    const terceirizadoMonthlyCalculationHtml = equip?.is_terceirizado && (equipConfig?.measurement_type_terceirizado === 'monthly' || equipConfig?.measurement_type === 'monthly' || equipConfig?.measurement_type_terceirizado === 'guaranteed_hours' || equipConfig?.measurement_type === 'guaranteed_hours') ? `
        <div class="form-group">
            <label>Tipo Cálculo Mensal Terc. (Auto)</label>
            <select class="monthly-calculation-terceirizado-auto" disabled style="background-color: #2c2c2c; color: #b0b0b0;">
                <option value="proportional" ${(entryData.monthly_calculation_override_terceirizado || equipConfig?.monthly_calculation_terceirizado || equipConfig?.monthly_calculation) === 'proportional' ? 'selected' : ''}>Proporção</option>
                <option value="fixed_30" ${(entryData.monthly_calculation_override_terceirizado || equipConfig?.monthly_calculation_terceirizado || equipConfig?.monthly_calculation) === 'fixed_30' ? 'selected' : ''}>Fixo 30 dias</option>
            </select>
        </div>
        <div class="form-group">
            <label>Tipo Cálculo Mensal Terc. Manual</label>
            <select class="monthly-calculation-terceirizado-manual">
                <option value="">Automático</option>
                <option value="proportional" ${entryData.monthly_calculation_manual_terceirizado === 'proportional' ? 'selected' : ''}>Proporção</option>
                <option value="fixed_30" ${entryData.monthly_calculation_manual_terceirizado === 'fixed_30' ? 'selected' : ''}>Fixo 30 dias</option>
            </select>
        </div>
    ` : '';

    const operatorName = operatorId ? (appState.employees.find(emp => emp.id == operatorId)?.name || 'N/A') : 'Não definido';

    let substitutionSectionHtml = '';
    if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        const allEquipmentInWork = work?.config?.equipment || [];
        
        const substitutedEquipmentOptionsArray = allEquipmentInWork
            .filter(ec => parseInt(ec.equipment_id) !== parseInt(equip.id))
            .map(ec => {
                const otherEquip = appState.equipment.find(e => e.id === parseInt(ec.equipment_id));
                if (!otherEquip) {
                    return null;
                }
                
                const otherEquipConfig = work?.config?.equipment?.find(cfg => parseInt(cfg.equipment_id) === parseInt(otherEquip.id));
                const isGuaranteedHours = otherEquipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS;
                const selected = currentSubstitution?.substituted_equipment_id == otherEquip.id ? 'selected' : '';
                
                const parts = [
                    otherEquip.type,
                    otherEquip.prefix,
                    otherEquip.brand,
                    otherEquip.model,
                    otherEquip.year,
                    otherEquip.characteristic,
                    otherEquip.capacidade
                ].filter(Boolean);

                const displayText = parts.join(' - ');

                return `<option value="${otherEquip.id}" ${selected}>${displayText} ${isGuaranteedHours ? '(Horas de Garantia)' : ''}</option>`;
            })
            .filter(option => option !== null);

        const substitutedEquipmentOptions = substitutedEquipmentOptionsArray.join('');

        substitutionSectionHtml = `
            <div class="substitution-section">
                <fieldset>
                    <legend>Substituição de Equipamento (Horas de Garantia)</legend>
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
                        <div class="form-group">
                            <label for="substituted-equipment-select-${entryData.date}">Substituindo Equipamento</label>
                            <select id="substituted-equipment-select-${entryData.date}" class="substituted-equipment-select">
                                <option value="">Nenhum</option>
                                ${substitutedEquipmentOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="substitution-date-input-${entryData.date}">Data da Substituição</label>
                            <input type="date" id="substitution-date-input-${entryData.date}" class="substitution-date-input" value="${currentSubstitution?.substitution_date || ''}">
                        </div>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm clear-substitution-btn" style="margin-top: 10px; display: ${currentSubstitution ? 'block' : 'none'};">Limpar Substituição</button>
                    <input type="hidden" class="substitution-id" value="${currentSubstitution?.id || ''}">
                    <input type="hidden" class="substituted-monthly-value" value="${currentSubstitution?.substituted_equipment_monthly_value || ''}">
                    <input type="hidden" class="substituted-guaranteed-hours" value="${currentSubstitution?.substituted_equipment_guaranteed_hours || ''}">
                </fieldset>
            </div>
        `;
    }

    // Gerar badges de alerta para seções recolhidas
    const alertBadges = [];
    
    // Verificar paradas com cálculo de desconto
    const stoppages = entryData.stoppages || [];
    // Suporta tanto type_id (salvo pelo card) quanto stoppage_type_id (legado/bulk antigo)
    const stoppagesWithType = stoppages.filter(s => s.type_id || s.stoppage_type_id);
    if (stoppagesWithType.length > 0) {
        // Calcular total de horas de parada e desconto
        let totalStoppageMinutes = 0;
        let totalStoppageDiscount = 0;
        
        const timeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        
        // Determinar tarifa horária para cálculo de desconto
        let hourlyRate = 0;
        if (equipConfig) {
            const measurementType = equipConfig.measurement_type;
            if (measurementType === 'guaranteed_hours') {
                // Para garantia de horas, calcular taxa = valor mensal / horas garantidas
                const monthlyValue = parseFloat(equipConfig.measurement_value) || 0;
                const guaranteedHours = parseFloat(equipConfig.guaranteed_hours) || 200;
                hourlyRate = monthlyValue / guaranteedHours;
            } else if (measurementType === 'hourly' && equipConfig.measurement_value) {
                hourlyRate = parseFloat(equipConfig.measurement_value) || 0;
            } else if (measurementType === 'daily' && equipConfig.measurement_value) {
                hourlyRate = (parseFloat(equipConfig.measurement_value) || 0) / 8;
            } else if (measurementType === 'monthly' && equipConfig.measurement_value) {
                hourlyRate = (parseFloat(equipConfig.measurement_value) || 0) / 200;
            }
        }
        
        stoppagesWithType.forEach(stoppage => {
            let stoppageMinutes = 0;
            
            // Prioridade 1: hours_decimal
            if (stoppage.hours_decimal) {
                const decimal = parseFloat(stoppage.hours_decimal);
                if (!isNaN(decimal)) {
                    stoppageMinutes = decimal * 60;
                }
            }
            // Prioridade 2: hours_hhmm
            else if (stoppage.hours_hhmm) {
                const parts = stoppage.hours_hhmm.split(':');
                if (parts.length === 2) {
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    stoppageMinutes = (hours * 60) + minutes;
                }
            }
            // Prioridade 3: start/end (aceita start_time/end_time como legado)
            else {
                const workConfig = work?.config || {};
                const shiftStartStr = workConfig.day_shift_start || '07:00';
                const shiftEndStr   = workConfig.day_shift_end   || '17:00';
                const mealStartStr  = workConfig.day_meal_start  || '';
                const mealEndStr    = workConfig.day_meal_end    || '';

                const subtractMeal = (startMin, endMin) => {
                    if (!mealStartStr || !mealEndStr) return endMin - startMin;
                    const mS = timeToMinutes(mealStartStr);
                    const mE = timeToMinutes(mealEndStr);
                    const inter = Math.max(0, Math.min(endMin, mE) - Math.max(startMin, mS));
                    return (endMin - startMin) - inter;
                };

                const startTime = stoppage.start ?? stoppage.start_time ?? null;
                const endTime   = stoppage.end   ?? stoppage.end_time   ?? null;

                if (!startTime && !endTime) {
                    const s = timeToMinutes(shiftStartStr);
                    const e = timeToMinutes(shiftEndStr);
                    stoppageMinutes = subtractMeal(s, e);
                } else if (!startTime && endTime) {
                    const s = timeToMinutes(shiftStartStr);
                    const e = timeToMinutes(endTime);
                    let raw = e - s; if (raw < 0) raw += 24 * 60;
                    stoppageMinutes = subtractMeal(s, s + raw);
                } else if (startTime && !endTime) {
                    const s = timeToMinutes(startTime);
                    const e = timeToMinutes(shiftEndStr);
                    let raw = e - s; if (raw < 0) raw += 24 * 60;
                    stoppageMinutes = subtractMeal(s, s + raw);
                } else {
                    const s = timeToMinutes(startTime);
                    const e = timeToMinutes(endTime);
                    let raw = e - s; if (raw < 0) raw += 24 * 60;
                    stoppageMinutes = subtractMeal(s, s + raw);
                }
            }
            
            totalStoppageMinutes += stoppageMinutes;
            
            // Calcular desconto se for parada dedutível (suporta type_id e stoppage_type_id)
            const stoppageTypeKey = (stoppage.type_id || stoppage.stoppage_type_id)?.toString();
            if (equipConfig?.deductible_stoppages?.includes(stoppageTypeKey)) {
                const discountValue = (stoppageMinutes / 60) * hourlyRate;
                totalStoppageDiscount += discountValue;
            }
        });
        
        const hours = Math.floor(totalStoppageMinutes / 60);
        const mins = totalStoppageMinutes % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        
        let badge = `⚠️ PARADA - ${timeStr}`;
        if (totalStoppageDiscount > 0) {
            badge += ` - DESCONTO: ${formatCurrency(totalStoppageDiscount)}`;
        }
        if (stoppagesWithType.length > 1) badge += ` (${stoppagesWithType.length})`;
        
        alertBadges.push(`<span class="alert-badge alert-badge-stoppage">${badge}</span>`);
    }
    
    // Verificar observações/despesas/acréscimos
    const notes = entryData.notes || [];
    const observacoesCount = notes.filter(n => n.note_type === 'observacao').length;
    const despesasCount = notes.filter(n => n.note_type === 'despesa').length;
    const acrescimosCount = notes.filter(n => n.note_type === 'acrescimo').length;
    
    if (observacoesCount > 0) {
        alertBadges.push(`<span class="alert-badge alert-badge-observacao">📝 OBSERVAÇÃO REGISTRADA${observacoesCount > 1 ? ` (${observacoesCount})` : ''}</span>`);
    }
    if (despesasCount > 0) {
        alertBadges.push(`<span class="alert-badge alert-badge-despesa">💰 DESPESA REGISTRADA${despesasCount > 1 ? ` (${despesasCount})` : ''}</span>`);
    }
    if (acrescimosCount > 0) {
        alertBadges.push(`<span class="alert-badge alert-badge-acrescimo">➕ ACRÉSCIMO REGISTRADO${acrescimosCount > 1 ? ` (${acrescimosCount})` : ''}</span>`);
    }
    
    // Verificar mobilização/desmobilização
    if (entryData.is_mobilization) {
        alertBadges.push(`<span class="alert-badge alert-badge-mobilizacao">🚛 MOBILIZAÇÃO</span>`);
    }
    if (entryData.is_demobilized) {
        alertBadges.push(`<span class="alert-badge alert-badge-desmobilizacao">🏁 DESMOBILIZAÇÃO</span>`);
    }
    
    // Verificar avarias para esta data e equipamento
    if (appState.damages) {
        // Filtrar avarias que tenham impacto financeiro (acréscimo ou desconto) para cliente OU terceirizado
        const damagesCount = appState.damages.filter(damage => {
            if (damage.equipment_id != entryData.equipment_id || damage.damage_date !== entryData.date) {
                return false;
            }
            
            // Verificar se tem impacto financeiro (cliente OU terceirizado)
            const hasClientImpact = damage.client_impact_type === 'add_client' || damage.client_impact_type === 'disc_client';
            const hasThirdPartyImpact = damage.terceirizado_impact_type === 'add_terceirizado' || damage.terceirizado_impact_type === 'disc_terceirizado';
            
            return hasClientImpact || hasThirdPartyImpact;
        }).length;
        
        if (damagesCount > 0) {
            alertBadges.push(`<span class="alert-badge alert-badge-avaria">🔧 AVARIA REGISTRADA${damagesCount > 1 ? ` (${damagesCount})` : ''}</span>`);
        }
    }
    
    // 💰 DESPESAS GERAIS DA OBRA (no período da BM)
    if (bmLabel && work?.config?.measurement_periods && appState.expenses) {
        const bmNumber = parseInt(bmLabel.replace('BM', '').trim());
        const period = work.config.measurement_periods[bmNumber - 1];
        
        console.log('🔍 [BADGE DESPESAS] Verificando despesas gerais:', {
            bmLabel,
            bmNumber,
            period,
            hasExpenses: !!appState.expenses,
            expensesCount: appState.expenses?.length || 0
        });
        
        if (period) {
            // Buscar despesas gerais da obra (sem equipment_id) no período da BM
            const generalExpenses = appState.expenses.filter(exp => {
                const match = exp.work_id == entryData.work_id &&
                    !exp.equipment_id && // Despesa geral (sem equipamento específico)
                    exp.expense_date >= period.start &&
                    exp.expense_date <= period.end;
                
                if (exp.work_id == entryData.work_id) {
                    console.log('🔍 [BADGE] Despesa:', {
                        id: exp.id,
                        date: exp.expense_date,
                        equipment_id: exp.equipment_id,
                        value: exp.total_value,
                        isGeneral: !exp.equipment_id,
                        inPeriod: exp.expense_date >= period.start && exp.expense_date <= period.end,
                        match
                    });
                }
                
                return match;
            });
            
            console.log('🔍 [BADGE DESPESAS] Despesas gerais encontradas:', generalExpenses.length);
            
            if (generalExpenses.length > 0) {
                const totalGeneralExpenses = generalExpenses.reduce((sum, exp) => sum + (parseFloat(exp.total_value) || 0), 0);
                console.log('✅ [BADGE] Adicionando badge de despesas gerais:', formatCurrency(totalGeneralExpenses));
                alertBadges.push(`<span class="alert-badge alert-badge-general-expense" style="background-color: #FFA500; color: #fff;">💼 DESPESAS GERAIS: ${formatCurrency(totalGeneralExpenses)}</span>`);
            }
        }
    }
    
    // 💰 DESPESA ESPECÍFICA DO EQUIPAMENTO (na data específica)
    if (appState.expenses) {
        const equipmentExpenses = appState.expenses.filter(exp => 
            exp.work_id == entryData.work_id &&
            exp.equipment_id == entryData.equipment_id &&
            exp.expense_date === entryData.date
        );
        
        if (equipmentExpenses.length > 0) {
            const totalEquipmentExpenses = equipmentExpenses.reduce((sum, exp) => sum + (parseFloat(exp.total_value) || 0), 0);
            alertBadges.push(`<span class="alert-badge alert-badge-equipment-expense" style="background-color: #DC143C; color: #fff;">🔴 DESPESA DE EQUIPAMENTO: ${formatCurrency(totalEquipmentExpenses)}</span>`);
        }
    }
    
    const alertBadgesHtml = alertBadges.length > 0 ? `<div class="alert-badges-container">${alertBadges.join('')}</div>` : '<div class="alert-badges-container"></div>';

    // 🎯 VERIFICAR STATUS DE MOBILIZAÇÃO/DESMOBILIZAÇÃO
    let equipmentStatusHtml = '';
    let demobilizationMessageHtml = ''; // Apenas a palavra "DESMOBILIZADO"
    let demobilizationDateHtml = ''; // Data separada para linha de baixo
    let lastMobilizationDate = null; // Para exibir MOB: DD/MM/YYYY
    let isDemobilized = false; // Declarar fora do try para usar no template HTML
    
    try {
        // Buscar última desmobilização antes ou na data atual
        const currentDate = new Date(entryData.date + 'T00:00:00');
        const allEntriesForEquip = appState.daily_entries?.filter(e => 
            e.work_id == entryData.work_id && 
            e.equipment_id == entryData.equipment_id
        ) || [];
        
        // Ordenar por data
        const sortedEntries = [...allEntriesForEquip].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Encontrar última desmobilização e mobilização antes ou na data atual
        let lastDemobilization = null;
        let lastMobilization = null;
        
        for (const entry of sortedEntries) {
            const entryDate = new Date(entry.date + 'T00:00:00');
            if (entryDate > currentDate) break; // Para quando passar da data atual
            
            if (entry.is_demobilized) {
                lastDemobilization = entry;
            }
            if (entry.is_mobilization) {
                lastMobilization = entry;
                lastMobilizationDate = entry.date; // Guardar data da última mobilização
            }
        }
        
        // Determinar se está desmobilizado: última operação foi desmobilização
        isDemobilized = lastDemobilization && 
            (!lastMobilization || new Date(lastDemobilization.date) >= new Date(lastMobilization.date));
        
        const hasAnyMobilization = sortedEntries.some(e => e.is_mobilization || e.is_worked);
        
        if (isDemobilized) {
            // Bolinha vermelha (desmobilizado)
            equipmentStatusHtml = '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff4444; box-shadow: 0 0 4px rgba(255, 68, 68, 0.5); margin-right: 5px;" title="Equipamento Desmobilizado"></span>';
            
            // Mensagem de desmobilização com data no formato DESMOB: DD/MM/YYYY
            const demobDate = new Date(lastDemobilization.date + 'T00:00:00');
            const formattedDate = demobDate.toLocaleDateString('pt-BR');
            demobilizationMessageHtml = `<span style="color: #ff4444; font-weight: bold; font-size: 0.9em; margin-left: 8px;">DESMOB: ${formattedDate}</span>`;
        } else if (hasAnyMobilization) {
            // Bolinha verde (ativo/mobilizado)
            equipmentStatusHtml = '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #44ff44; box-shadow: 0 0 4px rgba(68, 255, 68, 0.5); margin-right: 5px;" title="Equipamento Ativo"></span>';
        } else {
            // Bolinha cinza (nunca mobilizado)
            equipmentStatusHtml = '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #999999; box-shadow: 0 0 4px rgba(153, 153, 153, 0.5); margin-right: 5px;" title="Nunca Mobilizado"></span>';
        }
    } catch (error) {
        console.error('Erro ao verificar status de mobilização:', error);
    }
    
    return `
        <div class="entry-card collapsed" data-date="${entryData.date}" ${entryData.id ? `data-id="${entryData.id}"` : ''} data-work-id="${entryData.work_id}" data-equipment-id="${entryData.equipment_id}" data-bm-label="${bmLabel}">
            <div class="entry-card-header collapsible-header">
                <!-- LINHA 1: TUDO NA MESMA LINHA HORIZONTAL -->
                <div class="header-values-container" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; font-size: 0.9em; margin-bottom: 4px; line-height: 1.5; position: relative; padding-top: 6px; padding-right: 7px;">
                    <div style="position: absolute; top: -5px; right: -10px; z-index: 10;">${equipmentStatusHtml}</div>
                    <span style="color: #00d4ff; white-space: nowrap;"><strong>Obra:</strong> ${work?.name || 'N/A'}</span>
                    <span style="color: #ff6ec7; white-space: nowrap;"><strong>Cliente:</strong> ${work?.client_companies?.name || 'N/A'}</span>
                    <span style="color: #999;">-</span>
                    <span style="white-space: nowrap;">Val. Manual <input type="number" step="0.01" class="daily-manual-value-header" value="${entryData.daily_manual_value ?? ''}" placeholder="R$" style="width: 65px; padding: 2px 3px; font-size: 0.85em; background: #2a2a2a; border: 1px solid #555; color: #fff; margin-left: 5px;"></span>
                    ${valuesLine}
                </div>
                
                <!-- LINHA 2: Nome do equipamento + campos inline -->
                <div class="equipment-info-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px;">
                    <div class="header-date-info" style="flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
                        <span class="collapse-icon" style="cursor: pointer; font-size: 1.2em; color: #64b5f6; user-select: none;">▼</span>
                        <div style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h4><span style="color: #FFF; font-weight: bold;">${equip?.prefix}${equipConfig?.equipment_work_prefix ? ` (${equipConfig.equipment_work_prefix})` : ''}</span> | <span style="color: #FFD54F; font-weight: bold;">${dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span> ${lastMobilizationDate ? `<span style="color: #00D4FF; font-size: 0.9em; margin-left: 8px;">MOB: ${new Date(lastMobilizationDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''} ${demobilizationMessageHtml} ${thirdPartyCompany ? `<span class="terceirizado-owner">(${thirdPartyCompany.name})</span>` : ''}</h4>
                                <small style="color: #b0b0b0; font-style: italic; font-size: 0.8em;">👤 OP:</small>
                            </div>
                            <div class="status-labels" style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    ${bmLabel ? `<span class="bm-label" style="color: #DDA0DD !important;">${bmLabel}${bmDateRange}</span>` : ''}
                                    ${currentSubstitution ? `<span class="substitution-indicator">🔄 Substituindo ${appState.equipment.find(e => e.id == currentSubstitution.substituted_equipment_id)?.prefix || 'N/A'}</span>` : ''}
                                </div>
                                <span style="color: #b0b0b0; font-style: italic; font-size: 0.8em;">${operatorName}</span>
                            </div>
                            ${alertBadgesHtml}
                        </div>
                    </div>
                    <div class="horometer-km-toggles" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 0.8em;">
                        ${(() => {
                            const lastHorometer = getLastHorometer(equip.id, entryData.date);
                            if (lastHorometer) {
                                const dateObj = new Date(lastHorometer.date + 'T00:00:00');
                                const day = dateObj.getDate().toString().padStart(2, '0');
                                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                                const year = dateObj.getFullYear();
                                const dateFormatted = `${day}/${month}/${year}`;
                                return `
                                    <div class="form-group" style="margin: 0; background: #1a1a1a; padding: 4px 6px; border-radius: 4px; border: 1px solid #555;">
                                        <label style="font-size: 1.15em; margin-bottom: 0; color: #aaa; white-space: nowrap; font-weight: 600;">${dateFormatted}</label>
                                        <div style="font-weight: bold; color: #64b5f6; font-size: 0.9em; line-height: 1;">${lastHorometer.value.toFixed(2)}</div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">Horímetro Inicial</label>
                            <input type="number" step="0.01" class="horometer-start" value="${entryData.horometer_start || ''}" style="width: 80px; padding: 2px 4px; font-size: 0.85em;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">Horímetro Final</label>
                            <input type="number" step="0.01" class="horometer-end" value="${entryData.horometer_end || ''}" style="width: 80px; padding: 2px 4px; font-size: 0.85em;">
                        </div>
                        ${(() => {
                            const lastKm = getLastKm(equip.id, entryData.date);
                            if (lastKm) {
                                const dateObj = new Date(lastKm.date + 'T00:00:00');
                                const day = dateObj.getDate().toString().padStart(2, '0');
                                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                                const year = dateObj.getFullYear();
                                const dateFormatted = `${day}/${month}/${year}`;
                                return `
                                    <div class="form-group" style="margin: 0; background: #1a1a1a; padding: 4px 6px; border-radius: 4px; border: 1px solid #555;">
                                        <label style="font-size: 1.15em; margin-bottom: 0; color: #aaa; white-space: nowrap; font-weight: 600;">${dateFormatted}</label>
                                        <div style="font-weight: bold; color: #FFD700; font-size: 0.9em; line-height: 1;">${lastKm.value.toFixed(2)}</div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">KM Inicial</label>
                            <input type="number" step="0.01" class="km-start" value="${entryData.km_start || ''}" style="width: 80px; padding: 2px 4px; font-size: 0.85em;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">KM Final</label>
                            <input type="number" step="0.01" class="km-end" value="${entryData.km_end || ''}" style="width: 80px; padding: 2px 4px; font-size: 0.85em;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">Horas Rodadas</label>
                            <span class="daily-run-hours-display" style="font-weight: bold; color: #90EE90;">0.00</span>
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.75em; margin-bottom: 2px;">KM Rodados</label>
                            <span class="daily-run-km-display" style="font-weight: bold; color: #90EE90;">0.00</span>
                        </div>
                        ${monthlyCalculationHtml}
                        ${terceirizadoMonthlyCalculationHtml}
                    </div>
                </div>
                
                <div class="summary-totals">
                    <strong>Horas Acumuladas do Dia: </strong><span class="cumulative-run-hours-display">0.00</span>
                    <strong style="margin-left: 15px;">KM Acumulados do Dia: </strong><span class="cumulative-run-km-display">0.00</span>
                </div>
                
                <div class="summary-totals" style="margin-top: 5px; color: #4CAF50; font-weight: 600;">
                    <strong>Horas Acumuladas no Período: </strong><span class="period-run-hours-display">0.00</span>
                    <strong style="margin-left: 15px;">KM Acumulados no Período: </strong><span class="period-run-km-display">0.00</span>
                </div>
                
                <div class="quick-toggles">
                    <div class="form-group"><input type="checkbox" class="is-worked-check" ${entryData.is_worked ? 'checked' : ''}> <label>Trab.</label></div>
                
                    <div class="form-group-with-suboptions" style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div class="form-group" style="margin: 0;">
                        <input type="checkbox" class="mobilize-check" ${entryData.is_mobilization ? 'checked' : ''}> <label>Mob.</label>
                    </div>
                    <div class="mobilization-suboptions" style="display: ${entryData.is_mobilization ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <label style="font-size: 0.75rem; margin: 0; white-space: nowrap;">Contabilizar Mob.?</label>
                            <select class="is-mobilization-contabilized" style="width: 80px; background-color: #3a3a3a; color: #e0e0e0; border: 1px solid #555; padding: 4px;">
                                <option value="1" ${entryData.is_mobilization_contabilized === 1 || entryData.is_mobilization_contabilized === null ? 'selected' : ''}>Sim</option>
                                <option value="0" ${entryData.is_mobilization_contabilized === 0 ? 'selected' : ''}>Não</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <label style="font-size: 0.75rem; margin: 0; white-space: nowrap;">Valor Manual Mob. (R$)</label>
                            <input type="number" step="0.01" class="mobilization-manual-value" value="${entryData.mobilization_manual_value ?? ''}" placeholder="Padrão: Config. Obra" style="width: 100px; background-color: #3a3a3a; color: #e0e0e0; border: 1px solid #555; padding: 4px;">
                        </div>
                    </div>
                </div>

                <div class="form-group-with-suboptions" style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div class="form-group" style="margin: 0;">
                        <input type="checkbox" class="demobilize-check" ${entryData.is_demobilized ? 'checked' : ''}> <label>Desmob.</label>
                    </div>
                    <div class="demobilization-suboptions" style="display: ${entryData.is_demobilized ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <label style="font-size: 0.75rem; margin: 0; white-space: nowrap;">Contabilizar Desmob.?</label>
                            <select class="is-demobilization-contabilized" style="width: 80px; background-color: #3a3a3a; color: #e0e0e0; border: 1px solid #555; padding: 4px;">
                                <option value="1" ${entryData.is_demobilization_contabilized === 1 || entryData.is_demobilization_contabilized === null ? 'selected' : ''}>Sim</option>
                                <option value="0" ${entryData.is_demobilization_contabilized === 0 ? 'selected' : ''}>Não</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <label style="font-size: 0.75rem; margin: 0; white-space: nowrap;">Valor Manual Desmob. (R$)</label>
                            <input type="number" step="0.01" class="demobilization-manual-value" value="${entryData.demobilization_manual_value ?? ''}" placeholder="Padrão: Config. Obra" style="width: 100px; background-color: #3a3a3a; color: #e0e0e0; border: 1px solid #555; padding: 4px;">
                        </div>
                    </div>
                </div>

                    <div class="form-group"><input type="checkbox" class="pay-salary-check" ${entryData.pay_salary !== false ? 'checked' : ''}> <label>Salário</label></div>
                    <div class="form-group daily-part-received-toggle">
                        <input type="checkbox" class="is-daily-part-received-check" id="daily-part-received-${entryData.id || entryData.date}" ${initialDailyPartStatus ? 'checked' : ''}>
                        <label for="daily-part-received-${entryData.id || entryData.date}" style="color: #64b5f6;">Parte Diária Recebida</label>
                    </div>
                    <button type="button" class="btn btn-success btn-sm save-entry-btn-header">Salvar</button>
                    <button type="button" class="btn btn-primary btn-sm save-all-entries-btn-card" style="margin-left: 5px;">Salvar Todos Lançamentos Visíveis</button>
                </div>
            </div>
            
            <div class="entry-card-content" data-content-id="${entryData.id || entryData.date}">
                <div class="form-grid">
                     <div class="form-group"><label>Operador</label><select class="operator-id"><option value="">Selecione...</option>${employeeOptions}</select></div>
                </div>
                
                ${substitutionSectionHtml}
                
                <div style="margin-top:15px;"><fieldset><legend>Paradas</legend><div class="stoppages-container">${stoppagesHtml}</div><button type="button" class="btn btn-secondary btn-sm add-stoppage-btn" style="margin-top: 5px;">+ Parada</button></fieldset></div>
                <div style="margin-top:15px;"><fieldset><legend>Observações / Despesas / Acréscimos</legend><div class="notes-container">${notesHtml}</div><button type="button" class="btn btn-secondary btn-sm add-note-btn" style="margin-top: 5px;">+ Item</button></fieldset></div>
            </div>
        </div>
    `;
};

// Funções auxiliares para tipo de cálculo
const getEffectiveMonthlyCalculationType = (card) => {
    // Primeiro, tentar pegar do campo hidden que armazena o tipo efetivo
    const effectiveTypeInput = card.querySelector('.effective-monthly-calculation-type');
    if (effectiveTypeInput && effectiveTypeInput.value) {
        return effectiveTypeInput.value;
    }

    // Fallback para a lógica original
    const manualSelect = card.querySelector('.monthly-calculation-manual');
    const autoSelect = card.querySelector('.monthly-calculation-auto');
    
    if (manualSelect && manualSelect.value !== '') {
        return manualSelect.value;
    }
    
    return autoSelect ? autoSelect.value : 'proportional';
};


const getEffectiveMonthlyCalculationTypeTerceirizado = (card) => {
    // Primeiro, tentar pegar do campo hidden que armazena o tipo efetivo
    const effectiveTypeInput = card.querySelector('.effective-monthly-calculation-type-terceirizado');
    if (effectiveTypeInput && effectiveTypeInput.value) {
        return effectiveTypeInput.value;
    }

    // Fallback para a lógica original
    const manualSelectTerc = card.querySelector('.monthly-calculation-terceirizado-manual');
    const autoSelectTerc = card.querySelector('.monthly-calculation-terceirizado-auto');
    
    if (manualSelectTerc && manualSelectTerc.value !== '') {
        return manualSelectTerc.value;
    }
    
    return autoSelectTerc ? autoSelectTerc.value : 'proportional';
};

// Função principal de verificação automática
const updateMonthlyCalculationType = async (card, isWorkedChecked = null) => {
    const workId = card.dataset.workId || entryWorkSelect?.value;
    const equipmentId = card.dataset.equipmentId || entryEquipmentSelect?.value;
    const currentDate = card.dataset.date;
    
    if (!workId || !equipmentId || !currentDate) return;

    const work = appState.works.find(w => w.id == workId);
    const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);
    
    if (!equipConfig || equipConfig.measurement_type !== 'monthly') return;

    let bmLabel = card.dataset.bmLabel;
    if (!bmLabel && work.config?.measurement_periods) {
        bmLabel = getBMLabelForDate(currentDate, work.config.measurement_periods);
        if (bmLabel) card.dataset.bmLabel = bmLabel;
    }
    
    if (!bmLabel) return;

    try {
        const measurementPeriods = work.config?.measurement_periods || [];
        const currentPeriod = measurementPeriods.find(period => {
            const periodStart = new Date(period.start + 'T00:00:00');
            const periodEnd = new Date(period.end + 'T00:00:00');
            const checkDate = new Date(currentDate + 'T00:00:00');
            return checkDate >= periodStart && checkDate <= periodEnd;
        });

        if (!currentPeriod) return;

        const periodStart = new Date(currentPeriod.start + 'T00:00:00');
        const periodEnd = new Date(currentPeriod.end + 'T00:00:00');
        
        // Calcular total de dias no período
        const totalDaysInPeriod = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;

        const allCardsInPeriod = Array.from(document.querySelectorAll(`
            .entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"]
        `));

        // Verificar quais dias estão trabalhados
        let workedDays = [];
        allCardsInPeriod.forEach(periodCard => {
            const cardDate = periodCard.dataset.date;
            const isWorkedCheck = periodCard.querySelector('.is-worked-check');
            
            let isWorked = false;
            if (periodCard === card && isWorkedChecked !== null) {
                isWorked = isWorkedChecked;
            } else {
                isWorked = isWorkedCheck ? isWorkedCheck.checked : false;
            }
            
            if (isWorked) {
                workedDays.push(cardDate);
            }
        });

        // LÓGICA CORRETA: Para equipamento mobilizado no meio do mês
        // Se não trabalhou o primeiro OU último dia, usa FIXO 30 DIAS
        let automaticType = 'fixed_30'; // padrão para casos incompletos

        // Verificar se é fevereiro (sempre proporção)
        const startMonth = periodStart.getMonth() + 1;
        const endMonth = periodEnd.getMonth() + 1;
        const isFevereiro = (startMonth === 2 || endMonth === 2);

        if (isFevereiro) {
            // Fevereiro sempre usa proporção
            automaticType = 'proportional';
            console.log(`[DEBUG] Período inclui fevereiro - sempre proporção`);
        } else if (totalDaysInPeriod === 31) {
            // APENAS para períodos de exatamente 31 dias
            const firstDayWorked = workedDays.includes(currentPeriod.start);
            const lastDayWorked = workedDays.includes(currentPeriod.end);
            
            if (firstDayWorked && lastDayWorked) {
                automaticType = 'proportional';  // 31 dias completos = proporção
                console.log(`[DEBUG] Período de 31 dias COMPLETO (primeiro E último trabalhados) = PROPORÇÃO`);
            } else {
                automaticType = 'fixed_30';  // 31 dias incompletos = fixo 30
                console.log(`[DEBUG] Período de 31 dias INCOMPLETO (falta primeiro OU último) = FIXO 30 DIAS`);
            }
        } else {
            // Período não tem 31 dias - sempre fixo 30 dias
            automaticType = 'fixed_30';
            console.log(`[DEBUG] Período não tem 31 dias (${totalDaysInPeriod} dias) = sempre FIXO 30 DIAS`);
        }

        console.log(`[DEBUG] Período: ${currentPeriod.start} a ${currentPeriod.end}`);
        console.log(`[DEBUG] Total de dias: ${totalDaysInPeriod}`);
        console.log(`[DEBUG] Dias trabalhados: ${workedDays.length}`, workedDays);
        console.log(`[DEBUG] Primeiro dia (${currentPeriod.start}) trabalhado: ${workedDays.includes(currentPeriod.start)}`);
        console.log(`[DEBUG] Último dia (${currentPeriod.end}) trabalhado: ${workedDays.includes(currentPeriod.end)}`);
        console.log(`[DEBUG] Tipo automático determinado: ${automaticType}`);

        // Atualizar todos os cartões do período
        allCardsInPeriod.forEach(periodCard => {
            const autoSelect = periodCard.querySelector('.monthly-calculation-auto');
            const autoSelectTerc = periodCard.querySelector('.monthly-calculation-terceirizado-auto');
            
            // NOVA ADIÇÃO: Criar campo hidden para armazenar o tipo efetivo
            let effectiveTypeInput = periodCard.querySelector('.effective-monthly-calculation-type');
            if (!effectiveTypeInput) {
                effectiveTypeInput = document.createElement('input');
                effectiveTypeInput.type = 'hidden';
                effectiveTypeInput.className = 'effective-monthly-calculation-type';
                periodCard.appendChild(effectiveTypeInput);
            }

            if (autoSelect) {
                autoSelect.value = automaticType;
                
                // Determinar o tipo efetivo (manual sobrescreve automático)
                const manualSelect = periodCard.querySelector('.monthly-calculation-manual');
                const effectiveType = (manualSelect && manualSelect.value !== '') ? 
                    manualSelect.value : automaticType;
                
                // Armazenar o tipo efetivo no campo hidden
                effectiveTypeInput.value = effectiveType;
                
                console.log(`[DEBUG] Cartão ${periodCard.dataset.date}: Auto=${automaticType}, Manual=${manualSelect?.value || 'vazio'}, Efetivo=${effectiveType}`);
            }

            if (autoSelectTerc) {
                autoSelectTerc.value = automaticType;
                
                // Mesmo para terceirizado
                let effectiveTypeTercInput = periodCard.querySelector('.effective-monthly-calculation-type-terceirizado');
                if (!effectiveTypeTercInput) {
                    effectiveTypeTercInput = document.createElement('input');
                    effectiveTypeTercInput.type = 'hidden';
                    effectiveTypeTercInput.className = 'effective-monthly-calculation-type-terceirizado';
                    periodCard.appendChild(effectiveTypeTercInput);
                }

                const manualSelectTerc = periodCard.querySelector('.monthly-calculation-terceirizado-manual');
                const effectiveTypeTerc = (manualSelectTerc && manualSelectTerc.value !== '') ? 
                    manualSelectTerc.value : automaticType;
                
                effectiveTypeTercInput.value = effectiveTypeTerc;
            }

            calculateAndDisplayDailyTotal(periodCard);
        });

    } catch (error) {
        console.error('Erro ao atualizar tipo de cálculo mensal:', error);
    }
};


const setupTabNavigation = () => {
    // Remove listeners existentes para evitar duplicação
    document.querySelectorAll('.horometer-start, .horometer-end, .km-end').forEach(input => {
        input.removeEventListener('keydown', handleTabNavigation);
    });

    // Adiciona novos listeners para horímetro inicial e final
    document.querySelectorAll('.horometer-start, .horometer-end').forEach(input => {
        input.addEventListener('keydown', handleTabNavigation);
    });

    document.querySelectorAll('.km-end').forEach(input => {
        input.addEventListener('keydown', handleTabNavigation);
    });
};

const handleTabNavigation = (event) => {
    // Intercepta Tab (sem Shift) ou Enter
    if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'Enter') {
        const currentInput = event.target;
        const currentCard = currentInput.closest('.entry-card');
        
        if (!currentCard) return;

        // Se é horímetro inicial
        if (currentInput.classList.contains('horometer-start')) {
            event.preventDefault();
            
            // Move o foco para o horímetro FINAL do mesmo cartão
            const horometerEnd = currentCard.querySelector('.horometer-end');
            if (horometerEnd) {
                horometerEnd.focus();
                horometerEnd.select();
            }
            return;
        }

        // Se é horímetro final
        if (currentInput.classList.contains('horometer-end')) {
            event.preventDefault();
            
            // Procurar o próximo cartão
            const nextCard = currentCard.nextElementSibling;
            if (nextCard && nextCard.classList.contains('entry-card')) {
                // Preenche automaticamente o horímetro inicial do próximo cartão
                const nextHorometerStart = nextCard.querySelector('.horometer-start');
                if (nextHorometerStart && currentInput.value && !nextHorometerStart.value) {
                    nextHorometerStart.value = currentInput.value;
                    nextHorometerStart.dispatchEvent(new Event('change'));
                }
                
                // Move o foco DIRETAMENTE para o horímetro FINAL do próximo cartão
                const nextHorometerEnd = nextCard.querySelector('.horometer-end');
                if (nextHorometerEnd) {
                    nextHorometerEnd.focus();
                    nextHorometerEnd.select(); // Seleciona o texto para facilitar edição
                    return;
                }
            }
            
            // Se não encontrou próximo cartão, vai para KM inicial do mesmo cartão (comportamento padrão)
            const kmStart = currentCard.querySelector('.km-start');
            if (kmStart) {
                kmStart.focus();
            }
        }
        
        // Se é KM final
        else if (currentInput.classList.contains('km-end')) {
            event.preventDefault();
            
            // Procurar o próximo cartão
            const nextCard = currentCard.nextElementSibling;
            if (nextCard && nextCard.classList.contains('entry-card')) {
                const nextKmStart = nextCard.querySelector('.km-start');
                if (nextKmStart) {
                    // Preenche automaticamente com o valor do KM final atual
                    if (currentInput.value && !nextKmStart.value) {
                        nextKmStart.value = currentInput.value;
                        nextKmStart.dispatchEvent(new Event('change'));
                    }
                    
                    // Move o foco para o KM final do próximo cartão
                    const nextKmEnd = nextCard.querySelector('.km-end');
                    if (nextKmEnd) {
                        nextKmEnd.focus();
                        nextKmEnd.select(); // Seleciona o texto para facilitar edição
                    }
                    return;
                }
            }
            
            // Se não encontrou próximo cartão, vai para o próximo campo do mesmo cartão
            const nextInput = currentCard.querySelector('.horometer-end') || 
                             currentCard.querySelector('.daily-manual-value-header');
            if (nextInput) {
                nextInput.focus();
            }
        }
    }
};


/**
 * Propaga automaticamente o valor do horímetro final para os horímetros iniciais E FINAIS
 * dos dias seguintes, até encontrar um dia onde AMBOS já sejam maiores ou iguais ao novo valor.
 * Para a propagação se encontrar dias com horímetros vazios (equipamento não trabalhou).
 * 
 * Exemplo: Se dia 18/11 tem horímetro final 7780:
 * - Dias 19-21 com valores 7774: atualiza inicial E final para 7780
 * - Dia 22 com inicial 7774 e final 7805: atualiza inicial para 7780, mantém final 7805
 */
const propagateHorometerValue = (currentCard, newEndValue) => {
    const newValue = parseFloat(newEndValue);
    
    // Se não é um número válido, não faz nada
    if (isNaN(newValue) || newValue === 0) return;
    
    let nextCard = currentCard.nextElementSibling;
    
    // Percorre os próximos cartões
    while (nextCard && nextCard.classList.contains('entry-card')) {
        const nextHorometerStart = nextCard.querySelector('.horometer-start');
        const nextHorometerEnd = nextCard.querySelector('.horometer-end');
        
        if (nextHorometerStart && nextHorometerEnd) {
            // Verifica se os campos estão REALMENTE vazios (sem nenhum valor)
            const startIsEmpty = !nextHorometerStart.value || nextHorometerStart.value.trim() === '';
            const endIsEmpty = !nextHorometerEnd.value || nextHorometerEnd.value.trim() === '';
            
            // Se AMBOS os horímetros estão vazios, para a propagação
            // Isso significa que o equipamento não trabalhou neste dia
            if (startIsEmpty && endIsEmpty) {
                break;
            }
            
            // Agora converte para números apenas se não estiverem vazios
            const currentStartValue = startIsEmpty ? 0 : parseFloat(nextHorometerStart.value);
            const currentEndValue = endIsEmpty ? 0 : parseFloat(nextHorometerEnd.value);
            
            let shouldContinue = false;
            
            // Atualiza horímetro INICIAL se existir E for menor
            if (!startIsEmpty && currentStartValue < newValue) {
                nextHorometerStart.value = newValue;
                nextHorometerStart.dispatchEvent(new Event('change'));
                shouldContinue = true;
            }
            
            // Atualiza horímetro FINAL se existir E for menor
            if (!endIsEmpty && currentEndValue < newValue) {
                nextHorometerEnd.value = newValue;
                nextHorometerEnd.dispatchEvent(new Event('change'));
                shouldContinue = true;
            }
            
            // Se atualizou pelo menos um dos valores, continua para o próximo cartão
            if (shouldContinue) {
                nextCard = nextCard.nextElementSibling;
            } else {
                // Se AMBOS os valores já são >= newValue, para a propagação
                break;
            }
        } else {
            // Se não tem horímetros, para
            break;
        }
    }
};


/**
 * 🔍 Detecta se o horímetro está DECRESCENDO (menor que o valor anterior)
 * e pergunta se houve troca do horímetro.
 * 
 * Se SIM: Aceita o novo valor (troca válida)
 * Se NÃO: Propaga o último valor válido PARA FRENTE
 * 
 * @param {HTMLElement} currentCard - Cartão atual onde o horímetro está sendo editado
 * @param {HTMLInputElement} inputField - Campo de input que está sendo editado (horometer-start ou horometer-end)
 * @param {number} newValue - Novo valor digitado pelo usuário
 */
const checkBackwardHorometer = async (currentCard, inputField, newValue) => {
    // 🚫 Evitar recursão - se já está processando, não processar novamente
    if (inputField.dataset.processing === 'true') {
        return;
    }
    
    const isStartField = inputField.classList.contains('horometer-start');
    const isEndField = inputField.classList.contains('horometer-end');
    
    if (!isStartField && !isEndField) return; // Não é campo de horímetro
    
    const parsedNewValue = parseFloat(newValue);
    if (isNaN(parsedNewValue) || parsedNewValue === 0) return; // Valor inválido
    
    // 🔙 Buscar o último horímetro FINAL válido em cartões anteriores
    let previousCard = currentCard.previousElementSibling;
    let lastValidHorometer = null;
    
    while (previousCard && previousCard.classList.contains('entry-card')) {
        const prevHorometerEnd = previousCard.querySelector('.horometer-end');
        if (prevHorometerEnd && prevHorometerEnd.value) {
            const prevValue = parseFloat(prevHorometerEnd.value);
            if (!isNaN(prevValue) && prevValue > 0) {
                lastValidHorometer = prevValue;
                break; // Encontrou o último valor válido
            }
        }
        previousCard = previousCard.previousElementSibling;
    }
    
    // Se não encontrou horímetro anterior, não faz nada
    if (lastValidHorometer === null) return;
    
    // 🚨 Se o novo valor é MENOR que o último horímetro válido, perguntar sobre troca
    if (parsedNewValue < lastValidHorometer) {
        // Marcar como processando para evitar dupla chamada
        inputField.dataset.processing = 'true';
        
        const confirmed = await createConfirmationModalAsync(
            '⚠️ Horímetro Decrescente Detectado',
            `<p><strong>O horímetro digitado (${parsedNewValue}) é MENOR que o último registrado (${lastValidHorometer}).</strong></p>
             <p>Houve troca do horímetro neste equipamento?</p>`,
            'SIM - Houve troca',
            'NÃO - Propagar valor correto'
        );
        
        if (confirmed) {
            // ✅ SIM: Usuário confirmou que houve troca, aceitar o novo valor
            console.log(`✅ Troca de horímetro confirmada. Novo valor: ${parsedNewValue}`);
            // Não faz nada, deixa o valor como está
            
        } else {
            // ❌ NÃO: Usuário disse que NÃO houve troca
            // Isso significa que o valor MENOR digitado agora é o CORRETO
            // E os valores MAIORES anteriores estavam ERRADOS
            // Então propagamos o novo valor (menor) PARA TRÁS (dias anteriores)
            console.log(`❌ Troca de horímetro negada. Propagando valor CORRETO ${parsedNewValue} PARA TRÁS.`);
            
            // 1️⃣ PRIMEIRO: Corrigir o campo atual com o valor correto
            inputField.value = parsedNewValue;
            
            // 2️⃣ SEGUNDO: Propagar o valor correto PARA TRÁS (dias anteriores)
            let prevCard = currentCard.previousElementSibling;
            
            while (prevCard && prevCard.classList.contains('entry-card')) {
                const prevHorometerStart = prevCard.querySelector('.horometer-start');
                const prevHorometerEnd = prevCard.querySelector('.horometer-end');
                
                if (prevHorometerStart && prevHorometerEnd) {
                    const prevStartValue = parseFloat(prevHorometerStart.value) || 0;
                    const prevEndValue = parseFloat(prevHorometerEnd.value) || 0;
                    
                    let updated = false;
                    
                    // Atualizar FINAL se for MAIOR que o valor correto
                    if (prevHorometerEnd.value && prevEndValue > parsedNewValue) {
                        prevHorometerEnd.dataset.processing = 'true';
                        prevHorometerEnd.value = parsedNewValue;
                        updated = true;
                        console.log(`🔄 Corrigindo horímetro final do dia anterior para ${parsedNewValue}`);
                        setTimeout(() => { prevHorometerEnd.dataset.processing = 'false'; }, 100);
                    }
                    
                    // Atualizar INICIAL se for MAIOR que o valor correto
                    if (prevHorometerStart.value && prevStartValue > parsedNewValue) {
                        prevHorometerStart.dataset.processing = 'true';
                        prevHorometerStart.value = parsedNewValue;
                        updated = true;
                        console.log(`🔄 Corrigindo horímetro inicial do dia anterior para ${parsedNewValue}`);
                        setTimeout(() => { prevHorometerStart.dataset.processing = 'false'; }, 100);
                    }
                    
                    // Se AMBOS os valores já são <= parsedNewValue, para a propagação
                    if (!updated) {
                        console.log(`✅ Parou a propagação - valores anteriores já estão corretos`);
                        break;
                    }
                }
                
                prevCard = prevCard.previousElementSibling;
            }
            
            // 3️⃣ TERCEIRO: Se estamos editando o FINAL, também corrigir o INICIAL do dia atual
            if (isEndField) {
                const currentHorometerStart = currentCard.querySelector('.horometer-start');
                if (currentHorometerStart) {
                    const currentStartValue = parseFloat(currentHorometerStart.value) || 0;
                    if (currentStartValue > parsedNewValue) {
                        currentHorometerStart.dataset.processing = 'true';
                        currentHorometerStart.value = parsedNewValue;
                        console.log(`🔄 Corrigindo horímetro inicial do dia atual para ${parsedNewValue}`);
                        setTimeout(() => { currentHorometerStart.dataset.processing = 'false'; }, 100);
                    }
                }
            }
            
            // Recalcular o total do cartão atual
            calculateAndDisplayDailyTotal(currentCard);
        }
        
        // Remover flag de processamento
        inputField.dataset.processing = 'false';
    }
};



const attachCardEventListeners = () => {
   entriesListContainer.querySelectorAll('.entry-card').forEach(card => {
       if (card.dataset.listenersAttached) return;

       card.querySelector('.collapsible-header')?.addEventListener('click', (e) => {
           // Bloquear clique apenas se for diretamente em input/select
           if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'LABEL') {
               return;
           }
           // Bloquear clique se estiver dentro de checkbox ou áreas de formulário específicas
           if (e.target.closest('input[type="checkbox"]') || e.target.closest('.mobilization-suboptions') || e.target.closest('.demobilization-suboptions')) {
               return;
           }
           
           // Toggle collapsed
           console.log('Toggling collapsed state');
           console.log('Before toggle - has collapsed:', card.classList.contains('collapsed'));
           card.classList.toggle('collapsed');
           console.log('After toggle - has collapsed:', card.classList.contains('collapsed'));
           
           // NOVA ABORDAGEM: Buscar TODOS os elementos com classe entry-card-content
           const allContents = document.querySelectorAll('.entry-card-content');
           console.log('🔍 Total de .entry-card-content no documento:', allContents.length);
           
           // Buscar dentro do card
           const content = card.querySelector('.entry-card-content');
           console.log('Content element found:', content);
           console.log('Card HTML (primeiros 300 chars):', card.outerHTML.substring(0, 300));
           
           if (content) {
               if (card.classList.contains('collapsed')) {
                   content.style.display = 'none';
               } else {
                   content.style.display = 'block';
                   // 🔥 ATUALIZAR BADGES QUANDO EXPANDIR O CARD
                   console.log('🎯 Card expandido! Atualizando badges...');
                   updateAlertBadges(card);
               }
           } else {
               console.error('❌ entry-card-content not found in card');
               console.error('Card structure:', card.innerHTML.substring(0, 500));
           }
           
           const icon = card.querySelector('.collapse-icon');
           if (icon) {
               icon.textContent = card.classList.contains('collapsed') ? '▼' : '▲';
               console.log('Icon changed to:', icon.textContent);
           }
       });

       card.querySelector('.save-entry-btn-header')?.addEventListener('click', async () => {
           console.log('🖱️ BOTÃO SALVAR CLICADO! - VERSÃO 18:50');
           await saveEntryCard(card);
           console.log('✅ saveEntryCard CONCLUÍDA! Agora atualizando valores...');
           // 🔥 ATUALIZAÇÃO EM TEMPO REAL - FORÇAR RECÁLCULO DOS VALORES
           console.log('🔄 Recarregando dados e recalculando valores BM...');
           const workId = entryWorkSelect.value;
           const equipmentId = card.dataset.equipmentId || entryEquipmentSelect.value;
           const startDate = entryStartDate.value;
           const endDate = entryEndDate.value;
           
           if (startDate && endDate && workId && equipmentId) {
               // 🔧 RECARREGAR LANÇAMENTOS DIÁRIOS
               const freshEntries = await apiClient.fetchDailyEntries(workId, equipmentId, startDate, endDate);
               appState.daily_entries = appState.daily_entries.filter(e => 
                   !(e.work_id == workId && e.equipment_id == equipmentId && e.date >= startDate && e.date <= endDate)
               );
               appState.daily_entries.push(...freshEntries);
               
               // 🔧 RECARREGAR AVARIAS (CRITICAL!)
               console.log('🔄 Recarregando avarias da obra...');
               const freshDamages = await apiClient.fetchData('damages', '*', { work_id: workId });
               appState.damages = appState.damages.filter(d => d.work_id != workId);
               appState.damages.push(...freshDamages);
               console.log(`🔧 ${freshDamages.length} avarias recarregadas`);
               
               // 🔧 RECARREGAR DESPESAS
               console.log('🔄 Recarregando despesas da obra...');
               const freshExpenses = await apiClient.fetchData('expenses', '*', { work_id: workId });
               appState.expenses = appState.expenses.filter(exp => exp.work_id != workId);
               appState.expenses.push(...freshExpenses);
               console.log(`💰 ${freshExpenses.length} despesas recarregadas`);
               
               console.log('🔥 Atualizando valores nos cartões...');
               await addMeasurementValuesToCards(workId, equipmentId);
               console.log('✅ VALORES ATUALIZADOS EM TEMPO REAL! 🎉');
           }
       });
       card.querySelector('.save-all-entries-btn-card')?.addEventListener('click', handleSaveAllEntries);

       // Listeners para horímetro e KM
       const horometerEndInput = card.querySelector('.horometer-end');
       if (horometerEndInput) {
           horometerEndInput.addEventListener('change', () => {
               populatePreviousCards(card, 'horometer');
               const nextCard = card.nextElementSibling;
               if (nextCard && nextCard.classList.contains('entry-card')) {
                   const nextHorometerStart = nextCard.querySelector('.horometer-start');
                   if (nextHorometerStart) {
                       nextHorometerStart.value = horometerEndInput.value;
                       nextHorometerStart.dispatchEvent(new Event('change'));
                   }
               }
               calculateAndDisplayDailyTotal(card);
           });
       }
       
       const kmEndInput = card.querySelector('.km-end');
       if (kmEndInput) {
            kmEndInput.addEventListener('change', () => {
               populatePreviousCards(card, 'km');
               const nextCard = card.nextElementSibling;
               if (nextCard && nextCard.classList.contains('entry-card')) {
                   const nextKmStart = nextCard.querySelector('.km-start');
                   if (nextKmStart) {
                       nextKmStart.value = kmEndInput.value;
                       nextKmStart.dispatchEvent(new Event('change'));
                   }
               }
               calculateAndDisplayDailyTotal(card);
           });
       }

       // Novos listeners para campos mensais
       const monthlyCalculationManualSelect = card.querySelector('.monthly-calculation-manual');
       if (monthlyCalculationManualSelect) {
           monthlyCalculationManualSelect.addEventListener('change', (e) => {
               const selectedValue = e.target.value;
               const workId = card.dataset.workId;
               const equipmentId = card.dataset.equipmentId;
               const bmLabel = card.dataset.bmLabel;
               
               document.querySelectorAll(`
                   .entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"] 
                   .monthly-calculation-manual
               `).forEach(select => {
                   if (select !== e.target) {
                       select.value = selectedValue;
                   }
               });
               
               document.querySelectorAll(`
                   .entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"]
               `).forEach(periodCard => {
                   calculateAndDisplayDailyTotal(periodCard);
               });
           });
       }

       const monthlyCalculationTerceirizadoManualSelect = card.querySelector('.monthly-calculation-terceirizado-manual');
       if (monthlyCalculationTerceirizadoManualSelect) {
           monthlyCalculationTerceirizadoManualSelect.addEventListener('change', (e) => {
               const selectedValue = e.target.value;
               const workId = card.dataset.workId;
               const equipmentId = card.dataset.equipmentId;
               const bmLabel = card.dataset.bmLabel;
               
               document.querySelectorAll(`
                   .entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"] 
                   .monthly-calculation-terceirizado-manual
               `).forEach(select => {
                   if (select !== e.target) {
                       select.value = selectedValue;
                   }
               });
               
               document.querySelectorAll(`
                   .entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"]
               `).forEach(periodCard => {
                   calculateAndDisplayDailyTotal(periodCard);
               });
           });
       }

       // Validação e exibição de mobilização/desmobilização
       const mobilizeCheck = card.querySelector('.mobilize-check');
       const demobilizeCheck = card.querySelector('.demobilize-check');
       const mobilizationSuboptionsDiv = card.querySelector('.mobilization-suboptions');
       const demobilizationSuboptionsDiv = card.querySelector('.demobilization-suboptions');

       if (mobilizeCheck) {
           mobilizeCheck.addEventListener('change', async (e) => {
               if (e.target.checked) {
                   const isValid = await validateMobilizationAction(card, 'mobilization');
                   if (!isValid) {
                       e.target.checked = false;
                       if (mobilizationSuboptionsDiv) mobilizationSuboptionsDiv.style.display = 'none';
                       return;
                   }
                   if (mobilizationSuboptionsDiv) mobilizationSuboptionsDiv.style.display = 'flex';
               } else {
                   if (mobilizationSuboptionsDiv) mobilizationSuboptionsDiv.style.display = 'none';
               }
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card); // ATUALIZAR BADGES
           });
       }

       if (demobilizeCheck) {
           demobilizeCheck.addEventListener('change', async (e) => {
               if (e.target.checked) {
                   // Verificar se foi mobilizado no mesmo dia
                   const mobilizeCheckSameCard = card.querySelector('.mobilize-check');
                   const isMobilizedToday = mobilizeCheckSameCard && mobilizeCheckSameCard.checked;
                   
                   // Se foi mobilizado hoje, permitir desmobilização
                   if (!isMobilizedToday) {
                       const isValid = await validateMobilizationAction(card, 'demobilization');
                       if (!isValid) {
                           e.target.checked = false;
                           if (demobilizationSuboptionsDiv) demobilizationSuboptionsDiv.style.display = 'none';
                           return;
                       }
                   }
                   if (demobilizationSuboptionsDiv) demobilizationSuboptionsDiv.style.display = 'flex';
               } else {
                   if (demobilizationSuboptionsDiv) demobilizationSuboptionsDiv.style.display = 'none';
               }
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card); // ATUALIZAR BADGES
           });
       }

       // Listeners para campos de horímetro, KM, valores manuais
       card.querySelectorAll('input.horometer-start, input.horometer-end, input.km-start, input.km-end, input.daily-manual-value-header, input.daily-manual-value-terceirizado-header').forEach(el => {
           el.addEventListener('change', () => calculateAndDisplayDailyTotal(card));
           el.addEventListener('input', () => calculateAndDisplayDailyTotal(card));
       });

       // Listener ESPECÍFICO para horímetro final: propagar valores automaticamente
       const horometerEnd = card.querySelector('input.horometer-end');
       if (horometerEnd) {
           horometerEnd.addEventListener('change', async (e) => {
               // 🔍 PRIMEIRO: Verificar se houve decréscimo no horímetro
               await checkBackwardHorometer(card, e.target, e.target.value);
               
               // 🔄 DEPOIS: Propagar valores para frente normalmente
               propagateHorometerValue(card, e.target.value);
           });
       }
       
       // Listener ESPECÍFICO para horímetro inicial: verificar decréscimo
       const horometerStart = card.querySelector('input.horometer-start');
       if (horometerStart) {
           horometerStart.addEventListener('change', async (e) => {
               // 🔍 Verificar se houve decréscimo no horímetro inicial
               await checkBackwardHorometer(card, e.target, e.target.value);
           });
       }

       // Listener específico para o checkbox "Trabalhou"
       const isWorkedCheck = card.querySelector('.is-worked-check');
       const paySalaryCheck = card.querySelector('.pay-salary-check');
       if (isWorkedCheck) {
           isWorkedCheck.addEventListener('change', async (e) => {
               const isChecked = e.target.checked;
               
               // AJUSTE: Marcar/desmarcar a checkbox "Salário" com base no status da checkbox "Trabalhou"
               if (paySalaryCheck) {
                   paySalaryCheck.checked = isChecked;
               }

               // Atualizar tipo de cálculo mensal automaticamente
               await updateMonthlyCalculationType(card, isChecked);
               
               // Recalcular valores
               calculateAndDisplayDailyTotal(card);
           });
       }

       // Listeners para os campos de mobilização/desmobilização
       card.querySelector('.is-mobilization-contabilized')?.addEventListener('change', () => calculateAndDisplayDailyTotal(card));
       card.querySelector('.mobilization-manual-value')?.addEventListener('change', () => calculateAndDisplayDailyTotal(card));
       card.querySelector('.mobilization-manual-value')?.addEventListener('input', () => calculateAndDisplayDailyTotal(card));
       
       card.querySelector('.is-demobilization-contabilized')?.addEventListener('change', () => calculateAndDisplayDailyTotal(card));
       card.querySelector('.demobilization-manual-value')?.addEventListener('change', () => calculateAndDisplayDailyTotal(card));
       card.querySelector('.demobilization-manual-value')?.addEventListener('input', () => calculateAndDisplayDailyTotal(card));

       // Listener para parte diária recebida
       card.querySelector('.is-daily-part-received-check')?.addEventListener('change', async (e) => {
           const isChecked = e.target.checked;
           const workId = card.dataset.workId;
           const equipmentId = card.dataset.equipmentId;
           const bmLabel = card.dataset.bmLabel;
           const key = `${workId}-${equipmentId}-${bmLabel}`;

           if (!workId || !equipmentId || !bmLabel) {
               console.error("Dados da obra, equipamento ou BM não encontrados para sincronização da parte diária.");
               e.target.checked = !isChecked;
               return;
           }

           showSpinner();
           try {
               await apiClient.updateDailyPartStatusForBM(workId, equipmentId, bmLabel, isChecked);
               appState.dailyPartStatus[key] = isChecked;
               document.querySelectorAll(`.entry-card[data-work-id="${workId}"][data-equipment-id="${equipmentId}"][data-bm-label="${bmLabel}"] .is-daily-part-received-check`).forEach(chk => {
                   chk.checked = isChecked;
               });
               alert('Status da Parte Diária atualizado com sucesso!');
           } catch (error) {
               console.error('Erro ao atualizar status da parte diária:', error);
               alert(`Erro ao atualizar status da parte diária: ${error.message}`);
               e.target.checked = !isChecked;
           } finally {
               hideSpinner();
           }
       });

       // Listeners para adicionar paradas e notas
       card.querySelector('.add-stoppage-btn')?.addEventListener('click', (e) => {
           const container = e.target.closest('fieldset')?.querySelector('.stoppages-container');
           if (container) {
               const rowHtml = createStoppageRow();
               container.insertAdjacentHTML('beforeend', rowHtml);
               const newRow = container.lastElementChild;
               newRow.querySelector('.remove-row-btn')?.addEventListener('click', () => { 
                   newRow.remove(); 
                   calculateAndDisplayDailyTotal(card);
                   updateAlertBadges(card);
               });
               
               // 🎯 Máscara para campo HH:MM
               const hhmmInput = newRow.querySelector('.stoppage-hours-hhmm');
               if (hhmmInput) {
                   hhmmInput.addEventListener('input', (e) => {
                       let value = e.target.value.replace(/\D/g, ''); // Remove tudo exceto números
                       if (value.length >= 2) {
                           value = value.substring(0, 2) + ':' + value.substring(2, 4);
                       }
                       e.target.value = value.substring(0, 5); // Limita a HH:MM
                   });
               }
               
               newRow.querySelectorAll('input, select').forEach(el => el.addEventListener('change', () => {
                   calculateAndDisplayDailyTotal(card);
                   updateAlertBadges(card);
               }));
               updateAlertBadges(card); // ATUALIZAR BADGES
           }
       });

       card.querySelector('.add-note-btn')?.addEventListener('click', (e) => {
           const container = e.target.closest('fieldset')?.querySelector('.notes-container');
           if (container) {
               const rowHtml = createNoteRow();
               container.insertAdjacentHTML('beforeend', rowHtml);
               const newRow = container.lastElementChild;
               newRow.querySelector('.remove-row-btn')?.addEventListener('click', () => { 
                   newRow.remove(); 
                   calculateAndDisplayDailyTotal(card);
                   updateAlertBadges(card);
               });
               newRow.querySelectorAll('input, select').forEach(el => el.addEventListener('change', () => {
                   calculateAndDisplayDailyTotal(card);
                   updateAlertBadges(card);
               }));
               updateAlertBadges(card);
           }
       });

       card.querySelectorAll('.remove-row-btn').forEach(btn => btn.addEventListener('click', async (e) => { 
           e.target.closest('.form-grid')?.remove(); 
           calculateAndDisplayDailyTotal(card);
           updateAlertBadges(card); // ATUALIZAR BADGES
           
           // 🔄 RECALCULAR VALORES DA BM EM TEMPO REAL
           const workId = card.dataset.workId;
           const equipmentId = card.dataset.equipmentId;
           if (workId && equipmentId) {
               await addMeasurementValuesToCards(workId, equipmentId);
           }
       }));

       // Listener para atualizar nome do operador
       card.querySelector('.operator-id')?.addEventListener('change', () => {
           const selectedOperatorId = card.querySelector('.operator-id').value;
           const operatorName = selectedOperatorId ? 
               (appState.employees.find(emp => emp.id == selectedOperatorId)?.name || 'N/A') : 
               'Não definido';
           
           const operatorInfo = card.querySelector('.operator-info small');
           if (operatorInfo) {
               operatorInfo.textContent = `👤 Operador: ${operatorName}`;
           }
           
           calculateAndDisplayDailyTotal(card);
       });

       // Listeners para a seção de substituição
       const substitutedEquipmentSelect = card.querySelector('.substituted-equipment-select');
       const substitutionDateInput = card.querySelector('.substitution-date-input');
       const clearSubstitutionBtn = card.querySelector('.clear-substitution-btn');
       const substitutedMonthlyValueInput = card.querySelector('.substituted-monthly-value');
       const substitutedGuaranteedHoursInput = card.querySelector('.substituted-guaranteed-hours');
       const substitutionIdInput = card.querySelector('.substitution-id');
       const substitutionIndicator = card.querySelector('.substitution-indicator');

       if (substitutedEquipmentSelect && substitutionDateInput) {
           const updateSubstitutionData = () => {
               const workId = parseInt(card.dataset.workId);
               const substitutedEquipId = substitutedEquipmentSelect.value ? parseInt(substitutedEquipmentSelect.value) : null;
               const substitutionDate = substitutionDateInput.value;

               if (substitutedEquipId && substitutionDate) {
                   const work = appState.works.find(w => w.id === workId);
                   const equipConfig = work?.config?.equipment?.find(ec => parseInt(ec.equipment_id) === substitutedEquipId);
                   
                   if (equipConfig) {
                       substitutedMonthlyValueInput.value = equipConfig.measurement_value || '';
                       substitutedGuaranteedHoursInput.value = equipConfig.guaranteed_hours || '';
                       clearSubstitutionBtn.style.display = 'block';
                       const substitutedEquip = appState.equipment.find(e => e.id === substitutedEquipId);
                       if (substitutionIndicator) {
                           substitutionIndicator.textContent = `🔄 Substituindo ${substitutedEquip?.prefix || 'N/A'}`;
                           substitutionIndicator.style.display = 'inline';
                       }
                   } else {
                       substitutedMonthlyValueInput.value = '';
                       substitutedGuaranteedHoursInput.value = '';
                       substitutionIdInput.value = '';
                       clearSubstitutionBtn.style.display = 'none';
                       if (substitutionIndicator) substitutionIndicator.style.display = 'none';
                   }
               } else {
                   substitutedMonthlyValueInput.value = '';
                   substitutedGuaranteedHoursInput.value = '';
                   substitutionIdInput.value = '';
                   clearSubstitutionBtn.style.display = 'none';
                   if (substitutionIndicator) substitutionIndicator.style.display = 'none';
               }
               calculateAndDisplayDailyTotal(card);
           };

           substitutedEquipmentSelect.addEventListener('change', updateSubstitutionData);
           substitutionDateInput.addEventListener('change', updateSubstitutionData);
           
           if (clearSubstitutionBtn) {
               clearSubstitutionBtn.addEventListener('click', () => {
                   substitutedEquipmentSelect.value = '';
                   substitutionDateInput.value = '';
                   substitutedMonthlyValueInput.value = '';
                   substitutedGuaranteedHoursInput.value = '';
                   substitutionIdInput.value = '';
                   clearSubstitutionBtn.style.display = 'none';
                   if (substitutionIndicator) substitutionIndicator.style.display = 'none';
                   calculateAndDisplayDailyTotal(card);
               });
           }

           updateSubstitutionData();
       }

       // Calcular e exibir o total inicial
       calculateAndDisplayDailyTotal(card);
       
       // NOVA LINHA: Atualizar tipo de cálculo automaticamente baseado nos dias já marcados
       updateMonthlyCalculationType(card);
       
       // Configurar navegação Tab inteligente
        setupTabNavigation();

       // Atualizar badges de alerta ao criar o cartão
       updateAlertBadges(card);

       // 🎯 Adicionar máscara aos campos HH:MM existentes no card
       card.querySelectorAll('.stoppage-hours-hhmm').forEach(hhmmInput => {
           hhmmInput.addEventListener('input', (e) => {
               let value = e.target.value.replace(/\D/g, ''); // Remove tudo exceto números
               if (value.length >= 2) {
                   value = value.substring(0, 2) + ':' + value.substring(2, 4);
               }
               e.target.value = value.substring(0, 5); // Limita a HH:MM
           });
       });

       // 🎯 Adicionar listeners em tempo real a TODAS as paradas/notas já existentes no card
       // (rows carregadas do DB não recebem listeners via "add-stoppage-btn")
       card.querySelectorAll('.stoppages-container input, .stoppages-container select').forEach(el => {
           el.addEventListener('change', () => {
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card);
           });
           el.addEventListener('input', () => {
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card);
           });
       });
       card.querySelectorAll('.notes-container input, .notes-container select').forEach(el => {
           el.addEventListener('change', () => {
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card);
           });
           el.addEventListener('input', () => {
               calculateAndDisplayDailyTotal(card);
               updateAlertBadges(card);
           });
       });

       card.dataset.listenersAttached = 'true';
   });
};

const populatePreviousCards = (currentCard, type) => {
    const allCards = Array.from(document.querySelectorAll('#entries-list .entry-card'));
    const currentCardIndex = allCards.findIndex(c => c === currentCard);

    let lastValidValue = null;
    let lastValidIndex = -1;
    for (let i = currentCardIndex - 1; i >= 0; i--) {
        const previousCard = allCards[i];
        const endInput = previousCard.querySelector(`.${type}-end`);
        const startInput = previousCard.querySelector(`.${type}-start`);

        const endValue = parseFloat(endInput.value);
        const startValue = parseFloat(startInput.value);
        
        if (!isNaN(endValue)) {
            lastValidValue = endValue;
            lastValidIndex = i;
            break;
        } else if (!isNaN(startValue)) {
            lastValidValue = startValue;
            lastValidIndex = i;
            break;
        }
    }
    
    if (lastValidValue === null) {
        return;
    }

    const lastValidCard = allCards[lastValidIndex];
    const lastValidEndInput = lastValidCard.querySelector(`.${type}-end`);
    if (lastValidEndInput.value === '') {
        lastValidEndInput.value = lastValidValue;
    }

    for (let i = lastValidIndex + 1; i < currentCardIndex; i++) {
        const cardToUpdate = allCards[i];
        const startInput = cardToUpdate.querySelector(`.${type}-start`);
        const endInput = cardToUpdate.querySelector(`.${type}-end`);
        
        if (startInput.value === '') {
            startInput.value = lastValidValue;
        }
        if (endInput.value === '') {
            endInput.value = lastValidValue;
        }
    }

    const currentStartInput = currentCard.querySelector(`.${type}-start`);
    if (currentStartInput.value === '') {
        currentStartInput.value = lastValidValue;
    }
    
    for (let i = lastValidIndex; i < allCards.length; i++) {
        allCards[i].dispatchEvent(new Event('recalculate'));
    }
};

const validateMobilizationAction = async (card, action) => {
    const workId = card.dataset.workId;
    const equipmentId = card.dataset.equipmentId;
    const currentDate = card.dataset.date;

    if (!workId || !equipmentId || !currentDate) {
        alert('Erro: Dados do lançamento incompletos.');
        return false;
    }

    try {
        showSpinner();
        
        const dayBefore = new Date(currentDate + 'T00:00:00');
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayBeforeStr = dayBefore.toISOString().split('T')[0];
        
        const lastStatus = await apiClient.getEquipmentStatusAtDate(workId, equipmentId, dayBeforeStr);
        const equip = appState.equipment.find(e => e.id == equipmentId);

        if (action === 'mobilization') {
            if (lastStatus) {
                if (lastStatus.is_mobilization && !lastStatus.is_demobilized) {
                    alert(`⌚ Ação inválida: O equipamento "${equip?.prefix || 'N/A'}" já foi mobilizado em ${new Date(lastStatus.date + 'T00:00:00').toLocaleDateString('pt-BR')} e ainda não foi desmobilizado.\n\n✅ Para mobilizar novamente, primeiro desmobilize o equipamento.`);
                    return false;
                }
                if (lastStatus.is_demobilized) {
                    return true;
                }
            }
            return true;
        }

        if (action === 'demobilization') {
            if (!lastStatus) {
                alert(`⌚ Ação inválida: O equipamento "${equip?.prefix || 'N/A'}" não pode ser desmobilizado porque nunca foi mobilizado.\n\n✅ Primeiro mobilize o equipamento para depois poder desmobilizá-lo.`);
                return false;
            }

            if (lastStatus.is_demobilized) {
                alert(`⌚ Ação inválida: O equipamento "${equip?.prefix || 'N/A'}" já foi desmobilizado em ${new Date(lastStatus.date + 'T00:00:00').toLocaleDateString('pt-BR')}.\n\n✅ Para desmobilizar novamente, primeiro mobilize o equipamento.`);
                return false;
            }

            if (!lastStatus.is_mobilization) {
                alert(`⌚ Ação inválida: O equipamento "${equip?.prefix || 'N/A'}" não pode ser desmobilizado porque não está mobilizado.\n\n✅ Primeiro mobilize o equipamento para depois poder desmobilizá-lo.`);
                return false;
            }

            return true;
        }

        return true;
    } catch (error) {
        console.error('Erro ao validar ação de mobilização:', error);
        alert('Erro ao validar ação. Tente novamente.');
        return false;
    } finally {
        hideSpinner();
    }
};

const createStoppageRow = (data = {}) => {
    // CORREÇÃO: Verificar se stoppage_types está carregado e garantir que seja um array
    const stoppageTypes = appState.stoppage_types || [];
    
    // Se não houver tipos de parada carregados, mostrar aviso no console
    if (stoppageTypes.length === 0) {
        console.warn('⚠️ stoppage_types não carregado ou vazio no appState');
    }
    
    const stoppageOptions = stoppageTypes.map(st => 
        `<option value="${st.id}" ${data.type_id == st.id ? 'selected' : ''}>${st.name}</option>`
    ).join('');
    
    return `
        <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr 0.8fr 0.8fr auto; align-items: center; margin-bottom: 5px;">
            <select class="stoppage-type" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
                <option value="">Tipo...</option>
                ${stoppageOptions}
            </select>
            <input type="time" class="stoppage-start" value="${data.start || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;" placeholder="Início">
            <input type="time" class="stoppage-end" value="${data.end || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;" placeholder="Fim">
            <input type="text" class="stoppage-hours-hhmm" value="${data.hours_hhmm || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;" placeholder="HH:MM" maxlength="5" title="Formato: HH:MM (ex: 01:18)">
            <input type="number" step="0.01" class="stoppage-hours-decimal" value="${data.hours_decimal || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;" placeholder="Decimal" title="Formato decimal (ex: 1.3)">
            <button type="button" class="remove-row-btn" style="background:transparent; border:none; color:red; cursor:pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `;
};


const createNoteRow = (data = {}) => {
    return `
        <div class="form-grid" style="grid-template-columns: 1.2fr 2fr 0.5fr 1fr 1fr 0.8fr auto; align-items: center; margin-bottom: 5px; gap: 5px;">
            <select class="note-type" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
                <option value="observation" ${data.type === 'observation' ? 'selected' : ''}>Observação</option>
                <option value="expense" ${data.type === 'expense' ? 'selected' : ''}>Despesa</option>
                <option value="discount" ${data.type === 'discount' ? 'selected' : ''}>Desconto</option>
                <option value="addition" ${data.type === 'addition' ? 'selected' : ''}>Acréscimo</option>
            </select>
            <input type="text" class="note-description" placeholder="Descrição" value="${data.description || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
            <input type="number" class="note-quantity" placeholder="Qtd" value="${data.quantity || '1'}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
            <input type="number" step="0.01" class="note-value" placeholder="Valor Unit." value="${data.value || ''}" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
            <select class="note-target" style="background: #2a2a2a; color: #fff; border: 1px solid #444;">
                <option value="both" ${data.target === 'both' ? 'selected' : ''}>Ambos</option>
                <option value="client" ${data.target === 'client' ? 'selected' : ''}>Cliente</option>
                <option value="terceirizado" ${data.target === 'terceirizado' ? 'selected' : ''}>Terceirizado</option>
            </select>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 5px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 3px;">
                    <input type="checkbox" class="note-hide-in-report" id="hide-report-${Date.now()}-${Math.random()}" ${data.hide_in_report ? 'checked' : ''} title="Ocultar no relatório (ainda será contabilizado)">
                    <label for="hide-report-${Date.now()}-${Math.random()}" style="margin: 0; font-size: 0.7rem; cursor: pointer; white-space: nowrap; color: #aaa;">🔒 Ocultar</label>
                </div>
                <div style="display: flex; align-items: center; gap: 3px;">
                    <input type="checkbox" class="note-hide-in-pdf" id="hide-pdf-${Date.now()}-${Math.random()}" ${data.hide_in_pdf ? 'checked' : ''} title="Ocultar do PDF (não será exibido no PDF)">
                    <label for="hide-pdf-${Date.now()}-${Math.random()}" style="margin: 0; font-size: 0.7rem; cursor: pointer; white-space: nowrap; color: #aaa;">📄 Ocultar PDF</label>
                </div>
            </div>
            <button type="button" class="remove-row-btn" style="background:transparent; border:none; color:red; cursor:pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `;
};

const saveEntryCard = async (card, isBulkSave = false) => {
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀 SAVEENTRYCARD VERSÃO 18:20 EXECUTANDO! 🚀🚀🚀🚀🚀🚀🚀🚀');
    console.log('🚀🚀🚀 INICIANDO saveEntryCard - isBulkSave:', isBulkSave, '- TIMESTAMP:', Date.now());
    if (!isBulkSave) showSpinner();

    const workId = entryWorkSelect.value;
    const equipmentId = card.dataset.equipmentId || entryEquipmentSelect.value;
    const date = card.dataset.date;
    const bmLabel = card.dataset.bmLabel;
    
    const horometerStartInput = card.querySelector('.horometer-start');
    const horometerEndInput = card.querySelector('.horometer-end');
    const kmStartInput = card.querySelector('.km-start');
    const kmEndInput = card.querySelector('.km-end');
    const isWorkedCheck = card.querySelector('.is-worked-check');
    
    const work = appState.works.find(w => w.id == workId);
    const equipment = appState.equipment.find(e => e.id == equipmentId);
    const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);
    
    const isWorked = isWorkedCheck?.checked || false;

    const horometer_start_val = horometerStartInput ? parseFloat(horometerStartInput.value) : null;
    const horometer_end_val = horometerEndInput ? parseFloat(horometerEndInput.value) : null;
    const km_start_val = kmStartInput ? parseFloat(kmStartInput.value) : null;
    const km_end_val = kmEndInput ? parseFloat(kmEndInput.value) : null;

    const dailyRunHours = (!isNaN(horometer_start_val) && !isNaN(horometer_end_val)) ? Math.max(0, horometer_end_val - horometer_start_val) : 0;
    const dailyRunKm = (!isNaN(km_start_val) && !isNaN(km_end_val)) ? Math.max(0, km_end_val - km_start_val) : 0;
    
    const completeValues = calculateCompleteCardDailyValue(card, work, equipConfig, equipment, dailyRunHours, dailyRunKm);

    const stoppages = Array.from(card.querySelectorAll('.stoppages-container .form-grid')).map(row => {
        const stoppageData = {
            type_id: row.querySelector('.stoppage-type')?.value,
            start: row.querySelector('.stoppage-start')?.value || null,
            end: row.querySelector('.stoppage-end')?.value || null,
            hours_hhmm: row.querySelector('.stoppage-hours-hhmm')?.value || null,
            hours_decimal: row.querySelector('.stoppage-hours-decimal')?.value || null
        };
        
        console.log('💾💾💾 SALVANDO PARADA:', {
            tipo: stoppageData.type_id,
            campo1Inicio: stoppageData.start,
            campo1Fim: stoppageData.end,
            campo2HHMM: stoppageData.hours_hhmm,
            campo3Decimal: stoppageData.hours_decimal,
            'CAMPO2_VAZIO?': !stoppageData.hours_hhmm,
            'CAMPO3_VAZIO?': !stoppageData.hours_decimal
        });
        
        return stoppageData;
    }).filter(s => s.type_id);

    console.log('💾💾💾 TOTAL DE PARADAS A SALVAR:', stoppages.length);
    console.log('💾💾💾 ARRAY COMPLETO:', JSON.stringify(stoppages, null, 2));

    const notes = Array.from(card.querySelectorAll('.notes-container .form-grid')).map(row => ({
    type: row.querySelector('.note-type')?.value,
    description: row.querySelector('.note-description')?.value,
    quantity: parseFloat(row.querySelector('.note-quantity')?.value) || 0,
    value: parseFloat(row.querySelector('.note-value')?.value) || 0,
    target: row.querySelector('.note-target')?.value || 'both',
    hide_in_report: row.querySelector('.note-hide-in-report')?.checked || false,
    hide_in_pdf: row.querySelector('.note-hide-in-pdf')?.checked || false
})).filter(n => n.description);


    const manualValueInput = card.querySelector('.daily-manual-value-header');
    const manualValueTercInput = card.querySelector('.daily-manual-value-terceirizado-header');
    
    let manualValue = null;
    let manualValueTerc = null;
    
    if (manualValueInput && manualValueInput.value !== '') {
        manualValue = parseFloat(manualValueInput.value);
    }
    
    if (manualValueTercInput && manualValueTercInput.value !== '') {
        manualValueTerc = parseFloat(manualValueTercInput.value);
    }

    const isMobilizationContabilized = card.querySelector('.is-mobilization-contabilized')?.value === '1' ? 1 : 0;
    const mobilizationManualValue = parseFloat(card.querySelector('.mobilization-manual-value')?.value) || null;
    const isDemobilizationContabilized = card.querySelector('.is-demobilization-contabilized')?.value === '1' ? 1 : 0;
    const demobilizationManualValue = parseFloat(card.querySelector('.demobilization-manual-value')?.value) || null;

    const isMobilizing = card.querySelector('.mobilize-check')?.checked || false;
    const isDemobilizing = card.querySelector('.demobilize-check')?.checked || false;

    const monthlyCalculationManualSelect = card.querySelector('.monthly-calculation-manual');
    const monthlyCalculationTerceirizadoManualSelect = card.querySelector('.monthly-calculation-terceirizado-manual');

    let monthlyCalculationManual = null;
    if (monthlyCalculationManualSelect && monthlyCalculationManualSelect.value !== '') {
        monthlyCalculationManual = monthlyCalculationManualSelect.value;
    }

    let monthlyCalculationManualTerceirizado = null;
    if (monthlyCalculationTerceirizadoManualSelect && monthlyCalculationTerceirizadoManualSelect.value !== '') {
        monthlyCalculationManualTerceirizado = monthlyCalculationTerceirizadoManualSelect.value;
    }

    // NOVA ADIÇÃO: Salvar também o tipo automático determinado
    const autoSelect = card.querySelector('.monthly-calculation-auto');
    const autoSelectTerc = card.querySelector('.monthly-calculation-terceirizado-auto');
    
    const monthlyCalculationOverride = autoSelect ? autoSelect.value : null;
    const monthlyCalculationOverrideTerceirizado = autoSelectTerc ? autoSelectTerc.value : null;

    console.log(`[DEBUG SAVE] Campo manual principal: "${monthlyCalculationManualSelect?.value}" → Salvando: ${monthlyCalculationManual}`);
    console.log(`[DEBUG SAVE] Campo auto principal: "${autoSelect?.value}" → Salvando como override: ${monthlyCalculationOverride}`);
    console.log(`[DEBUG SAVE] Campo manual terceirizado: "${monthlyCalculationTerceirizadoManualSelect?.value}" → Salvando: ${monthlyCalculationManualTerceirizado}`);
    console.log(`[DEBUG SAVE] Campo auto terceirizado: "${autoSelectTerc?.value}" → Salvando como override: ${monthlyCalculationOverrideTerceirizado}`);

    const entryData = {
        work_id: workId, 
        equipment_id: equipmentId, 
        date: date,
        bm_label: bmLabel,
        is_worked: isWorked,
        operator_id: card.querySelector('.operator-id')?.value || null,
        horometer_start: horometer_start_val,
        horometer_end: horometer_end_val,
        km_start: km_start_val,
        km_end: km_end_val,
        is_mobilization: isMobilizing,
        is_mobilization_contabilized: isMobilizationContabilized,
        mobilization_manual_value: mobilizationManualValue,
        is_demobilized: isDemobilizing,
        is_demobilization_contabilized: isDemobilizationContabilized,
        demobilization_manual_value: demobilizationManualValue,
        stoppages: stoppages,
        notes: notes,
        daily_manual_value: manualValue,
        daily_total_value: completeValues.clientValue,
        daily_manual_value_terceirizado: manualValueTerc,
        daily_total_value_terceirizado: completeValues.terceirizadoValue,
        pay_salary: card.querySelector('.pay-salary-check')?.checked || false,
        is_daily_part_received: card.querySelector('.is-daily-part-received-check')?.checked || false,
        monthly_calculation_manual: monthlyCalculationManual,
        monthly_calculation_manual_terceirizado: monthlyCalculationManualTerceirizado,
        monthly_calculation_override: monthlyCalculationOverride,
        monthly_calculation_override_terceirizado: monthlyCalculationOverrideTerceirizado
    };

    if (card.dataset.id) {
        entryData.id = parseInt(card.dataset.id);
    }

    console.log('DADOS COMPLETOS PARA ENVIAR:', entryData);

    try {
        const data = await apiClient.upsertItem('daily_entries', entryData, 'work_id, equipment_id, date');
        card.dataset.id = data.id;
        card.style.borderColor = 'green';
        setTimeout(() => card.style.borderColor = '#ccc', 2000);

        console.log('DADOS SALVOS COM SUCESSO:', data);

        const substitutedEquipmentSelect = card.querySelector('.substituted-equipment-select');
        const substitutionDateInput = card.querySelector('.substitution-date-input');
        const clearSubstitutionBtn = card.querySelector('.clear-substitution-btn');
        const substitutedMonthlyValueInput = card.querySelector('.substituted-monthly-value');
        const substitutedGuaranteedHoursInput = card.querySelector('.substituted-guaranteed-hours');
        const substitutionIdInput = card.querySelector('.substitution-id');

        const currentSubstitutionId = substitutionIdInput?.value;
        const selectedSubstitutedEquipId = substitutedEquipmentSelect ? parseInt(substitutedEquipmentSelect.value) : null;
        const selectedSubstitutionDate = substitutionDateInput?.value;
        const selectedSubstitutedMonthlyValue = substitutedMonthlyValueInput ? parseFloat(substitutedMonthlyValueInput.value) : null;
        const selectedSubstitutedGuaranteedHours = substitutedGuaranteedHoursInput ? parseFloat(substitutedGuaranteedHoursInput.value) : null;

        if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
            if (selectedSubstitutedEquipId && selectedSubstitutionDate && selectedSubstitutedMonthlyValue !== null && selectedSubstitutedGuaranteedHours !== null) {
                const substitutionPayload = {
                    work_id: parseInt(workId),
                    substituted_equipment_id: selectedSubstitutedEquipId,
                    substituting_equipment_id: parseInt(equipmentId),
                    substitution_date: selectedSubstitutionDate,
                    substituted_equipment_monthly_value: selectedSubstitutedMonthlyValue,
                    substituted_equipment_guaranteed_hours: selectedSubstitutedGuaranteedHours
                };
                if (currentSubstitutionId) {
                    substitutionPayload.id = parseInt(currentSubstitutionId);
                }
                const substitutionData = await apiClient.upsertEquipmentSubstitution(substitutionPayload);
                substitutionIdInput.value = substitutionData.id;
                clearSubstitutionBtn.style.display = 'block';
                console.log('SUBSTITUIÇÃO SALVA:', substitutionData);
            } else if (currentSubstitutionId) {
                await apiClient.deleteItem('equipment_substitutions', currentSubstitutionId);
                substitutionIdInput.value = '';
                clearSubstitutionBtn.style.display = 'none';
                console.log('SUBSTITUIÇÃO DELETADA');
            }
        }
    } catch (error) {
        console.error('❌❌❌ ERRO NO CATCH - VERSÃO 29/01 18:02:', error);
        console.error('Erro ao salvar lançamento:', error);
        card.style.borderColor = 'red';
        alert(`Erro ao salvar lançamento: ${error.message}`);
    } finally {
        console.log('🔥🔥🔥 FINALLY EXECUTANDO - VERSÃO 29/01 18:02 - TIMESTAMP:', Date.now(), '- isBulkSave:', isBulkSave);
        console.log('🔥🔥🔥 Tipo de isBulkSave:', typeof isBulkSave);
        console.log('🔥🔥🔥 Comparação !isBulkSave:', !isBulkSave);
        // ✅ ATUALIZAR VALORES DE MEDIÇÃO BM APÓS SALVAR (MESMO SE FOR SALVAMENTO INDIVIDUAL)
        console.log('🔍 FINALLY BLOCK - isBulkSave:', isBulkSave);
        if (!isBulkSave) {
            console.log('🔍 ENTRANDO NO RECÁLCULO - workId:', workId, 'equipmentId:', equipmentId);
            try {
                console.log('🔄 Recalculando valores de medição BM após salvamento individual...');
                
                // 🔥 RECARREGAR daily_entries do appState antes de calcular BM
                const startDate = entryStartDate?.value;
                const endDate = entryEndDate?.value;
                
                console.log('🔍 Datas - startDate:', startDate, 'endDate:', endDate);
                
                if (startDate && endDate) {
                    console.log('🔥 RECARREGANDO daily_entries do banco...');
                    const freshEntries = await apiClient.fetchDailyEntries(workId, equipmentId, startDate, endDate);
                    
                    // Atualizar appState com os novos dados
                    appState.daily_entries = appState.daily_entries.filter(e => 
                        !(e.work_id == workId && e.equipment_id == equipmentId && e.date >= startDate && e.date <= endDate)
                    );
                    appState.daily_entries.push(...freshEntries);
                    
                    console.log('✅ daily_entries recarregados no appState:', freshEntries.length, 'entradas');
                    
                    // Agora sim, recalcular os valores de BM com dados atualizados
                    console.log('📊 CHAMANDO addMeasurementValuesToCards...');
                    await addMeasurementValuesToCards(workId, equipmentId);
                    console.log('✅ addMeasurementValuesToCards CONCLUÍDO!');
                    
                    // 💰 ATUALIZAR VALORES DE MEDIÇÃO NO COMBOBOX (sem executar auto-buscar)
                    const currentBmValue = entryBmSelect?.value;
                    if (currentBmValue) {
                        window.preventAutoBuscar = true;
                        await handleBmSelectChange();
                        setTimeout(() => { window.preventAutoBuscar = false; }, 200);
                    }
                } else {
                    console.warn('⚠️ Datas não disponíveis para recálculo');
                }
            } catch (bmError) {
                console.error('❌ Erro ao atualizar BM:', bmError);
            }
            hideSpinner();
        } else {
            console.log('⏭️ PULANDO RECÁLCULO (isBulkSave = true)');
        }
    }
};

const handleSaveAllEntries = async () => {
    showSpinner();
    const cards = document.querySelectorAll('#entries-list .entry-card');
    let hasError = false;
    for (const card of cards) {
        try {
            await saveEntryCard(card, true);
        } catch (e) {
            hasError = true;
            break;
        }
    }
    if (hasError) {
        alert('Ocorreu um erro ao salvar alguns lançamentos. Verifique o console para mais detalhes.');
    }
    
    // ✅ ATUALIZAR VALORES DE MEDIÇÃO BM APÓS SALVAR TODAS AS ENTRADAS
    if (!hasError && cards.length > 0) {
        const firstCard = cards[0];
        const workId = firstCard.dataset.workId || entryWorkSelect?.value;
        const equipmentId = firstCard.dataset.equipmentId || entryEquipmentSelect?.value;
        
        if (workId && equipmentId) {
            console.log('🔄 Recalculando valores de medição BM após salvamento...');
            
            // 🔥 RECARREGAR daily_entries do appState antes de calcular BM
            const startDate = entryStartDate?.value;
            const endDate = entryEndDate?.value;
            
            if (startDate && endDate) {
                try {
                    const freshEntries = await apiClient.fetchDailyEntries(workId, equipmentId, startDate, endDate);
                    
                    // Atualizar appState com os novos dados
                    appState.daily_entries = appState.daily_entries.filter(e => 
                        !(e.work_id == workId && e.equipment_id == equipmentId && e.date >= startDate && e.date <= endDate)
                    );
                    appState.daily_entries.push(...freshEntries);
                    
                    console.log('✅ daily_entries recarregados no appState:', freshEntries.length, 'entradas');
                    
                    // Agora sim, recalcular os valores de BM com dados atualizados
                    await addMeasurementValuesToCards(workId, equipmentId);
                    
                    //  Verificar e atualizar alerta de equipamentos desmobilizados trabalhados
                    await checkAndDisplayDemobilizationAlert(workId, startDate, endDate);
                } catch (reloadError) {
                    console.error('Erro ao recarregar entries:', reloadError);
                }
            }
        }
    }
    
    hideSpinner();
};


const handleReplicateEntries = async () => {
    const startDate = document.getElementById('entry-start-date')?.value;
    const endDate = document.getElementById('entry-end-date')?.value;
    const workId = entryWorkSelect?.value;
    const sourceEquipmentId = entryEquipmentSelect?.value;

    if (!startDate || !endDate || !workId || !sourceEquipmentId) {
        alert('Por favor, selecione a obra, o equipamento de origem e o período para replicar.');
        return;
    }

    const confirmReplication = confirm(
        `Você realmente deseja replicar os lançamentos do equipamento selecionado (${appState.equipment.find(e => e.id == sourceEquipmentId)?.prefix}) ` +
        `para TODOS os outros equipamentos da obra "${appState.works.find(w => w.id == workId)?.name}" no período de ${startDate} a ${endDate}? ` +
        `Todos os lançamentos existentes para outros equipamentos neste período serão sobrescritos.`
    );

    if (!confirmReplication) {
        return;
    }

    showSpinner();

    try {
        // 1. Buscar lançamentos do equipamento de origem
        const sourceEntries = await apiClient.fetchDailyEntries(workId, sourceEquipmentId, startDate, endDate);
        const sourceEntriesMap = new Map(sourceEntries.map(e => [e.date, e]));

        const work = appState.works.find(w => w.id == workId);
        const allEquipmentInWork = work?.config?.equipment || [];
        const targetEquipmentIds = allEquipmentInWork.filter(ec => ec.equipment_id != sourceEquipmentId).map(ec => ec.equipment_id);

        console.log(`Iniciando replicação para ${targetEquipmentIds.length} equipamentos de destino`);

        // 🔥 FILTRAR APENAS EQUIPAMENTOS MOBILIZADOS OU NUNCA MOBILIZADOS (NÃO REPLICA PARA DESMOBILIZADOS)
        const validEquipmentIds = [];
        for (const equipId of targetEquipmentIds) {
            const status = await getEquipmentMobilizationStatus(equipId, workId, startDate, endDate);
            if (status.status === 'mobilized' || status.status === 'never_mobilized') {
                validEquipmentIds.push(equipId);
            } else {
                console.log(`⏭️ Pulando equipamento ${equipId} - Status: ${status.status} (DESMOBILIZADO)`);
            }
        }

        console.log(`Replicando para ${validEquipmentIds.length} equipamentos válidos (de ${targetEquipmentIds.length} total)`);

        // 2. Para cada equipamento de destino VÁLIDO
        for (const targetEquipId of validEquipmentIds) {
            console.log(`Processando equipamento de destino: ${targetEquipId}`);

            // 2.1. Buscar lançamentos existentes do equipamento de destino
            const existingTargetEntries = await apiClient.fetchDailyEntries(workId, targetEquipId, startDate, endDate);
            const existingTargetEntriesMap = new Map(existingTargetEntries.map(e => [e.date, e]));

            console.log(`Equipamento ${targetEquipId}: ${existingTargetEntries.length} lançamentos existentes`);

            // 2.2. Para cada data no período
            const startDateObj = new Date(startDate + 'T00:00:00');
            const endDateObj = new Date(endDate + 'T00:00:00');

            for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const sourceEntry = sourceEntriesMap.get(dateStr);

                if (sourceEntry) {
                    // 2.3. Verificar se já existe entrada para esta data/equipamento
                    const existingTargetEntry = existingTargetEntriesMap.get(dateStr);

                    // REPLICA APENAS: is_worked, is_mobilization, is_demobilized e flags de contabilização
                    const basePayload = {
                        work_id: workId,
                        equipment_id: targetEquipId,
                        date: dateStr,
                        bm_label: getBMLabelForDate(dateStr, work?.config?.measurement_periods),
                        is_worked: sourceEntry.is_worked || false,
                        is_mobilization: sourceEntry.is_mobilization || false,
                        is_mobilization_contabilized: sourceEntry.is_mobilization_contabilized || 1,
                        is_demobilized: sourceEntry.is_demobilized || false,
                        is_demobilization_contabilized: sourceEntry.is_demobilization_contabilized || 1,
                        pay_salary: sourceEntry.pay_salary !== false,
                        daily_total_value: 0,
                        daily_manual_value: null,
                        daily_total_value_terceirizado: 0,
                        daily_manual_value_terceirizado: null
                    };

                    // 2.4. Preservar configurações de cálculo mensal
                    if (sourceEntry.monthly_calculation_override) {
                        basePayload.monthly_calculation_override = sourceEntry.monthly_calculation_override;
                    }
                    if (sourceEntry.monthly_calculation_override_terceirizado) {
                        basePayload.monthly_calculation_override_terceirizado = sourceEntry.monthly_calculation_override_terceirizado;
                    }
                    if (sourceEntry.monthly_calculation_manual) {
                        basePayload.monthly_calculation_manual = sourceEntry.monthly_calculation_manual;
                    }
                    if (sourceEntry.monthly_calculation_manual_terceirizado) {
                        basePayload.monthly_calculation_manual_terceirizado = sourceEntry.monthly_calculation_manual_terceirizado;
                    }

                    // 2.5. CORREÇÃO PRINCIPAL: Se existe entrada, atualizar com ID. Se não existe, criar nova.
                    let entryPayload = { ...basePayload };
                    
                    if (existingTargetEntry) {
                        // Atualizar entrada existente
                        entryPayload.id = existingTargetEntry.id;
                        console.log(`Atualizando entrada existente ID ${existingTargetEntry.id} para data ${dateStr} equipamento ${targetEquipId}`);
                    } else {
                        // Criar nova entrada (sem ID)
                        delete entryPayload.id;
                        console.log(`Criando nova entrada para data ${dateStr} equipamento ${targetEquipId}`);
                    }

                    // 2.6. Calcular valores específicos do equipamento de destino
                    const targetEquipment = appState.equipment.find(e => e.id == targetEquipId);
                    const targetEquipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == targetEquipId);

                    if (targetEquipConfig) {
                        const tempEntry = {
                            ...entryPayload,
                            equipment_id: targetEquipId
                        };

                        if (tempEntry.is_worked) {
                            entryPayload.daily_total_value = calculateDailyBaseValue(tempEntry, targetEquipConfig, work);
                            
                            if (targetEquipment?.is_terceirizado) {
                                entryPayload.daily_total_value_terceirizado = calculateDailyBaseValueTerceirizado(tempEntry, targetEquipConfig, work);
                            }
                        }
                    }

                    // 2.7. USAR UPSERT COM CONSTRAINT CORRETA para evitar duplicatas
                    try {
                        const savedEntry = await apiClient.upsertItem(
                            'daily_entries', 
                            entryPayload, 
                            'work_id, equipment_id, date'  // Constraint que evita duplicatas por obra+equipamento+data
                        );
                        console.log(`✓ Entrada salva com sucesso: ID ${savedEntry.id} para ${dateStr}`);
                    } catch (upsertError) {
                        console.error(`✗ Erro ao salvar entrada para ${dateStr} equipamento ${targetEquipId}:`, upsertError);
                        throw upsertError;
                    }
                }
            }
        }

        alert('Lançamentos replicados e salvos com sucesso para todos os equipamentos!');
        
        // 3. 🔥 ATUALIZAR TUDO EM TEMPO REAL (daily_entries, avarias, despesas)
        console.log('🔥 Recarregando TODOS os dados do período...');
        
        // Recarregar daily_entries
        const allDailyEntries = await apiClient.fetchData('daily_entries', 
            `*, works(*), equipment(*)`, 
            `work_id.eq.${workId},date.gte.${startDate},date.lte.${endDate}`
        );
        appState.daily_entries = appState.daily_entries.filter(e => 
            !(e.work_id == workId && e.date >= startDate && e.date <= endDate)
        );
        appState.daily_entries.push(...allDailyEntries);
        
        // Recarregar avarias (damages)
        const allDamages = await apiClient.fetchData('damages',
            `*`,
            `work_id.eq.${workId},damage_date.gte.${startDate},damage_date.lte.${endDate}`
        );
        appState.damages = appState.damages.filter(d => 
            !(d.work_id == workId && d.damage_date >= startDate && d.damage_date <= endDate)
        );
        appState.damages.push(...allDamages);
        
        // Recarregar despesas (general_expenses)
        const allExpenses = await apiClient.fetchData('general_expenses',
            `*`,
            `work_id.eq.${workId},expense_date.gte.${startDate},expense_date.lte.${endDate}`
        );
        appState.expenses = appState.expenses.filter(ex => 
            !(ex.work_id == workId && ex.expense_date >= startDate && ex.expense_date <= endDate)
        );
        appState.expenses.push(...allExpenses);
        
        console.log('✅ Todos os dados recarregados no appState');
        console.log('   - Daily entries:', allDailyEntries.length);
        console.log('   - Avarias:', allDamages.length);
        console.log('   - Despesas:', allExpenses.length);
        
        // 4. 🔥 FORÇAR REFRESH COMPLETO DA VISUALIZAÇÃO
        console.log('🔄 Forçando refresh completo da visualização...');
        await displayPeriodEntries(workId, sourceEquipmentId, startDate, endDate);
        
        // 5. 🔥🔥🔥 FORÇAR RECÁLCULO DO VALOR TOTAL DA BM NO TOPO (URGENTE!)
        console.log('🔥🔥🔥 RECALCULANDO TOTAL DA BM NO TOPO...');
        const currentEquipmentId = entryEquipmentSelect?.value;
        if (currentEquipmentId) {
            await addMeasurementValuesToCards(workId, currentEquipmentId);
            console.log('✅ Valores de medição recalculados e exibidos!');
        }
        
        console.log('✅ Visualização atualizada em tempo real!');

    } catch (e) {
        console.error("Erro ao replicar lançamentos:", e);
        alert(`Erro ao replicar lançamentos: ${e.message}`);
    } finally {
        hideSpinner();
    }
};

// Função para adicionar valores de medição nos cartões após renderização
const addMeasurementValuesToCards = async (workId, equipmentId) => {
    const work = appState.works.find(w => w.id == workId);
    const equip = appState.equipment.find(e => e.id == equipmentId);
    const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);
    
    if (!work?.config?.measurement_periods || !equipConfig) {
        console.log('⚠️ Sem períodos de medição ou config para calcular');
        return;
    }
    
    // Buscar BMs únicas dos cartões renderizados
    const bmCards = document.querySelectorAll('.entry-card[data-bm-label]');
    const uniqueBmLabels = [...new Set(Array.from(bmCards).map(card => card.dataset.bmLabel).filter(Boolean))];
    
    console.log('🎯 BMs encontradas nos cartões:', uniqueBmLabels);
    
    // Calcular valor de medição para cada BM
    for (const bmLabel of uniqueBmLabels) {
        // Encontrar o período correspondente ao bmLabel (ex: "BM 1" → índice 0)
        const bmIndex = parseInt(bmLabel.replace('BM ', '')) - 1;
        const period = work.config.measurement_periods[bmIndex];
        
        if (!period) {
            console.log(`⚠️ Período não encontrado para ${bmLabel} (índice ${bmIndex})`);
            continue;
        }
        
        // Buscar entradas do período
        const equipmentEntries = appState.daily_entries.filter(entry =>
            entry.work_id == work.id &&
            entry.equipment_id == equip.id &&
            entry.date >= period.start &&
            entry.date <= period.end
        );
        
        const equipmentExpenses = appState.expenses ? appState.expenses.filter(exp =>
            exp.work_id == work.id &&
            exp.equipment_id == equip.id &&
            exp.date >= period.start &&
            exp.date <= period.end
        ) : [];
        
        const validDamages = appState.damages ? appState.damages.filter(damage =>
            damage.work_id == work.id &&
            damage.equipment_id == equip.id &&
            damage.damage_date >= period.start &&
            damage.damage_date <= period.end
        ) : [];
        
        console.log(`🔧🔧🔧 AVARIAS ENCONTRADAS PARA ${equip.prefix}:`, {
            total: validDamages.length,
            damages: validDamages.map(d => ({
                date: d.damage_date,
                value: d.impacto_cliente_total,
                type: d.client_impact_type
            }))
        });
        
        const substitutionDetails = appState.equipment_substitutions ? appState.equipment_substitutions.filter(sub =>
            sub.work_id == work.id &&
            sub.guarantor_equipment_id == equip.id &&
            sub.substitution_date >= period.start &&
            sub.substitution_date <= period.end
        ) : [];
        
        try {
            const calculation = calculateEquipmentTotalValue(
                equipmentEntries,
                equipmentExpenses,
                equipConfig,
                work,
                validDamages,
                substitutionDetails,
                period.start,
                period.end
                // ⚠️ NÃO PASSAR periodConfig
            );
            
            const measurementValue = calculation.totalValue;
            const measurementValueTerceirizado = calculation.totalValueTerceirizado;
            
            console.log(`✅ BM ${bmLabel} (${equip.prefix}): R$ ${measurementValue.toFixed(2)}`);
            
            // 🎯 CALCULAR VALOR TOTAL DA BM (TODOS OS EQUIPAMENTOS)
            let bmTotalValue = 0;
            try {
                const allEquipmentConfigs = work.config.equipment || [];
                console.log(`🔥🔥🔥 CALCULANDO VALOR TOTAL PARA ${bmLabel} - INCLUINDO DESPESAS GERAIS! (${allEquipmentConfigs.length} equipamentos)`);
                
                const equipmentValues = []; // Array para somar com precisão
                
                for (const eqConfig of allEquipmentConfigs) {
                    const eqData = appState.equipment.find(e => e.id == eqConfig.equipment_id);
                    if (!eqData) continue;
                    
                    const eqEntries = appState.daily_entries.filter(entry =>
                        entry.work_id == work.id &&
                        entry.equipment_id == eqData.id &&
                        entry.date >= period.start &&
                        entry.date <= period.end
                    );
                    
                    const eqExpenses = appState.expenses ? appState.expenses.filter(exp =>
                        exp.work_id == work.id &&
                        exp.equipment_id == eqData.id &&
                        exp.date >= period.start &&
                        exp.date <= period.end
                    ) : [];
                    
                    const eqDamages = appState.damages ? appState.damages.filter(damage =>
                        damage.work_id == work.id &&
                        damage.equipment_id == eqData.id &&
                        damage.damage_date >= period.start &&
                        damage.damage_date <= period.end
                    ) : [];
                    
                    const eqSubstitutions = appState.equipment_substitutions ? appState.equipment_substitutions.filter(sub =>
                        sub.work_id == work.id &&
                        sub.guarantor_equipment_id == eqData.id &&
                        sub.substitution_date >= period.start &&
                        sub.substitution_date <= period.end
                    ) : [];
                    
                    const eqCalculation = calculateEquipmentTotalValue(
                        eqEntries,
                        eqExpenses,
                        eqConfig,
                        work,
                        eqDamages,
                        eqSubstitutions,
                        period.start,
                        period.end
                        // ⚠️ NÃO PASSAR periodConfig
                    );
                    
                    // Round each equipment value to 2 decimals BEFORE adding to array
                    const roundedValue = preciseRounding.round2(eqCalculation.totalValue);
                    console.log(`   💰 ${eqData.prefix}: R$ ${roundedValue.toFixed(2)}`);
                    equipmentValues.push(roundedValue);
                }
                
                // Somar todos os valores dos equipamentos com precisão
                console.log(`🔢 Array de valores antes da soma:`, equipmentValues);
                console.log(`🔢 Valores individuais:`, equipmentValues.map((v, i) => `[${i}]: ${v.toFixed(2)}`).join(', '));
                console.log(`🔢 Soma manual (+=):`, equipmentValues.reduce((a, b) => a + b, 0));
                console.log(`🔢 Quantidade de equipamentos:`, equipmentValues.length);
                bmTotalValue = preciseRounding.sumPrecise(...equipmentValues);
                console.log(`💰💰💰 SOMA DOS EQUIPAMENTOS (com precisão): ${formatCurrency(bmTotalValue)}`);
                console.log(`💰💰💰 SOMA preciseRounding (número): ${bmTotalValue}`);
                
                // 🎯 ADICIONAR DESPESAS GERAIS DA OBRA (como no relatório)
                try {
                    console.log(`�🔥🔥 INÍCIO CÁLCULO DESPESAS GERAIS PARA ${bmLabel}`);
                    console.log(`🔍 Verificando appState para despesas gerais:`, {
                        hasExpenses: !!appState.expenses,
                        expensesCount: appState.expenses?.length || 0,
                        hasDamages: !!appState.damages,
                        damagesCount: appState.damages?.length || 0,
                        workId: work.id,
                        periodStart: period.start,
                        periodEnd: period.end
                    });
                    
                    if (!appState.expenses || appState.expenses.length === 0) {
                        console.warn('⚠️ appState.expenses está vazio ou undefined!');
                    } else {
                        console.log('📋 AMOSTRA de despesas no appState (primeiras 3):', appState.expenses.slice(0, 3));
                        console.log('📋 Despesas da obra ' + work.id + ':', appState.expenses.filter(e => e.work_id == work.id).slice(0, 3));
                        console.log('📋 Despesas SEM equipment_id:', appState.expenses.filter(e => !e.equipment_id).slice(0, 3));
                    }
                    
                    const generalExpenses = appState.expenses ? appState.expenses.filter(exp => {
                        const match = exp.work_id == work.id &&
                                     !exp.equipment_id &&
                                     exp.date >= period.start &&
                                     exp.date <= period.end;
                        if (match) {
                            console.log('✅ Despesa geral encontrada:', exp);
                        }
                        return match;
                    }) : [];
                    
                    const generalDamages = appState.damages ? appState.damages.filter(damage => {
                        const match = damage.work_id == work.id &&
                                     !damage.equipment_id &&
                                     damage.damage_date >= period.start &&
                                     damage.damage_date <= period.end;
                        if (match) {
                            console.log('✅ Avaria geral encontrada:', damage);
                        }
                        return match;
                    }) : [];
                    
                    console.log(`📊 Despesas gerais encontradas:`, {
                        generalExpensesCount: generalExpenses.length,
                        generalDamagesCount: generalDamages.length,
                        generalExpenses,
                        generalDamages
                    });
                    
                    const EXPENSE_IMPACT_TYPES = { ADD_CLIENT: 'add_client', DISC_CLIENT: 'disc_client' };
                    
                    const calculateGeneralExpensesImpact = (expenses, impactType) => {
                        const filtered = expenses.filter(exp => exp.measurement_impact === impactType);
                        const values = filtered.map(exp => parseFloat(exp.impacto_cliente_total) || 0);
                        return preciseRounding.round2(values.reduce((sum, val) => sum + val, 0));
                    };
                    
                    const generalWorkAdditions = calculateGeneralExpensesImpact(generalExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
                    const generalWorkDiscounts = calculateGeneralExpensesImpact(generalExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);
                    
                    const generalDamageAdditions = preciseRounding.round2(
                        generalDamages
                            .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                            .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0)
                    );
                    
                    const generalDamageDiscounts = preciseRounding.round2(
                        generalDamages
                            .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                            .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0)
                    );
                    
                    const generalWorkTotal = preciseRounding.sumPrecise(
                        generalWorkAdditions,
                        generalDamageAdditions,
                        -generalWorkDiscounts,
                        -generalDamageDiscounts
                    );
                    
                    bmTotalValue = preciseRounding.sumPrecise(bmTotalValue, generalWorkTotal);
                    
                    console.log(`💰 DESPESAS GERAIS DA OBRA (${bmLabel}):`, {
                        additions: generalWorkAdditions,
                        discounts: generalWorkDiscounts,
                        damageAdditions: generalDamageAdditions,
                        damageDiscounts: generalDamageDiscounts,
                        generalWorkTotal,
                        formatted: formatCurrency(generalWorkTotal)
                    });
                } catch (generalExpError) {
                    console.error('❌ Erro ao calcular despesas gerais:', generalExpError);
                }
                
                console.log(`🏆 VALOR TOTAL DA ${bmLabel}: ${formatCurrency(bmTotalValue)} (${allEquipmentConfigs.length} equipamentos + despesas gerais)`);
                
                // 🎯 ATUALIZAR BLOCO DE INFORMAÇÕES NO TOPO
                const periodSummaryInfo = document.getElementById('period-summary-info');
                const periodWorkName = document.getElementById('period-work-name');
                const periodClientName = document.getElementById('period-client-name');
                const periodBmTotal = document.getElementById('period-bm-total');
                
                if (periodSummaryInfo && periodWorkName && periodClientName && periodBmTotal) {
                    // O nome do cliente já vem carregado no work via join
                    const clientName = work.client_companies?.name || 'N/A';
                    
                    periodWorkName.textContent = `OBRA: ${work.name || 'N/A'}`;
                    periodClientName.textContent = `CLIENTE: ${clientName}`;
                    periodBmTotal.textContent = `TOTAL DA ${bmLabel}: ${formatCurrency(bmTotalValue)}`;
                    periodSummaryInfo.style.display = 'block';
                }
                
            } catch (bmTotalError) {
                console.error('❌ Erro ao calcular valor total da BM:', bmTotalError);
            }
            
            // Adicionar valor em TODOS os cartões desta BM
            const targetCards = document.querySelectorAll(`.entry-card[data-bm-label="${bmLabel}"]`);
            console.log(`🎯 Atualizando ${targetCards.length} cards com ${bmLabel}: ${formatCurrency(bmTotalValue)}`);
            
            // 💼 CALCULAR E ADICIONAR BADGES DE DESPESAS GERAIS (em todos os cards da BM)
            try {
                const generalExpenses = appState.expenses?.filter(exp => 
                    exp.work_id == workId &&
                    !exp.equipment_id &&
                    exp.date >= period.start &&
                    exp.date <= period.end
                ) || [];
                
                const generalDamages = appState.damages?.filter(damage => 
                    damage.work_id == workId &&
                    !damage.equipment_id &&
                    damage.damage_date >= period.start &&
                    damage.damage_date <= period.end
                ) || [];
                
                if (generalExpenses.length > 0 || generalDamages.length > 0) {
                    const EXPENSE_IMPACT_TYPES = { ADD_CLIENT: 'add_client', DISC_CLIENT: 'disc_client' };
                    
                    const generalWorkAdditions = generalExpenses
                        .filter(exp => exp.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                        .reduce((sum, exp) => sum + (parseFloat(exp.impacto_cliente_total) || 0), 0);
                    
                    const generalWorkDiscounts = generalExpenses
                        .filter(exp => exp.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                        .reduce((sum, exp) => sum + (parseFloat(exp.impacto_cliente_total) || 0), 0);
                    
                    const generalDamageAdditions = generalDamages
                        .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                        .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0);
                    
                    const generalDamageDiscounts = generalDamages
                        .filter(d => d.measurement_impact === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                        .reduce((sum, d) => sum + (parseFloat(d.impacto_cliente_total) || 0), 0);
                    
                    const generalWorkTotal = generalWorkAdditions + generalDamageAdditions - generalWorkDiscounts - generalDamageDiscounts;
                    
                    if (generalWorkTotal !== 0) {
                        const totalGeneralExpenses = Math.abs(generalWorkTotal);
                        
                        targetCards.forEach(card => {
                            const alertBadgesContainer = card.querySelector('.alert-badges-container');
                            
                            if (alertBadgesContainer) {
                                // Remover badge antigo se existir
                                const oldBadge = alertBadgesContainer.querySelector('.alert-badge-general-expense');
                                if (oldBadge) oldBadge.remove();
                                
                                // Adicionar novo badge
                                const badgeHtml = `<span class="alert-badge alert-badge-general-expense" style="background-color: #CC6600; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; display: inline-block; margin: 2px;">💼 DESPESAS GERAIS: ${formatCurrency(totalGeneralExpenses)}</span>`;
                                alertBadgesContainer.insertAdjacentHTML('beforeend', badgeHtml);
                            }
                        });
                    }
                }
            } catch (badgeError) {
                console.error('❌ Erro ao adicionar badges de despesas gerais:', badgeError);
            }
            
            targetCards.forEach(card => {
                const headerValuesContainer = card.querySelector('.header-values-container');
                if (headerValuesContainer) {
                    // 🔥 ATUALIZAR VALORES DA BM NO DISPLAY DO CARTÃO!
                    const measurementDisplaySpan = headerValuesContainer.querySelector('.measurement-total-display');
                    if (measurementDisplaySpan) {
                        const existingText = measurementDisplaySpan.textContent;
                        // Preservar o label da BM e atualizar apenas o valor
                        measurementDisplaySpan.textContent = `${bmLabel}: ${formatCurrency(measurementValue)}`;
                        console.log(`🔥 ATUALIZADO! ${card.dataset.date}: ${existingText} → ${measurementDisplaySpan.textContent}`);
                    } else {
                        console.warn(`⚠️ Card ${card.dataset.date}: .measurement-total-display não encontrado!`);
                    }
                    
                    // 🎯 ATUALIZAR ACUMULADOS NO PERÍODO
                    updatePeriodAccumulatedValues(card);
                    
                    // 🔴 ADICIONAR BADGE DE DESPESA ESPECÍFICA DO EQUIPAMENTO (somente na data específica)
                    if (appState.expenses) {
                        const cardDate = card.dataset.date;
                        const cardEquipmentId = card.dataset.equipmentId;
                        
                        const equipmentExpenses = appState.expenses.filter(exp => 
                            exp.work_id == workId &&
                            exp.equipment_id == cardEquipmentId &&
                            exp.date === cardDate
                        );
                        
                        if (equipmentExpenses.length > 0) {
                            const totalEquipmentExpenses = equipmentExpenses.reduce((sum, exp) => sum + (parseFloat(exp.total_value) || 0), 0);
                            
                            const alertBadgesContainer = card.querySelector('.alert-badges-container');
                            if (alertBadgesContainer) {
                                // Remover badge antigo se existir
                                const oldBadge = alertBadgesContainer.querySelector('.alert-badge-equipment-expense');
                                if (oldBadge) oldBadge.remove();
                                
                                // Adicionar novo badge
                                const badgeHtml = `<span class="alert-badge alert-badge-equipment-expense" style="background-color: #DC143C; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; display: inline-block; margin: 2px;">🔴 DESPESA DE EQUIPAMENTO: ${formatCurrency(totalEquipmentExpenses)}</span>`;
                                alertBadgesContainer.insertAdjacentHTML('beforeend', badgeHtml);
                            }
                        }
                    }
                    
                    // Se terceirizado, adicionar valor terc também
                    if (equip?.is_terceirizado && measurementValueTerceirizado) {
                        const tercHtml = `<strong class="measurement-total-terceirizado-display" style="color: #ff6b35; font-size: 0.9em; margin-left: 10px;">${bmLabel} Terc.: ${formatCurrency(measurementValueTerceirizado)}</strong>`;
                        const tercContainer = headerValuesContainer.querySelector('.header-values-info.terceirizado');
                        if (tercContainer) {
                            tercContainer.insertAdjacentHTML('beforeend', tercHtml);
                        }
                    }
                }
            });
            
            // 🔥🔥🔥 ATUALIZAR TOTAL DA BM NO TOPO DA PÁGINA (APÓS O LOOP)
            // 🔥🔥🔥 ATUALIZAR TOTAL DA BM EM TODOS OS LUGARES
            console.log(`🔥🔥🔥 ATUALIZANDO TOTAL NO TOPO: ${bmLabel} = ${formatCurrency(bmTotalValue)}`);
            
            // 1️⃣ Atualizar elemento #period-bm-total
            const periodBmTotal = document.getElementById('period-bm-total');
            if (periodBmTotal) {
                const oldText = periodBmTotal.textContent;
                periodBmTotal.textContent = `TOTAL DA ${bmLabel}: ${formatCurrency(bmTotalValue)}`;
                console.log(`🔥🔥🔥 #period-bm-total ATUALIZADO: "${oldText}" → "${periodBmTotal.textContent}"`);
            } else {
                console.error('❌ #period-bm-total NÃO ENCONTRADO NO DOM!');
            }
            
            // 2️⃣ Atualizar TODOS os elementos .bm-total-display nos cartões
            const bmTotalDisplays = document.querySelectorAll(`.entry-card[data-bm-label="${bmLabel}"] .bm-total-display`);
            console.log(`🔥🔥🔥 Atualizando ${bmTotalDisplays.length} elementos .bm-total-display`);
            bmTotalDisplays.forEach(display => {
                const oldText = display.textContent;
                display.textContent = `Total ${bmLabel}: ${formatCurrency(bmTotalValue)}`;
                console.log(`🔥🔥🔥 .bm-total-display ATUALIZADO: "${oldText}" → "${display.textContent}"`);
            });
            
        } catch (e) {
            console.error(`❌ Erro ao calcular medição da BM ${bmLabel}:`, e);
        }
    }
};

const calculateAndDisplayDailyTotal = async (card) => {
    const workId = card.dataset.workId || entryWorkSelect?.value;
    const equipmentId = card.dataset.equipmentId || entryEquipmentSelect?.value;
    
    if (!workId || !equipmentId) return;

    const work = appState.works.find(w => w.id == workId);
    const equipment = appState.equipment.find(e => e.id == equipmentId);
    const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);

    if (!work || !equipment || !equipConfig) return;

    const horometerStartInput = card.querySelector('.horometer-start');
    const horometerEndInput = card.querySelector('.horometer-end');
    const kmStartInput = card.querySelector('.km-start');
    const kmEndInput = card.querySelector('.km-end');

    const horometer_start = horometerStartInput ? parseFloat(horometerStartInput.value) : null;
    const horometer_end = horometerEndInput ? parseFloat(horometerEndInput.value) : null;
    const km_start = kmStartInput ? parseFloat(kmStartInput.value) : null;
    const km_end = kmEndInput ? parseFloat(kmEndInput.value) : null;

    const dailyRunHours = (!isNaN(horometer_start) && !isNaN(horometer_end)) ? Math.max(0, horometer_end - horometer_start) : 0;
    const dailyRunKm = (!isNaN(km_start) && !isNaN(km_end)) ? Math.max(0, km_end - km_start) : 0;

    const dailyRunHoursDisplay = card.querySelector('.daily-run-hours-display');
    if (dailyRunHoursDisplay) {
        dailyRunHoursDisplay.textContent = dailyRunHours.toFixed(2);
    }

    const dailyRunKmDisplay = card.querySelector('.daily-run-km-display');
    if (dailyRunKmDisplay) {
        dailyRunKmDisplay.textContent = dailyRunKm.toFixed(2);
    }

    let cumulativeHours = dailyRunHours;
    let cumulativeKm = dailyRunKm;

    const allCards = Array.from(document.querySelectorAll('#entries-list .entry-card'));
    const currentCardIndex = allCards.findIndex(c => c === card);

    for (let i = 0; i < currentCardIndex; i++) {
        const prevCard = allCards[i];
        const prevHorometerStart = parseFloat(prevCard.querySelector('.horometer-start')?.value) || 0;
        const prevHorometerEnd = parseFloat(prevCard.querySelector('.horometer-end')?.value) || 0;
        const prevKmStart = parseFloat(prevCard.querySelector('.km-start')?.value) || 0;
        const prevKmEnd = parseFloat(prevCard.querySelector('.km-end')?.value) || 0;

        cumulativeHours += Math.max(0, prevHorometerEnd - prevHorometerStart);
        cumulativeKm += Math.max(0, prevKmEnd - prevKmStart);
    }

    const cumulativeHoursDisplay = card.querySelector('.cumulative-run-hours-display');
    if (cumulativeHoursDisplay) {
        cumulativeHoursDisplay.textContent = cumulativeHours.toFixed(2);
    }

    const cumulativeKmDisplay = card.querySelector('.cumulative-run-km-display');
    if (cumulativeKmDisplay) {
        cumulativeKmDisplay.textContent = cumulativeKm.toFixed(2);
    }

    // USAR A NOVA FUNÇÃO QUE CALCULA TUDO
    const completeValues = calculateCompleteCardDailyValue(card, work, equipConfig, equipment, dailyRunHours, dailyRunKm);

    // ATUALIZAR O "VALOR DIA" COM O VALOR COMPLETO
    const dailyTotalDisplay = card.querySelector('.daily-total-display');
    if (dailyTotalDisplay) {
        dailyTotalDisplay.style.fontSize = '0.9em';
        dailyTotalDisplay.textContent = `Dia: ${formatCurrency(completeValues.clientValue)}`;
    }

    const dailyTotalTerceirizadoDisplay = card.querySelector('.daily-total-terceirizado-display');
    if (dailyTotalTerceirizadoDisplay) {
        dailyTotalTerceirizadoDisplay.textContent = `Terc.: ${formatCurrency(completeValues.terceirizadoValue)}`;
    }

    for (let i = currentCardIndex + 1; i < allCards.length; i++) {
        const nextCard = allCards[i];
        const nextCumulativeHoursDisplay = nextCard.querySelector('.cumulative-run-hours-display');
        const nextCumulativeKmDisplay = nextCard.querySelector('.cumulative-run-km-display');

        if (nextCumulativeHoursDisplay || nextCumulativeKmDisplay) {
            const nextHorometerStart = parseFloat(nextCard.querySelector('.horometer-start')?.value) || 0;
            const nextHorometerEnd = parseFloat(nextCard.querySelector('.horometer-end')?.value) || 0;
            const nextKmStart = parseFloat(nextCard.querySelector('.km-start')?.value) || 0;
            const nextKmEnd = parseFloat(nextCard.querySelector('.km-end')?.value) || 0;

            const nextDailyHours = Math.max(0, nextHorometerEnd - nextHorometerStart);
            const nextDailyKm = Math.max(0, nextKmEnd - nextKmStart);

            cumulativeHours += nextDailyHours;
            cumulativeKm += nextDailyKm;

            if (nextCumulativeHoursDisplay) {
                nextCumulativeHoursDisplay.textContent = cumulativeHours.toFixed(2);
            }

            if (nextCumulativeKmDisplay) {
                nextCumulativeKmDisplay.textContent = cumulativeKm.toFixed(2);
            }
        }
    }
    
    // Atualizar acumulados no período
    updatePeriodAccumulatedValues(card);
    
    // DEBUG: Mostrar breakdown do cálculo
    console.log(`[DEBUG VALOR COMPLETO] Dia: ${card.dataset.date}`);
    console.log(`[DEBUG VALOR COMPLETO] Breakdown:`, completeValues.breakdown);
    console.log(`[DEBUG VALOR COMPLETO] Valor final: R$ ${completeValues.clientValue.toFixed(2)}`);
};


// Função para calcular acumulados no período (soma de horas/km rodados no período da BM)
const updatePeriodAccumulatedValues = (card) => {
    // 🎯 Buscar todos os cards do mesmo equipamento
    const allCards = Array.from(document.querySelectorAll('.entry-card')).filter(c => {
        return c.dataset.equipmentId === card.dataset.equipmentId;
    });

    console.log(`🔍 CALCULANDO ACUMULADOS NO PERÍODO - Equipamento: ${card.dataset.equipmentId}`);
    console.log(`📊 Total de cards encontrados: ${allCards.length}`);

    let periodTotalHours = 0;
    let periodTotalKm = 0;

    // Somar todas as horas e KM rodados no período
    allCards.forEach(c => {
        const horometerStart = parseFloat(c.querySelector('.horometer-start')?.value) || 0;
        const horometerEnd = parseFloat(c.querySelector('.horometer-end')?.value) || 0;
        const kmStart = parseFloat(c.querySelector('.km-start')?.value) || 0;
        const kmEnd = parseFloat(c.querySelector('.km-end')?.value) || 0;

        const dailyHours = Math.max(0, horometerEnd - horometerStart);
        const dailyKm = Math.max(0, kmEnd - kmStart);

        console.log(`  📅 ${c.dataset.date}: ${dailyHours.toFixed(2)}h, ${dailyKm.toFixed(2)}km`);

        periodTotalHours += dailyHours;
        periodTotalKm += dailyKm;
    });
    
    console.log(`✅ TOTAL NO PERÍODO: ${periodTotalHours.toFixed(2)}h, ${periodTotalKm.toFixed(2)}km`);

    // Atualizar o display do card atual
    const periodHoursDisplay = card.querySelector('.period-run-hours-display');
    if (periodHoursDisplay) {
        periodHoursDisplay.textContent = periodTotalHours.toFixed(2);
    }

    const periodKmDisplay = card.querySelector('.period-run-km-display');
    if (periodKmDisplay) {
        periodKmDisplay.textContent = periodTotalKm.toFixed(2);
    }

    // Atualizar todos os outros cards do mesmo equipamento
    allCards.forEach(c => {
        if (c !== card) {
            const otherPeriodHoursDisplay = c.querySelector('.period-run-hours-display');
            if (otherPeriodHoursDisplay) {
                otherPeriodHoursDisplay.textContent = periodTotalHours.toFixed(2);
            }

            const otherPeriodKmDisplay = c.querySelector('.period-run-km-display');
            if (otherPeriodKmDisplay) {
                otherPeriodKmDisplay.textContent = periodTotalKm.toFixed(2);
            }
        }
    });
};


// Função que usa os tipos efetivos para cálculo
const recalculateCardValuesWithEffectiveTypes = (card, work, equipConfig, equipment, dailyRunHours, dailyRunKm) => {
    const isWorkedCheck = card.querySelector('.is-worked-check');
    const isWorked = isWorkedCheck ? isWorkedCheck.checked : false;
    
    if (!isWorked) {
        return { clientValue: 0, terceirizadoValue: 0 };
    }
    
    // CORREÇÃO PRINCIPAL: Criar objeto de entrada simulado com tipo de cálculo correto
    const effectiveCalculationType = getEffectiveMonthlyCalculationType(card);
    
    const simulatedEntry = {
        date: card.dataset.date,
        work_id: card.dataset.workId,
        equipment_id: card.dataset.equipmentId,
        is_worked: isWorked,
        bm_label: card.dataset.bmLabel,
        // CORREÇÃO: Passa o tipo efetivo como override manual
        monthly_calculation_manual: effectiveCalculationType !== (equipConfig?.monthly_calculation || 'proportional') ? 
            effectiveCalculationType : null,
        // TAMBÉM passa como override automático para garantir
        monthly_calculation_override: effectiveCalculationType
    };
    
    console.log(`[DEBUG recalculateCardValuesWithEffectiveTypes] Data: ${card.dataset.date}`);
    console.log(`[DEBUG recalculateCardValuesWithEffectiveTypes] Tipo efetivo determinado: ${effectiveCalculationType}`);
    console.log(`[DEBUG recalculateCardValuesWithEffectiveTypes] Entry simulado:`, simulatedEntry);
    
    // USA O MÓDULO CENTRALIZADO para cálculo preciso
    const dailyValue = calculateDailyBaseValue(simulatedEntry, equipConfig, work);
    
    // Para terceirizados, se aplicável
    let dailyValueTerceirizado = 0;
    if (equipment?.is_terceirizado) {
        const effectiveCalculationTypeTerceirizado = getEffectiveMonthlyCalculationTypeTerceirizado(card);
        const simulatedEntryTerc = {
            ...simulatedEntry,
            monthly_calculation_manual_terceirizado: effectiveCalculationTypeTerceirizado !== (equipConfig?.monthly_calculation_terceirizado || equipConfig?.monthly_calculation || 'proportional') ? 
                effectiveCalculationTypeTerceirizado : null,
            monthly_calculation_override_terceirizado: effectiveCalculationTypeTerceirizado
        };
        
        dailyValueTerceirizado = calculateDailyBaseValueTerceirizado(simulatedEntryTerc, equipConfig, work);
    }
    
    console.log(`[DEBUG recalculateCardValuesWithEffectiveTypes] Valor diário calculado: R$ ${dailyValue.toFixed(2)}`);
    
    return { 
        clientValue: dailyValue, 
        terceirizadoValue: dailyValueTerceirizado 
    };
};




const calculateCompleteCardDailyValue = (card, work, equipConfig, equipment, dailyRunHours, dailyRunKm) => {
    const isWorkedCheck = card.querySelector('.is-worked-check');
    const isWorked = isWorkedCheck ? isWorkedCheck.checked : false;
    
    // 1. VALOR BASE (do trabalho do equipamento)
    let baseValueClient = 0;
    let baseValueTerceirizado = 0;
    
    if (isWorked) {
        const calculatedValues = recalculateCardValuesWithEffectiveTypes(card, work, equipConfig, equipment, dailyRunHours, dailyRunKm);
        baseValueClient = calculatedValues.clientValue;
        baseValueTerceirizado = calculatedValues.terceirizadoValue;
    }
    
    // 2. MOBILIZAÇÃO (se marcada e contabilizada)
    let mobilizationValueClient = 0;
    let mobilizationValueTerceirizado = 0;
    
    const mobilizeCheck = card.querySelector('.mobilize-check');
    const isMobilizing = mobilizeCheck ? mobilizeCheck.checked : false;
    const isMobilizationContabilized = card.querySelector('.is-mobilization-contabilized')?.value === '1';
    
    if (isMobilizing && isMobilizationContabilized) {
        const mobilizationManualValue = parseFloat(card.querySelector('.mobilization-manual-value')?.value);
        
        if (!isNaN(mobilizationManualValue)) {
            mobilizationValueClient = mobilizationManualValue;
        } else {
            mobilizationValueClient = parseFloat(equipConfig?.mobilization_cost || 0);
        }
        
        if (equipment?.is_terceirizado) {
            if (!isNaN(mobilizationManualValue)) {
                mobilizationValueTerceirizado = mobilizationManualValue;
            } else {
                const mobilizationCostTerc = parseFloat(equipConfig?.mobilization_cost_terceirizado);
                if (!isNaN(mobilizationCostTerc) && mobilizationCostTerc > 0) {
                    mobilizationValueTerceirizado = mobilizationCostTerc;
                }
            }
        }
    }
    
    // 3. DESMOBILIZAÇÃO (se marcada e contabilizada)
    let demobilizationValueClient = 0;
    let demobilizationValueTerceirizado = 0;
    
    const demobilizeCheck = card.querySelector('.demobilize-check');
    const isDemobilizing = demobilizeCheck ? demobilizeCheck.checked : false;
    const isDemobilizationContabilized = card.querySelector('.is-demobilization-contabilized')?.value === '1';
    
    if (isDemobilizing && isDemobilizationContabilized) {
        const demobilizationManualValue = parseFloat(card.querySelector('.demobilization-manual-value')?.value);
        
        if (!isNaN(demobilizationManualValue)) {
            demobilizationValueClient = demobilizationManualValue;
        } else {
            demobilizationValueClient = parseFloat(equipConfig?.demobilization_cost || 0);
        }
        
        if (equipment?.is_terceirizado) {
            if (!isNaN(demobilizationManualValue)) {
                demobilizationValueTerceirizado = demobilizationManualValue;
            } else {
                const demobilizationCostTerc = parseFloat(equipConfig?.demobilization_cost_terceirizado);
                if (!isNaN(demobilizationCostTerc) && demobilizationCostTerc > 0) {
                    demobilizationValueTerceirizado = demobilizationCostTerc;
                }
            }
        }
    }
    
    // 4. ANOTAÇÕES (acréscimos e descontos)
    let notesValueClient = 0;
    let notesValueTerceirizado = 0;
    
    card.querySelectorAll('.notes-container .form-grid').forEach(row => {
        const noteType = row.querySelector('.note-type')?.value;
        const noteDescription = row.querySelector('.note-description')?.value;
        const noteQuantity = parseFloat(row.querySelector('.note-quantity')?.value) || 0;
        const noteValue = parseFloat(row.querySelector('.note-value')?.value) || 0;
        const noteTarget = row.querySelector('.note-target')?.value || 'both';
        
        if (noteDescription && noteValue !== 0) {
            const totalNoteValue = noteQuantity * noteValue;
            
            if (noteType === 'addition') {
                if (noteTarget === 'client' || noteTarget === 'both') {
                    notesValueClient += totalNoteValue;
                }
                if (noteTarget === 'terceirizado' || noteTarget === 'both') {
                    notesValueTerceirizado += totalNoteValue;
                }
            } else if (noteType === 'discount') {
                if (noteTarget === 'client' || noteTarget === 'both') {
                    notesValueClient -= totalNoteValue;
                }
                if (noteTarget === 'terceirizado' || noteTarget === 'both') {
                    notesValueTerceirizado -= totalNoteValue;
                }
            }
        }
    });
    
    // 5. NOVO CÁLCULO AVANÇADO DE PARADAS COM TURNOS
    let stoppageDiscountClient = 0;
    let stoppageDiscountTerceirizado = 0;
    
    if (isWorked && equipConfig?.deductible_stoppages && equipConfig.deductible_stoppages.length > 0) {
        const workConfig = work?.config || {};
        
        // Determinar qual turno usar (por simplicidade, assumindo turno diurno por padrão)
        // TODO: Futuramente pode-se adicionar lógica para detectar o turno baseado no horário
        const workShift = calculateEffectiveWorkHours(workConfig, false); // false = turno diurno
        
        console.log('🏢 CONFIGURAÇÃO DO TURNO DE TRABALHO:', {
            inicio: minutesToTime(workShift.shiftStart),
            fim: minutesToTime(workShift.shiftEnd),
            refeicaoInicio: minutesToTime(workShift.mealStart),
            refeicaoFim: minutesToTime(workShift.mealEnd),
            horasEfetivas: workShift.effectiveWorkHours.toFixed(2)
        });
        
        let totalEffectiveStoppageMinutes = 0;
        
        card.querySelectorAll('.stoppages-container .form-grid').forEach(row => {
            const stoppageTypeId = row.querySelector('.stoppage-type')?.value;
            const stoppageStartStr = row.querySelector('.stoppage-start')?.value;
            const stoppageEndStr = row.querySelector('.stoppage-end')?.value;
            const hoursHHMM = row.querySelector('.stoppage-hours-hhmm')?.value;
            const hoursDecimal = row.querySelector('.stoppage-hours-decimal')?.value;
            
            console.log('🔍 DEBUG PARADA:', {
                tipo: stoppageTypeId,
                campo1Inicio: stoppageStartStr,
                campo1Fim: stoppageEndStr,
                campo2HHMM: hoursHHMM,
                campo3Decimal: hoursDecimal
            });
            
            if (stoppageTypeId && equipConfig.deductible_stoppages.includes(stoppageTypeId.toString())) {
                let stoppageMinutes = 0;
                let usedField = '';
                
                // 🎯 PRIORIDADE 1: Horas em decimal (ex: 1.3)
                if (hoursDecimal && hoursDecimal.trim() !== '') {
                    const decimal = parseFloat(hoursDecimal.replace(',', '.'));
                    if (!isNaN(decimal)) {
                        stoppageMinutes = decimal * 60;
                        usedField = 'DECIMAL';
                        console.log('✅ Usando CAMPO 3 (DECIMAL):', decimal, 'horas =', stoppageMinutes, 'minutos');
                    }
                }
                // 🎯 PRIORIDADE 2: Horas em HH:MM (ex: 01:18)
                else if (hoursHHMM && hoursHHMM.trim() !== '') {
                    const parts = hoursHHMM.split(':');
                    if (parts.length === 2) {
                        const hours = parseInt(parts[0]) || 0;
                        const minutes = parseInt(parts[1]) || 0;
                        stoppageMinutes = (hours * 60) + minutes;
                        usedField = 'HH:MM';
                        console.log('✅ Usando CAMPO 2 (HH:MM):', hoursHHMM, '=', stoppageMinutes, 'minutos');
                    }
                }
                // 🎯 PRIORIDADE 3: Cálculo por início/fim de parada (SOMENTE SE CAMPOS 2 E 3 VAZIOS)
                else if (stoppageStartStr || stoppageEndStr) {
                    // 🔍 SHERLOCK: Só calcula pelo Campo 1 se ele tiver algum valor
                    let stoppageStart, stoppageEnd;
                    usedField = 'CAMPO1';
                    
                    console.log('⚠️ Usando CAMPO 1 (HORÁRIOS)');
                    
                    // LÓGICA DE CAMPOS VAZIOS
                    if (!stoppageStartStr && !stoppageEndStr) {
                        // Ambos vazios = parada o dia todo
                        stoppageStart = workShift.shiftStart;
                        stoppageEnd = workShift.shiftEnd;
                        console.log('⚠️ CAMPO 1 VAZIO = DIA TODO!');
                    } else if (!stoppageStartStr && stoppageEndStr) {
                        // Início vazio = desde o início do turno até o horário especificado
                        stoppageStart = workShift.shiftStart;
                        stoppageEnd = timeToMinutes(stoppageEndStr);
                    } else if (stoppageStartStr && !stoppageEndStr) {
                        // Fim vazio = desde o horário especificado até o fim do turno
                        stoppageStart = timeToMinutes(stoppageStartStr);
                        stoppageEnd = workShift.shiftEnd;
                    } else {
                        // Ambos preenchidos = usar os horários especificados
                        stoppageStart = timeToMinutes(stoppageStartStr);
                        stoppageEnd = timeToMinutes(stoppageEndStr);
                    }
                    
                    stoppageMinutes = stoppageEnd - stoppageStart;
                    if (stoppageMinutes < 0) stoppageMinutes += 24 * 60;
                }
                // 🚫 SE TODOS OS 3 CAMPOS VAZIOS = IGNORA ESSA LINHA (NÃO DESCONTA NADA)
                
                // 🔥 USAR MINUTOS DIRETAMENTE - SEM DESCONTAR REFEIÇÃO (TODOS OS CAMPOS IGUAIS)
                totalEffectiveStoppageMinutes += stoppageMinutes;
                
                const campoUsado = hoursDecimal ? `Decimal: ${hoursDecimal}` : 
                                  hoursHHMM ? `HH:MM: ${hoursHHMM}` : 
                                  `Horário: ${stoppageStartStr} - ${stoppageEndStr}`;
                
                console.log('⏱️ PARADA PROCESSADA:', {
                    tipo: stoppageTypeId,
                    campo: campoUsado,
                    minutosInformados: stoppageMinutes,
                    minutosEfetivos: stoppageMinutes,
                    horasEfetivas: (stoppageMinutes / 60).toFixed(2)
                });
            }
        });
        
        if (totalEffectiveStoppageMinutes > 0) {
            // 🔥 CÁLCULO CORRETO PARA HORAS GARANTIDAS MENSAIS
            // Desconto = (minutos de parada / minutos garantidos no mês) × valor mensal
            
            const guaranteedHours = parseFloat(equipConfig?.guaranteed_hours) || 0;
            const monthlyValue = parseFloat(equipConfig?.measurement_value) || 0;
            
            if (guaranteedHours > 0 && monthlyValue > 0) {
                // Minutos garantidos no mês
                const guaranteedMinutesPerMonth = guaranteedHours * 60;
                
                // Desconto proporcional aos minutos garantidos
                const stoppageRatio = totalEffectiveStoppageMinutes / guaranteedMinutesPerMonth;
                
                console.log('📊 CÁLCULO DE DESCONTO (HORAS GARANTIDAS):', {
                    minutosParada: totalEffectiveStoppageMinutes,
                    horasParada: (totalEffectiveStoppageMinutes / 60).toFixed(2),
                    horasGarantidas: guaranteedHours,
                    minutosGarantidos: guaranteedMinutesPerMonth,
                    valorMensal: monthlyValue.toFixed(2),
                    proporcao: (stoppageRatio * 100).toFixed(2) + '%'
                });
                
                // Aplicar desconto proporcional ao valor mensal (não ao valor base diário!)
                const descontoTotal = monthlyValue * stoppageRatio;
                
                // Dividir pelo número de dias do mês para obter desconto diário
                const daysInMonth = parseInt(work?.config?.days_in_month) || 31;
                
                stoppageDiscountClient = descontoTotal / daysInMonth;
                stoppageDiscountTerceirizado = stoppageDiscountClient; // Mesmo desconto
                
                console.log('💰 DESCONTO CALCULADO:', {
                    descontoTotal: descontoTotal.toFixed(2),
                    diasNoMes: daysInMonth,
                    descontoDiario: stoppageDiscountClient.toFixed(2),
                    valorBaseDiario: baseValueClient.toFixed(2),
                    valorFinalDiario: (baseValueClient - stoppageDiscountClient).toFixed(2)
                });
            } else {
                console.log('⚠️ Não foi possível calcular desconto - horas garantidas ou valor mensal não definidos');
            }
        }
    }
    
    // 6. VALOR FINAL CALCULADO (TUDO INCLUÍDO)
    const finalCalculatedValueClient = baseValueClient + mobilizationValueClient + demobilizationValueClient + notesValueClient - stoppageDiscountClient;
    const finalCalculatedValueTerceirizado = baseValueTerceirizado + mobilizationValueTerceirizado + demobilizationValueTerceirizado + notesValueTerceirizado - stoppageDiscountTerceirizado;
    
    // 7. VERIFICAR SE HÁ VALOR MANUAL QUE SUBSTITUI TUDO
    const manualValueInput = card.querySelector('.daily-manual-value-header');
    const manualValueTercInput = card.querySelector('.daily-manual-value-terceirizado-header');
    
    let finalValueClient = finalCalculatedValueClient;
    let finalValueTerceirizado = finalCalculatedValueTerceirizado;
    
    if (manualValueInput && manualValueInput.value !== '') {
        finalValueClient = parseFloat(manualValueInput.value) || 0;
    }
    
    if (manualValueTercInput && manualValueTercInput.value !== '') {
        finalValueTerceirizado = parseFloat(manualValueTercInput.value) || 0;
    }
    
    return {
        clientValue: Math.max(0, finalValueClient),
        terceirizadoValue: Math.max(0, finalValueTerceirizado),
        breakdown: {
            baseValue: baseValueClient,
            mobilization: mobilizationValueClient,
            demobilization: demobilizationValueClient,
            notes: notesValueClient,
            stoppageDiscount: stoppageDiscountClient,
            isManualOverride: (manualValueInput && manualValueInput.value !== '')
        }
    };
};