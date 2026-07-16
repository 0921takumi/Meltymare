-- ============================================================
-- v41: increment_member_count / decrement_member_count の権限を service_role に限定
--
-- 発見した脆弱性:
--   両関数とも所有権チェックが一切なく（plan_id を受け取って無条件に±1するだけ）、
--   v16でauthenticatedにEXECUTE権限が付与されたままだった。
--   認証済みの任意ユーザーが直接
--     supabase.rpc('decrement_member_count', { plan_id: 任意のプランID })
--   を呼べば、購読していなくても任意のクリエイターの会員数表示を荒らせる状態だった
--   （increment側も同様に水増し可能）。
--
--   FEATURES.subscriptions=false で新規加入(POST)は完全停止中だが、解約(DELETE)経路
--   は稼働中で、app/api/subscribe/route.ts の解約ハンドラが実際にこのRPCを呼んでいる
--   （コード側は本SQLと同時にservice_role(admin)クライアント経由に変更済み）。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

revoke execute on function public.increment_member_count(uuid) from authenticated;
revoke execute on function public.decrement_member_count(uuid) from authenticated;
grant execute on function public.increment_member_count(uuid) to service_role;
grant execute on function public.decrement_member_count(uuid) to service_role;

-- 確認(任意):
--   role='user' の実セッションで
--     supabase.rpc('decrement_member_count', { plan_id: 任意 })
--   を呼ぶと permission denied for function になること。
--   既存の解約フロー（/api/subscribe DELETE、service_role経由）は今まで通り動作すること。
-- ============================================================
