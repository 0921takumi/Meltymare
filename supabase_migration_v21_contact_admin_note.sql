-- ============================================================
-- MyFocus Migration v21 — contact_messages.admin_note 追加
--
-- 背景（QA/Security 網羅監査）:
--   管理画面のお問い合わせ一覧（app/admin/inquiries/InquiriesList.tsx）が
--   contact_messages.update({ status, admin_note }) を実行しているが、
--   v18 で作成した contact_messages 定義に admin_note カラムが無く、
--   42703 (undefined_column) でステータス更新ごと失敗していた。
--
--   contact_messages の UPDATE は v18 の "contact_update_admin"（admin 限定）で
--   既に許可済みのため、カラム追加のみで解消する。
--
-- 冪等・再実行OK。既存データに影響なし。
-- ============================================================

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- ============================================================
-- 完了
-- ============================================================
