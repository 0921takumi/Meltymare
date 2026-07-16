-- ============================================================
-- v44: 🔴 v43で自分が作り込んだ退行を即修正 — deleted_at がauthenticatedから読めていなかった
--
-- 発見の経緯（実地検証で発覚）:
--   v43で追加した profiles.deleted_at は、v22(profiles PII列ロックダウン)で
--   anon/authenticated から列単位 REVOKE 済みの状態のまま、GRANT リストに追加し忘れていた。
--   これは v36 の birthday_messages 事故と全く同じパターン: 新しい列を追加した瞬間、
--   authenticated セッションからその列を select すると
--   "permission denied for table profiles" になる。
--
--   結果、以下の2箇所が完全にサイレント機能不全だった:
--     1) proxy.ts の deleted_at ゲート — エラーを無視してnullとして扱うため、
--        「削除申請中」のアカウントでも普通にログインしてアプリを使えてしまっていた
--        （復元ページへのリダイレクトが一度も発火しない）。
--     2) app/api/account/restore/route.ts — 本当は削除申請があるのに、
--        常に「削除申請はありません」(400)を返し、復元が一切できなかった。
--
--   実地検証: qa.v43.e2e@my-focus.jp で退会→再ログイン→復元APIを呼んだところ、
--   DBには deleted_at が実際に記録されているのに、authenticatedセッションからの
--   select は permission denied で失敗することを確認した。
--
-- 方針: deleted_at を v22 の公開列GRANTリストに追加する。
--   本人のdeleted_atが読めればよく、他人のdeleted_atが見えても実害は限定的
--   （「アカウントが削除申請中か」という程度の情報で、bank_*やidentity_*ほど機微ではない。
--    role/identity_statusと同水準の「ステータス表示」に分類）。
-- ============================================================

GRANT SELECT (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  role,
  created_at,
  twitter_url,
  instagram_url,
  tiktok_url,
  fee_rate,
  identity_status,
  deleted_at
) ON public.profiles TO anon, authenticated;

-- 確認(必須):
--   role='user'の実セッションで
--     supabase.from('profiles').select('deleted_at').eq('id', 自分).maybeSingle()
--   がエラー無く値を返すこと。
-- ============================================================
