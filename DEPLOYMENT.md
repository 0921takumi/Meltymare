# MyFocus 本番デプロイ手順書

## 0. 前提
- ドメイン `my-focus.jp` 取得済み（レジストラアカウント: `a.la.prima001@gmail.com` / ID: `alaprima01`）
- GitHub: https://github.com/0921takumi/Meltymare
- 先方（91&Co.）からの受領待ちアイテムは `README.md` 先方タスク章参照

---

## 1. 本番用アカウント作成（THINGx側で実施）

### 1-1. 運用Gmail作成
- 推奨: `myfocus.official@gmail.com`（空いてれば）
- 2FA 必須（SMS or Google Authenticator）
- リカバリーメール: `takumi.uematsu@thingx.jp` 系

### 1-2. Supabase（Pro）
1. [supabase.com](https://supabase.com) → 上記Gmailでサインアップ
2. Organization 作成 → Upgrade to Pro ($25/月)
3. プロジェクト作成: `myfocus-prod`
4. Region: `Northeast Asia (Tokyo)` `ap-northeast-1`
5. DB password を1Password等に保管

### 1-3. Vercel（Pro）
1. [vercel.com](https://vercel.com) → 同Gmailでサインアップ
2. Team 作成 → Upgrade to Pro ($20/月)
3. GitHub連携 → `0921takumi/Meltymare` import
4. Framework: Next.js（自動検出）
5. ビルド実行前に Environment Variables 設定（後述）

### 1-4. Resend
1. [resend.com](https://resend.com) → 同Gmail
2. Domain追加: `my-focus.jp`
3. DNS（SPF/DKIM）レコードを発行 → レジストラに登録

---

## 2. DBマイグレーション実行順

Supabase Dashboard > SQL Editor で **以下の順に** 実行：

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `supabase_migration.sql` | 初期スキーマ（profiles, contents, purchases 他） |
| 2 | `supabase_migration_v2.sql` | 追加機能（follows, reviews, coupons 他） |
| 3 | `supabase_migration_v3.sql` | tips + contact_messages + RLS |
| 4 | `supabase_migration_v3_tip.sql` | チップ周辺の追加 |
| 5 | `supabase_migration_v4_security.sql` | RLS強化・セキュリティ |
| 6 | `supabase_migration_v5_notifications.sql` | 通知テーブル |

### Storage バケット
SQL Editor で以下を実行、もしくは Dashboard > Storage から手動作成:
- `avatars`（public: true）
- `thumbnails`（public: true）
- `contents`（public: false）
- `deliveries`（public: false）

---

## 3. 認証プロバイダ設定

### Supabase Auth
1. Dashboard > Authentication > URL Configuration
   - Site URL: `https://my-focus.jp`
   - Redirect URLs:
     - `https://my-focus.jp/auth/callback`
     - `https://my-focus.jp/auth/update-password`
     - `http://localhost:3000/auth/callback`（開発用）

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクト作成
2. OAuth同意画面を設定（アプリ名「MyFocus」、サポートメール `info@my-focus.jp`）
3. 認証情報 > OAuth 2.0 クライアントID作成
   - 承認済みリダイレクトURI: Supabase の Auth URL（Dashboard > Authentication > Providers > Google に表示）
4. Client ID / Secret を Supabase > Authentication > Providers > Google に設定 → Enable

---

## 4. Stripe設定（先方KYC完了後）

1. Developers > API keys → `pk_live_` / `sk_live_` を取得
2. Developers > Webhooks > Add endpoint
   - URL: `https://my-focus.jp/api/webhook`
   - Events: `checkout.session.completed`
3. 作成されたWebhookの Signing Secret（`whsec_`）を取得

---

## 5. Vercel環境変数

Vercel > Project Settings > Environment Variables に登録:

```
NEXT_PUBLIC_SUPABASE_URL         = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = (Supabase > Settings > API)
SUPABASE_SERVICE_ROLE_KEY        = (同上、service_role)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_xxxx
STRIPE_SECRET_KEY                = sk_live_xxxx
STRIPE_WEBHOOK_SECRET            = whsec_xxxx
NEXT_PUBLIC_APP_URL              = https://my-focus.jp
RESEND_API_KEY                   = re_xxxx
RESEND_FROM_EMAIL                = MyFocus <noreply@my-focus.jp>
ADMIN_NOTIFY_EMAIL               = info@my-focus.jp
```

※ `SUPABASE_SERVICE_ROLE_KEY` は絶対に `NEXT_PUBLIC_` プレフィックスを付けない

---

## 6. ドメイン接続

### Vercelにドメイン追加
1. Vercel > Project > Settings > Domains
2. `my-focus.jp` と `www.my-focus.jp` を追加
3. 指示されるDNSレコード（A or CNAME）を確認

### DNS設定（レジストラ側）
| タイプ | ホスト | 値 |
|--------|--------|-----|
| A | `@` | `76.76.21.21`（Vercel指定） |
| CNAME | `www` | `cname.vercel-dns.com` |
| TXT | （SPF） | Resendで発行される値 |
| CNAME | `resend._domainkey` | Resendで発行される値 |

反映まで最大24h。`dig my-focus.jp` で確認。

---

## 7. デプロイ実行

1. Vercel が自動的にビルド（GitHub mainブランチ）
2. ビルド成功後、`https://my-focus.jp` でアクセス確認
3. 基本動線テスト:
   - [ ] トップページ表示
   - [ ] サインアップ（メール確認リンク来るか）
   - [ ] Googleログイン
   - [ ] コンテンツ表示
   - [ ] Stripe Checkout（テストカード `4242 4242 4242 4242`）
   - [ ] 納品フロー
   - [ ] 管理者アクセス（roleを手動で`admin`に変更）

---

## 8. ローンチ後初回タスク

- [ ] 管理者ユーザーの `role` を `admin` に更新（SQL Editor）
  ```sql
  UPDATE profiles SET role = 'admin' WHERE id = '<uuid>';
  ```
- [ ] 特商法ページに正式な住所・電話番号を反映
- [ ] Google Search Console 登録・sitemap送信
- [ ] Google Analytics 導入（別作業）
- [ ] バックアップ確認（Supabase Pro は自動日次バックアップ7日分）

---

## トラブル時の連絡先
- 技術: takumi.uematsu@thingx.jp
- Stripe KYC関連: 先方（ナオト氏）へ直接
