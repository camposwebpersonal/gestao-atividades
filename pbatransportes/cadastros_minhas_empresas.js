// cadastros_minhas_empresas.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, openModal, closeModal, formatFieldValue, createFormForCrud } from './utils.js';
import { apiClient } from './api.js';

/**
 * Função para normalizar o nome da empresa para gerar a URL automática
 * @param {string} name - Nome da empresa
 * @returns {string} - Nome normalizado para URL
 */
const normalizeCompanyNameForUrl = (name) => {
    if (!name) return '';
    
    return name
        .toUpperCase()
        .replace(/\s+/g, '_') // Substitui espaços por underscore
        .replace(/Ã/g, 'A')   // Substitui Ã por A
        .replace(/Õ/g, 'O')   // Substitui Õ por O
        .replace(/Ç/g, 'C')   // Substitui Ç por C
        .replace(/É/g, 'E')   // Substitui É por E
        .replace(/Ê/g, 'E')   // Substitui Ê por E
        .replace(/Á/g, 'A')   // Substitui Á por A
        .replace(/À/g, 'A')   // Substitui À por A
        .replace(/Â/g, 'A')   // Substitui Â por A
        .replace(/Í/g, 'I')   // Substitui Í por I
        .replace(/Ó/g, 'O')   // Substitui Ó por O
        .replace(/Ô/g, 'O')   // Substitui Ô por O
        .replace(/Ú/g, 'U')   // Substitui Ú por U
        .replace(/Ü/g, 'U')   // Substitui Ü por U
        .normalize('NFD')     // Decomposição Unicode
        .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
};

const crudConfig = {
    key: 'my_companies',
    title: 'Minhas Empresas',
    fields: [
        { name: 'name', label: 'Nome da Empresa', type: 'text', required: true },
        { name: 'cnpj', label: 'CNPJ', type: 'text' },
        { name: 'phone', label: 'Telefone Celular', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'address', label: 'Endereço', type: 'textarea' },
        { name: 'observations', label: 'Observações', type: 'textarea' },
        { name: 'responsible_owner_name', label: 'Nome do Responsável', type: 'text' }, // NOVO CAMPO
        { name: 'responsible_owner_phone', label: 'Telefone do Responsável', type: 'text' }, // NOVO CAMPO
        { name: 'logo_url_auto', label: 'URL da Logomarca (Automática)', type: 'text', readOnly: true },
        { name: 'logo_url_manual', label: 'URL da Logomarca (Manual)', type: 'text' }
    ],
    table: 'my_companies'
};

/**
 * Inicializa a interface de CRUD para Minhas Empresas.
 * @param {string} key - A chave de configuração do CRUD (neste caso, 'my_companies').
 */
export const initCrudMinhasEmpresas = async (key) => {
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

    // Adiciona listener para o botão de voltar ao menu principal de cadastros
    document.getElementById('back-to-crud-menu-specific')?.addEventListener('click', () => {
        // Importa e chama a função renderCrudMenu do cadastros.js
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
    const config = crudConfig; // Usa a config local
    const table = document.getElementById('crud-table');
    const thead = table?.querySelector('thead');
    const tbody = table?.querySelector('tbody');

    if (!table || !thead || !tbody) {
        console.error('Elementos da tabela CRUD não encontrados.');
        hideSpinner();
        return;
    }

    // Inclui os novos campos nos cabeçalhos da tabela
    const headers = [...config.fields.map(f => f.label), 'Ações'];
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';

    try {
        const data = await apiClient.fetchData(config.table);
        appState[key] = data; // Cache data

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${headers.length}">Nenhum item cadastrado.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            let rowHTML = '';
            config.fields.forEach((f, i) => {
                let formattedValue = formatFieldValue(item[f.name], f.type);
                
                if (f.name === 'logo_url_auto') {
                    // Gera a URL automática para exibição na tabela
                    const companyName = item.name || '';
                    const normalizedName = normalizeCompanyNameForUrl(companyName);
                    const autoGeneratedUrl = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;
                    
                    // Se a URL manual estiver preenchida, não mostra a automática na tabela
                    if (item.logo_url_manual) {
                        formattedValue = '--- (URL Manual em uso)';
                    } else {
                        formattedValue = `<a href="${autoGeneratedUrl}" target="_blank">${autoGeneratedUrl}</a>`;
                    }
                } else if (f.name === 'logo_url_manual' && item[f.name]) {
                    // Exibe a URL manual se estiver preenchida
                    formattedValue = `<a href="${item[f.name]}" target="_blank">${item[f.name]}</a>`;
                }
                
                rowHTML += `<td data-label="${headers[i]}">${formattedValue}</td>`;
            });
            rowHTML += `
                <td data-label="Ações" class="actions-cell">
                    <button class="btn btn-secondary btn-sm" data-id="${item.id}" data-action="edit">Editar</button>
                    <button class="btn btn-danger btn-sm" data-id="${item.id}" data-action="delete">Excluir</button>
                </td>
            `;
            row.innerHTML = rowHTML;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => handleEditItem(key, btn.dataset.id)));
        tbody.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => handleDeleteItem(key, btn.dataset.id)));

    } catch (error) {
        console.error(`Erro ao carregar ${config.title}:`, error);
        alert(`Não foi possível carregar os dados de ${config.title}. Verifique a conexão e a configuração do API.`);
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

    // Adiciona listener para gerar a URL automática ao digitar o nome da empresa
    const nameInput = form.querySelector('#field-name');
    const autoUrlInput = form.querySelector('#field-logo_url_auto');
    const manualUrlInput = form.querySelector('#field-logo_url_manual');

    const generateLogoUrl = () => {
        if (nameInput && autoUrlInput) {
            const normalizedName = normalizeCompanyNameForUrl(nameInput.value);
            autoUrlInput.value = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;
        }
    };

    if (nameInput) {
        nameInput.addEventListener('input', generateLogoUrl);
    }

    // Lógica para desabilitar/habilitar campo automático/manual
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
    
    generateLogoUrl(); // Gera URL inicial caso já haja valor
    toggleUrlInputs(); // Define o estado inicial dos campos de URL

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newItem = {};
        config.fields.forEach(f => {
            if (f.name === 'logo_url_auto') return; // Ignora campo automático temporário
            newItem[f.name] = f.type === 'checkbox' ? formData.has(f.name) : (formData.get(f.name) || null);
        });

        // Lógica para salvar a URL da logomarca
        if (newItem.logo_url_manual) {
            newItem.logo_url = newItem.logo_url_manual;
        } else if (newItem.name) {
            const normalizedName = normalizeCompanyNameForUrl(newItem.name);
            newItem.logo_url = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;
        } else {
            newItem.logo_url = null;
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

    // Prepara os valores para os campos de URL
    item.logo_url_manual = item.logo_url_manual || '';
    const normalizedName = normalizeCompanyNameForUrl(item.name || '');
    item.logo_url_auto = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;

    const form = createFormForCrud(config, item);

    // Adiciona listener para gerar a URL automática ao digitar o nome da empresa (para edição)
    const nameInput = form.querySelector('#field-name');
    const autoUrlInput = form.querySelector('#field-logo_url_auto');
    const manualUrlInput = form.querySelector('#field-logo_url_manual');

    const generateLogoUrl = () => {
        if (nameInput && autoUrlInput) {
            const normalizedName = normalizeCompanyNameForUrl(nameInput.value);
            autoUrlInput.value = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;
        }
    };

    if (nameInput) {
        nameInput.addEventListener('input', generateLogoUrl);
    }

    // Lógica para desabilitar/habilitar campo automático/manual
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
    
    generateLogoUrl(); // Chama na inicialização da edição
    toggleUrlInputs(); // Define o estado inicial dos campos de URL

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedItem = {};
        config.fields.forEach(f => {
            if (f.name === 'logo_url_auto') return; // Ignora campo automático temporário
            updatedItem[f.name] = f.type === 'checkbox' ? formData.has(f.name) : (formData.get(f.name) || null);
        });

        // Lógica para atualizar a URL da logomarca
        if (updatedItem.logo_url_manual) {
            updatedItem.logo_url = updatedItem.logo_url_manual;
        } else if (updatedItem.name) {
            const normalizedName = normalizeCompanyNameForUrl(updatedItem.name);
            updatedItem.logo_url = `https://res.cloudinary.com/ddobrlzep/image/upload/logo/${normalizedName}.jpg`;
        } else {
            updatedItem.logo_url = null;
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
    if (!confirm(`Tem certeza que deseja excluir este item de ${config.title}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    showSpinner();
    try {
        await apiClient.deleteItem(config.table, id);
        await loadAndRenderCrudData(key);
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert(`Erro ao excluir: ${error.message}`);
    } finally {
        hideSpinner();
    }
};
