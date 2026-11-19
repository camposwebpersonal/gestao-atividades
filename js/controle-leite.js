/* ── RECEBIMENTO DE LEITE (CEDOCA) ──
 * Grupo com extra_fields.controle_leite = 1. Os produtores vêm SEMPRE do cadastro (grupo em
 * extra_fields.produtores_grupo: PRODUTORES DE LEITE DE CABRA — Nº, Referência, Chave PIX, Situação…).
 * Cada DIA de coleta é um item do grupo: extra_fields { Data, 'Preço por litro', 'Resfriador (L)',
 * leite_entregas: { <id do produtor>: litros } }. Preço padrão por quinzena em leite_precos
 * ({'2026-11-1': 3.69}) e cota opcional em leite_cotas ({'2026-11-1': 15930}).
 * Relatórios: semana (seg–dom), quinzena (1–15 / 16–fim) e mês (com colunas por semana e quinzena).
 */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const S = () => window.S || {};
  const ef = r => { let e = r?.extra_fields; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = {}; } } return e && typeof e === 'object' ? e : {}; };
  const fv = (r, ...names) => { const e = ef(r); for (const n of names) { const k = Object.keys(e).find(x => norm(x) === norm(n)); if (k && e[k] != null && typeof e[k] !== 'object' && String(e[k]).trim()) return String(e[k]).trim(); } return ''; };
  const num = v => { if (typeof v === 'number') return v; const s = String(v ?? '').replace(/[R$\sL]/gi, ''); const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s); return Number.isFinite(n) ? n : 0; };
  const L = v => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('pt-BR', {maximumFractionDigits: 1});
  const money = v => (Number(v) || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const pad = n => String(n).padStart(2, '0');
  const ymd = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const dBR = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10).split('-').reverse().join('/') : '—';
  const dm = s => String(s).slice(8, 10) + '/' + String(s).slice(5, 7);
  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const dow = s => DOW[parse(s).getDay()];
  const lastDay = (y, m) => new Date(y, m, 0).getDate();
  const qKey = s => `${String(s).slice(0, 7)}-${Number(String(s).slice(8, 10)) <= 15 ? 1 : 2}`;

  const isLeiteGroup = g => { const e = ef(g); return Number(e.controle_leite) === 1 || e.controle_leite === true; };
  window.isLeiteGroup = isLeiteGroup;
  const groupOf = id => (S().secs || []).find(s => s.id === id);

  // ── Períodos ──
  function period(kind, anchor) {
    const [y, m, d] = String(anchor).slice(0, 10).split('-').map(Number), ld = lastDay(y, m), ym = `${y}-${pad(m)}`;
    if (kind === 'mes') return {kind, start: `${ym}-01`, end: `${ym}-${pad(ld)}`, label: `${MES[m - 1]} DE ${y}`, short: `${MES[m - 1].slice(0, 3)}/${y}`};
    if (kind === 'quinzena') { const q1 = d <= 15; return {kind, start: `${ym}-${q1 ? '01' : '16'}`, end: `${ym}-${q1 ? '15' : pad(ld)}`, label: `${q1 ? '1ª' : '2ª'} QUINZENA DE ${MES[m - 1]} ${y}`, short: `${q1 ? '1ª' : '2ª'} quinz. ${MES[m - 1].slice(0, 3)}/${y}`}; }
    const dt = parse(anchor), back = (dt.getDay() + 6) % 7, start = addDays(anchor, -back), end = addDays(start, 6);
    return {kind: 'semana', start, end, label: `SEMANA DE ${dBR(start)} A ${dBR(end)}`, short: `${dm(start)} a ${dm(end)}`};
  }
  function shift(kind, anchor, dir) {
    const [y, m, d] = String(anchor).slice(0, 10).split('-').map(Number);
    if (kind === 'mes') { const t = new Date(y, m - 1 + dir, 1, 12); return ymd(t); }
    if (kind === 'quinzena') {
      if (d <= 15) return dir > 0 ? `${y}-${pad(m)}-16` : ymd(new Date(y, m - 2, 16, 12));
      return dir > 0 ? ymd(new Date(y, m, 1, 12)) : `${y}-${pad(m)}-01`;
    }
    return addDays(anchor, 7 * dir);
  }
  function weeksOf(p) { // semanas (seg–dom) recortadas dentro do período
    const out = []; let s = p.start;
    while (s <= p.end) { const w = period('semana', s), e = w.end < p.end ? w.end : p.end; out.push({start: s, end: e, label: `${dm(s)}–${dm(e)}`}); s = addDays(e, 1); }
    return out;
  }

  // ── Dados ──
  function producers(sec) {
    const gid = ef(sec).produtores_grupo;
    return (S().items || []).filter(i => i.atividade_id === gid).map(p => ({
      id: p.id, rec: p, nome: p.description || 'Produtor', n: Number(fv(p, 'Nº')) || Number(p.order_num) || 0,
      ref: fv(p, 'Referência / responsável'), pix: fv(p, 'Chave PIX'), tel: fv(p, 'Telefone'), local: fv(p, 'Localidade'),
      ativo: norm(fv(p, 'Situação') || 'Ativo') !== 'INATIVO',
    })).sort((a, b) => (a.n || 9999) - (b.n || 9999) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function days(secId) {
    const sec = groupOf(secId), cfg = ef(sec).leite_precos || {};
    const list = (S().items || []).filter(i => i.atividade_id === secId).map(r => {
      const e = ef(r), date = String(fv(r, 'Data') || r.start_date || '').slice(0, 10);
      const ent = {}; let tot = 0;
      Object.entries(e.leite_entregas && typeof e.leite_entregas === 'object' ? e.leite_entregas : {}).forEach(([k, v]) => { const n = num(v); if (n > 0) { ent[k] = n; tot += n; } });
      return {id: r.id, r, date, ent, tot, preco: num(fv(r, 'Preço por litro')) || 0, resf: num(fv(r, 'Resfriador (L)')) || 0, obs: r.observacao || ''};
    }).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)).sort((a, b) => a.date.localeCompare(b.date));
    let last = 0;
    list.forEach(d => { if (!d.preco) d.preco = num(cfg[qKey(d.date)]) || last; last = d.preco || last; });
    return list;
  }
  const priceFor = (secId, date) => { const ds = days(secId); const same = ds.find(d => d.date === date); if (same?.preco) return same.preco; const cfg = ef(groupOf(secId)).leite_precos || {}; if (num(cfg[qKey(date)])) return num(cfg[qKey(date)]); const prev = ds.filter(d => d.date <= date).pop() || ds[ds.length - 1]; return prev?.preco || 0; };

  function summarize(secId, p) {
    const sec = groupOf(secId), prods = producers(sec), all = days(secId);
    const ds = all.filter(d => d.date >= p.start && d.date <= p.end);
    const by = new Map(prods.map(x => [x.id, {p: x, litros: 0, valor: 0, dias: 0, por: {}, ult: ''}]));
    const lastEver = new Map();
    all.forEach(d => Object.keys(d.ent).forEach(k => lastEver.set(k, d.date)));
    ds.forEach(d => Object.entries(d.ent).forEach(([k, v]) => {
      if (!by.has(k)) by.set(k, {p: {id: k, nome: '(produtor fora do cadastro)', n: 0, ativo: true}, litros: 0, valor: 0, dias: 0, por: {}, ult: ''});
      const x = by.get(k); x.litros += v; x.valor += v * d.preco; x.dias++; x.por[d.date] = (x.por[d.date] || 0) + v; x.ult = d.date;
    }));
    const rows = [...by.values()];
    rows.forEach(x => { x.lastEver = lastEver.get(x.p.id) || ''; });
    const litros = ds.reduce((a, d) => a + d.tot, 0), valor = rows.reduce((a, x) => a + x.valor, 0);
    return {sec, prods, all, ds, rows, litros, valor, entregaram: rows.filter(x => x.litros > 0).length, ativos: prods.filter(x => x.ativo).length};
  }

  // ── Tela ──
  const state = new Map();
  const st = id => {
    if (!state.has(id)) { const ds = days(id), lastDate = ds.length ? ds[ds.length - 1].date : today(); state.set(id, {kind: 'quinzena', anchor: lastDate > today() ? today() : lastDate, aba: 'planilha', busca: ''}); }
    return state.get(id);
  };
  const canEdit = sec => !!(S().isAdmin || window.userCanGroup?.(sec, 'editar'));

  window.renderControleLeite = function (secId) {
    const sec = groupOf(secId); if (!sec) return;
    const f = st(secId), p = period(f.kind, f.anchor), can = canEdit(sec);
    const s = summarize(secId, p), prev = summarize(secId, period(f.kind, shift(f.kind, p.start, -1)));
    // compara a MÉDIA por dia de coleta (o período atual pode estar pela metade)
    const varPct = prev.ds.length && s.ds.length ? ((s.litros / s.ds.length) - (prev.litros / prev.ds.length)) / (prev.litros / prev.ds.length) * 100 : null;
    const cota = f.kind === 'quinzena' ? num((ef(sec).leite_cotas || {})[qKey(p.start)]) : 0;
    const top = [...s.rows].sort((a, b) => b.litros - a.litros)[0];
    const precos = [...new Set(s.ds.map(d => d.preco).filter(Boolean))];
    const kpis = [
      ['🥛', L(s.litros) + ' L', 'Leite recebido', varPct === null ? `${s.ds.length} dia(s) de coleta` : `${varPct >= 0 ? '▲' : '▼'} ${Math.abs(varPct).toFixed(1).replace('.', ',')}% na média diária vs ${f.kind === 'mes' ? 'mês' : f.kind === 'semana' ? 'semana' : 'quinzena'} anterior`, varPct === null ? 'neutral' : varPct >= 0 ? 'ok' : 'bad'],
      ['💰', money(s.valor), 'A pagar aos produtores', precos.length ? 'R$ ' + precos.map(x => x.toFixed(2).replace('.', ',')).join(' / ') + ' por litro' : 'sem preço definido', 'money'],
      ['🐐', `${s.entregaram}/${s.ativos}`, 'Produtores que entregaram', s.ativos - s.entregaram > 0 ? `${s.ativos - s.entregaram} ativo(s) sem entrega` : 'todos entregaram', s.ativos - s.entregaram > 0 ? 'warn' : 'ok'],
      ['📅', s.ds.length ? L(s.litros / s.ds.length) + ' L' : '—', 'Média por dia de coleta', s.ds.length ? `${s.ds.length} dia(s) · maior: ${L(Math.max(...s.ds.map(d => d.tot)))} L` : 'nenhuma coleta', 'neutral'],
      ['🏆', top && top.litros ? L(top.litros) + ' L' : '—', 'Maior produtor', top && top.litros ? `${top.p.n ? top.p.n + ' · ' : ''}${top.p.nome}` : '—', 'gold'],
    ];
    const kindBtn = (k, label) => `<button type="button" class="lt-seg ${f.kind === k ? 'on' : ''}" onclick="ltSet('${secId}','kind','${k}')">${label}</button>`;
    const tab = (k, label) => `<button type="button" class="lt-tab ${f.aba === k ? 'on' : ''}" onclick="ltSet('${secId}','aba','${k}')">${label}</button>`;
    let body;
    if (!s.ds.length) body = `<div class="lt-empty">Nenhum recebimento em <b>${esc(p.label.toLowerCase())}</b>. ${can ? 'Use <b>＋ Lançar recebimento</b> para registrar o leite do dia.' : ''}</div>`;
    else if (f.aba === 'produtores') body = byProducer(secId, s, p, f);
    else if (f.aba === 'dias') body = byDay(secId, s, can);
    else if (f.aba === 'recibos') body = receiptsTab(secId, s, p, f);
    else body = matrix(secId, s, p, f, can);
    const html = `<div class="lt">
      <div class="lt-head"><div><h2>🥛 ${esc(sec.name)}</h2><span>${s.prods.length} produtores no cadastro (${s.ativos} ativos) · ${s.all.length} dia(s) de coleta lançados</span></div>
        <div class="lt-actions">${can ? `<button type="button" class="lt-primary" onclick="ltOpen('${secId}')">＋ Lançar recebimento</button>` : ''}<button type="button" class="lt-ghost" onclick="ltPdf('${secId}')">📄 Relatório PDF</button><button type="button" class="lt-ghost" onclick="ltRecibos('${secId}')">🧾 Recibos</button><button type="button" class="lt-ghost" title="Copiar o resumo do período para colar no WhatsApp" onclick="ltCopiar('${secId}')">📋 Resumo</button>${can ? `<button type="button" class="lt-ghost" title="Preço por litro e cota da quinzena" onclick="ltConfig('${secId}')">⚙️</button>` : ''}<button type="button" class="lt-ghost" title="Abrir o cadastro dos produtores" onclick="openActivity('${esc(ef(sec).produtores_grupo || '')}')">🐐 Produtores</button></div></div>
      <div class="lt-period">
        <div class="lt-segs">${kindBtn('semana', 'Semana')}${kindBtn('quinzena', 'Quinzena')}${kindBtn('mes', 'Mês')}</div>
        <div class="lt-nav"><button type="button" aria-label="Período anterior" onclick="ltMove('${secId}',-1)">‹</button><b>${esc(p.label)}</b><button type="button" aria-label="Próximo período" onclick="ltMove('${secId}',1)">›</button></div>
        <input type="date" aria-label="Ir para a data" value="${esc(f.anchor)}" onchange="ltSet('${secId}','anchor',this.value)">
      </div>
      <div class="lt-kpis">${kpis.map(([i, n, l, sub, tone]) => `<div class="lt-kpi ${tone}"><span class="lt-ico">${i}</span><div><b>${esc(n)}</b><span>${esc(l)}</span><small>${esc(sub)}</small></div></div>`).join('')}</div>
      ${cota ? `<div class="lt-cota"><span>🎯 Cota da quinzena: <b>${L(s.litros)} de ${L(cota)} L</b> (${Math.round(s.litros / cota * 100)}%)${s.litros < cota ? ` · faltam ${L(cota - s.litros)} L` : ' · cota atingida ✓'}</span><i><em style="width:${Math.min(100, s.litros / cota * 100)}%"></em></i></div>` : ''}
      ${s.ds.length ? chart(s) : ''}
      <div class="lt-tabs">${tab('planilha', '📋 Planilha')}${tab('produtores', '🏆 Por produtor')}${tab('dias', '📅 Por dia')}${tab('recibos', '🧾 Recibos')}</div>
      ${body}</div>`;
    (window.setC || (h => { document.getElementById('content').innerHTML = h; }))(html);
    const b = document.getElementById('lt-busca'); if (b && f._focus) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); f._focus = false; }
  };

  function chart(s) {
    const max = Math.max(...s.ds.map(d => d.tot), 1);
    return `<div class="lt-chart" role="img" aria-label="Litros por dia de coleta">${s.ds.map(d => `<div class="lt-bar" title="${dBR(d.date)} · ${L(d.tot)} L · ${Object.keys(d.ent).length} produtor(es)"><small>${L(d.tot)}</small><i style="height:${Math.max(4, d.tot / max * 100)}%"></i><span>${dm(d.date)}<br>${dow(d.date)}</span></div>`).join('')}</div>`;
  }
  const searchBox = (secId, f) => `<input id="lt-busca" class="lt-search" type="search" placeholder="🔍 Nº ou nome do produtor…" value="${esc(f.busca)}" oninput="ltSet('${secId}','busca',this.value,true)">`;
  const match = (x, f) => { const t = norm(f.busca).split(' ').filter(Boolean); return !t.length || t.every(k => norm(`${x.p.n} ${x.p.nome} ${x.p.ref || ''}`).includes(k)); };

  function matrix(secId, s, p, f, can) {
    const monthly = p.kind === 'mes';
    const cols = monthly ? weeksOf(p).map(w => ({...w, k: 'w'})) : s.ds.map(d => ({start: d.date, end: d.date, label: dm(d.date), sub: dow(d.date), k: 'd'}));
    const qs = monthly ? [{start: p.start, end: p.start.slice(0, 8) + '15', label: '1ª quinz.'}, {start: p.start.slice(0, 8) + '16', end: p.end, label: '2ª quinz.'}] : [];
    const sumIn = (x, a, b) => Object.entries(x.por).reduce((t, [d, v]) => t + (d >= a && d <= b ? v : 0), 0);
    const rows = s.rows.filter(x => x.litros > 0 || (x.p.ativo && !f.soEntregas)).filter(x => match(x, f));
    const colTot = cols.map(c => s.ds.filter(d => d.date >= c.start && d.date <= c.end).reduce((a, d) => a + d.tot, 0));
    const cell = (x, c) => { const v = monthly ? sumIn(x, c.start, c.end) : x.por[c.start] || 0; return `<td class="${v ? '' : 'z'}" ${!monthly && can ? `onclick="ltOpen('${secId}','${c.start}','${esc(x.p.id)}')" title="${esc(x.p.nome)} · ${dBR(c.start)} — clique para lançar/corrigir"` : ''}>${v ? L(v) : ''}</td>`; };
    return `<div class="lt-tools">${searchBox(secId, f)}<label class="lt-check"><input type="checkbox" ${f.soEntregas ? 'checked' : ''} onchange="ltSet('${secId}','soEntregas',this.checked)"> Só quem entregou</label><span class="lt-hint">${monthly ? 'No mês, as colunas são as semanas e as quinzenas.' : can ? 'Clique numa célula para lançar ou corrigir.' : ''}</span></div>
      <div class="lt-mx-wrap"><table class="lt-mx"><thead><tr><th class="n">Nº</th><th class="nm">Produtor</th>${cols.map(c => `<th${!monthly && can ? ` class="dc" onclick="ltOpen('${secId}','${c.start}')" title="Abrir o lançamento de ${dBR(c.start)}"` : ''}>${esc(c.label)}${c.sub ? `<small>${c.sub}</small>` : ''}</th>`).join('')}${qs.map(q => `<th class="q">${q.label}</th>`).join('')}<th class="t">Total (L)</th><th class="t">Valor</th></tr></thead>
      <tbody>${rows.map(x => `<tr class="${x.litros ? '' : 'none'}"><td class="n">${x.p.n || ''}</td><td class="nm"><b>${esc(x.p.nome)}</b>${x.p.ref ? `<small>${esc(x.p.ref)}</small>` : ''}</td>${cols.map(c => cell(x, c)).join('')}${qs.map(q => { const v = sumIn(x, q.start, q.end); return `<td class="q">${v ? L(v) : ''}</td>`; }).join('')}<td class="t">${x.litros ? L(x.litros) : '—'}</td><td class="t">${x.valor ? money(x.valor) : '—'}</td></tr>`).join('') || `<tr><td colspan="${cols.length + qs.length + 4}" class="lt-none">Nenhum produtor com essa busca.</td></tr>`}</tbody>
      <tfoot><tr><td class="n"></td><td class="nm">TOTAL</td>${colTot.map(v => `<td>${v ? L(v) : ''}</td>`).join('')}${qs.map(q => `<td class="q">${L(s.ds.filter(d => d.date >= q.start && d.date <= q.end).reduce((a, d) => a + d.tot, 0))}</td>`).join('')}<td class="t">${L(s.litros)}</td><td class="t">${money(s.valor)}</td></tr>
      ${!monthly && s.ds.some(d => d.resf) ? `<tr class="resf"><td class="n"></td><td class="nm">Resfriador (L)</td>${s.ds.map(d => `<td>${d.resf ? L(d.resf) : ''}</td>`).join('')}<td class="t"></td><td class="t"></td></tr>` : ''}</tfoot></table></div>`;
  }

  function byProducer(secId, s, p, f) {
    const lastData = s.all.length ? s.all[s.all.length - 1].date : today();
    const rows = [...s.rows].filter(x => x.litros > 0 || x.p.ativo).filter(x => match(x, f)).sort((a, b) => b.litros - a.litros || (a.p.n - b.p.n));
    const max = Math.max(...rows.map(x => x.litros), 1);
    return `<div class="lt-tools">${searchBox(secId, f)}</div><div class="lt-rank">${rows.map((x, i) => {
      const gap = x.lastEver ? Math.round((parse(lastData) - parse(x.lastEver)) / 864e5) : null;
      const alert = !x.litros ? `<span class="lt-badge bad">${gap === null ? 'nunca entregou' : `sem entregar há ${gap} dia(s)`}</span>` : gap >= 4 ? `<span class="lt-badge warn">última entrega ${dBR(x.lastEver)}</span>` : '';
      return `<div class="lt-rank-row ${x.litros ? '' : 'none'}"><span class="lt-pos">${x.litros ? i + 1 + 'º' : '—'}</span><span class="lt-num">${x.p.n || ''}</span>
        <div class="lt-rank-main"><b>${esc(x.p.nome)}</b><small>${[x.p.ref && '👤 ' + esc(x.p.ref), x.p.pix && '💠 PIX ' + esc(x.p.pix)].filter(Boolean).join(' · ') || '&nbsp;'}</small><i style="width:${Math.max(3, x.litros / max * 100)}%"></i></div>
        <div class="lt-rank-num"><b>${L(x.litros)} L</b><small>${x.dias}/${s.ds.length} dias · média ${x.dias ? L(x.litros / x.dias) : 0} L · ${s.litros ? (x.litros / s.litros * 100).toFixed(1).replace('.', ',') : 0}%</small></div>
        <div class="lt-rank-val"><b>${money(x.valor)}</b>${alert}${x.litros ? `<button type="button" class="lt-mini" onclick="ltRecibos('${secId}','${esc(x.p.id)}')">🧾 Recibo</button>` : ''}</div></div>`;
    }).join('')}</div>`;
  }

  function byDay(secId, s, can) {
    const max = Math.max(...s.ds.map(d => d.tot), 1);
    return `<div class="lt-days">${[...s.ds].reverse().map(d => `<div class="lt-day" data-leite-dia="${esc(d.id)}"><div class="lt-day-date"><b>${dBR(d.date)}</b><span>${dow(d.date)}</span></div>
      <div class="lt-day-main"><div><b>${L(d.tot)} L</b> · ${Object.keys(d.ent).length} produtor(es) · ${money(d.tot * d.preco)} <small>(R$ ${d.preco.toFixed(2).replace('.', ',')}/L)</small>${d.resf ? ` · <span class="lt-badge info">🧊 resfriador ${L(d.resf)} L</span>` : ''}</div><i style="width:${Math.max(3, d.tot / max * 100)}%"></i>${d.obs ? `<small class="lt-obs">📝 ${esc(d.obs)}</small>` : ''}</div>
      ${can ? `<div class="lt-btns"><button type="button" onclick="ltOpen('${secId}','${d.date}')">✏️ Editar</button><button type="button" title="Excluir este dia (vai para a lixeira)" onclick="deleteItem('${esc(d.id)}',false)">🗑️</button></div>` : ''}</div>`).join('')}</div>`;
  }

  function receiptsTab(secId, s, p, f) {
    const rows = s.rows.filter(x => x.litros > 0).filter(x => match(x, f)).sort((a, b) => (a.p.n || 999) - (b.p.n || 999));
    return `<div class="lt-tools">${searchBox(secId, f)}<button type="button" class="lt-primary sm" onclick="ltRecibos('${secId}')">🧾 Gerar todos os recibos (${s.rows.filter(x => x.litros > 0).length})</button></div>
      <div class="lt-recs">${rows.map(x => `<div class="lt-rec"><div><span class="lt-num">${x.p.n || ''}</span><b>${esc(x.p.nome)}</b></div><small>${x.dias} entrega(s) · ${L(x.litros)} L</small><small>${x.p.pix ? '💠 PIX ' + esc(x.p.pix) : '<em>sem chave PIX no cadastro</em>'}</small><strong>${money(x.valor)}</strong><button type="button" class="lt-mini" onclick="ltRecibos('${secId}','${esc(x.p.id)}')">🧾 Recibo</button></div>`).join('')}</div>`;
  }

  window.ltSet = (secId, k, v, typing) => { const f = st(secId); f[k] = v; if (typing) f._focus = true; window.renderControleLeite(secId); };
  window.ltMove = (secId, dir) => { const f = st(secId); f.anchor = shift(f.kind, period(f.kind, f.anchor).start, dir); window.renderControleLeite(secId); };
  window.leiteReveal = (groupId, id) => {
    if (!isLeiteGroup(groupOf(groupId))) return false;
    const r = (S().items || []).find(i => i.id === id); const f = st(groupId); const was = f.aba;
    if (r) { const date = String(fv(r, 'Data') || r.start_date || '').slice(0, 10); if (date) f.anchor = date; }
    f.aba = 'dias'; f.busca = ''; return was !== 'dias';
  };

  // ── Lançar / corrigir o dia ──
  window.ltOpen = function (secId, date, focusPid) {
    const sec = groupOf(secId); if (!sec) return;
    const d = date || today(), ds = days(secId), cur = ds.find(x => x.date === d);
    const prods = producers(sec), keep = window.__ltDraft?.secId === secId ? window.__ltDraft.vals : null; window.__ltDraft = null;
    const val = pid => keep ? (keep[pid] || '') : cur?.ent[pid] ? String(cur.ent[pid]).replace('.', ',') : '';
    const list = prods.filter(p => p.ativo || cur?.ent[p.id] || keep?.[p.id]);
    window.openModal(cur ? `✏️ Recebimento de ${dBR(d)}` : '🥛 Lançar recebimento de leite', 'Digite os litros de cada produtor (Enter passa para o próximo). Quem não entregou fica em branco.', `
      <div class="form-grid lt-form">
        <div class="form-group"><label>Data da coleta *</label><input id="lt-data" type="date" value="${d}" max="${today()}" onchange="ltTrocarData('${secId}')"></div>
        <div class="form-group"><label>Preço por litro (R$)</label><input id="lt-preco" inputmode="decimal" value="${(keep?.__preco || (cur?.preco || priceFor(secId, d)).toFixed(2)).replace('.', ',')}" oninput="ltTotal()"></div>
        <div class="form-group"><label>Leitura do resfriador (L)</label><input id="lt-resf" inputmode="decimal" value="${keep?.__resf || (cur?.resf ? String(cur.resf).replace('.', ',') : '')}" placeholder="opcional"></div>
        <div class="form-group full"><input id="lt-filtro" type="search" placeholder="🔍 Filtrar produtor por Nº ou nome…" oninput="ltFiltrar()" autocomplete="off"></div>
        <div class="form-group full"><div class="lt-entry" id="lt-entry">${list.map(p => `<label class="lt-erow" data-q="${esc(norm(p.n + ' ' + p.nome + ' ' + p.ref))}"><span class="lt-num">${p.n || ''}</span><span class="lt-ename">${esc(p.nome)}${p.ref ? `<small>${esc(p.ref)}</small>` : ''}${!p.ativo ? '<small class="lt-inat">inativo</small>' : ''}</span><input class="lt-q" data-pid="${esc(p.id)}" inputmode="decimal" placeholder="0" value="${esc(val(p.id))}" oninput="ltTotal()" onkeydown="ltEnter(event)" aria-label="Litros de ${esc(p.nome)}"><em>L</em></label>`).join('')}</div>
          <div class="lt-add"><input id="lt-novo" placeholder="Produtor novo? Digite o nome e toque em ＋" onkeydown="if(event.key==='Enter'){event.preventDefault();ltNovoProdutor('${secId}')}"><button type="button" onclick="ltNovoProdutor('${secId}')">＋ Cadastrar</button></div></div>
        <div class="form-group full"><label>Observações do dia</label><input id="lt-obs" value="${esc(keep?.__obs ?? cur?.obs ?? '')}" placeholder="Avarias, doações, saídas…"></div>
      </div>
      <div class="lt-sum" id="lt-sum"></div>
      <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ltSalvar('${secId}')">💾 Salvar recebimento</button></div>`, {kind: 'leite'});
    window.ltTotal();
    const target = focusPid ? document.querySelector(`.lt-q[data-pid="${CSS.escape(focusPid)}"]`) : document.querySelector('.lt-q');
    if (target) setTimeout(() => { target.focus(); target.select?.(); target.scrollIntoView?.({block: 'center'}); }, 60);
  };
  const draft = () => { const vals = {}; document.querySelectorAll('.lt-q').forEach(i => { if (i.value.trim()) vals[i.dataset.pid] = i.value.trim(); }); vals.__preco = document.getElementById('lt-preco')?.value || ''; vals.__resf = document.getElementById('lt-resf')?.value || ''; vals.__obs = document.getElementById('lt-obs')?.value || ''; return vals; };
  window.ltTrocarData = secId => {
    const d = document.getElementById('lt-data').value; if (!d) return;
    const has = days(secId).some(x => x.date === d), typed = [...document.querySelectorAll('.lt-q')].some(i => i.value.trim());
    if (has && (!typed || confirm(`Já existe recebimento em ${dBR(d)}. Abrir esse dia para corrigir? (o que foi digitado aqui não será usado)`))) { window.ltOpen(secId, d); return; }
    const pr = document.getElementById('lt-preco'); if (pr && !typed) pr.value = priceFor(secId, d).toFixed(2).replace('.', ',');
  };
  window.ltFiltrar = () => { const t = norm(document.getElementById('lt-filtro').value).split(' ').filter(Boolean); document.querySelectorAll('.lt-erow').forEach(r => { r.hidden = !!t.length && !t.every(k => r.dataset.q.includes(k)); }); };
  window.ltEnter = e => { if (e.key !== 'Enter') return; e.preventDefault(); const all = [...document.querySelectorAll('.lt-erow:not([hidden]) .lt-q')]; const i = all.indexOf(e.target); const nx = all[i + 1]; if (nx) { nx.focus(); nx.select?.(); } else document.querySelector('.modal-actions .btn-save')?.focus(); };
  window.ltTotal = () => {
    let t = 0, n = 0; document.querySelectorAll('.lt-q').forEach(i => { const v = num(i.value); i.classList.toggle('has', v > 0); if (v > 0) { t += v; n++; } });
    const pr = num(document.getElementById('lt-preco')?.value), out = document.getElementById('lt-sum');
    if (out) out.innerHTML = `<span>🐐 <b>${n}</b> produtor(es)</span><span>🥛 <b>${L(t)} L</b></span><span>💰 <b>${money(t * pr)}</b></span>`;
  };
  window.ltNovoProdutor = async secId => {
    const inp = document.getElementById('lt-novo'), nome = inp?.value.trim(); if (!nome) { inp?.focus(); return; }
    const sec = groupOf(secId), gid = ef(sec).produtores_grupo, prods = producers(sec);
    const dup = prods.find(p => norm(p.nome) === norm(nome)); if (dup) { window.toast?.(`${dup.nome} já está no cadastro (Nº ${dup.n}).`, 'error'); return; }
    const n = Math.max(0, ...prods.map(p => p.n)) + 1, vals = draft(), d = document.getElementById('lt-data').value;
    try { await window.addDoc(window.collection(window.db, 'items'), {atividade_id: gid, description: nome.toUpperCase() === nome ? nome : nome, order_num: n, item_icon: '🐐', item_color: '#0f766e', concluded: 0, status: 'pendente', responsaveis: '', observacao: '', extra_fields: {'Nº': String(n), 'Tipo de leite': 'Cabra', 'Situação': 'Ativo'}, created_at: window.serverTimestamp(), updated_at: window.serverTimestamp()}); }
    catch (e) { window.toast?.('Não foi possível cadastrar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error', 8000); return; }
    await window.loadData?.();
    window.__ltDraft = {secId, vals}; window.ltOpen(secId, d);
    const novo = producers(groupOf(secId)).find(p => norm(p.nome) === norm(nome));
    if (novo) { const el = document.querySelector(`.lt-q[data-pid="${CSS.escape(novo.id)}"]`); el?.focus(); el?.scrollIntoView?.({block: 'center'}); }
    window.toast?.(`${nome} cadastrado como produtor Nº ${n}`, 'success');
  };
  window.ltSalvar = async function (secId) {
    const d = document.getElementById('lt-data')?.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) { window.toast?.('Informe a data da coleta.', 'error'); return; }
    const ent = {}; let tot = 0, bad = '';
    document.querySelectorAll('.lt-q').forEach(i => { const raw = i.value.trim(); if (!raw) return; const v = num(raw); if (!(v > 0) || v > 5000) { bad = bad || raw; return; } ent[i.dataset.pid] = Math.round(v * 10) / 10; tot += v; });
    if (bad) { window.toast?.(`Valor inválido: "${bad}". Use só números (ex.: 23,5).`, 'error'); return; }
    if (!tot) { window.toast?.('Digite os litros de pelo menos um produtor.', 'error'); return; }
    const preco = num(document.getElementById('lt-preco')?.value), resf = num(document.getElementById('lt-resf')?.value), obs = document.getElementById('lt-obs')?.value.trim() || '';
    const cur = days(secId).find(x => x.date === d);
    const extra = {...(cur ? ef(cur.r) : {}), 'Data': d, 'Preço por litro': preco || undefined, 'Resfriador (L)': resf || undefined, leite_entregas: ent};
    Object.keys(extra).forEach(k => { if (extra[k] === undefined || extra[k] === '') delete extra[k]; });
    const data = {atividade_id: secId, description: `Recebimento de ${dBR(d)} · ${L(tot)} L`, start_date: d, observacao: obs, item_icon: '🥛', item_color: '#0f766e', extra_fields: extra, updated_at: window.serverTimestamp()};
    try {
      if (cur) await window.updateDoc(window.doc(window.db, 'items', cur.id), data);
      else await window.addDoc(window.collection(window.db, 'items'), {...data, order_num: 0, concluded: 0, status: 'pendente', responsaveis: '', created_at: window.serverTimestamp()});
    } catch (e) { window.toast?.('Não foi possível salvar: ' + (window.friendlyDbError?.(e) || e.message || e), 'error', 8000); return; }
    window.closeModal(); await window.loadData?.();
    const f = st(secId); f.anchor = d; window.renderControleLeite(secId);
    window.toast?.(`${dBR(d)}: ${L(tot)} L de ${Object.keys(ent).length} produtor(es) ${cur ? 'atualizado' : 'lançado'} ✓`, 'success');
  };

  // ── Preço e cota ──
  window.ltConfig = function (secId) {
    const sec = groupOf(secId), f = st(secId), q = qKey(period(f.kind, f.anchor).start), e = ef(sec);
    const [y, m, n] = q.split('-'), lbl = `${n}ª quinzena de ${MES[Number(m) - 1].toLowerCase()}/${y}`;
    window.openModal('⚙️ Preço e cota', lbl, `<div class="form-grid">
      <div class="form-group"><label>Preço por litro (R$) nesta quinzena</label><input id="lt-cfg-preco" inputmode="decimal" value="${num((e.leite_precos || {})[q]) ? num(e.leite_precos[q]).toFixed(2).replace('.', ',') : priceFor(secId, period('quinzena', f.anchor).start).toFixed(2).replace('.', ',')}"></div>
      <div class="form-group"><label>Cota da quinzena (L)</label><input id="lt-cfg-cota" inputmode="decimal" value="${num((e.leite_cotas || {})[q]) || ''}" placeholder="opcional"></div>
      <div class="form-group full"><label class="lt-check"><input id="lt-cfg-aplicar" type="checkbox"> Aplicar este preço também aos dias já lançados nesta quinzena</label></div></div>
      <div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="ltConfigSalvar('${secId}','${q}')">💾 Salvar</button></div>`, {kind: 'leite'});
  };
  window.ltConfigSalvar = async function (secId, q) {
    const sec = groupOf(secId), e = ef(sec), preco = num(document.getElementById('lt-cfg-preco').value), cota = num(document.getElementById('lt-cfg-cota').value);
    const precos = {...(e.leite_precos || {})}, cotas = {...(e.leite_cotas || {})};
    if (preco) precos[q] = preco; else delete precos[q];
    if (cota) cotas[q] = cota; else delete cotas[q];
    try {
      await window.updateDoc(window.doc(window.db, 'atividades', secId), {extra_fields: {...e, leite_precos: precos, leite_cotas: cotas}, updated_at: window.serverTimestamp()});
      if (preco && document.getElementById('lt-cfg-aplicar')?.checked) for (const d of days(secId).filter(x => qKey(x.date) === q && x.preco !== preco)) await window.updateDoc(window.doc(window.db, 'items', d.id), {extra_fields: {...ef(d.r), 'Preço por litro': preco}, updated_at: window.serverTimestamp()});
    } catch (er) { window.toast?.('Não foi possível salvar: ' + (window.friendlyDbError?.(er) || er.message || er), 'error', 8000); return; }
    window.closeModal(); await window.loadData?.(); window.renderControleLeite(secId); window.toast?.('Preço e cota salvos ✓', 'success');
  };

  // ── Resumo para WhatsApp ──
  window.ltCopiar = async function (secId) {
    const f = st(secId), p = period(f.kind, f.anchor), s = summarize(secId, p);
    const top = [...s.rows].filter(x => x.litros).sort((a, b) => b.litros - a.litros).slice(0, 5);
    const txt = [`🥛 *${groupOf(secId)?.name || 'RECEBIMENTO DE LEITE'}*`, `📅 ${p.label}`, '', `Leite recebido: *${L(s.litros)} L* em ${s.ds.length} dia(s)`, `A pagar: *${money(s.valor)}*`, `Produtores que entregaram: ${s.entregaram} de ${s.ativos}`, s.ds.length ? `Média por dia: ${L(s.litros / s.ds.length)} L` : '', '', '🏆 Maiores entregas:', ...top.map((x, i) => `${i + 1}. ${x.p.nome} — ${L(x.litros)} L`)].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    try { await navigator.clipboard.writeText(txt); window.toast?.('Resumo copiado — é só colar no WhatsApp 📋', 'success'); }
    catch { window.openModal('📋 Resumo do período', 'Copie o texto abaixo', `<textarea class="lt-copy" rows="14" readonly>${esc(txt)}</textarea><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fechar</button></div>`, {kind: 'leite'}); }
  };

  // ── PDFs ──
  async function pdfBase(orientation) {
    if (!window.jspdf?.jsPDF) { window.toast?.('jsPDF não carregado', 'error'); return null; }
    const doc = new window.jspdf.jsPDF({orientation, unit: 'mm', format: 'a4'}); (window.safePdf || (x => x))(doc);
    let logo = null; try { logo = await window.loadB64?.('img/logo_sertania.png', 'png', 120); } catch { /* sem logo */ }
    return {doc, logo, W: orientation === 'landscape' ? 297 : 210, H: orientation === 'landscape' ? 210 : 297};
  }
  const footer = (doc, W, H, mx, label) => { const pages = doc.internal.getNumberOfPages(); for (let pg = 1; pg <= pages; pg++) { doc.setPage(pg); doc.setFillColor(12, 61, 49); doc.rect(0, H - 8, W, 8, 'F'); doc.setTextColor(225, 242, 234); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text(`PREFEITURA MUNICIPAL DE SERTÂNIA · CEDOCA · ${label}`, mx, H - 3); doc.text(`Página ${pg} de ${pages}`, W - mx, H - 3, {align: 'right'}); } };

  window.ltPdf = async function (secId) {
    const f = st(secId), p = period(f.kind, f.anchor), s = summarize(secId, p), monthly = p.kind === 'mes';
    const base = await pdfBase('landscape'); if (!base) return;
    const {doc, logo, W, H} = base, mx = 8, sec = s.sec;
    const header = () => { doc.setFillColor(240, 250, 247); doc.rect(0, 0, W, 14, 'F'); doc.setFillColor(15, 118, 110); doc.rect(0, 0, 3, 14, 'F'); if (logo?.d) doc.addImage(logo.d, 'PNG', W - 15, 1.8, 8, 10.4, undefined, 'FAST');
      doc.setTextColor(10, 61, 55); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(`CEDOCA · ${(sec?.name || 'RECEBIMENTO DE LEITE').toUpperCase()} · ${p.label}`, mx, 6.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(60, 90, 84); doc.text(`Prefeitura Municipal de Sertânia · ${dBR(p.start)} a ${dBR(p.end)} · emitido em ${new Date().toLocaleString('pt-BR')}`, mx, 11); };
    header();
    const cota = p.kind === 'quinzena' ? num((ef(sec).leite_cotas || {})[qKey(p.start)]) : 0;
    const y = (window.drawCompactHeader || ((dd, x, yy) => yy))(doc, mx, 16, W - mx * 2, 'Resumo do período', [
      {label: 'L recebidos', value: L(s.litros), color: [15, 118, 110]}, {label: 'a pagar', value: money(s.valor), color: [146, 64, 14]},
      {label: 'dias de coleta', value: s.ds.length}, {label: `de ${s.ativos} produtores entregaram`, value: s.entregaram},
      s.ds.length ? {label: 'L por dia (média)', value: L(s.litros / s.ds.length)} : null, cota ? {label: `L de cota (${Math.round(s.litros / cota * 100)}%)`, value: L(cota)} : null].filter(Boolean), cota ? Math.min(100, Math.round(s.litros / cota * 100)) : null);
    const rows = s.rows.filter(x => x.litros > 0).sort((a, b) => (a.p.n || 999) - (b.p.n || 999));
    const sumIn = (x, a, b) => Object.entries(x.por).reduce((t, [d, v]) => t + (d >= a && d <= b ? v : 0), 0);
    let head, body, foot, colStyles = {};
    if (monthly) {
      const ws = weeksOf(p), q1e = p.start.slice(0, 8) + '15', q2s = p.start.slice(0, 8) + '16';
      head = ['Nº', 'Produtor', ...ws.map(w => `Sem. ${w.label}`), '1ª quinzena', '2ª quinzena', 'Dias', 'Total (L)', 'Valor (R$)'];
      body = rows.map(x => [x.p.n || '', x.p.nome, ...ws.map(w => { const v = sumIn(x, w.start, w.end); return v ? L(v) : ''; }), L(sumIn(x, p.start, q1e)), L(sumIn(x, q2s, p.end)), x.dias, L(x.litros), money(x.valor)]);
      const dsum = (a, b) => L(s.ds.filter(d => d.date >= a && d.date <= b).reduce((t, d) => t + d.tot, 0));
      foot = ['', 'TOTAL', ...ws.map(w => dsum(w.start, w.end)), dsum(p.start, q1e), dsum(q2s, p.end), s.ds.length, L(s.litros), money(s.valor)];
      head.forEach((h, i) => { colStyles[i] = i === 0 ? {cellWidth: 8, halign: 'center'} : i === 1 ? {cellWidth: 62, fontStyle: 'bold'} : {halign: 'right'}; });
    } else {
      head = ['Nº', 'Produtor', ...s.ds.map(d => `${dm(d.date)}\n${dow(d.date)}`), 'Total (L)', 'Valor (R$)'];
      body = rows.map(x => [x.p.n || '', x.p.nome, ...s.ds.map(d => x.por[d.date] ? L(x.por[d.date]) : ''), L(x.litros), money(x.valor)]);
      foot = ['', 'TOTAL', ...s.ds.map(d => L(d.tot)), L(s.litros), money(s.valor)];
      head.forEach((h, i) => { colStyles[i] = i === 0 ? {cellWidth: 7, halign: 'center'} : i === 1 ? {cellWidth: s.ds.length > 12 ? 46 : 60, fontStyle: 'bold'} : i >= head.length - 2 ? {cellWidth: i === head.length - 1 ? 21 : 15, halign: 'right', fontStyle: 'bold'} : {halign: 'right'}; });
      if (s.ds.some(d => d.resf)) body.push([{content: '', styles: {fillColor: [239, 246, 255]}}, {content: 'Resfriador (L)', styles: {fontStyle: 'italic', fillColor: [239, 246, 255]}}, ...s.ds.map(d => ({content: d.resf ? L(d.resf) : '', styles: {fillColor: [239, 246, 255], textColor: [30, 64, 175]}})), {content: '', styles: {fillColor: [239, 246, 255]}}, {content: '', styles: {fillColor: [239, 246, 255]}}]);
    }
    const many = head.length > 18;
    doc.autoTable({startY: y + 1, head: [head], body, foot: [foot], margin: {left: mx, right: mx, top: 16, bottom: 12}, showHead: 'everyPage', showFoot: 'lastPage', rowPageBreak: 'avoid',
      styles: {fontSize: many ? 6.4 : 7.4, cellPadding: many ? 0.8 : 1.1, valign: 'middle', lineColor: [214, 224, 231], lineWidth: 0.1, textColor: [30, 41, 59], overflow: 'linebreak'},
      headStyles: {fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: many ? 6.2 : 7.2},
      footStyles: {fillColor: [12, 61, 49], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right'},
      alternateRowStyles: {fillColor: [247, 251, 250]}, columnStyles: colStyles,
      didDrawPage: dd => { if (dd.pageNumber > 1) header(); }});
    const precos = [...new Set(s.ds.map(d => d.preco))].map(v => 'R$ ' + v.toFixed(2).replace('.', ',')).join(' / ');
    let yy = doc.lastAutoTable.finalY + 4; if (yy > H - 16) { doc.addPage(); header(); yy = 20; }
    doc.setFontSize(7.4); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 80, 90);
    const fora = s.prods.filter(x => x.ativo && !rows.some(r => r.p.id === x.id)).map(x => x.n ? `${x.n}` : x.nome);
    doc.text(doc.splitTextToSize(`Preço por litro: ${precos || '—'}. ${rows.length} produtor(es) entregaram.${fora.length ? ` Sem entrega no período (Nº): ${fora.join(', ')}.` : ''}`, W - mx * 2), mx, yy);
    footer(doc, W, H, mx, 'RECEBIMENTO DE LEITE');
    doc.save(`RECEBIMENTO-DE-LEITE-${p.kind.toUpperCase()}-${p.start}.pdf`); window.toast?.('Relatório gerado!', 'success');
  };

  // Recibos: 2 por folha A4 (retrato), com dias, litros, valor, chave PIX e assinaturas.
  window.ltRecibos = async function (secId, pid) {
    const f = st(secId), p = period(f.kind, f.anchor), s = summarize(secId, p);
    const rows = s.rows.filter(x => x.litros > 0 && (!pid || x.p.id === pid)).sort((a, b) => (a.p.n || 999) - (b.p.n || 999));
    if (!rows.length) { window.toast?.('Ninguém entregou leite neste período.', 'error'); return; }
    const base = await pdfBase('portrait'); if (!base) return;
    const {doc, logo, W, H} = base, mx = 12, bh = (H - 14) / 2;
    rows.forEach((x, i) => {
      if (i && i % 2 === 0) doc.addPage();
      const y0 = 4 + (i % 2) * bh;
      if (i % 2 === 1) { doc.setLineDashPattern([1.5, 1.5], 0); doc.setDrawColor(150, 160, 170); doc.line(mx, y0 - 2, W - mx, y0 - 2); doc.setLineDashPattern([], 0); doc.setFontSize(6.5); doc.setTextColor(120, 130, 140); doc.text('✂ recortar', W - mx, y0 - 3, {align: 'right'}); }
      doc.setFillColor(240, 250, 247); doc.roundedRect(mx, y0, W - mx * 2, 15, 2, 2, 'F'); doc.setFillColor(15, 118, 110); doc.rect(mx, y0, 2.5, 15, 'F');
      if (logo?.d) doc.addImage(logo.d, 'PNG', W - mx - 10, y0 + 2, 8, 10.4, undefined, 'FAST');
      doc.setTextColor(10, 61, 55); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text('RECIBO DE ENTREGA DE LEITE · CEDOCA', mx + 5, y0 + 6.3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 90, 84); doc.text(`Prefeitura Municipal de Sertânia · ${p.label} (${dBR(p.start)} a ${dBR(p.end)})`, mx + 5, y0 + 11.3);
      let y = y0 + 22; doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.text(`${x.p.n ? 'Nº ' + x.p.n + ' · ' : ''}${x.p.nome}`, mx, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(51, 65, 85);
      const info = [x.p.ref && `Referência: ${x.p.ref}`, `Chave PIX: ${x.p.pix || 'não informada no cadastro'}`, x.p.tel && `Telefone: ${x.p.tel}`].filter(Boolean).join('   ·   ');
      y += 5; doc.text(doc.splitTextToSize(info, W - mx * 2), mx, y);
      // grade de dias (5 por linha)
      y += 5; const ds = s.ds.filter(d => x.por[d.date]), cols = 5, cw = (W - mx * 2) / cols, ch = 6.2;
      ds.forEach((d, k) => { const cx = mx + (k % cols) * cw, cy = y + Math.floor(k / cols) * ch; doc.setFillColor(k % 2 ? 248 : 241, k % 2 ? 250 : 248, k % 2 ? 252 : 246); doc.rect(cx, cy, cw - 1, ch - 0.8, 'F'); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(`${dm(d.date)} ${dow(d.date)}`, cx + 1.5, cy + 3.9); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(`${L(x.por[d.date])} L`, cx + cw - 2.5, cy + 3.9, {align: 'right'}); doc.setFont('helvetica', 'normal'); });
      y += Math.ceil(ds.length / cols) * ch + 3;
      const precoMed = x.litros ? x.valor / x.litros : 0;
      doc.setFillColor(12, 61, 49); doc.roundedRect(mx, y, W - mx * 2, 11, 2, 2, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`${x.dias} entrega(s) · ${L(x.litros)} litros · R$ ${precoMed.toFixed(2).replace('.', ',')} por litro`, mx + 4, y + 7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(`TOTAL ${money(x.valor)}`, W - mx - 4, y + 7.4, {align: 'right'});
      y += 13; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(`Recebi da Prefeitura Municipal de Sertânia a importância de ${money(x.valor)}, referente à entrega de ${L(x.litros)} litros de leite ao CEDOCA no período acima.`, W - mx * 2), mx, y + 3);
      const sy = y0 + bh - 12; doc.setDrawColor(100, 116, 139); doc.line(mx + 4, sy, mx + 80, sy); doc.line(W - mx - 80, sy, W - mx - 4, sy);
      doc.setFontSize(7.6); doc.text(x.p.nome, mx + 42, sy + 3.6, {align: 'center'}); doc.text('Responsável CEDOCA', W - mx - 42, sy + 3.6, {align: 'center'});
      doc.text('Sertânia-PE, ____/____/________', mx + 4, sy - 10);
    });
    footer(doc, W, H, mx, 'RECIBOS DE LEITE');
    doc.save(pid ? `RECIBO-LEITE-${(rows[0].p.n || '')}-${p.start}.pdf` : `RECIBOS-LEITE-${p.kind.toUpperCase()}-${p.start}.pdf`);
    window.toast?.(pid ? 'Recibo gerado!' : `${rows.length} recibo(s) gerado(s)!`, 'success');
  };
})();
