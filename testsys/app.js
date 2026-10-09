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

  const carousel = document.querySelector('[data-card-carousel]');
  const cardSlides = [...document.querySelectorAll('[data-card-slide]')];
  const cardDots = [...document.querySelectorAll('[data-card-dot]')];
  const cardPanels = [...document.querySelectorAll('[data-card-panel]')];
  let activeCard = 0;
  let scrollFrame;

  function selectCard(index, scroll = true) {
    activeCard = Math.max(0, Math.min(index, cardSlides.length - 1));
    cardDots.forEach((dot, dotIndex) => {
      const selected = dotIndex === activeCard;
      dot.classList.toggle('active', selected);
      if (selected) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    cardPanels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== activeCard; });
    if (scroll && carousel) {
      carousel.scrollTo({ left: cardSlides[activeCard].offsetLeft - 20, behavior: 'smooth' });
    }
  }

  cardDots.forEach((dot) => dot.addEventListener('click', () => selectCard(Number(dot.dataset.cardDot))));
  document.querySelector('[data-card-prev]')?.addEventListener('click', () => selectCard(activeCard - 1));
  document.querySelector('[data-card-next]')?.addEventListener('click', () => selectCard(activeCard + 1));
  carousel?.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const nearest = cardSlides.reduce((best, slide, index) => {
        const distance = Math.abs(slide.offsetLeft - 20 - carousel.scrollLeft);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Infinity });
      if (nearest.index !== activeCard) selectCard(nearest.index, false);
    });
  }, { passive: true });
  requestAnimationFrame(() => selectCard(location.hash === '#cartao-5879' ? 1 : 0));

  const activationSheet = document.querySelector('[data-activation-sheet]');
  const activationButton = document.querySelector('[data-activate-card]');
  const activationLabel = document.querySelector('[data-activation-label]');
  const activationDetail = document.querySelector('[data-activation-detail]');

  function readActivation() {
    try { return localStorage.getItem('testsys-click-5879-activated') === 'true'; }
    catch { return false; }
  }

  function renderActivation(active) {
    if (!activationButton) return;
    activationButton.classList.toggle('activated', active);
    activationButton.setAttribute('aria-label', active ? 'Cartão final 5879 ativado' : 'Ativar cartão final 5879');
    if (activationLabel) activationLabel.textContent = active ? 'Cartão ativado' : 'Ativar cartão';
    if (activationDetail) activationDetail.textContent = active ? 'Ativação simulada concluída' : 'Pronto para ativação';
    const arrow = activationButton.querySelector(':scope > b');
    if (arrow) arrow.textContent = active ? '✓' : '›';
  }

  function setActivationSheet(open) {
    if (!activationSheet) return;
    activationSheet.hidden = !open;
    document.body.classList.toggle('sheet-open', open);
    if (open) activationSheet.querySelector('[data-close-activation]')?.focus();
  }

  renderActivation(readActivation());
  activationButton?.addEventListener('click', () => {
    if (readActivation()) {
      showToast('O cartão final 5879 já está ativado nesta simulação.');
      return;
    }
    setActivationSheet(true);
  });
  document.querySelectorAll('[data-close-activation]').forEach((button) => button.addEventListener('click', () => setActivationSheet(false)));
  document.querySelector('[data-confirm-activation]')?.addEventListener('click', () => {
    try { localStorage.setItem('testsys-click-5879-activated', 'true'); } catch {}
    renderActivation(true);
    setActivationSheet(false);
    showToast('Cartão final 5879 ativado com sucesso na simulação.');
  });
  activationSheet?.addEventListener('click', (event) => { if (event.target === activationSheet) setActivationSheet(false); });

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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setSheet(false);
      setActivationSheet(false);
    }
  });
})();
