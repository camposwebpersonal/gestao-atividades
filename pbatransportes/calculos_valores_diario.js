// calculos_valores_diario.js - Cálculo de Medição Diária para Cliente
// =======================================================================
// Este arquivo contém a lógica específica para calcular o valor diário
// de um equipamento com medição 'daily' para o contrato principal.
// =======================================================================

/**
 * Calcula o valor diário de um equipamento com medição 'daily' (contrato principal).
 *
 * @param {Object} equipConfig - Configuração do equipamento na obra.
 * @returns {number} Valor base diário calculado para medição diária.
 */
export const calculateDailyFixedValue = (equipConfig) => {
    return parseFloat(equipConfig?.measurement_value || 0);
};
