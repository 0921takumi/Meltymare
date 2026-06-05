-- ============================================================
-- MyFocus Migration v20 — 残る SECURITY DEFINER 関数の anon 実行を封鎖
--
-- 背景（Security 監査・v19の積み残し）:
--   v18 で作成した SECURITY DEFINER 関数のうち、v19 で REVOKE し損ねた2つが
--   PUBLIC（=anon 含む）実行可能のまま残っていた。
--
--   1. cleanup_rejected_identity_docs() 🔴 BLOCKER
--      SECURITY DEFINER で storage.objects（bucket=identity_documents）を DELETE。
--      → 未認証者が KYC 本人確認書類を破壊できる（PII消失・可用性喪失）。
--      これは pg_cron / 運用バッチからのみ呼ぶべき保守関数。
--
--   2. audit_log(text,text,uuid,jsonb) 🟡 HIGH
--      SECURITY DEFINER で audit_logs に INSERT（RLSバイパス）。
--      → 未認証者が監査ログを偽装・無制限挿入（ログ汚染 / ストレージDoS）。
--      ※ トリガー（trg_audit_*、これも SECURITY DEFINER・所有者postgres）からの
--        PERFORM 呼び出しは所有者権限で実行されるため、authenticated から
--        REVOKE しても profiles/contents 更新時の監査記録は壊れない。
--
-- 冪等・再実行OK。
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.cleanup_rejected_identity_docs()         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_rejected_identity_docs()         TO service_role;

REVOKE EXECUTE ON FUNCTION public.audit_log(text, text, uuid, jsonb)       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.audit_log(text, text, uuid, jsonb)       TO service_role;

-- ============================================================
-- 確認（任意）: proacl に anon=X / =X（PUBLIC）が無いことを確認
--   SELECT proname, proacl FROM pg_proc
--    WHERE pronamespace='public'::regnamespace
--      AND proname IN ('cleanup_rejected_identity_docs','audit_log');
-- ============================================================
