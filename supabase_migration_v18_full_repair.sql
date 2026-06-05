-- ============================================================================
-- MyFocus Migration v18 — 本番DB 統合修復（FULL REPAIR）
--
-- 目的:
--   本番 Supabase (ref: rjcsjgsnzmejbtptubor) はマイグレーションが歯抜け適用で、
--   コードが期待するテーブル / RPC関数 / RLS / トリガー / インデックスの約半分が
--   欠落していた。本ファイルは「本番に *欠けているものだけ* を冪等に作る」統合修復。
--
-- 設計原則（絶対要件）:
--   1. 既存14テーブル・既存データ（purchases 等の決済データ）を一切壊さない
--      - CREATE TABLE IF NOT EXISTS のみ。DROP TABLE / TRUNCATE は一切使わない。
--      - 既存テーブルへの変更は ADD COLUMN IF NOT EXISTS のみ（型変更・DROP COLUMN なし）。
--      - RLS は「DROP POLICY IF EXISTS → CREATE POLICY」で冪等化（PostgreSQL に
--        CREATE POLICY IF NOT EXISTS が無いため。ポリシーの入れ替えはデータ無影響）。
--   2. FK依存順に並べる（参照先テーブルを先に作る）。
--   3. コードが呼ぶ RPC 関数を全て含む（最終版を採用）。
--   4. RLS 有効化＋ポリシーを各テーブルに（元 migration の定義を尊重）。
--   5. 停止中機能（subscriptions/stories/live/auctions/comment系）もテーブルは作る
--      → SSR の select が PGRST205（relation not found）で 500 にならないように。
--        書き込みは FEATURES フラグで停止済みなので発生しない。
--   6. 全体を再実行可能（冪等）に。
--   7. 各セクションに「どの migration 由来か」をコメント。
--
-- 本番に *実在する* 14テーブル（information_schema 確認済み・触らない）:
--   audit_logs, contents, coupons, creator_blocks, featured_banners, follows,
--   inquiries, payouts, poll_votes, polls, profiles, purchases, requests, reviews
--
-- 実行環境: PostgreSQL 15 / Supabase（gen_random_uuid(), auth.uid(), auth.users 前提）
-- 実行方法: Supabase SQL Editor に全文貼り付けて実行（トランザクション一括）。
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 0. 防御的カラム保証（既存テーブル / IF NOT EXISTS のみ）
--   後段のトリガー・RLS が依存する列が「歯抜け適用」で欠落していた場合に備え、
--   先に冪等補填する。本番に既に在れば全て no-op。既存データに影響なし。
--   由来: supabase_migration.sql(初期) / v3_tip / v5_identity / v6 / v7 / v8 /
--         v10 / v12
-- ============================================================================

-- profiles: 手数料・振込情報（初期スキーマ由来）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fee_rate INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- profiles: 本人確認（v5_identity 由来）— v9 トリガー audit_identity_status が依存
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_document_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'unsubmitted',
  ADD COLUMN IF NOT EXISTS identity_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE;

-- profiles: 誕生日機能（v6 由来）/ 凍結（v7 由来）/ 招待（v8 由来）
-- ※ タスク確定情報では v12 で本番適用済みだが、防御的に冪等再保証する。
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_birthday_messages BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_invite_code TEXT;

-- contents: 審査ステータス（初期スキーマ由来）— v9 トリガー audit_content_review が依存
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';

-- contents: タグ（v2 由来）
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- purchases: 納品（初期/v2 由来）/ チップ（v3_tip 由来）/ クーポン割引（v10 由来）
--   ※ 決済データ本体。ADD COLUMN IF NOT EXISTS のみ。DEFAULT 付きなので既存行も安全。
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivered_file_url TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_price INTEGER,
  ADD COLUMN IF NOT EXISTS tip_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_amount INTEGER,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL;

-- purchases.status の許可値を拡張（v15_stripe_constraints 由来）
--   charge.refunded webhook が status='refunded' を書けるように。
--   CHECK 制約は付け替え（データ無影響）。
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));

-- purchases.tip_percent は 0/5/10/15（v3_tip 由来）
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_tip_percent_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_tip_percent_check
  CHECK (tip_percent IN (0, 5, 10, 15));

-- purchases 系インデックス（v3_tip / v10 由来）
CREATE INDEX IF NOT EXISTS purchases_tip_amount_idx ON public.purchases(tip_amount) WHERE tip_amount > 0;
CREATE INDEX IF NOT EXISTS purchases_coupon_id_idx ON public.purchases(coupon_id);
CREATE INDEX IF NOT EXISTS purchases_stripe_pi_idx ON public.purchases(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_profiles_identity_status ON public.profiles(identity_status);


-- ============================================================================
-- SECTION 1. 通知 — notifications（v5_notifications 由来）
--   ⚠ user_id は profiles ではなく auth.users(id) を参照（元定義を尊重）。
--   作成は service_role のみ（INSERT ポリシー無し = 元定義通り）。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,  -- 'purchase' | 'delivery' | 'tip' | 'follow' | 'request' | 'system'
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- SECTION 2. チップ — tips（v3 由来）+ Stripe一意制約（v15_stripe_constraints 由来）
--   FK: profiles。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tips (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount                   INT NOT NULL CHECK (amount > 0),
  message                  TEXT,
  stripe_payment_intent_id TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tips_select_related" ON public.tips;
CREATE POLICY "tips_select_related" ON public.tips FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = creator_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "tips_insert" ON public.tips;
CREATE POLICY "tips_insert" ON public.tips FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tips_creator_id_idx ON public.tips(creator_id);
CREATE INDEX IF NOT EXISTS tips_user_id_idx ON public.tips(user_id);
-- Stripe payment_intent の二重 INSERT 防止（NULL は重複可の部分ユニーク）
CREATE UNIQUE INDEX IF NOT EXISTS tips_stripe_pi_uniq
  ON public.tips(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;


-- ============================================================================
-- SECTION 3. お問い合わせ — contact_messages（v3 由来）
--   FK 無し（匿名フォーム）。誰でも INSERT、admin のみ SELECT/UPDATE。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','bug','payment','account','creator','other')),
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_insert_anyone" ON public.contact_messages;
CREATE POLICY "contact_insert_anyone" ON public.contact_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "contact_select_admin" ON public.contact_messages;
CREATE POLICY "contact_select_admin" ON public.contact_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "contact_update_admin" ON public.contact_messages;
CREATE POLICY "contact_update_admin" ON public.contact_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages(created_at DESC);


-- ============================================================================
-- SECTION 4. 管理者監査ログ — admin_actions（v7 由来）
--   FK: profiles（admin_id / resolved_by 等）。admin のみ SELECT/INSERT。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select_admin" ON public.admin_actions;
CREATE POLICY "audit_select_admin" ON public.admin_actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "audit_insert_admin" ON public.admin_actions;
CREATE POLICY "audit_insert_admin" ON public.admin_actions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS audit_admin_idx ON public.admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_target_idx ON public.admin_actions(target_type, target_id);


-- ============================================================================
-- SECTION 5. 招待制 — invite_codes → invite_redemptions（v8 / v17 由来）
--   FK依存順: invite_codes を先に、invite_redemptions が後（FK で参照）。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  note       TEXT,
  max_uses   INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invite_select_admin" ON public.invite_codes;
CREATE POLICY "invite_select_admin" ON public.invite_codes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "invite_manage_admin" ON public.invite_codes;
CREATE POLICY "invite_manage_admin" ON public.invite_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON public.invite_codes(code) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.invite_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invite_code_id, user_id)
);

ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "redeem_select_admin" ON public.invite_redemptions;
CREATE POLICY "redeem_select_admin" ON public.invite_redemptions FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 同一ユーザーの二重 redemption 防止（v17 由来。UNIQUE 制約と重複しても冪等）
CREATE UNIQUE INDEX IF NOT EXISTS invite_redemptions_unique
  ON public.invite_redemptions(invite_code_id, user_id);


-- ============================================================================
-- SECTION 6. コメント — content_comments → comment_likes / comment_reports
--   （v6 / v7 由来）
--   FK依存順: content_comments を先に（自己参照 parent_id 含む）、
--             comment_likes / comment_reports が後。
--   ⚠ 停止中機能（FEATURES でコメントは封鎖想定）。テーブルは作るが書き込みは発生しない。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  parent_id  UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
  is_hidden  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON public.content_comments;
CREATE POLICY "comments_select" ON public.content_comments FOR SELECT USING (is_hidden = false OR auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_insert" ON public.content_comments;
CREATE POLICY "comments_insert" ON public.content_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_update" ON public.content_comments;
CREATE POLICY "comments_update" ON public.content_comments FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete" ON public.content_comments;
CREATE POLICY "comments_delete" ON public.content_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comments_content_idx ON public.content_comments(content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.content_comments(parent_id);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.content_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comment_likes_select" ON public.comment_likes;
CREATE POLICY "comment_likes_select" ON public.comment_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "comment_likes_insert" ON public.comment_likes;
CREATE POLICY "comment_likes_insert" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comment_likes_delete" ON public.comment_likes;
CREATE POLICY "comment_likes_delete" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES public.content_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','copyright','other')),
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert_authed" ON public.comment_reports;
CREATE POLICY "reports_insert_authed" ON public.comment_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_select_admin" ON public.comment_reports;
CREATE POLICY "reports_select_admin" ON public.comment_reports FOR SELECT USING (
  auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "reports_update_admin" ON public.comment_reports;
CREATE POLICY "reports_update_admin" ON public.comment_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.comment_reports(status, created_at DESC);


-- ============================================================================
-- SECTION 7. バースデーメッセージ — birthday_messages（v6 由来）
--   FK: profiles（creator_id / user_id）。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.birthday_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  is_public  BOOLEAN NOT NULL DEFAULT true,
  year       INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, user_id, year)
);

ALTER TABLE public.birthday_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bday_select" ON public.birthday_messages;
CREATE POLICY "bday_select" ON public.birthday_messages FOR SELECT USING (is_public = true OR auth.uid() = user_id OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "bday_insert" ON public.birthday_messages;
CREATE POLICY "bday_insert" ON public.birthday_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bday_delete" ON public.birthday_messages;
CREATE POLICY "bday_delete" ON public.birthday_messages FOR DELETE USING (auth.uid() = user_id OR auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS bday_creator_idx ON public.birthday_messages(creator_id, year DESC);


-- ============================================================================
-- SECTION 8. サブスク — subscription_plans → subscriptions（v6 / v16 由来）
--   FK依存順: subscription_plans を先に、subscriptions が後（plan_id で参照）。
--   ⚠ 停止中機能（FEATURES.subscriptions=false）。POST は 503。
--     ただし既存契約の DELETE(=cancel) 経路は生きており、subscriptions の
--     select/update を行うためテーブルは必須。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  monthly_price INT NOT NULL CHECK (monthly_price >= 500),
  benefits      TEXT[] DEFAULT '{}',
  badge_emoji   TEXT DEFAULT '⭐',
  badge_color   TEXT DEFAULT '#a855f7',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  member_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select" ON public.subscription_plans;
CREATE POLICY "plans_select" ON public.subscription_plans FOR SELECT USING (is_active = true OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "plans_manage" ON public.subscription_plans;
CREATE POLICY "plans_manage" ON public.subscription_plans FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS plans_creator_idx ON public.subscription_plans(creator_id);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  creator_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at           TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs_select" ON public.subscriptions;
CREATE POLICY "subs_select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "subs_insert" ON public.subscriptions;
CREATE POLICY "subs_insert" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "subs_update" ON public.subscriptions;
CREATE POLICY "subs_update" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS subs_creator_idx ON public.subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS subs_user_idx ON public.subscriptions(user_id);


-- ============================================================================
-- SECTION 9. リクエストオークション — request_auctions → auction_bids（v6 由来）
--   FK依存順: request_auctions を先に、auction_bids が後。
--   ⚠ 停止中機能。テーブルは作るが書き込みは発生しない。
--   ※ request_auctions.awarded_bid_id は意図的に FK 制約を付けない
--     （auction_bids との循環参照を避けるため。元 migration も FK 無し）。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.request_auctions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  category       TEXT,
  budget_min     INT NOT NULL,
  budget_max     INT NOT NULL,
  deadline       TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','awarded','cancelled')),
  awarded_bid_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.request_auctions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auctions_select" ON public.request_auctions;
CREATE POLICY "auctions_select" ON public.request_auctions FOR SELECT USING (true);
DROP POLICY IF EXISTS "auctions_insert" ON public.request_auctions;
CREATE POLICY "auctions_insert" ON public.request_auctions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "auctions_update" ON public.request_auctions;
CREATE POLICY "auctions_update" ON public.request_auctions FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS auctions_status_idx ON public.request_auctions(status, deadline);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id     UUID NOT NULL REFERENCES public.request_auctions(id) ON DELETE CASCADE,
  creator_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bid_amount     INT NOT NULL CHECK (bid_amount > 0),
  message        TEXT NOT NULL,
  estimated_days INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_id, creator_id)
);

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bids_select" ON public.auction_bids;
CREATE POLICY "bids_select" ON public.auction_bids FOR SELECT USING (true);
DROP POLICY IF EXISTS "bids_insert" ON public.auction_bids;
CREATE POLICY "bids_insert" ON public.auction_bids FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "bids_delete" ON public.auction_bids;
CREATE POLICY "bids_delete" ON public.auction_bids FOR DELETE USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS bids_auction_idx ON public.auction_bids(auction_id);


-- ============================================================================
-- SECTION 10. ストーリー — stories → story_views（v6 由来）
--   FK依存順: stories を先に、story_views が後。
--   ⚠ 停止中機能。テーブルは作るが書き込みは発生しない。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url  TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption    TEXT,
  view_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select" ON public.stories;
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (expires_at > now() OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "stories_insert" ON public.stories;
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "stories_delete" ON public.stories;
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS stories_creator_idx ON public.stories(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories(expires_at);

CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id   UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_select" ON public.story_views;
CREATE POLICY "story_views_select" ON public.story_views FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "story_views_insert" ON public.story_views;
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- SECTION 11. ライブ配信 — live_streams → live_chat_messages（v6 由来）
--   FK依存順: live_streams を先に、live_chat_messages が後。
--   ⚠ 停止中機能。テーブルは作るが書き込みは発生しない。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_streams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  stream_url    TEXT,
  is_premium    BOOLEAN NOT NULL DEFAULT false,
  premium_price INT DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  viewer_peak   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_select" ON public.live_streams;
CREATE POLICY "live_select" ON public.live_streams FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_manage" ON public.live_streams;
CREATE POLICY "live_manage" ON public.live_streams FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS live_creator_idx ON public.live_streams(creator_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS live_status_idx ON public.live_streams(status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id         UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 200),
  is_super_chat     BOOLEAN NOT NULL DEFAULT false,
  super_chat_amount INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_chat_select" ON public.live_chat_messages;
CREATE POLICY "live_chat_select" ON public.live_chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "live_chat_insert" ON public.live_chat_messages;
CREATE POLICY "live_chat_insert" ON public.live_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- SECTION 12. RPC 関数（コードが呼ぶ。最終版を採用。security definer）
--   - increment_sold_count        : v11（webhook / api/purchase）
--   - increment_coupon_used       : v15_coupon_cas（v11 を上書き。boolean 返却 + CAS）
--   - increment_member_count      : v16
--   - decrement_member_count      : v16（api/subscribe DELETE）
--   - redeem_invite_code          : v17（api/invite/redeem）
--   - cleanup_rejected_identity_docs : v9（pg_cron 想定の保守関数）
--   - audit_log                   : v9（監査ログ書き込みヘルパ。トリガから利用）
--   ※ create or replace は冪等。grant も再実行 OK。
-- ============================================================================

-- 既存の古いバージョン関数を先に削除（戻り値型を変えるため CREATE OR REPLACE では不可）
DROP FUNCTION IF EXISTS public.increment_sold_count(uuid);
DROP FUNCTION IF EXISTS public.increment_coupon_used(uuid);
DROP FUNCTION IF EXISTS public.increment_member_count(uuid);
DROP FUNCTION IF EXISTS public.decrement_member_count(uuid);
DROP FUNCTION IF EXISTS public.redeem_invite_code(uuid);
DROP FUNCTION IF EXISTS public.cleanup_rejected_identity_docs();
DROP FUNCTION IF EXISTS public.audit_log(text, text, uuid, jsonb);

-- 商品の販売数 +1（残数/SOLD OUT 判定に必須）
CREATE OR REPLACE FUNCTION public.increment_sold_count(content_id uuid)
RETURNS void AS $$
  UPDATE public.contents
    SET sold_count = coalesce(sold_count, 0) + 1
    WHERE id = content_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- クーポン使用回数 +1（CAS: is_active かつ max_uses 未満のときだけ。boolean 返却）
CREATE OR REPLACE FUNCTION public.increment_coupon_used(coupon_id uuid)
RETURNS boolean AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE public.coupons
    SET used_count = coalesce(used_count, 0) + 1
    WHERE id = coupon_id
      AND is_active = true
      AND (max_uses IS NULL OR coalesce(used_count, 0) < max_uses);
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- サブスク会員数 +1（atomic）
CREATE OR REPLACE FUNCTION public.increment_member_count(plan_id uuid)
RETURNS void AS $$
  UPDATE public.subscription_plans
    SET member_count = coalesce(member_count, 0) + 1
    WHERE id = plan_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- サブスク会員数 -1（0 未満にならないよう clamp）
CREATE OR REPLACE FUNCTION public.decrement_member_count(plan_id uuid)
RETURNS void AS $$
  UPDATE public.subscription_plans
    SET member_count = greatest(coalesce(member_count, 0) - 1, 0)
    WHERE id = plan_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 招待コード redemption（CAS + auth.uid() 固定 + 履歴記録）
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_invite_code_id uuid)
RETURNS boolean AS $$
DECLARE
  rows_affected int;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.invite_codes
    SET used_count = coalesce(used_count, 0) + 1
    WHERE id = p_invite_code_id
      AND is_active = true
      AND (max_uses IS NULL OR coalesce(used_count, 0) < max_uses)
      AND (expires_at IS NULL OR expires_at > now());

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.invite_redemptions (invite_code_id, user_id)
    VALUES (p_invite_code_id, actor)
    ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 却下から1年経過した本人確認書類の削除（pg_cron で日次実行想定）
CREATE OR REPLACE FUNCTION public.cleanup_rejected_identity_docs()
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH stale AS (
    SELECT id::text AS user_id
    FROM public.profiles
    WHERE identity_status = 'rejected'
      AND identity_reviewed_at < now() - interval '1 year'
  )
  DELETE FROM storage.objects
  WHERE bucket_id = 'identity_documents'
    AND (storage.foldername(name))[1] IN (SELECT user_id FROM stale)
  RETURNING 1
  INTO deleted_count;

  RETURN coalesce(deleted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 監査ログ書き込みヘルパ（auth.uid()=actor_id で自動記録。トリガから利用）
CREATE OR REPLACE FUNCTION public.audit_log(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 実行権限
-- ⚠️ anon は付与しない（匿名のPostgREST直叩きで sold_count 改竄／クーポン枠焼却を防ぐ）。
--    purchase / webhook は service_role 経由で呼ぶため authenticated, service_role で十分。
GRANT EXECUTE ON FUNCTION public.increment_sold_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_used(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_member_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decrement_member_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(uuid) TO authenticated, service_role;


-- ============================================================================
-- SECTION 13. トリガー関数＋トリガー（既存テーブル対象。冪等）
--   対象テーブルは全て本番に実在: reviews / profiles / contents。
--   関数は create or replace、トリガーは drop if exists → create で冪等化。
--   profiles.identity_status / contents.review_status は SECTION 0 で保証済み。
--   由来: v4（reviews 自作レビュー防止） / v9（identity・content 監査トリガ）。
-- ============================================================================

-- reviews: 自分のコンテンツへのレビュー防止（v4 由来）
CREATE OR REPLACE FUNCTION public.reviews_check_not_own_content()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contents c
    WHERE c.id = NEW.content_id AND c.creator_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot review your own content';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_not_own_content ON public.reviews;
CREATE TRIGGER reviews_not_own_content
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_check_not_own_content();

-- profiles.identity_status 変更で監査ログ自動記録（v9 由来）
CREATE OR REPLACE FUNCTION public.trg_audit_identity_status_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.identity_status IS DISTINCT FROM OLD.identity_status THEN
    PERFORM public.audit_log(
      'identity.status_change',
      'profile',
      NEW.id,
      jsonb_build_object(
        'from', OLD.identity_status,
        'to', NEW.identity_status,
        'reason', NEW.identity_rejection_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_identity_status ON public.profiles;
CREATE TRIGGER audit_identity_status
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.identity_status IS DISTINCT FROM NEW.identity_status)
  EXECUTE FUNCTION public.trg_audit_identity_status_change();

-- contents.review_status 変更で監査ログ自動記録（v9 由来）
CREATE OR REPLACE FUNCTION public.trg_audit_content_review_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    PERFORM public.audit_log(
      'content.review_change',
      'content',
      NEW.id,
      jsonb_build_object(
        'from', OLD.review_status,
        'to', NEW.review_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_content_review ON public.contents;
CREATE TRIGGER audit_content_review
  AFTER UPDATE ON public.contents
  FOR EACH ROW
  WHEN (OLD.review_status IS DISTINCT FROM NEW.review_status)
  EXECUTE FUNCTION public.trg_audit_content_review_change();


-- ============================================================================
-- SECTION 14. 整合性ガード制約（既存テーブル。冪等。データ無影響のはず）
--   ⚠ 既存データが制約に違反していると ADD CONSTRAINT が失敗する。
--     その場合は違反行を先に是正すること（下部の運用メモ参照）。
--   由来: v4（self-follow / self-request 防止）。
-- ============================================================================
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_no_self;
ALTER TABLE public.follows ADD CONSTRAINT follows_no_self CHECK (follower_id <> creator_id);

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_no_self;
ALTER TABLE public.requests ADD CONSTRAINT requests_no_self CHECK (user_id <> creator_id);

COMMIT;

-- ============================================================================
-- 完了
-- ============================================================================
--
-- 【適用後の検証 SQL（任意・別途実行）】
--
-- 1) 欠落していたテーブルが全て揃ったか（18件期待）:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('notifications','tips','contact_messages','admin_actions',
--        'invite_codes','invite_redemptions','content_comments','comment_likes',
--        'comment_reports','birthday_messages','subscriptions','subscription_plans',
--        'request_auctions','auction_bids','stories','story_views',
--        'live_streams','live_chat_messages')
--    ORDER BY table_name;
--
-- 2) RPC 関数が揃ったか:
--   SELECT proname FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('increment_sold_count','increment_coupon_used',
--        'increment_member_count','decrement_member_count','redeem_invite_code',
--        'cleanup_rejected_identity_docs','audit_log')
--    ORDER BY proname;
--
-- 3) increment_coupon_used が boolean を返す最終版か:
--   SELECT proname, pg_get_function_result(oid) FROM pg_proc
--    WHERE proname = 'increment_coupon_used' AND pronamespace='public'::regnamespace;
--   -- 期待: boolean
--
-- 4) RLS が全テーブルで有効か（結果 0 行が正常）:
--   SELECT relname FROM pg_class
--    WHERE relnamespace='public'::regnamespace AND relkind='r'
--      AND relrowsecurity = false;
--
-- 【既存データが SECTION 14 の制約に違反していた場合の是正】
--   -- self-follow の確認:   SELECT * FROM public.follows  WHERE follower_id = creator_id;
--   -- self-request の確認:  SELECT * FROM public.requests WHERE user_id = creator_id;
--   -- 違反行があれば DELETE してから本マイグレーションを再実行する。
-- ============================================================================
