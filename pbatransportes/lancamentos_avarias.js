// lancamentos_avarias.js - Módulo para Lançamentos de Avarias
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency, formatInputDate, getBMLabelForDate, generatePDFFileName, extractReportInfo, formatMonthYear, getReferenceMes, getDateRangeFormatted, createConfirmationModal, addPdfCoverPage, openModal, closeModal, getEquipTypeName } from './utils.js';
import { apiClient } from './api.js'; // LINHA CORRIGIDA: '=' trocado por 'from'
import { calculateGeneralExpensesImpact, EXPENSE_IMPACT_TYPES } from './calculos_valores.js?v=20260302090000';

// Elementos do DOM para a seção de Lançamentos de Avarias
const damagesSection = document.getElementById('damages-section');
const damageWorkSelect = document.getElementById('damage-work-select');
const damageEquipmentSelect = document.getElementById('damage-equipment-select');
const damageEquipmentWorkPrefixInput = document.getElementById('damage-equipment-work-prefix');
const damageCustomIdInput = document.getElementById('damage-custom-id'); // NOVO CAMPO
const damageImageCountInput = document.getElementById('damage-image-count');
const damageAttachmentCountInput = document.getElementById('damage-attachment-count'); // NOVO CAMPO: Quantidade de Anexos
const damageDateInput = document.getElementById('damage-date');
const damageClientImpactTypeSelect = document.getElementById('damage-client-impact-type');
const damageTerceirizadoImpactTypeSelect = document.getElementById('damage-terceirizado-impact-type'); // LINHA CORRIGIDA
const damageObservationsTextarea = document.getElementById('damage-observations');
const damageImageDescriptionsContainer = document.getElementById('damage-image-descriptions-container');
const saveDamageBtn = document.getElementById('save-damage-btn');
const cancelEditDamageBtn = document.getElementById('cancel-edit-damage-btn');
const damagesTableBody = document.querySelector('#damages-table tbody');
const damageDirectValueInput = document.getElementById('damage-direct-value');
const damageValueDescriptionInput = document.getElementById('damage-value-description');
const damageUseDirectValueCheckbox = document.getElementById('damage-use-direct-value');

// Elementos do DOM para campos de email
const damageEmailFieldsContainer = document.getElementById('damage-email-fields');
const damageEmailRecipientsInput = document.getElementById('damage-email-recipients');
const damageEmailCcInput = document.getElementById('damage-email-cc');
const damageEmailBccInput = document.getElementById('damage-email-bcc');

// Elementos do DOM para a sub-seção de Relatório de Avarias por Obra
const damagesReportWorkSelect = document.getElementById('damages-report-work-select');
const damagesReportBmSelect = document.getElementById('damages-report-bm-select');
const damagesReportStartDate = document.getElementById('damages-report-start-date');
const damagesReportEndDate = document.getElementById('damages-report-end-date');
const generateDamagesReportBtn = document.getElementById('generate-damages-report-btn');
const exportDamagesPdfBtn = document.getElementById('export-damages-pdf-btn');
const damagesReportOutput = document.getElementById('damages-report-output');
const damagesReportCoverCheckbox = document.getElementById('damages-report-cover-checkbox');

// Variável para controle de edição
let editingDamageId = null;

// URL da imagem de assinatura de e-mail
const EMAIL_SIGNATURE_IMAGE_URL = "https://res.cloudinary.com/ddobrlzep/image/upload/mailsign/mailsign.jpg";

// URL DO SEU SCRIPT PHP NO HOSTGATOR (AGORA COM O CAMINHO CORRETO!)
// Exemplo: "https://pbatransportes.com.br/proj/send_email.php"
const PHP_BACKEND_EMAIL_URL = "https://pbatransportes.com.br/proj/send_email.php"; 

// ====================================================================
// NOVAS FUNÇÕES PARA CÓDIGO PERSONALIZADO
// ====================================================================

/**
 * Busca o próximo código de avaria disponível
 * Esta função é crucial quando o ID não é auto-incrementado pelo DB.
 */
const getNextDamageCode = async () => {
    try {
        console.log('🔍 Buscando próximo código de avaria...');
        
        // Sempre recarrega as avarias do servidor para ter dados atualizados
        let allDamages = [];
        try {
            if (typeof apiClient.fetchDamages === 'function') {
                allDamages = await apiClient.fetchDamages();
            } else if (typeof apiClient.fetchItems === 'function') {
                allDamages = await apiClient.fetchItems('damages');
            } else {
                console.warn('⚠️ Nenhum método de busca de avarias encontrado');
                allDamages = [];
            }
        } catch (fetchError) {
            console.warn('⚠️ Erro ao buscar avarias do servidor:', fetchError);
            allDamages = appState.damages || [];
        }
        
        console.log('📊 Total de avarias encontradas:', allDamages.length);
        
        // Extrai e valida todos os IDs
        const validIds = [];
        allDamages.forEach(damage => {
            const id = damage.id;
            const numericId = parseInt(id);
            
            // Só aceita IDs que são números válidos e maiores que 0
            if (!isNaN(numericId) && numericId > 0) {
                validIds.push(numericId);
            } else {
                console.warn(`⚠️ ID inválido encontrado: "${id}" (tipo: ${typeof id})`);
            }
        });
        
        console.log('✅ IDs válidos encontrados:', validIds.sort((a, b) => a - b));
        
        // Calcula o próximo ID
        const maxId = validIds.length > 0 ? Math.max(...validIds) : 0;
        const nextId = maxId + 1;
        
        console.log(`📈 Maior ID atual: ${maxId}, Próximo ID: ${nextId}`);
        
        // Validação final de segurança
        if (nextId <= 0) {
            console.error('❌ ID calculado é inválido!');
            return 1; // Força ID 1 como fallback
        }
        
        return nextId;
        
    } catch (error) {
        console.error('❌ Erro crítico ao buscar próximo código:', error);
        
        // Fallback de emergência: usar timestamp
        const timestamp = Date.now().toString();
        const emergencyId = parseInt(timestamp.slice(-6)); // Últimos 6 dígitos do timestamp
        
        console.warn(`🚨 Usando ID de emergência baseado em timestamp: ${emergencyId}`);
        return emergencyId;
    }
};

/**
 * Atualiza o preview do próximo código
 */
const updateNextCodePreview = async () => {
    try {
        const nextCode = await getNextDamageCode();
        const previewElement = document.getElementById('next-code-preview');
        if (previewElement) {
            previewElement.textContent = nextCode > 0 ? nextCode : 'Erro';
        }
        console.log('Preview atualizado para:', nextCode);
    } catch (error) {
        console.error('Erro ao atualizar preview:', error);
        const previewElement = document.getElementById('next-code-preview');
        if (previewElement) {
            previewElement.textContent = 'Erro';
        }
    }
};

/**
 * Valida se o código personalizado já existe
 */
const validateCustomCode = async (customId) => {
    if (!customId || customId.trim() === '') {
        return { valid: true };
    }
    
    const numericId = parseInt(customId.trim());
    
    // Validações básicas
    if (isNaN(numericId)) {
        return {
            valid: false,
            message: 'O código deve ser um número!'
        };
    }
    
    if (numericId <= 0) {
        return {
            valid: false,
            message: 'O código deve ser um número positivo!'
        };
    }

    try {
        console.log(`🔍 Validando código personalizado: ${numericId}`);
        
        // Busca avarias atuais
        let allDamages = [];
        try {
            if (typeof apiClient.fetchDamages === 'function') {
                allDamages = await apiClient.fetchDamages();
            } else if (typeof apiClient.fetchItems === 'function') {
                allDamages = await apiClient.fetchItems('damages');
            } else {
                allDamages = appState.damages || [];
            }
        } catch (fetchError) {
            console.warn('⚠️ Erro ao buscar avarias para validação:', fetchError);
            allDamages = appState.damages || [];
        }
        
        // Verifica se o ID já existe
        const exists = allDamages.some(damage => {
            const existingId = parseInt(damage.id);
            return existingId === numericId;
        });
        
        console.log(`${exists ? '❌' : '✅'} Código ${numericId} ${exists ? 'JÁ EXISTE' : 'disponível'}`);
        
        return {
            valid: !exists,
            message: exists ? `Código ${numericId} já está em uso!` : ''
        };
        
    } catch (error) {
        console.error('❌ Erro ao validar código:', error);
        return { 
            valid: false, 
            message: 'Erro ao validar código. Tente novamente.' 
        };
    }
};

// ====================================================================
// Funções Auxiliares (Definidas antes do uso)
// ====================================================================

/**
 * Reseta o formulário de avaria.
 */
const resetDamageForm = () => {
    editingDamageId = null;
    
    if (damageWorkSelect) damageWorkSelect.value = '';
    if (damageEquipmentSelect) damageEquipmentSelect.value = '';
    if (damageEquipmentWorkPrefixInput) damageEquipmentWorkPrefixInput.value = '';

    // Reset do campo de código personalizado
    if (damageCustomIdInput) {
        damageCustomIdInput.value = '';
        damageCustomIdInput.disabled = false;
        damageCustomIdInput.placeholder = 'Deixe vazio para auto-gerar';
        damageCustomIdInput.style.borderColor = '';
        damageCustomIdInput.title = '';
    }

    // NOVO: Reset dos campos de valor direto
    if (damageDirectValueInput) damageDirectValueInput.value = '0';
    if (damageValueDescriptionInput) damageValueDescriptionInput.value = '';
    if (damageUseDirectValueCheckbox) damageUseDirectValueCheckbox.checked = true;

    if (damageImageCountInput) damageImageCountInput.value = '0';
    if (damageAttachmentCountInput) damageAttachmentCountInput.value = '0'; // NOVO: Reset do campo de anexos
    if (damageDateInput) damageDateInput.value = new Date().toISOString().split('T')[0];
    // PADRÃO: "add_client" (Acréscimo ao cliente) - 100% dos casos
    if (damageClientImpactTypeSelect) damageClientImpactTypeSelect.value = 'add_client';
    if (damageTerceirizadoImpactTypeSelect) damageTerceirizadoImpactTypeSelect.value = 'none';
    if (damageObservationsTextarea) damageObservationsTextarea.value = '';
    if (damageImageDescriptionsContainer) damageImageDescriptionsContainer.innerHTML = '';

    // Reset dos campos de email
    if (damageEmailFieldsContainer) damageEmailFieldsContainer.style.display = 'none';
    if (damageEmailRecipientsInput) damageEmailRecipientsInput.value = '';
    if (damageEmailCcInput) damageEmailCcInput.value = '';
    if (damageEmailBccInput) damageEmailBccInput.value = '';

    if (saveDamageBtn) {
        saveDamageBtn.textContent = 'Salvar Avaria';
        saveDamageBtn.classList.remove('btn-warning');
        saveDamageBtn.classList.add('btn-primary');
    }
    
    if (cancelEditDamageBtn) {
        cancelEditDamageBtn.style.display = 'none';
    }

    handleDamageWorkSelectChange();
    updateDamageImpactOptions();
    updateNextCodePreview();
};

/**
 * Cancela a edição e reseta o formulário.
 */
const cancelEditDamageEntry = () => {
    editingDamageId = null;
    saveDamageBtn.textContent = 'Salvar Avaria';
    saveDamageBtn.classList.remove('btn-warning');
    saveDamageBtn.classList.add('btn-primary');
    cancelEditDamageBtn.style.display = 'none';
    resetDamageForm();
};

/**
 * Atualiza a URL automática de uma imagem.
 */
const updateImageUrl = (index, damageId = editingDamageId) => {
    const urlInput = damageImageDescriptionsContainer.querySelector(`.image-url-auto-input[data-image-index="${index}"]`);
    if (urlInput) {
        const currentDamageId = damageId || '';
        const timestamp = new Date().getTime();
        urlInput.value = `https://res.cloudinary.com/ddobrlzep/image/upload/AVAR/AV${currentDamageId}IMG${index}.jpg?t=${timestamp}`;
    }
};

/**
 * Gera os campos de descrição de imagem com base na quantidade informada.
 */
const generateImageDescriptionFields = () => {
    const count = parseInt(damageImageCountInput.value) || 0;
    damageImageDescriptionsContainer.innerHTML = '';

    for (let i = 1; i <= count; i++) {
        const fieldGroup = document.createElement('div');
        fieldGroup.classList.add('form-grid');
        fieldGroup.style.cssText = 'grid-template-columns: 1fr 2fr; align-items: end; margin-bottom: 10px;';
        fieldGroup.innerHTML = `
            <div class="form-group">
                <label>Descrição Imagem ${i}</label>
                <input type="text" class="image-description-input" data-image-index="${i}" placeholder="Descrição da imagem ${i}">
            </div>
            <div class="form-group">
                <label>URL Imagem ${i} (Automática)</label>
                <input type="text" class="image-url-auto-input" data-image-index="${i}" readonly style="background-color: #e9ecef;">
            </div>
        `;
        damageImageDescriptionsContainer.appendChild(fieldGroup);
        updateImageUrl(i);

        fieldGroup.querySelector(`.image-description-input[data-image-index="${i}"]`)
            .addEventListener('input', () => updateImageUrl(i));
    }
};

/**
 * Lida com a mudança na seleção da obra para avarias.
 */
const handleDamageWorkSelectChange = () => {
    const workId = damageWorkSelect.value;
    const work = appState.works.find(w => w.id == workId);

    // Mostrar/ocultar campos de email
    if (workId && damageEmailFieldsContainer) {
        damageEmailFieldsContainer.style.display = 'block';
        
        // Carregar emails da configuração da obra
        if (work && work.config) {
            if (damageEmailRecipientsInput && work.config.responsible_emails && work.config.responsible_emails.length > 0) {
                damageEmailRecipientsInput.value = work.config.responsible_emails.join(', ');
            }
            if (damageEmailCcInput && work.config.cc_emails && work.config.cc_emails.length > 0) {
                damageEmailCcInput.value = work.config.cc_emails.join(', ');
            }
            if (damageEmailBccInput && work.config.bcc_emails && work.config.bcc_emails.length > 0) {
                damageEmailBccInput.value = work.config.bcc_emails.join(', ');
            }
        }
    } else if (damageEmailFieldsContainer) {
        damageEmailFieldsContainer.style.display = 'none';
        // Limpar campos
        if (damageEmailRecipientsInput) damageEmailRecipientsInput.value = '';
        if (damageEmailCcInput) damageEmailCcInput.value = '';
        if (damageEmailBccInput) damageEmailBccInput.value = '';
    }

    // Obtém o prefixo da obra da configuração do equipamento se existir
    const equipmentId = damageEquipmentSelect.value;
    const workEquipmentConfig = work?.config?.equipment?.find(e => e.equipment_id == equipmentId);
    damageEquipmentWorkPrefixInput.value = workEquipmentConfig?.equipment_work_prefix || '';

    if (damageEquipmentSelect) {
        let filteredEquipment = [];
        if (workId) {
            const equipmentInWork = work?.config?.equipment || [];
            // Filtra equipamentos que existem no appState.equipment e mapeia para os detalhes completos
            filteredEquipment = equipmentInWork
                .map(ec => appState.equipment.find(e => e.id === parseInt(ec.equipment_id)))
                .filter(equip => equip !== undefined); // Remove nulos se o equipamento não for encontrado
        } else {
            filteredEquipment = appState.equipment;
        }

        // Ordenar equipamentos por tipo e depois por prefixo
        const sortedEquipment = [...filteredEquipment].sort((a, b) => {
            const typeA = a.type ? a.type.toUpperCase() : '';
            const typeB = b.type ? b.type.toUpperCase() : '';
            if (typeA < typeB) return -1;
            if (typeA > typeB) return 1;

            const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
            const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
            if (prefixA < prefixB) return -1;
            if (prefixA > prefixB) return 1;
            return 0;
        });

        // Mapeia para o formato de exibição desejado
        const equipmentOptions = sortedEquipment.map(e => {
            // Formato do nome no combobox: TIPO - PREFIXO - MARCA - MODELO - ANO - CARACTERÍSTICA - CAPACIDADE
            const parts = [
                getEquipTypeName(e.type),
                e.prefix,
                e.brand,
                e.model,
                e.year,
                e.characteristic,
                e.capacidade
            ].filter(Boolean); // Remove valores nulos/vazios

            const displayText = parts.join(' - ');
            return `<option value="${e.id}">${displayText}</option>`;
        }).join('');

        damageEquipmentSelect.innerHTML = '<option value="">Selecione...</option>' + equipmentOptions;
    }
    updateDamageImpactOptions();
};

/**
 * Lida com a mudança na seleção do equipamento para avarias.
 * Atualiza o campo "Prefixo Obra (Automático)" com base no equipamento selecionado e na obra.
 */
const handleDamageEquipmentSelectChange = () => {
    const workId = damageWorkSelect.value;
    const equipmentId = damageEquipmentSelect.value;
    
    const work = appState.works.find(w => w.id == workId);
    const workEquipmentConfig = work?.config?.equipment?.find(e => e.equipment_id == equipmentId);
    
    if (damageEquipmentWorkPrefixInput) {
        damageEquipmentWorkPrefixInput.value = workEquipmentConfig?.equipment_work_prefix || '';
    }
    updateDamageImpactOptions();
};

/**
 * Atualiza as opções dos comboboxes de impacto na medição.
 */
const updateDamageImpactOptions = () => {
    const workId = damageWorkSelect.value;
    const equipmentId = damageEquipmentSelect.value;
    const selectedEquipment = appState.equipment.find(e => e.id == equipmentId);

    let clientOptionsHtml = `
        <option value="add_client">Acréscimo</option>
        <option value="disc_client">Desconto</option>
        <option value="none" selected>Nenhum</option>
    `;
    damageClientImpactTypeSelect.innerHTML = clientOptionsHtml;

    let terceirizadoOptionsHtml = `<option value="none" selected>Nenhum</option>`;
    if (selectedEquipment && selectedEquipment.is_terceirizado) {
        terceirizadoOptionsHtml += `
            <option value="add_terceirizado">Acréscimo</option>
            <option value="disc_terceirizado">Desconto</option>
        `;
    }
    damageTerceirizadoImpactTypeSelect.innerHTML = terceirizadoOptionsHtml;
};

/**
 * Carrega e renderiza as avarias na tabela.
 */
const loadAndRenderDamages = async () => {
    showSpinner();
    try {
        let damages = [];

        try {
            if (typeof apiClient.fetchDamages === 'function') {
                damages = await apiClient.fetchDamages();
            } else if (typeof apiClient.fetchItems === 'function') {
                damages = await apiClient.fetchItems('damages');
            } else {
                console.warn('Método de busca de avarias não encontrado em apiClient. Tentando alternativas...');
                try {
                    if (typeof apiClient.fetchData === 'function') {
                        damages = await apiClient.fetchData('damages');
                    } else if (typeof apiClient.getItems === 'function') {
                        damages = await apiClient.getItems('damages');
                    } else if (typeof apiClient.select === 'function') {
                        damages = await apiClient.select('damages', '*');
                    } else {
                        throw new Error('Nenhum método válido para buscar avarias encontrado.');
                    }
                } catch (fallbackError) {
                    console.error('Falha em todas as tentativas de buscar avarias:', fallbackError);
                    throw fallbackError; // Re-lança o erro para ser pego pelo catch principal
                }
            }
        } catch (initialFetchError) {
            console.error('Erro inicial ao buscar avarias:', initialFetchError);
            throw initialFetchError;
        }

        damages = Array.isArray(damages) ? damages : (damages ? [damages] : []);

        if (damages.length > 0) {
            damages = await enrichDamagesData(damages);
        }

        appState.damages = damages;
        renderDamagesTable();

        console.log(`Carregadas ${damages.length} avarias com sucesso`);

    } catch (error) {
        console.error('Erro ao carregar avarias:', error);
        alert(`Erro ao carregar avarias: ${error.message}`);
        appState.damages = [];
        renderDamagesTable();
    } finally {
        hideSpinner();
    }
};

/**
 * Enriquece os dados das avarias com informações relacionadas.
 */
const enrichDamagesData = async (damages) => {
    try {
        const enrichedDamages = damages.map(damage => {
            // Garante que work e equipment sejam objetos
            const work = damage.work || appState.works?.find(w => w.id == damage.work_id) || {};
            if (work) {
                damage.work = work;
            }

            const equipment = damage.equipment || appState.equipment?.find(e => e.id == damage.equipment_id) || {};
            if (equipment) {
                damage.equipment = equipment;
            }

            // NOVO: Prioriza equipment_work_prefix diretamente da avaria (se for uma coluna direta)
            // Caso contrário, busca da configuração da obra.
            if (damage.equipment_work_prefix === undefined || damage.equipment_work_prefix === null) {
                const workEquipmentConfig = work?.config?.equipment?.find(ec => ec.equipment_id == damage.equipment_id);
                damage.equipment_work_prefix = workEquipmentConfig?.equipment_work_prefix || '';
            } else {
                // Garante que seja uma string, mesmo que venha do DB como null
                damage.equipment_work_prefix = damage.equipment_work_prefix || '';
            }

            // Garante que total_value seja um número
            damage.total_value = parseFloat(damage.total_value) || 0;
            // Garante que email_sent_count seja um número
            damage.email_sent_count = parseInt(damage.email_sent_count) || 0;
            // Garante que attachment_count seja um número
            damage.attachment_count = parseInt(damage.attachment_count) || 0; // NOVO: Campo de anexos

            return damage;
        });

        return enrichedDamages;
    } catch (error) {
        console.warn('Erro ao enriquecer dados das avarias:', error);
        return damages;
    }
};

/**
 * Renderiza a tabela de avarias.
 */
const renderDamagesTable = () => {
    if (!damagesTableBody) {
        console.warn('Elemento da tabela de avarias não encontrado');
        return;
    }

    damagesTableBody.innerHTML = '';

    const damages = appState.damages || [];

    if (damages.length === 0) {
        damagesTableBody.innerHTML = '<tr><td colspan="8">Nenhuma avaria cadastrada.</td></tr>';
        return;
    }

    // Ordena por data (mais recente primeiro)
    const sortedDamages = [...damages].sort((a, b) => {
        const dateA = new Date(a.damage_date);
        const dateB = new Date(b.damage_date);
        return dateB - dateA; // Ordem decrescente (mais recente primeiro)
    });

    sortedDamages.forEach(damage => {
        try {
            const work = damage.work || appState.works?.find(w => w.id == damage.work_id) || {};
            const equipment = damage.equipment || appState.equipment?.find(e => e.id == damage.equipment_id) || {};

            const workName = work.name || 'N/A';
            const equipmentName = `${equipment.prefix || 'N/A'} - ${getEquipTypeName(equipment.type) || 'N/A'}`;
            const damageDate = damage.damage_date ? new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
            
            // CORRIGIDO: Garante que total_value seja um número antes de formatar
            const totalValue = formatCurrency(parseFloat(damage.total_value) || 0);
            const observations = damage.observations ? (damage.observations.length > 50 ? damage.observations.substring(0, 50) + '...' : damage.observations) : 'N/A';
            
            // NOVO: Status de envio do email
            const emailStatus = damage.email_sent_count > 0 ? `Enviado ${damage.email_sent_count} vezes` : 'Não Enviado';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${damage.id}</td>
                <td>${workName}</td>
                <td>${equipmentName}</td>
                <td>${damageDate}</td>
                <td>${totalValue}</td>
                <td>${observations}</td>
                <td>${emailStatus}</td> <!-- NOVA CÉLULA -->
                <td>
                    <button class="btn btn-sm btn-secondary edit-damage-btn" data-id="${damage.id}" title="Editar avaria">
                        📝 Editar
                    </button>
                    <button class="btn btn-sm btn-info manage-items-btn" data-id="${damage.id}" title="Gerenciar itens da avaria">
                        📋 Itens
                    </button>
                    <button class="btn btn-sm btn-success generate-pdf-btn" data-id="${damage.id}" title="Gerar PDF da avaria">
                        📄 PDF
                    </button>
                    <button class="btn btn-sm btn-warning generate-budget-btn" data-id="${damage.id}" title="Gerar Orçamento de Pneus">
                        💰 Orçamentos
                    </button>
                    <button class="btn btn-sm btn-primary send-email-btn" data-id="${damage.id}" title="Enviar e-mail com PDF">
                        ✉️ Email
                    </button>
                    <button class="btn btn-sm btn-danger delete-damage-btn" data-id="${damage.id}" title="Excluir avaria">
                        🗑️ Excluir
                    </button>
                </td>
            `;
            damagesTableBody.appendChild(row);
        } catch (renderError) {
            console.error('Erro ao renderizar avaria:', damage, renderError);
        }
    });

    // CORRIGIDO: Event listeners específicos com tratamento completo
    try {
        // Event listeners para botões de Editar
        damagesTableBody.querySelectorAll('.edit-damage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clicou em Editar - Avaria ID:', btn.dataset.id);
                try {
                    editDamageEntry(btn.dataset.id);
                } catch (editError) {
                    console.error('Erro ao editar avaria:', editError);
                    alert('Erro ao editar avaria: ' + editError.message);
                }
            });
        });
        
        // Event listeners para botões de Gerenciar Itens
        damagesTableBody.querySelectorAll('.manage-items-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const damageId = btn.dataset.id;
                console.log('Clicou em Itens - Avaria ID:', damageId);
                try {
                    const damage = appState.damages.find(d => d.id == damageId);
                    if (damage) {
                        openDamageItemsModal(damage);
                    } else {
                        alert('Avaria não encontrada para gerenciar itens.');
                    }
                } catch (itemsError) {
                    console.error('Erro ao gerenciar itens:', itemsError);
                    alert('Erro ao abrir itens da avaria: ' + itemsError.message);
                }
            });
        });

        // NOVO: Event listeners para botões de Gerar PDF
        damagesTableBody.querySelectorAll('.generate-pdf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const damageId = btn.dataset.id;
                console.log('Clicou em Gerar PDF - Avaria ID:', damageId);
                try {
                    const damage = appState.damages.find(d => d.id == damageId);
                    if (damage) {
                        // Abre modal de opções de PDF
                        openPdfOptionsModal(damage);
                    } else {
                        alert('Avaria não encontrada para gerar PDF.');
                    }
                } catch (pdfError) {
                    console.error('Erro ao gerar PDF:', pdfError);
                    alert('Erro ao gerar PDF da avaria: ' + pdfError.message);
                }
            });
        });

        // NOVO: Event listeners para botões de Gerar Orçamento
        damagesTableBody.querySelectorAll('.generate-budget-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const damageId = btn.dataset.id;
                console.log('Clicou em Gerar Orçamento - Avaria ID:', damageId);
                try {
                    const damage = appState.damages.find(d => d.id == damageId);
                    if (damage) {
                        openBudgetModal(damage);
                    } else {
                        alert('Avaria não encontrada para gerar orçamento.');
                    }
                } catch (budgetError) {
                    console.error('Erro ao abrir modal de orçamento:', budgetError);
                    alert('Erro ao abrir orçamento: ' + budgetError.message);
                }
            });
        });

        // NOVO: Event listeners para botões de Enviar Email
        damagesTableBody.querySelectorAll('.send-email-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const damageId = btn.dataset.id;
                console.log('Clicou em Enviar Email - Avaria ID:', damageId);
                try {
                    const damage = appState.damages.find(d => d.id == damageId);
                    if (damage) {
                        await handleSendEmailClick(damage);
                    } else {
                        alert('Avaria não encontrada para enviar e-mail.');
                    }
                } catch (emailError) {
                    console.error('Erro ao preparar e-mail:', emailError);
                    alert('Erro ao preparar e-mail da avaria: ' + emailError.message);
                }
            });
        });
        
        // Event listeners para botões de Excluir
        damagesTableBody.querySelectorAll('.delete-damage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clicou em Excluir - Avaria ID:', btn.dataset.id);
                try {
                    deleteDamageEntry(btn.dataset.id);
                } catch (deleteError) {
                    console.error('Erro ao excluir avaria:', deleteError);
                    alert('Erro ao excluir avaria: ' + deleteError.message);
                }
            });
        });

        console.log('Event listeners adicionados com sucesso para', damages.length, 'avarias');
        
    } catch (eventError) {
        console.error('Erro crítico ao adicionar event listeners:', eventError);
        alert('Erro ao configurar botões da tabela. Recarregue a página.');
    }
};

/**
 * Edita uma avaria existente.
 */
 
const editDamageEntry = (damageId) => {
    console.log('Iniciando edição da avaria:', damageId);
    
    const damage = appState.damages.find(d => d.id == damageId);
    if (!damage) {
        console.error('Avaria não encontrada:', damageId);
        alert('Avaria não encontrada!');
        return;
    }

    console.log('Dados da avaria encontrada:', damage);

    // Preenche os campos do formulário
    if (damageWorkSelect) {
        damageWorkSelect.value = damage.work_id || '';
        console.log('Work ID definido:', damage.work_id);
    }
    
    handleDamageWorkSelectChange(); // Chamar para popular o equipamento correto
    
    if (damageEquipmentSelect) {
        damageEquipmentSelect.value = damage.equipment_id || '';
        console.log('Equipment ID definido:', damage.equipment_id);
    }
    
    handleDamageEquipmentSelectChange(); // Chamar para popular o prefixo da obra do equipamento
    
    if (damageEquipmentWorkPrefixInput) {
        // NOVO: Priorize o prefixo salvo diretamente na avaria
        if (damage.equipment_work_prefix) {
            damageEquipmentWorkPrefixInput.value = damage.equipment_work_prefix;
        } else {
            // Fallback para o prefixo da configuração da obra se não houver um específico na avaria
            const work = appState.works.find(w => w.id == damage.work_id);
            const workEquipmentConfig = work?.config?.equipment?.find(e => e.equipment_id == damage.equipment_id);
            damageEquipmentWorkPrefixInput.value = workEquipmentConfig?.equipment_work_prefix || '';
        }
    }

    // NÃO preenche o campo de código personalizado na edição
    if (damageCustomIdInput) {
        damageCustomIdInput.value = '';
        damageCustomIdInput.disabled = true; // Desabilita na edição
        damageCustomIdInput.placeholder = `Código atual: ${damage.id}`;
    }

    // NOVO: Preenche campos de valor direto, garantindo que seja um número
    if (damageDirectValueInput) {
        damageDirectValueInput.value = parseFloat(damage.total_value) || 0;
        console.log('Valor direto definido:', damage.total_value);
    }
    if (damageValueDescriptionInput) {
        damageValueDescriptionInput.value = damage.value_description || '';
        console.log('Descrição do valor definida:', damage.value_description);
    }
    if (damageUseDirectValueCheckbox) {
        damageUseDirectValueCheckbox.checked = damage.use_direct_value !== false;
        console.log('Use direct value definido:', damage.use_direct_value);
    }

    if (damageImageCountInput) {
        damageImageCountInput.value = damage.image_count || 0;
    }
    // NOVO: Preenche o campo de quantidade de anexos
    if (damageAttachmentCountInput) {
        damageAttachmentCountInput.value = damage.attachment_count || 0;
    }
    
    if (damageDateInput) {
        damageDateInput.value = damage.damage_date;
    }
    
    if (damageClientImpactTypeSelect) {
        damageClientImpactTypeSelect.value = damage.client_impact_type || 'none';
    }
    
    if (damageTerceirizadoImpactTypeSelect) {
        damageTerceirizadoImpactTypeSelect.value = damage.terceirizado_impact_type || 'none';
    }
    
    if (damageObservationsTextarea) {
        damageObservationsTextarea.value = damage.observations || '';
    }

    // Carregar emails da avaria (se existirem), senão carrega da obra
    if (damageEmailFieldsContainer) {
        damageEmailFieldsContainer.style.display = 'block';
    }
    if (damageEmailRecipientsInput) {
        damageEmailRecipientsInput.value = damage.email_recipients || '';
    }
    if (damageEmailCcInput) {
        damageEmailCcInput.value = damage.email_cc || '';
    }
    if (damageEmailBccInput) {
        damageEmailBccInput.value = damage.email_bcc || '';
    }

    // Gera campos de descrição de imagem
    generateImageDescriptionFields();

    // Preenche descrições das imagens se existirem
    if (damage.image_descriptions && damage.image_descriptions.length > 0) {
        damage.image_descriptions.forEach(imgDesc => {
            const input = damageImageDescriptionsContainer.querySelector(`.image-description-input[data-image-index="${imgDesc.index}"]`);
            if (input) {
                input.value = imgDesc.description || '';
                updateImageUrl(imgDesc.index, damage.id);
            }
        });
    }

    // Atualiza estado de edição
    editingDamageId = damageId;
    
    if (saveDamageBtn) {
        saveDamageBtn.textContent = 'Atualizar Avaria';
        saveDamageBtn.classList.remove('btn-primary');
        saveDamageBtn.classList.add('btn-warning');
    }
    
    if (cancelEditDamageBtn) {
        cancelEditDamageBtn.style.display = 'inline-block';
    }

    console.log('Modo de edição ativado para avaria:', damageId);
    
    // Scroll para o formulário
    if (damagesSection) {
        damagesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

/**
 * Exclui uma avaria.
 */
const deleteDamageEntry = async (damageId) => {
    console.log('Iniciando exclusão da avaria:', damageId);
    
    const damage = appState.damages.find(d => d.id == damageId);
    if (!damage) {
        console.error('Avaria não encontrada:', damageId);
        alert('Avaria não encontrada!');
        return;
    }

    // Criar modal de confirmação customizado se não existir a função
    const confirmDelete = () => {
        return new Promise((resolve) => {
            const isConfirmed = confirm(
                `Tem certeza que deseja excluir a avaria ${damageId}?\n\n` +
                `Equipamento: ${damage.equipment?.prefix || 'N/A'} - ${getEquipTypeName(damage.equipment?.type) || 'N/A'}\n` +
                `Data: ${damage.damage_date ? new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}\n\n` +
                `Esta ação não pode ser desfeita!`
            );
            resolve(isConfirmed);
        });
    };

    try {
        const confirmed = await confirmDelete();
        if (!confirmed) {
            console.log('Exclusão cancelada pelo usuário');
            return;
        }

        console.log('Usuário confirmou a exclusão, prosseguindo...');
        showSpinner();

        try {
            if (typeof apiClient.deleteDamage === 'function') {
                console.log('Usando apiClient.deleteDamage');
                await apiClient.deleteDamage(damageId);
            } else if (typeof apiClient.deleteItem === 'function') {
                console.log('Usando apiClient.deleteItem');
                await apiClient.deleteItem('damages', damageId);
            } else {
                throw new Error('Método para excluir avaria não encontrado na API');
            }

            console.log('Avaria excluída com sucesso no servidor');
            alert('Avaria excluída com sucesso!');

            // Recarrega a lista de avarias
            await loadAndRenderDamages();
            
            // Se estava editando esta avaria, reseta o formulário
            if (editingDamageId == damageId) {
                resetDamageForm();
            }

        } catch (error) {
            console.error('Erro ao excluir avaria no servidor:', error);
            alert(`Erro ao excluir avaria: ${error.message}`);
        }

    } catch (error) {
        console.error('Erro geral na exclusão:', error);
        alert(`Erro inesperado ao excluir avaria: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Cria modal de confirmação customizado (fallback se não existir)
 */
const createSimpleConfirmationModal = (callback, message, confirmText = 'Confirmar') => {
    const modalHtml = `
        <div style="text-align: center; padding: 20px;">
            <p style="margin-bottom: 20px; font-size: 16px;">${message}</p>
            <button id="confirm-action-btn" class="btn btn-danger" style="margin-right: 10px;">${confirmText}</button>
            <button id="cancel-action-btn" class="btn btn-secondary">Cancelar</button>
        </div>
    `;

    // Função para fechar o modal (assumindo que existe uma função closeModal)
    const setupModalActions = () => {
        const confirmBtn = document.getElementById('confirm-action-btn');
        const cancelBtn = document.getElementById('cancel-action-btn');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (typeof closeModal === 'function') closeModal();
                callback();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (typeof closeModal === 'function') closeModal();
            });
        }
    };

    return { html: modalHtml, setup: setupModalActions };
};

// ====================================================================
// MODAL DE GESTÃO DE ITENS DE AVARIA
// ====================================================================

let editingDamageItemId = null;
// As variáveis addDamageItemBtn e cancelEditDamageItemBtn globais não são mais necessárias aqui
// pois serão consultadas a partir do contentNode dentro de setupDamageItemsModal.

const openDamageItemsModal = async (damage) => {
    showSpinner();

    const modalContentHtml = `
        <div style="max-width: 800px;">
            <h3>Itens de Despesa - Avaria ${damage.id}</h3>
            <p><strong>Obra:</strong> ${damage.work?.name || 'N/A'} | <strong>Equipamento:</strong> ${damage.equipment?.prefix || 'N/A'} - ${getEquipTypeName(damage.equipment?.type) || 'N/A'}</p>

            <div class="form-grid" style="margin-bottom: 20px;">
                <div class="form-group">
                    <label for="damage-item-description">Descrição</label>
                    <input type="text" id="damage-item-description" placeholder="Ex: Peça danificada">
                </div>
                <div class="form-group">
                    <label for="damage-item-value">Valor Unitário</label>
                    <input type="number" id="damage-item-value" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label for="damage-item-quantity">Quantidade</label>
                    <input type="number" id="damage-item-quantity" step="1" value="1" min="1">
                </div>
                <div class="form-group">
                    <label for="damage-item-notes">Observações</label>
                    <textarea id="damage-item-notes" rows="2" placeholder="Observações adicionais"></textarea>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <button id="add-damage-item-btn" class="btn btn-primary">Adicionar Item</button>
                <button id="cancel-edit-damage-item-btn" class="btn btn-secondary" style="display: none;">Cancelar Edição</button>
            </div>

            <div class="table-wrapper">
                <table id="damage-items-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th>Valor Unit.</th>
                            <th>Qtd</th>
                            <th>Total</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <div style="margin-top: 20px; text-align: right;">
                <strong>Total Geral: <span id="damage-total-value">R$ 0,00</span></strong>
            </div>

            <div style="margin-top: 20px;">
                <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="damage-pdf-cover-checkbox" checked>
                    Incluir página de capa no PDF
                </label>
            </div>

            <div style="margin-top: 15px;">
                <button id="preview-damage-pdf-btn" class="btn btn-info">Visualizar PDF</button>
                <button id="generate-damage-pdf-btn" class="btn btn-success">Gerar PDF</button>
            </div>
        </div>
    `;

    // CORRIGIDO: Usa firstElementChild para garantir que o nó seja um elemento HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContentNode = tempDiv.firstElementChild; // Pega o primeiro ELEMENTO filho (o div principal do modal)

    if (typeof openModal === 'function' && modalContentNode) {
        openModal('Gerenciar Itens de Avaria', modalContentNode);
        // Passa o nó do conteúdo do modal para a função de setup
        await setupDamageItemsModal(modalContentNode, damage); 
    } else {
        hideSpinner();
        alert('Erro: Função openModal não encontrada ou conteúdo inválido.');
    }
};

// A função setupDamageItemsModal agora recebe o nó do conteúdo do modal como primeiro argumento
const setupDamageItemsModal = async (contentNode, damage) => {
    // Consulta os elementos diretamente do contentNode
    const addDamageItemBtn = contentNode.querySelector('#add-damage-item-btn');
    const cancelEditDamageItemBtn = contentNode.querySelector('#cancel-edit-damage-item-btn');
    const previewDamagePdfBtn = contentNode.querySelector('#preview-damage-pdf-btn');
    const generateDamagePdfBtn = contentNode.querySelector('#generate-damage-pdf-btn');
    const damagePdfCoverCheckbox = contentNode.querySelector('#damage-pdf-cover-checkbox');
    
    // Elementos do formulário de item
    const damageItemDescriptionInput = contentNode.querySelector('#damage-item-description');
    const damageItemValueInput = contentNode.querySelector('#damage-item-value');
    const damageItemQuantityInput = contentNode.querySelector('#damage-item-quantity');
    const damageItemNotesTextarea = contentNode.querySelector('#damage-item-notes');
    const damageItemsTableTbody = contentNode.querySelector('#damage-items-table tbody');
    const damageTotalValueSpan = contentNode.querySelector('#damage-total-value');


    const loadDamageItems = async () => {
        showSpinner();
        try {
            let damageItems = [];

            if (typeof apiClient.fetchDamageItems === 'function') {
                damageItems = await apiClient.fetchDamageItems(damage.id);
            } else if (typeof apiClient.fetchItems === 'function') {
                damageItems = await apiClient.fetchItems('damage_items', { damage_id: damage.id });
            } else {
                console.warn('Método para buscar itens de avaria não encontrado');
            }
            appState.damageItems = damageItems; // Armazena os itens no appState para fácil acesso

            if (damageItemsTableTbody) { // Verifica se o tbody existe antes de manipular
                damageItemsTableTbody.innerHTML = '';
            } else {
                console.warn('Elemento tbody da tabela de itens de avaria não encontrado.');
                return;
            }

            let totalValue = 0;

            damageItems.forEach(item => {
                const itemValue = parseFloat(item.value) || 0; // Garante que é um número
                const itemQuantity = parseInt(item.quantity) || 1; // Garante que é um número
                const itemTotal = itemValue * itemQuantity;
                totalValue += itemTotal;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.description || 'N/A'}</td>
                    <td>${formatCurrency(itemValue)}</td> <!-- CORRIGIDO: Passa o valor numérico -->
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(itemTotal)}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary edit-damage-item-btn" data-id="${item.id}">Editar</button>
                        <button class="btn btn-sm btn-danger delete-damage-item-btn" data-id="${item.id}">Excluir</button>
                    </td>
                `;
                damageItemsTableTbody.appendChild(row);
            });

            if (damageTotalValueSpan) { // Verifica se o span existe
                damageTotalValueSpan.textContent = formatCurrency(totalValue);
            }

            try {
                // Atualiza o valor total da avaria principal e força para usar o valor calculado pelos itens
                if (typeof apiClient.updateDamage === 'function') {
                    await apiClient.updateDamage(damage.id, { total_value: totalValue, use_direct_value: false }); 
                } else if (typeof apiClient.updateItem === 'function') {
                    await apiClient.updateItem('damages', damage.id, { total_value: totalValue, use_direct_value: false }); 
                }

                const damageIndex = appState.damages.findIndex(d => d.id == damage.id);
                if (damageIndex !== -1) {
                    appState.damages[damageIndex].total_value = totalValue;
                    appState.damages[damageIndex].use_direct_value = false;
                }
            } catch (updateError) {
                console.warn('Erro ao atualizar valor total da avaria:', updateError);
            }
            
            renderDamagesTable(); // Atualiza a tabela principal de avarias para refletir o novo total

            // Adiciona os event listeners para os botões de edição e exclusão de itens (dentro do modal)
            damageItemsTableTbody.querySelectorAll('.edit-damage-item-btn').forEach(btn => {
                btn.addEventListener('click', () => editDamageItem(btn.dataset.id));
            });
            damageItemsTableTbody.querySelectorAll('.delete-damage-item-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteDamageItem(btn.dataset.id));
            });

        } catch (error) {
            console.error('Erro ao carregar itens de avaria:', error);
        } finally {
            hideSpinner();
        }
    };

    const editDamageItem = (itemId) => {
        const item = appState.damageItems.find(i => i.id == itemId);
        if (!item) {
            alert('Item não encontrado para edição.');
            return;
        }

        // Preenche os campos do formulário de item, garantindo que o valor seja numérico
        if (damageItemDescriptionInput) damageItemDescriptionInput.value = item.description || '';
        if (damageItemValueInput) damageItemValueInput.value = parseFloat(item.value) || 0; // CORRIGIDO: Garante que é número
        if (damageItemQuantityInput) damageItemQuantityInput.value = parseInt(item.quantity) || 1; // CORRIGIDO: Garante que é número
        if (damageItemNotesTextarea) damageItemNotesTextarea.value = item.notes || '';
        
        editingDamageItemId = itemId;
        if (addDamageItemBtn) {
            addDamageItemBtn.textContent = 'Atualizar Item';
            addDamageItemBtn.classList.remove('btn-primary');
            addDamageItemBtn.classList.add('btn-warning');
        }
        if (cancelEditDamageItemBtn) {
            cancelEditDamageItemBtn.style.display = 'inline-block';
        }
    };

    const deleteDamageItem = async (itemId) => {
        const confirmModal = createConfirmationModal(async () => {
            showSpinner();
            try {
                if (typeof apiClient.deleteDamageItem === 'function') {
                    await apiClient.deleteDamageItem(itemId);
                } else if (typeof apiClient.deleteItem === 'function') {
                    await apiClient.deleteItem('damage_items', itemId);
                } else {
                    throw new Error('Método para excluir item de avaria não encontrado na API');
                }
                alert('Item de avaria excluído!');
                await loadDamageItems(); // Recarrega os itens após a exclusão
            } catch (error) {
                console.error('Erro ao excluir item de avaria:', error);
                alert(`Erro ao excluir item de avaria: ${error.message}`);
            } finally {
                hideSpinner();
            }
        }, 'Tem certeza que deseja excluir este item de despesa? Esta ação não pode ser desfeita.', 'Excluir');

        if (typeof openModal === 'function') {
            openModal('Confirmar Exclusão', confirmModal); // createConfirmationModal já retorna um nó
        }
    };

    // Adiciona event listener ao botão "Adicionar Item"
    if (addDamageItemBtn) {
        addDamageItemBtn.addEventListener('click', async () => {
            const description = damageItemDescriptionInput?.value.trim();
            const value = parseFloat(damageItemValueInput?.value) || 0;
            const quantity = parseInt(damageItemQuantityInput?.value) || 1;
            const notes = damageItemNotesTextarea?.value.trim();

            if (!description) {
                alert('Por favor, informe a descrição do item.');
                return;
            }

            const itemData = {
                damage_id: damage.id,
                description,
                value,
                quantity,
                notes
            };

            showSpinner();
            try {
                if (editingDamageItemId) {
                    if (typeof apiClient.updateDamageItem === 'function') {
                        await apiClient.updateDamageItem(editingDamageItemId, itemData);
                    } else if (typeof apiClient.updateItem === 'function') {
                        await apiClient.updateItem('damages', editingDamageItemId, itemData);
                    } else {
                        throw new Error('Método para atualizar item de avaria não encontrado na API');
                    }
                    alert('Item de avaria atualizado!');
                } else {
                    if (typeof apiClient.addDamageItem === 'function') {
                        await apiClient.addDamageItem(itemData);
                    } else if (typeof apiClient.addItem === 'function') {
                        await apiClient.addItem('damage_items', itemData);
                    } else {
                        throw new Error('Método para adicionar item de avaria não encontrado na API');
                    }
                    alert('Item de avaria adicionado!');
                }

                resetDamageItemForm(contentNode); // Passa o contentNode para resetar o formulário
                await loadDamageItems(); // Recarrega os itens
            } catch (error) {
                console.error('Erro ao salvar item de avaria:', error);
                alert(`Erro ao salvar item de avaria: ${error.message}`);
            } finally {
                hideSpinner();
            }
        });
    }


    const resetDamageItemForm = (targetNode) => { // Renomeado para targetNode para clareza
        if (damageItemDescriptionInput) targetNode.querySelector('#damage-item-description').value = '';
        if (damageItemValueInput) targetNode.querySelector('#damage-item-value').value = '0';
        if (damageItemQuantityInput) targetNode.querySelector('#damage-item-quantity').value = '1';
        if (damageItemNotesTextarea) targetNode.querySelector('#damage-item-notes').value = '';
        editingDamageItemId = null;
        if (addDamageItemBtn) {
            addDamageItemBtn.textContent = 'Adicionar Item';
            addDamageItemBtn.classList.remove('btn-warning');
            addDamageItemBtn.classList.add('btn-primary');
        }
        if (cancelEditDamageItemBtn) {
            cancelEditDamageItemBtn.style.display = 'none'; 
        }
    };

    // Adiciona event listener ao botão "Cancelar Edição"
    if (cancelEditDamageItemBtn) {
        cancelEditDamageItemBtn.addEventListener('click', () => {
            resetDamageItemForm(contentNode);
        });
    }

    // Adiciona event listeners aos botões de PDF
    // CORRIGIDO: Passa o objeto damage para generateDamagePdf
    if (previewDamagePdfBtn) {
        previewDamagePdfBtn.addEventListener('click', () => generateDamagePdf(damage, true, damagePdfCoverCheckbox.checked));
    }
    if (generateDamagePdfBtn) {
        generateDamagePdfBtn.addEventListener('click', () => generateDamagePdf(damage, false, damagePdfCoverCheckbox.checked));
    }

    // Carrega os itens do modal na inicialização
    await loadDamageItems();
};

/**
 * Gera o PDF de um relatório de avaria.
 * @param {Object} damageData - Dados da avaria.
 * @param {boolean|string} preview - Se é apenas uma pré-visualização (true), download (false), ou retornar Blob ('returnBlob').
 * @param {boolean} withCover - Se deve incluir página de capa.
 * @returns {Promise<Blob>} Retorna o Blob do PDF se não for preview/download direto.
 */
const generateDamagePdf = async (damageData, preview = false, withCover = true) => {
    showSpinner();
    console.log(`📄 Gerando PDF da avaria ${damageData.id} - Preview: ${preview}, Capa: ${withCover}`);
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    try {
        // Carrega os itens da avaria
        const damageItems = await loadDamageItemsForPdf(damageData.id);
        console.log(`📋 Carregados ${damageItems.length} itens da avaria`);
        
        // Garante que equipment_types esteja carregado para getEquipTypeName()
        if (!appState.equipment_types || appState.equipment_types.length === 0) {
            appState.equipment_types = await apiClient.fetchData('equipment_types');
        }

        // Busca dados relacionados e garante que estejam no appState
        const work = appState.works.find(w => w.id == damageData.work_id);
        const equipment = appState.equipment.find(e => e.id == damageData.equipment_id);
        const client = work ? appState.client_companies.find(c => c.id == work.client_company_id) : null;
        const myCompany = work ? appState.my_companies.find(c => c.id == work.my_company_id) : null;

        // Informações do cabeçalho
        const headerInfo = {
            myCompany: myCompany?.name || 'PBA TRANSPORTES',
            workName: work?.name || 'N/A',
            clientName: client?.name || 'N/A',
            damageDate: new Date(damageData.damage_date + 'T00:00:00').toLocaleDateString('pt-BR')
        };

        // Função para cabeçalho e rodapé
        const addPageHeadersFooters = (doc, pageNumber) => { // 'doc' added as parameter
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(headerInfo.myCompany, doc.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Página ${pageNumber}`, doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            doc.text('Rua Luiz Cajueiro de Albuquerque, n°1130, Loteamento dos Lins, Sertânia-PE-56600-000', 15, doc.internal.pageSize.getHeight() - 10, { align: 'left' });
        };

        let currentPage = 1;
        let y = 15;

        // === PÁGINA DE CAPA (se solicitada) ===
        if (withCover) {
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text(headerInfo.myCompany, pdf.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
            
            pdf.setFontSize(16);
            pdf.text('RELATÓRIO DE AVARIA', pdf.internal.pageSize.getWidth() / 2, 70, { align: 'center' });
            
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Obra: ${headerInfo.workName}`, pdf.internal.pageSize.getWidth() / 2, 90, { align: 'center' });
            // NOVO: Exibe o nome do cliente na capa
            pdf.text(`Cliente: ${client?.name || 'N/A'}`, pdf.internal.pageSize.getWidth() / 2, 105, { align: 'center' });
            pdf.text(`Data da Avaria: ${headerInfo.damageDate}`, pdf.internal.pageSize.getWidth() / 2, 120, { align: 'center' });
            
            pdf.setFontSize(12);
            pdf.text(`RELATÓRIO DE AVARIA - CÓD: ${damageData.id}`, pdf.internal.pageSize.getWidth() / 2, 140, { align: 'center' });
            
            
            // Nova página para conteúdo
            pdf.addPage();
            currentPage = 2;
            y = 15;
        }

        // Adiciona cabeçalho na primeira página de conteúdo
        addPageHeadersFooters(pdf, currentPage);
        if (!withCover) y = 30;

        // === CONTEÚDO PRINCIPAL ===
        
        // Título
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(`RELATÓRIO DE AVARIA - CÓD: ${damageData.id}`, 15, y);
        y += 10;

        // Informações básicas
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Obra: ${headerInfo.workName}`, 15, y); y += 5;
        // NOVO: Inclui o prefixo do equipamento na obra, se existir
        const equipmentWorkPrefixDisplay = damageData.equipment_work_prefix ? ` - ${damageData.equipment_work_prefix}` : '';
        pdf.text(`Equipamento: ${equipment?.prefix || 'N/A'}${equipmentWorkPrefixDisplay} - ${getEquipTypeName(equipment?.type) || 'N/A'}`, 15, y); y += 5;
        
        if (damageData.work_prefix) { // Este campo `work_prefix` se refere ao prefixo geral da obra, não do equipamento na obra.
            pdf.text(`Prefixo Obra: ${damageData.work_prefix}`, 15, y); y += 5;
        }
        
        pdf.text(`Data da Avaria: ${headerInfo.damageDate}`, 15, y); y += 10;

        // Observações
        pdf.setFont(undefined, 'bold');
        pdf.text('Observações Gerais:', 15, y); y += 5;
        pdf.setFont(undefined, 'normal');
        const obsLines = pdf.splitTextToSize(damageData.observations || 'Nenhuma observação.', 180);
        pdf.text(obsLines, 15, y);
        y += (obsLines.length * 4) + 10;

        // === TABELA DE ITENS ===
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Itens de Despesa da Avaria', 15, y); y += 5;

        const tableHeaders = [['DESCRIÇÃO', 'VALOR UNIT. (R$)', 'QTD.', 'TOTAL (R$)', 'OBSERVAÇÃO']];
        const tableBody = [];
        let itemsGrandTotal = 0;

        if (damageItems.length > 0) {
            damageItems.forEach(item => {
                const itemValue = parseFloat(item.value) || 0;
                const itemQuantity = parseInt(item.quantity) || 1;
                const total = itemValue * itemQuantity;
                itemsGrandTotal += total;
                
                tableBody.push([
                    item.description || 'N/A',
                    formatCurrency(itemValue),
                    itemQuantity.toString(),
                    formatCurrency(total),
                    item.notes || '---'
                ]);
            });
        } else {
            const directValue = parseFloat(damageData.total_value) || 0;
            itemsGrandTotal = directValue;
            
            tableBody.push([
                damageData.value_description || 'Valor direto da avaria',
                formatCurrency(directValue),
                '1',
                formatCurrency(directValue),
                '---'
            ]);
        }

        // Linha de total - mescla as 3 primeiras colunas
        tableBody.push([
            { content: 'Total Geral:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
            formatCurrency(itemsGrandTotal),
            ''
        ]);

        pdf.autoTable({
            startY: y,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 30, halign: 'right' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 55 }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > currentPage) {
                    currentPage = data.pageNumber;
                    addPageHeadersFooters(pdf, currentPage);
                }
            },
            didParseCell: (data) => {
                if (data.row.index === tableBody.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });
        
        y = pdf.lastAutoTable.finalY + 10;

        // === IMAGENS DA AVARIA (IMG) ===
        if (damageData.image_count > 0) {
            const imageResult = await processImagesForPdf(pdf, damageData, y, currentPage, addPageHeadersFooters);
            currentPage = imageResult.pageNumber;
            y = imageResult.finalY; // Atualiza a posição Y após as imagens IMG
        }

        // === IMAGENS DE ANEXO (AN) - NOVAS PÁGINAS INDIVIDUAIS ===
        if (damageData.attachment_count > 0) {
            console.log(`📎 Processando ${damageData.attachment_count} anexos da avaria ${damageData.id}...`);
            const timestamp = new Date().getTime();
            for (let i = 1; i <= damageData.attachment_count; i++) {
                const attachmentUrl = `https://res.cloudinary.com/ddobrlzep/image/upload/AVAR/AV${damageData.id}AN${i}.jpg?t=${timestamp}`;
                const imageResult = await loadImageForPdf(attachmentUrl);

                pdf.addPage(); // Sempre adiciona uma nova página para cada anexo
                currentPage++;
                addPageHeadersFooters(pdf, currentPage);

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 15;

                if (imageResult.success && imageResult.img) {
                    const img = imageResult.img;
                    let imgWidth = img.width || img.naturalWidth;
                    let imgHeight = img.height || img.naturalHeight;

                    // Calcula as dimensões para caber na página com margens, mantendo a proporção
                    const maxWidth = pageWidth - (2 * margin);
                    const maxHeight = pageHeight - (2 * margin) - 20; // Deixa espaço para título/rodapé

                    let ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                    imgWidth *= ratio;
                    imgHeight *= ratio;

                    // Centraliza a imagem na página
                    const imgX = (pageWidth - imgWidth) / 2;
                    const imgY = (pageHeight - imgHeight) / 2;

                    pdf.addImage(img, 'JPEG', imgX, imgY, imgWidth, imgHeight);
                    console.log(`✅ Anexo AV${damageData.id}AN${i}.jpg adicionado como página individual.`);
                } else {
                    console.warn(`⚠️ Falha ao carregar anexo AV${damageData.id}AN${i}.jpg. Adicionando placeholder.`);
                    // Adiciona placeholder se a imagem não carregar
                    const placeholderWidth = pageWidth - (2 * margin);
                    const placeholderHeight = pageHeight / 3; // Um terço da altura da página para o placeholder

                    pdf.setDrawColor(200, 200, 200);
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin, (pageHeight - placeholderHeight) / 2, placeholderWidth, placeholderHeight, 'FD');
                    
                    pdf.setFontSize(14);
                    pdf.setTextColor(150, 150, 150);
                    pdf.text(`ANEXO ${i} - Imagem não disponível`, pageWidth / 2, pageHeight / 2, { align: 'center' });
                    pdf.setTextColor(0, 0, 0); // Restaura cor
                }
                // Adiciona um título para o anexo na página
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(`ANEXO ${i}`, pageWidth / 2, margin + 10, { align: 'center' });
            }
        }


        // === FINALIZAÇÃO ===
        // NOVO: Nome do arquivo PDF com o formato solicitado
        const equipmentPrefix = equipment?.prefix || 'N/A';
        const workPrefix = damageData.equipment_work_prefix || ''; // Prefixo do equipamento na obra
        const clientName = client?.name || 'N/A';
        const workName = work?.name || 'N/A';
        const damageDateFormattedForFileName = new Date(damageData.damage_date + 'T00:00:00').toLocaleDateString('pt-BR').replace(/\//g, '-');

        const prefixoEquipamentoNaObraDisplay = workPrefix ? ` - ${workPrefix}` : '';
        const fileName = `AVARIA ${damageData.id} - ${equipmentPrefix}${prefixoEquipamentoNaObraDisplay} - ${clientName} - ${workName} - ${damageDateFormattedForFileName}.pdf`;
        
        // Lógica para retornar Blob, visualizar ou baixar
        if (preview === 'returnBlob') { 
            console.log('📦 Retornando PDF como Blob para processamento...');
            return pdf.output('blob');
        } else if (preview === true) { 
            console.log('👁️ Abrindo PDF para visualização');
            window.open(pdf.output('bloburl'), '_blank');
            return null; 
        } else { // preview === false (default para download)
            console.log('💾 Baixando PDF:', fileName);
            pdf.save(fileName);
            return null; 
        }

    } catch (error) {
        console.error('❌ Erro ao gerar PDF da avaria:', error);
        alert(`Não foi possível gerar o PDF da avaria.\nErro: ${error.message}`);
        return null;
    } finally {
        hideSpinner();
    }
};

/**
 * Converte um Blob em uma string Base64.
 * @param {Blob} blob O Blob a ser convertido.
 * @returns {Promise<string>} A string Base64 do Blob.
 */
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove o prefixo "data:application/pdf;base64,"
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * NOVO: Lida com o clique no botão de "Enviar Email"
 * Gera o PDF e abre o modal de preparação de email.
 * @param {Object} damage - O objeto da avaria.
 */
const handleSendEmailClick = async (damage) => {
    showSpinner();
    try {
        // Gerar o PDF como um Blob
        const pdfBlob = await generateDamagePdf(damage, 'returnBlob', true); // 'returnBlob' indica para retornar o blob, true para incluir capa

        if (!pdfBlob) {
            alert('Não foi possível gerar o PDF para o e-mail. Tente novamente.');
            return;
        }

        // Obter os dados da obra associada para buscar os e-mails dos responsáveis, CC e BCC
        const work = appState.works.find(w => w.id == damage.work_id);
        const responsibleEmails = work?.config?.responsible_emails || [];
        const ccEmails = work?.config?.cc_emails || [];
        const bccEmails = work?.config?.bcc_emails || [];

        // Extrai informações para o corpo do email
        const equipment = appState.equipment.find(e => e.id == damage.equipment_id);
        const client = work ? appState.client_companies.find(c => c.id == work.client_company_id) : null;

        const damageDateFormatted = new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR');
        
        const equipmentPrefix = equipment?.prefix || 'N/A';
        const workPrefix = damage.equipment_work_prefix || ''; // Prefixo do equipamento na obra
        const clientName = client?.name || 'N/A';
        const workName = work?.name || 'N/A';
        
        const prefixoEquipamentoNaObraDisplay = workPrefix ? ` - ${workPrefix}` : '';

        // NOVO: Assunto do e-mail no formato solicitado
        const emailSubject = `AVARIA ${damage.id} - ${equipmentPrefix}${prefixoEquipamentoNaObraDisplay} - ${clientName} - ${workName} - ${damageDateFormatted}`;
        
        // Corpo do email em texto puro para o mailto e em HTML para o envio direto
        const emailBodyText = `Prezados;\n\n` +
                              `Segue em anexo o relatório de avaria para acrescentar em medição:\n\n` +
                              `${emailSubject}\n\n` + // Reutiliza o assunto formatado
                              `Permanecemos à disposição para quaisquer esclarecimentos.\n\n` +
                              `--\n\n` +
                              `Atenciosamente,\n\n`+
                              `RICARDO CAMPOS - PBA`;

        // Corpo do email em HTML para o envio direto (com quebras de linha <br> e a imagem da assinatura)
        const emailBodyHtml = `
            <p>Prezados;</p>
            <p>Segue em anexo o relatório de avaria para acrescentar em medição:</p>
            <p><b>${emailSubject}</b></p>
            <p>Permanecemos à disposição para quaisquer esclarecimentos.</p>
            <p>--</p>
            <p>Atenciosamente,</p>
            <p>RICARDO CAMPOS - PBA</p>
            <img src="${EMAIL_SIGNATURE_IMAGE_URL}" alt="Assinatura de E-mail PBA Transportes" style="max-width: 100%; height: auto;">
        `;


        openEmailPreparationModal(damage, pdfBlob, emailSubject, emailBodyText, emailBodyHtml, responsibleEmails, ccEmails, bccEmails);

    } catch (error) {
        console.error('Erro ao preparar e-mail:', error);
        alert(`Não foi possível preparar o e-mail: ${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * NOVO: Abre um modal para o usuário preparar e "enviar" o e-mail.
 * @param {Object} damage - O objeto da avaria.
 * @param {Blob} pdfBlob - O Blob do PDF gerado.
 * @param {string} subject - Assunto pré-definido do e-mail.
 * @param {string} bodyText - Corpo do texto pré-definido do e-mail (para mailto).
 * @param {string} bodyHtml - Corpo do HTML pré-definido do e-mail (para envio direto).
 * @param {Array<string>} defaultRecipients - E-mails pré-definidos dos responsáveis.
 * @param {Array<string>} defaultCc - E-mails pré-definidos para CC.
 * @param {Array<string>} defaultBcc - E-mails pré-definidos para BCC.
 */
const openEmailPreparationModal = (damage, pdfBlob, subject, bodyText, bodyHtml, defaultRecipients, defaultCc = [], defaultBcc = []) => {
    const defaultRecipientsString = defaultRecipients.join(', ');
    const defaultCcString = defaultCc.join(', ');
    const defaultBccString = defaultBcc.join(', ');

    const modalContentHtml = `
        <div style="max-width: 700px; padding: 20px;">
            <h3>Preparar E-mail da Avaria ${damage.id}</h3>
            <p style="color: red; font-weight: bold;">
                ⚠️ Atenção: O envio direto de e-mails com anexos e credenciais requer uma configuração de backend.
                Se o botão "Enviar Direto" não funcionar, utilize as opções de download/copiar e o cliente de e-mail.
            </p>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-recipients">Para:</label>
                <input type="text" id="email-recipients" class="form-control" value="${defaultRecipientsString}" placeholder="emails@destino.com.br, outro@email.com" title="Separe múltiplos e-mails com vírgulas">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-cc">CC (Cópia):</label>
                <input type="text" id="email-cc" class="form-control" value="${defaultCcString}" placeholder="cc1@email.com, cc2@email.com" title="Separe múltiplos e-mails com vírgulas">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-bcc">BCC (Cópia Oculta):</label>
                <input type="text" id="email-bcc" class="form-control" value="${defaultBccString}" placeholder="bcc1@email.com, bcc2@email.com" title="Separe múltiplos e-mails com vírgulas">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-subject">Assunto:</label>
                <input type="text" id="email-subject" class="form-control" value="${subject}" readonly>
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
                <label for="email-body">Corpo do E-mail (Texto Puro):</label>
                <textarea id="email-body" class="form-control" rows="10" readonly style="resize: vertical;">${bodyText}</textarea>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <p>Assinatura:</p>
                <img src="${EMAIL_SIGNATURE_IMAGE_URL}" alt="Assinatura de E-mail PBA Transportes" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px;">
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px;">
                <button id="send-direct-email-btn" class="btn btn-primary">
                    🚀 Enviar Email Direto
                </button>
                <button id="download-pdf-attachment-btn" class="btn btn-success">
                    ⬇️ Baixar PDF da Avaria
                </button>
                <button id="copy-email-body-btn" class="btn btn-info">
                    📋 Copiar Corpo do E-mail
                </button>
                <button id="open-mail-client-btn" class="btn btn-secondary">
                    📧 Abrir Cliente de E-mail (Manual)
                </button>
                <button id="close-email-modal-btn" class="btn btn-danger">
                    ❌ Fechar
                </button>
            </div>

            <p style="margin-top: 20px; text-align: center; font-size: 0.9em; color: #555;">
                O botão "Enviar Email Direto" tentará enviar o e-mail automaticamente.
                As outras opções são para envio manual, caso o envio direto não funcione ou para sua preferência.
            </p>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContentNode = tempDiv.firstElementChild;

    openModal('Enviar E-mail', modalContentNode);

    // Get elements from the modal content node
    const recipientsInput = modalContentNode.querySelector('#email-recipients');
    const ccInput = modalContentNode.querySelector('#email-cc');
    const bccInput = modalContentNode.querySelector('#email-bcc');
    const subjectInput = modalContentNode.querySelector('#email-subject');
    const bodyTextarea = modalContentNode.querySelector('#email-body'); // Este é o corpo TEXTO PURO
    const downloadPdfBtn = modalContentNode.querySelector('#download-pdf-attachment-btn');
    const copyBodyBtn = modalContentNode.querySelector('#copy-email-body-btn');
    const openMailClientBtn = modalContentNode.querySelector('#open-mail-client-btn');
    const closeEmailModalBtn = modalContentNode.querySelector('#close-email-modal-btn');
    const sendDirectEmailBtn = modalContentNode.querySelector('#send-direct-email-btn'); // NOVO BOTÃO

    // Event Listeners
    downloadPdfBtn.addEventListener('click', () => {
        const pdfUrl = URL.createObjectURL(pdfBlob); // Cria URL aqui para download
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = `Relatorio_Avaria_${damage.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pdfUrl); // Libera o URL do Blob após o download
        alert('PDF baixado com sucesso!');
    });

    copyBodyBtn.addEventListener('click', () => {
        const textToCopy = bodyTextarea.value;
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        alert('Corpo do e-mail copiado para a área de transferência!');
    });

    openMailClientBtn.addEventListener('click', () => {
        const recipients = encodeURIComponent(recipientsInput.value);
        const encodedSubject = encodeURIComponent(subjectInput.value);
        const encodedBody = encodeURIComponent(bodyTextarea.value); // Usa o corpo de texto puro para mailto
        
        const mailtoLink = `mailto:${recipients}?subject=${encodedSubject}&body=${encodedBody}`;
        
        window.location.href = mailtoLink;
        alert('Seu cliente de e-mail padrão será aberto. Por favor, anexe o PDF e adicione a assinatura manualmente.');
    });

    closeEmailModalBtn.addEventListener('click', () => {
        closeModal();
        // Não revoga o URL do Blob aqui, pois ele é revogado no download ou na falha do envio direto.
    });

    // NOVO: Lógica para o botão "Enviar Email Direto"
    if (sendDirectEmailBtn) {
        sendDirectEmailBtn.addEventListener('click', async () => {
            showSpinner();
            try {
                if (!PHP_BACKEND_EMAIL_URL || PHP_BACKEND_EMAIL_URL === "SUA_URL_DO_SCRIPT_PHP_AQUI") {
                    alert("Erro: A URL do script PHP não foi configurada. Por favor, edite o arquivo lancamentos_avarias.js e insira a URL correta.");
                    hideSpinner();
                    return;
                }

                const recipients = recipientsInput.value.split(',').map(e => e.trim()).filter(e => e !== '');
                if (recipients.length === 0) {
                    alert('Por favor, insira pelo menos um destinatário para enviar o e-mail direto.');
                    hideSpinner();
                    return;
                }

                // Processar CC e BCC
                const ccRecipients = ccInput.value.split(',').map(e => e.trim()).filter(e => e !== '');
                // Adicionar emails automáticos ao CC
                if (!ccRecipients.includes('pbatransportes.sertania@gmail.com')) {
                    ccRecipients.push('pbatransportes.sertania@gmail.com');
                }
                if (!ccRecipients.includes('pbatransportes@bol.com.br')) {
                    ccRecipients.push('pbatransportes@bol.com.br');
                }
                const bccRecipients = bccInput.value.split(',').map(e => e.trim()).filter(e => e !== '');

                // Converte o Blob do PDF para Base64
                const attachmentBase64 = await blobToBase64(pdfBlob);
                const attachmentFileName = `Relatorio_Avaria_${damage.id}_${new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;

                const payload = {
                    to: recipients.join(','), // PHP espera uma string de e-mails separados por vírgula
                    cc: ccRecipients.length > 0 ? ccRecipients.join(',') : null,
                    bcc: bccRecipients.length > 0 ? bccRecipients.join(',') : null,
                    subject: subjectInput.value,
                    bodyHtml: bodyHtml, // Usa o corpo HTML com a assinatura
                    attachmentBase64: attachmentBase64,
                    attachmentFileName: attachmentFileName
                };

                const response = await fetch(PHP_BACKEND_EMAIL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    mode: 'cors' // Necessário para requisições cross-origin
                });

                const result = await response.json(); // PHP retorna JSON

                if (result.status === 'success') {
                    alert('E-mail enviado com sucesso!');
                    closeModal(); // Fecha o modal após o envio
                    // NOVO: Incrementa o contador de envios
                    const updatedCount = (damage.email_sent_count || 0) + 1;
                    if (typeof apiClient.updateDamage === 'function') {
                        await apiClient.updateDamage(damage.id, { email_sent_count: updatedCount });
                    } else if (typeof apiClient.updateItem === 'function') {
                        await apiClient.updateItem('damages', damage.id, { email_sent_count: updatedCount });
                    }
                    await loadAndRenderDamages(); // Atualiza a tabela para mostrar o novo contador
                } else {
                    console.error('Erro ao enviar e-mail via PHP:', result.message);
                    alert(`Falha ao enviar e-mail. Detalhes: ${result.message}. Verifique os logs do servidor HostGator.`);
                }
            } catch (error) {
                console.error('Erro inesperado ao enviar e-mail direto:', error);
                alert(`Ocorreu um erro inesperado ao enviar o e-mail: ${error.message}`);
            } finally {
                hideSpinner();
                URL.revokeObjectURL(pdfBlob); // Libera o URL do Blob após o envio ou falha
            }
        });
    }
};


// ====================================================================
// Sub-seção: Relatório de Avarias por Obra (EXPORTED)
// ====================================================================

/**
 * Inicializa a sub-seção de Relatório de Avarias por Obra.
 */
export const initDamagesByWorkReport = async () => { // EXPORTED
   // ✅ DEPOIS (com ordenação alfabética):
    if (damagesReportWorkSelect) {
        // Ordenar obras alfabeticamente por nome
        const sortedWorks = [...appState.works].sort((a, b) => {
            const nameA = (a.name || '').toUpperCase();
            const nameB = (b.name || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });
        
        damagesReportWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + 
            sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        damagesReportWorkSelect.addEventListener('change', handleDamagesReportWorkSelectChange);
    }

    // Event listeners
    if (generateDamagesReportBtn) {
        generateDamagesReportBtn.addEventListener('click', generateDamagesReport);
    }
    if (exportDamagesPdfBtn) {
        exportDamagesPdfBtn.addEventListener('click', () => generateDamagesReport(false)); // Gerar PDF
    }
    
    // Limpa output e esconde botão de PDF
    if (damagesReportOutput) damagesReportOutput.innerHTML = '';
    if (exportDamagesPdfBtn) exportDamagesPdfBtn.style.display = 'none';
};

/**
 * Lida com a mudança na seleção da obra para o relatório de avarias.
 * Popula o dropdown de BMs.
 */
const handleDamagesReportWorkSelectChange = () => {
    const workId = damagesReportWorkSelect.value;
    const work = appState.works.find(w => w.id == workId);
    
    if (damagesReportBmSelect) {
        damagesReportBmSelect.innerHTML = '<option value="">Vazio</option>'; // Opção para não filtrar por BM
        if (work?.config?.measurement_periods && work.config.measurement_periods.length > 0) {
            work.config.measurement_periods.forEach((bm, index) => {
                const bmLabel = `BM ${index + 1} (${new Date(bm.start + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(bm.end + 'T00:00:00').toLocaleDateString('pt-BR')})`;
                damagesReportBmSelect.innerHTML += `<option value="${index}">${bmLabel}</option>`;
            });
        }
    }
    // Limpa as datas se a obra for alterada
    damagesReportStartDate.value = '';
    damagesReportEndDate.value = '';
};


/**
 * Gera o relatório de avarias por obra.
 * @param {boolean} preview - Se é apenas uma pré-visualização (true) ou geração de PDF (false).
 */
const generateDamagesReport = async (preview = true) => {
    const workId = damagesReportWorkSelect.value;
    const bmIndex = damagesReportBmSelect.value !== '' ? parseInt(damagesReportBmSelect.value) : null;
    let startDate = damagesReportStartDate.value;
    let endDate = damagesReportEndDate.value;
    const withCover = damagesReportCoverCheckbox.checked;

    if (!workId) {
        alert('Por favor, selecione uma obra para gerar o relatório de avarias.');
        return;
    }

    showSpinner();
    if (damagesReportOutput) damagesReportOutput.innerHTML = '';
    if (exportDamagesPdfBtn) exportDamagesPdfBtn.style.display = 'none';

    try {
        const work = appState.works.find(w => w.id == workId);
        const client = appState.client_companies.find(c => c.id == work?.client_company_id);
        const myCompany = appState.my_companies.find(c => c.id == work?.my_company_id);

        let bmPeriod = null;
        let bmLabel = 'N/A';
        if (bmIndex !== null && work?.config?.measurement_periods?.[bmIndex]) {
            bmPeriod = work.config.measurement_periods[bmIndex];
            bmLabel = `BM ${bmIndex + 1}`;
            // Se um BM for selecionado, suas datas prevalecem, a menos que o usuário tenha inserido um intervalo mais específico
            if (!startDate) startDate = bmPeriod.start;
            if (!endDate) endDate = bmPeriod.end;
        }

        // Ajusta as datas se apenas uma for fornecida pelo usuário
        if (startDate && !endDate) {
            endDate = new Date().toISOString().split('T')[0]; // Até a data atual
        } else if (!startDate && endDate) {
            startDate = '2000-01-01'; // Desde uma data muito antiga
        }

        let damages = [];
        
        // Tenta buscar avarias com diferentes métodos
        try {
            if (typeof apiClient.fetchDamages === 'function') {
                damages = await apiClient.fetchDamages(workId, startDate, endDate);
            } else if (typeof apiClient.fetchItems === 'function') {
                // Busca genérica e filtra manualmente
                let allDamages = await apiClient.fetchItems('damages');
                damages = allDamages.filter(damage => {
                    let matches = true;
                    if (workId && damage.work_id != workId) matches = false;
                    if (startDate && damage.damage_date < startDate) matches = false;
                    if (endDate && damage.damage_date > endDate) false;
                    return matches;
                });
            } else {
                throw new Error('Método para buscar avarias não encontrado');
            }
        } catch (fetchError) {
            console.error('Erro ao buscar avarias para relatório:', fetchError);
            // Tenta usar dados já carregados do appState como fallback
            if (appState.damages && appState.damages.length > 0) {
                damages = appState.damages.filter(damage => {
                    let matches = true;
                    if (workId && damage.work_id != workId) matches = false;
                    if (startDate && damage.damage_date < startDate) matches = false;
                    if (endDate && damage.damage_date > endDate) false;
                    return matches;
                });
                console.warn('Usando dados do cache local para o relatório');
            } else {
                throw fetchError;
            }
        }
        
        // Enriquece os dados se necessário
        damages = await enrichDamagesData(damages);
        
        let reportHTML = `
            <div id="report-to-print">
                <div class="pdf-header">
                    <h3>${myCompany?.name || 'PBA TRANSPORTES'}</h3>
                    <p><strong>Obra:</strong> ${work?.name || 'N/A'}<br>
                       <strong>Cliente:</strong> ${client?.name || 'N/A'}</p>
                    <p><strong>Relatório de Avarias</strong></p>
                    <p><strong>Período:</strong> ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} a ${endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim'}</p>
                    <hr>
                </div>

                <div class="report-summary">
                    <h3>Resumo de Avarias</h3>
                    <div class="table-wrapper responsive">
                        <table id="damages-report-summary-table">
                            <thead>
                                <tr>
                                    <th>Cód.</th>
                                    <th>Data</th>
                                    <th>Equipamento</th>
                                    <th>Prefixo Obra</th>
                                    <th>Impacto Cliente</th>
                                    <th>Impacto Terceirizado</th>
                                    <th>Total Avaria (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        let grandTotal = 0;
        if (damages.length === 0) {
            reportHTML += `<tr><td colspan="7">Nenhuma avaria encontrada para os filtros selecionados.</td></tr>`;
        } else {
            for (const damage of damages) {
                const equipmentDisplay = `${damage.equipment?.prefix || 'N/A'} - ${getEquipTypeName(damage.equipment?.type) || 'N/A'}`;
                const damageDate = new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR');
                const totalValue = damage.total_value || 0;
                grandTotal += totalValue;

                // Mapeia os valores para texto legível
                let clientImpactText = EXPENSE_IMPACT_TYPES[damage.client_impact_type] || 'Nenhum';
                let terceirizadoImpactText = EXPENSE_IMPACT_TYPES[damage.terceirizado_impact_type] || 'Nenhum';

                reportHTML += `
                                <tr>
                                    <td>${damage.id}</td>
                                    <td>${damageDate}</td>
                                    <td>${equipmentDisplay}</td>
                                    <td>${damage.work_prefix || 'N/A'}</td>
                                    <td>${clientImpactText}</td>
                                    <td>${terceirizadoImpactText}</td>
                                    <td>${formatCurrency(totalValue)}</td>
                                </tr>
                `;
            }
        }

        reportHTML += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="6" style="text-align: right; font-weight: bold;">Total Geral de Avarias:</td>
                                    <td style="font-weight: bold;">${formatCurrency(grandTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (damagesReportOutput) damagesReportOutput.innerHTML = reportHTML;
        if (exportDamagesPdfBtn) exportDamagesPdfBtn.style.display = 'inline-block';

        if (!preview) {
            // Chamar a função de geração de PDF com a opção de capa
            const { exportDamagesReportToPDF } = await import('./relatorios_avarias_pdf.js');
            await exportDamagesReportToPDF(damagesReportOutput.id, 'Relatório de Avarias', withCover);
        }

    } catch (e) {
        console.error("Erro ao gerar relatório de avarias:", e);
        if (damagesReportOutput) damagesReportOutput.innerHTML = `<p style="color: red;">Ocorreu um erro ao gerar o relatório de avarias. ${e.message}</p>`;
    } finally {
        hideSpinner();
    }
};

/**
 * Função placeholder para salvar ou atualizar uma entrada de avaria.
 * Esta função precisa ser implementada com a lógica real de persistência de dados.
 */
const saveOrUpdateDamageEntry = async () => {
    try {
        console.log('💾 INICIANDO SALVAMENTO DE AVARIA');
        console.log('📊 Estado atual de edição:', editingDamageId ? `Editando ID ${editingDamageId}` : 'Nova avaria');

        // Validação dos campos obrigatórios
        const workId = damageWorkSelect?.value;
        const equipmentId = damageEquipmentSelect?.value;
        const damageDate = damageDateInput?.value;

        console.log('📝 Dados do formulário:', { workId, equipmentId, damageDate });

        if (!workId) {
            alert('Por favor, selecione uma obra.');
            damageWorkSelect?.focus();
            return;
        }

        if (!equipmentId) {
            alert('Por favor, selecione um equipamento.');
            damageEquipmentSelect?.focus();
            return;
        }

        if (!damageDate) {
            alert('Por favor, informe a data da avaria.');
            damageDateInput?.focus();
            return;
        }

        showSpinner();

        // Obtém o prefixo do equipamento na obra do campo input
        const equipmentWorkPrefix = damageEquipmentWorkPrefixInput?.value || null;

        // Prepara os dados da avaria
        const damageData = {
            work_id: workId,
            equipment_id: equipmentId,
            // AQUI: work_prefix refere-se ao prefixo geral da obra, não do equipamento na obra.
            // O prefixo do equipamento na obra está sendo armazenado como 'equipment_work_prefix' diretamente no objeto damage,
            // ou pode ser inferido da work.config.equipment.
            // Para simplificar, vou manter 'work_prefix' como está (se for o prefixo da obra)
            // e adicionar 'equipment_work_prefix' para o novo campo.
            work_prefix: appState.works.find(w => w.id == workId)?.work_prefix || '', // Mantém o prefixo da obra geral
            equipment_work_prefix: equipmentWorkPrefix, // NOVO CAMPO: Prefixo do equipamento na obra
            damage_date: damageDate,
            client_impact_type: damageClientImpactTypeSelect?.value || 'none',
            terceirizado_impact_type: damageTerceirizadoImpactTypeSelect?.value || 'none',
            observations: damageObservationsTextarea?.value || '',
            image_count: parseInt(damageImageCountInput?.value) || 0,
            attachment_count: parseInt(damageAttachmentCountInput?.value) || 0, // NOVO: Quantidade de anexos
            use_direct_value: damageUseDirectValueCheckbox?.checked || false,
            total_value: parseFloat(damageDirectValueInput?.value) || 0,
            value_description: damageValueDescriptionInput?.value || '',
            email_recipients: damageEmailRecipientsInput?.value || '',
            email_cc: damageEmailCcInput?.value || '',
            email_bcc: damageEmailBccInput?.value || ''
        };

        // Processa descrições das imagens
        if (damageData.image_count > 0 && damageImageDescriptionsContainer) {
            const imageDescriptions = [];
            for (let i = 1; i <= damageData.image_count; i++) {
                const descInput = damageImageDescriptionsContainer.querySelector(`.image-description-input[data-image-index="${i}"]`);
                const urlInput = damageImageDescriptionsContainer.querySelector(`.image-url-auto-input[data-image-index="${i}"]`);
                if (descInput && urlInput) {
                    imageDescriptions.push({
                        index: i,
                        description: descInput.value || '',
                        url: urlInput.value || ''
                    });
                }
            }
            damageData.image_descriptions = imageDescriptions;
        }

        let result;

        if (editingDamageId) {
            // ================ ATUALIZAÇÃO ================
            console.log('🔄 ATUALIZANDO avaria existente:', editingDamageId);
            
            if (typeof apiClient.updateDamage === 'function') {
                result = await apiClient.updateDamage(editingDamageId, damageData);
            } else if (typeof apiClient.updateItem === 'function') {
                result = await apiClient.updateItem('damages', editingDamageId, damageData);
            } else {
                throw new Error('Método para atualizar avaria não encontrado na API');
            }
            
            console.log('✅ Avaria atualizada com sucesso:', result);
            alert('Avaria atualizada com sucesso!');
            
        } else {
            // ================ NOVA AVARIA ================
            console.log('🆕 CRIANDO nova avaria...');
            
            // Determina o ID
            let damageId;
            const customId = damageCustomIdInput?.value?.trim();
            
            if (customId) {
                console.log('🎯 Usando código personalizado:', customId);
                const validation = await validateCustomCode(customId);
                if (!validation.valid) {
                    console.error('❌ Validação falhou:', validation.message);
                    alert(validation.message);
                    hideSpinner();
                    return;
                }
                damageId = parseInt(customId);
            } else {
                console.log('🤖 Gerando código automaticamente...');
                damageId = await getNextDamageCode();
            }

            // Validação final crítica
            if (!damageId || damageId <= 0) {
                const errorMsg = `ID inválido gerado: ${damageId}`;
                console.error('❌', errorMsg);
                alert('Erro: Não foi possível gerar um código válido para a avaria.');
                hideSpinner();
                return;
            }

            console.log('🆔 ID final da nova avaria:', damageId);
            damageData.id = damageId;
            // NOVO: Inicializa o contador de emails enviados
            damageData.email_sent_count = 0;

            // Última validação antes de enviar
            console.log('📦 Dados finais a serem enviados:', {
                id: damageData.id,
                work_id: damageData.work_id,
                equipment_id: damageData.equipment_id,
                damage_date: damageData.damage_date,
                equipment_work_prefix: damageData.equipment_work_prefix, // Confirma que está sendo enviado
                attachment_count: damageData.attachment_count // Confirma que a quantidade de anexos está sendo enviada
            });

            // Salva no servidor
            if (typeof apiClient.addDamage === 'function') {
                console.log('📡 Enviando via apiClient.addDamage...');
                result = await apiClient.addDamage(damageData);
            } else if (typeof apiClient.addItem === 'function') {
                console.log('📡 Enviando via apiClient.addItem...');
                result = await apiClient.addItem('damages', damageData);
            } else {
                throw new Error('Método para adicionar avaria não encontrado na API');
            }
            
            console.log('✅ Nova avaria criada com sucesso:', result);
            alert(`Avaria criada com sucesso! Código: ${damageId}`);
        }

        // 🚨 CAPTURA O ID ANTES DE RESETAR O FORM (CRÍTICO!)
        const savedDamageId = editingDamageId || damageData.id;
        console.log('💾 ID capturado ANTES do reset:', savedDamageId);
        
        // Recarrega e limpa
        console.log('🔄 Recarregando lista de avarias...');
        await loadAndRenderDamages();
        resetDamageForm();
        await updateNextCodePreview();
        
        // 🚀 UPLOAD AUTOMÁTICO DO PDF PARA GOOGLE DRIVE
        try {
            console.log('📤 Iniciando upload automático do PDF da avaria para o Drive...');
            console.log('🆔 ID salvo para upload:', savedDamageId);
            
            if (!savedDamageId) {
                console.error('❌ ID da avaria não disponível');
                throw new Error('ID da avaria não disponível');
            }
            
            // IMPORTANTE: Buscar avaria COMPLETA do banco com TODOS os dados
            console.log('🔄 Buscando avaria completa do banco de dados...');
            const fullDamageData = await apiClient.fetchData('damages', '*', 'id', false);
            console.log('📊 Total de avarias no banco:', fullDamageData.length);
            console.log('📋 IDs no banco:', fullDamageData.map(d => d.id));
            const completeDamage = fullDamageData.find(d => d.id == savedDamageId);
            
            if (!completeDamage) {
                console.error('❌ Avaria não encontrada no banco após salvar');
                console.error('❌ Procurando ID:', savedDamageId, 'Tipo:', typeof savedDamageId);
                console.error('❌ IDs disponíveis:', fullDamageData.map(d => `${d.id} (${typeof d.id})`));
                throw new Error('Avaria não encontrada');
            }
            
            // Adicionar relações
            completeDamage.work = appState.works.find(w => w.id == completeDamage.work_id);
            completeDamage.equipment = appState.equipment.find(e => e.id == completeDamage.equipment_id);
            
            console.log('🔍 Avaria completa recuperada:', completeDamage);
            console.log('📸 URLs de imagens:', completeDamage.image_urls);
            
            await uploadDamagePdfToDrive(completeDamage);
            console.log('✅ PDF da avaria enviado para o Drive com sucesso!');
        } catch (driveError) {
            console.error('⚠️ Erro ao enviar PDF da avaria para o Drive:', driveError);
            console.error('📍 Stack do erro:', driveError.stack);
            // Não interrompe o fluxo, apenas loga o erro
        }
        
        console.log('✅ SALVAMENTO CONCLUÍDO COM SUCESSO!');

    } catch (error) {
        console.error('❌ ERRO NO SALVAMENTO:', error);
        console.error('📍 Stack trace:', error.stack);
        
        // Mensagens de erro mais específicas
        let userMessage = `Erro ao salvar avaria: ${error.message}`;
        
        if (error.message.includes('Duplicate entry')) {
            const match = error.message.match(/Duplicate entry '([^']+)'/);
            const duplicateValue = match ? match[1] : 'desconhecido';
            userMessage = `Erro: Já existe uma avaria com o código ${duplicateValue}. Tente usar um código diferente ou recarregue a página.`;
        } else if (error.message.includes('Integrity constraint violation')) {
            userMessage = 'Erro de integridade dos dados. Verifique se todos os campos estão preenchidos corretamente.';
        }
        
        alert(userMessage);
    } finally {
        hideSpinner();
    }
};

/**
 * Carrega dados genéricos para o appState se ainda não estiverem carregados.
 * @param {string} key - A chave no appState onde os dados serão armazenados (ex: 'works', 'equipment').
 * @param {string} tableName - O nome da tabela no API.
 * @param {string} selectQuery - A query de seleção para o API (ex: '*', 'name,id').
 */
const loadGenericDataIntoAppState = async (key, tableName, selectQuery = '*') => {
    if (!appState[key] || appState[key].length === 0) {
        try {
            const data = await apiClient.fetchData(tableName, selectQuery);
            appState[key] = data;
            console.log(`Dados de '${key}' carregados para appState.`);
        } catch (e) {
            console.error(`Erro ao carregar dados de '${tableName}' para '${key}':`, e);
        }
    }
};

/**
 * Faz upload do PDF de avaria para o Google Drive automaticamente.
 * @param {Object} damage - Objeto da avaria salva
 */
const uploadDamagePdfToDrive = async (damage) => {
    try {
        console.log('🔧 Iniciando upload automático do PDF de avaria para Google Drive...');
        console.log('📋 Avaria:', damage);
        
        // 🔥 GARANTIR QUE OS DADOS DAS EMPRESAS ESTEJAM CARREGADOS
        if (!appState.client_companies || appState.client_companies.length === 0) {
            console.log('⚠️ client_companies vazio, carregando...');
            appState.client_companies = await apiClient.fetchData('client_companies', '*');
            console.log('✅ client_companies carregados:', appState.client_companies.length);
        }
        if (!appState.my_companies || appState.my_companies.length === 0) {
            console.log('⚠️ my_companies vazio, carregando...');
            appState.my_companies = await apiClient.fetchData('my_companies', '*');
            console.log('✅ my_companies carregados:', appState.my_companies.length);
        }
        
        // 1. Gerar PDF blob COM CAPA E COMPLETO (igual ao manual)
        const pdfBlob = await generateDamagePdf(damage, 'returnBlob', true); // COM capa
        if (!pdfBlob) {
            console.error('❌ Erro ao gerar PDF de avaria');
            return;
        }
        console.log('✅ PDF gerado, tamanho:', pdfBlob.size);
        
        // 2. Extrair informações DA OBRA - MESMA LÓGICA DO RELATÓRIO
        const work = appState.works.find(w => w.id == damage.work_id) || damage.work;
        if (!work) {
            throw new Error('Obra não encontrada');
        }
        
        const workName = work.name || 'OBRA';
        
        console.log('🔍 OBRA COMPLETA:', work);
        console.log('🔍 work.config:', work.config);
        console.log('🔍 work.client_company_id:', work.client_company_id);
        console.log('🔍 work.my_company_id:', work.my_company_id);
        
        // 🎯 Extrai nome da empresa - BUSCA DIRETO DA OBRA
        let companyName = 'EMPRESA';
        
        // Tenta pegar IDs diretamente da obra primeiro (campos diretos)
        let clientCompanyId = work.client_company_id;
        let myCompanyId = work.my_company_id;
        
        // Se não tiver nos campos diretos, tenta pegar do config
        if (!clientCompanyId && !myCompanyId && work.config) {
            try {
                const config = typeof work.config === 'string' ? JSON.parse(work.config) : work.config;
                clientCompanyId = config.client_company_id;
                myCompanyId = config.my_company_id;
                console.log('🔍 IDs extraídos do config - client:', clientCompanyId, 'my:', myCompanyId);
            } catch (err) {
                console.warn('⚠️ Erro ao parsear config:', err);
            }
        }
        
        console.log('🔍 IDs finais - client_company_id:', clientCompanyId, 'my_company_id:', myCompanyId);
        console.log('🔍 appState.client_companies:', appState.client_companies);
        console.log('🔍 appState.my_companies:', appState.my_companies);
        
        // Busca o nome da empresa cliente
        if (clientCompanyId) {
            const client = appState.client_companies?.find(c => c.id == clientCompanyId);
            if (client?.name) {
                companyName = client.name;
                console.log('✅ Cliente encontrado:', companyName);
            } else {
                console.log('❌ Cliente não encontrado para ID:', clientCompanyId);
            }
        }
        
        // Se não encontrou cliente, busca empresa própria
        if (companyName === 'EMPRESA' && myCompanyId) {
            const myCompany = appState.my_companies?.find(mc => mc.id == myCompanyId);
            if (myCompany?.name) {
                companyName = myCompany.name;
                console.log('✅ Empresa própria encontrada:', companyName);
            } else {
                console.log('❌ Empresa própria não encontrada para ID:', myCompanyId);
            }
        }
        
        const damageDate = damage.damage_date || new Date().toISOString().split('T')[0];
        
        console.log('🏢 Obra:', workName);
        console.log('👤 Empresa:', companyName);
        console.log('📅 Data:', damageDate);
        
        // 3. Determinar BM e período - MESMA LÓGICA DO RELATÓRIO
        // Busca os períodos de medição da obra
        let periods = [];
        if (work.config) {
            try {
                const config = typeof work.config === 'string' ? JSON.parse(work.config) : work.config;
                periods = config.measurement_periods || [];
            } catch (err) {
                console.warn('⚠️ Erro ao extrair períodos:', err);
            }
        }
        
        // Usa getBMLabelForDate que retorna string "BM X"
        const bmLabel = getBMLabelForDate(damageDate, periods) || 'BM 1';
        
        // Encontra o período correspondente para pegar datas de início e fim
        const date = new Date(damageDate + 'T00:00:00');
        let startDate = damageDate;
        let endDate = damageDate;
        
        for (let i = 0; i < periods.length; i++) {
            const periodStart = new Date(periods[i].start + 'T00:00:00');
            const periodEnd = new Date(periods[i].end + 'T00:00:00');
            if (date >= periodStart && date <= periodEnd) {
                startDate = periods[i].start;
                endDate = periods[i].end;
                break;
            }
        }
        
        // Usa getDateRangeFormatted para formato DD-MM-YYYY a DD-MM-YYYY
        const dateRange = getDateRangeFormatted(startDate, endDate);
        
        console.log('📊 BM Label:', bmLabel);
        console.log('📆 Período:', startDate, 'a', endDate);
        console.log('📆 Date Range formatado:', dateRange);
        
        // 4. Formatar nome do arquivo - MESMA LÓGICA DO RELATÓRIO
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const fileName = `${workName.replace(/\s+/g, '_')}_-_${companyName.replace(/\s+/g, '_')}_-_${bmLabel}_-_${dateRange}_-_AVARIA_${damage.id}_-_${today}.pdf`;
        
        console.log('📝 Nome do arquivo:', fileName);
        
        // 5. Converter blob para base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
        });
        reader.readAsDataURL(pdfBlob);
        const pdfData = await base64Promise;
        
        console.log('✅ PDF convertido para base64, tamanho:', pdfData.length);
        console.log('📤 Enviando para API...');
        
        // 6. Enviar para API com flag de sobrescrita - MESMOS PARÂMETROS DO RELATÓRIO
        const response = await fetch('/proj/api/google_drive_upload.php?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdfData,
                fileName: fileName,
                workName: workName,
                companyName: companyName,
                bmLabel: bmLabel,
                dateRange: dateRange,
                uploadDate: today,
                overwrite: true  // Sobrescrever se já existir
            })
        });
        
        console.log('📥 Resposta recebida, status:', response.status);
        const result = await response.json();
        console.log('📦 Resultado completo:', result);
        
        if (result.success) {
            console.log('✅ PDF de avaria enviado para Google Drive com sucesso!');
            // Alert removido conforme solicitado
        } else {
            console.error('❌ Erro ao enviar PDF para Google Drive:', result.error);
            // Alert removido - apenas loga o erro
        }
    } catch (error) {
        console.error('❌ Erro ao fazer upload de PDF de avaria:', error);
        // Alert removido - apenas loga o erro
        // Não propaga erro para não interromper o fluxo de salvamento
    }
};

/**
 * Inicializa a seção de Lançamentos de Avarias.
 * Deve ser chamada quando a aba de avarias é ativada.
 */
export const initDamagesSection = async () => { // Adicionado 'async' aqui
    console.log('Inicializando seção de avarias...');

    showSpinner(); // Mostra o spinner enquanto carrega os dados

    // Garante que 'works' e 'equipment' estejam carregados no appState
    // Incluir 'config' para acessar 'responsible_emails' e 'equipment_work_prefix'
    await loadGenericDataIntoAppState('works', 'works', '*, client_companies(name), my_companies(name), config'); 
    await loadGenericDataIntoAppState('equipment', 'equipment', '*');
    await loadGenericDataIntoAppState('client_companies', 'client_companies', '*'); // Garante que client_companies esteja disponível

    // ✅ DEPOIS (com ordenação alfabética):
    if (damageWorkSelect && appState.works) {
        // Ordenar obras alfabeticamente por nome
        const sortedWorks = [...appState.works].sort((a, b) => {
            const nameA = (a.name || '').toUpperCase();
            const nameB = (b.name || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });
        
        damageWorkSelect.innerHTML = '<option value="">Selecione a Obra</option>' + 
            sortedWorks.map(work => `<option value="${work.id}">${work.name}</option>`).join('');
    } else if (!appState.works) {
        console.warn('appState.works não está carregado. O dropdown de obras pode estar vazio.');
    }

    // Inicializa os event listeners principais
    if (damageWorkSelect) damageWorkSelect.addEventListener('change', handleDamageWorkSelectChange);
    if (damageEquipmentSelect) damageEquipmentSelect.addEventListener('change', handleDamageEquipmentSelectChange);
    if (damageImageCountInput) damageImageCountInput.addEventListener('change', generateImageDescriptionFields);
    if (saveDamageBtn) saveDamageBtn.addEventListener('click', saveOrUpdateDamageEntry);
    if (cancelEditDamageBtn) cancelEditDamageBtn.addEventListener('click', cancelEditDamageEntry);
    // NOVO: Listener para o campo de quantidade de anexos
    if (damageAttachmentCountInput) damageAttachmentCountInput.addEventListener('change', () => { /* Nenhuma ação direta na UI aqui, apenas para salvar o valor */ });


    // Adiciona um listener para o checkbox de valor direto
    if (damageUseDirectValueCheckbox) {
         damageUseDirectValueCheckbox.addEventListener('change', (e) => {
             const isChecked = e.target.checked;
             if (damageDirectValueInput) {
                 damageDirectValueInput.disabled = !isChecked;
             }
             if (damageValueDescriptionInput) {
                 damageValueDescriptionInput.disabled = !isChecked;
             }
         });
     }

    // Atualiza os dropdowns e a tabela
    loadAndRenderDamages();
    updateNextCodePreview();
    // Chama handleDamageWorkSelectChange para popular o dropdown de equipamentos,
    // caso uma obra já esteja selecionada (ou para limpar se nenhuma estiver)
    handleDamageWorkSelectChange(); 

    // Inicializa a sub-seção de relatórios
    initDamagesByWorkReport();
    
    // ✅ DEFINE VALOR PADRÃO: "add_client" (Acréscimo ao cliente)
    if (damageClientImpactTypeSelect) {
        damageClientImpactTypeSelect.value = 'add_client';
        console.log('✅ Campo Impacto Cliente definido para "Acréscimo" por padrão');
    }

    hideSpinner(); // Esconde o spinner após o carregamento e inicialização
};



const openPdfOptionsModal = (damage) => {
    console.log('📄 Abrindo opções de PDF para avaria:', damage.id);

    const modalContentHtml = `
        <div style="max-width: 500px; text-align: center;">
            <h3>📄 Gerar PDF - Avaria ${damage.id}</h3>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                <p><strong>Obra:</strong> ${damage.work?.name || 'N/A'}</p>
                <p><strong>Equipamento:</strong> ${damage.equipment?.prefix || 'N/A'} - ${getEquipTypeName(damage.equipment?.type) || 'N/A'}</p>
                <p><strong>Data:</strong> ${damage.damage_date ? new Date(damage.damage_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p>
                <p><strong>Valor:</strong> ${formatCurrency(parseFloat(damage.total_value) || 0)}</p>
            </div>

            <div style="margin: 20px 0;">
                <label style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px;">
                    <input type="checkbox" id="pdf-include-cover" checked>
                    <span>Incluir página de capa no PDF</span>
                </label>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="preview-pdf-btn" class="btn btn-info" style="flex: 1;">
                    👁️ Visualizar PDF
                </button>
                <button id="download-pdf-btn" class="btn btn-success" style="flex: 1;">
                    ⬇️ Baixar PDF
                </button>
            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                <button id="upload-to-drive-btn" class="btn btn-primary" style="flex: 1;">
                    ☁️ Gerar PDF para Google Drive
                </button>
            </div>

            <div style="margin-top: 15px;">
                <button id="close-pdf-modal-btn" class="btn btn-secondary">
                    ❌ Cancelar
                </button>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContentNode = tempDiv.firstElementChild;

    if (typeof openModal === 'function' && modalContentNode) {
        openModal('Opções de PDF', modalContentNode);
        setupPdfOptionsModal(modalContentNode, damage);
    } else {
        console.error('Função openModal não encontrada');
        // Fallback: gera PDF diretamente
        generateDamagePdf(damage, false, true);
    }
};

/**
 * NOVA FUNÇÃO: Configura o modal de opções de PDF
 */
const setupPdfOptionsModal = (contentNode, damage) => {
    const previewBtn = contentNode.querySelector('#preview-pdf-btn');
    const downloadBtn = contentNode.querySelector('#download-pdf-btn');
    const closeBtn = contentNode.querySelector('#close-pdf-modal-btn');
    const includeCoverCheckbox = contentNode.querySelector('#pdf-include-cover');

    // Botão Visualizar
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const withCover = includeCoverCheckbox?.checked || false;
            console.log('📖 Visualizando PDF com capa:', withCover);
            generateDamagePdf(damage, true, withCover); // true = preview
            if (typeof closeModal === 'function') closeModal();
        });
    }

    // Botão Download
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const withCover = includeCoverCheckbox?.checked || false;
            console.log('💾 Baixando PDF com capa:', withCover);
            generateDamagePdf(damage, false, withCover); // false = download
            if (typeof closeModal === 'function') closeModal();
        });
    }

    // Botão Upload para Google Drive
    const uploadToDriveBtn = contentNode.querySelector('#upload-to-drive-btn');
    if (uploadToDriveBtn) {
        uploadToDriveBtn.addEventListener('click', async () => {
            console.log('☁️ Enviando PDF para Google Drive...');
            showSpinner();
            try {
                await uploadDamagePdfToDrive(damage);
                alert('✅ PDF enviado para o Google Drive com sucesso!');
            } catch (error) {
                console.error('❌ Erro ao enviar para Google Drive:', error);
                alert('❌ Erro ao enviar PDF para Google Drive. Verifique o console para detalhes.');
            } finally {
                hideSpinner();
                if (typeof closeModal === 'function') closeModal();
            }
        });
    }

    // Botão Cancelar
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('❌ Cancelando geração de PDF');
            if (typeof closeModal === 'function') closeModal();
        });
    }
};



const loadDamageItemsForPdf = async (damageId) => {
    try {
        console.log('📋 Carregando itens da avaria', damageId, 'para PDF...');
        
        if (typeof apiClient.fetchDamageItems === 'function') {
            return await apiClient.fetchDamageItems(damageId);
        } else if (typeof apiClient.fetchItems === 'function') {
            return await apiClient.fetchItems('damage_items', { damage_id: damageId });
        } else {
            console.warn('⚠️ Método para buscar itens de avaria não encontrado');
            return [];
        }
    } catch (error) {
        console.error('❌ Erro ao carregar itens da avaria para PDF:', error);
        return [];
    }
};



const loadImageForPdf = (imageUrl, timeout = 8000) => {
    return new Promise((resolve) => {
        console.log(`🔄 Tentando carregar imagem: ${imageUrl}`);
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        let resolved = false;
        
        const resolveOnce = (success, result = null) => {
            if (!resolved) {
                resolved = true;
                resolve({ success, img: result, url: imageUrl });
            }
        };
        
        img.onload = () => {
            console.log(`✅ Imagem carregada: ${imageUrl}`);
            resolveOnce(true, img);
        };
        
        img.onerror = (error) => {
            console.warn(`❌ Erro ao carregar imagem: ${imageUrl}`, error);
            resolveOnce(false);
        };
        
        // Timeout para evitar travamento
        setTimeout(() => {
            console.warn(`⏰ Timeout ao carregar imagem: ${imageUrl}`);
            resolveOnce(false);
        }, timeout);
        
        // Inicia o carregamento
        img.src = imageUrl;
    });
};



const processImagesForPdf = async (pdf, damageData, startY, currentPageNumber, addPageHeadersFooters) => {
    if (!damageData.image_count || damageData.image_count <= 0) {
        console.log('📷 Nenhuma imagem para processar');
        return { finalY: startY, pageNumber: currentPageNumber };
    }

    console.log(`🖼️ Processando ${damageData.image_count} imagens da avaria ${damageData.id}...`);
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    
    let y = startY;
    
    // Verifica se cabe na página
    if (y + 20 > pdf.internal.pageSize.getHeight() - 15) {
        pdf.addPage();
        currentPageNumber++;
        addPageHeadersFooters(pdf, currentPageNumber);
        y = 15;
    }
    
    pdf.text('Imagens da Avaria', 15, y);
    y += 10;

    const maxImageWidth = (pdf.internal.pageSize.getWidth() - 30) / 2 - 5;
    const maxImageHeight = 60;
    let currentX = 15;
    let startYForImages = y;
    let rowMaxHeight = 0;

    const imageDescriptions = damageData.image_descriptions || [];
    
    for (let i = 1; i <= damageData.image_count; i++) {
        try {
            // Adiciona timestamp para evitar cache e sempre carregar imagem atualizada
            const timestamp = new Date().getTime();
            
            // Encontra a descrição ou cria uma padrão
            const imgDesc = imageDescriptions.find(desc => desc.index == i) || {
                index: i,
                description: 'Sem descrição',
                url: `https://res.cloudinary.com/ddobrlzep/image/upload/AVAR/AV${damageData.id}IMG${i}.jpg?t=${timestamp}`
            };
            
            // Se a URL já existe mas não tem timestamp, adiciona
            if (imgDesc.url && !imgDesc.url.includes('?t=')) {
                imgDesc.url = `${imgDesc.url}?t=${timestamp}`;
            }
            
            // Carrega a imagem com a função auxiliar
            const imageResult = await loadImageForPdf(imgDesc.url);
            
            if (imageResult.success && imageResult.img) {
                const img = imageResult.img;
                
                let imgWidth = img.width || img.naturalWidth;
                let imgHeight = img.height || img.naturalHeight;

                // Redimensiona mantendo proporção
                if (imgWidth > maxImageWidth) {
                    imgHeight = (imgHeight * maxImageWidth) / imgWidth;
                    imgWidth = maxImageWidth;
                }
                if (imgHeight > maxImageHeight) {
                    imgWidth = (imgWidth * maxImageHeight) / imgHeight;
                    imgHeight = maxImageHeight;
                }

                const textHeight = 10;
                
                // Verifica quebra de linha
                if (currentX + imgWidth > pdf.internal.pageSize.getWidth() - 15) {
                    currentX = 15;
                    startYForImages += rowMaxHeight + 10;
                    rowMaxHeight = 0;
                }
                
                // Verifica quebra de página
                if (startYForImages + imgHeight + textHeight > pdf.internal.pageSize.getHeight() - 15) {
                    pdf.addPage();
                    currentPageNumber++;
                    addPageHeadersFooters(pdf, currentPageNumber);
                    startYForImages = 15;
                    currentX = 15;
                    rowMaxHeight = 0;
                }

                try {
                    // Adiciona a imagem
                    pdf.addImage(img, 'JPEG', currentX, startYForImages, imgWidth, imgHeight);
                    
                    // Adiciona descrição
                    pdf.setFontSize(8);
                    pdf.setFont(undefined, 'normal');
                    const descText = `Imagem ${imgDesc.index}: ${imgDesc.description || 'Sem descrição'}`;
                    const descLines = pdf.splitTextToSize(descText, imgWidth);
                    pdf.text(descLines, currentX, startYForImages + imgHeight + 3);

                    rowMaxHeight = Math.max(rowMaxHeight, imgHeight + textHeight);
                    currentX += maxImageWidth + 10;
                    
                    console.log(`✅ Imagem ${i} adicionada com sucesso ao PDF`);
                } catch (addError) {
                    console.error(`❌ Erro ao adicionar imagem ${i} ao PDF:`, addError);
                }
            } else {
                console.warn(`⚠️ Falha ao carregar imagem ${i}: ${imgDesc.url}`);
                
                // Adiciona placeholder para imagem que não carregou
                const placeholderWidth = maxImageWidth;
                const placeholderHeight = 40;
                const textHeight = 10;
                
                // Verifica quebra de linha/página
                if (currentX + placeholderWidth > pdf.internal.pageSize.getWidth() - 15) {
                    currentX = 15;
                    startYForImages += rowMaxHeight + 10;
                    rowMaxHeight = 0;
                }
                
                if (startYForImages + placeholderHeight + textHeight > pdf.internal.pageSize.getHeight() - 15) {
                    pdf.addPage();
                    currentPageNumber++;
                    addPageHeadersFooters(pdf, currentPageNumber);
                    startYForImages = 15;
                    currentX = 15;
                    rowMaxHeight = 0;
                }
                
                // Desenha placeholder
                pdf.setDrawColor(200, 200, 200);
                pdf.setFillColor(245, 245, 245);
                pdf.rect(currentX, startYForImages, placeholderWidth, placeholderHeight, 'FD');
                
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.text('Imagem não disponível', currentX + placeholderWidth/2, startYForImages + placeholderHeight/2, { align: 'center' });
                
                // Restaura cor do texto
                pdf.setTextColor(0, 0, 0);
                
                // Adiciona descrição
                pdf.setFontSize(8);
                pdf.setFont(undefined, 'normal');
                const descText = `Imagem ${imgDesc.index}: ${imgDesc.description || 'Sem descrição'}`;
                pdf.text(descText, currentX, startYForImages + placeholderHeight + 5);

                rowMaxHeight = Math.max(rowMaxHeight, placeholderHeight + textHeight);
                currentX += maxImageWidth + 10;
            }
        } catch (imgError) {
            console.error(`❌ Erro ao processar imagem ${i}:`, imgError);
            continue;
        }
    }
    
    return { 
        finalY: startYForImages + rowMaxHeight + 10, 
        pageNumber: currentPageNumber 
    };
};

// ====================================================================
// FUNÇÕES PARA ORÇAMENTO DE PNEUS
// ====================================================================

/**
 * Faz upload de PDF para o Cloudinary
 */
const uploadPdfToCloudinary = async (pdfBase64, fileName) => {
    try {
        const cloudName = 'ddobrlzep';
        const uploadPreset = 'ml_default'; // Você pode precisar criar um upload preset no Cloudinary
        
        // Cria o FormData
        const formData = new FormData();
        formData.append('file', `data:application/pdf;base64,${pdfBase64}`);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'AVAR');
        formData.append('public_id', fileName.replace('.pdf', ''));
        formData.append('resource_type', 'raw');
        
        console.log('📤 Enviando para Cloudinary...');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('✅ Upload bem-sucedido!', result);
        
        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id
        };
        
    } catch (error) {
        console.error('❌ Erro ao fazer upload para Cloudinary:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Busca o último preço de pneu salvo no localStorage
 */
const getLastTirePrice = () => {
    try {
        const savedPrice = localStorage.getItem('last_tire_price');
        return savedPrice ? parseFloat(savedPrice) : 3510.00;
    } catch (error) {
        console.error('Erro ao buscar último preço de pneu:', error);
        return 3510.00; // Preço padrão
    }
};

/**
 * Salva o preço do pneu no localStorage
 */
const saveLastTirePrice = (price) => {
    try {
        localStorage.setItem('last_tire_price', price.toString());
        console.log('✅ Preço do pneu salvo com sucesso:', price);
    } catch (error) {
        console.error('Erro ao salvar preço do pneu:', error);
    }
};

/**
 * Abre o modal de orçamento de pneus
 */
const openBudgetModal = (damage) => {
    console.log('Abrindo modal de orçamento para avaria:', damage.id);
    
    // Busca o último preço salvo
    const lastPrice = getLastTirePrice();
    
    // Cria o modal
    const modalHtml = `
        <div id="budget-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="document.getElementById('budget-modal').remove()">&times;</span>
                <h2>💰 Gerar Orçamento de Pneus</h2>
                <p><strong>Avaria:</strong> #${damage.id}</p>
                
                <div style="margin: 20px 0;">
                    <label><strong>Data do Orçamento:</strong></label>
                    <input type="date" id="budget-date" class="form-control" value="${damage.damage_date || new Date().toISOString().split('T')[0]}">
                    <small>Data padrão: data da avaria</small>
                </div>
                
                <div style="margin: 20px 0;">
                    <label><strong>Preço Unitário do Pneu:</strong></label>
                    <input type="number" id="budget-tire-price" class="form-control" value="${lastPrice}" step="0.01" min="0">
                </div>
                
                <div style="margin: 20px 0;">
                    <label><strong>Quantidade de Pneus:</strong></label>
                    <input type="number" id="budget-tire-quantity" class="form-control" value="1" min="1">
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button class="btn btn-success" onclick="generateTireBudgetPDF(${damage.id})">
                        📄 Gerar PDF
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('budget-modal').remove()">
                        ❌ Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove modal anterior se existir
    const existingModal = document.getElementById('budget-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Adiciona o novo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Gera o PDF do orçamento de pneus
 */
window.generateTireBudgetPDF = async (damageId) => {
    try {
        showSpinner();
        
        // Busca a avaria para obter a data dela
        const damage = appState.damages.find(d => d.id == damageId);
        
        // Busca dados do formulário
        const dateInput = document.getElementById('budget-date').value;
        const priceInput = parseFloat(document.getElementById('budget-tire-price').value) || 3510.00;
        const quantityInput = parseInt(document.getElementById('budget-tire-quantity').value) || 1;
        
        // Define a data (usa data da avaria se vazio, ou hoje como último recurso)
        let budgetDate;
        if (dateInput) {
            budgetDate = new Date(dateInput + 'T00:00:00');
        } else if (damage && damage.damage_date) {
            budgetDate = new Date(damage.damage_date + 'T00:00:00');
        } else {
            budgetDate = new Date();
        }
        const formattedDate = budgetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
        
        // Calcula o total
        const total = priceInput * quantityInput;
        
        // Salva o último preço usado
        await saveLastTirePrice(priceInput);
        
        // Cria o PDF em formato PAISAGEM (landscape)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        
        // ========================================
        // VARIÁVEIS DE CONTROLE DE POSIÇÃO (AJUSTE AQUI!)
        // ========================================
        const LOGO_Y = 8;          // Posição Y da logo (padrão: 8)
        const CLIENTE_Y = 42;      // Posição Y da linha do cliente (padrão: 42)
        const DATA_Y = 62;         // Posição Y da data (padrão: 62)
        const TABELA_Y = 75;       // Posição Y da tabela (padrão: 75)
        const INFO_Y = 170;        // Posição Y das informações finais (padrão: 170)
        // ========================================
        
        // Carrega a logo da TC Pneus
        const logoUrl = 'https://res.cloudinary.com/ddobrlzep/image/upload/logo/TCPNEUS.jpg?t=' + new Date().getTime();
        
        let logoLoaded = false;
        try {
            const logoResult = await loadImageForPdf(logoUrl, 8000);
            
            if (logoResult.success && logoResult.img) {
                // Adiciona a logo no canto superior esquerdo
                pdf.addImage(logoResult.img, 'JPEG', 20, LOGO_Y, 50, 25);
                logoLoaded = true;
                console.log('✅ Logo da TC Pneus carregada com sucesso');
            }
        } catch (logoError) {
            console.warn('⚠️ Logo não carregada:', logoError);
        }
        
        // Cliente
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('CLIENTE:', 20, CLIENTE_Y);
        
        // Linha horizontal sob CLIENTE
        pdf.setLineWidth(0.5);
        pdf.line(60, CLIENTE_Y + 2, 277, CLIENTE_Y + 2);
        
        pdf.setFontSize(16);
        pdf.text('PBA', 130, CLIENTE_Y);
        
        // Data - Formatação simplificada
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        
        // Posiciona a data no lado direito
        const pageWidth = pdf.internal.pageSize.getWidth();
        const dateX = pageWidth - 110;
        
        // Escreve a data de forma simples e centrada
        pdf.text(formattedDate, dateX, DATA_Y);
        
        // Cabeçalho da tabela (ajustado para paisagem)
        const tableWidth = 257;
        const tableX = 20;
        const tableY = TABELA_Y;
        
        pdf.setFillColor(0, 51, 102); // Azul escuro
        pdf.rect(tableX, tableY, tableWidth, 10, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text('ITEM', tableX + 5, tableY + 7);
        pdf.text('PRODUTO', tableX + 70, tableY + 7);
        pdf.text('QTDE', tableX + 180, tableY + 7);
        pdf.text('PREÇO UNIT.', tableX + 200, tableY + 7);
        pdf.text('TOTAL', tableX + 235, tableY + 7);
        
        // Volta cor do texto para preto
        pdf.setTextColor(0, 0, 0);
        
        // Linhas da tabela
        const startY = tableY + 10;
        for (let i = 0; i <= 7; i++) {
            const y = startY + (i * 10);
            pdf.setDrawColor(200, 200, 200);
            pdf.line(tableX, y, tableX + tableWidth, y);
            
            if (i === 0) {
                // Primeira linha com dados
                pdf.setFont(undefined, 'bold');
                pdf.text('01', tableX + 5, y + 7);
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(10);
                pdf.text('PNEU 295/80R22.5 ARMOR MAX MSD PLUS 152', tableX + 30, y + 7);
                pdf.setFontSize(11);
                pdf.text(quantityInput.toString().padStart(2, '0'), tableX + 182, y + 7);
                pdf.text(formatCurrency(priceInput), tableX + 200, y + 7);
                pdf.text(formatCurrency(priceInput * quantityInput), tableX + 230, y + 7);
            } else if (i < 7) {
                // Linhas vazias numeradas
                pdf.setFont(undefined, 'bold');
                pdf.text((i + 1).toString().padStart(2, '0'), tableX + 5, y + 7);
            }
        }
        
        // Linha do total
        const totalY = startY + 70;
        pdf.setFillColor(220, 220, 220);
        pdf.rect(tableX, totalY, tableWidth, 10, 'F');
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(11);
        pdf.text('TOTAL', tableX + 80, totalY + 7);
        pdf.text(quantityInput.toString().padStart(2, '0'), tableX + 182, totalY + 7);
        pdf.text(formatCurrency(priceInput), tableX + 200, totalY + 7);
        pdf.text(formatCurrency(total), tableX + 230, totalY + 7);
        
        // Borda externa da tabela
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(tableX, tableY, tableWidth, 90);
        
        // Linhas verticais da tabela
        pdf.line(tableX + 25, tableY, tableX + 25, tableY + 90);  // Após ITEM
        pdf.line(tableX + 175, tableY, tableX + 175, tableY + 90); // Após PRODUTO
        pdf.line(tableX + 195, tableY, tableX + 195, tableY + 90); // Após QTDE
        pdf.line(tableX + 225, tableY, tableX + 225, tableY + 90); // Após PREÇO UNIT.
        
        // Informações finais (usando variável de controle)
        // A4 Paisagem tem 210mm de altura, com margem de 15mm embaixo, limite é 195mm
        let infoY = INFO_Y;
        const infoX = 20;
        const lineEndX = 277;
        
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text('FORMA DE PAGAMENTO:', infoX, infoY);
        pdf.setFont(undefined, 'normal');
        pdf.text('A VISTA', infoX + 100, infoY);
        pdf.line(infoX + 85, infoY + 2, lineEndX, infoY + 2);
        
        infoY += 10;
        pdf.setFont(undefined, 'bold');
        pdf.text('VALIDADE DO ORÇAMENTO:', infoX, infoY);
        pdf.setFont(undefined, 'normal');
        pdf.text('1 DIA', infoX + 100, infoY);
        pdf.line(infoX + 85, infoY + 2, lineEndX, infoY + 2);
        
        infoY += 10;
        pdf.setFont(undefined, 'bold');
        pdf.text('CONTATO:', infoX, infoY);
        pdf.setFont(undefined, 'normal');
        pdf.text('IRLO FERNANDO', infoX + 100, infoY);
        pdf.line(infoX + 85, infoY + 2, lineEndX, infoY + 2);
        
        infoY += 10;
        pdf.setFont(undefined, 'bold');
        pdf.text('CELULAR:', infoX, infoY);
        pdf.setFont(undefined, 'normal');
        pdf.text('(87) 9 9965 - 0070', infoX + 100, infoY);
        pdf.line(infoX + 85, infoY + 2, lineEndX, infoY + 2);
        
        // Nome do PDF no formato AV{ID}AN1.pdf
        const pdfFileName = `AV${damageId}AN1.pdf`;
        
        // Gera o PDF
        const pdfBlob = pdf.output('blob');
        
        // Fecha o modal
        const modal = document.getElementById('budget-modal');
        if (modal) {
            modal.remove();
        }
        
        // Cria URL local para download
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Cria link temporário para fazer download com o nome correto
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = pdfFileName;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        
        // Abre em nova aba E faz download
        window.open(pdfUrl, '_blank');
        downloadLink.click();
        
        // Remove o link temporário
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(pdfUrl);
        }, 100);
        
        hideSpinner();
        console.log(`✅ Orçamento gerado com sucesso: ${pdfFileName}`);
        
        // REMOVIDO: Upload para Cloudinary (estava causando erro 400)
        // Se você precisar do upload, será necessário configurar corretamente o Cloudinary
        
    } catch (error) {
        hideSpinner();
        console.error('❌ Erro ao gerar orçamento:', error);
        alert('Erro ao gerar orçamento: ' + error.message);
    }
};

/**
 * FUNÇÃO EXPORTADA: Adiciona páginas de avaria a um PDF existente (para uso em relatórios de medição)
 * @param {Object} pdf - Objeto jsPDF existente
 * @param {Object} damageData - Dados da avaria
 * @param {Function} addPageHeadersFooters - Função para adicionar cabeçalho/rodapé
 * @param {Number} currentPageNumber - Número da página atual
 * @returns {Promise<Number>} - Retorna o novo número de página após adicionar as avarias
 */
export const addDamagePagesToExistingPDF = async (pdf, damageData, addPageHeadersFooters, currentPageNumber) => {
    console.log(`📄 Adicionando avaria ${damageData.id} ao PDF de medição...`);
    
    try {
        // Carrega os itens da avaria
        const damageItems = await loadDamageItemsForPdf(damageData.id);
        
        // Garante que equipment_types esteja carregado para getEquipTypeName()
        if (!appState.equipment_types || appState.equipment_types.length === 0) {
            appState.equipment_types = await apiClient.fetchData('equipment_types');
        }

        // Busca dados relacionados
        const work = appState.works.find(w => w.id == damageData.work_id);
        const equipment = appState.equipment.find(e => e.id == damageData.equipment_id);
        const client = work ? appState.client_companies.find(c => c.id == work.client_company_id) : null;
        
        // Nova página para a avaria
        pdf.addPage();
        currentPageNumber++;
        addPageHeadersFooters(pdf, currentPageNumber);
        
        let y = 30;
        
        // Título
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(`RELATÓRIO DE AVARIA - CÓD: ${damageData.id}`, 15, y);
        y += 10;

        // Informações básicas
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Obra: ${work?.name || 'N/A'}`, 15, y); y += 5;
        const equipmentWorkPrefixDisplay = damageData.equipment_work_prefix ? ` - ${damageData.equipment_work_prefix}` : '';
        pdf.text(`Equipamento: ${equipment?.prefix || 'N/A'}${equipmentWorkPrefixDisplay} - ${getEquipTypeName(equipment?.type) || 'N/A'}`, 15, y); y += 5;
        pdf.text(`Data da Avaria: ${new Date(damageData.damage_date + 'T00:00:00').toLocaleDateString('pt-BR')}`, 15, y); y += 10;

        // Observações
        pdf.setFont(undefined, 'bold');
        pdf.text('Observações Gerais:', 15, y); y += 5;
        pdf.setFont(undefined, 'normal');
        const obsLines = pdf.splitTextToSize(damageData.observations || 'Nenhuma observação.', 180);
        pdf.text(obsLines, 15, y);
        y += (obsLines.length * 4) + 10;

        // Tabela de itens
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Itens de Despesa da Avaria', 15, y); y += 5;

        const tableHeaders = [['DESCRIÇÃO', 'VALOR UNIT. (R$)', 'QTD.', 'TOTAL (R$)', 'OBSERVAÇÃO']];
        const tableBody = [];
        let itemsGrandTotal = 0;

        if (damageItems.length > 0) {
            damageItems.forEach(item => {
                const itemValue = parseFloat(item.value) || 0;
                const itemQuantity = parseInt(item.quantity) || 1;
                const total = itemValue * itemQuantity;
                itemsGrandTotal += total;
                
                tableBody.push([
                    item.description || 'N/A',
                    formatCurrency(itemValue),
                    itemQuantity.toString(),
                    formatCurrency(total),
                    item.notes || '---'
                ]);
            });
        } else {
            const directValue = parseFloat(damageData.total_value) || 0;
            itemsGrandTotal = directValue;
            
            tableBody.push([
                damageData.value_description || 'Valor direto da avaria',
                formatCurrency(directValue),
                '1',
                formatCurrency(directValue),
                '---'
            ]);
        }

        // Linha de total - mescla as 3 primeiras colunas
        tableBody.push([
            { content: 'Total Geral:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
            formatCurrency(itemsGrandTotal),
            ''
        ]);

        pdf.autoTable({
            startY: y,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 30, halign: 'right' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 55 }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > currentPageNumber) {
                    currentPageNumber = data.pageNumber;
                    addPageHeadersFooters(pdf, currentPageNumber);
                }
            },
            didParseCell: (data) => {
                if (data.row.index === tableBody.length - 1 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });
        
        y = pdf.lastAutoTable.finalY + 10;

        // Processa imagens IMG
        if (damageData.image_count > 0) {
            const imageResult = await processImagesForPdf(pdf, damageData, y, currentPageNumber, addPageHeadersFooters);
            currentPageNumber = imageResult.pageNumber;
            y = imageResult.finalY;
        }

        // Processa anexos AN (cada um em nova página)
        if (damageData.attachment_count > 0) {
            console.log(`📎 Processando ${damageData.attachment_count} anexos da avaria ${damageData.id}...`);
            const timestamp = new Date().getTime();
            
            for (let i = 1; i <= damageData.attachment_count; i++) {
                const attachmentUrl = `https://res.cloudinary.com/ddobrlzep/image/upload/AVAR/AV${damageData.id}AN${i}.jpg?t=${timestamp}`;
                const imageResult = await loadImageForPdf(attachmentUrl);

                pdf.addPage();
                currentPageNumber++;
                addPageHeadersFooters(pdf, currentPageNumber);

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 15;

                if (imageResult.success && imageResult.img) {
                    const img = imageResult.img;
                    let imgWidth = img.width || img.naturalWidth;
                    let imgHeight = img.height || img.naturalHeight;

                    const maxWidth = pageWidth - (2 * margin);
                    const maxHeight = pageHeight - (2 * margin) - 20;

                    let ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                    imgWidth *= ratio;
                    imgHeight *= ratio;

                    const imgX = (pageWidth - imgWidth) / 2;
                    const imgY = (pageHeight - imgHeight) / 2;

                    pdf.addImage(img, 'JPEG', imgX, imgY, imgWidth, imgHeight);
                } else {
                    const placeholderWidth = pageWidth - (2 * margin);
                    const placeholderHeight = pageHeight / 3;

                    pdf.setDrawColor(200, 200, 200);
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin, (pageHeight - placeholderHeight) / 2, placeholderWidth, placeholderHeight, 'FD');
                    
                    pdf.setFontSize(14);
                    pdf.setTextColor(150, 150, 150);
                    pdf.text(`ANEXO ${i} - Imagem não disponível`, pageWidth / 2, pageHeight / 2, { align: 'center' });
                    pdf.setTextColor(0, 0, 0);
                }
                
                pdf.setFontSize(12);
                pdf.setFont(undefined, 'bold');
                pdf.text(`ANEXO ${i}`, pageWidth / 2, margin + 10, { align: 'center' });
            }
        }

        console.log(`✅ Avaria ${damageData.id} adicionada ao PDF`);
        return currentPageNumber;
        
    } catch (error) {
        console.error(`❌ Erro ao adicionar avaria ${damageData.id} ao PDF:`, error);
        return currentPageNumber;
    }
};