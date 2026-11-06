// Avisos por WhatsApp de lançamentos (Gestão de Atividades · Prefeitura de Sertânia).
// Chamada pelo pg_cron (cabeçalho x-cron-secret) para processar a fila, ou pelo painel de um
// administrador (login) para testar um destinatário e ver a prévia da mensagem.
import {createClient} from 'npm:@supabase/supabase-js@2';

const SITE = 'https://camposwebpersonal.github.io/gestao-atividades/';
const TZ = 'America/Recife';
const DEBOUNCE_MS = 20_000; // espera o lançador terminar (salvar + fotos + ajustes) antes de avisar
const MAX_LEN = 1800;
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth: {persistSession: false}});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...CORS, 'Content-Type': 'application/json'}});

// ── dados do lançamento ──
type Rec = Record<string, any>;
const SYSTEM_KEYS = new Set(['id', 'extra_fields', 'created_at', 'updated_at', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name', 'audit_created_at', 'audit_updated_at', 'sync_at', 'old_id', 'parent_id', 'parent_type', 'is_placeholder', 'show_conclusion_date', 'show_external_geolocation', 'geo_location', 'latitude', 'longitude', 'accuracy', 'captured_at', 'verba', 'verba_obs', 'verbas_list', 'origem_verba', 'documentacao', 'documentacao_obs', 'licitacao', 'licitacao_obs', 'urgencia', 'prioritario', 'solicitante', 'registro_tipo', 'modulo', 'controle_pocos', 'transfer_history', 'status_list', 'status_options', 'table_columns', 'exibir_valores', 'imagens', 'contatos_responsavel', 'poco_order', 'licitacao_group_id', 'fornecedor_numero']);
const SYSTEM_PREFIXES = ['item_show_', 'import_', 'pipa_', 'geo_', '_'];
const isSystem = (k: string) => SYSTEM_KEYS.has(k) || SYSTEM_PREFIXES.some(p => k.startsWith(p));
const extraOf = (r: Rec | null): Rec => { try { const v = r?.extra_fields; const p = typeof v === 'string' ? JSON.parse(v) : v; return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; } };
const blank = (v: unknown) => v === null || v === undefined || v === false || typeof v === 'object' || ['', '-', '—'].includes(String(v).trim());
const cut = (s: unknown, n = 140) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const day = (v: unknown) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const when = (v: unknown) => { const d = v ? new Date(String(v)) : new Date(); return d.toLocaleDateString('pt-BR', {timeZone: TZ}) + ' às ' + d.toLocaleTimeString('pt-BR', {timeZone: TZ, hour: '2-digit', minute: '2-digit'}); };
const STATUS: Rec = {pendente: 'Pendente', solicitado: 'Solicitado', recebido: 'Recebido', analisando: 'Analisando', aprovado: 'Aprovado', ressalva: 'Ressalva', reprovado: 'Reprovado', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado'};
const URG: Rec = {vermelho: '🔴 Urgente', amarelo: '🟡 Necessita de atenção', verde: '🟢 Pode aguardar'};
const statusOf = (r: Rec) => Number(r.concluded) === 1 ? 'Concluído' + (r.conclusion_date ? ' em ' + day(r.conclusion_date) : '') : (STATUS[r.status] || (r.status ? String(r.status) : 'Pendente'));
const val = (r: Rec, k: string) => r?.[k] ?? extraOf(r)[k];
const fieldsOf = (r: Rec, order: Map<string, number>) => Object.entries(extraOf(r))
  .filter(([k, v]) => !isSystem(k) && !blank(v) && !(k === 'origem' && /^[a-z]+(_[a-z]+)+$/.test(String(v))))
  .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
  .map(([k, v]) => [k === k.toLowerCase() ? k.charAt(0).toUpperCase() + k.slice(1) : k, /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? day(v) : String(v === true ? 'Sim' : v)] as [string, string]);
const locationOf = (r: Rec) => { const g = extraOf(r).geo_location; return g && Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude)) && !(Number(g.latitude) === 0 && Number(g.longitude) === 0) ? {lat: Number(g.latitude), lng: Number(g.longitude)} : null; };

function changes(before: Rec | null, after: Rec, order: Map<string, number>): string[] {
  if (!before) return [];
  const out: string[] = [];
  const pair = (label: string, a: unknown, b: unknown) => { const x = cut(a, 60) || '(vazio)', y = cut(b, 60) || '(vazio)'; if (x !== y) out.push(`• ${label}: ${x} → *${y}*`); };
  pair('Nome', before.description, after.description);
  pair('Situação', statusOf(before), statusOf(after));
  pair('Responsável', before.responsaveis, after.responsaveis);
  pair('Prazo', day(before.deadline_date), day(after.deadline_date));
  pair('Urgência', URG[val(before, 'urgencia')] || '', URG[val(after, 'urgencia')] || '');
  pair('Observação', before.observacao, after.observacao);
  const a = new Map(fieldsOf(before, order)), b = new Map(fieldsOf(after, order));
  for (const k of new Set([...a.keys(), ...b.keys()])) pair(k, a.get(k), b.get(k));
  const la = locationOf(before), lb = locationOf(after);
  if (JSON.stringify(la) !== JSON.stringify(lb)) out.push(lb ? (la ? '• 📍 Localização alterada' : '• 📍 Localização adicionada') : '• 📍 Localização removida');
  return out.slice(0, 12);
}

interface Ctx { record: Rec; table: string; group: Rec | null; secretaria: Rec | null; parents: Rec[]; order: Map<string, number> }

async function context(table: string, id: string): Promise<Ctx | null> {
  const {data: record} = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (!record) return null;
  let item: Rec | null = null;
  if (table === 'subitems') ({data: item} = await db.from('items').select('id,description,atividade_id,secretaria_id').eq('id', record.item_id).maybeSingle());
  const groupId = record.atividade_id || item?.atividade_id;
  const {data: group} = groupId ? await db.from('atividades').select('id,name,demanda_secretaria_id').eq('id', groupId).maybeSingle() : {data: null};
  const secId = record.secretaria_id || item?.secretaria_id || group?.demanda_secretaria_id;
  const {data: secretaria} = secId ? await db.from('secretarias').select('id,name').eq('id', secId).maybeSingle() : {data: null};
  const parents: Rec[] = [];
  if (table === 'subitems') {
    let p: Rec | null = record;
    for (let i = 0; i < 6 && p && p.parent_type === 'subitem'; i++) { ({data: p} = await db.from('subitems').select('id,description,parent_id,parent_type').eq('id', p.parent_id).maybeSingle()); if (p) parents.unshift(p); }
    if (item) parents.unshift(item);
  }
  const {data: tpls} = groupId ? await db.from('field_templates').select('field_name,order_num').eq('atividade_id', groupId) : {data: []};
  return {record, table, group, secretaria, parents, order: new Map((tpls || []).map((t: Rec) => [t.field_name, Number(t.order_num ?? 0)]))};
}

function detailedMessage(c: Ctx, op: string, before: Rec | null): string {
  const r = c.record, isNew = op === 'insert';
  const L: string[] = [];
  L.push(isNew ? '🆕 *NOVO LANÇAMENTO*' : (Number(r.concluded) === 1 && before && Number(before.concluded) !== 1 ? '✅ *LANÇAMENTO CONCLUÍDO*' : '✏️ *LANÇAMENTO ATUALIZADO*'));
  L.push('━━━━━━━━━━━━━━');
  L.push(`📌 *${cut(r.description || 'Sem nome', 120)}*`);
  if (c.secretaria) L.push(`🏛️ ${cut(c.secretaria.name, 80)}`);
  if (c.group) L.push(`📁 ${cut(c.group.name, 80)}`);
  if (c.parents.length) L.push(`↳ dentro de: ${c.parents.map(p => cut(p.description, 50)).join(' › ')}`);
  L.push('');
  const tags = [`🚦 ${statusOf(r)}`, URG[val(r, 'urgencia')], val(r, 'prioritario') ? '⭐ Prioritário' : '', r.deadline_date && Number(r.concluded) !== 1 ? `⏰ Prazo ${day(r.deadline_date)}` : ''].filter(Boolean);
  L.push(tags.join(' · '));
  if (r.responsaveis) L.push(`👤 Responsável: ${cut(r.responsaveis, 80)}`);
  if (val(r, 'solicitante')) L.push(`🙋 Solicitante: ${cut(val(r, 'solicitante'), 80)}`);
  for (const [k, v] of fieldsOf(r, c.order).slice(0, 14)) L.push(`▫️ ${cut(k, 40)}: ${cut(v, 120)}`);
  if (r.observacao) L.push(`💬 _${cut(r.observacao, 260)}_`);
  const diff = changes(before, r, c.order);
  if (diff.length) { L.push(''); L.push('🔄 *O que mudou*'); L.push(...diff); }
  L.push('');
  const loc = locationOf(r);
  if (loc) {
    L.push('📍 *Localização*');
    L.push(`Google Maps: https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`);
    L.push(`Ponto no mapa do sistema: ${SITE}#mapa/${c.table}/${encodeURIComponent(r.id)}`);
  } else L.push('📍 Sem localização cadastrada');
  L.push('');
  L.push(`🔗 *Abrir no sistema:* ${SITE}#foco/${c.table}/${encodeURIComponent(r.id)}`);
  L.push('');
  L.push(`${isNew ? '✍️ Lançado' : '✍️ Atualizado'} por *${cut(r.updated_by_name || r.created_by_name || 'Sistema', 60)}*`);
  L.push(`🕒 ${when(r.audit_updated_at || r.updated_at)}`);
  L.push('_Gestão de Atividades · Prefeitura de Sertânia_');
  const text = L.join('\n');
  return text.length > MAX_LEN ? text.slice(0, MAX_LEN - 30) + '\n…\n_(mensagem resumida)_' : text;
}

function summaryMessage(list: {c: Ctx; op: string}[]): string {
  const g = list[0].c.group, s = list[0].c.secretaria, last = list[list.length - 1].c.record;
  const novos = list.filter(x => x.op === 'insert').length;
  const L = [`📦 *${list.length} LANÇAMENTOS* ${novos === list.length ? 'novos' : novos ? `(${novos} novos)` : 'atualizados'}`, '━━━━━━━━━━━━━━'];
  if (s) L.push(`🏛️ ${cut(s.name, 80)}`);
  if (g) L.push(`📁 ${cut(g.name, 80)}`);
  L.push('');
  list.slice(0, 12).forEach((x, i) => L.push(`${i + 1}. ${x.op === 'insert' ? '🆕' : '✏️'} *${cut(x.c.record.description, 70)}* — ${statusOf(x.c.record)}${locationOf(x.c.record) ? ' 📍' : ''}\n   ${SITE}#foco/${x.c.table}/${encodeURIComponent(x.c.record.id)}`));
  if (list.length > 12) L.push(`… e mais ${list.length - 12}.`);
  L.push('');
  if (g) L.push(`🔗 *Abrir o grupo:* ${SITE}#activity/${encodeURIComponent(g.id)}`);
  L.push(`✍️ Por *${cut(last.updated_by_name || 'Sistema', 60)}* · 🕒 ${when(last.audit_updated_at || last.updated_at)}`);
  L.push('_Gestão de Atividades · Prefeitura de Sertânia_');
  const text = L.join('\n');
  return text.length > MAX_LEN ? text.slice(0, MAX_LEN - 30) + '\n…' : text;
}

// ── envio (CallMeBot) ──
async function sendCallMeBot(phone: string, apikey: string, text: string) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${phone}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const ok = res.ok && !/error|invalid|not (been )?activated|apikey is not/i.test(body);
  return {ok, detail: `${res.status} ${body.slice(0, 220)}`};
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function recipientsFor(c: Ctx, op: string) {
  const {data} = await db.from('whatsapp_recipients').select('id,nome,telefone,escopo,escopo_id,eventos,ativo,apikey').eq('ativo', true);
  return (data || []).filter((r: Rec) => (r.eventos === 'todos' || op === 'insert') && (r.escopo === 'todos' || (r.escopo === 'secretaria' && r.escopo_id === c.secretaria?.id) || (r.escopo === 'grupo' && r.escopo_id === c.group?.id)));
}

async function deliver(recipients: Rec[], titulo: string, text: string, outboxIds: number[]) {
  let sent = 0, failed = 0;
  for (const r of recipients) {
    if (!r.apikey) { await db.from('whatsapp_log').insert({recipient_id: r.id, nome: r.nome, telefone: r.telefone, titulo, mensagem: text, status: 'aguardando-chave', detalhe: 'Destinatário ainda sem a chave da CallMeBot.', outbox_ids: outboxIds}); continue; }
    try {
      const out = await sendCallMeBot(r.telefone, r.apikey, text);
      out.ok ? sent++ : failed++;
      await db.from('whatsapp_log').insert({recipient_id: r.id, nome: r.nome, telefone: r.telefone, titulo, mensagem: text, status: out.ok ? 'enviado' : 'erro', detalhe: out.detail, outbox_ids: outboxIds});
    } catch (e) {
      failed++;
      await db.from('whatsapp_log').insert({recipient_id: r.id, nome: r.nome, telefone: r.telefone, titulo, mensagem: text, status: 'erro', detalhe: String((e as Error).message || e).slice(0, 220), outbox_ids: outboxIds});
    }
    await wait(1200);
  }
  return {sent, failed};
}

async function processQueue() {
  const {data: rows} = await db.from('whatsapp_outbox').select('*').eq('status', 'pendente').order('id').limit(400);
  if (!rows?.length) return {grupos: 0};
  const byGroup = new Map<string, Rec[]>();
  for (const r of rows) { const k = r.atividade_id || 'sem-grupo'; byGroup.set(k, [...(byGroup.get(k) || []), r]); }
  let grupos = 0;
  for (const [, list] of byGroup) {
    const newest = Math.max(...list.map(r => new Date(r.created_at).getTime()));
    if (Date.now() - newest < DEBOUNCE_MS) continue; // ainda chegando alterações deste grupo
    const ids = list.map(r => r.id);
    // Marca primeiro (evita envio duplo se duas execuções se cruzarem).
    const {data: claimed} = await db.from('whatsapp_outbox').update({status: 'enviado', processed_at: new Date().toISOString()}).in('id', ids).eq('status', 'pendente').select('id');
    if (!claimed?.length) continue;
    grupos++;
    // Um aviso por lançamento: junta várias gravações seguidas do mesmo registro.
    const byRecord = new Map<string, {table: string; id: string; op: string; before: Rec | null}>();
    for (const r of list) {
      const key = r.tabela + ':' + r.registro_id, cur = byRecord.get(key);
      if (!cur) byRecord.set(key, {table: r.tabela, id: r.registro_id, op: r.operacao, before: r.antes});
      else if (r.operacao === 'insert') cur.op = 'insert';
    }
    const ctxs: {c: Ctx; op: string; before: Rec | null}[] = [];
    for (const e of byRecord.values()) { const c = await context(e.table, e.id); if (c) ctxs.push({c, op: e.op, before: e.op === 'insert' ? null : e.before}); }
    if (!ctxs.length) { await db.from('whatsapp_outbox').update({status: 'ignorado', detalhe: 'Lançamento não existe mais.'}).in('id', ids); continue; }
    // Edição sem mudança visível (ex.: só imagens) não gera aviso.
    const relevant = ctxs.filter(x => x.op === 'insert' || changes(x.before, x.c.record, x.c.order).length);
    if (!relevant.length) { await db.from('whatsapp_outbox').update({status: 'ignorado', detalhe: 'Sem mudança relevante.'}).in('id', ids); continue; }
    const recipients = await recipientsFor(relevant[0].c, relevant.some(x => x.op === 'insert') ? 'insert' : 'update');
    if (!recipients.length) { await db.from('whatsapp_outbox').update({status: 'ignorado', detalhe: 'Nenhum destinatário para este grupo.'}).in('id', ids); continue; }
    const text = relevant.length === 1 ? detailedMessage(relevant[0].c, relevant[0].op, relevant[0].before) : summaryMessage(relevant);
    const titulo = relevant.length === 1 ? cut(relevant[0].c.record.description, 90) : `${relevant.length} lançamentos · ${cut(relevant[0].c.group?.name, 60)}`;
    const {sent, failed} = await deliver(recipients, titulo, text, ids);
    if (failed && !sent) await db.from('whatsapp_outbox').update({status: 'erro', detalhe: 'Falha no envio (veja o histórico).'}).in('id', ids);
  }
  return {grupos};
}

async function adminFrom(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const {data} = await db.auth.getUser(token);
  if (!data?.user) return null;
  const {data: u} = await db.from('users').select('id,role,is_admin').eq('id', data.user.id).maybeSingle();
  return u && (u.role === 'admin' || u.is_admin === true) ? data.user : null;
}

async function latestRecord(): Promise<{table: string; id: string} | null> {
  const [{data: a}, {data: b}] = await Promise.all([
    db.from('items').select('id,updated_at').order('updated_at', {ascending: false}).limit(1),
    db.from('subitems').select('id,updated_at').order('updated_at', {ascending: false}).limit(1)]);
  const i = a?.[0], s = b?.[0];
  if (!i && !s) return null;
  return !s || (i && i.updated_at >= s.updated_at) ? {table: 'items', id: i!.id} : {table: 'subitems', id: s!.id};
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  let body: Rec = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const secret = req.headers.get('x-cron-secret');
  if (secret) {
    const {data: ok} = await db.rpc('pms_whatsapp_check_secret', {candidate: secret});
    if (!ok) return json({error: 'não autorizado'}, 401);
    return json(await processQueue());
  }
  const admin = await adminFrom(req);
  if (!admin) return json({error: 'Somente administradores.'}, 401);
  const pick = body.table && body.id ? {table: String(body.table), id: String(body.id)} : await latestRecord();
  if (body.action === 'preview') {
    if (!pick) return json({text: 'Ainda não há lançamentos para montar a prévia.'});
    const c = await context(pick.table, pick.id);
    return json({text: c ? detailedMessage(c, 'insert', null) : 'Lançamento não encontrado.'});
  }
  if (body.action === 'test') {
    const {data: r} = await db.from('whatsapp_recipients').select('id,nome,telefone,apikey').eq('id', body.recipient_id).maybeSingle();
    if (!r) return json({ok: false, detail: 'Destinatário não encontrado.'}, 404);
    if (!r.apikey) return json({ok: false, detail: 'Informe a chave da CallMeBot deste número antes de testar.'}, 400);
    const c = pick ? await context(pick.table, pick.id) : null;
    const text = '🧪 *TESTE DE AVISO*\nSe você recebeu esta mensagem, os avisos por WhatsApp estão funcionando.\n\nExemplo com o último lançamento:\n\n' + (c ? detailedMessage(c, 'insert', null) : '(sem lançamentos)');
    const out = await sendCallMeBot(r.telefone, r.apikey, text.slice(0, MAX_LEN));
    await db.from('whatsapp_log').insert({recipient_id: r.id, nome: r.nome, telefone: r.telefone, titulo: 'Teste de aviso', mensagem: text, status: out.ok ? 'enviado' : 'erro', detalhe: out.detail});
    return json(out, out.ok ? 200 : 502);
  }
  if (body.action === 'process') return json(await processQueue());
  return json({error: 'ação desconhecida'}, 400);
});
