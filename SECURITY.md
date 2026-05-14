# My Focus セキュリティ設計メモ

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

## 🔴 公開前に必ず実行する手動ステップ（順番に）

### Step 1: Supabase SQL migration v9 実行
SQL Editor で `supabase_migration_v9_identity_hardening.sql` を実行。これでやること:
- identity_documents バケットの RLS 強化（本人 + admin のみ閲覧可）
- 退会/却下書類の自動削除関数 `cleanup_rejected_identity_docs()`
- identity_status / review_status 変更時の自動監査ログ trigger
- 監査ログ書き込みヘルパ関数 `audit_log()`

### Step 2: Supabase Dashboard 手動設定
1. **MFA の強制**: Auth → Settings → "Enable MFA" を ON。**少なくとも admin アカウントは TOTP 必須化**。
2. **Leaked password protection**: Auth → Settings → "Leaked password protection" を ON（HaveIBeenPwned連携）。
3. **PITR（Point-in-Time Recovery）有効化**: Pro プランで利用可。Database → Backups → PITR を ON。月数百円。
4. **pg_cron 拡張**: Database → Extensions → `pg_cron` を有効化（書類クリーンアップを日次実行する場合）。
   有効化後、以下を SQL Editor で実行:
   ```sql
   select cron.schedule('cleanup-identity', '0 3 * * *', 'select public.cleanup_rejected_identity_docs()');
   ```

### Step 3: Upstash Redis セットアップ（レート制限の本番対応）
1. https://upstash.com で無料アカウント作成
2. New Database → Type: Redis → Region: Tokyo (ap-northeast-1) → Free tier OK
3. 作成後 "REST API" タブから以下を取得:
   - `UPSTASH_REDIS_REST_URL` （`https://xxxx.upstash.io`）
   - `UPSTASH_REDIS_REST_TOKEN`
4. Vercel の環境変数に追加（本番）

### Step 4: AWS Rekognition セットアップ（AI 審査）
1. AWS Console → IAM → 新規ユーザー `myfocus-rekognition` 作成
2. ポリシー `AmazonRekognitionReadOnlyAccess` をアタッチ
3. アクセスキーを発行（CLI 用）
4. Vercel の環境変数に追加:
   - `AWS_REGION=ap-northeast-1`
   - `AWS_ACCESS_KEY_ID=AKIA...`
   - `AWS_SECRET_ACCESS_KEY=...`
   - （optional）`AWS_REKOGNITION_THRESHOLD=80`（既定値、必要なら調整）
5. Free tier: 月5,000 枚まで無料。超過は $0.001/枚。

### Step 5: 環境変数の最終確認（Vercel Production）
必須:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` （server only）
- `STRIPE_SECRET_KEY` （sk_live_...）
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL=https://my-focus.jp`
- `RESEND_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## 実装済み（コード側）追加

### レート制限の本番化
- `lib/rate-limit.ts` を **Upstash Redis** 対応に書き換え
- 環境変数未設定時はインメモリにフォールバック（dev 用、本番では必ず Upstash 設定）
- フェイルオープン設計（Redis 障害時はリクエスト通す → サービス停止を避ける）

### AI コンテンツモデレーション
- `lib/moderation.ts`: AWS Rekognition `DetectModerationLabels` ラッパ
- `/api/moderate`: クリエイター本人のみ実行可、`audit_logs` に記録
- `app/creator/upload/page.tsx`: 投稿時に自動で `/api/moderate` を呼ぶ
- 判定ロジック:
  - Hard reject: Explicit Nudity, Violence, Drugs, Self-Injury, Hate Symbols 等
  - Soft flag (人力レビュー): Revealing Clothes, Swimwear, Alcohol, Smoking 等
  - 動画は当面 `pending` 固定（人力レビュー必須）→ Phase 2 で非同期ジョブ実装

### 監査ログ
- `lib/audit.ts`: サーバー側で `audit_logs` に記録するヘルパ
- `audit_logs` テーブルへの書き込みを `/api/banner` に実装（admin 操作）
- DB 側でも `profiles.identity_status` / `contents.review_status` 変更時に自動で監査ログを記録する trigger を追加

---

## 未対応 / 今後の検討事項

- **CSP を nonce 化**: 現状 `'unsafe-inline'` 許可。将来的に Script タグ nonce 対応で XSS 耐性を強化
- **動画モデレーションの非同期ジョブ**: Rekognition `StartContentModeration` + SNS/SQS で結果受信
- **年齢認証**: プラットフォームの性質次第で要検討（利用規約に依存）
- **不正購入検知**: Stripe Radar + 独自ルール（短時間での大量購入等）
- **EXIF 情報の自動削除**: クリエイター投稿時に位置情報を除去（自宅特定リスク対策）
- **退会/データ削除フロー**: GDPR/個人情報保護法対応
