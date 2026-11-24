'use strict';

/**
 * Note の RSS を取得して、サイトに取り込みます（GitHub Actions から毎日実行）。
 *
 *   1. note-posts.json  … 記事一覧（main.js が読み込んで表示）
 *   2. index.html       … <!-- note-list:start --> と <!-- note-list:end --> の間に
 *                          記事タイトルへのリンクを書き込み（検索エンジンが読める静的HTML）
 *
 * 手元で試すとき:  node scripts/sync-note.js
 * RSS を保存したファイルで試すとき:  NOTE_RSS_FILE=sample.xml node scripts/sync-note.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MAX_ITEMS = 12;
const DEFAULT_USER = 'kosei_2939';

// ---- 設定の読み込み --------------------------------------------------------

// data.js の site_settings.noteUserId を優先（管理画面で変えた場合に追従する）
function readNoteUserId() {
    try {
        const sandbox = { window: {} };
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), sandbox, { timeout: 2000 });
        const id = sandbox.window.PORTFOLIO_DATA && sandbox.window.PORTFOLIO_DATA.site_settings
            && sandbox.window.PORTFOLIO_DATA.site_settings.noteUserId;
        if (typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id.trim())) return id.trim();
    } catch (e) {
        console.warn('data.js を読めなかったため既定のユーザーIDを使います:', e.message);
    }
    return DEFAULT_USER;
}

// ---- RSS の解析 ------------------------------------------------------------

function decodeEntities(s) {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

// <tag>…</tag> の中身。CDATA は中身だけを取り出し、通常のテキストは実体参照を戻す
function tagText(block, name) {
    const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
    if (!m) return '';
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
    return (cdata ? cdata[1] : decodeEntities(m[1])).trim();
}

function stripTags(html) {
    // 段落・改行だけ空白にし、<b> などの行内タグは外す（日本語の途中に空白が入らないように）
    return decodeEntities(html.replace(/<\/p>|<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function isHttps(url) {
    try { return new URL(url).protocol === 'https:'; } catch (e) { return false; }
}

function parseRss(xml) {
    const items = [];
    const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = re.exec(xml)) && items.length < MAX_ITEMS) {
        const block = m[1];
        const title = stripTags(tagText(block, 'title'));
        const link = tagText(block, 'link');
        if (!title || !isHttps(link)) continue; // https 以外のリンクは取り込まない

        const description = tagText(block, 'description') || tagText(block, 'content:encoded');

        let thumbnail = tagText(block, 'media:thumbnail');
        if (!thumbnail) {
            const enc = /<enclosure[^>]+url="([^"]+)"/i.exec(block);
            if (enc) thumbnail = decodeEntities(enc[1]);
        }
        if (!thumbnail) {
            const img = /<img[^>]+src="([^"]+)"/i.exec(description);
            if (img) thumbnail = decodeEntities(img[1]);
        }

        items.push({
            title,
            link,
            pubDate: tagText(block, 'pubDate'),
            thumbnail: isHttps(thumbnail) ? thumbnail : '',
            description: stripTags(description).slice(0, 160)
        });
    }
    return items;
}

// ---- index.html への書き込み -----------------------------------------------

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

// ブラウザの toLocaleDateString('ja-JP') と同じ表記（例: 2026/11/2）
function formatDate(pubDate) {
    const d = new Date(pubDate);
    if (isNaN(d)) return pubDate || '';
    return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function renderStaticList(items, indent, eol) {
    return items.map((item) => [
        '<article class="memo-card note-card">',
        `    <h3><a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>`,
        item.description ? `    <p>${esc(item.description.slice(0, 80))}...</p>` : '',
        `    <small>${esc(formatDate(item.pubDate))}</small>`,
        '</article>'
    ].filter(Boolean).map((line) => indent + line).join(eol)).join(eol);
}

function updateIndexHtml(items) {
    const file = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const re = /([ \t]*)<!-- note-list:start -->[\s\S]*?<!-- note-list:end -->/;
    const m = re.exec(html);
    if (!m) {
        console.warn('index.html に note-list のマーカーが無いため、HTMLの更新をスキップします。');
        return false;
    }
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    const indent = m[1];
    const replacement = [
        `${indent}<!-- note-list:start -->`,
        renderStaticList(items, indent, eol),
        `${indent}<!-- note-list:end -->`
    ].join(eol);
    const next = html.replace(re, () => replacement);
    if (next === html) return false;
    fs.writeFileSync(file, next);
    return true;
}

// ---- メイン ----------------------------------------------------------------

async function main() {
    const user = readNoteUserId();

    let xml;
    if (process.env.NOTE_RSS_FILE) {
        xml = fs.readFileSync(process.env.NOTE_RSS_FILE, 'utf8');
    } else {
        const url = `https://note.com/${encodeURIComponent(user)}/rss`;
        const res = await fetch(url, { headers: { 'User-Agent': 'portfolio-note-sync' } });
        if (!res.ok) throw new Error(`Note の RSS を取得できませんでした (HTTP ${res.status}): ${url}`);
        xml = await res.text();
    }

    const items = parseRss(xml);
    if (items.length === 0) {
        // 取得の失敗で既存の記事一覧を空にしてしまわないよう、何も書き換えずに失敗させる
        throw new Error('RSS から記事を1件も読み取れませんでした。更新せずに終了します。');
    }

    const json = JSON.stringify({ user, items }, null, 2) + '\n';
    const jsonFile = path.join(ROOT, 'note-posts.json');
    const jsonChanged = !fs.existsSync(jsonFile) || fs.readFileSync(jsonFile, 'utf8') !== json;
    if (jsonChanged) fs.writeFileSync(jsonFile, json);

    const htmlChanged = updateIndexHtml(items);

    console.log(`記事 ${items.length} 件。note-posts.json: ${jsonChanged ? '更新' : '変更なし'} / index.html: ${htmlChanged ? '更新' : '変更なし'}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = { parseRss, renderStaticList, formatDate };
