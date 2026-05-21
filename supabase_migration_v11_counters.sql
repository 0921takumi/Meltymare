-- ============================================================
-- MyFocus Migration v11 — カウンター用 RPC 関数
--
-- 背景: webhook / api/purchase が increment_sold_count / increment_coupon_used を
--   呼んでいるが、これらの関数が DB に存在せず、購入してもカウンターが増えなかった。
--   結果として:
--     - contents.sold_count が増えない → 「残りX枚」「SOLD OUT」判定が機能しない
--     - coupons.used_count が増えない → クーポン使用上限(max_uses)が効かない
--
-- security definer で RLS をバイパス（サーバー側の正規フローからのみ呼ばれる）。
-- 冪等（create or replace）なので再実行OK。
-- ============================================================

-- 商品の販売数をインクリメント
create or replace function public.increment_sold_count(content_id uuid)
returns void as $$
  update public.contents
    set sold_count = coalesce(sold_count, 0) + 1
    where id = content_id;
$$ language sql security definer;

-- クーポンの使用回数をインクリメント
create or replace function public.increment_coupon_used(coupon_id uuid)
returns void as $$
  update public.coupons
    set used_count = coalesce(used_count, 0) + 1
    where id = coupon_id;
$$ language sql security definer;

-- 実行権限（authenticated と service_role）
grant execute on function public.increment_sold_count(uuid) to authenticated, service_role, anon;
grant execute on function public.increment_coupon_used(uuid) to authenticated, service_role, anon;

-- ============================================================
-- 完了
-- ============================================================
