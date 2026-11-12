// Redefinição de senha por e-mail (Gestão de Atividades · Prefeitura de Sertânia).
// Ações:
//   request {login}            → público: envia link de uso único ao e-mail de contato do usuário
//   check   {token}            → público: diz se o link ainda vale (e para quem)
//   confirm {token, password}  → público: grava a nova senha e invalida o link
//   admin_send {user_id}       → administrador: envia o link para um usuário
//   test {to}                  → administrador: e-mail de teste com a configuração atual
// verify_jwt=false: a própria função valida o administrador pelo token de login.
import {createClient} from 'npm:@supabase/supabase-js@2';
import {SMTPClient} from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth: {persistSession: false}});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});
const LOGIN_DOMAINS = ['@pms.sertania.pe.gov.br', '@pms.sertania'];
const OWNER = 'camposweb.personal@gmail.com';
const TTL_MIN = 30;

const normalize = (v: string) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const loginOf = (email: string) => String(email || '').toLowerCase() === OWNER ? 'rcampos' : String(email || '').replace(/@pms\.sertania(?:\.pe\.gov\.br)?$/i, '');
const mask = (email: string) => { const [u, d] = String(email).split('@'); return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, u.length - 2)))}@${d}`; };
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
const newToken = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

async function findUser(login: string) {
  const raw = String(login || '').trim().toLowerCase();
  const user = normalize(raw);
  if (!user) return null;
  const emails = raw.includes('@') ? [raw] : user === 'rcampos' ? [OWNER] : LOGIN_DOMAINS.map(d => user + d);
  const {data} = await db.from('users').select('id,display_name,email,email_contato').in('email', emails).limit(1);
  return data?.[0] || null;
}

async function settings() {
  const {data} = await db.from('mail_settings').select('*').eq('id', 1).maybeSingle();
  const {data: pass} = await db.rpc('pms_smtp_password');
  if (!data?.smtp_user || !pass) return null;
  return {...data, pass: String(pass)};
}

async function sendMail(cfg: any, to: string, subject: string, html: string, text: string) {
  const client = new SMTPClient({connection: {hostname: cfg.smtp_host, port: Number(cfg.smtp_port) || 465, tls: Number(cfg.smtp_port) !== 587, auth: {username: cfg.smtp_user, password: cfg.pass}}});
  try {
    await client.send({from: `${cfg.from_name} <${cfg.from_email || cfg.smtp_user}>`, to, subject, content: text, html});
  } finally { try { await client.close(); } catch { /* */ } }
}

function resetEmail(cfg: any, name: string, login: string, link: string) {
  const subject = 'Redefinir sua senha · Gestão de Atividades PMS';
  const text = `Olá, ${name}.\n\nRecebemos um pedido para redefinir a senha do usuário "${login}".\nAbra o link abaixo em até ${TTL_MIN} minutos (uso único):\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\n\nPrefeitura Municipal de Sertânia`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#172033">
<div style="height:5px;background:linear-gradient(90deg,#75c044,#16803d,#f5b82e);border-radius:4px"></div>
<h2 style="margin:22px 0 6px;color:#142337">Redefinir sua senha</h2>
<p style="font-size:15px;line-height:1.5">Olá, <b>${esc(name)}</b>. Recebemos um pedido para redefinir a senha do usuário <b style="font-family:monospace">${esc(login)}</b> no sistema de Gestão de Atividades.</p>
<p style="margin:26px 0;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#16803d;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:11px;font-size:15px">🔑 Criar nova senha</a></p>
<p style="font-size:13px;color:#46566a;line-height:1.5">O link vale por ${TTL_MIN} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
<p style="font-size:12px;color:#46566a;word-break:break-all">Se o botão não abrir, copie: ${esc(link)}</p>
<p style="font-size:12px;color:#46566a;margin-top:24px">Prefeitura Municipal de Sertânia · Gestão de Atividades</p></div>`;
  return {subject, html, text};
}

async function issue(user: any, requestedBy: string, ip: string, cfg: any) {
  const to = String(user.email_contato || '').trim().toLowerCase();
  if (!to) return {ok: false, reason: 'sem_email'};
  // Limite: 3 links por usuário a cada hora.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const {count} = await db.from('password_reset_tokens').select('id', {count: 'exact', head: true}).eq('user_id', user.id).gte('created_at', since);
  if ((count || 0) >= 3) return {ok: false, reason: 'limite'};
  const token = newToken();
  await db.from('password_reset_tokens').insert({user_id: user.id, token_hash: await sha256(token), email_to: to, requested_by: requestedBy, ip, expires_at: new Date(Date.now() + TTL_MIN * 60_000).toISOString()});
  const site = String(cfg.site_url || '').replace(/\/?$/, '/');
  const link = `${site}login.html#redefinir-senha/${token}`;
  const login = loginOf(user.email);
  const mail = resetEmail(cfg, user.display_name || login, login, link);
  await sendMail(cfg, to, mail.subject, mail.html, mail.text);
  return {ok: true, sent_to: mask(to)};
}

// Senha vazada? (Pwned Passwords, k-anonimato; se o serviço falhar, não bloqueia)
async function pwnedCount(password: string): Promise<number> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {headers: {'Add-Padding': 'true'}, signal: AbortSignal.timeout(4000)});
    if (!res.ok) return 0;
    for (const line of (await res.text()).split('\n')) { const [suf, n] = line.trim().split(':'); if (suf === hash.slice(5)) return Number(n) || 0; }
  } catch { /* falha de rede: não bloqueia */ }
  return 0;
}

async function tokenRow(token: string) {
  if (!token || token.length < 20) return null;
  const {data} = await db.from('password_reset_tokens').select('*').eq('token_hash', await sha256(token)).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function callerIsAdmin(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const {data} = await db.auth.getUser(jwt);
  const uid = data?.user?.id;
  if (!uid) return null;
  const {data: row} = await db.from('users').select('id,role,is_admin').eq('id', uid).maybeSingle();
  return row && (row.role === 'admin' || row.is_admin === true) ? row : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if (req.method !== 'POST') return json({ok: false, error: 'Método não permitido'}, 405);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  try {
    switch (body.action) {
      case 'request': {
        const cfg = await settings();
        if (!cfg) return json({ok: false, reason: 'nao_configurado'});
        // Limite por IP: 10 pedidos por hora.
        if (ip) {
          const {count} = await db.from('password_reset_tokens').select('id', {count: 'exact', head: true}).eq('ip', ip).gte('created_at', new Date(Date.now() - 3600_000).toISOString());
          if ((count || 0) >= 10) return json({ok: false, reason: 'limite'});
        }
        const user = await findUser(body.login);
        if (!user) return json({ok: false, reason: 'nao_encontrado'});
        return json(await issue(user, 'self', ip, cfg));
      }
      case 'check': {
        const row = await tokenRow(body.token);
        if (!row) return json({ok: false, reason: 'invalido'});
        const {data: user} = await db.from('users').select('display_name,email').eq('id', row.user_id).maybeSingle();
        return json({ok: true, name: user?.display_name || '', login: loginOf(user?.email || ''), expires_at: row.expires_at});
      }
      case 'confirm': {
        const password = String(body.password || '');
        if (password.length < 6) return json({ok: false, reason: 'senha_curta'});
        const leaks = await pwnedCount(password);
        if (leaks > 0) return json({ok: false, reason: 'senha_vazada', count: leaks});
        const row = await tokenRow(body.token);
        if (!row) return json({ok: false, reason: 'invalido'});
        // Marca como usado antes de trocar (evita uso duplo em cliques repetidos).
        const {data: claimed} = await db.from('password_reset_tokens').update({used_at: new Date().toISOString()}).eq('id', row.id).is('used_at', null).select('id');
        if (!claimed?.length) return json({ok: false, reason: 'invalido'});
        const {error} = await db.auth.admin.updateUserById(row.user_id, {password});
        if (error) { await db.from('password_reset_tokens').update({used_at: null}).eq('id', row.id); return json({ok: false, reason: 'falha', error: error.message}); }
        await db.from('password_reset_tokens').update({used_at: new Date().toISOString()}).eq('user_id', row.user_id).is('used_at', null);
        const {data: user} = await db.from('users').select('email').eq('id', row.user_id).maybeSingle();
        return json({ok: true, login: loginOf(user?.email || '')});
      }
      case 'admin_send': {
        const admin = await callerIsAdmin(req);
        if (!admin) return json({ok: false, reason: 'proibido'}, 403);
        const cfg = await settings();
        if (!cfg) return json({ok: false, reason: 'nao_configurado'});
        const {data: user} = await db.from('users').select('id,display_name,email,email_contato').eq('id', String(body.user_id || '')).maybeSingle();
        if (!user) return json({ok: false, reason: 'nao_encontrado'});
        return json(await issue(user, String(admin.id), ip, cfg));
      }
      case 'test': {
        const admin = await callerIsAdmin(req);
        if (!admin) return json({ok: false, reason: 'proibido'}, 403);
        const cfg = await settings();
        if (!cfg) return json({ok: false, reason: 'nao_configurado'});
        const to = String(body.to || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ok: false, reason: 'email_invalido'});
        await sendMail(cfg, to, 'Teste · e-mails de redefinição de senha', '<p style="font-family:Segoe UI,Arial">✅ O envio de e-mails do sistema de Gestão de Atividades está funcionando.</p>', 'O envio de e-mails do sistema de Gestão de Atividades está funcionando.');
        return json({ok: true, sent_to: to});
      }
      default: return json({ok: false, error: 'Ação desconhecida'}, 400);
    }
  } catch (error) {
    console.error('[password-reset]', error);
    const msg = String((error as Error)?.message || error);
    const reason = /auth|535|534|credentials|username and password/i.test(msg) ? 'smtp_login' : 'falha';
    return json({ok: false, reason, error: msg.slice(0, 300)});
  }
});
