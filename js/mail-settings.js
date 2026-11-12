// Configuração do e-mail usado no "Esqueci minha senha" (somente administradores).
// Servidor, usuário e remetente ficam em mail_settings; a senha do e-mail vai direto para o
// Vault do Supabase (pms_set_smtp_password) e nunca volta para o navegador.
import {supabase} from '../supabase_compat.js?v=11';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const toast = (m, t = 'info', ms) => window.toast?.(m, t, ms);
const REASONS = {
  nao_configurado: 'O envio de e-mails ainda não foi configurado (Usuários e acessos → ✉️ E-mail para “Esqueci minha senha”).',
  sem_email: 'Este usuário não tem e-mail de contato cadastrado.',
  limite: 'Limite de 3 links por hora para este usuário. Aguarde um pouco.',
  smtp_login: 'O servidor de e-mail recusou o login. Confira o e-mail e a senha de app.',
  nao_encontrado: 'Usuário não encontrado.', proibido: 'Somente administradores.',
  email_invalido: 'Digite um e-mail válido para o teste.',
  falha: 'Não foi possível enviar agora.',
};
window.mailResetReason = reason => REASONS[reason] || REASONS.falha;

const invoke = async body => {
  const {data, error} = await supabase.functions.invoke('password-reset', {body});
  if (error) throw error;
  return data || {};
};
window.sendResetLinkForUser = userId => invoke({action: 'admin_send', user_id: userId});

const PRESETS = {
  gmail: {smtp_host: 'smtp.gmail.com', smtp_port: 465, help: 'Use uma <b>senha de app</b> do Google (Conta Google → Segurança → Verificação em duas etapas → Senhas de app). A senha normal do Gmail não funciona.'},
  outlook: {smtp_host: 'smtp.office365.com', smtp_port: 587, help: 'Outlook/Hotmail exige a autenticação SMTP habilitada na conta.'},
  brevo: {smtp_host: 'smtp-relay.brevo.com', smtp_port: 465, help: 'Brevo (gratuito até 300 e-mails/dia): use o login SMTP e a chave SMTP do painel da Brevo.'},
};

async function load() {
  const [{data: cfg, error}, {data: hasPass}] = await Promise.all([
    supabase.from('mail_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.rpc('pms_smtp_password_set'),
  ]);
  if (error) throw error;
  return {cfg: cfg || {}, hasPass: hasPass === true};
}

function badge(ready) {
  const el = document.getElementById('mail-settings-badge');
  if (el) { el.textContent = ready ? '● Ativo' : '● Não configurado'; el.className = ready ? 'mail-badge is-on' : 'mail-badge is-off'; }
}

window.renderMailSettings = async function () {
  const host = document.getElementById('mail-settings-body');
  if (!host) return;
  host.innerHTML = '<p class="mail-muted">Carregando…</p>';
  let data;
  try { data = await load(); } catch (e) {
    host.innerHTML = `<p class="mail-warn">⚠️ O recurso ainda não foi ativado no banco de dados (${esc(e.message || e)}). Assim que a atualização do Supabase for aplicada, esta área funciona sozinha.</p>`;
    badge(false); return;
  }
  const {cfg, hasPass} = data;
  const ready = Boolean(cfg.smtp_user && hasPass);
  badge(ready);
  const preset = Object.entries(PRESETS).find(([, p]) => p.smtp_host === (cfg.smtp_host || 'smtp.gmail.com'))?.[0] || 'outro';
  host.innerHTML = `<div class="mail-settings-box">
    <p class="mail-intro">Quando alguém toca em <b>Esqueci minha senha</b>, o sistema manda um link de uso único (30 min) para o <b>e-mail de contato</b> cadastrado no usuário. Configure abaixo a conta que envia esses e-mails.</p>
    <div class="mail-grid">
      <label>Serviço<select id="mail-preset" onchange="mailPresetChanged(this.value)">${[['gmail', 'Gmail'], ['outlook', 'Outlook / Hotmail'], ['brevo', 'Brevo'], ['outro', 'Outro servidor']].map(([v, l]) => `<option value="${v}"${v === preset ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Servidor SMTP<input id="mail-host" value="${esc(cfg.smtp_host || 'smtp.gmail.com')}" autocapitalize="off" spellcheck="false"></label>
      <label>Porta<input id="mail-port" type="number" inputmode="numeric" value="${esc(cfg.smtp_port || 465)}"></label>
      <label>E-mail que envia (login)<input id="mail-user" type="email" value="${esc(cfg.smtp_user || '')}" placeholder="ex.: gestao.sertania@gmail.com" autocapitalize="off" spellcheck="false"></label>
      <label>Nome do remetente<input id="mail-from-name" value="${esc(cfg.from_name || 'Prefeitura de Sertânia · Gestão')}"></label>
      <label>Senha de app ${hasPass ? '<em class="mail-ok">✓ já gravada</em>' : ''}<input id="mail-pass" type="password" autocomplete="new-password" placeholder="${hasPass ? 'Deixe em branco para manter' : 'Senha de app (16 letras)'}"></label>
    </div>
    <p class="mail-help" id="mail-help">${PRESETS[preset]?.help || 'Informe o servidor, a porta (465 com SSL ou 587) e as credenciais SMTP.'}</p>
    <p class="mail-safe">🔒 A senha vai direto para o cofre do Supabase (Vault). Ela não aparece de volta nesta tela nem em nenhum arquivo.</p>
    <div class="mail-actions"><button type="button" class="users-button users-button-primary" onclick="saveMailSettings()">Salvar configuração</button>
      <span class="mail-test"><input id="mail-test-to" type="email" placeholder="e-mail para teste" value="${esc(window.S?.users?.find(u => u.id === window.S?.user?.uid)?.email_contato || '')}"><button type="button" class="users-button users-button-soft" onclick="testMailSettings()"${ready ? '' : ' disabled title="Salve a configuração primeiro"'}>✉️ Enviar teste</button></span></div>
    <p class="mail-muted">${(window.S?.users || []).filter(u => u.email_contato).length} de ${(window.S?.users || []).length} usuários têm e-mail de contato. Quem não tem continua precisando do administrador para trocar a senha.</p>
  </div>`;
};

window.mailPresetChanged = value => {
  const p = PRESETS[value];
  if (p) { document.getElementById('mail-host').value = p.smtp_host; document.getElementById('mail-port').value = p.smtp_port; }
  document.getElementById('mail-help').innerHTML = p?.help || 'Informe o servidor, a porta (465 com SSL ou 587) e as credenciais SMTP.';
};

window.saveMailSettings = async function () {
  const val = id => document.getElementById(id)?.value.trim() || '';
  const patch = {smtp_host: val('mail-host'), smtp_port: Number(val('mail-port')) || 465, smtp_user: val('mail-user').toLowerCase(), from_email: val('mail-user').toLowerCase(), from_name: val('mail-from-name') || 'Prefeitura de Sertânia · Gestão', updated_at: new Date().toISOString()};
  if (!patch.smtp_host || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.smtp_user)) { toast('Informe o servidor e o e-mail que envia.', 'error'); return; }
  const pass = document.getElementById('mail-pass')?.value.replace(/\s+/g, '') || '';
  try {
    const {error} = await supabase.from('mail_settings').update(patch).eq('id', 1);
    if (error) throw error;
    if (pass) { const {error: e2} = await supabase.rpc('pms_set_smtp_password', {p_password: pass}); if (e2) throw e2; }
    toast('Configuração de e-mail salva!', 'success');
    window.renderMailSettings();
  } catch (e) { toast('Não foi possível salvar: ' + (e.message || e), 'error', 7000); }
};

window.testMailSettings = async function () {
  const to = document.getElementById('mail-test-to')?.value.trim();
  try {
    toast('Enviando e-mail de teste…', 'info');
    const r = await invoke({action: 'test', to});
    if (r.ok) toast('✅ E-mail de teste enviado para ' + r.sent_to + '. Confira a caixa de entrada (e o spam).', 'success', 7000);
    else toast(window.mailResetReason(r.reason) + (r.error ? ' (' + r.error + ')' : ''), 'error', 9000);
  } catch (e) { toast('Falha no teste: ' + (e.message || e), 'error', 7000); }
};
