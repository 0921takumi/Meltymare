-- ============================================================================
-- MyFocus Migration v22 — profiles PII 列の遮断（個情法ブロッカー / 実証済み脆弱性）
--
-- 背景（実証済み）:
--   profiles の RLS が `using (true)`（誰でも全行 SELECT 可）かつ列権限が未整備で、
--   anon（ブラウザ公開鍵 NEXT_PUBLIC_SUPABASE_ANON_KEY）から PostgREST 直叩きで
--     GET /rest/v1/profiles?select=email,bank_account_number,...&role=eq.creator
--   が通り、email が実際に漏洩。bank_*, birthdate, identity_document_url,
--   identity_selfie_url, identity_rejection_reason, suspended_reason/at,
--   signup_invite_code, identity_submitted_at/reviewed_at も列アクセス可能だった。
--
--   原因:
--     - v4_security の email 列 REVOKE は本番未適用。
--     - v5/v18 で後から追加した PII 列に列権限の手当てが無かった。
--
-- 方針（最小権限）:
--   1. profiles の **テーブル単位 SELECT** を anon/authenticated から REVOKE。
--   2. 「公開してよい列」だけを anon/authenticated に **列単位 GRANT**。
--   3. PII 列（email/bank_*/birthdate/identity_*・URL/suspended_*・
--      signup_invite_code・birthday_public・accepts_birthday_messages・is_suspended）は
--      GRANT に含めない → anon/authenticated からは一切 SELECT 不可。
--   4. service_role は列権限の影響を受けない（RLS/列権限をバイパス）ため、
--      正当な PII 参照（本人の /api/me、管理画面、誕生日機能）はサーバ側 service_role で行う。
--   5. INSERT/UPDATE 権限には触れない（本人による自己 PII 更新は RLS
--      profiles_update_self のまま維持。SELECT と UPDATE の列権限は独立）。
--
-- 重要な性質:
--   - REVOKE 後、anon/authenticated の `select('*')` は REVOKE 済み列を含むため
--     42501（permission denied）で **クエリ全体が失敗** する。よってアプリ側は
--     公開列だけを明示 select する（lib/profile-fields.ts の PROFILE_PUBLIC_SELECT）。
--   - `count(*)`（行数のみ）は列値を読まないため、公開列が1つでも GRANT されていれば動く。
--
-- 冪等・再実行 OK（REVOKE/GRANT は何度実行しても同じ状態に収束）。
-- 実行環境: PostgreSQL 15 / Supabase。実行方法: SQL Editor に全文貼り付けて実行。
-- 実行は **本タスク担当者（人間）** が行う（このファイルは生成のみ）。
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. 前提保証: 公開列が本番に確実に存在するように冪等補填（IF NOT EXISTS）。
--    歯抜け適用環境でも GRANT 対象列が欠けて失敗しないようにする。既存なら no-op。
--    （初期スキーマ / v18 SECTION0 由来。型・DEFAULT は元定義に合わせる）
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fee_rate INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'unsubmitted';

-- ----------------------------------------------------------------------------
-- 1. テーブル単位 SELECT を剥奪（これで `select('*')` 直叩きの全列読みを封鎖）
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- 念のため列単位の既存 SELECT も一旦剥奪（過去 migration の部分 GRANT 残骸の掃除）。
-- 全列を列挙して REVOKE（存在しない列を書くとエラーになるため、確実に在る列のみ）。
REVOKE SELECT (
  id, email, username, display_name, avatar_url, role, bio,
  twitter_url, instagram_url, tiktok_url, created_at,
  fee_rate, bank_name, bank_branch, bank_account_type,
  bank_account_number, bank_account_holder,
  identity_document_url, identity_selfie_url, identity_status,
  identity_submitted_at, identity_reviewed_at, identity_rejection_reason,
  birthdate, birthday_public, accepts_birthday_messages,
  is_suspended, suspended_reason, suspended_at, signup_invite_code
) ON public.profiles FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. 公開してよい列だけを列単位 GRANT（anon / authenticated）
--    ※ lib/profile-fields.ts の PROFILE_PUBLIC_COLUMNS と完全一致させること。
--    公開列の根拠:
--      id/username/display_name/avatar_url/bio/role/created_at … クリエイター公開ページ表示
--      twitter_url/instagram_url/tiktok_url … 公開 SNS リンク
--      fee_rate … クリエイター本人ダッシュボードの手数料表示（PII ではない。下記注記参照）
--      identity_status … Header の「本人確認バッジ」等の状態表示（書類本体は非公開）
--    ⚠️ ここに PII を足さないこと。
-- ----------------------------------------------------------------------------
GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  role,
  created_at,
  twitter_url,
  instagram_url,
  tiktok_url,
  fee_rate,
  identity_status
) ON public.profiles TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS の SELECT ポリシーは using(true) のままで良い（列権限が上限を縛る）。
--    行は誰でも見えるが、列が公開列に限定されるため PII は出ない。
--    INSERT/UPDATE のポリシー（profiles_insert / profiles_update_self /
--    profiles_update_admin）は変更しない。
-- ----------------------------------------------------------------------------
-- 変更なし（既存ポリシーを尊重）。

COMMIT;

-- ============================================================================
-- 適用後の検証（任意・別途実行）
-- ============================================================================
--
-- 1) anon の列権限が公開列だけになっているか（email 等の PII が無いこと）:
--    SELECT grantee, privilege_type, column_name
--      FROM information_schema.column_privileges
--     WHERE table_schema='public' AND table_name='profiles'
--       AND grantee IN ('anon','authenticated')
--     ORDER BY grantee, column_name;
--    -- 期待: id, username, display_name, avatar_url, bio, role, created_at,
--    --       twitter_url, instagram_url, tiktok_url, fee_rate, identity_status のみ。
--
-- 2) テーブル単位 SELECT が anon/authenticated から消えているか（0 行が正常）:
--    SELECT grantee, privilege_type
--      FROM information_schema.role_table_grants
--     WHERE table_schema='public' AND table_name='profiles'
--       AND grantee IN ('anon','authenticated') AND privilege_type='SELECT';
--    -- 期待: 0 行（列単位のみ残る）。
--
-- 3) 脆弱性の再現確認（anon 鍵で実行 → email 列で permission denied になること）:
--    curl 'https://<PROJECT>.supabase.co/rest/v1/profiles?select=email&role=eq.creator' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--    -- 期待: 42501 permission denied for table/column（200 で email が返らないこと）。
--
-- 4) 公開列だけの取得は引き続き成功すること:
--    curl 'https://<PROJECT>.supabase.co/rest/v1/profiles?select=id,username,display_name&role=eq.creator' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--    -- 期待: 200 で公開列が返る。
--
-- ============================================================================
-- 注記: fee_rate について
--   fee_rate は PII ではないが「クリエイター毎の手数料率」という運営内部の数値で、
--   anon に列挙されるのを避けたい場合は本 GRANT から外し、creator/dashboard など
--   本人参照を /api/me 経由に寄せれば公開を止められる。今回は本タスクのスコープ
--   （PII 遮断）を優先し、仕様の公開列リストに従って公開のままとした。
-- ============================================================================
