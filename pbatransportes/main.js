// main.js
import { initUIElements, initGlobalFlatpickr } from './utils.js';
import { initHomeReport } from './home_report.js?v=20260302090000'; // Importa o novo módulo do relatório da Home
import { renderCrudMenu } from './cadastros.js';
import { initObras } from './obras.js?v=20260302090000';
import { initLancamentos } from './lancamentos.js?v=20260303100000'; // Assumindo que 'lancamentos.js' é o ponto de entrada principal para a seção de lançamentos
import { initRelatorios } from './relatorios.js?v=20260302090000'; // Assumindo que 'relatorios.js' é o ponto de entrada principal para a seção de relatórios
import { initProposalsSection } from './proposals.js';
import { initDamagesSection } from './lancamentos_avarias.js?v=20260302090000';
import { initSandSection } from './lancamentos_areia_v2.js?v=20260223340000';
import { initRentalTenantsTab, initRentalOwnersTab, initRentalPropertiesTab, initRentalContractsTab } from './alugueis.js';

document.addEventListener('DOMContentLoaded', async () => { // Adicionado 'async' aqui
    // --- ELEMENTOS DO DOM ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('main section');
    const modal = document.getElementById('generic-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.close-button');
    const spinner = document.getElementById('spinner-overlay');
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');

    // Inicializa os elementos da UI no módulo utils
    initUIElements(spinner, modal, modalTitle, modalBody, closeModalBtn);

    // Altera o locale para pt-BR para formatos de data
    try {
        new Date().toLocaleDateString('pt-BR');
    } catch (e) {
        console.warn("Locale 'pt-BR' not supported, using default.");
    }

    // --- FUNÇÕES DE CONTROLE DA UI (locais para main.js) ---
    const showSection = async (sectionId) => { // Adicionado 'async' aqui
        sections.forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });
        if (mainNav) mainNav.classList.remove('nav-open'); // Fecha o menu móvel ao trocar de seção

        // Chama a função de inicialização específica para cada seção
        // Garante que a inicialização da seção ocorra APENAS quando a seção é ativada
        switch (sectionId) {
            case 'home-section':
                await initHomeReport(); // Chama a nova função de inicialização do relatório da Home
                break;
            case 'cadastros-section':
                renderCrudMenu();
                break;
            case 'works-section':
                initObras();
                break;
            case 'entries-section':
                initLancamentos();
                break;
            case 'proposals-section':
                await initProposalsSection();
                break;
            case 'damages-section':
                await initDamagesSection();
                break;
            case 'sand-section':
                await initSandSection();
                break;
            case 'rentals-section':
                await initRentalsSection();
                break;
            case 'reports-section':
                initRelatorios();
                break;
            default:
                console.warn(`Seção desconhecida: ${sectionId}`);
        }
    };

    // Função para inicializar a seção de aluguéis
    async function initRentalsSection() {
        console.log('🏠 Inicializando seção de Aluguéis');
        
        // Configurar navegação entre sub-abas
        const rentalTabs = document.querySelectorAll('[data-rental-tab]');
        const rentalContents = document.querySelectorAll('#rentals-section .report-content');
        
        rentalTabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                // Remove active de todos
                rentalTabs.forEach(t => t.classList.remove('active'));
                rentalContents.forEach(c => c.classList.remove('active'));
                
                // Ativa o clicado
                e.target.classList.add('active');
                const tabId = e.target.dataset.rentalTab;
                const content = document.getElementById(tabId);
                if (content) {
                    content.classList.add('active');
                    
                    // Inicializa a aba específica
                    switch(tabId) {
                        case 'rental-tenants-sub':
                            await initRentalTenantsTab();
                            break;
                        case 'rental-owners-sub':
                            await initRentalOwnersTab();
                            break;
                        case 'rental-banks-sub':
                            await initRentalBanksTab();
                            break;
                        case 'rental-properties-sub':
                            await initRentalPropertiesTab();
                            break;
                        case 'rental-contracts-sub':
                            await initRentalContractsTab();
                            break;
                        case 'rental-payments-sub':
                            await initRentalPaymentsTab();
                            break;
                        case 'rental-reports-sub':
                            await initRentalReportsTab();
                            break;
                    }
                }
            });
        });
        
        // Inicializa a primeira aba (Inquilinos) por padrão
        await initRentalTenantsTab();
    }

    // --- INICIALIZAÇÃO E NAVEGAÇÃO ---
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('nav-open');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = e.target.dataset.section;
            await showSection(sectionId); // Aguarda a exibição e inicialização da seção
        });
    });

    // --- FLATPICKR GLOBAL: DD/MM/YYYY em todos os inputs de data ---
    // Aplica imediatamente nos inputs estáticos e observa novos inputs dinâmicos
    let _fpTimer;
    new MutationObserver(() => {
        clearTimeout(_fpTimer);
        _fpTimer = setTimeout(initGlobalFlatpickr, 80);
    }).observe(document.body, { childList: true, subtree: true });

    // --- INICIA A APLICAÇÃO ---
    // Exibe a seção inicial e a inicializa
    await showSection('home-section'); // Garante que a home seja inicializada ao carregar
    setTimeout(initGlobalFlatpickr, 200); // Aplica em inputs já presentes após carregamento
});
