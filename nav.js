// Shared hamburger navigation used on both the public site (index.html) and
// the admin dashboard (admin.html). Toggles a slide-in panel that lists the
// page's sections plus a link across to the other page (public <-> admin).
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('site-nav');
    const overlay = document.getElementById('nav-overlay');
    const closeBtn = document.getElementById('nav-close');

    if (!toggle || !nav || !overlay) return;

    function openNav() {
        nav.classList.add('open');
        overlay.classList.add('open');
        toggle.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        nav.setAttribute('aria-hidden', 'false');
    }

    function closeNav() {
        nav.classList.remove('open');
        overlay.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        nav.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', () => {
        if (nav.classList.contains('open')) {
            closeNav();
        } else {
            openNav();
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    overlay.addEventListener('click', closeNav);

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => closeNav());
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNav();
    });
});
