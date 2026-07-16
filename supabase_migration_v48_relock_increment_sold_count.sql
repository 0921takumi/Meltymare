-- ============================================================
-- v48: increment_sold_count(uuid) の権限が anon/authenticated に開いたまま
--      本番稼働していた件の修正（全体検証で発覚した実弾リグレッション）
--
-- 経緯:
--   v19 で increment_sold_count は「実証: anon.rpc('increment_sold_count', {content_id})
--   で sold_count が改竄可能」という実際のエクスプロイトが確認され、
--     revoke execute on function public.increment_sold_count(uuid) from public, anon, authenticated;
--     grant execute on function public.increment_sold_count(uuid) to service_role;
--   でロックダウン済みだった。
--
--   ところが v27 は在庫オーバーセルのCAS化のため
--     drop function if exists public.increment_sold_count(uuid);
--     create function public.increment_sold_count(content_id uuid) returns boolean ...
--   と「戻り値型を変えるための DROP → CREATE」を行い、その際に v19 と同じ
--   REVOKE/GRANT を再適用するのを漏らした。PostgreSQLは新規CREATE FUNCTIONの
--   デフォルト権限が「PUBLIC(全ロール)にEXECUTE可」なので、この瞬間から
--   v19で塞いだはずの穴が黙って再び開いた状態で本番稼働していた
--   （v28/v32/v36のコメントは「既にservice_role限定」という古い前提を検証し
--   直さないまま引用し続けていた）。
--
--   decrement_sold_count（v36で新規作成）は同じ理由でのDROP/CREATEが無かった
--   ため、最初からREVOKE/GRANTが正しく付いている＝チームはパターンを知っている。
--   increment_sold_count だけがv27のDROP/CREATEのタイミングで漏れた、という
--   単純な作業漏れであり、意図的な設計変更ではない。
-- ============================================================

revoke execute on function public.increment_sold_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_sold_count(uuid) to service_role;

-- 確認(必須):
--   role='authenticated' の実セッションで rpc('increment_sold_count', {content_id: '<実在のcontent id>'})
--   を呼ぶと permission denied for function になること
--   （webhook/purchase は service_role 経由なので影響なし）。
-- ============================================================
