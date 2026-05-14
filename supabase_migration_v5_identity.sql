-- v5: 本人確認・年齢確認カラム追加（MyFocus クリエイター規約第3条対応）

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_document_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'unsubmitted'
    CHECK (identity_status IN ('unsubmitted', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS identity_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE;

CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON profiles(identity_status);

COMMENT ON COLUMN profiles.identity_status IS 'unsubmitted | pending | approved | rejected';
COMMENT ON COLUMN profiles.birthdate IS '生年月日（18歳以上確認用）';

-- Storage bucket 作成は Supabase Dashboard or SQL Editor で別途:
-- 1) `identity_documents` バケット (private) を作成
-- 2) ポリシー: 本人のみアップロード可 / adminのみ閲覧可
-- 詳細は docs/identity_bucket_setup.md 参照
