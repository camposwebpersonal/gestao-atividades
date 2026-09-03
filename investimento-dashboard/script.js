document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;

    try {
        const [headerHtml, footerHtml] = await Promise.all([
            fetch('components/header.html?v=20260903-3').then(r => r.text()),
            fetch('components/footer.html?v=20260903-3').then(r => r.text())
        ]);

        const headerEl = document.getElementById('header');
        const footerEl = document.getElementById('footer');

        if (headerEl) headerEl.innerHTML = headerHtml;
        if (footerEl) footerEl.innerHTML = footerHtml;

        const activeLink = document.querySelector(`.main-nav a[data-link="${page}"]`);
        if (activeLink) activeLink.classList.add('active');
    } catch (error) {
        console.error('Erro ao carregar componentes:', error);
    }
});
