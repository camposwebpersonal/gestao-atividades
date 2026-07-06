// api.js - Cliente para API PHP MySQL
import client from './db.js';

/**
 * API unificada para comunicação com backend PHP + MySQL
 */
export const apiClient = {
    /**
     * Busca dados de uma tabela
     * @param {string} tableName - Nome da tabela
     * @param {string} selectQuery - Query de seleção
     * @returns {Promise<Array>} Array de dados
     */
    async fetchData(tableName, selectQuery = '*', where = null, orderBy = null) {
        try {
            console.log(`🔍 Buscando dados de ${tableName} com select: ${selectQuery}`);
            
            // Fetch para a API PHP
            // Nota: selectQuery, order e ascending são tratados no backend PHP
            let url = `${client.baseUrl}/api.php/fetchData/${tableName}?select=${encodeURIComponent(selectQuery)}`;
            if (where && Object.keys(where).length > 0) {
                url += `&where=${encodeURIComponent(JSON.stringify(where))}`;
            }
            if (orderBy) {
                url += `&orderBy=${encodeURIComponent(orderBy)}`;
            }
            const response = await fetch(url);
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error(`❌ Erro ao carregar dados de ${tableName}:`, result.message || 'Erro desconhecido');
                throw new Error(result.message || `Não foi possível carregar os dados de ${tableName}.`);
            }

            console.log(`✅ Dados carregados de ${tableName}:`, result.data?.length || 0, 'registros');
            return result.data || [];

        } catch (error) {
            console.error(`❌ Erro ao carregar dados de ${tableName}:`, error);
            throw error;
        }
    },

    /**
     * Adiciona um novo item
     * @param {string} tableName - Nome da tabela
     * @param {Object} itemData - Dados do item
     * @returns {Promise<Object>} Item adicionado
     */
    async addItem(tableName, itemData) {
        try {
            console.log(`➕ Adicionando item em ${tableName}:`, itemData);
            
            const url = `${client.baseUrl}/api.php/addItem/${tableName}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error(`❌ Erro ao adicionar item em ${tableName}:`, result.message || 'Erro desconhecido');
                throw new Error(result.message || `Não foi possível adicionar o item em ${tableName}.`);
            }

            console.log(`✅ Item adicionado em ${tableName}:`, result.data);
            return result.data;

        } catch (error) {
            console.error(`❌ Erro ao adicionar item em ${tableName}:`, error);
            throw error;
        }
    },

    /**
     * Atualiza um item existente
     * @param {string} tableName - Nome da tabela
     * @param {number|string} id - ID do item
     * @param {Object} itemData - Dados para atualizar
     * @returns {Promise<Object>} Item atualizado
     */
    async updateItem(tableName, id, itemData) {
        try {
            console.log(`✏️ Atualizando item ${id} em ${tableName}:`, itemData);
            
            const url = `${client.baseUrl}/api.php/updateItem/${tableName}?id=${id}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error(`❌ Erro ao atualizar item em ${tableName}:`, result.message || 'Erro desconhecido');
                throw new Error(result.message || `Não foi possível atualizar o item em ${tableName}.`);
            }

            console.log(`✅ Item atualizado em ${tableName}:`, result.data);
            return result.data; // Retorna o item atualizado

        } catch (error) {
            console.error(`❌ Erro ao atualizar item em ${tableName}:`, error);
            throw error;
        }
    },

    /**
     * Exclui um item
     * @param {string} tableName - Nome da tabela
     * @param {number|string} id - ID do item
     * @returns {Promise<void>}
     */
    async deleteItem(tableName, id) {
        try {
            console.log(`🗑️ Excluindo item ${id} de ${tableName}`);
            
            const url = `${client.baseUrl}/api.php/deleteItem/${tableName}?id=${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
            });
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error(`❌ Erro ao excluir item de ${tableName}:`, result.message || 'Erro desconhecido');
                throw new Error(result.message || `Não foi possível excluir o item de ${tableName}.`);
            }

            console.log(`✅ Item excluído de ${tableName}`);

        } catch (error) {
            console.error(`❌ Erro ao excluir item de ${tableName}:`, error);
            throw error;
        }
    },

    /**
     * Upsert (inserir ou atualizar)
     * @param {string} tableName - Nome da tabela
     * @param {Object} itemData - Dados do item
     * @param {string} onConflict - Campos para conflito (opcional, tratado no backend para daily_entries)
     * @returns {Promise<Object>} Item processado
     */
    async upsertItem(tableName, itemData, onConflict = '') {
        try {
            console.log(`🔄 Upsert em ${tableName}:`, itemData);
            
            const url = `${client.baseUrl}/api.php/upsertItem/${tableName}`;
            const response = await fetch(url, {
                method: 'POST', // O backend PHP decide se é INSERT ou UPDATE
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(itemData)
            });
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error(`❌ Erro no upsert de ${tableName}:`, result.message || 'Erro desconhecido');
                throw new Error(result.message || `Não foi possível processar o item em ${tableName}.`);
            }

            console.log(`✅ Upsert concluído em ${tableName}:`, result.data);
            return result.data;

        } catch (error) {
            console.error(`❌ Erro no upsert de ${tableName}:`, error);
            throw error;
        }
    },

    /**
     * Busca status de equipamento em uma data específica
     */
    async getEquipmentStatusAtDate(workId, equipmentId, date) {
        try {
            const url = `${client.baseUrl}/api.php/getEquipmentStatusAtDate?workId=${workId}&equipmentId=${equipmentId}&date=${date}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar status do equipamento');
            }
            
            return result.data;

        } catch (error) {
            console.error('Erro ao buscar status do equipamento:', error);
            throw error;
        }
    },

    /**
     * Verifica se equipamento está ativo em uma data
     */
    async isEquipmentActiveAtDate(workId, equipmentId, date) {
        try {
            const url = `${client.baseUrl}/api.php/isEquipmentActiveAtDate?workId=${workId}&equipmentId=${equipmentId}&date=${date}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao verificar se equipamento está ativo');
            }
            
            return result.data;

        } catch (error) {
            console.error('Erro ao verificar se equipamento está ativo:', error);
            throw error;
        }
    },

    /**
     * Busca salários de funcionários por obra
     */
    async fetchWorkEmployeeSalaries() {
        try {
            const url = `${client.baseUrl}/api.php/fetchWorkEmployeeSalaries`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar salários');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar salários:', error);
            throw error;
        }
    },

    /**
     * Salva salários de funcionários
     */
    async saveWorkEmployeeSalaries(workId, salaries) {
        try {
            const url = `${client.baseUrl}/api.php/saveWorkEmployeeSalaries`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workId: workId,
                    salaries: salaries
                })
            });
            
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao salvar salários');
            }
            
            return result;

        } catch (error) {
            console.error('Erro ao salvar salários:', error);
            throw error;
        }
    },

    /**
     * Busca último horímetro de equipamentos
     */
    async getLatestHorometer() {
        try {
            const url = `${client.baseUrl}/api.php/getLatestHorometer`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar horímetros');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar horímetros:', error);
            throw error;
        }
    },

    /**
     * Busca lançamentos diários
     */
    async fetchDailyEntries(workId, equipmentId, startDate, endDate) {
        try {
            let url = `${client.baseUrl}/api.php/fetchDailyEntries?workId=${workId}&startDate=${startDate}&endDate=${endDate}`;
            if (equipmentId) {
                url += `&equipmentId=${equipmentId}`;
            }
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar lançamentos diários');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar lançamentos diários:', error);
            throw error;
        }
    },

    /**
     * Atualiza status da parte diária para BM
     */
    async updateDailyPartStatusForBM(workId, equipmentId, bmLabel, status) {
        try {
            const url = `${client.baseUrl}/api.php/updateDailyPartStatusForBM`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workId: workId,
                    equipmentId: equipmentId,
                    bmLabel: bmLabel,
                    status: status
                })
            });
            
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao atualizar status da parte diária');
            }
            
            return result;

        } catch (error) {
            console.error('Erro ao atualizar status da parte diária:', error);
            throw error;
        }
    },

    /**
     * Busca lançamentos de transporte
     */
    async fetchTransportEntries(workId) {
        try {
            const url = `${client.baseUrl}/api.php/fetchTransportEntries?workId=${workId}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar lançamentos de transporte');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar lançamentos de transporte:', error);
            throw error;
        }
    },

    /**
     * Busca lançamentos de folha de pagamento
     */
    async fetchPayrollEntries(workId) {
        try {
            const url = `${client.baseUrl}/api.php/fetchPayrollEntries?workId=${workId}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar lançamentos de folha');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar lançamentos de folha:', error);
            throw error;
        }
    },

    /**
     * Busca lançamentos de despesas
     */
    async fetchExpenseEntries(workId) {
        try {
            const url = `${client.baseUrl}/api.php/fetchExpenseEntries?workId=${workId}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar despesas');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar despesas:', error);
            throw error;
        }
    },

    /**
     * Busca pagamentos de BM
     */
    async fetchBmPayments(workId) {
        try {
            const url = `${client.baseUrl}/api.php/fetchBmPayments?workId=${workId}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar pagamentos de BM');
            }
            
            return result.data || [];

        } catch (error) {
            console.error('Erro ao buscar pagamentos de BM:', error);
            throw error;
        }
    },

    /**
     * NOVO: Busca registros de substituição de equipamentos
     * @param {string} workId - ID da obra
     * @param {string} startDate - Data de início do período
     * @param {string} endDate - Data de fim do período
     * @param {string|null} substitutingEquipmentId - ID do equipamento substituto (opcional)
     * @returns {Promise<Array>} Array de registros de substituição
     */
    async fetchEquipmentSubstitutions(workId, startDate, endDate, substitutingEquipmentId = null) {
        try {
            let url = `${client.baseUrl}/api.php/fetchEquipmentSubstitutions?workId=${workId}&startDate=${startDate}&endDate=${endDate}`;
            if (substitutingEquipmentId) {
                url += `&substitutingEquipmentId=${substitutingEquipmentId}`;
            }
            const response = await fetch(url);
            const result = await response.json();
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao buscar substituições de equipamento');
            }
            return result.data || [];
        } catch (error) {
            console.error('Erro ao buscar substituições de equipamento:', error);
            throw error;
        }
    },

    /**
     * NOVO: Salva um registro de substituição de equipamento
     * @param {Object} substitutionData - Dados da substituição
     * @returns {Promise<Object>} Registro de substituição salvo/atualizado
     */
    async saveEquipmentSubstitution(substitutionData) {
        try {
            const url = `${client.baseUrl}/api.php/saveEquipmentSubstitution`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(substitutionData)
            });
            const result = await response.json();
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao salvar substituição de equipamento');
            }
            return result.data;
        } catch (error) {
            console.error('Erro ao salvar substituição de equipamento:', error);
            throw error;
        }
    },

    /**
     * NOVO: Exclui um registro de substituição de equipamento
     * @param {number|string} id - ID do registro de substituição
     * @returns {Promise<void>}
     */
    async deleteEquipmentSubstitution(id) {
        try {
            const url = `${client.baseUrl}/api.php/deleteEquipmentSubstitution?id=${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
            });
            const result = response.json();
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao excluir substituição de equipamento');
            }
        } catch (error) {
            console.error('Erro ao excluir substituição de equipamento:', error);
            throw error;
        }
    },

    // NOVOS MÉTODOS PARA PROPOSTAS DE EQUIPAMENTOS
    async fetchEquipmentProposals(selectQuery = '*, client_companies(name), my_companies(name)') {
        return this.fetchData('equipment_proposals', selectQuery);
    },

    async addEquipmentProposal(proposalData) {
        return this.addItem('equipment_proposals', proposalData);
    },

    async updateEquipmentProposal(id, proposalData) {
        return this.updateItem('equipment_proposals', id, proposalData);
    },

    async deleteEquipmentProposal(id) {
        return this.deleteItem('equipment_proposals', id);
    },

    // NOVOS MÉTODOS PARA PROPOSTAS DE AREIA
    async fetchSandProposals(selectQuery = '*, client_companies(name), my_companies(name)') {
        return this.fetchData('sand_proposals', selectQuery);
    },

    async addSandProposal(proposalData) {
        return this.addItem('sand_proposals', proposalData);
    },

    async updateSandProposal(id, proposalData) {
        return this.updateItem('sand_proposals', id, proposalData);
    },

    async deleteSandProposal(id) {
        return this.deleteItem('sand_proposals', id);
    },

    // NOVOS MÉTODOS PARA AVARIAS
    async fetchDamages(workId = null, startDate = null, endDate = null) {
        let url = `${client.baseUrl}/api.php/fetchDamages`;
        const params = new URLSearchParams();
        if (workId) params.append('workId', workId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao buscar avarias');
        }
        return result.data || [];
    },

    async addDamage(damageData) {
    console.log('🚀 API.addDamage() chamada');
    console.log('📦 Dados recebidos pelo método addDamage:', JSON.stringify(damageData, null, 2));
    
    // Validação crítica antes de enviar
    if (!damageData.id || damageData.id === 0 || damageData.id === '0') {
        console.error('❌ ERRO: ID inválido detectado no addDamage:', damageData.id);
        throw new Error('ID da avaria é inválido: ' + damageData.id);
    }
    
    // Garante que o ID seja uma string para evitar problemas
    damageData.id = String(damageData.id);
    
    console.log('✅ ID validado:', damageData.id, typeof damageData.id);
    
    try {
        const url = `${client.baseUrl}/api.php/addDamage`;
        console.log('📡 URL da requisição:', url);
        
        const requestBody = JSON.stringify(damageData);
        console.log('📤 Corpo da requisição:', requestBody);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBody
        });
        
        console.log('📡 Resposta do servidor - Status:', response.status);
        console.log('📡 Resposta do servidor - Status Text:', response.statusText);
        
        const responseText = await response.text();
        console.log('📡 Resposta do servidor - Texto bruto:', responseText);
        
        if (!response.ok) {
            console.error('❌ Resposta não OK:', response.status, response.statusText);
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // Tenta extrair mensagem de erro do JSON
            try {
                const errorJson = JSON.parse(responseText);
                if (errorJson.error) {
                    errorMessage = errorJson.error;
                }
            } catch (parseError) {
                console.warn('Não foi possível parsear erro como JSON');
            }
            
            throw new Error(errorMessage);
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ Erro ao parsear JSON:', parseError);
            console.error('📄 Texto que falhou no parse:', responseText);
            throw new Error('Resposta inválida do servidor (não é JSON válido)');
        }
        
        console.log('✅ Resultado parseado:', result);
        
        if (result.error) {
            console.error('❌ Erro retornado pelo servidor:', result.error);
            throw new Error('Erro ao adicionar avaria: ' + result.error);
        }
        
        console.log('✅ Avaria adicionada com sucesso via API');
        return result.data || result; // Retorna os dados ou o resultado completo
        
    } catch (error) {
        console.error('❌ Erro na chamada da API addDamage:', error);
        throw error;
    }
},

    async updateDamage(id, damageData) {
        const url = `${client.baseUrl}/api.php/updateDamage?id=${id}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(damageData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao atualizar avaria');
        }
        return result.data;
    },

    async deleteDamage(id) {
        const url = `${client.baseUrl}/api.php/deleteDamage?id=${id}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao excluir avaria');
        }
    },

    async fetchDamageItems(damageId) {
        const url = `${client.baseUrl}/api.php/fetchDamageItems?damageId=${damageId}`;
        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao buscar itens de avaria');
        }
        return result.data || [];
    },

    async addDamageItem(itemData) {
        const url = `${client.baseUrl}/api.php/addDamageItem`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao adicionar item de avaria');
        }
        return result.data;
    },

    async updateDamageItem(id, itemData) {
        const url = `${client.baseUrl}/api.php/updateDamageItem?id=${id}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao atualizar item de avaria');
        }
        return result.data;
    },

    async deleteDamageItem(id) {
        const url = `${client.baseUrl}/api.php/deleteDamageItem?id=${id}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao excluir item de avaria');
        }
    },

    // NOVOS MÉTODOS PARA FORNECIMENTO DE AREIA
    async fetchSandSupplyConfigs() {
        const url = `${client.baseUrl}/api.php/fetchSandSupplyConfigs`;
        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao buscar configurações de fornecimento de areia');
        }
        return result.data || [];
    },

    async addSandSupplyConfig(configData) {
        const url = `${client.baseUrl}/api.php/addSandSupplyConfig`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao adicionar configuração de fornecimento de areia');
        }
        return result.data;
    },

    async updateSandSupplyConfig(id, configData) {
        const url = `${client.baseUrl}/api.php/updateSandSupplyConfig?id=${id}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao atualizar configuração de fornecimento de areia');
        }
        return result.data;
    },

    async deleteSandSupplyConfig(id) {
        const url = `${client.baseUrl}/api.php/deleteSandSupplyConfig?id=${id}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao excluir configuração de fornecimento de areia');
        }
    },

    async fetchSandDeliveries(supplyConfigId = null, startDate = null, endDate = null, invoiceStatus = null) {
        let url = `${client.baseUrl}/api.php/fetchSandDeliveries`;
        const params = new URLSearchParams();
        if (supplyConfigId) params.append('supplyConfigId', supplyConfigId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (invoiceStatus) params.append('invoiceStatus', invoiceStatus);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao buscar entregas de areia');
        }
        return result.data || [];
    },

    async addSandDelivery(deliveryData) {
        const url = `${client.baseUrl}/api.php/addSandDelivery`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deliveryData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao adicionar entrega de areia');
        }
        return result.data;
    },

    async updateSandDelivery(id, deliveryData) {
        const url = `${client.baseUrl}/api.php/updateSandDelivery?id=${id}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deliveryData)
        });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao atualizar entrega de areia');
        }
        return result.data;
    },

    async deleteSandDelivery(id) {
        const url = `${client.baseUrl}/api.php/deleteSandDelivery?id=${id}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao excluir entrega de areia');
        }
    },

    async fetchLatestSandPrices() {
        const url = `${client.baseUrl}/api.php/fetchLatestSandPrices`;
        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || result.error) {
            throw new Error(result.message || 'Erro ao buscar últimos preços de areia');
        }
        return result.data || [];
    },

    // ============================================
    // 🧹 FUNÇÕES DE LIMPEZA DE BANCO DE DADOS
    // ============================================

    /**
     * Limpa lançamentos órfãos de equipamentos (que não existem mais em obras ativas)
     * Remove apenas lançamentos de obras/equipamentos que foram excluídos
     * NÃO afeta obras marcadas como encerradas
     * @returns {Promise<{deleted: number, message: string}>}
     */
    async cleanupOrphanedEquipmentEntries() {
        try {
            console.log('🧹 Iniciando limpeza de lançamentos órfãos...');
            const url = `${client.baseUrl}/api.php/cleanupOrphanedEquipmentEntries`;
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao limpar lançamentos órfãos');
            }
            
            console.log(`✅ Limpeza concluída: ${result.deleted} registros removidos`);
            return result;
        } catch (error) {
            console.error('❌ Erro na limpeza de lançamentos órfãos:', error);
            throw error;
        }
    },

    /**
     * Limpa TODOS os dados órfãos de TODAS as tabelas do banco de dados
     * Remove registros que referenciam obras, equipamentos, funcionários, etc. que não existem mais
     * Mantém dados de obras encerradas
     * @returns {Promise<{tables: Object, totalDeleted: number, message: string}>}
     */
    async cleanupAllOrphanedData() {
        try {
            console.log('🧹 Iniciando limpeza GERAL do banco de dados...');
            const url = `${client.baseUrl}/api.php/cleanupAllOrphanedData`;
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao limpar banco de dados');
            }
            
            console.log(`✅ Limpeza geral concluída: ${result.totalDeleted} registros removidos no total`);
            console.table(result.tables);
            return result;
        } catch (error) {
            console.error('❌ Erro na limpeza geral:', error);
            throw error;
        }
    },

    /**
     * Remove TODOS os dados associados a uma obra específica
     * Usado automaticamente quando uma obra é excluída
     * @param {number} workId - ID da obra
     * @returns {Promise<{tables: Object, totalDeleted: number}>}
     */
    async deleteWorkRelatedData(workId) {
        try {
            console.log(`🗑️ Removendo todos os dados da obra ${workId}...`);
            const url = `${client.baseUrl}/api.php?action=deleteWorkRelatedData&workId=${workId}`;
            const response = await fetch(url, { method: 'DELETE' });
            const result = await response.json();
            
            if (!response.ok || result.error) {
                throw new Error(result.message || 'Erro ao remover dados da obra');
            }
            
            console.log(`✅ Dados da obra removidos: ${result.totalDeleted} registros`);
            console.table(result.tables);
            return result;
        } catch (error) {
            console.error('❌ Erro ao remover dados da obra:', error);
            throw error;
        }
    }
};
