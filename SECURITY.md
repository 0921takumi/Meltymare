# MyFocus セキュリティ設計メモ

本番リリース前に実施した対策と、**手動で行う必要がある Supabase/Stripe コンソール設定**の一覧。

## 実装済み（コード側）

### アプリケーション層
- `proxy.ts`: 保護ルート（`/admin` `/creator` `/mypage` `/purchase/success`）の認可ゲート、セキュリティヘッダ付与
- `next.config.ts`: CSP / X-Frame-Options / HSTS / Referrer-Policy / Permissions-Policy
- `lib/auth.ts`: API 用認可ヘルパ (`requireUser` / `requireAdmin` / `requireCreator`)
- `lib/rate-limit.ts`: 簡易レートリミッタ（インメモリ）
- `lib/sanitize.ts`: UGC サニタイズ、URL 検証、アップロード MIME/サイズ検証

### API 層
- `/api/purchase`: tip% ホワイトリスト、UUID 検証、自己購入ブロック、レート制限
- `/api/coupon`: コード形式検証、レート制限、creator/admin のみ作成可
- `/api/follow`: self-follow ブロック、UUID 検証、レート制限
- `/api/review`: 購入済み検証、コメント長制限・サニタイズ
- `/api/request`: 自己リクエストブロック、message サニタイズ、budget 範囲検証
- `/api/banner`: admin 限定、フィールドホワイトリスト、URL 検証
- `/api/notify/delivery`: **納品したクリエイター本人のみ呼び出し可** に修正（既存バグ）
- `/api/download/[id]`: 所有者検証、署名URL 有効期限 60 秒、Cache-Control: no-store
- `/api/webhook`: Stripe 署名検証済み

### 入力検証/サニタイズ
- プロフィール編集 (`/mypage/profile`): 表示名/bio/SNS URL のサニタイズ、アバター MIME/サイズ検証
- クリエイターアップロード (`/creator/upload`): MIME/サイズ検証、拡張子正規化
- 納品 (`/creator/orders/[id]`): 納品ファイルの MIME/サイズ検証

---

## 手動実行が必要な設定

### 1. Supabase SQL Editor

次のファイルを順に実行:

1. `supabase_migration_v3_tip.sql`（未実行なら）
2. **`supabase_migration_v4_security.sql`** ← 今回のセキュリティ強化

v4 で行う主なこと:
- `profiles.email` を anon から非表示
- `purchases` の参照ポリシーを owner/creator/admin に拡張
- `profiles.role` の自己昇格防止
- self-follow / self-request / 自作レビュー防止
- `deliveries` バケットを private に強制
- `audit_logs` テーブル作成

### 2. Supabase Auth 設定（Dashboard → Authentication → Settings）

- **Minimum password length**: 10 以上
- **Email confirmations**: ON（本番公開時）
- **Secure email change**: ON（メール変更時に旧アドレス確認）
- **Leaked password protection**: ON（HaveIBeenPwned 統合）
- **Rate limiting**: デフォルト値より厳しく
  - Sign-ups per hour: 10
  - Sign-ins per hour: 30
- **MFA**: 管理者アカウントは必須化推奨（TOTP）

### 3. Supabase Storage 設定

- `deliveries` バケット: **private** 確認（v4 migration で強制）
- `contents` バケット: **private** 確認
- `thumbnails`, `avatars`: public（サムネ/アバターは公開でOK）
- 各バケットに Transform/File size limit を設定推奨

### 4. Stripe 設定

- **Webhook endpoint**: `/api/webhook` を本番 URL で登録
- **Webhook signing secret** (`STRIPE_WEBHOOK_SECRET`) を env に設定
- Radar（不正検知）を有効化、ルールを地域/金額で調整
- 本番 API キーは **KYC 完了後** に切り替え
- Stripe Dashboard の 2FA 必須化

### 5. 環境変数チェックリスト（本番 Vercel）

必須:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← **Server 側のみ。絶対に public にしない**
- `STRIPE_SECRET_KEY` ← 本番キー（sk_live_...）
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` = `https://my-focus.jp`
- `RESEND_API_KEY`（メール送信使うなら）

`.env.local` は `.gitignore` 済み。誤ってコミットしていないか定期確認。

### 6. 運用面

- **管理者アカウントの MFA 有効化**（Supabase Dashboard + Stripe Dashboard）
- 管理者の `role='admin'` 付与は SQL 直接叩く運用にする（UI から昇格させない）
- Stripe/Supabase ログを定期的に監査
- `audit_logs` テーブルに管理者アクションを記録する運用を徐々に広げる

---

## 未対応 / 今後の検討事項

- **コンテンツモデレーション**: `contents.review_status` フィールドはあるが自動化未実装。最初は手動審査 → 自動化検討
- **年齢認証**: プラットフォームの性質次第で要検討（利用規約に依存）
- **不正購入検知**: Stripe Radar + 独自ルール（短時間での大量購入等）
- **CSP を nonce 化**: 現状 `'unsafe-inline'` 許可。将来的に Script タグ nonce 対応で XSS 耐性を強化
- **監査ログの書き込み実装**: `audit_logs` テーブルは用意したが、各 admin API からの書き込みは未実装
- **バックアップ**: Supabase の Point-in-Time Recovery 有効化（有料プラン）
