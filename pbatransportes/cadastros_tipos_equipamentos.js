// cadastros_tipos_equipamentos.js
import { appState } from './appState.js';
import { showSpinner, hideSpinner, openModal, closeModal, formatFieldValue, createFormForCrud } from './utils.js';
import { apiClient } from './api.js';

const crudConfig = {
    key: 'equipment_types',
    title: 'Tipos de Equipamentos',
    fields: [
        { name: 'name', label: 'Nome do Tipo', type: 'text', required: true, placeholder: 'Ex: CAMINHÃO BASCULANTE' },
        { name: 'short_name', label: 'Nome Abreviado', type: 'text', required: true, placeholder: 'Ex: CAM. BASC.' }
    ],
    table: 'equipment_types'
};

/**
 * Inicializa a interface de CRUD para Tipos de Equipamentos.
 * @param {string} key - A chave de configuração do CRUD (neste caso, 'equipment_types').
 */
export const initCrudEquipmentTypes = async (key) => {
    showSpinner();

    // Buscar tipos de equipamentos
    try {
        appState.equipment_types = await apiClient.fetchData('equipment_types', 'id, name, short_name, created_at, updated_at');
    } catch (error) {
        console.error('Erro ao buscar tipos de equipamentos:', error);
        appState.equipment_types = [];
    }

    hideSpinner();
    renderCrudEquipmentTypes(key);
};

/**
 * Renderiza a interface de CRUD para Tipos de Equipamentos.
 * @param {string} key - A chave de configuração do CRUD.
 */
const renderCrudEquipmentTypes = (key) => {
    const container = document.getElementById('generic-crud-container');
    const config = crudConfig;

    container.innerHTML = `
        <button class="btn btn-secondary" id="back-to-crud-menu">‹ Voltar ao Menu de Cadastros</button>
        <div class="crud-container">
            <div class="crud-header">
                <h2>${config.title}</h2>
                <button id="add-new-btn" class="btn btn-primary">+ Adicionar Novo</button>
            </div>
            <div id="crud-table-container"></div>
        </div>
    `;

    document.getElementById('back-to-crud-menu')?.addEventListener('click', () => {
        import('./cadastros.js').then(module => module.renderCrudMenu());
    });

    renderTable();

    document.getElementById('add-new-btn').addEventListener('click', () => openFormModal());
};

/**
 * Renderiza a tabela de tipos de equipamentos.
 */
const renderTable = () => {
    const container = document.getElementById('crud-table-container');
    const items = appState.equipment_types || [];

    console.log('🔍 Renderizando tabela com items:', items);

    if (items.length === 0) {
        container.innerHTML = '<p class="no-data">Nenhum tipo de equipamento cadastrado.</p>';
        return;
    }

    let tableHTML = `
        <table class="crud-table">
            <thead>
                <tr>
                    <th>Nome do Tipo</th>
                    <th>Nome Abreviado</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach(item => {
        console.log('📋 Item:', item);
        tableHTML += `
            <tr data-id="${item.id}">
                <td>${item.name || '(vazio)'}</td>
                <td>${item.short_name || '(vazio)'}</td>
                <td class="actions">
                    <button class="btn-edit" data-id="${item.id}">✏️ Editar</button>
                    <button class="btn-delete" data-id="${item.id}">🗑️ Excluir</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;

    // Event listeners
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            openFormModal(id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            deleteItem(id);
        });
    });
};

/**
 * Abre o modal com formulário para adicionar/editar.
 */
const openFormModal = (itemId = null) => {
    const item = itemId ? appState.equipment_types.find(i => i.id == itemId) : null;
    const isEdit = !!item;

    const form = createFormForCrud(crudConfig, item);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveItem(itemId);
    });

    openModal(`${isEdit ? 'Editar' : 'Adicionar'} Tipo de Equipamento`, form);
};

/**
 * Salva (adiciona ou atualiza) um tipo de equipamento.
 */
const saveItem = async (itemId) => {
    showSpinner();

    const nameInput = document.getElementById('field-name');
    const shortNameInput = document.getElementById('field-short_name');

    console.log('🔍 nameInput encontrado:', nameInput);
    console.log('🔍 nameInput.value:', nameInput?.value);
    console.log('🔍 shortNameInput encontrado:', shortNameInput);
    console.log('🔍 shortNameInput.value:', shortNameInput?.value);

    const name = nameInput?.value?.trim() || '';
    const short_name = shortNameInput?.value?.trim() || '';

    console.log('🔍 name após trim:', name);
    console.log('🔍 short_name após trim:', short_name);

    // Validação
    if (!name) {
        alert('⚠️ O campo "Nome do Tipo" é obrigatório!');
        hideSpinner();
        return;
    }

    if (!short_name) {
        alert('⚠️ O campo "Nome Abreviado" é obrigatório!');
        hideSpinner();
        return;
    }

    const data = { name, short_name };

    try {
        if (itemId) {
            await apiClient.updateItem('equipment_types', itemId, data);
        } else {
            await apiClient.upsertItem('equipment_types', data);
        }

        // Recarregar dados da API para garantir consistência
        const reloadedData = await apiClient.fetchData('equipment_types', 'id, name, short_name, created_at, updated_at');
        console.log('🔄 Dados recarregados após salvar:', reloadedData);
        appState.equipment_types = reloadedData;

        closeModal();
        renderTable();
    } catch (error) {
        console.error('Erro ao salvar tipo de equipamento:', error);
        alert('Erro ao salvar. Verifique o console.');
    }

    hideSpinner();
};

/**
 * Exclui um tipo de equipamento.
 */
const deleteItem = async (itemId) => {
    if (!confirm('Tem certeza que deseja excluir este tipo de equipamento?')) {
        return;
    }

    showSpinner();

    try {
        await apiClient.deleteItem('equipment_types', itemId);
        appState.equipment_types = appState.equipment_types.filter(i => i.id != itemId);
        renderTable();
    } catch (error) {
        console.error('Erro ao excluir tipo de equipamento:', error);
        alert('Erro ao excluir. Verifique o console.');
    }

    hideSpinner();
};
