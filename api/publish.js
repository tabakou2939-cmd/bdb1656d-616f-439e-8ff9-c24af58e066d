'use strict';

/**
 * POST /api/publish
 *
 * 管理画面の「公開する」ボタンから呼ばれ、data.js を GitHub に保存（コミット）します。
 * コミットされると Vercel が自動で再デプロイし、公開サイトに反映されます。
 *
 * Vercel の環境変数（Settings → Environment Variables）:
 *   ADMIN_PASSWORD           公開用パスワード（12文字以上。admin.js に書かれているログイン用とは別のもの）
 *
 *   GitHub への認証（どちらか一方。両方あれば GitHub App を使う）:
 *   GITHUB_APP_ID            GitHub App の App ID（推奨。期限切れの心配がない）
 *   GITHUB_APP_PRIVATE_KEY   GitHub App の秘密鍵（.pem の中身。改行は \n でも可）
 *   GITHUB_TOKEN             Fine-grained token（Contents: Read and write。期限があるので定期的な作り直しが必要）
 *
 *   GITHUB_REPO              省略可。"owner/name"（既定: このリポジトリ）
 *   GITHUB_BRANCH            省略可。コミット先ブランチ（既定: main）
 *
 * GitHub App の場合、公開のたびに「このリポジトリの Contents だけ書ける・1時間で失効する」
 * トークンをその場で発行して使います。秘密鍵そのものに期限はありません。
 */

const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'tabakou2939-cmd/bdb1656d-616f-439e-8ff9-c24af58e066d';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = 'data.js';
const MIN_PASSWORD_LENGTH = 12;
const MAX_CONTENT_BYTES = 4 * 1024 * 1024; // Vercel の関数は 4.5MB までのリクエストしか受け付けない
const AUTHOR = {
    name: process.env.GIT_AUTHOR_NAME || 'tabakou2939-cmd',
    email: process.env.GIT_AUTHOR_EMAIL || 'tabakou2939-cmd@users.noreply.github.com'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 長さが違っても時間差でパスワードを推測されないよう、ハッシュ同士を比較する
function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validateData(data) {
    return isPlainObject(data)
        && isPlainObject(data.site_settings)
        && Array.isArray(data.gallery)
        && Array.isArray(data.memos);
}

// admin.js の「data.js を書き出す」と同じ形式
function buildDataJs(data) {
    const body = {
        site_settings: data.site_settings,
        gallery: data.gallery,
        memos: data.memos
    };
    return `window.PORTFOLIO_DATA = ${JSON.stringify(body, null, 2)};`;
}

// ---- GitHub App 認証 ---------------------------------------------------------

const b64url = (input) => Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function appPrivateKey() {
    // Vercel の入力欄で改行が "\n" の文字として保存されても動くようにする
    return String(process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
}

function useGithubApp() {
    return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

// GitHub App として名乗るための短命な署名付きトークン（JWT, 10分以内）
function createAppJwt() {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(process.env.GITHUB_APP_ID) }));
    const signature = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(appPrivateKey());
    return `${header}.${payload}.${b64url(signature)}`;
}

class PublishError extends Error {
    constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; }
}

// 1時間で失効する、このリポジトリの Contents だけを書けるトークンを発行する
async function getInstallationToken() {
    let jwt;
    try {
        jwt = createAppJwt();
    } catch (e) {
        throw new PublishError(500, 'bad_app_key', e.message);
    }

    const inst = await github(`/repos/${REPO}/installation`, { token: jwt });
    if (inst.status === 404) throw new PublishError(502, 'github_app_not_installed', inst.status);
    if (inst.status !== 200 || !inst.json || !inst.json.id) throw new PublishError(502, 'github_permission', inst.status);

    const issued = await github(`/app/installations/${inst.json.id}/access_tokens`, {
        method: 'POST',
        token: jwt,
        body: { repositories: [REPO.split('/')[1]], permissions: { contents: 'write' } }
    });
    if (issued.status !== 201 || !issued.json || !issued.json.token) throw new PublishError(502, 'github_permission', issued.status);
    return issued.json.token;
}

async function github(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token || process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'portfolio-publish',
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* 本文なし */ }
    return { status: res.status, json };
}

async function commitDataJs(content, token) {
    const contentsPath = `/repos/${REPO}/contents/${FILE_PATH}`;

    // sha が古いと GitHub が 409/422 を返すので、1回だけ取り直して再試行する
    for (let attempt = 0; attempt < 2; attempt++) {
        const current = await github(`${contentsPath}?ref=${encodeURIComponent(BRANCH)}`, { token });
        if (current.status !== 200 && current.status !== 404) return current;

        if (current.status === 200 && typeof current.json.content === 'string' && current.json.content) {
            const existing = Buffer.from(current.json.content, 'base64').toString('utf8');
            if (existing === content) return { status: 200, unchanged: true };
        }

        const put = await github(contentsPath, {
            method: 'PUT',
            token,
            body: {
                message: '管理画面からコンテンツを更新',
                content: Buffer.from(content, 'utf8').toString('base64'),
                branch: BRANCH,
                committer: AUTHOR,
                author: AUTHOR,
                ...(current.status === 200 ? { sha: current.json.sha } : {})
            }
        });
        if ((put.status === 409 || put.status === 422) && attempt === 0) continue;
        return put;
    }
}

async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    // 別のサイトのページからの呼び出しは受け付けない
    const origin = req.headers.origin;
    if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).host; } catch (e) { /* 不正な Origin */ }
        if (originHost !== req.headers.host) {
            return res.status(403).json({ error: 'forbidden_origin' });
        }
    }

    const adminPassword = process.env.ADMIN_PASSWORD || '';
    if (!(useGithubApp() || process.env.GITHUB_TOKEN) || !adminPassword) {
        return res.status(500).json({ error: 'not_configured' });
    }
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(500).json({ error: 'weak_password' });
    }

    let payload = req.body;
    if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = null; }
    }
    if (!isPlainObject(payload)) {
        return res.status(400).json({ error: 'bad_request' });
    }

    if (typeof payload.password !== 'string' || !safeEqual(payload.password, adminPassword)) {
        await sleep(1000); // 総当たりを遅くする
        return res.status(401).json({ error: 'unauthorized' });
    }

    if (!validateData(payload.data)) {
        return res.status(400).json({ error: 'invalid_data' });
    }

    const content = buildDataJs(payload.data);
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
        return res.status(413).json({ error: 'too_large' });
    }

    let result;
    try {
        const token = useGithubApp() ? await getInstallationToken() : process.env.GITHUB_TOKEN;
        result = await commitDataJs(content, token);
    } catch (err) {
        if (err instanceof PublishError) {
            console.error('publish: GitHub App auth failed:', err.code, err.detail);
            return res.status(err.status).json({ error: err.code });
        }
        console.error('publish: GitHub request failed', err);
        return res.status(502).json({ error: 'github_unreachable' });
    }

    if (result.unchanged) {
        return res.status(200).json({ ok: true, unchanged: true });
    }
    if (result.status === 200 || result.status === 201) {
        const commit = result.json && result.json.commit;
        return res.status(200).json({
            ok: true,
            commit: commit && commit.sha ? commit.sha.slice(0, 7) : undefined
        });
    }

    console.error('publish: GitHub returned', result.status, result.json && result.json.message);
    if (result.status === 401 || result.status === 403 || result.status === 404) {
        return res.status(502).json({ error: 'github_permission', github_status: result.status });
    }
    return res.status(502).json({ error: 'github_error', github_status: result.status });
}

module.exports = handler;
module.exports.buildDataJs = buildDataJs;
module.exports.validateData = validateData;
