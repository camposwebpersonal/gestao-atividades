// relatorios.js - VERSÃO ATUALIZADA
import { appState } from './appState.js';
import { apiClient } from './api.js';
import { initMeasurementReport } from './relatorios_medicao.js?v=20260302090000';
import { initTransportReport } from './relatorios_transporte.js?v=20260302070000';
import { initPayrollReport } from './relatorios_folha_pagamento.js?v=20260302030000';
import { initExpenseReport } from './relatorios_despesas.js?v=20260302090000';
import { initMaintenanceReport } from './relatorios_revisoes.js?v=20260302030000';
import { initThirdPartyMeasurementReport } from './relatorios_medicao_terceirizados.js?v=20260302090000';
import { initDailyPartsReport } from './relatorios_partes_diarias.js?v=20260302030000';
import { initSummaryMeasurementsReport } from './relatorios_resumo_medicoes.js?v=20260302090000';

// REMOVIDO: import { initDamagesByWorkReport } from './lancamentos_avarias.js'; // Relatório de Avarias por Obra
import { initSandInvoicesReport } from './lancamentos_areia.js?v=20260219150000'; // Relatório de Notas Fiscais de Areia
import { initSandLatestPricesReport } from './lancamentos_areia.js?v=20260219150000'; // Relatório de Últimos Preços de Areia

import { showSpinner, hideSpinner } from './utils.js';

/**
 * Inicializa a seção de Relatórios.
 * Configura os event listeners para os botões de sub-seção e inicializa a aba padrão.
 */
export const initRelatorios = async () => {
    showSpinner();
    try {
        // Garante que os dados básicos estejam carregados para popular os dropdowns de obra
        if (appState.works.length === 0) {
            appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
        }
        if (appState.my_companies.length === 0) {
            appState.my_companies = await apiClient.fetchData('my_companies');
        }
        if (appState.terceirizados.length === 0) {
            appState.terceirizados = await apiClient.fetchData('terceirizados');
        }
        if (appState.equipment.length === 0) { // Garante que equipamentos estejam carregados
            appState.equipment = await apiClient.fetchData('equipment', '*, my_companies(name)');
        }
        if (appState.client_companies.length === 0) { // Garante que empresas cliente estejam carregadas
            appState.client_companies = await apiClient.fetchData('client_companies');
        }
        
        // CORREÇÃO: Garante que os pagamentos de BM estejam sempre carregados e atualizados
        appState.bm_payments = await apiClient.fetchData('bm_payments');

        const reportSectionButtons = document.querySelectorAll('#reports-section .report-type-btn');
        const reportSectionContents = document.querySelectorAll('#reports-section .report-content');

        // Popula todos os dropdowns de obra nos relatórios
        const workSelects = document.querySelectorAll('[id$="-work-select"]');
        workSelects.forEach(select => {
            select.innerHTML = '<option value="">Selecione uma obra</option>' + 
                appState.works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        });

        reportSectionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove a classe 'active' de todos os botões e conteúdos
                reportSectionButtons.forEach(b => b.classList.remove('active'));
                reportSectionContents.forEach(rc => rc.style.display = 'none');

                // Adiciona a classe 'active' ao botão clicado e exibe o conteúdo correspondente
                e.target.classList.add('active');
                const subSectionId = e.target.dataset.report;
                const targetContent = document.getElementById(`${subSectionId}-report-section`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                }

                // Inicializa a sub-seção de relatório correta
                switch (subSectionId) {
                    case 'measurement':
                        initMeasurementReport();
                        break;
                    case 'measurement-terceirizados':
                        initThirdPartyMeasurementReport();
                        break;
                    case 'daily-parts':
                        initDailyPartsReport();
                        break;
                    case 'summary-measurements':
                        initSummaryMeasurementsReport();
                        break;
                    case 'transport':
                        initTransportReport();
                        break;
                    case 'payroll':
                        initPayrollReport();
                        break;
                    case 'expenses':
                        initExpenseReport();
                        break;
                    case 'maintenance':
                        initMaintenanceReport();
                        break;
                    case 'damages-by-work': // NOVO: Relatório de Avarias por Obra
                        // REMOVIDO: initDamagesByWorkReport(); // Esta função é inicializada pela seção de Avarias
                        // Não é necessário chamar nada aqui, pois a seção de Avarias (se ativa)
                        // já cuidará da exibição de seus próprios sub-relatórios.
                        break;
                    case 'sand-invoices': // NOVO: Relatório de Notas Fiscais de Areia
                        initSandInvoicesReport();
                        break;
                    case 'sand-latest-prices': // NOVO: Relatório de Últimos Preços de Areia
                        initSandLatestPricesReport();
                        break;
                    default:
                        console.warn(`Sub-seção de relatório desconhecida: ${subSectionId}`);
                }
            });
        });

        // Força a inicialização da primeira aba por padrão
        const firstButton = reportSectionButtons[0];
        if (firstButton) {
            firstButton.classList.add('active');
            const firstContentId = `${firstButton.dataset.report}-report-section`;
            const firstContent = document.getElementById(firstContentId);
            if (firstContent) {
                firstContent.style.display = 'block';
            }
            initMeasurementReport();
        }
        
    } catch (error) {
        console.error("Erro ao inicializar relatórios:", error);
        alert(`Erro ao carregar dados dos relatórios: ${error.message}`);
    } finally {
        hideSpinner();
    }
};