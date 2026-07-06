// lancamentos_transportes.js - VERSÃO COM MÚLTIPLOS EQUIPAMENTOS
import { appState } from './appState.js';
import { showSpinner, hideSpinner, formatCurrency } from './utils.js';
import { apiClient } from './api.js';

const transportEntryWorkSelect = document.getElementById('transport-entry-work-select');
const transportEntryDateInput = document.getElementById('transport-entry-date');
const transportEntryMaterialSelect = document.getElementById('transport-entry-material-select');
const transportEntryTypeSelect = document.getElementById('transport-entry-type');
const transportEntryIncludeMeasurement = document.getElementById('transport-entry-include-measurement');
const transportEntryNotes = document.getElementById('transport-entry-notes');
const addTransportEntryBtn = document.getElementById('add-transport-entry-btn');
const transportEntriesTableBody = document.querySelector('#transport-entries-table tbody');


let draggedRow = null;

// ✅ NOVA FUNÇÃO: Navega para o próximo campo de quantidade ao pressionar Tab, Enter ou Setas
const handleTripCountTabNavigation = (e) => {
    // ✅ ACEITA TAB, ENTER ou SETA PARA BAIXO para avançar
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        const currentRow = e.target.closest('.equipment-row');
        const nextRow = currentRow.nextElementSibling;
        
        if (nextRow && nextRow.classList.contains('equipment-row')) {
            const nextTripCountInput = nextRow.querySelector('.trip-count-input');
            if (nextTripCountInput) {
                nextTripCountInput.focus();
                nextTripCountInput.select(); // Seleciona o valor para facilitar sobrescrever
            }
        } else {
            // Se não há próxima linha, vai para o campo de observações
            if (transportEntryNotes) {
                transportEntryNotes.focus();
            }
        }
    } else if (e.key === 'Tab' && e.shiftKey || e.key === 'ArrowUp') {
        // ✅ Shift+Tab ou SETA PARA CIMA volta para o campo anterior
        e.preventDefault();
        
        const currentRow = e.target.closest('.equipment-row');
        const prevRow = currentRow.previousElementSibling;
        
        if (prevRow && prevRow.classList.contains('equipment-row')) {
            const prevTripCountInput = prevRow.querySelector('.trip-count-input');
            if (prevTripCountInput) {
                prevTripCountInput.focus();
                prevTripCountInput.select();
            }
        } else {
            // Se é a primeira linha, volta para o select de equipamento da própria linha
            const equipmentSelect = currentRow.querySelector('.equipment-select');
            if (equipmentSelect) {
                equipmentSelect.focus();
            }
        }
    }
};

// ✅ NOVA FUNÇÃO: Navega para o próximo campo de hora ao pressionar Tab, Enter ou Setas (modo hora de carga/descarga)
const handleTimeInputTabNavigation = (e) => {
    // ✅ ACEITA TAB, ENTER ou SETA PARA BAIXO para avançar
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        const currentRow = e.target.closest('.equipment-row');
        const nextRow = currentRow.nextElementSibling;
        
        if (nextRow && nextRow.classList.contains('equipment-row')) {
            const nextLoadTimeInput = nextRow.querySelector('.load-time-input');
            if (nextLoadTimeInput) {
                nextLoadTimeInput.focus();
            }
        } else {
            // Se não há próxima linha, vai para o campo de observações
            if (transportEntryNotes) {
                transportEntryNotes.focus();
            }
        }
    } else if (e.key === 'Tab' && e.shiftKey || e.key === 'ArrowUp') {
        // ✅ Shift+Tab ou SETA PARA CIMA volta para o campo anterior
        e.preventDefault();
        
        const currentRow = e.target.closest('.equipment-row');
        const prevRow = currentRow.previousElementSibling;
        
        if (prevRow && prevRow.classList.contains('equipment-row')) {
            const prevLoadTimeInput = prevRow.querySelector('.load-time-input');
            if (prevLoadTimeInput) {
                prevLoadTimeInput.focus();
            }
        }
    }
};

// ✅ Funções para drag and drop
const handleDragStart = (e) => {
    draggedRow = e.currentTarget;
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (e) => {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
};

const handleDragEnter = (e) => {
    const target = e.currentTarget;
    if (target !== draggedRow && target.classList.contains('equipment-row')) {
        target.style.borderTop = '3px solid #3498db';
    }
};

const handleDragLeave = (e) => {
    const target = e.currentTarget;
    if (target.classList.contains('equipment-row')) {
        target.style.borderTop = '1px solid #ddd';
    }
};

const handleDrop = (e) => {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const target = e.currentTarget;
    target.style.borderTop = '1px solid #ddd';
    
    if (draggedRow !== target && target.classList.contains('equipment-row')) {
        const container = document.getElementById('equipment-rows-container');
        const allRows = Array.from(container.children);
        const draggedIndex = allRows.indexOf(draggedRow);
        const targetIndex = allRows.indexOf(target);
        
        if (draggedIndex < targetIndex) {
            target.parentNode.insertBefore(draggedRow, target.nextSibling);
        } else {
            target.parentNode.insertBefore(draggedRow, target);
        }
    }
    
    return false;
};

const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    
    // Remove todos os estilos de hover
    const allRows = document.querySelectorAll('.equipment-row');
    allRows.forEach(row => {
        row.style.borderTop = '1px solid #ddd';
    });
    
    draggedRow = null;
};




// NOVO: Container para múltiplos equipamentos
let multipleEquipmentsContainer;
let equipmentRowsData = [];

let editingTransportEntryId = null;

// 🧹 Função para limpar todos os campos do formulário
const clearTransportForm = () => {
    console.log('🧹 Limpando formulário de transporte...');
    
    // Limpar obra
    if (transportEntryWorkSelect) {
        transportEntryWorkSelect.value = '';
    }
    
    // Limpar data
    if (transportEntryDateInput) {
        transportEntryDateInput.value = '';
    }
    
    // Limpar material
    if (transportEntryMaterialSelect) {
        transportEntryMaterialSelect.innerHTML = '<option value="">Selecione um material</option>';
    }
    
    // Limpar tipo de lançamento (resetar para padrão)
    if (transportEntryTypeSelect) {
        transportEntryTypeSelect.value = 'trip_count'; // Valor padrão
    }
    
    // Limpar observações
    if (transportEntryNotes) {
        transportEntryNotes.value = '';
    }
    
    // Limpar checkbox
    if (transportEntryIncludeMeasurement) {
        transportEntryIncludeMeasurement.checked = false;
    }
    
    // Limpar tabela de lançamentos
    if (transportEntriesTableBody) {
        transportEntriesTableBody.innerHTML = '';
    }
    
    // Limpar container de equipamentos
    const container = document.getElementById('equipment-rows-container');
    if (container) {
        container.innerHTML = '';
        addEquipmentRow(); // Adiciona apenas uma linha vazia
    }
    
    console.log('✅ Formulário limpo');
};

export const initTransportEntries = async () => {
    showSpinner();
    
    if (appState.works.length === 0) {
        appState.works = await apiClient.fetchData('works', '*, client_companies(name), my_companies(name)');
    }
    if (!appState.equipment || appState.equipment.length === 0) {
        appState.equipment = await apiClient.fetchData('equipment');
    }
    if (!appState.material_types || appState.material_types.length === 0) {
        appState.material_types = await apiClient.fetchData('material_types');
    }
    if (!appState.equipment_types || appState.equipment_types.length === 0) {
        appState.equipment_types = await apiClient.fetchData('equipment_types', 'id, name, short_name');
    }

    // NOVO: Cria o container de múltiplos equipamentos (ANTES de limpar)
    createMultipleEquipmentsUI();

    if (transportEntryWorkSelect) {
        const sortedWorks = [...appState.works].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        transportEntryWorkSelect.innerHTML = '<option value="">Selecione uma obra</option>' + sortedWorks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        
        // 🧹 LIMPAR e adicionar event listener (sem duplicar)
        transportEntryWorkSelect.removeEventListener('change', handleTransportWorkSelectChange);
        transportEntryWorkSelect.addEventListener('change', handleTransportWorkSelectChange);
    }
    if (transportEntryTypeSelect) {
        transportEntryTypeSelect.removeEventListener('change', handleTransportTypeChange);
        transportEntryTypeSelect.addEventListener('change', handleTransportTypeChange);
        handleTransportTypeChange();
    }
    if (addTransportEntryBtn) {
        addTransportEntryBtn.removeEventListener('click', addTransportEntry);
        addTransportEntryBtn.addEventListener('click', addTransportEntry);
    }

    // 🧹 LIMPAR FORMULÁRIO sempre que a aba for ativada (DEPOIS de criar UI)
    clearTransportForm();

    if (transportEntryMaterialSelect) transportEntryMaterialSelect.innerHTML = '<option value="">Selecione um material</option>';
    if (transportEntriesTableBody) transportEntriesTableBody.innerHTML = '';

    hideSpinner();
};

const createMultipleEquipmentsUI = () => {
    // Remove os campos antigos de equipamento único
    const oldEquipmentGroup = document.getElementById('transport-entry-equipment-select')?.closest('.form-group');
    const oldTripCountGroup = document.getElementById('transport-trip-count-group');
    const oldLoadTimeGroup = document.getElementById('transport-load-time-group');
    const oldUnloadTimeGroup = document.getElementById('transport-unload-time-group');
    
    if (oldEquipmentGroup) oldEquipmentGroup.remove();
    if (oldTripCountGroup) oldTripCountGroup.remove();
    if (oldLoadTimeGroup) oldLoadTimeGroup.remove();
    if (oldUnloadTimeGroup) oldUnloadTimeGroup.remove();

    // Cria novo container após o campo de tipo de lançamento
    const typeSelectGroup = transportEntryTypeSelect?.closest('.form-group');
    if (!typeSelectGroup) return;

    multipleEquipmentsContainer = document.createElement('div');
    multipleEquipmentsContainer.id = 'multiple-equipments-container';
    multipleEquipmentsContainer.style.gridColumn = 'span 2';
    multipleEquipmentsContainer.style.marginTop = '15px';
    multipleEquipmentsContainer.style.padding = '15px';
    multipleEquipmentsContainer.style.border = '2px solid #444';
    multipleEquipmentsContainer.style.borderRadius = '8px';
    multipleEquipmentsContainer.style.backgroundColor = '#2a2a2a';

    multipleEquipmentsContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0;">Equipamentos e Viagens</h4>
            <button type="button" id="add-equipment-row-btn" class="btn btn-secondary btn-sm">+ Adicionar Equipamento</button>
        </div>
        <div id="equipment-rows-container"></div>
    `;

    typeSelectGroup.parentElement.appendChild(multipleEquipmentsContainer);

    document.getElementById('add-equipment-row-btn').addEventListener('click', addEquipmentRow);
    
    // Adiciona a primeira linha automaticamente
    addEquipmentRow();
};

const addEquipmentRow = () => {
    const container = document.getElementById('equipment-rows-container');
    const rowId = Date.now();
    
    const row = document.createElement('div');
    row.className = 'equipment-row';
    row.dataset.rowId = rowId;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'auto 2fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'end';
    row.style.marginBottom = '10px';
    row.style.padding = '10px';
    row.style.backgroundColor = '#1e1e1e';
    row.style.borderRadius = '6px';
    row.style.border = '1px solid #444';
    row.style.cursor = 'move';
    row.setAttribute('draggable', 'true');

    const entryType = transportEntryTypeSelect?.value || 'trip_count';

    if (entryType === 'trip_count') {
        row.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; cursor: grab; padding: 5px;">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#666">
                    <circle cx="7" cy="5" r="1.5"/>
                    <circle cx="13" cy="5" r="1.5"/>
                    <circle cx="7" cy="10" r="1.5"/>
                    <circle cx="13" cy="10" r="1.5"/>
                    <circle cx="7" cy="15" r="1.5"/>
                    <circle cx="13" cy="15" r="1.5"/>
                </svg>
            </div>
            <div class="form-group" style="margin: 0;">
                <label>Equipamento</label>
                <select class="equipment-select" required>
                    <option value="">Selecione...</option>
                </select>
            </div>
            <div class="form-group" style="margin: 0;">
                <label>Qtd Viagens</label>
                <input type="number" class="trip-count-input" min="1" value="1" required>
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-equipment-row-btn" style="height: 38px;">×</button>
        `;
    } else {
        row.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; cursor: grab; padding: 5px;">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#666">
                    <circle cx="7" cy="5" r="1.5"/>
                    <circle cx="13" cy="5" r="1.5"/>
                    <circle cx="7" cy="10" r="1.5"/>
                    <circle cx="13" cy="10" r="1.5"/>
                    <circle cx="7" cy="15" r="1.5"/>
                    <circle cx="13" cy="15" r="1.5"/>
                </svg>
            </div>
            <div class="form-group" style="margin: 0;">
                <label>Equipamento</label>
                <select class="equipment-select" required>
                    <option value="">Selecione...</option>
                </select>
            </div>
            <div class="form-group" style="margin: 0;">
                <label>Hora Carga</label>
                <input type="time" class="load-time-input" required>
            </div>
            <div class="form-group" style="margin: 0;">
                <label>Hora Descarga</label>
                <input type="time" class="unload-time-input" required>
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-equipment-row-btn" style="height: 38px;">×</button>
        `;
    }

    container.appendChild(row);
    populateEquipmentSelect(row.querySelector('.equipment-select'));

    // Event listeners para drag and drop
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('drop', handleDrop);
    row.addEventListener('dragend', handleDragEnd);
    row.addEventListener('dragenter', handleDragEnter);
    row.addEventListener('dragleave', handleDragLeave);

    // ✅ NOVO: Navegação por Tab entre campos de quantidade
    if (entryType === 'trip_count') {
        const tripCountInput = row.querySelector('.trip-count-input');
        tripCountInput.addEventListener('keydown', handleTripCountTabNavigation);
    } else {
        const unloadTimeInput = row.querySelector('.unload-time-input');
        unloadTimeInput.addEventListener('keydown', handleTimeInputTabNavigation);
    }

    row.querySelector('.remove-equipment-row-btn').addEventListener('click', () => {
        row.remove();
        if (container.children.length === 0) {
            addEquipmentRow();
        }
    });
};



const populateEquipmentSelect = (selectElement) => {
    const workId = transportEntryWorkSelect?.value;
    if (!workId) return;

    const work = appState.works.find(w => w.id == workId);
    const equipmentInWork = work?.config?.equipment || [];

    const validEquipmentsInWork = equipmentInWork
        .map(ec => appState.equipment.find(e => e.id === parseInt(ec.equipment_id)))
        .filter(equip => equip !== undefined);

    const sortedEquipment = [...validEquipmentsInWork].sort((a, b) => {
        const typeA = (appState.equipment_types?.find(t => t.id == a.type)?.name || '').toUpperCase();
        const typeB = (appState.equipment_types?.find(t => t.id == b.type)?.name || '').toUpperCase();
        if (typeA < typeB) return -1;
        if (typeA > typeB) return 1;

        const prefixA = a.prefix ? a.prefix.toUpperCase() : '';
        const prefixB = b.prefix ? b.prefix.toUpperCase() : '';
        if (prefixA < prefixB) return -1;
        if (prefixA > prefixB) return 1;
        return 0;
    });

    const equipmentOptions = sortedEquipment.map(e => {
        // Busca o nome do tipo pelo type_id
        const typeName = appState.equipment_types?.find(t => t.id == e.type)?.name || e.type || '';
        const parts = [e.prefix, typeName, e.brand, e.model, e.year, e.characteristic, e.capacidade].filter(Boolean);
        const displayText = parts.join(' - ');
        return `<option value="${e.id}">${displayText}</option>`;
    }).join('');

    selectElement.innerHTML = '<option value="">Selecione...</option>' + equipmentOptions;
};

const handleTransportWorkSelectChange = async () => {
    const workId = transportEntryWorkSelect.value;
    if (transportEntryMaterialSelect) transportEntryMaterialSelect.innerHTML = '<option value="">Selecione um material</option>';
    if (transportEntriesTableBody) transportEntriesTableBody.innerHTML = '';

    // Limpa as linhas de equipamento
    const container = document.getElementById('equipment-rows-container');
    if (container) {
        container.innerHTML = '';
        addEquipmentRow();
    }

    if (!workId) return;

    const work = appState.works.find(w => w.id == workId);
    const materialPricesInWork = work?.config?.material_transport_prices || [];

    // 📅 AUTO-PREENCHER DATA COM O DIA ANTERIOR (sincronizado com timezone local)
    if (transportEntryDateInput) {
        const today = new Date(); // Data atual do navegador (já está no timezone local)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1); // Subtrai 1 dia
        
        // Formata como YYYY-MM-DD para o input type="date"
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayFormatted = `${year}-${month}-${day}`;
        
        transportEntryDateInput.value = yesterdayFormatted;
        console.log('📅 Data auto-preenchida:', yesterdayFormatted, '(dia anterior)');
    }

    // 🎯 AUTO-PREENCHER MATERIAL
    if (transportEntryMaterialSelect) {
        const materialOptions = materialPricesInWork.map(mp => {
            const material = appState.material_types.find(mt => mt.id === parseInt(mp.material_type_id));
            const materialName = material?.name || 'Material Desconhecido';
            
            if (!material) {
                console.warn(`⚠️ Material não encontrado para material_type_id: ${mp.material_type_id}`);
            }
            
            return `<option value="${mp.id}">${materialName} - ${mp.volume} m³ ${formatCurrency(mp.price)}</option>`;
        }).join('');

        transportEntryMaterialSelect.innerHTML = '<option value="">Selecione um material</option>' + materialOptions;
        
        // ✅ Auto-selecionar o primeiro material se houver apenas um ou mais
        if (materialPricesInWork.length > 0) {
            transportEntryMaterialSelect.value = materialPricesInWork[0].id;
            console.log('🎯 Material auto-selecionado:', materialPricesInWork[0].id);
        }
    }

    // 🔄 Buscar últimos lançamentos para preencher equipamentos e tipo
    try {
        const allEntries = await apiClient.fetchTransportEntries(workId);
        
        if (allEntries && allEntries.length > 0) {
            // Ordenar por data decrescente para pegar os mais recentes
            const sortedEntries = [...allEntries].sort((a, b) => {
                const dateCompare = new Date(b.date) - new Date(a.date);
                if (dateCompare !== 0) return dateCompare;
                return b.id - a.id;
            });
            
            // Pegar a data do último lançamento
            const lastDate = sortedEntries[0].date;
            const lastEntryType = sortedEntries[0].entry_type;
            
            // 🎯 AUTO-PREENCHER TIPO DE LANÇAMENTO com o último usado
            if (transportEntryTypeSelect && lastEntryType) {
                transportEntryTypeSelect.value = lastEntryType;
                console.log('🎯 Tipo de lançamento auto-selecionado:', lastEntryType);
                // Trigger change event para atualizar os campos
                handleTransportTypeChange();
            }
            
            // Filtrar lançamentos da última data
            const lastDateEntries = sortedEntries.filter(entry => entry.date === lastDate);
            
            // 🚜 AUTO-PREENCHER EQUIPAMENTOS da última data
            if (lastDateEntries.length > 0) {
                console.log(`🚜 Encontrados ${lastDateEntries.length} equipamentos do último lançamento (${lastDate})`);
                
                // Limpar container
                container.innerHTML = '';
                
                // ✅ INVERTER A ORDEM para aparecer na sequência correta (crescente por ID)
                const orderedEntries = [...lastDateEntries].sort((a, b) => a.id - b.id);
                
                // Adicionar uma linha para cada equipamento do último lançamento
                orderedEntries.forEach((entry, index) => {
                    addEquipmentRow();
                    
                    // Preencher os dados da linha recém-criada
                    const rows = container.querySelectorAll('.equipment-row');
                    const lastRow = rows[rows.length - 1];
                    
                    if (lastRow) {
                        const equipmentSelect = lastRow.querySelector('.equipment-select');
                        const tripCountInput = lastRow.querySelector('.trip-count-input');
                        const loadTimeInput = lastRow.querySelector('.load-time-input');
                        const unloadTimeInput = lastRow.querySelector('.unload-time-input');
                        
                        // Selecionar o equipamento
                        if (equipmentSelect) {
                            equipmentSelect.value = entry.equipment_id;
                        }
                        
                        // Deixar quantidade vazia para o usuário preencher
                        // Mas se quiser pré-preencher com a quantidade anterior, descomente:
                        // if (tripCountInput && entry.trip_count) {
                        //     tripCountInput.value = entry.trip_count;
                        // }
                        // if (loadTimeInput && entry.load_time) {
                        //     loadTimeInput.value = entry.load_time;
                        // }
                        // if (unloadTimeInput && entry.unload_time) {
                        //     unloadTimeInput.value = entry.unload_time;
                        // }
                    }
                });
                
                console.log('✅ Equipamentos auto-preenchidos da última data');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao buscar últimos lançamentos:', error);
    }

    loadTransportEntries(workId);
};

const handleTransportTypeChange = () => {
    // Recria as linhas de equipamento com os campos apropriados
    const container = document.getElementById('equipment-rows-container');
    if (container) {
        container.innerHTML = '';
        addEquipmentRow();
    }
};

const addTransportEntry = async () => {
    const workId = transportEntryWorkSelect?.value;
    const date = transportEntryDateInput?.value;
    const materialPriceConfigId = transportEntryMaterialSelect?.value;
    const entryType = transportEntryTypeSelect?.value;
    const notes = transportEntryNotes?.value;
    const includeInMeasurement = transportEntryIncludeMeasurement?.checked || false;

    if (!workId || !date || !materialPriceConfigId) {
        alert('Preencha a obra, data e material antes de adicionar os lançamentos.');
        return;
    }

    // Coleta dados de todas as linhas de equipamento
    const equipmentRows = document.querySelectorAll('.equipment-row');
    const entries = [];

    for (const row of equipmentRows) {
        const equipmentSelect = row.querySelector('.equipment-select');
        const equipmentId = equipmentSelect?.value;

        if (!equipmentId) {
            alert('Selecione o equipamento em todas as linhas.');
            return;
        }

        let entryData = {
            work_id: workId,
            date: date,
            equipment_id: equipmentId,
            material_price_config_id: materialPriceConfigId,
            notes: notes,
            include_in_measurement: includeInMeasurement
        };

        if (entryType === 'trip_times') {
            const loadTimeInput = row.querySelector('.load-time-input');
            const unloadTimeInput = row.querySelector('.unload-time-input');
            const loadTime = loadTimeInput?.value;
            const unloadTime = unloadTimeInput?.value;

            if (!loadTime || !unloadTime) {
                alert('Preencha a hora de carga e descarga em todas as linhas.');
                return;
            }

            entryData.load_time = loadTime;
            entryData.unload_time = unloadTime;
            entryData.trip_count = 1;
        } else {
            const tripCountInput = row.querySelector('.trip-count-input');
            const tripCount = parseInt(tripCountInput?.value || '0');

            if (isNaN(tripCount) || tripCount <= 0) {
                alert('Informe uma quantidade de viagens válida em todas as linhas.');
                return;
            }

            entryData.trip_count = tripCount;
            entryData.load_time = null;
            entryData.unload_time = null;
        }

        entries.push(entryData);
    }

    showSpinner();
    try {
        // Salva todos os lançamentos
        for (const entryData of entries) {
            await apiClient.addItem('transport_entries', entryData);
        }

        await loadTransportEntries(workId);

        // ✅ ALTERAÇÃO: Limpa apenas as observações e checkbox
        // Mantém data, material, equipamentos e quantidades
        if (transportEntryNotes) transportEntryNotes.value = '';
        if (transportEntryIncludeMeasurement) transportEntryIncludeMeasurement.checked = false;
        
        // ✅ NÃO limpa mais o container de equipamentos
        // Comentei as linhas que limpavam:
        // const container = document.getElementById('equipment-rows-container');
        // if (container) {
        //     container.innerHTML = '';
        //     addEquipmentRow();
        // }
        
    } catch (e) {
        console.error("Erro ao salvar lançamentos de transporte:", e);
        alert(`Erro ao salvar lançamentos de transporte: ${e.message}`);
    } finally {
        hideSpinner();
    }
};


const loadTransportEntries = async (workId) => {
    showSpinner();
    try {
        if (!appState.equipment || appState.equipment.length === 0) {
            appState.equipment = await apiClient.fetchData('equipment');
        }
        const data = await apiClient.fetchTransportEntries(workId);
        renderTransportEntriesTable(data, workId);
    } catch (e) {
        console.error("Erro ao carregar lançamentos de transporte:", e);
        if (transportEntriesTableBody) transportEntriesTableBody.innerHTML = '<tr><td colspan="6">Erro ao carregar lançamentos.</td></tr>';
    } finally {
        hideSpinner();
    }
};

const renderTransportEntriesTable = (entries, workId) => {
    if (!transportEntriesTableBody) return;
    transportEntriesTableBody.innerHTML = '';
    if (entries.length === 0) {
        transportEntriesTableBody.innerHTML = '<tr><td colspan="6">Nenhum lançamento de transporte para esta obra.</td></tr>';
        return;
    }

    const work = appState.works.find(w => w.id == workId);
    const materialPrices = work?.config?.material_transport_prices || [];

    const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
    });

    sortedEntries.forEach(entry => {
        const equipment = entry.equipment || appState.equipment.find(eq => eq.id === parseInt(entry.equipment_id));
        
        const materialConfig = materialPrices.find(mp => {
            return mp.id === entry.material_price_config_id || 
                   mp.id == entry.material_price_config_id;
        });

        const materialType = materialConfig 
            ? appState.material_types.find(mt => mt.id === parseInt(materialConfig.material_type_id))
            : null;

        const materialDisplay = materialConfig && materialType
            ? `${materialType.name} - ${materialConfig.volume} m³ ${formatCurrency(materialConfig.price)}`
            : (materialConfig 
                ? `Material ID ${materialConfig.material_type_id} - ${materialConfig.volume} m³ ${formatCurrency(materialConfig.price)}`
                : `Config ID: ${entry.material_price_config_id} (não encontrada)`);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Data">${new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td data-label="Equipamento">${equipment?.prefix || 'N/A'}</td>
            <td data-label="Material/Volume/Preço">${materialDisplay}</td>
            <td data-label="Viagens/Horas">${entry.trip_count ? `${entry.trip_count} viagens` : `${entry.load_time} - ${entry.unload_time}`}</td>
            <td data-label="Medição">${entry.include_in_measurement ? 'Sim' : 'Não'}</td>
            <td data-label="Ações" class="actions-cell">
                <button class="btn btn-danger btn-sm" data-id="${entry.id}" data-action="delete-transport-entry">Excluir</button>
            </td>
        `;
        transportEntriesTableBody.appendChild(row);
    });

    transportEntriesTableBody.querySelectorAll('[data-action="delete-transport-entry"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Tem certeza que deseja excluir este lançamento de transporte?')) {
                showSpinner();
                try {
                    await apiClient.deleteItem('transport_entries', e.target.dataset.id);
                    await loadTransportEntries(workId);
                } catch (err) {
                    console.error("Erro ao excluir lançamento de transporte:", err);
                    alert(`Erro ao excluir lançamento: ${err.message}`);
                } finally {
                    hideSpinner();
                }
            }
        });
    });
};