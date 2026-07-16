-- ============================================================
-- v33: レビュー捏造の防止 + 投票/納品ストレージの軽微な穴の追加防御
--
-- 【最重要】reviews_insert RLS が「購入済みであること」を一切検証していなかった。
--   app/api/review/route.ts はAPI層で `.eq('status','completed')` の購入済みチェックを
--   行っているが、これまでの一連の発見と全く同じパターンで、RLS自体には business rule が
--   反映されておらず、認証済みユーザーが直接 supabase.from('reviews').insert(...) を
--   呼べば「一度も購入していないコンテンツ」に★5などの偽レビューを投稿できてしまう。
--   実地攻撃で確認済み（role='user'の未購入アカウントでレビュー投稿が成立した）。
--   評価操作(サクラレビュー/嫌がらせの低評価)によってクリエイターの信頼に直接影響するため、
--   今回の一連の修正の中でも実害の見えやすさが高い（今回の移籍タレントのようなクリエイターは
--   特に評価が売上に直結するため優先度が高いと判断）。
--
-- 【軽微】poll_votes_own_insert が poll.status='open' を検証していない
--   （二重投票自体はUNIQUE制約で既にブロックされているため実害は限定的だが、
--   締切後のアンケートに投票できてしまう整合性の穴として同時に塞ぐ）。
--
-- 【要確認】deliveries バケットの storage.objects ポリシーに role='creator' チェックを
--   追加する。ただし supabase_migration_v25 に記録されている通り、このプロジェクトの
--   Supabase では「SQL Editor から storage.objects のポリシーを作成/変更しても
--   "Success" 表示のまま実際には反映されないことがある」既知の制約があるため、
--   このブロックだけ実行後に自分でも直接アップロードして効果を確認してほしい
--   （効かない場合は Supabase Dashboard の Storage > Policies から手動編集が必要）。
--   実害は限定的（他人へのなりすましは既にブロック済み、読み取りも別ポリシーで
--   完全遮断済みのため、ストレージの無駄遣い程度に留まる）。
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

-- ── reviews: 購入済みチェックをRLSレベルでも強制 ──
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.purchases p
      where p.user_id = auth.uid()
        and p.content_id = reviews.content_id
        and p.status = 'completed'
    )
  );

-- ── poll_votes: 締切後の投票を防止(二重投票は既存UNIQUE制約で防止済み) ──
drop policy if exists "poll_votes_own_insert" on public.poll_votes;
create policy "poll_votes_own_insert" on public.poll_votes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.polls pl where pl.id = poll_id and pl.status = 'open')
  );

-- ── deliveries: role='creator'||'admin' チェックを追加(反映されない場合はDashboard手動編集) ──
drop policy if exists "deliveries_insert_creator" on storage.objects;
create policy "deliveries_insert_creator" on storage.objects for insert with check (
  bucket_id = 'deliveries'
  and auth.role() = 'authenticated'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
);

-- 確認(任意):
--   未購入のuser roleアカウントで reviews へ直接insertしても
--   RLS違反(new row violates row-level security policy)になること。
