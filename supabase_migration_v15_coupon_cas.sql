-- ============================================================
-- MyFocus Migration v15 — クーポン使用回数の CAS 化
--
-- 背景:
--   v11 で導入した increment_coupon_used は単純な「+1」更新で、
--   max_uses のチェックを行っていなかった。並列 webhook が同時に
--   同じクーポンを使ってきた場合、used_count が max_uses を超過する。
--
--   例: max_uses=1 のクーポンに 2 並列リクエスト
--     → 両方ともインクリメント成功 → used_count = 2 で上限超過
--
-- 対策:
--   UPDATE の WHERE 句に「max_uses 未満」「is_active=true」条件を入れ、
--   PostgreSQL の行ロックで atomic な CAS（compare-and-swap）にする。
--   さらに boolean を返すように変更し、呼び出し側が「上限到達で
--   インクリメントできなかった」ことを検知できるようにする。
--
--   既存呼び出しは戻り値を見ないだけで動作互換（select を呼ぶだけ）。
--
-- 冪等（create or replace）なので再実行 OK。
-- ============================================================

create or replace function public.increment_coupon_used(coupon_id uuid)
returns boolean as $$
declare
  rows_affected int;
begin
  update public.coupons
    set used_count = coalesce(used_count, 0) + 1
    where id = coupon_id
      and is_active = true
      and (max_uses is null or coalesce(used_count, 0) < max_uses);

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_coupon_used(uuid) to authenticated, service_role, anon;

-- ============================================================
-- 運用メモ:
--   この migration の適用後、used_count が max_uses を超過している
--   既存データがあれば手動で修正する。確認 SQL:
--
--     select id, code, used_count, max_uses
--       from public.coupons
--      where max_uses is not null
--        and used_count > max_uses;
-- ============================================================
