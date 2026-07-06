// calculos_valores_garantia_horas.js
// 🔥🔥🔥 VERSÃO DEFINITIVA CORRIGIDA - 2024-11-28 22:00 🔥🔥🔥

import { calculateDeductibleStoppageHours, calculateTotalShiftHours } from './calculos_valores.js?v=20260302090000';

/**
 * Calcula as horas de garantia ajustadas baseado na configuração do período
 * @param {number} baseGuaranteedHours - Horas de garantia configuradas (ex: 200h)
 * @param {Object} periodConfig - Configuração do período { start, end, proportional_month, month_logic }
 * @returns {number} - Horas de garantia ajustadas
 */
export const calculateProportionalGuaranteedHours = (baseGuaranteedHours, periodConfig) => {
    if (!periodConfig) return baseGuaranteedHours;
    
    const startDate = new Date(periodConfig.start + 'T00:00:00');
    const endDate = new Date(periodConfig.end + 'T00:00:00');
    const actualDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`\n🔧 CÁLCULO DE HORAS PROPORCIONAIS:`);
    console.log(`   📅 Período: ${periodConfig.start} a ${periodConfig.end}`);
    console.log(`   📊 Dias reais: ${actualDays}`);
    console.log(`   ⏰ Horas base: ${baseGuaranteedHours}h`);
    
    // Se checkbox "Proporcional ao mês" estiver MARCADO = usar horas completas
    if (periodConfig.proportional_month === true) {
        console.log(`   ✅ Checkbox MARCADO: Usando horas completas = ${baseGuaranteedHours}h`);
        return baseGuaranteedHours;
    }
    
    // Se período é completo (28-31 dias), sempre usa horas completas
    if (actualDays >= 28 && actualDays <= 31) {
        console.log(`   ✅ Período completo (${actualDays} dias): Usando horas completas = ${baseGuaranteedHours}h`);
        return baseGuaranteedHours;
    }
    
    // Calcular mês de referência baseado na lógica escolhida
    let referenceDays;
    const monthLogic = periodConfig.month_logic || 'same_day';
    
    if (monthLogic === 'days_count') {
        // Usar quantidade de dias do mês da data inicial
        const year = startDate.getFullYear();
        const month = startDate.getMonth();
        referenceDays = new Date(year, month + 1, 0).getDate();
        console.log(`   📆 Lógica "Dias do mês inicial": ${referenceDays} dias (${startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})`);
    } else {
        // Usar mesmo dia no mês seguinte (default)
        const dayOfMonth = startDate.getDate();
        const nextMonth = new Date(startDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // Ajustar se o dia não existir no mês seguinte
        if (nextMonth.getDate() < dayOfMonth) {
            nextMonth.setDate(0); // Último dia do mês anterior
        }
        
        referenceDays = Math.round((nextMonth - startDate) / (1000 * 60 * 60 * 24));
        console.log(`   📆 Lógica "Mesmo dia mês seguinte": ${referenceDays} dias`);
    }
    
    // Calcular horas proporcionais
    const proportionalHours = (baseGuaranteedHours / referenceDays) * actualDays;
    console.log(`   🧮 Cálculo: ${baseGuaranteedHours}h ÷ ${referenceDays} dias × ${actualDays} dias = ${proportionalHours.toFixed(2)}h`);
    console.log(`   ✅ Horas proporcionais finais: ${proportionalHours.toFixed(2)}h`);
    
    return proportionalHours;
};

export const calculateGuaranteedHoursLogic = (entries, equipConfig, work, substitutionDetails = null, measurementPeriodDays = null, monthlyCalculationType = null, periodConfig = null) => {
    console.error('⚡⚡⚡ VERSÃO DEFINITIVA 2024-11-28 22:00 ⚡⚡⚡');
    console.log('\n' + '🔥'.repeat(35));
    console.log('🔥🔥🔥 CÓDIGO DEFINITIVO CORRIGIDO! 🔥🔥🔥');
    console.log('🔥'.repeat(35) + '\n');
    
    console.log(`📊 INÍCIO - HORAS DE GARANTIA COM GARANTIA MÍNIMA`);
    
    let monthlyValue = parseFloat(equipConfig?.measurement_value || 0);
    let guaranteedHours = parseFloat(equipConfig?.guaranteed_hours || 0);

    console.log(`💰 Valor mensal: R$ ${monthlyValue.toFixed(2)}`);
    console.log(`⏰ Horas garantidas (base): ${guaranteedHours}h`);
    
    if (substitutionDetails) {
        const substitutedMonthlyValue = parseFloat(substitutionDetails.substituted_equipment_monthly_value);
        const substitutedGuaranteedHours = parseFloat(substitutionDetails.substituted_equipment_guaranteed_hours);
        
        if (!isNaN(substitutedMonthlyValue) && !isNaN(substitutedGuaranteedHours) && 
            substitutedMonthlyValue > 0 && substitutedGuaranteedHours > 0) {
            monthlyValue = substitutedMonthlyValue;
            guaranteedHours = substitutedGuaranteedHours;
            console.log(`🔄 Substituição: Mensal R$ ${monthlyValue} | Garantia ${guaranteedHours}h`);
        }
    }
    
    // 🎯 APLICAR HORAS PROPORCIONAIS SE CONFIGURADO
    if (periodConfig) {
        guaranteedHours = calculateProportionalGuaranteedHours(guaranteedHours, periodConfig);
    }

    if (monthlyValue === 0 || guaranteedHours === 0) {
        console.log('❌ VALORES INVÁLIDOS - ABORTANDO');
        return { baseValue: 0, stoppageDiscount: 0, daysStoppedDiscount: 0 };
    }

    const hourlyRate = monthlyValue / guaranteedHours;
    console.log(`💵 Taxa horária: R$ ${hourlyRate.toFixed(4)}/h`);

    let totalActualHours = 0;
    let totalWorkedDays = 0;
    let totalDeductibleStoppageHours = 0;
    let mobilizationDate = null;
    let demobilizationDate = null;
    
    // 🔥 CALCULAR PERÍODO TOTAL DO RELATÓRIO
    let totalDaysInPeriod;
    
    if (measurementPeriodDays !== null && measurementPeriodDays > 0) {
        totalDaysInPeriod = measurementPeriodDays;
        console.log(`\n📅 PERÍODO DO RELATÓRIO: ${totalDaysInPeriod} dias`);
    } else if (entries.length > 0) {
        const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sortedEntries[0].date);
        const lastDate = new Date(sortedEntries[sortedEntries.length - 1].date);
        
        const diffTime = Math.abs(lastDate - firstDate);
        totalDaysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        console.log(`\n📅 PERÍODO CALCULADO: ${totalDaysInPeriod} dias (${sortedEntries[0].date} a ${sortedEntries[sortedEntries.length - 1].date})`);
    } else {
        totalDaysInPeriod = 30;
        console.log(`\n⚠️ FALLBACK: ${totalDaysInPeriod} dias`);
    }

    console.log(`\n📅 Processando ${entries.length} lançamentos...`);

    entries.forEach((entry, idx) => {
        if (entry.is_worked) {
            totalWorkedDays++;
            
            // 🔥 Validação: só calcula se AMBOS os valores existirem
            let hoursWorked = 0;
            const horometerStart = parseFloat(entry.horometer_start);
            const horometerEnd = parseFloat(entry.horometer_end);
            
            if (horometerStart && horometerEnd && horometerStart > 0 && horometerEnd > 0) {
                hoursWorked = horometerEnd - horometerStart;
            }
            
            totalActualHours += hoursWorked;
            console.log(`   ${idx+1}. ${entry.date}: ✅ ${hoursWorked.toFixed(2)}h trabalhadas`);
        } else {
            console.log(`   ${idx+1}. ${entry.date}: ⏸️ Parado`);
        }
        
        if (entry.is_mobilization) mobilizationDate = entry.date;
        if (entry.is_demobilized) demobilizationDate = entry.date;
        
        const stoppageHours = calculateDeductibleStoppageHours(entry, equipConfig, work);
        if (stoppageHours > 0) {
            totalDeductibleStoppageHours += stoppageHours;
            console.log(`      ⏸️ Parada: ${stoppageHours.toFixed(2)}h`);
        }
    });

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📊 RESUMO DO PERÍODO:`);
    console.log(`   📆 Total de dias no período: ${totalDaysInPeriod}`);
    console.log(`   📆 Dias trabalhados: ${totalWorkedDays}`);
    console.log(`   ⏰ Horas REALMENTE trabalhadas: ${totalActualHours.toFixed(2)}h`);

    // 🔥 REGRA ESPECIAL: Períodos maiores que 31 dias = Cálculo híbrido
    if (totalDaysInPeriod > 31) {
        console.log(`\n🎯 PERÍODO ESPECIAL (${totalDaysInPeriod} dias > 31):`);
        console.log(`   Calculando com GARANTIA PROPORCIONAL aos dias`);
        
        // Calcular garantia mínima proporcional aos DIAS trabalhados
        const dailyValue = monthlyValue / 30; // Valor diário baseado em 30 dias
        const guaranteedValueForDays = dailyValue * totalWorkedDays;
        
        // Calcular valor pelas HORAS trabalhadas
        const valueByHours = totalActualHours * hourlyRate;
        
        console.log(`   💰 Valor mensal: R$ ${monthlyValue.toFixed(2)}`);
        console.log(`   💰 Valor diário: R$ ${monthlyValue.toFixed(2)} ÷ 30 = R$ ${dailyValue.toFixed(2)}`);
        console.log(`   📅 Dias trabalhados: ${totalWorkedDays}`);
        console.log(`   💰 Garantia por dias: R$ ${dailyValue.toFixed(2)} × ${totalWorkedDays} = R$ ${guaranteedValueForDays.toFixed(2)}`);
        console.log(`   ⏰ Horas trabalhadas: ${totalActualHours.toFixed(2)}h`);
        console.log(`   💰 Valor por horas: ${totalActualHours.toFixed(2)}h × R$ ${hourlyRate.toFixed(2)} = R$ ${valueByHours.toFixed(2)}`);
        
        // USAR O MAIOR entre valor por horas e garantia mínima por dias
        const baseValue = Math.max(valueByHours, guaranteedValueForDays);
        
        if (valueByHours >= guaranteedValueForDays) {
            console.log(`   ✅ USANDO VALOR POR HORAS (maior): R$ ${baseValue.toFixed(2)}`);
        } else {
            console.log(`   ✅ USANDO GARANTIA POR DIAS (maior): R$ ${baseValue.toFixed(2)}`);
        }
        
        // 🔥 CALCULAR DESCONTOS DE PARADAS (CRÍTICO!)
        const stoppageDiscount = totalDeductibleStoppageHours * hourlyRate;
        console.log(`   ⏸️ Horas de paradas com desconto: ${totalDeductibleStoppageHours.toFixed(2)}h`);
        console.log(`   💰 Desconto de paradas: ${totalDeductibleStoppageHours.toFixed(2)}h × R$ ${hourlyRate.toFixed(2)} = R$ ${stoppageDiscount.toFixed(2)}`);
        
        const daysStoppedDiscount = 0; // Não aplicar desconto por dias parados
        const finalValue = baseValue - stoppageDiscount - daysStoppedDiscount;
        
        console.log(`\n${'═'.repeat(70)}`);
        console.log(`🎯 RESULTADO FINAL (PERÍODO ESPECIAL):`);
        console.log(`   💰 Valor base: R$ ${baseValue.toFixed(2)}`);
        console.log(`   ➖ Desconto paradas: R$ ${stoppageDiscount.toFixed(2)}`);
        console.log(`   ➖ Desconto dias parados: R$ ${daysStoppedDiscount.toFixed(2)}`);
        console.log(`   ${'─'.repeat(70)}`);
        console.log(`   ✅ TOTAL: R$ ${finalValue.toFixed(2)}`);
        console.log(`${'═'.repeat(70)}`);
        
        return {
            baseValue: finalValue,
            stoppageDiscount: stoppageDiscount,
            daysStoppedDiscount: daysStoppedDiscount
        };
    }

    // 🔥🔥🔥 LÓGICA NORMAL (períodos ≤ 31 dias) 🔥🔥🔥
    //
    // REGRA ÚNICA E DEFINITIVA:
    // 1. Calcular garantia mínima baseado em dias trabalhados
    //    - Se proportional: ÷ totalDaysInPeriod (ex: 31 dias)
    //    - Se fixed_30: ÷ 30 fixos
    // 2. Comparar horas trabalhadas vs garantia mínima
    // 3. Cobrar o MAIOR valor (max)
    // 4. NUNCA limitar a R$ 20.000 se trabalhou mais horas!
    
    // 🎯 DETERMINAR DIVISOR BASEADO NO TIPO DE CÁLCULO
    let divisor;
    if (monthlyCalculationType === 'proportional') {
        divisor = totalDaysInPeriod; // Usa período real (ex: 31 dias)
        console.log(`   📐 Tipo cálculo: PROPORÇÃO → Divisor = ${divisor} dias (período real)`);
    } else {
        divisor = 30; // Fixo em 30 dias
        console.log(`   📐 Tipo cálculo: FIXO 30 DIAS → Divisor = ${divisor} dias`);
    }
    
    const guaranteedHoursPerDay = guaranteedHours / divisor;
    const minimumGuaranteedHoursForWorkedDays = totalWorkedDays * guaranteedHoursPerDay;
    
    console.log(`   💰 Valor mensal contrato: R$ ${monthlyValue.toFixed(2)}`);
    console.log(`   🎯 Horas garantidas contrato: ${guaranteedHours}h`);
    console.log(`   🎯 Garantia por dia: ${guaranteedHours}h ÷ ${divisor} dias = ${guaranteedHoursPerDay.toFixed(4)}h/dia`);
    console.log(`   🎯 Garantia mínima para ${totalWorkedDays} dias: ${totalWorkedDays} × ${guaranteedHoursPerDay.toFixed(4)}h = ${minimumGuaranteedHoursForWorkedDays.toFixed(2)}h`);
    
    let effectiveHours;
    
    // 🔥 REGRA PRINCIPAL: Sempre usar o MAIOR entre horas trabalhadas e garantia mínima
    // MAS: Se a garantia mínima ultrapassar a garantia total, limitar na garantia total
    const cappedMinimum = Math.min(minimumGuaranteedHoursForWorkedDays, guaranteedHours);
    effectiveHours = Math.max(totalActualHours, cappedMinimum);
    
    if (totalActualHours < cappedMinimum) {
        console.log(`\n⚠️ HORAS INSUFICIENTES!`);
        console.log(`   Trabalhou apenas ${totalActualHours.toFixed(2)}h`);
        console.log(`   Garantia mínima: ${minimumGuaranteedHoursForWorkedDays.toFixed(2)}h`);
        
        if (minimumGuaranteedHoursForWorkedDays > guaranteedHours) {
            console.log(`   ⚠️ Garantia mínima (${minimumGuaranteedHoursForWorkedDays.toFixed(2)}h) > Garantia total (${guaranteedHours}h)`);
            console.log(`   🎯 LIMITANDO em garantia total: ${guaranteedHours.toFixed(2)}h`);
            console.log(`   ✅ COBRANDO: ${effectiveHours.toFixed(2)}h`);
        } else {
            console.log(`   ✅ APLICANDO GARANTIA: ${effectiveHours.toFixed(2)}h`);
        }
    } else {
        console.log(`\n✅ HORAS SUFICIENTES!`);
        console.log(`   Trabalhou ${totalActualHours.toFixed(2)}h`);
        console.log(`   Garantia mínima: ${cappedMinimum.toFixed(2)}h`);
        console.log(`   ✅ COBRANDO HORAS REAIS: ${effectiveHours.toFixed(2)}h`);
    }

    const baseValue = effectiveHours * hourlyRate;
    console.log(`\n💰 CÁLCULO DO VALOR BASE:`);
    console.log(`   ${effectiveHours.toFixed(2)}h × R$ ${hourlyRate.toFixed(4)} = R$ ${baseValue.toFixed(2)}`);

    const stoppageDiscount = totalDeductibleStoppageHours * hourlyRate;
    if (totalDeductibleStoppageHours > 0) {
        console.log(`\n⏸️ DESCONTOS POR PARADAS:`);
        console.log(`   ${totalDeductibleStoppageHours.toFixed(2)}h × R$ ${hourlyRate.toFixed(4)} = R$ ${stoppageDiscount.toFixed(2)}`);
    }

    // 🚫 IMPORTANTE: Para horas de garantia, NÃO aplicar desconto por dias parados!
    let daysStoppedDiscount = 0;
    
    console.log(`\n✅ SEM DESCONTO POR DIAS PARADOS:`);
    console.log(`   Para equipamentos de horas de garantia, o desconto já está`);
    console.log(`   embutido na diferença entre horas trabalhadas e garantidas.`);

    const finalCalculatedValue = baseValue - stoppageDiscount - daysStoppedDiscount;
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🎯 RESULTADO FINAL (GARANTIA APLICADA):`);
    console.log(`   💰 Valor base: R$ ${baseValue.toFixed(2)}`);
    console.log(`   ➖ Desconto paradas: R$ ${stoppageDiscount.toFixed(2)}`);
    console.log(`   ➖ Desconto dias parados: R$ ${daysStoppedDiscount.toFixed(2)}`);
    console.log(`   ${'─'.repeat(70)}`);
    console.log(`   ✅ TOTAL: R$ ${finalCalculatedValue.toFixed(2)}`);
    console.log(`${'═'.repeat(70)}\n`);

    return {
        baseValue: baseValue,
        stoppageDiscount: stoppageDiscount,
        daysStoppedDiscount: daysStoppedDiscount
    };
};