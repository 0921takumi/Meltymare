-- ============================================================
-- v51: submit_moderation_result の古い3引数オーバーロードを削除
--
-- 発見(全体検証で発覚): v28で作った submit_moderation_result(uuid, text, boolean)
-- を、v46が「create or replace」で4引数版(uuid, text, boolean, text)にしようとしたが、
-- PostgreSQLは引数の型/数が違う関数を別オーバーロードとして扱うため、
-- 実際にはreplaceされず3引数版と4引数版が両方本番に生き残っていた。
-- app/api/moderate/route.ts は p_rejection_reason を名前付きで渡すため常に4引数版に
-- 解決され現状は壊れていないが、将来どちらかの引数を省略した曖昧な呼び出しをすると
-- 「Could not choose the best candidate function」で失敗しうるスキーマドリフト。
-- 呼び出し元は4引数版のみ(grep済み)のため、3引数版を削除する。
-- ============================================================

drop function if exists public.submit_moderation_result(uuid, text, boolean);

-- 確認(任意):
--   select submit_moderation_result('<実在content id>'::uuid, 'approved') を実行すると
--   （3引数のデフォルト補完込みの呼び出しでも）4引数版が解決されて正常動作すること。
-- ============================================================
