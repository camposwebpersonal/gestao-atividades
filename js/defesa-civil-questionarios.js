// Levantamento de Proteção e Defesa Civil (ICM) – TCE-PE.
// Área especial da Defesa Civil (fora de Controle de Demandas) com os dois questionários,
// as mesmas perguntas e opções do formulário do TCE, salvamento com nome, data e hora de quem
// preencheu, histórico, rascunho automático no aparelho e impressão no formato do formulário.
import {supabase} from '../supabase_compat.js?v=11';

const TABLE = 'defesa_civil_questionarios';
const ANO = 2026;
const SN = ['Sim', 'Não'];
const DECL = 'Declaro que as informações prestadas neste formulário são verdadeiras e que estou ciente da minha responsabilidade pelo preenchimento correto dos dados.';
const yesNo = (n, dimensao, texto) => ({id: String(n), n: String(n), dimensao, texto, tipo: 'radio', opcoes: SN});

export const QUESTIONARIOS = [
  {
    id: 'diagnostico', titulo: 'Diagnóstico de Gestão de Riscos e Desastres - ICM 2026', curto: 'Diagnóstico de Riscos e Desastres', icone: '🛡️',
    descricao: 'Planejamento, estrutura institucional e ações de prevenção (Dimensões I, II e III).',
    perguntas: [
      yesNo(1, 'Dimensão I', 'O Plano Plurianual do município inclui Proteção e Defesa Civil?'),
      yesNo(2, 'Dimensão I', 'O município tem Plano Diretor aprovado por Lei Municipal que inclua Proteção e Defesa Civil?'),
      yesNo(3, 'Dimensão I', 'O município tem Plano de Redução de Riscos?'),
      yesNo(4, 'Dimensão I', 'O município tem Carta de Suscetibilidade ou documento equivalente de identificação de riscos de desastres?'),
      yesNo(5, 'Dimensão I', 'O município tem Carta Geotécnica de Aptidão à Urbanização?'),
      yesNo(6, 'Dimensão I', 'O município tem Mapeamento de Áreas de Risco?'),
      yesNo(7, 'Dimensão I', 'O município tem Cadastro ou Identificação de Famílias em Áreas de Risco?'),
      yesNo(8, 'Dimensão I', 'O município tem Plano de Contingência para desastres?'),
      yesNo(9, 'Dimensão II', 'O município tem Sistema ou Conselho Intersetorial de Proteção e Defesa Civil?'),
      yesNo(10, 'Dimensão II', 'O município tem Coordenação de Proteção e Defesa Civil?'),
      yesNo(11, 'Dimensão II', 'O município tem Dotação Orçamentária na LOA para Proteção e Defesa Civil?'),
      yesNo(12, 'Dimensão II', 'O município tem Nupdecs (Núcleos Comunitários)?'),
      yesNo(13, 'Dimensão II', 'O município tem algum servidor capacitado nos cursos de Proteção e Defesa Civil da Sedec (EVG/Enap)?'),
      yesNo(14, 'Dimensão II', 'O município tem servidor com certificação especial no Plano de Capacitação Continuada da Sedec?'),
      yesNo(15, 'Dimensão II', 'O município tem servidor habilitado no Sistema Integrado de Informações sobre Desastres - S2iD?'),
      yesNo(16, 'Dimensão III', 'O município tem fiscalização de edificações em áreas de risco?'),
      yesNo(17, 'Dimensão III', 'O município tem Programa de Habitação de Interesse Social para reassentamento de famílias removidas de áreas de risco ou desabrigadas em função de desastres?'),
      yesNo(18, 'Dimensão III', 'O município adotou medidas de drenagem urbana para prevenção de riscos de desastre?'),
      yesNo(19, 'Dimensão III', 'O município tem campanhas educativas sobre riscos de desastres?'),
      yesNo(20, 'Dimensão III', 'O município tem sistema de monitoramento e alerta de desastres antecipado?'),
      {id: '21', n: '21', texto: 'Declaração', tipo: 'declaracao', opcoes: [DECL]}
    ],
    tce: {data: '16/10/2026 22:45', respostas: Object.fromEntries([...Array.from({length: 20}, (_, i) => [String(i + 1), 'Não']), ['21', true]])}
  },
  {
    id: 'estrutura', titulo: 'Estrutura e Capacidade Operacional da Defesa Civil - 2026', curto: 'Estrutura e Capacidade Operacional', icone: '🚨',
    descricao: 'Monitoramento, equipamentos, abrigos, comunicação, estrutura e recursos.',
    perguntas: [
      {id: '1', n: '1', tipo: 'multi', texto: 'Como o município realiza o monitoramento das áreas de risco e a emissão de alertas antecipados?', opcoes: ['Sistemas de Imagens de Satélite (INPE, MapBiomas, entre outros)', 'Equipes em Campo', 'Informes de Órgãos do Sistema (APAC, CEMADEN, entre outros)', 'Análise de Dados Meteorológicos', 'Parcerias com Universidades ou Instituições de Pesquisa', 'Não realiza Monitoramento', 'Outros'], exclusivas: ['Não realiza Monitoramento'], outros: 'Outros'},
      {id: '1.1', n: '1.1', sub: true, tipo: 'arquivos', texto: 'Anexe evidências do monitoramento assinalado. Exemplos de comprovação: Relatórios técnicos emitidos a partir de dados da APAC/CEMADEN, Termos de Cooperação Técnica com Universidades ou Relatórios de vistoria de Equipes em Campo datados.'},
      {id: '1.2', n: '1.2', sub: true, tipo: 'multi', texto: 'O município possui equipamentos próprios para avaliação de riscos?', opcoes: ['Réguas de Nível', 'Pluviômetros', 'Estações Meteorológicas', 'Câmeras de Monitoramento Ambiental', 'Não possui Equipamento de Monitoramento', 'Outros'], exclusivas: ['Não possui Equipamento de Monitoramento'], outros: 'Outros'},
      {id: '2', n: '2', tipo: 'radio', texto: 'O município decretou Situação de Emergência (SE) ou Estado de Calamidade Pública (ECP) devido a desastres nos anos de 2023, 2024 e 2025?', opcoes: SN},
      {id: '3', n: '3', tipo: 'radio', texto: 'Existem locais cadastrados para uso como abrigos temporários em caso de desastres?', opcoes: SN},
      {id: '4', n: '4', tipo: 'radio', texto: 'Existem canais de comunicação estabelecidos com as famílias que residem em áreas de risco?', opcoes: SN},
      {id: '5', n: '5', tipo: 'radio', texto: 'O município instituiu órgãos municipais de defesa civil conforme os procedimentos estabelecidos pelo SINPDEC? Em caso afirmativo e havendo múltiplos órgãos, por favor, informe o de mais alto nível.', opcoes: ['Secretaria', 'Diretoria', 'Gerência', 'Não há estrutura formalizada', 'Outros'], outros: 'Outros'},
      {id: '6', n: '6', tipo: 'radio', texto: 'O município realiza exercícios simulados conforme previsto no Plano de Contingência?', opcoes: SN},
      {id: '7', n: '7', tipo: 'radio', texto: 'O município possui uma estrutura formal de Defesa Civil Municipal?', opcoes: SN},
      {id: '8', n: '8', tipo: 'multi', texto: 'De onde provêm os recursos financeiros para as atividades relacionadas à Defesa Civil?', opcoes: ['Orçamento Próprio', 'Fundo de Reserva', 'Tesouro Municipal', 'Repasse de Outras Secretarias Municipais', 'Doações de Pessoas Físicas ou Jurídicas', 'Emendas Parlamentares', 'Programas do Estado', 'Não tem', 'Não sei'], exclusivas: ['Não tem', 'Não sei']},
      {id: '9', n: '9', tipo: 'radio', texto: 'O município tem conhecimento sobre o Cartão de Pagamento de Defesa Civil (CPDC) e já o utilizou em alguma ocasião?', opcoes: ['Sim, já usei', 'Sim, mas nunca usei', 'Sim, mas tive dificuldade em obtê-lo', 'Não sabia da existência do cartão']},
      {id: '10', n: '10', texto: 'Declaração', tipo: 'declaracao', opcoes: [DECL]}
    ],
    tce: {data: '16/10/2026 23:04', respostas: {'1': ['Informes de Órgãos do Sistema (APAC, CEMADEN, entre outros)'], '1.1': {arquivos: [], nota: 'Enviado ao TCE: WhatsApp Image 2026-10-16 at 20.07.26.jpeg'}, '1.2': ['Não possui Equipamento de Monitoramento'], '2': 'Sim', '3': 'Não', '4': 'Não', '5': 'Não há estrutura formalizada', '6': 'Não', '7': 'Não', '8': ['Não tem'], '9': 'Sim, mas nunca usei', '10': true}}
  }
];

// ── Regras puras (testáveis) ──
export function isAnswered(pergunta, valor) {
  if (pergunta.tipo === 'declaracao') return valor === true;
  if (pergunta.tipo === 'multi') return Array.isArray(valor) && valor.length > 0;
  if (pergunta.tipo === 'arquivos') return Boolean(valor && ((valor.arquivos || []).length || String(valor.nota || '').trim()));
  return typeof valor === 'string' && valor !== '';
}
export function progress(questionario, respostas = {}) {
  const total = questionario.perguntas.length;
  const respondidas = questionario.perguntas.filter(p => isAnswered(p, respostas[p.id])).length;
  return {total, respondidas, pendentes: total - respondidas, pct: total ? Math.round(respondidas / total * 100) : 0};
}
/** Marca/desmarca uma opção de múltipla escolha respeitando as opções exclusivas ("Não tem", "Não sei"…). */
export function toggleMulti(pergunta, atual = [], opcao, marcado) {
  let lista = Array.isArray(atual) ? [...atual] : [];
  const exclusivas = pergunta.exclusivas || [];
  if (marcado) {
    lista = exclusivas.includes(opcao) ? [opcao] : lista.filter(item => !exclusivas.includes(item));
    if (!lista.includes(opcao)) lista.push(opcao);
  } else lista = lista.filter(item => item !== opcao);
  return pergunta.opcoes.filter(item => lista.includes(item));
}
export function changedCount(antes = {}, depois = {}) {
  const keys = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
  return [...keys].filter(key => JSON.stringify(antes?.[key] ?? null) !== JSON.stringify(depois?.[key] ?? null)).length;
}
/** Resumo Sim/Não do diagnóstico: o que o município já tem e o que falta implantar. */
export function diagnosticoResumo(respostas = {}) {
  const q = QUESTIONARIOS[0];
  const yesno = q.perguntas.filter(p => p.tipo === 'radio');
  return {sim: yesno.filter(p => respostas[p.id] === 'Sim').length, nao: yesno.filter(p => respostas[p.id] === 'Não').length, total: yesno.length};
}

// ── Estado e interface ──
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const W = () => window;
const rowId = q => `icm-${ANO}-${q.id}`;
const draftKey = q => `dcq-rascunho:${W().S?.user?.uid || 'anon'}:${rowId(q)}`;
const fmt = iso => { try { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`; } catch { return ''; } };
const state = {active: 'diagnostico', rows: {}, answers: {}, saved: {}, dirty: new Set(), loading: false, saving: false, tableMissing: false};

function userName() { const u = W().S?.user || {}; const profile = (W().S?.users || []).find(x => x.id === u.uid || x.uid === u.uid); return profile?.displayName || profile?.display_name || u.displayName || u.email?.split('@')[0] || 'Usuário'; }
function canEdit() {
  if (W().S?.isAdmin) return true;
  const sec = (W().S?.secretarias || []).find(s => /DEFESA CIVIL/i.test(String(s.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')));
  return sec ? W().userCanDemandSecretaria?.(sec.id, 'editar') !== false : true;
}
function questionario(id = state.active) { return QUESTIONARIOS.find(q => q.id === id); }

async function load() {
  state.loading = true;
  try {
    const {data, error} = await supabase.from(TABLE).select('*').in('id', QUESTIONARIOS.map(rowId));
    if (error) throw error;
    state.tableMissing = false;
    for (const q of QUESTIONARIOS) {
      const row = (data || []).find(r => r.id === rowId(q)) || null;
      state.rows[q.id] = row; state.saved[q.id] = row?.respostas || {};
      if (!state.dirty.has(q.id)) state.answers[q.id] = structuredClone(row?.respostas || {});
    }
  } catch (error) {
    state.tableMissing = /does not exist|relation|schema cache|not find the table/i.test(error?.message || '') || error?.code === '42P01' || error?.code === 'PGRST205';
    if (!state.tableMissing) W().toast?.('Não foi possível carregar os questionários: ' + (error.message || error), 'error', 8000);
    for (const q of QUESTIONARIOS) if (!state.answers[q.id]) state.answers[q.id] = {};
  }
  // Rascunho do aparelho mais novo que o salvo: recupera sem perder nada.
  for (const q of QUESTIONARIOS) {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey(q)) || 'null');
      const savedAt = Date.parse(state.rows[q.id]?.updated_at || 0) || 0;
      if (draft && Date.parse(draft.em) > savedAt && changedCount(state.saved[q.id], draft.respostas)) { state.answers[q.id] = draft.respostas; state.dirty.add(q.id); }
    } catch (_) {}
  }
  state.loading = false;
}

function optionHtml(q, p, opcao, valor) {
  const name = `dcq-${q.id}-${p.id}`;
  if (p.tipo === 'radio') return `<label class="dcq-opt"><input type="radio" name="${esc(name)}" value="${esc(opcao)}" ${valor === opcao ? 'checked' : ''} ${canEdit() ? '' : 'disabled'} onchange="dcqSet('${q.id}','${p.id}',this.value)"><span>${esc(opcao)}</span></label>`;
  const checked = Array.isArray(valor) && valor.includes(opcao);
  return `<label class="dcq-opt is-check"><input type="checkbox" value="${esc(opcao)}" ${checked ? 'checked' : ''} ${canEdit() ? '' : 'disabled'} onchange="dcqToggle('${q.id}','${p.id}',this.value,this.checked)"><span>${esc(opcao)}</span></label>`;
}
function questionHtml(q, p, index, list) {
  const respostas = state.answers[q.id] || {}, valor = respostas[p.id], answered = isAnswered(p, valor);
  const dimHeader = p.dimensao && list[index - 1]?.dimensao !== p.dimensao ? `<h2 class="dcq-dim-title">${esc(p.dimensao)}</h2>` : '';
  let body = '';
  if (p.tipo === 'declaracao') body = `<label class="dcq-opt is-check dcq-decl"><input type="checkbox" ${valor === true ? 'checked' : ''} ${canEdit() ? '' : 'disabled'} onchange="dcqSet('${q.id}','${p.id}',this.checked)"><span>${esc(DECL)}</span></label>`;
  else if (p.tipo === 'arquivos') {
    const files = valor?.arquivos || [];
    body = `<div class="dcq-files">${files.map((file, i) => `<a href="${esc(file.url)}" target="_blank" rel="noopener" class="dcq-file">${/^data:image|\.(png|jpe?g|webp|gif)(\?|$)/i.test(file.url) ? `<img src="${esc(file.url)}" alt="">` : '📄'}<span>${esc(file.nome || 'Evidência ' + (i + 1))}</span>${canEdit() ? `<button type="button" onclick="event.preventDefault();dcqRemoveFile('${q.id}','${p.id}',${i})" aria-label="Remover">×</button>` : ''}</a>`).join('')}</div>
      ${canEdit() ? `<label class="dcq-upload">📎 Anexar fotos das evidências<input type="file" accept="image/*" multiple onchange="dcqUpload('${q.id}','${p.id}',this)"></label>` : ''}
      <label class="dcq-note"><span>Descrição / arquivos enviados</span><textarea rows="2" ${canEdit() ? '' : 'disabled'} placeholder="Ex.: Relatório APAC de 10/2026; termo de cooperação com a UFPE…" oninput="dcqNote('${q.id}','${p.id}',this.value)">${esc(valor?.nota || '')}</textarea></label>`;
  } else {
    body = `<div class="dcq-opts ${p.opcoes.length > 3 ? 'is-long' : ''}">${p.opcoes.map(o => optionHtml(q, p, o, valor)).join('')}</div>`;
    const outros = p.outros && (p.tipo === 'multi' ? Array.isArray(valor) && valor.includes(p.outros) : valor === p.outros);
    if (outros) body += `<label class="dcq-note"><span>Especifique “Outros”</span><input type="text" value="${esc(respostas[p.id + ':outros'] || '')}" ${canEdit() ? '' : 'disabled'} oninput="dcqSet('${q.id}','${p.id}:outros',this.value,true)" placeholder="Descreva"></label>`;
  }
  const hint = p.tipo === 'multi' ? '<small class="dcq-hint">Marque todas as opções que se aplicam.</small>' : '';
  return `${dimHeader}<article class="dcq-q ${p.sub ? 'is-sub' : ''} ${answered ? 'is-answered' : 'is-pending'}" id="dcq-${q.id}-${p.id.replace('.', '-')}"><header><b>${esc(p.n)}</b><h3>${p.dimensao ? `<span>${esc(p.dimensao)} — </span>` : ''}${esc(p.texto)}</h3><i aria-label="${answered ? 'Respondida' : 'Sem resposta'}">${answered ? '✓' : ''}</i></header>${hint}${body}</article>`;
}
function signatureHtml(q) {
  const row = state.rows[q.id];
  if (!row?.preenchido_em) return `<div class="dcq-sign is-empty">Ainda não salvo no sistema</div>`;
  return `<div class="dcq-sign"><span>✔</span><div><strong>Preenchido por ${esc(row.preenchido_por_nome || 'usuário')}</strong><small>em ${esc(fmt(row.preenchido_em))}</small></div></div>`;
}
function historyHtml(q) {
  const list = (state.rows[q.id]?.historico || []).slice().reverse();
  if (!list.length) return '';
  return `<details class="dcq-history"><summary>Histórico de preenchimento (${list.length})</summary><ol>${list.map(h => `<li><b>${esc(h.nome)}</b> · ${esc(fmt(h.em))}${h.alteradas != null ? ` · ${h.alteradas} resposta${h.alteradas === 1 ? '' : 's'} alterada${h.alteradas === 1 ? '' : 's'}` : ''}</li>`).join('')}</ol></details>`;
}
function tabsHtml() {
  return `<div class="dcq-tabs" role="tablist">${QUESTIONARIOS.map(q => {
    const pr = progress(q, state.answers[q.id]); const row = state.rows[q.id];
    return `<button type="button" role="tab" aria-selected="${state.active === q.id}" class="dcq-tab ${state.active === q.id ? 'active' : ''}" onclick="dcqTab('${q.id}')"><span class="dcq-tab-icon">${q.icone}</span><span class="dcq-tab-copy"><strong>${esc(q.curto)}</strong><small>${row?.preenchido_em ? `✔ ${esc(row.preenchido_por_nome)} · ${esc(fmt(row.preenchido_em))}` : 'Ainda não salvo'}${state.dirty.has(q.id) ? ' · <em>alterações não salvas</em>' : ''}</small></span><span class="dcq-ring" style="--p:${pr.pct}"><b>${pr.respondidas}/${pr.total}</b></span></button>`;
  }).join('')}</div>`;
}
function summaryHtml(q) {
  if (q.id !== 'diagnostico') return '';
  const r = diagnosticoResumo(state.answers[q.id]);
  if (!r.sim && !r.nao) return '';
  return `<div class="dcq-summary"><span class="is-yes"><b>${r.sim}</b> já existe${r.sim === 1 ? '' : 'm'} no município</span><span class="is-no"><b>${r.nao}</b> a implantar</span><small>Cada “Não” é uma oportunidade de melhoria no próximo levantamento.</small></div>`;
}
function saveBar(position) {
  const q = questionario(), pr = progress(q, state.answers[q.id]), dirty = state.dirty.size;
  return `<div class="dcq-savebar is-${position}"${position === 'float' ? ' aria-hidden="true"' : ''}><div class="dcq-savebar-progress"><span><b>${pr.respondidas} de ${pr.total}</b> respondidas</span><i><em style="width:${pr.pct}%"></em></i></div>${pr.pendentes ? `<button type="button" class="dcq-next" onclick="dcqNextPending()">Próxima sem resposta ↓</button>` : '<span class="dcq-done">✓ Tudo respondido</span>'}<span class="dcq-state ${dirty ? 'is-dirty' : ''}">${dirty ? '● Alterações não salvas' : '✓ Tudo salvo'}</span>${canEdit() ? `<button type="button" class="dcq-save" onclick="dcqSave()" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Salvando…' : '💾 Salvar questionário'}</button>` : ''}</div>`;
}
function render() {
  const q = questionario();
  const content = document.getElementById('content'); if (!content) return;
  const missing = state.tableMissing ? `<div class="dcq-warning"><strong>Falta ativar o armazenamento dos questionários.</strong> As respostas ficam guardadas neste aparelho até a tabela ser criada no Supabase (veja a mensagem enviada ao administrador).</div>` : '';
  const tce = q.tce ? `<button type="button" class="dcq-import" onclick="dcqImportTce('${q.id}')" ${canEdit() ? '' : 'disabled'}>⤓ Carregar as respostas enviadas ao TCE em ${esc(q.tce.data)}</button>` : '';
  content.innerHTML = `<section class="dcq-page">
    <header class="dcq-hero"><button type="button" class="dcq-back" onclick="dcqBack()">← Defesa Civil</button><div><span class="workspace-kicker">PROTEÇÃO E DEFESA CIVIL · TCE-PE</span><h1>Levantamento de Proteção e Defesa Civil (ICM) – ${ANO}</h1><p>Unidade fiscalizada: Prefeitura Municipal de Sertânia</p></div><button type="button" class="dcq-print" onclick="window.print()">🖨 Imprimir / PDF</button></header>
    ${missing}${tabsHtml()}
    ${saveBar('top')}
    <article class="dcq-form">
      <header class="dcq-form-head"><div><small>DIMENSÃO: PROTEÇÃO E DEFESA CIVIL</small><h2>${esc(q.titulo)}</h2><p>${esc(q.descricao)}</p></div>${signatureHtml(q)}</header>
      <div class="dcq-tools">${tce}${historyHtml(q)}</div>
      ${summaryHtml(q)}
      <div class="dcq-questions">${q.perguntas.map((p, i, list) => questionHtml(q, p, i, list)).join('')}</div>
      <footer class="dcq-form-foot">${signatureHtml(q)}</footer>
    </article>
    ${saveBar('bottom')}
    ${saveBar('float')}
  </section>`;
  watchFloatingBar();
}
// A barra de salvar acompanha a tela: quando a barra do topo sai de vista, aparece fixa no alto.
let floatObserver = null;
function watchFloatingBar() {
  floatObserver?.disconnect();
  const top = document.querySelector('.dcq-savebar.is-top'), bottom = document.querySelector('.dcq-savebar.is-bottom');
  if (!top || typeof IntersectionObserver === 'undefined') return;
  const seen = new Map();
  floatObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => seen.set(entry.target, entry.isIntersecting));
    const show = !seen.get(top) && !seen.get(bottom);
    document.querySelector('.dcq-page')?.classList.toggle('has-floating-bar', show);
  }, {threshold: 0});
  floatObserver.observe(top); if (bottom) floatObserver.observe(bottom);
}
function refreshChrome() {
  // Atualiza progresso, abas e barras sem redesenhar as perguntas (mantém o foco do usuário).
  const page = document.querySelector('.dcq-page'); if (!page) return;
  const q = questionario();
  page.querySelector('.dcq-tabs')?.replaceWith(Object.assign(document.createElement('div'), {innerHTML: tabsHtml()}).firstElementChild);
  page.querySelectorAll('.dcq-savebar').forEach(bar => bar.replaceWith(Object.assign(document.createElement('div'), {innerHTML: saveBar(bar.classList.contains('is-top') ? 'top' : bar.classList.contains('is-float') ? 'float' : 'bottom')}).firstElementChild));
  const summary = page.querySelector('.dcq-summary'), next = summaryHtml(q);
  if (summary) { if (next) summary.outerHTML = next; else summary.remove(); } else if (next) page.querySelector('.dcq-questions')?.insertAdjacentHTML('beforebegin', next);
  for (const p of q.perguntas) {
    const el = document.getElementById(`dcq-${q.id}-${p.id.replace('.', '-')}`); if (!el) continue;
    const ok = isAnswered(p, state.answers[q.id]?.[p.id]);
    el.classList.toggle('is-answered', ok); el.classList.toggle('is-pending', !ok);
    const mark = el.querySelector('header>i'); if (mark) mark.textContent = ok ? '✓' : '';
  }
}
function changed(qid, rerender = false) {
  state.dirty.add(qid);
  try { localStorage.setItem(draftKey(questionario(qid)), JSON.stringify({em: new Date().toISOString(), respostas: state.answers[qid]})); } catch (_) {}
  if (rerender) { const y = scrollY; render(); scrollTo(0, y); } else refreshChrome();
}

async function save() {
  if (state.saving || !canEdit()) return;
  const ids = [...state.dirty];
  if (!ids.length) { W().toast?.('Nada novo para salvar. Tudo já está salvo.', 'info'); return; }
  const user = W().S?.user; if (!user?.uid) { W().toast?.('Entre novamente para salvar.', 'error'); return; }
  state.saving = true; refreshChrome();
  const now = new Date().toISOString(), nome = userName();
  try {
    for (const qid of ids) {
      const q = questionario(qid);
      const {data: atual, error: readError} = await supabase.from(TABLE).select('*').eq('id', rowId(q)).maybeSingle();
      if (readError) throw readError;
      if (atual && state.rows[qid] && atual.updated_at !== state.rows[qid].updated_at &&
        !confirm(`${atual.preenchido_por_nome || 'Outro usuário'} salvou este questionário em ${fmt(atual.preenchido_em)}, depois que você abriu a tela.\n\nDeseja manter as SUAS respostas por cima?`)) { await load(); state.dirty.delete(qid); continue; }
      const alteradas = changedCount(atual?.respostas || {}, state.answers[qid]);
      const historico = [...(atual?.historico || []), {nome, por: user.uid, em: now, alteradas}].slice(-50);
      const row = {id: rowId(q), questionario: q.titulo, ano: ANO, respostas: state.answers[qid], preenchido_por: user.uid, preenchido_por_nome: nome, preenchido_em: now, historico, updated_at: now, ...(atual ? {} : {created_at: now})};
      const {error} = await supabase.from(TABLE).upsert(row);
      if (error) throw error;
      state.rows[qid] = row; state.saved[qid] = structuredClone(state.answers[qid]); state.dirty.delete(qid);
      try { localStorage.removeItem(draftKey(q)); } catch (_) {}
    }
    W().toast?.(`✓ Questionário salvo por ${nome} em ${fmt(now)}.`, 'success', 6000);
  } catch (error) {
    const missing = /does not exist|schema cache|not find the table/i.test(error?.message || '') || error?.code === '42P01' || error?.code === 'PGRST205';
    if (missing) state.tableMissing = true;
    W().toast?.(missing ? 'As respostas ficaram guardadas neste aparelho. Falta ativar a tabela dos questionários no Supabase.' : 'Não foi possível salvar: ' + (error.message || error) + '. Suas respostas continuam guardadas neste aparelho.', 'error', 10000);
  } finally { state.saving = false; const y = scrollY; render(); scrollTo(0, y); }
}

export async function openDefesaQuestionarios() {
  W().__currentView = 'defesa-questionarios';
  W().rememberWorkspace?.({kind: 'page', id: 'defesa-questionarios'});
  document.getElementById('content').innerHTML = '<div class="dcq-loading">Carregando questionários…</div>';
  await load(); render();
}

if (typeof window !== 'undefined') {
  window.openDefesaQuestionarios = openDefesaQuestionarios;
  window.workspacePages = {...(window.workspacePages || {}), 'defesa-questionarios': openDefesaQuestionarios};
  window.dcqTab = id => { state.active = id; render(); scrollTo({top: 0}); };
  window.dcqSet = (qid, pid, value, isText = false) => {
    const p = questionario(qid).perguntas.find(x => x.id === pid);
    const before = state.answers[qid]?.[pid];
    (state.answers[qid] ||= {})[pid] = value;
    changed(qid, !isText && Boolean(p?.outros) && (value === p.outros || before === p.outros));
  };
  window.dcqToggle = (qid, pid, opcao, marcado) => {
    const p = questionario(qid).perguntas.find(x => x.id === pid);
    const before = state.answers[qid]?.[pid];
    (state.answers[qid] ||= {})[pid] = toggleMulti(p, before, opcao, marcado);
    const exclusive = (p.exclusivas || []).includes(opcao) || (Array.isArray(before) && before.some(item => (p.exclusivas || []).includes(item)));
    changed(qid, exclusive || opcao === p.outros);
  };
  window.dcqNote = (qid, pid, nota) => { const v = (state.answers[qid] ||= {})[pid] ||= {arquivos: [], nota: ''}; v.nota = nota; changed(qid); };
  window.dcqRemoveFile = (qid, pid, index) => { const v = state.answers[qid]?.[pid]; if (!v) return; v.arquivos.splice(index, 1); changed(qid, true); };
  window.dcqUpload = async (qid, pid, input) => {
    const files = [...(input.files || [])].filter(f => /^image\//.test(f.type)); input.value = '';
    if (!files.length) { W().toast?.('Escolha fotos (imagens) das evidências.', 'error'); return; }
    const v = (state.answers[qid] ||= {})[pid] ||= {arquivos: [], nota: ''};
    W().toast?.(`Enviando ${files.length} foto(s)…`, 'info', 3000);
    try {
      const {optimizePhoto} = await import('./geolocation.js?v=10');
      for (const file of files) {
        const raw = await W().readFileAsDataUrl(file);
        const url = await W().imgbbUp(await optimizePhoto(raw, {maxDimension: 1600, maxBytes: 600000}));
        v.arquivos.push({url, nome: file.name, enviado_por: userName(), em: new Date().toISOString()});
      }
      changed(qid, true); W().toast?.('Evidências anexadas. Lembre de salvar o questionário.', 'success', 5000);
    } catch (error) { W().toast?.('Falha ao enviar a foto: ' + (error.message || error), 'error', 8000); }
  };
  window.dcqImportTce = qid => {
    const q = questionario(qid);
    if (Object.keys(state.answers[qid] || {}).length && !confirm(`Substituir as respostas atuais pelas que foram enviadas ao TCE em ${q.tce.data}?\n\nNada é salvo até você tocar em “Salvar questionário”.`)) return;
    state.answers[qid] = structuredClone(q.tce.respostas); changed(qid, true);
    W().toast?.('Respostas do TCE carregadas. Revise e toque em “Salvar questionário”.', 'info', 7000);
  };
  window.dcqNextPending = () => {
    const q = questionario(); const p = q.perguntas.find(x => !isAnswered(x, state.answers[q.id]?.[x.id]));
    const el = p && document.getElementById(`dcq-${q.id}-${p.id.replace('.', '-')}`);
    if (el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1600); }
  };
  window.dcqSave = save;
  window.dcqBack = () => { const sec = (W().S?.secretarias || []).find(s => /DEFESA CIVIL/i.test(String(s.name || '').normalize('NFD').replace(/[̀-ͯ]/g, ''))); if (sec) W().openSecretaryWorkspace?.(sec.id); else W().setView?.('mod'); };
  window.addEventListener('beforeunload', event => { if (state.dirty.size && document.querySelector('.dcq-page')) { event.preventDefault(); event.returnValue = ''; } });
}
