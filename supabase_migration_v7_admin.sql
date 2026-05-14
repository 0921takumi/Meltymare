-- ============================================================
-- MyFocus Migration v7 — 管理画面拡充
-- ============================================================

-- 1. 問い合わせ
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','payment','technical','account','content','complaint')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. コメント通報
CREATE TABLE IF NOT EXISTS comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES content_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','copyright','other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, reporter_id)
);

-- 3. 管理者監査ログ
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. profiles.is_suspended 凍結フラグ
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 5. RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries_insert_anyone" ON inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "inquiries_select_owner_or_admin" ON inquiries FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "inquiries_update_admin" ON inquiries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_authed" ON comment_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_admin" ON comment_reports FOR SELECT USING (
  auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "reports_update_admin" ON comment_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON admin_actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "audit_insert_admin" ON admin_actions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. インデックス
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON comment_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_admin_idx ON admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_target_idx ON admin_actions(target_type, target_id);

-- ============================================================
-- デモシード
-- ============================================================
DELETE FROM inquiries WHERE id::text LIKE 'iq000000-%';
INSERT INTO inquiries (id, user_id, name, email, subject, body, category, priority, status, created_at) VALUES
  ('iq000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'みき', 'miki@example.com', '購入したコンテンツがダウンロードできません', 'ダウンロードボタンを押してもエラーが出ます。', 'technical', 'high', 'open', now() - interval '2 hours'),
  ('iq000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'ゆうき', 'yuuki@example.com', 'クリエイターからの返信が遅い', 'リクエストして1週間返信がない', 'complaint', 'normal', 'open', now() - interval '1 days'),
  ('iq000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'みなと', 'minato@example.com', 'クレジットカードが拒否される', '決済時にエラー', 'payment', 'urgent', 'in_progress', now() - interval '4 hours'),
  ('iq000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'はるか', 'haruka@example.com', '退会方法を教えてください', 'アカウント削除手順を確認したい', 'account', 'low', 'resolved', now() - interval '5 days'),
  ('iq000000-0000-0000-0000-000000000005', null, '匿名', 'anon@example.com', 'サービスの問い合わせ', '導入を検討しています', 'general', 'normal', 'open', now() - interval '3 hours'),
  ('iq000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', 'まなみ', 'manami@example.com', '不適切なコンテンツを通報したい', '○○のコンテンツが利用規約違反では？', 'content', 'high', 'open', now() - interval '6 hours');

DELETE FROM comment_reports WHERE id::text LIKE 'rp000000-%';
INSERT INTO comment_reports (id, comment_id, reporter_id, reason, detail, status, created_at) VALUES
  ('rp000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 'inappropriate', '不快な表現を含む', 'pending', now() - interval '3 hours'),
  ('rp000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000007', 'spam', '広告のような書き込み', 'pending', now() - interval '8 hours');
