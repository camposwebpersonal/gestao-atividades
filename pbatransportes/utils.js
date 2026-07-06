// utils.js
import { appState } from './appState.js';

// Elementos DOM globais que serão inicializados em main.js
let spinner;
let modal;
let modalTitle;
let modalBody;
let closeModalBtn;

/**
 * Inicializa os elementos DOM relacionados à UI.
 * Deve ser chamado uma vez no início da aplicação.
 * @param {HTMLElement} spinnerEl - O elemento do spinner.
 * @param {HTMLElement} modalEl - O elemento do modal.
 * @param {HTMLElement} modalTitleEl - O elemento do título do modal.
 * @param {HTMLElement} modalBodyEl - O elemento do corpo do modal.
 * @param {HTMLElement} closeModalBtnEl - O botão de fechar do modal.
 */
export const initUIElements = (spinnerEl, modalEl, modalTitleEl, modalBodyEl, closeModalBtnEl) => {
    spinner = spinnerEl;
    modal = modalEl;
    modalTitle = modalTitleEl;
    modalBody = modalBodyEl;
    closeModalBtn = closeModalBtnEl;

    // Adiciona listener para fechar o modal ao clicar no botão de fechar
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    // Adiciona listener para fechar o modal ao clicar fora dele
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
};

/**
 * Exibe o spinner de carregamento.
 */
export const showSpinner = () => {
    if (spinner) {
        spinner.style.display = 'flex';
    }
};

/**
 * Esconde o spinner de carregamento.
 */
export const hideSpinner = () => {
    if (spinner) {
        spinner.style.display = 'none';
    }
};

/**
 * Abre o modal genérico com o título e conteúdo especificados.
 * @param {string} title - O título a ser exibido no cabeçalho do modal.
 * @param {HTMLElement} content - O elemento HTML a ser inserido no corpo do modal.
 */
export const openModal = (title, content) => {
    if (modal && modalTitle && modalBody) {
        modalTitle.textContent = title;
        modalBody.innerHTML = '';
        modalBody.appendChild(content); 
        modal.style.display = 'block';
    }
};

/**
 * Fecha o modal genérico.
 */
export const closeModal = () => {
    if (modal && modalBody) {
        modal.style.display = 'none';
        modalBody.innerHTML = '';
    }
};

/**
 * Formata um valor para exibição em uma tabela.
 * @param {*} value - O valor a ser formatado.
 * @param {string} type - O tipo do campo (ex: 'date', 'number', 'checkbox').
 * @returns {string} O valor formatado.
 */
export const formatFieldValue = (value, type) => {
    if (value === null || typeof value === 'undefined') return '---';
    if (type === 'checkbox') return value ? 'Sim' : 'Não';
    if (type === 'date' && value) return new Date(value + 'T00:00:00').toLocaleDateString('pt-BR');
    if (type === 'number' && typeof value === 'number') return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return value;
};

/**
 * Formata um valor de data para ser exibido corretamente em um input type="date".
 * @param {*} value - O valor da data.
 * @param {string} type - O tipo do campo (deve ser 'date').
 * @returns {string} A data formatada como 'YYYY-MM-DD'.
 */
export const formatInputDate = (value, type) => {
    if (type !== 'date' || !value) return value || '';
    return value.split('T')[0];
};

/**
 * Converte um valor de moeda formatado para um número.
 * @param {string} currencyString - A string de moeda formatada (ex: "R$ 1.234,56").
 * @returns {number} O valor numérico.
 */
export const parseCurrencyToNumber = (currencyString) => {
    if (typeof currencyString !== 'string') return 0;
    
    const match = currencyString.match(/R\$\s*([\d.,]+)/);
    if (match) {
        const numberStr = match[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(numberStr) || 0;
    }
    
    const numbers = currencyString.match(/[\d.,]+/g);
    if (numbers && numbers.length > 0) {
        const lastNumber = numbers[numbers.length - 1];
        return parseFloat(lastNumber.replace(/\./g, '').replace(',', '.')) || 0;
    }
    
    return 0;
};

/**
 * Formata um número para o formato de moeda brasileira (R$).
 * @param {number} value - O número a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
export const formatCurrency = (value) => {
    const num = (typeof value === 'number') ? value : parseFloat(value);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Calcula horas dedutíveis de uma parada, considerando o intervalo de refeição.
 * @param {Date} stoppageStart - Hora de início da parada.
 * @param {Date} stoppageEnd - Hora de fim da parada.
 * @param {Date|null} mealStart - Hora de início da refeição (opcional).
 * @param {Date|null} mealEnd - Hora de fim da refeição (opcional).
 * @returns {number} Horas dedutíveis.
 */
export function calculateDeductibleHours(stoppageStart, stoppageEnd, mealStart, mealEnd) {
    if (!stoppageStart || !stoppageEnd || isNaN(stoppageStart.getTime()) || isNaN(stoppageEnd.getTime())) return 0;
    const sStart = stoppageStart.getTime();
    const sEnd = stoppageEnd.getTime();

    if (sEnd < sStart) {
        stoppageEnd.setDate(stoppageEnd.getDate() + 1);
        return calculateDeductibleHours(stoppageStart, stoppageEnd, mealStart, mealEnd);
    }

    if (!mealStart || !mealEnd || isNaN(mealStart.getTime()) || isNaN(mealEnd.getTime())) {
        return (sEnd - sStart) / 3600000;
    }

    const mStart = mealStart.getTime();
    const mEnd = mealEnd.getTime();

    if (mEnd < mStart) {
        mealEnd.setDate(mealEnd.getDate() + 1);
        return calculateDeductibleHours(stoppageStart, stoppageEnd, mealStart, mealEnd);
    }

    const intersectionStart = Math.max(sStart, mStart);
    const intersectionEnd = Math.min(sEnd, mEnd);
    const intersectionDuration = Math.max(0, intersectionEnd - intersectionStart);
    const totalStoppageDuration = sEnd - sStart;
    return (totalStoppageDuration - intersectionDuration) / 3600000;
}

/**
 * Retorna o rótulo do BM para uma dada data.
 * @param {string} dateStr - Data no formato 'YYYY-MM-DD'.
 * @param {Array<Object>} periods - Array de objetos de período de medição.
 * @returns {string} O rótulo do BM (ex: 'BM 1') ou string vazia.
 */
export const getBMLabelForDate = (dateStr, periods = []) => {
    if (!periods) return '';
    const date = new Date(dateStr + 'T00:00:00');
    for (let i = 0; i < periods.length; i++) {
        const start = new Date(periods[i].start + 'T00:00:00');
        const end = new Date(periods[i].end + 'T00:00:00');
        if (date >= start && date <= end) {
            return `BM ${i + 1}`;
        }
    }
    return '';
};

/**
 * Extrai o número do BM de uma string
 * @param {string} bmText - Texto contendo BM (ex: "BM 4", "Período: BM 4")
 * @returns {string} - Número do BM ou string vazia
 */
export const extractBMNumber = (bmText) => {
    if (!bmText) return '';
    const match = bmText.match(/BM\s*(\d+)/i);
    return match ? match[1] : '';
};

/**
 * Formata mês e ano no padrão brasileiro
 * @param {Date} date - Data a ser formatada
 * @returns {string} - Formato "MMM-YY" (ex: "AGO-25")
 */
export const formatMonthYear = (date) => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const mes = meses[date.getMonth()];
    const ano = date.getFullYear().toString().slice(-2);
    return `${mes}-${ano}`;
};

/**
 * Formata intervalo de datas no padrão DD-MM-YYYY a DD-MM-YYYY
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @returns {string} - Intervalo no formato "DD-MM-YYYY a DD-MM-YYYY"
 */
export const getDateRangeFormatted = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    
    // Converte YYYY-MM-DD para DD-MM-YYYY
    const formatDDMMYYYY = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    };
    
    return `${formatDDMMYYYY(startDate)} a ${formatDDMMYYYY(endDate)}`;
};

/**
 * Determina o mês de referência baseado no intervalo de datas
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @returns {string} - Mês de referência no formato "MMM-YY" (ex: "AGO-25")
 */
export const getReferenceMes = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const startMonth = start.getMonth();
    const endMonth = end.getMonth();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    if (startMonth === endMonth && startYear === endYear) {
        return formatMonthYear(end);
    }
    return `${formatMonthYear(start)} a ${formatMonthYear(end)}`;
};

/**
 * Gera o nome do arquivo PDF seguindo o padrão estabelecido
 * @param {string} workName - Nome da obra
 * @param {string} bmNumber - Número do BM
 * @param {string} startDate - Data inicial do período
 * @param {string} endDate - Data final do período
 * @param {string} reportType - Tipo do relatório (opcional, ex: "TERCEIRIZADOS")
 * @returns {string} - Nome do arquivo no formato correto
 */
export const generatePDFFileName = (workName, bmNumber, startDate, endDate, reportType = '') => {
    const obraNome = (workName || 'OBRA').toUpperCase().trim();
    const bmNumero = bmNumber ? `BM ${bmNumber}` : '';
    const mesReferencia = getReferenceMes(startDate, endDate);
    const tipoRelatorio = reportType ? ` - ${reportType.toUpperCase()}` : '';
    const parts = [obraNome, bmNumero, mesReferencia].filter(Boolean);
    const baseName = parts.join(' - ');
    const nomeCompleto = `${baseName}${tipoRelatorio}`;
    const nomeArquivo = nomeCompleto.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').trim();
    return nomeArquivo;
};

/**
 * Extrai informações do cabeçalho do relatório para gerar o nome do arquivo
 * @param {HTMLElement} headerElement - Elemento do cabeçalho do relatório
 * @returns {Object} - Objeto com as informações extraídas
 */
export const extractReportInfo = (headerElement) => {
    const info = {
        myCompany: '', workName: '', clientName: '', bmNumber: '',
        startDate: '', endDate: '', period: '', reportSpecificTitle: ''
    };
    if (!headerElement) return info;
    const paragraphs = headerElement.querySelectorAll('p');
    const h3Element = headerElement.querySelector('h3');
    if (h3Element) {
        info.myCompany = h3Element.textContent.trim();
    }
    paragraphs.forEach(p => {
        const text = p.textContent || '';
        if (text.includes('Obra:') && text.includes('Cliente:')) {
            const workClientParts = text.split('Cliente:');
            info.workName = workClientParts[0].replace('Obra:', '').trim();
            info.clientName = workClientParts[1].trim();
        } else if (text.includes('Obra:')) {
            info.workName = text.replace('Obra:', '').trim();
        }
        if (text.includes('Período Medido:') || text.includes('Período:')) {
            info.period = text;
            info.bmNumber = extractBMNumber(text);
            const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
            if (dateMatch) {
                const startParts = dateMatch[1].split('/');
                const endParts = dateMatch[2].split('/');
                info.startDate = `${startParts[2]}-${startParts[1]}-${startParts[0]}`;
                info.endDate = `${endParts[2]}-${endParts[1]}-${endParts[0]}`;
            }
        }
        if (text.includes('Relatório de') || text.includes('Resumo de')) {
            info.reportSpecificTitle = text.trim();
        }
    });
    return info;
};

/**
 * Cria um formulário HTML genérico para operações CRUD.
 * @param {Object} config - A configuração do CRUD (title, fields, table).
 * @param {Object} [item={}] - O item existente para preencher o formulário (para edição).
 * @returns {HTMLFormElement} O elemento do formulário.
 */
export const createFormForCrud = (config, item = {}) => {
    const form = document.createElement('form');
    
    // 🎯 Garantir que item seja sempre um objeto
    const safeItem = item || {};
    
    // Debug
    console.log('🔍 createFormForCrud config:', config);
    console.log('🔍 config.fields:', config.fields);
    console.log('🔍 item recebido:', item);
    console.log('🔍 safeItem:', safeItem);
    
    // Filtrar campos válidos
    const validFields = (config.fields || []).filter(f => {
        if (!f || !f.name) {
            console.warn('⚠️ Campo inválido ignorado:', f);
            return false;
        }
        return true;
    });
    
    console.log('✅ validFields:', validFields);
    
    form.innerHTML = `
        <div class="form-grid">
            ${validFields.map((f, index) => {
                console.log(`🔧 Processando campo ${index}:`, f);
                const value = safeItem[f.name] ?? (f.default ?? '');
                console.log(`   Valor do campo ${f.name}:`, value);
                if (f.type === 'select') {
                    const options = (appState[f.optionsKey] || []).filter(opt => opt && opt.id && opt.name);
                    const defaultOption = f.allowNone ? '<option value="">Nenhum</option>' : '';
                    return `
                        <div class="form-group" id="group-${f.name}" style="${f.dependsOn ? 'display: none;' : ''}">
                            <label for="field-${f.name}">${f.label}</label>
                            <select id="field-${f.name}" name="${f.name}" ${f.required ? 'required' : ''}>
                                ${defaultOption}
                                ${options.map(opt => `<option value="${opt.id}" ${value == opt.id ? 'selected' : ''}>${opt.name}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }
                if (f.type === 'checkbox') {
                    return `
                        <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;">
                            <input type="checkbox" id="field-${f.name}" name="${f.name}" ${value ? 'checked' : ''}>
                            <label for="field-${f.name}">${f.label}</label>
                        </div>
                    `;
                }
                if (f.readOnly) {
                    return `
                        <div class="form-group">
                            <label for="field-${f.name}">${f.label}</label>
                            <input type="${f.type || 'text'}" id="field-${f.name}" name="${f.name}"
                                value="${f.type === 'date' ? formatInputDate(value, f.type) : value}"
                                ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''}
                                readonly style="background-color: #2a2a2a !important; color: #888 !important;">
                        </div>
                    `;
                }
                return `
                    <div class="form-group">
                        <label for="field-${f.name}">${f.label}</label>
                        <input type="${f.type || 'text'}" id="field-${f.name}" name="${f.name}"
                            value="${f.type === 'date' ? formatInputDate(value, f.type) : (value || '')}"
                            ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''}
                            ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
    `;
    form.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    validFields.forEach(field => {
        if (field && field.dependsOn) {
            const dependencyCheckbox = form.querySelector(`#field-${field.dependsOn}`);
            const dependentGroup = form.querySelector(`#group-${field.name}`);
            const toggleVisibility = () => {
                if(dependentGroup) dependentGroup.style.display = dependencyCheckbox.checked ? 'block' : 'none';
            };
            if(dependencyCheckbox) {
                dependencyCheckbox.addEventListener('change', toggleVisibility);
                toggleVisibility();
            }
        }
    });
    return form;
};

/**
 * Cria um modal de confirmação async e aguarda a resposta do usuário.
 * @param {string} title - Título do modal.
 * @param {string} message - Mensagem HTML do modal.
 * @param {string} confirmText - Texto do botão de confirmação.
 * @param {string} cancelText - Texto do botão de cancelamento.
 * @returns {Promise<boolean>} True se confirmado, False se cancelado.
 */
export const createConfirmationModalAsync = (title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    return new Promise((resolve) => {
        const modalContentHtml = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 14px; margin-bottom: 20px;">${message}</div>
                <div class="modal-footer" style="justify-content: center; gap: 15px;">
                    <button class="btn btn-secondary" id="async-cancel-btn">${cancelText}</button>
                    <button class="btn btn-primary" id="async-confirm-btn">${confirmText}</button>
                </div>
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalContentHtml;
        const modalContent = tempDiv.firstElementChild;
        
        modalContent.querySelector('#async-cancel-btn').addEventListener('click', () => {
            resolve(false);
            closeModal();
        });
        
        modalContent.querySelector('#async-confirm-btn').addEventListener('click', () => {
            resolve(true);
            closeModal();
        });
        
        // openModal espera (title, content) - dois parâmetros
        openModal(title, modalContent);
    });
};

/**
 * Função auxiliar para criar um modal de confirmação.
 * @param {Function} onConfirm - Função a ser executada se o usuário confirmar.
 * @param {string} message - Mensagem a ser exibida no modal.
 * @param {string} confirmText - Texto do botão de confirmação.
 * @returns {HTMLElement} O elemento do modal de confirmação.
 */
export const createConfirmationModal = (onConfirm, message = 'Tem certeza que deseja continuar?', confirmText = 'Confirmar') => {
    const modalContentHtml = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: #ffc107; margin-bottom: 20px;">⚠️</div>
            <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
            <div class="modal-footer" style="justify-content: center; gap: 15px;">
                <button class="btn btn-secondary" id="cancel-action-btn">Cancelar</button>
                <button class="btn btn-primary" id="confirm-action-btn">${confirmText}</button>
            </div>
        </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContentHtml;
    const modalContent = tempDiv.firstElementChild;
    modalContent.querySelector('#cancel-action-btn').addEventListener('click', closeModal);
    modalContent.querySelector('#confirm-action-btn').addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    return modalContent;
};

/**
 * Adiciona uma capa ao PDF gerado.
 * @param {jsPDF} pdf - Instância do jsPDF.
 * @param {Object} headerInfo - Informações do cabeçalho do relatório.
 * @param {string} coverTitle - Título da capa.
 * @param {string} coverSubtitle - Subtítulo da capa (geralmente nome da empresa).
 * @param {boolean} includeBMPeriod - Se deve incluir BM e período na capa (NOVO PARÂMETRO).
 */
export const addPdfCoverPage = (pdf, headerInfo, coverTitle, coverSubtitle, includeBMPeriod = true) => {
    // CORREÇÃO: Removidas as chamadas pdf.addPage() que causavam páginas em branco.
    // A função agora desenha na página ATUAL.
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Título principal
    pdf.setFontSize(36);
    pdf.setFont(undefined, 'bold');
    pdf.text(coverTitle, pdfWidth / 2, pdfHeight / 3, { align: 'center' });

    // Subtítulo (nome da empresa)
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold'); // MUDANÇA: Agora em negrito
    pdf.text(coverSubtitle, pdfWidth / 2, pdfHeight / 3 + 20, { align: 'center' });

    // Informações adicionais
    let y = pdfHeight / 2;
    
    // SEMPRE mostra obra e cliente - FONTE MAIOR E EM NEGRITO
    if (headerInfo.workName) {
        pdf.setFontSize(27); // MUDANÇA: Fonte maior para obra
        pdf.setFont(undefined, 'bold'); // MUDANÇA: Em negrito
        pdf.text(`Obra: ${headerInfo.workName}`, pdfWidth / 2, y, { align: 'center' });
        y += 15; // MUDANÇA: Espaçamento maior
    }
    if (headerInfo.clientName) {
        pdf.setFontSize(27); // MUDANÇA: Fonte maior para cliente
        pdf.setFont(undefined, 'bold'); // MUDANÇA: Em negrito
        pdf.text(`Cliente: ${headerInfo.clientName}`, pdfWidth / 2, y, { align: 'center' });
        y += 15; // MUDANÇA: Espaçamento maior
    }
    
    // CONTROLE NOVO: Só mostra período, BM e título específico se includeBMPeriod for true
    if (includeBMPeriod) {
        // MUDANÇA: Fonte padrão para os demais itens, mas ainda em negrito
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        
        if (headerInfo.period) {
            pdf.text(headerInfo.period, pdfWidth / 2, y, { align: 'center' });
            y += 10;
        }
        if (headerInfo.bmNumber) {
            pdf.text(`BM: ${headerInfo.bmNumber}`, pdfWidth / 2, y, { align: 'center' });
            y += 10;
        }
        if (headerInfo.reportSpecificTitle && !coverTitle.includes(headerInfo.reportSpecificTitle)) {
            pdf.text(headerInfo.reportSpecificTitle, pdfWidth / 2, y, { align: 'center' });
            y += 10;
        }
    }

   
};

/**
 * Função para formatar data no formato brasileiro.
 * @param {string} dateString - A string da data no formato 'YYYY-MM-DD'.
 * @returns {string} A data formatada como 'DD/MM/YYYY' ou '---' se inválida.
 */
export const formatDateBR = (dateString) => {
    if (!dateString) return '---';
    const cleanDate = String(dateString).trim();
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        date = new Date(cleanDate + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
        const [day, month, year] = cleanDate.split('/');
        date = new Date(`${year}-${month}-${day}T00:00:00`);
    } else {
        date = new Date(cleanDate);
    }
    if (isNaN(date.getTime())) {
        console.warn('Data inválida encontrada:', dateString);
        return '---';
    }
    return date.toLocaleDateString('pt-BR');
};

/**
 * Função debounce para limitar a frequência de execução de uma função.
 * @param {Function} func - A função a ser executada.
 * @param {number} delay - O atraso em milissegundos.
 * @returns {Function} A função debounced.
 */
export const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

/**
 * Gera link do WhatsApp para enviar PDF
 * @param {string} phoneNumber - Número do telefone (formato: 5587991034022)
 * @param {string} pdfName - Nome do PDF gerado
 * @param {string} message - Mensagem personalizada (opcional)
 * @returns {string} - URL do WhatsApp
 */
export const generateWhatsAppLink = (phoneNumber, pdfName, message = '') => {
    const defaultMessage = `Olá! Segue o PDF: *${pdfName}*`;
    const finalMessage = message || defaultMessage;
    const encodedMessage = encodeURIComponent(finalMessage);
    return `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
};

/**
 * Abre o WhatsApp para enviar PDF
 * @param {string} phoneNumber - Número do telefone
 * @param {string} pdfName - Nome do PDF
 * @param {string} customMessage - Mensagem personalizada (opcional)
 */
export const sendPDFViaWhatsApp = (phoneNumber, pdfName, customMessage = '') => {
    const link = generateWhatsAppLink(phoneNumber, pdfName, customMessage);
    window.open(link, '_blank');
};

/**
 * Resolve o nome legível de um tipo de equipamento a partir do seu ID ou nome.
 * Usa appState.equipment_types para a busca.
 * @param {number|string} typeIdOrName - ID numérico ou nome literal do tipo.
 * @returns {string} Nome legível do tipo, ou string vazia se não encontrado.
 */
export const getEquipTypeName = (typeIdOrName) => {
    if (typeIdOrName === null || typeIdOrName === undefined || typeIdOrName === '') return '';
    const types = appState.equipment_types || [];
    if (types.length > 0) {
        const found = types.find(t => t.id == typeIdOrName || t.name === typeIdOrName);
        if (found) return found.name;
    }
    // Fallback: retorna como string (compatibilidade com dados legados que já tinham nome)
    return String(typeIdOrName);
};

// Estilos padrão para inputs flatpickr em tema escuro
const _fpDarkStyle = {
    background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #555',
    borderRadius: '4px', padding: '5px 8px', fontSize: '13px',
    width: '100%', boxSizing: 'border-box', cursor: 'pointer',
};

/**
 * Aplica flatpickr (DD/MM/YYYY) a todos os inputs type="date" ainda não inicializados.
 * Seguro chamar múltiplas vezes — ignora inputs já com flatpickr.
 */
export const initGlobalFlatpickr = () => {
    if (typeof flatpickr === 'undefined') return;
    const cfg = {
        locale: window.flatpickr?.l10ns?.pt || 'pt',
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        allowInput: true,
        onReady: (_d, _s, inst) => {
            if (inst.altInput) {
                Object.assign(inst.altInput.style, _fpDarkStyle);
                inst.altInput.addEventListener('focus', () => inst.altInput.select());
            }
        },
    };
    document.querySelectorAll('input[type="date"]').forEach(el => {
        if (!el._flatpickr && !el.readOnly) flatpickr(el, cfg);
    });
};

// Testes que estavam no arquivo original
console.log('=== TESTANDO parseCurrencyToNumber ===');
console.log('Teste 1:', parseCurrencyToNumber("R$ 600,00"));
console.log('Teste 2:', parseCurrencyToNumber("Valor Dia: R$ 1.234,56"));
console.log('Teste 3:', parseCurrencyToNumber("Valor Terc.: R$ 600,00"));
console.log('Teste 4:', parseCurrencyToNumber("R$ 1.234.567,89"));
console.log('=========================================');

