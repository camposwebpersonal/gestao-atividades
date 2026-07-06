// appState.js - VERSÃO ATUALIZADA

/**
 * @typedef {Object} AppState
 * @property {Array<Object>} my_companies - Lista de minhas empresas.
 * @property {Array<Object>} client_companies - Lista de empresas clientes.
 * @property {Array<Object>} employees - Lista de funcionários.
 * @property {Array<Object>} equipment - Lista de equipamentos.
 * @property {Array<Object>} stoppage_types - Lista de tipos de parada.
 * @property {Array<Object>} material_types - Lista de tipos de material.
 * @property {Array<Object>} terceirizados - Lista de empresas terceirizadas.
 * @property {Array<Object>} works - Lista de obras.
 * @property {Array<Object>} work_employee_salaries - Lista de salários de funcionários por obra.
 * @property {Array<Object>} bm_payments - Lista de pagamentos de BM (ADICIONADO).
 * @property {Object.<string, Object>} mobilizationStatus - Cache do status de mobilização por equipamento/obra.
 * @property {Object.<string, boolean>} dailyPartStatus - Cache do status da parte diária recebida por equipamento/obra.
 * @property {Array<Object>} damages - Lista de registros de avarias (NOVO).
 * @property {Array<Object>} sand_supply_configs - Lista de configurações de fornecimento de areia (NOVO).
 * @property {Array<Object>} sand_deliveries - Lista de lançamentos de entrega de areia (NOVO).
 */

/**
 * Objeto de estado global da aplicação.
 * @type {AppState}
 */
export const appState = {
    my_companies: [],
    client_companies: [],
    employees: [],
    equipment: [],
    equipment_types: [], // 🎯 NOVO: Tipos de equipamentos
    stoppage_types: [],
    material_types: [],
    terceirizados: [],
    works: [],
    work_employee_salaries: [],
    bm_payments: [], 
    mobilizationStatus: {},
    dailyPartStatus: {},
    damages: [], // NOVO: Array para armazenar registros de avarias
    sand_supply_configs: [], // ANTIGO: Array para armazenar configurações de fornecimento de areia
    sand_deliveries: [], // ANTIGO: Array para armazenar lançamentos de entrega de areia
    
    // NOVO SISTEMA DE AREIA V2
    sand_works: [], // Obras de areia
    sand_associations: [], // Associações empresa-obra-preço
    sand_deliveries_v2: [], // Lançamentos de viagens (novo)
    sand_reports: [], // Relatórios salvos
    
    // Aluguéis
    rentalTenants: [], // Inquilinos
    rentalOwners: [], // Proprietários
    rentalOwnerPayments: [], // Formas de pagamento dos proprietários
    rentalBanks: [], // Bancos cadastrados
    rentalProperties: [], // Imóveis
    rentalContracts: [], // Contratos de aluguel
    rentalContractPayments: [], // Formas de pagamento dos contratos
    rentalPaymentEntries: [] // Lançamentos de pagamentos
};
