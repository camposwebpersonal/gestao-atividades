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

  async function linkAtivo(gid) {
    try {
      const {data} = await window.db.from('share_links').select('id,token,modo,created_at,created_by_name,visits,last_visit_at').eq('atividade_id', gid).is('revoked_at', null).is('finished_at', null).order('created_at', {ascending: false}).limit(1);
      return data?.[0] || null;
    } catch { return null; }
  }

  function linkBox(gid, link) {
    const url = linkUrl(link.token), msg = encodeURIComponent(`Olá! Segue o link para ${link.modo === 'ver' ? 'visualizar' : 'conferir'} os lançamentos de "${groupOf(gid)?.name || ''}":\n${url}`);
    return `<div class="conf-linkbox">
      <div class="conf-linkbox-head"><span class="conf-chip ${link.modo === 'ver' ? 'is-view' : 'is-edit'}">${link.modo === 'ver' ? '👁 Só visualizar' : '✏️ Pode editar e conferir'}</span><small>criado em ${dBR(link.created_at)} ${hora(link.created_at)}${link.created_by_name ? ' por ' + esc(link.created_by_name) : ''} · ${link.visits || 0} acesso(s)</small></div>
      <div class="conf-url"><input type="text" readonly value="${esc(url)}" aria-label="Link de conferência" onclick="this.select()"><button type="button" class="btn-action primary" onclick="conferenciaCopiar(this)">📋 Copiar</button></div>
      <div class="conf-actions"><a class="btn-action conf-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${msg}">📱 Enviar pelo WhatsApp</a><a class="btn-action" target="_blank" rel="noopener" href="${esc(url)}">↗ Abrir como visitante</a><button type="button" class="btn-action conf-revoke" onclick="conferenciaRevogar('${gid}','${link.id}')">⛔ Encerrar este link</button></div>
    </div>`;
  }

  window.openConferenciaLink = async function (gid) {
    const g = groupOf(gid); if (!g) return;
    window.openModal('🔗 Link de conferência', esc(g.name), '<div class="conf-modal"><p class="conf-loading">Carregando…</p></div>');
    const link = await linkAtivo(gid), st = window.conferenciaStatus(gid);
    const box = document.querySelector('#modal-ov .conf-modal'); if (!box) return;
    box.innerHTML = `
      <section class="conf-hero"><span aria-hidden="true">🤝</span><div><b>Peça para alguém conferir este grupo</b><small>Quem recebe o link abre no celular, sem login, vê os ${st.total} lançamento(s) e marca cada um como <b>CONFERIDO</b>. Quando tudo estiver conferido, o link expira sozinho.</small></div></section>
      ${link ? `<h4 class="conf-h">Link aberto agora</h4>${linkBox(gid, link)}<p class="conf-progress">✓ ${st.feitos} de ${st.total} conferidos até agora</p>` : st.concluida ? `<p class="conf-ok">✓ Última conferência concluída em ${dBR(st.concluida.em)}${st.concluida.por ? ' por ' + esc(st.concluida.por) : ''}.</p>` : ''}
      <h4 class="conf-h">${link ? 'Ou gerar um link novo' : 'Gerar link'}</h4>
      <div class="conf-modes" role="radiogroup" aria-label="O que a pessoa pode fazer">
        <label class="conf-mode"><input type="radio" name="conf-modo" value="editar" checked><span><b>✏️ Editar e conferir</b><small>pode corrigir os lançamentos e marcar CONFERIDO (padrão)</small></span></label>
        <label class="conf-mode"><input type="radio" name="conf-modo" value="ver"><span><b>👁 Só visualizar</b><small>vê tudo, mas não altera nada</small></span></label>
      </div>
      ${(link || st.feitos || st.concluida) ? '<p class="conf-warn">⚠️ Um link novo encerra o anterior e tira o selo ✓ de todos os lançamentos: a conferência recomeça do zero.</p>' : ''}
      <div class="conf-foot"><button type="button" class="btn-action" onclick="closeModal()">Fechar</button><button type="button" class="btn-action primary conf-create" onclick="conferenciaGerar('${gid}')">🔗 ${link ? 'Gerar link novo' : 'Gerar link'}</button></div>`;
  };

  window.conferenciaGerar = async function (gid) {
    const modo = document.querySelector('input[name="conf-modo"]:checked')?.value || 'editar';
    const st = window.conferenciaStatus(gid);
    if ((st.feitos || st.ativo || st.concluida) && !confirm('Gerar um link novo? O link anterior para de funcionar e todos os lançamentos voltam para "aguardando conferência".')) return;
    const btn = document.querySelector('.conf-create'); if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }
    try {
      const {data, error} = await window.db.rpc('pms_share_create', {p_group: gid, p_modo: modo});
      if (error) throw error;
      await window.loadData?.();
      window.toast?.('🔗 Link criado! Copie ou envie pelo WhatsApp.', 'success');
      window.openActivity?.(gid); await window.openConferenciaLink(gid);
      return data;
    } catch (error) {
      window.toast?.('Não foi possível criar o link: ' + (window.friendlyDbError?.(error) || error.message || error), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🔗 Gerar link'; }
    }
  };
  window.conferenciaRevogar = async function (gid, id) {
    if (!confirm('Encerrar este link? Quem tiver o link não conseguirá mais abrir.')) return;
    try { const {error} = await window.db.rpc('pms_share_revoke', {p_id: id}); if (error) throw error; window.toast?.('⛔ Link encerrado.', 'success'); window.openConferenciaLink(gid); }
    catch (error) { window.toast?.('Não foi possível encerrar: ' + (window.friendlyDbError?.(error) || error.message || error), 'error'); }
  };
  window.conferenciaCopiar = async function (btn) {
    const input = btn.closest('.conf-url').querySelector('input');
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand?.('copy'); }
    btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1600);
  };
})();
