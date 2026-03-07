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
        items.slice(0, 6).forEach(item => {
            const article = document.createElement('a');
            article.href = item.link;
            article.target = '_blank';
            article.rel = 'noopener noreferrer';
            article.className = 'memo-card note-card';
            article.style.textDecoration = 'none';
            article.style.display = 'block';
            article.style.border = '1px solid #ddd';
            article.style.padding = '1.5rem';
            article.style.borderRadius = '8px';
            article.style.backgroundColor = '#fff';
            article.style.color = 'inherit';
            article.style.transition = 'transform 0.2s, box-shadow 0.2s';

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
                <h3 style="margin-top: 0; color: #333; font-size: 1.1rem; margin-bottom: 0.5rem; line-height: 1.4;">${escapeHtml(item.title)}</h3>
                <p style="color: #666; line-height: 1.5; font-size: 0.9rem; margin-bottom: 1rem;">${escapeHtml(snippet)}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                    <small style="color: #999;">${dateString}</small>
                    <span style="color: #2cb696; font-size: 0.8rem; font-weight: bold;">Noteで読む ↗</span>
                </div>
            `;

            // Add hover effect via JS since it's inline styled for now
            article.addEventListener('mouseenter', () => {
                article.style.transform = 'translateY(-3px)';
                article.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
            });
            article.addEventListener('mouseleave', () => {
                article.style.transform = 'translateY(0)';
                article.style.boxShadow = 'none';
            });

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
