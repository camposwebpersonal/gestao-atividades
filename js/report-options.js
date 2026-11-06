// Janela de opções antes de gerar o PDF de demandas.
// "Criado por" e "Última edição" começam DESMARCADOS: só aparecem se o usuário pedir,
// em letra pequena no rodapé de cada lançamento.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function askDemandReportOptions({title = 'Relatório de demandas', counts = {}} = {}) {
  return new Promise(resolve => {
    document.getElementById('rpt-opts')?.remove();
    const box = document.createElement('div');
    box.id = 'rpt-opts'; box.className = 'rpt-opts-overlay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'rpt-opts-title');
    const opt = (id, label, hint, checked) => `<label class="rpt-opt"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
    box.innerHTML = `<form class="rpt-opts-card" novalidate>
      <header><div><h2 id="rpt-opts-title">📄 Gerar PDF</h2><p>${esc(title)}</p></div><button type="button" class="rpt-x" data-close aria-label="Fechar">✕</button></header>
      <fieldset><legend>Conteúdo</legend>
        ${opt('rpt-subs', 'Incluir subitens', counts.subitems != null ? `${counts.subitems} subitem(ns) abaixo de cada item` : '', true)}
        ${opt('rpt-done', 'Incluir lançamentos concluídos', counts.done != null ? `${counts.done} concluído(s)` : '', true)}
        ${opt('rpt-obs', 'Incluir observações', '', true)}
      </fieldset>
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
    form.onsubmit = e => {
      e.preventDefault();
      const v = id => form.querySelector('#' + id).checked;
      close({includeSubitems: v('rpt-subs'), includeDone: v('rpt-done'), includeNotes: v('rpt-obs'), showCreated: v('rpt-created'), showUpdated: v('rpt-updated')});
    };
    form.querySelector('.rpt-go').focus();
  });
}
