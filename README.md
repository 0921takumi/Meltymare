# MyFocus セットアップ手順

## 技術スタック
- Next.js 15 (App Router) + TypeScript
- Supabase（DB・認証・ストレージ）
- Stripe（決済）
- Vercel（ホスティング）

## 手順

### 1. Supabase
1. https://supabase.com でプロジェクト作成
2. SQL Editor で `lib/supabase/schema.sql` を実行
3. Project Settings > API からキーをコピー

### 2. Stripe
1. https://stripe.com でアカウント作成
2. API keys から公開可能キー・シークレットキーをコピー
3. Webhooks > Add endpoint
   - URL: `https://ドメイン/api/webhook`
   - イベント: `checkout.session.completed`

### 3. 環境変数
`.env.local.example` を `.env.local` にコピーして入力

### 4. ローカル起動
```
npm install && npm run dev
```

### 5. Vercelデプロイ
```
npx vercel --prod
```
Vercel > Settings > Environment Variables に7つの変数を登録。

## クリエイター設定
Supabase > Table Editor > profiles で `role` を `creator` に変更。

## ページ構成
| URL | 内容 |
|-----|------|
| `/` | トップ |
| `/contents` | 一覧 |
| `/contents/[id]` | 詳細・購入 |
| `/auth/login` | ログイン |
| `/auth/signup` | 登録 |
| `/mypage` | 購入済み一覧 |
| `/mypage/profile` | プロフィール編集 |
| `/creator/[username]` | クリエイター公開ページ |
| `/creator/dashboard` | 管理画面 |
| `/creator/upload` | コンテンツ登録・編集 |
| `/purchase/success` | 購入完了 |
| `/contact` | お問い合わせ |
