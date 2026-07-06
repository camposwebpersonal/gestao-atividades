// lancamentos.js
import { initDailyEntries } from './lancamentos_equipamentos_v2.js?v=20260303100000';
import { initTransportEntries } from './lancamentos_transportes.js?v=20260302010000';
import { initPayrollEntries } from './lancamentos_folha_pagamento.js';
import { initExpenseEntries } from './lancamentos_despesas.js?v=20260302090000';
import { initBmPayments } from './lancamentos_pagamento_bm.js';
import { initDamagesSection } from './lancamentos_avarias.js'; // NOVA IMPORTAÇÃO para Avarias
import { initSandSection } from './lancamentos_areia_v2.js'; // USA VERSÃO REFATORADA

/**
 * Inicializa a seção de Lançamentos.
 * Configura os event listeners para os botões de sub-seção e inicializa a aba padrão.
 */
export const initLancamentos = () => {
    const entrySectionButtons = document.querySelectorAll('#entries-section .report-type-btn');
    const entrySectionContents = document.querySelectorAll('#entries-section .report-content');

    entrySectionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove a classe 'active' de todos os botões e conteúdos
            entrySectionButtons.forEach(b => b.classList.remove('active'));
            entrySectionContents.forEach(rc => rc.style.display = 'none');

            // Adiciona a classe 'active' ao botão clicado e exibe o conteúdo correspondente
            e.target.classList.add('active');
            const subSectionId = e.target.dataset.report;
            const targetContent = document.getElementById(subSectionId);
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // Inicializa a sub-seção correta
            switch (subSectionId) {
                case 'daily-entries-sub':
                    initDailyEntries();
                    break;
                case 'transport-entries-sub':
                    initTransportEntries();
                    break;
                case 'payroll-entries-sub':
                    initPayrollEntries();
                    break;
                case 'expenses-entries-sub':
                    initExpenseEntries();
                    break;
                case 'bm-payments-sub':
                    initBmPayments();
                    break;
                case 'damages-sub': // NOVO CASE para Avarias
                    initDamagesSection(); // Chama a inicialização da seção de avarias
                    break;
                case 'sand-sub': // NOVO CASE para Areia
                    initSandSection(); // Chama a inicialização da seção de areia
                    break;
                default:
                    console.warn(`Sub-seção de lançamento desconhecida: ${subSectionId}`);
            }
        });
    });

    // 🔥 Verificar qual sub-aba estava ativa e reinicializá-la
    const activeButton = document.querySelector('#entries-section .report-type-btn.active');
    if (activeButton) {
        const activeSubSectionId = activeButton.dataset.report;
        console.log('🔄 Reinicializando sub-aba ativa:', activeSubSectionId);
        
        // Reinicializa a sub-aba que estava ativa
        switch (activeSubSectionId) {
            case 'daily-entries-sub':
                initDailyEntries();
                break;
            case 'transport-entries-sub':
                initTransportEntries();
                break;
            case 'payroll-entries-sub':
                initPayrollEntries();
                break;
            case 'expenses-entries-sub':
                initExpenseEntries();
                break;
            case 'bm-payments-sub':
                initBmPayments();
                break;
            case 'damages-sub':
                initDamagesSection();
                break;
            case 'sand-sub':
                initSandSection();
                break;
            default:
                // Se nenhuma estava ativa, inicializa a primeira (Equipamentos)
                initDailyEntries();
        }
    } else {
        // Se nenhuma estava ativa, inicializa a primeira aba (Equipamentos) por padrão
        initDailyEntries();
    }
};
