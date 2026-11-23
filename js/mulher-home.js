/* ── CASA LILÁS · página de entrada da SECRETARIA DA MULHER (23/11/2026) ──
 * Pedido do usuário: um layout TOTALMENTE diferente do resto do site, inovador, com neuroarquitetura,
 * super intuitivo e com sensação maravilhosa. Em vez da grade genérica de grupos, a secretaria abre num
 * espaço de acolhimento:
 *  • aurora lilás/pêssego/menta com uma flor desenhada à mão que "respira" (pausa com reduzir movimento);
 *  • saudação + frase de cuidado + 3 gestos principais: Acolher uma mulher, Registrar ocorrência, Encontrar ficha;
 *  • busca instantânea das fichas (nome, CPF, NIS, telefone, bairro) — toque abre a ficha;
 *  • "Pulso do cuidado" (em acompanhamento, medidas protetivas, ocorrências em 30 dias, retornos da semana);
 *  • agenda de retornos (atrasados em âmbar, nunca vermelho alarmante) e últimas ocorrências;
 *  • "Espaços" da secretaria em mosaico (os grupos), cada um com ícone, cor e frase próprios;
 *  • "Rede de apoio": telefones do último levantamento da rede (toque para ligar) + 180 e 190.
 * Modo clássico (grade de grupos com editar/transferir/excluir) continua a um toque. */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const S = () => window.S || {};
  const ef = r => { let e = r?.extra_fields; for (let i = 0; i < 2 && typeof e === 'string'; i++) { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const flag = (g, k) => { const e = ef(g); return Number(g?.[k] ?? e[k]) === 1 || g?.[k] === true || e[k] === true; };
  const val = (r, k) => { const v = window._efv ? window._efv(r, k) : (r?.[k] ?? ef(r)[k]); return v == null ? '' : v; };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dBR = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : ''; };
  const dias = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; const a = new Date(+m[1], +m[2] - 1, +m[3]), h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((a - h) / 864e5); };
  const arg = s => esc(JSON.stringify(String(s ?? '')));
  let classico = false, busca = '';

  const cadGroup = () => (S().secs || []).find(g => flag(g, 'mulher_cadastro'));
  // a secretaria da Mulher é a "casa" do grupo de cadastro das mulheres
  window.mulherSecretariaId = () => cadGroup()?.demanda_secretaria_id || (S().secretarias || []).find(s => /secretaria da mulher/i.test(s.name || ''))?.id || '';
  window.mulherHomeFor = id => !classico && !!id && id === window.mulherSecretariaId();
  window.mulherModoClassico = on => { classico = !!on; window.renderModulo?.('atendimentos');
    if (classico) requestAnimationFrame(() => document.querySelector('.demand-shell')?.insertAdjacentHTML('afterbegin', '<button type="button" class="mh-voltar" onclick="mulherModoClassico(false)">💜 Voltar para a página da Secretaria da Mulher</button>')); };
  window.mulherModoClassicoReset = () => { classico = false; };

  const ESPACOS = [
    [/cadastrad|mulher_cadastro/, '👩', 'Fichas, ocorrências e PDF com QR', 'rose', true],
    [/levantamento/, '🗺️', 'Mapa dos serviços da rede no município', 'mint', true],
    [/rede de prote/, '🤲', 'Parceiros que acolhem e protegem', 'sky'],
    [/monitorad/, '📡', 'Acompanhamento próximo e contínuo', 'lilac'],
    [/patrulha|maria da penha/, '🚓', 'Mulheres acompanhadas pela patrulha', 'peach'],
    [/atendiment/, '🗣️', 'Escuta, orientação e encaminhamento', 'sky'],
    [/curso/, '🎓', 'Autonomia e geração de renda', 'mint'],
    [/palestra|roda/, '💬', 'Rodas de conversa e prevenção', 'peach'],
    [/veicul/, '🚐', 'Agenda e uso do veículo', 'lilac'],
    [/pernambuco|acoes|ações/, '🌺', 'Ações com a Secretaria estadual', 'rose'],
    [/campo/, '📷', 'Registros de campo com foto', 'sky'],
  ];
  const espacoDe = g => { const t = norm(g.name) + (flag(g, 'mulher_cadastro') ? ' mulher_cadastro' : ''); return ESPACOS.find(([re]) => re.test(t)) || [null, '💜', 'Lançamentos desta área', 'lilac']; };

  // flor original: pétalas sobrepostas em gradiente (respira devagar)
  const flor = `<svg class="mh-flor" viewBox="0 0 220 220" aria-hidden="true" focusable="false"><defs>
      <radialGradient id="mhp1" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#f5d0fe"/><stop offset="1" stop-color="#a78bfa"/></radialGradient>
      <radialGradient id="mhp2" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#fed7aa"/><stop offset="1" stop-color="#f9a8d4"/></radialGradient>
      <radialGradient id="mhc" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#fcd34d"/></radialGradient></defs>
    <g transform="translate(110 112)">${[0, 60, 120, 180, 240, 300].map((a, i) => `<ellipse rx="30" ry="62" cy="-48" fill="url(#mhp${i % 2 + 1})" opacity=".82" transform="rotate(${a})"/>`).join('')}
      ${[30, 90, 150, 210, 270, 330].map(a => `<ellipse rx="18" ry="40" cy="-34" fill="#fff" opacity=".35" transform="rotate(${a})"/>`).join('')}
      <circle r="24" fill="url(#mhc)"/><circle r="24" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/></g>
    <path d="M110 170 C 104 190, 112 205, 100 218" stroke="#86efac" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M104 196 C 86 186, 74 190, 66 200 C 82 206, 96 204, 104 196Z" fill="#86efac"/></svg>`;

  window.renderMulherHome = function (secId) {
    const sec = (S().secretarias || []).find(s => s.id === secId);
    const grupos = (S().secs || []).filter(g => g.demanda_secretaria_id === secId && (S().isAdmin || window.userCanGroup?.(g, 'acesso')));
    const cad = grupos.find(g => flag(g, 'mulher_cadastro')), lev = grupos.find(g => flag(g, 'mulher_levantamento'));
    const mulheres = cad ? (S().items || []).filter(i => i.atividade_id === cad.id) : [];
    const ocs = cad ? (S().subitems || []).filter(s => s.atividade_id === cad.id || mulheres.some(m => m.id === s.item_id)) : [];
    const nomeDe = id => mulheres.find(m => m.id === id)?.description || '';
    const em = mulheres.filter(m => val(m, 'Situação do acompanhamento') !== 'Encerrado').length;
    const mp = mulheres.filter(m => ['Concedida', 'Solicitada'].includes(val(m, 'Medida protetiva'))).length;
    const lim = iso(new Date(Date.now() - 30 * 864e5));
    const oc30 = ocs.filter(o => String(val(o, 'Data') || o.created_at || '').slice(0, 10) >= lim).length;
    const retornos = ocs.map(o => ({o, d: dias(val(o, 'Próximo retorno'))})).filter(x => x.d != null && x.d <= 14 && x.d >= -30)
      // só o retorno mais recente de cada mulher conta (os antigos já foram atendidos)
      .filter(x => !ocs.some(o2 => o2.item_id === x.o.item_id && String(val(o2, 'Data') || '') > String(val(x.o, 'Data') || '')))
      .sort((a, b) => a.d - b.d);
    const semana = retornos.filter(x => x.d >= 0 && x.d <= 7).length, atrasados = retornos.filter(x => x.d < 0).length;
    const ultimas = [...ocs].sort((a, b) => String(val(b, 'Data') || b.created_at || '').localeCompare(String(val(a, 'Data') || a.created_at || ''))).slice(0, 5);
    const me = String(S().me?.display_name || '').split(/\s+/)[0], h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const hoje = new Date().toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'});
    const frase = atrasados ? `${atrasados} retorno${atrasados > 1 ? 's' : ''} passou da data — vale um contato carinhoso hoje.`
      : semana ? `${semana} retorno${semana > 1 ? 's' : ''} marcado${semana > 1 ? 's' : ''} para esta semana. Cada encontro conta.`
      : em ? `${em} mulher${em > 1 ? 'es' : ''} em acompanhamento. Cada registro aqui é uma história de cuidado.` : 'Este é o espaço de cuidado da Secretaria. Comece acolhendo a primeira mulher.';
    // rede de apoio (último levantamento)
    const levs = lev ? (S().items || []).filter(i => i.atividade_id === lev.id).sort((a, b) => String(ef(b).levantamento?.data || '').localeCompare(String(ef(a).levantamento?.data || ''))) : [];
    const rede = Object.values(ef(levs[0]).levantamento?.redes || {}).flat().filter(e => e.existe === 'SIM' && e.nome).slice(0, 8);
    const tel = t => String(t || '').replace(/\D/g, '');
    const podeCad = cad && (S().isAdmin || window.userCanGroup?.(cad, 'editar'));

    window.setC(`<div class="mh">
      <section class="mh-hero">
        <div class="mh-hero-txt"><span class="mh-date">${esc(hoje)}</span>
          <h1>${saud}${me ? ', ' + esc(me) : ''} <span aria-hidden="true">💜</span></h1>
          <p class="mh-lema">${esc(frase)}</p>
          <div class="mh-gestos">
            ${podeCad ? `<button type="button" class="mh-gesto is-main" onclick="mulherFicha(${arg(cad.id)})"><span aria-hidden="true">🤗</span><b>Acolher uma mulher</b><small>nova ficha em 4 passos</small></button>
            <button type="button" class="mh-gesto" onclick="mulherOcorrenciaRapida()"><span aria-hidden="true">🕊️</span><b>Registrar ocorrência</b><small>escolha a mulher e pronto</small></button>` : ''}
            ${cad ? `<button type="button" class="mh-gesto" onclick="openActivity(${arg(cad.id)})"><span aria-hidden="true">📖</span><b>Todas as fichas</b><small>${mulheres.length} cadastrada${mulheres.length === 1 ? '' : 's'}</small></button>` : ''}
          </div></div>
        <div class="mh-hero-art">${flor}</div>
      </section>
      ${cad ? `<section class="mh-find" role="search"><span aria-hidden="true">🔎</span><input type="search" id="mh-busca" value="${esc(busca)}" placeholder="Encontrar uma ficha: nome, CPF, NIS, telefone ou bairro" aria-label="Encontrar ficha" oninput="mulherHomeBusca(this.value)" autocomplete="off"><div class="mh-find-res" id="mh-find-res"></div></section>` : ''}
      <section class="mh-pulso" aria-label="Pulso do cuidado">
        ${[['🤝', em, 'em acompanhamento', 'lilac'], ['🛡️', mp, 'com medida protetiva', 'rose'], ['🕊️', oc30, 'ocorrências em 30 dias', 'sky'], ['📅', semana, 'retornos nesta semana', 'mint']].map(([i, n, l, t]) => `<div class="mh-bolha is-${t}"><span aria-hidden="true">${i}</span><b>${n}</b><small>${l}</small></div>`).join('')}
      </section>
      <div class="mh-duo">
        <section class="mh-painel"><header><h2>📅 Agenda de retornos</h2><small>próximos 14 dias</small></header>
          ${retornos.length ? `<ol class="mh-agenda">${retornos.slice(0, 8).map(x => `<li class="${x.d < 0 ? 'is-late' : x.d === 0 ? 'is-today' : ''}"><button type="button" onclick="mulherVer(${arg(cad.id)},${arg(x.o.item_id)})"><span class="mh-dia"><b>${dBR(val(x.o, 'Próximo retorno'))}</b><small>${x.d < 0 ? `há ${-x.d} d` : x.d === 0 ? 'hoje' : x.d === 1 ? 'amanhã' : `em ${x.d} d`}</small></span><span class="mh-ag-txt"><b>${esc(nomeDe(x.o.item_id))}</b><small>${esc(x.o.description || val(x.o, 'Tipo') || '')}</small></span></button></li>`).join('')}</ol>` : '<p class="mh-calma">🌿 Nenhum retorno marcado para os próximos dias.</p>'}
        </section>
        <section class="mh-painel"><header><h2>🕊️ Últimas ocorrências</h2><small>o que aconteceu por último</small></header>
          ${ultimas.length ? `<ol class="mh-ultimas">${ultimas.map(o => `<li><button type="button" onclick="mulherVer(${arg(cad.id)},${arg(o.item_id)})"><span class="mh-ponto" aria-hidden="true"></span><span><b>${esc(nomeDe(o.item_id))}</b><small>${esc(o.description || '')} · ${dBR(val(o, 'Data') || String(o.created_at || '').slice(0, 10))}</small></span></button></li>`).join('')}</ol>` : '<p class="mh-calma">Ainda não há ocorrências registradas.</p>'}
        </section>
      </div>
      <section class="mh-espacos"><header><h2>Espaços da Secretaria</h2><small>${grupos.length} áreas de trabalho</small></header>
        <div class="mh-mosaico">${grupos.map(g => { const [, ico, txt, tom, grande] = espacoDe(g), n = (S().items || []).filter(i => i.atividade_id === g.id).length;
          return `<button type="button" class="mh-espaco is-${tom} ${grande ? 'is-big' : ''}" onclick="openActivity(${arg(g.id)})"><span class="mh-esp-ico" aria-hidden="true">${ico}</span><b>${esc(g.name)}</b><small>${esc(txt)}</small><em>${n ? `${n} lançamento${n > 1 ? 's' : ''}` : 'vazio por enquanto'}</em></button>`; }).join('')}</div>
      </section>
      <section class="mh-rede"><header><h2>📞 Rede de apoio</h2><small>${rede.length ? 'do último levantamento da rede · toque para ligar' : 'preencha o levantamento da rede para ver os contatos aqui'}</small></header>
        <div class="mh-contatos">
          <a class="mh-contato is-urgente" href="tel:180"><b>180</b><small>Central de Atendimento à Mulher · 24h, gratuito</small></a>
          <a class="mh-contato is-urgente" href="tel:190"><b>190</b><small>Polícia Militar · emergência</small></a>
          ${rede.map(e => `<${tel(e.telefone) ? `a href="tel:${tel(e.telefone)}"` : 'span'} class="mh-contato"><b>${esc(e.nome)}</b><small>${esc([e.tipo, e.telefone].filter(Boolean).join(' · ') || 'sem telefone informado')}</small></${tel(e.telefone) ? 'a' : 'span'}>`).join('')}
          ${!rede.length && lev ? `<button type="button" class="mh-contato is-add" onclick="openActivity(${arg(lev.id)})"><b>🗺️ Levantamento da rede</b><small>abrir e preencher</small></button>` : ''}
        </div></section>
      <footer class="mh-rodape"><button type="button" onclick="mulherModoClassico(true)">▦ Ver em grade (modo clássico)</button>${window.userCanCreateGroups?.() && window.userCan?.('atendimentos', 'criar') ? `<button type="button" onclick="mulherModoClassico(true);setTimeout(()=>window.newDemandGroup?.(),60)">＋ Criar grupo</button>` : ''}<span>${esc(sec?.name || 'Secretaria da Mulher')} · Prefeitura de Sertânia</span></footer>
    </div>`);
    if (busca) window.mulherHomeBusca(busca);
  };
  window.mulherHomeBusca = function (q) {
    busca = q; const box = document.getElementById('mh-find-res'); if (!box) return;
    const cad = cadGroup(), t = norm(q).split(/\s+/).filter(Boolean);
    if (!t.length || !cad) { box.innerHTML = ''; return; }
    const lista = (S().items || []).filter(i => i.atividade_id === cad.id).filter(m => { const h = norm([m.description, val(m, 'Nome social'), val(m, 'CPF'), val(m, 'NIS'), val(m, 'Telefone'), val(m, 'Bairro / localidade')].join(' ')); return t.every(k => h.includes(k)); }).slice(0, 8);
    box.innerHTML = lista.length ? lista.map(m => `<button type="button" onclick="mulherVer(${arg(cad.id)},${arg(m.id)})"><span class="mu-av" aria-hidden="true">${esc(String(m.description || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase())}</span><span><b>${esc(m.description)}</b><small>${esc([val(m, 'Bairro / localidade'), val(m, 'Telefone')].filter(Boolean).join(' · '))}</small></span></button>`).join('') : '<p>Nenhuma ficha encontrada. <b>Que tal acolher?</b></p>';
  };
  // ocorrência rápida: escolher a mulher numa lista com busca e abrir o formulário
  window.mulherOcorrenciaRapida = function () {
    const cad = cadGroup(); if (!cad) return;
    window.openModal('🕊️ Registrar ocorrência', 'Para qual mulher?', `<div class="mh-pick"><input type="search" id="mh-pick-q" placeholder="🔍 Digite o nome, CPF ou bairro…" aria-label="Buscar mulher" autocomplete="off"><div id="mh-pick-list" class="mh-find-res is-static"></div></div>`);
    const inp = document.getElementById('mh-pick-q'), list = document.getElementById('mh-pick-list');
    const draw = () => { const t = norm(inp.value).split(/\s+/).filter(Boolean); const ms = (S().items || []).filter(i => i.atividade_id === cad.id).filter(m => !t.length || t.every(k => norm([m.description, val(m, 'CPF'), val(m, 'Bairro / localidade')].join(' ')).includes(k))).slice(0, 12);
      list.innerHTML = ms.map(m => `<button type="button" onclick="mulherOcorrencia(${arg(cad.id)},${arg(m.id)})"><span class="mu-av" aria-hidden="true">${esc(String(m.description || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase())}</span><span><b>${esc(m.description)}</b><small>${esc(val(m, 'Bairro / localidade') || '')}</small></span></button>`).join('') || '<p>Nenhuma ficha com esse nome. Cadastre primeiro em “Acolher uma mulher”.</p>'; };
    inp.addEventListener('input', draw); draw(); inp.focus();
  };
})();
