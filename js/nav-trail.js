// Navegação coerente em TODAS as telas: botão "← Voltar" para a tela pai e o caminho
// (breadcrumbs) até a Visão geral, sempre fixos no topo enquanto o usuário rola.
//
// O caminho é derivado da rota atual (#view/…, #module/…, #activity/…, #page/…, #secretaria/…),
// então qualquer tela nova ganha a barra automaticamente. Telas que não mudam a rota
// (ex.: mapa de um grupo) avisam com window.setNavLeaf({selector, icon, label, back}).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const arg = v => JSON.stringify(String(v ?? ''));
const S = () => window.S || {};
const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const HOME = {icon: '🏠', label: 'Visão geral', go: "setView('mod')"};
const VIEW_LABELS = {
  map: ['🗺', 'Mapa geral de demandas'], adm: ['⚙️', 'Usuários e acessos'], secr: ['🏛️', 'Cadastro de secretarias'],
  resp: ['👤', 'Responsáveis'], cont: ['📇', 'Contatos'], trash: ['🗑', 'Lixeira'], 'supabase-status': ['📡', 'Status do Supabase'],
};
const PAGE_LABELS = {
  'whatsapp-avisos': {icon: '💬', label: 'Avisos por WhatsApp'},
  agua: {icon: '💧', label: 'Locais de Captação de Água', secretary: 'AGRICULTURA'},
  'defesa-questionarios': {icon: '📋', label: 'AUDITORIA', secretary: 'DEFESA CIVIL'},
};

let leaf = null;
export function setNavLeaf(value) { leaf = value && value.label ? value : null; schedule(); }
window.setNavLeaf = setNavLeaf;

const secretaryById = id => (S().secretarias || []).find(s => String(s.id) === String(id)) || null;
const moduleById = id => (window.MODULOS || []).find(m => m.id === id) || null;

/** Crumb da secretaria: quando ela tem mais de uma área, o pai é a tela de escolha. */
function secretaryCrumbs(secretary) {
  if (!secretary) return [];
  const many = (window.secretaryDestinationCount?.(secretary.id) || 0) > 1;
  return [{icon: '🏛️', label: secretary.name, go: many ? `openSecretaryWorkspace(${arg(secretary.id)})` : `openDemandSecretaria(${arg(secretary.id)})`, many}];
}
function demandCrumbs(secId) {
  const demand = moduleById('atendimentos');
  if (!secId) return [{icon: demand?.icon || '🏛️', label: demand?.label || 'Demandas por Secretarias', go: "openDemandSecretaria('')"}];
  if (secId === 'sem-secretaria') return [{icon: '🏛️', label: 'Demandas por Secretarias', go: "openDemandSecretaria('')"}, {icon: '📂', label: 'Sem secretaria', go: "openDemandSecretaria('sem-secretaria')"}];
  const secretary = secretaryById(secId);
  if (!secretary) return demandCrumbs('');
  const base = secretaryCrumbs(secretary);
  if (base[0]?.many) base.push({icon: '▤', label: 'Controle de Demandas', go: `openDemandSecretaria(${arg(secretary.id)})`});
  return base;
}
function moduleCrumbs(moduleId, secretariaId) {
  if (moduleId === 'atendimentos') return demandCrumbs(secretariaId);
  const mod = moduleById(moduleId);
  const owner = window.secretaryOfModule?.(moduleId);
  const head = owner && (window.secretaryDestinationCount?.(owner.id) || 0) > 1 ? secretaryCrumbs(owner) : [];
  return [...head, {icon: mod?.icon || '▦', label: mod?.label || moduleId, go: `renderModulo(${arg(moduleId)})`}];
}

/** Caminho completo (sem a Visão geral) para a rota informada. */
export function trailFor(route) {
  if (!route) return [];
  if (route.kind === 'view') {
    if (route.id === 'mod') return [];
    const [icon, label] = VIEW_LABELS[route.id] || ['•', route.id];
    return [{icon, label, go: `setView(${arg(route.id)})`}];
  }
  if (route.kind === 'module') return moduleCrumbs(route.id, route.secretaria || '');
  if (route.kind === 'secretaria') { const sec = secretaryById(route.id); return sec ? [{icon: '🏛️', label: sec.name, go: `openSecretaryWorkspace(${arg(sec.id)})`}] : []; }
  if (route.kind === 'page') {
    const page = PAGE_LABELS[route.id] || {icon: '•', label: route.id};
    const owner = page.secretary ? window.secretaryByName?.(page.secretary) : null;
    return [...(owner ? secretaryCrumbs(owner) : []), {icon: page.icon, label: page.label, go: `workspacePages[${arg(route.id)}]()`}];
  }
  if (route.kind === 'activity') {
    const group = (S().secs || []).find(g => String(g.id) === String(route.id));
    if (!group) return [];
    const mod = window.modForSec?.(group) || 'atividades';
    const head = mod === 'atendimentos' ? demandCrumbs(group.demanda_secretaria_id || 'sem-secretaria') : moduleCrumbs(mod);
    return [...head, {icon: group.icon || '📁', label: group.name || 'Grupo', go: `openActivity(${arg(group.id)})`}];
  }
  return [];
}

function currentRoute() {
  try { return window.workspaceFromHash?.() || {kind: 'view', id: 'mod'}; } catch { return {kind: 'view', id: 'mod'}; }
}

// Botões antigos de "voltar" de cada tela: a barra fixa faz o mesmo papel, então somem
// para não ter dois caminhos diferentes. Botões de outra função (← Meses, ← Anterior) ficam.
const LEGACY_BACK = /^←\s*(Voltar( ao início)?|Visão geral|Atendimentos|Demandas|Defesa Civil)$/i;
function hideLegacyBacks(root) {
  root.querySelectorAll('button').forEach(button => {
    if (button.closest('.nav-trail,#modal-ov,.modal-ov')) return;
    const text = button.textContent.replace(/\s+/g, ' ').trim();
    if (!LEGACY_BACK.test(text)) return;
    const action = button.getAttribute('onclick') || '';
    if (/openActivity\(/.test(action) && !/renderModulo/.test(action) && !leaf) return; // sub-tela de um grupo: mantém
    button.classList.add('nav-legacy-back');
  });
}

function render() {
  pending = false;
  const content = document.getElementById('content');
  if (!content || !S().user || content.querySelector(':scope > .startup-shell')) return;
  if (leaf && !content.querySelector(leaf.selector)) leaf = null;
  const crumbs = [HOME, ...trailFor(currentRoute())];
  if (leaf) crumbs.push({icon: leaf.icon || '•', label: leaf.label, go: ''});
  const current = crumbs[crumbs.length - 1];
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  const backGo = leaf?.back || parent?.go || '';
  const key = crumbs.map(c => c.label + '|' + c.go).join('>') + '#' + backGo;
  let bar = content.querySelector(':scope > .nav-trail');
  if (!bar || bar.dataset.key !== key || content.firstElementChild !== bar) {
    bar?.remove();
    bar = document.createElement('nav');
    bar.className = 'nav-trail';
    bar.setAttribute('aria-label', 'Você está em');
    bar.dataset.key = key;
    bar.innerHTML = `${parent ? `<button type="button" class="nav-trail-back" onclick="${esc(backGo)}" title="Voltar para ${esc(leaf ? crumbs[crumbs.length - 2].label : parent.label)}"><span aria-hidden="true">←</span><b>Voltar</b></button>` : ''}<ol>${crumbs.map((c, i) => {
      const last = i === crumbs.length - 1;
      const body = `<i aria-hidden="true">${c.icon}</i><span>${esc(c.label)}</span>`;
      return `<li${last ? ' aria-current="page"' : ''}${i === 0 ? ' class="is-home"' : ''}>${last || !c.go ? `<span class="nav-trail-here">${body}</span>` : `<button type="button" onclick="${esc(c.go)}" title="Ir para ${esc(c.label)}">${body}</button>`}</li>`;
    }).join('')}</ol>`;
    content.prepend(bar);
    // No celular, o item atual fica visível (rola o caminho até o fim).
  }
  document.body.classList.add('has-nav-trail');
  hideLegacyBacks(content);
  measure(bar);
  if (current) document.body.dataset.navHere = current.label;
}

// Altura da barra e onde ela gruda (abaixo do cabeçalho no celular, topo do painel no computador).
function measure(bar) {
  const main = document.querySelector('main');
  const scrollsInMain = main && /(auto|scroll)/.test(getComputedStyle(main).overflowY);
  const nav = document.getElementById('navbar');
  const top = scrollsInMain ? 0 : Math.round(nav && getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().height : 0);
  const root = document.documentElement.style;
  root.setProperty('--nav-trail-top', top + 'px');
  root.setProperty('--nav-trail-h', Math.round(bar?.getBoundingClientRect().height || 0) + 'px');
}

let pending = false;
function schedule() { if (pending) return; pending = true; queueMicrotask(render); }

function start() {
  const content = document.getElementById('content');
  if (!content) { setTimeout(start, 200); return; }
  new MutationObserver(schedule).observe(content, {childList: true});
  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('resize', () => measure(document.querySelector('.nav-trail')));
  schedule();
}
window.renderNavTrail = schedule;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
