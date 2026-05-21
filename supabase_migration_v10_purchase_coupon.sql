-- ============================================================
-- MyFocus Migration v10 — purchases にクーポン/割引カラムを追加
--
-- 背景: /api/purchase が insert 時に original_amount / discount_amount /
--   coupon_id を書き込むが、これらのカラムが purchases テーブルに存在せず
--   insert が失敗 → purchase レコードが作られず、決済後の webhook が
--   対応レコードを見つけられない不具合があった。
--
-- 冪等（IF NOT EXISTS）なので再実行OK。
-- ============================================================

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS original_amount integer,
  ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.purchases.original_amount IS '割引前の商品価格（円）';
COMMENT ON COLUMN public.purchases.discount_amount IS 'クーポン割引額（円）';
COMMENT ON COLUMN public.purchases.coupon_id IS '適用クーポン（coupons.id）';

CREATE INDEX IF NOT EXISTS purchases_coupon_id_idx ON public.purchases(coupon_id);

-- 検索高速化（webhook が stripe_payment_intent_id で逆引きするため）
CREATE INDEX IF NOT EXISTS purchases_stripe_pi_idx ON public.purchases(stripe_payment_intent_id);

-- ============================================================
-- 完了
-- ============================================================
