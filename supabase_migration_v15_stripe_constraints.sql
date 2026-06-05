-- ============================================================
-- MyFocus Migration v15 — Stripe 整合性まわりの DB 制約修正
--
-- 背景 (CTO監査・Stripe Audit より):
--   1. purchases.status CHECK 制約が 'refunded' を許可していない
--      → charge.refunded webhook の `update({status:'refunded'})` が
--        23514 check_violation で失敗。返金処理が DB 反映されない。
--   2. tips.stripe_payment_intent_id に UNIQUE 制約がない
--      → 同一 payment_intent が複数 INSERT され webhook の .maybeSingle()
--        が "multiple rows returned" で壊れる可能性。
--
-- すべて冪等・再実行OK。既存データに影響なし。
-- ============================================================

-- 1. purchases.status の許可値拡張（'refunded' 'cancelled' を追加）
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));

-- 2. tips の Stripe payment_intent_id ユニーク化
--    NULL は重複可とするため部分ユニークインデックスを使用。
CREATE UNIQUE INDEX IF NOT EXISTS tips_stripe_pi_uniq
  ON public.tips(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 確認用
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conrelid = 'public.purchases'::regclass;
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'tips' AND indexname = 'tips_stripe_pi_uniq';

-- ============================================================
-- 完了
-- ============================================================
