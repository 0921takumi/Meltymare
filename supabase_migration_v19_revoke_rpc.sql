-- ============================================================
-- MyFocus Migration v19 — RPC 関数の実行権限を最小化
--
-- 背景（Security 監査・実証済み BLOCKER）:
--   PostgreSQL は関数作成時に EXECUTE を PUBLIC へ自動付与する。
--   v18 は GRANT はしたが REVOKE FROM PUBLIC を欠いたため、anon（未認証）でも
--   PostgREST 直叩きで RPC を実行できた。
--   実証: anon.rpc('increment_sold_count', {content_id}) で sold_count が 12→13 に改竄。
--   影響: SOLD OUT 偽装 / 在庫破壊、クーポン枠焼却(DoS)、会員数カウンタ汚染。
--
-- 呼び出し元の実クライアントを精査した結果に基づく最小権限付与:
--   - increment_sold_count   : webhook / api/purchase が **service_role** で呼ぶ
--   - increment_coupon_used  : webhook / api/purchase が **service_role** で呼ぶ
--   - increment_member_count : (subscribe POST は停止中) 将来 service_role 用
--       → 上記3つは service_role 専用にする（authenticated からも剥奪 = 在庫操作の完全封鎖）
--   - redeem_invite_code     : api/invite/redeem が **authenticated** client で呼ぶ（内部 auth.uid 固定）
--   - decrement_member_count : api/subscribe DELETE が **authenticated** client で呼ぶ
--       → この2つは authenticated + service_role を維持（anon/PUBLIC のみ剥奪）
--
-- 冪等・再実行OK。
-- ============================================================

-- ---- グループA: service_role 専用（在庫・クーポン・会員数の増加系）----
REVOKE EXECUTE ON FUNCTION public.increment_sold_count(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_used(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_member_count(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_sold_count(uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_used(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_member_count(uuid) TO service_role;

-- ---- グループB: authenticated からの呼び出しが必要（招待引き換え・サブスク解約）----
--   anon / PUBLIC からの直叩きだけ遮断し、ログインユーザーの正規呼び出しは維持。
REVOKE EXECUTE ON FUNCTION public.redeem_invite_code(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decrement_member_count(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decrement_member_count(uuid) TO authenticated, service_role;

-- ============================================================
-- 確認（任意）: proacl に anon=X / =X（PUBLIC）が無いことを確認
--   SELECT proname, proacl FROM pg_proc
--    WHERE pronamespace='public'::regnamespace
--      AND proname IN ('increment_sold_count','increment_coupon_used',
--        'increment_member_count','decrement_member_count','redeem_invite_code')
--    ORDER BY proname;
-- ============================================================
