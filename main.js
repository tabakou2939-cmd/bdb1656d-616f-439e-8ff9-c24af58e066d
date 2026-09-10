document.addEventListener('DOMContentLoaded', () => {

    // Check if this is the admin's device
    const isAdminDevice = localStorage.getItem('is_admin_device') === 'true';

    // 0. Load Site Settings
    const localSettingsStr = localStorage.getItem('site_settings');
    let settings = {};
    if (isAdminDevice && localSettingsStr) {
        settings = JSON.parse(localSettingsStr);
    } else {
        settings = window.PORTFOLIO_DATA?.site_settings || JSON.parse(localSettingsStr || '{}');
    }

    // Whether a background photo is configured — when it is, the photo is shown
    // fixed behind the entire site (not just the hero), so it takes priority
    // over the flat hero background/text colors below.
    const hasPhoto = !!settings.bgImageBase64;

    // In order to only apply styles to the hero section, we find the hero element
    const heroSection = document.getElementById('hero');

    if (heroSection) {
        // Apply CSS Variables for Design Customization only to the hero section
        if (!hasPhoto && settings.colorMainBg) {
            heroSection.style.backgroundColor = settings.colorMainBg;
        }
        if (!hasPhoto && settings.colorPrimaryText) {
            heroSection.style.color = settings.colorPrimaryText;
            // Also apply to child elements explicitly if needed, but inheriting should work
        }
        if (settings.colorHeroText) {
            // Override specifically for the hero text using setProperty to enforce it
            const heroName = document.getElementById('profile-name');
            const heroIntro = document.getElementById('profile-intro');
            if (heroName) heroName.style.setProperty('color', settings.colorHeroText, 'important');
            if (heroIntro) heroIntro.style.setProperty('color', settings.colorHeroText, 'important');
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
        document.title = `${settings.profileName} - Portfolio`;
        
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = document.title;
        
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.content = document.title;
    }
    if (settings.profileIntro) {
        document.getElementById('profile-intro').textContent = settings.profileIntro;
        
        const cleanIntro = settings.profileIntro.replace(/\n/g, ' ').substring(0, 120);
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = cleanIntro;
        
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = cleanIntro;
        
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.content = cleanIntro;
    }

    // Apply Background Image site-wide — a fixed backdrop behind every section,
    // not just the hero (see body.has-photo in style.css for the overlay/contrast treatment)
    if (hasPhoto) {
        document.body.style.setProperty('--bg-photo-image', `url(${settings.bgImageBase64})`);
        document.body.classList.add('has-photo');
    } else {
        document.body.style.removeProperty('--bg-photo-image');
        document.body.classList.remove('has-photo');
    }

    // 0.5 Load Social Links (icon-only, opens profile directly)
    const socialLinksContainer = document.getElementById('social-links');
    if (socialLinksContainer) {
        socialLinksContainer.innerHTML = '';
        if (settings.xUrl) {
            socialLinksContainer.appendChild(
                buildSocialIconLink(settings.xUrl, SOCIAL_ICONS.x)
            );
        }
        if (settings.igUrl) {
            socialLinksContainer.appendChild(
                buildSocialIconLink(settings.igUrl, SOCIAL_ICONS.instagram)
            );
        }
        if (settings.linkedinUrl) {
            socialLinksContainer.appendChild(
                buildSocialIconLink(settings.linkedinUrl, SOCIAL_ICONS.linkedin)
            );
        }
    }

    // 0.6 Load Social Feeds — icon only; content is revealed on click, not auto-displayed
    const socialIconButtons = document.getElementById('social-icon-buttons');
    const socialPanel = document.getElementById('social-panel');
    const socialFeedsSection = document.getElementById('social-feeds');

    if (socialIconButtons && socialPanel) {
        const platforms = [
            { key: 'x', label: 'X (Twitter)', configured: !!settings.xUrl },
            { key: 'instagram', label: 'Instagram', configured: !!settings.igUrl },
            { key: 'linkedin', label: 'LinkedIn', configured: !!settings.linkedinUrl },
        ].filter(p => p.configured);

        if (platforms.length === 0 && socialFeedsSection) {
            socialFeedsSection.style.display = 'none';
        } else {
            let activeKey = null;

            platforms.forEach(platform => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'social-icon-btn';
                btn.setAttribute('aria-label', platform.label);
                btn.title = platform.label;
                btn.innerHTML = SOCIAL_ICONS[platform.key];

                btn.addEventListener('click', () => {
                    const isSame = activeKey === platform.key;
                    socialIconButtons.querySelectorAll('.social-icon-btn').forEach(b => b.classList.remove('active'));
                    socialPanel.classList.remove('open');

                    if (isSame) {
                        activeKey = null;
                        socialPanel.innerHTML = '';
                        return;
                    }

                    activeKey = platform.key;
                    btn.classList.add('active');
                    renderSocialPanel(platform.key, platform.label, settings, socialPanel);
                    requestAnimationFrame(() => socialPanel.classList.add('open'));
                });

                socialIconButtons.appendChild(btn);
            });
        }
    }

    // 1. Load Public Memos
    const memoList = document.getElementById('memo-list');
    if (memoList) {
        const localMemosStr = localStorage.getItem('memos');
        const memos = (isAdminDevice && localMemosStr)
            ? JSON.parse(localMemosStr)
            : (window.PORTFOLIO_DATA?.memos || JSON.parse(localMemosStr || '[]'));

        if (memos.length === 0) {
            memoList.innerHTML = '<p>まだメモはありません。</p>';
        } else {
            memoList.innerHTML = '';
            // Sort by date descending
            memos.sort((a, b) => new Date(b.date) - new Date(a.date));

            memos.forEach(memo => {
                const memoElement = document.createElement('article');
                memoElement.className = 'memo-card';

                const linkButtonHtml = memo.link
                    ? `<a class="btn-visit" href="${escapeHtml(memo.link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:0.75rem;">続きを読む ↗</a>`
                    : '';

                memoElement.innerHTML = `
                    <h3>${escapeHtml(memo.title)}</h3>
                    <p>${linkify(escapeHtml(memo.content)).replace(/\n/g, '<br>')}</p>
                    ${linkButtonHtml}
                    <small>${new Date(memo.date).toLocaleDateString('ja-JP')}</small>
                `;
                memoList.appendChild(memoElement);
            });
        }
    }

    // 2.5 Load Dynamic Gallery
    const galleryGrid = document.getElementById('dynamic-gallery-grid');
    if (galleryGrid) {
        const localGalleryStr = localStorage.getItem('gallery');
        const gallery = (isAdminDevice && localGalleryStr)
            ? JSON.parse(localGalleryStr)
            : (window.PORTFOLIO_DATA?.gallery || JSON.parse(localGalleryStr || '[]'));
        galleryGrid.innerHTML = '';

        if (gallery.length === 0) {
            galleryGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">まだプロジェクトがありません。</p>';
        } else {
            // Sort descending
            gallery.sort((a, b) => new Date(b.date) - new Date(a.date));

            gallery.forEach(item => {
                const article = document.createElement('article');
                article.className = 'project-card';

                article.innerHTML = `
                    <img src="${item.imageBase64}" alt="${escapeHtml(item.title)}">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.desc)}</p>
                `;
                galleryGrid.appendChild(article);
            });
        }
    }

    // 2.7 Load Note Posts via RSS
    const noteList = document.getElementById('note-list');
    const noteSection = document.getElementById('note-posts');
    const noteUserId = settings.noteUserId || 'kosei_2939'; // Defaulting to kosei_2939 as per user request

    if (noteList && noteUserId) {
        // We use a free RSS to JSON API service (rss2json) to bypass CORS and parse XML
        const noteRssUrl = `https://note.com/${noteUserId}/rss`;
        const rss2jsonApi = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(noteRssUrl)}`;
        const fallbackApi = `https://api.allorigins.win/get?url=${encodeURIComponent(noteRssUrl)}`;

        fetch(rss2jsonApi)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ok' && data.items && data.items.length > 0) {
                    renderNotePosts(data.items, noteList);
                } else {
                    // Fallback to allorigins if rss2json fails
                    fetchFallbackRSS(fallbackApi, noteList);
                }
            })
            .catch(error => {
                console.error('Error fetching Note RSS via rss2json:', error);
                fetchFallbackRSS(fallbackApi, noteList);
            });
    } else if (noteSection) {
        // Hide the section entirely if no ID is configured
        noteSection.style.display = 'none';
    }

    // Helper to render Note posts
    function renderNotePosts(items, container) {
        container.innerHTML = '';
        items.slice(0, 12).forEach(item => {
            const article = document.createElement('a');
            article.href = item.link;
            article.target = '_blank';
            article.rel = 'noopener noreferrer';
            article.className = 'memo-card note-card';
            article.style.textDecoration = 'none';
            article.style.display = 'block';
            article.style.color = 'inherit';

            // Extract first image from description or content if available, otherwise use a placeholder or thumbnail
            let imageUrl = item.thumbnail || '';
            if (!imageUrl && item.description) {
                const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch) imageUrl = imgMatch[1];
            }

            const imgHtml = imageUrl ? `<div style="width: 100%; height: 150px; overflow: hidden; border-radius: 4px; margin-bottom: 1rem;"><img src="${imageUrl}" alt="thumbnail" style="width: 100%; height: 100%; object-fit: cover;"></div>` : '';

            // Clean up description (remove HTML tags for snippet)
            let snippet = '';
            if (item.description) {
                snippet = item.description.replace(/<[^>]+>/g, '').substring(0, 80) + '...';
            } else if (item.content) {
                snippet = item.content.replace(/<[^>]+>/g, '').substring(0, 80) + '...';
            }

            const pubDate = new Date(item.pubDate);
            const dateString = isNaN(pubDate) ? item.pubDate : pubDate.toLocaleDateString('ja-JP');

            article.innerHTML = `
                ${imgHtml}
                <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; line-height: 1.4;">${escapeHtml(item.title)}</h3>
                <p style="font-size: 0.9rem; margin-bottom: 1rem;">${escapeHtml(snippet)}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                    <small>${dateString}</small>
                    <span style="color: var(--accent-color); font-size: 0.8rem; font-weight: bold;">Noteで読む ↗</span>
                </div>
            `;

            container.appendChild(article);
        });
    }

    // Fallback using AllOrigins and native DOMParser
    function fetchFallbackRSS(fallbackUrl, container) {
        fetch(fallbackUrl)
            .then(res => res.json())
            .then(data => {
                if (data.contents) {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
                    const items = xmlDoc.querySelectorAll("item");

                    if (items && items.length > 0) {
                        const parsedItems = Array.from(items).map(item => {
                            let description = '';
                            const descNode = item.querySelector("description");
                            const contentEncoded = item.getElementsByTagNameNS("*", "encoded");

                            if (contentEncoded.length > 0) {
                                description = contentEncoded[0].textContent;
                            } else if (descNode) {
                                description = descNode.textContent;
                            }

                            return {
                                title: item.querySelector("title")?.textContent || '',
                                link: item.querySelector("link")?.textContent || '',
                                pubDate: item.querySelector("pubDate")?.textContent || '',
                                description: description,
                                thumbnail: item.getElementsByTagNameNS("*", "thumbnail")[0]?.textContent || ''
                            };
                        });
                        renderNotePosts(parsedItems, container);
                    } else {
                        container.innerHTML = '<p>Noteの投稿が見つかりませんでした。</p>';
                    }
                } else {
                    container.innerHTML = '<p>Noteの投稿を読み込めませんでした。</p>';
                }
            })
            .catch(err => {
                console.error('Fallback RSS fetch failed:', err);
                container.innerHTML = '<p>Noteの投稿を読み込めませんでした。（通信エラー）</p>';
            });
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

// SVG icon marks for each SNS platform (used for icon-only display)
const SOCIAL_ICONS = {
    x: `<svg width="24" height="24" viewBox="0 0 1200 1227" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/></svg>`,
    instagram: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`,
    linkedin: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452z"/></svg>`
};

// Builds a single icon-only link (used in the footer) — the mark is the whole affordance
function buildSocialIconLink(url, iconSvg) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = iconSvg;
    return link;
}

// Renders the reveal panel for a given SNS platform. Embeds (Twitter widget, Instagram embed
// code) are only fetched/injected here, i.e. on click — not automatically on page load.
function renderSocialPanel(key, label, settings, panelEl) {
    if (key === 'x') {
        panelEl.innerHTML = `
            <div class="social-panel-inner">
                <h3>${escapeHtml(label)}</h3>
                <div style="margin-top: 1rem;">
                    <a class="twitter-timeline" data-height="500" href="${escapeHtml(settings.xUrl)}">Tweets by X</a>
                </div>
            </div>
        `;
        if (!document.getElementById('twitter-wjs')) {
            const script = document.createElement('script');
            script.id = 'twitter-wjs';
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.body.appendChild(script);
        } else if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load(panelEl);
        }
        return;
    }

    if (key === 'instagram') {
        // The embed field sometimes holds a bare profile URL instead of embed markup;
        // only treat it as embed code when it actually contains HTML.
        const hasEmbedMarkup = !!settings.igEmbedHtml && settings.igEmbedHtml.includes('<');
        if (hasEmbedMarkup) {
            panelEl.innerHTML = `
                <div class="social-panel-inner">
                    <h3>${escapeHtml(label)}</h3>
                    <div style="max-height: 500px; overflow-y: auto; overflow-x: hidden; margin-top: 1rem; width: 100%; display: flex; justify-content: center;">
                        ${settings.igEmbedHtml}
                    </div>
                </div>
            `;
            const scripts = panelEl.getElementsByTagName('script');
            for (let i = 0; i < scripts.length; i++) {
                const newScript = document.createElement('script');
                if (scripts[i].src) newScript.src = scripts[i].src;
                if (scripts[i].text) newScript.text = scripts[i].text;
                newScript.async = true;
                document.body.appendChild(newScript);
            }
        } else {
            renderSocialLinkCard(label, settings.igUrl, panelEl);
        }
        return;
    }

    if (key === 'linkedin') {
        renderSocialLinkCard(label, settings.linkedinUrl, panelEl);
    }
}

// Fallback panel for platforms without an embeddable feed (e.g. LinkedIn) — reveals a link card
function renderSocialLinkCard(label, url, panelEl) {
    panelEl.innerHTML = `
        <div class="social-panel-inner">
            <h3>${escapeHtml(label)}</h3>
            <div class="social-link-card">
                <p>${escapeHtml(label)}のプロフィールを見る</p>
                <a class="btn-visit" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}で見る ↗</a>
            </div>
        </div>
    `;
}

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

// Turns bare URLs typed directly into memo/note text into clickable links.
// Must run AFTER escapeHtml, since it only ever sees already-escaped text.
function linkify(escapedText) {
    if (!escapedText) return '';
    return escapedText.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
        // Strip trailing punctuation that's part of the sentence, not the URL
        let url = match;
        let trail = '';
        const trailChars = ['。', '、', '）', ')', '」', '』', '.', ',', '!', '?', '！', '？'];
        while (url.length > 0 && trailChars.includes(url.slice(-1))) {
            trail = url.slice(-1) + trail;
            url = url.slice(0, -1);
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
    });
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
