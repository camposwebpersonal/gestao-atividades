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
    }, 3200);
  }

  document.querySelectorAll('[data-toast]').forEach((control) => {
    control.addEventListener('click', () => showToast(control.dataset.toast));
  });

  document.querySelectorAll('[data-scroll-to]').forEach((control) => {
    control.addEventListener('click', () => {
      document.getElementById(control.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('A pesquisa está desativada nesta simulação.');
  });
})();
