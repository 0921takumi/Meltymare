-- ============================================================
-- MyFocus Migration v8 — 91&Co. 確定仕様反映
-- 手数料率20% / 最低振込5万 / 招待制 / アップロード5個制限
-- ============================================================

-- 1. fee_rate のデフォルトを 30% → 20% に変更
ALTER TABLE profiles ALTER COLUMN fee_rate SET DEFAULT 20;

-- 既存の30%設定（admin変更されていない初期値の人）を 20% に揃える
-- 注: 個別調整済みのクリエイターは触らない方針なので一律更新は行わない
-- 必要に応じて手動: UPDATE profiles SET fee_rate = 20 WHERE fee_rate = 30 AND role = 'creator';

-- 2. 招待コード
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  note TEXT,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_select_admin" ON invite_codes FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "invite_manage_admin" ON invite_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. invite_redemptions（誰が使ったか追跡）
CREATE TABLE IF NOT EXISTS invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invite_code_id, user_id)
);

ALTER TABLE invite_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redeem_select_admin" ON invite_redemptions FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. profiles に招待コード由来フラグ
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_invite_code TEXT;

-- 5. インデックス
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes(code) WHERE is_active = true;
