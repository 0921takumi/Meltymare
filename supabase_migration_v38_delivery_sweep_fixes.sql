-- ============================================================
-- v38: 総点検で確定した残りのRLS/データ整合性バグをまとめて修正
--
-- 対象（すべて実ファイル検証＋敵対的反証を経て確定したもの）:
--   ① payouts テーブルにRLSが一度も有効化されていない（財務データが無防備）
--   ② follows_insert に role チェックが無い（v31と同型の見逃し）
--   ③ content_comments の insert が「公開済み・承認済みコンテンツか」
--     「parent_idが同じcontent_idのコメントか」を一切検証していない
--   ④ poll_votes が「そのアンケート固有の選択肢数」を超えるoption_indexを許容する
--   ⑤ polls_owner_write に role チェックが無い（v31と同型の見逃し、コード調査で追加発見）
--   ⑥ creator_blocks に role チェックが無い（v31と同型の見逃し）
--   ⑦ contents.stock_limit に0以下を防ぐCHECK制約が無い（自己ロックの防止）
--
-- Supabase SQL Editor で実行してください。冪等。
-- ============================================================

-- ── ① payouts: RLS未有効化（財務データがRLS保護なしで存在していた）──
alter table public.payouts enable row level security;

drop policy if exists "payouts_select" on public.payouts;
create policy "payouts_select" on public.payouts
  for select
  using (
    creator_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
-- insert/update/delete のポリシーは作らない（= authenticated からの直接書き込みは拒否）。
-- 実際の書き込みは app/api/admin-payout/route.ts が service_role 経由で行っており、
-- purchases/tips と同じく「業務ルール検証済みの書き込みはservice_roleに集約」する設計に揃える。

-- 確認(必須):
--   role='user' の実セッションで supabase.from('payouts').select('*') を叩いても
--   自分がcreator_idでない行は返らないこと。role='creator'は自分のpayoutsのみ見えること。

-- ── ② follows: creator_id が実際に creator/admin であることをRLSでも強制 ──
drop policy if exists "follows_insert" on public.follows;
create policy "follows_insert" on public.follows
  for insert
  with check (
    auth.uid() = follower_id
    and exists (select 1 from public.profiles p where p.id = creator_id and p.role in ('creator', 'admin'))
  );

-- ── ③ content_comments: 公開済み・承認済みコンテンツへの投稿のみ許可、
--     parent_id は同一content_id内のコメントのみ許可 ──
drop policy if exists "comments_insert" on public.content_comments;
create policy "comments_insert" on public.content_comments
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.contents c
      where c.id = content_comments.content_id
        and c.is_published = true
        and c.review_status = 'approved'
    )
    and (
      parent_id is null
      or exists (
        select 1 from public.content_comments pc
        where pc.id = content_comments.parent_id
          and pc.content_id = content_comments.content_id
      )
    )
  );

-- ── ④ poll_votes: そのアンケート固有の選択肢数を超えるoption_indexを拒否 ──
--     (v33の「poll.status='open'」チェックは維持したまま、選択肢数チェックを追加)
drop policy if exists "poll_votes_own_insert" on public.poll_votes;
create policy "poll_votes_own_insert" on public.poll_votes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.polls pl
      where pl.id = poll_id
        and pl.status = 'open'
        and option_index < jsonb_array_length(pl.options)
    )
  );

-- ── ⑤ polls: 作成/更新/削除は role='creator'|'admin' のみ（コード調査で追加発見） ──
drop policy if exists "polls_owner_write" on public.polls;
create policy "polls_owner_write" on public.polls for all to authenticated
  using (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  )
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- ── ⑥ creator_blocks: role チェック追加 ──
drop policy if exists "creators_manage_own_blocks" on public.creator_blocks;
create policy "creators_manage_own_blocks" on public.creator_blocks
  for all
  using (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  )
  with check (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator', 'admin'))
  );

-- ── ⑦ contents.stock_limit: 0以下を禁止(既存データがあってもnullや正の値のみ許容) ──
-- 既存に stock_limit<=0 の行があると ADD CONSTRAINT が失敗し、SQL Editorのトランザクション
-- ごと巻き戻る（v38全体が無適用になる）。先に不正値を null(無制限)へ補正してから制約を張る。
update public.contents set stock_limit = null where stock_limit is not null and stock_limit <= 0;
alter table public.contents drop constraint if exists contents_stock_limit_positive;
alter table public.contents add constraint contents_stock_limit_positive
  check (stock_limit is null or stock_limit >= 1);

-- 確認(任意):
--   1) role='user'の実セッションで supabase.from('follows').insert({follower_id:自分, creator_id:role=userの他人ID}) が拒否されること。
--   2) 未購入・未承認コンテンツへの content_comments insert が拒否されること。
--   3) 2択のpollに option_index=2,3 でのpoll_votes insertが拒否されること。
--   4) role='user'の実セッションで polls への直接insertが拒否されること。
--   5) role='user'の実セッションで creator_blocks への直接insertが拒否されること。
--   6) contents に stock_limit=0 をinsert/updateしようとするとCHECK制約違反になること。
-- ============================================================

-- ============================================================
-- 再監査で新規発見（2件）
-- ============================================================

-- ── ⑧ 🔴 自分(v35)が作り込んだ回帰: subscriptions の解約(cancel)が動かなくなっていた ──
--   v35で「app/配下にsubscriptionsへのinsert/updateコードは無い」と誤って断定し
--   subs_insert/subs_updateを両方dropしたが、実際は app/api/subscribe/route.ts の
--   DELETE(解約)ハンドラがセッションクライアントでupdateしており、subs_updateが
--   無いとRLSに阻まれて0行更新（.select()無しでエラーにならずサイレント失敗）になる。
--   結果、ユーザーが解約してもDB上はactiveのままなのにmember_countだけ減る不整合。
--   新規購読(insert)は引き続きPOSTが503固定で完全停止中のため subs_insert は復活させない。
--   解約(active→cancelled、本人のみ)専用に絞って subs_update のみ復活させる。
drop policy if exists "subs_update_cancel_own" on public.subscriptions;
create policy "subs_update_cancel_own" on public.subscriptions
  for update
  using (auth.uid() = user_id and status = 'active')
  with check (auth.uid() = user_id and status = 'cancelled');

-- 確認(必須):
--   status='active'の自分のsubscriptions行がある状態で
--   DELETE /api/subscribe?id=<id> を呼ぶと、DB上のstatusが実際にcancelledへ変わること。

-- ── ⑨ requests（廃止済み機能）: RLSがv2のまま放置され直接叩けば捏造・改ざん可能 ──
--   app/api/request/route.ts は POST/PATCH とも410 Goneで完全廃止済みだが、
--   requests_insert（role/statusチェック無し）・requests_update_creator
--   （WITH CHECK省略でUSING流用、自分がuser_idの行なら全列書き換え可能）が
--   v2以来無傷で残っており、認証済みユーザーが直接
--   supabase.from('requests').insert({..., status:'accepted', creator_reply:'...'})
--   を呼べば、app/mypage/notifications/page.tsx が今も requests を直接表示するため
--   「実在しないクリエイターからの承認/返信」を自分のマイページに捏造できた。
--   app/内を全数grepし、insert/updateする経路が皆無であることを確認済み
--   （唯一の書き込みは account/delete のservice_role経由DELETEのみで無関係）。
drop policy if exists "requests_insert" on public.requests;
drop policy if exists "requests_update_creator" on public.requests;

-- 確認(必須):
--   role='user'の実セッションで requests への insert/update が両方ともRLS違反で拒否されること。
--   /mypage/notifications の既存表示（読み取りのみ）には影響が無いこと。
-- ============================================================
