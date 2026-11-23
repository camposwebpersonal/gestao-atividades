/* LINK PROVISÓRIO DE CONFERÊNCIA (23/11/2026) — em TODOS os grupos de lançamento.
 * Quem administra o grupo gera um link (padrão: pode EDITAR; ou só VER). Quem recebe abre conferir.html?t=…,
 * edita e marca cada lançamento como CONFERIDO (ou "Conferir todos" + Salvar, com confirmação). Conferido não pode
 * mais ser editado pelo link; quando tudo está conferido o link expira. Gerar link novo zera a conferência.
 * Banco: migração 20261123190000_link_conferencia.sql (share_links + funções pms_share_*).
 * Aqui: janela do link, selo "✓ Conferido" nos lançamentos e faixa de conferência do grupo. */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ef = r => { let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const dBR = v => { if (!v) return ''; const s = String(v); if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); return isNaN(d) ? s.slice(0, 10).split('-').reverse().join('/') : d.toLocaleDateString('pt-BR'); } return s; };
  const hora = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); };
  const S = () => window.S || {};
  const groupOf = id => (S().secs || []).find(s => s.id === id);
  const conf = r => r?.conferencia || ef(r).conferencia || null;
  const linkUrl = token => new URL('conferir.html?t=' + encodeURIComponent(token), location.href.split('#')[0].replace(/[^/]*$/, '')).href;

  // ── opções comuns de link (validade + PIN opcional) — usadas na conferência e na Secretaria da Mulher ──
  const PRAZOS = [['', 'Sem prazo'], ['1', '1 hora'], ['2', '2 horas'], ['6', '6 horas'], ['24', '1 dia'], ['48', '2 dias'], ['168', '7 dias'], ['720', '30 dias']];
  window.linkOpcoesHtml = function (semPrazoDica) {
    return `<div class="lk-opts">
      <div class="lk-opt"><span class="lk-lbl">⏳ Validade do link</span><div class="lk-chips" role="radiogroup" aria-label="Validade do link">${PRAZOS.map(([h, l], i) => `<label><input type="radio" name="lk-prazo" value="${h}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <small class="lk-hint">${semPrazoDica || 'Sem prazo: vale até ser encerrado.'}</small></div>
      <div class="lk-opt"><label class="lk-switch"><input type="checkbox" id="lk-pin-on" onchange="this.closest('.lk-opts').querySelector('.lk-pin').hidden=!this.checked;if(this.checked)this.closest('.lk-opts').querySelector('#lk-pin').focus()"><span class="lk-track" aria-hidden="true"></span><b>🔒 Pedir PIN de 4 números</b><small>opcional — quem abrir o link precisa digitar o PIN</small></label>
        <div class="lk-pin" hidden><input type="text" id="lk-pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="0000" aria-label="PIN de 4 números" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"><small>Combine o PIN com a pessoa por outro meio (ligação, pessoalmente). 8 tentativas erradas bloqueiam o link.</small></div></div>
    </div>`;
  };
  window.linkOpcoesLer = function (root) {
    const h = root.querySelector('input[name="lk-prazo"]:checked')?.value || '';
    const on = root.querySelector('#lk-pin-on')?.checked, pin = (root.querySelector('#lk-pin')?.value || '').trim();
    if (on && !/^\d{4}$/.test(pin)) { window.toast?.('Digite um PIN de 4 números (ou desligue o PIN).', 'error'); root.querySelector('#lk-pin')?.focus(); return null; }
    return {horas: h ? Number(h) : null, pin: on ? pin : null};
  };
  const quando = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`; };
  window.linkValidadeTexto = v => v ? `válido até ${quando(v)}` : 'sem prazo';
  // QR em SVG (tela) — o mesmo gerador vetorial dos PDFs
  window.qrSvg = function (text, px = 168) {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return `<svg class="lk-qr" width="${px}" height="${px}" viewBox="0 0 ${n + 4} ${n + 4}" role="img" aria-label="QR Code do link" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1e1b4b"/></svg>`;
  };

  // lançamentos do grupo (itens + subitens de todos os níveis)
  const recordsOf = gid => { const items = (S().items || []).filter(i => i.atividade_id === gid), ids = new Set(items.map(i => i.id)); return [...items, ...(S().subitems || []).filter(s => s.atividade_id === gid || ids.has(s.item_id))]; };
  window.recordConferido = r => !!conf(r);
  window.conferenciaStatus = function (gid) {
    const g = groupOf(gid), e = ef(g), recs = recordsOf(gid), feitos = recs.filter(r => conf(r)).length;
    return {total: recs.length, feitos, ativo: !!(g?.conferencia_link || e.conferencia_link), concluida: g?.conferencia_concluida || e.conferencia_concluida || null, desde: g?.conferencia_desde || e.conferencia_desde, modo: g?.conferencia_modo || e.conferencia_modo};
  };

  // faixa fina no topo do grupo: conferência em andamento / grupo conferido
  window.conferenciaBanner = function (gid) {
    const st = window.conferenciaStatus(gid);
    if (st.concluida) return `<div class="conf-banner is-done" role="status"><span class="conf-seal" aria-hidden="true">✓</span><div><b>Grupo conferido</b><small>${st.total} lançamento(s) conferidos em ${dBR(st.concluida.em)}${st.concluida.por ? ' por ' + esc(st.concluida.por) : ''} · o link expirou</small></div><button type="button" class="conf-banner-btn" onclick="openConferenciaLink('${gid}')">🔗 Nova conferência</button></div>`;
    if (!st.ativo) return '';
    const pct = st.total ? Math.round(st.feitos / st.total * 100) : 0;
    return `<div class="conf-banner" role="status"><span class="ids-ring" style="--p:${pct}" aria-hidden="true"></span><div><b>Conferência em andamento · ${st.feitos} de ${st.total}</b><small>${st.modo === 'ver' ? 'link só para visualizar' : 'link de edição aberto'} desde ${dBR(st.desde)} · os conferidos ganham o selo ✓</small></div><button type="button" class="conf-banner-btn" onclick="openConferenciaLink('${gid}')">🔗 Ver link</button></div>`;
  };

  async function linkAtivo(gid, tipo = 'grupo', alvo = null) {
    try {
      let q = window.db.from('share_links').select('id,token,modo,created_at,created_by_name,visits,last_visit_at,expires_at,pin_hash,alvo_tipo,alvo_id').eq('atividade_id', gid).eq('alvo_tipo', tipo).is('revoked_at', null).is('finished_at', null);
      if (alvo) q = q.eq('alvo_id', alvo);
      const {data} = await q.order('created_at', {ascending: false}).limit(1);
      const l = data?.[0] || null;
      return l && l.expires_at && new Date(l.expires_at) <= new Date() ? null : l;
    } catch { return null; }
  }

  function linkBox(gid, link, tipo = 'grupo', alvo = null) {
    const url = linkUrl(link.token), msg = encodeURIComponent(`Olá! Segue o link para ${link.modo === 'ver' ? 'visualizar' : 'conferir'} os lançamentos de "${groupOf(gid)?.name || ''}":\n${url}`);
    return `<div class="conf-linkbox">
      <div class="conf-linkbox-head"><span class="conf-chip ${link.modo === 'ver' ? 'is-view' : 'is-edit'}">${link.modo === 'ver' ? '👁 Só visualizar' : '✏️ Pode editar e conferir'}</span>${link.pin_hash ? '<span class="conf-chip is-pin">🔒 com PIN</span>' : ''}<span class="conf-chip is-time">⏳ ${esc(window.linkValidadeTexto(link.expires_at))}</span><small>criado em ${dBR(link.created_at)} ${hora(link.created_at)}${link.created_by_name ? ' por ' + esc(link.created_by_name) : ''} · ${link.visits || 0} acesso(s)</small></div>
      <div class="conf-url"><input type="text" readonly value="${esc(url)}" aria-label="Link de conferência" onclick="this.select()"><button type="button" class="btn-action primary" onclick="conferenciaCopiar(this)">📋 Copiar</button></div>
      <div class="conf-actions"><a class="btn-action conf-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${msg}">📱 Enviar pelo WhatsApp</a><a class="btn-action" target="_blank" rel="noopener" href="${esc(url)}">↗ Abrir como visitante</a><button type="button" class="btn-action conf-revoke" onclick="conferenciaRevogar('${gid}','${link.id}','${tipo}',${alvo ? `'${esc(alvo)}'` : 'null'})">⛔ Encerrar este link</button></div>
    </div>`;
  }

  const recOf = (tipo, id) => tipo === 'item' ? (S().items || []).find(i => i.id === id) : tipo === 'sub' ? (S().subitems || []).find(i => i.id === id) : null;
  const subtree = (tipo, id) => { if (tipo === 'grupo') return null; const all = S().subitems || []; const out = []; const walk = pid => all.filter(s => s.parent_id === pid && s.parent_type === 'subitem').forEach(s => { out.push(s); walk(s.id); }); if (tipo === 'item') { const kids = all.filter(s => s.item_id === id); return [recOf('item', id), ...kids].filter(Boolean); } walk(id); return [recOf('sub', id), ...out].filter(Boolean); };
  window.openConferenciaLink = async function (gid, tipo = 'grupo', alvo = null) {
    const g = groupOf(gid); if (!g) return;
    const rec = recOf(tipo, alvo), titulo = tipo === 'grupo' ? g.name : `${rec?.description || 'Lançamento'} · ${g.name}`;
    window.openModal('🔗 Link de conferência', esc(titulo), '<div class="conf-modal"><p class="conf-loading">Carregando…</p></div>');
    const link = await linkAtivo(gid, tipo, alvo), st = window.conferenciaStatus(gid);
    const recs = subtree(tipo, alvo), total = recs ? recs.length : st.total, feitos = recs ? recs.filter(r => conf(r)).length : st.feitos;
    const box = document.querySelector('#modal-ov .conf-modal'); if (!box) return;
    const args = `'${gid}','${tipo}',${alvo ? `'${esc(alvo)}'` : 'null'}`;
    box.innerHTML = `
      <section class="conf-hero"><span aria-hidden="true">🤝</span><div><b>${tipo === 'grupo' ? 'Peça para alguém conferir este grupo' : 'Peça para alguém conferir só este lançamento'}</b><small>Quem recebe o link abre no celular, sem login, vê ${total === 1 ? 'o lançamento' : `os ${total} registros`}${tipo === 'grupo' ? '' : ' (com os subitens dele)'} e marca <b>CONFERIDO</b>. Quando tudo estiver conferido — ou o prazo acabar — o link expira sozinho.</small></div></section>
      ${link ? `<h4 class="conf-h">Link aberto agora</h4>${linkBox(gid, link, tipo, alvo)}<p class="conf-progress">✓ ${feitos} de ${total} conferidos até agora</p>` : tipo === 'grupo' && st.concluida ? `<p class="conf-ok">✓ Última conferência concluída em ${dBR(st.concluida.em)}${st.concluida.por ? ' por ' + esc(st.concluida.por) : ''}.</p>` : ''}
      <h4 class="conf-h">${link ? 'Ou gerar um link novo' : 'Gerar link'}</h4>
      <div class="conf-modes" role="radiogroup" aria-label="O que a pessoa pode fazer">
        <label class="conf-mode"><input type="radio" name="conf-modo" value="editar" checked><span><b>✏️ Editar e conferir</b><small>pode corrigir e marcar CONFERIDO (padrão)</small></span></label>
        <label class="conf-mode"><input type="radio" name="conf-modo" value="ver"><span><b>👁 Só visualizar</b><small>vê tudo, mas não altera nada</small></span></label>
      </div>
      ${window.linkOpcoesHtml('Sem prazo: o link vale até tudo ser conferido (ou até você encerrar).')}
      ${(link || feitos || (tipo === 'grupo' && st.concluida)) ? `<p class="conf-warn">⚠️ Um link novo encerra o anterior${tipo === 'grupo' ? '' : ' deste lançamento'} e tira o selo ✓: a conferência recomeça do zero.</p>` : ''}
      <div class="conf-foot"><button type="button" class="btn-action" onclick="closeModal()">Fechar</button><button type="button" class="btn-action primary conf-create" onclick="conferenciaGerar(${args})">🔗 ${link ? 'Gerar link novo' : 'Gerar link'}</button></div>`;
  };

  window.conferenciaGerar = async function (gid, tipo = 'grupo', alvo = null) {
    const root = document.querySelector('#modal-ov .conf-modal'), modo = root?.querySelector('input[name="conf-modo"]:checked')?.value || 'editar';
    const op = window.linkOpcoesLer(root); if (!op) return;
    const st = window.conferenciaStatus(gid), recs = subtree(tipo, alvo), jaTem = recs ? recs.some(r => conf(r)) : (st.feitos || st.ativo || st.concluida);
    if (jaTem && !confirm('Gerar um link novo? O link anterior para de funcionar e os lançamentos voltam para "aguardando conferência".')) return;
    const btn = root.querySelector('.conf-create'); if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }
    try {
      const {data, error} = await window.db.rpc('pms_share_create', {p_group: gid, p_modo: modo, p_alvo_tipo: tipo, p_alvo_id: alvo, p_horas: op.horas, p_pin: op.pin});
      if (error) throw error;
      await window.loadData?.();
      window.toast?.(`🔗 Link criado${op.pin ? ' com PIN' : ''}! Copie ou envie pelo WhatsApp.`, 'success');
      window.openActivity?.(gid); await window.openConferenciaLink(gid, tipo, alvo);
      return data;
    } catch (error) {
      window.toast?.('Não foi possível criar o link: ' + (window.friendlyDbError?.(error) || error.message || error), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🔗 Gerar link'; }
    }
  };
  window.conferenciaRevogar = async function (gid, id, tipo = 'grupo', alvo = null) {
    if (!confirm('Encerrar este link? Quem tiver o link não conseguirá mais abrir.')) return;
    try { const {error} = await window.db.rpc('pms_share_revoke', {p_id: id}); if (error) throw error; window.toast?.('⛔ Link encerrado.', 'success'); window.openConferenciaLink(gid, tipo, alvo); }
    catch (error) { window.toast?.('Não foi possível encerrar: ' + (window.friendlyDbError?.(error) || error.message || error), 'error'); }
  };
  window.conferenciaCopiar = async function (btn) {
    const input = btn.closest('.conf-url').querySelector('input');
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand?.('copy'); }
    btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1600);
  };
})();
