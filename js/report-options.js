// Janela de opções antes de gerar o PDF de demandas.
// "Criado por" e "Última edição" começam DESMARCADOS: só aparecem se o usuário pedir,
// em letra pequena no rodapé de cada lançamento.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function askDemandReportOptions({title = 'Relatório de demandas', counts = {}, groupId = null} = {}) {
  return new Promise(resolve => {
    document.getElementById('rpt-opts')?.remove();
    const box = document.createElement('div');
    box.id = 'rpt-opts'; box.className = 'rpt-opts-overlay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'rpt-opts-title');
    const opt = (id, label, hint, checked) => `<label class="rpt-opt"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
    box.innerHTML = `<form class="rpt-opts-card" novalidate>
      <header><div><h2 id="rpt-opts-title">📄 Gerar PDF</h2><p>${esc(title)}</p></div><button type="button" class="rpt-x" data-close aria-label="Fechar">✕</button></header>
      <fieldset><legend>Conteúdo</legend>
        ${opt('rpt-subs', 'Incluir subitens', counts.subitems != null ? `${counts.subitems} subitem(ns) abaixo de cada item` : '', true)}
        ${opt('rpt-obs', 'Incluir observações', '', true)}
      </fieldset>
      ${groupId ? '<div class="rpt-pick"></div>' : ''}
      <fieldset><legend>Registro <span>(texto pequeno no canto de cada lançamento)</span></legend>
        ${opt('rpt-created', 'Mostrar “Criado por”', 'quem cadastrou e quando', false)}
        ${opt('rpt-updated', 'Mostrar “Última edição”', 'quem alterou por último e quando', false)}
      </fieldset>
      <footer><button type="button" class="rpt-cancel" data-close>Cancelar</button><button type="submit" class="rpt-go">📄 Gerar PDF</button></footer>
    </form>`;
    document.body.appendChild(box);
    const close = value => { box.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(null); });
    const form = box.querySelector('form');
    if (groupId) window.pdfPicker?.render(form.querySelector('.rpt-pick'), groupId);
    form.onsubmit = e => {
      e.preventDefault();
      const v = id => form.querySelector('#' + id).checked;
      const pick = groupId ? (window.pdfPicker?.read(form.querySelector('.rpt-pick')) || {}) : {};
      if (pick.error) { window.toast?.(pick.error, 'error', 6000); return; }
      close({scope: pick.scope || 'todos', pickIds: pick.pickIds || null, includeSubitems: v('rpt-subs'), includeDone: true, includeNotes: v('rpt-obs'), showCreated: v('rpt-created'), showUpdated: v('rpt-updated')});
    };
    form.querySelector('.rpt-go').focus();
  });
}
