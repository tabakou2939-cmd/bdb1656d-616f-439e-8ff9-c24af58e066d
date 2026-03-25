document.addEventListener('DOMContentLoaded', () => {
    const authPanel = document.getElementById('auth-panel');
    const dashboardPanel = document.getElementById('dashboard-panel');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsForm = document.getElementById('settings-form');
    const galleryForm = document.getElementById('gallery-form');
    const memoForm = document.getElementById('memo-form');
    const inquiriesTableBody = document.querySelector('#inquiries-table tbody');
    const galleryTableBody = document.querySelector('#gallery-table tbody');
    const memosTableBody = document.querySelector('#memos-table tbody');
    const adminHeader = document.getElementById('admin-header');

    // Apply Background Image to Admin Page (including Login Screen)
    const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
    if (settings.bgImageBase64) {
        document.body.style.backgroundImage = `url(${settings.bgImageBase64})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    } else if (settings.colorMainBg) {
        document.body.style.backgroundColor = settings.colorMainBg;
    }

    // 0. Initialize LocalStorage from PORTFOLIO_DATA if completely empty
    if (window.PORTFOLIO_DATA) {
        if (!localStorage.getItem('site_settings') && window.PORTFOLIO_DATA.site_settings) {
            localStorage.setItem('site_settings', JSON.stringify(window.PORTFOLIO_DATA.site_settings));
        }
        if (!localStorage.getItem('gallery') && window.PORTFOLIO_DATA.gallery) {
            localStorage.setItem('gallery', JSON.stringify(window.PORTFOLIO_DATA.gallery));
        }
        if (!localStorage.getItem('memos') && window.PORTFOLIO_DATA.memos) {
            localStorage.setItem('memos', JSON.stringify(window.PORTFOLIO_DATA.memos));
        }
    }

    // 0. Initialize LocalStorage from PORTFOLIO_DATA if completely empty
    // Start auth immediately
    if (adminHeader) adminHeader.style.display = 'none';

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        if (password === '12262939') {
            localStorage.setItem('is_admin_device', 'true');
            showDashboard();
            document.getElementById('password').value = '';
        } else {
            alert('パスワードが間違っています。');
        }
    });

    logoutBtn.addEventListener('click', () => {
        authPanel.classList.remove('hidden');
        dashboardPanel.classList.add('hidden');
        if (adminHeader) adminHeader.style.display = 'none';
    });

    function showDashboard() {
        authPanel.classList.add('hidden');
        dashboardPanel.classList.remove('hidden');
        if (adminHeader) adminHeader.style.display = 'block';
        loadSettings();
        loadInquiries();
        loadGallery();
        loadMemos();
    }

    // 1.2 Export Data (Publish to GitHub)
    const exportDataBtn = document.getElementById('export-data-btn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
            const gallery = JSON.parse(localStorage.getItem('gallery') || '[]');
            const memos = JSON.parse(localStorage.getItem('memos') || '[]');
            const dataToExport = {
                site_settings: settings,
                gallery: gallery,
                memos: memos
            };

            const scriptContent = `window.PORTFOLIO_DATA = ${JSON.stringify(dataToExport, null, 2)};`;
            const blob = new Blob([scriptContent], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'data.js';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('data.js のダウンロードが完了しました。このファイルを GitHub にアップロード（コミット）して上書きしてください！');
        });
    }

    // --- Utility Function: File to Base64 with compression ---
    function getBase64(file, maxWidth = 1000, maxHeight = 1000) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 容量削減を最優先するため、JPEG形式で画質を50%まで落として強力に圧縮します
                    // （透過PNGでも背景が黒になる代わりに大幅にデータサイズを抑えられます）
                    const outType = 'image/jpeg';
                    const quality = 0.5;
                    resolve(canvas.toDataURL(outType, quality));
                };
                img.onerror = error => reject(error);
                img.src = event.target.result;
            };
            reader.onerror = error => reject(error);
        });
    }

    // 1.5 Load/Save Site Settings
    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
        if (settings.profileName) document.getElementById('profile-name').value = settings.profileName;
        if (settings.profileIntro) document.getElementById('profile-intro').value = settings.profileIntro;

        // Setup Icon Preview
        if (settings.profileIcon) {
            const previewContainer = document.getElementById('icon-preview-container');
            const previewImg = document.getElementById('icon-preview');
            if (previewImg) previewImg.src = settings.profileIcon;
            if (previewContainer) previewContainer.style.display = 'block';
        }

        if (settings.contactEmail) document.getElementById('contact-email').value = settings.contactEmail;
        
        if (settings.xUrl) {
            const xUrlInput = document.getElementById('x-url');
            if (xUrlInput) xUrlInput.value = settings.xUrl;
        }
        if (settings.igUrl) {
            const igUrlInput = document.getElementById('ig-url');
            if (igUrlInput) igUrlInput.value = settings.igUrl;
        }

        if (settings.noteUserId) {
            const noteUserIdInput = document.getElementById('note-userid');
            if (noteUserIdInput) noteUserIdInput.value = settings.noteUserId;
        }

        // Load Colors
        if (settings.colorMainBg) document.getElementById('color-main-bg').value = settings.colorMainBg;
        if (settings.colorPrimaryText) document.getElementById('color-primary-text').value = settings.colorPrimaryText;
        if (settings.colorHeroText) document.getElementById('color-hero-text').value = settings.colorHeroText;
        if (settings.colorAccent) document.getElementById('color-accent').value = settings.colorAccent;
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
        settings.profileName = document.getElementById('profile-name').value;
        settings.profileIntro = document.getElementById('profile-intro').value;
        settings.contactEmail = document.getElementById('contact-email').value;

        const xUrlInput = document.getElementById('x-url');
        if (xUrlInput) settings.xUrl = xUrlInput.value.trim();

        const igUrlInput = document.getElementById('ig-url');
        if (igUrlInput) settings.igUrl = igUrlInput.value.trim();

        const noteUserIdInput = document.getElementById('note-userid');
        if (noteUserIdInput) settings.noteUserId = noteUserIdInput.value.trim();

        settings.colorMainBg = document.getElementById('color-main-bg').value;
        settings.colorPrimaryText = document.getElementById('color-primary-text').value;
        settings.colorHeroText = document.getElementById('color-hero-text').value;
        settings.colorAccent = document.getElementById('color-accent').value;

        // Handle Profile Image Upload
        const iconInput = document.getElementById('profile-icon');
        if (iconInput && iconInput.files && iconInput.files[0]) {
            try {
                settings.profileIcon = await getBase64(iconInput.files[0], 200, 200);
            } catch (error) {
                console.error("Error reading file:", error);
                alert("プロフィール画像の読み込みに失敗しました。");
                return;
            }
        }

        // Handle Background Image Upload
        const bgInput = document.getElementById('bg-image');
        if (bgInput.files && bgInput.files[0]) {
            try {
                settings.bgImageBase64 = await getBase64(bgInput.files[0], 1280, 720);
            } catch (error) {
                console.error("Error reading Background Image file:", error);
                alert("背景画像の読み込みに失敗しました。");
                return;
            }
        }

        try {
            localStorage.setItem('site_settings', JSON.stringify(settings));
            alert('設定を保存しました。反映させるには、公開用データをダウンロードしてください。');

            // Immediately apply background to admin page
            if (settings.bgImageBase64) {
                document.body.style.backgroundImage = `url(${settings.bgImageBase64})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
            } else if (settings.colorMainBg) {
                document.body.style.backgroundImage = '';
                document.body.style.backgroundColor = settings.colorMainBg;
            }

            loadSettings(); // Reload to show new preview
        } catch (e) {
            console.error(e);
            alert('設定の保存中にエラーが発生しました。');
        }
    });

    // Preset Buttons
    const btnCafeTheme = document.getElementById('btn-cafe-theme');
    if (btnCafeTheme) {
        btnCafeTheme.addEventListener('click', () => {
            document.getElementById('color-main-bg').value = '#fdfbf7';
            document.getElementById('color-primary-text').value = '#4a3b32';
            document.getElementById('color-hero-text').value = '#4a3b32';
            document.getElementById('color-accent').value = '#c27a3c';
            alert('カフェテーマの色をセットしました。「設定を保存」を押して反映してください。');
        });
    }

    // 2. Load Inquiries
    function loadInquiries() {
        const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
        inquiriesTableBody.innerHTML = '';

        if (inquiries.length === 0) {
            inquiriesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">お問い合わせはありません。</td></tr>';
            return;
        }

        // Sort descending
        inquiries.sort((a, b) => new Date(b.date) - new Date(a.date));

        inquiries.forEach(inq => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(inq.date).toLocaleString('ja-JP')}</td>
                <td>${escapeHtml(inq.name)}</td>
                <td><a href="mailto:${escapeHtml(inq.email)}">${escapeHtml(inq.email)}</a></td>
                <td>${escapeHtml(inq.message).replace(/\n/g, '<br>')}</td>
                <td style="text-align:center;"><button onclick="deleteInquiry(${inq.id})" style="background:#dc3545; color: white; border: none; padding: 0.25rem 0.5rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer;">削除</button></td>
            `;
            inquiriesTableBody.appendChild(tr);
        });
    }

    // 3. Memo Management
    function loadMemos() {
        const memos = JSON.parse(localStorage.getItem('memos') || '[]');
        memosTableBody.innerHTML = '';

        if (memos.length === 0) {
            memosTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">投稿されたメモはありません。</td></tr>';
            return;
        }

        // Sort descending
        memos.sort((a, b) => new Date(b.date) - new Date(a.date));

        memos.forEach(memo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(memo.date).toLocaleString('ja-JP')}</td>
                <td>${escapeHtml(memo.title)}</td>
                <td>${escapeHtml(memo.content).substring(0, 40)}${memo.content.length > 40 ? '...' : ''}</td>
                <td style="text-align:center;"><button onclick="deleteMemo(${memo.id})" style="background:#dc3545; color: white; border: none; padding: 0.25rem 0.5rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer;">削除</button></td>
            `;
            memosTableBody.appendChild(tr);
        });
    }

    if (memoForm) {
        memoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('memo-title').value;
            const content = document.getElementById('memo-content').value;

            const newMemo = {
                id: Date.now(),
                title,
                content,
                date: new Date().toISOString()
            };

            const memos = JSON.parse(localStorage.getItem('memos') || '[]');
            memos.push(newMemo);
            localStorage.setItem('memos', JSON.stringify(memos));

            alert('メモを投稿しました。公開用データをダウンロードして最新にしてください。');
            memoForm.reset();
            loadMemos();
        });
    }

    // 4. Gallery Management
    function loadGallery() {
        const gallery = JSON.parse(localStorage.getItem('gallery') || '[]');
        galleryTableBody.innerHTML = '';

        if (gallery.length === 0) {
            galleryTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ギャラリー画像はありません。</td></tr>';
            return;
        }

        // Sort descending
        gallery.sort((a, b) => new Date(b.date) - new Date(a.date));

        gallery.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="width: 100px;"><img src="${item.imageBase64}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px;"></td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.desc)}</td>
                <td style="text-align:center;"><button onclick="deleteGalleryItem(${item.id})" style="background:#dc3545; color: white; border: none; padding: 0.25rem 0.5rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer;">削除</button></td>
            `;
            galleryTableBody.appendChild(tr);
        });
    }

    galleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const imageInput = document.getElementById('gallery-image');
        const title = document.getElementById('gallery-title').value;
        const desc = document.getElementById('gallery-desc').value;

        if (!imageInput.files || !imageInput.files[0]) {
            alert("画像ファイルを選択してください。");
            return;
        }

        try {
            const base64Str = await getBase64(imageInput.files[0], 800, 800);

            const newItem = {
                id: Date.now(),
                title,
                desc,
                imageBase64: base64Str,
                date: new Date().toISOString()
            };

            const gallery = JSON.parse(localStorage.getItem('gallery') || '[]');
            gallery.push(newItem);
            localStorage.setItem('gallery', JSON.stringify(gallery));

            alert('ギャラリーに画像を追加しました。公開用データをダウンロードしてください。');
            galleryForm.reset();
            loadGallery();
        } catch (error) {
            console.error("Error reading file:", error);
            alert("画像の読み込みに失敗しました。");
        }
    });

    // Global functions for inline onclick handlers
    window.deleteGalleryItem = function (id) {
        if (confirm('このギャラリー画像を削除してもよろしいですか？')) {
            let gallery = JSON.parse(localStorage.getItem('gallery') || '[]');
            gallery = gallery.filter(item => item.id !== id);
            localStorage.setItem('gallery', JSON.stringify(gallery));
            loadGallery();
        }
    };

    window.deleteMemo = function (id) {
        if (confirm('このメモを削除してもよろしいですか？')) {
            let memos = JSON.parse(localStorage.getItem('memos') || '[]');
            memos = memos.filter(memo => memo.id !== id);
            localStorage.setItem('memos', JSON.stringify(memos));
            loadMemos();
        }
    };

    window.deleteInquiry = function (id) {
        if (confirm('このお問い合わせを削除してもよろしいですか？')) {
            let inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
            inquiries = inquiries.filter(inq => inq.id !== id);
            localStorage.setItem('inquiries', JSON.stringify(inquiries));
            loadInquiries();
        }
    };
});

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
