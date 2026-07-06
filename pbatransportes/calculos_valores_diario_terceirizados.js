// calculos_valores_diario_terceirizados.js - Cálculo de Medição Diária para Terceirizados
// =======================================================================
// Este arquivo contém a lógica específica para calcular o valor diário
// de um equipamento com medição 'daily' para equipamentos terceirizados.
// =======================================================================

/**
 * Calcula o valor diário de um equipamento com medição 'daily' (terceirizado).
 *
 * @param {Object} equipConfig - Configuração do equipamento na obra.
 * @returns {number} Valor base diário calculado para medição diária terceirizada.
 */
export const calculateDailyFixedValueTerceirizado = (equipConfig) => {
    return parseFloat(equipConfig?.measurement_value_terceirizado || 
                       equipConfig?.measurement_value || 0);
};
