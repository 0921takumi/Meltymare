-- ============================================================
-- MyFocus Migration v12 — 本番DBに未適用だった profiles カラムの補填
--
-- 背景: 巡回監査で、過去マイグレーション（v6 誕生日 / v7 管理）の
--   ALTER TABLE ADD COLUMN が本番に部分適用で、以下6カラムが欠落していた。
--   これにより次の機能が壊れていた：
--     - 管理画面「ユーザー管理」ページ（is_suspended 等を select → エラー）
--     - アカウント凍結／解除（admin-user PATCH → 列なしで500）
--     - /birthdays ページ（.eq('birthday_public', true) → エラー）
--     - 誕生日メッセージ送信（accepts_birthday_messages を select → エラー）
--
-- すべて IF NOT EXISTS なので冪等・再実行OK。既存データに影響なし。
-- ============================================================

-- 管理：凍結フラグ（v7_admin 由来）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 誕生日機能（v6_phase3 由来）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_birthday_messages BOOLEAN NOT NULL DEFAULT true;

-- 招待コード経由のサインアップ記録（任意・null許容）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_invite_code TEXT;

-- 確認用
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles'
--   AND column_name IN ('is_suspended','suspended_reason','suspended_at',
--                       'birthday_public','accepts_birthday_messages','signup_invite_code');

-- ============================================================
-- 完了
-- ============================================================
