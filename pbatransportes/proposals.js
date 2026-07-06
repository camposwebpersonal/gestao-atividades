// proposals.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner } from './utils.js';
import { apiClient } from './api.js';
import { initEquipmentProposals } from './proposals_equipment.js';
import { initSandProposals } from './proposals_sand.js';

const proposalsSection = document.getElementById('proposals-section');

/**
 * Inicializa a seção de Propostas.
 * Carrega os dados iniciais e configura os event listeners.
 */
export const initProposalsSection = async () => {
    showSpinner();

    // Carregar dados necessários para os dropdowns
    if (appState.client_companies.length === 0) {
        appState.client_companies = await apiClient.fetchData('client_companies');
    }
    if (appState.my_companies.length === 0) {
        appState.my_companies = await apiClient.fetchData('my_companies');
    }
    if (appState.equipment.length === 0) {
        appState.equipment = await apiClient.fetchData('equipment');
    }

    // Configurar event listeners para a navegação entre sub-abas
    proposalsSection.querySelectorAll('.report-type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const proposalType = e.target.dataset.proposal;
            proposalsSection.querySelectorAll('.report-type-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            proposalsSection.querySelectorAll('.report-content').forEach(content => content.style.display = 'none');
            document.getElementById(proposalType).style.display = 'block';
            
            // Carregar dados específicos da sub-aba
            if (proposalType === 'equipment-proposals-sub') {
                initEquipmentProposals();
            } else if (proposalType === 'sand-proposals-sub') {
                initSandProposals();
            }
        });
    });

    // Inicializar as sub-seções
    await initEquipmentProposals();
    await initSandProposals();

    hideSpinner();
};