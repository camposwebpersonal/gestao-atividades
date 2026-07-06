// calculos_valores_mensal.js - CORREÇÃO COMPLETA DA LÓGICA DE PERÍODOS
// =======================================================================
// GLÓRIA A DEUS - LÓGICA CORRIGIDA CONFORME ESPECIFICAÇÃO
// =======================================================================

import { getEffectiveMonthlyCalculationType } from './calculos_valores.js?v=20260302090000';

/**
 * 🔥 FUNÇÃO NOVA: Determina quantos dias usar para divisão baseado no PERÍODO DE MEDIÇÃO
 * 
 * REGRAS CORRETAS:
 * 1. Fevereiro sempre proporcional (28 ou 29)
 * 2. Período de 31 dias que coincide com mês de 31 dias → 31 dias
 * 3. Período de 30 dias que coincide com mês de 30 dias → 30 dias
 * 4. Qualquer outro caso → 30 dias fixo
 */
const getDaysInMonthForPeriod = (dateStr, work) => {
    // Encontrar o período de medição ao qual esta data pertence
    const measurementPeriod = findMeasurementPeriodForDate(dateStr, work);
    
    if (!measurementPeriod) {
        // Fallback: usar dias do mês da data
        const date = new Date(dateStr + 'T00:00:00');
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }
    
    const periodStart = new Date(measurementPeriod.start + 'T00:00:00');
    const periodEnd = new Date(measurementPeriod.end + 'T00:00:00');
    
    // Calcular total de dias no período
    const totalDaysInPeriod = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    
    // Verificar meses envolvidos no período
    const startMonth = periodStart.getMonth() + 1; // 1-12
    const endMonth = periodEnd.getMonth() + 1;
    const startDay = periodStart.getDate();
    const endDay = periodEnd.getDate();
    
    console.log(`📊 [ANÁLISE PERÍODO] ${measurementPeriod.start} a ${measurementPeriod.end}`);
    console.log(`   Total dias: ${totalDaysInPeriod}`);
    console.log(`   Mês início: ${startMonth}, dia: ${startDay}`);
    console.log(`   Mês fim: ${endMonth}, dia: ${endDay}`);
    
    // 🔥 REGRA 1: FEVEREIRO - SÓ SE O PERÍODO TIVER EXATAMENTE 28 OU 29 DIAS
    if (startMonth === 2 || endMonth === 2) {
        const year = periodStart.getFullYear();
        const daysInFebruary = new Date(year, 2, 0).getDate(); // 28 ou 29
        
        // SÓ aplica a regra de fevereiro se o período tiver EXATAMENTE o número de dias do fevereiro
        if (totalDaysInPeriod === daysInFebruary) {
            console.log(`   ✅ FEVEREIRO EXATO (${daysInFebruary} dias) → ${daysInFebruary} dias`);
            return daysInFebruary;
        }
        
        console.log(`   ⚠️ Tem fevereiro mas não é período exato (${totalDaysInPeriod} dias) → 30 dias fixo`);
    }
    
    // 🔥 REGRA 2: PERÍODO DE EXATAMENTE 31 DIAS
    if (totalDaysInPeriod === 31) {
        console.log(`   ✅ PERÍODO DE 31 DIAS → usar 31 dias`);
        return 31;
    }
    
    // 🔥 REGRA 3: PERÍODO DE EXATAMENTE 30 DIAS
    if (totalDaysInPeriod === 30) {
        console.log(`   ✅ PERÍODO DE 30 DIAS → usar 30 dias`);
        return 30;
    }
    
    // 🔥 REGRA 4: QUALQUER OUTRO CASO → 30 DIAS FIXO
    console.log(`   ✅ Caso padrão → 30 dias (fixo)`);
    return 30;
};

/**
 * Encontra o período de medição ao qual uma data pertence
 */
const findMeasurementPeriodForDate = (dateStr, work) => {
    if (!work?.config?.measurement_periods) {
        return null;
    }
    
    const checkDate = new Date(dateStr + 'T00:00:00');
    
    for (const period of work.config.measurement_periods) {
        const periodStart = new Date(period.start + 'T00:00:00');
        const periodEnd = new Date(period.end + 'T00:00:00');
        
        if (checkDate >= periodStart && checkDate <= periodEnd) {
            return period;
        }
    }
    
    return null;
};

/**
 * 🔥 FUNÇÃO PRINCIPAL CORRIGIDA
 * Calcula o valor diário de um equipamento com medição 'monthly'
 */
export const calculateMonthlyBaseValue = (entry, equipConfig, work) => {
    const measureValue = parseFloat(equipConfig?.measurement_value || 0);
    
    if (measureValue === 0) return 0;
    
    // Usar a função que determina o tipo de cálculo
    const calculationType = getEffectiveMonthlyCalculationType(entry, equipConfig, work);
    
    console.log(`\n🔥 [CÁLCULO MENSAL] Equipamento ID: ${entry.equipment_id}`);
    console.log(`   Data: ${entry.date}`);
    console.log(`   Tipo de cálculo: ${calculationType}`);
    console.log(`   Valor mensal: R$ ${measureValue}`);
    
    let daysInMonth;
    
    if (calculationType === 'fixed_30') {
        // Cálculo baseado em 30 dias fixos
        daysInMonth = 30;
        console.log(`   🎯 Usando 30 dias fixos (manual)`);
    } else {
        // 🔥 CORREÇÃO PRINCIPAL: Usar a nova lógica baseada no PERÍODO DE MEDIÇÃO
        daysInMonth = getDaysInMonthForPeriod(entry.date, work);
        console.log(`   🎯 Dias calculados pelo período: ${daysInMonth}`);
    }
    
    // Calcular valor diário com arredondamento preciso
    const dailyValue = measureValue / daysInMonth;
    const preciseRoundedDailyValue = Math.round((dailyValue + Number.EPSILON) * 100) / 100;
    
    console.log(`   💰 Valor diário bruto: R$ ${dailyValue.toFixed(6)}`);
    console.log(`   ✅ Valor diário final: R$ ${preciseRoundedDailyValue.toFixed(2)}`);
    
    return preciseRoundedDailyValue;
};

/**
 * 🔥 FUNÇÃO PARA CÁLCULO TOTAL DO PERÍODO
 * Calcula o total mensal considerando dias trabalhados
 */
export const calculateMonthlyTotalValue = (entries, equipConfig, work) => {
    const measureValue = parseFloat(equipConfig?.measurement_value || 0);
    
    if (measureValue === 0) return 0;
    
    // Contar apenas dias trabalhados
    const workedEntries = entries.filter(entry => entry.is_worked);
    
    if (workedEntries.length === 0) return 0;
    
    // Obter tipo de cálculo e dias do mês baseado na primeira entrada
    const firstEntry = workedEntries[0];
    const calculationType = getEffectiveMonthlyCalculationType(firstEntry, equipConfig, work);
    
    let daysInMonth;
    if (calculationType === 'fixed_30') {
        daysInMonth = 30;
    } else {
        daysInMonth = getDaysInMonthForPeriod(firstEntry.date, work);
    }
    
    console.log(`\n🔥 [TOTAL MENSAL] ${workedEntries.length} dias trabalhados de ${daysInMonth} dias`);
    
    // Se trabalhou todos os dias do período, retorna valor mensal exato
    if (workedEntries.length === daysInMonth) {
        console.log(`   ✅ Período COMPLETO → Valor mensal exato: R$ ${measureValue}`);
        return measureValue;
    }
    
    // Caso contrário, calcular proporcional
    const exactDailyValue = measureValue / daysInMonth;
    const totalValue = exactDailyValue * workedEntries.length;
    const preciseTotalValue = Math.round((totalValue + Number.EPSILON) * 100) / 100;
    
    console.log(`   💰 Total calculado: R$ ${preciseTotalValue.toFixed(2)}`);
    
    return preciseTotalValue;
};