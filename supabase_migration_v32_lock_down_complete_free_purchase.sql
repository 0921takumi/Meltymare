-- ============================================================
-- v32: 🔴 緊急修正 — complete_free_purchase の実行権限を service_role のみに制限
--
-- 発見した脆弱性（v30で自分が作った関数に起因、実地攻撃で確認済み）:
--   complete_free_purchase(p_user_id, p_content_id, p_coupon_id, p_original_amount,
--   p_discount_amount, p_stripe_payment_intent_id) は SECURITY DEFINER 関数だが、
--   PostgreSQLの既定挙動により明示的なGRANT/REVOKEが無いと anon/authenticated ロールにも
--   EXECUTE権限が開いたままになる。
--
--   このRPCは「呼び出し元(app/api/purchase/route.ts)が既にStripe決済・クーポン検証・
--   金額計算を済ませたあとの、最後のDB書き込みだけを原子化する」という設計だったため、
--   p_user_id・p_original_amount・p_discount_amount を一切検証せず鵜呑みにする。
--
--   実地攻撃で確認した実害:
--     1) role='user' の一般ユーザーが supabase.rpc('complete_free_purchase', {...}) を
--        ブラウザから直接呼び、Stripe決済を一切通さず任意の有料コンテンツ(確認時¥9,999)を
--        status='completed' の購入としてタダで取得できた。
--     2) p_user_id に他人のIDを指定するだけで、他人になりすまして購入レコードを
--        作成できた（本人が知らないうちに「購入済み」にされる/納品対象にされる）。
--
--   一方 increment_sold_count / increment_coupon_used は既に service_role 限定に
--   なっており(呼び出すと'permission denied')、この2つは影響なし。
--   submit_moderation_result / resubmit_content_for_review は anon/authenticated から
--   呼び出し自体は可能だが、関数内部で auth.uid() を使い「自分がcreator_idの行のみ」
--   「pending/rejectedからのみ」等の条件を必ず満たすため、他人への影響・なりすましは
--   できない設計であることを確認済み（対応不要）。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

revoke all on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) from public;
revoke all on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) from anon;
revoke all on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) from authenticated;
grant execute on function public.complete_free_purchase(uuid, uuid, uuid, integer, integer, text) to service_role;

-- 確認(任意):
--   role='user' の一般アカウントの実セッションで
--   supabase.rpc('complete_free_purchase', {...}) を呼ぶと
--   "permission denied for function complete_free_purchase" になること
--   （app/api/purchase/route.ts は service_role の admin クライアント経由で呼ぶため、
--    正規の無料購入フロー自体は今まで通り動作する）。
