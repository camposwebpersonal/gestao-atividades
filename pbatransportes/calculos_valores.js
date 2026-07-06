// calculos_valores.js - MÓDULO CENTRALIZADO DE CÁLCULOS DE VALORES (FRAGMENTADO E ATUALIZADO)
// =======================================================================
// Este arquivo centraliza a orquestração e os cálculos de valores que
// não são específicos de um tipo de medição (mensal, diário, horário, horas de garantia).
// Ele importa e utiliza as funções dos módulos de cálculo específicos.
// CORREÇÃO: Adicionado suporte para substituição de equipamentos
// =======================================================================

import { appState } from './appState.js';
import { calculateDeductibleHours, getEquipTypeName } from './utils.js'; // Presume que utils.js contém esta função
import { calculateMonthlyTotalValue } from './calculos_valores_mensal.js';

// Importações dos novos módulos fragmentados para cliente
import { calculateMonthlyBaseValue } from './calculos_valores_mensal.js';
import { calculateDailyFixedValue } from './calculos_valores_diario.js';
import { calculateHourlyBaseValue } from './calculos_valores_horas.js';

// Importações dos novos módulos fragmentados para terceirizados
import { calculateMonthlyBaseValueTerceirizado } from './calculos_valores_mensal_terceirizados.js';
import { calculateDailyFixedValueTerceirizado } from './calculos_valores_diario_terceirizados.js';
import { calculateHourlyBaseValueTerceirizado } from './calculos_valores_horas_terceirizados.js';

// NOVA IMPORTAÇÃO: Módulo para cálculo de horas de garantia
import { calculateGuaranteedHoursLogic } from './calculos_valores_garantia_horas.js';


/**
 * ===================================================================
 * SEÇÃO 1: CÁLCULOS DE VALORES BASE DIÁRIOS (CONTRATO PRINCIPAL)
 * ===================================================================
 * Esta seção contém a função que orquestra o cálculo do valor base
 * diário de um equipamento no contrato principal (cliente).
 */

/**
 * Calcula o valor diário base de um equipamento (contrato principal)
 *
 * REGRAS DE NEGÓCIO:
 * 1. Se existe valor manual, usa ele prioritariamente.
 * 2. Se não há valor manual, calcula baseado no tipo de medição:
 * - DIÁRIO: Chama a função específica de cálculo diário.
 * - MENSAL: Chama a função específica de cálculo mensal.
 * - HORÁRIO: Chama a função específica de cálculo por horas.
 * - HORAS DE GARANTIA: Retorna 0, pois o cálculo é feito em nível de período.
 * 3. Se não está trabalhando, retorna 0
 *
 * @param {Object} entry - Lançamento diário do equipamento
 * @param {Object} equipConfig - Configuração do equipamento na obra
 * @param {Object} work - Dados da obra (opcional, usado para cálculos mensais)
 * @returns {number} Valor base diário calculado
 */
export const calculateDailyBaseValue = (entry, equipConfig, work = null) => {
    // REGRA: Se não está trabalhando, valor é zero
    if (!entry.is_worked) {
        return 0;
    }

    // REGRA PRIORITÁRIA: Se existe valor manual válido, usa ele
    if (entry.daily_manual_value !== null && 
        entry.daily_manual_value !== undefined && 
        entry.daily_manual_value !== '' && 
        !isNaN(entry.daily_manual_value)) {
        return parseFloat(entry.daily_manual_value);
    }

    // CÁLCULO AUTOMÁTICO baseado no tipo de medição, chamando funções específicas
    let dailyValue = 0;

    switch (equipConfig?.measurement_type) {
        case 'daily':
            dailyValue = calculateDailyFixedValue(equipConfig);
            break;

        case 'hourly':
            dailyValue = calculateHourlyBaseValue(entry, equipConfig);
            break;

        case 'monthly':
            dailyValue = calculateMonthlyBaseValue(entry, equipConfig, work);
            break;

        case MEASUREMENT_TYPES.GUARANTEED_HOURS:
            // Para horas de garantia, o cálculo base é feito no nível do período completo.
            // Retorna 0 para o cálculo diário, pois o valor final depende do total de horas/dias no mês.
            dailyValue = 0;
            break;

        default:
            dailyValue = 0;
            break;
    }

    return dailyValue;
};

/**
 * ===================================================================
 * SEÇÃO 2: CÁLCULOS DE VALORES BASE DIÁRIOS (TERCEIRIZADOS)
 * ===================================================================
 * Esta seção contém a função que orquestra os cálculos para equipamentos
 * terceirizados.
 */

/**
 * Calcula o valor diário base de um equipamento terceirizado
 *
 * DIFERENÇAS DO CONTRATO PRINCIPAL:
 * 1. Usa daily_manual_value_terceirizado em vez de daily_manual_value
 * 2. Usa measurement_value_terceirizado se existir, senão usa measurement_value
 * 3. Pode ter measurement_type_terceirizado diferente
 * 4. Pode ter monthly_calculation_override_terceirizado independente
 *
 * @param {Object} entry - Lançamento diário do equipamento
 * @param {Object} equipConfig - Configuração do equipamento na obra
 * @param {Object} work - Dados da obra (opcional)
 * @returns {number} Valor base diário terceirizado calculado
 */
export const calculateDailyBaseValueTerceirizado = (entry, equipConfig, work = null) => {
    // REGRA: Se não está trabalhando, valor é zero
    if (!entry.is_worked) {
        return 0;
    }

    // REGRA PRIORITÁRIA: Se existe valor manual terceirizado válido, usa ele
    if (entry.daily_manual_value_terceirizado !== null && 
        entry.daily_manual_value_terceirizado !== undefined && 
        entry.daily_manual_value_terceirizado !== '' && 
        !isNaN(entry.daily_manual_value_terceirizado)) {
        return parseFloat(entry.daily_manual_value_terceirizado);
    }

    // CÁLCULO AUTOMÁTICO para terceirizados, chamando funções específicas
    const measurementTypeTerc = equipConfig?.measurement_type_terceirizado || 
                               equipConfig?.measurement_type;
    let dailyValue = 0;

    switch (measurementTypeTerc) {
        case 'daily':
            dailyValue = calculateDailyFixedValueTerceirizado(equipConfig);
            break;

        case 'hourly':
            dailyValue = calculateHourlyBaseValueTerceirizado(entry, equipConfig);
            break;

        case 'monthly':
            dailyValue = calculateMonthlyBaseValueTerceirizado(entry, equipConfig, work);
            break;

        case MEASUREMENT_TYPES.GUARANTEED_HOURS:
            // Para horas de garantia, o cálculo base é feito no nível do período completo.
            // Retorna 0 para o cálculo diário, pois o valor final depende do total de horas/dias no mês.
            dailyValue = 0;
            break;

        default:
            dailyValue = 0;
            break;
    }

    return dailyValue;
};

/**
 * ===================================================================
 * SEÇÃO 3: CÁLCULOS DE DESCONTOS POR PARADAS
 * ===================================================================
 * Esta seção calcula os descontos aplicados devido a paradas dedutíveis
 * do equipamento durante o dia de trabalho.
 */

/**
 * Calcula o total de horas de paradas dedutíveis em um lançamento
 *
 * REGRAS DE NEGÓCIO:
 * 1. Só conta paradas que estão na lista de deductible_stoppages do equipamento
 * 2. Se parada não tem início/fim, considera o turno inteiro
 * 3. Calcula interseção com horário de refeição para não contar duas vezes
 *
 * @param {Object} entry - Lançamento diário
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} work - Dados da obra (para horários de turno/refeição)
 * @returns {number} Total de horas de paradas dedutíveis
 */
export const calculateDeductibleStoppageHours = (entry, equipConfig, work) => {
    if (!entry.stoppages || !Array.isArray(entry.stoppages)) {
        return 0;
    }

    const deductibleStoppageTypes = equipConfig?.deductible_stoppages || [];
    let totalDiscountedStopTime = 0;

    // Configurações de turno da obra
    const dayShiftStartStr = String(work?.config?.day_shift_start || '');
    const dayShiftEndStr = String(work?.config?.day_shift_end || '');
    const dayMealStartStr = String(work?.config?.day_meal_start || '');
    const dayMealEndStr = String(work?.config?.day_meal_end || '');

    // Calcula total de horas do turno de trabalho
    const totalShiftHours = calculateTotalShiftHours(work);

    // Calcula horas de cada parada dedutível
    entry.stoppages.forEach(stoppage => {
        // Verifica se é um tipo de parada dedutível
        if (!deductibleStoppageTypes.includes(stoppage.type_id)) {
            return;
        }

        let stoppageHours = 0;

        // 🎯 PRIORIDADE 1: Campo Decimal (hours_decimal)
        if (stoppage.hours_decimal && String(stoppage.hours_decimal).trim() !== '') {
            stoppageHours = parseFloat(String(stoppage.hours_decimal).replace(',', '.'));
            console.log(`      🔢 Usando CAMPO DECIMAL: ${stoppage.hours_decimal} = ${stoppageHours.toFixed(2)}h`);
        }
        // 🎯 PRIORIDADE 2: Campo HH:MM (hours_hhmm)
        else if (stoppage.hours_hhmm && String(stoppage.hours_hhmm).trim() !== '') {
            const parts = String(stoppage.hours_hhmm).split(':');
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            stoppageHours = hours + (minutes / 60);
            console.log(`      ⏰ Usando CAMPO HH:MM: ${stoppage.hours_hhmm} = ${stoppageHours.toFixed(2)}h`);
        }
        // 🎯 PRIORIDADE 3: Horários Start/End ou turno inteiro
        else if (!stoppage.start && !stoppage.end) {
            // Parada sem horário específico = turno inteiro
            stoppageHours = totalShiftHours;
            console.log(`      📅 Usando TURNO INTEIRO: ${stoppageHours.toFixed(2)}h`);
        } else {
            // Parada com horários específicos
            const stoppageStart = stoppage.start ? new Date(`${entry.date}T${stoppage.start}`) : null;
            let stoppageEnd = stoppage.end ? new Date(`${entry.date}T${stoppage.end}`) : null;
            
            if (stoppageStart && stoppageEnd && stoppageEnd < stoppageStart) {
                stoppageEnd.setDate(stoppageEnd.getDate() + 1);
            }

            // Limites do turno
            const shiftStart = dayShiftStartStr ? new Date(`${entry.date}T${dayShiftStartStr}`) : null;
            let shiftEnd = dayShiftEndStr ? new Date(`${entry.date}T${dayShiftEndStr}`) : null;
            if (shiftStart && shiftEnd && shiftEnd < shiftStart) {
                shiftEnd.setDate(shiftEnd.getDate() + 1);
            }

            // Limites da refeição
            const mealStart = dayMealStartStr ? new Date(`${entry.date}T${dayMealStartStr}`) : null;
            let mealEnd = dayMealEndStr ? new Date(`${entry.date}T${dayMealEndStr}`) : null;
            if (mealStart && mealEnd && mealEnd < mealStart) {
                mealEnd.setDate(mealEnd.getDate() + 1);
            }

            if (stoppageStart && !stoppageEnd && shiftEnd) {
                // Parada do início até o fim do turno
                stoppageHours = calculateDeductibleHours(
                    new Date(Math.max(stoppageStart.getTime(), shiftStart?.getTime() || 0)), 
                    shiftEnd, mealStart, mealEnd
                );
            } else if (!stoppageStart && stoppageEnd && shiftStart) {
                // Parada do início do turno até o horário de fim especificado
                stoppageHours = calculateDeductibleHours(shiftStart, stoppageEnd, mealStart, mealEnd);
            } else if (stoppageStart && stoppageEnd) {
                // Parada com início e fim definidos
                stoppageHours = calculateDeductibleHours(stoppageStart, stoppageEnd, mealStart, mealEnd);
            }
        }

        totalDiscountedStopTime += stoppageHours;
    });

    return totalDiscountedStopTime;
};

/**
 * Calcula o valor de desconto por paradas dedutíveis
 *
 * @param {Object} entry - Lançamento diário
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} work - Dados da obra
 * @param {boolean} isTerceirizado - Se é cálculo para terceirizado
 * @returns {number} Valor total de desconto por paradas
 */
export const calculateStoppageDiscountValue = (entry, equipConfig, work, isTerceirizado = false) => {
    const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
    
    if (stoppageHours === 0) {
        return 0;
    }

    // Calcula valor base do dia
    const dayGrossValue = isTerceirizado ? 
        calculateDailyBaseValueTerceirizado(entry, equipConfig, work) :
        calculateDailyBaseValue(entry, equipConfig, work);

    // Calcula total de horas do turno para taxa horária
    const totalShiftHours = calculateTotalShiftHours(work);
    const hourlyRate = totalShiftHours > 0 ? dayGrossValue / totalShiftHours : 0;

    return stoppageHours * hourlyRate;
};

/**
 * ===================================================================
 * SEÇÃO 4: CÁLCULOS DE ACRÉSCIMOS E DESCONTOS (ANOTAÇÕES)
 * ===================================================================
 * Esta seção calcula valores de acréscimos e descontos baseados nas
 * anotações (notes) dos lançamentos diários.
 */

/**
 * Calcula o total de acréscimos das anotações de um lançamento
 *
 * @param {Object} entry - Lançamento diário
 * @param {string} target - Alvo do cálculo ('client', 'terceirizado', 'both')
 * @returns {number} Total de acréscimos
 */
export const calculateNotesAdditions = (entry, target = 'client') => {
    if (!entry.notes || !Array.isArray(entry.notes)) {
        return 0;
    }

    return entry.notes
        .filter(note => note.type === 'addition' && (note.target === target || note.target === 'both'))
        .reduce((total, note) => total + ((note.quantity || 0) * (note.value || 0)), 0);
};

/**
 * Calcula o total de descontos das anotações de um lançamento
 *
 * @param {Object} entry - Lançamento diário
 * @param {string} target - Alvo do cálculo ('client', 'terceirizado', 'both')
 * @returns {number} Total de descontos
 */
export const calculateNotesDiscounts = (entry, target = 'client') => {
    if (!entry.notes || !Array.isArray(entry.notes)) {
        return 0;
    }

    return entry.notes
        .filter(note => note.type === 'discount' && (note.target === target || note.target === 'both'))
        .reduce((total, note) => total + ((note.quantity || 0) * (note.value || 0)), 0);
};

/**
 * ===================================================================
 * SEÇÃO 5: CÁLCULOS DE MOBILIZAÇÃO E DESMOBILIZAÇÃO
 * ===================================================================
 * Esta seção calcula os custos de mobilização e desmobilização
 * de equipamentos na obra.
 */

/**
 * Calcula o custo de mobilização de um equipamento em um período
 *
 * @param {Array} entries - Lista de lançamentos do equipamento
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {boolean} isTerceirizado - Se é cálculo para terceirizado
 * @returns {number} Custo total de mobilização
 */
export const calculateMobilizationCost = (entries, equipConfig, isTerceirizado = false) => {
    if (!Array.isArray(entries)) {
        return 0;
    }

    let totalMobilizationCost = 0;
    const costField = isTerceirizado ? 
        'mobilization_cost_terceirizado' : 
        'mobilization_cost';

    entries.forEach(entry => {
        if (entry.is_mobilization) {
            // Se a mobilização não deve ser contabilizada, o custo é zero para este lançamento
            if (entry.is_mobilization_contabilized === 0) {
                return;
            }
            
            // Se um valor manual for fornecido, usa-o. Caso contrário, usa o valor da configuração.
            const mobilizationValue = entry.mobilization_manual_value !== null && !isNaN(entry.mobilization_manual_value)
                ? parseFloat(entry.mobilization_manual_value)
                : parseFloat(equipConfig?.[costField] || 0);
            
            totalMobilizationCost += mobilizationValue;
        }
    });

    return totalMobilizationCost;
};

/**
 * Calcula o custo de desmobilização de um equipamento em um período
 *
 * @param {Array} entries - Lista de lançamentos do equipamento
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {boolean} isTerceirizado - Se é cálculo para terceirizado
 * @returns {number} Custo total de desmobilização
 */
export const calculateDemobilizationCost = (entries, equipConfig, isTerceirizado = false) => {
    if (!Array.isArray(entries)) {
        return 0;
    }

    let totalDemobilizationCost = 0;
    const costField = isTerceirizado ? 
        'demobilization_cost_terceirizado' : 
        'demobilization_cost';

    entries.forEach(entry => {
        if (entry.is_demobilized) {
            // Se a desmobilização não deve ser contabilizada, o custo é zero para este lançamento
            if (entry.is_demobilization_contabilized === 0) {
                return;
            }

            // Se um valor manual for fornecido, usa-o. Caso contrário, usa o valor da configuração.
            const demobilizationValue = entry.demobilization_manual_value !== null && !isNaN(entry.demobilization_manual_value)
                ? parseFloat(entry.demobilization_manual_value)
                : parseFloat(equipConfig?.[costField] || 0);
            
            totalDemobilizationCost += demobilizationValue;
        }
        
    });

    return totalDemobilizationCost;
};

/**
 * ===================================================================
 * SEÇÃO 6: CÁLCULOS DE DESPESAS GERAIS
 * ===================================================================
 * Esta seção processa despesas gerais que impactam a medição.
 */

/**
 * Calcula o impacto de despesas gerais na medição
 * 🔥 CORREÇÃO: Usar impacto_cliente_total ao invés de campos inexistentes
 *
 * @param {Array} expenses - Lista de despesas gerais
 * @param {string} impactType - Tipo de impacto ('add_client', 'disc_client', etc.)
 * @returns {number} Valor total do impacto
 */
export const calculateGeneralExpensesImpact = (expenses, impactType) => {
    if (!Array.isArray(expenses)) {
        return 0;
    }

    return expenses
        .filter(expense => expense.measurement_impact === impactType)
        .reduce((total, expense) => {
            // ✅ CORRETO: Usar o campo impacto_cliente_total que realmente existe
            const expenseTotal = parseFloat(expense.impacto_cliente_total) || 0;
            return total + expenseTotal;
        }, 0);
};

/**
 * ===================================================================
 * SEÇÃO 7: CÁLCULOS AUXILIARES E UTILITÁRIOS
 * ===================================================================
 * Esta seção contém funções auxiliares para apoiar os cálculos principais.
 */

/**
 * Calcula o total de horas do turno de trabalho
 *
 * @param {Object} work - Dados da obra
 * @returns {number} Total de horas do turno
 */
export const calculateTotalShiftHours = (work) => {
    if (work?.config?.workday_hours && parseFloat(work.config.workday_hours) > 0) {
        return parseFloat(work.config.workday_hours);
    }

    const dayShiftStartStr = String(work?.config?.day_shift_start || '');
    const dayShiftEndStr = String(work?.config?.day_shift_end || '');
    const dayMealStartStr = String(work?.config?.day_meal_start || '');
    const dayMealEndStr = String(work?.config?.day_meal_end || '');

    if (dayShiftStartStr && dayShiftEndStr) {
        const tempDate = '2000-01-01';
        const shiftStartObj = new Date(`${tempDate}T${dayShiftStartStr}`);
        let shiftEndObj = new Date(`${tempDate}T${dayShiftEndStr}`);
        
        if (shiftEndObj < shiftStartObj) {
            shiftEndObj.setDate(shiftEndObj.getDate() + 1);
        }
        
        let duration = (shiftEndObj.getTime() - shiftStartObj.getTime()) / 3600000;
        
        // Subtrai horário de refeição se houver
        if (dayMealStartStr && dayMealEndStr) {
            const mealStartObj = new Date(`${tempDate}T${dayMealStartStr}`);
            let mealEndObj = new Date(`${tempDate}T${dayMealEndStr}`);
            
            if (mealEndObj < mealStartObj) {
                mealEndObj.setDate(mealEndObj.getDate() + 1);
            }
            
            const intersectionStart = Math.max(shiftStartObj.getTime(), mealStartObj.getTime());
            const intersectionEnd = Math.min(shiftEndObj.getTime(), mealEndObj.getTime());
            const intersectionDuration = Math.max(0, intersectionEnd - intersectionStart);
            duration -= intersectionDuration / 3600000;
        }
        
        return Math.max(0, duration);
    }

    return 8; // Padrão: 8 horas
};

/**
 * ===================================================================
 * SEÇÃO 8: CÁLCULOS COMPLETOS DE EQUIPAMENTO
 * ===================================================================
 * Esta seção contém funções que calculam o valor total de um equipamento
 * combinando todos os componentes (base, acréscimos, descontos, etc.).
 */

/**
 * Calcula o valor total de um equipamento em um período (contrato principal)
 * CORREÇÃO: Adicionado suporte para substituição de equipamentos e avarias
 *
 * @param {Array} entries - Lançamentos do equipamento no período
 * @param {Array} expenses - Despesas gerais relacionadas ao equipamento
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} work - Dados da obra
 * @param {Array} damages - Avarias relacionadas ao equipamento (NOVO)
 * @param {Object|null} substitutionDetails - Detalhes da substituição se este for um equipamento substituto.
 * @returns {Object} Objeto com breakdown completo dos valores
 */
export const calculateEquipmentTotalValue = (entries, expenses, equipConfig, work, damages = [], substitutionDetails = null, startDate = null, endDate = null, periodConfig = null) => {
    console.log(`🔧 INICIANDO CÁLCULO PARA EQUIPAMENTO`);
    console.log(`   Tipo de medição: ${equipConfig?.measurement_type}`);
    console.log(`   É substituição:`, !!substitutionDetails);
    if (substitutionDetails) {
        console.log(`   Detalhes da substituição:`, substitutionDetails);
    }
    console.log(`   Total de avarias passadas: ${damages.length}`);


    let totalBaseValue = 0;
    let totalStoppageDiscounts = 0;
    let totalNotesAdditions = 0;
    let totalNotesDiscounts = 0;
    let mobilizationCost = 0;
    let demobilizationCost = 0;
    let expensesAdditions = 0;
    let expensesDiscounts = 0;
    let damagesAdditions = 0; // NOVO
    let damagesDiscounts = 0; // NOVO
    let workedDays = 0; // Contagem de dias marcados como trabalhados

    // Processa mobilização/desmobilização e anotações/despesas, pois são geralmente por lançamento ou por período
    // Os custos de mobilização/desmobilização são calculados uma vez para todo o período
    mobilizationCost = calculateMobilizationCost(entries, equipConfig, false);
    demobilizationCost = calculateDemobilizationCost(entries, equipConfig, false);

    entries.forEach(entry => {
        // Acréscimos e descontos das anotações
        totalNotesAdditions += calculateNotesAdditions(entry, 'client');
        totalNotesDiscounts += calculateNotesDiscounts(entry, 'client');

        // Conta os dias trabalhados
        if (entry.is_worked) {
            workedDays++;
        }
    });

    // Processa despesas gerais (ligadas ao equipamento, mas não por lançamento diário)
    expensesAdditions += calculateGeneralExpensesImpact(expenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
    expensesDiscounts += calculateGeneralExpensesImpact(expenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);

    // NOVO: Processa avarias
    damages.forEach(damage => {
        const damageValue = parseFloat(damage.total_value) || 0;
        if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT) {
            damagesAdditions += damageValue;
        } else if (damage.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT) {
            damagesDiscounts += damageValue;
        }
    });


    // Agora, lida com o cálculo do valor base principal com base no tipo de medição
    if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        // CORREÇÃO PRINCIPAL: Para o tipo 'horas de garantia', o cálculo é feito em nível de período.
        console.log(`🔄 CALCULANDO HORAS DE GARANTIA com substituição:`, !!substitutionDetails);
        
        // 🔥 CALCULAR PERÍODO TOTAL DO RELATÓRIO (startDate até endDate)
        let measurementPeriodDays = null;
        
        if (startDate && endDate) {
            // USAR AS DATAS DO RELATÓRIO para calcular o período CORRETO!
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');
            const diffTime = Math.abs(end - start);
            measurementPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            console.log(`   📅 PERÍODO DO RELATÓRIO: ${measurementPeriodDays} dias (de ${startDate} a ${endDate})`);
        } else if (entries.length > 0) {
            // Fallback: usar datas dos entries
            const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstDate = new Date(sortedEntries[0].date);
            const lastDate = new Date(sortedEntries[sortedEntries.length - 1].date);
            const diffTime = Math.abs(lastDate - firstDate);
            measurementPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            console.log(`   ⚠️ FALLBACK - Período calculado pelos entries: ${measurementPeriodDays} dias`);
        }
        
        // 🎯 DETERMINAR TIPO DE CÁLCULO MENSAL
        // Prioridade: manual > override > config padrão > 'proportional'
        let monthlyCalculationType = 'proportional'; // Padrão
        
        // Verificar se existe manual definido em algum entry
        const entryWithManual = entries.find(e => e.monthly_calculation_manual);
        if (entryWithManual?.monthly_calculation_manual) {
            monthlyCalculationType = entryWithManual.monthly_calculation_manual;
            console.log(`   📐 Tipo cálculo MANUAL detectado: ${monthlyCalculationType}`);
        } else if (entries[0]?.monthly_calculation_override) {
            monthlyCalculationType = entries[0].monthly_calculation_override;
            console.log(`   📐 Tipo cálculo OVERRIDE: ${monthlyCalculationType}`);
        } else if (equipConfig?.monthly_calculation) {
            monthlyCalculationType = equipConfig.monthly_calculation;
            console.log(`   📐 Tipo cálculo CONFIG: ${monthlyCalculationType}`);
        } else {
            console.log(`   📐 Tipo cálculo PADRÃO: ${monthlyCalculationType}`);
        }
        
        const {
            baseValue: calculatedGuaranteedBaseValue,
            stoppageDiscount: calculatedGuaranteedStoppageDiscount,
            daysStoppedDiscount: calculatedGuaranteedDaysStoppedDiscount
        } = calculateGuaranteedHoursLogic(entries, equipConfig, work, substitutionDetails, measurementPeriodDays, monthlyCalculationType, periodConfig);

        totalBaseValue = calculatedGuaranteedBaseValue;
        // Soma todos os descontos específicos da lógica de horas de garantia
        totalStoppageDiscounts = calculatedGuaranteedStoppageDiscount + calculatedGuaranteedDaysStoppedDiscount; 

        console.log(`✅ RESULTADO HORAS DE GARANTIA:`);
        console.log(`   Valor base: R$ ${totalBaseValue.toFixed(2)}`);
        console.log(`   Descontos: R$ ${totalStoppageDiscounts.toFixed(2)}`);

    } else {
        // CORREÇÃO: Para equipamentos mensais, usar novo cálculo preciso
        if (equipConfig?.measurement_type === 'monthly') {
            totalBaseValue = calculateMonthlyTotalValue(entries, equipConfig, work);
        } else {
            // Para outros tipos (diário, horário), soma os valores base diários
            entries.forEach(entry => {
                if (entry.is_worked) {
                    totalBaseValue += calculateDailyBaseValue(entry, equipConfig, work);
                }
            });
        }
        
        // Para todos os tipos, os descontos de parada são calculados por lançamento
        entries.forEach(entry => {
            totalStoppageDiscounts += calculateStoppageDiscountValue(entry, equipConfig, work, false);
        });
        
        console.log(`✅ RESULTADO CÁLCULO TRADICIONAL:`);
        console.log(`   Valor base: R$ ${totalBaseValue.toFixed(2)}`);
        console.log(`   Descontos: R$ ${totalStoppageDiscounts.toFixed(2)}`);
    }

    // Cálculo final do valor total
    const totalValue = totalBaseValue + mobilizationCost + demobilizationCost + 
                      totalNotesAdditions + expensesAdditions + damagesAdditions - 
                      totalStoppageDiscounts - totalNotesDiscounts - expensesDiscounts - damagesDiscounts;

    console.log(`🎯 VALOR FINAL CALCULADO: R$ ${totalValue.toFixed(2)}`);

    return {
        baseValue: totalBaseValue, // Este será o resultado do cálculo específico do tipo de medição
        stoppageDiscounts: totalStoppageDiscounts,
        notesAdditions: totalNotesAdditions,
        notesDiscounts: totalNotesDiscounts,
        mobilizationCost,
        demobilizationCost,
        expensesAdditions,
        expensesDiscounts,
        damagesAdditions, // NOVO
        damagesDiscounts, // NOVO
        totalValue,
        workedDays // Ainda útil para relatórios
    };
};

/**
 * Calcula o valor total de um equipamento terceirizado em um período
 *
 * @param {Array} entries - Lançamentos do equipamento no período
 * @param {Array} expenses - Despesas gerais relacionadas ao equipamento
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} work - Dados da obra
 * @param {Array} damages - Avarias relacionadas ao equipamento (NOVO)
 * @returns {Object} Objeto com breakdown completo dos valores terceirizados
 */
export const calculateEquipmentTotalValueTerceirizado = (entries, expenses, equipConfig, work, damages = []) => {
    let totalBaseValue = 0;
    let totalStoppageDiscounts = 0;
    let totalNotesAdditions = 0;
    let totalNotesDiscounts = 0;
    let mobilizationCost = 0;
    let demobilizationCost = 0;
    let expensesAdditions = 0;
    let expensesDiscounts = 0;
    let damagesAdditions = 0; // NOVO
    let damagesDiscounts = 0; // NOVO
    let workedDays = 0;

    // Os custos de mobilização/desmobilização são calculados uma vez para todo o período
    mobilizationCost = calculateMobilizationCost(entries, equipConfig, true);
    demobilizationCost = calculateDemobilizationCost(entries, equipConfig, true);

    // Processa lançamentos diários
    entries.forEach(entry => {
        if (entry.is_worked) {
            workedDays++;
            totalBaseValue += calculateDailyBaseValueTerceirizado(entry, equipConfig, work);
        }

        // Descontos por paradas (usando valores terceirizados)
        totalStoppageDiscounts += calculateStoppageDiscountValue(entry, equipConfig, work, true);

        // Acréscimos e descontos das anotações para terceirizados
        totalNotesAdditions += calculateNotesAdditions(entry, 'terceirizado');
        totalNotesDiscounts += calculateNotesDiscounts(entry, 'terceirizado');
    });

    // Processa despesas gerais para terceirizados
    expensesAdditions += calculateGeneralExpensesImpact(expenses, EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO);
    expensesDiscounts += calculateGeneralExpensesImpact(expenses, EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO);

    // NOVO: Processa avarias para terceirizados
    damages.forEach(damage => {
        const damageValue = parseFloat(damage.total_value) || 0;
        if (damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.ADD_TERCEIRIZADO) {
            damagesAdditions += damageValue;
        } else if (damage.terceirizado_impact_type === EXPENSE_IMPACT_TYPES.DISC_TERCEIRIZADO) {
            damagesDiscounts += damageValue;
        }
    });


    // Cálculo final
    const totalValue = totalBaseValue + mobilizationCost + demobilizationCost + 
                      totalNotesAdditions + expensesAdditions + damagesAdditions - 
                      totalStoppageDiscounts - totalNotesDiscounts - expensesDiscounts - damagesDiscounts;

    return {
        baseValue: totalBaseValue,
        stoppageDiscounts: totalStoppageDiscounts,
        notesAdditions: totalNotesAdditions,
        notesDiscounts: totalNotesDiscounts,
        mobilizationCost,
        demobilizationCost,
        expensesAdditions,
        expensesDiscounts,
        damagesAdditions, // NOVO
        damagesDiscounts, // NOVO
        totalValue,
        workedDays
    };
};

/**
 * ===================================================================
 * SEÇÃO 9: FUNÇÕES DE CONVENIÊNCIA E COMPATIBILIDADE
 * ===================================================================
 * Esta seção contém funções que mantêm compatibilidade com o código
 * existente e facilitam o uso dos cálculos.
 */

/**
 * Recalcula e atualiza o valor total de um cartão de lançamento
 * (Função de compatibilidade para o módulo de lançamentos)
 *
 * @param {HTMLElement} card - Elemento DOM do cartão
 * @param {Object} work - Dados da obra
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} equipment - Dados do equipamento
 * @returns {Object} Valores calculados para o cartão
 */
export const recalculateCardValues = (card, work, equipConfig, equipment) => {
    if (!card || !work || !equipConfig) {
        return { clientValue: 0, terceirizadoValue: 0 };
    }

    // Extrai dados do cartão
    const isWorked = card.querySelector('.is-worked-check')?.checked || false;
    const horometerStart = parseFloat(card.querySelector('.horometer-start')?.value) || 0;
    const horometerEnd = parseFloat(card.querySelector('.horometer-end')?.value) || 0;
    const manualValue = card.querySelector('.daily-manual-value-header')?.value;
    const manualValueTerc = card.querySelector('.daily-manual-value-terceirizado-header')?.value;
    const dateStr = card.dataset.date;

    // NOVOS CAMPOS: Mobilização/Desmobilização
    const isMobilizationContabilized = card.querySelector('.is-mobilization-contabilized')?.value === '1' ? 1 : 0;
    const mobilizationManualValue = parseFloat(card.querySelector('.mobilization-manual-value')?.value) || null;
    const isDemobilizationContabilized = card.querySelector('.is-demobilization-contabilized')?.value === '1' ? 1 : 0;
    const demobilizationManualValue = parseFloat(card.querySelector('.demobilization-manual-value')?.value) || null;


    // Cria entry fictício para cálculos
    const entry = {
        date: dateStr,
        is_worked: isWorked,
        horometer_start: horometerStart,
        horometer_end: horometerEnd,
        daily_manual_value: manualValue && manualValue !== '' ? parseFloat(manualValue) : null,
        daily_manual_value_terceirizado: manualValueTerc && manualValueTerc !== '' ? parseFloat(manualValueTerc) : null,
        monthly_calculation_override: card.querySelector('.monthly-calculation-select')?.value || null,
        monthly_calculation_override_terceirizado: card.querySelector('.monthly-calculation-terceirizado-select')?.value || null,
        stoppages: [],
        notes: [],
        is_mobilization: card.querySelector('.mobilize-check')?.checked || false,
        is_mobilization_contabilized: isMobilizationContabilized, // NOVO
        mobilization_manual_value: mobilizationManualValue,       // NOVO
        is_demobilized: card.querySelector('.demobilize-check')?.checked || false,
        is_demobilization_contabilized: isDemobilizationContabilized, // NOVO
        demobilization_manual_value: demobilizationManualValue,       // NOVO
    };

    // Extrai paradas
    card.querySelectorAll('.stoppages-container .form-grid').forEach(row => {
        const typeId = row.querySelector('.stoppage-type')?.value;
        if (typeId) {
            entry.stoppages.push({
                type_id: typeId,
                start: row.querySelector('.stoppage-start')?.value || null,
                end: row.querySelector('.stoppage-end')?.value || null
            });
        }
    });

    // Extrai anotações
    card.querySelectorAll('.notes-container .form-grid').forEach(row => {
        const description = row.querySelector('.note-description')?.value;
        if (description) {
            entry.notes.push({
                type: row.querySelector('.note-type')?.value,
                description: description,
                quantity: parseFloat(row.querySelector('.note-quantity')?.value) || 0,
                value: parseFloat(row.querySelector('.note-value')?.value) || 0,
                target: row.querySelector('.note-target')?.value || 'both'
            });
        }
    });

    // Calcula valores
    let calculatedValueClient = 0;
    let calculatedValueTerceirizado = 0;

    // A lógica de "horas de garantia" não é calculada por dia no cartão
    // O valor diário será 0 para este tipo de medição, a menos que haja valor manual
    if (equipConfig?.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        if (entry.daily_manual_value !== null && entry.daily_manual_value !== undefined) {
            calculatedValueClient = parseFloat(entry.daily_manual_value);
        } else {
            calculatedValueClient = 0; // O cálculo real é feito em calculateEquipmentTotalValue
        }
        if (equipment?.is_terceirizado && entry.daily_manual_value_terceirizado !== null && entry.daily_manual_value_terceirizado !== undefined) {
            calculatedValueTerceirizado = parseFloat(entry.daily_manual_value_terceirizado);
        } else if (equipment?.is_terceirizado) {
            calculatedValueTerceirizado = 0; // O cálculo real é feito em calculateEquipmentTotalValueTerceirizado
        }
    } else {
        // Para outros tipos de medição, calcula o valor diário normal
        if (isWorked) {
            calculatedValueClient = calculateDailyBaseValue(entry, equipConfig, work);
            
            if (equipment?.is_terceirizado) {
                calculatedValueTerceirizado = calculateDailyBaseValueTerceirizado(entry, equipConfig, work);
            }
        }
    }

    // Aplicar descontos por paradas (calculados por dia, mesmo para garantias)
    const stoppageDiscountClient = calculateStoppageDiscountValue(entry, equipConfig, work, false);
    const stoppageDiscountTerc = equipment?.is_terceirizado ? 
        calculateStoppageDiscountValue(entry, equipConfig, work, true) : 0;

    // Aplicar acréscimos e descontos das anotações
    const notesAdditionsClient = calculateNotesAdditions(entry, 'client');
    const notesDiscountsClient = calculateNotesDiscounts(entry, 'client');
    const notesAdditionsTerc = calculateNotesAdditions(entry, 'terceirizado');
    const notesDiscountsTerc = calculateNotesDiscounts(entry, 'terceirizado');

    // Mobilização e Desmobilização (considerando as novas regras)
    const mobilizationCostClient = calculateMobilizationCost([entry], equipConfig, false);
    const demobilizationCostClient = calculateDemobilizationCost([entry], equipConfig, false);
    const mobilizationCostTerc = equipment?.is_terceirizado ? calculateMobilizationCost([entry], equipConfig, true) : 0;
    const demobilizationCostTerc = equipment?.is_terceirizado ? calculateDemobilizationCost([entry], equipConfig, true) : 0;


    // Valores finais
    // Para horas de garantia, o valor diário exibido será o manual ou 0.
    // Os descontos de parada e anotações ainda se aplicam ao valor diário se houver.
    const finalValueClient = calculatedValueClient + notesAdditionsClient + mobilizationCostClient + demobilizationCostClient - stoppageDiscountClient - notesDiscountsClient;
    const finalValueTerceirizado = calculatedValueTerceirizado + notesAdditionsTerc + mobilizationCostTerc + demobilizationCostTerc - stoppageDiscountTerc - notesDiscountsTerc;

    return {
        clientValue: Math.max(0, finalValueClient),
        terceirizadoValue: Math.max(0, finalValueTerceirizado),
        baseValueClient: calculatedValueClient,
        baseValueTerceirizado: calculatedValueTerceirizado,
        stoppageDiscountClient,
        stoppageDiscountTerc,
        notesAdditionsClient,
        notesDiscountsClient,
        notesAdditionsTerc,
        notesDiscountsTerc,
        mobilizationCostClient, // Adicionado para retorno
        demobilizationCostClient, // Adicionado para retorno
        mobilizationCostTerc, // Adicionado para retorno
        demobilizationCostTerc // Adicionado para retorno
    };
};

/**
 * ===================================================================
 * SEÇÃO 10: CÁLCULOS ESPECÍFICOS PARA RELATÓRIOS
 * ===================================================================
 * Esta seção contém funções especializadas para geração de relatórios
 * que combinam múltiplos equipamentos e períodos.
 */

/**
 * Calcula valor total de uma BM (Boletim de Medição) completa
 *
 * @param {string} workId - ID da obra
 * @param {Object} bmPeriod - Período da BM {start, end}
 * @param {Object} work - Dados da obra
 * @param {Array} entries - Lançamentos do período (opcional, será buscado se não fornecido)
 * @param {Array} generalExpenses - Despesas gerais do período (opcional)
 * @param {Array} damages - Avarias do período (NOVO: opcional)
 * @returns {Promise<number>} Valor total da BM
 */
export const calculateBmTotalValue = async (workId, bmPeriod, work, entries = null, generalExpenses = null, damages = null) => {
    try {
        // Busca lançamentos se não fornecidos
        if (!entries) {
            const { apiClient } = await import('./api.js');
            entries = await apiClient.fetchDailyEntries(workId, null, bmPeriod.start, bmPeriod.end);
        }

        // Busca despesas gerais se não fornecidas
       if (!generalExpenses) {
            const { apiClient } = await import('./api.js');
            generalExpenses = await apiClient.fetchData(
                'general_expenses',
                '*, equipment(*)',
                'date',
                true
            ).then(data => data.filter(entry =>
                entry.work_id == workId && 
                entry.date >= bmPeriod.start && 
                entry.date <= bmPeriod.end
            ));
        }

        // Busca avarias se não fornecidas (NOVO)
        if (!damages) {
            const { apiClient } = await import('./api.js');
            damages = await apiClient.fetchDamages(workId, bmPeriod.start, bmPeriod.end);
        }

        let totalBmValue = 0;
        
        // Agrupa lançamentos por equipamento
        const entriesByEquipment = entries.reduce((acc, entry) => {
            (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
            return acc;
        }, {});

        // Agrupa despesas por equipamento
        const expensesByEquipment = generalExpenses.reduce((acc, expense) => {
            if (expense.equipment_id) {
                (acc[expense.equipment_id] = acc[expense.equipment_id] || []).push(expense);
            }
            return acc;
        }, {});

        // Função para validar avaria para medição (MESMA LÓGICA DO RELATÓRIO)
        const validateDamageForMeasurement = (damage) => {
            if (!damage || !damage.id) {
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

        // Agrupa avarias por equipamento (NOVO) - APLICA VALIDAÇÃO
        const damagesByEquipment = damages.reduce((acc, damage) => {
            if (damage.equipment_id && validateDamageForMeasurement(damage)) {
                (acc[damage.equipment_id] = acc[damage.equipment_id] || []).push(damage);
            }
            return acc;
        }, {});

        // NOVO: Não precisamos de substituições para terceirizados, a menos que a regra mude.
        // Se a regra de substituição se aplicar a terceirizados, adicionar aqui.

        // Calcula valor por equipamento
        for (const equipmentId of Object.keys(entriesByEquipment)) {
            const equipmentEntries = entriesByEquipment[equipmentId];
            const equipmentExpenses = expensesByEquipment[equipmentId] || [];
            const equipmentDamages = damagesByEquipment[equipmentId] || []; // NOVO: Pega avarias do equipamento
            const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);

            if (!equipConfig) continue;

            // Pega os detalhes da substituição se este equipamento for um substituto
            const { apiClient } = await import('./api.js'); // Garante que a API está importada
            const substitutionsInPeriod = await apiClient.fetchEquipmentSubstitutions(workId, bmPeriod.start, bmPeriod.end);
            const substitutionDetails = substitutionsInPeriod.find(sub => 
                sub.substituting_equipment_id == parseInt(equipmentId) && 
                sub.substitution_date >= bmPeriod.start && 
                sub.substitution_date <= bmPeriod.end
            );

            const equipmentTotal = calculateEquipmentTotalValue(
                equipmentEntries, 
                equipmentExpenses, 
                equipConfig, 
                work,
                equipmentDamages, // NOVO: Passa as avarias do equipamento
                substitutionDetails, // Passa os detalhes da substituição
                bmPeriod.start, // CORREÇÃO: Passa startDate
                bmPeriod.end // CORREÇÃO: Passa endDate
            );

            totalBmValue += equipmentTotal.totalValue;
        }

        // Adiciona despesas gerais sem equipamento específico
        const generalWorkExpenses = generalExpenses.filter(expense => !expense.equipment_id);
        const generalAdditions = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.ADD_CLIENT);
        const generalDiscounts = calculateGeneralExpensesImpact(generalWorkExpenses, EXPENSE_IMPACT_TYPES.DISC_CLIENT);
        
        totalBmValue += generalAdditions - generalDiscounts;

        // Adiciona impacto das avarias gerais (sem equipamento específico) (NOVO) - COM VALIDAÇÃO
        const generalWorkDamages = damages.filter(damage => !damage.equipment_id && validateDamageForMeasurement(damage));
        const generalDamageAdditions = generalWorkDamages.filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.ADD_CLIENT)
                                                          .reduce((sum, d) => sum + (d.total_value || 0), 0);
        const generalDamageDiscounts = generalWorkDamages.filter(d => d.client_impact_type === EXPENSE_IMPACT_TYPES.DISC_CLIENT)
                                                          .reduce((sum, d) => sum + (d.total_value || 0), 0);
        
        totalBmValue += generalDamageAdditions - generalDamageDiscounts;


        return totalBmValue;

    } catch (error) {
        console.error("Erro ao calcular valor da BM:", error);
        return 0;
    }
};

/**
 * Calcula resumo de valores por empresa terceirizada
 *
 * @param {Array} entries - Lançamentos do período
 * @param {Array} expenses - Despesas gerais do período
 * @param {Object} work - Dados da obra
 * @param {Array} damages - Avarias do período (NOVO)
 * @param {Array} selectedThirdParties - IDs das empresas terceirizadas selecionadas
 * @returns {Object} Resumo por empresa terceirizada
 */
export const calculateThirdPartyCompanyTotals = (entries, expenses, work, damages = [], selectedThirdParties = []) => {
    const totals = {};

    // Agrupa lançamentos por equipamento
    const entriesByEquipment = entries.reduce((acc, entry) => {
        (acc[entry.equipment_id] = acc[entry.equipment_id] || []).push(entry);
        return acc;
    }, {});

    // Agrupa despesas por equipamento
    const expensesByEquipment = expenses.reduce((acc, expense) => {
        if (expense.equipment_id) {
            (acc[expense.equipment_id] = acc[expense.equipment_id] || []).push(expense);
        }
        return acc;
    }, {});

    // Agrupa avarias por equipamento (NOVO)
    const damagesByEquipment = damages.reduce((acc, damage) => {
        if (damage.equipment_id) {
            (acc[damage.equipment_id] = acc[damage.equipment_id] || []).push(damage);
        }
        return acc;
    }, {});


    // NOVO: Não precisamos de substituições para terceirizados, a menos que a regra mude.
    // Se a regra de substituição se aplicar a terceirizados, adicionar aqui.

    // Processa cada equipamento terceirizado
    for (const equipmentId of Object.keys(entriesByEquipment)) {
        const equipment = appState.equipment.find(e => e.id == equipmentId);
        
        if (!equipment?.is_terceirizado) continue;
        
        // Aplica filtro de empresa se especificado
        if (selectedThirdParties.length > 0 && 
            !selectedThirdParties.includes(equipment.terceirizado_id.toString())) {
            continue;
        }

        const equipmentEntries = entriesByEquipment[equipmentId];
        const equipmentExpenses = expensesByEquipment[equipmentId] || [];
        const equipmentDamages = damagesByEquipment[equipmentId] || []; // NOVO: Pega avarias do equipamento
        const equipConfig = work?.config?.equipment?.find(ec => ec.equipment_id == equipmentId);

        if (!equipConfig) continue;

        const companyId = equipment.terceirizado_id;
        const companyName = appState.terceirizados.find(t => t.id == companyId)?.name || 'N/A';

        if (!totals[companyId]) {
            totals[companyId] = {
                companyName,
                totalValue: 0,
                equipmentCount: 0,
                equipments: []
            };
        }

        const equipmentTotal = calculateEquipmentTotalValueTerceirizado(
            equipmentEntries, 
            equipmentExpenses, 
            equipConfig, 
            work,
            equipmentDamages // NOVO: Passa as avarias do equipamento
        );

        totals[companyId].totalValue += equipmentTotal.totalValue;
        totals[companyId].equipmentCount++;
        totals[companyId].equipments.push({
            equipmentId,
            equipmentName: `${equipment.prefix} - ${getEquipTypeName(equipment.type)}`,
            ...equipmentTotal
        });
    }

    return totals;
};


const calculateDetailFooterTotalTerceirizado = (equipmentEntries, equipConfig, work, mobilizationCost = 0, demobilizationCost = 0) => {
    console.log('[FOOTER TERCEIRIZADO] === CALCULANDO TOTAL DO RODAPÉ ===');
    
    let totalDailyValues = 0;
    
    // Para equipamentos mensais terceirizados, usar cálculo proporcional preciso
    const measurementTypeTerc = equipConfig?.measurement_type_terceirizado || equipConfig?.measurement_type;
    
    if ((measurementTypeTerc === 'monthly' || equipConfig?.measurement_type === 'monthly')) {
        const monthlyValueTerceirizado = parseFloat(equipConfig?.measurement_value_terceirizado || equipConfig?.measurement_value || 0);
        const workedEntries = equipmentEntries.filter(entry => entry.is_worked);
        
        if (workedEntries.length > 0 && monthlyValueTerceirizado > 0) {
            // Determinar tipo de cálculo (igual ao relatório principal)
            let calculationType = equipConfig?.monthly_calculation_terceirizado || equipConfig?.monthly_calculation || 'proportional';
            
            // Verificar override do primeiro entry trabalhado
            const firstWorkedEntry = workedEntries[0];
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
            
            // CÁLCULO EXATO: Valor mensal × dias trabalhados ÷ dias do mês
            const exactDailyValue = monthlyValueTerceirizado / daysInMonth;
            const baseTotal = exactDailyValue * workedEntries.length;
            
            console.log(`[FOOTER TERCEIRIZADO] Valor mensal: R$ ${monthlyValueTerceirizado}`);
            console.log(`[FOOTER TERCEIRIZADO] Dias trabalhados: ${workedEntries.length}`);
            console.log(`[FOOTER TERCEIRIZADO] Dias no mês: ${daysInMonth}`);
            console.log(`[FOOTER TERCEIRIZADO] Valor diário exato: R$ ${exactDailyValue.toFixed(6)}`);
            console.log(`[FOOTER TERCEIRIZADO] Base total: R$ ${baseTotal.toFixed(6)}`);
            
            // Somar ajustes de todas as entradas
            let totalAdjustments = 0;
            equipmentEntries.forEach(entry => {
                // Notas
                (entry.notes || []).forEach(note => {
                    const noteValue = (note.quantity || 0) * (note.value || 0);
                    if (note.type === 'addition' && (note.target === 'terceirizado' || note.target === 'both')) {
                        totalAdjustments += noteValue;
                    } else if (note.type === 'discount' && (note.target === 'terceirizado' || note.target === 'both')) {
                        totalAdjustments -= noteValue;
                    }
                });
                
                // Paradas
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
            
            totalDailyValues = baseTotal + totalAdjustments;
            console.log(`[FOOTER TERCEIRIZADO] Total com ajustes: R$ ${totalDailyValues.toFixed(6)}`);
        }
    } else {
        // Para outros tipos, somar individualmente usando a lógica do relatório
        equipmentEntries.forEach(entry => {
            const dailyValue = calculateCompleteDailyValueForReportTerceirizado(entry, equipConfig, work);
            totalDailyValues += dailyValue;
            console.log(`[FOOTER TERCEIRIZADO] ${entry.date}: R$ ${dailyValue.toFixed(2)}`);
        });
    }
    
    console.log(`[FOOTER TERCEIRIZADO] Total dos dias: R$ ${totalDailyValues.toFixed(2)}`);
    console.log(`[FOOTER TERCEIRIZADO] Mobilização: R$ ${(mobilizationCost || 0).toFixed(2)}`);
    console.log(`[FOOTER TERCEIRIZADO] Desmobilização: R$ ${(demobilizationCost || 0).toFixed(2)}`);
    
    const finalTotal = Math.round((totalDailyValues + mobilizationCost + demobilizationCost + Number.EPSILON) * 100) / 100;
    console.log(`[FOOTER TERCEIRIZADO] TOTAL FINAL: R$ ${finalTotal}`);
    console.log('[FOOTER TERCEIRIZADO] =====================================');
    
    return finalTotal;
};

const calculateCompleteDailyValueForReportTerceirizado = (entry, equipConfig, work) => {
    let baseValue = 0;
    
    if (entry.is_worked) {
        const measurementValueTerceirizado = parseFloat(equipConfig?.measurement_value_terceirizado || 0);
        const measurementTypeTerc = equipConfig?.measurement_type_terceirizado || equipConfig?.measurement_type;
        
        if ((measurementTypeTerc === 'monthly' || equipConfig?.measurement_type === 'monthly') && measurementValueTerceirizado > 0) {
            let calculationType = equipConfig?.monthly_calculation_terceirizado || equipConfig?.monthly_calculation || 'proportional';
            
            if (entry.monthly_calculation_manual_terceirizado) {
                calculationType = entry.monthly_calculation_manual_terceirizado;
            } else if (entry.monthly_calculation_override_terceirizado) {
                calculationType = entry.monthly_calculation_override_terceirizado;
            }
            
            let daysInMonth = 30;
            if (calculationType === 'proportional') {
                const entryDate = new Date(entry.date + 'T00:00:00');
                daysInMonth = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0).getDate();
            }
            
            baseValue = measurementValueTerceirizado / daysInMonth;
        } else {
            baseValue = calculateDailyBaseValueTerceirizado(entry, equipConfig, work);
        }
    }
    
    // Anotações
    let notesAdditions = 0;
    let notesDiscounts = 0;
    
    (entry.notes || []).forEach(note => {
        if (note.description && note.value !== 0) {
            const totalNoteValue = (note.quantity || 0) * (note.value || 0);
            
            if (note.type === 'addition' && (note.target === 'terceirizado' || note.target === 'both')) {
                notesAdditions += totalNoteValue;
            } else if (note.type === 'discount' && (note.target === 'terceirizado' || note.target === 'both')) {
                notesDiscounts += totalNoteValue;
            }
        }
    });
    
    // Descontos por paradas
    let stoppageDiscount = 0;
    if (entry.stoppages && Array.isArray(entry.stoppages)) {
        const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
        if (stoppageHours > 0 && baseValue > 0) {
            const totalShiftHours = calculateTotalShiftHours(work);
            if (totalShiftHours > 0) {
                const hourlyRate = baseValue / totalShiftHours;
                stoppageDiscount = stoppageHours * hourlyRate;
            }
        }
    }
    
    const finalValue = baseValue + notesAdditions - notesDiscounts - stoppageDiscount;
    
    if (entry.daily_manual_value_terceirizado !== null && 
        entry.daily_manual_value_terceirizado !== undefined && 
        entry.daily_manual_value_terceirizado !== '') {
        return parseFloat(entry.daily_manual_value_terceirizado);
    }
    
    return Math.round((Math.max(0, finalValue) + Number.EPSILON) * 100) / 100;
};




/**
 * ===================================================================
 * SEÇÃO 11: VALIDAÇÕES E VERIFICAÇÕES
 * ===================================================================
 * Esta seção contém funções para validar dados antes dos cálculos.
 */

/**
 * Valida se os dados necessários para cálculo estão presentes
 *
 * @param {Object} entry - Lançamento diário
 * @param {Object} equipConfig - Configuração do equipamento
 * @returns {Object} Resultado da validação {isValid, errors}
 */
export const validateCalculationData = (entry, equipConfig) => {
    const errors = [];

    if (!entry) {
        errors.push('Lançamento não fornecido');
        return { isValid: false, errors };
    }

    if (!equipConfig) {
        errors.push('Configuração do equipamento não encontrada');
        return { isValid: false, errors };
    }

    // Valida dados básicos
    if (!entry.date) {
        errors.push('Data do lançamento é obrigatória');
    }

    if (entry.is_worked === undefined || entry.is_worked === null) {
        errors.push('Status de trabalho é obrigatório');
    }

    // Valida configuração do equipamento
    if (!equipConfig.measurement_type) {
        errors.push('Tipo de medição não configurado');
    }

    if (isNaN(parseFloat(equipConfig.measurement_value))) {
        errors.push('Valor de medição inválido');
    }

    // Validações específicas por tipo
    if (equipConfig.measurement_type === 'hourly') {
        if (entry.is_worked && (!entry.horometer_start && entry.horometer_start !== 0)) {
            errors.push('Horímetro inicial é obrigatório para medição horária');
        }
        if (entry.is_worked && (!entry.horometer_end && entry.horometer_end !== 0)) {
            errors.push('Horímetro final é obrigatório para medição horária');
        }
    }

    // NOVA VALIDAÇÃO: Horas de Garantia
    if (equipConfig.measurement_type === MEASUREMENT_TYPES.GUARANTEED_HOURS) {
        if (isNaN(parseFloat(equipConfig.guaranteed_hours)) || parseFloat(equipConfig.guaranteed_hours) <= 0) {
            errors.push('Horas de garantia são obrigatórias e devem ser um número positivo para este tipo de medição');
        }
        // Para este tipo, o valor de medição deve ser o valor mensal
        if (isNaN(parseFloat(equipConfig.measurement_value)) || parseFloat(equipConfig.measurement_value) <= 0) {
            errors.push('Valor mensal é obrigatório e deve ser um número positivo para medição com horas de garantia');
        }
    }


    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * ===================================================================
 * SEÇÃO 12: FUNÇÕES DE DEBUG E LOGGING
 * ===================================================================
 * Esta seção contém funções para debug e análise dos cálculos.
 */

/**
 * Gera log detalhado de um cálculo de valor diário
 *
 * @param {Object} entry - Lançamento diário
 * @param {Object} equipConfig - Configuração do equipamento
 * @param {Object} work - Dados da obra
 * @param {boolean} isTerceirizado - Se é cálculo terceirizado
 * @returns {Object} Log detalhado do cálculo
 */
export const generateCalculationLog = (entry, equipConfig, work, isTerceirizado = false) => {
    const log = {
        timestamp: new Date().toISOString(),
        entry: {
            date: entry.date,
            is_worked: entry.is_worked,
            equipment_id: entry.equipment_id
        },
        config: {
            measurement_type: isTerceirizado ? 
                (equipConfig.measurement_type_terceirizado || equipConfig.measurement_type) :
                equipConfig.measurement_type,
            measurement_value: isTerceirizado ?
                (equipConfig.measurement_value_terceirizado || equipConfig.measurement_value) :
                equipConfig.measurement_value
        },
        calculations: {},
        finalValue: 0
    };

    try {
        // Calcula valor base
        const baseValue = isTerceirizado ?
            calculateDailyBaseValueTerceirizado(entry, equipConfig, work) :
            calculateDailyBaseValue(entry, equipConfig, work);

        log.calculations.baseValue = baseValue;

        // Calcula descontos por paradas
        const stoppageDiscount = calculateStoppageDiscountValue(entry, equipConfig, work, isTerceirizado);
        log.calculations.stoppageDiscount = stoppageDiscount;

        // Calcula acréscimos e descontos de anotações
        const target = isTerceirizado ? 'terceirizado' : 'client';
        const notesAdditions = calculateNotesAdditions(entry, target);
        const notesDiscounts = calculateNotesDiscounts(entry, target);
        
        log.calculations.notesAdditions = notesAdditions;
        log.calculations.notesDiscounts = notesDiscounts;

        // Calcula mobilização/desmobilização (para o log, considera o valor do dia se aplicável)
        const mobilizationCost = calculateMobilizationCost([entry], equipConfig, isTerceirizado);
        const demobilizationCost = calculateDemobilizationCost([entry], equipConfig, isTerceirizado);
        log.calculations.mobilizationCost = mobilizationCost;
        log.calculations.demobilizationCost = demobilizationCost;


        // Valor final
        log.finalValue = baseValue + notesAdditions + mobilizationCost + demobilizationCost - stoppageDiscount - notesDiscounts;

        log.success = true;

    } catch (error) {
        log.error = error.message;
        log.success = false;
    }

    return log;
};

/**
 * ===================================================================
 * SEÇÃO 13: EXPORTAÇÕES E CONFIGURAÇÕES
 * ===================================================================
 */

// Configurações padrão do módulo
export const CALCULATION_DEFAULTS = {
    DEFAULT_SHIFT_HOURS: 8,
    DEFAULT_MONTHLY_CALCULATION: 'proportional',
    FIXED_MONTH_DAYS: 30,
    PRECISION_DECIMALS: 2
};

// Tipos de medição suportados
export const MEASUREMENT_TYPES = {
    DAILY: 'daily',
    MONTHLY: 'monthly',
    HOURLY: 'hourly',
    GUARANTEED_HOURS: 'guaranteed_hours' // NOVO TIPO DE MEDIÇÃO
};

// Tipos de impacto de despesas
export const EXPENSE_IMPACT_TYPES = {
    ADD_CLIENT: 'add_client',
    DISC_CLIENT: 'disc_client',
    ADD_TERCEIRIZADO: 'add_terceirizado',
    DISC_TERCEIRIZADO: 'disc_terceirizado',
    ADD_TERCEIRIZADO_ESPECIFICO: 'add_terceirizado_especifico',
    DISC_TERCEIRIZADO_ESPECIFICO: 'disc_terceirizado_especifico'
    // REMOVIDOS PARA SIMPLIFICAR: ADD_DAMAGE_CLIENT, DISC_DAMAGE_CLIENT, ADD_DAMAGE_TERCEIRIZADO, DISC_DAMAGE_TERCEIRIZADO
    // Agora, as avarias usam diretamente ADD_CLIENT e DISC_CLIENT ou ADD_TERCEIRIZADO e DISC_TERCEIRIZADO
};

// Função principal de inicialização (se necessária)
export const initCalculationModule = () => {
    console.log('Módulo de Cálculos de Valores inicializado');
    console.log('Versão: 1.0.0');
    console.log('Funções disponíveis:', Object.keys(module.exports || {}));
};

/**
 * ===================================================================
 * NOTAS IMPORTANTES PARA DESENVOLVIMENTO:
 * ===================================================================
 * 1. PRECISÃO NUMÉRICA:
 * - Todos os cálculos usam JavaScript puro para evitar perda de precisão
 * - Evite usar formatCurrency() dentro de cálculos, apenas para exibição
 * - Use parseFloat() apenas quando necessário, mantendo números como Number
 * 2. COMPATIBILIDADE:
 * - Todas as funções mantêm compatibilidade com o código existente
 * - Parâmetros opcionais têm valores padrão seguros
 * - Tratamento de casos edge (valores null, undefined, arrays vazios)
 * 3. PERFORMANCE:
 * - Funções otimizadas para processar grandes volumes de dados
 * - Evita recálculos desnecessários
 * - Cache de valores intermediários quando apropriado
 * 4. MANUTENIBILIDADE:
 * - Código bem documentado e estruturado em seções lógicas
 * - Separação clara entre cálculos do contrato e terceirizados
 * - Funções puras sem efeitos colaterais quando possível
 * 5. EXTENSIBILIDADE:
 * - Estrutura permite fácil adição de novos tipos de cálculo
 * - Interfaces consistentes para facilitar testes
 * - Configurações centralizadas para facilitar mudanças
 */
 
 /* @param {number} unitValue - Valor unitário
 * @param {number} quantity - Quantidade
 * @param {number} additions - Acréscimos
 * @param {number} discounts - Descontos
 * @returns {number} Valor total calculado
 */
export const calculateExpenseTotal = (unitValue, quantity, additions, discounts) => {
    const baseTotal = (parseFloat(unitValue) || 0) * Math.max(1, parseFloat(quantity) || 1);
    const totalAdditions = parseFloat(additions) || 0;
    const totalDiscounts = parseFloat(discounts) || 0;
    return baseTotal + totalAdditions - totalDiscounts;
};


export const getEffectiveMonthlyCalculationType = (entry, equipConfig, work) => {
    console.log(`[DEBUG RELATÓRIO] Analisando tipo de cálculo mensal:`);
    console.log(`   entry.monthly_calculation_manual:`, entry.monthly_calculation_manual);
    console.log(`   entry.monthly_calculation_override:`, entry.monthly_calculation_override);
    console.log(`   equipConfig.monthly_calculation:`, equipConfig?.monthly_calculation);
    
    // 1. PRIORIDADE MÁXIMA: valor manual salvo na entrada (mas só se não for vazio/null)
    if (entry.monthly_calculation_manual && entry.monthly_calculation_manual !== '') {
        console.log(`[DEBUG RELATÓRIO] Usando tipo manual salvo: ${entry.monthly_calculation_manual}`);
        return entry.monthly_calculation_manual;
    }
    
    // 2. CORREÇÃO PRINCIPAL: Se manual está vazio, USAR o override automático (se existir)
    if (entry.monthly_calculation_override && entry.monthly_calculation_override !== '') {
        console.log(`[DEBUG RELATÓRIO] Manual vazio - usando override automático: ${entry.monthly_calculation_override}`);
        return entry.monthly_calculation_override;
    }
    
    // 3. FALLBACK: configuração padrão do equipamento
    const configType = equipConfig?.monthly_calculation || 'proportional';
    console.log(`[DEBUG RELATÓRIO] Usando configuração padrão: ${configType}`);
    return configType;
};

// TAMBÉM CORRIGIR A FUNÇÃO PARA TERCEIRIZADOS
export const getEffectiveMonthlyCalculationTypeTerceirizado = (entry, equipConfig, work) => {
    console.log(`[DEBUG RELATÓRIO TERC] Analisando tipo de cálculo mensal terceirizado:`);
    console.log(`   entry.monthly_calculation_manual_terceirizado:`, entry.monthly_calculation_manual_terceirizado);
    console.log(`   entry.monthly_calculation_override_terceirizado:`, entry.monthly_calculation_override_terceirizado);
    console.log(`   equipConfig.monthly_calculation_terceirizado:`, equipConfig?.monthly_calculation_terceirizado);
    
    // 1. PRIORIDADE MÁXIMA: valor manual salvo na entrada (mas só se não for vazio/null)
    if (entry.monthly_calculation_manual_terceirizado && entry.monthly_calculation_manual_terceirizado !== '') {
        console.log(`[DEBUG RELATÓRIO TERC] Usando tipo manual salvo: ${entry.monthly_calculation_manual_terceirizado}`);
        return entry.monthly_calculation_manual_terceirizado;
    }
    
    // 2. CORREÇÃO PRINCIPAL: Se manual está vazio, USAR o override automático (se existir)
    if (entry.monthly_calculation_override_terceirizado && entry.monthly_calculation_override_terceirizado !== '') {
        console.log(`[DEBUG RELATÓRIO TERC] Manual vazio - usando override automático: ${entry.monthly_calculation_override_terceirizado}`);
        return entry.monthly_calculation_override_terceirizado;
    }
    
    // 3. FALLBACK: configuração padrão do equipamento (terceirizado ou padrão)
    const configType = equipConfig?.monthly_calculation_terceirizado || 
                      equipConfig?.monthly_calculation || 'proportional';
    console.log(`[DEBUG RELATÓRIO TERC] Usando configuração padrão: ${configType}`);
    return configType;
};

export { calculateDetailFooterTotalTerceirizado };