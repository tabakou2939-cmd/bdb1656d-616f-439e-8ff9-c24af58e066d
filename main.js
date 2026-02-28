document.addEventListener('DOMContentLoaded', () => {
    // 0. Load Site Settings (Priority: Exported Data window.PORTFOLIO_DATA > LocalStorage)
    const settings = window.PORTFOLIO_DATA?.site_settings || JSON.parse(localStorage.getItem('site_settings') || '{}');

    // In order to only apply styles to the hero section, we find the hero element
    const heroSection = document.getElementById('hero');

    if (heroSection) {
        // Apply CSS Variables for Design Customization only to the hero section
        if (settings.colorMainBg) {
            heroSection.style.backgroundColor = settings.colorMainBg;
        }
        if (settings.colorPrimaryText) {
            heroSection.style.color = settings.colorPrimaryText;
            // Also apply to child elements explicitly if needed, but inheriting should work
        }
        // Accent color might still need to be global for buttons across the site, 
        // or we can scope it. Let's keep accent global so buttons still match the theme.
    }

    if (settings.colorAccent) {
        document.documentElement.style.setProperty('--accent-color', settings.colorAccent);
        document.documentElement.style.setProperty('--accent-hover', adjustColorBrightness(settings.colorAccent, -20));
    }

    if (settings.profileName) {
        document.getElementById('profile-name').textContent = `こんにちは、${settings.profileName}です。`;
    }
    if (settings.profileIntro) {
        document.getElementById('profile-intro').textContent = settings.profileIntro;
    }

    // Apply Background Image specifically to the hero section
    if (heroSection) {
        if (settings.bgImageBase64) {
            heroSection.style.backgroundImage = `url(${settings.bgImageBase64})`;
            heroSection.style.backgroundSize = 'cover';
            heroSection.style.backgroundPosition = 'center';
            heroSection.style.backgroundAttachment = 'scroll'; // Prevent weird fixed scrolling on smaller elements

            // Add a subtle overlay so text remains readable if they set a bright image before tweaking text color
            heroSection.style.position = 'relative';
            heroSection.style.zIndex = '1';
        } else {
            heroSection.style.backgroundImage = 'none';
        }
    }

    // 1. Load Public Memos (Priority: Exported Data window.PORTFOLIO_DATA > LocalStorage)
    const memoList = document.getElementById('memo-list');
    if (memoList) {
        const memos = window.PORTFOLIO_DATA?.memos || JSON.parse(localStorage.getItem('memos') || '[]');

        if (memos.length === 0) {
            memoList.innerHTML = '<p>まだメモはありません。</p>';
        } else {
            memoList.innerHTML = '';
            // Sort by date descending
            memos.sort((a, b) => new Date(b.date) - new Date(a.date));

            memos.forEach(memo => {
                const memoElement = document.createElement('article');
                memoElement.className = 'memo-card';
                // Inline styles for simplicity, but ideally we'd put this in style.css
                memoElement.style.border = '1px solid #ddd';
                memoElement.style.padding = '1.5rem';
                memoElement.style.borderRadius = '8px';
                memoElement.style.backgroundColor = '#fff';

                memoElement.innerHTML = `
                    <h3 style="margin-top: 0; color: #333;">${escapeHtml(memo.title)}</h3>
                    <p style="color: #666; line-height: 1.5;">${escapeHtml(memo.content).replace(/\n/g, '<br>')}</p>
                    <small style="color: #999; display: block; margin-top: 1rem;">${new Date(memo.date).toLocaleDateString('ja-JP')}</small>
                `;
                memoList.appendChild(memoElement);
            });
        }
    }

    // 2.5 Load Dynamic Gallery (Priority: Exported Data window.PORTFOLIO_DATA > LocalStorage)
    const galleryGrid = document.getElementById('dynamic-gallery-grid');
    if (galleryGrid) {
        const gallery = window.PORTFOLIO_DATA?.gallery || JSON.parse(localStorage.getItem('gallery') || '[]');
        galleryGrid.innerHTML = '';

        if (gallery.length === 0) {
            galleryGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">まだプロジェクトがありません。</p>';
        } else {
            // Sort descending
            gallery.sort((a, b) => new Date(b.date) - new Date(a.date));

            gallery.forEach(item => {
                const article = document.createElement('article');
                article.className = 'project-card';
                article.style.backgroundColor = 'var(--main-bg)';

                article.innerHTML = `
                    <img src="${item.imageBase64}" alt="${escapeHtml(item.title)}">
                    <h3 style="color: var(--accent-color);">${escapeHtml(item.title)}</h3>
                    <p style="color: var(--primary-text);">${escapeHtml(item.desc)}</p>
                `;
                galleryGrid.appendChild(article);
            });
        }
    }

    // 3. Handle Contact Form Submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            const inquiry = {
                id: Date.now(),
                name,
                email,
                message,
                date: new Date().toISOString()
            };

            const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
            inquiries.push(inquiry);
            localStorage.setItem('inquiries', JSON.stringify(inquiries));

            const destEmail = settings.contactEmail || '未設定';
            alert(`お問い合わせありがとうございます。メッセージを送信しました。\n（Mock Backend: ${destEmail} 宛に送信されたフリをしています）`);
            contactForm.reset();
        });
    }
});

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Simple helper to adjust hex color brightness
function adjustColorBrightness(hex, percent) {
    // strip the #
    hex = hex.replace(/^\s*#|\s*$/g, '');

    // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if (hex.length == 3) {
        hex = hex.replace(/(.)/g, '$1$1');
    }

    let r = parseInt(hex.substr(0, 2), 16),
        g = parseInt(hex.substr(2, 2), 16),
        b = parseInt(hex.substr(4, 2), 16);

    r = Math.round(r * (100 + percent) / 100);
    g = Math.round(g * (100 + percent) / 100);
    b = Math.round(b * (100 + percent) / 100);

    r = (r < 255) ? r : 255;
    g = (g < 255) ? g : 255;
    b = (b < 255) ? b : 255;

    r = (r > 0) ? r : 0;
    g = (g > 0) ? g : 0;
    b = (b > 0) ? b : 0;

    let r_hex = (r.toString(16).length == 1) ? '0' + r.toString(16) : r.toString(16);
    let g_hex = (g.toString(16).length == 1) ? '0' + g.toString(16) : g.toString(16);
    let b_hex = (b.toString(16).length == 1) ? '0' + b.toString(16) : b.toString(16);

    return '#' + r_hex + g_hex + b_hex;
}
