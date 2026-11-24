# 田端宏成（Kosei）のポートフォリオサイト

Vercel で公開している静的サイトです。デザインは `style.css` の先頭にある変数（色・余白・角丸）で決まります。

## 更新のしかた

### 記事・写真・プロフィールを変える（管理画面）

1. 公開サイトの `/admin.html` を開いてログインし、メモ・ギャラリー・プロフィールなどを編集
2. 「🚀 公開する」を押す（初回は公開用パスワードを聞かれます）
3. 1〜2分で公開サイトに反映されます（`data.js` が自動で GitHub に保存され、Vercel が再デプロイします）

「公開する」を押すまでは、編集内容は自分のブラウザの中だけにあります。うまくいかないときは「data.js をダウンロード（手動）」で保存し、GitHub 上の `data.js` に上書きアップロードしてください。

### Note の記事（自動）

GitHub Actions（`.github/workflows/sync-note.yml`）が毎日 06:17（日本時間）に Note の RSS を取得し、
`note-posts.json` と `index.html` の記事一覧を更新します。何もする必要はありません。

- すぐ反映したいとき: GitHub の「Actions」→「Sync Note posts」→「Run workflow」
- Note のユーザーIDを変えたとき: 管理画面の設定（`noteUserId`）が自動で使われます

## 初回セットアップ（「公開する」ボタンを使うために1回だけ）

GitHub App を使います。公開のたびに「このリポジトリの Contents だけ書ける・1時間で失効する」トークンを自動で発行するので、**トークンの期限切れを気にする必要がありません**。

### 1. GitHub App を作る

1. GitHub → 右上のアイコン → Settings → 左下の Developer settings → **GitHub Apps** → New GitHub App
2. 次のとおり入力します（書いていない項目は初期値のまま）
   - GitHub App name: 世界で重複しない名前（例: `kosei-site-publisher`）
   - Homepage URL: 公開サイトのURL
   - Webhook: **Active のチェックを外す**
   - Permissions → Repository permissions → **Contents: Read and write**（他は付けない）
   - Where can this app be installed?: **Only on this account**
3. 「Create GitHub App」を押す
4. 作成後のページ上部にある **App ID**（数字）をメモ
5. ページ下の「Private keys」→ **Generate a private key** → `.pem` ファイルがダウンロードされます（大切に保管。再表示はできませんが、いつでも作り直せます）

### 2. App をこのリポジトリにインストールする

1. App のページ左メニューの **Install App** → 自分のアカウントの「Install」
2. **Only select repositories** → このリポジトリだけを選んで Install

### 3. Vercel に環境変数を入れる

Vercel のプロジェクト → Settings → Environment Variables

| 名前 | 値 |
| --- | --- |
| `GITHUB_APP_ID` | 手順1-4でメモした App ID |
| `GITHUB_APP_PRIVATE_KEY` | `.pem` ファイルの中身を、`-----BEGIN` と `-----END` の行も含めて丸ごと貼り付け |
| `ADMIN_PASSWORD` | 公開用パスワード（**12文字以上**） |

- `ADMIN_PASSWORD` は、管理画面のログインパスワード（`admin.js` に書かれていて誰でも見られるもの）とは**別の**ものにしてください
- 入れたあとは Deployments から最新のデプロイを「Redeploy」すると反映されます
- 省略可: `GITHUB_BRANCH`（既定は `main`）、`GITHUB_REPO`（既定はこのリポジトリ）

### 4. 動作確認

管理画面で「🚀 公開する」を押し、「公開しました」と出れば完了です。GitHub のコミット履歴に「管理画面からコンテンツを更新」が増えます。

### 鍵を失くした・漏れたかもしれないとき

App のページの Private keys で、古い鍵を **Delete** して新しい鍵を作り、Vercel の `GITHUB_APP_PRIVATE_KEY` を差し替えて Redeploy します。パスワードも変えたい場合は `ADMIN_PASSWORD` も差し替えます。

### 予備: 個人用アクセストークンを使う方法

GitHub App の代わりに、Fine-grained token（このリポジトリだけ・Contents: Read and write）を `GITHUB_TOKEN` に入れても動きます。ただしトークンには有効期限があり、切れると公開できなくなるため、作り直しが必要です。`GITHUB_APP_ID` と `GITHUB_APP_PRIVATE_KEY` が両方入っていれば、そちらが優先されます。

## 仕組み

```
管理画面 ──POST /api/publish──▶ api/publish.js ──GitHub API──▶ data.js をコミット ──▶ Vercel が再デプロイ
GitHub Actions（毎日）──▶ scripts/sync-note.js ──▶ note-posts.json / index.html をコミット ──▶ Vercel が再デプロイ
```

- `api/publish.js` はパスワードを確認してから、GitHub App のトークンを発行して保存します。パスワードを間違えると1秒待たせ、別サイトからの呼び出しは拒否します
- 受け付けるデータは約4MBまでです（背景画像・ギャラリー画像が大きいと超えるので、小さめの画像にしてください）
- 手元で確認するとき: `npm install` → `node server.js` → `http://localhost:3000`（このサーバーでは「公開する」は使えません）
