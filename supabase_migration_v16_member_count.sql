-- ============================================================
-- MyFocus Migration v16 — subscription_plans.member_count の atomic 操作
--
-- 背景:
--   /api/subscribe が member_count を「SELECT → +1 → UPDATE」の3ステップで更新していた。
--   並列リクエストで失われた更新（lost update）が発生し、実際の active subscription 数と
--   member_count がズレる。
--
-- 対策:
--   PostgreSQL の行レベルロックを利用した atomic な RPC を提供する。
--   purchases の sold_count と同じパターン。
--
-- 冪等（create or replace）なので再実行 OK。
-- ============================================================

create or replace function public.increment_member_count(plan_id uuid)
returns void as $$
  update public.subscription_plans
    set member_count = coalesce(member_count, 0) + 1
    where id = plan_id;
$$ language sql security definer;

create or replace function public.decrement_member_count(plan_id uuid)
returns void as $$
  update public.subscription_plans
    -- greatest で 0 未満にならないように clamp（並列キャンセル時の安全側）
    set member_count = greatest(coalesce(member_count, 0) - 1, 0)
    where id = plan_id;
$$ language sql security definer;

grant execute on function public.increment_member_count(uuid) to authenticated, service_role;
grant execute on function public.decrement_member_count(uuid) to authenticated, service_role;

-- ============================================================
-- 完了
-- ============================================================
