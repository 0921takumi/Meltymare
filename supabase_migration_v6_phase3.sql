-- ============================================================
-- MyFocus Migration v6 — Phase 2 remainder + Phase 3
-- Run this in Supabase SQL Editor after v5
-- 機能: バースデー / コメント / ストーリー / ライブ配信 /
--       リクエストオークション / サブスクリプション
-- ============================================================

-- 1. profile に誕生日公開フラグ・お祝い受付フラグ追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birthday_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_birthday_messages BOOLEAN NOT NULL DEFAULT true;

-- 2. バースデーメッセージ
CREATE TABLE IF NOT EXISTS birthday_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  year INT NOT NULL,                 -- どの年の誕生日宛か
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, user_id, year)
);

-- 3. コンテンツコメント (ファン繋がり)
CREATE TABLE IF NOT EXISTS content_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  parent_id UUID REFERENCES content_comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. コメントいいね
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES content_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- 5. ストーリー (24h で expires)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption TEXT,
  view_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ストーリー閲覧履歴 (既読管理)
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- 7. ライブ配信
CREATE TABLE IF NOT EXISTS live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  stream_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_price INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  viewer_peak INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ライブチャット
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 200),
  is_super_chat BOOLEAN NOT NULL DEFAULT false,
  super_chat_amount INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. リクエストオークション (既存 requests とは別の公開型)
CREATE TABLE IF NOT EXISTS request_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  budget_min INT NOT NULL,
  budget_max INT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','awarded','cancelled')),
  awarded_bid_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. 入札
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES request_auctions(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bid_amount INT NOT NULL CHECK (bid_amount > 0),
  message TEXT NOT NULL,
  estimated_days INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auction_id, creator_id)
);

-- 11. サブスクプラン (クリエイターが定義)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price INT NOT NULL CHECK (monthly_price >= 500),
  benefits TEXT[] DEFAULT '{}',
  badge_emoji TEXT DEFAULT '⭐',
  badge_color TEXT DEFAULT '#a855f7',
  is_active BOOLEAN NOT NULL DEFAULT true,
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. サブスク登録
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE birthday_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bday_select" ON birthday_messages FOR SELECT USING (is_public = true OR auth.uid() = user_id OR auth.uid() = creator_id);
CREATE POLICY "bday_insert" ON birthday_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bday_delete" ON birthday_messages FOR DELETE USING (auth.uid() = user_id OR auth.uid() = creator_id);

ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON content_comments FOR SELECT USING (is_hidden = false OR auth.uid() = user_id);
CREATE POLICY "comments_insert" ON content_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update" ON content_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON content_comments FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_select" ON stories FOR SELECT USING (expires_at > now() OR auth.uid() = creator_id);
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "stories_delete" ON stories FOR DELETE USING (auth.uid() = creator_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_views_select" ON story_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "story_views_insert" ON story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_select" ON live_streams FOR SELECT USING (true);
CREATE POLICY "live_manage" ON live_streams FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_chat_select" ON live_chat_messages FOR SELECT USING (true);
CREATE POLICY "live_chat_insert" ON live_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE request_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auctions_select" ON request_auctions FOR SELECT USING (true);
CREATE POLICY "auctions_insert" ON request_auctions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auctions_update" ON request_auctions FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids_select" ON auction_bids FOR SELECT USING (true);
CREATE POLICY "bids_insert" ON auction_bids FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "bids_delete" ON auction_bids FOR DELETE USING (auth.uid() = creator_id);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select" ON subscription_plans FOR SELECT USING (is_active = true OR auth.uid() = creator_id);
CREATE POLICY "plans_manage" ON subscription_plans FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
CREATE POLICY "subs_insert" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subs_update" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS bday_creator_idx ON birthday_messages(creator_id, year DESC);
CREATE INDEX IF NOT EXISTS comments_content_idx ON content_comments(content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON content_comments(parent_id);
CREATE INDEX IF NOT EXISTS stories_creator_idx ON stories(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories(expires_at);
CREATE INDEX IF NOT EXISTS live_creator_idx ON live_streams(creator_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS live_status_idx ON live_streams(status, scheduled_at);
CREATE INDEX IF NOT EXISTS auctions_status_idx ON request_auctions(status, deadline);
CREATE INDEX IF NOT EXISTS bids_auction_idx ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS plans_creator_idx ON subscription_plans(creator_id);
CREATE INDEX IF NOT EXISTS subs_creator_idx ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS subs_user_idx ON subscriptions(user_id);
