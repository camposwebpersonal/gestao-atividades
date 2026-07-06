// inicio.js
import { apiClient } from './api.js';
import { showSpinner, hideSpinner } from './utils.js';

/**
 * 🧹 Executa limpeza GERAL de TODAS as tabelas do banco de dados
 * Remove dados órfãos de todas as tabelas mantendo banco organizado
 */
const handleCleanupAllData = async () => {
    if (!confirm('🧹 LIMPEZA GERAL DO BANCO DE DADOS\n\nSerão verificadas e limpas TODAS as tabelas:\n- Lançamentos de equipamentos\n- Despesas\n- Avarias\n- Folha de pagamento\n- Transportes\n- Entregas de areia\n- E todas as outras tabelas\n\nDados órfãos (que referenciam obras/equipamentos/funcionários excluídos) serão removidos.\n\nObras ENCERRADAS NÃO serão afetadas.\n\nDeseja continuar?')) {
        return;
    }

    showSpinner();
    try {
        console.log('🧹 Iniciando limpeza geral do banco de dados...');
        const result = await apiClient.cleanupAllOrphanedData();
        
        // Montar mensagem detalhada
        let message = `✅ LIMPEZA GERAL CONCLUÍDA!\n\nTotal removido: ${result.totalDeleted} registros\n\nDetalhes por tabela:\n`;
        
        Object.entries(result.tables).forEach(([table, count]) => {
            if (count > 0) {
                message += `\n• ${table}: ${count} registros`;
            }
        });
        
        alert(message);
        
        // Recarregar página para atualizar todos os dados
        location.reload();
        
    } catch (error) {
        console.error('❌ Erro na limpeza geral:', error);
        alert(`❌ Erro ao executar limpeza geral:\n${error.message}`);
    } finally {
        hideSpinner();
    }
};

/**
 * Inicializa a seção "Início".
 * Configura botão de limpeza geral do banco de dados
 */
export const initHomeSection = () => {
    console.log('Seção Início inicializada.');
    
    // 🧹 BOTÃO DE LIMPEZA GERAL DO BANCO (SEÇÃO INÍCIO)
    const cleanupAllBtn = document.getElementById('cleanup-all-btn');
    if (cleanupAllBtn) {
        cleanupAllBtn.addEventListener('click', handleCleanupAllData);
    }
};
