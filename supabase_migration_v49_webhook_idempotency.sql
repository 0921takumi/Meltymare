-- ============================================================
-- v49: Stripe webhook の重複処理防止テーブル
--
-- 経緯: charge.refunded の部分返金処理は「DBの現在値 × 比率」ではなく
-- 「charge.amount - charge.amount_refunded の絶対値」を都度採用するよう
-- 修正した（DB値への掛け算だと2回目の部分返金で二重に減額するバグがあった）。
-- ただしこの絶対値方式でも、同一イベントを2回処理すること自体は「2回とも
-- 同じ正しい値を書き込む」だけなので実害は無い……はずだが、
-- checkout.session.completed 側（sold_count/coupon消費のCAS RPC呼び出し等）は
-- 重複実行に対して同じ安全性が無いため、event_id 単位でイベントそのものの
-- 重複処理を止める汎用の仕組みを入れる。
-- ============================================================

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

-- ポリシーを一切作らない = anon/authenticated からは常に0件/拒否。
-- webhookはservice_role(RLSバイパス)からのみ読み書きする。
revoke all on public.stripe_webhook_events from public, anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

-- 確認(必須):
--   1. 同じ event.id を持つStripeイベントを（Stripeダッシュボードの「イベントを再送信」等で）
--      2回送ると、2回目は insert が 23505(unique_violation) で弾かれ
--      "[webhook] duplicate event ignored: evt_..." がログに出て 200 を返すこと。
--   2. role='authenticated' の実セッションで
--      supabase.from('stripe_webhook_events').select('*') が0件（またはエラー）になること。
-- ============================================================
