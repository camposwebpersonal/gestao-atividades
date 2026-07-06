// calculos_valores_mensal_terceirizados.js - CORREÇÃO COMPLETA
// =======================================================================
// GLÓRIA A DEUS - MESMA LÓGICA PARA TERCEIRIZADOS
// =======================================================================

import { getEffectiveMonthlyCalculationTypeTerceirizado } from './calculos_valores.js?v=20260302090000';

/**
 * 🔥 Determina quantos dias usar para divisão baseado no PERÍODO DE MEDIÇÃO
 * (Mesma lógica do arquivo principal)
 */
const getDaysInMonthForPeriod = (dateStr, work) => {
    const measurementPeriod = findMeasurementPeriodForDate(dateStr, work);
    
    if (!measurementPeriod) {
        const date = new Date(dateStr + 'T00:00:00');
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }
    
    const periodStart = new Date(measurementPeriod.start + 'T00:00:00');
    const periodEnd = new Date(measurementPeriod.end + 'T00:00:00');
    const totalDaysInPeriod = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    
    const startMonth = periodStart.getMonth() + 1;
    const endMonth = periodEnd.getMonth() + 1;
    const startDay = periodStart.getDate();
    const endDay = periodEnd.getDate();
    
    console.log(`📊 [TERC - ANÁLISE PERÍODO] ${measurementPeriod.start} a ${measurementPeriod.end}`);
    console.log(`   Total dias: ${totalDaysInPeriod}`);
    
    // REGRA 1: FEVEREIRO - SÓ SE O PERÍODO TIVER EXATAMENTE 28 OU 29 DIAS
    if (startMonth === 2 || endMonth === 2) {
        const year = periodStart.getFullYear();
        const daysInFebruary = new Date(year, 2, 0).getDate();
        
        // SÓ aplica a regra se o período tiver EXATAMENTE o número de dias do fevereiro
        if (totalDaysInPeriod === daysInFebruary) {
            console.log(`   ✅ FEVEREIRO EXATO (${daysInFebruary} dias) → ${daysInFebruary} dias`);
            return daysInFebruary;
        }
        
        console.log(`   ⚠️ Tem fevereiro mas não é exato (${totalDaysInPeriod} dias) → 30 dias fixo`);
    }
    
    // REGRA 2: 31 DIAS COMPLETO
    if (totalDaysInPeriod === 31) {
        const monthsWith31Days = [1, 3, 5, 7, 8, 10, 12];
        if (startMonth === endMonth && 
            monthsWith31Days.includes(startMonth) && 
            startDay === 1 && endDay === 31) {
            console.log(`   ✅ Mês COMPLETO de 31 dias → 31 dias`);
            return 31;
        }
        console.log(`   ⚠️ 31 dias mas NÃO completo → 30 dias`);
        return 30;
    }
    
    // REGRA 3: 30 DIAS COMPLETO
    if (totalDaysInPeriod === 30) {
        const monthsWith30Days = [4, 6, 9, 11];
        if (startMonth === endMonth && 
            monthsWith30Days.includes(startMonth) && 
            startDay === 1 && endDay === 30) {
            console.log(`   ✅ Mês COMPLETO de 30 dias → 30 dias`);
            return 30;
        }
    }
    
    // REGRA 4: PADRÃO
    console.log(`   ✅ Caso padrão → 30 dias (fixo)`);
    return 30;
};

/**
 * Encontra o período de medição
 */
const findMeasurementPeriodForDate = (dateStr, work) => {
    if (!work?.config?.measurement_periods) return null;
    
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
 * 🔥 FUNÇÃO PRINCIPAL CORRIGIDA - TERCEIRIZADOS
 */
export const calculateMonthlyBaseValueTerceirizado = (entry, equipConfig, work) => {
    const measureValueTerc = parseFloat(
        equipConfig?.measurement_value_terceirizado || 
        equipConfig?.measurement_value || 0
    );
    
    if (measureValueTerc === 0) return 0;
    
    const calculationType = getEffectiveMonthlyCalculationTypeTerceirizado(entry, equipConfig, work);
    
    console.log(`\n🔥 [TERCEIRIZADO - CÁLCULO MENSAL] Equipamento ID: ${entry.equipment_id}`);
    console.log(`   Data: ${entry.date}`);
    console.log(`   Tipo: ${calculationType}`);
    console.log(`   Valor mensal: R$ ${measureValueTerc}`);
    
    let daysInMonth;
    
    if (calculationType === 'fixed_30') {
        daysInMonth = 30;
        console.log(`   🎯 30 dias fixos (manual)`);
    } else {
        daysInMonth = getDaysInMonthForPeriod(entry.date, work);
        console.log(`   🎯 Dias pelo período: ${daysInMonth}`);
    }
    
    const dailyValue = measureValueTerc / daysInMonth;
    const preciseRoundedDailyValue = Math.round((dailyValue + Number.EPSILON) * 100) / 100;
    
    console.log(`   ✅ Valor diário final: R$ ${preciseRoundedDailyValue.toFixed(2)}`);
    
    return preciseRoundedDailyValue;
};