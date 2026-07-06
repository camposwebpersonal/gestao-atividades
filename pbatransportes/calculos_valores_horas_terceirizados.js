// calculos_valores_horas_terceirizados.js - Cálculo de Medição por Horas para Terceirizados
// =======================================================================
// Este arquivo contém a lógica específica para calcular o valor diário
// de um equipamento com medição 'hourly' para equipamentos terceirizados.
// =======================================================================

/**
 * Calcula o valor diário de um equipamento com medição 'hourly' (terceirizado).
 *
 * @param {Object} entry - Lançamento diário do equipamento.
 * @param {Object} equipConfig - Configuração do equipamento na obra.
 * @returns {number} Valor base diário calculado para medição horária terceirizada.
 */
export const calculateHourlyBaseValueTerceirizado = (entry, equipConfig) => {
    // 🔥 VALIDAÇÃO: Se falta horímetro inicial OU final, retorna 0
    const horometerStart = parseFloat(entry.horometer_start);
    const horometerEnd = parseFloat(entry.horometer_end);
    
    // Se qualquer um dos valores não existir ou for inválido, horas = 0
    if (!horometerStart || !horometerEnd || horometerStart <= 0 || horometerEnd <= 0) {
        return 0;
    }
    
    const hoursWorked = horometerEnd - horometerStart;
    const measureValueTerc = parseFloat(equipConfig?.measurement_value_terceirizado || 
                                       equipConfig?.measurement_value || 0);
    return Math.max(0, hoursWorked) * measureValueTerc;
};
