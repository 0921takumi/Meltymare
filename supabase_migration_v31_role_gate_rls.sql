-- ============================================================
-- v31: RLSポリシーに「所有権チェックのみで役割(role)チェックが漏れている」穴を塞ぐ
--
-- 発見した脆弱性（"クリエイターになる"バグと同種の"ゲートと実際の期待権限のズレ"を
-- 全体監査した結果、最も重大なものとして発見）:
--
--   contents_insert / contents_update RLSポリシーが
--     with check (creator_id = auth.uid())  -- INSERT
--     using (creator_id = auth.uid())        -- UPDATE
--   という「所有権」のみのチェックで、profiles.role='creator'（または'admin'）で
--   あることを一切検証していなかった。
--
--   app/creator/upload/page.tsx はブラウザから直接
--   supabase.from('contents').insert({...creator_id:user.id...}) / .update(payload) を
--   呼んでおり、サーバー側のrequireCreator()相当のロール再検証を一切経由しない。
--   proxy.ts の CREATOR_PREFIXES で /creator/upload へのルート遷移(ページ表示)は
--   塞がれているが、これはUIの入口を塞ぐだけで、認証済みユーザーが自分のSupabase
--   セッション(JWT)を使って直接PostgRESTへ insert/update リクエストを送ることは
--   一切妨げない。
--
--   結果: role='user'（本人確認未提出・クリエイター未承認）の一般ユーザーが、
--   自分のauth.uid()をcreator_idにセットするだけで、有料販売コンテンツを
--   新規作成・更新できてしまっていた。クリエイター申請・本人確認・運営承認という
--   一連の審査プロセスをまるごと迂回して「出品者になれる」、今回のセキュリティ
--   修正群の中で最も重大な抜け穴。
--
--   同型の問題を stories / subscription_plans / coupons / live_streams / auction_bids
--   の各テーブルの管理系ポリシーにも発見（一部は機能停止中のため実害は限定的だが、
--   将来の機能復活時の再発防止として同じタイミングで塞ぐ）。
--
-- 方針: 各ポリシーに
--   exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator','admin'))
-- を追加する。既存の管理者許可(admin OR分岐)がある場合はそれを保ったまま
-- creator_id=auth.uid()側の分岐にのみ役割チェックを足す。
--
-- Supabase SQL Editor で実行してください。冪等（drop policy if exists → create policy）。
-- ============================================================

-- ── contents（最重要）──
drop policy if exists "contents_insert" on public.contents;
create policy "contents_insert" on public.contents
  for insert
  with check (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

drop policy if exists "contents_update" on public.contents;
create policy "contents_update" on public.contents
  for update
  using (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  )
  with check (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- ── stories（FEATURES.stories=falseで機能停止中だが将来の再発防止として同時に塞ぐ）──
drop policy if exists "stories_insert" on public.stories;
create policy "stories_insert" on public.stories
  for insert
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

drop policy if exists "stories_delete" on public.stories;
create policy "stories_delete" on public.stories
  for delete
  using (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- ── subscription_plans（Stripe Subscription未統合で機能停止中だが同時に塞ぐ）──
drop policy if exists "plans_manage" on public.subscription_plans;
create policy "plans_manage" on public.subscription_plans
  for all
  using (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  )
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- ── coupons（既存の admin OR 分岐は維持し、creator_id 分岐にのみ role チェックを追加）──
drop policy if exists "coupons_manage" on public.coupons;
create policy "coupons_manage" on public.coupons
  for all
  using (
    (creator_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin')))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── live_streams / auction_bids（機能停止中だが同時に塞ぐ）──
drop policy if exists "live_manage" on public.live_streams;
create policy "live_manage" on public.live_streams
  for all
  using (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  )
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

drop policy if exists "bids_insert" on public.auction_bids;
create policy "bids_insert" on public.auction_bids
  for insert
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

drop policy if exists "bids_delete" on public.auction_bids;
create policy "bids_delete" on public.auction_bids
  for delete
  using (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- 確認(任意):
--   role='user' の一般アカウントの実セッションで
--   insert into contents (creator_id, title, price, content_type, file_url)
--     values (auth.uid(), 'test', 100, 'image', 'x') を試みてもRLS違反で拒否されること。
