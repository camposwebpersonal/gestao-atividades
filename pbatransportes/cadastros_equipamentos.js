// cadastros_equipamentos.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, openModal, closeModal, formatFieldValue, formatInputDate, createFormForCrud } from './utils.js';
import { apiClient } from './api.js';

const crudConfig = {
    key: 'equipment',
    title: 'Equipamentos',
    fields: [
        // Ordem dos campos alterada para exibir 'Tipo de Equipamento' e 'Tipo de Rodante' primeiro na tabela e formulário
        { name: 'type', label: 'Tipo de Equipamento', type: 'select', optionsKey: 'equipment_types', required: true },
        { name: 'type_short', label: 'Tipo Abreviado', type: 'text', placeholder: 'Preenchido automaticamente', readOnly: true },
        {
            name: 'rolling_type',
            label: 'Tipo de Rodante',
            type: 'select',
            options: [
                { value: '', text: 'Selecione...' }, // Opção vazia
                { value: 'rodante', text: 'Rodante' },
                { value: 'nao_rodante', text: 'Não Rodante' }
            ],
            required: true // Campo obrigatório
        },
        { name: 'prefix', label: 'Prefixo', type: 'text', required: true },
        { name: 'brand', label: 'Marca', type: 'text' },
        { name: 'model', label: 'Modelo', 'type': 'text' },
        { name: 'characteristic', label: 'Característica', type: 'text' }, // NOVO CAMPO
        { name: 'year', label: 'Ano', type: 'number' },
        { name: 'chassi', label: 'Chassi do Equipamento', type: 'text' },
        { name: 'capacidade', label: 'Capacidade', type: 'text' },
        { name: 'is_terceirizado', label: 'É Terceirizado?', type: 'checkbox' },
        { name: 'terceirizado_id', label: 'Empresa Proprietária (Terceirizada)', type: 'select', optionsKey: 'terceirizados', dependsOn: 'is_terceirizado', allowNone: true },
        { name: 'my_company_id', label: 'Minha Empresa (Proprietária)', type: 'select', optionsKey: 'my_companies', dependsOn: 'is_terceirizado', inverseDependsOn: true, allowNone: true },
        { name: 'maintenance_interval_hours', label: 'Intervalo Revisão (horas)', type: 'number' },
        { name: 'last_maintenance_date', label: 'Data Última Revisão', type: 'date' },
        { name: 'last_maintenance_horometer', label: 'Horímetro Última Revisão', type: 'number', step: '0.01' },
        { name: 'image_url_auto', label: 'URL da Imagem (Automática)', type: 'text', readOnly: true },
        { name: 'image_url_manual', label: 'URL da Imagem (Manual)', type: 'text' }
    ],
    table: 'equipment'
};

/**
 * Inicializa a interface de CRUD para Equipamentos.
 * @param {string} key - A chave de configuração do CRUD (neste caso, 'equipment').
 */
export const initCrudEquipamentos = async (key) => {
    const genericCrudContainer = document.getElementById('generic-crud-container');
    if (!genericCrudContainer) {
        console.error('Elemento #generic-crud-container não encontrado.');
        return;
    }

    genericCrudContainer.innerHTML = `
        <button class="btn btn-secondary" id="back-to-crud-menu-specific">‹ Voltar ao Menu de Cadastros</button>
        <div class="section-header">
            <h2>${crudConfig.title}</h2>
            <button class="btn btn-primary" id="add-new-item-btn">Adicionar Novo</button>
        </div>
        <div class="table-wrapper responsive">
            <table id="crud-table">
                <thead></thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    document.getElementById('back-to-crud-menu-specific')?.addEventListener('click', () => {
        import('./cadastros.js').then(module => module.renderCrudMenu());
    });

    document.getElementById('add-new-item-btn')?.addEventListener('click', () => handleAddItem(crudConfig.key));

    await loadAndRenderCrudData(crudConfig.key);
};

/**
 * Carrega e renderiza os dados para a tabela CRUD específica.
 * @param {string} key - A chave de configuração do CRUD.
 */
const loadAndRenderCrudData = async (key) => {
    showSpinner();
    const config = crudConfig;
    const table = document.getElementById('crud-table');
    const thead = table?.querySelector('thead');
    const tbody = table?.querySelector('tbody');

    if (!table || !thead || !tbody) {
        console.error('Elementos da tabela CRUD não encontrados.');
        hideSpinner();
        return;
    }

    if (appState.terceirizados.length === 0) {
        try {
            const terceirizadosData = await apiClient.fetchData('terceirizados');
            appState.terceirizados = terceirizadosData;
        } catch (e) {
            console.error('Falha ao carregar terceirizados:', e);
        }
    }
    if (appState.my_companies.length === 0) {
        try {
            const myCompaniesData = await apiClient.fetchData('my_companies');
            appState.my_companies = myCompaniesData;
        } catch (e) {
            console.error('Falha ao carregar minhas empresas:', e);
        }
    }
    
    // 🎯 Carregar tipos de equipamentos
    if (!appState.equipment_types || appState.equipment_types.length === 0) {
        try {
            const equipmentTypesData = await apiClient.fetchData('equipment_types', 'id, name, short_name');
            appState.equipment_types = equipmentTypesData;
            console.log('✅ Tipos de equipamentos carregados:', appState.equipment_types);
        } catch (e) {
            console.error('Falha ao carregar tipos de equipamentos:', e);
            appState.equipment_types = [];
        }
    }

    // Altera a ordem dos cabeçalhos: Ações, Imagem e depois os campos
    const headers = ['Ações', 'Imagem', ...config.fields.map(f => f.label)];
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';

    try {
        const data = await apiClient.fetchData(config.table, '*, terceirizados(name), my_companies(name)');
        
        // 🎯 PREENCHER AUTOMATICAMENTE type_short FALTANTES NO BANCO
        console.log('🔍 Verificando equipamentos sem type_short...');
        const equipmentosParaAtualizar = data.filter(item => {
            // Verificar se tem type mas não tem type_short
            if (item.type && !item.type_short) {
                const equipmentType = appState.equipment_types?.find(et => 
                    et.id == item.type || et.name === item.type
                );
                return equipmentType && equipmentType.short_name; // Só atualizar se encontrar o tipo
            }
            return false;
        });

        if (equipmentosParaAtualizar.length > 0) {
            console.log(`⚡ Salvando type_short para ${equipmentosParaAtualizar.length} equipamentos...`);
            
            // Atualizar cada equipamento
            const updatePromises = equipmentosParaAtualizar.map(async (item) => {
                const equipmentType = appState.equipment_types?.find(et => 
                    et.id == item.type || et.name === item.type
                );
                
                if (equipmentType) {
                    try {
                        await apiClient.updateItem('equipment', item.id, {
                            type_short: equipmentType.short_name,
                            type: equipmentType.id // Atualizar para ID se estiver como nome
                        });
                        console.log(`✅ Atualizado equipamento ${item.prefix}: ${equipmentType.short_name}`);
                        
                        // Atualizar no array local também
                        item.type_short = equipmentType.short_name;
                        item.type = equipmentType.id;
                    } catch (error) {
                        console.error(`❌ Erro ao atualizar ${item.prefix}:`, error);
                    }
                }
            });

            await Promise.all(updatePromises);
            console.log('✅ Todos os type_short foram salvos no banco!');
        } else {
            console.log('✅ Todos os equipamentos já têm type_short preenchido!');
        }
        

        // Ordenar os dados por 'type' (Tipo de Equipamento) e depois por 'prefix'
        data.sort((a, b) => {
            // Buscar nome do tipo se for ID
            const getTypeName = (typeValue) => {
                if (!typeValue) return '';
                const equipmentType = appState.equipment_types?.find(et => et.id == typeValue);
                return equipmentType ? equipmentType.name.toUpperCase() : String(typeValue).toUpperCase();
            };
            
            const typeA = getTypeName(a.type);
            const typeB = getTypeName(b.type);
            if (typeA < typeB) return -1;
            if (typeA > typeB) return 1;

            const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
            const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
            if (prefixA < prefixB) return -1;
            if (prefixA > prefixB) return 1;
            return 0;
        });

        appState[key] = data;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${headers.length}">Nenhum item cadastrado.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            let rowHTML = '';

            // CONSTRUÇÃO DA CÉLULA DE AÇÕES (AGORA NA PRIMEIRA POSIÇÃO)
            rowHTML += `
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${item.id}" data-action="edit">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${item.id}" data-action="delete">Excluir</button>
                </td>
            `;

            // ADICIONA A CÉLULA DA IMAGEM
            const imageUrl = item.image_url || '';
            // Adiciona um timestamp à URL da imagem para evitar cache do navegador
            const cacheBustedImageUrl = imageUrl ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}` : '';
            rowHTML += `<td data-label="Imagem">${cacheBustedImageUrl ? `<img src="${cacheBustedImageUrl}" alt="Miniatura" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.onerror=null;this.src='https://placehold.co/50x50/e0e0e0/555555?text=Sem+Img';">` : 'Sem Imagem'}</td>`;

            // ADICIONA AS CÉLULAS DOS DEMAIS CAMPOS
            config.fields.forEach((f) => {
                let formattedValue = formatFieldValue(item[f.name], f.type);
                
                // 🎯 Buscar nome do tipo de equipamento se for um ID
                if (f.name === 'type' && item[f.name]) {
                    const equipmentType = appState.equipment_types?.find(et => et.id == item[f.name]);
                    formattedValue = equipmentType ? equipmentType.name : item[f.name];
                } else if (f.name === 'type_short') {
                    // 🎯 Preencher automaticamente type_short se estiver vazio
                    if (!item[f.name] && item.type) {
                        const equipmentType = appState.equipment_types?.find(et => 
                            et.id == item.type || et.name === item.type
                        );
                        formattedValue = equipmentType ? equipmentType.short_name : '---';
                    } else {
                        formattedValue = item[f.name] || '---';
                    }
                } else if (f.name === 'terceirizado_id' && item[f.name]) {
                    const terceirizado = appState.terceirizados.find(t => t.id == item[f.name]);
                    formattedValue = terceirizado ? terceirizado.name : 'N/A';
                } else if (f.name === 'my_company_id' && item[f.name]) {
                    const myCompany = appState.my_companies.find(mc => mc.id == item[f.name]);
                    formattedValue = myCompany ? myCompany.name : 'N/A';
                }
                else if (f.name === 'image_url_auto') {
                    const prefix = item.prefix || '';
                    const formattedPrefix = prefix.replace(/\s+/g, '_').toUpperCase();
                    const autoGeneratedUrl = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${formattedPrefix}.jpg`;
                    
                    if (item.image_url_manual) {
                        formattedValue = '--- (URL Manual em uso)';
                    } else {
                        formattedValue = `<a href="${autoGeneratedUrl}" target="_blank">${autoGeneratedUrl}</a>`;
                    }
                } else if (f.name === 'image_url_manual' && item[f.name]) {
                    formattedValue = `<a href="${item[f.name]}" target="_blank">${item[f.name]}</a>`;
                }
                else if (f.name === 'rolling_type') {
                    formattedValue = item[f.name] === 'rodante' ? 'Rodante' : (item[f.name] === 'nao_rodante' ? 'Não Rodante' : formattedValue);
                }
                
                rowHTML += `<td data-label="${f.label}">${formattedValue}</td>`;
            });
            row.innerHTML = rowHTML;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => handleEditItem(key, btn.dataset.id)));
        tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => handleDeleteItem(key, btn.dataset.id)));

    } catch (error) {
        console.error(`Erro ao carregar ${config.title}:`, error);
        alert(`Não foi possível carregar os dados de ${config.title}. Verifique a conexão e a configuração da API.`);
    } finally {
        hideSpinner();
    }
};

/**
 * Lida com a adição de um novo item de CRUD.
 * @param {string} key - A chave de configuração do CRUD.
 */
const handleAddItem = (key) => {
    const config = crudConfig;
    const form = createFormForCrud(config);

    const prefixInput = form.querySelector('#field-prefix');
    const autoUrlInput = form.querySelector('#field-image_url_auto');
    const manualUrlInput = form.querySelector('#field-image_url_manual');
    const isTerceirizadoCheckbox = form.querySelector('#field-is_terceirizado');
    const rollingTypeSelect = form.querySelector('#field-rolling_type'); // Get the select element
    const typeSelect = form.querySelector('#field-type'); // 🎯 Tipo de equipamento select
    const typeShortInput = form.querySelector('#field-type_short'); // 🎯 Tipo abreviado input

    // 🎯 Listener para preencher automaticamente o tipo abreviado
    if (typeSelect && typeShortInput) {
        typeSelect.addEventListener('change', () => {
            const selectedValue = typeSelect.value;
            console.log('🔍 [openFormModal] Valor selecionado:', selectedValue);
            console.log('🔍 [openFormModal] Tipos disponíveis:', appState.equipment_types);
            
            // Buscar por ID ou por nome (compatibilidade com dados antigos)
            const equipmentType = appState.equipment_types?.find(et => 
                et.id == selectedValue || et.name === selectedValue
            );
            console.log('🔍 [openFormModal] Equipment type encontrado:', equipmentType);
            
            if (equipmentType) {
                typeShortInput.value = equipmentType.short_name || '';
                console.log('✅ [openFormModal] Tipo abreviado preenchido:', equipmentType.short_name);
            } else {
                typeShortInput.value = '';
            }
        });
    }

    // Manually populate rolling_type options if they are not already populated
    const rollingTypeFieldConfig = config.fields.find(f => f.name === 'rolling_type');
    if (rollingTypeSelect && rollingTypeFieldConfig && rollingTypeFieldConfig.options) {
        rollingTypeSelect.innerHTML = ''; // Clear existing options
        rollingTypeFieldConfig.options.forEach(option => {
            const optElem = document.createElement('option');
            optElem.value = option.value;
            optElem.textContent = option.text;
            rollingTypeSelect.appendChild(optElem);
        });
    }

    const toggleCompanyFields = () => {
        const terceirizadoGroup = form.querySelector('#group-terceirizado_id');
        const myCompanyGroup = form.querySelector('#group-my_company_id');
        
        if (isTerceirizadoCheckbox.checked) {
            if (terceirizadoGroup) terceirizadoGroup.style.display = 'block';
            if (myCompanyGroup) myCompanyGroup.style.display = 'none';
        } else {
            if (terceirizadoGroup) terceirizadoGroup.style.display = 'none';
            if (myCompanyGroup) myCompanyGroup.style.display = 'block';
        }
    };

    if (isTerceirizadoCheckbox) {
        isTerceirizadoCheckbox.addEventListener('change', toggleCompanyFields);
    }
    toggleCompanyFields();

    const generateImageUrl = () => {
        if (prefixInput && autoUrlInput) {
            const prefixValue = prefixInput.value.replace(/\s+/g, '_').toUpperCase();
            autoUrlInput.value = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${prefixValue}.jpg`;
        }
    };

    if (prefixInput) {
        prefixInput.addEventListener('input', generateImageUrl);
    }

    const toggleUrlInputs = () => {
        if (manualUrlInput && manualUrlInput.value) {
            if (autoUrlInput) autoUrlInput.disabled = true;
        } else {
            if (autoUrlInput) autoUrlInput.disabled = false;
        }
    };
    
    if (manualUrlInput) {
        manualUrlInput.addEventListener('input', toggleUrlInputs);
    }
    
    generateImageUrl();
    toggleUrlInputs();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newItem = {};
        config.fields.forEach(f => {
            if (f.name === 'image_url_auto') return;
            
            if (f.type === 'checkbox') {
                newItem[f.name] = formData.has(f.name);
            } else {
                const value = formData.get(f.name);
                newItem[f.name] = value === '' ? null : value;
            }
        });
        
        if (newItem.image_url_manual) {
            newItem.image_url = newItem.image_url_manual;
        } else if (newItem.prefix) {
            newItem.image_url = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${newItem.prefix.replace(/\s+/g, '_').toUpperCase()}.jpg`;
        } else {
            newItem.image_url = null;
        }

        if (newItem.is_terceirizado === false) {
            newItem.terceirizado_id = null;
        } else {
            newItem.my_company_id = null;
        }

        showSpinner();
        try {
            await apiClient.addItem(config.table, newItem);
            closeModal();
            await loadAndRenderCrudData(key);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            hideSpinner();
        }
    });

    openModal(`Adicionar ${config.title}`, form);
};

/**
 * Lida com a edição de um item de CRUD existente.
 * @param {string} key - A chave de configuração do CRUD.
 * @param {string|number} id - O ID do item a ser editado.
 */
const handleEditItem = (key, id) => {
    const config = crudConfig;
    const item = appState[key].find(i => i.id == id);
    if (!item) {
        console.warn(`Item com ID ${id} não encontrado para edição em ${key}.`);
        return;
    }

    item.image_url_manual = item.image_url_manual || ''; 
    const prefixValue = item.prefix ? item.prefix.replace(/\s+/g, '_').toUpperCase() : '';
    item.image_url_auto = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${prefixValue}.jpg`;

    const form = createFormForCrud(config, item);

    const prefixInput = form.querySelector('#field-prefix');
    const autoUrlInput = form.querySelector('#field-image_url_auto');
    const manualUrlInput = form.querySelector('#field-image_url_manual');
    const isTerceirizadoCheckbox = form.querySelector('#field-is_terceirizado');
    const rollingTypeSelect = form.querySelector('#field-rolling_type'); // Get the select element
    const typeSelect = form.querySelector('#field-type'); // 🎯 Tipo de equipamento select
    const typeShortInput = form.querySelector('#field-type_short'); // 🎯 Tipo abreviado input

    // 🎯 Listener para preencher automaticamente o tipo abreviado
    if (typeSelect && typeShortInput) {
        typeSelect.addEventListener('change', () => {
            const selectedValue = typeSelect.value;
            console.log('🔍 [openEditModal] Valor selecionado:', selectedValue);
            console.log('🔍 [openEditModal] Tipos disponíveis:', appState.equipment_types);
            
            // Buscar por ID ou por nome (compatibilidade com dados antigos)
            const equipmentType = appState.equipment_types?.find(et => 
                et.id == selectedValue || et.name === selectedValue
            );
            console.log('🔍 [openEditModal] Equipment type encontrado:', equipmentType);
            
            if (equipmentType) {
                typeShortInput.value = equipmentType.short_name || '';
                console.log('✅ [openEditModal] Tipo abreviado preenchido:', equipmentType.short_name);
            } else {
                typeShortInput.value = '';
            }
        });
    }

    // Manually populate rolling_type options if they are not already populated
    const rollingTypeFieldConfig = config.fields.find(f => f.name === 'rolling_type');
    if (rollingTypeSelect && rollingTypeFieldConfig && rollingTypeFieldConfig.options) {
        rollingTypeSelect.innerHTML = ''; // Clear existing options
        rollingTypeFieldConfig.options.forEach(option => {
            const optElem = document.createElement('option');
            optElem.value = option.value;
            optElem.textContent = option.text;
            rollingTypeSelect.appendChild(optElem);
        });
        // Set the selected value if the item has one
        if (item && item.rolling_type !== undefined && item.rolling_type !== null) {
            rollingTypeSelect.value = item.rolling_type;
        }
    }


    const toggleCompanyFields = () => {
        const terceirizadoGroup = form.querySelector('#group-terceirizado_id');
        const myCompanyGroup = form.querySelector('#group-my_company_id');
        
        if (isTerceirizadoCheckbox.checked) {
            if (terceirizadoGroup) terceirizadoGroup.style.display = 'block';
            if (myCompanyGroup) myCompanyGroup.style.display = 'none';
        } else {
            if (terceirizadoGroup) terceirizadoGroup.style.display = 'none';
            if (myCompanyGroup) myCompanyGroup.style.display = 'block';
        }
    };

    if (isTerceirizadoCheckbox) {
        isTerceirizadoCheckbox.addEventListener('change', toggleCompanyFields);
    }
    toggleCompanyFields();


    const generateImageUrl = () => {
        if (prefixInput && autoUrlInput) {
            const prefixValue = prefixInput.value.replace(/\s+/g, '_').toUpperCase();
            autoUrlInput.value = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${prefixValue}.jpg`;
        }
    };

    if (prefixInput) {
        prefixInput.addEventListener('input', generateImageUrl);
    }

    const toggleUrlInputs = () => {
        if (manualUrlInput && manualUrlInput.value) {
            if (autoUrlInput) autoUrlInput.disabled = true;
        } else {
            if (autoUrlInput) autoUrlInput.disabled = false;
        }
    };
    
    if (manualUrlInput) {
        manualUrlInput.addEventListener('input', toggleUrlInputs);
    }
    
    generateImageUrl();
    toggleUrlInputs();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedItem = {};
        config.fields.forEach(f => {
            if (f.name === 'image_url_auto') return;
            
            if (f.type === 'checkbox') {
                updatedItem[f.name] = formData.has(f.name);
            } else {
                const value = formData.get(f.name);
                updatedItem[f.name] = value === '' ? null : value;
            }
        });

        if (updatedItem.image_url_manual) {
            updatedItem.image_url = updatedItem.image_url_manual;
        } else if (updatedItem.prefix) {
            updatedItem.image_url = `https://res.cloudinary.com/ddobrlzep/image/upload/EQP/${updatedItem.prefix.replace(/\s+/g, '_').toUpperCase()}.jpg`;
        } else {
            updatedItem.image_url = null;
        }

        if (updatedItem.is_terceirizado === false) {
            updatedItem.terceirizado_id = null;
        } else {
            updatedItem.my_company_id = null;
        }

        showSpinner();
        try {
            await apiClient.updateItem(config.table, id, updatedItem);
            closeModal();
            await loadAndRenderCrudData(key);
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            alert(`Erro ao atualizar: ${error.message}`);
        } finally {
            hideSpinner();
        }
    });

    openModal(`Editar ${config.title}`, form);
};

/**
 * Lida com a exclusão de um item de CRUD.
 * @param {string} key - A chave de configuração do CRUD.
 * @param {string|number} id - O ID do item a ser excluído.
 */
const handleDeleteItem = async (key, id) => {
    const config = crudConfig;
    // Substituindo confirm nativo por modal customizado
    const confirmDelete = await new Promise(resolve => {
        showModal('Confirmar Exclusão', `Tem certeza que deseja excluir este item de ${config.title}? Esta ação não pode ser desfeita.<br><br><button id="confirm-delete-btn" class="btn btn-danger">Sim, Excluir</button> <button id="cancel-delete-btn" class="btn btn-secondary">Cancelar</button>`);
        document.getElementById('confirm-delete-btn').onclick = () => { resolve(true); hideModal(); };
        document.getElementById('cancel-delete-btn').onclick = () => { resolve(false); hideModal(); };
    });

    if (!confirmDelete) {
        return;
    }

    showSpinner();
    try {
        await apiClient.deleteItem(config.table, id);
        await loadAndRenderCrudData(key);
        showModal('Sucesso!', 'Item excluído com sucesso!'); // Mensagem de sucesso
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showModal('Erro ao Excluir', `Erro ao excluir: ${error.message}`); // Usando modal customizado
    } finally {
        hideSpinner();
    }
};

// Funções auxiliares para modal (copiadas de proposals_equipment.js para garantir que funcionem aqui também)
function showModal(title, message) {
    const modal = document.getElementById('generic-modal');
    if (!modal) {
        console.error('Elemento #generic-modal não encontrado. Crie-o no seu HTML.');
        alert(`${title}: ${message}`); // Fallback para alert se o modal não existir
        return;
    }
    const modalTitle = modal.querySelector('#modal-title');
    const modalBody = modal.querySelector('#modal-body');
    const closeButton = modal.querySelector('.close-button');

    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${message}</p>`;
    
    // Remove e recria o event listener para evitar múltiplos listeners
    const oldCloseButton = closeButton.cloneNode(true);
    closeButton.parentNode.replaceChild(oldCloseButton, closeButton);
    oldCloseButton.onclick = function() {
        hideModal();
    }

    modal.style.display = 'block';

    window.onclick = function(event) {
        if (event.target == modal) {
            hideModal();
        }
    }
}

function hideModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
