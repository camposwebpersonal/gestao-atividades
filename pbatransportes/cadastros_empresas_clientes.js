// cadastros_empresas_clientes.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, openModal, closeModal, formatFieldValue, createFormForCrud } from './utils.js';
import { apiClient } from './api.js';

const crudConfig = {
    key: 'client_companies',
    title: 'Empresas Clientes',
    fields: [
        { name: 'name', label: 'Nome do Cliente', type: 'text', required: true },
        { name: 'cnpj', label: 'CNPJ', type: 'text', placeholder: 'XX.XXX.XXX/XXXX-XX' }, // NOVO CAMPO CNPJ
        { name: 'observations', label: 'Observações', type: 'textarea' } // NOVO CAMPO OBSERVAÇÕES
    ],
    table: 'client_companies'
};

/**
 * Inicializa a interface de CRUD para Empresas Clientes.
 * @param {string} key - A chave de configuração do CRUD (neste caso, 'client_companies').
 */
export const initCrudEmpresasClientes = async (key) => {
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
    const config = crudConfig;
    const table = document.getElementById('crud-table');
    const thead = table?.querySelector('thead');
    const tbody = table?.querySelector('tbody');

    if (!table || !thead || !tbody) {
        console.error('Elementos da tabela CRUD não encontrados.');
        hideSpinner();
        return;
    }

    const headers = [...config.fields.map(f => f.label), 'Ações'];
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';

    try {
        const data = await apiClient.fetchData(config.table);
        appState[key] = data;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${headers.length}">Nenhum item cadastrado.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            let rowHTML = '';
            config.fields.forEach((f, i) => {
                rowHTML += `<td data-label="${headers[i]}">${formatFieldValue(item[f.name], f.type)}</td>`;
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
        showModal('Erro ao Carregar Dados', `Não foi possível carregar os dados de ${config.title}. Verifique a conexão e a configuração do API.`);
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newItem = {};
        config.fields.forEach(f => {
            newItem[f.name] = f.type === 'checkbox' ? formData.has(f.name) : (formData.get(f.name) || null);
        });

        showSpinner();
        try {
            await apiClient.addItem(config.table, newItem);
            closeModal();
            await loadAndRenderCrudData(key);
            showModal('Sucesso!', 'Item adicionado com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showModal('Erro ao Salvar', `Erro ao salvar: ${error.message}`);
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

    const form = createFormForCrud(config, item);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedItem = {};
        config.fields.forEach(f => {
            updatedItem[f.name] = f.type === 'checkbox' ? formData.has(f.name) : (formData.get(f.name) || null);
        });

        showSpinner();
        try {
            await apiClient.updateItem(config.table, id, updatedItem);
            closeModal();
            await loadAndRenderCrudData(key);
            showModal('Sucesso!', 'Item atualizado com sucesso!');
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            showModal('Erro ao Atualizar', `Erro ao atualizar: ${error.message}`);
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
        // Fallback para alert se o modal não existir (apenas para depuração, evite em produção)
        // alert(`${title}: ${message}`);
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
