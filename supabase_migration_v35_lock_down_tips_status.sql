-- ============================================================
-- v35: tips の直接completed捏造を防止
--
-- 発見した脆弱性:
--   tips_insert ポリシーが auth.uid() = user_id しかチェックしておらず、status に
--   制約が無かった。正規フロー(app/api/tip/route.ts)はStripe Checkout作成後に
--   status='pending' でinsertし、webhookが決済確認後にcompletedへ書き換える設計だが、
--   RLS自体はこの「pendingでしか作れない」を強制していなかったため、認証済みユーザーが
--   直接 supabase.from('tips').insert({..., status:'completed'}) を呼べば、
--   Stripe決済を一切せずに「チップ完了」を捏造できてしまっていた（実地攻撃で確認済み、
--   ¥100,000のチップ完了を無料ででっち上げ可能だった）。
--
--   tips に update ポリシーは存在しないため(webhookのcompleted確定はservice_role経由)、
--   insert 側で status='pending' のみを許可すれば同じ穴は塞がる。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

drop policy if exists "tips_insert" on public.tips;
create policy "tips_insert" on public.tips
  for insert
  with check (auth.uid() = user_id and status = 'pending');

-- 確認(任意):
--   role='user' の実セッションで status='completed' を指定してinsertするとRLS違反になり、
--   status='pending' を指定した場合は今まで通り成功すること
--   （app/api/tip/route.ts の正規フローは pending で insert するため影響なし）。

-- ============================================================
-- 同時に発見: subscriptions も全く同じパターン(所有権のみでstatus制約なし)。
--   subs_insert (WITH CHECK auth.uid()=user_id のみ) / subs_update (USING のみ、
--   WITH CHECK無し) のため、認証済みユーザーが自分名義で直接
--   status='active' の購読を挿入・更新でき、Stripe Subscription決済を一切せずに
--   有料会員特典を得られてしまう状態だった。
--
--   FEATURES.subscriptions=false で機能自体は現在停止中(Phase 2未実装)であり、
--   grep で確認した通り app/ 配下に subscriptions への insert/update コードは
--   一切存在しない(=今ドロップしても何も壊れない)。Phase 2実装時に、正しい
--   status遷移ルールと合わせてservice_role経由のポリシーを設計し直すこと。
-- ============================================================

drop policy if exists "subs_insert" on public.subscriptions;
drop policy if exists "subs_update" on public.subscriptions;

-- 確認(任意):
--   role='user' の実セッションで subscriptions への insert/update が
--   両方ともRLS違反になること。
