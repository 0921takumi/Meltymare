-- ============================================================
-- v45: is_suspended（アカウント凍結）が一切強制されていなかった問題を修正
--
-- 発見: profiles.is_suspended / suspended_reason / suspended_at は
--   app/api/admin-user/route.ts から admin が設定できるが、proxy.ts・API・
--   RLS のどこにも「is_suspended=true なら止める」処理が一切無かった。
--   つまり管理者が「凍結」ボタンを押しても、フラグが立つだけで当人は
--   普通にログインしてアプリを使い続けられる状態だった
--   （本人確認承認時にroleが昇格しなかったのと全く同じ「フラグは更新されるが
--   期待される効果が実装されていない」パターン）。
--
-- 方針:
--   is_suspended/suspended_reason は v22 で列単位REVOKE済みのPII列のため、
--   単純にauthenticatedへGRANTすると「他人の凍結理由が誰からでも見える」
--   別の問題を生む。auth.uid()自身の分だけを返すSECURITY DEFINER関数を
--   経由させ、role/deleted_atと合わせて1回のRPCでゲートに必要な情報を
--   まとめて取得できるようにする（列単位GRANT忘れ事故の再発防止も兼ねる）。
-- ============================================================

create or replace function public.my_auth_gate_info()
returns table(role text, deleted_at timestamptz, is_suspended boolean, suspended_reason text)
language sql
security definer
set search_path = public
stable
as $$
  select p.role, p.deleted_at, p.is_suspended, p.suspended_reason
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_auth_gate_info() from public, anon;
grant execute on function public.my_auth_gate_info() to authenticated;

-- 確認(必須):
--   role='user'の実セッションで rpc('my_auth_gate_info') を呼ぶと、
--   自分自身の role/deleted_at/is_suspended/suspended_reason が返ること。
--   別のユーザーの情報は一切取得できないこと（引数を取らずauth.uid()固定のため）。
-- ============================================================
