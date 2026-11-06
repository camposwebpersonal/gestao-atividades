// Painel "Avisos por WhatsApp" (somente administradores).
// Destinatários por Secretaria/Grupo, ativação da CallMeBot, teste, prévia da mensagem e histórico.
import {supabase} from '../supabase_compat.js?v=11';

const BOT_PHONE = '34684728023'; // número do bot na página oficial da CallMeBot (pode mudar)
const BOT_PAGE = 'https://www.callmebot.com/blog/free-api-whatsapp-messages/';
const COLS = 'id,nome,telefone,escopo,escopo_id,eventos,ativo,apikey_ok,created_at,updated_at';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const toast = (m, t = 'info', ms) => window.toast?.(m, t, ms);
const state = {recipients: [], log: [], preview: '', loading: true, error: ''};

export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}
export function formatPhone(d) {
  const m = String(d).match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : '+' + d;
}
// Formatação do WhatsApp (*negrito*, _itálico_) e links clicáveis, para a prévia.
export function whatsappHtml(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<b>$2</b>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/\n/g, '<br>');
}

function scopeLabel(r) {
  if (r.escopo === 'secretaria') return '🏛️ ' + (window.S?.secretarias?.find(s => s.id === r.escopo_id)?.name || 'Secretaria');
  if (r.escopo === 'grupo') return '📁 ' + (window.S?.secs?.find(g => g.id === r.escopo_id)?.name || 'Grupo');
  return '🌐 Todos os lançamentos';
}
function statusChip(r) {
  if (!r.ativo) return '<span class="wa-chip is-paused">⏸ Pausado</span>';
  return r.apikey_ok ? '<span class="wa-chip is-ok">✔ Recebendo avisos</span>' : '<span class="wa-chip is-wait">⏳ Falta a chave de ativação</span>';
}
const LOG_STATUS = {enviado: ['is-ok', '✔ Enviado'], erro: ['is-err', '✖ Erro'], 'aguardando-chave': ['is-wait', '⏳ Sem chave']};
const fmtWhen = v => { const d = new Date(v); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); };

async function load() {
  state.loading = true; state.error = '';
  const [r, l] = await Promise.all([
    supabase.from('whatsapp_recipients').select(COLS).order('created_at'),
    supabase.from('whatsapp_log').select('id,created_at,nome,telefone,titulo,mensagem,status,detalhe').order('id', {ascending: false}).limit(30),
  ]);
  if (r.error || l.error) state.error = (r.error || l.error).message;
  state.recipients = r.data || []; state.log = l.data || []; state.loading = false;
}

async function loadPreview() {
  const {data, error} = await supabase.functions.invoke('whatsapp-notify', {body: {action: 'preview'}});
  state.preview = error ? 'Não foi possível montar a prévia agora.' : (data?.text || '');
  const box = document.getElementById('wa-preview-text'); if (box) box.innerHTML = whatsappHtml(state.preview);
}

function render() {
  const host = document.getElementById('content'); if (!host) return;
  const S = window.S || {};
  const ready = state.recipients.filter(r => r.ativo && r.apikey_ok).length;
  const last = state.log.find(x => x.status === 'enviado');
  host.innerHTML = `<section class="wa-page">
    <header class="wa-hero"><div><span class="workspace-kicker">COMUNICAÇÃO AUTOMÁTICA</span><h1>🔔 Avisos por WhatsApp</h1>
      <p>Cada lançamento novo ou atualizado gera uma mensagem com os dados, quem lançou, data e hora, a localização (Google Maps e mapa do sistema) e o link que abre o lançamento já em destaque.</p>
      <div class="wa-stats"><span><b>${state.recipients.length}</b> destinatário(s)</span><span><b>${ready}</b> recebendo</span><span>${last ? 'Último envio: <b>' + fmtWhen(last.created_at) + '</b>' : 'Nenhum envio ainda'}</span></div></div>
      <button type="button" class="wa-btn ghost" onclick="openActivityOrHome()">← Voltar</button></header>
    ${state.error ? `<p class="wa-alert">Não foi possível carregar: ${esc(state.error)}</p>` : ''}
    <div class="wa-grid">
      <section class="wa-card"><h2>Destinatários</h2>
        <div class="wa-list">${state.recipients.length ? state.recipients.map(r => `<article class="wa-rec ${r.ativo ? '' : 'is-off'}">
          <div class="wa-rec-main"><strong>${esc(r.nome)}</strong><span class="wa-phone">${esc(formatPhone(r.telefone))}</span>
            <span class="wa-scope">${esc(scopeLabel(r))} · ${r.eventos === 'novos' ? 'só lançamentos novos' : 'novos e atualizações'}</span>${statusChip(r)}</div>
          <div class="wa-rec-actions">
            <button type="button" class="wa-btn ${r.apikey_ok ? 'ghost' : 'primary'}" onclick="waKey('${r.id}')">🔑 ${r.apikey_ok ? 'Trocar chave' : 'Informar chave'}</button>
            <button type="button" class="wa-btn ghost" onclick="waTest('${r.id}')" ${r.apikey_ok ? '' : 'disabled title="Informe a chave antes"'}>🧪 Enviar teste</button>
            <button type="button" class="wa-btn ghost" onclick="waToggle('${r.id}')">${r.ativo ? '⏸ Pausar' : '▶ Ativar'}</button>
            <button type="button" class="wa-btn ghost" onclick="waEdit('${r.id}')">✏️ Editar</button>
            <button type="button" class="wa-btn danger" onclick="waRemove('${r.id}')">🗑 Remover</button>
          </div></article>`).join('') : '<p class="wa-empty">Nenhum destinatário ainda.</p>'}</div>
        <button type="button" class="wa-btn primary wa-add" onclick="waEdit()">＋ Adicionar destinatário</button>
      </section>
      <section class="wa-card wa-how"><h2>Ativar um número (uma vez por número)</h2>
        <ol><li><b>Salve o número +34 684 728 023 nos contatos</b> (obrigatório). Depois, no celular que vai receber, toque em <b>Abrir conversa com o robô</b>. A mensagem de autorização já vai escrita: só envie.</li>
          <li>Em até 2 minutos o robô responde com <b>“Your APIKEY is …”</b>. Copie esse número.</li>
          <li>Confira o número na resposta do robô (“Activated for 55…”): muitos números de WhatsApp daqui aparecem <b>sem o 9</b> (ex.: 55 87 7400-5690). O destinatário precisa estar com o número <b>exatamente igual</b>; se for diferente, use ✏️ Editar.</li>
          <li>Aqui, toque em <b>🔑 Informar chave</b> do destinatário, cole e salve. Depois use <b>🧪 Enviar teste</b>.</li></ol>
        <a class="wa-btn whatsapp" href="https://wa.me/${BOT_PHONE}?text=${encodeURIComponent('I allow callmebot to send me messages')}" target="_blank" rel="noopener">💬 Abrir conversa com o robô</a>
        <p class="wa-note">Serviço gratuito CallMeBot, para uso pessoal. Se o robô não responder, confira o número atual na <a href="${BOT_PAGE}" target="_blank" rel="noopener">página oficial</a>. A chave fica guardada no servidor e nunca aparece de novo na tela.</p>
      </section>
    </div>
    <section class="wa-card"><h2>Prévia da mensagem <small>(com o último lançamento)</small></h2>
      <div class="wa-phone-frame"><div class="wa-bubble"><div id="wa-preview-text">${state.preview ? whatsappHtml(state.preview) : 'Montando a prévia…'}</div><span class="wa-time">agora ✓✓</span></div></div>
      <p class="wa-note">Vários lançamentos seguidos no mesmo grupo (ex.: planilha em lote) viram <b>uma única mensagem-resumo</b>, e edições que não mudam nada visível (ordem, fotos) não geram aviso.</p></section>
    <section class="wa-card"><h2>Histórico de envios <button type="button" class="wa-btn ghost small" onclick="waReload()">↻ Atualizar</button></h2>
      ${state.log.length ? `<ul class="wa-log">${state.log.map(x => { const [cls, label] = LOG_STATUS[x.status] || ['', x.status]; return `<li><details><summary><span class="wa-chip ${cls}">${label}</span><span class="wa-log-title">${esc(x.titulo || '')}</span><small>${esc(x.nome || '')} · ${fmtWhen(x.created_at)}</small></summary>${x.detalhe ? `<p class="wa-note">${esc(x.detalhe)}</p>` : ''}<div class="wa-bubble small">${whatsappHtml(x.mensagem || '')}</div></details></li>`; }).join('')}</ul>` : '<p class="wa-empty">Ainda não houve avisos.</p>'}
    </section></section>`;
}

async function open() {
  if (!window.S?.isAdmin) { toast('Somente administradores podem configurar os avisos.', 'error'); return; }
  window.rememberWorkspace?.({kind: 'page', id: 'whatsapp-avisos'});
  const host = document.getElementById('content'); if (host) host.innerHTML = '<div class="wa-page"><p class="wa-empty">Carregando…</p></div>';
  await load(); render(); loadPreview();
}

function modal(title, html, onSave) {
  window.openModal(title, '', `<form id="wa-form" class="wa-form" novalidate>${html}<p class="wa-form-msg" role="alert"></p><div class="wa-form-actions"><button type="button" class="wa-btn ghost" onclick="closeModal()">Cancelar</button><button type="submit" class="wa-btn primary">Salvar</button></div></form>`);
  const form = document.getElementById('wa-form'), msg = form.querySelector('.wa-form-msg');
  form.onsubmit = async e => {
    e.preventDefault(); msg.textContent = '';
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Salvando…';
    try { await onSave(form); window.closeModal(); await load(); render(); loadPreview(); }
    catch (err) { msg.textContent = err.message || String(err); btn.disabled = false; btn.textContent = 'Salvar'; }
  };
  form.querySelector('input')?.focus();
}

window.waEdit = id => {
  const r = state.recipients.find(x => x.id === id) || {nome: '', telefone: '', escopo: 'todos', escopo_id: '', eventos: 'todos', ativo: true};
  const S = window.S || {};
  const secs = [...(S.secretarias || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const groups = [...(S.secs || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  modal(id ? '✏️ Editar destinatário' : '＋ Novo destinatário', `
    <label>Nome<input name="nome" value="${esc(r.nome)}" required maxlength="80" placeholder="Ex.: Secretário de Infraestrutura"></label>
    <label>WhatsApp (com DDD)<input name="telefone" inputmode="tel" value="${r.telefone ? esc(formatPhone(r.telefone)) : ''}" required placeholder="(87) 97400-5690"></label>
    <label>Recebe avisos de<select name="escopo"><option value="todos" ${r.escopo === 'todos' ? 'selected' : ''}>Todos os lançamentos</option><option value="secretaria" ${r.escopo === 'secretaria' ? 'selected' : ''}>Uma secretaria</option><option value="grupo" ${r.escopo === 'grupo' ? 'selected' : ''}>Um grupo de lançamento</option></select></label>
    <label class="wa-only" data-for="secretaria">Secretaria<select name="secretaria">${secs.map(s => `<option value="${esc(s.id)}" ${r.escopo_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <label class="wa-only" data-for="grupo">Grupo<select name="grupo">${groups.map(g => `<option value="${esc(g.id)}" ${r.escopo_id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label>Quando avisar<select name="eventos"><option value="todos" ${r.eventos === 'todos' ? 'selected' : ''}>Lançamentos novos e atualizações</option><option value="novos" ${r.eventos === 'novos' ? 'selected' : ''}>Somente lançamentos novos</option></select></label>`, async form => {
    const nome = form.nome.value.trim(), telefone = normalizePhone(form.telefone.value), escopo = form.escopo.value;
    if (!nome) throw new Error('Informe o nome.');
    if (!telefone) throw new Error('WhatsApp inválido. Use DDD + número, ex.: (87) 97400-5690.');
    const row = {nome, telefone, escopo, escopo_id: escopo === 'todos' ? null : form[escopo].value, eventos: form.eventos.value};
    const {error} = id ? await supabase.from('whatsapp_recipients').update({...row, updated_at: new Date().toISOString()}).eq('id', id) : await supabase.from('whatsapp_recipients').insert({...row, ativo: true});
    if (error) throw new Error(error.message);
    toast(id ? 'Destinatário atualizado.' : 'Destinatário adicionado. Agora informe a chave de ativação.', 'success');
  });
  const form = document.getElementById('wa-form');
  const sync = () => form.querySelectorAll('.wa-only').forEach(el => { el.hidden = el.dataset.for !== form.escopo.value; });
  form.escopo.onchange = sync; sync();
};

window.waKey = id => {
  const r = state.recipients.find(x => x.id === id); if (!r) return;
  modal('🔑 Chave de ativação', `<p class="wa-note">Cole a chave que o robô CallMeBot enviou para <b>${esc(formatPhone(r.telefone))}</b> (“Your APIKEY is …”).</p>
    <label>Chave (APIKEY)<input name="apikey" inputmode="numeric" autocomplete="off" required placeholder="Ex.: 1234567"></label>`, async form => {
    const apikey = form.apikey.value.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(apikey)) throw new Error('Chave inválida. Copie só o número enviado pelo robô.');
    const {error} = await supabase.from('whatsapp_recipients').update({apikey, updated_at: new Date().toISOString()}).eq('id', id);
    if (error) throw new Error(error.message);
    toast('Chave salva. Toque em “Enviar teste” para conferir.', 'success', 6000);
  });
};

window.waTest = async id => {
  toast('Enviando teste…', 'info', 4000);
  const {data, error} = await supabase.functions.invoke('whatsapp-notify', {body: {action: 'test', recipient_id: id}});
  if (error || !data?.ok) {
    let detail = data?.detail;
    try { detail ||= (await error?.context?.json?.())?.detail; } catch { /* resposta sem corpo */ }
    toast('O teste não foi entregue: ' + (detail || error?.message || 'erro desconhecido'), 'error', 9000);
  } else toast('Teste enviado! Confira o WhatsApp.', 'success', 6000);
  await load(); render(); loadPreview();
};

window.waToggle = async id => {
  const r = state.recipients.find(x => x.id === id); if (!r) return;
  const {error} = await supabase.from('whatsapp_recipients').update({ativo: !r.ativo, updated_at: new Date().toISOString()}).eq('id', id);
  if (error) return toast(error.message, 'error');
  toast(r.ativo ? 'Avisos pausados para ' + r.nome + '.' : 'Avisos reativados para ' + r.nome + '.', 'success');
  await load(); render(); loadPreview();
};

window.waRemove = async id => {
  const r = state.recipients.find(x => x.id === id); if (!r) return;
  if (!confirm(`Remover ${r.nome} dos avisos por WhatsApp?`)) return;
  const {error} = await supabase.from('whatsapp_recipients').delete().eq('id', id);
  if (error) return toast(error.message, 'error');
  toast('Destinatário removido.', 'success'); await load(); render(); loadPreview();
};
window.waReload = async () => { await load(); render(); loadPreview(); };
window.openActivityOrHome = () => window.setView?.('mod');

window.workspacePages = window.workspacePages || {};
window.workspacePages['whatsapp-avisos'] = open;
window.openWhatsappAvisos = open;
