(() => {
  const toast = document.querySelector('.toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 220);
    }, 2800);
  }

  document.querySelectorAll('[data-toast]').forEach((control) => {
    control.addEventListener('click', (event) => {
      if (control.getAttribute('href') === '#') event.preventDefault();
      showToast(control.dataset.toast);
    });
  });

  document.querySelectorAll('[data-toggle-values]').forEach((control) => {
    control.addEventListener('click', () => {
      const hidden = document.body.classList.toggle('values-hidden');
      control.setAttribute('aria-label', hidden ? 'Mostrar valores' : 'Ocultar valores');
      showToast(hidden ? 'Valores ocultos.' : 'Valores exibidos.');
    });
  });

  const sheet = document.querySelector('[data-payment-sheet]');
  const setSheet = (open) => {
    if (!sheet) return;
    sheet.hidden = !open;
    document.body.classList.toggle('sheet-open', open);
    if (open) sheet.querySelector('[data-close-sheet]')?.focus();
  };

  document.querySelectorAll('[data-open-payment]').forEach((button) => button.addEventListener('click', () => setSheet(true)));
  document.querySelectorAll('[data-close-sheet]').forEach((button) => button.addEventListener('click', () => setSheet(false)));
  document.querySelectorAll('[data-confirm-payment]').forEach((button) => button.addEventListener('click', () => {
    setSheet(false);
    showToast('Demonstração encerrada. Nenhum pagamento foi realizado.');
  }));

  sheet?.addEventListener('click', (event) => { if (event.target === sheet) setSheet(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setSheet(false); });
})();
