// cadastros.js - APENAS MENU PRINCIPAL
import { appState } from './appState.js';
import { apiClient } from './api.js';
import { initCrudMinhasEmpresas } from './cadastros_minhas_empresas.js';
import { initCrudEquipamentos } from './cadastros_equipamentos.js';
import { initCrudEmpresasClientes } from './cadastros_empresas_clientes.js';
import { initCrudTerceirizados } from './cadastros_terceirizados.js';
import { initCrudFuncionarios } from './cadastros_funcionarios.js';
import { initCrudTiposParadas } from './cadastros_tipos_paradas.js';
import { initCrudTiposMaterial } from './cadastros_tipos_material.js';
import { initCrudEquipmentTypes } from './cadastros_tipos_equipamentos.js';

const genericCrudContainer = document.getElementById('generic-crud-container');

/**
 * Renderiza o menu principal de seleção de CRUDs genéricos.
 */
export const renderCrudMenu = () => {
    if (!genericCrudContainer) {
        console.error('Elemento #generic-crud-container não encontrado.');
        return;
    }
    
    // Menu com TODOS os cadastros modularizados
    genericCrudContainer.innerHTML = `
        <div class="section-header"><h2>Gerenciar Cadastros</h2></div>
        <p>Selecione o tipo de cadastro que deseja gerenciar:</p>
        <div class="form-grid">
            <button class="btn btn-primary" data-crud-key="my_companies">Minhas Empresas</button>
            <button class="btn btn-primary" data-crud-key="client_companies">Empresas Clientes</button>
            <button class="btn btn-primary" data-crud-key="terceirizados">Empresas Terceirizadas</button>
            <button class="btn btn-primary" data-crud-key="equipment_types">🛠️ Tipos de Equipamentos</button>
            <button class="btn btn-primary" data-crud-key="equipment">Equipamentos</button>
            <button class="btn btn-primary" data-crud-key="employees">Funcionários</button>
            <button class="btn btn-primary" data-crud-key="stoppage_types">Tipos de Parada</button>
            <button class="btn btn-primary" data-crud-key="material_types">Tipos de Material</button>
        </div>
    `;
    
    genericCrudContainer.querySelectorAll('[data-crud-key]').forEach(button => {
        button.addEventListener('click', (e) => {
            const crudKey = e.target.dataset.crudKey;
            
            // Todos os cadastros agora chamam módulos específicos
            switch (crudKey) {
                case 'my_companies':
                    initCrudMinhasEmpresas('my_companies');
                    break;
                case 'client_companies':
                    initCrudEmpresasClientes('client_companies');
                    break;
                case 'terceirizados':
                    initCrudTerceirizados('terceirizados');
                    break;
                case 'equipment_types':
                    initCrudEquipmentTypes('equipment_types');
                    break;
                case 'equipment':
                    initCrudEquipamentos('equipment');
                    break;
                case 'employees':
                    initCrudFuncionarios('employees');
                    break;
                case 'stoppage_types':
                    initCrudTiposParadas('stoppage_types');
                    break;
                case 'material_types':
                    initCrudTiposMaterial('material_types');
                    break;
                default:
                    console.warn(`Cadastro não encontrado: ${crudKey}`);
            }
        });
    });
};

/**
 * Carrega dados de uma tabela específica e os armazena no appState.
 * @param {string} key - A chave no appState onde os dados serão armazenados.
 * @returns {Promise<void>}
 */
export const loadCrudDataIntoState = async (key) => {
    if (appState[key] && appState[key].length > 0) return;

    // Mapeamento de tabelas
    const tableMap = {
        'my_companies': 'my_companies',
        'client_companies': 'client_companies',
        'terceirizados': 'terceirizados',
        'equipment': 'equipment',
        'employees': 'employees',
        'stoppage_types': 'stoppage_types',
        'material_types': 'material_types'
    };

    const tableName = tableMap[key];
    if (!tableName) {
        console.warn(`Tabela para a chave "${key}" não encontrada.`);
        return;
    }

    try {
        const data = await apiClient.fetchData(tableName);
        appState[key] = data;
    } catch (e) {
        console.error(`Falha ao carregar dados para ${key}:`, e);
    }
};