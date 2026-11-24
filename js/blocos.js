/* ── BLOCOS: cada página de lançamento escolhe o que aparece (pedido do usuário, 24/11/2026) ──
 * "Quero editar a parte visual de cada local de lançamento: cada coisa é um módulo e eu desativo o que não quero
 *  naquele local." Por padrão, Saudação ("Bom dia"), "Precisa de atenção" e "Últimos lançamentos" ficam DESLIGADOS em
 *  todo o site (a Casa Lilás da Secretaria da Mulher fica como está).
 * Configuração compartilhada (vale para todos os usuários) em app_settings id='blocos':
 *   {paginas: {'sec:<id>': {off:[...], on:[...], ordem:[...]}, 'praca': {...}, 'grp:<id>': {...}}}
 * Só administradores gravam (RLS da tabela); os demais só veem o resultado. */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const arg = s => esc(JSON.stringify(String(s ?? '')));
  const TIPOS = {
    secretaria: [
      {id: 'saudacao', ico: '🌅', nome: 'Saudação e ilustração', desc: '"Bom dia", frase do dia e a ilustração viva do mundo', on: false},
      {id: 'gestos', ico: '👆', nome: 'Atalhos grandes', desc: 'Novo lançamento, Registro de campo, atrasados', on: true},
      {id: 'busca', ico: '🔎', nome: 'Busca desta página', desc: 'Encontrar lançamentos só desta secretaria', on: true},
      {id: 'pulso', ico: '📊', nome: 'Números (pulso)', desc: 'Em andamento, atrasados, concluídos, espaços', on: true},
      {id: 'atencao', ico: '⏰', nome: 'Precisa de atenção', desc: 'Prazos vencidos e desta semana', on: false},
      {id: 'ultimos', ico: '🕊️', nome: 'Últimos lançamentos', desc: 'O que chegou por último', on: false},
      {id: 'espacos', ico: '🧭', nome: 'Espaços (grupos)', desc: 'Mosaico com os grupos de lançamento', on: true, fixo: true},
      {id: 'rodape', ico: '▦', nome: 'Rodapé', desc: 'Modo clássico (grade) e Criar grupo', on: true},
    ],
    praca: [
      {id: 'saudacao', ico: '🌅', nome: 'Saudação e céu do dia', desc: '"Bom dia", céu que acompanha a hora e frase', on: false},
      {id: 'pulso', ico: '📊', nome: 'Números da cidade', desc: 'Em andamento, atrasados e concluídos', on: true},
      {id: 'campo', ico: '📷', nome: 'Atalho de campo', desc: '"Viu uma demanda? Registre agora"', on: true},
      {id: 'mapa', ico: '🗺️', nome: 'Mapa geral', desc: 'Atalho para as demandas no mapa', on: true},
      {id: 'secretarias', ico: '🏛️', nome: 'Secretarias', desc: 'Cartões de acesso a cada secretaria', on: true, fixo: true},
    ],
    grupo: [
      {id: 'selo', ico: '🏷️', nome: 'Selo do mundo', desc: 'Faixa "🌾 Roça Viva · SECRETARIA…" acima do título', on: true},
      {id: 'pipa', ico: '💧', nome: 'Painel do pipa', desc: 'Controle de reabastecimento (vencidos, em dia…)', on: true, so: '.pipa-group-bar'},
      {id: 'resumo', ico: '📊', nome: 'Fichas de resumo', desc: 'Concluídos, pendentes, atrasados, progresso', on: true},
      {id: 'selecao', ico: '☑️', nome: 'Barra "Selecionar todos"', desc: 'Concluir/excluir vários de uma vez', on: true},
    ],
  };
  const reg = () => (window.S?.appSettings || []).find(r => r.id === 'blocos');
  const paginas = () => { let v = reg()?.value; try { if (typeof v === 'string') v = JSON.parse(v); } catch { v = {}; } return {...(v?.paginas || {})}; };
  const tipoDe = key => key === 'praca' ? 'praca' : key.startsWith('grp:') ? 'grupo' : 'secretaria';

  /** Configuração efetiva de uma página: ordem e quais blocos estão ligados. */
  window.uvBlocos = function (key) {
    const defs = TIPOS[tipoDe(key)], c = paginas()[key] || {};
    const ids = defs.map(d => d.id), ordem = [...(c.ordem || []).filter(id => ids.includes(id)), ...ids.filter(id => !(c.ordem || []).includes(id))];
    const on = new Set(defs.filter(d => d.fixo || (c.on || []).includes(d.id) || (d.on && !(c.off || []).includes(d.id))).map(d => d.id));
    return {ordem, on, liga: id => on.has(id), defs, personalizado: !!paginas()[key]};
  };
  window.uvPodeEditar = () => !!window.S?.isAdmin;

  const salvar = async (key, cfg) => {
    const pg = paginas(); if (cfg) pg[key] = cfg; else delete pg[key];
    const value = {paginas: pg};
    const S = window.S; const row = reg();
    if (row) row.value = value; else (S.appSettings ||= []).push({id: 'blocos', value});
    // a tela muda NA HORA (otimista); a gravação no banco segue em segundo plano
    if (salvar.depois) { const f = salvar.depois; salvar.depois = null; f(); }
    try { await window.setDoc(window.doc(window.db, 'appSettings', 'blocos'), {value, updated_at: window.serverTimestamp?.(), updated_by: S.user?.uid || null}); return true; }
    catch (e) { console.error('[blocos]', e); window.toast?.('Não foi possível salvar a personalização: ' + (window.friendlyDbError?.(e) || e.message), 'error'); return false; }
  };
  const cfgDe = (key, b) => { const defs = TIPOS[tipoDe(key)]; return {ordem: b.ordem, off: defs.filter(d => !b.on.has(d.id)).map(d => d.id), on: defs.filter(d => b.on.has(d.id)).map(d => d.id)}; };

  let atual = null; // {key, titulo, redesenhar}
  const linhas = () => {
    const b = window.uvBlocos(atual.key); const presentes = atual.presentes;
    return b.ordem.map((id, k) => { const d = b.defs.find(x => x.id === id); if (presentes && d.so && !presentes(d.so)) return '';
      const on = b.on.has(id), ordem = tipoDe(atual.key) !== 'grupo';
      return `<li class="bk-item${on ? ' is-on' : ''}" data-bloco="${id}"><span class="bk-ico" aria-hidden="true">${d.ico}</span><span class="bk-txt"><b>${esc(d.nome)}</b><small>${esc(d.desc)}${d.fixo ? ' · sempre visível' : ''}</small></span>
        ${ordem ? `<span class="bk-ord"><button type="button" aria-label="Subir ${esc(d.nome)}" ${k === 0 ? 'disabled' : ''} onclick="uvBlocosMover(${arg(id)},-1)">▲</button><button type="button" aria-label="Descer ${esc(d.nome)}" ${k === b.ordem.length - 1 ? 'disabled' : ''} onclick="uvBlocosMover(${arg(id)},1)">▼</button></span>` : ''}
        <label class="bk-sw${d.fixo ? ' is-fixo' : ''}"><input type="checkbox" ${on ? 'checked' : ''} ${d.fixo ? 'disabled' : ''} onchange="uvBlocosLigar(${arg(id)},this.checked)" aria-label="Mostrar ${esc(d.nome)}"><i aria-hidden="true"></i></label></li>`; }).join('');
  };
  const pintar = () => { const ul = document.getElementById('bk-lista'); if (ul) ul.innerHTML = linhas(); const n = document.getElementById('bk-estado'); if (n) { const b = window.uvBlocos(atual.key); n.textContent = `${b.on.size} de ${b.defs.length} blocos visíveis`; } };
  const aplicar = async (b) => { salvar.depois = () => { pintar(); atual.redesenhar?.(); }; const ok = await salvar(atual.key, cfgDe(atual.key, b)); const s = document.getElementById('bk-salvo'); if (s && ok) { s.textContent = '✓ Salvo para todos'; s.classList.add('on'); clearTimeout(aplicar.t); aplicar.t = setTimeout(() => s.classList.remove('on'), 1400); } };
  window.uvBlocosLigar = (id, on) => { const b = window.uvBlocos(atual.key); on ? b.on.add(id) : b.on.delete(id); aplicar(b); };
  window.uvBlocosMover = (id, dir) => { const b = window.uvBlocos(atual.key); const i = b.ordem.indexOf(id), j = i + dir; if (j < 0 || j >= b.ordem.length) return; [b.ordem[i], b.ordem[j]] = [b.ordem[j], b.ordem[i]]; aplicar(b); };
  window.uvBlocosPadrao = async () => { salvar.depois = () => { pintar(); atual.redesenhar?.(); }; await salvar(atual.key, null); };
  window.uvBlocosFoco = async () => { const b = window.uvBlocos(atual.key); b.defs.forEach(d => { if (!d.fixo) b.on.delete(d.id); }); ['gestos', 'busca', 'campo'].forEach(id => b.defs.some(d => d.id === id) && b.on.add(id)); aplicar(b); };
  window.uvBlocosTodos = async () => { const b = window.uvBlocos(atual.key); b.defs.forEach(d => b.on.add(d.id)); aplicar(b); };
  window.uvBlocosEmTodas = async () => {
    if (!confirm('Aplicar esta mesma escolha de blocos em TODAS as secretarias? (a Casa Lilás da Mulher não muda)')) return;
    const cfg = cfgDe(atual.key, window.uvBlocos(atual.key)), pg = paginas();
    (window.S.secretarias || []).forEach(s => { pg['sec:' + s.id] = {...cfg}; });
    const value = {paginas: pg}; const row = reg(); if (row) row.value = value; else window.S.appSettings.push({id: 'blocos', value});
    try { await window.setDoc(window.doc(window.db, 'appSettings', 'blocos'), {value, updated_at: window.serverTimestamp?.(), updated_by: window.S.user?.uid || null}); window.toast?.('Aplicado em todas as secretarias ✨', 'success'); } catch (e) { window.toast?.('Não foi possível salvar.', 'error'); }
  };

  /** Abre o painel "Personalizar esta página". */
  window.uvPersonalizar = function (key, titulo, redesenhar, presentes) {
    if (!window.uvPodeEditar()) return;
    atual = {key, titulo, redesenhar, presentes};
    const tipo = tipoDe(key);
    window.openModal('🎛️ Personalizar esta página', titulo, `<div class="bk-painel">
      <p class="bk-intro">Escolha o que aparece <b>${esc(titulo)}</b>. Cada bloco liga e desliga na hora${tipo !== 'grupo' ? ' e ▲▼ mudam a ordem' : ''}. Vale para todos os usuários.</p>
      <div class="bk-presets" role="group" aria-label="Atalhos de layout"><button type="button" onclick="uvBlocosFoco()">🎯 Modo foco <small>só o essencial</small></button><button type="button" onclick="uvBlocosTodos()">🌈 Tudo à vista</button><button type="button" onclick="uvBlocosPadrao()">↺ Padrão do site</button></div>
      <ul class="bk-lista" id="bk-lista">${linhas()}</ul>
      <footer class="bk-rod"><span id="bk-estado"></span><span class="bk-salvo" id="bk-salvo" aria-live="polite"></span>${tipo === 'secretaria' ? '<button type="button" class="bk-todas" onclick="uvBlocosEmTodas()">🏛️ Usar em todas as secretarias</button>' : ''}<button type="button" class="bk-ok" onclick="closeModal()">Concluir</button></footer>
    </div>`);
    document.querySelector('#modal-ov .modal-box')?.classList.add('bk-modal');
    pintar();
  };
  window.uvBotaoPersonalizar = (key, titulo, onclick) => window.uvPodeEditar() ? `<button type="button" class="uv-pers" onclick="${esc(onclick)}" title="Escolher os blocos que aparecem nesta página (vale para todos)" aria-label="Personalizar esta página"><span aria-hidden="true">🎛️</span><b>Personalizar</b></button>` : '';
})();
