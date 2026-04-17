-- ============================================================
-- MyFocus Migration v2
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. purchases テーブルに納品カラム追加（未実行の場合）
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_file_url TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. contents テーブルにタグカラム追加
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. フォロー テーブル
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, creator_id)
);

-- 4. レビュー テーブル
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, user_id)
);

-- 5. 販売リクエスト テーブル
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  budget INT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
  creator_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. クーポン テーブル
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value INT NOT NULL,
  min_amount INT DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. 特集バナー テーブル
CREATE TABLE IF NOT EXISTS featured_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. deliveries ストレージバケット（SQLでは作成できないためダッシュボードで作成）
-- Supabase Dashboard > Storage > New bucket: "deliveries" (private)

-- ============================================================
-- RLS ポリシー
-- ============================================================

-- follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE USING (auth.uid() = user_id);

-- requests
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_user" ON requests FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
CREATE POLICY "requests_insert" ON requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "requests_update_creator" ON requests FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = user_id);

-- coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "coupons_manage" ON coupons FOR ALL USING (
  auth.uid() = creator_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- featured_banners
ALTER TABLE featured_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "featured_select" ON featured_banners FOR SELECT USING (is_active = true);
CREATE POLICY "featured_manage" ON featured_banners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS follows_creator_id_idx ON follows(creator_id);
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS reviews_content_id_idx ON reviews(content_id);
CREATE INDEX IF NOT EXISTS requests_creator_id_idx ON requests(creator_id);
CREATE INDEX IF NOT EXISTS requests_user_id_idx ON requests(user_id);
