// Escolha do layout do PDF (janela "Opções do PDF"): orientação, formato e quantos por linha.
//   Orientação: Automática · Retrato · Paisagem
//   Formato:    Blocos (cada lançamento um bloco)  ·  Tabela (um campo por coluna)
//   Blocos por linha: 1 · 2 · 3 · 4        Campos dentro do bloco: corridos · 1 · 2 · 3 · 4 colunas
// Mostra uma miniatura da folha que muda na hora e lembra a última escolha de cada grupo.
(function () {
  const KEY = id => `pdf-layout:${id || 'geral'}`;
  const DEF = {orientation: 'auto', layout: 'blocos', perRow: 1, fieldCols: 0};
  const load = id => { try { return {...DEF, ...JSON.parse(localStorage.getItem(KEY(id)) || localStorage.getItem(KEY()) || '{}')}; } catch { return {...DEF}; } };
  const save = (id, v) => { try { localStorage.setItem(KEY(id), JSON.stringify(v)); localStorage.setItem(KEY(), JSON.stringify(v)); } catch { /* aparelho sem armazenamento */ } };
  let cur = {...DEF}, curId = null;

  const seg = (name, value, opts) => `<div class="pl-seg" role="radiogroup" data-name="${name}">${opts.map(([v, label, title]) =>
    `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? 'on' : ''}" data-v="${v}" title="${title || label}">${label}</button>`).join('')}</div>`;

  function preview() {
    const land = cur.orientation === 'landscape' || (cur.orientation === 'auto' && cur.layout === 'blocos' && cur.perRow > 2);
    const n = cur.layout === 'tabela' ? 1 : cur.perRow;
    const fc = cur.fieldCols;
    const block = () => `<i class="pl-b"><b></b>${cur.layout === 'tabela' ? '<span class="pl-cols">' + '<u></u>'.repeat(5) + '</span>' : fc ? `<span class="pl-cols">${'<u></u>'.repeat(fc * 2)}</span>`.replace('pl-cols"', `pl-cols" style="grid-template-columns:repeat(${fc},1fr)"`) : '<em></em><em></em>'}</i>`;
    const rows = Array.from({length: land ? 3 : 4}, () => `<div class="pl-row" style="grid-template-columns:repeat(${n},1fr)">${Array.from({length: n}, block).join('')}</div>`).join('');
    return `<div class="pl-sheet ${land ? 'is-land' : ''}"><div class="pl-hd"></div><div class="pl-kpi"></div>${rows}</div>`;
  }
  function render() {
    const host = document.getElementById('popt-layout'); if (!host) return;
    const blocos = cur.layout === 'blocos';
    host.innerHTML = `<div class="pl-wrap"><div class="pl-opts">
      <label>Orientação</label>${seg('orientation', cur.orientation, [['auto', 'Automática', 'Escolhe pela largura do conteúdo'], ['portrait', '📄 Retrato'], ['landscape', '🖼️ Paisagem']])}
      <label>Formato</label>${seg('layout', cur.layout, [['blocos', '🧱 Blocos', 'Cada lançamento em um bloco, com os campos preenchidos'], ['tabela', '▦ Tabela', 'Um campo por coluna']])}
      ${blocos ? `<label>Blocos por linha</label>${seg('perRow', cur.perRow, [[1, '1'], [2, '2'], [3, '3'], [4, '4']])}
      <label>Campos dentro do bloco</label>${seg('fieldCols', cur.fieldCols, [[0, 'Corridos', 'Rótulo: valor · Rótulo: valor (mais compacto)'], [1, '1 col'], [2, '2 col'], [3, '3 col'], [4, '4 col']])}` : ''}
    </div>${preview()}</div>`;
    const tm = document.getElementById('popt-table-mode'); if (tm) { tm.checked = cur.layout === 'tabela'; tm.closest('label')?.setAttribute('hidden', ''); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('#popt-layout .pl-seg button'); if (!b) return;
    const name = b.parentElement.dataset.name, v = b.dataset.v;
    cur[name] = name === 'perRow' || name === 'fieldCols' ? Number(v) : v;
    save(curId, cur); render();
  });
  window.pdfLayout = {
    open(secId) { curId = secId; cur = load(secId); render(); },
    read() { return {...cur, tableMode: cur.layout === 'tabela'}; },
  };
})();
