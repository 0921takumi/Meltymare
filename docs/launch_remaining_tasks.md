# MyFocus ローンチ残タスク総まとめ（最終チェック後）

最終更新: 2026-05-23 / 状態: **コード・機能・セキュリティ・DB は納品可能**。残るは「運用設定」のみ。

本番URL（現在稼働中・テスト可）: https://my-focus-neon.vercel.app

---

## A. 先方（ナオトさん / 株式会社91&Co.）タスク

### A-1. 🔴【必須・連絡済み】独自ドメイン接続（お名前.com）
- **現状**: `my-focus.jp` はお名前.com申込時のGMOレンタルサーバー（157.120.209.58 / NS: `ns-rs1.gmoserver.jp`）を向いており、本番アプリ（Vercel）に未接続。
- **Vercel側**: ドメイン登録済み・接続待ち。DNSが向けば自動で `https://my-focus.jp` 公開。
- **作業**:
  1. お名前.com Navi → my-focus.jp → ネームサーバーを「お名前.comのネームサーバー」(ns1〜4.onamae.com) に変更
  2. DNS設定で以下を追加（既存の157.x向けAレコードは削除）

  | タイプ | ホスト | VALUE | TTL |
  |---|---|---|---|
  | A | （空欄） | `76.76.21.21` | 3600 |
  | CNAME | `www` | `cname.vercel-dns.com` | 3600 |

### A-2. 🟡【メール送信したいなら必須・未連絡】Resend ドメイン認証（DNSレコード追加）
- **現状**: 本番に `RESEND_API_KEY` 未設定 → **お問い合わせ確認メール・納品完了メール等が送信されない**。
  - ※お問い合わせ内容は **DB（contact_messages）に保存** されるので消えない。管理画面で確認可能。
- **作業（ナオトさん分）**: たくみがResendに my-focus.jp を登録 → 表示されるDNSレコード（SPF / DKIM 等）を、A-1のDNS設定と一緒にお名前.comへ追加するだけ。
  - 想定レコード（正確な値はResend登録後にたくみから共有）:
    - TXT（SPF）: ホスト `send` → `v=spf1 include:amazonses.com ~all`
    - TXT（DKIM）: ホスト `resend._domainkey` → （Resend発行の固有値）
    - MX: ホスト `send` → `feedback-smtp.<region>.amazonses.com`（優先度10）

### A-3. 🟢【任意・後でOK・未連絡】AI画像モデレーション（AWS Rekognition）
- **現状**: アップロード画像の自動審査はオフ。**手動審査で運用可**（コンテンツガイドライン記載どおり、運営が目視審査）。
- **作業**: 自動化したい場合のみ、AWSアカウントのキー（AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）を用意。ローンチ後でも追加可。

---

## B. たくみ側タスク

- **B-1. メール有効化**: Resendアカウント作成 → my-focus.jp 追加 → DNSレコードをナオトさんへ共有（A-2）→ 認証完了後 `RESEND_API_KEY` をVercelに設定 → デプロイ。
- **B-2. デモアカウント削除**: `creator.demo@ / fan.demo@ / admin.demo@my-focus.jp`（pw: MyFocusDemo2026!）を**一般公開の直前に削除/無効化**。
- **B-3. Stripeライブキー ローテーション**（任意・衛生）: 過去にトランスクリプト露出のため、気になれば再発行→Vercel再設定（30秒）。

---

## ⚠️ 特に「まだ先方に伝えていない」項目
- **A-2（メール送信が未設定）** ← 最重要。ローンチ後「メール来ない」を防ぐため要連絡。
- **A-3（画像自動モデレーション未設定）** ← 任意だが共有しておく。

---

## 🔧 納品前 緊急修正履歴（2026-06-04 サブエージェント独立監査結果）

QA / Security / Devil / CDO 4方向独立監査で発見した BLOCKER を全件修正済み：

| 修正項目 | ファイル |
|---|---|
| `/api/subscribe` Stripe未統合 → 完全停止（POST 503・関連UI/ルート停止） | `app/api/subscribe/route.ts`, `lib/config.ts`, `proxy.ts`, `components/layout/Header.tsx`, `app/creator/[username]/page.tsx` |
| `/auth/callback` オープンリダイレクト → safeNext() | `app/auth/callback/route.ts` |
| `/api/tip` rate-limit + UUID検証 + sanitize | `app/api/tip/route.ts` |
| `/api/notify/delivery` delivery_status 必須化 | `app/api/notify/delivery/route.ts` |
| `/api/contact` sanitize強化 | `app/api/contact/route.ts` |
| `/admin/users` PostgREST注入対策 | `app/admin/users/page.tsx` |
| `/search` ilikeワイルドカードエスケープ | `app/search/page.tsx` |
| ホーム架空統計（1,240+ / ★4.9 / 420+）削除 | `app/page.tsx` |
| `/polls` empty state 中央寄せ＋誘導文 | `app/polls/page.tsx` |

再監査結果: **QA = GO（条件付き）/ Security = GO from security（β限定公開可）**

## 📋 Phase 2 / 運用課題（記録）

- **B-4. Upstash設定**（rate-limit本番化）: `UPSTASH_REDIS_REST_URL` / `_TOKEN` を Vercel env に設定すれば本番マルチインスタンスで rate-limit が効くようになる
- **B-5. サブスク機能再実装**（Phase 2）: `/api/subscribe` を Stripe Subscription Checkout で書き直し、webhook で active 遷移。実装が揃ったら `FEATURES.subscriptions = true` に
- **B-6. webhook event_id の DB 記録**: 監査証跡向上のため Stripe event_id を別テーブルに保存する仕組み（現状は status CAS で実質冪等性確保済み）
- **B-7. ヘッダー Disallow `/creator/requests` の削除**: 旧路は /creator/polls に移行済みのため robots.txt から外す（軽微）
- **B-8. Stripe Dashboard Webhook 配信エラー通知**（Devil再判定の必須条件）:
  - Dashboard → Developers → Webhooks → 該当エンドポイント → 「Failure notifications」を有効化
  - Slack or 管理者メール先を登録
  - **理由**: コード側で webhook handler は実装ミスでも 200 を返す設計（Stripe再送ループ防止）。配信エラー時に人間が拾える体制が無いと「決済済みなのに購入記録ナシ」を見逃すリスク（特商法第15条違反級）
- **B-9. 実機モバイル目視最終確認**（CDO再判定の残課題）:
  - iPhone/Android の本物の Safari/Chrome で `/contact` `/polls` `/` の右端テキスト切れがないか確認
  - 切れていたら個別ページのコンテナpadding/maxWidthを微調整
  - Chrome Headless はscrollbar領域予約の都合で実機より厳しめに表示されるため、headlessでのクリップは実機では出ない可能性が高い

## ✅ 最終チェック合格済み（参考）
- 品質: tsc エラー0 / build 90ページ成功 / lint エラー0
- ルート: 公開200・撤去307・保護307・無効API410・**500ゼロ**
- セキュリティ: 秘密非コミット / 全セキュリティヘッダ / RLS / service_role誤用なし
- DB: migration v12/v13/v14 全適用
- 決済: Stripeライブ + Webhook稼働
- SEO: robots / sitemap / OG画像
- モバイルUI: 主要9ページ実機確認済み
