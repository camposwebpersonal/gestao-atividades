// Datas SEMPRE em dd/mm/aaaa no site inteiro (regra do usuário, 23/11/2026: "nunca mais mm/dd/aaaa").
// O campo nativo <input type="date"> mostra o formato do idioma do NAVEGADOR (em inglês vira mm/dd/yyyy) e o
// site não consegue mudar isso. Por isso cada campo de data ganha, por cima, uma caixa de texto em dd/mm/aaaa
// (com máscara, atalho "h" = hoje e botão 📅 que abre o calendário do aparelho). O campo nativo continua no
// lugar, escondido, guardando o valor em AAAA-MM-DD: todo o código que lê/grava `.value`, os eventos
// input/change e os onchange="" continuam funcionando igual. Vale também para datetime-local (dd/mm/aaaa hh:mm).
(function () {
  if (typeof window === 'undefined' || window.__dateBr) return; window.__dateBr = true;
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const pad = n => String(n).padStart(2, '0');
  const isoToBr = (v, dt) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); return m ? `${m[3]}/${m[2]}/${m[1]}${dt ? ` ${m[4] || '00'}:${m[5] || '00'}` : ''}` : ''; };
  const brToIso = (t, dt) => {
    const m = String(t).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/); if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3], date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1900 || y > 2200) return null;
    const iso = `${y}-${pad(mo)}-${pad(d)}`;
    if (!dt) return iso;
    const h = m[4] == null ? 0 : +m[4], mi = m[5] == null ? 0 : +m[5]; if (h > 23 || mi > 59) return null;
    return `${iso}T${pad(h)}:${pad(mi)}`;
  };
  const mask = (raw, dt) => {
    const dg = String(raw).replace(/\D/g, '').slice(0, dt ? 12 : 8);
    let out = dg.slice(0, 2);
    if (dg.length > 2) out += '/' + dg.slice(2, 4);
    if (dg.length > 4) out += '/' + dg.slice(4, 8);
    if (dt && dg.length > 8) out += ' ' + dg.slice(8, 10);
    if (dt && dg.length > 10) out += ':' + dg.slice(10, 12);
    return out;
  };
  const todayIso = dt => { const n = new Date(); const d = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; return dt ? `${d}T${pad(n.getHours())}:${pad(n.getMinutes())}` : d; };
  const fire = (el, type) => el.dispatchEvent(new Event(type, {bubbles: true}));

  function enhance(el) {
    if (el.dataset.dbr || !el.isConnected || el.closest('[data-dbr-skip]')) return;
    const dt = el.type === 'datetime-local';
    el.dataset.dbr = '1';
    const inline = el.offsetWidth && el.parentElement && el.offsetWidth < el.parentElement.clientWidth * 0.8;
    const wrap = document.createElement('span'); wrap.className = 'dbr-wrap' + (inline ? ' is-inline' : '') + (dt ? ' is-dt' : '');
    const text = document.createElement('input');
    text.type = 'text'; text.className = (el.className ? el.className + ' ' : '') + 'dbr-text'; text.style.cssText = el.style.cssText;
    text.placeholder = dt ? 'dd/mm/aaaa hh:mm' : 'dd/mm/aaaa'; text.inputMode = 'numeric'; text.autocomplete = 'off'; text.maxLength = dt ? 16 : 10;
    text.title = 'Digite a data (dd/mm/aaaa). Tecla H = hoje.';
    const lab = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    text.setAttribute('aria-label', el.getAttribute('aria-label') || lab?.textContent?.trim() || (dt ? 'Data e hora' : 'Data'));
    if (el.id) text.dataset.dbrFor = el.id;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dbr-cal'; btn.tabIndex = -1; btn.textContent = '📅'; btn.setAttribute('aria-label', 'Abrir calendário');
    if (inline) text.style.width = Math.max(el.offsetWidth, 150) + 'px';
    el.parentNode.insertBefore(wrap, el); wrap.append(text, btn, el);
    el.classList.add('dbr-native'); el.tabIndex = -1; el.setAttribute('aria-hidden', 'true');
    const show = () => { text.value = isoToBr(desc.get.call(el), dt); text.classList.remove('dbr-invalid'); text.removeAttribute('aria-invalid'); };
    const mirror = () => { text.disabled = el.disabled; text.readOnly = el.readOnly; text.required = el.required; btn.disabled = el.disabled || el.readOnly; wrap.classList.toggle('is-disabled', el.disabled); };
    Object.defineProperty(el, 'value', {configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); show(); }});
    el.addEventListener('input', show); el.addEventListener('change', show);
    el.addEventListener('focus', () => { if (!wrap.classList.contains('picking')) text.focus(); });
    const commit = iso => { if (iso === desc.get.call(el)) return; desc.set.call(el, iso); fire(el, 'input'); fire(el, 'change'); };
    text.addEventListener('keydown', e => {
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); commit(todayIso(dt)); show(); return; }
      if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); btn.click(); }
    });
    text.addEventListener('input', () => {
      const pos = text.selectionStart, before = text.value.length;
      text.value = mask(text.value, dt);
      if (pos === before) text.setSelectionRange(text.value.length, text.value.length);
      const iso = brToIso(text.value, dt);
      if (iso) { text.classList.remove('dbr-invalid'); commit(iso); }
      else if (!text.value) commit('');
    });
    text.addEventListener('paste', e => {
      const t = e.clipboardData?.getData('text/plain')?.trim(); if (!t) return;
      const iso = /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, dt ? 16 : 10) : brToIso(t, dt) || (dt ? null : brToIso(t.split(' ')[0], false));
      if (iso) { e.preventDefault(); commit(iso); show(); }
    });
    text.addEventListener('blur', () => {
      if (!text.value) return;
      const iso = brToIso(text.value, dt) || (dt ? brToIso(text.value + ' 00:00', dt) : null);
      if (iso) { commit(iso); show(); return; }
      text.classList.add('dbr-invalid'); text.setAttribute('aria-invalid', 'true');
      window.toast?.(`Data inválida: “${text.value}”. Use dd/mm/aaaa${dt ? ' hh:mm' : ''}.`, 'error', 4500);
      setTimeout(show, 1600);
    });
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      wrap.classList.add('picking');
      try { el.showPicker(); } catch { el.focus(); el.click(); }
      setTimeout(() => wrap.classList.remove('picking'), 300);
    });
    new MutationObserver(mirror).observe(el, {attributes: true, attributeFilter: ['disabled', 'readonly', 'required', 'class', 'style']});
    mirror(); show();
  }
  const scan = root => {
    if (!root || root.nodeType !== 1) return;
    if (root.matches?.('input[type="date"],input[type="datetime-local"]')) enhance(root);
    root.querySelectorAll?.('input[type="date"]:not([data-dbr]),input[type="datetime-local"]:not([data-dbr])').forEach(enhance);
  };
  window.enhanceDateInputs = (root = document.body) => scan(root);
  window.dateBr = {isoToBr, brToIso, mask};
  const start = () => {
    scan(document.body);
    new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(scan))).observe(document.body, {childList: true, subtree: true});
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
