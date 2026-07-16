-- ============================================================
-- v30: 無料（100%クーポン）購入を1つのDB関数で原子化する
--
-- 発見した問題:
--   app/api/purchase/route.ts の無料購入経路(finalPrice===0)は、
--     1) admin.rpc('increment_coupon_used', ...) でクーポン used_count を先に消費
--     2) admin.from('purchases').upsert(...) で購入レコードを確定
--   という2つの別々のリクエストで構成されていた。1)が成功した直後に2)が何らかの理由
--   （DB書き込み失敗・接続断等）で失敗すると、クーポンだけ消費済みで購入は成立しない
--   不整合が残る。max_uses=1 のようなクーポンでこれが起きると、ユーザーは商品を
--   受け取れないままクーポンだけ無駄に消費され、再試行しても increment_coupon_used が
--   再度失敗（上限到達）して詰まる、という支援対応が必要な状態になり得た。
--
--   単純に処理順序を逆にする（先にupsertし後でクーポン消費）だけでは、今度は
--   「クーポン上限到達なのに商品だけ渡ってしまう」別の不整合（無料取得の抜け道）を
--   生んでしまうため、順序の入れ替えでは正しく直せない。
--
-- 方針:
--   クーポン消費(CAS)と購入レコードのupsertを1つのPostgres関数呼び出しに閉じ込める。
--   関数内で例外が起きれば、その関数呼び出し全体（内部で呼んだincrement_coupon_used含む）
--   が自動的にロールバックされるため、「クーポンだけ消費されて購入は成立しない」
--   という中途半端な状態が原理的に発生しなくなる。
--
-- Supabase SQL Editor で実行してください。冪等（何度実行しても安全）。
-- ============================================================

create or replace function public.complete_free_purchase(
  p_user_id uuid,
  p_content_id uuid,
  p_coupon_id uuid,
  p_original_amount integer,
  p_discount_amount integer,
  p_stripe_payment_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inc_ok boolean;
begin
  if p_coupon_id is not null then
    select public.increment_coupon_used(p_coupon_id) into inc_ok;
    if inc_ok is distinct from true then
      -- クーポン上限到達等。ここで return するため、以下の insert には到達しない
      -- （= 何も書き込まれない。呼び出し元は false を見て 400 を返す）。
      return false;
    end if;
  end if;

  insert into public.purchases (
    user_id, content_id, amount, content_price, tip_amount, tip_percent,
    original_amount, discount_amount, coupon_id, stripe_payment_intent_id,
    status, delivery_status
  ) values (
    p_user_id, p_content_id, 0, 0, 0, 0,
    p_original_amount, p_discount_amount, p_coupon_id, p_stripe_payment_intent_id,
    'completed', 'pending'
  )
  on conflict (user_id, content_id) do update set
    amount = 0,
    content_price = 0,
    tip_amount = 0,
    tip_percent = 0,
    original_amount = excluded.original_amount,
    discount_amount = excluded.discount_amount,
    coupon_id = excluded.coupon_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    status = 'completed',
    delivery_status = 'pending';

  -- insert/updateが失敗すれば例外がここで自動的に投げられ、関数呼び出し全体
  -- （直前の increment_coupon_used の効果を含む）がロールバックされる。
  return true;
end;
$$;

-- 確認(任意):
--   max_uses=1 のクーポンで select complete_free_purchase(...) を2回呼び、
--   2回目が false を返し、1回目のクーポン消費だけが正しく残ること。
