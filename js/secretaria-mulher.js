/* ── SECRETARIA DA MULHER (23/11/2026) — espaço próprio, com neuroarquitetura ──
 * Dois grupos da SECRETARIA DA MULHER ganham tela única (openActivity → renderMulher):
 *  • 👩 MULHERES CADASTRADAS  (extra_fields.mulher_cadastro = 1): ficha de cada mulher = item do grupo;
 *    cada OCORRÊNCIA = subitem da ficha. PDF da ficha com QR no cabeçalho e no rodapé que abre
 *    mulher.html?t=<mulher_token> (somente leitura: ficha + ocorrências, via função pms_mulher_publica).
 *  • 🗺️ LEVANTAMENTO DA REDE DE ENFRENTAMENTO (extra_fields.mulher_levantamento = 1): formulário do PDF
 *    "Levantamento da Rede de Enfrentamento e Atendimento à Mulher" (I a VIII), equipamentos por rede,
 *    "Existe no município? NÃO" recolhe o resto do equipamento; PDF com a mesma estrutura.
 * Campos ficam com nomes legíveis no extra_fields (aparecem também na lista, na busca e nos PDFs gerais);
 * mulher_token e levantamento (objeto) são internos.
 */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const S = () => window.S || {};
  const ef = r => { let e = r?.extra_fields; for (let i = 0; i < 2 && typeof e === 'string'; i++) { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const flag = (g, k) => { const e = ef(g); return Number(g?.[k] ?? e[k]) === 1 || g?.[k] === true || e[k] === true; };
  const groupOf = id => (S().secs || []).find(s => s.id === id);
  const val = (r, k) => { const v = window._efv ? window._efv(r, k) : (r?.[k] ?? ef(r)[k]); return v == null ? '' : v; };
  const arr = v => Array.isArray(v) ? v : String(v || '').split(/\s*,\s*/).filter(Boolean);
  const pad = n => String(n).padStart(2, '0');
  const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dBR = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };
  const idade = nasc => { const m = String(nasc || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; const h = new Date(), n = new Date(+m[1], +m[2] - 1, +m[3]); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return a >= 0 && a < 130 ? a : null; };
  const token = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const publicUrl = t => new URL('mulher.html?t=' + encodeURIComponent(t), location.href.split('#')[0].replace(/[^/]*$/, '')).href;
  const can = g => S().isAdmin || window.userCanGroup?.(g, 'editar');

  const isCad = g => flag(g, 'mulher_cadastro');
  const isLev = g => flag(g, 'mulher_levantamento');
  window.isMulherGroup = g => isCad(g) || isLev(g);
  const siblings = () => ({cad: (S().secs || []).find(isCad), lev: (S().secs || []).find(isLev)});

  // ── Campos da ficha (ordem = ordem do formulário, em 4 passos) ──
  const SIM_NAO = ['Não', 'Sim'];
  const FICHA = [
    {passo: '👤 Identificação', campos: [
      {k: 'Nome social', t: 'text'}, {k: 'Data de nascimento', t: 'date'}, {k: 'CPF', t: 'text', mode: 'numeric'}, {k: 'RG', t: 'text'}, {k: 'NIS', t: 'text', mode: 'numeric'},
      {k: 'Raça / cor', t: 'pills', o: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada']},
      {k: 'Estado civil', t: 'select', o: ['Solteira', 'Casada', 'União estável', 'Separada / divorciada', 'Viúva']},
      {k: 'Escolaridade', t: 'select', o: ['Sem escolaridade', 'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação']},
      {k: 'Pessoa com deficiência', t: 'pills', o: SIM_NAO}, {k: 'Qual deficiência', t: 'text', se: ['Pessoa com deficiência', 'Sim']}]},
    {passo: '📞 Contato e endereço', campos: [
      {k: 'Telefone', t: 'text', mode: 'tel'}, {k: 'Contato de confiança', t: 'text', dica: 'nome e telefone de alguém para recado'},
      {k: 'Endereço', t: 'text', full: true}, {k: 'Bairro / localidade', t: 'text'}, {k: 'Zona', t: 'pills', o: ['Urbana', 'Rural']}, {k: 'Ponto de referência', t: 'text'}]},
    {passo: '🏠 Vida e família', campos: [
      {k: 'Ocupação / trabalho', t: 'text'}, {k: 'Renda familiar', t: 'select', o: ['Sem renda', 'Até 1 salário mínimo', '1 a 2 salários', '2 a 3 salários', 'Mais de 3 salários']},
      {k: 'Benefícios', t: 'multi', o: ['Bolsa Família', 'BPC', 'Auxílio municipal', 'Outro', 'Nenhum']},
      {k: 'Número de filhos', t: 'text', mode: 'numeric'}, {k: 'Filhos menores de 18', t: 'text', mode: 'numeric'}, {k: 'Mora com', t: 'text'}]},
    {passo: '🛡️ Situação e rede de proteção', campos: [
      {k: 'Situação do acompanhamento', t: 'pills', o: ['Em acompanhamento', 'Encaminhada', 'Encerrado']},
      {k: 'Tipos de violência', t: 'multi', o: ['Física', 'Psicológica', 'Sexual', 'Patrimonial', 'Moral']},
      {k: 'Medida protetiva', t: 'pills', o: ['Não', 'Solicitada', 'Concedida', 'Vencida']},
      {k: 'Relação com o autor', t: 'select', o: ['Companheiro', 'Ex-companheiro', 'Namorado / ex-namorado', 'Familiar', 'Conhecido', 'Desconhecido', 'Outro']},
      {k: 'Encaminhamentos', t: 'multi', o: ['CRM', 'CREAS', 'CRAS', 'DEAM / Delegacia', 'Patrulha Maria da Penha', 'Defensoria Pública', 'Ministério Público', 'CAPS', 'Saúde / Hospital', 'Outros']},
      {k: 'Técnica de referência', t: 'text'}]},
  ];
  const OCORR = [{k: 'Data', t: 'date'}, {k: 'Tipo', t: 'pills', o: ['Atendimento', 'Acolhimento', 'Visita domiciliar', 'Encaminhamento', 'Medida protetiva', 'Boletim de ocorrência', 'Retorno', 'Outro']},
    {k: 'Profissional', t: 'text'}, {k: 'Encaminhado para', t: 'text'}, {k: 'Próximo retorno', t: 'date'}];
  const TIPO_ICO = {Atendimento: '🗣️', Acolhimento: '🤝', 'Visita domiciliar': '🏠', Encaminhamento: '➡️', 'Medida protetiva': '🛡️', 'Boletim de ocorrência': '📋', Retorno: '🔁', Outro: '📝'};

  // ── peças de formulário ──
  const fid = k => 'mf-' + norm(k).replace(/[^a-z0-9]+/g, '-');
  function input(c, v) {
    const id = fid(c.k), dk = `data-mk="${esc(c.k)}"`;
    if (c.t === 'pills') return `<div class="mu-pills" role="radiogroup" aria-label="${esc(c.k)}" ${dk} data-t="pills">${c.o.map(o => `<label><input type="radio" name="${id}" value="${esc(o)}" ${String(v) === o ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    if (c.t === 'multi') { const set = new Set(arr(v)); return `<div class="mu-pills is-multi" role="group" aria-label="${esc(c.k)}" ${dk} data-t="multi">${c.o.map(o => `<label><input type="checkbox" value="${esc(o)}" ${set.has(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`; }
    if (c.t === 'select') return `<select id="${id}" ${dk}><option value="">—</option>${c.o.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (c.t === 'textarea') return `<textarea id="${id}" ${dk} rows="3">${esc(v)}</textarea>`;
    return `<input id="${id}" ${dk} type="${c.t === 'date' ? 'date' : 'text'}" ${c.mode ? `inputmode="${c.mode}"` : ''} value="${esc(v)}" ${c.dica ? `placeholder="${esc(c.dica)}"` : ''}>`;
  }
  // grupo de opções (pílulas) não pode ficar dentro de <label> (HTML inválido e clique duplo): vira <div>
  const field = (c, v) => { const tag = c.t === 'pills' || c.t === 'multi' ? 'div' : 'label'; return `<${tag} class="mu-f ${c.full || c.t === 'multi' || c.t === 'textarea' ? 'is-full' : ''}" ${c.se ? `data-se="${esc(c.se[0])}" data-se-v="${esc(c.se[1])}"` : ''}><span>${esc(c.k)}</span>${input(c, v)}</${tag}>`; };
  function collect(root) {
    const out = {};
    root.querySelectorAll('[data-mk]').forEach(el => {
      const k = el.dataset.mk;
      if (el.dataset.t === 'pills') out[k] = el.querySelector('input:checked')?.value || '';
      else if (el.dataset.t === 'multi') out[k] = [...el.querySelectorAll('input:checked')].map(i => i.value);
      else out[k] = el.value.trim();
    });
    return out;
  }
  // campos condicionais (ex.: "Qual deficiência" só com "Sim") — revelação progressiva
  function bindConditional(root) {
    const upd = () => root.querySelectorAll('[data-se]').forEach(l => { const src = root.querySelector(`[data-mk="${CSS.escape(l.dataset.se)}"]`); const cur = src?.querySelector('input:checked')?.value ?? src?.value; l.hidden = cur !== l.dataset.seV; });
    root.addEventListener('change', upd); upd();
  }

  // ── dados ──
  const mulheres = gid => (S().items || []).filter(i => i.atividade_id === gid).sort((a, b) => String(a.description || '').localeCompare(String(b.description || ''), 'pt-BR'));
  const ocorrencias = item => (S().subitems || []).filter(s => s.item_id === item.id).sort((a, b) => String(val(b, 'Data') || b.created_at || '').localeCompare(String(val(a, 'Data') || a.created_at || '')));
  const ultima = item => ocorrencias(item)[0];
  const st = {};

  // ════════════ CADASTRO DAS MULHERES ════════════
  function renderCad(gid) {
    const g = groupOf(gid), list = mulheres(gid), s = st[gid] ||= {q: '', f: 'todas'};
    const em = list.filter(m => val(m, 'Situação do acompanhamento') !== 'Encerrado');
    const mp = list.filter(m => ['Concedida', 'Solicitada'].includes(val(m, 'Medida protetiva')));
    const lim = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const oc30 = list.flatMap(ocorrencias).filter(o => String(val(o, 'Data') || o.created_at || '').slice(0, 10) >= lim);
    const filtro = m => (s.f === 'todas' || s.f === 'acomp' && val(m, 'Situação do acompanhamento') !== 'Encerrado' || s.f === 'medida' && ['Concedida', 'Solicitada'].includes(val(m, 'Medida protetiva')) || s.f === 'encerradas' && val(m, 'Situação do acompanhamento') === 'Encerrado')
      && (!s.q || norm([m.description, val(m, 'Nome social'), val(m, 'CPF'), val(m, 'Telefone'), val(m, 'Bairro / localidade'), val(m, 'NIS')].join(' ')).includes(norm(s.q)));
    const vis = list.filter(filtro), sib = siblings(), nome = String(S().me?.display_name || '').split(/\s+/)[0];
    const h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const kpi = (cls, ico, l, v, sub, f) => `<button type="button" class="mu-kpi ${cls} ${s.f === f ? 'on' : ''}" onclick="mulherFiltro('${gid}','${f}')"><span aria-hidden="true">${ico}</span><b>${v}</b><small>${l}${sub ? ' · ' + sub : ''}</small></button>`;
    window.setC(`<div class="mu">
      ${tabs(sib, 'cad')}
      <section class="mu-hero"><div><span class="mu-hello">${saud}${nome ? ', ' + esc(nome) : ''} 💜</span>
        <h2>${list.length ? `${em.length} mulher${em.length === 1 ? '' : 'es'} em acompanhamento` : 'Vamos cadastrar a primeira mulher?'}</h2>
        <p>${list.length ? `${oc30.length ? `${oc30.length} ocorrência(s) registradas nos últimos 30 dias` : 'Nenhuma ocorrência nos últimos 30 dias'}${mp.length ? ` · ${mp.length} com medida protetiva` : ''}. Cada ficha tem o histórico completo e um PDF com QR.` : 'Toque em “＋ Cadastrar mulher”: o formulário é dividido em 4 passos curtos.'}</p></div>
        ${can(g) ? `<button type="button" class="mu-cta" onclick="mulherFicha('${gid}')">＋ Cadastrar mulher</button>` : ''}</section>
      <div class="mu-kpis">${kpi('', '👩', 'cadastradas', list.length, '', 'todas')}${kpi('is-teal', '🤝', 'em acompanhamento', em.length, '', 'acomp')}${kpi('is-amber', '🛡️', 'com medida protetiva', mp.length, '', 'medida')}${kpi('is-calm', '✔️', 'encerrados', list.length - em.length, '', 'encerradas')}</div>
      <div class="mu-tools"><input type="search" id="mu-busca" value="${esc(s.q)}" placeholder="🔍 Buscar por nome, CPF, NIS, telefone ou bairro…" aria-label="Buscar mulher" oninput="mulherBusca('${gid}',this.value)"><span class="mu-count">${vis.length} de ${list.length}</span></div>
      <section class="mu-list">${vis.map(m => linha(gid, m)).join('') || `<p class="mu-empty">${list.length ? 'Nenhuma ficha com esse filtro.' : '💜 Ainda não há mulheres cadastradas.'}</p>`}</section>
    </div>`);
    const b = document.getElementById('mu-busca'); if (s.focus && b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); s.focus = false; }
  }
  function tabs(sib, atual) {
    if (!sib.cad || !sib.lev) return '';
    return `<nav class="mu-tabs" aria-label="Secretaria da Mulher"><button type="button" class="${atual === 'cad' ? 'on' : ''}" onclick="openActivity('${sib.cad.id}')">👩 Mulheres cadastradas</button><button type="button" class="${atual === 'lev' ? 'on' : ''}" onclick="openActivity('${sib.lev.id}')">🗺️ Levantamento da rede</button></nav>`;
  }
  function linha(gid, m) {
    const ini = String(m.description || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(), a = idade(val(m, 'Data de nascimento')), u = ultima(m), n = ocorrencias(m).length;
    const sit = val(m, 'Situação do acompanhamento'), med = val(m, 'Medida protetiva');
    return `<article class="mu-row ${sit === 'Encerrado' ? 'is-closed' : ''}" data-id="${esc(m.id)}">
      <button type="button" class="mu-row-main" onclick="mulherVer('${gid}','${esc(m.id)}')">
        <span class="mu-av" aria-hidden="true">${esc(ini)}</span>
        <span class="mu-row-txt"><b>${esc(m.description || 'Sem nome')}${val(m, 'Nome social') ? ` <i>(${esc(val(m, 'Nome social'))})</i>` : ''}</b>
          <small>${[a != null ? a + ' anos' : '', val(m, 'Bairro / localidade'), val(m, 'Telefone')].filter(Boolean).map(esc).join(' · ') || 'Ficha sem detalhes ainda'}</small></span>
        <span class="mu-chips">${sit ? `<em class="c-${norm(sit).split(' ')[0]}">${esc(sit)}</em>` : ''}${['Concedida', 'Solicitada'].includes(med) ? `<em class="c-medida">🛡️ ${esc(med)}</em>` : ''}<em class="c-oc">${n ? `${n} ocorrência${n > 1 ? 's' : ''}${u ? ' · última ' + dBR(val(u, 'Data') || u.created_at) : ''}` : 'sem ocorrências'}</em></span>
      </button>
      ${can(groupOf(gid)) ? `<button type="button" class="mu-row-add" onclick="mulherOcorrencia('${gid}','${esc(m.id)}')" title="Registrar ocorrência">＋ Ocorrência</button>` : ''}
    </article>`;
  }
  window.mulherFiltro = (gid, f) => { st[gid].f = st[gid].f === f && f !== 'todas' ? 'todas' : f; renderCad(gid); };
  let buscaT; window.mulherBusca = (gid, q) => { clearTimeout(buscaT); buscaT = setTimeout(() => { st[gid].q = q; st[gid].focus = true; renderCad(gid); }, 220); };

  // ficha (criar/editar)
  window.mulherFicha = function (gid, id) {
    const m = id ? (S().items || []).find(i => i.id === id) : null;
    const html = `<form class="mu-form" onsubmit="return false">
      <label class="mu-f is-full mu-nome"><span>Nome completo *</span><input type="text" id="mu-nome" value="${esc(m?.description || '')}" autocomplete="off" required></label>
      ${FICHA.map((p, i) => `<fieldset class="mu-step"><legend><i>${i + 1}</i>${p.passo}</legend><div class="mu-grid">${p.campos.map(c => field(c, m ? val(m, c.k) : '')).join('')}</div></fieldset>`).join('')}
      <fieldset class="mu-step"><legend><i>📝</i>Observações</legend><div class="mu-grid"><label class="mu-f is-full"><span>Observações gerais</span><textarea id="mu-obs" rows="3">${esc(m?.observacao || '')}</textarea></label></div></fieldset>
      <div class="mu-foot"><button type="button" class="btn-action" onclick="closeModal()">Cancelar</button><button type="button" class="btn-action primary" id="mu-salvar" onclick="mulherSalvar('${gid}','${esc(id || '')}')">💾 ${m ? 'Salvar alterações' : 'Cadastrar'}</button></div>
    </form>`;
    window.openModal(m ? '✏️ Editar ficha' : '💜 Cadastrar mulher', 'Secretaria da Mulher', html);
    const root = document.querySelector('#modal-ov .mu-form'); bindConditional(root); document.getElementById('mu-nome')?.focus();
  };
  window.mulherSalvar = async function (gid, id) {
    const root = document.querySelector('#modal-ov .mu-form'), nome = document.getElementById('mu-nome').value.trim();
    if (nome.length < 3) { window.toast('Informe o nome completo.', 'error'); document.getElementById('mu-nome').focus(); return; }
    const m = id ? (S().items || []).find(i => i.id === id) : null, campos = collect(root);
    Object.keys(campos).forEach(k => { if (Array.isArray(campos[k]) ? !campos[k].length : campos[k] === '') delete campos[k]; });
    const base = m ? ef(m) : {};
    FICHA.flatMap(p => p.campos).forEach(c => { if (!(c.k in campos)) delete base[c.k]; });
    const extra = {...base, ...campos, mulher_token: base.mulher_token || token()};
    const btn = document.getElementById('mu-salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      let novoId = id;
      if (m) await window.updateDoc(window.doc(window.db, 'items', id), {description: nome, observacao: document.getElementById('mu-obs').value.trim(), extra_fields: extra, updated_at: window.serverTimestamp()});
      else { const r = await window.addDoc(window.collection(window.db, 'items'), {atividade_id: gid, description: nome, observacao: document.getElementById('mu-obs').value.trim(), extra_fields: extra, item_icon: '💜', item_color: '#7c3aed', order_num: mulheres(gid).length, concluded: 0, created_at: window.serverTimestamp()}); novoId = r.id; }
      await window.loadData(); window.closeModal();
      window.toast(m ? '💾 Ficha atualizada.' : '💜 Mulher cadastrada! Agora você pode registrar ocorrências.', 'success');
      window.openActivity(gid); if (novoId) window.mulherVer(gid, novoId);
    } catch (e) { window.toast('Não foi possível salvar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error'); btn.disabled = false; btn.textContent = '💾 Salvar'; }
  };

  // ver ficha + linha do tempo
  window.mulherVer = function (gid, id) {
    const m = (S().items || []).find(i => i.id === id); if (!m) return;
    const a = idade(val(m, 'Data de nascimento')), oc = ocorrencias(m), g = groupOf(gid), pode = can(g);
    const blocos = FICHA.map(p => { const rows = p.campos.map(c => [c.k, val(m, c.k)]).filter(([, v]) => Array.isArray(v) ? v.length : String(v).trim()); return rows.length ? `<section class="mu-sec"><h4>${p.passo}</h4><dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join(', ') : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dBR(v) + (k === 'Data de nascimento' && a != null ? ` (${a} anos)` : '') : v)}</dd></div>`).join('')}</dl></section>` : ''; }).join('');
    const html = `<div class="mu-ficha">
      <header class="mu-ficha-head"><span class="mu-av lg" aria-hidden="true">${esc(String(m.description || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase())}</span>
        <div><h3>${esc(m.description)}</h3><small>${[a != null ? a + ' anos' : '', val(m, 'Bairro / localidade'), val(m, 'Telefone')].filter(Boolean).map(esc).join(' · ')}</small></div></header>
      <div class="mu-actions">${pode ? `<button type="button" class="btn-action primary" onclick="mulherOcorrencia('${gid}','${esc(id)}')">＋ Ocorrência</button><button type="button" class="btn-action" onclick="mulherFicha('${gid}','${esc(id)}')">✏️ Editar ficha</button>` : ''}
        <button type="button" class="btn-action" onclick="mulherCompartilhar('${gid}','${esc(id)}','pdf')">📄 PDF com QR</button>
        <button type="button" class="btn-action" onclick="mulherCompartilhar('${gid}','${esc(id)}','link')">🔗 Criar link</button>
        ${pode && window.userCanDeleteItems?.() ? `<button type="button" class="btn-action mu-del" onclick="deleteItem('${esc(id)}',false)">🗑️</button>` : ''}</div>
      ${blocos || '<p class="mu-empty">Ficha sem detalhes — toque em ✏️ Editar ficha para completar.</p>'}
      ${m.observacao ? `<section class="mu-sec"><h4>📝 Observações</h4><p>${esc(m.observacao)}</p></section>` : ''}
      <section class="mu-sec"><h4>🕊️ Ocorrências <em>${oc.length}</em></h4>${oc.length ? `<ol class="mu-tl">${oc.map(o => ocItem(gid, m, o, pode)).join('')}</ol>` : '<p class="mu-empty">Nenhuma ocorrência registrada ainda.</p>'}</section>
    </div>`;
    window.openModal('💜 Ficha', 'Secretaria da Mulher · Mulheres cadastradas', html);
  };
  function ocItem(gid, m, o, pode) {
    const tipo = val(o, 'Tipo') || 'Registro';
    return `<li class="mu-tl-i"><span class="mu-tl-ico" aria-hidden="true">${TIPO_ICO[tipo] || '📝'}</span><div>
      <header><b>${esc(o.description || tipo)}</b><small>${dBR(val(o, 'Data') || String(o.created_at || '').slice(0, 10))}${val(o, 'Profissional') ? ' · ' + esc(val(o, 'Profissional')) : ''}</small></header>
      ${o.observacao ? `<p>${esc(o.observacao)}</p>` : ''}
      <small class="mu-tl-meta">${[val(o, 'Tipo') ? '🏷️ ' + esc(val(o, 'Tipo')) : '', val(o, 'Encaminhado para') ? '➡️ ' + esc(val(o, 'Encaminhado para')) : '', val(o, 'Próximo retorno') ? '🔁 retorno ' + dBR(val(o, 'Próximo retorno')) : ''].filter(Boolean).join(' · ')}</small>
      ${pode ? `<div class="mu-tl-act"><button type="button" onclick="mulherOcorrencia('${gid}','${esc(m.id)}','${esc(o.id)}')">✏️ Editar</button>${window.userCanDeleteItems?.() ? `<button type="button" onclick="deleteItem('${esc(o.id)}',true)">🗑️</button>` : ''}</div>` : ''}</div></li>`;
  }

  // ocorrência
  window.mulherOcorrencia = function (gid, mid, oid) {
    const m = (S().items || []).find(i => i.id === mid), o = oid ? (S().subitems || []).find(s => s.id === oid) : null;
    const html = `<form class="mu-form" onsubmit="return false">
      <p class="mu-for">Para <b>${esc(m?.description || '')}</b></p>
      <label class="mu-f is-full"><span>Título *</span><input type="text" id="mo-tit" value="${esc(o?.description || '')}" placeholder="ex.: Atendimento psicossocial, Solicitação de medida protetiva…"></label>
      <div class="mu-grid">${OCORR.map(c => field(c, o ? val(o, c.k) : c.k === 'Data' ? hojeIso() : c.k === 'Profissional' ? (S().me?.display_name || '') : '')).join('')}
      <label class="mu-f is-full"><span>Relato / o que foi feito</span><textarea id="mo-rel" rows="4">${esc(o?.observacao || '')}</textarea></label></div>
      <div class="mu-foot"><button type="button" class="btn-action" onclick="mulherVer('${gid}','${esc(mid)}')">Voltar</button><button type="button" class="btn-action primary" id="mo-salvar" onclick="mulherSalvarOcorrencia('${gid}','${esc(mid)}','${esc(oid || '')}')">💾 Salvar ocorrência</button></div></form>`;
    window.openModal(o ? '✏️ Editar ocorrência' : '＋ Nova ocorrência', 'Secretaria da Mulher', html);
    document.getElementById('mo-tit')?.focus();
  };
  window.mulherSalvarOcorrencia = async function (gid, mid, oid) {
    const root = document.querySelector('#modal-ov .mu-form'), campos = collect(root), tipo = campos.Tipo;
    const tit = document.getElementById('mo-tit').value.trim() || tipo;
    if (!tit) { window.toast('Dê um título ou escolha o tipo da ocorrência.', 'error'); return; }
    Object.keys(campos).forEach(k => { if (campos[k] === '') delete campos[k]; });
    const o = oid ? (S().subitems || []).find(s => s.id === oid) : null, base = o ? ef(o) : {};
    OCORR.forEach(c => { if (!(c.k in campos)) delete base[c.k]; });
    const btn = document.getElementById('mo-salvar'); btn.disabled = true;
    try {
      const data = {description: tit, observacao: document.getElementById('mo-rel').value.trim(), extra_fields: {...base, ...campos}, updated_at: window.serverTimestamp()};
      if (o) await window.updateDoc(window.doc(window.db, 'subitems', oid), data);
      else await window.addDoc(window.collection(window.db, 'subitems'), {...data, atividade_id: gid, item_id: mid, parent_type: 'item', parent_id: mid, order_num: (S().subitems || []).filter(s => s.item_id === mid).length, concluded: 0, created_at: window.serverTimestamp()});
      await window.loadData(); window.toast('🕊️ Ocorrência salva.', 'success'); window.openActivity(gid); window.mulherVer(gid, mid);
    } catch (e) { window.toast('Não foi possível salvar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error'); btn.disabled = false; }
  };
  // ── compartilhar a ficha (somente leitura): validade e PIN opcionais; serve para o link e para o QR do PDF ──
  async function linksDaFicha(gid, id) {
    try { const {data} = await window.db.from('share_links').select('id,token,created_at,expires_at,pin_hash,visits,created_by_name').eq('atividade_id', gid).eq('alvo_tipo', 'mulher').eq('alvo_id', id).is('revoked_at', null).order('created_at', {ascending: false}).limit(6);
      return (data || []).filter(l => !l.expires_at || new Date(l.expires_at) > new Date()); } catch { return []; }
  }
  window.mulherCompartilhar = async function (gid, id, modo) {
    const m = (S().items || []).find(i => i.id === id); if (!m) return;
    const pdf = modo === 'pdf';
    window.openModal(pdf ? '📄 PDF da ficha com QR' : '🔗 Link da ficha (somente leitura)', esc(m.description), `<div class="mu-share">
      <section class="mu-share-hero"><span aria-hidden="true">${pdf ? '📄' : '🔗'}</span><div><b>${pdf ? 'O QR do cabeçalho e do rodapé abre esta ficha' : 'Quem abrir o link vê a ficha e as ocorrências'}</b><small>Somente leitura — ninguém consegue alterar nada pelo link. Escolha por quanto tempo ele vale e, se quiser, um PIN.</small></div></section>
      ${window.linkOpcoesHtml?.('Sem prazo: vale até você encerrar.') || ''}
      <div class="mu-share-out" hidden></div>
      <div class="mu-share-ativos"></div>
      <div class="mu-foot"><button type="button" class="btn-action" onclick="mulherVer('${gid}','${esc(id)}')">← Voltar à ficha</button><button type="button" class="btn-action primary" id="mu-share-go" onclick="mulherGerarLink('${gid}','${esc(id)}','${modo}')">${pdf ? '📄 Gerar PDF' : '🔗 Gerar link'}</button></div></div>`);
    const ativos = await linksDaFicha(gid, id), box = document.querySelector('#modal-ov .mu-share-ativos');
    if (box && ativos.length) box.innerHTML = `<h4 class="conf-h">Links abertos desta ficha</h4><ul class="mu-share-list">${ativos.map(l => `<li><span>${l.pin_hash ? '🔒 ' : ''}criado em ${new Date(l.created_at).toLocaleDateString('pt-BR')} · ${esc(window.linkValidadeTexto?.(l.expires_at) || '')} · ${l.visits || 0} acesso(s)</span><button type="button" class="btn-action" onclick="mulherCopiarLink('${esc(l.token)}',this)">📋 Copiar</button><button type="button" class="btn-action conf-revoke" onclick="mulherEncerrarLink('${gid}','${esc(id)}','${l.id}','${modo}')">⛔ Encerrar</button></li>`).join('')}</ul>`;
  };
  window.mulherGerarLink = async function (gid, id, modo) {
    const root = document.querySelector('#modal-ov .mu-share'), op = window.linkOpcoesLer?.(root) || {horas: null, pin: null}; if (!op) return;
    const btn = document.getElementById('mu-share-go'); btn.disabled = true; btn.textContent = 'Gerando…';
    let t = null;
    try { const {data, error} = await window.db.rpc('pms_share_create', {p_group: gid, p_modo: 'ver', p_alvo_tipo: 'mulher', p_alvo_id: id, p_horas: op.horas, p_pin: op.pin}); if (error) throw error; t = data?.token; }
    catch (e) {
      if (op.horas || op.pin) { window.toast('Não foi possível criar o link: ' + (window.friendlyDbError?.(e) || e.message || e), 'error'); btn.disabled = false; btn.textContent = modo === 'pdf' ? '📄 Gerar PDF' : '🔗 Gerar link'; return; }
      t = ef((S().items || []).find(i => i.id === id)).mulher_token; // sem internet para criar: usa o QR permanente da ficha
    }
    if (modo === 'pdf') { await window.mulherPdf(gid, id, t, op); window.mulherVer(gid, id); return; }
    const url = publicUrl(t), msg = encodeURIComponent(`Ficha (somente leitura) — Secretaria da Mulher de Sertânia:\n${url}${op.pin ? '\n(o PIN será informado separadamente)' : ''}`);
    const out = root.querySelector('.mu-share-out'); out.hidden = false;
    out.innerHTML = `<div class="mu-share-card">${window.qrSvg?.(url, 156) || ''}<div><span class="conf-chip is-time">⏳ ${esc(window.linkValidadeTexto?.(op.horas ? new Date(Date.now() + op.horas * 3600e3) : null) || '')}</span>${op.pin ? ' <span class="conf-chip is-pin">🔒 com PIN</span>' : ''}
      <div class="conf-url"><input type="text" readonly value="${esc(url)}" onclick="this.select()" aria-label="Link da ficha"><button type="button" class="btn-action primary" onclick="conferenciaCopiar(this)">📋 Copiar</button></div>
      <div class="conf-actions"><a class="btn-action conf-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${msg}">📱 WhatsApp</a></div></div></div>`;
    btn.disabled = false; btn.textContent = '🔗 Gerar outro link';
    window.toast('🔗 Link criado!', 'success');
  };
  window.mulherEncerrarLink = async function (gid, id, linkId, modo) {
    if (!confirm('Encerrar este link? Quem tiver o link (ou o QR impresso dele) não conseguirá mais abrir a ficha.')) return;
    try { const {error} = await window.db.rpc('pms_share_revoke', {p_id: linkId}); if (error) throw error; window.toast('⛔ Link encerrado.', 'success'); window.mulherCompartilhar(gid, id, modo); }
    catch (e) { window.toast('Não foi possível encerrar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error'); }
  };
  window.mulherCopiarLink = async function (t, btn) {
    const url = publicUrl(t); try { await navigator.clipboard.writeText(url); } catch { prompt('Copie o link:', url); }
    if (btn) { btn.textContent = '✓ Link copiado'; setTimeout(() => { btn.textContent = '🔗 Link de leitura'; }, 1800); }
  };

  // ── QR desenhado direto no PDF (vetor: nítido em qualquer impressão) ──
  function drawQr(doc, text, x, y, size) {
    if (!window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = size / (n + 2);
    doc.setFillColor(255, 255, 255); doc.rect(x, y, size, size, 'F'); doc.setFillColor(46, 16, 101);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(x + (c + 1) * cell, y + (r + 1) * cell, cell + .02, cell + .02, 'F');
  }
  const LIL = [124, 58, 237], INK = [46, 16, 101], TXT = [33, 37, 63], MUT = [91, 97, 128], SOFT = [245, 243, 255];

  window.mulherPdf = async function (gid, id, tokenLink, op = {}) {
    const m = (S().items || []).find(i => i.id === id); if (!m) return;
    if (!window.jspdf?.jsPDF) { window.toast('Gerador de PDF não carregado.', 'error'); return; }
    let t = tokenLink || ef(m).mulher_token;
    if (!t) { t = token(); try { await window.updateDoc(window.doc(window.db, 'items', id), {extra_fields: {...ef(m), mulher_token: t}}); await window.loadData(); } catch { /* segue sem salvar */ } }
    const qrNota = [op.horas ? `QR válido até ${new Date(Date.now() + op.horas * 3600e3).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}` : 'QR sem prazo', op.pin ? 'protegido por PIN' : ''].filter(Boolean).join(' · ');
    const url = publicUrl(t), {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'mm', format: 'a4'}); window.safePdf?.(doc);
    const W = 210, H = 297, mx = 12, cw = W - mx * 2, oc = ocorrencias(m), a = idade(val(m, 'Data de nascimento'));
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    const header = () => {
      doc.setFillColor(...SOFT); doc.rect(0, 0, W, 30, 'F'); doc.setFillColor(...LIL); doc.rect(0, 0, 3.5, 30, 'F');
      if (logo?.d) doc.addImage(logo.d, 'PNG', mx, 5, 13, 17, undefined, 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...LIL); doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA · SECRETARIA DA MULHER', mx + 17, 9);
      doc.setFontSize(14); doc.setTextColor(...INK); const nm = doc.splitTextToSize(String(m.description || '').toUpperCase(), cw - 17 - 30); doc.text(nm[0], mx + 17, 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text([`Ficha de acompanhamento${a != null ? ' · ' + a + ' anos' : ''}${val(m, 'Situação do acompanhamento') ? ' · ' + val(m, 'Situação do acompanhamento') : ''}`, `Emitido em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} · ${qrNota}`], mx + 17, 21.5);
      drawQr(doc, url, W - mx - 24, 3, 24);
      return 36;
    };
    let y = header();
    // situação em uma frase
    const med = val(m, 'Medida protetiva'), sit = val(m, 'Situação do acompanhamento');
    const frase = [`${oc.length} ocorrência(s) registrada(s)`, med && med !== 'Não' ? `medida protetiva: ${med.toLowerCase()}` : '', arr(val(m, 'Encaminhamentos')).length ? `encaminhada para ${arr(val(m, 'Encaminhamentos')).join(', ')}` : ''].filter(Boolean).join(' · ');
    doc.setFillColor(...SOFT); doc.roundedRect(mx, y, cw, 11, 2, 2, 'F'); doc.setFillColor(...LIL); doc.roundedRect(mx, y, 1.6, 11, .8, .8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(sit || 'Acompanhamento', mx + 5, y + 4.6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(...TXT); doc.text(doc.splitTextToSize(frase, cw - 10)[0], mx + 5, y + 8.8);
    y += 15;
    const P = window.ccnPdf?.table || {};
    for (const p of FICHA) {
      const rows = p.campos.map(c => [c.k, val(m, c.k)]).filter(([, v]) => Array.isArray(v) ? v.length : String(v).trim()).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dBR(v) : String(v)]);
      if (!rows.length) continue;
      const body = []; for (let i = 0; i < rows.length; i += 2) body.push([rows[i][0], rows[i][1], rows[i + 1]?.[0] || '', rows[i + 1]?.[1] || '']);
      if (y > H - 40) { doc.addPage(); y = header(); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(p.passo.replace(/^\S+\s/, '').toUpperCase(), mx, y + 3.5); y += 5;
      doc.autoTable({...P, startY: y, margin: {left: mx, right: mx, top: 36, bottom: 30}, theme: 'grid', body, styles: {fontSize: 8.4, cellPadding: 1.6, textColor: TXT, lineColor: [226, 222, 245], lineWidth: .15, overflow: 'linebreak'},
        columnStyles: {0: {cellWidth: 34, fontStyle: 'bold', textColor: MUT, fillColor: [250, 249, 255]}, 1: {cellWidth: cw / 2 - 34}, 2: {cellWidth: 34, fontStyle: 'bold', textColor: MUT, fillColor: [250, 249, 255]}, 3: {cellWidth: 'auto'}},
        didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) header(); }});
      y = doc.lastAutoTable.finalY + 5;
    }
    if (m.observacao) { if (y > H - 40) { doc.addPage(); y = header(); } doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text('OBSERVAÇÕES', mx, y + 3.5); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...TXT); const l = doc.splitTextToSize(m.observacao, cw); doc.text(l, mx, y + 8.5); y += 9 + l.length * 3.8; }
    if (y > H - 50) { doc.addPage(); y = header(); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(`OCORRÊNCIAS (${oc.length})`, mx, y + 3.5); y += 5;
    if (oc.length) doc.autoTable({startY: y, margin: {left: mx, right: mx, top: 36, bottom: 30}, theme: 'grid', head: [['Data', 'Ocorrência', 'Tipo', 'Relato', 'Profissional / encaminhamento']],
      body: oc.map(o => [dBR(val(o, 'Data') || String(o.created_at || '').slice(0, 10)), o.description || '', val(o, 'Tipo') || '—', o.observacao || '', [val(o, 'Profissional'), val(o, 'Encaminhado para') ? '→ ' + val(o, 'Encaminhado para') : '', val(o, 'Próximo retorno') ? 'Retorno ' + dBR(val(o, 'Próximo retorno')) : ''].filter(Boolean).join('\n')]),
      headStyles: {fillColor: LIL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8}, styles: {fontSize: 8, cellPadding: 1.6, textColor: TXT, lineColor: [226, 222, 245], lineWidth: .15, overflow: 'linebreak', valign: 'top'},
      alternateRowStyles: {fillColor: [250, 249, 255]}, columnStyles: {0: {cellWidth: 19}, 1: {cellWidth: 36, fontStyle: 'bold'}, 2: {cellWidth: 26}, 3: {cellWidth: 'auto'}, 4: {cellWidth: 40}},
      didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) header(); }});
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...MUT); doc.text('Nenhuma ocorrência registrada.', mx, y + 4); }
    const pages = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= pages; pg++) {
      doc.setPage(pg); doc.setFillColor(...SOFT); doc.rect(0, H - 24, W, 24, 'F'); doc.setFillColor(...LIL); doc.rect(0, H - 24, W, .8, 'F');
      drawQr(doc, url, mx, H - 22, 20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(`Escaneie para ver esta ficha e todas as ocorrências (somente leitura)${op.pin ? ' — pede PIN' : ''}`, mx + 24, H - 15);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...MUT); doc.text(`${qrNota} · Documento com dados pessoais e sensíveis (LGPD) — guarde em local seguro.`, mx + 24, H - 10.5);
      doc.text(`Página ${pg} de ${pages}`, W - mx, H - 5, {align: 'right'}); doc.text('Prefeitura Municipal de Sertânia · Gestão de Atividades', mx + 24, H - 5);
    }
    const slug = String(m.description || 'ficha').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    doc.save(`FICHA-${slug}.pdf`);
    window.toast('📄 PDF da ficha gerado com QR.', 'success');
  };

  // ════════════ LEVANTAMENTO DA REDE ════════════
  const REDES = [
    {k: 'centros', t: 'III. Centros de referência e serviços especializados', o: ['CRM', 'Centro Especializado', 'Outro Equipamento Especializado']},
    {k: 'seguranca', t: 'IV. Rede de segurança pública', o: ['DEAM', 'Delegacia de Polícia Civil', 'Polícia Militar / Patrulha Maria da Penha', 'Outro']},
    {k: 'justica', t: 'V. Rede de justiça e garantia de direitos', o: ['Ministério Público', 'Defensoria Pública', 'Poder Judiciário / Vara Especializada', 'Orientação Jurídica']},
    {k: 'assistencia', t: 'VI. Rede de assistência social', o: ['CRAS', 'CREAS', 'Serviço de Acolhimento / Proteção', 'Outro Socioassistencial']},
    {k: 'saude', t: 'VII. Rede de saúde', o: ['Hospital / UPA', 'Atendimento à Vítima de Violência Sexual', 'Atenção Psicossocial (CAPS)']},
    {k: 'parceiras', t: 'VIII. Organizações e instituições parceiras', o: ['Sociedade Civil / Coletivo', 'Universidade', 'Entidade Comunitária', 'Outra Parceira']},
  ];
  const EQ = [['nome', 'Nome da instituição / equipamento', 'full'], ['endereco', 'Endereço completo', 'full'], ['telefone', 'Telefone institucional'], ['email', 'E-mail'], ['responsavel', 'Nome do(a) responsável'], ['horario', 'Horário de funcionamento'], ['servicos', 'Serviços oferecidos', 'full'], ['publico', 'Público atendido', 'full']];
  const SIT_EQ = ['Em funcionamento', 'Parcial / Com limitações'];
  const levOf = r => { const l = ef(r).levantamento; return l && typeof l === 'object' ? l : {}; };
  const existentes = l => REDES.reduce((n, r) => n + (l.redes?.[r.k] || []).filter(e => e.existe === 'SIM').length, 0);

  function renderLev(gid) {
    const g = groupOf(gid), list = [...(S().items || []).filter(i => i.atividade_id === gid)].sort((a, b) => String(levOf(b).data || '').localeCompare(String(levOf(a).data || ''))), sib = siblings(), ult = list[0];
    window.setC(`<div class="mu">
      ${tabs(sib, 'lev')}
      <section class="mu-hero is-lev"><div><span class="mu-hello">🗺️ Mapeamento dos equipamentos e serviços municipais</span>
        <h2>${ult ? `Último levantamento: ${dBR(levOf(ult).data)}` : 'Levantamento da rede de enfrentamento'}</h2>
        <p>${ult ? `${existentes(levOf(ult))} equipamento(s) existentes mapeados em ${esc(levOf(ult).municipio || 'Sertânia')}. Abra para atualizar ou gere o PDF.` : 'Preencha o formulário do levantamento (organismo de políticas para as mulheres e as redes de atendimento). Fica tudo guardado e pronto para imprimir.'}</p></div>
        ${can(g) ? `<button type="button" class="mu-cta" onclick="levForm('${gid}')">＋ Novo levantamento</button>` : ''}</section>
      <section class="mu-list">${list.map(r => { const l = levOf(r); return `<article class="mu-row"><button type="button" class="mu-row-main" onclick="levForm('${gid}','${esc(r.id)}')"><span class="mu-av lev" aria-hidden="true">🗺️</span><span class="mu-row-txt"><b>${esc(r.description || 'Levantamento')}</b><small>${esc(l.municipio || '')} · preenchido em ${dBR(l.data)} · ${existentes(l)} equipamento(s) existente(s)</small></span>
        <span class="mu-chips">${REDES.map(rd => { const n = (l.redes?.[rd.k] || []).filter(e => e.existe === 'SIM').length; return n ? `<em class="c-oc">${esc(rd.t.replace(/^[IVX]+\.\s*/, '').replace(/^Rede de /, ''))}: ${n}</em>` : ''; }).join('')}</span></button>
        <button type="button" class="mu-row-add" onclick="levPdf('${gid}','${esc(r.id)}')">📄 PDF</button></article>`; }).join('') || '<p class="mu-empty">🗺️ Nenhum levantamento ainda.</p>'}</section>
    </div>`);
  }
  const radios = (name, opts, cur, extra = '') => `<div class="mu-pills" role="radiogroup">${opts.map(o => `<label><input type="radio" name="${name}" value="${esc(o)}" ${cur === o ? 'checked' : ''} ${extra}><span>${esc(o)}</span></label>`).join('')}</div>`;
  let eqSeq = 0;
  function eqBlock(rede, e = {}) {
    const n = 'eq' + (++eqSeq), ex = e.existe || '';
    return `<div class="lv-eq" data-rede="${rede.k}" data-n="${n}">
      <div class="lv-eq-top"><span class="lv-eq-lbl">Equipamento / serviço</span><button type="button" class="lv-eq-del" onclick="this.closest('.lv-eq').remove()" title="Remover">✕</button></div>
      <div class="mu-f is-full"><span>Tipo de serviço</span>${radios(n + '-tipo', [...rede.o, ...(rede.o.some(o => /^Outr/.test(o)) ? [] : ['Outro'])], e.tipo || '')}</div>
      <label class="mu-f lv-outro" ${/^Outr/.test(e.tipo || '') ? '' : 'hidden'}><span>Qual?</span><input type="text" data-q="tipo_outro" value="${esc(e.tipo_outro || '')}"></label>
      <div class="mu-f is-full"><span>Existe no município?</span>${radios(n + '-existe', ['SIM', 'NÃO'], ex)}</div>
      <div class="lv-eq-body mu-grid" ${ex === 'NÃO' ? 'hidden' : ''}>
        ${EQ.map(([k, l, full]) => `<label class="mu-f ${full ? 'is-full' : ''}"><span>${l}</span>${k === 'servicos' || k === 'publico' ? `<textarea data-q="${k}" rows="2">${esc(e[k] || '')}</textarea>` : `<input type="text" data-q="${k}" value="${esc(e[k] || '')}" ${k === 'telefone' ? 'inputmode="tel"' : k === 'email' ? 'inputmode="email"' : ''}>`}</label>`).join('')}
        <div class="mu-f is-full"><span>Situação de funcionamento</span>${radios(n + '-sit', SIT_EQ, e.situacao || '')}</div>
      </div></div>`;
  }
  window.levAddEq = (k, btn) => { const rede = REDES.find(r => r.k === k); btn.insertAdjacentHTML('beforebegin', eqBlock(rede)); };
  window.levForm = function (gid, id) {
    const r = id ? (S().items || []).find(i => i.id === id) : null, l = r ? levOf(r) : {}, o = l.ompm || {}, ro = !can(groupOf(gid));
    const html = `<form class="mu-form lv-form" onsubmit="return false" ${ro ? 'inert' : ''}>
      <fieldset class="mu-step"><legend><i>I</i>Identificação do município</legend><div class="mu-grid">
        <label class="mu-f"><span>Nome do município</span><input type="text" id="lv-mun" value="${esc(l.municipio || 'Sertânia - PE')}"></label>
        <label class="mu-f"><span>Data do preenchimento / atualização</span><input type="date" id="lv-data" value="${esc(l.data || hojeIso())}"></label></div></fieldset>
      <fieldset class="mu-step"><legend><i>II</i>Organismo municipal de políticas para as mulheres (OMPM)</legend><div class="mu-grid lv-ompm">
        <div class="mu-f is-full"><span>Tipo de organismo</span>${radios('lv-ompm-tipo', ['Secretaria', 'Coordenadoria', 'Diretoria', 'Outro'], o.tipo || '')}</div>
        <label class="mu-f lv-outro" ${o.tipo === 'Outro' ? '' : 'hidden'}><span>Qual?</span><input type="text" data-o="tipo_outro" value="${esc(o.tipo_outro || '')}"></label>
        ${[['nome', 'Nome oficial do órgão / secretaria', 1], ['gestora', 'Nome da gestora / responsável'], ['endereco', 'Endereço completo', 1], ['telefone', 'Telefone institucional'], ['email', 'E-mail'], ['horario', 'Horário de atendimento']].map(([k, lb, f]) => `<label class="mu-f ${f ? 'is-full' : ''}"><span>${lb}</span><input type="text" data-o="${k}" value="${esc(o[k] || '')}"></label>`).join('')}
        <div class="mu-f is-full"><span>Situação de funcionamento</span>${radios('lv-ompm-sit', ['Ativo / Em funcionamento', 'Inativo / Sem funcionamento'], o.situacao || '')}</div></div></fieldset>
      ${REDES.map(rd => `<fieldset class="mu-step lv-rede" data-rede="${rd.k}"><legend><i>${rd.t.split('.')[0]}</i>${esc(rd.t.replace(/^[IVX]+\.\s*/, ''))}</legend><p class="lv-hint">Marque os equipamentos existentes no município e preencha as informações.</p>
        ${(l.redes?.[rd.k]?.length ? l.redes[rd.k] : [{}]).map(e => eqBlock(rd, e)).join('')}
        ${ro ? '' : `<button type="button" class="lv-add" onclick="levAddEq('${rd.k}',this)">＋ Adicionar equipamento</button>`}</fieldset>`).join('')}
      <div class="mu-foot"><button type="button" class="btn-action" onclick="closeModal()">Fechar</button>${id ? `<button type="button" class="btn-action" onclick="levPdf('${gid}','${esc(id)}')">📄 PDF</button>` : ''}${ro ? '' : `<button type="button" class="btn-action primary" id="lv-salvar" onclick="levSalvar('${gid}','${esc(id || '')}')">💾 Salvar levantamento</button>`}</div></form>`;
    window.openModal('🗺️ Levantamento da rede de enfrentamento e atendimento à mulher', 'Mapeamento dos equipamentos e serviços municipais', html);
    const root = document.querySelector('#modal-ov .lv-form');
    root.addEventListener('change', e => {
      const t = e.target; if (t.type !== 'radio') return;
      if (/-existe$/.test(t.name)) t.closest('.lv-eq').querySelector('.lv-eq-body').hidden = t.value === 'NÃO';
      if (/-tipo$/.test(t.name) || t.name === 'lv-ompm-tipo') { const box = t.closest('.lv-eq') || t.closest('.lv-ompm'); box.querySelector('.lv-outro').hidden = !/^Outr/.test(t.value); }
    });
  };
  function levCollect(root) {
    const o = {tipo: root.querySelector('input[name="lv-ompm-tipo"]:checked')?.value || '', situacao: root.querySelector('input[name="lv-ompm-sit"]:checked')?.value || ''};
    root.querySelectorAll('[data-o]').forEach(i => { o[i.dataset.o] = i.value.trim(); });
    const redes = {};
    REDES.forEach(rd => { redes[rd.k] = [...root.querySelectorAll(`.lv-eq[data-rede="${rd.k}"]`)].map(b => { const n = b.dataset.n, e = {tipo: b.querySelector(`input[name="${n}-tipo"]:checked`)?.value || '', existe: b.querySelector(`input[name="${n}-existe"]:checked`)?.value || '', situacao: b.querySelector(`input[name="${n}-sit"]:checked`)?.value || ''}; b.querySelectorAll('[data-q]').forEach(i => { e[i.dataset.q] = i.value.trim(); }); return e; }).filter(e => Object.values(e).some(v => v)); });
    return {municipio: root.querySelector('#lv-mun').value.trim(), data: root.querySelector('#lv-data').value, ompm: o, redes};
  }
  window.levSalvar = async function (gid, id) {
    const root = document.querySelector('#modal-ov .lv-form'), l = levCollect(root), r = id ? (S().items || []).find(i => i.id === id) : null;
    const desc = `Levantamento da rede — ${l.municipio || 'Município'} — ${dBR(l.data)}`;
    const extra = {...(r ? ef(r) : {}), levantamento: l, 'Município': l.municipio, 'Data do preenchimento': l.data, 'Equipamentos existentes': String(existentes(l)), 'Organismo (OMPM)': [l.ompm.tipo === 'Outro' ? l.ompm.tipo_outro : l.ompm.tipo, l.ompm.nome].filter(Boolean).join(' · ')};
    const btn = document.getElementById('lv-salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      if (r) await window.updateDoc(window.doc(window.db, 'items', id), {description: desc, extra_fields: extra, updated_at: window.serverTimestamp()});
      else await window.addDoc(window.collection(window.db, 'items'), {atividade_id: gid, description: desc, extra_fields: extra, item_icon: '🗺️', item_color: '#7c3aed', order_num: 0, concluded: 0, created_at: window.serverTimestamp()});
      await window.loadData(); window.closeModal(); window.toast('🗺️ Levantamento salvo!', 'success'); window.openActivity(gid);
    } catch (e) { window.toast('Não foi possível salvar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error'); btn.disabled = false; btn.textContent = '💾 Salvar levantamento'; }
  };
  window.levPdf = async function (gid, id) {
    const r = (S().items || []).find(i => i.id === id); if (!r) return;
    const l = levOf(r), o = l.ompm || {}, {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'mm', format: 'a4'}); window.safePdf?.(doc);
    const W = 210, H = 297, mx = 12, cw = W - mx * 2;
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    const header = () => { doc.setFillColor(...SOFT); doc.rect(0, 0, W, 20, 'F'); doc.setFillColor(...LIL); doc.rect(0, 0, 3.5, 20, 'F'); if (logo?.d) doc.addImage(logo.d, 'PNG', W - mx - 11, 3, 10, 13, undefined, 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...INK); doc.text('LEVANTAMENTO DA REDE DE ENFRENTAMENTO E ATENDIMENTO À MULHER', mx, 9);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text(`Mapeamento dos equipamentos e serviços municipais · ${l.municipio || ''} · preenchido em ${dBR(l.data)}`, mx, 14.5); return 25; };
    let y = header();
    const sec = t => { if (y > H - 30) { doc.addPage(); y = header(); } doc.setFillColor(...LIL); doc.roundedRect(mx, y, 1.4, 5, .6, .6, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(t.toUpperCase(), mx + 3.5, y + 3.9); y += 7; };
    const kv = rows => { const body = []; rows = rows.filter(([, v]) => String(v || '').trim()); for (let i = 0; i < rows.length; i += 2) body.push([rows[i][0], rows[i][1], rows[i + 1]?.[0] || '', rows[i + 1]?.[1] || '']); if (!body.length) return;
      doc.autoTable({startY: y, margin: {left: mx, right: mx, top: 25, bottom: 14}, theme: 'grid', body, styles: {fontSize: 8.2, cellPadding: 1.5, textColor: TXT, lineColor: [226, 222, 245], lineWidth: .15, overflow: 'linebreak'},
        columnStyles: {0: {cellWidth: 36, fontStyle: 'bold', textColor: MUT, fillColor: [250, 249, 255]}, 1: {cellWidth: cw / 2 - 36}, 2: {cellWidth: 36, fontStyle: 'bold', textColor: MUT, fillColor: [250, 249, 255]}, 3: {cellWidth: 'auto'}}, didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) header(); }});
      y = doc.lastAutoTable.finalY + 4; };
    sec('I. Identificação do município'); kv([['Município', l.municipio], ['Data do preenchimento', dBR(l.data)]]);
    sec('II. Organismo municipal de políticas para as mulheres (OMPM)');
    kv([['Tipo de organismo', o.tipo === 'Outro' ? `Outro: ${o.tipo_outro || ''}` : o.tipo], ['Situação', o.situacao], ['Nome oficial', o.nome], ['Gestora / responsável', o.gestora], ['Endereço', o.endereco], ['Telefone', o.telefone], ['E-mail', o.email], ['Horário de atendimento', o.horario]]);
    for (const rd of REDES) {
      sec(rd.t); const eqs = l.redes?.[rd.k] || [];
      if (!eqs.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(...MUT); doc.text('Nenhum equipamento informado.', mx, y + 2); y += 6; continue; }
      eqs.forEach((e, i) => { if (y > H - 30) { doc.addPage(); y = header(); } doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(...LIL);
        doc.text(`Equipamento / serviço #${i + 1}${e.nome ? ' — ' + e.nome : ''}${e.existe ? '   ·   Existe no município: ' + e.existe : ''}`, mx, y + 2.6); y += 4;
        kv(e.existe === 'NÃO' ? [['Tipo de serviço', /^Outr/.test(e.tipo) && e.tipo_outro ? `${e.tipo}: ${e.tipo_outro}` : e.tipo]] : [['Tipo de serviço', /^Outr/.test(e.tipo) && e.tipo_outro ? `${e.tipo}: ${e.tipo_outro}` : e.tipo], ['Situação', e.situacao], ...EQ.map(([k, lb]) => [lb, e[k]])]); });
    }
    const pages = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= pages; pg++) { doc.setPage(pg); doc.setFillColor(...INK); doc.rect(0, H - 8, W, 8, 'F'); doc.setTextColor(237, 233, 254); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text('PREFEITURA MUNICIPAL DE SERTÂNIA · SECRETARIA DA MULHER', mx, H - 3.2); doc.text(`Página ${pg} de ${pages}`, W - mx, H - 3.2, {align: 'right'}); }
    doc.save(`LEVANTAMENTO-REDE-MULHER-${String(l.data || hojeIso())}.pdf`);
  };

  window.renderMulher = gid => isLev(groupOf(gid)) ? renderLev(gid) : renderCad(gid);
})();
